# AR-99: Combat Incentives, Enemy Tuning & Live Game Bot

## Overview

**Goal:** Fix combat balance through three interconnected changes: reduce post-encounter healing to make HP precious, add enemy mechanics that incentivize charging/chaining, reduce early enemy HP to reasonable levels, and build a Playwright bot that plays the REAL game instead of maintaining a parallel simulator.

**Root causes identified:**
1. 12% auto-heal after every encounter makes damage meaningless — STS has ZERO auto-heal
2. Floor 1 common enemies range 15-48 HP — too wide, some are tankier than mini-bosses
3. No enemy mechanics incentivize charging (only raw damage scaling forces it)
4. Simulator `maxTotalTurns: 500` cap artificially kills Quick Play players
5. Simulator drifts from real game — a Playwright bot playing the actual game is the correct approach

**Research basis:**
- STS: ZERO healing between encounters. HP is your most precious resource. Rest sites heal 30%.
- STS: Elite enemies are avoided by weaker players because HP cost is too high (risk/reward)
- Wilson et al.: 85% accuracy optimal — charging should feel rewarding, not mandatory

**Estimated complexity:** HIGH — enemy data + balance + Playwright bot architecture

---

## Phase 1: Make HP Precious (Healing Reduction)

### The STS Model
In Slay the Spire:
- **0 healing** after regular encounters
- **Rest sites** heal 30% (choose heal OR upgrade, not both)
- **Potions** are rare drops, limited inventory (3 slots)
- **Feed** relic: heal 3 HP on kill (tiny, requires specific relic)
- Result: every point of damage matters. Players avoid elites when low. Health IS the meta-resource.

### Our Current Model (Too Generous)
- **12% auto-heal** after every encounter (14 HP on 120 max)
- **+15% boss/mini-boss bonus** (total 27% after bosses)
- **+6% in relaxed mode** (total 18%/33%)
- **Rest sites** heal 30% (on top of auto-heal)
- **Shop food**: ration 25%, feast 45%, elixir 100% (cheap at 12-55 gold)
- Result: damage doesn't carry over. Every encounter feels independent.

### Changes

#### 1.1 Reduce post-encounter auto-heal
**`POST_ENCOUNTER_HEAL_PCT`: 0.12 → 0.03** (3% = ~4 HP on 120 max)

This tiny heal prevents "1 HP death spiral" without negating damage. Player takes 15 damage in a fight, heals 4 back — net -11 HP. That matters.

#### 1.2 Reduce boss bonus heal
**`POST_BOSS_ENCOUNTER_HEAL_BONUS`: 0.15 → 0.05** (total after boss: 8% = ~10 HP)

Bosses should reward with relics and gold, not free HP.

#### 1.3 Reduce relaxed mode bonus
**`RELAXED_POST_ENCOUNTER_HEAL_BONUS`: 0.06 → 0.03** (total relaxed: 6% regular, 11% boss)

Relaxed should be forgiving but not trivial.

#### 1.4 Increase shop food prices
Make healing items expensive — HP recovery should cost real resources:
- **ration**: 12 → 25 gold (25% heal)
- **feast**: 28 → 50 gold (45% heal)
- **elixir**: 55 → 90 gold (100% heal)

This makes "do I buy a card or heal?" a real decision.

#### 1.5 Tighten healing caps
```
Segment 1: 1.0 → 0.90 (can't stay at 100% forever)
Segment 2: 0.90 → 0.80
Segment 3: 0.80 → 0.70
Segment 4: 0.65 → 0.55
```

#### Files
- `src/data/balance.ts` — all healing constants

---

## Phase 2: Enemy HP Normalization

### 2.1 Common Enemy baseHP Ranges (by floor tier)

**Principle:** Floor 1 commons should die in 3-4 Quick Play strikes (24-32 damage). No common should feel like a mini-boss.

**Target ranges:**
- Floor 1-3 commons: **15-32 HP** (currently 15-48)
- Mini-bosses: scale down proportionally

**Changes:** Reduce all commons with baseHP > 35 down to 28-35 range. Specific values in implementation task for worker.

### 2.2 Mini-Boss HP Reduction
Current range: 42-72 HP. Target: 38-55 HP. Mini-bosses should be hard but not multi-minute slogs.

#### Files
- `src/data/enemies.ts` — all baseHP values

---

## Phase 3: Enemy Mechanics for Charging/Chaining

### 3.1 `chargeResistant` Trait
**~30% of common enemies** (armored/defensive types)

**Mechanic:** Quick Play attacks deal 50% damage. Charged attacks deal full damage.

**Visual:** Faint shield glow on enemy sprite.

**Which enemies:** iron_beetle, geode_beetle, crystal_golem, basalt_crawler, quartz_elemental, iron_core_golem, rock_hermit, tectonic_scarab, granite_hound, void_mite, tome_mimic, pressure_djinn

**Implementation:**
- Add `chargeResistant?: boolean` to `EnemyTemplate`
- In `cardEffectResolver.ts`, check `enemy.template.chargeResistant && playMode === 'quick'` → multiply damage by 0.5

### 3.2 `chainVulnerable` Trait
**~20% of common enemies** (swarmy/organic types)

