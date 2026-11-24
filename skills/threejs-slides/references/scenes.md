# Scene library

Set a scene with `data-scene="name"` on a `<section>` and pass options as JSON in `data-params`.
All colours come from the theme, so scenes always match the deck.

Every scene accepts these slide attributes (handled by the engine, not the scene):

| Attribute | Effect | Example |
|---|---|---|
| `data-offset="x,y,z"` | move the object (world units; the stage is about ±5.9 wide and ±3.3 tall at the default camera) | `data-offset="0,-1,0"` |
| `data-scale="n"` | scale the object | `data-scale="0.8"` |
| `data-rotate="x,y,z"` | rotate the object, in degrees | `data-rotate="0,30,0"` |
| `data-camera="x,y,z"` | camera position relative to the slide anchor (overrides the scene default) | `data-camera="0,2,10"` |
| `data-look="x,y,z"` | camera look-at point relative to the anchor | `data-look="0,0.5,0"` |
| `data-dim="0..1"` | 3D brightness on this slide. Default by layout: 1 for split layouts, 0.7 for top/bottom/stats, 0.42 when the 3D sits behind text (title, center, statement, section, cards) | `data-dim="0.6"` |
| `data-scene-steps="n"` | number of build steps for the scene when there are fewer `data-step` elements | `data-scene-steps="5"` |

Layouts set a default offset: `layout-split` → object at x = +3.3 (right), `layout-split-reverse` → x = −3.3 (left), `layout-bottom` → y = +0.5, `layout-top` → y = −1.1.

---

## galaxy: hero / opening / closing
Spiral galaxy of about 14k glowing points that slowly turns. Says: scale, ambition, "the big picture".
Best with `layout-title`, `layout-center`.

| param | default | |
|---|---|---|
| `count` | 14000 | number of points (lower to 6000 on weak machines) |
| `arms` | 4 | spiral arms |
| `radius` | 4.2 | size |
| `spin` | 1.15 | how tightly the arms wind |
| `tilt` | 0.5 | tilt toward the camera, in radians |
| `size` | 3.2 | point size |
| `seed` | 7+index | change it for a different galaxy |

## morph: transformation, with build steps
A particle cloud that swarms from scattered dust into a shape, then into the next shape on each step.
Says: change, evolution, "from X to Y", phases of a plan. Best with `layout-split` / `layout-split-reverse`.

| param | default | |
|---|---|---|
| `shapes` | `["sphere","torus","helix"]` | any of `sphere`, `torus`, `helix`, `cube`, `wave`, `knot`, `galaxy`, `scatter` |
| `count` | 7000 | particles |
| `size` | 3.4 | point size |

Steps: step *k* morphs to `shapes[k]` (step 0 is `shapes[0]`). Give the slide `shapes.length − 1` steps with `data-step` elements or `data-scene-steps`.

## globe: global reach, markets, connections
A dotted planet with a fresnel atmosphere, plus arcs that draw between points.
Best with `layout-split`, `layout-split-reverse`.

| param | default | |
|---|---|---|
| `points` | `[]` | `[{"lat":51.5,"lng":-0.1,"label":"London"}]` markers with optional labels |
| `arcs` | random | `[[lat1,lng1,lat2,lng2], …]` real routes |
| `arcCount` | 10 | random arcs when `arcs` isn't set |
| `dots` | 2600 | dot density |
| `radius` | 1.95 | size |

## terrain: atmosphere under numbers
A flowing wireframe landscape below the text. Says: momentum, landscape, "the ground is moving".
Best with `layout-stats`, `layout-top`, `layout-center`. Keep the text in the top 60%.

| param | default | |
|---|---|---|
| `amplitude` | 0.8 | wave height |
| `opacity` | 0.32 dark / 0.55 light | line strength |
| `size` | 34 | plane size |
| `y` | −3.5 | vertical position |

## orbit: a system of parts
A glowing core with labelled satellites on a ring. Each step highlights the next satellite.
Says: ecosystem, product pillars, team, options. Best with `layout-split-reverse` / `layout-split`.

