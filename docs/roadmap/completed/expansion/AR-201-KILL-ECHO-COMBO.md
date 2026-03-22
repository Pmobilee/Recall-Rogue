# AR-201: Kill Echo System + Kill Combo System

**Source:** docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md — Phase 0, tasks 0.1 and 0.9
**Priority:** Critical — blocks all other expansion ARs
**Estimated complexity:** Medium
**Depends on:** Nothing
**Blocks:** AR-202, AR-203, AR-204, AR-205, AR-206

---

## Overview

Two deprecated systems must be fully excised before any expansion content is added:

**Echo System:** Echo cards are ghost copies spawned on wrong Charge answers. They require a special `isEcho` flag, block Quick Play, apply a 0.5x wrong-answer damage penalty, interact with `echo_lens` (relic), and are tracked via `echoFactIds`/`echoCount` on `RunState`. The expansion replaces this mechanic entirely with the Cursed Card system (AR-202). All spawning logic, visual state, play restrictions, FSRS bonus path, and related relics (`echo_lens`, `echo_chamber`, `echo_master` synergy) must be removed.

**Combo System:** `comboCount` tracks consecutive correct answers and multiplies card damage via `COMBO_MULTIPLIERS` (1.0x → 2.0x). Quick Play decays the count; wrong answers decay it further. The ascension system provides combo heal at threshold and combo-reset-on-turn-end modifiers. The expansion removes this entirely — the Knowledge Chain multiplier is the only streak mechanic going forward. All constants, tracking state, multiplier math, UI display, and ascension modifiers must be removed.

Both systems are intertwined in `combo_ring` (relic) and the `echo_master` synergy (`echo_lens` + `combo_ring`). These must also be deprecated. `war_drum` (relic) references `comboCount` in `relicEffectResolver.ts` but is already dropped from the catalogue via save migration — its resolver block still needs removal.

After this AR, `comboCount` and `isEcho` must not appear anywhere in runtime code paths. The only permitted survivors are `bestCombo` (a run-end stat used for leaderboard/scoring — this is a historical high-water mark, not an active multiplier) and `echo_chamber` if it is being repurposed — see note below.

**Note on `echo_chamber` relic:** `echo_chamber` (replays first chain card at 60% power on 2+ chain) does NOT use `isEcho` or the Echo Card spawning system — it is technically a chain relic. However, **the user has explicitly decided to KILL it** to avoid confusion with the removed Echo system. Remove the relic definition from `unlockable.ts`, its trigger handler from `relicEffectResolver.ts`, and add it to the save migration drop list alongside `echo_lens` and `combo_ring`.

---

## TODO

- [x] 1. Remove `ECHO` constant block and all `COMBO_*` constants from `balance.ts`
  **Files:** `src/data/balance.ts`
  **What:**
  - Delete the entire `ECHO` object constant (lines ~508-520): `REAPPEARANCE_CHANCE`, `POWER_MULTIPLIER`, `POWER_MULTIPLIER_WRONG`, `FSRS_STABILITY_BONUS`, `FSRS_STABILITY_BONUS_CORRECT_V2`, `MAX_ECHOES_PER_RUN`, `INSERT_DELAY_CARDS`
  - Delete `COMBO_MULTIPLIERS` array (line ~463)
  - Delete `COMBO_HEAL_THRESHOLD` and `COMBO_HEAL_AMOUNT` (lines ~464-465)
  - Delete `COMBO_RING_START_MULTIPLIER` (line ~468)
  - Delete `COMBO_DECAY_QUICK_PLAY` and `COMBO_DECAY_WRONG_ANSWER` (lines ~471-473)
  - Remove `comboMultipliers?: number[]` from the `BalanceOverrides` interface (line ~852)
  - Remove the `comboMultipliers` branch from `getBalanceValue` callers — the constant is deleted so the call in `cardEffectResolver.ts` task 2 and `turnManager.ts` task 3 will handle this
  **Acceptance:** `balance.ts` exports no `ECHO`, `COMBO_MULTIPLIERS`, `COMBO_HEAL_THRESHOLD`, `COMBO_HEAL_AMOUNT`, `COMBO_RING_START_MULTIPLIER`, `COMBO_DECAY_QUICK_PLAY`, or `COMBO_DECAY_WRONG_ANSWER`. `BalanceOverrides` has no `comboMultipliers` field.

