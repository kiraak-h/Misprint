import type {
  ConnectionState,
  DotState,
  LevelDefinition,
  MovingObstacleState,
  PathSegment,
  Vec2,
} from '../types';
import { layerLocalToInkLocal } from './PaperLayerSystem';
import { isSegmentWalkable } from './RegistrationEngine';

export const DOT_WALK_SPEED = 90; // px / s
export const DOT_ACCEL = 540; // px / s^2
export const DOT_GRAVITY = 880; // px / s^2
export const DOT_MAX_FALL_SPEED = 540; // px / s
export const DOT_BODY_HALF_HEIGHT = 15;
export const DOT_BODY_RADIUS = 12;
export const GOAL_RADIUS = 28;
export const SEAM_X_TOLERANCE = 36;
export const SEAM_Y_TOLERANCE = 32;
export const IDLE_TURN_PAUSE_MS = 320;

export interface InkSpaceSegment {
  readonly id: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly isBridge: boolean;
  readonly stopLeft: boolean;
  readonly stopRight: boolean;
}

export function buildActiveInkSegments(
  level: LevelDefinition,
  connections: readonly ConnectionState[],
  inkOffset: Vec2,
  ghostOffset: Vec2,
): InkSpaceSegment[] {
  const result: InkSpaceSegment[] = [];

  for (const seg of level.segments) {
    if (!isSegmentWalkable(seg, connections)) {
      continue;
    }
    const pA = layerLocalToInkLocal(seg.a, seg.layer, inkOffset, ghostOffset);
    const pB = layerLocalToInkLocal(seg.b, seg.layer, inkOffset, ghostOffset);
    const leftFirst = pA.x <= pB.x;

    result.push({
      id: seg.id,
      x1: leftFirst ? pA.x : pB.x,
      y1: leftFirst ? pA.y : pB.y,
      x2: leftFirst ? pB.x : pA.x,
      y2: leftFirst ? pB.y : pA.y,
      isBridge: Boolean(seg.isBridge),
      stopLeft: Boolean(seg.stopLeft),
      stopRight: Boolean(seg.stopRight),
    });
  }

  return result;
}

export function getSegmentSurfaceY(seg: InkSpaceSegment, x: number): number {
  const dx = seg.x2 - seg.x1;
  if (Math.abs(dx) < 0.001) {
    return (seg.y1 + seg.y2) * 0.5;
  }
  const t = Math.max(0, Math.min(1, (x - seg.x1) / dx));
  return seg.y1 + (seg.y2 - seg.y1) * t;
}

