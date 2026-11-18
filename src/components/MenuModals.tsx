import { ArrowLeft, Check, Lock, Play, RotateCcw, Undo2 } from 'lucide-react';
import { LEVELS } from '../game/levels/levels';
import type { GameHudState, GameSettings, LevelProgress } from '../game/types';
import { formatTimeMs } from './GameHud';

interface PauseModalProps {
  levelTitle: string;
  levelNumber: number;
  onResume: () => void;
  onRestart: () => void;
  onLevelSelect: () => void;
  onSettings: () => void;
  onTitle: () => void;
}

export function PauseModal({
  levelTitle,
  levelNumber,
  onResume,
  onRestart,
  onLevelSelect,
  onSettings,
  onTitle,
}: PauseModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game Paused"
      className="fixed inset-0 z-20 flex items-center justify-center bg-[#1e2024]/45 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]"
    >
      <div className="w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto modal-scroll-area bg-[#faf7f0] border-2 border-[#1e2024] rounded-md p-5 sm:p-6 shadow-lg">
        <p className="text-xs font-mono-tech text-[#555961]">
          {levelNumber === 0 ? 'Sandbox 00' : `Proof ${String(levelNumber).padStart(2, '0')}`} · {levelTitle}
        </p>
        <h2 className="font-display text-3xl font-bold text-[#1e2024] mt-1">Press Halted</h2>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[44px] px-4 py-2.5 bg-[#c93b2b] text-[#faf7f0] font-semibold text-sm rounded-md hover:bg-[#b13224] transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Play className="w-4 h-4" />
            <span>Resume Proof</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full min-h-[44px] px-4 py-2.5 bg-[#ebe3d3] border border-[#1e2024]/30 text-[#1e2024] font-medium text-sm rounded-md hover:bg-[#e1d7c3] transition-colors cursor-pointer whitespace-nowrap"
          >
            Restart Proof
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onLevelSelect}
              className="min-h-[44px] px-3 py-2 bg-[#faf7f0] border border-[#1e2024]/30 text-[#1e2024] font-medium text-sm rounded-md hover:bg-[#ebe3d3] transition-colors cursor-pointer whitespace-nowrap"
            >
              Proof Index
            </button>
            <button
              type="button"
              onClick={onSettings}
              className="min-h-[44px] px-3 py-2 bg-[#faf7f0] border border-[#1e2024]/30 text-[#1e2024] font-medium text-sm rounded-md hover:bg-[#ebe3d3] transition-colors cursor-pointer whitespace-nowrap"
            >
              Settings
            </button>
          </div>

          <button
            type="button"
            onClick={onTitle}
            className="w-full min-h-[40px] px-4 py-2 text-[#555961] hover:text-[#1e2024] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}

interface OutcomeModalProps {
  outcome: 'won' | 'lost';
  hud: GameHudState;
  hasNextLevel: boolean;
  onNextLevel: () => void;
  onReplay: () => void;
  onRewind: () => void;
  onLevelSelect: () => void;
}

export function OutcomeModal({
  outcome,
  hud,
  hasNextLevel,
  onNextLevel,
  onReplay,
  onRewind,
  onLevelSelect,
}: OutcomeModalProps) {
  const isVictory = outcome === 'won';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isVictory ? 'Proof Delivered' : 'Misprint Error'}
      className="fixed inset-0 z-20 flex items-center justify-center bg-[#1e2024]/45 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]"
    >
      <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto modal-scroll-area bg-[#faf7f0] border-2 border-[#1e2024] rounded-md p-5 sm:p-6 shadow-lg">
        <p className="text-xs font-mono-tech text-[#555961]">
          {hud.levelNumber === 0 ? 'Sandbox 00' : `Proof ${String(hud.levelNumber).padStart(2, '0')}`} · {hud.levelTitle}
        </p>

        <h2 className="font-display text-3xl font-bold text-[#1e2024] mt-1">
          {isVictory ? 'Parcel Delivered' : 'Misprint Jam'}
        </h2>

        <p className="text-sm text-[#555961] mt-2">
          {isVictory
            ? 'Both sheets locked cleanly and Dot reached the postbox.'
            : hud.failureReason ?? 'Dot could not complete the route.'}
        </p>

        {/* Tabular Metrics */}
        <div className="mt-5 grid grid-cols-3 gap-3 border-y border-[#1e2024]/15 py-3.5">
          <div>
            <div className="text-xs text-[#555961]">Time</div>
            <div className="font-mono-tech text-lg font-semibold text-[#1e2024]">
              {formatTimeMs(hud.elapsedMs)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#555961]">Shifts</div>
            <div className="font-mono-tech text-lg font-semibold text-[#1e2024]">
              {hud.shiftCount} / {hud.parShifts}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#555961]">Rewinds</div>
            <div className="font-mono-tech text-lg font-semibold text-[#1e2024]">
              {hud.rewindCount}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          {isVictory ? (
            <>
              {hasNextLevel ? (
                <button
                  type="button"
                  data-start="true"
                  onClick={onNextLevel}
                  className="w-full min-h-[44px] px-4 py-2.5 bg-[#c93b2b] text-[#faf7f0] font-semibold text-sm rounded-md hover:bg-[#b13224] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {hud.levelNumber === 0 ? 'Start Proof 01' : 'Next Proof'}
                </button>
              ) : (
                <button
                  type="button"
                  data-start="true"
                  onClick={onLevelSelect}
                  className="w-full min-h-[44px] px-4 py-2.5 bg-[#3a6b52] text-[#faf7f0] font-semibold text-sm rounded-md hover:bg-[#2f5843] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Chapter Complete — View Proofs
                </button>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onReplay}
                  className="min-h-[44px] px-3 py-2 bg-[#ebe3d3] border border-[#1e2024]/30 text-[#1e2024] font-medium text-sm rounded-md hover:bg-[#e1d7c3] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Replay Proof
                </button>
                <button
                  type="button"
                  onClick={onLevelSelect}
                  className="min-h-[44px] px-3 py-2 bg-[#faf7f0] border border-[#1e2024]/30 text-[#1e2024] font-medium text-sm rounded-md hover:bg-[#ebe3d3] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Proof Index
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onRewind}
                disabled={hud.rewindAvailable === 0}
                className="w-full min-h-[44px] px-4 py-2.5 bg-[#2f5485] text-[#faf7f0] font-semibold text-sm rounded-md hover:bg-[#25446d] disabled:opacity-45 transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Undo2 className="w-4 h-4" />
                <span>Rewind Last Shift</span>
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-start="true"
                  onClick={onReplay}
                  className="min-h-[44px] px-3 py-2 bg-[#c93b2b] text-[#faf7f0] font-semibold text-sm rounded-md hover:bg-[#b13224] transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Try Again</span>
                </button>
                <button
                  type="button"
                  onClick={onLevelSelect}
                  className="min-h-[44px] px-3 py-2 bg-[#faf7f0] border border-[#1e2024]/30 text-[#1e2024] font-medium text-sm rounded-md hover:bg-[#ebe3d3] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Proof Index
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface LevelSelectModalProps {
  progress: Record<string, LevelProgress>;
  highestUnlocked: number;
  unlockAll: boolean;
  onSelectLevel: (levelNumber: number) => void;
  onBack: () => void;
}

export function LevelSelectModal({
  progress,
  highestUnlocked,
  unlockAll,
  onSelectLevel,
  onBack,
}: LevelSelectModalProps) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#f4efe4]/92 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto modal-scroll-area bg-[#faf7f0] border-2 border-[#1e2024] rounded-md p-5 sm:p-8 shadow-lg my-auto">
        <div className="flex items-center justify-between gap-4 border-b border-[#1e2024]/15 pb-4">
          <div>
            <p className="text-xs font-mono-tech text-[#2f5485]">Chapter 1 · First Folio</p>
            <h2 className="font-display text-3xl font-bold text-[#1e2024] mt-0.5">
              Select Proof Sheet
            </h2>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3.5 py-2 bg-[#ebe3d3] border border-[#1e2024]/30 text-[#1e2024] text-sm font-medium rounded-md hover:bg-[#e1d7c3] transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>

        <div className="mt-5 divide-y divide-[#1e2024]/12">
          <div className="pb-3.5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="font-mono-tech text-xs text-[#2f5485]">00</span>
                <h3 className="font-display text-lg font-semibold text-[#1e2024] truncate">
                  Registration Test
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-[#555961] mt-0.5">
                Interactive two-layer sandbox: drag Ink or Ghost, inspect anchor compatibility and live distances.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectLevel(0)}
              className="min-h-[44px] px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap shrink-0 bg-[#2f5485] text-[#faf7f0] hover:bg-[#25446d] cursor-pointer"
            >
              Open Sandbox
            </button>
          </div>
          {LEVELS.map((lvl) => {
            const p = progress[lvl.id];
            const unlocked = unlockAll || lvl.number <= highestUnlocked;
            const completed = Boolean(p?.completed);

            const chapterTitle =
              lvl.number === 1
                ? 'Chapter 1 · The First Proofs'
                : lvl.number === 4
                  ? 'Chapter 2 · Dangerous Impressions'
                  : lvl.number === 7
                    ? 'Chapter 3 · Master Folio'
                    : null;

            return (
              <div key={lvl.id}>
                {chapterTitle && (
                  <div className="pt-4 pb-2 text-xs font-mono-tech font-bold uppercase tracking-wider text-[#2f5485] border-t border-[#1e2024]/15 mt-2">
                    {chapterTitle}
                  </div>
                )}
                <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono-tech text-xs text-[#555961]">
                      {String(lvl.number).padStart(2, '0')}
                    </span>
                    <h3 className="font-display text-lg font-semibold text-[#1e2024] truncate">
                      {lvl.title}
                    </h3>
                    {completed && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#3a6b52]">
                        <Check className="w-3.5 h-3.5" />
                        <span>Delivered</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-[#555961] mt-0.5">{lvl.subtitle}</p>
                  {completed && p?.bestTimeMs != null && (
                    <div className="text-xs font-mono-tech text-[#555961] mt-1">
                      Best {formatTimeMs(p.bestTimeMs)} · {p.bestShifts ?? '-'} shifts
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!unlocked}
                  onClick={() => onSelectLevel(lvl.number)}
                  className={`min-h-[44px] px-4 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    unlocked
                      ? 'bg-[#1e2024] text-[#faf7f0] hover:bg-[#c93b2b] cursor-pointer'
                      : 'bg-[#ebe3d3] text-[#555961]/60 border border-[#1e2024]/15 cursor-not-allowed'
                  }`}
                >
                  {unlocked ? (
                    <span>Open Proof</span>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Locked</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

interface SettingsModalProps {
  settings: GameSettings;
  onUpdate: (next: GameSettings) => void;
  onResetProgress: () => void;
  onClose: () => void;
}

export function SettingsModal({
  settings,
  onUpdate,
  onResetProgress,
  onClose,
}: SettingsModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#1e2024]/45 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]"
    >
      <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto modal-scroll-area bg-[#faf7f0] border-2 border-[#1e2024] rounded-md p-5 sm:p-6 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#1e2024]/15 pb-3">
          <h2 className="font-display text-2xl font-bold text-[#1e2024]">Press Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-3 py-1.5 text-sm font-medium text-[#1e2024] bg-[#ebe3d3] rounded-md hover:bg-[#e1d7c3] cursor-pointer whitespace-nowrap"
          >
            Done
          </button>
        </div>

        <div className="mt-4 divide-y divide-[#1e2024]/12">
          <label className="py-3 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-[#1e2024]">Sound Effects</div>
              <div className="text-xs text-[#555961]">Paper slides, stamps, and courier steps</div>
            </div>
            <input
              type="checkbox"
              checked={!settings.muted}
              onChange={(e) => onUpdate({ ...settings, muted: !e.target.checked })}
              className="w-5 h-5 accent-[#c93b2b] cursor-pointer"
            />
          </label>

          <label className="py-3 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-[#1e2024]">Tolerance Guides</div>
              <div className="text-xs text-[#555961]">Show registration tolerance circles</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showGuides}
              onChange={(e) => onUpdate({ ...settings, showGuides: e.target.checked })}
              className="w-5 h-5 accent-[#2f5485] cursor-pointer"
            />
          </label>

          <label className="py-3 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-[#1e2024]">Reduced Motion</div>
              <div className="text-xs text-[#555961]">Disable camera shake and particle bursts</div>
            </div>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => onUpdate({ ...settings, reducedMotion: e.target.checked })}
              className="w-5 h-5 accent-[#2f5485] cursor-pointer"
            />
          </label>

          <label className="py-3 flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-[#1e2024]">Unlock All 9 Proofs</div>
              <div className="text-xs text-[#555961]">Jump directly to any campaign proof</div>
            </div>
            <input
              type="checkbox"
              checked={settings.unlockAllLevels}
              onChange={(e) => onUpdate({ ...settings, unlockAllLevels: e.target.checked })}
              className="w-5 h-5 accent-[#2f5485] cursor-pointer"
            />
          </label>
        </div>

        <div className="mt-4 pt-3 border-t border-[#1e2024]/15 flex justify-end">
          <button
            type="button"
            onClick={onResetProgress}
            className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-[#c93b2b] hover:bg-[#c93b2b]/10 rounded-md transition-colors cursor-pointer"
          >
            Clear Saved Progress
          </button>
        </div>
      </div>
    </div>
  );
}
