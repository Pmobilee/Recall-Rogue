---
name: ux-review
description: |
  Professional-grade game UX audit using Playwright screenshots + DOM analysis. Scans the actual DOM to discover elements, generates a screen-specific checklist at runtime, then evaluates each element against stable UX principles. Covers mobile portrait ergonomics, card game patterns, accessibility, visual hierarchy, feedback/juice, and cognitive load. Uses structured evidence-based approach (95% accuracy) not free-form opinion (20% accuracy). PROACTIVELY SUGGEST after any UI change, new screen, or layout modification.
user_invocable: true
model: sonnet
---

# UX Review — Professional Game UX Audit

Systematic UX evaluation of any game screen using Playwright screenshots + DOM analysis. Instead of applying a static checklist blindly, this skill **discovers the actual elements on screen first**, then **generates a screen-specific checklist** by applying stable UX principles to those real elements.

**Architecture principle:** Principles are permanent knowledge. The checklist is generated at runtime from what's actually on screen. This means new elements are automatically covered, removed elements don't produce false checks, and findings always reference real measured evidence — not hypothetical "if this existed" checks.

The principles are drawn from Nielsen, Pinelle (CHI 2008), PLAY (Desurvire & Wiberg 2009), Hodent's cognitive framework, Apple HIG, Material Design 3, WCAG 2.2, and mobile card game best practices (Marvel Snap, Slay the Spire, Balatro, Hearthstone).

## When to Use

- After any UI change, new screen, or layout modification
- Before shipping a new feature that changes player-facing UI
- When the user asks "does this look right?" or "how does this feel?"
- Periodic full-screen sweep (run against all scenario presets)
- **PROACTIVE TRIGGER**: Any conversation about UI, layout, screens, or visual changes

## Quick Commands

| Command | Screens | Description |
|---------|---------|-------------|
| `/ux-review combat` | Combat overlay | Full audit of combat screen |
| `/ux-review shop` | Shop overlay | Shop layout and interaction |
| `/ux-review reward` | Reward room | Card/relic reward selection |
| `/ux-review hub` | Hub screen | Main menu and navigation |
| `/ux-review all` | All presets | Comprehensive sweep (15+ screens) |
| `/ux-review {preset}` | Any preset | Audit a specific `__rrScenario` preset |

---

## Instant State Setup via Spawn (PREFERRED)

Use `__rrScenario.spawn()` to jump directly to any screen state with full control:

```javascript
// Jump to combat with specific conditions
await page.evaluate(() => __rrScenario.spawn({
  screen: 'combat',
  enemy: 'algorithm',
  playerHp: 50,
  hand: ['heavy_strike', 'strike', 'block', 'expose', 'lifetap'],
  relics: ['whetstone', 'iron_shield'],
  turnOverrides: {
    chainMultiplier: 2.0,
    playerState: { statusEffects: [{ type: 'poison', value: 3, turnsRemaining: 2 }] }
  }
}));

// Test a specific element with auto-generated optimal conditions
const recipe = await page.evaluate(() => __rrScenario.recipes('soul_jar'));
await page.evaluate((r) => __rrScenario.spawn(r.config), recipe);

// Adjust mid-review without re-bootstrap
await page.evaluate(() => __rrScenario.patch({
  turn: { apCurrent: 0 },  // Test "no AP left" UX
  run: { currency: 0 }     // Test "broke" shop UX
}));
```

This replaces manual menu navigation. Use `spawn()` for ALL screen setup during UX reviews.

---

## Execution Protocol

### Phase 1: DOM Scan (Programmatic — via browser_evaluate)

Load the target screen using `__rrScenario`, then extract a complete DOM inventory. This is the discovery phase — capture everything needed to generate the checklist.

