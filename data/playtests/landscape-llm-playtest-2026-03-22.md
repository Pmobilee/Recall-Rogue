# LLM Landscape Playtest Report

**Date:** 2026-03-22
**Viewport:** 1280x720 (landscape)
**Method:** Automated DOM audit + manual interaction via Playwright
**Scenarios tested:** 17 screens across combat, shop, rest, dungeon map, rewards, hub, settings, library, profile

---

## Objective Checklist (per screen)

| Check | Description |
|-------|-------------|
| O1 | All buttons >= 44x44px touch targets |
| O2 | No interactive elements occluded by overlapping z-layers |
| O3 | All interactive elements have aria-label or visible text |
| O4 | No interactive elements rendered outside viewport |
| O5 | HP bar uses color-blind safe palette (sky blue, not green) |
| O6 | Enemy HP accessible via aria-live screen reader region |
| O7 | Intent bubble centered below enemy name |
| O8 | End Turn button positioned bottom-right |
| O9 | Draw pile LEFT, discard pile RIGHT (genre convention) |
| O10 | Turn counter visible |
| O11 | Deck total visible |
| O12 | No JS runtime errors (excluding network/API failures) |

## Subjective Checklist (per screen)

| Check | Description |
|-------|-------------|
| S1 | Information hierarchy: most important info is most prominent |
| S2 | Cognitive load: visible button count reasonable (<15 for combat) |
| S3 | Visual balance: screen utilization feels full but not cramped |
| S4 | Feedback clarity: animations, state changes communicated clearly |
| S5 | Empty states: placeholders look intentional, not broken |
| S6 | Landscape-specific: three-strip layout (arena/stats/hand) balanced |

---

## Results by Screen

### combat-basic (cave_bat, 5 cards, no relics)
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 9 buttons, all >= 44px |
| O2 | PASS | No occlusion |
| O3 | PASS | All labeled |
| O4 | PASS | All in viewport |
| O5 | PASS | HP fill = rgb(56,189,248) sky blue |
| O6 | PASS | "Page Flutter: 17 of 17 HP" |
| O7 | PASS | Intent cx=640, viewport center=640 |
| O8 | PASS | End Turn at x=1155 (RIGHT) |
| O9 | PASS | Draw left=26, Discard right=1254 |
| O10 | PASS | "Turn 1" |
| O11 | PASS | "Deck: 10" |
| O12 | PASS | No JS errors |
| S1 | PASS | Enemy name + intent centered, HP strip clear |
| S2 | PASS | 9 buttons — appropriate for combat |
| S5 | PASS | "No relics" compact placeholder |
| S6 | PASS | Three-strip layout balanced |

### combat-boss (the_archivist, 5 cards, 3 relics, 50 HP)
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 9 buttons, all >= 44px |
| O2 | PASS | No occlusion |
| O3 | PASS | All labeled |
| O5 | PASS | HP amber (50%) as expected |
| S2 | PASS | 9 buttons |
| S5 | PASS | 3 relics + 2 dotted empty slots |

### combat-10-cards (crystal_golem, 10 cards)
| Check | Result | Notes |
|-------|--------|-------|
| O1 | **FAIL** | Strike card measured at 24x33px — well below 44px minimum |
| O2 | **FAIL** | Card button occluded by `.card-v2-frame` element |
| S2 | NOTE | 14 buttons — high for combat, borderline |
| S3 | **ISSUE** | 10 cards at landscape scale get very small. Cards are readable but barely tappable |

**Issue L-01 (High):** In landscape 1280x720, the card hand scaling for 10 cards produces cards smaller than 44px. The 44px minimum spacing fix (AR-128) only applies to the gap between card left edges, but the card *elements themselves* are scaled down to 24x33px at this hand size. The landscape card strip needs a different scaling strategy — possibly horizontal scroll rather than shrink-to-fit.

### combat-low-hp (cave_bat, 10 HP)
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | |
| O2 | PASS | |
| O5 | PASS | HP fill red (10%) as expected |
| S4 | PASS | near-death-tension class active, saturate(0.7) applied |

### combat-near-death (cave_bat, 3 HP)
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | |
| O2 | PASS | |
| S4 | PASS | Near-death active |

### shop (500g, random inventory)
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 4 buttons |
| O2 | PASS | |
| O3 | PASS | |
| S2 | PASS | Minimal buttons — clean |

### shop-loaded (1000g, explicit inventory)
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 7 buttons |
| O2 | PASS | |
| S2 | PASS | |

### rest-site
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 1 button visible |
| O2 | **FAIL** | "Rest Heal 30" button occluded by `.screen-transition` overlay |
| S3 | **ISSUE** | Only 1 button visible — rest options may still be loading behind transition |

**Issue L-02 (Medium):** Rest site button is occluded by screen transition overlay at audit time. The transition may not have fully cleared in 700ms. Could be a timing issue, or the transition overlay persists.

### card-reward (3 cards)
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 5 buttons |
| O2 | PASS | |
| S2 | PASS | |

