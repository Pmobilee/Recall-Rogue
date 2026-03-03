# Parallel Phase Execution Guide

Last updated: 2026-03-03

This document identifies which remaining phases (8-25) can be executed in parallel without file conflicts or dependency issues. Use this to maximize development throughput by running independent workstreams simultaneously.

---

## Dependency Graph Overview

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

---

## Group 1: Immediate (after Phase 8 completes)

These four can all start simultaneously once Phase 8 is done. Zero file overlap.

| Phase | Domain | Key Files | Why Isolated |
|-------|--------|-----------|--------------|
| **Phase 9: Biome Expansion** | Mine visuals | `src/data/biomes.ts`, `src/assets/sprites/tiles/`, `src/data/palette.ts` | Only touches biome definitions and tile assets |
| **Phase 11: Fact Content Engine** | Backend/API | `server/src/db/facts-*`, `server/src/routes/facts.ts`, new server files | Entirely server-side, zero overlap with game client code |
| **Phase 13: Knowledge Tree 2.0** | UI visualization | `src/ui/components/KnowledgeTree.svelte`, new `tree/` subfolder | Self-contained SVG/Canvas rendering, only reads SM-2 data |
| **Phase 18: Dev Tooling** | Developer tools | `src/dev/presets.ts` (new), `DevPanel.svelte`, audit docs | Only extends DevPanel and creates new dev-only files — no gameplay code changes |

---

## Group 2: After Phases 9 + 11 complete

These two don't share any files — dome redesign is layout/navigation, while fossil/farming is content expansion of standalone components.

| Phase | Domain | Key Files | Why Isolated |
|-------|--------|-----------|--------------|
| **Phase 10: Dome Hub Redesign** | Dome UI | `src/ui/components/DomeView.svelte`, new `HubFloor*.svelte` | Dome is a separate scene from mining |
| **Phase 16: Fossil & Farming** | Data/UI | `src/data/fossils.ts`, `src/ui/components/Farm.svelte`, `FossilGallery.svelte` | Only touches fossil/farm data and their dedicated components |

---

## Group 3: After Phase 11 completes (can run alongside Group 2)

| Phase | Domain | Key Files | Why Isolated |
|-------|--------|-----------|--------------|
| **Phase 12: Interest & Personalization** | New services | All new files: `interestConfig.ts`, `interestSpawner.ts`, `behavioralLearner.ts` | Almost entirely new files, minimal touches to existing code |

---

## Group 4: Convergence phases (multiple dependencies)

These phases require multiple prior phases to be complete and cannot easily be parallelized with each other.

| Phase | Dependencies | Reason |
|-------|-------------|--------|
| **Phase 15: GAIA Personality 2.0** | Phases 8, 11, 13 | Needs mine gameplay, fact content, and Knowledge Tree data |
| **Phase 14: Onboarding & Tutorial** | Phases 8, 10, 12 | Needs mine gameplay, dome hub, and interest assessment |
| **Phase 17: Addictiveness Pass** | Phases 8, 10, 13, 15, 16 | Cross-cutting polish pass across most game systems |

**However**, Phase 15 and Phase 14 can run in parallel with each other since:
- Phase 15 touches `GaiaManager.ts`, `gaiaDialogue.ts`, new `ThoughtBubble.svelte`
- Phase 14 touches `MineGenerator.ts` (tutorial mine), new `CutscenePanel.svelte`, `OnboardingCutscene.svelte`
- No file overlap between them

---

## Group 5: Infrastructure gate (sequential)

Phase 19 → Phase 20 must be sequential (auth before mobile launch).

| Phase | Domain | Key Files | Why Isolated |
|-------|--------|-----------|--------------|
| **Phase 19: Auth & Cloud** | Backend auth | `src/services/authService.ts`, `server/routes/auth.ts`, `server/db/users.sql` | Server + auth UI, new files |
| **Phase 20: Mobile Launch** | Mobile/stores | `capacitor.config.ts`, store assets, `accessibility.css` | Platform config, no gameplay code |

---

## Group 6: Post-launch (after Phases 19 + 20)

These two can run in parallel — completely different domains with no file overlap.

| Phase | Domain | Key Files | Why Isolated |
|-------|--------|-----------|--------------|
| **Phase 21: Monetization** | Economy/IAP | New `iapService.ts`, `subscriptionService.ts`, server IAP routes | Payment/subscription plumbing |
| **Phase 22: Social & Multiplayer** | Social features | New `socialService.ts`, `duelService.ts`, `GuildView.svelte`, server social routes | All new social systems and UI |

---

## Group 7: Late-stage (sequential chain)

These must be sequential due to cascading dependencies:

| Phase | Depends On | Reason |
|-------|-----------|--------|
| **Phase 23: Live Ops & Seasons** | 19, 20, 21, 22 | Needs auth, mobile, monetization, and social all in place |
| **Phase 24: Language Learning** | 11, 12, 19, 23 | Needs content engine, personalization, auth, and seasonal framework |
| **Phase 25: Advanced Features** | All prior phases | Post-launch expansion, requires proven player base |

---

## Optimal Execution Timeline

### Wave 1 (4 parallel tracks)
- **Track A**: Phase 9 — Biome Expansion
- **Track B**: Phase 11 — Fact Content Engine
- **Track C**: Phase 13 — Knowledge Tree 2.0
- **Track D**: Phase 18 — Dev Tooling

### Wave 2 (3 parallel tracks, after Wave 1)
- **Track A**: Phase 10 — Dome Hub Redesign (needs Phase 9)
- **Track B**: Phase 16 — Fossil & Farming (needs Phase 9)
- **Track C**: Phase 12 — Interest & Personalization (needs Phase 11)

### Wave 3 (2 parallel tracks, after Wave 2)
- **Track A**: Phase 14 — Onboarding & Tutorial (needs 8, 10, 12)
- **Track B**: Phase 15 — GAIA Personality 2.0 (needs 8, 11, 13)

### Wave 4 (1 track — cross-cutting)
- Phase 17 — Addictiveness Pass (needs 8, 10, 13, 15, 16)

### Wave 5 (sequential infrastructure)
- Phase 19 — Auth & Cloud
- Phase 20 — Mobile Launch

### Wave 6 (2 parallel tracks)
- **Track A**: Phase 21 — Monetization
- **Track B**: Phase 22 — Social & Multiplayer

### Wave 7 (sequential endgame)
- Phase 23 → Phase 24 → Phase 25

---

## File Conflict Risk Matrix

Shared files that appear in multiple phases (coordinate carefully if parallelizing):

| File | Phases That Touch It | Risk |
|------|---------------------|------|
| `src/data/types.ts` | 8, 11, 12, 15, 19, 21, 22 | **HIGH** — add fields in separate blocks to avoid merge conflicts |
| `src/data/balance.ts` | 8, 17 | Medium — different constant groups |
| `src/data/biomes.ts` | 8, 9 | Medium — Phase 8 sets tiers, Phase 9 expands to 25 |
| `src/game/managers/QuizManager.ts` | 8, 12 | Medium — Phase 8 overhauls, Phase 12 adds engagement scoring |
| `src/game/managers/GaiaManager.ts` | 8, 12, 15 | Medium — each phase adds different capabilities |
| `src/ui/stores/gameState.ts` | 8, 14 | Low — different state additions |
| `src/services/sm2.ts` | 13, 24 | Low — Phase 13 reads, Phase 24 extends |
| `src/services/saveService.ts` | 10, 23 | Low — different migration versions |
