# AR-89: Cross-Platform Save Sync [FUTURE RELEASE]

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §17
> **Priority:** POST-LAUNCH
> **Complexity:** Large
> **Dependencies:** AR-80 (Steam Integration)

## Overview

Players can play on mobile and continue on PC with shared progress. Cloud save syncs FSRS data, unlocks, achievements, cosmetics, and settings across platforms.

## Save Data Structure

```typescript
interface CloudSave {
  version: number;
  lastModified: string;         // ISO timestamp
  playerId: string;
  activeRun: RunState | null;
  fsrsData: FSRSCardData[];
  unlockedRelics: string[];
  masteryCoins: number;
  achievements: Achievement[];
  statistics: PlayerStats;
  ownedCosmetics: string[];
  selectedCosmetics: CosmeticSlots;
  settings: PlayerSettings;
  ankiDeckMeta: AnkiDeckMeta[];  // Metadata only, decks stored locally
}
```

## Sync Flow
1. On launch: pull cloud save, compare timestamps with local
2. Cloud newer: prompt to load
3. Local newer: auto-push
4. Mid-run: save to cloud at end of each encounter
5. Conflict resolution: timestamp-based with user prompt for close timestamps

## Technical Requirements
- REST API backend (owner builds)
- Steamworks Cloud Save for Steam builds
- Account system (sign up, log in, link devices)
- Sync status indicator UI
- Offline graceful degradation

## GDD Updates

Add "§42. Cross-Platform Save Sync [PLANNED — Future Release]" with save structure, sync flow, conflict resolution.
