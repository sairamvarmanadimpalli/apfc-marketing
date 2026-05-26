/**
 * APFC Bill Fetcher — Cloudflare Worker
 * DeepAndWide Technologies Pvt. Ltd.
 *
 * Endpoints:
 *   GET /api/bill?scno=113400807&type=LT                    (TSSPDCL auto)
 *   GET /api/bill?scno=MCL3800&type=HT                      (TSSPDCL auto)
 *   GET /api/bill?scno=113400807&utility=tsspdcl            (explicit utility)
 *   GET /api/bill?scno=1413290408002001&utility=apepdcl     (APEPDCL LT)
 *   GET /api/health
 *
 * Returns JSON with parsed bill data + the original URL used.
 *
 * Deploy:
 *   npm i -g wrangler
 *   wrangler deploy
 */

// ===== TSSPDCL URLs =====
const TSSPDCL_LT_URL = (scno) =>
  `https://tgsouthernpower.org/ops/DuplicateBill4Login.jsp?ctscno=${encodeURIComponent(scno)}`;

const TSSPDCL_HT_URL = (scno) =>
  `https://webportal.tgsouthernpower.org/HTBilling/MeterDetails/HTBillSet_BillViewGen.jsp?htscno=${encodeURIComponent(scno)}`;

// Legacy aliases
const LT_URL = TSSPDCL_LT_URL;
const HT_URL = TSSPDCL_HT_URL;

// ===== APEPDCL URLs =====
const APEPDCL_BASE = "https://www.apeasternpower.com";
const APEPDCL_PAY_PAGE = `${APEPDCL_BASE}/payWithoutLogin`;
const APEPDCL_CAPTCHA = `${APEPDCL_BASE}/generateCaptcha`;
const APEPDCL_GET_BILL = `${APEPDCL_BASE}/getLTOnlinePayData`;
const APEPDCL_CHATBOX = `${APEPDCL_BASE}/getChatboxBill`;
const APEPDCL_EBILL = (id) => `${APEPDCL_BASE}/viewEbill?id=${encodeURIComponent(id)}`;

// ----- CORS headers (allow the GitHub Pages origin and dev) -----
const ALLOWED_ORIGINS = [
  "https://apfc.deepandwide.in",
  "https://deepandwide.github.io",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

function corsHeaders(req) {
  const origin = req.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(req, body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300", // cache 5 min at edge
      ...corsHeaders(req),
    },
  });
}

// ----- HT vs LT auto-detection from the SC number -----
// TSSPDCL LT: pure digits, 6-15 length (e.g. 113400807)
// TSSPDCL HT: starts with 2-4 letters + digits (e.g. MCL3800, SEC1727, IBM1234)
// APEPDCL LT: 16-digit pure numeric (e.g. 1413290408002001) or 8-digit legacy
// APEPDCL HT: alpha-numeric prefix (login required, not publicly accessible)
function detectType(scno) {
  const s = (scno || "").trim().toUpperCase();
  if (/^[A-Z]{2,4}\d+$/.test(s)) return "HT";
  if (/^\d{6,16}$/.test(s)) return "LT";
  return null;
}

// Detect which utility based on SC number format
function detectUtility(scno) {
  const s = (scno || "").trim();
  // APEPDCL LT: 16-digit USC or 8-digit legacy SCNO
  if (/^\d{16}$/.test(s)) return "APEPDCL";
  if (/^\d{8}$/.test(s)) return "APEPDCL"; // Could be either, but 8-digit is common APEPDCL format
  // TSSPDCL: 9-digit typical, or alpha-numeric HT
  if (/^\d{9,15}$/.test(s)) return "TSSPDCL";
  if (/^[A-Z]{2,4}\d+$/i.test(s)) return "TSSPDCL";
  return null;
}

// ----- Parsers ---------------------------------------------------

function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(tr|p|div|h\d|li|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n");
}

