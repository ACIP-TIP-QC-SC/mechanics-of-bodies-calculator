# Mechanics of Rigid and Deformable Bodies Calculator

An interactive, browser-only solver for Statics of Rigid Bodies, Dynamics of Rigid Bodies and Mechanics of Deformable Bodies, with 2D and 3D diagrams, step-by-step solutions and a printable PDF report.

American Concrete Institute Philippines T.I.P. QC Student Chapter · by CEM Jumawan

**Live site:** https://acip-tip-qc-sc.github.io/mechanics-of-bodies-calculator/

## Modules

Built so far:

- **Statics of Rigid Bodies:** Force Systems (coplanar and 3D resultants, direction angles, components along a line, moments about a point and an axis, force-couple systems, wrenches, distributed loads); Equilibrium (particles in a plane and in space, rigid bodies with pins, rollers, fixed supports, cables and links, with checks for statically indeterminate and improperly constrained bodies); Trusses (Pratt, Howe, Warren, roof and cantilever templates or any plane truss typed in, method of joints and method of sections step by step, zero-force members, joint free-body diagrams, and the deflected truss with its animation); Centroids and Moments of Inertia (composite areas, wires and bodies, Pappus and Guldinus, principal axes and Mohr's circle); Internal Forces (internal loadings at a cut, shear and moment diagrams with the deflected shape and its animation, cables with point loads, uniform loads or their own weight, with supports at the same or different levels); Friction (blocks that slip or tip, a block sliding on an incline with static and kinetic friction, ladders, wedges, square-threaded screws, flat belts over drums)
- **Mechanics of Deformable Bodies:** Simple Stress and Strain (normal stress, strain and Poisson's ratio in a bar; a weight hung on two rods; bolted and pinned joints checked for shear, bearing, net section and tear-out; sizing pins, rods, punched plates and collars from a factor of safety; reading E, yield, ultimate and fracture stress, resilience and toughness from stress-strain data, with unloading and the permanent set; a shear pad), with a material picker filled from the book's table of average properties; Axial Load (stepped bars with loads along them, free, fixed at both ends or short of a wall, with normal-force and displacement diagrams; members side by side or one inside another under a rigid cap; a rigid bar on rods or posts, with or without a pin; temperature change in all of these; stress concentration at a hole or shoulder fillets), solved in the book's order of equilibrium, compatibility and load-displacement; Torsion (stepped solid or tubular shafts, free or fixed at both ends, with torque and angle-of-twist diagrams and surface lines that twist; shafts sized from power and speed; a tube bonded to a core; square, triangular and elliptical shafts compared with a round shaft of the same area); Beam Stresses (bending stress by the flexure formula and shear stress by the shear formula on any section, a W shape from the table or a section built from parts, with the moment and shear taken from a beam or typed in; shear flow and fastener spacing in built-up beams; bending about an inclined axis with the tilted neutral axis; picking the lightest W shape or sizing a rectangle or round bar from the allowable stresses, then checking shear); Beam Deflection (slope and deflection anywhere on a beam with any pins, rollers and fixed supports, by integrating the elastic curve region by region with its boundary and continuity conditions, by adding the standard cases of Appendix D, or, for indeterminate beams such as a propped cantilever, a beam fixed at both ends or one continuous over a middle support, by removing the redundants and restoring compatibility; shear, moment, slope and deflection diagrams under an animated elastic curve); Stress and Strain Transformation (stress or strain on an element turned by any angle, principal values and their directions, the largest in-plane and absolute shear, on a Mohr's circle whose point x' can be dragged round to turn the element; 45°, 60° and general strain rosettes with the principal stresses from E and ν; generalized Hooke's law with the change in size, dilatation and bulk modulus)

Wherever a member deflects, Play bends it from straight to its deflected shape and back in a 10-second loop (speed 0.25× to 4×), in 2D and in 3D, coloured from blue (no deflection) to red (the largest). Every later module with a deflected shape follows the same rule.

Every diagram has a collapsible **Diagram options** bar under it that holds the switches which only change the picture (values on the diagram, the deflected shape, what Play animates, the truss tension/compression colours, the joint free-body diagram). Inputs keep only what changes the problem. Every later module puts its display switches in the same bar.

Planned: seven Dynamics modules; two more Mechanics of Deformable Bodies modules (Combined Loadings and Buckling of Columns). A discipline tab appears once its first module is built.

## Layout

- `index.html`: the shared header, the discipline tabs and the footer
- `shared/`: everything used by more than one discipline
  - `styles.css`, `ui.js` (controls and SVG drawing kit), `iso3d.js` (3D view), `charts.js`, `anim.js`
  - `core.js` (units, 4-significant-figure formatting, step recorder, preset merge), `app.js` (app shell), `report.js` (Print PDF)
  - `beam.js` (beam engine: reactions, N, V and M)
- `st/`: Statics solver. Each module has a physics file (`internal.js`) and a UI file (`modInternal.js`)
- `md/`: Mechanics of Deformable Bodies solver, laid out the same way, with `mdcore.js` (units, the material table, bar areas) and `mdui.js` (3D cylinders, arrows, the material picker)
- `vendor/`: html2canvas 1.4.1 and jsPDF 2.5.1 (MIT licensed), hosted here so the PDF feature needs no outside scripts
- `tests/`: `run.js` checks the physics against textbook answers; `presets.spec.js` loads every preset in a headless browser

Everything runs in the browser; there is no build step. To run it locally, serve the folder with any static server, for example `python3 -m http.server`, and open http://localhost:8000.

## Tests

```
node tests/run.js             # physics against textbook answers
node tests/presets.spec.js    # every preset, 2D and 3D, in headless Chromium (needs Playwright)
```

Sign conventions and worked steps follow R. C. Hibbeler, *Engineering Mechanics: Statics* and *Dynamics* (15th ed.) and *Statics and Mechanics of Materials* (6th ed.).
