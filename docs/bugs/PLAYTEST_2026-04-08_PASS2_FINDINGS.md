# Playtest 2026-04-08 — Pass 2 Research Findings

Companion to [`PLAYTEST_2026-04-08.md`](./PLAYTEST_2026-04-08.md). Read that first.

This file is the output of 15 parallel read-only research agents investigating each chapter. Every item below contains: **Root cause** (file:line), **Proposed fix** (minimal sketch), **Test fixtures**, **Risks**, **Owning agent**.

Pass 3 sub-agents should read their chapter's findings here before editing.

---

## Executive summary — notable cross-chapter discoveries

1. **9.2 is the biggest find of Pass 2.** `categoryL1` and `categoryL2` are **never persisted to `curated.db`** — they exist in JSON source files but are missing from the DDL in `scripts/build-curated-db.mjs`. At runtime, `domainResolver.ts` expects `fact.categoryL1` and falls back to `category[0]`. This is the **root cause of 9.3 (mythology/folklore bleed)** and likely explains parts of 9.1 pool contamination too. Fix is a schema extension + rebuild.

2. **Ch7 canonical rules 2 and 5 are NOT implemented at all.** Weighted RNG by deck composition → currently uniform 1/3. Wrong-answer-reduces multiplier → currently fully resets. Rule 3/4 (surcharge logic) IS present at `turnManager.ts:835-841` but has an **ordering bug**: Free First Charge check is wedged between Chain Momentum and On-Colour, which is logically wrong. The charge-cost display in `CardHand.svelte` at lines 806/977/1156/1333 is missing the `isActiveChainMatch` term entirely, so off-colour charges don't render the surcharge even when it would be applied.

3. **Ch10 "live card info" hard rule overlaps with Ch7's charge cost fix and Ch4's narration engine.** Multiple chapters want a canonical `selectLiveCardStats()` selector. Build it once (Ch10 owns it), reuse it in Ch7 display math and Ch4 fact-context.

4. **Ch15 good news: `CardPickerOverlay.svelte` already exists and is in active combat use** (Transmute, Adapt, Conjure, Scavenge, Forge, Mimic). Ch15 is a refactor + enhancement, not a greenfield build. Current gaps: no scrollable grid for large decks, no live stat numbers (violates Ch10 hard rule), no multi(upTo N) mode. Rename + refactor path is easiest.

5. **Ch4 found a real POS/adapter gap.** `narrativeGravity.ts:267-322` assumes entity-noun model for all decks — silently produces garbage for math/vocab/grammar/kanji. The FactTypeAdapter registry is a necessary architectural addition, not optional.

6. **Ch8 anomaly — probably not a bug.** Agent could not find category icon code in `CardExpanded.svelte` at all. Items 8.2 (remove icons) and 8.3 (move category label) may already be in-state OR the icons live somewhere else. **NEEDS USER CLARIFICATION BEFORE PASS 3.**

7. **Ch11.2 is already correctly implemented** (`RewardCardDetail.svelte:82`). The pill already matches CardHand via `GUIDE_STYLES.cardTypePill` and `getChainColor()`. Mark as verified no-op.

8. **Ch13.1 and Ch13.3 have the same root cause.** `gameFlowController.ts:2287` fires narration on entry to every special room. Deleting that block and adding exit hooks fixes both.

9. **Ch13.2 flashcard merchant "no facts available"** is likely an **async deck-loading race**. Curated decks load lazily via sql.js; the mystery event can fire before the target deck is loaded. Needs `ensureCuratedDeckLoaded()` guard before mystery activation.

10. **Ch12.1 flat ×2 has a cascading cap problem.** `ENEMY_TURN_DAMAGE_CAP = {1:7, 2:14, 3:20, 4:28}` (per-segment hard caps) will bottleneck the ×2 — caps must be scaled proportionally too, else late-game damage flattens. Flag for user decision before shipping.

11. **Ch6.3 "all enemy buffs persist" is a high-risk balance change.** Currently `Proctor` enemy has Strength with `turns:3`. Making it 9999 means Proctor strength stacks forever. Needs `/balance-sim` validation before merge.

12. **Sub-agent routing grouping for Pass 3:**
    - `CardCombatOverlay.svelte` is touched by Ch4.3, Ch4.4, Ch5.1, Ch6.4, Ch7.x, Ch8.x, Ch10.1 — **coordinate as one sub-agent task**, not seven
    - `CardHand.svelte` touched by Ch7.4, Ch10.1, Ch14.6 reuse — batch together
    - `cardDescriptionService.ts` touched by Ch10.1, Ch10.2 — one pass
    - `gameFlowController.ts` touched by Ch13.1/2/3, Ch14.2/3 — one pass

---

## Chapter 1 — Library & Deck Selection UI

### 1.1 Decks have placeholder subtopic names — audit ALL decks

**Root cause:** The tracker assumption about AP Human Geography being the worst offender was partially wrong. Sampled AP decks in `data/decks/*.json` mostly look fine: `ap_biology.json` (Chemistry of Life, Cell Structure…), `ap_psychology.json` (The Conditioning Pit, The Growth Spiral…), `ap_world_history.json` (Age of Revolution…). `ap_human_geography.json` DOES have unit-prefixed placeholder names (`Unit 1: Thinking Geographically` etc.). The full audit still needs to sweep all 81 decks to find the actual offenders.

**Proposed fix:**
1. Run `node scripts/verify-all-decks.mjs` with a new check that flags any subDeck with name matching `/^(Topic|Group|Section|Unit|Chapter)\s*\d+$/i` unless prefixed by domain-specific context.
2. For each flagged deck: AP → College Board CED hierarchy; language → official level structures; knowledge → Wikipedia/Wikidata category hierarchies per `.claude/rules/content-pipeline.md`.
3. Edit `data/decks/{deckId}.json` — modify `subDecks[].name` only (preserve structure).
4. `npm run build:curated && node scripts/verify-all-decks.mjs` to confirm.

**Test fixtures:** `scripts/verify-all-decks.mjs` extended check; Docker scenario `scenario-playtest-scenarios:10-settings-library-profile` with `__rrScreenshotFile()` across the library tabs.

**Risks:** Custom user-created decks must be exempt. Non-Latin script names (JP/KR/CN) must preserve original script, not romanize.

**Owning agent:** content-agent (audit/rename), ui-agent (visual verify).

---

### 1.2 Subdecks not alphabetically ordered

**Root cause:** `src/ui/components/DeckDetailModal.svelte:164` renders `{#each deck.subDecks as subDeck}` without any sort — they appear in file definition order.

**Proposed fix:** Add a `$derived` sort in `DeckDetailModal.svelte`:
```svelte
const sortedSubDecks = $derived(deck.subDecks ? [...deck.subDecks].sort((a, b) => a.name.localeCompare(b.name)) : []);
```
Change line 164 from `{#each deck.subDecks as subDeck}` to `{#each sortedSubDecks as subDeck}`. Client-side sort — no JSON file edits needed.

**Test fixtures:** Unit test for `sortedSubDecks` derived in `DeckDetailModal.test.ts`; Docker scenario 10 verifying alphabetical order across Japanese N1, AP Biology, World Wonders.

**Risks:** `localeCompare` uses system locale — CJK decks will sort by Unicode codepoint. Acceptable.

**Owning agent:** ui-agent.

---

### 1.3 X mark overlaps "Total Facts"

**Root cause:** `DeckDetailModal.svelte:296-320` (`.close-btn` absolutely positioned at `top: 14px; right: 16px; z-index: 2`) has no reserved clearance in the `.col-right` container (lines 345-356). The stat-block starts immediately below the header, so "Total facts" renders under the close button.

**Proposed fix:** Add top padding to `.col-right`:
```css
.col-right {
  padding: calc(50px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
}
```
50px top = close button (32px) + margin buffer.

**Test fixtures:** Docker visual at 1920×1080, 1440×900, 768×1024. Playwright assertion that close-btn bounding box does not overlap `getByText('Total facts').boundingBox()`.

**Risks:** Reduces vertical space in `.col-left`; check if any long deck's subdeck list still fits.

**Owning agent:** ui-agent.

---

### 1.4 Library tabs don't scroll to top on switch

**Root cause:** `KnowledgeLibrary.svelte:136-141` `handleSidebarTab()` updates `activeTab` but does not reset scroll. The `.fact-scroll` container (line 349) retains scroll position across tab switches (Svelte element reuse).

**Proposed fix:**
```svelte
let factScrollEl = $state<HTMLElement | null>(null);
// ...
<div class="fact-scroll" bind:this={factScrollEl}>
// ...
function handleSidebarTab(id: FactDomain | null): void {
  activeTab = id;
  // ...
  if (factScrollEl) factScrollEl.scrollTop = 0;
}
```

**Test fixtures:** Playwright E2E: scroll to Y>100, click tab, assert `scrollTop === 0`.

**Risks:** None identified.

**Owning agent:** ui-agent.

---

## Chapter 2 — Custom Deck Building & Group Naming

### 2.1 Custom deck group names are "Group 1", "Group 5"…

**Root cause:** `src/services/chainDistribution.ts:272-293` — 3-priority waterfall in `extractTopicGroups()`:
1. Deck has `subDecks[]` → use those names
2. Facts have `partOfSpeech` → group by POS (Nouns/Verbs…)
3. **Fallback (the bug):** group by `chainThemeId`, assign generic `label: \`Group ${groupNum++}\`` at line 286. **No deck name prefix.**

`extractTopicGroupsMultiDeck()` at line 309 concatenates groups from multiple decks without disambiguation — collisions produce "Group 1" from multiple source decks.

**Proposed fix:**
1. Modify fallback at line 286 to: `label: \`${deck.name} Group ${groupNum++}\``.
2. Add `sourceDeckName?: string` to `TopicGroup` interface (lines 26-42) for downstream use.
3. In `extractTopicGroupsMultiDeck()`, post-process: if two groups have the same label from different decks, rename with deck prefix.

**Test fixtures:** Unit tests in `chainDistribution.test.ts`:
- Multi-source fallback → labels prefixed with deck name
- Mixed subDecks[] + fallback → subDeck names preserved, fallbacks prefixed
- Single-source → no prefix needed

**Risks:** Saved custom decks recompute ChainDistribution at run start (`gameFlowController.ts:982`), so auto-upgrade is transparent. No save migration needed.

**Owning agent:** game-logic.

---

## Chapter 3 — Map Generation Bias

### 3.1 Map node edges biased up-and-right

**Root cause:** `src/services/mapGenerator.ts:235-260` `createEdges()`:
- Lines 239-241: Uses `Math.max(maxChildColUsed, ...)` which enforces monotonicity rightward — left nodes are forced to feed rightward through the pipeline.
- Lines 253-260: Branch-right is primary (35% probability on line 254), branch-left is fallback (lines 263-269). Asymmetric by construction, not RNG bias.

