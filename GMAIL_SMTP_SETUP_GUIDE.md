# Gmail SMTP Setup - Step by Step

## Step 1: Generate Gmail App Password

1. **Go to Google Account Settings:**
   - Visit: https://myaccount.google.com/apppasswords
   - Sign in with fbayma@baycoaviation.com

2. **Enable 2-Factor Authentication (if not enabled):**
   - If you see "2-Step Verification is not enabled", you need to enable it first
   - Go to: https://myaccount.google.com/security
   - Click "2-Step Verification" and follow the setup

3. **Create App Password:**
   - Once 2FA is enabled, go back to: https://myaccount.google.com/apppasswords
   - Click "Select app" → Choose "Mail"
   - Click "Select device" → Choose "Other (Custom name)"
   - Enter name: "PTO System"
   - Click "Generate"
   - **COPY THE 16-CHARACTER PASSWORD** (looks like: xxxx xxxx xxxx xxxx)
   - You'll need this in the next step!

## Step 2: Add Password to Supabase Secrets

Run this command in your terminal (replace YOUR_APP_PASSWORD with the password from Step 1):

```bash
supabase secrets set GMAIL_APP_PASSWORD="your 16-character password here" --project-ref mkisayjvfcthkppiatmr
```

Example:
```bash
supabase secrets set GMAIL_APP_PASSWORD="abcd efgh ijkl mnop" --project-ref mkisayjvfcthkppiatmr
```

## Step 3: Wait for Me to Update the Code

I'll update the Edge Function to use Gmail SMTP with Nodemailer.

## Step 4: Test

Submit a PTO request and check if the email arrives at fbayma@baycoaviation.com!

---

## Troubleshooting

**"2-Step Verification is not enabled":**
- Enable 2FA first at: https://myaccount.google.com/security

**"App passwords" option not available:**
- Make sure you're signed in with fbayma@baycoaviation.com
- Ensure 2FA is enabled
- Try using this direct link: https://security.google.com/settings/security/apppasswords

**Password doesn't work:**
- Remove spaces from the 16-character password
- Make sure you copied the entire password
- Generate a new one if needed

---

Ready? Let's start with Step 1!
