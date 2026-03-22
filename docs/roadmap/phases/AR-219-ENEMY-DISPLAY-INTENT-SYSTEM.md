# AR-219: Enemy Display & Intent System

> **Source:** [Playtest Feedback 2026-03-22](../PLAYTEST-FEEDBACK-2026-03-22.md) — Issues #1, #2, #3, #4, #5, #27, #45
> **Priority:** P0 — Core enemy UI, paired with AR-218
> **Complexity:** Medium (7 discrete changes to enemy display)
> **Dependencies:** AR-218 (shares HP bar changes — block inline text applies to enemy too)

---

## Overview

Overhaul the enemy display system: intent button positioning, intent interaction behavior, enemy title styling, HP bar visual quality, status effect placement, and elite/boss HP bar coloring.

---

## User's Exact Words

- **#1:** "The enemy intention, the gold button at the top which pops out when you click on it, should at all times be stuck to the top-left of the enemy, of course not moving with the enemy as this would be annoying."
- **#2:** "When clicking the enemy we see a popup with another intention explanation, remove this."
- **#3:** "When clicking the enemy intention, show the name of the attack in a darker version of the intent color like Screech: Buff self 1 strength for 2 turns."
- **#4:** "Title of the enemy must be bigger and have a stronger border, including the turn 1 below it, also relatively bigger."
- **#5:** "The HP bar looks ugly, I dont mind the text, but we need a black border around it and an rpg like 3d effect."
- **#27:** "I want the enemy upgrades like strength, etc or dots like bleed poison, basically any and all effects, to show up underneath the health bar of the enemy, not on top."
- **#45:** "Elites must have a different color healthbar, and so must the bosses, although their healthbar must turn blue as always if they have block."

---

## Sub-Steps

### 1. Intent Button — Fixed Position Top-Left of Enemy
- **What:** The intent icon/button must be positioned at the top-left of the enemy sprite's bounding area.
- **Critical:** The intent button must NOT move/animate with the enemy sprite (e.g., during idle bob, attack animations). It stays fixed at the initial top-left position.
- **Current behavior:** Intent button is centered above the enemy HP bar.
- **New behavior:** Intent button anchored to top-left corner of the enemy's static bounding box.
- **Acceptance:** Intent button visible at top-left of enemy, remains stationary during all enemy animations.

### 2. Remove Enemy Click Popup
- **What:** Currently clicking on the enemy sprite shows a popup with intent explanation text. Remove this popup entirely.
- **Acceptance:** Clicking on the enemy sprite produces no popup/tooltip/overlay.

### 3. Intent Click — Show Attack Name in Darker Intent Color
- **What:** When clicking the intent button (not the enemy), show a tooltip/label with the attack name and description.
- **Format:** "[Attack Name]: [Description]" — e.g., "Screech: Buff self 1 strength for 2 turns"
- **Color:** Text rendered in a darker shade of the intent's color. If intent is red (attack), use dark red text. If yellow (buff), use dark yellow/gold text. Etc.
- **Behavior:** Shows on click, dismisses on click elsewhere or after 3 seconds.
- **Acceptance:** Clicking intent button shows styled attack name + description in darker intent color.

### 4. Enemy Title — Bigger with Stronger Border
- **What:** Increase the enemy name text size significantly (suggest 1.4-1.6x current).
- **What:** Add a stronger/thicker text border/outline (2-3px black stroke).
- **What:** The "Turn X" text below the title must also be bigger (proportionally).
- **Acceptance:** Enemy title visually prominent, easy to read against any background. Turn counter also larger.

### 5. Enemy HP Bar — RPG 3D Effect with Black Border
- **What:** Keep the HP numbers/text as-is (user said "I don't mind the text").
- **What:** Add a solid black border around the HP bar (2-3px).
- **What:** Add an RPG-style 3D effect: slight gradient on the bar (lighter on top, darker on bottom), subtle inner shadow or highlight on the top edge, slight bevel look.
- **What:** Block display uses inline "(N)" prefix per AR-218 #11 (applies to enemy HP bar too).
- **Acceptance:** Enemy HP bar has black border, visible 3D/bevel effect, looks polished/RPG-like.

### 6. Enemy Status Effects — Under HP Bar
- **What:** Move all enemy status effect icons (strength, weakness, poison, bleed, burn, etc.) from above the HP bar to BELOW it.
- **Acceptance:** Status effects render underneath the enemy HP bar, not on top.

### 7. Elite & Boss HP Bar Colors
- **What:** Elites get a distinct HP bar color (suggest: dark purple or orange fill).
- **What:** Bosses get a distinct HP bar color (suggest: dark red or crimson fill).
- **What:** Normal enemies keep the standard red HP bar.
- **What:** ALL enemy types: HP bar turns blue when the enemy has ANY block (overrides the rarity color).
- **Color hierarchy:** Block blue > Boss color > Elite color > Normal red.
- **Acceptance:** Elite HP bars visually distinct from normal. Boss HP bars visually distinct from elite. Blue override when block > 0.

---

## Files Affected

- `src/game/systems/EnemySpriteSystem.ts` — intent button positioning, enemy click handler
- `src/ui/combat/EnemyHPBar.svelte` or equivalent — HP bar styling, 3D effect, colors
- `src/ui/combat/EnemyIntent.svelte` or equivalent — intent click tooltip
- `src/ui/combat/EnemyInfo.svelte` or equivalent — title sizing, turn counter
- `src/ui/combat/StatusEffects.svelte` — enemy status effects positioning
- `src/ui/combat/CardCombatOverlay.svelte` — layout adjustments

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Intent button at top-left of enemy, stationary during animations
- [ ] No popup when clicking enemy sprite
- [ ] Intent click shows attack name in darker intent color
- [ ] Enemy title visibly larger with strong border
- [ ] HP bar has black border and RPG 3D bevel effect
- [ ] Status effects below HP bar
- [ ] Elite HP bar distinct color, Boss HP bar distinct color
- [ ] Blue override when enemy has block
- [ ] Block shown as "(N)" inline text in HP bar
- [ ] `npx vitest run` passes
- [ ] Update `docs/GAME_DESIGN.md` sections: Enemy Sprite Rendering, Enemy Rarity System