**Proposed fix:** Symmetrize candidate collection, then shuffle:
```typescript
const candidates: number[] = [];
const baseCol = Math.round((c / Math.max(curCount - 1, 1)) * Math.max(nextCount - 1, 0));
if (baseCol >= 0 && baseCol < nextCount) candidates.push(baseCol);
if (baseCol + 1 < nextCount) candidates.push(baseCol + 1);
if (baseCol - 1 >= 0) candidates.push(baseCol - 1);
// Fisher-Yates shuffle with rng
for (let i = candidates.length - 1; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1));
  [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
}
// Connect to shuffled candidates in order
```
Post-process pass: verify non-crossing via deterministic left-to-right sweep, repair violations.

**Test fixtures:** Statistical test in `tests/unit/mapGenerator.test.ts`: generate 100 maps, histogram edge directions, assert `|leftPct - rightPct| < 0.05` and both `> 0.4`.

**Risks:** Non-crossing guarantee must be re-verified post-shuffle. No save format impact (edges serialize identically).

**Owning agent:** game-logic.

---

## Chapter 4 — Narrative System

### 4.1 Narrative text auto-reveal

**Root cause:** `src/ui/components/NarrativeOverlay.svelte:3-11, 99-109, 159` — current state machine is click-gated. Each line requires a click to advance via `revealLine(visibleUpTo + 1)`. No auto-reveal timer.

**Proposed fix:**
1. Add `AUTO_REVEAL_DELAY = 400` (ms between lines) and `AUTO_REVEAL_START_DELAY = 800` (ms before first line).
2. State: `let autoRevealTimer: ReturnType<typeof setTimeout> | null = null`.
3. In `settleCurrentLine()` (line 88), schedule next auto-reveal if not last line.
4. In `handleAdvance()` (line 146), clicking during auto-reveal cancels timer and skip-jumps to final state.
5. `onMount()` (line 137) schedules first reveal with `AUTO_REVEAL_START_DELAY`.
6. `onDestroy()` clears the timer.

**Test fixtures:** Unit tests on `NarrativeOverlay` reveal behavior; Docker scenario 01 reviewing post-encounter sequence.

**Risks:** Interaction with `turboDelay()` system; ensure clicks during stagger don't double-trigger.

**Owning agent:** ui-agent.

---

### 4.2 Narration fact source + deck-type adapter registry

**Root cause:** Two distinct parts.

**Part A — Source filter:** `narrativeEngine.ts:226-281` (`recordEncounterResults`) AND `gameFlowController.ts:1633-1660` are **correct as designed**. Fact pool comes from `answeredFactIds` (quizzed only) via `encounterBridge.ts:1035`. The "fact never seen" playtest symptom is likely from `narrativeGravity.ts:239-322` which uses a hardcoded entity-noun model with no adapter awareness — for math/vocab/grammar/kanji decks it produces garbage echo text because it extracts entities that don't exist, then falls back to quoting the whole question.

**Part B — No adapter registry:** The `FactTypeAdapter` interface the tracker requires does not exist. `narrativeGravity.ts` has hardcoded rules for `person`/`place`/`concept`/`foreign_word` (detected via `hasNonLatinChars()` at line 278) but no pluggable adapter pattern.

**Proposed fix:**
1. Create `src/services/narrativeAdapterRegistry.ts` with `FactTypeAdapter` interface (`canEcho`, `selectTemplate`, `extractEchoText`) and a `Map<string, FactTypeAdapter>` registry.
2. Built-in adapters: `HistoryAdapter`, `ScienceAdapter`, `GeographyAdapter`, `MythologyAdapter` (extract from existing logic), then **new**: `MathAdapter`, `VocabForeignAdapter`, `GrammarForeignAdapter`, `KanjiAdapter`.
3. `narrativeGravity.buildEchoText()` delegates to `adapter.extractEchoText()`; `scoreGravity()` checks `adapter.canEcho()` first.
4. `narrativeEngine.ts:610-630` passes through `adapter.selectTemplate()` for template selection.
5. `narrativeLoader.preloadNarrativeData()` registers all adapters at startup.
6. Review `data/narratives/echoes/*.yaml` — existing templates assume entity-noun model. Tag each template by supported adapter or split per-adapter files.

**Test fixtures:** Unit tests in `narrativeGravity.test.ts` for each adapter. Integration test across 5+ deck categories. Docker scenario 01 with mixed deck types.

**Risks:** Existing templates may not fit new adapters → echo starvation. Mitigate by defaulting to MEDIUM gravity fallback. Vocab deck pattern parsing assumes `"What does \"{word}\" mean?"` format — document assumption.

**Owning agent:** game-logic (registry + filter), content-agent (per-type templates), docs-agent (narration skill + docs update).

---

### 4.3 Wow-factor shows wrong fact

**Root cause:** `src/ui/components/CardCombatOverlay.svelte:915-948` — `showWowFactor(card: Card)` looks up via `card.factId` at line 931, but the **answered fact** and the **charged card's fact** can diverge (multi-fact cards, study mode). Line 2212 call site passes `card` not `answeredFactId`.

**Proposed fix:**
1. Change signature: `showWowFactor(answeredFactId: string, card: Card)`.
2. Line 931: `const fact = factsDB.isReady() ? factsDB.getById(answeredFactId) : null`.
3. Update call site (~line 2212): obtain answered fact ID from quiz result object, pass explicitly.

**Test fixtures:** Unit test: card contains fact B, player answers fact A → wow-factor must be fact A. Docker scenario 03 with fact-tracking logging.

**Risks:** Quiz result object may not currently expose answered fact ID at this call site — may need small refactor upstream.

**Owning agent:** game-logic + ui-agent.

---

### 4.4 Wow-factor duration ×2

**Root cause:** `CardCombatOverlay.svelte:944-947` — `setTimeout(() => { wowFactorVisible = false }, turboDelay(5200))` (200ms fade-in + 5000ms hold). Cleanup timer at 5500ms.

**Proposed fix:** Double the hold: `turboDelay(5200)` → `turboDelay(10200)`; `turboDelay(5500)` → `turboDelay(10500)`. (Fade-in stays at 200ms; hold extends to 10s.)

**Test fixtures:** Frame-count timing verification in Docker.

**Risks:** Longer hold → more click-through dismissals. Consider pulsing glow at mid-hold for continued attention.

**Owning agent:** ui-agent.

---

### 4.5 Two-thirds of room-exit narration should be smart

**Root cause:** `narrativeEngine.ts:321-700` (`getNarrativeLines`). Current threads:
- **Descent** (~33-40% of rooms) — archetype beats; always smart
- **Echo** (~15-25%) — facts; smart
- **Seeker** (~25-35%) — HP/streak/relics; smart
- **Inhabitants** (~5-10%) — NPC state; smart

(Descent + Echo + Seeker + Inhabitants) ≈ 45-70%. Target ⅔ is achievable but not currently tracked or biased.

**Proposed fix:**
1. Add `smartNarrativeCount` and `totalNarrativeCount` counters to `RunNarrativeState`.
2. Increment in `getNarrativeLines()` when line source is Echo/Seeker/Inhabitants/Descent.
3. At midpoint (floor 2): if running ratio < 0.65, apply `×1.5` weight boost to Seeker thread selection.
4. Audit Seeker templates — split into "high-specificity" (HP + relic combo references) vs "fallback" (generic). Prefer high-specificity.

**Test fixtures:** Integration test: simulate 15-room run, assert `smartCount/total >= 0.65`. Runtime logging for baseline establishment.

**Risks:** Forcing bias may cause template starvation / repeats. Template authoring burden on content-agent.

**Owning agent:** content-agent (templates) + game-logic (ratio tracking).

---

## Chapter 5 — Combat HUD Layout

### 5.1 AP button consolidation

**Root cause:** Two separate components confirmed.
- **Orange sphere (to DELETE):** `CardCombatOverlay.svelte:2901-2905` element `.lsb-ap-standalone`, styling `:4255-4298`. Landscape-only. Orange radial gradient `#ff6633` → `#cc2200`, glow `0 0 12px 3px rgba(255, 100, 0, 0.55)`. Positioned `left: calc(148px * var(--layout-scale, 1))`, `bottom: calc(16px * var(--layout-scale, 1))`.
- **Square AP (to KEEP + MOVE + BRIGHTEN):** `CardCombatOverlay.svelte:2808-2811` element `.player-ap-right` + `.ap-num` + `.ap-label`. Portrait-only currently. Dark background `rgba(60, 20, 10, 0.6)`, thin orange border. Position `right: calc(12px * var(--layout-scale, 1))`, `bottom: calc(18px…)`.

**Proposed fix:**
1. Delete `.lsb-ap-standalone` (lines 2900-2905) and all `.lsb-ap-*` CSS (4255-4298).
2. Make `.player-ap-right` visible in landscape — change display rule.
3. Position in landscape: `left: calc((16px + 120px + 12px) * var(--layout-scale, 1))` (just right of End Turn which is `left:16px, width:120px, margin:12px`).
4. Brighten when active: box-shadow from `0 0 6px 1px rgba(255, 120, 0, 0.35)` → `0 0 12px 3px rgba(255, 100, 0, 0.55)` (match old sphere). Background `rgba(100, 30, 10, 0.78)` → `rgba(150, 50, 20, 0.88)`.

**Test fixtures:** Docker scenario 03 with layout dump; assert `.lsb-ap-standalone` not in DOM, `.player-ap-right` visible in landscape, left ≥ 148px, box-shadow blur ≥ 12px when AP > 0.

**Risks:** Fixed `left: 148px` must work at 0.85, 1.0, 1.15 scale factors. Check 1024px-wide tablets. Z-index collision with hand strip.

**Owning agent:** ui-agent.

---

### 5.2 Relic slot containers

**Root cause:** `src/ui/components/InRunTopBar.svelte:281-310` — each relic wrapped in `.relic-slot-wrapper` (`position: relative`, lines 749-751). Wrapper exists to scope tooltip positioning relative to the button. Combined with `.relics-row` `gap: 3px` (line 744), the per-relic wrappers and empty slots consume horizontal space that pushes the rail overflow.

**Proposed fix:**
1. Remove `.relic-slot-wrapper` div (lines 281, 310) — unwrap button + tooltip as direct children of `.relics-row`.
2. Add `position: relative` to `.relics-row` so tooltip absolute positioning still works.
3. Keep existing `gap: 3px` — that's normal spacing, not the problem.

**Test fixtures:** Docker scenario 03; render with 1, 3, 6, 8 relics; tooltip positioning on click; empty-slot alignment.

**Risks:** Tooltip was positioning against `.relic-slot-wrapper` — must verify tooltip offset calculations still work against `.relics-row` parent context. Rail overflow at max relics.

**Owning agent:** ui-agent.

---

## Chapter 6 — Enemy Display

### 6.1 Special feature label position

