# CLAUDE.md — Context for Claude Code

> This file is read by Claude Code at the start of every session. It captures the project's conventions, business facts, and "why we did it this way" reasoning so future edits stay consistent.

---

## What this project is

Static marketing site for **Deep & Wide Technologies Pvt. Ltd.**, a manufacturer of APFC (Automatic Power Factor Correction) panels based in Muramalla, Andhra Pradesh, with service presence in Hyderabad, Tirupati, Goa, and Muramalla.

The three deliverables in `src/`:
1. **`index.html`** — scrollable landing page / web brochure
2. **`flyer.html`** — single-page A4 print flyer
3. **`whatsapp-pitch.md`** — plain-text WhatsApp sales pitch

All three target **commercial retail**: salons, cafés, theatres, ice-cream parlours, bakeries, gyms, supermarkets, restaurants, wedding halls, cold storage.

---

## How to work on this project

### No build step
These are vanilla HTML files. Do not add Webpack, Vite, Parcel, React, Next.js, or any framework. The owner edits HTML directly. Keep it that way.

### No external JS dependencies
Fonts are pulled from Google Fonts via CDN. Everything else (including the SVG illustrations, grain texture, animations) is inline. Do not add npm packages, a `node_modules`, or a JS bundle.

### One file, one concern
- `index.html` = website. Self-contained. ~1100 lines.
- `flyer.html` = print. Self-contained. ~285 lines.
- `whatsapp-pitch.md` = plain text. Single source of copy truth for the WhatsApp channel.

Do not extract "shared" CSS or components across them. The owner treats them as three separate artifacts that happen to share a brand. If you refactor them into a templating system or shared partials, you make it harder for the owner to edit independently.

### Run locally
```bash
npx serve src              # if Node is installed
python3 -m http.server 8000 --directory src
```

---

## Design system (CSS variables, defined in `<style>` of each HTML file)

Both `index.html` and `flyer.html` share the same palette and type system. If you change one, change the other to match.

```
--ink:      #14100c    /* near-black, body text and heavy elements */
--ink-soft: #2e2620    /* softer ink, secondary text */
--paper:    #f5ede0    /* warm cream, primary background */
--paper-warm: #ebe0cc  /* slightly warmer background for alternating sections */
--sand:     #f0e4ce    /* card background, slightly different from paper-warm */
--mustard:  #e8a838    /* accent 1 — used for highlight underlines, LEDs, warm moments */
--brick:    #c5472d    /* accent 2 — used for CTAs, italic emphasis in headlines */
--teal:     #0d5f5f    /* rarely used, available for "meta" text in step cards */
--moss:     #3d5a3a    /* unused but available */
--line:     rgba(20,16,12,.18)  /* standard separator line */
```

### Typography
- **Display / serif:** `'Fraunces', serif` — used for headlines, titles, quotes. Italic variant (`font-style: italic`) is used heavily for emphasis.
- **Body / sans:** `'Inter Tight', sans-serif` — all body copy and UI.
- **Mono:** `'JetBrains Mono', monospace` — used sparingly for section numbers ("01 — The hidden cost"), labels, and footer metadata.

Never introduce Inter, Roboto, Arial, or system fonts for headings.

### Aesthetic rules
- **Editorial warm.** Think print magazine + mid-century manufacturing brochure. Not tech-startup.
- Paper-warm backgrounds. Dark ink text. Mustard + brick as controlled accents.
- Every section has a numbered kicker (`01 — The hidden cost`, `02 — The fix`, etc.) in mono + brick color.
- Grain overlay is a noise SVG applied via a pseudo-element at `mix-blend-mode: multiply`. Do not remove it — it's the texture that makes everything feel printed instead of rendered.
- Hard edges, thick borders (2px ink), offset box-shadows (e.g., `12px 12px 0 var(--mustard)`) instead of soft drop shadows.

---

## Business facts (sacred — change in all three files together if ever updated)

| Fact | Value | Appears in |
|---|---|---|
| Savings range | **15–30%** off commercial bill | all three files |
| Payback period | **4–10 months** | index.html, whatsapp-pitch.md |
| Primary CTA | "Send last month's power bill via DM" | all three files |
| WhatsApp number | **+91 83748 40074** | all three files |
| WhatsApp URL | `https://wa.me/918374840074?text=Hi%2C%20I%27d%20like%20a%20free%20bill%20audit.%20I%27ll%20attach%20last%20month%27s%20power%20bill.` | index.html, flyer.html |
| Email | `hello@deepandwide.in` | all three files |
| Presence cities | Hyderabad · Tirupati · Goa · Muramalla | all three files |
| Company legal name | Deep & Wide Technologies Pvt. Ltd. | all three files |
| Founded | 2019 | index.html footer |

