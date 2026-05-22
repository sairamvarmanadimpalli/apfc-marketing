# Setup sairam@deepandwide.in as Gmail Sender

Follow these steps to send automated quotes from `sairam@deepandwide.in`:

## Step 1: Access Gmail Settings

1. Open Gmail: https://mail.google.com
2. Click the **Settings** gear icon (top right)
3. Click **See all settings**
4. Go to the **Accounts and Import** tab

## Step 2: Add Email Alias

1. Under "**Send mail as**" section, click **Add another email address**
2. A popup window will appear

## Step 3: Enter Email Details

In the popup:
- **Name:** `Deep & Wide Technologies`
- **Email address:** `sairam@deepandwide.in`
- ☑️ **Check:** "Treat as an alias"
- Click **Next Step**

## Step 4: SMTP Configuration

You'll need SMTP settings for deepandwide.in email:

### Option A: If using Gmail/Google Workspace for deepandwide.in

- **SMTP Server:** `smtp.gmail.com`
- **Port:** `587`
- **Username:** `sairam@deepandwide.in`
- **Password:** Your email password (or app-specific password)

### Option B: If using another email provider (Zoho, etc.)

Ask your email provider for:
- SMTP server address
- Port (usually 587 or 465)
- Username
- Password

**For Zoho Mail:**
- **SMTP Server:** `smtp.zoho.in`
- **Port:** `587`
- **Username:** `sairam@deepandwide.in`
- **Password:** Your Zoho password

## Step 5: Verify Email

1. After entering SMTP settings, click **Add Account**
2. Gmail will send a verification code to `sairam@deepandwide.in`
3. Check that inbox for the verification email
4. Click the verification link OR enter the code in Gmail
5. Click **Confirm**

## Step 6: Set as Default (Optional)

1. Back in Gmail Settings → Accounts
2. Find `sairam@deepandwide.in` in the "Send mail as" list
3. Click **make default** next to it
4. All emails will now send from this address by default

## Step 7: Update Apps Script

1. Open your Apps Script: https://script.google.com/u/0/home/projects/14Yp0DNhoBj55G64r9DEbwr7YesUhcES4jLszSywXIyOpQZqUTi85GIpV/edit
2. Find this line (around line 340):

```javascript
// from: "sairam@deepandwide.in"
```

3. Uncomment it (remove the `//`):

```javascript
from: "sairam@deepandwide.in"
```

4. **Save** the file (Ctrl+S)
5. **Redeploy** (Deploy → Manage deployments → Edit → New version → Deploy)

## Verification

Send a test email to check:

1. In Apps Script, find the `sendQuoteEmail` function
2. Click **Run** to test
3. Check your own email to see if it's from `sairam@deepandwide.in`

## Troubleshooting

### "Couldn't verify account"

**Solutions:**
1. Check SMTP credentials are correct
2. Enable "Less secure app access" for the email (if using basic Gmail)
3. Use an **App-specific password** instead:
   - Go to your email account security settings
   - Generate an app-specific password
   - Use that instead of your regular password

### "Authentication failed"

**Solutions:**
1. Double-check username/password
2. Verify SMTP server and port are correct
3. Check if 2-factor authentication is enabled (requires app password)

### Emails still showing wrong sender

**Solutions:**
1. Verify the email alias is confirmed (green checkmark in Gmail settings)
2. Check the `from` line is uncommented in the script
3. Redeploy the script with new version
4. Clear your browser cache

## Security Tips

✅ **Use App-Specific Passwords** - Don't use your main email password
✅ **Enable 2FA** - Keep your email account secure
✅ **Rotate Passwords** - Change app passwords periodically

## Quick Reference

**Current Setup:**
- Sender Name: `Deep & Wide Technologies`
- Sender Email: `sairam@deepandwide.in`
- Reply-To: (same as sender)

**Email Providers:**
- Gmail: smtp.gmail.com:587
- Zoho: smtp.zoho.in:587
- Outlook: smtp.office365.com:587

---

Once configured, all automated quote emails will appear to come from:
**Deep & Wide Technologies <sairam@deepandwide.in>**
