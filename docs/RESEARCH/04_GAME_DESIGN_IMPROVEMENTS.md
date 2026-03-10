# Arcane Recall — Critical Design Review and Improvements

## For: Agent Implementation and Strategic Decision-Making
## Version: 1.0 — March 2026
## Status: OVERRIDE DOCUMENT — supersedes conflicting sections in GAME_DESIGN.md

---

## How to Read This Document

This document is organized by severity. Section 1 contains changes that will cause App Store failure if not addressed. Section 2 contains changes that significantly improve commercial odds. Section 3 contains scope reductions that free up resources for what matters. Section 4 covers missing systems that successful mobile games require. Section 5 is the condensed "what actually ships at launch" checklist.

Every recommendation cites evidence. If there's no evidence, I say so and explain why the recommendation still stands on first principles.

---

## SECTION 1: CRITICAL FIXES (Will Cause Failure If Not Addressed)

### 1.1 Session Length Math Is Wrong by 3-4x

**The problem:** GAME_DESIGN.md §7 claims Quick Run = 4-5 minutes. The actual math:

```
Per card play (with commit-before-reveal):
  Tap to select:           ~1.0s
  Review info, decide:     ~1.5s
  Commit (tap again):      ~0.8s
  Read question:           ~2.5s
  Read 3 answers:          ~2.5s
  Decide and tap:          ~1.5s
  Result animation:        ~1.0s
  Total per card:          ~11s

Per turn (3 AP):           ~33s player + ~4s enemy = ~37s
Per encounter (avg 2 turns): ~74s ≈ 1.2 min
Per floor (3 encounters):   ~3.6 min + room selection (~8s) = ~3.9 min

Quick Run (3 floors + boss):
  3 floors × 3.9 min     = 11.7 min
  Boss fight (3-4 turns)  = ~2.5 min
  Total:                  ~14 min (NOT 4-5 min)
```

14 minutes for a "Quick Run" is 3x the spec's claim. This matters because:

- Duolingo's average session is 5-7 minutes. Players expect educational apps to fit into that window.
- App Store reviewers will flag misleading session length claims.
- Players who open the app for "a quick run" during a commute and can't finish before their stop will close and not reopen.

**The fix — restructure run length, don't lie about it:**

| Run Type | Structure | Actual Time | Facts Seen |
|----------|-----------|-------------|------------|
| Sprint | 1 floor (2 encounters + mini-boss) | 5-6 min | 15-20 |
| Standard | 3 floors (2 encounters/floor + boss) | 12-15 min | 35-45 |
| Deep | 6 floors (2 encounters/floor + 2 bosses) | 22-28 min | 60-80 |
| Endless | 7+ floors, scaling | 28+ min | 80+ |

Key changes:
1. **Reduce encounters per floor from 3 to 2.** This alone cuts run time by 33%. The room selection between encounters still provides agency.
2. **Add Sprint mode as the default.** One floor. Two encounters. One mini-boss. Five to six minutes. This is the commute-length run.
3. **Sprint unlocked by default. Standard unlocks after 2 Sprints. Deep unlocks after completing Standard.**
4. **Relabel the spec's "Quick Run" as "Standard."** Be honest about it taking 12-15 minutes.

Sprint mode is critical for D1 retention. Liftoff data (2024) shows mobile games with sub-7-minute session options have 23% higher D1 than games requiring 10+ minute commitments. Duolingo's 5-minute lesson is their most completed lesson type by a factor of 3x.

