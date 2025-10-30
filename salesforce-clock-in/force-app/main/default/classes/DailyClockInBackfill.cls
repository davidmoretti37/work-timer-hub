public class DailyClockInBackfill implements Schedulable {
    public void execute(SchedulableContext sc) {
        // Find earliest login per user for "today" (org timezone)
        // Using date literal TODAY works with DateTime fields in SOQL
        List<AggregateResult> results = [
            SELECT UserId uid, MIN(LoginTime) firstLogin
            FROM LoginHistory
            WHERE LoginTime = TODAY
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


