import { useEffect } from 'react';
import Nav from '../components/Nav';
import './About.css';

export default function About() {
  useEffect(() => { document.title = 'WASIVI — About'; }, []);

  return (
    <>
      <Nav />
      <div className="split">
        <div className="photo-col">
          <img className="photo-real" src="/images/about-photo.png" alt="Natalie Walker" />
        </div>
        <div className="text-col">
          <div className="name-line">I'm Natalie Walker — a modern-day Renaissance woman, and founder of WASIVI.</div>
          <div className="bio">
            <p>First, a little background: I spent twenty years building Walker Sinclair Visuals, an embroidery design and development studio with offices in both China and New York, working with Ralph Lauren, Tory Burch, and Oscar de la Renta, among others. That work earned Vogue covers and swatches now held in the Met's Costume Institute Library. Running a global studio meant tracking an idea through every stage — design, sourcing, manufacturing, delivery — all while following international government regulations.</p>
            <p>I was looking for something more meaningful — a chance to make a difference, to make a change, to give something back. That search was right here in New York City, the city that raised me professionally. What followed were my philanthropic years: at the Mayor's Office of Appointments, I read regulations, spotted risk, and vetted candidates for 246 boards and commissions, bringing AI into that process well before it was standard.</p>
            <p>For years, ideas outpaced the ability to build them. A first website, built by someone else, came out good — just not quite right. That's the real gap: between what you ask for and what you actually meant. AI closed it. Now the work moves straight from idea to product, aimed at industries where it matters most — healthcare, design, and government. That became WASIVI.</p>
            <p>WASIVI works the way each project demands. I lead every engagement directly. I bring in specialists as the work requires, not a permanent bench. You get direct access to the person doing the thinking, backed by the right people when the project calls for them.</p>
            <p style={{ marginTop: 28 }}><strong>The medium changed. The thinking never did.</strong></p>
          </div>
        </div>
      </div>
    </>
  );
}
