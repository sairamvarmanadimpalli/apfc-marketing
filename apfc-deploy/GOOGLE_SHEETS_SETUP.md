# Google Sheets Lead Capture Setup

This guide will help you set up Google Sheets to receive customer leads from the APFC Calculator.

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "APFC Calculator Leads"
4. In the first row, add these column headers:

```
Timestamp | Name | Phone | Email | Business | SC Number | Service Type | Panel Rating (kVAR) | Step Progression | Panel Cost | Avg Cost/kVAR | Without Installation | ROI (months) | Monthly Loss | Annual Loss | Connected Load | Recorded MD | kWh | kVAh
```

## Step 2: Create Google Apps Script

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any code in the editor
3. Paste the following code:

```javascript
function doPost(e) {
  try {
    // Parse incoming JSON data
    const data = JSON.parse(e.postData.contents);

    // Get the active spreadsheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Prepare row data
    const row = [
      data.timestamp,
      data.name,
      data.phone,
      data.email,
      data.business,
      data.scNumber,
      data.serviceType,
      data.panelRating,
      data.stepProgression,
      data.panelCost,
      data.avgCostPerKvar,
      data.withoutInstallation,
      data.roiMonths,
      data.monthlyLoss,
      data.annualLoss,
      data.connectedLoad,
      data.recordedMd,
      data.kwh,
      data.kvah
    ];

    // Append the row
    sheet.appendRow(row);

    // Return success
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Lead captured successfully'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function (optional - for debugging)
function testDoPost() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        timestamp: new Date().toISOString(),
        name: "Test Customer",
        phone: "9876543210",
        email: "test@example.com",
        business: "Test Salon",
        scNumber: "110436036",
        serviceType: "LT",
        panelRating: 20,
        stepProgression: "2 • 3 • 5 • 10",
        panelCost: 32000,
        avgCostPerKvar: 1600,
        withoutInstallation: "No",
        roiMonths: "4.2",
        monthlyLoss: 7619,
        annualLoss: 91429,
        connectedLoad: "25",
        recordedMd: "18",
        kwh: "8158",
        kvah: "9874"
      })
    }
  };

  const result = doPost(testData);
  Logger.log(result.getContent());
}
```

4. Click **Save** (💾 icon)
5. Name your project: "APFC Lead Capture"

## Step 3: Deploy the Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Configure deployment:
   - **Description**: "APFC Lead Capture"
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
5. Click **Deploy**
6. **IMPORTANT**: Copy the **Web app URL** that appears
   - It will look like: `https://script.google.com/macros/s/AKfycby.../exec`

## Step 4: Update the Frontend Code

1. Open `apfc-deploy/frontend/src/App.jsx`
2. Find line ~346 with:
   ```javascript
   const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
   ```
3. Replace `YOUR_DEPLOYMENT_ID` with your actual deployment URL from Step 3
4. Save the file
5. Rebuild and deploy:
   ```bash
   cd apfc-deploy/frontend
   npm run build
   git add -A
   git commit -m "Update Google Sheets URL for lead capture"
   git push
   ```

## Step 5: Test the Integration

1. Go to your calculator: `https://sairamvarmanadimpalli.github.io/apfc-marketing/calculator/`
2. Fill in all fields including customer information
3. Click "Submit Quote Request"
4. Check your Google Sheet - a new row should appear with the lead data!

## Troubleshooting

### "Error: Please try again or call us"
- Verify the Google Apps Script is deployed as "Anyone" can access
- Check that the URL in App.jsx matches your deployment URL exactly
- Try redeploying the Apps Script

### No data appearing in sheet
- Run the `testDoPost()` function in Apps Script to verify it works
- Check Apps Script logs: **Executions** tab on the left sidebar
- Ensure column headers in Sheet match exactly

### Need to update the script
1. Make changes in Apps Script editor
2. Click **Deploy** → **Manage deployments**
3. Click pencil icon ✏️ to edit
4. Change version to "New version"
5. Click **Deploy**
6. URL stays the same - no need to update frontend!

## Data Privacy

- This data is stored in YOUR Google Drive
- Only you (and accounts you share with) can access it
- Google Apps Script runs under your Google account
- No data is sent to third parties

## Email Notifications (Optional)

Add this to the `doPost` function after `sheet.appendRow(row);`:

```javascript
// Send email notification
MailApp.sendEmail({
  to: "your.email@example.com",
  subject: `New APFC Lead: ${data.name}`,
  body: `New quote request received:

Name: ${data.name}
Phone: ${data.phone}
Email: ${data.email}
Business: ${data.business}

Panel: ${data.panelRating} kVAR
Cost: ₹${data.panelCost}
ROI: ${data.roiMonths} months

View all leads: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`
});
```

Redeploy after adding this code.
