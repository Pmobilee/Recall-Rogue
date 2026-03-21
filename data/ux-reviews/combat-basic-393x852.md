# UX Audit — Combat Screen (combat-basic)
**Viewport:** 393×852 iPhone 15 Pro portrait | **Date:** 2026-03-21 | **Auditor:** Claude Opus 4.6

---

## Grade: C+

The combat screen communicates the core game loop and the card fan layout is visually appealing with good use of pixel art. The AP orb and enemy intent badge are well-implemented. However, three critical typography failures — card type labels at 3.77px, card effect text at 8.25px, and player HP at 9.07px — make essential game information illegible on a physical device. Fixing typography alone would move this to B+.

---

## Top 3 Priorities

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| 1 | Card type label (ATTACK/SHIELD) renders at **3.77px** — completely illegible | CRITICAL | Low |
| 2 | Card effect body text ("Deal 8 damage") renders at **8.25px** — below minimum legibility | CRITICAL | Medium |
| 3 | Player HP value renders at **9.07px** at screen bottom edge — survival-critical stat is unreadable | CRITICAL | Medium |

---

## Strengths

- **AP orb** is prominently sized (56×56px, 28px white text on dark backing) — the core resource is always visible
- **Enemy intent badge** communicates threat clearly with semantic red colour and correct `aria-label="Attacks for 8 damage"`
- **End Turn button** meets minimum 44px height (48px actual) with a readable 14px label
- **Card AP cost numerals** (21px amber) are large and visually distinct on the card face
- **All 5 cards** sit in the thumb zone — the entire hand is reachable one-handed in the lower 60% of the screen
- **Card fan layout** conveys hand size at a glance without needing a number indicator
- **Card border colour** differentiates attack (red) from shield (blue) at a macro level
- **Pile counts** (13px bold) are readable at a glance
- **Pause button** is correctly positioned (48×48px, aria-label present, high z-index 150)
- **Enemy name** uses bold 800-weight at 16px — recognisable above the sprite

---

## All Findings by Severity

### CRITICAL (3)

#### CRIT-1 — Card type label is 3.77px: completely illegible
- **Element:** Card type badges ("ATTACK" / "SHIELD") on all 5 cards
- **Problem:** 3.77px CSS font size. At ~460 PPI on an iPhone 15 Pro, this is 1–2mm of physical text. No human can read it under play conditions. The type label is meant to tell players the card's mechanical category — the most important strategic classifier — and it is invisible.
- **Evidence:** `fontSize=3.77` on card type label DOM node
- **WCAG:** 1.4.4 — practical mobile minimum is 10px; iOS HIG minimum is 11pt
- **Fix:** Raise to minimum 10px. Add an icon (sword / shield) as the primary differentiator at 16×16px, making text secondary. This also solves the colour-blindness problem (see HIGH-4).
- **Effort:** Low

#### CRIT-2 — Card effect text is 8.25px: below legibility threshold
- **Element:** Effect text on all cards ("Deal 8 damage", "Gain 6 Block")
- **Problem:** 8.25px is below the iOS HIG minimum of 11pt. This is the most strategically critical text on the card — it tells the player what will happen when they play it. It must be readable under stress, glare, and fatigue.
- **Evidence:** `fontSize=8.25` on card effect text
- **WCAG:** 1.4.4; iOS HIG 11pt minimum
- **Fix:** Increase to minimum 11px. Consider showing abbreviated effect in the hand view and full text in a selected/tooltip state. Reduce card art height if needed — legibility beats aesthetics.
- **Effort:** Medium

#### CRIT-3 — Player HP label is 9.07px at screen bottom edge
- **Element:** Player HP display "100/100"
- **Problem:** 9.07px font, 9.07px renders 37px from the bottom of the 852px screen. HP is a survival-critical stat — players need to know "do I survive the incoming 8 damage?" This requires reading the exact number, not just eyeballing the HP bar percentage.
- **Evidence:** `fontSize=9.07, x=192 y=815, w=190 h=20`
- **WCAG:** 1.4.4
- **Fix:** Increase HP label to minimum 13px. Expand the player HUD bar to 40px+ height. Display the HP number prominently centred in the bar.
- **Effort:** Medium

---

### HIGH (5)

#### HIGH-1 — Card overlap creates high mis-tap probability for interior cards
- **Element:** card-hand-1, card-hand-2, card-hand-3
- **Problem:** The fan layout overlaps cards aggressively. card-hand-2 (centre) is 118px wide but is occluded on both sides — its visible non-occluded strip may be as narrow as 30–40px. The system has flagged all 5 cards as overlapping (`nn=-20`). On a physical touchscreen, taps on the visible card art will frequently register on the wrong card's DOM bounding box.
- **Evidence:** card-hand-2: `x=138 w=118`, overlapped by card-hand-1 right edge at `76+145=221px`. All cards: `nn=-20`
- **WCAG:** 2.5.5 Target Size — bounding box passes but visible area does not
- **Fix:** Implement "lift to select" — first tap raises and highlights the card; second tap confirms play. This is the Slay the Spire model and eliminates accidental plays. Alternative: reduce fan overlap to max 40% of card width.
- **Effort:** High