function grab(text, re) {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

// LT Bill field mappings: fieldName -> [regex, transform]
const LT_FIELDS = {
  uscNo: [/USC\s*No\.?\s*:?\s*(\d{6,15})/i],
  scNo: [/SC\s*No\.?\s*:?\s*([\d\s]{6,20})/i],
  consumerName: [/Name\s*:?\s*\*?\*?\s*([A-Z][A-Z\s.\/&-]{1,60}?)\s*\*?\*?\s*Address/i],
  address: [/Address\s*:?\s*([^\n]{5,200}?)(?:\n|CAT)/i],
  category: [/CAT\s*:?\s*([^\n]+?)(?:\n|PH)/i],
  connectedLoadKw: [/CONTRACTED\s*LOAD\s*:?\s*([\d.]+)\s*KW/i, parseFloat],
  recordedMdKw: [/Recorded\s*MD\s*\n?\s*([\d.]+)\s*KW/i, parseFloat],
  kvah: [/UNITS\s*:?\s*(\d+)/i, parseInt],
  mf: [/MF\s*:?\s*([\d.]+)/i, parseFloat],
  billNumber: [/Bill\s*No\.?\s*:?\s*(\d+)/i],
  billDate: [/DATE\s*:?\s*(\d{2}-\d{2}-\d{4})/i],
  billingDays: [/DAYS\s*:?\s*(\d+)/i, parseInt],
  meterNumber: [/METER\s*NO\.?\s*:?\s*([A-Z0-9]+)/i],
  ero: [/ERO\s*:?\s*([^\n]+?)(?:\n|SEC)/i, s => s?.trim()],
  section: [/SEC\s*:?\s*([^\n]+?)(?:\n|SC)/i, s => s?.trim()],
  energyCharges: [/Energy\s*Charges\s*:?\s*([\d.]+)/i, parseFloat],
  fixedCharges: [/Fixed\s*Charges\s*:?\s*([\d.]+)/i, parseFloat],
  customerCharges: [/Customer\s*Charges\s*:?\s*([\d.]+)/i, parseFloat],
  electricityDuty: [/Electricity\s*Duty\s*:?\s*([\d.]+)/i, parseFloat],
  surcharge: [/Surcharge\s*:?\s*([\d.]+)/i, parseFloat],
  billAmount: [/BILL\s*AMOUNT\s*\*?\*?\s*([\d.]+)/i, parseFloat],
  totalDue: [/TOTAL\s*DUE\s*\*?\*?\s*([\d.]+)/i, parseFloat],
  arrears: [/ARREARS\s*as\s*on\s*[^\n]+\s*([\d.]+)/i, parseFloat],
  lastPaidDate: [/Last\s*Paid\s*Date\s*:?\s*(\d{2}-\d{2}-\d{4})/i],
  aaoMobile: [/AAO\s*Mobile\s*No\.?\s*:?\s*(\d{10})/i],
  adeMobile: [/ADE\s*Mobile\s*No\.?\s*:?\s*(\d{10})/i],
  phase: [/PH\s*:?\s*(\d)/i, parseInt],
};

function parseLtBill(html) {
  const text = htmlToText(html);
  const out = { type: "LT", _raw: text.slice(0, 4000) };

  // Extract all fields using mapping
  for (const [field, [regex, transform]] of Object.entries(LT_FIELDS)) {
    const value = grab(text, regex);
    if (value) out[field] = transform ? transform(value) : value;
  }

  // Extract meter readings from table format and calculate kWh
  const presentMatch = text.match(/Present\s+\d{2}\/\d{2}\/\d{2}\s+\d+\s+(\d+)/i);
  const previousMatch = text.match(/Previous\s+\d{2}\/\d{2}\/\d{2}\s+\d+\s+(\d+)/i);

  if (presentMatch && previousMatch && out.mf) {
    const presentReading = parseInt(presentMatch[1], 10);
    const previousReading = parseInt(previousMatch[1], 10);
    out.kwh = Math.round((presentReading - previousReading) * out.mf);
    out.presentReading = presentReading;
    out.previousReading = previousReading;
  }

  // Calculate derived fields
  if (out.energyCharges && out.kvah) {
    out.effectiveTariff = parseFloat((out.energyCharges / out.kvah).toFixed(2));
  }

  if (out.kwh && out.kvah) {
    out.powerFactor = parseFloat((out.kwh / out.kvah).toFixed(3));
  }

  if (!out.kwh && out.kvah) {
    out._kwhWarning = "kWh not calculated - meter readings not found";
  }

  return out;
}

/**
 * HT bill parser — based on the structure of TGSPDCL HT C.C. Bill
 * (HTBillSet_BillViewGen.jsp).
 *
 * Real example reference (SEC2112, March 2026):
 *   Consumer Number   SEC2112
 *   Name              M/S.REGISTRAR
 *   Address1/2/3      OSMANIA UNIVERCITY / NEAR ... / TARNAKA
 *   Contracted MD (KVA/HP)   200
 *   Specified Voltage(KV)    11
 *   Category          2A
 *   Total Consumption KWH=53707  KVAH=54083  KVA=127.64
 *   Energy Charges Ps. 880  (= Rs 8.80 per unit)
 *   Total Amount Payable     582655.00
 */

// HT Bill field mappings: fieldName -> [regex, transform]
const HT_FIELDS = {
  scNo: [/Consumer\s*Number\s+([A-Z0-9]{3,20})/i],
  consumerName: [/Name\s+([A-Z][A-Z0-9\s.,&\/\-()]{2,80}?)\s+(?:Address|Specified|Actual|Feeder|Category)/i],
  category: [/Category\s+([A-Z0-9\- ]{1,15}?)\s+(?:Address|DESCRIPTIONS|Reading)/i],
  specifiedVoltageKv: [/Specified\s*Voltage\s*\(KV\)\s+([\d.]+)/i, parseFloat],
  actualVoltageKv: [/Actual\s*Voltage\s*\(KV\)\s+([\d.]+)/i, parseFloat],
  feeder: [/Feeder\s+([\d]+(?:\s*\([^)]+\))?)/i],
  contractedMdKva: [/Contracted\s*MD\s*\(KVA\/HP\)\s+([\d.]+)/i, parseFloat],
  // MF can appear as "Multiplying Factor 1000" or "MF: 1000" or with newlines
  mf: [/Multiplying\s*Factor\s+(\d+(?:\.\d+)?)/i, parseFloat],
  billMonth: [/Bill\s*cum\s*Demand\s*Notice\s*for\s*the\s*Month\s*of\s+([A-Za-z]+\s*\d{4})/i],
  billNumber: [/Bill\s*No\.?\s*:?\s*(\d+)/i],
  billingDays: [/(?:Billing\s*Period|Period)\s*:?\s*(\d+)\s*days/i, parseInt],
  demandChargeRate: [/Demand\s*Charges\s*Normal\s+Rs\.\s*([\d.]+)/i, parseFloat],
};

