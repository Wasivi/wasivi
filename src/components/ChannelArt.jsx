import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import schedule from './channelSchedule.json';
import { useTheme } from './ThemeToggle';

// The approved How We Work artwork, re-rendered sharper and fitted onto the
// channel maps (tools/sculpture_art.py), built as a real relief sculpture: the
// almond is domed like a cast slab, its walls stand up and its channels are
// carved in, lit by fixed lights while the camera drifts around it (and
// follows the pointer), so the depth reads. As the
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
const SRC = { w: 1672, h: 941 }; // the maps' size; the artwork is a multiple
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
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

// Height of the relief over the whole image, 0 (background) to ~1 (crown of
// the dome): a slab with a narrow rounded edge and a broad, domed top, its
// channels carved in with soft rounded floors.
//
// R: the body, soft and broad — the only part that moves the mesh. Anything
//    fine here tears into sawteeth against the mesh's grid.
// G: the full relief, walls, lines and all — read only for lighting, so it
//    stays crisp at any size.
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
  const soft = blur(Float32Array.from(carve), w, h, 7, 3);
  blur(carve, w, h, 1, 2);
  blur(cut, w, h, 1, 1);
  const data = new Uint16Array(w * h * 2);
  for (let i = 0; i < w * h; i++) {
    // The edge rolls over gently from zero on the outline: never steep
    // enough for the design to smear into plain metal when seen side-on.
    // A round edge, like a river stone: the surface leaves the outline
    // straight up (a quarter circle), so front and back flow into each
    // other with no pinched seam where they meet.
    const t = Math.min(1, Math.max(0, (rim[i] - 0.5) / 0.5));
    const body = Math.sqrt(1 - (1 - t) * (1 - t));
    const crown = smoothstep(0.25, 1.0, dome[i]);
    // Carved in all over, edge included: the artwork's lines are cut into
    // the whole surface, and the rolled edge carries grooves that follow
    // the outline, like the skeleton's ribs — never a plain smooth band.
    // The grooves stay on the rim; on the face they'd hatch over the design.
    const edge = mask[i] * (1 - smoothstep(0.6, 0.78, rim[i]));
    const ribs = 0.5 + 0.5 * Math.cos(rim[i] * Math.PI * 2 * 9);
    const shape = body * (0.35 + crown * 0.65);
    data[i * 2] = THREE.DataUtils.toHalfFloat(shape - soft[i] * 0.14 * body);
    data[i * 2 + 1] = THREE.DataUtils.toHalfFloat(
      shape - carve[i] * 0.22 * body - cut[i] * 0.03 * mask[i] - ribs * edge * 0.045
    );
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGFormat, THREE.HalfFloatType);
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

function loadTexture(url, { nearest = false, mipmaps = false } = {}) {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.NoColorSpace; // raw in, raw out: colours match the file
  tex.minFilter = tex.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  tex.generateMipmaps = mipmaps;
  if (mipmaps) {
    tex.minFilter = THREE.LinearMipmapLinearFilter; // no shimmer when drawn small
    tex.anisotropy = 8; // stays sharp as the piece turns away
  }
  return tex;
}

