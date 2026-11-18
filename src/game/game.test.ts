import { describe, expect, it } from 'vitest';
import { LEVELS, REGISTRATION_TEST_LEVEL, getLevelByNumber } from './levels/levels';
import {
  clampLayerOffset,
  computeWorldLayout,
  ghostLocalToInkLocal,
  localToWorld,
  resolveDragLayerAtPoint,
  worldToLocal,
} from './systems/PaperLayerSystem';
import {
  areAnchorsCompatible,
  computeAnchorDistance,
  evaluateAllConnections,
  evaluateConnectionRule,
  findExactRegistrationOffset,
} from './systems/RegistrationEngine';
import {
  FIXED_TIMESTEP_MS,
  createInitialSnapshot,
  shiftGhostLayer,
  shiftInkLayer,
  stepSimulation,
} from './systems/SimulationEngine';
import { RewindSystem } from './systems/RewindSystem';
import { InputController } from './systems/InputSystem';
import type { RegistrationAnchor, SimulationSnapshot } from './types';

function runTicks(
  levelIndex: number,
  initial: SimulationSnapshot,
  ticks: number,
): SimulationSnapshot {
  const level = LEVELS[levelIndex]!;
  let state = initial;
  for (let i = 0; i < ticks; i++) {
    state = stepSimulation(level, state, FIXED_TIMESTEP_MS);
    if (state.status !== 'playing') break;
  }
  return state;
}