```javascript
// 1. Collect all interactive elements with extended context
const interactives = [...document.querySelectorAll(
  'button, [role="button"], a, input, select, [data-testid], .clickable, [onclick]'
)].map(el => {
  const rect = el.getBoundingClientRect();
  const styles = getComputedStyle(el);
  const screenH = window.innerHeight;

  // Nearest neighbor distance to any other interactive element
  const allRects = [...document.querySelectorAll(
    'button, [role="button"], a, input, select, [data-testid], .clickable, [onclick]'
  )].filter(e => e !== el).map(e => e.getBoundingClientRect());
  const nearestDist = allRects.reduce((min, r) => {
    const dx = Math.max(0, Math.max(rect.left - r.right, r.left - rect.right));
    const dy = Math.max(0, Math.max(rect.top - r.bottom, r.top - rect.bottom));
    return Math.min(min, Math.sqrt(dx * dx + dy * dy));
  }, Infinity);

  // Destructive action heuristic: text contains words associated with irreversible actions
  const textLower = (el.textContent?.trim() || '').toLowerCase();
  const isDestructive = /retreat|discard|sell|quit|delete|remove|abandon|forfeit/.test(textLower) ||
    /retreat|discard|sell|quit|delete|remove|abandon|forfeit/.test((el.getAttribute('aria-label') || '').toLowerCase());

  return {
    tag: el.tagName,
    testId: el.dataset?.testid || null,
    text: el.textContent?.trim().slice(0, 60),
    ariaLabel: el.getAttribute('aria-label'),
    role: el.getAttribute('role') || el.tagName.toLowerCase(),
    x: Math.round(rect.x), y: Math.round(rect.y),
    width: Math.round(rect.width), height: Math.round(rect.height),
    fontSize: parseFloat(styles.fontSize),
    color: styles.color,
    bgColor: styles.backgroundColor,
    opacity: parseFloat(styles.opacity),
    pointerEvents: styles.pointerEvents,
    zIndex: styles.zIndex,
    disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
    isInThumbZone: rect.top > screenH * 0.55,  // bottom 45% = natural thumb reach
    nearestNeighborDistance: Math.round(nearestDist),
    isDestructive,
  };
});

// 2. Collect all visible text elements
const texts = [...document.querySelectorAll(
  'p, span, h1, h2, h3, h4, h5, h6, label, [class*="text"], [class*="label"], [class*="title"]'
)]
  .filter(el => el.offsetParent !== null && el.textContent?.trim().length > 0)
  .map(el => {
    const rect = el.getBoundingClientRect();
    const styles = getComputedStyle(el);
    return {
      text: el.textContent?.trim().slice(0, 80),
      selector: el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase(),
      fontSize: parseFloat(styles.fontSize),
      fontWeight: styles.fontWeight,
      lineHeight: styles.lineHeight,
      color: styles.color,
      bgColor: styles.backgroundColor,
      x: Math.round(rect.x), y: Math.round(rect.y),
      width: Math.round(rect.width), height: Math.round(rect.height),
    };
  });

// 3. Card elements (game-specific — identified by data-testid pattern or card class)
const cards = [...document.querySelectorAll(
  '[data-testid^="card-"], [class*="card-hand"], [class*="CardHand"], .card'
)].map(el => {
  const rect = el.getBoundingClientRect();
  return {
    testId: el.dataset?.testid || null,
    selector: el.className ? `.${el.className.split(' ')[0]}` : null,
    width: Math.round(rect.width), height: Math.round(rect.height),
    x: Math.round(rect.x), y: Math.round(rect.y),
  };
});

// 4. Screen dimensions and safe areas
const screen = {
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: window.devicePixelRatio,
  safeTop: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-top') || '0'),
  safeBottom: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom') || '0'),
};

return { interactives, texts, cards, screen };
```

### Phase 1.5: Generate Checklist

**This is the key step.** Using the Phase 1 data, generate a screen-specific checklist before evaluating anything. For each discovered element, look up all applicable principle categories (defined in the Principles section below) and produce concrete check items.

The generated checklist format:
```
Generated Checklist for: [screen name]
Discovered: [N] buttons, [N] text elements, [N] cards, [N] other interactives

TOUCH TARGETS
- [Touch-MinSize] btn-end-turn (44×38px) → check: width ≥ 44px FAIL, height ≥ 44px FAIL
- [Touch-MinSize] btn-retreat (56×56px) → check: ≥ 44px PASS
- [Touch-Gap] btn-end-turn ↔ card-hand-4: 6px gap → check: ≥ 8px FAIL
- [Touch-Destructive] btn-retreat (destructive) ↔ btn-end-turn: 6px → check: ≥ 20px FAIL
- [Touch-Blocked] btn-meditate: pointer-events=none → check: not blocked FAIL
- [Touch-Cards] card-hand-0 (82×112px) → check: ≥ 80×110px PASS
- [Touch-Cards] card-hand-1 (66×90px) → check: ≥ 80×110px FAIL

THUMB ZONE
- [Thumb-PrimaryAction] btn-end-turn Y=780, screen H=852 → check: Y > 55% (469px) PASS (91.5%)
- [Thumb-CardHand] .card-hand-container Y=680, H=852 → check: Y > 70% (596px) PASS

TYPOGRAPHY
- [Type-BodyMin] ".card-effect-text" 10px → check: ≥ 11px FAIL
- [Type-HPNumbers] ".hp-display" 18px → check: ≥ 16px PASS

COLOR & CONTRAST
- [Contrast-Normal] ".hp-text" #FF4444 on #1A1A1A → check: ≥ 4.5:1 [compute ratio]
- [Contrast-Large] ".card-cost" 22px #FFD700 on #2A1A00 → check: ≥ 3:1 [compute ratio]

ACCESSIBILITY
- [A11y-Name] btn-end-turn: text="End Turn" → check: accessible name PASS
- [A11y-Name] .icon-button-settings: no text, no aria-label → check: accessible name FAIL

CARD GAME SPECIFIC
- [CardGame-APVisible] .ap-counter present → check: font size, color saturation
- [CardGame-EnemyIntent] .enemy-intent present → check: ≥ 24px, high contrast
- [CardGame-EndTurnGap] btn-end-turn ↔ card-hand Y: 6px → check: ≥ 20px FAIL

SCREENSHOT-ONLY CHECKS (apply holistically after taking screenshot)
- [Visual-Hierarchy] Is the enemy/primary game object the dominant visual element?
- [Visual-Zones] Are there clear spatial zones (enemy zone / player zone / action zone)?
- [Feedback-States] Do buttons visually afford clickability (border, shadow, color)?
- [Cognitive-Streams] Count simultaneous competing data streams → check: ≤ 5
- [Consistency] Are colors semantically consistent (damage=red, heal=green, AP=yellow)?
```

