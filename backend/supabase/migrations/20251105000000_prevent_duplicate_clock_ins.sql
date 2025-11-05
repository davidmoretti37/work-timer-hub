-- Migration to prevent duplicate active clock-in sessions per employee per day
-- This addresses the race condition that allowed duplicate clock-ins

-- Step 1: Create a function to extract the date (UTC) from a timestamptz
CREATE OR REPLACE FUNCTION extract_utc_date(ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (ts AT TIME ZONE 'UTC')::date;
$$;

-- Step 2: Create a unique partial index to prevent duplicate active sessions per employee per day
-- This only applies to records with status='clocked_in' (active sessions)
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_clock_in_per_employee_per_day
ON clock_in_records (employee_id, extract_utc_date(clock_in_time))
WHERE status = 'clocked_in';

-- Step 3: Add a comment explaining the constraint
COMMENT ON INDEX unique_active_clock_in_per_employee_per_day IS
'Prevents duplicate active clock-in sessions for the same employee on the same day (UTC).
Only applies to status=''clocked_in'' records to allow multiple completed sessions after clock-out.';
