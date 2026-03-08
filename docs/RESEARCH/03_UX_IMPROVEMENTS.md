# Terra Miner — Design Addendum: Portrait UX, Room Selection, and Non-Obvious Improvements

## For: Coding Agent Implementation (companion to main spec)
## Version: 1.0 — March 2026

---

## 1. Portrait Mode Layout — The Split-Stage Design

Portrait mode is correct. 94% of smartphone users hold their phones vertically. 49% use one hand, 75% of all interactions are thumb-driven. Clash Royale's portrait mode is specifically cited as why it's more playable one-handed than Clash of Clans (landscape). Slay the Spire's mobile port received repeated complaints about small text and janky card selection because it was a landscape PC game squeezed into mobile — their #1 negative review pattern on both iOS and Android.

The screen should be divided into two permanent zones, borrowing from what casino mobile designers call the "Split-Stage" pattern:

**Top half (Display Zone — 55% of screen):** Enemy sprite, enemy HP bar, enemy intent telegraph, floor/encounter counter, player HP bar, active passive relics from mastered cards. This zone is for LOOKING, not touching. No interactive elements here. Tap accuracy in the top third of screens drops to 61% vs 96% in the bottom third.

**Bottom half (Interaction Zone — 45% of screen):** Card hand (fanned arc), answer buttons when a card is selected, skip/hint buttons, end turn button. ALL interactive elements live here, within natural thumb reach. The card hand should sit in the bottom 25-40% of the screen — the "natural zone" where tap accuracy is highest and no grip adjustment is needed.

**Key measurements:**
- Touch targets minimum 48x48dp (Google Material Design guideline)
- Card tap targets should be 60x80dp minimum (larger than standard because cards are the primary interaction)
- Answer buttons should be full-width with 56dp height minimum and 8dp spacing between them
- No interactive element above the screen's vertical midpoint
- Leave 16dp safe area at screen bottom for gesture navigation bars

