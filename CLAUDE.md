# WASIVI site

Portfolio site for WASIVI (Natalie Walker). Vite + React + React Router, with
React Three Fiber for the home-page hero. Product context: `wasivi-prd.md`.

## Commands

- `npm run dev` — local dev server at http://localhost:5173
- `npm run check` — production build + Playwright checks (every page loads
  without errors; hero medallion screenshots at fixed angles). Screenshots go
  to `screenshots/`.
- `npm run build` / `npm run preview` — production build and serve it locally

## Deploying — read before any push

- **Vercel deploys `main` straight to https://www.wasivi.com.** A push to
  `main` is a production release.
- Do all new work on a branch. Never push or merge to `main` until Natalie has
  seen the result (localhost or screenshots) and said to put it live.
- Ask before every push to `main`, even if an earlier push was approved.
- `vercel.json` holds the SPA rewrite so client routes survive a refresh.
  `netlify.toml` is a leftover and unused — the site is not on Netlify.

## The hero is sacred

- The home hero is Natalie's motif: a gold glyph inside a chrome ring. The
  source is `public/videos/hero.mp4`.
- Never replace it with a placeholder or generic shape, not even temporarily,
  on any branch that could go live.
- The 3D version (`src/components/MedallionScene.jsx`) builds the real glyph:
  its outline is in `src/components/medallionGlyph.json`, traced from
  `hero.mp4`, snapped to its grid and made symmetric. The glyph is extruded
  so it juts well out in front of a deep chrome band, like the three-quarter
  views in the video.
- Dev only: `/?angle=140` freezes the medallion's spin at that many degrees,
  for inspecting and screenshotting a specific view.

## Look and feel

- Gold is brass/olive, like the motif: brand `--gold-bright` is `#a89c3e`.
  Glyph faces are brushed with concentric rings; side walls are steel.
- **Nothing may look brown or "chocolate".** Dim gold on black reads as brown,
  so:
  - the black face stays true black (it is deliberately unlit);
  - no warm haze or glow behind the medallion;
  - the environment keeps an even ring of neutral softboxes, so the gold
    never reflects darkness at some angle and turns bronze.
- Gold dust = crisp, visible gold flakes falling slowly like snow, with a few
  silver ones. Not soft blurry bokeh.
- Page background is `--black: #15130f` (see `src/theme.css`).

## Verifying work

- Run `npm run check` and actually open the screenshots before calling
  visual work done. A passing test is not proof it looks right.
- The hero test fails if the medallion shows too little gold or too much
  brown at any tested angle.
- Headless Chromium cannot play `hero.mp4` (no H.264). To screenshot the
  video hero, use Playwright's WebKit browser.
- Performance target: 60fps on a laptop. Keep particle counts capped and let
  `PerformanceMonitor` drop the pixel ratio when frames suffer.

## Known issues

- On phone widths the WASIVI wordmark and the nav overflow horizontally. This
  was already true before the 3D work.
