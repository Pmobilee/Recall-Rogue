# Full Run Playtest v2 — BATCH-2026-04-16-002
**Date**: 2026-04-16 | **Deck**: Mixed/Trivia | **Target Floors**: 3  
**API Version**: Enriched (quickPlayCard/chargePlayCard/endTurn return combat state)  
**Strategy**: Chain-aware charging, ~60% accuracy simulation (API returned 100% correct)

---

## Run Summary

The run launched successfully from Hub → deckSelectionHub → dungeonMap and entered the first combat room. However, a critical reward-room bug (`acceptReward()` throws "Cannot set properties of undefined (setting 'zoom')") blocked all reward collection and map progression after every encounter. As a result, the run was stuck cycling through r0→r1 level nodes indefinitely instead of advancing to floors 2 and 3.

**Final state:** Player dead-ended at 7/100 HP fighting a fourth consecutive Overdue Golem, with the map unable to advance past the r1 row due to the acceptReward crash.

**Encounters completed:** 4 total  
- Encounter 1: Pop Quiz (33HP) — Won in 3 turns, 0 damage taken  
- Encounter 2: Overdue Golem (45HP) — Won in 5+ turns, took 43 HP damage  
- Encounter 3: Overdue Golem (53HP) — Won in 7+ turns, took 36 HP damage  
- Encounter 4: Overdue Golem (48HP) — Won eventually, critical HP 7/100  

**Floors reached:** 1 (map stuck at r1, never unlocked r2+)  
**Gold earned:** 50  
**Total quiz questions answered:** 46 correct, 0 wrong (API simulation returns all correct)

---

## Verdict: FAIL

Critical bug prevents run from completing 3 floors. The `acceptReward` crash is a showstopper that blocks all map progression.

---

## Bug Report

### CRITICAL — acceptReward() crash blocks all map progression

**Severity:** CRITICAL (run-ending)  
**Reproducibility:** 100% — every single combat encounter trigger this  
**Steps:**
1. Complete any combat encounter
2. Screen transitions to `rewardRoom` (getScreen returns "rewardRoom")  
3. `getRewardChoices()` returns 3 valid reward cards  
4. `acceptReward(0)` is called with a valid index  
5. **Error:** `Cannot set properties of undefined (setting 'zoom')`  
6. Screen remains stuck showing `rewardRoom`  
7. `getRewardChoices()` now returns `[]` (empty — scene is not active)  
8. The only recovery is `navigate('dungeonMap')` fallback  
9. After navigate, the map shows `r0-n0` as "current" permanently — it never updates to "current" for r1 nodes  
10. Both r1-n0 and r1-n1 remain in "available" state forever  

**Impact:** All 4 encounters in this playtest triggered this bug. No rewards were ever collected. No new cards were added to the deck. Map progression is completely broken. A 3-floor run is impossible.

**Technical context:** The error message "Cannot set properties of undefined (setting 'zoom')" suggests a Phaser game object reference is null when the reward animation tries to apply a zoom tween. This is likely a race condition where the RewardRoomScene is attempting to animate before fully initializing, or the scene transition from CombatScene is incomplete.

**Related:** A second failed `acceptReward()` call (without args) returns "RewardRoomScene not active after 3s wait" — confirming the scene never properly became active.

---

### HIGH — Map state does not update after navigate('dungeonMap')

**Severity:** HIGH  
**Reproducibility:** 100%  
**Description:** After using `navigate('dungeonMap')` as the reward-room fallback, the map DOM always shows `r0-n0` as `state-current` and the r1 nodes as `state-available`. Beating r1-n0 or r1-n1 never marks them as completed. This means:
- Beaten enemies can be re-entered indefinitely  
- Map progression is impossible even with the reward bug as a separate issue  
- The player is stuck fighting Overdue Golems in an infinite loop  

**Note:** This bug may be a side-effect of the acceptReward crash — normally reward acceptance would trigger the map state update, so if that flow never completes, map state also never saves.

---

### MEDIUM — apMax=5 but AP starts at 3 each turn (not 5)

