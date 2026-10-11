import { Routes, Route } from 'react-router-dom';
import OnePage from './pages/OnePage';

// One scrolling page. Every address (/, /about, /how-we-work, /projects,
// /faq) opens it and scrolls to that section.
export default function App() {
  return (
    <Routes>
      <Route path="*" element={<OnePage />} />
    </Routes>
  );
}
