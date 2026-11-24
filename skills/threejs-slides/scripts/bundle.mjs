#!/usr/bin/env node
/**
 * Bundle a threejs-slides deck into ONE self-contained HTML file.
 *
 *   node bundle.mjs <deck-dir | deck/index.html> [--out deck.html]
 *
 * Inlines lib/threejs-slides.css, lib/threejs-slides.js + lib/scenes.js and every local
 * <img src>, <source src> and url(...) asset as data URIs. Three.js and fonts still load from
 * their CDNs, so the file opens by double-click (file://) but needs an internet connection.
 * No dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (!args[0]) { console.error('usage: node bundle.mjs <deck-dir | index.html> [--out file.html]'); process.exit(1); }
let input = path.resolve(args[0]);
if (fs.statSync(input).isDirectory()) input = path.join(input, 'index.html');
const dir = path.dirname(input);
const oi = args.indexOf('--out');
const out = path.resolve(oi > -1 ? args[oi + 1] : path.join(dir, 'deck.html'));

let html = fs.readFileSync(input, 'utf8');
const lib = (f) => fs.readFileSync(path.join(dir, 'lib', f), 'utf8');

// 1. CSS
html = html.replace(/<link[^>]+href=["']lib\/threejs-slides\.css["'][^>]*>/, () => `<style>\n${lib('threejs-slides.css')}\n</style>`);

// 2. Engine + scenes as one inline module exposing window.ThreeSlides
const scenesSrc = lib('scenes.js')
  .replace(/^import \* as THREE from ['"]three['"];?\s*$/m, '')
  .replace(/^export \{[^}]*\};?\s*$/m, '');
const engineSrc = lib('threejs-slides.js')
  .replace(/^import .*$/gm, '')
  .replace(/^export \{[^}]*\};?\s*$/m, '');
const engineModule = `<script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const { scenes: builtinScenes, helpers } = (() => {
${scenesSrc}
return { scenes, helpers };
})();
${engineSrc}
window.ThreeSlides = { createDeck, registerScene, THREE, helpers };
</script>`;

// 3. Rewrite the deck's import of the runtime into a read from window.ThreeSlides
let replaced = false;
html = html.replace(/<script type="module">([\s\S]*?)<\/script>/g, (m, body) => {
  if (!/from\s+['"]\.\/lib\/threejs-slides\.js['"]/.test(body)) return m;
  replaced = true;
  const rewritten = body.replace(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/lib\/threejs-slides\.js['"];?/, (_, names) =>
    `const {${names.replace(/\bas\b/g, ':')}} = window.ThreeSlides;`);
  return `${engineModule}\n<script type="module">${rewritten}</script>`;
});
if (!replaced) { console.error('Could not find `import … from "./lib/threejs-slides.js"` in a <script type="module">.'); process.exit(1); }

// 4. Inline local assets
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary' };
const inline = (ref) => {
  if (/^(data:|https?:|\/\/|#)/.test(ref)) return null;
  const f = path.join(dir, decodeURIComponent(ref.split(/[?#]/)[0]));
  const mime = MIME[path.extname(f).toLowerCase()];
  if (!mime || !fs.existsSync(f)) return null;
  return `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
};
let assets = 0;
html = html.replace(/(<(?:img|source|video)[^>]*\ssrc=["'])([^"']+)(["'])/g, (m, a, ref, b) => { const d = inline(ref); if (d) assets++; return d ? a + d + b : m; });
html = html.replace(/url\((['"]?)([^)'"]+)\1\)/g, (m, q, ref) => { const d = inline(ref); if (d) assets++; return d ? `url("${d}")` : m; });

fs.writeFileSync(out, html);
console.log(`Bundled → ${out}  (${(fs.statSync(out).size / 1024).toFixed(0)} KB, ${assets} assets inlined)`);
