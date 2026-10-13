import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import glyph from './medallionGlyph.json';
import { useTheme } from './ThemeToggle';

// Units: the chrome ring's outer radius is 1. The glyph outline was traced
// from the hero.mp4 motif, snapped to its grid and made symmetric.

const CAMERA_START_Z = 24;
const CAMERA_END_Z = 6.8;
const ENTRANCE_SECONDS = 3.4;
const SPIN_SPEED = 0.3; // rad/s — one turn every ~21s
const MAX_TILT = 0.22; // rad
const KEY_LIGHT_POS = new THREE.Vector3(-3.6, 2.4, 2.6); // relative to the medallion

// Where the medallion is right now; the key light follows it so it stays lit
// wherever it travels.
const medallionPos = new THREE.Vector3();
// And its current size (world units across the ring), for the molecules.
const medallionScale = { value: 1 };
// How hard it's twirling right now (0–1), so the molecules swirl with it.
const twirl = { value: 0 };
// Bumped each time the medallion starts surging forward: the spheres burst
// out of it. Starts at 1 so they burst out on arrival too.
const burst = { count: 1 };
const BURST_AT = 0.12; // share of the cycle, early in the surge

// The choreography, one cycle every ~16s: it surges from deep at the back
// all the way up to the front, holds there a moment, then twirls back into
// the distance. Depths are world z (camera at CAMERA_END_Z): at the front it
// looks ~1.35x its home size, at the back ~0.4x.
const CYCLE = 16;
const SURGE = 0.45; // share of the cycle spent coming forward
const HOLD = 0.12; // then a pause at the front
const Z_BACK = -10;
const Z_FRONT = 2.8; // comes out at you: about 1.7x its home size (15% under the old 2x)
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// Start partway through the surge, at its home depth, so the page opens on
// it at its usual size (and frozen test views stay put).
const CYCLE_START = 0.32 * CYCLE;

const GLYPH_DEPTH = 0.7;
const GLYPH_Z = -GLYPH_DEPTH / 2; // centred: the glyph juts out of both sides of the ring
const RING_INNER = 0.87;
const RING_DEPTH = 0.34;

// Dev only: /?angle=150 freezes the spin at that many degrees, for tuning.
const FROZEN_ANGLE = import.meta.env.DEV
  ? Number(new URLSearchParams(window.location.search).get('angle') ?? NaN)
  : NaN;

// Finishes for the silver ring; matte is the default. Dev only: /?ring=chrome
// or /?ring=satin to compare.
const RING_FINISHES = {
  chrome: { color: '#f1f0ec', metalness: 1, roughness: 0.08, envMapIntensity: 1.6 },
  satin: { color: '#d9d9d6', metalness: 1, roughness: 0.28, envMapIntensity: 1.3 },
  matte: { color: '#c3c6ca', metalness: 1, roughness: 0.62, envMapIntensity: 1.25, textured: true },
};
const RING_FINISH =
  RING_FINISHES[import.meta.env.DEV && new URLSearchParams(window.location.search).get('ring')] ??
  RING_FINISHES.matte;

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Pointer — tracked across the whole window, not just the canvas.
// ---------------------------------------------------------------------------

function useWindowPointer() {
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return pointer;
}

// ---------------------------------------------------------------------------
// Brushed-gold texture: fine concentric rings, like the spun finish in the
// motif video. Drives roughness and a whisper of bump so highlights streak.
// ---------------------------------------------------------------------------

function useBrushedTexture() {
  return useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, size, size);
    const c = size / 2;
    for (let r = 1; r < size * 0.72; r += 0.9) {
      const v = 128 + (Math.random() - 0.5) * 120;
      ctx.strokeStyle = `rgba(${v},${v},${v},0.55)`;
      ctx.lineWidth = 0.6 + Math.random();
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    return tex;
  }, []);
}

