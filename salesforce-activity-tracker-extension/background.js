// Background service worker for Salesforce Activity Tracker
// Manages timers, API calls, and communication with content scripts

const API_ENDPOINT = 'https://work-timer-hub.vercel.app/api/update-activity';
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const PROMPT_TIMEOUT = 30 * 1000; // 30 seconds to respond

let activityState = {
  userEmail: null,
  lastActivity: Date.now(),
  isActive: false,
  idleTimerId: null,
  heartbeatTimerId: null,
  promptTimerId: null,
  promptShown: false,
  // Idle time tracking
  idleStartTime: null,
  totalIdleSeconds: 0,
  idleHeartbeatTimerId: null
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Received message:', message);
  
  if (message.type === 'ACTIVITY_DETECTED') {
    handleActivity(sender.tab.id);
    sendResponse({ success: true });
  } else if (message.type === 'USER_EMAIL') {
    activityState.userEmail = message.email;
    console.log('[Background] User email set:', message.email);
    sendResponse({ success: true });
  } else if (message.type === 'PROMPT_RESPONSE') {
    handlePromptResponse(message.stillWorking, sender.tab.id);
    sendResponse({ success: true });
  } else if (message.type === 'GET_STATE') {
    sendResponse({ state: activityState });
  }
  
  return true; // Keep channel open for async response
});

// Handle activity detection
function handleActivity(tabId) {
  const now = Date.now();
  activityState.lastActivity = now;

  // Reset idle tracking when user becomes active
  activityState.idleStartTime = null;

  // If was idle or first activity, mark as active
  if (!activityState.isActive) {
    activityState.isActive = true;
    sendStatusUpdate('active');
  }

  // Clear idle heartbeat if running
  if (activityState.idleHeartbeatTimerId) {
    clearInterval(activityState.idleHeartbeatTimerId);
    activityState.idleHeartbeatTimerId = null;
  }

  // Reset idle timer
  if (activityState.idleTimerId) {
    clearTimeout(activityState.idleTimerId);
  }

  // Start new idle timer
  activityState.idleTimerId = setTimeout(() => {
    handleIdleTimeout(tabId);
  }, IDLE_TIMEOUT);

  // Start heartbeat if not already running
  if (!activityState.heartbeatTimerId) {
    startHeartbeat();
  }

  // Hide prompt if it was showing
  if (activityState.promptShown) {
    hidePrompt(tabId);
  }
}

// Handle idle timeout (10 minutes of inactivity)
function handleIdleTimeout(tabId) {
  console.log('[Background] Idle timeout reached, showing prompt');
  activityState.promptShown = true;

  // Mark when idle period started (when they crossed the threshold)
  if (!activityState.idleStartTime) {
    activityState.idleStartTime = activityState.lastActivity;
  }

  // Show prompt to user
  chrome.tabs.sendMessage(tabId, {
    type: 'SHOW_IDLE_PROMPT'
  });

  // Start prompt timeout (30 seconds)
  activityState.promptTimerId = setTimeout(() => {
    handlePromptTimeout(tabId);
  }, PROMPT_TIMEOUT);
}

// Handle prompt timeout (user didn't respond in 30 seconds)
function handlePromptTimeout(tabId) {
  console.log('[Background] Prompt timeout - marking as idle');
  markAsIdle(tabId);
}

// Handle user response to prompt
function handlePromptResponse(stillWorking, tabId) {
  console.log('[Background] User response:', stillWorking ? 'Still working' : 'Done working');
  
  // Clear prompt timer
  if (activityState.promptTimerId) {
    clearTimeout(activityState.promptTimerId);
    activityState.promptTimerId = null;
  }
  
  activityState.promptShown = false;
  
  if (stillWorking) {
    // User is still working - reset activity
    handleActivity(tabId);
  } else {
    // User is done - mark as idle
    markAsIdle(tabId);
  }
  
  // Hide the prompt
  hidePrompt(tabId);
}

