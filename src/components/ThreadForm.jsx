import { useEffect, useRef } from 'react';
import form from './threadForm.json';

// A thread sculpture: the carved form from "Asymmetrical blackened metal
// sculpture" re-drawn as fine cream threads (traced from its ridges), gently
// breathing like knitwear. Each How We Work step stitches one more gold thread
// in from outside the form; it runs *inside* a channel between the cream threads
// (channels traced from the sculpture's grooves), never on top of them.

const STITCH_SECONDS = 3.2; // time for a gold thread to stitch its full length
const RIDGE = [222, 212, 190];
const GOLD = [233, 201, 92];

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Breathing: a slow swell from the centre plus soft travelling ripples, like
// knit fabric inhaling. Applied to every point — cream and gold alike — so the
// gold threads stay seated in their channels.
function breathe(x, y, t, out) {
  const cx = form.width / 2;
  const cy = form.height / 2;
  const swell = 1 + 0.014 * Math.sin(t * 0.85);
  const dx = Math.sin(y * 0.011 + t * 0.8) * 2.4 + Math.sin(x * 0.006 - t * 0.55) * 1.4;
  const dy = Math.cos(x * 0.009 + t * 0.7) * 2.4 + Math.sin(y * 0.007 + t * 0.4) * 1.0;
  out[0] = cx + (x - cx) * swell + dx;
  out[1] = cy + (y - cy) * swell + dy;
}

// Gold thread path: it arrives from outside the form, straight toward the
// spot where its channel meets the form's outer edge, then follows the
// channel. It never crosses over the cream threads.
function goldPath(channel, i) {
  const [sx, sy] = channel[0];
  const [ox, oy] = form.entries[i]; // outward direction at the channel mouth
  const ex = sx + ox * 320;
  const ey = sy + oy * 320;
  const cx = sx + ox * 110 + oy * 40; // slight sideways sway on the way in
  const cy = sy + oy * 110 - ox * 40;
  const pts = [];
  const steps = 40;
  for (let k = 0; k < steps; k++) {
    const u = k / steps;
    pts.push([
      (1 - u) * (1 - u) * ex + 2 * (1 - u) * u * cx + u * u * sx,
      (1 - u) * (1 - u) * ey + 2 * (1 - u) * u * cy + u * u * sy,
    ]);
  }
  pts.push(...channel);
  // Cumulative length, for drawing a partial thread.
  const len = [0];
  for (let k = 1; k < pts.length; k++) {
    len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  }
  return { pts, len, total: len[len.length - 1] };
}

export default function ThreadForm({ activeIndex }) {
  const canvasRef = useRef();
  const active = useRef(activeIndex);
  active.current = activeIndex;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const golds = form.channels.map(goldPath);
    const progress = golds.map(() => 0);
    const p = [0, 0];
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0 };

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      const pad = 0.94;
      const scale = Math.min(r.width / form.width, r.height / form.height) * pad;
      view = {
        scale,
        ox: (r.width - form.width * scale) / 2,
        oy: (r.height - form.height * scale) / 2,
        w: r.width,
        h: r.height,
      };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function tracePath(pts, upTo = pts.length, partial = null) {
      ctx.beginPath();
      for (let k = 0; k < upTo; k++) {
        breathe(pts[k][0], pts[k][1], t, p);
        const x = view.ox + p[0] * view.scale;
        const y = view.oy + p[1] * view.scale;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (partial) {
        breathe(partial[0], partial[1], t, p);
        ctx.lineTo(view.ox + p[0] * view.scale, view.oy + p[1] * view.scale);
      }
    }

    function drawGold(g, frac) {
      const target = g.total * frac;
      let k = 1;
      while (k < g.pts.length && g.len[k] < target) k++;
      let tip = null;
      if (k < g.pts.length) {
        const a = g.pts[k - 1];
        const b = g.pts[k];
        const u = (target - g.len[k - 1]) / (g.len[k] - g.len[k - 1] || 1);
        tip = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      }
      const [r, gg, b] = GOLD;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Soft halo, then the thread itself.
      tracePath(g.pts, k, tip);
      ctx.strokeStyle = `rgba(${r},${gg},${b},0.16)`;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = `rgb(${r},${gg},${b})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // A bright needle point while it is still stitching.
      if (tip && frac > 0.001) {
        breathe(tip[0], tip[1], t, p);
        const x = view.ox + p[0] * view.scale;
        const y = view.oy + p[1] * view.scale;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
        glow.addColorStop(0, 'rgba(255,240,190,0.95)');
        glow.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 9, y - 9, 18, 18);
      }
    }

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!prefersReducedMotion) t += dt;
      ctx.clearRect(0, 0, view.w, view.h);

      // Stitch threads in (and back out, scrolling up) one at a time.
      golds.forEach((_, i) => {
        const want = i <= active.current ? 1 : 0;
        if (prefersReducedMotion) progress[i] = want;
        else if (progress[i] < want) progress[i] = Math.min(want, progress[i] + dt / STITCH_SECONDS);
        else if (progress[i] > want) progress[i] = Math.max(want, progress[i] - dt / 1.2);
      });

      // Gold first, cream threads over it, so gold reads as seated in the
      // channel between them rather than laid on top.
      golds.forEach((g, i) => {
        if (progress[i] > 0) drawGold(g, easeInOut(progress[i]));
      });

      const [r, g, b] = RIDGE;
      ctx.lineWidth = 0.8;
      ctx.lineCap = 'round';
      form.ridges.forEach((ridge, i) => {
        // Each thread catches the light a little differently over time.
        const a = 0.34 + 0.16 * Math.sin(t * 0.5 + i * 0.37);
        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
        tracePath(ridge);
        ctx.stroke();
      });

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="thread-form" aria-hidden="true" />;
}

function easeInOut(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
