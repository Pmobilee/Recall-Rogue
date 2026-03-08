# Phase 0: MVP Core Loop ✅ COMPLETE

**Goal**: Test core hypothesis — "mining + artifacts + learning facts is fun"
**Duration**: Initial build sprint
**Status**: COMPLETE as of 2026-02-28

## All 25 MVP Build Steps — DONE

### Data Layer (Steps 1-2)
- [x] `src/data/types.ts` — All TypeScript interfaces (Fact, ReviewState, BlockType, MineCell, PlayerSave, RunState)
- [x] `src/data/balance.ts` — 40+ tunable game constants

### Services (Steps 3-5)
- [x] `src/services/saveService.ts` — LocalStorage save/load with crypto.randomUUID fallback
- [x] `src/services/sm2.ts` — SM-2 spaced repetition algorithm
- [x] `src/services/quizService.ts` — Quiz question selection and grading

### Seed Content (Step 6)
- [x] `src/data/seed/vocab-n3.json` — 50 Japanese N3 vocabulary entries

### Game Systems (Steps 7-10)
- [x] `src/game/systems/MineGenerator.ts` — Seeded RNG, procedural mine generation
- [x] `src/game/systems/OxygenSystem.ts` — Per-action oxygen costs
- [x] `src/game/systems/MiningSystem.ts` — Block breaking logic
- [x] `src/game/entities/Player.ts` — Grid position and movement

### Phaser Scene (Step 11)
- [x] `src/game/scenes/MineScene.ts` — Full mining scene with camera, fog, input, events

### Game Manager (Steps 12+21)
- [x] `src/game/GameManager.ts` — Event bridge, dive lifecycle, study sessions

### Svelte Stores (Step 13)
- [x] `src/ui/stores/gameState.ts` — Screen routing, mine state stores
- [x] `src/ui/stores/playerData.ts` — Player save store with mutation helpers

### UI Components (Steps 14-19)
- [x] `src/ui/components/HUD.svelte` — Mining HUD
- [x] `src/ui/components/QuizOverlay.svelte` — Quiz modal
- [x] `src/ui/components/BackpackOverlay.svelte` — Inventory panel
- [x] `src/ui/components/FactReveal.svelte` — Artifact reveal screen
- [x] `src/ui/components/DivePrepScreen.svelte` — Pre-dive oxygen allocation
- [x] `src/ui/components/BaseView.svelte` — Base hub UI

### Root Wiring (Steps 20, 24-25)
- [x] `src/App.svelte` — Router connecting all screens
- [x] `src/game/scenes/BootScene.ts` — Updated boot flow
- [x] Typecheck passes (0 errors), production build clean

### Post-MVP Polish (Applied during development)
- [x] DevPanel for god-mode testing
- [x] Oxygen replenishment after dives
- [x] 5 starter facts seeded for new players
- [x] Camera always centers player (direct scroll)
- [x] Random spawn in mine center (40-60% depth)
- [x] Free movement (no oxygen cost for empty tiles)
- [x] Auto-step after mining (one-click mining)
- [x] Directional movement (click anywhere to move/mine)
- [x] Pathfinding (BFS to navigate through empty tiles)
- [x] Quiz gate: 0 O2 for correct, -10 O2 for wrong
- [x] DivePrepScreen $derived.by() fix for Svelte 5
- [x] pointer-events:auto on all UI overlays

## Bug Fixes Applied
- [x] `crypto.randomUUID()` fallback for HTTP contexts
- [x] `camera.worldView` uninitialized during create() — tiles invisible
- [x] `#ui-overlay > *` pointer-events blocking canvas clicks
- [x] All UI components inheriting pointer-events:none

## Key Commits
| Hash | Description |
|------|-------------|
| c3d492f | Implement complete MVP (all 25 steps) |
| 83e48c6 | Add DevPanel, fix oxygen persistence |
| ab56eaa | Fix mine tiles invisible |
| 1e944e2 | Fix site-wide click blocking |
| d5f4f78 | Fix DivePrepScreen Svelte 5 |
| 9ac652c | UX: backpack click, camera, quiz gate O2 |
| bc0fcce | UX: free movement, auto-step, directional clicks |
| ec186d3 | Camera centering + random spawn |
| 9b4b3d4 | Pathfinding for distant empty tiles |
