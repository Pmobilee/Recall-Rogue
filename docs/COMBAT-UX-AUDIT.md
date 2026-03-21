# Combat Encounter UX Audit — Recall Rogue

Audited: 2026-03-21
Analysts: Layout & Information Hierarchy, Card Interaction & Quiz Flow, Feedback & Mobile Ergonomics

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 5     |
| High     | 22    |
| Medium   | 21    |
| Low      | 13    |
| **Total**| **61**|

---

## Critical

### C-1 — Enemy HP Not in DOM

**Category:** Accessibility / Information Architecture

Enemy HP is rendered only on the Phaser canvas with no corresponding DOM element. Screen readers cannot access it, and players relying on fast numeric scanning have no reliable reference. This also blocks any future accessibility tooling.

**Fix:** Mirror HP and max-HP values into a visually hidden `aria-live` DOM element synchronized with the canvas. Optionally surface a numeric readout in the HUD chrome for all players.

---

### C-2 — Card Hand Tap Targets Below Minimum at 10 Cards

**Category:** Touch Ergonomics / Card Layout

With 10 cards in hand the fan overlap reduces individual card tap targets to approximately 20–30px — less than half the 44px minimum recommended for touch. Cards at the fan edges are especially difficult to tap accurately on phones.

**Fix:** Cap visible fan width so each card maintains a minimum 44px tap strip. Cards beyond the visible cap should be accessible via scroll or a dedicated overflow indicator. Alternatively, reduce maximum hand display to 7 cards with a "+N" badge for excess.

---

### C-3 — Color-Blind Unsafe Red/Green Pair (Intent + HP)

**Category:** Accessibility / Color

