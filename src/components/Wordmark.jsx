import { useEffect, useRef } from 'react';

const LETTERS = 'WASIVI'.split('');
const LANDING_LETTERS = [0, 2]; // the W and the S
const ABOVE = 160; // px of falling room above the letters
const MAX_FLAKES = 46;
const GOLD = [244, 219, 110];
const SILVER = [236, 240, 244];

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// For one letter, the y of its top surface in each pixel column, so flakes
// can come to rest on the actual shape (the W's arms, the S's curve).
function surfaceOf(span, font, origin) {
  const r = span.getBoundingClientRect();
  const w = Math.ceil(r.width);
  const h = Math.ceil(r.height);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.font = font;
  const m = ctx.measureText(span.textContent);
  // Where the browser puts the baseline in a line-height:1 box.
  const asc = m.fontBoundingBoxAscent;
  const desc = m.fontBoundingBoxDescent;
  const baseline = (h - (asc + desc)) / 2 + asc;
  ctx.fillStyle = '#000';
  ctx.fillText(span.textContent, 0, baseline);
  const { data } = ctx.getImageData(0, 0, w, h);
  const cols = [];
  for (let x = 1; x < w - 1; x++) {
    for (let y = 0; y < h; y++) {
      if (data[(y * w + x) * 4 + 3] > 128) {
        cols.push({ x: r.left - origin.left + x, y: r.top - origin.top + y });
        break;
      }
    }
  }
  return cols;
}

export default function Wordmark() {
  const wrap = useRef();
  const canvas = useRef();

  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    let surfaces = [];
    let flakes = [];
    let raf = 0;
    let last = performance.now();
    let spawnClock = 0;
    let cancelled = false;

    function layout() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = cv.getBoundingClientRect();
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const spans = wrap.current.querySelectorAll('span[data-letter]');
      const font = getComputedStyle(spans[0]).font;
      surfaces = LANDING_LETTERS.map((i) => surfaceOf(spans[i], font, r)).filter((s) => s.length);
      flakes = [];
    }

    function spawn(width) {
      const silver = Math.random() < 0.5;
      const flake = {
        x: Math.random() * width,
        y: -6,
        vy: 18 + Math.random() * 22,
        sway: Math.random() * Math.PI * 2,
        swayAmp: 6 + Math.random() * 10,
        size: 1.6 + Math.random() * 2.4,
        spin: Math.random() * Math.PI * 2,
        spinRate: 0.6 + Math.random() * 1.6,
        tumbleRate: 1 + Math.random() * 2.5,
        color: silver ? SILVER : GOLD,
        target: null,
        landed: 0, // seconds since landing; 0 while falling
        rest: 3 + Math.random() * 4,
      };
      // About half the flakes aim for a spot on the W or the S.
      if (surfaces.length && Math.random() < 0.55) {
        const s = surfaces[Math.floor(Math.random() * surfaces.length)];
        const p = s[Math.floor(Math.random() * s.length)];
        flake.target = p;
        flake.x = p.x;
      }
      flakes.push(flake);
    }

    // Fades shrink the flake instead of dimming it: dim gold reads as brown.
    function draw(f, fade, tumble) {
      const [r, g, b] = f.color;
      const glint = 0.6 + 0.8 * Math.pow(tumble, 6);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.spin);
      ctx.scale(Math.max(tumble, 0.18) * fade, fade);
      ctx.fillStyle = `rgb(${Math.min(255, r * glint)},${Math.min(255, g * glint)},${Math.min(255, b * glint)})`;
      ctx.beginPath();
      ctx.moveTo(0, -f.size);
      ctx.lineTo(f.size, 0);
      ctx.lineTo(0, f.size);
      ctx.lineTo(-f.size, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const { width, height } = cv.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      spawnClock += dt;
      while (spawnClock > 0.28) {
        spawnClock -= 0.28;
        if (flakes.length < MAX_FLAKES) spawn(width);
      }

      flakes = flakes.filter((f) => {
        if (f.landed > 0) {
          // Resting on the letter: twinkle, then fade away.
          f.landed += dt;
          const tumble = Math.abs(Math.cos(f.landed * 1.3 + f.sway));
          const fade = 1 - Math.max(0, (f.landed - f.rest) / 1.2);
          if (fade <= 0) return false;
          draw(f, fade, 0.45 + 0.55 * tumble);
          return true;
        }
        f.y += f.vy * dt;
        f.sway += dt * 0.9;
        f.spin += dt * f.spinRate;
        // Targeted flakes settle their sway as they near the letter, so they
        // land exactly on its edge.
        const settle = f.target ? Math.min(1, Math.max(0, (f.target.y - f.y) / 70)) : 1;
        const x = f.x + Math.sin(f.sway) * f.swayAmp * settle;
        const tumble = Math.abs(Math.cos(f.y / f.vy * f.tumbleRate + f.sway));
        if (f.target && f.y >= f.target.y - f.size * 0.6) {
          f.x = f.target.x;
          f.y = f.target.y - f.size * 0.6;
          f.landed = 0.0001;
          draw(f, 1, tumble);
          return true;
        }
        if (f.y > height + 8) return false;
        const fadeIn = Math.min(1, (f.y + 6) / 40);
        draw({ ...f, x }, fadeIn, tumble);
        return true;
      });

      raf = requestAnimationFrame(frame);
    }

    document.fonts.ready.then(() => {
      if (cancelled) return;
      layout();
      raf = requestAnimationFrame(frame);
    });
    window.addEventListener('resize', layout);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
    };
  }, []);

  return (
    <div className="wordmark" ref={wrap}>
      {LETTERS.map((l, i) => (
        <span key={i} data-letter>{l}</span>
      ))}
      <canvas ref={canvas} className="wordmark-dust" aria-hidden="true" style={{ top: -ABOVE }} />
    </div>
  );
}
