# Authoring reference

## Deck skeleton

```html
<!doctype html>
<html lang="en" data-theme="nebula">              <!-- theme -->
<head>
  <link rel="stylesheet" href="FONT_URL_FOR_THEME">  <!-- see Themes below -->
  <link rel="stylesheet" href="lib/threejs-slides.css">
  <script type="importmap">{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/" } }</script>
  <style>/* deck-specific CSS */</style>
</head>
<body>
  <main class="deck" data-journey="drift" data-ambient="stars" data-transition="1">
    <section …>…</section>
  </main>
  <script type="module">
    import { createDeck, registerScene } from './lib/threejs-slides.js';
    await createDeck();
  </script>
</body>
</html>
```

### `.deck` options

| Attribute | Values | Default |
|---|---|---|
| `data-journey` | `drift` · `line` · `dive` · `spiral` · `still` | `drift` |
| `data-bloom` | 0 to 1.5 glow strength. Off by default: objects render as plain lit 3D. Opt in only for a deliberate neon look | 0 |
| `data-brightness` | multiplies the colours of every 3D object in the deck (0.7 = 30% darker). Combines with each slide's own `data-brightness`. Labels are untouched | 1 |
| `data-ambient` | `stars` · `dust` · `none` | `stars` |
| `data-transition` | duration multiplier (0.6 is snappier, 1.4 is more cinematic) | 1 |
| `data-dots` | slide dots: `auto` (always on the last slide; on other slides they appear when the pointer nears the bottom edge and hide 2s after it leaves) · `always` · `last` · `none` | `auto` |

These can also be passed to `createDeck({ journey, bloom, brightness, ambient, transition, dots, parallax, chrome, clickToAdvance })`.

URL flags: `?static` (no motion: for screenshots and reduced motion), `?nochrome` (hides the progress bar and counter), `?quality=low` (DPR 1, no bloom), `?slide=4` or `#/4` (start slide).

## Layouts

Add one class to each `<section>`. All sizes are designed at 1920×1080.

| Class | Use | Structure |
|---|---|---|
| `layout-title` | opening / closing | `.kicker`, `h1` (or `h2`), `.lede`, centred |
| `layout-center` | single idea, centred | `h2`, `.lede` |
| `layout-split` | text left, 3D right | `.kicker`, `h2`, `.lede` or `ul.points` or `pre.code` |
| `layout-split-reverse` | 3D left, text right | same |
| `layout-bottom` | 3D above, headline below | `.kicker`, `h2`, `.small` |
| `layout-top` | headline at top, 3D below | `.kicker`, `h2` |
| `layout-statement` | quote / principle | `blockquote`, `cite` |
| `layout-section` | act divider | `.num`, `h2` |
| `layout-stats` | 2–4 big numbers | `h2`, `.stats > .stat > .value + .label` |
| `layout-cards` | 2–4 parallel ideas | `h2`, `.cards > .card > .icon + h3 + p` |
| `layout-summary` | executive summary (answer first) | `h2`, `ol.summary > li > b + span`, 3–5 items |
| `layout-compare` | before/after, situation/complication, A vs B | `h2`, `.compare > .col (+.is-key) > h3 + ul.points` or `p`; add `.no-arrow` to drop the → |
| `layout-table` | options × criteria, P&L, risks, next steps | `h2`, `table.data` (`td.num` numbers, `td.c` centred, `tr.is-key` highlighted row) |

Classes can be combined, e.g. `class="layout-stats layout-top"`.

Text elements: `.kicker` (mono eyebrow with a rule), `h1` 148px, `h2` 96px, `h3` 46px, `.lede` 40px, `p`/`li` 32px, `.small` 24px, `ul.points`, `pre.code` (use `<span class="c|k|s">` for comment/keyword/string colours), `.chips > .chip`, `.accent`, `.muted`.

Legibility (built in): no text colour can contrast with both a dark background and bright particles, so every slide gets a soft gradient scrim behind its text area, shaped per layout (text has no glow or halo). When the 3D sits *behind* the text (title, center, statement, section, cards), the engine also dims it to 42%. Controls: `style="--scrim: 60%"` on a section for a lighter scrim, `class="no-scrim"` to remove it, `data-dim="1"` for full-strength 3D. Text colours: `--fg` for headlines and body, `--text-2` for secondary text (lede, card text, stat labels), `--muted` for captions only. Don't use `--accent` for running text over 3D; the kicker is a pale accent tint for that reason. `scrim-left` / `scrim-right` add an extra side gradient.

