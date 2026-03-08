# Knowledge System — Terra Miner

The heart of the game: artifacts, facts, spaced repetition, and the Knowledge Tree.

## Design Goal

Make learning **genuinely addictive**. Players should find themselves wanting to learn more — not because the game forces them, but because the systems reward curiosity naturally. Facts must be fascinating, never boring. The quiz system must feel like a game mechanic, not a homework assignment.

## Artifacts

### What They Are
Artifacts are physical objects found while mining. They are compressed fragments of Earth's lost knowledge — data crystals, ancient tablets, encoded relics. Each artifact contains one or more **facts** about the real world.

### Discovery Flow
1. Player mines an **artifact node** in the mine
2. Artifact appears with **rarity visible** and a **category hint** (e.g., "Ancient Biology Artifact — Rare")
3. Artifact is **not yet readable** — its contents are unknown
4. Artifact takes up **backpack space** (Tetris-style shape, size varies by rarity)
5. Player must decide: carry it back (takes space away from minerals) or leave it

### Rarity Tiers
Rarity applies to the **artifact container**, not the fact itself. Facts are not inherently rare — they are knowledge that belongs to everyone. But the *artifact* that delivers the fact has a rarity tier, which correlates with how interesting/memorable the contained fact is.

| Tier | Color | Fact Quality | Drop Rate |
|---|---|---|---|
| Common | White/Grey | Solid foundational facts | ~60% |
| Uncommon | Green | Interesting, surprising facts | ~25% |
| Rare | Blue | Mind-blowing, highly memorable | ~10% |
| Epic | Purple | Extraordinary, paradigm-shifting | ~4% |
| Legendary | Gold | The most fascinating facts known | ~0.9% |
| Mythic | Rainbow/Prismatic | Unique, one-of-a-kind revelations | ~0.1% |

**Key design rule**: Artifact rarity correlates with how *interesting and memorable* the contained fact is, not how "important" or "difficult" it is.
- Common artifact: "Copper has been used by humans for over 10,000 years" (useful, solid)
- Legendary artifact: "Octopuses have three hearts and blue blood" (mind-blowing, unforgettable)

### Gacha Moments
Artifact ingestion is one of **multiple gacha moments** in the game. The full set:
1. **Artifact reveal** at base (most frequent) — crack open an artifact, see the fact and its quality
2. **Dive reward chest** — end-of-run bonus loot based on performance
3. **Pet synthesis** — revive a fossil into a living creature (biggest spectacle)

Each gacha moment should have **escalating visual and audio spectacle by rarity**:
- Common: quick shimmer, subtle chime
- Rare: particle burst, satisfying sound
- Epic: screen flash, dramatic reveal
- Legendary: full-screen lightshow, fanfare
- Mythic: unique animation, unforgettable moment

