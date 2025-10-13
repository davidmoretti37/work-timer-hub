-- Allow reading PTO requests by approval token (no auth required)
-- This enables the approval page to work without login

CREATE POLICY "Allow read PTO by valid token"
ON pto_requests
FOR SELECT
USING (
  approval_token IS NOT NULL 
  AND token_used = false
  AND token_expires_at > NOW()
);
