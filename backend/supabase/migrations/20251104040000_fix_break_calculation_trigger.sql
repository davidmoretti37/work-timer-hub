-- Fix the calculate_clock_in_hours_worked trigger to properly handle break_end
-- Migration: 20251104040000_fix_break_calculation_trigger.sql
-- This fixes the issue where editing break times adds to existing break instead of replacing

CREATE OR REPLACE FUNCTION public.calculate_clock_in_hours_worked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle explicit break start/end times (e.g., when admin edits break times)
  IF NEW.paused_at IS NOT NULL AND NEW.break_end IS NOT NULL THEN
    -- Calculate break_seconds from explicit start/end times
    NEW.break_seconds := CAST(EXTRACT(EPOCH FROM (NEW.break_end - NEW.paused_at)) AS INTEGER);
    -- Ensure break_seconds is never negative
    IF NEW.break_seconds < 0 THEN
      NEW.break_seconds := 0;
    END IF;
  -- Legacy behavior: If clocking out while paused (no explicit break_end), add the current pause duration to break_seconds
  ELSIF NEW.clock_out_time IS NOT NULL AND NEW.paused_at IS NOT NULL AND NEW.break_end IS NULL THEN
    NEW.break_seconds := COALESCE(NEW.break_seconds, 0)
      + CAST(EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.paused_at)) AS INTEGER);
    NEW.paused_at := NULL;
  END IF;

  -- Ensure break_seconds is never negative
  IF NEW.break_seconds IS NOT NULL AND NEW.break_seconds < 0 THEN
    NEW.break_seconds := 0;
  END IF;

  RETURN NEW;
END;
$$;

-- Update the trigger to also fire when break_end is updated
DROP TRIGGER IF EXISTS clock_in_records_calculate_hours ON public.clock_in_records;
CREATE TRIGGER clock_in_records_calculate_hours
  BEFORE UPDATE OF clock_out_time, paused_at, break_seconds, break_end
  ON public.clock_in_records
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_clock_in_hours_worked();
