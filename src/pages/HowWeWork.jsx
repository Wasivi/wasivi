import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav';
import styles from './HowWeWork.module.css';

const ChannelArt = lazy(() => import('../components/ChannelArt'));

// Each scene: an optional eyebrow, the headline, the main statement, and what
// you receive — set apart as a quieter line beneath.
const SCENES = [
  {
    title: 'How we work',
    statement: 'Every engagement follows the same path. Your situation gets researched, the problem gets defined with you, a first version gets built and tested, then the rest is built in agreed phases.',
    receive: 'At every step: clear recommendations, work to review, and deliverables your team can use.',
  },
  {
    title: 'Research',
    statement: 'It starts before the first meeting — with a study of your organization, market, existing work, and the concerns already on record.',
    receive: 'An initial read and the right questions, so that first conversation starts with substance, not introductions.',
  },
  {
    title: 'Discovery',
    statement: 'We walk through what we found together — where the work breaks down, what’s already been tried, what can’t change.',
    receive: 'A shared vision, and a brief that names the problem, the constraints, the priorities, and how success gets measured.',
  },
  {
    title: 'Recommended direction',
    statement: 'The current workflow gets mapped, and the possible approaches weighed by impact, effort, and feasibility.',
    receive: 'A recommended direction, the trade-offs behind it, and a proposed scope for the first version.',
  },
  {
    title: 'The first version',
    statement: 'Not everything at once — the one thing worth proving first. What’s in, what’s out, and what to test get agreed up front.',
    receive: 'A prototype or working version, concrete enough to judge before you commit to more.',
  },
  {
    title: 'Testing & refinement',
    statement: 'The first version gets reviewed with you and tested with real users. Your feedback changes the work.',
    receive: 'The findings, revisions based on the evidence, and a recommendation to proceed, adjust, or rethink.',
  },
  {
    title: 'Phased delivery',
    statement: 'Each phase has an agreed scope, schedule, deliverable, and acceptance criteria. Build, test, resolve, review.',
    receive: 'Finished work to assess before approving the next phase — each one earns the next.',
  },
  {
    title: 'Handoff',
    statement: 'A full walkthrough of the finished work, the files and access transferred, the documentation provided.',
    receive: 'You know how to use it, who maintains it, and what any next steps involve.',
  },
  {
    eyebrow: 'Throughout the engagement',
    title: 'Direct leadership',
    statement: 'The person who understands your problem is the person who builds it — and stays your point of contact from discovery to handoff. When specialists are needed, I coordinate their work.',
    receive: 'One person, accountable for all of it.',
  },
  {
    eyebrow: 'Throughout the engagement',
    title: 'AI & human review',
    statement: 'AI runs beneath the process — accelerating research, exploration, and parts of the build. Every output is checked against the sources, your goals, and the tests before it reaches you.',
    receive: 'Speed, held to judgment.',
  },
  {
    title: 'What you take forward',
    statement: 'You leave with the agreed deliverables — whether it’s a direction, a prototype, a working product, a presentation, or a system — with the files, documentation, and ownership terms to carry it forward.',
    receive: 'The work is yours.',
  },
];
const N = SCENES.length;

// The page plays as a show: nothing to press or scroll. Each scene stays up
// long enough to read; the sculpture develops through it; at the end the
// finished piece holds.
const words = (t = '') => t.split(/\s+/).filter(Boolean).length;
const DURATIONS = SCENES.map((sc) =>
  Math.min(12, Math.max(6, 2.5 + 0.24 * (words(sc.title) + words(sc.statement) + words(sc.receive))))
);
const STARTS = DURATIONS.reduce((acc, d, i) => [...acc, acc[i] + d], [0]);

export default function HowWeWork() {
  // Position in slides (0–11); the artwork reads it every frame.
  const progress = useRef(0);
  const [scene, setScene] = useState(0);

  useEffect(() => { document.title = 'WASIVI — How We Work'; }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    const tick = (now) => {
      elapsed += Math.min((now - last) / 1000, 0.1); // no jump after a hidden tab
      last = now;
      let i = 0;
      while (i < N - 1 && elapsed >= STARTS[i + 1]) i++;
      progress.current = Math.min(N, i + (elapsed - STARTS[i]) / DURATIONS[i]);
      setScene(i);
      if (elapsed < STARTS[N]) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = SCENES[scene];

  return (
    <main className={styles.journey}>
      <section className={styles.frame} aria-label="How WASIVI works">
        <header className={styles.header}>
          <Link to="/" className={styles.brand}>WASIVI</Link>
          <Nav />
          <span className={styles.brandSpacer} aria-hidden="true" />
        </header>
        <h1 className={styles.srOnly}>How We Work</h1>

        {/* Text lives in its own column beside the artwork, never on it. */}
        <div key={scene} className={styles.words} aria-live="polite">
          {s.eyebrow && <div className={styles.eyebrow}>{s.eyebrow}</div>}
          <h2 className={styles.title}>{s.title}</h2>
          <p className={styles.statement}>{s.statement}</p>
          <div className={styles.receive}>
            <div className={styles.receiveLabel}>You receive</div>
            <p>{s.receive}</p>
          </div>
          <div className={styles.count}>{String(scene + 1).padStart(2, '0')} / {N}</div>
        </div>

        <div className={styles.artwork}>
          <Suspense fallback={null}>
            <ChannelArt progress={progress} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
