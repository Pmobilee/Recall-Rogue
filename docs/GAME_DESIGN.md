# Terra Miner — Game Design (Single Source of Truth)

> **One-line summary:** Card roguelite where every card is a fact — answer to attack, build your knowledge deck, the more you learn the deeper you go.

---

## 1. Core Philosophy

**Learning IS gameplay (Anti-Prodigy Principle).** If you remove the facts, there are no cards. No cards, no combat. No combat, no game. Facts are structurally required — not a wrapper, not an interruption.

Prodigy Math uses quizzes as a toll gate; children spend ~3 min on math per 20 min of play. Terra Miner inverts this: there is nothing to do EXCEPT engage with facts. The optimization path and the learning path are identical.

**Three systems only:**

| # | System | Purpose |
|---|--------|---------|
| 1 | Card Combat | Turn-based encounters; playing cards requires answering facts |
| 2 | Deck Building | Selecting and evolving fact-cards between encounters |
| 3 | Run Progression | Floor-based descent with cash-out-or-continue risk/reward |

Everything else (crafting, farming, companions, fossils, dome hub, prestige) is cut.

---

## 2. Card Combat

### Turn Structure

```
PLAYER TURN:
  1. Draw hand of 5 fact-cards from draw pile
  2. For each card:
     a. TAP card → card rises, question appears (two-step: select then answer)
     b. ANSWER correctly → card effect activates (damage/shield/heal/buff)
     c. ANSWER incorrectly → card fizzles (discarded, no effect)
     d. SKIP → card discarded, no penalty
  3. After all cards played/skipped → turn ends

ENEMY TURN:
  4. Enemy executes telegraphed attack (visible before player turn)
  5. Damage applied minus shields
  6. Next turn begins
```

### Card Anatomy

**Front (in hand):** Card name (thematic, e.g. "Crystalline Strike"), type icon, effect value, difficulty stars (1-3), domain color stripe.

**Back (on tap):** Question text, answer options (3 for Tier 1, 5 for Tier 2), timer bar.

### Card Types by Domain

| Domain | Card Type | Effect | Strategic Role |
|--------|-----------|--------|----------------|
| Science & Nature | Attack | Deal damage | Primary damage |
| History & Culture | Shield | Block damage | Defense |
| Geography & World | Utility | Draw extra, peek intent, deck manipulation | Tactics |
| Language & Vocabulary | Heal | Restore HP | Sustain |
| Math & Logic | Buff | Increase next card effect by X% | Combo enabler |
| Arts & Literature | Debuff | Reduce enemy attack, apply status | Control |
| Medicine & Health | Regen | Heal over multiple turns | Long-term sustain |
| Technology & Computing | Wild | Copy previous card's effect | Versatility |

A player who wants shields MUST add History facts. Broad learning is mechanically necessary.

---

## 3. Card Tiers (Mastery Paradox Solution)

| Tier | Name | Trigger | Question Format | Power | Visual |
|------|------|---------|----------------|-------|--------|
| 1 | Learning | 0-2 correct answers | 3-option MCQ | 1.0x base | Standard frame |
| 2 | Recall | 3-5 correct, SM-2 interval > 3 days | 5-option MCQ or format rotation | 1.5x base | Silver border, glow |
| 3 | Mastered | SM-2 interval > 21 days, 5+ consecutive correct | Not asked — passive relic | Permanent buff | Gold border, relic tray |

**Tier 3 passive buffs:** Mastered Attack → +1 dmg all attacks. Mastered Shield → +1 block all shields. Mastered Heal → +1 HP regen/turn. Mastered Utility → +5% extra card draw chance.

**Why this works:** Mastered cards leave the hand, refilling it with unmastered facts. Challenge persists. Passive buffs accumulate, preserving "getting stronger" feeling.

---

## 4. Run Structure

### Floor Layout

| Segment | Floors | Encounters/Floor | Boss | Cash-Out |
|---------|--------|-----------------|------|----------|
| 1 (Easy) | 1-3 | 3 + 1 event | Floor 3: "The Excavator" | Keep 100% or descend |
| 2 (Medium) | 4-6 | 3 + 1-2 events | Floor 6: "Magma Core" | Die = keep 80% |
| 3 (Hard) | 7-9 | 3 + 2 events | Floor 9: "The Archivist" | Die = keep 65% |
| Endless | 10+ | Scaling | Mini-boss every 3 | Die = keep 50% |

