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
   ShaderMaterials should expose a `uFade` uniform (float 0..1) and multiply alpha by it.
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
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 1.5) * uOpacity * uFade;
        if (a < 0.004) discard;
        gl_FragColor = vec4(vColor, a);
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
  // halo in the background colour (same idea as the HTML text halo) so labels read over glowing objects
  const halo = '#' + ctx.palette.bg.getHexString(THREE.SRGBColorSpace);
  g.lineJoin = 'round';
  g.strokeStyle = halo; g.lineWidth = px * 0.14;
  g.shadowColor = halo; g.shadowBlur = px * 0.35;
  g.strokeText(String(text), w / 2, c.height / 2);
  g.shadowBlur = 0;
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
    uniforms: { uColor: { value: palette.accent.clone() }, uFade: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uFade; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 4.5); gl_FragColor = vec4(uColor, f * 0.55 * uFade);
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
      uLow: { value: palette.accent.clone() }, uHigh: { value: palette.accent2.clone() }, uSize: { value: size },
    },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uAmp; varying float vH; varying float vEdge;
      float h(vec2 p){ return sin(p.x*0.35+uTime*0.6)*0.8 + sin(p.y*0.5-uTime*0.4)*0.6 + sin((p.x+p.y)*0.9+uTime*0.9)*0.25; }
      void main(){ vec3 p = position; p.y += h(p.xz) * uAmp; vH = h(p.xz)*0.5+0.5; vEdge = length(position.xz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLow; uniform vec3 uHigh; uniform float uFade; uniform float uSize; uniform float uAlpha; varying float vH; varying float vEdge;
      void main(){ float edge = 1.0 - smoothstep(uSize*0.18, uSize*0.48, vEdge);
        gl_FragColor = vec4(mix(uLow, uHigh, clamp(vH,0.,1.)), edge * uAlpha * uFade);
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

/* --- bars: animated 3D bar chart --------------------------------------- */
scenes.bars = (ctx) => {
  const { palette, params } = ctx;
  const data = params.data ?? [{ label: 'A', value: 3 }, { label: 'B', value: 5 }, { label: 'C', value: 8 }, { label: 'D', value: 13 }];
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const H = params.height ?? 2.6;
  const gap = params.gap ?? 1.05;
  const g = new THREE.Group();
  const width = (data.length - 1) * gap;
  const base = new THREE.GridHelper(width + 3, Math.round((width + 3) * 2), palette.fg, palette.fg);
  base.material.transparent = true; base.material.opacity = 0.12;
  g.add(base);
  const unit = params.unit ?? '';
  const bars = data.map((d, i) => {
    const col = d.highlight ? palette.accent2.clone() : palette.accent.clone().lerp(palette.accent3, i / Math.max(1, data.length - 1) * 0.6);
    const mat = new THREE.MeshStandardMaterial({ color: col.clone().multiplyScalar(0.88), emissive: col, emissiveIntensity: palette.isLight ? 0.016 : 0.088, roughness: 0.35, metalness: 0.2 });
    const geo = new THREE.BoxGeometry(0.62, 1, 0.62); geo.translate(0, 0.5, 0);
    const m = new THREE.Mesh(geo, mat);
    m.position.x = i * gap - width / 2;
    m.scale.y = 0.001;
    const label = makeLabel(ctx, d.label, { height: 0.22, color: palette.muted, weight: 500 });
    label.position.set(m.position.x, -0.32, 0.5);
    const val = makeLabel(ctx, `${d.value}${unit}`, { height: 0.3, font: 'display', weight: 700 });
    val.position.set(m.position.x, 0, 0.2);
    g.add(m, label, val);
    return { m, val, h: (d.value / max) * H };
  });
  g.rotation.y = params.rotate ?? -0.32;
  let tEnter = -1;
  return {
    object: g,
    camera: { offset: [0, 1.7, 8.6], look: [0, 1.0, 0] },
    enter() { tEnter = -1; },
    update(t, dt, info) {
      if (tEnter < 0) tEnter = t;
      const local = (t - tEnter) * (info.motion < 1 ? 100 : 1);
      bars.forEach((b, i) => {
        const k = easeOutCubic((local - 0.2 - i * 0.12) / 1.1);
        b.m.scale.y = Math.max(0.001, b.h * k);
        b.val.position.y = b.h * k + 0.32;
        b.val.material.opacity = smooth01((local - 0.6 - i * 0.12) * 2) * info.fade;
      });
      g.position.y = Math.sin(t * 0.6) * 0.05;
    },
    fadeManaged: bars.map((b) => b.val.material),
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
      uLight: { value: palette.isLight ? 1 : 0 },
    },
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uAmp; varying vec3 vN; varying vec3 vV; varying float vD;
      float field(vec3 p){ float t = uTime*0.55;
        return sin(p.x*2.1+t)*sin(p.y*1.7+t*1.3)*sin(p.z*2.3+t*0.7) + 0.5*sin(p.x*3.7-t*1.1+p.z*2.9)*sin(p.y*3.1+t*0.8); }
      void main(){ vec3 p = position; float d = field(normal*1.3); vD = d; p += normal * d * uAmp;
        vec4 mv = modelViewMatrix * vec4(p,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uFade; uniform float uLight;
      varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
        vec3 col = mix(uA, uB, smoothstep(-0.8, 0.9, vD)); col = mix(col, uC, fres*0.8);
        col *= mix(0.42 + fres*0.55, 0.85 + fres*0.4, uLight);
        gl_FragColor = vec4(col, uFade);
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

const helpers = { sceneRng, paletteColor, dotTexture, pointsMaterial, makePoints, makeLabel, fibonacciSphere, SHAPES, smooth01, easeOutCubic, easeInOutCubic };

export { scenes, helpers };
