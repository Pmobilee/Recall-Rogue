# Svelte Stores — Gameplay State

> **Purpose:** Complex gameplay runtime stores — combat, co-op, and camp upgrade state
> **Last verified:** 2026-03-31
> **Source files:** `src/ui/stores/combatState.ts`, `src/ui/stores/coopState.ts`, `src/ui/stores/campState.ts`

> See also: [stores.md](stores.md) for the singleton store pattern, routing, player data, settings, and all other stores

> **Note:** classroomStore and parentalStore are also documented here as complex gameplay-state stores.

---

### combatState — Live Combat UI

**File:** `src/ui/stores/combatState.ts`

**`combatState: Writable<CombatUIState>`** (singletonWritable)

```ts
interface CombatUIState {
  active: boolean
  encounterType: 'creature' | 'boss'
  creature: Creature | Boss | null
  playerHp, playerMaxHp, creatureHp, creatureMaxHp: number
  turn: number
  bossPhase: number
  log: string[]
  awaitingQuiz: boolean
  result: 'victory' | 'defeat' | 'fled' | null
  pendingLoot: { mineralTier: string; amount: number }[]
  companionXpEarned: number
}
```

Written by the combat turn manager. Consumed by `CardCombatOverlay.svelte`, `ChallengeQuizOverlay.svelte`, `InRunTopBar.svelte`.

### coopState — Co-op Runtime

**File:** `src/ui/stores/coopState.ts`

All plain `writable` stores for the (unimplemented/future) co-op mode.

| Export | Type | Purpose |
|---|---|---|
| `coopRole` | `Writable<CoopRole\|null>` | `'miner'` or `'scholar'`; null = solo |
| `partnerStatus` | `Writable<PartnerStatus\|null>` | Partner connection info |
| `activeBuff` | `Writable<ActiveBuff\|null>` | Currently applying Scholar buff |
| `coopQuizQueue` | `Writable<CoopQuizItem[]>` | Scholar's pending quiz items |
| `inRecoveryMode` | `Writable<boolean>` | Partner disconnected, recovery window |
| `recoveryTicksLeft` | `Writable<number>` | Ticks remaining to reconnect |
| `coopRoomId` | `Writable<string\|null>` | Active room ID |
| `showScholarPanel` | `Readable<boolean>` | Derived: role=scholar AND partner≠null |

**`resetCoopState()`** — resets all stores to initial values.

### campState — Hub Camp Upgrades

**File:** `src/ui/stores/campState.ts`

**`campState: Writable<CampState>`** — persisted to `localStorage('recall-rogue-camp-state')` on every write.

Tracks upgrade tiers and visual forms for 9 camp elements: `'tent'`, `'campfire'`, `'character'`, `'pet'`, `'library'`, `'questboard'`, `'shop'`, `'journal'`, `'doorway'`.

**Helpers exported:** `getCampUpgradeCost(element, currentTier)`, `setCampTier(element, tier)`, `setCampForm(element, form)`, `setCampOutfit(outfit)`, `unlockCampPet(pet)`, `setActiveCampPet(pet)`.

**Consumed by:** `CampHudOverlay.svelte`, hub screen components.

### classroomStore — Classroom Membership

**File:** `src/ui/stores/classroomStore.ts`

**`classroomStore`** — custom writable with auto-persist to `localStorage('tg_classroom_state')`. Methods: `set(state)`, `update(fn)`, `clear()`.

```ts
interface ClassroomState {
  classroomId: string | null
  className: string | null
  activeAssignment: ActiveAssignment | null  // { id, title, categories, dueDate }
}
```

Updated by `classroomService` on app launch and every 30 minutes.

### parentalStore — Parental Controls

**File:** `src/ui/stores/parentalStore.ts`

**`parentalStore: Writable<ParentalSettings>`** — persisted to `localStorage('rr_parental_v1')`. PIN stored as SHA-256 hex digest (never plaintext in storage).

```ts
interface ParentalSettings {
  pinHash: string | null    // SHA-256, key: 'recall-rogue:pin:' + pin
  pin: string | null        // in-memory only, never persisted
  limitSeconds: number      // 3600 default
  socialEnabled: boolean    // false default
  parentEmail: string | null
  weeklyReportEnabled: boolean
  kidThemeEnabled: boolean
  unlockedFloors?: string[]
}
```

**Helpers:** `setPin(rawPin)`, `verifyPin(candidate)` (both async via Web Crypto), `updateParentalSettings(patch)`, `removePin()`, `hashPin(pin)`.
