// Content script for Salesforce Activity Tracker
// Runs on all Salesforce pages and tracks user activity

console.log('[Content] Salesforce Activity Tracker loaded');

let userEmail = null;
let promptElement = null;

// Get user email from Salesforce
function getUserEmail() {
  // Try multiple methods to get user email from Salesforce
  
  // Method 1: Check global Salesforce variables
  if (window.$A && window.$A.get) {
    try {
      const user = window.$A.get('$SObjectType.CurrentUser');
      if (user && user.Email) {
        return user.Email;
      }
    } catch (e) {
      console.log('[Content] Method 1 failed:', e);
    }
  }
  
  // Method 2: Check for user info in DOM
  const userMenuButton = document.querySelector('[data-target-selection-name="sfdc:StandardButton.User"]');
  if (userMenuButton) {
    const ariaLabel = userMenuButton.getAttribute('aria-label');
    if (ariaLabel) {
      // Extract email from aria-label if present
      const emailMatch = ariaLabel.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        return emailMatch[0];
      }
    }
  }
  
  // Method 3: Try to get from user profile menu
  const profileLink = document.querySelector('a[href*="/profile/"]');
  if (profileLink) {
    const title = profileLink.getAttribute('title');
    if (title) {
      const emailMatch = title.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        return emailMatch[0];
      }
    }
  }
  
  // Method 4: Check localStorage/sessionStorage
  try {
    const storedEmail = localStorage.getItem('salesforce_user_email') || 
                       sessionStorage.getItem('salesforce_user_email');
    if (storedEmail) {
      return storedEmail;
    }
  } catch (e) {
    console.log('[Content] Method 4 failed:', e);
  }
  
  // Method 5: Prompt user to enter email (fallback)
  return null;
}

// Initialize email detection
function initEmailDetection() {
  // Try to get email immediately
  userEmail = getUserEmail();
  
  if (userEmail) {
    console.log('[Content] User email detected:', userEmail);
    chrome.runtime.sendMessage({
      type: 'USER_EMAIL',
      email: userEmail
    });
  } else {
    // If not found, try again after a delay (page might still be loading)
    setTimeout(() => {
      userEmail = getUserEmail();
      if (userEmail) {
        console.log('[Content] User email detected (delayed):', userEmail);
        chrome.runtime.sendMessage({
          type: 'USER_EMAIL',
          email: userEmail
        });
      } else {
        // Last resort: prompt user
        promptForEmail();
      }
    }, 3000);
  }
}

// Prompt user to enter their email
function promptForEmail() {
  const email = prompt('Salesforce Activity Tracker needs your email address to function properly.\n\nPlease enter your work email:');
  if (email && email.includes('@')) {
    userEmail = email;
    // Store for future use
    try {
      localStorage.setItem('salesforce_user_email', email);
    } catch (e) {
      console.log('[Content] Could not store email:', e);
    }
    chrome.runtime.sendMessage({
      type: 'USER_EMAIL',
      email: userEmail
    });
  } else {
    console.error('[Content] Invalid email provided');
  }
}

// Track activity
function trackActivity() {
  chrome.runtime.sendMessage({
    type: 'ACTIVITY_DETECTED'
  });
}

// Debounce function to limit activity tracking frequency
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Debounced activity tracker (max once per second)
const debouncedTrackActivity = debounce(trackActivity, 1000);

// Listen for user activity
document.addEventListener('mousemove', debouncedTrackActivity);
document.addEventListener('keydown', debouncedTrackActivity);
document.addEventListener('click', debouncedTrackActivity);
document.addEventListener('scroll', debouncedTrackActivity);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content] Received message:', message);
  
  if (message.type === 'SHOW_IDLE_PROMPT') {
    showIdlePrompt();
    sendResponse({ success: true });
  } else if (message.type === 'HIDE_IDLE_PROMPT') {
    hideIdlePrompt();
    sendResponse({ success: true });
  }
  
  return true;
});

// Show idle prompt
function showIdlePrompt() {
  if (promptElement) {
    return; // Already showing
  }
  
  console.log('[Content] Showing idle prompt');
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'salesforce-activity-tracker-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 32px;
    max-width: 500px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    text-align: center;
  `;
  
  // Create content
  modal.innerHTML = `
    <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #333;">Are you still working?</h2>
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #666;">
      We haven't detected any activity for 10 minutes.
    </p>
    <div id="countdown-timer" style="font-size: 48px; font-weight: bold; color: #0176d3; margin: 24px 0;">0:30</div>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #999;">
      You will be marked as idle if you don't respond.
    </p>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="still-working-btn" style="
        background: #0176d3;
        color: white;
        border: none;
        padding: 12px 24px;
        font-size: 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
      ">Yes, I'm here</button>
      <button id="done-working-btn" style="
        background: #f3f3f3;
        color: #333;
        border: 1px solid #ddd;
        padding: 12px 24px;
        font-size: 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
      ">No, I'm done</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  promptElement = overlay;

  // Start countdown
  let timeLeft = 30; // 30 seconds
  const countdownElement = modal.querySelector('#countdown-timer');

  const countdownInterval = setInterval(() => {
    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
    }
  }, 1000);
  
  // Add event listeners
  modal.querySelector('#still-working-btn').addEventListener('click', () => {
    clearInterval(countdownInterval);
    chrome.runtime.sendMessage({
      type: 'PROMPT_RESPONSE',
      stillWorking: true
    });
  });
  
  modal.querySelector('#done-working-btn').addEventListener('click', () => {
    clearInterval(countdownInterval);
    chrome.runtime.sendMessage({
      type: 'PROMPT_RESPONSE',
      stillWorking: false
    });
  });
  
  // Store interval for cleanup
  overlay.countdownInterval = countdownInterval;
}

// Hide idle prompt
function hideIdlePrompt() {
  if (promptElement) {
    console.log('[Content] Hiding idle prompt');
    
    // Clear countdown interval
    if (promptElement.countdownInterval) {
      clearInterval(promptElement.countdownInterval);
    }
    
    promptElement.remove();
    promptElement = null;
  }
}

// Initialize
initEmailDetection();

// Send initial activity signal
trackActivity();

console.log('[Content] Activity tracking initialized');