This generated checklist — not a static hardcoded list — is what gets evaluated in Phase 2.

**Why this matters:**
- New UI elements are automatically covered; no skill update needed
- Removed elements don't produce spurious failures
- Checks are screen-specific: shop checks only appear when shop elements exist
- Every finding references a real, measured element — no hypothetical checks

### Phase 1.6: Per-Element Subjective Evaluation Checklist

The Phase 1.5 checklist covers TECHNICAL metrics. This phase adds SUBJECTIVE quality questions for every discovered element. Both phases together form the complete evaluation.

For EVERY button/interactive discovered in Phase 1:
- Does the label clearly communicate what happens when tapped?
- Would a first-time player understand this button's purpose without instruction?
- Is this button positioned where a player would naturally look for it?
- Does the button feel "pressable" (has visual affordance: shadow, border, distinct bg)?
- If this is a destructive action (retreat, sell, discard), is it visually distinct from positive actions?
- If this is the PRIMARY action on screen, is it the most prominent interactive element?

For EVERY text element discovered in Phase 1:
- Is this text useful to the player RIGHT NOW, or is it clutter?
- Could the text be shorter while conveying the same meaning?
- Is the text tone appropriate (game-themed, not developer-speak)?
- If this is a number/stat, does the player know what it means without a label?
- If this is instructional text, would a 12-year-old understand it?

For EVERY card element discovered in Phase 1:
- Can you evaluate this card's strategic value at a glance (without expanding)?
- Are the most important card properties (cost, type, effect) visible at rest size?
- Can you distinguish this card from adjacent cards without reading the full text?
- Does the card art/frame communicate the card type visually?
- Would you want to collect this card? Does it look valuable/interesting?

For THE SCREEN AS A WHOLE (generate these questions dynamically based on screen type):
- What emotion does this screen evoke? Is that the intended emotion?
- What is the most visually dominant element? Is it the most important element?
- If a player glanced at this for 2 seconds, what would they understand?
- Does the information density feel right (not overwhelming, not empty)?
- Does this screen make you want to continue playing? Why or why not?
- What would a player's FIRST tap be? Is that what the designer wants?
- Rate the visual polish 1-10. What loses the most points?
- Name the ONE change that would most improve this screen.
- Does this screen compare favorably to the same screen in Marvel Snap / Slay the Spire / Balatro?
- If this screen has empty states (no relics, no facts learned, etc.), does the empty state guide the player toward filling it?

**CRITICAL: These subjective evaluations are NOT optional.** Every UX review must include subjective findings alongside technical metrics. A screen can pass all technical checks and still be a poor user experience.

### Phase 2: Screenshot

Disable animations, then capture:
```javascript
document.documentElement.setAttribute('data-pw-animations', 'disabled');
```
Take screenshot AND layout dump (ALWAYS use both — they complement each other):
- Screenshot: `browser_evaluate(() => window.__rrScreenshotFile())` — saves to `/tmp/rr-screenshot.jpg`, returns path. Use `Read("/tmp/rr-screenshot.jpg")` to view. Captures both Phaser canvas + DOM overlays. NEVER use raw `__rrScreenshot()` (base64 exceeds limits), `mcp__playwright__browser_take_screenshot` (Phaser RAF causes 30s timeout), `page.screenshot()` (same issue), or `newCDPSession()` (hangs permanently).
- Layout dump: `browser_evaluate(() => window.__rrLayoutDump())` — returns text with exact pixel coordinates of ALL Phaser + DOM elements (use for structured coordinate data to supplement Phase 1 DOM measurements).
Use `browser_snapshot` for supplementary DOM state.

### Phase 3: Evaluate

Work through BOTH the generated technical checklist (Phase 1.5) AND the subjective evaluation (Phase 1.6) systematically:

