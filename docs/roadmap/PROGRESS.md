# Arcane Recall — Implementation Roadmap

> Design source of truth: `GAME_DESIGN_md`
> Previously "Terra Miner" — renamed to Arcane Recall (fantasy dungeon crawler)

---

## CRITICAL: Design Changes (March 9, 2026)

**Broken (must fix):**
1. Preview Exploit — question visible on tap, cancel, repeat. Fix: commit-before-reveal.
2. No Turn Economy — all 5 cards playable, zero choice. Fix: 3 Action Points.
3. Zero Effect Values — cards show 0. Fix: concrete values + modifier formula.

**Design upgrades:**
4. FSRS replaces SM-2 (`ts-fsrs` npm)
5. Domain decoupled from card type (domain = content, type = combat, assigned per-run)
6. 35 card mechanics across 8 types (Strike, Multi-Hit, Piercing, Thorns, Fortify, etc.)
7. Fantasy dungeon theme (all mining refs removed)
8. Dynamic timers (scale by floor AND question length + Slow Reader option)
9. 4-tier mastery with escalating question difficulty + Mastery Trial
10. 20 interesting passive relics with build-around effects
11. Echo cards with translucent visual, golden solidify on correct
12. Language learning UI (audio, furigana, production cards at Tier 2+)

---

## P0 — Core Prototype (COMPLETED, needs critical fixes)
- [x] **CR-01 Card Foundation** → `docs/roadmap/completed/CR-01-CARD-FOUNDATION.md`
- [x] **CR-02 Encounter Engine** → `docs/roadmap/completed/CR-02-ENCOUNTER-ENGINE.md`
- [x] **CR-03 Combat Scene** → `docs/roadmap/completed/CR-03-COMBAT-SCENE.md`
- [x] **CR-04 Card Hand UI** → `docs/roadmap/completed/CR-04-CARD-HAND-UI.md`
- [x] **CR-05 Game Juice** → `docs/roadmap/completed/CR-05-GAME-JUICE.md`
- [x] **CR-06 Knowledge Combo** → `docs/roadmap/completed/CR-06-KNOWLEDGE-COMBO.md`
- [x] **CR-07 Room Selection** → `docs/roadmap/completed/CR-07-ROOM-SELECTION.md`

---

## P0.5 — Critical Fixes (MUST complete before P1)

- [x] **CR-FIX-01 Fantasy Theme Rename** → `docs/roadmap/completed/CR-FIX-01-FANTASY-RENAME.md`

### CR-FIX-02: Card Effect Values + Enemy Balancing
**BLOCKER. Fastest win — set numbers on existing entities.**

**Card base values (Tier 1, standard mechanic):**
- Attack/Strike: 8 dmg | Shield/Block: 6 block | Heal/Restore: 5 HP
- Buff/Empower: +30% next card | Debuff/Weaken: -25% enemy 2t
- Utility/Scout: +1 draw | Regen/Sustained: 3/t x3 | Wild/Mirror: copy

**Modifier stack:** Base x Tier (1.0/1.3/1.6) x Difficulty (0.8-1.6) x Combo (1.0-2.0) x Speed (1.0/1.5) = Final.

**Enemies:** Bat 20HP/3dmg, Golem 40HP/8dmg, Spore 18HP/2+poison, Mimic 30HP/copy, Boss1 80HP/6-6-12, Boss2 100HP/8+2/turn, Boss3 90HP/7+shuffle.

**Player:** 80 HP start, 100 max, 0 block (resets each turn). Floor scaling: +15%/segment.

---

### CR-FIX-03: Action Point System
**BLOCKER. Creates strategic depth.**

3 AP/turn. Commit = 1 AP. Skip = free. 3 gem icons below hand. Auto-end at 0 AP. End Turn button always visible with AP count. Hard cap 4 AP.

---

### CR-FIX-04: Commit-Before-Reveal Flow
**BLOCKER. Biggest UI change, most important for learning.**

Stage 1 (hand): front only. Stage 2 (selected): enlarged front + Cast button, other cards dim+slide down. Stage 3 (committed): question + answers + timer, no cancel.

- Remove question from card-selected state
- Add Cast button on select
- Timer starts on commit only
- Block all other cards during answer phase
- Auto-fizzle on timer expiry

---

### CR-FIX-05: Dynamic Timer System
**HIGH. Makes timers fair for all question lengths.**

Base timer by floor (12s/9s/7s/5s/4s) + 1 second per 15 words beyond 10. Slow Reader mode (+3s flat, amber timer bar) set during onboarding, changeable in settings.

---