// Matte-silver grain: fine circumferential brushing plus speckle, like
// bead-blasted or satin-brushed steel. Lathe UVs run u around the ring, so
// horizontal streaks here become brushing around the band.
function useGrainTexture() {
  return useMemo(() => {
    const w = 2048;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(150,150,150)';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 150 + (Math.random() - 0.5) * 140;
      ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 400, 0.6 + Math.random());
    }
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 50;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    tex.anisotropy = 8;
    return tex;
  }, []);
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const GLYPH_UV_SPAN = 1.3; // glyph spans roughly ±0.65 → map caps to 0..1

// Caps get planar UVs centred on the medallion (so the brushed rings are
// concentric with it); side walls get three's usual world-space UVs.
const glyphUVs = {
  generateTopUV(_, v, a, b, c) {
    const uv = (i) =>
      new THREE.Vector2(v[i * 3] / GLYPH_UV_SPAN + 0.5, v[i * 3 + 1] / GLYPH_UV_SPAN + 0.5);
    return [uv(a), uv(b), uv(c)];
  },
  generateSideWallUV(_, v, a, b, c, d) {
    const p = (i) => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
    const [A, B, C, D] = [p(a), p(b), p(c), p(d)];
    const alongX = Math.abs(A[1] - B[1]) < Math.abs(A[0] - B[0]);
    const k = alongX ? 0 : 1;
    return [A, B, C, D].map((q) => new THREE.Vector2(q[k], 1 - q[2]));
  },
};

function useGlyphGeometry() {
  return useMemo(() => {
    const toPts = (pts) => pts.map(([x, y]) => new THREE.Vector2(x, y));
    const shape = new THREE.Shape(toPts(glyph.outer));
    shape.holes = glyph.holes.map((h) => new THREE.Path(toPts(h)));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: GLYPH_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.006,
      bevelSegments: 2,
      curveSegments: 1,
      UVGenerator: glyphUVs,
    });
    geo.translate(0, 0, GLYPH_Z);
    return geo;
  }, []);
}

// Thick chrome band with softly rounded edges, lathed from its cross-section.
function useRingGeometry() {
  return useMemo(() => {
    const r0 = RING_INNER;
    const r1 = 1;
    const h = RING_DEPTH / 2;
    const k = 0.035; // corner radius
    const pts = [];
    const corner = (cx, cy, a0) => {
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (i / 6) * (Math.PI / 2);
        pts.push(new THREE.Vector2(cx + Math.cos(a) * k, cy + Math.sin(a) * k));
      }
    };
    // Counter-clockwise in (radius, height) so the lathe faces outward.
    corner(r1 - k, -h + k, -Math.PI / 2);
    corner(r1 - k, h - k, 0);
    corner(r0 + k, h - k, Math.PI / 2);
    corner(r0 + k, -h + k, Math.PI);
    pts.push(pts[0].clone());
    const geo = new THREE.LatheGeometry(pts, 160);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, []);
}

// ---------------------------------------------------------------------------
// The medallion
// ---------------------------------------------------------------------------

// Side walls darken the deeper they sit — toward the black face at z = 0 —
// like a recessed casting. Cheap stand-in for ambient occlusion; the key
// light's shadow map does the rest. Walls rely mostly on that key light (low
// envMapIntensity) so the faces turned away from it fall into shadow.
function addContactShading(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vDepth;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDepth = abs(position.z);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vDepth;')
    .replace(
      '#include <opaque_fragment>',
      `outgoingLight *= mix(0.18, 1.0, smoothstep(0.02, ${(GLYPH_DEPTH / 2).toFixed(3)}, vDepth));
      #include <opaque_fragment>`
    );
}