- [x] 2. Remove Echo and Combo logic from `cardEffectResolver.ts`
  **Files:** `src/services/cardEffectResolver.ts`
  **What:**
  - Remove imports of `COMBO_MULTIPLIERS` and `ECHO` from `../data/balance`
  - Delete the `getComboMultiplier(comboCount)` internal helper function (lines ~108-112)
  - Delete the `resolveEchoBase(card, activeRelicIds, playMode, correct)` function (lines ~125-141)
  - Remove `correct` and `playMode` fields from `AdvancedResolveOptions` interface — these were only used by Echo. Keep all other fields. (Lines ~76-80: `correct?: boolean` and `playMode?: PlayMode`)
  - In `resolveCardEffect`: remove `const comboMultiplier = getComboMultiplier(comboCount)` (line ~185)
  - In `resolveCardEffect`: remove `const correct = advanced.correct ?? true` and `const playMode: PlayMode = advanced.playMode ?? 'quick'` (lines ~189-190)
  - In `resolveCardEffect`: remove `const baseEffectValue = resolveEchoBase(...)` call; replace all uses of `baseEffectValue` (which was only for Echo cards) with `card.baseEffectValue` directly
  - In `resolveCardEffect`: remove `* comboMultiplier` from the `scaledValue` calculation (line ~272)
  - Remove the `comboCount` parameter from `resolveCardEffect`'s signature (currently 4th positional arg)
  - The `isChargeCorrect` and `isChargeWrong` variables derived from `playMode` drive mechanic scaling — keep those. The `playMode` parameter must stay on `resolveCardEffect` as a direct param (not from `advanced`). Restructure accordingly: add `playMode: PlayMode` as a direct parameter replacing the removed `advanced.playMode`.
  - Remove the Echo-specific branch inside the mechanic base value block: `if (card.isEcho) { mechanicBaseValue = baseEffectValue; }` (lines ~213-215)
  - Remove the `comboCount` field from `PlayCardResult` interface (currently used only to surface combo state to callers) — this is in `turnManager.ts`, see task 3
  **Acceptance:** `cardEffectResolver.ts` imports no `COMBO_MULTIPLIERS`, `ECHO`. No `comboMultiplier` variable. No `resolveEchoBase`. No `isEcho` checks. `resolveCardEffect` signature no longer takes `comboCount`. `comboMultiplier` not used in `scaledValue` formula.

- [x] 3. Remove all Combo and Echo tracking from `turnManager.ts`
  **Files:** `src/services/turnManager.ts`
  **What:**
  - Remove imports of `COMBO_MULTIPLIERS`, `COMBO_HEAL_THRESHOLD`, `COMBO_HEAL_AMOUNT`, `COMBO_DECAY_QUICK_PLAY`, `COMBO_DECAY_WRONG_ANSWER` from `../data/balance` (lines ~31-35)
  - Remove import of `resolveComboStartValue` from `./relicEffectResolver` (line ~56)
  - Remove `comboCount: number` and `baseComboCount: number` from `TurnState` interface (lines ~113-114)
  - Remove `ascensionComboResetsOnTurnEnd: boolean` from `TurnState` interface (line ~153)
  - Remove `comboCount: number` from `PlayCardResult` interface (line ~200)
  - In `initTurnState`: remove `comboCount: 0`, `baseComboCount: 0`, `ascensionComboResetsOnTurnEnd: false` from the state initializer (lines ~303-304, ~342)
  - In turn start logic: remove `turnState.baseComboCount = resolveComboStartValue(...)` and the `if (turnState.comboCount < turnState.baseComboCount)` guard (lines ~412-413)
  - Remove all `comboCount: turnState.comboCount` from `PlayCardResult` return objects (lines ~400, ~471, ~503, ~596, ~704, ~763, ~1152)
  - Remove the combo-build/decay block after card play (lines ~1079-1096): the `if (playMode === 'quick')` decay and the `else` increment, plus the entire "Combo heal" block that follows
  - Remove the `if (turnState.ascensionComboResetsOnTurnEnd)` block at turn end (lines ~1444-1447)
  - Remove the exported `getComboMultiplier(comboCount)` function at bottom of file (lines ~1553-1557)
  - Update all `resolveCardEffect` call sites to remove the `comboCount` positional argument (was 4th arg). Pass `1` as a neutral multiplier or restructure as per task 2 — the function no longer takes this arg.
  - In `PlayCardResult` callsites that spread `comboCount`, remove those fields
  **Acceptance:** `TurnState` has no `comboCount`, `baseComboCount`, `ascensionComboResetsOnTurnEnd`. `PlayCardResult` has no `comboCount`. `getComboMultiplier` is not exported. `resolveComboStartValue` not called.

- [x] 4. Remove Echo spawning and Echo card logic from `encounterBridge.ts`
  **Files:** `src/services/encounterBridge.ts`
  **What:**
  - Remove import of `applyEchoStabilityBonus` from `../ui/stores/playerData` (line ~17)
  - Remove import of `ECHO` from `../data/balance` (from the line ~24 import)
  - Delete `createEchoCardFrom(card: Card): Card` function (lines ~492-505)
  - Delete `maybeGenerateEcho(card, wasCorrect, playMode)` function (lines ~508-522)
  - Remove the `maybeGenerateEcho(playedCard, correct, playMode)` call (line ~654)
  - Remove the two Echo-specific post-play branches:
    - `if (playedCard.isEcho && correct && playMode === 'charge' && run)` block (lines ~614-617): applyEchoStabilityBonus + echoFactIds.delete
    - `if (playedCard.isEcho && !correct && playMode === 'charge' && activeDeck)` block (lines ~621-...): exhaust echo card
  **Acceptance:** `encounterBridge.ts` does not import or call `applyEchoStabilityBonus`, `ECHO`, `createEchoCardFrom`, `maybeGenerateEcho`. No `isEcho` checks in post-play logic.

