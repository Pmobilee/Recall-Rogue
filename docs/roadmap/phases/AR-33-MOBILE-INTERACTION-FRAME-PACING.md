# AR-33: Mobile Interaction Frame Pacing (Pass 2)

## Summary
Second-pass mobile performance hardening focused on interaction frame pacing and combat UI responsiveness.

Scope:
- Reduce per-frame JS churn during card drag interactions.
- Keep timer UI smooth while cutting unnecessary update frequency.
- Preserve gameplay behavior and visual quality on normal devices.

This phase intentionally excludes relic-system changes.

## Design Reference
From `docs/GAME_DESIGN.md`:

> "Phaser performance: 60fps target. ~15 game objects in combat. 50 particle cap..."

> "Top 55% (Display)... Bottom 45% (Interaction): Card hand, answer buttons, hint, End Turn, player HP bar (at 88% Y), relic tray (at 92% Y, horizontal scroll)..."

> "Dynamic Timer System... timers adapt to BOTH floor depth AND question length."

AR-33 aligns implementation with these constraints by optimizing UI interaction update cadence rather than removing effects or changing combat rules.

## Implementation

### Data Model
- No save schema changes.
- No DB schema changes.

### Logic
- `CardHand` drag updates are now frame-scheduled with `requestAnimationFrame` instead of mutating reactive drag state on every pointer event callback.
- Added explicit drag frame cleanup/cancel handling (`pointercancel` + RAF cancellation).
- `CardExpanded` timer now updates at a capped cadence (~30Hz) while preserving timeout and speed-bonus correctness with high-resolution timestamps.

### UI
- Hand card transforms use `translate3d(...)` to favor GPU composition.
- Added `will-change: transform, opacity` to card elements used in drag/launch/fizzle phases.
- Preserved visual effects and timing semantics from prior behavior.

### System Interactions
- No changes to run flow, FSRS, rewards, ingestion, or relic progression.
- No changes to content generation or cardback generation pipelines.

## Edge Cases
- Pointer cancellation (gesture interruption, OS-level interruptions) now cleanly resets drag state without stray casts.
- Timer expiry still auto-skips once and cannot double-fire.
- Speed bonus uses latest elapsed time sample at answer commit to avoid stale threshold checks.

## Files To Modify
- `src/ui/components/CardHand.svelte`
- `src/ui/components/CardExpanded.svelte`
- `docs/roadmap/PROGRESS.md`
- `docs/roadmap/phases/AR-33-MOBILE-INTERACTION-FRAME-PACING.md`

## Done-When Checklist
- [x] New AR-33 phase doc created with clear scope and acceptance criteria.
- [x] Card drag updates throttled to frame cadence.
- [x] Drag cancel/cleanup path hardened.
- [x] Timer rendering cadence optimized for lower CPU overhead.
- [x] Speed-bonus and timeout behavior preserved.
- [x] `npm run typecheck` passes.
- [x] Targeted tests (if available) pass for combat card interaction flow.
