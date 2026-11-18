import Phaser from 'phaser';
import { getLevelByNumber } from '../levels/levels';
import { drawLevelIllustration } from '../art/LevelIllustrations';
import { ensurePrintTextures, PRINT_PALETTE } from '../art/PrintArtFactory';
import { SoundEngine } from '../audio/SoundEngine';
import { InputController } from '../systems/InputSystem';
import {
  clampLayerOffset,
  computeWorldLayout,
  isLayerMovable,
  localToWorld,
  resolveDragLayerAtPoint,
} from '../systems/PaperLayerSystem';
import {
  findNearestSnapOffset,
  getConnectionDebugPairs,
} from '../systems/RegistrationEngine';
import { RewindSystem } from '../systems/RewindSystem';
import {
  FIXED_TIMESTEP_MS,
  createInitialSnapshot,
  shiftGhostLayer,
  shiftInkLayer,
  stepSimulation,
} from '../systems/SimulationEngine';
import type {
  AnchorShape,
  ConnectionState,
  GameHudState,
  GameSettings,
  LevelDefinition,
  PaperLayerId,
  SimulationSnapshot,
  Vec2,
} from '../types';

export interface MisprintSceneCallbacks {
  onSceneReady?: () => void;
  onHudUpdate: (hud: GameHudState) => void;
  onPauseToggle: () => void;
  onOutcome: (outcome: 'won' | 'lost', hud: GameHudState) => void;
  onMuteToggle: () => void;
  onGameplayResumed?: () => void;
  onShowGuidesToggle?: (showGuides: boolean) => void;
}

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  isFleck: boolean;
}

interface StampRing {
  active: boolean;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  startRadius: number;
  endRadius: number;
  color: number;
}

const PARTICLE_POOL_SIZE = 72;
const RING_POOL_SIZE = 10;

export class MisprintScene extends Phaser.Scene {
  private callbacks: MisprintSceneCallbacks | null = null;
  private level: LevelDefinition = getLevelByNumber(1);
  private snapshot: SimulationSnapshot = createInitialSnapshot(this.level);
  private rewindSystem = new RewindSystem(300);
  private inputController = new InputController(180);
  private soundEngine = new SoundEngine();

  private settings: GameSettings = {
    muted: false,
    showGuides: true,
    reducedMotion: false,
    unlockAllLevels: false,
  };

  private isSceneCreated = false;
  private isGameplayActive = false;
  private isPaused = false;
  private pendingLevelLoad: { levelNumber: number; startPlaying: boolean } | null = null;
  private accumulatorMs = 0;
  private lastHudPushMs = 0;
  private lastHudHash = '';
  private dragStartSnapshot: SimulationSnapshot | null = null;
  private dragMovedEnough = false;
  private dragScreenDistPx = 0;
  private pendingScreenDelta: Vec2 = { x: 0, y: 0 };
  private activeDragLayer: PaperLayerId = 'ghost';
  private ambientTime = 0;
  private lastDeskBgKey = '';
  private lastBridgeAnchorHash = '';
  private lastOverlayHash = '';

  // World & Layer Containers
  private worldRoot!: Phaser.GameObjects.Container;
  private deskBgGraphics!: Phaser.GameObjects.Graphics;
  private inkLayerContainer!: Phaser.GameObjects.Container;
  private inkStaticGraphics!: Phaser.GameObjects.Graphics;
  private inkAnchorGraphics!: Phaser.GameObjects.Graphics;
  private ghostLayerContainer!: Phaser.GameObjects.Container;
  private ghostSheetGraphics!: Phaser.GameObjects.Graphics;
  private ghostBridgeGraphics!: Phaser.GameObjects.Graphics;
  private ghostAnchorGraphics!: Phaser.GameObjects.Graphics;
  private overlayEffectsGraphics!: Phaser.GameObjects.Graphics;

  private paperGrainInk?: Phaser.GameObjects.TileSprite;
  private paperGrainGhost?: Phaser.GameObjects.TileSprite;
  private dotSprite!: Phaser.GameObjects.Image;
  private goalSprite!: Phaser.GameObjects.Image;
  private hazardSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private rollerSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private anchorLabels: Phaser.GameObjects.Text[] = [];
  private debugPairTexts: Map<string, Phaser.GameObjects.Text> = new Map();

  private particlePool: PooledParticle[] = [];
  private ringPool: StampRing[] = [];
  private prevConnectionsActive: Map<string, boolean> = new Map();
  private prevGrounded = true;
  private lastFootPuffDist = 0;
  private cameraTrauma = 0;
  private worldScale = 1;
  private ghostLayerRotation = 0;
  private wasElevatedGhost = false;

  // Bound DOM listeners for cleanup
  private onWindowBlurBound = () => this.cancelActiveDrag();
  private onTouchCancelBound = () => this.cancelActiveDrag();
  private onVisibilityChangeBound = () => this.handleVisibilityChange();
  private onWindowKeyDownBound = (e: KeyboardEvent) => this.handleWindowKeyDown(e);

