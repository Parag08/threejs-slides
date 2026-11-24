/* ==========================================================================
   threejs-slides — built-in scene library
   --------------------------------------------------------------------------
   Every scene is a factory:  (ctx) => SceneInstance

   ctx = {
     THREE, palette, params, index, slide, renderer, camera, shared, helpers
   }
   SceneInstance = {
     object,                     // THREE.Object3D placed at the slide anchor (required)
     update?(t, dt, info),       // per frame while visible. info = { fade, active, motion }
     enter?(),                   // slide became current
     leave?(),                   // slide stopped being current
     step?(n),                   // build step n (0 = initial state) — see data-step / data-scene-steps
     camera?: { offset:[x,y,z], look:[x,y,z] }, // default camera relative to the anchor
     dispose?()
   }

   Fading: the engine fades every material in `object` in and out.
   ShaderMaterials should expose a `uFade` uniform (float 0..1) and multiply alpha by it,
   and a `uBrightness` uniform (float, default 1) that multiplies the colour, so
   `data-brightness` (per slide or on .deck) can dim them.
   Other materials get `opacity = baseOpacity * fade` automatically.
   ========================================================================== */

import * as THREE from 'three';

/* === HELPERS ============================================================ */

/** Deterministic PRNG so a deck looks identical on every load. */
function sceneRng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Palette colour by index: accent, accent2, accent3 cycling. */
function paletteColor(palette, i) {
  const list = [palette.accent, palette.accent2, palette.accent3];
  return list[((i % 3) + 3) % 3].clone();
}

/** Linear → smooth 0..1 */
const smooth01 = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const easeOutCubic = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeInOutCubic = (t) => { t = Math.min(1, Math.max(0, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

/** Soft round sprite used by points and the ambient star field. */
let _dotTexture = null;
function dotTexture() {
  if (_dotTexture) return _dotTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _dotTexture = new THREE.CanvasTexture(c);
  _dotTexture.colorSpace = THREE.SRGBColorSpace;
  return _dotTexture;
}

/**
 * Glowing point-cloud material. Geometry needs `position`, `aColor` (vec3) and `aScale` (float).
 * Size is in "stage pixels at distance 10" and stays consistent across window sizes.
 */
function pointsMaterial(ctx, { size = 6, opacity = 1, additive } = {}) {
  const useAdditive = additive ?? !ctx.palette.isLight;
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: size },
      uOpacity: { value: opacity },
      uFade: { value: 0 },
      uBrightness: { value: 1 },
      uPixelRatio: ctx.shared.uPixelRatio,
      uTime: ctx.shared.uTime,
    },
    vertexShader: /* glsl */`
      attribute vec3 aColor;
      attribute float aScale;
      uniform float uSize;
      uniform float uPixelRatio;
      uniform float uTime;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float twinkle = 0.85 + 0.15 * sin(uTime * 2.0 + position.x * 3.1 + position.y * 1.7);
        gl_PointSize = uSize * aScale * twinkle * uPixelRatio * (10.0 / max(0.1, -mv.z));
        vColor = aColor;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity;
      uniform float uFade;
      uniform float uBrightness;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 1.5) * uOpacity * uFade;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vColor * uBrightness, a);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: useAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** Build a Points object from a Float32Array of positions and a colour function. */
function makePoints(ctx, positions, colorFn, { size = 6, opacity = 1, scaleFn } = {}) {
  const n = positions.length / 3;
  const colors = new Float32Array(n * 3);
  const scales = new Float32Array(n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    colorFn(i, c);
    colors.set([c.r, c.g, c.b], i * 3);
    scales[i] = scaleFn ? scaleFn(i) : 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  return new THREE.Points(geo, pointsMaterial(ctx, { size, opacity }));
}

/**
 * Text label rendered to a canvas sprite. Uses the deck's CSS fonts.
 * height = world-space height of one text line.
 */
function makeLabel(ctx, text, { height = 0.32, color, font = 'body', weight = 600, align = 'center' } = {}) {
  const fam = ctx.palette.fonts[font] || ctx.palette.fonts.body;
  const px = 96;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `${weight} ${px}px ${fam}`;
  const w = Math.ceil(g.measureText(String(text)).width) + px * 0.9;
  c.width = w; c.height = Math.ceil(px * 1.6);
  g.font = `${weight} ${px}px ${fam}`;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillStyle = '#' + (color || ctx.palette.fg).getHexString(THREE.SRGBColorSpace);
  g.fillText(String(text), w / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const s = new THREE.Sprite(mat);
  const aspect = c.width / c.height;
  s.scale.set(height * 1.6 * aspect, height * 1.6, 1);
  if (align === 'left') s.center.set(0.08, 0.5);
  if (align === 'right') s.center.set(0.92, 0.5);
  s.renderOrder = 10;
  // share of the sprite covered by glyphs (the canvas has padding), for collision checks
  s.userData.textW = (w - px * 0.9) / w;
  s.userData.textH = 0.5;
  return s;
}

/* === SHAPE GENERATORS (for morph + others) ============================== */

function fibonacciSphere(n, r, out = new Float32Array(n * 3), jitter = 0, rnd = Math.random) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const rr = r + (rnd() - 0.5) * jitter;
    out[i * 3] = Math.cos(th) * rad * rr;
    out[i * 3 + 1] = y * rr;
    out[i * 3 + 2] = Math.sin(th) * rad * rr;
  }
  return out;
}

const SHAPES = {
  sphere: (n, rnd) => fibonacciSphere(n, 2.2, undefined, 0.08, rnd),
  torus: (n, rnd) => {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd() * Math.PI * 2, v = rnd() * Math.PI * 2;
      const R = 2.0, r = 0.7;
      a[i * 3] = (R + r * Math.cos(v)) * Math.cos(u);
      a[i * 3 + 1] = r * Math.sin(v);
      a[i * 3 + 2] = (R + r * Math.cos(v)) * Math.sin(u);
    }
    return a;
  },
  helix: (n, rnd) => {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const strand = i % 3; // two strands + rungs
      const t = rnd();
      const ang = t * Math.PI * 6;
      const y = (t - 0.5) * 5.2;
      if (strand < 2) {
        const off = strand * Math.PI;
        a[i * 3] = Math.cos(ang + off) * 1.1 + (rnd() - 0.5) * 0.08;
        a[i * 3 + 1] = y;
        a[i * 3 + 2] = Math.sin(ang + off) * 1.1 + (rnd() - 0.5) * 0.08;
      } else {
        const k = (rnd() - 0.5) * 2;
        const tt = Math.round(t * 24) / 24;
        const ang2 = tt * Math.PI * 6;
        a[i * 3] = Math.cos(ang2) * 1.1 * k;
        a[i * 3 + 1] = (tt - 0.5) * 5.2;
        a[i * 3 + 2] = Math.sin(ang2) * 1.1 * k;
      }
    }
    return a;
  },
  cube: (n, rnd) => {
    const a = new Float32Array(n * 3);
    const s = 1.4;
    for (let i = 0; i < n; i++) {
      const face = Math.floor(rnd() * 6);
      const u = (rnd() * 2 - 1) * s, v = (rnd() * 2 - 1) * s;
      const sign = face % 2 ? 1 : -1;
      const axis = Math.floor(face / 2);
      const p = [0, 0, 0];
      p[axis] = sign * s; p[(axis + 1) % 3] = u; p[(axis + 2) % 3] = v;
      a.set(p, i * 3);
    }
    return a;
  },
  wave: (n, rnd) => {
    const a = new Float32Array(n * 3);
    const side = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const x = ((i % side) / side - 0.5) * 7;
      const z = (Math.floor(i / side) / side - 0.5) * 7;
      a[i * 3] = x;
      a[i * 3 + 1] = Math.sin(x * 1.2) * 0.5 + Math.cos(z * 1.4) * 0.5;
      a[i * 3 + 2] = z;
    }
    return a;
  },
  knot: (n, rnd) => {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = rnd() * Math.PI * 2;
      const p = 2, q = 3, r = 1.4 + 0.5 * Math.cos(q * t);
      const j = 0.18;
      a[i * 3] = r * Math.cos(p * t) + (rnd() - 0.5) * j;
      a[i * 3 + 1] = 0.9 * Math.sin(q * t) + (rnd() - 0.5) * j;
      a[i * 3 + 2] = r * Math.sin(p * t) + (rnd() - 0.5) * j;
    }
    return a;
  },
  galaxy: (n, rnd) => {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const arm = i % 4;
      const r = Math.pow(rnd(), 0.7) * 3.2;
      const ang = arm * (Math.PI / 2) + r * 1.4 + (rnd() - 0.5) * 0.5;
      a[i * 3] = Math.cos(ang) * r;
      a[i * 3 + 1] = (rnd() - 0.5) * 0.25 * (1.2 - r / 3.2);
      a[i * 3 + 2] = Math.sin(ang) * r;
    }
    return a;
  },
  scatter: (n, rnd) => {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = (rnd() - 0.5) * 14;
      a[i * 3 + 1] = (rnd() - 0.5) * 9;
      a[i * 3 + 2] = (rnd() - 0.5) * 8;
    }
    return a;
  },
};

/* === SCENES ============================================================= */

const scenes = {};

/* --- none: no 3D object, only the ambient field ---------------------------- */
scenes.none = () => ({ object: new THREE.Group() });

/* --- galaxy: spiral galaxy of glowing points (title / hero) --------------- */
scenes.galaxy = (ctx) => {
  const { palette, params } = ctx;
  const rnd = sceneRng(params.seed ?? 7 + ctx.index);
  const n = params.count ?? 14000;
  const arms = params.arms ?? 4;
  const radius = params.radius ?? 4.2;
  const pos = new Float32Array(n * 3);
  const radii = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = Math.pow(rnd(), 1.6) * radius;
    const arm = i % arms;
    const spin = r * (params.spin ?? 1.15);
    const ang = (arm / arms) * Math.PI * 2 + spin;
    const spread = Math.pow(rnd(), 3) * (rnd() < 0.5 ? 1 : -1) * 0.55 * (0.4 + r * 0.25);
    pos[i * 3] = Math.cos(ang) * r + spread;
    pos[i * 3 + 1] = (rnd() - 0.5) * 0.35 * (1 - r / radius) + spread * 0.25;
    pos[i * 3 + 2] = Math.sin(ang) * r + Math.pow(rnd(), 3) * (rnd() < 0.5 ? 1 : -1) * 0.55;
    radii[i] = r / radius;
  }
  const inner = palette.accent2.clone(), outer = palette.accent.clone();
  const pts = makePoints(ctx, pos, (i, c) => c.copy(inner).lerp(outer, Math.min(1, radii[i] * 1.4)),
    { size: params.size ?? 3.2, scaleFn: () => 0.5 + rnd() * 1.1 });
  const core = makePoints(ctx, fibonacciSphere(500, 0.25, undefined, 0.5, rnd), (i, c) => c.copy(palette.accent2).lerp(palette.fg, 0.4),
    { size: 7, opacity: 0.6 });
  const g = new THREE.Group();
  g.add(pts, core);
  g.rotation.x = params.tilt ?? 0.5;
  g.rotation.z = -0.15;
  return {
    object: g,
    camera: { offset: [0, 1.2, 9.5], look: [0, -0.2, 0] },
    update(t, dt, info) { pts.rotation.y += dt * 0.06 * info.motion; core.rotation.y -= dt * 0.1 * info.motion; },
  };
};

/* --- morph: particle cloud that morphs between shapes on each build step -- */
scenes.morph = (ctx) => {
  const { palette, params } = ctx;
  const rnd = sceneRng(params.seed ?? 11);
  const n = params.count ?? 7000;
  const names = (params.shapes ?? ['sphere', 'torus', 'helix']).filter((s) => SHAPES[s]);
  if (!names.length) names.push('sphere');
  const targets = names.map((s) => SHAPES[s](n, rnd));
  const start = SHAPES.scatter(n, rnd);
  const current = new Float32Array(start);
  const from = new Float32Array(start);
  const pts = makePoints(ctx, current, (i, c) => c.copy(paletteColor(palette, Math.floor(i / (n / 3)))).lerp(palette.fg, rnd() * 0.25),
    { size: params.size ?? 3.4, scaleFn: () => 0.6 + rnd() * 0.9 });
  let target = targets[0], t0 = -1, dur = 1.6, mixP = 1, pendingIdx = 0;
  const morphTo = (idx) => { from.set(current); target = targets[Math.min(idx, targets.length - 1)]; t0 = -1; mixP = 0; pendingIdx = idx; };
  const g = new THREE.Group();
  g.add(pts);
  return {
    object: g,
    camera: { offset: [0, 0.4, 8.5], look: [0, 0, 0] },
    enter() { morphTo(pendingIdx); },
    step(k) { morphTo(k); },
    update(t, dt, info) {
      g.rotation.y += dt * 0.18 * info.motion;
      g.rotation.x = Math.sin(t * 0.2) * 0.15;
      if (mixP < 1) {
        if (t0 < 0) t0 = t;
        mixP = Math.min(1, (t - t0) / (info.motion < 1 ? 0.01 : dur));
        const posAttr = pts.geometry.attributes.position;
        for (let i = 0; i < n * 3; i++) {
          // stagger each particle slightly for an organic swarm
          const k = easeInOutCubic(mixP * 1.25 - ((i / 3) % 97) / 97 * 0.25);
          current[i] = from[i] + (target[i] - from[i]) * k;
        }
        posAttr.needsUpdate = true;
      }
    },
  };
};

/* --- globe: dotted planet with animated arcs --------------------------- */
scenes.globe = (ctx) => {
  const { palette, params } = ctx;
  const rnd = sceneRng(params.seed ?? 5);
  const R = params.radius ?? 1.95;
  const g = new THREE.Group();
  const occluder = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 64, 48),
    new THREE.MeshBasicMaterial({ color: palette.bg.clone().lerp(palette.accent, 0.012) }));
  occluder.renderOrder = -1; // draw first so it hides the far-side dots without covering the near ones
  g.add(occluder);
  const dots = makePoints(ctx, fibonacciSphere(params.dots ?? 2600, R), (i, c) => c.copy(palette.accent).lerp(palette.fg, rnd() * 0.5),
    { size: 3.6, opacity: 1, scaleFn: () => 0.6 + rnd() * 0.7 });
  g.add(dots);
  // atmosphere: back-face fresnel shell
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 64, 48), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: palette.accent.clone() }, uFade: { value: 0 }, uBrightness: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uFade; uniform float uBrightness; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 4.5); gl_FragColor = vec4(uColor * uBrightness, f * 0.55 * uFade);
      #include <colorspace_fragment>
    }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: palette.isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
  }));
  g.add(atmo);
  const ll = (lat, lng, r = R) => {
    const phi = (90 - lat) * Math.PI / 180, th = (lng + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  };
  const places = params.points ?? [];
  let arcsDef = params.arcs;
  if (!arcsDef) {
    arcsDef = [];
    for (let i = 0; i < (params.arcCount ?? 10); i++) arcsDef.push([rnd() * 140 - 60, rnd() * 360 - 180, rnd() * 140 - 60, rnd() * 360 - 180]);
  }
  const arcs = arcsDef.map((a, i) => {
    const p0 = ll(a[0], a[1]), p1 = ll(a[2], a[3]);
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const lift = R + p0.distanceTo(p1) * 0.45;
    mid.setLength(lift);
    const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
    geo.setDrawRange(0, 0);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: paletteColor(palette, i + 1), transparent: true, opacity: 0.95 }));
    g.add(line);
    return { line, delay: i * 0.25, period: 4 + rnd() * 2 };
  });
  places.forEach((p) => {
    const v = ll(p.lat, p.lng, R * 1.01);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color: palette.accent2 }));
    m.position.copy(v); g.add(m);
    if (p.label) { const l = makeLabel(ctx, p.label, { height: 0.2 }); l.position.copy(v.clone().setLength(R * 1.16)); g.add(l); }
  });
  g.rotation.z = 0.35;
  let tEnter = 0;
  return {
    object: g,
    camera: { offset: [0, 0.3, 8], look: [0, 0, 0] },
    enter() { tEnter = -1; },
    update(t, dt, info) {
      if (tEnter < 0) tEnter = t;
      g.rotation.y += dt * 0.12 * info.motion;
      const local = t - tEnter;
      arcs.forEach((a) => {
        const p = ((local - a.delay) % a.period) / a.period;
        const grow = local < a.delay ? 0 : (local - a.delay < a.period ? smooth01(p * 2) : 1);
        a.line.geometry.setDrawRange(0, Math.floor(81 * grow));
      });
    },
  };
};

/* --- terrain: flowing wireframe landscape ---------------------------- */
scenes.terrain = (ctx) => {
  const { palette, params } = ctx;
  const size = params.size ?? 34;
  const geo = new THREE.PlaneGeometry(size, size, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: ctx.shared.uTime, uFade: { value: 0 }, uAmp: { value: params.amplitude ?? 0.8 }, uAlpha: { value: params.opacity ?? (palette.isLight ? 0.55 : 0.32) },
      uLow: { value: palette.accent.clone() }, uHigh: { value: palette.accent2.clone() }, uSize: { value: size }, uBrightness: { value: 1 },
    },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uAmp; varying float vH; varying float vEdge;
      float h(vec2 p){ return sin(p.x*0.35+uTime*0.6)*0.8 + sin(p.y*0.5-uTime*0.4)*0.6 + sin((p.x+p.y)*0.9+uTime*0.9)*0.25; }
      void main(){ vec3 p = position; p.y += h(p.xz) * uAmp; vH = h(p.xz)*0.5+0.5; vEdge = length(position.xz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLow; uniform vec3 uHigh; uniform float uFade; uniform float uSize; uniform float uAlpha; uniform float uBrightness; varying float vH; varying float vEdge;
      void main(){ float edge = 1.0 - smoothstep(uSize*0.18, uSize*0.48, vEdge);
        gl_FragColor = vec4(mix(uLow, uHigh, clamp(vH,0.,1.)) * uBrightness, edge * uAlpha * uFade);
        #include <colorspace_fragment>
      }`,
    wireframe: true, transparent: true, depthWrite: false,
    blending: palette.isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = params.y ?? -3.5;
  const g = new THREE.Group();
  g.add(mesh);
  return { object: g, camera: { offset: [0, 0.4, 9], look: [0, -0.2, 0] } };
};

/* --- orbit: core with labelled satellites; steps highlight items --------- */
scenes.orbit = (ctx) => {
  const { palette, params } = ctx;
  const items = params.items ?? ['One', 'Two', 'Three', 'Four', 'Five'];
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 4), new THREE.MeshStandardMaterial({
    color: palette.accent.clone().multiplyScalar(0.6), emissive: palette.accent, emissiveIntensity: palette.isLight ? 0.08 : 0.13, roughness: 0.35, metalness: 0.2,
  }));
  g.add(core);
  const R = params.radius ?? 2.15;
  // centre label sits above the whole diagram, on dark background, where no satellite ever passes
  if (params.center) { const l = makeLabel(ctx, params.center, { height: 0.34, font: 'display', weight: 700 }); l.position.set(0, 2.05, 0); g.add(l); }
  const tilt = new THREE.Group(); tilt.rotation.x = 0.42; tilt.rotation.z = -0.12; g.add(tilt);
  const ringPts = new THREE.EllipseCurve(0, 0, R, R).getPoints(160).map((p) => new THREE.Vector3(p.x, 0, p.y));
  const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts),
    new THREE.LineBasicMaterial({ color: palette.fg, transparent: true, opacity: 0.25 }));
  tilt.add(ring);
  const sats = items.map((name, i) => {
    const holder = new THREE.Group();
    const col = paletteColor(palette, i);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.7), emissive: col, emissiveIntensity: palette.isLight ? 0.08 : 0.2, roughness: 0.4 }));
    const label = makeLabel(ctx, name, { height: 0.24 });
    label.position.y = 0.48;
    holder.add(ball, label);
    tilt.add(holder);
    return { holder, ball, label, base: (i / items.length) * Math.PI * 2, hl: 0 };
  });
  let focus = -1;
  return {
    object: g,
    camera: { offset: [0, 0.8, 8.6], look: [0, 0, 0] },
    step(k) { focus = k - 1; },
    update(t, dt, info) {
      core.rotation.y += dt * 0.3 * info.motion;
      const spin = t * 0.12 * info.motion;
      sats.forEach((s, i) => {
        const a = s.base + spin;
        s.holder.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
        s.label.position.y = 0.48;
        const target = focus === -1 ? 0.5 : (i === focus ? 1 : 0.15);
        s.hl += (target - s.hl) * Math.min(1, dt * 6);
        s.ball.scale.setScalar(0.7 + s.hl * 0.9);
        s.label.material.opacity = (0.35 + s.hl * 0.65) * info.fade;
      });
    },
    fadeManaged: sats.map((s) => s.label.material),
  };
};