| param | default | |
|---|---|---|
| `items` | 5 placeholders | satellite labels; keep to 7 or fewer, each 1–2 words |
| `center` | none | label on the core |
| `radius` | 2.15 | ring radius |

Steps: step *k* highlights item *k* (step 0 shows all evenly). Use `data-scene-steps="<items.length>"`.

## bars: real numbers, animated
A 3D bar chart that grows bar by bar, with value and category labels.
Best with `layout-bottom` (chart above, headline below). **Use only real data from the user.**

| param | default | |
|---|---|---|
| `data` | sample | `[{"label":"2023","value":12}, {"label":"2024","value":31,"highlight":true}]` |
| `unit` | `""` | suffix on value labels, e.g. `"%"`, `"M"` |
| `height` | 2.6 | height of the tallest bar |
| `gap` | 1.05 | spacing; lower it for more than 7 bars |
| `rotate` | −0.32 | y-rotation (radians) for a 3/4 view |

## network: connections, intelligence, community
A slowly rotating constellation of nodes and links with pulses travelling along edges.
Calm enough to sit behind `layout-cards` and `layout-center` (set `data-offset="0,0,-3"` to push it back).

| param | default | |
|---|---|---|
| `nodes` | 150 | node count |
| `radius` | 2.8 | cloud radius |
| `linkDistance` | 1.15 | link threshold (more links = denser) |
| `pulses` | 60 | moving pulses |

## knot: premium hero object
A glossy, iridescent torus knot with a halo of particles. Says: craft, quality, "something complex made elegant".
Best with `layout-split` / `layout-split-reverse`.

| param | default | |
|---|---|---|
| `p`, `q` | 2, 3 | knot winding (try 3,4 or 2,5) |
| `iridescence` | 0.8 | 0–1 |

## blob: organic, human, calm
A breathing shader sphere whose surface flows. Says: people, wellbeing, softness, "alive".
Best with `layout-split-reverse` / `layout-split`. Avoid putting text over it.

| param | default | |
|---|---|---|
| `amplitude` | 0.32 | surface deformation |
| `radius` | 1.9 | size |

## tunnel: section break / "going in"
Coloured rings rushing toward the camera. Use for act dividers with `layout-section`, not for content.

| param | default | |
|---|---|---|
| `rings` | 34 | ring count |
| `speed` | 9 | flight speed |
| `radius` | 3.4 | ring radius |

## cubes: scale, data, infrastructure
An instanced field of cubes rippling out from the centre, seen from above.
Best with `layout-top` (text above the field) or `layout-statement` with short text. Dimmed on dark themes so text stays readable.

| param | default | |
|---|---|---|
| `grid` | 22 | cubes per side |
| `amplitude` | 1.4 | ripple height |
| `spacing` | 0.42 | |

## timeline: roadmap, history, process
A glowing path with milestone nodes and labels. Each step moves a marker to the next milestone and lights it.
Best with `layout-top` and `data-offset="0,-0.9,0"`.

| param | default | |
|---|---|---|
| `items` | 4 years | `[{"label":"Q1","sub":"Private beta"}, …]`, 7 or fewer items |
| `start` | 1 | milestone lit on entry |
| `width` | 9 | path length |

Steps: step *k* lights milestone *k*. Use `data-scene-steps="<items.length>"`.

## none
No object. Only the ambient star field and the camera journey. Good for dense text slides.

---

## Pairing cheatsheet

| Story beat | Scene | Layout |
|---|---|---|
| Title / closing | galaxy, knot | title, center |
| Problem → solution, phases | morph (+steps) | split |
| Market, reach, partners | globe | split |
| Key numbers | terrain | stats + top |
| Growth / comparison with real data | bars | bottom |
| Pillars, ecosystem, team | orbit (+steps) | split-reverse |
| Architecture, how it works | network | cards |
| Roadmap, history | timeline (+steps) | top |
| Principle, quote | cubes, network, none | statement |
| Human / values | blob | split-reverse |
| New act | tunnel | section |
