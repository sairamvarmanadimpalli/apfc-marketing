# assets/

Drop logos, photos, product shots, and any other static media here.

When adding new files, reference them from `src/index.html` or `src/flyer.html` as:

```html
<img src="../assets/logo.svg" alt="Deep & Wide" />
```

Recommended additions:
- `logo.svg` — brand mark for nav + footer
- `favicon.ico` / `favicon.png` — for browser tab
- `og-image.png` — 1200×630 for social link previews
- `panel-hero.jpg` — hero photo of an installed APFC panel
- `panel-open.jpg` — interior shot showing capacitors + contactors
- `customer-1.jpg` ... — testimonial headshots
- `bill-before-after.jpg` — dramatic comparison of a real electricity bill

File size guidance:
- JPEG/PNG photos: keep under 300 KB each (run through [squoosh.app](https://squoosh.app) first)
- SVG logos/icons: keep under 10 KB
- Total `assets/` folder under 3 MB for good page load performance
