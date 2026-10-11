import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Nav from '../components/Nav';
import styles from './HowWeWork.module.css';

const ChannelArt = lazy(() => import('../components/ChannelArt'));

// Each scene (layout B): the stage as a small label, a big headline that
// does most of the work, a short statement, and what you receive folded in
// beneath it.
const SCENES = [
  {
    stage: 'How we work',
    headline: 'Every engagement follows the same path.',
    statement: 'Your situation gets researched, the problem gets defined with you, a first version gets built and tested, then the rest is built in agreed phases.',
    receive: 'clear recommendations, work to review, and deliverables your team can use — at every step.',
  },
  {
    stage: 'Research',
    headline: 'It starts before the first meeting.',
    statement: 'A study of your organization, market, existing work, and the concerns already on record.',
    receive: 'an initial read and the right questions, so that first conversation starts with substance, not introductions.',
  },
  {
    stage: 'Discovery',
    headline: 'We walk through what we found, together.',
    statement: 'Where the work breaks down, what’s already been tried, what can’t change.',
    receive: 'a shared vision, and a brief that names the problem, the constraints, the priorities, and how success gets measured.',
  },
  {
    stage: 'Recommended direction',
    headline: 'Mapped, then weighed.',
    statement: 'The current workflow gets mapped, and the possible approaches weighed by impact, effort, and feasibility.',
    receive: 'a recommended direction, the trade-offs behind it, and a proposed scope for the first version.',
  },
  {
    stage: 'The first version',
    headline: 'The one thing worth proving first.',
    statement: 'Not everything at once. What’s in, what’s out, and what to test get agreed up front.',
    receive: 'a prototype or working version, concrete enough to judge before you commit to more.',
  },
  {
    stage: 'Testing & refinement',
    headline: 'Your feedback changes the work.',
    statement: 'Reviewed with you, tested with real users — what we learn decides the next move.',
    receive: 'the findings, revisions based on the evidence, and a recommendation to proceed, adjust, or rethink.',
  },
  {
    stage: 'Phased delivery',
    headline: 'Each phase earns the next.',
    statement: 'Each phase has an agreed scope, schedule, deliverable, and acceptance criteria. Build, test, resolve, review.',
    receive: 'finished work to assess before approving the next phase.',
  },
  {
    stage: 'Handoff',
    headline: 'Everything, handed over.',
    statement: 'A full walkthrough of the finished work, the files and access transferred, the documentation provided.',
    receive: 'you know how to use it, who maintains it, and what any next steps involve.',
  },
  {
    stage: 'Throughout · Direct leadership',
    headline: 'One person, accountable for all of it.',
    statement: 'The person who understands your problem is the person who builds it — and stays your point of contact from discovery to handoff. When specialists are needed, I coordinate their work.',
  },
  {
    stage: 'Throughout · AI & human review',
    headline: 'Speed, held to judgment.',
    statement: 'AI runs beneath the process — accelerating research, exploration, and parts of the build.',
    receive: 'every output checked against the sources, your goals, and the tests before it reaches you.',
  },
  {
    stage: 'What you take forward',
    headline: 'The work is yours.',
    statement: 'Whether it’s a direction, a prototype, a working product, a presentation, or a system.',
    receive: 'the agreed deliverables, with the files, documentation, and ownership terms to carry it forward.',
  },
];
const N = SCENES.length;

// Each scene's composition (per the art-direction brief): no two in a row
// share an arrangement. `art` places the sculpture — centre x, y as
// fractions of the frame and width as a fraction of its width, so it can be
// huge and run off the edge or pull back small. `text` places the words
// (left/right/top/bottom/width; `middle` centres them vertically). The two
// "throughout" principles stay calm, centred and symmetrical.
const LAYOUTS = [
  // 01 intro: sculpture big, running off the right edge; words left
  { art: { x: 0.84, y: 0.53, w: 0.84 }, text: { left: '6%', width: '34%' }, middle: true },
  // 02 research: flipped — sculpture off the left edge; big words upper right
  { art: { x: 0.17, y: 0.55, w: 0.84 }, text: { left: '64%', top: '17%', width: '31%' } },
  // 03 discovery: sculpture low right, off the right edge (kept above the
  // bottom); words upper left
  { art: { x: 0.77, y: 0.6, w: 0.76, floor: true }, text: { left: '6%', top: '15%', width: '32%' } },
  // 04 recommended direction: flipped — sculpture left, off the edge; words right
  { art: { x: 0.22, y: 0.55, w: 0.78 }, text: { left: '64%', width: '30%' }, middle: true },
  // 05 first version: sculpture huge, off the right and bottom; the words
  // high in the open top-left, clear of it
  { art: { x: 0.86, y: 0.6, w: 1.05 }, text: { left: '6%', top: '13%', width: '31%' } },
  // 06 testing: sculpture large on the right, off the edge; an extra-large
  // headline low left, over its edge
  { art: { x: 0.8, y: 0.5, w: 0.84 }, text: { left: '6%', bottom: '8%', width: '42%' }, scrim: true, big: true },
  // 07 phased delivery: sculpture off the left edge; words right
  { art: { x: 0.14, y: 0.56, w: 0.98 }, text: { left: '64%', width: '31%' }, middle: true },
  // 08 handoff: words high and centred; the whole sculpture beneath them,
  // as large as the space allows, fully on the page
  { art: { x: 0.5, y: 0.7, w: 0.9, floor: true, pad: 1.03 }, text: { left: '20%', right: '20%', top: '10%' }, center: true, gap: 4 },
  // 09 direct leadership (principle): centred and symmetrical, words below
  // (tighter margins so it can be ~15% larger: about 787px wide at 1440)
  { art: { x: 0.5, y: 0.38, w: 0.547, pad: 1.02, menuClearance: 76 }, text: { left: '20%', right: '20%', bottom: '1.2%' }, center: true, gap: 2 },
  // 10 AI & human review (principle): the whole sculpture large at the top,
  // filling the space down to the words, which sit tight together below
  { art: { x: 0.5, y: 0.4, w: 0.8 }, text: { left: '18%', right: '18%', bottom: '3%' }, center: true, strong: true },
  // 11 what you take forward: the finale — the finished piece, wider than
  // the frame, coming in from both sides; the words sit on a pool of black
  { art: { x: 0.5, y: 0.5, w: 1.625 }, text: { left: '12%', right: '12%', bottom: '4%' }, center: true, behind: true, pool: true },
];

