# Mechanics of Bodies Calculator

An interactive, browser-only solver for Statics of Rigid Bodies, Dynamics of Rigid Bodies and Mechanics of Deformable Bodies, with 2D and 3D diagrams, step-by-step solutions and a printable PDF report.

American Concrete Institute Philippines T.I.P. QC Student Chapter · by CEM Jumawan

**Live site:** https://acip-tip-qc-sc.github.io/mechanics-of-bodies-calculator/

## Modules

Built so far:

- **Statics of Rigid Bodies:** Internal Forces (internal loadings at a cut, shear and moment diagrams, cables)

Planned: Force Systems, Equilibrium, Trusses, Friction, Centroids and Moments of Inertia (Statics); seven Dynamics modules; eight Mechanics of Deformable Bodies modules. A discipline tab appears once its first module is built.

## Layout

- `index.html`: the shared header, the discipline tabs and the footer
- `shared/`: everything used by more than one discipline
  - `styles.css`, `ui.js` (controls and SVG drawing kit), `iso3d.js` (3D view), `charts.js`, `anim.js`
  - `core.js` (units, 4-significant-figure formatting, step recorder, preset merge), `app.js` (app shell), `report.js` (Print PDF)
  - `beam.js` (beam engine: reactions, N, V and M)
- `st/`: Statics solver. Each module has a physics file (`internal.js`) and a UI file (`modInternal.js`)
- `vendor/`: html2canvas 1.4.1 and jsPDF 2.5.1 (MIT licensed), hosted here so the PDF feature needs no outside scripts
- `tests/`: `run.js` checks the physics against textbook answers; `presets.spec.js` loads every preset in a headless browser

Everything runs in the browser; there is no build step. To run it locally, serve the folder with any static server, for example `python3 -m http.server`, and open http://localhost:8000.

## Tests

```
node tests/run.js             # physics against textbook answers
node tests/presets.spec.js    # every preset, 2D and 3D, in headless Chromium (needs Playwright)
```

Sign conventions and worked steps follow R. C. Hibbeler, *Engineering Mechanics: Statics* and *Dynamics* (15th ed.) and *Statics and Mechanics of Materials* (6th ed.).
