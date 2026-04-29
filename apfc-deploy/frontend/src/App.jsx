import React, { useState, useMemo, useEffect } from "react";
import {
  Download, RefreshCw, AlertCircle, CheckCircle2, Loader2, ExternalLink, Zap
} from "lucide-react";

/**
 * APFC One-Card Sales Pitch Generator — DeepAndWide Technologies
 *
 * Pricing rule:
 *   <  25 kVAR -> Rs. 2000 / kVAR
 *   25-35 kVAR -> Rs. 1800 / kVAR
 *   >  35 kVAR -> Rs. 1500 / kVAR
 *
 * Backend: Cloudflare Worker at API_BASE serving /api/bill?scno=&type=
 * Override via ?api=https://your-worker.workers.dev for staging.
 */

// ---------------------------------------------------------------------------
// CONFIG — change this after you deploy the Worker
// ---------------------------------------------------------------------------
const DEFAULT_API_BASE = "https://apfc-bill-fetcher.sairamvarmanadimpalli.workers.dev";

function getApiBase() {
  const params = new URLSearchParams(window.location.search);
  return params.get("api") || DEFAULT_API_BASE;
}

// ---------------------------------------------------------------------------
// PRICING & SIZING (Actual DeepAndWide panel configurations)
// ---------------------------------------------------------------------------

// Actual panel SKUs manufactured by DeepAndWide
const PANEL_CONFIGS = [
  { rating: 11, steps: [1, 2, 3, 5] },
  { rating: 15, steps: [2, 3, 5, 5] },
  { rating: 20, steps: [2, 3, 5, 10] },
  { rating: 25, steps: [2, 3, 5, 5, 10] },
  { rating: 30, steps: [2, 3, 5, 10, 10] },
  { rating: 35, steps: [2, 3, 5, 5, 10, 10] },
  { rating: 40, steps: [2, 3, 5, 10, 20] },
  { rating: 45, steps: [2, 3, 5, 5, 10, 20] },
  { rating: 50, steps: [2, 3, 5, 10, 10, 20] },
  { rating: 60, steps: [2, 3, 5, 10, 20, 20] },
  { rating: 70, steps: [2, 3, 5, 10, 10, 20, 20] },
  { rating: 80, steps: [2, 3, 5, 10, 20, 20, 20] },
  { rating: 90, steps: [2, 3, 5, 10, 10, 20, 20, 20] },
  { rating: 100, steps: [2, 3, 5, 10, 20, 20, 20, 20] },
  { rating: 110, steps: [2, 3, 5, 10, 10, 20, 20, 20, 20] },
  { rating: 120, steps: [2, 3, 5, 10, 20, 20, 20, 20, 20] },
];

// Calculate cost for a single capacitor step (20% reduced from original)
function priceForStep(stepKvar) {
  if (stepKvar === 1) return 2400;
  if (stepKvar === 2) return 4000;
  if (stepKvar === 3) return 6000;
  if (stepKvar === 5) return 8000;
  if (stepKvar === 10) return 14400;
  if (stepKvar === 20) return 24000;
  if (stepKvar === 40) return 48000;
  // Fallback for any other size
  return stepKvar * 1200;
}

// Calculate total panel cost from step configuration
function calculatePanelCost(steps) {
  return steps.reduce((total, step) => total + priceForStep(step), 0);
}

