# Recall Rogue: comprehensive mechanics research compendium

**The richest design space for a quiz-powered card roguelite lies at the intersection of Slay the Spire's keyword synergy systems, Balatro's multiplicative scaling psychology, and educational science's "desirable difficulties" framework.** This research compendium distills mechanical patterns from 20+ roguelites and the best educational game design research into actionable design fuel. The core finding across all domains: the most satisfying mechanics create *informed decisions under resource pressure* — exactly what a quiz-charge system naturally provides. Every section below maps directly to design opportunities for Recall Rogue.

---

## Slay the Spire's mechanical vocabulary is the genre's Rosetta Stone

STS established the foundational grammar of card roguelites through **6 core keywords**, **4 character archetypes**, and dozens of cross-cutting design patterns. Understanding these deeply reveals the mechanical atoms you can recombine with quiz integration.

### Keywords as atomic building blocks

**Exhaust** (remove from combat on play) is the keyword with the deepest synergy web. Cards like Corruption make all Skills cost 0 but Exhaust them; Feel No Pain generates **3 Block per Exhaust**; Dark Embrace draws a card per Exhaust; the Dead Branch relic generates a random card per Exhaust. These four pieces together create one of the game's most iconic combos — free Skills that defend you, draw cards, and replace themselves. The design lesson: a *cost keyword* becomes a *benefit keyword* when enough synergy pieces exist. For Recall Rogue, consider "Burn" or "Fade" keywords where correctly answering quiz questions during the card's Exhaust could recycle it instead.

**Ethereal** (auto-Exhausts if unplayed at turn end) creates "use it or lose it" tension. **Retain** (persists in hand between turns) does the opposite — enabling setup across turns. The Watcher's Establishment Power reduces cost of Retained cards each turn, while cards like Windmill Strike and Perseverance grow stronger each turn they're Retained. **Innate** (always in opening hand) guarantees setup pieces arrive on time. **X-cost cards** spend all remaining energy for scaled effects — synergizing with energy generation from Calm stance exit, Plasma orbs, or Ice Cream (relic that preserves unspent energy between turns).

### Character archetypes as design templates

**Ironclad** explores three mechanical territories: self-damage-as-resource (Offering loses 6 HP to gain 2 Energy + 3 cards; Rupture gains Strength whenever HP is lost from a card), Strength-scaling with multi-hit attacks (Limit Break *doubles* current Strength; Whirlwind hits all enemies X times, where each hit adds full Strength), and Exhaust engines (Corruption + Feel No Pain + Dark Embrace). The Block-to-damage loop (Barricade makes Block persist + Body Slam deals damage equal to Block + Entrench doubles Block) demonstrates how converting one resource into another creates satisfying builds.

**Silent** demonstrates damage-over-time (Poison ignores Block, scales quadratically, and Catalyst doubles or triples all Poison — Burst + Catalyst+ = ×9 multiplication in one turn), disposable card generation (Shivs are 0-cost attacks that Exhaust, amplified by Accuracy Power for +4-6 damage each), discard synergies (Tactician gains Energy when discarded; Reflex draws cards when discarded — creating cards whose value comes from *not* playing them), and the Burst/Nightmare duplication system (Nightmare creates 3 copies of any card for next turn; Nightmare + Catalyst+ = ×81 Poison multiplication).

**Defect** introduces a persistent resource layer through **Orbs** — Lightning (damage), Frost (Block), Dark (accumulating damage), and Plasma (Energy) — each with passive end-of-turn effects and stronger one-time Evoke effects. **Focus** scales all orb output, making it the Defect's Strength equivalent. The 0-cost ecosystem (Claw permanently gains +2 damage each time *any* Claw is played; All for One retrieves all 0-cost cards from discard pile) creates scaling-through-volume. Echo Form (first card each turn plays twice, permanently) demonstrates how doubling effects create multiplicative excitement.

**Watcher** has the most mechanically complex character through **Stances**: Calm grants 2 Energy on exit, Wrath doubles all damage dealt *and received*, Divinity triples damage and grants 3 Energy. The core loop — enter Calm, switch to Wrath gaining Energy, deal doubled attacks, exit before the enemy turn — creates a rhythmic, technical playstyle. Mental Fortress (gain Block on every stance change) and Flurry of Blows (returns to hand on stance change) reward rapid stance cycling. Mantra accumulates toward Divinity's triple-damage state. Pressure Points applies Mark that deals non-decaying damage unaffected by stances — a completely orthogonal damage type. Alpha→Beta→Omega is a multi-turn investment chain (6 Energy across 3+ turns) paying off with **50 AoE damage every turn forever**.

### Cross-character patterns most relevant to Recall Rogue

**Powers** (persistent effects) trade immediate tempo for compounding value — the same fundamental tradeoff as investing time in a quiz answer vs. Quick Playing. **Conditional bonuses** ("if X, then bonus Y") appear on dozens of cards: Bane doubles damage if the target is Poisoned; Finisher deals damage per Attack played this turn; Grand Finale deals 50 damage but only if the draw pile is exactly empty. These conditions create the same "prove your mastery for a bonus" feeling that quiz-charging provides. **Status/Curse anti-synergy** is turned into synergy by specific cards: Evolve draws cards when you draw a Status; Fire Breathing deals AoE damage. This "turn weakness into strength" pattern maps directly to wrong-answer mechanics in Recall Rogue.

---

## Beyond Slay the Spire: 12 games that expanded the design space

Each post-STS deckbuilder carved out unique mechanical territory. Here are the innovations most relevant to quiz-integrated design.

### Spatial and positional systems

**Monster Train** adds vertical tower defense — three floors with limited unit capacity, enemies ascending each turn, a Pyre whose non-regenerating HP serves as a run-long resource budget. The clan system (Morsel feeding economy where small units are *eaten* by larger ones for stat buffs; Reform mechanic where dead units return stronger with Burnout counters; Incant triggers that reward spell-heavy play) demonstrates how faction-specific keywords create distinct playstyles. **Inscryption** uses lane-based combat with Blood sacrifice (kill your own creatures to summon stronger ones) and a transferable Sigil system where abilities move between cards at sacrifice altars, enabling custom-built super-cards. **Cobalt Core** makes ship alignment the core puzzle — guns only hit what's directly across, creating a spatial optimization layer on every card play. **Fights in Tight Spaces** combines deckbuilding with grid-based tactical positioning where a Combo meter rewards sequential attacks but decays on movement.

### Alternative resource and scoring systems

**Balatro** is the most relevant non-STS model for Recall Rogue. Its core mechanic — poker hands scored as **Chips × Mult** — creates multiplicative scaling where Joker activation order matters (additive +Mult must come before multiplicative ×Mult in the left-to-right evaluation). Retrigger effects (Red Seal, specific Jokers) cause cards to score multiple times, each pass applying all triggered Joker effects — creating **exponential growth** that produces eureka moments. This multiplicative math engine is directly analogous to quiz-charge multipliers. **Wildfrost** replaces energy with individual attack counters on every unit, eliminating per-turn resource spending entirely — each unit has its own countdown timer, and players manipulate these counters to sequence actions.

