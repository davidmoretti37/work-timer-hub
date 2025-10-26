public class ClockInService {
    @AuraEnabled
    public static void clockIn() {
        String userEmail = UserInfo.getUserEmail();
        clockInEmployee(userEmail);
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
}
