#!/usr/bin/env node
/**
 * threejs-slides QA: screenshot every slide, flag layout problems, optionally export a PDF.
 *
 *   node qa.mjs <deck-dir | deck/index.html> [--out <dir>] [--pdf <file.pdf>] [--wait <ms>] [--steps first|all]
 *
 * - Serves the deck folder over a local HTTP server (ES modules need http://, not file://).
 * - Opens it in headless Chromium at 1920×1080 with ?static (instant transitions).
 * - For each slide: jumps to it, waits, saves <out>/slide-NN.png and checks:
 *     · text or elements that spill outside the 1920×1080 stage
 *     · elements whose content overflows their box (scrollHeight/scrollWidth)
 *     · text smaller than 20px at stage scale (too small to read when projected)
 * - Asks chart scenes which of their 3D labels are crossed by a line or overlap other labels
 *   (deck.textCollisions()); text must never be cut through.
 * - Reports console errors, page errors and failed requests.
 * - Story checks (advice, never fail the run): prints the ghost deck (every title in order, grouped
 *   by act) and flags label-style titles on content slides, data slides without a source, and long
 *   decks with no acts. Saved to <out>/ghost-deck.md.
 * - --pdf: one page per slide from the screenshots.
 *
 * Needs Playwright:  cd <skill>/scripts && npm install   (installs playwright + chromium)
 * Exit code 1 when errors are found, so it can gate a build.
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
if (!args[0] || args[0] === '-h' || args[0] === '--help') {
  console.log('usage: node qa.mjs <deck-dir | index.html> [--out dir] [--pdf file.pdf] [--wait ms] [--steps first|all]');
  process.exit(args[0] ? 0 : 1);
}
const opt = (name, fb) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : fb; };
let target = path.resolve(args[0]);
let deckDir = target, entry = 'index.html';
if (fss.existsSync(target) && fss.statSync(target).isFile()) { deckDir = path.dirname(target); entry = path.basename(target); }
if (!fss.existsSync(path.join(deckDir, entry))) { console.error(`No ${entry} in ${deckDir}`); process.exit(1); }
const outDir = path.resolve(opt('--out', path.join(deckDir, 'qa')));
const pdfPath = opt('--pdf', null);
const waitMs = Number(opt('--wait', 1400));
const steps = opt('--steps', 'all');

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  console.error('Playwright is not installed. Run once:\n  cd ' + path.dirname(new URL(import.meta.url).pathname) + ' && npm install && npx playwright install chromium');
  process.exit(2);
}

/* --- tiny static server --- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.mp4': 'video/mp4' };
const server = http.createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(deckDir, rel);
    if (!file.startsWith(deckDir)) { res.writeHead(403).end(); return; }
    if (fss.existsSync(file) && fss.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/${entry}`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const consoleErrors = [], failed = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().split('\n')[0]); if (m.type() === 'warning' && m.text().includes('threejs-slides')) consoleErrors.push('warn: ' + m.text()); });
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => failed.push(`${r.url()} (${r.failure()?.errorText})`));

await page.goto(`${base}?static&nochrome`, { waitUntil: 'load' });
await page.waitForFunction(() => window.deck && window.deck.ready, null, { timeout: 30000 });
await page.evaluate(() => window.deck.ready);
const count = await page.evaluate(() => window.deck.count);
await fs.mkdir(outDir, { recursive: true });

const report = [];
for (let i = 0; i < count; i++) {
  await page.evaluate(([i, all]) => window.deck.go(i, { instant: true, allSteps: all }), [i, steps === 'all']);
  await page.waitForTimeout(waitMs);
  const file = path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
  await page.screenshot({ path: file });
  const issues = await page.evaluate((i) => {
    const out = [];
    const stage = document.querySelector('.ts-stage').getBoundingClientRect();
    const k = stage.width / 1920;
    const slide = window.deck.slides[i];
    const label = (el) => (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' "' + (el.textContent || '').trim().slice(0, 40) + '"');
    slide.querySelectorAll('*').forEach((el) => {
      if (el.closest('aside.notes, .notes, .ts-sr-only')) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const pad = 4;
      if (r.left < stage.left - pad || r.top < stage.top - pad || r.right > stage.right + pad || r.bottom > stage.bottom + pad)
        out.push(`outside stage: ${label(el)}`);
      if ((el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) && cs.overflow !== 'visible' && !['inline'].includes(cs.display))
        out.push(`content overflows box: ${label(el)}`);
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (hasText && parseFloat(cs.fontSize) < 20 && !el.closest('.ts-chrome')) out.push(`text below 20px (${cs.fontSize}): ${label(el)}`);
    });
    // text elements that visually collide with each other (siblings only, cheap check)
    const blocks = [...slide.querySelectorAll('h1,h2,h3,p,li,blockquote,pre,.card,.stat,.col,table,.tracker,.source,.sticker')].filter((b) => !b.closest('.ts-sr-only'));
    for (let a = 0; a < blocks.length; a++) for (let b = a + 1; b < blocks.length; b++) {
      if (blocks[a].contains(blocks[b]) || blocks[b].contains(blocks[a])) continue;
      const A = blocks[a].getBoundingClientRect(), B = blocks[b].getBoundingClientRect();
      const ix = Math.min(A.right, B.right) - Math.max(A.left, B.left), iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
      if (ix > 6 * k && iy > 6 * k) out.push(`overlap: ${label(blocks[a])} × ${label(blocks[b])}`);
    }
    return [...new Set(out)].slice(0, 12);
  }, i);
  const crossed = await page.evaluate(() => window.deck.textCollisions?.() ?? []);
  crossed.forEach((c) => issues.push(`3D text cut: ${c}`));
  report.push({ slide: i + 1, file: path.relative(process.cwd(), file), issues });
}

/* --- story checks: ghost deck + consulting lints (advice only) --- */
const story = await page.evaluate(() => {
  const CONTENT = ['layout-split', 'layout-split-reverse', 'layout-bottom', 'layout-top', 'layout-stats', 'layout-cards', 'layout-compare', 'layout-table']; // not summary: "Executive summary" is the convention there
  const DATA_SCENES = ['bars', 'line', 'waterfall', 'scatter', 'matrix', 'gantt', 'donut', 'funnel', 'tornado'];
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const slides = [...window.deck.slides];
  const rows = [], advice = [];
  let acts = 0;
  slides.forEach((el, i) => {
    const c = el.classList;
    const head = el.querySelector('h1, h2, blockquote');
    const title = clean(head?.getAttribute('aria-label') || head?.textContent || el.dataset.title);
    const isSection = c.contains('layout-section');
    if (isSection && !el.hasAttribute('data-appendix')) acts++;
    rows.push({ slide: i + 1, section: isSection, appendix: el.hasAttribute('data-appendix'), num: clean(el.querySelector('.num')?.textContent), title });
    const isContent = CONTENT.some((k) => c.contains(k));
    const words = title.split(' ').filter(Boolean).length;
    if (isContent && words && words <= 3)
      advice.push(`slide ${i + 1}: title "${title}" reads like a label. Write the takeaway as a sentence (e.g. "Km per order fell 25% after launch").`);
    const isData = DATA_SCENES.includes(el.dataset.scene) || c.contains('layout-stats') || el.querySelector('[data-count], table.data .num, table.data .harvey');
    if (isData && !el.querySelector('.source') && !el.dataset.source && !el.hasAttribute('data-no-source'))
      advice.push(`slide ${i + 1}: data slide without a source. Add data-source="…" (or data-no-source if the numbers are self-evident).`);
  });
  if (slides.length >= 8 && acts === 0) advice.push(`no acts: ${slides.length} slides and no layout-section dividers. Group the slides into 3–5 acts (SKILL.md, Phase 2).`);
  return { rows, advice };
});
const ghostLines = story.rows.map((r) => r.section ? { act: r.appendix ? 'Appendix' : `${r.num} ${r.title}`.trim() } : { line: `${String(r.slide).padStart(2, ' ')}. ${r.title || '(no title)'}` });
const ghost = ghostLines.map((g) => (g.act ? `\n## ${g.act}` : g.line)).join('\n');
await fs.writeFile(path.join(outDir, 'ghost-deck.md'), `# Ghost deck\n\nRead only these titles, in order. They should tell the whole story.\n${ghost}\n`);