### Business layouts

```html
<section class="layout-summary">
  <h2>Executive summary</h2>
  <ol class="summary">
    <li><b>Manual claiming lost a third of orders</b><span>Ops claimed in Excel, only when someone was at a desk</span></li>
    <li><b>An acceptance engine now claims what the fleet can serve</b><span>Auto-accept beyond 24 h, ops decide inside it</span></li>
  </ol>
</section>

<section class="layout-compare">
  <h2>Hubs replaced office round trips</h2>
  <div class="compare">
    <div class="col"><h3>Before</h3><ul class="points"><li>Idle pairs drove back to the office</li></ul></div>
    <div class="col is-key"><h3>After</h3><ul class="points"><li>Idle pairs wait at the nearest hub</li></ul></div>
  </div>
</section>

<section class="layout-table" data-source="Team scoring, workshop 12 Nov">
  <h2>Option B wins on cost and speed</h2>
  <table class="data">
    <thead><tr><th>Option</th><th class="c">Cost</th><th class="c">Speed</th><th class="c">Risk</th></tr></thead>
    <tbody>
      <tr><td>A · Build in-house</td><td class="c"><span class="harvey" data-v="1"></span></td><td class="c"><span class="harvey" data-v="2"></span></td><td class="c"><span class="mark no"></span></td></tr>
      <tr class="is-key"><td>B · Low-code</td><td class="c"><span class="harvey" data-v="4"></span></td><td class="c"><span class="harvey" data-v="4"></span></td><td class="c"><span class="mark yes"></span></td></tr>
    </tbody>
  </table>
</section>
```

Harvey balls: `<span class="harvey" data-v="0..4">` (empty → full). Marks: `<span class="mark yes|no|part">` (✓ ✗ ◐). Tables: 6 rows × 5 columns or fewer; past that, split or move detail to the appendix.

### Consulting furniture

| Attribute / element | Effect |
|---|---|
| acts | Every `layout-section` starts an act (its `.num` + `h2`). `data-appendix` on a section starts the appendix |
| tracker | `02 · What I built` at the top-left of each content slide in an act. On by default when the deck has 2+ acts; `data-tracker="auto\|always\|none"` on `.deck`; `data-no-tracker` on a slide hides it there |
| `data-source="…"` | Footnote at the bottom-left, prefixed "Source:". Put one on every slide with numbers. Or write `<div class="source">…</div>` (`.no-label` drops the prefix) |
| `data-sticker="…"` | Status tag at the top-right: `Illustrative`, `Preliminary`, `Projection`, `Synthetic` |
| `<span class="delta down good">25%</span>` | ▲/▼ change marker. `up`/`down` sets the arrow; `good`/`bad` sets the colour (accent / accent-2), because down can be good. Works inside `.stat .value`, `.label`, `p`, `li` |

The furniture is part of the slide, so it appears in screenshots, PDFs and bundles.

### Density limits (per slide)
- headline: 9 words or fewer
- `ul.points`: 3 items or fewer, each fitting on 2 lines
- `.cards`: 4 or fewer, body text 20 words or fewer each
- `.stats`: 4 or fewer
- `pre.code`: 8 lines or fewer

Past these limits, split into two slides.

## Entrance animations

`data-anim` on any element inside a slide:

| Value | Effect |
|---|---|
| `rise` | fade up (default) |
| `fade` | fade only |
| `left` / `right` | slide in from the side |
| `zoom` | scale up |
| `blur` | blur → sharp (good for statements) |
| `letters` | split into letters that cascade in (headlines only; plain text, no inner tags) |

- Without any `data-anim` on a slide, **its direct children rise in automatically**, staggered by 110ms. Set `data-anim="none"` on the section to disable this.
- `data-delay="ms"` overrides the stagger for one element.
- Elements animate in once the camera is about 40% of the way to the slide.

Counters: `<span data-count="98.6" data-suffix="%" data-prefix="$">98.6%</span>` counts up when the slide appears (`data-duration` in ms). Put the final value in the text as a fallback.

