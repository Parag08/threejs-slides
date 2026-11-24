#!/usr/bin/env node
/**
 * Deterministic grader for threejs-slides eval cases.
 *
 *   node evals/check-deck.mjs [search-dir] [--min N] [--max N] [--theme name]
 *        [--journey name] [--no-numbers] [--require-scene name ...] [--qa]
 *
 * Finds the deck the agent made (the newest index.html under search-dir that
 * has a <main class="deck">), then checks it against the skill's own rules:
 *   - the runtime was copied into lib/ (new-deck.sh was used, nothing hand-rolled)
 *   - slide count is within --min/--max
 *   - every data-scene is a built-in scene or one the deck registers itself
 *   - no scene is used on two consecutive slides (title/closing bookend is fine)
 *   - every data-params attribute is valid JSON
 *   - theme, journey and fonts are set and consistent
 *   - no placeholder text (lorem ipsum, "Slide 3", TODO, {{…}})
 *   - headlines stay short (≤ 12 words: the skill aims for 9)
 *   - --no-numbers: the brief gave no data, so no counters, stats or bar charts
 *   - --qa: runs scripts/qa.mjs (headless screenshots + layout checks); must pass
 *
 * Prints one line per check and a final JSON summary. Exit 0 = all passed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '../skills/threejs-slides');
const SCENES = ['galaxy', 'morph', 'globe', 'terrain', 'orbit', 'bars', 'network', 'knot', 'blob', 'tunnel', 'cubes', 'timeline', 'none'];
const THEMES = ['nebula', 'ember', 'aurora', 'paper', 'mono'];
const JOURNEYS = ['drift', 'line', 'dive', 'spiral', 'still'];
const THEME_FONT = { nebula: 'Bricolage', ember: 'Fraunces', aurora: 'Familjen', paper: 'Newsreader', mono: 'Archivo' };

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, fb) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : fb; };
const many = (n) => argv.flatMap((a, i) => (a === n ? [argv[i + 1]] : []));
const searchDir = path.resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : '.');

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };

/* ---- find the deck ---- */
function findDecks(dir, depth = 0, out = []) {
  if (depth > 5) return out;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'qa') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findDecks(p, depth + 1, out);
    else if (e.name === 'index.html') {
      const html = fs.readFileSync(p, 'utf8');
      if (/<main[^>]*class="[^"]*\bdeck\b/.test(html)) out.push({ file: p, mtime: fs.statSync(p).mtimeMs, html });
    }
  }
  return out;
}
const decks = findDecks(searchDir).sort((a, b) => b.mtime - a.mtime);
check('deck exists', decks.length, decks.length ? path.relative(searchDir, decks[0].file) : `no index.html with <main class="deck"> under ${searchDir}`);
if (!decks.length) finish();
const { file, html } = decks[0];
const deckDir = path.dirname(file);

/* ---- runtime ---- */
const libFiles = ['threejs-slides.js', 'scenes.js', 'threejs-slides.css'];
const missing = libFiles.filter((f) => !fs.existsSync(path.join(deckDir, 'lib', f)));
check('runtime copied into lib/', !missing.length, missing.length ? `missing ${missing.join(', ')}` : '');
if (!missing.length) {
  const same = libFiles.every((f) => fs.readFileSync(path.join(deckDir, 'lib', f), 'utf8') === fs.readFileSync(path.join(SKILL, 'assets/runtime', f), 'utf8'));
  check('runtime unmodified', same, same ? '' : 'lib/ differs from the skill runtime (decks should not edit it)');
}
check('createDeck() is called', /createDeck\s*\(/.test(html));

/* ---- slides ---- */
const deckOpen = html.match(/<main[^>]*class="[^"]*\bdeck\b[^"]*"[^>]*>/)[0];
const body = html.slice(html.indexOf(deckOpen));
const sections = [...body.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)].map((m) => ({ attrs: m[1], inner: m[2] }));
const attr = (s, n) => { const m = s.attrs.match(new RegExp(`\\b${n}\\s*=\\s*(?:'([^']*)'|"([^"]*)")`)); return m ? (m[1] ?? m[2]) : null; };
const min = Number(opt('--min', 1)), max = Number(opt('--max', 999));
check('slide count in range', sections.length >= min && sections.length <= max, `${sections.length} slides (want ${min}–${max === 999 ? '∞' : max})`);

