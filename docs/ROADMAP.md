# Roadmap: from scene library to slide system

The skill today has 12 scenes and 10 layouts. What works best are the ones that carry **data or
structure** (timeline, bars). The decorative ones (galaxy, blob, knot) are only atmosphere. This plan
takes the opposite view from "pick a cool scene": start from the **job each slide does**, borrow the
formats consulting decks have refined for that job, then give each format a component.

---

## 1. How consulting slides work (the rules to adopt)

| Rule | What it means | How the skill enforces it |
|---|---|---|
| **Action titles** | The headline is the takeaway as a full sentence ("Km per order fell 25% after launch"), never a label ("Results") | Lint in `qa.mjs`: flag headlines of 1–3 words that don't contain a verb, on content slides |
| **Horizontal logic** | Reading only the titles, in order, tells the whole story | `qa.mjs` prints a "ghost deck" (all titles in order) for review |
| **Vertical logic** | Everything on the slide proves its title, and nothing else | Storyboard: each slide's evidence must be named |
| **Answer first** (Pyramid Principle) | Executive summary right after the title; the rest supports it | Business arcs include an `exec-summary` slide |
| **SCR** | Situation → Complication → Resolution, at deck level and at section level | Arc templates below |
| **MECE** | Sections and options don't overlap and together cover the question | Storyboard check: every slide in exactly one act; options lists are exhaustive |
| **One highlight** | The chart shows everything in grey/neutral and the one number that proves the title in accent | Chart kit: `highlight` on any data point; everything else muted |
| **Source on every data slide** | Footnote line: source, period, method | `.source` element; lint flags data slides without one |
| **Status stickers** | "Illustrative", "Preliminary", "Modelled", "Synthetic" | `.sticker` element, top right |
| **Tracker** | Small breadcrumb showing which section you're in | Runtime renders it from the deck's `layout-section` slides |
| **Ghost deck first** | Write all titles before building any slide | Phase 2 already writes messages first; make it explicit |
| **Appendix** | Backup detail lives after the close, not in the main flow | `layout-section` with `data-appendix`; dots and counter can skip it |

The chart grammar comes from Zelazny's *Say It With Charts*. Every quantitative message is one of five
comparisons, and each one has a correct chart:

| Comparison | The message sounds like | Chart |
|---|---|---|
| **Component** (share of a whole) | "IV is 40% of visits" | 100% stacked bar, donut (sparingly), Marimekko |
| **Item** (ranking) | "Zone A drives the most km" | Horizontal bars, sorted |
| **Time series** | "Km per order fell every month" | Columns (few points), line (many points), with forecast |
| **Frequency** (distribution) | "Most visits take 15–30 min" | Histogram |
| **Correlation** | "Denser days cost less per order" | Scatter / bubble |

Plus the consulting staples that aren't in the five: **waterfall / bridge** (how A became B),
**2×2 matrix** (prioritise or position), **Gantt** (parallel workstreams), **issue tree** (break down a
problem), **Harvey-ball table** (compare options against criteria).

---

## 2. Slide archetypes (MECE by the slide's job)

Every slide does one of six jobs. Under each job is a small set of archetypes: a named slide format
with a fixed layout and component. The storyboard picks the archetype first, then the component follows.

### A. Frame (orient the audience)
| Archetype | Format | Component today → planned |
|---|---|---|
| Title | Name, one-line promise, context | `layout-title` + galaxy ✓ |
| Executive summary | 3–5 action-title bullets, each one a section | new `layout-summary` (numbered, each links to its section) |
| Agenda / tracker | The acts, current one lit | `timeline` (vertical variant) or new `agenda` |
| Section divider | Number + act name | `layout-section` + tunnel ✓ |
| Close / ask | The decision or action wanted, owner, date | `layout-title` + an `.ask` block |
| Appendix | Backup | divider with `data-appendix` |

