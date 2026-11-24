# Evals

Tests for the skill itself, run with Claude Code's built-in [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). Run them before you change `SKILL.md`, the references or the runtime, and again after, so that you can see whether the change helped or broke something.

| Suite | Cases | What it checks | Cost |
|---|---|---|---|
| `activation/` | 13 | Does the skill activate when it should (6 requests for animated, 3D or browser decks) and stay out when it shouldn't (7: `.pptx`, Google Slides, a Three.js game, a 3D landing page, a Word doc, plain questions)? | cheap: a few turns each |
| `quality/` | 8 | Given a realistic brief, does it build a complete deck that follows the brief and the skill's rules? | expensive: each case builds a full deck (up to 80 turns) |

The quality briefs cover an investor pitch with real figures, an MBA turnaround case with **no** numbers, a talk from notes with speaker notes, a light-theme research talk, a roadmap timeline, a globe markets deck, an exact 3-slide deck, and a deck converted from markdown.

## Graders

Each quality case scores the deck it produced:

| Grader | Type | Passes when |
|---|---|---|
| `skill-fired` | tool call | the skill was used |
| `deck-written` / `runtime-scaffolded` | file exists | `deck/index.html` and `deck/lib/` exist (so `new-deck.sh` was used) |
| `ran-visual-qa` | tool call | it ran `qa.mjs` or stepped through slides in a browser (Phase 5) |
| `no-placeholders` | regex | no lorem ipsum, `{{TITLE}}` or "Slide 3" left in |
| `theme-*`, `uses-globe`, `uses-timeline`, `speaker-notes` | regex | the brief's specific asks were met |
| `no-invented-numbers` | regex | for briefs without data: no counters, stats layout or bar chart |
| `deck-quality` (weight 3) | AI judge on `index.html` | slide count, no repeated scene on consecutive slides, one idea per slide, scenes that fit the message, real content, only the figures the brief gave |
| `handover` | AI judge on the final message | it says where the deck is, how to serve it and the basic controls |

Activation cases check only whether the skill was called.

## Run

You need Claude Code 2.1.269 or later, logged in from the terminal (`claude auth status`).

```bash
# activation: quick, about 13 short runs
claude plugin eval . --tag activation --ablation none -j 4
```

```bash
# quality: each case builds a whole deck; give it Bash/Write/Edit
claude plugin eval . --tag quality --allow-tools Bash Write Edit -j 4 --keep-temp
```

```bash
# one case
claude plugin eval . --case mba-turnaround --allow-tools Bash Write Edit --ablation none
```

- By default the quality suite also runs every brief **without** the plugin and reports the difference (Δ), which shows what the skill adds. Pass `--ablation none` to skip that and halve the cost.
- Each case runs once (`runs: 1`). Use `--runs 3` for a steadier score.
- `--max-cost-usd 20` caps the spend.

## Full structural check and screenshot QA on kept decks

The eval runner has no script graders, so `check-deck.mjs` covers what regex can't: every scene name is valid, no scene repeats on consecutive slides, `data-params` is valid JSON, the runtime is unmodified, the theme and its fonts match, and headlines are short. With `--qa` it also runs the headless screenshot QA. Each eval run's sandbox starts with an empty home folder, so the agent may not find Playwright's Chromium there. This step reruns the QA outside the sandbox.

After a run with `--keep-temp`, point it at each kept sandbox path the runner printed:

```bash
node evals/check-deck.mjs /private/tmp/e-XXXXXX --qa --min 7 --max 11 --theme ember --no-numbers
```

It also works on any deck folder, for example `node evals/check-deck.mjs examples/demo --qa`. Options: `--min/--max` slide count, `--theme`, `--journey`, `--no-numbers`, `--notes`, `--require-scene <name>`, `--qa`. It exits 1 if any check fails.

## Adding a case

Copy a folder under `activation/` or `quality/`, and edit `case.yaml`: the prompt plus its graders. Quality prompts must ask for the deck in `./deck` and tell Claude to go ahead without questions, because eval runs are non-interactive. Results go to `evals/results/`, which git ignores.
