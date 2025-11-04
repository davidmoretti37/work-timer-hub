-- Create backward-compatible view for time_sessions
-- This allows History/Admin pages to transition gradually
-- Migration: 20251104000002_create_time_sessions_view.sql

-- Create view that maps clock_in_records to time_sessions field names
CREATE OR REPLACE VIEW time_sessions_view AS
SELECT
  cir.id,
  cir.user_id,
  cir.clock_in_time AS clock_in,
  cir.clock_out_time AS clock_out,
  cir.paused_at,
  cir.break_seconds,
  cir.break_end,
  cir.idle_seconds,
  cir.status,
  -- Calculate hours_worked (matching time_sessions calculation)
  CASE
    WHEN cir.clock_out_time IS NOT NULL THEN
      EXTRACT(EPOCH FROM (cir.clock_out_time - cir.clock_in_time)) / 3600.0
      - (COALESCE(cir.break_seconds, 0) / 3600.0)
    ELSE NULL
  END AS hours_worked,
  cir.clock_in_time AS created_at,
  -- Include employee info for easier joins
  e.email,
  e.name AS employee_name,
  e.salesforce_id
FROM clock_in_records cir
JOIN employees e ON cir.employee_id = e.id
WHERE cir.user_id IS NOT NULL;  -- Only include records linked to auth users

-- Add comment explaining the view
COMMENT ON VIEW time_sessions_view IS
  'Backward-compatible view mapping clock_in_records to time_sessions field names. Used during migration period.';

-- Grant select permissions to authenticated users
GRANT SELECT ON time_sessions_view TO authenticated;

-- Create RLS policy for view
ALTER VIEW time_sessions_view SET (security_invoker = on);

-- Note: Users can only see their own sessions via the user_id filter in app queries
