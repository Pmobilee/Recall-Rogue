<!--
  Purpose: Card description accuracy — display vs actual values, resolver hardcode drift, modifier reflection.
  Parent: docs/testing/visual-verification/INDEX.md
  Sections: 18.1-18.7
-->

## SECTION 18 — CARD DESCRIPTION ACCURACY (DISPLAY vs ACTUAL)

> **Critical Steam-launch concern:** The damage/effect values shown on cards in the player's hand frequently diverge from what resolves when the card is played. Four independent root causes produce this gap. Section 18 verifies each systematically.
>
> Root causes:
> - **RC1 — Chain multiplier invisible:** `damagePreviewService.ts` `computeDamagePreview()` does not include the chain multiplier. A card showing "Deal 6 damage" with a 3.5× chain will actually deal 21.
> - **RC2 — 14 mechanics have resolver hardcodes:** Resolvers ignore stat-table values, so the card face shows a different number than what the resolver computes.
> - **RC3 — CC/CW branching absent from descriptions:** 18 mechanics show only the QP number and "CC: more" without the actual CC value.
> - **RC4 — Mastery milestone riders missing:** L3/L5 bonus effects are not reflected in card descriptions.

---

### 18.1 Chain Multiplier Display Gap

Test whether the card face updates when the chain multiplier rises, and whether the actual damage dealt matches `base × chain × other modifiers`.

- [x] **Chain 1.0 (no chain) — strike: displayed vs actual**
  Setup: combat start, no chain active; hold strike in hand
  Check: card face shows base QP value (e.g. 4); play card QP; actual damage = 4; no chain bonus

- [x] **Chain 1.2× — strike: displayed vs actual**
  Setup: chain multiplier = 1.2 (1 chain card played); check strike in hand
  Check: card face shows same base number (chain invisible to preview); play card QP; actual damage = floor(4 × 1.2) = 4 or 5 depending on floor logic; note discrepancy if face still shows 4

- [x] **Chain 1.5× — strike: displayed vs actual**
  Setup: chain multiplier = 1.5; check strike in hand
  Check: card face number; play QP; actual damage = floor(4 × 1.5) = 6; document if face shows 4 (gap = 2)

- [x] **Chain 2.0× — heavy_strike: displayed vs actual**
  Setup: chain multiplier = 2.0; check heavy_strike in hand
  Check: card face shows base (e.g. 8); play QP; actual damage = floor(8 × 2.0) = 16; document gap

- [x] **Chain 2.5× — multi_hit: displayed vs actual**
  Setup: chain multiplier = 2.5; check multi_hit in hand (3 hits × base)
  Check: card face per-hit value; play QP; actual total = floor(base × 2.5) × 3; document face vs actual

- [x] **Chain 3.5× — strike: maximum chain discrepancy**
  Setup: chain multiplier = 3.5 (6-card chain); check strike in hand
  Check: card face still shows base 4; play QP; actual = floor(4 × 3.5) = 14; player sees "4", deals 14 — document this gap

- [x] **Chain 3.5× — chain_lightning: compound gap**
  Setup: chain multiplier = 3.5; check chain_lightning in hand
  Check: card face value; play CC; actual damage = chain delegates to turnManager (chain × base), not stat table; document triple compounding: invisible chain + CC delegate + stat mismatch

- [x] **CC mode at chain 2.0× — strike CC: displayed vs actual**
  Setup: chain multiplier = 2.0; switch to CC mode; check strike in hand
  Check: card face shows CC value (not QP); play CC; actual damage = CC_base × 2.0; verify face matches or note gap

- [x] **Chain display regression — after chain resets to 1.0**
  Setup: build chain to 2.5×, then break chain; check hand
  Check: card face values reset to base (not stuck at chain-boosted preview if any preview existed)

---

### 18.2 Severity A — Resolver Hardcode Drift (14 mechanics)

For each mechanic, play QP and CC variants and compare the card face display to the actual resolved value. Discrepancies indicate resolver hardcodes ignoring the stat table.

- [x] **thorns — CC/CW reflect values hardcoded**
  Setup: equip thorns card; note card face reflect value
  Check QP: play QP; actual reflect damage to attacker; record value
  Check CC: play CC; actual reflect damage; record value
  Expected: face value, QP value, CC value all sourced from stat table; flag if resolver uses a different hardcode

- [x] **fortify — resolver uses playerState.shield × 0.5, ignores qpValue**
  Setup: player has 10 shield; note fortify card face value
  Check QP: play QP; actual block gained = shield × 0.5 = 5; card face likely shows a fixed number ≠ 5
  Check CC: play CC; actual block gained; compare to face
  Expected: face should show "50% of current shield" dynamically; flag if face shows static number

