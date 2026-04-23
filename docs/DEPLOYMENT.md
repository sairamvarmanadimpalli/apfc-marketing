# DEPLOYMENT.md

Ship `src/` to any static host. No build step. No environment variables. No backend.

---

## Option 1 — Netlify (easiest)

```bash
# Install once
npm i -g netlify-cli

# From project root
netlify deploy --dir=src           # preview
netlify deploy --dir=src --prod    # production
```

Or drag-and-drop the `src/` folder onto https://app.netlify.com/drop.

---

## Option 2 — Vercel

```bash
npm i -g vercel
vercel --cwd src
```

When it asks for output directory, just hit enter — there's nothing to build.

---

## Option 3 — Cloudflare Pages

1. Push the repo to GitHub.
2. In Cloudflare Pages, "Create project" → "Connect to Git".
3. Build command: *(leave empty)*
4. Build output directory: `src`
5. Deploy.

---

## Option 4 — GitHub Pages

```bash
# In repo settings, enable GitHub Pages and point it at /src on main branch.
# Or use gh-pages:
npm i -g gh-pages
gh-pages -d src
```

---

## Option 5 — Any shared hosting

Upload the contents of `src/` to your web root via FTP/SFTP. Rename `index.html` to whatever your host expects (usually it's already correct).

---

## Custom domain

Whichever host you pick:
1. Add a custom domain in the host's dashboard (e.g., `apfc.deepandwide.in`).
2. Add the DNS record they ask for (usually a `CNAME`).
3. Wait for DNS to propagate (a few minutes to a few hours).
4. Most hosts auto-issue Let's Encrypt SSL. Verify HTTPS works.

---

## Flyer URL

`flyer.html` is deployed alongside `index.html`. It will be available at:

```
https://yourdomain.com/flyer.html
```

Useful for sending printable versions to customers via email, or for on-site iPad displays at trade shows.

---

## What about WhatsApp pitch?

`whatsapp-pitch.md` is not meant to be served. It's a source file for copying/pasting into WhatsApp. You can keep it in the repo, or move it to a Google Doc if owners prefer to edit it there.

---

## Post-deploy checklist

- [ ] Landing page loads at `https://yourdomain.com/`
- [ ] Flyer loads at `https://yourdomain.com/flyer.html`
- [ ] All WhatsApp buttons open WhatsApp with the pre-filled message
- [ ] Phone links (`tel:+918374840074`) work on mobile
- [ ] Mailto link (`mailto:hello@deepandwide.in`) opens mail client
- [ ] Page looks good on iPhone Safari, Android Chrome, desktop Chrome, desktop Firefox, desktop Safari
- [ ] Print preview of `flyer.html` still fits on one A4 page
- [ ] Lighthouse score ≥ 95 on Performance, Accessibility, Best Practices, SEO