- [x] 5. Remove `echoFactIds`, `echoCount` from `RunState` and `runManager.ts`
  **Files:** `src/services/runManager.ts`, `src/services/runSaveService.ts`
  **What — `runManager.ts`:**
  - Remove `echoFactIds: Set<string>` and `echoCount: number` from the `RunState` interface (lines ~51-52)
  - Remove `echoFactIds: new Set<string>()` and `echoCount: 0` from the initial run state (lines ~206-207)
  - Remove `if (comboCount > state.bestCombo) state.bestCombo = comboCount` (line ~274) — `bestCombo` tracking must stay but now updates via chain length or score, not comboCount. Update the comment and the source of this value to track `chainLength` or simply leave `bestCombo` always as 0 until AR-202 replaces it with a Cursed-system stat. For now: remove the `comboCount`-based update; leave `bestCombo: 0` in the run state.
  **What — `runSaveService.ts`:**
  - Remove `echoFactIds: string[]` from the serialized run type (line ~51)
  - Remove `echoFactIds: [...run.echoFactIds]` from the serialize function (line ~70)
  - Remove `echoFactIds: new Set(saved.echoFactIds)` from the deserialize function (line ~91)
  - Remove `'echoFactIds'` from the Set-field union type (line ~49)
  **Acceptance:** `RunState` has no `echoFactIds`, `echoCount`. Serialize/deserialize round-trips compile without those fields. `bestCombo` remains in `RunState` but is no longer updated from `comboCount`.

- [x] 6. Remove Echo from `card-types.ts` and `cardUpgradeService.ts`
  **Files:** `src/data/card-types.ts`, `src/services/cardUpgradeService.ts`
  **What — `card-types.ts`:**
  - Remove `isEcho?: boolean` field from the `Card` interface (line ~78)
  - Remove the JSDoc comment referencing Echo Chamber on the `originalBaseEffectValue` field (line ~87) — clean up the comment, keep the field if it's used elsewhere, or remove if only Echo used it
  **What — `cardUpgradeService.ts`:**
  - Remove all three `if (card.isEcho) return false` guards (lines ~113, ~127, ~247) — these blocked Echo cards from upgrade/downgrade paths. Without `isEcho`, these checks are dead code.
  **Acceptance:** `Card` type has no `isEcho` field. `cardUpgradeService.ts` has no `isEcho` references.

- [x] 7. Remove Echo and Combo relics and synergies
  **Files:** `src/data/relics/starters.ts`, `src/data/relics/unlockable.ts`, `src/services/relicSynergyResolver.ts`, `src/services/saveMigration.ts`
  **What — `starters.ts`:**
  - Remove the `combo_ring` relic definition (lines ~93-107). It is a starter relic but its entire mechanic (`comboRingActive`, `resolveComboStartValue`) is being deleted.
  **What — `unlockable.ts`:**
  - Remove the `echo_lens` relic definition (lines ~378-392). This is the only item in the `// === ECHO RELICS ===` section; remove that section header too.
  - Keep `echo_chamber` — it is a chain relic, not an Echo Card relic.
  **What — `relicSynergyResolver.ts`:**
  - Remove the `echo_master` synergy entry (lines ~87-91): `{ id: 'echo_master', name: 'Echo Master', requiredRelicIds: ['echo_lens', 'combo_ring'], tier: 2 }`
  **What — `saveMigration.ts`:**
  - Change `echo_lens: { action: 'preserve' }` to `echo_lens: { action: 'drop' }` (line ~45)
  - Change `combo_ring: { action: 'preserve' }` to `combo_ring: { action: 'drop' }` (line ~60)
  **Acceptance:** `combo_ring` and `echo_lens` not in relic catalogue. `echo_master` synergy deleted. `saveMigration.ts` drops both relics on save load. `echo_chamber` still present and untouched.

