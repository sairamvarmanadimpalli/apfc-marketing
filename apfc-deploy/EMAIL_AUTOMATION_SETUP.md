# Automated Email Quote Setup Guide

This guide will help you set up automated email quotes that are sent to customers when they submit the calculator form.

## Features

✅ **Automatic Email Delivery** - Quotes sent instantly when form is submitted
✅ **Professional Design** - Beautiful HTML email template with your branding
✅ **Complete Quote Details** - Panel specs, pricing, ROI, and savings calculations
✅ **WhatsApp CTA** - Direct link for customers to confirm orders
✅ **Email Validation** - Only sends if valid email is provided

## Setup Steps

### 1. Open Your Apps Script Project

Visit: https://script.google.com/u/0/home/projects/14Yp0DNhoBj55G64r9DEbwr7YesUhcES4jLszSywXIyOpQZqUTi85GIpV/edit

### 2. Replace the Code

1. Click on **Code.gs** in the left sidebar
2. Select ALL the existing code (Ctrl+A)
3. Delete it
4. Copy the entire code from `AUTOMATED_EMAIL_SCRIPT.gs` file
5. Paste it into the Code.gs editor

### 3. Save and Test

1. Click the **Save** icon (💾) or press Ctrl+S
2. Click **Run** → select `sendQuoteEmail` from dropdown
3. Click **Run** to test the email function
4. **Authorize** the script when prompted:
   - Click "Review Permissions"
   - Select your Google account
   - Click "Advanced" → "Go to APFC Lead Capture (unsafe)"
   - Click "Allow"

### 4. Deploy New Version

1. Click **Deploy** → **Manage deployments**
2. Click the pencil icon ✏️ next to your existing deployment
3. In the **Version** dropdown, select **New version**
4. Add description: "Added automated email quotes"
5. Click **Deploy**
6. ✅ Done! The URL remains the same - no frontend changes needed

## How It Works

```
Customer Submits Form
        ↓
Data Saved to Google Sheet
        ↓
Email Validation Check
        ↓
Automated Quote Email Sent
        ↓
Customer Receives Quote
```

## Email Template Includes

📊 **Panel Specifications**
- kVAR rating and step configuration
- Panel cost and cost per kVAR
- Installation details

💰 **Savings Calculation**
- Current monthly/annual losses
- Expected payback period
- Potential savings after installation

📋 **Service Details**
- SC number and service type
- Connected load and recorded MD
- Energy consumption (kWh/kVAh)

✅ **Company Information**
- Contact details (WhatsApp, Email)
- Service locations
- WhatsApp button for easy ordering

## Testing the Email Automation

1. Visit the calculator: https://sairamvarmanadimpalli.github.io/apfc-marketing/calculator/
2. Fill in all fields including:
   - **Customer name**
   - **Valid email address** ⚠️ Important
   - Phone number
   - Business name
3. Submit the form
4. Check the email inbox for the automated quote

## Troubleshooting

### No Email Received

**Check these:**
1. ✅ Email address was valid (contains @ and domain)
2. ✅ Script is authorized (completed step 3)
3. ✅ Check spam/junk folder
4. ✅ Script execution logs in Apps Script:
   - Click **Executions** tab
   - Look for errors or success logs

### View Execution Logs

1. In Apps Script editor, click **Executions** (left sidebar)
2. Find the recent execution
3. Click on it to see logs
4. Look for: "Quote email sent successfully to [email]"

### Email Format Issues

The email uses HTML for rich formatting. If recipients see plain text:
- This is normal for some email clients
- The plain text fallback is included
- Content is still readable and complete

## Customization Options

### Change Email Design

Edit the `htmlBody` variable in the `sendQuoteEmail` function to modify:
- Colors (currently purple gradient)
- Company logo (add `<img>` tag in header)
- Footer text
- Call-to-action buttons

### Configure "From" Email Address

To send from `sairam@deepandwide.in`, you need to set it up as an alias:

**Option 1: Add Email Alias in Gmail (Recommended)**

1. Go to Gmail Settings: https://mail.google.com/mail/u/0/#settings/accounts
2. Under "Send mail as", click **Add another email address**
3. Enter:
   - Name: Deep & Wide Technologies
   - Email: sairam@deepandwide.in
4. Click **Next** and verify the email address
5. Once verified, the script will automatically use this address

**Option 2: Use Google Workspace**

If `sairam@deepandwide.in` is a Google Workspace email:
1. Run the Apps Script under that account instead
2. The emails will automatically come from sairam@deepandwide.in

**Note:** The `name` parameter in the script just sets the display name, not the actual sender address.

### Add BCC Copy

To receive a copy of every quote sent, add this line after the `MailApp.sendEmail({` line:

```javascript
bcc: "your-email@deepandwide.in",
```

### Modify Subject Line

Edit this line in `sendQuoteEmail` function:

```javascript
const subject = `APFC Panel Quote - ${data.panelRating} kVAR System for ${businessName}`;
```

## Email Sending Limits

**Gmail/Google Workspace Limits:**
- Free Gmail: 100 emails/day
- Google Workspace: 1,500 emails/day

These limits apply to the Google account running the script.

## Privacy & Data

- Emails are sent using YOUR Google account
- No third-party email services involved
- Customer emails are only used for quote delivery
- All data stays in your Google ecosystem

## Support

If you need help:
1. Check the **Executions** tab in Apps Script for errors
2. Review the execution logs
3. Verify email addresses are valid
4. Ensure script permissions are granted

## Next Steps

After setup:
1. ✅ Test with your own email
2. ✅ Check spam folder
3. ✅ Verify email formatting
4. ✅ Test the WhatsApp button
5. ✅ Add to spam whitelist if needed

---

**Your automated quote system is ready!** 🎉

Every customer who submits the calculator will now receive a professional quote email instantly.
