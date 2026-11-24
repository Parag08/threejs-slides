# Changelog

## 1.0.0 (2026-11-24)

First release.

- `threejs-slides` skill: brief → storyboard → scaffold → author → QA → deliver workflow
- Runtime (three.js r187, no build step): fixed 1920×1080 stage, camera journeys (`drift`, `line`, `dive`, `spiral`, `still`), cross-faded 3D scenes, staggered HTML entrance animations, build steps, speaker notes, keyboard/click/swipe/wheel navigation, reduced-motion support, optional bloom
- 12 scenes: galaxy, morph, globe, terrain, orbit, bars, network, knot, blob, tunnel, cubes, timeline, plus `registerScene` for custom ones
- 10 layouts and 5 themes (nebula, ember, aurora, paper, mono) that also colour the 3D
- Scripts: `new-deck.sh` (scaffold), `qa.mjs` (screenshots, layout checks, PDF), `bundle.mjs` (single-file HTML)
- Claude Code plugin and marketplace manifests
