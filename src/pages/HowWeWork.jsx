import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Nav from '../components/Nav';
import styles from './HowWeWork.module.css';

import ThreadForm, { threadAmounts, THREAD_COLORS, THREAD_COUNT } from '../components/ThreadForm';

const GOLD = '#c6a748';
const SILVER = '#c9ccd1';

// Copy and structure from WASIVI_How_We_Work_Scroll_Demo-2.html.
const SCENES = [
  {
    phase: 'HOW WE WORK',
    title: 'We begin inside the complexity.',
    lead: 'For organizations and ideas that do not fit an off-the-shelf process.',
    color: GOLD,
  },
  {
    phase: '01 — WE STUDY YOUR WORLD',
    title: 'We learn before we prescribe.',
    lead: 'Before we ask you to build anything, we study how your organization actually works.',
    detail: <><strong>Your business.</strong> Your users. Your market. Your existing work. The problems already on record.</>,
    color: GOLD,
  },
  {
    phase: '02 — THEN WE MEET',
    title: 'Evidence meets experience.',
    lead: 'We bring what the evidence suggests. You tell us what the evidence cannot.',
    detail: 'Together, we identify the pressures that are real, the assumptions that are wrong, and the questions that still need answers.',
    color: SILVER,
  },
  {
    phase: '03 — WE FIND THE PATTERN',
    title: 'Complexity becomes legible.',
    lead: 'We connect what you are experiencing to what is changing around you.',
    detail: 'Research becomes insight. Pain points become priorities. Possibilities become a direction.',
    color: GOLD,
  },
  {
    phase: '04 — THE FIRST USEFUL VERSION',
    title: 'Not everything. The right thing.',
    lead: 'We choose the clearest move that can solve a meaningful problem and prove its value.',
    detail: 'Focused enough to build. Useful enough to test. Strong enough to guide what comes next.',
    color: SILVER,
  },
  {
    phase: '05 — WE BUILD IN PHASES',
    title: 'Each phase earns the next.',
    lead: 'One defined scope. One clear deliverable. One decision point.',
    detail: 'You approve what comes next because the work has demonstrated its value—not because a clock ran out.',
    color: GOLD,
  },
  {
    phase: '06 — I LEAD THE WORK DIRECTLY',
    title: 'The thinking stays close to the work.',
    lead: 'The person defining your engagement remains responsible for carrying it through.',
    detail: 'When the work requires more, I bring the right specialists into the process.',
    color: SILVER,
  },
  {
    phase: '07 — AI ACCELERATES THE WORK',
    title: 'Judgment directs it.',
    lead: 'AI helps us explore, compare, synthesize and build faster.',
    detail: 'Human judgment decides what matters, what moves forward, and what reaches the client.',
    color: GOLD,
  },
  {
    phase: '08 — HANDOFF',
    title: 'You leave with something real.',
    lead: 'A direction. A prototype. A product. A system your team can carry forward.',
    detail: <><strong>The work is yours.</strong><br /><br />BRING US THE PROBLEM THAT DOESN’T FIT THE USUAL PROCESS.</>,
    color: GOLD,
  },
];
const N = SCENES.length;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (x) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};
const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function HowWeWork() {
  const journey = useRef();
  const progress = useRef(0); // 0..N, read every frame by the canvas
  const [scene, setScene] = useState(0);
  const [q, setQ] = useState(0); // for the track, legend and finale
  const [isFull, setIsFull] = useState(false);

  useEffect(() => { document.title = 'WASIVI — How We Work'; }, []);

  useEffect(() => {
    let queued = false;
    const update = () => {
      queued = false;
      const el = journey.current;
      const max = el.offsetHeight - window.innerHeight;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const value = clamp((window.scrollY - top) / max) * N;
      progress.current = value;
      setQ(value);
      setScene(Math.min(N - 1, Math.floor(value)));
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

  const go = useCallback((target) => {
    const el = journey.current;
    const max = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + clamp(target / N) * max, behavior: reduced ? 'instant' : 'smooth' });
  }, []);
  const back = () => go(Math.max(0, scene - 1) + 0.02);
  const next = () => go(scene === N - 1 ? N : scene + 1 + 0.02);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('button,input,textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    const onFull = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFull);
    return () => document.removeEventListener('fullscreenchange', onFull);
  }, []);
  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* not allowed here; the page still works */
    }
  };

  const s = SCENES[scene];
  // The finale only rises once the last slide is nearly done.
  const finish = smooth((q - (N - 0.3)) / 0.3);
  const amounts = threadAmounts(q);

  return (
    <main ref={journey} className={styles.journey}>
      <section className={styles.frame} aria-label="Scroll to explore how WASIVI works">
        <header className={styles.header}>
          <Link to="/" className={styles.brand}>WASIVI</Link>
          <Nav />
          <button type="button" onClick={toggleFull} aria-label={isFull ? 'Exit full screen' : 'Enter full screen'}>
            {isFull ? 'EXIT FULL SCREEN' : 'FULL SCREEN'}
          </button>
        </header>
        <h1 className={styles.srOnly}>How We Work</h1>

        <div
          className={styles.artwork}
          style={{ transform: reduced ? 'none' : `scale(${1 + finish * 0.04})` }}
        >
          <ThreadForm progress={progress} />
        </div>
        <div className={styles.flare} style={{ opacity: finish }} />

        <div className={styles.words} aria-live="polite" style={{ opacity: 1 - finish, '--color': s.color }}>
          <div className={styles.phase}>{s.phase}</div>
          <h2>{s.title}</h2>
          <p className={styles.lead}>{s.lead}</p>
          {s.detail && <div className={styles.detail}>{s.detail}</div>}
        </div>

        <div className={styles.finale} style={{ opacity: finish }}>
          <span>THE PROCESS BECOMES THE OUTCOME</span>
          <strong>THE WORK IS YOURS.</strong>
        </div>

        <div className={styles.hint}>SCROLL TO FOLLOW THE WORK · STOP TO HOLD · SCROLL BACK TO REVERSE</div>
        <div className={styles.legend} aria-hidden="true">
          {Array.from({ length: THREAD_COUNT }, (_, k) => (
            <i key={k} style={{ '--c': THREAD_COLORS[k % 2], opacity: amounts[k] > 0 ? 1 : 0.15 }} />
          ))}
        </div>

        <nav className={styles.bottom} aria-label="Phase navigation">
          <button type="button" onClick={back} disabled={scene === 0}>BACK</button>
          <div className={styles.track}><i style={{ width: `${(q / N) * 100}%` }} /></div>
          <span className={styles.count}>{String(scene + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}</span>
          <button type="button" onClick={next} disabled={q >= N - 0.02}>
            {scene === N - 1 ? 'FINISH' : 'NEXT'}
          </button>
        </nav>
      </section>
    </main>
  );
}