**Root cause:** `src/ui/components/EnemyPowerBadges.svelte:55-67` — `.enemy-power-badges` absolutely positioned `top: calc(64px * var(--layout-scale, 1)) + var(--safe-top)`, `left: 50%; transform: translateX(-50%)`. Centered horizontally, fixed 64px from top → sits under the enemy sprite, above HP bar.

**Proposed fix:**
1. Remove fixed `top` and `left: 50%; transform: translateX(-50%)`.
2. Move component render site to immediately after HP bar markup (`CardCombatOverlay.svelte:2602`).
3. New CSS: `position: absolute; right: 0; top: 50%; transform: translateY(-50%); left: auto;`.
4. `flex-direction: row` already in place.

**Test fixtures:** Docker scenario 03 — screenshot Plagiarist encounter; badge must sit right of HP bar, vertically centered.

**Risks:** HP bar height varies by scale; `translateY(-50%)` handles it. Other enemy types may have different layouts — spot-check Proctor, Comparison Trap.

**Owning agent:** ui-agent.

---

### 6.2 Passive vs buff/debuff ordering

**Root cause:** `StatusEffectBar` at fixed `top: 14vh` (`StatusEffectBar.svelte:128`), `EnemyPowerBadges` at fixed `top: 64px` (`EnemyPowerBadges.svelte:60`). No explicit ordering — can overlap.

**Proposed fix:** After moving EnemyPowerBadges inline per 6.1, `StatusEffectBar` at `top: 14vh` remains below HP bar naturally. Add `margin-bottom: calc(8px * var(--layout-scale, 1))` to `.enemy-power-badges` for explicit gap.

**Test fixtures:** Docker scenario 03 — Proctor encounter with both passive and buffs active.

**Owning agent:** ui-agent.

---

### 6.3 ALL enemy buffs persist entire encounter

**Root cause:** `src/data/statusEffects.ts:74-100` — `tickStatusEffects()` decrements `effect.turnsRemaining -= 1` for all (line 90), removes if ≤0 (line 94). Player AND enemy. `turnManager.ts:1940-1943` generic enemy buff uses `turnsRemaining: 1`. Proctor at `enemies.ts:646` applies Strength with `turns: 3`.

**Proposed fix:**
1. Identify all enemy buff application sites in `turnManager.ts` and `enemyManager.ts`.
2. Change all to `turnsRemaining: 9999` (sentinel for "rest of encounter").
3. Document in `docs/mechanics/enemies.md`.

**Test fixtures:** Unit test: apply Strength to enemy, advance 5 turns, confirm still present. `/strategy-analysis` + Plagiarist encounter at turn 5+.

**Risks:** **HIGH BALANCE RISK.** Late-game encounters become much harder. Must run `/balance-sim` + playtest scenarios before merging. Interacts with 12.1's enemy damage ×2 — run both together as one balance pass.

**Owning agent:** game-logic.

---

### 6.4 Enemy intent display

**Root cause:** `CardCombatOverlay.svelte:560-591` (`intentNameTimer` cycling logic), `:2663-2691` (bubble template), `:694-724` (`intentDetailText` derivation). Click → `intentNameVisible = true` → timer → false, cycling between "Charging" / attack name / "Preparing".

**Proposed fix:**
1. Delete click-cycle logic (lines 565-591: intentPopupOpen, intentNameTimer, showIntentName).
2. Static layout in template:
   - Top centered: attack name (bold heading)
   - Bottom centered: "Charging X damage next turn" (or "Charging X × Y damage next turn" for multi-hit)
3. Update `intentDetailText` (lines 694-724):
   - `attack`: `"Charging ${val} damage next turn"`
   - `multi_attack`: `"Charging ${val} × ${hits} damage next turn"`
   - `defend`/`buff`/`debuff`: keep current
4. CSS: `.enemy-intent-bubble` with `flex-direction: column; text-align: center`.

**Test fixtures:** Unit: Plagiarist serpent lunge (5 dmg) → "Charging 5 damage next turn". Comparison Trap phantom copies (3×3) → "Charging 3 × 3 damage next turn". Docker scenario 03.

**Risks:** Removes click-to-cycle toggle — all info must be visible at a glance. `telegraph` field must always be populated (some may be null).

**Owning agent:** ui-agent (layout) + game-logic (damage feed).

---

### 6.5 Plagiarist "grows stronger" no indicator

**Root cause:** `src/data/enemies.ts:630-634` — Plagiarist's `onEnemyTurnStart` hook increments `ctx.enemy.enrageBonusDamage += 5` per turn ≥ 4. This is **hidden state** — never added to `enemy.statusEffects[]`. `src/data/enemyPowers.ts:71-76` has an `'escalates'` badge with static "Escalates" label, but `getEnemyPowers()` at line 143-145 only checks `t.onEnemyTurnStart` existence, not current stack count.

**Proposed fix:**
1. In Plagiarist's `onEnemyTurnStart`:
   ```typescript
   onEnemyTurnStart: (ctx) => {
     if (ctx.turnNumber >= 4) {
       ctx.enemy.enrageBonusDamage += 5;
       applyStatusEffect(ctx.enemy.statusEffects, {
         type: 'strength',
         value: 1,
         turnsRemaining: 9999,  // per 6.3
       });
     }
   }
   ```
2. Update `getEnemyPowers()` to show dynamic count:
   ```typescript
   const strengthCount = enemy.statusEffects.filter(s => s.type === 'strength').length || 0;
   resolvedTooltip: strengthCount > 0
     ? `Grows stronger each turn (+${strengthCount} Strength stacks)`
     : ENEMY_POWERS.onEnemyTurnStart.tooltip,
   ```
3. `StatusEffectBar` auto-renders Strength icon with stack count badge.

**Test fixtures:** Unit: trigger `onEnemyTurnStart` at turn ≥4, verify Strength added. `/inspect` Plagiarist encounter across turns 4-6.

**Risks:** **DOUBLE-COUNT RISK.** If `enrageBonusDamage` is already applied to damage calc AND Strength is applied via standard pipeline, damage doubles. Must verify `enrageBonusDamage` path doesn't stack with Strength multiplier. Also affects Timer Wyrm at `enemies.ts:486` (similar pattern).

**Owning agent:** game-logic + ui-agent.

---

## Chapter 7 — Chain System & Charge AP Cost

> **Most critical chapter. Full canonical rules mapping below.**

### 7.1 First chain (×1.1) not in chain colour

**Root cause:** `src/ui/components/ChainCounter.svelte:52-54` — display condition is correct (`chainLength >= 1 && chainType !== null && chainMultiplier !== 1.0`), BUT the multiplier color on line 54 uses `chainColor` derived from `chainType` (line 15), which is the card's color, not the **active turn's rolled chain color** (`activeChainColor` from `TurnState`).

**Proposed fix:**
```svelte
const displayColor = $derived(
  (chainLength >= 1 && activeChainColor !== null)
    ? getChainTypeColor(activeChainColor)
    : chainColor
);
```
Use `displayColor` on line 54.

**Test fixtures:** Unit: first correct charge on matching colour → multiplier displays in that colour. Off-colour charge → multiplier stays with active chain colour. Visual mid-chain screenshot.

**Owning agent:** ui-agent.

---

### 7.2 Chain multiplier indicator position

**Root cause:** `ChainCounter.svelte:144-146` — `.chain-display` positioned `left: 12px; bottom: calc(42px + var(--safe-bottom))`, which is near bottom-left above End Turn area. The new `.active-chain-bar` is at `bottom: calc(148px * ...)` — higher. They're not stacked.

**Proposed fix:** Reposition `.chain-display` directly beneath `.active-chain-bar`:
```css
.chain-display {
  bottom: calc(42px + var(--active-chain-bar-height, 32px) + var(--safe-bottom, 0px));
}
```
Add `--active-chain-bar-height: 32px` CSS variable. Alternatively merge both into one stacked component.

**Test fixtures:** Layout dump — active-chain-bar immediately above chain-display, no gap. Responsive at multiple sizes.

**Risks:** Z-index: 50 vs 18 — safe.

**Owning agent:** ui-agent.

---

### 7.3 Remove duplicate yellow flashing indicator

**Root cause:** `ChainCounter.svelte` has both `.active-chain-bar` (lines 42-60, new, shows "Play Obsidian to chain · ×1.2x") and `.chain-display` (lines 62-77, legacy, same info). The "yellow flashing" appearance comes from legacy `.chain-display` with `brightness()` filter or glow when `chainLength >= 3`.

**Proposed fix:**
1. Remove `.chain-display` entirely (lines 62-77).
2. Enhance `.active-chain-bar` to always show the multiplier block (not conditional `{:else}`) using active chain colour.
3. `.active-chain-bar` becomes sole source of truth for chain UI.

**Test fixtures:** Verify only one multiplier indicator renders at any time. 6-turn playtest.

**Risks:** Relics or celebrations keying off `chain-display` visibility via DOM selectors. Search codebase for `chain-display` references.

**Owning agent:** ui-agent.

---

### 7.4 Charge cost doesn't show surcharge

**Root cause:** `src/ui/components/CardHand.svelte:806, 977, 1156, 1333` — charge cost computation:
```typescript
chargeApCost = (card.apCost ?? 1) + (isSurgeActive || isMomentumMatch ? 0 : 1);
```
**Missing `isActiveChainMatch` term.** The derived `isActiveChainMatch` exists at lines 831, 1175 but is not used in cost calculation.

**Proposed fix:** Add `isActiveChainMatch` to surcharge waiver:
```typescript
const isActiveChainMatch = activeChainColor !== null && card.chainType === activeChainColor;
chargeApCost = (card.apCost ?? 1) + (isSurgeActive || isMomentumMatch || isActiveChainMatch ? 0 : 1);
```
Apply at all four call sites. Also update `isFreeAp` at lines 979, 1335.

**Test fixtures:** Unit matrix:
- `chainType == activeChainColor` → base AP
- `chainType != activeChainColor` → base + 1
- Combined with surge/momentum waivers

**Risks:** High-AP players may suddenly find themselves unable to afford plays — test against mid-combat saves.

**Owning agent:** ui-agent (display) + game-logic (turnManager must also check — see 7.6).

---

### 7.5 Turn 1 off-colour charged for 1 AP

**Root cause:** Same as 7.6 (surcharge globally inactive) but specifically evidenced on turn 1. Verify `rotateActiveChainColor(globalTurnCounter)` at `turnManager.ts:695-696` fires correctly at encounter init — if `globalTurnCounter` is 0 or unset, rotation seed is invalid and `activeChainColor` may be null.

**Proposed fix:**
1. Verify `rotateActiveChainColor()` called AFTER `initChainSystem()` at encounter start (lines 685-696).
2. Confirm `globalTurnCounter` non-zero at `startEncounter()` entry.
3. Guard: if `activeChainColor === null`, treat as non-curated → no waiver.

**Test fixtures:** Unit: turn 1 off-colour charge → `apCost === base + 1`. Turn 1 on-colour → `apCost === base`.

**Risks:** If rotation is broken, the whole chain system is offline — blocks 7.1-7.4, 7.7.

