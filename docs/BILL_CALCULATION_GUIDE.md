# APFC Bill Fetching & Calculation Guide

## HT (High Tension) vs LT (Low Tension) — Complete Technical Reference

This document explains how the APFC calculator fetches electricity bills from TSSPDCL (Telangana Southern Power Distribution Company Limited) and calculates panel sizing and ROI for both HT and LT connections.

---

## Table of Contents

1. [Overview](#overview)
2. [Bill Fetching](#bill-fetching)
3. [LT (Low Tension) Calculations](#lt-low-tension-calculations)
4. [HT (High Tension) Calculations](#ht-high-tension-calculations)
5. [Panel Sizing Algorithm](#panel-sizing-algorithm)
6. [Pricing Structure](#pricing-structure)
7. [API Reference](#api-reference)
8. [Field Mappings](#field-mappings)
9. [Test SC Numbers](#test-sc-numbers)

---

## Overview

### System Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│   Frontend      │────▶│   Cloudflare Worker  │────▶│   TSSPDCL Website   │
│   (React/Vite)  │◀────│   (Bill Parser API)  │◀────│   (Source Bills)    │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │   Google Apps Script │
                        │   (Lead Capture)     │
                        └──────────────────────┘
```

### Key Differences: HT vs LT

| Aspect | LT (Low Tension) | HT (High Tension) |
|--------|------------------|-------------------|
| **Voltage** | Below 1000V (typically 415V) | Above 1000V (typically 11kV, 33kV) |
| **SC Number Format** | Pure digits (6-15 chars) | Letter prefix + digits (e.g., MCL3800) |
| **RMD Unit** | **kW** (kilowatts) | **kVA** (kilovolt-amperes) |
| **Bill Source** | tgsouthernpower.org | webportal.tgsouthernpower.org |
| **kVAR Calculation** | `Contracted_Load_kW × 0.8` | `Contracted_Load_kVA × 0.8` |
| **Typical Load** | < 100 kW | 100+ kVA |

---

## Bill Fetching

### Auto-Detection Logic

The system automatically detects connection type from the SC number:

```javascript
function detectType(scno) {
  const s = scno.trim().toUpperCase();

  // HT: Letters prefix + digits (e.g., MCL3800, SEC1727, IBM1234)
  if (/^[A-Z]{2,4}\d+$/.test(s)) return "HT";

  // LT: Pure digits, 6-15 characters (e.g., 113400807)
  if (/^\d{6,15}$/.test(s)) return "LT";

  return null; // Unknown format
}
```

### Bill Source URLs

| Type | URL Pattern |
|------|-------------|
| **LT** | `https://tgsouthernpower.org/ops/DuplicateBill4Login.jsp?ctscno={SC_NO}` |
| **HT** | `https://webportal.tgsouthernpower.org/HTBilling/MeterDetails/HTBillSet_BillViewGen.jsp?htscno={SC_NO}` |

### Validation Markers

The worker validates fetched HTML contains expected bill markers:

**LT Bills must contain:**
- `USC No` or `UNITS` or `BILL AMOUNT` or `Recorded MD`

**HT Bills must contain:**
- `Consumer Number` or `Contracted MD` or `Total Consumption` or `H.T C.C. Bill`

---

## LT (Low Tension) Calculations

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│  LT BILL PARSING                                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Fetch HTML from tgsouthernpower.org                     │
│                                                              │
│  2. Extract key fields via regex:                            │
│     • Connected Load (kW)                                    │
│     • Recorded MD (kW)                                       │
│     • kVAh (billed units)                                    │
│     • Meter readings → calculate kWh                         │
│     • Multiplying Factor (MF)                                │
│                                                              │
│  3. Calculate Power Factor:                                  │
│     PF = kWh / kVAh                                          │
│                                                              │
│  4. Calculate Required kVAR:                                 │
│     kVAR = Contracted_Load_kW × 0.8                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### LT kWh Calculation (from Meter Readings)

LT bills often only show kVAh directly. kWh is calculated from meter readings:

```javascript
// Extract Present and Previous readings from table
const presentMatch = text.match(/Present\s+\d{2}\/\d{2}\/\d{2}\s+\d+\s+(\d+)/i);
const previousMatch = text.match(/Previous\s+\d{2}\/\d{2}\/\d{2}\s+\d+\s+(\d+)/i);

if (presentMatch && previousMatch && mf) {
  const presentReading = parseInt(presentMatch[1], 10);
  const previousReading = parseInt(previousMatch[1], 10);
  kwh = Math.round((presentReading - previousReading) * mf);
}
```

### LT Fields Extracted

| Field | Regex Pattern | Transform |
|-------|---------------|-----------|
| `uscNo` | `/USC\s*No\.?\s*:?\s*(\d{6,15})/i` | — |
| `scNo` | `/SC\s*No\.?\s*:?\s*([\d\s]{6,20})/i` | — |
| `consumerName` | `/Name\s*:?\s*\*?\*?\s*([A-Z][A-Z\s.\/&-]{1,60}?)\s*\*?\*?\s*Address/i` | — |
| `connectedLoadKw` | `/CONTRACTED\s*LOAD\s*:?\s*([\d.]+)\s*KW/i` | parseFloat |
| `recordedMdKw` | `/Recorded\s*MD\s*\n?\s*([\d.]+)\s*KW/i` | parseFloat |
| `kvah` | `/UNITS\s*:?\s*(\d+)/i` | parseInt |
| `mf` | `/MF\s*:?\s*([\d.]+)/i` | parseFloat |
| `billAmount` | `/BILL\s*AMOUNT\s*\*?\*?\s*([\d.]+)/i` | parseFloat |
| `phase` | `/PH\s*:?\s*(\d)/i` | parseInt |

### LT kVAR Sizing Formula

```
Required kVAR = Contracted_Load (kW) × 0.8
```

**Example:**
- Contracted Load = 39 kW
- Required kVAR = 39 × 0.8 = 31.2
- Rounded to nearest 5 = **35 kVAR**

---

## HT (High Tension) Calculations

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│  HT BILL PARSING                                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Fetch HTML from webportal.tgsouthernpower.org           │
│                                                              │
│  2. Extract key fields via regex:                            │
│     • Contracted MD (kVA)                                    │
│     • Recorded MD (kVA) — from "Total Consumption" row       │
│     • kWh and kVAh consumption                               │
│     • Energy Charge Rate (Ps./unit → Rs./unit)               │
│     • Specified/Actual Voltage (kV)                          │
│                                                              │
│  3. Calculate Power Factor (for reference):                  │
│     PF = kWh / kVAh                                          │
│                                                              │
│  4. Calculate Required kVAR:                                 │
│     kVAR = Contracted_Load_kVA × 0.8                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### HT Total Consumption Row Parsing

HT bills have a "Total Consumption" row with this structure:

```
Total Consumption   KWH    KVAH    KVA    TOD1   TOD2
                    53707  54083   127.64  ...    ...
```

Regex extraction:
```javascript
const totalRow = text.match(
  /Total\s*Consumption\s+(\d+)\s+(\d+)\s+([\d.]+)(?:\s+(\d+)\s+(\d+))?/i
);
if (totalRow) {
  kwh = parseInt(totalRow[1], 10);        // 53707
  kvah = parseInt(totalRow[2], 10);       // 54083
  recordedMdKva = parseFloat(totalRow[3]); // 127.64 (this is RMD!)
}
```

### HT Fields Extracted

| Field | Regex Pattern | Transform |
|-------|---------------|-----------|
| `scNo` | `/Consumer\s*Number\s+([A-Z0-9]{3,20})/i` | — |
| `consumerName` | `/Name\s+([A-Z][A-Z0-9\s.,&\/\-()]{2,80}?)\s+(?:Address|Specified...)/i` | — |
| `contractedMdKva` | `/Contracted\s*MD\s*\(KVA\/HP\)\s+([\d.]+)/i` | parseFloat |
| `specifiedVoltageKv` | `/Specified\s*Voltage\s*\(KV\)\s+([\d.]+)/i` | parseFloat |
| `mf` | `/Multiplying\s*Factor\s+(\d+(?:\.\d+)?)/i` | parseFloat |
| `billMonth` | `/Bill\s*cum\s*Demand\s*Notice...\s+([A-Za-z]+\s*\d{4})/i` | — |
| `energyChargeRate` | `/Energy\s*Charges\s+Ps\.\s*(\d+)/i` | `value / 100` |
| `billAmount` | `/Total\s*Amount\s*Payable\s+([\d.,]+)/i` | parseFloat |

### HT Energy Charge Conversion

HT bills show energy charge in **paise per unit**:
```
Energy Charges Ps. 880  →  ₹8.80 per unit
```

```javascript
const ecPs = grab(text, /Energy\s*Charges\s+Ps\.\s*(\d+)/i);
if (ecPs) {
  energyChargeRate = parseInt(ecPs, 10) / 100; // paise → rupees
}
```

### HT kVAR Sizing Formula

```
Required kVAR = Contracted_Load_kVA × 0.8
```

> **Note:** For HT connections, we use the **Contracted MD (kVA)** from the bill, not the Recorded MD. This represents the sanctioned load capacity.

**Example:**
- Contracted MD = 200 kVA

**Calculation:**
1. Required kVAR = 200 × 0.8 = **160**
2. Rounded to nearest 10 = **160 kVAR**

### Power Factor (Reference Only)

Power Factor is calculated for reference/display but not used in kVAR sizing:

```
PF = kWh / kVAh
```

Example: PF = 53,707 / 54,083 = **0.993**

---

## Panel Sizing Algorithm

### Step Progression Rules

1. **Rounding Rules:**
   - kVAR ≤ 45: Round to nearest 5
   - kVAR > 45: Round to nearest 10

2. **Standard Panel Configurations (up to 120 kVAR):**

| Rating | Steps |
|--------|-------|
| 11 kVAR | [1, 2, 3, 5] |
| 15 kVAR | [2, 3, 5, 5] |
| 20 kVAR | [2, 3, 5, 10] |
| 25 kVAR | [2, 3, 5, 5, 10] |
| 30 kVAR | [2, 3, 5, 10, 10] |
| 35 kVAR | [2, 3, 5, 5, 10, 10] |
| 40 kVAR | [2, 3, 5, 10, 20] |
| 45 kVAR | [2, 3, 5, 5, 10, 20] |
| 50 kVAR | [2, 3, 5, 10, 10, 20] |
| 60 kVAR | [2, 3, 5, 10, 20, 20] |
| 70 kVAR | [2, 3, 5, 10, 10, 20, 20] |
| 80 kVAR | [2, 3, 5, 10, 20, 20, 20] |
| 90 kVAR | [2, 3, 5, 10, 10, 20, 20, 20] |
| 100 kVAR | [2, 3, 5, 10, 20, 20, 20, 20] |
| 110 kVAR | [2, 3, 5, 10, 10, 20, 20, 20, 20] |
| 120 kVAR | [2, 3, 5, 10, 20, 20, 20, 20, 20] |

3. **Oscillation Prevention Rule:**
   > Each step must be ≤ sum of all previous steps

4. **Custom Configuration (> 120 kVAR):**
   - Base: [2, 3, 5]
   - Fill remaining with greedy selection from [40, 20, 10, 5]
   - Max 16 channels, then combine capacitors

---

## Pricing Structure

### Per-Step Pricing

| Capacitor Size | Price |
|----------------|-------|
| 1 kVAR | ₹2,400 |
| 2 kVAR | ₹4,000 |
| 3 kVAR | ₹5,400 |
| 5 kVAR | ₹8,000 |
| 10 kVAR | ₹14,000 |
| 20 kVAR | ₹28,000 |
| 40 kVAR | ₹56,000 |
| Other | ₹1,400/kVAR |

### Additional Charges & Discounts

| Item | Amount |
|------|--------|
| **Minimum Charge** | +₹3,000 (if panel cost < ₹40,000) |
| **Without Installation** | -5% discount |
| **Custom Add-on** | +1 or +2 kVAR at step price |

### Cost Calculation Formula

```javascript
function calculatePanelCost(steps, customAddon, withoutInstallation) {
  let baseCost = steps.reduce((total, step) => total + priceForStep(step), 0);

  if (customAddon > 0) {
    baseCost += priceForStep(customAddon);
  }

  if (baseCost < 40000) {
    baseCost += 3000; // Minimum charge
  }

  if (withoutInstallation) {
    baseCost = baseCost * 0.95; // 5% discount
  }

  return Math.round(baseCost);
}
```

---

## API Reference

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bill` | GET | Fetch and parse bill |
| `/api/health` | GET | Health check |

### Bill Fetch Request

```
GET /api/bill?scno={SC_NUMBER}&type={LT|HT}
```

**Parameters:**
- `scno` (required): Service Connection number
- `type` (optional): `LT` or `HT`. Auto-detected if omitted.

### Response Format

```json
{
  "ok": true,
  "scno": "113400807",
  "type": "LT",
  "sourceUrl": "https://tgsouthernpower.org/...",
  "data": {
    "type": "LT",
    "consumerName": "B SRINIVAS",
    "connectedLoadKw": 39,
    "recordedMdKw": 36.54,
    "kvah": 8935,
    "kwh": 7674,
    "powerFactor": 0.859,
    "billAmount": 58241.00,
    "_raw": "... first 4000 chars of parsed text ..."
  }
}
```

### Error Response

```json
{
  "ok": false,
  "error": "Upstream returned a page but no bill markers found. Verify SC number.",
  "sourceUrl": "https://..."
}
```

---

## Field Mappings

### LT Bill → Calculator Form

| Bill Field | Form Field | Notes |
|------------|------------|-------|
| `connectedLoadKw` | Connected Load | **Used for kVAR sizing** (`× 0.8`) |
| `recordedMdKw` | Recorded MD | For reference only |
| `kvah` | kVAh billed | From UNITS field |
| `kwh` | kWh consumed | Calculated from meter readings × MF |
| `effectiveTariff` | Tariff | `energyCharges / kvah` |
| `powerFactor` | Power Factor | `kwh / kvah` (reference only) |

### HT Bill → Calculator Form

| Bill Field | Form Field | Notes |
|------------|------------|-------|
| `contractedMdKva` | Connected Load | **Used for kVAR sizing** (`× 0.8`) |
| `recordedMdKva` | Recorded MD | From Total Consumption row (for reference) |
| `kvah` | kVAh billed | From Total Consumption row |
| `kwh` | kWh consumed | From Total Consumption row |
| `energyChargeRate` | Tariff | Converted from paise to rupees |
| `powerFactor` | Power Factor | `kwh / kvah` (reference only) |

---

## ROI Calculation

### Reactive Loss Estimation

```javascript
const reactiveDiff = Math.max(0, kvah - kwh);  // Reactive energy penalty
const monthlyLossRs = reactiveDiff * tariff;   // Monthly loss in ₹
const annualLossRs = monthlyLossRs * 12;       // Annual loss
```

### ROI (Payback Period)

```javascript
const roiMonths = panelCost / monthlyLossRs;
```

**Example:**
- Panel Cost: ₹45,000
- Monthly Loss: ₹8,500
- ROI = 45,000 / 8,500 = **5.3 months**

---

## Test SC Numbers

| SC Number | Type | Status | Notes |
|-----------|------|--------|-------|
| 113400807 | LT | ✓ Verified | Full bill data available |
| 110436036 | LT | Example | Test candidate |
| SEC2112 | HT | ✓ Verified | Osmania University, full bill |
| MCL3800 | HT | Example | Test candidate |
| SEC1727 | HT | Example | Test candidate |

---

## Summary: Complete Calculation Flow

### LT Connection

```
1. Input: SC Number (digits only, e.g., 113400807)
2. Fetch bill from tgsouthernpower.org
3. Extract: Contracted Load (kW), kVAh, Meter Readings
4. Calculate kWh = (Present - Previous) × MF
5. Calculate PF = kWh / kVAh (for reference)
6. Calculate Required kVAR = Contracted_Load_kW × 0.8
7. Round to nearest 5 kVAR
8. Select matching panel configuration
9. Calculate panel cost from step prices
10. Calculate ROI = Panel Cost / Monthly Loss
```

### HT Connection

```
1. Input: SC Number (letters + digits, e.g., MCL3800)
2. Fetch bill from webportal.tgsouthernpower.org
3. Extract: Contracted MD (kVA), kWh, kVAh
4. Calculate PF = kWh / kVAh (for reference/display)
5. Calculate Required kVAR = Contracted_Load_kVA × 0.8
6. Round to nearest 5/10 kVAR
7. Select matching panel configuration
8. Calculate panel cost from step prices
9. Calculate ROI = Panel Cost / Monthly Loss
```

---

## Contact

**Deep & Wide Technologies Pvt. Ltd.**
- Phone: +91 83748 40074
- Email: hello@deepandwide.in
- Locations: Hyderabad · Tirupati · Goa · Muramalla

---

*Document generated for internal reference. Last updated: 2026*
