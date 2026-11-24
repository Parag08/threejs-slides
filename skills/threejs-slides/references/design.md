# Design guide

The 3D is there to make the argument land. A deck that looks like a screensaver with captions has failed.

## Story first

1. **Pick the arc, then write the spine.** Choose the deck's arc first (SKILL.md Phase 2a: for example problem → what I built → rollout and results) and name its 3–5 acts. Then write the 6–15 one-sentence messages in order, each under its act. Each slide states one of them. Scenes come last.
2. **Find the turns.** Mark the 2–4 moments where the argument changes direction (problem → insight → solution → proof → ask). Those slides get the strongest motion: a `morph` with steps, a `tunnel` act break, a camera journey with real distance.
3. **Quiet in between.** Slides that support a turn use calmer scenes (`network`, `terrain`, `none`) so the big moments stand out. Not every slide needs a hero object.
4. **End on an action.** The last slide says what to do next (install, decide, contact), not just "Thank you".

## Motion with meaning

| If the message is… | the motion should… | e.g. |
|---|---|---|
| change / transformation | morph between states on each step | `morph` sphere → helix |
| growth | rise and accumulate | `bars` growing, `count` up |
| connection | link and pulse | `network`, `globe` arcs |
| sequence | travel along a path | `timeline` steps, `line` journey |
| depth / going deeper | descend | `dive` journey, `tunnel` |
| focus | isolate one item | `orbit` step highlight |
| calm / trust | slow and minimal | `blob`, `still` journey, low bloom |

Avoid motion that contradicts the message, like a frantic tunnel under "stability and trust".

## Typography

- Display type does the talking: big, tight tracking, at most 9 words. The runtime's type scale is tuned for a projector at 1920×1080. Don't shrink it.
- Body text 32px or larger, small print 24px or larger. Nothing under 20px, ever.
- One headline per slide. No title-case shouting; use sentence case.
- Avoid the generic tells: one word in a different colour inside a headline, ALL-CAPS labels everywhere, eyebrow labels above every block. `.kicker` is fine once per slide.
- `data-anim="letters"` is a moment, not a default. Use it on 1–3 slides per deck (title, a key statement).

## Colour

- Each theme is a dominant background, one dominant accent (`--accent`), one highlight (`--accent-2`) and one support colour. In the 3D, the highlight colour should mark *the thing to look at* (the `highlight` bar, the lit milestone, the active orbit item).
- Pick the theme from the subject and the room: `paper` for daylight rooms and academic or editorial work, the dark themes for stages and screens.
- With a custom brand theme, keep `--bg` very dark or very light. Mid-tones make both the 3D and the text muddy.

## Layout & legibility

- Text sits where the 3D isn't. If a scene is busy behind the text, change to a split layout, push the object back (`data-offset="0,0,-3"`), shrink it (`data-scale="0.8"`), or add `scrim-left` / `scrim-right`.
- Leave the 120–140px margins alone. Nothing should touch the stage edge except full-bleed 3D.
- Fewer, larger elements. With 4 cards and a chart, make two slides.

## Pacing a talk

- About 1–2 minutes per slide for a live talk; the camera flight is 1–2s, so the deck never feels slow.
- Steps: at most 4 per slide. More than that is a list that wants to be two slides.
- Use `layout-section` + `tunnel` between acts in talks over 10 minutes.

## Accessibility

- Reduced-motion users get instant cuts and slowed scenes automatically. Don't fight that with JS animations of your own.
- Keep contrast high; the text shadow helps but doesn't fix a busy scene.
- Put the key point in the text. The 3D supports it and never carries information on its own (screen readers and PDF exports don't see the motion).

## Anti-patterns

- Text cut through by a line, a shape or other text: a target line through a value, a trend line through a point label, a bar over a category name. Text always sits on clear space.

- Picking scenes before the arc: slides in the order the scene library suggests rather than the order the story needs.
- Acts with no divider, or a "what I built" slide sitting inside the problem act.

- The same scene on consecutive slides (galaxy, galaxy, galaxy).
- Hero objects behind centred paragraphs.
- Invented numbers in any chart or `.stats` to make a slide look "data-driven".
- Rainbow charts. Highlight the one bar, point or row that proves the headline; the kit greys out the rest.
- A chart without `data-source`, or a line whose y axis doesn't start at zero without saying so.
- Bloom cranked up until colours clip to white. If it glows everywhere, nothing stands out.
- Ten slides of `layout-split` in a row. Alternate layouts every 2–3 slides.