function pickStepProgression(requiredKvar) {
  // Rounding rules: ≤45 → nearest 5, >45 → nearest 10
  let rounded;
  if (requiredKvar <= 45) {
    rounded = Math.ceil(requiredKvar / 5) * 5;
  } else {
    rounded = Math.ceil(requiredKvar / 10) * 10;
  }

  // Find the smallest standard panel that meets or exceeds the requirement
  const panel = PANEL_CONFIGS.find(p => p.rating >= rounded);

  if (panel) {
    return {
      steps: panel.steps,
      total: panel.rating,
      oversized: false
    };
  }

  // For loads > 120 kVAR, build custom configuration
  // Rule: Each step must be ≤ sum of all previous steps (prevents oscillation)
  const steps = [2, 3, 5]; // Fixed base steps
  let sumSoFar = 10; // 2+3+5
  let remaining = rounded - sumSoFar;

  // Available capacitor sizes
  const availableSteps = [40, 20, 10, 5]; // Largest to smallest

  while (remaining > 0 && steps.length < 16) {
    // Find largest step that:
    // 1. Doesn't exceed sum of all previous steps
    // 2. Helps us reach the target
    let chosenStep = null;

    for (const step of availableSteps) {
      if (step <= sumSoFar && step <= remaining + 10) {
        chosenStep = step;
        break;
      }
    }

    // If no step fits the sum rule, use the sum itself
    if (!chosenStep) {
      chosenStep = Math.min(sumSoFar, remaining);
      // Round to nearest available step
      if (chosenStep >= 35) chosenStep = 40;
      else if (chosenStep >= 15) chosenStep = 20;
      else if (chosenStep >= 7) chosenStep = 10;
      else chosenStep = 5;
    }

    steps.push(chosenStep);
    sumSoFar += chosenStep;
    remaining -= chosenStep;
  }

  // If still need more capacity after 16 channels, use combined capacitors
  while (remaining > 0) {
    // Use 40 kVAR (20+20 combined), respecting sum rule
    const maxAllowed = sumSoFar; // Can't exceed sum of previous
    const step = Math.min(40, maxAllowed, remaining + 10);
    steps.push(step);
    sumSoFar += step;
    remaining -= step;
  }

  const total = steps.reduce((sum, s) => sum + s, 0);

  return {
    steps,
    total,
    oversized: total > 120 // Show note for custom configs
  };
}

