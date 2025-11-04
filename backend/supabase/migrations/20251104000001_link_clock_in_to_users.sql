-- Link clock_in_records to auth.users for easier Dashboard queries
-- Migration: 20251104000001_link_clock_in_to_users.sql

-- 1. Add user_id column to clock_in_records table
ALTER TABLE clock_in_records
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_clock_in_records_user_id
  ON clock_in_records(user_id);

-- 3. Backfill user_id by matching employee email to auth user email
-- This connects existing clock_in_records to their corresponding auth users
UPDATE clock_in_records cir
SET user_id = au.id
FROM employees e
JOIN auth.users au ON LOWER(e.email) = LOWER(au.email)
WHERE cir.employee_id = e.id
  AND cir.user_id IS NULL;

-- 4. Add index for combined queries (user_id + date)
CREATE INDEX IF NOT EXISTS idx_clock_in_records_user_date
  ON clock_in_records(user_id, DATE(clock_in_time));

-- 5. Add comment explaining the dual-key approach
COMMENT ON COLUMN clock_in_records.user_id IS
  'Links to auth.users for Dashboard queries. Redundant with employee_id but improves query performance.';

COMMENT ON COLUMN clock_in_records.employee_id IS
  'Links to employees table. Primary relationship for Salesforce integration.';
