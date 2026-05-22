# Setup Automated Emails with Zoho Mail

Your email `sairam@deepandwide.in` is managed by Zoho. Follow this guide to send automated quote emails.

---

## 🎯 Two Options to Choose From

### **Option A: Gmail Alias with Zoho SMTP** (Recommended - Easier)
Use Google Apps Script with your Zoho email as an alias

### **Option B: Zoho App Password** (More Secure)
Use Zoho-specific app passwords for authentication

---

## 📧 Option A: Gmail Alias Setup (Recommended)

### Step 1: Get Zoho SMTP Credentials

**Zoho SMTP Settings:**
- **Server:** `smtp.zoho.in`
- **Port:** `587` (TLS) or `465` (SSL)
- **Username:** `sairam@deepandwide.in`
- **Password:** Your Zoho email password

### Step 2: Add Email Alias in Gmail

1. **Open Gmail Settings**
   - Go to: https://mail.google.com/mail/u/0/#settings/accounts
   - Click **Accounts and Import** tab

2. **Add Email Address**
   - Under "Send mail as", click **Add another email address**
   - A popup window appears

3. **Enter Details**
   ```
   Name: Deep & Wide Technologies
   Email address: sairam@deepandwide.in
   ☑️ Treat as an alias
   ```
   - Click **Next Step**

4. **Configure SMTP**
   ```
   SMTP Server: smtp.zoho.in
   Port: 587
   Username: sairam@deepandwide.in
   Password: [Your Zoho password]
   ☑️ Secured connection using TLS
   ```
   - Click **Add Account**

5. **Verify Email**
   - Zoho will send a verification code to `sairam@deepandwide.in`
   - Check your Zoho inbox
   - Click the verification link or enter the code
   - Click **Confirm**

✅ **Done!** Gmail can now send as sairam@deepandwide.in

---

## 🔐 Option B: Use Zoho App Password (More Secure)

If Option A fails due to security restrictions, use an app-specific password:

### Step 1: Generate Zoho App Password

1. **Login to Zoho Mail**
   - Go to: https://mail.zoho.in

2. **Access Security Settings**
   - Click your profile icon (top right)
   - Go to **Account Settings**
   - Click **Security** tab

3. **Generate App Password**
   - Find **Application-Specific Passwords**
   - Click **Generate New Password**
   - Name it: "Google Apps Script"
   - Copy the generated password (e.g., `abcd1234efgh5678`)

### Step 2: Use App Password in Gmail Alias

When adding the email alias in Gmail (Step 2 above):
- Use the **App Password** instead of your regular Zoho password
- Everything else stays the same

---

## 🔧 Update Apps Script Code

After setting up the alias:

1. **Open Apps Script**
   - Visit: https://script.google.com/u/0/home/projects/14Yp0DNhoBj55G64r9DEbwr7YesUhcES4jLszSywXIyOpQZqUTi85GIpV/edit

2. **Copy New Code**
   - Open `AUTOMATED_EMAIL_SCRIPT.gs`
   - Select ALL (Ctrl+A) and Copy (Ctrl+C)

3. **Replace Existing Code**
   - In Apps Script editor, select all code
   - Paste the new code

4. **Uncomment "from" Line**
   - Find line ~340:
   ```javascript
   // from: "sairam@deepandwide.in"
   ```
   - Remove `//` to make it:
   ```javascript
   from: "sairam@deepandwide.in"
   ```

5. **Save and Authorize**
   - Click Save (💾)
   - Click **Run** → Select `doPost` function
   - Click **Run** again
   - **Authorize** when prompted:
     - Click "Review Permissions"
     - Click "Advanced" → "Go to APFC Lead Capture"
     - Click "Allow"

6. **Deploy New Version**
   - Click **Deploy** → **Manage deployments**
   - Click pencil icon ✏️
   - Change version to **New version**
   - Click **Deploy**

✅ **Done!** The script is updated.

---

## 🧪 Testing

### Test the Email Automation

1. **Visit Calculator**
   - https://sairamvarmanadimpalli.github.io/apfc-marketing/calculator/

2. **Fill Form with YOUR Email**
   - Use your own email address for testing
   - Fill all required fields

