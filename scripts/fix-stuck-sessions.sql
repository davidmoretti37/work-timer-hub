-- Script to fix stuck clock-in sessions
-- Run this in your Supabase SQL Editor to fix sessions that are stuck as 'clocked_in'

-- First, let's see what stuck sessions we have
-- (Sessions that are still 'clocked_in' but started more than 24 hours ago)
SELECT
  id,
  employee_id,
  clock_in_time,
  status,
  created_at,
  (NOW() - clock_in_time) AS time_since_clock_in
FROM clock_in_records
WHERE status = 'clocked_in'
  AND clock_in_time < NOW() - INTERVAL '12 hours'
ORDER BY clock_in_time DESC;

-- OPTION 1: Automatically clock out all stuck sessions from yesterday or earlier
-- This assumes a normal 12-hour workday. Sessions older than 12 hours are closed.
-- Uncomment the following block to execute:

/*
UPDATE clock_in_records
SET
  status = 'clocked_out',
  clock_out_time = clock_in_time + INTERVAL '8 hours',  -- Assumes 8-hour workday
  updated_at = NOW()
WHERE status = 'clocked_in'
  AND clock_in_time < NOW() - INTERVAL '12 hours'
RETURNING id, employee_id, clock_in_time, clock_out_time;
*/

-- OPTION 2: Clock out specific sessions manually
-- Replace the ID with the actual session ID you want to fix
/*
UPDATE clock_in_records
SET
  status = 'clocked_out',
  clock_out_time = '2025-11-09 18:00:00+00',  -- Set the actual clock-out time here
  updated_at = NOW()
WHERE id = 'YOUR-SESSION-ID-HERE'
RETURNING *;
*/

-- OPTION 3: For the current day's stuck sessions (if someone is actually still working)
-- This helps if the clock-out button is broken but they're still working
-- You might want to just leave these alone until they clock out properly with the fix

-- After running the cleanup, verify all active sessions are current:
SELECT
  e.email,
  cir.clock_in_time,
  cir.status,
  (NOW() - cir.clock_in_time) AS time_elapsed
FROM clock_in_records cir
JOIN employees e ON e.id = cir.employee_id
WHERE cir.status = 'clocked_in'
ORDER BY cir.clock_in_time DESC;