**Owning agent:** game-logic.

---

### 7.6 CHARGE_AP_SURCHARGE globally inactive — ROOT CAUSE

**Root cause:** `src/services/turnManager.ts:811-847` — the surcharge block is **present** but has an **ordering bug** in the waiver chain:
```
Line 819: Surge waiver
Line 825: Warcry waiver
Line 828: Chain Momentum waiver
Line 831: Free First Charge waiver  ← OUT OF ORDER
Line 835: On-Colour waiver (empty block! comment only, no apCost mutation)
Line 840: Apply CHARGE_AP_SURCHARGE
```
Line 835's `else if` has a comment "Chain color match: waive surcharge" with **no code** — it falls through to line 840 which applies the surcharge. The "waiver" is logically broken.

**Proposed fix:**
1. Reorder: Surge → Warcry → Chain Momentum → **On-Colour** → Free First Charge → Apply surcharge.
2. Line 835 must be an actual no-op `else if` branch (not an empty block):
   ```typescript
   } else if (cardInHand.chainType != null && cardInHand.chainType === getActiveChainColor()) {
     // Waive surcharge — on-colour charge costs base AP only
   } else {
     apCost += CHARGE_AP_SURCHARGE;
   }
   ```
3. Verify `getActiveChainColor()` reachable — trace call paths.

**Test fixtures:** 6-combination unit test matrix:
| on/off colour | surge | momentum | expected |
|---|---|---|---|
| on | normal | no | base |
| on | surge | no | base |
| off | normal | no | base+1 |
| off | surge | no | base |
| off | normal | momentum | base |
| off | normal | free-first | base |

**Risks:** Balance regression — players expected "free everything" effectively. Surge playstyle will feel more valuable, which is the design intent.

**Owning agent:** game-logic.

---

### 7.7 NEW — Weighted-random chain colour per turn

**Root cause:** NOT IMPLEMENTED. Current `rotateActiveChainColor()` at `chainSystem.ts:101-102` uses uniform LCG-based RNG (1/3 probability each of 3 run chain types). Canonical rule 2 requires **weighted by deck composition**.

**Proposed fix:**
1. New function `rotateActiveChainColorWeighted(turnNumber, deckComposition)`.
2. `deckComposition: Map<chainTypeIndex, cardCount>` passed from turnManager.
3. Weighted RNG: `total = sum(counts)`, pick index based on `(rand() * total)`.
4. Seeded LCG for determinism: `((seed * turns) % total)`.
5. Call from `turnManager.ts:3287` (turn start) and `:695` (encounter init).
6. Deck composition source: store precomputed `Map` in `RunState` at encounter start — don't recompute each turn.

**Test fixtures:** Given `{A:13, B:10, C:1}`, run 10,000 rolls, assert:
- A ≈ 54% (13/24 ± 5%)
- B ≈ 42% (10/24 ± 5%)
- C ≈ 4% (1/24 ± 5%)
Determinism: same runSeed + composition → same 10-turn sequence.

**Risks:** API surface change — requires RunState enrichment. Don't silently recompute per turn (perf). Linear vs sqrt weighting — default linear per user.

**Owning agent:** game-logic.

---

### 7.8 NEW — Wrong off-colour reduces (not breaks) multiplier

**Root cause:** NOT IMPLEMENTED. `turnManager.ts:945, 951` call `extendOrResetChain(null)` → `_chain = { chainType: null, length: 0 }` on wrong answer. Canonical rule 5 requires **reduction**, not reset.

**Proposed fix:**
1. Add parameter `isOffColourWrongAnswer: boolean` to `extendOrResetChain()` in `chainSystem.ts`.
2. If true, reduce length: `_chain.length = Math.max(1, Math.floor(_chain.length * 0.5))` (default ×0.5, floored at 1).
3. In `turnManager.ts:943-958`:
   ```typescript
   const isOffColourWrong = playMode === 'charge' && !answeredCorrectly && (cardInHand.chainType !== getActiveChainColor());
   extendOrResetChain(null, undefined, isOffColourWrong);
   ```

**Test fixtures:** 4-scenario matrix:
- (correct × on-colour) → chain extends, mult increases
- (correct × off-colour) → chain preserved, mult unchanged
- (wrong × on-colour) → chain resets fully
- (wrong × off-colour) → chain ×0.5 (e.g. len 5 → 2), mult > 1.0 floor

Example: Start chain length 5 (mult 3.5×), wrong off-colour → length 2 (mult 1.5×), subsequent correct on-colour → length 3 (mult 2.0×).

**Risks:** Might be too forgiving (×0.5). If balance feels loose, reduce to ×0.25 or ×0.33.

**Owning agent:** game-logic.

---

### Canonical rules → file changes mapping

| Rule | Status | Primary file | Blocker item |
|---|---|---|---|
| 1. Colour locks at turn start | ✅ implemented | `turnManager.ts:3287, 695` | — |
| 2. Weighted by deck composition | ❌ NOT implemented (uniform 1/3) | `chainSystem.ts` + `turnManager.ts` | 7.7 |
| 3. On-colour = base AP | ⚠️ broken (empty waiver block) | `turnManager.ts:835`, `CardHand.svelte:806,977,1156,1333` | 7.4, 7.6 |
| 4. Off-colour = base + surcharge | ⚠️ not firing (7.6 ordering bug) | `turnManager.ts:840` | 7.4, 7.6 |
| 5. Wrong off-colour reduces | ❌ NOT implemented (resets) | `chainSystem.ts` `extendOrResetChain` | 7.8 |
| 6. Surge waives all | ✅ implemented | `turnManager.ts:819-821` | — |
| 7. Display TOTAL cost | ⚠️ missing term | `CardHand.svelte:806,977,1156,1333` | 7.4 |
| 8. "Play {colour}" indicator | ⚠️ duplicate, wrong position | `ChainCounter.svelte:42-60` | 7.1, 7.2, 7.3 |

**Migration:** Existing mid-encounter saves have OLD fixed-colour chain state. The NEW weighted rotation will pick different colours from next turn onward. Recommend: clear legacy encounter saves OR add migration hook that re-rolls at load time.

---

## Chapter 8 — Quiz Panel Layout

### 8.1 Quiz field extend 15% + scale all

**Root cause:** `src/ui/components/CardExpanded.svelte:781-812` landscape rule:
```css
top: calc(var(--topbar-height, 4.5vh) + calc(40px * var(--layout-scale, 1)))
bottom: calc(24vh + calc(16px * var(--layout-scale, 1)))
```
The `24vh` bottom clearance is hardcoded. Internal padding/gap already uses `--layout-scale` correctly.

**Proposed fix:** `24vh` → `20.4vh` (24 × 0.85 = 15% reduction, extending panel down by ~57.6px at 1920×1080). Internal elements scale proportionally via existing `calc()` patterns.

**Test fixtures:** Docker scenario 08 at 1920×1080 and 1280×720.

**Risks:** Overlap with card hand — confirmed acceptable per user.

**Owning agent:** ui-agent.

---

### 8.2 Remove category icons ⚠️ ANOMALY

**Root cause:** Agent could NOT find any category icon/label currently rendering in `CardExpanded.svelte`. Card header (lines 516-530) only displays `deckDisplayName` and cogwheel settings. No category field passed as prop from `CardCombatOverlay.svelte:2739-2769`.

**This contradicts playtest observation.** Two possibilities:
- (A) The icons live in a different component (some wrapping layout we missed)
- (B) The feature was already partially removed in a recent commit and the playtest was on a stale build
- (C) Category icons render somewhere we didn't grep

**BLOCKING — needs user clarification or additional investigation before Pass 3.** Suggest a targeted screenshot session at the start of Pass 3: open a quiz in the current build, screenshot the top-left, verify whether icons are actually rendering.

**Owning agent:** ui-agent (investigation).

---

### 8.3 Move category label to top-left

**Root cause:** Related to 8.2 anomaly — if no category label currently exists in `CardExpanded.svelte`, this item becomes an **additive** feature not a move.

**Proposed fix (assuming 8.2 clarifies there is no category label currently):**
1. Add optional `category?: string` prop to CardExpanded Props interface (lines 32-79).
2. Pass `fact.category[0]` from `CardCombatOverlay.svelte:2740`.
3. Render in top-left of card header: `<span class="category-label">{category}</span>`.
4. Style: `font-size: calc(11px * var(--text-scale, 1))`, neutral grey.

**Test fixtures:** Docker scenario 08.

**Owning agent:** ui-agent.

---

### 8.4 Dynamic font scaling

**Root cause:** `CardExpanded.svelte:1049-1069` (question font tiers) and `:1131-1147` (answer buttons). Current values all use `--text-scale` correctly (no hardcoded violations), but the **base values are conservatively small**:
- `.quiz-text-short`: 22px
- `.quiz-text-medium`: 18px
- `.quiz-text-long`: 14px
- Answer buttons: 11px font, 56px min-height, 14px vertical + 18px horizontal padding

None scale beyond what `--text-scale` provides, so at landscape scale they look cramped.

**Proposed fix:**
1. Answer buttons: 11px → 16px base; min-height 56 → 64; padding 14/18 → 16/20.
2. Question text in landscape: `.quiz-text-short` 22 → 26; `.quiz-text-medium` 18 → 22; `.quiz-text-long` 14 → 18. Use landscape-scoped rule (`.card-expanded-landscape` class modifier).

**Test fixtures:** Docker scenario 08 at 1920×1080 and 768 narrow viewport. Confirm no text wrap overflow at narrow.

**Risks:** Narrow viewports may now text-wrap or overflow. Test at 768px.

**Owning agent:** ui-agent.

---

## Chapter 9 — Quiz Content Integrity (CRITICAL)

### 9.1 Florence Nightingale distractor leak

**Root cause:** Fact is `ap_euro_u7_nightingale` in `data/decks/ap_european_history.json`.
- Question: "Florence Nightingale pioneered modern nursing practices during which 19th-century **war**?"
- Correct answer: "Crimean War"
- Pool: `event_names` (mixed, heterogeneous — contains war names AND social movement names AND medical outcomes)

**Why both audit checks failed:**

1. **Check 22 in `verify-all-decks.mjs:648-655`** — substring match on full answer text. "Crimean War" does NOT appear as a literal substring in the question — only the word "war" does. So the check passes even though the answer word leaks.

2. **`quiz-audit.mjs:103-150`** — only checks that distractors don't match the correct answer (lines 176-181). **Does NOT check if the correct answer appears in the question.** Blind spot.

Additionally, the `event_names` pool is heterogeneous (wars + social movements + medical outcomes), causing cross-pool distractor contamination — "enclosure movement" and "amputation" surfaced as distractors for a war question because they're in the same pool.