**Card Hand Layout:**
- 5 cards in a fanned arc along the bottom edge
- Cards overlap slightly (showing ~60% of each card's width)
- Tapping a card slides it upward and expands it to show the question
- Other cards dim and slide down slightly to avoid accidental taps
- Swiping a selected card back down = deselect (cancel)
- This is critical: Slay the Spire mobile's biggest complaint was accidentally playing cards when trying to deselect. Use a two-step confirm: tap to select (card rises, question shows), tap answer to play. Tapping elsewhere or swiping down = cancel.

---

## 2. The Room Selection Question — Yes, But Simplified

The Slay the Spire branching map is one of the most praised design elements in modern roguelites. It creates meaningful choice, risk assessment, and a sense of agency. However, the full STS map (15+ nodes per act, 3-4 paths, visible icons) is too information-dense for a mobile educational game played in 5-minute sessions.

**Do this: Simplified 3-choice room selection between each encounter.**

After each encounter (not each floor — this is the key difference from STS), the player sees three doors/paths and picks one:

```
┌─────────────────────┐
│   [Enemy: Golem]    │  ← Top half shows upcoming rooms
│   [?? Mystery]      │
│   [Rest: Heal 30%]  │
│                     │
│ ─── Choose Path ─── │
│                     │
│  [Golem] [??] [Rest]│  ← Bottom half has tap targets
│                     │
│   Current HP: 45/80 │
│   Floor 2/3         │
└─────────────────────┘
```

**Room types and their icons (immediately recognizable):**
- Sword icon = Combat encounter (guaranteed card reward)
- Question mark = Mystery event (random: could be good, bad, or choice)
- Heart icon = Rest (heal 30% HP OR upgrade one card)
- Coin/chest icon = Treasure (free card/artifact, no combat)
- Shop bag icon = Shop (spend currency, buy/remove cards)

**Why this works better than a full map for this game:**
1. Decision takes 2-3 seconds, not 15-30 seconds studying a branching map
2. Only 3 options reduces cognitive load (critical for an educational game already taxing working memory)
3. Each choice has immediate, visible consequences (the STS map requires planning 5+ moves ahead)
4. Still creates meaningful risk/reward: low HP? Pick rest. Confident? Pick combat for better rewards. Feeling lucky? Pick mystery.

**Why not a full STS map:**
- STS maps show the entire act structure upfront. Players spend significant time path-planning. This works for 45-minute PC sessions but not 5-minute mobile sessions.
- The full map requires scrolling on mobile portrait screens, breaking thumb-zone principles.
- Educational games need to minimize time NOT spent on learning. Map study time is zero-learning time.
- The 3-choice system preserves 80% of the agency value at 20% of the cognitive cost.

**Reveal rules:**
- Combat rooms always show the enemy type (so players can assess risk)
- Mystery rooms are always hidden (that's the fun)
- Rest, Treasure, and Shop rooms are always clearly labeled
- Each floor of 3 encounters guarantees at least 1 combat room in the options (prevents heal-stacking to avoid all facts)

---

## 3. Game Juice — The Correct Answer Should Feel INCREDIBLE

This is where most educational games fail catastrophically. Getting an answer right in Duolingo feels like... nothing. A green checkmark. Getting an answer right in Terra Miner should feel like landing a critical hit in your favorite action game.

**Correct Answer Juice Stack (all fire within 200ms of correct tap):**
1. **Haptic pulse** — short, crisp vibration (iOS: UIImpactFeedbackGenerator.style.heavy, Android: VibrationEffect.createOneShot(50, 200)). NOT a buzz — a single sharp thud.
2. **Screen flash** — brief white overlay at 30% opacity, fading over 150ms
3. **Damage numbers** — the effect value flies from the card to the enemy in a satisfying arc, with a slight bounce on impact. Gold text for normal, red text for critical (speed bonus).
4. **Card animation** — the card launches upward from the hand with a streak trail, rotates slightly, then dissolves into particles that fly toward the enemy
5. **Enemy hit reaction** — brief knockback (5px displacement), red flash, HP bar depletes with a smooth animation (not instant)
6. **Sound** — a crisp, satisfying impact sound. Think the "ding" of a correct Wordle letter times the punch sound from a fighting game. Short, sharp, rewarding.
7. **Combo counter** — if 2+ correct answers in a row, show a combo counter with escalating visual intensity. 3 in a row = small text. 5 in a row = larger text with particle ring. Perfect turn (all 5 correct) = screen-wide celebration burst.

**Wrong Answer Juice (intentionally muted — shame is the enemy of learning):**
1. **Haptic** — gentle double-tap vibration, like a soft "nuh-uh"
2. **Card animation** — card dims, cracks appear, it dissolves downward (not aggressively — think sand falling, not glass breaking)
3. **Correct answer reveal** — slides in from the bottom, highlighted in gentle blue, lingers for 2 seconds
4. **Sound** — a soft, low tone. Not a buzzer. Think the "wrong note" in a music game — noticeable but not punishing
5. **No screen shake, no red flash, no damage numbers** — the absence of positive juice IS the feedback

**Why this matters beyond "game feel":** Research on operant conditioning shows that the intensity of positive reinforcement directly correlates with behavior repetition rate. Making correct answers viscerally satisfying creates a dopamine loop tied specifically to recalling facts correctly. Over time, the player's brain associates fact recall with the dopamine hit of the juice stack. This is the same mechanism that makes slot machines addictive — but directed toward learning. Vampire Survivors' creator explicitly referenced gambling psychology as his design foundation.

---

## 4. The "Knowledge Combo" System — Rewarding Streaks Within a Turn

This is a mechanic I haven't seen in any educational game, and it maps directly to the card roguelite format.

**Mechanic:** Each consecutive correct answer in a single turn increases a combo multiplier:

| Correct in a Row | Multiplier | Visual |
|-----------------|------------|--------|
| 1st card | 1.0x | Normal effect |
| 2nd card | 1.15x | Slight glow on card border |
| 3rd card | 1.3x | Brighter glow, small particle ring |
| 4th card | 1.5x | Strong glow, screen edges pulse |
| 5th card (perfect turn) | 2.0x | Full celebration, all cards in hand glow gold |

**A wrong answer resets the combo to 1.0x.** This creates micro-tension within every single turn — do you play the hard card first (risk breaking the combo early) or save it for last (risk the combo dying on card 4)?

**Strategic depth this creates:**
- Play easy facts first to build combo, then let the multiplier boost your hard cards at the end
- OR play hard facts first because their base power is already higher (from difficulty-proportional scaling), accepting combo risk
- Card ordering becomes a strategic decision that rewards metacognitive awareness ("I'm confident about cards 1-3, less sure about 4-5")

**This is uniquely possible in an educational card game.** No other card roguelite has a combo system tied to player knowledge confidence. It's a mechanic that literally cannot exist outside this genre.

---

## 5. "Mineral Veins" — Bonus Objectives Per Run

Each run should have 1-2 randomly selected bonus objectives visible at the start, offering bonus rewards if completed. These add variety without adding complexity — they're optional goals that modify play behavior.

**Examples:**
- "Iron Vein: Answer 5 Science facts correctly" → Bonus: +1 card reward at next shop
- "Gold Rush: Complete 3 encounters without wrong answers" → Bonus: Rare artifact
- "Deep Core: Reach Floor 6" → Bonus: 50% extra currency
- "Speed Miner: Answer 10 facts in under 3 seconds each" → Bonus: Card upgrade token
- "Scholar's Path: Play cards from 4 different domains in one run" → Bonus: Unlock new domain preview
- "Flawless Vein: Perfect turn (5/5 correct) at least once" → Bonus: Cosmetic card frame

**Why this works:** Duolingo's quest system (complete X lessons this week) is one of their highest-engagement features. Bonus objectives give the same "I have a goal beyond just surviving" motivation. They also naturally push players to engage with different domains and difficulty levels they might otherwise avoid.

---

## 6. The "Fossil" Discovery System — Narrative Reward for Mastery Milestones

When a player masters their 10th, 25th, 50th, 100th, etc. fact, they should discover a "Fossil" — a short, fascinating piece of contextual information that connects multiple facts they've learned into a bigger picture.

**Example:** After mastering 10 Chemistry facts, the player discovers: "Fossil Fragment: The Alchemist's Dream — For centuries, alchemists tried to turn lead (atomic number 82) into gold (atomic number 79). They failed because transmuting elements requires nuclear reactions, not chemical ones. In 1980, scientists finally succeeded using a particle accelerator — but the gold cost $1 quadrillion per ounce to produce."

**This serves multiple purposes:**
1. Milestone celebration (mastery feels rewarded with exclusive content)
2. Elaborative encoding — connecting isolated facts into a narrative structure improves long-term retention by 40-60% (research on elaborative interrogation, Pressley et al., 1987)
3. Shareable content — "Look at this cool thing I unlocked" is inherently viral
4. Collection motivation — "I want to see what the next Fossil reveals"

Fossils should be beautifully presented — full-screen, with pixel art illustration, atmospheric sound, and a "share" button. These are the TikTok moments.

---

## 7. Daily "Excavation" Challenge — One Special Run Per Day

One curated run per day with special rules and a global leaderboard. This is the "Daily Challenge" pattern used by Slay the Spire, Wordle, and many others. It's the single highest-retention feature across all puzzle/strategy mobile games.

**Structure:**
- Same seed for all players (everyone faces the same encounters, same cards, same facts)
- Score = accuracy % × speed bonus × floor reached × combo multiplier
- Results posted to a daily leaderboard
- Can only attempt once per day (creates appointment gaming)
- Rewards: cosmetic badge for participation, bonus rewards for top 10%/25%/50% tiers

**Why this is critical for retention:**
- Wordle's entire viral success was built on one-a-day appointment gaming
- Slay the Spire's daily climb is one of its most-played modes
- Creates social comparison without direct PvP (players compete against the same challenge)
- Generates daily content without developer effort (procedurally generated from existing fact pool)
- The "did you beat today's Excavation?" conversation is organic marketing

---

## 8. The "Echo" Mechanic — Wrong Answers Come Back

When you get a fact wrong during a run, that fact has a 70% chance of reappearing later in the same run as an "Echo" card — a ghostly version of the original card with slightly reduced power but the same question.

**Why this is brilliant for learning:**
- Immediate re-testing after failure is one of the most effective spaced repetition micro-patterns (Karpicke & Roediger, 2008 — the "testing effect")
- The player gets a second chance at the same fact while it's still fresh
- Emotionally redemptive — "I got it wrong before, but I remember now" feels great
- Creates a natural difficulty mechanic: poor performance means more Echoes in your deck, diluting your hand with weaker cards. But each Echo you answer correctly removes it AND strengthens the original fact's SM-2 score.

**Visual:** Echo cards have a translucent/ghostly appearance — clearly distinct from normal cards. They shimmer slightly. When answered correctly, they solidify into a brief golden flash before disappearing.

---

## 9. The "Canary" Warning System — Adaptive Difficulty in Real-Time

Named after the canary in the coal mine — an early warning system.

If the player gets 3+ facts wrong in a single floor, the game should SUBTLY adjust:
- Reduce timer pressure by 2 seconds for the next encounter
- Bias the next hand draw toward easier facts (higher SM-2 ease factor)
- Reduce enemy damage by 10-15% for the next encounter
- Show the hint button more prominently

If the player gets 5+ facts correct in a row, SUBTLY increase:
- Add speed bonus opportunities (shorter timer thresholds for bonus damage)
- Bias next draw toward harder facts
- Introduce elite enemy variant for the next encounter (more HP, better rewards)

**This should be completely invisible to the player.** No "difficulty adjusted" notification. No visible setting change. The game just... flows better. Research on dynamic difficulty adjustment (Hunicke, 2005) shows that invisible adjustment preserves flow state while preventing both frustration spirals and boredom plateaus.

**Critical constraint:** The Canary system adjusts GAME difficulty (timers, enemy stats) but NEVER reduces educational rigor. It never shows fewer answer options, never provides free passes, and never skips facts. The learning standard remains constant; only the combat wrapper flexes.

---

## 10. Sound Design Priorities — What to Build First

Sound is disproportionately important for game feel on mobile. Players often play without sound, but those who play WITH sound retain at 1.5-2x the rate (internal data from multiple mobile game postmortems).

**Priority 1 (prototype must have):**
- Correct answer impact sound (sharp, satisfying)
- Wrong answer soft tone
- Card draw swoosh
- Enemy hit reaction
- Enemy death sound
- Turn start chime

**Priority 2 (soft launch):**
- Ambient mine/underground atmosphere loop (low, unobtrusive)
- Boss encounter music (tension-building)
- Combo counter escalating sounds (3-combo, 5-combo, perfect turn)
- UI navigation taps
- Cash-out-or-continue tension music

**Priority 3 (post-launch):**
- Unique sounds per card type (attack swoosh vs shield clank vs heal shimmer)
- Environmental floor themes (ice mine, magma mine, crystal cave)
- Mastery tier-up celebration sound
- Fossil discovery reveal

**All sounds should have a master volume slider AND individual category toggles.** Many mobile players play on public transit — they need granular audio control. Consider supporting system haptics even when sound is muted.

---

## 11. Accessibility Features — Design for Now, Not Later

These should be in the prototype, not added post-launch:

**Visual:**
- Colorblind mode (card types distinguished by shape/icon, not just color)
- Text size options (3 levels: normal, large, extra large)
- High contrast mode (stronger borders, darker backgrounds behind text)
- Reduce motion option (disables screen shake, particle effects, card animations — keeps haptics)

**Motor:**
- All card interactions use single tap only (no swipe-to-play, no drag-and-drop)
- Minimum touch target 48x48dp everywhere, 60x80dp for cards
- Timer can be disabled entirely in Explorer difficulty mode
- No time-critical inputs outside of the optional speed bonus

**Cognitive:**
- Explorer mode removes wrong-answer consequences beyond fizzle
- Hint system provides scaffolding without removing the question
- Card effects shown numerically AND with visual indicators (shield icon + number, not just number)
- Question text uses clear, simple language (aim for 6th grade reading level on "all ages" facts)

**Why at prototype stage:** Apple and Google both factor accessibility into editorial featuring decisions. Apple's "Apps We Love" features disproportionately highlight accessible apps. Building this in from day one is both ethical and strategic.

---

## 12. The "Miner's Log" — Post-Run Summary Screen

After every run, show a summary that serves both as gameplay satisfaction and invisible learning analytics:

```
┌──────────────────────────┐
│    EXPEDITION COMPLETE   │
│                          │
│  Floor Reached: 6/9      │
│  Facts Answered: 42      │
│  Accuracy: 81%           │
│  Best Combo: 4x          │
│  New Facts Learned: 7    │
│  Facts Mastered: 2 ↑     │
│                          │
│  ★ Bonus: Iron Vein ✓    │
│                          │
│  [Cards Earned] [Share]  │
│  [Play Again]  [Home]    │
└──────────────────────────┘
```

**The "Share" button generates a card-style image:**
"I just explored Floor 6 of Terra Miner, answered 42 facts with 81% accuracy, and mastered 2 new concepts. How deep can you go?"

This is the organic viral loop. It's the same pattern as Wordle's colored grid shares — it communicates achievement without spoiling content, and it makes people curious.

---

## 13. Portrait Card Design — Physical Dimensions

For portrait mobile (approximately 390x844pt on modern iPhones, 360x800dp on standard Android):

**Card in hand (collapsed, in the 5-card fan):**
- Width: ~65dp
- Height: ~95dp
- Shows: card type icon, effect value, difficulty stars, domain color stripe at top
- Does NOT show: question text, answer options

**Card expanded (after tap, slides up to mid-screen):**
- Width: ~300dp (nearly full width with 30dp margins)
- Height: ~350dp
- Shows: full card art, card name, effect description, question text, answer buttons
- Answer buttons: full width, stacked vertically, 48dp height each, 8dp spacing
- Timer bar at the bottom of the expanded card

**Answer buttons layout (within expanded card):**
```
┌────────────────────────┐
│  Card Art / Icon       │
│  "Crystalline Strike"  │
│  Deal 12 Damage        │
│                        │
│  What is the hardest   │
│  mineral on Mohs scale?│
│                        │
│  ┌──────────────────┐  │
│  │    Diamond       │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │    Quartz        │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │    Topaz         │  │
│  └──────────────────┘  │
│                        │
│  ▓▓▓▓▓▓▓▓░░░░ 7s      │
│  [Skip]    [Hint 💎1]  │
└────────────────────────┘
```

All answer buttons are in the thumb-friendly bottom portion of the expanded card. Skip and Hint are below the answers, at the very bottom of the interaction zone.

---

## 14. Performance Considerations for Phaser 3

A few technical notes specific to Phaser 3 on mobile via Capacitor:

**Card animations:** Use Phaser tweens, not CSS animations. Phaser tweens are GPU-accelerated and won't cause layout thrashing. Card fan in hand should use a sprite pool of 5 pre-created card sprites, repositioned per turn — don't create/destroy sprites each draw.

**Particle effects:** Phaser 3's particle emitter is performant but cap particles at 50 concurrent maximum on mobile. Correct answer burst = 30 particles, 300ms lifespan. Don't let particles accumulate across multiple rapid answers.

**Haptics via Capacitor:** Use `@capacitor/haptics` plugin. Map feedback types:
- Correct answer: `Haptics.impact({ style: ImpactStyle.Heavy })`
- Wrong answer: `Haptics.notification({ type: NotificationType.Warning })`
- Card tap: `Haptics.impact({ style: ImpactStyle.Light })`
- Combo milestone: `Haptics.impact({ style: ImpactStyle.Heavy })` × 2 with 100ms delay

**Render budget:** Target 60fps. Card combat scene should have: background (1 sprite), enemy (1 sprite), 5 card sprites, HP bars (2 UI elements), combo counter (1 text), particle emitter (1). Total: ~12 game objects active during combat. This is well within Phaser 3's mobile budget.

**State persistence:** Use Capacitor's `@capacitor/preferences` (formerly Storage) for run state. Save after every encounter. JSON serialization of run state should be under 50KB — SM-2 data for 500 active facts is approximately 25KB.

---

## 15. What NOT to Build (Explicit Anti-Features)

These are things that might seem like good ideas but should be actively avoided:

**No chat/social features at launch.** Social features require moderation infrastructure, content policies, and legal compliance (especially for under-13 users under COPPA). Add leaderboards only (read-only, no user-generated content).

**No procedural fact generation.** Every fact must be human-verified. AI can draft facts, but they MUST pass human review before entering the live database. One wrong fact destroys trust in the entire learning system.

**No PvP at launch.** PvP requires matchmaking, anti-cheat, balance normalization, and network infrastructure. It's a post-launch feature once the single-player loop is validated.

**No deck editing outside of runs.** Players should not be able to manually add/remove facts from their deck between runs. The SM-2 scheduler and domain selection system handles this. Manual deck editing creates optimization behavior that works against the learning goals (players would remove hard facts, defeating the purpose).

**No premium currency.** Single currency earned through gameplay, spent at in-run shops. Premium purchases are direct (buy domain pack, buy cosmetic) not currency-mediated. Intermediary currencies obscure value and create negative app store reviews.

**No loot boxes / gacha.** The artifact opening ceremony from the original mining design was gacha-adjacent. In the card roguelite, rewards are transparent: see 3 cards, pick 1. This is cleaner, more respectful, and avoids regulatory concerns (Belgium, Netherlands, and increasingly other jurisdictions regulate loot boxes).

---

*End of addendum. These improvements should be layered onto the main spec — priorities 0-3 as defined there still apply. Game juice (section 3) and the portrait layout (section 1) should be in the prototype. Everything else layers in during soft launch and post-launch phases.*
