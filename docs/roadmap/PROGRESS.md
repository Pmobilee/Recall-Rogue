# Terra Miner — Card Roguelite Implementation Roadmap

> Tracks implementation progress for the card roguelite pivot.
> Each phase has a dedicated spec in `docs/roadmap/phases/`.
> Design source of truth: `docs/RESEARCH/02_terra-miner-card-roguelite-spec.md` + `docs/RESEARCH/03_UX_IMPROVEMENTS.md`

---

## P0 — Core Prototype (first playable)

- [ ] **CR-01 Card Foundation** — Card entity, types (Strike/Shield/Surge/Void/Wild), deck manager, 50 facts mapped to cards → `docs/roadmap/phases/CR-01-CARD-FOUNDATION.md`
- [ ] **CR-02 Encounter Engine** — Turn-based encounter loop, enemy system (HP, telegraphed intents, attack patterns), basic enemy roster → `docs/roadmap/phases/CR-02-ENCOUNTER-ENGINE.md`
- [ ] **CR-03 Combat Scene** — Phaser scene with split-stage portrait layout (top 55% display, bottom 45% interaction), enemy sprites, HP bars, intent icons → `docs/roadmap/phases/CR-03-COMBAT-SCENE.md`
- [ ] **CR-04 Card Hand UI** — Fanned arc hand, two-step play (tap to select → answer to activate), card animations (launch, fizzle, dissolve), answer buttons → `docs/roadmap/phases/CR-04-CARD-HAND-UI.md`
- [ ] **CR-05 Game Juice** — Correct/wrong answer feedback stack (haptics, screen flash, damage numbers, combo counter, sound stubs), enemy hit reactions → `docs/roadmap/phases/CR-05-GAME-JUICE.md`
- [ ] **CR-06 Knowledge Combo** — Consecutive correct answer multiplier (1.0x→2.0x), combo visuals, card ordering strategy, perfect turn celebration → `docs/roadmap/phases/CR-06-KNOWLEDGE-COMBO.md`
- [ ] **CR-07 Room Selection** — 3-door choice between encounters, room types (combat/mystery/rest/treasure/shop), floor progression, boss encounter at floor end → `docs/roadmap/phases/CR-07-ROOM-SELECTION.md`

---

## P1 — First Update

- [ ] **CR-08 Mastery Tiers** — Tier 1→2→3 card evolution via SM-2 mastery, passive abilities unlock at Tier 3, visual upgrades per tier → `docs/roadmap/phases/CR-08-MASTERY-TIERS.md`
- [ ] **CR-09 Cash-Out Risk** — Cash-out-or-continue decision between floors, escalating rewards vs wipe risk, run currency system → `docs/roadmap/phases/CR-09-CASH-OUT-RISK.md`
- [ ] **CR-10 Knowledge Library** — Collection view of all discovered facts/cards, mastery progress, domain completion tracking → `docs/roadmap/phases/CR-10-KNOWLEDGE-LIBRARY.md`
- [ ] **CR-11 Streaks & Daily** — Login streak system, streak freeze, milestone rewards, daily engagement hooks → `docs/roadmap/phases/CR-11-STREAKS-DAILY.md`

---

## P2 — Soft Launch

- [ ] **CR-12 Echo Mechanic** — Wrong answers return as empowered enemies in later encounters, spaced repetition through consequence → `docs/roadmap/phases/CR-12-ECHO-MECHANIC.md`
- [ ] **CR-13 Mineral Veins** — Per-run bonus objectives (domain challenges, speed goals, streak targets), bonus rewards → `docs/roadmap/phases/CR-13-MINERAL-VEINS.md`
- [ ] **CR-14 Canary Difficulty** — Adaptive difficulty system, accuracy tracking, dynamic enemy scaling, 85% target accuracy maintenance → `docs/roadmap/phases/CR-14-CANARY-DIFFICULTY.md`
- [ ] **CR-15 Miner's Log** — Post-run summary screen, facts learned/reviewed stats, share card generation → `docs/roadmap/phases/CR-15-MINERS-LOG.md`
- [ ] **CR-16 Daily Excavation** — Daily challenge mode with fixed seed, leaderboard-compatible scoring → `docs/roadmap/phases/CR-16-DAILY-EXCAVATION.md`
- [ ] **CR-17 Sound Design** — Full sound pass for P0+P1+P2 features, correct/wrong answer audio, combat sounds, ambient, UI feedback → `docs/roadmap/phases/CR-17-SOUND-DESIGN.md`

---

## P3 — Post-Launch

- [ ] **CR-18 Endless Mode** — Infinite floor scaling, leaderboards, escalating difficulty beyond normal run cap → `docs/roadmap/phases/CR-18-ENDLESS-MODE.md`
- [ ] **CR-19 Cosmetic Store** — Card backs, card frames, miner skins, purchase with earned/premium currency → `docs/roadmap/phases/CR-19-COSMETIC-STORE.md`
- [ ] **CR-20 Language Packs** — Multi-language fact content, language-specific card pools, vocabulary domain expansion → `docs/roadmap/phases/CR-20-LANGUAGE-PACKS.md`
- [ ] **CR-21 Accessibility** — Screen reader support, colorblind modes, font scaling, reduced motion, one-hand optimization pass → `docs/roadmap/phases/CR-21-ACCESSIBILITY.md`
- [ ] **CR-22 Fossil Discovery** — Fossil collection meta-system, rare finds across runs, museum/gallery completion → `docs/roadmap/phases/CR-22-FOSSIL-DISCOVERY.md`
