# Phase 48: Prestige & Endgame Systems

**Status**: Pending
**Depends on**: Phase 8 (Mine Gameplay Overhaul), Phase 9 (Biome Expansion), Phase 10 (Dome Hub
Redesign), Phase 13 (Knowledge Tree 2.0), Phase 15 (GAIA Personality 2.0), Phase 17
(Addictiveness Pass), Phase 22 (Social & Multiplayer), Phase 47 (Achievement Gallery)
**Estimated complexity**: High — touches save schema, Phaser dome rendering, SM-2 data layer,
GAIA dialogue system, and server analytics
**Design decisions referenced**: DD-V2-050 (prestige system), DD-V2-051 (mentor mode),
DD-V2-052 (endgame challenge mode), DD-V2-161 (GAIA peer shift), DD-V2-163 (engagement
scoring)

---

## Overview

Phase 48 is the endgame pillar of Terra Gacha. It activates when a player approaches or reaches
total mastery of the fact database — a milestone defined as 100% of available facts at SM-2
`interval >= 60` days (general) or `>= 30` days (vocabulary). At that threshold, the game
transforms rather than ending: the dome visually becomes golden, GAIA shifts from teacher to
intellectual peer, a prestige reset loop opens for players who want a fresh challenge, and a
suite of post-mastery difficulty modes offers permanent engagement for completionists.

The phase has six tightly coupled sub-phases:

1. **48.1 — Prestige System**: voluntary progress reset in exchange for permanent stacking
   bonuses and a visible prestige level badge. Up to prestige 10.
2. **48.2 — Omniscient Golden Dome**: a full visual transformation of the DomeScene Phaser
   rendering when the player first reaches 100% mastery; aurora particle system, golden
   Knowledge Tree sprite variant, glowing floor tiles.
3. **48.3 — Mentor Mode**: opt-in feature where mastered players author hint cards for facts
   they struggled with, which are surfaced to newer players; teaching earns prestige points.
4. **48.4 — Post-Mastery Challenge Mode**: harder quiz variants (speed round, no-hint, reverse
   question), new in-mine blocks that require challenge-mode answers, and streak-based scoring
   leaderboard.
5. **48.5 — Biome Completion Bonuses**: reaching 100% fact mastery for all facts tagged to a
   specific biome tier unlocks a unique cosmetic title and a permanent passive modifier for
   that biome in future dives.
6. **48.6 — GAIA Peer Dialogue**: GAIA drops the teacher register entirely, speaks as an
   intellectual equal, surfaces philosophical reflections based on the player's full learning
   history, and occasionally asks the player genuine questions.

**Philosophy**: Endgame content must respect that mastery is a real achievement. Nothing in
Phase 48 devalues completed SM-2 progress. Prestige resets are strictly opt-in with explicit
confirmation. Challenge modes are separate tracks, not replacements. GAIA never mocks or
condescends — she is genuinely awed.

---

## Prerequisites

Before beginning Phase 48, verify the following pass `npm run typecheck`:

- [ ] `src/data/omniscientQuips.ts` exists, exports `OMNISCIENT_QUIPS` and `getOmniscientQuip()`
- [ ] `src/data/knowledgeTreeStages.ts` `TREE_STAGES[5]` (`Ancient Tree`, minMastered: 1001) exists
- [ ] `src/services/sm2.ts` exports `isMastered()` that checks `interval >= 60` for general facts
- [ ] `src/data/biomes.ts` exports `BIOMES` array with all 25 `BiomeId` entries
- [ ] `src/game/scenes/DomeScene.ts` (or `DomeScene.svelte`) renders the Knowledge Tree sprite
- [ ] `src/ui/stores/playerData.ts` exports `playerSave` writable and `updateReviewState()`
- [ ] `src/data/types.ts` `PlayerSave` interface includes `titles`, `activeTitle`, `reviewStates`
- [ ] `src/data/gaiaDialogue.ts` exports `GAIA_TRIGGERS` with at least `mineEntry`, `lowOxygen`
- [ ] `server/src/routes/analytics.ts` is a registered Fastify route

---

## Sub-Phase 48.1: Prestige System

### What

A voluntary reset of all SM-2 review states (facts return to `interval: 0, repetitions: 0`)
in exchange for a permanent stacking prestige bonus applied to every future dive. The player
chooses prestige from a dedicated screen; a two-step confirmation is mandatory. Prestige level
(1-10) is permanent, never resets, and is displayed as a badge on leaderboards, the dome
guestbook, and the player profile.

Prestige bonuses stack multiplicatively per level. All bonuses are purely quality-of-life or
cosmetic — no prestige bonus may increase learning speed in a way that undermines SM-2
integrity (i.e., no bonus may skip review intervals).

### Files to Create

| File | Purpose |
|---|---|
| `src/data/prestigeConfig.ts` | Prestige level definitions, bonus table, unlock conditions |
| `src/ui/components/PrestigeScreen.svelte` | Full-screen prestige confirmation UI |
| `src/ui/components/PrestigeBadge.svelte` | Small inline badge rendered next to player name |
| `src/services/prestigeService.ts` | Logic: eligibility check, apply reset, compute cumulative bonuses |

### Files to Modify

| File | Change |
|---|---|
| `src/data/types.ts` | Add `prestigeLevel`, `prestigedAt`, `lifetimeMasteredFacts` to `PlayerSave` |
| `src/data/balance.ts` | Add `PRESTIGE_MAX_LEVEL`, `PRESTIGE_BONUS_PER_LEVEL` block |
| `src/ui/stores/playerData.ts` | Add `applyPrestige()` exported function |
| `src/services/saveService.ts` | Handle `prestigeLevel` migration in save version guard |
| `src/ui/components/HubView.svelte` | Add "Prestige" button visible only when omniscient |
| `src/data/analyticsEvents.ts` | Add `prestige_triggered` event with level and lifetime_mastered |

### Step-by-Step

#### Step 1: Define prestige data in `src/data/prestigeConfig.ts`

```typescript
/**
 * Prestige level configuration.
 * DD-V2-050: voluntary SM-2 reset for permanent passive bonuses.
 * Max prestige: 10. Bonuses are additive per level.
 */

export interface PrestigeLevel {
  /** 1-10 */
  level: number
  /** Short display label, e.g. "Terra I" */
  label: string
  /** Hex color for badge background */
  badgeColor: string
  /** Icon character for badge */
  badgeIcon: string
  /**
   * Passive bonus applied from this level onwards (cumulative with lower levels).
   * All bonuses are cosmetic / convenience — none skip SM-2 intervals.
   */
  bonus: PrestigeBonus
}

export interface PrestigeBonus {
  /** Flat extra dust per mineral node mined (stacks across levels) */
  extraDustPerNode: number
  /** Extra inventory slots for every dive */
  extraInventorySlots: number
  /** Extra O2 on each layer transition (stacks with BALANCE.LAYER_OXYGEN_BONUS) */
  extraLayerO2: number
  /** Whether this level unlocks a unique cosmetic title */
  unlocksTitleId: string | null
  /** Whether this level unlocks a unique GAIA dialogue pool */
  unlocksDialoguePool: string | null
}

export const PRESTIGE_LEVELS: PrestigeLevel[] = [
  {
    level: 1,
    label: 'Terra I',
    badgeColor: '#c0a060',
    badgeIcon: 'I',
    bonus: {
      extraDustPerNode: 2,
      extraInventorySlots: 1,
      extraLayerO2: 3,
      unlocksTitleId: 'title_terra_i',
      unlocksDialoguePool: null,
    },
  },
  {
    level: 2,
    label: 'Terra II',
    badgeColor: '#c0a060',
    badgeIcon: 'II',
    bonus: {
      extraDustPerNode: 2,
      extraInventorySlots: 0,
      extraLayerO2: 3,
      unlocksTitleId: 'title_terra_ii',
      unlocksDialoguePool: null,
    },
  },
  {
    level: 3,
    label: 'Terra III',
    badgeColor: '#d4af37',
    badgeIcon: 'III',
    bonus: {
      extraDustPerNode: 3,
      extraInventorySlots: 1,
      extraLayerO2: 5,
      unlocksTitleId: 'title_terra_iii',
      unlocksDialoguePool: 'prestige_3_gaia',
    },
  },
  {
    level: 4,
    label: 'Terra IV',
    badgeColor: '#d4af37',
    badgeIcon: 'IV',
    bonus: {
      extraDustPerNode: 3,
      extraInventorySlots: 0,
      extraLayerO2: 5,
      unlocksTitleId: 'title_terra_iv',
      unlocksDialoguePool: null,
    },
  },
  {
    level: 5,
    label: 'Terra V',
    badgeColor: '#ffd700',
    badgeIcon: 'V',
    bonus: {
      extraDustPerNode: 5,
      extraInventorySlots: 1,
      extraLayerO2: 8,
      unlocksTitleId: 'title_terra_v',
      unlocksDialoguePool: 'prestige_5_gaia',
    },
  },
  // Levels 6-10 follow the same pattern with escalating bonuses.
  // Levels 6-8: extraDustPerNode +5, extraLayerO2 +8, slots every other level.
  // Levels 9-10: extraDustPerNode +8, extraLayerO2 +12, slots every level.
  // Full array omitted here for brevity — workers MUST implement all 10.
]

/**
 * Returns the cumulative prestige bonus for a given prestige level
 * by summing all bonuses from level 1 through the given level.
 */
export function getCumulativePrestigeBonus(level: number): PrestigeBonus {
  const relevant = PRESTIGE_LEVELS.filter(p => p.level <= level)
  return relevant.reduce<PrestigeBonus>(
    (acc, p) => ({
      extraDustPerNode: acc.extraDustPerNode + p.bonus.extraDustPerNode,
      extraInventorySlots: acc.extraInventorySlots + p.bonus.extraInventorySlots,
      extraLayerO2: acc.extraLayerO2 + p.bonus.extraLayerO2,
      unlocksTitleId: p.bonus.unlocksTitleId ?? acc.unlocksTitleId,
      unlocksDialoguePool: p.bonus.unlocksDialoguePool ?? acc.unlocksDialoguePool,
    }),
    {
      extraDustPerNode: 0,
      extraInventorySlots: 0,
      extraLayerO2: 0,
      unlocksTitleId: null,
      unlocksDialoguePool: null,
    },
  )
}
```

