-- Add mock clock-in records for Luke Schmit for testing
-- Migration: 20251104070000_add_luke_mock_data.sql
-- Creates 8-hour work day records for today and yesterday

-- Get Luke's employee_id and user_id
DO $$
DECLARE
  luke_employee_id UUID;
  luke_user_id UUID;
  today_date DATE;
  yesterday_date DATE;
BEGIN
  -- Get Luke's IDs
  SELECT e.id, au.id INTO luke_employee_id, luke_user_id
  FROM employees e
  JOIN auth.users au ON LOWER(e.email) = LOWER(au.email)
  WHERE e.email = 'lschmit@baycoaviation.com';

  IF luke_employee_id IS NULL THEN
    RAISE EXCEPTION 'Luke Schmit not found in employees table';
  END IF;

  -- Get dates
  today_date := CURRENT_DATE;
  yesterday_date := CURRENT_DATE - INTERVAL '1 day';

  -- Insert yesterday's 8-hour session (9 AM to 5 PM)
  INSERT INTO clock_in_records (
    employee_id,
    user_id,
    clock_in_time,
    clock_out_time,
    status,
    break_seconds
  ) VALUES (
    luke_employee_id,
    luke_user_id,
    yesterday_date + TIME '09:00:00',
    yesterday_date + TIME '17:00:00',
    'clocked_out',
    0  -- No break
  )
  ON CONFLICT DO NOTHING;

  -- Insert today's 8-hour session (9 AM to 5 PM)
  INSERT INTO clock_in_records (
    employee_id,
    user_id,
    clock_in_time,
    clock_out_time,
    status,
    break_seconds
  ) VALUES (
    luke_employee_id,
    luke_user_id,
    today_date + TIME '09:00:00',
    today_date + TIME '17:00:00',
    'clocked_out',
    0  -- No break
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Mock data created for Luke Schmit';
END $$;
