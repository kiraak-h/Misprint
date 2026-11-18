export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface RectBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export type PaperLayerId = 'ink' | 'ghost';

export type AnchorShape = 'circle' | 'diamond' | 'square' | 'cross';

export interface RegistrationAnchor {
  readonly id: string;
  readonly layer: PaperLayerId;
  readonly localPos: Vec2;
  readonly compatibilityId: string;
  readonly tolerance: number;
  readonly shape: AnchorShape;
  readonly label?: string;
}

export interface ConnectionRule {
  readonly id: string;
  readonly inkAnchorId: string;
  readonly ghostAnchorId: string;
  readonly bridgeSegmentIds: readonly string[];
  readonly isHazardous?: boolean;
  readonly hysteresis?: number;
  readonly label: string;
}

export interface ConnectionState {
  readonly ruleId: string;
  readonly inkAnchorId: string;
  readonly ghostAnchorId: string;
  readonly compatibilityId: string;
  readonly distance: number;
  readonly tolerance: number;
  readonly active: boolean;
  readonly alignedRatio: number; // 1 = exact overlap, 0 = at or beyond tolerance
  readonly isHazardous: boolean;
}

export interface PathSegment {
  readonly id: string;
  readonly layer: PaperLayerId;
  readonly a: Vec2;
  readonly b: Vec2;
  readonly walkable: boolean;
  readonly isBridge?: boolean;
  readonly requiredConnectionId?: string;
  readonly isGoalApproach?: boolean;
  readonly stopLeft?: boolean;
  readonly stopRight?: boolean;
}

export type HazardKind = 'ink_spill' | 'press_roller' | 'misregister_pit';

export interface HazardZone {
  readonly id: string;
  readonly layer: PaperLayerId;
  readonly localPos: Vec2;
  readonly radius: number;
  readonly kind: HazardKind;
  readonly requiredConnectionId?: string;
}

export interface MovingObstacleDef {
  readonly id: string;
  readonly layer: PaperLayerId;
  readonly startLocal: Vec2;
  readonly endLocal: Vec2;
  readonly radius: number;
  readonly speed: number; // cycles per second (ping-pong)
  readonly initialPhase: number; // 0..1
}

export interface MovingObstacleState {
  readonly id: string;
  readonly localPos: Vec2;
  readonly phase: number;
  readonly direction: 1 | -1;
}

export type DotAnimState =
  | 'idle'
  | 'walking'
  | 'falling'
  | 'landing'
  | 'celebrating'
  | 'hazard';

export interface DotState {
  readonly pos: Vec2; // Ink-layer coordinates
  readonly vel: Vec2;
  readonly facing: 1 | -1;
  readonly animState: DotAnimState;
  readonly grounded: boolean;
  readonly walkDistance: number;
  readonly squashX: number;
  readonly squashY: number;
  readonly activeSegmentId: string | null;
  readonly stateTimerMs: number;
  readonly idlePauseMs: number;
  readonly patrolDirection: 1 | -1;
}

export type SimulationStatus = 'playing' | 'paused' | 'won' | 'lost';

export interface SimulationSnapshot {
  readonly tick: number;
  readonly elapsedMs: number;
  readonly status: SimulationStatus;
  readonly failureReason: string | null;
  readonly inkOffset: Vec2;
  readonly ghostOffset: Vec2;
  readonly dot: DotState;
  readonly connections: readonly ConnectionState[];
  readonly movingObstacles: readonly MovingObstacleState[];
  readonly shiftCount: number;
  readonly connectedCount: number;
}

export interface LevelDefinition {
  readonly id: string;
  readonly number: number;
  readonly chapter: number;
  readonly title: string;
  readonly subtitle: string;
  readonly instruction: string;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly inkBounds: RectBounds;
  readonly ghostBounds: RectBounds;
  readonly initialInkOffset: Vec2;
  readonly initialGhostOffset: Vec2;
  readonly dotStart: Vec2;
  readonly goalPos: Vec2;
  readonly anchors: readonly RegistrationAnchor[];
  readonly connections: readonly ConnectionRule[];
  readonly segments: readonly PathSegment[];
  readonly hazards: readonly HazardZone[];
  readonly movingObstacles: readonly MovingObstacleDef[];
  readonly parShifts: number;
}

export type AppScreen =
  | 'title'
  | 'menu'
  | 'levels'
  | 'playing'
  | 'paused'
  | 'complete'
  | 'failed'
  | 'settings';

export interface GameSettings {
  readonly muted: boolean;
  readonly showGuides: boolean;
  readonly reducedMotion: boolean;
  readonly unlockAllLevels: boolean;
}

export interface LevelProgress {
  readonly completed: boolean;
  readonly bestTimeMs: number | null;
  readonly bestShifts: number | null;
}

export interface GameHudState {
  readonly levelId: string;
  readonly levelNumber: number;
  readonly levelTitle: string;
  readonly instruction: string;
  readonly elapsedMs: number;
  readonly shiftCount: number;
  readonly rewindCount: number;
  readonly rewindAvailable: number;
  readonly activeConnections: number;
  readonly totalSafeConnections: number;
  readonly hazardConnections: number;
  readonly dotState: DotAnimState;
  readonly status: SimulationStatus;
  readonly failureReason: string | null;
  readonly ghostDelta: Vec2;
  readonly parShifts: number;
}
