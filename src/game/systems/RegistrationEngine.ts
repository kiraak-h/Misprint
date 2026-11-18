import type {
  ConnectionRule,
  ConnectionState,
  LevelDefinition,
  PathSegment,
  RegistrationAnchor,
  Vec2,
} from '../types';
import { localToWorld } from './PaperLayerSystem';

export const DEFAULT_CONNECTION_HYSTERESIS_PX = 3;

export function areAnchorsCompatible(
  anchorA: RegistrationAnchor,
  anchorB: RegistrationAnchor,
): boolean {
  if (anchorA.layer === anchorB.layer) {
    return false;
  }
  return anchorA.compatibilityId === anchorB.compatibilityId;
}

export function computeAnchorWorldPosition(
  anchor: RegistrationAnchor,
  inkOffset: Vec2,
  ghostOffset: Vec2,
): Vec2 {
  const layerOffset = anchor.layer === 'ink' ? inkOffset : ghostOffset;
  return localToWorld(anchor.localPos, layerOffset);
}

export function computeAnchorDistance(
  inkAnchor: RegistrationAnchor,
  ghostAnchor: RegistrationAnchor,
  inkOffset: Vec2,
  ghostOffset: Vec2,
): number {
  const inkWorld = computeAnchorWorldPosition(inkAnchor, inkOffset, ghostOffset);
  const ghostWorld = computeAnchorWorldPosition(ghostAnchor, inkOffset, ghostOffset);
  const dx = inkWorld.x - ghostWorld.x;
  const dy = inkWorld.y - ghostWorld.y;
  return Math.hypot(dx, dy);
}

export function evaluateConnectionRule(
  rule: ConnectionRule,
  anchors: readonly RegistrationAnchor[],
  inkOffset: Vec2,
  ghostOffset: Vec2,
  previouslyActive = false,
): ConnectionState {
  const inkAnchor = anchors.find((a) => a.id === rule.inkAnchorId);
  const ghostAnchor = anchors.find((a) => a.id === rule.ghostAnchorId);

  if (!inkAnchor || !ghostAnchor) {
    return {
      ruleId: rule.id,
      inkAnchorId: rule.inkAnchorId,
      ghostAnchorId: rule.ghostAnchorId,
      compatibilityId: '',
      distance: Number.POSITIVE_INFINITY,
      tolerance: 0,
      active: false,
      alignedRatio: 0,
      isHazardous: Boolean(rule.isHazardous),
    };
  }

  const compatible = areAnchorsCompatible(inkAnchor, ghostAnchor);
  const tolerance = Math.min(inkAnchor.tolerance, ghostAnchor.tolerance);
  const hysteresis = rule.hysteresis ?? DEFAULT_CONNECTION_HYSTERESIS_PX;
  const distance = computeAnchorDistance(inkAnchor, ghostAnchor, inkOffset, ghostOffset);

  const effectiveThreshold = previouslyActive ? tolerance + hysteresis : tolerance;
  const active = compatible && distance <= effectiveThreshold;
  const alignedRatio =
    tolerance > 0 ? Math.max(0, Math.min(1, 1 - distance / tolerance)) : 0;

  return {
    ruleId: rule.id,
    inkAnchorId: inkAnchor.id,
    ghostAnchorId: ghostAnchor.id,
    compatibilityId: inkAnchor.compatibilityId,
    distance,
    tolerance,
    active,
    alignedRatio,
    isHazardous: Boolean(rule.isHazardous),
  };
}

export function evaluateAllConnections(
  level: LevelDefinition,
  inkOffset: Vec2,
  ghostOffset: Vec2,
  previousConnections: readonly ConnectionState[] = [],
): ConnectionState[] {
  return level.connections.map((rule) => {
    const prev = previousConnections.find((c) => c.ruleId === rule.id);
    return evaluateConnectionRule(
      rule,
      level.anchors,
      inkOffset,
      ghostOffset,
      Boolean(prev?.active),
    );
  });
}

export interface AnchorDebugPair {
  readonly ruleId: string;
  readonly inkWorld: Vec2;
  readonly ghostWorld: Vec2;
  readonly distance: number;
  readonly tolerance: number;
  readonly active: boolean;
  readonly isHazardous: boolean;
  readonly compatibilityId: string;
}

export function getConnectionDebugPairs(
  level: LevelDefinition,
  connections: readonly ConnectionState[],
  inkOffset: Vec2,
  ghostOffset: Vec2,
): AnchorDebugPair[] {
  const pairs: AnchorDebugPair[] = [];
  for (const conn of connections) {
    const inkAnchor = level.anchors.find((a) => a.id === conn.inkAnchorId);
    const ghostAnchor = level.anchors.find((a) => a.id === conn.ghostAnchorId);
    if (!inkAnchor || !ghostAnchor) continue;
    pairs.push({
      ruleId: conn.ruleId,
      inkWorld: computeAnchorWorldPosition(inkAnchor, inkOffset, ghostOffset),
      ghostWorld: computeAnchorWorldPosition(ghostAnchor, inkOffset, ghostOffset),
      distance: conn.distance,
      tolerance: conn.tolerance,
      active: conn.active,
      isHazardous: conn.isHazardous,
      compatibilityId: conn.compatibilityId,
    });
  }
  return pairs;
}

export function isSegmentWalkable(
  segment: PathSegment,
  connections: readonly ConnectionState[],
): boolean {
  if (!segment.walkable) {
    return false;
  }
  if (!segment.requiredConnectionId) {
    return true;
  }
  const conn = connections.find((c) => c.ruleId === segment.requiredConnectionId);
  return Boolean(conn?.active);
}

export function findExactRegistrationOffset(
  inkAnchor: RegistrationAnchor,
  ghostAnchor: RegistrationAnchor,
  inkOffset: Vec2,
): Vec2 {
  return {
    x: inkAnchor.localPos.x + inkOffset.x - ghostAnchor.localPos.x,
    y: inkAnchor.localPos.y + inkOffset.y - ghostAnchor.localPos.y,
  };
}

export function findNearestSnapOffset(
  level: LevelDefinition,
  inkOffset: Vec2,
  ghostOffset: Vec2,
  snapThreshold = 12,
): Vec2 | null {
  let bestDist = snapThreshold;
  let bestOffset: Vec2 | null = null;

  for (const rule of level.connections) {
    if (rule.isHazardous) continue;
    const inkAnchor = level.anchors.find((a) => a.id === rule.inkAnchorId);
    const ghostAnchor = level.anchors.find((a) => a.id === rule.ghostAnchorId);
    if (!inkAnchor || !ghostAnchor || !areAnchorsCompatible(inkAnchor, ghostAnchor)) {
      continue;
    }
    const dist = computeAnchorDistance(inkAnchor, ghostAnchor, inkOffset, ghostOffset);
    if (dist <= bestDist) {
      bestDist = dist;
      bestOffset = findExactRegistrationOffset(inkAnchor, ghostAnchor, inkOffset);
    }
  }

  return bestOffset;
}
