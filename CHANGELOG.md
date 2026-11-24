# Changelog

## Unreleased

- Readability: text halo + per-layout scrim, 3D dimmed when it sits behind text (`data-dim`), solid higher-contrast text colours (`--text-2`, brighter `--muted`), pale-tint kicker
- 3D labels get a halo; orbit's centre label now sits above the diagram
- Orbit and bars scenes about 20% less bright; new `data-brightness` per slide
- Slide dots: click to jump, title tooltips; shown on the last slide and on hover near the bottom edge (`data-dots`)

## 1.0.0 (2026-11-24)

First release.

- `threejs-slides` skill: brief → storyboard → scaffold → author → QA → deliver workflow
- Runtime (three.js r187, no build step): fixed 1920×1080 stage, camera journeys (`drift`, `line`, `dive`, `spiral`, `still`), cross-faded 3D scenes, staggered HTML entrance animations, build steps, speaker notes, keyboard/click/swipe/wheel navigation, reduced-motion support, optional bloom
- 12 scenes: galaxy, morph, globe, terrain, orbit, bars, network, knot, blob, tunnel, cubes, timeline, plus `registerScene` for custom ones
- 10 layouts and 5 themes (nebula, ember, aurora, paper, mono) that also colour the 3D
- Scripts: `new-deck.sh` (scaffold), `qa.mjs` (screenshots, layout checks, PDF), `bundle.mjs` (single-file HTML)
- Claude Code plugin and marketplace manifests