- [x] 8. Remove Echo and Combo from `relicEffectResolver.ts`
  **Files:** `src/services/relicEffectResolver.ts`
  **What:**
  - Remove `comboCount: number` from the `AttackModifierContext` interface (line ~179)
  - Remove the `war_drum` handler block (lines ~233-236): `if (relicIds.has('war_drum')) { flatDamageBonus += Math.min(context.comboCount, 3); }` — `war_drum` is already dropped from the catalogue; this dead resolver block must also go
  - Remove `comboRingActive?: boolean` from `AttackModifierContext` (line ~193-196)
  - Remove the `combo_ring` attack modifier handler (lines ~323-325): `if (relicIds.has('combo_ring') && context.comboRingActive) {`
  - Delete the entire `resolveComboStartValue(relicIds)` exported function (lines ~856-868) — it referenced `echo_master` synergy and `combo_ring`
  - Delete the `shouldEchoPlayFullPower(relicIds)` exported function (lines ~922-925) — only used by Echo system
  - Remove `comboRingActive: boolean` from the `ChargeCorrectContext` / `ChargeCorrectResult` interfaces (lines ~1016-1019, ~1045)
  - Remove `const comboRingActive = relicIds.has('combo_ring') && context.isFirstChargeThisTurn` (line ~1099) and the `comboRingActive` field from the return value (line ~1125)
  - Remove the `echo_master` synergy reference in the JSDoc comment above `resolveComboStartValue` (this function is being deleted, so the comment goes with it)
  - Keep `echo_chamber` handler in `resolveChainRewards` intact — it is chain-based, not combo/echo
  **Acceptance:** `relicEffectResolver.ts` exports no `resolveComboStartValue`, `shouldEchoPlayFullPower`. `AttackModifierContext` has no `comboCount`, `comboRingActive`. `ChargeCorrectResult` has no `comboRingActive`. No `war_drum`, `combo_ring`, `echo_lens`, `echo_master` references.

- [x] 9. Remove Echo UI from `CardHand.svelte` and `CardExpanded.svelte`
  **Files:** `src/ui/components/CardHand.svelte`, `src/ui/components/CardExpanded.svelte`
  **What — `CardHand.svelte`:**
  - Remove `comboMultiplier?: number` prop (line ~34) and its default `comboMultiplier = 1` (line ~66)
  - Remove `let isHighCombo = $derived(comboMultiplier > 1)` or equivalent derived (line ~171)
  - Remove `class:card-combo={comboMultiplier > 1 && ...}` from both card element sites (lines ~709, ~1063)
  - Remove the two `{#if card.isEcho}` blocks that render the echo badge and "CHARGE ONLY" badge (lines ~795-801 and ~1159-1165)
  - Remove the `.echo-card`, `.echo-badge`, `.echo-charge-label`, `.echo-charge-only-badge` CSS classes and their `echo-shimmer` keyframes (lines ~1836-2040 approximately)
  - Remove `.card-combo` CSS class (line ~1519)
  **What — `CardExpanded.svelte`:**
  - Remove `comboCount: number` from props interface (line ~22) and from destructuring (line ~43)
  - Remove `{#if comboCount > 0} <div class="combo-indicator">...</div>` block (lines ~471-473)
  - Remove `.combo-indicator` CSS (line ~900 area)
  **Acceptance:** `CardHand.svelte` accepts no `comboMultiplier` prop. No echo badge or "CHARGE ONLY" badge rendered. No `.echo-card`, `.card-combo` CSS. `CardExpanded.svelte` accepts no `comboCount`. No combo indicator rendered.

- [x] 10. Remove Combo UI from `CardCombatOverlay.svelte` and `ComboCounter.svelte`
  **Files:** `src/ui/components/CardCombatOverlay.svelte`, `src/ui/components/ComboCounter.svelte`
  **What — `CardCombatOverlay.svelte`:**
  - Remove import of `getComboMultiplier` from `../../services/turnManager` (line ~7)
  - Remove `import ComboCounter from './ComboCounter.svelte'` (line ~25)
  - Remove `let comboCount = $derived(...)` and `let comboMultiplier = $derived(getComboMultiplier(comboCount))` (lines ~203-204)
  - Remove the `// V2 Echo: "Must Charge!" tooltip state` section and the `mustChargeTooltip` state variable (line ~94 area)
  - Remove the `onComboScreenEdge` handler in the arena layout (line ~643)
  - Remove all `comboCount: (turnState?.comboCount ?? 0) + 1` optimistic-update lines in pre-play state (line ~1112)
  - Remove `const nextCombo = isCorrect ? ... : 0` and `comboCount: nextCombo` / `comboCount: 0` from `handleAnswer` logic (lines ~1223, ~1248, ~1310)
  - Remove `comboCount={turnState.comboCount}` prop passed to `QuizOverlay` (line ~1705)
  - Remove `{#if comboCount >= 4 && cardPlayStage !== 'committed'}` screen-edge-pulse block (lines ~1732-1734)
  - Remove `<ComboCounter count={comboCount} multiplier={comboMultiplier} .../>` (line ~1759)
  - Remove `{comboMultiplier}` prop passed to `<CardHand>` (line ~1768)
  - Remove the two "V2 Echo: block Quick Play on Echo cards" blocks that show the `mustChargeTooltip` (lines ~1050-1054 and ~1082-1084)
  - Remove the `/* V2 Echo: "Must Charge!" tooltip */` CSS block (line ~2799 area)
  - Remove the `/* Combo counter: stacked above End Turn */` CSS block (line ~2920 area)
  - Remove the `/* .screen-edge-pulse */` CSS if it is only triggered by the removed `comboCount >= 4` condition
  **What — `ComboCounter.svelte`:**
  - The component currently only renders chain info (the combo count/multiplier props exist but only chain display is shown). Remove `count: number` and `multiplier: number` from `Props` interface (lines ~5-6) and their destructuring (line ~13). These are now unused since all combo display is gone.
  - Keep the chain display logic (lines ~28-38) and all chain-related props (`chainLength`, `chainType`, `chainMultiplier`) — these are part of the Chain system, not Combo.
  - Rename the component to `ChainCounter.svelte` and update the import in `CardCombatOverlay.svelte` accordingly — this avoids future confusion between the two systems.
  **Acceptance:** `CardCombatOverlay.svelte` has no `comboCount`, `comboMultiplier`, `getComboMultiplier`, `ComboCounter` import, Echo "Must Charge!" tooltip. No screen-edge-pulse triggered by combo. `ComboCounter.svelte` (or `ChainCounter.svelte`) accepts no `count`/`multiplier` props.

