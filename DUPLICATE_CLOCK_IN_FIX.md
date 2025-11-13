# Fix for Duplicate Clock-In Entries

## Problem Summary
Users were getting duplicate time entries on the same day with the same clock-in timestamp. The root cause was the `DailyClockInBackfill` Salesforce scheduled job running **every hour** and calling the clock-in API multiple times for the same user with the same login timestamp.

## Root Cause
The `DailyClockInBackfill.cls` scheduled job:
1. Runs hourly (24 times per day)
2. Queries all users who logged into Salesforce TODAY
3. Calls `ClockInService.clockInEmployee()` for EVERY user, EVERY hour
4. Even if user already clocked out, the job would create a new record with the original morning login time

This resulted in multiple clock-in records with identical timestamps.

## Solution Implemented

### Three-Layer Defense Strategy

#### Layer 1: Database Constraint (Strongest Protection)
**File:** `backend/supabase/migrations/20251113000000_prevent_duplicate_clock_in_timestamps.sql`

Creates a unique index to prevent duplicate records with same employee_id and clock_in_time:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS unique_employee_clock_in_timestamp
ON clock_in_records (employee_id, clock_in_time);
```

**Impact:** Database will reject any duplicate entries at the lowest level.

#### Layer 2: API Defense (Secondary Protection)
**File:** `api/salesforce-clock-in.ts` (lines 118-145)

Added timestamp check before creating new records:
- Queries for existing records with exact same `clock_in_time`
- Returns existing record instead of attempting to create duplicate
- Prevents unnecessary insert attempts

**Impact:** Reduces database load and catches duplicates before insert.

#### Layer 3: Scheduled Job Fix (Primary Fix)
**Files Modified:**
- `salesforce-clock-in/force-app/main/default/classes/DailyClockInBackfill.cls`
- `api/check-clock-ins.ts` (NEW API endpoint)

**Changes:**
1. Before calling clock-in API, the scheduled job now calls `/api/check-clock-ins` to check which users already have records
2. Skips users who already have clock-in records for today
3. Only processes users who need a clock-in record created
4. Logs statistics: `Processed=X Skipped=Y`

**Impact:** Prevents unnecessary API calls and eliminates the root cause.

## Files Modified

### New Files
1. `backend/supabase/migrations/20251113000000_prevent_duplicate_clock_in_timestamps.sql` - Database migration
2. `api/check-clock-ins.ts` - New API endpoint for bulk checking existing clock-ins

### Modified Files
1. `api/salesforce-clock-in.ts` - Added timestamp duplication check
2. `salesforce-clock-in/force-app/main/default/classes/DailyClockInBackfill.cls` - Added pre-check before calling API

## Deployment Steps

### Step 1: Deploy Database Migration
```bash
cd backend/supabase
supabase db push
```

**OR** manually run the SQL:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS unique_employee_clock_in_timestamp
ON clock_in_records (employee_id, clock_in_time);
```

You can run this via:
- Supabase Dashboard → SQL Editor
- Or: `psql` if you have direct database access

### Step 2: Deploy API Changes
Deploy the Next.js application with the new API endpoints:
```bash
# If using Vercel
vercel --prod

# Or your deployment method
npm run build
```

The following API endpoints need to be deployed:
- `/api/salesforce-clock-in` (modified)
- `/api/check-clock-ins` (new)

### Step 3: Deploy Salesforce Code
Deploy the modified `DailyClockInBackfill.cls` to Salesforce:

```bash
cd salesforce-clock-in
sfdx force:source:deploy -p force-app/main/default/classes/DailyClockInBackfill.cls
```

**OR** use Salesforce UI:
1. Go to Setup → Apex Classes
2. Edit `DailyClockInBackfill`
3. Replace with new code
4. Save

### Step 4: Verify Deployment
1. Check Salesforce debug logs for `DailyClockInBackfill: Processed=X Skipped=Y`
2. Monitor for any duplicate entries in the next 24 hours
3. Check database: `SELECT COUNT(*), employee_id, DATE(clock_in_time) FROM clock_in_records GROUP BY employee_id, DATE(clock_in_time) HAVING COUNT(*) > 1;`

## Testing

### Test the Database Constraint
Try to manually insert a duplicate (should fail):
```sql
-- This should succeed
INSERT INTO clock_in_records (employee_id, clock_in_time, status)
VALUES ('some-employee-id', '2025-11-13 10:00:00+00', 'clocked_in');

-- This should FAIL with unique constraint violation
INSERT INTO clock_in_records (employee_id, clock_in_time, status)
VALUES ('some-employee-id', '2025-11-13 10:00:00+00', 'clocked_in');
```

### Test the API
```bash
curl -X POST https://your-domain.com/api/salesforce-clock-in \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "login_time": "2025-11-13T10:00:00Z"
  }'
```

Calling this twice should:
1. First call: Create record
2. Second call: Return existing record with `"existing": true`

### Test the Scheduled Job
Run the scheduled job manually in Salesforce and check debug logs:
```apex
DailyClockInBackfill job = new DailyClockInBackfill();
job.execute(null);
```

Should see: `DailyClockInBackfill: Processed=X Skipped=Y` where Skipped > 0 for users who already have records.

## Cleanup: Remove Existing Duplicates

After deploying the fix, clean up existing duplicates:

```sql
-- Find duplicates
SELECT
    employee_id,
    clock_in_time,
    COUNT(*) as duplicate_count
FROM clock_in_records
GROUP BY employee_id, clock_in_time
HAVING COUNT(*) > 1;

-- Delete duplicates (keeps the oldest record)
DELETE FROM clock_in_records
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY employee_id, clock_in_time
                   ORDER BY created_at ASC
               ) as rn
        FROM clock_in_records
    ) t
    WHERE t.rn > 1
);
```

## Monitoring

After deployment, monitor:
1. Salesforce debug logs for `DailyClockInBackfill` execution
2. API logs for `[salesforce-clock-in] Record with exact timestamp already exists`
3. Database for any new duplicates (should be zero)

## Rollback Plan

If issues occur:

### Rollback Database Migration
```sql
DROP INDEX IF EXISTS unique_employee_clock_in_timestamp;
```

### Rollback API Changes
Revert commits for:
- `api/salesforce-clock-in.ts`
- `api/check-clock-ins.ts`

### Rollback Salesforce Changes
Revert `DailyClockInBackfill.cls` to previous version.

## Success Criteria
✅ No duplicate entries created after deployment
✅ `DailyClockInBackfill` logs show `Skipped > 0`
✅ Database constraint prevents manual duplicates
✅ API returns existing records instead of creating duplicates

---

**Date:** November 13, 2025
**Fixed By:** Claude Code
**Issue:** Duplicate time entries from scheduled job