  constructor() {
    super({ key: 'MisprintScene' });
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particlePool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 3,
        color: PRINT_PALETTE.cobalt,
        isFleck: i % 3 === 0,
      });
    }
    for (let i = 0; i < RING_POOL_SIZE; i++) {
      this.ringPool.push({
        active: false,
        x: 0,
        y: 0,
        life: 0,
        maxLife: 0.45,
        startRadius: 12,
        endRadius: 48,
        color: PRINT_PALETTE.sage,
      });
    }
  }

  public setCallbacks(callbacks: MisprintSceneCallbacks): void {
    this.callbacks = callbacks;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor('#f4efe4');
    ensurePrintTextures(this);

    this.deskBgGraphics = this.add.graphics();
    this.worldRoot = this.add.container(0, 0);

    // Layer A — INK Sheet
    this.inkLayerContainer = this.add.container(0, 0);
    this.inkStaticGraphics = this.add.graphics();
    this.inkAnchorGraphics = this.add.graphics();
    this.inkLayerContainer.add([this.inkStaticGraphics, this.inkAnchorGraphics]);

    if (this.textures.exists('paper-grain')) {
      this.paperGrainInk = this.add
        .tileSprite(480, 270, 880, 480, 'paper-grain')
        .setAlpha(0.75);
      this.inkLayerContainer.add(this.paperGrainInk);
    }

    this.goalSprite = this.add.image(0, 0, 'goal-postbox').setOrigin(0.5, 0.92).setScale(0.84);
    this.dotSprite = this.add.image(0, 0, 'dot-idle0').setOrigin(0.5, 0.92).setScale(0.78);
    this.inkLayerContainer.add([this.goalSprite, this.dotSprite]);

    // Layer B — GHOST Sheet (translucent vellum overlay above Ink)
    this.ghostLayerContainer = this.add.container(0, 0);
    this.ghostSheetGraphics = this.add.graphics();
    this.ghostBridgeGraphics = this.add.graphics();
    this.ghostAnchorGraphics = this.add.graphics();
    this.ghostLayerContainer.add([
      this.ghostSheetGraphics,
      this.ghostBridgeGraphics,
      this.ghostAnchorGraphics,
    ]);

    const vellumKey = this.textures.exists('paper-vellum') ? 'paper-vellum' : 'paper-grain';
    if (this.textures.exists(vellumKey)) {
      this.paperGrainGhost = this.add
        .tileSprite(480, 280, 556, 366, vellumKey)
        .setAlpha(0.55);
      this.ghostLayerContainer.add(this.paperGrainGhost);
    }

    // FX Layer (particles, snap rings)
    this.overlayEffectsGraphics = this.add.graphics();

    this.worldRoot.add([
      this.inkLayerContainer,
      this.ghostLayerContainer,
      this.overlayEffectsGraphics,
    ]);

    this.input.setTopOnly(true);
    this.setupInputListeners();
    this.scale.on('resize', this.handleResize, this);
    window.addEventListener('blur', this.onWindowBlurBound);
    window.addEventListener('touchcancel', this.onTouchCancelBound, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibilityChangeBound);
    window.addEventListener('keydown', this.onWindowKeyDownBound);

    this.isSceneCreated = true;
    const initialLoad = this.pendingLoadOrDefault();
    this.loadLevel(initialLoad.levelNumber, initialLoad.startPlaying);
    this.layoutWorld(this.scale.width, this.scale.height);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.isSceneCreated = false;
      this.cleanupListeners();
    });

    this.callbacks?.onSceneReady?.();
  }

  private pendingLoadOrDefault(): { levelNumber: number; startPlaying: boolean } {
    if (this.pendingLevelLoad) {
      const next = this.pendingLevelLoad;
      this.pendingLevelLoad = null;
      return next;
    }
    return { levelNumber: 1, startPlaying: this.isGameplayActive };
  }

  private cleanupListeners(): void {
    this.scale.off('resize', this.handleResize, this);
    this.input.removeAllListeners();
    window.removeEventListener('blur', this.onWindowBlurBound);
    window.removeEventListener('touchcancel', this.onTouchCancelBound);
    document.removeEventListener('visibilitychange', this.onVisibilityChangeBound);
    window.removeEventListener('keydown', this.onWindowKeyDownBound);
    this.soundEngine.destroy();
  }

  public setSettings(next: GameSettings): void {
    this.settings = next;
    this.soundEngine.setMuted(next.muted);
  }

  public setPlayMode(active: boolean, paused = false): void {
    this.isGameplayActive = active;
    this.isPaused = paused;
    if (!active || paused) {
      this.cancelActiveDrag();
    }
    if (this.isSceneCreated) {
      this.layoutWorld(this.scale.width, this.scale.height);
    }
  }

  public loadLevel(levelNumber: number, startPlaying: boolean): void {
    if (!this.isSceneCreated) {
      this.pendingLevelLoad = { levelNumber, startPlaying };
      this.isGameplayActive = startPlaying;
      return;
    }

    this.level = getLevelByNumber(levelNumber);
    this.snapshot = createInitialSnapshot(this.level);
    this.rewindSystem.reset(this.snapshot);
    this.accumulatorMs = 0;
    this.cancelActiveDrag();
    this.lastBridgeAnchorHash = '';
    this.lastOverlayHash = '';
    this.cameraTrauma = 0;
    this.cameras.main.setScroll(0, 0);
    for (const p of this.particlePool) p.active = false;
    for (const r of this.ringPool) r.active = false;
    this.prevGrounded = this.snapshot.dot.grounded;
    this.lastFootPuffDist = 0;
    this.soundEngine.resetStepTracker(0);

    this.prevConnectionsActive.clear();
    for (const conn of this.snapshot.connections) {
      this.prevConnectionsActive.set(conn.ruleId, conn.active);
    }

    this.isGameplayActive = startPlaying;
    this.isPaused = false;
    this.layoutWorld(this.scale.width, this.scale.height);
    this.rebuildLevelVisuals();
    this.syncVisuals(0);
    this.pushHudState(true);
  }

  public resetCurrentLevel(): void {
    this.loadLevel(this.level.number, true);
    this.soundEngine.playRewind();
    this.callbacks?.onGameplayResumed?.();
  }

  public rewindOneStep(): boolean {
    if (!this.isGameplayActive) return false;
    const restored = this.rewindSystem.rewind(this.snapshot.tick);
    if (!restored) return false;

    this.snapshot = { ...restored, status: 'playing', failureReason: null };
    this.isPaused = false;
    this.accumulatorMs = 0;
    this.cameraTrauma = 0;
    this.cameras.main.setScroll(0, 0);
    this.prevGrounded = this.snapshot.dot.grounded;
    this.lastFootPuffDist = this.snapshot.dot.walkDistance;
    this.soundEngine.resetStepTracker(this.snapshot.dot.walkDistance);

    for (const conn of this.snapshot.connections) {
      this.prevConnectionsActive.set(conn.ruleId, conn.active);
    }

    this.soundEngine.playRewind();
    const dotWorld = localToWorld(this.snapshot.dot.pos, this.snapshot.inkOffset);
    this.spawnBurst(dotWorld.x, dotWorld.y - 16, PRINT_PALETTE.cobalt, 10);
    this.syncVisuals(0);
    this.pushHudState(true);
    this.callbacks?.onGameplayResumed?.();
    return true;
  }

  private setupInputListeners(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isGameplayActive || this.isPaused || this.snapshot.status !== 'playing') {
        return;
      }
      const device = pointer.wasTouch ? 'touch' : 'mouse';
      const action = this.inputController.pointerDown(
        pointer.id,
        { x: pointer.x, y: pointer.y },
        device,
      );
      if (action?.type === 'drag_start') {
        const worldPoint: Vec2 = {
          x: (pointer.x - this.worldRoot.x) / Math.max(0.2, this.worldScale),
          y: (pointer.y - this.worldRoot.y) / Math.max(0.2, this.worldScale),
        };
        const forceInk = Boolean((pointer.event as MouseEvent | undefined)?.shiftKey);
        const touchMarginPx = pointer.wasTouch ? 16 : 0;
        this.activeDragLayer = resolveDragLayerAtPoint(
          worldPoint,
          this.level,
          this.snapshot.inkOffset,
          this.snapshot.ghostOffset,
          forceInk,
          touchMarginPx,
        );
        this.dragStartSnapshot = {
          ...this.snapshot,
          inkOffset: { ...this.snapshot.inkOffset },
          ghostOffset: { ...this.snapshot.ghostOffset },
          dot: {
            ...this.snapshot.dot,
            pos: { ...this.snapshot.dot.pos },
            vel: { ...this.snapshot.dot.vel },
          },
          connections: this.snapshot.connections.map((c) => ({ ...c })),
          movingObstacles: this.snapshot.movingObstacles.map((o) => ({
            ...o,
            localPos: { ...o.localPos },
          })),
        };
        this.dragMovedEnough = false;
        this.dragScreenDistPx = 0;
        this.pendingScreenDelta = { x: 0, y: 0 };
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isGameplayActive || this.isPaused || this.snapshot.status !== 'playing') {
        return;
      }
      const action = this.inputController.pointerMove(pointer.id, {
        x: pointer.x,
        y: pointer.y,
      });
      if (action?.type === 'drag_move') {
        const invScale = 1 / Math.max(0.2, this.worldScale);
        let screenDx = action.delta.x;
        let screenDy = action.delta.y;

        if (!this.dragMovedEnough) {
          this.pendingScreenDelta = {
            x: this.pendingScreenDelta.x + screenDx,
            y: this.pendingScreenDelta.y + screenDy,
          };
          this.dragScreenDistPx = Math.hypot(
            this.pendingScreenDelta.x,
            this.pendingScreenDelta.y,
          );
          const slopPx = action.device === 'touch' ? 4 : 1.5;
          if (this.dragScreenDistPx < slopPx) {
            return;
          }
          this.dragMovedEnough = true;
          screenDx = this.pendingScreenDelta.x;
          screenDy = this.pendingScreenDelta.y;
          this.pendingScreenDelta = { x: 0, y: 0 };
          if (this.dragStartSnapshot) {
            this.rewindSystem.recordCheckpoint(this.dragStartSnapshot, 'shift');
          }
        }

        const worldDx = screenDx * invScale;
        const worldDy = screenDy * invScale;

        if (this.activeDragLayer === 'ink' && isLayerMovable(this.level.inkBounds)) {
          const nextInk = clampLayerOffset(
            {
              x: this.snapshot.inkOffset.x + worldDx,
              y: this.snapshot.inkOffset.y + worldDy,
            },
            this.level.inkBounds,
          );
          this.applyInkShift(nextInk, false);
        } else {
          const nextTarget = clampLayerOffset(
            {
              x: this.snapshot.ghostOffset.x + worldDx,
              y: this.snapshot.ghostOffset.y + worldDy,
            },
            this.level.ghostBounds,
          );
          this.applyGhostShift(nextTarget, false);
        }
        this.soundEngine.playPaperSlide(Math.hypot(worldDx, worldDy));
      }
    });

    const handleRelease = (pointer: Phaser.Input.Pointer) => {
      const action = this.inputController.pointerUp(pointer.id);
      if (!action) return;

      if (this.dragMovedEnough && this.snapshot.status === 'playing') {
        if (this.activeDragLayer === 'ink' && isLayerMovable(this.level.inkBounds)) {
          this.applyInkShift(this.snapshot.inkOffset, true);
        } else {
          // Gentle tactile registration settle if released close to a safe anchor center
          const snapTarget = findNearestSnapOffset(
            this.level,
            this.snapshot.inkOffset,
            this.snapshot.ghostOffset,
            14,
          );
          const finalTarget = snapTarget ?? this.snapshot.ghostOffset;
          if (snapTarget) {
            const anchor = this.level.anchors.find(
              (a) => a.layer === 'ink' && this.level.connections.some((c) => c.inkAnchorId === a.id && !c.isHazardous),
            );
            if (anchor) {
              const ax = anchor.localPos.x + this.snapshot.inkOffset.x;
              const ay = anchor.localPos.y + this.snapshot.inkOffset.y;
              this.spawnStampRing(ax, ay, PRINT_PALETTE.sage, anchor.tolerance);
              this.spawnBurst(ax, ay, PRINT_PALETTE.sage, 6);
            }
          }
          this.applyGhostShift(finalTarget, true);
        }
      }
      this.dragStartSnapshot = null;
      this.dragMovedEnough = false;
      this.dragScreenDistPx = 0;
      this.pendingScreenDelta = { x: 0, y: 0 };
    };

    this.input.on('pointerup', handleRelease);
    this.input.on('pointerupoutside', handleRelease);
    this.input.on('gameout', () => this.cancelActiveDrag());
    this.input.on('pointercancel', (pointer: Phaser.Input.Pointer) => {
      this.inputController.pointerCancel(pointer.id);
      this.dragStartSnapshot = null;
      this.dragMovedEnough = false;
      this.dragScreenDistPx = 0;
      this.pendingScreenDelta = { x: 0, y: 0 };
    });
  }

  private cancelActiveDrag(): void {
    this.inputController.pointerCancel(null);
    this.dragStartSnapshot = null;
    this.dragMovedEnough = false;
    this.dragScreenDistPx = 0;
    this.pendingScreenDelta = { x: 0, y: 0 };
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.cancelActiveDrag();
      if (this.isGameplayActive && !this.isPaused && this.snapshot.status === 'playing') {
        this.callbacks?.onPauseToggle();
      }
    } else {
      // Clear accumulated delta to prevent burst steps on tab return
      this.accumulatorMs = 0;
    }
  }

  private handleWindowKeyDown(event: KeyboardEvent): void {
    if (!this.isGameplayActive) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const action = this.inputController.handleKeyDown(event.key);
    if (!action) {
      if (event.key.toLowerCase() === 'g' && !this.isPaused) {
        event.preventDefault();
        const nextShowGuides = !this.settings.showGuides;
        this.settings = { ...this.settings, showGuides: nextShowGuides };
        this.callbacks?.onShowGuidesToggle?.(nextShowGuides);
      }
      return;
    }

    if (action.type === 'pause' && this.snapshot.status === 'playing') {
      event.preventDefault();
      this.callbacks?.onPauseToggle();
      return;
    }
    if (action.type === 'mute') {
      event.preventDefault();
      this.callbacks?.onMuteToggle();
      return;
    }

    if (this.isPaused) return;

    if (action.type === 'undo' && this.snapshot.status !== 'won') {
      event.preventDefault();
      this.rewindOneStep();
      return;
    }
    if (action.type === 'reset') {
      event.preventDefault();
      this.resetCurrentLevel();
      return;
    }

    if (action.type === 'nudge' && this.snapshot.status === 'playing') {
      event.preventDefault();
      this.rewindSystem.recordCheckpoint(this.snapshot, 'shift');
      if (event.shiftKey && isLayerMovable(this.level.inkBounds)) {
        const nextInk = clampLayerOffset(
          {
            x: this.snapshot.inkOffset.x + action.delta.x,
            y: this.snapshot.inkOffset.y + action.delta.y,
          },
          this.level.inkBounds,
        );
        this.applyInkShift(nextInk, true);
      } else {
        const nextTarget = clampLayerOffset(
          {
            x: this.snapshot.ghostOffset.x + action.delta.x,
            y: this.snapshot.ghostOffset.y + action.delta.y,
          },
          this.level.ghostBounds,
        );
        this.applyGhostShift(nextTarget, true);
      }
      this.soundEngine.playPaperSlide(12);
    }
  }

  private applyGhostShift(targetOffset: Vec2, countShift: boolean): void {
    const prevConns = new Map(this.snapshot.connections.map((c) => [c.ruleId, c.active]));
    this.snapshot = shiftGhostLayer(this.level, this.snapshot, targetOffset, countShift);
    this.handleConnectionTransitions(prevConns, this.snapshot.connections);
    this.pushHudState(true);
  }

  private applyInkShift(targetOffset: Vec2, countShift: boolean): void {
    const prevConns = new Map(this.snapshot.connections.map((c) => [c.ruleId, c.active]));
    this.snapshot = shiftInkLayer(this.level, this.snapshot, targetOffset, countShift);
    this.handleConnectionTransitions(prevConns, this.snapshot.connections);
    this.pushHudState(true);
  }

  private handleConnectionTransitions(
    prevConns: Map<string, boolean>,
    nextConns: readonly ConnectionState[],
  ): void {
    for (const conn of nextConns) {
      const wasActive = prevConns.get(conn.ruleId) ?? false;
      if (!wasActive && conn.active) {
        this.soundEngine.playStampLock(conn.isHazardous);
        const inkAnchor = this.level.anchors.find((a) => a.id === conn.inkAnchorId);
        if (inkAnchor) {
          const burstColor = conn.isHazardous ? PRINT_PALETTE.vermilion : PRINT_PALETTE.sage;
          const ax = inkAnchor.localPos.x + this.snapshot.inkOffset.x;
          const ay = inkAnchor.localPos.y + this.snapshot.inkOffset.y;
          this.spawnBurst(ax, ay, burstColor, 16);
          this.spawnStampRing(ax, ay, burstColor, inkAnchor.tolerance);
        }
        if (!this.settings.reducedMotion) {
          this.cameraTrauma = Math.min(0.45, this.cameraTrauma + 0.16);
        }
      } else if (wasActive && !conn.active) {
        this.soundEngine.playDisconnect();
      }
      this.prevConnectionsActive.set(conn.ruleId, conn.active);
    }
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.layoutWorld(gameSize.width, gameSize.height);
  }

  private layoutWorld(viewW: number, viewH: number): void {
    const layout = computeWorldLayout(
      viewW,
      viewH,
      this.level.worldWidth,
      this.level.worldHeight,
      this.isGameplayActive,
    );
    this.worldScale = layout.scale;
    this.worldRoot.setScale(layout.scale);
    this.worldRoot.setPosition(layout.offsetX, layout.offsetY);

    this.drawDeskBackground(viewW, viewH);
  }

  private drawDeskBackground(viewW: number, viewH: number): void {
    const bgKey = `${Math.round(viewW)}x${Math.round(viewH)}`;
    if (bgKey === this.lastDeskBgKey) {
      return;
    }
    this.lastDeskBgKey = bgKey;

    const g = this.deskBgGraphics;
    g.clear();
    g.fillStyle(PRINT_PALETTE.paperCream, 1);
    g.fillRect(0, 0, viewW, viewH);

    // Letterpress workbench perimeter frame & corner registration crosses
    const margin = Math.min(viewW, viewH) < 460 ? 10 : 18;
    g.lineStyle(1, PRINT_PALETTE.charcoal, 0.09);
    g.strokeRect(margin, margin, viewW - margin * 2, viewH - margin * 2);
    g.lineStyle(1, PRINT_PALETTE.charcoal, 0.045);
    g.strokeRect(margin + 6, margin + 6, viewW - (margin + 6) * 2, viewH - (margin + 6) * 2);

    const corners = [
      [margin + 14, margin + 14],
      [viewW - margin - 14, margin + 14],
      [margin + 14, viewH - margin - 14],
      [viewW - margin - 14, viewH - margin - 14],
    ] as const;
    g.lineStyle(1, PRINT_PALETTE.charcoal, 0.14);
    for (const [cx, cy] of corners) {
      g.lineBetween(cx - 5, cy, cx + 5, cy);
      g.lineBetween(cx, cy - 5, cx, cy + 5);
    }
  }

  private rebuildLevelVisuals(): void {
    // Clear previous dynamic sprites & labels
    this.hazardSprites.forEach((s) => s.destroy());
    this.hazardSprites.clear();
    this.rollerSprites.forEach((s) => s.destroy());
    this.rollerSprites.clear();
    for (const lbl of this.anchorLabels) {
      lbl.destroy();
    }
    this.anchorLabels = [];
    this.debugPairTexts.forEach((t) => t.destroy());
    this.debugPairTexts.clear();

    // Draw Ink Sheet + static Ink paths
    const ink = this.inkStaticGraphics;
    ink.clear();

    // Ink Sheet multi-layered paper shadow + deckle border
    const sheetX = 40;
    const sheetY = 44;
    const sheetW = this.level.worldWidth - 80;
    const sheetH = this.level.worldHeight - 88;

    ink.fillStyle(PRINT_PALETTE.charcoal, 0.07);
    ink.fillRoundedRect(sheetX + 9, sheetY + 11, sheetW, sheetH, 4);
    ink.fillStyle(PRINT_PALETTE.charcoal, 0.12);
    ink.fillRoundedRect(sheetX + 5, sheetY + 6, sheetW, sheetH, 4);

    ink.fillStyle(PRINT_PALETTE.paperSheet, 1);
    ink.fillRoundedRect(sheetX, sheetY, sheetW, sheetH, 4);
    ink.lineStyle(2, PRINT_PALETTE.charcoal, 0.88);
    ink.strokeRoundedRect(sheetX, sheetY, sheetW, sheetH, 4);
    ink.lineStyle(1, PRINT_PALETTE.charcoal, 0.18);
    ink.strokeRoundedRect(sheetX + 5, sheetY + 5, sheetW - 10, sheetH - 10, 2);

    // Printer's corner crop marks on Ink sheet
    ink.lineStyle(1.2, PRINT_PALETTE.charcoal, 0.34);
    const cropCorners = [
      [sheetX + 16, sheetY + 16],
      [sheetX + sheetW - 16, sheetY + 16],
      [sheetX + 16, sheetY + sheetH - 16],
      [sheetX + sheetW - 16, sheetY + sheetH - 16],
    ] as const;
    for (const [cx, cy] of cropCorners) {
      ink.lineBetween(cx - 8, cy, cx + 8, cy);
      ink.lineBetween(cx, cy - 8, cx, cy + 8);
    }

    // Subtle laid-paper horizontal baseline guides on Ink sheet
    ink.lineStyle(1, PRINT_PALETTE.charcoal, 0.042);
    for (let gy = sheetY + 48; gy < sheetY + sheetH - 20; gy += 48) {
      ink.lineBetween(sheetX + 20, gy, sheetX + sheetW - 20, gy);
    }

    // Handcrafted background illustration & architectural supports per level
    drawLevelIllustration(ink, this.level);

    // Engraved printmaker folio stamp in bottom-right corner of Ink sheet
    const folioText = this.add
      .text(
        sheetX + sheetW - 28,
        sheetY + sheetH - 16,
        this.level.number === 0
          ? 'REG. SANDBOX · 00'
          : `FOL. I · PROOF ${String(this.level.number).padStart(2, '0')}`,
        {
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '9px',
          color: '#7c6f5b',
        },
      )
      .setOrigin(1, 0.5)
      .setAlpha(0.65);
    this.inkLayerContainer.add(folioText);
    this.anchorLabels.push(folioText);

    // Draw permanent Ink walkable slabs
    for (const seg of this.level.segments) {
      if (seg.layer !== 'ink') continue;
      this.drawInkPlatform(ink, seg.a, seg.b, Boolean(seg.stopLeft), Boolean(seg.stopRight));
    }

    // Goal Postbox
    this.goalSprite.setPosition(this.level.goalPos.x, this.level.goalPos.y);

    // Hazards on Ink / Ghost
    for (const h of this.level.hazards) {
      const img = this.add.image(h.localPos.x, h.localPos.y + 4, 'ink-spill');
      img.setScale((h.radius * 2.25) / 128);
      if (h.layer === 'ink') {
        this.inkLayerContainer.add(img);
      } else {
        this.ghostLayerContainer.add(img);
      }
      this.hazardSprites.set(h.id, img);
    }

    // Moving Press Rollers
    for (const obs of this.level.movingObstacles) {
      const img = this.add.image(obs.startLocal.x, obs.startLocal.y, 'press-roller');
      img.setScale((obs.radius * 2.18) / 64);
      if (obs.layer === 'ink') {
        this.inkLayerContainer.add(img);
      } else {
        this.ghostLayerContainer.add(img);
      }
      this.rollerSprites.set(obs.id, img);
    }

    // Draw Ghost Sheet base vellum geometry
    this.drawGhostSheetBase();

    // Anchor label text badges
    for (const anchor of this.level.anchors) {
      if (!anchor.label) continue;
      const color = anchor.shape === 'cross' ? '#c93b2b' : anchor.layer === 'ink' ? '#1e2024' : '#2f5485';
      const txt = this.add
        .text(anchor.localPos.x + 18, anchor.localPos.y - 20, anchor.label, {
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '11px',
          fontStyle: 'bold',
          color,
        })
        .setOrigin(0.5);
      if (anchor.layer === 'ink') {
        this.inkLayerContainer.add(txt);
      } else {
        this.ghostLayerContainer.add(txt);
      }
      this.anchorLabels.push(txt);
    }

    // Ensure Dot & Goal stay above Ink slabs
    this.inkLayerContainer.bringToTop(this.goalSprite);
    this.inkLayerContainer.bringToTop(this.dotSprite);
  }

  private drawInkPlatform(
    g: Phaser.GameObjects.Graphics,
    a: Vec2,
    b: Vec2,
    stopLeft: boolean,
    stopRight: boolean,
  ): void {
    const slabH = 16;
    // Slight woodblock misregistration tint offset beneath the slab
    g.fillStyle(PRINT_PALETTE.cobalt, 0.14);
    g.beginPath();
    g.moveTo(a.x + 3, a.y + 3);
    g.lineTo(b.x + 3, b.y + 3);
    g.lineTo(b.x + 3, b.y + slabH + 3);
    g.lineTo(a.x + 3, a.y + slabH + 3);
    g.closePath();
    g.fillPath();

    // Main cream/warm-ink carved platform slab
    g.fillStyle(PRINT_PALETTE.paperWarm, 1);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(b.x, b.y + slabH);
    g.lineTo(a.x, a.y + slabH);
    g.closePath();
    g.fillPath();

    // Charcoal inked top edge + border
    g.lineStyle(2.5, PRINT_PALETTE.charcoal, 0.95);
    g.lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(1.4, PRINT_PALETTE.charcoal, 0.65);
    g.lineBetween(a.x, a.y + slabH, b.x, b.y + slabH);
    g.lineBetween(a.x, a.y, a.x, a.y + slabH);
    g.lineBetween(b.x, b.y, b.x, b.y + slabH);

    // Hand-drawn diagonal woodcut crosshatch inside slab
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.floor(len / 14);
    g.lineStyle(1, PRINT_PALETTE.charcoal, 0.22);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const hx = a.x + (b.x - a.x) * t;
      const hy = a.y + (b.y - a.y) * t;
      g.lineBetween(hx, hy + 3, hx - 6, hy + slabH - 2);
    }

    // Visual turn-around curb posts vs open drop arrows
    if (stopLeft) {
      g.fillStyle(PRINT_PALETTE.charcoal, 0.9);
      g.fillRect(a.x, a.y - 14, 6, 14);
    } else {
      g.lineStyle(1.5, PRINT_PALETTE.vermilion, 0.55);
      g.lineBetween(a.x, a.y + 2, a.x - 6, a.y + 12);
    }

    if (stopRight) {
      g.fillStyle(PRINT_PALETTE.charcoal, 0.9);
      g.fillRect(b.x - 6, b.y - 14, 6, 14);
    } else {
      g.lineStyle(1.5, PRINT_PALETTE.vermilion, 0.55);
      g.lineBetween(b.x, b.y + 2, b.x + 6, b.y + 12);
    }
  }

  private drawGhostSheetBase(isElevated = false): void {
    this.wasElevatedGhost = isElevated;
    const g = this.ghostSheetGraphics;
    g.clear();

    const gx = 200;
    const gy = 95;
    const gw = 560;
    const gh = 370;

    // Vellum elevation shadow: deeper and offset when lifted
    if (isElevated) {
      g.fillStyle(PRINT_PALETTE.cobalt, 0.15);
      g.fillRoundedRect(gx + 8, gy + 12, gw, gh, 7);
    } else {
      g.fillStyle(PRINT_PALETTE.cobalt, 0.08);
      g.fillRoundedRect(gx + 5, gy + 7, gw, gh, 5);
    }

    // Translucent vellum paper sheet
    g.fillStyle(PRINT_PALETTE.ghostTint, isElevated ? 0.48 : 0.44);
    g.fillRoundedRect(gx, gy, gw, gh, 5);

    // Cobalt printmaker frame + corner drag handles
    g.lineStyle(isElevated ? 2.4 : 2, PRINT_PALETTE.cobalt, isElevated ? 0.9 : 0.72);
    g.strokeRoundedRect(gx, gy, gw, gh, 5);

    // Corner grip brackets indicating draggable Ghost layer
    const brackets = [
      [gx + 10, gy + 10, 1, 1],
      [gx + gw - 10, gy + 10, -1, 1],
      [gx + 10, gy + gh - 10, 1, -1],
      [gx + gw - 10, gy + gh - 10, -1, -1],
    ] as const;
    g.lineStyle(2.5, PRINT_PALETTE.cobalt, isElevated ? 0.98 : 0.85);
    for (const [bx, by, sx, sy] of brackets) {
      g.lineBetween(bx, by, bx + sx * 14, by);
      g.lineBetween(bx, by, bx, by + sy * 14);
    }
  }

  private drawAnchorSymbol(
    g: Phaser.GameObjects.Graphics,
    pos: Vec2,
    shape: AnchorShape,
    color: number,
    alpha: number,
    active: boolean,
    tolerance: number,
    showGuide: boolean,
  ): void {
    const r = 13;
    if (showGuide) {
      g.lineStyle(1.2, color, active ? 0.45 : 0.22);
      g.strokeCircle(pos.x, pos.y, tolerance);
    }

    if (active) {
      g.fillStyle(color, 0.16);
      g.fillCircle(pos.x, pos.y, r + 5);
    }

    g.lineStyle(2.4, color, alpha);

    switch (shape) {
      case 'circle':
        g.strokeCircle(pos.x, pos.y, r);
        g.lineStyle(1.2, color, alpha * 0.7);
        g.lineBetween(pos.x - r - 6, pos.y, pos.x + r + 6, pos.y);
        g.lineBetween(pos.x, pos.y - r - 6, pos.x, pos.y + r + 6);
        break;
      case 'diamond':
        g.beginPath();
        g.moveTo(pos.x, pos.y - r - 2);
        g.lineTo(pos.x + r + 2, pos.y);
        g.lineTo(pos.x, pos.y + r + 2);
        g.lineTo(pos.x - r - 2, pos.y);
        g.closePath();
        g.strokePath();
        break;
      case 'square':
        g.strokeRect(pos.x - r, pos.y - r, r * 2, r * 2);
        g.lineStyle(1.2, color, alpha * 0.65);
        g.lineBetween(pos.x - r - 5, pos.y, pos.x + r + 5, pos.y);
        break;
      case 'cross':
        g.lineBetween(pos.x - r, pos.y - r, pos.x + r, pos.y + r);
        g.lineBetween(pos.x - r, pos.y + r, pos.x + r, pos.y - r);
        g.strokeCircle(pos.x, pos.y, r + 2);
        break;
    }
  }

  private drawGhostBridges(): void {
    const g = this.ghostBridgeGraphics;
    g.clear();

    for (const seg of this.level.segments) {
      if (seg.layer !== 'ghost') continue;

      const conn = seg.requiredConnectionId
        ? this.snapshot.connections.find((c) => c.ruleId === seg.requiredConnectionId)
        : undefined;
      const isActive = Boolean(conn?.active);
      const isHazard = Boolean(conn?.isHazardous);

      const strokeColor = isHazard && isActive
        ? PRINT_PALETTE.vermilion
        : PRINT_PALETTE.cobalt;

      if (isActive) {
        // Solidified stamped plank bridge
        g.fillStyle(strokeColor, isHazard ? 0.25 : 0.2);
        g.beginPath();
        g.moveTo(seg.a.x, seg.a.y);
        g.lineTo(seg.b.x, seg.b.y);
        g.lineTo(seg.b.x, seg.b.y + 14);
        g.lineTo(seg.a.x, seg.a.y + 14);
        g.closePath();
        g.fillPath();

        g.lineStyle(3, strokeColor, 1);
        g.lineBetween(seg.a.x, seg.a.y, seg.b.x, seg.b.y);
        g.lineStyle(1.5, PRINT_PALETTE.charcoal, 0.8);
        g.lineBetween(seg.a.x, seg.a.y + 14, seg.b.x, seg.b.y + 14);

        // Cross-ribs along solidified bridge
        const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
        const ribs = Math.max(2, Math.floor(len / 18));
        g.lineStyle(1.4, strokeColor, 0.75);
        for (let i = 0; i <= ribs; i++) {
          const t = i / ribs;
          const rx = seg.a.x + (seg.b.x - seg.a.x) * t;
          const ry = seg.a.y + (seg.b.y - seg.a.y) * t;
          g.lineBetween(rx, ry, rx, ry + 14);
        }
      } else {
        // Unregistered dashed blueprint ghost bridge
        const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
        const dashCount = Math.max(4, Math.floor(len / 14));
        g.lineStyle(2, strokeColor, 0.45);
        for (let i = 0; i < dashCount; i += 2) {
          const t0 = i / dashCount;
          const t1 = Math.min(1, (i + 1.1) / dashCount);
          g.lineBetween(
            seg.a.x + (seg.b.x - seg.a.x) * t0,
            seg.a.y + (seg.b.y - seg.a.y) * t0,
            seg.a.x + (seg.b.x - seg.a.x) * t1,
            seg.a.y + (seg.b.y - seg.a.y) * t1,
          );
        }
      }
    }
  }

  private drawAllAnchors(): void {
    this.inkAnchorGraphics.clear();
    this.ghostAnchorGraphics.clear();

    for (const anchor of this.level.anchors) {
      const conn = this.snapshot.connections.find(
        (c) => c.inkAnchorId === anchor.id || c.ghostAnchorId === anchor.id,
      );
      const isActive = Boolean(conn?.active);
      const isHazard = anchor.shape === 'cross' || Boolean(conn?.isHazardous);

      let color: number =
        anchor.layer === 'ink' ? PRINT_PALETTE.charcoal : PRINT_PALETTE.cobalt;
      if (isHazard) {
        color = PRINT_PALETTE.vermilion;
      } else if (isActive) {
        color = PRINT_PALETTE.sage;
      }

      const targetGraphics =
        anchor.layer === 'ink' ? this.inkAnchorGraphics : this.ghostAnchorGraphics;
      this.drawAnchorSymbol(
        targetGraphics,
        anchor.localPos,
        anchor.shape,
        color,
        isActive ? 1 : 0.78,
        isActive,
        anchor.tolerance,
        this.settings.showGuides,
      );
    }
  }

  private spawnStampRing(x: number, y: number, color: number, baseRadius: number): void {
    if (this.settings.reducedMotion) return;
    for (let i = 0; i < RING_POOL_SIZE; i++) {
      const r = this.ringPool[i]!;
      if (r.active) continue;
      r.active = true;
      r.x = x;
      r.y = y;
      r.life = 0;
      r.maxLife = 0.42;
      r.startRadius = Math.max(10, baseRadius * 0.55);
      r.endRadius = baseRadius + 24;
      r.color = color;
      return;
    }
  }

  private spawnBurst(x: number, y: number, color: number, count: number): void {
    if (this.settings.reducedMotion) return;
    let spawned = 0;
    for (let i = 0; i < PARTICLE_POOL_SIZE && spawned < count; i++) {
      const p = this.particlePool[i]!;
      if (p.active) continue;
      const angle = (spawned / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 45 + Math.random() * 110;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 20;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.25;
      p.size = 2.5 + Math.random() * 2.5;
      p.color = color;
      p.isFleck = spawned % 3 === 0;
      spawned++;
    }
  }

  private updateParticles(dtSec: number): void {
    const hasActiveRing = this.ringPool.some((r) => r.active);
    const hasActiveParticle = this.particlePool.some((p) => p.active);
    const overlayHash = `${this.level.id}|${this.isGameplayActive ? 1 : 0}|${this.settings.showGuides ? 1 : 0}|${Math.round(this.snapshot.inkOffset.x * 2)},${Math.round(this.snapshot.inkOffset.y * 2)}|${Math.round(this.snapshot.ghostOffset.x * 2)},${Math.round(this.snapshot.ghostOffset.y * 2)}|${this.snapshot.connections.map((c) => (c.active ? 1 : 0)).join('')}`;

    if (!hasActiveRing && !hasActiveParticle && overlayHash === this.lastOverlayHash) {
      return;
    }
    this.lastOverlayHash = overlayHash;

    const g = this.overlayEffectsGraphics;
    g.clear();

    // Registration alignment tether & debug distance visualization
    if (this.settings.showGuides && this.isGameplayActive) {
      const pairs = getConnectionDebugPairs(
        this.level,
        this.snapshot.connections,
        this.snapshot.inkOffset,
        this.snapshot.ghostOffset,
      );
      const showNumericDistances = this.level.number === 0;

      for (const pair of pairs) {
        const maxVisualRange = pair.tolerance * 4.5;
        const showTether = showNumericDistances || pair.distance <= maxVisualRange;

        if (showTether) {
          const lineColor = pair.isHazardous
            ? PRINT_PALETTE.vermilion
            : pair.active
              ? PRINT_PALETTE.sage
              : PRINT_PALETTE.cobalt;
          const alpha = pair.active ? 0.65 : 0.36;
          g.lineStyle(pair.active ? 2 : 1.4, lineColor, alpha);
          g.lineBetween(
            pair.inkWorld.x,
            pair.inkWorld.y,
            pair.ghostWorld.x,
            pair.ghostWorld.y,
          );
        }

        if (showNumericDistances) {
          let label = this.debugPairTexts.get(pair.ruleId);
          if (!label) {
            label = this.add
              .text(0, 0, '', {
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '10px',
                color: '#1e2024',
                backgroundColor: '#faf7f0',
                padding: { x: 4, y: 2 },
              })
              .setOrigin(0.5);
            this.worldRoot.add(label);
            this.debugPairTexts.set(pair.ruleId, label);
          }
          const midX = (pair.inkWorld.x + pair.ghostWorld.x) * 0.5;
          const midY = (pair.inkWorld.y + pair.ghostWorld.y) * 0.5 - 16;
          label.setPosition(midX, midY);
          label.setVisible(true);
          label.setColor(pair.active ? '#3a6b52' : '#2f5485');
          label.setText(
            `${pair.compatibilityId} · d=${Math.round(pair.distance)}/${pair.tolerance}px${pair.active ? ' LOCKED' : ''}`,
          );
        }
      }
    } else {
      this.debugPairTexts.forEach((lbl) => lbl.setVisible(false));
    }

    // Expanding woodblock stamp rings
    for (let i = 0; i < RING_POOL_SIZE; i++) {
      const r = this.ringPool[i]!;
      if (!r.active) continue;
      r.life += dtSec;
      if (r.life >= r.maxLife) {
        r.active = false;
        continue;
      }
      const p = r.life / r.maxLife;
      const radius = r.startRadius + (r.endRadius - r.startRadius) * (1 - (1 - p) * (1 - p));
      g.lineStyle(2.2 * (1 - p), r.color, (1 - p) * 0.72);
      g.strokeCircle(r.x, r.y, radius);
    }

    // Ink droplets & tiny paper flecks
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particlePool[i]!;
      if (!p.active) continue;
      p.life += dtSec;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 220 * dtSec;
      const alpha = 1 - p.life / p.maxLife;
      g.fillStyle(p.color, alpha * 0.85);
      if (p.isFleck) {
        const s = p.size * (0.7 + 0.5 * alpha);
        g.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s * 0.75);
      } else {
        g.fillCircle(p.x, p.y, p.size * (0.5 + 0.5 * alpha));
      }
    }
  }

  private syncVisuals(dtSec: number): void {
    const dragging = this.inputController.getState().isDragging;
    const isDraggingGhost = dragging && this.activeDragLayer === 'ghost';
    const inkLift = dragging && this.activeDragLayer === 'ink' ? -3 : 0;
    const ghostLift = isDraggingGhost ? -3 : 0;

    if (isDraggingGhost !== this.wasElevatedGhost) {
      this.drawGhostSheetBase(isDraggingGhost);
    }

    // Subtle paper tilt inertia during drag
    const targetTilt = isDraggingGhost
      ? Math.max(-0.018, Math.min(0.018, this.pendingScreenDelta.x * 0.0008))
      : 0;
    this.ghostLayerRotation += (targetTilt - this.ghostLayerRotation) * Math.min(1, dtSec * 14);

    this.inkLayerContainer.setPosition(
      this.snapshot.inkOffset.x,
      this.snapshot.inkOffset.y + inkLift,
    );
    this.ghostLayerContainer.setPosition(
      this.snapshot.ghostOffset.x,
      this.snapshot.ghostOffset.y + ghostLift,
    );
    this.ghostLayerContainer.setRotation(this.ghostLayerRotation);

    // Goal Postbox delivered state update
    const goalKey = this.snapshot.status === 'won' ? 'goal-postbox-delivered' : 'goal-postbox';
    if (this.goalSprite.texture.key !== goalKey && this.textures.exists(goalKey)) {
      this.goalSprite.setTexture(goalKey);
    }

    // Update moving Press Rollers
    for (const obsState of this.snapshot.movingObstacles) {
      const sprite = this.rollerSprites.get(obsState.id);
      if (!sprite) continue;
      sprite.setPosition(obsState.localPos.x, obsState.localPos.y);
      sprite.setRotation(obsState.phase * Math.PI * 4);
    }

    // Update Dot courier sprite frame, facing, and squash-and-stretch
    const dot = this.snapshot.dot;
    this.dotSprite.setPosition(dot.pos.x, dot.pos.y);
    this.dotSprite.setFlipX(dot.facing < 0);
    this.dotSprite.setScale(dot.squashX * 0.78, dot.squashY * 0.78);

    let frameKey = 'dot-idle0';
    switch (dot.animState) {
      case 'walking': {
        const frameIdx = Math.floor(dot.walkDistance / 11) % 4;
        frameKey = `dot-walk${frameIdx}`;
        if (
          this.isGameplayActive &&
          !this.isPaused &&
          dot.walkDistance - this.lastFootPuffDist >= 42
        ) {
          this.lastFootPuffDist = dot.walkDistance;
          this.spawnBurst(
            dot.pos.x + this.snapshot.inkOffset.x - dot.facing * 5,
            dot.pos.y + this.snapshot.inkOffset.y - 2,
            PRINT_PALETTE.sepia,
            2,
          );
        }
        break;
      }
      case 'idle': {
        const blink = Math.floor(this.snapshot.elapsedMs / 450) % 4 === 3;
        frameKey = blink ? 'dot-idle1' : 'dot-idle0';
        break;
      }
      case 'falling':
        frameKey = 'dot-fall';
        break;
      case 'landing':
        frameKey = 'dot-land';
        break;
      case 'celebrating':
        frameKey = 'dot-celebrate';
        break;
      case 'hazard':
        frameKey = 'dot-hazard';
        break;
    }

    if (this.dotSprite.texture.key !== frameKey && this.textures.exists(frameKey)) {
      this.dotSprite.setTexture(frameKey);
    }

    // Dynamic bridges & anchor lock states (dirty-checked to save mobile GPU/CPU)
    const bridgeAnchorHash = `${this.level.id}|${this.settings.showGuides ? 1 : 0}|${this.snapshot.connections.map((c) => `${c.ruleId}:${c.active ? 1 : 0}`).join(',')}`;
    if (bridgeAnchorHash !== this.lastBridgeAnchorHash) {
      this.lastBridgeAnchorHash = bridgeAnchorHash;
      this.drawGhostBridges();
      this.drawAllAnchors();
    }

    // Update particles & camera trauma shake
    this.updateParticles(dtSec);

    if (this.cameraTrauma > 0) {
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dtSec * 1.9);
      const shake = this.cameraTrauma * this.cameraTrauma * 6;
      this.cameras.main.setScroll(
        (Math.random() * 2 - 1) * shake,
        (Math.random() * 2 - 1) * shake,
      );
    } else {
      this.cameras.main.setScroll(0, 0);
    }
  }

  public override update(_time: number, delta: number): void {
    const clampedDeltaMs = Math.min(delta, 100);
    const dtSec = clampedDeltaMs / 1000;

    if (!this.isGameplayActive) {
      // Gentle living print-studio ambient motion on Title / Menu screens
      this.ambientTime += dtSec;
      const swayX = Math.sin(this.ambientTime * 0.7) * 32 - 36;
      const swayY = Math.cos(this.ambientTime * 0.55) * 14;
      this.snapshot = {
        ...this.snapshot,
        ghostOffset: { x: swayX, y: swayY },
      };
      this.syncVisuals(dtSec);
      return;
    }

    if (this.isPaused || this.snapshot.status !== 'playing') {
      this.syncVisuals(dtSec);
      return;
    }

    this.accumulatorMs += clampedDeltaMs;
    let steps = 0;

    while (this.accumulatorMs >= FIXED_TIMESTEP_MS && steps < 6) {
      const prevStatus = this.snapshot.status;
      this.snapshot = stepSimulation(this.level, this.snapshot, FIXED_TIMESTEP_MS);
      this.accumulatorMs -= FIXED_TIMESTEP_MS;
      steps++;

      // Periodic rewind checkpoints every 30 ticks (~0.5s)
      if (this.snapshot.tick % 30 === 0 && this.snapshot.status === 'playing') {
        this.rewindSystem.recordCheckpoint(this.snapshot, 'periodic');
      }

      // Audio cues synced to Dot's state transitions
      if (this.snapshot.dot.grounded && !this.prevGrounded) {
        this.soundEngine.playLanding();
        const landWorld = localToWorld(this.snapshot.dot.pos, this.snapshot.inkOffset);
        this.spawnBurst(
          landWorld.x,
          landWorld.y,
          PRINT_PALETTE.charcoalMuted,
          6,
        );
      }
      this.prevGrounded = this.snapshot.dot.grounded;

      if (this.snapshot.dot.animState === 'walking') {
        this.soundEngine.maybePlayFootstep(this.snapshot.dot.walkDistance);
      }

      if (prevStatus === 'playing' && this.snapshot.status === 'won') {
        this.soundEngine.playVictory();
        const goalWorld = localToWorld(this.level.goalPos, this.snapshot.inkOffset);
        this.spawnBurst(goalWorld.x, goalWorld.y - 26, PRINT_PALETTE.vermilion, 18);
        this.spawnBurst(goalWorld.x, goalWorld.y - 26, PRINT_PALETTE.ochre, 14);
        this.spawnBurst(goalWorld.x, goalWorld.y - 26, PRINT_PALETTE.sage, 12);
        if (this.textures.exists('goal-postbox-delivered')) {
          this.goalSprite.setTexture('goal-postbox-delivered');
        }
        this.syncVisuals(dtSec);
        this.pushHudState(true);
        this.callbacks?.onOutcome('won', this.buildHudState());
        break;
      }

      if (prevStatus === 'playing' && this.snapshot.status === 'lost') {
        this.soundEngine.playFailure();
        if (!this.settings.reducedMotion) {
          this.cameraTrauma = 0.55;
        }
        const failWorld = localToWorld(this.snapshot.dot.pos, this.snapshot.inkOffset);
        this.spawnBurst(
          failWorld.x,
          failWorld.y - 12,
          PRINT_PALETTE.charcoal,
          16,
        );
        this.syncVisuals(dtSec);
        this.pushHudState(true);
        this.callbacks?.onOutcome('lost', this.buildHudState());
        break;
      }
    }

    this.syncVisuals(dtSec);
    this.pushHudState(false);
  }

  private buildHudState(): GameHudState {
    const safeConnections = this.snapshot.connections.filter((c) => !c.isHazardous);
    const activeSafe = safeConnections.filter((c) => c.active).length;
    const hazardActive = this.snapshot.connections.filter((c) => c.isHazardous && c.active).length;

    return {
      levelId: this.level.id,
      levelNumber: this.level.number,
      levelTitle: this.level.title,
      instruction: this.level.instruction,
      elapsedMs: this.snapshot.elapsedMs,
      shiftCount: this.snapshot.shiftCount,
      rewindCount: this.rewindSystem.getRewindCount(),
      rewindAvailable: this.rewindSystem.getAvailableCount(this.snapshot.tick),
      activeConnections: activeSafe,
      totalSafeConnections: safeConnections.length,
      hazardConnections: hazardActive,
      dotState: this.snapshot.dot.animState,
      status: this.snapshot.status,
      failureReason: this.snapshot.failureReason,
      ghostDelta: {
        x: Math.round(this.snapshot.ghostOffset.x - this.snapshot.inkOffset.x),
        y: Math.round(this.snapshot.ghostOffset.y - this.snapshot.inkOffset.y),
      },
      parShifts: this.level.parShifts,
    };
  }

  private pushHudState(force: boolean): void {
    if (!this.callbacks) return;
    const now = performance.now();
    if (!force && now - this.lastHudPushMs < 120) {
      return;
    }

    const hud = this.buildHudState();
    const sec = Math.floor(hud.elapsedMs / 1000);
    const hash = `${hud.levelId}|${sec}|${hud.shiftCount}|${hud.rewindAvailable}|${hud.activeConnections}|${hud.hazardConnections}|${hud.status}|${hud.ghostDelta.x},${hud.ghostDelta.y}`;
    if (!force && hash === this.lastHudHash) {
      return;
    }

    this.lastHudHash = hash;
    this.lastHudPushMs = now;
    this.callbacks.onHudUpdate(hud);
  }
}
