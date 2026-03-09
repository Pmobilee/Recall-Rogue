# CR-09: Passive Relics

> Phase: P1 — Core Systems Completion
> Priority: HIGH
> Depends on: CR-08 (Mastery Tiers — Tier 3 graduation)
> Estimated scope: L

When a fact reaches Tier 3 (passes Mastery Trial), it graduates into a passive relic — a permanent buff that applies for the duration of every run. The relic type depends on the card type the fact held at graduation. 20 relics across 4 categories create build-around strategies. Max 12 active per run. Relics go dormant if FSRS retrievability drops below 0.7.

## Design Reference

From GAME_DESIGN.md Section 6 (Passive Relics):

### Offensive Passives (Attack graduation)

| Passive | Effect |
|---------|--------|
| First Blood | First attack each encounter +50% damage |
| Chain Lightning | Multi-hit attacks get +1 extra hit |
| Glass Cannon | All attacks +25% damage, take +10% more damage |
| Bloodlust | Killing an enemy heals 5 HP |
| Sharpened Edge | All Strike mechanics +3 base damage |

### Defensive Passives (Shield graduation)

| Passive | Effect |
|---------|--------|
| Iron Skin | Start each encounter with 4 block |
| Retaliation | Blocking an attack deals 2 damage back |
| Fortress | Block carries between turns (no reset) |
| Last Stand | Below 20% HP, all block doubled |
| Aegis | Parry always triggers draw bonus regardless of enemy action |

### Sustain Passives (Heal/Regen graduation)

| Passive | Effect |
|---------|--------|
| Second Wind | Once/encounter: survive killing blow at 1 HP |
| Natural Recovery | Heal 2 HP at encounter start |
| Overgrowth | Overhealing converts to temporary block |
| Vitality | Max HP permanently +5 |

### Tactical Passives (Buff/Debuff/Utility/Wild graduation)

| Passive | Effect |
|---------|--------|
| Combo Master | Combo starts at 1.15x instead of 1.0x |
| Quick Draw | Draw 6 cards instead of 5 |
| Momentum | Perfect turn (3/3 correct) → +1 AP next turn |
| Scholar's Focus | Speed bonus threshold 30% instead of 25% |
| Echo Chamber | Echo cards deal full power (not 0.7x reduced) |
| Scavenger | +1 currency per encounter per skipped card |

### Relic Rules

- Max 12 active relics per run
- Excess: 12 most recently mastered
- Dormancy: FSRS retrievability <0.7 → grayed out, suspended

## Implementation

### Data Model

**Create `src/data/relics.ts`:**

```typescript
import type { CardType } from './card-types';

export type RelicCategory = 'offensive' | 'defensive' | 'sustain' | 'tactical';

export type RelicTrigger =
  | 'on_attack'
  | 'on_multi_hit'
  | 'on_kill'
  | 'on_encounter_start'
  | 'on_block'
  | 'on_turn_end'
  | 'on_damage_taken'
  | 'on_parry'
  | 'on_lethal'
  | 'on_overheal'
  | 'permanent'
  | 'on_perfect_turn'
  | 'on_echo_play'
  | 'on_card_skip';

export interface RelicDefinition {
  id: string;
  name: string;
  description: string;
  category: RelicCategory;
  graduationType: CardType[];
  trigger: RelicTrigger;
  value: number;
  valueUnit: string;
  maxPerRun: number;
}

export interface ActiveRelic {
  definition: RelicDefinition;
  sourceFactId: string;
  isDormant: boolean;
  activatedThisEncounter: boolean;
}
```

**Define all 20 relics** in `src/data/relics.ts`:

```typescript
export const RELIC_DEFINITIONS: RelicDefinition[] = [
  // Offensive (Attack graduation)
  { id: 'first_blood',    name: 'First Blood',     description: 'First attack each encounter deals +50% damage',           category: 'offensive', graduationType: ['attack'], trigger: 'on_attack',          value: 50,  valueUnit: '%',           maxPerRun: 1 },
  { id: 'chain_lightning', name: 'Chain Lightning', description: 'Multi-hit attacks get +1 extra hit',                     category: 'offensive', graduationType: ['attack'], trigger: 'on_multi_hit',       value: 1,   valueUnit: 'hits',        maxPerRun: 1 },
  { id: 'glass_cannon',   name: 'Glass Cannon',    description: 'All attacks +25% damage, take +10% more damage',         category: 'offensive', graduationType: ['attack'], trigger: 'on_attack',          value: 25,  valueUnit: '%',           maxPerRun: 1 },
  { id: 'bloodlust',      name: 'Bloodlust',       description: 'Killing an enemy heals 5 HP',                            category: 'offensive', graduationType: ['attack'], trigger: 'on_kill',            value: 5,   valueUnit: 'HP',          maxPerRun: 1 },
  { id: 'sharpened_edge', name: 'Sharpened Edge',  description: 'All Strike mechanics +3 base damage',                    category: 'offensive', graduationType: ['attack'], trigger: 'on_attack',          value: 3,   valueUnit: 'dmg',         maxPerRun: 1 },

  // Defensive (Shield graduation)
  { id: 'iron_skin',      name: 'Iron Skin',       description: 'Start each encounter with 4 block',                      category: 'defensive', graduationType: ['shield'], trigger: 'on_encounter_start', value: 4,   valueUnit: 'block',       maxPerRun: 1 },
  { id: 'retaliation',    name: 'Retaliation',     description: 'Blocking an attack deals 2 damage back',                 category: 'defensive', graduationType: ['shield'], trigger: 'on_block',           value: 2,   valueUnit: 'dmg',         maxPerRun: 1 },
  { id: 'fortress',       name: 'Fortress',        description: 'Block carries between turns (no reset)',                  category: 'defensive', graduationType: ['shield'], trigger: 'on_turn_end',        value: 1,   valueUnit: 'flag',        maxPerRun: 1 },
  { id: 'last_stand',     name: 'Last Stand',      description: 'Below 20% HP, all block doubled',                        category: 'defensive', graduationType: ['shield'], trigger: 'on_damage_taken',    value: 20,  valueUnit: '% threshold', maxPerRun: 1 },
  { id: 'aegis',          name: 'Aegis',           description: 'Parry always triggers draw bonus regardless of enemy action', category: 'defensive', graduationType: ['shield'], trigger: 'on_parry',       value: 1,   valueUnit: 'flag',        maxPerRun: 1 },

  // Sustain (Heal/Regen graduation)
  { id: 'second_wind',      name: 'Second Wind',      description: 'Once per encounter: survive killing blow at 1 HP',    category: 'sustain', graduationType: ['heal', 'regen'], trigger: 'on_lethal',          value: 1,  valueUnit: 'HP',   maxPerRun: 1 },
  { id: 'natural_recovery', name: 'Natural Recovery',  description: 'Heal 2 HP at encounter start',                       category: 'sustain', graduationType: ['heal', 'regen'], trigger: 'on_encounter_start', value: 2,  valueUnit: 'HP',   maxPerRun: 1 },
  { id: 'overgrowth',       name: 'Overgrowth',        description: 'Overhealing converts to temporary block',            category: 'sustain', graduationType: ['heal', 'regen'], trigger: 'on_overheal',        value: 1,  valueUnit: 'flag', maxPerRun: 1 },
  { id: 'vitality',         name: 'Vitality',          description: 'Max HP permanently +5',                              category: 'sustain', graduationType: ['heal', 'regen'], trigger: 'permanent',          value: 5,  valueUnit: 'HP',   maxPerRun: 3 },

  // Tactical (Buff/Debuff/Utility/Wild graduation)
  { id: 'combo_master',     name: 'Combo Master',      description: 'Combo starts at 1.15x instead of 1.0x',              category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'permanent',       value: 1,  valueUnit: 'flag',     maxPerRun: 1 },
  { id: 'quick_draw',       name: 'Quick Draw',        description: 'Draw 6 cards instead of 5',                          category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'permanent',       value: 6,  valueUnit: 'cards',    maxPerRun: 1 },
  { id: 'momentum',         name: 'Momentum',          description: 'Perfect turn (3/3 correct) grants +1 AP next turn',  category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'on_perfect_turn', value: 1,  valueUnit: 'AP',       maxPerRun: 1 },
  { id: 'scholars_focus',   name: "Scholar's Focus",   description: 'Speed bonus threshold 30% instead of 25%',           category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'permanent',       value: 30, valueUnit: '% threshold', maxPerRun: 1 },
  { id: 'echo_chamber',     name: 'Echo Chamber',      description: 'Echo cards deal full power (not 0.7x)',              category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'on_echo_play',    value: 1,  valueUnit: 'flag',     maxPerRun: 1 },
  { id: 'scavenger',        name: 'Scavenger',         description: '+1 currency per encounter for each skipped card',    category: 'tactical', graduationType: ['buff', 'debuff', 'utility', 'wild'], trigger: 'on_card_skip',    value: 1,  valueUnit: 'currency', maxPerRun: 1 },
];
```

