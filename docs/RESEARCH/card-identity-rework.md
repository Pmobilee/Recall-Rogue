# Card Identity Rework

Every card name and description reviewed for: STS naming conflicts, player readability, study/knowledge theme fit, and artwork match.

## Principles

1. **One sentence max** for card face text — "Deal 8 damage." not "8 dmg"
2. **No abbreviations** — spell out damage, block. No CC:/QP:/CW: labels
3. **No percentages or formulas** — say "low HP" not "<30%"
4. **Study/knowledge theme** — names should evoke learning where possible
5. **Match the artwork** — name makes sense given what the art depicts
6. **Short names** — 1-2 words, 3 max

## Status Legend

- 🔴 RENAME — direct STS copy or theme mismatch, must change
- 🟡 RENAME OPTIONAL — works but could be more thematic
- ✅ KEEP — name works well
- ⚠️ FIX DESC — card face text needs rewriting

---

## Attack Cards

| # | id | Current Name | Status | Proposed Name | Current Face Text | Proposed Face Text |
|---|---|---|---|---|---|---|
| 1 | `strike` | Strike | ✅ KEEP | Strike | `Deal {power}` | `Deal {power} damage` |
| 2 | `multi_hit` | Multi-Hit | ✅ KEEP | Multi-Hit | `{hits}× {power} dmg` | `Hit {hits} times for {power} each` |
| 3 | `heavy_strike` | Heavy Strike | ✅ KEEP | Heavy Strike | `Deal {power}` | `Deal {power} damage` |
| 4 | `piercing` | Piercing | 🟡 RENAME OPTIONAL | Insight | `{power} pierce` | `Pierce for {power}, ignoring block` |
| 5 | `reckless` | Reckless | ✅ KEEP | Reckless | `{power} dmg, {self} self` | `Deal {power}, take {self} damage` |
| 6 | `execute` | Execute | 🟡 RENAME OPTIONAL | Final Exam | `{power}+{eb} <{pct}%` | `Deal {power}, bonus if enemy is wounded` |
| 7 | `lifetap` | Lifetap | ✅ KEEP | Lifetap | `{power} drain` | `Deal {power}, drain life` |
| 8 | `power_strike` | Power Strike | ✅ KEEP | Power Strike | `Deal {power}` | `Deal {power} damage` |
| 9 | `twin_strike` | Twin Strike | 🔴 RENAME | Dual Focus | `{hits}× {power} dmg` | `Hit twice for {power} each` |
| 10 | `iron_wave` | Iron Wave | 🔴 RENAME | Counterstrike | `{power} dmg +{sec} blk` | `Deal {power}, gain {sec} block` |
| 11 | `bash` | Bash | 🔴 RENAME | Daze | `{power} dmg +Vuln` | `Deal {power}, apply Exposed` |
| 12 | `rupture` | Rupture | 🔴 RENAME | Fracture | `{power} dmg +{bleed} L.Doubt` | `Deal {power}, apply {bleed} Lingering Doubt` |
| 13 | `lacerate` | Lacerate | ✅ KEEP | Lacerate | `{power} dmg +{bleed} L.Doubt` | `Deal {power}, apply {bleed} Lingering Doubt` |
| 14 | `kindle` | Kindle | ✅ KEEP | Kindle | `{power} dmg +{burn} B.Burn▶` | `Deal {power}, apply {burn} Brain Burn` |
| 15 | `overcharge` | Overcharge | ✅ KEEP | Overcharge | `{power} / CC×charges` | `Deal {power}, scales with charges` |
| 16 | `riposte` | Riposte | ✅ KEEP | Riposte | `{power} dmg +{sec} blk` | `Deal {power}, gain {sec} block` |
| 17 | `precision_strike` | Precision Strike | ✅ KEEP | Precision Strike | `Deal 8×options` | `Deal {power} per answer option` |
| 18 | `siphon_strike` | Siphon Strike | ✅ KEEP | Siphon Strike | `{power} drain` | `Deal {power}, drain life` |
| 19 | `chain_lightning` | Chain Lightning | ✅ KEEP | Chain Lightning | `{power} × chain (CC)` | `Deal {power} per chain link` |
| 20 | `volatile_slash` | Volatile Slash | ✅ KEEP | Volatile Slash | `{power} / CC+Forget` | `Deal {power}, consumed on correct charge` |
| 21 | `gambit` | Gambit | ✅ KEEP | Gambit | `CC:+{power}hp / QP:-hp` | `Risk: deal damage and swing HP` |
| 22 | `smite` | Smite | ✅ KEEP | Smite | `7+CC×Aura dmg` | `Deal {power}, scales with aura` |
| 23 | `feedback_loop` | Feedback Loop | ✅ KEEP | Feedback Loop | `CC: 28/40 dmg` | `Deal {power}, scales with flow` |
| 24 | `recall` | Recall | ✅ KEEP | Recall | `10/20/30 dmg` | `Deal {power}, bonus on review` |
| 25 | `hemorrhage` | Hemorrhage | 🟡 RENAME OPTIONAL | Hemorrhage | `{power}+{mult}×L.Doubt` | `Deal {power} plus Lingering Doubt multiplier` |
| 26 | `eruption` | Eruption | 🔴 RENAME | Outburst | `{dpa} dmg/AP (X)` | `Spend all AP, deal {dpa} per AP spent` |
| 27 | `aftershock` | Aftershock | 🔴 RENAME | Echo Strike | `Echo {pct}% / CC>` | `Repeat last card at {pct}% power` |
| 28 | `knowledge_bomb` | Knowledge Bomb | ✅ KEEP | Knowledge Bomb | `CC: {per}×charges` | `Deal {per} per correct charge this encounter` |