1. **DOM-measurable checks** (touch targets, typography sizes, contrast ratios): evaluate using Phase 1 measurements. Mark pass/fail with exact values.
2. **Subjective per-element checks**: For every button, text, card, and image discovered, answer the Phase 1.6 subjective questions. Be specific — "End Turn button label is clear" not "buttons look fine."
3. **Screenshot-only checks** (visual hierarchy, feedback affordance, zone clarity, color semantics, cognitive density): evaluate by examining the screenshot holistically against the principles.
4. **Holistic subjective assessment**: Answer all "screen as a whole" questions from Phase 1.6. Include emotional assessment, first-impression analysis, and comparison to reference games.
5. **Phaser canvas checks**: for screens with canvas content, run `window.__rrDebug()` to check sprite positions and canvas-rendered elements DOM analysis can't reach.

**CRITICAL: Only produce findings for elements that actually exist. Do not invent checks for elements not discovered in Phase 1. Do not skip discovered elements. Every element gets both technical AND subjective evaluation.**

### Phase 4: Phaser Canvas Check

For screens with Phaser canvas content (combat, reward room):
```javascript
window.__rrDebug()
```
This surfaces sprite positions, scene state, and canvas-rendered UI that DOM analysis misses. Cross-reference with screenshot to identify any canvas elements that should be evaluated (e.g., enemy health bars rendered in Phaser, not in DOM).

---

## Runtime Checklist Generation Protocol

For each discovered element, apply this classification logic:

```
For each interactive element:
  1. Classify type: button | card | icon-button | input | link | destructive-button
  2. Apply ALL applicable principle categories for that type:
     - ALL interactives → Touch (min size, gap, blocked, safe-areas)
     - ALL interactives → Thumb Zone (Y position vs screen height)
     - ALL interactives → Accessibility (accessible name, pointer-events)
     - buttons → Touch (affordance, disabled state)
     - cards → Touch (card min size 80×110), Card Game (AP visible, type coding)
     - destructive-buttons → Touch-Destructive (20px clearance from frequent actions)
  3. For each applicable principle, create one check item:
     - element identifier (data-testid > aria-label > selector > tag+text)
     - measured value from Phase 1 data
     - threshold from the principle definition
     - pass/fail determination

For each text element:
  1. Classify: body | heading | number-readout | card-effect | tutorial | floating-number
  2. Apply Typography principles for that text role
  3. Apply Contrast principles (color + bgColor → compute ratio)
  4. Create one check item per applicable principle

For screenshot-holistic checks (Visual Hierarchy, Feedback, Game Design):
  1. These cannot be generated from DOM data — apply them after viewing screenshot
  2. Generate check items based on what's VISIBLE: "Is X present? Does it look like Y?"
  3. Reference the applicable principle for threshold/expectation
  4. These are qualitative assessments — note the basis for the judgement
```

---

## Principle Categories — Stable Reference Knowledge

These are the permanent principles. The thresholds here are what generated checklist items are evaluated against. Principles are stable; checklists are ephemeral.

### A. Touch Targets

**Principle:** All interactive elements must be large enough and spaced far enough apart for reliable thumb targeting on mobile, even under cognitive load during gameplay.

**Thresholds:**
- Minimum size: 44×44 CSS px (Apple HIG 2024)
- Primary combat actions (end turn, confirm, play): 60×60 px recommended
- Card tap areas in hand: 80×110 px (full card bounding box)
- Gap between adjacent interactive elements: ≥ 8px (Material Design 3)
- Destructive action clearance from frequent actions: ≥ 20px
- Bottom safe area (iOS home bar): ≥ 34px from screen bottom
- Top safe area (Dynamic Island): ≥ 62px from screen top

**Apply to:** Every interactive element discovered in Phase 1.

**Failure severities:**
- Below 44px: HIGH
- Overlap between targets: CRITICAL
- Pointer-events blocked: CRITICAL
- Destructive clearance violated: HIGH
- Below 8px gap: HIGH
- Safe area violation: HIGH
- Missing affordance (no visual clickability cue): MEDIUM
- Disabled state not visually distinct (opacity > 40%): MEDIUM

### B. Thumb Zone Ergonomics

**Principle:** Mobile players operate with one thumb. Actions requiring frequent use must be reachable without repositioning the hand. The natural thumb arc covers roughly the bottom 45% and center-to-right of the screen for right-handed users.

**Thresholds:**
- Primary actions (end turn, play card, confirm): Y position > 55% of screen height
- Required interactions not in top 20% of screen: Y position > 20% for any interactive
- Card hand container: Y position > 70% of screen height
- Settings/back (read-only zone): top 15% is fine, bottom is wasteful
- Enemy info (non-interactive): top 50%
- Action width: within 70% of screen width from either edge
- Swipe initiation zones: ≥ 45×45 px

