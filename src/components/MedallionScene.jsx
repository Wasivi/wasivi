import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Set to e.g. '/models/medallion.glb' (draco-compressed) to swap the Meshy
// mesh in for the placeholder. Everything else in the scene stays the same.
const MEDALLION_URL = null;

const CAMERA_START_Z = 14;
const CAMERA_END_Z = 4.3;
const ENTRANCE_SECONDS = 3.4;
const SPIN_SPEED = 0.28; // rad/s — one turn every ~22s
const MAX_TILT = 0.2; // rad
const KEY_LIGHT_POS = new THREE.Vector3(-3.6, 2.4, 2.6);

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Materials — polished metal, two tones. Shared by the placeholder and the GLB.
// ---------------------------------------------------------------------------

const GOLD = { color: '#e8c47e', metalness: 0.92, roughness: 0.2, envMapIntensity: 1.1 };
const CHROME = { color: '#f2f1ec', metalness: 1, roughness: 0.1, envMapIntensity: 1.6 };

// ---------------------------------------------------------------------------
// Pointer — tracked across the whole window, not just the (small, round) canvas.
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
// Placeholder medallion: lathed gold coin with a bevelled rim + chrome ring.
// ---------------------------------------------------------------------------

function useCoinGeometry() {
  return useMemo(() => {
    // Half-profile (radius, height) from centre to edge; lathed around Y,
    // then rotated so the face points at the camera (+Z).
    const pts = [
      [0, 0.1],
      [0.18, 0.098],
      [0.3, 0.09],
      [0.32, 0.105], // inner raised ring
      [0.35, 0.105],
      [0.37, 0.088],
      [0.62, 0.075],
      [0.64, 0.095], // mid groove lip
      [0.66, 0.095],
      [0.68, 0.075],
      [0.84, 0.07],
      [0.88, 0.1], // rim bevel up
      [0.93, 0.105],
      [0.95, 0.06],
      [0.95, 0],
    ].map(([r, h]) => new THREE.Vector2(r, h));
    // Mirror for the back face.
    const back = pts
      .slice(0, -1)
      .reverse()
      .map((v) => new THREE.Vector2(v.x, -v.y));
    // Lathe profiles must run bottom -> top for outward-facing normals.
    const geo = new THREE.LatheGeometry([...pts, ...back].reverse(), 128);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, []);
}

function PlaceholderMedallion() {
  const coin = useCoinGeometry();
  return (
    <group>
      <mesh geometry={coin}>
        <meshStandardMaterial {...GOLD} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.99, 0.075, 48, 160]} />
        <meshStandardMaterial {...CHROME} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// GLB medallion (Meshy). Its baked textures are discarded; one material splits
// gold/chrome by distance from the centre so it works on a single fused mesh.
// ---------------------------------------------------------------------------

function MeshyMedallion({ url, ringStart = 0.86 }) {
  const { scene } = useGLTF(url); // draco decoder is on by default in drei
  const model = useMemo(() => {
    const root = scene.clone(true);
    // Normalise: centre at origin, outer radius 1 in the XY plane.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 2 / Math.max(size.x, size.y);
    root.position.copy(center).multiplyScalar(-scale);
    root.scale.setScalar(scale);

    const mat = new THREE.MeshStandardMaterial({ ...GOLD });
    const chrome = new THREE.Color(CHROME.color);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uChrome = { value: chrome };
      shader.uniforms.uRingStart = { value: ringStart };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vRadius;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvRadius = length((modelMatrix * vec4(position, 1.0)).xy - (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xy);'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying float vRadius;\nuniform vec3 uChrome;\nuniform float uRingStart;'
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float ring = smoothstep(uRingStart - 0.015, uRingStart + 0.015, vRadius);
          diffuseColor.rgb = mix(diffuseColor.rgb, uChrome, ring);
          roughnessFactor = mix(roughnessFactor, ${CHROME.roughness.toFixed(2)}, ring);`
        );
    };

    root.traverse((o) => {
      if (o.isMesh) {
        o.material = mat;
        o.geometry.computeVertexNormals();
      }
    });
    return root;
  }, [scene, ringStart]);

  return <primitive object={model} />;
}

// ---------------------------------------------------------------------------
// Medallion rig: continuous spin (inner group) + cursor tilt (outer group).
// ---------------------------------------------------------------------------

function Medallion({ pointer }) {
  const tilt = useRef();
  const spin = useRef();

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1); // avoid jumps after a backgrounded tab
    spin.current.rotation.y += dt * SPIN_SPEED * (prefersReducedMotion ? 0.4 : 1);

    const ease = 1 - Math.exp(-dt * 3); // frame-rate independent damping
    const tx = -pointer.current.y * MAX_TILT;
    const ty = pointer.current.x * MAX_TILT;
    tilt.current.rotation.x += (tx - tilt.current.rotation.x) * ease;
    tilt.current.rotation.y += (ty - tilt.current.rotation.y) * ease;
  });

  return (
    <group ref={tilt}>
      <group ref={spin}>
        {MEDALLION_URL ? <MeshyMedallion url={MEDALLION_URL} /> : <PlaceholderMedallion />}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Camera entrance: push in from far back, then hold. Starts once the
// medallion has mounted (it sits in the same Suspense boundary).
// ---------------------------------------------------------------------------

function CameraRig({ focus, onSettled }) {
  const camera = useThree((s) => s.camera);
  const t = useRef(prefersReducedMotion ? ENTRANCE_SECONDS : 0);
  const settled = useRef(false);

  useFrame((_, delta) => {
    t.current = Math.min(t.current + Math.min(delta, 0.05), ENTRANCE_SECONDS);
    const p = t.current / ENTRANCE_SECONDS;
    const e = 1 - Math.pow(1 - p, 4); // easeOutQuart: fast push, soft settle
    camera.position.z = THREE.MathUtils.lerp(CAMERA_START_Z, CAMERA_END_Z, e);
    focus.current = camera.position.z;
    if (p >= 1 && !settled.current) {
      settled.current = true;
      onSettled?.();
    }
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

  void main() {
    vec3 p = position;
    float t = uTime;
    // Slow wander + gentle rise, wrapped so motes recycle.
    p.x += sin(t * 0.13 + aSeed * 6.28) * 0.18 + sin(t * 0.07 + aSeed * 17.0) * 0.1;
    p.z += cos(t * 0.11 + aSeed * 9.1) * 0.18;
    p.y = mod(p.y + t * (0.025 + aSeed * 0.03) + 1.8, 3.6) - 1.8;
    float edgeFade = smoothstep(1.8, 1.4, abs(p.y));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    vBlur = clamp(abs(depth - uFocus) * uAperture, 0.0, 1.0);

    float bokeh = 1.0 + vBlur * 7.0;
    gl_PointSize = aSize * bokeh * uPixelRatio * uScale / depth;
    gl_Position = projectionMatrix * mv;

    // Catch the key light: brightest inside its cone, dim outside.
    vec3 toMote = normalize(p - uKeyPos);
    vec3 keyDir = normalize(-uKeyPos);
    float cone = smoothstep(0.82, 0.98, dot(toMote, keyDir));
    float lit = 0.18 + 0.82 * cone;
    // Occasional glint as a mote "turns" toward the light.
    float glint = pow(max(sin(t * (0.6 + aSeed) + aSeed * 40.0), 0.0), 24.0) * 1.5;

    // Spread energy over the larger disc so bokeh stays dim, not blown out.
    vAlpha = (lit + glint * cone) * edgeFade / (bokeh * bokeh * 0.35 + 0.65);
    vTint = aTint;
  }
`;

const dustFragment = /* glsl */ `
  uniform vec3 uGold;
  uniform vec3 uChrome;
  varying float vBlur;
  varying float vAlpha;
  varying float vTint;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    // Sharp motes: bright core, quick falloff. Blurred: flat disc, soft edge.
    float sharp = exp(-d * d * 7.0);
    float disc = 1.0 - smoothstep(0.7, 1.0, d);
    float shape = mix(sharp, disc * 0.6, vBlur);
    if (shape < 0.01) discard;
    vec3 col = mix(uGold, uChrome, vTint);
    // Premultiplied additive: alpha = brightness so glow composites cleanly
    // over the transparent canvas instead of punching dark holes in it.
    vec3 c = col * shape * vAlpha;
    gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
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
      positions[i * 3] = (Math.random() * 2 - 1) * 2.4;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * 1.8;
      positions[i * 3 + 2] = -2.5 + Math.random() * 5.2;
      seeds[i] = Math.random();
      sizes[i] = 0.9 + Math.pow(Math.random(), 3) * 2.2;
      tints[i] = Math.random() < 0.22 ? 0.85 : 0;
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
      uAperture: { value: 0.55 },
      uPixelRatio: { value: 1 },
      uScale: { value: 1 },
      uKeyPos: { value: KEY_LIGHT_POS.clone() },
      uGold: { value: new THREE.Color('#f0c877') },
      uChrome: { value: new THREE.Color('#d8dde2') },
    }),
    []
  );

  useFrame((_, delta) => {
    const u = material.current.uniforms;
    u.uTime.value += Math.min(delta, 0.1) * (prefersReducedMotion ? 0.3 : 1);
    u.uFocus.value = focus.current;
    u.uPixelRatio.value = dpr;
    u.uScale.value = size.height * 0.018; // point size tracks canvas size
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
// custom black studio environment whose only bright shapes echo the key —
// so reflections agree with the lighting instead of fighting it.
// ---------------------------------------------------------------------------

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.04} />
      <spotLight
        position={KEY_LIGHT_POS.toArray()}
        angle={0.55}
        penumbra={1}
        decay={0}
        intensity={5.5}
        color="#ffcf94"
      />
      <directionalLight position={[3, -1.2, -2]} intensity={0.35} color="#9fb2c6" />
      <Environment resolution={256} frames={1} environmentIntensity={0.9}>
        <color attach="background" args={['#000000']} />
        {/* Warm strip on the key side — the big glint that sweeps across. */}
        <Lightformer form="rect" intensity={6} color="#ffd29a" position={[-4, 2, 2]} scale={[1.2, 7, 1]} target={[0, 0, 0]} />
        {/* Soft overhead fill so the face never goes fully dead. */}
        <Lightformer form="rect" intensity={0.7} color="#fff1dc" position={[0, 5, 1]} scale={[6, 2, 1]} target={[0, 0, 0]} />
        {/* Cool kickers — a mirror needs sharp shapes to reflect, or chrome reads black. */}
        <Lightformer form="rect" intensity={2.2} color="#e4ecf5" position={[4, -1, 1]} scale={[0.5, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={1.2} color="#f5efe6" position={[0, -3, 3]} scale={[8, 0.35, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.5} color="#fff4e2" position={[0, 0, 6]} scale={3} target={[0, 0, 0]} />
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
    () => (typeof window !== 'undefined' && window.innerWidth < 700 ? 180 : 320),
    []
  );

  return (
    <div className="mark-placeholder" style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.8s ease' }}>
      <Canvas
        camera={{ position: [0, 0, CAMERA_START_Z], fov: 35, near: 0.1, far: 40 }}
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

if (MEDALLION_URL) useGLTF.preload(MEDALLION_URL);
