# MISPRINT

> **"The world is printed wrong. Fix it before it moves."**

An experimental two-layer spatial printmaking browser puzzle game built with **React 19**, **TypeScript**, **Phaser 4**, and **Tailwind CSS v4**.

---

## Overview

In traditional printmaking, color separations must register with sub-millimeter precision before the heavy cylinder rolls across the press bed. If an impression sheet is misaligned, the ink bleeds, bridges fracture, and the print is lost.

In **MISPRINT**, the player manipulates two distinct physical printmaking layers:
1. **The Ink Bed (Physical World):** The heavy, warm cream paper base sheet (`#F5EFE1`) containing physical platforms, ink spills, and courier postboxes.
2. **The Ghost Vellum (Registration Layer):** A translucent, cobalt-tinted vellum sheet (`#2563EB`) containing movable registration marks and dynamic bridges.

Dot, an autonomous courier carrying a sealed parcel, marches steadily across the sheet toward the target delivery postbox. If Dot reaches an open gap or misprint seam, they tumble off the sheet. By dragging the sheets and aligning matching registration marks (Circles, Diamonds, Squares), the player completes the circuit, raises dynamic bridges, and guides Dot safely across the press.

---

## Core Game Features

- **Dual-Layer Spatial Manipulation:** Drag the Ghost vellum or Ink bed across independent axes with realistic paper elevation, dynamic drop shadows, and subtle inertia tilt.
- **Sub-Millimeter Registration Alignment:** Woodcut registration targets (Circle ○, Diamond ◇, Square □) snap into alignment with tactile audio feedback and registration confirmation rings.
- **Hazardous Misprints & Traps:** Avoid decoys and false registration marks (Cross ✕) that span into toxic ink spills or trigger active press rollers.
- **Dynamic Multi-Stage Bridges:** Align and break temporary bridges on the fly to navigate Dot through complex multi-stage spatial labyrinths.
- **Tactile Procedural Audio Engine:** Web Audio synthesizers produce realistic paper friction sliding, crisp acoustic woodblock stamp clicks, footstep cadences, cassette tape rewind sweeps, and multi-note letterpress bell victory chords.
- **Deterministic Fixed-Timestep Physics:** Run at a strict 60Hz deterministic tick rate (`16.666ms`), supporting frame-perfect rewind (`RewindSystem`) to step back through time without simulation corruption.
- **Sequential 9-Level Campaign:** Three distinct thematic chapters spanning from basic sheet registration to complex biaxial press coordination.
- **Full Responsive & Mobile Support:** Dynamic viewport scaling supporting desktop, mobile portrait (with touch-safe top and bottom margins), and mobile landscape.
- **Privacy-Safe Local Storage:** Schema-versioned save system with automatic legacy migration (`v1` to `v2`) and private browsing in-memory fallbacks.

---

## The Campaign

### Chapter 1: The First Proofs
- **Proof 01 — Two Sheets:** Master the central mechanic: align the translucent Ghost sheet to bridge the gap before Dot steps off.
- **Proof 02 — Missing Bridge:** Bridge a wider gap using horizontal sheet sliding with strict movement bounds.
- **Proof 03 — Twin Marks:** Introduction of distinct registration marks; align Circle (○) and Square (□) sequentially.

### Chapter 2: Dangerous Impressions
- **Proof 04 — False Register:** Identify compatible vs. incompatible anchors. Avoid the false cross trap (✕) that leads into an ink spill.
- **Proof 05 — The Pendulum Press:** Time temporary bridge connections while navigating around a moving heavy press roller.
- **Proof 06 — Reciprocal Bridges:** Opposing reciprocal spans where only one bridge can be active at a time; Dot must wait at island curbs while you re-register sheets.

### Chapter 3: Master Folio
- **Proof 07 — Two Presses:** Biaxial layer movement: drag the Ink bed horizontally and the Ghost vellum vertically to coordinate the press.
- **Proof 08 — The Counterweight:** Open-drop physics: Dot leaps from a high diving viaduct, lands on a lower terrace, and climbs an arch over an oscillating roller.
- **Proof 09 — Master Impression:** The ultimate test: 3-stage coordination combining entry viaducts, roller overpass arches, trap discernment, and the master postbox sanctuary.

