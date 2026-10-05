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

const clamp = (x) => Math.max(0, Math.min(1, x));

export default function HowWeWork() {
  const journey = useRef();
  // Position in slides (0–11); the artwork reads it every frame. Scrolling
  // drives it, stopping holds it, scrolling back reverses it.
  const progress = useRef(0);
  const [scene, setScene] = useState(0);

  useEffect(() => { document.title = 'WASIVI — How We Work'; }, []);

  useEffect(() => {
    let queued = false;
    const update = () => {
      queued = false;
      const el = journey.current;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const q = clamp((window.scrollY - top) / (el.offsetHeight - window.innerHeight));
      progress.current = q * N;
      setScene(Math.min(N - 1, Math.floor(q * N)));
    };
    const onScroll = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, []);

  const s = SCENES[scene];

  return (
    <main ref={journey} className={styles.journey}>
      <section className={styles.frame} aria-label="Scroll to follow how WASIVI works">
        <header className={styles.header}>
          <Link to="/" className={styles.brand}>WASIVI</Link>
          <Nav />
          <span className={styles.brandSpacer} aria-hidden="true" />
        </header>
        <h1 className={styles.srOnly}>How We Work</h1>

        {/* Text lives in its own column beside the artwork, never on it. */}
        <div className={styles.words} aria-live="polite">
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

        <div className={styles.hint}>SCROLL TO FOLLOW THE WORK · STOP TO HOLD · SCROLL BACK TO REVERSE</div>
      </section>
    </main>
  );
}