function MedallionBody() {
  const glyphGeo = useGlyphGeometry();
  const ringGeo = useRingGeometry();
  const brushed = useBrushedTexture();
  const grain = useGrainTexture();
  const { textured, ...ringFinish } = RING_FINISH;

  return (
    <group>
      {/* ExtrudeGeometry groups: 0 = front/back caps, 1 = side walls. */}
      <mesh geometry={glyphGeo} castShadow receiveShadow>
        <meshStandardMaterial
          attach="material-0"
          color="#cdb43e"
          metalness={0.95}
          roughness={0.4}
          roughnessMap={brushed}
          bumpMap={brushed}
          bumpScale={0.35}
          envMapIntensity={1.6}
        />
        <meshStandardMaterial
          attach="material-1"
          color="#8f8c86"
          metalness={1}
          roughness={0.36}
          envMapIntensity={0.4}
          onBeforeCompile={addContactShading}
        />
      </mesh>

      {/* True black face, recessed inside the ring. Unlit on purpose: even a
          4% reflection of the warm key light reads as brown on black. */}
      <mesh position={[0, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[RING_INNER + 0.005, RING_INNER + 0.005, 0.03, 128]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      <mesh geometry={ringGeo} castShadow receiveShadow>
        <meshStandardMaterial
          {...ringFinish}
          roughnessMap={textured ? grain : null}
          bumpMap={textured ? grain : null}
          bumpScale={0.6}
        />
      </mesh>
    </group>
  );
}

// Nested motion, outermost first: a slow drift in depth (back, then toward
// the viewer), cursor tilt, a slow rock back and forward, and the spin.
function Medallion({ pointer, layout }) {
  const drift = useRef();
  const tilt = useRef();
  const rock = useRef();
  const spin = useRef();
  const t = useRef(0);
  const prevPh = useRef(null);
  const camera = useThree((st) => st.camera);
  const aspect = useThree((st) => st.size.width / st.size.height);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1); // no jump after a backgrounded tab
    const frozen = Number.isFinite(FROZEN_ANGLE);
    if (!frozen && !prefersReducedMotion) t.current += dt;
    const time = t.current;

    // Map the mark box (from the page layout) into world units at z = 0.
    const halfH = CAMERA_END_Z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = halfH * aspect;
    const L = layout.current;
    const homeX = L.fx * halfW;
    const homeY = L.fy * halfH;
    const scale = L.radius * 2 * halfH;
    drift.current.scale.setScalar(scale);

    // Where it is in the cycle: surging forward, holding, or twirling back.
    const ph = ((time + CYCLE_START) % CYCLE) / CYCLE;
    if (prevPh.current !== null && prevPh.current < BURST_AT && ph >= BURST_AT) burst.count++;
    prevPh.current = ph;
    let z;
    let swing = 0;
    let boost = 0;
    if (prefersReducedMotion) {
      z = 0;
    } else if (ph < SURGE) {
      z = THREE.MathUtils.lerp(Z_BACK, Z_FRONT, easeInOut(ph / SURGE));
    } else if (ph < SURGE + HOLD) {
      z = Z_FRONT;
    } else {
      const q = (ph - SURGE - HOLD) / (1 - SURGE - HOLD);
      z = THREE.MathUtils.lerp(Z_FRONT, Z_BACK, easeInOut(q));
      // On the way back it loops out to one side and spins a full extra turn.
      swing = Math.sin(Math.PI * q);
      boost = ((Math.PI * 2) / ((1 - SURGE - HOLD) * CYCLE)) * (Math.PI / 2) * Math.sin(Math.PI * q);
    }
    twirl.value = swing;

    if (frozen) spin.current.rotation.y = THREE.MathUtils.degToRad(FROZEN_ANGLE);
    else spin.current.rotation.y += dt * (SPIN_SPEED * (prefersReducedMotion ? 0.4 : 1) + boost);

    // Rock: tips back and forward as it turns, on its own slower rhythm.
    rock.current.rotation.x = Math.sin(time * 0.37) * 0.26;
    rock.current.rotation.z = Math.sin(time * 0.23 + 1.1) * 0.06;

    // Travel: sweeps out to the far left and far right of the hero, recedes
    // and comes forward, floats a little — turning and rocking all the while,
    // so you see it change shape in 3D. Starts (time 0) at its home spot.
    // Mostly recedes; comes only a little forward so it never clips the top.
    // Centre stage, travelling in depth: it surges forward and twirls back
    // (see the choreography above), turning and rocking all the while.
    drift.current.position.set(
      homeX + Math.sin(time * 0.12) * scale * 0.06 + swing * scale * 0.9,
      homeY + Math.sin(time * 0.27) * scale * 0.05 + swing * scale * 0.15,
      frozen ? 0 : z
    );
    medallionPos.copy(drift.current.position);
    medallionScale.value = scale;

    const ease = 1 - Math.exp(-dt * 3); // frame-rate independent damping
    const tx = -pointer.current.y * MAX_TILT;
    const ty = pointer.current.x * MAX_TILT;
    tilt.current.rotation.x += (tx - tilt.current.rotation.x) * ease;
    tilt.current.rotation.y += (ty - tilt.current.rotation.y) * ease;
  });

  return (
    <group ref={drift}>
      <group ref={tilt}>
        <group ref={rock}>
          <group ref={spin}>
            <MedallionBody />
          </group>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Camera entrance: push in from far back, then hold.
// ---------------------------------------------------------------------------

function CameraRig({ focus }) {
  const camera = useThree((s) => s.camera);
  const t = useRef(prefersReducedMotion ? ENTRANCE_SECONDS : 0);

  useFrame((_, delta) => {
    if (t.current >= ENTRANCE_SECONDS && camera.position.z === CAMERA_END_Z) return;
    t.current = Math.min(t.current + Math.min(delta, 0.05), ENTRANCE_SECONDS);
    const p = t.current / ENTRANCE_SECONDS;
    const e = 1 - Math.pow(1 - p, 4); // easeOutQuart: fast push, soft settle
    camera.position.z = THREE.MathUtils.lerp(CAMERA_START_Z, CAMERA_END_Z, e);
    focus.current = camera.position.z;
  });
  return null;
}

// ---------------------------------------------------------------------------
// Golden dust: real 3D points with a cheap depth-of-field — motes far from the
// focal plane grow into dim soft discs, motes near it stay small and sharp.
// ---------------------------------------------------------------------------

const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform vec3 uKeyPos;
  attribute float aSeed;
  attribute float aSize;
  attribute float aTint;
  varying float vBlur;
  varying float vAlpha;
  varying float vTint;
  varying float vAngle;
  varying float vTumble;

  void main() {
    vec3 p = position;
    float t = uTime;
    // Drifts down slowly like snow, swaying side to side.
    p.x += sin(t * 0.35 + aSeed * 6.28) * 0.18 + sin(t * 0.13 + aSeed * 17.0) * 0.1;
    p.y = mod(p.y - t * (0.03 + aSeed * 0.04) + 2.2, 4.4) - 2.2;
    // Streams from far behind the medallion, through it, and out past the
    // viewer's side of it — so flakes grow as they come toward you.
    p.z = mod(p.z + 3.0 + t * (0.3 + aSeed * 0.35), 7.0) - 3.0;
    float edgeFade = smoothstep(2.2, 1.8, abs(p.y))
      * smoothstep(-3.0, -2.2, p.z) * smoothstep(4.0, 3.2, p.z);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    // Only the very nearest flakes soften; the rest stay crisp.
    vBlur = clamp(abs(depth - uFocus) * uAperture - 0.25, 0.0, 1.0);

    gl_PointSize = aSize * (1.0 + vBlur * 2.5) * uPixelRatio * uScale / depth;
    gl_Position = projectionMatrix * mv;

    // Each flake spins in the image plane and tumbles edge-on and back.
    vAngle = aSeed * 6.28 + t * (0.3 + aSeed * 0.6);
    vTumble = abs(cos(aSeed * 31.0 + t * (0.8 + aSeed * 1.2)));

    // Flakes in the key light's cone are brightest, but none go dim enough
    // to read as brown — dim gold on black looks like chocolate.
    vec3 toMote = normalize(p - uKeyPos);
    float cone = smoothstep(0.7, 0.95, dot(toMote, normalize(-uKeyPos)));
    // Near flakes stay bright as they soften — dimmed gold reads as brown.
    vAlpha = (0.8 + 0.5 * cone) * edgeFade / (1.0 + vBlur * 0.4);
    vTint = aTint;
  }
`;

const dustFragment = /* glsl */ `
  uniform float uLight; // 1 on the light theme
  uniform vec3 uGold;
  uniform vec3 uChrome;
  varying float vBlur;
  varying float vAlpha;
  varying float vTint;
  varying float vAngle;
  varying float vTumble;

  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float c = cos(vAngle), s = sin(vAngle);
    q = mat2(c, -s, s, c) * q;
    // Tumbling foil flake: a small diamond that thins as it turns edge-on.
    q.x /= max(vTumble, 0.18);
    float d = abs(q.x) + abs(q.y);
    float edge = 0.04 + vBlur * 0.2;
    float shape = 1.0 - smoothstep(0.34 - edge, 0.34, d);
    if (shape < 0.01) discard;
    // Glint when the flake turns face-on to the viewer.
    float glint = 0.55 + 0.9 * pow(vTumble, 6.0);
    vec3 col = mix(uGold, uChrome, vTint) * shape * vAlpha * glint;
    // Premultiplied additive: alpha = brightness so flakes composite cleanly
    // over the transparent canvas.
    vec4 additive = vec4(col, max(col.r, max(col.g, col.b)));
    // On a light page added light washes out, so flakes are painted solid:
    // brass gold and steel, still crisp, glinting as they turn.
    vec3 solid = mix(vec3(0.62, 0.55, 0.20), vec3(0.50, 0.52, 0.55), vTint) * mix(0.85, 1.25, pow(vTumble, 6.0));
    float a = shape * clamp(vAlpha * 1.6, 0.0, 1.0);
    gl_FragColor = mix(additive, vec4(solid * a, a), uLight);
  }
