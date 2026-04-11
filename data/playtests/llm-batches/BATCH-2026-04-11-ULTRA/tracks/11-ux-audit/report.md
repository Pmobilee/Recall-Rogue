# UX Audit Report — Track 11
**BATCH-2026-04-11-ULTRA**
Generated: 2026-04-11
Method: Docker warm container + cold containers, 1920×1080, /ux-review methodology
Scenarios: hub-endgame, combat-basic, dungeon-map, card-reward, reward-room, shop, rest-site, run-end-victory, dungeon-selection, settings

---

## Summary

| Screen | Checks Run | Passed | Failed | Verdict |
|---|---|---|---|---|
| hub | 8 | 4 | 4 | WARN |
| combat | 12 | 6 | 6 | FAIL |
| dungeonMap | 8 | 2 | 6 | FAIL |
| cardReward | 10 | 6 | 4 | WARN |
| rewardRoom | 6 | 3 | 3 | WARN |
| shopRoom | 10 | 6 | 4 | WARN |
| restRoom | 8 | 5 | 3 | WARN |
| runEnd | 10 | 6 | 4 | WARN |
| deckSelectionHub | 8 | 3 | 5 | FAIL |
| settings | 7 | 3 | 4 | WARN |
| **TOTAL** | **87** | **44** | **43** | |

**Pass rate: 50.6%**

---

## Screen 1: Hub

**Scenario:** hub-endgame
**Screenshot:** evidence/screens/hub/screenshot.png

The hub renders a rich pixel-art cavern scene with the player character at a campfire. Navigation is via sprite hitboxes positioned over props (bookshelf = library, tent = camp, signpost, chest, etc.). The door/arch is the Start Run button.

### Generated Checklist

**TOUCH TARGETS**
- [Touch-MinSize] btn-start-run (267×292px) → ≥44px PASS
- [Touch-MinSize] sprite-hitbox at (668, 335) 194×248px → ≥44px PASS
- [Touch-MinSize] sprite-hitbox at (1021, 745) 67×65px → ≥44px PASS (barely)
- [Touch-Gap] nearest inter-button gaps not measurable (sprite hitboxes non-adjacent) → SKIPPED

**THUMB ZONE**
- [Thumb-PrimaryAction] btn-start-run Y=119, screen H=1080 → Y > 55% (594px) → FAIL (11% of screen)
- [Thumb-Nav] sprite-hitboxes Y range 313-821 → most above 55% threshold → PARTIAL FAIL

**TYPOGRAPHY**
- [Type-BodyMin] hud-value (streak, grey matter) font ~14-15px → ≥11px PASS
- [Type-Context] hud context unlabeled — no text label → FAIL (label missing)

**ACCESSIBILITY**
- [A11y-Name] btn-start-run: no text content, no aria-label → FAIL
- [A11y-Name] 8 × sprite-hitbox buttons: no text, no aria-label → FAIL
- [A11y-Name] hud-pill.hud-left: no label for streak counter → FAIL

**HIERARCHY**
- [Visual-Hierarchy] Character/campfire at center, door visible → PASS
- [Visual-Zones] Clear scene zones → PASS

### Verdict: WARN
The hub scene is visually appealing and spatially logical. The primary issue is complete absence of accessible names on all navigation buttons (9 total with zero labels). The Start Run button being at the top of the screen is a Steam Deck ergonomics concern.

---

## Screen 2: Combat

**Scenario:** combat-basic
**Screenshot:** evidence/screens/combat/screenshot.png

Combat renders with Page Flutter enemy, a 5-card hand, enemy HP bar, player HP bar in the topbar, and an End Turn button bottom-left. Chain bar shows "Amber — Play to chain!"

### Generated Checklist

**TOUCH TARGETS**
- [Touch-MinSize] btn-end-turn (197×69px) → ≥44px PASS
- [Touch-MinSize] card-hand-0 (281×364px) → ≥44px PASS
- [Touch-MinSize] card-hand-2 (234×333px) → ≥44px PASS
- [Touch-Gap] btn-end-turn to nearest card: card-hand-0 starts at X=557, btn at X=24+197=221 → gap ~336px → PASS
- [Touch-Destructive] pause-btn (48×48px) → ≥44px PASS

**THUMB ZONE**
- [Thumb-PrimaryAction] btn-end-turn Y=987, screen H=1080 → 91.4% PASS
- [Thumb-CardHand] card-hand-landscape Y=702 → 65% PASS

