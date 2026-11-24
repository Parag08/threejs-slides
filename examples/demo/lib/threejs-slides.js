/* ==========================================================================
   threejs-slides — engine
   --------------------------------------------------------------------------
   One persistent WebGL scene sits behind a fixed 1920×1080 HTML stage.
   Every <section class="slide"> owns a 3D "scene" placed at its own anchor
   along a camera journey. Changing slides flies the camera between anchors,
   cross-fades the 3D objects and plays staggered HTML entrance animations.

   Usage:
     import { createDeck } from './lib/threejs-slides.js';
     const deck = await createDeck({ journey: 'drift' });

   Docs: references/engine-api.md in the threejs-slides skill.
   ========================================================================== */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { scenes as builtinScenes, helpers } from './scenes.js';

const STAGE_W = 1920;
const STAGE_H = 1080;
const registry = new Map(Object.entries(builtinScenes));

/** Register a custom scene factory: registerScene('my-scene', (ctx) => ({ object, update })) */
function registerScene(name, factory) { registry.set(name, factory); }

/* === UTILITIES ========================================================== */

const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoothstep01 = (x) => { const t = clampN(x, 0, 1); return t * t * (3 - 2 * t); };

function parseVec(str) {
  if (!str) return null;
  const a = String(str).split(/[\s,]+/).filter(Boolean).map(Number);
  return a.length === 3 && a.every(Number.isFinite) ? a : null;
}

function parseParams(el, index) {
  const raw = el.dataset.params;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) {
    console.warn(`[threejs-slides] slide ${index + 1}: data-params is not valid JSON`, e);
    return {};
  }
}

/** Camera journeys: where each slide's 3D anchor lives in world space. */
const JOURNEYS = {
  drift: (i) => new THREE.Vector3(Math.sin(i * 0.85) * 22, Math.cos(i * 0.6) * 7, -i * 70),
  line: (i) => new THREE.Vector3(i * 60, 0, 0),
  dive: (i) => new THREE.Vector3(Math.sin(i * 1.3) * 10, -i * 55, -i * 12),
  spiral: (i) => { const a = i * 0.75; return new THREE.Vector3(Math.cos(a) * 55, i * 9, Math.sin(a) * 55); },
  still: () => new THREE.Vector3(0, 0, 0),
};

/** Default object offset by layout so the 3D object doesn't sit under text. */
function layoutOffset(el) {
  const c = el.classList;
  if (c.contains('layout-split')) return [3.3, 0, 0];
  if (c.contains('layout-split-reverse')) return [-3.3, 0, 0];
  if (c.contains('layout-bottom')) return [0, 0.5, 0];
  if (c.contains('layout-top')) return [0, -1.1, 0];
  return [0, 0, 0];
}

/** How bright the 3D is on each layout: full when it sits beside the text, dimmed when it sits behind it. */
function layoutDim(el) {
  const c = el.classList;
  if (c.contains('layout-split') || c.contains('layout-split-reverse')) return 1;
  if (c.contains('layout-bottom') || c.contains('layout-top') || c.contains('layout-stats')) return 0.7;
  if (['layout-title', 'layout-center', 'layout-statement', 'layout-section', 'layout-cards'].some((k) => c.contains(k))) return 0.42;
  return 1;
}

function readPalette(root) {
  const cs = getComputedStyle(root);
  const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
  const col = (name, fb) => { try { return new THREE.Color(v(name, fb)); } catch { return new THREE.Color(fb); } };
  const bg = col('--bg', '#05070d');
  const hsl = {}; bg.getHSL(hsl, THREE.SRGBColorSpace);
  return {
    bg, fg: col('--fg', '#eef1f6'), muted: col('--muted', '#8a93a6'),
    accent: col('--accent', '#5cf2d6'), accent2: col('--accent-2', '#ff7a59'), accent3: col('--accent-3', '#7aa2ff'),
    isLight: hsl.l > 0.55,
    fonts: {
      display: v('--font-display', 'Georgia, serif'),
      body: v('--font-body', 'system-ui, sans-serif'),
      mono: v('--font-mono', 'ui-monospace, monospace'),
    },
  };
}

