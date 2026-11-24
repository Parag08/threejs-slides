# DESIGN.md: threejs-slides design system

The source of truth for how decks made with this skill look and move. Update it whenever the runtime's visuals change.

## Principles

1. **Motion carries meaning.** Every scene and every build step expresses something in the message (change → morph, growth → bars, reach → globe, sequence → timeline).
2. **One world.** All slides share one 3D space; changing slides is a camera flight, not a page swap.
3. **Theme drives everything.** CSS custom properties are read by the engine at startup, so the HTML and the 3D always match.
4. **Projector-first.** A fixed 1920×1080 stage, large type, high contrast, nothing under 20px.

## Stage

- 1920×1080, scaled uniformly (letterboxed) to the window. No reflow.
- Slide padding: 110px top · 140px sides · 120px bottom.
- The WebGL canvas exactly covers the stage rect, so 3D placement is stable at every window size.
- Camera: 45° FOV at distance 8, giving a visible area of about ±5.9 × ±3.3 world units at the anchor plane.

## Themes

| Token | nebula | ember | aurora | paper | mono |
|---|---|---|---|---|---|
| `--bg` | #05070d | #0f0a08 | #03110e | #f3eee4 | #0a0a0a |
| `--fg` | #f2f5fa | #fbf3ea | #effff8 | #15130f | #f7f7f4 |
| `--text-2` | #ccd4e2 | #eadccd | #c3ebdc | #34302a | #d6d6d2 |
| `--muted` | #aab3c5 | #c4b2a5 | #a3c9bb | #57514a | #aeaea9 |
| `--accent` | #5cf2d6 | #ff8a3d | #3dffa8 | #2046d8 | #f4f4f1 |
| `--accent-2` | #ff7a59 | #ffd166 | #2bd9ff | #e0442b | #ff4b33 |
| `--accent-3` | #7aa2ff | #e6394a | #f7e86b | #0f8a6a | #9a9a95 |
| display font | Bricolage Grotesque 700 | Fraunces 600 | Familjen Grotesk 700 | Newsreader 500 | Archivo 800 |
| body font | Hanken Grotesk | Figtree | Familjen Grotesk | Public Sans | Archivo |
| mono font | JetBrains Mono | IBM Plex Mono | Space Mono | IBM Plex Mono | JetBrains Mono |

Roles: `--accent` dominant 3D colour and UI accent; `--accent-2` highlight (the thing to look at); `--accent-3` support and rim light.
Light mode (background lightness above 55%): normal blending instead of additive, bloom off, brighter environment.

## Type scale (px at 1920×1080)

| Role | Size | Notes |
|---|---|---|
| h1 (title) | 168 / 148 | display font, tracking −0.035em, leading 0.98 |
| h2 | 96 (84 in bottom layout, 150 in section) | |
| h3 | 46 | |
| statement blockquote | 104 | |
| stat value | 136 | tabular numerals |
| lede | 40 | 82% fg |
| body / li | 32 | leading 1.42 |
| small | 24 | muted |
| kicker | 24 mono | accent, with a 56px rule |
| code | 26 (24 in split layouts) | |

## Motion

- Easing: `cubic-bezier(.16, 1, .3, 1)` for HTML; ease-in-out cubic for the camera.
- Camera flight: 1.1–2.3s scaled by distance; quadratic-bezier swoop (lifted and pulled back).
- 3D cross-fade: outgoing object fades over the first 40% of the flight, incoming over the last 50%.
- HTML: incoming slide activates at 42% of the flight; children stagger by 110ms; letters by 28ms.
- Exit: 0.35s, no stagger.
- Reduced motion / `?static`: instant cuts, scene speed ×0.15.

## Rendering

- three.js r187, WebGLRenderer, no tone mapping (scene colours equal the CSS palette), sRGB output.
- Lights: hemisphere (fg/bg) + white key + accent-3 rim + RoomEnvironment PMREM.
- Bloom (UnrealBloomPass): strength 0.4, radius 0.45, threshold 0.42 on dark themes; off on light themes and `?quality=low`.
- Fog: bg colour, 30–150 units, which hides the other slides' anchors.
- Ambient field: 7000 points (2500 in `dust`) spanning the journey's bounding box.

## Layouts

title · center · split (3D x+3.3) · split-reverse (3D x−3.3) · bottom (3D y+0.5) · top (3D y−1.1) · statement · section · stats · cards. The offsets live in `layoutOffset()` in the engine.

## Legibility

No text colour can contrast with both a dark background and bright particles (white on the aqua galaxy measures 1.2:1). So text always gets a dark (or light, on paper) patch behind it:

- **Text roles:** `--fg` headlines/body (16–18.6:1 on bg), `--text-2` secondary (11–15:1), `--muted` captions (6.8–10.7:1). Kicker = 35% accent + 65% fg; the accent stays on its rule line. No transparency in text colours.
- **Halo:** `text-shadow: 0 0 2px, 0 0 8px, 0 2px 26px` in bg at 92%.
- **Scrim:** `.slide::before` gradient in bg at `--scrim` (78%; 86% on title/center/statement/section), shaped per layout.
- **3D dim by layout:** split 1.0 · top/bottom/stats 0.7 · title/center/statement/section/cards 0.42. Override with `data-dim`.
