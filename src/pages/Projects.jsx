import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import styles from './Projects.module.css';

const PROJECTS = [
  {
    key: 'metu',
    title: 'METU',
    date: 'IN PROGRESS',
    blurb: "A patient shouldn't need a research background to find the trial that could save their life.",
    video: null,
    body: [
      "An oncology trial access navigator, built to close the gap between patients and the clinical research that could help them.",
      "The trials exist. The eligibility criteria are public. What's missing is a way for a patient — or the person helping them — to find the ones that actually apply without a research background and weeks of reading.",
    ],
    meta: 'Status: In progress',
  },
  {
    key: 'sightline',
    title: 'SIGHTLINE',
    date: 'FIRST CUSTOMER CONFIRMED',
    blurb: 'Prior authorization is where care stalls. This is where it moves.',
    video: '/videos/sightline.mp4',
    body: [
      'A retina practice runs prior authorizations every day. Most track them across a spreadsheet, a sticky note, and somebody’s memory.',
      'SIGHTLINE holds all of it — nine statuses from new order to closed, every payer’s required-document checklist enforced so a case can’t be submitted incomplete, and a full submission record for every send: timestamp, payer, exact filenames, the message as it went out. When the payer says they never received it, you read them the list.',
      'One click on the wordmark clears the screen to the login page — built for the moment someone walks past the desk.',
      'Built for one practice on Park Avenue. Adaptable to any.',
    ],
    meta: 'Team: Solo<br>First customer: Dr. Ravi Parikh, Manhattan Retina &amp; Eye Consultants',
  },
  {
    key: 'oncue',
    title: 'On Cue',
    date: 'IN PROGRESS',
    blurb: "On a set, the gap between what's decided and what reaches the crew costs hours. This closes it.",
    video: '/videos/oncue.mp4',
    body: [
      "On a film or television set, decisions get made at the top and take hours to reach the people who have to act on them. That lag costs real time and real money, every shooting day.",
      "On Cue compresses that gap — built from in-person discovery on an active production, working through crew to ADs and producers to find where the pipeline actually breaks.",
    ],
    meta: 'Status: In progress',
  },
  {
    key: 'linkup',
    title: 'LinkUp',
    date: 'JULY',
    blurb: 'Four people want dinner. It takes nine days and forty-one messages. Not anymore.',
    video: '/videos/linkup.mp4',
    body: [
      "Four people want to have dinner. That is the entire problem, and it takes nine days and forty-one messages to solve, because someone has to hold every constraint in their head at once — who's free Thursday, who won't do Thai, who isn't crossing a bridge on a weeknight, whether it rains.",
      "So I built the thing that holds it instead. Five named agents, each owning one piece: one parses what you actually said, one handles scheduling, one matches venues, one negotiates group consensus, one confirms. You type a sentence the way you'd say it out loud — dinner for four, Japanese, Soho, the 25th — and it comes back understood, not as a form you filled out.",
      'Say it once. Let it get handled.',
    ],
    meta: 'Tech stack: Next.js, TypeScript, OpenRouter/Claude, Yelp Fusion, Open-Meteo, Nominatim<br>Team: Natalie Walker, Bo Moldenhauer',
  },
  {
    key: 'hyperscale',
    title: 'Hyperscale Data Center Intelligence',
    date: 'JUNE',
    blurb: 'Everything about a data center deal is public. None of it is read together. This reads it together.',
    video: null,
    body: [
      'James is 61. He fixes air conditioners in a county that just approved a hyperscale data center, and he found out the way everyone finds out — after. He is not a researcher or an analyst. He wants to know who decided this, and whether there is anything left he can do.',
      'Everything he needs is public. Permits, utility queue positions, state filings, lobbying disclosures — nine kinds of record, none of them read together, which is the same as none of them read at all.',
      'I built the instrument that reads them together. Six views over a ten-actor, eight-decision-layer framework that traces a project through regulatory, financial, and legal systems long before it reaches a county meeting. The finding underneath it: planned-to-operating ratio predicts conflict better than facility count. Georgia sits at 1.50, Indiana at 1.42, and Virginia — the largest market in the country — at 0.72.',
      "By the time it's public, it's already done. Not anymore.",
    ],
    meta: 'Tech stack: React, Vite, Netlify, Claude API with live web search, Netlify serverless functions<br>Team: Natalie Walker, Andres Ballares',
  },
  {
    key: 'workclarity',
    title: 'Work Clarity',
    date: 'MAY',
    blurb: "Your rights at work exist. Finding them shouldn't be the hard part.",
    video: '/videos/work-clarity.mp4',
    body: [
      "Everybody loves you when you're up. Nobody's around when you're down — and that's exactly when you need to know your rights.",
      'The information exists. It’s scattered across agencies, legal aid sites, and forums that assume you already know what you’re looking for. Work Clarity pulls it into one place and puts specialized AI guides between the user and the mess, so someone in the worst week of their working life can find out what applies to them and what to do next.',
      'Clarity, when you need it most.',
    ],
    meta: 'Tech stack: React, Vite, Supabase, AI guide integration, external APIs<br>Team: Solo',
  },
  {
    key: 'bloombase',
    title: 'Bloombase',
    date: 'APRIL',
    blurb: "Somewhere in seventy thousand photos is the one you're looking for.",
    video: '/videos/bloombase.mp4',
    body: [
      "Somewhere in 70,000 photos is the one you're looking for, and a folder isn't a system.",
      'Large flower photo archives grow past the point any album view or filename convention can handle — the picture you need exists, but finding it costs more than it should every single time.',
      'Bloombase organizes it. The harder work wasn’t adding features, it was cutting them — scoping a much larger initial concept down to the MVP that actually solves the finding problem, then building it end to end alone.',
    ],
    meta: 'Tech stack: React, Vite, Supabase<br>Team: Solo',
  },
];

export default function Projects() {
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => { document.title = 'WASIVI — Projects'; }, []);

  useEffect(() => {
    document.body.style.overflow = openKey ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [openKey]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpenKey(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const active = PROJECTS.find((p) => p.key === openKey);

  return (
    <>
      <Nav />

      <div className={styles.heroLine}>
        <h1>You imagine it. We build it.</h1>
        <p>Prototypes, decks, working products — whatever form the idea needs.</p>
      </div>

      <div className={styles.list}>
        {PROJECTS.map((p) => (
          <div className={styles.item} key={p.key} onClick={() => setOpenKey(p.key)}>
            <div className={styles.body}>
              <h3 className={styles.name}>{p.title}</h3>
              <div className={styles.date}>{p.date}</div>
              <p className={styles.blurb}>{p.blurb}</p>
            </div>
            <div className={styles.plus}>+</div>
          </div>
        ))}
      </div>

      <div className={active ? `${styles.detail} ${styles.detailOpen}` : styles.detail}>
        <button className={styles.close} onClick={() => setOpenKey(null)} aria-label="Close">×</button>
        <div className={styles.detailInner}>
          {active && (
            <>
              {active.video ? (
                <video autoPlay loop muted playsInline controls src={active.video} />
              ) : (
                <div className={styles.videoslot}>[ VIDEO COMING ]</div>
              )}
              <h2>{active.title}</h2>
              <div className={styles.date}>{active.date}</div>
              {active.body.map((para, i) => <p key={i}>{para}</p>)}
              {active.meta && (
                <div className={styles.meta} dangerouslySetInnerHTML={{ __html: active.meta }} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
