# AR-106: Card Art Overhaul — Mechanic Illustration Redesign

## Status: IN PROGRESS

## Overview

**Goal:** Redesign all 31 card mechanic illustrations (the art that fills the top ~60% of each card) with a unified visual style, consistent character design, and clear thematic connection to both the card's combat effect AND the knowledge/study theme. Each card art should tell a micro-story that instantly communicates what the card does.

**Why:** The current card art is individually impressive but collectively incoherent:
- **Strike** shows a dark knight slashing a skeleton in a classroom — the knight's armor style is heavy medieval
- **Multi-Hit** shows a different dark knight fighting a statue/mage in a library — art direction clash with Strike
- **Block** shows a young unarmored warrior with a rune-shield in a library — completely different character
- **Heavy Strike** shows a third distinct armored figure smashing fossils in a cave — different setting entirely
- **Empower** shows an elf enchantress and a shirtless barbarian — different art style (more painterly)
- **Hex** shows a skeleton professor in academic robes with a graduation cap — different tone (dark comedy)
- **Scout** shows a halfling/gnome child with a telescope — completely different character and tone
- **Mirror** shows an elf with a colorful scarf — yet another character, prismatic style
- **Piercing** shows a full-plate knight in an anatomy lab — different setting
- **Thorns** shows a teacher and student with flying stationery — more comedic tone

**The core problem:** There is no consistent protagonist, no consistent setting vocabulary, and no consistent art direction. It feels like 31 different games.

**The solution:** Define a single protagonist (the player character), a consistent setting palette, and a unified composition style, then regenerate all 31 mechanic arts.

**Dependencies:** NanoBanana access, ComfyUI + SDXL pixel art LoRA
**Complexity:** High (31 illustrations to redesign with strict style consistency)

---

## Part 1: Visual Style Bible for Card Art

### The Protagonist: The Delver

Every card shows the same character — **the Delver** — performing the card's action. This creates visual consistency and player identification. The Delver is:

- **Appearance:** Medium armor — leather + light plate pieces. Practical adventurer-scholar hybrid. Think "Indiana Jones meets a D&D ranger." NOT full plate knight, NOT robes-only mage.
- **Signature elements:**
  - A **satchel/bag of books** on their hip or back
  - **Goggles** pushed up on forehead (scholar's magnifying lenses)
  - A **glowing quill** tucked behind one ear
  - **Runic bracers** on forearms (these glow different colors for different card types)
  - Dark hair, determined expression
- **Gender:** Ambiguous/androgynous — readers can project
- **Size in frame:** ~40-50% of art area. Character should be prominent but not overwhelming — the ACTION and SETTING tell the card's story equally.

### The Setting: The Athenaeum

All card art takes place in variations of the same dungeon-library. Setting elements include:
- Stone walls with bookshelves built into them
- Torchlight and candlelight (warm orange key light)
- Scattered books, scrolls, chalkboards with formulas
- Runic inscriptions glowing on surfaces
- The enemy/target should be one of the knowledge-themed creatures from AR-105 (or a generic shadowy enemy if AR-105 isn't done yet)

### Composition Rules

1. **Camera angle:** Slightly low, looking up at the action (makes it feel heroic)
2. **Action freeze-frame:** The art captures the MOMENT of the card's effect — mid-swing, shield just raised, spell being cast
3. **Effect visualization:** The card's mechanical effect is visualized with a glowing energy matching the card type color:
   - Attack effects: Red/orange energy trails, slashes, impacts
   - Shield effects: Blue/cyan energy barriers, protective circles
   - Buff effects: Golden/amber auras, upward energy flows
   - Debuff effects: Purple/dark tendrils, descending curse marks
   - Utility effects: Teal/green energy, revealing/scanning effects
   - Wild effects: Prismatic/rainbow, shifting energy
4. **The knowledge connection:** Every card art includes at least one study-themed element in the action itself — knowledge is the source of the Delver's power

### Technical Specs

- **Resolution:** 512 × ~370px (fills the art window of the universal frame from AR-104)
- **Aspect ratio:** ~1.38:1 (landscape rectangle fitting inside the card frame's art window)
- **Style:** 16-bit pixel art, consistent with enemy sprites (2px outlines, 3-4 shade levels, limited dithering)
- **Lighting:** Warm torchlight from upper-left as default key light, with card-type-colored accent lighting for the effect
- **Background:** Always a dungeon-library interior (varied rooms — study halls, reading nooks, archive corridors, exam chambers)
- **No floating elements:** No floating sparks, particles, or small detached elements around the sprite — these cut out badly in post-processing

---

## Part 2: All 31 Card Art Designs

### ATTACK CARDS (7)

#### 1. Strike
**Current:** Dark knight slashing skeleton in front of F=ma chalkboard
**New concept:** The Delver mid-swing with a glowing sword, the blade trailing pages of light. They're striking a shadow creature (generic enemy silhouette) in a stone corridor. Behind them, a chalkboard shows the formula that empowers the strike — the equation IS the power source. The sword's glow matches the equation's glow.
**Story:** Knowledge IS the weapon. The Delver channels a remembered fact into their blade.

**NanoBanana prompt:**
```
POSITIVE: pixel art card illustration, adventurer-scholar in leather armor with light plate pieces swinging a glowing sword in a dungeon library corridor, blade trailing luminous pages and formula symbols, striking a shadowy enemy creature, stone walls with bookshelves, glowing chalkboard with mathematical formula behind them, warm torchlight from upper left, red-orange energy slash effect, goggles on forehead, book satchel at hip, determined expression, 16-bit pixel art, 2px dark outline, 512x370px landscape, heroic low angle composition, action freeze-frame mid-swing, solid white background

NEGATIVE: photorealistic, painterly, smooth, full plate heavy armor, dark gritty, modern, transparent background, alpha channel, cute, chibi, facing camera directly, static pose, text watermark
```

#### 2. Multi-Hit
**Concept:** The Delver in a rapid combo — three afterimage poses showing successive strikes. Each strike is punctuated by a different book/scroll being sliced through, releasing knowledge energy. The triple-strike motion blur creates a dynamic arc.
**Story:** Speed-reading applied to combat — rapid recall, rapid strikes.

#### 3. Heavy Strike
**Concept:** The Delver raising a massive two-handed hammer overhead, about to bring it down on a thick tome that's being used as an anvil/target. The hammer is made of compressed, glowing encyclopedias. The ground cracks beneath the impending impact. Debris of paper and stone.
**Story:** Sometimes you need to hit the books. Hard.

#### 4. Piercing
**Concept:** The Delver thrusting a needle-thin rapier that passes THROUGH a ghostly enemy's shield. The rapier glows with an X-ray effect, showing the internal structure of what it pierces — like the knowledge lets you see through defenses. An anatomy diagram on the wall echoes the theme.
**Story:** Deep understanding penetrates all barriers.

#### 5. Reckless
**Concept:** The Delver in a wild, uncontrolled leap attack — books and papers flying from their satchel, armor cracked, expression fierce. They're dealing massive damage to an enemy BUT you can see cracks/damage on the Delver too. Red energy everywhere, chaotic.
**Story:** Cramming — maximum output at the cost of your own wellbeing.

#### 6. Execute
**Concept:** The Delver standing over a crumbling, nearly-defeated enemy (a "Wrong Answer" creature that's fracturing). They hold a glowing red pen like a finishing weapon, about to strike the final mark. The red pen leaves a trail of correction marks.
**Story:** The final answer — crossing out the last wrong answer decisively.

#### 7. Lifetap
**Concept:** The Delver draining green life-energy from a wounded enemy through a chain of glowing text/formulas. One hand on their sword (in the enemy), the other absorbing the energy through an open book held against their chest. Healing green and attack red intertwine.
**Story:** Learning from your enemies — absorbing knowledge AND vitality.

---

### SHIELD CARDS (7)

#### 8. Block
**Concept:** The Delver crouching behind a massive shield that is literally a giant book cover — "RESTRICTED SECTION" on it. Energy blasts impact the book-shield, sending loose pages flying but the shield holds firm. Blue protective runes glow on the shield's surface.
**Story:** Knowledge is your shield. What you know protects you.

#### 9. Thorns
**Concept:** The Delver standing calmly as sharp pencils, pens, and compass needles orbit them in a defensive whirlwind. An enemy lunging in gets impaled on the spinning stationery storm. Blue defensive circle on the ground, orange reflective damage sparks.
**Story:** The prepared student's tools defend AND attack.

#### 10. Emergency
**Concept:** The Delver desperately pulling books off a shelf to build a hasty barricade as a massive attack approaches. Papers flying, expression panicked but resolute. The barrier is crude but effective. Red warning glow = HP is low.
**Story:** Last-minute cramming — building knowledge defenses in a panic.

#### 11. Fortify
**Concept:** The Delver carefully constructing a proper wall of stacked books, each placed deliberately. Unlike Emergency's desperate pile, this is an architect's work — organized, reinforced, with runic mortar between books. Calm, strategic expression.
**Story:** Methodical study builds lasting defenses.

#### 12. Parry
**Concept:** The Delver deflecting an enemy's weapon with an open book held like a blade — the book's pages catch the sword/claw and redirect it. One fluid motion. A card is being drawn from the deflection's momentum (utility bonus).
**Story:** Reading the enemy's move before they make it.

#### 13. Brace
**Concept:** The Delver reading an enemy's intent from a glowing scroll/crystal ball that shows the incoming attack. They're setting up a shield of EXACTLY the right size. The shield value matches the telegraph — they know exactly what's coming.
**Story:** If you study the test in advance, you know exactly how to prepare.

#### 14. Overheal
**Concept:** The Delver surrounded by a massive blue protective sphere made of overlapping pages and runes. The sphere is oversized, excessive, clearly more protection than needed. The Delver looks comfortable, almost meditative inside it.
**Story:** Over-preparation — studying so much the defense becomes overwhelming.

---

### BUFF CARDS (4)

#### 15. Empower
**Concept:** The Delver holding an open book that radiates golden light onto their sword/weapon, enchanting it. The weapon transforms — becoming brighter, sharper, more powerful. Golden runes flow from book to weapon. A study desk in the background.
**Story:** Studying enhances your weapons — knowledge amplifies power.

#### 16. Quicken
**Concept:** The Delver speed-reading a scroll, pages turning themselves in a blur. Around them, time seems to slow — other objects frozen mid-air while the Delver moves normally. Teal/green time-energy aura. Clock imagery on the walls.
**Story:** Speed reading = speed action. Extra time from efficient study.

#### 17. Focus
**Concept:** The Delver in deep meditation, seated cross-legged, floating slightly off the ground. An open book hovers before them, its pages arranged in a mandala pattern. Everything around them is sharp and clear — the focus is palpable. Golden circles radiate outward.
**Story:** Deep focus reduces the cost of everything that follows.

#### 18. Double Strike
**Concept:** The Delver drawing two swords simultaneously from two books (like drawing swords from sheaths, but the sheaths are books). Twin energy trails of golden light. An enemy facing two incoming slashes. Dynamic X-pattern composition.
**Story:** Cross-referencing two sources for double the impact.

---

### DEBUFF CARDS (4)

#### 19. Weaken
**Concept:** The Delver reading aloud from a dark tome, purple sound-waves emanating from the book toward an enemy. The enemy is visibly wilting/shrinking under the verbal assault. The words themselves are visible as purple text floating in the air.
**Story:** A well-articulated argument weakens even the strongest opponent.

#### 20. Expose
**Concept:** The Delver pointing a magnifying glass at an enemy, revealing glowing weak points (like X-ray vision). The magnifying glass projects a cone of analytical light. The enemy's weak spots glow red/orange where revealed.
**Story:** Study reveals vulnerabilities.

#### 21. Hex
**Concept:** The Delver writing a curse on a scroll with green-glowing ink, then throwing the scroll at an enemy where it wraps around them like a binding. Green poison runes activate on contact. Academic setting — this is a "cursed assignment."
**Story:** Some homework is truly poisonous.

#### 22. Slow
**Concept:** The Delver tangling an enemy in a web of red tape/bureaucratic forms. The enemy is physically slowed by the weight of paperwork wrapping around their limbs. Stamp marks reading "PROCESSING" and "PENDING" visible.
**Story:** Bureaucracy — the ultimate debuff.

---

### UTILITY CARDS (4)

#### 23. Scout
**Concept:** The Delver peering through a telescope/spyglass into a glowing map/crystal projection of the dungeon ahead. Cards (actual playing-card-shaped objects) float toward their hand from the revealed area. Teal discovery energy.
**Story:** Research and reconnaissance — drawing cards is gathering intelligence.

#### 24. Recycle
**Concept:** The Delver reaching into a "RETURNS" box (library return slot) and pulling out glowing cards/books that were discarded. Around them, discarded papers float back together, reforming into useful cards. Green/teal restoration energy.
**Story:** Review what you've already learned — old knowledge returns to hand.

#### 25. Cleanse
**Concept:** The Delver dipping into a font/basin of clean water in a library sanctuary, purple debuff marks washing away from their body. Clean, purifying light. Teal and white energy. A serene moment in the dungeon.
**Story:** Sometimes you need to clear your mind before continuing.

#### 26. Foresight
**Concept:** The Delver reading a book that shows the near future — the next page reveals the enemy's upcoming attack plan as a translucent ghost image. Cards float toward the Delver from the prophetic vision. Third-eye imagery.
**Story:** Understanding the material well enough to predict what comes next.

---

### WILD CARDS (3)

#### 27. Mirror
**Concept:** The Delver standing before a full-length ornate mirror in a library hall. Their reflection shows them performing the LAST card type played (if it was attack, reflection swings sword; if shield, reflection holds shield). Prismatic rainbow energy connects real and reflection.
**Story:** Reflecting on what you just learned — repetition reinforces.

#### 28. Adapt
**Concept:** The Delver shapeshifting mid-pose — half of them shows attack stance, the other half shows shield stance, with one arm casting. A prismatic aura shows all possibilities simultaneously. Three ghostly versions of the Delver (attack/defend/utility) overlap.
**Story:** A well-rounded student adapts to any situation.

#### 29. Overclock
**Concept:** The Delver channeling so much energy that books fly open around them, pages turn rapidly, and a massive prismatic explosion radiates outward. The next card they play will be doubled. Their eyes glow with rainbow energy, runic bracers overloading with light.
**Story:** When you're in the zone — total flow state.

---

### PHASE 2 CARDS (2 additional)

#### 30. Transmute
**Concept:** The Delver at an alchemist's desk with bubbling flasks and open grimoires, transforming one card (being dissolved in a cauldron) into another (rising from the vapors, reforged). Lead to gold, but for knowledge.
**Story:** Transmutation of knowledge — what seems useless becomes powerful.

#### 31. Immunity
**Concept:** The Delver completely enclosed in a crystalline study bubble — a perfect sphere of protective knowledge. An enemy's attack shatters against it harmlessly. Inside, the Delver reads calmly. Total invulnerability through total understanding.
**Story:** Complete mastery means nothing can touch you.

---

## Part 3: NanoBanana Master Prompt Template

### Base Structure (customize per card):

```
POSITIVE:
pixel art card game illustration, 16-bit style,
adventurer-scholar character in leather armor with light plate pieces,
goggles on forehead, book satchel at hip, glowing quill behind ear,
runic bracers glowing {type_color},
{ACTION_DESCRIPTION},
dungeon library interior setting, stone walls with bookshelves,
warm torchlight from upper-left, {type_color} energy effects,
{KNOWLEDGE_ELEMENT_IN_SCENE},
heroic low-angle composition, action freeze-frame,
2px dark outline, 3-4 shade levels per color,
512x370 landscape aspect ratio, dynamic composition,
clean solid white background,
professional card game illustration quality

NEGATIVE:
photorealistic, painterly, smooth gradients, anti-aliased,
modern setting, transparent background, alpha channel,
full heavy plate armor, robes only, no armor,
cute, chibi, super deformed, anime,
static pose, boring composition, symmetrical,
text, watermark, title, card name baked in,
multiple protagonist characters, different character design,
3D render, photograph, blurry
```

### Type Color Reference:
- Attack: `red-orange energy, fire-like slash effects`
- Shield: `blue-cyan energy, protective barrier effects`
- Buff: `golden-amber energy, ascending aura effects`
- Debuff: `purple-dark energy, descending curse effects`
- Utility: `teal-green energy, revealing scanning effects`
- Wild: `prismatic rainbow energy, shifting color effects`

---

## Part 4: Implementation Steps

### 4.1 — Character Reference Sheet
- [ ] Generate 3-4 reference images of the Delver character from different angles
- [ ] Iterate until the protagonist design is locked (consistent across generations)
- [ ] Save reference images for use as style anchors in all subsequent generations

### 4.2 — Attack Card Art (7 cards)
- [ ] Generate: strike, multi_hit, heavy_strike, piercing, reckless, execute, lifetap
- [ ] Verify character consistency across all 7
- [ ] Verify red/orange effect color consistency
- [ ] Export at 512×370 WebP + 256×185 lowres WebP

### 4.3 — Shield Card Art (7 cards)
- [ ] Generate: block, thorns, emergency, fortify, parry, brace, overheal
- [ ] Verify blue/cyan effect consistency
- [ ] Export both resolutions

### 4.4 — Buff Card Art (4 cards)
- [ ] Generate: empower, quicken, focus, double_strike
- [ ] Verify golden/amber effect consistency
- [ ] Export both resolutions

### 4.5 — Debuff Card Art (4 cards)
- [ ] Generate: weaken, expose, hex, slow
- [ ] Verify purple/dark effect consistency
- [ ] Export both resolutions

### 4.6 — Utility Card Art (4 cards)
- [ ] Generate: scout, recycle, cleanse, foresight
- [ ] Verify teal/green effect consistency
- [ ] Export both resolutions

### 4.7 — Wild Card Art (3 cards)
- [ ] Generate: mirror, adapt, overclock
- [ ] Verify prismatic/rainbow effect consistency
- [ ] Export both resolutions

### 4.8 — Phase 2 Cards (2 cards)
- [ ] Generate: transmute, immunity
- [ ] Export both resolutions

### 4.9 — Integration
- [ ] Replace all files in `public/assets/cardframes/` (or move art to separate `cardart/` directory if using universal frame from AR-104)
- [ ] Update `cardFrameManifest.ts` with new paths/dimensions
- [ ] Verify all cards display correctly in-game
- [ ] Playwright screenshots of all 31 cards in hand and expanded views

---

## Part 5: Acceptance Criteria

1. **One consistent protagonist** visible across all 31 card arts (same character, same gear, identifiable at card size)
2. **One consistent setting** — all arts take place in dungeon-library variations
3. **Card type immediately readable** from the dominant effect color (red=attack, blue=shield, gold=buff, purple=debuff, teal=utility, rainbow=wild)
4. **Each card art tells a micro-story** that communicates the card's mechanical effect without reading text
5. **Knowledge theme is omnipresent** — books, scrolls, quills, formulas, runes visible in every piece
6. **Art style is consistent** — same pixel density, same outline weight, same color depth, same lighting
7. **Art fits cleanly in the frame's art window** (from AR-104 if done, or current frames if not)
8. **Readable at mobile card size** (~85px wide) — the action and color should be clear even tiny

## Files Affected
- `public/assets/cardframes/` — all 31 mechanic WebP files (replace or reorganize)
- `public/assets/cardframes/lowres/` — all 31 lowres variants
- `public/assets/cardframes/manifest.json` — update dimensions/paths
- `src/ui/utils/cardFrameManifest.ts` — update if paths change
- `docs/GAME_DESIGN.md` — update card visual section

## Verification Gate
- [ ] All 31 arts generated and exported in both resolutions
- [ ] Character consistency verified across all 31 (same Delver)
- [ ] `npm run build` passes
- [ ] Playwright screenshot of 5-card hand with mixed card types
- [ ] Playwright screenshot of expanded card view for each type
- [ ] Visual comparison: before vs. after (document improvement)