describe('MISPRINT Core Systems', () => {
  it('1. calculates registration coordinates accurately across independent layer transforms', () => {
    const world = localToWorld({ x: 100, y: 200 }, { x: 40, y: -30 });
    expect(world).toEqual({ x: 140, y: 170 });
    expect(worldToLocal(world, { x: 40, y: -30 })).toEqual({ x: 100, y: 200 });

    const inInkSpace = ghostLocalToInkLocal(
      { x: 300, y: 250 },
      { x: 10, y: 5 },
      { x: -50, y: 25 },
    );
    expect(inInkSpace).toEqual({ x: 240, y: 270 });

    const clamped = clampLayerOffset(
      { x: 999, y: -999 },
      { minX: -200, minY: -100, maxX: 200, maxY: 100 },
    );
    expect(clamped).toEqual({ x: 200, y: -100 });
  });

  it('2. validates anchor compatibility by distinct layer and matching compatibilityId', () => {
    const inkCircle: RegistrationAnchor = {
      id: 'a1',
      layer: 'ink',
      localPos: { x: 100, y: 100 },
      compatibilityId: 'circle-1',
      tolerance: 24,
      shape: 'circle',
    };
    const ghostCircle: RegistrationAnchor = {
      id: 'a2',
      layer: 'ghost',
      localPos: { x: 100, y: 100 },
      compatibilityId: 'circle-1',
      tolerance: 24,
      shape: 'circle',
    };
    const ghostSquare: RegistrationAnchor = {
      id: 'a3',
      layer: 'ghost',
      localPos: { x: 100, y: 100 },
      compatibilityId: 'square-1',
      tolerance: 24,
      shape: 'square',
    };
    const inkCircle2: RegistrationAnchor = { ...inkCircle, id: 'a4' };

    expect(areAnchorsCompatible(inkCircle, ghostCircle)).toBe(true);
    expect(areAnchorsCompatible(inkCircle, ghostSquare)).toBe(false);
    expect(areAnchorsCompatible(inkCircle, inkCircle2)).toBe(false);
  });

  it('3. activates connections when compatible anchors overlap within tolerance', () => {
    const level1 = getLevelByNumber(1);
    const rule = level1.connections[0]!;
    const distBefore = computeAnchorDistance(
      level1.anchors[0]!,
      level1.anchors[1]!,
      level1.initialInkOffset,
      level1.initialGhostOffset,
    );
    expect(distBefore).toBeGreaterThan(28);

    const inactive = evaluateConnectionRule(
      rule,
      level1.anchors,
      level1.initialInkOffset,
      level1.initialGhostOffset,
    );
    expect(inactive.active).toBe(false);

    // Move Ghost within tolerance (tolerance = 28)
    const active = evaluateConnectionRule(
      rule,
      level1.anchors,
      { x: 0, y: 0 },
      { x: 18, y: 12 },
    );
    expect(active.active).toBe(true);
    expect(active.alignedRatio).toBeGreaterThan(0);
  });

  it('4. disconnects active connections when layers move beyond tolerance', () => {
    const level1 = getLevelByNumber(1);
    let sim = createInitialSnapshot(level1);
    sim = shiftGhostLayer(level1, sim, { x: 0, y: 0 }, true);
    expect(sim.connections[0]!.active).toBe(true);
    expect(sim.connectedCount).toBe(1);

    sim = shiftGhostLayer(level1, sim, { x: 80, y: 0 }, true);
    expect(sim.connections[0]!.active).toBe(false);
    expect(sim.connectedCount).toBe(0);
  });

  it('5. moves Dot automatically along connected paths and falls if bridge disconnects', () => {
    const level1 = getLevelByNumber(1);
    let sim = createInitialSnapshot(level1);
    const startX = sim.dot.pos.x;

    // Step 30 ticks (~0.5s) -> Dot walks right
    sim = runTicks(0, sim, 30);
    expect(sim.dot.pos.x).toBeGreaterThan(startX + 25);
    expect(sim.dot.animState).toBe('walking');
    expect(sim.dot.grounded).toBe(true);

    // Align bridge and let Dot walk onto the Ghost bridge
    sim = shiftGhostLayer(level1, sim, { x: 0, y: 0 }, true);
    sim = runTicks(0, sim, 220); // ~3.67s -> should be on or past bridge
    expect(sim.dot.pos.x).toBeGreaterThan(400);

    // Now test bridge disconnect mid-crossing
    let dropSim = createInitialSnapshot(level1);
    dropSim = shiftGhostLayer(level1, dropSim, { x: 0, y: 0 }, true);
    dropSim = runTicks(0, dropSim, 210); // Dot is on the bridge around x ~ 420..480
    expect(dropSim.dot.activeSegmentId).toBe('l1-bridge');

    // Pull Ghost away while Dot is on bridge -> Dot immediately starts falling!
    dropSim = shiftGhostLayer(level1, dropSim, { x: -200, y: 0 }, true);
    dropSim = stepSimulation(level1, dropSim, FIXED_TIMESTEP_MS);
    expect(dropSim.dot.grounded).toBe(false);
    expect(dropSim.dot.animState).toBe('falling');
  });

  it('6. detects static ink spill and moving press roller collisions', () => {
    // Level 2 ink spill when bridge is not aligned
    const level2 = getLevelByNumber(2);
    const spillSim = runTicks(1, createInitialSnapshot(level2), 420);
    expect(spillSim.status).toBe('lost');
    expect(spillSim.failureReason).toBeTruthy();

    // Level 4 hazardous connection leads straight into an ink spill
    const level4 = getLevelByNumber(4);
    let trapSim = createInitialSnapshot(level4);
    trapSim = shiftGhostLayer(level4, trapSim, { x: 0, y: 0 }, true);
    expect(trapSim.connections.find((c) => c.ruleId === 'l4-conn-bad')?.active).toBe(true);
    trapSim = runTicks(3, trapSim, 420);
    expect(trapSim.status).toBe('lost');

    // Level 5 moving press roller kills Dot if lower arch is not registered
    const level5 = getLevelByNumber(5);
    let rollerSim = createInitialSnapshot(level5);
    rollerSim = shiftGhostLayer(level5, rollerSim, { x: -100, y: 0 }, true);
    rollerSim = runTicks(4, rollerSim, 540);
    expect(rollerSim.status).toBe('lost');
  });

  it('7. restores complete simulation state on rewind (layers, Dot, obstacles, connections)', () => {
    const level5 = getLevelByNumber(5);
    const rewind = new RewindSystem();
    let sim = createInitialSnapshot(level5);
    rewind.reset(sim);

    // Advance 20 ticks, then record shift boundary
    sim = runTicks(4, sim, 20);
    rewind.recordCheckpoint(sim, 'shift');
    const savedBeforeShift = {
      tick: sim.tick,
      inkOffset: { ...sim.inkOffset },
      ghostOffset: { ...sim.ghostOffset },
      dotPos: { ...sim.dot.pos },
      dotVel: { ...sim.dot.vel },
      obsPhase: sim.movingObstacles[0]!.phase,
      connActive: sim.connections[0]!.active,
    };

    // Shift both layers and advance 90 ticks
    sim = shiftInkLayer(level5, sim, { x: 0, y: 0 });
    sim = shiftGhostLayer(level5, sim, { x: -100, y: 0 }, true);
    sim = runTicks(4, sim, 90);
    expect(sim.tick).toBe(110);
    expect(sim.connections[0]!.active).toBe(true);
    expect(sim.movingObstacles[0]!.phase).not.toBe(savedBeforeShift.obsPhase);

    const restored = rewind.rewind(sim.tick);
    expect(restored).not.toBeNull();
    expect(restored!.tick).toBe(savedBeforeShift.tick);
    expect(restored!.inkOffset).toEqual(savedBeforeShift.inkOffset);
    expect(restored!.ghostOffset).toEqual(savedBeforeShift.ghostOffset);
    expect(restored!.dot.pos).toEqual(savedBeforeShift.dotPos);
    expect(restored!.dot.vel).toEqual(savedBeforeShift.dotVel);
    expect(restored!.movingObstacles[0]!.phase).toBe(savedBeforeShift.obsPhase);
    expect(restored!.connections[0]!.active).toBe(savedBeforeShift.connActive);
  });

  it('8. guarantees deterministic simulation replay for identical input sequences', () => {
    const runReplay = () => {
      const level3 = getLevelByNumber(3);
      let sim = createInitialSnapshot(level3);
      for (let t = 0; t < 360; t++) {
        if (t === 20) sim = shiftGhostLayer(level3, sim, { x: -120, y: 0 }, true);
        if (t === 210) sim = shiftGhostLayer(level3, sim, { x: 120, y: -70 }, true);
        sim = stepSimulation(level3, sim, FIXED_TIMESTEP_MS);
      }
      return sim;
    };

    const runA = runReplay();
    const runB = runReplay();
    expect(runA).toEqual(runB);
  });

  it('9. handles desktop mouse drag input and cancellation cleanly', () => {
    const input = new InputController();
    const down = input.pointerDown(1, { x: 200, y: 200 }, 'mouse');
    expect(down).toEqual({
      type: 'drag_start',
      device: 'mouse',
      pointerId: 1,
      point: { x: 200, y: 200 },
    });

    const move = input.pointerMove(1, { x: 245, y: 185 });
    expect(move).toEqual({
      type: 'drag_move',
      device: 'mouse',
      pointerId: 1,
      delta: { x: 45, y: -15 },
      point: { x: 245, y: 185 },
    });

    const cancel = input.pointerCancel(1);
    expect(cancel).toEqual({ type: 'drag_cancel', pointerId: 1 });
    expect(input.getState().isDragging).toBe(false);
    expect(input.pointerMove(1, { x: 300, y: 300 })).toBeNull();
  });

  it('10. handles mobile touch drag with multi-touch protection and touchcancel', () => {
    const input = new InputController();
    const firstTouch = input.pointerDown(101, { x: 120, y: 300 }, 'touch');
    expect(firstTouch?.type).toBe('drag_start');

    // Second finger down must be ignored while primary touch is active
    const secondTouch = input.pointerDown(102, { x: 300, y: 300 }, 'touch');
    expect(secondTouch).toBeNull();
    expect(input.pointerMove(102, { x: 350, y: 300 })).toBeNull();

    // Primary touch moves normally
    const move = input.pointerMove(101, { x: 150, y: 320 });
    expect(move).toEqual({
      type: 'drag_move',
      device: 'touch',
      pointerId: 101,
      delta: { x: 30, y: 20 },
      point: { x: 150, y: 320 },
    });

    const up = input.pointerUp(101);
    expect(up).toEqual({ type: 'drag_end', device: 'touch', pointerId: 101 });
    expect(input.getState().isDragging).toBe(false);
  });

  it('11. maintains flicker-free connection hysteresis around alignment boundaries', () => {
    const testLvl = REGISTRATION_TEST_LEVEL;
    const rule = testLvl.connections[0]!; // tolerance 28, hysteresis 4 -> active <= 28, stays active <= 32

    // At distance 30 while previously inactive -> stays inactive
    const inactiveAt30 = evaluateConnectionRule(
      rule,
      testLvl.anchors,
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      false,
    );
    expect(inactiveAt30.active).toBe(false);

    // At distance 30 while previously active -> hysteresis keeps it active
    const activeAt30 = evaluateConnectionRule(
      rule,
      testLvl.anchors,
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      true,
    );
    expect(activeAt30.active).toBe(true);

    // Beyond tolerance + hysteresis (33 > 32) -> disconnects cleanly
    const droppedAt33 = evaluateConnectionRule(
      rule,
      testLvl.anchors,
      { x: 0, y: 0 },
      { x: 33, y: 0 },
      true,
    );
    expect(droppedAt33.active).toBe(false);
  });

  it('12. supports independent Ink & Ghost hit-testing, incompatible decoy anchors, and solves Registration Test', () => {
    const testLvl = getLevelByNumber(0);
    expect(testLvl.id).toBe('level-test');

    // Hit-test selects Ghost inside Ghost sheet, and Ink in outer Ink margin
    expect(
      resolveDragLayerAtPoint(
        { x: 480, y: 270 },
        testLvl,
        testLvl.initialInkOffset,
        testLvl.initialGhostOffset,
      ),
    ).toBe('ghost');
    expect(
      resolveDragLayerAtPoint(
        { x: 75, y: 270 },
        testLvl,
        testLvl.initialInkOffset,
        testLvl.initialGhostOffset,
      ),
    ).toBe('ink');

    // Incompatible decoy diamond anchors never connect even at exact distance 0
    const inkDecoy = testLvl.anchors.find((a) => a.id === 't-ink-decoy')!;
    const ghostDecoy = testLvl.anchors.find((a) => a.id === 't-ghost-decoy')!;
    expect(areAnchorsCompatible(inkDecoy, ghostDecoy)).toBe(false);
    const zeroOverlap = evaluateAllConnections(testLvl, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(zeroOverlap.find((c) => c.ruleId === 't-conn-a')?.active).toBe(true);
    expect(zeroOverlap.find((c) => c.ruleId === 't-conn-b')?.active).toBe(false);

    // Solve Registration Test by shifting BOTH Ink and Ghost sheets
    let sim = createInitialSnapshot(testLvl);
    sim = shiftInkLayer(testLvl, sim, { x: 0, y: 0 }, true);
    sim = shiftGhostLayer(testLvl, sim, { x: 0, y: 0 }, true);
    expect(sim.connections.find((c) => c.ruleId === 't-conn-a')?.active).toBe(true);

    for (let t = 0; t < 900; t++) {
      sim = stepSimulation(testLvl, sim, FIXED_TIMESTEP_MS);
      if (sim.dot.pos.x > 500 && !sim.connections.find((c) => c.ruleId === 't-conn-b')?.active) {
        sim = shiftGhostLayer(testLvl, sim, { x: 120, y: 60 }, true);
      }
      if (sim.status !== 'playing') break;
    }
    expect(sim.status).toBe('won');
  });

  it('13. flips patrol direction reliably on exact-multiple curb pauses and tracks early rewind availability', () => {
    const level3 = getLevelByNumber(3);
    let sim = createInitialSnapshot(level3);
    const rewind = new RewindSystem();
    rewind.reset(sim);

    // Step with dt=16ms (exact divisor of IDLE_TURN_PAUSE_MS=320) until Dot hits stopRight at x=260, pauses, and turns left
    let sawFacingLeft = false;
    for (let i = 0; i < 200; i++) {
      sim = stepSimulation(level3, sim, 16);
      if (sim.dot.patrolDirection === -1) {
        sawFacingLeft = true;
        break;
      }
    }
    expect(sawFacingLeft).toBe(true);
    expect(rewind.getAvailableCount(0)).toBe(0);
    expect(rewind.getAvailableCount(sim.tick)).toBe(1);
    const backToStart = rewind.rewind(sim.tick);
    expect(backToStart?.tick).toBe(0);
  });

  it('solves all 5 handcrafted levels deterministically from start to goal', () => {
    // Level 1
    {
      const lvl = getLevelByNumber(1);
      let sim = createInitialSnapshot(lvl);
      sim = shiftGhostLayer(lvl, sim, { x: 0, y: 0 }, true);
      sim = runTicks(0, sim, 600);
      expect(sim.status).toBe('won');
    }

    // Level 2
    {
      const lvl = getLevelByNumber(2);
      let sim = createInitialSnapshot(lvl);
      sim = shiftGhostLayer(lvl, sim, { x: 0, y: 0 }, true);
      sim = runTicks(1, sim, 700);
      expect(sim.status).toBe('won');
    }

    // Level 3: Align Mark A -> wait for Dot to cross onto middle terrace -> Align Mark B
    {
      const lvl = getLevelByNumber(3);
      let sim = createInitialSnapshot(lvl);
      sim = shiftGhostLayer(lvl, sim, { x: -120, y: 0 }, true);
      for (let t = 0; t < 900; t++) {
        sim = stepSimulation(lvl, sim, FIXED_TIMESTEP_MS);
        if (sim.dot.pos.x > 440 && sim.connections[1]!.active === false) {
          sim = shiftGhostLayer(lvl, sim, { x: 120, y: -70 }, true);
        }
        if (sim.status !== 'playing') break;
      }
      expect(sim.status).toBe('won');
    }

    // Level 4: Align safe diamond mark (-70, -100)
    {
      const lvl = getLevelByNumber(4);
      let sim = createInitialSnapshot(lvl);
      sim = shiftGhostLayer(lvl, sim, { x: -70, y: -100 }, true);
      sim = runTicks(3, sim, 700);
      expect(sim.status).toBe('won');
    }

    // Level 5: Align temporary Circle (-100, 0) -> Dot crosses onto upper-right -> break & align Square (+110, +80)
    {
      const lvl = getLevelByNumber(5);
      let sim = createInitialSnapshot(lvl);
      sim = shiftGhostLayer(lvl, sim, { x: -100, y: 0 }, true);
      for (let t = 0; t < 1000; t++) {
        sim = stepSimulation(lvl, sim, FIXED_TIMESTEP_MS);
        if (sim.dot.pos.x > 460 && !sim.connections[1]!.active) {
          sim = shiftGhostLayer(lvl, sim, { x: 110, y: 80 }, true);
        }
        if (sim.status !== 'playing') break;
      }
      expect(sim.status).toBe('won');
    }
  });

  it('14. computes safe responsive world layouts across portrait mobile, landscape mobile, and desktop', () => {
    const worldW = 960;
    const worldH = 540;

    // Portrait mobile gameplay (390x844)
    const portraitPlay = computeWorldLayout(390, 844, worldW, worldH, true);
    expect(portraitPlay.scale).toBeGreaterThan(0.3);
    expect(portraitPlay.offsetY).toBeGreaterThanOrEqual(portraitPlay.topSafe);
    expect(portraitPlay.offsetY + worldH * portraitPlay.scale).toBeLessThanOrEqual(
      844 - portraitPlay.bottomSafe + 0.01,
    );
    expect(portraitPlay.offsetX).toBeGreaterThanOrEqual(portraitPlay.leftSafe);

    // Portrait mobile title (390x844): world sheet sits above bottom-docked title card
    const portraitTitle = computeWorldLayout(390, 844, worldW, worldH, false);
    expect(portraitTitle.offsetY + worldH * portraitTitle.scale).toBeLessThanOrEqual(
      844 - portraitTitle.bottomSafe + 0.01,
    );

    // Compact landscape mobile gameplay (844x390)
    const landscapePlay = computeWorldLayout(844, 390, worldW, worldH, true);
    expect(landscapePlay.scale).toBeGreaterThan(0.45);
    expect(landscapePlay.offsetY).toBeGreaterThanOrEqual(landscapePlay.topSafe);
    expect(landscapePlay.offsetY + worldH * landscapePlay.scale).toBeLessThanOrEqual(
      390 - landscapePlay.bottomSafe + 0.01,
    );

    // Desktop gameplay (1440x900)
    const desktopPlay = computeWorldLayout(1440, 900, worldW, worldH, true);
    expect(desktopPlay.scale).toBeGreaterThan(1.0);
    expect(desktopPlay.offsetY).toBeGreaterThanOrEqual(desktopPlay.topSafe);
  });

  it('15. clamps sudden mobile touch jumps and grants touch hit-test border margin', () => {
    const input = new InputController(160);
    input.pointerDown(7, { x: 100, y: 100 }, 'touch');

    // Huge single-event spike (e.g., palm/browser jump) gets clamped to [-160, 160]
    const jumpMove = input.pointerMove(7, { x: 800, y: -400 });
    expect(jumpMove?.type).toBe('drag_move');
    if (jumpMove?.type === 'drag_move') {
      expect(jumpMove.delta).toEqual({ x: 160, y: -160 });
    }

    // Touch cancel without pointerId cancels any active pointer cleanly
    const cancelAll = input.pointerCancel(null);
    expect(cancelAll).toEqual({ type: 'drag_cancel', pointerId: 7 });
    expect(input.getState().isDragging).toBe(false);

    // Touch margin catches points just outside the Ghost vellum border on Sandbox 00
    const testLvl = getLevelByNumber(0);
    const justOutsideGhost = { x: 190, y: 200 }; // Ghost minX is 200 at offset 0
    expect(
      resolveDragLayerAtPoint(justOutsideGhost, testLvl, { x: 0, y: 0 }, { x: 0, y: 0 }, false, 0),
    ).toBe('ink');
    expect(
      resolveDragLayerAtPoint(justOutsideGhost, testLvl, { x: 0, y: 0 }, { x: 0, y: 0 }, false, 16),
    ).toBe('ghost');
  });

  it('16. validates structural integrity, bounds, and reachability across every level', () => {
    const allLevels = [REGISTRATION_TEST_LEVEL, ...LEVELS];
    for (const lvl of allLevels) {
      // Initial layer offsets must sit cleanly inside declared bounds
      expect(lvl.initialInkOffset.x).toBeGreaterThanOrEqual(lvl.inkBounds.minX);
      expect(lvl.initialInkOffset.x).toBeLessThanOrEqual(lvl.inkBounds.maxX);
      expect(lvl.initialInkOffset.y).toBeGreaterThanOrEqual(lvl.inkBounds.minY);
      expect(lvl.initialInkOffset.y).toBeLessThanOrEqual(lvl.inkBounds.maxY);
      expect(lvl.initialGhostOffset.x).toBeGreaterThanOrEqual(lvl.ghostBounds.minX);
      expect(lvl.initialGhostOffset.x).toBeLessThanOrEqual(lvl.ghostBounds.maxX);
      expect(lvl.initialGhostOffset.y).toBeGreaterThanOrEqual(lvl.ghostBounds.minY);
      expect(lvl.initialGhostOffset.y).toBeLessThanOrEqual(lvl.ghostBounds.maxY);

      // Dot starts grounded on an active Ink slab with zero initial connection lock
      const initSim = createInitialSnapshot(lvl);
      expect(initSim.dot.grounded).toBe(true);
      expect(initSim.status).toBe('playing');

      // Every connection rule references valid compatible anchors within ghost bounds
      for (const rule of lvl.connections) {
        const inkA = lvl.anchors.find((a) => a.id === rule.inkAnchorId);
        const ghostA = lvl.anchors.find((a) => a.id === rule.ghostAnchorId);
        expect(inkA).toBeDefined();
        expect(ghostA).toBeDefined();
        expect(areAnchorsCompatible(inkA!, ghostA!)).toBe(true);

        const exactGhost = findExactRegistrationOffset(inkA!, ghostA!, { x: 0, y: 0 });
        expect(exactGhost.x).toBeGreaterThanOrEqual(lvl.ghostBounds.minX);
        expect(exactGhost.x).toBeLessThanOrEqual(lvl.ghostBounds.maxX);
        expect(exactGhost.y).toBeGreaterThanOrEqual(lvl.ghostBounds.minY);
        expect(exactGhost.y).toBeLessThanOrEqual(lvl.ghostBounds.maxY);

        for (const segId of rule.bridgeSegmentIds) {
          const seg = lvl.segments.find((s) => s.id === segId);
          expect(seg).toBeDefined();
          expect(seg!.requiredConnectionId).toBe(rule.id);
        }
      }
    }
  });

  it('17. remains solvable when bridges are registered off-center near tolerance edges', () => {
    // Level 1 at +22px X, -12px Y (within 28px tolerance)
    {
      const lvl = getLevelByNumber(1);
      let sim = createInitialSnapshot(lvl);
      sim = shiftGhostLayer(lvl, sim, { x: 22, y: -12 }, true);
      expect(sim.connections[0]!.active).toBe(true);
      sim = runTicks(0, sim, 700);
      expect(sim.status).toBe('won');
    }

    // Level 4 safe Diamond at -20px X, +12px Y off-center (within 26px tolerance)
    {
      const lvl = getLevelByNumber(4);
      let sim = createInitialSnapshot(lvl);
      sim = shiftGhostLayer(lvl, sim, { x: -90, y: -88 }, true);
      expect(sim.connections.find((c) => c.ruleId === 'l4-conn-good')?.active).toBe(true);
      sim = runTicks(3, sim, 800);
      expect(sim.status).toBe('won');
    }

    // Level 5 Square 2 at leftmost edge (-24px X off +110 -> +86, +80) within 28px tolerance
    {
      const lvl = getLevelByNumber(5);
      let sim = createInitialSnapshot(lvl);
      sim = shiftGhostLayer(lvl, sim, { x: -100, y: 0 }, true);
      for (let t = 0; t < 1100; t++) {
        sim = stepSimulation(lvl, sim, FIXED_TIMESTEP_MS);
        if (sim.dot.pos.x > 460 && !sim.connections[1]!.active) {
          sim = shiftGhostLayer(lvl, sim, { x: 86, y: 80 }, true);
        }
        if (sim.status !== 'playing') break;
      }
      expect(sim.status).toBe('won');
    }
  });

  it('18. guarantees clean timeline truncation on root rewind and exact replay parity after multiple rewinds', () => {
    const level3 = getLevelByNumber(3);
    const rewind = new RewindSystem(300);
    let sim = createInitialSnapshot(level3);
    rewind.reset(sim);

    // Advance 65 ticks with periodic checkpoints, then rewind back to root tick 0
    for (let t = 0; t < 65; t++) {
      sim = stepSimulation(level3, sim, FIXED_TIMESTEP_MS);
      if (sim.tick % 30 === 0) rewind.recordCheckpoint(sim, 'periodic');
    }
    const backToRoot = rewind.rewind(sim.tick);
    expect(backToRoot?.tick).toBe(0);

    // Replaying forward after root rewind must stay clean (only new tick-30 checkpoint exists)
    sim = backToRoot!;
    for (let t = 0; t < 40; t++) {
      sim = stepSimulation(level3, sim, FIXED_TIMESTEP_MS);
      if (sim.tick % 30 === 0) rewind.recordCheckpoint(sim, 'periodic');
    }
    expect(rewind.getAvailableCount(sim.tick)).toBe(1);

    // Now test same-tick consecutive shift preservation and full replay parity
    sim = shiftGhostLayer(level3, sim, { x: -120, y: 0 }, true);
    rewind.recordCheckpoint(sim, 'shift');
    const firstBranchMid = runTicks(2, sim, 120);

    // Second shift at tick 160, advance 100 ticks, then rewind back to shift boundary and replay
    rewind.recordCheckpoint(firstBranchMid, 'shift');
    const secondShiftSim = shiftGhostLayer(level3, firstBranchMid, { x: 120, y: -70 }, true);
    const afterSecond = runTicks(2, secondShiftSim, 100);

    const restored = rewind.rewind(afterSecond.tick);
    expect(restored).toEqual(firstBranchMid);
    const replayedSecond = runTicks(
      2,
      shiftGhostLayer(level3, restored!, { x: 120, y: -70 }, true),
      100,
    );
    expect(replayedSecond).toEqual(afterSecond);
  });
});
