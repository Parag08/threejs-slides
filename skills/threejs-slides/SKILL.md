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
    ├── scenes.js           17 built-in 3D scenes, incl. the chart kit
    └── threejs-slides.css  stage, layouts, animations, 5 themes
```

## Core rules

1. **Motion carries meaning.** Every 3D scene and every build step must say something the words alone don't. If a scene is only decoration, use a quieter one (`none`, `network`, `galaxy`) or none at all.
2. **Action titles, one idea per slide.** The headline is the slide's takeaway as a sentence. Speaker decks: a headline plus at most 3 short points. If content overflows, split the slide. Never shrink the text.
3. **Fixed 1920×1080 stage.** The runtime scales the whole stage to fit. Don't add media queries that reflow slides, and size everything in px at 1920×1080.
4. **Text and 3D never fight.** The 3D reads best *beside* the text. Use layouts that keep them apart (`layout-split` puts 3D on the right, `layout-split-reverse` on the left, `layout-bottom` puts it above the text). In `layout-center` / `layout-title`, pick a scene that reads as background. The runtime adds a scrim behind text and dims 3D that sits behind it (`data-dim` overrides). Never set running text in `--accent` over a scene.
5. **No text is ever cut.** No line, shape or other text may pass through any text, HTML or 3D: headlines, labels, values, callouts. Charts leave gaps in their rules around labels and move labels to a free spot; if a screenshot still shows text crossed by a line, a bar or another label, move the label, the object (`data-offset`, `data-scale`) or the layout until it's clear.
6. **Vary the rhythm.** Never use the same scene on two consecutive slides. Put a `layout-section` + `tunnel` slide between acts. Bookending a deck with the same scene (title and closing) is fine.
7. **Verify visually.** Don't hand over a deck you haven't screenshotted slide by slide (Phase 5).

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

Plan the **story before the scenes**. A deck that picks a scene per slide without an arc reads like a template tour. Work in this order:

**2a. Pick the arc and name the acts.** Read **[references/arcs.md](references/arcs.md)** and choose the arc from what the audience must do or believe at the end. The common ones:

| Deck type | Arc (acts) |
|---|---|
| Case study / build story | The problem → What I built → Rollout and results → close |
| Recommendation (SCR) | Exec summary → Situation → Complication → Options → Recommendation → Plan → ask |
| Business case / financial projection | Exec summary → Assumptions → Revenue → Costs → Projections → Scenarios and risks → Returns → ask |
| Pitch | Problem → Solution → Market → Traction → Model → Competition → Team → Financials → ask |
| Business review | Exec summary → Results vs plan → Drivers → Wins and misses → Next period |
| Talk / teaching | Hook → Why it matters → How it works → In practice → takeaway |

Rules: 3–5 acts (6 for a business case). Open every act with a `layout-section` + `tunnel` divider (`.num` + act name). The title slide comes before act 1; business decks put an executive summary (`layout-summary`) right after the title; the closing ask comes after the last act. Each slide belongs to exactly one act; if a slide fits two (for example "hub siting", both built and rolled out), split the message: *what it is* goes in the build act, *how people took it* in the rollout act.

**2b. Give every slide a job (archetype).** Read **[references/archetypes.md](references/archetypes.md)**. Each slide does one job (frame, situate, quantify, explain, decide or plan) through one archetype (KPI headline, trend, evaluation table, process, …), and the archetype sets the layout and scene. Write every content headline as an **action title**: the takeaway as a sentence ("Km per order fell 25% after launch"), never a label ("Results").

**2c. Storyboard table.** Show the arc and the table to the user before writing HTML. For decks of 8 or more slides, wait for a quick OK unless they asked you to just go ahead:

| # | Act | Archetype | Action title | Layout | Scene | Motion beat |
|---|---|---|---|---|---|---|
| 1 | — | Title | Logistics Valeo | title | galaxy | letters reveal, galaxy turns |
| 2 | 01 Problem | Divider | The problem | section | tunnel | rings rush in |
| 3 | 01 Problem | KPI headline | Manual claiming lost a third of orders | stats + top | terrain | numbers count up |
| 4 | 02 Built | Transformation | The engine accepts what the fleet can serve | split | morph (scatter→sphere→torus) | each step morphs + reveals a rule |

Check the table before moving on: does reading only the Action title column tell the story in order? Does every act have at least one content slide? Is there a closing action?

**2d. Then pick scenes.** The archetype usually names the scene. Otherwise read **[references/scenes.md](references/scenes.md)**: it covers every scene's meaning, params, steps and best layout. Quick map:

- opening / closing / big idea → `galaxy`, `knot`, `blob`
- transformation, "from X to Y", phases → `morph` with build steps
- global, reach, markets, network effects → `globe`, `network`
- comparisons, rankings, composition → `bars` (grouped, stacked, horizontal, target, delta); key numbers → stats layout over `terrain`
- trends and projections → `line` (forecast + band); bridges → `waterfall`; correlation → `scatter`; prioritising → `matrix`; roadmaps with workstreams → `gantt`. Real numbers only, with `data-source`
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
- Dot tooltips use each slide's `h1`/`h2`/`blockquote`. For slides whose headline is long or missing (statements, images), add a short `data-title="…"` to the `<section>`. Set `data-dots` on `.deck` (`auto` · `always` · `last` · `none`) only if the user asks.
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

The script also flags **3D text that is cut**: chart labels crossed by a line (target, trend, forecast, today, a series) or overlapping another label (`3D text cut: …`). These are errors: fix every one.

It also prints a **ghost deck** (every title in order, grouped by act; saved to `qa/ghost-deck.md`) and **story checks**: label-style titles, number slides without a source, long decks without acts. Read the ghost deck: if the titles alone don't tell the story, fix the titles before anything else.

Then **look at every screenshot** and fix:
- any text crossed by a line, shape or other text → move it clear (this includes HTML text over 3D: change layout or `data-offset`)
- text sitting on a busy part of the scene → change layout, set `data-offset`, or pick a calmer scene
- 3D cut off at the stage edge → reduce `data-scale` (e.g. `0.85`) or adjust `data-offset`
- scenes too bright or washed out → lower `data-brightness` on `.deck` or the slide, or choose another scene
- the same scene twice in a row, or a slide that says nothing → revise

Repeat until clean. Delete the `qa/` folder before delivering unless the user wants it.

## Phase 6: Deliver

Tell the user:
- where the deck is, how to run it (`python3 -m http.server 8000 --directory <dir>`, or `npx serve <dir>`), and that they open `http://localhost:8000`
- controls: → / Space next, ← back, N speaker notes, ? help, deep links like `#/5`
- **Fullscreen:** a "Fullscreen" button at the top centre is shown on the first slide (click it before presenting), and on other slides it appears when the mouse nears the top. The F key works too.
- **Slide dots:** a row of dots at the bottom, one per slide, always shown on the last slide (for jumping back during Q&A) and on other slides when the mouse nears the bottom. Hover a dot for the slide's title, click to fly there.
- how to change the theme (`data-theme` on `<html>` plus the font link; see authoring.md)

