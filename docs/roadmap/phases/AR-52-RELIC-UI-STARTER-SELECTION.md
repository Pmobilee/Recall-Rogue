# AR-52: Relic UI Overhaul + Run-Start Relic Selection

**Status:** Pending
**Created:** 2026-03-16
**Depends on:** None

## Overview

Three improvements to the relic system:

1. **Relic tray redesign**: Move relics from the top-right emoji row to a vertical strip on the right side of the combat screen, showing downscaled sprite icons instead of emoji text. Must not overlap with any existing UI elements (enemy intent, AP orb, draw/discard piles, card hand).

2. **Run-start relic selection**: At the beginning of each run, before the map appears, present the player with a choice of 3 starter relics. These 3 are always the same options (not random), each incentivising a different playstyle. The player must pick one.

3. **Duplicate prevention verification**: Ensure no duplicate relics can exist in a single playthrough. (Already implemented in `relicAcquisitionService.ts` via `getEligibleRelicPool()` which filters out `heldIds` — just needs verification.)

## Starter Relic Selection

The 3 always-available starter relics:

| Relic | Playstyle | Effect | Why |
|-------|-----------|--------|-----|
| `scholars_hat` | **Knowledge** | +3 HP on correct answer, +2 damage, +1 HP on wrong | Rewards accuracy and learning — the "study hard" path |
| `iron_buckler` | **Defense** | +5 block at turn start | Reliable survivability — the "turtle" path |
| `war_drum` | **Offensive** | Up to +3 damage per combo level | Rewards combo streaks — the "aggressive" path |

All three are common rarity, free (starter pool), and provide roughly equal value across different playstyles. None are overpowered or game-warping.

## Deliverables

Total: 1 component redesigned, 1 new screen, balance config, verification

## Tasks

### Section A: Relic Tray Redesign (Combat Display)

- [ ] **A.1** Redesign `src/ui/components/RelicTray.svelte`:
  - Change from horizontal row (top-right) to vertical strip (right edge, middle of screen)
  - Replace emoji text icons with actual relic sprite images using `getRelicIconPath(relicId)`
  - Icon size: 28px × 28px (scaled by `--layout-scale`)
  - Container: vertical flex, 4px gap, positioned `right: 6px`, vertically centered between enemy intent and draw pile
  - Each icon has a gold border, dark background, and the relic's rarity-colored glow
  - Tooltip on tap: shows relic name + short description
  - Triggered relic pulse animation still works (scale up + glow)
  - Must NOT overlap with: AP orb, draw pile, discard pile, end turn button, enemy intent bubble, card hand
  - Acceptance: Relics display as sprite icons in a vertical strip on the right

- [ ] **A.2** Add `<img>` fallback to emoji when sprite fails to load
  - Acceptance: If icon PNG missing, shows emoji icon from relic definition

### Section B: Run-Start Relic Selection Screen

- [ ] **B.1** Create `src/ui/components/StarterRelicSelection.svelte`:
  - Full-screen overlay (similar to DomainSelection)
  - Title: "Choose Your Path" or "Select a Relic"
  - Shows 3 relic cards side by side (or stacked on mobile)
  - Each card shows: relic icon (large, ~64px), name, description, playstyle tag
  - Cards have a subtle idle animation (float/breathe)
  - Tap to select → confirmation glow → screen transitions out
  - The 3 relics are always: `scholars_hat`, `iron_buckler`, `war_drum`
  - Acceptance: Player can pick one of 3 relics before the run starts

- [ ] **B.2** Wire `StarterRelicSelection` into the run-start flow in `gameFlowController.ts`:
  - After domain selection, before map generation
  - The selected relic is added to `run.runRelics` with `acquiredAtFloor: 0, acquiredAtEncounter: 0`
  - Also added to `run.offeredRelicIds` to prevent re-offering
  - Acceptance: Selected starter relic appears in relic tray during first combat

- [ ] **B.3** Add the 3 starter relic IDs to `src/data/balance.ts` as a config constant:
  ```typescript
  export const STARTER_RELIC_CHOICES = ['scholars_hat', 'iron_buckler', 'war_drum'] as const
  ```
  - Acceptance: Constant exists and is used by StarterRelicSelection

- [ ] **B.4** Show the `StarterRelicSelection` screen in `CardApp.svelte`:
  - Add a new screen state (e.g., `'starter_relic'`) between domain selection and map
  - `CardApp.svelte` renders `StarterRelicSelection` when screen === 'starter_relic'
  - On relic selected, transition to dungeon map
  - Acceptance: Screen appears in the correct position in the run-start flow

### Section C: Duplicate Prevention Verification

- [ ] **C.1** Verify `getEligibleRelicPool()` in `relicAcquisitionService.ts` excludes held relics
  - Acceptance: Code inspection confirms `heldIds` filter is applied
- [ ] **C.2** Verify the starter relic is added to `offeredRelicIds` so it won't be offered again from drops/bosses
  - Acceptance: After picking starter relic, it never appears in reward screens
- [ ] **C.3** Add a safety check in `addRelicToRun()` that prevents adding a relic if already held
  - Acceptance: Even if called twice with the same ID, only one copy exists

### Section D: Verify & Polish

- [ ] **D.1** `npm run typecheck` — clean
- [ ] **D.2** Visual test: start a run, see starter relic selection, pick one, verify it appears in combat
- [ ] **D.3** Visual test: relic tray shows sprite icons vertically on right side during combat
- [ ] **D.4** Visual test: triggered relic pulses correctly
- [ ] **D.5** Verify no UI overlap on mobile viewport (390px wide)

## Verification Gate

- [ ] `npm run typecheck` — clean
- [ ] Starter relic selection screen works
- [ ] Relic tray shows sprite icons (not emoji)
- [ ] No duplicate relics possible in a run
- [ ] No UI overlap with existing combat elements
- [ ] Relic trigger pulse animation works

## Files Affected

| File | Action | Task |
|------|--------|------|
| `src/ui/components/RelicTray.svelte` | EDIT (major) | A.1, A.2 |
| `src/ui/components/StarterRelicSelection.svelte` | NEW | B.1 |
| `src/services/gameFlowController.ts` | EDIT | B.2 |
| `src/data/balance.ts` | EDIT | B.3 |
| `src/CardApp.svelte` | EDIT | B.4 |
| `src/services/relicAcquisitionService.ts` | EDIT | C.3 |
| `docs/GAME_DESIGN.md` | EDIT | D |
| `docs/ARCHITECTURE.md` | EDIT | D |

## Design Notes

### Relic Tray Layout (Right Edge)
```
┌─────────────────────────────┐
│  Enemy Name                  │
│                    [Intent]  │
│                              │
│                         [R1] │  ← Relic icons (28px, vertical)
│                         [R2] │
│                         [R3] │
│                              │
│  [Discard]    [AP]   [Draw]  │
│  ──── Card Hand ────         │
│       [END TURN]             │
└─────────────────────────────┘
```

### Starter Selection Layout
```
┌─────────────────────────────┐
│        Choose Your Path      │
│                              │
│  ┌────┐  ┌────┐  ┌────┐    │
│  │ 🎓 │  │ 🛡️ │  │ 🥁 │    │
│  │    │  │    │  │    │    │
│  │Know │  │Def │  │Off │    │
│  │ledge│  │ense│  │ense│    │
│  └────┘  └────┘  └────┘    │
│                              │
│  Tap a relic to select it    │
└─────────────────────────────┘
```
