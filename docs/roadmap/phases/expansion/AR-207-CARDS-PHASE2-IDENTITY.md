# AR-207: Cards Phase 2 — Identity Cards (16 cards)

**Source:** `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md` — Part 3 §3A, §3B, §3C, §3D, §3F, §3I + Appendix F
**Priority:** High
**Estimated complexity:** Very High (16 new mechanic definitions, 4 new resolver systems, 1 new UI popup component)
**Depends on:** AR-206 (Phase 1 cards complete — Bleed, Burn, Cursed system, Inscription system all working)
**Blocks:** AR-208 (Phase 3 advanced cards)

## Overview

Implement the 16 "identity" cards that make Recall Rogue unique. These are the flagship quiz-reward mechanics, chain-scaling cards, exhaust-on-charge cards, and build-defining wilds. They are the cards players will remember runs by — the ones that make knowledge feel powerful.

**The 5 archetypes being introduced:**
1. **Quiz-reward flagships** — cards whose power swings violently based on Charge outcome (Gambit, Curse of Doubt, Unstable Flux)
2. **Chain scaling** — cards that reward chaining correct answers (Chain Lightning, Chain Anchor)
3. **Exhaust-on-Charge burst** — one-shot nukes that disappear after use (Volatile Slash, Burnout Shield)
4. **Buff/debuff depth** — strategic setup cards (Warcry, Battle Trance, Mark of Ignorance, Corroding Touch)
5. **Domain/curse-aware wilds** — cards that read game state (Knowledge Ward, Phase Shift, Chameleon, Dark Knowledge)

**New resolver systems required by this phase:**
- Multi-choice popup (Phase Shift QP/CW choose mode; Unstable Flux CC choose mode)
- Exhaust-on-charge (Volatile Slash CC, Burnout Shield CC)
- Cursed-fact snapshot counter (Dark Knowledge)
- Domain diversity counter (Knowledge Ward)
- Chain-length-at-resolution read (Chain Lightning CC)
- Copy-last-card with chain inheritance (Chameleon CC)

Workers MUST read `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md`:
- Part 3 §3A for exact attack QP/CC/CW values
- Part 3 §3B for shield values
- Part 3 §3C for buff values
- Part 3 §3D for debuff values
- Part 3 §3F for wild card values
- Part 3 §3I for all mastery upgrade definitions (MANDATORY — cards without mastery defs are broken)
- Appendix F for confirmed interaction rulings (authoritative edge cases)

---

## TODO

### Prerequisite — Multi-Choice Popup UI

- [ ] 1. Build MultiChoicePopup Svelte component
  **Files:** `src/ui/components/MultiChoicePopup.svelte` (new), `src/ui/components/CombatHud.svelte` (wire in)
  **What:** A mobile-friendly overlay that presents 2-4 labeled option buttons. Player taps one to select. The popup must:
  - Accept a list of `{ label: string; value: string }` options
  - Accept a title string (e.g., "Phase Shift — Choose your effect:")
  - Emit a `choose` event with the selected `value`
  - Block all card plays and combat input until dismissed (a choice is mandatory)
  - Be dismissible ONLY by tapping an option (no close button, no background tap dismiss)
  - Work at both portrait mobile (375px wide) and landscape PC (1024px wide)
  - Use `data-testid="choice-option-{i}"` on each option button
  Used by: Phase Shift (QP/CW), Unstable Flux (CC).
  **Acceptance:** Popup renders in both orientations. Choosing an option emits the correct value. Combat is unblocked after selection. No path exists to dismiss without choosing.

---

### Flagship Quiz Cards (3)

- [ ] 2. Add Gambit mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `gambit`: type=attack, AP=1, Pool=1, unlockLevel=6.
  - QP: 10 dmg, lose 2 HP (self-damage)
  - CC: 30 dmg, heal 5 HP
  - CW: 7 dmg, lose 5 HP (self-damage)
  The HP swing is the card's identity. QP always self-damages — this is intentional, not a bug.
  Resolver: deal attack damage per play mode. On QP apply `selfDamage: 2`. On CC apply `healApplied: 5`. On CW apply `selfDamage: 5`.
  Add `MASTERY_UPGRADE_DEFS`: cap=5, perLevelDelta=+2 dmg (base attack), L3 bonus tag: self-damage reduced by 1 (QP self-damage becomes 1, CW self-damage becomes 4 at L3+).
  Appendix F ruling: Paradox Engine + Gambit CW = 0.3× dmg (2.1) + 5 piercing + lose HP — not exploitable.
  **Acceptance:** QP: 10 dmg dealt, player loses 2 HP. CC: 30 dmg dealt, player heals 5 HP. CW: 7 dmg dealt, player loses 5 HP. L3+ self-damage reduced by 1. Pool=1 (one copy per run maximum).

