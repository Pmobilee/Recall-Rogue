# Phase 36: Combat System

**Status**: Not started
**Depends on**: Phase 8 (Mine Gameplay Overhaul — tick system, 20 layers), Phase 9 (Biome Expansion — 25 biomes), Phase 35 (Mine Mechanics Completion — quiz gates)
**Estimated complexity**: High — multi-file integration, new UI overlay, new store slices, data layer wiring
**Design decisions**: DD-V2-025 (boss encounters), DD-V2-026 (creature spawning), DD-V2-027 (quiz gauntlets)

---

## 1. Overview

Phase 36 wires the existing combat data layer (`Boss.ts`, `Creature.ts`, `CombatManager.ts`) into the live game. It introduces:

- **Creature encounters** randomly triggered while mining in biome-appropriate layers.
- **Boss encounters** at landmark layers L5, L10, L15, and L20, blocking descent until defeated.
- **Quiz gauntlet mode** — rapid-fire quiz sequences that deal damage; answering correctly is the only way to attack.
- **Combat rewards** — unique drops, companion XP, mineral bonuses, and special relics gated behind bosses.
- **"The Deep"** secret biome — an optional Layer 21+ zone unlocked only by completing all four bosses in a single dive.

Combat is 100% quiz-driven. There is no separate action input — every attack is a quiz answer. Defending and fleeing remain available as fallback options but cost oxygen. This preserves the learning loop as the primary engagement mechanic and prevents combat from becoming a distraction from the educational core.

### What Exists Already (data layer only — NOT wired)

| File | Status |
|---|---|
| `src/game/entities/Boss.ts` | 3 boss templates, `createBoss()`, `checkPhaseTransition()` |
| `src/game/entities/Creature.ts` | `Creature`/`CreatureAbility` interfaces, `createCreature()`, `calculateDamage()`, `shouldFlee()` |
| `src/game/managers/CombatManager.ts` | `startCombat()`, `executeTurn()`, `CombatState`, `TurnResult` — not called from anywhere |
| `src/game/managers/AchievementManager.ts` | Handles `boss_defeated` event type — currently never fired |

### What This Phase Adds

- `src/data/creatures.ts` — 12 creature templates across biome tiers
- `src/data/combatRewards.ts` — boss/creature loot tables, companion XP values
- `src/data/theDeep.ts` — "The Deep" biome definition and generation parameters
- `src/game/managers/EncounterManager.ts` — trigger logic for random and boss encounters
- `src/game/systems/CreatureSpawner.ts` — biome-aware creature selection and spawn timing
- `src/ui/components/CombatOverlay.svelte` — full combat UI (HP bars, quiz gauntlet, phase transitions, rewards)
- `src/ui/components/BossIntroOverlay.svelte` — cinematic boss introduction screen
- `src/ui/components/TheDeepUnlockOverlay.svelte` — "The Deep" unlock cutscene
- `src/ui/stores/combatState.ts` — reactive combat stores read by Svelte overlays
- Wiring: `GameManager.ts` receives and routes combat events from `MineScene`
- Wiring: `MineScene.ts` generates boss-blocked descent shafts at L5/L10/L15/L20
- Wiring: `QuizManager.ts` gets a new `'combat'` quiz source type
- Balance additions to `src/data/balance.ts`
- `PlayerSave` extended with `defeatedBosses`, `creatureKills`, `theDeepVisits`
- Analytics events: `combat_started`, `combat_victory`, `combat_defeat`, `boss_defeated`

---

## 2. Sub-phases

---

### 36.1 — Combat Encounter System (Trigger Conditions, Encounter UI Overlay)

**Goal**: Establish the encounter trigger pipeline and the base `CombatOverlay` skeleton, so later sub-phases can slot in boss and creature logic without structural changes.

#### 36.1.1 — New store: `src/ui/stores/combatState.ts`

Create a singleton Svelte writable store file that holds all reactive state consumed by `CombatOverlay.svelte`.

```typescript
// src/ui/stores/combatState.ts
import { writable } from 'svelte/store'
import type { Creature } from '../../game/entities/Creature'
import type { Boss } from '../../game/entities/Boss'

export interface CombatUIState {
  active: boolean
  /** 'creature' for random encounters, 'boss' for landmark bosses */
  encounterType: 'creature' | 'boss'
  creature: Creature | Boss | null
  playerHp: number
  playerMaxHp: number
  creatureHp: number
  creatureMaxHp: number
  turn: number
  /** Current boss phase index (0-based) */
  bossPhase: number
  /** Log of combat messages shown in the UI */
  log: string[]
  /** True while waiting for a quiz answer to resolve the current attack */
  awaitingQuiz: boolean
  /** Result of the last completed combat (null while ongoing) */
  result: 'victory' | 'defeat' | 'fled' | null
  /** Loot to display on victory */
  pendingLoot: { mineralTier: string; amount: number }[]
  /** Companion XP earned this combat */
  companionXpEarned: number
}

function makeCombatState(): ReturnType<typeof writable<CombatUIState>> {
  const sym = Symbol.for('terra:combatState')
  if (!(globalThis as any)[sym]) {
    ;(globalThis as any)[sym] = writable<CombatUIState>({
      active: false,
      encounterType: 'creature',
      creature: null,
      playerHp: 0,
      playerMaxHp: 0,
      creatureHp: 0,
      creatureMaxHp: 0,
      turn: 0,
      bossPhase: 0,
      log: [],
      awaitingQuiz: false,
      result: null,
      pendingLoot: [],
      companionXpEarned: 0,
    })
  }
  return (globalThis as any)[sym]
}

export const combatState = makeCombatState()
```

Add `'combat'` to the `Screen` union in `src/ui/stores/gameState.ts`:

```typescript
// In the Screen type union (add after 'quiz'):
| 'combat'
```

#### 36.1.2 — New store slice in `src/ui/stores/gameState.ts`

Add the following export (no structural changes to existing stores):

```typescript
// combatEncounterActive — true whenever CombatOverlay is shown
export const combatEncounterActive = singletonWritable<boolean>('combatEncounterActive', false)
```

#### 36.1.3 — New file: `src/game/managers/EncounterManager.ts`

