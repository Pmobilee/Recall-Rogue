# Arcane Recall — Implementation Roadmap

> Design source of truth: `docs/GAME_DESIGN.md`
> Card roguelite spec: `docs/RESEARCH/terra-miner-card-roguelite-spec.md`

---

## Current Status

**Playable pre-launch build.** AR-01 through AR-06 implementation work is now in place (combat integrity, FSRS migration, visual integration, onboarding/difficulty, sound+bounties+canary, and library/lore).

**Next up:** close remaining launch gates in AR-07 (native build verification, full E2E coverage, performance audit, dead code cleanup). AR-04 Calibration Deep Scan is blocked pending design research (see GAME_DESIGN.md §14).

---

## Pre-Launch Phases

### AR-01: Combat Integrity ✓
Commit-before-reveal, dynamic timer, domain/type decoupling, end turn polish, encounter edge cases. → [Spec](completed/AR-01-COMBAT-INTEGRITY.md)

---

### AR-02: Spaced Repetition Upgrade ✓
FSRS migration, tier derivation, PlayerFactState, question variant rotation. → [Spec](completed/AR-02-FSRS-MIGRATION.md)

---

### AR-03: Visual Polish + Asset Integration ✓
47 art assets wired in — player/enemy/boss sprites, card frames, backgrounds, doors, domain icons. → [Spec](completed/AR-03-VISUAL-POLISH.md)

---

### AR-04: Onboarding + Difficulty Modes
New players learn in 60 seconds. All skill levels served.

- [x] **60-second onboarding** — Dungeon entrance, Slow Reader question, first encounter with 2 AP (tutorial), contextual tooltips on first tap/cast/answer/end-turn. Domain selection unlocks on Run 2.
- [x] **Difficulty modes** — Explorer (no timer, wrong=50% effect, enemies -30%), Standard (current), Scholar (-2s/tier, wrong=fizzle+3 self-damage, enemies +20%).
- [ ] **Calibration Deep Scan** — NEEDS RESEARCH. See GAME_DESIGN.md §14 for problem analysis, 4 candidate approaches (standalone test / accelerated FSRS / in-run probe / cut), and 5 open research questions. Blocked on design decision.
- [x] **Hint system** — 1 Scholar's Insight per encounter: remove 1 wrong answer, +5s timer, or reveal first letter.

Depends on: AR-01 + AR-02

---

### AR-05: Sound + Engagement Loops ✓
Core SFX, Adventurer's Journal, bounty quests, daily login streak, canary system. → [Spec](completed/AR-05-SOUND-ENGAGEMENT.md)

---

### AR-06: Knowledge Library + Lore ✓
Knowledge Library with domain filters, Lore Discovery milestones, fact detail view. → [Spec](completed/AR-06-KNOWLEDGE-LIBRARY.md)

---

### AR-07: Launch Readiness
Everything needed to submit to app stores.

- [ ] **Capacitor build verification** — Android and iOS builds compile and run. Fix safe areas, status bar, keyboard, permissions.
- [x] **Accessibility baseline** — Colorblind support (shapes not just colors), 3 text sizes, high contrast mode, reduce motion option, 48dp+ touch targets verified.
- [ ] **Playwright E2E test suite** — Full run flow, AP system, commit-before-reveal, dynamic timers, card mechanics, FSRS, encounter termination, combo, passive relics, run persistence.
- [ ] **Performance audit** — 60fps combat on mid-range devices, <50KB run state, <3s cold start.
- [ ] **Dead code cleanup** — Remove `src/_archived-mining/`, unused mining-era components, stale data files.
- [x] **App store metadata** — Screenshots, description, privacy policy, age rating (4+ educational).

Current AR-07 status note: initial Playwright smoke specs were added under `tests/e2e/playwright/`, but full launch-coverage suite and native build verification are still open.

## Post-Launch Phases

### AR-08: Content Expansion + Language Packs
- [ ] Scale facts from 723 to 2000+ with ingestion pipeline
- [ ] Language pack framework (audio, furigana, production cards at Tier 2+)
- [ ] Age gating filter at query level
- [ ] Domain pack IAP ($2.99) and language pack IAP ($4.99)

### AR-09: Competitive + Social
- [ ] Daily Expedition (fixed seed, one attempt/day, leaderboard)
- [ ] Endless Depths (infinite scaling after Floor 9, separate leaderboard)
- [ ] Mastery Challenges (rare Mystery room, 3s timer, 5 distractors, fail = Tier 2b)
- [ ] Relic Sanctum (between-run relic management for >12 mastered)

### AR-10: Monetization + Polish
- [ ] Ad removal IAP ($4.99)
- [ ] Arcane Pass subscription ($4.99/mo — all packs, cosmetics, analytics)
- [ ] Cosmetic store (card backs, frames, dungeon skins, avatars)
- [ ] Sound design pass 2 (per-mechanic sounds, floor themes, boss music)
- [ ] Scholar Challenges (weekly curated runs + leaderboards)

---

## Dependency Graph

```
AR-01 ──┬── AR-02 ──┬── AR-04 → AR-05 → AR-06 → AR-07
        └── AR-03 ──┘                              ↓
                                            AR-08 / AR-09 / AR-10
```

AR-02 and AR-03 can run in parallel after AR-01.

---

## Completed Phases

**19 phases completed** across P0 (CR-01→07), P1 (CR-08→13), P1.5 Art Pipeline (CR-14→19), and CR-FIX-01. Specs archived in `docs/roadmap/completed/`.

**5 AR phases completed:** AR-01 Combat Integrity, AR-02 FSRS Migration, AR-03 Visual Polish, AR-05 Sound + Engagement, AR-06 Knowledge Library. Specs in `docs/roadmap/completed/`.
