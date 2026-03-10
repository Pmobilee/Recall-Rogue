# AR-27: Card Tier-Up Celebration Animations

## Summary
Completed AR-27 with tier-up celebration flow and per-fact visual variation:
- Tier transitions trigger dedicated color-coded celebration phases.
- A deterministic per-fact signature now personalizes each tier-up overlay.
- Sequence timing preserves reveal → tier-up → mechanic → launch pacing.

## Design Reference
From `docs/GAME_DESIGN.md`:

> "| Tier 1 → 2a (Recall) | Blue glow | Card rumbles, blue pulse radiates outward |"

> "| Tier 2a → 2b (Deep Recall) | Green glow | Card rumbles, green pulse, brief sparkle particles |"

> "| Tier 2b → 3 (Mastered) | Purple/Gold glow | Card rumbles, purple-to-gold gradient pulse, per-fact unique animation (future art asset) |"

> "**Timing**: The tier-up animation inserts a ~600ms celebration phase between the existing 'reveal' (400ms) and 'mechanic' (500ms) phases."

## Implementation
### Data Model
- No persistent schema changes required.
- Reused existing transient `tierUpTransitions` map keyed by card ID.

### Logic
- Tier-up transition detection already happens after answer commit in `CardCombatOverlay`.
- Added deterministic per-fact signature generation in `CardHand`:
  - hash from `factId`
  - hue, sparkle anchors, trace rotation, intensity variables
- Signature variables are injected into tier-up overlay styles for both hand cards and animation-buffer cards.

### UI
- Tier-up overlay now renders layered per-fact signature effects:
  - signature spark field (`::before`)
  - rotating trace ring (`::after`)
- Existing transition-specific color language remains intact:
  - blue (`tier1_to_2a`)
  - green (`tier2a_to_2b`)
  - purple/gold (`tier2b_to_3`)

### System Interactions
- Works within existing card animation orchestration (`CardCombatOverlay` + `CardHand`).
- No changes to combat resolution, FSRS updates, or mechanic application order.

## Edge Cases
- Empty/missing `factId` falls back to a stable default signature seed.
- Reduced-motion compatibility is preserved because this enhancement only augments existing tier-up overlays.
- Deterministic hash ensures visual consistency across sessions for the same fact.

## Files To Modify
- `src/ui/components/CardHand.svelte`
- `docs/roadmap/PROGRESS.md`

## Done-When Checklist
- [x] Tier-up transition visuals remain distinct by transition type.
- [x] ~600ms celebration phase remains in the answer animation sequence.
- [x] Per-fact deterministic visual variation is applied to tier-up overlays.
- [x] Hand and animation-buffer card paths both render the same per-fact signature.
- [x] Roadmap references updated to point at completed AR-27 spec.
