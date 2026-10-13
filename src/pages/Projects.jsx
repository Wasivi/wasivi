import { useEffect, useState } from 'react';
import Nav from '../components/Nav';
import styles from './Projects.module.css';

// Projects are private. Visitors see a login; names and passwords are given
// out by Natalie on request. The project list itself lives outside the site
// (private/ProjectsList.jsx) so it can't be read from the page code. Until
// accounts are connected, no name and password unlocks anything.
const CONTACT = 'info@wasivi.com';

export default function Projects({ embedded }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => { if (!embedded) document.title = 'WASIVI — Projects'; }, [embedded]);

  function submit(e) {
    e.preventDefault();
    setTried(true);
  }

  return (
    <>
      {!embedded && <Nav />}
      <div className={styles.login}>
        <div className={styles.eyebrow}>Projects</div>
        <h1 className={styles.loginTitle}>Selected work is private.</h1>
        <p className={styles.loginLead}>Log in with the name and password you were given.</p>

        <form className={styles.form} onSubmit={submit} noValidate>
          <label htmlFor="projects-name">Name</label>
          <input
            id="projects-name"
            type="text"
            autoComplete="username"
            value={name}
            onChange={(e) => { setName(e.target.value); setTried(false); }}
            required
          />
          <label htmlFor="projects-password">Password</label>
          <input
            id="projects-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setTried(false); }}
            required
          />
          <button type="submit" disabled={!name || !password}>Log in</button>
          {tried && (
            <p className={styles.error} role="alert">
              That name and password weren't recognized.
            </p>
          )}
        </form>

        <p className={styles.request}>
          Don't have access? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> to request a name and password.
        </p>
      </div>
    </>
  );
}
