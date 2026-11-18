# MISPRINT Project Memory

## Context
MISPRINT is an experimental two-layer spatial puzzle browser game built with React 19, TypeScript, Vite, Tailwind CSS v4, Phaser 4, and Vitest.
The player manipulates two printmaking sheets:
1. INK — the main physical world (warm cream paper `#F5EFE1`, charcoal ink platforms, courier postboxes).
2. GHOST — the translucent registration layer (cobalt vellum `#2563EB`, movable registration marks, dynamic bridges).
Matching registration marks activates dynamic bridge connections between platforms. Dot, an autonomous courier, travels through the environment attempting to deliver a parcel.

Mission: Transformed the existing repository into a polished, original, production-ready browser puzzle game on branch `antigravity/misprint-production`.

## Architectural Decisions
- Branch: `antigravity/misprint-production` branched from `main`.
- Engine: Phaser 4.2.1 embedded inside React 19 shell.
- Simulation: Fixed-step deterministic simulation (`FIXED_TIMESTEP_MS = 16.666ms` / 60Hz tick) in `SimulationEngine`, `RegistrationEngine`, `DotController`, and `PaperLayerSystem`.
- Progression: Sequential level unlocking by default (`unlockAllLevels: false`, `highestUnlocked: 1`), safe localStorage persistence (`StorageManager.ts`) with schema migration (`v1` -> `v2`) and robust in-memory fallback for private browsing.
- Touch & Mobile Architecture: Scoped `touch-action: none` strictly to the Phaser canvas container in `PhaserGame.tsx`. Removed `user-scalable=no` from `index.html` to preserve accessibility. Modal dialogues use `.modal-scroll-area` with `touch-action: pan-y; -webkit-overflow-scrolling: touch;`.
- Responsive Viewport Scaling: `computeWorldLayout` dynamically centers and fits the 960x540 world sheet across desktop, mobile portrait (safe top/bottom margins), and mobile landscape without clipping HUD controls.
- Audio Architecture: Procedural Web Audio synthesis (`SoundEngine.ts`) with bandpass noise paper sliding friction, transient acoustic woodblock clicks, heel-toe footstep cadences, tape rewind sweeps, and 5-note victory bell chords.
- Asset Bundling: Rolldown code-splitting via `vite.config.ts` separating app code (`111 kB`), vendor React/Motion (`222 kB`), and Phaser engine (`1,367 kB`). Zero build warnings.

## Burn Book (Failed Approaches & Gotchas)
1. **Parent PostCSS Traversal:** Vite traverses upward looking for `postcss.config.js`. `G:\Antigravity\postcss.config.js` with Tailwind v3 clashed with Misprint's Tailwind v4. Fix: explicitly set `css: { postcss: { plugins: [] } }` in `vite.config.ts`.
2. **Rolldown `manualChunks` Format:** In Vite 8 / Rolldown, `manualChunks` in `rollupOptions.output` must be an inspection function `(id: string) => string | void`, NOT a plain dictionary object.
3. **Vitest Node Environment `localStorage`:** Vitest runs in a Node environment where `window.localStorage` is undefined. `StorageManager.test.ts` uses an attached `MockStorage` shim to test storage migration safely.
4. **Biaxial Registration Offset Validation:** Test 16 assumed `exactGhost` could be computed assuming `inkOffset = { x: 0, y: 0 }`. In Level 7, both Ink and Ghost move independently (Ink on X, Ghost on Y). Tests must validate relative offset reachability: `targetDiff = inkPos - ghostPos` lies within `[minGhost - maxInk, maxGhost - minInk]`.
5. **Moving Obstacle Clearance on Bridges:** If a bridge spans across a moving press roller, the bridge must be an elevated arch (not a flat segment at ground level) with clearance exceeding `roller.radius + dot.radius` (26px).

## Active Scratchpad
- [x] Phase A: Repository Audit completed (Bun 1.4.4, TypeScript clean, fixed Tailwind v4 / PostCSS build crash, produced audit report artifact).
- [x] Phase B: Core Engineering Improvements completed (StorageManager with v1->v2 migration, unlockAllLevels: false by default, safe in-memory fallback, mobile touch scoped to canvas, modal scrolling touch-action, tab visibility pause/resume safety, 27/27 tests passing).
- [x] Phase C: Professional Game Feel completed (procedural paper sliding audio, acoustic woodblock clicks, cassette tape rewind, footstep rhythms, postbox flag & starburst, elevation shadow deepening, subtle inertia drag tilt, registration snap particle bursts).
- [x] Phase D: Visual Identity completed (cohesive 2D printmaking aesthetic, warm cream `#F5EFE1`, charcoal ink, cobalt vellum `#2563EB`, vermilion accents, custom SVG favicon, responsive HUD).
- [x] Phase E: Puzzle Design & Campaign Expansion completed (expanded campaign to 9 handcrafted levels across 3 thematic chapters: The First Proofs, Dangerous Impressions, Master Folio).
- [x] Phase F: Tutorial & FTUE completed (interactive step-by-step contextual hints on Proof 01, auto-pause guidance, curb pause mechanics).
- [x] Phase G: QA & Automated Validation completed (27 automated Vitest unit & simulation tests solving all 9 levels deterministically, mobile portrait/landscape layout tests, GitHub Actions CI workflow in `.github/workflows/ci.yml`).
- [x] Phase H: Release Readiness completed (comprehensive professional README.md, metadata & favicon, chunk splitting, verified on desktop & mobile viewports via chrome-devtools with 0 console errors).