**Mechanic:** Chain attacks (2+ chain length) deal +50% damage.

**Which enemies:** cave_spider, root_strangler, stalactite_drake, ember_skeleton, fossil_raptor, lava_crawler, obsidian_shard, blind_grub

**Implementation:**
- Add `chainVulnerable?: boolean` to `EnemyTemplate`
- In chain damage calc, multiply by 1.5 if trait is present

### 3.3 `quickPlayPunish` Trait (Mini-Bosses Only)
**~30% of mini-bosses**

**Mechanic:** If player didn't Charge at least 1 card this turn, enemy gains +1 Strength (stacking).

**Which enemies:** crystal_guardian, stone_sentinel, iron_archon, obsidian_knight, glyph_warden

**Implementation:**
- Add to `onTurnEnd` callback: check `enemy.playerChargedThisTurn`
- If false, apply Strength buff

#### Files
- `src/data/enemies.ts` — add traits to enemy templates
- `src/data/enemy-types.ts` — add trait fields to EnemyTemplate type
- `src/services/cardEffectResolver.ts` — chargeResistant damage reduction
- `src/services/turnManager.ts` — quickPlayPunish check

---

## Phase 4: Simulator Fix (maxTotalTurns)

### 4.1 Raise turn limit
`maxTotalTurns: 500 → 3000` in both headless-combat.ts defaults and mass-simulate.ts.

Quick Play runs legitimately need 600-1000 turns. The cap was silently killing them.

#### Files
- `tests/playtest/core/headless-combat.ts`
- `scripts/mass-simulate.ts`

---

## Phase 5: Playwright Live Game Bot

### WHY
The headless simulator drifts from the real game every time we change anything. It uses synthetic enemies, synthetic cards, simplified room sequences, no real map, no real UI flow. Every simulation result is suspect.

A Playwright bot plays the ACTUAL game through the real DOM. Zero drift. Tests the real card resolver, real enemy AI, real map generator, real healing, real everything.

### Architecture

```
tests/playtest/playwright-bot/
├── bot.ts           — Main bot loop: navigate, read state, decide, act
├── strategies.ts    — Player strategy profiles (same as mass-simulate)
├── state-reader.ts  — Read game state via window.__terraDebug() and DOM
├── actions.ts       — Click cards, answer quizzes, choose rooms via data-testid
├── runner.ts        — CLI: run N games with profile, collect stats
└── types.ts         — Bot state, decision types
```

### How It Works

1. **Navigate** to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
2. **Read state** via `page.evaluate(() => window.__terraDebug())` — returns current screen, HP, hand, enemy, etc.
3. **Decide** what to do based on strategy profile (same profiles as mass-simulate)
4. **Act** via DOM clicks using `data-testid` selectors:
   - Start run: `[data-testid="btn-start-run"]`
   - Play card: `[data-testid="card-hand-0"]` through `card-hand-4`
   - Answer quiz: `[data-testid="quiz-answer-0"]` through `quiz-answer-2`
   - Choose room: `[data-testid="room-choice-0"]` through `room-choice-2`
   - Retreat: `[data-testid="btn-retreat"]`
   - Delve: `[data-testid="btn-delve"]`
5. **Loop** until run ends (victory or defeat)
6. **Collect** stats: floors reached, HP curve, cards played, accuracy, relics earned

### Key Advantages Over Headless Simulator
- Tests the REAL game — no drift
- Catches UI bugs (buttons not clickable, overlays blocking, z-index issues)
- Tests real map generation, real room selection, real shop UI
- Tests real quiz flow (timer, answer display, feedback)
- Screenshots available for debugging
- Can run headless Chromium for speed (~5-10 seconds per run)

### Decision Engine
The bot reads `window.__terraDebug()` for:
```typescript
{
  currentScreen: 'combat' | 'map' | 'shop' | 'rest' | 'reward' | ...
  playerHP: number,
  playerMaxHP: number,
  enemyHP: number,
  enemyMaxHP: number,
  hand: Card[],
  apCurrent: number,
  comboCount: number,
  turnNumber: number,
  relics: string[],
  gold: number,
}
```

Then applies strategy profile rules:
- **basic**: play cards randomly, answer quizzes with profile accuracy, always take healing rooms
- **intermediate**: read enemy intent, shield against attacks, prefer combat rooms
- **optimal**: chain-aware card selection, always charge on surge, evaluate room risk/reward

### Speed Target
- Headless Chromium, no screenshots
- ~10 seconds per full 24-floor run
- 100 runs per profile = ~17 minutes
- 6 profiles × 100 runs = ~100 minutes for full analysis

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Post-encounter heal reduced to 3% (verify in real game via Playwright)
- [ ] Shop food prices increased (verify in shop screen)
- [ ] chargeResistant enemies take half QP damage (verify via console log)
- [ ] Playwright bot completes at least 10 runs successfully
- [ ] Bot stats match real gameplay experience (early floors easy, mid-game challenging)

---

## Phase Order

1. **Phase 1 (healing)** + **Phase 4 (turn limit)** — immediate balance fixes
2. **Phase 2 (enemy HP)** — normalize early game
3. **Phase 3 (enemy traits)** — charging incentives
4. **Phase 5 (Playwright bot)** — replace simulator for future balance work