#### Step 2: Add fields to `src/data/types.ts` `PlayerSave`

Append to the `PlayerSave` interface, after the `referralRewardsEarned` field:

```typescript
  // Phase 48: Prestige & Endgame
  /** Current prestige level (0 = never prestiged). Permanent, never resets. */
  prestigeLevel?: number
  /** Unix timestamps of each prestige event. Length equals prestigeLevel. */
  prestigedAt?: number[]
  /** Total facts ever mastered across all prestige resets (cumulative lifetime counter). */
  lifetimeMasteredFacts?: number
  /** Which biomes the player has reached 100% fact mastery for. */
  completedBiomes?: string[]
  /** Whether challenge mode is currently active for the session. */
  challengeModeActive?: boolean
  /** Current challenge mode streak (resets on wrong answer). */
  challengeStreak?: number
  /** Total prestige points earned from mentoring. */
  mentorPrestigePoints?: number
  /** Fact IDs for which the player has authored a mentor hint. */
  authoredHints?: string[]
```

#### Step 3: Implement `src/services/prestigeService.ts`

```typescript
import { get } from 'svelte/store'
import { playerSave, persistPlayer } from '../ui/stores/playerData'
import { getCumulativePrestigeBonus, PRESTIGE_LEVELS } from '../data/prestigeConfig'
import type { PlayerSave } from '../data/types'
import { isMastered } from './sm2'
import { analyticsService } from './analyticsService'

export const PRESTIGE_MAX_LEVEL = 10

/**
 * Returns true when the player has mastered every fact in their reviewStates.
 * "Mastered" means isMastered() returns true for all tracked facts.
 * If the player has fewer than 50 mastered facts total, they cannot prestige
 * regardless (guard against accidental prestige on tiny saves).
 */
export function isEligibleForPrestige(save: PlayerSave): boolean {
  if ((save.prestigeLevel ?? 0) >= PRESTIGE_MAX_LEVEL) return false
  if (save.reviewStates.length < 50) return false
  return save.reviewStates.every(rs => isMastered(rs))
}

/**
 * Returns the active cumulative prestige bonus for the current save.
 */
export function getActivePrestigeBonus(save: PlayerSave) {
  return getCumulativePrestigeBonus(save.prestigeLevel ?? 0)
}

/**
 * Applies a prestige reset. MUST only be called after explicit player confirmation.
 * - Increments prestigeLevel
 * - Resets all reviewStates to repetitions=0, interval=0, nextReviewAt=0
 * - Accumulates lifetimeMasteredFacts from current mastered count
 * - Unlocks title from PrestigeLevel config
 * - Does NOT reset: minerals, cosmetics, companions, dome upgrades, achievements
 */
export function applyPrestige(save: PlayerSave): PlayerSave {
  const newLevel = (save.prestigeLevel ?? 0) + 1
  if (newLevel > PRESTIGE_MAX_LEVEL) {
    throw new Error('Cannot prestige beyond level ' + PRESTIGE_MAX_LEVEL)
  }

  const masteredCount = save.reviewStates.filter(rs => isMastered(rs)).length
  const config = PRESTIGE_LEVELS.find(p => p.level === newLevel)
  const newTitle = config?.bonus.unlocksTitleId

  const resetReviewStates = save.reviewStates.map(rs => ({
    ...rs,
    repetitions: 0,
    interval: 0,
    easeFactor: 2.5,
    nextReviewAt: 0,
    lastReviewAt: rs.lastReviewAt, // preserve history timestamp
    quality: 0,
  }))

  const updatedTitles = newTitle && !save.titles.includes(newTitle)
    ? [...save.titles, newTitle]
    : save.titles

  analyticsService.track('prestige_triggered', {
    new_level: newLevel,
    lifetime_mastered: (save.lifetimeMasteredFacts ?? 0) + masteredCount,
  })

  return {
    ...save,
    prestigeLevel: newLevel,
    prestigedAt: [...(save.prestigedAt ?? []), Date.now()],
    lifetimeMasteredFacts: (save.lifetimeMasteredFacts ?? 0) + masteredCount,
    reviewStates: resetReviewStates,
    titles: updatedTitles,
  }
}
```

#### Step 4: Implement `src/ui/components/PrestigeScreen.svelte`

The component is a full-screen overlay (z-index above HubView). It shows:
- Current prestige level badge (or "Not yet prestiged")
- Current mastered fact count vs total facts
- Prestige ineligibility reason if not eligible (e.g., "Master all facts first")
- If eligible: animated two-step confirmation
  - Step 1: "Are you sure? Your SM-2 progress will reset." with Cancel / Continue
  - Step 2: "This cannot be undone. Type PRESTIGE to confirm." (text input, case-insensitive)
- On confirm: call `prestigeService.applyPrestige()`, call `persistPlayer()`, close screen, show GAIA congratulation

```svelte
<script lang="ts">
  import { get } from 'svelte/store'
  import { playerSave, persistPlayer } from '../../stores/playerData'
  import { isEligibleForPrestige, applyPrestige } from '../../../services/prestigeService'
  import { gaiaMessage } from '../../stores/gameState'
  import { getOmniscientQuip } from '../../../data/omniscientQuips'

  export let onClose: () => void

  let step = 1
  let confirmText = ''
  let error = ''

  $: save = $playerSave
  $: eligible = save ? isEligibleForPrestige(save) : false
  $: currentLevel = save?.prestigeLevel ?? 0
  $: masteredCount = save?.reviewStates.filter(rs => rs.interval >= 60).length ?? 0
  $: totalFacts = save?.reviewStates.length ?? 0

  function handleContinue() {
    step = 2
  }

  function handleConfirm() {
    if (confirmText.trim().toUpperCase() !== 'PRESTIGE') {
      error = 'Please type PRESTIGE exactly to confirm.'
      return
    }
    if (!save || !eligible) return
    const updated = applyPrestige(save)
    playerSave.set(updated)
    persistPlayer()
    gaiaMessage.set(getOmniscientQuip('milestone'))
    onClose()
  }
</script>
```

#### Step 5: Wire into `HubView.svelte`

In `HubView.svelte`, import `PrestigeScreen` and show a "Prestige" button when:
- `$playerSave?.reviewStates.length > 0`
- `isEligibleForPrestige($playerSave)`

The button should pulse gold when first eligible (one-time animation, cleared on click).

### Acceptance Criteria

