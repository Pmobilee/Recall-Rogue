# Parallel Phase Execution Guide

Last updated: 2026-03-04

This document maps dependency chains and parallel execution opportunities across all 50 phases. Phases 0–25 (V2 Roadmap) are complete. This guide focuses on Phases 26–50 (V3 Roadmap).

---

## V2 Roadmap — COMPLETE

All 25 phases (0–25) are finished and merged to `main`. They form the foundation for V3 work. No further action needed.

<details>
<summary>V2 dependency graph (archived)</summary>

```
Phase 8 ──→ [Phase 9] + [Phase 11] + [Phase 13] + [Phase 18]
                │            │
                ↓            ↓
         [Phase 10] + [Phase 16] + [Phase 12]
                              │
                              ↓
                      [Phase 15] (needs 8+11+13)
                              │
         [Phase 14] ←─────── + ──────→ [Phase 17]
                              │
                       [Phase 19] → [Phase 20]
                                        │
                              [Phase 21] + [Phase 22]
                                        │
                                  [Phase 23]
                                        │
                                  [Phase 24]
                                        │
                                  [Phase 25]
```
</details>

---

## V3 Roadmap — Dependency Graph (Phases 26-50)

### Legend

- `──→` = hard dependency (must complete before starting)
- `···>` = recommended order (file conflict risk, not a blocker)
- `‖` = safe to parallelize (zero or low file overlap)
- All phases 0–25 are complete — any dependency on them is satisfied

### ASCII Dependency Graph

```
                     ┌─────────────────────────────────────────────────┐
                     │           ALL V2 PHASES (0-25) COMPLETE         │
                     └───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┘
                         │   │   │   │   │   │   │   │   │   │   │
    ┌────────────────────┼───┼───┼───┼───┼───┼───┼───┼───┘   │
    │                    │   │   │   │   │   │   │   │   │         │
    ▼                    ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼         ▼
 ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          ┌──────┐
 │  26  │ │  27  │ │  32  │ │  39  │ │  40  │ │  47  │          │ WAVE │
 │Server│ │Tests │ │Facts │ │ Web  │ │ i18n │ │Achiev│          │  1   │
 └──┬───┘ └──────┘ └──┬───┘ └──────┘ └──────┘ └──┬───┘          └──────┘
    │                  │                           │
    ├──────┐           │                           │
    │      │           │                           │
    ▼      │           ▼                           ▼               ┌──────┐
 ┌──────┐  │     ┌──────┐  ┌──────┐ ┌──────┐ ┌──────┐           │ WAVE │
 │  38  │  │     │  29  │  │  31  │ │  33  │ │  37  │           │  2   │
 │ iOS  │  │     │Anim  │  │Gacha │ │Biome │ │ Pets │           └──────┘
 └──────┘  │     └──┬───┘  └──────┘ └──┬───┘ └──────┘
           │        │                   │
           │        ▼                   │
           │   ┌──────┐  ┌──────┐      ▼      ┌──────┐ ┌──────┐  ┌──────┐
           │   │  30  │  │  34  │ ┌──────┐    │  41  │ │  43  │  │  45  │
           │   │Juice │  │ Art  │ │  35  │    │Stats │ │Co-op │  │ Kids │
           │   └──────┘  └──────┘ │Mechs │    └──┬───┘ └──────┘  └──────┘
           │                      └──┬───┘       │                 WAVE 3
           │                         │           │
           │        ┌────────────────┤           │
           │        │                │           │
           │        ▼                ▼           ▼                 ┌──────┐
           │   ┌──────┐        ┌──────┐    ┌──────┐              │ WAVE │
           │   │  36  │        │  49  │    │  42  │              │  4   │
           │   │Combat│        │MineGn│    │Viral │              └──────┘
           │   └──┬───┘        └──────┘    └──────┘
           │      │
           │      │     ┌──────────────────┐
           ▼      ▼     ▼                  │
      ┌──────┐ ┌──────┐ ┌──────┐           │                     ┌──────┐
      │  28  │ │  48  │ │  44  │           │                     │ WAVE │
      │ Perf │ │Prstge│ │Teachr│           │                     │  5   │
      └──────┘ └──────┘ └──┬───┘           │                     └──────┘
                           │               │
                           ├───────────────┘
                           │
                           ▼                                      ┌──────┐
                      ┌──────┐ ┌──────┐                          │ WAVE │
                      │  46  │ │  50  │                          │  6   │
                      │Learn │ │ Open │                          └──────┘
                      └──────┘ └──────┘
```

### Dependency Table (V3 only — all V2 deps already satisfied)

