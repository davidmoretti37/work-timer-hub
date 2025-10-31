# Salesforce Activity Tracker - Browser Extension

Automatically track employee activity in Salesforce and detect idle time.

## Features

- ✅ **Automatic Activity Tracking** - Tracks mouse, keyboard, and click activity on all Salesforce pages
- ✅ **Idle Detection** - Detects 30 minutes of inactivity
- ✅ **"Are You Still Working?" Prompt** - Shows popup after 30 minutes of idle time
- ✅ **10-Minute Response Window** - Gives employees 10 minutes to respond
- ✅ **Automatic Status Updates** - Sends active/idle status to your API every 5 minutes
- ✅ **Works on All Salesforce Pages** - No configuration needed
- ✅ **Cross-Browser Support** - Works on Chrome, Edge, Brave, Opera, and other Chromium browsers

## Installation

### Method 1: Install Unpacked Extension (For Testing)

1. **Download the extension folder** to your computer

2. **Open Chrome/Edge**:
   - Chrome: Go to `chrome://extensions`
   - Edge: Go to `edge://extensions`

3. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**:
   - Click "Load unpacked"
   - Select the `salesforce-activity-tracker-extension` folder
   - Click "Select Folder"

5. **Verify installation**:
   - You should see "Salesforce Activity Tracker" in your extensions list
   - The extension icon should appear in your browser toolbar

### Method 2: Install from ZIP (For Distribution)

1. **Package the extension**:
   - Zip the entire `salesforce-activity-tracker-extension` folder
   - Name it `salesforce-activity-tracker.zip`

2. **Distribute to employees**:
   - Send them the ZIP file
   - Have them follow Method 1 above (unzip first, then load unpacked)

### Method 3: Publish to Chrome Web Store (Most Professional)

1. **Create a Chrome Web Store developer account** ($5 one-time fee)
   - Go to: https://chrome.google.com/webstore/devconsole

2. **Upload the extension**:
   - Zip the extension folder
   - Upload to Chrome Web Store
   - Fill in description, screenshots, etc.
   - Submit for review (takes 1-3 days)

3. **Share the store link with employees**:
   - They can install with one click
   - Auto-updates when you push changes

## How It Works

### For Employees:

1. **Install the extension** (one-time, 30 seconds)
2. **Open Salesforce** - Extension automatically starts tracking
3. **Work normally** - Extension is invisible, runs in background
4. **After 30 min idle** - Popup appears: "Are you still working?"
5. **Respond or ignore** - Click "Yes, I'm here" or let it timeout

### For Admins:

1. **View real-time status** in your work-timer-hub dashboard
2. **See activity updates** every 5 minutes
3. **Track idle/active time** per employee
4. **Export reports** (if you build this feature)

## Configuration

### Change API Endpoint

If your API endpoint changes, edit `background.js`:

```javascript
const API_ENDPOINT = 'https://your-new-endpoint.com/api/update-activity';
```

### Change Timers

Edit these values in `background.js`:

```javascript
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes (in milliseconds)
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const PROMPT_TIMEOUT = 10 * 60 * 1000; // 10 minutes
```

### Customize Popup Appearance

Edit the styles in `content.js` in the `showIdlePrompt()` function.

## Testing

### Test Activity Tracking:

1. Install the extension
2. Open Salesforce
3. Open browser console (F12)
4. Look for messages: `[Content] Activity tracking initialized`
5. Move your mouse - should see: `[Background] Received message: ACTIVITY_DETECTED`

### Test Idle Detection:

**Quick Test (Change timers temporarily):**

1. Edit `background.js`:
   ```javascript
   const IDLE_TIMEOUT = 30 * 1000; // 30 seconds (for testing)
   const PROMPT_TIMEOUT = 20 * 1000; // 20 seconds (for testing)
   ```

2. Reload the extension in `chrome://extensions`
3. Open Salesforce
4. Don't move mouse for 30 seconds
5. Popup should appear
6. Wait 20 more seconds without clicking
7. Check your database - status should be "idle"

**Remember to change timers back to production values!**

### Test API Calls:

1. Open browser console (F12)
2. Go to Network tab
3. Filter for "update-activity"
4. Should see POST requests every 5 minutes
5. Check response is 200 OK

## Troubleshooting

### Extension not loading:

- Make sure Developer Mode is enabled
- Try reloading the extension in `chrome://extensions`
- Check console for errors

### No activity detected:

- Check console for `[Content] Activity tracking initialized`
- Make sure you're on a Salesforce page (*.salesforce.com or *.force.com)
- Try refreshing the page

### API calls failing:

- Check Network tab for errors
- Verify API endpoint is correct in `background.js`
- Check CORS settings on your API
- Verify Remote Site Settings and CSP Trusted Sites in Salesforce

### Email not detected:

- Extension will prompt user to enter email manually
- Email is stored in localStorage for future use
- You can pre-configure emails if needed

## Privacy & Security

- ✅ **Only runs on Salesforce pages** - Doesn't track other websites
- ✅ **No keystroke logging** - Only detects that activity happened, not what was typed
- ✅ **No screenshots** - Only tracks mouse/keyboard events
- ✅ **Minimal data collection** - Only sends email and status (active/idle)
- ✅ **Local storage only** - No data stored on external servers (except your API)

## Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome | ✅ Works | Fully supported |
| Edge | ✅ Works | Fully supported (Chromium-based) |
| Brave | ✅ Works | Fully supported |
| Opera | ✅ Works | Fully supported |
| Vivaldi | ✅ Works | Fully supported |
| Firefox | ⚠️ Needs tweaks | Manifest V2 version needed |
| Safari | ❌ Not supported | Would need conversion |

## Future Enhancements

Possible features to add:

- 📊 **Dashboard** - View all employees' status in real-time
- 📸 **Screenshot on idle** - Capture screen when idle timer starts
- 📧 **Email notifications** - Alert managers when employees go idle
- 📈 **Analytics** - Track productivity trends over time
- ⏱️ **Time tracking** - Automatic timesheet generation
- 🔔 **Break reminders** - Remind employees to take breaks
- 🎯 **Focus mode** - Block distracting websites during work hours

## Support

For issues or questions:
1. Check console logs for error messages
2. Verify all settings are correct
3. Test with reduced timers (30 seconds instead of 30 minutes)
4. Contact your administrator

## License

Proprietary - For internal use only

## Version History

- **v1.0.0** (2025-10-28) - Initial release
  - Activity tracking
  - Idle detection
  - "Are you still working?" prompt
  - API integration

