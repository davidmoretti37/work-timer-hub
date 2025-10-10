// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

function buildCorsHeaders(originHeader: string | null, requestedHeaders?: string | null): Record<string, string> {
  const origin = originHeader && originHeader !== "null" ? originHeader : "*";
  const allowHeaders = requestedHeaders && requestedHeaders.length > 0
    ? requestedHeaders
    : "authorization, x-client-info, apikey, content-type";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(
    req.headers.get("origin"),
    req.headers.get("access-control-request-headers"),
  );

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const reqId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const startedAt = Date.now();
    const { email, redirectTo } = await req.json().catch(() => ({ email: "", redirectTo: "" }));
    console.log("[send-signup-confirmation] Request", { reqId, email, redirectTo, origin: req.headers.get("origin") });
    if (!email || typeof email !== "string") {
      console.warn("[send-signup-confirmation] Missing email", { reqId });
      return new Response(JSON.stringify({ error: "email is required", reqId }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("[send-signup-confirmation] Missing server configuration", { reqId, hasUrl: !!SUPABASE_URL, hasKey: !!SERVICE_ROLE_KEY });
      return new Response(JSON.stringify({ error: "Missing server configuration", reqId }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ENV_REDIRECT = Deno.env.get("CONFIRM_REDIRECT_URL");
    const finalRedirect = ENV_REDIRECT || (redirectTo || "");

    // ONLY use signup confirmation links (email confirmation with button), NO magic links
    let actionLink = "";
    let lastError: any = null;
    const linkKind: "signup" = "signup";

    // Try signup with redirect first
    if (finalRedirect) {
      const { data, error } = await admin.auth.admin.generateLink({ 
        type: "signup", 
        email, 
        options: { emailRedirectTo: finalRedirect } 
      });
      
      if (!error && data?.properties?.action_link) {
        actionLink = data.properties.action_link;
        console.log("[send-signup-confirmation] Generated signup link (with redirect)", { reqId });
      } else if (!error && data?.action_link) {
        actionLink = data.action_link;
        console.log("[send-signup-confirmation] Generated signup link (with redirect, legacy format)", { reqId });
      } else {
        lastError = error || new Error("No action_link from signup with redirect");
        console.warn("[send-signup-confirmation] Signup with redirect failed", { 
          reqId, 
          error: error?.message,
          errorDetails: JSON.stringify(error),
          dataReceived: JSON.stringify(data)
        });
      }
    }

    // If that failed, try without redirect
    if (!actionLink) {
      const { data, error } = await admin.auth.admin.generateLink({ 
        type: "signup", 
        email 
      });
      
      if (!error && data?.properties?.action_link) {
        actionLink = data.properties.action_link;
        console.log("[send-signup-confirmation] Generated signup link (no redirect)", { reqId });
      } else if (!error && data?.action_link) {
        actionLink = data.action_link;
        console.log("[send-signup-confirmation] Generated signup link (no redirect, legacy format)", { reqId });
      } else {
        lastError = error || lastError || new Error("No action_link from signup without redirect");
        console.warn("[send-signup-confirmation] Signup without redirect failed", { 
          reqId, 
          error: error?.message,
          errorDetails: JSON.stringify(error),
          dataReceived: JSON.stringify(data)
        });
      }
    }

    if (!actionLink) {
      const debug = {
        reqId,
        finalRedirect,
        supabaseUrl: Deno.env.get("SUPABASE_URL"),
        reason: lastError?.message || "No action link returned",
        hint: "Ensure Auth Site URL and Additional Redirect URLs are configured; magic link must be enabled.",
      };
      console.error("[send-signup-confirmation] No action link returned", debug);
      return new Response(JSON.stringify({ error: "No action link returned", ...debug }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      // If no email provider configured, return the link so the client can handle
      console.log("[send-signup-confirmation] RESEND not configured; returning actionLink", { reqId });
      return new Response(JSON.stringify({ actionLink, reqId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resend = new Resend(RESEND_API_KEY);
    const subject = "Confirm your account";
    const cta = "Confirm Email";
    const intro = "Click the button below to confirm your email and activate your account.";
    const sendRes = await resend.emails.send({
      from: "PTO System <onboarding@resend.dev>",
      to: [email],
      subject,
      html: `
        <div>
          <p>${intro}</p>
          <p><a href="${actionLink}" style="display:inline-block;padding:10px 16px;background:#1f2937;color:#fff;border-radius:8px;text-decoration:none">${cta}</a></p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p><a href="${actionLink}">${actionLink}</a></p>
        </div>
      `,
    });
    console.log("[send-signup-confirmation] Email sent via Resend", { reqId, id: (sendRes as any)?.id, statusCode: (sendRes as any)?.statusCode });

    const durationMs = Date.now() - startedAt;
    return new Response(JSON.stringify({ ok: true, reqId, durationMs }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[send-signup-confirmation] Uncaught error", { error: e?.message, stack: e?.stack });
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
