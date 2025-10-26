({
    doInit : function(component, event, helper) {
        helper.initialize(component);
    },

    onDestroy : function(component, event, helper) {
        helper.teardown(component);
    }
})
