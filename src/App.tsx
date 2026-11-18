import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import {
  LevelSelectModal,
  OutcomeModal,
  PauseModal,
  SettingsModal,
} from './components/MenuModals';
import { TitleEmblem } from './components/TitleEmblem';
import { LEVELS, getLevelByNumber } from './game/levels/levels';
import { PhaserGame, type PhaserGameHandle } from './game/PhaserGame';
import type {
  AppScreen,
  GameHudState,
  GameSettings,
  LevelProgress,
} from './game/types';

const STORAGE_PROGRESS_KEY = 'misprint_progress_v1';
const STORAGE_SETTINGS_KEY = 'misprint_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  muted: false,
  showGuides: true,
  reducedMotion: false,
  unlockAllLevels: true,
};

interface SavedProgress {
  highestUnlocked: number;
  levels: Record<string, LevelProgress>;
}

function loadSavedProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_PROGRESS_KEY);
    if (!raw) return { highestUnlocked: 1, levels: {} };
    const parsed = JSON.parse(raw) as SavedProgress;
    return {
      highestUnlocked: Math.max(1, Math.min(LEVELS.length, parsed.highestUnlocked || 1)),
      levels: parsed.levels || {},
    };
  } catch {
    return { highestUnlocked: 1, levels: {} };
  }
}

function loadSavedSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function createPlaceholderHud(levelNumber: number): GameHudState {
  const lvl = getLevelByNumber(levelNumber);
  return {
    levelId: lvl.id,
    levelNumber: lvl.number,
    levelTitle: lvl.title,
    instruction: lvl.instruction,
    elapsedMs: 0,
    shiftCount: 0,
    rewindCount: 0,
    rewindAvailable: 0,
    activeConnections: 0,
    totalSafeConnections: lvl.connections.filter((c) => !c.isHazardous).length,
    hazardConnections: 0,
    dotState: 'walking',
    status: 'playing',
    failureReason: null,
    ghostDelta: {
      x: Math.round(lvl.initialGhostOffset.x - lvl.initialInkOffset.x),
      y: Math.round(lvl.initialGhostOffset.y - lvl.initialInkOffset.y),
    },
    parShifts: lvl.parShifts,
  };
}