### CR-FIX-06: FSRS Migration
**HIGH. Better algorithm.**

- Install `ts-fsrs`
- Replace SM-2 scheduler with FSRS
- Map fields: easeFactor → difficulty (1-10), interval → stability (days), add retrievability
- Update tier derivation to FSRS thresholds (see GAME_DESIGN Section 26)
- Add `PlayerFactState` with full stats: totalAttempts, totalCorrect, averageResponseTimeMs
- Implement DomainScheduler partitioning for performance at scale

---

### CR-FIX-07: Domain/Type Decoupling
**HIGH. Removes forced domain → type binding.**

- Remove hardcoded domain-to-cardType mapping
- RunPoolBuilder assigns types from balanced distribution (~30% atk, ~25% shield, etc.)
- Store assignment in RunCard (not on Fact)
- Domain becomes cosmetic only (color tint, Library organization)

---

### CR-FIX-08: Card Mechanics Pool (Phase 1 — 16 mechanics)
**MEDIUM. Ship with 2/type, expand later.**

- Attack: Strike (8), Multi-Hit (3x3)
- Shield: Block (6), Thorns (4+2 reflect)
- Heal: Restore (5), Cleanse (3+debuff)
- Buff: Empower (+30%), Quicken (+1 AP)
- Debuff: Weaken (-25% 2t), Expose (+20% 2t)
- Utility: Scout (+1 draw), Recycle (1 from discard)
- Regen: Sustained (3/t x3), Emergency (10 <50%)
- Wild: Mirror (copy), Adapt (5/4/4 choice)

---

### CR-FIX-09: Encounter Flow + Run Termination
**HIGH. Prevents "play forever."**

Verify: encounter start/end, victory/defeat transitions, room selection after victory, boss after 3 encounters, retreat screen at segment boundaries, draw/discard/reshuffle cycle, turn 15+ enrage.

---

### CR-FIX-10: End Turn Button Polish
**MEDIUM. Completes turn structure.**

Always visible during player turn. Shows AP remaining. Tapping = skip all + enemy turn. Auto at 0 AP. Disabled during commit/answer and enemy turn.

---

## Build Order for CR-FIX

1. CR-FIX-01 (rename) — 30 min
2. CR-FIX-02 (values) — set numbers
3. CR-FIX-03 (AP) — new state + gems
4. CR-FIX-04 (commit flow) — UI rework
5. CR-FIX-05 (dynamic timer) — timer formula + slow reader
6. CR-FIX-06 (FSRS) — swap scheduler
7. CR-FIX-07 (decouple) — remove mapping, add random assignment
8. CR-FIX-08 (mechanics) — 16 mechanics
9. CR-FIX-09 (encounter flow) — state machine verification
10. CR-FIX-10 (end turn) — polish

### Playtest Checklist (after CR-FIX)

- [ ] Cards show real numbers with modifier stacking
- [ ] 3 AP per turn, gem display works
- [ ] Question hidden until Cast (commit-before-reveal)
- [ ] Timer adapts to question length
- [ ] Slow Reader option adds +3s with amber bar
- [ ] Cards have varied mechanics (Strike vs Multi-Hit, Block vs Thorns)
- [ ] Domain does NOT determine card type
- [ ] Enemies deal real damage and can kill you
- [ ] Encounters end on enemy/player death
- [ ] Room selection between encounters, boss after 3
- [ ] Run ends on death or retreat
- [ ] FSRS scheduling reviews
- [ ] All mining references gone

---

## P1 — First Update
- [ ] **CR-08 Mastery Tiers** — 4-tier progression (1→2a→2b→3), question format escalation (3→4→5 MCQ, reverse, fill-blank), Mastery Trial (4s timer, 5 close distractors, no slow reader bonus)
- [ ] **CR-09 Passive Relics** — Tier 3 graduation unlocks passive from type pool (First Blood, Fortress, Momentum, etc.), max 12 active, dormancy on FSRS decay
- [ ] **CR-10 Retreat-or-Delve** — Decision screen at segment boundaries, prospect theory risk/reward, 100%/80%/65%/50% tiers
- [ ] **CR-11 Remaining Mechanics** — Add 19 mechanics: Heavy Strike, Piercing, Reckless, Execute, Fortify, Parry, Brace, Overheal, Lifetap, Double Strike, Focus, Slow, Hex, Foresight, Transmute, Immunity, Overclock
- [ ] **CR-12 Knowledge Library** — Collection of all discovered facts, mastery progress, domain completion, lore entries on mastery
- [ ] **CR-13 Streaks & Daily** — Login streak (7/30/100/365 rewards), 1 freeze/week, daily engagement

