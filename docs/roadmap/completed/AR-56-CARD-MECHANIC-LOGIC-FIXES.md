# AR-56: Card Mechanic Logic Fixes

**Status:** Pending
**Created:** 2026-03-16

---

## Bug 1: Double Strike doesn't double non-attack cards

**Current:** `if (advanced.isDoubleStrikeActive && effectiveType === 'attack')` — only doubles attack damage.
**Problem:** Description says "next card hits twice" but if you play Double Strike → Scout, Scout draws normally. The doubling silently doesn't apply.
**Fix:** Double Strike's description says "next ATTACK hits twice." Keep the attack-only restriction but make the description crystal clear: "Next attack card hits twice at full power." The buff should PERSIST until the next attack is played, not consume on any card.

Currently: Double Strike sets `doubleStrikeReady = true`, and it's consumed on line 483: `if (useDoubleStrike && card.cardType === 'attack') turnState.doubleStrikeReady = false`. This is correct — it only consumes on attacks. BUT `useDoubleStrike` on line 459 checks `turnState.doubleStrikeReady && card.cardType === 'attack'`, so non-attack cards don't trigger or consume it. This is actually working correctly — the buff persists until you play an attack.

**The real bug** is that Overclock (2x everything) consumed on ANY card type, not just attacks. Let me verify...

Actually Overclock: line 461 `const useOverclock = turnState.overclockReady` — no card type check! And line 488: `if (useOverclock) { turnState.overclockReady = false; }` — consumes on ANY card. So Overclock doubles everything including draw cards. BUT when it doubles Scout's draw... let me check if `overclockMultiplier` affects `extraCardsDrawn`.

The `overclockMultiplier` multiplies `finalValue` (line ~160). Then `extraCardsDrawn` is set from `finalValue` in the scout/recycle cases. So Overclock + Scout SHOULD draw 4 (2 × 2). But Overclock + Recycle should draw 6 (2 × 3). Need to verify this actually works.

**Fix:** Ensure descriptions match behavior. Double Strike = attack-only doubling (working correctly, just needs clear description). Overclock = universal doubling (should be working but verify).

## Bug 2: Transmute is random and confusing

**Current:** 1 AP, transforms a RANDOM card in hand to a random different type. Player has no control.
**Problems:**
- Spending 1 AP for a random transformation is frustrating
- Can turn your best card into garbage
- No player agency
- Does the transformation persist? Yes, for the rest of the encounter (it replaces the card in `hand[]`)

**Fix options:**
A) **Let player choose which card to transform.** After answering the quiz, show a selection UI: "Choose a card to transform." Still random what it transforms INTO, but at least you pick which card to sacrifice.
B) **Transform into a BETTER card.** Instead of random type, always transform into a higher-tier version of the same type (upgrade the mechanic).
C) **Show 3 random options to choose from.** Like a reward screen — pick which transformation you want.

**Recommended: Option A** — player chooses which card, random result. This is the simplest UI change and makes Transmute feel strategic ("I'll transform this bad Block into something potentially better").

For now as a quick fix: **Change to transform the WORST card in hand** (lowest base effect value) instead of random. This is automatic but smart — it always upgrades your weakest card.

## Bug 3: Verify Overclock doubles ALL effects properly

Need to verify that `overclockMultiplier = 2` in the `finalValue` calculation actually propagates to:
- `extraCardsDrawn` for Scout/Recycle
- `shieldApplied` for Block
- `damageDealt` for Strike
- Status effect values for debuffs

## TODO

1. [ ] Fix Double Strike description to clearly say "Next ATTACK card hits twice"
2. [ ] Fix Transmute to target worst card in hand (not random)
3. [ ] Verify Overclock doubles draw effects (Scout → 4 cards, Recycle → 6 cards)
4. [ ] Update descriptions in mechanics.ts and cardDescriptionService.ts
5. [ ] Update GAME_DESIGN.md

## Files Affected

- `src/data/mechanics.ts` — description updates
- `src/services/turnManager.ts` — Transmute targeting
- `src/services/cardDescriptionService.ts` — description updates
- `docs/GAME_DESIGN.md` — mechanic table updates
