# AR-208 — Cards Phase 3: Advanced / Chase Cards (18 cards)

**Status:** Pending
**Prerequisite:** AR-206 (Phase 1 core cards) and AR-207 (Phase 2 identity cards) complete. Burn, Bleed, Cursed system, Inscription keyword, CardBrowser component, card unlock gating, and combo system removal must all be live.
**Estimated complexity:** High — X-cost mechanics, passive triggers, discard-pile interaction, CardBrowser integration, Inscription persistence, and several formula-dependent scaling cards.
**Source of truth:** `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md` Part 3 §3A–§3G, §3I, Appendices C, D, F.

---

## Overview

This AR implements the 18 advanced/chase cards that form the high-ceiling end of the expansion. These are the cards players unlock at character levels 5–13 and build entire run strategies around. Every card here has a non-trivial mechanic that requires either a new resolver path, a new runtime state field, or integration with a shared UI component (CardBrowser, exhaust pile viewer).

Cards are grouped into 6 sub-tasks that can be implemented in sequence. Each sub-task has its own validation gate before moving on.

**Total: 18 cards**
- Attacks (4): Smite, Feedback Loop, Recall, Hemorrhage, Eruption — wait, Eruption makes 5. Count per task breakdown below.
- Shields (3): Bulwark, Conversion, Ironhide
- Buffs (3): Frenzy, Mastery Surge, War Drum
- Debuff (1): Entropy
- Utility (6): Synapse, Tutor, Recollect, Siphon Knowledge, Reflex, Archive
- Wild (4): Catalyst, Mimic, Aftershock, Sacrifice, Knowledge Bomb — Knowledge Bomb makes 5
- Inscription (1): Inscription of Wisdom

Actual count by category from the user spec: Attacks 4 (Smite, Feedback Loop, Recall, Hemorrhage) + Eruption = 5 attack cards; Wild 4 (Catalyst, Mimic, Aftershock, Sacrifice) + Knowledge Bomb = 5 wild. Total unique = 23 if uncombined. The implementation index groups Phase 3 as 18 cards in §3.1–§3.6 plus Eruption, Knowledge Bomb, Frenzy, War Drum, Mastery Surge in §3.6. All 23 mechanic IDs listed in this doc are in scope.

---

## Dependencies

| Dependency | Why Required |
|---|---|
| Burn status effect (Phase 0.4) | Entropy applies Burn |
| Bleed status effect (Phase 0.5) | Hemorrhage consumes Bleed stacks |
| Inscription keyword (Phase 0.6) | Inscription of Wisdom |
| CardBrowser.svelte (Phase 0.10) | Tutor (search draw pile), Mimic CC (choose from discard) |
| Exhaust pile viewer (Phase 0.10 or earlier) | Recollect (return exhausted card) |
| Card unlock gating (Phase 0.7) | All cards gated by level 5–13 |
| Combo system removal (Phase 0.9) | Resolver must not reference comboCount |
| `cursedFactIds` on RunState (Phase 0.2) | Mastery Surge wasted-on-cursed ruling |
| `MASTERY_UPGRADE_DEFS` in cardUpgradeService.ts | Every card requires a mastery entry |

---

## Sub-Tasks

---

### 3.1 — Scaling Attack Cards (3 cards)

**Cards:** Smite (A7), Feedback Loop (A11), Recall (A14)

**Why grouped:** All three are stat-scaling attacks with formula-dependent damage. No new UI components needed. Straightforward resolver work.

#### 3.1.1 — Smite (A7)

**Files:**
- `src/data/mechanics.ts` — add mechanic definition
- `src/services/cardEffectResolver.ts` — add `smite` resolver path
- `src/services/cardUpgradeService.ts` (or equivalent mastery file) — add `MASTERY_UPGRADE_DEFS` entry

**What:**
Add mechanic ID `smite`. 2 AP. A standard attack with a mastery-weighted formula on CC.

```
QP:  10 damage
CC:  10 + (3 × avgHandMastery) damage
CW:  7 damage
Pool: 1  Unlock: 9
```

`avgHandMastery` = average mastery level of all cards currently in hand at resolution time (including Smite itself). Mastery values are integers 0–5. Cards with cursed facts are treated as effective mastery 0 for this average. Round the average down to nearest integer before multiplying.

Resolver needs to accept `handMasteryValues: number[]` in `AdvancedResolveOptions` (or compute from `playerState.hand` if accessible). The average is computed at resolve time, not at play time.

**Mastery definition (`smite`):**
```
cap: 5
perLevelDelta: +2 dmg (QP base)
secondaryPerLevelDelta: none
apCostReductionAtLevels: none
addTagAtLevel: none
L0→L5 QP: 10→20 damage (mastery avg bonus is unchanged by Smite's own mastery level)
```

**Acceptance:**
- QP always deals exactly 10 + mastery bonus at correct level
- CC formula is `10 + (3 × floor(avgHandMastery))` — verified with hand of all mastery-0 cards = 10 CC, all mastery-5 cards = 25 CC
- CW deals 7 (no mastery bonus)
- Cards carrying cursed facts count as mastery 0 in the average
- `mechanicId: 'smite'` appears in resolver output
- Mastery L3: QP deals 16 damage (base 10 + 2×3 mastery bonus)

---

#### 3.1.2 — Feedback Loop (A11)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `feedback_loop`. 1 AP. High-stakes attack where CW is a complete fizzle (0 damage, unlike normal CW which always does something).

```
QP:  5 damage
CC:  20 damage
CW:  0 damage (total fizzle — no damage at all)
Pool: 1  Unlock: 10  Cap: 3
```

The CW fizzle must produce `damageDealt: 0` and `rawValue: 0` — not a reduced number. This is distinct from all other CW paths. The resolver must check `playMode === 'charge_wrong'` and short-circuit to zero before any multiplier logic.

**Mastery definition (`feedback_loop`):**
```
cap: 3
perLevelDelta: +2 dmg (QP), +4 dmg (CC) per level
secondaryPerLevelDelta: none
apCostReductionAtLevels: none
addTagAtLevel: { level: 3, tag: 'feedback_weakness' }  // L3: QP also applies 1 Weakness to enemy
L0→L3 QP: 5→11 damage
L0→L3 CC: 20→32 damage
CW: always 0 regardless of mastery level
```

**Acceptance:**
- CW produces exactly 0 damage — confirmed by unit test checking `result.damageDealt === 0` when `playMode === 'charge_wrong'`
- QP deals 5 at L0, 11 at L3
- CC deals 20 at L0, 32 at L3
- L3: QP applies 1 stack of Weakness to the enemy (verified via `statusesApplied` in result)
- Cap is 3 — only 3 copies can appear in a run's card pool

---

#### 3.1.3 — Recall (A14)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `recall`. 1 AP. Damage scales with discard pile size at resolution time.

```
QP:  1 dmg per card in discard pile
CC:  2 dmg per card in discard pile
CW:  0.5 dmg per card in discard pile (round down)
Pool: 1  Unlock: 11
```

