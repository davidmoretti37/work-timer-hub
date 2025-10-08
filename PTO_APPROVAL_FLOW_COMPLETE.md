# PTO Approval Flow - Complete Implementation

## Overview
The PTO (Paid Time Off) approval system now works end-to-end without requiring admin login. The owner receives an email with approval/rejection buttons and can process requests directly through token-based links.

## Complete Flow

### 1. Employee Submits PTO Request
**File: `src/pages/PTO.tsx`**

Employee fills out and submits PTO form:
- Employee name, email, dates, reason, signature
- Data saved to `pto_requests` table
- Auto-generates `approval_token` (UUID) with 14-day expiration
- Triggers email to owner via Edge Function

### 2. Email Sent to Owner
**File: `supabase/functions/send-pto-email/index.ts`**

Automatic email sent via Resend API to fbayma@baycoaviation.com:
- Contains all PTO request details
- Two action buttons:
  - ✅ APPROVE button → Links to `/approve-pto?action=approve&token={UUID}&plain=1`
  - ❌ REJECT button → Links to `/approve-pto?action=reject&token={UUID}&plain=1`
- `plain=1` parameter hides the navbar for a clean approval interface

### 3. Owner Clicks Approve/Reject Button
**File: `src/pages/ApprovePTO.tsx`**

**No login required!** The page works purely with the token:
- Token is extracted from URL query parameters
- Page fetches PTO request details using token
- Displays employee information, request details, and employee signature
- Owner fills out:
  - Their name
  - Optional notes
  - Signature (required for approval only)
- Clicking the approve/reject button triggers Edge Function

### 4. Approval Processed
**File: `supabase/functions/approve-pto/index.ts`**

Edge Function processes the approval:
1. **Validates token:**
   - Checks if token exists and is valid
   - Verifies token not expired (14-day limit)
   - Ensures token not already used
   - Confirms PTO request is still pending

2. **Updates PTO request:**
   - Sets status to "approved" or "rejected"
   - Records employer decision date
   - Saves employer signature (if provided)
   - Saves employer name and notes
   - Marks token as used (one-time use)

3. **Creates calendar events (if approved):**
   - Generates calendar event for each day in the date range
   - Event title: `PTO: {reason_type}`
   - Event notes: Custom reason or approval info
   - Events automatically appear on employee's calendar

4. **Sends confirmation email to employee:**
   - Email sent to employee's confirmation email address
   - Contains approval/rejection decision
   - Includes owner's name and any notes

### 5. Calendar Updated
**Table: `calendar_events`**

When PTO is approved, calendar events are automatically created:
- One event per day in the PTO date range
- Linked to the employee's user_id
- Visible on the employee's calendar view
- Shows as `PTO: {reason}` with notes

## Key Features

### Token-Based Authentication
✅ **No login required for approval**
- Owner can approve from any device with the email link
- Token expires after 14 days for security
- One-time use prevents duplicate approvals
- Validates against database before processing

### Automatic Calendar Integration
✅ **Seamless calendar updates**
- Approved PTO automatically appears on employee's calendar
- Multi-day PTO creates events for each day
- No manual entry needed

### Email Notifications
✅ **Complete email flow**
- Initial notification to owner with PTO details
- Confirmation email to employee after decision
- Both use Resend API for reliable delivery

### Clean Approval Interface
✅ **Professional approval page**
- `plain=1` parameter hides navbar for focused approval
- Shows all PTO details clearly
- Validates required fields (signature for approval)
- Clear success/error messages

## Database Tables

### `pto_requests`
Stores all PTO requests with approval workflow data:
- `approval_token`: UUID for email link authentication
- `token_expires_at`: Expiration timestamp (14 days)
- `token_used`: Boolean to prevent reuse
- `status`: pending → approved/rejected
- `employer_signature`, `employer_name`, `admin_notes`: Approval data

### `calendar_events`
Stores calendar entries for approved PTO:
- `user_id`: Employee who owns the event
- `event_date`: Date of the PTO day
- `title`: Display text (e.g., "PTO: vacation")
- `notes`: Additional details

## Files Modified

1. **src/pages/PTO.tsx**
   - Fixed approval_token retrieval
   - Fixed profile field references
   - Added validation for created PTO request

2. **src/pages/ApprovePTO.tsx**
   - Fixed useEffect dependencies (removed requestId bug)
   - Already had token-based approval (no auth needed)

3. **supabase/functions/send-pto-email/index.ts**
   - Added validation for approval_token
   - Fixed 400 error from malformed URLs

4. **supabase/functions/approve-pto/index.ts**
   - Added automatic calendar event creation on approval
   - Creates one event per day in date range

5. **src/integrations/supabase/types.ts**
   - Added `pto_requests` table definition
   - Added `calendar_events` table definition

## Testing the Complete Flow

1. **Submit PTO Request:**
   - Fill out form as employee
   - Check console: `PTO request created with token: {uuid}`
   - Email automatically sent to fbayma@baycoaviation.com

2. **Receive Email:**
   - Owner receives email with PTO details
   - Two buttons: ✅ APPROVE and ❌ REJECT

3. **Click Approve/Reject:**
   - Opens clean approval page (no login needed)
   - Shows all PTO details
   - Owner enters name, optional notes, signature (if approving)
   - Click final approve/reject button

4. **Verify Results:**
   - PTO request status updated in database
   - Employee receives confirmation email
   - If approved: Events appear on employee's calendar
   - Token marked as used (cannot be reused)

## Security Considerations

✅ **Token expires after 14 days**
✅ **One-time use only**
✅ **Must be unused and pending status**
✅ **Validated against database before processing**
✅ **Uses Supabase service role key for database operations**

## Benefits of This Implementation

1. **No login friction** - Owner can approve instantly from email
2. **Automatic calendar sync** - No manual entry needed
3. **Complete audit trail** - All approvals tracked with signatures
4. **Email confirmations** - Everyone stays informed
5. **Secure** - Token-based with expiration and one-time use
6. **Professional** - Clean interface for approvals
