import { useEffect } from 'react';
import Nav from '../components/Nav';
import styles from './Faq.module.css';

const SECTIONS = [
  {
    label: 'GENERAL',
    items: [
      {
        q: 'What does WASIVI build?',
        a: 'WASIVI helps founders and teams turn early ideas into clear, credible digital products. We shape MVPs, prototypes, launch experiences, AI-enabled concepts, and presentation stories that help people understand what to build next.',
      },
      {
        q: 'Can I start with something focused before committing to a larger build?',
        a: 'Yes. Many engagements begin with an MVP Blueprint, product strategy session, presentation, or prototype. Start with the work that creates the most clarity now, then decide what comes next.',
      },
    ],
  },
  {
    label: 'ENGAGEMENT',
    items: [
      {
        q: 'How does an engagement typically start?',
        a: 'Most engagements begin with a focused discovery phase. We clarify the opportunity, the user, the first useful version, and the decisions needed before design or development begins.',
      },
      {
        q: 'What does a typical engagement look like?',
        a: 'Work is organized into defined phases with a clear scope, tangible deliverables, and a decision point at the end of each phase. The next phase begins only when the work has earned it.',
      },
      {
        q: "What's the typical timeline?",
        a: 'A focused phase may take a few weeks. More involved product, prototype, or build work can extend over several phases, depending on complexity and the pace of decision-making.',
      },
    ],
  },
  {
    label: 'INVESTMENT & HANDOFF',
    items: [
      {
        q: "What's the investment for an engagement?",
        a: 'It depends on the shape of the work. Focused engagements are scoped as fixed projects; larger product programs are priced phase by phase. You will know the scope, deliverables, and investment for a phase before it begins.',
      },
      {
        q: 'Who owns the work once it is complete?',
        a: 'Once the agreed work is complete and final payment is received, you own the final project-specific deliverables. WASIVI retains ownership of its pre-existing methods, templates, tools, and reusable systems.',
      },
    ],
  },
  {
    label: 'TEAM & AI',
    items: [
      {
        q: "Who's actually doing the work?",
        a: 'WASIVI is founder-led. I lead product direction, design, presentation storytelling, and the core build, and bring in trusted specialists when a project needs additional research, technical, brand, or domain expertise.',
      },
      {
        q: 'How is AI used in your process?',
        a: 'AI helps accelerate exploration, research synthesis, prototyping, and selected implementation work. Human product judgment and design direction guide every decision, and every client-facing outcome is reviewed before delivery.',
      },
      {
        q: 'Can WASIVI work with my existing team or developer?',
        a: 'Yes. WASIVI can lead a focused project independently or work alongside your internal team, agency, or developer. The goal is a clear handoff and a product direction your team can continue to build.',
      },
    ],
  },
];

function QA({ q, a }) {
  return (
    <details
      className={styles.qa}
      onToggle={(e) => {
        const icon = e.currentTarget.querySelector('[data-toggle-icon]');
        if (icon) icon.textContent = e.currentTarget.open ? '−' : '+';
      }}
    >
      <summary>
        {q}
        <span className={styles.toggleIcon} data-toggle-icon>+</span>
      </summary>
      <div className={styles.answer}>{a}</div>
    </details>
  );
}

export default function Faq() {
  useEffect(() => { document.title = 'WASIVI — FAQ'; }, []);

  return (
    <>
      <Nav />
      <div className={styles.wrap}>
        <h1 className={styles.title}>FAQ</h1>
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <div className={styles.sectionLabel}>{section.label}</div>
            {section.items.map((item) => (
              <QA key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
