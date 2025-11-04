# Database Migration Instructions

**IMPORTANT:** Run these migrations in the exact order listed below.

---

## How to Apply Migrations

1. Go to **Supabase Dashboard** → https://supabase.com/dashboard
2. Select your project: `mkisayjvfcthkppiatmr`
3. Go to **SQL Editor** (left sidebar)
4. Create a **New Query**
5. Copy and paste each migration below
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Wait for "Success" message before moving to next migration

---

## Migration 1: Add Session Constraints

**Purpose:** Prevents duplicate sessions and ensures data integrity

**File:** `backend/supabase/migrations/20251104000000_add_session_constraints.sql`

```sql
-- Add unique constraints to prevent duplicate sessions and improve data integrity
-- Migration: 20251104000000_add_session_constraints.sql

-- 1. Add unique constraint to prevent duplicate time_sessions with same clock_in time
-- This prevents the syncClockInRecordToTimeSession bug from creating duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_clock_in_per_user
  ON time_sessions (user_id, clock_in);

-- 2. Add partial unique index to prevent multiple active sessions per user
-- This is a safeguard against race conditions
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_session_per_user
  ON time_sessions (user_id)
  WHERE clock_out IS NULL;

-- 3. Add partial unique index to prevent multiple active clock_in_records per employee
-- Ensures only one active Salesforce session at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_clock_in_per_employee
  ON clock_in_records (employee_id)
  WHERE status = 'clocked_in';

-- 4. Add check constraint to ensure clock_out is after clock_in
ALTER TABLE time_sessions
  ADD CONSTRAINT IF NOT EXISTS check_clock_out_after_clock_in
  CHECK (clock_out IS NULL OR clock_out > clock_in);

ALTER TABLE clock_in_records
  ADD CONSTRAINT IF NOT EXISTS check_clock_out_time_after_clock_in_time
  CHECK (clock_out_time IS NULL OR clock_out_time > clock_in_time);

-- 5. Add index for faster lookups of today's sessions
CREATE INDEX IF NOT EXISTS idx_time_sessions_clock_in_date
  ON time_sessions (user_id, DATE(clock_in));

CREATE INDEX IF NOT EXISTS idx_clock_in_records_date
  ON clock_in_records (employee_id, DATE(clock_in_time));

COMMENT ON INDEX idx_unique_clock_in_per_user IS
  'Prevents duplicate time_sessions with same clock_in time - fixes syncClockInRecordToTimeSession bug';

COMMENT ON INDEX idx_active_session_per_user IS
  'Ensures only one active (not clocked out) session per user at a time';

COMMENT ON INDEX idx_active_clock_in_per_employee IS
  'Ensures only one active Salesforce clock-in per employee at a time';
```

✅ **Expected Output:** "Success. No rows returned"

❌ **If Error:** Check if constraints already exist (safe to ignore if so)

---

## Migration 2: Link clock_in_records to Users

**Purpose:** Links clock_in_records to auth users for easier Dashboard queries

**File:** `backend/supabase/migrations/20251104000001_link_clock_in_to_users.sql`

```sql
-- Link clock_in_records to auth.users for easier Dashboard queries
-- Migration: 20251104000001_link_clock_in_to_users.sql

-- 1. Add user_id column to clock_in_records table
ALTER TABLE clock_in_records
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_clock_in_records_user_id
  ON clock_in_records(user_id);

-- 3. Backfill user_id by matching employee email to auth user email
-- This connects existing clock_in_records to their corresponding auth users
UPDATE clock_in_records cir
SET user_id = au.id
FROM employees e
JOIN auth.users au ON LOWER(e.email) = LOWER(au.email)
WHERE cir.employee_id = e.id
  AND cir.user_id IS NULL;

-- 4. Add index for combined queries (user_id + date)
CREATE INDEX IF NOT EXISTS idx_clock_in_records_user_date
  ON clock_in_records(user_id, DATE(clock_in_time));

-- 5. Add comment explaining the dual-key approach
COMMENT ON COLUMN clock_in_records.user_id IS
  'Links to auth.users for Dashboard queries. Redundant with employee_id but improves query performance.';

COMMENT ON COLUMN clock_in_records.employee_id IS
  'Links to employees table. Primary relationship for Salesforce integration.';
```