**Proposed fix:**
1. Enhance `verify-all-decks.mjs` Check 22 — word-level leak detection:
   ```javascript
   const answerWords = ansLower22.split(/\s+/).filter(w => w.length >= 4);
   for (const word of answerWords) {
     if (qLower22.includes(word)) { /* flag */ }
   }
   ```
   Add `skipSelfAnswerCheck: true` field for facts where the answer must necessarily appear (e.g. "Who wrote X?" → author name).

2. Add new check in `quiz-audit.mjs`:
   ```javascript
   const correctNorm = correct.toLowerCase().trim();
   if (qLower.includes(correctNorm)) {
     issues.push({ severity: 'FAIL', type: 'answer_in_question', ... });
   }
   ```

3. **Split `event_names` pool** into `event_war_names`, `event_social_movement_names`, `medical_outcome_names` — prevents cross-pool distractor pollution.

**Test fixtures:** New `tests/unit/quiz-integrity.test.ts` with known self-answering patterns. Integration: `npm run audit:quiz-engine --deck ap_european_history` must flag this fact.

**Risks:** False positives on "Who wrote X?" style questions — mitigate with opt-out field + documentation.

**Owning agent:** content-agent + qa-agent.

---

### 9.2 Category contamination — ROOT CAUSE (biggest find of Pass 2)

**Root cause:** `categoryL1` and `categoryL2` fields **are in deck JSON** but are **NEVER persisted to `public/curated.db`**. The DDL in `scripts/build-curated-db.mjs:44-95` does not have `category_l1` or `category_l2` columns. At runtime, `src/services/domainResolver.ts:82-108` `resolveDomain()` expects `fact.categoryL1`:
```typescript
if (fact.categoryL1 && CATEGORY_TO_DOMAIN[fact.categoryL1]) { /* ... */ }
```
Since `categoryL1` is never loaded from DB, this branch is never taken. Falls back to `fact.category[0]`, which may be generic, missing, or wrong across merged custom decks.

**Proposed fix (4 phases):**

**Phase 1 — Extend DB schema** (`build-curated-db.mjs`):
```sql
CREATE TABLE deck_facts (
  -- ... existing columns ...
  category_l1 TEXT,
  category_l2 TEXT,
  ...
);
```

**Phase 2 — Update insertion** (`factToRow()`):
```javascript
return [
  // ... existing ...
  fact.categoryL1 ?? null,
  fact.categoryL2 ?? null,
];
```
And update the INSERT statement.

**Phase 3 — Runtime read** (`domainResolver.ts`):
Priority 1: Persisted `categoryL1` (now available)
Priority 2: Legacy `category[0]` fallback (for old facts)

**Phase 4 — Custom deck per-fact domain tracking** (`runManager.ts`):
```typescript
const factSourceDomainMap = new Map<string, FactDomain>();
for (const item of options.deckMode.items) {
  const deckFacts = getCuratedDeckFacts(item.deckId, item.subDeckId);
  for (const fact of deckFacts) {
    factSourceDomainMap.set(fact.id, resolveDomain(fact));
  }
}
state.factSourceDomainMap = factSourceDomainMap;
```
In `deckManager.drawHand():322`:
```typescript
card.domain = state.factSourceDomainMap?.get(factId) ?? resolveDomain(newFact);
```

**Test fixtures:** New `tests/unit/category-pipeline.test.ts`:
- `categoryL1` persisted to curated.db and loaded correctly
- `resolveDomain()` prioritizes `categoryL1` from DB
- Custom deck preserves per-fact domains across merge
- Fallback to `category[0]` for legacy facts

**Risks:**
- **DB migration**: `curated.db` must be rebuilt (`npm run build:curated`). Backup already exists at `~/Desktop/Recall_Rogue_backup_2026-04-08/`.
- Legacy decks without `categoryL1` → NULL in DB. Audit all 81 decks, ensure every fact has `categoryL1` set.
- `FACT_DOMAIN_CACHE` in `domainResolver.ts` — cleared at app startup.

**Owning agent:** content-agent + game-logic.

---

### 9.3 Every card shows "Mythology & Folklore" — automatic fix from 9.2

**Root cause:** Manifestation of 9.2. Missing `categoryL1` → fallback to uniform `category[0]` across merged custom decks → all cards get same domain color.

**Proposed fix:** Ships automatically when 9.2 ships. No separate work.

**Test fixtures:** Integration test from 9.2 covers this (custom deck with mixed sources, verify each fact has correct domain).

**Owning agent:** same as 9.2.

---

### Background worker plan

**Design:** Full audit of all 81 knowledge decks in 5-deck subset batches (~17 batches, ~30-40 min total).

**Architecture:** `scripts/background-audit-worker.mjs`:
1. Load `data/decks/manifest.json` (81 decks)
2. Chunk into batches of 5
3. Per deck: run (a) `verify-all-decks.mjs --deck X --json`, (b) `npm run audit:quiz-engine --deck X --json`, (c) LLM semantic review of 20-fact sample
4. Write checkpoint file after each batch (`audit-checkpoint-batch-N-of-17.json`)
5. Final report: `audit-report-2026-04-08-final.json`

**Invocation:** Background nohup, poll worker PID, do not sleep-loop. Resume from last checkpoint if crashed.

**Consumers:**
- content-agent reads final report, fixes flagged decks by severity
- qa-agent runs in-game smoke tests on flagged decks
- User reviews summary table before release

**Owning agent:** qa-agent (orchestration) + content-agent (remediation).

---

## Chapter 10 — Card Rendering & Hard Rule

### 10.1 HARD RULE — live card stats selector

**Root cause:** No canonical `selectLiveCardStats()` exists. Display sites compute values independently and inconsistently:

| File | Lines | Issue |
|---|---|---|
| `cardDescriptionService.ts` | 296-430, 29-48, 250-286, 185-240 | `getCardDescriptionParts`, `getDetailedCardDescription`, `getShortCardDescription` read `baseEffectValue` (=`power`) ignoring stat table for draw/hit counts |
| `damagePreviewService.ts` | 160-276 | Only attacks/shields; never addresses draw, buff stacks, debuff turns, utility cards; excludes chain/speed/crescendo modifiers |
| `cardEffectResolver.ts` | 509-2100 | Hardcodes per-mechanic values — e.g. scout/foresight `isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2)` instead of reading stat table |
| `CardHand.svelte` | 296-500+ | Displays preview (attacks/shields only) + descriptions |
| `RewardCardDetail.svelte` | 19-100 | Calls `getCardDescriptionParts` with NO game state |
| `CardCombatOverlay.svelte` | 452-492 | Builds `DamagePreviewContext` |
| `CardPickerOverlay.svelte` | — | Reward picker; calls `getCardDescriptionParts` |

**Proposed fix:**

Create `src/services/liveCardStatsSelector.ts`:
```typescript
export interface LiveCardStats {
  primaryValue: number;
  secondaryValue: number;
  drawCount: number;
  hitCount: number;
  apCost: number;
  ccValue: number;
  tags: string[];
  effectiveQpDamage: number;
  effectiveCcDamage: number;
  effectiveQpBlock: number;
  effectiveCcBlock: number;
}

export interface LiveCardStatsContext {
  card: Card;
  masteryLevel: number;
  chargeState: 'quick' | 'charge_correct' | 'charge_wrong';
  chainMultiplier: number;
  playerBuffs: { strength: number; empower: number; focusDiscount: number };
  enemyDebuffs: { vulnerable: boolean; weakness: boolean; /* ... */ };
  relicIds: Set<string>;
  activeRelicBonuses: { flat: number; percent: number };
  // ... other context
}

export function selectLiveCardStats(context: LiveCardStatsContext): LiveCardStats {
  const stats = getMasteryStats(context.card.mechanicId ?? '', context.masteryLevel);
  // ... compute all values per Ch7 canonical rules + buffs + debuffs + relics
  return { /* ... */ };
}
```

All display sites consume this selector. `cardDescriptionService.ts` reads draw/hit counts from selector, not `baseEffectValue`. Reward room passes neutral-context stub (no buffs/debuffs — acceptable because player cannot act).

**Test fixtures:** `src/services/liveCardStatsSelector.test.ts` — comprehensive matrix for every mechanic × every mastery level × every charge state × every modifier combo. Assertion: `displayedValue == runtimeAppliedValue` at every decision point.

**Risks:**
- **Performance**: Selector runs on every state change. Use `$derived.by` memoization in CardCombatOverlay; cache per card ID.
- **Reactive storms**: CardHand re-renders on every status update. Compute derived previews in CardCombatOverlay, pass as prop to CardHand (avoid cascading derivations).
- **Reward room context**: Accepts neutral stub; document contract clearly.

**Owning agent:** game-logic (selector) + ui-agent (integration) + qa-agent (matrix tests) + docs-agent (rules text).

---

### 10.2 Foresight "Draw 0"

**Root cause:** Triple failure:
1. `cardDescriptionService.ts:399`: `return [txt('Draw '), num(power)];` — `power` = `baseEffectValue` = 0 for utility cards
2. `cardDescriptionService.ts:138`: `return 'Draw ${power} cards.'` — same issue
3. `cardEffectResolver.ts:825`: `const drawCount = isChargeCorrect ? 3 : (isChargeWrong ? 1 : 2);` — hardcoded, ignores stat table

**Foresight `MASTERY_STAT_TABLES`** (`cardUpgradeService.ts:823-832`):
- L0: drawCount 1, apCost 0
- L1: 1
- L2: 2
- L3: 2 + `foresight_intent` tag
- L4: 2
- L5: 3 + `foresight_intent` tag

**Proposed fix:** All three sites read from `getMasteryStats('foresight', card.masteryLevel ?? 0).drawCount ?? 2`. Ships together with 10.1 selector.

**Test fixtures:** Unit: render Foresight at each mastery level, verify displayed draw count matches stat table and matches runtime draw count.

**Owning agent:** game-logic.

---

### Hard rule text (draft for `.claude/rules/game-conventions.md`)

```markdown
## Card Information Display (Chapter 10 HARD RULE)

**Non-negotiable principle:** Every piece of information displayed on a card — damage, block, draw count, buff stacks, debuff turns, AP cost, mastery bonuses, tags, status effect applications — must ALWAYS reflect the exact final value the card will produce if played right now, after every multiplier and modifier.

### What "live" includes
- Mastery tier and per-level stat table (`getMasteryStats` L0–L5)
- Play mode (QP, CC, CW) and charge multiplier
- Chain multiplier for the current turn
- Off-colour charge surcharges (post-Chapter 7)
- Player buffs (strength, fortify, empower %, focus AP discount)
- Enemy debuffs (weak, vulnerable, charge-resistant, hardcover)
- Relic modifiers (flat and percentage)
- Active status effects on player and enemy
- Encounter context (turn number, cards played, etc.)
- Inscriptions and persistent effects

### Update requirements
1. Combat hand: update on every state change
2. Reward room: base-neutral values (no buffs/debuffs) — acceptable because player cannot act
3. Inspect panels: show live values for current combat moment
4. Tooltips: include mastery breakdown

### Implementation
All display sites must consume `selectLiveCardStats()` — a single canonical selector. No hardcoded fallback values. No "base damage" displays. No estimation.

### Violations
Violations are bugs of the same class as incorrect damage math. Unit test matrix across all mechanics × mastery × charge × modifiers is required before shipping any card-related change.
```

