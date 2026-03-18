# AR-99: Interactive Landing Page — Playable Combat Demo

## Overview

**Goal**: Replace the static recallrogue.com landing page with an interactive combat encounter that lets visitors experience the core gameplay loop — play cards, answer trivia, deal damage, kill an enemy — then converts them at the moment of peak engagement.

**Dependencies**: None (self-contained vanilla JS/CSS in the site repo)
**Complexity**: Medium-high (~2-3 sessions)
**Repository**: `/Users/damion/CODE/recall_rogue_site/`

## Design Vision

The page IS the game demo. Visitors don't read about the game — they play it.

### Flow (Start to Finish)

```
Page Load
  → Dungeon background fades in (bg_combat_dungeon.webp)
  → Title "RECALL ROGUE" shimmers in gold
  → "Bramblegate Games" subtitle
  → Brief 1-line pitch: "A card roguelite where knowing stuff wins fights."
  → Beat (0.5s)
  → Cave Bat slides in from right with HP bar (19 HP)
  → Gaia appears bottom-left: "See that? Tap a card. Trust me."
  → 5 cards fan up from bottom

Player taps card
  → Card lifts + flips → quiz question appears
  → 3 answer buttons (1 correct, 2 distractors)
  → Correct: card CHARGES → slams enemy → damage number flies → HP bar drains
    → Combo counter: ×2, ×3... glows brighter
    → Gaia: "Nice." / "Keep going!" / "That combo though."
  → Wrong: card fizzles → weak hit → combo resets
    → Gaia: "Oof. It happens."
  → Enemy telegraphs + attacks player between cards (HP bar on player side)

Enemy dies (scripted after ~5 cards)
  → Death animation (shake + fade)
  → Gold particles rain
  → Victory text slides up
  → Beat (1s)
  → Modal overlay:
    "That was a Cave Bat. Floor 1 of 20.
     There are Crystal Wardens, Shadow Hydras,
     and an Archivist who'll quiz you on things
     you didn't know you forgot.

     100,000+ facts. 12 knowledge domains.
     42 relics that break the game in weird ways.
     Coming 2026."

    [Get Notified]  [Wishlist on Steam]

Dismiss/signup → page scrolls to feature sections + existing content
```

## Sub-Steps

### 99.1 — Asset Pipeline (copy game assets to site repo)
Copy required assets from Recall_Rogue to recall_rogue_site/public/assets/:

**Enemy sprite:**
- `sprites/enemies/cave_bat_idle.webp` (hires version for desktop)
- `sprites/enemies/cave_bat_idle_1x.webp` (1x for mobile)

**Card frames (5 cards in the demo hand):**
- `cardframes/strike.webp` (Attack — Natural Sciences)
- `cardframes/heavy_strike.webp` (Attack — History)
- `cardframes/block.webp` (Shield — Geography)
- `cardframes/piercing.webp` (Attack — Mythology)
- `cardframes/focus.webp` (Utility — Animals & Wildlife)

**Lowres versions for the hand fan:**
- `cardframes/lowres/strike.webp`
- `cardframes/lowres/heavy_strike.webp`
- `cardframes/lowres/block.webp`
- `cardframes/lowres/piercing.webp`
- `cardframes/lowres/focus.webp`

**Card type icons:**
- `sprites-hires/icons/icon_cardtype_attack.webp`
- `sprites-hires/icons/icon_cardtype_shield.webp`
- `sprites-hires/icons/icon_cardtype_utility.webp`

**Domain icons (5 domains in demo):**
- `sprites-hires/icons/icon_domain_general_knowledge.webp`
- `sprites-hires/icons/icon_domain_animals_wildlife.webp`
- `sprites-hires/icons/icon_domain_mythology_folklore.webp`
- `sprites-hires/icons/icon_domain_space_astronomy.webp`
- `sprites-hires/icons/icon_domain_human_body_health.webp`