✅ **Expected Output:** "Success. X rows updated" (where X = number of existing clock_in_records)

❌ **If Error "column already exists":** Safe to ignore, column was already added

---

## Migration 3: Create Backward-Compatible View

**Purpose:** Allows History/Admin pages to transition gradually

**File:** `backend/supabase/migrations/20251104000002_create_time_sessions_view.sql`

```sql
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
```

✅ **Expected Output:** "Success. No rows returned"

❌ **If Error:** Check if view already exists (safe to replace if so)

---

## Verification Steps

After running all 3 migrations, verify they worked:

### Test 1: Check Constraints

```sql
-- Should return 3 rows (one for each unique index)
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('time_sessions', 'clock_in_records')
  AND indexname LIKE '%unique%';
```

**Expected:** 3 rows showing unique indexes

---

### Test 2: Check user_id Backfill

```sql
-- Should show percentage of clock_in_records with user_id populated
SELECT
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) as with_user_id,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE user_id IS NOT NULL) / COUNT(*), 1) as percentage
FROM clock_in_records;
```

**Expected:** High percentage (ideally 100%) with user_id

---

### Test 3: Check View Created

```sql
-- Should return 1 row
SELECT COUNT(*) FROM information_schema.views
WHERE table_name = 'time_sessions_view';
```

**Expected:** 1 row

---

## Troubleshooting

### Issue: "permission denied for table"
**Solution:** You need admin access. Log in with the project owner account.

### Issue: "constraint already exists"
**Solution:** Safe to ignore. Constraint was previously created.

### Issue: "user_id backfill shows 0%"
**Solution:** Run this manually:
```sql
UPDATE clock_in_records cir
SET user_id = au.id
FROM employees e
JOIN auth.users au ON LOWER(e.email) = LOWER(au.email)
WHERE cir.employee_id = e.id
  AND cir.user_id IS NULL;
```

### Issue: "view already exists"
**Solution:** Drop and recreate:
```sql
DROP VIEW IF EXISTS time_sessions_view;
-- Then run migration 3 again
```

---

## After Migration Complete

1. ✅ Deploy updated frontend code (Dashboard, History, Admin pages)
2. ✅ Deploy updated API endpoints (manual-clock-in.ts)
3. ✅ Test clock-in functionality
4. ✅ Test clock-out functionality
5. ✅ Check History page
6. ✅ Check Admin page
7. ✅ Monitor for duplicate sessions (should be ZERO)

---

## Rollback Plan (If Needed)

If something goes wrong, you can rollback:

```sql
-- Remove constraints (reverses migration 1)
DROP INDEX IF EXISTS idx_unique_clock_in_per_user;
DROP INDEX IF EXISTS idx_active_session_per_user;
DROP INDEX IF EXISTS idx_active_clock_in_per_employee;
ALTER TABLE time_sessions DROP CONSTRAINT IF EXISTS check_clock_out_after_clock_in;
ALTER TABLE clock_in_records DROP CONSTRAINT IF EXISTS check_clock_out_time_after_clock_in_time;

-- Remove user_id column (reverses migration 2)
ALTER TABLE clock_in_records DROP COLUMN IF EXISTS user_id;

-- Remove view (reverses migration 3)
DROP VIEW IF EXISTS time_sessions_view;
```

**Note:** Only rollback if absolutely necessary. The migrations are non-destructive.

---

## Summary

| Migration | Purpose | Risk | Time |
|-----------|---------|------|------|
| 1. Constraints | Prevent duplicates | Low | 30 sec |
| 2. Link users | Connect tables | Low | 1-2 min |
| 3. Create view | Backward compat | None | 10 sec |

**Total Time:** ~3-5 minutes

**Downtime Required:** None (migrations are non-blocking)

---

**Questions?** Check the main documentation:
- `ARCHITECTURAL_ISSUES_AND_FIXES.md` - Full technical explanation
- `ARCHITECTURE_FIX_PROGRESS.md` - Current status and next steps

---

**Last Updated:** November 4, 2025