```typescript
// src/game/managers/EncounterManager.ts
import { get } from 'svelte/store'
import { combatState } from '../../ui/stores/combatState'
import { combatEncounterActive, currentScreen } from '../../ui/stores/gameState'
import { combatManager } from './CombatManager'
import { playerSave } from '../../ui/stores/playerData'
import type { Creature } from '../entities/Creature'
import type { Boss } from '../entities/Boss'
import { BALANCE } from '../../data/balance'
import { BOSS_LAYER_MAP } from '../entities/Boss'

/**
 * EncounterManager coordinates the lifecycle of all combat encounters.
 * It is the single point of contact between MineScene and the combat system.
 * GameManager holds an instance and routes MineScene events here.
 *
 * References to QuizManager and MineScene are injected by GameManager after init
 * to avoid circular imports (same pattern as QuizManager). (DD-V2-025)
 */
export class EncounterManager {
  quizManagerRef: import('./QuizManager').QuizManager | null = null
  private getMineScene: (() => import('../scenes/MineScene').MineScene | null) | null = null

  /** Set the MineScene accessor (called by GameManager during init). */
  setMineSceneAccessor(fn: () => import('../scenes/MineScene').MineScene | null): void {
    this.getMineScene = fn
  }

  /** True if a combat encounter is currently active (blocks mining). */
  isInCombat(): boolean {
    return get(combatEncounterActive)
  }

  /**
   * Begin a creature encounter.
   * Called by GameManager when MineScene emits 'creature-encounter'.
   */
  startCreatureEncounter(creature: Creature): void {
    const playerHp = BALANCE.COMBAT_PLAYER_BASE_HP
    const playerAttack = this._computePlayerAttack()
    const playerDefense = this._computePlayerDefense()

    combatManager.startCombat(creature, { hp: playerHp, attack: playerAttack, defense: playerDefense })
    combatState.set({
      active: true,
      encounterType: 'creature',
      creature,
      playerHp,
      playerMaxHp: playerHp,
      creatureHp: creature.hp,
      creatureMaxHp: creature.maxHp,
      turn: 0,
      bossPhase: 0,
      log: [`A ${creature.name} emerges from the darkness!`],
      awaitingQuiz: false,
      result: null,
      pendingLoot: [],
      companionXpEarned: 0,
    })
    combatEncounterActive.set(true)
    currentScreen.set('combat')
  }

  /**
   * Begin a boss encounter.
   * Called by GameManager when MineScene emits 'boss-encounter'.
   */
  startBossEncounter(boss: Boss): void {
    const layerDepth = boss.depthRange[0]
    const playerHp = Math.round(
      BALANCE.COMBAT_PLAYER_BASE_HP + (layerDepth - 1) * BALANCE.COMBAT_PLAYER_HP_PER_LAYER
    )
    const playerAttack = this._computePlayerAttack()
    const playerDefense = this._computePlayerDefense()

    combatManager.startCombat(boss, { hp: playerHp, attack: playerAttack, defense: playerDefense })
    combatState.set({
      active: true,
      encounterType: 'boss',
      creature: boss,
      playerHp,
      playerMaxHp: playerHp,
      creatureHp: boss.hp,
      creatureMaxHp: boss.maxHp,
      turn: 0,
      bossPhase: 0,
      log: [boss.title, `HP: ${boss.hp}`],
      awaitingQuiz: false,
      result: null,
      pendingLoot: [],
      companionXpEarned: 0,
    })
    combatEncounterActive.set(true)
    currentScreen.set('combat')
  }

  /**
   * Start a quiz attack. Gauntlet chain length depends on boss phase.
   * For creature encounters: always 1 question.
   * For boss encounters: 1/2/2/3 questions per phase (phase 0/1/2/3).
   */
  startQuizAttack(): void {
    const state = get(combatState)
    if (!state.active || !this.quizManagerRef) return

    const isBoss = state.encounterType === 'boss'
    const bossPhase = state.bossPhase
    const gauntletSize = isBoss
      ? (bossPhase >= 3 ? 3 : bossPhase >= 1 ? 2 : 1)
      : 1

    const factCategory =
      (state.creature as any)?.quizCategory ??
      (state.creature as any)?.factCategory ??
      'General Knowledge'

    combatState.update(s => ({ ...s, awaitingQuiz: true }))
    this.quizManagerRef.triggerCombatQuiz(factCategory, gauntletSize, gauntletSize)
  }

  /**
   * Called by QuizManager when a combat quiz answer is resolved.
   * Applies damage if correct, applies creature counter-attack, checks phase transition.
   */
  resolveCombatQuizAnswer(correct: boolean): void {
    if (!correct) {
      const scene = this.getMineScene?.()
      if (scene) scene.drainOxygen(BALANCE.COMBAT_WRONG_O2_COST)
    }

    const action = correct ? 'quiz_attack' : 'defend'
    const result = combatManager.executeTurn(action)

    combatState.update(s => ({
      ...s,
      playerHp: result.playerHp,
      creatureHp: result.creatureHp,
      turn: s.turn + 1,
      bossPhase: result.phaseTransition ? result.phaseTransition.phase : s.bossPhase,
      log: [...s.log.slice(-8), result.message],
      awaitingQuiz: false,
      result: result.combatOver ? (result.victory ? 'victory' : 'defeat') : null,
      pendingLoot: result.loot ?? s.pendingLoot,
    }))

    if (result.combatOver) {
      combatEncounterActive.set(false)
      if (result.victory) {
        this._processVictoryRewards()
      } else {
        // Player defeated — surface immediately
        this.getMineScene?.()?.emit('combat-defeat')
      }
    }
  }

  /** Player chose to defend (no quiz — take reduced damage, no O2 cost). */
  defend(): void {
    const result = combatManager.executeTurn('defend')
    combatState.update(s => ({
      ...s,
      playerHp: result.playerHp,
      creatureHp: result.creatureHp,
      turn: s.turn + 1,
      log: [...s.log.slice(-8), result.message],
      awaitingQuiz: false,
      result: result.combatOver ? (result.victory ? 'victory' : 'defeat') : null,
    }))
    if (result.combatOver) {
      combatEncounterActive.set(false)
      if (result.victory) this._processVictoryRewards()
    }
  }

  /**
   * Player chose to flee. Costs O2 regardless of success.
   * Returns true if flee succeeded.
   */
  attemptFlee(): boolean {
    const scene = this.getMineScene?.()
    if (scene) scene.drainOxygen(BALANCE.COMBAT_FLEE_O2_COST)

    const result = combatManager.executeTurn('flee')
    combatState.update(s => ({
      ...s,
      log: [...s.log.slice(-8), result.message],
      result: result.combatOver ? 'fled' : null,
      awaitingQuiz: false,
    }))
    if (result.combatOver) combatEncounterActive.set(false)
    return result.combatOver
  }

  /**
   * Check if The Deep is unlocked for the current dive.
   * Requires all 4 bosses to have been defeated in this run. (DD-V2-025)
   */
  isTheDeepUnlocked(): boolean {
    const save = get(playerSave)
    if (!save) return false
    const defeated = new Set(save.defeatedBossesThisRun ?? [])
    const required = Object.values(BOSS_LAYER_MAP)
    return required.every(id => defeated.has(id))
  }

  /** End combat without any result (emergency cleanup). */
  forceEndCombat(): void {
    combatManager.endCombat()
    combatEncounterActive.set(false)
    combatState.update(s => ({ ...s, active: false, result: null }))
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private _computePlayerAttack(): number {
    return BALANCE.COMBAT_BASE_PLAYER_ATTACK
  }

  private _computePlayerDefense(): number {
    return BALANCE.COMBAT_BASE_PLAYER_DEFENSE
  }

  private _processVictoryRewards(): void {
    const state = get(combatState)
    const creature = state.creature
    if (!creature) return

    // Grant loot as mineral additions
    import('../../ui/stores/playerData').then(({ addMinerals, playerSave }) => {
      const { get } = require('svelte/store')
      for (const entry of creature.loot) {
        addMinerals(entry.mineralTier as any, entry.amount)
      }

      const isBoss = 'isBoss' in creature && (creature as any).isBoss
      if (isBoss) {
        playerSave.update(save => {
          if (!save) return save
          const defeated = new Set(save.defeatedBossesThisRun ?? [])
          defeated.add(creature.id)
          const allDefeated = new Set(save.defeatedBosses ?? [])
          allDefeated.add(creature.id)
          return { ...save, defeatedBossesThisRun: [...defeated], defeatedBosses: [...allDefeated] }
        })
      } else {
        playerSave.update(save =>
          save ? { ...save, creatureKills: (save.creatureKills ?? 0) + 1 } : save
        )
      }
    })
  }
}

export const encounterManager = new EncounterManager()
```

#### 36.1.4 — Balance constants: `src/data/balance.ts`

Add the following constants to the `BALANCE` object (do not modify any existing constants):

```typescript
  // === COMBAT SYSTEM (Phase 36) ===
  COMBAT_PLAYER_BASE_HP: 100,
  COMBAT_PLAYER_HP_PER_LAYER: 5,
  COMBAT_BASE_PLAYER_ATTACK: 20,
  COMBAT_BASE_PLAYER_DEFENSE: 10,
  COMBAT_QUIZ_ATTACK_MULTIPLIER: 1.5,
  COMBAT_WRONG_O2_COST: 10,
  COMBAT_FLEE_O2_COST: 15,
  COMBAT_DEFEND_DAMAGE_REDUCTION: 0.5,
  CREATURE_SPAWN_CHANCE_PER_BLOCK: 0.015,
  CREATURE_SPAWN_MIN_BLOCKS: 10,
  CREATURE_SPAWN_COOLDOWN: 20,
  BOSS_LAYER_INDICES: [4, 9, 14, 19] as const,
  THE_DEEP_MIN_LAYER: 20,
  THE_DEEP_UNLOCK_REQUIRES_ALL_BOSSES: true,
```

#### 36.1.5 — Acceptance criteria

- `combatState` writable store is exported from `src/ui/stores/combatState.ts` with the `CombatUIState` interface.
- `'combat'` is a valid value in the `Screen` union in `gameState.ts`.
- `combatEncounterActive` is exported from `gameState.ts`.
- `EncounterManager` class compiles without TypeScript errors (`npm run typecheck`).
- All 14 new `BALANCE` keys are accessible on the `BALANCE` object without error.

---

### 36.2 — Boss Encounters at Landmark Layers (L5/L10/L15/L20)

**Goal**: Boss encounters block descent at layers 5, 10, 15, and 20. The player cannot use the descent shaft until the boss is defeated. GAIA warns the player before each boss.

#### 36.2.1 — Fourth boss template and layer map: `src/game/entities/Boss.ts`

Add the Layer 15 boss template to `BOSS_TEMPLATES` and export `BOSS_LAYER_MAP`:

```typescript
// Append to BOSS_TEMPLATES array in src/game/entities/Boss.ts:
  {
    id: 'boss_deep_leviathan',
    name: 'Deep Leviathan',
    title: 'Sovereign of the Abyssal Dark',
    species: 'leviathan',
    rarity: 'legendary',
    isBoss: true,
    behavior: 'aggressive',
    maxHp: 600,
    attack: 30,
    defense: 22,
    speed: 6,
    biomeAffinity: ['deep_biolume', 'obsidian_rift', 'primordial_mantle'],
    depthRange: [13, 16] as [number, number],
    quizRequired: true,
    quizCategory: 'Natural Sciences',
    loot: [{ mineralTier: 'geode', amount: 6 }, { mineralTier: 'essence', amount: 3 }],
    phases: [
      {
        hpThreshold: 0.7,
        ability: {
          name: 'Bioluminescent Pulse',
          description: 'Blinds player — next wrong answer deals 2x creature damage',
          cooldown: 4, effect: 'weaken', magnitude: 2
        },
        dialogue: 'A blinding wave of bioluminescent light erupts from the Leviathan!'
      },
      {
        hpThreshold: 0.45,
        ability: {
          name: 'Crushing Depth',
          description: 'Drains 20 O2 immediately',
          cooldown: 0, effect: 'weaken', magnitude: 20
        },
        dialogue: 'The pressure intensifies. Your suit groans under the weight of the deep.'
      },
      {
        hpThreshold: 0.2,
        ability: {
          name: 'Final Surge',
          description: 'Attacks twice per turn for 3 turns',
          cooldown: 0, effect: 'weaken', magnitude: 1.8
        },
        dialogue: 'The Leviathan lets out a deafening cry and lunges!'
      }
    ],
    relicDrop: 'relic_leviathan_fin',
    spriteKey: 'creature_leviathan'
  },

// After BOSS_TEMPLATES declaration, add:

/**
 * Maps 0-based layer index to the boss template ID that guards descent.
 * Used by MineScene to gate the DescentShaft interaction. (DD-V2-025)
 */
export const BOSS_LAYER_MAP: Record<number, string> = {
  4:  'boss_crystal_golem',     // Layer 5  (0-based: 4)
  9:  'boss_lava_wyrm',         // Layer 10 (0-based: 9)
  14: 'boss_deep_leviathan',    // Layer 15 (0-based: 14)
  19: 'boss_void_sentinel',     // Layer 20 (0-based: 19)
}
```

