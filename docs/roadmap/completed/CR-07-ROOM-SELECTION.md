# CR-07: Room Selection

> **Goal:** 3-door room choice between encounters, floor progression with boss encounters, domain selection at run start, and basic run lifecycle (start → encounters → rooms → boss → next floor → end). This phase wires together the full game loop from CR-02 through CR-06 into a playable run.

## Overview

| Field | Value |
|-------|-------|
| Dependencies | CR-01 (Card Foundation), CR-02 (Encounter Engine), CR-03 (Combat Scene), CR-04 (Card Hand UI) |
| Estimated Complexity | Medium-High (2-3 days) |
| Priority | P0 — Core Prototype |

After each combat encounter, the player chooses from 3 doors — each leading to a different room type (combat, mystery, rest, treasure, shop). This is a simplified version of Slay the Spire's branching map, optimized for mobile: 3 options instead of a full map, decision takes 2-3 seconds instead of 15-30, and preserves 80% of the agency value at 20% of the cognitive cost (03_UX_IMPROVEMENTS.md Section 2).

This phase also implements the full run lifecycle: domain selection → floor encounters → room selection → boss → next floor → run end.

**Run structure (from GAME_DESIGN.md Section 4):**
| Segment | Floors | Encounters/Floor | Boss |
|---------|--------|-----------------|------|
| 1 (Easy) | 1-3 | 3 + 1 event | Floor 3: "The Excavator" |
| 2 (Medium) | 4-6 | 3 + 1-2 events | Floor 6: "Magma Core" |
| 3 (Hard) | 7-9 | 3 + 2 events | Floor 9: "The Archivist" |
| Endless | 10+ | Scaling | Mini-boss every 3 |

---

## Sub-steps

### 1. FloorManager service

**File:** `src/services/floorManager.ts`

Create the floor/encounter progression service.

```typescript
export interface FloorState {
  currentFloor: number           // 1-based
  currentEncounter: number       // 1-based within the floor (1-3 for combat, 4+ for events)
  encountersPerFloor: number     // 3 for floors 1-9, scales for endless
  eventsPerFloor: number         // 1 for floors 1-3, 1-2 for 4-6, 2 for 7-9
  isBossFloor: boolean           // True if currentFloor is 3, 6, or 9
  bossDefeated: boolean          // True after boss encounter on this floor
  segment: 1 | 2 | 3 | 4        // Which difficulty segment (1=easy, 4=endless)
}

export interface RoomOption {
  type: 'combat' | 'mystery' | 'rest' | 'treasure' | 'shop'
  icon: string                    // Icon identifier for UI
  label: string                   // Display text
  enemyType?: string              // For combat rooms: which enemy (visible to player)
  hidden: boolean                 // True for mystery rooms
}

export class FloorManager {
  private state: FloorState

  /** Initialize for a new run */
  startRun(): void

  /** Generate 3 room options after an encounter */
  generateRoomOptions(): RoomOption[]

  /** Advance to the next encounter within a floor */
  advanceEncounter(): void

  /** Advance to the next floor (after boss or cash-out) */
  advanceFloor(): void

  /** Check if current encounter is the boss encounter */
  isBossEncounter(): boolean

  /** Get floor timer duration (GAME_DESIGN.md §7) */
  getTimerDuration(): number

  /** Get current floor's difficulty segment */
  getSegment(): 1 | 2 | 3 | 4
}
```

**Room generation rules (from GAME_DESIGN.md Section 4, 03_UX_IMPROVEMENTS.md Section 2):**
- Always generate exactly 3 options
- At least 1 option MUST be a combat room (prevents heal-stacking to avoid all facts)
- Combat rooms: show enemy type (e.g., "Cave Bats", "Crystal Golem") — NOT hidden
- Mystery rooms: always hidden (type is '?', label is 'Mystery')
- Rest rooms: show "Heal 30% or Upgrade" text
- Treasure rooms: show "Free card reward" text
- Shop rooms: show "Buy/remove cards" text
- Room type weights by segment:
  - Segment 1 (floors 1-3): combat 50%, mystery 20%, rest 15%, treasure 10%, shop 5%
  - Segment 2 (floors 4-6): combat 40%, mystery 25%, rest 15%, treasure 10%, shop 10%
  - Segment 3 (floors 7-9): combat 35%, mystery 25%, rest 20%, treasure 10%, shop 10%
- After boss encounter: only "Continue Deeper" or "Cash Out" (handled in CR-09; for now just auto-advance)

