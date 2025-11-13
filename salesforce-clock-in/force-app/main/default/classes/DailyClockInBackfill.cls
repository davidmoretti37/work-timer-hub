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

        // Map users → emails and login times
        Set<Id> userIds = new Set<Id>();
        Map<Id, Datetime> userToLoginTime = new Map<Id, Datetime>();

        for (AggregateResult ar : results) {
            Id uid = (Id) ar.get('uid');
            Datetime loginTime = (Datetime) ar.get('firstLogin');
            userIds.add(uid);
            userToLoginTime.put(uid, loginTime);
        }

        Map<Id, User> idToUser = new Map<Id, User>([
            SELECT Id, Email FROM User WHERE Id IN :userIds AND IsActive = true
        ]);

        // Check which users already have clock-in records in Work Timer Hub
        // This prevents creating duplicate entries when job runs hourly
        Set<String> emailsWithClockIn = checkExistingClockIns(idToUser.values(), userToLoginTime);

        // Only enqueue clock-in for users who DON'T already have a record
        Integer skipped = 0;
        Integer processed = 0;

        for (AggregateResult ar : results) {
            Id uid = (Id) ar.get('uid');
            User u = idToUser.get(uid);

            if (u == null || String.isBlank(u.Email)) {
                continue;
            }

            // Skip if this user already has a clock-in record for today
            if (emailsWithClockIn.contains(u.Email.toLowerCase())) {
                skipped++;
                continue;
            }

            // Use the same future method to keep logic centralized
            ClockInService.clockInEmployee(u.Email);
            processed++;
        }

        System.debug('DailyClockInBackfill: Processed=' + processed + ' Skipped=' + skipped);
    }

    /**
     * Check which users already have clock-in records in Work Timer Hub for today
     * @param users List of Salesforce users to check
     * @param userToLoginTime Map of user IDs to their first login times
     * @return Set of lowercase email addresses that already have clock-in records
     */
    private Set<String> checkExistingClockIns(List<User> users, Map<Id, Datetime> userToLoginTime) {
        Set<String> emailsWithRecords = new Set<String>();

        if (users == null || users.isEmpty()) {
            return emailsWithRecords;
        }

        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint('callout:Work_Timer_Hub_API/api/check-clock-ins');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(10000); // 10 second timeout

            // Build list of emails and their expected clock-in times
            List<Map<String, Object>> checkList = new List<Map<String, Object>>();
            for (User u : users) {
                if (String.isNotBlank(u.Email)) {
                    Map<String, Object> entry = new Map<String, Object>();
                    entry.put('email', u.Email);

                    Datetime loginTime = userToLoginTime.get(u.Id);
                    if (loginTime != null) {
                        entry.put('clock_in_time', loginTime);
                    }

                    checkList.add(entry);
                }
            }

            Map<String, Object> body = new Map<String, Object>();
            body.put('users', checkList);
            req.setBody(JSON.serialize(body));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                Map<String, Object> response = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                List<Object> existingEmails = (List<Object>) response.get('existing_emails');

                if (existingEmails != null) {
                    for (Object emailObj : existingEmails) {
                        String email = String.valueOf(emailObj);
                        emailsWithRecords.add(email.toLowerCase());
                    }
                }

                System.debug('Clock-in check response: ' + existingEmails.size() + ' users already have records');
            } else {
                System.debug('Clock-in check failed with status: ' + res.getStatusCode() + ' ' + res.getBody());
            }
        } catch (Exception e) {
            System.debug('Error checking existing clock-ins: ' + e.getMessage());
            // If check fails, return empty set - scheduled job will proceed and API will handle deduplication
        }

        return emailsWithRecords;
    }
}


