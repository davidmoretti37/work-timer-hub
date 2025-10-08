# How to Send Emails to Any Address with Resend

## Current Limitation
Resend's free tier only allows sending emails to the account owner's email (davidmoretti37@gmail.com). To send to other emails like fbayma@baycoaviation.com, you need to verify a domain.

## Step-by-Step Setup

### 1. Verify Your Domain in Resend

1. **Go to Resend Dashboard**
   - Visit: https://resend.com/domains
   - Sign in with the account that has the API key

2. **Add Your Domain**
   - Click "Add Domain"
   - Enter your domain: `baycoaviation.com`
   - Click "Add"

3. **Configure DNS Records**
   Resend will provide DNS records to add. You need to add these to your domain's DNS settings:
   
   **SPF Record (TXT):**
   ```
   Name: @ (or baycoaviation.com)
   Type: TXT
   Value: v=spf1 include:resend.com ~all
   ```

   **DKIM Records (TXT):**
   Resend will provide specific DKIM records like:
   ```
   Name: resend._domainkey.baycoaviation.com
   Type: TXT
   Value: [provided by Resend]
   ```

   **Where to add DNS records:**
   - If using **GoDaddy**: DNS Management → Add TXT records
   - If using **Cloudflare**: DNS → Add records
   - If using **AWS Route53**: Hosted zones → Create records
   - Contact your domain registrar if unsure

4. **Verify Domain**
   - After adding DNS records (may take 24-48 hours to propagate)
   - Click "Verify" in Resend dashboard
   - Once verified, you'll see a green checkmark ✅

### 2. Update Edge Function Code

Once your domain is verified, update the send-pto-email function:

**File: `supabase/functions/send-pto-email/index.ts`**

Change this section:
```typescript
// CURRENT (Testing only)
const { data, error } = await resend.emails.send({
  from: 'PTO System <onboarding@resend.dev>',
  to: ['davidmoretti37@gmail.com'],
  subject: `PTO Request - ${ptoData.employee_name}`,
  html: emailHtml,
})
```

To:
```typescript
// PRODUCTION (After domain verification)
const { data, error } = await resend.emails.send({
  from: 'PTO System <pto@baycoaviation.com>', // Use your verified domain
  to: ['fbayma@baycoaviation.com'],
  subject: `PTO Request - ${ptoData.employee_name}`,
  html: emailHtml,
})
```

### 3. Deploy Updated Function

```bash
supabase functions deploy send-pto-email --project-ref mkisayjvfcthkppiatmr
```

### 4. Test

Submit a PTO request and verify that:
- Email is sent to fbayma@baycoaviation.com
- Email contains approve/reject buttons
- Buttons link to the correct approval page

## Alternative: Use Gmail SMTP

If you don't want to verify a domain, you can use Gmail SMTP instead:

### Option A: Gmail App Password

1. **Enable 2-Factor Authentication** on the Gmail account
2. **Generate App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Generate password for "Mail"
   - Copy the 16-character password

3. **Update Edge Function to use Nodemailer:**

```typescript
import nodemailer from 'npm:nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'fbayma@baycoaviation.com',
    pass: 'your-app-password-here' // Store in Supabase secrets
  }
})

await transporter.sendMail({
  from: 'fbayma@baycoaviation.com',
  to: 'fbayma@baycoaviation.com',
  subject: `PTO Request - ${ptoData.employee_name}`,
  html: emailHtml,
})
```

## Recommended Approach

**For Production: Verify Domain with Resend**
- More professional
- Better deliverability
- No daily sending limits
- Can send to multiple recipients

**For Quick Testing: Keep using davidmoretti37@gmail.com**
- Works immediately
- Good for testing the flow
- Owner can forward emails manually

## Quick Fix for Now

If you want to temporarily send to fbayma@baycoaviation.com for testing, you can:
1. Update Resend account email to fbayma@baycoaviation.com
2. Or verify baycoaviation.com domain (recommended)
3. Or use Gmail SMTP

Choose the option that works best for your needs!