**Apply to:** Every interactive element — check `isInThumbZone` flag from Phase 1.

**Failure severities:**
- Primary action in stretch zone (top 45%): HIGH
- Card hand in top half: HIGH
- Required interaction in top 20%: MEDIUM

### C. Visual Hierarchy

**Principle:** The player's eye should land on the most important game object first, then flow naturally to decision-relevant information. Supporting data should recede visually.

**Thresholds:**
- Primary game object (enemy, card choices) must be the largest visual element by area
- AP/Energy: ≥ 16px, high saturation color, immediately readable
- HP displays: progress bar + number (dual representation)
- Enemy intent: ≥ 24px icon, high contrast, non-interactive placement
- Damage/healing float numbers: bold, ≥ 20px, outlined/shadowed
- Status effect icons: ≤ 4 simultaneously visible (overflow = +N)
- Selected card: 3 simultaneous visual differentiators (lift + highlight + scale)
- Max simultaneous data streams competing for attention: 4–5

**Apply to:** Screenshot holistically. Identify the 3 most visually dominant elements and verify they are the most game-relevant.

**Failure severities:**
- AP/HP not prominently readable: HIGH
- Enemy intent not immediately visible: HIGH
- > 5 competing data streams: HIGH
- Selected card indistinguishable: MEDIUM
- Missing dual HP representation: MEDIUM

### D. Typography & Readability

**Principle:** Text in a mobile game must be readable at arm's length during active play — no squinting, no reread. In-combat text must be instantly parseable.

**Thresholds by text role:**
- Body / effect text: ≥ 11px (iOS floor), 12px preferred
- Card effect text: ≥ 13px preferred
- HP / AP numbers: ≥ 16px (must be instant-read)
- Damage float numbers: ≥ 20px, bold, with stroke or outline
- Tutorial / instructional text: ≥ 14px
- Max lines in any single panel: 3
- Line height for multi-line: ≥ 1.3× font size
- Font weight for in-combat text: bold or medium (no thin/light weights)
- Text on card art: stroke/outline required (drop shadow alone insufficient)

**Apply to:** Every text element discovered in Phase 1. Match role from context/selector.

**Failure severities:**
- Below 11px: HIGH
- HP/AP below 16px: HIGH
- Thin weight in combat: MEDIUM
- No stroke on card art text: MEDIUM
- Cramped line height: LOW

### E. Color & Contrast

**Principle:** Text and UI components must be legible against their backgrounds across all lighting conditions. Color must not be the sole carrier of meaning (colorblind users).

**Thresholds:**
- Normal text (< 18px): contrast ratio ≥ 4.5:1 (WCAG AA)
- Large text (≥ 18px or ≥ 14px bold): contrast ratio ≥ 3:1
- UI components and icons: ≥ 3:1 against background
- No red/green as sole differentiator (8% of males are colorblind)
- Game color semantics (consistent across all screens): Damage = red/orange, Healing = green, AP = yellow/cyan, Buffs = gold/blue, Debuffs = purple
- Disabled cards: desaturated but still visible (≥ 30% opacity)
- Dark theme halation: avoid pure #FFF on pure #000 (use #E0E0E0 on #1A1A1A)
- Danger states (low HP): require animation/pulsing in addition to color change

**Apply to:** Every text element (color + bgColor → compute ratio). Screenshot holistically for semantic color consistency.

**Failure severities:**
- Normal text below 4.5:1: HIGH
- Large text below 3:1: HIGH
- Color as sole differentiator: HIGH
- Red/green only for colorblind content: HIGH
- In-combat text worst-case contrast not tested: HIGH
- Semantic color inconsistency: MEDIUM
- Disabled state invisible: MEDIUM
- Danger state color-only: MEDIUM

### F. Feedback & Juice

**Principle:** Every player action must produce immediate, proportionate visual feedback. Animations communicate state transitions; silence signals error. Timings must be calibrated — too slow feels broken, too fast is unreadable.

**Thresholds:**
- Touch acknowledgment: ≤ 100ms (card lift, button depress)
- Card play animation: 150–300ms
- Damage numbers: float up over 500–800ms with fade
- Screen transitions: ≤ 500ms
- Win/lose reveal entrance: 800–1200ms (dramatic pacing)
- Non-blocking: player can queue next action during current animation
- Enemy turn actions: individually readable (sequential, not simultaneous)
- Critical hits / big damage: escalated feedback (shake, particles — distinct from normal)
- Combo counter: escalating visual intensity as combo grows

**Apply to:** Screenshot for static states. Timing checks are behavioral — note them as needing live-session verification if not directly observable.