#### 36.2.2 — MineScene: boss-blocked descent shafts

In `src/game/scenes/MineScene.ts`, add the following to the DescentShaft interaction handler (the method that fires when the player moves onto or taps a `BlockType.DescentShaft` cell). This must run BEFORE the existing descent logic:

```typescript
// Imports to add at the top of MineScene.ts:
import { BOSS_LAYER_MAP, createBoss } from '../entities/Boss'
import type { Boss } from '../entities/Boss'

// Inside the descent handler method, BEFORE the existing descent logic:
const bossTemplateId = BOSS_LAYER_MAP[this.currentLayerIndex]
if (bossTemplateId !== undefined) {
  const save = get(playerSave)
  const defeatedThisRun: string[] = save?.defeatedBossesThisRun ?? []
  if (!defeatedThisRun.includes(bossTemplateId)) {
    const boss = createBoss(bossTemplateId, this.currentLayerIndex + 1)
    if (boss) {
      this.emit('boss-encounter', boss)
      return  // Halt descent until boss is defeated
    }
  }
}
// Existing descent logic continues here if boss is defeated or layer has no boss
```

Also, at the post-boss-defeat point (when combat-victory is received and current layer was a boss layer), emit `'boss-cleared'` to allow descent:

```typescript
// Add event listener in MineScene.create() or init():
this.events.on('combat-defeat', () => {
  // Force surface the player
  GameManager.getInstance().forceSurface('combat_defeat')
})
```

In `GameManager.ts`, in the `setupMineSceneListeners` (or equivalent) method:

```typescript
import { encounterManager } from './managers/EncounterManager'
import type { Boss } from '../game/entities/Boss'
import type { Creature } from '../game/entities/Creature'

scene.on('boss-encounter', (boss: Boss) => {
  gaiaMessage.set(boss.phases[0]?.dialogue ?? `${boss.name} blocks your path!`)
  encounterManager.startBossEncounter(boss)
})

scene.on('creature-encounter', (creature: Creature) => {
  gaiaMessage.set(`Something stirs in the dark...`)
  encounterManager.startCreatureEncounter(creature)
})

scene.on('the-deep-unlocked', () => {
  currentScreen.set('the-deep-unlock')
  playerSave.update(save =>
    save ? { ...save, theDeepVisits: (save.theDeepVisits ?? 0) + 1 } : save
  )
})
```

Also wire up `encounterManager` references after creating it:

```typescript
// In GameManager constructor or init():
this.encounterManagerInstance = encounterManager
encounterManager.quizManagerRef = this.quizManager
encounterManager.setMineSceneAccessor(() => this.getMineScene())
```

#### 36.2.3 — New component: `src/ui/components/BossIntroOverlay.svelte`

A cinematic 2.2-second overlay that shows boss name, title, and first-phase dialogue before fading into `CombatOverlay`. Overlays the mine canvas.

```svelte
<!-- src/ui/components/BossIntroOverlay.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import type { Boss } from '../../game/entities/Boss'

  interface Props {
    boss: Boss
    onDismiss: () => void
  }
  let { boss, onDismiss }: Props = $props()

  let fading = $state(false)

  onMount(() => {
    const timer = setTimeout(() => {
      fading = true
      setTimeout(onDismiss, 400)
    }, 2200)
    return () => clearTimeout(timer)
  })
</script>

<div class="boss-intro" class:fading>
  <div class="boss-tier">BOSS ENCOUNTER</div>
  <div class="boss-name">{boss.name}</div>
  <div class="boss-title">{boss.title}</div>
  <div class="boss-hp">HP: {boss.maxHp}</div>
  <div class="boss-quote">
    GAIA: "{boss.phases[0]?.dialogue ?? 'Prepare yourself, pilot.'}"
  </div>
</div>

<style>
  .boss-intro {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 900;
    color: #fff;
    text-align: center;
    gap: 10px;
    pointer-events: none;
    animation: bossReveal 0.5s ease;
  }
  .boss-intro.fading { animation: bossFade 0.4s ease forwards; }
  .boss-tier  { font-size: 0.7rem; color: #ffd369; letter-spacing: 0.25em; text-transform: uppercase; }
  .boss-name  { font-size: 2.2rem; font-weight: bold; color: #e94560; text-shadow: 0 0 16px #e94560; }
  .boss-title { font-size: 0.9rem; color: #ccc; }
  .boss-hp    { font-size: 0.75rem; color: #888; }
  .boss-quote { font-size: 0.78rem; color: #7af; font-style: italic; max-width: 290px; margin-top: 8px; }
  @keyframes bossReveal { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: scale(1) } }
  @keyframes bossFade   { from { opacity: 1 } to { opacity: 0 } }
</style>
```

#### 36.2.4 — PlayerSave extension: `src/data/types.ts`

Add to the `PlayerSave` interface (append after the Social — Phase 22 fields):

```typescript
  // Phase 36: Combat System
  /** Boss template IDs defeated in the CURRENT dive run. Cleared when dive ends. */
  defeatedBossesThisRun?: string[]
  /** All boss template IDs ever defeated across all dives. */
  defeatedBosses?: string[]
  /** Total creature (non-boss) kills across all dives. */
  creatureKills?: number
  /** Number of times "The Deep" has been entered. */
  theDeepVisits?: number
```

#### 36.2.5 — Acceptance criteria

- `BOSS_LAYER_MAP` is exported from `Boss.ts` with entries at keys 4, 9, 14, 19.
- `boss_deep_leviathan` template is in `BOSS_TEMPLATES` with 3 phases and `relicDrop: 'relic_leviathan_fin'`.
- Descending at layer index 4 when `defeatedBossesThisRun` does not include `'boss_crystal_golem'` emits `'boss-encounter'`.
- Descending at layer index 4 when `defeatedBossesThisRun` includes `'boss_crystal_golem'` proceeds normally.
- `BossIntroOverlay.svelte` compiles without TypeScript errors.
- `PlayerSave` fields are defined (typecheck passes on `types.ts`).

---

### 36.3 — Creature Spawning (Random Encounters, Biome-Specific Creatures)

**Goal**: 12 creature templates spanning biome tiers. `CreatureSpawner` selects appropriate creatures per biome and layer, triggering encounters at a tuned rate. Boss layers never spawn random creatures.

#### 36.3.1 — Creature catalog: `src/data/creatures.ts`

