# Supabase Auth Settings - Vercel Domain Fix

## Problem
When users try to sign up or log in, the confirmation emails contain links pointing to `localhost:8080` instead of your Vercel domain `https://work-timer-hub.vercel.app`. This causes the error "The requested resource is either not found or not available" for anyone trying to access the site.

## Root Cause
Supabase Auth uses the **Site URL** configured in your project settings to generate email confirmation links. This was still set to localhost or the old Railway URL.

## Solution

### Step 1: Update Environment Variables (COMPLETED ✅)
```bash
npx supabase secrets set CONFIRM_REDIRECT_URL=https://work-timer-hub.vercel.app
npx supabase secrets set FRONTEND_URL=https://work-timer-hub.vercel.app
npx supabase functions deploy send-signup-confirmation
```

### Step 2: Update Supabase Dashboard Settings (ACTION REQUIRED)

You must update the Site URL in your Supabase dashboard:

1. Go to https://supabase.com/dashboard/project/mkisayjvfcthkppiatmr/settings/auth

2. Scroll to **Site URL** section

3. Change the URL from:
   - ❌ `http://localhost:8080`
   - ❌ `https://work-timer-hub-production.up.railway.app`
   
   To:
   - ✅ `https://work-timer-hub.vercel.app`

4. Scroll to **Redirect URLs** section

5. Add your Vercel domain to the allowed list:
   - Add: `https://work-timer-hub.vercel.app/**`
   - This allows any path on your domain to be used as a redirect target

6. Click **Save** at the bottom of the page

### Step 3: Verify the Fix

After updating the dashboard settings:

1. Go to your Vercel site: https://work-timer-hub.vercel.app
2. Try to sign up with a new email or request a password reset
3. Check the confirmation email
4. The links should now point to `https://work-timer-hub.vercel.app` (not localhost)
5. Have your fiancée or someone else test it from their device

## Important Notes

- **Site URL** is the primary domain Supabase Auth uses for generating links
- **Redirect URLs** must include your domain with a wildcard (`/**`) to allow redirects after authentication
- Changes take effect immediately after saving
- You may need to wait a few minutes for the settings to propagate

## Troubleshooting

If links still point to localhost after these changes:

1. Clear your browser cache and cookies
2. Try signing up with a completely new email address
3. Check the Supabase logs in the dashboard to see what URL is being used
4. Verify the Site URL was saved correctly in the dashboard

## Related Documentation

- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
