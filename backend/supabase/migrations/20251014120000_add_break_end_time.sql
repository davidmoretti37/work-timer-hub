-- Add break_end column for explicit break end times
ALTER TABLE public.time_sessions
  ADD COLUMN IF NOT EXISTS break_end TIMESTAMPTZ;

-- Update the hours calculation function to handle explicit break start/end times
CREATE OR REPLACE FUNCTION public.calculate_hours_worked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle explicit break start/end times
  IF NEW.paused_at IS NOT NULL AND NEW.break_end IS NOT NULL THEN
    -- Calculate break_seconds from explicit start/end times
    NEW.break_seconds := CAST(EXTRACT(EPOCH FROM (NEW.break_end - NEW.paused_at)) AS INTEGER);
    -- Ensure break_seconds is never negative
    IF NEW.break_seconds < 0 THEN
      NEW.break_seconds := 0;
    END IF;
  END IF;

  -- Legacy behavior: If clocking out while paused (no explicit break_end), roll the current pause duration into break_seconds
  IF NEW.clock_out IS NOT NULL AND NEW.paused_at IS NOT NULL AND NEW.break_end IS NULL THEN
    NEW.break_seconds := COALESCE(NEW.break_seconds, 0)
      + CAST(EXTRACT(EPOCH FROM (NEW.clock_out - NEW.paused_at)) AS INTEGER);
    NEW.paused_at := NULL;
  END IF;

  -- Ensure break_seconds is never negative
  IF NEW.break_seconds IS NOT NULL AND NEW.break_seconds < 0 THEN
    NEW.break_seconds := 0;
  END IF;

  -- Compute hours_worked subtracting breaks
  IF NEW.clock_out IS NOT NULL AND NEW.clock_in IS NOT NULL THEN
    NEW.hours_worked := (
      EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in))
      - COALESCE(NEW.break_seconds, 0)
    ) / 3600.0;
    IF NEW.hours_worked < 0 THEN
      NEW.hours_worked := 0;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
