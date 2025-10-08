# PTO Email Integration Setup

## Current Status
The PTO system is fully functional with the following features:
- ✅ Digital PTO form with signature and confirmation email field
- ✅ Database storage of PTO requests including confirmation email
- ✅ Calendar integration showing approved PTO
- ✅ Admin approval workflow ready
- ✅ Bidirectional email workflow designed

## Email Integration (To Be Implemented)

### Email Workflow
1. **Employee submits PTO** → Email sent to `fbayma@baycoaviation.com`
2. **Admin approves/rejects** → Confirmation email sent to employee's specified email

### Required Setup
To complete the bidirectional email workflow:

1. **Supabase Edge Function** - Create serverless functions for both email directions
2. **Email Service** - Set up with SendGrid, Resend, or similar
3. **Email Templates** - HTML templates for both admin notifications and employee confirmations

### Implementation Steps

1. Create Supabase Edge Functions:
```bash
supabase functions new send-pto-notification    # Admin notification
supabase functions new send-pto-confirmation    # Employee confirmation
```

2. Admin Notification Function (send-pto-notification):
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { ptoData } = await req.json()
  
  // Send email to fbayma@baycoaviation.com
  // Include PTO form data and approval/rejection buttons
  
  return new Response(JSON.stringify({ success: true }))
})
```

3. Employee Confirmation Function (send-pto-confirmation):
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { ptoData, decision, adminSignature } = await req.json()
  
  // Send confirmation email to ptoData.confirmation_email
  // Include approval/rejection decision and admin signature
  
  return new Response(JSON.stringify({ success: true }))
})
```

4. Update PTO.tsx to call the admin notification:
```typescript
const sendEmailNotification = async (ptoData: any) => {
  const { data, error } = await supabase.functions.invoke('send-pto-notification', {
    body: { ptoData }
  })
}
```

5. Update Admin interface to send confirmation emails:
```typescript
const sendConfirmationEmail = async (ptoData: any, decision: 'approved' | 'rejected') => {
  const { data, error } = await supabase.functions.invoke('send-pto-confirmation', {
    body: { ptoData, decision, adminSignature: '...' }
  })
}
```

### Email Content

#### Admin Notification Email (to fbayma@baycoaviation.com):
- Employee name and confirmation email
- PTO dates, reason, and type (days/hours)
- Employee signature display
- Approve/Reject buttons linking back to the admin interface
- Link to view full PTO request

#### Employee Confirmation Email (to employee's confirmation_email):
- Approval/rejection decision
- Original PTO request details
- Admin signature (if approved)
- Next steps or additional information
- Contact information for questions

### Security Notes
- Email API keys should be stored in Supabase secrets
- Email links should include secure tokens for approval/rejection
- Implement rate limiting for email sending

## Current Workaround
The system currently logs email data to console and saves requests to database. Admin users can approve/reject through the admin panel.