/* === HTML ANIMATION PREP ================================================= */

function splitLetters(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  let i = 0;
  text.split(/(\s+)/).forEach((word) => {
    if (/^\s+$/.test(word)) { el.appendChild(document.createTextNode(word)); return; }
    const w = document.createElement('span');
    w.className = 'ts-word'; w.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const s = document.createElement('span');
      s.className = 'ts-letter'; s.textContent = ch; s.style.setProperty('--li', i++);
      w.appendChild(s);
    }
    el.appendChild(w);
  });
}

function prepareSlideHTML(el) {
  // If the author gave no data-anim anywhere, animate direct children with "rise".
  if (!el.querySelector('[data-anim]') && el.dataset.anim !== 'none') {
    [...el.children].forEach((c) => { if (!c.matches('aside.notes, .notes')) c.dataset.anim = 'rise'; });
  }
  let order = 0;
  el.querySelectorAll('[data-anim]').forEach((a) => {
    if (a.dataset.anim === 'letters') splitLetters(a);
    const d = a.dataset.delay != null ? Number(a.dataset.delay) : 120 + order * 110;
    a.style.setProperty('--d', `${d}ms`);
    if (!a.hasAttribute('data-step')) order++;
  });
}

function countUp(el, motion) {
  const target = parseFloat(el.dataset.count);
  if (!Number.isFinite(target)) return;
  const decimals = (el.dataset.count.split('.')[1] || '').length;
  const prefix = el.dataset.prefix || '', suffix = el.dataset.suffix || '';
  const fmt = (n) => prefix + n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  if (motion < 1) { el.textContent = fmt(target); return; }
  const dur = Number(el.dataset.duration || 1600);
  const delay = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
  const t0 = performance.now() + delay;
  const tick = (now) => {
    const p = clampN((now - t0) / dur, 0, 1);
    el.textContent = fmt(target * (1 - Math.pow(1 - p, 4)));
    if (p < 1 && el.closest('.slide')?.classList.contains('is-active')) requestAnimationFrame(tick);
    else if (p >= 1) el.textContent = fmt(target);
  };
  el.textContent = fmt(0);
  requestAnimationFrame(tick);
}

/* === DECK =============================================================== */

