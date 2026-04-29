# APFC Sales Pitch Tool — DeepAndWide Technologies

Two-part app for generating one-card APFC sales pitches from TGSPDCL bills.

```
frontend/   React + Vite static site (deploys to GitHub Pages)
worker/     Cloudflare Worker that fetches & parses TGSPDCL bills
```

The worker exists because GitHub Pages serves a static site, and a static site
running in a browser cannot fetch tgsouthernpower.org directly (CORS). The
worker is one file, deploys in 60 seconds, and is free for our volume.

---

## Bill URLs

```
LT  https://tgsouthernpower.org/ops/DuplicateBill4Login.jsp?ctscno={SC_NO}
HT  https://webportal.tgsouthernpower.org/HTBilling/MeterDetails/HTBillSet_BillViewGen.jsp?htscno={SC_NO}
```

Auto-detection rule:
- Pure digits (9–15 chars)  → LT  (e.g. `113400807`, `110436036`)
- Letters + digits prefix    → HT  (e.g. `MCL3800`, `SEC1727`)

---

## Pricing rule

| kVAR rating       | ₹ per kVAR |
|-------------------|------------|
| Below 25          | 2,000      |
| 25–35 inclusive   | 1,800      |
| Above 35          | 1,500      |

Sizing: `kVAR = RMD × 0.8`, rounded up to nearest 5.
Step progression: fixed `1·2·3·5` (channels 1–4), then greedy fill from `{10, 20, 25}` for channels 5–8.

---

# Deployment — Claude Code instructions

> Run these in order. Replace placeholders in **bold**.

## Step 1 — Initialise the git repo

```bash
cd <this-folder>
git init -b main
git add .
git commit -m "Initial APFC pitch tool"
git remote add origin git@github.com:<YOUR_GITHUB_USER>/apfc-pitch.git
git push -u origin main
```

## Step 2 — Deploy the Cloudflare Worker

```bash
cd worker
npm install -g wrangler
wrangler login                  # opens browser, sign in to Cloudflare
wrangler deploy
```

Wrangler prints the deployed URL, something like:
```
https://apfc-bill-fetcher.<your-cf-username>.workers.dev
```

Verify it works:
```bash
curl "https://apfc-bill-fetcher.<your-cf-username>.workers.dev/api/health"
curl "https://apfc-bill-fetcher.<your-cf-username>.workers.dev/api/bill?scno=113400807&type=LT"
```

You should see JSON with `ok: true` and parsed bill fields.

## Step 3 — Wire the Worker URL into the frontend

Edit `frontend/src/App.jsx` and replace the `DEFAULT_API_BASE` constant:

```js
const DEFAULT_API_BASE = "https://apfc-bill-fetcher.<your-cf-username>.workers.dev";
```

Commit and push:
```bash
git add frontend/src/App.jsx
git commit -m "Wire production worker URL"
git push
```

## Step 4 — Enable GitHub Pages

On GitHub:
1. Go to repo **Settings → Pages**.
2. Under "Build and deployment" → **Source**, select **GitHub Actions**.
3. The workflow at `.github/workflows/deploy.yml` will run automatically on every push to `main`.
4. After the action completes, Pages publishes at:
   ```
   https://<your-github-user>.github.io/apfc-pitch/
   ```

If you serve from a subdirectory like `/apfc-pitch/`, change `vite.config.js`:
```js
base: "/apfc-pitch/",
```
and re-push.

## Step 5 — Custom domain (optional, but recommended)

To serve at `apfc.deepandwide.in`:

1. In your DNS (where deepandwide.in is hosted), add a `CNAME` record:
   ```
   apfc  CNAME  <your-github-user>.github.io
   ```
2. In repo **Settings → Pages → Custom domain**, enter `apfc.deepandwide.in`. Tick **Enforce HTTPS** once the cert provisions.
3. In `frontend/vite.config.js`, set:
   ```js
   base: "/",
   ```
4. In `frontend/public/CNAME` create a file with one line:
   ```
   apfc.deepandwide.in
   ```
5. Update `worker/index.js` `ALLOWED_ORIGINS` if the new domain isn't already there. Re-deploy the worker.

## Step 6 — Custom domain for the Worker (optional)

To serve the API at `apfc-api.deepandwide.in`:

1. Add a `CNAME` in DNS:
   ```
   apfc-api  CNAME  <your-cf-username>.workers.dev
   ```
2. In Cloudflare dashboard → Workers → your worker → **Triggers** → **Custom Domains** → add `apfc-api.deepandwide.in`.
3. Update `DEFAULT_API_BASE` in the frontend.

---

## Local development

```bash
# Terminal 1 — worker
cd worker
wrangler dev          # serves on http://localhost:8787

# Terminal 2 — frontend
cd frontend
npm install
npm run dev           # serves on http://localhost:5173
```

Open the frontend with `?api=http://localhost:8787` to test against the local worker:
```
http://localhost:5173/?api=http://localhost:8787
```

---

## Test SC numbers

| SC No.       | Type | Notes                                                              |
|--------------|------|--------------------------------------------------------------------|
| `113400807`  | LT   | B SRINIVAS, Gandipet — verified, full bill returns                 |
| `110436036`  | LT   | (provided as example)                                              |
| `SEC2112`    | HT   | M/S.REGISTRAR Osmania University — verified, full HT bill returns  |
| `MCL3800`    | HT   | (HT example, not yet verified by us)                               |
| `SEC1727`    | HT   | (HT example, not yet verified by us)                               |

### What the parsers extract

**LT bill fields:** USC No, name, address, category, contracted load (kW), recorded MD (kW), units (kWh), bill amount, MF, phase.

**HT bill fields:** Consumer Number, name, full address (3 lines joined), category, specified voltage (kV), feeder, contracted MD (kVA), recorded MD (kVA from "Total Consumption" KVA column), kWh, kVAh, MF, energy charge rate (auto-converted from paise to rupees), demand charge rate, sub-total, total amount payable, bill month.

### kVAR sizing logic

- **LT:** `kVAR = RMD_kW × 0.8` (rounded up to nearest 5)
- **HT:** RMD is in kVA. We compute actual PF as `kWh / kVAh` from the bill, then `kVAR = RMD_kVA × PF × 0.8` (i.e. derate kVA to kW first, then size).
- Step progression in both cases: fixed `1·2·3·5` for channels 1–4, greedy fill from `{10, 20, 25}` for channels 5–8.

---

## File map

```
apfc-deploy/
├── README.md                         this file
├── .gitignore
├── .github/workflows/deploy.yml      GitHub Actions → Pages
├── worker/
│   ├── index.js                      Worker source (single file)
│   └── wrangler.toml                 Worker config
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        └── App.jsx                   ← edit DEFAULT_API_BASE here
```

---

## Notes

- The Worker does a 5-minute edge cache. If you re-fetch the same SC number repeatedly, you'll hit the cache instead of TGSPDCL — that's fine.
- TGSPDCL HT and LT page layouts differ; the parsers are best-effort. If a field comes back blank, the form lets the user enter it manually.
- The "Open Source Bill" link in the UI lets you double-check the parser against the actual page.
- The Cloudflare Free plan covers 100,000 worker requests per day — far above any sales-team usage.

---

Phone: +91 83748 40074 · DeepAndWide Technologies Pvt. Ltd.