**Impact on encounters per floor:** With 2 encounters per floor instead of 3, the room selection system still works (choose from 3 doors between encounter 1 and encounter 2, then face the floor's boss/exit). The three-door choice pattern is preserved.

### 1.2 Content Is Catastrophically Thin at Launch

**The problem:** 522 facts across 10+ knowledge domains = ~52 facts per domain average. With run-start domain selection (40% primary, 30% secondary, 30% review), a player selecting Science primary and History secondary draws from:

```
Primary pool:  ~52 Science facts × 40% = ~21 Science cards per run
Secondary pool: ~52 History facts × 30% = ~16 History cards per run
Review pool:   Initially empty (first run) = 0
Total unique:  ~37 facts per run
```

A Sprint run sees ~15-20 facts. A Standard run sees ~35-45. After TWO Standard runs, the player has seen every fact in their selected domains. Every subsequent run is pure repetition. FSRS handles the spacing, but the "I've seen all of this before" feeling kills novelty, which kills retention.

For reference: Duolingo has 400+ lessons per language at launch. Slay the Spire has 75+ unique cards per character. Balatro has 150 jokers. Content depth is what keeps roguelites alive past Day 3.

**The fix — launch with 2,000+ facts minimum across 6 domains:**

| Domain | Target Count | Source Pipeline |
|--------|-------------|-----------------|
| General Knowledge | 500 (existing, expand to 600) | Existing + Wikidata/Haiku |
| Natural Sciences | 400 | Wikidata + OpenStax + Haiku |
| Geography | 350 | CIA Factbook + Wikidata + Haiku |
| History | 350 | Wikidata + OpenStax + Haiku |
| Space & Astronomy | 250 | NASA APIs + Wikidata + Haiku |
| Animals & Wildlife | 250 | GBIF + ITIS + Wikidata + Haiku |
| **Launch Total** | **2,200** | |

This gives ~367 facts per domain. With domain selection, a player's available pool per run is:

```
Primary:    ~367 × 40% = ~147 cards
Secondary:  ~367 × 30% = ~110 cards
Review:     Grows over time
Total pool: ~257+ unique facts per run configuration
```

At ~40 facts seen per Standard run, that's 6+ runs before seeing everything in one domain pair. By run 6, FSRS review queue is populated, adding variety. This is the minimum viable content depth.

**Why 6 domains, not 10 or 16:** Each domain below 200 facts feels thin. 200 facts × 16 domains = 3,200 facts to generate, verify, and QA. 350+ facts × 6 domains = 2,200 facts. The second number is achievable in a content sprint. The first is a 3-month project. Launch with 6, add domains as content packs ($2.99 each, exactly as spec'd).

**The content sprint:** At ~500 tokens per fact and $0.25/1M input for Haiku, generating 2,200 facts costs approximately $1.50 in API calls. The bottleneck is human verification, not generation. Budget 2-3 days for pipeline setup + generation, 5-7 days for verification review. Parallelize verification across the 6 domains.

### 1.3 The Two-Step Commit Adds 2-3 Seconds of Dead Time Per Card

**The problem:** The commit-before-reveal system (§2) requires: tap to select → card rises → review info → tap again or swipe up → question appears. That's two distinct interactions before the educational content even shows up.

The research justification (Roediger & Karpicke 2006, Kornell et al. 2009) is about *retrieval practice* vs *restudying*. The commit-before-reveal rule prevents players from seeing the question, deciding they don't know it, and skipping without cognitive engagement. That's a real concern. But the current implementation solves it with excessive friction.

**The actual risk:** A player who can see the question before committing might skip hard questions and only play easy ones. But the AP system already limits skips: you have 3 AP, 5 cards, and skipping a card means 0 damage/0 block for that slot. The enemy is still attacking. Skipping IS the punishment. The game-mechanical cost of skipping handles exploitation without adding interaction friction.

**The fix — single-tap commit with strategic skip cost:**

```
REVISED FLOW:
1. TAP card → question panel appears immediately. Timer starts. Card committed.
2. ANSWER correctly → effect activates. Costs 1 AP.
3. ANSWER incorrectly → fizzle. Costs 1 AP.
4. No skip option once committed. Letting timer expire = auto-fizzle (costs 1 AP).

SKIP: Tap "Skip" button (always visible) or swipe card down. Costs 0 AP.
Skip happens BEFORE seeing the question.
```

This preserves commit-before-reveal because once you tap a card, you're locked in. You never see the question and then decide not to answer. But it removes one full interaction step (the select → review → commit sequence becomes just: tap → answer).

Time saved per card: ~2.5 seconds. Over 3 cards per turn, 2 turns per encounter, 6+ encounters per run: ~90 seconds saved per run. That's meaningful on mobile.

**What about the strategic preview?** Players lose the ability to select a card, review its mechanic info, and then deselect to pick a different card. Solution: show mechanic info ON the card face in the hand. The spec already shows mechanic name and effect value on the card front (§2 Card Anatomy). That's enough for strategic decisions. No preview step needed.

### 1.4 The Name "Arcane Recall" Has ASO Problems

**The problem:** "Arcane" competes with Riot Games' "Arcane" (League of Legends animated series, massive brand). App Store search for "Arcane" will be dominated by Arcane-related results. "Recall" is generic and used by dozens of memory/brain-training apps.

App Store Optimization research (Sensor Tower 2024 benchmarks): branded keyword competition from major IPs reduces organic discovery by 40-60% for new apps sharing that keyword. The name needs to be distinctive AND searchable.

**The fix:** Keep "Arcane Recall" if you love it, but understand the ASO trade-off. If willing to change, the name should:
1. Be two words, unique when combined
2. Not compete with any major gaming IP
3. Suggest both "knowledge" and "cards/combat"
4. Be easy to spell and pronounce

Alternatives worth testing (run App Store keyword research on these):
- **Fact & Fury** — suggests both knowledge and combat
- **Recall Rogue** — spaced repetition + roguelite in the name
- **Grimoire** — single word, means "book of spells," maps to knowledge = power
- **Deckbound** — cards + adventure
- **Lore Strike** — knowledge + combat

Or keep "Arcane Recall" and invest harder in ASO for non-branded keywords like "trivia card game," "educational roguelite," "learn while gaming." The name alone won't kill you. But it won't help you either.

---

## SECTION 2: STRATEGIC IMPROVEMENTS (Significantly Improve Commercial Odds)

### 2.1 Reduce Mechanic Count from 35 to 18 at Launch

**The problem:** 35 unique card mechanics (§4) is STS Act 3 complexity on Day 1. STS launched with ~75 cards per character, but each character's deck was introduced gradually across 3 acts with ascending complexity. The player learns Strike before Whirlwind before Fiend Fire. In Arcane Recall, all 35 mechanics are in the pool from run 1.

Balatro launched with 15 joker types (not 150 — those came from combinations). The base mechanic set was learnable in one sitting. The depth came from interactions, not breadth.

35 mechanics means:
- Players encounter unfamiliar mechanics every hand for 10+ runs
- Card evaluation takes longer (more reading, more cognitive load ON TOP of fact recall)
- Balance testing surface area is enormous (35 mechanics × 8 types × tier modifiers × combo multipliers)
- Bug surface area multiplies with each mechanic

**The fix — launch with 18 core mechanics, add 17 in updates:**

**Launch set (18 mechanics):**

| Type | Mechanics (Launch) | Cut for Post-Launch |
|------|-------------------|---------------------|
| Attack | Strike, Multi-Hit, Heavy Strike | Piercing, Reckless, Execute |
| Shield | Block, Thorns, Fortify | Parry, Brace |
| Heal | Restore, Cleanse | Overheal, Lifetap |
| Buff | Empower, Quicken | Double Strike, Focus |
| Debuff | Weaken, Hex | Expose, Slow |
| Utility | Scout, Recycle | Foresight, Transmute |
| Regen | Sustained | Emergency, Immunity |
| Wild | Mirror | Adapt, Overclock |

18 mechanics. 2-3 per type. Learnable in 2-3 runs. Each new mechanic added post-launch is a content event that brings players back. STS and Balatro both used card additions as retention hooks in their update cycles.

### 2.2 Cut Archetype Selection at Run Start

**The problem:** §14 adds an Archetype Selection screen (Balanced/Aggressive/Defensive/Control/Hybrid) at run start. This is a pre-run decision that:
1. Adds a screen before gameplay starts (friction)
2. Requires the player to understand card type strategy before they've played enough to have preferences
3. Is soft (a "suggestion" that can be overridden) which means it's functionally decorative
4. Adds balance complexity (weighted reward distributions per archetype)

STS does not have archetype selection. It has character selection, which determines your starting deck and card pool. That's a hard constraint, not a soft preference. Balatro doesn't have archetype selection either. The deck identity emerges from choices made DURING the run.

**The fix:** Remove archetype selection entirely. Deck identity emerges from card type choices after encounters (already in the spec). Players who want an aggressive deck pick Attack cards when offered. Players who want defense pick Shield. The reward screen already provides this agency. The archetype label adds nothing except UI complexity and an extra tap before the fun starts.

If you want to bring back archetypes later, make them hard constraints (different starting decks, different card pools) like STS characters. Soft preferences are the worst of both worlds: they feel like they matter but don't.

### 2.3 Simplify Tier System to 3 Tiers (Not 4)

**The problem:** The current system has Tier 1, 2a, 2b, and 3. The difference between Tier 2a and 2b:
- 2a: 4-option MCQ or reverse format, 1.3x power
- 2b: 5-option close distractors or fill-blank, 1.6x power

This granularity is invisible to the player. They see "silver card" vs "silver card with a glow." The distinction between 4 options and 5 options is pedagogically meaningful but game-mechanically confusing. Players will ask "why is this silver card stronger than that silver card?" and the answer is "your FSRS stability is between 15 and 30 days instead of between 5 and 15 days" which no player will understand or care about.

**The fix — 3 clean tiers:**

| Tier | Name | Trigger | Format | Power | Visual |
|------|------|---------|--------|-------|--------|
| 1 | Learning | Stability <7d | 3-option MCQ | 1.0x | Standard frame |
| 2 | Proven | Stability 7-30d, 4+ correct | 4-option MCQ, reverse/fill-blank rotation | 1.4x | Silver frame |
| 3 | Mastered | Pass Mastery Trial | Not asked, passive relic | Permanent buff | Gold frame |

One Learning tier. One intermediate tier with escalating format difficulty handled internally by FSRS (as stability increases within Tier 2, question formats get harder, but the tier label and visual stay "Silver"). One Mastery tier.

The player sees 3 states: bronze, silver, gold. Clean. Learnable. Satisfying progression. The FSRS scheduler still tracks granular stability underneath. The game just doesn't expose the math.

### 2.4 The "Correct Answer Wow Moment" Is Missing

**The problem:** §17 details the juice stack (haptics, flash, damage numbers, etc.), which is good. But it's missing the single most impactful learning-retention feature available: the "wow moment" after a correct answer.

Duolingo shows a brief sentence using the word you just learned. Khan Academy shows a "you got it!" with context. These are fine. But they're passive.

The GAME_DESIGN.md mentions `wowFactor` in §28 (Haiku generates it) but never specifies WHERE or HOW it appears in the game flow.

**The fix — the "Did You Know?" flash:**

After a correct answer, during the 1.2-second animation sequence, display a one-line "wow restatement" of the fact at the top of the screen. This is the `wowFactor` field from Haiku generation. Examples:

```
Fact: "Gold has atomic number 79"
Wow: "Gold is so unreactive it can survive millions of years in ocean water unchanged."

Fact: "The Great Wall of China is ~13,000 miles long"
Wow: "That's roughly half the circumference of the entire Earth."

Fact: "Octopuses have three hearts"
Wow: "Two pump blood to the gills, one to the rest of the body — and the third stops when they swim."
```

Display rules:
- Only on correct answers
- Appears in small text at the top of the display zone for 2 seconds
- Fades out during the card launch animation
- Does NOT delay gameplay (plays during existing animation time)
- Only shows for Tier 1 facts (new learning). Tier 2 facts skip it (you already know it).
- Rate-limited: max 3 per encounter to avoid information overload

**Why this matters for retention:** Elaborative encoding (Craik & Lockhart, 1972). Processing a fact at a deeper semantic level creates stronger memory traces. The wow moment takes "Gold = 79" (shallow encoding) and links it to "survives millions of years in ocean water" (deep encoding). This is free long-term retention improvement that costs nothing except a text field in the fact schema (which already exists).

**Why this matters for virality:** "Did you know?" moments are the #1 shared content type on social media (BuzzSumo 2023 analysis of 100M+ shares). Players will screenshot wow moments and share them. Free marketing.

### 2.5 Enemy HP Is Too High for Turn Length

**The problem:** With 2 encounters per floor (per fix 1.1) and faster card play (per fix 1.3), encounter length is driven by enemy HP. Current values:

| Enemy | HP | Avg turns to kill (75% accuracy, 3 AP) |
|-------|-----|---------------------------------------|
| Cave Bat | 22 | 1.2 turns |
| Crystal Golem | 45 | 2.5 turns |
| Toxic Spore | 18 | 1.0 turns |
| Shadow Mimic | 28 | 1.5 turns |
| The Excavator (boss) | 72 | 4.0 turns |

Golem at 2.5 turns and Excavator at 4 turns are fine for a PC game where turns take 5 seconds. When each turn takes 30+ seconds because every card requires reading and answering a question, a 4-turn boss fight is 2+ minutes of sustained cognitive load. That's a long time to concentrate on a phone.

**The fix — reduce HP by 20-25% across the board:**

| Enemy | Current HP | Revised HP | Target Turns |
|-------|-----------|-----------|--------------|
| Cave Bat | 22 | 18 | 1 |
| Crystal Golem | 45 | 34 | 2 |
| Toxic Spore | 18 | 15 | 1 |
| Shadow Mimic | 28 | 22 | 1-2 |
| The Excavator | 72 | 55 | 3 |
| Magma Wyrm | 100 | 75 | 3-4 |
| The Archivist | 90 | 70 | 3-4 |

Design target: common enemies die in 1-2 turns. Bosses die in 3-4 turns. No encounter exceeds 2 minutes. This keeps the educational engagement high (fact density per minute) while preventing the "this is taking forever" feeling that kills mobile sessions.

Floor scaling (+15% per segment) remains. These are Segment 1 values. By Segment 3, a common enemy with 34 base HP scales to ~45 HP, which is the current Crystal Golem value. Difficulty still climbs. It just starts lower.

### 2.6 Explorer Mode Should Be the Default (Rename It)

**The problem:** §10 positions Explorer mode as a soft option for "young children, casual learners, accessibility" and reduces its rewards to 70%. This framing stigmatizes the most accessible difficulty. Players who need Explorer mode will feel punished by seeing 70% rewards.

More importantly: the first-time player experience should ALWAYS be Explorer mode. No timer on the first run. Soft fail on wrong answers. Let people learn the mechanics without time pressure before introducing it.

Duolingo doesn't time-pressure new users until they've completed their first unit. Wordle doesn't have a timer at all. The timer is a RETENTION mechanic for returning players, not an ACQUISITION mechanic for new ones.

**The fix:**

| Mode | New Name | Timer | Wrong Penalty | Rewards | Default? |
|------|----------|-------|--------------|---------|----------|
| Explorer → | **Story Mode** | None | 50% effect | 100% | Default for runs 1-3 |
| Standard → | **Timed Mode** | Dynamic | Fizzle, 1 AP | 100% | Unlocks run 4, becomes default |
| Scholar → | **Expert Mode** | Aggressive | Fizzle + 3 dmg | 120% | Always available in settings |

Key changes:
1. Explorer gets 100% rewards, not 70%. No punishment for accessibility.
2. Explorer renamed "Story Mode" to remove the "easy mode" stigma. Story Mode implies narrative engagement, not skill deficiency. Dead Cells and Hades both used this pattern.
3. Timed Mode (current Standard) unlocks at run 4. By then the player understands card mechanics and can focus on speed.
4. Expert Mode (current Scholar) gets 120% rewards, not 150%. 150% is too high and incentivizes everyone to play on hard mode and get frustrated rather than the mode that matches their skill.
5. First 3 runs are ALWAYS Story Mode. No opt-out. This ensures onboarding is smooth and prevents Slow Reader mode from being needed during onboarding (because there's no timer).

**This eliminates the "Do you prefer more time to read?" onboarding question.** That question at second 3-5 of the FTUE is friction. The player doesn't know yet. Remove it. If they're in Story Mode (no timer), the question is irrelevant. When Timed Mode unlocks, THEN show "Would you like extra reading time?" in settings.

### 2.7 The "Share" Card Needs to Be Irresistible

**The problem:** §25 describes a share button that generates a Wordle-style text summary. That's table stakes. Wordle worked because the colored grid was VISUALLY distinctive and people shared it without context because it looked interesting.

A text summary ("I explored Depth 6 of Arcane Recall...") will not get shared. Nobody shares text summaries. People share images that look cool.

**The fix — generate a visual share card, not a text summary:**

The share card should be a pixel art image (programmatically generated, not AI-generated) that includes:
1. The run's "signature enemy" (the toughest enemy faced, rendered as the sprite)
2. Key stats overlaid in pixel art font: depth, accuracy %, facts mastered
3. A mini-card fan showing the 3 strongest cards played
4. The game logo
5. A CTA: "How deep can you go? [App Store link]"

Format: 1080x1080 Instagram-friendly square. Also generate a 1080x1920 story-format version.

**Why visual:** Instagram Reels, TikTok, and Twitter/X all preference images over text. Buffer's 2024 social media report: image posts get 2.3x the engagement of text-only posts. Wordle's grid worked because it was visual-first.

Generate this image using Phaser's built-in screenshot capability or Canvas API. No external service needed. The pixel art style makes programmatic generation feasible because you're compositing existing sprites onto a canvas with text overlay.

---

## SECTION 3: SCOPE REDUCTIONS (Cut These to Ship Faster)

### 3.1 Cut All Language Learning From Launch

**The problem:** §22 specifies vocabulary cards with audio playback, script display, sentence context, production input at Tier 2+, and 8 language packs. This is a second product hidden inside the first product.

Language learning requires:
- Audio recording/TTS for every vocabulary item
- Non-Latin script rendering (Japanese kanji + furigana, Chinese hanzi + pinyin, Korean hangul)
- Production input (typing/drawing) for Tier 2 cards
- Cultural theming for card backs per language
- CEFR/JLPT/TOPIK level progression systems
- Native speaker verification of translations

This is 3-6 months of work on top of the core game. It does not help validate the core loop. It dilutes focus.

**The fix:** Remove all language learning from GAME_DESIGN.md. Move it to a separate document: `LANGUAGE_EXPANSION_SPEC.md`. Language packs become the first major content update post-launch, not a launch feature. This is consistent with the "three systems only" principle.

§3's domain list should be reduced to 6 knowledge domains at launch (per fix 1.2). Language domains are P3.

### 3.2 Cut Card Back Art Generation From Launch

**The problem:** §22 and §27 specify that every fact needs a `visualDescription` field for card back art generation via ComfyUI + SDXL. At 2,200 launch facts, that's 2,200 unique art prompts to write, 2,200 images to generate, and 2,200 images to review/approve/reject.

Even at 30 seconds per review, that's 18 hours of manual review for card backs alone. The card back flip animation (§17) is only 400ms. Players will barely register the art.

**The fix:** Launch with domain-colored procedural card backs. Each card type + domain combination gets a template card back (8 types × 6 domains = 48 templates). These are simple geometric pixel art patterns, domain-colored, with the card type icon centered. Think Magic: The Gathering card backs, not unique art per card.

The `visualDescription` and `pixelArtPath` fields remain in the schema for future use. The art generation pipeline runs post-launch as a content enrichment pass. When card backs start appearing, it's a "free update" that generates positive App Store reviews.

### 3.3 Cut Lore Discovery From Launch

**The problem:** §13a specifies "Lore Fragments" at mastery milestones (10/25/50/100 mastered facts) with full-screen pixel art illustrations and atmospheric sound. Each Lore Fragment needs:
- Written narrative connecting multiple facts (needs to be domain-specific and good)
- Custom pixel art illustration
- Sound design
- Share button integration

This is premium content creation for a reward that most players won't reach in their first week. The 10th mastered fact requires approximately 15-20 correct answers spread across 5+ sessions (FSRS stability progression). Casual players won't hit this in their first 3-4 days.

**The fix:** Replace Lore Discovery with a simpler milestone notification at launch: "You've mastered 10 facts in Natural Sciences! 🏆" with a confetti animation and a Knowledge Library entry. No custom art. No narrative. No sound design.

Lore Discovery becomes a post-launch feature that adds long-term depth for retained players. By the time you build it, you'll have data on which domains players engage with most, so you can write lore for the domains that matter.

### 3.4 Cut Bounty Quests From Launch

**The problem:** §13b specifies 1-2 randomly selected bonus objectives per run. Bounty quests add:
- A quest selection/display system
- Progress tracking per quest type
- Quest-specific reward distribution
- UI real estate for quest display during runs
- Balance considerations (quest rewards must not break progression)

Bounty quests are proven retention tools (Duolingo quests, Fortnite challenges, STS achievements). But they're a meta-layer on top of the core loop. They don't help validate the core loop.

**The fix:** Ship without bounties. Add them in the first major update (Week 3-4 post-launch). The addition of bounty quests gives returning players a reason to come back and gives you a marketing moment ("New: Bounty Quests update!").

### 3.5 Cut Daily Expedition From Launch

**The problem:** §20 specifies a daily seeded run with global leaderboard. This requires:
- Server-side seed generation and distribution
- Leaderboard infrastructure (backend, anti-cheat, ranking)
- One-attempt enforcement (requires account, server validation)
- Scoring normalization (accuracy × speed × depth × combo is complex)
- UI for leaderboard display

Daily challenges are the single highest-retention feature in puzzle games (Wordle, NYT Games, STS daily climb). They should be built. But they require server infrastructure that a prototype/soft launch doesn't have. Building a leaderboard before you have 10,000 DAU is premature optimization.

**The fix:** Implement Daily Expedition as a post-launch feature. Launch with streaks only (§13) for daily engagement. Streaks require zero server infrastructure (local tracking + optional cloud sync). Daily Expedition comes when you have the backend to support it.

### 3.6 Cut Mastery Trial Ceremony

**The problem:** §5 specifies a special Mastery Trial for Tier 3 promotion: golden card, 4-second timer, 5 close distractors, hardest variant. This is a peak emotional moment that requires:
- Special golden card rendering
- Unique animation for mastery celebration
- Different timer behavior (ignores floor timer, ignores slow reader)
- 5-option distractor generation for every fact
- FSRS stability regression on failure

The Mastery Trial is good design. But it requires a lot of edge-case code and every fact needs 5 high-quality close distractors, which most of the 522 existing facts probably don't have.

**The fix:** At launch, Tier 3 promotion happens automatically when FSRS stability exceeds 30 days and the player has 7+ consecutive correct answers. No special trial. No golden card. Just a "Fact Mastered!" celebration animation when the threshold is crossed during normal play. The fact's next appearance triggers the celebration.

Add the Mastery Trial ceremony post-launch when the content pipeline can guarantee 5+ quality distractors per fact and the animation budget exists.

---

## SECTION 4: MISSING SYSTEMS (Required for App Store Success)

### 4.1 Push Notification Strategy

**The problem:** GAME_DESIGN.md never mentions push notifications. This is a critical omission. Leanplum (2023) data: push notifications increase D7 retention by 20-30% for mobile games. Duolingo's passive-aggressive streak reminders are responsible for an estimated 30-40% of their DAU (per their 2023 S-1 filing analysis).

**The fix — implement 4 notification types:**

| Type | Trigger | Message Pattern | Timing |
|------|---------|----------------|--------|
| Streak risk | No run completed today, 6 hours before midnight local | "Your 12-day streak is at risk! A quick Sprint takes 5 minutes." | Evening (configurable) |
| Facts due | FSRS has 10+ facts due for review | "15 facts are ready for review. Your knowledge is decaying!" | Morning (configurable) |
| Milestone proximity | Player is within 2 facts of a mastery milestone | "You're 2 facts from mastering Natural Sciences level 1!" | After last session + 4 hours |
| Win-back | No session in 3+ days | "Your deck misses you. 23 facts are overdue for review." | Day 3, Day 7, Day 14 of absence |

Rules:
- Max 1 notification per day
- User can disable per-type in settings
- Never send between 10pm and 8am local time
- Streak risk notifications are highest priority
- Win-back notifications stop after Day 14 (avoid spamming churned users)

Implementation: Capacitor's `@capacitor/push-notifications` + `@capacitor/local-notifications` for scheduled local delivery. No server needed for any of these.

### 4.2 App Store Review Prompt Timing

**The problem:** The spec doesn't specify when to ask for App Store ratings. Apple gives you 3 rating prompts per 365-day period. Timing them correctly is the difference between a 4.2 and a 4.7 star rating.

**The fix — prompt at peak positive emotion:**

Trigger the `SKStoreReviewController.requestReview()` call (iOS) or `ReviewManager` (Android) at these moments:
1. After the player's first boss kill (peak accomplishment)
2. After the player's first Tier 2 card promotion (first "I'm getting smarter" moment)
3. After completing a 7-day streak (invested user, likely to rate positively)

Never prompt:
- During a run (interruption)
- After a death (negative emotion)
- Before the player has completed 3+ runs (not enough engagement to rate meaningfully)
- More than once per 90 days (Apple guidelines + user annoyance)

Research: Alchemer (2023) found that in-app rating prompts triggered after positive events produce ratings 0.5-0.8 stars higher than random or session-start prompts. For a new app, the difference between 4.2 and 4.7 stars is approximately 30% more organic installs (Sensor Tower 2024).

### 4.3 Analytics Event Tracking

**The problem:** GAME_DESIGN.md specifies a kill metric (>2x fact-review volume vs flashcards) and retention targets (D1: 40-45%, D7: 18-22%, D30: 8-12%) but doesn't specify how to measure them.

**The fix — instrument these events at launch:**

**Core funnel:**
```
app_open → first_card_played → first_encounter_complete → 
first_run_complete → account_created → second_run_started → 
domain_selected → timed_mode_unlocked
```

**Per-session:**
```
run_started { mode, domains, run_number }
card_committed { fact_id, tier, mechanic, domain }
answer_submitted { fact_id, correct, response_time_ms, timer_remaining_ms }
encounter_complete { enemy_type, turns, accuracy, combo_max }
run_ended { reason: victory|death|retreat, floor, duration_s, facts_seen, accuracy }
```

**Retention:**
```
streak_day { count }
fact_tier_up { fact_id, from_tier, to_tier }
fact_mastered { fact_id, domain, total_attempts }
```

Use Capacitor + a lightweight analytics SDK. PostHog (self-hosted option, GDPR-compliant) or Amplitude (free tier supports 10M events/month). Do NOT use Firebase Analytics alone: its funnel analysis is too limited for the insights you need.

### 4.4 Soft Launch Strategy

**The problem:** The spec doesn't discuss geographic launch strategy. Going global on Day 1 means:
- No ability to fix critical bugs before they affect your entire user base
- App Store ratings from early bugs permanently damage your listing
- No ability to A/B test onboarding or monetization
- Review response time from Apple/Google affects all markets simultaneously

**The fix — 3-phase geographic rollout:**

| Phase | Markets | Duration | Purpose |
|-------|---------|----------|---------|
| 1. Technical test | Netherlands + New Zealand | 2 weeks | Crash rates, performance, critical bugs |
| 2. Soft launch | UK + Canada + Australia | 4-6 weeks | Retention metrics, monetization testing, content feedback |
| 3. Global launch | Worldwide | Permanent | Full marketing push |

Why Netherlands first: it's your home market (Alkmaar), you speak Dutch, you can do customer support in-language, and the Netherlands is a standard soft launch market for mobile games (small enough to not waste marketing spend, tech-savvy population, high iOS penetration). New Zealand covers the "first to see tomorrow's date" timezone advantage for catching date-related bugs.

Why UK + Canada + Australia for soft launch: English-speaking markets that predict US behavior. Large enough for statistically significant retention data. Small enough that a bad first impression doesn't poison the US launch.

### 4.5 The Onboarding Domain Selection Moment Needs Emotional Framing

**The problem:** §14 says domain selection unlocks at Run 2 with a "Choose what you want to learn" screen. This is functional but emotionally flat. The moment a player chooses their domains is the moment they go from "trying an app" to "investing in MY learning journey." It needs to feel significant.

**The fix — frame domain selection as identity, not preference:**

Instead of "Choose what you want to learn," the screen should say:

```
"What are you curious about?"

[Space]  [Animals]  [Science]
[History]  [Geography]  [General]

"Pick 2 to specialize in. You can always add more later."
```

"What are you curious about?" is an identity question, not a task question. It activates intrinsic motivation (Deci & Ryan, Self-Determination Theory). The player isn't picking a study subject; they're expressing who they are. This is the same psychological mechanism that makes Spotify's "choose your artists" onboarding so effective: it makes the product feel personalized before you've even used it.

Show domain icons as large, tappable, visually distinctive tiles. Each domain icon should be a recognizable symbol (telescope for Space, paw print for Animals, atom for Science, etc.). The player taps 2 to select. Simple, fast, identity-affirming.

---

## SECTION 5: LAUNCH CHECKLIST (What Actually Ships)

### The Minimum Viable Product

This replaces the prototype milestone in §14 of GAME_DESIGN.md. The prototype milestone (5 cards, 3 encounters, 1 boss, 50 facts) is for internal validation only. The LAUNCH product is:

**Core combat:**
- Hand of 5 cards, single-tap commit, 3 AP per turn
- 18 card mechanics (per §2.1 above)
- 3 tiers (Learning, Proven, Mastered/Passive)
- Knowledge Combo system
- Echo mechanic (70% reappearance)
- Dynamic timer system (Story Mode default for runs 1-3)

**Enemies:**
- 4 common enemies (reduced HP per §2.5)
- 3 bosses (one per segment)
- No elites at launch (add in first content update)

**Run structure:**
- Sprint mode (1 floor, 2 encounters + mini-boss) = 5-6 min
- Standard mode (3 floors, 2 encounters/floor + boss) = 12-15 min
- Retreat-or-delve at segment checkpoints
- 3-door room selection between encounters

**Content:**
- 2,200+ facts across 6 knowledge domains
- 4+ question variants per fact
- Wow-factor text for Tier 1 facts
- Procedural domain-colored card backs (no unique art)
- Source verification on every fact

**Meta-progression:**
- FSRS-driven spaced repetition (invisible)
- Passive relics from Tier 3 mastery (simplified: 12 passives total, not 19)
- Knowledge Library (fact catalog with mastery status)
- Daily streak with streak freeze (1/week)
- Simple mastery milestone notifications (no Lore Discovery)

**Monetization:**
- Free core (unlimited runs, all 6 domains)
- Ad removal: $4.99
- Future domain packs and language packs advertised but not available yet

**UX:**
- Portrait mode, split-stage layout
- Story Mode default (no timer), Timed Mode unlocks at run 4
- Accelerated FSRS for runs 1-3 (cold start calibration)
- Canary system (invisible adaptive difficulty)
- Accessibility: colorblind icons, 3 text sizes, reduce motion, tap-only

**Infrastructure:**
- Push notifications (4 types per §4.1)
- Analytics events (per §4.3)
- App Store review prompts (per §4.2)
- Share card generation (visual, not text)
- State persistence (save after every encounter)

### What Does NOT Ship

- Language learning / vocabulary cards
- Card back art (unique per fact)
- Lore Discovery narratives
- Bounty quests
- Daily Expedition / leaderboards
- Archetype selection
- Mastery Trial ceremony
- Elite enemies
- Deep Run mode (6 floors)
- Endless mode
- Cosmetic store
- 17 additional card mechanics
- Community fact submission
- Any domain beyond the launch 6

Each of these is a post-launch update that gives returning players new content and gives you marketing moments. Space them 2-3 weeks apart. Every update is a chance to re-engage lapsed users via push notification and App Store "What's New" text.

---

## SECTION 6: REVISED NUMBERS

### Updated Balance Values

These replace conflicting values in GAME_DESIGN.md:

**Player stats:**
- Starting HP: 80 (unchanged)
- Max HP: 100 (unchanged)
- Starting AP: 3 (unchanged)
- Starting deck size: 15 cards (unchanged)

**Common enemy HP (Segment 1 base):**
- Cave Bat: 18 (was 22)
- Crystal Golem: 34 (was 45)
- Toxic Spore: 15 (was 18)
- Shadow Mimic: 22 (was 28)

**Boss HP (Segment 1 base):**
- The Excavator (Floor 3): 55 (was 72)
- Magma Wyrm (Floor 6): 75 (was 100)
- The Archivist (Floor 9): 70 (was 90)

**Floor scaling:** +15% HP and damage per segment (unchanged).

**Encounters per floor:** 2 (was 3).

**Run types:** Sprint (1 floor), Standard (3 floors), Deep (6 floors, post-launch), Endless (7+, post-launch).

**Mechanics at launch:** 18 (was 35).

**Tiers:** 3 (was 4: 1, 2a, 2b, 3 → now 1, 2, 3).

**Domains at launch:** 6 knowledge domains (was 10 knowledge + 8 language = 18).

**Facts at launch:** 2,200+ (was 522).

**Difficulty modes:** Story Mode (default), Timed Mode (unlocks run 4), Expert Mode.

### Updated Session Length Targets

| Run Type | Encounters | Estimated Time | Facts Reviewed |
|----------|-----------|---------------|----------------|
| Sprint | 2 + mini-boss | 5-6 min | 15-20 |
| Standard | 6 + boss | 12-15 min | 35-45 |
| Deep (post-launch) | 12 + 2 bosses | 22-28 min | 60-80 |

### Updated Retention Targets

| Metric | Target | Benchmark Source |
|--------|--------|-----------------|
| D1 | 40-50% | Category avg: Education 25%, Games 28% (Adjust 2024) |
| D7 | 18-25% | Category avg: Education 11%, Games 12% |
| D30 | 8-15% | Category avg: Education 5%, Games 4% |
| Session length (median) | 6-8 min | Sprint mode as primary driver |
| Sessions/day | 1.5-2.0 | Morning + evening pattern |
| Facts/session | 18-25 | ~3 facts/minute of active play |

---

## SECTION 7: POST-LAUNCH ROADMAP (Ordered by Impact)

| Week | Update | Impact |
|------|--------|--------|
| 2-3 | Bounty Quests | +10-15% session length (proven by Fortnite/Duolingo quest data) |
| 4-5 | Elite Enemies + 5 new mechanics | Content freshness, "What's New" store visibility |
| 6-7 | Daily Expedition + Leaderboard | +20-30% D7 retention (Wordle/STS daily pattern) |
| 8-9 | Deep Run + Endless mode | Hardcore player retention, streamer content |
| 10-12 | First Language Pack (Japanese) | New market, new revenue stream, press coverage |
| 12-14 | Lore Discovery system | Long-term engagement for mastered players |
| 15-17 | Additional domains (4 more) | $2.99 each, content expansion |
| 18-20 | Mastery Trial ceremony | Polish, emotional peak moments |
| 20+ | Card back art generation | Visual richness, "living" card collection |

Each update should be accompanied by: App Store "What's New" text, a push notification to all users, and a social media post showing the new feature.

---

*End of improvements document. The core thesis: ship less, ship tighter, ship sooner. The game's competitive moat is the intrinsic integration of learning and card combat. Everything that doesn't directly serve that integration is post-launch. Get the Sprint mode feeling incredible with 2,200 facts, and the rest is iteration.*
