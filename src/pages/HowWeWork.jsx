import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav';
import styles from './HowWeWork.module.css';

const ChannelArt = lazy(() => import('../components/ChannelArt'));

// Each scene: a small kicker, the stage title, what we do, and what you
// receive — two short passages rather than one dense paragraph.
const SCENES = [
  {
    kicker: 'WASIVI',
    title: 'How we work',
    we: 'We research your situation, define the problem with you, develop and test a first version, and build in agreed phases.',
    receive: 'Clear recommendations, opportunities to review the work, and deliverables your team can use.',
  },
  {
    kicker: '01',
    title: 'Research',
    we: 'Before we meet, we study your organization, market, existing work, and documented user concerns.',
    receive: 'An initial assessment and focused questions that give our first conversation a useful starting point.',
  },
  {
    kicker: '02',
    title: 'Discovery',
    we: 'We discuss the findings with you, examine where the work breaks down, and identify what has already been tried.',
    receive: 'A shared brief, created together, defining the problem, constraints, priorities, and measures of success.',
  },
  {
    kicker: '03',
    title: 'Recommended direction',
    we: 'We map the current experience or workflow and compare possible approaches by impact, effort, and feasibility.',
    receive: 'A recommended direction, the trade-offs behind it, and a proposed scope for the first version.',
  },
  {
    kicker: '04',
    title: 'First version',
    we: 'We agree on what to include, what to leave out, and which assumptions to test.',
    receive: 'A prototype, draft, or small working version—something concrete to review before committing to a larger build.',
  },
  {
    kicker: '05',
    title: 'Testing & refinement',
    we: 'We review the first version with you and test it with its intended users.',
    receive: 'A summary of the findings, revisions based on the evidence, and a recommendation to proceed, adjust, or reconsider the approach.',
  },
  {
    kicker: '06',
    title: 'Phased delivery',
    we: 'Each phase has an agreed scope, schedule, deliverable, and acceptance criteria. We build, test, resolve issues, and review the results with you.',
    receive: 'Completed work to assess before approving the next phase.',
  },
  {
    kicker: '07',
    title: 'Handoff',
    we: 'We walk you through the finished work, transfer the agreed files and access, and provide relevant documentation.',
    receive: 'A clear understanding of how to use it, who is responsible for maintaining it, and what any next steps involve.',
  },
  {
    kicker: 'THROUGHOUT THE ENGAGEMENT',
    title: 'Direct leadership',
    we: 'I lead your engagement from discovery through handoff and remain your primary point of contact. When specialist expertise is needed, I coordinate their contribution.',
    receive: 'One person accountable for the work and its delivery.',
  },
  {
    kicker: 'THROUGHOUT THE ENGAGEMENT',
    title: 'AI & human review',
    we: 'We use AI to assist research, exploration, and implementation. We verify research against sources, review decisions against your goals, and test what we build.',
    receive: 'Work reviewed by the person responsible for delivering it.',
  },
  {
    kicker: 'CLOSING',
    title: 'What you take forward',
    receive: 'The agreed deliverables—a product direction, prototype, working product, presentation, or system—along with the files, documentation, and ownership terms needed to carry the work forward.',
  },
];
const N = SCENES.length;

// The page plays as a show: nothing to press or scroll. Each scene stays up
// long enough to read; the sculpture develops through it; at the end the
// finished piece holds.
const words = (t = '') => t.split(/\s+/).filter(Boolean).length;
const DURATIONS = SCENES.map((sc) =>
  Math.min(12, Math.max(6, 2.5 + 0.24 * (words(sc.title) + words(sc.we) + words(sc.receive))))
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
          <div className={styles.kicker}>{s.kicker}</div>
          <h2 className={styles.title}>{s.title}</h2>
          {s.we && <p className={styles.passage}>{s.we}</p>}
          <div className={styles.receiveLabel}>You receive</div>
          <p className={styles.passage}>{s.receive}</p>
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