const shared = /* glsl */ `
  uniform sampler2D uHeight;
  uniform sampler2D uChan;    // R and G, read smoothly
  uniform sampler2D uChanIdx; // B, read exactly: indices must never blend
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
  float wallPhase(vec2 tc) {
    return texture2D(uSkin, tc).g * 9.0 + tc.x * 5.0 + tc.y * 3.0;
  }
  float pieceBreath(vec2 tc, vec4 ch, vec4 p, float inside) {
    return sin(uTime * 0.63 + mix(wallPhase(tc), p.a * 6.2832, inside));
  }

  const float POUR_SOFT = 0.4;

  // How far a channel's poured metal has risen at this point (0–1).
  float pour(vec2 tc, out vec4 ch, out vec4 p) {
    ch = texture2D(uChan, tc);
    ch.b = texture2D(uChanIdx, tc).b;
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

  void main() {
    vTc = uCrop.xy + uv * uCrop.zw;
    // Knit-fabric ripple: soft waves run through the surface as it breathes.
    vTc += vec2(sin(uv.y * 12.0 + uTime * 0.5), cos(uv.x * 10.0 + uTime * 0.42))
      * 0.0035 * uCrop.zw * (0.4 + 0.6 * uBreath);
    float h = texture2D(uHeight, vTc).r;
    // The whole relief heaves up on the breath in and settles on the breath
    // out; each piece adds its own small breath on top.
    float heave = 0.72 + 0.56 * uBreath;
    // It morphs as it breathes: slow, soft swells drift across the body, so
    // the shape itself changes, never just the size.
    float drift = sin(uv.x * 3.1 + uTime * 0.31) * sin(uv.y * 2.4 - uTime * 0.23)
                + 0.6 * sin((uv.x + uv.y) * 4.3 - uTime * 0.19);
    float body = smoothstep(0.0, 0.2, h);
    // Each stretch lifts and sinks a little on its own breath. This moves the
    // mesh, so it runs smoothly across channels, never channel by channel.
    float b = sin(uTime * 0.63 + wallPhase(vTc));
    float z = (h * heave + drift * 0.09 * body + b * 0.06 * body) * uDepth;
    // The outline swells out on the breath in, a little unevenly, like a
    // chest rising.
    vec2 xy = position.xy * (1.0 + 0.035 * uBreath + 0.012 * drift * uBreath);
    vec4 world = modelMatrix * vec4(xy, z, 1.0);
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
    // How much of this screen pixel the outline covers: a smooth edge, solid
    // right up to it, with no see-through fringe where front meets back.
    float cover = clamp((shape - 0.5) / max(fwidth(shape), 0.0001) + 0.5, 0.0, 1.0);
    if (cover <= 0.0) discard;

    vec3 art = texture2D(uArt, vTc).rgb;
    float lum = dot(art, vec3(0.299, 0.587, 0.114));
    vec4 ch; vec4 p;
    float fill = pour(vTc, ch, p);
    float inside = smoothstep(0.2, 0.5, ch.g);

    // Surface normal from the relief's slope, plus the artwork's own fine
    // engraving so every thread catches the light.
    vec2 e = uTexel;
    vec2 hx = texture2D(uHeight, vTc + vec2(e.x, 0.0)).rg - texture2D(uHeight, vTc - vec2(e.x, 0.0)).rg;
    vec2 hy = texture2D(uHeight, vTc + vec2(0.0, e.y)).rg - texture2D(uHeight, vTc - vec2(0.0, e.y)).rg;
    vec2 step = 2.0 * e / uCrop.zw * uSize; // scene units across the samples
    vec2 slope = vec2(hx.g, hy.g) * uDepth / step;
    vec2 bodySlope = vec2(hx.r, hy.r) * uDepth / step;
    vec2 f = e * 0.5;
    float lx = lumAt(vTc + vec2(f.x, 0.0)) - lumAt(vTc - vec2(f.x, 0.0));
    float ly = lumAt(vTc + vec2(0.0, f.y)) - lumAt(vTc - vec2(0.0, f.y));
    // Poured metal settles smooth, so the engraving fades under it.
    slope += vec2(lx, ly) * 6.0 * (1.0 - 0.7 * fill);
    vec3 nLocal = normalize(vec3(-slope, 1.0));
    vec3 n = normalize(uNormalMat * nLocal);
    // Never blank: where the surface turns steep (the rim, the tops and
    // sides you see when it's turned), the picture's lines smear, so carve
    // in contour lines that follow the shape, like a topographic map.
    float steep = smoothstep(0.25, 0.75, 1.0 - normalize(vec3(-bodySlope, 1.0)).z);
    float hv = texture2D(uHeight, vTc).r;
    float g = abs(fract(hv * 34.0) - 0.5);
    float groove = 1.0 - smoothstep(0.06, 0.16, g);
    float ridge = 1.0 - smoothstep(0.0, 0.07, abs(g - 0.22));

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
    lit *= 0.95 + 0.08 * uBreath + 0.06 * pieceBreath(vTc, ch, p, inside);
    lit *= 1.0 - 0.22 * groove * steep;
    lit += ridge * steep * 0.08 * mix(vec3(0.9), normalize(col + 0.001) * 1.4, metalness);
    gl_FragColor = vec4(lit, cover);
  }
`;

