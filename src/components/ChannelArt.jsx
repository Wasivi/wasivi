import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import schedule from './channelSchedule.json';
import { useTheme } from './ThemeToggle';

// The approved How We Work artwork (the "Gold Thread Through the Hidden Map"
// render with the gold string and mockup text removed), built as a real
// relief sculpture: the almond is domed like a cast slab, its walls stand up
// and its channels are carved in, lit by fixed lights while the camera
// drifts around it (and follows the pointer), so the depth reads. As the
// show advances, a bronze skeleton grows through its walls, then gold and
// silver pour into its channels and rise in them, so by the last scene the
// whole piece is filled.
//
// channels.png — R: how far along its channel a pixel is (0→1),
//                G: distance in from the channel's edge (0 = outside),
//                B: which channel.
// skin.png     — R: the locked almond outline, G: when the bronze skeleton
//                reaches each point (grows out from the centre).
// The relief's height is derived from these at load (see buildHeight).

const ART = '/images/How_We_Work/artwork.jpg';
const CHANNELS = '/images/How_We_Work/channels.png';
const SKIN = '/images/How_We_Work/skin.png';
const SRC = { w: 1672, h: 941 };
// The part of the image the artwork occupies; the sculpture is cut to this.
const VIEW = { x: 320, y: 60, w: 1340, h: 870 };
const K = schedule.channels.length;