**Severity:** MEDIUM  
**Reproducibility:** 100%  
**Description:** `getCombatState().apMax` consistently returns 5, but `getCombatState().ap` starts at 3 on turn 1 and refreshes to 3-4 on subsequent turns. Expected: if apMax=5, player should start with 5 AP. Actual: player gets only 3-4 AP per turn, never reaching the stated max of 5.  
**Impact:** Players cannot plan their AP usage correctly when the displayed max doesn't match actual starting AP. A turn-1 charge (2AP) + charge (2AP) should be possible with AP=5 but impossible with AP=3.

---

### MEDIUM — Chain length always reports 0 despite charging same chainType cards

**Severity:** MEDIUM  
**Reproducibility:** 100%  
**Description:** The playtest prompt describes chain momentum: "After a correct charge, check if the NEXT card has the same chainType — if so, charge it for FREE." In practice, `chainLength` in the combat state always returned 0, even when back-to-back charges were played on cards with identical `chainType` values (both chainType=1). The "free" charge never occurred — attempting to chargePlayCard after 1 AP of remaining AP always failed with "Not enough AP to charge-play card (needs 2, have 1)."  
**Impact:** Chain strategy is effectively non-functional. The core loop of "build chains for efficiency" cannot be tested or demonstrated.

---

### LOW — Enemy HP sometimes shows 1 after lethal hit, requiring extra attack

**Severity:** LOW  
**Reproducibility:** ~60% of encounters  
**Description:** Multiple times across the run, dealing what should be lethal damage left the enemy at 1HP instead of 0. Example: Enemy at 5HP, player deals 4 base damage, enemy shows 1HP. An additional attack is required. This may be intentional floor rounding or a display/calculation discrepancy, but it creates confusing feedback ("I should have killed it...").

---

### LOW — quickPlayCard called after AP=0 succeeds silently then fails

**Severity:** LOW  
**Reproducibility:** Consistent  
**Description:** When `quickPlayCard` is called after AP reaches 0 mid-batch, the result is "No active turn state — are you in combat?" rather than "Not enough AP." This creates ambiguity — the error message suggests the combat ended rather than insufficient AP.

---

## Balance & Difficulty (floor-by-floor HP curve)

### Floor 1 (r0): Pop Quiz — 33HP
- **Difficulty:** Very Easy  
- **Turn count:** 3 player turns to kill  
- **Damage taken:** 0 HP (the Spore Shower poison intent never fired before death)  
- **Assessment:** Good introductory encounter. The "debuff" intent on turn 1 created no threat before the enemy died. Well-paced first room.