---

## Chapter 11 — Reward Rooms

### 11.1 Card art audit — every card

**Root cause:** `src/ui/components/RewardCardDetail.svelte:220-226` uses CSS classes identical to `CardHand.svelte`:
```css
.frame-card-art { left: 19.9%; top: 16.3%; width: 61.3%; height: 37.0%; object-fit: cover; }
```
Comment on line 50 confirms intent: "Card rendered IDENTICALLY to CardHand.svelte". If specific cards (Quicken etc.) misalign, the issue is likely card-specific art asset dimensions in `src/ui/utils/cardArtManifest.ts` or non-standard SVG viewBox.

**Proposed fix:** Audit pipeline:
1. Iterate reward pool cards in scenario 05
2. Side-by-side screenshot of each card: reward-room vs in-combat hand
3. Pixel diff
4. For mismatches, inspect `cardArtManifest` entry + SVG viewBox
5. Adjust asset dimensions or SVG as needed

**Test fixtures:** Docker scenario 05 with per-card screenshot comparison.

**Owning agent:** ui-agent.

---

### 11.2 Pill matching — ALREADY CORRECT

**Root cause:** `RewardCardDetail.svelte:82`:
```svelte
<div class="frame-text v2-card-type" style="{GUIDE_STYLES.cardTypePill} background-color: {getChainColor(card.chainType)};"></div>
```
Already uses same `GUIDE_STYLES.cardTypePill` and `getChainColor()` as `CardHand.svelte:905,1068,1255,1442`. `docs/ui/components.md:481` confirms intentional match.

**Proposed fix:** **No-op.** Verify with side-by-side screenshot only.

**Owning agent:** ui-agent (verification only).

---

### 11.3 Power Strike weird container

**Root cause:** NOT definitively located — likely in `src/game/scenes/RewardRoomScene.ts` (Phaser scene). Pattern suggests tier-specific rendering path for `power`/`rare`/`upgraded` cards. Symptoms:
- Strange container around card in popup
- Haziness / filter overlay
- No artwork on hover (possible `opacity: 0` or `display: none` not clearing on hover state change)

**Proposed fix:**
1. Grep `RewardRoomScene.ts` for `isMasteryUpgraded`, `isUpgraded`, `cardTier === 'power'`
2. Search CSS for `opacity`, `backdrop-filter`, `filter: blur()`, `filter: overlay()` in reward components
3. Check Phaser sprite filter pipeline for tier-specific modifiers
4. Verify hover state clears all opacity/visibility modifiers

**Test fixtures:** Docker scenario 05 with Power Strike specifically in the reward pool; hover + click states.

**Risks:** Phaser scene code is trickier to debug — may need live runtime inspection via `__rrDebug()`.

**Owning agent:** ui-agent (Svelte) + game-logic (Phaser scene).

---

### 11.4 Relic popup scaling

**Root cause:** `src/ui/components/RelicPickupOverlay.svelte:137-143, 165-181` — buttons are already in flex row (lines 137-143) with correct `display: flex`. Issues:
- Font: `16px * var(--text-scale)` — already scales, but base is small
- Leave button: `background: #2d333b; color: #9ba4ad` (dark grey) — not red
- Button widths: not equal (take `36px` padding vs leave `28px`)

**Proposed fix:**
1. Font size 16px → 18px base
2. Leave button: `background: #dc2626` (red), `color: #fff`, hover `#991b1b`
3. Equal sizing: both get `min-width: calc(120px * var(--layout-scale, 1))`, same padding
4. Button text: "Take" → "Accept" (matches card reward convention)

**Test fixtures:** Docker scenario 05 screenshot of relic popup at 1920×1080.

**Owning agent:** ui-agent.

---

## Chapter 12 — Balance Tuning

### 12.1 Flat ×2 enemy damage

**Root cause:** Enemy damage pipeline:
```
damage = (intent.value + enrageBonusDamage) × strengthModifier × getFloorDamageScaling(floor)
```
Single scaling source: `src/services/enemyManager.ts:37-39` `getFloorDamageScaling()`, which reads `FLOOR_DAMAGE_SCALE_MID = 1.0` from `src/data/balance.ts:489`. Floors 1-6 use 1.0 base; floors 7+ add per-floor increment (0.09/floor).

**Proposed fix:**
1. Add to `balance.ts` after line 489:
   ```typescript
   export const GLOBAL_ENEMY_DAMAGE_MULTIPLIER = 2.0;
   ```
2. In `enemyManager.ts:303, 309`:
   ```typescript
   const floorScale = getFloorDamageScaling(enemy.floor);
   const globalMult = getBalanceValue('globalEnemyDamageMultiplier', GLOBAL_ENEMY_DAMAGE_MULTIPLIER);
   damage = Math.round(baseValue * strengthMod * floorScale * globalMult);
   ```
   Uses `getBalanceValue()` for runtime A/B testing hook.

**Test fixtures:** `/balance-sim --runs 1000` before/after. Expected win rate Δ: −15-25% dedicated, −5-10% regular. Measure: win rate, HP-at-death, turns-to-outcome, charge rate.

**Cascading impacts — MUST address:**