### Room Selection (Simplified STS)

After each encounter, choose from 3 doors:

| Icon | Room | Description |
|------|------|-------------|
| Sword | Combat | Standard encounter, card reward after |
| ? | Mystery | Random event (good, bad, or choice) |
| Heart | Rest | Heal 30% HP OR upgrade one card (+25% effect) |
| Chest | Treasure | Free card/artifact, no combat |
| Bag | Shop | Spend currency to buy/remove cards |

Rules: Each floor guarantees at least 1 combat option. Combat always shows enemy type. Mystery always hidden.

### Session Lengths

| Run Type | Floors | Time | Facts Reviewed |
|----------|--------|------|----------------|
| Quick | 1-3 | 4-5 min | 15-25 |
| Standard | 1-6 | 8-10 min | 30-50 |
| Deep | 1-9 | 12-15 min | 50-75 |
| Endless | 10+ | 15+ min | 75+ |

---

## 5. Enemy Design

**Common (1-2 per encounter):**
- Cave Bats — low HP, 2 dmg/turn (teaches speed)
- Crystal Golems — high HP, hit every 2nd turn for 8 (teaches sustained damage)
- Toxic Spores — low HP, poison 2 dmg/turn for 3 turns (teaches heal priority)
- Shadow Mimics — copy player's last card effect (teaches variety)

**Elites (optional, higher reward):**
- Ore Wyrm — multi-phase, phase 2 doubles attack
- Fossil Guardian — immune to one domain type

**Bosses:** The Excavator (F3, predictable), Magma Core (F6, escalating), The Archivist (F9, shuffles hand).

Art: static 2D pixel sprites, hit flash + death effects only.

---

## 6. Knowledge Combo

| Consecutive Correct | Multiplier | Visual |
|--------------------|------------|--------|
| 1st | 1.0x | Normal |
| 2nd | 1.15x | Slight glow |
| 3rd | 1.3x | Particle ring |
| 4th | 1.5x | Screen edge pulse |
| 5th (perfect turn) | 2.0x | Full celebration burst |

Wrong answer resets combo to 1.0x. Creates card-ordering strategy: play easy cards first to build combo, or play hard cards first for higher base power.

---

## 7. Difficulty System

### Three Independent Layers

| Layer | What Scales | Source |
|-------|------------|--------|
| Fact Difficulty | Inherent question hardness (1-5 stars) | Content creation |
| Adaptive (SM-2) | Per-player per-fact ease factor | Player performance |
| Floor Progression | Timer, enemy HP/dmg, encounter count | Run depth |

### Player Modes

| Mode | Timer | Wrong Penalty | Enemy Dmg | Rewards |
|------|-------|--------------|-----------|---------|
| Explorer | None | 50% effect (not fizzle) | -30% | 70% |
| Standard | Floor-scaled | Fizzle | Normal | 100% |
| Scholar | -2s per tier | Fizzle + 3 self-damage | +20% | 150% |

### Speed Scaling

| Floor | Timer |
|-------|-------|
| 1-3 | 12s |
| 4-6 | 9s |
| 7-9 | 7s |
| 10-12 | 5s |
| 13+ | 4s |

Speed bonus: answer in first 25% of timer → +50% effect.

### Difficulty-Proportional Power

| SM-2 Ease Factor | Label | Effect Multiplier |
|-----------------|-------|-------------------|
| 2.5+ | Easy | 0.8x |
| 2.0-2.49 | Medium | 1.0x |
| 1.5-1.99 | Hard | 1.3x |
| 1.0-1.49 | Very Hard | 1.6x |

Optimal strategy: seek hard facts for stronger cards.

---

## 8. Exploitation Prevention

| Method | How It Works |
|--------|-------------|
| Large pools | 80-120 unique facts per run; player sees ~50-60; ~40% never appears |
| No-repeat-until-cycled | STS draw pile model; fact appears at most twice per run |
| Question format rotation | 2-4 variants per fact; rotate format each appearance |
| Speed scaling | Deep floors make even known facts challenging under time pressure |
| Difficulty-proportional power | Easy facts = weak cards; incentivizes challenging yourself |
| Echo mechanic | 70% chance wrong-answer facts reappear as ghostly "Echo" cards later in run |