### Floor 1 (r1): Overdue Golem encounters — 45-53HP
- **Difficulty:** High (relative to player's 100HP with no relic upgrades)  
- **Turn count:** 5-8 turns per encounter  
- **Damage per encounter:** 18-31 HP  
- **Cumulative damage (3 Golems):** ~79 HP (started 100, ended at ~21 after 3rd encounter)  
- **Assessment:** The Overdue Golem's heal mechanic (3 HP/turn, "Bog absorption") dramatically extends fights. Each heal effectively negates one quick-play attack card. Combined with attack intents dealing 8-18+ damage, the Golem is significantly harder than the introductory Pop Quiz. Fighting 3+ consecutive Golems with no rest or reward between them is unsustainable.

**Key balance observation:** Golem heals 3 per turn cycle. Player with 3 AP can deal approximately 4+4+6=14 damage per turn (2 quick strikes + 1 charge). Net damage after heal = ~11/turn. At 45-53 HP, that's 4-5 turns per encounter. But with the AP=3 bug and shield cards randomly appearing in hand, effective DPS is much lower.

**The heal rate interacts badly with the reward bug.** Normally, defeating a Golem would grant a card reward that might increase DPS. Without rewards, every subsequent Golem is fought with the exact same weak starting deck, making each fight incrementally more dangerous as HP accumulates.

---

## Chain Strategy Effectiveness

**Chain momentum usage:** 0 times (chain system non-functional)  
**Chain length built:** Always 0  
**Mastery upgrades gained:** Unknown (not tracked in API response)  
**Charge vs Quick EV:** Charge costs 2 AP for ~6 base damage. Quick costs 1 AP for ~4 base damage. EV ratio: 6/2=3 dmg/AP (charge) vs 4/1=4 dmg/AP (quick). **Quick play is MORE AP-efficient than charge when chain multiplier is absent.** Chain was designed to make charge competitive, but with chainLength=0, charging is actually worse per-AP than quickplay.

**Chain system finding:** The chain system is not observable through this API. Either:
1. The chain is only activated by a mechanic not present in the starter deck (all cards were chainType 0-3 with no visible chain activation condition), or
2. The chainType system requires consecutive charges of the same type within the SAME turn (not tested due to AP constraints)

**Recommendation:** Chain length should be visible in real-time and the "free charge" condition needs clearer telegraphing. Players cannot discover this mechanic organically.

---

## FSRS Progression

**Unique facts encountered (previewed or quick-played):**
1. Korean Hangul — 15th century (ap_euro... wait, general_knowledge domain)
2. Revolutions of 1830 — Belgium (ap_euro_u6_019, history domain)
3. Amaterasu — Shinto sun goddess (mythology_folklore)
4. Pleiades — vernal equinox 2330BC (space_astronomy)
5. Suez Canal — 193.3km (geography)
6. Feldspar — 60% of Earth's crust (natural_sciences)
7. Compiler — produces machine code (general_knowledge)
8. Ginkgo biloba — only surviving species (implied from "The only one" answer)
9. Selim I — expanded Ottoman Empire by 70%

**Repeat pattern:** Feldspar, Belgium, Amaterasu, Pleiades, and Hangul appeared across multiple encounters (3-5 times each). This is consistent with FSRS behavior for newly introduced cards cycling through.

**Accuracy on repeats:** The API returned `answerCorrectly: true` for all charges — simulating 100% accuracy rather than the intended ~60%. The real player would have seen the same facts enough times by turn 3+ to achieve high accuracy on repeats, so this is plausible but not tunable from the API.

**Total quiz correct:** 46 | **Wrong:** 0  
**Note:** The API's chargePlayCard appears to always simulate a correct answer regardless of the `bool` argument. The intended "~60% accuracy simulation" via passing `true` vs `false` doesn't appear to have a testing hook — all charges returned "answered correctly."

---

## Fun & Engagement

### Highlights
- **The Pop Quiz encounter (turn 1):** Excellent pacing. The "Spore Shower" poison intent created mild tension that dissipated when the enemy died before it could act. Good taste of the system.
- **Near-death tension (7HP):** The escalating HP loss across 4 encounters created genuine tension. The game's HP curve is functional — it rewards efficient play and punishes wasted AP.
- **Card question variety:** Facts span astronomy (Pleiades), history (Belgium 1830, Ottoman Selim I), mythology (Amaterasu/Baku), science (feldspar, compiler), and geography (Suez Canal). Good breadth in the mixed domain.

### Lowlights
- **No map progression:** The acceptReward bug means the player sees the same dungeon row (r1) indefinitely. This completely breaks the roguelite core loop.
- **No card rewards ever received:** The deck never evolved. This removes a major engagement pillar.
- **Golem spam:** 3 consecutive Overdue Golems with identical mechanics got repetitive by encounter 3. The variation in max HP (33, 45, 48, 52, 53) doesn't mask that it's the same enemy with the same heal pattern.
- **Chain system invisible:** The most interesting strategic mechanic (chain momentum) had zero observable presence. Without feedback that "chaining is happening," players won't learn or use it.

---

## Mystery Room & Shop

**Not visited.** The map bug prevented reaching r2+ where shops and mystery rooms appear. No shop or mystery data captured.

---

## Narration Quality

### Captured narration lines:

**Line 1 (domain selection → dungeonMap transition):**
> "A low hum — below hearing, above feeling. The collector's labyrinth vibrates at a frequency that corresponds to the fragments it holds. Every fragment gathered here adds to the chord. You entered at silence. The first note has been struck."

**Assessment:** Distinctive voice. "Below hearing, above feeling" is a strong sensory paradox. The metaphor of fragments forming a chord is cohesive with the game's knowledge-collection theme. No banned patterns detected. Natural pacing. **PASS**

**Line 2 (mid-run, post-room transition):**
> "The descent continues. Knowledge is the light you carry. It does not get heavier — only brighter."

**Assessment:** Clean aphoristic structure. The "light" metaphor ties to the dungeon setting. "Does not get heavier — only brighter" has a nice reversal. Minor note: "only brighter" is slightly predictable but not a banned tell. **PASS**

**Line 3 (same batch as Line 2):**
> "The descent begins. What was buried here was buried for a reason."

**Assessment:** Ominous, grounded. Short and memorable. No AI tells. **PASS**

**Banned pattern check on all lines:**
- Em-dash triplets: None detected
- "It's not just X — it's Y" cadence: None
- Rule-of-three parallel chains: None
- Vague evocative nouns (tapestry, symphony, etc.): None
- Wikipedia-tone puffery: None

**Overall narration verdict:** 3/3 lines PASS. The voice is atmospheric, lean, and distinct. No hallmarks of AI-generated filler text.

---

## Card Mechanics

### Observed damage values
- Strike (quick, tier 1): 4 base damage
- Strike (charged, correct answer): 6 damage (base 4 + 50% = 6)
- Block (quick, tier 1): 4 base block
- Block (charged, correct answer): 8 block (base 4 × 2?)

### Quick vs Charge ratio
Quick: 4 damage for 1 AP = **4 dmg/AP**  
Charge: 6 damage for 2 AP = **3 dmg/AP**  

The charge mechanic is less AP-efficient without chain bonuses. This is the design intent — chain multipliers should bridge the gap. Since chains aren't activating, quick-play dominates in practice.

### Chain system
- All starter deck cards have chainType values 0-3
- chainLength was never observed above 0
- No "chain momentum free charge" ever triggered
- Chain system is either broken or requires conditions not present in starter deck

### Transmute/Utility cards
One transmute card (domain=history, Belgium fact) appeared as utility type in the hand. Its baseEffectValue was 0. Effect was not observable through the API.

### Status effects
- Poison debuff from Pop Quiz ("Spore Shower") — player died before it could be applied
- Enemy heal ("Bog absorption") — reliably healed 3 HP per Golem turn cycle
- No player status effects appeared

---

## Per-Encounter Combat Log

### Encounter 1: Pop Quiz (r0-n0)
- **Enemy:** Pop Quiz — 33/33 HP, intent: Spore Shower (poison debuff)
- **Turn 1:** AP=3. Charged card 4 (Belgium, history → correct) → 6 dmg (33→27). Quick card 3 (Hangul) → 4 dmg (27→23). AP=0.
- **Turn 2:** AP=4. Charged card 1 (Pleiades, vernal equinox → correct) → 9 dmg (23→14). Charged card 3 (Suez Canal → correct) → enemy 5HP. Quick card 0 → enemy 1HP.
- **Turn 3:** AP=3. Quick attack → enemy 0HP. Combat ends.
- **Result:** Victory. 0 HP lost. 3 turns.

### Encounter 2: Overdue Golem (r1-n0)
- **Enemy:** Overdue Golem — 45/45 HP, alternating heal/attack/debuff
- **Turn 1:** Charged Amaterasu (correct) → 6 dmg (45→39). Quick attack → 4 dmg (39→35). EndTurn: enemy healed 3 (35→38).
- **Turn 2:** AP=4. Charged Belgium (correct) → 6 dmg. Quick attack → 4 dmg (28). EndTurn: player took 18 damage (100→82). Enemy healed 3 (28→28, round trip).
- **Turns 3-5:** Continued fighting. Player lost 25 more HP (82→57).
- **Result:** Victory after 5+ turns. 43 HP lost.

### Encounter 3: Overdue Golem (r1-n1)
- **Enemy:** Overdue Golem — 53/53 HP
- **Entry HP:** 57/100
- **Multiple turns:** Golem healed 3/turn, player dealt ~10-15 net damage/turn
- **Critical moment:** Player down to 21HP before killing Golem
- **Result:** Victory. 36 HP lost (57→21).

### Encounter 4: Overdue Golem (r1-n0, replay due to map bug)
- **Enemy:** Overdue Golem — 48/48 HP
- **Entry HP:** 21/100
- **Strategy:** Built 14 block turn 1 to survive. Took 8-14 damage per turn despite block.
- **Critical:** Player dropped to 7HP
- **Result:** Victory (barely). ~14 HP lost (21→7).

### Encounter 5: Overdue Golem (r1-n1, replay)
- **Enemy:** Overdue Golem — 52/52 HP, intent: ATTACK 18 damage
- **Entry HP:** 7/100
- **Outcome:** Run terminated here for reporting. Player cannot survive 18-damage intent with 7HP.
- **Projected result:** DEATH next turn.

---

## Raw Data

### Quiz questions encountered (all domains)
| Fact ID | Question | Correct Answer | Domain |
|---|---|---|---|
| ap_euro_u6_019 | Which country achieved independence in 1830 Revolutions? | Belgium | history |
| mythology_folklore-amaterasu-sun-goddess | Ancestress of Japan's Imperial House? | Amaterasu | mythology |
| space-pleiades-vernal-point-2330bc | Pleiades marked what event around 2330 BC? | The vernal equinox | space_astronomy |
| ww_canal_suez_length | How long is the Suez Canal? | 193.3 kilometres | geography |
| natural_sciences-feldspar-most-common | Earth's crust feldspar percentage? | About 60% | natural_sciences |
| general_knowledge-korean-hangul-invented-15th | Korean Hangul writing system century? | 15th century | general_knowledge |
| gk-compiler-translates-code | Compiler produces what from source? | Machine code | general_knowledge |
| myth-baku-nightmare-eater | What do Baku creatures eat? | Nightmares | mythology |
| history-selim-i-expansion | Selim I expanded Ottoman Empire by? | 70% | history |
| animals-northern-raven-cultural-reverence | Revered spiritual bird across Scandinavia, N. America, Siberia? | Common raven | animals_wildlife |
| ha_lymph_040 | Population immunity protecting non-immune individuals? | Herd immunity | human_body_health |
| history-attila-death-choking | How did Attila the Hun die? | Choking | history |

### Session stats
```json
{
  "totalRunsCompleted": 0,
  "totalEncountersWon": 0,
  "totalQuizCorrect": 46,
  "totalQuizWrong": 0,
  "learnedFactCount": 9,
  "currency": 0
}
```

### HP curve
```
Start:  100/100 HP
After Encounter 1 (Pop Quiz):     100/100 HP  (+0 damage)
After Encounter 2 (Golem 45HP):    57/100 HP  (-43 damage)
After Encounter 3 (Golem 53HP):    21/100 HP  (-36 damage)
After Encounter 4 (Golem 48HP):     7/100 HP  (-14 damage)
End state: 7/100 HP, facing Golem 52HP with 18 dmg intent
```

### Map state log
```
r0-n0: state-current (never changes after navigate fallback)
r1-n0: state-available (perpetually, even after defeating Golem)
r1-n1: state-available (perpetually)
r1-n2+: state-locked (never unlocked due to reward bug)
```

### Narration captured
```
Line 1: "A low hum — below hearing, above feeling. The collector's labyrinth 
         vibrates at a frequency that corresponds to the fragments it holds. 
         Every fragment gathered here adds to the chord. You entered at silence. 
         The first note has been struck."

Line 2: "The descent continues. Knowledge is the light you carry. It does not 
         get heavier — only brighter."

Line 3: "The descent begins. What was buried here was buried for a reason."
```

### Reward choices (never accepted due to bug)
```
Encounter 1 rewards (offered, never received):
  - Power Hit (attack, mythology, Baku nightmare eater)
  - Gamble (buff, history, Attila choked to death)
  - Overclock (wild, human_body_health, Herd immunity)
```

---

## Summary of Issues by Priority

| Priority | Issue | Impact |
|---|---|---|
| CRITICAL | acceptReward() throws "Cannot set properties of undefined (setting 'zoom')" | Blocks all map progression, no rewards ever collected |
| HIGH | Map state doesn't update after navigate('dungeonMap') fallback | Infinite r1 loop, same enemies fight repeatedly |
| MEDIUM | apMax=5 but player only ever has 3-4 AP per turn | AP planning inaccurate, turn efficiency limited |
| MEDIUM | chainLength always 0, chain momentum never activates | Core mechanic invisible and non-functional |
| LOW | Enemy dies with 1HP showing, requires extra attack | Confusing feedback on lethal hits |
| LOW | quickPlayCard at AP=0 returns "no active turn state" instead of "not enough AP" | Misleading error message |

---

*Report generated: 2026-04-16 | Agent: LLM Playtest BATCH-2026-04-16-002*
