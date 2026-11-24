# Slide archetypes: what each slide is for

Every slide does **one job**. Pick the archetype from the job, and the layout and scene follow from
it. This is the layer between the arc ([arcs.md](arcs.md)) and the scenes ([scenes.md](scenes.md)).

The six jobs are MECE: a slide that does two jobs is two slides.

## A. Frame: orient the audience

| Archetype | When | Build it with |
|---|---|---|
| **Title** | Opening | `layout-title` + `galaxy` / `knot` |
| **Executive summary** | Right after the title in any business deck: the answer first | `layout-summary`: 3–5 `li`, each one act's takeaway as `<b>` + support as `<span>` |
| **Section divider** | Start of every act | `layout-section` + `tunnel`; `.num` + act name |
| **Close / ask** | Last slide | `layout-title` or `layout-center`: the decision, owner and date. Never just "Thank you" |
| **Appendix** | Backup after the close | `layout-section` with `data-appendix` |

## B. Situate: why this matters

| Archetype | When | Build it with |
|---|---|---|
| **Problem statement** | The pain, who has it, the cost of doing nothing | `layout-split` + `network` / `morph`, 3 build-step points |
| **Situation → complication** | What was true, then what changed | `layout-compare`, the complication column `.is-key` |
| **Landscape / market** | Size, segments, players | `layout-stats` (sizes), `bars` (segments), `globe` (reach) |
| **Customer voice** | A real quote | `layout-statement` + `cite` |

## C. Quantify: prove it with numbers

Use only numbers the user gave you. Every slide here gets `data-source`.

| Archetype | The message sounds like | Build it with |
|---|---|---|
| **KPI headline** | "Three numbers say it worked" | `layout-stats layout-top` + `terrain`; `.delta` for change vs baseline |
| **Trend** | "X fell every month" | `line` (many points, forecasts) or `bars` (few points); highlight the latest |
| **Ranking** | "A is biggest" | `bars` with `"orientation":"h","sort":"desc"`, highlight the one that matters |
| **Before / after** | "Same metric, two states" | `bars` with a `delta` bracket, or `layout-compare` |
| **Plan vs actual** | "Actuals passed plan" | `bars` grouped (two series), or `bars` with a `target` line |
| **Bridge** | "How 60 became 45" | `waterfall` (`"good":"down"` for costs) |
| **Correlation** | "Denser days cost less" | `scatter` with `trend` |
| **Composition** | "X is 40% of the total" | `bars` stacked or `percent` |
| **Number table** | P&L, budget, unit economics | `layout-table`, `td.num` columns, `tr.is-key` on the total |

## D. Explain: how it works

| Archetype | When | Build it with |
|---|---|---|
| **System / architecture** | Parts and how they relate | `layout-split-reverse` + `orbit` (items light up per step) |
| **Process** | Steps in order | `layout-top` + `timeline` (labels = steps) |
| **Transformation** | From X to Y | `layout-split` + `morph` with steps |
| **Product walkthrough** | What the user sees | `layout-split` with an `<img>` screenshot, or a custom scene |
| **Framework** | Pillars, or a 2×2 | `layout-cards` (2–4), or `matrix` |
| **Code** | How to use it | `layout-split` + `pre.code` (8 lines or fewer) |

## E. Decide: choose between options

| Archetype | When | Build it with |
|---|---|---|
| **Options** | 2–4 alternatives | `layout-cards` |
| **Evaluation** | Options × criteria | `layout-table` with `.harvey` (0–4) or `.mark.yes/.no/.part`; the recommended row `tr.is-key` |
| **Recommendation** | The choice and why | `layout-split` + 3 reasons; or `layout-compare` (today → recommended) |
| **Scenarios** | Base / upside / downside | `line` with three series, or `layout-table` |
| **Sensitivity** | Which assumptions move the answer | `bars` horizontal with negatives (tornado), sorted |
| **Prioritisation** | Where to focus | `matrix` with quadrants and a `focus` quadrant |
| **Risks** | What could go wrong and the mitigation | `matrix` (likelihood × impact) or `layout-table`: risk · likelihood · impact · mitigation |

## F. Plan: what happens next

| Archetype | When | Build it with |
|---|---|---|
| **Milestones** | Dated steps | `layout-top` + `timeline` (7 or fewer items) |
| **Roadmap** | Parallel workstreams | `layout-top` + `gantt` |
| **Financial projection** | Numbers by year | `line` with `forecast` + `low`/`high` band, `data-sticker="Projection"`; then `layout-table` for the P&L |
| **Next steps** | Action, owner, date | `layout-table` with three columns |
| **Team** | Who does what | `layout-cards` or `orbit` |

Text-heavy formats (`layout-summary`, `layout-compare`, `layout-table`) sit on top of the 3D: pair them with a calm scene (`network` with `data-offset="0,0,-4"`, `none`). Busy scenes like `cubes` or `morph` show through the panels.

Not yet available: donut and funnel charts. Use stacked `bars` (`percent`) for shares, and horizontal `bars` for funnels.

## Slide furniture (consulting conventions)

| Element | Use | How |
|---|---|---|
| **Action title** | Every content slide | The `h2` is the takeaway as a sentence, 9 words or fewer |
| **Tracker** | Shows the current act | Automatic when the deck has 2+ acts (`data-tracker` on `.deck`: `auto` · `always` · `none`) |
| **Source** | Every number slide | `data-source="Ops data, 16 Aug–16 Sep 2026"` on the section |
| **Sticker** | Status of the numbers | `data-sticker="Illustrative"` · `Preliminary` · `Projection` · `Synthetic` |
| **Delta** | Change vs baseline | `<span class="delta down good">25%</span>` (`up`/`down` sets the arrow, `good`/`bad` the colour) |
| **One highlight** | The number that proves the title | `highlight` on that bar, `tr.is-key` on that row, `.is-key` on that column |