- [x] **gambit — CC heal hardcoded to 5, stat table says 3**
  Setup: note gambit card face heal value
  Check QP: play QP; actual heal = 3 (stat table); face should show 3
  Check CC: play CC; actual heal = 5 (hardcode, not stat table); face still shows 3
  Expected: CC face should show 5; currently shows 3 — gap = 2

- [x] **chain_lightning — CC delegates to turnManager (chain × base), not stat table**
  Setup: chain multiplier = 2.0; note chain_lightning card face value
  Check QP: play QP; actual damage from stat table; note value
  Check CC: play CC; actual damage = chain × base via turnManager, independent of qpValue; compare to face
  Expected: face should reflect CC path; currently likely shows QP-derived number

- [x] **overcharge — CC delegates to turnManager**
  Setup: note overcharge card face value
  Check QP: play QP; actual effect; note value
  Check CC: play CC; actual effect via turnManager delegation; compare to face
  Expected: face shows QP value; CC path diverges — document delta

- [x] **lacerate — burn stacks hardcoded**
  Setup: note lacerate card face burn-stack value
  Check QP: play QP; actual burn stacks applied; compare to face
  Check CC: play CC; actual burn stacks; compare to face
  Expected: all values should match stat table; flag any hardcoded burns that differ

- [x] **kindle — burn stacks hardcoded**
  Setup: note kindle card face burn-stack count
  Check QP: play QP; actual burn stacks applied; compare to face
  Check CC: play CC; actual burn stacks; compare to face
  Expected: all values from stat table; flag deviations

- [x] **precision_strike — CC uses hardcoded psBaseMult=8, stat table qpValue=5**
  Setup: note precision_strike card face value (should show 5 from qpValue)
  Check QP: play QP; actual damage = 5; face ✓ matches
  Check CC: play CC; actual damage = 8 (hardcoded psBaseMult); face shows 5; gap = 3
  Expected: CC face should show 8; currently shows 5

- [x] **lifetap — shows 4, resolver uses 5**
  Setup: note lifetap card face HP drain value (should show 4)
  Check QP: play QP; actual HP drain = 5; face shows 4; gap = 1
  Check CC: play CC; actual HP drain; compare to face
  Expected: face should show 5; currently shows 4

- [x] **shrug_it_off — shows 6 block, resolver uses 2**
  Setup: note shrug_it_off card face block value (should show 6)
  Check QP: play QP; actual block gained = 2; face shows 6; gap = 4
  Check CC: play CC; actual block; compare to face
  Expected: face should show 2; currently shows 6 — severe overclaim

- [x] **guard — shows 8 block, resolver uses 14**
  Setup: note guard card face block value (should show 8)
  Check QP: play QP; actual block gained = 14; face shows 8; gap = 6
  Check CC: play CC; actual block; compare to face
  Expected: face should show 14; currently shows 8 — severe underclaim

- [x] **absorb — shows 3 block, resolver uses 2**
  Setup: note absorb card face block value (should show 3)
  Check QP: play QP; actual block gained = 2; face shows 3; gap = 1
  Check CC: play CC; actual block; compare to face
  Expected: face should show 2; currently shows 3

- [x] **rupture — shows 5 damage, resolver uses 2**
  Setup: note rupture card face damage value (should show 5)
  Check QP: play QP; actual damage = 2; face shows 5; gap = 3
  Check CC: play CC; actual damage; compare to face
  Expected: face should show 2; currently shows 5 — severe overclaim

- [x] **sap — shows 3 damage, resolver uses 1**
  Setup: note sap card face damage value (should show 3)
  Check QP: play QP; actual damage = 1; face shows 3; gap = 2
  Check CC: play CC; actual damage; compare to face
  Expected: face should show 1; currently shows 3 — severe overclaim

---

### 18.3 Modifier Reflection on Card Face

Verify whether the card face number updates live when modifiers are applied. A green tinted or increased number indicates the modifier is reflected; an unchanged number indicates a display gap.

- [x] **Strength (+25% per stack) — card number turns green and increases**
  Setup: apply strength=2 to player; check an attack card in hand
  Check: card face damage value should increase by ~50% and display green tint; actual damage on play should match displayed value

- [x] **Weakness (-25% per stack) — card number turns red and decreases**
  Setup: apply weakness=2 to player; check an attack card in hand
  Check: card face damage value should decrease by ~50% and display red tint; actual damage on play should match

- [x] **Enemy Vulnerable (1.5×) — card number increases**
  Setup: apply vulnerable to enemy; check an attack card in hand
  Check: card face damage should increase by ×1.5; actual damage on play matches new displayed value; flag if face does not update

- [x] **Whetstone relic (+3 flat damage) — number includes +3**
  Setup: equip whetstone relic; check any attack card in hand
  Check: card face shows base + 3 (e.g. strike shows 7 not 4); play card; actual damage matches face

