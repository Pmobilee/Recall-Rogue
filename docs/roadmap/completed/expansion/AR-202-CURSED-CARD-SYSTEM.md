# AR-202: Cursed Card System

**Source:** `docs/RESEARCH/EXPANSION_FINAL_PRODUCTION.md` — Part 1 §1C, Part 6, Appendix F
**Priority:** Critical — core expansion mechanic, blocks AR-206/207/208
**Estimated complexity:** High (3–4 days)
**Depends on:** AR-201 (Echo system removal — `echoFactIds`, `echoCount`, `isEcho`, `ECHO.*` must be gone before this lands)
**Blocks:** AR-206, AR-207, AR-208 (Dark Knowledge card, Scar Tissue relic, and all cards that interact with cursed state require this system working first)

---

## Overview

The old Echo system let players exploit intentional wrong answers as free deck-thinning, and removed cards for the facts players most needed to practice — the opposite of spaced repetition. The Cursed Card system replaces it entirely.

**Core principle:** When a player answers wrong on a mastery 0 card, the FACT is cursed (not the card slot). The cursed fact ID is tracked in `RunState.cursedFactIds: Set<string>`. Any card drawn that is assigned a cursed fact renders as Cursed — purple tint, cracked border, shimmer animation — and fires weakened multipliers (QP 0.7×, CW 0.5×, CC 1.0×). The only escape is to answer correctly on that fact in combat, which cures it and grants double FSRS credit. The fact stays in the draw pool regardless of whether its current card slot is removed via Meditate or shop — deck thinning does not remove curses. Cursed facts bypass the normal 3–5 encounter cooldown so they resurface faster for more cure opportunities. An auto-cure safety valve kicks in when 60% or more of consecutive hands are cursed, preventing complete deck saturation.

---

## TODO

### Task 1 — Add `cursedFactIds` to RunState
**Files:** `src/services/runManager.ts`

**What:**
- Replace `echoFactIds: Set<string>` and `echoCount: number` fields on `RunState` with `cursedFactIds: Set<string>`.
- In `createRunState()`, initialize: `cursedFactIds: new Set<string>()`.
- Remove the old `echoFactIds: new Set<string>()` and `echoCount: 0` initializer lines.
- Add a JSDoc comment on the field: `/** Fact IDs for which the player gave a wrong Charge on a mastery 0 card. Any card assigned one of these facts is treated as Cursed. Cured by correct Charge on the fact in combat. */`

**Acceptance criteria:**
- `RunState` has `cursedFactIds: Set<string>` and no `echoFactIds` or `echoCount` fields.
- `createRunState()` initializes `cursedFactIds: new Set()`.
- TypeScript compiles without error (`npm run typecheck`).
- Any code still referencing `runState.echoFactIds` or `runState.echoCount` is updated to use `cursedFactIds` or removed.

---

### Task 2 — Add balance constants for the Cursed system
**Files:** `src/data/balance.ts`

**What:**
Add the following exported constants (as named exports, alongside existing constants):

```typescript
// === CURSED CARD SYSTEM ===
/** QP multiplier when a card carries a cursed fact. */
export const CURSED_QP_MULTIPLIER = 0.7;
/** Charge Correct multiplier when a card carries a cursed fact (1.0 = normal — the reward IS the cure). */
export const CURSED_CHARGE_CORRECT_MULTIPLIER = 1.0;
/** Charge Wrong multiplier when a card carries a cursed fact. */
export const CURSED_CHARGE_WRONG_MULTIPLIER = 0.5;
/** FSRS repetition bonus applied on cure (correct Charge on a cursed fact). */
export const CURSED_FSRS_CURE_BONUS = 6.0;
/**
 * Auto-cure safety valve threshold. If the ratio of cursed cards in the drawn
 * hand meets or exceeds this value across 2 consecutive draws, auto-cure the
 * oldest cursed fact at encounter end (1 fact per trigger).
 */
export const CURSED_AUTO_CURE_THRESHOLD = 0.6;
/** Number of cursed facts auto-cured when the threshold is triggered. */
export const CURSED_AUTO_CURE_COUNT = 1;
```

Also remove `ECHO.*` constants (`ECHO.POWER_MULTIPLIER`, `ECHO.POWER_MULTIPLIER_WRONG`, `ECHO.RESPAWN_ON_WRONG`, `ECHO.AP_SURCHARGE`, etc.) if they still exist after AR-201. Do NOT add them back.

