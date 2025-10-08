# Email Confirmation Setup Guide

## Issues Identified

Your email confirmation isn't working because:
1. Missing Resend API key for sending emails
2. Supabase Auth settings may not be configured properly
3. The confirmation function might not be deployed

## Step-by-Step Fix

### 1. Get a Resend API Key (Free)

1. Go to https://resend.com/signup
2. Create a free account
3. Verify your email
4. Go to API Keys section
5. Create a new API key
6. Copy the key (it will look like: `re_123abc...`)

### 2. Configure Local Environment

Add to your `.env` file:
```env
# Add this line:
RESEND_API_KEY=your_resend_api_key_here
```

### 3. Configure Supabase Dashboard

1. Go to your Supabase project: https://supabase.com/dashboard/project/mkisayjvfcthkppiatmr
2. Navigate to **Authentication** → **URL Configuration**
3. Set these values:
   - **Site URL**: `http://localhost:5173` (for development)
   - **Redirect URLs**: Add:
     - `http://localhost:5173/auth`
     - `http://localhost:5173/auth?confirmed=1`
     - `http://localhost:5173/**` (wildcard for all routes)

4. Navigate to **Authentication** → **Email Templates**
   - Ensure "Confirm signup" is enabled
   - The email template should use the `{{ .ConfirmationURL }}` variable

5. Navigate to **Authentication** → **Providers** → **Email**
   - Ensure "Enable Email provider" is checked
   - **CRITICAL**: Enable "Confirm email" (this prevents auto-login without confirmation)
   - **CRITICAL**: Disable "Auto Confirm" (if this setting exists, ensure it's OFF)

### 4. Deploy the Confirmation Function to Supabase

You need to deploy your edge function:

```bash
# Link your project (if not already linked)
npx supabase link --project-ref mkisayjvfcthkppiatmr

# Set the Resend secret in Supabase
npx supabase secrets set RESEND_API_KEY=your_resend_api_key_here

# Deploy the function
npx supabase functions deploy send-signup-confirmation
```

### 5. Update Site URL for Production

When deploying to production:
1. Update `.env` with your production URL:
   ```env
   VITE_PUBLIC_SITE_URL=https://your-production-domain.com
   ```
2. Update Supabase dashboard Site URL to match
3. Add production redirect URLs to Supabase dashboard

## Testing the Flow

After setup:

1. **Sign Up**: Enter email and password
   - You should see: "We sent a confirmation link to your email"
   - Check your email inbox (and spam folder)

2. **Click Confirmation Link**: 
   - Should redirect to `/auth?confirmed=1`
   - Should show: "Email confirmed! You can sign in now."
   - Should automatically log you in

3. **Resend Confirmation**: 
   - If you don't receive email, click "Resend confirmation email"

4. **Sign In After Confirmation**: 
   - Use the same email/password
   - Should log in successfully

## Troubleshooting

### Emails Not Sending
- Check Supabase logs: Dashboard → Edge Functions → Logs
- Verify RESEND_API_KEY is set in Supabase secrets
- Check Resend dashboard for delivery status

### Users Auto-Login Without Confirming Email
- Go to Supabase Dashboard → Authentication → Providers → Email
- Ensure "Confirm email" is ENABLED
- Ensure "Auto Confirm" is DISABLED (if the setting exists)
- If you changed this setting, existing unconfirmed users may need to be deleted and re-registered

### Confirmation Not Working
- Verify redirect URLs in Supabase dashboard
- Check browser console for errors
- Ensure Site URL matches your domain
- Ensure "Confirm email" is enabled in Auth settings

### "Email already registered" Error
- This is normal for existing accounts
- Click "Resend confirmation email" button
- Or use the "Sign in" option

## Current Configuration Check

Run these commands to verify:
```bash
# Check if function is deployed
npx supabase functions list

# Check function logs
npx supabase functions logs send-signup-confirmation

# Test the function locally
npx supabase functions serve send-signup-confirmation
```

## Quick Start Script

After getting your Resend API key, run:
```bash
# 1. Add to .env
echo "RESEND_API_KEY=your_key_here" >> .env

# 2. Deploy function
npx supabase functions deploy send-signup-confirmation

# 3. Set secret
npx supabase secrets set RESEND_API_KEY=your_key_here

# 4. Test locally
npm run dev
