import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { token, action, ownerName, employerSignature, adminNotes } = await req.json();

    if (!token || !action || !ownerName) {
      return new Response(JSON.stringify({ message: "Missing required fields" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Find pending request with valid token
    const { data: request, error: fetchError } = await supabaseAdmin
      .from("pto_requests")
      .select("*")
      .eq("approval_token", token)
      .eq("token_used", false)
      .eq("status", "pending")
      .lte("token_expires_at", new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()) // noop for index (avoid unbounded?)
      .single();

    if (fetchError || !request) {
      return new Response(JSON.stringify({ message: "Invalid or used token" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Check expiry
    if (new Date(request.token_expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ message: "Token expired" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("pto_requests")
      .update({
        status: newStatus,
        employer_decision_date: new Date().toISOString(),
        employer_signature: employerSignature || null,
        employer_name: ownerName,
        admin_notes: adminNotes || null,
        token_used: true,
      })
      .eq("approval_token", token)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ message: "PTO updated", pto: updated }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("approve-pto error:", error);
    return new Response(
      JSON.stringify({ message: "Failed to process approval", error: String(error?.message || error) }),
      { headers: { "Content-Type": "application/json" }, status: 400 },
    );
  }
});