export default function App() {
  const { isAutostart, initialLevelNumber } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { isAutostart: false, initialLevelNumber: 1 };
    }
    const param = new URLSearchParams(window.location.search).get('autostart');
    if (param === 'test') {
      return { isAutostart: true, initialLevelNumber: 0 };
    }
    if (param) {
      const parsed = Number.parseInt(param, 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= LEVELS.length) {
        return { isAutostart: true, initialLevelNumber: parsed };
      }
    }
    return { isAutostart: false, initialLevelNumber: 1 };
  }, []);

  const gameRef = useRef<PhaserGameHandle | null>(null);
  const [screen, setScreen] = useState<AppScreen>(isAutostart ? 'playing' : 'title');
  const [returnScreenFromSettings, setReturnScreenFromSettings] = useState<AppScreen>('title');
  const [currentLevel, setCurrentLevel] = useState<number>(initialLevelNumber);
  const [settings, setSettings] = useState<GameSettings>(() => loadSavedSettings());
  const [progress, setProgress] = useState<SavedProgress>(() => loadSavedProgress());
  const [hud, setHud] = useState<GameHudState>(() => createPlaceholderHud(initialLevelNumber));
  const [outcome, setOutcome] = useState<'won' | 'lost' | null>(null);

  // Sync document.body.dataset.state with game state machine
  useEffect(() => {
    let bodyState = 'title';
    if (screen === 'playing') bodyState = 'playing';
    else if (screen === 'paused') bodyState = 'paused';
    else if (screen === 'complete' || screen === 'failed') bodyState = 'gameover';
    else if (screen === 'levels' || screen === 'menu' || screen === 'settings') bodyState = 'menu';
    document.body.dataset.state = bodyState;
  }, [screen]);

  // Persist settings & sync to Phaser
  const handleUpdateSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    gameRef.current?.setSettings(next);
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota issues
    }
  }, []);

  const startLevel = useCallback((levelNumber: number) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.dataset.state = 'playing';
    setCurrentLevel(levelNumber);
    setOutcome(null);
    setHud(createPlaceholderHud(levelNumber));
    setScreen('playing');
    gameRef.current?.loadLevel(levelNumber, true);
  }, []);

  // Autostart once Phaser is ready
  const handlePhaserReady = useCallback(() => {
    gameRef.current?.setSettings(settings);
    if (isAutostart) {
      gameRef.current?.loadLevel(initialLevelNumber, true);
    }
  }, [initialLevelNumber, isAutostart, settings]);

  // Title-screen Enter / Space shortcut
  useEffect(() => {
    if (screen !== 'title') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startLevel(progress.highestUnlocked > 1 ? 1 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, startLevel, progress.highestUnlocked]);

  const handlePauseToggle = useCallback(() => {
    setScreen((prev) => {
      if (prev === 'playing') {
        gameRef.current?.setPlayMode(true, true);
        return 'paused';
      }
      if (prev === 'paused') {
        gameRef.current?.setPlayMode(true, false);
        return 'playing';
      }
      return prev;
    });
  }, []);

  const handleMuteToggle = useCallback(() => {
    handleUpdateSettings({ ...settings, muted: !settings.muted });
  }, [handleUpdateSettings, settings]);

  const handleOutcome = useCallback(
    (result: 'won' | 'lost', finalHud: GameHudState) => {
      setHud(finalHud);
      setOutcome(result);
      setScreen(result === 'won' ? 'complete' : 'failed');

      if (result === 'won' && finalHud.levelNumber >= 1) {
        setProgress((prev) => {
          const existing = prev.levels[finalHud.levelId];
          const bestTimeMs =
            existing?.bestTimeMs != null
              ? Math.min(existing.bestTimeMs, finalHud.elapsedMs)
              : finalHud.elapsedMs;
          const bestShifts =
            existing?.bestShifts != null
              ? Math.min(existing.bestShifts, finalHud.shiftCount)
              : finalHud.shiftCount;
          const nextUnlocked = Math.min(
            LEVELS.length,
            Math.max(prev.highestUnlocked, finalHud.levelNumber + 1),
          );
          const updated: SavedProgress = {
            highestUnlocked: nextUnlocked,
            levels: {
              ...prev.levels,
              [finalHud.levelId]: {
                completed: true,
                bestTimeMs,
                bestShifts,
              },
            },
          };
          try {
            localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(updated));
          } catch {
            // Ignore storage errors
          }
          return updated;
        });
      }
    },
    [],
  );

  const handleRewind = useCallback(() => {
    const ok = gameRef.current?.rewindOneStep();
    if (ok) {
      setOutcome(null);
      setScreen('playing');
      gameRef.current?.setPlayMode(true, false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setOutcome(null);
    setScreen('playing');
    gameRef.current?.resetLevel();
  }, []);

  const handleReturnTitle = useCallback(() => {
    setOutcome(null);
    setScreen('title');
    gameRef.current?.loadLevel(1, false);
  }, []);

  const handleOpenLevelSelect = useCallback(() => {
    setOutcome(null);
    setScreen('levels');
    gameRef.current?.setPlayMode(false, false);
  }, []);

  const handleResetProgress = useCallback(() => {
    const empty: SavedProgress = { highestUnlocked: 1, levels: {} };
    setProgress(empty);
    try {
      localStorage.removeItem(STORAGE_PROGRESS_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const handleGameplayResumed = useCallback(() => {
    setOutcome(null);
    setScreen('playing');
  }, []);

  const handleShowGuidesToggle = useCallback(
    (showGuides: boolean) => {
      handleUpdateSettings({ ...settings, showGuides });
    },
    [handleUpdateSettings, settings],
  );

  const sceneCallbacks = useMemo(
    () => ({
      onHudUpdate: setHud,
      onPauseToggle: handlePauseToggle,
      onOutcome: handleOutcome,
      onMuteToggle: handleMuteToggle,
      onGameplayResumed: handleGameplayResumed,
      onShowGuidesToggle: handleShowGuidesToggle,
    }),
    [
      handlePauseToggle,
      handleOutcome,
      handleMuteToggle,
      handleGameplayResumed,
      handleShowGuidesToggle,
    ],
  );

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden bg-[#f4efe4]">
      {/* Dedicated Phaser 3 Canvas Mount (Sibling to UI overlays) */}
      <PhaserGame
        ref={gameRef}
        callbacks={sceneCallbacks}
        initialSettings={settings}
        onReady={handlePhaserReady}
      />

      {/* Title Screen */}
      {screen === 'title' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-end sm:justify-between pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] lg:p-12 pointer-events-none">
          <div className="w-full max-w-md sm:max-w-[330px] lg:max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-[#faf7f0]/95 border-2 border-[#1e2024] rounded-md p-4 [@media(max-height:500px)]:p-3.5 lg:p-8 shadow-md pointer-events-auto max-sm:mb-2 sm:my-auto">
            <TitleEmblem />
            <p className="mt-2.5 [@media(max-height:500px)]:mt-2 lg:mt-4 text-sm [@media(max-height:500px)]:text-sm lg:text-lg text-[#1e2024] leading-snug lg:leading-relaxed font-medium">
              The world is printed wrong. Fix it before it moves.
            </p>
            <p className="mt-1 [@media(max-height:500px)]:mt-1 text-xs lg:text-sm text-[#555961] leading-snug lg:leading-relaxed">
              Shift the translucent Ghost sheet over the Ink press so registration marks align
              and Dot can deliver the parcel.
            </p>

            <div className="mt-4 [@media(max-height:500px)]:mt-3 lg:mt-7 flex flex-col gap-2">
              <button
                type="button"
                data-start="true"
                onClick={() => startLevel(1)}
                className="w-full min-h-[44px] lg:min-h-[46px] px-5 py-2.5 bg-[#c93b2b] text-[#faf7f0] font-semibold text-base rounded-md hover:bg-[#b13224] transition-colors cursor-pointer whitespace-nowrap"
              >
                Start Press
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleOpenLevelSelect}
                  className="min-h-[44px] px-4 py-2 bg-[#ebe3d3] border border-[#1e2024]/30 text-[#1e2024] font-medium text-sm rounded-md hover:bg-[#e1d7c3] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Proof Index
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReturnScreenFromSettings('title');
                    setScreen('settings');
                  }}
                  className="min-h-[44px] px-4 py-2 bg-[#faf7f0] border border-[#1e2024]/30 text-[#1e2024] font-medium text-sm rounded-md hover:bg-[#ebe3d3] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Settings
                </button>
              </div>
            </div>
          </div>

          <p className="hidden lg:block text-xs text-[#555961] text-left whitespace-nowrap truncate">
            Drag Sheet · Arrow Keys Nudge · Z Rewind · Enter Start
          </p>
          <p className="lg:hidden [@media(max-height:500px)]:hidden text-xs text-[#555961] text-center sm:text-left whitespace-nowrap truncate">
            Touch &amp; Drag Sheet to Align Marks
          </p>
        </div>
      )}

      {/* Active Gameplay HUD */}
      {screen === 'playing' && (
        <GameHud
          hud={hud}
          muted={settings.muted}
          onRewind={handleRewind}
          onReset={handleReset}
          onMuteToggle={handleMuteToggle}
          onPause={handlePauseToggle}
        />
      )}

      {/* Level Selection Screen */}
      {screen === 'levels' && (
        <LevelSelectModal
          progress={progress.levels}
          highestUnlocked={progress.highestUnlocked}
          unlockAll={settings.unlockAllLevels}
          onSelectLevel={startLevel}
          onBack={handleReturnTitle}
        />
      )}

      {/* Pause Modal */}
      {screen === 'paused' && (
        <PauseModal
          levelTitle={hud.levelTitle}
          levelNumber={hud.levelNumber}
          onResume={handlePauseToggle}
          onRestart={handleReset}
          onLevelSelect={handleOpenLevelSelect}
          onSettings={() => {
            setReturnScreenFromSettings('paused');
            setScreen('settings');
          }}
          onTitle={handleReturnTitle}
        />
      )}

      {/* Level Completion / Failure Modal */}
      {(screen === 'complete' || screen === 'failed') && outcome && (
        <OutcomeModal
          outcome={outcome}
          hud={hud}
          hasNextLevel={currentLevel < LEVELS.length}
          onNextLevel={() => startLevel(currentLevel === 0 ? 1 : currentLevel + 1)}
          onReplay={handleReset}
          onRewind={handleRewind}
          onLevelSelect={handleOpenLevelSelect}
        />
      )}

      {/* Settings Modal */}
      {screen === 'settings' && (
        <SettingsModal
          settings={settings}
          onUpdate={handleUpdateSettings}
          onResetProgress={handleResetProgress}
          onClose={() => setScreen(returnScreenFromSettings)}
        />
      )}
    </main>
  );
}