- [ ] 3. Add Curse of Doubt mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/turnManager.ts`
  **What:** Add mechanic `curse_of_doubt`: type=debuff, AP=1, Pool=1, unlockLevel=6.
  - QP: enemy takes +30% damage from Charged attacks (2 turns)
  - CC: enemy takes +50% damage from Charged attacks (3 turns)
  - CW: enemy takes +20% damage from Charged attacks (1 turn)
  This is a CHARGE-SPECIFIC damage amplifier — it applies ONLY to Charge plays (charge_correct or charge_wrong), not Quick Play. The status effect must be tracked as a new type: `charge_damage_amp_percent` with a `duration` turn counter and a `value` percent.
  Resolver: apply new status `charge_damage_amp_percent` to enemy with the appropriate value and duration per play mode.
  `turnManager.ts`: In the damage resolution path for Charge plays, check if enemy has `charge_damage_amp_percent` active. If so, multiply final damage by `(1 + value/100)` BEFORE block is applied. Decrement duration at end of enemy turn (same timing as Weakness/Vulnerable). The percent bonus applies to the FINAL damage value (post-chain-multiplier, post-speed-bonus), not the base.
  Add `MASTERY_UPGRADE_DEFS`: cap=5, perLevelDelta=+5% Charge damage bonus. L0→L5 QP: +30%→+55% from Charged attacks.
  **Acceptance:** After playing Curse of Doubt QP, the next 2 enemy turns any Charged attack deals 30% more damage. After CC: 50% more for 3 turns. Quick Play attacks are NOT amplified. Duration ticks down at end of enemy turn. Multiple applications refresh to the higher value and longer duration (do not stack additively).

- [ ] 4. Add Unstable Flux mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/ui/components/CombatHud.svelte`
  **What:** Add mechanic `unstable_flux`: type=wild, AP=1, Pool=1, unlockLevel=6.
  - QP: random effect (damage OR block OR draw OR debuff) at 1.0× base values
  - CC: CHOOSE which effect at 1.5× base values — triggers MultiChoicePopup
  - CW: random effect at 0.7× base values
  Base values for the 4 effect modes (at 1.0×): dmg=10, block=10, draw=2 cards, debuff=2t Weakness.
  QP/CW: pick one effect uniformly at random at the time of play. Randomize at resolve time, not at play time. Do NOT cache the random result across turns.
  CC: Present MultiChoicePopup with 4 options: "Deal 15 damage", "Gain 15 block", "Draw 3 cards", "Apply 3t Weakness". Wait for player choice. Resolve chosen effect.
  Appendix F: CW and QP are random (no choice). CC is chosen. Appendix F §3I L3 bonus: at mastery L3+, QP lets player choose 1 of 2 randomly pre-selected options instead of fully random.
  Add `MASTERY_UPGRADE_DEFS`: cap=3, perLevelDelta=none (tag-based), L3 bonus tag: QP presents 2 random options instead of 1 (partial agency).
  **Acceptance:** QP resolves one random effect. CC shows MultiChoicePopup and resolves chosen effect at 1.5×. CW resolves one random effect at 0.7×. L3 QP shows 2 options to choose from. The 4 effect categories are mutually exclusive per play (you get dmg OR block OR draw OR debuff — not a combination).

---

### Chain Cards (2)

- [ ] 5. Add Chain Lightning mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/turnManager.ts`
  **What:** Add mechanic `chain_lightning`: type=attack, AP=2, Pool=1, unlockLevel=8.
  - QP: 8 dmg (base, regardless of chain length)
  - CC: 8 × chain length (after this card EXTENDS the chain — see ruling below)
  - CW: 5 dmg (base)
  **Critical ruling (Appendix F):** "Chain Lightning counts itself — extends chain then uses new length for its own damage calculation." This means:
  - If chain was at length 2 before Chain Lightning plays, Chain Lightning extends it to 3, then deals 8×3 = 24 (before chain multiplier).
  - If chain was at 0 (no chain), Chain Lightning starts it at 1, then deals 8×1 = 8 on CC.
  - If chain was at 4, it extends to 5, deals 8×5 = 40 on CC (before chain multiplier applied from turnManager).
  - Note: the chain multiplier from turnManager (1.0–3.0× based on chain length) is applied on TOP of the `8 × chain length` calculation.
  **Null Shard interaction (Appendix F):** If relic `null_shard` is active, chain length floors at 1. Chain Lightning works as a basic 8-damage attack (Null Shard disables chain multiplier — chain multiplier = 1.0×, but `8 × 1 = 8` base still applies). Check `activeRelicIds.has('null_shard')` in resolver.
  Add `MASTERY_UPGRADE_DEFS`: cap=5, perLevelDelta=+1 base dmg (the "8" multiplied by chain length on CC). L0→L5 CC: 8/chain-length→13/chain-length base.
  **Acceptance:** QP always deals 8 dmg regardless of chain. CC deals 8 × (new chain length after this card) × chain multiplier. CW always deals 5 dmg. With Null Shard: deals 8 dmg (chain length=1, multiplier=1.0×). L5 mastery CC base = 13 × chain length.

- [ ] 6. Add Chain Anchor mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/turnManager.ts`
  **What:** Add mechanic `chain_anchor`: type=wild, AP=1, Pool=1, unlockLevel=9.
  - QP: draw 1 card
  - CC: set chain length to 2 for the NEXT chain card played, then draw 1 card
  - CW: draw 1 card (same as QP, no chain effect on CW)
  **Critical ruling (Appendix F):** "Chain Anchor itself is NOT a chain link — it sets the next same-chain card's starting length to 2." This means:
  - Chain Anchor does NOT contribute to or extend the current chain counter.
  - Chain Anchor does NOT count as a chain card for chain-type matching purposes.
  - On CC, Chain Anchor sets a flag `chainAnchorActive: true` on encounter state. The NEXT card that increments the chain counter starts from 2 instead of 1.
  - `chainAnchorActive` is consumed (set to false) when any chain card plays next.
  Track `chainAnchorActive` flag in `EncounterState`. In `turnManager.ts`, when a card would start a new chain (chain length 0 → 1), check if `chainAnchorActive` is true — if so, start at 2 instead of 1 and clear the flag.
  Add `MASTERY_UPGRADE_DEFS`: cap=3, perLevelDelta=none (tag-based), L3 bonus tag: CC sets chain to 3 instead of 2.
  **Acceptance:** QP draws 1 card, no chain effect. CC draws 1 card AND next chain card starts at length 2 (3 at L3+). CW draws 1 card, no chain effect. Chain Anchor itself never appears in chain length calculation. `chainAnchorActive` flag persists until consumed by a chain card — it does NOT expire at end of turn.