**Failure severities:**
- Silent interaction (no feedback): HIGH
- Input lock during animation: HIGH
- Sluggish transition (> 500ms): MEDIUM
- Simultaneous enemy actions (unreadable): MEDIUM
- Missing escalated feedback for critical hits: LOW

### G. Card Game Specific

**Principle:** Mobile card games have a specific set of interaction patterns where ambiguity is catastrophically costly — a misfire can waste a turn. The inspect/play distinction must be unambiguous, costs must be scannable, and state must be always visible.

**Thresholds:**
- Inspect and play: unambiguous distinct gestures (tap ≠ play, or drag-to-play)
- Card AP cost: visible at fan/rest size, top-left corner, ≥ 14px
- Card hand capacity: 5–7 cards visible without scroll
- End Turn button gap from card hand: ≥ 20px
- Card type identifiable by color/border at fan size (no text required)
- Played card state: unambiguous (moved, faded, or removed — not just color change)
- Enemy intent: visible before player makes any card choice (intent precedes decision)
- AP remaining: updates immediately on card play (before animation completes)
- Card reward choices: full detail readable without tapping
- Deck count: visible during combat, low visual weight
- Card upgrade indicator: visible at rest size
- Shop price: clearly associated with the correct card (layout, proximity)
- Relic icons: ≥ 24×24 px at display size
- Relic row: ≤ 8 before wrap/scroll

**Apply to:** Elements that match card-game patterns from Phase 1 data (cards, AP counter, enemy intent, end turn button, shop items, relics). Only generate checks for elements that actually exist on this screen.

**Failure severities:**
- Inspect/play ambiguous: CRITICAL
- Enemy intent not visible before decision: CRITICAL
- Card cost invisible at rest: HIGH
- End Turn too close to hand: HIGH
- AP not instant-updating: HIGH
- Played card ambiguous: HIGH
- Upgrade indicator invisible: MEDIUM
- Relic icon too small: MEDIUM

### H. Cognitive Load

**Principle:** Working memory holds 4±1 chunks. The combat screen must not exceed this capacity. Information needed for decisions must be present on screen — players must not recall from previous screens.

**Thresholds:**
- Max simultaneous data streams on combat screen: 4–5 distinct info groups
- All card effects must be on the card (no off-card recall required)
- Status effect tooltips: accessible via tap (not requiring memory)
- Turn structure: visually clear (whose turn, what phase) at all times
- No tutorial text during active combat decision moments
- Screen stable during player decision-making (no flash/change)
- Numerical values: always exact numbers, not bars alone

**Apply to:** Screenshot holistically. Count distinct competing information groups. Verify card text completeness.

**Failure severities:**
- > 5 simultaneous data streams: HIGH
- Turn state ambiguous: HIGH
- Card effects require external recall: HIGH
- Tooltip unavailable: MEDIUM
- Screen unstable during decision: MEDIUM
- Bar-only (no number): MEDIUM

### I. Accessibility

**Principle:** The game must be operable by players with motor, visual, and cognitive differences. Core accessibility minimums apply even to a game that doesn't target disability use cases.

**Thresholds:**
- Flickering: < 3 flashes/second (WCAG seizure threshold — absolute)
- All interactive elements: accessible name via aria-label or visible text content
- Focus order: follows visual layout (tab = reading order)
- No simultaneous multi-touch required for any action
- Long-press: must have tap alternative
- Text: resizable without layout breaking
- Sound: not required for any essential game information
- Animations: prefers-reduced-motion respected or toggle provided
- Game pace: turn-based (no time pressure on core decisions)
- Spacing for motor-impaired: ≥ 12px between interactive elements

**Apply to:** Every interactive element (accessible name check). Screenshot for flickering observation. Sound/animation checks are behavioral.

**Failure severities:**
- Flickering > 3/sec: CRITICAL
- Interactive without accessible name: MEDIUM
- Multi-touch required: HIGH
- Sound required for info: MEDIUM
- Motion not reduceable: MEDIUM
- Focus order wrong: LOW

### J. Layout Consistency

**Principle:** Consistent element placement reduces cognitive overhead across sessions. Players internalize where things are — breaking this consistency forces re-learning and creates confusion.

**Thresholds:**
- HP bar: same position across all screens (± 5px)
- Back/close button: same position across all screens
- Card display: same size and layout across combat, reward, shop
- Color coding: same meaning across all screens (global color language)
- Font sizes: same for same-priority information across screens
- Button styles: primary = same visual treatment, secondary = same
- Spacing/padding: consistent across similar panels
- Screen transitions: consistent direction/style

**Apply to:** These checks are most meaningful in multi-screen sweep mode. For single-screen audits, flag any obvious departures from game conventions visible in the screenshot.

