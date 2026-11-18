import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PRODUCTION_SETTINGS,
  LEGACY_STORAGE_PROGRESS_KEY,
  LEGACY_STORAGE_SETTINGS_KEY,
  STORAGE_PROGRESS_KEY_V2,
  STORAGE_SETTINGS_KEY_V2,
  loadSavedProgress,
  loadSavedSettings,
  resetSavedProgress,
  saveProgress,
  saveSettings,
} from './StorageManager';

class MockStorage {
  private store: Record<string, string> = {};
  get length(): number {
    return Object.keys(this.store).length;
  }
  clear(): void {
    this.store = {};
  }
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

const mockStorage = new MockStorage();

// Ensure window & localStorage are available in Node test runner
(globalThis as Record<string, unknown>).window = {
  localStorage: mockStorage,
};
(globalThis as Record<string, unknown>).localStorage = mockStorage;

describe('StorageManager & Progression Migration', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('1. provides production-safe defaults with unlockAllLevels: false', () => {
    const settings = loadSavedSettings();
    expect(settings.unlockAllLevels).toBe(false);
    expect(settings.muted).toBe(false);
    expect(settings.showGuides).toBe(true);
    expect(settings.reducedMotion).toBe(false);
    expect(DEFAULT_PRODUCTION_SETTINGS.unlockAllLevels).toBe(false);
  });

  it('2. defaults new players to highestUnlocked: 1 with empty levels', () => {
    const progress = loadSavedProgress();
    expect(progress.version).toBe(2);
    expect(progress.highestUnlocked).toBe(1);
    expect(progress.levels).toEqual({});
  });

  it('3. safely loads and saves V2 progress data with best time and shift records', () => {
    saveProgress({
      version: 2,
      highestUnlocked: 3,
      levels: {
        'level-1': { completed: true, bestTimeMs: 4200, bestShifts: 1 },
        'level-2': { completed: true, bestTimeMs: 8900, bestShifts: 2 },
      },
    });

    const loaded = loadSavedProgress();
    expect(loaded.version).toBe(2);
    expect(loaded.highestUnlocked).toBe(3);
    expect(loaded.levels['level-1']?.completed).toBe(true);
    expect(loaded.levels['level-1']?.bestTimeMs).toBe(4200);
    expect(loaded.levels['level-1']?.bestShifts).toBe(1);
  });

  it('4. seamlessly migrates legacy V1 progress to V2 schema', () => {
    const legacyV1 = {
      highestUnlocked: 4,
      levels: {
        'level-1': { completed: true, bestTimeMs: 5100, bestShifts: 1 },
        'level-2': { completed: true, bestTimeMs: 7600, bestShifts: 2 },
        'level-3': { completed: true, bestTimeMs: 12400, bestShifts: 3 },
      },
    };
    localStorage.setItem(LEGACY_STORAGE_PROGRESS_KEY, JSON.stringify(legacyV1));

    const migrated = loadSavedProgress();
    expect(migrated.version).toBe(2);
    expect(migrated.highestUnlocked).toBe(4);
    expect(migrated.levels['level-3']?.completed).toBe(true);
    expect(migrated.levels['level-3']?.bestTimeMs).toBe(12400);

    // Verify V2 was written to storage
    const rawV2 = localStorage.getItem(STORAGE_PROGRESS_KEY_V2);
    expect(rawV2).toBeTruthy();
  });

  it('5. migrates legacy V1 settings and sanitizes unlockAllLevels to false for production', () => {
    const legacySettings = {
      muted: true,
      showGuides: false,
      reducedMotion: true,
      unlockAllLevels: true, // Old default from V1
    };
    localStorage.setItem(LEGACY_STORAGE_SETTINGS_KEY, JSON.stringify(legacySettings));

    const migrated = loadSavedSettings();
    expect(migrated.muted).toBe(true);
    expect(migrated.showGuides).toBe(false);
    expect(migrated.reducedMotion).toBe(true);
    expect(migrated.unlockAllLevels).toBe(false); // Overridden to false

    const rawV2 = localStorage.getItem(STORAGE_SETTINGS_KEY_V2);
    expect(rawV2).toBeTruthy();
  });

  it('6. handles corrupted JSON in storage without throwing', () => {
    localStorage.setItem(STORAGE_PROGRESS_KEY_V2, '{ invalid json @@#$');
    localStorage.setItem(STORAGE_SETTINGS_KEY_V2, 'not a json');

    const progress = loadSavedProgress();
    expect(progress.highestUnlocked).toBe(1);

    const settings = loadSavedSettings();
    expect(settings.unlockAllLevels).toBe(false);
  });

  it('7. cleanly resets progress removing both V1 and V2 keys', () => {
    saveProgress({
      version: 2,
      highestUnlocked: 5,
      levels: { 'level-1': { completed: true, bestTimeMs: 3000, bestShifts: 1 } },
    });
    localStorage.setItem(LEGACY_STORAGE_PROGRESS_KEY, '{"highestUnlocked": 5}');

    const fresh = resetSavedProgress();
    expect(fresh.highestUnlocked).toBe(1);
    expect(fresh.levels).toEqual({});
    expect(localStorage.getItem(STORAGE_PROGRESS_KEY_V2)).toBeNull();
    expect(localStorage.getItem(LEGACY_STORAGE_PROGRESS_KEY)).toBeNull();
  });
});