**Background:**
- `backgrounds/combat/bg_combat_dungeon.webp`

**Gaia (guide character):**
- `sprites-hires/gaia/gaia_neutral.webp`
- `sprites-hires/gaia/gaia_happy.webp`
- `sprites-hires/gaia/gaia_snarky.webp`

**Logo:**
- `boot/logo.webp`

**Acceptance**: All assets copied, all WebP, total < 2MB.

---

### 99.2 — Combat State Machine (JavaScript)

A self-contained encounter engine in vanilla JS. No frameworks, no build step.

**State flow:**
```
IDLE → INTRO_ANIM → HAND_DEALT → AWAITING_CARD_TAP → QUIZ_SHOWN →
  (correct) → CHARGE_HIT → ENEMY_TURN → check_death → AWAITING_CARD_TAP
  (wrong)  → FIZZLE_HIT → ENEMY_TURN → check_death → AWAITING_CARD_TAP
  (enemy_dead) → VICTORY → MODAL
```

**Encounter data (hardcoded JSON):**
```javascript
const ENCOUNTER = {
  enemy: {
    name: 'Cave Bat',
    maxHP: 38,
    sprite: 'assets/enemies/cave_bat_idle.webp',
    attacks: [
      { damage: 4, telegraph: 'Swooping strike' },
      { damage: 6, telegraph: 'Frenzied bite' },
    ],
  },
  player: { maxHP: 60 },
  cards: [
    {
      id: 1,
      mechanic: 'Strike',
      frame: 'assets/cardframes/strike.webp',
      frameLowres: 'assets/cardframes/lowres/strike.webp',
      type: 'attack',
      typeIcon: 'assets/icons/icon_cardtype_attack.webp',
      domain: 'Natural Sciences',
      domainColor: '#10B981',
      domainIcon: 'assets/icons/icon_domain_natural_sciences.webp',
      quickDamage: 8,
      chargeDamage: 24,
      wrongDamage: 6,
      quiz: {
        question: 'What is the only planet in our solar system that rotates clockwise?',
        correct: 'Venus',
        distractors: ['Mars', 'Neptune'],
        explanation: "Venus rotates backwards compared to most planets — a phenomenon called retrograde rotation. A day on Venus is longer than its year.",
      },
    },
    {
      id: 2,
      mechanic: 'Heavy Strike',
      frame: 'assets/cardframes/heavy_strike.webp',
      frameLowres: 'assets/cardframes/lowres/heavy_strike.webp',
      type: 'attack',
      typeIcon: 'assets/icons/icon_cardtype_attack.webp',
      domain: 'History',
      domainColor: '#0EA5E9',
      domainIcon: 'assets/icons/icon_domain_history.webp',
      quickDamage: 10,
      chargeDamage: 30,
      wrongDamage: 7,
      quiz: {
        question: 'In what year did the Berlin Wall fall?',
        correct: '1989',
        distractors: ['1991', '1985'],
        explanation: "The Berlin Wall fell on November 9, 1989, after 28 years of dividing East and West Berlin. Guards opened the gates after a confused press conference.",
      },
    },
    {
      id: 3,
      mechanic: 'Block',
      frame: 'assets/cardframes/block.webp',
      frameLowres: 'assets/cardframes/lowres/block.webp',
      type: 'shield',
      typeIcon: 'assets/icons/icon_cardtype_shield.webp',
      domain: 'Geography',
      domainColor: '#F59E0B',
      domainIcon: 'assets/icons/icon_domain_geography.webp',
      quickDamage: 6, // block value
      chargeDamage: 18,
      wrongDamage: 4,
      quiz: {
        question: 'What is the smallest country in the world by area?',
        correct: 'Vatican City',
        distractors: ['Monaco', 'San Marino'],
        explanation: "Vatican City is just 0.44 km² — about 1/8 the size of Central Park. It has its own postal service, radio station, and railway.",
      },
    },
    {
      id: 4,
      mechanic: 'Piercing',
      frame: 'assets/cardframes/piercing.webp',
      frameLowres: 'assets/cardframes/lowres/piercing.webp',
      type: 'attack',
      typeIcon: 'assets/icons/icon_cardtype_attack.webp',
      domain: 'Mythology & Folklore',
      domainColor: '#8B5CF6',
      domainIcon: 'assets/icons/icon_domain_mythology_folklore.webp',
      quickDamage: 7,
      chargeDamage: 21,
      wrongDamage: 5,
      quiz: {
        question: 'In Greek mythology, what creature had snakes for hair and could turn people to stone?',
        correct: 'Medusa',
        distractors: ['Echidna', 'Scylla'],
        explanation: "Medusa was one of three Gorgon sisters, and the only mortal one. Perseus defeated her by using his shield as a mirror to avoid her gaze.",
      },
    },
    {
      id: 5,
      mechanic: 'Focus',
      frame: 'assets/cardframes/focus.webp',
      frameLowres: 'assets/cardframes/lowres/focus.webp',
      type: 'utility',
      typeIcon: 'assets/icons/icon_cardtype_utility.webp',
      domain: 'Animals & Wildlife',
      domainColor: '#22C55E',
      domainIcon: 'assets/icons/icon_domain_animals_wildlife.webp',
      quickDamage: 5,
      chargeDamage: 15,
      wrongDamage: 3,
      quiz: {
        question: 'How many hearts does an octopus have?',
        correct: 'Three',
        distractors: ['Two', 'Five'],
        explanation: "Octopuses have one main heart that pumps blood to the body, and two branchial hearts that pump blood through the gills. The main heart stops beating when they swim — so they prefer crawling.",
      },
    },
  ],
};
```