---

### Exhaust-on-Charge Cards (2)

- [ ] 7. Add Volatile Slash mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/turnManager.ts`
  **What:** Add mechanic `volatile_slash`: type=attack, AP=1, Pool=2, unlockLevel=7.
  - QP: 10 dmg (card stays in discard normally)
  - CC: 30 dmg, then EXHAUST this card
  - CW: 7 dmg (card stays in discard normally)
  "Exhaust-on-Charge" means: on a CC play, after dealing damage, remove this card from the discard pile and place it in the exhaust pile. The card is gone for this combat unless Recollect is used.
  Return a flag `exhaustOnResolve: true` in the `CardEffectResult` for CC plays only. `turnManager.ts` must handle this flag: after resolving the card, if `exhaustOnResolve: true`, move the card from discard to exhaust pile instead of discard.
  **Cursed interaction (Part 6):** A Volatile Slash carrying a cursed fact that is CC'd: resolves at 1.0× (cure happens), THEN exhausts. The cure occurs before exhaust.
  Add `MASTERY_UPGRADE_DEFS`: cap=5, perLevelDelta=+2 dmg. L0→L5 QP: 10→20 dmg. CC always exhausts regardless of mastery level.
  **Acceptance:** QP: 10 dmg, card goes to discard normally. CC: 30 dmg, card moves to exhaust pile (visible in exhaust pile viewer). CW: 7 dmg, card goes to discard. Recollect can retrieve exhausted Volatile Slash. Cursed Volatile Slash CC cures the fact before exhausting.

- [ ] 8. Add Burnout Shield mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/turnManager.ts`
  **What:** Add mechanic `burnout_shield`: type=shield, AP=1, Pool=2, unlockLevel=7.
  - QP: 8 block (card stays in discard normally)
  - CC: 24 block, then EXHAUST this card
  - CW: 5.6 block (rounds to 6 in display, use raw 5.6 for math before rounding)
  Exact mirror of Volatile Slash but for shields. Same `exhaustOnResolve: true` flag on CC. Same `turnManager.ts` handling.
  Add `MASTERY_UPGRADE_DEFS`: cap=5, perLevelDelta=+2 block. L0→L5 QP: 8→18 block. CC always exhausts regardless of mastery.
  **Acceptance:** QP: 8 block, card to discard. CC: 24 block, card exhausts. CW: ~6 block (5.6 rounded), card to discard. Recollect can return exhausted Burnout Shield. Synergizes with Exhaust Loop combo (Volatile Slash + Recollect documented in Part 9 — the same loop works here for the shield version).

---

### Buff Cards (2)

