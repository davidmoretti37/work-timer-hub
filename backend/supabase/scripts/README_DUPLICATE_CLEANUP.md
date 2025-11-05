# Duplicate Clock-In Cleanup Guide

## Problem
Due to a race condition in the clock-in APIs, users could end up with multiple active clock-in records for the same day. This happened when both the Salesforce auto-clock-in and manual clock-in were triggered simultaneously.

## Solution Implemented

### 1. **Database Constraint** (Migration: `20251105000000_prevent_duplicate_clock_ins.sql`)
- Adds a unique partial index: `unique_active_clock_in_per_employee_per_day`
- Prevents multiple active (`status='clocked_in'`) sessions per employee per day
- Only blocks duplicates for active sessions (allows multiple completed sessions after clock-out)

### 2. **API Fixes**
- **manual-clock-in.ts**: Added "already clocked out" check (prevents re-clocking same day)
- **salesforce-clock-in.ts**: Removed inefficient `listUsers()` call, now relies on database trigger

## Cleanup Process

### Step 1: Identify Existing Duplicates

Run the identification query in Supabase SQL Editor:

```sql
SELECT
  e.email,
  e.name,
  DATE(clock_in_time AT TIME ZONE 'UTC') as clock_date,
  COUNT(*) as duplicate_count,
  array_agg(clock_in_time ORDER BY clock_in_time ASC) as times
FROM clock_in_records cir
JOIN employees e ON e.id = cir.employee_id
WHERE status = 'clocked_in'
GROUP BY e.email, e.name, DATE(clock_in_time AT TIME ZONE 'UTC')
HAVING COUNT(*) > 1
ORDER BY clock_date DESC;
```

### Step 2: Review and Clean Up

**Option A: Use SQL Script (Recommended)**
1. Open Supabase SQL Editor
2. Copy contents of `cleanup_duplicate_clock_ins.sql`
3. Run Step 1 to review duplicates
4. Uncomment the DELETE statement in Step 2
5. Run Step 2 to clean up (keeps earliest clock-in, deletes rest)
6. Run Step 3 to verify no duplicates remain

**Option B: Manual Review**
If you prefer to review each duplicate individually:
1. Use the identification query above
2. Manually delete duplicate records in the Supabase dashboard
3. Keep the record with the earliest `clock_in_time`

### Step 3: Apply Migration

After cleanup, apply the constraint migration:

```bash
supabase db push
```

This will:
1. Create the `extract_utc_date()` function
2. Add the unique index to prevent future duplicates

### Step 4: Verify

Run verification query:
```sql
SELECT
  employee_id,
  DATE(clock_in_time AT TIME ZONE 'UTC') as clock_date,
  COUNT(*) as record_count
FROM clock_in_records
WHERE status = 'clocked_in'
GROUP BY employee_id, DATE(clock_in_time AT TIME ZONE 'UTC')
HAVING COUNT(*) > 1;
```

**Expected result:** 0 rows (no duplicates)

## Prevention

With the fixes in place:

1. **Database Level**: Unique index prevents duplicate inserts
2. **API Level**: Both endpoints now check for existing sessions
3. **Consistency**: Both APIs now use the same logic for clock-out checking

## Monitoring

To monitor for any issues going forward:

```sql
-- Check for any active clock-ins
SELECT
  e.email,
  e.name,
  cir.clock_in_time,
  cir.status
FROM clock_in_records cir
JOIN employees e ON e.id = cir.employee_id
WHERE cir.status = 'clocked_in'
  AND DATE(cir.clock_in_time AT TIME ZONE 'UTC') = CURRENT_DATE
ORDER BY cir.clock_in_time DESC;
```

## Rollback (if needed)

If you need to rollback the migration:

```sql
DROP INDEX IF EXISTS unique_active_clock_in_per_employee_per_day;
DROP FUNCTION IF EXISTS extract_utc_date(timestamptz);
```

## Questions?

- Check the migration file: `20251105000000_prevent_duplicate_clock_ins.sql`
- Review API changes: `api/manual-clock-in.ts` and `api/salesforce-clock-in.ts`