**Floor timer durations:**
```typescript
function getTimerForFloor(floor: number): number {
  if (floor <= 3) return 12
  if (floor <= 6) return 9
  if (floor <= 9) return 7
  if (floor <= 12) return 5
  return 4  // Floor 13+
}
```

### 2. RoomSelection.svelte — 3-door UI

**File:** `src/ui/components/RoomSelection.svelte`

The room selection screen shown between encounters.

**Props:**
```typescript
interface RoomSelectionProps {
  options: RoomOption[]         // Always 3
  currentHp: number
  maxHp: number
  currentFloor: number
  encounterNumber: number
  onSelect: (index: number) => void
}
```

**Layout (from 03_UX_IMPROVEMENTS.md Section 2):**
The room selection uses the full interaction zone (bottom 45%) with a preview in the display zone.

**Display zone (top 55%):**
- "Choose Your Path" header text, 20px, centered
- Current floor and encounter counter: "Floor 2 — Next Encounter"
- Player HP display: heart icon + "65 / 100" with color-coded bar

**Interaction zone (bottom 45%):**
- 3 room option cards arranged horizontally, evenly spaced
- Each card: 100dp wide, 140dp tall, rounded corners (8dp radius)
- Card layout (top to bottom):
  - Icon (32x32dp): sword/question-mark/heart/chest/bag
  - Room type label (14px, bold): "Combat", "Mystery", "Rest", "Treasure", "Shop"
  - Detail text (12px, muted): "Cave Bats", "???", "Heal 30%", "Free card", "Buy/sell"
  - For combat: enemy name in red text
  - For mystery: "???" in purple text
- Card background: #1E2D3D, border: #3498DB (1dp)
- On tap: border highlights gold, brief scale-up (1.05x, 100ms), then transition to selected room

**Icon mapping:**
| Room Type | Icon | Border Color |
|-----------|------|-------------|
| Combat | Sword/crossed-swords | #E74C3C (red) |
| Mystery | Question mark | #9B59B6 (purple) |
| Rest | Heart/campfire | #2ECC71 (green) |
| Treasure | Chest | #F1C40F (gold) |
| Shop | Bag/coins | #E67E22 (orange) |

**Data-testid attributes:** `data-testid="room-choice-0"`, `room-choice-1`, `room-choice-2`

**Touch targets:** Each card is 100x140dp, well above the 48x48dp minimum.

### 3. RunManager service

**File:** `src/services/runManager.ts`

Manages the overall run lifecycle from start to end.

```typescript
export interface RunState {
  isActive: boolean
  primaryDomain: string          // Player-chosen primary domain (40% of card pool)
  secondaryDomain: string        // Player-chosen secondary domain (30% of card pool)
  currentFloor: number
  currentEncounter: number
  playerHp: number
  playerMaxHp: number
  currency: number               // In-run currency for shops
  cardsEarned: number            // Count of cards earned this run
  factsAnswered: number          // Total facts attempted
  factsCorrect: number           // Total correct answers
  bestCombo: number              // Highest combo achieved in run
  runsCompleted: number          // Lifetime runs (for meta-progression tracking)
  startedAt: number              // Timestamp
}

export class RunManager {
  private state: RunState
  private floorManager: FloorManager

  /** Start a new run with selected domains */
  startRun(primaryDomain: string, secondaryDomain: string): void

  /** Get the current run state */
  getState(): RunState

  /** Record a card play result */
  recordCardPlay(correct: boolean, comboCount: number): void

  /** Apply damage to player */
  damagePlayer(amount: number): number  // Returns remaining HP

  /** Heal player */
  healPlayer(amount: number): number    // Returns new HP

  /** Check if run is over (HP <= 0) */
  isDefeated(): boolean

  /** End the run (victory or defeat) */
  endRun(reason: 'victory' | 'defeat' | 'cashout'): RunEndData

  /** Save run state for resume on app reopen */
  saveRunState(): void

  /** Load saved run state (returns null if no saved run) */
  loadRunState(): RunState | null
}
```

**Run flow:**
1. Domain selection → `runManager.startRun(primary, secondary)`
2. FloorManager generates first encounter
3. Player completes encounter (CR-02 TurnManager)
4. FloorManager generates room options → RoomSelection.svelte
5. Player picks room → navigate to appropriate screen
6. Repeat steps 3-5 until:
   - Boss defeated → advance floor (or cash-out in CR-09)
   - Player HP <= 0 → defeat → RunEndScreen
   - Player chooses to surface → victory → RunEndScreen