// Sculpture size in scene units, and how far its relief stands out.
const HEIGHT = 2;
const WIDTH = (HEIGHT * VIEW.w) / VIEW.h;
const DEPTH = 0.55; // dome peak; channels are carved a fraction of this
const FOV = 30;

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const clamp = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Separable box blur, in place; three passes approximate a gaussian.
function blur(src, w, h, r, passes = 3) {
  const tmp = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      const row = y * w;
      for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc / (2 * r + 1);
        acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        src[y * w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
  return src;
}

function pixels(img, w, h, smooth) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = smooth;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

// Height of the relief over the whole image, 0 (background) to ~1 (crown of
// the dome): a slab with a narrow rounded edge and a broad, domed top, its
// channels carved in with soft rounded floors.
function buildHeight(skinImg, chanImg, artImg) {
  const w = SRC.w >> 1;
  const h = SRC.h >> 1;
  const skin = pixels(skinImg, w, h, true);
  const chan = pixels(chanImg, w, h, false);
  const art = pixels(artImg, w, h, true);
  // The artwork's own engraving: its dark lines are cut into the metal.
  const cut = new Float32Array(w * h);
  const mask = new Float32Array(w * h);
  const carve = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    // The outline file is feathered in places; the sculpture needs a crisp
    // edge, or that feather turns into a see-through band when it turns.
    mask[i] = smoothstep(0.85, 0.97, skin[i * 4] / 255);
    carve[i] = smoothstep(0.04, 0.4, chan[i * 4 + 1] / 255);
    const lum = (0.299 * art[i * 4] + 0.587 * art[i * 4 + 1] + 0.114 * art[i * 4 + 2]) / 255;
    cut[i] = 1 - smoothstep(0.04, 0.32, lum);
  }
  // A gently rolled edge and a broad crown — every slope shallow enough to
  // keep the design on it when the piece turns.
  const rim = blur(Float32Array.from(mask), w, h, Math.round(w * 0.045));
  const dome = blur(Float32Array.from(mask), w, h, Math.round(w * 0.07));
  blur(carve, w, h, 3, 3); // soft channel walls, so they don't streak side-on
  blur(cut, w, h, 2, 2);
  const data = new Uint16Array(w * h);
  for (let i = 0; i < w * h; i++) {
    // The edge rolls over gently from zero on the outline: never steep
    // enough for the design to smear into plain metal when seen side-on.
    const body = smoothstep(0.5, 1.0, rim[i]);
    const crown = smoothstep(0.25, 1.0, dome[i]);
    // Carved in all over, edge included: the artwork's lines are cut into
    // the whole surface, and the rolled edge carries grooves that follow
    // the outline, like the skeleton's ribs — never a plain smooth band.
    const edge = mask[i] * (1 - smoothstep(0.75, 0.98, rim[i]));
    const ribs = 0.5 + 0.5 * Math.cos(rim[i] * Math.PI * 2 * 9);
    const z = body * (0.35 + crown * 0.65)
      - carve[i] * 0.22 * body
      - cut[i] * 0.03 * mask[i]
      - ribs * edge * 0.045;
    data[i] = THREE.DataUtils.toHalfFloat(z);
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.HalfFloatType);
  tex.flipY = true; // match the image textures' orientation
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function loadTexture(url, nearest = false) {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.NoColorSpace; // raw in, raw out: colours match the file
  // Channel indices must never be blended between neighbouring pixels.
  tex.minFilter = tex.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

const shared = /* glsl */ `
  uniform sampler2D uHeight;
  uniform sampler2D uChan;
  uniform sampler2D uParams; // per channel: R fill, G silver, B shade, A phase
  uniform float uCount;
  uniform vec4 uCrop; // x, y (from bottom), w, h — normalised
  uniform float uDepth;
  uniform float uTime;
  uniform sampler2D uSkin;
  uniform float uBreath; // the whole piece's breath: 0 out, 1 in

  // Breathing is delicate and everywhere: every piece — each channel, each
  // stretch of wall — swells and settles on its own slow breath (~10s),
  // out of step with its neighbours. Nothing moves as a whole.
  float pieceBreath(vec2 tc, vec4 ch, vec4 p, float inside) {
    float wallPhase = texture2D(uSkin, tc).g * 9.0 + tc.x * 5.0 + tc.y * 3.0;
    float phase = mix(wallPhase, p.a * 6.2832, inside);
    return sin(uTime * 0.63 + phase);
  }

  const float POUR_SOFT = 0.4;

  // How far a channel's poured metal has risen at this point (0–1).
  float pour(vec2 tc, out vec4 ch, out vec4 p) {
    ch = texture2D(uChan, tc);
    float inside = smoothstep(0.2, 0.5, ch.g);
    float idx = floor(ch.b * 255.0 + 0.5);
    p = texture2D(uParams, vec2((idx + 0.5) / uCount, 0.5));
    // A long, soft front: colour seeps along the channel gradually rather
    // than wiping across it.
    float f = clamp((p.r * (1.0 + POUR_SOFT) - ch.r) / POUR_SOFT, 0.0, 1.0);
    return f * f * (3.0 - 2.0 * f) * inside;
  }
`;

const vertexShader = /* glsl */ `
  ${shared}
  varying vec2 vTc;
  varying vec3 vWorld;
  varying float vBreath;

  void main() {
    vTc = uCrop.xy + uv * uCrop.zw;
    // Knit-fabric ripple: soft waves run through the surface as it breathes.
    vTc += vec2(sin(uv.y * 12.0 + uTime * 0.5), cos(uv.x * 10.0 + uTime * 0.42))
      * 0.0035 * uCrop.zw * (0.4 + 0.6 * uBreath);
    vec4 ch; vec4 p;
    float fill = pour(vTc, ch, p);
    float inside = smoothstep(0.2, 0.5, ch.g);
    float b = pieceBreath(vTc, ch, p, inside);
    vBreath = b;
    // Poured metal rises most of the way up its channel; each piece lifts
    // and sinks a little with its breath.
    float h = texture2D(uHeight, vTc).r;
    // The whole relief heaves up on the breath in and settles on the breath
    // out; each piece adds its own small breath on top.
    float heave = 0.85 + 0.3 * uBreath;
    float z = (h * heave + fill * 0.1 + b * 0.05 * step(0.001, h)) * uDepth;
    vec4 world = modelMatrix * vec4(position.xy, z, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  ${shared}
  uniform sampler2D uArt;
  uniform float uSkinFill;
  uniform vec2 uTexel; // one height-map texel, in image uv
  uniform vec2 uSize;  // sculpture size in scene units
  uniform mat3 uNormalMat; // turns the relief's normals with the sculpture
  varying vec2 vTc;
  varying vec3 vWorld;
  varying float vBreath;
  uniform float uLight; // 0 = night, 1 = daylight (light theme)

  const vec3 GOLD_DULL = vec3(0.50, 0.40, 0.17);
  const vec3 GOLD_BRIGHT = vec3(0.86, 0.70, 0.33);
  // Silver kept soft — closer to matte pewter than mirror.
  const vec3 SILVER_MATTE = vec3(0.44, 0.45, 0.47);
  const vec3 SILVER_SHINY = vec3(0.68, 0.70, 0.72);
  const vec3 BRONZE = vec3(0.56, 0.38, 0.17); // metallic, not brown

  vec3 metal(float silver, float shade, float sheen) {
    vec3 gold = mix(GOLD_DULL, GOLD_BRIGHT, shade);
    vec3 silv = mix(SILVER_MATTE, SILVER_SHINY, shade);
    float g = mix(0.65, 1.25, sheen * sheen);
    float s = mix(0.8, 1.12, pow(sheen, 3.0));
    return mix(gold * g, silv * s, silver);
  }

  // Map the artwork's brightness onto a metal: shadows take the colour but
  // stay deeper, the threads stand out brighter, the brightest catch a glint.
  vec3 metalize(float lum, vec3 m) {
    // In daylight the metal's shadows stay lighter, so gold never goes brown.
    vec3 c = m * mix(0.42 + 1.7 * lum, 0.78 + 1.0 * lum, uLight);
    return c + vec3(1.0, 0.96, 0.88) * pow(lum, 2.4) * 0.8;
  }

  float lumAt(vec2 tc) { return dot(texture2D(uArt, tc).rgb, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec4 sk = texture2D(uSkin, vTc);
    float shape = smoothstep(0.85, 0.97, sk.r); // the locked almond outline, crisp
    if (shape < 0.02) discard;

    vec3 art = texture2D(uArt, vTc).rgb;
    float lum = dot(art, vec3(0.299, 0.587, 0.114));
    vec4 ch; vec4 p;
    float fill = pour(vTc, ch, p);
    float inside = smoothstep(0.2, 0.5, ch.g);

    // Surface normal from the relief's slope, plus the artwork's own fine
    // engraving so every thread catches the light.
    vec2 e = uTexel;
    float hx = texture2D(uHeight, vTc + vec2(e.x, 0.0)).r - texture2D(uHeight, vTc - vec2(e.x, 0.0)).r;
    float hy = texture2D(uHeight, vTc + vec2(0.0, e.y)).r - texture2D(uHeight, vTc - vec2(0.0, e.y)).r;
    vec2 step = 2.0 * e / uCrop.zw * uSize; // scene units across the samples
    vec2 slope = vec2(hx, hy) * uDepth / step;
    vec2 f = e * 0.5;
    float lx = lumAt(vTc + vec2(f.x, 0.0)) - lumAt(vTc - vec2(f.x, 0.0));
    float ly = lumAt(vTc + vec2(0.0, f.y)) - lumAt(vTc - vec2(0.0, f.y));
    // Poured metal settles smooth, so the engraving fades under it.
    slope += vec2(lx, ly) * 6.0 * (1.0 - 0.7 * fill);
    vec3 n = normalize(uNormalMat * vec3(-slope, 1.0));

    // Colour, as before: bronze skeleton through the walls, then gold and
    // silver along each channel.
    vec3 col = art;
    // Daylight: the same carving, cast in pale pewter and plaster instead of
    // blackened metal. Grooves stay a soft warm grey; ridges go near white.
    vec3 plaster = mix(vec3(0.60, 0.59, 0.56), vec3(0.97, 0.96, 0.93), smoothstep(0.02, 0.55, lum));
    col = mix(col, plaster, uLight);
    float skel = smoothstep(0.0, 1.0, (uSkinFill - sk.g) / 0.35) * (1.0 - inside);
    float skelSheen = 0.5 + 0.5 * sin(sk.g * 14.0 + vTc.x * 6.0 - uTime * 0.5);
    // In daylight the skeleton is champagne brass rather than bronze.
    vec3 skelMetal = mix(BRONZE, vec3(0.80, 0.70, 0.45), uLight);
    col = mix(col, metalize(lum, skelMetal * mix(0.7, 1.3, pow(skelSheen, 3.0))), skel);
    float sheen = 0.5 + 0.5 * sin(ch.r * 9.0 - uTime * 0.9 + p.a * 6.2832);
    col = mix(col, metalize(lum, metal(p.g, p.b, sheen)), fill);
    float edge = fill * (1.0 - fill) * 4.0;
    col += vec3(1.0, 0.95, 0.8) * edge * lum * 0.25; // soft glow along the front
    float metalness = max(skel, fill);

    // Lighting: a key from the upper left, a cool fill from the right, a
    // neutral rim from behind-above. Neutral lights, so gold stays gold.
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 L1 = normalize(vec3(-0.55, 0.6, 0.75));
    vec3 L2 = normalize(vec3(0.8, -0.15, 0.55));
    vec3 L3 = normalize(vec3(0.1, 0.9, -0.1));
    float d1 = max(dot(n, L1), 0.0);
    float d2 = max(dot(n, L2), 0.0);
    float d3 = max(dot(n, L3), 0.0);
    // Metal never sinks so deep in shadow that gold or bronze turns brown.
    // Daylight is softer and fuller: more ambient, gentler key.
    float amb = mix(mix(0.3, 0.5, metalness), 0.62, uLight);
    float key = mix(1.0, 0.55, uLight);
    vec3 lit = col * (amb + key * d1 + 0.35 * d2 + 0.25 * d3);
    float s1 = pow(max(dot(n, normalize(L1 + v)), 0.0), mix(24.0, 60.0, metalness));
    float s2 = pow(max(dot(n, normalize(L2 + v)), 0.0), 40.0);
    vec3 tint = mix(vec3(0.75), normalize(col + 0.001) * 1.5, metalness);
    lit += tint * (s1 * 0.9 + s2 * 0.35) * mix(0.25, 1.0, metalness) * (0.3 + lum);

    // The piece brightens a touch as it breathes in, each part on its own.
    lit *= 0.95 + 0.08 * uBreath + 0.06 * vBreath;
    gl_FragColor = vec4(lit, smoothstep(0.02, 0.6, shape));
  }
`;

function Sculpture({ progress }) {
  const light = useTheme() === 'light';
  const material = useRef();
  const mesh = useRef();
  const [height, setHeight] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadImage(SKIN), loadImage(CHANNELS), loadImage(ART)]).then(([s, c, a]) => {
      if (live) setHeight(buildHeight(s, c, a));
    });
    return () => { live = false; };
  }, []);

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
        uHeight: { value: null },
        uParams: { value: tex },
        uCount: { value: K },
        uSkinFill: { value: 0 },
        uTime: { value: 0 },
        uBreath: { value: 0.5 },
        uLight: { value: 0 },
        uDepth: { value: DEPTH },
        uTexel: { value: new THREE.Vector2(2 / SRC.w, 2 / SRC.h) },
        uSize: { value: new THREE.Vector2(WIDTH, HEIGHT) },
        uNormalMat: { value: new THREE.Matrix3() },
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

  uniforms.uHeight.value = height;

  useFrame((_, delta) => {
    const u = material.current?.uniforms;
    if (!u || !mesh.current) return;
    if (!prefersReducedMotion) u.uTime.value += Math.min(delta, 0.1);
    // Ease between night and daylight when the theme changes.
    u.uLight.value += ((light ? 1 : 0) - u.uLight.value) * Math.min(1, delta * 4);
    // Journey position in slides (0–11): each channel's fill follows the
    // schedule.
    const q = progress.current;
    const data = params.image.data;
    schedule.channels.forEach((c, k) => {
      data[k * 4] = Math.round(clamp((q - c.start) / (c.end - c.start)) * 255);
    });
    params.needsUpdate = true;
    u.uSkinFill.value = clamp((q - schedule.skin.start) / (schedule.skin.end - schedule.skin.start)) * 1.4;

    // One slow breath every ~10s. The mesh swells in place as it breathes
    // in and settles as it breathes out; it never moves toward you.
    const c = prefersReducedMotion ? 0.5 : 0.5 - 0.5 * Math.cos((u.uTime.value * 2 * Math.PI) / 10);
    const breath = c * c * (3 - 2 * c);
    u.uBreath.value = breath;
    mesh.current.scale.set(1 + 0.025 * breath, 1 + 0.025 * breath, 1);
    u.uNormalMat.value.getNormalMatrix(mesh.current.matrixWorld);

  });

  if (!height) return null;
  return (
    <mesh ref={mesh}>
      <planeGeometry args={[WIDTH, HEIGHT, 640, 420]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

// Where the sculpture sits in each scene: its centre (x, y as fractions of
// the frame, from the top-left) and its width as a fraction of the frame's
// width. It eases from one scene's place to the next. On phones it keeps one
// place above the words.
const PHONE_PLACE = { x: 0.5, y: 0.3, w: 0.95 };
const CAMERA_Z = 6;
// The sculpture may run off the sides and bottom, but never up into the menu:
// its top edge stays at least this far below the top of the frame.
const MENU_CLEARANCE_PX = 88;

// Dev only: ?yaw=20 freezes the sculpture's turn at that many degrees, for
// screenshots.
const FROZEN_YAW = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('yaw')
  : null;

function Placement({ place, children }) {
  const size = useThree((s) => s.size);
  const group = useRef();
  const lean = useRef(new THREE.Vector2());
  const t = useRef(0);
  const placed = useRef(false);
  const goal = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.1);
    t.current += dt;

    // The frame's size in scene units at the sculpture's depth.
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const frameH = 2 * CAMERA_Z * tan;
    const frameW = frameH * (size.width / Math.max(1, size.height));
    const p = size.width <= 800 ? PHONE_PLACE : place.current;
    // Fit it in pixels: never up into the menu, never into the words when
    // they sit above or below it (p.minTop / p.maxBottom, measured by the
    // page), and never off the bottom when p.floor is set. If the gap is
    // smaller than the wanted size, it shrinks to fill the gap exactly.
    const pad = p.pad ?? 1.08; // room for the breath and the tilt
    let hPx = ((p.w * size.width) / WIDTH) * HEIGHT * pad;
    const topPx = Math.max(p.menuClearance ?? MENU_CLEARANCE_PX, p.minTop ?? 0);
    const bottomPx = Math.min(p.maxBottom ?? Infinity, p.floor ? size.height - 24 : Infinity);
    hPx = Math.min(hPx, bottomPx - topPx);
    let cy = p.y * size.height;
    cy = Math.max(cy, topPx + hPx / 2);
    cy = Math.min(cy, bottomPx - hPx / 2);
    const unit = frameH / size.height;
    const scale = (hPx / pad) * unit / HEIGHT;
    goal.set((p.x - 0.5) * frameW, (size.height / 2 - cy) * unit, 0);

    if (!placed.current || prefersReducedMotion) {
      g.position.copy(goal);
      g.scale.setScalar(scale);
      placed.current = true;
    } else {
      // A slow, weighted glide to the new scene's place.
      const k = 1 - Math.exp(-dt * 1.4);
      g.position.lerp(goal, k);
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, scale, k));
    }

    // It turns slowly in place and leans toward the pointer.
    lean.current.lerp(state.pointer, 0.04);
    let yaw;
    let pitch;
    if (FROZEN_YAW !== null) {
      yaw = THREE.MathUtils.degToRad(+FROZEN_YAW);
      pitch = 0.08;
    } else if (prefersReducedMotion) {
      yaw = -0.22;
      pitch = 0.08;
    } else {
      yaw = 0.3 * Math.sin(t.current * 0.16 - 0.6) + lean.current.x * 0.12;
      pitch = 0.08 + 0.07 * Math.sin(t.current * 0.11) - lean.current.y * 0.1;
    }
    g.rotation.set(pitch, yaw, 0);
  });

  return <group ref={group}>{children}</group>;
}

export default function ChannelArt({ progress, place, active = true }) {
  const [dpr, setDpr] = useState(1.75);
  return (
    <Canvas
      flat
      linear
      camera={{ position: [0, 0, CAMERA_Z], fov: FOV, near: 0.1, far: 50 }}
      gl={{ antialias: true }}
      dpr={dpr}
      frameloop={active ? 'always' : 'never'} // rests while scrolled away
      style={{ background: 'transparent' }} // the page's stage shows through
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
      <Placement place={place}>
        <Sculpture progress={progress} />
      </Placement>
    </Canvas>
  );
}
