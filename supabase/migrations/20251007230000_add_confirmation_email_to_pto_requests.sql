-- Add confirmation_email field to pto_requests table
ALTER TABLE public.pto_requests 
ADD COLUMN IF NOT EXISTS confirmation_email text NOT NULL DEFAULT '';

-- Update the constraint to make confirmation_email required for new records
-- (We use a check constraint instead of NOT NULL to allow existing records)
ALTER TABLE public.pto_requests 
ADD CONSTRAINT pto_requests_confirmation_email_required 
CHECK (confirmation_email IS NOT NULL AND confirmation_email != '');

-- Add index for better email lookup performance
CREATE INDEX IF NOT EXISTS idx_pto_requests_confirmation_email 
ON public.pto_requests(confirmation_email);

-- Add comment to describe the column
COMMENT ON COLUMN public.pto_requests.confirmation_email 
IS 'Email address where approval/rejection notifications will be sent to the employee';