## Build steps

- `data-step="1"`, `data-step="2"`, …: hidden until the presenter presses next. Elements with the same number appear together.
- Each press also calls the scene's `step(k)` (morph changes shape, orbit highlights, timeline advances).
- `data-scene-steps="n"` on the section adds steps that only drive the scene.
- Going back to a slide shows all of its steps.

## Speaker notes

```html
<aside class="notes">What to say. <b>HTML</b> allowed.</aside>
```
The presenter presses **N** to show them over the slide. Notes never show in screenshots unless toggled.

## Navigation (built in)

→ ↓ Space PageDown Enter: next · ← ↑ PageUp Backspace: back · Home/End · click (left 20% goes back) · swipe · mouse wheel · F fullscreen · N notes · ? help · URL hash `#/n`.

Fullscreen button: a "Fullscreen  F" pill at the top centre. It's always shown on the first slide until you enter fullscreen (that's when presenters want it); on other slides it appears when the pointer nears the top edge and hides 2s after it leaves. The F key does the same. It's hidden where the browser doesn't allow fullscreen (e.g. iOS Safari). Turn it off with `createDeck({ fullscreenButton: false })`.

Slide dots: one dot per slide at the bottom centre. Click one to fly straight to that slide; hover for a tooltip with its number and headline (taken from the slide's `h1`/`h2`/`blockquote`, or set `data-title="…"` on the section). See `data-dots` above for when they show.

JS API: `window.deck` → `{ index, count, step, slides, go(i, {instant, allSteps}), next(), prev(), ready, on('change', fn), renderer, scene, camera, palette }`.

## Themes

Set `data-theme` on `<html>` **and** load that theme's fonts:

| Theme | Font stylesheet URL |
|---|---|
| nebula | `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400..700&family=JetBrains+Mono:wght@400;600&display=swap` |
| ember | `https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Figtree:wght@400..700&family=IBM+Plex+Mono:wght@400;600&display=swap` |
| aurora | `https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400..700&family=Space+Mono:wght@400;700&display=swap` |
| paper | `https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400..600&family=Public+Sans:wght@400..700&family=IBM+Plex+Mono:wght@400;600&display=swap` |
| mono | `https://fonts.googleapis.com/css2?family=Archivo:wght@400..800&family=JetBrains+Mono:wght@400;600&display=swap` |

### Custom brand theme

Override the variables in the deck's `<style>`. The 3D scenes read them at startup:

```css
:root[data-theme="brand"] {
  --bg: #0b1020; --fg: #f5f7ff; --text-2: #cfd5ea; --muted: #a9b1cc;
  --accent: #ffcc00; --accent-2: #ff5f5f; --accent-3: #48c9ff;
  --panel: rgba(20, 26, 48, .55); --line: rgba(245, 247, 255, .14);
  --font-display: "Your Display", sans-serif; --font-body: "Your Body", sans-serif; --font-mono: "JetBrains Mono", monospace;
  --display-weight: 700; --display-tracking: -0.03em;
}
```
Rules: `--bg` sets the clear colour and fog. Backgrounds with lightness above 55% switch the scenes to light mode (normal blending, no bloom). `--accent` is the dominant 3D colour, `--accent-2` the highlight, `--accent-3` the support colour. Keep `--fg` and `--text-2` at 7:1 or more against `--bg`, and `--muted` at 4.5:1 or more.

## Images and media

Plain HTML works: `<img src="assets/photo.jpg" style="width:720px;border-radius:24px">`. Keep files next to `index.html` with relative paths. `bundle.mjs` inlines them. For an image *in 3D* (a floating screenshot), write a custom scene (see custom-scenes.md, "image plane").

## Common mistakes
- Invalid JSON in `data-params` (trailing commas, single quotes inside): the console warns and the scene uses defaults.
- Opening `index.html` from `file://`: modules are blocked. Serve it over HTTP, or use `bundle.mjs`.
- Using `display:none` to hide slide content: use build steps instead.
- Long headlines with `data-anim="letters"`: keep them to 5 words or fewer, otherwise the cascade drags.
- More than 7 items in orbit/timeline/bars: labels collide. Split the slide.