`;

function GoldDust({ count, focus }) {
  const material = useRef();
  const light = useTheme() === 'light';
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const tints = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Volume around the medallion, deeper toward the camera so there are
      // plenty of near (blurred) motes as well as far ones.
      positions[i * 3] = (Math.random() * 2 - 1) * 5.5;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * 2.4;
      positions[i * 3 + 2] = -3 + Math.random() * 7;
      seeds[i] = Math.random();
      sizes[i] = 1.4 + Math.pow(Math.random(), 2) * 2.2;
      tints[i] = Math.random() < 0.5 ? 1 : 0; // half gold, half silver
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aTint', new THREE.BufferAttribute(tints, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFocus: { value: CAMERA_END_Z },
      uAperture: { value: 0.22 },
      uPixelRatio: { value: 1 },
      uScale: { value: 1 },
      uKeyPos: { value: KEY_LIGHT_POS.clone() },
      uLight: { value: 0 },
      uGold: { value: new THREE.Color('#f4db6e') },
      uChrome: { value: new THREE.Color('#eef1f4') },
    }),
    []
  );

  useFrame((_, delta) => {
    const u = material.current.uniforms;
    u.uTime.value += Math.min(delta, 0.1) * (prefersReducedMotion ? 0.3 : 1);
    u.uFocus.value = focus.current;
    u.uLight.value = light ? 1 : 0;
    u.uKeyPos.value.copy(medallionPos).add(KEY_LIGHT_POS);
    u.uPixelRatio.value = dpr;
    u.uScale.value = size.height * 0.03; // point size tracks canvas size
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={dustVertex}
        fragmentShader={dustFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={light ? THREE.NormalBlending : THREE.AdditiveBlending}
        premultipliedAlpha
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Molecules: glossy gold and silver spheres held around the medallion in a
// loose cloud, each on its own slow orbit. Move the pointer through them and
// they scatter, then spring back into place.
// ---------------------------------------------------------------------------

function Molecules({ count, pointer }) {
  const gold = useRef();
  const silver = useRef();
  const camera = useThree((s) => s.camera);
  const nSilver = Math.round(count * 0.35);
  const nGold = count - nSilver;
  const lastBurst = useRef(0);

  const motes = useMemo(() => {
    const list = [];
    for (let i = 0; i < count; i++) {
      // A shell around the ring: wider than it is deep, so they read as a
      // halo from the front and a cloud from the side.
      list.push({
        r: 1.35 + Math.pow(Math.random(), 1.5) * 1.1,
        theta: Math.random() * Math.PI * 2,
        phi: (Math.random() - 0.5) * 1.6,
        speed: (0.04 + Math.random() * 0.08) * (Math.random() < 0.5 ? -1 : 1),
        bob: Math.random() * Math.PI * 2,
        ang: 0,
        size: 0.075 + Math.pow(Math.random(), 2) * 0.17,
        // Every sixth one gets thrown in from off-screen now and then.
        thrower: i % 6 === 0,
        nextThrow: 2 + i * 0.9 + Math.random() * 4,
        loose: 0,
        launchAt: -1,
        // Every fourth flies straight out of the screen at the viewer.
        flyer: i % 4 === 1,
        fly: null, // while waiting to burst out it sits inside the medallion
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        placed: false,
      });
    }
    return list;
  }, [count]);

  // Many shades of gold and silver, never brown: pale champagne to bright
  // yellow gold; bright chrome to soft pewter.
  useEffect(() => {
    const golds = ['#f4e2a0', '#ecd27a', '#e6c860', '#dcb845', '#f0d68a', '#d8b955'];
    const silvers = ['#f6f7f8', '#e3e6e9', '#cfd4d9', '#bcc2c9'];
    const c = new THREE.Color();
    for (let i = 0; i < nGold; i++) gold.current.setColorAt(i, c.set(golds[i % golds.length]));
    for (let i = 0; i < nSilver; i++) silver.current.setColorAt(i, c.set(silvers[i % silvers.length]));
    gold.current.instanceColor.needsUpdate = true;
    silver.current.instanceColor.needsUpdate = true;
  }, [nGold, nSilver]);

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), target: new THREE.Vector3(), hand: new THREE.Vector3(), dir: new THREE.Vector3(), d: new THREE.Vector3() }),
    []
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const sc = medallionScale.value;

    // Where the pointer is, at the medallion's depth.
    tmp.dir.set(pointer.current.x, pointer.current.y, 0.5).unproject(camera).sub(camera.position).normalize();
    const k = (medallionPos.z - camera.position.z) / tmp.dir.z;
    tmp.hand.copy(camera.position).addScaledVector(tmp.dir, k);
    const reach = 0.55 * sc;

    // A burst: every sphere is pulled inside the medallion, then they shoot
    // out one after another, fast, overshooting before they settle.
    if (lastBurst.current !== burst.count && !prefersReducedMotion) {
      lastBurst.current = burst.count;
      motes.forEach((m, i) => { m.launchAt = t + i * 0.035; m.pos.copy(medallionPos); m.vel.set(0, 0, 0); });
    }

    let gi = 0;
    let si = 0;
    motes.forEach((m, i) => {
      // Each keeps its own slow orbit, and swirls fast as the medallion
      // twirls back.
      m.ang += dt * (m.speed + Math.sign(m.speed) * twirl.value * 1.6) * (prefersReducedMotion ? 0.2 : 1);
      const th = m.theta + m.ang;
      const ph = m.phi + Math.sin(t * 0.3 + m.bob) * 0.08;
      // Centrifugal force: as the medallion twirls they fling outward.
      const rr = m.r * (1 + 0.55 * twirl.value);
      tmp.target.set(
        Math.cos(th) * Math.cos(ph) * rr * 1.1,
        Math.sin(ph) * rr * 0.85,
        Math.sin(th) * Math.cos(ph) * rr * 0.6
      ).multiplyScalar(sc * 0.5).add(medallionPos);

      if (!m.placed) { m.pos.copy(tmp.target); m.placed = true; }
      let grow = 1;
      if (m.launchAt > 0) {
        if (t < m.launchAt) {
          // Still inside: tucked in the centre of the medallion, small.
          m.pos.copy(medallionPos);
          grow = 0.2;
          m.vel.set(0, 0, 0);
        } else {
          // Launch: shot out along its orbit direction, toward the viewer a
          // little, with a kick — it overshoots and springs back.
          if (m.flyer) {
            // Straight at the viewer, speeding up, ending huge just in
            // front of the lens and a little off-centre, then it falls
            // back into orbit.
            const side = Math.random() < 0.5 ? -1 : 1;
            m.fly = {
              t0: t,
              dur: 1.3 + Math.random() * 0.5,
              from: m.pos.clone(),
              // Relative to the lens, which may still be moving in.
              offset: new THREE.Vector3(
                side * (0.12 + Math.random() * 0.2),
                (Math.random() - 0.4) * 0.3,
                -0.7 - Math.random() * 0.45
              ),
              to: new THREE.Vector3(),
            };
          }
          tmp.d.copy(tmp.target).sub(medallionPos).normalize();
          tmp.d.z += 0.35;
          m.vel.copy(tmp.d).multiplyScalar(sc * (5.5 + Math.random() * 3));
          m.loose = 2.4;
          m.launchAt = -1;
        }
      }
      // Thrown in: launched from beyond the edge of the screen, close to
      // the viewer, hard toward its orbit — it overshoots and bounces in.
      if (m.thrower && !prefersReducedMotion && t > m.nextThrow) {
        const side = Math.random() < 0.5 ? -1 : 1;
        m.pos.set(medallionPos.x + side * sc * 3.2, medallionPos.y + (Math.random() - 0.3) * sc * 1.4, medallionPos.z + sc * 1.6);
        m.vel.copy(tmp.target).sub(m.pos).multiplyScalar(2.4);
        m.loose = 2.2;
        m.nextThrow = t + 10 + Math.random() * 9;
      }
      if (m.fly) {
        const q = (t - m.fly.t0) / m.fly.dur;
        m.fly.to.copy(camera.position).add(m.fly.offset);
        if (q < 1) {
          m.pos.lerpVectors(m.fly.from, m.fly.to, q * q * q); // accelerating at you
          m.vel.set(0, 0, 0);
        } else {
          m.fly = null;
          m.loose = 2.6;
        }
      }
      m.loose = Math.max(0, m.loose - dt);
      // Spring home (springier while thrown, so it bounces), pushed away by
      // the hand, with damping.
      if (m.fly) {
        tmp.s.setScalar(m.size * sc * 0.5);
        tmp.m.compose(m.pos, tmp.q, tmp.s);
        if (i < nSilver) silver.current.setMatrixAt(si++, tmp.m);
        else gold.current.setMatrixAt(gi++, tmp.m);
        return;
      }
      tmp.d.copy(tmp.target).sub(m.pos).multiplyScalar(m.loose > 0 ? 6 : 3.2);
      m.vel.addScaledVector(tmp.d, dt);
      tmp.d.copy(m.pos).sub(tmp.hand);
      tmp.d.z = 0;
      const dist = tmp.d.length();
      if (dist < reach && dist > 1e-4) m.vel.addScaledVector(tmp.d.normalize(), (1 - dist / reach) * 9 * sc * dt);
      m.vel.multiplyScalar(Math.exp(-dt * (m.loose > 0 ? 0.9 : 2.6)));
      m.pos.addScaledVector(m.vel, dt);

      tmp.s.setScalar(m.size * sc * 0.5 * grow);
      tmp.m.compose(m.pos, tmp.q, tmp.s);
      if (i < nSilver) silver.current.setMatrixAt(si++, tmp.m);
      else gold.current.setMatrixAt(gi++, tmp.m);
    });
    gold.current.instanceMatrix.needsUpdate = true;
    silver.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={gold} args={[null, null, nGold]} frustumCulled={false} castShadow>
        <sphereGeometry args={[1, 32, 24]} />
        <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.16} envMapIntensity={1.35} />
      </instancedMesh>
      <instancedMesh ref={silver} args={[null, null, nSilver]} frustumCulled={false} castShadow>
        <sphereGeometry args={[1, 32, 24]} />
        <meshStandardMaterial color="#ffffff" metalness={1} roughness={0.1} envMapIntensity={1.3} />
      </instancedMesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Lighting: one warm raking key, faint cool rim, near-zero ambient, and a
// black studio environment whose bright shapes echo the key — so reflections
// agree with the lighting instead of fighting it.
// ---------------------------------------------------------------------------

const SOFTBOX_ANGLES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

function Lighting() {
  const key = useRef();
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    key.current.position.copy(medallionPos).add(KEY_LIGHT_POS);
    target.position.copy(medallionPos);
    target.updateMatrixWorld();
  });
  return (
    <>
      <primitive object={target} />
      <ambientLight intensity={0.05} />
      <spotLight
        ref={key}
        target={target}
        position={KEY_LIGHT_POS.toArray()}
        angle={0.55}
        penumbra={1}
        decay={0}
        intensity={9}
        color="#ffdcaa"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={12}
      />
      <directionalLight position={[3, -1.2, -2]} intensity={0.4} color="#9fb2c6" />
      <Environment resolution={256} frames={1} environmentIntensity={0.6}>
        <color attach="background" args={['#000000']} />
        {/* Warm strip on the key side — the big glint that sweeps across. */}
        <Lightformer form="rect" intensity={6} color="#ffe4bd" position={[-4, 2, 2]} scale={[1.2, 7, 1]} target={[0, 0, 0]} />
        {/* Soft overhead fill so the face never goes fully dead. */}
        <Lightformer form="rect" intensity={0.8} color="#fff1dc" position={[0, 5, 1]} scale={[6, 2, 1]} target={[0, 0, 0]} />
        {/* Cool kickers — a mirror needs sharp shapes to reflect, or chrome reads black. */}
        <Lightformer form="rect" intensity={2.2} color="#e4ecf5" position={[4, -1, 1]} scale={[0.5, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#f5efe6" position={[0, -3, 3]} scale={[8, 0.35, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.5} color="#fff4e2" position={[0, 0, 6]} scale={3} target={[0, 0, 0]} />
        {/* An even ring of dim softboxes around the spin axis. Polished gold
            only shows its colour when it has something to reflect — any gap
            here turns it bronze-brown at the angles that face the gap. */}
        {SOFTBOX_ANGLES.map((a) => (
          <Lightformer
            key={a}
            form="rect"
            intensity={0.55}
            color="#f6f5f2"
            position={[Math.sin(a) * 7, 0, Math.cos(a) * 7]}
            scale={[5.8, 8, 1]}
            target={[0, 0, 0]}
          />
        ))}
        <Lightformer form="rect" intensity={0.35} color="#ffffff" position={[0, -6, 0]} scale={[8, 8, 1]} target={[0, 0, 0]} />
      </Environment>
    </>
  );
}

// ---------------------------------------------------------------------------

export default function MedallionScene({ active = true }) {
  const pointer = useWindowPointer();
  const focus = useRef(CAMERA_END_Z);
  const [dpr, setDpr] = useState(1.75);
  const [ready, setReady] = useState(false);
  const stage = useRef();
  // Mark box centre (as -1..1 of the stage) and radius (fraction of stage
  // height): the medallion's home spot and size.
  const layout = useRef({ fx: 0, fy: 0, radius: 0.3 });

  useEffect(() => {
    const measure = () => {
      const st = stage.current.getBoundingClientRect();
      const mark = stage.current.parentElement.getBoundingClientRect();
      layout.current = {
        fx: ((mark.left + mark.width / 2 - st.left) / st.width) * 2 - 1,
        fy: -(((mark.top + mark.height / 2 - st.top) / st.height) * 2 - 1),
        radius: (mark.height * 0.42) / st.height,
      };
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const moleculeCount = useMemo(
    () => (typeof window !== 'undefined' && window.innerWidth < 700 ? 18 : 30),
    []
  );

  return (
    <div className="medallion-stage" ref={stage} style={{ opacity: ready ? 1 : 0 }}>
      <Canvas
        camera={{ position: [0, 0, CAMERA_START_Z], fov: 30, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        dpr={dpr}
        frameloop={active ? 'always' : 'never'} // rests while scrolled away
        shadows="soft"
        onCreated={() => setReady(true)}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
        <Lighting />
        <Suspense fallback={null}>
          <Medallion pointer={pointer} layout={layout} />
          <CameraRig focus={focus} />
        </Suspense>
        <Molecules count={moleculeCount} pointer={pointer} />
      </Canvas>
    </div>
  );
}