- [ ] 9. Add Warcry mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/turnManager.ts`
  **What:** Add mechanic `warcry`: type=buff, AP=1, Pool=1, unlockLevel=6.
  - QP: +2 Strength this turn (temporary, expires at turn end)
  - CC: +2 Strength PERMANENT (persists rest of combat) + next Charge this turn costs +0 AP surcharge
  - CW: +1 Strength this turn (temporary)
  "Strength" is the existing `strength` status effect that boosts attack damage. Permanent Strength on CC is added as a persistent buff that does NOT expire at turn end.
  "Next Charge this turn costs +0 AP surcharge": Set a flag `warcryFreeChargeActive: true` on the encounter state. The next Charge surcharge (+1 AP cost) this turn is waived. This flag expires at end of turn even if not consumed.
  Add `MASTERY_UPGRADE_DEFS`: cap=3, perLevelDelta=none (tag-based), L3 bonus tag: QP also gives +1 permanent Strength (in addition to the +2 temporary).
  **Acceptance:** QP: player has +2 attack damage for this turn only, no free charge. CC: player has +2 permanent attack damage for rest of combat, and the next Charge this turn has no AP surcharge. CW: +1 temporary Strength. L3 QP: +2 temporary + +1 permanent Strength simultaneously. Warcry CC free-charge flag expires at end of turn if unused.

- [ ] 10. Add Battle Trance mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/turnManager.ts`
  **What:** Add mechanic `battle_trance`: type=buff, AP=1, Pool=1, unlockLevel=7.
  - QP: draw 3 cards, THEN can't play OR Charge more cards this turn
  - CC: draw 3 cards, no restriction
  - CW: draw 2 cards, THEN can't play OR Charge more cards this turn
  **Appendix F ruling:** "On QP/CW: blocks both playing AND Charging for the rest of that turn." The restriction applies IMMEDIATELY after resolving this card. The player can see their hand but cannot tap any card or Charge button for the rest of this turn. The restriction does NOT carry to the next turn.
  Implementation: After resolving Battle Trance QP or CW, set `battleTranceRestriction: true` on encounter state. In the card play input handler and Charge handler, check this flag and block input if true. Clear at turn start.
  Add `MASTERY_UPGRADE_DEFS`: cap=3, perLevelDelta=+1 draw at L3, L3 bonus tag: QP draws 4 instead of 3 (still restricted).
  **Acceptance:** QP: draws 3 cards, no more plays or Charges possible this turn. CC: draws 3 cards, no restriction — player can continue playing cards normally. CW: draws 2 cards, no more plays or Charges. Restriction clears at next turn start. L3 QP: draws 4, still restricted.

---

### Debuff Cards (2)

- [ ] 11. Add Mark of Ignorance mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/turnManager.ts`
  **What:** Add mechanic `mark_of_ignorance`: type=debuff, AP=1, Pool=1, unlockLevel=8.
  - QP: enemy takes +3 FLAT damage from Charged attacks only (2 turns)
  - CC: enemy takes +5 flat damage from Charged attacks (3 turns)
  - CW: enemy takes +2 flat damage from Charged attacks (1 turn)
  Like Curse of Doubt but flat bonus instead of percentage. Companion card — both can be active simultaneously (see Part 9: "Quiz Debuff Stack" combo — a 24 CC Strike with both active = 24×1.5+5 = 41 damage). Apply new status `charge_damage_amp_flat` to enemy.
  `turnManager.ts`: In Charge damage resolution, after applying `charge_damage_amp_percent` multiplication, add `charge_damage_amp_flat` value to the total. Decrement duration at end of enemy turn. Multiple applications refresh to higher value and longer duration (no additive stacking).
  Add `MASTERY_UPGRADE_DEFS`: cap=5, perLevelDelta=+1 flat Charge bonus. L0→L5 QP: +3→+8 flat from Charged attacks.
  **Acceptance:** After Mark of Ignorance QP, next 2 enemy turns Charged attacks deal +3 flat bonus. With BOTH Curse of Doubt CC (+50%) and Mark of Ignorance CC (+5 flat) active, a 24 CC Strike deals 24×1.5+5 = 41 damage. Quick Play attacks are NOT amplified by either debuff.

- [ ] 12. Add Corroding Touch mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `corroding_touch`: type=debuff, AP=0, Pool=2, unlockLevel=7.
  - QP: apply 2 Weakness (1 turn)
  - CC: apply 3 Weakness (2 turns) + 2 Vulnerable (1 turn)
  - CW: apply 1 Weakness (1 turn)
  This is a 0-AP base cost card. HOWEVER, Charging costs +1 AP surcharge (same as all Charge plays — the base AP is 0, but the Charge surcharge is still +1). This is the standard Charge surcharge mechanic — no special casing needed.
  Note from spec: "Charge costs 1 AP surcharge" is just the standard Charge cost, not an extra penalty. At 3 AP pool: QP = 0 AP, Charge = 0 + 1 surcharge = 1 AP.
  Resolver: apply Weakness status to enemy per play mode. On CC also apply Vulnerable.
  Add `MASTERY_UPGRADE_DEFS`: cap=3, perLevelDelta=+1 Weakness duration. L0→L5 QP: 2→5 turns Weakness (cap 3 for balance).
  **Acceptance:** Card costs 0 AP to Quick Play. Charge costs 1 AP (the standard surcharge). QP: 2 Weakness (1t) on enemy. CC: 3 Weakness (2t) + 2 Vulnerable (1t) on enemy. CW: 1 Weakness (1t). Mastery L3 QP: 2 Weakness (4 turns). Pool=2.

---

### Shield / Domain Card (1)

- [ ] 13. Add Knowledge Ward mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `knowledge_ward`: type=shield, AP=1, Pool=1, unlockLevel=6.
  - QP: 4 block per unique domain among the cards currently in hand (at time of play)
  - CC: same calculation × 1.5 (so 6 block per unique domain in hand)
  - CW: same calculation × 0.7 (so 2.8 block per unique domain, rounded)
  "Unique domain in hand" means: count the number of distinct `domain` values across the cards currently visible in the player's hand, INCLUDING Knowledge Ward itself. If the hand has cards from Geography, History, and Science, that's 3 domains = 12 QP block.
  Implementation: `cardEffectResolver.ts` needs access to the current hand's domain list. Add `handDomains?: string[]` to `AdvancedResolveOptions`. Populate this in `turnManager.ts` before resolving Knowledge Ward by collecting `card.domain` values from the hand (deduplicated). Pass into resolver.
  Add `MASTERY_UPGRADE_DEFS`: cap=5, perLevelDelta=+1 per-domain block. L0→L5 QP: 4/domain→9/domain.
  **Acceptance:** With 4 unique domains in hand, QP grants 16 block. CC grants 24 block. CW grants ~11 block. With 1 domain in hand, QP grants 4 block. `handDomains` array is populated at resolve time (snapshot — cards drawn after Knowledge Ward is already resolving do not count).

---

### Wild Cards (4)

- [ ] 14. Add Phase Shift mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/ui/components/CombatHud.svelte`
  **What:** Add mechanic `phase_shift`: type=wild, AP=1, Pool=1, unlockLevel=7.
  - QP: CHOOSE between 8 dmg OR 8 block — triggers MultiChoicePopup
  - CC: 12 dmg AND 12 block (both simultaneously, no choice)
  - CW: CHOOSE between 4 dmg OR 4 block — triggers MultiChoicePopup
  **Appendix F ruling:** "Phase Shift CC vs Iron Wave: intentionally lower CC (12+12 vs 15+15 for Iron Wave CC) — per-play choice mode is the tradeoff."
  QP/CW: show MultiChoicePopup with options "Deal 8 damage" / "Gain 8 block" (QP) or "Deal 4 damage" / "Gain 4 block" (CW). Resolve the chosen effect.
  CC: no popup — resolve both simultaneously (12 dmg + 12 block in a single play).
  Add `MASTERY_UPGRADE_DEFS`: cap=5, perLevelDelta=+2 dmg/block. L0→L5: 8→18 (choose) or 12→22 (both on CC).
  **Acceptance:** QP shows 2-option popup. Player chooses damage or block. Resolves chosen effect only. CC: no popup, deals 12 dmg and grants 12 block simultaneously. CW: popup shows 4/4 options. Choosing damage does not grant block. Choosing block does not deal damage.

