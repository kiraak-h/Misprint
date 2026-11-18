import type {
  LevelDefinition,
  MovingObstacleDef,
  MovingObstacleState,
  SimulationSnapshot,
  Vec2,
} from '../types';
import { clampLayerOffset } from './PaperLayerSystem';
import { evaluateAllConnections } from './RegistrationEngine';
import { createInitialDotState, stepDot } from './DotController';

export const FIXED_TIMESTEP_MS = 1000 / 60;

export function computeMovingObstaclePos(
  def: MovingObstacleDef,
  phase: number,
): Vec2 {
  // Smooth ease-in-out ping-pong between 0 and 1
  const t = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  return {
    x: def.startLocal.x + (def.endLocal.x - def.startLocal.x) * t,
    y: def.startLocal.y + (def.endLocal.y - def.startLocal.y) * t,
  };
}

export function advanceMovingObstacles(
  defs: readonly MovingObstacleDef[],
  states: readonly MovingObstacleState[],
  dtMs: number,
): MovingObstacleState[] {
  const dtSec = dtMs / 1000;
  return states.map((state) => {
    const def = defs.find((d) => d.id === state.id);
    if (!def) return state;
    const nextPhase = (state.phase + def.speed * dtSec) % 1;
    const localPos = computeMovingObstaclePos(def, nextPhase);
    return {
      id: state.id,
      phase: nextPhase,
      direction: nextPhase < 0.5 ? 1 : -1,
      localPos,
    };
  });
}

export function createInitialSnapshot(level: LevelDefinition): SimulationSnapshot {
  const inkOffset = clampLayerOffset(level.initialInkOffset, level.inkBounds);
  const ghostOffset = clampLayerOffset(level.initialGhostOffset, level.ghostBounds);
  const connections = evaluateAllConnections(level, inkOffset, ghostOffset);
  const movingObstacles: MovingObstacleState[] = level.movingObstacles.map((def) => ({
    id: def.id,
    phase: def.initialPhase % 1,
    direction: def.initialPhase < 0.5 ? 1 : -1,
    localPos: computeMovingObstaclePos(def, def.initialPhase % 1),
  }));
  const dot = createInitialDotState(level, connections);
  const connectedCount = connections.filter((c) => c.active && !c.isHazardous).length;

  return {
    tick: 0,
    elapsedMs: 0,
    status: 'playing',
    failureReason: null,
    inkOffset,
    ghostOffset,
    dot,
    connections,
    movingObstacles,
    shiftCount: 0,
    connectedCount,
  };
}

export function shiftGhostLayer(
  level: LevelDefinition,
  snapshot: SimulationSnapshot,
  targetGhostOffset: Vec2,
  countAsShift = false,
): SimulationSnapshot {
  if (snapshot.status !== 'playing') {
    return snapshot;
  }

  const clampedGhost = clampLayerOffset(targetGhostOffset, level.ghostBounds);
  const connections = evaluateAllConnections(
    level,
    snapshot.inkOffset,
    clampedGhost,
    snapshot.connections,
  );
  const connectedCount = connections.filter((c) => c.active && !c.isHazardous).length;

  return {
    ...snapshot,
    ghostOffset: clampedGhost,
    connections,
    connectedCount,
    shiftCount: countAsShift ? snapshot.shiftCount + 1 : snapshot.shiftCount,
  };
}

export function shiftInkLayer(
  level: LevelDefinition,
  snapshot: SimulationSnapshot,
  targetInkOffset: Vec2,
  countAsShift = false,
): SimulationSnapshot {
  if (snapshot.status !== 'playing') {
    return snapshot;
  }

  const clampedInk = clampLayerOffset(targetInkOffset, level.inkBounds);
  const connections = evaluateAllConnections(
    level,
    clampedInk,
    snapshot.ghostOffset,
    snapshot.connections,
  );
  const connectedCount = connections.filter((c) => c.active && !c.isHazardous).length;

  return {
    ...snapshot,
    inkOffset: clampedInk,
    connections,
    connectedCount,
    shiftCount: countAsShift ? snapshot.shiftCount + 1 : snapshot.shiftCount,
  };
}

export function stepSimulation(
  level: LevelDefinition,
  snapshot: SimulationSnapshot,
  dtMs: number = FIXED_TIMESTEP_MS,
): SimulationSnapshot {
  if (snapshot.status !== 'playing') {
    return snapshot;
  }

  const connections = evaluateAllConnections(
    level,
    snapshot.inkOffset,
    snapshot.ghostOffset,
    snapshot.connections,
  );
  const movingObstacles = advanceMovingObstacles(
    level.movingObstacles,
    snapshot.movingObstacles,
    dtMs,
  );
  const dotStep = stepDot(
    level,
    snapshot.dot,
    connections,
    movingObstacles,
    snapshot.inkOffset,
    snapshot.ghostOffset,
    dtMs,
  );

  const nextStatus =
    dotStep.outcome === 'won'
      ? 'won'
      : dotStep.outcome === 'lost'
        ? 'lost'
        : 'playing';

  return {
    ...snapshot,
    tick: snapshot.tick + 1,
    elapsedMs: snapshot.elapsedMs + dtMs,
    status: nextStatus,
    failureReason: dotStep.failureReason,
    dot: dotStep.dot,
    connections,
    movingObstacles,
    connectedCount: connections.filter((c) => c.active && !c.isHazardous).length,
  };
}
