import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles, useVideoTexture } from '@react-three/drei';

const MAX_TILT = (14 * Math.PI) / 180; // matches the old CSS tilt's 14deg max

function Mark() {
  const texture = useVideoTexture('/videos/hero.mp4', {
    muted: true,
    loop: true,
    start: true,
  });
  const group = useRef();

  useFrame((state, delta) => {
    if (!group.current) return;
    const targetY = state.pointer.x * MAX_TILT;
    const targetX = -state.pointer.y * MAX_TILT;
    const ease = Math.min(delta * 6, 1);
    group.current.rotation.x += (targetX - group.current.rotation.x) * ease;
    group.current.rotation.y += (targetY - group.current.rotation.y) * ease;
  });

  return (
    <group ref={group} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial map={texture} roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  );
}

function Atmosphere() {
  return (
    <>
      <fog attach="fog" args={['#15130f', 1.6, 4.2]} />
      <ambientLight intensity={0.55} color="#c7c7c2" />
      <pointLight position={[2, 2, 2.5]} intensity={1.4} color="#a89c3e" />
      <pointLight position={[-2, -1.2, -1.5]} intensity={0.5} color="#c7c7c2" />
      <Sparkles count={70} scale={3} size={2} speed={0.25} opacity={0.45} color="#a89c3e" />
    </>
  );
}

export default function HeroScene() {
  return (
    <div className="mark-placeholder">
      <Canvas
        camera={{ position: [0, 0, 2.6], fov: 38 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <Atmosphere />
        <Suspense fallback={null}>
          <Mark />
        </Suspense>
      </Canvas>
    </div>
  );
}
