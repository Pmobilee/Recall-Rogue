# CR-12: Echo Mechanic

> Phase: P1 — Core Systems Completion
> Priority: HIGH
> Depends on: CR-FIX-06 (FSRS migration)
> Estimated scope: M

When a fact is answered incorrectly during a run, there's a 70% chance it reappears later as an "Echo" card — a ghostly, translucent version with reduced power. Correctly answering an Echo strengthens the original fact's FSRS score more than a normal correct answer (double benefit). Echoes naturally punish poor performance by diluting the hand with weaker cards, but redeeming them is a powerful learning moment.

## Design Reference

From GAME_DESIGN.md Section 11 (Echo Mechanic):

> When a fact is answered wrong during a run, 70% chance it reappears later as an "Echo" card.
>
> **Visual:** Translucent/ghostly appearance. Shimmers slightly. Clearly distinct from normal cards.
>
> **Behavior:** Reduced power (0.7x multiplier). Same question, same fact. Second chance while it's still fresh.
>
> **On correct answer:** Echo solidifies into brief golden flash, then disappears. Removes the Echo AND strengthens the original fact's FSRS score (double benefit).
>
> **On wrong again:** Echo discarded normally. FSRS records second miss.
>
> **Design effect:** Poor performance = more Echoes diluting your hand with weaker cards. Natural difficulty from struggling. But each redeemed Echo is a learning win.

Research: Karpicke & Roediger (2008) — immediate re-testing after failure is one of the most effective spaced repetition micro-patterns.

## Implementation

### Data Model

The `Card` interface already has `isEcho?: boolean`. No new interface needed.

**Add to `src/data/balance.ts`:**

```typescript
export const ECHO = {
  REAPPEARANCE_CHANCE: 0.70,
  POWER_MULTIPLIER: 0.70,
  FSRS_STABILITY_BONUS: 2.0,     // 2x stability gain for redeemed echoes
  MAX_ECHOES_PER_RUN: 15,
  INSERT_DELAY_CARDS: 3,          // Echo enters draw pile at least 3 cards from top
};
```

### Logic

**Echo generation** — Modify `encounterBridge.ts` or `turnManager.ts`:

On incorrect answer:
1. Roll `Math.random() < ECHO.REAPPEARANCE_CHANCE` (0.70)
2. If roll succeeds AND total echoes this run < `MAX_ECHOES_PER_RUN`:
   a. Check that no echo for this `factId` already exists in this run
   b. Clone the failed card: same `factId`, `cardType`, `tier`, mechanic
   c. Set `isEcho: true`
   d. Multiply `baseEffectValue` by `ECHO.POWER_MULTIPLIER` (0.7x)
   e. Generate new card ID: `echo_<nanoid>`
   f. Insert into draw pile at position `max(INSERT_DELAY_CARDS, random spot in bottom 60%)`

**Echo resolution** — Modify `cardEffectResolver.ts`:
- Echo cards resolve like normal cards, using their already-reduced `baseEffectValue`
- Exception: if Echo Chamber relic is active, override `baseEffectValue` to original (non-reduced) value

**FSRS update on Echo answer:**
- Correct Echo: call FSRS update with `rating: 'good'`, then multiply the resulting stability gain by `ECHO.FSRS_STABILITY_BONUS` (2.0x)
- Wrong Echo: call FSRS update with `rating: 'again'` (standard miss, no extra penalty)

**Echo tracking** — Add to run state:
```typescript
echoFactIds: Set<string>     // Track which facts already have echoes this run
echoCount: number            // Total echoes generated this run
```

**Echo cleanup:**
- On encounter end or run end: echoes that were never drawn are silently discarded (no FSRS impact)
- Echoes in discard pile are reshuffled normally

### UI

**Echo card visual treatment:**
- Opacity: 0.65 (translucent)
- CSS filter: `brightness(1.2) contrast(0.85)` (ethereal quality)
- Border: dashed style instead of solid
- Shimmer: CSS `@keyframes` with opacity oscillation 0.55-0.75, 2s period
- Ghost icon in top-right corner of card (small translucent overlay)