---

## Game Controls

| Control | Action |
| :--- | :--- |
| **Mouse Drag / Touch Drag** | Drag the Ghost vellum (or Ink bed) to align registration marks |
| **Arrow Keys (← ↑ → ↓)** | Fine-tune sheet alignment by 2px per press |
| **Shift + Arrow Keys** | Nudge sheet alignment by 10px per press |
| **Z** | Rewind simulation to previous shift / checkpoint |
| **R** | Reset current proof to starting state |
| **P** | Pause / Resume game |
| **M** | Toggle audio mute |

---

## Technical Architecture

```
src/
├── components/          # React 19 UI overlays (HUD, Level Select, Settings, Tutorial)
│   ├── GameHud.tsx      # Top and bottom control bars, shift counters, dynamic hints
│   ├── MenuModals.tsx   # Touch-scrollable modal dialogues for level select and settings
│   └── PhaserGame.tsx   # React-Phaser lifecycle bridge with touch-action isolation
├── game/
│   ├── art/             # Procedural woodcut graphics and canvas generators
│   │   ├── PrintArtFactory.ts       # Character poses (walk, idle, celebrate), postbox, textures
│   │   └── LevelIllustrations.ts    # Handcrafted chapter background motifs
│   ├── audio/           # Web Audio API procedural sound engine
│   │   └── SoundEngine.ts           # Woodblock clicks, paper friction, bells, rewind sweep
│   ├── levels/          # Pure data level definitions
│   │   └── levels.ts                # 9 handcrafted campaign levels + sandbox test
│   ├── scenes/          # Phaser 4 game scene
│   │   └── MisprintScene.ts         # Viewport scaling, drag handlers, snap particles, render loop
│   ├── storage/         # Progression and settings storage
│   │   ├── StorageManager.ts        # V1->V2 schema migration, fallback memory storage
│   │   └── StorageManager.test.ts   # Comprehensive storage unit tests
│   ├── systems/         # Pure TypeScript deterministic logic engines
│   │   ├── DotController.ts         # Character kinematic walking, falling, hazard collision
│   │   ├── PaperLayerSystem.ts      # Coordinate transforms, bounds clamping, hit testing
│   │   ├── RegistrationEngine.ts    # Anchor proximity, tolerance hysteresis, bridge states
│   │   ├── RewindSystem.ts          # Snapshot ring buffer, state restoration, branch pruning
│   │   └── SimulationEngine.ts      # Fixed 60Hz step function, deterministic tick loop
│   └── game.test.ts     # 20 exhaustive Vitest simulation & regression tests
├── App.tsx              # Root React component, view state machine, keybindings
└── main.tsx             # Application bootstrap
```

### Key Engineering Guarantees
1. **Deterministic Simulation:** All gameplay simulation executes in pure TypeScript functions (`stepSimulation`, `stepDot`) on a fixed 16.666ms delta time, completely independent of rendering framerates.
2. **Network Independence:** The core game runs 100% locally in the browser with zero external network or AI API dependencies.
3. **Touch-Action Isolation:** Canvas gestures are strictly bound to the game canvas (`touch-action: none`), leaving menus, settings, and browser zoom fully accessible.

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (version 1.1+ recommended) or [Node.js](https://nodejs.org/) (v20+)

### Installation
Clone the repository and install dependencies with the frozen lockfile:

```bash
git clone https://github.com/kiraak-h/Misprint.git
cd Misprint
bun install --frozen-lockfile
```

### Running Locally
Start the Vite development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Validation & Testing

Run TypeScript validation:
```bash
bun run lint
```

Run the complete Vitest automated simulation test suite:
```bash
bun run test
```

Build the production bundle:
```bash
bun run build
```

Preview the production build locally:
```bash
bun run preview
```

---

## Browser Compatibility

MISPRINT is tested and compatible with modern evergreen browsers:
- **Google Chrome / Chromium:** v110+ (Desktop & Android)
- **Apple Safari:** v16+ (macOS & iOS)
- **Mozilla Firefox:** v115+
- **Microsoft Edge:** v110+

*Note: Requires Web Audio API and HTML5 Canvas support.*

---

## License

MIT License. Designed and developed for the MISPRINT Production Release.
