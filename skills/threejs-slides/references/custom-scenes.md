# Custom scenes

Register a scene in the deck's own `<script type="module">`. Leave `lib/scenes.js` alone so the runtime stays upgradeable.

```js
import { createDeck, registerScene, THREE } from './lib/threejs-slides.js';

registerScene('rings', (ctx) => {
  const { palette, params, helpers } = ctx;
  const group = new THREE.Group();
  const n = params.count ?? 5;
  const rings = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(0.6 + i * 0.35, 0.03, 16, 128),
      new THREE.MeshStandardMaterial({ color: helpers.paletteColor(palette, i), emissive: palette.accent, emissiveIntensity: 0.2 })
    );
    group.add(m); rings.push(m);
  }
  let focus = -1;
  return {
    object: group,                                   // required
    camera: { offset: [0, 0, 8], look: [0, 0, 0] },  // optional default camera (relative to anchor)
    enter() {},                                      // slide became current
    leave() {},                                      // slide no longer current
    step(k) { focus = k - 1; },                      // build step k (0 = initial)
    update(t, dt, info) {                            // every frame while visible
      rings.forEach((r, i) => {
        r.rotation.x = t * 0.3 * info.motion + i;
        r.scale.setScalar(i === focus ? 1.15 : 1);
      });
    },
  };
});

await createDeck();
```

Use it with `<section data-scene="rings" data-params='{"count":6}' data-scene-steps="6">`. **Register before `createDeck()`.**

## ctx

| Key | What |
|---|---|
| `THREE` | the three.js namespace (r187) |
| `palette` | `{ bg, fg, muted, accent, accent2, accent3 }` as `THREE.Color`, plus `isLight` and `fonts.{display,body,mono}` |
| `params` | parsed `data-params` JSON |
| `index`, `slide` | slide index and its `<section>` element |
| `renderer`, `camera`, `scene` | shared three.js objects (don't move the camera; the engine owns it) |
| `shared.uTime`, `shared.uPixelRatio` | uniform objects you can share with your ShaderMaterials |
| `helpers` | `sceneRng(seed)`, `paletteColor(palette,i)`, `makePoints(ctx, Float32Array, colorFn, opts)`, `pointsMaterial(ctx, opts)`, `makeLabel(ctx, text, opts)`, `fibonacciSphere(n, r)`, `SHAPES`, `dotTexture()`, easing functions |

## The fade contract

The engine fades every slide's object in and out during transitions:
- **Standard materials** (`MeshStandardMaterial`, `LineBasicMaterial`, `SpriteMaterial`, …) get `opacity = baseOpacity × fade` automatically; the engine sets `transparent = true`.
- **ShaderMaterial**: declare a `uFade` uniform (`{ value: 0 }`) and multiply your output alpha by it. Set `transparent: true`.
- If **you** animate a material's opacity yourself, return it in `fadeManaged: [material, …]` and multiply your value by `info.fade` in `update`.
- Create all materials inside the factory; the engine collects them once.

In custom shaders, end the fragment shader with `#include <colorspace_fragment>` **on its own line**, otherwise colours come out too dark or the shader fails to compile.

## `info` in update

`{ fade: 0..1, active: boolean, motion: 1 | 0.15 }`. `motion` is 0.15 under reduced motion or `?static`. Multiply your animation speeds by it. When `motion < 1`, jump entrance animations to their end state so screenshots are complete.

## Recipes

### Image plane (floating screenshot)
```js
registerScene('screen', (ctx) => {
  const tex = new THREE.TextureLoader().load(ctx.params.src);
  tex.colorSpace = THREE.SRGBColorSpace;
  const w = ctx.params.width ?? 5, h = w / (ctx.params.aspect ?? 16 / 10);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  return { object: mesh, update(t, dt, info) { mesh.rotation.y = -0.25 + Math.sin(t * 0.4) * 0.06 * info.motion; } };
});
```
`<section class="layout-split" data-scene="screen" data-params='{"src":"assets/app.png","aspect":1.6}'>`

### glTF model (product, logo)
```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
registerScene('model', (ctx) => {
  const holder = new THREE.Group();
  new GLTFLoader().load(ctx.params.src, (gltf) => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const s = (ctx.params.size ?? 3) / box.getSize(new THREE.Vector3()).length();
    gltf.scene.scale.setScalar(s);
    gltf.scene.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(s));
    holder.add(gltf.scene);
  });
  return { object: holder, update(t, dt, info) { holder.rotation.y += dt * 0.3 * info.motion; } };
});
```
Note: materials that load *after* the factory returns aren't faded by the engine. For a model, the pop-in is usually acceptable. Otherwise traverse the model when it loads, set `transparent = true`, and drive `opacity` from `info.fade` in `update`.

### Points from any shape
```js
const pos = ctx.helpers.SHAPES.knot(5000, ctx.helpers.sceneRng(1));
const pts = ctx.helpers.makePoints(ctx, pos, (i, c) => c.copy(ctx.palette.accent), { size: 3 });
```

## Performance rules
- 20k points or fewer per scene, 5k instances or fewer, 1 or 2 lights at most (the engine already provides hemisphere, key and rim light plus an environment map).
- Don't allocate in `update` (no `new THREE.Vector3()` per frame; reuse temps).
- Updating CPU geometry each frame is fine up to about 10k vertices; beyond that, move it to a vertex shader.
- Test with `?quality=low` to make sure the deck works on a weak laptop.
