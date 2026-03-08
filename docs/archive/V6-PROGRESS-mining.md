# Terra Miner — V6 Playability Roadmap

> All 68 implementation phases complete (595 files, 0 typecheck errors). This roadmap focuses on making the game **fun, balanced, and polished** through systematic playtesting and iteration.

## Current State
Starting V6 playability work. No phases started yet. See `V6-QUESTIONS.md` for ~200 design questions that need answers before/during each phase.

---

## Arc 1: Core Quiz & Learning Loop (Phases 1-4)
The questioning system is the heart of the game. Get this right first.

- [ ] **Phase 1: Quiz Experience Polish** — Make quizzes feel good to answer. Timing, feedback, animations, sound. The 3-button grading must feel intuitive. Distractor quality validation.
  → `docs/roadmap/phases/V6-01-QUIZ-EXPERIENCE.md`

- [ ] **Phase 2: SM-2 Tuning & Study Flow** — Tune spaced repetition for casual gamers (not Anki power users). Study session pacing, card caps, review scheduling feel. GAIA mnemonic timing.
  → `docs/roadmap/phases/V6-02-SM2-TUNING.md`

- [ ] **Phase 3: Fact Content Quality** — Audit all 522 facts. Distractor plausibility. Category balance. Difficulty rating accuracy. Fill content gaps.
  → `docs/roadmap/phases/V6-03-FACT-QUALITY.md`

- [ ] **Phase 4: Quiz Integration Playtest** — End-to-end playtest of the full quiz loop. Pop quiz rate tuning, artifact appraisal flow, layer entrance quizzes. Does learning feel rewarding?
  → `docs/roadmap/phases/V6-04-QUIZ-INTEGRATION.md`

## Arc 2: Mining Gameplay Loop (Phases 5-8)
Make mining feel satisfying as a core activity, not just a quiz delivery vehicle.

- [ ] **Phase 5: Mining Feel & Juice** — Block breaking satisfaction. Screen shake tuning. Particle effects. Mining rhythm. Does tapping blocks feel good on mobile?
  → `docs/roadmap/phases/V6-05-MINING-FEEL.md`

- [ ] **Phase 6: Mine Generation Balance** — Layer size, block distribution, special block density. Is exploration rewarding? Are layers too big/small? Descent shaft placement.
  → `docs/roadmap/phases/V6-06-MINE-GENERATION.md`

- [ ] **Phase 7: Hazard & Combat Balance** — Lava spread rate, gas damage, earthquake frequency. Combat difficulty curve. Boss encounter pacing. Are hazards fun or frustrating?
  → `docs/roadmap/phases/V6-07-HAZARD-COMBAT.md`

- [ ] **Phase 8: Mining Loop Playtest** — Full dive playtest. O2 economy per dive. Backpack management. Send-up stations. Loot satisfaction. Run length tuning (5-7 min quick, 15-25 min deep).
  → `docs/roadmap/phases/V6-08-MINING-PLAYTEST.md`

## Arc 3: Economy & Progression Balance (Phases 9-12)
Make the numbers work. Earning rates, spending rates, progression pacing.

- [ ] **Phase 9: Mineral Economy Balance** — Drop rates vs costs. Dust/shard/crystal/geode/essence flow. Are players earning enough? Too much? Compression tax tuning.
  → `docs/roadmap/phases/V6-09-MINERAL-ECONOMY.md`

- [ ] **Phase 10: Crafting & Recipe Balance** — Recipe costs, unlock pacing, consumable value. Is the materializer useful? Do recipes feel achievable?
  → `docs/roadmap/phases/V6-10-CRAFTING-BALANCE.md`

- [ ] **Phase 11: Artifact & Relic Balance** — Artifact drop rates, rarity distribution, relic power levels. Relic synergies. Is the loot loop compelling?
  → `docs/roadmap/phases/V6-11-ARTIFACT-RELIC.md`

- [ ] **Phase 12: Economy Playtest** — Full economy simulation. Track a player from 0 to 50 dives. Where do bottlenecks occur? What feels grindy? What's too easy?
  → `docs/roadmap/phases/V6-12-ECONOMY-PLAYTEST.md`

