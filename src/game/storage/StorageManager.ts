import type { GameSettings, LevelProgress } from '../types';
import { LEVELS } from '../levels/levels';

export const STORAGE_PROGRESS_KEY_V2 = 'misprint_progress_v2';
export const STORAGE_SETTINGS_KEY_V2 = 'misprint_settings_v2';
export const LEGACY_STORAGE_PROGRESS_KEY = 'misprint_progress_v1';
export const LEGACY_STORAGE_SETTINGS_KEY = 'misprint_settings_v1';

export const DEFAULT_PRODUCTION_SETTINGS: GameSettings = {
  muted: false,
  showGuides: true,
  reducedMotion: false,
  unlockAllLevels: false, // Production default: sequential level progression
};

export interface SavedProgressData {
  version: 2;
  highestUnlocked: number;
  levels: Record<string, LevelProgress>;
}

// In-memory fallback if localStorage is unavailable, disabled, or throws QuotaExceededError
let memoryProgressFallback: SavedProgressData | null = null;
let memorySettingsFallback: GameSettings | null = null;

function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = '__misprint_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates that an object conforms to LevelProgress structure.
 */
function isValidLevelProgress(val: unknown): val is LevelProgress {
  if (!val || typeof val !== 'object') return false;
  const p = val as Record<string, unknown>;
  return (
    typeof p.completed === 'boolean' &&
    (p.bestTimeMs === null || p.bestTimeMs === undefined || typeof p.bestTimeMs === 'number') &&
    (p.bestShifts === null || p.bestShifts === undefined || typeof p.bestShifts === 'number')
  );
}

/**
 * Loads and migrates saved progress data safely.
 */
export function loadSavedProgress(): SavedProgressData {
  const fallback: SavedProgressData = {
    version: 2,
    highestUnlocked: 1,
    levels: {},
  };

  if (!isLocalStorageAvailable()) {
    return memoryProgressFallback ?? fallback;
  }

  try {
    // 1. Try modern V2 schema
    const rawV2 = window.localStorage.getItem(STORAGE_PROGRESS_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (parsed && typeof parsed === 'object') {
        const rawHighest = Number(parsed.highestUnlocked);
        const highestUnlocked = Number.isFinite(rawHighest)
          ? Math.max(1, Math.min(LEVELS.length, rawHighest))
          : 1;

        const validatedLevels: Record<string, LevelProgress> = {};
        if (parsed.levels && typeof parsed.levels === 'object') {
          for (const [lvlId, lvlData] of Object.entries(parsed.levels)) {
            if (isValidLevelProgress(lvlData)) {
              validatedLevels[lvlId] = {
                completed: lvlData.completed,
                bestTimeMs: typeof lvlData.bestTimeMs === 'number' ? Math.max(0, lvlData.bestTimeMs) : null,
                bestShifts: typeof lvlData.bestShifts === 'number' ? Math.max(0, lvlData.bestShifts) : null,
              };
            }
          }
        }

        const validData: SavedProgressData = {
          version: 2,
          highestUnlocked,
          levels: validatedLevels,
        };
        memoryProgressFallback = validData;
        return validData;
      }
    }

    // 2. Migration from Legacy V1 schema
    const rawV1 = window.localStorage.getItem(LEGACY_STORAGE_PROGRESS_KEY);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      if (parsedV1 && typeof parsedV1 === 'object') {
        const rawHighest = Number(parsedV1.highestUnlocked);
        const highestUnlocked = Number.isFinite(rawHighest)
          ? Math.max(1, Math.min(LEVELS.length, rawHighest))
          : 1;

        const migratedLevels: Record<string, LevelProgress> = {};
        if (parsedV1.levels && typeof parsedV1.levels === 'object') {
          for (const [lvlId, lvlData] of Object.entries(parsedV1.levels)) {
            if (isValidLevelProgress(lvlData)) {
              migratedLevels[lvlId] = {
                completed: lvlData.completed,
                bestTimeMs: typeof lvlData.bestTimeMs === 'number' ? Math.max(0, lvlData.bestTimeMs) : null,
                bestShifts: typeof lvlData.bestShifts === 'number' ? Math.max(0, lvlData.bestShifts) : null,
              };
            }
          }
        }

        const migrated: SavedProgressData = {
          version: 2,
          highestUnlocked,
          levels: migratedLevels,
        };

        // Write to V2 and cache
        saveProgress(migrated);
        return migrated;
      }
    }
  } catch {
    // Corrupted JSON or parsing error - return safe fallback
    return fallback;
  }

  return fallback;
}

/**
 * Persists progress data safely.
 */
export function saveProgress(data: SavedProgressData): boolean {
  memoryProgressFallback = data;
  if (!isLocalStorageAvailable()) return false;

  try {
    window.localStorage.setItem(STORAGE_PROGRESS_KEY_V2, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resets saved progress data cleanly.
 */
export function resetSavedProgress(): SavedProgressData {
  const fresh: SavedProgressData = {
    version: 2,
    highestUnlocked: 1,
    levels: {},
  };
  memoryProgressFallback = fresh;

  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.removeItem(STORAGE_PROGRESS_KEY_V2);
      window.localStorage.removeItem(LEGACY_STORAGE_PROGRESS_KEY);
    } catch {
      // Ignore
    }
  }

  return fresh;
}

/**
 * Loads game settings with safe defaults and schema migration.
 */
export function loadSavedSettings(): GameSettings {
  if (!isLocalStorageAvailable()) {
    return memorySettingsFallback ?? DEFAULT_PRODUCTION_SETTINGS;
  }

  try {
    // 1. Try V2 key
    const rawV2 = window.localStorage.getItem(STORAGE_SETTINGS_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (parsed && typeof parsed === 'object') {
        const settings: GameSettings = {
          muted: Boolean(parsed.muted),
          showGuides: parsed.showGuides !== false,
          reducedMotion: Boolean(parsed.reducedMotion),
          unlockAllLevels: Boolean(parsed.unlockAllLevels),
        };
        memorySettingsFallback = settings;
        return settings;
      }
    }

    // 2. Migrate legacy V1 key
    const rawV1 = window.localStorage.getItem(LEGACY_STORAGE_SETTINGS_KEY);
    if (rawV1) {
      const parsed = JSON.parse(rawV1);
      if (parsed && typeof parsed === 'object') {
        // In V1, unlockAllLevels defaulted to true in code. For production V2 migration,
        // we enforce unlockAllLevels: false unless specifically migrated.
        const migrated: GameSettings = {
          muted: Boolean(parsed.muted),
          showGuides: parsed.showGuides !== false,
          reducedMotion: Boolean(parsed.reducedMotion),
          unlockAllLevels: false,
        };
        saveSettings(migrated);
        return migrated;
      }
    }
  } catch {
    return DEFAULT_PRODUCTION_SETTINGS;
  }

  return DEFAULT_PRODUCTION_SETTINGS;
}

/**
 * Persists game settings safely.
 */
export function saveSettings(settings: GameSettings): boolean {
  memorySettingsFallback = settings;
  if (!isLocalStorageAvailable()) return false;

  try {
    window.localStorage.setItem(STORAGE_SETTINGS_KEY_V2, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