Intent icons use red (#ef4444) for attack and green (#22c55e) for heal — the exact pair that deuteranopes (approximately 8% of males) cannot distinguish. The same pair is reused for HP fill states, compounding the problem.

**Fix:** Add a secondary differentiator to intent icons: a shape or symbol (sword silhouette for attack, cross or arrow for heal) so color is never the sole signal. Replace the HP fill gradient with a blue-to-yellow ramp or add a text label to critical states.

---

### C-4 — Wrong Answer Read Window Too Short

**Category:** Quiz Flow / Feedback Timing

After a wrong answer the correct answer auto-dismisses after 1600ms total, with only approximately 800ms to read it before the dismiss animation begins. Players who read slowly or who are mid-thought cannot absorb the correction, undermining the spaced-repetition learning loop.

**Fix:** Replace auto-dismiss with an explicit "Got it" confirmation button. Auto-dismiss should be a fallback at no less than 4000ms. The 800ms window is far below any research baseline for reading short-form feedback.

---

### C-5 — Near-Death Desaturation Applies Only to Svelte Layer

**Category:** Visual Feedback / Phaser Integration

The `saturate(0.7)` CSS filter applied at low HP affects only the Svelte UI chrome. The Phaser canvas (enemy sprite, effects, background) remains fully saturated, breaking the intended low-HP tension signal.

**Fix:** Apply the near-death visual state to the Phaser scene via a PostFX pipeline or a tinted overlay Game Object, so both layers respond consistently. The Svelte and Phaser layers must be coordinated through a shared state event.

---

## High

### Information Architecture & Layout

#### H-1 — Enemy Intent in Top-Left: Wrong Position for Natural Gaze Path

**Category:** Information Architecture / Layout

All three analysts flagged intent placement at top-left as off the natural gaze path. Players scan top-center (enemy) then bottom (hand); top-left receives attention only peripherally. The bubble also renders with button affordance, leading players to tap it expecting an action.

**Fix:** Move intent bubble to directly below or beside the enemy sprite at center-top. Remove interactive affordance styling; the bubble should be informational only, tappable only to expand a tooltip, not to trigger any action.

---

#### H-2 — AP Orb and HP Bar Spatially Separated

**Category:** Information Architecture / Layout

The AP orb sits at approximately 35vh while the HP bar is at the bottom of the UI, forcing split attention between two critical combat resources. On short phones this gap is especially pronounced.

**Fix:** Co-locate AP and HP into a single player status strip. A horizontal bar showing HP with an inline AP counter is a standard pattern that keeps both resources in one glance zone.

---

#### H-3 — 58/42 Canvas-to-UI Split Clips Bottom Zone on Short Phones

**Category:** Layout / Responsive Design

On phones under 700px viewport height, the fixed 58% canvas / 42% UI split leaves the bottom zone with approximately 280px — insufficient to display the card hand, AP, and controls without overlap or cropping.

**Fix:** Make the split dynamic based on viewport height. Below a breakpoint (e.g., 650px), shift toward 50/50, or allow the canvas to compress vertically with letterboxing. Test on 375x667 (iPhone SE) as the minimum supported size.

---

#### H-4 — End Turn, AP Orb, and Combo Counter All Cramped Bottom-Left

**Category:** Layout / Touch Ergonomics

End Turn, the AP orb, and the combo counter share the bottom-left corner — the weakest thumb zone for right-handed users on phones. Accidental taps and visual collision are both elevated by this grouping.

**Fix:** Move End Turn to bottom-right (dominant thumb zone). Distribute AP and combo counter to non-overlapping positions with at least 8px clearance between elements.

---

#### H-5 — AP Orb Lacks Visible Numeric Readout

**Category:** Information Architecture

The AP orb communicates current AP only through a color gradient with no large centered number. Under pressure players cannot quickly parse remaining AP without interpreting a color ramp.

**Fix:** Display the AP value as a large centered number inside the orb (e.g., "3"). Color gradient may remain as a secondary signal.

---

#### H-6 — No Critical Health Visual Warning

**Category:** Feedback / Visual

There is no pulsing border, vignette, or screen-edge warning when player HP is critically low. The HP bar color change is the only signal, which is passive and easily missed mid-combat.

**Fix:** Add a pulsing red vignette or screen-edge pulse that activates below 25% HP. This should fire in both the Svelte and Phaser layers (see C-5). A near-death audio cue (heartbeat or music shift) would reinforce the signal.

---

#### H-7 — Draw and Discard Pile Positions Reversed from Genre Convention

**Category:** Information Architecture / Convention

Draw pile is shown at right and discard at left, which is opposite to the established Slay the Spire convention that the majority of card roguelite players expect. Both indicators are also stacked at nearly identical left offsets (2% and 8%) with no visual separation.

**Fix:** Swap positions: draw pile to bottom-left, discard pile to bottom-right (or vice versa consistently). Increase horizontal separation between the two indicators to at least 48px edge-to-edge.

---

#### H-8 — 0 Relics Renders as Empty Slots, Looks Broken

**Category:** Visual Feedback / Onboarding

Five empty relic slots are shown to new players who have no relics yet, creating an impression of broken UI rather than an empty-but-valid state.

**Fix:** Hide empty relic slots by default. Show a single placeholder with explanatory text ("Collect relics in rewards rooms") only if the player has never acquired one, then collapse the tray once any relic is obtained and the mechanic is understood.

---

### Quiz Flow & Card Interaction

#### H-9 — No Drag-to-Charge Visual Hint in Portrait Mode

**Category:** Onboarding / Card Interaction

Portrait onboarding only teaches tap-to-select. The drag-to-charge mechanic is never shown, leaving players to discover it accidentally. The charge threshold line is also invisible, so players have no sense of how far to drag.

**Fix:** Add a one-time animated hint on the first card selection showing an upward drag gesture with the charge zone highlighted. Render a visible threshold line (dashed or glowing) during any drag above the card hand.

---

#### H-10 — Absolute Charge Threshold (55% Screen) Unfair Across Device Sizes

**Category:** Card Interaction / Touch Ergonomics

The charge threshold is set at an absolute Y coordinate (55% of screen height) regardless of hand size, finger reach, or device. On large phones this requires extreme extension; on small phones it requires minimal movement. The threshold is also invisible (see H-9).

**Fix:** Replace the absolute threshold with a relative drag distance from the card's starting position (e.g., 120px upward drag = charge, regardless of screen position). Show the threshold as a visual guide during drag.

---

#### H-11 — Portrait Mode Missing CHARGE Button Affordance

**Category:** Card Interaction / UI Completeness

In landscape mode a CHARGE button appears after card selection. In portrait mode, this affordance is absent — the only way to charge is via drag, which is undiscoverable. This creates an asymmetric experience where portrait users are systematically disadvantaged.

**Fix:** Add a CHARGE button in portrait mode equivalent to the landscape version. It should appear in the action bar when a card is selected and the player has sufficient AP.

---

#### H-12 — Middle Drag Zone Silently Triggers Quick Play

**Category:** Card Interaction / Feedback

Dragging a card upward 60px (below the charge threshold) silently fires Quick Play with no visual cue distinguishing it from the charge zone. Dragging into an unaffordable charge zone also silently falls back to Quick Play.

**Fix:** Add a visible two-zone drag guide: a Quick Play zone (lower band, labeled) and a Charge zone (upper band, labeled). If the charge zone is unaffordable, show it as disabled and snap the card back to hand on release rather than firing Quick Play silently.

---

#### H-13 — End Turn Confirmation Fires Too Liberally

**Category:** Game Feel / UI

End Turn fires a confirmation dialog whenever any AP remains, including 1 AP with only 1 affordable card. This creates false friction on routine turns and trains players to dismiss the dialog reflexively, defeating its purpose.

**Fix:** Only prompt confirmation when the player has 2 or more AP remaining AND at least 2 affordable cards in hand. Single-AP or single-card situations should not trigger the dialog.

---

#### H-14 — Feedback Avalanche: Multiple Simultaneous Popups

**Category:** Feedback / Visual Hierarchy

Damage number, mastery popup, wow-factor flash, synergy indicator, tier-up notification, and screen-edge pulse can all fire simultaneously. This exceeds working memory capacity and visually incoherent feedback is worse than no feedback.

**Fix:** Implement a feedback queue or priority system. Tier-up and mastery notifications are highest priority (exclusive, sequential). Damage numbers, synergy, and wow-factor can layer but must use distinct screen zones. Maximum simultaneous feedback elements: 3.

---

#### H-15 — All Status Effect Taps Show Combined Popup Instead of Tapped Effect

**Category:** UI / Information Access

Tapping any status effect icon opens a single popup listing all active effects rather than focusing on the tapped effect. This is disorienting and wastes the affordance of individual icons.

**Fix:** Tapping a status effect icon should scroll or jump the popup to that specific effect, or open a focused single-effect card. Show all effects in a secondary "view all" path.

---

#### H-16 — Echo Card Restriction Undiscoverable Until Failure

**Category:** Card Interaction / Onboarding

The "Charge Only" restriction on Echo cards is only surfaced when a player attempts to Quick Play one and is blocked. No label or visual indicator warns the player in advance.

**Fix:** Display a "Charge Only" label or badge on Echo cards at all times in hand. Show a tooltip on hover/long-press explaining the restriction before the player commits to an action.

---

#### H-17 — Comparison Banner Claims Incorrect Multiplier

**Category:** Content Accuracy / UI

The comparison banner states "3x power" for charged cards, but the actual Charge multiplier is 1.5x. This is a factual inaccuracy that misrepresents a core mechanic to new players.

**Fix:** Update banner copy to reflect the actual 1.5x multiplier. Audit all tutorial copy and onboarding text for similar numerical inaccuracies.

---

#### H-18 — Wrong AP Cost Not Explicitly Communicated

**Category:** Feedback / Learning

When a wrong answer wastes AP, no UI element explicitly states the AP cost was deducted as a penalty. Players may not connect the answer result to the AP change.

**Fix:** Display a "-2 AP wasted" floating indicator timed with the wrong-answer animation. Use the same position and typography as the damage number system for visual consistency.

---

#### H-19 — Disabled Answer Buttons Lack Accessible Labels

**Category:** Accessibility

Answer buttons in an eliminated state lack aria-label attributes explaining why they are disabled. Screen reader users receive no information about the state or the reason for it.

**Fix:** Add `aria-label="Eliminated answer: [answer text]"` or `aria-disabled="true"` with a descriptive aria-description to all eliminated answer buttons.

---

#### H-20 — Card Text Unreadable at Fan Edges (39-Degree Rotation)

**Category:** Card Layout / Readability

The outer cards in a large fan hand rotate up to approximately 19.5 degrees. At this angle card text is not reliably readable, and card art is difficult to identify. The fan is decorative at this size, not functional.

**Fix:** Cap fan rotation at 10 degrees per card for a maximum spread of 30 degrees total for a 7-card hand. For hands above 7 cards, use the overflow/scroll pattern (see C-2) rather than increasing rotation.

---

#### H-21 — Quiz Timer Position Below Answer Buttons

**Category:** Quiz Flow / Visual Hierarchy

The timer bar sits below the answer buttons, placing it at the bottom of the player's attention zone precisely when time pressure is highest. Players miss it when scanning upward through answer options.

**Fix:** Move the timer bar to the top of the quiz panel, directly above the question text. This positions it where the eye enters the quiz zone and makes expiry visible peripherally during answer selection.

---

#### H-22 — Timer Expiry Gives No Feedback

**Category:** Quiz Flow / Feedback

When the quiz timer expires, there is no "Speed Bonus lost!" message or visual consequence. Players have no confirmation that expiry carried any meaning, making the timer feel decorative.

**Fix:** Display a brief "Speed Bonus lost" notification when the timer expires. This text can share the feedback queue (see H-14) at medium priority.

---

## Medium

### Layout & Visual Organization

#### M-1 — Draw and Discard Counts Not in Card Decision Zone

**Category:** Information Architecture

Draw pile and discard pile counts are positioned away from the card hand, requiring a gaze shift during card decisions. Players evaluating whether to play aggressively need deck composition data in the same visual zone as the hand.

**Fix:** Add compact draw/discard counts to the card hand bar or immediately above it. Keep the main pile indicators as secondary references.

---

#### M-2 — Relic Tray Occupies Scarce Horizontal Space on Narrow Phones

**Category:** Layout / Responsive Design

The horizontal relic tray competes with the enemy intent bubble at the top of the screen and consumes horizontal space that is at a premium on phones under 390px wide.

**Fix:** On narrow viewports, collapse the relic tray to a single expandable icon showing active relic count. Expand on tap to reveal the full tray as an overlay or bottom sheet.

---

#### M-3 — Multi-Hit Intent "6x2" Is Ambiguous

**Category:** Information Architecture / Copy

Multi-hit intent displays as "6x2" which players may read as "6 damage 2 times" or "2 damage 6 times" — both interpretations exist in games, and neither is obvious. The total damage is not surfaced.

**Fix:** Display as "6x2 (12 total)" or restructure to "2 hits, 6 each." Either resolves the ambiguity. Add a tooltip on long-press with the full description.

---

#### M-4 — Block Badge Visible at Zero Block

**Category:** Visual Noise

A shield badge showing "0" block appears even when no block is active, adding visual noise to every combat turn where block has not been played.

**Fix:** Hide the block badge entirely when block is 0. Show it only when block is greater than 0.

---

#### M-5 — AP Orb May Overlap Selected Card in Rising Animation

**Category:** Layout / Animation

When a card rises into the selected state, the AP orb in the bottom-left can be obscured by the card animation. This is especially pronounced on small screens.

**Fix:** During the card rise animation, fade or slide the AP orb to a safe position, or ensure the card rise path does not intersect the orb's position.

---

#### M-6 — Status Effect Font Sizes Below Readable Minimum

**Category:** Accessibility / Typography

Status effect stack count (10px) and turns-remaining indicator (9px) are both below the minimum readable size on mobile (typically 11–12px minimum, 14px recommended).

**Fix:** Increase stack count to 13px and turns-remaining to 12px minimum. Consider an icon-badge pattern where the count overlays the icon at 14px.

---

#### M-7 — Damage Numbers Stack at Identical Position

**Category:** Visual Feedback

Multiple damage numbers from multi-hit or simultaneous effects appear at the same screen coordinates, making individual hit values unreadable.

**Fix:** Apply a small random jitter (8–16px x and y) to each damage number spawn position. Stagger spawn timing by 80ms per hit for multi-hit sequences.

---

#### M-8 — Correct-Answer Lock Window Too Long for Quick Play

**Category:** Quiz Flow / Game Feel

The correct-answer confirmation animation locks the UI for 1000–1600ms. For Quick Play (designed for fast throughput), this duration creates a noticeable rhythm break.

**Fix:** For Quick Play resolutions, reduce the correct-answer animation to 600ms. Reserve the 1000–1600ms window for Charge Play where the longer pause feels appropriate given higher stakes.

---

#### M-9 — pileTooltip Function Built but Never Attached

**Category:** Feature Completeness

The `pileTooltip()` function is implemented but never attached to any interactive element. Deck pile information is therefore inaccessible in-game despite the infrastructure existing.

**Fix:** Attach `pileTooltip()` to long-press or tap events on both draw and discard pile indicators. Ensure the tooltip includes full pile composition when available.

---

#### M-10 — Landscape Quiz Panel Does Not Guarantee Boss Sprite Clear

**Category:** Layout / Responsive Design

In landscape mode, large boss sprites may overlap the quiz answer zone when the quiz panel slides in. Players are distracted by visible combat UI behind the quiz.

**Fix:** When the quiz panel is active in landscape mode, check boss sprite height and apply an offset or clip mask to ensure the quiz zone is visually isolated. Alternatively, dim or blur the canvas behind the quiz panel.

---

#### M-11 — Landscape Safe-Area Padding Missing

**Category:** Layout / Mobile Compatibility

The landscape stats bar and intent bubble do not account for `safe-area-inset-left` and `safe-area-inset-right` on notched devices (iPhone X series, Android with punch-hole cameras). UI elements may be hidden behind hardware notches.

**Fix:** Apply `padding-left: env(safe-area-inset-left)` and equivalent right padding to the landscape stat bar. Apply `left: calc(2% + env(safe-area-inset-left))` to the intent bubble in landscape.

---

#### M-12 — Chain Color Lacks Contrast Audit

**Category:** Accessibility / Visual Design

Chain colors are domain-determined with no documented contrast audit against the card background. Low-contrast chains may be unreadable for players with impaired vision or in bright ambient light.

**Fix:** Audit all chain colors against their backgrounds using WCAG AA (4.5:1 for small text, 3:1 for large/graphical elements). Adjust any failing pairs.

---

#### M-13 — Multiple Tutorial Overlays Can Appear Simultaneously

**Category:** Onboarding / UI

The AP tutorial, charge tutorial, and comparison banner can all appear at the same time, creating overlapping instructional layers that compete for attention and obscure game state.

**Fix:** Gate tutorial overlays through a sequential display queue. Only one tutorial overlay should be visible at a time. Dismiss the current overlay before triggering the next.

---

#### M-14 — Weakness and Immunity Status Icons Are Unintuitive

**Category:** Information Architecture / Visual Design

The emoji-derived Weakness and Immunity icons are visually inconsistent with the rest of the UI and may not be immediately recognizable as game-mechanic indicators.

**Fix:** Replace with custom pixel-art status icons consistent with the game's visual language. Ensure each icon has a distinct silhouette readable at small sizes.

---

#### M-15 — Landscape Card Hand Ignores Safe-Bottom Inset

**Category:** Layout / Mobile Compatibility

The landscape card hand is positioned at `bottom: 27vh` without accounting for `safe-area-inset-bottom`, clipping cards on devices with home bar indicators (iPhone X+ in landscape).

**Fix:** Apply `bottom: max(27vh, calc(1rem + env(safe-area-inset-bottom)))` to the landscape card hand container.

---

#### M-16 — No Total Deck Composition Stat

**Category:** Information Architecture

There is no single display showing total cards in deck (hand + draw + discard). Players cannot quickly assess deck efficiency or plan multi-turn sequences without mental arithmetic.

**Fix:** Add a total deck count (e.g., "Deck: 12") alongside the draw/discard counts. This can be in the pile tooltip (see M-9) or in the draw pile indicator.

---

#### M-17 — Reshuffle Creates Visual Dead Zone Without Explanation

**Category:** Feedback / Visual

When the draw pile is exhausted and reshuffled, the hand momentarily appears empty with no visual cue explaining the pause. Players may think the game has stalled.

**Fix:** Display a brief animated "Reshuffling..." indicator over the draw pile position when a reshuffle occurs. Duration should match the reshuffle animation duration.

---

#### M-18 — Speed Bonus Threshold Not Visible on Timer Bar

**Category:** Quiz Flow / Feedback

The timer bar gives no visual indication of where the speed bonus cutoff is. Players cannot calibrate their answering speed relative to the bonus threshold.

**Fix:** Add a marker or color-band on the timer bar indicating the speed bonus threshold time. When the timer crosses this marker, the bonus-zone color should visually change.

---

#### M-19 — No Feedback When Tapping Unaffordable Unselected Card

**Category:** Card Interaction / Feedback

Tapping a card the player cannot afford produces no response, leaving the player uncertain whether the tap registered or whether the card is broken.

**Fix:** Display a brief shake animation and a "Not enough AP" tooltip on tap of an unaffordable card. Duration should be 300–400ms, non-blocking.

---

#### M-20 — HP Critical Pulse Only on Bar Fill, Not Numeric Text

**Category:** Visual Feedback

The critical HP pulse animation applies only to the HP fill bar, not the HP numeric text. The number reads as calm even when the bar is pulsing urgency.

**Fix:** Apply the pulse animation (or a color transition to red) to the HP numeric text in sync with the bar pulse.

---

#### M-21 — Keyboard Shortcuts Only in Landscape, Portrait Users Excluded

**Category:** Accessibility / Feature Parity

Keyboard shortcut overlays and the "?" shortcut button appear only in landscape mode. Players using physical keyboards with phones in portrait orientation cannot access these shortcuts.

**Fix:** Enable keyboard shortcuts in all orientations. Remove or hide the "?" button on pure touch devices (no physical keyboard detected) to reclaim the screen space while keeping the functionality available when relevant.

---

## Low

### Visual Polish

#### L-1 — No Turn Number Counter

**Category:** Information Architecture

There is no counter showing the current turn number within a combat encounter. Players cannot track how many turns a fight has lasted or benchmark encounter length.

**Fix:** Add a small turn counter to the HUD (e.g., "Turn 4"). It need not be prominent — a quiet label near the AP display is sufficient.

---

#### L-2 — No Animation When Enemy Intent Updates

**Category:** Visual Feedback

When an enemy changes its intent (e.g., after a status effect resolves), the intent bubble updates without transition. The change can be missed.

**Fix:** Add a brief flash or slide-in animation when the intent value changes. 200–300ms is sufficient to draw the eye without adding delay.

---

#### L-3 — No Player Class Identifier in Status Strip

**Category:** Information Architecture

The player status strip does not show the player's class or archetype. In runs with multiple class options, players may lose track of their character identity mid-run.

**Fix:** Add the player class icon or name (abbreviated) to the status strip. This can be low-prominence — a small icon is sufficient.

---

#### L-4 — Discard Count at 0 Visually Identical to Non-Zero

**Category:** Visual Feedback

The discard pile indicator looks the same whether it contains 0 or 5 cards. Players glancing at the pile area get no quick signal of discard state.

**Fix:** Display the discard indicator in a visually muted state (reduced opacity or greyscale) when the pile is empty. Show it fully saturated and bold when cards are present.

---

#### L-5 — Fizzle Cleanup Duration Has No Exported Constant

**Category:** Code Quality

The 400ms fizzle cleanup duration is hardcoded without an exported constant, making it difficult to synchronize with animation systems that need to reference the same value.

**Fix:** Export a `FIZZLE_DURATION_MS = 400` constant from the animation configuration file. Reference it in both the fizzle trigger and any dependent cleanup logic.

---

#### L-6 — Intent Bubble Tap Produces Insufficient Brightness Change

**Category:** Visual Feedback

Tapping the intent bubble produces only an 8% brightness change, which is below the threshold of tactile confirmation. Players cannot tell whether their tap registered.

**Fix:** Increase tap feedback to at least 20% brightness change, or add a brief scale pulse (95%–100% over 150ms). Match the feedback style used by other interactive elements.

---

#### L-7 — Stack Icon Cannot Distinguish 1 Card from 3 Visually

**Category:** Visual Design

The stack icon used for pile indicators does not visually differentiate between a pile of 1 and a pile of 3. The numeric count is the only differentiator, and it is small.

**Fix:** Consider a tiered stack icon that shows a different silhouette for 0, 1–3, 4–7, and 8+ cards. This gives players a faster glance-read of rough deck state.

---

#### L-8 — Quick Play and Charge Play Animations Visually Identical

**Category:** Visual Feedback / Game Feel

Quick Play and Charge Play card-play animations look the same. Players receive no visual reinforcement that they chose the more powerful option.

**Fix:** Give Charge Play a distinct animation: a brief glow, particle burst, or color flash tied to the card's domain color. Quick Play remains the baseline "vanilla" animation.

---

#### L-9 — End Turn Button Pulses While Disabled During Animation

**Category:** Visual Feedback

The End Turn button pulses (its "attention" state) while it is in a disabled state during card animations. This creates a contradictory signal — the button is visually demanding attention but is not actionable.

**Fix:** Suppress the End Turn pulse animation while the button is in a disabled state. Resume the pulse only when the button becomes interactive again.

---

#### L-10 — No Haptic Feedback Confirmation on Quiz Answer

**Category:** Accessibility / Mobile Feel

It is unconfirmed whether haptic feedback fires on quiz answer selection. If absent, the answer interaction lacks physical confirmation, which reduces the tactile certainty of the quiz experience on mobile.

**Fix:** Add haptic feedback (via the Capacitor Haptics API) on quiz answer tap. Use a light impact for any selection, a medium impact for correct answers, and a heavy impact for wrong answers.

---

#### L-11 — Speed Bonus and Quiz Result Overlays Not Screen-Reader Announced

**Category:** Accessibility

Speed bonus and quiz result overlays are rendered visually but not announced via `aria-live` regions. Screen reader users receive no notification of quiz outcome.

**Fix:** Add `aria-live="assertive"` to the quiz result overlay so outcomes are announced immediately. Use `aria-live="polite"` for the speed bonus notification.

---

#### L-12 — No Feedback for Tapping "?" Button on Mobile

**Category:** UX / Mobile

The "?" keyboard shortcut reference button is irrelevant on touch-only devices (no physical keyboard) and wastes screen space. Players who tap it expecting help receive keyboard bindings they cannot use.

**Fix:** Detect physical keyboard availability. On touch-only devices, repurpose the button as a general help/reference trigger or remove it entirely.

---

#### L-13 — No Visual Differentiation Between No-AP and Has-AP End Turn State

**Category:** Visual Feedback

The End Turn button has the same visual weight whether the player has remaining AP or not. Players ending turns with AP to spare receive no passive nudge to reconsider.

**Fix:** When the player has unspent AP above 1, subtly mute the End Turn button (reduced opacity or color shift) to signal "you still have resources." This is a soft nudge, not a block — the button remains fully tappable.

---

## Priority Action Plan

The following 10 fixes are recommended in order of implementation priority, balancing impact, accessibility requirements, and implementation cost.

| # | ID | Fix | Rationale |
|---|-----|-----|-----------|
| 1 | C-3 | Color-blind safe intent and HP colors | Accessibility failure affecting approximately 8% of male players; also fixes one of two independent critical color issues |
| 2 | C-2 | Card hand tap target minimum at 10 cards | Core interaction is broken at max hand size; affects every combat encounter |
| 3 | C-4 | Replace auto-dismiss with "Got it" button on wrong answer | Directly damages the learning loop, which is the core product mechanic |
| 4 | H-9 + H-10 | Visible drag-to-charge hint and relative threshold | Two analysts flagged this as the most common new-player failure point in portrait mode |
| 5 | H-14 | Feedback queue with priority system | Simultaneous popups cause disorientation; uncoordinated feedback is worse than none |
| 6 | C-5 | Coordinate near-death visual across Phaser and Svelte layers | Current implementation is visually incoherent and breaks a key tension signal |
| 7 | H-1 + H-7 | Intent bubble repositioned below enemy, draw/discard swapped to convention | Both address fundamental spatial layout issues trained by prior genre familiarity |
| 8 | H-17 | Fix comparison banner multiplier (1.5x not 3x) | Factual inaccuracy in tutorial copy undermines player trust in the UI |
| 9 | C-1 | Mirror enemy HP to DOM for screen readers | Accessibility baseline; low implementation cost relative to impact |
| 10 | M-11 + M-15 | Safe-area inset padding for notched devices in landscape | Invisible to most testers but affects a large portion of iOS users in landscape |