- [ ] 15. Add Chameleon mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/turnManager.ts`
  **What:** Add mechanic `chameleon`: type=wild, AP=1, Pool=1, unlockLevel=6.
  - QP: copy last card's effect at 1.0× (its own BASE mechanic values, not the previous card's final resolved value)
  - CC: copy at 1.3× + inherit the last card's chain type
  - CW: copy at 0.7×
  **Appendix F ruling:** "Chameleon/Mimic/Aftershock copy BASE mechanic values, then apply their own multipliers." This means: do NOT copy the previous card's final damage output (which may have been boosted by chain, speed, Empower, etc.). Instead, look up the previous card's `mechanicId`, get its base `quickPlayValue` from `MECHANIC_DEFINITIONS`, and use that as Chameleon's base value at the appropriate multiplier.
  Track `lastPlayedMechanicId: string | null` and `lastPlayedMechanicChainType: string | null` on encounter state. Set these each time any card is played.
  CC chain inheritance: When Chameleon CC is played, set the encounter's chain type to match `lastPlayedMechanicChainType`. This means Chameleon CC counts as the same chain type as the last card for chain-continuation purposes.
  If no last card exists (Chameleon is first card played), QP/CW resolve as 0 damage. CC resolves as 0 with no chain effect. Do not crash.
  Add `MASTERY_UPGRADE_DEFS`: cap=3, perLevelDelta=none (tag-based), L3 bonus tag: QP also inherits chain type (same as CC, but at 1.0×).
  **Acceptance:** QP copies last card's base QP value at 1.0×. CC copies at 1.3× and inherits chain type. CW copies at 0.7×. With Empower active on a previous Strike (base 8 QP), Chameleon QP = 8×1.0 = 8 (NOT 8×1.5 — it copies base, not the empowered value). If no last card, resolves as 0 gracefully.

- [ ] 16. Add Dark Knowledge mechanic definition and resolver
  **Files:** `src/data/mechanics.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`
  **What:** Add mechanic `dark_knowledge`: type=wild, AP=1, Pool=1, unlockLevel=8.
  - QP: deal 3 dmg per cursed fact currently in `runState.cursedFactIds`
  - CC: deal 5 dmg per cursed fact
  - CW: deal 1 dmg per cursed fact
  **Appendix F ruling:** "Dark Knowledge counts cursed facts at play time (snapshot), not at resolve time." Pass the cursed fact count into the resolver via `AdvancedResolveOptions`. Add `cursedFactCount?: number` to `AdvancedResolveOptions`. Populate this in `turnManager.ts` from `runState.cursedFactIds.size` at the moment Dark Knowledge is played.
  The damage does NOT cure any cursed facts. This is intentional — Dark Knowledge weaponizes curses without resolving them. Dark Knowledge QP at 3 cursed facts = 9 dmg. At 5 cursed facts = 15 dmg.
  Min damage: 0 (if no cursed facts). This card is entirely blank with no curses — valid for niche "curse-as-weapon" builds.
  Add `MASTERY_UPGRADE_DEFS`: cap=5, perLevelDelta=+1 per-curse dmg. L0→L5 QP: 3/curse→8/curse.
  **Acceptance:** With 3 cursed facts, QP deals 9 dmg. CC deals 15 dmg. CW deals 3 dmg. With 0 cursed facts, all modes deal 0 dmg. Damage DOES NOT cure cursed facts — `cursedFactIds` is unchanged after Dark Knowledge resolves. `cursedFactCount` is snapshotted at play time.

- [ ] 17. Add Chain Anchor mechanic definition and resolver
  **Note:** Chain Anchor is listed under "Chain Cards" as TODO #6. Do not duplicate — this task slot is reserved. Advance to the next numbered task.

---

### Integration Tasks

- [ ] 17. Add all Phase 2 card mechanics to the unlock level registry
  **Files:** `src/data/mechanics.ts` (or wherever unlockLevel is stored), `src/data/characterLevel.ts`
  **What:** Verify all 16 mechanic definitions have the correct `unlockLevel` values per Part 5 of the expansion spec:
  - unlockLevel 6: `gambit`, `curse_of_doubt`, `unstable_flux`, `chameleon`, `knowledge_ward`
  - unlockLevel 7: `volatile_slash`, `burnout_shield`, `battle_trance`, `phase_shift`, `corroding_touch`
  - unlockLevel 8: `chain_lightning`, `dark_knowledge`, `mark_of_ignorance`
  - unlockLevel 9: `chain_anchor`
  Confirm `getUnlockedMechanics(level)` (implemented in AR-205) returns each mechanic at the correct level threshold.
  **Acceptance:** `getUnlockedMechanics(5)` does NOT include any Phase 2 card. `getUnlockedMechanics(6)` includes Gambit, Curse of Doubt, Unstable Flux, Chameleon, Knowledge Ward. `getUnlockedMechanics(9)` includes all 16 Phase 2 cards.

- [ ] 18. Add all Phase 2 MASTERY_UPGRADE_DEFS entries
  **Files:** `src/services/cardUpgradeService.ts` (wherever `MASTERY_UPGRADE_DEFS` lives)
  **What:** Verify every Phase 2 mechanic has a complete mastery definition. Cross-reference against §3I of the expansion spec. Required fields per entry: `mechanicId`, `maxMasteryLevel` (cap), `perLevelDelta`, `secondaryPerLevelDelta` (if applicable), `apCostReductionAtLevels` (if any), `addTagAtLevel` (for L3 bonus tags).
  Summary of caps and L3 bonus tags from §3I:
  - `gambit`: cap=5, +2 dmg/level, L3: self-dmg -1
  - `chain_lightning`: cap=5, +1 base dmg/level (multiplied by chain length on CC)
  - `volatile_slash`: cap=5, +2 dmg/level (still exhausts on CC)
  - `burnout_shield`: cap=5, +2 block/level (still exhausts on CC)
  - `knowledge_ward`: cap=5, +1 per-domain block/level
  - `warcry`: cap=3, tag-based, L3: QP also +1 permanent Str
  - `battle_trance`: cap=3, +1 draw at L3, L3: QP draws 4
  - `curse_of_doubt`: cap=5, +5% Charge damage bonus/level
  - `mark_of_ignorance`: cap=5, +1 flat Charge bonus/level
  - `corroding_touch`: cap=3, +1 Weakness duration/level
  - `phase_shift`: cap=5, +2 dmg/block per level
  - `chameleon`: cap=3, tag-based, L3: QP also inherits chain type
  - `dark_knowledge`: cap=5, +1 per-curse dmg/level
  - `chain_anchor`: cap=3, tag-based, L3: CC sets chain to 3 instead of 2
  - `unstable_flux`: cap=3, tag-based, L3: QP shows 2 random options to choose from
  **Acceptance:** `getMasteryBaseBonus('gambit', 5)` returns +10 (5 levels × +2). `getMasteryBaseBonus('chain_lightning', 3)` returns +3. L3 bonus tags fire at mastery level 3 for all capped-3 cards.

- [ ] 19. Update inspection registry
  **Files:** `data/inspection-registry.json`
  **What:** Add entries for all 16 new mechanic IDs to the `cards` table (or whichever table tracks card mechanics). Set for each:
  - `mechanicId`: the mechanic's ID string
  - `lastChangedDate`: today (2026-03-21)
  - `mechanicInspectionDate`: `"not_checked"`
  - `visualInspectionDate_portraitMobile`: `"not_checked"`
  - `visualInspectionDate_landscapeMobile`: `"not_checked"`
  - `visualInspectionDate_landscapePC`: `"not_checked"`
  - `uxReviewDate`: `"not_checked"`
  Also add an entry for the new `MultiChoicePopup` component to the `screens` or `systems` table.
  Also add entries for the 2 new enemy status effect types: `charge_damage_amp_percent` (Curse of Doubt) and `charge_damage_amp_flat` (Mark of Ignorance) to the `statusEffects` table.
  **Acceptance:** Registry has 16 new mechanic entries + MultiChoicePopup + 2 new status effect entries. All dated 2026-03-21.

- [ ] 20. Run headless sim validation — Phase 2 baseline
  **Files:** `tests/playtest/headless/run-batch.ts`
  **What:** Run the headless sim focusing on the build archetypes that rely on Phase 2 cards. Execute:
  ```
  npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500 --profile chain
  npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500 --profile quiz_master
  npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500 --profile curse_weaponizer
  npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500
  ```
  Verify (per Part 2 Phase 2 validation gate):
  - No crashes across 2000 total runs
  - Chain Lightning scales with chain length (CC damage must increase with chain count)
  - Gambit HP swing: CC heals player, CW damages player (verified in run logs)
  - Dark Knowledge damage scales with cursed fact count
  - Exhaust piles grow when Volatile Slash / Burnout Shield are Charged
  - No degenerate combo breaks the sim (win rate capped below 95% for non-god profiles)
  Report: save sim output to `data/playtests/reports/ar207-phase2-baseline.json` if the batch runner supports a `--output` flag. Otherwise record results in this AR.
  **Acceptance:** 0 crashes. Chain Lightning CC damage > Chain Lightning QP damage in chain builds. Gambit CC shows negative `selfDamage` and positive `healApplied` in result objects. All 6 profiles complete runs without errors.

- [ ] 21. Visual verification — Phase 2 cards in combat
  **Files:** `src/ui/components/CombatHud.svelte`, `src/ui/components/MultiChoicePopup.svelte`
  **What:** Using Playwright MCP (`mcp__playwright__browser_take_screenshot`):
  1. Navigate to `http://localhost:5173?skipOnboarding=true&devpreset=post_tutorial`
  2. Load combat scenario: `window.__terraScenario.load('combat-basic')`
  3. Disable animations: `document.documentElement.setAttribute('data-pw-animations', 'disabled')`
  4. Verify a Phase Shift card (or Unstable Flux) triggers the MultiChoicePopup when QP'd — screenshot the popup
  5. Verify a Volatile Slash CC moves to exhaust pile — screenshot the exhaust pile state
  6. Verify Gambit CC shows heal effect — screenshot the player HP before/after
  7. Verify Chain Lightning CC damage number reflects chain length × 8 in combat log
  8. Check browser console for errors: `mcp__playwright__browser_console_messages`
  NEVER use `page.screenshot()` via `browser_run_code` — use the MCP `browser_take_screenshot` tool only.
  **Acceptance:** Screenshots show MultiChoicePopup rendering correctly at mobile portrait width. No JavaScript errors in console. Exhaust pile contains Volatile Slash after CC play. Player HP shows heal after Gambit CC. No visual regressions on existing combat UI elements.

