# Phase 1.3: Audio

**Status**: ✅ Completed
**Depends on**: None (can run parallel)
**Estimated effort**: 3-5 days

## Overview
Add basic sound effects for core interactions. No music yet — just satisfying feedback sounds.

---

## Task 1.3.1: Generate Audio Assets
**Status**: ✅ Completed
**Output**: `src/assets/audio/` directory with WAV/MP3 files
**Note**: Sounds are generated programmatically via Web Audio API, no external files needed

### Steps:
1. Create `src/assets/audio/` directory
2. Generate or source these sound effects (use free CC0 sources or generate programmatically):
   - `mine_dirt.mp3` — soft crumble sound
   - `mine_rock.mp3` — harder impact
   - `mine_crystal.mp3` — crystalline chime
   - `mine_break.mp3` — satisfying shatter
   - `collect.mp3` — pickup/collect sound
   - `quiz_correct.mp3` — gentle positive chime
   - `quiz_wrong.mp3` — soft negative tone (not harsh)
   - `button_click.mp3` — UI interaction
   - `oxygen_warning.mp3` — low oxygen alert
3. Keep all files small (< 50KB each)
4. Use Web Audio API compatible formats

**NOTE**: If audio asset generation is not possible in this environment, create placeholder files and document what sounds are needed. The actual audio can be sourced later.

---

## Task 1.3.2: Audio Manager Service
**Status**: ✅ Completed
**File**: `src/services/audioService.ts` (NEW)

### Steps:
1. Create an AudioManager singleton
2. Methods: `playSound(name: string)`, `setVolume(level: number)`, `mute()`, `unmute()`
3. Preload all audio assets
4. Handle WebAudio context unlock (required for mobile — must be triggered by user gesture)
5. Add JSDoc comments
6. Run `npm run typecheck` and `npm run build`

---

## Task 1.3.3: Wire Audio into MineScene
**Status**: ✅ Completed
**File**: `src/game/scenes/MineScene.ts`

### Steps:
1. Import audioService
2. Play `mine_dirt`/`mine_rock` when mining (based on block type)
3. Play `mine_break` when a block is destroyed
4. Play `collect` when minerals/artifacts collected
5. Play `oxygen_warning` when oxygen drops below 20%
6. Run `npm run typecheck` and `npm run build`

---

## Task 1.3.4: Wire Audio into UI Components
**Status**: ✅ Completed
**Files**: `src/ui/components/QuizOverlay.svelte`, `src/ui/components/BaseView.svelte`

### Steps:
1. Play `quiz_correct`/`quiz_wrong` on quiz answer
2. Play `button_click` on major UI buttons
3. Run `npm run typecheck` and `npm run build`

---

## Verification
1. `npm run typecheck` — 0 errors
2. `npm run build` — success
3. Test: mining plays sounds, quizzes have feedback, buttons click