- [x] 11. Remove Combo from `cardEffectResolver.ts` import in `comboDisplay.ts` and clean up util
  **Files:** `src/ui/utils/comboDisplay.ts`
  **What:**
  - Delete the entire file. `formatComboMultiplier` and `getComboDisplayText` are used only by `ComboCounter.svelte` (task 10) and `CardCombatOverlay.svelte` (task 10). After those are removed, this file has no callers.
  - Verify no other file imports from `../../ui/utils/comboDisplay` before deleting.
  **Acceptance:** `src/ui/utils/comboDisplay.ts` does not exist. No other file imports from it.

- [x] 12. Remove Combo from `encounterRewards.ts` and reward UI
  **Files:** `src/services/encounterRewards.ts`, `src/ui/components/CardRewardScreen.svelte`, `src/services/encounterBridge.ts`, `src/services/gameFlowController.ts`
  **What — `encounterRewards.ts`:**
  - Remove `comboBonus: number` from `EncounterRewardOptions` interface (line ~18)
  - Delete `generateComboBonus(maxComboAchieved)` function (lines ~76-78)
  - Remove `comboBonus: generateComboBonus(maxComboAchieved)` from `buildEncounterRewards` (line ~98)
  - Remove `maxComboAchieved: number` parameter from `buildEncounterRewards` signature (line ~93)
  **What — `CardRewardScreen.svelte`:**
  - Remove `{#if bundle.comboBonus > 0} <div class="step-bonus">...</div>` block (lines ~322-324)
  - Remove the `playCardAudio('combo-3')` call if it fires only on combo thresholds (line ~248)
  **What — `encounterBridge.ts` and `gameFlowController.ts`:**
  - Remove `maxComboAchieved` argument from any `buildEncounterRewards(...)` call sites
  **Acceptance:** `EncounterRewardOptions` has no `comboBonus`. `generateComboBonus` deleted. No combo bonus displayed in reward screen.

- [x] 13. Remove Combo from `ascension.ts`
  **Files:** `src/services/ascension.ts`
  **What:**
  - Remove `comboResetsOnTurnEnd: boolean` from `AscensionModifiers` interface (line ~46)
  - Remove `comboHealThreshold: number` and `comboHealAmount: number` from `AscensionModifiers` interface (lines ~65-66)
  - Remove `comboResetsOnTurnEnd: l >= 14` from `getAscensionModifiers` return (line ~101)
  - Remove `comboHealThreshold: l >= 6 ? 3 : 0` and `comboHealAmount: l >= 6 ? 5 : 0` from `getAscensionModifiers` return (lines ~119-120)
  - The level 6 and level 14 ascension descriptions reference combo — update those description strings in the `ascensionLevels` array (lines ~17, ~25): replace "BUFF: Heal 5 HP on 3+ combo" and "Combo resets each turn. BUFF: Perfect turns grant +1 AP next turn" with descriptions that don't reference combo
  **Acceptance:** `AscensionModifiers` has no `comboResetsOnTurnEnd`, `comboHealThreshold`, `comboHealAmount`. No combo references in ascension level descriptions.

- [x] 14. Remove Echo from `gameFlowController.ts` and `deckManager.ts`
  **Files:** `src/services/gameFlowController.ts`, `src/services/deckManager.ts`
  **What — `gameFlowController.ts`:**
  - Remove all four `!card.isEcho` filter guards (lines ~1394, ~2199, ~2208, ~2217) — mastery upgrade candidates, card removal candidates, and card transformation candidates no longer need to exclude Echo cards because Echo cards no longer exist
  **What — `deckManager.ts`:**
  - Remove `comboCount: 0` from the initial deck state if present (line ~117) — this is likely the `DeckRunState.comboCount` used as a tracker; verify it's not a different field before removing
  **Acceptance:** `gameFlowController.ts` has no `isEcho` references. `deckManager.ts` has no `comboCount` field in deck state.