**Add to balance constants** in `src/data/balance.ts`:

```typescript
export const MAX_ACTIVE_RELICS = 12;
export const DORMANCY_THRESHOLD = 0.7;  // FSRS retrievability below this = dormant
```

### Logic

**Relic assignment on graduation** — Create `src/services/relicManager.ts`:

```typescript
export function assignRelicOnGraduation(
  cardType: CardType,
  existingRelics: ActiveRelic[],
): RelicDefinition | null
```

- Filter `RELIC_DEFINITIONS` by `graduationType` including `cardType`
- Exclude relics already active (by id) where `maxPerRun` is reached
- Pick random from remaining pool
- Return null if pool exhausted

**Relic resolution hooks** — Modify `cardEffectResolver.ts` and `turnManager.ts`:

- **Encounter start:** Iron Skin (apply 4 block), Natural Recovery (heal 2 HP)
- **On attack resolution:** First Blood (+50% if first attack this encounter), Glass Cannon (+25% / incoming +10%), Sharpened Edge (+3 to Strike mechanic)
- **On multi-hit:** Chain Lightning (+1 hit count)
- **On kill:** Bloodlust (heal 5 HP)
- **On block received:** Retaliation (deal 2 dmg back to enemy)
- **On turn end:** Fortress (skip block reset)
- **On lethal damage:** Second Wind (survive at 1 HP, once per encounter)
- **On overheal:** Overgrowth (excess HP → block)
- **Permanent modifiers:** Vitality (+5 max HP), Quick Draw (draw 6), Combo Master (combo starts 1.15x), Scholar's Focus (speed threshold 30%)
- **On perfect turn:** Momentum (+1 AP next turn)
- **On echo play:** Echo Chamber (full power instead of 0.7x)
- **On skip:** Scavenger (+1 currency)

**Dormancy check:**

```typescript
export function checkRelicDormancy(
  relics: ActiveRelic[],
  factStates: Map<string, { retrievability: number }>,
): void
```

- For each relic, look up FSRS retrievability of `sourceFactId`
- If retrievability < 0.7, set `isDormant = true`
- Dormant relics render but effects don't fire

**Max 12 cap** — In `buildActiveRelics()`:
- Collect all Tier 3 facts' relics
- Sort by mastery date (most recent first)
- Take first 12, rest are unavailable

### UI

**Relic tray** — New component `src/ui/components/RelicTray.svelte`:
- Horizontal scrollable row in the display zone (above card hand)
- Each relic: 32x32dp icon, tooltip on tap (name + description)
- Dormant relics: grayed out, 50% opacity
- Max 12 slots, empty slots shown as dim outlines
- Brief glow/pulse animation when a relic triggers during combat

**Graduation celebration:**
- Golden particle burst from card
- Card shrinks to relic icon size, flies to relic tray
- "NEW RELIC: [Name]" toast (2s, auto-dismiss)
- Brief relic description shown