**Session persistence (from GAME_DESIGN.md Section 22):**
- Save run state after every encounter via `@capacitor/preferences` (use existing `src/services/storageService.ts`)
- JSON serialization of RunState (< 5KB)
- On app reopen: check for saved run, offer resume
- Runs survive closure for 24 hours

### 4. DomainSelection.svelte — Pre-run domain picker

**File:** `src/ui/components/DomainSelection.svelte`

Screen shown before starting a run where the player picks primary and secondary knowledge domains.

**Props:**
```typescript
interface DomainSelectionProps {
  availableDomains: DomainInfo[]  // 3-8 domains based on unlocks
  onStartRun: (primary: string, secondary: string) => void
  onBack: () => void
}

interface DomainInfo {
  id: string
  name: string
  icon: string
  color: string
  factCount: number              // Available facts in this domain
  masteredCount: number          // Player's mastered facts in domain
  locked: boolean                // Locked until 25 facts mastered (GAME_DESIGN.md §9)
}
```

**Domains (mapped from GAME_DESIGN.md Section 2):**
| Domain | Card Type | Color | Icon |
|--------|-----------|-------|------|
| Science & Nature | Attack | #E74C3C | Sword |
| History & Culture | Shield | #3498DB | Shield |
| Geography & World | Utility | #F1C40F | Star |
| Language & Vocabulary | Heal | #2ECC71 | Heart |
| Math & Logic | Buff | #9B59B6 | Arrow-up |
| Arts & Literature | Debuff | #E67E22 | Arrow-down |
| Medicine & Health | Regen | #1ABC9C | Plus |
| Technology & Computing | Wild | #95A5A6 | Diamond |

**Layout:**
- Header: "Choose Your Domains" (20px, centered)
- Subtext: "Primary (40% cards) and Secondary (30% cards)" (14px, muted)
- Domain cards: grid of 2 columns, each card 160dp wide, 80dp tall
- Card shows: icon, domain name, fact count, mastered count
- Selection flow:
  1. Tap first domain → highlighted as "Primary" (bold gold border)
  2. Tap second domain → highlighted as "Secondary" (silver border)
  3. Tap already-selected domain → deselect it
  4. Cannot select same domain as both primary and secondary