---

## Shield Cards

| # | id | Current Name | Status | Proposed Name | Current Face Text | Proposed Face Text |
|---|---|---|---|---|---|---|
| 29 | `block` | Block | ✅ KEEP | Block | `Gain {power}` | `Gain {power} block` |
| 30 | `thorns` | Thorns | 🔴 RENAME | Briar | `Gain {power}, refl {thorn}` | `Gain {power} block, reflect {thorn} damage` |
| 31 | `emergency` | Emergency | ✅ KEEP | Emergency | `Gain {power} ×2<30%` | `Gain {power} block, doubled if wounded` |
| 32 | `fortify` | Entrench | 🔴 RENAME | Fortify | `50% block` | `Gain block equal to half your current block` |
| 33 | `brace` | Brace | ✅ KEEP | Brace | `Match telegraph` | `Block equal to enemy intent` |
| 34 | `overheal` | Overheal | ✅ KEEP | Overheal | `Gain {power} ×2<50%` | `Gain {power} block, doubled if wounded` |
| 35 | `parry` | Parry | ✅ KEEP | Parry | `Gain {power}, draw` | `Gain {power} block, draw a card` |
| 36 | `reinforce` | Reinforce | ✅ KEEP | Reinforce | `Gain {power}` | `Gain {power} block` |
| 37 | `shrug_it_off` | Shrug It Off | 🔴 RENAME | Brush Off | `{power} blk +draw` | `Gain {power} block, draw a card` |
| 38 | `guard` | Guard | ✅ KEEP | Guard | `Gain {power}` | `Gain {power} block` |
| 39 | `absorb` | Absorb | ✅ KEEP | Absorb | `{power} blk, CC+draw` | `Gain {power} block` |
| 40 | `reactive_shield` | Reactive Shield | ✅ KEEP | Reactive Shield | `{power} blk +{thorns}▸` | `Gain {power} block and thorns` |
| 41 | `aegis_pulse` | Aegis Pulse | ✅ KEEP | Aegis Pulse | `{power} blk, CC+chain` | `Gain {power} block, boost chain` |
| 42 | `burnout_shield` | Burnout Shield | ✅ KEEP | Burnout Shield | `{power} / CC+Forget` | `Gain {power} block, consumed on correct charge` |
| 43 | `knowledge_ward` | Knowledge Ward | ✅ KEEP | Knowledge Ward | `Gain ×charges` | `Block scales with correct charges` |
| 44 | `bulwark` | Bulwark | ✅ KEEP | Bulwark | `{power} / CC+Forget` | `Gain {power} block, consumed on correct charge` |
| 45 | `ironhide` | Ironhide | ✅ KEEP | Ironhide | `{power} blk +{str} Str` | `Gain {power} block and Strength` |
| 46 | `conversion` | Shield Bash | 🔴 RENAME | Redirect | `Deal Block as dmg` | `Deal your current block as damage` |

---

## Buff Cards