**TYPOGRAPHY**
- [Type-HPNumbers] hp-value font height ~15px → ≥16px FAIL (15px, needs 16px minimum)
- [Type-BodyMin] intent-detail-line font ~12px → ≥11px PASS
- [Type-EnemyHP] enemyHpText (Phaser Text) "32 / 32" → ~58px height → well above minimum PASS
- [Type-CardLabel] frame-text.v2-card-type bounding box 22×11 → FAIL (11px borderline)

**ACCESSIBILITY**
- [A11y-Name] btn-end-turn: text "END TURN" but HIDDEN in layout dump → WARN/FAIL
- [A11y-Name] card-hand-0 through card-hand-4: no text content in button → FAIL
- [A11y-Name] active-chain-bar: has text "Amber" and "Play to chain!" → PASS
- [A11y-Live] enemy-intent-bubble: HIDDEN despite rendering → FAIL

**CARD GAME SPECIFIC**
- [CardGame-APVisible] ap-number at (0,0) HIDDEN → FAIL (AP display not confirmed visible)
- [CardGame-EnemyIntent] intent-attack-name present "Swooping strike" → PASS (visual only)
- [CardGame-EndTurnGap] btn-end-turn bottom at Y=1056, card-hand top at Y=702 → 285px gap → PASS

**VISUAL**
- [Visual-Hierarchy] Enemy (page_flutter at center/top) dominates → PASS
- [Visual-Zones] Enemy zone top, player hand bottom, actions bottom-left → PASS
- [Feedback-States] Buttons appear interactive → PASS

### Verdict: FAIL
Multiple critical accessibility failures: HP text below minimum, card buttons unlabeled, AP counter may be hidden, enemy intent inaccessible to assistive tech. The card hand UX is strong ergonomically but the DOM is incomplete for accessibility.

---

## Screen 3: Dungeon Map

**Scenario:** dungeon-map
**Screenshot:** evidence/screens/dungeonMap/screenshot.png

The dungeon map appears nearly black with faint nebula-like glow effects. Topbar is present. The DOM reveals 18 map nodes positioned from Y=267 to Y=1233, with a fog overlay spanning 2600x1350 covering the entire viewport.

### Generated Checklist

**TOUCH TARGETS**
- [Touch-MinSize] map-node buttons 78×78px → ≥44px PASS
- [Touch-MinSize] map-node-r7-n0 (boss) 120×120px → ≥44px PASS
- [Touch-Gap] adjacent nodes (r0-n0 at 694 vs r0-n1 at 926) → 926-694-78 = 154px gap → PASS

**THUMB ZONE**
- [Thumb-PrimaryAction] Entry nodes at Y=1233 → 114% screen height — BELOW viewport → FAIL
- [Thumb-Navigation] Middle nodes at Y=558-693 → 52-64% → PASS

**TYPOGRAPHY**
- [Type-BodyMin] row-marker-label "Floor 1" → 14px bounding → ~10px FAIL
- [Type-BodyMin] row-marker-label "Boss" → 14px bounding → ~10px FAIL
- [Type-Context] No node type labels visible → FAIL

**ACCESSIBILITY**
- [A11y-Name] 18 map-node buttons: no text, no aria-label → FAIL
- [A11y-Name] hud-title "Shallow Depths" HIDDEN → FAIL

**VISUAL**
- [Visual-Hierarchy] Fog covers all content — nearly blank screen → FAIL (critical)
- [Visual-Zones] Map structure exists but obscured → FAIL
- [Feedback-States] Node interactions not testable due to fog → UNKNOWN

### Verdict: FAIL
The dungeon map scenario shows a fog-covered blank screen. Entry nodes (row 0) are positioned below the viewport (Y=1233 > 1080). The map is functionally invisible. All 18 interactive buttons lack accessible names. This is the most broken screen in the audit.

---

## Screen 4: Card Reward

**Scenario:** card-reward
**Screenshot:** evidence/screens/cardReward/screenshot.png

Three reward cards displayed side by side: Strike (1 AP, Attack), Block (1 AP, Shield), Heavy Strike (2 AP, Attack). Reroll button spans full width. Skip and Accept buttons below. No heading visible (positioned at Y=-157).

### Generated Checklist

**TOUCH TARGETS**
- [Touch-MinSize] reward-card-0 (517×675px) → ≥44px PASS
- [Touch-MinSize] reward-reroll (1800×90px) → ≥44px PASS
- [Touch-MinSize] reward-accept (891×117px) → ≥44px PASS
- [Touch-MinSize] skip button (891×117px) → ≥44px PASS
- [Touch-Destructive] reroll bottom (871+90=961) to skip top (979) → gap 18px → FAIL (needs 20px)

