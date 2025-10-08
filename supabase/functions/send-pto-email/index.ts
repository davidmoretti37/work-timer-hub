// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import nodemailer from "npm:nodemailer@6.9.7"

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // Get Outlook credentials from environment
    const emailUser = Deno.env.get('OUTLOOK_EMAIL_USER')
    const emailPassword = Deno.env.get('OUTLOOK_EMAIL_PASSWORD')
    
    if (!emailUser || !emailPassword) {
      throw new Error('OUTLOOK_EMAIL_USER and OUTLOOK_EMAIL_PASSWORD are required')
    }

    // Parse the request body
    const { ptoData } = await req.json().catch(() => ({ ptoData: null as any }))

    // Validate required fields
    if (!ptoData) {
      throw new Error('ptoData is required')
    }

    if (!ptoData.approval_token) {
      throw new Error('approval_token is missing from ptoData')
    }

    console.log('Processing PTO request with token:', ptoData.approval_token)

    // Create email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          New PTO Request Submitted
        </h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #007bff; margin-top: 0;">Employee Information</h3>
          <p><strong>Name:</strong> ${ptoData.employee_name}</p>
          <p><strong>Confirmation Email:</strong> ${ptoData.confirmation_email}</p>
        </div>

        <div style="background: #fff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #007bff; margin-top: 0;">Request Details</h3>
          <p><strong>Type:</strong> ${ptoData.request_type}</p>
          <p><strong>Start Date:</strong> ${new Date(ptoData.start_date).toLocaleDateString()}</p>
          <p><strong>End Date:</strong> ${new Date(ptoData.end_date).toLocaleDateString()}</p>
          <p><strong>Reason:</strong> ${ptoData.reason_type}</p>
          ${ptoData.custom_reason ? `<p><strong>Additional Details:</strong> ${ptoData.custom_reason}</p>` : ''}
        </div>

        <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #007bff; margin-top: 0;">Employee Signature</h3>
          ${ptoData.employee_signature ? 
            `<p style="color: #28a745; font-weight: bold;">✅ Employee has digitally signed this request</p>` 
            : '<p style="color: #6c757d;">No signature provided</p>'
          }
        </div>

        <div style="background: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Submitted:</strong> ${new Date(ptoData.submission_date).toLocaleString()}</p>
          <p style="margin: 0; color: #6c757d;">Please log into your admin panel to approve or reject this request.</p>
        </div>

        <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #007bff, #0056b3); color: white; border-radius: 8px; text-align: center;">
          <h3 style="margin: 0 0 15px 0;">Action Required</h3>
          <p style="margin: 0 0 20px 0;">Click a button below to approve or reject this PTO request</p>
          
          <div style="margin-top: 20px;">
            <a href="http://localhost:8080/approve-pto?action=approve&token=${ptoData.approval_token}&plain=1" 
               style="display: inline-block; margin: 0 10px; padding: 12px 25px; background: #28a745; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              ✅ APPROVE
            </a>
            
            <a href="http://localhost:8080/approve-pto?action=reject&token=${ptoData.approval_token}&plain=1" 
               style="display: inline-block; margin: 0 10px; padding: 12px 25px; background: #dc3545; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              ❌ REJECT
            </a>
          </div>
        </div>
      </div>
    `

    // Configure nodemailer transporter for Outlook
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // Use STARTTLS
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    })

    // Send email using Outlook SMTP
    const info = await transporter.sendMail({
      from: emailUser,
      to: "accounting@baycoaviation.com",
      subject: `PTO Request - ${ptoData.employee_name}`,
      html: emailHtml,
    })

    console.log('Email sent successfully to accounting@baycoaviation.com')
    console.log('Message ID:', info.messageId)

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error: unknown) {
    const err = error as any
    try {
      console.error('Function error:', err?.message || err)
      if (err) console.error('Error details:', JSON.stringify(err, null, 2))
    } catch (_) {
      // ignore JSON stringify issues
    }
    
    return new Response(
      JSON.stringify({ 
        error: (err?.message as string) || 'Failed to send email',
        details: String(err),
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