// Mark user as idle
function markAsIdle(tabId) {
  activityState.isActive = false;
  activityState.promptShown = false;

  // Calculate idle time - from when they became idle to now
  const now = Date.now();
  if (!activityState.idleStartTime) {
    // Set idle start time to when they crossed the threshold
    activityState.idleStartTime = activityState.lastActivity;
  }

  const idleElapsedMs = now - activityState.idleStartTime;
  const idleElapsedSeconds = Math.floor(idleElapsedMs / 1000);
  activityState.totalIdleSeconds += idleElapsedSeconds;

  console.log(`[Background] Marking as idle. Elapsed: ${idleElapsedSeconds}s, Total: ${activityState.totalIdleSeconds}s`);

  // Clear all timers
  if (activityState.idleTimerId) {
    clearTimeout(activityState.idleTimerId);
    activityState.idleTimerId = null;
  }
  if (activityState.heartbeatTimerId) {
    clearInterval(activityState.heartbeatTimerId);
    activityState.heartbeatTimerId = null;
  }
  if (activityState.idleHeartbeatTimerId) {
    clearInterval(activityState.idleHeartbeatTimerId);
    activityState.idleHeartbeatTimerId = null;
  }
  if (activityState.promptTimerId) {
    clearTimeout(activityState.promptTimerId);
    activityState.promptTimerId = null;
  }

  // Send idle status to API with cumulative idle time
  sendStatusUpdate('idle', activityState.totalIdleSeconds);

  // Start idle heartbeat to send periodic updates
  startIdleHeartbeat();

  // Hide prompt if showing
  hidePrompt(tabId);
}

// Hide the idle prompt
function hidePrompt(tabId) {
  chrome.tabs.sendMessage(tabId, {
    type: 'HIDE_IDLE_PROMPT'
  }).catch(err => {
    console.log('[Background] Could not hide prompt:', err);
  });
}

// Start heartbeat interval
function startHeartbeat() {
  if (activityState.heartbeatTimerId) {
    clearInterval(activityState.heartbeatTimerId);
  }

  activityState.heartbeatTimerId = setInterval(() => {
    if (activityState.isActive) {
      sendStatusUpdate('active');
    }
  }, HEARTBEAT_INTERVAL);
}

// Start idle heartbeat to send periodic updates while idle
function startIdleHeartbeat() {
  // Clear existing idle heartbeat if any
  if (activityState.idleHeartbeatTimerId) {
    clearInterval(activityState.idleHeartbeatTimerId);
  }

  activityState.idleHeartbeatTimerId = setInterval(() => {
    if (!activityState.isActive && activityState.idleStartTime) {
      // Calculate cumulative idle time
      const now = Date.now();
      const idleElapsedMs = now - activityState.idleStartTime;
      const idleElapsedSeconds = Math.floor(idleElapsedMs / 1000);

      // Update total and reset start time for next interval
      activityState.totalIdleSeconds += idleElapsedSeconds;
      activityState.idleStartTime = now;

      // Send updated idle time
      sendStatusUpdate('idle', activityState.totalIdleSeconds);
      console.log(`[Background] Idle heartbeat - Total idle: ${activityState.totalIdleSeconds}s`);
    }
  }, HEARTBEAT_INTERVAL);
}

// Send status update to API
async function sendStatusUpdate(status, idleSeconds) {
  if (!activityState.userEmail) {
    console.log('[Background] No user email set, skipping API call');
    return;
  }

  const payload = {
    email: activityState.userEmail,
    status: status
  };

  // Include idle_seconds if provided and status is idle
  if (idleSeconds !== undefined && idleSeconds !== null && status === 'idle') {
    payload.idle_seconds = idleSeconds;
  }

  console.log(`[Background] Sending ${status} status for ${activityState.userEmail}`, payload);

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('[Background] API response:', data);
  } catch (error) {
    console.error('[Background] Error sending status update:', error);
  }
}

// Listen for tab updates to detect Salesforce pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isSalesforce = tab.url.includes('salesforce.com') || tab.url.includes('force.com');
    if (isSalesforce) {
      console.log('[Background] Salesforce page loaded:', tab.url);
    }
  }
});

console.log('[Background] Salesforce Activity Tracker initialized');