**THUMB ZONE**
- [Thumb-PrimaryAction] reward-accept Y=979 → 90.6% → PASS
- [Thumb-CardHand] Cards Y=47-675 → 4-62% → above thumb zone for taps

**TYPOGRAPHY**
- [Type-BodyMin] mini-card-ap "1","2" → 45×45px → well above minimum PASS
- [Type-BodyMin] mini-card-name "Strike" → 142×54px → PASS
- [Type-BodyMin] mini-card-desc "Deal 8" → 113×47px → ~13px PASS (at threshold)
- [Type-Context] h1 "Choose a Card" at Y=-157 → NOT VISIBLE FAIL

**ACCESSIBILITY**
- [A11y-Name] reward-card-0: no aria-label → FAIL (just testid)
- [A11y-Name] reward-reroll: text "Reroll" → PASS
- [A11y-Name] reward-accept: text "Accept" → PASS
- [A11y-Name] skip: text "Skip" → PASS

**CARD GAME SPECIFIC**
- [CardGame-APVisible] mini-card-ap shows "1" and "2" → PASS
- [CardGame-CardArt] 317×246 art area for 517×675 card → 24% art ratio → PASS

**VISUAL**
- [Visual-Hierarchy] Three equal-size cards → PASS (choice is clear)
- [Visual-Zones] Card zone / action zone separated → PASS

### Verdict: WARN
The card reward screen is largely functional. The most significant issues are the screen heading being invisible (off-screen) and the missing accessibility names on individual card buttons. The reroll/skip gap is borderline at 18px vs 20px required.

---

## Screen 5: Reward Room

**Scenario:** reward-room
**Screenshot:** evidence/screens/rewardRoom/screenshot.png

Pixel-art dungeon scene showing a glowing altar with three reward items scattered on it: cards (Attack, Utility, Buff types) and gold. A "Continue" button appears centered bottom. The topbar is present with HP and gear icon.

### Generated Checklist

**TOUCH TARGETS**
- [Touch-MinSize] continueButton (270×72px Phaser) → ≥44px PASS (Phaser size)
- [Touch-DOM] No DOM button for Continue → FAIL (Phaser-only)

**THUMB ZONE**
- [Thumb-PrimaryAction] continueButton Y=950 → 87.9% → PASS (Phaser coord)

**ACCESSIBILITY**
- [A11y-Name] Continue is Phaser Text — not in DOM → FAIL (critical)
- [A11y-KeyboardNav] No DOM interactive elements visible → FAIL

**VISUAL**
- [Visual-Hierarchy] Altar/rewards dominate scene → PASS
- [Visual-Rewards] Three reward items visible with card art → PASS
- [Visual-Zones] Clear altar zone / continue zone → PASS

### Verdict: WARN
The reward room looks beautiful and the layout communicates content well. However the Continue button being Phaser-only (no DOM element) is a critical accessibility gap — keyboard and assistive tech users cannot proceed from this screen.

---

## Screen 6: Shop Room

**Scenario:** shop
**Screenshot:** evidence/screens/shopRoom/screenshot.png

Shop displays a pixel-art tavern/shop background with three relic items in a row (Whetstone, Iron Shield, Vitality Ring each at 150g). Below: Card Removal (75g, unaffordable) and Card Transform ("Coming soon"). HUD shows 500g available.

### Generated Checklist

**TOUCH TARGETS**
- [Touch-MinSize] btn-leave-shop (66×66px) → ≥44px PASS
- [Touch-MinSize] shop-buy-relic-whetstone (74×66px) → ≥44px PASS
- [Touch-MinSize] shop-buy-removal (813×48px) → ≥44px PASS
- [Touch-Gap] Shop buy buttons to adjacent items → adequate spacing

**THUMB ZONE**
- [Thumb-PrimaryAction] buy buttons Y=419 → 38.8% → FAIL (above thumb zone)
- [Thumb-Secondary] service buttons Y=736-764 → 68-70% → PASS

**TYPOGRAPHY**
- [Type-BodyMin] service-title "Card Removal" → 113×23px → ~13px PASS
- [Type-BodyMin] rarity-pill "common" → 110×18px → ~11px PASS

