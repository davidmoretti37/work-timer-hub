-- Add idle time tracking to clock_in_records and time_sessions

ALTER TABLE public.clock_in_records
  ADD COLUMN IF NOT EXISTS idle_seconds INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.time_sessions
  ADD COLUMN IF NOT EXISTS idle_seconds INTEGER NOT NULL DEFAULT 0;

