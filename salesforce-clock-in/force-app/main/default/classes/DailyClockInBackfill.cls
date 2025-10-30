public class DailyClockInBackfill implements Schedulable {
    public void execute(SchedulableContext sc) {
        // Find users who have logged in today; for each, enqueue the same future call used by AutoClockIn
        // We limit the scope to avoid hitting limits; scheduler runs periodically
        Date today = Date.today();

        // Query earliest login per user today
        List<AggregateResult> results = [
            SELECT UserId uid, MIN(LoginTime) firstLogin
            FROM LoginHistory
            WHERE CALENDAR_DATE(LoginTime) = :today
            GROUP BY UserId
            LIMIT 500
        ];

        if (results.isEmpty()) {
            return;
        }

        // Map users → emails
        Set<Id> userIds = new Set<Id>();
        for (AggregateResult ar : results) {
            userIds.add((Id) ar.get('uid'));
        }

        Map<Id, User> idToUser = new Map<Id, User>([
            SELECT Id, Email FROM User WHERE Id IN :userIds AND IsActive = true
        ]);

        // Enqueue clock-in for each email; API will dedupe if a record already exists today
        for (AggregateResult ar : results) {
            Id uid = (Id) ar.get('uid');
            User u = idToUser.get(uid);
            if (u == null || String.isBlank(u.Email)) {
                continue;
            }
            // Use the same future method to keep logic centralized
            ClockInService.clockInEmployee(u.Email);
        }
    }
}


