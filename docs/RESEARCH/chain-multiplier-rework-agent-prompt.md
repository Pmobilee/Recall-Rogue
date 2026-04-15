# Chain Multiplier Rework — Agent Prompt

Paste this into a fresh Claude Code conversation to implement the rework.

---

## Prompt

Implement the chain multiplier rework specified in `docs/RESEARCH/chain-multiplier-rework.md`. Read that file first — it has the full design, formulas, balance tables, and verification plan.

### What's changing

Chain multiplier currently compounds with CC, Strength, Vulnerability, Empower, relic %, Overclock, and every other multiplicative modifier. This creates exponential scaling (~141 damage ceiling), lying card descriptions (chain is invisible to card faces), and dead DoT playstyles (poison/burn/bleed are chain-immune).

The fix: chain adjusts `qpValue` (base) BEFORE other multipliers, and extends to all card types (DoT stacks, block, debuff duration, heals).

### Critical code locations

**Primary change — `src/services/cardEffectResolver.ts` (2425 lines):**
- Line 325: `chainMultiplier` field on `AdvancedOptions`
- Line 549: `const chainMultiplier = advanced.chainMultiplier ?? 1.0;`
- **Line 683**: `const scaledValue = Math.round(rawValue * chainMultiplier * speedBonus * buffMultiplier * attackRelicMultiplier * overclockMultiplier * factDamageBonusMult * surgeMultiplier);` — THIS IS THE LINE. Chain must move to base: compute `chainAdjustedBase = Math.round(qpValue * chainMultiplier)` earlier (~line 550), use it as input. Remove `chainMultiplier` from the scaledValue multiplication.
- Line 786: same pattern for `scaledBonus` — chain compounds there too
- Line 1263: `chain_lightning` hardcode — needs special attention, may need its own path
- DoT cards (hex, kindle, lacerate, rupture, entropy): find where `extras.stacks` and `secondaryValue` are applied. Chain currently does NOT touch these — add `Math.round(stacks * chainMultiplier)` and `Math.round(secondaryValue * chainMultiplier)`.
- Block cards: find where `qpValue` feeds block amount. Apply chain to base there too.
- Debuff cards (expose, weaken, slow): find duration application. Add soft scaling: `Math.round(turns * (1 + (chainMultiplier - 1) * 0.5))`.
- Buff cards (empower, warcry, frenzy): do NOT scale. Chain-immune.
- Utility cards (scout draw count): do NOT scale draw count. DO scale heal amounts (lifetap, siphon_strike).

**Card face display — `src/services/damagePreviewService.ts` (321 lines):**
- `DamagePreviewContext` at line 20 — add `chainMultiplier: number` field
- `computeDamagePreview` at line 156 — use `Math.round(qpValue * chainMultiplier)` as base for preview. Apply chain to secondaryValue/stacks for DoT preview.

**Description service — `src/services/cardDescriptionService.ts` (1182 lines):**
- `getCardDescriptionParts` needs to accept chain-adjusted values so card text shows "Apply 6 Poison" (not "Apply 3 Poison") when chain is active.

**Live stats wiring — `src/services/liveCardStats.ts` (145 lines):**
- Wire `chainMultiplier` from `LiveCardTurnContext` into `DamagePreviewContext`.

**UI wiring — `src/ui/components/CardCombatOverlay.svelte`:**
- Pass chain state to `DamagePreviewContext` in the `damagePreviews` computation.

**Docs to update (same commit):**
- `docs/mechanics/chains.md` — new formula, playstyle extensions
- `docs/mechanics/combat.md` — damage pipeline documentation
- `.claude/rules/game-conventions.md` — update "Chain multipliers stack multiplicatively"

### Verification sequence

1. Run existing unit tests: `npx vitest run` — nothing should break for chain=0 scenarios
2. Write new tests for:
   - Attack at chain 0/3/5 with Strength: verify ceiling is reduced vs old formula
   - Hex at chain 0/3/5: verify poison stacks scale
   - Kindle at chain 0/3/5: verify burn stacks scale
   - Block at chain 0/3/5: verify block amount scales
   - Expose at chain 3: verify duration soft-scales, stacks don't
   - Empower at chain 5: verify magnitude is NOT scaled
   - Scout at chain 5: verify draw count is NOT scaled
   - Card face preview: verify shows chain-adjusted base
3. Run headless balance sim: `npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 3000` — check win rates haven't cratered
4. Visual verify: Docker visual test of combat with chain active, confirm card faces update live
5. Run `npm run typecheck && npm run build` — clean

### What NOT to change

- `CHAIN_MULTIPLIERS` values in `src/data/balance.ts` — keep `[1.0, 1.2, 1.5, 2.0, 2.5, 3.5]` unless sim data says otherwise
- Chain building/breaking logic in `src/services/chainService.ts` — untouched
- Turn order, AP costs, card draw — untouched
- Any user-facing text that isn't directly about chain values
