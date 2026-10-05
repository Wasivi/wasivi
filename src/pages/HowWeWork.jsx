import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav';
import styles from './HowWeWork.module.css';

const ChannelArt = lazy(() => import('../components/ChannelArt'));

const SCENES = [
  {
    label: 'HOW WE WORK',
    body: 'We research your situation, define the problem with you, develop and test a first version, and build in agreed phases. You receive clear recommendations, opportunities to review the work, and deliverables your team can use.',
  },
  {
    label: '01 — RESEARCH',
    body: 'Before we meet, we review your organization, market, existing work, and documented user concerns. We bring an initial assessment and focused questions so our first conversation starts with useful context.',
  },
  {
    label: '02 — DISCOVERY',
    body: 'We discuss the findings with you, examine where the work breaks down, and identify what has already been tried. Together, we create a shared brief defining the problem, constraints, priorities, and measures of success.',
  },
  {
    label: '03 — RECOMMENDED DIRECTION',
    body: 'We map the current experience or workflow and compare possible approaches by impact, effort, and feasibility. You receive a recommended direction, the trade-offs behind it, and a proposed scope for the first version.',
  },
  {
    label: '04 — FIRST VERSION',
    body: 'We agree on what to include, what to leave out, and which assumptions to test. We create a prototype, draft, or small working version that gives you something concrete to review before committing to a larger build.',
  },
  {
    label: '05 — TESTING & REFINEMENT',
    body: 'We review the first version with you and test it with its intended users. You receive a summary of the findings, revisions based on the evidence, and a recommendation to proceed, adjust, or reconsider the approach.',
  },
  {
    label: '06 — PHASED DELIVERY',
    body: 'Each phase has an agreed scope, schedule, deliverable, and acceptance criteria. We build, test, resolve issues, and review the results with you. You receive completed work to assess before approving the next phase.',
  },
  {
    label: '07 — HANDOFF',
    body: 'We walk you through the finished work, transfer the agreed files and access, and provide relevant documentation. You know how to use it, who is responsible for maintaining it, and what any next steps involve.',
  },
  {
    label: 'DIRECT LEADERSHIP — THROUGHOUT THE ENGAGEMENT',
    body: 'I lead your engagement from discovery through handoff and remain your primary point of contact. When specialist expertise is needed, I coordinate their contribution. You have one person accountable for the work and its delivery.',
  },
  {
    label: 'AI & HUMAN REVIEW — THROUGHOUT THE ENGAGEMENT',
    body: 'We use AI to assist research, exploration, and implementation. We verify research against sources, review decisions against your goals, and test what we build. You receive work reviewed by the person responsible for delivering it.',
  },
  {
    label: 'CLOSING — WHAT YOU TAKE FORWARD',
    body: 'You leave with the agreed deliverables—a product direction, prototype, working product, presentation, or system—along with the files, documentation, and ownership terms needed to carry the work forward.',
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

        {/* Text lives in the black space beside the artwork, never on it. */}
        <div className={styles.words} aria-live="polite">
          <div className={styles.label}>{s.label}</div>
          <p className={styles.body}>{s.body}</p>
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
