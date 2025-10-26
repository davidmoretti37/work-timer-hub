public class ClockInService {
    @AuraEnabled
    public static String clockIn() {
        String userEmail = UserInfo.getUserEmail();
        clockInEmployee(userEmail);
        return userEmail;
    }
    
    @future(callout=true)
    public static void clockInEmployee(String userEmail) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint('callout:Work_Timer_Hub_API/api/salesforce-clock-in');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            
            String body = '{"email":"' + userEmail + '"}';
            req.setBody(body);
            
            Http http = new Http( );
            HttpResponse res = http.send(req );
            
            System.debug('Clock-in response: ' + res.getBody());
        } catch (Exception e) {
            System.debug('Clock-in error: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateActivity(String status) {
        if (String.isBlank(status)) {
            return;
        }

        String userEmail = UserInfo.getUserEmail();
        updateActivityAsync(userEmail, status);
    }

    @future(callout=true)
    public static void updateActivityAsync(String userEmail, String status) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint('callout:Work_Timer_Hub_API/api/update-activity');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');

            Map<String, Object> body = new Map<String, Object>();
            body.put('email', userEmail);
            body.put('status', status);

            req.setBody(JSON.serialize(body));

            Http http = new Http();
            HttpResponse res = http.send(req);

            System.debug('Update-activity response: ' + res.getStatus() + ' ' + res.getBody());
        } catch (Exception e) {
            System.debug('Update-activity error: ' + e.getMessage());
        }
    }
}
