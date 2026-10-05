import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// The approved How We Work artwork (the "Gold Thread Through the Hidden Map"
// render with the gold string and mockup text removed), facing the viewer and
// breathing. Colour fills its existing channels: the channel map's red channel
// says how far along a channel each pixel is (0 → 1), green marks the channel.
// A "screen" blend tints the dark spaces while every fine line stays brighter
// than the colour, so the linework stays intact.

const ART = '/images/How_We_Work/artwork.jpg';
const CHANNELS = '/images/How_We_Work/channels.png';
const SRC = { w: 1672, h: 941 };
// The part of the image the artwork occupies; it is drawn to fit this crop.
const VIEW = { x: 360, y: 80, w: 1260, h: 830 };
export const BACKGROUND = '#0b0a08'; // the artwork's own background

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uArt;
  uniform sampler2D uChan;
  uniform float uFill;
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec4 uCrop; // x, y (from bottom), w, h — normalised
  varying vec2 vUv;

  void main() {
    // Breathing: a slow swell plus soft ripples, like knit fabric inhaling.
    float swell = 1.0 + 0.008 * sin(uTime * 0.85);
    vec2 d = (vUv - 0.5) / swell + 0.5;
    d += vec2(sin(d.y * 18.0 + uTime * 0.8), cos(d.x * 14.0 + uTime * 0.7)) * 0.0015;
    vec2 tc = uCrop.xy + d * uCrop.zw;

    vec3 art = texture2D(uArt, tc).rgb;
    vec4 ch = texture2D(uChan, tc);
    float along = ch.r;
    float inside = ch.g;

    // Filled up to uFill along the channel, with a soft leading edge.
    float fill = clamp((uFill - along) / 0.03, 0.0, 1.0) * inside;
    float edge = fill * (1.0 - fill) * 4.0; // brightest right at the front

    // Living metal: a slow sheen travels along the channel, so the gold
    // shifts between bright and dull the way the logo's gold does.
    float sheen = 0.5 + 0.5 * sin(along * 9.0 - uTime * 0.9);
    float metal = mix(0.6, 1.25, sheen * sheen);
    vec3 tint = uColor * (fill * 0.75 * metal + edge * 0.35);
    vec3 col = 1.0 - (1.0 - art) * (1.0 - tint); // screen
    gl_FragColor = vec4(col, 1.0);
  }
`;

function loadTexture(url) {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.NoColorSpace; // raw in, raw out: colours match the file
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function Artwork({ fill }) {
  const size = useThree((s) => s.size);
  const material = useRef();
  const uniforms = useMemo(
    () => ({
      uArt: { value: loadTexture(ART) },
      uChan: { value: loadTexture(CHANNELS) },
      uFill: { value: 0 },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#a8873a') }, // muted gold
      uCrop: {
        value: new THREE.Vector4(
          VIEW.x / SRC.w,
          1 - (VIEW.y + VIEW.h) / SRC.h,
          VIEW.w / SRC.w,
          VIEW.h / SRC.h
        ),
      },
    }),
    []
  );

  useFrame((_, delta) => {
    const u = material.current.uniforms;
    if (!prefersReducedMotion) u.uTime.value += Math.min(delta, 0.1);
    u.uFill.value = fill.current;
  });

  // Fit the artwork's crop inside the canvas, keeping its proportions.
  const scale = Math.min(size.width / VIEW.w, size.height / VIEW.h);
  return (
    <mesh scale={[VIEW.w * scale, VIEW.h * scale, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function ChannelArt({ fill }) {
  return (
    <Canvas
      orthographic
      flat
      linear
      camera={{ position: [0, 0, 10], zoom: 1 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
      style={{ background: BACKGROUND }}
    >
      <Artwork fill={fill} />
    </Canvas>
  );
}
