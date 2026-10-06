import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import schedule from './channelSchedule.json';

// The approved How We Work artwork (the "Gold Thread Through the Hidden Map"
// render with the gold string and mockup text removed), facing the viewer and
// breathing. As the show advances, a bronze skeleton grows through its walls,
// then gold and silver run through its existing channels inside that
// skeleton, so by the last scene the whole piece is filled.
//
// channels.png — R: how far along its channel a pixel is (0→1),
//                G: distance in from the channel's edge (0 = outside),
//                B: which channel.
// skin.png     — R: the locked almond outline, G: when the bronze skeleton
//                reaches each point (grows out from the centre).
// The metal is driven by the artwork's own brightness, so its fine lines,
// shadows and depth stay intact under the colour.

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

  const vec3 BACKGROUND = vec3(0.043, 0.039, 0.031);
  const vec3 GOLD_DULL = vec3(0.50, 0.40, 0.17);
  const vec3 GOLD_BRIGHT = vec3(0.86, 0.70, 0.33);
  // Silver kept soft — closer to matte pewter than mirror.
  const vec3 SILVER_MATTE = vec3(0.44, 0.45, 0.47);
  const vec3 SILVER_SHINY = vec3(0.68, 0.70, 0.72);
  const vec3 BRONZE = vec3(0.56, 0.38, 0.17); // metallic, not brown

  vec3 metal(float silver, float shade, float sheen) {
    vec3 gold = mix(GOLD_DULL, GOLD_BRIGHT, shade);
    vec3 silv = mix(SILVER_MATTE, SILVER_SHINY, shade);
    // Gold swings between bright and dull; silver between matte and a soft
    // sheen.
    float g = mix(0.65, 1.25, sheen * sheen);
    float s = mix(0.8, 1.12, pow(sheen, 3.0));
    return mix(gold * g, silv * s, silver);
  }

  // Map the artwork's brightness onto a metal: shadows take the colour but
  // stay deeper, the threads stand out brighter, the brightest catch a glint.
  vec3 metalize(float lum, vec3 m) {
    vec3 c = m * (0.42 + 1.7 * lum);
    return c + vec3(1.0, 0.96, 0.88) * pow(lum, 2.4) * 0.8;
  }

  void main() {
    // Breathing: a slow, visible swell and settle, with soft ripples running
    // through it like knit fabric inhaling.
    float breath = sin(uTime * 0.55);
    float swell = 1.0 + 0.022 * breath;
    vec2 d = (vUv - 0.5) / swell + 0.5;
    d += vec2(sin(d.y * 12.0 + uTime * 0.7), cos(d.x * 10.0 + uTime * 0.6)) * 0.0035;
    vec2 tc = uCrop.xy + d * uCrop.zw;

    vec3 art = texture2D(uArt, tc).rgb;
    float lum = dot(art, vec3(0.299, 0.587, 0.114));
    vec4 ch = texture2D(uChan, tc);
    vec4 sk = texture2D(uSkin, tc);
    float shape = sk.r; // the locked, balanced almond outline

    float along = ch.r;
    // G is distance in from the channel's edge. The channel's inner body
    // takes gold or silver; its border belongs to the bronze skeleton.
    float inside = smoothstep(0.2, 0.5, ch.g);
    float idx = floor(ch.b * 255.0 + 0.5);
    vec4 p = texture2D(uParams, vec2((idx + 0.5) / uCount, 0.5));

    vec3 col = art;

    // 1. Skeleton: bronze grows out from the centre through the walls and
    // around every channel, giving the piece its structure and detail.
    float skel = clamp((uSkinFill - sk.g) / 0.12, 0.0, 1.0) * (1.0 - inside);
    float skelSheen = 0.5 + 0.5 * sin(sk.g * 14.0 + tc.x * 6.0 - uTime * 0.5);
    col = mix(col, metalize(lum, BRONZE * mix(0.7, 1.3, pow(skelSheen, 3.0))), skel);

    // 2. Colour runs through the channels: each fills along its own contour,
    // gold or silver, with a soft leading edge.
    float fill = clamp((p.r - along) / 0.03, 0.0, 1.0) * inside;
    float edge = fill * (1.0 - fill) * 4.0;
    float sheen = 0.5 + 0.5 * sin(along * 9.0 - uTime * 0.9 + p.a * 6.2832);
    col = mix(col, metalize(lum, metal(p.g, p.b, sheen)), fill);
    col += vec3(1.0, 0.95, 0.8) * edge * lum * 0.6; // glint at the leading edge

    // The whole piece brightens a touch as it inhales.
    col *= 1.0 + 0.05 * breath;

    gl_FragColor = vec4(mix(BACKGROUND, col, shape), 1.0);
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
        uSkin: { value: loadTexture(SKIN) },
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