/* === CHART KIT ===========================================================
   Shared by every data scene (bars, line, waterfall, scatter, matrix, gantt)
   so they look and behave alike:
   - number formatting: unit, prefix, decimals, compact (12.4k)
   - consulting colour rule: when anything is highlighted, the rest goes neutral
   - step reveal: params.reveal = "all" (default, staggered on entry) or "step"
     (one unit per press; set data-scene-steps on the slide)
   - a visually hidden <table> with the data for screen readers
   - every material is owned by the kit, which applies fade and reveal opacity
   ========================================================================== */

const UP = new THREE.Vector3(0, 1, 0);

function chartFormat(p = {}) {
  const unit = p.unit ?? '', prefix = p.prefix ?? '';
  return (v, { sign = false, unit: u = unit } = {}) => {
    if (v == null || !Number.isFinite(v)) return '';
    let a = Math.abs(v), suf = '';
    if (p.compact) {
      if (a >= 1e9) { a /= 1e9; suf = 'B'; } else if (a >= 1e6) { a /= 1e6; suf = 'M'; } else if (a >= 1e3) { a /= 1e3; suf = 'k'; }
    }
    const s = a.toLocaleString('en-US', { minimumFractionDigits: p.decimals ?? 0, maximumFractionDigits: p.decimals ?? (suf ? 1 : 2) });
    return `${v < 0 ? '−' : sign && v > 0 ? '+' : ''}${prefix}${s}${suf}${u}`;
  };
}

/** Round a range out to tidy tick values (1, 2, 2.5, 5 × 10^n). */
function niceStep(range, ticks = 2) {
  const raw = range / ticks, mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= raw) || raw;
}
function niceDomain(lo, hi, ticks = 2) {
  const st = niceStep(hi - lo || Math.abs(hi) || 1, ticks);
  return [Math.floor(lo / st) * st, Math.ceil(hi / st) * st, st];
}