Resolver reads `encounterState.discardPile.length` (or equivalent) at the moment of resolution. This is a snapshot — not affected by Recall itself (it hasn't been played yet when damage resolves). If discard pile is empty, all modes deal 0 damage.

Resolver needs `discardPileSize: number` in `AdvancedResolveOptions`.

**Mastery definition (`recall`):**
```
cap: 5
perLevelDelta: +0.2 per-discard-card dmg per level (i.e., QP per-card goes 1.0→1.8→2.6... but round to nearest integer at display)
secondaryPerLevelDelta: none
apCostReductionAtLevels: none
addTagAtLevel: { level: 3, tag: 'recall_draw' }  // L3: also draws 1 card after resolving
L0→L5 QP: 1/card → approximately 2/card (after rounding)
```

**Acceptance:**
- With 10 cards in discard: QP = 10, CC = 20, CW = 5
- With 0 cards in discard: all modes = 0
- With 15 cards in discard at L0: CC = 30
- L3: draws 1 card after damage resolves (via `extraCardsDrawn: 1` in result)
- `discardPileSize` passed correctly by turnManager when invoking resolver

---

### 3.2 — Advanced Utility Cards (6 cards)

**Cards:** Synapse (U7), Tutor (U5), Recollect (U6), Siphon Knowledge (U3), Reflex (U10), Archive (U9)

**Why grouped:** All are non-damage utility cards. Most require new runtime state fields or UI integration.

#### 3.2.1 — Archive (U9)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/game/services/turnManager.ts` (or equivalent) — retain logic at turn end
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `archive`. 1 AP. Marks cards to be retained in hand (not discarded at turn end).

```
QP:  retain 1 card in hand (player chooses which card to protect)
CC:  retain 2 cards
CW:  retain 1 card
Pool: 2  Unlock: 5
```

On play, open a mini-selection UI (tap to mark) — or if no UI is ready, auto-retain the lowest-AP card. Retained cards are flagged with `retained: true` on their card object. At turn end, `turnManager.discardHand()` skips cards flagged `retained: true` and clears the flag for next turn start.

**Mastery definition (`archive`):**
```
cap: 3
perLevelDelta: none (tag-based)
addTagAtLevel: { level: 3, tag: 'archive_retain2_qp' }  // L3: QP also retains 2 cards (not just CC)
```

**Acceptance:**
- QP/CW: 1 card survives discard into next turn's hand
- CC: 2 cards survive
- Retained flag is cleared at start of player's next turn (after draw phase)
- Retained cards cannot be retained again by a second Archive (once retained stays retained; playing Archive again on an already-retained card is a no-op for that card)
- L3: QP retains 2 cards (same as CC baseline)

---

#### 3.2.2 — Reflex (U10)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/game/services/turnManager.ts` — discard hook for passive trigger
- `src/data/card-types.ts` or equivalent — add `hasReflexPassive` or equivalent flag
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `reflex`. 1 AP. Drawing/playing card gives draw; PASSIVE triggers on any discard from hand.

```
QP:  draw 2
CC:  draw 3
CW:  draw 1
Passive: when discarded from hand (any source), gain 3 block immediately
Pool: 2  Unlock: 6
```

**CRITICAL — Appendix D trigger rules.** Reflex passive fires when discarded from hand by:
- End-of-turn discard (unplayed cards cleared) — YES
- Transmute (discard to transform) — YES
- Swap (discard 1, draw 1) — YES
- Enemy effects that force discard — YES
- Any other discard-from-hand effect — YES

Reflex passive does NOT fire when:
- Shuffled from discard into draw pile
- Exhausted (exhaust pile is not discard)
- Removed from deck via Meditate

Block from Reflex discard is applied **immediately**, before other end-of-turn effects. 2 Reflex cards discarded in one turn = 6 block total (3 each), applied before enemy turn.

Implementation: `turnManager.discardFromHand(card)` must check `card.mechanicId === 'reflex'` and call `applyBlock(3)` at the discard site — not deferred. All discard paths that go through `discardFromHand()` get this for free; any discard paths that bypass it must be audited.

**Mastery definition (`reflex`):**
```
cap: 3
perLevelDelta: +1 draw at L3
secondaryPerLevelDelta: +1 passive block at L3
addTagAtLevel: { level: 3, tag: 'reflex_enhanced' }  // L3: draws 3 (not 2) on QP; passive block = 4 (not 3)
```

**Acceptance:**
- QP: draws 2. CC: draws 3. CW: draws 1.
- Discarding Reflex from hand (end-of-turn, via Swap, via Transmute) applies 3 block immediately
- Block is applied before enemy attack resolves (verified by ordering in turn resolution)
- 2 Reflex discarded in one turn = 6 block total
- Exhausting Reflex does NOT trigger the passive
- Removing via Meditate does NOT trigger the passive
- L3: discard gives 4 block; QP draws 3

---

#### 3.2.3 — Recollect (U6)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `recollect`. 1 AP. Returns exhausted cards to the discard pile.

```
QP:  return 1 exhausted card to discard pile (player selects from exhaust pile viewer)
CC:  return 2 exhausted cards
CW:  return 1 exhausted card
Pool: 1  Unlock: 8
```

**CRITICAL ruling (Appendix F):** Inscriptions are "remove from game" on exhaust — they are NOT in the exhaust pile and cannot be Recollected. Cursed cards cannot be exhausted (see Phase 0 spec). On play, open the exhaust pile viewer for selection. If the exhaust pile is empty, Recollect has no effect but still costs the AP.

**Mastery definition (`recollect`):**
```
cap: 3
perLevelDelta: none (tag-based)
addTagAtLevel: { level: 3, tag: 'recollect_qp2' }  // L3: QP returns 2 exhausted (same as CC baseline)
```

**Acceptance:**
- Selected exhausted card moves from exhaust pile to discard pile
- CC: 2 cards returned; player selects both from exhaust viewer
- Inscriptions never appear in the exhaust pile selection (they are already removed from game)
- Empty exhaust pile: card plays but nothing happens (no crash, no UI hang)
- L3: QP returns 2 cards

---

#### 3.2.4 — Synapse (U7)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/game/services/chainTracker.ts` (or equivalent) — wildcard chain link on CC
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `synapse`. 1 AP. Draw + optional chain wildcard on CC.

```
QP:  draw 2
CC:  draw 2 + next card play counts as matching the previous card's chain type (wildcard chain link)
CW:  draw 1
Pool: 1  Unlock: 10
```

The CC wildcard flag means Synapse's CC extends the active chain by 1, using whatever chain type was last active. Chain count increments as if a matching chain card was played. This is identical to how Chain Anchor extends chains but Synapse does it as a CC bonus, not its base effect.

Implementation: `cardEffectResolver` sets `applyWildcardChainLink: true` in the result when `playMode === 'charge_correct'`. `turnManager` checks this flag and extends chain count by 1 on the current chain type before drawing the 2 cards.

**Mastery definition (`synapse`):**
```
cap: 3
perLevelDelta: +1 draw at L3
addTagAtLevel: { level: 3, tag: 'synapse_draw3_qp' }  // L3: QP draws 3 (not 2)
```

**Acceptance:**
- QP: draws 2. CC: draws 2 AND extends active chain by 1. CW: draws 1.
- CC wildcard chain link works even when there is no active chain (starts a chain of length 1 matching the card played before Synapse)
- If no previous card was played this turn, wildcard chain type defaults to 'generic' or no chain — does not crash
- L3: QP draws 3

---

#### 3.2.5 — Siphon Knowledge (U3) — FLAGSHIP

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/ui/components/SiphonKnowledgeOverlay.svelte` (new, or add to CardBrowser.svelte)
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `siphon_knowledge`. 2 AP. The flagship utility card — draw cards and briefly preview their quiz answers.

```
QP:  draw 2, see their quiz answers for 3 seconds (answers briefly shown before quiz starts)
CC:  draw 3, see their quiz answers for 5 seconds
CW:  draw 1, see their quiz answers for 2 seconds
Pool: 1  Unlock: 9 (note: EXPANSION_FINAL_PRODUCTION.md Part 5 says unlock 13 for Siphon Knowledge — use level 9 from §3E)
```

Wait — §3E says Unlock 9 for U3 Siphon Knowledge, Part 5 says level 13. **The card table in §3E is authoritative for individual card stats. Use unlock level 9.**

The "see answers" mechanic: after drawing the cards, a brief overlay shows each drawn card's correct quiz answer text for the specified duration. This is NOT the full quiz — it is a flash of the answer text only (e.g., "Lima", "1969", "Mitochondria"). The player still takes the quiz normally when they play those cards. The overlay dismisses automatically after the duration; it cannot be dismissed early.

UI note: Use shared CardBrowser or a simpler SiphonKnowledgeOverlay. Mobile-friendly (large text, cards listed vertically). Functional > pretty at alpha.

**Mastery definition (`siphon_knowledge`):**
```
cap: 3
perLevelDelta: +1 draw at L3
addTagAtLevel: { level: 3, tag: 'siphon_qp3_time4s' }  // L3: QP draws 3 + see time extended to 4s
```

**Acceptance:**
- QP: draws 2, shows answer overlay for 3s. CC: draws 3, shows overlay for 5s. CW: draws 1, shows overlay for 2s.
- Overlay shows the correct quiz answer (not the question) for each drawn card
- Overlay auto-dismisses after duration; game resumes normally
- Drawing with empty draw pile: shuffles discard first (standard draw behavior), then draws up to available cards
- Quiz still fires normally when those cards are played — Siphon Knowledge does not grant auto-correct
- L3: QP draws 3, overlay lasts 4s

---

#### 3.2.6 — Tutor (U5)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/ui/components/CardBrowser.svelte` — used for searching draw pile
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `tutor`. 1 AP. Search the draw pile for any card and add it to hand.

```
QP:  search draw pile, choose any card, add to hand (normal AP cost when played)
CC:  search draw pile, choose any card, add to hand; that card costs 0 AP this turn
CW:  search draw pile, choose any card, add to hand (same as QP)
Pool: 1  Unlock: 11
```

On play, open `CardBrowser.svelte` showing the draw pile (shuffled display is fine — player sees all cards). Player selects one. That card is removed from draw pile and added to hand. On CC, the selected card gets a `freeThisTurn: true` flag (costs 0 AP when played this turn, including surcharge).

If draw pile is empty, Tutor opens CardBrowser showing discard pile instead (fallback: if discard also empty, Tutor has no effect but still costs the AP).

**Mastery definition (`tutor`):**
```
cap: 3
perLevelDelta: none (tag-based)
addTagAtLevel: { level: 3, tag: 'tutor_free_qp' }  // L3: tutored card costs 0 AP on QP too (same as CC baseline)
```

**Acceptance:**
- CardBrowser opens showing draw pile cards
- Selected card added to hand; removed from draw pile
- CC: selected card costs 0 AP this turn (including any Charge surcharge)
- CW: same as QP (card added at normal cost)
- Empty draw pile: browser shows discard pile
- Both piles empty: Tutor plays with no effect (no crash)
- L3: QP also grants free-this-turn on tutored card

---

### 3.3 — Advanced Wild Cards (4 cards)

**Cards:** Catalyst (W5), Mimic (W8), Aftershock (W10), Sacrifice (W7)

#### 3.3.1 — Sacrifice (W7)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `sacrifice`. 0 AP (play cost free; Charge costs 1 AP surcharge). Classic HP-for-resources trade.

```
QP:  lose 5 HP, draw 2 cards, gain 1 AP
CC:  lose 5 HP, draw 3 cards, gain 2 AP
CW:  lose 5 HP, draw 1 card, gain 1 AP
Pool: 1  Unlock: 8
```

**CRITICAL (Appendix F):** AP gained from Sacrifice can push past `MAX_AP_PER_TURN` — there is no hard cap on AP. If player has 0 AP, Sacrifice can be Quick Played for free (0-cost) and grants 1 AP back, netting +1 AP.

The 5 HP loss is a fixed self-damage and is NOT affected by cursed status, mastery level, or any buff. It is applied at resolution time, not at quiz resolution. HP cannot go below 1 via Sacrifice (if player has 1 HP, Sacrifice still plays but does not reduce HP further — see EXPANSION_FINAL_PRODUCTION.md: this is a safe assumption but verify against existing `applyDamage` logic for self-damage floor rules).

Resolver result fields needed: `selfDamage: 5`, `grantsAp: 1 or 2`, `extraCardsDrawn: 2 or 3`.

**Mastery definition (`sacrifice`):**
```
cap: 3
perLevelDelta: +1 draw at L3
addTagAtLevel: { level: 3, tag: 'sacrifice_draw3_qp' }  // L3: QP draws 3 cards
```

**Acceptance:**
- All modes lose 5 HP (self-damage always fires, regardless of quiz result)
- QP: draw 2, gain 1 AP. CC: draw 3, gain 2 AP. CW: draw 1, gain 1 AP.
- AP gain can exceed MAX_AP_PER_TURN (e.g., starting turn at 3 AP, CC grants +2 → 5 AP is valid)
- HP self-damage fires even if player is at 1 HP (floor behavior follows existing self-damage rules)
- L3: QP draws 3

---

#### 3.3.2 — Catalyst (W5)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `catalyst`. 1 AP. Doubles poison (and on CC, also Burn) on enemy.

```
QP:  double all Poison stacks on enemy
CC:  double all Poison stacks + double all Burn stacks on enemy
CW:  double all Poison stacks on enemy (same as QP)
Pool: 1  Unlock: 10
```

Doubling is a multiplier applied to the current stack count at resolution time. E.g., enemy at 6 Poison → 12 Poison. Enemy at 0 Poison → still 0 (doubling zero is a no-op). This does NOT apply any new stacks, only scales existing ones.

Result fields: `poisonDoubled: true`, `burnDoubled: true` (CC only). `turnManager` reads these flags and applies the doubling to `encounterState.enemy.statusEffects`.

**Mastery definition (`catalyst`):**
```
cap: 3
perLevelDelta: none (tag-based)
addTagAtLevel: { level: 3, tag: 'catalyst_bleed_qp' }  // L3: QP also doubles Bleed stacks (in addition to Poison)
```

**Acceptance:**
- QP/CW: enemy Poison stacks doubled (0 → 0, 5 → 10, 12 → 24)
- CC: enemy Poison AND Burn stacks doubled
- CW: only Poison doubled (Burn not doubled)
- No effect if enemy has 0 of the relevant status
- L3: QP also doubles Bleed stacks

---

#### 3.3.3 — Mimic (W8)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/ui/components/CardBrowser.svelte` — used for CC "choose from discard"
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `mimic`. 1 AP. Replays a card from the discard pile.

```
QP:  random card from discard pile, replay at 0.8× power
CC:  choose any card from discard pile (via CardBrowser), replay at 1.0× power
CW:  random card from discard pile, replay at 0.5× power
Pool: 1  Unlock: 11
```

**CRITICAL (Appendix F):** Mimic copies BASE mechanic values, then applies its own multipliers (0.8×, 1.0×, 0.5×). It does NOT inherit the original card's tier, mastery bonuses, buffs, or chain state — only the raw mechanic base values scaled by Mimic's own power modifier. The replayed card does NOT require another quiz and does NOT go through the card play flow (no AP cost for the mimicked play, it resolves as part of Mimic's resolution).

If discard pile is empty, Mimic has no effect but still costs the AP.

For QP/CW: randomly select from discard (uniform distribution). For CC: open CardBrowser showing discard pile.

The replayed card effect uses `playMode: 'quick'` (no quiz, treated as quick play at specified multiplier). Cards that have behaviors blocked on Quick Play (if any) should follow those same rules.

**Mastery definition (`mimic`):**
```
cap: 3
perLevelDelta: none (tag-based)
addTagAtLevel: { level: 3, tag: 'mimic_choose_qp' }  // L3: QP also lets player choose from discard (like CC, but at 0.8×)
```

**Acceptance:**
- QP: random discard card replayed at 0.8× base values
- CC: CardBrowser opens for discard; chosen card replayed at 1.0× base values
- CW: random discard card replayed at 0.5× base values
- Mimic copies BASE mechanic values only — mastery bonuses, tier multipliers from original card NOT inherited
- Empty discard: Mimic plays with no effect (no crash, no infinite loop if discard is empty after draw)
- L3: QP opens CardBrowser to choose

---

#### 3.3.4 — Aftershock (W10)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/game/services/turnManager.ts` — track lastPlayedCardRef by mode
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `aftershock`. 1 AP. Repeats the last played card's effect at reduced power, mode-aware.

```
QP:  repeat last Quick Played card's effect at 0.5×
CC:  repeat last Charged-Correct card's effect at 0.7× (no quiz required for Aftershock itself)
CW:  repeat last card played (any mode) at 0.3×
Pool: 1  Unlock: 10
```

**CRITICAL (Appendix F):** Aftershock memory is **current turn only** — it does not remember card effects across turns. If no card was played by the relevant mode this turn, that Aftershock mode has no effect (e.g., CC with no prior CC play this turn = no effect, still costs the AP).

**CRITICAL (Appendix F):** Copies BASE mechanic values, applies its own multipliers. Does NOT copy the original play's mastery bonuses, buffs, chain state, or quiz result.

`turnManager` must track:
- `lastQPCardThisTurn: string | null` — mechanic ID of last Quick Played card
- `lastCCCardThisTurn: string | null` — mechanic ID of last Charge Correct card
- `lastAnyCardThisTurn: string | null` — mechanic ID of last card played (any mode)

These reset at turn start.

The repeated effect is resolved via `cardEffectResolver` using the stored mechanic ID at the given multiplier, as a Quick Play (no quiz).

**Mastery definition (`aftershock`):**
```
cap: 3
perLevelDelta: +0.1× power per level (i.e., QP multiplier goes 0.5 → 0.8 at L3)
addTagAtLevel: none (numeric scaling only)
L0→L3: QP: 0.5×, 0.6×, 0.7×, 0.8× (at L3); CC: 0.7×, 0.8×, 0.9×, 1.0× (at L3)
```

**Acceptance:**
- QP: repeats last QP-mode card at 0.5×. No prior QP card this turn → no effect.
- CC: repeats last CC-mode card at 0.7× (no quiz). No prior CC card this turn → no effect.
- CW: repeats last-any-mode card at 0.3×.
- Repeat uses BASE mechanic values only (no mastery/tier/buff inheritance)
- Turn memory resets at turn start
- Cannot target itself (if Aftershock was somehow the last QP card, implementation should skip to avoid recursion — treat as "no valid target")
- L3: QP replays at 0.8×, CC at 1.0×

---

### 3.4 — Big-Cost Cards (5 cards)

**Cards:** Bulwark (S3), Conversion (S6), Ironhide (S7), Hemorrhage (A3), Entropy (D5)

#### 3.4.1 — Hemorrhage (A3) — Bleed Finisher

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `hemorrhage`. 2 AP. Consumes all Bleed stacks on the enemy and deals burst damage scaling with them.

```
QP:  4 + (4 × bleedStacks) damage, consume all Bleed stacks
CC:  4 + (6 × bleedStacks) damage, consume all Bleed stacks
CW:  4 + (2 × bleedStacks) damage, consume all Bleed stacks
Pool: 1  Unlock: 7
```

Always has 4 base damage even at 0 Bleed. Bleed stacks are consumed (set to 0) at resolution time, after damage is calculated. Damage is calculated using the Bleed count at the start of resolution (before consuming).

The bleed stack count is read from `encounterState.enemy.statusEffects` at resolve time. Resolver needs `enemyBleedStacks: number` in `AdvancedResolveOptions` (or compute from `enemy` passed to resolver).

**Mastery definition (`hemorrhage`):**
```
cap: 5
perLevelDelta: +1 base dmg per level (the flat 4 becomes 5, 6, 7... The per-Bleed multiplier is unchanged)
secondaryPerLevelDelta: none
L0→L5 QP base: 4→9 (+ 4× bleed scaling unchanged)
```

**Acceptance:**
- QP with 5 Bleed: 4 + (4×5) = 24 damage, Bleed set to 0
- CC with 5 Bleed: 4 + (6×5) = 34 damage, Bleed set to 0
- CW with 5 Bleed: 4 + (2×5) = 14 damage, Bleed set to 0
- With 0 Bleed: QP = 4, CC = 4, CW = 4 (base only)
- Bleed consumed after damage calc (not before)
- L5 with 5 Bleed QP: (4+5) + (4×5) = 9 + 20 = 29 damage

---

#### 3.4.2 — Entropy (D5)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `entropy`. 2 AP. Dual DoT applicator — applies both Burn and Poison.

```
QP:  apply 3 Burn + 2 Poison (duration 2 turns)
CC:  apply 6 Burn + 4 Poison (duration 3 turns)
CW:  apply 2 Burn + 1 Poison (duration 1 turn)
Pool: 1  Unlock: 9
```

Both Burn and Poison are additive with existing stacks. Duration here means the Poison lasts N turns before expiring; Burn's consumption mechanic is unchanged (halves on hit regardless of duration).

Result fields: `statusesApplied: [{ type: 'burn', stacks: 3, duration: 2 }, { type: 'poison', stacks: 2, duration: 2 }]` (or equivalent StatusEffect objects used by the existing status system).

**Mastery definition (`entropy`):**
```
cap: 3
perLevelDelta: +1 Burn per level
addTagAtLevel: { level: 3, tag: 'entropy_poison_qp' }  // L3: QP also applies 1 Poison in addition to the 3 Burn
L0→L3 Burn: 3→6 Burn (QP); Poison unchanged until L3 tag
```

**Acceptance:**
- QP: 3 Burn + 2 Poison applied to enemy
- CC: 6 Burn + 4 Poison applied
- CW: 2 Burn + 1 Poison applied
- Stacks add to existing enemy Burn/Poison (additive stacking)
- L3: QP applies 4 Burn + 2 Poison (3 Burn base + 3 mastery = 6, plus L3 tag adds the extra Poison on QP)
- Wait — the mastery table says "L3: +1 Poison on QP too". Re-reading: `perLevelDelta: +1 Burn` means at L3 the base Burn becomes 3+3=6 (not quite, it's per level +1 on QP). Base QP Burn at L0 = 3. At L3 = 6. L3 tag: QP also gets +1 Poison added. So L3 QP = 6 Burn + 3 Poison. Implement per this spec.

---

#### 3.4.3 — Bulwark (S3)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `bulwark`. 3 AP. Emergency mega-block that exhausts on CC.

```
QP:  18 block
CC:  36 block, EXHAUST (card is moved to exhaust pile after this play)
CW:  10 block
Pool: 1  Unlock: 9  Cap: 3
```

On CC, the card exhausts immediately after resolving. The exhaust happens in `turnManager` after reading the `exhaustOnCharge: true` flag from the resolver result. This is the same exhaust-on-charge pattern as Volatile Slash and Burnout Shield.

**Mastery definition (`bulwark`):**
```
cap: 3
perLevelDelta: +3 block per level (QP base)
L0→L3 QP: 18→27 block (CC: 36→45, still exhausts)
```

**Acceptance:**
- QP: 18 block, card stays in play
- CC: 36 block, card exhausted
- CW: 10 block, card stays
- Exhaust prevents Bulwark from cycling back until Recollected
- Cap 3: at most 3 Bulwark copies in any run's pool
- L3: QP gives 27 block, CC gives 45 block (still exhausts)

---

#### 3.4.4 — Conversion (S6)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `conversion`. 1 AP. Converts current block into damage at 1:1 ratio, up to a cap.

```
QP:  convert up to 10 block into damage (1 block = 1 damage)
CC:  convert up to 15 block into damage
CW:  convert up to 5 block into damage
Pool: 1  Unlock: 10
```

**CRITICAL (Appendix F):** Conversion ratio is 1:1. Block converted is LOST — player's current block is reduced by the amount converted, and equal damage is dealt to the enemy (before enemy block). If player has less block than the cap, convert all available block. If player has 0 block, Conversion deals 0 damage.

This touches player state (block reduction) AND enemy (damage). Result fields needed: `conversionDamage: number`, `blockConsumed: number`. `turnManager` applies: subtract `blockConsumed` from `playerState.block`, add `conversionDamage` to `damageDealt` (which then goes through normal block calculation against enemy).

**CRITICAL (Appendix F — Cursed Conversion):** A cursed Conversion converts block at 0.7× cap: QP cap drops to 7 (floor), CC cap drops to 10 (floor), CW cap drops to 3 (floor). The resolver must apply cursed multiplier to the cap when `card.isCursed`.

**Mastery definition (`conversion`):**
```
cap: 3
perLevelDelta: +2 cap per level (QP cap: 10→16 at L3; CC cap: 15→21 at L3)
addTagAtLevel: none
```

**Acceptance:**
- QP with 8 block: deals 8 damage (converts all 8, under cap of 10), player block → 0
- QP with 15 block: deals 10 damage (cap 10), player block → 5
- CC with 15 block: deals 15 damage (cap 15), player block → 0
- CW with 3 block: deals 3 damage, player block → 0
- 0 block: Conversion deals 0 damage (no crash)
- Cursed card: QP cap = 7 (floor), verified
- L3: QP cap 16, CC cap 21

---

#### 3.4.5 — Ironhide (S7)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `ironhide`. 2 AP. Block plus Strength — temporary on QP, permanent on CC.

```
QP:  6 block + 1 Strength (this turn only — Strength expires at turn end)
CC:  6 block + 1 Strength (permanent — persists for rest of combat)
CW:  4 block (no Strength)
Pool: 1  Unlock: 8
```

"This turn only" Strength: track via a `temporaryStrength: number` field on `PlayerCombatState`, or tag the Strength status with `expires: 'turn_end'`. This is separate from permanent Strength. At turn end, `turnManager` clears temporary Strength. Permanent Strength stacks with temporary Strength during the turn it's gained.

Permanent Strength on CC snowballs over multiple Ironhide plays (+1 per CC each time you draw and CC it).

**Mastery definition (`ironhide`):**
```
cap: 3
perLevelDelta: +1 block per level
addTagAtLevel: { level: 3, tag: 'ironhide_perm_qp' }  // L3: QP also gives +1 permanent Str (same as CC baseline)
L0→L3 QP: 6→9 block
```

**Acceptance:**
- QP: 6 block + 1 temporary Strength (expires turn end)
- CC: 6 block + 1 permanent Strength (persists rest of combat)
- CW: 4 block, no Strength
- Multiple CC plays: each adds +1 permanent Strength (verified with 3× CC = +3 permanent Str)
- Temporary Strength clears at turn end and does not carry forward
- L3: QP also gives +1 permanent Strength

---

### 3.5 — Inscription of Wisdom (I3)

**Cards:** Inscription of Wisdom (I3) — 1 card

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/game/services/encounterState.ts` — track active inscription effects
- `src/game/services/turnManager.ts` — trigger Wisdom draw on CC resolution
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `inscription_wisdom`. 2 AP. Persistent inscription — exhausts on play, rest-of-combat effect.

```
QP:  Inscription active: each Charge Correct answer draws 1 extra card for rest of combat
CC:  Inscription active: each CC draws 1 extra card + heals 1 HP for rest of combat
CW:  FIZZLE — 3 AP total spent (2 play + 1 surcharge), card removed from game, zero effect. Complete fizzle.
Pool: 1  Unlock: 1
```

**CRITICAL:** This is an Inscription — it EXHAUSTS on play and the persistent effect lives on `EncounterState.activeInscriptions`. Multiple same-type Inscriptions cannot stack (Pool = 1, removed from game on play — not just to exhaust pile but fully removed). See Phase 0.6 spec.

**CRITICAL (Appendix F):** CW fizzle is intentional. 2 AP play cost + 1 AP Charge surcharge = 3 AP total wasted, card removed from game, zero persistent effect. This is the harshest CW penalty in the game by design. Resolve: `inscriptionActivated: false`, `selfRemoved: true`, effect type = none.

**CRITICAL (Appendix F):** If a Cursed Inscription of Wisdom is played at QP (0.7× mode), the persistent effect is at 0.7× power for rest of combat. Since the QP effect is binary (draw 1 extra card), 0.7× rounds down to 0 — a cursed Inscription of Wisdom QP applies no effect. Implement: if `card.isCursed && playMode === 'quick'`, treat as CW fizzle (no effect). Document this in code comments.

On QP inscription activation: `EncounterState.activeInscriptions.wisdom = { extraDrawPerCC: 1, healPerCC: 0 }`.
On CC inscription activation: `EncounterState.activeInscriptions.wisdom = { extraDrawPerCC: 1, healPerCC: 1 }`.
Each subsequent CC resolution: check `activeInscriptions.wisdom` and draw the extra card(s) and heal accordingly.

**Mastery definition (`inscription_wisdom`):**
```
cap: 3
perLevelDelta: none (tag-based)
addTagAtLevel: { level: 3, tag: 'inscription_wisdom_heal2' }  // L3: CC also heals 2 HP per correct instead of 1
```

**Acceptance:**
- QP: inscription activates (draw 1 extra per future CC). Each subsequent CC this combat draws 1 extra card.
- CC: inscription activates (draw 1 extra + heal 1 HP per future CC). Each subsequent CC draws 1 extra AND heals 1 HP.
- CW: complete fizzle — `damageDealt: 0`, `shieldApplied: 0`, no inscription added, card removed from game
- Cursed card QP: fizzle (no inscription effect, 0.7× of "draw 1" rounds to 0)
- Card removed from game on play (not recyclable via Recollect)
- If Inscription of Wisdom was previously activated this combat (should be impossible via Pool=1 cap): no stacking
- L3 CC: heals 2 HP per CC (not 1)

---

### 3.6 — Special Mechanics Batch (5 cards)

**Cards:** Eruption (A13, X-cost), Knowledge Bomb (W3), Frenzy (B3), War Drum (B6), Mastery Surge (B5)

#### 3.6.1 — Eruption (A13) — X-Cost Attack

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/game/services/turnManager.ts` — AP drain logic for X-cost
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `eruption`. X AP (consumes all remaining AP). The game's only X-cost card.

```
QP:  8 dmg per AP spent (X = all remaining AP at play time, all AP consumed)
CC:  12 dmg per AP spent (surcharge deducted first, then X = remaining AP)
CW:  5 dmg per AP spent
Pool: 1  Unlock: 12  Cap: 3
```

**CRITICAL (Appendix C — X-Cost Rules):**
- X = all remaining AP at time of play
- QP: X = current AP. All AP consumed. Deals 8 × X damage.
  - Example: 4 AP available → QP → 4×8 = 32 damage, 0 AP remaining
- CC: Charge surcharge (+1 AP) deducted FIRST from current AP, then X = remaining AP. Deals 12 × X.
  - Example: 4 AP available → CC → 1 surcharge → X=3 → 3×12 = 36 damage, 0 AP remaining
- During Surge (surcharge = 0) / Free First Charge (surcharge = 0) / Chain Momentum (surcharge waived):
  - CC with no surcharge: X = all AP → 4×12 = 48 damage at 4 AP
- **CRITICAL (Appendix C + Appendix F):** Frenzy waives play cost; X still drains all remaining AP after surcharge (if any). Frenzy making Eruption "free" does not prevent AP drain — X drain is not a play cost.
- If player has 0 AP when playing Eruption (edge case — should not normally occur), deals 0 damage.

Result fields: `xCostApConsumed: number`, the resolved `rawValue` is `perApDmg × xCostApConsumed`.

**Mastery definition (`eruption`):**
```
cap: 3
perLevelDelta: +1 per-AP dmg per level
L0→L3 QP per AP: 8→11; CC per AP: 12→15
```

**Acceptance:**
- QP at 4 AP: 32 damage, AP → 0
- CC at 4 AP: 1 surcharge + 36 damage (3×12), AP → 0
- CC during Surge at 4 AP: 48 damage (4×12), AP → 0
- Frenzy (free play cost) + Eruption CC at 4 AP: surcharge still applies; net: 1 surcharge → 3×12 = 36 damage
  - Unless Surge is also active (Frenzy waives play cost AND Surge/Chain waives surcharge) → 4×12 = 48
- 0 AP: 0 damage (no crash)
- L3: CC at 4 AP (with surcharge): 3×15 = 45 damage

---

#### 3.6.2 — Frenzy (B3)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/game/services/turnManager.ts` — track free-play-count buffer
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `frenzy`. 2 AP. Grants next N cards free AP cost (including surcharge).

```
QP:  next 2 cards cost 0 AP (play cost + surcharge both waived)
CC:  next 3 cards cost 0 AP
CW:  next 1 card costs 0 AP
Pool: 1  Unlock: 10
```

**CRITICAL (Appendix F):** Frenzy waives play cost and Charge surcharge. However, X-cost cards (Eruption) still drain all remaining AP as their X value — the AP drain is not a "cost" in the play-cost sense, it is the card's effect. Frenzy making Eruption free saves the 0 AP play cost but Eruption still drains remaining AP for its damage calculation.

Implementation: `turnManager` tracks `frenzyChargesRemaining: number`. On Frenzy play, set this to 2/3/1. Each card played while `frenzyChargesRemaining > 0`: set AP cost to 0 (including any Charge surcharge), decrement counter. Counter resets to 0 at turn end if unused.

**Mastery definition (`frenzy`):**
```
cap: 3
perLevelDelta: none (tag-based)
addTagAtLevel: { level: 3, tag: 'frenzy_qp3' }  // L3: QP frees 3 cards instead of 2 (same as CC baseline)
```

**Acceptance:**
- QP: next 2 cards played this turn cost 0 AP total
- CC: next 3 cards cost 0 AP
- CW: next 1 card costs 0 AP
- Surcharge also waived on free cards (Charging a 1 AP card = 0 AP total, not just 0 base)
- Eruption played while Frenzy active: play cost is 0 (saved), but Eruption's X drain still fires
- Counter resets to 0 at turn end
- L3: QP frees 3 cards

---

#### 3.6.3 — War Drum (B6)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/game/services/turnManager.ts` — apply base effect buff to all hand cards this turn
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `war_drum`. 1 AP. Universal hand buff — increases the base effect of all cards in hand this turn.

```
QP:  all cards in hand gain +2 base effect this turn
CC:  all cards in hand gain +4 base effect
CW:  all cards in hand gain +1 base effect
Pool: 1  Unlock: 8
```

"Base effect this turn" means: the War Drum bonus is added to `quickPlayValue`, `chargeCorrectValue`, and `chargeWrongValue` of all cards currently in hand at the time War Drum resolves. This buff is additive (not multiplicative). It applies only to cards in hand at that moment — cards drawn after War Drum plays do NOT receive the bonus.

Implementation: on War Drum play, iterate over `playerState.hand` and add the bonus to each card's three QP/CC/CW values (or apply a `warDrumBonus: number` flag per-card that resolvers read). Reset all bonuses at turn end.

**Mastery definition (`war_drum`):**
```
cap: 5
perLevelDelta: +1 base effect buff per level
L0→L5 QP buff: +2→+7 to all cards in hand
```

**Acceptance:**
- QP: all hand cards get +2 to their QP/CC/CW base values this turn
- CC: +4 to all hand cards' values
- CW: +1 to all hand cards' values
- Cards drawn after War Drum plays do NOT receive the bonus
- Buff clears at turn end
- L5: QP gives +7 to all hand cards

---

#### 3.6.4 — Mastery Surge (B5)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/game/services/cardUpgradeService.ts` — apply mastery level bump
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `mastery_surge`. 1 AP. Instantly bumps mastery level of 1 or 2 random hand cards.

```
QP:  +1 mastery to 1 random card in hand
CC:  +1 mastery to 2 random cards in hand
CW:  no mastery change (Mastery Surge fizzles — 1 AP spent, nothing happens)
Pool: 1  Unlock: 11
```

**CRITICAL (Appendix F / Part 6 Cursed interactions):** Mastery Surge is WASTED on cursed cards. Cursed facts are locked at effective mastery 0 regardless of the card's stored mastery level. If a random selection lands on a cursed card, the mastery bump is applied to the underlying card data but has no visible effect until the fact is cured. Implementation should document this behavior — do not skip cursed cards in random selection, just note that the bump is ineffective.

"Random card in hand" excludes Mastery Surge itself (can't target itself). If hand has only Mastery Surge remaining, QP/CC have no valid target and fizzle.

Mastery bump is in-combat only or permanent (cross-combat)? Per the mastery system (AR-113): mastery levels persist across combat within a run. So this bump is permanent for the run.

The mastery bump is capped at `maxMasteryLevel` for the target card's mechanic (Cap 3 cards won't go above 3, Cap 5 cards won't go above 5).

**Mastery definition (`mastery_surge`):**
```
cap: 3
perLevelDelta: none (tag-based)
addTagAtLevel: { level: 3, tag: 'mastery_surge_qp2' }  // L3: QP upgrades 2 cards instead of 1 (same as CC baseline)
```

**Acceptance:**
- QP: 1 random non-self hand card gains +1 mastery (capped at its own maxMasteryLevel)
- CC: 2 random non-self hand cards gain +1 mastery each
- CW: no effect (0 mastery changed) — not a crash, just fizzle
- Cursed cards selected: mastery bump applied to stored level but has no visible effect until cured
- Only 1 card in hand (Mastery Surge): QP/CC fizzle gracefully
- L3: QP upgrades 2 cards

---

#### 3.6.5 — Knowledge Bomb (W3)

**Files:**
- `src/data/mechanics.ts`
- `src/services/cardEffectResolver.ts`
- `src/services/cardUpgradeService.ts`

**What:**
Add mechanic ID `knowledge_bomb`. 2 AP. Scales with total correct Charges made this entire encounter.

```
QP:  4 damage (flat, no scaling)
CC:  4 × correctChargesThisEncounter damage (Knowledge Bomb's own correct Charge counts toward total)
CW:  4 damage (flat)
Pool: 1  Unlock: 13
```

**CRITICAL (Appendix F):** Knowledge Bomb's own correct Charge counts toward the total for the encounter. So if you have 5 prior correct Charges and CC Knowledge Bomb, total = 6, dealing 4×6 = 24 damage.

`correctChargesThisEncounter` is tracked in `EncounterState` (already likely tracked for existing mechanics — if not, add it). Resolver needs `correctChargesThisEncounter: number` in `AdvancedResolveOptions`, where the count includes the current CC play.

Note: CC costs 2 AP play + 1 AP surcharge = 3 AP total. At 6 correct Charges = 24 damage for 3 AP. Scales dramatically in long encounters.

**Mastery definition (`knowledge_bomb`):**
```
cap: 5
perLevelDelta: +1 per-correct dmg per level
L0→L5 CC per correct: 4→9 damage per correct Charge
```

**Acceptance:**
- QP: always 4 damage regardless of encounter history
- CW: always 4 damage
- CC at 0 prior correct Charges: 4×1 = 4 (self counts as 1st correct)
- CC at 5 prior correct Charges: 4×6 = 24 damage
- CC at 10 prior correct Charges: 4×11 = 44 damage
- L3: CC with 5 prior = 7×6 = 42 damage
- correctChargesThisEncounter increments BEFORE damage calculation on CC play

---

## New Fields Required in AdvancedResolveOptions

The following additions to `AdvancedResolveOptions` in `cardEffectResolver.ts` are required by Phase 3 cards:

```typescript
/** Smite: mastery levels of all cards currently in hand (including Smite itself). */
handMasteryValues?: number[];

/** Recall: current size of the discard pile at resolve time. */
discardPileSize?: number;

/** Hemorrhage: current Bleed stacks on enemy (consumed after calc). */
enemyBleedStacks?: number;

/** Knowledge Bomb: total correct Charges in this encounter (including current CC play). */
correctChargesThisEncounter?: number;
```

And new fields in `CardEffectResult`:

```typescript
/** Catalyst: double enemy Poison stacks. */
poisonDoubled?: boolean;
/** Catalyst CC: also double enemy Burn stacks. */
burnDoubled?: boolean;
/** Conversion: block consumed from player. */
blockConsumed?: number;
/** X-cost: AP consumed by Eruption's X drain. */
xCostApConsumed?: number;
/** Synapse CC: wildcard chain link (extend chain by 1). */
applyWildcardChainLink?: boolean;
/** Hemorrhage: consume all Bleed stacks after this resolve. */
consumeAllBleed?: boolean;
/** Frenzy: number of free-play charges granted. */
frenzyChargesGranted?: number;
/** War Drum: base effect bonus to apply to all current hand cards. */
warDrumBonus?: number;
/** Mastery Surge: mastery bumps to apply (array of card indices or IDs). */
masteryBumps?: Array<{ cardId: string; delta: number }>;
/** Inscription of Wisdom fizzle on CW. */
inscriptionFizzled?: boolean;
/** Siphon Knowledge: duration to show answer previews (seconds). */
siphonAnswerPreviewDuration?: number;
/** Tutor: whether tutored card gets free-this-turn on CC. */
tutoredCardFree?: boolean;
/** Aftershock: mechanic ID to repeat + multiplier. */
aftershockRepeat?: { mechanicId: string; multiplier: number };
/** Mimic: mechanic ID to replay + multiplier. */
mimicReplay?: { mechanicId: string; multiplier: number; fromDiscard: boolean };
/** Recollect: number of exhausted cards to return to discard. */
exhaustedCardsToReturn?: number;
/** Sacrifice: AP gain. */
sacrificeApGain?: number;
/** Ironhide: permanent vs temporary strength granted. */
ironhideStrength?: { amount: number; permanent: boolean };
/** Bulwark / Volatile Slash / Burnout Shield: exhaust this card after resolving. */
exhaustAfterPlay?: boolean;
```

---

## MASTERY_UPGRADE_DEFS — All Phase 3 Cards

Every new mechanic ID must have an entry in `MASTERY_UPGRADE_DEFS` (in `cardUpgradeService.ts` or equivalent). Entries below are authoritative — taken directly from §3I of the expansion spec.

| mechanic ID | cap | perLevelDelta | L3 bonus tag |
|---|---|---|---|
| `smite` | 5 | +2 dmg QP base | none |
| `feedback_loop` | 3 | +2 QP / +4 CC per level | `feedback_weakness` (QP applies 1 Weakness) |
| `recall` | 5 | +0.2 per-discard dmg per level | `recall_draw` (draw 1 after resolving) |
| `hemorrhage` | 5 | +1 base dmg per level | none |
| `eruption` | 3 | +1 per-AP dmg per level | none |
| `bulwark` | 3 | +3 block per level | none |
| `conversion` | 3 | +2 cap per level | none |
| `ironhide` | 3 | +1 block per level | `ironhide_perm_qp` (QP also gives +1 perm Str) |
| `frenzy` | 3 | none | `frenzy_qp3` (QP frees 3 cards) |
| `mastery_surge` | 3 | none | `mastery_surge_qp2` (QP upgrades 2 cards) |
| `war_drum` | 5 | +1 base effect buff per level | none |
| `entropy` | 3 | +1 Burn per level | `entropy_poison_qp` (+1 Poison on QP) |
| `synapse` | 3 | +1 draw at L3 | `synapse_draw3_qp` (QP draws 3) |
| `tutor` | 3 | none | `tutor_free_qp` (tutored card free on QP) |
| `recollect` | 3 | none | `recollect_qp2` (QP returns 2 exhausted) |
| `siphon_knowledge` | 3 | +1 draw at L3 | `siphon_qp3_time4s` (QP draws 3 + 4s preview) |
| `reflex` | 3 | +1 draw / +1 passive block at L3 | `reflex_enhanced` (QP draws 3, passive = 4 block) |
| `archive` | 3 | none | `archive_retain2_qp` (QP retains 2 on QP) |
| `catalyst` | 3 | none | `catalyst_bleed_qp` (QP also doubles Bleed) |
| `mimic` | 3 | none | `mimic_choose_qp` (QP lets player choose) |
| `aftershock` | 3 | +0.1× power per level | none |
| `sacrifice` | 3 | +1 draw at L3 | `sacrifice_draw3_qp` (QP draws 3) |
| `knowledge_bomb` | 5 | +1 per-correct dmg per level | none |
| `inscription_wisdom` | 3 | none | `inscription_wisdom_heal2` (CC heals 2 HP per correct) |

---

## Interaction Rulings Reference

Workers implementing these cards MUST adhere to the following confirmed rulings (from Appendix F):

| Card | Ruling |
|---|---|
| Frenzy + Eruption | Frenzy waives play cost; X still drains all remaining AP |
| Recollect + Inscriptions | Inscriptions are "remove from game" — cannot be Recollected |
| Aftershock | Current turn only — no cross-turn memory |
| Chameleon / Mimic / Aftershock | Copy BASE mechanic values only; own multipliers apply |
| Mastery Surge on cursed card | Wasted — cursed facts locked at effective mastery 0 |
| Knowledge Bomb self-count | Own CC counts toward total |
| Conversion ratio | 1:1 block-to-damage |
| Synapse chain wildcard | Extends chain count by 1; wildcard matches any chain type |
| Inscription of Wisdom CW | Intentional complete fizzle — 3 AP wasted, removed from game |
| Reflex double-trigger | 2 Reflex discarded = 6 block total, applied before enemy turn |
| Inscription application | Wisdom triggers on CC resolution; block applied before enemy turn |
| AP gain (Sacrifice) | Can exceed MAX_AP_PER_TURN — no hard cap |
| Hemorrhage Bleed consume | Bleed consumed AFTER damage calc, not before |

---

## Files Affected

| File | Change |
|---|---|
| `src/data/mechanics.ts` | Add 23 new `MechanicDefinition` entries |
| `src/services/cardUpgradeService.ts` | Add 23 `MASTERY_UPGRADE_DEFS` entries |
| `src/services/cardEffectResolver.ts` | Add resolver paths for all 23 mechanics; add new `AdvancedResolveOptions` fields; add new `CardEffectResult` fields |
| `src/game/services/turnManager.ts` | Frenzy counter; War Drum per-card bonus; Aftershock turn memory; Reflex discard hook; Sacrifice AP gain; Ironhide temp strength; exhaust-on-CC handling |
| `src/game/services/encounterState.ts` | `correctChargesThisEncounter: number`; `activeInscriptions.wisdom`; `frenzyChargesRemaining: number`; `warDrumBonusThisTurn: number` |
| `src/ui/components/CardBrowser.svelte` | Used by Tutor (draw pile search) and Mimic CC (discard pick) — must already exist from Phase 0.10 |
| `src/ui/components/SiphonKnowledgeOverlay.svelte` | New component: brief answer preview overlay (or extend CardBrowser) |
| `src/data/characterLevel.ts` | Verify unlock levels 5–13 are wired for all Phase 3 mechanics |
| `data/inspection-registry.json` | Add 23 new mechanic entries |
| `docs/GAME_DESIGN.md` | Update card count, add Phase 3 card descriptions |
| `docs/ARCHITECTURE.md` | Document new `AdvancedResolveOptions` fields and `CardEffectResult` fields |

---

## Integration Tasks

### I1 — Unit Tests

**Files:** `tests/unit/cardEffectResolver.phase3.test.ts` (new)

For each of the 23 mechanics, add unit tests covering:
- QP base value at mastery 0
- CC base value at mastery 0
- CW base value at mastery 0 (including fizzle cards)
- At least one mastery-scaled value (L3 or L5)
- Any formula-dependent calculation (Smite avgHandMastery, Recall discard count, Hemorrhage bleed stacks, Knowledge Bomb encounter count)
- Any "no effect on empty" edge case (Recall with 0 discard, Mimic with empty discard, Recollect with empty exhaust)

**Acceptance:** `npx vitest run` passes with all Phase 3 tests green. Existing 1900+ tests must not regress.

### I2 — Headless Balance Simulation

**Files:** `tests/playtest/headless/run-batch.ts`

After all 23 mechanics are implemented and unit-tested, run:

```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 200
```

for all 6 profiles. Check for:
- No crashes or unhandled errors across 200×6 runs
- Eruption X-cost interaction with AP economy (no negative AP states)
- Frenzy + Eruption combination fires without infinite loop
- Knowledge Bomb doesn't produce NaN when `correctChargesThisEncounter` is undefined
- Recall with full discard pile (15+ cards) doesn't overflow
- Inscription of Wisdom persistence tracked correctly across encounters

After smoke pass, run full 1000 runs:

```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000
```

**Acceptance:** No crashes. Win rates remain within the target band established in earlier phases (do not regress below Phase 2 baseline).

### I3 — Inspection Registry Update

**File:** `data/inspection-registry.json`

Add entries for all 23 new mechanic IDs in the `cards` table:

```json
{
  "id": "smite",
  "name": "Smite",
  "type": "card",
  "mechanicId": "smite",
  "unlockLevel": 9,
  "status": "active",
  "lastChangedDate": "<today>",
  "mechanicInspectionDate": "not_checked",
  "visualInspectionDate_portraitMobile": "not_checked",
  "visualInspectionDate_landscapeMobile": "not_checked",
  "visualInspectionDate_landscapePC": "not_checked",
  "uxReviewDate": "not_checked"
}
```

Repeat for: `feedback_loop`, `recall`, `hemorrhage`, `eruption`, `bulwark`, `conversion`, `ironhide`, `frenzy`, `mastery_surge`, `war_drum`, `entropy`, `synapse`, `tutor`, `recollect`, `siphon_knowledge`, `reflex`, `archive`, `catalyst`, `mimic`, `aftershock`, `sacrifice`, `knowledge_bomb`, `inscription_wisdom`.

**Acceptance:** `data/inspection-registry.json` contains entries for all 23 new mechanic IDs. Running the registry check command shows new entries with `not_checked` status (expected at this stage).

### I4 — Documentation Update

**Files:** `docs/GAME_DESIGN.md`, `docs/ARCHITECTURE.md`

After implementation:

`GAME_DESIGN.md`:
- Update card count from Phase 2 total to Phase 3 total (91 unique mechanics)
- Add Phase 3 card descriptions in the card catalogue section
- Document Inscription of Wisdom's fizzle behavior under the Inscription keyword section
- Document Reflex passive trigger rules (per Appendix D)
- Document X-cost Eruption interaction rules (per Appendix C)
- Document Frenzy + X-cost ruling

`ARCHITECTURE.md`:
- Document the new `AdvancedResolveOptions` fields added
- Document the new `CardEffectResult` fields added
- Document `frenzyChargesRemaining` on `EncounterState`
- Document `activeInscriptions.wisdom` on `EncounterState`
- Document Reflex discard hook in `turnManager`

### I5 — Visual Verification

After implementation, the orchestrator MUST visually verify in Playwright:

1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
2. Use `window.__terraScenario.load('combat-basic')` to enter combat
3. Force-inject Phase 3 cards into hand via `window.__terraDebug()` or scenario override
4. Verify:
   - Bulwark (3-AP card) shows correct AP cost badge
   - Eruption shows "X" AP cost badge
   - Inscription of Wisdom shows Inscription visual treatment
   - Siphon Knowledge answer preview overlay appears and auto-dismisses
   - Frenzy "free cards remaining" counter shows in combat HUD (if applicable)
   - War Drum buff indicator visible on hand cards
5. Take screenshot via `mcp__playwright__browser_take_screenshot` (NEVER `page.screenshot()`)
6. Check console for JS errors via `mcp__playwright__browser_console_messages`

If visual issues exist: fix before marking this AR complete.

---

## Verification Gate

Before moving this AR to `completed/`:

- [x] All 23 mechanic IDs present in `src/data/mechanics.ts`
- [x] All 23 entries in `MASTERY_UPGRADE_DEFS`
- [x] `npm run typecheck` passes with zero errors
- [x] `npm run build` produces no errors
- [x] `npx vitest run` — all tests pass, no regressions in 1900+ existing tests
- [x] Phase 3 unit tests added and green (I1)
- [x] Headless sim 200 runs passes without crashes (I2 smoke)
- [x] Headless sim 1000 runs passes (I2 full)
- [x] Eruption X-cost interaction with Frenzy verified in sim (no crash, correct AP drain)
- [x] Inscription of Wisdom CW fizzle verified (3 AP consumed, no inscription added)
- [x] Reflex passive triggers on all valid discard sources and NOT on exhaust/shuffle
- [x] Knowledge Bomb correctChargesThisEncounter counter includes self-CC
- [x] Hemorrhage consumes Bleed AFTER damage calc
- [x] Frenzy does not waive Eruption's X drain (only waives play cost)
- [x] `data/inspection-registry.json` updated with all 23 entries (I3)
- [x] `docs/GAME_DESIGN.md` updated (I4)
- [x] `docs/ARCHITECTURE.md` updated (I4)
- [x] Visual inspection screenshot taken and reviewed (I5)
- [x] No console JS errors in Playwright session

---

## Worker Instructions

Spawn a single Sonnet sub-agent per sub-task (3.1 through 3.6), plus one Sonnet sub-agent for integration tasks (I1, I3, I4 can be batched; I2 headless sim is a separate run; I5 visual is orchestrator-only).

Every worker task prompt MUST include:

> "After implementation, run `npm run typecheck` and `npm run build`. Fix all type errors before returning. Update `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md` if your changes affect gameplay, balance, systems, or file structure. Stale docs = bugs."

Sub-tasks 3.2 (utility) and 3.3 (wild) should be run sequentially (3.2 first) because CardBrowser.svelte is shared by both Tutor (3.2.6) and Mimic (3.3.3). Sub-tasks 3.1, 3.4, 3.5, and 3.6 can be parallelized after sub-task 3.2 is complete (no shared file conflicts except `mechanics.ts` and `cardUpgradeService.ts` — instruct workers to append, not overwrite).
