({
    doInit : function(component, event, helper) {
        var action = component.get("c.clockIn");
        action.setCallback(this, function(response) {
            var state = response.getState();
            if (state === "SUCCESS") {
                console.log("Clock-in successful");
            } else {
                console.log("Clock-in failed: " + response.getError());
            }
        });
        $A.enqueueAction(action);
    }
})
