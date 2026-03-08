# Terra Miner — V6 Core Loop Proposition

> **Philosophy:** The game must be addictive FIRST, educational SECOND. Learning is the bonus that justifies the addiction. We want a generation of smart, knowledgeable people who got there because they couldn't stop playing.
>
> **This document** is the single source of truth for the core gameplay loop overhaul. It merges our design decisions with findings from professional game design research (Vampire Survivors, Slay the Spire, Hades, Stardew Valley, Archero, Duolingo, academic studies). Everything else (dome polish, farm, social, cosmetics) comes LATER.

---

## Table of Contents

1. [Research Insights That Changed Our Decisions](#1-research-insights)
2. [The Core Loop](#2-the-core-loop)
3. [Mining: Make Every Tap Matter](#3-mining)
4. [Quiz System: Knowledge As Power](#4-quiz-system)
5. [The Three-Pool Quiz System](#5-three-pool-system)
6. [Loot & Artifacts: The Dopamine Engine](#6-loot--artifacts)
7. [Descent & Loss: Real Stakes](#7-descent--loss)
8. [O2 & Energy: The Tension Clock](#8-o2--energy)
9. [Progression & Meta-Loop](#9-progression)
10. [First Run Experience](#10-first-run)
11. [Session Design & Retention](#11-session-design)
12. [What We're NOT Doing Yet](#12-out-of-scope)
13. [Future Vision: Surface Dungeons](#13-future-dungeons)
14. [All Decided Parameters](#14-parameters)
15. [Open Questions for Playtesting](#15-open-questions)

---

## 1. Research Insights That Changed Our Decisions

These findings come from academic research, developer interviews, and analysis of games generating billions in revenue. Each directly impacts our design.

### Answer Options: 3, Not 4
Rodriguez's 2005 meta-analysis of **80 years of multiple-choice research** found 3 options are optimal. The 4th distractor is "nonfunctional" (selected by <5% of test-takers). Players answer 3-option questions **~5 seconds faster** (36 vs 41 seconds). We use 3 options by default. Hard mode / challenge variants can add a 4th for bonus rewards.

### Depth-Scaling Loss, Not Flat 60%
Kahneman & Tversky's Prospect Theory: losses are psychologically **2× as painful** as equivalent gains. A flat 40% loss *feels* like losing 80%. Instead, scale by depth:
- **Layers 1-5:** Keep 80% on failure
- **Layers 6-12:** Keep 65-70%
- **Layers 13-20:** Keep 50-60%

Always frame as "keep X%", never "lose Y%". This makes the descent decision increasingly dramatic at depth.

### Grid Cap: 30×30 Maximum
Apple HIG: minimum 44pt tap targets. At 40 tiles across on a 6.5" phone, each tile is 1.7mm — impossible to tap accurately. Cap at **30×30** for deepest layers. Progression: 20×20 (L1-5) → 25×25 (L6-12) → 30×30 (L13-20).

### Target 85% Quiz Accuracy
Wilson et al. (2019, *Nature Communications*): optimal error rate for learning is **15.87%** (~85% accuracy). Bjork's "desirable difficulties" framework confirms: learning that *feels* harder during practice produces better long-term retention. Don't make questions too easy. Adaptive difficulty should target this rate.

### Quiz Timing: Subtask Boundaries Only
Adamczyk & Bailey (2004): interruptions at low mental workload moments cause significantly less annoyance. Quizzes trigger after clearing a section, finding a node, or reaching a junction — **never mid-mining-sequence**. This is critical for flow state preservation.

### Chained Runs Need Different Questions
Schimanke et al. (2013): when games are too engaging, players do multiple rounds per session, compressing SM-2 intervals. If a player chains 3 runs, serve **different Pool B/C content each run** within the same session. Pool A (review-due) can repeat since SM-2 handles the scheduling.

### Artifact Opening: 4-Phase Ceremony
Research on Genshin Impact wishes and VS chest mechanics shows the optimal reveal follows:
1. **Build-up** (1-3s): Glowing cracks, rarity-indicating aura, rumble
2. **Reveal** (0.5-2s): Light burst, camera zoom, audio sting
3. **Celebration** (2-5s): Item showcase, rarity effects, stats
4. **Integration** (1-2s): Item flies into inventory, counter animates

Standard artifacts: **3-8 seconds**. Rare+: **8-15 seconds**. Rarity-differentiated visual language at every tier.

### Block Breaking: Multi-Sensory Feedback
Vlambeer's "Art of Screenshake" + Steve Swink's "Game Feel":
- **Visual:** 3-5 crack damage states, material-colored particles, 2-4px screen shake (0.05-0.15s), floating damage numbers, white flash on impact
- **Audio:** 2-4 sound variants per material, ±5-10% pitch randomization, escalating pitch on successive hits, distinct "payoff" break sound
- **Haptic:** Light impact per hit, heavy on break, synchronized within 20-75ms of visual/audio
- **Rule:** Feedback intensity proportional to action significance. Dirt ≠ crystal ore.

### Reward Pacing: 5-10 Seconds Between Events
Top casual games average 5-10 seconds between meaningful events. Roguelites can stretch to 10-15 seconds. **Never go 15+ seconds without feedback.** Layer micro-rewards (particle effects, ore sounds), mid-frequency rewards (nodes, quizzes), and macro-rewards (artifacts, layer completion).

### The "One More Run" Formula
Five concrete ingredients (validated across Hades, Dead Cells, Binding of Isaac, VS):
1. **Meta-progression** — every run advances something permanent
2. **Near-miss frequency ~30%** — maximizes retry desire
3. **Build theorycrafting** — "what if I'd done X differently?"
4. **Near-zero restart friction** — instant restart, no loading screens
5. **Expanding discovery horizon** — the more you play, the more there is to find

### Depth-Reward Curve: 20-50× at Bottom
Every successful mining game follows an exponential pattern: reward value increases **slightly faster** than danger escalates. Layer 20 resources should be worth **20-50× surface resources**, with distinct types appearing every 3-4 layers. Players must see that "two more layers down" holds something **qualitatively different**.

### Never Market As Educational
Research (Sharp 2012, NPR, Assassin's Creed studies): the "educational" label is toxic. Players learn **more** from games not marketed as educational. Stealth learning works because players avoid a biased "this is homework" mindset. Terra Miner markets as a roguelite mining game. Period.

### Delayed Review Rewards: 3-5× Larger
The biggest SM-2 point bonuses should come not at initial learning but at **7-day and 30-day reviews**. This makes long-term retention feel rewarding and encourages players to maintain their study habits.

### Monetization: Multi-Stack, Not Single Model
Cosmetics alone are insufficient for a single-player indie game (47% of players only buy cosmetics after 30+ hours). Recommended stack:
- Free base game (mobile discoverability)
- Terra Pass $4.99/mo (primary revenue)
- Cosmetics $1-5 each (supplementary)
- Rewarded ads at run end (VS model — optional "watch ad for bonus")
- One-time premium unlock $5-10 (for pay-once players)
- O2 system with generous free tier

### Duolingo Streak Data
Users maintaining a 7-day streak are **3.6× more likely** to stay engaged long-term. Streak Freeze reduced churn by **21%**. Our streak system with 500-dust insurance is validated.

### Retention Benchmarks
| Metric | Median | Top 25% | 90th Percentile |
|--------|--------|---------|-----------------|
| D1 | 22.9% | 26-28% | 35.4% |
| D7 | 3.4-3.9% | ~8% | 14.3% |
| D28 | 0.85% | ~3% | 6.1% |

Target: **D1 >30%, D7 >10%, D30 >5%**. D30 predicts long-term health.

---

## 2. The Core Loop

```
┌─────────────────────────────────────────────────────┐
│                   THE CORE LOOP                      │
│                                                      │
│  STUDY (optional, gives mine buff: +1 O2 bank,      │
│    +15 in-mine O2)                                   │
│    ↓                                                 │
│  ENTER MINE (costs O2 from bank, first dive free)    │
│    ↓                                                 │
│  MINE LAYER                                          │
│    • Mine blocks (minerals, artifacts, relics)       │
│    • Encounter quizzes as survival hazards            │
│    • Discover send-up station (1 per run, rare)      │
│    ↓                                                 │
│  END OF LAYER → THE BIG DECISION                     │
│    ├── SURFACE: Keep 100% of everything              │
│    └── DESCEND: Risk it for richer rewards           │
│          ↓ Layer entrance quiz (2 questions)          │
│          ↓ Next layer (harder, richer)                │
│          ↓ If O2 runs out → Emergency extraction     │
│            Keep 50-80% (scales with depth)            │
│            Choose what to sacrifice                   │
│                                                      │
│  RETURN TO DOME                                      │
│    ↓                                                 │
│  OPEN ARTIFACTS (rarity from mine, content at open)  │
│    → 4-phase ceremony (3-15 seconds per artifact)    │
│    → Appraise = learn new fact (SM-2 entry)          │
│    ↓                                                 │
│  SPEND → Upgrades, crafting, dome                    │
│    ↓                                                 │
│  "One more run?"                                     │
└─────────────────────────────────────────────────────┘
```

### The Key Innovation: Knowledge As Survival Skill

In most educational games, learning is the goal and gameplay is the wrapper. **We flip this.** The mine is dangerous. Quizzes are hazards you must survive. The more you know, the more you survive:

- Correct quiz = O2 gained (survival resource)
- Wrong answer = O2 lost (real punishment)
- Quiz streaks = mineral multipliers (wealth)
- Mastered facts = better Pool A performance (game rewards mastery)
- Discovery facts (Pool B/C) = variety, never boring

The player never thinks "I should study." They think "I need to know more so I can go deeper."

---

## 3. Mining: Make Every Tap Matter

### Block Breaking
| Block | Hardness (taps) | O2 Cost | Notes |
|-------|----------------|---------|-------|
| Dirt | 1 | 1 | Instant, satisfying |
| Soft rock | 2 | 2 | Quick |
| Stone | 3 | 3 | Standard |
| Hard rock | 4 | 4 | Reduced from 5 for mobile |
| Mineral node | 3 | 3 | Drops minerals |
| Artifact node | 4 | 4 | Triggers appraisal quiz |

**Visual feedback per tap:** Crack overlay progresses (3-5 states). Screen shake scales with hardness. Material-colored particles burst. Floating O2 cost numbers. Distinct audio per material type with pitch randomization. Haptic feedback (light per hit, heavy on break).

**Mining rhythm target:** ~1 block/second for dirt, ~4 seconds for hard rock. The pickaxe upgrade system (damage 1/2/3/5/8) reduces taps over time, creating power fantasy progression.

### Reward Pacing (Steal from Vampire Survivors)
Something interesting every **10-15 seconds** of play:
- Mineral node (dust/shard/crystal/geode depending on depth)
- Oxygen cache
- Quiz trigger (at natural boundaries, not mid-swing)
- Cavern discovery (always contain something — never empty)
- Quote stone / ambient lore
- Relic shrine
- Artifact node
- Send-up station (rare, ~1 per run)
- Gate block guarding loot

Run **3-5 simultaneous reward tracks**: per-action (particles, sounds from every swing), streak (consecutive breaks escalate feedback), O2 countdown (urgency), collection progress (ore count toward milestones), depth progress (visible approach to next layer). **Always show the next goal.**

### Layer Structure (Steal from Stardew Valley)
- **Milestone layers (every 5th):** Guaranteed special room with a chest. Reduced hazards. A "breather" before the next push.
- **Mineral progression by depth (20-50× curve):**

| Layer | Grid | Nodes | Primary (%) | Secondary (%) | Tertiary (%) |
|-------|------|-------|-------------|---------------|--------------|
| 1-5 | 20×20 | 15-18 | Dust (80) | Shard (20) | — |
| 6-12 | 25×25 | 12-15 | Shard (55) | Dust (25) | Crystal (20) |
| 13-20 | 30×30 | 8-10 | Crystal (40) | Geode (30) | Essence (20), Shard (10) |

Fewer nodes at depth creates tension. Each new tier feels **qualitatively different** — not just "more dust."

### Movement & Exploration
- **O2 cost:** 1 per move through unexplored. **0 through cleared space** (encourages exploration, no backtracking penalty).
- **Fog of war:** 1-tile reveal around cleared space. Scanner base radius: **2** (bumped from useless 1).
- **Descent shaft:** Within central 60% of grid. Always findable with systematic exploration.
- **Caverns:** Always contain 1-2 mineral nodes or an O2 cache. Never empty.

### Hazards
- **Lava:** 1 block/tick spread. Max 5 blocks per source. Appears 40%+ depth.
- **Gas pockets:** 3×3 cloud, drifts 30 ticks. 8 O2 instant. Appears 25%+ depth.
- **Unstable ground:** 1.5% density at 30%+ depth. Cave-in radius 2.
- **No bosses in the mine.** Mine = exploration + resource management + knowledge. Combat reserved for future dungeon system.

### Last Breath
At 0 O2: **5 free moves** to reach exit or descent shaft. Creates clutch "I BARELY made it!" moments. Fail = emergency extraction (depth-scaled loss).

---

## 4. Quiz System: Knowledge As Power

### Philosophy
Quizzes are **encounters** — fought with your brain. Correct = critical hit. Wrong = taking damage. They trigger at **subtask boundaries** (after clearing a section, finding a node, reaching a junction) — never mid-mining-sequence.

### Quiz Format
- **3 answer options** (1 correct + 2 distractors) — research-optimal, 5 seconds faster than 4 options
- Hard mode / challenge variants add 4th option for bonus rewards
- **No timer** — tension comes from O2 clock, not quiz clock
- **Wrong answer:** Show correct in green, wrong in red. Minimum 1-second display. Wait for "Next" tap. Brief text only — detailed explanations in optional post-run review.
- **Target 85% accuracy rate** through adaptive difficulty

### Quiz Sources
| Source | Trigger | Frequency |
|--------|---------|-----------|
| Random pop | At subtask boundaries | 6% after 15-block cooldown |
| Artifact node | Mining artifact block | Mandatory (2 questions) |
| O2 cache | Finding cache | 25% for bonus O2 |
| Gate block | Mining gate | Mandatory |
| Relic shrine | Claiming relic | Mandatory (1 question) |
| Layer entrance | Choosing to descend | Mandatory (2 questions) |

Total per layer: ~6-8 encounters. One every ~1-2 minutes. Frequent enough to matter, spaced enough to not annoy.

### Quiz Stakes
| Context | Correct | Wrong |
|---------|---------|-------|
| Pool A (review-due) | +5 O2 | -8 O2 + consistency hit |
| Pool B (discovery) | +3 O2 | -5 O2 |
| Pool C (biome-contextual) | +3 O2 | -5 O2 |
| Layer entrance | Proceed | -10 O2, retry (new question) |
| Artifact appraisal | 20% rarity boost | No boost |
| Gate block | Access loot | Gate locked (retry for 5 O2) |
| Relic shrine | Claim relic | Relic crumbles (gone forever) |
| O2 cache | +15 bonus O2 | Normal cache amount only |

### Quiz Streaks (Dopamine Escalation)
- **3 streak:** 1.2× mineral multiplier + fire particles
- **5 streak:** 1.35× multiplier + screen glow
- **7 streak:** 1.5× multiplier + **+10 O2 refund** + golden burst
- Wrong resets to 0. Counter is prominent on HUD — a burning number that grows.

### Difficulty Scaling
Dynamic, adapts to the player:
- **Player mastery level** — more mastered facts = harder Pool B/C questions
- **Current depth** — deeper layers pull higher difficulty
- **Recent performance** — 5 correct in row = harder next. 3 wrong = ease up.
- **Target 85% accuracy** — the system actively seeks this rate
- NOT static per layer band. The game learns you.

### Chained Run Protection
If player does multiple runs in one session, Pool B/C serves **different facts each run** to prevent SM-2 interval compression. Pool A (review-due) can repeat — SM-2 handles scheduling. Track used fact IDs per session, not just per run.

---

## 5. The Three-Pool Quiz System

Solves the critical problem: "What if I only have 5 learned facts?"

### Pool A — Review Due (SM-2 Tracked)
- Cards currently due for review
- **Highest stakes:** +5 O2 correct, -8 O2 wrong + consistency penalty
- Counts as real SM-2 review (updates interval, ease)
- Priority when available
- **Delayed review bonuses: 3-5× larger** for 7-day and 30-day reviews

### Pool B — Discovery (Fresh Facts)
- Random from full database (522+ facts), filtered by interest + difficulty
- **Does NOT add to learn queue** — preview only (Iron Rule preserved)
- **Medium stakes:** +3 O2 correct, -5 O2 wrong
- Different content served per run within same session
- Keeps mines fresh regardless of collection size

### Pool C — Biome-Contextual
- Thematic facts matching current biome (lava = volcanology, ice = glaciers)
- Discovery only, same rules as Pool B
- Makes the mine feel like a real place with embedded knowledge

### Dynamic Weighting
| Player State | Pool A | Pool B | Pool C |
|-------------|--------|--------|--------|
| 0 review-due | 0% | 65% | 35% |
| 1-4 review-due | 20% | 50% | 30% |
| 5-9 review-due | 40% | 35% | 25% |
| 10+ review-due | 60% | 25% | 15% |

### The Beautiful Loop
1. Player sees fact in mine quiz (Pool B/C) → "Huh, interesting"
2. Player finds artifact → opens at dome → contains that fact (or related)
3. Appraises and learns it → fact enters SM-2
4. Next run, fact appears in Pool A → "I know this!" → +5 O2 + satisfaction
5. 7-day review → +15 O2 bonus (3× normal) → "My knowledge is paying off!"

---

## 6. Loot & Artifacts: The Dopamine Engine

### Artifact Discovery (In-Mine)
- ~3-5% density per layer
- Mining triggers 2-question appraisal quiz (3 options each)
- Each correct = 20% rarity boost chance
- **Rarity decided during dive** (depth + quiz performance)
- **Content decided AT MOMENT OF OPENING** at dome — creates anticipation

### Artifact Opening Ceremony (4-Phase, Steal from VS/Genshin)
1. **Build-up (1-3s):** Glowing cracks spread across artifact. Rarity-colored aura pulses. Screen rumbles.
2. **Reveal (0.5-2s):** Light explosion. Camera zooms. Audio sting pitched to rarity. Rarity text stamps on screen.
3. **Celebration (2-5s):** Fact showcase with category icon. Bonus loot cascades. Dust/mineral counters tick up.
4. **Integration (1-2s):** Items fly into inventory. Collection counter updates. GAIA reacts.

**Timing:** Common 3-5s. Uncommon 5-7s. Rare 7-10s. Epic+ 10-15s. Players must be able to skip after Phase 2, but most won't want to.

### Rarity Distribution
| Rarity | Weight | Typical Depth |
|--------|--------|---------------|
| Common | 60 | Any |
| Uncommon | 25 | Any |
| Rare | 10 | Layer 5+ |
| Epic | 4 | Layer 10+ |
| Legendary | 0.9 | Layer 15+ |
| Mythic | 0.1 | Layer 18+ |

### Artifact Contents (Decided at Opening)
1. **A fact** — educational content, difficulty matched to rarity
2. **Bonus loot** — dust/shards/crystals/consumables (scales with rarity)
3. **Rare chance:** Recipe fragments, fossil fragments, upgrade tokens

The loot table = gacha pull. Common = fact + small dust. Mythic = mind-blowing fact + massive minerals + guaranteed special item.

### Mineral Depth Curve (20-50× at Bottom)
| Depth | Value Multiplier (vs Layer 1) |
|-------|------------------------------|
| Layer 1 | 1× (baseline dust) |
| Layer 5 | 3-5× (shards appear) |
| Layer 10 | 8-12× (crystals common) |
| Layer 15 | 20-30× (geodes) |
| Layer 20 | 40-50× (essence, mythic artifacts) |

A single successful Layer 20 extraction should yield more than **25 shallow runs** — just like Stardew's Skull Cavern.

---

## 7. Descent & Loss: Real Stakes

### The Big Decision
At the end of each layer:

```
┌─────────────────────────────────────┐
│         LAYER 3 COMPLETE            │
│                                     │
│   Backpack: 2 artifacts, 340 dust   │
│   O2 remaining: 127/300             │
│                                     │
│   ┌───────────┐  ┌──────────────┐   │
│   │  SURFACE  │  │   DESCEND    │   │
│   │ Keep 100% │  │ Risk it all  │   │
│   └───────────┘  └──────────────┘   │
│                                     │
│   ⚠ If you fail Layer 4, you keep  │
│     only 75% — you choose what     │
│     to sacrifice.                   │
└─────────────────────────────────────┘
```

### Depth-Scaling Retention (Research-Backed)
| Failed At | Keep | Rationale |
|-----------|------|-----------|
| Layer 1-5 | 80% | Forgiving early — learning the game |
| Layer 6-8 | 70% | Stakes rising |
| Layer 9-12 | 65% | Significant risk |
| Layer 13-16 | 60% | High stakes |
| Layer 17-20 | 50% | Maximum tension |

**Player CHOOSES what to keep** from their budget. Frame: "Your drill pod can carry X% — what do you save?" Always "keep X%", never "lose Y%".

### Why This Works
- **Sunk cost tension** — "I already have 2 artifacts... but Layer 10 has crystals..."
- **Informed risk** — Player sees O2, backpack, knows deeper = harder + richer
- **Player agency** — YOU chose to descend. YOUR fault. That's why you retry.
- **Near-miss excitement (~30% rate)** — "3 blocks from the shaft!" → share-worthy
- **Escalating drama** — each layer makes the next decision harder

### No Mid-Layer Exit
Once you start a layer, complete it or fail. Exit decisions happen BETWEEN layers only. Descending = commitment.

### Send-Up Station (Insurance)
- **1 per run**, randomly placed, must mine to find
- 2-question quiz: each correct = items teleported 1 layer deeper (max 2)
- **Player chooses what to send up** — not everything
- Sent items = 100% safe regardless of outcome
- Mid-run agony: "Send artifacts now, or gamble for more?"

---

## 8. O2 & Energy: The Tension Clock

### Two O2 Systems

**O2 Bank (Entry Tickets)**
| Parameter | Value |
|-----------|-------|
| Maximum | 15 |
| Shallow dive cost | 3 (layers 1-3) |
| Medium dive cost | 4 (layers 1-6) |
| Deep dive cost | 5 (layers 1-10+) |
| Morning checkin | +2 |
| Evening checkin | +2 |
| Night checkin | +1 |
| Study session | +1 |
| Buy with dust | 150 dust = 1 O2 |
| First dive of day | FREE (always) |
| Terra Pass max | 20 (+5) |

**In-Mine O2 (Survival)**
| Parameter | Value |
|-----------|-------|
| Starting | 300 (3 × 100) |
| Move (unexplored) | -1 |
| Move (cleared) | 0 |
| Mine block | -1 to -4 (hardness) |
| Correct quiz (Pool A) | +5 |
| Correct quiz (Pool B/C) | +3 |
| Wrong quiz (Pool A) | -8 |
| Wrong quiz (Pool B/C) | -5 |
| O2 cache | +30 (~4 per layer) |
| Layer descent bonus | +15 |
| Study buff | +15 (if studied before dive) |
| Last breath | 5 free moves at 0 O2 |

### Framing (Critical)
O2 bank is a **"life support budget"** (narrative), NOT an "energy timer" (monetization). Per WoW's famous reframe: "rested XP bonus" vs "XP penalty" — identical mechanic, opposite player reaction. Players earn O2 through gameplay (study, checkins, dust spending). It feels earned, not imposed.

### Energy System Warning
Research: every beloved mobile roguelite (VS, StS, Dead Cells) uses premium or ad-only, NOT energy systems. The roguelite community specifically expects unlimited runs. Our O2 bank is the least offensive version — implement with **extreme generosity** (3-4 free sessions daily minimum via checkins + first-dive-free).

---

## 9. Progression & Meta-Loop

### What Persists Between Runs
- **Knowledge** — facts learned, SM-2 states (the ultimate meta-progression)
- **Minerals & currency** — for dome, crafting, O2 purchases
- **Artifacts** (if surfaced) — opened at dome for facts + loot
- **Fossils & companions** — permanent collection
- **Dome upgrades** — permanent hub improvements
- **Stats & records** — deepest layer, longest streak, facts mastered
- **Relic catalog** — discovery entries (relics themselves are per-run)

### What Resets Each Run
- In-mine O2, relics, consumables, map, quiz streak

### Study → Mine Connection
| Action | Reward |
|--------|--------|
| Complete study session | +1 O2 bank |
| Complete study session | +15 in-mine O2 on next dive |
| 7-day review correct | 3× normal O2 bonus |
| 30-day review correct | 5× normal O2 bonus |
| Morning ritual (7-11am study) | +2 O2 bank + dust |
| Evening ritual (7-11pm study) | +2 O2 bank + dust |

Player thinks: "I'll study first to get a stronger run" — not "time for homework."

### Dome Floor Unlocks
| Floor | Facts Mastered | Min Dives | Depth Proof |
|-------|---------------|-----------|-------------|
| Starter | 0 | 0 | — |
| Farm | 5 | 3 | — |
| Workshop | 15 | 5 | Layer 3+ |
| Research Lab | 30 | 8 | Layer 5+ |
| Museum | 50 | 12 | Layer 8+ |
| Market | 80 | 18 | Layer 10+ |
| Archive | 120 | 25 | Layer 13+ |
| Observatory | 200 | 35 | Layer 16+ |

### Daily Systems
- **Streak:** Dive or study = continues. Miss 1 day = warning. Miss 2 = reset. 500 dust insurance at break moment. (Validated: 7-day streakers are 3.6× more likely to stay engaged.)
- **Checkins:** Morning +2, Evening +2, Night +1 O2
- **First dive:** Always free
- **Rituals:** Study during morning/evening windows = bonus O2 + dust

### Knowledge Store
- Buy **artifacts** with Learning Sparks (decent price — supplements mining, doesn't replace it)
- Consumables, study tools, cosmetics
- Not pay-to-win

### Fact Management
- View all facts, sort by: mastery, failure rate, success rate, category
- **Sell unwanted facts** (remove from rotation, get dust)
- GAIA intervention for struggling facts (mnemonic hints) — no "leech" label
- High-failure facts surface prominently in fact list

---

## 10. First Run Experience

### Tutorial Mine (5 Minutes)
Must accomplish:
1. **Teach mining** — tap blocks, collect minerals, watch O2
2. **Teach quizzes** — 2-3 Pool B quizzes at natural boundaries
3. **Teach artifacts** — **5 guaranteed Common artifacts** with curated "wow factor" facts
4. **Teach descent** — reach Layer 1 end, show Surface/Descend choice
5. **Teach loss** — optionally guide to Layer 2 failure to demonstrate extraction

The 5 tutorial facts must be **genuinely fascinating** across categories. These are the first impression of learning. They seed the study deck for run 2+.

**Critical (from Duolingo):** Push sign-up UNTIL AFTER the tutorial run. Let players experience the loop before asking for commitment. Duolingo's identical change produced a **20% jump** in D1 retention.

### Post-Tutorial Self-Sustaining
- **Run 2:** 5 review-due cards (Pool A). "I know these!" 2-3 new artifacts. Collection: 8-10 facts.
- **Run 3-4:** System self-sustains. Real descent decisions. First failed extraction teaches stakes.
- **Run 5+:** Hooked. Knowledge growing. Dome unlocking. "One more run."

---

## 11. Session Design & Retention

### Target Sessions
| Type | Duration | O2 Cost | Layers | When |
|------|----------|---------|--------|------|
| Quick dive | ~8 min | 3 | 2-3 | Commute, break |
| Deep expedition | ~20 min | 5 | Push as deep as possible | Event session |
| Study only | ~5 min | — | — | "I have a moment" |

### "One More Run" Hooks
1. **Near-miss stories** — "I was SO close to Layer 10!"
2. **Artifact anticipation** — "I have 3 unopened artifacts!"
3. **Streak protection** — "One more run saves my streak"
4. **Unused study buff** — "I studied but haven't used my +15 O2"
5. **Depth record chase** — "My best is Layer 7, I bet I can hit 8"
6. **Near-zero restart friction** — instant restart, no loading

### Session-End Hooks
- Farm produced X dust while away
- X facts due for review
- Daily O2 checkin available
- GAIA: "Your streak is at 12 days. Ready to dive?"

### Monetization Stack
| Revenue Stream | Model |
|---------------|-------|
| Terra Pass | $4.99/mo — +5 O2 bank, 25% faster regen, cosmetics, 20% dust multiplier |
| Cosmetics | $1-5 each — miner skins, dome decor |
| Rewarded ads | Optional post-run "watch for bonus minerals" |
| Premium unlock | $5-10 one-time — removes ads + small permanent bonuses |
| O2 bank | First dive free. 5 daily checkin O2. Never paywalled. |

---

## 12. What We're NOT Doing Yet

Out of scope for V6. Polish AFTER core loop is addictive:

- Dome room interactions / upgrades (beyond basic unlock)
- Farm system polish (exists, background only)
- Companion evolution polish
- Cosmetics shop
- Social features (guilds, duels, trading)
- Prestige system (unlocks at 200 mastered facts)
- Seasonal events, push notifications
- Cloud save & auth
- Advanced GAIA personality
- Knowledge Tree visual polish
- Full audio system
- Multiplayer/co-op

**Only touching:** Mining, quizzes, loot, descent, O2, artifacts, study-mine connection.

---

## 13. Future Vision: Surface Dungeons

> **Documentation only. Not in V6 or any near-term phase.**

The planet surface becomes a dangerous fantasy landscape with dungeons. Two gameplay modes:

**Underground (Mining)** — Current system. Procedural mines, O2-limited, quiz hazards. Resource gathering + learning loop.

**Overground (Dungeons)** — Future auto-battle system. Characters auto-attack, player controls movement. Quiz popups = critical hit / damage block opportunities. Archero-style "punctuated interactivity."

### How They Connect
- Mining upgrades character stats/equipment for dungeons
- Dungeon rewards: rare minerals, exclusive artifacts, cosmetics
- Skip mining for dungeons = subscription/pack monetization
- Both share knowledge layer — can't pay to skip learning
- **Bidirectional dependency** (per Dome Keeper model): combat rewards improve mining, mining products improve combat

### Auto-Battle Design Notes (Future)
- Auto-attack in range, player controls movement
- Quiz popup in combat = critical hit (correct = 2× damage)
- Quiz in defense = damage block (correct = block 80%)
- Encounters: 30-60 seconds each (per Archero research)
- Dungeons: 10-15 encounters + boss
- Boss: multi-question sequence, each correct = attack phase
- Key insight (AFK Arena, $1B+): **preparation > execution** — build/loadout matters more than combat skill

---

## 14. All Decided Parameters

### Mining
| Parameter | Value | Source |
|-----------|-------|--------|
| Hard rock taps | 4 | Mobile UX |
| O2/move (unexplored) | 1 | Standard |
| O2/move (cleared) | 0 | No backtrack penalty |
| Scanner base radius | 2 | Was 1 (useless) |
| Last breath moves | 5 | Clutch moments |
| Shaft placement | Central 60% | Must be findable |
| Grid max | 30×30 | Apple HIG tap targets |
| Grid progression | 20→25→30 | L1-5, L6-12, L13-20 |
| Bosses in mine | REMOVED | Mine = exploration |
| Consumable carry | 2 | Find more in mine |
| Lava max spread | 5 blocks/source | Hard cap |
| Depth value multiplier | 20-50× at L20 | Mining game universal |

### Quizzes
| Parameter | Value | Source |
|-----------|-------|--------|
| Answer options | 3 (4 in hard mode) | Rodriguez 2005 meta-analysis |
| Random pop rate | 6% | ~6-8 per layer total |
| Pop cooldown | 15 blocks | Anti-spam |
| Trigger timing | Subtask boundaries | Adamczyk & Bailey 2004 |
| Layer entrance questions | 2 | Gate, not toll booth |
| Entrance wrong penalty | 10 O2 | Meaningful |
| Artifact appraisal questions | 2 | Quick but impactful |
| Rarity boost per correct | 20% | Makes boosts special |
| Skip option | None | All mandatory |
| Wrong answer display | Tap to continue, 1s min | Research-validated |
| Target accuracy | 85% | Wilson et al. 2019 |
| Difficulty scaling | Dynamic (mastery+depth+recent) | Adapts to player |
| Chained run protection | Different Pool B/C per run | Schimanke 2013 |

### O2 & Energy
| Parameter | Value | Source |
|-----------|-------|--------|
| O2 bank max | 15 (20 Terra Pass) | 3-5 runs stored |
| Dive cost | 3/4/5 (shallow/mid/deep) | Scaled |
| Daily checkin O2 | +2/+2/+1 = 5/day | 2-3 runs free |
| Dust per O2 | 150 | Expensive tradeoff |
| Study = O2 | +1 bank + 15 in-mine | Ties loops |
| First dive | Free always | Never locked out |
| In-mine O2 | 300 (3×100) | Per dive |
| O2 regen | 90 min/tank | Pacing |

### Descent & Loss
| Parameter | Value | Source |
|-----------|-------|--------|
| Surface = keep | 100% | Safe exit |
| Fail L1-5 = keep | 80% | Forgiving early |
| Fail L6-8 = keep | 70% | Rising stakes |
| Fail L9-12 = keep | 65% | Significant |
| Fail L13-16 = keep | 60% | High stakes |
| Fail L17-20 = keep | 50% | Maximum tension |
| Player chooses | What to keep | Agency |
| Send-up stations | 1/run, player picks items | Agonizing |

### Study & SM-2
| Parameter | Value | Source |
|-----------|-------|--------|
| Card cap/session | 20 | ~5 minutes |
| Grading buttons | Forgot/Got It/Easy | No intervals shown |
| SM-2 visibility | Hidden | Players see knowledge, not algorithm |
| Mastery threshold (general) | 45 days | Lowered for casual |
| Mastery threshold (vocab) | 30 days | Lowered for casual |
| Lapse interval preservation | 70% | Generous for casual |
| Leech handling | GAIA intervention | No auto-suspend label |
| Delayed review bonus | 3-5× at 7/30 days | Research: biggest payoffs late |
| Comeback (3+ day absence) | Full O2 + artifacts | Generous return |

### Progression & Daily
| Parameter | Value | Source |
|-----------|-------|--------|
| Tutorial artifacts | 5 Common (curated) | Seeds learning |
| Sign-up timing | After tutorial | Duolingo: +20% D1 |
| Dome unlock | Mastery + dives + depth | Multi-gate |
| Streak grace | 1 day warn, 2 day reset | Humane |
| Streak insurance | 500 dust at break | Economic decision |
| Prestige unlock | 200 mastered | Endgame |
| Fact selling | Allowed (get dust) | Player agency |

### Artifact Ceremony
| Parameter | Value | Source |
|-----------|-------|--------|
| Common reveal | 3-5 seconds | Quick but satisfying |
| Uncommon | 5-7 seconds | Slightly more drama |
| Rare | 7-10 seconds | Building excitement |
| Epic+ | 10-15 seconds | Full ceremony |
| Skip available | After Phase 2 | Player choice |
| Rarity aura | Color-coded pre-reveal | Genshin model |

### GAIA
| Parameter | Value |
|-----------|-------|
| Default | Terse mission AI |
| Auto-throttle | After 10 sessions |
| Mnemonic trigger | wrongCount ≥ 3 (difficulty 4+: ≥ 2) |
| Settings | Quiet / Normal / Verbose |

### Monetization
| Stream | Price | Content |
|--------|-------|---------|
| Terra Pass | $4.99/mo | +5 O2 bank, 25% faster regen, cosmetics, 20% dust multiplier, ad-free |
| Cosmetics | $1-5 | Skins, decor |
| Rewarded ads | Free | Optional post-run bonus |
| Premium unlock | $5-10 | One-time, removes ads + small perks |

---

## 15. Open Questions for Playtesting

Only answerable through play:

1. Is 6% pop quiz rate right? (Tune by feel)
2. Is depth-scaling loss (80%→50%) the right curve?
3. Typical quick dive layers? (Target: 2-3)
4. Does study buff (+15 O2) feel meaningful?
5. Is 150 dust/O2 the right price?
6. Are 2 relic shrines per layer overpowering across 3 layers?
7. Is mineral distribution by depth satisfying?
8. Does 3-option quiz feel right vs 4?
9. How often do players choose Surface vs Descend?
10. Does artifact opening ceremony feel exciting enough?
11. Does three-pool system feel natural?
12. Are 5 tutorial artifacts enough?
13. Is quiz streak (3/5/7) motivating?
14. Where do players first feel "one more run"?
15. Does 85% accuracy target feel right?
16. Is the 30×30 max grid the right cap?
17. Do delayed review bonuses (3-5×) drive study habits?
18. Does rewarded-ad-at-run-end feel acceptable?
19. Near-miss rate — are we hitting ~30%?
20. Is reward pacing truly hitting 10-15 seconds?

---

*This document is the single source of truth for V6 implementation. All phase documents derive from these decisions.*
