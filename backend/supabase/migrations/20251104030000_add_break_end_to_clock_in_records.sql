-- Add break_end column to clock_in_records table (was missing)
-- Migration: 20251104030000_add_break_end_to_clock_in_records.sql

ALTER TABLE public.clock_in_records
  ADD COLUMN IF NOT EXISTS break_end TIMESTAMPTZ;

COMMENT ON COLUMN public.clock_in_records.break_end IS 'Explicit break end timestamp (for manual break tracking)';