---

## 9. Meta-Progression

| System | Description |
|--------|-------------|
| Knowledge Library | All encountered facts cataloged by domain + mastery status; lore entries expand on mastery |
| Mastered Passives | Tier 3 cards become permanent run buffs (persist across runs) |
| Card Cosmetics | Earned via milestones (master 50 facts, clear F9, etc.); monetizable |
| Domain Unlocking | Start with 2-3 domains; master 25 facts → unlock new domain |
| Streaks | Consecutive days with 1+ completed run; rewards at 7/30/100/365 days; 1 freeze/week |
| Fossil Milestones | At 10th/25th/50th/100th mastered fact: narrative text connecting learned facts |
| Mineral Veins | 1-2 bonus objectives per run (e.g. "5 Science correct" → bonus reward) |

**What does NOT exist:** No dome hub, no farming/crafting/companions, no separate study mode, no prestige, no energy/stamina gating (unlimited runs always).

---

## 10. Onboarding (First 60 Seconds)

```
0-3s:   App opens to mine entrance. "ENTER THE MINE" button. Tap.
3-8s:   First encounter. Hand of 5. Tooltip: "Tap a card to play it"
8-15s:  Question appears. 3 answers. Correct → juice stack. Wrong → gentle fizzle.
15-30s: Remaining cards. Enemy defeated. Choose 1 of 3 card rewards.
30-60s: Second encounter. No tooltips. GAIA: "Good instincts, miner."
~2-3m:  First run ends. "Create account to save progress?" (skippable)
Run 2:  Domain selection unlocks. Interest selection AFTER investment.
```

**Calibration Deep Scan:** After first run, optional 20-question rapid placement test. Correct answers → facts start at Tier 2.

---

## 11. Wrong Answer Design

**Anti-shame principles:**
- Card fizzles with soft gray-out dissolve (no red X, no "WRONG!" text)
- Correct answer revealed for 2 seconds in gentle blue highlight
- SM-2 records the miss (ease factor decreases, interval resets)
- NO extra damage, NO screen shake, NO loss of rewards
- Miner's Journal entry: "You'll remember: [correct answer]"

**Hint system (costs 1 "Miner's Instinct" per use, earned 1/encounter):**
- Remove one wrong answer (3 → 2 options)
- Add 5 seconds to timer
- Reveal first letter (free recall)

---

## 12. Portrait UX (Split-Stage Layout)

**Top 55% (Display Zone):** Enemy sprite, HP bars, intent telegraph, floor counter, passive relics. No interactive elements (top-third tap accuracy: 61%).

**Bottom 45% (Interaction Zone):** Card hand (fanned arc), answer buttons, skip/hint, end turn. All interactive elements in thumb reach (bottom-third accuracy: 96%).

### Touch Targets

| Element | Minimum Size |
|---------|-------------|
| General touch targets | 48x48dp |
| Cards in hand | 60x80dp |
| Answer buttons | Full width, 56dp height, 8dp spacing |
| Bottom safe area | 16dp for gesture nav bars |

### Card Dimensions

| State | Width | Height | Shows |
|-------|-------|--------|-------|
| In hand (collapsed) | ~65dp | ~95dp | Type icon, effect value, stars, domain stripe |
| Expanded (on tap) | ~300dp | ~350dp | Full art, name, effect, question, answer buttons, timer |

Two-step confirm: tap to select (card rises) → tap answer to play. Tap elsewhere or swipe down to cancel. Prevents STS-mobile's accidental-play problem.

---

## 13. Game Juice

### Correct Answer (all within 200ms)

| # | Element | Detail |
|---|---------|--------|
| 1 | Haptic | Single sharp pulse (iOS: Heavy, Android: 50ms/200amp) |
| 2 | Screen flash | White 30% opacity, 150ms fade |
| 3 | Damage numbers | Arc from card to enemy, bounce on impact; gold=normal, red=crit |
| 4 | Card animation | Launch upward with streak trail, dissolve into particles toward enemy |
| 5 | Enemy reaction | 5px knockback, red flash, smooth HP bar depletion |
| 6 | Sound | Crisp impact (Wordle ding + fighting game punch) |
| 7 | Combo counter | Escalating text size + particle ring at 3+, celebration burst at 5/5 |