| # | id | Current Name | Status | Proposed Name | Current Face Text | Proposed Face Text |
|---|---|---|---|---|---|---|
| 47 | `empower` | Empower | ✅ KEEP | Empower | `Next +{power}%` | `Next card deals {power}% more damage` |
| 48 | `quicken` | Quicken | ✅ KEEP | Quicken | `+1 AP` | `Gain 1 action point` |
| 49 | `focus` | Focus | ✅ KEEP | Focus | `Next −1 AP` | `Next card costs 1 less AP` |
| 50 | `double_strike` | Double Strike | 🔴 RENAME | Double Down | `2× {pct}% power` | `Next attack hits twice` |
| 51 | `warcry` | Warcry | 🔴 RENAME | Rally | `+{str} Str / CC perm` | `Gain Strength, permanent on correct charge` |
| 52 | `battle_trance` | Battle Trance | 🔴 RENAME | Flow State | `Draw {draw} +lock` | `Draw {draw}, then end your actions` |
| 53 | `frenzy` | Frenzy | 🟡 RENAME OPTIONAL | Overdrive | `Next {n} free` | `Next {n} cards cost no AP` |
| 54 | `mastery_surge` | Mastery Surge | ✅ KEEP | Mastery Surge | `+1 mastery ×{n}` | `Upgrade {n} cards this combat` |
| 55 | `war_drum` | War Drum | 🟡 RENAME OPTIONAL | Tempo | `Hand +{bonus} this turn` | `All cards gain {bonus} power this turn` |
| 56 | `ignite` | Ignite | ✅ KEEP | Ignite | `Next +{burn} B.Burn` | `Next attack applies {burn} Brain Burn` |
| 57 | `catalyst` | Catalyst | ✅ KEEP | Catalyst | `Double Doubt (CC+B.Burn)` | `Double all Drawing Blanks` |
| 58 | `sacrifice` | Sacrifice | 🟡 RENAME OPTIONAL | Sacrifice | `-5HP: draw 2+AP` | `Lose 5 HP, draw 2, gain AP` |
| 59 | `forge` | Forge | ✅ KEEP | Forge | `Forge +{amt} mastery` | `Upgrade a card by {amt} mastery` |
| 60 | `inscription_fury` | Inscription of Fury | ✅ KEEP | Inscription of Fury | `+{power} dmg all atk` | `All attacks deal {power} bonus damage` |
| 61 | `inscription_iron` | Inscription of Iron | ✅ KEEP | Inscription of Iron | `+{power} blk/turn` | `Gain {power} block at the start of each turn` |
| 62 | `inscription_wisdom` | Inscription of Wisdom | ✅ KEEP | Inscription of Wisdom | `+1 draw/CC` | `Draw extra on each correct charge` |

---

## Debuff Cards

