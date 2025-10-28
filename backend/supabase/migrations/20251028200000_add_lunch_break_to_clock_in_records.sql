-- Add lunch break support to clock_in_records

ALTER TABLE public.clock_in_records
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS break_seconds INTEGER NOT NULL DEFAULT 0;