function chartKit(ctx) {
  const { palette, params: P } = ctx;
  const owned = [];
  // opaque: drawn solid (depth-written, no see-through) whenever fully faded in; transparent only while fading
  const own = (m, base = m.opacity ?? 1, opaque = false) => { m.transparent = true; const h = { m, base, a: 1, opaque }; owned.push(h); return h; };
  const neutral = palette.fg.clone().lerp(palette.bg, palette.isLight ? 0.62 : 0.55);
  const seriesColor = (i, anyHi, isHi) => (anyHi
    ? (isHi ? palette.accent2.clone() : neutral.clone().lerp(palette.fg, Math.min(0.3, i * 0.1)))
    : [palette.accent, palette.accent3, palette.accent2, neutral][i % 4].clone());
  const solid = (color, { emissive = 0.088 } = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.88), emissive: color, emissiveIntensity: palette.isLight ? emissive * 0.2 : emissive, roughness: 0.35, metalness: 0.2 });
    return own(m, 1, true);
  };
  const flat = (color, opacity = 1) => own(new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false, side: THREE.DoubleSide }), opacity);
  const labels = [], rods = [], paths = [];
  /** Register a polyline (e.g. a line-chart series) so text crossing it is reported. owner: object whose visibility counts. */
  const path = (pts, owner) => { paths.push({ pts, owner }); };
  const label = (text, opts = {}) => { const s = makeLabel(ctx, text, opts); s.userData.h = own(s.material); s.userData.text = String(text); labels.push(s); return s; };
  const rod = (a, b, r, h) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(d.length(), 1e-4);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8, 1), h.m);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    m.userData.len = len; m.userData.h = h;
    rods.push(m);
    return m;
  };
  /** Text box of a label sprite in its parent's space (optionally as if it sat at x, y). */
  const box = (sp, x = sp.position.x, y = sp.position.y, cx = sp.center.x, cy = sp.center.y) => {
    const w = sp.scale.x * (sp.userData.textW ?? 1), hh = sp.scale.y * (sp.userData.textH ?? 1);
    const mx = x + (0.5 - cx) * sp.scale.x, my = y + (0.5 - cy) * sp.scale.y;
    return { x0: mx - w / 2, x1: mx + w / 2, y0: my - hh / 2, y1: my + hh / 2 };
  };
  const hitsBox = (p, q, bx, pad = 0.06) => {
    for (let i = 0; i <= 10; i++) {
      const x = p.x + ((q.x - p.x) * i) / 10, y = p.y + ((q.y - p.y) * i) / 10;
      if (x > bx.x0 - pad && x < bx.x1 + pad && y > bx.y0 - pad && y < bx.y1 + pad) return true;
    }
    return false;
  };
  const overlaps = (A, B, pad = 0.02) => A.x0 < B.x1 + pad && A.x1 > B.x0 - pad && A.y0 < B.y1 + pad && A.y1 > B.y0 - pad;
  /** Dashed rule from a to b. `avoid`: label sprites or boxes it must not cross; dashes there are left out. */
  const dashes = (a, b, r, h, dash = 0.16, gap = 0.11, avoid = []) => {
    const grp = new THREE.Group();
    const boxes = avoid.map((x) => (x.isSprite ? box(x) : x));
    const len = a.distanceTo(b), dir = new THREE.Vector3().subVectors(b, a).normalize();
    for (let s = 0; s < len; s += dash + gap) {
      const p = a.clone().addScaledVector(dir, s), q = a.clone().addScaledVector(dir, Math.min(len, s + dash));
      if (boxes.some((bx) => hitsBox(p, q, bx))) continue;
      grp.add(rod(p, q, r, h));
    }
    return grp;
  };
  /** Text crossed by a rule or by other text, on screen. Used by deck.textCollisions() and qa.mjs. */
  const collisions = (camera) => {
    const W = 1920, H = 1080, out = [];
    const shown = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
    const toScreen = (v) => { v.project(camera); return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H }; };
    const rect = (sp) => {
      const bx = box(sp), m = sp.parent.matrixWorld;
      const pts = [[bx.x0, bx.y0], [bx.x1, bx.y0], [bx.x0, bx.y1], [bx.x1, bx.y1]].map(([x, y]) => toScreen(new THREE.Vector3(x, y, sp.position.z).applyMatrix4(m)));
      return { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)), t: sp.userData.text };
    };
    const live = labels.filter((sp) => shown(sp) && sp.material.opacity > 0.3).map(rect);
    const segs = rods.filter((m) => shown(m) && m.material.opacity > 0.15).map((m) => {
      const half = new THREE.Vector3(0, m.userData.len / 2, 0).applyQuaternion(m.quaternion);
      const mw = m.parent.matrixWorld;
      return [toScreen(m.position.clone().add(half).applyMatrix4(mw)), toScreen(m.position.clone().sub(half).applyMatrix4(mw))];
    });
    paths.filter((pp) => shown(pp.owner)).forEach((pp) => {
      const mw = pp.owner.parent ? pp.owner.parent.matrixWorld : pp.owner.matrixWorld;
      for (let i = 1; i < pp.pts.length; i++) segs.push([toScreen(pp.pts[i - 1].clone().applyMatrix4(mw)), toScreen(pp.pts[i].clone().applyMatrix4(mw))]);
    });
    live.forEach((r) => {
      const inner = { x0: r.x0 + 2, x1: r.x1 - 2, y0: r.y0 + 2, y1: r.y1 - 2 };
      if (segs.some(([p, q]) => hitsBox(p, q, inner, 0))) out.push(`"${r.t}" is crossed by a line`);
    });
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const A = live[i], B = live[j];
      const ix = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), iy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
      if (ix > 3 && iy > 3) out.push(`"${A.t}" overlaps "${B.t}"`);
    }
    return [...new Set(out)];
  };
  const floor = (w, d = 3) => {
    const grid = new THREE.GridHelper(w, Math.round(w * 2), palette.fg, palette.fg);
    grid.scale.z = d / w;
    own(grid.material, 0.12);
    return grid;
  };
  return {
    palette, P, owned, own, neutral, seriesColor, solid, flat, label, rod, dashes, floor, box, overlaps, collisions, path, hitsBox,
    fmt: chartFormat(P),
    /** Fade + per-handle alpha. Call once per frame. */
    apply(fade) {
      owned.forEach((h) => {
        const o = h.base * h.a * fade;
        h.m.opacity = o;
        if (h.opaque) { const tr = o < 0.995; if (h.m.transparent !== tr) { h.m.transparent = tr; h.m.depthWrite = !tr || o > 0.5; h.m.needsUpdate = true; } }
      });
    },
    materials() { return owned.map((h) => h.m); },
  };
}

/** Per-unit 0..1 progress with optional step reveal. */
function chartReveal(ctx, n, { stagger = 0.12, dur = 1.0 } = {}) {
  const P = ctx.params;
  // step mode: asked for, or implied when the slide declares scene steps (otherwise those presses would show nothing)
  const stepMode = P.reveal === 'step' || (P.reveal == null && Number(ctx.slide?.dataset.sceneSteps) > 0);
  const start = P.revealStart ?? 0;
  const p = new Array(n).fill(0), target = new Array(n).fill(stepMode ? 0 : 1), delay = new Array(n).fill(0);
  let k = 0;
  const setTargets = () => { for (let i = 0; i < n; i++) target[i] = stepMode ? (i < start + k ? 1 : 0) : 1; };
  setTargets();
  return {
    enter() { for (let i = 0; i < n; i++) { p[i] = 0; delay[i] = stepMode ? 0 : 0.2 + i * stagger; } setTargets(); },
    step(kk) { k = kk; setTargets(); },
    update(dt, info) {
      const m = info.motion < 1 ? 100 : 1;
      for (let i = 0; i < n; i++) {
        if (delay[i] > 0) { delay[i] -= dt * m; continue; }
        const d = target[i] - p[i];
        if (d) p[i] = d > 0 ? Math.min(target[i], p[i] + (dt * m) / dur) : Math.max(target[i], p[i] - (dt * m * 2) / dur);
      }
    },
    e: (i) => easeOutCubic(p[i] ?? 0),
    raw: (i) => p[i] ?? 0,
    get all() { return Math.min(...p.map((x) => x)); },
  };
}