| # | id | Current Name | Status | Proposed Name | Current Face Text | Proposed Face Text |
|---|---|---|---|---|---|---|
| 63 | `weaken` | Weaken | 🔴 RENAME | Befuddle | `Weak {power}` | `Apply {power} Weakness` |
| 64 | `expose` | Expose | ✅ KEEP | Expose | `Vuln {power}` | `Apply {power} Exposed` |
| 65 | `hex` | Hex | ✅ KEEP | Hex | `Doubt {power}×{turns}` | `Apply {power} Drawing Blanks` |
| 66 | `slow` | Slow | 🔴 RENAME | Impede | `Skip action` | `Skip enemy action` |
| 67 | `stagger` | Stagger | ✅ KEEP | Stagger | `Skip action` | `Skip enemy action` |
| 68 | `corrode` | Corrode | ✅ KEEP | Corrode | `Strip blk +Weak` | `Strip enemy block, apply Weakness` |
| 69 | `corroding_touch` | Corroding Touch | ✅ KEEP | Corroding Touch | `{stacks} Weak (free)` | `Apply Weakness for free` |
| 70 | `curse_of_doubt` | Curse of Doubt | ✅ KEEP | Curse of Doubt | `+{pct}% chg dmg` | `Charged attacks deal {pct}% more damage` |
| 71 | `mark_of_ignorance` | Mark of Ignorance | ✅ KEEP | Mark of Ignorance | `+{flat} flat/chg` | `Charged attacks deal {flat} bonus damage` |
| 72 | `entropy` | Entropy | ✅ KEEP | Entropy | `{burn}B.Burn +{poison}Doubt` | `Apply {burn} Brain Burn and {poison} Drawing Blanks` |
| 73 | `lacerate` | Lacerate | ✅ KEEP | Lacerate | (see Attack #13) | (see Attack #13) |
| 74 | `sap` | Sap | 🔴 RENAME | Undercut | `{power} dmg +Weak` | `Deal {power}, apply Weakness` |

---

## Utility Cards

| # | id | Current Name | Status | Proposed Name | Current Face Text | Proposed Face Text |
|---|---|---|---|---|---|---|
| 75 | `scout` | Scout | ✅ KEEP | Scout | `Draw {draw}` | `Draw {draw} cards` |
| 76 | `recycle` | Recycle | 🔴 RENAME | Revise | `Draw 3` | `Draw 3 cards` |
| 77 | `foresight` | Foresight | ✅ KEEP | Foresight | `Draw {draw}` | `Draw {draw} cards` |
| 78 | `cleanse` | Cleanse | ✅ KEEP | Cleanse | `Purge` | `Remove all debuffs` |
| 79 | `sift` | Sift | ✅ KEEP | Sift | `Scry {scry}` | `Look at top {scry} cards` |
| 80 | `scavenge` | Scavenge | ✅ KEEP | Scavenge | `Recover 1` | `Recover a discarded card` |
| 81 | `swap` | Swap | ✅ KEEP | Swap | `Cycle 1→{draws}` | `Discard 1, draw {draws}` |
| 82 | `transmute` | Transmute | ✅ KEEP | Transmute | `Transform` | `Transform this card` |
| 83 | `immunity` | Immunity | ✅ KEEP | Immunity | `Absorb next` | `Absorb next hit` |
| 84 | `archive` | Archive | ✅ KEEP | Archive | `Retain {n}` | `Retain {n} cards in hand at turn end` |
| 85 | `reflex` | Reflex | ✅ KEEP | Reflex | `Draw {draw} +passive` | `Draw {draw}, passive block when discarded` |
| 86 | `recollect` | Recollect | ✅ KEEP | Recollect | `Return {n} forget` | `Return {n} forgotten cards` |
| 87 | `synapse` | Synapse | ✅ KEEP | Synapse | `Draw {draw} / CC+chain` | `Draw {draw}, extend chain on correct charge` |
| 88 | `siphon_knowledge` | Siphon Knowledge | ✅ KEEP | Siphon Knowledge | `Draw {draw} +preview` | `Draw {draw}, preview answers briefly` |
| 89 | `tutor` | Tutor | ✅ KEEP | Tutor | `Search & add` | `Search and add a card to hand` |
| 90 | `conjure` | Conjure | ✅ KEEP | Conjure | `Summon {n}` | `Summon {n} cards to hand` |

---

## Wild Cards

| # | id | Current Name | Status | Proposed Name | Current Face Text | Proposed Face Text |
|---|---|---|---|---|---|---|
| 91 | `mirror` | Mirror | ✅ KEEP | Mirror | `Copy last` | `Copy last card played` |
| 92 | `adapt` | Adapt | ✅ KEEP | Adapt | `Smart` | `Auto-pick best action` |
| 93 | `overclock` | Overclock | ✅ KEEP | Overclock | `2× effect` | `Double next card effect` |
| 94 | `phase_shift` | Phase Shift | ✅ KEEP | Phase Shift | `{power} dmg OR blk` | `Deal {power} damage or gain {power} block` |
| 95 | `chameleon` | Chameleon | ✅ KEEP | Chameleon | `Copy last` | `Copy last card effect` |
| 96 | `dark_knowledge` | Dark Knowledge | ✅ KEEP | Dark Knowledge | `{per} dmg/curse` | `Deal {per} per cursed card` |
| 97 | `chain_anchor` | Chain Anchor | ✅ KEEP | Chain Anchor | `Draw {draws} / CC→2` | `Draw {draws}, boost chain on correct charge` |
| 98 | `unstable_flux` | Unstable Flux | ✅ KEEP | Unstable Flux | `Random / CC: choose` | `Random effect, or choose on correct charge` |
| 99 | `sacrifice` | Sacrifice | (see Buff #58) | — | (see Buff #58) | (see Buff #58) |
| 100 | `catalyst` | Catalyst | (see Buff #57) | — | (see Buff #57) | (see Buff #57) |
| 101 | `mimic` | Mimic | ✅ KEEP | Mimic | `Replay disc {pct}%` | `Replay a discarded card` |
| 102 | `aftershock` | Aftershock | 🔴 RENAME | Echo Strike | `Echo {pct}% / CC>` | `Repeat last card at {pct}% power` |
| 103 | `knowledge_bomb` | Knowledge Bomb | (see Wild section above — listed as attack-type in code but categorized wild in mechanic) | — | — | — |

---

## Notes on Duplicate Entries

- `lacerate` (id) — listed in mechanics.ts under type `debuff`, but behaves as an attack (deal damage + apply bleed). Appears in both Attack and Debuff sections above for completeness.
- `sap` (id) — listed under type `debuff` in mechanics.ts. Included in Debuff table.
- `sacrifice` and `catalyst` — type `wild` in mechanics.ts. Listed in Wild table; Buff section references them because the orchestrator's research placed them there. Source of truth: both are type `wild`.
- `aftershock` — type `wild` in mechanics.ts. Listed in Wild table; the Attack section reference above reflects the orchestrator's proposed rename "Echo Strike."

---

## Full Rename List (Deduplicated)

| id | Old Name | New Name | Reason |
|---|---|---|---|
| `twin_strike` | Twin Strike | Dual Focus | Direct STS copy |
| `iron_wave` | Iron Wave | Counterstrike | Direct STS copy |
| `bash` | Bash | Daze | STS "Bash" — deal damage + apply Vulnerable |
| `rupture` | Rupture | Fracture | STS "Rupture" — bleed applicator |
| `sap` | Sap | Undercut | STS-adjacent; study theme (undermine) |
| `eruption` | Eruption | Outburst | STS "Eruption" — X-cost attack |
| `aftershock` | Aftershock | Echo Strike | STS "Aftershock" — repeat last card |
| `fortify` | Entrench | Fortify | STS "Entrench"; use the mechanic id instead |
| `shrug_it_off` | Shrug It Off | Brush Off | STS "Shrug It Off" |
| `conversion` | Shield Bash | Redirect | Describe behavior (energy redirect), not animation |
| `double_strike` | Double Strike | Double Down | STS-adjacent; study: doubling down |
| `warcry` | Warcry | Rally | STS "Warcry" |
| `battle_trance` | Battle Trance | Flow State | STS "Battle Trance"; study: flow state = peak learning |
| `weaken` | Weaken | Befuddle | STS "Weaken"; necromancer-in-graduation-cap art perfect for theme |
| `slow` | Slow | Impede | STS "Slow" |
| `recycle` | Recycle | Revise | STS "Recycle"; study: revision |
| `thorns` | Thorns | Briar | STS "Thorns" |

---

## Full Description Fixes (All Cards)

Cards where the current face text uses abbreviations, mode labels, or unclear syntax — proposed rewrites shown.

### Attack

| id | Current | Proposed |
|---|---|---|
| `multi_hit` | `{hits}× {power} dmg` | `Hit {hits} times for {power} each` |
| `piercing` | `{power} pierce` | `Pierce for {power}, ignoring block` |
| `reckless` | `{power} dmg, {self} self` | `Deal {power}, take {self} damage` |
| `execute` | `{power}+{eb} <{pct}%` | `Deal {power}, bonus if enemy is wounded` |
| `lifetap` | `{power} drain` | `Deal {power}, drain life` |
| `twin_strike` | `{hits}× {power} dmg` | `Hit twice for {power} each` |
| `iron_wave` | `{power} dmg +{sec} blk` | `Deal {power}, gain {sec} block` |
| `bash` | `{power} dmg +Vuln` | `Deal {power}, apply Exposed` |
| `rupture` | `{power} dmg +{bleed} L.Doubt` | `Deal {power}, apply {bleed} Lingering Doubt` |
| `lacerate` | `{power} dmg +{bleed} L.Doubt` | `Deal {power}, apply {bleed} Lingering Doubt` |
| `kindle` | `{power} dmg +{burn} B.Burn▶` | `Deal {power}, apply {burn} Brain Burn` |
| `overcharge` | `{power} / CC×charges` | `Deal {power}, scales with charges` |
| `riposte` | `{power} dmg +{sec} blk` | `Deal {power}, gain {sec} block` |
| `siphon_strike` | `{power} drain` | `Deal {power}, drain life` |
| `chain_lightning` | `{power} × chain (CC)` | `Deal {power} per chain link` |
| `volatile_slash` | `{power} / CC+Forget` | `Deal {power}, consumed on correct charge` |
| `gambit` | `CC:+{power}hp / QP:-hp` | `Risk: deal damage and swing HP` |
| `smite` | `7+CC×Aura dmg` | `Deal {power}, scales with aura` |
| `feedback_loop` | `CC: 28/40 dmg` | `Deal {power}, scales with flow` |
| `recall` | `10/20/30 dmg` | `Deal {power}, bonus on review` |
| `hemorrhage` | `{power}+{mult}×L.Doubt` | `Deal {power} plus Lingering Doubt multiplier` |
| `eruption` | `{dpa} dmg/AP (X)` | `Spend all AP, deal {dpa} per AP spent` |
| `precision_strike` | `Deal 8×options` | `Deal {power} per answer option` |
| `aftershock` | `Echo {pct}% / CC>` | `Repeat last card at {pct}% power` |
| `knowledge_bomb` | `CC: {per}×charges` | `Deal {per} per correct charge this encounter` |

### Shield

| id | Current | Proposed |
|---|---|---|
| `thorns` | `Gain {power}, refl {thorn}` | `Gain {power} block, reflect {thorn} damage` |
| `fortify` | `50% block` | `Gain block equal to half your current block` |
| `emergency` | `Gain {power} ×2<30%` | `Gain {power} block, doubled if wounded` |
| `overheal` | `Gain {power} ×2<50%` | `Gain {power} block, doubled if wounded` |
| `shrug_it_off` | `{power} blk +draw` | `Gain {power} block, draw a card` |
| `absorb` | `{power} blk, CC+draw` | `Gain {power} block` |
| `reactive_shield` | `{power} blk +{thorns}▸` | `Gain {power} block and thorns` |
| `aegis_pulse` | `{power} blk, CC+chain` | `Gain {power} block, boost chain` |
| `burnout_shield` | `{power} / CC+Forget` | `Gain {power} block, consumed on correct charge` |
| `knowledge_ward` | `Gain ×charges` | `Block scales with correct charges` |
| `bulwark` | `{power} / CC+Forget` | `Gain {power} block, consumed on correct charge` |
| `ironhide` | `{power} blk +{str} Str` | `Gain {power} block and Strength` |
| `conversion` | `Deal Block as dmg` | `Deal your current block as damage` |

### Buff

| id | Current | Proposed |
|---|---|---|
| `empower` | `Next +{power}%` | `Next card deals {power}% more damage` |
| `quicken` | `+1 AP` | `Gain 1 action point` |
| `focus` | `Next −1 AP` | `Next card costs 1 less AP` |
| `double_strike` | `2× {pct}% power` | `Next attack hits twice` |
| `ignite` | `Next +{burn} B.Burn` | `Next attack applies {burn} Brain Burn` |
| `inscription_fury` | `+{power} dmg all atk` | `All attacks deal {power} bonus damage` |
| `inscription_iron` | `+{power} blk/turn` | `Gain {power} block at the start of each turn` |
| `inscription_wisdom` | `+1 draw/CC` | `Draw extra on each correct charge` |
| `warcry` | `+{str} Str / CC perm` | `Gain Strength, permanent on correct charge` |
| `battle_trance` | `Draw {draw} +lock` | `Draw {draw}, then end your actions` |
| `frenzy` | `Next {n} free` | `Next {n} cards cost no AP` |
| `mastery_surge` | `+1 mastery ×{n}` | `Upgrade {n} cards this combat` |
| `war_drum` | `Hand +{bonus} this turn` | `All cards gain {bonus} power this turn` |
| `forge` | `Forge +{amt} mastery` | `Upgrade a card by {amt} mastery` |
| `catalyst` | `Double Doubt (CC+B.Burn)` | `Double all Drawing Blanks` |
| `sacrifice` | `-5HP: draw 2+AP` | `Lose 5 HP, draw 2, gain AP` |

### Debuff

| id | Current | Proposed |
|---|---|---|
| `weaken` | `Weak {power}` | `Apply {power} Weakness` |
| `expose` | `Vuln {power}` | `Apply {power} Exposed` |
| `slow` | `Skip action` | `Skip enemy action` |
| `stagger` | `Skip action` | `Skip enemy action` |
| `hex` | `Doubt {power}×{turns}` | `Apply {power} Drawing Blanks` |
| `corrode` | `Strip blk +Weak` | `Strip enemy block, apply Weakness` |
| `corroding_touch` | `{stacks} Weak (free)` | `Apply Weakness for free` |
| `curse_of_doubt` | `+{pct}% chg dmg` | `Charged attacks deal {pct}% more damage` |
| `mark_of_ignorance` | `+{flat} flat/chg` | `Charged attacks deal {flat} bonus damage` |
| `entropy` | `{burn}B.Burn +{poison}Doubt` | `Apply {burn} Brain Burn and {poison} Drawing Blanks` |
| `sap` | `{power} dmg +Weak` | `Deal {power}, apply Weakness` |

### Utility

| id | Current | Proposed |
|---|---|---|
| `scout` | `Draw {draw}` | `Draw {draw} cards` |
| `recycle` | `Draw 3` | `Draw 3 cards` |
| `foresight` | `Draw {draw}` | `Draw {draw} cards` |
| `cleanse` | `Purge` | `Remove all debuffs` |
| `sift` | `Scry {scry}` | `Look at top {scry} cards` |
| `scavenge` | `Recover 1` | `Recover a discarded card` |
| `swap` | `Cycle 1→{draws}` | `Discard 1, draw {draws}` |
| `transmute` | `Transform` | `Transform this card` |
| `immunity` | `Absorb next` | `Absorb next hit` |
| `archive` | `Retain {n}` | `Retain {n} cards in hand at turn end` |
| `reflex` | `Draw {draw} +passive` | `Draw {draw}, passive block when discarded` |
| `recollect` | `Return {n} forget` | `Return {n} forgotten cards` |
| `synapse` | `Draw {draw} / CC+chain` | `Draw {draw}, extend chain on correct charge` |
| `siphon_knowledge` | `Draw {draw} +preview` | `Draw {draw}, preview answers briefly` |
| `tutor` | `Search & add` | `Search and add a card to hand` |
| `conjure` | `Summon {n}` | `Summon {n} cards to hand` |

### Wild

| id | Current | Proposed |
|---|---|---|
| `mirror` | `Copy last` | `Copy last card played` |
| `adapt` | `Smart` | `Auto-pick best action` |
| `overclock` | `2× effect` | `Double next card effect` |
| `phase_shift` | `{power} dmg OR blk` | `Deal {power} damage or gain {power} block` |
| `chameleon` | `Copy last` | `Copy last card effect` |
| `dark_knowledge` | `{per} dmg/curse` | `Deal {per} per cursed card` |
| `chain_anchor` | `Draw {draws} / CC→2` | `Draw {draws}, boost chain on correct charge` |
| `unstable_flux` | `Random / CC: choose` | `Random effect, or choose on correct charge` |
| `sacrifice` | `-5HP: draw 2+AP` | `Lose 5 HP, draw 2, gain AP` |
| `catalyst` | `Double Doubt (CC+B.Burn)` | `Double all Drawing Blanks` |
| `mimic` | `Replay disc {pct}%` | `Replay a discarded card` |
| `aftershock` | `Echo {pct}% / CC>` | `Repeat last card at {pct}% power` |
| `knowledge_bomb` | `CC: {per}×charges` | `Deal {per} per correct charge this encounter` |

---

## Implementation Priority

When implementing these changes, the code changes go in two places:

1. **`src/data/mechanics.ts`** — update `name` field for renamed cards
2. **`src/services/cardDescriptionService.ts`** — update `getShortCardDescription()` switch cases to return new face text strings

The rename list is short (17 cards). Descriptions touch all 97 but the pattern is mechanical: replace abbreviations with full words.

---

## Summary of Changes

- **17 cards renamed** (marked 🔴 RENAME)
- **97 descriptions rewritten** (all cards — remove abbreviations and mode labels)
- **0 cards unchanged** in face text (every current description uses abbreviations or mode-labels that violate the one-sentence principle)
- **Mechanics count verified**: 97 unique mechanic IDs in `src/data/mechanics.ts`

### STS Conflict Cards (most urgent, 17 total)

The following names are direct Slay the Spire copies and should ship renamed before Early Access:

`Twin Strike`, `Iron Wave`, `Bash`, `Rupture`, `Eruption`, `Aftershock`, `Entrench` (displayed name for `fortify`), `Shrug It Off`, `Warcry`, `Battle Trance`, `Weaken`, `Slow`, `Recycle`, `Thorns`

Plus theme-mismatches that should rename: `Shield Bash` (id: `conversion`) → `Redirect`, `Double Strike` → `Double Down`, `Sap` → `Undercut`.
