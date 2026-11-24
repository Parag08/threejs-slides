# Arcs: the story structure of a deck

Pick the arc **first**, before any slide or scene. An arc is an ordered list of acts; each act opens
with a `layout-section` + `tunnel` divider and holds 1–4 slides. Each act's slides use the archetypes
listed (see [archetypes.md](archetypes.md)).

## How to choose

Ask what the audience must **do or believe** at the end:

| They should… | Arc |
|---|---|
| understand what you built and that it worked | Case study |
| approve a recommendation | Recommendation (SCR) |
| fund or approve a plan with numbers | Business case / financial projection |
| invest | Fundraising pitch |
| know how the period went and what's next | Business review |
| agree where to focus | Strategy / prioritisation |
| learn what went wrong and trust the fix | Post-mortem |
| accept findings | Research findings |
| learn a concept | Talk / teaching |
| want a product | Launch |

If two fit, pick the one that matches the **ask** on the last slide.

## Consulting rules that apply to every arc

- **Answer first.** Business arcs (recommendation, business case, review, strategy) put an
  executive summary (`layout-summary`) straight after the title. Each summary line is the takeaway of
  one act, in the same order.
- **Action titles.** Every content slide's headline is its takeaway as a sentence. Reading only the
  titles (the ghost deck that `qa.mjs` prints) must tell the story.
- **SCR inside acts.** Inside a long act, order slides situation → complication → resolution.
- **MECE acts.** Acts don't overlap, and together they answer the deck's question. If a slide fits two
  acts, split its message.
- **Close on the ask.** The last slide says what you want decided or done, by whom and by when.
- **Backup goes in the appendix:** a `layout-section` with `data-appendix` after the close.

## The arcs

Acts are in order. Under each act: the archetypes it usually holds.

### Case study / build story
For a portfolio, an internal show-and-tell, or an interview presentation.
1. **The problem**: problem statement, KPI baseline (stats), customer voice
2. **What I built**: system (orbit), product walkthrough (split), process (timeline), transformation (morph)
3. **Rollout and results**: milestones (timeline), adoption story (split), result bars with a delta, what drove it (waterfall), KPI headline
4. **What I learned** *(optional)*: judgement calls (cards), what I'd do next
- Close: what to look at or try next

### Recommendation (SCR)
For a decision request: strategy, a vendor, a reorganisation.
- Executive summary
1. **Situation**: landscape, KPI baseline
2. **Complication**: trend that turned, what it costs (bars, stats)
3. **Options**: options (cards), evaluation (table with Harvey balls), prioritisation (matrix)
4. **Recommendation**: the choice + 3 reasons (split), before → after (compare)
5. **Plan**: roadmap (gantt), next steps (table: action, owner, date)
- Close: the decision you need

### Business case / financial projection
For budgets, investments and plans whose argument is the numbers.
- Executive summary
1. **Assumptions and drivers**: driver table (table), key inputs (stats)
2. **Revenue**: revenue by year (line or bars), mix (stacked bars)
3. **Costs**: cost bridge (waterfall), one-off vs running (compare)
4. **Projections**: revenue vs cost with forecast band (line), P&L summary (table with `.num` columns)
5. **Scenarios and risks**: base / upside / downside (line, three series), sensitivity (horizontal bars), risks (matrix or table)
6. **Returns**: payback, ROI, NPV (stats)
- Close: the amount, the approval, the date
- Mark projections with `data-sticker="Projection"` and every number slide with `data-source`.

### Fundraising pitch
1. **Problem**: problem statement, customer voice
2. **Solution**: transformation (morph), product walkthrough
3. **Market**: market size (stats or bars), reach (globe)
4. **Traction**: growth (bars), KPI headline
5. **Business model**: unit economics (table or stats)
6. **Competition**: comparison (table with marks) or positioning (matrix)
7. **Team**: team (cards or orbit)
8. **Financials**: projection (line with forecast + sticker)
- Close: the raise, the use of funds, the milestone it buys

### Business review (QBR / monthly)
- Executive summary
1. **Results vs plan**: KPI headline with deltas, plan vs actual (grouped bars or a target line)
2. **What drove it**: bridge from last period (waterfall)
3. **Wins and misses**: compare (planned vs actual)
4. **Next period**: priorities (summary or cards), milestones, next steps (table)
- Close: decisions needed

### Strategy / prioritisation
- Executive summary
1. **Where we are**: KPI baseline, landscape
2. **Where to play**: segments (matrix: attractiveness × ability to win)
3. **How to win**: pillars (orbit)
4. **Initiatives**: evaluation (table with Harvey balls)
5. **Roadmap**: workstreams (gantt)
- Close: what to commit to

### Post-mortem / incident review
1. **What happened**: timeline of events
2. **Impact**: KPI headline, affected users (stats)
3. **Root cause**: before → after (compare), contributing factors (cards)
4. **Fixes**: process (timeline), owners (table)
- Close: follow-ups with dates

### Research findings
1. **The question**: statement
2. **Method**: process (timeline)
3. **Findings**: one finding per slide, each with its evidence (bars, stats, quote)
4. **Implications**: so-what (cards)
- Close: next research or decision

### Talk / teaching
1. **Hook**: a statement or surprising number
2. **Why it matters**: problem, stakes
3. **How it works**: system (orbit), process (timeline), transformation (morph), code (split + pre.code)
4. **In practice**: example, pitfalls (cards)
- Close: one takeaway and where to learn more

### Product launch
1. **The old way**: problem, compare
2. **The new thing**: transformation (morph), hero (knot)
3. **How it works**: process, system
4. **Proof**: results (bars, stats), customer voice
- Close: how to get it
