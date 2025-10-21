# Salesforce OAuth & Clock-in Webhook

This function supports two flows:

- User OAuth (optional UI):
  - GET `/salesforce-oauth/login` → Redirects to Salesforce
  - GET `/salesforce-oauth/callback` → Exchanges code, upserts employee, idempotent clock-in, redirects to `/dashboard`

- Invisible clock-in (recommended):
  - POST `/salesforce-oauth/clockin-webhook` → Server-to-server from Salesforce on login

## Required Secrets (Supabase → Edge Functions → Secrets)

- `SUPABASE_URL` = `https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = Service role key from Dashboard → Settings → API
- `SALESFORCE_CLIENT_ID` = Connected App client id (for UI flow)
- `SALESFORCE_CLIENT_SECRET` = Connected App client secret (for UI flow)
- `SALESFORCE_INSTANCE_URL` = `https://login.salesforce.com` or your MyDomain
- `SALESFORCE_WEBHOOK_SECRET` = a long random string (for webhook)

## Deploy

```bash
cd backend
supabase link --project-ref <PROJECT_REF>
supabase functions deploy salesforce-oauth --project-ref <PROJECT_REF>
```

## Webhook URL

- Functions domain: `https://<PROJECT_REF>.functions.supabase.co/salesforce-oauth/clockin-webhook`
- Or gateway: `https://<PROJECT_REF>.supabase.co/functions/v1/salesforce-oauth/clockin-webhook`

Headers:
- `x-webhook-secret: <SALESFORCE_WEBHOOK_SECRET>`

Body (JSON):
```json
{"user_id":"<SF User Id>","email":"<Email>","name":"<Name>"}
```

## Salesforce Setup (Flow)

1. Setup → Named Credentials → Create HTTP callout host for `https://<PROJECT_REF>.functions.supabase.co`
2. Setup → Flows → New → Platform Event–Triggered Flow
3. Event: `LoginEventStream`
4. Add HTTP Callout action:
   - Method: `POST`
   - Path: `/salesforce-oauth/clockin-webhook`
   - Header: `x-webhook-secret = <SALESFORCE_WEBHOOK_SECRET>`
   - Body: as above, mapping fields:
     - `user_id = {!$Record.UserId}`
     - `email = {!$Record.Username}`
     - `name = {!$Record.Username}`
5. Activate the Flow

## Notes

- Clock-in is idempotent per UTC day.
- Service role bypasses RLS; do not expose the service role key client-side.
- If you need timezone-specific days, adjust the function logic to your business TZ.
