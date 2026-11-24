---
name: threejs-slides
description: Build animated, cinematic 3D presentations as HTML with Three.js. Every slide is a place in one 3D world, and the camera flies between them, with particle morphs, globes, 3D charts, timelines and staggered text reveals. Use when the user asks for an animated, 3D, WebGL, Three.js, cinematic, "wow", keynote-style or interactive presentation, slide deck, pitch deck, talk or demo-day deck that runs in a browser, or wants an existing deck or outline turned into one. Do not use when the user needs an editable .pptx or Google Slides file.
license: MIT
---

# threejs-slides

Make browser presentations where the 3D scene carries part of the story. The output is a folder:
`index.html` (the slides, written as plain HTML) plus `lib/` (the runtime: three.js engine, scene library, CSS).
There's no build step: Three.js loads from a CDN through an import map.

```
my-deck/
├── index.html          ← you write this: one <section> per slide
└── lib/                ← copied by scripts/new-deck.sh; don't edit unless extending the runtime
    ├── threejs-slides.js   engine: stage, camera journey, transitions, input, notes
    ├── scenes.js           12 built-in 3D scenes
    └── threejs-slides.css  stage, layouts, animations, 5 themes
```

## Core rules

1. **Motion carries meaning.** Every 3D scene and every build step must say something the words alone don't. If a scene is only decoration, use a quieter one (`none`, `network`, `galaxy`) or none at all.
2. **One idea per slide.** Speaker decks: a headline plus at most 3 short points. If content overflows, split the slide. Never shrink the text.
3. **Fixed 1920×1080 stage.** The runtime scales the whole stage to fit. Don't add media queries that reflow slides, and size everything in px at 1920×1080.
4. **Text and 3D never fight.** Use layouts that keep them apart (`layout-split` puts 3D on the right, `layout-split-reverse` on the left, `layout-bottom` puts it above the text). In `layout-center` / `layout-title`, pick a scene that reads as background.
5. **Vary the rhythm.** Never use the same scene on two consecutive slides. Put a `layout-section` + `tunnel` slide between acts. Bookending a deck with the same scene (title and closing) is fine.
6. **Verify visually.** Don't hand over a deck you haven't screenshotted slide by slide (Phase 5).

## Phase 0: Detect the mode

- **New deck**: start at Phase 1.
- **Convert**: the user has an outline, doc, markdown or an existing deck (.pptx: extract text with the `pptx` skill if available, or `python -m markitdown`). Use it as the content and skip to Phase 2.
- **Edit**: an existing threejs-slides deck. Read `index.html`, make the change, then run Phase 5. Keep the existing theme and journey.

## Phase 1: The brief

If the request doesn't already say these, ask them **together, in one message** (use a structured question tool if available):

1. **Purpose and audience**: pitch, conference talk, internal update, teaching, demo day?
2. **Length**: roughly how many minutes or slides? (A live talk takes about 1 to 2 minutes per slide.)
3. **Content**: is it ready, rough notes, or topic only?
4. **Mood**: pick a theme or describe a vibe (see the table below).

When the user says "just make it", infer all four and state your assumptions in one line.

| Theme | Feel | Good for |
|---|---|---|
| `nebula` | deep space, aqua + coral, grotesk | tech, product, AI, launches (default) |
| `ember` | warm dark, orange + gold, serif | storytelling, culture, founder narratives |
| `aurora` | green-black, mint + cyan | climate, science, health, data |
| `paper` | light, ink blue + vermilion, editorial serif | research, reports, education, daytime rooms |
| `mono` | black/white + one red | design, architecture, manifestos |

## Phase 2: Storyboard

Before writing HTML, plan the deck as a table and show it to the user. For decks of 8 or more slides, wait for a quick OK unless they asked you to just go ahead:

| # | Message (one sentence) | Layout | Scene | Motion beat |
|---|---|---|---|---|
| 1 | Slides can fly | title | galaxy | letters reveal, galaxy turns |
| 2 | One cloud, many shapes | split | morph (sphere→torus→helix) | each → morphs + reveals a point |

To pick a scene for each message, read **[references/scenes.md](references/scenes.md)**: it covers every scene's meaning, params, steps and best layout. Quick map:

- opening / closing / big idea → `galaxy`, `knot`, `blob`
- transformation, "from X to Y", phases → `morph` with build steps
- global, reach, markets, network effects → `globe`, `network`
- growth, comparisons, metrics → `bars` (real numbers only), stats layout over `terrain`
- a system of parts, ecosystem, team → `orbit` with steps highlighting each item
- roadmap, history, process → `timeline` with steps
- scale, data, infrastructure → `cubes`
- new section / act break → `tunnel` + `layout-section`
- quote, principle → `layout-statement` over a calm scene

