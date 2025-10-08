# Outlook SMTP Setup - Step by Step

## Overview
Your email (fbayma@baycoaviation.com) is hosted on Microsoft 365/Outlook. This makes SMTP setup straightforward - you can use the regular email password!

## Step 1: Get Your Email Password

You'll need the password for fbayma@baycoaviation.com. This is the same password used to sign in at:
- https://outlook.office.com
- Or the Outlook desktop/mobile app

**Don't have the password?**
- Reset it at: https://passwordreset.microsoftonline.com
- Or contact your Microsoft 365 admin

## Step 2: Add Password to Supabase Secrets

Run this command in your terminal (replace with the actual password):

```bash
supabase secrets set OUTLOOK_EMAIL_PASSWORD="your-email-password-here" --project-ref mkisayjvfcthkppiatmr
```

**Important:** 
- Remove any special characters that might cause issues in command line
- If password has quotes or special chars, escape them or put in single quotes

Example:
```bash
supabase secrets set OUTLOOK_EMAIL_PASSWORD='MyPassword123!' --project-ref mkisayjvfcthkppiatmr
```

## Step 3: I'll Update the Code

Once you've added the password, I'll:
1. Update the Edge Function to use Outlook SMTP
2. Deploy it
3. Test that emails go to fbayma@baycoaviation.com

## Outlook SMTP Settings (for reference)

These are automatically configured in the code:
- **SMTP Server:** smtp.office365.com
- **Port:** 587
- **Security:** STARTTLS
- **Username:** fbayma@baycoaviation.com
- **Password:** (what you set in Step 2)

## Security Note

**Is this secure?**
✅ Yes! The password is stored as a Supabase secret (encrypted)
✅ Only the Edge Function can access it
✅ Not visible in your code or Git repository

**Alternative: Create App-Specific Password (More Secure)**

If the account has 2FA enabled, you may need to create an app password:
1. Go to: https://account.microsoft.com/security
2. Sign in with fbayma@baycoaviation.com
3. Go to "Advanced security options"
4. Click "Add a new way to sign in or verify"
5. Choose "App password"
6. Generate password for "PTO System"
7. Use this password instead in Step 2

---

## Troubleshooting

**"Authentication failed":**
- Double-check the password is correct
- Try creating an app password if 2FA is enabled
- Ensure the account isn't locked

**"SMTP connection failed":**
- Check that fbayma@baycoaviation.com is active
- Verify it's a Microsoft 365 account (not hosted elsewhere)
- Make sure SMTP isn't blocked by IT policies

**"Password contains special characters":**
- Use single quotes: `'password'` instead of double quotes
- Or escape special characters: `\"password\"`

---

Ready to proceed? Run the command in Step 2 and let me know when it's done!