```typescript
// src/data/creatures.ts
import type { Creature } from '../game/entities/Creature'

/**
 * 12 creature templates — 3 per depth tier.
 * Each template omits `hp` and `state` (set by createCreature() at spawn time).
 * Biome affinity IDs match BiomeId values from biomes.ts. (DD-V2-026)
 */
export const CREATURE_TEMPLATES: Omit<Creature, 'hp' | 'state'>[] = [

  // ─── Tier 1: Shallow Biomes (L1–5) ────────────────────────────────────────
  {
    id: 'creature_glow_sprite',
    name: 'Glow Sprite',
    species: 'sprite',
    rarity: 'common',
    behavior: 'passive',
    maxHp: 30, attack: 5, defense: 2, speed: 6,
    biomeAffinity: ['limestone_caves', 'clay_basin', 'root_tangle'],
    depthRange: [1, 5],
    factCategory: 'Natural Sciences',
    loot: [{ mineralTier: 'dust', amount: 8 }],
    spriteKey: 'creature_sprite',
    tintColor: 0x88ffcc,
  },
  {
    id: 'creature_stone_crab',
    name: 'Stone Crab',
    species: 'crab',
    rarity: 'common',
    behavior: 'territorial',
    maxHp: 50, attack: 8, defense: 8, speed: 3,
    biomeAffinity: ['iron_seam', 'basalt_maze', 'salt_flats'],
    depthRange: [1, 5],
    factCategory: 'Geology',
    loot: [{ mineralTier: 'dust', amount: 12 }, { mineralTier: 'shard', amount: 1 }],
    spriteKey: 'creature_crab',
    ability: {
      name: 'Shell Lock',
      description: 'Reduces incoming damage by 60% for 1 turn',
      cooldown: 3, effect: 'shield', magnitude: 0.4
    },
  },
  {
    id: 'creature_dust_mite',
    name: 'Dust Mite',
    species: 'mite',
    rarity: 'uncommon',
    behavior: 'aggressive',
    maxHp: 25, attack: 10, defense: 1, speed: 9,
    biomeAffinity: ['peat_bog', 'coal_veins'],
    depthRange: [2, 5],
    factCategory: 'Natural Sciences',
    loot: [{ mineralTier: 'dust', amount: 20 }],
    spriteKey: 'creature_mite',
  },

  // ─── Tier 2: Mid Biomes (L6–10) ───────────────────────────────────────────
  {
    id: 'creature_lava_salamander',
    name: 'Lava Salamander',
    species: 'salamander',
    rarity: 'uncommon',
    behavior: 'territorial',
    maxHp: 80, attack: 14, defense: 6, speed: 5,
    biomeAffinity: ['sulfur_springs', 'granite_canyon', 'obsidian_rift'],
    depthRange: [6, 10],
    factCategory: 'Geology',
    loot: [{ mineralTier: 'shard', amount: 3 }, { mineralTier: 'crystal', amount: 1 }],
    spriteKey: 'creature_salamander',
    tintColor: 0xff4400,
    ability: {
      name: 'Acid Spit',
      description: 'Burns through O2 — costs 8 extra O2 if answer is wrong',
      cooldown: 2, effect: 'weaken', magnitude: 1.3
    },
  },
  {
    id: 'creature_crystal_shard',
    name: 'Crystal Shard',
    species: 'golem',
    rarity: 'rare',
    behavior: 'guardian',
    maxHp: 100, attack: 18, defense: 12, speed: 2,
    biomeAffinity: ['quartz_halls', 'crystal_geode'],
    depthRange: [6, 10],
    factCategory: 'Geology',
    loot: [{ mineralTier: 'crystal', amount: 2 }, { mineralTier: 'shard', amount: 5 }],
    spriteKey: 'creature_golem_minor',
    ability: {
      name: 'Crystal Armor',
      description: 'Blocks all damage for 1 turn',
      cooldown: 4, effect: 'shield', magnitude: 1.0
    },
  },
  {
    id: 'creature_shadow_eel',
    name: 'Shadow Eel',
    species: 'eel',
    rarity: 'uncommon',
    behavior: 'aggressive',
    maxHp: 60, attack: 20, defense: 3, speed: 8,
    biomeAffinity: ['coal_veins', 'basalt_maze', 'magma_shelf'],
    depthRange: [6, 10],
    factCategory: 'History',
    loot: [{ mineralTier: 'shard', amount: 4 }],
    spriteKey: 'creature_eel',
    tintColor: 0x220055,
  },

  // ─── Tier 3: Deep Biomes (L11–15) ─────────────────────────────────────────
  {
    id: 'creature_void_crawler',
    name: 'Void Crawler',
    species: 'crawler',
    rarity: 'rare',
    behavior: 'aggressive',
    maxHp: 130, attack: 25, defense: 8, speed: 7,
    biomeAffinity: ['tectonic_scar', 'iron_core_fringe', 'pressure_dome'],
    depthRange: [11, 15],
    factCategory: 'General Knowledge',
    loot: [{ mineralTier: 'crystal', amount: 3 }, { mineralTier: 'geode', amount: 1 }],
    spriteKey: 'creature_crawler',
    ability: {
      name: 'Phase Shift',
      description: 'Evades next attack — your quiz does 0 damage this turn',
      cooldown: 3, effect: 'shield', magnitude: 0
    },
  },
  {
    id: 'creature_magma_golem',
    name: 'Magma Golem',
    species: 'golem',
    rarity: 'rare',
    behavior: 'guardian',
    maxHp: 180, attack: 22, defense: 18, speed: 2,
    biomeAffinity: ['magma_shelf', 'obsidian_rift', 'tectonic_scar'],
    depthRange: [11, 15],
    factCategory: 'Geology',
    loot: [{ mineralTier: 'geode', amount: 2 }, { mineralTier: 'essence', amount: 1 }],
    spriteKey: 'creature_golem_magma',
    tintColor: 0xff3300,
  },
  {
    id: 'creature_ancient_worm',
    name: 'Ancient Worm',
    species: 'worm',
    rarity: 'epic',
    behavior: 'territorial',
    maxHp: 150, attack: 28, defense: 10, speed: 4,
    biomeAffinity: ['fossil_layer', 'primordial_mantle'],
    depthRange: [11, 15],
    factCategory: 'Life Sciences',
    loot: [{ mineralTier: 'geode', amount: 3 }],
    spriteKey: 'creature_worm',
    ability: {
      name: 'Tunnel Collapse',
      description: 'Reveals 5 random blocks around player',
      cooldown: 5, effect: 'weaken', magnitude: 1
    },
  },

  // ─── Tier 4: Extreme Biomes (L16–20) ──────────────────────────────────────
  {
    id: 'creature_echo_wraith',
    name: 'Echo Wraith',
    species: 'wraith',
    rarity: 'epic',
    behavior: 'aggressive',
    maxHp: 200, attack: 35, defense: 5, speed: 9,
    biomeAffinity: ['echo_chamber', 'temporal_rift', 'void_pocket'],
    depthRange: [16, 20],
    factCategory: 'General Knowledge',
    loot: [{ mineralTier: 'essence', amount: 2 }],
    spriteKey: 'creature_wraith',
    tintColor: 0x8855ff,
    ability: {
      name: 'Memory Drain',
      description: 'Forces a 2-question gauntlet to continue',
      cooldown: 3, effect: 'weaken', magnitude: 2
    },
  },
  {
    id: 'creature_void_horror',
    name: 'Void Horror',
    species: 'horror',
    rarity: 'legendary',
    behavior: 'aggressive',
    maxHp: 280, attack: 40, defense: 15, speed: 6,
    biomeAffinity: ['void_pocket', 'alien_intrusion', 'bioluminescent'],
    depthRange: [16, 20],
    factCategory: 'General Knowledge',
    loot: [{ mineralTier: 'essence', amount: 4 }],
    spriteKey: 'creature_horror',
  },
  {
    id: 'creature_deep_spectre',
    name: 'Deep Spectre',
    species: 'spectre',
    rarity: 'epic',
    behavior: 'territorial',
    maxHp: 240, attack: 32, defense: 12, speed: 5,
    biomeAffinity: ['deep_biolume', 'pressure_dome', 'iron_core_fringe'],
    depthRange: [16, 20],
    factCategory: 'Life Sciences',
    loot: [{ mineralTier: 'geode', amount: 4 }, { mineralTier: 'essence', amount: 1 }],
    spriteKey: 'creature_spectre',
    tintColor: 0x00ffbb,
    ability: {
      name: 'Spectral Drain',
      description: 'Halves player HP for 2 turns unless answered correctly',
      cooldown: 4, effect: 'weaken', magnitude: 0.5
    },
  },
]
```

#### 36.3.2 — New file: `src/game/systems/CreatureSpawner.ts`

```typescript
// src/game/systems/CreatureSpawner.ts
import { CREATURE_TEMPLATES } from '../../data/creatures'
import { createCreature } from '../entities/Creature'
import type { Creature } from '../entities/Creature'
import type { BiomeId } from '../../data/biomes'
import { BALANCE } from '../../data/balance'

/**
 * CreatureSpawner selects and instantiates creatures appropriate to the
 * current biome and layer depth, respecting spawn rate and cooldown. (DD-V2-026)
 */
export class CreatureSpawner {
  private blocksSinceSpawn = 0
  private totalBlocksThisLayer = 0

  /** Reset counters when entering a new layer. */
  resetForLayer(): void {
    this.blocksSinceSpawn = 0
    this.totalBlocksThisLayer = 0
  }

  /** Reset counters at the start of a new dive. */
  resetForDive(): void {
    this.resetForLayer()
  }

  /**
   * Call after every block is mined.
   * Returns a Creature instance if a spawn should trigger, otherwise null.
   *
   * @param currentLayerIndex  0-based index of the current mine layer
   * @param currentBiomeId     Active biome ID for affinity-based selection
   */
  checkSpawn(currentLayerIndex: number, currentBiomeId: BiomeId | null): Creature | null {
    this.totalBlocksThisLayer++
    this.blocksSinceSpawn++

    // Never spawn on boss layers — boss combat is handled exclusively by EncounterManager
    const bossLayers = BALANCE.BOSS_LAYER_INDICES as readonly number[]
    if (bossLayers.includes(currentLayerIndex)) return null

    // Layer 0 is tutorial-adjacent; no creature spawns there
    if (currentLayerIndex < 1) return null

    // Minimum block threshold before first spawn
    if (this.totalBlocksThisLayer < BALANCE.CREATURE_SPAWN_MIN_BLOCKS) return null

    // Cooldown between spawns
    if (this.blocksSinceSpawn < BALANCE.CREATURE_SPAWN_COOLDOWN) return null

    // Probability check
    if (Math.random() >= BALANCE.CREATURE_SPAWN_CHANCE_PER_BLOCK) return null

    const template = this._selectTemplate(currentLayerIndex, currentBiomeId)
    if (!template) return null

    this.blocksSinceSpawn = 0
    return createCreature(template, currentLayerIndex + 1)
  }

  /**
   * Select a creature template appropriate for the given layer and biome.
   * Prefers biome-affine creatures; falls back to any depth-eligible creature.
   */
  private _selectTemplate(
    layerIndex: number,
    biomeId: BiomeId | null,
  ): typeof CREATURE_TEMPLATES[number] | null {
    const layer = layerIndex + 1  // 1-based for depthRange comparisons

    const eligible = CREATURE_TEMPLATES.filter(
      c => layer >= c.depthRange[0] && layer <= c.depthRange[1]
    )
    if (eligible.length === 0) return null

    const biomeAffine = biomeId
      ? eligible.filter(c => c.biomeAffinity.includes(biomeId))
      : []

    const pool = biomeAffine.length > 0 ? biomeAffine : eligible
    return pool[Math.floor(Math.random() * pool.length)]
  }
}
```

#### 36.3.3 — Wire CreatureSpawner into MineScene

In `src/game/scenes/MineScene.ts`:

```typescript
// Add import:
import { CreatureSpawner } from '../systems/CreatureSpawner'

// Add private field to MineScene class:
private creatureSpawner = new CreatureSpawner()

// In the block-mined handler (after successfully mining a block), add:
const spawnedCreature = this.creatureSpawner.checkSpawn(
  this.currentLayerIndex,
  (this.currentBiome?.id as BiomeId) ?? null
)
if (spawnedCreature) {
  this.emit('creature-encounter', spawnedCreature)
}

// In the layer-transition handler (after descending to next layer):
this.creatureSpawner.resetForLayer()

// In the dive-start initialization block:
this.creatureSpawner.resetForDive()
```

The `MineScene` property `currentLayerIndex` (0-based integer) must be accessible; confirm it is already tracked or add it if absent. The property `currentBiome` (type `Biome | null`) is already present based on `MineSceneData`.

#### 36.3.4 — Acceptance criteria

- `CREATURE_TEMPLATES` has exactly 12 entries, 3 per tier.
- All templates have non-empty `biomeAffinity`, valid `depthRange`, `loot`, and `spriteKey`.
- `CreatureSpawner.checkSpawn()` returns null for layer indices 4, 9, 14, 19 (100 iterations each).
- `CreatureSpawner.checkSpawn()` returns null when `totalBlocksThisLayer < CREATURE_SPAWN_MIN_BLOCKS`.
- `CreatureSpawner.checkSpawn()` returns null when `blocksSinceSpawn < CREATURE_SPAWN_COOLDOWN`.
- `typecheck` passes after wiring.

---

### 36.4 — Quiz Gauntlet Mode (Rapid-Fire Quiz Sequence for Combat Damage)

**Goal**: During combat, the player's only attack action is a quiz. Correct answer deals damage (with 1.5× multiplier). Wrong answer causes the creature to counter-attack and drains O2. Boss encounters chain multiple questions per attack turn based on boss phase.

#### 36.4.1 — Add `'combat'` source to QuizManager: `src/game/managers/QuizManager.ts`

1. Extend the `source` union in `ActiveQuizValue`:

```typescript
source?: 'gate' | 'oxygen' | 'study' | 'artifact' | 'random' | 'layer' | 'combat'
```

2. Add a narrative frame constant:

```typescript
static readonly NARRATIVE_FRAMES = {
  // ... existing entries unchanged ...
  combat: "ATTACK VECTOR — Knowledge is your weapon. Answer to strike!",
} as const
```

3. Add `encounterManagerRef` property (set by GameManager, avoids circular import):

```typescript
encounterManagerRef: import('../managers/EncounterManager').EncounterManager | null = null
```

4. Add `triggerCombatQuiz` method:

```typescript
/**
 * Trigger a quiz attack during combat. Selects a fact from the creature's
 * category if possible, falls back to any available fact.
 *
 * @param factCategory     The creature's associated quiz category
 * @param gauntletTotal    Total questions in this gauntlet chain (default 1)
 * @param gauntletRemaining Questions remaining including this one
 */
async triggerCombatQuiz(
  factCategory: string,
  gauntletTotal = 1,
  gauntletRemaining = 1,
): Promise<void> {
  const facts = get(playerSave)?.learnedFacts ?? []
  const fact = await selectQuestion(facts, factCategory) ?? await selectQuestion(facts)
  if (!fact) return

  const choices = await getQuizChoices(fact)
  activeQuiz.set({
    fact,
    choices,
    source: 'combat',
    gateProgress: gauntletTotal > 1
      ? { remaining: gauntletRemaining, total: gauntletTotal }
      : undefined,
  })
  currentScreen.set('quiz')
}
```

5. Add `handleCombatQuizAnswer` method:

```typescript
/** Handle a quiz answer during a combat encounter. Routes result to EncounterManager. */
handleCombatQuizAnswer(correct: boolean): void {
  const quiz = get(activeQuiz)
  if (quiz) {
    this.trackQuizAnswered(quiz, correct)
    updateReviewState(quiz.fact.id, correct, quiz.fact.category[0])
    if (!correct && this.isConsistencyViolation(quiz.fact.id, false)) {
      this.applyConsistencyPenalty(quiz.fact.id)
    }
  }
  activeQuiz.set(null)
  currentScreen.set('combat')
  this.encounterManagerRef?.resolveCombatQuizAnswer(correct)
}
```

#### 36.4.2 — CombatManager: add `setPendingQuizMultiplier`

In `src/game/managers/CombatManager.ts`:

```typescript
// Add private field:
private pendingQuizMultiplier = 1.0

/** Set a one-shot attack multiplier for the next quiz_attack turn. Resets to 1.0 after use. */
setPendingQuizMultiplier(multiplier: number): void {
  this.pendingQuizMultiplier = multiplier
}

// In executeTurn, 'quiz_attack' case, replace:
//   const attackMultiplier = action === 'quiz_attack' ? 1.5 : 1.0
// with:
const attackMultiplier = action === 'quiz_attack'
  ? BALANCE.COMBAT_QUIZ_ATTACK_MULTIPLIER * this.pendingQuizMultiplier
  : 1.0
if (action === 'quiz_attack') this.pendingQuizMultiplier = 1.0  // reset after use
```

Also add the import for `BALANCE` at the top of `CombatManager.ts`:

```typescript
import { BALANCE } from '../../data/balance'
```

#### 36.4.3 — CombatOverlay: `src/ui/components/CombatOverlay.svelte`

```svelte
<!-- src/ui/components/CombatOverlay.svelte -->
<script lang="ts">
  import { combatState } from '../../ui/stores/combatState'
  import { encounterManager } from '../../game/managers/EncounterManager'
  import { audioManager } from '../../services/audioService'
  import type { Boss } from '../../game/entities/Boss'

  const state = $derived($combatState)
  const isBoss = $derived(state.encounterType === 'boss')
  const playerHpPct  = $derived(state.playerMaxHp > 0 ? (state.playerHp  / state.playerMaxHp)  * 100 : 0)
  const creatureHpPct = $derived(state.creatureMaxHp > 0 ? (state.creatureHp / state.creatureMaxHp) * 100 : 0)
  const bossTitle = $derived(isBoss ? (state.creature as Boss)?.title ?? null : null)

  function onAttack() {
    audioManager.play('button_tap')
    encounterManager.startQuizAttack()
  }
  function onDefend() {
    audioManager.play('button_tap')
    encounterManager.defend()
  }
  function onFlee() {
    audioManager.play('button_tap')
    encounterManager.attemptFlee()
  }
</script>

{#if state.active}
<div class="combat-overlay" role="dialog" aria-label="Combat encounter">
  <div class="header">
    {#if bossTitle}<div class="boss-title">{bossTitle}</div>{/if}
    <div class="creature-name">{state.creature?.name ?? '???'}</div>
  </div>

  <div class="hp-row">
    <span class="label">Enemy</span>
    <div class="bar-track">
      <div class="bar-fill enemy" style="width:{creatureHpPct}%"></div>
    </div>
    <span class="hp-num">{state.creatureHp}/{state.creatureMaxHp}</span>
  </div>

  <div class="hp-row">
    <span class="label">You</span>
    <div class="bar-track">
      <div class="bar-fill player" style="width:{playerHpPct}%"></div>
    </div>
    <span class="hp-num">{state.playerHp}/{state.playerMaxHp}</span>
  </div>

  <div class="log" aria-live="polite">
    {#each state.log.slice(-4) as line}
      <div class="log-line">{line}</div>
    {/each}
  </div>

  {#if state.result === 'victory'}
    <div class="result victory">Victory!</div>
  {:else if state.result === 'defeat'}
    <div class="result defeat">Defeated!</div>
  {:else if state.result === 'fled'}
    <div class="result fled">Escaped!</div>
  {:else if state.awaitingQuiz}
    <div class="awaiting">Preparing question...</div>
  {:else}
    <div class="actions">
      <button class="btn attack" onclick={onAttack} aria-label="Attack with quiz">
        Attack (Quiz)
      </button>
      <button class="btn defend" onclick={onDefend} aria-label="Defend">Defend</button>
      <button class="btn flee"   onclick={onFlee}   aria-label="Attempt to flee">Flee</button>
    </div>
  {/if}
</div>
{/if}

<style>
  .combat-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.9);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    z-index: 800; gap: 10px; color: #eee; padding: 20px;
    pointer-events: auto;
  }
  .boss-title   { font-size: 0.72rem; color: #ffd369; letter-spacing: 0.2em; text-transform: uppercase; }
  .creature-name { font-size: 1.6rem; font-weight: bold; color: #e94560; }
  .hp-row       { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 320px; }
  .label        { font-size: 0.73rem; width: 40px; text-align: right; color: #aaa; }
  .bar-track    { flex: 1; height: 12px; background: #333; border-radius: 6px; overflow: hidden; }
  .bar-fill     { height: 100%; border-radius: 6px; transition: width 0.3s ease; }
  .bar-fill.enemy  { background: linear-gradient(90deg, #e94560, #ff7043); }
  .bar-fill.player { background: linear-gradient(90deg, #4ecca3, #00bcd4); }
  .hp-num       { font-size: 0.68rem; color: #888; width: 62px; }
  .log {
    width: 100%; max-width: 320px;
    background: rgba(255,255,255,0.05); border-radius: 6px;
    padding: 8px 10px; min-height: 68px;
    font-size: 0.76rem; color: #ccc; line-height: 1.55;
  }
  .log-line { margin-bottom: 2px; }
  .actions  { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .btn { border: none; border-radius: 8px; padding: 10px 18px; font-size: 0.95rem; cursor: pointer; }
  .btn.attack  { background: #e94560; color: #fff; }
  .btn.defend  { background: #4a4a6a; color: #eee; }
  .btn.flee    { background: #2a2a3a; color: #bbb; font-size: 0.85rem; }
  .awaiting    { color: #aaa; font-style: italic; font-size: 0.9rem; }
  .result      { font-size: 1.2rem; font-weight: bold; margin-top: 8px; }
  .result.victory { color: #4ecca3; }
  .result.defeat  { color: #e94560; }
  .result.fled    { color: #ffd369; }
</style>
```