**Echo redemption animation (correct answer):**
1. Card opacity transitions from 0.65 to 1.0 over 300ms
2. Golden flash overlay (smaller version of Mastery Trial celebration)
3. Card border solidifies from dashed to solid gold
4. Normal card launch/dissolve animation plays
5. Toast: "Echo Redeemed!" (auto-dismiss 1.5s)

**Echo fizzle animation (wrong again):**
- Card dissolves with darker particles (gray/purple instead of normal sand)
- No special notification (standard wrong answer flow applies)

### System Interactions

- **Combo:** Echo correct answers DO count toward combo. Echo wrongs DO reset combo.
- **AP:** Echo cards cost 1 AP like normal (unless mechanic says otherwise).
- **Tier:** Echo preserves original tier. Tier 2a echo = 4 answer options.
- **Mechanic:** Echo preserves same mechanic as original failed card.
- **Echo Chamber relic (CR-09):** Removes 0.7x penalty. Echo deals full power.
- **Mastery Trial:** Failed Mastery Trials do NOT generate echoes.
- **Card reward (CR-13):** Echoes are NOT included in card reward selection.
- **Run pool:** Echoes are temporary per-run cards. Don't affect pool count.
- **FSRS:** Double stability benefit on redemption. Standard miss on second failure.
- **Deck reshuffling:** Echoes in discard pile ARE reshuffled into draw pile normally.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Wrong answer but 70% roll fails | No echo generated. Normal fizzle. |
| Echo cap reached (15 echoes already) | No new echoes regardless of roll. |
| Echo of an Echo (wrong on echo) | NO further echoes. Echoes cannot spawn echoes. |
| Echo drawn as last card in draw pile | Normal draw. Reshuffles include echoes in discard. |
| Same fact wrong twice in same turn | Only 1 echo per factId per run (tracked by echoFactIds set). |
| Echo drawn but player skips it | Echo goes to discard. No FSRS update. Can be drawn again after reshuffle. |
| Run ends with undrawn echoes | Silently discarded. No FSRS impact. |
| Echo card + speed bonus | Speed bonus applies normally to echoes. |
| Echo card + combo | Combo applies normally. Echo correct = combo continues. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Modify | `src/data/balance.ts` | Add ECHO config constants |
| Modify | `src/services/encounterBridge.ts` or `turnManager.ts` | Echo generation on wrong answer |
| Modify | `src/services/deckManager.ts` | Insert echo into draw pile at delayed position |
| Modify | `src/services/cardEffectResolver.ts` | Echo Chamber relic check for power multiplier |
| Modify | `src/services/runManager.ts` | Add echoFactIds and echoCount to RunState |
| Modify | `src/ui/components/CardCombatOverlay.svelte` | Echo visual treatment (opacity, shimmer, ghost icon) |
| Create | `tests/unit/echoMechanic.test.ts` | Unit tests for echo generation, resolution, FSRS double benefit |

## Done When

- [ ] Wrong answers have 70% chance to generate an Echo card
- [ ] Echo cards have 0.7x base effect value (visible in damage/block/heal numbers)
- [ ] Echo cards are visually distinct: translucent (0.65 opacity), shimmer animation, ghost icon, dashed border
- [ ] Echo cards appear in draw pile with at least 3-card delay from top
- [ ] Correct Echo answer shows golden solidify animation + "Echo Redeemed!" toast
- [ ] Correct Echo answer gives FSRS 2x stability benefit
- [ ] Wrong Echo answer is standard fizzle (no extra penalty, no new echo)
- [ ] Echoes cannot spawn further echoes
- [ ] Only 1 echo per unique factId per run
- [ ] Max 15 echoes per run (safety cap)
- [ ] Mastery Trial failures do NOT generate echoes
- [ ] Echo Chamber relic removes 0.7x penalty (full power)
- [ ] Echo correct answers count toward combo
- [ ] Skipped echoes go to discard, no FSRS update
