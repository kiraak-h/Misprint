import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Phaser from 'phaser';
import { MisprintScene, type MisprintSceneCallbacks } from './scenes/MisprintScene';
import type { GameSettings } from './types';

export interface PhaserGameHandle {
  loadLevel: (levelNumber: number, startPlaying: boolean) => void;
  setPlayMode: (active: boolean, paused?: boolean) => void;
  rewindOneStep: () => boolean;
  resetLevel: () => void;
  setSettings: (settings: GameSettings) => void;
}

export interface PhaserGameProps {
  callbacks: MisprintSceneCallbacks;
  initialSettings: GameSettings;
  onReady?: () => void;
}

export const PhaserGame = forwardRef<PhaserGameHandle, PhaserGameProps>(
  function PhaserGame({ callbacks, initialSettings, onReady }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<MisprintScene | null>(null);

    const callbacksRef = useRef(callbacks);
    callbacksRef.current = callbacks;

    const settingsRef = useRef(initialSettings);
    settingsRef.current = initialSettings;

    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    useImperativeHandle(
      ref,
      () => ({
        loadLevel(levelNumber: number, startPlaying: boolean) {
          sceneRef.current?.loadLevel(levelNumber, startPlaying);
        },
        setPlayMode(active: boolean, paused = false) {
          sceneRef.current?.setPlayMode(active, paused);
        },
        rewindOneStep() {
          return sceneRef.current?.rewindOneStep() ?? false;
        },
        resetLevel() {
          sceneRef.current?.resetCurrentLevel();
        },
        setSettings(settings: GameSettings) {
          sceneRef.current?.setSettings(settings);
        },
      }),
      [],
    );

    useEffect(() => {
      const parent = containerRef.current;
      if (!parent || gameRef.current) {
        return;
      }

      const scene = new MisprintScene();
      scene.setCallbacks({
        onSceneReady: () => onReadyRef.current?.(),
        onHudUpdate: (hud) => callbacksRef.current.onHudUpdate(hud),
        onPauseToggle: () => callbacksRef.current.onPauseToggle(),
        onOutcome: (outcome, hud) => callbacksRef.current.onOutcome(outcome, hud),
        onMuteToggle: () => callbacksRef.current.onMuteToggle(),
        onGameplayResumed: () => callbacksRef.current.onGameplayResumed?.(),
        onShowGuidesToggle: (showGuides) => callbacksRef.current.onShowGuidesToggle?.(showGuides),
      });
      scene.setSettings(settingsRef.current);
      sceneRef.current = scene;

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent,
        width: parent.clientWidth || 1280,
        height: parent.clientHeight || 720,
        backgroundColor: '#f4efe4',
        antialias: true,
        roundPixels: false,
        input: {
          activePointers: 2,
          touch: {
            capture: true,
          },
        },
        render: {
          antialias: true,
          powerPreference: 'high-performance',
          batchSize: 2048,
        },
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: [scene],
      };

      const game = new Phaser.Game(config);
      gameRef.current = game;

      return () => {
        sceneRef.current = null;
        game.destroy(true);
        gameRef.current = null;
      };
    }, []);

    return (
      <div
        ref={containerRef}
        data-testid="phaser-canvas-container"
        className="relative w-full h-full overflow-hidden touch-none"
      />
    );
  },
);