function parseHtBill(html) {
  const text = htmlToText(html);
  const out = { type: "HT", _raw: text.slice(0, 4000) };

  // Extract all simple fields using mapping
  for (const [field, [regex, transform]] of Object.entries(HT_FIELDS)) {
    const value = grab(text, regex);
    if (value) out[field] = transform ? transform(value) : value;
  }

  // Fallback MF extraction if primary regex failed
  // Try alternate patterns: "MF 1000" or first number after "Multiplying Factor" row
  if (!out.mf) {
    const altMf = grab(text, /(?:MF|M\.F\.?)\s*:?\s*(\d+(?:\.\d+)?)/i)
               || grab(text, /Multiplying\s+Factor[\s\n]+(\d+)/i);
    if (altMf) out.mf = parseFloat(altMf);
  }

  // Address is split across Address1/2/3 - needs special handling
  // Character class includes colon for addresses like "SYNO: 292 TO 296"
  const a1 = grab(text, /Address1\s+([A-Z0-9 .,&\/\-():]{2,80}?)\s+(?:Address2|Specified|Actual|Feeder|Category)/i);
  const a2 = grab(text, /Address2\s+([A-Z0-9 .,&\/\-():]{2,80}?)\s+(?:Address3|Specified|Actual|Feeder|Category)/i);
  const a3 = grab(text, /Address3\s+([A-Z0-9 .,&\/\-():]{2,80}?)\s+(?:Specified|Actual|Feeder|Category|DESCRIPTIONS)/i);
  out.address = [a1, a2, a3].filter(Boolean).join(", ") || null;

  // Bill date has multiple patterns
  const billDate = grab(text, /Bill\s*Date\s*:?\s*(\d{2}[-\/]\d{2}[-\/]\d{4})/i)
                || grab(text, /Date\s*:?\s*(\d{2}[-\/]\d{2}[-\/]\d{4})/i);
  if (billDate) out.billDate = billDate;

  // Total Consumption row gives us KWH, KVAH, KVA (the KVA value here is RMD)
  // Pattern: "Total Consumption {KWH} {KVAH} {KVA} {TOD1} {TOD2}"
  const totalRow = text.match(
    /Total\s*Consumption\s+(\d+)\s+(\d+)\s+([\d.]+)(?:\s+(\d+)\s+(\d+))?/i
  );
  if (totalRow) {
    out.kwh = parseInt(totalRow[1], 10);
    out.kvah = parseInt(totalRow[2], 10);
    out.recordedMdKva = parseFloat(totalRow[3]);
    if (totalRow[4]) out.tod1 = parseInt(totalRow[4], 10);
    if (totalRow[5]) out.tod2 = parseInt(totalRow[5], 10);
  } else {
    // Fallback if Total Consumption row not matched
    const kwh = grab(text, /KWH\s*:?\s*(\d+)/i);
    if (kwh) out.kwh = parseInt(kwh, 10);
    const kvah = grab(text, /KVAH\s*:?\s*(\d+)/i);
    if (kvah) out.kvah = parseInt(kvah, 10);
  }

  // Energy charge rate: "Energy Charges Ps. 880" => 8.80 Rs/unit
  const ecPs = grab(text, /Energy\s*Charges\s+Ps\.\s*(\d+)/i);
  if (ecPs) {
    out.energyChargeRate = parseInt(ecPs, 10) / 100; // paise -> rupees
  } else {
    const ecRs = grab(text, /Energy\s*Charges\s+Rs\.\s*([\d.]+)/i);
    if (ecRs) out.energyChargeRate = parseFloat(ecRs);
  }

  // Bill amounts - need to strip commas
  const billAmt = grab(text, /Total\s*Amount\s*Payable\s+([\d.,]+)/i)
              || grab(text, /Net\s*Bill\s*Amount\s+([\d.,]+)/i)
              || grab(text, /Gross\s*Total\s+([\d.,]+)/i);
  if (billAmt) out.billAmount = parseFloat(billAmt.replace(/,/g, ""));

  const subTotal = grab(text, /Sub\s*Total\s+([\d.,]+)/i);
  if (subTotal) out.subTotal = parseFloat(subTotal.replace(/,/g, ""));

  const totalEnergyCharges = grab(text, /Energy\s*Charges\s*Rs\.?\s*([\d.,]+)/i)
                          || grab(text, /Total\s*Energy\s*Charges\s*([\d.,]+)/i);
  if (totalEnergyCharges) out.totalEnergyCharges = parseFloat(totalEnergyCharges.replace(/,/g, ""));

  const fixedCharges = grab(text, /Fixed\s*Charges\s*([\d.,]+)/i);
  if (fixedCharges) out.fixedCharges = parseFloat(fixedCharges.replace(/,/g, ""));

  const demandCharges = grab(text, /Demand\s*Charges\s*(?:Normal)?\s*([\d.,]+)/i);
  if (demandCharges) out.demandCharges = parseFloat(demandCharges.replace(/,/g, ""));

  const customerCharges = grab(text, /Customer\s*Charges\s*([\d.,]+)/i);
  if (customerCharges) out.customerCharges = parseFloat(customerCharges.replace(/,/g, ""));

  // Calculate effective tariff if we have total energy charges and kvah
  if (out.totalEnergyCharges && out.kvah) {
    out.effectiveTariff = parseFloat((out.totalEnergyCharges / out.kvah).toFixed(2));
  } else if (out.energyChargeRate) {
    // Use the rate directly if total charges not available
    out.effectiveTariff = out.energyChargeRate;
  }

  // Connected load equivalent — HT bills don't list kW; convert from contracted kVA at 0.9 PF assumed
  if (out.contractedMdKva && !out.connectedLoadKw) {
    out.contractedLoadKwApprox = Math.round(out.contractedMdKva * 0.9);
  }

  // Calculate actual power factor from bill data
  if (out.kwh && out.kvah) {
    out.powerFactor = parseFloat((out.kwh / out.kvah).toFixed(3));
  }

  return out;
}