**Acceptance criteria:**
- All six CURSED constants are exported from `balance.ts`.
- No `ECHO.*` object or constants remain in `balance.ts`.
- `npm run typecheck` passes.

---

### Task 3 — Track cursed facts on wrong Charge in `turnManager.ts`
**Files:** `src/services/turnManager.ts`

**What:**
In the charge-wrong resolution path (the section that calls `masteryDowngrade` and handles `playMode === 'charge_wrong'`):

1. Import `activeRunState` from `'./runStateStore'` (already imported — verify it's there).
2. Import `CURSED_QP_MULTIPLIER`, `CURSED_CHARGE_CORRECT_MULTIPLIER`, `CURSED_CHARGE_WRONG_MULTIPLIER` from `'../data/balance'`.
3. After resolving a wrong Charge on a card, check these conditions IN ORDER:
   a. **Free First Charge exemption:** If `usedFreeCharge === true` on the `PlayCardResult` (meaning this was the player's first-ever Charge on this fact this run), do NOT add the fact to `cursedFactIds`. The fizzle is punishment enough. Skip all cursing logic.
   b. **Mastery 0 curse:** If the card's `masteryLevel` BEFORE this wrong answer was 0 (i.e., `card.masteryLevel === 0` at the time of play, before any downgrade), add `card.factId` to `get(activeRunState)?.cursedFactIds`.
   c. **Mastery 1+ downgrade-to-0 re-check:** If the card's mastery was 1 and was just downgraded to 0, do NOT curse on this play — the downgrade IS the punishment. The next wrong answer on this fact (when it is now mastery 0) will curse.
   d. **Mastery 1+ wrong (not yet at 0):** Do NOT curse. Downgrade only.

4. The curse check must happen AFTER mastery resolution so the `masteryLevel` read is the pre-play value (capture `const preMasteryLevel = card.masteryLevel ?? 0` before calling `masteryDowngrade`).

**Implementation detail — capturing pre-play mastery level:**
In `playCard()` / the charge resolution function, before calling `canMasteryDowngrade` or `masteryDowngrade`, read and store: `const preMasteryLevel = card.masteryLevel ?? 0;`. Then use `preMasteryLevel === 0` as the curse condition.

**Acceptance criteria:**
- Wrong Charge on mastery 0 card → fact ID in `runState.cursedFactIds`.
- Wrong Charge on mastery 1+ card (not yet at 0) → mastery downgrade only, NOT cursed.
- Wrong Charge on Free First Charge → NOT cursed (fact ID not in set).
- Existing mastery downgrade behavior is unchanged.
- `npm run typecheck` and `npm run build` pass.

---

### Task 4 — Cure cursed facts on correct Charge in `turnManager.ts`
**Files:** `src/services/turnManager.ts`

**What:**
In the charge-correct resolution path:

1. Check if `card.factId` is in `get(activeRunState)?.cursedFactIds`.
2. If yes: remove it from the set (`runState.cursedFactIds.delete(card.factId)`). This is the cure.
3. Mark the cure on the `PlayCardResult` by adding a boolean field `curedCursedFact: boolean` and setting it to `true` when a cure fires. (Add `curedCursedFact?: boolean` to `PlayCardResult` interface.)
4. After cure: apply the FSRS bonus. Pass `CURSED_FSRS_CURE_BONUS` as an extra repetition weight when recording the card play to the FSRS/SM-2 scheduler. Concretely: if there is a function like `recordCardPlay(state, correct, ...)` in `runManager.ts`, pass an additional `fsrsBonus` parameter (or call the FSRS update with a higher rating/repetition count). If FSRS integration doesn't support this yet, add a `TODO(AR-202): apply CURSED_FSRS_CURE_BONUS = 6.0` comment so it can be wired in AR-212 (FSRS integration).
5. Cure DOES NOT restore mastery level — the card remains at its current mastery level after cure. The cure only removes the cursed status so the card can gain mastery normally again.

**Acceptance criteria:**
- Correct Charge on a card carrying a cursed fact → fact removed from `cursedFactIds`.
- `PlayCardResult.curedCursedFact` is `true` when a cure fires, `false`/`undefined` otherwise.
- Fact is NOT re-cursed unless another wrong-mastery-0 answer occurs on it.
- `npm run typecheck` passes.

---

### Task 5 — Cursed fact priority weighting in `deckManager.ts` `drawHand()`
**Files:** `src/services/deckManager.ts`

**What:**
In the Per-Draw Fact Shuffling block (the `if (drawn.length > 0 && deck.factPool.length > 0)` section, approximately line 230):

1. Receive the active run state's `cursedFactIds` set. Import `activeRunState` from `'./runStateStore'` and read it with `get(activeRunState)`. Store as `const cursedFactIds: Set<string> = get(activeRunState)?.cursedFactIds ?? new Set()`.
2. **Cooldown exemption:** When building `availableFacts`, cursed facts bypass the cooldown filter. Specifically, in the `.filter()` that removes cooldown entries, add an exemption: `|| cursedFactIds.has(fId)`. A cursed fact is always eligible regardless of `factCooldown` entries.
3. **Weighted priority shuffle:** When building `shuffledFacts`, apply a weight boost to cursed facts. Before or after the existing `weightedFactShuffle`/`seededShuffled` call, re-sort `factsToUse` so cursed facts appear earlier in the candidate list. Use a simple weighted Fisher-Yates where cursed facts have 3× weight vs. non-cursed (weight 1). This gives higher chance to appear but is NOT a guarantee. Use the seeded RNG fork `'facts'` when active.
4. The existing duplicate/root-ID deduplication logic remains unchanged — a cursed fact still won't appear twice in the same hand.

**Implementation note:** The simplest correct approach is: after building `candidateFacts`, do a biased selection pass: when picking each card's fact, give cursed facts a 3× selection weight during the `candidateFacts.findIndex(...)` scan. A pragmatic approximation is to prepend all cursed available facts to the front of `candidateFacts` before the existing `pickCandidateFactId` function runs — this gives them priority without breaking the existing duplicate-avoidance logic.

**Acceptance criteria:**
- Cursed facts are NOT filtered out by the fact cooldown system (they bypass the 3-5 encounter cooldown).
- Cursed facts appear in draws more frequently than uncursed facts (weighted priority, not guaranteed).
- No cursed fact appears twice in the same hand (existing deduplication unchanged).
- Hand size, draw smoothing, hand composition guard, and tag magnet bias are all unaffected.
- `npm run typecheck` passes.

---

### Task 6 — Apply Cursed multipliers in `cardEffectResolver.ts`
**Files:** `src/services/cardEffectResolver.ts`

**What:**
The cursed state is determined at draw time (in `drawHand`) and stored on the card as a flag. Add `isCursed?: boolean` to the `Card` type (see Task 7). In `resolveCardEffect()`:

1. Import `CURSED_QP_MULTIPLIER`, `CURSED_CHARGE_CORRECT_MULTIPLIER`, `CURSED_CHARGE_WRONG_MULTIPLIER` from `'../data/balance'`.
2. After determining `playMode` and before computing `mechanicBaseValue`, check `card.isCursed`. If true, apply:
   - `playMode === 'quick'` or `'quick_play'` → multiply `mechanicBaseValue` by `CURSED_QP_MULTIPLIER` (0.7×) after it is computed.
   - `playMode === 'charge_correct'` or `'charge'` with `correct === true` → multiply by `CURSED_CHARGE_CORRECT_MULTIPLIER` (1.0× — no change, but explicit for clarity).
   - `playMode === 'charge_wrong'` → multiply by `CURSED_CHARGE_WRONG_MULTIPLIER` (0.5×).
3. The cursed multiplier is applied to `mechanicBaseValue` AFTER mastery bonus is added but BEFORE tier/combo/chain/relic multipliers. This is consistent with how `resolveEchoBase` worked for Echo cards.
4. Remove the old `resolveEchoBase()` function and all `card.isEcho` checks (should already be done in AR-201 — verify and clean up any remaining references).
5. Add a `Scar Tissue` relic hook stub: `if (card.isCursed && activeRelicIds.has('scar_tissue')) { cursedQpMult = 0.85; }` — this overrides `CURSED_QP_MULTIPLIER` for QP plays only when the player holds the Scar Tissue relic. The constant value 0.85 is hardcoded per spec (AR-203 can move it to balance.ts if needed).

**Appendix F ruling (implement exactly):**
- Cursed CC multiplier is 1.0× — cure is the reward, not a power boost.
- Cursed QP is 0.7× (or 0.85× with Scar Tissue).
- Cursed CW is 0.5×.

**Acceptance criteria:**
- `isCursed: true` card QP = 0.7× expected base value (or 0.85× with Scar Tissue active).
- `isCursed: true` card CC = 1.0× expected base value (same as non-cursed).
- `isCursed: true` card CW = 0.5× expected base value.
- Non-cursed cards are unaffected.
- No `resolveEchoBase` or `isEcho` references remain.
- `npm run typecheck` passes.

---

### Task 7 — Add `isCursed` flag to Card type and set it in `drawHand()`
**Files:** `src/data/card-types.ts`, `src/services/deckManager.ts`

**What:**

In `src/data/card-types.ts`:
- Add `isCursed?: boolean` to the `Card` interface. Default is `undefined`/`false` = not cursed.
- Add a JSDoc comment: `/** True when the fact assigned to this card is currently in the run's cursedFactIds set. Set per-draw in drawHand(). Cleared when the fact is cured. */`

In `src/services/deckManager.ts`, in the Per-Draw Fact Shuffling section after `card.factId = factId` is assigned:
- After assigning the fact, immediately check: `card.isCursed = cursedFactIds.has(factId);`
- This means `isCursed` is refreshed every draw — if the fact was cured since the last draw, the card will correctly show as not cursed.

**Mastery upgrade block for cursed cards:**
- In `src/services/cardUpgradeService.ts`, in `canMasteryUpgrade(card)`, add after the `isEcho` check (which should be removed by AR-201): `if (card.isCursed) return false;`
- Cursed cards cannot gain mastery until cured. They are at effective mastery 0 for upgrade purposes.
- `canMasteryDowngrade(card)` is NOT affected — cursed cards can still downgrade if mastery > 0.

**Acceptance criteria:**
- `Card` type has `isCursed?: boolean`.
- After `drawHand()`, cards assigned a cursed fact have `isCursed === true`.
- After cure, the next `drawHand()` produces that card with `isCursed === false`/`undefined`.
- `canMasteryUpgrade` returns `false` for cursed cards.
- `npm run typecheck` passes.

---

### Task 8 — Auto-cure safety valve
**Files:** `src/services/deckManager.ts` (or `src/services/encounterBridge.ts` — wherever encounter-end logic lives)

**What:**
Track consecutive draw counts where the cursed-card ratio meets or exceeds `CURSED_AUTO_CURE_THRESHOLD` (0.6 = 60%). When two consecutive draws both exceed this threshold, auto-cure the oldest cursed fact at encounter end.

**Implementation:**
1. Add `consecutiveCursedDraws: number` to `CardRunState` (in `src/data/card-types.ts`). Initialize to `0` in `createDeck()`.
2. At the end of `drawHand()`, after assigning `isCursed` flags, compute: `const cursedCount = deck.hand.filter(c => c.isCursed).length; const ratio = deck.hand.length > 0 ? cursedCount / deck.hand.length : 0;`
3. If `ratio >= CURSED_AUTO_CURE_THRESHOLD` (import from balance.ts): increment `deck.consecutiveCursedDraws`. Else: reset to `0`.
4. If `deck.consecutiveCursedDraws >= 2`: schedule auto-cure. Set a flag `deck.pendingAutoCure = true` (add `pendingAutoCure?: boolean` to `CardRunState`). Do NOT cure immediately — cure at encounter end to avoid mid-encounter state corruption.
5. At encounter end (in `encounterBridge.ts` or wherever `addFactsToCooldown` / encounter cleanup runs): if `deck.pendingAutoCure === true` and `runState.cursedFactIds.size > 0`, remove the oldest entry from `cursedFactIds`. "Oldest" = the first entry when iterating the Set (Sets in JS preserve insertion order). Log: `console.log('[cursed] auto-cure safety valve: removed oldest cursed fact')`. Reset `deck.pendingAutoCure = false` and `deck.consecutiveCursedDraws = 0`.
6. Auto-cure cures exactly `CURSED_AUTO_CURE_COUNT = 1` fact per trigger.

**Acceptance criteria:**
- Two consecutive draws with 60%+ cursed cards → oldest cursed fact removed at encounter end.
- Auto-cure resets consecutive counter so it doesn't fire every encounter once triggered.
- A single high-cursed draw (without two consecutive) does NOT trigger auto-cure.
- Auto-cure does NOT fire if `cursedFactIds` is empty.
- `npm run typecheck` passes.

---

### Task 9 — Mastery Surge interaction (wasted on cursed cards)
**Files:** `src/services/cardEffectResolver.ts` or wherever `mastery_surge` mechanic is resolved

**What:**
Per spec (Appendix F: "Mastery Surge on cursed card — Wasted"): when `mastery_surge` targets a card in hand that has `isCursed === true`, the mastery boost has no effect (cursed facts are locked at effective mastery 0).

If `mastery_surge` is not yet implemented (it's a Phase 1 card), add a comment stub: `// TODO(AR-203): mastery_surge must skip cards where isCursed === true — per Appendix F`.

If it IS implemented: in the mechanic's resolution, when iterating hand cards to apply +1 mastery, add: `if (candidate.isCursed) continue;`

**Acceptance criteria:**
- `mastery_surge` does not apply mastery to cursed cards.
- If not yet implemented, comment stub is in place.

---

### Task 10 — Cursed card visual state in `CardHand.svelte`
**Files:** `src/ui/components/CardHand.svelte`, `src/ui/components/CardExpanded.svelte` (if it exists), card CSS (likely inline `<style>` in CardHand.svelte or a shared card CSS file)

**What:**
Add visual treatment for cursed cards. `CardHand.svelte` already receives `cards: Card[]` as a prop — each card will now have `isCursed?: boolean` set by `drawHand()`.

1. **CSS class:** Apply a class `card--cursed` when `card.isCursed === true` on the card's root element (the `.card-slot` or equivalent wrapper).

2. **Styles to add (in `<style>` block):**
```css
.card--cursed {
  filter: sepia(0.3) hue-rotate(240deg) saturate(1.4) brightness(0.85);
  /* Purple tint */
}

.card--cursed::before {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid rgba(160, 60, 220, 0.85);
  border-radius: inherit;
  pointer-events: none;
  /* Cracked border visual — actual crack SVG overlay is a bonus; border color is the minimum */
}

.card--cursed::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(140, 0, 220, 0.08) 50%, transparent 60%);
  animation: cursed-shimmer 2.5s ease-in-out infinite;
  pointer-events: none;
}

@keyframes cursed-shimmer {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}
```

3. **Respect `data-pw-animations="disabled"`:** Wrap the `cursed-shimmer` animation in: `@media (prefers-reduced-motion: no-preference) { ... }` OR check for the Playwright test attribute and skip the animation. Simplest: add `[data-pw-animations="disabled"] .card--cursed::after { animation: none; }`.

4. **Cursed indicator icon (optional but preferred):** If the card renders a tier/mastery icon area, add a small purple skull or "!" indicator when `isCursed`. A Unicode `⚠` or CSS-drawn indicator is acceptable for alpha. Do not block the TODO on this.

5. **CardExpanded overlay:** If `CardExpanded.svelte` exists and renders a card in a large view, apply the same `card--cursed` class and styles there.

**Acceptance criteria:**
- Cards with `isCursed === true` visually differ from normal cards (purple tint + border).
- Shimmer animation plays on cursed cards.
- Animation is disabled when `data-pw-animations="disabled"` is set (Playwright tests).
- Cured cards (next draw after cure) show no cursed styling.
- No layout shifts, z-index conflicts with existing card overlays (mastery flash, tier-up transition).
- `npm run typecheck` passes.

---

### Task 11 — Cure animation in `CardHand.svelte`
**Files:** `src/ui/components/CardHand.svelte`

**What:**
When a cursed card is successfully charged (cure fires), trigger a brief cure animation: purple styling shatters away and the card glows gold momentarily.

1. The cure is signaled by `PlayCardResult.curedCursedFact === true` (added in Task 4). The UI layer that processes `PlayCardResult` (likely `CombatScreen.svelte` or equivalent) should set a state flag on that specific card.

2. Add `cureAnimatingCards?: Record<string, boolean>` as a prop or local state in `CardHand.svelte` (or accept a `masteryFlashes`-style prop `cureFlashes?: Record<string, boolean>`).

3. When `cureFlashes[card.id] === true`, add CSS class `card--curing` to that card for 800ms, then remove it.

4. CSS:
```css
.card--curing {
  animation: cursed-cure 0.8s ease-out forwards;
}

@keyframes cursed-cure {
  0%   { filter: sepia(0.3) hue-rotate(240deg) saturate(1.4) brightness(0.85); box-shadow: 0 0 0px rgba(255, 200, 0, 0); }
  30%  { filter: brightness(1.6) saturate(1.8); box-shadow: 0 0 20px rgba(255, 200, 0, 0.9); }
  100% { filter: none; box-shadow: none; }
}
```

5. Auto-clear `cureFlashes[card.id]` after 800ms (use `setTimeout` inside the component or a Svelte `$effect` that sets a timer).

6. If `data-pw-animations="disabled"`: skip the animation entirely (card immediately shows as non-cursed with no flash).

**Acceptance criteria:**
- Correct Charge on a cursed card → card briefly glows gold, purple styling disappears.
- Animation duration ~800ms.
- No animation when `data-pw-animations="disabled"`.
- No visual artifacts after animation completes (card renders as fully normal).

---

### Task 12 — Recollect + Inscriptions: cursed cards cannot be exhausted
**Files:** `src/services/deckManager.ts` or wherever exhaust logic lives

**What:**
Per spec interaction table: "Recollect doesn't interact" with cursed cards because "Cursed cards cannot be exhausted." This means the `exhaustCard()` function should guard against exhausting a cursed card (unless the exhaust source is an Inscription, which exhausts regardless).

Add to `exhaustCard()` in `deckManager.ts`:
```typescript
// Cursed cards cannot be exhausted via player choice (Recollect doesn't apply).
// Note: Inscriptions bypass this — they always exhaust on play regardless of cursed state.
```

This is primarily a documentation/comment task since `exhaustCard()` doesn't currently check for cursed state. The actual guard would be in the mechanic resolver for any "choose to exhaust" mechanic, not in the low-level `exhaustCard()` function. Add a comment on `exhaustCard()` noting this invariant.

If `recollect` mechanic is already implemented and has a card-picker UI, add `isCursed` filtering to exclude cursed cards from the "return exhausted card" picker — though this is a secondary concern since cursed cards don't enter the exhaust pile normally.

**Acceptance criteria:**
- Comment on `exhaustCard()` documenting the cursed-cannot-exhaust invariant.
- If `recollect` UI picker exists: cursed cards excluded from the selectable list.

---

### Task 13 — Rest site study cannot cure cursed facts
**Files:** Wherever rest site "study" / mastery-gain logic lives (likely `src/ui/components/MeditateOverlay.svelte` or a rest site service)

**What:**
Per spec: "Rest Site Study CANNOT cure cursed facts (only raises mastery, and cursed facts can't gain mastery). You must cure in combat."

Find the rest site study flow that grants mastery to facts. Add a guard: if a fact being studied has its ID in `runState.cursedFactIds`, skip the mastery gain for that fact (it's locked at effective mastery 0 until cured in combat).

If the rest site study applies mastery via card mastery level (not fact-level FSRS), ensure `canMasteryUpgrade()` is called before any upgrade — since Task 7 makes `canMasteryUpgrade` return `false` for `isCursed` cards, this should be covered automatically if the rest site uses the same guard.

Add a comment or log: `// Cursed facts cannot gain mastery at rest site — must cure via correct Charge in combat`.

**Acceptance criteria:**
- A cursed fact studied at rest site does not gain mastery.
- No runtime errors when a cursed-fact card is shown at rest site.
- `npm run typecheck` passes.

---

### Task 14 — Unit tests for cursed system logic
**Files:** `src/services/cursed-card-system.test.ts` (new file)

**What:**
Write vitest unit tests covering all critical paths. Use the existing test patterns from `src/services/echo-mechanic-v2.test.ts` as a template for structure.

Tests to write (minimum):

```
describe('Cursed Card System', () => {
  // Curse creation
  it('wrong Charge on mastery 0 card adds factId to cursedFactIds')
  it('wrong Charge on mastery 1 card does NOT add factId to cursedFactIds')
  it('wrong Charge on mastery 2 card does NOT add factId to cursedFactIds')
  it('Free First Charge wrong does NOT curse the fact')

  // Mastery 1 → 0 → fail again path
  it('wrong Charge after downgrade to 0 (second wrong on mastery 1 card) DOES curse')

  // Cure
  it('correct Charge on cursed fact removes it from cursedFactIds')
  it('correct Charge on non-cursed fact does not modify cursedFactIds')
  it('curedCursedFact is true on cure, false otherwise')

  // Multipliers (via resolveCardEffect)
  it('cursed card QP applies 0.7x multiplier')
  it('cursed card CC applies 1.0x multiplier (no penalty)')
  it('cursed card CW applies 0.5x multiplier')
  it('non-cursed card is unaffected by cursed multipliers')
  it('cursed card with scar_tissue relic uses 0.85x QP instead of 0.7x')

  // Draw priority / cooldown exemption
  it('cursed fact bypasses factCooldown filter in drawHand')
  it('isCursed flag set correctly on card after drawHand')
  it('isCursed flag is false after fact is cured and redrawn')

  // Mastery upgrade block
  it('canMasteryUpgrade returns false for cursed card')
  it('canMasteryDowngrade is unaffected by isCursed (still returns true when masteryLevel > 0)')

  // Auto-cure safety valve
  it('two consecutive draws at 60%+ cursed triggers pendingAutoCure flag')
  it('one high-cursed draw does not trigger pendingAutoCure')
  it('auto-cure removes oldest fact from cursedFactIds at encounter end')
  it('auto-cure resets consecutiveCursedDraws after firing')
  it('auto-cure does not fire if cursedFactIds is empty')

  // Interaction: card removal does not cure
  it('removing a card slot does not remove its factId from cursedFactIds')
})
```

**Acceptance criteria:**
- All tests pass (`npx vitest run`).
- No tests skipped or marked `.todo` without justification.

---

### Task 15 — Update `docs/GAME_DESIGN.md` and `docs/ARCHITECTURE.md`

**Files:** `docs/GAME_DESIGN.md`, `docs/ARCHITECTURE.md`

**What:**

In `GAME_DESIGN.md`:
- Remove or replace the Echo system section (§11 or equivalent). Any section titled "Echo Cards", "Echo Mechanic", "Echo System" should be fully replaced.
- Add a new section "Cursed Card System" covering:
  - Trigger: wrong Charge on mastery 0 card
  - Tracking: `cursedFactIds: Set<string>` on RunState
  - Multipliers: QP 0.7×, CC 1.0×, CW 0.5×
  - Cure: correct Charge on cursed fact → remove from set, double FSRS credit
  - Free First Charge exemption
  - Cooldown bypass (cursed facts appear sooner)
  - Auto-cure safety valve (60% threshold, 2 consecutive draws)
  - Card removal does not cure
  - Mastery locked during curse
  - Visual: purple tint, cracked border, shimmer
  - Interaction table (matching §1C of the spec)

In `ARCHITECTURE.md`:
- Update RunState diagram/description to show `cursedFactIds: Set<string>` replacing `echoFactIds`/`echoCount`.
- Add Cursed system to the "Game Systems" section with file references: `runManager.ts` (state), `deckManager.ts` (draw priority + flag), `turnManager.ts` (curse/cure logic), `cardEffectResolver.ts` (multipliers), `CardHand.svelte` (visuals).
- Remove Echo system from architecture.

**Acceptance criteria:**
- No Echo system references remain in either doc.
- Cursed system is fully documented with all rules, multipliers, and edge cases.
- File references are accurate.

---

### Task 16 — Update `data/inspection-registry.json`
**Files:** `data/inspection-registry.json`

**What:**
- Remove the Echo system entry (or set `status: "deprecated"` if it exists).
- Add a new entry in the `systems` table for the Cursed Card system:
  ```json
  {
    "id": "cursed_card_system",
    "name": "Cursed Card System",
    "status": "active",
    "lastChangedDate": "2026-03-21",
    "mechanicInspectionDate": "not_checked",
    "visualInspectionDate_portraitMobile": "not_checked",
    "visualInspectionDate_landscapeMobile": "not_checked",
    "visualInspectionDate_landscapePC": "not_checked",
    "uxReviewDate": "not_checked",
    "notes": "Tracks cursedFactIds on RunState. Wrong Charge mastery-0 curses. Correct Charge cures. Auto-cure valve at 60% threshold."
  }
  ```
- Update `lastChangedDate` for `runManager.ts`, `deckManager.ts`, `turnManager.ts`, `cardEffectResolver.ts`, and `CardHand.svelte` system entries if they exist.

**Acceptance criteria:**
- `data/inspection-registry.json` parses as valid JSON after changes.
- Cursed system entry exists in `systems` table.
- No Echo system entry remains with `status: "active"`.

---

## Testing Plan

### Unit Tests (Task 14)
Run after Tasks 1–8 are complete:
```bash
npx vitest run src/services/cursed-card-system.test.ts
npx vitest run  # full suite — verify no regressions
```
Expected: all cursed system tests pass, all existing 1900+ tests still pass.

### Headless Balance Simulation
Run after all logic tasks (1–9) are complete, before visual tasks:
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500
```
Check for:
- No crashes from missing `echoFactIds`/`echoCount` references.
- Cursed fact accumulation rate stays reasonable (check how many facts end up cursed per run on average — if >8 per run at normal difficulty, the system may be too aggressive).
- Win rates across all 6 profiles remain within ±10% of pre-expansion baseline (the cursed system should make struggling players struggle more, not crash the sim).

### Visual Tests (after Tasks 10–11)
```bash
# Start dev server
npm run dev

# In Playwright MCP session:
# 1. Navigate to combat
# 2. Use __terraScenario to load a combat state
# 3. In browser console, manually add a cursed fact:
#    window.__terraDebug().runState.cursedFactIds.add('some-fact-id')
# 4. Trigger a redraw (end turn)
# 5. Screenshot: verify purple tint on the card carrying that fact
# 6. Answer correctly on that card
# 7. Screenshot: verify cure animation fires, card returns to normal
```

---

## Verification Gate

Before marking AR-202 complete, ALL of the following must pass:

```bash
# TypeScript
npm run typecheck

# Build
npm run build

# Unit tests (all 1900+ must pass)
npx vitest run

# Headless sim (no crashes, win rates stable)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500

# E2E smoke test
node tests/e2e/01-app-loads.cjs
node tests/e2e/03-save-resume.cjs
```

**Manual verification checklist (Playwright MCP):**
- [x] Wrong Charge on mastery 0 card → card shows purple tint on next draw
- [x] Wrong Charge on Free First Charge → card does NOT show purple tint
- [x] Wrong Charge on mastery 1+ card → mastery downgrade only, no purple tint
- [x] Correct Charge on cursed card → cure animation fires (gold glow), card normal on next draw
- [x] Cursed card QP damage is ~70% of expected (verify one specific card value in-game)
- [x] Cursed card CC damage is ~100% of expected (no penalty)
- [x] Cursed card CW damage is ~50% of expected
- [x] Removing a card via Meditate does not cure its fact (cursed persists on other cards)
- [x] `__terraDebug()` shows `cursedFactIds` on runState (not `echoFactIds`)
- [x] No JS console errors during a full combat encounter with cursed cards present

---

## Files Affected

| File | Change Type | What Changes |
|------|-------------|-------------|
| `src/services/runManager.ts` | Modify | Replace `echoFactIds`/`echoCount` with `cursedFactIds: Set<string>` |
| `src/data/balance.ts` | Modify | Add 6 `CURSED_*` constants; confirm `ECHO.*` removed |
| `src/services/turnManager.ts` | Modify | Curse-on-wrong-mastery-0 logic; cure-on-correct logic; `curedCursedFact` on `PlayCardResult` |
| `src/services/deckManager.ts` | Modify | Cursed fact cooldown bypass; weighted priority; set `card.isCursed` per draw; `consecutiveCursedDraws` / `pendingAutoCure` tracking |
| `src/data/card-types.ts` | Modify | Add `isCursed?: boolean` to `Card` interface; add `consecutiveCursedDraws` and `pendingAutoCure` to `CardRunState` |
| `src/services/cardEffectResolver.ts` | Modify | Apply CURSED multipliers when `card.isCursed`; Scar Tissue override stub; remove remaining Echo refs |
| `src/services/cardUpgradeService.ts` | Modify | `canMasteryUpgrade` returns false when `card.isCursed` |
| `src/ui/components/CardHand.svelte` | Modify | `card--cursed` CSS class + styles; `card--curing` animation; `cureFlashes` prop |
| `src/ui/components/CardExpanded.svelte` | Modify (if exists) | Same `card--cursed` class |
| Rest site service/component | Modify | Guard mastery gain for cursed facts |
| `src/services/cursed-card-system.test.ts` | Create | Unit tests for all cursed system logic |
| `docs/GAME_DESIGN.md` | Modify | Replace Echo section with Cursed system docs |
| `docs/ARCHITECTURE.md` | Modify | Update RunState diagram; add Cursed system to systems list |
| `data/inspection-registry.json` | Modify | Add cursed system entry; remove/deprecate Echo entry |

---

## Doc Updates Required

| Document | What to Update |
|----------|---------------|
| `docs/GAME_DESIGN.md` | Full replacement of Echo system section → Cursed Card system section. All multipliers, interactions, cure flow, safety valve, visual description. |
| `docs/ARCHITECTURE.md` | RunState schema updated (cursedFactIds). Cursed system added to systems list with file cross-refs. Echo system removed. |
| `data/inspection-registry.json` | New system entry. Modified files' `lastChangedDate` updated to today. |
