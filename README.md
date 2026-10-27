# Zain ul Abidin · Portfolio

Scroll-driven 3D portfolio: a ribbon of project cards that scatters into a grid, then wraps into a rotating sphere on a dark section. Click or tap any card for its case study.

- **Stack:** Vite · Three.js · Lenis (smooth scroll on desktop only)
- **No image downloads:** every card is drawn on a canvas from `src/projects.js`, so the page stays light on phones.
- **Mobile:** pixel ratio capped at 1.5, smaller textures, native touch scroll, render loop pauses when the tab is hidden.

## Edit content
- Projects: `src/projects.js` (title, tagline, summary, stack, colors, optional link)
- Services, prices, contact: `index.html`

## Run
```bash
npm install
npm run dev
npm run build
```

Deploys to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`).
