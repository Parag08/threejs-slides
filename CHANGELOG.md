# Changelog

## Unreleased

- Rule: text is never cut by a line, shape or other text. Chart rules leave gaps around labels, labels pick free spots, and `qa.mjs` now reports 3D text crossed by a line or overlapping another label (`deck.textCollisions()`)
- Fix: `data-scene-steps` on a chart slide now turns on step reveal (before, those presses showed nothing and → seemed stuck); on scenes without build steps the engine ignores it and warns
- Cleaner look: no glow by default (`data-bloom` is opt-in, default 0), no halo on HTML text or 3D labels, chart bars and shapes are solid (opaque) with glow kept low and used only on highlighted items
- Chart kit (Phase B of docs/ROADMAP.md): one shared module for formatting (`unit`, `prefix`, `decimals`, `compact`), one-highlight colouring, step reveal (`reveal: "step"`), screen-reader data tables
  - `bars` v2: several series (`grouped`, `stacked`, `percent`), horizontal (`orientation: "h"`), negatives, `sort`, `target` line, `delta` bracket, `annotations`. Existing single-series decks keep working; with a highlight, the other bars now turn neutral
  - New scenes: `line` (multi-series, `forecast` dotted, `low`/`high` confidence band, `target`), `waterfall` (bridges, `good: "down"` for costs), `scatter` (trend line, bubbles), `matrix` (2×2 with quadrants and focus), `gantt` (workstreams, milestones, today line)
  - Archetypes and arcs now point to the charts (trend, bridge, ranking, correlation, prioritisation, roadmap, financial projection)
- Consulting formats (Phase A of docs/ROADMAP.md):
  - `references/arcs.md`: 10 story arcs (case study, recommendation/SCR, business case, pitch, review, strategy, post-mortem, research, talk, launch) with their acts
  - `references/archetypes.md`: six slide jobs (frame, situate, quantify, explain, decide, plan) and the format for each; SKILL.md Phase 2 now goes arc → archetype → action title → scene
  - New layouts: `layout-summary` (executive summary), `layout-compare` (before/after, situation/complication), `layout-table` (with Harvey balls `.harvey` and marks `.mark`)
  - Slide furniture, injected into the slide so it prints: act tracker (`data-tracker`), `data-source` footnote, `data-sticker` status tag, `data-appendix`; `.delta` ▲/▼ change markers
  - `qa.mjs` prints a ghost deck (titles by act, saved to `qa/ghost-deck.md`) and story checks: label-style titles, number slides without a source, long decks without acts
- Storyboard is narrative-first: Phase 2 picks an arc by deck type (project/case study: problem → what I built → rollout and results; pitch; talk; update; launch), names 3–5 acts with a section divider each, and adds an Act column to the storyboard table
- `data-brightness` on `.deck` (or `createDeck({ brightness })`) dims every 3D object at once
- Fix: `data-brightness` now works on shader scenes (galaxy, morph, network and globe points, globe atmosphere, terrain, blob) via a `uBrightness` uniform; custom-scenes.md documents it
- Readability: text halo + per-layout scrim, 3D dimmed when it sits behind text (`data-dim`), solid higher-contrast text colours (`--text-2`, brighter `--muted`), pale-tint kicker
- 3D labels get a halo; orbit's centre label now sits above the diagram
- Orbit and bars scenes about 20% less bright; new `data-brightness` per slide
- Fullscreen button: a labelled pill at top centre, shown on the first slide until you go fullscreen, otherwise on hover near the top edge
- Slide dots: click to jump, title tooltips; shown on the last slide and on hover near the bottom edge (`data-dots`)
- Evals: `evals/` suite for `claude plugin eval`, 13 activation cases and 8 full-deck briefs, plus `evals/check-deck.mjs` for structural checks and screenshot QA on any deck

## 1.0.0 (2026-11-24)

First release.

- `threejs-slides` skill: brief → storyboard → scaffold → author → QA → deliver workflow
- Runtime (three.js r187, no build step): fixed 1920×1080 stage, camera journeys (`drift`, `line`, `dive`, `spiral`, `still`), cross-faded 3D scenes, staggered HTML entrance animations, build steps, speaker notes, keyboard/click/swipe/wheel navigation, reduced-motion support, optional bloom
- 12 scenes: galaxy, morph, globe, terrain, orbit, bars, network, knot, blob, tunnel, cubes, timeline, plus `registerScene` for custom ones
- 10 layouts and 5 themes (nebula, ember, aurora, paper, mono) that also colour the 3D
- Scripts: `new-deck.sh` (scaffold), `qa.mjs` (screenshots, layout checks, PDF), `bundle.mjs` (single-file HTML)
- Claude Code plugin and marketplace manifests