**Scripted balance**: The Cave Bat has 38 HP (buffed from in-game 19 HP to make the demo last longer). With 5 cards averaging ~8-24 damage on charge, the encounter should last all 5 cards with most correct answers — giving the visitor the full hand experience. The enemy attacks between each card for 4-6 damage (telegraphed), making the player's 60 HP comfortable but not trivially safe. If the visitor gets 3-4 correct, the bat dies on card 5. If they ace everything, it might die on card 4 — either way the fight has weight.

**Fact pool (20 facts, deal 5 per round):**
The encounter data above shows 5 example cards. The actual implementation should have a pool of 20 facts across all domains. On each play (including "Fight Again"), shuffle the pool and deal 5 random cards. This gives 4 unique encounters before any repeats.

Additional 15 facts for the pool:

| # | Domain | Mechanic | Question | Correct | Distractors |
|---|--------|----------|----------|---------|-------------|
| 6 | Food & Cuisine | Reckless | What spice comes from the Crocus sativus flower? | Saffron | Turmeric, Paprika |
| 7 | Space & Astronomy | Double Strike | What planet in our solar system has the most moons? | Saturn | Jupiter, Uranus |
| 8 | Human Body | Empower | What is the hardest substance in the human body? | Tooth enamel | Bone, Fingernails |
| 9 | General Knowledge | Multi Hit | What is the most widely spoken first language on Earth? | Mandarin Chinese | English, Spanish |
| 10 | Art & Architecture | Execute | Who painted the ceiling of the Sistine Chapel? | Michelangelo | Raphael, Leonardo da Vinci |
| 11 | Natural Sciences | Thorns | What gas do plants absorb from the atmosphere during photosynthesis? | Carbon dioxide | Oxygen, Nitrogen |
| 12 | History | Overclock | Which ancient wonder was located in Alexandria, Egypt? | The Lighthouse | The Colossus, The Hanging Gardens |
| 13 | Animals & Wildlife | Lifetap | What is the fastest land animal? | Cheetah | Peregrine falcon, Pronghorn |
| 14 | Geography | Fortify | What is the longest river in Africa? | Nile | Congo, Niger |
| 15 | Mythology | Hex | In Norse mythology, what tree connects the nine worlds? | Yggdrasil | Irminsul, Glasir |
| 16 | Space & Astronomy | Piercing | What is the closest star to Earth after the Sun? | Proxima Centauri | Alpha Centauri A, Sirius |
| 17 | Human Body | Block | How many bones does an adult human have? | 206 | 186, 256 |
| 18 | Food & Cuisine | Strike | What country does the dish sushi originate from? | Japan | China, South Korea |
| 19 | History | Heavy Strike | Who was the first person to walk on the Moon? | Neil Armstrong | Buzz Aldrin, Yuri Gagarin |
| 20 | Animals & Wildlife | Focus | What is the largest living species of lizard? | Komodo dragon | Saltwater crocodile, Green iguana |

