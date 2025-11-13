-- Prevent duplicate clock-in records with the same employee and exact clock-in timestamp
-- This addresses the issue where the DailyClockInBackfill scheduled job
-- was creating duplicate entries by calling the API multiple times with the same timestamp

-- Create a unique index on (employee_id, clock_in_time)
-- This ensures each employee can only have ONE record per specific clock-in time
CREATE UNIQUE INDEX IF NOT EXISTS unique_employee_clock_in_timestamp
ON clock_in_records (employee_id, clock_in_time);

-- Add a comment explaining the constraint
COMMENT ON INDEX unique_employee_clock_in_timestamp IS
'Prevents duplicate clock-in records with the same employee_id and clock_in_time.
This is the database-level failsafe to prevent the DailyClockInBackfill scheduled job
from creating duplicate entries when it runs hourly with the same login timestamp.';