#### 36.4.4 — Wire CombatOverlay into App.svelte

In `src/App.svelte`, import and conditionally mount `CombatOverlay` and `BossIntroOverlay`:

```svelte
<script lang="ts">
  // ... existing imports ...
  import CombatOverlay from './ui/components/CombatOverlay.svelte'
  import BossIntroOverlay from './ui/components/BossIntroOverlay.svelte'
  import TheDeepUnlockOverlay from './ui/components/TheDeepUnlockOverlay.svelte'
  import { combatState } from './ui/stores/combatState'
  import { currentScreen } from './ui/stores/gameState'
  // ...
</script>

<!-- Add alongside other overlays: -->
{#if $combatState.active}
  <CombatOverlay />
{/if}
{#if $currentScreen === 'the-deep-unlock'}
  <TheDeepUnlockOverlay onProceed={() => currentScreen.set('mining')} />
{/if}
```

#### 36.4.5 — Wire quiz answer routing in GameManager

In `GameManager.ts`, in the method that handles `activeQuiz` changes (the `source` dispatch block), add a case for `'combat'`:

```typescript
// In the quiz answer routing switch/if-else, add:
case 'combat':
  this.quizManager.handleCombatQuizAnswer(correct)
  break
```

#### 36.4.6 — Acceptance criteria

- `QuizManager.triggerCombatQuiz()` sets `activeQuiz` with `source: 'combat'`.
- `QuizManager.handleCombatQuizAnswer()` calls `encounterManagerRef.resolveCombatQuizAnswer()`.
- `CombatOverlay` renders when `combatState.active` is true.
- `CombatOverlay` shows player HP, creature HP, and three action buttons.
- Clicking "Attack (Quiz)" calls `encounterManager.startQuizAttack()`.
- `NARRATIVE_FRAMES.combat` is defined in `QuizManager`.
- `CombatManager.setPendingQuizMultiplier()` resets to 1.0 after one use.
- `typecheck` passes.

---

### 36.5 — Combat Rewards (Unique Drops, Companion XP, Mineral Bonuses)

**Goal**: Defeating creatures and bosses yields distinct rewards integrated into the dive loot pipeline. Boss victories update the permanent `defeatedBosses` record and fire analytics events.

#### 36.5.1 — Reward tables: `src/data/combatRewards.ts`

```typescript
// src/data/combatRewards.ts

/** Companion XP awarded for defeating each creature. */
export const CREATURE_COMPANION_XP: Record<string, number> = {
  creature_glow_sprite:        5,
  creature_stone_crab:         8,
  creature_dust_mite:          6,
  creature_lava_salamander:   12,
  creature_crystal_shard:     15,
  creature_shadow_eel:         10,
  creature_void_crawler:       20,
  creature_magma_golem:        25,
  creature_ancient_worm:       22,
  creature_echo_wraith:        30,
  creature_void_horror:        40,
  creature_deep_spectre:       35,
}

/** Boss relic drop IDs. Key = boss template ID. */
export const BOSS_RELIC_DROPS: Record<string, string> = {
  boss_crystal_golem:    'relic_crystal_heart',
  boss_lava_wyrm:        'relic_wyrm_scale',
  boss_deep_leviathan:   'relic_leviathan_fin',
  boss_void_sentinel:    'relic_void_eye',
}

/**
 * Mineral yield multiplier applied to ALL loot collected on the current layer
 * after a boss is defeated. Stacks additively with relic bonuses.
 */
export const BOSS_LAYER_LOOT_MULTIPLIER = 1.5

/** Creature kills required to unlock the 'Abyss Walker' title. */
export const TITLE_UNLOCK_CREATURE_KILLS = 50
```

#### 36.5.2 — Add analytics events

In `src/services/analyticsService.ts`, confirm (or add) these event names are accepted by the event union. The existing implementation uses a `name` string field, so no type changes are needed — just document the new event names used in `EncounterManager`:

```
combat_started    { encounter_type: 'creature'|'boss', creature_id: string, layer: number }
combat_victory    { creature_id: string, turns: number, companion_xp: number }
boss_defeated     { boss_id: string, layer: number, turns: number }
combat_defeat     { creature_id: string, layer: number }
```

Fire `combat_started` in `EncounterManager.startCreatureEncounter` and `startBossEncounter`:

```typescript
import { analyticsService } from '../../services/analyticsService'
import { get } from 'svelte/store'
import { currentLayer } from '../../ui/stores/gameState'

// In startCreatureEncounter, after combatState.set():
analyticsService.track({
  name: 'combat_started',
  properties: { encounter_type: 'creature', creature_id: creature.id, layer: get(currentLayer) }
})

// In startBossEncounter, after combatState.set():
analyticsService.track({
  name: 'combat_started',
  properties: { encounter_type: 'boss', creature_id: boss.id, layer: get(currentLayer) }
})
```

Fire `boss_defeated` and `combat_victory` from `_processVictoryRewards()` in `EncounterManager`.

#### 36.5.3 — Acceptance criteria

- `CREATURE_COMPANION_XP` has entries for all 12 creature IDs.
- `BOSS_RELIC_DROPS` maps all 4 boss IDs to relic ID strings.
- `_processVictoryRewards()` calls `addMinerals` for each loot entry on the defeated creature.
- `defeatedBossesThisRun` and `defeatedBosses` are updated in playerSave on boss victory.
- `creatureKills` increments by 1 on creature victory.
- Analytics events `combat_started` and `boss_defeated` fire correctly.
- `typecheck` passes.

---

### 36.6 — "The Deep" Secret Biome (Layer 21+, Extreme Difficulty, Unique Rewards)

**Goal**: Players who defeat all four bosses in a single dive gain access to "The Deep" — an optional terminal zone beyond L20 with extreme difficulty and exclusive rewards.

#### 36.6.1 — Biome data: `src/data/theDeep.ts`

```typescript
// src/data/theDeep.ts
import type { Biome } from './biomes'

/**
 * "The Deep" secret biome — accessible only after defeating all 4 landmark bosses
 * in a single dive. A terminal zone with no further descent shaft. (DD-V2-025)
 */
export const THE_DEEP_BIOME: Omit<Biome, 'id'> & { id: 'void_pocket' } = {
  id: 'void_pocket',  // Reuses closest visual tier; MineScene keys off 'the_deep' label
  label: 'The Deep',
  name: 'The Deep',
  tier: 'anomaly',
  layerRange: [21, 25],
  anomalyChance: 1.0,
  description: 'A realm beyond the known strata. The laws of geology no longer apply.',
  entryGaiaLine: 'GAIA: "Pilot... these readings are impossible. We should not be this deep. Proceed with extreme caution."',
  ambientColor: 0x0a0015,
  fogColor: 0x220033,
  hazardWeights: {
    lavaBlockDensity: 2.5,
    gasPocketDensity: 2.5,
    unstableGroundChance: 2.0,
  },
  mineralWeights: {
    dustMultiplier: 0.5,
    shardMultiplier: 0.5,
    crystalMultiplier: 1.5,
    geodeMultiplier: 3.0,
    essenceMultiplier: 5.0,
    rareNodeBonus: 0.4,
  },
  palette: {
    primary: 0x110022,
    secondary: 0x330055,
    accent: 0xaa00ff,
    background: 0x0a000f,
    highlight: 0xff00ff,
  },
  structuralFeatures: ['void_spires', 'reality_tears'],
  visualTier: 4,
  spritePrefix: 'deep',
  isAnomaly: true,
  depthAesthetic: 'the_deep',
}

/** Rewards exclusive to "The Deep". */
export const THE_DEEP_REWARDS = {
  essenceDropMin: 5,
  essenceDropMax: 15,
  uniqueRelicId: 'relic_deep_core',
  uniqueCosmeticId: 'cosmetic_void_pickaxe',
  companionXpMultiplier: 3.0,
  titleUnlockId: 'title_abyss_walker',
} as const
```

#### 36.6.2 — The Deep unlock check in MineScene

At L20 (layer index 19), AFTER the boss is defeated (i.e., `defeatedBossesThisRun` includes `boss_void_sentinel`), MineScene checks for The Deep unlock when the player approaches the DescentShaft:

```typescript
// In MineScene descent handler, AFTER the boss gate check:
if (this.currentLayerIndex === 19 && encounterManager.isTheDeepUnlocked()) {
  // Offer The Deep instead of surfacing
  this.emit('the-deep-unlocked')
  return
}
```

The Deep uses a special flag on layer generation: pass `{ biome: THE_DEEP_BIOME, noDescentShaft: true }` to `generateMine()`. Since `generateMine` receives a `Biome` override already (via `MineSceneData.biome`), the Deep just needs a biome override and its guaranteed essence density handled at generation time.

#### 36.6.3 — TheDeepUnlockOverlay: `src/ui/components/TheDeepUnlockOverlay.svelte`