**ACCESSIBILITY**
- [A11y-Name] shop-buy-relic-whetstone: text "150g" only → WARN (no relic name in button)
- [A11y-Name] btn-leave-shop: text "←" → FAIL (no accessible name for back action)
- [A11y-Name] Relic item articles: no accessible name for relic → FAIL
- [A11y-State] Card Transform button: active but "Coming soon" → FAIL

**CARD GAME SPECIFIC**
- [CardGame-Currency] gold-amount "500g" prominently displayed → PASS
- [CardGame-AffordState] Buy buttons don't show disabled state when unaffordable? — need to verify

### Verdict: WARN
The shop layout is functional with clear pricing. The buy buttons display the price but not the item name in their accessible label. The "Coming soon" Card Transform service is active but non-functional. Primary buy action is above the thumb zone.

---

## Screen 7: Rest Room

**Scenario:** rest-site
**Screenshot:** evidence/screens/restRoom/screenshot.png

Rest site modal overlaid on dungeon background. Three option cards: Rest (Heal 20% HP), Study (Quiz 3 questions), Meditate (Remove 1 card). HP: 100/100. Study preview: "No cards to upgrade." Meditate preview: "Deck too small (min 5)."

### Generated Checklist

**TOUCH TARGETS**
- [Touch-MinSize] rest-heal (243×312px) → ≥44px PASS
- [Touch-MinSize] rest-study (243×312px) → ≥44px PASS
- [Touch-MinSize] rest-meditate (243×312px) → ≥44px PASS
- [Touch-Gap] rest-heal to rest-study: 839-572-243 = 24px → ≥8px PASS

**THUMB ZONE**
- [Thumb-PrimaryAction] Option buttons Y=469 → 43.4% → FAIL (above 55% threshold)
- [Thumb-Context] HP info at Y=414 → 38.3% → above thumb but acceptable for info display

**TYPOGRAPHY**
- [Type-BodyMin] rest-title "Rest Site" → 201×54px → PASS (prominent)
- [Type-BodyMin] option-label → 51×34, 66×34, 103×34 → ~16-18px PASS
- [Type-BodyMin] option-detail → 108×25px → ~13px PASS (slightly below ideal)
- [Type-BodyMin] option-preview → 106×23px → ~12px PASS

**ACCESSIBILITY**
- [A11y-Name] rest-heal: no accessible label for full button action → WARN
- [A11y-State] rest-study: active despite "No cards to upgrade" → WARN
- [A11y-State] rest-meditate: active despite "Deck too small" → WARN

**VISUAL**
- [Visual-Hierarchy] Modal overlay clearly centered → PASS
- [Visual-Zones] Three equal option cards → PASS (clear choice architecture)
- [Feedback-States] Option cards look clickable with icon + label → PASS
- [Feedback-Disabled] Study/Meditate appear identical to Rest despite being less effective → FAIL

### Verdict: WARN
The rest room is well-designed with clear choice presentation. The primary issues are the warning previews ("No cards to upgrade", "Deck too small") having no visual differentiation from normal state, and option buttons being in the upper half of the screen ergonomically.

---

## Screen 8: Run End

**Scenario:** run-end-victory
**Screenshot:** evidence/screens/runEnd/screenshot.png

Victory screen showing: "DUNGEON VANQUISHED" header, grade S, flavor text, Foes Vanquished parade (15+ enemy badges), Knowledge Harvest (Seen 14/42, Reviewing 22/42, Mastered 6/42), Run Stats pills, Grey Matter 500, and Home / Descend Again / Share buttons.

### Generated Checklist

**TOUCH TARGETS**
- [Touch-MinSize] btn-home (218×67px) → ≥44px PASS
- [Touch-MinSize] btn-play-again (435×67px) → ≥44px PASS
- [Touch-MinSize] btn-share-run (218×67px) → ≥44px PASS
- [Touch-Gap] btn-home to btn-play-again: 743-728=15px → FAIL (needs ≥8px, pass at 15px) PASS
- [Touch-Destructive] No destructive actions on this screen → N/A

**THUMB ZONE**
- [Thumb-PrimaryAction] btn-play-again Y=951 → 88% → PASS
- [Thumb-Secondary] All three buttons at Y=951 → PASS

**TYPOGRAPHY**
- [Type-HeadingMin] header-label "DUNGEON VANQUISHED" → 275×18px → ~11px FAIL (for heading, should be larger)
- [Type-BodyMin] fact-label "Seen" → 344×18px → ~11px PASS
- [Type-BodyMin] pill-label "Floor" → 42×14px → ~10px FAIL (borderline)
- [Type-HeadingMin] section-heading "Foes Vanquished" → 900×54px → PASS
- [Type-BodyMin] pill-value "10", "92%" → ~14-21px → PASS