### Wrong Answer (intentionally muted)

| # | Element | Detail |
|---|---------|--------|
| 1 | Haptic | Gentle double-tap |
| 2 | Card animation | Dims, cracks, dissolves downward (sand falling) |
| 3 | Answer reveal | Slides in from bottom, blue highlight, 2s linger |
| 4 | Sound | Soft low tone (not a buzzer) |
| 5 | Absence | No screen shake, no red flash, no damage numbers |

---

## 14. Sound Design Priority

| Priority | Sounds | Target |
|----------|--------|--------|
| P1 (prototype) | Correct impact, wrong tone, card draw swoosh, enemy hit, enemy death, turn chime | Pre-launch |
| P2 (soft launch) | Ambient mine loop, boss music, combo escalation, UI taps, cash-out tension | Soft launch |
| P3 (post-launch) | Per-type card sounds, floor themes, tier-up celebration, fossil reveal | Post-launch |

Master volume + category toggles. Haptics work independently of sound mute.

---

## 15. Accessibility (In Prototype)

| Category | Accommodations |
|----------|---------------|
| Visual | Colorblind mode (shape/icon differentiation), 3 text sizes, high contrast mode, reduce motion option |
| Motor | Single-tap only (no swipe/drag), 48dp+ targets everywhere, timer disabled in Explorer mode |
| Cognitive | Explorer mode softens penalties, hint scaffolding, numeric + icon effect indicators, 6th-grade reading level |

---

## 16. Daily Excavation

- Same seed for all players (same encounters, cards, facts)
- Score = accuracy% x speed bonus x floor reached x combo multiplier
- One attempt per day (appointment gaming)
- Rewards: participation badge, bonus for top 10%/25%/50%
- Leaderboard (read-only, no UGC)

---

## 17. Canary System (Invisible Adaptive Difficulty)

**3+ wrong on a floor:** -2s timer pressure, bias toward easier facts, -10-15% enemy dmg, hint button more prominent.

**5+ correct in a row:** Tighter speed bonus thresholds, bias toward harder facts, elite enemy variant.

**Rules:** Completely invisible. Never announced. Never reduces educational rigor (answer count, question format unchanged). Only game difficulty (timers, enemy stats) flexes.

---

## 18. Monetization

| Offering | Price | Contents |
|----------|-------|----------|
| Free tier | $0 | Full gameplay, unlimited runs, 522 facts, 3-4 starter domains, all modes |
| Ad removal | $4.99 | Permanent, removes all ads |
| Domain packs | $2.99 each | Specialized domains (Medicine, CS, Advanced Chemistry, etc.) |
| Language packs | $4.99 each | Full vocabulary per language (JP, ES, FR, etc.) |
| Terra Pass | $4.99/mo | All packs, exclusive cosmetics, analytics dashboard, family sharing (5 profiles) |
| Cosmetics | Varies | Card frames, victory animations, mine skins, avatars |

**Hard rules:** No pay-to-win. No premium currency. No loot boxes/gacha. Rewards are transparent (see 3, pick 1). App Store category: Education (primary), Games (secondary).

---

## 19. Anti-Features (Do NOT Build)

- No chat/social features (moderation burden, COPPA)
- No procedural fact generation (all facts human-verified)
- No PvP (matchmaking/anti-cheat complexity)
- No deck editing outside runs (SM-2 scheduler handles pool; manual editing defeats learning)
- No premium currency (direct purchases only)
- No loot boxes/gacha
- No dome hub/overworld
- No farming, crafting, companions
- No separate study session mode
- No prestige/rebirth
- No energy/stamina gating

---

## 20. SM-2 Integration

### Run Pool Building

| Source | % of Pool | Selection |
|--------|----------|-----------|
| Primary domain (player-chosen) | 40% | ~48 of 120 facts |
| Secondary domain (player-chosen) | 30% | ~36 of 120 facts |
| SM-2 review (auto, all engaged domains) | 30% | ~36 facts due for review |

Players never see facts from domains they haven't opted into. First-time players see only their two chosen domains.

### Tier Derivation

