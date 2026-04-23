# APFC Marketing Kit — Deep & Wide Technologies

Static marketing site + print flyer + WhatsApp pitch for APFC (Automatic Power Factor Correction) panels, targeted at commercial retail spaces in India (salons, cafés, theatres, ice-cream shops, gyms, supermarkets, restaurants, wedding halls, cold storage).

---

## Quick start

```bash
# Serve locally (pick one)
npx serve src            # requires Node.js
python3 -m http.server 8000 --directory src

# Or just open in a browser
open src/index.html
```

Then visit http://localhost:8000 (or whatever port your server prints).

No build step. No dependencies. No framework. Just three files.

---

## Project structure

```
apfc-marketing/
├── README.md                  ← you are here
├── CLAUDE.md                  ← context for Claude Code
├── package.json               ← optional, for `npm run dev`
├── .gitignore
├── src/
│   ├── index.html             ← main landing page / brochure
│   ├── flyer.html             ← single-page A4 print flyer
│   └── whatsapp-pitch.md      ← WhatsApp-ready sales pitch text
├── assets/                    ← put logos, photos, product shots here
└── docs/
    ├── COPY.md                ← all marketing copy, one place
    ├── CONTENT_MODEL.md       ← what each section is for
    └── DEPLOYMENT.md          ← how to ship to production
```

---

## What each file is for

| File | Purpose | Audience |
|---|---|---|
| `src/index.html` | Full-scroll landing page — problem, solution, benefits, segments, savings calculator, steps, FAQ, CTA | Website visitors |
| `src/flyer.html` | One-page printable flyer, optimized for A4 | Walk-ins, trade shows, door-to-door |
| `src/whatsapp-pitch.md` | WhatsApp-formatted pitch text | Direct messages, broadcast lists |

All three are standalone — no shared dependencies, no includes, no build step. This is intentional: owner can edit any one of them without touching the others.

---

## Key business facts (baked into all three files)

- **Savings claim:** 15–30% off commercial electricity bill
- **Typical payback:** 6–12 months
- **CTA:** "Send last month's power bill via DM"
- **WhatsApp number:** +91 83748 40074 → `wa.me/918374840074`
- **Locations:** Hyderabad · Tirupati · Goa · Muramalla
- **Company:** Deep & Wide Technologies Pvt. Ltd.
- **Email:** hello@deepandwide.in

If any of these change, search across all three files.

---

## Known TODOs

- [ ] Wire up the (currently hidden) callback form in `index.html` to Formspree / Google Forms / custom backend
- [ ] Add real product photos to `assets/` and reference them in segment cards
- [ ] Swap in real customer testimonials (none currently)
- [ ] Add OG / Twitter meta tags for link previews
- [ ] Favicon
- [ ] Hook `hello@deepandwide.in` into a real inbox
- [ ] Analytics (Plausible / Umami recommended — no cookies)

---

## License

Proprietary. Property of Deep & Wide Technologies Pvt. Ltd.
