-- Script to clean up duplicate clock-in records
-- Run this BEFORE applying the unique constraint migration
-- This script identifies and removes duplicate active clock-in sessions

-- Step 1: Identify duplicates (for review)
-- This query shows all duplicate active clock-ins grouped by employee and date
WITH duplicate_groups AS (
  SELECT
    employee_id,
    extract_utc_date(clock_in_time) as clock_date,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY clock_in_time ASC) as record_ids,
    array_agg(clock_in_time ORDER BY clock_in_time ASC) as clock_times
  FROM clock_in_records
  WHERE status = 'clocked_in'
  GROUP BY employee_id, extract_utc_date(clock_in_time)
  HAVING COUNT(*) > 1
)
SELECT
  dg.employee_id,
  e.email,
  e.name,
  dg.clock_date,
  dg.duplicate_count,
  dg.record_ids,
  dg.clock_times
FROM duplicate_groups dg
LEFT JOIN employees e ON e.id = dg.employee_id
ORDER BY dg.clock_date DESC, e.email;

-- Step 2: Clean up duplicates (keeps earliest clock-in time, deletes rest)
-- Uncomment the DELETE statement below to actually perform the cleanup

/*
WITH duplicates_to_delete AS (
  SELECT
    employee_id,
    extract_utc_date(clock_in_time) as clock_date,
    array_agg(id ORDER BY clock_in_time ASC) as record_ids
  FROM clock_in_records
  WHERE status = 'clocked_in'
  GROUP BY employee_id, extract_utc_date(clock_in_time)
  HAVING COUNT(*) > 1
),
records_to_keep AS (
  -- Keep only the first record (earliest clock_in_time)
  SELECT
    employee_id,
    clock_date,
    record_ids[1] as keep_id
  FROM duplicates_to_delete
),
records_to_delete AS (
  -- All other records should be deleted
  SELECT
    UNNEST(record_ids[2:]) as delete_id
  FROM duplicates_to_delete
)
DELETE FROM clock_in_records
WHERE id IN (SELECT delete_id FROM records_to_delete);
*/

-- Step 3: Verify no duplicates remain
-- Run this after cleanup to confirm
SELECT
  employee_id,
  extract_utc_date(clock_in_time) as clock_date,
  COUNT(*) as record_count
FROM clock_in_records
WHERE status = 'clocked_in'
GROUP BY employee_id, extract_utc_date(clock_in_time)
HAVING COUNT(*) > 1;

-- If the above query returns 0 rows, cleanup was successful!

-- Step 4: Summary statistics
SELECT
  'Total active clock-ins' as metric,
  COUNT(*) as value
FROM clock_in_records
WHERE status = 'clocked_in'
UNION ALL
SELECT
  'Unique employee-date combinations' as metric,
  COUNT(DISTINCT (employee_id, extract_utc_date(clock_in_time))) as value
FROM clock_in_records
WHERE status = 'clocked_in';