- [ ] 22. Run full unit test suite
  **Files:** `tests/` (all)
  **What:** Run `npx vitest run` after all implementations are complete. All 1900+ tests must pass. If any existing test breaks due to the new `AdvancedResolveOptions` fields (`handDomains`, `cursedFactCount`) or new encounter state flags (`chainAnchorActive`, `battleTranceRestriction`, `warcryFreeChargeActive`), update the relevant test fixtures to include the new fields with safe defaults (empty array, 0, false).
  **Acceptance:** `npx vitest run` exits with 0 failures. No regressions in existing test coverage.

- [ ] 23. Update GAME_DESIGN.md and ARCHITECTURE.md
  **Files:** `docs/GAME_DESIGN.md`, `docs/ARCHITECTURE.md`
  **What:**
  In `GAME_DESIGN.md`:
  - Update active mechanic count to reflect Phase 2 additions (was Phase 1 count + 16)
  - Add a section describing the Phase 2 card archetypes: Quiz-Reward Flagships, Chain Scaling, Exhaust-on-Charge, Quiz Debuffs, Domain-Aware Wilds
  - Document new status effects: `charge_damage_amp_percent` (Curse of Doubt) and `charge_damage_amp_flat` (Mark of Ignorance)
  - Document the `exhaustOnResolve` flag and how it interacts with Recollect
  - Document the `chainAnchorActive` encounter state flag and Chain Anchor's non-link ruling
  In `ARCHITECTURE.md`:
  - Add `MultiChoicePopup.svelte` to the UI component registry
  - Document the new `AdvancedResolveOptions` fields: `handDomains`, `cursedFactCount`
  - Document the new encounter state flags: `chainAnchorActive`, `battleTranceRestriction`, `warcryFreeChargeActive`, `lastPlayedMechanicId`, `lastPlayedMechanicChainType`
  **Acceptance:** Both docs updated. `GAME_DESIGN.md` mechanic count is accurate. All new encounter state fields are documented. MultiChoicePopup is in the component registry.