/** A visually hidden data table, so screen readers get the numbers. */
function chartTable(ctx, caption, head, rows) {
  const el = ctx.slide;
  if (!el || el.querySelector('.ts-sr-table')) return;
  const t = document.createElement('table');
  t.className = 'ts-sr-only ts-sr-table';
  const esc = (x) => String(x ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  t.innerHTML = `<caption>${esc(caption)}</caption><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  el.appendChild(t);
}

/** Normalise {data:[{label,value,highlight}]} or {labels, series:[{name, values, highlight}]} into one shape. */
function chartSeries(P, sample) {
  if (Array.isArray(P.series) && P.series.length) {
    const n = Math.max(...P.series.map((s) => (s.values || []).length));
    const labels = P.labels ?? Array.from({ length: n }, (_, i) => String(i + 1));
    return { labels, series: P.series.map((s) => ({ name: s.name ?? '', values: s.values ?? [], highlight: !!s.highlight, low: s.low, high: s.high, hi: (s.highlightIndex ?? []).reduce((o, i) => ((o[i] = true), o), {}) })) };
  }
  const d = P.data ?? sample;
  return { labels: d.map((x) => x.label), series: [{ name: P.name ?? '', values: d.map((x) => x.value), highlight: false, hi: d.reduce((o, x, i) => (x.highlight && (o[i] = true), o), {}), low: d.some((x) => x.low != null) ? d.map((x) => x.low) : undefined, high: d.some((x) => x.high != null) ? d.map((x) => x.high) : undefined }] };
}

/* --- bars: 3D bar chart (vertical or horizontal; single, grouped, stacked, 100%) --- */
scenes.bars = (ctx) => {
  const K = chartKit(ctx);
  const { palette, P } = K;
  let { labels, series } = chartSeries(P, [{ label: 'A', value: 3 }, { label: 'B', value: 5 }, { label: 'C', value: 8 }, { label: 'D', value: 13 }]);
  const horiz = P.orientation === 'h' || P.orientation === 'horizontal';
  const nS = series.length;
  const mode = nS > 1 ? (P.mode ?? 'grouped') : 'single';
  const stacked = mode === 'stacked' || mode === 'percent';
  // sort (single series): reorder categories
  if (P.sort && nS === 1) {
    const s = series[0];
    const idx = labels.map((_, i) => i).sort((a, b) => (P.sort === 'asc' ? s.values[a] - s.values[b] : s.values[b] - s.values[a]));
    labels = idx.map((i) => labels[i]);
    s.values = idx.map((i) => s.values[i]);
    const hi = {}; idx.forEach((i, j) => { if (s.hi[i]) hi[j] = true; }); s.hi = hi;
  }
  const nC = labels.length;
  const val = (s, c) => {
    const v = Number(series[s].values[c] ?? 0);
    if (mode !== 'percent') return v;
    const tot = series.reduce((a, ss) => a + Math.abs(Number(ss.values[c] ?? 0)), 0) || 1;
    return (Math.abs(v) / tot) * 100;
  };
  const fmt = mode === 'percent' ? chartFormat({ ...P, unit: '%', decimals: P.decimals ?? 0 }) : K.fmt;
  // segments
  const segs = [];
  let lo = 0, hi = 0;
  for (let c = 0; c < nC; c++) {
    let pos = 0, neg = 0;
    for (let s = 0; s < nS; s++) {
      const v = val(s, c);
      let from = 0, to = v;
      if (stacked) { if (v >= 0) { from = pos; to = pos + v; pos = to; } else { from = neg; to = neg + v; neg = to; } }
      lo = Math.min(lo, from, to); hi = Math.max(hi, from, to);
      segs.push({ c, s, v, from, to });
    }
  }
  if (P.target != null) { lo = Math.min(lo, P.target); hi = Math.max(hi, P.target); }
  const L = horiz ? (P.length ?? 3.8) : (P.height ?? (P.delta || P.annotations ? 2.1 : 2.6));
  const k = L / ((hi - lo) || 1);
  const thick = horiz ? 0.42 : 0.62;
  const gap = P.gap ?? (horiz ? 0.66 : mode === 'grouped' ? 0.9 + nS * 0.5 : 1.05);
  const tb = mode === 'grouped' ? Math.min(thick * 0.85, (gap * 0.62) / nS) : thick;
  const span = (nC - 1) * gap;
  const g = new THREE.Group();
  const anyHiSeries = series.some((s) => s.highlight);
  const anyHiBar = nS === 1 && Object.keys(series[0].hi).length > 0;
  const colorOf = (s, c) => {
    if (nS === 1) {
      if (anyHiBar) return series[0].hi[c] ? palette.accent2.clone() : K.neutral.clone();
      return palette.accent.clone().lerp(palette.accent3, (c / Math.max(1, nC - 1)) * 0.6);
    }
    return K.seriesColor(s, anyHiSeries, series[s].highlight);
  };
  // geometry helpers: category axis position and value axis position
  const catPos = (c, s) => {
    const base = horiz ? (span / 2 - c * gap) : (c * gap - span / 2);
    const off = mode === 'grouped' ? (s - (nS - 1) / 2) * tb * 1.3 * (horiz ? -1 : 1) : 0;
    return base + off;
  };
  const vShift = horiz ? -((lo + hi) / 2) * k - 0.35 : 0; // centre horizontal charts (nudged left: value labels sit on the right)
  const vPos = (v) => v * k + vShift;
  // frame
  if (!horiz) g.add(K.floor(Math.max(span + 3, 4)));
  else g.add(K.rod(new THREE.Vector3(vPos(0), span / 2 + 0.45, 0), new THREE.Vector3(vPos(0), -span / 2 - 0.45, 0), 0.012, K.flat(palette.fg, 0.35)));
  const units = P.revealBy === 'series' ? nS : nC;
  const R = chartReveal(ctx, units);
  const unitOf = (seg) => (P.revealBy === 'series' ? seg.s : seg.c);
  const matCache = {};
  const bars = segs.map((seg) => {
    const key = `${seg.s}:${seg.c}`;
    const col = colorOf(seg.s, seg.c).multiplyScalar(horiz ? (anyHiBar && !series[0].hi[seg.c] ? 0.42 : 0.62) : 1);
    const h = matCache[key] || (matCache[key] = K.solid(col));
    const geo = horiz ? new THREE.BoxGeometry(1, tb, 0.5) : new THREE.BoxGeometry(tb, 1, tb);
    const m = new THREE.Mesh(geo, h.m);
    g.add(m);
    let lab = null;
    const showSegLabel = stacked ? P.segmentLabels !== false && Math.abs(seg.to - seg.from) * k > 0.34 : true;
    if (showSegLabel) {
      lab = K.label(fmt(seg.v), { height: stacked ? 0.2 : (mode === 'grouped' ? 0.24 : 0.3), font: 'display', weight: 700 });
      g.add(lab);
    }
    return { ...seg, m, lab };
  });
  // category labels
  labels.forEach((t, c) => {
    const l = K.label(t, { height: 0.22, color: palette.muted, weight: 500, align: horiz ? 'right' : 'center' });
    if (horiz) l.position.set(vPos(Math.min(0, lo)) - (lo < 0 ? 0.95 : 0.22), catPos(c, 0), 0.3);
    else l.position.set(catPos(c, 0), -0.32, 0.5);
    if (mode === 'grouped') horiz ? (l.position.y = span / 2 - c * gap) : (l.position.x = c * gap - span / 2);
    g.add(l);
  });
  // stack totals
  const totals = [];
  if (stacked && mode !== 'percent' && P.totals !== false) {
    for (let c = 0; c < nC; c++) {
      const top = Math.max(0, ...bars.filter((b) => b.c === c).map((b) => b.to));
      const sum = series.reduce((a, _, s) => a + val(s, c), 0);
      const l = K.label(fmt(sum), { height: 0.28, font: 'display', weight: 700 });
      totals.push({ c, top, l }); g.add(l);
    }
  }
  // legend
  if (nS > 1) {
    const lx0 = horiz ? vPos(lo) : -span / 2 - tb;
    const ly = horiz ? span / 2 + 0.75 : hi * k + 0.75;
    let x = lx0;
    series.forEach((s, i) => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.05), K.solid(colorOf(i, 0)).m);
      sw.position.set(x + 0.1, ly, 0); g.add(sw);
      const l = K.label(s.name, { height: 0.2, color: palette.text2 || palette.fg, weight: 500, align: 'left' });
      l.position.set(x + 0.3, ly, 0); g.add(l);
      x += 0.55 + s.name.length * 0.13;
    });
  }
  // target line
  let target = null;
  if (P.target != null) {
    const h = K.flat(palette.fg, 0.75);
    const a = horiz ? new THREE.Vector3(vPos(P.target), span / 2 + 0.4, 0.3) : new THREE.Vector3(-span / 2 - 0.6, P.target * k, 0.4);
    const b = horiz ? new THREE.Vector3(vPos(P.target), -span / 2 - 0.4, 0.3) : new THREE.Vector3(span / 2 + 0.6, P.target * k, 0.4);
    // final resting place of every value label, so the rule leaves gaps for them
    const avoid = bars.filter((bb) => bb.lab).map((bb) => {
      const end = bb.to >= 0 ? Math.max(bb.from, bb.to) * k : Math.min(bb.from, bb.to) * k, out = bb.to >= 0 ? 1 : -1;
      if (stacked) return K.box(bb.lab, horiz ? vShift + ((bb.from + bb.to) / 2) * k : catPos(bb.c, bb.s), horiz ? catPos(bb.c, bb.s) : ((bb.from + bb.to) / 2) * k);
      return horiz ? K.box(bb.lab, vShift + end + out * 0.2, catPos(bb.c, bb.s), out > 0 ? 0.08 : 0.92, 0.5) : K.box(bb.lab, catPos(bb.c, bb.s), end + out * 0.3);
    });
    totals.forEach((tt) => avoid.push(K.box(tt.l, catPos(tt.c, 0), tt.top * k + 0.32)));
    const line = K.dashes(a, b, 0.014, h, 0.16, 0.11, avoid);
    const l = K.label(P.targetLabel ?? `Target ${fmt(P.target)}`, { height: 0.2, color: palette.fg, weight: 600, align: horiz ? 'center' : 'left' });
    if (horiz) l.position.copy(a).add(new THREE.Vector3(0, 0.25, 0)); else l.position.copy(b).add(new THREE.Vector3(0.12, 0, 0));
    g.add(line, l); target = { h, l };
  }
  // delta bracket between two bars (single series, vertical)
  let delta = null;
  if (P.delta && nS === 1 && !horiz) {
    const { from: i0, to: i1 } = P.delta;
    const v0 = val(0, i0), v1 = val(0, i1);
    const y = Math.max(v0, v1, 0) * k + 0.85;
    const x0 = catPos(i0, 0), x1 = catPos(i1, 0);
    const h = K.flat(palette.accent2, 0.9);
    const grp = new THREE.Group();
    grp.add(K.rod(new THREE.Vector3(x0, v0 * k + 0.52, 0), new THREE.Vector3(x0, y, 0), 0.014, h));
    grp.add(K.rod(new THREE.Vector3(x1, v1 * k + 0.52, 0), new THREE.Vector3(x1, y, 0), 0.014, h));
    grp.add(K.rod(new THREE.Vector3(x0, y, 0), new THREE.Vector3(x1, y, 0), 0.014, h));
    const pct = v0 ? ((v1 - v0) / Math.abs(v0)) * 100 : 0;
    const text = P.delta.text ?? `${pct < 0 ? '−' : '+'}${Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`;
    const l = K.label(text, { height: 0.3, font: 'display', weight: 700, color: palette.accent2 });
    l.position.set((x0 + x1) / 2, y + 0.26, 0);
    g.add(grp, l); delta = { h, l, units: [i0, i1] };
  }
  // annotations: [{index, text}]
  const notes = (P.annotations ?? []).map((a) => {
    const l = K.label(a.text, { height: 0.21, color: palette.accent2, weight: 600, align: horiz ? 'left' : 'center' });
    g.add(l); return { ...a, l };
  });
  g.rotation.y = P.rotate ?? (horiz ? 0.12 : -0.32); // horizontal: the value end recedes, so long bars stay on stage
  chartTable(ctx, P.title ?? 'Chart data', ['', ...series.map((s, i) => s.name || `Series ${i + 1}`)], labels.map((t, c) => [t, ...series.map((_, s) => fmt(val(s, c)))]));
  return {
    object: g,
    camera: horiz ? { offset: [0, 0, 9], look: [0, 0, 0] } : { offset: [0, 1.7, 8.6], look: [0, 1.0, 0] },
    enter() { R.enter(); },
    step(n) { R.step(n); },
    update(t, dt, info) {
      R.update(dt, info);
      bars.forEach((b) => {
        const e = R.e(unitOf(b));
        const from = b.from * k * e, to = b.to * k * e;
        const len = Math.max(0.001, Math.abs(to - from));
        if (horiz) { b.m.scale.x = len; b.m.position.set(vShift + (from + to) / 2, catPos(b.c, b.s), 0); }
        else { b.m.scale.y = len; b.m.position.set(catPos(b.c, b.s), (from + to) / 2, 0); }
        b.m.visible = e > 0.002;
        if (b.lab) {
          const end = b.to >= 0 ? Math.max(from, to) : Math.min(from, to);
          const out = b.to >= 0 ? 1 : -1;
          if (stacked) horiz ? b.lab.position.set(vShift + (from + to) / 2, catPos(b.c, b.s), 0.4) : b.lab.position.set(catPos(b.c, b.s), (from + to) / 2, tb / 2 + 0.05);
          else if (horiz) { b.lab.position.set(vShift + end + out * 0.2, catPos(b.c, b.s), 0.3); b.lab.center.set(out > 0 ? 0.08 : 0.92, 0.5); }
          else b.lab.position.set(catPos(b.c, b.s), end + out * 0.3, 0.2);
          b.lab.userData.h.a = smooth01((R.raw(unitOf(b)) - 0.45) * 2.5);
        }
      });
      totals.forEach((tt) => { const e = R.e(P.revealBy === 'series' ? nS - 1 : tt.c); tt.l.position.set(catPos(tt.c, 0), tt.top * k * e + 0.32, 0.2); tt.l.userData.h.a = smooth01((R.raw(P.revealBy === 'series' ? nS - 1 : tt.c) - 0.6) * 3); });
      const allIn = smooth01((Math.min(...Array.from({ length: units }, (_, i) => R.raw(i))) - 0.5) * 2);
      if (target) { target.h.a = allIn; target.l.userData.h.a = allIn; }
      if (delta) { const a = smooth01((Math.min(R.raw(delta.units[0]), R.raw(delta.units[1])) - 0.7) * 3.3); delta.h.a = a; delta.l.userData.h.a = a; }
      notes.forEach((n) => {
        const b = bars.find((x) => x.c === n.index && x.s === (n.series ?? 0));
        if (!b) return;
        const e = R.e(unitOf(b));
        if (horiz) n.l.position.set(vShift + Math.max(b.from, b.to) * k * e + 1.0, catPos(b.c, b.s), 0.3);
        else n.l.position.set(catPos(b.c, b.s), Math.max(b.from, b.to, 0) * k * e + 0.68, 0.2);
        n.l.userData.h.a = smooth01((R.raw(unitOf(b)) - 0.7) * 3.3);
      });
      K.apply(info.fade);
      g.position.y = Math.sin(t * 0.6) * 0.04;
    },
    fadeManaged: K.materials(),
    collisions: (cam) => K.collisions(cam),
  };
};

/* --- line: time series, multi-series, with forecast (dotted) and confidence band --- */
scenes.line = (ctx) => {
  const K = chartKit(ctx);
  const { palette, P } = K;
  const { labels, series } = chartSeries(P, [{ label: 'Q1', value: 4 }, { label: 'Q2', value: 6 }, { label: 'Q3', value: 5 }, { label: 'Q4', value: 9 }]);
  const n = labels.length;
  const W = P.width ?? 7.6, H = P.height ?? 2.6;
  const fc = P.forecast != null ? Math.max(1, Math.min(n - 1, P.forecast)) : n; // first forecast index
  const all = series.flatMap((s) => [...s.values, ...(s.low ?? []), ...(s.high ?? [])]).filter((v) => v != null && Number.isFinite(Number(v))).map(Number);
  const dmin = Math.min(...all), dmax = Math.max(...all, P.target ?? -Infinity);
  const [nlo, nhi] = niceDomain(dmin >= 0 ? 0 : dmin, dmax);
  const ymin = P.min ?? nlo, ymax = P.max ?? nhi;
  const X = (i) => (n === 1 ? 0 : (i / (n - 1) - 0.5) * W);
  const Y = (v) => ((v - ymin) / ((ymax - ymin) || 1)) * H;
  const g = new THREE.Group();
  g.add(K.floor(W + 2));
  // y guides + ticks
  if (P.ticks !== false) {
    const gh = K.flat(palette.fg, 0.1);
    [0.5, 1].forEach((f) => {
      const v = ymin + (ymax - ymin) * f;
      g.add(K.rod(new THREE.Vector3(-W / 2 - 0.3, Y(v), -0.3), new THREE.Vector3(W / 2 + 0.3, Y(v), -0.3), 0.006, gh));
      const l = K.label(K.fmt(v), { height: 0.18, color: palette.muted, weight: 500, align: 'right' });
      l.position.set(-W / 2 - 0.4, Y(v), -0.3); g.add(l);
    });
    const l0 = K.label(K.fmt(ymin), { height: 0.18, color: palette.muted, weight: 500, align: 'right' });
    l0.position.set(-W / 2 - 0.4, 0.02, -0.3); g.add(l0);
  }
  // x labels
  const every = Math.ceil(n / 8);
  labels.forEach((t, i) => {
    if (i % every && i !== n - 1) return;
    const l = K.label(t, { height: 0.2, color: palette.muted, weight: 500 });
    l.position.set(X(i), -0.32, 0.4); g.add(l);
  });
  const anyHi = series.some((s) => s.highlight);
  const R = chartReveal(ctx, series.length, { stagger: 0.35, dur: 1.6 });
  const lines = series.map((s, si) => {
    const col = K.seriesColor(si, anyHi, s.highlight);
    const pts = s.values.map((v, i) => (v == null ? null : new THREE.Vector3(X(i), Y(Number(v)), 0)));
    const actual = pts.slice(0, fc).filter(Boolean);
    const h = K.solid(col, { emissive: 0.25 });
    let tube = null, idx = 0;
    if (actual.length > 1) {
      const path = new THREE.CurvePath();
      for (let i = 1; i < actual.length; i++) path.add(new THREE.LineCurve3(actual[i - 1], actual[i]));
      const geo = new THREE.TubeGeometry(path, (actual.length - 1) * 12, s.highlight || !anyHi ? 0.04 : 0.028, 8, false);
      idx = geo.index.count; geo.setDrawRange(0, 0);
      tube = new THREE.Mesh(geo, h.m); g.add(tube);
    }
    // forecast: dotted
    const dots = [];
    const fpts = pts.slice(Math.max(0, fc - 1)).filter(Boolean);
    const dotGeo = new THREE.SphereGeometry(0.03, 8, 8);
    for (let i = 1; i < fpts.length && fc < n; i++) {
      const a = fpts[i - 1], b = fpts[i], len = a.distanceTo(b);
      for (let d = 0.08; d < len; d += 0.15) { const m = new THREE.Mesh(dotGeo, h.m); m.position.copy(a).lerp(b, d / len); m.userData.u = (i - 1 + d / len) / Math.max(1, fpts.length - 1); g.add(m); dots.push(m); }
    }
    // band
    let band = null;
    if (s.low && s.high) {
      const verts = [];
      const ids = s.values.map((_, i) => i).filter((i) => s.low[i] != null && s.high[i] != null);
      for (let j = 1; j < ids.length; j++) {
        const a = ids[j - 1], b = ids[j];
        const p = [[X(a), Y(s.low[a])], [X(a), Y(s.high[a])], [X(b), Y(s.low[b])], [X(b), Y(s.high[b])]];
        verts.push(...p[0], -0.05, ...p[1], -0.05, ...p[2], -0.05, ...p[1], -0.05, ...p[3], -0.05, ...p[2], -0.05);
      }
      if (verts.length) {
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        band = { h: K.flat(col, 0.16) }; band.m = new THREE.Mesh(geo, band.h.m); g.add(band.m);
      }
    }
    // points: actual points small, highlighted bigger
    const nodes = pts.map((p, i) => {
      if (!p || i >= fc) return null;
      const big = !!s.hi[i];
      const m = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.11 : 0.06, 16, 16), big ? K.solid(palette.accent2, { emissive: 0.3 }).m : h.m);
      m.position.copy(p); m.userData.u = actual.length > 1 ? i / (actual.length - 1) : 1; g.add(m);
      let l = null;
      if (big) { l = K.label(K.fmt(Number(s.values[i])), { height: 0.26, font: 'display', weight: 700 }); l.position.copy(p).add(new THREE.Vector3(0, 0.34, 0.1)); g.add(l); }
      return { m, l };
    }).filter(Boolean);
    // end label: name + last value
    const li = s.values.length - 1;
    const endTxt = [s.name, K.fmt(Number(s.values[li]))].filter(Boolean).join(' · ');
    const end = K.label(endTxt, { height: 0.24, weight: 700, color: col, align: 'left' });
    end.position.copy(pts[li] ?? new THREE.Vector3()).add(new THREE.Vector3(0.18, 0, 0.1));
    g.add(end);
    const full = pts.filter(Boolean);
    if (full.length > 1) K.path(full, end);
    return { s, tube, idx, dots, band, nodes, end, hasFc: fc < n, full };
  });
  // nudge overlapping end labels apart
  const ends = lines.map((l) => l.end).sort((a, b) => a.position.y - b.position.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].position.y - ends[i - 1].position.y < 0.3) ends[i].position.y = ends[i - 1].position.y + 0.3;
  const notes = (P.annotations ?? []).map((a) => {
    const s = series[a.series ?? 0]; const v = Number(s?.values[a.index]);
    const l = K.label(a.text, { height: 0.21, color: palette.accent2, weight: 600 });
    l.position.set(X(a.index), Y(v) + 0.42, 0.1); g.add(l); return { ...a, l };
  });
  // forecast marker (built after the labels so its dashes leave gaps for them)
  const textLabels = [...lines.flatMap((ln) => [ln.end, ...ln.nodes.map((nd) => nd.l).filter(Boolean)]), ...notes.map((nn) => nn.l)];
  let fcMark = null;
  if (fc < n) {
    const h = K.flat(palette.fg, 0.3);
    const x = X(fc - 1);
    const r = K.dashes(new THREE.Vector3(x, 0, -0.2), new THREE.Vector3(x, H + 0.3, -0.2), 0.008, h, 0.1, 0.1, textLabels);
    const l = K.label(P.forecastLabel ?? 'Forecast →', { height: 0.19, color: palette.muted, weight: 600, align: 'left' });
    l.position.set(x + 0.12, H + 0.3, -0.2);
    g.add(r, l); fcMark = { h, l };
  }
  let target = null;
  if (P.target != null) {
    const h = K.flat(palette.fg, 0.7);
    const avoid = [...lines.flatMap((ln) => [ln.end, ...ln.nodes.map((nd) => nd.l).filter(Boolean)]), ...notes.map((nn) => nn.l)];
    const line = K.dashes(new THREE.Vector3(-W / 2, Y(P.target), 0.05), new THREE.Vector3(W / 2, Y(P.target), 0.05), 0.012, h, 0.16, 0.11, avoid);
    const l = K.label(P.targetLabel ?? `Target ${K.fmt(P.target)}`, { height: 0.19, color: palette.fg, weight: 600, align: 'right' });
    // first spot where the label crosses no series line and no other label
    const ty = Y(P.target), others = textLabels.map((x) => K.box(x));
    const spots = [[W / 2, ty + 0.2, 0.92], [W / 2, ty - 0.2, 0.92], [-W / 2, ty + 0.2, 0.08], [-W / 2, ty - 0.2, 0.08]];
    const ok = ([x, y, cx]) => { const b = K.box(l, x, y, cx, 0.5); return !lines.some((ln) => ln.full.some((p, i) => i && K.hitsBox(ln.full[i - 1], p, b, 0.04))) && !others.some((o) => K.overlaps(b, o)); };
    const [tx, ty2, tcx] = spots.find(ok) ?? spots[0];
    l.center.set(tcx, 0.5); l.position.set(tx, ty2, 0.05); g.add(line, l); target = { h, l };
  }
  g.rotation.y = P.rotate ?? -0.2;
  chartTable(ctx, P.title ?? 'Chart data', ['', ...series.map((s, i) => s.name || `Series ${i + 1}`)], labels.map((t, i) => [t + (i >= fc ? ' (forecast)' : ''), ...series.map((s) => K.fmt(Number(s.values[i])))]));
  return {
    object: g,
    camera: { offset: [0, 1.5, 9], look: [0, 1.1, 0] },
    enter() { R.enter(); },
    step(k) { R.step(k); },
    update(t, dt, info) {
      R.update(dt, info);
      lines.forEach((ln, si) => {
        const p = R.raw(si);
        const share = ln.hasFc ? (fc - 1) / Math.max(1, n - 1) : 1; // part of the draw spent on actuals
        const pa = smooth01(p / Math.max(0.01, share) * 0.999);
        const pf = ln.hasFc ? smooth01((p - share) / Math.max(0.01, 1 - share)) : 0;
        if (ln.tube) ln.tube.geometry.setDrawRange(0, Math.floor((ln.idx * pa) / 3) * 3);
        ln.dots.forEach((d) => { d.visible = d.userData.u <= pf; });
        ln.nodes.forEach((nd) => { nd.m.visible = nd.m.userData.u <= pa + 0.001; if (nd.l) nd.l.userData.h.a = nd.m.visible ? smooth01((p - 0.5) * 2) : 0; });
        if (ln.band) ln.band.h.a = smooth01((p - 0.3) * 2);
        ln.end.userData.h.a = smooth01((p - 0.85) * 6.6);
      });
      const done = Math.min(...series.map((_, i) => R.raw(i)));
      notes.forEach((nn) => { nn.l.userData.h.a = smooth01((R.raw(nn.series ?? 0) - 0.8) * 5); });
      if (target) { const a = smooth01((done - 0.3) * 2); target.h.a = a; target.l.userData.h.a = a; }
      if (fcMark) { const a = smooth01((done - 0.4) * 2); fcMark.h.a = a; fcMark.l.userData.h.a = a; }
      K.apply(info.fade);
    },
    fadeManaged: K.materials(),
    collisions: (cam) => K.collisions(cam),
  };
};

/* --- waterfall: start → ups and downs → end (bridges) ------------------------------ */
scenes.waterfall = (ctx) => {
  const K = chartKit(ctx);
  const { palette, P } = K;
  const data = P.data ?? [{ label: 'Start', value: 100 }, { label: 'Price', value: 18 }, { label: 'Volume', value: 12 }, { label: 'Cost', value: -9 }, { label: 'End', value: 121 }];
  const n = data.length;
  const isTotal = (d, i) => d.total ?? (P.autoTotals !== false && (i === 0 || i === n - 1));
  let run = 0, lo = 0, hi = 0;
  const segs = data.map((d, i) => {
    const v = Number(d.value);
    let from, to;
    if (isTotal(d, i)) { from = 0; to = v; run = v; } else { from = run; to = run + v; run = to; }
    lo = Math.min(lo, from, to); hi = Math.max(hi, from, to);
    return { ...d, v, from, to, total: isTotal(d, i), i };
  });
  const H = P.height ?? 2.6, k = H / ((hi - lo) || 1);
  const gap = P.gap ?? 1.2, tb = 0.6, span = (n - 1) * gap;
  const good = P.good ?? 'up';
  const upCol = good === 'up' ? palette.accent : palette.accent2;
  const downCol = good === 'up' ? palette.accent2 : palette.accent;
  const totalCol = K.neutral.clone().multiplyScalar(0.72);
  const g = new THREE.Group();
  g.add(K.floor(Math.max(span + 3, 4)));
  const R = chartReveal(ctx, n, { stagger: 0.22, dur: 0.8 });
  const conH = K.flat(palette.fg, 0.4);
  const bars = segs.map((s) => {
    const col = s.highlight ? palette.accent3 : s.total ? totalCol : s.v >= 0 ? upCol : downCol;
    const m = new THREE.Mesh(new THREE.BoxGeometry(tb, 1, tb), K.solid(col).m);
    const x = s.i * gap - span / 2;
    const lab = K.label(s.total ? K.fmt(s.v) : K.fmt(s.v, { sign: true }), { height: 0.24, font: 'display', weight: 700, color: s.total ? palette.fg : (s.v >= 0 ? upCol : downCol).clone().lerp(palette.fg, 0.35) });
    const cat = K.label(s.label, { height: 0.21, color: palette.muted, weight: 500 });
    cat.position.set(x, -0.32, 0.5);
    g.add(m, lab, cat);
    let con = null;
    if (s.i < n - 1) {
      const lvl = s.to * k, x1 = (s.i + 1) * gap - span / 2;
      con = K.rod(new THREE.Vector3(x + tb / 2, lvl, 0), new THREE.Vector3(x1 - tb / 2, lvl, 0), 0.01, conH);
      con.scale.y = 1; g.add(con);
    }
    return { ...s, m, x, lab, con };
  });
  g.rotation.y = P.rotate ?? -0.24;
  chartTable(ctx, P.title ?? 'Waterfall', ['Step', 'Change', 'Running total'], segs.map((s) => [s.label, s.total ? '' : K.fmt(s.v, { sign: true }), K.fmt(s.to)]));
  return {
    object: g,
    camera: { offset: [0, 1.7, 8.6], look: [0, 1.0, 0] },
    enter() { R.enter(); },
    step(kk) { R.step(kk); },
    update(t, dt, info) {
      R.update(dt, info);
      bars.forEach((b) => {
        const e = R.e(b.i);
        // totals grow from the floor; deltas drop in from above their final place
        const len = Math.max(0.001, Math.abs(b.to - b.from) * k * (b.total ? e : 1));
        const mid = ((b.from + b.to) / 2) * k;
        b.m.scale.y = len;
        b.m.position.set(b.x, b.total ? len / 2 * Math.sign(b.to || 1) : mid + (1 - e) * 1.2, 0);
        b.m.visible = R.raw(b.i) > 0.002;
        b.m.material.opacity = 1;
        b.lab.position.set(b.x, Math.max(b.from, b.to) * k + 0.3 + (b.total ? 0 : (1 - e) * 1.2), 0.2);
        b.lab.userData.h.a = smooth01((R.raw(b.i) - 0.5) * 2.5);
        if (b.con) b.con.visible = R.raw(b.i + 1) > 0.5;
      });
      K.apply(info.fade);
    },
    fadeManaged: K.materials(),
    collisions: (cam) => K.collisions(cam),
  };
};

/* --- scatter / matrix: points on two axes; matrix adds 2×2 quadrants ---------------- */
function xyChart(ctx, kind) {
  const K = chartKit(ctx);
  const { palette, P } = K;
  const isMatrix = kind === 'matrix';
  // items: [{label, x, y, size, highlight, series}] or series: [{name, points:[...]}]
  let items = P.items ?? [];
  const seriesNames = [];
  if (Array.isArray(P.series)) P.series.forEach((s, si) => { seriesNames.push(s.name ?? ''); (s.points ?? []).forEach((p) => items.push({ ...p, series: si, highlight: p.highlight ?? s.highlight })); });
  if (!items.length) items = [{ label: 'A', x: 0.2, y: 0.7 }, { label: 'B', x: 0.75, y: 0.8, highlight: true }, { label: 'C', x: 0.35, y: 0.25 }, { label: 'D', x: 0.8, y: 0.3 }];
  const ax = P.x ?? {}, ay = P.y ?? {};
  const domain = (axis, key) => {
    if (axis.domain) return axis.domain;
    const vs = items.map((it) => Number(it[key]));
    const mn = Math.min(...vs), mx = Math.max(...vs);
    if (isMatrix) return mn >= 0 && mx <= 1 ? [0, 1] : [0, Math.ceil(mx)];
    const pad = (mx - mn || 1) * 0.08;
    const [a, b] = niceDomain(mn - pad, mx + pad, 4);
    return [a, b];
  };
  const [x0, x1] = domain(ax, 'x'), [y0, y1] = domain(ay, 'y');
  const W = P.width ?? (isMatrix ? 4.6 : 4.8), H = P.height ?? (isMatrix ? 3.8 : 3.6);
  const X = (v) => ((v - x0) / ((x1 - x0) || 1) - 0.5) * W;
  const Y = (v) => ((v - y0) / ((y1 - y0) || 1) - 0.5) * H;
  const g = new THREE.Group();
  const frameH = K.flat(palette.fg, 0.32);
  const r = 0.01;
  const c = [new THREE.Vector3(-W / 2, -H / 2, 0), new THREE.Vector3(W / 2, -H / 2, 0), new THREE.Vector3(W / 2, H / 2, 0), new THREE.Vector3(-W / 2, H / 2, 0)];
  if (isMatrix) for (let i = 0; i < 4; i++) g.add(K.rod(c[i], c[(i + 1) % 4], r, frameH));
  else { g.add(K.rod(c[0], c[1], r * 1.4, K.flat(palette.fg, 0.5))); g.add(K.rod(c[0], c[3], r * 1.4, K.flat(palette.fg, 0.5))); }
  if (isMatrix) {
    const mid = K.flat(palette.fg, 0.45);
    g.add(K.rod(new THREE.Vector3(0, -H / 2, 0), new THREE.Vector3(0, H / 2, 0), r * 1.3, mid));
    g.add(K.rod(new THREE.Vector3(-W / 2, 0, 0), new THREE.Vector3(W / 2, 0, 0), r * 1.3, mid));
    const quads = P.quadrants ?? [];
    const pos = [[-1, 1], [1, 1], [-1, -1], [1, -1]]; // TL, TR, BL, BR
    const focus = { 'top-left': 0, 'top-right': 1, 'bottom-left': 2, 'bottom-right': 3 }[P.focus] ?? (typeof P.focus === 'number' ? P.focus : -1);
    pos.forEach(([sx, sy], i) => {
      if (i === focus) {
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(W / 2, H / 2), K.flat(palette.accent, 0.1).m);
        plane.position.set((sx * W) / 4, (sy * H) / 4, -0.02); g.add(plane);
      }
      if (quads[i]) {
        const l = K.label(quads[i], { height: 0.21, weight: 600, color: i === focus ? palette.accent : palette.muted, align: sx < 0 ? 'left' : 'right' });
        l.position.set(sx * (W / 2 - 0.15), sy * (H / 2 - 0.22), 0.02); g.add(l);
      }
    });
  }
  // axis titles and end labels
  if (ax.label) { const l = K.label(`${ax.label} →`, { height: 0.22, weight: 600, color: palette.fg }); l.position.set(0, -H / 2 - 0.5, 0); g.add(l); }
  if (ay.label) { const l = K.label(`↑ ${ay.label}`, { height: 0.22, weight: 600, color: palette.fg, align: 'left' }); l.position.set(-W / 2 - 0.05, H / 2 + 0.34, 0); g.add(l); }
  const endLabels = (axis, horizAxis) => {
    const fmtA = chartFormat({ ...P, ...axis });
    const lowT = axis.low ?? (isMatrix ? null : fmtA(horizAxis ? x0 : y0));
    const highT = axis.high ?? (isMatrix ? null : fmtA(horizAxis ? x1 : y1));
    [[lowT, -1], [highT, 1]].forEach(([t, s]) => {
      if (t == null) return;
      const l = K.label(t, { height: 0.18, color: palette.muted, weight: 500, align: horizAxis ? (s < 0 ? 'left' : 'right') : 'right' });
      if (horizAxis) l.position.set((s * W) / 2, -H / 2 - 0.24, 0); else l.position.set(-W / 2 - 0.14, (s * H) / 2 - s * 0.1, 0);
      g.add(l);
    });
  };
  endLabels(ax, true); endLabels(ay, false);
  // points
  const sizes = items.map((it) => Number(it.size ?? 0));
  const smax = Math.max(...sizes, 0);
  const anyHi = items.some((it) => it.highlight);
  const R = chartReveal(ctx, isMatrix ? items.length : Math.max(1, seriesNames.length || 1), { stagger: isMatrix ? 0.18 : 0.3, dur: 1.0 });
  const dots = items.map((it, i) => {
    const rad = smax > 0 ? 0.09 + Math.sqrt(Math.max(0, it.size ?? 0) / smax) * 0.3 : (isMatrix ? 0.16 : 0.09);
    const col = it.highlight ? palette.accent2 : anyHi ? K.neutral.clone().lerp(palette.fg, 0.25) : K.seriesColor(it.series ?? 0, false, false);
    const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 24, 24), K.solid(col, { emissive: it.highlight ? 0.3 : 0.1 }).m);
    const to = new THREE.Vector3(X(Number(it.x)), Y(Number(it.y)), 0.1);
    g.add(m);
    let l = null;
    if (it.label) {
      let flip = to.x > W * 0.12; // labels on the right half sit left of their dot, so they stay inside the plot
      l = K.label(it.label, { height: isMatrix ? 0.22 : 0.19, weight: it.highlight ? 700 : 500, color: it.highlight ? palette.fg : palette.text2 ?? palette.fg, align: flip ? 'right' : 'left' });
      const place = (f) => { l.center.set(f ? 0.92 : 0.08, 0.5); l.position.copy(to).add(new THREE.Vector3(f ? -(rad + 0.1) : rad + 0.1, 0, 0.1)); };
      const crosses = () => { const b = K.box(l); return (isMatrix && b.x0 < 0.04 && b.x1 > -0.04) || b.x0 < -W / 2 + 0.04 || b.x1 > W / 2 - 0.04; };
      const placeV = (up) => {
        l.center.set(0.5, 0.5); l.position.copy(to).add(new THREE.Vector3(0, up ? rad + 0.2 : -(rad + 0.2), 0.1));
        // slide sideways to stay inside the dot's half (matrix) or the plot
        const bw = K.box(l).x1 - K.box(l).x0, m = 0.08;
        const lo = (isMatrix && to.x > 0 ? m : -W / 2 + m) + bw / 2, hi = (isMatrix && to.x < 0 ? -m : W / 2 - m) - bw / 2;
        if (lo <= hi) l.position.x = Math.min(hi, Math.max(lo, l.position.x));
      };
      // try: beside (preferred side), beside (other side), above, below
      const tries = [() => place(flip), () => place(!flip), () => placeV(true), () => placeV(false)];
      tries.find((t) => { t(); return !crosses(); }) || tries[0]();
      if (isMatrix) { const b = K.box(l); if (b.y0 < 0.04 && b.y1 > -0.04) l.position.y += (to.y >= 0 ? 1 : -1) * ((b.y1 - b.y0) / 2 + 0.06); }
      g.add(l);
    }
    return { it, m, l, to, unit: isMatrix ? i : (it.series ?? 0) };
  });
  // nudge labels that overlap each other (sprites: scale = world size, center = anchor)
  const boxes = [];
  dots.filter((d) => d.l).sort((a, b) => b.to.y - a.to.y).forEach((d) => {
    const l = d.l, w = l.scale.x * 0.9, h = l.scale.y * 0.66;
    const box = () => ({ x0: l.position.x - w * l.center.x, x1: l.position.x + w * (1 - l.center.x), y0: l.position.y - h / 2, y1: l.position.y + h / 2 });
    for (let tries = 0; tries < 6; tries++) {
      const b = box();
      const hit = boxes.find((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
      if (!hit) break;
      l.position.y = hit.y0 - h / 2 - 0.05;
    }
    boxes.push(box());
  });
  // legend for scatter series
  if (seriesNames.length > 1) {
    let x = -W / 2 + (ay.label ? 1.6 : 0);
    seriesNames.forEach((name, si) => {
      const l = K.label(`● ${name}`, { height: 0.2, weight: 600, color: K.seriesColor(si, false, false), align: 'left' });
      l.position.set(x, H / 2 + 0.4, 0); g.add(l); x += 0.6 + name.length * 0.13;
    });
  }
  // trend line (least squares over all points)
  let trend = null;
  if (P.trend) {
    const xs = items.map((it) => Number(it.x)), ys = items.map((it) => Number(it.y));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const sl = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
    const yAt = (x) => my + sl * (x - mx);
    const clampY = (v) => Math.max(y0, Math.min(y1, v));
    const h = K.flat(palette.accent2, 0.85);
    trend = { h, m: K.dashes(new THREE.Vector3(X(x0), Y(clampY(yAt(x0))), 0.05), new THREE.Vector3(X(x1), Y(clampY(yAt(x1))), 0.05), 0.014, h, 0.16, 0.11, dots.map((d) => d.l).filter(Boolean)) };
    g.add(trend.m);
  }
  g.rotation.y = P.rotate ?? -0.14;
  chartTable(ctx, P.title ?? 'Chart data', ['Item', ax.label ?? 'x', ay.label ?? 'y', ...(smax ? ['Size'] : [])], items.map((it) => [it.label ?? '', it.x, it.y, ...(smax ? [it.size ?? ''] : [])]));
  return {
    object: g,
    camera: { offset: [0, 0, 9.4], look: [0, 0, 0] },
    enter() { R.enter(); },
    step(k) { R.step(k); },
    update(t, dt, info) {
      R.update(dt, info);
      dots.forEach((d) => {
        const e = R.e(d.unit);
        d.m.position.set(d.to.x * e, d.to.y * e, d.to.z + (1 - e) * 1.5);
        d.m.scale.setScalar(Math.max(0.001, e));
        if (d.l) d.l.userData.h.a = smooth01((R.raw(d.unit) - 0.6) * 2.5);
      });
      if (trend) trend.h.a = smooth01((Math.min(...dots.map((d) => R.raw(d.unit))) - 0.7) * 3.3);
      K.apply(info.fade);
    },
    fadeManaged: K.materials(),
    collisions: (cam) => K.collisions(cam),
  };
}
scenes.scatter = (ctx) => xyChart(ctx, 'scatter');
scenes.matrix = (ctx) => xyChart(ctx, 'matrix');

/* --- gantt: workstreams over time, milestones, today line ------------------------- */
scenes.gantt = (ctx) => {
  const K = chartKit(ctx);
  const { palette, P } = K;
  const periods = P.periods ?? ['Q1', 'Q2', 'Q3', 'Q4'];
  const rows = P.rows ?? [{ label: 'Discovery', start: 0, end: 1 }, { label: 'Build', start: 0.8, end: 2.6, highlight: true }, { label: 'Rollout', start: 2.4, end: 4 }];
  const nP = periods.length;
  const W = P.width ?? 9, labelW = P.labelWidth ?? 2.4, rowH = P.rowHeight ?? 0.56;
  const TW = W - labelW;
  const X = (tt) => -W / 2 + labelW + (tt / nP) * TW;
  const top = ((rows.length - 1) * rowH) / 2;
  const RY = (i) => top - i * rowH;
  const g = new THREE.Group();
  const gridH = K.flat(palette.fg, 0.14);
  for (let i = 0; i <= nP; i++) g.add(K.rod(new THREE.Vector3(X(i), top + rowH * 0.7, -0.1), new THREE.Vector3(X(i), RY(rows.length - 1) - rowH * 0.7, -0.1), 0.006, gridH));
  const periodLabels = periods.map((p, i) => { const l = K.label(p, { height: 0.2, color: palette.muted, weight: 600 }); l.position.set(X(i + 0.5), top + rowH * 0.95, 0); g.add(l); return l; });
  const anyHi = rows.some((r) => r.highlight);
  const R = chartReveal(ctx, rows.length, { stagger: 0.16, dur: 0.9 });
  const bars = rows.map((r, i) => {
    const col = r.highlight ? palette.accent2 : anyHi ? palette.accent.clone().lerp(K.neutral, 0.45) : palette.accent;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, rowH * 0.56, 0.16), K.solid(col, { emissive: r.highlight ? 0.2 : 0.08 }).m);
    g.add(m);
    const l = K.label(r.label, { height: 0.22, weight: r.highlight ? 700 : 500, color: r.highlight ? palette.fg : palette.text2 ?? palette.fg, align: 'right' });
    l.position.set(-W / 2 + labelW - 0.22, RY(i), 0); g.add(l);
    let note = null;
    if (r.note) { note = K.label(r.note, { height: 0.18, weight: 500, color: palette.muted, align: 'left' }); g.add(note); }
    return { r, i, m, note };
  });
  const lane = RY(rows.length - 1) - rowH * 1.1;
  const ms = (P.milestones ?? []).map((mm) => {
    const y = mm.row != null ? RY(mm.row) : lane;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), K.solid(palette.accent2, { emissive: 0.3 }).m);
    m.position.set(X(mm.at), y, 0.15); m.rotation.z = Math.PI / 4;
    const l = K.label(mm.label, { height: 0.19, weight: 600, color: palette.fg });
    l.position.set(X(mm.at), y + (mm.row != null ? 0.32 : -0.3), 0.15);
    g.add(m, l); return { m, l };
  });
  let today = null;
  if (P.today != null) {
    const h = K.flat(palette.accent2, 0.8);
    const line = K.dashes(new THREE.Vector3(X(P.today), top + rowH * 0.6, 0.2), new THREE.Vector3(X(P.today), RY(rows.length - 1) - rowH * 0.6, 0.2), 0.012, h, 0.12, 0.09, ms.map((m) => m.l));
    const l = K.label(P.todayLabel ?? 'Today', { height: 0.19, weight: 700, color: palette.accent2, align: 'left' });
    const others = [...ms.map((m) => K.box(m.l)), ...periodLabels.map((pl) => K.box(pl))];
    const spots = [[X(P.today) + 0.08, RY(rows.length - 1) - rowH * 0.6 - 0.2], [X(P.today) + 0.08, top + rowH * 0.6 + 0.05], [X(P.today) + 0.08, lane - 0.62]];
    const free = spots.find(([x, y]) => !others.some((o) => K.overlaps(K.box(l, x, y), o))) ?? spots[0];
    l.position.set(free[0], free[1], 0.2);
    g.add(line, l); today = { h, l };
  }
  g.rotation.y = P.rotate ?? -0.1;
  chartTable(ctx, P.title ?? 'Roadmap', ['Workstream', 'Start', 'End'], rows.map((r) => [r.label, periods[Math.floor(r.start)] ?? r.start, periods[Math.ceil(r.end) - 1] ?? r.end]));
  return {
    object: g,
    camera: { offset: [0, 0, 9.2], look: [0, 0, 0] },
    enter() { R.enter(); },
    step(k) { R.step(k); },
    update(t, dt, info) {
      R.update(dt, info);
      bars.forEach((b) => {
        const e = R.e(b.i);
        const x0 = X(b.r.start), len = Math.max(0.001, (X(b.r.end) - x0) * e);
        b.m.scale.x = len; b.m.position.set(x0 + len / 2, RY(b.i), 0); b.m.visible = e > 0.002;
        if (b.note) { b.note.position.set(x0 + len + 0.14, RY(b.i), 0.1); b.note.userData.h.a = smooth01((R.raw(b.i) - 0.7) * 3.3); }
      });
      const done = Math.min(...rows.map((_, i) => R.raw(i)));
      ms.forEach((m) => { const a = smooth01((done - 0.5) * 2); m.m.scale.setScalar(Math.max(0.001, a)); m.l.userData.h.a = a; });
      if (today) { const a = smooth01((done - 0.3) * 2); today.h.a = a; today.l.userData.h.a = a; }
      K.apply(info.fade);
    },
    fadeManaged: K.materials(),
    collisions: (cam) => K.collisions(cam),
  };
};

/* --- network: constellation graph with travelling pulses ---------------- */
scenes.network = (ctx) => {
  const { palette, params } = ctx;
  const rnd = sceneRng(params.seed ?? 3);
  const n = params.nodes ?? 150;
  const R = params.radius ?? 2.8;
  const nodes = [];
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(R * Math.cbrt(rnd()));
    nodes.push(v);
  }
  const pos = new Float32Array(n * 3); nodes.forEach((v, i) => v.toArray(pos, i * 3));
  const pts = makePoints(ctx, pos, (i, c) => c.copy(paletteColor(palette, i)), { size: 9, scaleFn: () => 0.5 + rnd() });
  const linkDist = params.linkDistance ?? 1.15;
  const seg = []; const edges = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (nodes[i].distanceTo(nodes[j]) < linkDist) { seg.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z); edges.push([i, j]); }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: palette.fg, transparent: true, opacity: palette.isLight ? 0.18 : 0.22 }));
  const P = Math.min(edges.length, params.pulses ?? 60);
  const pulses = Array.from({ length: P }, () => ({ e: edges[Math.floor(rnd() * edges.length)], t: rnd(), s: 0.3 + rnd() * 0.6 }));
  const pulsePos = new Float32Array(P * 3);
  const pulsePts = makePoints(ctx, pulsePos, () => {}, { size: 11 });
  pulsePts.geometry.attributes.aColor.array.fill(1);
  const pc = palette.accent2; for (let i = 0; i < P; i++) pulsePts.geometry.attributes.aColor.array.set([pc.r, pc.g, pc.b], i * 3);
  const g = new THREE.Group(); g.add(lines, pts, pulsePts);
  const tmp = new THREE.Vector3();
  return {
    object: g,
    camera: { offset: [0, 0, 8.5], look: [0, 0, 0] },
    update(t, dt, info) {
      g.rotation.y += dt * 0.08 * info.motion; g.rotation.x = Math.sin(t * 0.15) * 0.2;
      if (!edges.length) return;
      pulses.forEach((p, i) => {
        p.t += dt * p.s * info.motion;
        if (p.t > 1) { p.t = 0; p.e = edges[Math.floor(Math.random() * edges.length)]; }
        tmp.lerpVectors(nodes[p.e[0]], nodes[p.e[1]], p.t).toArray(pulsePos, i * 3);
      });
      pulsePts.geometry.attributes.position.needsUpdate = true;
    },
  };
};

/* --- knot: glossy iridescent torus knot (premium hero object) ----------- */
scenes.knot = (ctx) => {
  const { palette, params } = ctx;
  const mat = new THREE.MeshPhysicalMaterial({
    color: palette.accent.clone().multiplyScalar(palette.isLight ? 1 : 0.45), metalness: 0.65, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12,
    iridescence: params.iridescence ?? 0.8, iridescenceIOR: 1.35, envMapIntensity: 0.8,
  });
  const mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(1.05, 0.34, 320, 48, params.p ?? 2, params.q ?? 3), mat);
  const rnd = sceneRng(params.seed ?? 9);
  const halo = makePoints(ctx, fibonacciSphere(1200, 2.9, undefined, 1.2, rnd), (i, c) => c.copy(paletteColor(palette, i)), { size: 2.0, opacity: 0.55 });
  const g = new THREE.Group(); g.add(mesh, halo);
  return {
    object: g,
    camera: { offset: [0, 0, 8], look: [0, 0, 0] },
    update(t, dt, info) { mesh.rotation.x += dt * 0.25 * info.motion; mesh.rotation.y += dt * 0.35 * info.motion; halo.rotation.y -= dt * 0.05 * info.motion; },
  };
};

/* --- blob: organic, breathing shader sphere ----------------------------- */
scenes.blob = (ctx) => {
  const { palette, params } = ctx;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: ctx.shared.uTime, uFade: { value: 0 }, uAmp: { value: params.amplitude ?? 0.32 },
      uA: { value: palette.accent.clone() }, uB: { value: palette.accent2.clone() }, uC: { value: palette.accent3.clone() },
      uLight: { value: palette.isLight ? 1 : 0 }, uBrightness: { value: 1 },
    },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uAmp; varying vec3 vN; varying vec3 vV; varying float vD;
      float field(vec3 p){ float t = uTime*0.55;
        return sin(p.x*2.1+t)*sin(p.y*1.7+t*1.3)*sin(p.z*2.3+t*0.7) + 0.5*sin(p.x*3.7-t*1.1+p.z*2.9)*sin(p.y*3.1+t*0.8); }
      void main(){ vec3 p = position; float d = field(normal*1.3); vD = d; p += normal * d * uAmp;
        vec4 mv = modelViewMatrix * vec4(p,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uFade; uniform float uLight; uniform float uBrightness;
      varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
        vec3 col = mix(uA, uB, smoothstep(-0.8, 0.9, vD)); col = mix(col, uC, fres*0.8);
        col *= mix(0.42 + fres*0.55, 0.85 + fres*0.4, uLight);
        gl_FragColor = vec4(col * uBrightness, uFade);
        #include <colorspace_fragment>
      }`,
    transparent: true,
  });
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(params.radius ?? 1.9, 72), mat);
  const g = new THREE.Group(); g.add(mesh);
  return {
    object: g,
    camera: { offset: [0, 0, 8], look: [0, 0, 0] },
    update(t, dt, info) { mesh.rotation.y += dt * 0.15 * info.motion; mesh.rotation.z = Math.sin(t * 0.3) * 0.2; },
  };
};

