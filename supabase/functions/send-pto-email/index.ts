import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from 'npm:resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is required')
    }

    const resend = new Resend(resendApiKey)

    // Parse the request body
    const { ptoData } = await req.json()

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

    // TEMPORARY: Send to davidmoretti37@gmail.com for testing
    // Forward these emails to accounting@baycoaviation.com manually
    const { data, error } = await resend.emails.send({
      from: 'PTO System <onboarding@resend.dev>',
      to: ['davidmoretti37@gmail.com'],
      subject: `PTO Request - ${ptoData.employee_name} (Forward to Accounting)`,
      html: emailHtml,
    })

    if (error) {
      console.error('Resend error:', error)
      throw error
    }

    console.log('Email sent successfully to accounting@baycoaviation.com:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Function error:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send email',
        details: String(error),
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