- Locked domains: grayed out with lock icon, tap shows "Master 25 facts to unlock"
- "Start Run" button at bottom: disabled until both primary and secondary selected
  - `data-testid="btn-start-run"`
  - 200dp wide, 56dp tall, centered
  - Green background (#27AE60) when enabled, gray when disabled

**First-time players:** Only 2-3 domains unlocked initially. GAME_DESIGN.md Section 9 says domain unlocking requires mastering 25 facts. For the prototype, start with Science, History, and Language unlocked.

### 5. RunEndScreen.svelte — Post-run summary

**File:** `src/ui/components/RunEndScreen.svelte`

Shown after a run ends (victory or defeat). Basic version here; expanded in CR-15.

**Props:**
```typescript
interface RunEndScreenProps {
  result: 'victory' | 'defeat' | 'cashout'
  floorReached: number
  factsAnswered: number
  accuracy: number               // Percentage (0-100)
  bestCombo: number
  cardsEarned: number
  onPlayAgain: () => void
  onHome: () => void
}
```

**Layout (from 03_UX_IMPROVEMENTS.md Section 12):**
- Full-screen overlay with dark background
- Header: "EXPEDITION COMPLETE" (victory/cashout) or "EXPEDITION FAILED" (defeat), 24px
- Stats list:
  - "Floor Reached: 6/9"
  - "Facts Answered: 42"
  - "Accuracy: 81%"
  - "Best Combo: 4x"
  - "Cards Earned: 3"
- Buttons at bottom:
  - "Play Again" (primary, green) — `data-testid="btn-play-again"`
  - "Home" (secondary, gray) — `data-testid="btn-home"`
  - Both: full width, 56dp height, 8dp spacing

**Defeat-specific:**
- Header in muted red (#E74C3C at 80% opacity, not aggressive)
- Encouraging subtext: "You made it to Floor 4. Try a different strategy?"

**Victory-specific:**
- Header in gold (#FFD700)
- Celebratory subtext: "You've surfaced with your knowledge intact."

### 6. Mystery room events

**File:** `src/services/floorManager.ts` (add mystery event logic)

When player selects a mystery room, resolve a random event.

**Mystery event types (5 base events for prototype):**

```typescript
interface MysteryEvent {
  id: string
  name: string
  description: string
  effect: MysteryEffect
}

type MysteryEffect =
  | { type: 'heal', amount: number }         // Heal 15-25% HP
  | { type: 'damage', amount: number }        // Lose 10-15% HP
  | { type: 'freeCard', rarity: 'common' | 'uncommon' }  // Get a free card
  | { type: 'nothing', message: string }      // Flavor text, no effect
  | { type: 'choice', options: MysteryChoice[] }  // Player picks between 2 options
```

**Events:**
1. **"Healing Spring"** — Heal 20% HP. "You find a natural spring. The water is cool and restorative."
2. **"Unstable Ground"** — Lose 10% HP. "The floor crumbles beneath your feet."
3. **"Forgotten Cache"** — Free common card. "An old miner's supply cache, still intact."
4. **"Empty Chamber"** — Nothing. "The room is empty, save for an echo of footsteps."
5. **"Trader's Gambit"** — Choice: trade 20% HP for a free uncommon card, or leave safely. "A shadowy figure offers a trade..."

**UI for mystery events:**

**File:** `src/ui/components/MysteryEventOverlay.svelte`

- Dark overlay with event name (18px, purple) and description (14px, white)
- Shows effect icon (heart for heal, skull for damage, card for reward, dash for nothing)
- For choice events: 2 buttons with option descriptions
- "Continue" button to dismiss after resolution
- `data-testid="mystery-event"`, `data-testid="mystery-continue"`

### 7. Rest room

**File:** `src/ui/components/RestRoomOverlay.svelte`

When player selects a rest room, they choose between two options.

**Layout:**
- Header: "Rest Site" (18px, green)
- Subtext: "Choose one:" (14px)
- Two option cards side by side (each 150dp wide, 120dp tall):
  1. **"Rest"** — Heart icon, "Heal 30% HP", current HP shown below
     - `data-testid="rest-heal"`
  2. **"Upgrade"** — Arrow-up icon, "Upgrade one card (+25% effect for rest of run)"
     - `data-testid="rest-upgrade"`
     - When selected: show list of cards in deck, tap one to upgrade
     - Upgraded card gets a visual indicator (gold border flash) and +25% to baseEffectValue for remainder of run

**Heal math:** `Math.round(playerMaxHp * 0.3)`, capped at maxHp.

**Upgrade effect:** Store the upgrade as a modifier on the card's runtime state (not persisted to SM-2). Lasts for current run only.

### 8. Wire into full game flow

**File:** `src/services/gameFlowController.ts` (new — orchestrates screen transitions)

Create a controller that manages the game flow state machine:

```typescript
type GameFlowState =
  | 'mainMenu'
  | 'domainSelection'
  | 'combat'
  | 'roomSelection'
  | 'mysteryEvent'
  | 'restRoom'
  | 'treasureRoom'
  | 'shopRoom'       // Placeholder — full shop in future phase
  | 'bossEncounter'
  | 'runEnd'

export class GameFlowController {
  private flowState: GameFlowState = 'mainMenu'
  private runManager: RunManager
  private floorManager: FloorManager

  /** Start a new run — transitions to domain selection */
  newRun(): void

  /** Domain selected — transitions to first combat encounter */
  onDomainsSelected(primary: string, secondary: string): void

  /** Combat encounter complete — generate rooms and transition */
  onEncounterComplete(result: EncounterResult): void

  /** Room selected — transition to appropriate screen */
  onRoomSelected(room: RoomOption): void

  /** Mystery event resolved — return to room selection or next encounter */
  onMysteryResolved(): void

  /** Rest room resolved — return to room selection or next encounter */
  onRestResolved(): void

  /** Boss defeated — advance floor or end run */
  onBossDefeated(): void

  /** Player defeated (HP <= 0) — transition to run end */
  onPlayerDefeated(): void

  /** Run end — transition to run end screen */
  onRunEnd(reason: 'victory' | 'defeat' | 'cashout'): void
}
```

**State machine transitions:**
```
mainMenu → domainSelection (on "New Run" tap)
domainSelection → combat (on domains selected, encounter 1 starts)
combat → roomSelection (on encounter complete, if not boss/end)
combat → bossEncounter (on last encounter of boss floor)
combat → runEnd (on player defeat, HP <= 0)
roomSelection → combat (on combat room selected)
roomSelection → mysteryEvent (on mystery room selected)
roomSelection → restRoom (on rest room selected)
roomSelection → treasureRoom (on treasure room selected)
roomSelection → shopRoom (on shop room selected)
mysteryEvent → roomSelection (on event resolved, if encounters remain)
mysteryEvent → combat (on event resolved, if this was the event slot)
restRoom → roomSelection | combat (same as mystery)
bossEncounter → combat (boss is a combat encounter with special enemy)
bossEncounter → runEnd (on boss defeat, auto-advance for prototype)
runEnd → mainMenu (on "Home")
runEnd → domainSelection (on "Play Again")
```

**File:** `src/App.svelte`

Update the main app router to handle new screens. Map GameFlowController states to `currentScreen` store values:
- `domainSelection` → add to Screen type
- `roomSelection` → add to Screen type
- `mysteryEvent` → add to Screen type
- `restRoom` → add to Screen type
- `runEnd` → map to existing 'runStats' or add new value

**File:** `src/ui/stores/gameState.ts`

Add new Screen values:
```typescript
export type Screen =
  | /* ...existing... */
  | 'domainSelection'
  | 'roomSelection'
  | 'mysteryEvent'
  | 'restRoom'
```

---

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | FloorManager generates 3 room options after each encounter | Console log room options, verify 3 returned |
| 2 | At least 1 combat room in every room selection | Run 20 room generations, verify constraint |
| 3 | Combat rooms show enemy type, mystery rooms are hidden | Screenshot of room selection UI |
| 4 | RoomSelection.svelte renders 3 cards with correct icons | Playwright screenshot at 390x844 |
| 5 | Room selection data-testid attributes present | DOM query for `room-choice-0/1/2` |
| 6 | DomainSelection shows available domains with correct info | Screenshot of domain picker |
| 7 | Cannot start run without selecting both primary and secondary | Verify button disabled state |
| 8 | RunEndScreen shows correct stats after run | Complete a 3-encounter run, check stats |
| 9 | Mystery events resolve with correct effects (heal, damage, card, nothing, choice) | Trigger each event type, verify state change |
| 10 | Rest room heal: restores exactly 30% of max HP | Set HP to 50/100, heal → verify 80/100 |
| 11 | Rest room upgrade: card gets +25% effect for rest of run | Upgrade a 10-damage card, verify it deals 12-13 |
| 12 | Full game loop: domain select → 3 encounters → rooms between → boss → end | Play through complete run |
| 13 | Floor timer scales correctly (12s/9s/7s/5s/4s) | Check timer on floors 1, 4, 7, 10, 13 |
| 14 | Run state saves after each encounter | Kill app mid-run, reopen → resume prompt |
| 15 | Run end: "Play Again" starts new run, "Home" returns to menu | Test both buttons |
| 16 | Boss encounter at end of floor 3 | Play through 3 floors, verify boss appears |

---

## Verification Gate

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` passes (add unit tests for FloorManager room generation rules)
- [ ] Full playable run: domain selection → 3 encounters with room selection between → floor 1 boss → run end — verified via Playwright screenshots at each stage
- [ ] Room selection shows 3 options with at least 1 combat — verified via 10+ screenshots
- [ ] Domain selection enforces primary/secondary constraint — verified via interaction test
- [ ] Mystery events work for all 5 types — verified via forced event testing
- [ ] Rest room heal and upgrade both work correctly — verified via state inspection
- [ ] Floor timer durations correct per floor — verified via timer bar observation
- [ ] Run state persists across simulated app restart — verified via storage inspection
- [ ] No console errors during full run lifecycle
- [ ] Screen transitions are smooth (no flash of wrong screen)

---

## Files Affected

| Action | File |
|--------|------|
| CREATE | `src/services/floorManager.ts` |
| CREATE | `src/services/runManager.ts` |
| CREATE | `src/services/gameFlowController.ts` |
| CREATE | `src/ui/components/RoomSelection.svelte` |
| CREATE | `src/ui/components/DomainSelection.svelte` |
| CREATE | `src/ui/components/RunEndScreen.svelte` |
| CREATE | `src/ui/components/MysteryEventOverlay.svelte` |
| CREATE | `src/ui/components/RestRoomOverlay.svelte` |
| CREATE | `src/services/__tests__/floorManager.test.ts` — Unit tests for room generation, floor progression |
| CREATE | `src/services/__tests__/runManager.test.ts` — Unit tests for run lifecycle, HP math |
| MODIFY | `src/ui/stores/gameState.ts` — Add 'domainSelection', 'roomSelection', 'mysteryEvent', 'restRoom' to Screen type |
| MODIFY | `src/App.svelte` — Route new screen types to corresponding components |
| MODIFY | `src/ui/components/CombatOverlay.svelte` — Wire encounter-complete to gameFlowController |