**Failure severities:**
- Color meaning inconsistency: HIGH
- HP bar repositioned: MEDIUM
- Card size inconsistency: MEDIUM
- Button style inconsistency: MEDIUM
- All others: LOW

### K. Mobile Portrait Specific

**Principle:** The game targets a portrait-orientation mobile form factor. Portrait imposes specific constraints: narrow width, tall scroll space, notch/home indicator regions, thumb-centric ergonomics, and no keyboard assumptions.

**Thresholds:**
- Width utilization: > 90% of available width (no wasted horizontal space)
- Overflow: vertical scroll, not horizontal (conflicts with swipe)
- Notch/Dynamic Island: no UI element occluded (safe area respected)
- Keyboard: must not cover input fields (applies if any inputs exist)
- Rotation: portrait locked or handled gracefully
- Bottom safe area: no content behind home indicator
- Narrow phone support: layout works at 360dp width (budget Android)
- Wide phone support: layout works at 430dp (iPhone Pro Max)
- No horizontal truncation on narrow screens

**Apply to:** Every discovered element — check Y against safe areas, check X bounds for truncation. Width utilization from Phase 1 screen data.

**Failure severities:**
- Notch occlusion: HIGH
- Bottom safe area violation: HIGH
- Truncation on 360dp: HIGH
- Width < 90% utilized: MEDIUM
- Horizontal overflow: LOW

### L. Game Design UX — Best Practice Suggestions

**Principle:** These are not pass/fail — they are improvement patterns from reference games that have proven successful on mobile. Evaluate these holistically by examining the screenshot and comparing to how top-tier card games solve the same problem.

**Note:** These checks are NOT generated from DOM data. After viewing the screenshot, the LLM applies its knowledge of reference games to suggest where Recall Rogue could adopt proven patterns. These produce INFO-severity findings only.

| Pattern | Reference Game | Threshold/Trigger |
|---------|---------------|-------------------|
| Drag-to-play instead of tap-to-play | Marvel Snap | If inspect/play distinction is ambiguous or requires UI chrome to resolve |
| Material/texture communicates card state | Balatro | If upgraded/special cards require text labels to distinguish |
| Scoring cascade with escalating audio | Balatro | If scoring events happen silently or all at the same pitch |
| Border glow direction for zone state | Marvel Snap | If win/advantage state requires text to understand |
| "Escaped!" framing instead of "Lost" | Marvel Snap | If retreat/defeat language is demotivating or final |
| Two-step hand reveal (collapsed → expanded) | Hearthstone mobile | If card hand takes > 30% of screen height at rest |
| Haptic feedback tiering | Balatro | Always suggest if haptics not documented as implemented |
| Enemy intent with exact damage number | Slay the Spire | If intent shows icon only, not the number |
| Fast-forward toggle for enemy turns | Slay the Spire | If enemy turn takes > 2 seconds and there's no speed control |
| High Contrast Cards as primary toggle | Balatro | If any contrast findings are HIGH or CRITICAL |

---

## Output Format

Return findings as structured JSON:

```json
{
  "screen": "combat | shop | reward | hub | etc",
  "preset_used": "__rrScenario preset name",
  "device_width": 393,
  "device_height": 852,
  "timestamp": "ISO timestamp",
  "phase1_inventory": {
    "interactive_count": 0,
    "text_element_count": 0,
    "card_count": 0,
    "phaser_canvas_present": true,
    "interactive_ids": ["btn-end-turn", "btn-retreat", "card-hand-0", "..."],
    "generated_checklist_item_count": 0
  },
  "findings": [
    {
      "id": "UX-001",
      "check_category": "touch_targets | thumb_zone | visual_hierarchy | typography | color_contrast | feedback | card_game | cognitive_load | accessibility | layout_consistency | mobile_portrait | best_practice",
      "principle_ref": "A | B | C | D | E | F | G | H | I | J | K | L",
      "severity": "critical | high | medium | low | info",
      "title": "Short description (max 120 chars)",
      "observation": "What was measured or observed",
      "evidence": {
        "element": "data-testid or selector or description",
        "measured": "38×38 px",
        "threshold": "44×44 px (Apple HIG)",
        "pass": false,
        "screenshot_region": "bottom-right quadrant"
      },
      "suggestion": "Concrete fix: increase button size to 48×48px",
      "effort": "trivial | low | medium | high",
      "heuristic_ref": "Apple HIG / Nielsen H4 / Pinelle H7 / WCAG 2.5.8"
    }
  ],
  "strengths": [
    "What the screen does well — always include positives"
  ],
  "summary": {
    "critical_count": 0,
    "high_count": 0,
    "medium_count": 0,
    "low_count": 0,
    "info_count": 0,
    "generated_checks_total": 0,
    "top_3_priorities": [
      "Most impactful fix first",
      "Second priority",
      "Third priority"
    ],
    "overall_grade": "A | B | C | D | F",
    "grade_rationale": "Brief explanation of grade"
  },
  "best_practice_suggestions": [
    {
      "principle_ref": "L",
      "pattern": "Consider drag-to-play for cards",
      "reference_game": "Marvel Snap",
      "rationale": "Eliminates inspect-vs-play ambiguity, the #1 mobile card game UX problem",
      "effort": "high",
      "impact": "high"
    }
  ]
}
```