**Dormancy indicator:**
- Gray overlay on relic icon
- Tooltip: "Dormant — review the source fact to reactivate"

### System Interactions

- **Tier system (CR-08):** Relic creation triggered by Mastery Trial pass. Tier 3 facts excluded from active deck.
- **Card effect resolver:** First Blood, Glass Cannon, Sharpened Edge, Chain Lightning modify resolution.
- **Turn manager:** Fortress prevents block reset. Momentum adds AP. Quick Draw changes hand size. Second Wind intercepts lethal.
- **Combo system:** Combo Master changes starting multiplier from 1.0x to 1.15x.
- **Echo mechanic (CR-12):** Echo Chamber removes 0.7x penalty on echo cards.
- **Enemy damage:** Glass Cannon's +10% taken applies to enemy damage after block.
- **FSRS:** Dormancy checked at run start and between encounters.
- **Run pool:** Tier 3 facts excluded from active pool, but their relics apply.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Player has 13 Tier 3 facts | 12 most recently mastered are active, 13th is inactive (not dormant, just capped) |
| Relic source fact drops to retrievability 0.69 | Relic goes dormant (checked at run start and between encounters) |
| Two relics trigger on same event (First Blood + Glass Cannon on first attack) | Both apply. Stack multiplicatively: base x 1.5 x 1.25 |
| Glass Cannon + Last Stand | Both active. Attacks +25%, block doubled below 20% HP, damage taken +10% |
| Second Wind already used + lethal hit | Player dies. Second Wind is once per encounter only. |
| Relic goes dormant mid-run | Stays dormant for rest of run. No re-check mid-encounter. Check between encounters. |
| Vitality relic x3 (maxPerRun: 3) | Max HP increases by 15. Three separate Vitality relics possible from 3 different facts. |
| No valid relics left for card type | Graduation still happens (Tier 3 fact), but no relic assigned. `graduatedRelicId: null`. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `src/data/relics.ts` | RelicDefinition, ActiveRelic, all 20 relic constants |
| Create | `src/services/relicManager.ts` | assignRelicOnGraduation(), buildActiveRelics(), checkRelicDormancy() |
| Modify | `src/services/cardEffectResolver.ts` | Relic hooks in resolution chain |
| Modify | `src/services/turnManager.ts` | Relic hooks for turn/encounter lifecycle |
| Modify | `src/services/encounterBridge.ts` | Initialize relics at encounter start, pass to turn manager |
| Create | `src/ui/components/RelicTray.svelte` | Horizontal relic display with dormancy indicator |
| Modify | `src/ui/components/CardCombatOverlay.svelte` | Include RelicTray component |
| Modify | `src/data/balance.ts` | Add MAX_ACTIVE_RELICS, DORMANCY_THRESHOLD |
| Create | `tests/unit/relicManager.test.ts` | Unit tests for relic assignment, dormancy, caps |
| Create | `tests/unit/relicEffects.test.ts` | Unit tests for each relic's effect in resolver/turn manager |

## Done When

- [ ] 20 relic definitions exist in `src/data/relics.ts` matching GAME_DESIGN.md Section 6
- [ ] Tier 3 graduation assigns a random relic from the appropriate type pool
- [ ] Each of the 20 relics has a functional effect in gameplay (not just defined)
- [ ] Max 12 relics enforced (13th mastered fact's relic doesn't activate)
- [ ] Dormant relics (retrievability <0.7) are grayed out and have no effect
- [ ] Relic tray visible in combat UI showing active/dormant relics
- [ ] Relic activation shows visual pulse when triggered
- [ ] Graduation celebration: golden burst + relic icon flies to tray
- [ ] Glass Cannon's downside (+10% damage taken) is properly applied
- [ ] Second Wind is once-per-encounter (second lethal = death)
- [ ] Fortress carries block between turns
- [ ] Quick Draw draws 6 instead of 5
- [ ] Combo Master starts combo at 1.15x
- [ ] All 20 relics have unit tests verifying their effect
