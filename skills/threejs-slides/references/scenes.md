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
| `data-brightness="n"` | multiply the object's colours and glow (0.8 = 20% darker). Doesn't touch labels. Works on every built-in scene; custom shaders opt in with a `uBrightness` uniform. Set it on `.deck` to dim the whole deck | `data-brightness="0.8"` |
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
| `center` | none | title label shown above the orbit |
| `radius` | 2.15 | ring radius |

Steps: step *k* highlights item *k* (step 0 shows all evenly). Use `data-scene-steps="<items.length>"`.

## Charts (the chart kit)

Six data scenes share one kit, so they look and behave alike. **Use only numbers the user gave you**, and put `data-source` on the slide.

Shared params (every chart):

| param | default | |
|---|---|---|
| `unit` / `prefix` | `""` | `"unit":" km"` → 60 km; `"prefix":"$"` → $4.6M |
| `decimals` | auto | fixed decimals |
| `compact` | false | 12400 → 12.4k, 3,200,000 → 3.2M |
| `reveal` | `"all"` | `"all"`: everything grows in on entry, staggered. `"step"`: one unit (bar, series, item or row) per press. Setting `data-scene-steps="<units>"` on the slide turns step mode on by itself |
| `revealStart` | 0 | units already shown in step mode |
| `rotate` | per chart | y-rotation in radians |
| `title` | `"Chart data"` | caption of the hidden screen-reader table |

Consulting colour rule, built in: highlight one thing (`"highlight":true`) and everything else turns neutral grey, so the eye goes to the number that proves the headline. With no highlight, the theme colours are used.
Every chart also writes a visually hidden `<table>` of its data into the slide, for screen readers.

## bars: compare, rank, compose
3D bars that grow into place. Best with `layout-bottom` (chart above, headline below); horizontal bars suit `layout-split`.

| param | default | |
|---|---|---|
| `data` | sample | single series: `[{"label":"2024","value":31,"highlight":true}]`. Negative values grow below the axis |
| `labels` + `series` | — | several series: `"labels":["Q1","Q2"],"series":[{"name":"Plan","values":[40,45]},{"name":"Actual","values":[38,47],"highlight":true}]` |
| `mode` | `"grouped"` | with several series: `grouped` · `stacked` · `percent` (100% stacked) |
| `orientation` | `"v"` | `"h"` for horizontal bars (rankings, long labels, sensitivity/tornado charts with negatives) |
| `sort` | none | `"desc"` / `"asc"` (single series) |
| `target` | none | dashed reference line at that value; `targetLabel` to rename it |
| `delta` | none | bracket between two bars with the % change: `{"from":0,"to":2}`; `text` to override |
| `annotations` | `[]` | callouts: `[{"index":2,"text":"Hubs live"}]` |
| `totals` | true | stacked: total above each stack |
| `revealBy` | `"category"` | `"series"` reveals one series per step |
| `height` / `length` | 2.6 / 3.8 | size of the value axis (vertical / horizontal) |
| `gap` | 1.05 | category spacing |

Keep to 7 categories or fewer and 4 series or fewer.

## line: trends and projections
Lines that draw left to right on a floor grid, with tidy y ticks. Best with `layout-bottom`.

| param | default | |
|---|---|---|
| `labels` + `series` | sample | `"labels":["2023","2024","2025"],"series":[{"name":"Revenue","values":[2.1,2.9,3.8]}]`. Or `data` like bars |
| `forecast` | none | index of the first projected point: from there the line is dotted and a dashed "Forecast →" marker appears |
| `low` / `high` | none | per series, arrays the same length as `values` (`null` where none): draws a shaded confidence band |
| `highlightIndex` | none | per series, points to mark and label: `[3]` |
| `highlight` | false | per series: this series in the highlight colour, the rest neutral |
| `target` | none | dashed reference line |
| `annotations` | `[]` | `[{"series":0,"index":2,"text":"Hubs launched"}]` |
| `min` / `max` | nice range from 0 | y range; say so in the headline or a note if it doesn't start at 0 |
| `ticks` | true | y tick labels on the left |
| `width` / `height` | 7.6 / 2.6 | plot size |

Each series is labelled at its end (name · last value); no legend needed.

## waterfall: bridges (how A became B)
Start total, the ups and downs that drop into place one by one, end total, with connector lines. Best with `layout-bottom`; pairs well with `"reveal":"step"`.

| param | default | |
|---|---|---|
| `data` | sample | `[{"label":"2025","value":100},{"label":"Price","value":18},{"label":"Cost","value":-9},{"label":"2026","value":109}]`. First and last are totals |
| `total` | — | per item: `true` makes any bar a subtotal (from zero) |
| `autoTotals` | true | `false`: first and last are not treated as totals |
| `good` | `"up"` | `"down"` when decreases are good (costs, km): swaps the colours |
| `highlight` | — | per item: mark one bar in the support colour |
| `height` / `gap` | 2.6 / 1.2 | |

## scatter: correlation
Points on two axes with a nice-rounded range, optional least-squares trend line. Best with `layout-split` / `layout-split-reverse`.

| param | default | |
|---|---|---|
| `items` | sample | `[{"x":36,"y":61,"label":"Jun","highlight":true,"size":12}]` |
| `series` | — | `[{"name":"2025","points":[{"x":1,"y":2}]}]` for coloured groups (with legend) |
| `x` / `y` | — | axis config: `{"label":"Orders per day","unit":" km","domain":[0,60]}` |
| `trend` | false | dashed trend line |
| `size` | — | per item: bubble size (area scales with the value) |

## matrix: 2×2 (prioritise, position, risk)
A 2×2 with named quadrants; items fly to their place one by one. Best with `layout-split` / `layout-split-reverse`.

| param | default | |
|---|---|---|
| `items` | sample | `[{"label":"Hubs","x":0.3,"y":0.85,"highlight":true}]`; x and y from 0 to 1 (or set a `domain`) |
| `x` / `y` | — | `{"label":"Effort","low":"Low","high":"High"}` |
| `quadrants` | none | names in order top-left, top-right, bottom-left, bottom-right |
| `focus` | none | tint one quadrant: `"top-left"` … |
| `size` | — | per item: bubble size |

Use `"reveal":"step"` with `data-scene-steps="<items>"` to place items one per press.

## gantt: roadmaps with parallel workstreams
Rows of bars over periods, milestones and a today line. Best with `layout-top`.

| param | default | |
|---|---|---|
| `periods` | Q1–Q4 | column labels |
| `rows` | sample | `[{"label":"Build","start":0.8,"end":2.6,"highlight":true,"note":"v2"}]`, in period units (0 = start of the first period) |
| `milestones` | `[]` | `[{"at":1,"label":"Pilot live"}]` on a bottom lane, or `"row":1` to sit on a row |
| `today` | none | dashed "Today" line at that position; `todayLabel` to rename |
| `width` / `labelWidth` / `rowHeight` | 9 / 2.4 / 0.56 | |

7 rows or fewer.

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
| Comparison / ranking with real data | bars (h for rankings) | bottom, split |
| Trend, projection, forecast | line | bottom |
| Bridge: how A became B | waterfall (+steps) | bottom |
| Correlation | scatter | split |
| Prioritise, position, risk | matrix (+steps) | split / split-reverse |
| Roadmap with workstreams | gantt | top |
| Pillars, ecosystem, team | orbit (+steps) | split-reverse |
| Architecture, how it works | network | cards |
| Roadmap, history | timeline (+steps) | top |
| Principle, quote | cubes, network, none | statement |
| Human / values | blob | split-reverse |
| New act | tunnel | section |
