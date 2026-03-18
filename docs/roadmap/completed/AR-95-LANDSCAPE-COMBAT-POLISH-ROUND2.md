# AR-95: Landscape Combat Polish Round 2

## Issues from Full Visual Audit (1920×1080, 1280×800, 390×844)

### Bug 1: AP Orb Overlaps Draw Pile (MEDIUM)
**Symptom:** AP orb at (29,712), draw pile at (38,693) — both in bottom-left, overlapping.
**Fix:** In landscape, move draw/discard pile indicators to a different position. Options:
- Move draw/discard to the right side of the card hand (near End Turn)
- Or move AP orb above the draw pile with more spacing
- Or integrate draw/discard count into the card hand strip as text labels

### Bug 2: Card Hand Not Dimming During Quiz (MEDIUM)
**Symptom:** `.card-hand-quiz-dimmed` class never applied. `quizVisible` prop doesn't reach the landscape card hand during charge play.
**Root cause:** In `CardCombatOverlay.svelte`, `quizVisible={cardPlayStage === 'committed'}` is passed to `<CardHand>`. But the quiz uses `CardExpanded.svelte` which manages its own state. The `cardPlayStage` may reset before the quiz panel renders, or the landscape branch of CardHand doesn't receive the prop.
**Fix:** Trace the exact prop flow:
1. Read `CardCombatOverlay.svelte` — find where `quizVisible` is passed
2. Read `CardHand.svelte` — find where `quizVisible` is consumed in the landscape branch
3. Ensure the class is applied when `CardExpanded` dialog is visible

### Bug 3: Hub Side Panels Missing (LOW)
**Symptom:** `.hub-side-left` and `.hub-side-right` are null in the DOM. The hub background image stretches to 1920×1080 instead of being contained in a center column with decorative side panels.
**Fix:** Check `HubScreen.svelte` landscape branch — the side panel divs may have been removed or restructured. Restore them per the AR-75 spec.

### Bug 4: Hub HUD Overlay Not Rendering (LOW)
**Symptom:** `.camp-hud-overlay` not found. The streak counter and dust display may not be visible in landscape.
**Fix:** Check `CampHudOverlay.svelte` — is it rendered in the landscape hub template? If not, add it.

### Bug 5: Cards Tight at Bottom Edge (LOW)
**Symptom:** Cards at y=823+h=249=1072, only 8px from viewport bottom (1080). At slightly different zoom levels this could clip.
**Fix:** Reduce card height slightly in landscape, or add `overflow: visible` to prevent clipping. Or move cards up 10-15px.

## Acceptance Criteria
- [ ] AP orb and draw pile don't overlap
- [ ] Card hand dims to 0.7 opacity during quiz
- [ ] Hub side panels render (dark decorative panels flanking campsite)
- [ ] Hub HUD (streak, dust) visible in landscape
- [ ] Cards don't clip at bottom at any standard resolution
- [ ] Portrait mode UNCHANGED
- [ ] Verified at 1920×1080 AND 1280×800 (Steam Deck)
