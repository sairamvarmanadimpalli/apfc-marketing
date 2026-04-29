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
// PRICING & SIZING (Sairam's rules)
// ---------------------------------------------------------------------------
function priceForKvar(kvar) {
  if (kvar <= 0) return 0;
  if (kvar < 25) return 2000;
  if (kvar <= 35) return 1800;
  return 1500;
}

function pickStepProgression(requiredKvar) {
  const fixed = [1, 2, 3, 5];
  const fixedTotal = 11;
  if (requiredKvar <= fixedTotal) return { steps: fixed, total: fixedTotal };
  const bigSteps = [10, 20, 25];
  let remaining = requiredKvar - fixedTotal;
  const chosen = [];
  for (let i = 0; i < 4 && remaining > 0; i++) {
    let best = bigSteps[0];
    for (const s of bigSteps) if (s <= remaining + 5) best = s;
    chosen.push(best);
    remaining -= best;
  }
  const steps = [...fixed, ...chosen];
  return { steps, total: steps.reduce((a, b) => a + b, 0) };
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
    const pricePerKvar = priceForKvar(recommendedKvar);
    const panelCost = recommendedKvar * pricePerKvar;
    const roiMonths = monthlyLossRs > 0 ? panelCost / monthlyLossRs : 0;
    return {
      reactiveDiff, monthlyLossRs, annualLossRs, requiredKvarRaw,
      recommendedKvar, pricePerKvar, panelCost, roiMonths,
      steps: stepResult.steps,
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
      background: "linear-gradient(135deg, #1a1a1a 0%, #2d1e1e 100%)",
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      color: "#f5f0e8",
      padding: "24px 16px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .container { max-width: 1100px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid rgba(245, 240, 232, 0.15); }
        .header h1 { font-size: clamp(28px, 5vw, 44px); margin: 0; letter-spacing: 0.02em; font-weight: 600; display: inline-flex; align-items: center; gap: 12px; }
        .header .sub { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; color: #c4a86b; margin-top: 8px; }
        .grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 900px) { .grid { grid-template-columns: 1fr 1fr; } }
        .panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(245, 240, 232, 0.12); border-radius: 4px; padding: 24px; }
        .panel h2 { font-size: 11px; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.3em; text-transform: uppercase; color: #c4a86b; margin: 0 0 20px 0; font-weight: 500; }
        .field { margin-bottom: 14px; }
        .field label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: #a09588; margin-bottom: 6px; }
        .field input, .field select { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(245, 240, 232, 0.2); color: #f5f0e8; padding: 10px 12px; font-family: 'JetBrains Mono', monospace; font-size: 14px; border-radius: 2px; }
        .field input:focus, .field select:focus { outline: none; border-color: #c4a86b; }
        .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .btn { background: #c4a86b; color: #1a1a1a; border: none; padding: 12px 20px; font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; cursor: pointer; border-radius: 2px; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
        .btn:hover { background: #d4b878; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn.outline { background: transparent; color: #c4a86b; border: 1px solid #c4a86b; }
        .btn.outline:hover { background: rgba(196, 168, 107, 0.1); }
        .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .status { margin-top: 12px; padding: 10px 12px; font-size: 12px; font-family: 'JetBrains Mono', monospace; border-radius: 2px; display: flex; gap: 8px; align-items: flex-start; }
        .status.success { background: rgba(80, 160, 80, 0.15); color: #a8e6a8; }
        .status.error { background: rgba(200, 80, 80, 0.15); color: #f0a8a8; }
        .status.loading { background: rgba(196, 168, 107, 0.15); color: #f0d68b; }
        .preview { margin-top: 14px; padding: 12px; background: rgba(0,0,0,0.25); border-left: 2px solid #c4a86b; font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.7; }
        .preview .pk { color: #a09588; display: inline-block; min-width: 60px; }
        .preview .pv { color: #f5f0e8; }
        .type-badge { display: inline-block; padding: 2px 8px; border: 1px solid #c4a86b; color: #c4a86b; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.2em; margin-left: 8px; }
        .card-wrap { display: flex; justify-content: center; padding: 20px 0; }
        .pitch-card { width: 380px; aspect-ratio: 1.75 / 1; background: linear-gradient(135deg, #8b1a1a 0%, #6b1414 100%); color: #fff8e7; padding: 20px 22px; border-radius: 6px; box-shadow: 0 20px 60px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,0,0,0.2); font-family: 'Cormorant Garamond', Georgia, serif; position: relative; overflow: hidden; }
        .pitch-card::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.15) 0%, transparent 50%); pointer-events: none; }
        .brand { font-size: 10px; letter-spacing: 0.35em; text-transform: uppercase; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #fff8e7; text-align: center; padding-bottom: 8px; border-bottom: 0.5px solid rgba(255,248,231,0.3); }
        .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; margin-top: 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px; }
        .field-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .field-row .lbl { letter-spacing: 0.15em; text-transform: uppercase; font-size: 9px; color: #fff8e7; opacity: 0.85; }
        .field-row .val { background: #fff8e7; color: #1a1a1a; padding: 3px 8px; font-weight: 700; font-size: 11px; min-width: 60px; text-align: center; letter-spacing: 0.05em; }
        .card-footer { position: absolute; bottom: 8px; left: 22px; right: 22px; font-size: 8px; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.2em; color: rgba(255,248,231,0.6); display: flex; justify-content: space-between; }
        .calc-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed rgba(245, 240, 232, 0.1); font-family: 'JetBrains Mono', monospace; font-size: 13px; }
        .calc-row .k { color: #a09588; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; }
        .calc-row .v { color: #f5f0e8; font-weight: 500; }
        .calc-row .v.gold { color: #c4a86b; font-weight: 700; }
        .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .footer-note { margin-top: 32px; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #6a6055; letter-spacing: 0.1em; }
        @media print {
          body { background: white !important; }
          .container > *:not(.print-area) { display: none !important; }
          .print-area { display: block !important; padding: 40px; }
        }
      `}</style>

      <div className="container">
        <div className="header">
          <h1><Zap size={32} color="#c4a86b" />DeepAndWide Technologies</h1>
          <div className="sub">APFC Sales Pitch Generator · TGSPDCL · LT + HT</div>
        </div>

        <div className="grid">
          <div className="panel">
            <h2>1 · Service Lookup
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
              <button className="btn" onClick={handleFetch} disabled={fetchState === "loading"}>
                {fetchState === "loading"
                  ? <><Loader2 size={14} className="spin" /> Fetching…</>
                  : <><RefreshCw size={14} /> Fetch from TGSPDCL</>}
              </button>
              {billPreview?.sourceUrl && (
                <a href={billPreview.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn outline">
                  <ExternalLink size={14} /> Open Source Bill
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

            <div style={{ height: 24 }} />
            <h2>2 · Bill Parameters</h2>
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
            <h2>3 · Computed Values</h2>
            {calc.pfActual && (
              <div className="calc-row">
                <span className="k">Power Factor (kWh / kVAh)</span>
                <span className="v">{calc.pfActual.toFixed(3)}</span>
              </div>
            )}
            <div className="calc-row"><span className="k">Reactive Diff (kVAh − kWh)</span><span className="v">{calc.reactiveDiff.toLocaleString("en-IN")}</span></div>
            <div className="calc-row"><span className="k">Monthly Loss</span><span className="v gold">{fmtRs(calc.monthlyLossRs)}</span></div>
            <div className="calc-row"><span className="k">Annual Loss</span><span className="v">{fmtRs(calc.annualLossRs)}</span></div>
            <div className="calc-row">
              <span className="k">
                Required kVAR ({resolvedType === "HT" ? "RMD·PF·0.8" : "RMD × 0.8"})
              </span>
              <span className="v">{calc.requiredKvarRaw.toFixed(1)} → {calc.recommendedKvar} kVAR</span>
            </div>
            <div className="calc-row"><span className="k">Step Progression</span><span className="v" style={{ fontSize: 11 }}>{calc.steps.join(" • ")}</span></div>
            <div className="calc-row"><span className="k">Price / kVAR</span><span className="v">₹{calc.pricePerKvar.toLocaleString("en-IN")}</span></div>
            <div className="calc-row"><span className="k">Panel Cost</span><span className="v gold">{fmtRs(calc.panelCost)}</span></div>
            <div className="calc-row"><span className="k">ROI</span><span className="v gold">{calc.roiMonths > 0 ? calc.roiMonths.toFixed(1) + " months" : "—"}</span></div>
            <div className="actions"><button className="btn" onClick={handlePrint}><Download size={14} /> Print / Save as PDF</button></div>
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
