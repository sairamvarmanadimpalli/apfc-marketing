/**
 * APFC Bill Fetcher — Cloudflare Worker
 * DeepAndWide Technologies Pvt. Ltd.
 *
 * Endpoints:
 *   GET /api/bill?scno=113400807&type=LT
 *   GET /api/bill?scno=MCL3800&type=HT
 *   GET /api/bill?scno=113400807            (auto-detects type)
 *   GET /api/health
 *
 * Returns JSON with parsed bill data + the original URL used.
 *
 * Deploy:
 *   npm i -g wrangler
 *   wrangler deploy
 */

const LT_URL = (scno) =>
  `https://tgsouthernpower.org/ops/DuplicateBill4Login.jsp?ctscno=${encodeURIComponent(scno)}`;

const HT_URL = (scno) =>
  `https://webportal.tgsouthernpower.org/HTBilling/MeterDetails/HTBillSet_BillViewGen.jsp?htscno=${encodeURIComponent(scno)}`;

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
// LT: pure digits, 9-15 length (e.g. 113400807)
// HT: starts with 3 letters + digits (e.g. MCL3800, SEC1727, IBM1234)
function detectType(scno) {
  const s = (scno || "").trim().toUpperCase();
  if (/^[A-Z]{2,4}\d+$/.test(s)) return "HT";
  if (/^\d{6,15}$/.test(s)) return "LT";
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

  if (!scno) {
    return jsonResponse(req, { ok: false, error: "Missing scno parameter" }, 400);
  }

  if (!["LT", "HT"].includes(type)) {
    type = detectType(scno);
    if (!type) {
      return jsonResponse(req, {
        ok: false,
        error: "Could not auto-detect connection type. Pass type=LT or type=HT.",
      }, 400);
    }
  }

  const targetUrl = type === "HT" ? HT_URL(scno) : LT_URL(scno);

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
        sourceUrl: targetUrl,
      }, 404);
    }

    const parsed = type === "HT" ? parseHtBill(html) : parseLtBill(html);

    return jsonResponse(req, {
      ok: true,
      scno,
      type,
      sourceUrl: targetUrl,
      data: parsed,
    });
  } catch (e) {
    return jsonResponse(req, {
      ok: false,
      error: `Fetch failed: ${e.message}`,
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