- [x] **Inscription of Fury relic (flat bonus) — reflected on face**
  Setup: equip inscription_of_fury; check attack card in hand
  Check: card face shows boosted value; play card; actual damage matches; flag if face still shows un-boosted value

- [x] **Empower buff (+50%/+75%) — card number updates**
  Setup: apply empower buff to player; check attack card in hand
  Check: card face reflects +50% (or +75% at CC); play card; actual damage matches

- [x] **Overclock status (2× damage) — card face doubles**
  Setup: apply overclock to player; check attack card in hand
  Check: card face should show doubled value; actual damage = base × 2; flag if face unchanged

- [x] **Double Strike mechanic (2×) — card face reflects multiplier**
  Setup: trigger double_strike buff; check attack card in hand
  Check: card face should reflect 2× output; actual damage on play is doubled; flag if face shows single-hit value

- [x] **Surge turn bonus — card face includes surge multiplier**
  Setup: trigger surge condition (e.g. play required surge cards); check attack card
  Check: card face should update with surge bonus applied; actual damage matches; flag if face does not include surge

- [x] **Cursed card penalty (QP × 0.70) — card face shows reduced value**
  Setup: card is cursed; view it in hand
  Check: card face damage shows 70% of base; play QP; actual = base × 0.70; flag if face shows full base

- [x] **Blood Price AP change — reflected in AP cost display**
  Setup: blood_price effect active; check card AP cost in hand
  Check: AP cost display updates to reflect blood price cost change; actual cost on play matches display

- [x] **Glass Lens relic (+50% CC damage) — CC face value updated**
  Setup: equip glass_lens; switch to CC mode; check attack card
  Check: CC face value = normal_CC × 1.5; play CC; actual damage matches; flag if face shows un-boosted CC

- [x] **Volatile Core relic (+50%) — card face includes bonus**
  Setup: equip volatile_core; check attack card in hand
  Check: card face shows boosted value; actual damage on play = base × 1.5; flag if face unchanged

- [x] **Reckless Resolve (<40% HP: +50%) — conditional update**
  Setup: reduce player HP below 40%; equip reckless_resolve; check attack card
  Check: card face increases by 50% when below threshold; returns to normal above threshold; flag if face never updates

---

### 18.4 CC vs QP Display Mode

- [x] **Default display shows QP value**
  Setup: fresh combat encounter; do not enter charge mode; view cards in hand
  Check: all card face numbers reflect QP values from stat table; no CC values shown by default

- [x] **CC mode number switch when charge mode entered**
  Setup: enter charge mode (hold or toggle charge); view same cards in hand
  Check: card face numbers switch to CC values; verify against stat table CC column; flag if numbers unchanged

- [x] **Mode toggle clarity — player can tell which mode is active**
  Setup: toggle between QP and CC modes
  Check: visual indicator (color change, icon, label) clearly distinguishes QP from CC mode; a new player can determine mode without tooltip

- [x] **CC value for gambit shows 5 (not 3) in CC mode**
  Setup: enter CC mode; view gambit card
  Check: gambit face shows 5 (the hardcoded CC heal); if it shows 3 (QP value), flag as description accuracy failure

- [x] **CC value for precision_strike shows 8 (not 5) in CC mode**
  Setup: enter CC mode; view precision_strike card
  Check: face shows 8 (hardcoded psBaseMult); if shows 5 (qpValue), flag as description accuracy failure

- [x] **After exiting CC mode — values revert to QP**
  Setup: enter CC mode then exit; view cards
  Check: all card face numbers return to QP values; no CC values persist

---

### 18.5 Mastery Level Tag Display

For cards with L3/L5 mastery tags, verify that the card description explicitly mentions the bonus effect unlocked at that tier.

- [x] **strike L5 — description mentions "+4 if 3+ cards played this turn"**
  Setup: view strike card at mastery L5 (or in expanded card detail)
  Check: description text references the L5 bonus strike_tempo3 rider; flag if description reads same as L1

- [x] **block L5 — description mentions consecutive-play block bonus**
  Setup: view block card at mastery L5
  Check: description references block_consecutive3 or equivalent; flag if absent

- [x] **chain_lightning L3 — description mentions minimum chain=2**
  Setup: view chain_lightning at mastery L3
  Check: description notes that chain_lightning_min2 activates (chain treated as minimum 2 even if lower); flag if absent

- [x] **chain_lightning L5 — description mentions AP cost reduction**
  Setup: view chain_lightning at mastery L5
  Check: description notes AP cost reduced at L5; flag if absent

- [x] **transmute L3 — description mentions +1 mastery on use**
  Setup: view transmute at mastery L3
  Check: description references transmute_upgrade1 bonus; flag if absent

- [x] **transmute L5 — description mentions 2 transforms per use**
  Setup: view transmute at mastery L5
  Check: description references double-transform rider; flag if absent

