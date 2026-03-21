# AR-101: Portrait Polish — Backgrounds, Charge Threshold, Chain Border

## Issue 1: Background Images Not Stretching to Screen Edges (Portrait)

Combat backgrounds, hub background, and room backgrounds don't fully stretch to all edges on some mobile screen sizes. There are visible gaps (black bars or misaligned edges).

**Fix:** Audit ALL background image CSS across every screen/room. Ensure every background uses `object-fit: cover` or equivalent to fill the entire viewport regardless of aspect ratio.

Screens to check:
- Combat scene (Phaser canvas background)
- Hub/camp screen background
- Map screen
- Domain selection
- Card reward screen
- Shop
- Rest site
- Reward room (Phaser scene)

For Phaser scenes: the background image should use cover-scaling (`Math.max(viewW/imgW, viewH/imgH)`).
For Svelte/CSS backgrounds: `background-size: cover; background-position: center;` or `object-fit: cover; width: 100%; height: 100%;`.

## Issue 2: Charge Swipe Threshold Too High

The cutoff point for swiping a card upward to trigger Charge is too high on the screen. Players have to drag too far up. Lower the threshold by ~15%.

**File:** Look for the charge zone threshold in `src/ui/components/CardHand.svelte` or `src/ui/components/CardCombatOverlay.svelte`.

The threshold is defined in AR-62 as 40% from the top of the screen (35% on small screens). Lower it:
- Was: 40% from top (60% from bottom)
- New: ~55% from top (45% from bottom) — making it easier to trigger charge

Search for constants like `CHARGE_THRESHOLD`, `CHARGE_ZONE_PCT`, `chargeThreshold`, or `0.4` / `0.35` in the card drag handling code.

## Issue 3: Chain Type Top Border NOT Visible on Cards

The 5px chain type border strip added in the previous commit is apparently not visible on the actual rendered cards. The colored bar that the user showed in their reference photo (thick colored strip at the TOP of each card — blue, orange, purple) is not rendering.

**Diagnosis needed:**
1. Check if `.card-chain-top-border` elements exist in the DOM
2. Check if they have `height: 5px` and a visible `background` color
3. Check if they're hidden behind card art (z-index issue) or clipped by `overflow: hidden` on the parent
4. The card frame PNG images may cover the border — the border needs to render ON TOP of the card art

**Fix:** The chain border must be:
- **ON TOP of everything** on the card (z-index above card art, card frame, all card content)
- **At least 5-6px tall** — thick enough to be immediately visible
- **Full width** of the card
- **Solid color** from `getChainColor(card.chainType)`
- **Visible in BOTH portrait and landscape**

If the card uses an `<img>` for the card frame that covers the border, the border needs `z-index: 10` or higher.

## Acceptance Criteria

- [ ] ALL backgrounds stretch to screen edges in portrait mode (no black bars/gaps)
- [ ] Charge swipe threshold lowered ~15% (easier to trigger charge)
- [ ] Chain type colored top border visible on every card in hand
- [ ] Chain border visible on reward screen cards
- [ ] Chain border visible on shop cards
- [ ] All changes work in portrait AND landscape
- [ ] Visual screenshot verification of each fix
