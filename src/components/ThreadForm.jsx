import { useEffect, useRef } from 'react';
import form from './threadForm.json';

// A thread sculpture: the form from "Asymmetrical blackened metal sculpture"
// re-drawn as fine cream threads (traced from its carved ridges), breathing
// like knitwear. As the How We Work journey advances, gold and silver threads
// are stitched in — each one entirely *inside* a channel between the cream
// threads (traced from the sculpture's grooves), never on top, never trailing
// outside. At the start there is no colour; by the handoff every thread is in.

// The part of the 1672×941 source the form occupies (same crop as the demo).
const VIEW = { x: 370, y: 85, w: 1230, h: 810 };
const RIDGE = [222, 212, 190];
export const THREAD_COLORS = ['#e6c35a', '#d9dde3']; // gold, silver
const RGB = [[230, 195, 90], [217, 221, 227]];

// When each thread stitches in, in journey units (0–9, one per slide). Slide
// 0 has no colour; the last thread is complete before the final slide.
export function threadAmounts(q) {
  return form.channels.map((_, k) => {
    const start = 1 + k * 0.85;
    const end = Math.min(start + 3, 8.3);
    return Math.max(0, Math.min(1, (q - start) / (end - start)));
  });
}
export const THREAD_COUNT = form.channels.length;

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Breathing: a slow swell from the centre plus soft travelling ripples, like
// knit fabric inhaling. Applied to every point, cream and coloured alike, so
// the coloured threads stay seated in their channels.
function breathe(x, y, t, out) {
  const cx = VIEW.x + VIEW.w / 2;
  const cy = VIEW.y + VIEW.h / 2;
  const swell = 1 + 0.014 * Math.sin(t * 0.85);
  const dx = Math.sin(y * 0.011 + t * 0.8) * 2.4 + Math.sin(x * 0.006 - t * 0.55) * 1.4;
  const dy = Math.cos(x * 0.009 + t * 0.7) * 2.4 + Math.sin(y * 0.007 + t * 0.4) * 1.0;
  out[0] = cx + (x - cx) * swell + dx;
  out[1] = cy + (y - cy) * swell + dy;
}

function withLengths(pts) {
  const len = [0];
  for (let k = 1; k < pts.length; k++) {
    len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  }
  return { pts, len, total: len[len.length - 1] };
}

export default function ThreadForm({ progress }) {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const threads = form.channels.map(withLengths);
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
      const scale = Math.min(r.width / VIEW.w, r.height / VIEW.h);
      view = {
        scale,
        ox: (r.width - VIEW.w * scale) / 2 - VIEW.x * scale,
        oy: (r.height - VIEW.h * scale) / 2 - VIEW.y * scale,
        w: r.width,
        h: r.height,
      };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const sx = () => view.ox + p[0] * view.scale;
    const sy = () => view.oy + p[1] * view.scale;

    function tracePath(pts, upTo = pts.length, tip = null) {
      ctx.beginPath();
      for (let k = 0; k < upTo; k++) {
        breathe(pts[k][0], pts[k][1], t, p);
        if (k === 0) ctx.moveTo(sx(), sy());
        else ctx.lineTo(sx(), sy());
      }
      if (tip) {
        breathe(tip[0], tip[1], t, p);
        ctx.lineTo(sx(), sy());
      }
    }

    function drawThread(th, amount, rgb) {
      const target = th.total * amount;
      let k = 1;
      while (k < th.pts.length && th.len[k] < target) k++;
      let tip = null;
      if (amount >= 1) k = th.pts.length; // complete: whole thread, no needle
      else if (k < th.pts.length) {
        const a = th.pts[k - 1];
        const b = th.pts[k];
        const u = (target - th.len[k - 1]) / (th.len[k] - th.len[k - 1] || 1);
        tip = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
      }
      const [r, g, b] = rgb;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      tracePath(th.pts, k, tip);
      ctx.strokeStyle = `rgba(${r},${g},${b},0.18)`;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
      ctx.lineWidth = 1.9;
      ctx.stroke();
      // Needle point at the tip while the thread is still going in.
      if (tip) {
        breathe(tip[0], tip[1], t, p);
        const x = sx();
        const y = sy();
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
        glow.addColorStop(0, 'rgba(255,247,212,0.95)');
        glow.addColorStop(1, 'rgba(255,247,212,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 9, y - 9, 18, 18);
      }
    }

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!prefersReducedMotion) t += dt;
      ctx.clearRect(0, 0, view.w, view.h);

      // Coloured threads first, cream threads over them, so the colour reads
      // as seated down in the channel rather than laid on top.
      const amounts = threadAmounts(progress.current);
      threads.forEach((th, k) => {
        if (amounts[k] > 0) drawThread(th, amounts[k], RGB[k % 2]);
      });

      const [r, g, b] = RIDGE;
      ctx.lineWidth = 0.9;
      ctx.lineCap = 'round';
      form.ridges.forEach((ridge, i) => {
        const a = 0.36 + 0.16 * Math.sin(t * 0.5 + i * 0.37);
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
  }, [progress]);

  return <canvas ref={canvasRef} className="thread-form" aria-hidden="true" />;
}
