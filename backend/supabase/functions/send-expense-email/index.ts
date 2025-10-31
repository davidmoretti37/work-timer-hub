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
    const { expenseData } = await req.json()

    // Validate required fields
    if (!expenseData) {
      throw new Error('expenseData is required')
    }

    console.log('Processing expense reimbursement request')

    // Create email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          New Expense Reimbursement Request
        </h2>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #007bff; margin-top: 0;">Employee Information</h3>
          <p><strong>Name:</strong> ${expenseData.employee_name}</p>
          <p><strong>Confirmation Email:</strong> ${expenseData.confirmation_email}</p>
          ${expenseData.department ? `<p><strong>Department:</strong> ${expenseData.department}</p>` : ''}
          ${expenseData.supervisor_name ? `<p><strong>Supervisor:</strong> ${expenseData.supervisor_name}</p>` : ''}
        </div>

        <div style="background: #fff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #007bff; margin-top: 0;">Reimbursement Summary</h3>
          <p><strong>Total Amount (USD):</strong> $${parseFloat(expenseData.total_amount_usd || 0).toFixed(2)}</p>
          <p><strong>Payment Method:</strong> ${expenseData.payment_method === 'payroll' ? 'Payroll' : 'Bank Transfer'}</p>
          <p><strong>Number of Expenses:</strong> ${expenseData.expense_items?.length || 0}</p>
        </div>

        ${expenseData.expense_items && expenseData.expense_items.length > 0 ? `
          <div style="background: #fff; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #007bff; margin-top: 0;">Expense Items</h3>
            ${expenseData.expense_items.map((item: any, index: number) => `
              <div style="background: #f8f9fa; padding: 15px; margin-bottom: 15px; border-radius: 6px;">
                <p style="margin: 5px 0;"><strong>Item ${index + 1}</strong></p>
                <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(item.expense_date).toLocaleDateString()}</p>
                <p style="margin: 5px 0;"><strong>Vendor:</strong> ${item.vendor_name}</p>
                <p style="margin: 5px 0;"><strong>Description:</strong> ${item.description}</p>
                ${item.category ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${item.category}</p>` : ''}
                <p style="margin: 5px 0;"><strong>Amount:</strong> ${item.currency} ${parseFloat(item.amount).toFixed(2)} (USD $${parseFloat(item.amount_usd).toFixed(2)})</p>
                ${item.notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${item.notes}</p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #007bff; margin-top: 0;">Employee Signature</h3>
          ${expenseData.employee_signature ?
            `<p style="color: #28a745; font-weight: bold;">✅ Employee has digitally signed this request</p>
             <p style="margin: 0; font-size: 12px; color: #6c757d;">Employee certified: ${expenseData.employee_certified ? 'Yes' : 'No'}</p>`
            : '<p style="color: #6c757d;">No signature provided</p>'
          }
        </div>

        <div style="background: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Submitted:</strong> ${new Date(expenseData.submission_date).toLocaleString()}</p>
          <p style="margin: 0; color: #6c757d;">Please log into your admin panel to review and process this reimbursement request.</p>
        </div>
      </div>
    `

    // Send to accounting@baycoaviation.com
    const { data, error } = await resend.emails.send({
      from: 'Expense Reimbursement System <onboarding@resend.dev>',
      to: ['accounting@baycoaviation.com'],
      subject: `Expense Reimbursement Request - ${expenseData.employee_name} - $${parseFloat(expenseData.total_amount_usd || 0).toFixed(2)}`,
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