#### HIGH-2 — Enemy intent button is in top-left corner, not thumb zone
- **Element:** Enemy intent button (x=8, y=12)
- **Problem:** Top-left corner is the hardest ergonomic reach on a 852px phone for right-handed one-handed use. The button is technically 73×49px (meets minimum) but requires a grip shift to reach. Additionally, it looks like an informational badge (low-opacity red background) rather than a tappable button — the affordance is weak.
- **Evidence:** `x=8 y=12 w=73 h=49, thumbZone=false, nn=286`
- **Fix:** If it only displays info, convert to non-interactive element. If it opens details, move near the enemy HP bar (which is centre-screen) or make the entire enemy display area tappable for details.
- **Effort:** Medium

#### HIGH-3 — Enemy name uses low-contrast grey (estimated ~2.5:1 contrast ratio)
- **Element:** Enemy name "Page Flutter"
- **Problem:** Enemy name renders in `rgb(156,163,175)` — a medium grey — against a dark cave background. Estimated contrast ratio is approximately 2.5:1, well below the WCAG AA requirement of 4.5:1 for text under 18pt. At 16px this text requires full 4.5:1 contrast.
- **Evidence:** `color=rgb(156,163,175), fontSize=16.1`
- **WCAG:** 1.4.3 Contrast (Minimum) — fails AA
- **Fix:** Change to white `rgb(255,255,255)` or near-white `rgb(220,220,220)`. This is a one-line CSS change.
- **Effort:** Low

#### HIGH-4 — Card type differentiation relies on colour alone (fails colour-blindness check)
- **Element:** Card hand — ATTACK (red border) vs SHIELD (blue border)
- **Problem:** With the type label at 3.77px (illegible), colour is the sole reliable differentiator between card types in the fan view. Approximately 8% of males have red-green colour blindness. The red/blue distinction is easier for deuteranopia than red/green, but players with monochromacy or other conditions cannot distinguish. WCAG prohibits colour as the sole differentiator.
- **Evidence:** Type label `fontSize=3.77` (unusable), border colour is only other cue
- **WCAG:** 1.4.1 Use of Color
- **Fix:** Add an icon to each card type: sword icon (ATTACK), shield icon (SHIELD), at 16×16px minimum in the card header area. This makes the icon + colour together the differentiator, satisfying WCAG 1.4.1.
- **Effort:** Medium

#### HIGH-5 — Player block and HP values are cramped in a 20px-tall container
- **Element:** Player block "0" at x=166, y=819 and HP "100/100" at x=192, y=815
- **Problem:** Both values occupy nearly the same horizontal band with only 26px horizontal separation. Block is 12px bold sky-blue; HP is 9px regular white. The hierarchy is inverted — the bolder, more colourful element (block) is less important than the lighter element (HP). The entire player stat display is 20px tall, making it visually cramped and hard to parse at a glance.
- **Evidence:** Block: `x=166 y=819 fontSize=12.09 fontWeight=800`; HP: `x=192 y=815 w=190 h=20 fontSize=9.07`
- **Fix:** Redesign the player HUD into a 48px-tall dedicated bar. HP: 16px bold white on the left. Block: 14px sky-blue on the right. Clear horizontal separation. The HP bar gradient becomes a background element behind both.
- **Effort:** Medium

---

### MEDIUM (7)

#### MED-1 — End Turn button is left-aligned, ignoring the right-side dominant-thumb zone
- **Element:** btn-end-turn (x=12, y=792, w=114, h=48)
- **Problem:** End Turn is the most frequent tap in combat — pressed every single turn. It's 114px wide anchored to the left side of the screen. Right-handed players (88% of users) reach with their right thumb from the right side — making them stretch across the screen for the most frequent action.
- **Fix:** Move End Turn to the bottom-right, or expand it to 80% screen width centered so both thumbs can reach it equally.
- **Effort:** Medium

#### MED-2 — AP orb has no context label — new players won't know what "3" means
- **Element:** AP orb (x=23, y=504)
- **Problem:** An isolated number "3" in a circle has no label. New players won't know this is Action Points. Veterans learn quickly, but it's a friction point during the critical first-session onboarding.
- **Fix:** Add a small 'AP' label below the orb (10–11px). Add `aria-label="3 Action Points remaining"` to the element.
- **Effort:** Low

#### MED-3 — No visible affordance for unaffordable cards (0-AP state not designed)
- **Element:** Card hand — state when player has 0 AP
- **Problem:** No evidence of a distinct 'cannot play' card state. When a player runs out of AP, they should not be able to play cards. Without a visual disabled state (desaturated art, greyed cost gem), players will tap cards expecting a quiz and get no feedback.
- **Fix:** Implement `opacity: 0.5` + desaturated filter on unaffordable cards + greyed cost gem. Add shake animation on tap attempt.
- **Effort:** Medium

