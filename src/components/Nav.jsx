import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const COMPANY_ROUTES = ['/about', '/how-we-work', '/faq'];

export default function Nav({ variant }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const isCompanyActive = COMPANY_ROUTES.includes(location.pathname);

  return (
    <nav className={variant === 'hero' ? 'hero-nav' : undefined}>
      <div className="menu-item">
        <Link to="/" className={location.pathname === '/' ? 'active' : undefined}>HOME</Link>
      </div>
      <div className="menu-item" ref={ref}>
        <a
          href="#"
          className={isCompanyActive ? 'companyToggle active' : 'companyToggle'}
          onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        >
          COMPANY
        </a>
        <div className={open ? 'dropdown companyDropdown open' : 'dropdown companyDropdown'}>
          <Link to="/about" className={location.pathname === '/about' ? 'active' : undefined}>About</Link>
          <Link to="/how-we-work" className={location.pathname === '/how-we-work' ? 'active' : undefined}>How We Work</Link>
          <Link to="/faq" className={location.pathname === '/faq' ? 'active' : undefined}>FAQ</Link>
        </div>
      </div>
      <div className="menu-item">
        <Link to="/projects" className={location.pathname === '/projects' ? 'active' : undefined}>PROJECTS</Link>
      </div>
      <div className="menu-item">
        <a href="https://read.wasivi.com">SUBSTACK</a>
      </div>
    </nav>
  );
}