---

## Files Affected

| File | Change Type | Notes |
|------|------------|-------|
| `src/data/mechanics.ts` | Modified | Add 16 new `MechanicDefinition` entries |
| `src/services/cardUpgradeService.ts` | Modified | Add 16 `MASTERY_UPGRADE_DEFS` entries |
| `src/services/cardEffectResolver.ts` | Modified | Add resolver cases for all 16 mechanics. Add `handDomains`, `cursedFactCount` to `AdvancedResolveOptions`. Add `exhaustOnResolve` to `CardEffectResult`. |
| `src/services/turnManager.ts` | Modified | Handle `exhaustOnResolve` flag. Add `chainAnchorActive`, `battleTranceRestriction`, `warcryFreeChargeActive`, `lastPlayedMechanicId`, `lastPlayedMechanicChainType` to encounter state. Apply `charge_damage_amp_percent` and `charge_damage_amp_flat` in Charge damage path. Populate `handDomains` for Knowledge Ward. Populate `cursedFactCount` for Dark Knowledge. |
| `src/ui/components/MultiChoicePopup.svelte` | New | Shared choice popup for Phase Shift and Unstable Flux |
| `src/ui/components/CombatHud.svelte` | Modified | Wire in `MultiChoicePopup`. Show when a card resolves a `multiChoiceRequired` result. |
| `data/inspection-registry.json` | Modified | Add 16 mechanics + MultiChoicePopup + 2 new status effect types |
| `docs/GAME_DESIGN.md` | Modified | Mechanic count update, Phase 2 archetypes section, new status types |
| `docs/ARCHITECTURE.md` | Modified | MultiChoicePopup in component registry, new encounter state fields |

