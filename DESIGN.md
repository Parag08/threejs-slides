# DESIGN.md: threejs-slides design system

The source of truth for how decks made with this skill look and move. Update it whenever the runtime's visuals change.

## Principles

1. **Motion carries meaning.** Every scene and every build step expresses something in the message (change → morph, growth → bars, reach → globe, sequence → timeline).
2. **One world.** All slides share one 3D space; changing slides is a camera flight, not a page swap.
3. **Theme drives everything.** CSS custom properties are read by the engine at startup, so the HTML and the 3D always match.
4. **Story before scenes.** Every deck is planned as named acts (e.g. problem → what I built → rollout and results), each opened by a `tunnel` section divider; scenes are chosen after the arc.
5. **Projector-first.** A fixed 1920×1080 stage, large type, high contrast, nothing under 20px.

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
- Bloom (UnrealBloomPass) is off by default; `data-bloom` opts in (radius 0.45, threshold 0.42). Off on light themes and `?quality=low` regardless.
- Fog: bg colour, 30–150 units, which hides the other slides' anchors.
- Ambient field: 7000 points (2500 in `dust`) spanning the journey's bounding box.
- Brightness: `data-brightness` multiplies object colours (not opacity, not labels): material `color`/`emissiveIntensity`, and a `uBrightness` uniform in every built-in ShaderMaterial (points, globe atmosphere, terrain, blob). On `.deck` it applies to every slide and multiplies each slide's own value.

## Layouts

title · center · split (3D x+3.3) · split-reverse (3D x−3.3) · bottom (3D y+0.5) · top (3D y−1.1) · statement · section · stats · cards. The offsets live in `layoutOffset()` in the engine.

## Legibility

No text colour can contrast with both a dark background and bright particles (white on the aqua galaxy measures 1.2:1). So text always gets a dark (or light, on paper) patch behind it:

- **Text roles:** `--fg` headlines/body (16–18.6:1 on bg), `--text-2` secondary (11–15:1), `--muted` captions (6.8–10.7:1). Kicker = 35% accent + 65% fg; the accent stays on its rule line. No transparency in text colours.
- **Scrim:** `.slide::before` gradient in bg at `--scrim` (78%; 86% on title/center/statement/section), shaped per layout.
- **3D dim by layout:** split 1.0 · top/bottom/stats 0.7 · title/center/statement/section/cards 0.42. Override with `data-dim`.

## Business layouts and furniture

Consulting conventions (see `references/archetypes.md`):

- **layout-summary:** numbered rows (mono `01` in accent, 40px display sentence + 26px support), rules between rows.
- **layout-compare:** two panels at `--panel` with blur, 120px gap, an accent → between them; `.is-key` panel gets an accent border and heading.
- **layout-table:** `table.data` on a blurred panel, 22px mono headers, 28px cells, first column in `--fg`; `tr.is-key` row tinted 12% accent with a 5px accent bar. Harvey balls are 34px conic-gradient circles in `--fg`; marks are ✓ in accent, ✗ in muted, ◐ in text-2.
- **Furniture** (part of the slide, so it prints): tracker at top-left (140, 50), 20px mono muted; sticker at top-right, 20px mono, accent-2 outline; source at bottom-left (140, 44), 20px muted with a bold "Source:". All three stay outside the 110px/120px content padding.
- **Delta:** ▲/▼ in mono; `good` = accent, `bad` = accent-2, neutral = text-2.
- 3D behind these layouts is dimmed to 0.42, like cards. Pair them with calm scenes.

## Charts

All six data scenes (`bars`, `line`, `waterfall`, `scatter`, `matrix`, `gantt`) share the chart kit in `scenes.js`:

- **Frame:** floor grid at 12% fg for value charts (as bars always had), three-quarter view (`rotate` −0.2 to −0.32); planar charts (matrix, scatter, gantt) face the camera with a slight turn. Horizontal bars turn the other way (+0.12) so the value end recedes and stays on stage.
- **Materials:** solid and opaque once faded in (transparent only while fading), low emissive (0.06–0.1); highlighted items a little higher (0.2–0.3). No bloom.
- **Colour:** no highlight → theme colours (accent, accent-3, accent-2, neutral). Any highlight → that item in accent-2, everything else neutral (fg 45% toward bg). Waterfall: totals neutral, good changes accent, bad accent-2 (`good: "down"` swaps).
- **Text is never cut:** dashed rules (target, trend, forecast, today) leave gaps where a label sits; target and today labels pick the first free spot; matrix and scatter labels try beside, other side, above, below, staying inside their quadrant; overlapping labels are nudged apart. `deck.textCollisions()` reports anything left, and `qa.mjs` fails on it.
- **Labels:** plain sprites, no halo or glow. Values 0.24–0.3 world units in the display font, bold; categories 0.2–0.22 in muted; callouts in accent-2.
- **Rules:** target lines dashed fg at 70–75%; delta brackets solid accent-2; forecasts dotted with a dashed marker; confidence bands at 16% of the series colour.
- **Motion:** bars grow from the axis, lines draw left to right, waterfall changes drop into place, matrix items fly to their quadrant, gantt rows extend. `reveal: "step"` makes each unit one press.
- **Ranges:** line and scatter round their axes to tidy steps (1, 2, 2.5, 5 × 10ⁿ).

## Slide dots

- One 12px dot per slide in a frosted pill at bottom centre (28px from the edge); the current slide is a 40px accent pill. Hit area is 34px.
- Tooltip on hover/focus: `n · headline`, body font 22px, on a 92% bg panel.
- Visibility (`data-dots="auto"`): always on the last slide; elsewhere it shows when the pointer is in the bottom 16% of the stage and hides 2s after it leaves. Fades and slides up over 0.35–0.45s.

## Fullscreen button

- Labelled pill at top centre, 30px from the top: accent corner-arrows icon, "Fullscreen" (body font 22px, 600), and an `F` key hint in mono. It switches to "Exit fullscreen" when active.
- Frosted 78% bg, 1px line border; on hover the border turns accent.
- Shown on slide 1 until fullscreen is entered; elsewhere when the pointer is in the top 14% of the stage, hiding 2s after it leaves.
- The `?` help banner sits below it (top 108px) so the two never overlap.
