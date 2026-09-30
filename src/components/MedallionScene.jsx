import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import glyph from './medallionGlyph.json';

// Units: the chrome ring's outer radius is 1. The glyph outline was traced
// from the hero.mp4 motif, snapped to its grid and made symmetric.

const CAMERA_START_Z = 24;
const CAMERA_END_Z = 6.8;
const ENTRANCE_SECONDS = 3.4;
const SPIN_SPEED = 0.3; // rad/s — one turn every ~21s
const MAX_TILT = 0.22; // rad
const KEY_LIGHT_POS = new THREE.Vector3(-3.6, 2.4, 2.6);

const GLYPH_DEPTH = 1.2;
const GLYPH_Z = -GLYPH_DEPTH / 2; // centred: the glyph juts out of both sides of the ring
const RING_INNER = 0.87;
const RING_DEPTH = 0.34;

// Dev only: /?angle=150 freezes the spin at that many degrees, for tuning.
const FROZEN_ANGLE = import.meta.env.DEV
  ? Number(new URLSearchParams(window.location.search).get('angle') ?? NaN)
  : NaN;

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

function MedallionBody() {
  const glyphGeo = useGlyphGeometry();
  const ringGeo = useRingGeometry();
  const brushed = useBrushedTexture();

  return (
    <group>
      {/* ExtrudeGeometry groups: 0 = front/back caps, 1 = side walls. */}
      <mesh geometry={glyphGeo}>
        <meshStandardMaterial
          attach="material-0"
          color="#cdb43e"
          metalness={0.95}
          roughness={0.4}
          roughnessMap={brushed}
          bumpMap={brushed}
          bumpScale={0.35}
          envMapIntensity={1}
        />
        <meshStandardMaterial
          attach="material-1"
          color="#a19e96"
          metalness={1}
          roughness={0.32}
          envMapIntensity={1}
        />
      </mesh>

      {/* True black face, recessed inside the ring. Unlit on purpose: even a
          4% reflection of the warm key light reads as brown on black. */}
      <mesh position={[0, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[RING_INNER + 0.005, RING_INNER + 0.005, 0.03, 128]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      <mesh geometry={ringGeo}>
        <meshStandardMaterial color="#f1f0ec" metalness={1} roughness={0.08} envMapIntensity={1.6} />
      </mesh>
    </group>
  );
}

// Continuous spin (inner group) + cursor tilt (outer group).
function Medallion({ pointer }) {
  const tilt = useRef();
  const spin = useRef();

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1); // no jump after a backgrounded tab
    if (Number.isFinite(FROZEN_ANGLE)) spin.current.rotation.y = THREE.MathUtils.degToRad(FROZEN_ANGLE);
    else spin.current.rotation.y += dt * SPIN_SPEED * (prefersReducedMotion ? 0.4 : 1);

    const ease = 1 - Math.exp(-dt * 3); // frame-rate independent damping
    const tx = -pointer.current.y * MAX_TILT;
    const ty = pointer.current.x * MAX_TILT;
    tilt.current.rotation.x += (tx - tilt.current.rotation.x) * ease;
    tilt.current.rotation.y += (ty - tilt.current.rotation.y) * ease;
  });

  return (
    <group ref={tilt}>
      <group ref={spin}>
        <MedallionBody />
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
    gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
  }
`;

function GoldDust({ count, focus }) {
  const material = useRef();
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
      positions[i * 3] = (Math.random() * 2 - 1) * 2.8;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * 2.2;
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
      uGold: { value: new THREE.Color('#f4db6e') },
      uChrome: { value: new THREE.Color('#eef1f4') },
    }),
    []
  );

  useFrame((_, delta) => {
    const u = material.current.uniforms;
    u.uTime.value += Math.min(delta, 0.1) * (prefersReducedMotion ? 0.3 : 1);
    u.uFocus.value = focus.current;
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
        blending={THREE.AdditiveBlending}
        premultipliedAlpha
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Lighting: one warm raking key, faint cool rim, near-zero ambient, and a
// black studio environment whose bright shapes echo the key — so reflections
// agree with the lighting instead of fighting it.
// ---------------------------------------------------------------------------

const SOFTBOX_ANGLES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.05} />
      <spotLight
        position={KEY_LIGHT_POS.toArray()}
        angle={0.55}
        penumbra={1}
        decay={0}
        intensity={5.5}
        color="#ffdcaa"
      />
      <directionalLight position={[3, -1.2, -2]} intensity={0.4} color="#9fb2c6" />
      <Environment resolution={256} frames={1} environmentIntensity={0.9}>
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

export default function MedallionScene() {
  const pointer = useWindowPointer();
  const focus = useRef(CAMERA_END_Z);
  const [dpr, setDpr] = useState(1.75);
  const [ready, setReady] = useState(false);
  const dustCount = useMemo(
    () => (typeof window !== 'undefined' && window.innerWidth < 700 ? 200 : 360),
    []
  );

  return (
    <div className="medallion-stage" style={{ opacity: ready ? 1 : 0 }}>
      <Canvas
        camera={{ position: [0, 0, CAMERA_START_Z], fov: 30, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        dpr={dpr}
        onCreated={() => setReady(true)}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
        <Lighting />
        <Suspense fallback={null}>
          <Medallion pointer={pointer} />
          <CameraRig focus={focus} />
        </Suspense>
        <GoldDust count={dustCount} focus={focus} />
      </Canvas>
    </div>
  );
}