const registered = [...html.matchAll(/registerScene\(\s*['"]([\w-]+)['"]/g)].map((m) => m[1]);
const scenes = sections.map((s) => attr(s, 'data-scene'));
const unknown = scenes.filter((s) => s && !SCENES.includes(s) && !registered.includes(s));
check('scenes are known', !unknown.length, unknown.length ? `unknown: ${[...new Set(unknown)].join(', ')}` : `${new Set(scenes.filter(Boolean)).size} distinct scenes`);

const repeats = [];
scenes.forEach((s, i) => { if (i && s && s !== 'none' && s === scenes[i - 1]) repeats.push(`${i}→${i + 1} (${s})`); });
check('no scene on two consecutive slides', !repeats.length, repeats.join(', '));

const badJson = [];
sections.forEach((s, i) => { const p = attr(s, 'data-params'); if (p != null) { try { JSON.parse(p.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')); } catch { badJson.push(i + 1); } } });
check('data-params is valid JSON', !badJson.length, badJson.length ? `slides ${badJson.join(', ')}` : '');

/* ---- theme / journey ---- */
const theme = (html.match(/<html[^>]*data-theme="([^"]+)"/) || [])[1];
const custom = theme && new RegExp(`\\[data-theme=["']${theme}["']\\]`).test(html);
check('theme is valid', theme && (THEMES.includes(theme) || custom), theme || 'no data-theme on <html>');
if (opt('--theme')) check('theme matches brief', theme === opt('--theme'), `${theme} (want ${opt('--theme')})`);
if (THEMES.includes(theme)) check('theme fonts loaded', html.includes(THEME_FONT[theme]), `expects ${THEME_FONT[theme]}`);
const journey = (deckOpen.match(/data-journey="([^"]+)"/) || [])[1] || 'drift';
check('journey is valid', JOURNEYS.includes(journey), journey);
if (opt('--journey')) check('journey matches brief', journey === opt('--journey'), `${journey} (want ${opt('--journey')})`);

/* ---- content ---- */
const text = (s) => s.replace(/<aside class="notes">[\s\S]*?<\/aside>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
const visible = sections.map((s) => text(s.inner)).join(' \n ');
const placeholder = visible.match(/lorem ipsum|\bslide \d+\b|\bTODO\b|\{\{[^}]*\}\}|\bplaceholder\b|\bheadline here\b/i);
check('no placeholder text', !placeholder, placeholder ? `"${placeholder[0]}"` : '');
const longHeads = [];
sections.forEach((s, i) => { const h = s.inner.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/); if (h) { const w = text(h[1]).split(' ').filter(Boolean).length; if (w > 12) longHeads.push(`${i + 1} (${w} words)`); } });
check('headlines are short', !longHeads.length, longHeads.join(', '));
const empty = sections.map((s, i) => (text(s.inner).length < 3 ? i + 1 : 0)).filter(Boolean);
check('every slide has text', !empty.length, empty.length ? `slides ${empty.join(', ')}` : '');
const notes = sections.filter((s) => /<aside class="notes">/.test(s.inner)).length;
if (flag('--notes')) check('speaker notes on most slides', notes >= Math.ceil(sections.length * 0.6), `${notes}/${sections.length}`);

if (flag('--no-numbers')) {
  const hits = [];
  if (/data-count=/.test(body)) hits.push('data-count counters');
  if (/layout-stats/.test(body)) hits.push('stats layout');
  if (scenes.includes('bars')) hits.push('bars chart');
  const pct = visible.match(/\b\d[\d.,]*\s?(%|x\b|×|k\b|m\b|bn\b|million|billion)|[$€£₹]\s?\d/i);
  if (pct) hits.push(`"${pct[0]}" in slide text`);
  check('no invented numbers', !hits.length, hits.join(', '));
}
for (const want of many('--require-scene')) check(`uses ${want}`, scenes.includes(want), scenes.join(' '));

/* ---- headless QA ---- */
if (flag('--qa')) {
  const qaOut = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-qa-'));
  try {
    execFileSync('node', [path.join(SKILL, 'scripts/qa.mjs'), deckDir, '--out', qaOut], { stdio: 'pipe', timeout: 240000 });
    check('qa.mjs passes', true);
  } catch (e) {
    const out = `${e.stdout || ''}${e.stderr || ''}`.split('\n').filter((l) => /✗|- |error|Error/.test(l)).slice(0, 8).join(' | ');
    check('qa.mjs passes', false, out || e.message);
  }
  fs.rmSync(qaOut, { recursive: true, force: true });
}

finish();
function finish() {
  const passed = results.filter((r) => r.ok).length;
  console.log(JSON.stringify({ passed, total: results.length, failed: results.filter((r) => !r.ok).map((r) => r.name) }));
  process.exit(passed === results.length ? 0 : 1);
}