| Phase | Depends on V3 Phase(s) | Why |
|-------|----------------------|-----|
| **26** Production Backend | — | All deps (19,21,22) complete |
| **27** Test Suite & CI/CD | — | Can start immediately |
| **28** Performance | 29,30,33,35 ···> | Optimization pass — best after MineScene features stabilize |
| **29** Character Animation | — | All deps (7,8) complete |
| **30** Mining Juice | 29 ···> | Block effects hook into player animation events |
| **31** Gacha & Reveal Polish | — | All deps (17) complete |
| **32** Content Scaling | — | All deps (11) complete |
| **33** Biome Visual Diversity | — | All deps (9) complete |
| **34** Pixel Art Per Fact | **32** ──→ | Needs expanded fact DB from content scaling |
| **35** Mine Mechanics | 33 ···> | Both touch MineGenerator; sequence avoids conflicts |
| **36** Combat System | **35** ──→ | Combat builds on mine mechanics (quiz gates, events) |
| **37** Advanced Pet System | — | All deps (10,16) complete |
| **38** iOS Launch | **26** ──→ | Needs production backend (RevenueCat, push) for store submission |
| **39** Web Platform | — | All deps (20) complete |
| **40** Internationalization | — | No hard deps; touches UI strings across components |
| **41** Analytics & Experiments | **26** ···> | Benefits from production analytics pipeline |
| **42** Viral Growth | **41** ──→ | Needs feature flags and experiment framework |
| **43** Cooperative Dives | **26** ──→ | Needs production WebSocket server infrastructure |
| **44** Teacher Dashboard | **41** ──→ | Needs analytics pipeline for student metrics |
| **45** Kid Mode & Parental | — | All deps (19) complete |
| **46** Learning Research | **41**, **44** ──→ | Needs analytics + teacher dashboard for research API |
| **47** Achievement Gallery | — | All deps (10) complete |
| **48** Prestige & Endgame | **36**, **47** ──→ | Needs combat (boss defeats) + achievements |
| **49** Advanced Mine Gen | **35** ──→ | Extends mine mechanics in MineGenerator |
| **50** Open Content | **32**, **41**, **44** ──→ | Needs content, analytics, and educator APIs |

---

## Optimal Execution Plan — 6 Waves

### Wave 1 — Foundation (6 parallel tracks)

All prerequisites satisfied (V2 complete). Zero file overlap between tracks.

| Track | Phase | Domain | Key New/Modified Files | Why Isolated |
|-------|-------|--------|----------------------|--------------|
| A | **26: Production Backend** | Server | `server/src/index.ts`, `server/src/services/{emailService,ttsService,pushService}.ts`, `server/src/routes/{iap,audio,subscriptions}.ts` | Entirely server-side route mounting and service integration |
| B | **27: Test Suite & CI/CD** | Testing | `tests/**`, `vitest.config.ts`, `.github/workflows/ci.yml` | All new files in test directories; no production code changes |
| C | **32: Content Scaling** | Content | `server/src/services/contentGen.ts`, `server/src/db/facts-migrate.ts`, `scripts/generate-batch.ts` | Server-side fact pipeline, no client code |
| D | **39: Web Platform** | Web | `public/manifest.webmanifest`, `desktop.css`, `public/sw.js`, `wrangler.toml`, `public/_headers` | PWA/deployment config, no game logic |
| E | **40: Internationalization** | UI | `src/i18n/` (new), `locales/*.json` (new), UI component string extraction | New i18n directory, touches UI strings only |
| F | **47: Achievement Gallery** | Dome | `src/data/achievementTiers.ts` (new), `src/services/achievementService.ts` (new), `hubFloors.ts`, `DomeScene.ts` | New dome floor + achievement tracking, isolated from mine |

---

### Wave 2 — Visual & Platform (5 parallel tracks, after Wave 1)

| Track | Phase | Domain | Key New/Modified Files | Why Isolated |
|-------|-------|--------|----------------------|--------------|
| A | **29: Character Animation** | Mine: Player | `AnimationSystem.ts`, `MinerAnimController.ts`, `GearOverlaySystem.ts` (new), `MineScene.ts` (player rendering) | Player sprite layer only |
| B | **31: Gacha & Reveal Polish** | UI Overlays | `GachaReveal.svelte`, `NearMissBanner.svelte`, `DescentOverlay.svelte` (new), CSS particles | Svelte UI layer, minimal Phaser overlap |
| C | **33: Biome Visual Diversity** | Mine: Tiles | `AutotileSystem.ts`, `biomes.ts`, `palette.ts`, `biomeTileSpec.ts` (new), `MineScene.ts` (tile rendering) | Tile rendering subsystem only |
| D | **37: Advanced Pet System** | Dome | `companions.ts`, `dustCat.ts` (new), `petTraits.ts` (new), `DomeScene.ts` (pet wanderer), `MineScene.ts` (dust cat follower) | Dome + companion systems |
| E | **38: iOS Launch** | Platform | `capacitor.config.ts`, `ios/` (new), `Info.plist`, store metadata | Xcode/Capacitor config, no game logic |