- [x] 15. Remove `applyEchoStabilityBonus` from `playerData.ts`
  **Files:** `src/ui/stores/playerData.ts`
  **What:**
  - Delete the exported `applyEchoStabilityBonus(factId, multiplier)` function (lines ~637-657)
  **Acceptance:** `playerData.ts` does not export `applyEchoStabilityBonus`.

- [x] 16. Remove `echo` keyword from `keywords.ts`
  **Files:** `src/data/keywords.ts`
  **What:**
  - Remove the `echo` entry from `KEYWORD_DEFINITIONS` (lines ~40-43):
    ```
    echo: {
      name: 'Echo',
      description: 'A ghostly copy of a card. Fades after use.',
    },
    ```
  **Acceptance:** `KEYWORD_DEFINITIONS` has no `echo` key.

- [x] 17. Remove Combo and Echo from `scenarioSimulator.ts`
  **Files:** `src/dev/scenarioSimulator.ts`
  **What:**
  - Remove `comboMultiplier?: number` from the scenario config type (line ~112)
  - Remove `/** Combo multiplier override (combat). */` JSDoc (line ~111)
  - Remove the `// Combo multiplier` block that applies `config.comboMultiplier` to `ts.comboMultiplier` (lines ~594-597) — `TurnState` will no longer have this field
  - Remove `'combat-high-combo'` scenario definition (lines ~287-293) — it exists only to test combo state
  - Remove `setCombo(multiplier)` function (lines ~1310-1318) and its registration in the API object (line ~1488)
  - Remove `__terraScenario.setCombo(multiplier)` from the help text (line ~1387)
  - Remove `comboMultiplier: 5` from scenario fixtures that use it (line ~291)
  - Update scenario fixtures that include `relics: ['combo_ring', ...]` (lines ~150, ~182, ~239, ~292, ~298, ~361) to remove `'combo_ring'` from each array
  - Remove `isEcho: false` fields from inline card fixtures (lines ~882, ~1006) — once `isEcho` is removed from the `Card` type, these will be type errors
  - Remove `bestCombo` from scenario runEnd stats only if those stats no longer need it — keep `bestCombo` in `runEndStats` fixtures since it's a valid historical stat (lines ~264, ~270, ~276, ~944)
  **Acceptance:** `scenarioSimulator.ts` has no `comboMultiplier` config field, no `setCombo` function, no `'combat-high-combo'` scenario, no `isEcho` on card fixtures, no `combo_ring` in relic arrays.

- [x] 18. Delete `echo-mechanic-v2.test.ts` and remove Echo/Combo from test files
  **Files:** `src/services/echo-mechanic-v2.test.ts`, `src/services/__tests__/relicEffectResolver.v2.test.ts`, `src/services/bossQuizPhase.test.ts`, `src/services/relicAcquisition.test.ts`
  **What:**
  - Delete `src/services/echo-mechanic-v2.test.ts` entirely — the system it tests no longer exists
  - In `relicEffectResolver.v2.test.ts`: remove `describe('combo_ring', ...)` block (lines ~169-199) and `describe('echo_chamber', ...)` block (lines ~315-330) — wait, `echo_chamber` stays; only remove the `combo_ring` describe block. Keep `echo_chamber` tests.
  - In `bossQuizPhase.test.ts`: remove `echoFactIds: new Set()` and `echoCount: 0` from the test run state fixture (lines ~147-148)
  - In `relicAcquisition.test.ts`: remove `expect(ids).toContain('echo_chamber')` if the test is checking level-gated relics that included `echo_lens` — verify the test still passes after removing `echo_lens` from the catalogue
  **Acceptance:** `echo-mechanic-v2.test.ts` deleted. `relicEffectResolver.v2.test.ts` has no `combo_ring` describe block. Test suite passes with `npx vitest run`.

- [x] 19. Remove Echo and Combo from remaining service files
  **Files:** `src/services/saveMigration.ts`, `src/services/characterLevel.ts`
  **What — `saveMigration.ts`:**
  - The `echo_lens: { action: 'drop' }` and `combo_ring: { action: 'drop' }` changes are already specified in task 7. No additional changes needed here.
  **What — `characterLevel.ts`:**
  - Level 3 reward entry includes `relicIds: ['echo_chamber']` — keep this, `echo_chamber` stays
  - Level 24 reward entry includes `relicIds: ['toxic_bloom', 'echo_lens']` — remove `'echo_lens'` from this array (line ~187)
  **Acceptance:** `characterLevel.ts` level 24 reward does not include `echo_lens`.

