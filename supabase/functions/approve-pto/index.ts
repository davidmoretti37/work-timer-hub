import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const { token, action, ownerName, employerSignature, adminNotes } = await req.json();

    if (!token || !action || !ownerName) {
      return new Response(JSON.stringify({ message: "Missing required fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Check expiry
    if (new Date(request.token_expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ message: "Token expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // If approved, create calendar events for each day of the PTO
    if (action === "approve") {
      console.log("Creating calendar events for approved PTO...");
      
      const startDate = new Date(request.start_date);
      const endDate = new Date(request.end_date);
      const calendarEvents = [];

      // Generate events for each day in the date range
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        calendarEvents.push({
          user_id: request.user_id,
          event_date: date.toISOString().split('T')[0], // Format as YYYY-MM-DD
          title: `PTO: ${request.reason_type}`,
          notes: request.custom_reason || `Approved by ${ownerName}`,
        });
      }

      if (calendarEvents.length > 0) {
        const { error: calendarError } = await supabaseAdmin
          .from("calendar_events")
          .insert(calendarEvents);

        if (calendarError) {
          console.error("Failed to create calendar events:", calendarError);
          // Don't fail the approval if calendar creation fails
        } else {
          console.log(`✅ Created ${calendarEvents.length} calendar events`);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "PTO updated", pto: updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("approve-pto error:", error);
    return new Response(
      JSON.stringify({ message: "Failed to process approval", error: String(error?.message || error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
