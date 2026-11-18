import { Pause, RotateCcw, Undo2, Volume2, VolumeX, CheckCircle2, AlertTriangle, CircleDashed } from 'lucide-react';
import type { GameHudState } from '../game/types';

interface GameHudProps {
  hud: GameHudState;
  muted: boolean;
  onRewind: () => void;
  onReset: () => void;
  onMuteToggle: () => void;
  onPause: () => void;
}

export function formatTimeMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function GameHud({
  hud,
  muted,
  onRewind,
  onReset,
  onMuteToggle,
  onPause,
}: GameHudProps) {
  const hasHazard = hud.hazardConnections > 0;
  const allSafeConnected =
    hud.totalSafeConnections > 0 && hud.activeConnections >= hud.totalSafeConnections;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between pt-[max(0.65rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.65rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] sm:pt-[max(1rem,env(safe-area-inset-top))] sm:pr-[max(1.25rem,env(safe-area-inset-right))] sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pl-[max(1.25rem,env(safe-area-inset-left))]">
      {/* Top Perimeter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
        {/* Action Controls (top-right on desktop, top row right-aligned on mobile) */}
        <div className="pointer-events-auto order-1 sm:order-2 self-end sm:self-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRewind();
            }}
            disabled={hud.rewindAvailable === 0}
            aria-label="Rewind last shift (Z)"
            title="Rewind (Z)"
            className="min-w-[44px] min-h-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-md bg-[#faf7f0] border border-[#1e2024]/30 text-[#1e2024] hover:bg-[#ebe3d3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Undo2 className="w-4 h-4" />
            <span className="hidden md:inline text-xs font-medium">Rewind</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onReset();
            }}
            aria-label="Reset proof (R)"
            title="Reset (R)"
            className="min-w-[44px] min-h-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-md bg-[#faf7f0] border border-[#1e2024]/30 text-[#1e2024] hover:bg-[#ebe3d3] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden md:inline text-xs font-medium">Reset</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onMuteToggle();
            }}
            aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
            title={muted ? 'Unmute (M)' : 'Mute (M)'}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md bg-[#faf7f0] border border-[#1e2024]/30 text-[#1e2024] hover:bg-[#ebe3d3] transition-colors cursor-pointer shrink-0"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Pause game (P or Esc)"
            title="Pause (P / Esc)"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md bg-[#faf7f0] border border-[#1e2024]/30 text-[#1e2024] hover:bg-[#ebe3d3] transition-colors cursor-pointer shrink-0"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>

        {/* Proof Identity & Registration Status (non-interactive so sheet drags pass through) */}
        <div className="pointer-events-none order-2 sm:order-1 bg-[#faf7f0]/95 border border-[#1e2024]/25 rounded-md px-3 py-1.5 sm:px-3.5 sm:py-2 shadow-sm w-full sm:w-auto sm:max-w-md">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-display text-sm sm:text-base md:text-lg font-semibold text-[#1e2024] whitespace-nowrap">
              {hud.levelNumber === 0
                ? 'Sandbox 00'
                : `Proof ${String(hud.levelNumber).padStart(2, '0')}`}{' '}
              · {hud.levelTitle}
            </span>
            <span className="text-[#555961]" aria-hidden="true">·</span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
                hasHazard
                  ? 'text-[#c93b2b]'
                  : allSafeConnected
                    ? 'text-[#3a6b52]'
                    : 'text-[#2f5485]'
              }`}
            >
              {hasHazard ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Trap Active</span>
                </>
              ) : allSafeConnected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Registered {hud.activeConnections}/{hud.totalSafeConnections}
                  </span>
                </>
              ) : (
                <>
                  <CircleDashed className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Aligned {hud.activeConnections}/{hud.totalSafeConnections}
                  </span>
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-[#555961] mt-0.5 leading-snug line-clamp-2 sm:line-clamp-none">
            {hud.instruction}
          </p>
        </div>
      </div>

      {/* Bottom Perimeter Strip: Quiet Printmaker Metrics */}
      <div className="flex items-end justify-between gap-4">
        <div className="bg-[#faf7f0]/90 border border-[#1e2024]/20 rounded-md px-3 py-1.5 flex items-center gap-3 text-xs text-[#555961] font-mono-tech">
          <span>
            Δ {hud.ghostDelta.x >= 0 ? `+${hud.ghostDelta.x}` : hud.ghostDelta.x},{' '}
            {hud.ghostDelta.y >= 0 ? `+${hud.ghostDelta.y}` : hud.ghostDelta.y}
          </span>
          <span aria-hidden="true">·</span>
          <span>Shifts {hud.shiftCount}</span>
          <span aria-hidden="true">·</span>
          <span>{formatTimeMs(hud.elapsedMs)}</span>
        </div>

        <div className="hidden lg:block text-xs text-[#555961] bg-[#faf7f0]/85 px-2.5 py-1 rounded border border-[#1e2024]/15">
          Drag Sheet · Arrow Keys Nudge · Z Rewind · R Reset · P Pause
        </div>
      </div>
    </div>
  );
}