- [x] 20. Update `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md`
  **Files:** `docs/GAME_DESIGN.md`, `docs/ARCHITECTURE.md`
  **What — `GAME_DESIGN.md`:**
  - Remove the Echo Mechanic section (likely §11 or similar) — all documentation of Echo card spawning, `isEcho` flag, `echo_lens` relic, FSRS stability bonus path
  - Remove the Combo System section — all documentation of `comboCount`, `COMBO_MULTIPLIERS`, combo decay, combo heal
  - Update the Relics section to remove `combo_ring` and `echo_lens` entries
  - Update the Ascension section to remove combo-related level 6 and level 14 modifiers
  - Add a note that `echo_chamber` (chain relic) is distinct from the removed Echo Card system
  **What — `ARCHITECTURE.md`:**
  - Remove references to `echoFactIds`, `echoCount` in `RunState` documentation
  - Remove references to `comboCount`, `baseComboCount` in `TurnState` documentation
  - Remove `resolveEchoBase`, `getComboMultiplier`, `resolveComboStartValue` from service layer descriptions
  **Acceptance:** Neither doc references the removed systems. `echo_chamber` is correctly documented as a chain relic.

- [x] 21. Update `data/inspection-registry.json`
  **Files:** `data/inspection-registry.json`
  **What:**
  - Find the Echo system entry in the `systems` table and set `status: "deprecated"`, `lastChangedDate: "2026-03-21"`
  - Find the `combo_ring` entry in the `relics` table and set `status: "deprecated"`, `lastChangedDate: "2026-03-21"`
  - Find the `echo_lens` entry in the `relics` table and set `status: "deprecated"`, `lastChangedDate: "2026-03-21"`
  - Find the `echo_master` synergy entry (if present in the registry) and set `status: "deprecated"`
  - Update `lastChangedDate` for `cardEffectResolver`, `turnManager`, `encounterBridge`, `deckManager` systems entries to `"2026-03-21"`
  **Acceptance:** Registry reflects all deprecated elements. No live system entry still references Echo card spawning or combo multiplier tracking.

---

## Testing Plan

1. **Typecheck:** `npm run typecheck` — must pass with zero errors. This is the primary verification gate since the changes are purely removal of typed fields and functions.

2. **Unit tests:** `npx vitest run` — all 1900+ tests must pass. Key test files to watch:
   - `src/services/echo-mechanic-v2.test.ts` — must be deleted (task 18)
   - `src/services/__tests__/relicEffectResolver.v2.test.ts` — `combo_ring` describe block removed, `echo_chamber` tests must still pass
   - `src/services/bossQuizPhase.test.ts` — fixture cleanup
   - Any test that calls `resolveCardEffect` with the old `comboCount` positional arg will fail — fix all callsites

3. **Build:** `npm run build` — must produce zero errors.

4. **Headless balance sim:** Run 500 runs across all profiles to confirm no crashes from missing state:
   ```
   npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500
   ```
   Expected: all profiles complete, no runtime errors about missing `comboCount`, `isEcho`, or `echoFactIds`.

5. **Visual spot-check:** Load `combat-basic` scenario in Playwright and confirm:
   - No "CHARGE ONLY" badge visible on any card
   - No echo shimmer animation on any card
   - No combo counter UI element in the combat HUD
   - No JS console errors about missing `comboCount` or `isEcho` properties

---

## Verification Gate

All of the following must be true before this AR is considered complete:

- [x] `npm run typecheck` — zero errors
- [x] `npx vitest run` — all tests pass
- [x] `npm run build` — zero errors
- [x] `grep -r "isEcho" src/ --include="*.ts" --include="*.svelte"` — zero results
- [x] `grep -r "comboCount" src/ --include="*.ts" --include="*.svelte"` — zero results (exception: `bestCombo` is allowed, `comboCount` is not)
- [x] `grep -r "ECHO\." src/ --include="*.ts"` — zero results
- [x] `grep -r "COMBO_MULTIPLIERS\|COMBO_HEAL\|COMBO_DECAY\|COMBO_RING" src/ --include="*.ts"` — zero results
- [x] `grep -r "echo_lens\|combo_ring\|echo_master" src/data/relics/ --include="*.ts"` — zero results
- [x] `grep -r "resolveComboStartValue\|getComboMultiplier\|shouldEchoPlayFullPower\|applyEchoStabilityBonus\|resolveEchoBase" src/ --include="*.ts"` — zero results
- [x] `combo_ring` and `echo_lens` in `saveMigration.ts` have `action: 'drop'`
- [x] `echo_chamber` relic definition still exists in `unlockable.ts`
- [x] Headless sim 500 runs complete without runtime errors
- [x] Playwright visual check: no echo badges, no combo counter

---

## Files Affected