### B. Situate (why this matters)
| Archetype | Format | Component |
|---|---|---|
| Problem statement | Pain + who has it + cost of doing nothing | split + `network`/`morph` ✓ |
| Situation → complication | Two columns: what was true, what changed | new `layout-compare` |
| Market / landscape | Size, segments, players | `bars`, new `marimekko`, `globe` ✓ |
| Customer voice | A real quote with attribution | `layout-statement` ✓ |

### C. Quantify (prove it with numbers)
| Archetype | Format | Component |
|---|---|---|
| KPI headline | 2–4 big numbers with labels | `layout-stats` ✓ (+ delta arrows, vs-target) |
| Trend | Value over time, forecast dashed | new **`line`** (multi-series, forecast band) |
| Ranking | Sorted horizontal bars | **`bars` v2** `orientation:"h"` |
| Composition | Share of whole | **`bars` v2** stacked / 100%, new `donut` |
| Bridge | Start → drivers → end | new **`waterfall`** |
| Distribution | Histogram | **`bars` v2** with `bins` |
| Correlation | Scatter / bubble | new **`scatter`** |
| Funnel | Stage-by-stage conversion | new `funnel` |
| Before / after | Same metric, two states | **`bars` v2** grouped, or `layout-compare` |

### D. Explain (how it works)
| Archetype | Format | Component |
|---|---|---|
| Process | 3–6 chevrons, step by step | new **`flow`** (chevrons that light per step) |
| System / architecture | Parts and connections | `orbit` ✓, new `graph` (labelled nodes + edges) |
| Framework | 2×2, pyramid, layers | new **`matrix`** (2×2 with items), new `pyramid` |
| Issue tree | Question → MECE branches | new **`tree`** (branches grow per step) |
| Product / demo | Real screenshot, tilted in 3D, with callouts | new **`screen`** (image plane + hotspots) |
| Transformation | From X to Y | `morph` ✓ |

### E. Decide (choose)
| Archetype | Format | Component |
|---|---|---|
| Options | 2–4 options side by side | `layout-cards` ✓ |
| Evaluation | Options × criteria, Harvey balls | new **`layout-table`** + `.harvey` |
| Scenarios | Base / bull / bear | **`line`** with three series, or grouped bars |
| Sensitivity | Which assumptions move the answer | new `tornado` (horizontal diverging bars) |
| Recommendation | The choice + 3 reasons | `layout-split` + highlight |
| Risks | Risk → likelihood/impact → mitigation | **`matrix`** (likelihood × impact) or `layout-table` |

### F. Plan (what happens next)
| Archetype | Format | Component |
|---|---|---|
| Milestones | Dated points | `timeline` ✓ |
| Roadmap | Parallel workstreams over time | new **`gantt`** |
| Financial projection | Revenue/cost/profit over years | **`line`** + **`waterfall`** + `layout-table` |
| Resources / budget | Where the money goes | stacked bars, `donut` |
| Team / owners | Who does what | `layout-cards` or `orbit` ✓ |
| Next steps | Action, owner, date | `layout-table` |

---

## 3. Arcs (deck types, built from archetypes)

Each arc is an ordered list of acts, and each act lists the archetypes it usually contains. The
storyboard starts by picking one of these.

| Deck type | Acts → typical archetypes |
|---|---|
| **Case study / build story** | Problem (problem, KPI baseline) → What I built (system, product demo, process) → Rollout and results (milestones, trend, bridge, KPI) → Learnings (cards) → Close |
| **Consulting recommendation** (SCR) | Exec summary → Situation (landscape, KPI) → Complication (trend, bridge) → Options (options, evaluation) → Recommendation (recommendation, scenarios) → Plan (roadmap, next steps) → Ask |
| **Financial projection / business case** | Exec summary → Assumptions & drivers (table, issue tree) → Revenue build (trend, composition) → Cost build (waterfall, stacked) → Projections (line + forecast band, P&L table) → Scenarios & sensitivity (scenarios, tornado) → Returns (payback line, ROI KPI) → Risks (matrix) → Ask |
| **Fundraising pitch** | Problem → Solution (product demo) → Market (marimekko/bars) → Traction (trend, KPI) → Business model (waterfall unit economics) → Competition (matrix) → Team (cards) → Financials (line) → Ask |
| **Business review / QBR** | Headline (exec summary) → KPIs vs target (stats, bars with target line) → Drivers (bridge) → Wins & misses (compare) → Next quarter (roadmap, next steps) |
| **Strategy / prioritisation** | Where we are → Where to play (matrix) → How to win (pyramid) → Initiatives (evaluation table) → Roadmap (gantt) |
| **Post-mortem / incident** | What happened (milestones) → Impact (KPI, trend) → Root cause (issue tree) → Fixes (process) → Follow-ups (next steps) |
| **Research findings** | Question → Method (process) → Findings, one per slide (any C archetype) → Implications → Next |
| **Conference talk / teaching** | Hook (statement) → Why it matters → How it works (process, system) → Example (product demo) → Pitfalls → Takeaway |
| **Product launch** | The old way → The new thing (transformation) → How it works → Proof (trend, quote) → Get it (close) |

