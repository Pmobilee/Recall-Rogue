# AR-94: Combat Landscape Polish

## Issues Found by Visual Inspection

### Bug 1: Relic Tray Too Wide (1873px)
The relic tray in landscape spans almost the full viewport width. Should be a compact column of 5 small slots in the top-left corner (~40px wide).

**Fix:** `RelicTray.svelte` landscape CSS — constrain width, use vertical column layout.

### Bug 2: Card Hand Not Dimmed During Quiz
Per spec, card hand should dim to opacity 0.7 when quiz is active. Currently stays at 1.0.

**Fix:** `CardHand.svelte` — the `quizVisible` prop + `.card-hand-quiz-dimmed` class exists but isn't triggering. Check the prop binding from `CardCombatOverlay.svelte`.

### Bug 3: Selected Card Doesn't Rise in Landscape
In portrait, selected card rises 80px with info overlay. In landscape, it stays in place — only the CHARGE button appears next to it.

**Fix:** `CardHand.svelte` landscape branch — add a `transform: translateY(-30px)` and `z-index` boost for the active card.

### Bug 4: Quiz Answer Grid Layout
3-answer questions show 2 on top, 1 on bottom-left (empty bottom-right). For 4 answers, it would be a proper 2×2 grid. For 5 answers (tier 2b), need 3+2 layout. Current implementation works but could be improved — the single bottom answer should center.

**Fix:** Add CSS for odd-count answers: last answer centers when alone in a row.

## Acceptance Criteria
- [x] Relic tray compact vertical column (~40px wide) in top-left
- [x] Card hand dims to 0.7 during quiz
- [x] Selected card rises in landscape
- [x] Quiz answer grid handles 3/4/5 answers gracefully