3. **Submit Quote Request**
   - Click submit button

4. **Check Email**
   - Check your inbox (and spam folder)
   - Email should be from: "Deep & Wide Technologies <sairam@deepandwide.in>"

### Check Execution Logs

1. In Apps Script, click **Executions** (left sidebar)
2. Find the recent execution
3. Look for:
   - ✅ Success: "Quote email sent successfully to [email]"
   - ❌ Error: Check error message for details

---

## ❌ Troubleshooting

### "Could not verify account"

**Solution 1: Check SMTP Settings**
- Server: `smtp.zoho.in`
- Port: `587`
- Username: Full email (sairam@deepandwide.in)
- Password: Correct Zoho password

**Solution 2: Use App Password**
- Generate Zoho app password (see Option B above)
- Use that instead of regular password

**Solution 3: Check Zoho Security**
- Login to Zoho Mail
- Settings → Security
- Ensure IMAP/POP is enabled
- Check if any IP restrictions are set

### "Authentication failed"

**Possible causes:**
1. Wrong password
2. 2-factor authentication enabled (need app password)
3. SMTP access disabled in Zoho

**Solutions:**
1. Double-check password
2. Generate and use app password
3. Enable SMTP in Zoho settings

### "Emails not sending"

**Check these:**
1. ✅ Gmail alias is verified (green checkmark)
2. ✅ `from` line is uncommented in script
3. ✅ Script has been redeployed with new version
4. ✅ No errors in Executions log

### "Wrong sender address"

**Solutions:**
1. Verify alias is confirmed in Gmail
2. Clear browser cache
3. Make alias default in Gmail settings
4. Redeploy script completely

---

## 🔒 Security Best Practices

✅ **Use App Passwords** - Don't use your main Zoho password
✅ **Enable 2FA** - Add extra security to Zoho account
✅ **Regular Audits** - Check Apps Script executions periodically
✅ **Limit Access** - Only authorize necessary permissions

---

## 📊 Zoho Email Limits

**Zoho Mail Plans:**
- **Free Plan:** 250 emails/day per account
- **Paid Plans:** Higher limits (check your plan)

Google Apps Script limits:
- Free Gmail: 100 emails/day
- The lower limit applies (100/day if using free Gmail)

---

## ✅ Quick Reference

**Your Configuration:**
```
Email: sairam@deepandwide.in
Provider: Zoho Mail
SMTP Server: smtp.zoho.in
SMTP Port: 587
TLS: Enabled
```

**Email Format:**
```
From: Deep & Wide Technologies <sairam@deepandwide.in>
Reply-To: sairam@deepandwide.in
Subject: APFC Panel Quote - [kVAR] System for [Business]
```

---

## 🎯 Complete Setup Checklist

- [ ] Generate Zoho app password (if using 2FA)
- [ ] Add sairam@deepandwide.in as Gmail alias
- [ ] Configure Zoho SMTP (smtp.zoho.in:587)
- [ ] Verify email alias in Gmail
- [ ] Update Apps Script code
- [ ] Uncomment `from` line
- [ ] Save and authorize script
- [ ] Deploy new version
- [ ] Test with own email
- [ ] Check inbox for quote email
- [ ] Verify sender is sairam@deepandwide.in

---

## 🆘 Still Having Issues?

1. **Check Zoho's SMTP Documentation**
   - https://www.zoho.com/mail/help/zoho-smtp.html

2. **Check Apps Script Logs**
   - Executions tab shows detailed error messages

3. **Test SMTP Settings**
   - Use an email client to verify SMTP works
   - If it works there, it will work in the script

4. **Contact Zoho Support**
   - If authentication keeps failing
   - Ask about SMTP access for third-party apps

---

## 🎉 Success!

Once configured, every customer who submits your calculator will receive a professional quote email from **sairam@deepandwide.in** automatically!

**Email includes:**
- Panel specifications and pricing
- Savings calculations
- Service details
- WhatsApp button to place order
- Professional branding

**Next:** Test it, then share your calculator link!
https://sairamvarmanadimpalli.github.io/apfc-marketing/calculator/