// ===== APEPDCL LT Bill Parser =====
// Field mappings for APEPDCL e-bill (/viewEbill)
const APEPDCL_LT_FIELDS = {
  uscNo: [/Service\s*Number\s*(\d{8,16})/i],
  consumerName: [/Consumer\s*Name\s+([A-Z][A-Z\s.\/&\-]{1,60})/i],
  billNumber: [/Bill\s*Number\s+(\d+)/i],
  billDate: [/Bill\s*Date\s+([\d\-A-Za-z]+)/i],
  dueDate: [/Due\s*Date\s+([\d\-A-Za-z]+)/i],
  category: [/Category\s+([A-Z0-9 \-]+?)(?:\s+Meter|\s+Phase)/i],
  meterNumber: [/Meter\s*Number\s+(\d+)/i],
  phase: [/Phase\s+(\d)/i, parseInt],
  connectedLoadKw: [/Connected\s*Load\s*\(KW\)\s+([\d.]+)/i, parseFloat],
  contractedLoadKw: [/Contracted\s*Load\s*\(KW\)\s+([\d.]+)/i, parseFloat],
  mf: [/Multiplying\s*Factor\s+([\d.]+)/i, parseFloat],
  presentKwh: [/Present\s*Reading\s*\(kWh\)\s+([\d.]+)/i, parseFloat],
  previousKwh: [/Previous\s*Reading\s*\(kWh\)\s+([\d.]+)/i, parseFloat],
  presentKvah: [/Present\s*Reading\s*\(kVAh\)\s+([\d.]+)/i, parseFloat],
  previousKvah: [/Previous\s*Reading\s*\(kVAh\)\s+([\d.]+)/i, parseFloat],
  billedUnits: [/\bBilled\s*Units\b\s+(\d+)/i, parseInt],
  energyCharges: [/Energy\s*Charges\s+([\d.]+)/i, parseFloat],
  fixedCharges: [/Fixed\s*Charges\s+([\d.]+)/i, parseFloat],
  customerCharges: [/Customer\s*Charges\s+([\d.]+)/i, parseFloat],
  electricityDuty: [/Electricity\s*Duty\s+([\d.]+)/i, parseFloat],
  totalAmount: [/Total\s*Amount\s+([\d,]+\.?\d*)/i, s => parseFloat(s.replace(/,/g, ""))],
  govtSubsidy: [/Govt\.?\s*Subsidy\s+([\d.]+)/i, parseFloat],
  aquaSubsidy: [/Aqua\.?\s*Subsidy\s+(-?[\d.]+)/i, s => Math.abs(parseFloat(s))],
  netBillAmount: [/Net\s*Bill\s*Amount\s+([\d,]+\.?\d*)/i, s => parseFloat(s.replace(/,/g, ""))],
};

