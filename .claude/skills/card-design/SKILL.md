---
name: card-design
description: Card visual design rules — terse descriptions, typography, frame layout. Reference when modifying card rendering, descriptions, or visual hierarchy during combat.
user_invocable: false
---

# Card Design Rules — ALWAYS ACTIVE

## Card Description Rules (In-Run Combat)

Card descriptions shown during runs MUST be ultra-short, one-glance, zero extra words:

### Good Examples
- "8 dmg" (not "Deal 8 damage to the enemy")
- "Draw 2" (not "Draw 2 cards from your draw pile")
- "Peek 1" (not "Peek at the next enemy intent")
- "6 block" (not "Gain 6 block points")
- "+30% next" (not "Next card deals 30% more damage")
- "3×2 hits" (not "Hit 3 times for 2 damage each")
- "4 poison" (not "Apply 4 poison to the enemy")
- "Heal 5" (not "Restore 5 HP")

### Rules
1. **Max 2-3 words** for primary effect
2. **Numbers first or inline** — "8 dmg", "Draw 2", not "Deal damage: 8"
3. **No articles** — never "the", "a", "an"
4. **No target specification** — the target is obvious from context
5. **No flavor text on in-hand cards** — save that for the expanded card view
6. **Dynamic values** — descriptions must show actual computed damage (with relics, buffs, strength), not static base values

### Typography
- Card title: black text with hard white outline (text-shadow)
- Description text: use `var(--font-rpg)` font, vertically centered in description area
- Numbers in descriptions: highlighted with `.desc-number` class
- Font size scales down for longer descriptions (3 tiers: normal, medium, small)

### Layout
- Description container must have `overflow: hidden` — text must NEVER render outside card bounds
- V2 card frame system: base + border (by card type) + banner (by domain)
- Card art positioned between title and description areas

### Key Files
- `src/ui/components/CardHand.svelte` — card rendering in hand
- `src/services/cardDescriptionService.ts` — description text generation
- `src/data/mechanics.ts` — mechanic definitions with base values

### When This Applies
- Any change to card descriptions, card rendering, card frame layout
- Adding new card mechanics (must have terse description)
- Changing damage computation or display values