## Arc 4: Dome & Meta Progression (Phases 13-17)
Hub activities, unlocks, long-term goals.

- [ ] **Phase 13: Dome Navigation & UX** — Floor switching, room interactions, visual clarity. Can players find what they need? Is the dome inviting?
  → `docs/roadmap/phases/V6-13-DOME-UX.md`

- [ ] **Phase 14: Farm & Companion Systems** — Farm slot balance, crop yields, companion evolution pacing. Dust Cat happiness. Are these systems engaging or chores?
  → `docs/roadmap/phases/V6-14-FARM-COMPANIONS.md`

- [ ] **Phase 15: Unlock & Progression Pacing** — When do floors unlock? When do features appear? Progressive disclosure. Does the game reveal itself at the right pace?
  → `docs/roadmap/phases/V6-15-UNLOCK-PACING.md`

- [ ] **Phase 16: Streak & Daily Systems** — Daily login rewards, streak freeze, morning/evening rituals. Do daily systems encourage play without punishing absence?
  → `docs/roadmap/phases/V6-16-DAILY-SYSTEMS.md`

- [ ] **Phase 17: Dome Playtest** — Full hub experience playtest. Navigation flow, feature discoverability, upgrade satisfaction, long-term goal clarity.
  → `docs/roadmap/phases/V6-17-DOME-PLAYTEST.md`

## Arc 5: Onboarding & First Hour (Phases 18-20)
The most critical 5 minutes and the most critical hour.

- [ ] **Phase 18: First 5 Minutes** — Crash landing → GAIA intro → age gate → interest selection → tutorial mine. Is it engaging? Does it communicate the core loop?
  → `docs/roadmap/phases/V6-18-FIRST-5-MINUTES.md`

- [ ] **Phase 19: First Hour** — Post-tutorial through first 3-5 dives. Feature unlock pacing. First artifact appraisal. First study session. First dome upgrade. Is there a clear goal?
  → `docs/roadmap/phases/V6-19-FIRST-HOUR.md`

- [ ] **Phase 20: Onboarding Playtest** — Watch someone play for the first time. Where do they get confused? What delights them? What makes them want to stop?
  → `docs/roadmap/phases/V6-20-ONBOARDING-PLAYTEST.md`

## Arc 6: Knowledge Tree & Endgame (Phases 21-23)
Long-term engagement, mastery, and "what do I do after 100 hours?"

- [ ] **Phase 21: Knowledge Tree Polish** — Visual satisfaction of tree growth. Branch bonuses. Leaf wilting feedback. Mastery celebrations. Does the tree feel alive?
  → `docs/roadmap/phases/V6-21-KNOWLEDGE-TREE.md`

- [ ] **Phase 22: Endgame Content** — The Deep (layer 20+), prestige system, challenge mode, omniscient path. What keeps veteran players engaged?
  → `docs/roadmap/phases/V6-22-ENDGAME.md`

- [ ] **Phase 23: Long-Term Playtest** — Simulate 30-day player journey. Session frequency, return motivation, content exhaustion. Does the game have legs?
  → `docs/roadmap/phases/V6-23-LONG-TERM-PLAYTEST.md`

## Arc 7: Visual & Audio Polish (Phases 24-26)
Final polish pass for release readiness.

- [ ] **Phase 24: Visual Consistency Pass** — Sprite quality, animation smoothness, UI consistency. Color palette. Mobile responsive. Dark mode / accessibility.
  → `docs/roadmap/phases/V6-24-VISUAL-POLISH.md`

- [ ] **Phase 25: Audio & Haptics** — Sound design, ambient music, haptic feedback. Does the game sound like it feels? Audio cues for quiz/mining/discovery.
  → `docs/roadmap/phases/V6-25-AUDIO-HAPTICS.md`

- [ ] **Phase 26: Release Readiness Playtest** — Final full playtest. All systems together. Performance. Crash testing. Edge cases. Is this ready for real players?
  → `docs/roadmap/phases/V6-26-RELEASE-PLAYTEST.md`