function findConnectingSegment(
  segments: readonly InkSpaceSegment[],
  currentSeg: InkSpaceSegment,
  exitSide: 'left' | 'right',
): InkSpaceSegment | null {
  const exitX = exitSide === 'right' ? currentSeg.x2 : currentSeg.x1;
  const exitY = exitSide === 'right' ? currentSeg.y2 : currentSeg.y1;

  let best: InkSpaceSegment | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of segments) {
    if (candidate.id === currentSeg.id) continue;

    // Check entry on opposite side or overlapping range
    const entryX = exitSide === 'right' ? candidate.x1 : candidate.x2;
    const entryY = exitSide === 'right' ? candidate.y1 : candidate.y2;

    const dx = Math.abs(entryX - exitX);
    const dy = Math.abs(entryY - exitY);

    if (dx <= SEAM_X_TOLERANCE && dy <= SEAM_Y_TOLERANCE) {
      const score = dx + dy * 1.25;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
      continue;
    }

    // Also allow stepping directly onto a segment whose horizontal span contains exitX
    if (exitX >= candidate.x1 - 8 && exitX <= candidate.x2 + 8) {
      const surfY = getSegmentSurfaceY(candidate, exitX);
      const yDiff = Math.abs(surfY - exitY);
      if (yDiff <= SEAM_Y_TOLERANCE) {
        const score = yDiff * 1.1;
        if (score < bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
    }
  }

  return best;
}

function findLandingSegment(
  segments: readonly InkSpaceSegment[],
  x: number,
  prevY: number,
  nextY: number,
): { segment: InkSpaceSegment; surfaceY: number } | null {
  let best: { segment: InkSpaceSegment; surfaceY: number } | null = null;

  for (const seg of segments) {
    if (x < seg.x1 - 6 || x > seg.x2 + 6) continue;
    const surfY = getSegmentSurfaceY(seg, x);
    if (prevY <= surfY + 10 && nextY >= surfY - 2) {
      if (!best || surfY < best.surfaceY) {
        best = { segment: seg, surfaceY: surfY };
      }
    }
  }

  return best;
}

function dampValue(current: number, target: number, rate: number, dtSec: number): number {
  return current + (target - current) * Math.min(1, rate * dtSec);
}

export interface DotStepResult {
  readonly dot: DotState;
  readonly outcome: 'none' | 'won' | 'lost';
  readonly failureReason: string | null;
}

export function createInitialDotState(
  level: LevelDefinition,
  initialConnections: readonly ConnectionState[] = [],
): DotState {
  const initialSegments = buildActiveInkSegments(
    level,
    initialConnections,
    level.initialInkOffset,
    level.initialGhostOffset,
  );
  const startSeg = initialSegments.find(
    (s) =>
      level.dotStart.x >= s.x1 - 4 &&
      level.dotStart.x <= s.x2 + 4 &&
      Math.abs(getSegmentSurfaceY(s, level.dotStart.x) - level.dotStart.y) <= 16,
  );

  return {
    pos: {
      x: level.dotStart.x,
      y: startSeg ? getSegmentSurfaceY(startSeg, level.dotStart.x) : level.dotStart.y,
    },
    vel: { x: 0, y: 0 },
    facing: 1,
    animState: startSeg ? 'walking' : 'falling',
    grounded: Boolean(startSeg),
    walkDistance: 0,
    squashX: 1,
    squashY: 1,
    activeSegmentId: startSeg?.id ?? null,
    stateTimerMs: 0,
    idlePauseMs: 0,
    patrolDirection: 1,
  };
}

export function stepDot(
  level: LevelDefinition,
  dot: DotState,
  connections: readonly ConnectionState[],
  movingObstacles: readonly MovingObstacleState[],
  inkOffset: Vec2,
  ghostOffset: Vec2,
  dtMs: number,
): DotStepResult {
  const dtSec = dtMs / 1000;
  const activeSegments = buildActiveInkSegments(level, connections, inkOffset, ghostOffset);

  let nextX = dot.pos.x;
  let nextY = dot.pos.y;
  let nextVx = dot.vel.x;
  let nextVy = dot.vel.y;
  let facing = dot.facing;
  let patrolDirection = dot.patrolDirection;
  let grounded = dot.grounded;
  let animState = dot.animState;
  let activeSegmentId = dot.activeSegmentId;
  let walkDistance = dot.walkDistance;
  let squashX = dampValue(dot.squashX, 1, 14, dtSec);
  let squashY = dampValue(dot.squashY, 1, 14, dtSec);
  let stateTimerMs = Math.max(0, dot.stateTimerMs - dtMs);
  let idlePauseMs = dot.idlePauseMs;

  // If grounded, confirm supporting segment still exists and covers Dot horizontally
  let currentSeg = activeSegmentId
    ? activeSegments.find((s) => s.id === activeSegmentId) ?? null
    : null;

  if (grounded && currentSeg && (nextX < currentSeg.x1 - 10 || nextX > currentSeg.x2 + 10)) {
    const fallbackLanding = findLandingSegment(activeSegments, nextX, nextY - 4, nextY + 6);
    if (fallbackLanding) {
      currentSeg = fallbackLanding.segment;
      activeSegmentId = fallbackLanding.segment.id;
      nextY = fallbackLanding.surfaceY;
    } else {
      currentSeg = null;
    }
  }

  if (grounded && !currentSeg) {
    // Support vanished underneath Dot (e.g., Ghost bridge disconnected or shifted away)
    grounded = false;
    activeSegmentId = null;
    animState = 'falling';
    nextVy = Math.max(nextVy, 12);
    idlePauseMs = 0;
  }

  if (grounded && currentSeg) {
    if (idlePauseMs > 0) {
      // Pausing briefly before turning at a curb
      idlePauseMs = Math.max(0, idlePauseMs - dtMs);
      nextVx = dampValue(nextVx, 0, 18, dtSec);
      nextX += nextVx * dtSec;
      nextX = Math.max(currentSeg.x1, Math.min(currentSeg.x2, nextX));
      nextY = getSegmentSurfaceY(currentSeg, nextX);
      animState = stateTimerMs > 0 ? 'landing' : 'idle';

      if (idlePauseMs === 0) {
        patrolDirection = (patrolDirection === 1 ? -1 : 1) as 1 | -1;
        facing = patrolDirection;
      }
    } else {
      const targetVx = patrolDirection * DOT_WALK_SPEED;
      const dv = targetVx - nextVx;
      const maxStep = DOT_ACCEL * dtSec;
      if (Math.abs(dv) <= maxStep) {
        nextVx = targetVx;
      } else {
        nextVx += Math.sign(dv) * maxStep;
      }

      const prevX = nextX;
      nextX += nextVx * dtSec;
      walkDistance += Math.abs(nextX - prevX);
      facing = patrolDirection;

      // Check segment boundary transitions
      if (patrolDirection === 1 && nextX >= currentSeg.x2) {
        const nextSeg = findConnectingSegment(activeSegments, currentSeg, 'right');
        if (nextSeg) {
          activeSegmentId = nextSeg.id;
          currentSeg = nextSeg;
          nextX = Math.max(nextX, nextSeg.x1);
          nextY = getSegmentSurfaceY(nextSeg, nextX);
          animState = 'walking';
        } else if (currentSeg.stopRight) {
          nextX = currentSeg.x2;
          nextVx = 0;
          nextY = getSegmentSurfaceY(currentSeg, nextX);
          idlePauseMs = IDLE_TURN_PAUSE_MS;
          animState = 'idle';
        } else {
          // Step off open edge and fall
          grounded = false;
          activeSegmentId = null;
          nextVy = 18;
          animState = 'falling';
          squashX = 0.88;
          squashY = 1.14;
        }
      } else if (patrolDirection === -1 && nextX <= currentSeg.x1) {
        const nextSeg = findConnectingSegment(activeSegments, currentSeg, 'left');
        if (nextSeg) {
          activeSegmentId = nextSeg.id;
          currentSeg = nextSeg;
          nextX = Math.min(nextX, nextSeg.x2);
          nextY = getSegmentSurfaceY(nextSeg, nextX);
          animState = 'walking';
        } else if (currentSeg.stopLeft) {
          nextX = currentSeg.x1;
          nextVx = 0;
          nextY = getSegmentSurfaceY(currentSeg, nextX);
          idlePauseMs = IDLE_TURN_PAUSE_MS;
          animState = 'idle';
        } else {
          grounded = false;
          activeSegmentId = null;
          nextVy = 18;
          animState = 'falling';
          squashX = 0.88;
          squashY = 1.14;
        }
      } else {
        nextY = getSegmentSurfaceY(currentSeg, nextX);
        animState = stateTimerMs > 0 ? 'landing' : 'walking';
      }
    }
  } else {
    // Airborne / falling
    nextVx = dampValue(nextVx, patrolDirection * (DOT_WALK_SPEED * 0.45), 3.5, dtSec);
    nextVy = Math.min(DOT_MAX_FALL_SPEED, nextVy + DOT_GRAVITY * dtSec);
    const prevY = nextY;
    nextX += nextVx * dtSec;
    nextY += nextVy * dtSec;

    const landing = findLandingSegment(activeSegments, nextX, prevY, nextY);
    if (landing && nextVy >= 0) {
      grounded = true;
      activeSegmentId = landing.segment.id;
      nextY = landing.surfaceY;
      nextVy = 0;
      squashX = 1.24;
      squashY = 0.78;
      stateTimerMs = 150;
      animState = 'landing';
    } else {
      animState = 'falling';
    }
  }

  const nextDot: DotState = {
    pos: { x: nextX, y: nextY },
    vel: { x: nextVx, y: nextVy },
    facing,
    animState,
    grounded,
    walkDistance,
    squashX,
    squashY,
    activeSegmentId,
    stateTimerMs,
    idlePauseMs,
    patrolDirection,
  };

  // Collision checks using Dot's torso center
  const dotCenterX = nextX;
  const dotCenterY = nextY - DOT_BODY_HALF_HEIGHT;

  // 1. Out-of-bounds fall check
  if (nextY > level.worldHeight + 48) {
    return {
      dot: { ...nextDot, animState: 'hazard' },
      outcome: 'lost',
      failureReason: 'Dot slipped past the edge of the sheet.',
    };
  }

  // 2. Static hazards
  for (const hazard of level.hazards) {
    if (hazard.requiredConnectionId) {
      const conn = connections.find((c) => c.ruleId === hazard.requiredConnectionId);
      if (!conn?.active) continue;
    }
    const hInk = layerLocalToInkLocal(hazard.localPos, hazard.layer, inkOffset, ghostOffset);
    const dist = Math.hypot(dotCenterX - hInk.x, dotCenterY - hInk.y);
    if (dist <= hazard.radius + DOT_BODY_RADIUS) {
      const reason =
        hazard.kind === 'ink_spill'
          ? 'Dot stepped into a wet ink spill.'
          : 'Dot fell into an unaligned misprint gap.';
      return {
        dot: { ...nextDot, animState: 'hazard', vel: { x: 0, y: 0 } },
        outcome: 'lost',
        failureReason: reason,
      };
    }
  }

  // 3. Moving obstacles (Press Rollers)
  for (const obsState of movingObstacles) {
    const obsDef = level.movingObstacles.find((o) => o.id === obsState.id);
    if (!obsDef) continue;
    const oInk = layerLocalToInkLocal(obsState.localPos, obsDef.layer, inkOffset, ghostOffset);
    const dist = Math.hypot(dotCenterX - oInk.x, dotCenterY - oInk.y);
    if (dist <= obsDef.radius + DOT_BODY_RADIUS) {
      return {
        dot: { ...nextDot, animState: 'hazard', vel: { x: 0, y: 0 } },
        outcome: 'lost',
        failureReason: 'Dot collided with a moving press roller.',
      };
    }
  }

  // 4. Goal Postbox check
  const goalDist = Math.hypot(dotCenterX - level.goalPos.x, dotCenterY - (level.goalPos.y - 16));
  if (goalDist <= GOAL_RADIUS) {
    return {
      dot: {
        ...nextDot,
        animState: 'celebrating',
        vel: { x: 0, y: 0 },
        squashX: 1.12,
        squashY: 0.9,
      },
      outcome: 'won',
      failureReason: null,
    };
  }

  return {
    dot: nextDot,
    outcome: 'none',
    failureReason: null,
  };
}