### Severity Definitions (Game-Calibrated)

| Severity | Definition | Examples |
|----------|-----------|---------|
| **CRITICAL** | Prevents task completion or causes unfair loss | Card plays itself on inspect, intent invisible, interactive element unreachable |
| **HIGH** | Significant frustration on repeated encounters | Touch targets too small, text unreadable, critical info in stretch zone |
| **MEDIUM** | Noticeable friction but players adapt | Inconsistent colors, suboptimal hierarchy, minor spacing issues |
| **LOW** | Polish issue, minor inconsistency | Animation timing slightly off, minor alignment, cosmetic |
| **INFO** | Observation or best-practice suggestion, no current issue | Pattern from reference games that could enhance the experience |

### Grading Scale

| Grade | Criteria |
|-------|----------|
| **A** | 0 critical, 0 high, ≤ 3 medium. Exemplary mobile game UI. |
| **B** | 0 critical, ≤ 2 high, ≤ 6 medium. Good with minor issues. |
| **C** | 0 critical, ≤ 4 high, any medium. Functional but needs work. |
| **D** | ≤ 1 critical OR > 4 high. Significant UX problems. |
| **F** | > 1 critical. Broken or unusable elements present. |

---

## Multi-Screen Sweep Mode (`/ux-review all`)

When running a full sweep, load each preset in sequence and apply the full protocol:

1. `combat-basic` — Standard combat
2. `combat-boss` — Boss combat (more relics, status effects)
3. `combat-low-hp` — Low HP danger state
4. `combat-10-cards` — Large hand stress test
5. `shop` — Shop overlay
6. `shop-loaded` — Shop with many items
7. `card-reward` — Card reward selection
8. `reward-room` — Reward room
9. `reward-relic` — Relic reward
10. `rest-site` — Rest room
11. `retreat-or-delve` — Post-boss checkpoint
12. `run-end-victory` — Victory screen
13. `run-end-defeat` — Defeat screen
14. `hub-fresh` — Hub (new player)
15. `hub-endgame` — Hub (endgame state)
16. `dungeon-map` — Map navigation
17. `mystery-event` — Mystery event
18. `archetype-selection` — Archetype choice
19. `settings` — Settings screen

After all screens: produce a **Cross-Screen Consistency Report** checking Principle J across all captured screens. The generated checklist for each screen will contain J-category items that can be compared across screens.

### Viewport Sizes to Test

Run each screen at two widths to catch responsive issues:
- **iPhone SE**: 375 × 667 (smallest common iOS)
- **iPhone 15 Pro**: 393 × 852 (standard modern iOS)

Use `mcp__playwright__browser_resize` to switch between sizes.

---

## Relationship to Other Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `/visual-inspect` | Verify correctness (bugs, glitches) | After every code change |
| `/ux-review` (this) | Evaluate quality and design (improvements) | After UI changes, periodically, before ship |
| `/scenario-playtest` | Automated gameplay testing | Testing game flow, not UI quality |

**Rule:** `/visual-inspect` checks "is it broken?" — `/ux-review` checks "is it good?"

---

## Research Sources

These principles are derived from:
- Nielsen's 10 Usability Heuristics (adapted for games by NN/G)
- Pinelle et al. 10 Game Usability Heuristics (CHI 2008)
- PLAY Heuristics (Desurvire & Wiberg, 2009)
- Celia Hodent's Cognitive UX Framework (The Gamer's Brain)
- Game Approachability Principles (GAP)
- Apple Human Interface Guidelines (2024)
- Material Design 3 (Google)
- WCAG 2.2 Level AA
- Game Accessibility Guidelines (gameaccessibilityguidelines.com)
- Baymard Institute UX-Ray methodology (structured checklist > free-form LLM analysis)
- Marvel Snap UI design (Tiffany Smart, GDC 2023)
- Slay the Spire UI analysis (Cloudfall Studios)
- Balatro mobile port analysis (Engadget, design studies)
- Hearthstone mobile adaptation (Blizzard GDC talks)
- Steven Hoober thumb zone research (2013, 1333 participants)
- Fitts's Law applied to game interfaces

### Registry Update (AUTO)
After completing UX review, update the registry:
```bash
npx tsx scripts/registry/updater.ts --ids "{comma-separated reviewed screen/element IDs}" --type uxDate
```
