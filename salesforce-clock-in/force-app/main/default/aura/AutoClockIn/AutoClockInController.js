({
    doInit : function(component, event, helper) {
        helper.initialize(component);
    },

    onDestroy : function(component, event, helper) {
        helper.teardown(component);
    },

    handleIdleConfirm : function(component, event, helper) {
        helper.handleIdleConfirm(component);
    }
})