// The page plays as a show: nothing to press or scroll. Each scene stays up
// long enough to read; the sculpture develops through it; at the end the
// finished piece holds.
const words = (t = '') => t.split(/\s+/).filter(Boolean).length;
const DURATIONS = SCENES.map((sc) =>
  Math.min(12, Math.max(6, 2.5 + 0.24 * (words(sc.stage) + words(sc.headline) + words(sc.statement) + words(sc.receive))))
);
const STARTS = DURATIONS.reduce((acc, d, i) => [...acc, acc[i] + d], [0]);
// Dev only: ?scene=6 starts the show at that scene, for screenshots.
const START_SCENE = import.meta.env.DEV
  ? Math.min(N, Math.max(1, +new URLSearchParams(window.location.search).get('scene') || 1)) - 1
  : 0;

// `active`: the show plays only while its section is on screen (on the one
// page it pauses when scrolled away and picks up where it left off).
export default function HowWeWork({ embedded, active = true }) {
  // Position in slides (0–11); the artwork reads it every frame.
  const progress = useRef(0);
  const [scene, setScene] = useState(START_SCENE);
  // Where the sculpture should be; it glides there on each scene change.
  const place = useRef(LAYOUTS[START_SCENE].art);

  useEffect(() => { if (!embedded) document.title = 'WASIVI — How We Work'; }, [embedded]);
  const elapsedRef = useRef(STARTS[START_SCENE]);

  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      elapsedRef.current += Math.min((now - last) / 1000, 0.1); // no jump after a hidden tab
      const elapsed = elapsedRef.current;
      last = now;
      let i = 0;
      while (i < N - 1 && elapsed >= STARTS[i + 1]) i++;
      progress.current = Math.min(N, i + (elapsed - STARTS[i]) / DURATIONS[i]);
      setScene(i);
      if (elapsed < STARTS[N]) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const s = SCENES[scene];
  const layout = LAYOUTS[scene];
  const wordsRef = useRef(null);
    // When the words sit above or below the sculpture, measure them so the
  // sculpture fills the space between them and the menu without touching.
  useLayoutEffect(() => {
    const measure = () => {
      const el = wordsRef.current;
      const r = el?.getBoundingClientRect();
      let limits = {};
      if (r && layout.center && !layout.behind && innerWidth > 800) {
        const gap = layout.gap ?? 12;
        limits = layout.text.bottom != null ? { maxBottom: r.top - gap } : { minTop: r.bottom + gap };
      }
      place.current = { ...layout.art, ...limits };
    };
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, [scene, layout]);
  const pos = layout.text;
  const placeStyle = {
    '--l': pos.left ?? 'auto',
    '--r': pos.right ?? 'auto',
    '--t': pos.top ?? (layout.middle ? '0' : 'auto'),
    '--b': pos.bottom ?? (layout.middle ? '0' : 'auto'),
    '--w': pos.width ?? 'auto',
  };

  return (
    <main className={styles.journey}>
      <section className={styles.frame} aria-label="How WASIVI works">
        {/* The shared site menu, laid over the top of the frame. */}
        {!embedded && <div className={styles.header}><Nav /></div>}
        <h1 className={styles.srOnly}>How We Work</h1>

        <div className={styles.artwork}>
          <Suspense fallback={null}>
            <ChannelArt progress={progress} place={place} active={active} />
          </Suspense>
        </div>

        {/* The words sit somewhere different in each scene, never under the
            sculpture's resting place (or, where they overlap its dark edge,
            over a soft scrim). */}
        <div
          className={[
            styles.place,
            layout.center && styles.center,
            layout.middle && styles.middle,
            layout.scrim && styles.scrim,
            layout.big && styles.big,
            layout.pool && styles.pool,
            layout.strong && styles.strong,
          ].filter(Boolean).join(' ')}
          style={placeStyle}
        >
          <div key={scene} ref={wordsRef} className={styles.words} aria-live="polite">
            <div className={styles.eyebrow}>{s.stage}</div>
            <h2 className={styles.title}>{s.headline}</h2>
            <p className={styles.statement}>{s.statement}</p>
            {s.receive && (
              <p className={styles.receive}><b>You receive —</b> {s.receive}</p>
            )}
          </div>
        </div>
        <div className={styles.count}>{String(scene + 1).padStart(2, '0')} / {N}</div>
      </section>
    </main>
  );
}
