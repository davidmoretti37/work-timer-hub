import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const { ptoData, action, ownerName, adminNotes } = await req.json()

    const isApproved = action === 'approved'
    const statusText = isApproved ? 'APPROVED' : 'REJECTED'
    const statusColor = isApproved ? '#28a745' : '#dc3545'
    const statusIcon = isApproved ? '✅' : '❌'
    const statusMessage = isApproved 
      ? 'Your PTO request has been approved! The time off has been added to your calendar.'
      : 'Your PTO request has been rejected. Please contact your manager for more information.'

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${statusColor}; padding: 20px; text-align: center; color: white;">
          <h2 style="margin: 0;">${statusIcon} PTO Request ${statusText}</h2>
        </div>
        
        <div style="padding: 30px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid ${statusColor}; margin-bottom: 20px;">
            <p style="font-size: 18px; margin: 0; font-weight: bold;">${statusMessage}</p>
          </div>

          <h3 style="color: #007bff; border-bottom: 1px solid #eee; padding-bottom: 5px;">Your Request Details</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>Employee:</strong> ${ptoData.employee_name}</p>
            <p><strong>Request Type:</strong> <span style="text-transform: capitalize;">${ptoData.request_type}</span></p>
            <p><strong>Start Date:</strong> ${new Date(ptoData.start_date).toLocaleDateString()}</p>
            <p><strong>End Date:</strong> ${new Date(ptoData.end_date).toLocaleDateString()}</p>
            <p><strong>Reason:</strong> <span style="text-transform: capitalize;">${ptoData.reason_type}</span></p>
            ${ptoData.custom_reason ? `<p><strong>Additional Details:</strong> ${ptoData.custom_reason}</p>` : ''}
          </div>

          <h3 style="color: #007bff; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 25px;">Decision Details</h3>
          <div style="background: #e9ecef; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>Reviewed by:</strong> ${ownerName}</p>
            <p><strong>Decision Date:</strong> ${new Date().toLocaleString()}</p>
            ${adminNotes ? `<p><strong>Manager Notes:</strong> ${adminNotes}</p>` : ''}
          </div>

          ${isApproved ? `
            <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-top: 25px;">
              <h3 style="margin: 0 0 10px 0;">🎉 Your Time Off is Confirmed!</h3>
              <p style="margin: 0;">Enjoy your ${ptoData.reason_type}! Your time off has been added to the company calendar.</p>
            </div>
          ` : `
            <div style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-top: 25px;">
              <h3 style="margin: 0 0 10px 0;">Request Not Approved</h3>
              <p style="margin: 0;">Please speak with your manager if you have questions about this decision.</p>
            </div>
          `}
        </div>

        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 0.8em; color: #666; border-top: 1px solid #ddd;">
          <p style="margin: 0;">This is an automated notification from your PTO System.</p>
          <p style="margin: 0;">Questions? Contact your manager or HR department.</p>
        </div>
      </div>
    `

    // Send confirmation email to employee
    const { data, error } = await resend.emails.send({
      from: 'PTO System <onboarding@resend.dev>',
      to: [ptoData.confirmation_email],
      subject: `${statusIcon} PTO Request ${statusText} - ${ptoData.employee_name}`,
      html: emailHtml,
    })

    if (error) {
      console.error('Resend error:', error)
      throw error
    }

    return new Response(JSON.stringify({ 
      message: `Confirmation email sent successfully to ${ptoData.confirmation_email}`, 
      data,
      status: statusText.toLowerCase()
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Confirmation email error:', error)
    return new Response(JSON.stringify({ 
      message: 'Failed to send confirmation email', 
      error: error.message 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})