/* --- tunnel: flying through rings (section dividers) ------------------- */
scenes.tunnel = (ctx) => {
  const { palette, params } = ctx;
  const rings = params.rings ?? 34;
  const depth = params.depth ?? 70;
  const g = new THREE.Group();
  const circle = new THREE.EllipseCurve(0, 0, 1, 1).getPoints(96).map((p) => new THREE.Vector3(p.x, p.y, 0));
  const ringGeo = new THREE.BufferGeometry().setFromPoints(circle);
  const list = [];
  for (let i = 0; i < rings; i++) {
    const m = new THREE.LineLoop(ringGeo, new THREE.LineBasicMaterial({ color: paletteColor(palette, i), transparent: true, opacity: 0.9 }));
    const r = (params.radius ?? 3.4) * (1 + Math.sin(i * 0.7) * 0.08);
    m.scale.set(r, r, 1);
    g.add(m);
    list.push({ m, z: -(i / rings) * depth });
  }
  return {
    object: g,
    camera: { offset: [0, 0, 6], look: [0, 0, -10] },
    update(t, dt, info) {
      list.forEach((r, i) => {
        r.z += dt * (params.speed ?? 9) * info.motion;
        if (r.z > 5) r.z -= depth;
        r.m.position.set(Math.sin(r.z * 0.06 + t * 0.4) * 0.8, Math.cos(r.z * 0.05 + t * 0.3) * 0.5, r.z);
        r.m.rotation.z = r.z * 0.02;
        const near = smooth01((r.z + depth) / (depth * 0.6)) * (1 - smooth01((r.z - 1) / 4));
        r.m.material.opacity = 0.9 * near * info.fade;
      });
    },
    fadeManaged: list.map((r) => r.m.material),
  };
};

