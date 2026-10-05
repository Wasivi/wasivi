import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import schedule from './channelSchedule.json';

// The approved How We Work artwork (the "Gold Thread Through the Hidden Map"
// render with the gold string and mockup text removed), facing the viewer and
// breathing. As the journey advances, its existing channels fill with shades
// of gold and silver — the skeleton — and then the skin spreads over the rest
// of the surface, so by the last slide the whole piece is filled.
//
// channels.png — R: how far along its channel a pixel is (0→1),
//                G: inside a channel, B: which channel.
// skin.png     — R: the artwork's surface, G: when the skin reaches it,
//                B: nearest channel (the skin takes on its metal).
// A "screen" blend tints the dark spaces while every fine line stays brighter
// than the colour, so the linework stays intact.

const ART = '/images/How_We_Work/artwork.jpg';
const CHANNELS = '/images/How_We_Work/channels.png';
const SKIN = '/images/How_We_Work/skin.png';
const SRC = { w: 1672, h: 941 };
// The part of the image the artwork occupies; it is drawn to fit this crop.
const VIEW = { x: 360, y: 80, w: 1260, h: 830 };
export const BACKGROUND = '#0b0a08'; // the artwork's own background
const K = schedule.channels.length;

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const clamp = (x) => Math.max(0, Math.min(1, x));

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
  uniform sampler2D uSkin;
  uniform sampler2D uParams; // per channel: R fill, G silver, B shade, A phase
  uniform float uCount;
  uniform float uSkinFill;
  uniform float uTime;
  uniform vec4 uCrop; // x, y (from bottom), w, h — normalised
  varying vec2 vUv;

  const vec3 GOLD_DULL = vec3(0.50, 0.40, 0.17);
  const vec3 GOLD_BRIGHT = vec3(0.86, 0.70, 0.33);
  const vec3 SILVER_MATTE = vec3(0.55, 0.57, 0.60);
  const vec3 SILVER_SHINY = vec3(0.90, 0.92, 0.95);

  vec3 metal(float silver, float shade, float sheen) {
    vec3 gold = mix(GOLD_DULL, GOLD_BRIGHT, shade);
    vec3 silv = mix(SILVER_MATTE, SILVER_SHINY, shade);
    // Gold swings between bright and dull; silver between matte and shiny
    // (a sharper glint).
    float g = mix(0.65, 1.25, sheen * sheen);
    float s = mix(0.7, 1.4, pow(sheen, 4.0));
    return mix(gold * g, silv * s, silver);
  }

  void main() {
    // Breathing: a slow swell plus soft ripples, like knit fabric inhaling.
    float swell = 1.0 + 0.008 * sin(uTime * 0.85);
    vec2 d = (vUv - 0.5) / swell + 0.5;
    d += vec2(sin(d.y * 18.0 + uTime * 0.8), cos(d.x * 14.0 + uTime * 0.7)) * 0.0015;
    vec2 tc = uCrop.xy + d * uCrop.zw;

    vec3 art = texture2D(uArt, tc).rgb;
    vec4 ch = texture2D(uChan, tc);
    float along = ch.r;
    float inside = step(0.5, ch.g);
    float idx = floor(ch.b * 255.0 + 0.5);
    vec4 p = texture2D(uParams, vec2((idx + 0.5) / uCount, 0.5));

    // Skeleton: each channel fills along its own contour, soft leading edge.
    float fill = clamp((p.r - along) / 0.03, 0.0, 1.0) * inside;
    float edge = fill * (1.0 - fill) * 4.0;
    float sheen = 0.5 + 0.5 * sin(along * 9.0 - uTime * 0.9 + p.a * 6.2832);
    vec3 tint = metal(p.g, p.b, sheen) * (fill * 0.8) + vec3(1.0, 0.95, 0.8) * edge * 0.3;

    // Skin: grows out from the filled channels over the rest of the surface,
    // each area taking the gold or silver of its nearest channel, so the
    // colour follows the motif's structure rather than lying over it.
    vec4 sk = texture2D(uSkin, tc);
    float skin = clamp((uSkinFill - sk.g) / 0.06, 0.0, 1.0) * sk.r * (1.0 - inside);
    vec4 near = texture2D(uParams, vec2((floor(sk.b * 255.0 + 0.5) + 0.5) / uCount, 0.5));
    float skinSheen = 0.5 + 0.5 * sin(sk.g * 14.0 - uTime * 0.6 + near.a * 6.2832);
    // Lighter than the channels, so the fine lines read through the skin.
    tint += metal(near.g, near.b * 0.7, skinSheen) * skin * 0.42;

    vec3 col = 1.0 - (1.0 - art) * (1.0 - tint); // screen
    gl_FragColor = vec4(col, 1.0);
  }
`;

function loadTexture(url, nearest = false) {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.NoColorSpace; // raw in, raw out: colours match the file
  // Channel indices must never be blended between neighbouring pixels.
  tex.minFilter = tex.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function Artwork({ progress }) {
  const size = useThree((s) => s.size);
  const material = useRef();
  const { uniforms, params } = useMemo(() => {
    const data = new Uint8Array(K * 4);
    schedule.channels.forEach((c, k) => {
      data[k * 4 + 1] = c.silver * 255;
      data[k * 4 + 2] = Math.round(c.shade * 255);
      data[k * 4 + 3] = Math.round(c.phase * 255);
    });
    const tex = new THREE.DataTexture(data, K, 1, THREE.RGBAFormat);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return {
      params: tex,
      uniforms: {
        uArt: { value: loadTexture(ART) },
        uChan: { value: loadTexture(CHANNELS, true) },
        uSkin: { value: loadTexture(SKIN, true) },
        uParams: { value: tex },
        uCount: { value: K },
        uSkinFill: { value: 0 },
        uTime: { value: 0 },
        uCrop: {
          value: new THREE.Vector4(
            VIEW.x / SRC.w,
            1 - (VIEW.y + VIEW.h) / SRC.h,
            VIEW.w / SRC.w,
            VIEW.h / SRC.h
          ),
        },
      },
    };
  }, []);

  useFrame((_, delta) => {
    const u = material.current.uniforms;
    if (!prefersReducedMotion) u.uTime.value += Math.min(delta, 0.1);
    // Journey position in slides (0–11): each channel's fill follows the
    // schedule, so scrolling drives it, stopping holds it, back reverses it.
    const q = progress.current;
    const data = params.image.data;
    schedule.channels.forEach((c, k) => {
      data[k * 4] = Math.round(clamp((q - c.start) / (c.end - c.start)) * 255);
    });
    params.needsUpdate = true;
    u.uSkinFill.value = clamp((q - schedule.skin.start) / (schedule.skin.end - schedule.skin.start)) * 1.06;
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

export default function ChannelArt({ progress }) {
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
      <Artwork progress={progress} />
    </Canvas>
  );
}