**⚠️ Coordination notes:**
- **29 + 33** both modify `MineScene.ts` — 29 touches player rendering methods, 33 touches tile/fog rendering methods. Workers must add code in separate method blocks and avoid restructuring shared imports.
- **37** touches `DomeScene.ts` — ensure Wave 1's Phase 47 (achievement gallery) is merged first.

---

### Wave 3 — Gameplay & Infrastructure (6 parallel tracks, after Wave 2)

| Track | Phase | Domain | Key New/Modified Files | Why Isolated |
|-------|-------|--------|----------------------|--------------|
| A | **30: Mining Juice** | Mine: Effects | `ImpactSystem.ts` (new), `BlockAnimSystem.ts` (new), `LootPopSystem.ts`, `MineScene.ts` (effects layer) | Visual effects system; hooks into 29's animation events |
| B | **34: Pixel Art Per Fact** | Content/Art | `batch-sprite-daemon.ts` (new), `spriteQC.ts` (new), `factArtService.ts` (new), `comfyuiFactArt.ts` (new) | ComfyUI pipeline + client cache; isolated from game rendering |
| C | **35: Mine Mechanics** | Mine: Logic | `InstabilitySystem.ts` (new), `QuizStreakSystem.ts` (new), `MineEventSystem.ts` (new), `MineGenerator.ts`, `balance.ts` | Game logic layer in MineScene; separate from effects (30) |
| D | **41: Analytics & Experiments** | Server | `server/src/analytics/*`, `server/src/config/features.ts`, `analyticsService.ts`, feature flag service | Server analytics + client SDK; no game rendering |
| E | **43: Cooperative Dives** | Multiplayer | `server/src/routes/coopWs.ts` (new), `CoopManager.ts` (new), `CoopOverlay.svelte` (new) | WebSocket server + co-op UI; MineScene sync hooks are additive |
| F | **45: Kid Mode & Parental** | UI/Safety | `app-kid-theme.css` (new), `parentalStore.ts` (new), `ParentalPinGate.svelte` (new) | Theme CSS + parental UI; content filtering in existing managers |

**⚠️ Coordination notes:**
- **30 + 35** both modify `MineScene.ts` — 30 adds particle/tween effects, 35 adds game logic handlers. Different update-loop sections.
- **35 + 43** both touch game loop — 35 adds new block types and events, 43 adds co-op sync. Workers should not restructure the block-break pipeline.

---

### Wave 4 — Combat & Growth (3 parallel tracks, after Wave 3)

| Track | Phase | Domain | Key New/Modified Files | Why Isolated |
|-------|-------|--------|----------------------|--------------|
| A | **36: Combat System** | Mine: Combat | `EncounterManager.ts` (new), `CombatOverlay.svelte` (new), `Boss.ts`, `Creature.ts`, `MineScene.ts` (encounter hooks) | New combat overlay + encounter system |
| B | **42: Viral Growth** | Growth | `shareService.ts` (new), `ShareCardGenerator.svelte` (new), `referralService.ts` (new), `asoKeywordTracker.ts` (new) | Social sharing + referral — no game rendering |
| C | **49: Advanced Mine Gen** | Mine: Gen | `MineGenerator.ts` (micro-structures, transitions), `AnomalyZoneSystem.ts` (new), `MinePreview.ts` (new) | Generation-time only; does not touch MineScene rendering |

**⚠️ Coordination notes:**
- **36 + 49** both touch mine systems — 36 adds encounter triggers in `MineScene.ts`, 49 modifies `MineGenerator.ts`. Different lifecycle phases (generation vs runtime), so safe to parallelize.

---

### Wave 5 — Optimization & Education (3 parallel tracks, after Wave 4)