---

## P2 — Soft Launch
- [ ] **CR-14 Fact Database Overhaul** — Complete rebuild of the fact database for the new Arcane Recall schema. The existing Terra Miner database was built for the mining game and needs fundamental restructuring:
  - Setup PostgreSQL server (or evaluate alternatives: SQLite for mobile-first, Supabase for cloud sync)
  - Migrate 522 existing facts to new schema: remove `cardType`/`baseEffectValue` from facts (these are now per-run), add `verifiedAt`, ensure all facts have 2+ question variants
  - Build fact ingestion pipeline: JSON → validation → DB insert with automatic variant generation
  - Build fact export pipeline: DB → optimized JSON bundles per domain for mobile client
  - Add `PlayerFactState` table with full FSRS fields + stats tracking
  - Add `DomainScheduler` partitioning indexes for mobile performance at 20K+ facts
  - Implement age gating filter (`getEligibleFacts`) at query level
  - Seed database with domain categorization cleanup (some facts may need recategorization)
  - Build admin tool for fact verification workflow (mark `verifiedAt`, edit variants, flag issues)
  - Generate 4 question variants per fact where only 2 exist currently (use AI draft + human review)
- [ ] **CR-15 Echo Mechanic** — 70% reappearance chance, translucent/shimmer visual, reduced power (0.7x), golden solidify on correct, FSRS double-benefit on redemption
- [ ] **CR-16 Bounty Quests** — 1-2 per run from pool (5 Science correct, 3 flawless encounters, reach Floor 6, 10 under 3s, 4 domains, perfect turn), bonus rewards
- [ ] **CR-17 Canary Difficulty** — Invisible adaptive: 3+ wrong = easier/weaker, 5+ right = harder/elite. Never reduces educational rigor.
- [ ] **CR-18 Adventurer's Journal** — Post-run summary: depth, facts, accuracy, combo, mastered, bounty status. Share card generation (Wordle-style viral loop).
- [ ] **CR-19 Daily Expedition** — Fixed seed, same for all players, leaderboard scoring, one attempt/day
- [ ] **CR-20 Sound Design** — Full pass: correct/wrong, draw swoosh, combat, combos, dungeon ambient, boss music, UI, retreat tension
- [ ] **CR-21 Playwright E2E Testing** — Automated test suite for Codex/agent continuous playtesting:
  - Full run flow: domain select → encounter → commit → answer → enemy turn → room select → boss → retreat/death
  - AP system: 3 AP, spending, auto-end, gem display
  - Commit-before-reveal: question hidden until Cast, no cancel after
  - Dynamic timers: verify floor scaling + question length modifier + slow reader bonus
  - Card mechanics: verify each of 16+ mechanics resolves correctly
  - FSRS integration: tier promotion, stability tracking, retrievability decay
  - Encounter termination: victory, defeat, enrage at turn 15
  - Combo: multiplier escalation and reset
  - Passive relics: activation, dormancy, max 12 cap
  - Run persistence: save/resume on app close
  - Visual regression: screenshot comparison for card states, enemy anims, UI
  - Performance: 60fps combat scene, 15 game objects
  - Mobile viewport: 390x844 and 360x800 portrait

---

## P3 — Post-Launch
- [ ] **CR-22 Lore Discovery** — Narrative milestones at 10/25/50/100 mastered facts. Full-screen presentation with pixel art, sound, share button. Elaborative encoding research backing.
- [ ] **CR-23 Endless Depths** — Infinite floor scaling, leaderboards, escalating difficulty
- [ ] **CR-24 Cosmetic Store** — Card backs, frames, dungeon skins, avatars
- [ ] **CR-25 Language Pack Support** — Vocabulary UI (audio button, furigana toggle, sentence context), production cards at Tier 2+, LanguagePack/LanguageLevel schema, level gating (80% previous mastery)
- [ ] **CR-26 Community Facts Pipeline** — "Provisional" state for community submissions (visually marked), "Report Error" tap-and-hold on every card, moderation queue, AI-draft → human review workflow
- [ ] **CR-27 Accessibility Polish** — Screen reader, expanded colorblind modes, font scaling pass, reduced motion pass
- [ ] **CR-28 Mastery Challenges** — Rare Mystery room variant testing mastered facts (3s timer, 5 distractors). Fail → Tier 2b, relic dormant. Maintenance gameplay.
- [ ] **CR-29 Relic Sanctum** — Between-run relic swap/management for players with >12 mastered
- [ ] **CR-30 Scholar Challenges** — Weekly curated runs with domain constraints + leaderboards (competitive endgame)