# Admin Guide - Salesforce Activity Tracker Extension

## Overview

This browser extension automatically tracks employee activity in Salesforce and sends status updates to your API at `work-timer-hub.vercel.app`.

---

## What You Have

1. **Browser Extension** - Runs on employee browsers
2. **API Endpoint** - Already deployed at `https://work-timer-hub.vercel.app/api/update-activity`
3. **Database** - Supabase database storing activity data

---

## How to Deploy to Employees

### Option 1: Direct Distribution (Fastest)

1. **Send them the ZIP file**:
   - File: `salesforce-activity-tracker-extension.zip`
   - Include: `INSTALLATION_GUIDE.md`

2. **Have them install**:
   - Unzip the file
   - Go to `chrome://extensions`
   - Enable Developer Mode
   - Click "Load unpacked"
   - Select the folder

**Pros:**
- ✅ Instant deployment
- ✅ No approval process
- ✅ Free

**Cons:**
- ❌ Manual installation per employee
- ❌ No auto-updates
- ❌ Looks less professional

---

### Option 2: Chrome Web Store (Most Professional)

1. **Create Chrome Web Store account**:
   - Go to: https://chrome.google.com/webstore/devconsole
   - Pay $5 one-time developer fee
   - Verify your email

2. **Prepare for submission**:
   - Create promotional images (screenshots, logo)
   - Write description (see template below)
   - Set privacy policy URL

3. **Upload extension**:
   - Zip the extension folder
   - Upload to Chrome Web Store
   - Fill in all required fields
   - Submit for review (1-3 days)

4. **Share with employees**:
   - Send them the Chrome Web Store link
   - They install with one click
   - Auto-updates when you push changes

**Pros:**
- ✅ One-click installation
- ✅ Auto-updates
- ✅ Professional appearance
- ✅ Trusted by employees

**Cons:**
- ❌ $5 fee
- ❌ 1-3 day review process
- ❌ Must follow Chrome Web Store policies

---

## Chrome Web Store Description Template

**Title:**
```
Salesforce Activity Tracker - Automatic Time Tracking
```

**Short Description:**
```
Automatically track employee activity in Salesforce with idle detection and productivity monitoring.
```

**Detailed Description:**
```
Salesforce Activity Tracker automatically monitors employee activity in Salesforce and helps track productivity.

FEATURES:
• Automatic activity tracking - no manual clock-in required
• Idle detection after 30 minutes of inactivity
• "Are you still working?" prompt with 10-minute response window
• Real-time status updates to your management dashboard
• Works silently in the background
• Privacy-focused - only tracks activity, not content

HOW IT WORKS:
1. Install the extension
2. Open Salesforce - tracking starts automatically
3. Work normally - extension runs silently
4. After 30 min idle - popup asks if you're still working
5. Respond or ignore - status updates automatically

PRIVACY:
• Only works on Salesforce pages
• Tracks activity (mouse/keyboard), not content
• No keystroke logging or screenshots
• No tracking on other websites

For enterprise use only. Contact your administrator for installation instructions.
```

**Category:**
- Productivity

**Language:**
- English

---

## Configuration

### Change Timers

Edit `background.js`:

```javascript
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // How often to send "active" status
const IDLE_TIMEOUT = 30 * 60 * 1000; // How long before showing popup
const PROMPT_TIMEOUT = 10 * 60 * 1000; // How long to wait for response
```

### Change API Endpoint

Edit `background.js`:

```javascript
const API_ENDPOINT = 'https://your-domain.com/api/update-activity';
```

### Customize Popup Appearance

Edit `content.js` in the `showIdlePrompt()` function to change colors, text, etc.

---

## Testing Before Deployment

### Quick Test (Reduce Timers):

1. Edit `background.js`:
   ```javascript
   const IDLE_TIMEOUT = 30 * 1000; // 30 seconds
   const PROMPT_TIMEOUT = 20 * 1000; // 20 seconds
   ```

2. Load extension in Chrome
3. Open Salesforce
4. Wait 30 seconds without moving mouse
5. Popup should appear
6. Wait 20 more seconds
7. Check database - should show "idle" status

**Don't forget to change timers back to production values!**

---

## Monitoring & Analytics

### Check API Logs:

1. Go to Vercel dashboard
2. Select `work-timer-hub` project
3. Click "Logs"
4. Filter for `/api/update-activity`
5. See all status updates in real-time

### Check Database:

1. Go to Supabase dashboard
2. Open your database
3. Query the activity table:
   ```sql
   SELECT * FROM employee_activity 
   ORDER BY updated_at DESC 
   LIMIT 100;
   ```