function parseApepdclLtBill(html) {
  const text = htmlToText(html);
  const out = { type: "LT", utility: "APEPDCL", _raw: text.slice(0, 4000) };

  // Extract all fields using mapping
  for (const [field, [regex, transform]] of Object.entries(APEPDCL_LT_FIELDS)) {
    const value = grab(text, regex);
    if (value) out[field] = transform ? transform(value) : value;
  }

  // Use contracted load for sizing (this is what APEPDCL calls "Contracted Load (KW)")
  if (out.contractedLoadKw) {
    out.connectedLoadKw = out.contractedLoadKw;
  }

  // Calculate kWh and kVAh from meter readings
  // IMPORTANT: Bill does NOT print these directly - must compute from readings × MF
  const mf = out.mf || 1;
  if (out.presentKwh && out.previousKwh) {
    out.kwh = Math.round((out.presentKwh - out.previousKwh) * mf);
  }
  if (out.presentKvah && out.previousKvah) {
    out.kvah = Math.round((out.presentKvah - out.previousKvah) * mf);
  }

  // Fallback: use billedUnits as kvah if readings not available
  if (!out.kvah && out.billedUnits) {
    out.kvah = out.billedUnits;
    out._kvahNote = "Using Billed Units as kVAh (readings not found)";
  }

  // Calculate power factor
  if (out.kwh && out.kvah && out.kvah > 0) {
    out.powerFactor = parseFloat((out.kwh / out.kvah).toFixed(3));
  }

  // Calculate effective tariff (post-subsidy for subsidised consumers)
  if (out.netBillAmount && out.billedUnits && out.billedUnits > 0) {
    out.effectiveTariff = parseFloat((out.netBillAmount / out.billedUnits).toFixed(3));
    out._tariffNote = "Post-subsidy effective rate";
  } else if (out.energyCharges && out.kvah && out.kvah > 0) {
    out.effectiveTariff = parseFloat((out.energyCharges / out.kvah).toFixed(2));
  }

  // For display: use contractedLoadKw as the main load figure
  if (out.contractedLoadKw && !out.recordedMdKw) {
    out.recordedMdKw = out.contractedLoadKw; // Use contracted as reference for sizing
  }

  return out;
}

