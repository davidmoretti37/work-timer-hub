({
    initialize: function(component) {
        var action = component.get("c.clockIn");
        action.setCallback(this, function(response) {
            var state = response.getState();
            if (state === "SUCCESS") {
                var userEmail = response.getReturnValue();
                component.set("v.userEmail", userEmail);
                this.startActivityTracking(component, userEmail);
            } else {
                console.error("Clock-in failed", response.getError());
            }
        });
        $A.enqueueAction(action);
    },

    startActivityTracking: function(component, userEmail) {
        if (!userEmail) {
            console.warn("Unable to start activity tracking without user email");
            return;
        }

        if (window._workTimerHubTracker) {
            return;
        }

        var helper = this;
        var tracker = {
            userEmail: userEmail,
            lastInteraction: Date.now(),
            currentStatus: null,
            lastSentStatus: null,
            lastSentAt: 0,
            checkIntervalMs: 60000,
            heartbeatMs: 4 * 60 * 1000,
            activeThreshold: 3 * 60 * 1000,
            awayThreshold: 10 * 60 * 1000,
            listeners: [],
            intervalId: null,
            pending: false,
            beforeUnloadHandler: null
        };

        var recordInteraction = function() {
            tracker.lastInteraction = Date.now();
            helper.evaluateStatus(component, tracker, true);
        };

        var addListener = function(target, eventName, handler, options) {
            if (!target) {
                return;
            }
            target.addEventListener(eventName, handler, options || false);
            tracker.listeners.push(function() {
                target.removeEventListener(eventName, handler, options || false);
            });
        };

        addListener(window, 'mousemove', recordInteraction, true);
        addListener(window, 'mousedown', recordInteraction, true);
        addListener(window, 'keydown', recordInteraction, true);
        addListener(window, 'touchstart', recordInteraction, true);
        addListener(window, 'focus', recordInteraction, true);

        addListener(document, 'visibilitychange', function() {
            if (!document.hidden) {
                recordInteraction();
            } else {
                helper.evaluateStatus(component, tracker, true);
            }
        });

        tracker.beforeUnloadHandler = function() {
            helper.sendBeacon(tracker, 'offline');
        };
        window.addEventListener('beforeunload', tracker.beforeUnloadHandler);

        tracker.intervalId = window.setInterval(function() {
            helper.evaluateStatus(component, tracker, false);
        }, tracker.checkIntervalMs);

        window._workTimerHubTracker = tracker;

        // Send initial active status immediately
        tracker.currentStatus = 'active';
        helper.sendStatus(component, tracker, 'active', true);
    },

    evaluateStatus: function(component, tracker, forceHeartbeat) {
        if (!tracker) {
            return;
        }

        var now = Date.now();
        var diff = now - tracker.lastInteraction;
        var status;

        if (document.hidden && diff > tracker.activeThreshold) {
            status = diff > tracker.awayThreshold ? 'away' : 'idle';
        } else if (diff <= tracker.activeThreshold) {
            status = 'active';
        } else if (diff <= tracker.awayThreshold) {
            status = 'idle';
        } else {
            status = 'away';
        }

        var statusChanged = status !== tracker.currentStatus;
        var heartbeatExpired = (now - tracker.lastSentAt) >= tracker.heartbeatMs;

        if (statusChanged) {
            tracker.currentStatus = status;
        }

        if (statusChanged || heartbeatExpired || forceHeartbeat) {
            this.sendStatus(component, tracker, status, statusChanged || forceHeartbeat);
        }
    },

    sendStatus: function(component, tracker, status, force) {
        if (!tracker || !status) {
            return;
        }

        var now = Date.now();
        if (!force && tracker.lastSentStatus === status && (now - tracker.lastSentAt) < tracker.heartbeatMs) {
            return;
        }

        if (tracker.pending) {
            return;
        }

        tracker.pending = true;

        var action = component.get("c.updateActivity");
        action.setParams({ status: status });
        action.setCallback(this, function(response) {
            tracker.pending = false;

            if (response.getState() === "SUCCESS") {
                tracker.lastSentStatus = status;
                tracker.lastSentAt = Date.now();
            } else {
                console.error('updateActivity failed', response.getError());
            }
        });
        $A.enqueueAction(action);
    },

    sendBeacon: function(tracker, status) {
        try {
            if (!tracker || !tracker.userEmail || !status) {
                return;
            }

            var payload = JSON.stringify({
                email: tracker.userEmail,
                status: status
            });

            var endpoint = 'https://work-timer-hub.vercel.app/api/update-activity';

            if (navigator.sendBeacon) {
                navigator.sendBeacon(endpoint, payload);
            } else {
                fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    keepalive: true,
                    mode: 'cors'
                });
            }
        } catch (error) {
            console.error('Failed to send offline beacon', error);
        }
    },

    teardown: function(component) {
        var tracker = window._workTimerHubTracker;
        if (!tracker) {
            return;
        }

        if (tracker.intervalId) {
            window.clearInterval(tracker.intervalId);
        }

        if (tracker.listeners && tracker.listeners.length) {
            tracker.listeners.forEach(function(removeListener) {
                try {
                    removeListener();
                } catch (e) {
                    // ignore
                }
            });
        }

        if (tracker.beforeUnloadHandler) {
            window.removeEventListener('beforeunload', tracker.beforeUnloadHandler);
        }

        delete window._workTimerHubTracker;
    }
})

