import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import HowWeWork from './pages/HowWeWork';
import Faq from './pages/Faq';
import Projects from './pages/Projects';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/how-we-work" element={<HowWeWork />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/projects" element={<Projects />} />
    </Routes>
  );
}
