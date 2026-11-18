import type { SimulationSnapshot } from '../types';

export type CheckpointKind = 'periodic' | 'shift';

export interface RewindEntry {
  readonly kind: CheckpointKind;
  readonly snapshot: SimulationSnapshot;
}

export function cloneSnapshot(snapshot: SimulationSnapshot): SimulationSnapshot {
  return {
    ...snapshot,
    inkOffset: { ...snapshot.inkOffset },
    ghostOffset: { ...snapshot.ghostOffset },
    dot: {
      ...snapshot.dot,
      pos: { ...snapshot.dot.pos },
      vel: { ...snapshot.dot.vel },
    },
    connections: snapshot.connections.map((c) => ({ ...c })),
    movingObstacles: snapshot.movingObstacles.map((o) => ({
      ...o,
      localPos: { ...o.localPos },
    })),
  };
}

export class RewindSystem {
  private entries: RewindEntry[] = [];
  private readonly maxEntries: number;
  private rewindCount = 0;

  constructor(maxEntries = 300) {
    this.maxEntries = maxEntries;
  }

  public reset(initialSnapshot: SimulationSnapshot): void {
    this.entries = [{ kind: 'shift', snapshot: cloneSnapshot(initialSnapshot) }];
    this.rewindCount = 0;
  }

  public recordCheckpoint(snapshot: SimulationSnapshot, kind: CheckpointKind): void {
    const last = this.entries[this.entries.length - 1];
    if (
      last &&
      last.snapshot.tick === snapshot.tick &&
      last.kind === kind &&
      last.snapshot.shiftCount === snapshot.shiftCount
    ) {
      return;
    }
    this.entries.push({
      kind,
      snapshot: cloneSnapshot(snapshot),
    });
    if (this.entries.length > this.maxEntries) {
      // Preserve initial entry at index 0 for clean full-rewind reachability
      this.entries.splice(1, 1);
    }
  }

  public canRewind(currentTick: number): boolean {
    if (this.entries.length <= 1) {
      return currentTick > 0 && this.entries.length === 1;
    }
    return true;
  }

  public getAvailableCount(currentTick = 0): number {
    if (this.entries.length > 1) {
      return this.entries.length - 1;
    }
    return this.canRewind(currentTick) ? 1 : 0;
  }

  public getRewindCount(): number {
    return this.rewindCount;
  }

  public rewind(currentTick: number): SimulationSnapshot | null {
    if (this.entries.length === 0) {
      return null;
    }

    // Drop any checkpoint right at the exact current tick if earlier checkpoints exist
    while (
      this.entries.length > 1 &&
      this.entries[this.entries.length - 1]!.snapshot.tick >= currentTick
    ) {
      this.entries.pop();
    }

    // Prefer jumping back to the most recent 'shift' boundary if one exists
    let targetIndex = this.entries.length - 1;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i]!.kind === 'shift') {
        targetIndex = i;
        break;
      }
    }

    const target = this.entries[targetIndex];
    if (!target) {
      return null;
    }

    // Truncate future checkpoints beyond the rewound target
    this.entries = this.entries.slice(0, targetIndex + 1);

    this.rewindCount += 1;
    return cloneSnapshot(target.snapshot);
  }
}