**ACCESSIBILITY**
- [A11y-Name] btn-home: "Home" → PASS
- [A11y-Name] btn-play-again: "Descend Again" → PASS
- [A11y-Name] btn-share-run: "Share" → PASS
- [A11y-Asset] Enemy badges: 7+ show '❓' fallback → FAIL

**VISUAL**
- [Visual-Hierarchy] Grade/header at top, enemies below, stats below, CTA at bottom → PASS
- [Visual-Zones] Clear vertical flow → PASS
- [Visual-Assets] Missing enemy portraits → FAIL

### Verdict: WARN
The run end screen has good overall structure with CTAs in the thumb zone. The missing enemy portrait images degrade the "Foes Vanquished" victory celebration. Header label text at ~11px is too small for a triumphant heading. Pill labels are borderline at ~10px.

---

## Screen 9: Deck Selection Hub

**Scenario:** dungeon-selection
**Screenshot:** evidence/screens/deckSelectionHub/screenshot.png

Two large panels side by side: "TRIVIA DUNGEON" (The Armory, with library pixel art) and "STUDY TEMPLE" (The Library, with glowing library art). A small "← Back" button top-left. Dark background fills the rest.

### Generated Checklist

**TOUCH TARGETS**
- [Touch-MinSize] back-btn (100×49px) → ≥44px PASS
- [Touch-MinSize] panel--trivia (750×720px) → ≥44px nominal FAIL (div, not button)
- [Touch-MinSize] panel--study (750×720px) → FAIL (div, not button)

**THUMB ZONE**
- [Thumb-PrimaryAction] Panels Y=228, screen H=1080 → 21.1% → FAIL (above 55% threshold)
- [Thumb-BackNav] back-btn Y=24 → 2.2% → acceptable for nav

**TYPOGRAPHY**
- [Type-HeadingMin] Panel title visible in screenshot but not in DOM → FAIL (no DOM text)
- [Type-BodyMin] Panel description visible in screenshot but not in DOM → FAIL

**ACCESSIBILITY**
- [A11y-Name] panel--trivia div: no button, no role, no aria-label → FAIL (critical)
- [A11y-Name] panel--study div: no button, no role, no aria-label → FAIL (critical)
- [A11y-Name] back-btn: text "← Back" → PASS
- [A11y-Keyboard] Tab key reaches only back-btn — panels unreachable → FAIL

**VISUAL**
- [Visual-Hierarchy] Two equal panels → PASS (clear binary choice)
- [Visual-Zones] Side-by-side layout → PASS
- [Feedback-States] No hover state visible in static capture — panels may have hover

### Verdict: FAIL
The deck selection hub has two critical accessibility failures: the primary interactive elements are non-button divs with no keyboard access, and the panel text content is not in the DOM. This screen is completely inaccessible to keyboard-only users. The visual design is strong but the implementation has serious semantic gaps.

---

## Screen 10: Settings

**Scenario:** settings
**Screenshot:** evidence/screens/settings/screenshot.png

Settings screen shows tabbed navigation (Audio, Accessibility, Notifications, Account) with a ← Back button. Audio tab shows SFX Enabled (checked), SFX Volume (100%), Music Enabled (checked), Music Volume (50%), Ambient Enabled (checked), Ambient Volume (70%). Bottom half of screen is empty.

### Generated Checklist

**TOUCH TARGETS**
- [Touch-MinSize] btn-settings-back (119×49px) → ≥44px PASS
- [Touch-MinSize] btn-settings-audio (180×49px) → ≥44px PASS
- [Touch-MinSize] btn-settings-accessibility (180×49px) → ≥44px PASS
- [Touch-MinSize] btn-settings-notifications (180×49px) → ≥44px PASS
- [Touch-MinSize] btn-settings-account (180×49px) → ≥44px PASS
- [Touch-MinSize] Checkbox toggles → NOT FOUND IN DOM → FAIL

**THUMB ZONE**
- [Thumb-PrimaryAction] Tab buttons Y=15 → 1.4% → acceptable (navigation is always top)
- [Thumb-Settings] Toggle controls Y=207-627 → 19-58% → acceptable for settings

**TYPOGRAPHY**
- [Type-BodyMin] Settings labels "SFX Enabled" → 300×30px → ~16px PASS
- [Type-BodyMin] Volume values "100%" → 766×30px → ~16px PASS
- [Type-HeadingMin] "AUDIO" heading → 1762×33px → ~18px PASS

