# จิงเฮียงฮั้ง (金香行) · Landing Page POC

Cinematic scroll-driven product catalogue for the family joss-paper business.
26 real products, re-photographed into heavenly realms with the Higgsfield MCP,
presented as a single upward journey: tarot-card wheel → cloud ascent (scroll-scrubbed
video) → 12 pinned product scenes → collection wall → finale.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Production check:

```bash
npm run build
npm run preview    # http://localhost:4173
```

Automated verification (starts its own preview server, writes screenshots + summary
to `preview/`):

```bash
npm run verify              # functional + visual probes
node tests/verify.mjs --video   # same, plus records preview/scroll-through video
```

## What's inside

- `src/lib/wheel.ts` – circular tarot-card carousel (GSAP Draggable `type:"rotation"`
  + InertiaPlugin, snap 360/26, idle drift, keyboard arrows, click deep-links).
  Half-wheel in the hero, full slow-spinning wheel in the finale.
- `src/lib/scrub.ts` – canvas frame scrubber: scroll drives 161 WebP frames
  (extracted from a Kling 3.0 10 s generation) pinned over ~260 vh.
- `src/lib/scenes.ts` – 12 pinned catalogue scenes with continuous directional
  handoffs, per-scene Ken Burns, progress rail I–XII, real shop video chip on scene I.
- `src/lib/wall.ts` – the remaining 14 products as a staggered reveal grid.
- `src/data/products.json` – the catalogue roster (names/specs from the shop's
  LINE VOOM posts). Hanzi 金香行 is a **placeholder transliteration**; confirm the
  firm's real characters before production.
- `PRODUCT.md` / `DESIGN.md` – strategy + visual system (OKLCH tokens, type,
  motion rules).

`prefers-reduced-motion` gets a fully static stacked layout (no pins, no scrub,
no autoplay). Thai text is always real HTML, never baked into images.

## Assets

All imagery in `public/media/` was generated with Higgsfield (nano-banana-pro for
stills, Kling 3.0 for the cloud flight) using the shop's own product photos as
references; originals in the parent folder are untouched. `public/media/video/kimhuay.mp4`
is a real shop video. Regenerate/extend via the prompts recorded in the session ledger.