/* --- cubes: instanced field of cubes rippling like data ------------------ */
scenes.cubes = (ctx) => {
  const { palette, params } = ctx;
  const N = params.grid ?? 22;
  const s = params.spacing ?? 0.42;
  const geo = new THREE.BoxGeometry(s * 0.78, 1, s * 0.78); geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.3 });
  const dim = palette.isLight ? 1 : 0.32;
  const mesh = new THREE.InstancedMesh(geo, mat, N * N);
  const dummy = new THREE.Object3D(); const col = new THREE.Color();
  const g = new THREE.Group(); g.add(mesh);
  const half = (N - 1) * s / 2;
  return {
    object: g,
    camera: { offset: [0, 4.6, 10.5], look: [0, -0.8, 0] },
    update(t, dt, info) {
      const tt = t * (info.motion < 1 ? 0.2 : 1);
      let k = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = i * s - half, z = j * s - half;
        const d = Math.hypot(x, z);
        const h = 0.15 + (Math.sin(d * 1.5 - tt * 2.2) * 0.5 + 0.5) * (params.amplitude ?? 1.4) * (1 - d / (half * 1.6));
        dummy.position.set(x, -1.6, z);
        dummy.scale.set(1, Math.max(0.05, h), 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);
        col.copy(palette.accent3).lerp(palette.accent2, Math.min(1, h / 1.6)).multiplyScalar(dim);
        mesh.setColorAt(k, col);
        k++;
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      g.rotation.y += dt * 0.05 * info.motion;
    },
  };
};

