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
            lastSentStatus: null,
            lastSentAt: 0,
            activityFlag: true,
            heartbeatMs: 5 * 60 * 1000,
            idleThresholdMs: 30 * 60 * 1000,
            idleTimeoutMs: 10 * 60 * 1000,
            listeners: [],
            intervalId: null,
            pending: false,
            beforeUnloadHandler: null,
            idlePromptActive: false,
            idlePromptDeadline: null,
            idlePromptInterval: null,
            idlePromptTimeout: null,
            idlePromptBody: null,
            idlePromptClose: null,
            currentStatus: 'active'
        };

        var recordInteraction = function() {
            tracker.lastInteraction = Date.now();
            tracker.activityFlag = true;
            if (!tracker.idlePromptActive) {
                helper.evaluateStatus(component, tracker, true);
            }
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
        addListener(window, 'click', recordInteraction, true);
        addListener(window, 'keydown', recordInteraction, true);
        addListener(window, 'touchstart', recordInteraction, true);

        addListener(document, 'visibilitychange', function() {
            if (!document.hidden) {
                recordInteraction();
            }
        });

        tracker.beforeUnloadHandler = function() {
            helper.sendBeacon(tracker, 'offline');
        };
        window.addEventListener('beforeunload', tracker.beforeUnloadHandler);

        tracker.intervalId = window.setInterval(function() {
            helper.evaluateStatus(component, tracker, false);
        }, 60000);

        window._workTimerHubTracker = tracker;

        helper.sendStatus(component, tracker, 'active', true);
    },

    evaluateStatus: function(component, tracker, triggeredByInteraction) {
        if (!tracker) {
            return;
        }

        var now = Date.now();
        var diff = now - tracker.lastInteraction;

        if (tracker.idlePromptActive) {
            this.updateIdleCountdown(component, tracker);
            return;
        }

        if (diff >= tracker.idleThresholdMs) {
            this.showIdlePrompt(component, tracker);
            return;
        }

        var heartbeatExpired = (now - tracker.lastSentAt) >= tracker.heartbeatMs;
        if (tracker.activityFlag || heartbeatExpired || triggeredByInteraction) {
            tracker.currentStatus = 'active';
            this.sendStatus(component, tracker, 'active', tracker.activityFlag || triggeredByInteraction);
        }
    },

    sendStatus: function(component, tracker, status, force) {
        if (!tracker || !status) {
            return;
        }

        var now = Date.now();
        if (!force && tracker.lastSentStatus === status && (now - tracker.lastSentAt) < tracker.heartbeatMs) {
            tracker.activityFlag = false;
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
                tracker.activityFlag = false;
            } else {
                console.error('updateActivity failed', response.getError());
            }
        });
        $A.enqueueAction(action);
    },

    showIdlePrompt: function(component, tracker) {
        var helper = this;
        tracker.idlePromptActive = true;
        tracker.idlePromptDeadline = Date.now() + tracker.idleTimeoutMs;

        $A.createComponent("c:IdlePrompt", {
            countdownLabel: helper.formatCountdown(tracker.idleTimeoutMs),
            onConfirm: component.getReference("c.handleIdleConfirm")
        }, function(content, status) {
            if (status === "SUCCESS") {
                component.find("overlayLib").showCustomModal({
                    header: "Are you still working?",
                    body: content,
                    showCloseButton: false,
                    cssClass: "idle-prompt-modal"
                }).then(function(overlay) {
                    tracker.idlePromptBody = content;
                    tracker.idlePromptClose = function() {
                        overlay.close();
                    };
                    helper.startIdleCountdown(component, tracker);
                });
            } else {
                tracker.idlePromptActive = false;
            }
        });
    },

    startIdleCountdown: function(component, tracker) {
        var helper = this;
        if (tracker.idlePromptInterval) {
            window.clearInterval(tracker.idlePromptInterval);
        }
        if (tracker.idlePromptTimeout) {
            window.clearTimeout(tracker.idlePromptTimeout);
        }

        tracker.idlePromptInterval = window.setInterval(function() {
            helper.updateIdleCountdown(component, tracker);
        }, 1000);

        tracker.idlePromptTimeout = window.setTimeout(function() {
            helper.handleIdleTimeout(component, tracker);
        }, tracker.idleTimeoutMs);
    },

    updateIdleCountdown: function(component, tracker) {
        if (!tracker || !tracker.idlePromptActive) {
            return;
        }

        var remaining = tracker.idlePromptDeadline - Date.now();
        if (remaining < 0) {
            remaining = 0;
        }

        if (tracker.idlePromptBody) {
            tracker.idlePromptBody.set("v.countdownLabel", this.formatCountdown(remaining));
        }

        if (remaining === 0) {
            this.handleIdleTimeout(component, tracker);
        }
    },

    handleIdleConfirm: function(component) {
        var tracker = window._workTimerHubTracker;
        if (!tracker) {
            return;
        }

        this.confirmStillWorking(component, tracker);
    },

    confirmStillWorking: function(component, tracker) {
        tracker.lastInteraction = Date.now();
        tracker.activityFlag = true;
        this.closeIdlePrompt(tracker);
        this.sendStatus(component, tracker, 'active', true);
    },

    handleIdleTimeout: function(component, tracker) {
        if (!tracker || !tracker.idlePromptActive) {
            return;
        }

        this.closeIdlePrompt(tracker);
        tracker.currentStatus = 'idle';
        this.sendStatus(component, tracker, 'idle', true);
        this.showToast(component, 'You have been marked as idle.', 'warning');
    },

    closeIdlePrompt: function(tracker) {
        if (!tracker) {
            return;
        }

        tracker.idlePromptActive = false;

        if (tracker.idlePromptInterval) {
            window.clearInterval(tracker.idlePromptInterval);
            tracker.idlePromptInterval = null;
        }

        if (tracker.idlePromptTimeout) {
            window.clearTimeout(tracker.idlePromptTimeout);
            tracker.idlePromptTimeout = null;
        }

        if (tracker.idlePromptClose) {
            try {
                tracker.idlePromptClose();
            } catch (e) {
                // ignore overlay closing errors
            }
            tracker.idlePromptClose = null;
        }

        tracker.idlePromptBody = null;
        tracker.idlePromptDeadline = null;
    },

    showToast: function(component, message, variant) {
        try {
            var notifLib = component.find("notifLib");
            if (notifLib) {
                notifLib.showToast({
                    title: 'Activity Status',
                    message: message,
                    variant: variant || 'info'
                });
            }
        } catch (error) {
            console.error('Failed to show toast', error);
        }
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

        this.closeIdlePrompt(tracker);

        delete window._workTimerHubTracker;
    },

    formatCountdown: function(ms) {
        var totalSeconds = Math.floor(ms / 1000);
        var minutes = Math.floor(totalSeconds / 60);
        var seconds = totalSeconds % 60;
        return this.pad(minutes) + ':' + this.pad(seconds);
    },

    pad: function(value) {
        return value < 10 ? '0' + value : '' + value;
    }
})

