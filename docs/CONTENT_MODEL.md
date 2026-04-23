# CONTENT_MODEL.md

Structural reference for `index.html`. Useful when adding, reordering, or removing sections.

---

## Page skeleton

```
<nav>                              (sticky, blurred)
<section class="hero">             (headline + stat card)
<div class="marquee">              (scrolling segment names)

<section class="block problem">    #problem    · 01 — The hidden cost
<section class="block solution">               · 02 — The fix
<section class="block benefits">   #benefits   · 03 — What you get
<section class="block segments">   #who        · 04 — Who it's for
<section class="block calc">       #savings    · 05 — Do the math
<section class="block steps">                  · 06 — How it works
<section class="block faq">        #faq        · 07 — Common questions

<section class="cta-block" id="cta">
<footer class="site">
```

---

## Section component cheat sheet

### Hero
- `.hero-kicker` — small black pill above headline.
- `.headline` — Fraunces 300 weight, large. Italic + colored spans emphasize.
- `.hero-card` — dark card with offset mustard shadow, contains stats.

### Block section (generic)
All content sections use this pattern:
```html
<section id="..." class="block [variant]">
  <div class="container">
    <div class="section-num">NN — Short kicker</div>
    <h2 class="section-title">Big headline with <em>italic brick span</em></h2>
    <p class="section-intro">One-sentence summary.</p>
    <!-- section-specific content -->
  </div>
</section>
```

### Benefit card (`.bcard`)
```html
<div class="bcard">
  <div class="num">/ 01</div>
  <h3>Headline with <em>italic accent</em></h3>
  <p>1–2 sentence description.</p>
</div>
```

### Segment card (`.seg`)
```html
<div class="seg">
  <div class="seg-icon">EMOJI</div>
  <h3>Segment name</h3>
  <div class="subtitle">Comma · separated · equipment</div>
  <p>1–2 sentence pitch specific to this segment.</p>
  <div class="sample">Bill <strong>₹XX</strong> → Save <strong>₹XX–XX/mo</strong></div>
</div>
```

### FAQ item
```html
<details>
  <summary>The question, phrased how an owner would ask it.</summary>
  <p>Direct answer. No hedging.</p>
</details>
```

---

## Adding a new shop segment

1. Add a new `.seg` card inside `.seg-grid` in `index.html`.
2. Use an emoji icon (single character, rendered in the black box).
3. Calculate sample savings at 15–30% of sample bill. Round to nice numbers.
4. Mirror the segment name in the `.marquee-track` (add it twice — once in each half, so the loop stays seamless).
5. Add it to the flyer's segment chips if relevant.

---

## Removing a section

Sections are independent. To remove one, delete:
- Its `<section>` block.
- Its anchor in the nav (`.nav-links`).

Nothing else should break. Section numbering (`01 —`, `02 —`, etc.) is hard-coded — renumber the kickers if you want them sequential.

---

## Changing the savings percentage

Do not just find-and-replace `15–30%`. You also need to:
1. Update the hero underline number (`<span class="u">30%</span>`).
2. Recalculate all 9 segment card samples.
3. Recalculate all 5 calculator table rows.
4. Update hero card yearly savings (`₹45–90k`).
5. Update the "Over 10 years" row in `flyer.html`.
6. Update `docs/COPY.md`.

There's no shared config. Each file is independent.