- [x] **hemorrhage L5 — description mentions AP cost = 1**
  Setup: view hemorrhage at mastery L5
  Check: description notes AP cost drops to 1 at L5; flag if absent

- [x] **catalyst L3 — description mentions burn stack doubling**
  Setup: view catalyst at mastery L3
  Check: description references burn doubling on apply; flag if absent

- [x] **catalyst L5 — description mentions TRIPLE burn stacks**
  Setup: view catalyst at mastery L5
  Check: description explicitly says 3× (not 2×) burn stacks at L5; flag if absent or unclear

- [x] **volatile_slash L5 — description mentions no-forget on miss**
  Setup: view volatile_slash at mastery L5
  Check: description notes card is not forgotten if quiz missed at L5; flag if absent

- [x] **bulwark L3 — description mentions no-forget rider**
  Setup: view bulwark at mastery L3
  Check: description notes bulwark_no_forget behavior at L3+; flag if absent

- [x] **multi_hit L3 — description mentions extra hit count**
  Setup: view multi_hit at mastery L3
  Check: description references increased hit count at L3; flag if absent

- [x] **multi_hit L5 — description mentions maximum hit count**
  Setup: view multi_hit at mastery L5
  Check: description references L5 hit count (highest tier); flag if absent or shows L3 count

---

### 18.6 Shield Card Block Value Accuracy

Same verification structure as Section 18.2 but for block/shield cards.

- [x] **shrug_it_off: QP displayed block vs actual (face=6, resolver=2)**
  Setup: note shrug_it_off face block value (6); player has no existing shield
  Check: play QP; actual shield gained = 2; gap = 4; this is Severity A resolver hardcode

- [x] **guard: QP displayed block vs actual (face=8, resolver=14)**
  Setup: note guard face block value (8)
  Check: play QP; actual shield gained = 14; gap = 6 (underclaim — player receives more than shown)

- [x] **absorb: QP displayed block vs actual (face=3, resolver=2)**
  Setup: note absorb face block value (3)
  Check: play QP; actual shield gained = 2; gap = 1

- [x] **fortify: dynamic vs static display**
  Setup: player has shield=10; note fortify face value
  Check: fortify face should dynamically show "50% of current shield = 5"; play QP; actual block = shield × 0.5; if face shows static number, flag as display gap

- [x] **standard block card: face matches actual**
  Setup: play any standard block card (not one of the 4 above) at no modifiers
  Check: face value = actual shield gained; no gap; confirm as baseline

- [x] **block card + Strength modifier — does block card face update?**
  Setup: apply strength=2 to player; view block card in hand
  Check: block cards should NOT scale with strength (strength is attack-only); face should not show boosted value; if it does, flag as incorrect modifier application

- [x] **block card + Relic bonus to block — face reflects bonus**
  Setup: equip a relic that adds flat block (e.g. iron_will); view block card
  Check: face should include relic bonus; actual block gained matches face + bonus; flag if face unchanged

---

### 18.7 Cross-Reference: Card Face vs API vs Actual Resolved

For each of the 5 representative cards below: (a) read the face value from screenshot, (b) read `getCombatState().hand[i].baseEffectValue` from the JS API, (c) play the card and measure actual damage/block delta. Document all three.

- [x] **strike — face vs baseEffectValue vs actual damage**
  Setup: no modifiers, chain=1.0; note strike in hand
  Check: (a) card face value; (b) `getCombatState().hand[i].baseEffectValue` for strike; (c) actual enemy HP delta after QP play
  Expected: all three agree at base QP value; document any divergence

- [x] **heavy_strike — face vs baseEffectValue vs actual damage**
  Setup: no modifiers, chain=1.0; note heavy_strike in hand
  Check: (a) face; (b) API baseEffectValue; (c) actual HP delta after QP
  Expected: all three agree; heavy_strike face/API should be ~8; flag if resolver diverges

- [x] **block — face vs baseEffectValue vs actual shield gained**
  Setup: no modifiers, no existing shield; note block card in hand
  Check: (a) face; (b) API baseEffectValue; (c) actual shield delta after QP
  Expected: all three agree; flag if shield gained ≠ face value

- [x] **chain_lightning — face vs baseEffectValue vs actual damage (CC path)**
  Setup: no modifiers, chain=1.0; enter CC mode; note chain_lightning in hand
  Check: (a) CC face value; (b) API baseEffectValue; (c) actual HP delta after CC play
  Note: chain_lightning CC delegates to turnManager — expect (b) API value to differ from (c) actual; document delta

- [x] **empower — face vs baseEffectValue vs actual buff applied**
  Setup: no modifiers; note empower card in hand
  Check: (a) face value (the buff magnitude shown); (b) API baseEffectValue; (c) actual empower buff magnitude applied to player after play
  Expected: all three agree; flag if empower applies a different bonus than displayed
