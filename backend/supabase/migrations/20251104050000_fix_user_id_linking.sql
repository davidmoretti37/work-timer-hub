-- Fix user_id linking for all clock_in_records
-- Migration: 20251104050000_fix_user_id_linking.sql
-- This ensures all records have proper user_id set

-- Update clock_in_records to populate user_id from employees and auth.users
UPDATE clock_in_records cir
SET user_id = au.id
FROM employees e
JOIN auth.users au ON LOWER(e.email) = LOWER(au.email)
WHERE cir.employee_id = e.id
  AND (cir.user_id IS NULL OR cir.user_id != au.id);

-- Show results
SELECT
  COUNT(*) FILTER (WHERE user_id IS NULL) as records_without_user_id,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) as records_with_user_id,
  COUNT(DISTINCT user_id) as unique_users
FROM clock_in_records;
