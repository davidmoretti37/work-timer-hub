# Vercel Deployment - PTO Approval Link Fix

## Issue
The PTO approval emails were sending links pointing to `localhost:8080` or a Railway URL instead of the Vercel production domain (`https://work-timer-hub.vercel.app`). This caused the approval links to fail for anyone not on the developer's local machine.

## Root Cause
The `send-pto-email` Supabase Edge Function had the base URL hardcoded to the old Railway deployment URL:
```typescript
const BASE_URL = 'https://work-timer-hub-production.up.railway.app';
```

## Solution
1. **Updated the email function** to use an environment variable with a fallback to the Vercel domain:
   ```typescript
   const BASE_URL = Deno.env.get('FRONTEND_URL') || 'https://work-timer-hub.vercel.app';
   ```

2. **Set the environment variable** in Supabase:
   ```bash
   npx supabase secrets set FRONTEND_URL=https://work-timer-hub.vercel.app
   ```

3. **Deployed the updated function**:
   ```bash
   npx supabase functions deploy send-pto-email
   ```

## Result
- PTO approval emails now contain links pointing to `https://work-timer-hub.vercel.app`
- Anyone can click the approve/reject buttons and access the application
- The environment variable approach makes it easy to update the URL if needed

## Testing
Test by:
1. Submitting a new PTO request from the application
2. Check the email received at davidmoretti37@gmail.com
3. Verify the approve/reject links point to `https://work-timer-hub.vercel.app`
4. Click the links and verify they work on any device/network

## Date Fixed
October 9, 2025