async function createDeck(options = {}) {
  const qs = new URLSearchParams(location.search);
  const root = document.documentElement;
  const deckEl = options.element || document.querySelector('.deck') || document.body;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches || qs.has('static');
  const cfg = {
    journey: deckEl.dataset.journey || options.journey || 'drift',
    transition: Number(deckEl.dataset.transition || options.transition || 1),
    bloom: Number(deckEl.dataset.bloom ?? options.bloom ?? NaN),
    ambient: deckEl.dataset.ambient || options.ambient || 'stars',
    parallax: options.parallax ?? true,
    chrome: !qs.has('nochrome') && options.chrome !== false,
    quality: qs.get('quality') || options.quality || 'high',
    clickToAdvance: options.clickToAdvance ?? true,
    dots: deckEl.dataset.dots || options.dots || 'auto', // auto = last slide + bottom hover · always · last · none
  };
  const motion = reducedMotion ? 0.15 : 1;
  if (reducedMotion) root.classList.add('ts-reduced');

  await document.fonts?.ready;

  /* --- DOM: viewport, stage, canvas, chrome --- */
  document.body.classList.add('ts-body');
  const viewport = document.createElement('div'); viewport.className = 'ts-viewport';
  const canvas = document.createElement('canvas'); canvas.className = 'ts-canvas';
  const stage = document.createElement('div'); stage.className = 'ts-stage';
  const slideEls = [...deckEl.querySelectorAll(':scope > section')];
  if (!slideEls.length) throw new Error('[threejs-slides] no <section> slides found inside .deck');
  deckEl.classList.add('deck');
  stage.appendChild(deckEl);
  viewport.append(canvas, stage);
  document.body.appendChild(viewport);

  const chrome = document.createElement('div');
  chrome.className = 'ts-chrome';
  chrome.innerHTML = `<div class="ts-progress"><span></span></div><div class="ts-counter"></div>
    <div class="ts-notes" hidden><div class="ts-notes-title">Speaker notes</div><div class="ts-notes-body"></div></div>
    <div class="ts-help" hidden><b>Keys</b> → / Space next · ← back · Home / End · F fullscreen · N notes · ? help</div>`;
  if (!cfg.chrome) chrome.style.display = 'none';
  stage.appendChild(chrome);
  const progressBar = chrome.querySelector('.ts-progress span');
  const counter = chrome.querySelector('.ts-counter');
  const notesBox = chrome.querySelector('.ts-notes');
  const notesBody = chrome.querySelector('.ts-notes-body');
  const helpBox = chrome.querySelector('.ts-help');

  /* --- Renderer --- */
  const palette = readPalette(root);
  if (!Number.isFinite(cfg.bloom)) cfg.bloom = palette.isLight ? 0 : 0.4;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(palette.bg, 1);
  renderer.toneMapping = THREE.NoToneMapping; // keep scene colours identical to the CSS theme (OutputPass would tone-map the background too)
  const maxDPR = cfg.quality === 'low' ? 1 : 2;

  const scene = new THREE.Scene();
  scene.background = palette.bg.clone(); // colour-managed the same way on screen and in post-processing targets
  scene.fog = new THREE.Fog(palette.bg, 30, 150);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = palette.isLight ? 0.9 : 0.6;
  scene.add(new THREE.HemisphereLight(palette.fg, palette.bg, palette.isLight ? 1.2 : 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(5, 8, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(palette.accent3, 1.2); rim.position.set(-6, -2, -4); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(45, STAGE_W / STAGE_H, 0.1, 400);
  const shared = { uPixelRatio: { value: 1 }, uTime: { value: 0 } };

  /* --- Post-processing (optional bloom; loaded only when needed) --- */
  let composer = null, bloomPass = null;
  if (cfg.bloom > 0 && cfg.quality !== 'low') {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
      ]);
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(512, 512), cfg.bloom, 0.45, 0.42);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    } catch (e) { console.warn('[threejs-slides] bloom unavailable', e); composer = null; }
  }

  /* --- Slides & their 3D scenes --- */
  const journeyFn = JOURNEYS[cfg.journey] || JOURNEYS.drift;
  const slides = slideEls.map((el, index) => {
    el.classList.add('slide');
    const notesEl = el.querySelector('aside.notes, .notes');
    const stepNums = [...new Set([...el.querySelectorAll('[data-step]')].map((s) => Number(s.dataset.step) || 1))].sort((a, b) => a - b);
    const sceneSteps = Number(el.dataset.sceneSteps || 0);
    prepareSlideHTML(el);
    return {
      el, index, stepNums,
      totalSteps: Math.max(stepNums.length, sceneSteps),
      step: 0,
      sceneName: el.dataset.scene || 'none',
      params: parseParams(el, index),
      anchor: journeyFn(index),
      offset: parseVec(el.dataset.offset) || layoutOffset(el),
      scale: Number(el.dataset.scale || 1),
      dim: el.dataset.dim != null ? Number(el.dataset.dim) : layoutDim(el),
      brightness: el.dataset.brightness != null ? Number(el.dataset.brightness) : 1,
      notes: notesEl ? notesEl.innerHTML : (el.dataset.notes || ''),
      vis: 0, visFrom: 0, visTo: 0, group: null, inst: null, mats: [],
    };
  });

  const ctxBase = { THREE, palette, renderer, camera, scene, shared, helpers };
  for (const s of slides) {
    const factory = registry.get(s.sceneName);
    if (!factory) console.warn(`[threejs-slides] slide ${s.index + 1}: unknown scene "${s.sceneName}". Known: ${[...registry.keys()].join(', ')}`);
    let inst;
    try {
      inst = (factory || registry.get('none'))({ ...ctxBase, params: s.params, index: s.index, slide: s.el });
    } catch (e) {
      console.error(`[threejs-slides] slide ${s.index + 1}: scene "${s.sceneName}" failed`, e);
      inst = registry.get('none')();
    }
    const group = new THREE.Group();
    group.position.copy(s.anchor).add(new THREE.Vector3(...s.offset));
    group.scale.setScalar(s.scale);
    const rot = parseVec(s.el.dataset.rotate);
    if (rot) group.rotation.set(...rot.map((d) => (d * Math.PI) / 180));
    group.add(inst.object);
    group.visible = false;
    scene.add(group);
    // data-brightness: darken/brighten the object's colours (not its opacity). Labels (sprites) are left alone.
    if (s.brightness !== 1) {
      const seen = new Set();
      group.traverse((o) => {
        if (o.isSprite) return;
        (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach((m) => {
          if (seen.has(m)) return; seen.add(m);
          m.color?.multiplyScalar(s.brightness);
          if (m.emissiveIntensity != null) m.emissiveIntensity *= s.brightness;
          if (m.uniforms?.uBrightness) m.uniforms.uBrightness.value *= s.brightness;
        });
      });
    }
    const managed = new Set(inst.fadeManaged || []);
    const mats = [];
    group.traverse((o) => {
      const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      list.forEach((m) => {
        if (managed.has(m) || mats.some((x) => x.m === m)) return;
        if (m.uniforms?.uFade) { mats.push({ m, kind: 'uniform' }); return; }
        m.transparent = true; mats.push({ m, kind: 'opacity', base: m.opacity });
      });
    });
    const cam = inst.camera || {};
    s.camOffset = parseVec(s.el.dataset.camera) || cam.offset || [0, 0, 8];
    s.lookOffset = parseVec(s.el.dataset.look) || cam.look || [0, 0, 0];
    Object.assign(s, { group, inst, mats });
  }

  /* --- Ambient field spanning the whole journey --- */
  let ambient = null;
  if (cfg.ambient !== 'none') {
    const box = new THREE.Box3();
    slides.forEach((s) => box.expandByPoint(s.anchor));
    box.expandByScalar(60);
    const count = cfg.ambient === 'dust' ? 2500 : 7000;
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    const rnd = helpers.sceneRng(42);
    const size = new THREE.Vector3(); box.getSize(size);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      pos[i * 3] = box.min.x + rnd() * size.x;
      pos[i * 3 + 1] = box.min.y + rnd() * size.y;
      pos[i * 3 + 2] = box.min.z + rnd() * size.z;
      c.copy(palette.fg).lerp(rnd() < 0.2 ? palette.accent : palette.accent3, rnd() * 0.6);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    ambient = new THREE.Points(geo, new THREE.PointsMaterial({
      size: cfg.ambient === 'dust' ? 0.5 : 0.32, map: helpers.dotTexture(), vertexColors: true, transparent: true,
      opacity: palette.isLight ? 0.35 : 0.85, depthWrite: false, sizeAttenuation: true,
      blending: palette.isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
    }));
    scene.add(ambient);
  }

  /* --- Layout: fit 16:9 stage into the window --- */
  let stageScale = 1;
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    stageScale = Math.min(vw / STAGE_W, vh / STAGE_H);
    const w = STAGE_W * stageScale, h = STAGE_H * stageScale;
    const left = (vw - w) / 2, top = (vh - h) / 2;
    stage.style.transform = `translate(${left}px, ${top}px) scale(${stageScale})`;
    Object.assign(canvas.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
    const dpr = Math.min(window.devicePixelRatio || 1, maxDPR);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer?.setPixelRatio(dpr);
    composer?.setSize(w, h);
    shared.uPixelRatio.value = dpr * stageScale;
  }
  fit();
  window.addEventListener('resize', fit);

  /* --- Navigation state --- */
  let current = -1;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let tween = null;
  const listeners = new Set();

  const camTarget = (s) => ({
    pos: s.anchor.clone().add(new THREE.Vector3(...s.camOffset)),
    look: s.anchor.clone().add(new THREE.Vector3(...s.lookOffset)),
  });

  function applySteps(s, n) {
    s.step = clampN(n, 0, s.totalSteps);
    const shownUpTo = s.stepNums[s.step - 1] ?? -Infinity;
    s.el.querySelectorAll('[data-step]').forEach((e) => e.classList.toggle('is-shown', (Number(e.dataset.step) || 1) <= shownUpTo));
    s.inst.step?.(s.step);
  }

  /* --- Slide dots: one per slide, click to jump. 'auto' shows them on the last slide,
         and on other slides only while the pointer is near the bottom edge. --- */
  const dotsNav = document.createElement('nav');
  dotsNav.className = 'ts-dots';
  dotsNav.setAttribute('aria-label', 'Slides');
  const titleOf = (el, i) => {
    const t = el.dataset.title || el.querySelector('h1, h2, blockquote, h3')?.getAttribute('aria-label')
      || el.querySelector('h1, h2, blockquote, h3')?.textContent || '';
    return `${i + 1} · ${t.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Slide'}`;
  };
  const dotEls = slides.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ts-dot';
    b.dataset.label = titleOf(s.el, i);
    b.setAttribute('aria-label', `Go to slide ${b.dataset.label}`);
    b.addEventListener('click', (e) => { e.stopPropagation(); if (i !== current) go(i, { allSteps: i < current }); });
    dotsNav.appendChild(b);
    return b;
  });
  if (cfg.dots !== 'none') chrome.appendChild(dotsNav);
  /* --- Fullscreen button, top-centre pill: shown on slide 1 until fullscreen, else when the pointer nears the top edge. F key still works. --- */
  const fsBtn = document.createElement('button');
  fsBtn.type = 'button';
  fsBtn.className = 'ts-fs';
  const ICON_ENTER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  const ICON_EXIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});
  const syncFs = () => {
    const on = !!document.fullscreenElement;
    fsBtn.innerHTML = `${on ? ICON_EXIT : ICON_ENTER}<span>${on ? 'Exit fullscreen' : 'Fullscreen'}</span><kbd>F</kbd>`;
    fsBtn.setAttribute('aria-label', on ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)');
  };
  syncFs();
  fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
  document.addEventListener('fullscreenchange', () => { syncFs(); syncDots(); });
  // iOS Safari and some embeds don't allow fullscreen on a page: don't show a button that can't work
  if (document.fullscreenEnabled !== false && options.fullscreenButton !== false) chrome.appendChild(fsBtn);

  // Bottom-edge hover reveals the dots (auto mode); top-edge hover reveals the fullscreen button.
  let nearBottom = false, nearTop = false, hideTimer = 0, topTimer = 0;
  const isLast = () => current === slides.length - 1;
  function syncDots() {
    const show = cfg.dots === 'always' || ((cfg.dots === 'auto' || cfg.dots === 'last') && isLast()) || (cfg.dots === 'auto' && nearBottom);
    dotsNav.classList.toggle('is-shown', show);
    // first slide: always offer fullscreen (that's when you want it) until you're in it; elsewhere hover-only
    fsBtn.classList.toggle('is-shown', nearTop || (current === 0 && !document.fullscreenElement));
  }
  const setNear = (v) => { if (v !== nearBottom) { nearBottom = v; syncDots(); } };
  window.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const near = e.clientY > r.bottom - r.height * 0.16 && e.clientY < r.bottom + 40;
    if (near) { clearTimeout(hideTimer); setNear(true); }
    else if (nearBottom && !dotsNav.matches(':hover')) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setNear(false), 2000);
    }
    const top = e.clientY < r.top + r.height * 0.14 && e.clientY > r.top - 40;
    if (top) { clearTimeout(topTimer); if (!nearTop) { nearTop = true; syncDots(); } }
    else if (nearTop && !fsBtn.matches(':hover')) {
      clearTimeout(topTimer);
      topTimer = setTimeout(() => { nearTop = false; syncDots(); }, 2000);
    }
  });
  document.documentElement.addEventListener('pointerleave', () => {
    clearTimeout(hideTimer); clearTimeout(topTimer);
    hideTimer = setTimeout(() => { nearTop = false; setNear(false); syncDots(); }, 600);
  });
  dotsNav.addEventListener('focusin', () => setNear(true));
  dotsNav.addEventListener('focusout', () => setNear(false));
  fsBtn.addEventListener('focusin', () => { nearTop = true; syncDots(); });
  fsBtn.addEventListener('focusout', () => { nearTop = false; syncDots(); });

  function updateChrome() {
    const s = slides[current];
    dotEls.forEach((d, i) => { d.classList.toggle('is-current', i === current); d.toggleAttribute('aria-current', i === current); });
    syncDots();
    progressBar.style.width = `${((current + 1) / slides.length) * 100}%`;
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    notesBody.innerHTML = s.notes || '<em>No notes for this slide.</em>';
  }

  function activateHTML(s) {
    s.el.classList.remove('is-leaving');
    s.el.classList.add('is-active');
    s.el.querySelectorAll('[data-count]').forEach((e) => countUp(e, motion));
  }

  let htmlTimer = 0;
  function go(target, { instant = false, allSteps = false } = {}) {
    target = clampN(Math.round(target), 0, slides.length - 1);
    if (target === current && !instant) return;
    const prev = slides[current];
    const next = slides[target];
    const fast = instant || reducedMotion;
    if (prev && prev !== next) {
      prev.el.classList.remove('is-active');
      prev.el.classList.add('is-leaving');
      setTimeout(() => prev.el.classList.remove('is-leaving'), 700);
      prev.inst.leave?.();
    }
    current = target;
    applySteps(next, allSteps ? next.totalSteps : 0);
    slides.forEach((s) => { s.visFrom = s.vis; s.visTo = s === next ? 1 : 0; });

    const to = camTarget(next);
    const dist = camPos.distanceTo(to.pos);
    const dur = fast ? 0 : clampN(1.1 + dist / 110, 1.1, 2.3) * cfg.transition;
    const mid = camPos.clone().lerp(to.pos, 0.5);
    const ctrl = mid.add(new THREE.Vector3(0, Math.min(dist * 0.14, 16), 3 + Math.min(dist * 0.08, 14)));
    tween = { t0: performance.now(), dur: dur * 1000, from: camPos.clone(), ctrl, to: to.pos, lookFrom: camLook.clone(), lookTo: to.look };
    if (fast) { camPos.copy(to.pos); camLook.copy(to.look); tween = null; slides.forEach((s) => { s.vis = s.visTo; }); }

    clearTimeout(htmlTimer);
    if (fast) activateHTML(next);
    else htmlTimer = setTimeout(() => activateHTML(next), dur * 1000 * 0.42);
    next.inst.enter?.();
    updateChrome();
    if (!qs.has('static')) history.replaceState(null, '', `#/${current + 1}`);
    listeners.forEach((fn) => fn({ index: current, slide: next.el }));
  }

  function next() {
    const s = slides[current];
    if (s.step < s.totalSteps) applySteps(s, s.step + 1);
    else go(current + 1);
  }
  function prev() {
    const s = slides[current];
    if (s.step > 0) applySteps(s, s.step - 1);
    else if (current > 0) go(current - 1, { allSteps: true });
  }

  /* --- Input --- */
  const toggle = (el) => { el.hidden = !el.hidden; };
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0);
    else if (k === 'End') go(slides.length - 1, { allSteps: true });
    else if (k === 'f' || k === 'F') toggleFullscreen();
    else if (k === 'n' || k === 'N') toggle(notesBox);
    else if (k === '?' || k === 'h') toggle(helpBox);
  });
  if (cfg.clickToAdvance) {
    stage.addEventListener('click', (e) => {
      if (e.target.closest('a, button, input, textarea, select, [contenteditable], .no-advance, .ts-notes')) return;
      const r = stage.getBoundingClientRect();
      (e.clientX - r.left) / r.width < 0.2 ? prev() : next();
    });
  }
  let wheelLock = 0;
  window.addEventListener('wheel', (e) => {
    const now = performance.now();
    if (now < wheelLock || Math.abs(e.deltaY) < 30) return;
    wheelLock = now + 900;
    e.deltaY > 0 ? next() : prev();
  }, { passive: true });
  let touchX = null;
  window.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
  });
  const pointer = new THREE.Vector2(), pointerSmooth = new THREE.Vector2();
  if (cfg.parallax && !reducedMotion) {
    window.addEventListener('pointermove', (e) => pointer.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5));
  }
  window.addEventListener('hashchange', () => {
    const n = parseInt(location.hash.replace(/\D/g, ''), 10);
    if (n && n - 1 !== current) go(n - 1);
  });

  /* --- Initial slide --- */
  const startFromHash = parseInt((location.hash || '').replace(/\D/g, ''), 10);
  const startFromQs = parseInt(qs.get('slide') || '', 10);
  const first = clampN((startFromQs || startFromHash || 1) - 1, 0, slides.length - 1);
  const t0 = camTarget(slides[first]);
  camPos.copy(t0.pos).add(new THREE.Vector3(0, 2, 14));
  camLook.copy(t0.look);
  // warm up shaders so the first fly-through doesn't stutter
  slides.forEach((s) => { s.group.visible = true; });
  camera.position.copy(camPos); camera.lookAt(camLook);
  try { renderer.compile(scene, camera); } catch { /* ignore */ }
  slides.forEach((s) => { s.group.visible = false; });
  current = -1;
  go(first, { allSteps: qs.has('static') && qs.has('allsteps') });

  /* --- Render loop --- */
  const timer = new THREE.Timer();
  timer.connect?.(document);
  let readyResolve; const ready = new Promise((r) => { readyResolve = r; });
  let frames = 0;
  const bez = new THREE.Vector3();
  function frame(ts) {
    requestAnimationFrame(frame);
    timer.update(ts);
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();
    shared.uTime.value = t * motion;

    let p = 1;
    if (tween) {
      p = tween.dur ? clampN((performance.now() - tween.t0) / tween.dur, 0, 1) : 1;
      const e = easeInOut(p);
      // quadratic bezier: from → ctrl → to (a swooping flight)
      bez.copy(tween.from).multiplyScalar((1 - e) * (1 - e))
        .addScaledVector(tween.ctrl, 2 * (1 - e) * e)
        .addScaledVector(tween.to, e * e);
      camPos.copy(bez);
      camLook.lerpVectors(tween.lookFrom, tween.lookTo, e);
      if (p >= 1) tween = null;
    }
    for (const s of slides) {
      if (s.visFrom !== s.visTo || s.vis !== s.visTo) {
        s.vis = s.visTo > s.visFrom
          ? s.visFrom + (1 - s.visFrom) * smoothstep01((p - 0.38) / 0.5)
          : s.visFrom * (1 - smoothstep01(p / 0.4));
        if (p >= 1) { s.vis = s.visTo; s.visFrom = s.visTo; }
      }
      const visible = s.vis > 0.002;
      s.group.visible = visible;
      if (!visible) continue;
      const f = s.vis * s.dim;
      for (const m of s.mats) {
        if (m.kind === 'uniform') m.m.uniforms.uFade.value = f;
        else m.m.opacity = m.base * f;
      }
      s.inst.update?.(t, dt, { fade: f, active: s.index === current, motion });
    }
    pointerSmooth.lerp(pointer, Math.min(1, dt * 3));
    camera.position.copy(camPos).add(new THREE.Vector3(pointerSmooth.x * 0.5, -pointerSmooth.y * 0.35, 0));
    camera.lookAt(camLook);
    if (ambient) ambient.rotation.y = Math.sin(t * 0.02) * 0.02;

    if (composer) composer.render(); else renderer.render(scene, camera);
    if (++frames === 3) { root.classList.add('ts-ready'); readyResolve(); }
  }
  requestAnimationFrame(frame);
  // fallback when rAF is throttled (background tab / hidden pane): still show the stage
  setTimeout(() => { if (!root.classList.contains('ts-ready')) { root.classList.add('ts-ready'); readyResolve(); } }, 2500);

  const api = {
    get index() { return current; },
    get count() { return slides.length; },
    get step() { return slides[current].step; },
    slides: slides.map((s) => s.el),
    go, next, prev, ready,
    on(evt, fn) { if (evt === 'change') listeners.add(fn); return () => listeners.delete(fn); },
    renderer, scene, camera, palette,
  };
  window.deck = api;
  return api;
}

export { createDeck, registerScene, THREE, helpers };