```svelte
<!-- src/ui/components/TheDeepUnlockOverlay.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'

  interface Props { onProceed: () => void }
  let { onProceed }: Props = $props()

  let fading = $state(false)

  onMount(() => {
    const t = setTimeout(() => {
      fading = true
      setTimeout(onProceed, 500)
    }, 3500)
    return () => clearTimeout(t)
  })
</script>

<div class="deep-unlock" class:fading>
  <div class="layer-label">LAYER 21</div>
  <div class="title">THE DEEP</div>
  <div class="subtitle">All bosses defeated. The abyss opens.</div>
  <div class="gaia-quote">GAIA: "Pilot... these readings are impossible. Proceed."</div>
</div>

<style>
  .deep-unlock {
    position: fixed; inset: 0;
    background: #000;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    z-index: 950; color: #fff; gap: 14px; text-align: center;
    pointer-events: none;
    animation: deepIn 1.2s ease;
  }
  .deep-unlock.fading { animation: deepOut 0.5s ease forwards; }
  .layer-label { font-size: 0.75rem; letter-spacing: 0.3em; color: #770099; text-transform: uppercase; }
  .title       { font-size: 2.6rem; font-weight: bold; color: #cc00ff; text-shadow: 0 0 24px #cc00ff88; }
  .subtitle    { font-size: 0.95rem; color: #aaa; }
  .gaia-quote  { font-size: 0.8rem; color: #7af; font-style: italic; max-width: 280px; }
  @keyframes deepIn  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes deepOut { from { opacity: 1 } to { opacity: 0 } }
</style>
```

#### 36.6.4 — Acceptance criteria

- `THE_DEEP_BIOME` object has all required `Biome`-interface fields (typecheck passes).
- `isTheDeepUnlocked()` returns false when `defeatedBossesThisRun` is missing any of the 4 boss IDs.
- `isTheDeepUnlocked()` returns true when all 4 boss IDs are present.
- `theDeepVisits` in playerSave increments when The Deep event fires.
- `TheDeepUnlockOverlay.svelte` compiles without errors.
- The overlay auto-dismisses after 3.5 + 0.5 = 4 seconds total.

---

### 36.7 — Combat Balance Tuning (HP Curves, Damage Scaling, Companion Synergies)

**Goal**: All combat parameters are tunable through `balance.ts`. Companion and relic bonuses apply correctly without making combat trivial.

#### 36.7.1 — Player HP scaling across boss encounters

| Boss | Layer (1-based) | Layer index | Formula | Player HP |
|---|---|---|---|---|
| Crystal Golem   | L5  | 4  | 100 + (5-1) × 5  | 120 |
| Lava Wyrm       | L10 | 9  | 100 + (10-1) × 5 | 145 |
| Deep Leviathan  | L15 | 14 | 100 + (13-1) × 5 | 160 |
| Void Sentinel   | L20 | 19 | 100 + (17-1) × 5 | 180 |

The formula `COMBAT_PLAYER_BASE_HP + (boss.depthRange[0] - 1) * COMBAT_PLAYER_HP_PER_LAYER` is already implemented in `EncounterManager.startBossEncounter`. The values above are derived automatically.

#### 36.7.2 — Companion combat synergies

In `EncounterManager._computePlayerAttack()` and `._computePlayerDefense()`, integrate the active companion effect:

```typescript
import { companionManager } from './CompanionManager'

private _computePlayerAttack(): number {
  let attack = BALANCE.COMBAT_BASE_PLAYER_ATTACK
  const effect = companionManager.getPrimaryEffect()
  if (effect?.effectId === 'combat_attack_bonus') {
    attack += Math.round(attack * effect.magnitude)
  }
  return attack
}

private _computePlayerDefense(): number {
  let defense = BALANCE.COMBAT_BASE_PLAYER_DEFENSE
  const effect = companionManager.getPrimaryEffect()
  if (effect?.effectId === 'combat_defense_bonus') {
    defense += Math.round(defense * effect.magnitude)
  }
  return defense
}
```

Also apply companion HP bonus in both `startCreatureEncounter` and `startBossEncounter`:

```typescript
const hpEffect = companionManager.getSecondaryEffect()
let finalPlayerHp = playerHp
if (hpEffect?.effectId === 'combat_hp_bonus') {
  finalPlayerHp += Math.round(BALANCE.COMBAT_PLAYER_BASE_HP * hpEffect.magnitude)
}
```

These companion `effectId` values (`'combat_attack_bonus'`, `'combat_defense_bonus'`, `'combat_hp_bonus'`) should be declared in at least one companion entry in `src/data/companions.ts` (the actual companion data file). No change is needed to `CompanionManager.ts` itself — it already exposes `getPrimaryEffect()` and `getSecondaryEffect()`.

#### 36.7.3 — Relic combat synergies via `quiz_master` effect

In `EncounterManager.startQuizAttack()`, apply `quiz_master` relic bonus to the damage multiplier before triggering the quiz:

```typescript
import { equippedRelicsV2 } from '../../ui/stores/gameState'
import type { RelicDefinition } from '../../data/relics'

// In startQuizAttack(), before calling triggerCombatQuiz():
const relics: RelicDefinition[] = (get(equippedRelicsV2) as RelicDefinition[]) ?? []
let quizMultiplier = 1.0
for (const relic of relics) {
  if (relic.effect.type === 'quiz_master') {
    quizMultiplier += (relic.effect as any).bonus / 100
  }
}
combatManager.setPendingQuizMultiplier(quizMultiplier)
```

#### 36.7.4 — O2 consequences summary

| Action | O2 consequence |
|---|---|
| Correct quiz attack | No O2 cost |
| Wrong quiz answer in combat | `COMBAT_WRONG_O2_COST` (10) O2 drained |
| Defend | No O2 cost |
| Flee attempt (success or failure) | `COMBAT_FLEE_O2_COST` (15) O2 drained |
| Boss phase ability: Crushing Depth | 20 O2 drained (handled in creature phase dialogue trigger) |

All O2 drains call `MineScene.drainOxygen()` via the `getMineScene()` accessor already set up in `EncounterManager`.

#### 36.7.5 — Acceptance criteria

- Player HP at L5 boss = 120 (not 100).
- Companion with `effectId: 'combat_attack_bonus'` increases computed `playerAttack`.
- `quiz_master` relic with `bonus: 25` results in `quizMultiplier = 1.25`, which is passed to `CombatManager.setPendingQuizMultiplier()`.
- Wrong answer in combat calls `scene.drainOxygen(10)`.
- Flee always calls `scene.drainOxygen(15)`.
- `typecheck` passes on all modified files.

---

## 3. Playwright Tests