### Dual-system and parallel deck designs

**Griftlands** runs combat and negotiation as separate card-based systems with different decks, where NPCs remember your choices and relationships affect both systems. **Nowhere Prophet** splits leader cards (spells/abilities) from follower cards (units with permadeath — two lethal hits and they're gone forever from your deck). **Roguebook** adds gem socketing into cards for modular customization, plus a map-painting exploration layer where spending ink to reveal tiles drives progression.

### The Balatro insight for quiz multipliers

Balatro proves that **watching numbers multiply is intrinsically thrilling**. Its scoring creates dramatic escalation: a Level 1 Flush scores 35×4=140, but with stacked Jokers, the same hand might score 35×4×2×3×1.5=1,260. Players feel like they're "breaking" the game. For Recall Rogue, this suggests quiz-charging should feel multiplicative, not additive — **×2 for a correct answer feels fundamentally more exciting than +10 damage**, even when mathematically equivalent, because multiplication promises escalation.

---

## Educational science reveals exactly how to make quiz-charging feel rewarding

The academic literature on game-based learning provides rigorous frameworks for integrating knowledge testing with gameplay. The research converges on several non-obvious principles.

### Desirable difficulties: harder ≠ worse

Robert Bjork's landmark 1994 research identified that learning conditions which *slow down performance* during training yield **greater long-term benefits**. Four key desirable difficulties — spacing, interleaving, retrieval practice, and generation — all have robust experimental support. Roediger & Karpicke (2006) showed retrieval practice improves long-term recall by **50%** compared to restudying. Pan et al. (2019) demonstrated interleaved practice produces **63% correct** answers on delayed tests vs. 20% for blocked practice. The critical design implication: **quiz questions should feel effortful but achievable**, not trivially easy. A quiz-charge system that always gives easy questions would undermine both learning and gameplay satisfaction.

### The testing effect is your core mechanic

Even *failed* retrieval attempts enhance subsequent learning (Kornell, Hays, & Bjork, 2009). This is the most important finding for Recall Rogue: **wrong answers are not wasted**. Manu Kapur's Productive Failure research (meta-analysis of 12,000+ participants) shows students who struggle before instruction outperform those who receive instruction first, with Cohen's d = 0.36 for conceptual understanding. In the educational game "Virulent," higher failures before initial success predicted **greater learning gains** than time-on-task. Design implication: wrong answers in Recall Rogue should have *tempo costs* (reduced effect, lost turn) rather than *punitive costs* (damage, card loss), and the system should surface the correct answer to leverage the testing effect.

### Spaced repetition as a game mechanic

The Ebbinghaus forgetting curve shows information fades rapidly without review, but spaced repetition — reviewing at expanding intervals just before forgetting — produces **10-30% better retention** (Cepeda et al., 2006 meta-analysis of 254 studies). Brainscape's Confidence-Based Repetition (rate knowledge 1-5 to drive review frequency) outperforms binary know/don't-know systems because metacognition deepens memory traces. For Recall Rogue, this means previously-missed questions should *reappear* in later encounters, and the system should track per-question confidence to calibrate difficulty. Visually, knowledge "decay" could manifest as card effects weakening over floors until re-charged with review.

### What makes studying feel rewarding: the Prodigy and Duolingo models

**Prodigy Math** (100M+ users) integrates math into RPG combat: answering correctly earns Magic Points spent on strategic spell selection. The key insight is that **math is the gateway to gameplay, not the reward itself**. Wrong answers show explanations and skip the player's turn — a tempo cost, not a punishment. **Duolingo**'s most powerful tool is the streak system, which works primarily through **loss aversion** (losing something feels ~2× worse than gaining it): users maintaining a 7-day streak are **3.6× more likely** to stay engaged long-term. The Streak Freeze feature (preserves streak on missed day) reduced churn by **21%**. Duolingo's leaderboards drive **40% more engagement** through competitive social proof.

### Time pressure: use cautiously

Kahoot's experience is instructive. Speed-based scoring (faster correct = more points) initially seemed engaging, but **Kahoot removed streak bonus points** after teacher feedback showed underperforming students gave up when behind, and speed bonuses encouraged guessing over thinking. The speed-accuracy tradeoff is universal across all decision-making research (Heitz, 2014). However, one teacher found accuracy streaks made students "work harder than I've EVER seen" — carefully answering to maintain their streak. For Recall Rogue, **accuracy should be primary, with speed as a small bonus multiplier**, not the dominant factor.

### The Zone of Proximal Flow

The most powerful framework combines Csikszentmihalyi's flow theory with Vygotsky's Zone of Proximal Development. Basawapatna et al. (2013) proposed the "Zone of Proximal Flow" — when challenge slightly exceeds ability, players leave flow and enter the ZPD; with proper scaffolding, they return to flow with increased skill. The optimal design "zig-zags" between mastery moments (confidence-building easy wins) and stretch challenges (growth-producing hard questions). For Recall Rogue, quiz difficulty should adapt: too many correct answers → harder questions; too many wrong → easier ones, maintaining the player in this productive middle zone.

---

## Relic design: what makes passive items electrifying

Across STS, Hades, Risk of Rain 2, Dead Cells, Enter the Gungeon, and Binding of Isaac, relic design follows identifiable patterns ranked by player excitement.

### Build-defining relics are the emotional peak

The most exciting relics fundamentally change how you play. STS's **Snecko Eye** (randomize all card costs but draw +2) transforms deck evaluation — suddenly expensive cards become desirable. **Dead Branch** (Exhaust generates random cards) turns a cost mechanic into an engine. **Ice Cream** (unspent Energy persists between turns) enables saving-up strategies. Risk of Rain 2's **Shaped Glass** (double damage, halve HP) is the ultimate glass cannon fantasy. These items succeed because they're **immediately understandable but strategically deep** and create visible, dramatic effects.

### Tradeoff relics generate the best stories

The design pattern: offer powerful rewards paired with genuine downsides. **Transparency is critical** — both sides must be clearly stated. STS boss relics (Runic Dome: +1 Energy but can't see enemy intents; Calling Bell: 3 relics + 1 permanent Curse) are the gold standard. Hades Chaos Boons impose 3-4 encounters of a debuff followed by a permanent blessing; critically, curses can't kill you, maintaining risk-reward rather than lethality. Dead Cells' cursed chests (one hit = instant death, but must kill 10 enemies for +1 gear level items) create intense gameplay shifts. Returnal's parasites pair a persistent buff with a persistent debuff — praised for transparency. **The worst example is Returnal's malfunction chests (unknown outcomes), widely criticized because tradeoffs require informed consent.**

For Recall Rogue, quiz-themed tradeoff relics are a goldmine: a relic that doubles quiz-charge damage but halves the answer timer; one that gives bonus damage for streak answers but adds a penalty card on streak break; a "Cursed Textbook" that makes all cards quiz-mandatory but increases all multipliers.

### Counter-based and conditional relics create micro-games

STS's Pen Nib (every 10th Attack deals double damage), Incense Burner (every 6th turn grants Intangible), and Shuriken (play 3 Attacks in a turn → +1 Strength) create trackable sub-objectives within each combat. The counter is displayed on the relic icon, making it a visible planning target. Risk of Rain 2's item stacking uses three scaling methods: linear (each copy adds equal value), hyperbolic (diminishing returns preventing 100% caps), and exponential (multiplicative scaling). The most satisfying progression creates **tipping points** where the build suddenly "comes online."

### The ideal relic distribution

Based on successful games: ~50% simple stat relics (foundation layer), ~30% conditional/synergy relics (interesting decisions), ~15% build-defining relics (run-altering power), ~5% tradeoff/cursed relics (highest tension). Build-defining relics must appear early enough to draft around — STS places these as boss relics after Acts 1-2 specifically so players can adapt card selection. Skill-gated rewards (Enter the Gungeon's Master Rounds for no-hit boss clears) are the most satisfying acquisition method because they're earned through performance, not luck.

---

## Event design: meaningful choices between combat encounters

Random events serve as pacing tools, build-manipulation opportunities, and narrative generators. The best events create **informed tradeoffs where the optimal choice depends on current build state**.

### The 8 event design patterns

Research across STS, FTL, Darkest Dungeon, Hades, and others reveals these recurring patterns:

- **Resource tradeoff events** exchange one resource for another (gold for cards, HP for relics), forcing contextual evaluation — 100 gold means everything in Act 1 but nothing in Act 3
- **Deck manipulation events** (card removal, upgrade, transform, duplicate) are the most strategically sought events; STS's Vampires event replaces all Strikes with Bite cards, a dramatic archetype shift
- **Knowledge-gated events** reward experienced players: Darkest Dungeon's curio system gives guaranteed positive outcomes if you use the right provision item, but random (often painful) results otherwise — transforming item knowledge into literal power
- **Equipment-gated events** (FTL's Blue Options) unlock special choices based on current loadout, making build decisions have secondary consequences
- **Cursed temptation events** offer powerful rewards with permanent downsides, testing self-assessment ("Can my build absorb this penalty?")
- **Transformation events** fundamentally alter strategy (Wildermyth character transformations add mechanical abilities along with narrative changes)
- **Gamble/chance events** offer probabilistic outcomes where risk assessment is the skill being tested
- **Pacing/relief events** regulate tension curves and provide breathing room

### Knowledge-as-power in events is Recall Rogue's strongest event opportunity

Darkest Dungeon's curio system is the most directly relevant model. Using Medicinal Herbs on an Alchemy Table transforms a 50% Blight risk into guaranteed loot. This **knowledge drives the entire provision economy** — expert players buy exactly the right supplies for each dungeon type. FTL's Blue Options add special event choices based on crew composition and equipment, but critically, Blue Options are *not always optimal*, preventing automatic selection.

For Recall Rogue, quiz-integrated events could gate better outcomes behind quiz performance: a Mystery Room presents a dangerous artifact, and answering a question correctly reveals whether it's cursed or beneficial (knowledge-gated inspection); a trapped chest requires answering questions to disarm each lock; a merchant offers better prices based on a quiz streak. The Darkest Dungeon model — where player *knowledge* transforms risky gambles into reliable rewards — maps perfectly onto a quiz-as-power design.

### STS2's evolution: no safe choices

Mega Crit's stated design philosophy for STS2 eliminates "do nothing" options from events. Every event forces engagement and carries consequences. Their new Enchantment system applies dramatic card modifiers (e.g., Corrupted: +50% damage but lose 3 HP per play) exclusively at event nodes, making mystery rooms strategically important route targets.

---

## Enemy design: how opponents force strategic adaptation

Enemy design in card roguelites follows **12 identifiable patterns**, each testing different deck capabilities and creating different player decisions.

### The intent system is the genre's most important innovation

STS developer Casey Yano stated: "It was revealing the enemy's intents that finally made Slay the Spire come together." Intent icons show exact damage values (adjusted by debuffs in real-time), attack types, and defensive actions for the current turn. This transforms each turn into a **solvable optimization puzzle** — allocate limited Energy between offense and defense based on perfect information about *this* turn (but uncertainty about future turns). The Runic Dome relic removes intent visibility for +1 Energy, and its difficulty spike demonstrates how essential the system is.

For Recall Rogue, enemy intents could interact with quiz mechanics: an enemy telegraphs a massive attack, but a "Decipher" card lets you quiz-charge to *reveal the next 2 turns of intent*; a "Confuse" card quiz-charges to *change* the enemy's intent.

### Reactive enemies are the strongest quiz-integration opportunity

These enemies respond to specific player actions, directly punishing particular strategies:

- **Gremlin Nob** gains Strength every time you play a Skill card (deck-check: "do you have enough Attacks?")
- **Awakened One** gains Strength when you play Powers, then revives at full HP in Phase 2 (punishes scaling strategies)
- **Time Eater** ends your turn after every 12 cards played and gains Strength (punishes card-spam and infinite combos)
- **Corrupt Heart** deals damage for every card played (Beat of Death) and caps damage per turn at 200 (Invincible), forcing multi-turn fights while punishing volume

For Recall Rogue, reactive enemies could respond to quiz behavior: a "Skeptic" enemy that gains Block whenever you Quick Play (skip quiz); a "Speed Demon" that gains Strength when you answer slowly; an "Echo" enemy that repeats questions you previously answered wrong, dealing bonus damage on those cards.

### Phase transitions, timers, and puzzle enemies

**Phase transitions** (Guardian switches to Defensive Mode at a damage threshold; Slime Boss splits into two weaker slimes at 50% HP; Awakened One revives with deadlier attacks) prevent fights from being one-note and force resource management across stages. **Timer/enrage mechanics** (Cultist gains Strength each turn; Book of Stabbing adds +1 hit per attack; Lagavulin drains -1 Strength/-1 Dexterity permanently) punish stalling and reward aggressive damage. **Puzzle enemies** require specific approaches: Nemesis alternates Intangible (all damage reduced to 1) with attack phases; Darklings must all die on the same turn or revive; Transient has 999 HP but leaves after 5 turns of escalating damage. Monster Train's entire structure is a timer — enemies ascend through floors each turn, and the Pyre's non-regenerating HP creates a persistent resource budget across the whole run.

### Boss design teaches through escalation

Elites test specific capabilities (**"deck checks"**): Gremlin Nob checks Attack density, Sentries check status-card handling, Book of Stabbing checks damage speed. Bosses test comprehensive competence across multiple mechanics with phase transitions and combined threats. Critically, **STS shows boss identity at the top of the map before you start the act** — players see "Time Eater is the Act 3 boss" and plan their entire drafting strategy accordingly. This transforms bosses from surprise challenges into known destinations that shape every decision.

---

## Synthesis: design atoms for Recall Rogue's quiz-charge system

Drawing from all six research domains, here are the highest-potential mechanical patterns mapped to quiz integration.

### The Quick Play / Charge duality maps onto proven frameworks

The base Quick Play / Charge design mirrors several proven patterns simultaneously. It maps to STS's **frontloaded vs. scaling tradeoff** (Quick Play = immediate but weak; Charge = invested but powerful). It maps to Balatro's **multiplicative scaling psychology** (Charge multipliers feel thrilling). It maps to educational research's **desirable difficulty** (effortful retrieval produces better learning). And it maps to Prodigy's **learning-as-gateway** model (knowledge unlocks power). The research strongly supports this as a core mechanic.

### Five mechanical principles distilled from the research

**Accuracy over speed, with speed as a bonus.** Kahoot's removal of speed bonuses after negative outcomes confirms: primary rewards should be for correct answers, with faster answers earning a small additional multiplier (perhaps ×2.0 base for correct, up to ×2.5 for fast correct). Wrong answers should still play the card at reduced effect (×0.5), not zero — Productive Failure research shows even failed attempts have value, and punishing wrongness too harshly kills engagement.

**Streaks should compound multiplicatively.** Duolingo's streak research (3.6× retention for 7-day streakers), combined with Balatro's exponential-growth excitement, suggests a quiz-streak system where consecutive correct answers build a visible multiplier: first correct = ×2, second = ×2.2, third = ×2.5, etc. Streak breaks reset to base but don't punish — this leverages loss aversion (protecting the streak) without creating frustration (no negative consequence beyond losing the bonus).

**Spaced repetition should be mechanically visible.** Questions the player has answered incorrectly should reappear in later encounters, with bonus rewards for getting them right the second time. This could manifest as "Mastery Marks" on cards — visible indicators that a question has been answered correctly multiple times, granting permanent small bonuses. Brainscape's 1-5 confidence rating could map to quiz-charge tiers: a question you've mastered charges at ×3, while an unfamiliar one charges at ×2 but teaches more effectively.

**Wrong answers should generate resources, not destroy them.** The testing effect proves failed retrieval enhances later learning. Mechanically, wrong answers could generate "Insight tokens" that fuel special abilities, or add the correct answer to a visible "Study List" that grants meta-progression bonuses. The Ironclad's status-card anti-synergy pattern (Evolve draws cards when you draw a Status) provides the template: cards that convert wrong answers into something useful.

**Difficulty adaptation should maintain the Zone of Proximal Flow.** Questions should get harder after streaks and easier after misses, keeping the player in the productive zone between boredom and anxiety. This zig-zag mirrors STS's pacing of easy encounters → elites → rest sites → bosses, creating rhythm rather than monotone difficulty.

### Keyword mechanics adapted for quiz integration

Drawing from STS's keyword vocabulary, here are quiz-adapted mechanical atoms:

- **Recall** (Retain equivalent): A card with Recall stays in hand between turns and can be quiz-charged once per turn, growing stronger each time it's successfully charged — directly paralleling Perseverance's growth-while-Retained mechanic
- **Cram** (Burst/Double Tap equivalent): The next card you quiz-charge this turn applies its effect twice — rewarding the player for investing in a difficult quiz answer
- **Blank Out** (Ethereal equivalent): Card auto-Exhausts if not quiz-charged this turn — creating "must answer or lose it" tension
- **Epiphany** (Power equivalent): Persistent effect that activates each turn you answer a quiz question correctly — scaling reward for consistent knowledge
- **Brain Freeze** (Curse equivalent): Unplayable cards added by enemies that can only be removed by answering their attached question correctly — wrong answers are literally obstacles; knowledge literally clears your deck
- **Mastery** (scaling keyword like Claw): Each time you correctly answer this card's quiz category, ALL cards of that category gain permanent +1 damage — rewarding deep knowledge in specific subjects

### Relic designs for a knowledge-powered roguelite

Drawing from the relic research, quiz-specific designs:

- **Cramming Goggles** (boss tradeoff relic): All cards must be quiz-charged (no Quick Play), but all multipliers are ×3 instead of ×2. Expert-only pick, rewarding confident quiz takers — parallels Runic Dome's knowledge-gated power
- **Rubber Duck** (conditional relic): After 3 wrong answers, gain 1 Energy. Turns failure into a safety net — parallels Dead Cells' Alienation mutation converting curses into healing
- **Streak Trophy** (counter relic): Every 5 consecutive correct answers, deal 15 damage to all enemies. Visible counter creates a compelling sub-game — parallels Incense Burner's tracked countdown
- **Cursed Encyclopedia** (tradeoff relic): +1 card draw per turn, but one random card per hand becomes quiz-mandatory (can't Quick Play it). More cards with more quiz pressure — parallels Snecko Eye's increased draw with randomized costs
- **Confidence Crystal** (scaling relic): Each correct answer this combat grants +1 to all future quiz-charge multipliers this combat. Snowballing knowledge power — parallels Strength-gaining-per-turn mechanics
- **Cheat Sheet** (limited-use relic): 3 charges; spend a charge to see the answer before committing. Recharges between acts — parallels STS's Smoke Bomb escape item

### Enemy designs that test knowledge differently

- **The Skeptic**: Gains 3 Block whenever you Quick Play a card. Forces quiz engagement — parallels Gremlin Nob punishing Skills
- **Memory Leech**: When it attacks, it "steals" a correct answer from your mastery tracker, making that question reappear as unfamiliar. Quiz-themed debuff — parallels Time Eater's anti-accumulation design
- **The Examiner** (boss): Phase 1 uses standard intents. At 50% HP, enters "Final Exam" mode where every enemy action requires you to quiz-charge a response or take double damage. Ultimate knowledge test — parallels Awakened One's phase transition
- **Echo Chamber**: Repeats questions you previously got wrong. Correct answers deal bonus damage; repeated wrong answers buff the enemy. Spaced repetition as enemy design
- **Speed Demon** (timer enemy): Gains +2 Strength each turn AND reduces your quiz timer by 1 second each turn. Must be killed quickly — combines Book of Stabbing's urgency with quiz-specific pressure
- **The Dunning-Kruger** (puzzle enemy): Has Intangible during turns when you Quick Play any card. Can only be damaged on turns where ALL played cards are quiz-charged. Forces all-in knowledge commitment — parallels Nemesis's Intangible windows

### Event designs leveraging knowledge-as-power

- **The Ancient Library**: Choose a subject category to "study." Answer 5 questions — each correct answer upgrades a random card of that type. Wrong answers add a Confusion status card. Knowledge investment with risk
- **The Riddling Sphinx**: Poses a single hard question. Correct = choice of rare card, relic, or full heal. Wrong = lose 15% max HP. High-stakes single-question gamble — parallels FTL's Giant Alien Spiders risk/reward
- **Cursed Textbook**: Gain a powerful relic, but 3 random cards in your deck become quiz-mandatory for the rest of the run. The Darkest Dungeon curio model — knowledge of your own deck determines whether this is a buff or a burden
- **The Tutor**: Remove any card from your deck for free — but you must correctly answer a question about the card's effect to "prove" you understand why you're removing it. Meta-knowledge event
- **Study Hall** (rest site alternative): Instead of resting (heal) or upgrading (improve a card), you can "Study" — answer questions to pre-charge cards in your deck with bonus multipliers for the next combat. Strategic quiz investment

---

## Conclusion: the core design thesis

The deepest insight from this research is that **quiz-charging is not a gimmick bolted onto a card game — it IS the resource system**. Just as STS's Energy creates every meaningful decision (what to play with limited resources), Recall Rogue's quiz system should be the fundamental constraint that makes every turn interesting. The best card roguelite mechanics all share one trait: they convert player skill into compounding power. STS converts deckbuilding skill. Balatro converts mathematical pattern recognition. Hades converts action-game reflexes. Recall Rogue should convert *knowledge itself* into the scaling resource that defines runs.

The research points to three non-negotiable design principles. First, wrong answers must feel like **progress, not punishment** — the testing effect proves failed retrieval enhances learning, so mechanically, wrong answers should have tempo costs (reduced multiplier) rather than punitive costs (damage, card loss), and the correct answer should always be revealed. Second, **multiplicative scaling is where the excitement lives** — Balatro's exponential growth, Ironclad's Limit Break doubling, Silent's ×81 Catalyst chains all prove that watching numbers compound is intrinsically thrilling. Quiz streaks should multiply, not add. Third, **the quiz system should interact with every other system** — relics that modify quiz behavior, enemies that react to quiz performance, events that gate outcomes behind knowledge, and card keywords that reference quiz mechanics. When knowledge touches everything, studying becomes the core power path not because the game forces it, but because the player *wants* every advantage they can get.









################## OVERHAUL CHANGES

You're right on all counts. Let me go through this rigorously.

---

## Fixing the Confusion Matrix Question First

The relic as I described it does NOT show the correct answer, but it does effectively eliminate one distractor. Here's why it's still problematic: the confusion matrix tracks `(targetFactId, confusedFactId)`. A red tint on "Malleus" when the correct answer is "Stapes" tells you "Malleus is wrong here." In a 3-option question, that's a jump from 33% to 50% guess rate. At legendary rarity that's maybe acceptable — but across a whole run it compounds into trivializing the quiz system at exactly the moment it should be hardest. **I'm dropping it entirely.** The confusion matrix should stay invisible and do its work behind the scenes, making distractors harder — not giving the player a cheat code.

---

## Three System Additions

### 1. Knowledge Aura

A per-encounter gauge, 0–10. Starts at 5. Visible as a subtle ring around the player's HP bar (cool blue at low, warm gold at high).

| Event | Aura Change |
|---|---|
| Correct Charge | +1 |
| Wrong Charge | −2 |
| Quick Play / No Charge | 0 (no change) |

Only three states:

| Range | State | Effect |
|---|---|---|
| 0–3 | Brain Fog | Enemies deal +20% damage |
| 4–6 | Neutral | Nothing |
| 7–10 | Flow State | Draw +1 card per turn |

That's it. Two breakpoints. No AP penalties (those would punish AP-constrained turns unfairly). Quick Play doesn't drain Aura — QP is already punished through lower multipliers, no chains, no mastery progress. Aura purely tracks *Charge accuracy*.

**Why this matters:** Right now, individual correct/wrong answers only affect individual card plays. Aura makes your *pattern of quiz performance* reshape the battlefield. A player at Aura 3 is taking +20% damage from everything — every Quick Play becomes riskier because you're not rebuilding your knowledge momentum. A player at Aura 8 draws 6 cards per turn and has more options. The quiz performance becomes the strategic backbone, not just a per-card multiplier.

**What it enables:** Enemies, cards, and relics can now reference Aura state. "When Aura ≥ 7..." or "deals bonus damage equal to Aura" become clean design hooks.

### 2. Review Queue

A per-encounter list (internally unlimited, UI shows top 3 as small icons near the chain display) that fills with fact IDs from wrong Charge answers. Specific card mechanics (Recall, Overcharge) can reference it.

Getting a Review Queue fact right on a later Charge clears it from the queue and triggers bonus effects on cards that reference it. The queue resets each encounter.

This makes wrong answers tangible — you can *see* your unresolved mistakes, and specific cards let you revisit them for bonus power. Without cards that reference it, the queue is just a passive display.

### 3. Accuracy Grade (Softened)

Post-encounter quiz accuracy affects card reward quality. **Normal below 60%. Bonuses only above.**

| Accuracy | Effect |
|---|---|
| Below 60% | Normal rewards (no penalty) |
| 60–79% | Normal rewards |
| 80–89% | +1 card option (4 instead of 3) |
| 90%+ | +1 card option AND guaranteed uncommon+ |

No punishment for struggling. Pure upside for quiz excellence. Pairs with the existing card reward system without disrupting it.

---

## Five Enemy Modifications

I picked enemies that are either thematically named for knowledge but have zero quiz interaction, or are so mechanically generic they add nothing to the roster.

### 1. Pop Quiz (Act 1 Common, uncommon weight 5)

**Current:** HP 7. Poison 2/3t, Weakness 1/2t, Attack 2. *A generic debuff enemy named "Pop Quiz" with no quiz mechanic.*

**Modified:** Keep HP 7 and all existing intents unchanged. Add reactive: at the end of the player's turn, Pop Quiz checks if the player made at least 1 correct Charge. If yes: Pop Quiz is Stunned (skips its next action). If no (only Quick Plays, or wrong Charges): Pop Quiz attacks normally AND gains +1 permanent Strength.

**Why this works:** Every turn becomes a binary decision — "Do I risk a Charge to stun this thing, or play safe knowing it gets stronger?" Perfect Act 1 teaching moment. Players learn that Charging has direct tactical value beyond multipliers. The Strength accumulation punishes extended QP-only play without being immediately lethal.

### 2. Trick Question (Act 2 Common, uncommon weight 5)

**Current:** HP 5. Vulnerable 1/2t, Attack 2. *Named "Trick Question" but mechanically identical to a dozen other commons.*

**Modified:** Keep HP 5 and all existing intents unchanged. Add reactive `onPlayerChargeWrong`: the failed fact ID is locked. Next turn, one random card in the player's hand gets a "Locked" visual overlay — it can ONLY be Charged (Quick Play disabled for that card), and the quiz is forced to use the exact same fact. Correct retry: card plays at 2× power, lock clears. Wrong retry: enemy heals 4 HP. Lock auto-expires after 2 turns if unresolved (no infinite loops).

**Why this works:** You literally cannot avoid your mistake. The game forces you to re-answer what you got wrong. Two-turn cap prevents softlock. The 2× redemption bonus makes the retry feel rewarding, not punitive. And it's scoped to one specific enemy — not a universal system.

### 3. Brain Fog (Act 2 Common, uncommon weight 5)

**Current:** HP 7. Poison 2/3t, Weakness 1/2t. *Named "Brain Fog" but is just another poison/weakness enemy.*

**Modified:** Keep HP 7 and all existing intents unchanged. Add reactive `onEnemyTurnStart`: if the player made 0 correct Charges last turn, one random card in their hand with mastery ≥ 2 loses 1 mastery level ("Fog Erosion" — brief purple mist animation on the card). If the player made at least 1 correct Charge, no erosion occurs.

**Why this works:** The threat isn't to your HP — it's to your *progression*. You've spent charges building mastery on those cards. Brain Fog threatens to undo that work. But the defense is simple: get one Charge right per turn. You don't need to Charge the threatened card specifically, and cards below mastery 2 are safe. The mastery erosion is the thematic mechanic — fog eating your knowledge.

### 4. The Curriculum (Act 2 Boss, HP 14)

**Current:** "Living crystal. Status effects don't stick. It just keeps coming." Attack, Defend, Multi-attack, Heal. *The most generic boss in the game — a stat-wall with no identity.*

**Modified:** Keep HP 14. Phase 1 (100–50% HP): existing intents unchanged, status immunity stays. Phase 2 (below 50% HP): gains `quickPlayDamageMultiplier: 0.0` — Quick Play attack cards deal zero damage. Shield, utility, buff, and debuff cards work normally via Quick Play. Only Charged attacks can deal damage. Additionally gains +2 Strength on phase transition.

**Why this works:** The existing `quickPlayDamageMultiplier` system already supports this (The Singularity uses 0.3). Setting it to 0.0 at 50% HP creates a dramatic tonal shift: "You've been coasting. Now prove you know this material." Players can still defend with QP shields but must Charge every attack. AP management becomes critical — 2 AP per attack card minimum. The boss identity becomes "the exam you can't crib-sheet your way through."

### 5. The Textbook (Act 2 Mini-Boss, HP 8)

**Current:** Defend 2, Charge 5, Attack 2. *The most boring mini-boss — it just blocks and occasionally hits.*

**Modified:** Keep HP 8 and existing intents. Add passive "Hardcover": starts with 8 points of damage reduction (separate from block, displayed as a book icon with a number). Each correct Charge the player makes permanently removes 2 Hardcover. Each wrong Charge restores 1 Hardcover. At Hardcover 0, The Textbook becomes Vulnerable for 2 turns and Hardcover doesn't regenerate. Quick Play damage is reduced by current Hardcover value (minimum 1 damage per hit).

**Why this works:** The Textbook is literally a book you need to *study through*. Each correct answer strips away its defenses. Wrong answers re-thicken its pages. The Vulnerable payoff at Hardcover 0 creates a satisfying "I cracked this thing open" moment. And QP still does *some* damage (min 1 per hit) so the player isn't completely locked out — just heavily incentivized to Charge.

---

## Five Card Modifications

I picked cards that are either broken under v3 rules, thematically misaligned, or mechanically boring relative to their unlock level.

### 1. Recall (Attack, 1 AP, Level 11)

**Current:** "1 damage per card in discard pile / 2 per card." *A discard-pile-count scaler. Mechanically fine but the name "Recall" has nothing to do with recalling knowledge — it's about counting discarded cards.*

**Modified:** QP: 5 damage (flat, no discard scaling). CC: The quiz draws specifically from the Review Queue (facts you got wrong this encounter). If the Review Queue has facts and you answer correctly: 15 damage + heal 3 + fact cleared from queue. If Review Queue is empty: normal CC behavior from the deck pool, 10 damage. CW: 3 damage.

**Why this works:** The name finally means something. "Recall" = recalling knowledge you failed on earlier. The Review Queue interaction is the card's identity. It's the most educationally pure card in the game — it forces you to confront your mistakes and rewards you for learning from them. And it's level 11 unlock so only experienced players see it.

### 2. Precision Strike (Attack, 1 AP, Level 4)

**Current:** "8 damage / 24 damage. Passive: +50% longer invisible timer." *The invisible timer is invisible. The player cannot perceive this passive. It's a dead mechanic.*

**Modified:** QP: 8 damage. CC: Damage scales with the number of answer options in the question. Formula: `8 × (distractor count + 1)`. At mastery 0 (2 distractors, 3 total options): 24. At mastery 3+ (4 distractors, 5 total options): 40. CW: 4 damage. Remove the timer passive.

**Why this works:** No new UI elements needed. The card naturally rewards higher mastery because higher mastery = more distractors = more damage. A player who's pushed a card to mastery 5 faces the hardest questions but gets the biggest Precision Strike payoff. The difficulty-reward loop is built into the card's identity. And removing the imperceptible timer passive is pure cleanup.

### 3. Knowledge Ward (Shield, 1 AP, Level 6)

**Current:** "4 block per unique domain in hand / same × 1.5." *In a curated deck run (which is the primary game mode), all cards are the same domain. This card gives 4 block. It's worse than base Block (which gives 3 at mastery 0 but scales). The mechanic is a dead relic from the old cross-domain system.*

**Modified:** QP: 3 block × number of correct Charges so far this encounter (minimum 1, cap 5). CC: 5 block × correct Charges this encounter (minimum 1, cap 5). CW: 2 block.

At 0 correct charges: 3 QP / 5 CC. At 3 correct charges: 9 QP / 15 CC. At 5 correct charges (cap): 15 QP / 25 CC.

**Why this works:** It scales with your accumulated quiz success this encounter, not a broken domain-diversity check. Early in a fight it's weak. Late in a fight where you've been Charging successfully, it's a monster defensive card. Rewards the player who has been engaging with the quiz system throughout the encounter.

### 4. Smite (Attack, 2 AP, Level 9)

**Current:** "10 damage / 10 + (3 × average hand mastery)." *Average hand mastery is a weird metric. If your hand has cards at mastery 0, 1, 3, 2, 1 — average is 1.4. That's +4.2 bonus damage. Not very exciting.*

**Modified:** QP: 10 damage. CC: 10 + (3 × current Knowledge Aura). At Aura 5 (neutral): 25. At Aura 8 (Flow State): 34. At Aura 3 (Brain Fog): 19. CW: 6 damage + Knowledge Aura −1.

**Why this works:** Ties a 2-AP heavy attack to the new Knowledge Aura system. If you've been answering well all encounter (Aura 8+), Smite hits like a truck. If you've been struggling (Aura 3), it's mediocre. The CW penalty (Aura −1) adds extra sting to missing on your big investment card. Clean, no weird metrics.

### 5. Feedback Loop (Attack, 1 AP, Level 10)

**Current:** "5 / 20 / CW = 0 damage." *Already has the game's strongest "knowledge or nothing" identity with CW dealing 0 damage. But it's just a bigger number on correct and zero on wrong — no other interaction.*

**Modified:** QP: 5 damage. CC: 20 damage. If Knowledge Aura ≥ 7 (Flow State) at time of play: +8 bonus damage (28 total). CW: 0 damage AND Knowledge Aura −3. If Aura was in Flow State before the wrong answer, it likely drops to neutral or Brain Fog in a single miss.

**Why this works:** Enhances the existing identity without changing it. The Aura interaction creates a dramatic arc: you build up Flow State through good answers, then play Feedback Loop for the big 28-damage hit. But miss? Zero damage AND your Aura craters. The risk/reward is sharper than before while remaining consistent with the card's existing design.

---

## Six Relic Modifications

Four of these are relics that are **broken or effectively meaningless** under v3 rules. Two are boring and worth upgrading.

### 1. Scar Tissue (Uncommon, Starter) — BROKEN, MUST FIX

**Current:** "Cursed cards use 0.85× QP instead of 0.70×." **The Cursed Card system was removed in v3. This relic does literally nothing.**

**Replaced mechanic:** Every wrong Charge answer this run permanently adds +1 flat damage to all future correct Charges (added at the relic flat bonus step in the damage pipeline). Display: relic icon shows a small counter of accumulated stacks.

**Why this works:** Your failures compound into future power — but only if you start getting things right. A player who got 8 wrong by floor 5 has +8 damage on every correct Charge for the rest of the run. The worse you did early, the stronger your comeback potential. Thematically perfect: scars that make you tougher.

### 2. Scholar's Crown (Rare, Level 16) — BROKEN

**Current:** "Tier 1 Charged facts +10%, Tier 2+ +40%, Tier 3 auto-Charged +75%." **FSRS tiers are decoupled from combat power in v3. Tier 3 auto-charge is removed. This relic's scaling doesn't function.**

**Replaced mechanic:** Correct Charges on facts from the Review Queue (previously answered wrong this encounter) deal +40% damage. Correct Charges on all other facts deal +10% damage.

**Why this works:** Directly rewards learning from mistakes. The +40% on review-queue facts is enormous — it makes Recall (the reworked card) devastating when paired with this relic. The +10% on all other facts is a nice passive that rewards any Charging. And it gives players a reason to deliberately fail early in an encounter to "load" the Review Queue, then clear it for big damage — a weird but valid strategic choice.

### 3. Domain Mastery Sigil (Rare, Level 18) — FUNCTIONALLY BORING

**Current:** "If deck has 4+ facts from same domain, all same-domain cards get +30% base damage (even Quick Play)." **In curated deck runs, ALL cards are the same domain. This always activates. It's a permanent unconditional +30% damage with zero player interaction.**

**Replaced mechanic:** At the start of each turn, if Knowledge Aura is ≥ 7 (Flow State): gain +1 AP that turn (4 AP total, still subject to the hard cap of 5). If Aura is 0–3 (Brain Fog): lose 1 AP that turn (2 AP total).

**Why this works:** Transforms the Knowledge Aura from a passive state into a dramatic AP swing. In Flow State you get 4 AP — enabling plays like "Charge two 1-AP cards + Quick Play a third" that are normally impossible. In Brain Fog you get only 2 AP — brutally constraining. The relic makes Aura management the center of your strategy. High risk, high reward, and entirely driven by quiz performance.

### 4. Akashic Record (Legendary, Level 22) — BROKEN

**Current:** "Tier 2b+ facts: previously-wrong answer subtly highlighted. Tier 3 auto-Charge multiplier is 1.5×." **Both mechanics reference removed systems (tier-based combat power, Tier 3 auto-charge).**

**Replaced mechanic:** When a Charge selects a fact that hasn't appeared in 3+ encounters (the FSRS cooldown window has fully elapsed — a genuine spaced recall), deal +50% damage and draw 1 card. Tracked via `lastSeenEncounter` in InRunFactState.

**Why this works:** Rewards the spacing effect — remembering something from several encounters ago. The system already tracks `lastSeenEncounter`, so the check is a single comparison. At legendary rarity, this is a powerful engine: the player is rewarded for the FSRS system doing its job (spacing facts out). Knowledge retention is literally converted into card advantage.

### 5. Memory Nexus (Uncommon, Starter) — WORKS BUT BORING

**Current:** "When you correctly Charge 3 cards in one encounter, draw 2 extra next turn." *A simple counter trigger. Once it fires, there's no more interaction.*

**Replaced mechanic:** At the start of each encounter, one random card in your hand is "Flagged for Review" (small 📌 icon). That card's Charge will specifically select a fact with the highest `wrongCount` in your in-run FSRS state — the fact you most need to review. If you Charge the flagged card and answer correctly: +1 mastery to that card + draw 1 extra card. If you Quick Play the flagged card, or Charge a different card, or answer wrong: the flag disappears with no penalty.

**Why this works:** The game is actively *recommending what you should study*. The 📌 flag is a gentle nudge, not a mandate — you can ignore it freely. But following through rewards you with mastery AND draw. Over a full run, this accumulates significant mastery progress on cards the system knows you're weakest on. It's the FSRS algorithm made visible and interactive.

### 6. Lucky Coin (Common, Starter) — GENERIC

**Current:** "Start each encounter with 1 random buff (Empower, +2 block, +1 AP, or Draw 1)." *Random, boring, no player agency.*

**Replaced mechanic:** After 3 wrong Charge answers in a single encounter, your next Charge automatically succeeds (correct answer auto-selected, counts as correct for all purposes including mastery, chain, Aura). Resets each encounter. Visual: the coin flips and lands on heads when it triggers.

**Why this works:** Players who know their deck never trigger it — they don't need it. Players who are learning trigger it exactly when they need help most: after three consecutive failures, they get a free win to stabilize their Aura and confidence. It's a safety net that makes early-learning runs survivable without giving experienced players any advantage. Thematically: sometimes you get lucky.

---

## Mystery Room Overhaul

The existing 27 events stay in their tiers but get study-themed mechanics. Here are 7 rethemed replacements for the most generic existing events, keeping the tier structure and balance ceilings intact.

### Tier 1 (Floor 1+)

**Healing Fountain → The Tutor's Office.** An NPC displays 3 facts from your deck's pool with their correct answers shown openly (no quiz). These fact IDs are flagged `tutorPreviewed: true`. In the next 2 encounters, if any of these facts appear during a Charge and you answer correctly: +30% bonus damage on that play + 5 bonus gold. Heal 10% max HP (down from Healing Fountain's 15% — the knowledge bonus compensates). Stays within the "heals capped at 20% max HP" ceiling.

**Scattered Coins → The Flashcard Merchant.** Spend 25g to "study" one chain theme. The game shows 3 facts from that theme with correct answers. Those fact IDs get +20% Charge damage for the rest of the run. If you can't afford 25g, you can study for free but the bonus is only +10%. Gold economy: net negative (you spend gold), but the damage bonus across remaining encounters is worth it. Stays within "currency gains capped at 25–40g" ceiling (net negative here).

### Tier 2 (Floor 3+)

**Knowledge Tax → The Wrong Answer Museum.** Displays every fact you've gotten wrong this run. For each: the question, your wrong answer (red), correct answer (green). Tap each to "study" it (flip animation). Gain +1 gold per fact studied. All studied facts get their in-run FSRS `wrongCount` reduced by 1 (rebalancing future selection weights). No gold cost, no HP cost. Pure study opportunity. This replaces a "pay gold or HP" event with a "free knowledge review" event.

**Gambler's Tome → The Rival Student.** 5 MCQ questions from your deck pool. After each, a simulated rival answer is revealed (65% accuracy, predetermined by run seed). Beat the rival's score: choice of rare card + heal 10%. Tie: 15 gold. Lose: nothing. The competitive framing makes the quiz feel different from combat. Stays within balance ceilings.

### Tier 3 (Floor 6+)

**Burning Library** (keep name, retheme mechanic). 4 sequential questions using mastery-0 difficulty (easiest variants, 2 distractors). Each correct answer "saves a book" with escalating rewards: first = 15 gold, second = card upgrade, third = heal 10%, fourth = +1 mastery to a random deck card. Each wrong answer = that reward is lost. Tests consistency, not depth. Stays within "max 1 card upgrade per event" ceiling.

### Tier 4 (Floor 9+)

**Final Wager → The Knowledge Gamble.** One question. Hardest possible variant: mastery-5 difficulty, 4 distractors, all confusion-weighted from your personal confusion matrix. Correct: choice of full heal OR +2 mastery to any card you choose. Wrong: lose 8% max HP permanently this run. The highest-stakes single question in the game.

**The Recursion → The Meditation Chamber.** No quiz. Displays your accuracy stats for this run by chain theme (e.g., "Civil War Era: 82%, Founding Fathers: 54%, Progressive Era: 91%"). Choose one theme to "meditate on." For the rest of the run, questions from that theme use 1 fewer distractor (e.g., mastery 3 gets 3 instead of 4). Strategic difficulty management for your weakest area.

---

## What I'm Deliberately Leaving Boring (And Why)

The research document cites a universal design principle: mundane content makes special content feel special. If everything is quiz-integrated, nothing stands out.

**Enemies left generic (83 of 89):** Page Flutter, Thesis Construct, Mold Puff, Ink Slug, Staple Bug, Overdue Golem, and the vast majority of commons/elites/bosses keep their existing intents with no quiz interaction. The 6 quiz-reactive enemies (existing: Crib Sheet, Citation Needed, Grade Curve, Blank Spot, Spark Note, Burnout + the 5 modified above) are roughly 12% of the roster. That's enough to be memorable without being exhausting.

**Cards left as stat-sticks (80+ of 91):** Strike, Block, Power Strike, Reinforce, Guard, Iron Wave, Twin Strike, Shrug It Off, Bash, Sap, Heavy Strike, Multi-Hit, Thorns, Emergency, Fortify — all keep their current "bigger number" identity. The game needs cards where the decision is purely tactical (AP efficiency, block vs damage, single-target vs AoE), not knowledge-gated. The 5 modified cards plus the existing quiz-integrated ones (Gambit, Knowledge Bomb, Dark Knowledge, Curse of Doubt, Siphon Knowledge) bring the total to roughly 12–15% of the card pool with quiz-specific mechanics.

**Relics left as stat-sticks (65+ of 77):** Steel Skin, Vitality Ring, Herbal Pouch, Gold Magnet, Whetstone, Iron Shield, Swift Boots, Aegis Stone — all keep their straightforward passive effects. Players need relics where the evaluation is simple ("more HP good") to contrast with the quiz-integrated relics where evaluation requires understanding your own knowledge level.

---

## Complete Summary Table

| # | Name | Category | Change Type | Core Mechanic |
|---|---|---|---|---|
| 1 | Knowledge Aura | System | NEW | Per-encounter gauge (0–10) driven by Charge accuracy. Brain Fog / Neutral / Flow State. |
| 2 | Review Queue | System | NEW | Wrong-answer fact list, referenced by specific cards and relics. |
| 3 | Accuracy Grade | System | NEW | Post-encounter accuracy → reward quality (bonuses above 60% only). |
| 4 | Pop Quiz | Enemy (Act 1) | MODIFIED | Correct Charge stuns it. No Charge → gains Strength. |
| 5 | Trick Question | Enemy (Act 2) | MODIFIED | Wrong Charge locks the failed fact — forced retry next turn. |
| 6 | Brain Fog | Enemy (Act 2) | MODIFIED | 0 correct Charges last turn → erodes 1 mastery from a hand card. |
| 7 | The Curriculum | Boss (Act 2) | MODIFIED | Phase 2 at 50%: QP attacks deal 0 damage. Must Charge to deal damage. |
| 8 | The Textbook | Mini-Boss (Act 2) | MODIFIED | "Hardcover" armor reduced only by correct Charges. |
| 9 | Recall | Card (Atk, L11) | MODIFIED | CC draws from Review Queue. Correct on reviewed fact = 15 dmg + heal. |
| 10 | Precision Strike | Card (Atk, L4) | MODIFIED | CC damage scales with distractor count (more distractors = more damage). |
| 11 | Knowledge Ward | Card (Shield, L6) | MODIFIED | Block scales with correct Charges this encounter. |
| 12 | Smite | Card (Atk, L9) | MODIFIED | CC damage scales with Knowledge Aura level. |
| 13 | Feedback Loop | Card (Atk, L10) | MODIFIED | CC +8 bonus at Aura ≥ 7. CW = 0 damage AND Aura −3. |
| 14 | Scar Tissue | Relic (Unc.) | FIXED (broken) | +1 flat damage on all future correct Charges per wrong answer this run. |
| 15 | Scholar's Crown | Relic (Rare) | FIXED (broken) | +40% damage on Review Queue facts, +10% on all other Charges. |
| 16 | Domain Mastery Sigil | Relic (Rare) | FIXED (boring) | +1 AP per turn in Flow State. −1 AP per turn in Brain Fog. |
| 17 | Akashic Record | Relic (Leg.) | FIXED (broken) | +50% damage + draw 1 on facts not seen in 3+ encounters. |
| 18 | Memory Nexus | Relic (Unc.) | MODIFIED | Flags 1 card per encounter for review. Correct = +1 mastery + draw 1. |
| 19 | Lucky Coin | Relic (Com.) | MODIFIED | 3 wrong Charges in encounter → next Charge auto-succeeds. |
| 20–26 | 7 Mystery Events | Events | MODIFIED | Tutor's Office, Flashcard Merchant, Wrong Answer Museum, Rival Student, Burning Library, Knowledge Gamble, Meditation Chamber. |