| File | Change Type |
|------|-------------|
| `src/data/balance.ts` | Remove `ECHO`, `COMBO_*` constants, `comboMultipliers` from `BalanceOverrides` |
| `src/data/card-types.ts` | Remove `isEcho?: boolean` from `Card` interface |
| `src/data/keywords.ts` | Remove `echo` keyword definition |
| `src/data/relics/starters.ts` | Remove `combo_ring` relic definition |
| `src/data/relics/unlockable.ts` | Remove `echo_lens` relic definition |
| `src/services/cardEffectResolver.ts` | Remove `comboCount` param, `resolveEchoBase`, combo multiplier from formula, `isEcho` branch, `correct`/`playMode` from `AdvancedResolveOptions` |
| `src/services/turnManager.ts` | Remove `comboCount`, `baseComboCount`, `ascensionComboResetsOnTurnEnd` from `TurnState`; remove combo build/decay/heal logic; remove `getComboMultiplier` export |
| `src/services/encounterBridge.ts` | Remove `createEchoCardFrom`, `maybeGenerateEcho`, Echo post-play branches |
| `src/services/runManager.ts` | Remove `echoFactIds`, `echoCount` from `RunState`; remove bestCombo update from comboCount |
| `src/services/runSaveService.ts` | Remove `echoFactIds` from serialized run state |
| `src/services/relicEffectResolver.ts` | Remove `war_drum` handler, `combo_ring` handler, `resolveComboStartValue`, `shouldEchoPlayFullPower`, `comboCount`/`comboRingActive` from contexts |
| `src/services/relicSynergyResolver.ts` | Remove `echo_master` synergy |
| `src/services/ascension.ts` | Remove `comboResetsOnTurnEnd`, `comboHealThreshold`, `comboHealAmount` from modifiers |
| `src/services/cardUpgradeService.ts` | Remove `isEcho` guards |
| `src/services/gameFlowController.ts` | Remove `!card.isEcho` filter guards |
| `src/services/deckManager.ts` | Remove `comboCount` from deck state if present |
| `src/services/encounterRewards.ts` | Remove `comboBonus` from rewards, delete `generateComboBonus` |
| `src/services/characterLevel.ts` | Remove `echo_lens` from level 24 relic reward |
| `src/services/saveMigration.ts` | Change `echo_lens` and `combo_ring` to `action: 'drop'` |
| `src/ui/stores/playerData.ts` | Delete `applyEchoStabilityBonus` |
| `src/ui/utils/comboDisplay.ts` | Delete entire file |
| `src/ui/components/CardHand.svelte` | Remove echo badge, `isEcho` checks, `comboMultiplier` prop, `.echo-card`/`.card-combo` CSS |
| `src/ui/components/CardExpanded.svelte` | Remove `comboCount` prop and combo indicator |
| `src/ui/components/CardCombatOverlay.svelte` | Remove `comboCount`/`comboMultiplier` state, `ComboCounter` import, Echo tooltip, screen-edge-pulse |
| `src/ui/components/ShopRoomOverlay.svelte` | Remove `isEcho` filter (`nonEchoCards` derived store) |
| `src/game/scenes/CombatScene.ts` | Remove `comboCount` references |
| `src/services/playerCombatState.ts` | Remove `comboCount` from combat state interface |
| `src/services/juiceManager.ts` | Remove combo-triggered juice effects |
| `src/services/cardDescriptionService.ts` | Remove combo references in card descriptions |
| `src/ui/stores/gameState.ts` | Remove `comboCount` tracking state |
| `src/services/analyticsService.ts` | Remove combo analytics events |
| `src/ui/components/RunEndScreen.svelte` | Rename "Best Combo" label to "Best Chain" (keep `bestCombo` stat value) |
| `src/ui/components/ComboCounter.svelte` | Remove `count`/`multiplier` props; rename to `ChainCounter.svelte` |
| `src/ui/components/CardRewardScreen.svelte` | Remove `comboBonus` display |
| `src/dev/scenarioSimulator.ts` | Remove `comboMultiplier` config, `setCombo`, `'combat-high-combo'` scenario, `combo_ring` from relic arrays, `isEcho` on card fixtures |
| `src/services/echo-mechanic-v2.test.ts` | **Delete** |
| `src/services/__tests__/relicEffectResolver.v2.test.ts` | Remove `combo_ring` describe block |
| `src/services/bossQuizPhase.test.ts` | Remove `echoFactIds`/`echoCount` from fixture |
| `src/services/relicAcquisition.test.ts` | Remove `echo_lens`-dependent assertions |
| `docs/GAME_DESIGN.md` | Remove Echo system and Combo system documentation sections |
| `docs/ARCHITECTURE.md` | Remove Echo/Combo state field documentation |
| `data/inspection-registry.json` | Deprecate Echo system, `combo_ring`, `echo_lens`, `echo_master`; update `lastChangedDate` on changed systems |

---

## Doc Updates Required

- **`docs/GAME_DESIGN.md`:** Remove Echo Mechanic section, remove Combo System section, remove `combo_ring` and `echo_lens` from relics table, update ascension level 6 and 14 descriptions, add note that `echo_chamber` is a chain relic (not Echo system)
- **`docs/ARCHITECTURE.md`:** Remove `echoFactIds`/`echoCount` from RunState docs, remove `comboCount`/`baseComboCount` from TurnState docs, remove the three deleted service functions from architecture descriptions
- **`data/inspection-registry.json`:** See task 21
