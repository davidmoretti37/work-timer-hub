# Fix for Sign-Up 400 Error

## Problem
The `send-signup-confirmation` edge function is returning a 400 error when trying to sign up new users. The error message indicates: "No action link returned" from Supabase's auth API.

## Root Cause
The Supabase Auth configuration is missing required settings for generating confirmation links. Specifically:
1. Site URL may not be configured
2. Redirect URLs may not be whitelisted
3. Email confirmation may not be enabled
4. Magic links may be disabled

## Step-by-Step Fix

### 1. Configure Supabase Auth Site URL

Go to: https://supabase.com/dashboard/project/mkisayjvfcthkppiatmr/auth/url-configuration

**Set these values:**

#### Site URL
For local development, set to:
```
http://localhost:5173
```

**For Vercel production:** You can change this to your Vercel URL later, OR leave it as localhost and rely on the Additional Redirect URLs below (recommended approach).

#### Additional Redirect URLs
Add **BOTH** local and production URLs (one per line):

```
http://localhost:5173/auth
http://localhost:5173/auth?confirmed=1
http://localhost:5173/**
http://localhost:5174/**
https://your-vercel-app.vercel.app/auth
https://your-vercel-app.vercel.app/auth?confirmed=1
https://your-vercel-app.vercel.app/**
https://your-custom-domain.com/auth
https://your-custom-domain.com/auth?confirmed=1
https://your-custom-domain.com/**
```

**Important:** Replace `your-vercel-app.vercel.app` with your actual Vercel deployment URL. Find it in your Vercel dashboard or deployment logs.

**This configuration works for BOTH local development AND Vercel production simultaneously** - no need to change settings when deploying!

**Click "Save" at the bottom.**

---

### 2. Enable Email Confirmation

Go to: https://supabase.com/dashboard/project/mkisayjvfcthkppiatmr/auth/providers

Click on **"Email"** provider and configure:

✅ **REQUIRED SETTINGS:**
- [x] **Enable Email provider** - Must be checked
- [x] **Confirm email** - Must be ENABLED (critical!)
- [x] **Enable Magic Link** - Must be ENABLED

❌ **DISABLE THESE:**
- [ ] **Auto Confirm** - Must be OFF (if this setting exists)
- [ ] **Double Confirm email change** - Can be disabled

**Click "Save" at the bottom.**

---

### 3. Verify Edge Function is Deployed

Check if the function is deployed:

```bash
npx supabase functions list
```

If `send-signup-confirmation` is not listed, deploy it:

```bash
npx supabase functions deploy send-signup-confirmation
```

---

### 4. Set Environment Variables in Supabase

If you have a Resend API key (for sending emails), set it:

```bash
npx supabase secrets set RESEND_API_KEY=your_resend_api_key_here
```

If you have a specific redirect URL, set it:

```bash
npx supabase secrets set CONFIRM_REDIRECT_URL=http://localhost:5173/auth?confirmed=1
```

To check what secrets are set:

```bash
npx supabase secrets list
```

---

### 5. Clear Browser Cache and Test

1. **Clear your browser cache and cookies**
2. **Delete any test users** from: https://supabase.com/dashboard/project/mkisayjvfcthkppiatmr/auth/users
3. **Try signing up with a new email**

---

## Testing the Fix

### Expected Flow:

1. **Sign Up** → Should show "We sent a confirmation link to your email"
2. **Check email** → Should receive confirmation email
3. **Click link** → Should redirect to app and auto-login
4. **Dashboard** → Should load successfully

### If Still Getting 400 Error:

Check the Supabase function logs:

```bash
npx supabase functions logs send-signup-confirmation --tail
```

Or view in dashboard:
https://supabase.com/dashboard/project/mkisayjvfcthkppiatmr/logs/functions

Look for the error message that includes:
- `reqId`: Request ID for debugging
- `reason`: Why the action link couldn't be generated
- `hint`: Suggestions for fixing

---

## Quick Fix Checklist

Use this checklist to verify everything is configured:

- [ ] Site URL is set in Supabase Auth settings
- [ ] Redirect URLs are whitelisted in Supabase Auth settings
- [ ] "Enable Email provider" is checked
- [ ] "Confirm email" is ENABLED
- [ ] "Enable Magic Link" is ENABLED
- [ ] Edge function `send-signup-confirmation` is deployed
- [ ] Browser cache is cleared
- [ ] Test users are deleted

---

## Common Issues

### "Email already registered"
- This is normal if you already tried signing up
- Delete the user from Supabase dashboard
- Or use "Sign In" instead

### Emails Not Received
- If RESEND_API_KEY is not set, the function returns the confirmation link
- The app will try to redirect to it automatically
- Check spam folder
- Set up Resend API key for reliable email delivery

### Still Getting 400 After All Steps
1. Check Supabase service status: https://status.supabase.com/
2. Verify your Supabase project is active
3. Check if you have any custom SQL policies blocking the operation
4. Contact Supabase support if issue persists

---

## Vercel Deployment - Yes, This Works!

### How It Works for Both Local and Vercel

The configuration above supports **both environments simultaneously** because:

1. **Wildcard URLs** (`/**`) in "Additional Redirect URLs" match any route
2. **Multiple URLs** can be whitelisted at once
3. Supabase checks if the redirect matches **any** allowed URL

### Getting Your Vercel URL

After deploying to Vercel, you'll get a URL like:
- `https://work-timer-hub-1.vercel.app` (auto-generated)
- Or your custom domain: `https://yourdomain.com`

Find it in:
- Vercel Dashboard → Your Project → Domains
- Or in the deployment logs after `npm run build`

### Add Vercel URLs to Supabase

Once you have your Vercel URL, add these to "Additional Redirect URLs" in Supabase (in addition to localhost URLs):

```
https://your-actual-vercel-url.vercel.app/auth
https://your-actual-vercel-url.vercel.app/auth?confirmed=1
https://your-actual-vercel-url.vercel.app/**
```

### No Code Changes Needed!

Your code in `Auth.tsx` automatically uses the correct URL:
```typescript
const SITE_URL = (import.meta as any).env?.VITE_PUBLIC_SITE_URL || window.location.origin;
```

This means:
- **Locally:** Uses `http://localhost:5173`
- **On Vercel:** Uses `https://your-vercel-app.vercel.app`

### Testing on Vercel

1. Deploy to Vercel
2. Add your Vercel URL to Supabase redirect URLs
3. Visit your Vercel URL
4. Try signing up - it should work exactly like local!

### Environment Variables on Vercel

If you're using Resend for emails, add the API key in Vercel:
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `RESEND_API_KEY` = `your_key_here`
3. Redeploy

**Note:** Supabase edge functions use their own secrets (set via `npx supabase secrets set`), not Vercel environment variables.

---

## Next Steps After Fix

Once sign-up works:

1. **Set up Resend** for production email delivery (optional but recommended)
2. **Update Site URL** when deploying to production
3. **Test the complete flow** including email confirmation
4. **Monitor function logs** for any issues

---

## Need More Help?

Check these resources:
- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- Supabase Functions Logs: Dashboard → Functions → Logs
- Browser Console: Look for `[Auth]` prefixed logs
