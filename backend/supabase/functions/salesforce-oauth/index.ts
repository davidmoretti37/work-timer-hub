import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64UrlEncode(bytes: Uint8Array): string {
  const bin = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  const b64 = btoa(bin);
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie") || "";
  return header.split("; ").reduce((acc: Record<string, string>, kv) => {
    const idx = kv.indexOf("=");
    if (idx > -1) {
      const k = kv.slice(0, idx);
      const v = kv.slice(idx + 1);
      acc[k] = v;
    }
    return acc;
  }, {});
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const action = segments[segments.length - 1];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    if (action === "login") {
      // Support both direct functions domain and /functions/v1 gateway
      const callbackPath = url.pathname.replace(/\/login$/, "/callback");
      const callbackUrl = `${url.origin}${callbackPath}`;

      // CSRF state cookie
      const randomBytes = crypto.getRandomValues(new Uint8Array(32));
      const state = base64UrlEncode(randomBytes);

      const authUrl = new URL(
        `${Deno.env.get("SALESFORCE_INSTANCE_URL")}/services/oauth2/authorize`
      );
      authUrl.searchParams.set("client_id", Deno.env.get("SALESFORCE_CLIENT_ID") || "");
      authUrl.searchParams.set("redirect_uri", callbackUrl);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid profile email");
      authUrl.searchParams.set("state", state);

      const headers = new Headers({
        Location: authUrl.toString(),
        ...corsHeaders,
      });
      headers.append(
        "Set-Cookie",
        `sf_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
      );

      return new Response(null, { status: 302, headers });
    }

    if (action === "callback") {
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      const stateParam = url.searchParams.get("state");
      const cookies = parseCookies(req);
      const stateCookie = cookies["sf_oauth_state"];

      if (error) {
        return new Response(
          `<script>window.location.href = '/login?error=${error}'</script>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      if (!code) {
        return new Response("Missing authorization code", { status: 400 });
      }

      // Validate state
      if (!stateParam || !stateCookie || stateParam !== stateCookie) {
        return new Response(
          `<script>window.location.href = '/login?error=csrf_mismatch'</script>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      // Exchange code for token
      const tokenResp = await fetch(
        `${Deno.env.get("SALESFORCE_INSTANCE_URL")}/services/oauth2/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code,
            client_id: Deno.env.get("SALESFORCE_CLIENT_ID") || "",
            client_secret: Deno.env.get("SALESFORCE_CLIENT_SECRET") || "",
            // Use the current callback URL directly to avoid regex parsing issues
            redirect_uri: `${url.origin}${url.pathname}`,
          }).toString(),
        }
      );

      if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        throw new Error(`Token exchange failed: ${tokenResp.status} ${errText}`);
      }

      const tokenData = await tokenResp.json();
      if (!tokenData.access_token) {
        throw new Error("Failed to get access token from Salesforce");
      }

      // Fetch userinfo
      const userResp = await fetch(
        `${tokenData.instance_url}/services/oauth2/userinfo`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      if (!userResp.ok) {
        const errText = await userResp.text();
        throw new Error(`Userinfo fetch failed: ${userResp.status} ${errText}`);
      }
      const salesforceUser = await userResp.json();

      // Upsert employee
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .upsert(
          {
            salesforce_id: salesforceUser.user_id,
            email: salesforceUser.email,
            name: salesforceUser.name,
          },
          { onConflict: "salesforce_id" }
        )
        .select("id")
        .single();
      if (employeeError) {
        throw new Error(`Failed to upsert employee: ${employeeError.message}`);
      }

      // Idempotent clock-in for current UTC day
      // Check if ANY clock-in record exists today (clocked_in OR clocked_out)
      // to prevent auto-clocking back in after the user has clocked out
      // Atomic insert: Let the database unique index prevent duplicates
      const today = new Date().toISOString().split("T")[0];
      const { error: clockInError } = await supabase
        .from("clock_in_records")
        .insert({ employee_id: employee.id, status: "clocked_in" });

      // Handle unique constraint violation (duplicate clock-in)
      if (clockInError) {
        // PostgreSQL error code 23505 = unique_violation
        if (clockInError.code === '23505' || clockInError.message?.includes('unique_active_clock_in_per_employee_per_day')) {
          console.log('[salesforce-oauth callback] Duplicate clock-in prevented by database constraint');
          // Continue silently - user is already clocked in
        } else {
          throw new Error(`Failed to clock in: ${clockInError.message}`);
        }
      }

      // Clear state cookie and redirect
      const headers = new Headers({ "Content-Type": "text/html" });
      headers.append(
        "Set-Cookie",
        "sf_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
      );

      return new Response(
        `
        <html>
          <head><title>Logging in...</title></head>
          <body>
            <script>
              localStorage.setItem('user', JSON.stringify({
                salesforceId: ${JSON.stringify(salesforceUser.user_id)},
                email: ${JSON.stringify(salesforceUser.email)},
                name: ${JSON.stringify(salesforceUser.name)}
              }));
              window.location.href = '/dashboard';
            </script>
          </body>
        </html>
        `,
        { headers }
      );
    }

    // ============================================
    // ACTION 3: Server-to-server clock-in webhook
    // ============================================
    if (action === "clockin-webhook" && req.method === "POST") {
      const secret = Deno.env.get("SALESFORCE_WEBHOOK_SECRET") || "";
      const provided = req.headers.get("x-webhook-secret") || "";
      if (!secret || provided !== secret) {
        return new Response("Unauthorized", { status: 401 });
      }

      const payload = await req.json().catch(() => ({}));

      async function upsertAndClockIn(single: any): Promise<boolean> {
        // If status is provided, only process successful logins
        const statusVal: string | undefined = (single?.status ?? single?.Status);
        if (typeof statusVal === "string" && statusVal.toLowerCase() !== "success") {
          return false; // skip failed/other statuses
        }

        const salesforceId: string | undefined = single?.salesforce_id || single?.user_id;
        const email: string | undefined = single?.email;
        const name: string | undefined = single?.name;
        if (!salesforceId && !email) {
          // skip invalid record
          return false;
        }

        // Upsert employee, preferring salesforce_id; fallback to email
        let employeeId: string | undefined;
        if (salesforceId) {
          const { data: empBySf, error: upsertErr } = await supabase
            .from("employees")
            .upsert(
              { salesforce_id: salesforceId, email: email || `${crypto.randomUUID()}@placeholder.local`, name },
              { onConflict: "salesforce_id" }
            )
            .select("id")
            .single();
          if (upsertErr) {
            throw new Error(`Upsert error: ${upsertErr.message}`);
          }
          employeeId = empBySf?.id;
        } else if (email) {
          const { data: existing, error: existingErr } = await supabase
            .from("employees")
            .select("id, salesforce_id")
            .eq("email", email)
            .maybeSingle();
          if (existingErr && existingErr.code !== "PGRST116") {
            throw new Error(`Lookup error: ${existingErr.message}`);
          }
          if (!existing) {
            const { data: created, error: createErr } = await supabase
              .from("employees")
              .insert({ email, name, salesforce_id: salesforceId || undefined })
              .select("id")
              .single();
            if (createErr) {
              throw new Error(`Create error: ${createErr.message}`);
            }
            employeeId = created.id;
          } else {
            employeeId = (existing as any).id;
          }
        }

        if (!employeeId) return false;

        // Atomic insert: Let the database unique index prevent duplicates
        const { error: clockInError } = await supabase
          .from("clock_in_records")
          .insert({ employee_id: employeeId, status: "clocked_in" });

        // Handle unique constraint violation (duplicate clock-in)
        if (clockInError) {
          // PostgreSQL error code 23505 = unique_violation
          if (clockInError.code === '23505' || clockInError.message?.includes('unique_active_clock_in_per_employee_per_day')) {
            console.log('[salesforce-oauth webhook] Duplicate clock-in prevented by database constraint');
            // Continue silently - user is already clocked in
          } else {
            throw new Error(`Clock-in error: ${clockInError.message}`);
          }
        }

        return true;
      }

      let processed = 0;
      if (Array.isArray(payload?.logins)) {
        for (const rec of payload.logins) {
          try {
            const ok = await upsertAndClockIn(rec);
            if (ok) processed += 1;
          } catch (e) {
            console.error("Bulk item failed:", e);
          }
        }
      } else {
        try {
          const ok = await upsertAndClockIn(payload);
          if (ok) processed = 1;
        } catch (e) {
          return new Response(`Error: ${(e as Error).message}`, { status: 500 });
        }
      }

      return new Response(JSON.stringify({ ok: true, processed }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  } catch (error: any) {
    console.error("OAuth error:", error);
    return new Response(`Error: ${error.message || "unknown"}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});