// ===== APEPDCL Bill Fetch Flow (LT) =====
// This is a multi-step flow requiring session cookies and captcha
async function fetchApepdclLtBill(scno) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 30000);

  try {
    // Common headers
    const browserHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    };

    // Step 1: GET /payWithoutLogin to establish session
    const step1 = await fetch(APEPDCL_PAY_PAGE, {
      signal: ctrl.signal,
      headers: { ...browserHeaders, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    if (!step1.ok) throw new Error(`Step 1 failed: ${step1.status}`);

    // Extract cookies from response
    const cookies = step1.headers.get("set-cookie") || "";
    const cookieHeader = cookies.split(",").map(c => c.split(";")[0].trim()).join("; ");

    // Step 2: POST /generateCaptcha to get captcha token
    // The trick: server returns plain text, and we use SAME value for both hdncaptcha and ansCaptcha1
    const step2 = await fetch(APEPDCL_CAPTCHA, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        ...browserHeaders,
        "Cookie": cookieHeader,
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": APEPDCL_BASE,
        "Referer": APEPDCL_PAY_PAGE,
      },
      body: "",
    });
    if (!step2.ok) throw new Error(`Step 2 (captcha) failed: ${step2.status}`);
    const captcha = (await step2.text()).trim();

    // Step 3: POST /getLTOnlinePayData with navigation headers (NOT XHR)
    const formBody = `ltscno=${encodeURIComponent(scno)}&hdncaptcha=${encodeURIComponent(captcha)}&ansCaptcha1=${encodeURIComponent(captcha)}`;
    const step3 = await fetch(APEPDCL_GET_BILL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        ...browserHeaders,
        "Cookie": cookieHeader,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Origin": APEPDCL_BASE,
        "Referer": APEPDCL_PAY_PAGE,
        "Upgrade-Insecure-Requests": "1",
        // IMPORTANT: NO X-Requested-With header - this must be a navigation POST
      },
      body: formBody,
    });
    if (!step3.ok) throw new Error(`Step 3 (bill data) failed: ${step3.status}`);
    const billSummaryHtml = await step3.text();

    // Check if we got the bill page (not login redirect)
    if (!billSummaryHtml.includes("Service Number") && !billSummaryHtml.includes("Bill Date")) {
      throw new Error("Bill summary page not returned - may be invalid SC number or session issue");
    }

    // Step 4: POST /getChatboxBill to get eBillParam
    const step4 = await fetch(APEPDCL_CHATBOX, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        ...browserHeaders,
        "Cookie": cookieHeader,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest", // This one IS an XHR
        "Origin": APEPDCL_BASE,
        "Referer": APEPDCL_GET_BILL,
      },
      body: `ltscno=${encodeURIComponent(scno)}`,
    });

    let eBillParam = null;
    if (step4.ok) {
      try {
        const chatboxJson = await step4.json();
        eBillParam = chatboxJson.eBillParam || chatboxJson.ebillParam || null;
        if (eBillParam) {
          eBillParam = eBillParam.trim().replace(/[\r\n]/g, "");
        }
      } catch (e) {
        // JSON parse failed - eBill not available
      }
    }

    // Step 5: GET /viewEbill if we have eBillParam
    let eBillHtml = null;
    let eBillUrl = null;
    if (eBillParam) {
      eBillUrl = APEPDCL_EBILL(eBillParam);
      const step5 = await fetch(eBillUrl, {
        signal: ctrl.signal,
        headers: {
          ...browserHeaders,
          "Cookie": cookieHeader,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Referer": APEPDCL_GET_BILL,
        },
      });
      if (step5.ok) {
        eBillHtml = await step5.text();
      }
    }

    // Return the best HTML we have (prefer eBill for detailed data)
    return {
      html: eBillHtml || billSummaryHtml,
      sourceUrl: eBillUrl || APEPDCL_GET_BILL,
      hasEbill: !!eBillHtml,
    };

  } finally {
    clearTimeout(timeout);
  }
}