Offer the follow-ups:
- **Single file to share**: `node <skill-dir>/scripts/bundle.mjs <dir>` writes `<dir>/deck.html` with everything inlined. It opens by double-click and needs internet only for the Three.js CDN and fonts.
- **PDF**: `node <skill-dir>/scripts/qa.mjs <dir> --pdf <dir>/deck.pdf` gives one page per slide (static frames).
- **Hosting**: the folder is static. GitHub Pages, Netlify, Vercel or S3 all work as-is.

## Supporting files

| File | Read when |
|---|---|
| [references/arcs.md](references/arcs.md) | Phase 2a, choosing the story arc and acts |
| [references/archetypes.md](references/archetypes.md) | Phase 2b, the job and format of each slide |
| [references/scenes.md](references/scenes.md) | Phase 2d, choosing scenes and params |
| [references/authoring.md](references/authoring.md) | Phase 4, writing the HTML |
| [references/design.md](references/design.md) | Phase 2 and 4, design quality and themes |
| [references/custom-scenes.md](references/custom-scenes.md) | only when a custom 3D scene is needed |
| `scripts/new-deck.sh` | Phase 3 |
| `scripts/qa.mjs` | Phase 5, plus PDF export |
| `scripts/bundle.mjs` | Phase 6, single-file export |
| `assets/runtime/` | copied into every deck by new-deck.sh |
