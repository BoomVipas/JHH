# Design

Visual system for the จิงเฮียงฮั้ง (金香行) POC landing page. Register: brand — design IS the product. Theme is locked to a single dark lacquer world (no light/dark modes): the page is one cinematic artwork, viewed like a night festival.

## Color

Strategy: **Drenched** — lacquer red IS the surface; gold is light on it. OKLCH throughout. Scene sections may shift hue (jade, ivory, night) per realm, but the frame (nav, rails, footer) stays in the core palette.

```css
:root {
  --lacquer-950: oklch(0.18 0.07 25);   /* page base, near-black red */
  --lacquer-900: oklch(0.24 0.10 27);
  --lacquer-700: oklch(0.38 0.15 28);   /* vermilion depth */
  --lacquer-500: oklch(0.52 0.19 29);   /* festival red */
  --gold-300:    oklch(0.88 0.10 88);   /* highlight sheen */
  --gold-400:    oklch(0.80 0.12 84);   /* primary gold */
  --gold-600:    oklch(0.62 0.11 75);   /* engraved gold shadow */
  --ivory:       oklch(0.94 0.02 85);   /* body text on dark */
  --ink:         oklch(0.16 0.03 30);   /* text on gold surfaces */
  --jade:        oklch(0.62 0.09 175);  /* rare accent, from the products */
}
```

- Body text on lacquer: `--ivory` (≥ 7:1). Muted copy no lighter than `oklch(0.78 0.03 85)` (≥ 4.5:1).
- Gold as material: `linear-gradient(105deg, var(--gold-600), var(--gold-300) 45%, var(--gold-400) 60%, var(--gold-600))` + slow background-position sheen on display headings only.
- One accent (gold) carries all interactive states; jade appears only inside jade-realm scenes.

## Typography

Voice words: gilded, ceremonial, ascending. Physical object: a gold-foil-stamped lacquer shop plaque.

| Role | Family | Notes |
|---|---|---|
| Thai display | **Chonburi** (@fontsource/chonburi, 400) | High-contrast Thai display; ≥ 56px only; `text-wrap: balance` |
| Thai body/UI | **Bai Jamjuree** (@fontsource/bai-jamjuree, 400/500/600) | Squared signage sans; body 18px/1.7 |
| Hanzi accent | **Noto Serif TC** (@fontsource/noto-serif-tc, 700) | 金香行 lockup + blessing motifs only |
| EN micro-labels | **Cinzel** (@fontsource/cinzel, 500) | Engraved Roman caps, 11–13px, tracking 0.18em, sparse |

Scale (fluid): display `clamp(3.5rem, 8vw, 6rem)`; scene title `clamp(2.25rem, 4.5vw, 3.5rem)`; body 1.125rem; micro 0.75rem. Ratio ≥ 1.33. Light-on-dark: line-height +0.05.

## Texture & Ornament

- Inline-SVG xiangyun (祥雲) cloud scrolls as section seams; one master cloud path reused at 3 scales.
- Silk-grain noise: single fixed `pointer-events-none` overlay at 4% opacity (never on scrolling containers).
- Thin gold rules `1px oklch(0.62 0.11 75 / 0.4)`; hairlines used to organize, never decorate.
- Corner radius system: cards 18px, chips 999px, buttons 999px. Nothing else rounded.

## Motion

- **Scroll = playhead**: GSAP ScrollTrigger scrub for the cloud canvas and scene timeline. Scrolling itself is the paged glide engine (`src/lib/glide.ts`): a hard CRUISE speed cap, one gesture = one stop (hero → video beats → scenes → wall screens → finale); excess input queues travel time, never velocity.
- **Wheel**: Draggable `type:"rotation"` + InertiaPlugin, snap 360/26, idle drift 0.25°/s; active card lifts 14px + gold glow.
- Easings: UI `cubic-bezier(0.23, 1, 0.32, 1)` (strong ease-out); scene handoffs `cubic-bezier(0.77, 0, 0.175, 1)`; scrub is linear by definition.
- Durations: press feedback 140ms, card hover 200ms, non-scrub reveals ≤ 600ms; SplitText hero reveal chars stagger 24ms.
- Crossfades between realms get 2px transitional blur to mask the seam.
- Only `transform`, `opacity`, `filter`, `clip-path` animate. Reduced motion: static stacked layout, no pins, instant states.

## Layout

- Full-viewport acts (`min-height: 100dvh`, never `h-screen` equivalents); content max-width 1400px inside.
- Scene composition: product hero right two-thirds (matches generated art), text block left third, baseline-aligned.
- Collection wall: `repeat(auto-fit, minmax(280px, 1fr))`, staggered reveal 40ms, hover lift 6px + sheen.
- Progress rail: right edge, roman numerals I–XII, 2px gold ticks; current numeral fills gold.

## Z-scale

`--z-clouds:1` scene art · `--z-content:10` copy · `--z-rail:20` · `--z-wheel:30` · `--z-nav:40` · `--z-preloader:50` · `--z-grain:60`.

## Components

- **Tarot card**: 2:3, generated art, 18px radius, 1px gold border, name chip (Thai, Bai Jamjuree 500) below card in HTML.
- **CTA**: pill, gold gradient fill, ink text, `:active` scale 0.97; single contact intent ("สั่งซื้อ / สอบถาม" via LINE) reused everywhere.
- **Spec chip**: pill outline gold/40, Thai text, one per scene max.