Save as `/tmp/test-combat.js` and run with `node /tmp/test-combat.js` while the dev server is running on port 5173.

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')

  // ── Test 1: combatState store exists and has correct initial shape ─────────
  console.log('TEST 1: combatState initial state')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  const initState = await page.evaluate(async () => {
    const mod = await import('/src/ui/stores/combatState.ts')
    const { get } = await import('svelte/store')
    const s = get(mod.combatState)
    return { active: s.active, result: s.result, creature: s.creature }
  })
  if (initState.active !== false) throw new Error('TEST 1 FAILED: active should be false initially')
  if (initState.creature !== null) throw new Error('TEST 1 FAILED: creature should be null initially')
  console.log('TEST 1 PASSED:', initState)

  // ── Test 2: Navigate to mine and force creature encounter ──────────────────
  console.log('TEST 2: CombatOverlay renders on creature encounter')
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(800)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/combat-t2-pre.png' })

  await page.evaluate(async () => {
    const { encounterManager } = await import('/src/game/managers/EncounterManager.ts')
    const { CREATURE_TEMPLATES } = await import('/src/data/creatures.ts')
    const { createCreature } = await import('/src/game/entities/Creature.ts')
    const creature = createCreature(CREATURE_TEMPLATES[0], 1)
    encounterManager.startCreatureEncounter(creature)
  })
  await page.waitForTimeout(800)
  await page.screenshot({ path: '/tmp/combat-t2-overlay.png' })

  const hasAttackBtn = await page.$('.btn.attack')
  if (!hasAttackBtn) throw new Error('TEST 2 FAILED: Attack button not found in CombatOverlay')
  console.log('TEST 2 PASSED: CombatOverlay visible with Attack button')

  // ── Test 3: Clicking Attack transitions to quiz screen ────────────────────
  console.log('TEST 3: Attack button triggers quiz')
  await page.click('.btn.attack')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/combat-t3-quiz.png' })
  const screen = await page.evaluate(async () => {
    const { get } = await import('svelte/store')
    const { currentScreen } = await import('/src/ui/stores/gameState.ts')
    return get(currentScreen)
  })
  if (screen !== 'quiz') throw new Error(`TEST 3 FAILED: expected screen 'quiz', got '${screen}'`)
  console.log('TEST 3 PASSED: screen is now quiz')

  // ── Test 4: BossIntroOverlay renders correctly ─────────────────────────────
  console.log('TEST 4: BossIntroOverlay renders')
  await page.evaluate(async () => {
    // Reset to mine screen first
    const { currentScreen } = await import('/src/ui/stores/gameState.ts')
    currentScreen.set('mining')
  })
  await page.waitForTimeout(500)
  await page.evaluate(async () => {
    const { encounterManager } = await import('/src/game/managers/EncounterManager.ts')
    const { createBoss } = await import('/src/game/entities/Boss.ts')
    const boss = createBoss('boss_crystal_golem', 5)
    if (boss) encounterManager.startBossEncounter(boss)
  })
  await page.waitForTimeout(600)
  await page.screenshot({ path: '/tmp/combat-t4-boss.png' })
  const bossState = await page.evaluate(async () => {
    const { get } = await import('svelte/store')
    const { combatState } = await import('/src/ui/stores/combatState.ts')
    const s = get(combatState)
    return { active: s.active, type: s.encounterType, creatureName: s.creature?.name }
  })
  if (!bossState.active) throw new Error('TEST 4 FAILED: combat not active after boss encounter')
  if (bossState.type !== 'boss') throw new Error(`TEST 4 FAILED: expected type 'boss', got '${bossState.type}'`)
  console.log('TEST 4 PASSED: Boss encounter active, creature:', bossState.creatureName)

  // ── Test 5: CreatureSpawner never spawns on boss layers ────────────────────
  console.log('TEST 5: CreatureSpawner rejects spawn on boss layers')
  const spawnResult = await page.evaluate(async () => {
    const { CreatureSpawner } = await import('/src/game/systems/CreatureSpawner.ts')
    const spawner = new CreatureSpawner()
    let spawnedOnBossLayer = false
    // Simulate 300 blocks on boss layer index 4
    for (let i = 0; i < 300; i++) {
      const r = spawner.checkSpawn(4, 'limestone_caves')
      if (r !== null) spawnedOnBossLayer = true
    }
    return { spawnedOnBossLayer }
  })
  if (spawnResult.spawnedOnBossLayer) throw new Error('TEST 5 FAILED: creature spawned on boss layer')
  console.log('TEST 5 PASSED: No creature spawned on boss layer 4')

  // ── Test 6: isTheDeepUnlocked gate logic ──────────────────────────────────
  console.log('TEST 6: isTheDeepUnlocked logic')
  const deepResults = await page.evaluate(async () => {
    const { encounterManager } = await import('/src/game/managers/EncounterManager.ts')
    const { playerSave } = await import('/src/ui/stores/playerData.ts')

    // Case A: No bosses defeated
    playerSave.update(s => s ? { ...s, defeatedBossesThisRun: [] } : s)
    const noBosses = encounterManager.isTheDeepUnlocked()

    // Case B: Only 3 bosses defeated
    playerSave.update(s => s ? {
      ...s,
      defeatedBossesThisRun: ['boss_crystal_golem', 'boss_lava_wyrm', 'boss_deep_leviathan']
    } : s)
    const threeBosses = encounterManager.isTheDeepUnlocked()

    // Case C: All 4 defeated
    playerSave.update(s => s ? {
      ...s,
      defeatedBossesThisRun: ['boss_crystal_golem', 'boss_lava_wyrm', 'boss_deep_leviathan', 'boss_void_sentinel']
    } : s)
    const allBosses = encounterManager.isTheDeepUnlocked()

    return { noBosses, threeBosses, allBosses }
  })
  if (deepResults.noBosses !== false) throw new Error('TEST 6 FAILED: should be false with 0 bosses')
  if (deepResults.threeBosses !== false) throw new Error('TEST 6 FAILED: should be false with 3 bosses')
  if (deepResults.allBosses !== true) throw new Error('TEST 6 FAILED: should be true with all 4 bosses')
  console.log('TEST 6 PASSED:', deepResults)

  await page.screenshot({ path: '/tmp/combat-final.png' })
  console.log('ALL TESTS PASSED. Final screenshot: /tmp/combat-final.png')
  await browser.close()
})()
```

---

## 4. Verification Gate

All of the following must pass before Phase 36 is marked complete.

### Typecheck

```bash
npm run typecheck
```

Expected: zero TypeScript errors. Confirm all new files (combatState.ts, EncounterManager.ts, CreatureSpawner.ts, creatures.ts, combatRewards.ts, theDeep.ts) pass.

### Build

```bash
npm run build
```

Expected: production build completes. No new chunk-size warnings beyond those already present.

### Manual Verification Checklist

- [ ] `combatState` store is importable from `src/ui/stores/combatState.ts`.
- [ ] `'combat'` is in the `Screen` union in `gameState.ts` (no TypeScript error when assigning).
- [ ] `combatEncounterActive` is exported from `gameState.ts`.
- [ ] `BOSS_LAYER_MAP` has 4 entries (keys 4, 9, 14, 19).
- [ ] `boss_deep_leviathan` is in `BOSS_TEMPLATES` with `relicDrop: 'relic_leviathan_fin'`.
- [ ] `CREATURE_TEMPLATES` has exactly 12 entries.
- [ ] All 14 new `BALANCE` keys compile without TypeScript `never` errors.
- [ ] `PlayerSave` has all 4 new optional fields.
- [ ] `CombatOverlay` shows player HP bar, creature HP bar, and 3 action buttons.
- [ ] Clicking "Attack (Quiz)" transitions `currentScreen` to `'quiz'`.
- [ ] `activeQuiz.source` is `'combat'` during a combat quiz.
- [ ] `QuizManager.NARRATIVE_FRAMES.combat` is defined.
- [ ] `BossIntroOverlay` dismisses automatically after ~2.2 seconds.
- [ ] `TheDeepUnlockOverlay` dismisses automatically after ~3.5 seconds.
- [ ] Wrong combat quiz answer drains O2 (observe HUD after answering wrong).
- [ ] Flee attempt always drains O2 regardless of success/failure.
- [ ] Defeating a boss updates `defeatedBossesThisRun` in playerSave.
- [ ] `isTheDeepUnlocked()` returns true only with all 4 boss IDs in `defeatedBossesThisRun`.
- [ ] `CombatManager.setPendingQuizMultiplier()` resets to 1.0 after one `executeTurn` call.

### Screenshot Verification

Take screenshots at each of the following states:

1. Mine entrance — no combat UI elements visible.
2. After force-triggering a creature encounter — `CombatOverlay` with HP bars and action buttons.
3. After clicking Attack — quiz overlay with `source: 'combat'` visible in store.
4. After force-triggering a boss encounter — boss name and title visible.
5. After setting all 4 bosses as defeated — `TheDeepUnlockOverlay` visible at L20 descent.

### Analytics Verification

In the browser dev console after triggering combat, confirm:

```javascript
// Should see these in the analytics queue:
analyticsService._queue  // or however the implementation exposes the queue
// Expected entries: combat_started, and (after combat ends) combat_victory or boss_defeated
```

---

## 5. Files Affected

### New Files

| Path | Purpose |
|---|---|
| `src/ui/stores/combatState.ts` | Reactive combat state (singleton writable, Svelte store) |
| `src/game/managers/EncounterManager.ts` | Combat lifecycle: start/resolve/end encounters, The Deep gate |
| `src/game/systems/CreatureSpawner.ts` | Biome-aware creature selection and spawn timing |
| `src/data/creatures.ts` | 12 creature templates across 4 depth tiers |
| `src/data/combatRewards.ts` | Boss relic drops, creature companion XP, loot multipliers |
| `src/data/theDeep.ts` | "The Deep" biome definition and exclusive reward table |
| `src/ui/components/CombatOverlay.svelte` | Full in-combat UI: HP bars, action buttons, combat log |
| `src/ui/components/BossIntroOverlay.svelte` | Cinematic boss introduction (2.2-second auto-dismiss) |
| `src/ui/components/TheDeepUnlockOverlay.svelte` | "The Deep" unlock cinematic (3.5-second auto-dismiss) |

### Modified Files

| Path | Changes |
|---|---|
| `src/game/entities/Boss.ts` | Add `boss_deep_leviathan` to `BOSS_TEMPLATES`; export `BOSS_LAYER_MAP` |
| `src/game/managers/CombatManager.ts` | Add `setPendingQuizMultiplier()`, apply it in `'quiz_attack'` case, import `BALANCE` |
| `src/game/managers/QuizManager.ts` | Add `'combat'` source type, `triggerCombatQuiz()`, `handleCombatQuizAnswer()`, `encounterManagerRef`, `NARRATIVE_FRAMES.combat` |
| `src/game/managers/EncounterManager.ts` | (new file — companion/relic methods reference CompanionManager, relicVault store) |
| `src/game/scenes/MineScene.ts` | Import `CreatureSpawner`; emit `'creature-encounter'`; gate descent with `BOSS_LAYER_MAP`; emit `'boss-encounter'` and `'the-deep-unlocked'` |
| `src/game/GameManager.ts` | Instantiate `EncounterManager`; wire scene events; route `handleCombatQuizAnswer`; set manager cross-references |
| `src/ui/stores/gameState.ts` | Add `'combat'` to `Screen` union; export `combatEncounterActive` |
| `src/data/balance.ts` | Add 14 new `COMBAT_*` / `CREATURE_SPAWN_*` / `THE_DEEP_*` constants |
| `src/data/types.ts` | Add `defeatedBossesThisRun`, `defeatedBosses`, `creatureKills`, `theDeepVisits` to `PlayerSave` |
| `src/App.svelte` | Mount `CombatOverlay`, `BossIntroOverlay`, `TheDeepUnlockOverlay` conditionally |

### Files NOT Modified

| Path | Reason |
|---|---|
| `src/game/entities/Creature.ts` | Interface and helpers already complete |
| `src/data/biomes.ts` | The Deep lives in `theDeep.ts` to avoid crowding the biome catalog |
| `src/game/managers/CompanionManager.ts` | Combat reads effects via existing `getPrimaryEffect()`/`getSecondaryEffect()` APIs |
| `src/game/managers/AchievementManager.ts` | `boss_defeated` event type already declared; no new code needed |
| `src/services/saveService.ts` | New `PlayerSave` fields are optional; no migration needed |