// HT vs LT auto-detect — letters prefix = HT (e.g. MCL3800), pure digits = LT
function detectType(scno) {
  const s = (scno || "").trim().toUpperCase();
  if (/^[A-Z]{2,4}\d+$/.test(s)) return "HT";
  if (/^\d{6,15}$/.test(s)) return "LT";
  return null;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
export default function App() {
  const [apiBase] = useState(getApiBase());
  const [scno, setScno] = useState("");
  const [serviceType, setServiceType] = useState("AUTO"); // AUTO | LT | HT
  const [customerName, setCustomerName] = useState("");
  const [connectedLoad, setConnectedLoad] = useState("");
  const [recordedMd, setRecordedMd] = useState("");
  const [kwh, setKwh] = useState("");
  const [kvah, setKvah] = useState("");
  const [tariff, setTariff] = useState("8.18");
  const [fetchState, setFetchState] = useState("idle");
  const [fetchMsg, setFetchMsg] = useState("");
  const [billPreview, setBillPreview] = useState(null);
  const [resolvedType, setResolvedType] = useState(null);

  // Re-detect type when SC number changes (if user hasn't manually picked)
  useEffect(() => {
    if (serviceType === "AUTO") {
      const t = detectType(scno);
      if (t) setResolvedType(t);
    } else {
      setResolvedType(serviceType);
    }
  }, [scno, serviceType]);

  // Calculations
  const calc = useMemo(() => {
    const cl = parseFloat(connectedLoad) || 0;
    const rmd = parseFloat(recordedMd) || cl;
    const k = parseInt(kwh, 10) || 0;
    const va = parseInt(kvah, 10) || 0;
    const t = parseFloat(tariff) || 0;
    const reactiveDiff = Math.max(0, va - k);
    const monthlyLossRs = reactiveDiff * t;
    const annualLossRs = monthlyLossRs * 12;

    // kVAR sizing differs by service type:
    //   LT: RMD is in kW. Required kVAR = RMD_kW × 0.8 (Sairam's rule).
    //   HT: RMD is in kVA. Convert to kW using actual PF from bill (PF = kWh/kVAh),
    //       then apply × 0.8.
    let requiredKvarRaw = 0;
    let pfActual = null;
    if (resolvedType === "HT") {
      // Average PF over billing period
      pfActual = va > 0 ? k / va : null;
      const rmdKw = pfActual ? rmd * pfActual : rmd * 0.9; // assume 0.9 if PF unknown
      requiredKvarRaw = rmdKw * 0.8;
    } else {
      // LT
      requiredKvarRaw = rmd * 0.8;
    }

    const requiredKvar = Math.ceil(requiredKvarRaw / 5) * 5 || 0;
    const stepResult = pickStepProgression(requiredKvar);
    const recommendedKvar = stepResult.total;
    const panelCost = calculatePanelCost(stepResult.steps);
    const roiMonths = monthlyLossRs > 0 ? panelCost / monthlyLossRs : 0;
    return {
      reactiveDiff, monthlyLossRs, annualLossRs, requiredKvarRaw,
      recommendedKvar, panelCost, roiMonths,
      steps: stepResult.steps,
      oversized: stepResult.oversized,
      pfActual,
    };
  }, [connectedLoad, recordedMd, kwh, kvah, tariff, resolvedType]);

  const handleFetch = async () => {
    if (!scno.trim()) {
      setFetchState("error");
      setFetchMsg("Enter an SC number first.");
      return;
    }
    const type = serviceType === "AUTO" ? detectType(scno.trim()) : serviceType;
    if (!type) {
      setFetchState("error");
      setFetchMsg("Could not detect HT/LT — please pick manually above.");
      return;
    }
    setFetchState("loading");
    setFetchMsg(`Fetching ${type} bill from TGSPDCL…`);
    setBillPreview(null);

    try {
      const url = `${apiBase}/api/bill?scno=${encodeURIComponent(scno.trim())}&type=${type}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!json.ok) {
        setFetchState("error");
        setFetchMsg(json.error || "Backend returned an error.");
        return;
      }
      const d = json.data || {};
      setResolvedType(json.type);
      if (d.consumerName) setCustomerName(d.consumerName);

      // HT bills: contracted MD is in kVA. Use approx kW for display, or use contractedMdKva.
      // LT bills: use contractedLoadKw directly.
      if (d.connectedLoadKw) {
        setConnectedLoad(String(d.connectedLoadKw));
      } else if (d.contractedLoadKwApprox) {
        setConnectedLoad(String(d.contractedLoadKwApprox));
      } else if (d.contractedMdKva) {
        // For HT, use contracted MD in kVA as the "load" reference
        setConnectedLoad(String(d.contractedMdKva));
      }

      // Recorded MD: kW for LT, kVA for HT
      const rmdVal = d.recordedMdKw || d.recordedMdKva;
      if (rmdVal) setRecordedMd(String(rmdVal));

      if (d.kwh) setKwh(String(d.kwh));
      if (d.kvah) setKvah(String(d.kvah));

      // Auto-fill tariff from bill's actual energy charge rate (HT only — LT bills don't expose this clearly)
      if (d.energyChargeRate) setTariff(String(d.energyChargeRate));

      setBillPreview({
        type: json.type,
        name: d.consumerName,
        address: d.address,
        category: d.category,
        tariff: d.tariff,
        cl: d.connectedLoadKw || d.contractedLoadKwApprox,
        cmd: d.contractedMdKva,
        rmd: rmdVal,
        units: d.kwh,
        kvah: d.kvah,
        billAmt: d.billAmount,
        mf: d.mf,
        pf: d.powerFactor,
        rate: d.energyChargeRate,
        billMonth: d.billMonth,
        feeder: d.feeder,
        voltage: d.specifiedVoltageKv,
        sourceUrl: json.sourceUrl,
      });
      setFetchState("success");
      setFetchMsg(
        d.kvah
          ? `${json.type} bill auto-filled. Verify before sharing.`
          : `${json.type} bill fetched. kVAh not on this bill — enter manually if available.`
      );
    } catch (e) {
      setFetchState("error");
      setFetchMsg(`Network error: ${e.message}. Check backend URL or try manual entry.`);
    }
  };

  const fmtRs = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
  const handlePrint = () => window.print();

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--paper)",
      fontFamily: "'Outfit', sans-serif",
      color: "var(--ink)",
      padding: "0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

        :root {
          --ink: #1f1f1f;
          --ink-soft: #6b7280;
          --paper: #fffbfa;
          --paper-warm: #fff5f3;
          --accent: #f87171;
          --accent-dark: #dc2626;
          --accent-light: #fef2f2;
          --sand: #fef7f6;
          --line: rgba(31,31,31,.08);
          --shadow-sm: 0 1px 2px rgba(31,31,31,.04);
          --shadow: 0 4px 6px -1px rgba(31,31,31,.06), 0 2px 4px -2px rgba(31,31,31,.06);
          --shadow-lg: 0 10px 15px -3px rgba(31,31,31,.07), 0 4px 6px -4px rgba(31,31,31,.07);
          --radius: 12px;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; background: var(--paper); }

        /* Nav */
        .app-nav {
          position: sticky; top: 0; z-index: 50;
          backdrop-filter: blur(12px); background: rgba(255,255,255,.85);
          border-bottom: 1px solid var(--line);
        }
        .nav-inner {
          max-width: 1280px; margin: 0 auto; padding: 16px 32px;
          display: flex; justify-content: space-between; align-items: center; gap: 24px;
        }
        .logo {
          font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 15px;
          letter-spacing: -.01em; color: var(--ink);
        }
        .logo span { color: var(--accent); }
        .nav-kicker {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft);
          font-weight: 400;
        }

        /* Container */
        .container { max-width: 1280px; margin: 0 auto; padding: 48px 32px; }

        /* Header */
        .header {
          text-align: center; margin-bottom: 48px;
        }
        .header h1 {
          font-family: 'Outfit', sans-serif; font-weight: 800;
          font-size: clamp(32px, 5vw, 48px); line-height: 1.2;
          letter-spacing: -.03em; color: var(--ink); margin-bottom: 12px;
        }
        .header h1 em {
          font-style: normal; color: var(--accent); font-weight: 800;
        }
        .header .sub {
          font-size: 16px; color: var(--ink-soft); max-width: 580px;
          margin: 0 auto; line-height: 1.6;
        }

        /* Grid */
        .grid {
          display: grid; grid-template-columns: 1fr; gap: 24px;
        }
        @media (min-width: 900px) {
          .grid { grid-template-columns: 1fr 1fr; }
        }

        /* Panel */
        .panel {
          background: white; border: 1px solid var(--line);
          padding: 32px; border-radius: calc(var(--radius) * 1.5);
          box-shadow: var(--shadow);
        }
        .panel h2 {
          font-family: 'Outfit', sans-serif; font-weight: 700;
          font-size: 18px; color: var(--ink); margin: 0 0 24px 0;
          letter-spacing: -.01em; display: flex; align-items: center; gap: 8px;
        }
        .panel h2 .num {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--accent-light); color: var(--accent-dark);
          font-size: 13px; font-weight: 700;
        }

        /* Field */
        .field { margin-bottom: 20px; }
        .field label {
          display: block; font-family: 'Outfit', sans-serif;
          font-size: 13px; font-weight: 600; color: var(--ink);
          margin-bottom: 8px; letter-spacing: -.01em;
        }
        .field input, .field select {
          width: 100%; background: var(--paper); border: 1px solid var(--line);
          color: var(--ink); padding: 12px 14px;
          font-family: 'Outfit', sans-serif; font-size: 14px;
          border-radius: var(--radius); transition: all .2s;
          min-height: 44px;
        }
        .field input:focus, .field select:focus {
          outline: none; border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-light);
        }
        .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 720px) {
          .row2 { grid-template-columns: 1fr; }
        }

        /* Buttons */
        .btn-primary {
          background: var(--accent); color: white;
          padding: 14px 24px; font-size: 14px; font-weight: 600;
          font-family: 'Outfit', sans-serif;
          border: none; border-radius: var(--radius);
          cursor: pointer; display: inline-flex; align-items: center; gap: 10px;
          text-decoration: none; box-shadow: var(--shadow);
          transition: all .25s; min-height: 44px;
        }
        .btn-primary:hover {
          background: var(--accent-dark); transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-ghost {
          background: white; color: var(--ink);
          padding: 14px 20px; font-size: 14px; font-weight: 600;
          font-family: 'Outfit', sans-serif;
          border: 1px solid var(--line); border-radius: var(--radius);
          cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
          text-decoration: none; box-shadow: var(--shadow-sm);
          transition: all .25s; min-height: 44px;
        }
        .btn-ghost:hover {
          border-color: var(--accent); color: var(--accent);
          transform: translateY(-2px); box-shadow: var(--shadow);
        }

        .btn-row { display: flex; gap: 12px; flex-wrap: wrap; }

        /* Status */
        .status {
          margin-top: 16px; padding: 14px 16px; font-size: 13px;
          font-family: 'Outfit', sans-serif;
          border-radius: var(--radius); display: flex; gap: 10px;
          align-items: flex-start; line-height: 1.5;
        }
        .status.success {
          background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;
        }
        .status.error {
          background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;
        }
        .status.loading {
          background: #fffbeb; color: #92400e; border: 1px solid #fde68a;
        }

        /* Preview */
        .preview {
          margin-top: 20px; padding: 20px; background: var(--sand);
          border-radius: var(--radius); border: 1px solid var(--line);
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
          line-height: 1.8;
        }
        .preview .pk {
          color: var(--ink-soft); display: inline-block; min-width: 70px;
          font-weight: 600;
        }
        .preview .pv { color: var(--ink); }

        /* Type badge */
        .type-badge {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 4px 10px; background: var(--accent-light);
          color: var(--accent-dark); font-family: 'JetBrains Mono', monospace;
          font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
          margin-left: 8px; border-radius: 6px;
        }

        /* Calc rows */
        .calc-row {
          display: flex; justify-content: space-between; padding: 12px 0;
          border-bottom: 1px solid var(--line);
          font-family: 'Outfit', sans-serif; font-size: 14px;
        }
        .calc-row .k {
          color: var(--ink-soft); font-size: 13px; font-weight: 500;
        }
        .calc-row .v {
          color: var(--ink); font-weight: 600;
        }
        .calc-row .v.highlight {
          color: var(--accent-dark); font-weight: 700;
        }

        /* Print card */
        .card-wrap { display: flex; justify-content: center; padding: 32px 0; }
        .pitch-card {
          width: 380px; aspect-ratio: 1.75 / 1;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
          color: white; padding: 24px 26px;
          border-radius: calc(var(--radius) * 1.5);
          box-shadow: var(--shadow-lg); position: relative; overflow: hidden;
        }
        .pitch-card::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 50%);
          pointer-events: none;
        }
        .brand {
          font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase;
          font-family: 'JetBrains Mono', monospace; font-weight: 700;
          color: white; text-align: center; padding-bottom: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.3); position: relative;
        }
        .card-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px;
          margin-top: 16px; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; position: relative;
        }
        .field-row {
          display: flex; justify-content: space-between; align-items: center; gap: 8px;
        }
        .field-row .lbl {
          letter-spacing: 0.15em; text-transform: uppercase; font-size: 9px;
          color: rgba(255,255,255,0.9); font-weight: 700;
        }
        .field-row .val {
          background: white; color: var(--accent-dark);
          padding: 4px 10px; font-weight: 700; font-size: 11px;
          min-width: 60px; text-align: center; letter-spacing: 0.05em;
          border-radius: 4px;
        }
        .card-footer {
          position: absolute; bottom: 10px; left: 26px; right: 26px;
          font-size: 8px; font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.2em; color: rgba(255,255,255,0.8);
          display: flex; justify-content: space-between;
        }

        .actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

        .footer-note {
          margin-top: 48px; text-align: center;
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          color: var(--ink-soft); letter-spacing: 0.05em;
          border-top: 1px solid var(--line); padding-top: 24px;
        }

        @media (max-width: 720px) {
          .container { padding: 32px 20px; }
          .panel { padding: 24px 20px; }
          .header { margin-bottom: 32px; }
        }

        @media print {
          body { background: white !important; }
          .container > *:not(.print-area) { display: none !important; }
          .print-area { display: block !important; padding: 40px; }
        }
      `}</style>

      <nav className="app-nav">
        <div className="nav-inner">
          <div className="logo">Deep<span>&</span>Wide</div>
          <div className="nav-kicker">APFC Calculator · TSSPDCL</div>
        </div>
      </nav>

      <div className="container">
        <div className="header">
          <h1><em>APFC</em> Calculator</h1>
          <div className="sub">Auto-size panels and calculate ROI from TSSPDCL bills — LT and HT supported</div>
        </div>

        <div className="grid">
          <div className="panel">
            <h2>
              <span className="num">1</span>Service Lookup
              {resolvedType && <span className="type-badge">{resolvedType}</span>}
            </h2>
            <div className="field">
              <label>SC Number (LT digits like 113400807, HT codes like MCL3800)</label>
              <input
                value={scno}
                onChange={(e) => setScno(e.target.value)}
                placeholder="e.g. 113400807 or MCL3800"
                onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              />
            </div>
            <div className="field">
              <label>Connection Type</label>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                <option value="AUTO">AUTO — detect from SC number</option>
                <option value="LT">LT — Low Tension</option>
                <option value="HT">HT — High Tension</option>
              </select>
            </div>
            <div className="btn-row">
              <button className="btn-primary" onClick={handleFetch} disabled={fetchState === "loading"}>
                {fetchState === "loading"
                  ? <><Loader2 size={16} className="spin" /> Fetching…</>
                  : <><RefreshCw size={16} /> Fetch from TGSPDCL</>}
              </button>
              {billPreview?.sourceUrl && (
                <a href={billPreview.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                  <ExternalLink size={16} /> Open Source Bill
                </a>
              )}
            </div>

            {fetchMsg && (
              <div className={`status ${fetchState === "success" ? "success" : fetchState === "error" ? "error" : "loading"}`}>
                {fetchState === "success"
                  ? <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  : fetchState === "loading"
                    ? <Loader2 size={14} className="spin" style={{ flexShrink: 0, marginTop: 2 }} />
                    : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />}
                <span>{fetchMsg}</span>
              </div>
            )}

            {billPreview && (
              <div className="preview">
                <div><span className="pk">TYPE</span><span className="pv">{billPreview.type}</span></div>
                {billPreview.billMonth && (<div><span className="pk">MONTH</span><span className="pv">{billPreview.billMonth}</span></div>)}
                {billPreview.name && (<div><span className="pk">NAME</span><span className="pv">{billPreview.name}</span></div>)}
                {billPreview.address && (<div><span className="pk">ADDR</span><span className="pv">{billPreview.address}</span></div>)}
                {billPreview.category && (<div><span className="pk">CAT</span><span className="pv">{billPreview.category}</span></div>)}
                {billPreview.voltage && (<div><span className="pk">KV</span><span className="pv">{billPreview.voltage} kV</span></div>)}
                {billPreview.feeder && (<div><span className="pk">FEEDER</span><span className="pv">{billPreview.feeder}</span></div>)}
                {billPreview.cmd && (<div><span className="pk">CMD</span><span className="pv">{billPreview.cmd} kVA</span></div>)}
                {billPreview.cl && (<div><span className="pk">CL</span><span className="pv">{billPreview.cl} {billPreview.type === "HT" ? "kVA~" : "kW"}</span></div>)}
                {billPreview.rmd && (<div><span className="pk">RMD</span><span className="pv">{billPreview.rmd} {billPreview.type === "HT" ? "kVA" : "kW"}</span></div>)}
                {billPreview.units && (<div><span className="pk">KWH</span><span className="pv">{billPreview.units.toLocaleString("en-IN")}</span></div>)}
                {billPreview.kvah && (<div><span className="pk">KVAH</span><span className="pv">{billPreview.kvah.toLocaleString("en-IN")}</span></div>)}
                {billPreview.pf && (<div><span className="pk">PF</span><span className="pv">{billPreview.pf}</span></div>)}
                {billPreview.rate && (<div><span className="pk">RATE</span><span className="pv">₹{billPreview.rate}/unit</span></div>)}
                {billPreview.billAmt && (<div><span className="pk">BILL</span><span className="pv">₹{billPreview.billAmt.toLocaleString("en-IN")}</span></div>)}
                {billPreview.mf && (<div><span className="pk">MF</span><span className="pv">{billPreview.mf}</span></div>)}
              </div>
            )}

            <div style={{ height: 32 }} />
            <h2><span className="num">2</span>Bill Parameters</h2>
            <div className="field"><label>Customer Name</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. B SRINIVAS" /></div>
            <div className="row2">
              <div className="field"><label>Connected Load (kW)</label><input value={connectedLoad} onChange={(e) => setConnectedLoad(e.target.value)} placeholder="39" /></div>
              <div className="field"><label>Recorded MD (kW or kVA)</label><input value={recordedMd} onChange={(e) => setRecordedMd(e.target.value)} placeholder="36.54" /></div>
            </div>
            <div className="row2">
              <div className="field"><label>kWh consumed</label><input value={kwh} onChange={(e) => setKwh(e.target.value)} placeholder="7674" /></div>
              <div className="field"><label>kVAh billed</label><input value={kvah} onChange={(e) => setKvah(e.target.value)} placeholder="8935" /></div>
            </div>
            <div className="field"><label>Tariff (₹ per kVArh-equivalent)</label><input value={tariff} onChange={(e) => setTariff(e.target.value)} placeholder="8.18" /></div>
          </div>

          <div className="panel">
            <h2><span className="num">3</span>Computed Values</h2>
            {calc.pfActual && (
              <div className="calc-row">
                <span className="k">Power Factor (kWh / kVAh)</span>
                <span className="v">{calc.pfActual.toFixed(3)}</span>
              </div>
            )}
            <div className="calc-row"><span className="k">Reactive Diff (kVAh − kWh)</span><span className="v">{calc.reactiveDiff.toLocaleString("en-IN")}</span></div>
            <div className="calc-row"><span className="k">Monthly Loss</span><span className="v highlight">{fmtRs(calc.monthlyLossRs)}</span></div>
            <div className="calc-row"><span className="k">Annual Loss</span><span className="v">{fmtRs(calc.annualLossRs)}</span></div>
            <div className="calc-row">
              <span className="k">
                Required kVAR ({resolvedType === "HT" ? "RMD·PF·0.8" : "RMD × 0.8"})
              </span>
              <span className="v">{calc.requiredKvarRaw.toFixed(1)} → {calc.recommendedKvar} kVAR</span>
            </div>
            <div className="calc-row"><span className="k">Step Progression</span><span className="v" style={{ fontSize: 12 }}>{calc.steps.join(" • ")}</span></div>
            <div className="calc-row"><span className="k">Panel Cost</span><span className="v highlight">{fmtRs(calc.panelCost)}</span></div>
            <div className="calc-row"><span className="k">ROI</span><span className="v highlight">{calc.roiMonths > 0 ? calc.roiMonths.toFixed(1) + " months" : "—"}</span></div>

            {calc.oversized && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: '#e8f5e9',
                border: '2px solid #2e7d32',
                borderRadius: '8px',
                fontSize: '13px',
                lineHeight: '1.6'
              }}>
                <strong style={{ color: '#2e7d32', display: 'block', marginBottom: '4px' }}>✓ Custom Configuration</strong>
                This is a custom panel ({'>'}{calc.steps.length} channels). We'll confirm the exact configuration and provide a detailed quote. Call us at <a href="tel:+918374840074" style={{ color: '#2e7d32', fontWeight: 600 }}>+91 83748 40074</a>.
              </div>
            )}

            <div className="actions"><button className="btn-primary" onClick={handlePrint}><Download size={16} /> Print / Save as PDF</button></div>
          </div>
        </div>

        <div className="print-area">
          <div className="card-wrap">
            <div className="pitch-card">
              <div className="brand">DeepAndWide Technologies Pvt. Ltd.</div>
              <div className="card-grid">
                <div className="field-row"><span className="lbl">kVAh</span><span className="val">{kvah || "—"}</span></div>
                <div className="field-row"><span className="lbl">C.L</span><span className="val">{connectedLoad || "—"}</span></div>
                <div className="field-row"><span className="lbl">kWh</span><span className="val">{kwh || "—"}</span></div>
                <div className="field-row"><span className="lbl">kVAR</span><span className="val">{calc.recommendedKvar || "—"}</span></div>
                <div className="field-row"><span className="lbl">Diff</span><span className="val">{calc.reactiveDiff || "—"}</span></div>
                <div className="field-row"><span className="lbl">Cost</span><span className="val">₹{calc.panelCost ? calc.panelCost.toLocaleString("en-IN") : "—"}</span></div>
                <div className="field-row"><span className="lbl">Loss</span><span className="val">₹{Math.round(calc.monthlyLossRs).toLocaleString("en-IN")}</span></div>
                <div className="field-row"><span className="lbl">ROI</span><span className="val">{calc.roiMonths > 0 ? calc.roiMonths.toFixed(1) + "M" : "—"}</span></div>
              </div>
              <div className="card-footer">
                <span>{(resolvedType || "—")} · {customerName ? customerName.toUpperCase().slice(0, 22) : "CUSTOMER"}</span>
                <span>+91 83748 40074</span>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-note">
          API: {apiBase} · Override with ?api=https://...
        </div>
      </div>
    </div>
  );
}