### At Base: Ingestion
- Back at the dome, player feeds artifacts into **GAIA** (the ship's AI codex)
- The fact is revealed with a gacha-tier animation (see above)
- Player then chooses:
  - **Keep for study rotation**: Fact enters the Anki-style review system
  - **Sell for minerals**: Convert the fact to currency (higher rarity = more minerals)
  - **Mark as "already known"**: Skip the learning phase, but the system will quiz you on it periodically — you must prove you actually know it by getting it right several times
- Some artifacts can be **scanned mid-dive** (rare ability, requires scanner upgrade), immediately adding to codex without using backpack space

### Duplicate & Unwanted Facts
- If a player finds a fact they already have, or marks a fact as uninteresting:
  - **Trade** with other players (future multiplayer feature)
  - **Mix duplicates/unwanted facts** at the Materializer: combine several to reroll into a new artifact of potentially higher rarity (gacha recycling!)
  - Auto-convert to minerals if the player just wants currency
- Players can flag facts as "not interesting" — this feeds back into our content quality metrics

### Backpack Trade-Off
This is a critical tension point: **artifacts compete with minerals for backpack space**.
- Minerals = currency for upgrades, crafting, base building
- Artifacts = knowledge, long-term progression, Knowledge Tree growth
- A higher-rarity artifact is larger in the backpack, amplifying the decision
- Players must constantly weigh short-term (minerals) vs. long-term (knowledge)

## Facts

### Content Philosophy
Facts must be **ultra-interesting**. The bar is high:
- **YES**: "Astronauts on the ISS aren't floating — they're falling at the same rate as the station"
- **YES**: "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid"
- **NO**: "The Battle of Hastings was in 1066" (dry dates without context)
- **NO**: "The chemical symbol for Sodium is Na" (rote memorization without wonder)

Every fact should make the player think "wait, really?!" or "I need to tell someone this."

### Fact Voice
In the spirit of Anki, the core fact statement and quiz question must be **clear and concise** — optimized for memorization. The "wow factor" lives in a separate field:
- `statement`: Clear, concise, memorizable. "Octopuses have three hearts."
- `wow_factor`: The mind-blowing framing. "The ocean is full of aliens — octopuses have THREE hearts, blue blood, and can change color in milliseconds."
- The wow_factor is shown during artifact ingestion (the gacha reveal moment) and on the fact card, but the quiz question tests the concise statement.
- This separation keeps quizzes clean while making discovery exciting.

### Fact Sources
Every fact **credits its source** to the player. ("Source: NASA.gov")
- Builds trust in the learning content
- Teaches source literacy as a meta-skill
- Shown on the fact card detail view (not during quizzes — would clutter)
- Sources are stored in the database and verified during the quality pipeline

### Age & Sensitivity Ratings
Facts are rated for audience appropriateness:

**Age tiers** (selected during first launch):
| Tier | Label | Content |
|---|---|---|
| KID | Kid Mode | Family-safe, no violence, no controversy. Nature, science, fun facts. |
| TEEN | Teen Mode | Broader content. History including conflicts, more complex topics. |
| ADULT | Adult Mode | Full content. Controversial history, mature science topics, nuanced subjects. |

**Per-fact fields:**
- `age_rating`: "kid" | "teen" | "adult"
- `sensitivity_level`: 0-5 (0 = universally safe, 5 = requires mature framing)
- `sensitivity_note`: Brief note on why it's flagged (for editorial review)

**Design rules:**
- Default to KID mode for new accounts
- Age selection on first launch (not gate-kept — honor system)
- Core safe fact set available to all users before preferences are set
- Category system helps self-selection (players choose topics they're interested in)
- Controversial facts always include careful, neutral framing in the explanation field

### Fact Structure
Each fact in the database contains:
```
{
  id: string,
  type: "fact" | "vocabulary" | "grammar" | "phrase",  // Extensible for language learning

  // Core content
  statement: string,           // Clear, concise, memorizable (1-2 sentences)
  wow_factor: string,          // Mind-blowing framing shown during ingestion
  explanation: string,         // Why it's true / deeper context (2-3 sentences)
  gaia_comment: string,        // GAIA's snarky/enthusiastic comment for ingestion popup

  // Quiz
  quiz_question: string,       // The question asked during review
  correct_answer: string,      // The right answer
  distractors: string[25],    // ~25 plausible wrong answers (similar domain)

  // Classification
  category: string[],          // Hierarchical: ["Science", "Biology", "Evolution"]
  rarity: Rarity,             // Determines which artifact tier contains this
  difficulty: number,          // 1-5, affects distractor similarity (independent of rarity)
  fun_score: number,          // 1-10, editorial rating of interestingness
  novelty_score: number,      // 1-10, how surprising is this to most people
  age_rating: "kid" | "teen" | "adult",
  sensitivity_level: number,  // 0-5 (0 = universally safe)
  sensitivity_note?: string,  // Why it's flagged (editorial)

  // Sourcing
  source_url: string,         // Where we verified this fact
  source_name: string,        // Human-readable source (shown on fact card)

  // Connections
  tags: string[],             // For cross-referencing and gap analysis
  related_facts: string[],    // IDs of related facts for "deep dive" chains

  // Media
  image_prompt: string,       // Prompt for generating pixel art illustration
  image_url: string,          // Generated pixel art image for this fact
  mnemonic?: string,          // Visual/verbal mnemonic to help remember

  // Language learning fields (used when type != "fact")
  language?: string,          // Target language code (e.g., "es", "ja")
  pronunciation?: string,     // IPA or phonetic guide
  example_sentence?: string,  // Usage in context
  audio_url?: string,         // Pronunciation audio clip
}
**Why 25 distractors?** Each quiz shows 1 correct + 3 randomly selected distractors from the pool of ~25. This prevents players from memorizing the wrong answers by process of elimination. With 25 distractors, a fact can be quizzed hundreds of times before the player sees the same set of 3 wrong answers. This is critical for the spaced repetition system — players must actually *know* the answer, not just recognize which wrong answers they've seen before.

**Difficulty vs Rarity**: These are independent axes. Difficulty (1-5) affects how similar the distractors are to the correct answer. Rarity (Common-Mythic) reflects how *awesome/memorable* the fact is. A Common artifact can have an easy or moderate fact, a Legendary has the most mind-blowing facts regardless of quiz difficulty.

### Pixel Art Per Fact
**Every fact gets a unique pixel art illustration.** We have GPU resources (RTX 3060) and the ComfyUI pipeline, so we generate one per fact.

**Rules for fact images:**
- The image must **illustrate the topic** but **NOT reveal the answer**
  - YES: A pixel art octopus for "How many hearts does an octopus have?"
  - NO: A pixel art octopus with 3 visible hearts
- Images use **greyscale-to-color progression** based on mastery level:
  - New/Learning: fully greyscale — mysterious, unknown
  - Familiar: partial color bleeding through
  - Known: mostly colored
  - Mastered: full vibrant color
  - This mirrors the Knowledge Tree leaf color system
- Creates a visual incentive: players want to see their facts "come alive" with color
- Image generation pipeline: auto-generated from `image_prompt` field via ComfyUI, reviewed for quality

### GAIA Comments (Snarky Ingestion Notes)
Every fact has a pre-generated `gaia_comment` — a short, personality-driven remark from GAIA that plays during artifact ingestion:
- "Octopuses have three hearts? I can barely keep ONE processing unit running!"
- "Cleopatra and the Moon landing... time is WEIRD, right?!"
- "Blue whale hearts are the size of a car. I... I need a moment."
- Comments should be: snarky, enthusiastic, occasionally self-deprecating, always brief
- Generated during the fact creation pipeline (not at runtime)
- Shown as a speech bubble from GAIA's avatar during the gacha reveal moment

### Visual Mnemonics
Facts can include a `mnemonic` field — a memory aid to help retention:
- **Visual mnemonics** are the highest priority (images or described scenes that encode the answer)
- Example: "Octopus + 3 hearts → picture an octopus juggling 3 hearts"
- GAIA offers mnemonics when a player struggles with a fact (gets it wrong multiple times)
- "Having trouble? Here's a trick: think of octopuses as the 'three-hearted aliens of the sea'..."
- Mnemonics are generated during fact creation, not at runtime
- Not every fact needs one — prioritize facts that players commonly get wrong (tracked via analytics)

### Language Learning Schema (Future-Proofing)
The fact schema is designed from the start to support language learning:
- `type` field distinguishes facts from vocabulary/grammar/phrases
- Language-specific fields (`language`, `pronunciation`, `example_sentence`, `audio_url`) are optional
- A vocabulary "fact" works identically in the quiz system: "What does 'biblioteca' mean in Spanish?" + 25 plausible English word distractors
- For vocabulary, distractors are **automatically generated** from semantically similar words in the same language — much easier than fact distractors
- The Knowledge Tree can have a "Languages" major branch with sub-branches per language
- Artifacts can contain language items in the same way they contain facts
- This allows language learning to be a **natural extension** of the existing system, not a bolt-on

### Fact Categories (Wikipedia-Inspired Structure)
Top-level branches (expandable over time):
- **Natural Sciences**: Physics, Chemistry, Biology, Earth Science, Astronomy
- **Life Sciences**: Evolution, Ecology, Human Body, Animals, Plants
- **History**: Ancient, Medieval, Modern, Contemporary, Prehistoric
- **Geography**: Countries, Oceans, Mountains, Climate, Geology
- **Technology**: Inventions, Computing, Engineering, Space Exploration
- **Culture**: Art, Music, Literature, Philosophy, Mythology
- **Language** (future): Vocabulary, Grammar, Etymology, Phrases

Each branch subdivides further, following Wikipedia's category structure as a guide.

### Fact Quality Pipeline
1. **Ingestion**: Extract candidate facts from curated sources (Wikipedia, science journals, educational content)
2. **Scoring**: Rate each fact on fun, novelty, accuracy, and learnability
3. **Distractor Generation**: Create ~25 plausible wrong answers per fact (critical — see why above)
4. **Categorization**: Place in the knowledge hierarchy
5. **Review**: Human editorial pass for quality, accuracy, and interestingness
6. **Storage**: Qdrant/Graphiti vector database for semantic search, gap analysis, and duplicate detection
7. **Gap Analysis**: Identify which categories are under-represented and need more content
8. **Player Feedback Loop**: Facts flagged as "not interesting" by players are reviewed and potentially replaced

### Content Scale
- **Phase 1 (Testing)**: ~500 high-quality facts across all categories
- **Phase 2 (Launch)**: ~5,000 facts
- **Phase 3 (Growth)**: 10,000+ facts
- **Long-term**: Language learning integration (vocabulary, phrases, grammar as "facts")

### Data Discs (Deep Dive Content)
- Special collectible found during dives (rarer than standard artifacts)
- Contains an **expanded pack** of facts around a specific topic
- e.g., "Data Disc: The Solar System" contains 10-20 detailed facts about planets, moons, orbits
- Can also be purchased in a shop to expand a category the player is interested in

## Quiz System

### When Quizzes Happen

| Context | Trigger | Stakes |
|---|---|---|
| **Quiz Gates** (during dive) | Barrier blocks in the mine | Wrong answer costs oxygen. Correct = proceed. Max 2 failures before forced bypass with penalty. |
| **Artifact Mining** (during dive) | Mining an artifact node | Number of correct answers (with max 2 failures) determines reward rarity boost |
| **Morning/Evening Review** (at base) | Daily login ritual | Bonus oxygen for completing reviews |
| **Pop-up Reviews** (at base) | Random prompts, couple per day | Small oxygen bonus |
| **Study Session** (at base) | Voluntary, player-initiated | Knowledge Tree growth, mastery progress |
| **Random Mining Quiz** (during dive) | Occasionally when mining any block | Small reward for correct, no penalty for wrong |

### Quiz Format
- **Multiple choice**: 1 correct answer + 3 distractors (randomly selected from the fact's pool of ~25)
- Distractors are from the **same domain** as the correct answer (e.g., if the answer is "Jupiter," distractors are other planets — not random words)
- **Different 3 distractors each time** the fact is quizzed — prevents memorizing wrong answers
- Difficulty of distractors scales with:
  - The fact's inherent difficulty rating
  - The depth layer where the quiz appears (deeper = harder)
  - The player's mastery level of this fact (Anki interval)
- **No time pressure on quizzes** — this is a learning game, not a speed test. Players should think carefully.

### Quiz Gate Flow (During Dive)
1. Player encounters a quiz gate block
2. Question appears (from due-for-review facts, or new facts if none due)
3. Player answers
4. **Correct**: Gate opens, proceed. Small oxygen bonus possible.
5. **Wrong (1st failure)**: Oxygen penalty. Can try again with a different question.
6. **Wrong (2nd failure)**: Gate opens with larger oxygen penalty. Forced through.
7. Maximum 2 failures per gate — never hard-block progress

### Artifact Quiz Flow (During Dive)
1. Player mines an artifact node
2. Quick quiz sequence (2-3 questions)
3. Each correct answer improves the chance of a **rarity upgrade** on the artifact
4. Max 2 failures allowed
5. Result: artifact with potentially boosted rarity enters backpack

## Spaced Repetition (Anki-Style)

### Algorithm: SM-2 Variant
Based on the SuperMemo SM-2 algorithm, the gold standard for spaced repetition:

**Core variables per fact (hidden from player):**
- `ease_factor`: Starts at 2.5. Adjusted by response quality.
- `interval`: Days until next review. Starts at 1 day.
- `repetitions`: Number of consecutive correct reviews.
- `quality`: Last response quality (0-5 scale internally, mapped from player input).

**After each review:**
- **Correct (quality >= 3)**: Increase interval by `interval * ease_factor`. Increment repetitions.
- **Wrong (quality < 3)**: Reset interval to 1 day. Reset repetitions to 0. Decrease ease_factor (minimum 1.3).
- Ease factor adjusts: `ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))`

**Player-facing interface**: Simple right/wrong, possibly with a "that was easy" / "that was hard" modifier. The algorithm complexity is entirely hidden.

### Mastery Levels
As a fact's interval grows (meaning the player keeps getting it right over longer periods), it progresses through mastery levels:

| Level | Interval | Visual | Meaning |
|---|---|---|---|
| New | 0 days | Seed | Just discovered |
| Learning | 1-3 days | Sprout | Actively being learned |
| Familiar | 4-14 days | Young leaf | Getting comfortable |
| Known | 15-60 days | Full leaf | Solidly learned |
| Mastered | 60+ days | Golden leaf | Deeply retained |

### Leaf Decay
- If a player gets a fact **wrong** during review, the leaf on the Knowledge Tree **wilts** (visual feedback)
- The fact re-enters active rotation with a shortened interval
- Leaves can regrow easily — this is not punishing, just visual feedback
- Mastered facts that haven't been reviewed in a very long time may show slight color changes as a gentle reminder

### In-Run Quiz Consistency Penalty
If a player answers a fact correctly during a base study session but then gets it **wrong during a dive quiz gate**, there is a **heavy penalty** to that fact's SM-2 scores. The rationale: getting it right at home in a calm setting but wrong under pressure means you don't truly know it yet. This prevents false mastery and ensures the Anki system reflects genuine retention.

## Study Session Experience

### Setting & Mood
Study sessions are a deliberate **contrast to the action of diving**:
- The miner sits in a comfy chair, helmet off, relaxed posture
- Calm ambient background (dome sounds, soft music)
- The Knowledge Tree is visible nearby — you can see it react to your answers
- This should feel like a peaceful, rewarding ritual, not a test

### Study UI: Card Flip
- Player sees the **question** on a card
- They think about the answer (no timer, no pressure)
- **Tap to flip** the card — reveals the answer
- Player self-rates: "Got it" / "Didn't get it" (maps to SM-2 quality internally)
- The pixel art illustration is shown alongside, gaining color as mastery increases

### Session Length
- Player chooses session size: **5 or 10 facts** per session
- The system selects facts that are **due for review** (SM-2 scheduling)
- If no facts are due, the system suggests new facts from recently ingested artifacts
- Option to continue after the session ("Keep studying?" prompt)

### Tree Growth During Study
- When a fact is answered correctly, the corresponding **leaf on the Knowledge Tree shimmers and grows slightly**
- Camera focuses on a **small subset of the tree** — the branch where the current fact lives — so the player sees the immediate impact of their learning
- Over a full study session, the tree visibly changes — deeply satisfying

## Knowledge Tree

### Concept
A visual, growing tree at the center of the player's dome (base). It represents everything they've learned. Each **leaf** is a mastered fact. **Branches** are categories and subcategories. The tree grows as the player learns, creating a beautiful, personalized visualization of their knowledge.

### Structure
```
Knowledge Tree (trunk)
├── Natural Sciences (major branch)
│   ├── Physics (branch)
│   │   ├── "Light takes 8 minutes to reach Earth" (leaf - mastered, golden)
│   │   ├── "Gravity on Moon is 1/6th of Earth" (leaf - known, green)
│   │   └── "Sound can't travel in vacuum" (leaf - learning, sprout)
│   ├── Biology (branch)
│   │   ├── Evolution (sub-branch)
│   │   │   ├── "Birds descended from dinosaurs" (leaf)
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── History (major branch)
│   └── ...
└── ...
```

### Visual Properties
- **Leaf color** reflects mastery level (see table above)
- **Leaf size** may reflect fact rarity/importance
- **Wilting leaves** = facts that need review (gentle visual nudge)
- **Branch thickness** grows as more facts are mastered in that category
- **Completion percentage** shown per branch ("Biology: 34% explored")
- Tree should be **beautiful and shareable** — a point of pride

### Gameplay Integration
- Primarily **cosmetic and social** — a trophy of learning
- Can be **shared** with other players (visit each other's domes)
- **Completion percentages** drive completionists
- **Future potential**: Unlocking branch bonuses (e.g., completing Geology gives mining bonuses). Deferred for now to keep focus on intrinsic learning motivation.
- Fully learned facts are never lost — the Knowledge Tree is **permanent progression**

### Knowledge Store (Planned)
- After learning a specific number of facts in a category, unlock purchases in the Knowledge Store
- Small powerups, cosmetics, decorations tied to the knowledge category
- Creates a mechanical reward for sustained learning without making it feel forced
- Currency: earned through learning milestones, not bought

## Fact Selling vs. Keeping: The Core Trade-Off

Why would a player keep a fact instead of selling it for minerals?

**Reasons to sell:**
- Immediate mineral income for crafting/upgrades
- Higher rarity = more minerals (tempting!)
- Already have too many facts in active rotation

**Reasons to keep:**
- Knowledge Tree growth (permanent, visible, shareable)
- Potential passive bonuses from branch completion (future)
- Knowledge Store unlocks from learning milestones
- Intrinsic satisfaction of growing knowledge
- Better quiz performance = more oxygen = more play time (mastery loop)
- Players who learn well can play indefinitely for free

**Design intent**: Both choices should feel valid. Selling should never feel wasteful, and keeping should never feel like a grind. The balance will need careful tuning.