1. **Damage caps**: `ENEMY_TURN_DAMAGE_CAP = {1:7, 2:14, 3:20, 4:28}` (`balance.ts:492`) are per-turn hard limits. With ×2, enemies hit caps more often → damage flattens at late game. **Scale caps proportionally to `{1:14, 2:28, 3:40, 4:56}` OR keep existing (creates "cap floor" where strong enemies can't exceed old max).** User decision required.

2. **Relic rebalancing**: Damage-reduction relics (Carapace, Aegis) become more valuable. DPS relics (Lens, Spyglass) also more valuable for survival.

3. **Ascension mode**: `CANARY_CHALLENGE_ENEMY_DMG_MULT = 1.10` at line 481 → combined with ×2 = 2.2× at asc 2+. May be too punishing.

4. **Shop prices & economy**: Deadlier encounters → gold scarcity → may need to increase shop rewards.

5. **Enrage formula**: Enrage adds +1/turn for 3 turns, +2/turn after. Scales with ×2 → exponential late-game threat. Verify enrage stays capped.

**Owning agent:** game-logic (implementation), qa-agent (`/balance-sim` validation).

---

### 12.2 Bot heuristic gaps + fixes

**Root cause:** Three distinct gaps identified in `tests/playtest/headless/bot-brain.ts`:

**Gap 1 — Mastery-unaware charge EV.** Line 395: bot's charge threshold doesn't weight `perLevelDelta`. High-mastery-scaling cards get under-charged because early mastery investment pays dividends later, but EV calculation is turn-local.

**Gap 2 — QP-immunity blindness.** `planTurn` / `_orderHand` (lines 193-250, 280-340) does not check `enemy.quickPlayImmune` or `enemy.quickPlayDamageMultiplier`. Against Final Exam phase 2 (QP immune), bots waste AP on quick-plays that deal 0 damage.

**Gap 3 — Lopsided deck building.** `pickReward` (lines 446-475) at mid-tier rewardSkill doesn't penalize dominance — will pick 6th attack card if it has slightly higher delta than a gap-filling shield.

**Proposed fixes:**

**FIX 2.1** — Mastery-weighted charge EV:
```typescript
const perLevelDelta = getPerLevelDelta(card.mechanicId);
const masteryBonus = perLevelDelta > 0 ? Math.min(perLevelDelta * 2, 20) : 0;
if (skills.chargeSkill < 0.7) {
  // ...
  const adjustedChargeEV = chargeEV + masteryBonus;
  if (adjustedChargeEV <= quickEV) return 'quick';
  return adjustedChargeEV > 1.2 * quickEV ? 'charge' : ...;
}
```
Expected +5-10% win rate.

**FIX 2.2** — QP-immunity awareness:
```typescript
const enemyQpImmune = turnState.enemy.quickPlayImmune ?? false;
const enemyQpDamageMult = turnState.enemy.quickPlayDamageMultiplier ?? 1.0;
const effectiveQpDiscount = enemyQpImmune ? 0 : enemyQpDamageMult;
// Pass to _orderHand, apply in scoring:
if (type === 'attack') score += (mechanic?.quickPlayValue ?? 0) * effectiveQpDiscount * 10 / apCost;
```
Expected +3-7% against immune-phase enemies.

**FIX 2.3** — Balanced deck picking:
```typescript
const dominance = Math.max(...Object.values(typeCounts).map(c => c / deckSize));
const gapFillBonus = dominance > 0.4 ? 15 : 5;  // 3× bonus when skewed
const score = (perLevelDelta * 10) + (1.0 - currentPct) * gapFillBonus - (apCost - 1) * 3;
```
Expected +2-5%.

**Test fixtures:**
- `/balance-sim --runs 1000 --brain-profile default` before/after each fix in isolation
- Rogue Brain diagnostic: 200 episodes @ accuracy 0.75
- Human-play comparison: 20 combat scenarios, log human vs bot decisions
- `/strategy-analysis` for sanity check of per-state optimal plays

**Risks:**
- FIX 2.1 → more charges → tighter AP budget → may need card AP cost rebalancing
- FIX 2.2 → fragile if new immune mechanics added; consider abstracting to `enemyQpEffectiveness` field set at enemy creation
- FIX 2.3 → conflicts with pure high-delta pressure; dominance threshold (0.4) is a guess, needs tuning
- All three → if bots become too strong, ascension multipliers may need reducing

**Owning agent:** game-logic + qa-agent + rogue-brain.

---

## Chapter 13 — Rooms

### 13.1 Narration fires on entry (root cause)

**Root cause:** `src/services/gameFlowController.ts:2280-2302` — narration is called IMMEDIATELY AFTER checking room type, BEFORE the room UI opens:
```typescript
if (run && (room.type === 'shop' || room.type === 'rest' || room.type === 'mystery' || room.type === 'treasure')) {
  const roomNarrativeLines = getNarrativeLines({...});
  showNarrative(roomNarrativeLines, 'click-through');
}
// Then line 2305+: switch(room.type) opens UI
```
This is ENTRY narration — fires before room content, causing the overlay-then-dismiss-then-room sequence.

Combat encounters separately trigger narration at line 1671 (correct EXIT pattern, after win).

**Proposed fix:**
1. Delete the entry narration block (line 2287).
2. Add exit-phase handlers:
   ```typescript
   function onShopExit(): void {
     const narrativeLines = getNarrativeLines({ roomType: 'shop', ... });
     if (narrativeLines.length > 0) showNarrative(narrativeLines, 'click-through');
     void proceedAfterReward();
   }
   // Similar for onRestExit, onMysteryExit, onTreasureExit
   ```
3. Wire into room completion callbacks:
   - Shop → "Leave" button
   - Rest → "Continue" button
   - Mystery → effect resolution handler
   - Treasure → RewardRoom onComplete (see 13.3)

**Test fixtures:** Unit: "narration fires only on room exit, never on entry". Docker scenario 04: enter shop → no narration, leave shop → narration fires. Repeat for all 4 room types.

**Risks:**
- **Thread cooldown timing**: `_currentRoom` counter must still increment on ENTRY for cooldown math, but thread-selection logic runs on EXIT. Split the counter from the selection.
- **Async dismissal**: Use `holdScreenTransition()` to block map navigation until narration fully dismissed.
- Save format unaffected (narration is not persisted).

**Owning agent:** game-logic.

---

### 13.2 Flashcard merchant "no facts available"

**Root cause:** Two possibilities, likely both contributing.

**Part A — Deck not loaded (primary):** Curated decks load lazily via sql.js (`curatedDeckStore.ts:30-42`). Mystery event can fire before target deck is loaded. `buildStudyFacts()` at `MysteryEventOverlay.svelte:254-274` calls `getCuratedDeckFacts()` which returns `[]` if deck is not yet in the store.

**Part B — Missing trivia mode branch:** `buildStudyFacts()` only checks `runState.deckMode.type === 'study'`. In trivia dungeon mode, the check fails and returns `[]`. No fallback path.

**Proposed fix:**
1. **Deck load guarantee** in `gameFlowController.ts`:
   ```typescript
   case 'mystery':
     if (run?.deckMode?.type === 'study') {
       await ensureCuratedDeckLoaded(run.deckMode.deckId);
     }
     // ... open mystery
   ```
2. Add `ensureCuratedDeckLoaded(deckId)` to `curatedDeckStore.ts` (idempotent, returns if already loaded).
3. **Mode branching** in `buildStudyFacts()`:
   - Study mode: pull from `runState.deckMode.deckId`, prefer FSRS-selected learning facts via `runState.inRunFactTracker`
   - Trivia mode: fall back to `factsDB.getTriviaFacts()`, random 3
4. UI removes HP display (unnecessary per tracker).

**Test fixtures:** Unit: flashcard merchant provides facts in study mode (curated deck loaded). Unit: falls back to trivia if deck unavailable. Docker scenario 04 with curated deck run.

**Risks:** `ensureCuratedDeckLoaded` is async — must await at the right point in room flow. Priority: curated > trivia fallback.

**Owning agent:** game-logic.

---

### 13.3 Treasure room flicker — AUTO-FIXED BY 13.1

**Root cause:** Same as 13.1 — entry narration fires, dismisses, treasure room shows, may re-fire on overlay lifecycle interaction.

**Proposed fix:** Deleted entry trigger per 13.1. Add exit narration to `openTreasureRoom()` in the `onComplete` callback after relic selection:
```typescript
() => {
  activeRelicRewardOptions.set([]);
  const narrativeLines = getNarrativeLines({ roomType: 'treasure', ... });
  if (narrativeLines.length > 0) showNarrative(narrativeLines, 'click-through');
  void proceedAfterReward();
}
```

**Test fixtures:** Docker scenario 04: treasure room entry no narration, selection → narration fires after.

**Owning agent:** game-logic.

---

### 13.4 Per-mystery-room narration pools

**Root cause:** `NarrativeContext` already has `roomType` (`narrativeTypes.ts:83`) but `getNarrativeLines()` does not branch on mystery room subtype. All mystery rooms draw from the global pool.

**Proposed fix:**

**Option A — inline templates in room definition** (simpler):
```typescript
{
  id: 'flashcard_merchant',
  // ...
  narrationTemplatePool: {
    id: 'flashcard_merchant_narration',
    templates: [ /* 5+ templates */ ],
    priority: 'high',
  }
}
```

**Option B — separate YAML files** (preferred for content-agent iteration):
```typescript
// floorManager.ts
narrationTemplatePool: 'flashcard_merchant'  // reference to pool ID

// data/narratives/mystery-pools/flashcard_merchant.yaml
id: flashcard_merchant
templates:
  - thread: inhabitants
    text: "Knowledge is currency. The merchant smiles knowingly."
  # ...
```

Engine changes in `narrativeEngine.ts`:
1. Add `mysteryRoomId?: string` to `NarrativeContext`.
2. In `getNarrativeLines()`, if `roomType === 'mystery'` and `mysteryRoomId` is set, prefer pool templates over global.
3. Preload pools via `preloadNarrativeData()`.
4. Pass `mysteryRoomId` from gameFlowController exit handler.

**Content authoring:** ≥5 templates per mystery room, covering inhabitants/seeker/ambient threads.

**Test fixtures:** Unit: mystery room prefers its custom pool. Docker scenario 04: visit flashcard merchant → narration mentions knowledge/learning themes. Visit different mystery → different theme.

**Risks:**
- **Content density**: 8-10 mystery rooms × 5 templates = 40-80 new narrative fragments. Phased rollout — author 3-4 first.
- **Thread cooldowns**: Still applied globally across rooms, not per-pool.
- **Loading perf**: Preload at app startup.

**Owning agent:** game-logic (dispatch) + content-agent (templates).

---

## Chapter 14 — Shop Overhaul

### 14.1 Darkened overlay

**Root cause:** `ShopRoomOverlay.svelte:1499` — `.shop-overlay.landscape` background `rgba(5, 8, 12, 0.7)` is intentional modal darkening. The "right side darkened" playtest symptom is likely perception caused by uneven child content widths. Children at lines 1505-1509 may not all honor `width: min(90vw, calc(1200px * var(--layout-scale, 1)))`.

**Proposed fix:** Keep the modal darkening (correct). Verify ALL child elements (HUD, card lists, services, removal section) honor the same width constraint. If any don't, standardize.

**Test fixtures:** Docker scenario 04 at 1920×1080 with layout dump of shop container widths.

**Owning agent:** ui-agent.

---

### 14.2 Remove card selling entirely

**Root cause:**
- UI: `ShopRoomOverlay.svelte:627-656` — "YOUR DECK" section with sell buttons
- Backend: `gameFlowController.ts:1865-1883` — `onShopSell()` removes card, adds gold
- Helper: `ShopRoomOverlay.svelte:281-285` — hardcoded sell prices (10g/28g)

**Proposed fix:**
1. Delete UI lines 627-656 entirely
2. Delete `onShopSell()` from gameFlowController
3. Remove `onsell` prop from Props interface (line 98)
4. Remove sell animation state (lines 147-158, 161-170)
5. Remove `sellPrice()` function
6. Remove sell audio/bark triggers
7. Remove `onShopSell` callback from CardApp.svelte invocation
8. **Keep**: card removal service (separate, rare, expensive per tracker)

**Test fixtures:** Docker scenario 04 — no sell UI visible; removal still present.

**Risks:** Save format may persist `cardsSoldAtShop` counter or similar. Clear from save if present.

**Owning agent:** ui-agent + game-logic.

---

### 14.3 Card transform — choice of 3 (BLOCKED BY Ch15)

**Root cause:** `ShopRoomOverlay.svelte:607-622` shows "Coming soon" placeholder. No transform flow exists. Transform price calculated (`transformPrice(run.cardsTransformedAtShop)` = 35g base + 25g per use) but no execution path.

**Proposed fix:**
1. **After Ch15 ships** (`DeckCardPicker.svelte` available):
2. "Choose a card →" button opens `DeckCardPicker` in `single` mode
3. Player picks card to transform → removed from deck
4. Generate 3 replacement options via modified `generateCardRewardOptionsByType()` (pool rule: same-rarity-or-higher, any type — default)
5. Player picks one of the 3 → added to deck at mastery level per 14.7 distribution
6. Increment `run.cardsTransformedAtShop` for next-use price escalation

**Blocker:** Ch15.1 `DeckCardPicker` must exist first.

**Test fixtures:** Docker scenario 04: open transform → picker → pick card → see 3 options → select one → deck updated.

**Owning agent:** ui-agent (wiring) + game-logic (card pool generation).

---

### 14.4 Unaffordable containers

**Root cause:** `ShopRoomOverlay.svelte:1174-1183` — `.unaffordable` class applies `opacity: 0.4` to entire card-item, making text unreadable.

**Proposed fix:**
1. Remove `opacity: 0.4` from `.unaffordable` (line 1175)
2. Keep `.unaffordable .buy` styling (red border/text, button-local opacity)
3. Add readable affordance to card-item:
   - `background-color: rgba(13, 17, 23, 0.5)` (darker bg, text legible)
   - `border-color: rgba(239, 68, 68, 0.3)` (red-tinted border)
   - Optional `filter: grayscale(0.2)`

**Test fixtures:** Docker scenario 04 — unaffordable + affordable side-by-side.

**Owning agent:** ui-agent.

---

### 14.5 Shop top bar alignment

**Root cause:** `ShopRoomOverlay.svelte:461-469, 867-926` — `.shop-hud` is a custom sticky bar (`position: sticky; top: 0; z-index: 10`), not the standard `InRunTopBar` component used elsewhere. Probably fine as-is — shop-specific content (gold, leave button) differs from combat context.

**Proposed fix:** Verify sticky positioning works at all scales. If playtest noted misalignment, check that HUD respects any global top-bar offset. Consider matching `InRunTopBar` visual style (background, border, height, padding) without replacing the component.

**Test fixtures:** Docker scenario 04 — compare shop HUD vs combat HUD visual consistency.

**Owning agent:** ui-agent.

---

### 14.6 Shop cards render like in-combat hand

**Root cause:** `ShopRoomOverlay.svelte:519-580` — cards rendered as text-based list items (mechanic name, effect label, synergy badge, buy button). Not using V2 frame system from `CardHand.svelte`.

**Proposed fix:**
1. **Extract shared component**: Create `ShopCardFrame.svelte` (or `CardDisplay.svelte`) wrapping the V2 frame rendering from `CardHand.svelte` without hand-specific interactions (rotation, arc offset).
2. Reuse layers: border, card art, base frame, banner pill (from 11.2 — already correct), upgrade icon (hue-shifted by mastery), AP cost gem.
3. Text overlays: mechanic name on banner, short description, computed effect value via `getEffectValue(card)` (or live selector from Ch10).
4. Price tag: absolute-positioned bottom-right overlay.
5. Sale ribbon: diagonal "SALE" badge (already in template 535-537).
6. Reusable by card removal picker, card transform picker, and card selection overlays.

**Test fixtures:** Docker scenario 04 — side-by-side shop card vs combat hand card, pixel-compare.

**Risks:** Extraction might break in-combat rendering if not done carefully. Test combat scenario 03 after refactor.

**Owning agent:** ui-agent.

---

### 14.7 Mean-mastery upgrade distribution

**Root cause:** Shop cards currently use floor-based upgrade chance (`UPGRADED_REWARD_CHANCE_BY_FLOOR`) AND catch-up mastery system via `addRewardCardToActiveDeck()` → `computeCatchUpMastery()` at `catchUpMasteryService.ts:32-47`. Neither matches the "mean deck mastery ±1 normal" spec.

**Proposed fix:**
1. Calculate mean: `avgMastery = deckCards.reduce((s,c) => s+(c.masteryLevel??0), 0) / deckCards.length`
2. Box-Muller-approx Gaussian via sum-of-uniforms:
   ```typescript
   function randomGaussian(mean: number, stdDev: number): number {
     const u1 = Math.random();
     const u2 = Math.random();
     const u3 = Math.random();
     const z = (u1 + u2 + u3 - 1.5) * 1.15;
     return mean + z * stdDev;
   }
   ```
3. Apply per shop card: `masteryLevel = Math.max(0, Math.min(5, Math.round(deckMastery + randomGaussian(0, 0.8))))`
4. Hook in `priceShopCards()` or `openShopRoom()` AFTER generation, BEFORE inventory set.
5. Ensure catch-up mastery hook doesn't override (shop-specific path).

**Test fixtures:** Unit: deck with avg mastery 2.5 → 10,000 shop cards → assert range [0,5], center weighted 2-3, distribution looks normal-ish.

**Risks:** Catch-up mastery interaction — may need flag to skip that hook for shop-originated cards.

**Owning agent:** game-logic.

---

### 14.8 Remove synergy indicators

**Root cause:** `ShopRoomOverlay.svelte`:
- Lines 172-183 — `onCardHover`/`onCardLeave` sets `highlightedMechanics`
- Line 524, 555-559 — synergy-badge rendering
- Lines 1123-1127 — `.synergy-match`, `.synergy-none` CSS
- Lines 1620-1631 — `synergy-pulse` keyframes

**Proposed fix:**
1. Delete template synergy-badge (lines 555-559)
2. Delete hover handlers (lines 172-183)
3. Delete CSS animations (1620-1631, 1123-1127)
4. `getSynergyLabel()` and `findSynergies()` imports can stay (used elsewhere)

**Test fixtures:** Docker scenario 04 — no synergy tags visible.

**Owning agent:** ui-agent.

---

### 14.9 Relic descriptions in shop

**Root cause:** `ShopRoomOverlay.svelte:482-516` renders name, rarity pill, price. Tooltip state partially implemented at lines 209-222 (`relicTooltip`) with triggers wired at 490-491 (`onmouseenter/onmouseleave`). Tooltip rendering may be missing or incomplete.

**Proposed fix:** Verify tooltip template block exists. If missing, add:
```svelte
{#if relicTooltip}
  <div class="relic-tooltip" role="tooltip" style="...">
    <div class="tooltip-name" style="color: {RARITY_COLORS[relicTooltip.relic.rarity]}">{relicTooltip.relic.name}</div>
    <div class="tooltip-divider"></div>
    <div class="tooltip-desc">{relicTooltip.relic.description}</div>
    <!-- effects, trigger, flavor -->
  </div>
{/if}
```
Max-width 220px, z-index 200. Auto-dismiss after 3s or backdrop click.

**Test fixtures:** Docker scenario 04 — hover relic, confirm tooltip with description appears.

**Owning agent:** ui-agent.

---

### 14.10 Haggle no penalty + no retry

**Root cause:** `ShopRoomOverlay.svelte:332-426` haggle logic. Lines 414-425 fail handler applies `penaltyPrice` (30% increase) and updates `pendingPurchase.price` in-place (line 417). `haggledThisItem` flag at line 333 already prevents re-haggling structurally, but the fail penalty still applies to price.

**Proposed fix:** Simplify fail handler to no-op price:
```typescript
} else {
  haggledThisItem = true;  // structural retry block
  quizResult = 'wrong';
  hagglingState = 'result';
  // DO NOT update pendingPurchase.price — original stays
  setTimeout(() => {
    hagglingState = 'idle';
    quizResult = null;
    quizSelectedAnswer = null;
  }, 1800);
}
```
Haggle button at lines 684-691 already disabled via `!haggledThisItem`. Optionally show "Haggle used" label.

**Test fixtures:** Three unit scenarios:
- Success: reduced price → auto-buy → no further haggle
- Fail: original price kept → haggle disabled → can still buy at original
- No attempt: original price → haggle available

**Owning agent:** game-logic (haggle logic) + ui-agent (button state).

---

### 14a/14b dependency graph

**14a — Layout & Visuals** (ships first, all independent):
- 14.1 overlay (CSS)
- 14.4 unaffordable (CSS + state)
- 14.5 top bar (CSS)
- 14.6 card rendering (reuse in-combat component)
- 14.8 remove synergy (deletion)
- 14.9 relic descriptions (tooltip rendering)

**14b — Mechanics**:
- 14.2 remove selling (independent, deletion)
- 14.7 upgrade distribution (independent, formula)
- 14.10 haggle rebuild (independent, state fix)
- 14.3 card transform ← **BLOCKS on Ch15** (DeckCardPicker)

**Recommended 14b sequence:**
1. Ship 14.2 + 14.7 + 14.10 as one commit (no Ch15 dependency)
2. After Ch15 sign-off, ship 14.3 separately

---

## Chapter 15 — Card Selection Component

### 15.1 DeckCardPicker — refactor existing CardPickerOverlay

**Root cause:** `src/ui/components/CardPickerOverlay.svelte` already exists and is in active combat use (Transmute, Adapt, Conjure, Scavenge, Forge, Mimic). Props: `title`, `cards`, `onselect`, `onskip`, `pickCount`. Current state:
- ✅ V2 card frame rendering (border, artwork, base frame, banner pill, upgrade icon, AP cost gem)
- ✅ Chain color styling via `getChainColor()`
- ✅ Multi-pick logic with counter
- ❌ **3-card flex row**, not scrollable grid (can't show 20+ card deck)
- ❌ Short description text, NOT live stat numbers (violates Ch10 hard rule)
- ❌ No `multiUpTo` mode
- ❌ Props API doesn't match tracker spec (pickCount vs mode/count)

**Proposed fix:** Rename/refactor to `DeckCardPicker.svelte`:
```typescript
interface Props {
  mode: 'single' | 'multi' | 'multiUpTo';
  count: number;           // exact for 'multi', max for 'multiUpTo'
  title: string;
  cards: Card[];
  confirmLabel?: string;   // "Done", "Upgrade", "Transform", "Remove"
  onConfirm: (selected: Card[]) => void;
  onCancel: () => void;
}
```

**Enhancements:**
1. **Scrollable grid**: CSS Grid or flex-wrap; `overflow-y: auto`; max-height ~60vh to fit 3-4 rows at 1920×1080.
2. **Live stat numbers**: Import `getMasteryStats()` from `cardUpgradeService` (or `selectLiveCardStats()` from Ch10 once shipped). Render damage/block/draw as overlay badge matching in-combat position.
3. **Mode enforcement**:
   - `single`: immediate onConfirm on click
   - `multi(N)`: exact, Confirm enabled when `selected.length === count`
   - `multiUpTo(N)`: 1..N, Confirm enabled when `selected.length > 0`
4. **Dynamic confirm label** via prop.

**Test fixtures:** Unit tests per mode. Docker: 25-card deck scrollable at 1920×1080, all selectable, live stats match combat.

**Risks:** Performance with 30+ cards × 4 image layers per card. Mitigate with lazy-load art, smaller frame size in dense grid. Mobile portrait (future) needs 1-2 col layout.

**Owning agent:** ui-agent.

---

### 15.2 Study upgrade picker

**Root cause:** `src/services/gameFlowController.ts:2683` `onStudyComplete()` directly upgrades cards:
```typescript
for (const factId of correctFactIds) {
  const card = allCards.find(c => c.factId === factId);
  if (card && canMasteryUpgrade(card)) {
    masteryUpgrade(card);  // DIRECT UPGRADE, NO PICKER
    run.cardsUpgraded++;
  }
}
```
**Other upgrade grant sites:**
- Line 2858 `applyMysteryEffect()` case `'upgradeRandomCard'` — random pick
- Line 2726 `openPostMiniBossRest()` → 2458 `openUpgradeSelection(N)` — player-pick N from candidates (uses existing picker)

**Proposed fix:**
1. Refactor `onStudyComplete()`:
   ```typescript
   export function onStudyComplete(correctFactIds: string[]): void {
     const run = get(activeRunState);
     if (!run || correctFactIds.length === 0) { onRestResolved(); return; }

     activeUpgradeCandidates.set(getActiveDeckCards());
     pendingUpgradeConfig.set({
       mode: 'multi',  // exact N — decided during impl
       count: correctFactIds.length,
       sourceFactIds: correctFactIds,
     });
     gameFlowState.set('studyUpgradePicker');
     currentScreen.set('studyUpgradePicker');
   }
   ```
2. New handler `onStudyUpgradeSelected(selectedCards)`:
   ```typescript
   for (const card of selectedCards) {
     if (canMasteryUpgrade(card)) {
       masteryUpgrade(card);
       run.cardsUpgraded++;
       queueMasteryFlash(card.id, 'up');  // animation queue
     }
   }
   onRestResolved();
   ```
3. **Animation wiring**: Create `pendingMasteryFlashes` store (parallel to combat `masteryFlashes`). Picker renders cards, plays flash in sequence (100ms stagger) after confirmation, before next screen.
4. Add new screen state `'studyUpgradePicker'` in `gameState.ts`.

**Test fixtures:** Unit: `onStudyComplete(['fact1','fact2'])` → picker opens N=2 → onConfirm([c1,c2]) → both upgraded. Docker: study session → 2 correct → picker → animation.

**Risks:**
- Fact-to-card lookup via `factId` — if multiple cards have same fact (unlikely but possible), which gets upgraded? Filter picker to eligible-for-upgrade only.
- Upgrade eligibility: cards at mastery 5 or locked by ascension — grey out in picker.
- Store conflicts with existing upgrade pickers (rest room, mini-boss rest) — use distinct state key.

**Owning agent:** game-logic (flow) + ui-agent (picker integration + animation).

---

### Reuse consumers

| Consumer | Mode | Status |
|---|---|---|
| 15.2 Study upgrade | multi(N) | NEW — this chapter |
| 14.3 Card transform | single | BLOCKED by 15.1 |
| Existing shop card removal | single | PARTIALLY IMPLEMENTED (inline in ShopRoomOverlay) — migrate to DeckCardPicker post-15.1 |
| Mystery event `removeRandomCard` | (random, not picker) | Could convert to player-choice if desired |
| Combat card-pick mechanics (Transmute, Adapt, Conjure, Scavenge, Forge, Mimic) | multi | EXISTING USAGE of CardPickerOverlay — refactor must not break combat |
| Future: exile effects | single/multi | Placeholder |
| Future: event choices | varies | Placeholder |

**Critical**: Refactoring CardPickerOverlay must preserve existing combat use cases. Run combat scenario 03 smoke test before committing.