if (pdfPath) {
  const imgs = report.map((r) => `<img src="${pathToFileURL(path.resolve(r.file)).href}">`).join('');
  const html = `<!doctype html><style>@page{size:1920px 1080px;margin:0}html,body{margin:0}img{display:block;width:1920px;height:1080px;page-break-after:always}</style>${imgs}`;
  const tmp = path.join(outDir, '_pdf.html');
  await fs.writeFile(tmp, html);
  const pdfPage = await browser.newPage();
  await pdfPage.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await pdfPage.pdf({ path: path.resolve(pdfPath), width: '1920px', height: '1080px', printBackground: true });
  await fs.unlink(tmp);
}

await browser.close();
server.close();

/* --- summary --- */
let problems = 0;
console.log(`\nthreejs-slides QA — ${count} slides → ${path.relative(process.cwd(), outDir) || '.'}`);
for (const r of report) {
  if (r.issues.length) { problems += r.issues.length; console.log(`  ✗ slide ${r.slide}  ${r.file}`); r.issues.forEach((x) => console.log(`      - ${x}`)); }
  else console.log(`  ✓ slide ${r.slide}  ${r.file}`);
}
if (consoleErrors.length) { console.log('\nConsole errors:'); [...new Set(consoleErrors)].forEach((e) => console.log('  - ' + e)); }
if (failed.length) { console.log('\nFailed requests:'); [...new Set(failed)].forEach((e) => console.log('  - ' + e)); }
console.log('\nGhost deck (titles only, they should tell the story):');
ghostLines.forEach((g) => console.log(g.act ? `  ${g.act}` : `    ${g.line}`));
if (story.advice.length) { console.log('\nStory checks (advice):'); story.advice.forEach((a) => console.log('  · ' + a)); }
if (pdfPath) console.log(`\nPDF: ${pdfPath}`);
console.log(problems || consoleErrors.length || failed.length ? '\nIssues found — look at the screenshots and fix them.' : '\nNo issues found. Still look at every screenshot.');
await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify({ slides: report, consoleErrors, failed, story }, null, 2));
process.exit(problems || consoleErrors.some((e) => !e.startsWith('warn')) || failed.length ? 1 : 0);
