import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Nav from '../components/Nav';
import styles from './HowWeWork.module.css';

const HowWeWorkScene = lazy(() => import('../components/HowWeWorkScene'));

// Step 1 uses the exact copy from the approved mockup. Steps 2-5 are still on
// the original site copy — swap `label`/`body` once the real short-form copy
// for those steps is ready.
const STEPS = [
  {
    label: 'DEEP RESEARCH',
    body: 'We enter your world before we propose a solution.',
  },
  {
    label: 'Work moves in phases, not one open-ended contract',
    body: 'Each phase has a defined scope and a clear deliverable. You approve the next phase because the last one earned it — not because a clock ran out.',
  },
  {
    label: 'I lead every engagement directly',
    body: 'The person scoping your project is the person building it. When a project needs additional research, technical, brand, or domain expertise, I bring in trusted specialists rather than keeping a large permanent bench.',
  },
  {
    label: 'AI accelerates the work, judgment directs it',
    body: 'AI speeds up exploration, research synthesis, and parts of implementation. Every product decision and every client-facing outcome is still guided and reviewed by a person before it goes out.',
  },
  {
    label: 'You end up owning something real',
    body: 'Whether the engagement is a focused sprint or a longer build, it ends in a clear handoff — a product direction, a prototype, or a deliverable your team can take forward.',
  },
];

export default function HowWeWork() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef([]);

  useEffect(() => { document.title = 'WASIVI — How We Work'; }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.stepIndex);
            setActiveIndex(idx);
          }
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Nav />
      <div className={styles.wrap}>
        <h1 className={styles.title}>How We Work</h1>

        <div className={styles.layout}>
          <div className={styles.steps}>
            {STEPS.map((step, i) => (
              <div
                className={styles.step}
                key={step.label}
                data-step-index={i}
                ref={(el) => { stepRefs.current[i] = el; }}
              >
                <div className={styles.stepNumber}>
                  {String(i + 1).padStart(2, '0')} — {step.label}
                </div>
                <p>{step.body}</p>
              </div>
            ))}
          </div>

          <div className={styles.visual}>
            <Suspense fallback={<div className="how-we-work-scene" />}>
              <HowWeWorkScene activeIndex={activeIndex} />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