---

## 4. Build plan

### Phase A: consulting conventions (HTML/CSS + lint, cheapest, most visible) ✅ done
1. `.source` footnote line, `.sticker` status tag, `.delta` (▲/▼ with colour) for stats.
2. **Tracker**: the runtime reads `layout-section` slides and shows the current act in the corner.
3. New layouts: `layout-summary` (exec summary), `layout-compare` (two columns, before/after,
   situation/complication), `layout-table` (with `.harvey` balls and ✓/✗ cells).
4. `qa.mjs`: print the ghost deck (all titles in order); lint label-style titles and data slides
   without `.source`.
5. Docs: `references/archetypes.md` (section 2) and `references/arcs.md` (section 3). SKILL.md Phase
   2 picks arc → archetype → component, in that order.

### Phase B: the chart kit (3D, the core upgrade) ✅ done (donut and funnel deferred)
One shared module that every chart uses, so they all look and behave alike:
- axes, gridlines, zero baseline, value and category labels (sprites with halo), number formatting
  (`unit`, `prefix`, `decimals`, `compact` → 12.4k)
- `highlight` on any point; everything else muted (the consulting "one highlight" rule)
- annotations: a callout arrow with text attached to a data point, and a delta bracket between two
  bars ("−25%")
- step reveal: series or points appear one press at a time
- a target / reference line
- an HTML `<table>` fallback written into the slide for screen readers and PDF export
- `data-source` renders the footnote

Then the charts, in order of value:
1. **`bars` v2**: horizontal, grouped, stacked, 100%, negative values, sorted, target line, delta bracket
2. **`line`**: multi-series ribbons that draw on; `forecast` from an index (dashed + confidence band)
3. **`waterfall`**: start, ups and downs that drop in one per step, end total
4. **`matrix`**: 2×2 with labelled items that fly to their quadrant; bubble size optional
5. **`scatter`**: points and an optional trend line
6. **`gantt`**: workstream rows with bars, a today line, milestones (shares the timeline's look)
7. `donut`, `funnel`, `tornado`

### Phase C: structure and product
1. **`flow`**: chevron process; each step lights the next stage
2. **`tree`**: issue tree / pyramid; branches grow per step, MECE children
3. **`screen`**: a screenshot on a tilted 3D plane, with hotspot callouts that light per step (for
   product demos, like Logistics Valeo's day view)
4. `graph`: labelled architecture nodes and edges

### Phase D: evals and examples
- One example deck per arc (`examples/case-study`, `examples/financial`, `examples/recommendation`),
  all using synthetic data labelled as such.
- Evals: briefs per arc; checks that the arc was picked, titles are action titles, data slides have
  sources and no invented numbers.

### Design rules for every new component
- Data only from the user; with no numbers, choose a non-data archetype.
- At most 7 categories per chart and 4 series; beyond that, split the slide or use a table.
- Bars start at zero. Lines may not, but say so on the axis.
- Motion explains the data: bars grow from zero, lines draw left to right, waterfall steps drop in
  sequence, matrix items fly to their quadrant. Nothing spins for its own sake.
- Readable in a static PDF: every chart is fully legible at `allSteps` with motion off.
