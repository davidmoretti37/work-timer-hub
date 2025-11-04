-- Add unique constraints to prevent duplicate sessions and improve data integrity
-- Migration: 20251104000000_add_session_constraints.sql

-- 1. Add unique constraint to prevent duplicate time_sessions with same clock_in time
-- This prevents the syncClockInRecordToTimeSession bug from creating duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_clock_in_per_user
  ON time_sessions (user_id, clock_in);

-- 2. Add partial unique index to prevent multiple active sessions per user
-- This is a safeguard against race conditions
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_session_per_user
  ON time_sessions (user_id)
  WHERE clock_out IS NULL;

-- 3. Add partial unique index to prevent multiple active clock_in_records per employee
-- Ensures only one active Salesforce session at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_clock_in_per_employee
  ON clock_in_records (employee_id)
  WHERE status = 'clocked_in';

-- 4. Add check constraint to ensure clock_out is after clock_in
ALTER TABLE time_sessions
  ADD CONSTRAINT check_clock_out_after_clock_in
  CHECK (clock_out IS NULL OR clock_out > clock_in);

ALTER TABLE clock_in_records
  ADD CONSTRAINT check_clock_out_time_after_clock_in_time
  CHECK (clock_out_time IS NULL OR clock_out_time > clock_in_time);

-- 5. Add index for faster lookups of today's sessions
CREATE INDEX IF NOT EXISTS idx_time_sessions_clock_in_date
  ON time_sessions (user_id, DATE(clock_in));

CREATE INDEX IF NOT EXISTS idx_clock_in_records_date
  ON clock_in_records (employee_id, DATE(clock_in_time));

COMMENT ON INDEX idx_unique_clock_in_per_user IS
  'Prevents duplicate time_sessions with same clock_in time - fixes syncClockInRecordToTimeSession bug';

COMMENT ON INDEX idx_active_session_per_user IS
  'Ensures only one active (not clocked out) session per user at a time';

COMMENT ON INDEX idx_active_clock_in_per_employee IS
  'Ensures only one active Salesforce clock-in per employee at a time';
