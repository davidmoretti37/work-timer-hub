public class DailyClockInScheduler {
    /**
     * Ensures the DailyClockInBackfill job is scheduled hourly.
     * Safe to run multiple times; it will not create duplicates.
     */
    public static void ensureScheduled() {
        String jobName = 'DailyClockInBackfill Hourly';

        // Check if a job with this name already exists and is active
        List<CronTrigger> existing = [
            SELECT Id, State, NextFireTime, CronJobDetail.Name
            FROM CronTrigger
            WHERE CronJobDetail.Name = :jobName
            LIMIT 1
        ];

        if (!existing.isEmpty()) {
            System.debug('DailyClockInBackfill already scheduled: ' + existing[0].State + ' next=' + existing[0].NextFireTime);
            return;
        }

        // Run hourly at minute 0 of every hour (org timezone)
        String cron = '0 0 0-23 ? * *';
        System.schedule(jobName, cron, new DailyClockInBackfill());
        System.debug('DailyClockInBackfill scheduled with cron: ' + cron);
    }
}


