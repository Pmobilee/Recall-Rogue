# Chain Types: Phase 1 — Random Even Distribution

## Overview

Implement 6 chain types assigned evenly across the fact pool at run start. No semantic categorization yet — pure even distribution. Facts are bound to cards persistently within a run, and chain type is visible during card reward selection, enabling chain-aware deckbuilding.

## 1. The 6 Chain Types

| Index | Name | Hex Color | Glow Color (30% opacity) |
|-------|------|-----------|--------------------------|
| 0 | Obsidian | `#546E7A` | `rgba(84, 110, 122, 0.30)` |
| 1 | Crimson | `#EF5350` | `rgba(239, 83, 80, 0.30)` |
| 2 | Azure | `#42A5F5` | `rgba(66, 165, 245, 0.30)` |
| 3 | Amber | `#FFA726` | `rgba(255, 167, 38, 0.30)` |
| 4 | Violet | `#AB47BC` | `rgba(171, 71, 188, 0.30)` |
| 5 | Jade | `#26A69A` | `rgba(38, 166, 154, 0.30)` |

Six colors chosen for maximum visual distinction on small mobile card frames.

## 2. Fact-to-Card Binding

### Design Change from GDD

The GDD currently shuffles facts and card slots independently each draw. **This changes.** Facts are now bound to card slots for the duration of a run.

**Why:** Chain type is a property of the fact. If facts shuffle freely, the player has zero control over chain composition and chain-aware deckbuilding is impossible. Binding facts to cards makes chain type a visible, persistent property of each card — enabling strategic card selection, removal, and pool optimization.

### How It Works

1. At run start, `buildRunPool()` creates card slots AND assigns one fact per slot
2. Each fact has a `chainType` (0-5) assigned at run start (see section 3)
3. The fact stays bound to its card slot for the entire run
4. When a hand is drawn, cards come with their bound facts — no re-pairing
5. Chain type is visible on the card at all times (AP cost color + glow)

### What This Means for Existing Systems

- **"Every hand is a fresh chain puzzle"** — still true, because which cards you DRAW from a shuffled deck varies each hand. The puzzle is "which of my cards appeared together this draw" not "which random facts landed where"
- **Anti-nuke concern** ("known fact bonded to Heavy Strike") — now a feature. If a player masters a fact on their best attack card, they earned that through quiz mastery. FSRS pushes the fact to harder variants, preventing permanent freebies
- **Card removal at shops** — now also removes the bound fact from the pool. Thinning the deck concentrates both mechanics AND chain types
- **Encounter cooldown** — still applies per fact. See cooldown handling below

### Fact Cooldown With Bound Cards

When a bound fact is on cooldown:
1. Card slot remains in the draw pile and can be drawn
2. If drawn while its fact is on cooldown, the card draws a **temporary replacement fact** from a small overflow pool (no chain type — displays grey/neutral, cannot chain)
3. The original bound fact returns after cooldown expires
4. **Alternative (simpler):** Card slots with cooled-down facts sink to the bottom of the draw pile, making them unlikely to be drawn. Avoids temp-fact complexity entirely. **Pick whichever approach is cleaner to implement.**

## 3. Chain Type Assignment

### Where: `buildRunPool()`

After facts are bound to card slots:

```
1. Collect all bound facts into an array
2. Shuffle the array (Fisher-Yates)
3. Assign chainType by index: fact.chainType = shuffledIndex % 6
4. Store chainType on each fact for the duration of the run
```

### Rules

- Assignment happens ONCE at run start, persists for the entire run
- Every fact gets exactly one `chainType` (0-5)
- Distribution is perfectly even (max difference between any two groups = 1)
- `chainType` is runtime-only — not persisted to the database

### Schema Addition

```typescript
interface RuntimeFact {
  // ... existing fields
  chainType: number; // 0-5, assigned at run start
}
```

## 4. Chain Resolution

### Replace the L2 Check

```typescript
// BEFORE
const isChain = currentFact.categoryL2 === previousFact.categoryL2;

// AFTER
const isChain = currentFact.chainType === previousFact.chainType;
```

### Chain Rules (unchanged from GDD)

- Chain built by consecutive Charge plays only
- Quick Play breaks the chain
- Wrong Charge answer breaks the chain
- Multipliers: 1.0x (none), 1.3x (2-chain), 1.7x (3-chain), 2.2x (4-chain), 3.0x (5-chain)

## 5. Card Reward Screen

When the player is offered 3 cards after an encounter:

### What's Shown Per Card