Each fact maps to a card mechanic and domain color. On "Fight Again", shuffle, deal 5 new ones, reset Cave Bat to 38 HP, reset player to 60 HP.

**Combo system**: Track consecutive correct answers. Display combo multiplier (×2, ×3...) with escalating glow. Each combo step adds +25% to displayed damage (visual only — don't overcomplicate the JS, just multiply the floating damage number).

**Acceptance**: State machine handles all transitions without errors. Cards can be tapped, quiz appears, answers register, damage applies, enemy dies, victory shows.

---

### 99.3 — Card Hand UI (CSS)

The card hand fans 5 cards across the bottom of the viewport.

**Card layout:**
- Cards are positioned absolutely in a `.card-hand` container
- Fan angle: cards rotated from -12° to +12° in 6° increments
- Hover/tap: card lifts 20px, scales 1.05×, rotation straightens to 0°
- Each card shows:
  - Card frame image (lowres WebP) as background
  - Domain color tint (CSS filter or overlay)
  - Small domain icon in top-left corner
  - Card type icon in top-right corner
  - Mechanic name at bottom

**Card flip animation:**
- On tap: card lifts to center of screen
- Flip animation (CSS perspective transform, 0.4s)
- Back of card → quiz question face
- Quiz face shows: question text, 3 answer buttons, domain color accent

**Charge hit animation:**
- Correct answer → card glows gold → flies toward enemy
- Damage number floats up from enemy (gold, bold, "+24")
- Enemy sprite shakes (CSS transform wiggle, 0.3s)
- HP bar drains smoothly (CSS transition, 0.5s)

**Fizzle animation:**
- Wrong answer → card dims red → limps toward enemy
- Small damage number (grey, "+6")
- Enemy shakes less

**Mobile responsive:**
- Cards: 60px wide on mobile, 90px on desktop
- Quiz panel: full-width overlay on mobile, centered modal on desktop
- Touch targets: answer buttons min 48px tall

**Acceptance**: Hand renders correctly on 375px (iPhone SE) through 1440px (desktop). Cards are tappable. Animations smooth at 60fps.

---

### 99.4 — Enemy Display & HP Bar

**Enemy area** (upper portion of screen):
- Dungeon background (bg_combat_dungeon.webp) fills the encounter viewport
- Cave Bat sprite centered, ~150px on mobile, ~250px on desktop
- Subtle idle animation: CSS float (translateY oscillation, 2s ease-in-out infinite)
- HP bar below sprite: gold fill on dark track, number overlay ("19/19")
- Name label above sprite in Cinzel font

**Enemy attack sequence** (between player cards):
- Telegraph text appears above enemy: "Swooping strike" (0.8s fade-in)
- Beat (0.5s)
- Enemy lunges toward player (CSS translateX, 0.3s)
- Damage number floats on player HP bar ("-4", red)
- Player HP bar drains
- Enemy returns to position

**Death animation:**
- Final hit: enemy shakes violently (0.5s)
- Fade to 0 opacity while scaling down
- Gold particle burst (CSS pseudo-elements with randomized positions)

**Acceptance**: Enemy displays with idle animation. HP bar updates on damage. Death looks satisfying.

---

### 99.5 — Gaia Guide Character

Gaia appears as a small sprite in the bottom-left, above the card hand.

**Dialogue system:**
- Speech bubble (CSS, dark bg with gold border, max-width 220px)
- Text appears letter-by-letter (typewriter effect, 30ms/char)
- Gaia's sprite swaps based on context:
  - `gaia_neutral.webp` — default, instructions
  - `gaia_happy.webp` — correct answer, combo, victory
  - `gaia_snarky.webp` — wrong answer, enemy attacks

**Trigger lines:**

| Trigger | Gaia Sprite | Line |
|---------|-------------|------|
| Encounter start | neutral | "See that? Tap a card. Trust me." |
| First correct | happy | "That's the idea. Card charged, enemy hurt." |
| Combo ×2 | happy | "Two in a row. Damage is climbing." |
| Combo ×3+ | happy | "Now you're getting dangerous." |
| Wrong answer | snarky | "Oof. Wrong answer — weak hit, combo gone." |
| Enemy attacks | neutral | (no line — let the action speak) |
| Victory | happy | "Not bad for a first floor." |

**Acceptance**: Gaia appears, swaps expressions, speech bubble works. Doesn't obstruct cards.

---

### 99.6 — Victory Modal & Email CTA

After the Cave Bat dies:

**Sequence:**
1. Death animation (0.5s)
2. Gold particles (1s)
3. "VICTORY" text in Cinzel, gold gradient, scales in (0.3s)
4. Beat (1.5s — let it breathe)
5. Modal slides up from bottom:

```
┌─────────────────────────────────────────┐
│                                         │
│  That was a Cave Bat. Floor 1 of 20.   │
│                                         │
│  There are Fossil Guardians that get    │
│  stronger when you don't answer.        │
│  Shadow Mimics that throw your wrong    │
│  answers back at you. And a Curator     │
│  with a rapid-fire quiz phase that      │
│  most people don't survive.             │
│                                         │
│  100,000+ facts across 12 domains.      │
│  42 relics. 25-minute runs.             │
│  Coming 2026 to Mobile and Steam.       │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  your@email.com     [Notify Me] │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Wishlist on Steam]                    │
│                                         │
│  One email at launch. Unsubscribe       │
│  whenever.                              │
│                                         │
│  ─────────────────────────────────────  │
│          [⚔️ Fight Again]               │
│  Different facts each time.             │
│                                         │
└─────────────────────────────────────────┘
```

**The email form uses the same `/api/subscribe` endpoint** — no worker changes needed.

**After signup**: modal thanks user, then fades down to reveal the rest of the page (existing feature sections, social links, footer). The page is still scrollable behind the encounter area.

**Acceptance**: Modal appears after victory. Email form submits successfully to /api/subscribe. Page scrolls to content after dismiss.

---

### 99.7 — Page Structure & Scroll Layout

The page has two sections:

**Section 1: The Encounter (100vh)**
- Fixed viewport height
- Contains: dungeon bg, enemy, card hand, Gaia, player HP
- **"Skip to signup →"** link in top-right corner (subtle, semi-transparent) for returning visitors
- This is the "above the fold" experience — no scrolling needed
- After victory + modal dismiss, a subtle "scroll down" indicator appears

**Section 2: Feature Content (scrollable)**
- Existing feature cards (Quick Play or Charge, Knowledge Chains, 100k+ Facts, Roguelite Depth)
- Add new cards:
  - "12 Knowledge Domains" — show the domain color grid with icons
  - "70+ Enemies" — show a grid of 6-8 enemy sprites as a teaser
  - "Spaced Repetition" — the cards you play worst come back. You literally get smarter.
- Email signup section (duplicate of modal form, for people who dismissed)
- Social links, footer

**Acceptance**: Page scrolls smoothly from encounter to content. Feature sections render correctly. No layout shift.

---

### 99.8 — Performance & Polish

**Asset loading:**
- Preload critical assets: dungeon bg, cave bat sprite, 5 card frames (lowres), Gaia neutral
- Lazy load: Gaia happy/snarky, hires card frames (not needed)
- Total initial payload target: < 800KB (excluding fonts)
- Show a brief loading shimmer while assets load, then fade into encounter

**Animations:**
- All animations use CSS transforms + opacity (GPU-composited, no layout thrashing)
- `will-change: transform` on animated elements
- `prefers-reduced-motion` media query: skip animations, show static encounter instead

**Sound (optional, future):**
- No sound in v1. Structure allows adding later via Web Audio API.
- Could add: card whoosh, hit thud, victory fanfare

**Browser support:**
- Modern browsers only (CSS grid, `aspect-ratio`, WebP, CSS transforms)
- Graceful degradation: if JS disabled, show static screenshot + email form

**Acceptance**: Lighthouse performance score > 90. No layout shift. Loads in < 2s on 4G.

---

### 99.9 — Feature Section Enhancements

Add two new feature cards to the existing grid:

**"70+ Unique Enemies"**
- Show a 4×2 grid of enemy sprites (cave_bat, crystal_golem, toxic_spore, shadow_mimic, the_archivist, crystal_warden, knowledge_golem, void_weaver)
- Use the 1x WebP versions (small, fast)
- Each sprite subtly bobs on hover
- Text: "From Cave Bats to The Curator. Each enemy fights differently, and some of them fight back when you answer wrong."

**"12 Knowledge Domains"**
- Show colored pills/badges for each domain with their icon
- Natural Sciences, History, Geography, Mythology, Animals, Space, Food, Art, Human Body, General Knowledge, Capitals & Flags, Language
- Text: "Pick what you're curious about. Every fact becomes a card. Every card becomes a weapon."

**Acceptance**: New feature cards render in the grid. Enemy sprites load. Domain badges show correct colors.

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `public/index.html` | **Major rewrite** | Replace static page with encounter + content sections |
| `public/assets/` | **New directory** | Game assets (sprites, cardframes, backgrounds, icons) |
| `src/worker.js` | **No change** | API endpoints stay the same |
| `wrangler.toml` | **No change** | Config stays the same |

## Verification Gate

- [ ] Page loads in < 2s on simulated 4G (Lighthouse)
- [ ] Encounter plays through: tap card → quiz → answer → damage → enemy dies → modal
- [ ] Email signup works from victory modal (test with real POST to /api/subscribe)
- [ ] Mobile responsive: 375px, 414px, 768px, 1440px all look correct
- [ ] All card frames render without broken images
- [ ] Gaia dialogue triggers correctly at each state
- [ ] Combo counter increments and resets properly
- [ ] Enemy HP bar drains smoothly
- [ ] Victory modal copy is compelling and accurate
- [ ] Feature sections below encounter render correctly
- [ ] "Fight Again" deals a different hand of 5 from the 20-fact pool
- [ ] "Skip to signup →" link scrolls to signup section
- [ ] No console errors
- [ ] `prefers-reduced-motion` shows static fallback
- [ ] Cloudflare deploy succeeds (preview first, then production after review)

## Decisions (confirmed by user)

1. **Enemy**: Cave Bat with **38 HP** (doubled from in-game 19) so the fight lasts the full hand of 5 cards.
2. **Player HP**: YES — shown with 60 HP, enemy attacks between cards for 4-6 damage. Adds tension.
3. **Play Again**: YES — pool of 20 facts, deal random 5 each round. "Fight Again" button on victory modal. Different facts each time encourages replaying.
4. **Sound**: Skip for v1. No audio.
5. **Skip demo**: YES — small "Skip to signup →" link in top-right corner for returning visitors.