---

## Appendix F Rulings That Affect This Phase (Required Reading)

These rulings from `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md` Appendix F are AUTHORITATIVE. Implement exactly as written — no deviations.

| Card | Ruling | Implementation Note |
|------|--------|-------------------|
| Chain Lightning | Counts itself — extends chain THEN uses new length for damage | Increment chain counter BEFORE computing `8 × chain length` |
| Chain Lightning + Null Shard | Chain length floors at 1; works as basic 8-dmg attack (multiplier = 1.0×) | Check `null_shard` relic in resolver |
| Chain Anchor | NOT a chain link — sets next chain's starting length to 2; Anchor itself never counted | `chainAnchorActive` flag, does NOT increment chain counter |
| Phase Shift CC vs Iron Wave | Intentionally lower CC (12+12 vs 15+15) — choice is the tradeoff | Do not "fix" this to match Iron Wave |
| Battle Trance restriction | QP/CW: blocks BOTH playing AND Charging for rest of that turn | Block card play input AND Charge button |
| Chameleon/Mimic/Aftershock copy | Copy BASE mechanic values, apply their own multipliers | Do NOT copy final resolved damage |
| Dark Knowledge timing | Counts cursed facts at PLAY TIME (snapshot) | Snapshot `cursedFactIds.size` at play, not resolve |
| Corroding Touch Charge | Standard 1 AP Charge surcharge — no extra penalty | AP=0 base, +1 surcharge = 1 AP total for Charge |
| Battle Trance restriction | Does NOT carry to next turn | Clear `battleTranceRestriction` at turn start |
| Volatile Slash / Burnout Shield + Cursed | Cursed CC: resolves at 1.0× (cure happens), THEN exhausts | Cure before exhaust in resolution order |
| Warcry free-Charge flag | Expires at end of turn even if unused | Clear `warcryFreeChargeActive` at turn end |

---

## Verification Gate

Before marking AR-207 complete, ALL of the following must be true:

- [ ] `npx vitest run` — 0 failures
- [ ] `npm run typecheck` — 0 TypeScript errors
- [ ] `npm run build` — clean build, no warnings about missing properties
- [ ] Headless sim: 2000 runs across 4 profiles with 0 crashes (task 20)
- [ ] Headless sim: Chain Lightning CC damage scales with chain length (verified in output)
- [ ] Headless sim: Gambit CC shows heal, CW shows self-damage (verified in output)
- [ ] Visual: MultiChoicePopup renders and is functional at portrait mobile width
- [ ] Visual: No JavaScript console errors on combat screen with Phase 2 cards
- [ ] Visual: Exhaust pile shows Volatile Slash / Burnout Shield after CC plays
- [ ] All 16 mechanics appear in the card pool at appropriate unlock levels
- [ ] All 16 mechanics have `MASTERY_UPGRADE_DEFS` entries with correct caps
- [ ] `data/inspection-registry.json` updated with all 16 new mechanic entries
- [ ] `docs/GAME_DESIGN.md` mechanic count updated and Phase 2 archetypes documented
- [ ] `docs/ARCHITECTURE.md` reflects new encounter state fields and MultiChoicePopup

Move this document to `docs/roadmap/completed/` when all checkboxes above pass.