- Card mechanic (Strike, Block, Hex, etc.) — existing
- Card effect values — existing
- **NEW: Bound fact preview** — the quiz question or fact statement (truncated if needed)
- **NEW: Chain type indicator** — chain type name + colored badge matching the type

### Chain Type Badge

- Small pill/tag in the top-right or bottom-left of the reward card
- Background: chain type color at 20% opacity
- Text: chain type name (e.g., "Obsidian") in chain type color
- Border: 1px solid chain type color at 40% opacity

### Reward Generation Constraint

Enforce **at least 2 distinct chain types** across the 3 card reward options. Prevents all 3 being the same type (which removes choice) while allowing duplicates (2 of one type + 1 of another creates a "do I double down?" moment).

```
1. Generate 3 card reward candidates normally
2. Check distinct chainType count across the 3
3. If all 3 share the same chainType, re-roll one card's fact
   (swap its fact for a random fact with a different chainType)
4. Max 1 re-roll
```

## 6. Visual: AP Cost Text Color

The AP cost badge on each card shows a number (e.g., "1", "2"). Change the **text color** to the card's chain type color.

### Spec

- **Element:** AP cost number text
- **Color:** Hex color from chain type table
- **When:** All card states (in hand, selected, committed)
- **Readability:** Add `textShadow: '0 0 2px rgba(0,0,0,0.6)'` for contrast against badge background

## 7. Visual: Chain Type Glow (Top-Left)

Soft radial glow on the **top-left corner** of the card frame.

### Spec

- **Position:** Top-left, centered ~12px from top and left edges
- **Shape:** Radial gradient, circular, ~28-32px diameter
- **Color:** Chain type glow color (base color at 30% opacity)
- **Falloff:** 100% at center → 0% at edge (smooth radial)
- **Layer:** Behind card content, above card background

### Pulse Behavior

When 2+ cards in hand share a `chainType`, their glows pulse in sync:

- Opacity oscillates 30% → 60% over 1.5s cycle (sine wave)
- Only matching cards pulse; non-matching stay static at 30%
- All cards of the same `chainType` share animation phase

## 8. Draw Smoothing

After drawing a hand, check for chain potential:

```
1. Count chainType occurrences across drawn cards
2. If NO chainType appears 2+ times:
   a. Pick one card in the hand
   b. Swap it to the bottom of the draw pile
   c. Draw a replacement, preferring a card whose chainType
      matches any other card already in hand
   d. Max 1 swap per draw
3. If no valid replacement exists, skip
```

With 6 types and a 5-card hand, natural pair probability is ~85%. Draw smoothing should rarely fire.

## 9. Shop: Card Removal

When removing a card at a shop:

- Show chain type indicator on all removable cards
- Show a small chain composition summary: e.g., "Obsidian x4, Crimson x3, Azure x2..."
- Removing a card removes its bound fact from the run's fact pool

Enables deliberate thinning toward chain concentration.

## 10. Chain Counter Display

Above the hand during combat:

- **Format:** `"{Name} Chain x{length}"` — e.g., "Jade Chain x3"
- **Text color:** Chain type color
- **On chain break:** Counter fades out (existing behavior)

## 11. Relic Compatibility

- **Tag Magnet:** +30% draw bias toward cards sharing `chainType` of last played card
- **Chain Reactor, Resonance Crystal, Echo Chamber, Prismatic Shard:** Trigger on chain length — no changes needed

## 12. What This Does NOT Change

- Card mechanics (Strike, Block, etc.)
- Combo system (consecutive correct answers, not chain type)
- Surge system
- Quiz system
- Fact schema in the database (`chainType` is runtime-only)

## 13. Testing Checklist

- [ ] 6 chain types distribute evenly across fact pools of various sizes
- [ ] Facts bind to card slots at run start and persist through the run
- [ ] Chain resolution uses `chainType` instead of `categoryL2`
- [ ] AP cost text renders in chain type color with readable contrast
- [ ] Top-left glow renders on all card states
- [ ] Matching cards pulse in sync, non-matching stay static
- [ ] Card reward screen shows chain type badge and fact preview
- [ ] Reward generation enforces 2+ distinct chain types across 3 options
- [ ] Draw smoothing activates only when zero pairs exist
- [ ] Card removal at shop removes bound fact from pool
- [ ] Shop shows chain composition summary
- [ ] Tag Magnet relic uses `chainType` for draw bias
- [ ] All chain relics trigger on chain length correctly
- [ ] Fact cooldown works with bound cards (whichever approach chosen)
- [ ] Works across all deck sizes and domain combinations