| Track | Phase | Domain | Key New/Modified Files | Why Isolated |
|-------|-------|--------|----------------------|--------------|
| A | **28: Performance** | Rendering | `DirtyRectTracker.ts` (new), `TextureAtlasLRU.ts` (new), `deviceTierService.ts` (new), `MineScene.ts` (dirty-rect), `vite.config.ts` | Optimization pass — all game features now stable |
| B | **44: Teacher Dashboard** | Education | `teacher/` (new standalone Vite app), `server/src/routes/classroom.ts`, `ClassCodeJoin.svelte` (new) | Separate Vite application; minimal main-app changes |
| C | **48: Prestige & Endgame** | Endgame | `prestigeConfig.ts` (new), `PrestigeScreen.svelte` (new), `DomeScene.ts` (golden tint), `gaiaDialogue.ts` (peer dialogue) | Post-mastery systems; dome visual changes only |

**Why Phase 28 is here (not earlier):**
Performance optimization is most effective after all MineScene features (29, 30, 33, 35, 36, 43, 49) are merged. Optimizing before features stabilize wastes effort — every new MineScene feature invalidates draw-call budgets and dirty-rect assumptions.

---

### Wave 6 — Final (2 parallel tracks, after Wave 5)

| Track | Phase | Domain | Key New/Modified Files | Why Isolated |
|-------|-------|--------|----------------------|--------------|
| A | **46: Learning Research** | Research | `anonymizationPipeline.ts` (new), `learningMetrics.ts` (new), `LearningInsightsTab.svelte` (new) | Server analytics + research API; reads from 41/44 infrastructure |
| B | **50: Open Content** | Platform | `server/src/routes/publicApi.ts` (new), `contentModeration.ts` (new), `packages/widget/` (new) | Public API + community tools; builds on 32/41/44 foundations |

---

## Summary Timeline

```
Wave 1 ─── 26 ‖ 27 ‖ 32 ‖ 39 ‖ 40 ‖ 47 ─── (6 tracks)
              │              │              │
Wave 2 ─── 29 ‖ 31 ‖ 33 ‖ 37 ‖ 38 ──────── (5 tracks)
              │         │
Wave 3 ─── 30 ‖ 34 ‖ 35 ‖ 41 ‖ 43 ‖ 45 ─── (6 tracks)
                        │    │
Wave 4 ─────────── 36 ‖ 42 ‖ 49 ────────── (3 tracks)
                    │         │
Wave 5 ─────── 28 ‖ 44 ‖ 48 ────────────── (3 tracks)
                    │
Wave 6 ─────────── 46 ‖ 50 ─────────────── (2 tracks)
```

**Maximum parallelism**: 6 tracks (Waves 1 and 3)
**Minimum parallelism**: 2 tracks (Wave 6)
**Total phases**: 25
**Critical path**: 26 → 38, 32 → 34, 35 → 36 → 48, 41 → 44 → 46/50

---

## File Conflict Risk Matrix (V3 Phases)

Shared files that appear in multiple V3 phases. Coordinate carefully when parallelizing phases in the same wave.

### HIGH Risk — Multiple phases modify core logic

| File | Phases That Touch It | Waves | Mitigation |
|------|---------------------|-------|------------|
| `src/game/scenes/MineScene.ts` | 28, 29, 30, 33, 35, 36, 43, 49 | 2-5 | Never in same wave except with explicit method-block isolation. Each phase adds to different lifecycle methods. |
| `src/data/types.ts` (PlayerSave) | 35, 36, 37, 43, 45, 47, 48, 49 | 2-5 | Each phase adds fields in its own clearly-labeled block. Use `// === Phase XX fields ===` comment guards. |
| `src/data/balance.ts` | 28, 30, 35, 36, 37, 43, 48, 49 | 2-5 | Each phase adds constants in separate named sections. Never restructure existing sections. |
| `src/game/managers/GameManager.ts` | 35, 36, 37, 43, 49 | 2-4 | Each phase adds calls to new managers in `startDive()`/`endDive()`. Append-only pattern. |

### MEDIUM Risk — Shared but different sections

| File | Phases That Touch It | Waves | Mitigation |
|------|---------------------|-------|------------|
| `server/src/index.ts` | 26, 41, 43, 44, 50 | 1-6 | Phase 26 mounts all existing routes. Later phases add new route files and register them. Append-only. |
| `src/game/systems/MineGenerator.ts` | 33, 35, 49 | 2-4 | 33 adds transition zones, 35 adds block types, 49 adds micro-structures. Different generation passes. |
| `src/game/scenes/DomeScene.ts` | 37, 47, 48 | 1-5 | 47 adds gallery floor, 37 adds pet wanderer, 48 adds golden tint. Different methods/layers. |
| `src/services/gaiaDialogue.ts` | 37, 45, 48 | 2-5 | Each phase adds trigger pools. Append to the end of the triggers object. |
| `src/services/analyticsService.ts` | 41, 42, 45, 46 | 3-6 | 41 overhauls the service; later phases only add new event types. Run 41 first. |
| `src/services/saveService.ts` | 35, 37, 47, 48 | 2-5 | Each phase adds migration version bumps and default values. Sequential version numbers. |