#### MED-4 — No turn phase indicator ("Your Turn" vs "Enemy Acting")
- **Element:** Screen-level state — no turn indicator element found
- **Problem:** The screen shows no explicit "YOUR TURN" / "ENEMY ACTING" label. During the enemy's attack animation phase, players need to know the game is working and it's not their turn. Without this, input-freezing enemy phases feel like hangs.
- **Fix:** Add a turn phase badge near the top of the player zone. Show "YOUR TURN" briefly on turn start, "ENEMY ATTACKING" during enemy actions with the action being described.
- **Effort:** Medium

#### MED-5 — Cards lack descriptive aria-labels with state information
- **Element:** card-hand-0..4 aria semantics
- **Problem:** Cards have only their text content as accessible description. No positional context ("card 1 of 5"), no affordability state (`aria-disabled`), no selection state (`aria-pressed`).
- **Fix:** `aria-label="Strike: costs 1 AP, deals 8 damage. Card 1 of 5."` with `aria-disabled="true"` when unaffordable.
- **Effort:** Low

#### MED-6 — Card hand uses 34% of screen height, compressing enemy combat area
- **Element:** Card hand zone (y=566–793 = 227px) on 852px screen
- **Problem:** The combined card hand + End Turn area consumes ~280px (33%) of screen height. The upper 566px must fit the entire enemy display. This is workable but visually crowded — the AP orb is only 62px above the hand.
- **Fix:** Implement a collapsed hand mode showing only card top-strips (~40px) until the player swipes up to expand. This gives the enemy area 70%+ of screen height without changing the interaction model.
- **Effort:** High

#### MED-7 — No visual confirmation of which card was selected before quiz launches
- **Element:** Card tap → quiz launch interaction
- **Problem:** With fan overlap (see HIGH-1), a player may mis-tap. Without a brief (100ms) "card lifts and is highlighted" state before the quiz appears, they won't know the wrong card was activated until after the quiz launches.
- **Fix:** Add a 100–150ms card-lift animation state between tap and quiz trigger. Show which card is "committed" before the quiz overlay appears.
- **Effort:** Medium

---

### LOW (7)

#### LOW-1 — Card names are 11.79px — marginally small for overlapped centre cards
- **Element:** Card name labels on inner cards
- **Fix:** Increase to 13px. Marginal issue but compounds with overlap occlusion.
- **Effort:** Low

#### LOW-2 — Enemy intent button lacks tappable affordance (looks like a badge)
- **Element:** Enemy intent button
- **Fix:** Add rounded border or chevron indicator. Consider a subtle pulse animation on first appearance.
- **Effort:** Low

#### LOW-3 — Block value (12px bold) visually outweighs HP (9px regular) — inverted hierarchy
- **Element:** Player stats HUD
- **Fix:** Make HP the dominant visual element: 14–16px bold. Match or reduce block weight.
- **Effort:** Low

#### LOW-4 — Pause button is icon-only (no visible text label)
- **Element:** btn-pause
- **Status:** Acceptable — `aria-label="Pause"` is present. Low priority.
- **Effort:** Low

#### LOW-5 — Pile counts lack draw/discard labels
- **Element:** Pile count numbers "5" and "0"
- **Fix:** Add 10px "DRAW" / "DISC" micro-labels above the numbers, or use iconographic deck vs discard pile icons.
- **Effort:** Low

#### LOW-6 — Background art may reduce contrast of un-backed UI elements
- **Element:** Screen-wide — UI elements over textured cave background
- **Fix:** Ensure all text-bearing UI elements have a `rgba(0,0,0,0.6)+` backing. The AP orb's dark circle is the right model — extend to all floating UI.
- **Effort:** Low

#### LOW-7 — No confirmation animation between card tap and quiz launch
- **Element:** Card interaction flow
- **Fix:** Already covered in MED-7 above. Low-severity version of the same issue — even without the full lift animation, a brief flash/highlight would help.
- **Effort:** Low

---

## Severity Summary

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 5 |
| Medium | 7 |
| Low | 7 |
| **Total** | **22** |

---

## Quick Win List (Low Effort, High Impact)

These can be addressed in a single engineering pass:

1. **CRIT-1** — Increase card type label to 10px minimum (CSS change)
2. **HIGH-3** — Change enemy name colour to white/near-white (CSS change)
3. **MED-2** — Add 'AP' label to the AP orb (DOM/CSS change)
4. **MED-5** — Add aria-labels to card elements (HTML attribute change)
5. **LOW-3** — Fix HP vs block visual weight hierarchy (CSS change)
6. **LOW-5** — Add pile count labels (DOM change)

---

## Medium Effort, High Impact (Next Sprint)

1. **CRIT-2** — Card effect text to 11px+
2. **CRIT-3** — Player HP to 13px+, expand HUD bar
3. **HIGH-5** — Redesign player stat HUD
4. **MED-1** — Reposition End Turn button to right side
5. **HIGH-4** — Add type icons (sword/shield) to cards

---

*Full machine-readable audit data: `data/ux-reviews/combat-basic-393x852.json`*
