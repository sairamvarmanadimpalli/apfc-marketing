# Zoho SMTP Connection Troubleshooting

## Error: "Couldn't connect to the server. Check the server and port number."

This error occurs when Gmail cannot connect to Zoho's SMTP server. Follow these fixes in order:

---

## ✅ Fix 1: Enable IMAP/SMTP in Zoho (REQUIRED)

### Step 1: Login to Zoho Mail
Visit: https://mail.zoho.in

### Step 2: Access Settings
1. Click the **Settings gear icon** (top right)
2. Click **Mail Accounts**
3. Select your account: `sairam@deepandwide.in`

### Step 3: Enable IMAP Access
1. Look for **IMAP/POP Access** section
2. Enable **IMAP Access**
3. Enable **POP Access** (optional but recommended)
4. Click **Save**

### Alternative Path:
1. Settings → **Mail Accounts** → **IMAP/POP**
2. Turn ON: **Enable IMAP**
3. Turn ON: **Enable POP** (optional)

---

## ✅ Fix 2: Verify Zoho SMTP Settings

Double-check these settings in Gmail:

### For Zoho Mail (India Server):
```
SMTP Server: smtp.zoho.in
Port: 587
Username: sairam@deepandwide.in
Password: [Your app-specific password]
Connection: TLS (Secured connection using TLS)
```

### If smtp.zoho.in doesn't work, try:
```
SMTP Server: smtp.zoho.com
Port: 587
```

### Alternative Ports:
- **Port 587** - TLS (recommended)
- **Port 465** - SSL (alternative)
- **Port 25** - Usually blocked by ISPs

---

## ✅ Fix 3: Generate App-Specific Password

Zoho may require an app-specific password instead of your regular password.

### Step 1: Generate Password
1. Go to: https://accounts.zoho.in/home#security
2. Or: Zoho Mail → Profile → **Security** → **Application-Specific Passwords**
3. Click **Generate New Password**
4. Name: `Gmail SMTP`
5. Copy the generated password (16 characters like: `abcd1234efgh5678`)

### Step 2: Use in Gmail
- Use this password instead of your regular Zoho password
- Paste it in the "Password" field when adding Gmail alias

---

## ✅ Fix 4: Check Two-Factor Authentication

If you have 2FA enabled on Zoho:

### You MUST use app-specific password
- Regular password won't work with 2FA enabled
- Follow Fix 3 above to generate app password

---

## ✅ Fix 5: Try Different Port

If Port 587 doesn't work:

### Try SSL Port 465:
```
SMTP Server: smtp.zoho.in
Port: 465
Connection: SSL (Secured connection using SSL)
```

---

## ✅ Fix 6: Check Zoho Domain Server

Zoho uses different servers based on region:

### India:
```
smtp.zoho.in
```

### International:
```
smtp.zoho.com
smtp.zoho.eu (Europe)
```

Try the server that matches your Zoho account region.

---

## 🔍 Verification Steps

### Test SMTP Manually (Optional)

Use an email client (Thunderbird, Outlook) to verify SMTP works:

1. Add account with same settings
2. Try sending a test email
3. If it works there, it should work in Gmail

---

## 🎯 Recommended Solution (Works 99% of the time)

### Quick Fix Checklist:
1. ✅ Enable IMAP/SMTP in Zoho Mail settings
2. ✅ Generate Zoho app-specific password
3. ✅ Use settings:
   ```
   Server: smtp.zoho.in
   Port: 587
   Username: sairam@deepandwide.in
   Password: [app-specific password]
   TLS: Enabled
   ```
4. ✅ Verify email address

---

## 🔄 Alternative Solution: Use MailApp Without Alias

If SMTP connection keeps failing, you can still send emails WITHOUT the alias:

### Option A: Send from Google Account
- Emails will come from your Google account
- Display name: "Deep & Wide Technologies"
- Reply-to: Can be set to sairam@deepandwide.in

### Update Apps Script:
```javascript
MailApp.sendEmail({
  to: recipientEmail,
  subject: subject,
  body: plainBody,
  htmlBody: htmlBody,
  name: "Deep & Wide Technologies",
  replyTo: "sairam@deepandwide.in"  // Customers reply to Zoho
});
```

### Pros:
- ✅ Works immediately, no SMTP setup needed
- ✅ Still shows "Deep & Wide Technologies" as sender name
- ✅ Replies go to your Zoho email

### Cons:
- ❌ From address shows Google account email
- ❌ Less professional appearance

---

## 🆘 Still Not Working?

### Contact Zoho Support
If none of the above works:

1. **Verify your Zoho plan supports SMTP**
   - Some free plans may have restrictions
   - Check: https://www.zoho.com/mail/help/zoho-smtp.html

2. **Check Zoho Service Status**
   - SMTP might be temporarily down
   - Visit: https://status.zoho.com

3. **Check IP/Network Restrictions**
   - Some corporate networks block SMTP ports
   - Try from different network (mobile hotspot)

4. **Contact Zoho Support**
   - They can verify if SMTP is enabled on your account
   - Ask: "Why can't I connect to smtp.zoho.in:587?"

---

## ✅ Working Configuration Example

This works for most users:

```
Gmail Settings > Accounts > Send mail as > Add another email address

Name: Deep & Wide Technologies
Email: sairam@deepandwide.in
☑️ Treat as an alias

SMTP Server: smtp.zoho.in
Port: 587
Username: sairam@deepandwide.in
Password: [Zoho app-specific password from accounts.zoho.in/home#security]
☑️ Secured connection using TLS
```

After adding, Zoho sends verification email to sairam@deepandwide.in.
Click verify link and you're done!

---

## 📝 Summary

**Most Common Cause:** IMAP/SMTP not enabled in Zoho settings

**Most Common Solution:**
1. Enable IMAP in Zoho Mail settings
2. Generate app-specific password
3. Use smtp.zoho.in:587 with TLS

**If All Else Fails:**
- Use MailApp without alias (send from Google account)
- Set replyTo: "sairam@deepandwide.in" for replies

---

Need more help? Open `ZOHO_EMAIL_SETUP.md` for the complete setup guide.