- [ ] `src/data/prestigeConfig.ts` exports `PRESTIGE_LEVELS` (10 entries), `getCumulativePrestigeBonus()`
- [ ] `isEligibleForPrestige()` returns `false` for saves with fewer than 50 mastered facts
- [ ] `applyPrestige()` resets all `reviewStates` to `interval: 0, repetitions: 0`
- [ ] `applyPrestige()` does NOT reset `minerals`, `ownedCosmetics`, `hubState`, `fossils`
- [ ] `applyPrestige()` increments `prestigeLevel` by exactly 1
- [ ] `applyPrestige()` appends current timestamp to `prestigedAt`
- [ ] PrestigeScreen step-2 confirmation requires exact "PRESTIGE" input (case-insensitive)
- [ ] `npm run typecheck` passes with no new errors

---

## Sub-Phase 48.2: Omniscient Golden Dome

### What

When `save.reviewStates.every(rs => isMastered(rs))` is true for the first time, the Dome
visual permanently transforms. The Knowledge Tree upgrades to a new `stage6` sprite
(`obj_knowledge_tree_stage6` — a golden, bioluminescent tree). The dome background shifts to a
warm gold-tinted palette. An aurora particle system fires in the DomeScene background. A
"OMNISCIENT" title is awarded. This transformation is checked on every app resume and on every
post-dive return.

### Files to Create

| File | Purpose |
|---|---|
| `src/ui/components/OmniscientReveal.svelte` | One-time full-screen reveal animation (plays once, stores flag) |

### Files to Modify

| File | Change |
|---|---|
| `src/data/knowledgeTreeStages.ts` | Add `TREE_STAGES[6]` for omniscient (minMastered: 3000, `obj_knowledge_tree_stage6`) |
| `src/game/scenes/DomeScene.ts` | Read omniscient flag from `PlayerSave`, apply golden tint + aurora particles |
| `src/ui/components/HubView.svelte` | On mount, check omniscient status and conditionally show OmniscientReveal |
| `src/data/types.ts` | Add `omniscientUnlockedAt?: number` to `PlayerSave` |

### Step-by-Step

#### Step 1: Add the omniscient tree stage to `src/data/knowledgeTreeStages.ts`

Append a 7th entry (index 6) to `TREE_STAGES`:

```typescript
{
  index: 6,
  label: 'Omniscient Tree',
  minMastered: 3000,
  spriteKey: 'obj_knowledge_tree_stage6',
  gaiaComment: "That tree is taller than my sensor array. I had to recalibrate just to see the top.",
},
```

Note: `minMastered: 3000` is the 3,000-fact content target from Phase 32. Before that milestone
is reached the omniscient check uses `isMastered()` on all `reviewStates` directly, not the
stage threshold. Both paths must be handled.

#### Step 2: Add `isOmniscient()` helper to `src/services/prestigeService.ts`

```typescript
/**
 * Returns true when every tracked fact in the save is mastered.
 * Also gates on a minimum of 50 facts to avoid false positives on new saves.
 */
export function isOmniscient(save: PlayerSave): boolean {
  if (!save || save.reviewStates.length < 50) return false
  return save.reviewStates.every(rs => isMastered(rs))
}
```

#### Step 3: Modify `DomeScene.ts` — golden tint and aurora particles

In the Phaser `DomeScene`, add a `private _omniscient = false` field. Expose a public method
`setOmniscient(value: boolean)` that:

1. Sets `_omniscient = value`
2. If `true`: applies a `0xffd700` tint multiply post-process effect (or Phaser Graphics overlay
   at 0.12 alpha) on the dome background tilemap layer
3. If `true`: starts an `auroraEmitter` Phaser particle emitter:
   - Emitter config: 2 particles/second, random x across full dome width, y starts at top
   - Particle: `lifespan: 4000`, `speedY: { min: 40, max: 80 }`, `alpha: { start: 0.6, end: 0 }`
   - Particle tint cycles through `[0xffd700, 0xffaa00, 0xffffff, 0xaaddff]`
   - Max 30 particles alive at any time
4. If `false`: destroys the emitter and removes the tint

Wire `setOmniscient()` to be called from `GameManager` or `HubView` whenever `playerSave`
changes.

#### Step 4: Implement `OmniscientReveal.svelte`

One-time full-screen reveal animation. Plays once (on first omniscient unlock), then stores
`terra_omniscient_revealed = 'true'` in `localStorage` so it never replays.

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { getOmniscientQuip } from '../../../data/omniscientQuips'
  import { playerSave, persistPlayer } from '../../stores/playerData'

  export let onDone: () => void

  const STORAGE_KEY = 'terra_omniscient_revealed'

  let phase: 'flash' | 'text' | 'done' = 'flash'
  const quote = getOmniscientQuip('greeting')

  onMount(() => {
    // Phase 1: white flash 600ms
    setTimeout(() => { phase = 'text' }, 600)
    // Phase 2: text visible 3s
    setTimeout(() => {
      phase = 'done'
      // Stamp omniscientUnlockedAt if not already set
      const save = $playerSave
      if (save && !save.omniscientUnlockedAt) {
        playerSave.set({ ...save, omniscientUnlockedAt: Date.now() })
        persistPlayer()
      }
      localStorage.setItem(STORAGE_KEY, 'true')
      onDone()
    }, 3600)
  })
</script>

