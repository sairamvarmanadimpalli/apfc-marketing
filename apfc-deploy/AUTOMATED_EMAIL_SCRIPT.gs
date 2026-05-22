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

    // Send automated email quote if email is provided and valid
    if (data.email && data.email !== "—" && validateEmail(data.email)) {
      sendQuoteEmail(data);
    }

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

/**
 * Validates email format
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Sends automated quote email to customer
 */
function sendQuoteEmail(data) {
  try {
    const recipientEmail = data.email;
    const recipientName = data.name || "Valued Customer";
    const businessName = data.business || "your business";

    // Format currency values
    const panelCost = formatCurrency(data.panelCost);
    const avgCostPerKvar = formatCurrency(data.avgCostPerKvar);
    const monthlyLoss = formatCurrency(data.monthlyLoss);
    const annualLoss = formatCurrency(data.annualLoss);

    // Email subject
    const subject = `APFC Panel Quote - ${data.panelRating} kVAR System for ${businessName}`;

    // Email body (HTML format)
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 650px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      background: #f9fafb;
      padding: 30px;
      border: 1px solid #e5e7eb;
    }
    .quote-box {
      background: white;
      border-left: 4px solid #667eea;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .quote-box h2 {
      color: #667eea;
      margin-top: 0;
      font-size: 20px;
    }
    .specs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin: 20px 0;
    }
    .spec-item {
      background: white;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .spec-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .spec-value {
      font-size: 18px;
      font-weight: bold;
      color: #111827;
      margin-top: 5px;
    }
    .highlight {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .highlight strong {
      color: #b45309;
    }
    .savings-table {
      width: 100%;
      margin: 20px 0;
      border-collapse: collapse;
    }
    .savings-table th,
    .savings-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    .savings-table th {
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }
    .cta-button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 15px 30px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      background: #f3f4f6;
      padding: 20px;
      text-align: center;
      border-radius: 0 0 10px 10px;
      border: 1px solid #e5e7eb;
      border-top: none;
      font-size: 14px;
      color: #6b7280;
    }
    .footer strong {
      color: #111827;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Your APFC Panel Quote</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Deep & Wide Technologies Pvt. Ltd.</p>
  </div>

  <div class="content">
    <p>Dear <strong>${recipientName}</strong>,</p>

    <p>Thank you for your interest in our APFC (Automatic Power Factor Correction) panel solution for <strong>${businessName}</strong>. Based on your electricity consumption data, we've prepared a customized quote for you.</p>

    <div class="quote-box">
      <h2>📊 Recommended System</h2>
      <p style="font-size: 24px; color: #667eea; font-weight: bold; margin: 10px 0;">
        ${data.panelRating} kVAR APFC Panel
      </p>
      <p style="margin: 5px 0; color: #6b7280;">
        Step Configuration: ${data.stepProgression}
      </p>
    </div>

    <div class="specs">
      <div class="spec-item">
        <div class="spec-label">Panel Cost</div>
        <div class="spec-value">${panelCost}</div>
      </div>
      <div class="spec-item">
        <div class="spec-label">Cost per kVAR</div>
        <div class="spec-value">${avgCostPerKvar}</div>
      </div>
      <div class="spec-item">
        <div class="spec-label">Payback Period</div>
        <div class="spec-value">${data.roiMonths} months</div>
      </div>
      <div class="spec-item">
        <div class="spec-label">Installation</div>
        <div class="spec-value">${data.withoutInstallation === 'Yes' ? 'Not Included' : 'Included'}</div>
      </div>
    </div>

    <div class="highlight">
      <strong>💰 Your Potential Savings</strong>
      <table class="savings-table" style="margin-top: 10px;">
        <tr>
          <td><strong>Monthly Loss (Current)</strong></td>
          <td style="text-align: right; color: #dc2626; font-weight: bold;">${monthlyLoss}</td>
        </tr>
        <tr>
          <td><strong>Annual Loss (Current)</strong></td>
          <td style="text-align: right; color: #dc2626; font-weight: bold;">${annualLoss}</td>
        </tr>
      </table>
      <p style="margin-top: 15px; font-size: 14px;">
        By installing this APFC panel, you can <strong>significantly reduce or eliminate these losses</strong> and improve your power factor to near unity (0.95-0.99).
      </p>
    </div>

    <h3 style="color: #374151;">📋 Your Service Details</h3>
    <ul style="color: #6b7280;">
      <li><strong>SC Number:</strong> ${data.scNumber}</li>
      <li><strong>Service Type:</strong> ${data.serviceType}</li>
      <li><strong>Connected Load:</strong> ${data.connectedLoad} kW</li>
      <li><strong>Recorded MD:</strong> ${data.recordedMd} kVA</li>
      <li><strong>Energy Consumption:</strong> ${data.kwh} kWh / ${data.kvah} kVAh</li>
    </ul>

    <h3 style="color: #374151;">✅ Why Choose Deep & Wide Technologies?</h3>
    <ul style="color: #6b7280;">
      <li><strong>5+ Years Panel Life:</strong> Durable, long-lasting equipment</li>
      <li><strong>Expert Installation:</strong> Professional setup and commissioning</li>
      <li><strong>Fast ROI:</strong> Recover your investment in ${data.roiMonths} months</li>
      <li><strong>Energy Savings:</strong> Reduce electricity bills by 15-30%</li>
      <li><strong>Multi-Location Service:</strong> Coverage in Hyderabad, Tirupati, Goa & Muramalla</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="https://wa.me/918374840074?text=Hi%2C%20I%20received%20my%20APFC%20quote%20for%20${data.panelRating}%20kVAR%20panel.%20I%27d%20like%20to%20proceed."
         class="cta-button">
        💬 Confirm Order via WhatsApp
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      This quote is valid for <strong>30 days</strong> from the date of this email. Prices are subject to change based on market conditions.
    </p>
  </div>

  <div class="footer">
    <p><strong>Deep & Wide Technologies Pvt. Ltd.</strong></p>
    <p>📧 Email: hello@deepandwide.in | 📱 WhatsApp: +91 83748 40074</p>
    <p>📍 Serving: Hyderabad · Tirupati · Goa · Muramalla</p>
    <p style="margin-top: 15px; font-size: 12px;">
      This is an automated quote based on your submitted information.
      For custom requirements or clarifications, please contact us directly.
    </p>
  </div>
</body>
</html>
    `;

    // Plain text version (fallback)
    const plainBody = `
Dear ${recipientName},

Thank you for your interest in our APFC panel solution for ${businessName}.

RECOMMENDED SYSTEM:
- Panel Rating: ${data.panelRating} kVAR
- Step Configuration: ${data.stepProgression}
- Panel Cost: ${panelCost}
- Cost per kVAR: ${avgCostPerKvar}
- Payback Period: ${data.roiMonths} months

YOUR POTENTIAL SAVINGS:
- Monthly Loss: ${monthlyLoss}
- Annual Loss: ${annualLoss}

SERVICE DETAILS:
- SC Number: ${data.scNumber}
- Service Type: ${data.serviceType}
- Connected Load: ${data.connectedLoad} kW
- Recorded MD: ${data.recordedMd} kVA
- Energy: ${data.kwh} kWh / ${data.kvah} kVAh

Contact us:
WhatsApp: +91 83748 40074
Email: hello@deepandwide.in

Deep & Wide Technologies Pvt. Ltd.
Serving: Hyderabad · Tirupati · Goa · Muramalla
    `;

    // Send email using Gmail service
    // Note: If you've set up sairam@deepandwide.in as an alias in Gmail,
    // add: from: "sairam@deepandwide.in" to the options below
    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: "Deep & Wide Technologies",
      // Uncomment the line below after setting up email alias:
      // from: "sairam@deepandwide.in"
    });

    Logger.log(`Quote email sent successfully to ${recipientEmail}`);

  } catch (error) {
    Logger.log(`Error sending email: ${error.toString()}`);
    // Don't throw error - we don't want email failure to break lead capture
  }
}

/**
 * Formats number as Indian currency
 */
function formatCurrency(amount) {
  if (!amount || amount === "—") return "—";
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return "₹" + num.toLocaleString('en-IN');
}