// ----- Fetch with timeout + browser-like headers -----
async function fetchBill(url) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20000);
  try {
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!resp.ok) throw new Error(`upstream returned ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timeout);
  }
}

// ----- Main handler -----
async function handleBill(req, url) {
  const scno = (url.searchParams.get("scno") || "").trim();
  let type = (url.searchParams.get("type") || "").toUpperCase();
  let utility = (url.searchParams.get("utility") || "").toUpperCase();

  if (!scno) {
    return jsonResponse(req, { ok: false, error: "Missing scno parameter" }, 400);
  }

  // Auto-detect utility if not specified
  if (!["TSSPDCL", "APEPDCL"].includes(utility)) {
    utility = detectUtility(scno) || "TSSPDCL"; // Default to TSSPDCL
  }

  // Auto-detect connection type if not specified
  if (!["LT", "HT"].includes(type)) {
    type = detectType(scno);
    if (!type) {
      return jsonResponse(req, {
        ok: false,
        error: "Could not auto-detect connection type. Pass type=LT or type=HT.",
      }, 400);
    }
  }

  // ===== APEPDCL Handling =====
  if (utility === "APEPDCL") {
    // APEPDCL HT requires login - not publicly accessible
    if (type === "HT") {
      return jsonResponse(req, {
        ok: false,
        error: "APEPDCL HT bills require consumer login and are not publicly accessible. Please enter bill data manually or provide the bill PDF.",
        utility,
        type,
      }, 400);
    }

    // APEPDCL LT - use multi-step fetch flow
    try {
      const result = await fetchApepdclLtBill(scno);
      const html = result.html;

      // Validate we got a bill
      const looksValid = /Service\s*Number|Bill\s*Date|APEPDCL|kWh|kVAh/i.test(html);
      if (!looksValid) {
        return jsonResponse(req, {
          ok: false,
          error: "APEPDCL returned a page but no bill markers found. Verify USC number.",
          utility,
          sourceUrl: result.sourceUrl,
        }, 404);
      }

      const parsed = parseApepdclLtBill(html);
      parsed.utility = "APEPDCL";
      parsed._hasEbill = result.hasEbill;

      return jsonResponse(req, {
        ok: true,
        scno,
        type: "LT",
        utility: "APEPDCL",
        sourceUrl: result.sourceUrl,
        data: parsed,
      });
    } catch (e) {
      return jsonResponse(req, {
        ok: false,
        error: `APEPDCL fetch failed: ${e.message}`,
        utility: "APEPDCL",
      }, 502);
    }
  }

  // ===== TSSPDCL Handling (default) =====
  const targetUrl = type === "HT" ? TSSPDCL_HT_URL(scno) : TSSPDCL_LT_URL(scno);

  try {
    const html = await fetchBill(targetUrl);

    // Sanity check — TGSPDCL returns HTML even for invalid SC numbers, but bill
    // markers should be present for a real bill.
    const looksValid = type === "HT"
      ? /Consumer\s*Number|Contracted\s*MD|Total\s*Consumption|H\.T C\.C\. Bill/i.test(html)
      : /USC\s*No|UNITS|BILL\s*AMOUNT|Recorded\s*MD/i.test(html);

    if (!looksValid) {
      return jsonResponse(req, {
        ok: false,
        error: "Upstream returned a page but no bill markers found. Verify SC number.",
        utility: "TSSPDCL",
        sourceUrl: targetUrl,
      }, 404);
    }

    const parsed = type === "HT" ? parseHtBill(html) : parseLtBill(html);
    parsed.utility = "TSSPDCL";

    return jsonResponse(req, {
      ok: true,
      scno,
      type,
      utility: "TSSPDCL",
      sourceUrl: targetUrl,
      data: parsed,
    });
  } catch (e) {
    return jsonResponse(req, {
      ok: false,
      error: `Fetch failed: ${e.message}`,
      utility: "TSSPDCL",
      sourceUrl: targetUrl,
    }, 502);
  }
}

// ----- Entry point -----
export default {
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    if (url.pathname === "/api/health") {
      return jsonResponse(req, { ok: true, service: "apfc-bill-fetcher", time: new Date().toISOString() });
    }

    if (url.pathname === "/api/bill") {
      return handleBill(req, url);
    }

    return jsonResponse(req, {
      ok: false,
      error: "Not found",
      endpoints: ["/api/bill?scno=&type=", "/api/health"],
    }, 404);
  },
};