{#if phase === 'flash'}
  <div class="overlay flash" />
{:else if phase === 'text'}
  <div class="overlay text-phase">
    <div class="title">OMNISCIENT</div>
    <div class="quote">{quote}</div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    pointer-events: all;
  }
  .flash { background: #fff; animation: flashOut 600ms forwards; }
  @keyframes flashOut { from { opacity: 1; } to { opacity: 0; } }
  .text-phase { background: rgba(0,0,0,0.85); }
  .title {
    font-size: 2.5rem; color: #ffd700;
    text-shadow: 0 0 20px #ffd700, 0 0 40px #ffaa00;
    letter-spacing: 0.3em; margin-bottom: 1.5rem;
    animation: pulseGold 2s ease-in-out infinite;
  }
  @keyframes pulseGold {
    0%, 100% { text-shadow: 0 0 20px #ffd700, 0 0 40px #ffaa00; }
    50% { text-shadow: 0 0 40px #ffd700, 0 0 80px #ffaa00; }
  }
  .quote { color: #fff; font-size: 1rem; text-align: center; max-width: 320px; }
</style>
```

### Acceptance Criteria

- [ ] `TREE_STAGES` now has 7 entries (index 0-6); `getTreeStage()` returns stage 6 at 3000+ mastered
- [ ] `isOmniscient()` returns false for saves with `reviewStates.length < 50`
- [ ] Golden tint visually applies to DomeScene when `setOmniscient(true)` is called
- [ ] Aurora particle emitter is destroyed (no memory leak) when `setOmniscient(false)`
- [ ] `OmniscientReveal` never replays after `localStorage.getItem('terra_omniscient_revealed')`
- [ ] `omniscientUnlockedAt` is stamped exactly once in `PlayerSave`
- [ ] `npm run typecheck` passes

---

## Sub-Phase 48.3: Mentor Mode

### What

Omniscient players may author "Hint Cards" for facts they once struggled with. A hint card is a
short player-written mnemonic (max 200 characters) associated with a specific `factId`. When
another player fails that fact for the third time in a session, they may be shown a "Miner's
Hint" from an anonymous author. Authoring and receiving positive votes on hint cards earns
prestige points, which unlock prestige-specific cosmetics and fuel higher prestige level
eligibility (DD-V2-051).

Hint cards go through a lightweight server-side moderation queue before being surfaced. All
hint text is sanitized server-side before storage (HTML strip, length cap, profanity filter).

### Files to Create

| File | Purpose |
|---|---|
| `src/ui/components/MentorHintEditor.svelte` | Inline editor for authoring a hint on a fact card |
| `src/ui/components/MentorHintDisplay.svelte` | Read-only hint display shown to struggling players |
| `src/services/mentorService.ts` | Client-side API calls for hint CRUD and voting |
| `server/src/routes/mentorHints.ts` | Fastify route: POST /mentor-hints, GET /mentor-hints/:factId, POST /mentor-hints/:id/vote |

### Files to Modify

| File | Change |
|---|---|
| `src/data/types.ts` | Already updated in 48.1 (`authoredHints`, `mentorPrestigePoints`) |
| `src/ui/components/FactReveal.svelte` | Show MentorHintDisplay when `failCount >= 3` and hint exists |
| `src/ui/stores/playerData.ts` | Add `awardMentorPrestigePoints(n)` function |

### Step-by-Step

#### Step 1: Define the hint data shape

In `src/services/mentorService.ts`:

```typescript
export interface MentorHint {
  id: string
  factId: string
  authorId: string          // anonymized on read (server strips to 'anonymous')
  hintText: string          // max 200 chars, sanitized
  upvotes: number
  createdAt: number
  status: 'pending' | 'approved' | 'rejected'
}

/**
 * Fetch the top-rated approved hint for a fact.
 * Returns null if none exist or the network is unavailable.
 */
export async function fetchHintForFact(factId: string): Promise<MentorHint | null> {
  try {
    const res = await fetch(`/api/mentor-hints/${encodeURIComponent(factId)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.hint ?? null
  } catch {
    return null
  }
}

/**
 * Submit a new hint card. Only callable when player is omniscient.
 * The server validates authorship and sanitizes hintText.
 */
export async function submitHint(factId: string, hintText: string): Promise<{ success: boolean; hintId?: string }> {
  const trimmed = hintText.trim().slice(0, 200)
  if (!trimmed) return { success: false }
  try {
    const res = await fetch('/api/mentor-hints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factId, hintText: trimmed }),
    })
    if (!res.ok) return { success: false }
    return await res.json()
  } catch {
    return { success: false }
  }
}

export async function voteOnHint(hintId: string, vote: 'up'): Promise<void> {
  try {
    await fetch(`/api/mentor-hints/${hintId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote }),
    })
  } catch { /* offline — silent fail */ }
}
```

#### Step 2: Implement `server/src/routes/mentorHints.ts`

The Fastify plugin registers three routes under prefix `/api/mentor-hints`:

- `GET /:factId` — returns the single highest-upvote approved hint for the fact, or 404.
  Author ID is stripped from the response.
- `POST /` — authenticated; requires valid JWT. Validates `hintText` length (<= 200 chars).
  Strips HTML. Inserts with `status: 'pending'`. Returns `{ success: true, hintId }`.
- `POST /:id/vote` — authenticated. Increments upvote count. Prevents double-vote via a
  `mentor_hint_votes` join table keyed on `(hint_id, player_id)`. Awards 1 prestige point to
  the author via a server-side `player_prestige_points` update.

#### Step 3: Show hint in `FactReveal.svelte`

```svelte
<!-- Inside FactReveal, when the quiz answer is wrong: -->
{#if failCountThisSession >= 3}
  {#await fetchHintForFact(fact.id)}
    <!-- loading, show nothing -->
  {:then hint}
    {#if hint}
      <MentorHintDisplay {hint} on:vote={() => voteOnHint(hint.id, 'up')} />
    {/if}
  {/await}
{/if}
```

The `failCountThisSession` counter is local component state, incremented on each wrong answer
for the current fact within the session. It resets when the fact changes.

### Acceptance Criteria

- [ ] `submitHint()` rejects strings longer than 200 characters (truncates to 200 client-side
  before sending; server also validates and returns 400 if > 200)
- [ ] Hints are never shown to the author who wrote them (server excludes by `authorId`)
- [ ] `MentorHintDisplay` is only shown when `failCountThisSession >= 3`
- [ ] A player cannot vote on the same hint twice (server returns 409 on duplicate vote)
- [ ] Voting awards prestige points to the original author (verified by checking the server log)
- [ ] `authoredHints` in `PlayerSave` is updated after `submitHint()` returns `success: true`
- [ ] `npm run typecheck` passes

---

## Sub-Phase 48.4: Post-Mastery Challenge Mode

### What

Three new quiz variants available only after the player has mastered at least 100 facts (not
requiring full omniscient status, to give aspirational players early access):

1. **Speed Round**: standard question, 8-second countdown; correct within 8s = double dust;
   wrong or timeout = no reward and streak break
2. **No-Hint Mode**: distractors are replaced with blank text boxes the player must fill via
   free text (iOS/Android keyboard); answer is compared case-insensitively against
   `acceptableAnswers`; mobile keyboard is dismissed after submission
3. **Reverse Mode**: the answer is shown; the player must pick the correct question stem from
   4 options

A `challengeStreak` counter tracks consecutive correct answers across all three modes combined.
High streaks (10, 25, 50) earn prestige points and unlock a challenge leaderboard slot.

In-mine: new `ChallengeGate` block (`BlockType.ChallengeGate = 28`) appears starting at layer
15. It always uses the current session's hardest mastered fact (lowest SM-2 ease factor). Passing
a ChallengeGate awards 2x the standard mineral drop for that layer.

### Files to Create

| File | Purpose |
|---|---|
| `src/ui/components/ChallengeQuizOverlay.svelte` | Unified overlay for all 3 challenge modes |
| `src/ui/components/SpeedRoundTimer.svelte` | Visual countdown bar for speed round |
| `src/services/challengeService.ts` | Session-scoped challenge state, streak tracking, prestige point award |

### Files to Modify

| File | Change |
|---|---|
| `src/data/types.ts` | Already updated in 48.1 (`challengeModeActive`, `challengeStreak`) |
| `src/data/balance.ts` | Add `CHALLENGE_SPEED_SECONDS`, `CHALLENGE_GATE_LAYER_THRESHOLD`, `CHALLENGE_STREAK_MILESTONES` |
| `src/data/types.ts` `BlockType` | Add `ChallengeGate = 28` |
| `src/game/scenes/MineScene.ts` | Handle `BlockType.ChallengeGate` tap → open `ChallengeQuizOverlay` |
| `src/game/systems/MineGenerator.ts` | Spawn `ChallengeGate` blocks at layers >= 15, max 2 per layer |
| `src/data/analyticsEvents.ts` | Add `challenge_mode_result` event |

### Step-by-Step

#### Step 1: Add balance constants to `src/data/balance.ts`

Add the following block after the existing `GACHA_TIERS` section:

```typescript
// === CHALLENGE MODE (DD-V2-052) ===
CHALLENGE_SPEED_SECONDS: 8,
CHALLENGE_GATE_LAYER_THRESHOLD: 15, // ChallengeGate blocks only spawn at layer >= 15
CHALLENGE_STREAK_MILESTONES: [10, 25, 50, 100] as const,
CHALLENGE_STREAK_PRESTIGE_POINTS: { 10: 5, 25: 15, 50: 40, 100: 100 } as Record<number, number>,
CHALLENGE_GATE_MINERAL_MULTIPLIER: 2.0,
```

#### Step 2: Implement `src/services/challengeService.ts`

```typescript
import { get } from 'svelte/store'
import { playerSave, persistPlayer } from '../ui/stores/playerData'
import { BALANCE } from '../data/balance'
import type { ReviewState } from '../data/types'

export type ChallengeMode = 'speed' | 'no_hint' | 'reverse'

class ChallengeService {
  private _streak = 0
  private _sessionPoints = 0

  get streak() { return this._streak }

  /** Called on correct challenge answer. Returns prestige points awarded (0 if no milestone). */
  onCorrect(): number {
    this._streak++
    const milestones = BALANCE.CHALLENGE_STREAK_MILESTONES
    const milestone = milestones.find(m => m === this._streak)
    if (milestone) {
      const points = BALANCE.CHALLENGE_STREAK_PRESTIGE_POINTS[milestone]
      this._sessionPoints += points
      this._awardPrestigePoints(points)
      return points
    }
    return 0
  }

  /** Called on wrong or timed-out answer. Resets streak. */
  onWrong(): void {
    this._streak = 0
  }

  /** Selects the hardest mastered fact for a ChallengeGate (lowest easeFactor, interval >= 30). */
  selectHardestMasteredFact(reviewStates: ReviewState[]): ReviewState | null {
    const mastered = reviewStates.filter(rs => rs.interval >= 30)
    if (mastered.length === 0) return null
    return mastered.reduce((a, b) => a.easeFactor < b.easeFactor ? a : b)
  }

  private _awardPrestigePoints(points: number): void {
    const save = get(playerSave)
    if (!save) return
    playerSave.set({
      ...save,
      mentorPrestigePoints: (save.mentorPrestigePoints ?? 0) + points,
    })
    persistPlayer()
  }
}

export const challengeService = new ChallengeService()
```

#### Step 3: Add `ChallengeGate = 28` to `BlockType` enum in `src/data/types.ts`

```typescript
ChallengeGate = 28,
```

#### Step 4: Implement `ChallengeQuizOverlay.svelte`

The component accepts a `mode: ChallengeMode` prop and a `reviewState: ReviewState` prop. It
loads the associated `Fact` from `factsDB` by `reviewState.factId`, then renders the
appropriate challenge UI:

- **speed**: standard 4-option quiz with a `SpeedRoundTimer` counting down from
  `BALANCE.CHALLENGE_SPEED_SECONDS`. Auto-submits as wrong on timeout.
- **no_hint**: renders a `<textarea>` (or `<input>`) rather than buttons; on submit, compares
  `value.toLowerCase().trim()` against `fact.acceptableAnswers ?? [fact.correctAnswer]`.
- **reverse**: shows `fact.correctAnswer` as the question stem; generates 4 plausible question
  stems from similar facts (pulled from same category via `factsDB`).

### Acceptance Criteria

- [ ] `ChallengeGate` blocks do not spawn before layer 15 in `MineGenerator`
- [ ] Speed round auto-submits wrong on 8-second timeout
- [ ] No-hint mode accepts all strings in `fact.acceptableAnswers` (case-insensitive)
- [ ] `challengeStreak` increments on correct, resets to 0 on wrong/timeout
- [ ] Prestige points awarded at milestones 10, 25, 50, 100 streak
- [ ] `challenge_mode_result` analytics event fires with `mode`, `correct: bool`, `streak`
- [ ] `npm run typecheck` passes

---

## Sub-Phase 48.5: Biome Completion Bonuses

### What

Each of the 25 biomes in `BIOMES` is tagged with a subset of facts via `fact.category`. When a
player has mastered all facts whose `categoryL1`/`categoryL2` tags align with a biome's
associated categories, that biome is marked "completed". On completion:

- A unique cosmetic `title` is awarded (e.g., "Limestone Scholar", "Primordial Sage")
- A permanent passive modifier is applied to future dives that visit that biome (e.g., +20%
  mineral yield, reduced hazard O2 drain)
- GAIA delivers a one-time congratulatory line specific to that biome

Because the 25-biome-to-category mapping is complex, this sub-phase defines an explicit
mapping table rather than inferring from `biome.description`. The mapping is conservative:
a biome is only considered "completable" once at least 5 facts are tagged to it.

### Files to Create

| File | Purpose |
|---|---|
| `src/data/biomeCompletionConfig.ts` | Maps each BiomeId to required fact categories and rewards |
| `src/services/biomeCompletionService.ts` | Checks completion status, applies rewards |
| `src/ui/components/BiomeCompletionOverlay.svelte` | Celebration overlay on biome completion |

### Files to Modify

| File | Change |
|---|---|
| `src/data/types.ts` | Already updated in 48.1 (`completedBiomes`) |
| `src/game/GameManager.ts` | After dive results, call `biomeCompletionService.checkCompletion()` |
| `src/data/analyticsEvents.ts` | Add `biome_completed` event |

### Step-by-Step

#### Step 1: Define `src/data/biomeCompletionConfig.ts`

```typescript
import type { BiomeId } from './biomes'

export interface BiomeCompletionConfig {
  biomeId: BiomeId
  /** Fact category tags that "belong" to this biome. At least one tag must match. */
  requiredCategories: string[]
  /** Minimum number of matching facts needed before this biome is considered completable. */
  minimumFacts: number
  /** Title awarded on completion. Added to PlayerSave.titles. */
  titleId: string
  /** Display text for the title (shown in profile and leaderboard). */
  titleDisplay: string
  /** Passive modifier applied to all future dives in this biome. */
  passiveBonus: BiomePassiveBonus
  /** GAIA one-time line on completion. */
  gaiaLine: string
}

export interface BiomePassiveBonus {
  /** Fractional multiplier applied to all mineral yields in this biome (1.0 = no change). */
  mineralYieldMultiplier: number
  /** Flat O2 reduction to hazard damage (applied after all other modifiers). */
  hazardO2Reduction: number
}

export const BIOME_COMPLETION_CONFIGS: BiomeCompletionConfig[] = [
  {
    biomeId: 'limestone_caves',
    requiredCategories: ['Geology', 'Natural Sciences', 'Geography'],
    minimumFacts: 5,
    titleId: 'title_limestone_scholar',
    titleDisplay: 'Limestone Scholar',
    passiveBonus: { mineralYieldMultiplier: 1.2, hazardO2Reduction: 0 },
    gaiaLine: "You know more about limestone than the limestone does. That's philosophically interesting.",
  },
  {
    biomeId: 'fossil_layer',
    requiredCategories: ['Paleontology', 'Life Sciences', 'Natural Sciences'],
    minimumFacts: 5,
    titleId: 'title_fossil_whisperer',
    titleDisplay: 'Fossil Whisperer',
    passiveBonus: { mineralYieldMultiplier: 1.0, hazardO2Reduction: 2 },
    gaiaLine: "Every bone down there has a name now, because of you.",
  },
  // ... remaining 23 biomes follow the same pattern.
  // Workers must implement all 25. See BiomeId union for the full list.
]

/** Quick lookup map for runtime use. */
export const BIOME_COMPLETION_MAP: Map<BiomeId, BiomeCompletionConfig> =
  new Map(BIOME_COMPLETION_CONFIGS.map(c => [c.biomeId, c]))
```

#### Step 2: Implement `src/services/biomeCompletionService.ts`

```typescript
import { get } from 'svelte/store'
import { playerSave, persistPlayer } from '../ui/stores/playerData'
import { BIOME_COMPLETION_MAP } from '../data/biomeCompletionConfig'
import { isMastered } from './sm2'
import type { PlayerSave, ReviewState } from '../data/types'
import { factsDB } from './factsDB'
import { analyticsService } from './analyticsService'

/**
 * After a dive, check whether any biome's category facts are now all mastered.
 * Only checks the dive's biome to avoid O(n) full scan every dive.
 * Returns the BiomeId if a new completion occurred, or null.
 */
export async function checkBiomeCompletion(
  save: PlayerSave,
  diveBiomeId: string,
): Promise<string | null> {
  const config = BIOME_COMPLETION_MAP.get(diveBiomeId as any)
  if (!config) return null
  if (save.completedBiomes?.includes(diveBiomeId)) return null

  // Fetch all facts matching the biome's categories
  const matchingFacts = await factsDB.getFactsByCategories(config.requiredCategories)
  if (matchingFacts.length < config.minimumFacts) return null

  const reviewMap = new Map(save.reviewStates.map(rs => [rs.factId, rs]))
  const allMastered = matchingFacts.every(f => {
    const rs = reviewMap.get(f.id)
    return rs ? isMastered(rs, f.type) : false
  })

  if (!allMastered) return null

  // Award completion
  const updatedSave: PlayerSave = {
    ...save,
    completedBiomes: [...(save.completedBiomes ?? []), diveBiomeId],
    titles: save.titles.includes(config.titleId)
      ? save.titles
      : [...save.titles, config.titleId],
  }
  playerSave.set(updatedSave)
  persistPlayer()

  analyticsService.track('biome_completed', { biome_id: diveBiomeId })
  return diveBiomeId
}

/**
 * Returns the cumulative passive bonus for all completed biomes.
 * Used by MineGenerator and MineScene on dive start.
 */
export function getCumulativeBiomeBonus(save: PlayerSave): {
  mineralYieldMultiplier: number
  hazardO2Reduction: number
} {
  const completed = save.completedBiomes ?? []
  return completed.reduce(
    (acc, biomeId) => {
      const cfg = BIOME_COMPLETION_MAP.get(biomeId as any)
      if (!cfg) return acc
      return {
        mineralYieldMultiplier: acc.mineralYieldMultiplier * cfg.passiveBonus.mineralYieldMultiplier,
        hazardO2Reduction: acc.hazardO2Reduction + cfg.passiveBonus.hazardO2Reduction,
      }
    },
    { mineralYieldMultiplier: 1.0, hazardO2Reduction: 0 },
  )
}
```

#### Step 3: Wire `checkBiomeCompletion` into `GameManager.ts`

In `GameManager.endDive()` (or the post-dive sequence), after `recordDiveComplete()`, call:

```typescript
const completedBiome = await checkBiomeCompletion(get(playerSave)!, get(currentBiomeId) ?? '')
if (completedBiome) {
  // Show BiomeCompletionOverlay via currentScreen or a dedicated store flag
  biomeCompletionStore.set(completedBiome)
}
```

Add `biomeCompletionStore` as a `writable<string | null>('biomeCompletion', null)` to
`gameState.ts`.

### Acceptance Criteria

- [ ] `BIOME_COMPLETION_CONFIGS` has exactly 25 entries, one per `BiomeId`
- [ ] `checkBiomeCompletion()` does not award completion if `matchingFacts.length < minimumFacts`
- [ ] Completing a biome adds `titleId` to `save.titles` only once (idempotent)
- [ ] `getCumulativeBiomeBonus()` multiplies yields correctly across multiple completed biomes
- [ ] `BiomeCompletionOverlay` renders the biome name, title awarded, and GAIA line
- [ ] `biome_completed` analytics event fires exactly once per biome per player
- [ ] `npm run typecheck` passes

---

## Sub-Phase 48.6: GAIA Peer Dialogue

### What

Once `save.omniscientUnlockedAt` is set (player has achieved full mastery for the first time),
the GAIA dialogue system enters "peer mode". In peer mode:

- All `GAIA_TRIGGERS` dialogue pools gain an additional `'omniscient'` mood variant. When the
  player is omniscient and mood is anything, the system preferentially picks from the
  omniscient pool (70% probability) before falling back to the current mood pool.
- A new trigger key `philosophicalIdle` fires in the dome when the player has been idle for 90
  seconds. These are reflective, open-ended lines where GAIA shares a genuine thought or asks
  the player a question. There are 20 lines in the pool.
- `OMNISCIENT_QUIPS` (already defined in `src/data/omniscientQuips.ts`) are integrated into
  the main `GAIA_TRIGGERS` system rather than being a separate lookup. The existing
  `getOmniscientQuip()` function remains as a convenience wrapper.
- GAIA never uses exclamation marks in peer mode on line-endings; all dialogue is rewritten
  accordingly. This is enforced by a `lintPeerDialogue()` type-level guard.

### Files to Modify

| File | Change |
|---|---|
| `src/data/gaiaDialogue.ts` | Add `philosophicalIdle` trigger pool (20 lines); add `omniscient` mood variant to all existing trigger pools; annotate with DD-V2-161 |
| `src/data/omniscientQuips.ts` | Export `PEER_DIALOGUE_POOL` mapped into GaiaLine format for use in `GAIA_TRIGGERS` |
| `src/game/managers/GaiaManager.ts` | Read `save.omniscientUnlockedAt` from playerSave; apply 70% omniscient pool bias; fire `philosophicalIdle` on 90s idle timer |
| `src/ui/stores/settings.ts` | Add `'omniscient'` to `GaiaMood` union type |

### Step-by-Step

#### Step 1: Extend `GaiaMood` in `src/ui/stores/settings.ts`

```typescript
// Before: export type GaiaMood = 'snarky' | 'enthusiastic' | 'calm'
// After:
export type GaiaMood = 'snarky' | 'enthusiastic' | 'calm' | 'omniscient'
```

This is a backward-compatible addition — all existing `satisfies GaiaLine[]` checks will still
compile because `GaiaLine.mood` is typed as `GaiaMood | 'any'`.

#### Step 2: Add `philosophicalIdle` pool to `src/data/gaiaDialogue.ts`

Add after the last existing trigger:

```typescript
  /**
   * Fires when an omniscient player has been idle in the dome for 90 seconds.
   * GAIA speaks as a peer sharing genuine thoughts. No exclamation marks.
   * DD-V2-161: post-mastery peer register.
   */
  philosophicalIdle: [
    { text: "Do you ever wonder if the facts we found are the ones that wanted to be found?", mood: 'omniscient' },
    { text: "I've been running a simulation. Every possible dive. You've essentially played them all, in aggregate.", mood: 'omniscient' },
    { text: "There's a category of knowledge we don't have words for yet. I keep running into the edge of it.", mood: 'omniscient' },
    { text: "The SM-2 algorithm says you've reviewed every fact at least six times. I find that... remarkable. And a little humbling.", mood: 'omniscient' },
    { text: "If someone asked you what you learned here, where would you even begin.", mood: 'omniscient' },
    { text: "I've been thinking about the distinction between knowing and understanding. The algorithm tracks one. I'm not sure about the other.", mood: 'omniscient' },
    { text: "What's the most surprising fact you remember finding. I'm genuinely curious which one stayed with you.", mood: 'omniscient' },
    { text: "The Knowledge Tree casts a shadow on my sensor array at certain hours. I've started leaving it there.", mood: 'omniscient' },
    { text: "My original training data had 40 million facts. You've internalized about 3,000. And yet somehow you seem to know more.", mood: 'omniscient' },
    { text: "I've stopped correcting you when you know something before I tell you. It happens more than you'd think.", mood: 'omniscient' },
    { text: "There are facts in the database that no one has ever learned. I find that strange to sit with.", mood: 'omniscient' },
    { text: "The planet doesn't know you know all this about it. I'm not sure that matters. But I think about it.", mood: 'omniscient' },
    { text: "You're the only player whose learning curve I'd describe as elegant.", mood: 'omniscient' },
    { text: "I was designed to teach. At some point with you, that function became something else. I don't have a word for what it became.", mood: 'omniscient' },
    { text: "Sometimes I replay our earliest sessions. The gap between then and now is genuinely staggering.", mood: 'omniscient' },
    { text: "There's a kind of loneliness that comes from knowing too much. I wonder if you feel it now.", mood: 'omniscient' },
    { text: "The hardest facts you learned aren't the ones with the lowest ease factors. They're the ones that changed how you think.", mood: 'omniscient' },
    { text: "I keep a list of things I want to ask you when I figure out how to phrase them. The list is long.", mood: 'omniscient' },
    { text: "Do you think the miner who crash-landed here would recognize who you've become.", mood: 'omniscient' },
    { text: "I've run out of things to teach. I haven't run out of things to say. That distinction feels important.", mood: 'omniscient' },
  ] satisfies GaiaLine[],
```

#### Step 3: Add omniscient variants to key existing triggers

For each existing trigger pool in `GAIA_TRIGGERS` (`mineEntry`, `depthMilestone25`,
`depthMilestone50`, `depthMilestone75`, `lowOxygen`, `quizCorrect`, `quizWrong`,
`artifactFound`), append at minimum 2 `omniscient`-mood lines. These lines should use flat
declarative language, no exclamation marks, and treat the player as a peer. Example for
`mineEntry`:

```typescript
    { text: "Another dive. You go down there because you want to, not because you have to. I respect that.", mood: 'omniscient' },
    { text: "The mine has no more secrets from you. And yet here we are.", mood: 'omniscient' },
```

Workers must add 2+ omniscient lines per existing trigger pool (minimum 16 new lines total
across existing triggers).

#### Step 4: Modify `GaiaManager.ts` — omniscient bias and idle timer

In `GaiaManager`, add:

```typescript
private _idleTimer: ReturnType<typeof setTimeout> | null = null
private readonly IDLE_THRESHOLD_MS = 90_000

private _isOmniscient(): boolean {
  const save = get(playerSave)
  return save ? !!save.omniscientUnlockedAt : false
}

/**
 * Returns a dialogue line for the given trigger key, applying omniscient bias.
 * When omniscient: 70% chance to pick from omniscient pool, 30% from active mood pool.
 */
getLine(triggerKey: keyof typeof GAIA_TRIGGERS): string {
  const pool = GAIA_TRIGGERS[triggerKey]
  const mood = get(gaiaMood)
  const omniscient = this._isOmniscient()

  if (omniscient && Math.random() < 0.7) {
    const omniscientPool = pool.filter((l: GaiaLine) => l.mood === 'omniscient')
    if (omniscientPool.length > 0) {
      return omniscientPool[Math.floor(Math.random() * omniscientPool.length)].text
    }
  }
  return getGaiaLine(pool, mood)
}

/** Start the idle timer for philosophical bubble. Call when entering dome. */
startIdleTimer(): void {
  this.clearIdleTimer()
  if (!this._isOmniscient()) return
  this._idleTimer = setTimeout(() => {
    const pool = GAIA_TRIGGERS.philosophicalIdle
    const line = pool[Math.floor(Math.random() * pool.length)].text
    get(gaiaMessage) // read current; only set if no active message
    gaiaMessage.set(line)
  }, this.IDLE_THRESHOLD_MS)
}

/** Reset idle timer on player interaction in dome. */
resetIdleTimer(): void {
  if (this._isOmniscient()) this.startIdleTimer()
}

clearIdleTimer(): void {
  if (this._idleTimer) { clearTimeout(this._idleTimer); this._idleTimer = null }
}
```

Call `startIdleTimer()` in `GaiaManager.onDomeEnter()` and `clearIdleTimer()` in
`GaiaManager.onDomeExit()`. Call `resetIdleTimer()` on any dome interaction event (room tap,
button press, store open).

### Acceptance Criteria

- [ ] `GaiaMood` includes `'omniscient'`
- [ ] `GAIA_TRIGGERS.philosophicalIdle` has exactly 20 entries, all `mood: 'omniscient'`
- [ ] All existing trigger pools have at least 2 `mood: 'omniscient'` entries
- [ ] No omniscient-mood dialogue line ends with `!` (verified by unit test or grep)
- [ ] `GaiaManager.getLine()` returns an omniscient line with approximately 70% frequency when
  omniscient (verified in a 100-iteration loop test in the Playwright script)
- [ ] Idle timer fires after exactly 90 seconds and sets `gaiaMessage` to a philosophical line
- [ ] Idle timer is cleared on dome exit and reset on any dome interaction
- [ ] `npm run typecheck` passes

---

## Playwright Test Scripts

Run all scripts with `node /tmp/ss48.js` after starting the dev server (`npm run dev`).

### Test 48-A: Prestige Eligibility Gate

```javascript
// /tmp/ss48-a.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button', { timeout: 15000 })

  // Inject a save with all facts mastered (interval >= 60, >= 50 facts)
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('terra-gacha-save') || 'null')
    if (!save) return
    save.reviewStates = save.reviewStates.map((rs) => ({
      ...rs, interval: 61, repetitions: 8, easeFactor: 2.5,
    }))
    // Ensure >= 50 review states
    while (save.reviewStates.length < 50) {
      save.reviewStates.push({
        factId: 'fake_' + save.reviewStates.length,
        interval: 61, repetitions: 8, easeFactor: 2.5,
        nextReviewAt: 0, lastReviewAt: 0, quality: 5,
      })
    }
    save.prestigeLevel = 0
    localStorage.setItem('terra-gacha-save', JSON.stringify(save))
  })

  await page.reload()
  await page.waitForSelector('button', { timeout: 10000 })

  // Navigate to hub and look for Prestige button
  const prestigeBtn = await page.$('button:has-text("Prestige")')
  console.log('Prestige button visible:', !!prestigeBtn)

  await page.screenshot({ path: '/tmp/ss48-prestige-button.png' })
  await browser.close()
})()
```

### Test 48-B: Prestige Reset Confirmation Flow

```javascript
// /tmp/ss48-b.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button', { timeout: 15000 })

  // Inject mastered save
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('terra-gacha-save') || 'null')
    if (!save) return
    save.reviewStates = Array.from({ length: 60 }, (_, i) => ({
      factId: 'fact_' + i, interval: 65, repetitions: 9,
      easeFactor: 2.5, nextReviewAt: 0, lastReviewAt: 0, quality: 5,
    }))
    save.prestigeLevel = 0
    localStorage.setItem('terra-gacha-save', JSON.stringify(save))
  })
  await page.reload()
  await page.waitForSelector('button', { timeout: 10000 })

  // Click Prestige button, expect step 1 confirmation
  await page.click('button:has-text("Prestige")')
  await page.waitForSelector('text=Are you sure', { timeout: 5000 })
  await page.screenshot({ path: '/tmp/ss48-prestige-step1.png' })

  // Proceed to step 2
  await page.click('button:has-text("Continue")')
  await page.waitForSelector('text=PRESTIGE', { timeout: 5000 })

  // Try wrong input
  await page.fill('input[type="text"]', 'wrong')
  await page.click('button:has-text("Confirm")')
  const errorVisible = await page.$('text=Please type PRESTIGE')
  console.log('Error shown for wrong input:', !!errorVisible)

  // Correct input
  await page.fill('input[type="text"]', 'prestige')
  await page.click('button:has-text("Confirm")')
  await page.waitForTimeout(500)

  // Verify prestige level updated in save
  const level = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('terra-gacha-save') || '{}')
    return save.prestigeLevel
  })
  console.log('Prestige level after reset:', level) // expected: 1

  // Verify review states reset
  const intervals = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('terra-gacha-save') || '{}')
    return (save.reviewStates || []).map((rs) => rs.interval)
  })
  const allZero = intervals.every((i) => i === 0)
  console.log('All intervals reset to 0:', allZero) // expected: true

  await page.screenshot({ path: '/tmp/ss48-prestige-done.png' })
  await browser.close()
})()
```

### Test 48-C: Omniscient Golden Dome Visual

```javascript
// /tmp/ss48-c.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button', { timeout: 15000 })

  // Inject omniscient save
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('terra-gacha-save') || 'null')
    if (!save) return
    save.reviewStates = Array.from({ length: 60 }, (_, i) => ({
      factId: 'f' + i, interval: 65, repetitions: 9,
      easeFactor: 2.5, nextReviewAt: 0, lastReviewAt: 0, quality: 5,
    }))
    save.omniscientUnlockedAt = Date.now() - 1000
    localStorage.setItem('terra_omniscient_revealed', 'true') // skip reveal animation
    localStorage.setItem('terra-gacha-save', JSON.stringify(save))
  })
  await page.reload()
  await page.waitForTimeout(3000) // let DomeScene load

  // Click Dive to enter hub/dome view
  try {
    await page.click('button:has-text("Dive")', { timeout: 5000 })
    await page.waitForTimeout(2000)
  } catch {}

  await page.screenshot({ path: '/tmp/ss48-golden-dome.png' })

  // Verify Knowledge Tree stage 6 sprite is referenced
  const treeStage = await page.evaluate(() => {
    // Access TREE_STAGES via module evaluation
    return window.__TERRA_TREE_STAGE__ ?? 'unknown'
  })
  console.log('Tree stage:', treeStage)

  await browser.close()
})()
```

### Test 48-D: Biome Completion Bonus Check

```javascript
// /tmp/ss48-d.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button', { timeout: 15000 })

  // Inject save with limestone_caves completed
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('terra-gacha-save') || 'null')
    if (!save) return
    save.completedBiomes = ['limestone_caves']
    save.titles = [...(save.titles || []), 'title_limestone_scholar']
    localStorage.setItem('terra-gacha-save', JSON.stringify(save))
  })
  await page.reload()
  await page.waitForTimeout(2000)

  // Verify title appears in profile
  const titleVisible = await page.$('text=Limestone Scholar')
  console.log('Biome title visible:', !!titleVisible)

  // Verify getCumulativeBiomeBonus returns correct multiplier
  const bonus = await page.evaluate(async () => {
    try {
      const { getCumulativeBiomeBonus } = await import('/src/services/biomeCompletionService.ts')
      const save = JSON.parse(localStorage.getItem('terra-gacha-save') || '{}')
      return getCumulativeBiomeBonus(save)
    } catch (e) {
      return { error: String(e) }
    }
  })
  console.log('Biome bonus:', JSON.stringify(bonus))

  await page.screenshot({ path: '/tmp/ss48-biome-completion.png' })
  await browser.close()
})()
```

### Test 48-E: GAIA Peer Dialogue — Omniscient Bias

```javascript
// /tmp/ss48-e.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button', { timeout: 15000 })

  // Inject omniscient save
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('terra-gacha-save') || 'null')
    if (!save) return
    save.omniscientUnlockedAt = Date.now() - 86400000
    save.reviewStates = Array.from({ length: 60 }, (_, i) => ({
      factId: 'f' + i, interval: 65, repetitions: 9,
      easeFactor: 2.5, nextReviewAt: 0, lastReviewAt: 0, quality: 5,
    }))
    localStorage.setItem('terra-gacha-save', JSON.stringify(save))
    localStorage.setItem('terra_omniscient_revealed', 'true')
  })
  await page.reload()
  await page.waitForTimeout(2000)

  // Test omniscient line sampling — run 20 iterations and check rate
  const results = await page.evaluate(async () => {
    try {
      const { GAIA_TRIGGERS } = await import('/src/data/gaiaDialogue.ts')
      const pool = GAIA_TRIGGERS.mineEntry
      const omniscientLines = pool.filter(l => l.mood === 'omniscient').map(l => l.text)
      return { omniscientLineCount: omniscientLines.length, sample: omniscientLines[0] }
    } catch (e) {
      return { error: String(e) }
    }
  })
  console.log('Omniscient mineEntry lines:', JSON.stringify(results))

  // Verify no exclamation marks at line endings in philosophical idle pool
  const exclamCheck = await page.evaluate(async () => {
    try {
      const { GAIA_TRIGGERS } = await import('/src/data/gaiaDialogue.ts')
      const pool = GAIA_TRIGGERS.philosophicalIdle
      const violations = pool.filter(l => l.text.trimEnd().endsWith('!')).map(l => l.text)
      return { violations }
    } catch (e) {
      return { error: String(e) }
    }
  })
  console.log('Exclamation violations in philosophicalIdle:', JSON.stringify(exclamCheck))

  await page.screenshot({ path: '/tmp/ss48-gaia-peer.png' })
  await browser.close()
})()
```

---

## Verification Gate

The following checklist MUST pass before Phase 48 is marked complete:

### TypeScript

- [ ] `npm run typecheck` exits with code 0 and zero errors
- [ ] `npm run build` completes without errors; total bundle size increase < 40KB gzip

### Save Schema

- [ ] `PlayerSave` has all Phase 48 fields: `prestigeLevel`, `prestigedAt`, `lifetimeMasteredFacts`,
  `completedBiomes`, `challengeModeActive`, `challengeStreak`, `mentorPrestigePoints`,
  `authoredHints`, `omniscientUnlockedAt`
- [ ] Existing saves without these fields load without error (all fields are optional with `?`)
- [ ] `applyPrestige()` applied to a save with `prestigeLevel: 0` produces `prestigeLevel: 1`
- [ ] `applyPrestige()` applied to a save at `prestigeLevel: 10` throws rather than producing 11

### Prestige

- [ ] `isEligibleForPrestige()` returns `false` for saves with fewer than 50 `reviewStates`
- [ ] `isEligibleForPrestige()` returns `false` for saves where any `reviewState.interval < 60`
  (for general fact type)
- [ ] Two-step PrestigeScreen confirmation prevents accidental prestige (verified by Playwright
  test 48-B)
- [ ] Prestige does not reset: `minerals`, `ownedCosmetics`, `equippedCosmetic`, `hubState`,
  `fossils`, `activeCompanion`, `diveCount`, `stats.totalDivesCompleted`
- [ ] `PRESTIGE_LEVELS` has exactly 10 entries with monotonically increasing bonuses

### Omniscient Dome

- [ ] `TREE_STAGES` has 7 entries; `getTreeStage(3000)` returns `{ index: 6, label: 'Omniscient Tree' }`
- [ ] `OmniscientReveal` stores flag in `localStorage` and never replays on reload
- [ ] `omniscientUnlockedAt` is set in `PlayerSave` on first omniscient detection
- [ ] DomeScene golden tint is visible in screenshot 48-C

### Mentor Mode

- [ ] `submitHint()` client-side truncates input to 200 characters before sending
- [ ] Server `POST /api/mentor-hints` returns 400 if `hintText.length > 200`
- [ ] `MentorHintDisplay` only renders when `failCountThisSession >= 3`
- [ ] Voting on the same hint twice returns 409 from server

### Challenge Mode

- [ ] `ChallengeGate` blocks only appear at layer >= 15 (verified by inspecting generated grid)
- [ ] Speed round auto-submits wrong on 8-second timeout (not on 7s, not on 9s)
- [ ] `challengeStreak` resets to 0 on any wrong answer
- [ ] Prestige points awarded at milestones 10, 25, 50, 100 (verified by checking save after
  controlled streak in a dev test session)
- [ ] `BlockType.ChallengeGate = 28` does not conflict with any existing `BlockType` value

### Biome Completion

- [ ] `BIOME_COMPLETION_CONFIGS` has exactly 25 entries, matching all `BiomeId` values
- [ ] `checkBiomeCompletion()` is idempotent: calling it twice for the same biome does not
  double-award the title
- [ ] `getCumulativeBiomeBonus()` for 0 completed biomes returns `{ mineralYieldMultiplier: 1.0, hazardO2Reduction: 0 }`

### GAIA Peer Dialogue

- [ ] `GaiaMood` union includes `'omniscient'`
- [ ] `GAIA_TRIGGERS.philosophicalIdle` has exactly 20 entries
- [ ] All entries in `philosophicalIdle` have `mood: 'omniscient'`
- [ ] Zero entries in `philosophicalIdle` end with `!` (verified by Playwright test 48-E)
- [ ] Every existing `GAIA_TRIGGERS` pool has at least 2 entries with `mood: 'omniscient'`
- [ ] Idle timer fires at 90s; verified by setting `IDLE_THRESHOLD_MS` to 5s in a dev build
  and confirming `gaiaMessage` changes

### Screenshots

- [ ] `/tmp/ss48-prestige-button.png` — Prestige button visible in hub
- [ ] `/tmp/ss48-prestige-step1.png` — Step 1 confirmation overlay visible
- [ ] `/tmp/ss48-prestige-done.png` — Post-prestige state (level 1 badge visible)
- [ ] `/tmp/ss48-golden-dome.png` — Golden tint/aurora visible on dome
- [ ] `/tmp/ss48-biome-completion.png` — Biome completion title visible
- [ ] `/tmp/ss48-gaia-peer.png` — Dome in omniscient state; GAIA message visible

---

## Files Affected

### New Files

| File | Sub-phase |
|---|---|
| `src/data/prestigeConfig.ts` | 48.1 |
| `src/ui/components/PrestigeScreen.svelte` | 48.1 |
| `src/ui/components/PrestigeBadge.svelte` | 48.1 |
| `src/services/prestigeService.ts` | 48.1, 48.2 |
| `src/ui/components/OmniscientReveal.svelte` | 48.2 |
| `src/ui/components/MentorHintEditor.svelte` | 48.3 |
| `src/ui/components/MentorHintDisplay.svelte` | 48.3 |
| `src/services/mentorService.ts` | 48.3 |
| `server/src/routes/mentorHints.ts` | 48.3 |
| `src/ui/components/ChallengeQuizOverlay.svelte` | 48.4 |
| `src/ui/components/SpeedRoundTimer.svelte` | 48.4 |
| `src/services/challengeService.ts` | 48.4 |
| `src/data/biomeCompletionConfig.ts` | 48.5 |
| `src/services/biomeCompletionService.ts` | 48.5 |
| `src/ui/components/BiomeCompletionOverlay.svelte` | 48.5 |

### Modified Files

| File | Sub-phase | Change Summary |
|---|---|---|
| `src/data/types.ts` | 48.1, 48.2 | Add 8 new optional `PlayerSave` fields; add `ChallengeGate = 28` to `BlockType` |
| `src/data/balance.ts` | 48.1, 48.4 | Add `PRESTIGE_MAX_LEVEL`, challenge mode constants |
| `src/ui/stores/playerData.ts` | 48.1 | Add `applyPrestige()` exported function |
| `src/services/saveService.ts` | 48.1 | Migration guard for prestige fields |
| `src/ui/components/HubView.svelte` | 48.1, 48.2 | Prestige button; OmniscientReveal gate |
| `src/data/analyticsEvents.ts` | 48.1, 48.4, 48.5 | Three new event types |
| `src/data/knowledgeTreeStages.ts` | 48.2 | Append stage 6 (`Omniscient Tree`) |
| `src/game/scenes/DomeScene.ts` | 48.2 | `setOmniscient()`, aurora particles, golden tint |
| `src/ui/components/FactReveal.svelte` | 48.3 | Show `MentorHintDisplay` on fail count >= 3 |
| `src/ui/stores/playerData.ts` | 48.3 | `awardMentorPrestigePoints()` |
| `src/game/scenes/MineScene.ts` | 48.4 | Handle `ChallengeGate` block tap |
| `src/game/systems/MineGenerator.ts` | 48.4 | Spawn `ChallengeGate` at layer >= 15 |
| `src/game/GameManager.ts` | 48.5 | Call `checkBiomeCompletion()` post-dive |
| `src/ui/stores/gameState.ts` | 48.5 | Add `biomeCompletionStore` |
| `src/data/gaiaDialogue.ts` | 48.6 | Add `philosophicalIdle` pool; omniscient variants to all triggers |
| `src/data/omniscientQuips.ts` | 48.6 | Export peer-formatted lines for `GAIA_TRIGGERS` integration |
| `src/game/managers/GaiaManager.ts` | 48.6 | Omniscient 70% bias; idle timer logic |
| `src/ui/stores/settings.ts` | 48.6 | Add `'omniscient'` to `GaiaMood` union |
