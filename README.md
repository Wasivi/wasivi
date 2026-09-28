# WASIVI

Source for [wasivi.com](https://wasivi.com) — the public site for WASIVI, a founder-led AI product studio that turns early-stage ideas into working prototypes, MVPs, and presentation-ready product concepts.

## About WASIVI

WASIVI is led by Natalie Walker. It helps founders and teams move from "idea" to "something a person can actually see and evaluate" — through MVP blueprints, working prototypes, AI-enabled concepts, and the presentation/storytelling materials that make a product legible to investors, customers, or internal stakeholders.

See [wasivi-prd.md](wasivi-prd.md) for the full product requirements document, including target customers, business model, current scope, and roadmap.

## Site structure

React app (Vite + React Router). Each route is a page component under [src/pages/](src/pages):

| Page | Route | File |
|---|---|---|
| Home | `/` | [src/pages/Home.jsx](src/pages/Home.jsx) |
| About | `/about` | [src/pages/About.jsx](src/pages/About.jsx) |
| How We Work | `/how-we-work` | [src/pages/HowWeWork.jsx](src/pages/HowWeWork.jsx) |
| FAQ | `/faq` | [src/pages/Faq.jsx](src/pages/Faq.jsx) |
| Projects | `/projects` | [src/pages/Projects.jsx](src/pages/Projects.jsx) |

Shared nav lives in [src/components/Nav.jsx](src/components/Nav.jsx); shared theme variables in [src/theme.css](src/theme.css). The home page's hero mark is a React Three Fiber scene ([src/components/HeroScene.jsx](src/components/HeroScene.jsx)) — a 3D orb textured with the hero video, with mouse-driven rotation, fog, and particles.

Static assets (video, images) live in [public/](public) and are served at the same paths (`/videos/...`, `/images/...`).

## Stack & deployment

React + Vite, deployed via GitHub + Netlify (see [netlify.toml](netlify.toml)), connected to the wasivi.com domain. Build command `npm run build`, publish directory `dist`.

### Local development

```
npm install
npm run dev       # dev server
npm run build     # production build to dist/
npm run preview   # preview the production build
```

## Status

MVP / pre-launch. Six demonstrated products (Hyperscale Data Center Intelligence, LinkUp, Work Clarity, Bloombase, SIGHTLINE, and METU) serve as the studio's proof of working method.