### Build a Dashboard (Future):

You can build a real-time dashboard showing:
- All employees and their current status
- Last activity timestamp
- Total active time today
- Idle time per employee
- Activity trends over time

---

## Pricing Strategy

### Suggested Pricing:

**Setup Fee:** $500-1,000 one-time
- Extension development ✅ (already done)
- Installation support
- Training session
- Custom configuration

**Monthly Fee:** $8-15 per employee
- Ongoing support
- Data storage
- Updates and improvements
- 20 employees = $160-300/month

**Add-Ons:**
- Custom dashboard: $300-500
- Screenshot capture: $200
- Slack/email alerts: $150
- Custom reports: $100-200
- Additional integrations: $200-500 each

### Example Proposal:

```
SALESFORCE ACTIVITY TRACKER
Professional Employee Productivity Monitoring

SETUP (One-Time):
- Browser extension development: $750
- Installation & training: Included
- Custom configuration: Included
Total: $750

MONTHLY SUBSCRIPTION:
- 20 employees × $10/employee = $200/month
- Includes: Activity tracking, idle detection, API hosting, data storage, support

OPTIONAL ADD-ONS:
- Real-time dashboard: $400 one-time
- Manager email alerts: $150 one-time
- Weekly reports: $100 one-time

YEAR 1 TOTAL: $750 + ($200 × 12) = $3,150
YEAR 2+ TOTAL: $200 × 12 = $2,400/year
```

---

## Upsell Opportunities

Once they're using it, you can offer:

1. **Screenshot Capture** ($200)
   - Takes screenshot when idle timer starts
   - Stores in database for review
   - Proof of inactivity

2. **Manager Dashboard** ($300-500)
   - Real-time view of all employees
   - Status indicators (green/red)
   - Historical reports
   - Export to Excel

3. **Slack Integration** ($150)
   - Sends alerts when employee goes idle
   - Daily summary reports
   - Real-time notifications

4. **Advanced Analytics** ($200)
   - Productivity trends
   - Time-per-page tracking
   - Comparison reports
   - Custom metrics

5. **Calendar Sync** ($150)
   - Auto-clock out during meetings
   - Respect "Out of office" status
   - Vacation time handling

---

## Support & Maintenance

### Common Employee Questions:

**"Why do I need this?"**
- It's for automatic time tracking so you don't have to manually clock in/out

**"Is it spying on me?"**
- No, it only tracks that you're active, not what you're doing
- No keystroke logging or screenshots (unless you add that feature)

**"What if I forget to respond to the popup?"**
- You'll be marked as idle, but it automatically marks you active again when you resume

**"Can I disable it?"**
- Technically yes, but it's required for time tracking per company policy

### Troubleshooting:

Most issues are solved by:
1. Reloading the extension
2. Refreshing the Salesforce page
3. Checking browser console for errors

---

## Legal & Privacy

### Privacy Policy (Required for Chrome Web Store):

You'll need a privacy policy that states:
- What data is collected (email, activity status, timestamps)
- How it's used (time tracking, productivity monitoring)
- Where it's stored (your Supabase database)
- Who has access (company administrators)
- How to opt-out (contact administrator)

### Employee Consent:

Recommended to:
- Inform employees about the tracking
- Get written consent (or include in employment agreement)
- Be transparent about what's tracked
- Comply with local labor laws

---

## Next Steps

1. **Test the extension yourself**:
   - Install it in your browser
   - Test on Salesforce
   - Verify API calls are working
   - Check database updates

2. **Pilot with small group**:
   - Install on 2-3 employees
   - Monitor for 1 week
   - Fix any issues
   - Get feedback

3. **Full deployment**:
   - Send installation guide to all employees
   - Provide support during installation
   - Monitor for issues

4. **Build dashboard** (optional):
   - Create admin interface
   - Show real-time status
   - Generate reports

---

## Files Included

- `manifest.json` - Extension configuration
- `background.js` - Background service worker (timers, API calls)
- `content.js` - Content script (activity tracking, popup)
- `icon16.png`, `icon48.png`, `icon128.png` - Extension icons
- `README.md` - Technical documentation
- `INSTALLATION_GUIDE.md` - Employee installation guide
- `ADMIN_GUIDE.md` - This file

---

## Questions?

If you need help:
1. Check the README.md for technical details
2. Test with reduced timers (30 seconds instead of 30 minutes)
3. Check browser console for error messages
4. Verify API endpoint is accessible
5. Check Salesforce Remote Site Settings and CSP Trusted Sites

---

**You're all set!** The extension is ready to deploy. 🚀