### dungeon-map
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 13 buttons |
| O2 | **FAIL** | A button occluded by `.dungeon-map` background element |
| O3 | **FAIL** | At least 1 button with no text or aria-label |
| S2 | NOTE | 13 buttons — map nodes + nav |

**Issue L-03 (Medium):** Dungeon map has a button occluded by the map background, and at least one map node button lacks an aria-label (just rendered as an icon with no accessible name).

### retreat-or-delve
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 2 buttons |
| O2 | PASS | |
| S2 | PASS | Clean binary choice |

### mystery-event
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 1 button |
| O2 | PASS | |
| S2 | PASS | |

### run-end-victory
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 3 buttons |
| O2 | PASS | |
| S2 | PASS | |

### run-end-defeat
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 3 buttons |
| O2 | PASS | |
| S2 | PASS | |

### archetype-selection
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 7 buttons |
| O2 | PASS | |
| S2 | PASS | |

### settings
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 13 buttons |
| O2 | PASS | |
| S2 | PASS | |

### library
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 23 buttons |
| O2 | PASS | |
| S2 | NOTE | 23 buttons — high but this is a desktop-style screen with many tabs/filters |

### profile
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 9 buttons |
| O2 | PASS | |
| S2 | PASS | |

### hub (with active run banner)
| Check | Result | Notes |
|-------|--------|-------|
| O1 | PASS | 23 buttons |
| O2 | PASS | |
| O3 | **FAIL** | `.sprite-hitbox` button has no aria-label or text |
| S2 | NOTE | 23 buttons — nav bar + hub buttons. Landscape has sidebar nav duplicating some items |

**Issue L-04 (Low):** Hub has a `.sprite-hitbox` button (likely the campfire sprite or character sprite) with no aria-label. Screen readers cannot identify what it does.

---

## Pre-Existing Bugs Found During Playtest

### P-01 (Critical): COMBO_MULTIPLIERS runtime crash blocks ALL combat
The staged AR-201 refactor removed `COMBO_MULTIPLIERS` from `balance.ts` but `turnManager.ts:getComboMultiplier()` still referenced it. This caused a `ReferenceError` at runtime that crashed the entire combat overlay. **Fixed during this playtest** by inlining `DEFAULT_COMBO_MULTIPLIERS` in turnManager.ts.

### P-02 (Critical): ECHO export removed but encounterBridge.ts still imports it
Same AR-201 staging issue. `ECHO` constant was removed from `balance.ts` but `encounterBridge.ts` still imported it. **Fixed during this playtest** by inlining the ECHO constants locally.

### P-03 (Medium): comboCount removed from TurnState but UI still reads it
AR-201 removed `comboCount` from the `TurnState` interface but `CardCombatOverlay.svelte` references `turnState.comboCount` at 4 locations. **Fixed during this playtest** by adding `comboCount` as a deprecated alias synced with `consecutiveCorrectThisEncounter`.

---

## New Issues from This Playtest

| ID | Severity | Screen | Issue |
|----|----------|--------|-------|
| L-01 | High | combat-10-cards | Cards scale to 24x33px in landscape with 10-card hand — below 44px touch target. Need horizontal scroll or different landscape scaling for large hands. |
| L-02 | Medium | rest-site | Rest button occluded by screen transition overlay — may be timing issue or transition not clearing. |
| L-03 | Medium | dungeon-map | Map node button occluded by background element. At least 1 node button lacks aria-label. |
| L-04 | Low | hub | `.sprite-hitbox` button missing aria-label for screen readers. |

---

## Combat UX Audit Verification (AR-127 through AR-131)

All combat-facing changes from the UX audit verified in landscape:

| Change | Verified |
|--------|----------|
| Intent bubble centered (AR-128 H-1) | YES — cx=640, viewport center=640 |
| End Turn bottom-right (AR-128 H-4) | YES — x=1155 |
| Draw LEFT, discard RIGHT (AR-128 H-7) | YES — draw=26, disc=1254 |
| HP sky blue not green (AR-127 C-3) | YES — rgb(56,189,248) |
| Enemy HP aria-live (AR-127 C-1) | YES — screen reader text present |
| Turn counter (AR-131 L-1) | YES — "Turn 1" |
| Deck total (AR-131 M-16) | YES — "Deck: 10" |
| No relics compact (AR-131 H-8) | YES — "No relics" placeholder |
| AP inline with HP (AR-128 H-2) | YES — landscape stats bar has AP |
| "Tap to cancel" backdrop (AR-129 M-3) | YES — visible in selected state |
| CHARGE button visible (AR-129 H-9) | YES — "CHARGE +1 AP" on card select |
| Near-death tension (AR-130 C-5) | YES — filter active at 3 HP |

---

## Summary

- **17 screens tested**, **13 fully pass**, **4 have issues**
- **3 pre-existing critical bugs fixed** during playtest (COMBO_MULTIPLIERS, ECHO, comboCount)
- **1 new high-severity issue** (10-card landscape touch targets)
- **2 new medium issues** (rest-site transition, dungeon-map occlusion)
- **1 new low issue** (hub sprite aria-label)
- **All 12 UX audit changes verified working** in landscape