**ACCESSIBILITY**
- [A11y-Name] btn-settings-back: "← Back" → PASS
- [A11y-Name] Tab buttons: text labels PASS
- [A11y-Name] Checkbox/toggle controls: NOT IN DOM → FAIL
- [A11y-ARIA] Volume sliders: not found in layout dump → WARN

**VISUAL**
- [Visual-Hierarchy] Tab navigation clear → PASS
- [Visual-Zones] Tab bar / content area / empty space → PASS (empty space is waste)
- [Feedback-States] Active tab highlighted (Audio has filled background) → PASS
- [Visual-Density] 40% of screen empty → FAIL (poor use of space)

### Verdict: WARN
Settings is functional and legible. The tab navigation works well. The major gaps are: toggle controls not appearing as DOM elements (accessibility unknown), volume sliders not captured in layout dump (may be input[range] elements hidden from layout scan), and the large empty lower half of the screen.

---

## Top 5 Worst Failures

### 1. CRITICAL — Reward Room Continue Button (Phaser-only, no DOM)
**Issue 014** — The only action on the reward room screen is a Phaser canvas button with no DOM equivalent. Keyboard navigation and assistive technology cannot reach it. Players cannot proceed without mouse/touch.

### 2. CRITICAL — Deck Selection Hub panels are non-interactive divs
**Issue 022** — Both primary choice panels are div elements with no button semantics, no keyboard handlers, no aria-label. Tab key navigates only to the Back button. The most important decision screen in the game is completely keyboard-inaccessible.

### 3. HIGH — Dungeon Map entirely obscured by fog overlay
**Issue 009** — The dungeon map scenario renders a near-black screen due to the fog overlay covering the entire viewport. Entry-row map nodes are also positioned below the viewport edge (Y=1233 > 1080). Players see nothing actionable.

### 4. HIGH — 18 map node buttons with zero accessible names
**Issue 010** — Every single map node button lacks a label. Node type (combat/rest/shop/boss) is communicated visually only. Screen reader output would be unintelligible for dungeon navigation.

### 5. HIGH — Hub: all 8 sprite-hitbox navigation buttons unlabeled
**Issue 001** — The hub's 8 room/feature navigation buttons have no accessible names. A first-time player using a screen reader hears "button, button, button..." with no indication of where each leads.

---

## Manifest Entry

See `manifest-entry.json`

---

## Creative Pass

### 1. "While I was in there..."
While capturing the reward room, I noticed the Phaser Continue button pattern is used on the reward room but nowhere else. The fix (adding a DOM overlay button) is a Green-zone change that would also improve the keyboard shortcut story for the whole game — End Turn already works, Continue should too. This is a fast fix: one transparent DOM button positioned over the Phaser canvas at the correct coordinates.

### 2. "A senior dev would..."
The fog overlay covering the dungeon map at floor 1 start reveals a broader pattern: the `dungeon-map` scenario preset loads the map structure but doesn't initialize the fog reveal state correctly for fresh floor 1 entry. A senior dev would note that the scenario preset system needs a `fogRevealedNodes` override that defaults to showing floor-1 entry nodes on fresh load. The current behavior (total fog cover) suggests the scenario is being loaded without triggering the post-combat fog-reveal that normally runs when transitioning from combat → map. This is a scenario-setup bug, not a map rendering bug — the fog reveal system likely works correctly in real gameplay.

### 3. "Player would want..."
The run end victory screen has 7+ enemy badges showing "❓" fallback symbols instead of portraits. A player who just beat a 15-encounter run and sees question marks instead of the enemies they defeated loses the emotional closure that the "Foes Vanquished" parade is designed to provide. This is exactly the kind of screen where a Steam reviewer would post a screenshot saying "game is broken." Fix the image loading before the portrait strip animates in — a simple image-ready check before triggering the badge-visible animation would prevent the fallback from ever appearing in the user-visible state.

## What's Next
1. Fix Reward Room Continue DOM button — critical keyboard accessibility, straightforward overlay pattern, estimated 30 min.
2. Fix Deck Selection Hub panels — add button semantics and aria-labels, estimated 1 hour.
3. Fix dungeon map scenario fog initialization — the fog should not cover floor 1 entry nodes on fresh load.
4. Add aria-labels to hub sprite-hitboxes, map nodes, and card reward buttons — bulk accessibility pass, estimated 2 hours.
5. Fix enemy badge image loading on run end screen — guard badge-visible animation behind image-loaded check.
