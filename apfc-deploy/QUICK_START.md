# ✨ Automated Email Quotes - Quick Start

## 🎯 What You're Setting Up

Automatic professional quote emails sent to customers from **sairam@deepandwide.in** when they submit the calculator form.

---

## 📋 Setup Checklist (15 minutes)

### ☐ **Step 1: Set Up Zoho Email** (5 min)
Follow: `ZOHO_EMAIL_SETUP.md` ⭐ **START HERE**

**Quick steps:**
1. Generate Zoho app password (if using 2FA)
2. Gmail Settings → Accounts → Add another email
3. Enter: sairam@deepandwide.in
4. Configure SMTP: smtp.zoho.in:587
5. Use Zoho app password
6. Verify the email

### ☐ **Step 2: Update Apps Script** (5 min)
Follow: `EMAIL_AUTOMATION_SETUP.md`

**Quick steps:**
1. Open: https://script.google.com/u/0/home/projects/14Yp0DNhoBj55G64r9DEbwr7YesUhcES4jLszSywXIyOpQZqUTi85GIpV/edit
2. Replace all code with `AUTOMATED_EMAIL_SCRIPT.gs`
3. Uncomment line: `from: "sairam@deepandwide.in"`
4. Save and authorize
5. Deploy → Manage → New version

### ☐ **Step 3: Test** (5 min)

**Test the automation:**
1. Visit: https://sairamvarmanadimpalli.github.io/apfc-marketing/calculator/
2. Fill form with YOUR email
3. Submit
4. Check inbox for quote email from sairam@deepandwide.in

---

## 📂 Files Created

| File | Purpose |
|------|---------|
| `AUTOMATED_EMAIL_SCRIPT.gs` | Complete Apps Script code with email automation |
| `EMAIL_AUTOMATION_SETUP.md` | Detailed setup guide and troubleshooting |
| `GMAIL_ALIAS_SETUP.md` | Step-by-step email alias configuration |
| `QUICK_START.md` | This file - quick overview |

---

## 🚀 After Setup

Once live, this happens automatically:

```
Customer submits calculator
        ↓
Data saved to Google Sheet
        ↓
Beautiful quote email sent from sairam@deepandwide.in
        ↓
Customer receives professional quote
        ↓
Customer clicks WhatsApp button to order
```

---

## ✅ What Customers Receive

📧 **Professional Email with:**
- Recommended panel specifications
- Pricing breakdown
- Savings calculations
- Service details
- WhatsApp button to confirm order
- Company branding and contact info

---

## 💡 Quick Tips

1. **Test First** - Send to yourself before going live
2. **Check Spam** - Mark as "Not Spam" if needed
3. **Monitor Logs** - Check Apps Script → Executions tab
4. **Email Limits** - Google allows 100 emails/day (free Gmail)

---

## 🆘 Need Help?

**Common Issues:**
- Email not sending? → Check `EMAIL_AUTOMATION_SETUP.md` Troubleshooting section
- Wrong sender address? → Verify alias setup in `GMAIL_ALIAS_SETUP.md`
- Script errors? → Check Executions tab in Apps Script

**Support Files:**
- Full guide: `EMAIL_AUTOMATION_SETUP.md`
- Email setup: `GMAIL_ALIAS_SETUP.md`

---

## 🎉 You're Ready!

After completing these 3 steps, your automated quote system will be live and sending beautiful, professional emails to every customer who uses your calculator.

**Next Steps:**
1. Complete the setup checklist above
2. Test with your own email
3. Share the calculator link: https://sairamvarmanadimpalli.github.io/apfc-marketing/calculator/

---

**Questions?** Check the detailed guides or review Apps Script execution logs for errors.