```typescript
function getCardTier(state: PlayerFactState): 1 | 2 | 3 {
  if (state.interval >= 21 && state.repetitions >= 5) return 3; // Mastered
  if (state.interval >= 3 && state.repetitions >= 3) return 2;  // Recall
  return 1;                                                       // Learning
}
```

### Key SM-2 Fields

| Field | Purpose |
|-------|---------|
| easeFactor | 1.3-2.5+; personalizes difficulty; drives card power multiplier |
| interval | Days until next review; drives tier promotion |
| repetitions | Consecutive correct; gates tier thresholds |
| lastVariantIndex | Prevents same question format twice in a row |

---

## 21. Fact Database

### Schema (Core Fields)

```typescript
interface Fact {
  id: string;
  domain: FactDomain;
  subdomain?: string;
  ageRating: 'all' | '10+' | '13+' | '16+' | '18+';
  baseDifficulty: 1 | 2 | 3 | 4 | 5;
  variants: QuestionVariant[];    // min 2, target 4
  cardType: CardType;
  baseEffectValue: number;
  source?: string;
  tags: string[];
  verifiedAt?: Date;
}

interface QuestionVariant {
  questionText: string;
  correctAnswer: string;
  wrongAnswers: string[];         // min 2, max 5
  format: 'multiple_choice' | 'true_false' | 'fill_blank' | 'reverse' | 'audio';
}
```

### Age Gating

| Bracket | Allowed Ratings |
|---------|----------------|
| child (<13) | all |
| teen (13-17) | all, 10+, 13+ |
| adult (18+) | all, 10+, 13+, 16+, 18+ |

### Scale

| Stage | Facts |
|-------|-------|
| Launch | 522 (existing) |
| Growth | 20,000+ across domains |
| Per language pack | 5,000+ vocabulary |
| Quality rule | All facts require `verifiedAt` before live; AI-drafted facts MUST pass human review |

### Vocabulary Extension

Language facts add: `targetLanguage`, `nativeWord`, `targetWord`, `reading?` (furigana etc.), `audioUrl?`, `exampleSentence?`, `cefrLevel?`/`jlptLevel?`. Tier 2+ vocabulary uses production format (type/draw target word).

---

## 22. Technical Notes

### Reuse from Existing Codebase (~90%)

| System | Reuse | Notes |
|--------|-------|-------|
| Quiz engine (3-pool) | 100% | Pool A=review, B=discovery, C=contextual |
| SM-2 algorithm | 100% | Add tier derivation on top |
| Fact DB (522 facts) | 100% | Extend schema with card type mapping |
| Svelte UI layer | 70% | New card rendering components needed |
| Service architecture | 100% | API patterns, state mgmt, persistence |
| TypeScript types | 90% | Extend with card-specific types |

### What Needs Building

| System | Scope | Priority |
|--------|-------|----------|
| Card rendering + animations | Medium | P0 |
| Turn-based encounter engine | Medium | P0 |
| Enemy system (HP, patterns, telegraph) | Medium | P0 |
| Room selection UI | Small-Medium | P0 |
| Card reward/shop screen | Small | P0 |
| Run-start domain selection | Small | P0 |
| Mastery tier system | Small | P1 |
| Cash-out screen | Small | P1 |
| Knowledge Library | Medium | P1 |
| Streak system | Small | P1 |
| Endless mode | Small | P2 |
| Cosmetic store | Medium | P2 |
| Language pack support | Medium | P2 |
| Leaderboards | Medium | P3 |

### Prototype Target (3-5 Days)

Hand of 5, tap-to-select + answer-to-play, 3 encounters on 1 floor + 1 boss, 50 mapped facts, basic enemy with telegraph, 1 card reward screen. No meta, no map, no cosmetics.

**Kill metric:** >2x voluntary fact-review volume per minute vs raw flashcard drilling.

**Retention targets:** D1: 40-45%, D7: 18-22%, D30: 8-12%.

### Phaser Performance Budget

Target 60fps. Combat scene: ~12 game objects (1 background, 1 enemy, 5 cards, 2 HP bars, combo counter, particle emitter). Cap particles at 50 concurrent. Use Phaser tweens (GPU-accelerated), not CSS animations. Sprite pool for cards (reposition, don't create/destroy).

### Session Persistence

Save run state after every encounter via `@capacitor/preferences`. Resume on app reopen. Runs survive closure for 24h.