/* --- timeline: milestones on a glowing path; steps move the marker -------- */
scenes.timeline = (ctx) => {
  const { palette, params } = ctx;
  const items = params.items ?? [{ label: '2024' }, { label: '2025' }, { label: '2026' }, { label: '2027' }];
  const W = params.width ?? 9;
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 120; i++) { const x = (i / 120 - 0.5) * W; pts.push(new THREE.Vector3(x, Math.sin(x * 0.6) * 0.35, Math.cos(x * 0.4) * 0.6)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(300));
  lineGeo.setDrawRange(0, 0);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.9 }));
  g.add(line);
  const nodes = items.map((it, i) => {
    const u = items.length === 1 ? 0.5 : 0.06 + (i / (items.length - 1)) * 0.88;
    const p = curve.getPointAt(u);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 20), new THREE.MeshStandardMaterial({ color: palette.muted, emissive: palette.accent, emissiveIntensity: 0 }));
    m.position.copy(p);
    const up = i % 2 === 0;
    const label = makeLabel(ctx, it.label, { height: 0.3, font: 'display', weight: 700 });
    label.position.copy(p).add(new THREE.Vector3(0, up ? 0.62 : -0.62, 0));
    g.add(m, label);
    let sub = null;
    if (it.sub) { sub = makeLabel(ctx, it.sub, { height: 0.19, color: palette.muted, weight: 500 }); sub.position.copy(label.position).add(new THREE.Vector3(0, up ? 0.36 : -0.36, 0)); g.add(sub); }
    return { m, label, sub, u, lit: 0 };
  });
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), new THREE.MeshStandardMaterial({ color: palette.accent2, emissive: palette.accent2, emissiveIntensity: 0.9 }));
  g.add(marker);
  let progress = 0, target = params.start ?? 1, tEnter = -1;
  const uFor = (k) => (k <= 0 ? 0 : nodes[Math.min(k, nodes.length) - 1].u);
  return {
    object: g,
    camera: { offset: [0, 0.2, 8], look: [0, 0, 0] },
    enter() { tEnter = -1; },
    step(k) { target = Math.max(params.start ?? 1, k); },
    update(t, dt, info) {
      if (tEnter < 0) tEnter = t;
      const draw = smooth01((t - tEnter) / 1.4);
      lineGeo.setDrawRange(0, Math.floor(301 * draw));
      const goal = uFor(target);
      progress += (goal - progress) * Math.min(1, dt * (info.motion < 1 ? 60 : 3));
      marker.position.copy(curve.getPointAt(Math.min(1, Math.max(0, progress))));
      nodes.forEach((n) => {
        const on = n.u <= progress + 0.01 ? 1 : 0;
        n.lit += (on - n.lit) * Math.min(1, dt * 5);
        n.m.material.emissiveIntensity = n.lit * 0.9;
        n.m.material.color.copy(palette.muted).lerp(palette.accent, n.lit);
        n.label.material.opacity = (0.35 + n.lit * 0.65) * info.fade * draw;
        if (n.sub) n.sub.material.opacity = (0.25 + n.lit * 0.6) * info.fade * draw;
      });
    },
    fadeManaged: nodes.flatMap((n) => [n.label.material, n.sub?.material].filter(Boolean)),
  };
};

const helpers = { sceneRng, paletteColor, dotTexture, pointsMaterial, makePoints, makeLabel, fibonacciSphere, SHAPES, smooth01, easeOutCubic, easeInOutCubic, chartKit, chartReveal, chartFormat, chartTable };

export { scenes, helpers };