⚠️ **The 15–30% savings claim is aggressive.** Realistic installations often land 10–20%. The top of the range is only achieved on shops with severe existing power factor penalties. When revising copy, do not inflate it further. If anything, softer language ("up to 30%") would be more defensible.

---

## Content model (what each section does, in `index.html`)

Sections, in scroll order:
1. **Nav** — sticky, blurred. Logo + 5 anchor links + DM CTA button.
2. **Hero** — big Fraunces headline with brick italic + mustard underline accent. Stat card on the right with offset mustard shadow.
3. **Marquee** — horizontally scrolling list of shop segments. Pure CSS animation.
4. **Problem (#problem)** — "You're paying for power you never actually use." Left: hand-drawn SVG of a coffee cup with foam = reactive power, juice = real power. Right: numbered problem list.
5. **Solution** — "One small box. Silently fixes everything." Left: prose. Right: decorative ASCII-art-style rendering of the panel (LEDs, LCD screen, controller labels).
6. **Benefits (#benefits)** — Dark section. 2×3 grid of numbered benefit cards.
7. **Who it's for (#who)** — Sand background. 3×3 grid of segment cards with per-shop sample savings calculations.
8. **Savings (#savings)** — Calculator-style table, 5 bill tiers, save/month and save/year columns.
9. **Steps** — 4-step journey. "From DM to lower bill — in under 2 weeks."
10. **FAQ (#faq)** — Accordion `<details>` elements. 7 common questions.
11. **CTA (#cta)** — Brick background, big headline, two buttons (WhatsApp primary, phone ghost). A hidden callback form sits here with `style="display:none"` — if the owner wants to enable it later, they'll need a backend.
12. **Footer** — Dark. 4-column grid: brand + tagline / explore nav / contact / presence cities.

---

## Common edits and where to find them

| Want to change... | Look in |
|---|---|
| Savings percentage | Search `15–30%` across all three files |
| WhatsApp number | Search `918374840074` |
| Email | Search `hello@deepandwide.in` |
| City names | Search `Hyderabad · Tirupati` or `Muramalla` |
| Hero headline | `index.html` around line 570 |
| Benefit cards | `index.html` `.bgrid` section |
| Segment sample savings | `index.html` `.seg .sample` divs |
| Calculator table | `index.html` `.calc-table` |
| FAQ answers | `index.html` `<details>` elements |
| Print layout | `flyer.html` `@media print` block |

---

## What NOT to do

- **Do not framework-ify this.** No React, no Vue, no Astro, no static-site-generator. The owner is not a developer; they edit HTML directly.
- **Do not pull in Tailwind.** The CSS is deliberately hand-written with CSS variables.
- **Do not "optimize" by extracting shared CSS into a file.** Each HTML file is intentionally self-contained so it can be emailed, zipped, or shared as a single artifact.
- **Do not auto-generate copy with an LLM call or fetch.** All copy is static and reviewed by the owner.
- **Do not add tracking pixels, Google Analytics, or third-party cookies** without explicit owner consent. If analytics are needed, prefer cookie-less options (Plausible, Umami, self-hosted GoatCounter).
- **Do not soften the CTA.** It is deliberately direct: "Send last month's power bill via DM." This converts better than "Contact us for a free consultation."

---

## Testing checklist before shipping changes

- [ ] Open `src/index.html` in a browser — scroll from top to bottom, verify no broken sections.
- [ ] Resize window to mobile width (~380px) — verify hero, calculator table, segment grid, and CTA all reflow cleanly.
- [ ] Open `src/flyer.html`, hit Cmd/Ctrl+P, preview print — verify it fits on one A4 page without overflow.
- [ ] Click every WhatsApp button and verify it opens WhatsApp with the pre-filled message.
- [ ] Grep for any placeholder artifacts: `··` (interpunct placeholders), `TODO`, `Lorem`, `example.com`.
- [ ] Copy the contents of `whatsapp-pitch.md` into WhatsApp and verify the `*bold*` and `_italic_` formatting renders.

---

## Deployment

See `docs/DEPLOYMENT.md`. Short version: drop `src/` on Netlify, Vercel, Cloudflare Pages, GitHub Pages, or any static host. Set `src/` as the publish directory. No build command needed.