### LOW Risk — Minimal or cosmetic changes

| File | Phases That Touch It | Waves | Mitigation |
|------|---------------------|-------|------------|
| `src/ui/components/Settings.svelte` | 40, 45 | 1, 3 | 40 adds language selector; 45 adds parental section. Different settings groups. |
| `src/ui/components/HubView.svelte` | 37, 39, 47, 48 | 1-5 | Each adds a navigation button or panel. Append-only. |
| `vite.config.ts` | 28, 39 | 1, 5 | 39 adds deployment config; 28 adds bundle optimization. Different config sections. |
| `src/game/spriteManifest.ts` | 29, 33, 34, 36, 37, 47 | 1-4 | Each phase adds sprite key entries. Append to the manifest arrays. |

---

## Quick Reference — "What can I start now?"

Given the current state (all V2 phases complete, no V3 phases started):

**Start immediately (Wave 1):**
- Phase 26: Production Backend Integration
- Phase 27: Test Suite & CI/CD
- Phase 32: Fact Content Scaling
- Phase 39: Web Platform Excellence
- Phase 40: Internationalization
- Phase 47: Achievement Gallery

**After Wave 1 completes:**
- Phase 29, 31, 33, 37, 38

**Cannot start until specific V3 phases complete:**
- Phase 34 → needs 32
- Phase 36 → needs 35
- Phase 38 → needs 26
- Phase 42 → needs 41
- Phase 43 → needs 26
- Phase 44 → needs 41
- Phase 46 → needs 41 + 44
- Phase 48 → needs 36 + 47
- Phase 49 → needs 35
- Phase 50 → needs 32 + 41 + 44

---

## Execution Checklist — STRICTLY SEQUENTIAL

### CRITICAL RULE: ONE PHASE AT A TIME

**NEVER launch parallel agents for different phases.** Token budget resets every 4 hours.
Parallel agents burn through the budget in minutes and halt all progress.

**Workflow for each phase:**
1. Read the phase doc from `docs/roadmap/phases/`
2. Launch ONE Sonnet agent to implement it (foreground, not background)
3. Verify: `npm run typecheck` and/or `npm run build`
4. Commit and push
5. Check off below and in PROGRESS.md, move doc to `completed/`
6. ONLY THEN proceed to the next phase

**After every compaction**: Read this checklist to find the next unchecked phase. Do NOT skip ahead or parallelize.

### Numbered execution order (1-25)

| # | Wave | Phase | Name | Status |
|---|------|-------|------|--------|
| 1 | W1 | **26** | Production Backend Integration | [x] |
| 2 | W1 | **27** | Test Suite & CI/CD | [ ] |
| 3 | W1 | **32** | Fact Content Scaling | [ ] |
| 4 | W1 | **39** | Web Platform Excellence | [ ] |
| 5 | W1 | **40** | Internationalization | [ ] |
| 6 | W1 | **47** | Achievement Gallery | [ ] |
| 7 | W2 | **38** | iOS Launch | [ ] |
| 8 | W2 | **31** | Gacha & Reveal Polish | [ ] |
| 9 | W2 | **29** | Character Animation | [ ] |
| 10 | W2 | **33** | Biome Visual Diversity | [ ] |
| 11 | W2 | **37** | Advanced Pet System | [ ] |
| 12 | W3 | **41** | Analytics & Experiments | [ ] |
| 13 | W3 | **45** | Kid Mode & Parental Controls | [ ] |
| 14 | W3 | **34** | Pixel Art Per Fact | [ ] |
| 15 | W3 | **43** | Cooperative Dives | [ ] |
| 16 | W3 | **30** | Mining Juice | [ ] |
| 17 | W3 | **35** | Mine Mechanics | [ ] |
| 18 | W4 | **42** | Viral Growth | [ ] |
| 19 | W4 | **49** | Advanced Mine Gen | [ ] |
| 20 | W4 | **36** | Combat System | [ ] |
| 21 | W5 | **44** | Teacher Dashboard | [ ] |
| 22 | W5 | **48** | Prestige & Endgame | [ ] |
| 23 | W5 | **28** | Performance & Optimization | [ ] |
| 24 | W6 | **46** | Learning Effectiveness Research | [ ] |
| 25 | W6 | **50** | Open Content Ecosystem | [ ] |
