import { useRef } from 'react';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import { Sparkles, shaderMaterial, useTexture } from '@react-three/drei';
import * as THREE from 'three';

const IMAGE_ASPECT = 1672 / 941;
const PLANE_HEIGHT = 2.1;
const PLANE_WIDTH = PLANE_HEIGHT * IMAGE_ASPECT;

// Anchor points (local scene units) the gold thread travels to, one per step.
// Rough, eyeballed against the sculpture image — nudge once it's live.
export const THREAD_ANCHORS = [
  new THREE.Vector3(-0.95, 0.18, 0.04),
  new THREE.Vector3(-0.05, 0.68, 0.04),
  new THREE.Vector3(0.75, -0.18, 0.04),
  new THREE.Vector3(1.05, 0.5, 0.04),
  new THREE.Vector3(0.15, -0.72, 0.04),
];

const THREAD_START = new THREE.Vector3(-PLANE_WIDTH / 2 - 0.9, 0.15, 0.5);

// Custom material: applies a subtle "breathing" brightness pulse and a soft
// radial vignette so the sculpture's flat black background disappears into
// the scene instead of reading as a rectangle.
const SculptureMaterial = shaderMaterial(
  { map: null, uBreath: 1 },
  /* vertex */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* fragment */ `
    uniform sampler2D map;
    uniform float uBreath;
    varying vec2 vUv;
    void main() {
      vec3 color = texture2D(map, vUv).rgb * uBreath;
      float dist = distance(vUv, vec2(0.5));
      float alpha = 1.0 - smoothstep(0.42, 0.5, dist);
      gl_FragColor = vec4(color, alpha);
    }
  `
);
extend({ SculptureMaterial });

function Sculpture({ breath }) {
  const texture = useTexture('/images/How_We_Work/Asymmetrical blackened metal sculpture.png');
  const matRef = useRef();

  useFrame(() => {
    if (matRef.current) matRef.current.uBreath = breath.current;
  });

  return (
    <mesh>
      <planeGeometry args={[PLANE_WIDTH, PLANE_HEIGHT]} />
      {/* eslint-disable-next-line react/no-unknown-property */}
      <sculptureMaterial ref={matRef} map={texture} transparent />
    </mesh>
  );
}

function GoldThread({ activeIndex }) {
  const current = useRef(THREAD_ANCHORS[0].clone());
  const target = useRef(THREAD_ANCHORS[0].clone());
  const tubeRef = useRef();
  const pulseRef = useRef();
  const pulseT = useRef(0);
  const lastRebuild = useRef(0);

  useFrame((state, delta) => {
    target.current.copy(THREAD_ANCHORS[activeIndex] ?? THREAD_ANCHORS[0]);
    const moving = current.current.distanceTo(target.current) > 0.001;
    if (moving) {
      current.current.lerp(target.current, Math.min(delta * 2.2, 1));
    }

    // Throttle geometry rebuilds — only while transitioning, a few times a second.
    lastRebuild.current += delta;
    if ((moving || lastRebuild.current > 5) && lastRebuild.current > 0.05 && tubeRef.current) {
      lastRebuild.current = 0;
      const mid = THREAD_START.clone().lerp(current.current, 0.5).add(
        new THREE.Vector3(0, 0.35, 0.25)
      );
      const curve = new THREE.CatmullRomCurve3([THREAD_START, mid, current.current]);
      tubeRef.current.geometry.dispose();
      tubeRef.current.geometry = new THREE.TubeGeometry(curve, 48, 0.012, 8, false);

      pulseRef.current.userData.curve = curve;
    }

    // Traveling pulse of light along the thread, "breathing" life into it.
    pulseT.current = (pulseT.current + delta * 0.18) % 1;
    const curve = pulseRef.current?.userData.curve;
    if (curve) {
      const t = 0.5 - 0.5 * Math.cos(pulseT.current * Math.PI * 2); // ease back and forth
      const p = curve.getPointAt(t);
      pulseRef.current.position.copy(p);
    }
  });

  return (
    <group>
      <mesh ref={tubeRef}>
        <tubeGeometry args={[new THREE.CatmullRomCurve3([THREAD_START, THREAD_START, THREAD_START]), 2, 0.012, 8, false]} />
        <meshStandardMaterial
          color="#a89c3e"
          emissive="#a89c3e"
          emissiveIntensity={1.1}
          metalness={1}
          roughness={0.28}
        />
      </mesh>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshBasicMaterial color="#f4ecc0" />
      </mesh>
    </group>
  );
}

function Scene({ activeIndex }) {
  const breath = useRef(1);
  const group = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Two overlaid slow sine waves so the pulse feels organic, not metronomic.
    breath.current = 1 + Math.sin(t * 0.55) * 0.018 + Math.sin(t * 1.15 + 1.3) * 0.009;
    if (group.current) {
      group.current.scale.setScalar(breath.current);
      const targetY = state.pointer.x * 0.12;
      const targetX = -state.pointer.y * 0.08;
      group.current.rotation.x += (targetX - group.current.rotation.x) * 0.05;
      group.current.rotation.y += (targetY - group.current.rotation.y) * 0.05;
    }
  });

  return (
    <>
      <fog attach="fog" args={['#15130f', 2.2, 6]} />
      <ambientLight intensity={0.5} color="#c7c7c2" />
      <pointLight position={[2, 2, 2.5]} intensity={1.1} color="#a89c3e" />
      <pointLight position={[-2, -1, -1.5]} intensity={0.4} color="#c7c7c2" />
      <Sparkles count={50} scale={4} size={1.6} speed={0.2} opacity={0.35} color="#a89c3e" />
      <group ref={group}>
        <Sculpture breath={breath} />
        <GoldThread activeIndex={activeIndex} />
      </group>
    </>
  );
}

export default function HowWeWorkScene({ activeIndex }) {
  return (
    <div className="how-we-work-scene">
      <Canvas
        camera={{ position: [0, 0, 3.4], fov: 42 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <Scene activeIndex={activeIndex} />
      </Canvas>
    </div>
  );
}