function Sculpture({ progress }) {
  const light = useTheme() === 'light';
  const material = useRef();
  const mesh = useRef(); // the whole sculpture: front and back
  const front = useRef();
  const back = useRef();
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
        uArt: { value: loadTexture(ART, { mipmaps: true }) },
        uChan: { value: loadTexture(CHANNELS) },
        uChanIdx: { value: loadTexture(CHANNELS, { nearest: true }) },
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
  // The back shares everything with the front except its own normal turn.
  const backUniforms = useMemo(() => ({ ...uniforms, uNormalMat: { value: new THREE.Matrix3() } }), [uniforms]);
  const geometry = useMemo(() => new THREE.PlaneGeometry(WIDTH, HEIGHT, 640, 420), []);

  useFrame((_, delta) => {
    const u = material.current?.uniforms;
    if (!u || !mesh.current || !front.current || !back.current) return;
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

    // One slow breath every ~9s: the shaders swell and morph the body on
    // the breath in and let it settle on the breath out. It never moves
    // toward you.
    const c = prefersReducedMotion ? 0.5 : 0.5 - 0.5 * Math.cos((u.uTime.value * 2 * Math.PI) / 9);
    const breath = c * c * (3 - 2 * c);
    u.uBreath.value = breath;
    u.uNormalMat.value.getNormalMatrix(front.current.matrixWorld);
    backUniforms.uNormalMat.value.getNormalMatrix(back.current.matrixWorld);

  });

  if (!height) return null;
  // A whole object, not a picture: the back is the front's mirror image,
  // carved outward the other way, so the two faces meet at the rim and it
  // reads as solid from any side.
  return (
    <group ref={mesh}>
      <mesh ref={front} geometry={geometry}>
        <shaderMaterial
          ref={material}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          alphaToCoverage
        />
      </mesh>
      <mesh ref={back} geometry={geometry} scale={[1, 1, -1]}>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={backUniforms}
          alphaToCoverage
        />
      </mesh>
    </group>
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

// You can handle the sculpture: drag it (mouse, trackpad click-drag, or a
// finger on a phone) to turn it all the way round, swipe sideways with two
// fingers on a trackpad to spin it, pinch to bring it closer. A few seconds
// after you let go it eases back to its place for the slide.
function useHandling() {
  const gl = useThree((s) => s.gl);
  const hand = useRef({ yaw: 0, pitch: 0, zoom: 1, dragging: false, last: -1e9, x: 0, y: 0 });
  useEffect(() => {
    const el = gl.domElement;
    const h = hand.current;
    el.style.cursor = 'grab';
    el.style.touchAction = 'pan-y'; // vertical swipes still scroll the page
    const now = () => performance.now();
    const down = (e) => {
      h.dragging = true; h.x = e.clientX; h.y = e.clientY;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const move = (e) => {
      if (!h.dragging) return;
      h.yaw += (e.clientX - h.x) * 0.008;
      h.pitch = Math.max(-1.2, Math.min(1.2, h.pitch + (e.clientY - h.y) * 0.006));
      h.x = e.clientX; h.y = e.clientY; h.last = now();
    };
    const up = () => { h.dragging = false; h.last = now(); el.style.cursor = 'grab'; };
    const wheel = (e) => {
      if (e.ctrlKey) { // trackpad pinch
        e.preventDefault();
        h.zoom = Math.max(0.7, Math.min(1.8, h.zoom * Math.exp(-e.deltaY * 0.01)));
        h.last = now();
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { // two-finger sideways swipe
        e.preventDefault();
        h.yaw -= e.deltaX * 0.006;
        h.last = now();
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl]);
  return hand;
}

function Placement({ place, children }) {
  const size = useThree((s) => s.size);
  const hand = useHandling();
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

    // Let go for a few seconds and it eases home: the nearest full turn,
    // upright, its usual size.
    const h = hand.current;
    if (!h.dragging && performance.now() - h.last > 3000) {
      const k = 1 - Math.exp(-dt * 1.2);
      const home = Math.round(h.yaw / (Math.PI * 2)) * Math.PI * 2;
      h.yaw += (home - h.yaw) * k;
      h.pitch += (0 - h.pitch) * k;
      h.zoom += (1 - h.zoom) * k;
    }
    const sized = scale * h.zoom;

    if (!placed.current || prefersReducedMotion) {
      g.position.copy(goal);
      g.scale.setScalar(sized);
      placed.current = true;
    } else {
      // A slow, weighted glide to the new scene's place.
      const k = 1 - Math.exp(-dt * 1.4);
      g.position.lerp(goal, k);
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, sized, h.dragging ? 0.3 : k));
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
    g.rotation.set(pitch + h.pitch, yaw + h.yaw, 0);
  });

  return <group ref={group}>{children}</group>;
}

// Render at the screen's own sharpness. When frames suffer it eases down, but
// never to 1: on a retina screen that doubles every pixel.
const screenDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
const DPR_HIGH = Math.min(screenDpr, 2);
const DPR_LOW = Math.min(screenDpr, 1.5);

export default function ChannelArt({ progress, place, active = true }) {
  const [dpr, setDpr] = useState(DPR_HIGH);
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
      <PerformanceMonitor onDecline={() => setDpr(DPR_LOW)} onIncline={() => setDpr(DPR_HIGH)} />
      <Placement place={place}>
        <Sculpture progress={progress} />
      </Placement>
    </Canvas>
  );
}