Choose the **journey** (how the camera travels between slides) once per deck: `drift` (default, forward through space), `line` (sideways track: process or story), `dive` (descending: going deeper), `spiral` (energetic), `still` (cross-fade only: formal settings).

## Phase 3: Scaffold

```bash
bash <skill-dir>/scripts/new-deck.sh <output-dir> --theme nebula --title "Deck title" --subtitle "One line" --kicker "Event · Date"
```

This copies the runtime into `<output-dir>/lib/` and writes a starter `index.html` with fonts for the theme. `<skill-dir>` is the folder containing this SKILL.md. Never overwrite an existing deck: pick a new folder or edit the existing one.

## Phase 4: Author the slides

Read **[references/authoring.md](references/authoring.md)** before writing slides. It is the full reference for layouts, attributes, build steps, animations, notes and themes. The essentials:

```html
<main class="deck" data-journey="drift">
  <section class="layout-split" data-scene="morph" data-params='{"shapes":["sphere","torus","helix"]}'>
    <span class="kicker">Act one</span>
    <h2>One cloud. Every shape it needs.</h2>
    <ul class="points">
      <li data-step="1" data-anim="left">Becomes a torus</li>
      <li data-step="2" data-anim="left">Then a helix</li>
    </ul>
    <aside class="notes">Speaker notes: press N while presenting.</aside>
  </section>
</main>
```

- `data-params` must be **valid JSON** in single-quoted attributes. Escape `'` in text as `&#39;`.
- Steps: elements with `data-step="n"` appear one press at a time and the scene's `step(n)` is called. Use `data-scene-steps="n"` when the scene has more beats than there are elements.
- Write real content. No lorem ipsum, no "Slide 3", and no invented statistics: if the user gave no numbers, use a non-numeric scene.
- Put speaker notes in `<aside class="notes">` for talks.
- Need a scene the library lacks (a product model, a custom metaphor)? See **[references/custom-scenes.md](references/custom-scenes.md)** and register it with `registerScene` in the deck's script. Don't edit `lib/scenes.js` for one deck.
- Design guidance (typography, colour, density, what to avoid) is in **[references/design.md](references/design.md)**.

## Phase 5: QA (required)

Decks must be served over HTTP (ES modules don't load from `file://`).

**Option A, scripted (preferred):**
```bash
cd <skill-dir>/scripts && npm install          # first time only (Playwright + Chromium)
node <skill-dir>/scripts/qa.mjs <output-dir>   # screenshots → <output-dir>/qa/, plus a report
```
The script screenshots every slide with all build steps shown, and flags elements outside the stage, overflowing boxes, overlapping text blocks, text under 20px, console errors and failed requests.

**Option B, a browser tool** (if you have one): serve with `python3 -m http.server 8000 --directory <output-dir>`, open `http://localhost:8000/?static`, then for each slide run `deck.go(i, {instant:true, allSteps:true})` and screenshot.

Then **look at every screenshot** and fix:
- text sitting on a busy part of the scene → change layout, set `data-offset`, or pick a calmer scene
- 3D cut off at the stage edge → reduce `data-scale` (e.g. `0.85`) or adjust `data-offset`
- scenes too bright or washed out → lower `data-bloom` on `.deck`, or choose another scene
- the same scene twice in a row, or a slide that says nothing → revise

Repeat until clean. Delete the `qa/` folder before delivering unless the user wants it.

## Phase 6: Deliver

Tell the user:
- where the deck is, how to run it (`python3 -m http.server 8000 --directory <dir>`, or `npx serve <dir>`), and that they open `http://localhost:8000`
- controls: → / Space next, ← back, F fullscreen, N speaker notes, ? help, deep links like `#/5`
- how to change the theme (`data-theme` on `<html>` plus the font link; see authoring.md)

Offer the follow-ups:
- **Single file to share**: `node <skill-dir>/scripts/bundle.mjs <dir>` writes `<dir>/deck.html` with everything inlined. It opens by double-click and needs internet only for the Three.js CDN and fonts.
- **PDF**: `node <skill-dir>/scripts/qa.mjs <dir> --pdf <dir>/deck.pdf` gives one page per slide (static frames).
- **Hosting**: the folder is static. GitHub Pages, Netlify, Vercel or S3 all work as-is.

## Supporting files

| File | Read when |
|---|---|
| [references/scenes.md](references/scenes.md) | Phase 2, choosing scenes and params |
| [references/authoring.md](references/authoring.md) | Phase 4, writing the HTML |
| [references/design.md](references/design.md) | Phase 2 and 4, design quality and themes |
| [references/custom-scenes.md](references/custom-scenes.md) | only when a custom 3D scene is needed |
| `scripts/new-deck.sh` | Phase 3 |
| `scripts/qa.mjs` | Phase 5, plus PDF export |
| `scripts/bundle.mjs` | Phase 6, single-file export |
| `assets/runtime/` | copied into every deck by new-deck.sh |
