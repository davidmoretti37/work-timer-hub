-- Add trigger to clock_in_records to handle break time calculations
-- This ensures that if someone clocks out while paused, the break time is properly recorded

CREATE OR REPLACE FUNCTION public.calculate_clock_in_hours_worked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If clocking out while paused (no explicit break_end), add the current pause duration to break_seconds
  IF NEW.clock_out_time IS NOT NULL AND NEW.paused_at IS NOT NULL THEN
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

-- Create trigger on clock_in_records
DROP TRIGGER IF EXISTS clock_in_records_calculate_hours ON public.clock_in_records;
CREATE TRIGGER clock_in_records_calculate_hours
  BEFORE UPDATE OF clock_out_time, paused_at, break_seconds
  ON public.clock_in_records
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_clock_in_hours_worked();
