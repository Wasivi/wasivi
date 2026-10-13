import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import Home from './Home';
import About from './About';
import HowWeWork from './HowWeWork';
import Projects from './Projects';
import Faq from './Faq';
import './OnePage.css';

// The whole site is one scrolling page. Each section keeps its old address
// (/about, /how-we-work …): opening one, or choosing it in the menu, scrolls
// there, and as you scroll the address and the menu's gold highlight follow
// along — so old links and shared links still land in the right place.
const SECTIONS = [
  { path: '/', id: 'home', title: 'WASIVI', Page: Home },
  { path: '/about', id: 'about', title: 'WASIVI — About', Page: About },
  { path: '/how-we-work', id: 'how-we-work', title: 'WASIVI — How We Work', Page: HowWeWork },
  { path: '/projects', id: 'projects', title: 'WASIVI — Projects', Page: Projects },
  { path: '/faq', id: 'faq', title: 'WASIVI — FAQ', Page: Faq },
];
const byPath = (p) => SECTIONS.find((s) => s.path === p) ?? SECTIONS[0];

export default function OnePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [current, setCurrent] = useState(() => byPath(location.pathname).id);
  const [showActive, setShowActive] = useState(false);
  const [heroActive, setHeroActive] = useState(true);
  const arrived = useRef(false); // the first scroll to the opening section is done

  // Opening an address, or choosing a menu item: scroll to that section.
  useEffect(() => {
    const target = byPath(location.pathname);
    document.title = target.title;
    if (location.state?.spy) return; // the address just followed the scroll
    const el = document.getElementById(target.id);
    if (!el) return;
    const first = !arrived.current;
    el.scrollIntoView({ behavior: first ? 'instant' : 'smooth', block: 'start' });
    if (first) {
      // Images above can still be loading and shift the page; land again.
      const settle = () => el.scrollIntoView({ behavior: 'instant', block: 'start' });
      const t = setTimeout(() => { settle(); arrived.current = true; }, 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [location.pathname, location.state]);

  // As you scroll: the section filling the middle of the screen is current.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = innerHeight * 0.4;
        let found = SECTIONS[0];
        for (const s of SECTIONS) {
          const el = document.getElementById(s.id);
          if (el && el.getBoundingClientRect().top <= mid) found = s;
        }
        const how = document.getElementById('how-we-work')?.getBoundingClientRect();
        setShowActive(!!how && how.top < innerHeight * 0.6 && how.bottom > innerHeight * 0.4);
        // The landing medallion only animates while any of the hero is on screen.
        const hero = document.getElementById('home')?.getBoundingClientRect();
        setHeroActive(!hero || hero.bottom > 0);
        setCurrent(found.id);
        if (arrived.current && found.path !== window.location.pathname) {
          navigate(found.path, { replace: true, state: { spy: true } });
        }
      });
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
    };
  }, [navigate]);

  return (
    <>
      {/* Past the hero, the shared menu stays at the top of the screen, in the
          same place as before: WASIVI top-left, links top-right. */}
      <div
        className={['one-header', current !== 'home' && 'one-header-on', current === 'how-we-work' && 'one-header-clear'].filter(Boolean).join(' ')}
        aria-hidden={current === 'home'}
      >
        <Nav />
      </div>
      {SECTIONS.map(({ id, Page }) => (
        <section key={id} id={id} className={`one-section one-${id}`}>
          <Page embedded active={id === 'how-we-work' ? showActive : id === 'home' ? heroActive : undefined} />
        </section>
      ))}
    </>
  );
}
