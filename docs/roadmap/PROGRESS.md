# Terra Gacha — Progress Tracker & Roadmap

Last updated: 2026-03-03

## How This Roadmap Works

- **This file** (`PROGRESS.md`) is the master oversight checklist
- Each phase links to a **detailed implementation document** that coding workers execute against
- Detailed docs live in `docs/roadmap/phases/` (not started), `docs/roadmap/in-progress/` (active), or `docs/roadmap/completed/` (done)
- Each phase doc contains: granular sub-steps, file paths, acceptance criteria, Playwright tests, and verification gates
- See `CLAUDE.md` → "Roadmap Workflow" for the full execution protocol

## Vision

Terra Gacha is a mobile-first 2D pixel-art mining roguelite where each dive fuels a long-term knowledge journey. The player crash-lands on a far-future Earth, excavates procedural mines for minerals and artifacts, and returns to the dome to ingest discoveries through GAIA, review facts with spaced repetition, and grow a living Knowledge Tree. The core fantasy is rediscovering Earth one artifact at a time.

## Current State

Phases 0-7 complete. Visual Overhaul (A-I) complete. Capacitor + Fastify backend scaffolded. V2 roadmap (Phases 8-25) remaining with detailed phase documents. All 5 Q&A batches complete (281 design decisions total). Phase 7 implemented 16 sub-phases: autotiling, character animation, camera/zoom, particles, loot physics, impact system, block animations, event bus, overlay styles, hybrid fonts, biome glow, input buffering.

---

## Completed Phases

- [x] **Phase 0: MVP Core Loop** — Full dive loop, SM-2, quiz system, oxygen, procedural mines, save/load → `completed/PHASE-0-MVP.md`
- [x] **Phase 1: Content & Polish** — Visual polish, 522 facts, audio, balance tuning, mobile optimization → `completed/PHASE-1.0-OVERVIEW.md`
- [x] **Phase 2: Knowledge System** — Real facts, Knowledge Tree, GAIA personality, data discs → `completed/PHASE-2.0-OVERVIEW.md`
- [x] **Phase 3: Roguelite Depth** — Biomes, layers, relics, micro-structures, hazards, consumables
- [x] **Phase 4: Economy & Base** — Mineral tiers, crafting, cosmetics, dome rooms, economy sinks
- [x] **Phase 5: Pets & Fossils** — 10 species, farm, zoo, companion system
- [x] **Phase 6: Advanced Learning** — Artifact quizzes, study sessions, data discs, knowledge store
- [x] **Visual Overhaul (A-I)** — Sprites, mining visuals, UI polish, canvas scaling, architecture refactor, dome tiles, resource icons, mobile pass → `completed/VISUAL-OVERHAUL-PLAN.md`
- [x] **Phase 10 (partial)** — Capacitor Android + Fastify backend + API client

---

## V2 Roadmap — Phases 7-25

Each phase below links to its detailed implementation document in `docs/roadmap/phases/`.

### Core Gameplay (Phases 7-9)
- [x] **Phase 7: Visual Engine Overhaul** — Autotiling, character animation, camera/zoom, particles, loot physics, mining feel → [`completed/PHASE-07-VISUAL-ENGINE.md`](completed/PHASE-07-VISUAL-ENGINE.md)
- [ ] **Phase 8: Mine Gameplay Overhaul** — 20 layers, tick system, active hazards, O2 decay, landmarks, consumables, quiz overhaul, SM-2 tuning → [`phases/PHASE-08-MINE-GAMEPLAY.md`](phases/PHASE-08-MINE-GAMEPLAY.md)
- [ ] **Phase 9: Biome Expansion** — 25 unique biomes, per-biome tiles, structural generation, ambient particles → [`phases/PHASE-09-BIOME-EXPANSION.md`](phases/PHASE-09-BIOME-EXPANSION.md)

### Hub & Content (Phases 10-11)
- [ ] **Phase 10: Dome Hub Redesign** — Multi-floor hub, navigation, upgrades, animated pets, Knowledge Tree growth, daily briefing → [`phases/PHASE-10-DOME-HUB-REDESIGN.md`](phases/PHASE-10-DOME-HUB-REDESIGN.md)
- [ ] **Phase 11: Fact Content Engine** — Ingestion API, LLM pipeline, dashboard, pixel art generation, schema updates → [`phases/PHASE-11-FACT-CONTENT-ENGINE.md`](phases/PHASE-11-FACT-CONTENT-ENGINE.md)

### Personalization & Learning (Phases 12-13)
- [ ] **Phase 12: Interest & Personalization** — Interest settings, weighted spawning, behavioral learning, category lock, archetypes → [`phases/PHASE-12-INTEREST-PERSONALIZATION.md`](phases/PHASE-12-INTEREST-PERSONALIZATION.md)
- [ ] **Phase 13: Knowledge Tree 2.0** — Radial tree, 3-level LOD, sub-branches, tap-to-view, mastery coloring → [`phases/PHASE-13-KNOWLEDGE-TREE-V2.md`](phases/PHASE-13-KNOWLEDGE-TREE-V2.md)

### Onboarding & Personality (Phases 14-16)
- [ ] **Phase 14: Onboarding & Tutorial** — Backstory, GAIA intro, tutorial mine, progressive unlocks, reward front-loading → [`phases/PHASE-14-ONBOARDING-TUTORIAL.md`](phases/PHASE-14-ONBOARDING-TUTORIAL.md)
- [ ] **Phase 15: GAIA Personality 2.0** — Post-dive reactions, idle popups, pet commentary, journey memory, mastery celebrations → [`phases/PHASE-15-GAIA-PERSONALITY-V2.md`](phases/PHASE-15-GAIA-PERSONALITY-V2.md)
- [ ] **Phase 16: Fossil & Farming Expansion** — Crop fossils, knowledge-gated revival, farm planting → [`phases/PHASE-16-FOSSIL-FARMING-EXPANSION.md`](phases/PHASE-16-FOSSIL-FARMING-EXPANSION.md)

### Engagement & Tooling (Phases 17-18)
- [ ] **Phase 17: Addictiveness Pass** — Gacha animations, sound design, session flow, streaks, weekly challenges, login calendar → [`phases/PHASE-17-ADDICTIVENESS-PASS.md`](phases/PHASE-17-ADDICTIVENESS-PASS.md)
- [ ] **Phase 18: Dev Tooling** — Scenario presets, save snapshots, session profiles, review pressure audit, quiz anti-homework → [`phases/PHASE-18-DEV-TOOLING.md`](phases/PHASE-18-DEV-TOOLING.md)

### Infrastructure & Launch (Phases 19-20)
- [ ] **Phase 19: Auth & Cloud** — Auth UI, cloud sync, PostgreSQL, Docker, offline mode, legal, profiles, analytics → [`phases/PHASE-19-AUTH-CLOUD.md`](phases/PHASE-19-AUTH-CLOUD.md)
- [ ] **Phase 20: Mobile Launch** — Capacitor builds, store submission, ASO, soft launch, accessibility, web platform → [`phases/PHASE-20-MOBILE-LAUNCH.md`](phases/PHASE-20-MOBILE-LAUNCH.md)

### Monetization & Social (Phases 21-22)
- [ ] **Phase 21: Monetization** — Terra Pass, IAP, O2 regen, season pass, Pioneer Pack, economy rebalance → [`phases/PHASE-21-MONETIZATION.md`](phases/PHASE-21-MONETIZATION.md)
- [ ] **Phase 22: Social & Multiplayer** — Hub visiting, leaderboards, duels, trading, guilds, referrals → [`phases/PHASE-22-SOCIAL-MULTIPLAYER.md`](phases/PHASE-22-SOCIAL-MULTIPLAYER.md)

### Post-Launch (Phases 23-25)
- [ ] **Phase 23: Live Ops & Seasons** — Seasonal events, content cadence, UGC, push notifications, completionist endgame → [`phases/PHASE-23-LIVE-OPS-SEASONS.md`](phases/PHASE-23-LIVE-OPS-SEASONS.md)
- [ ] **Phase 24: Language Learning** — Multi-language, 3 SM-2 tracks, TTS pronunciation, language-specific tree → [`phases/PHASE-24-LANGUAGE-LEARNING.md`](phases/PHASE-24-LANGUAGE-LEARNING.md)
- [ ] **Phase 25: Advanced Features** — Combat, co-op, achievements, advanced pets, accessibility, educational partnerships → [`phases/PHASE-25-ADVANCED-FEATURES.md`](phases/PHASE-25-ADVANCED-FEATURES.md)

---

## Open Design Questions

### Economy & Balance
- **Q-E1**: Mineral conversion tax ratio (needs playtesting)
- **Q-E2**: Rescue beacon cost (needs playtesting)
- **Q-D2**: Backpack starting size — PARTIALLY ANSWERED (DD-V2-061): starting 6 slots, max 14 with upgrades, auto-compress at 50:1; final numbers need playtesting validation
- **Q-D3**: Oxygen cost per action — ANSWERED (DD-V2-061): depth decay system with 1.0× at layer 1, 1.5× at layer 10, 2.5× at layer 20, linear interpolation between milestones; see Phase 8.5
- **Q-D4**: "Barely made it" mechanic

### Social & Meta
- **Q-S1**: Guild/faction structure
- **Q-S2**: Season/battle pass design
- **Q-S3**: Fact trading anti-exploitation

### Learning System
- **Q-L1**: Prevent "only study Geology" meta (partially addressed by interest system)
- **Q-L2**: Pet species count (currently 10; expand with crop species)
- **Q-L3**: SM-2 tuning for mobile — ANSWERED (DD-V2-096): second interval 3 days, consistency at reps ≥ 4, three-button study
- **Q-L4**: Quiz frequency and adaptation — ANSWERED (DD-V2-101): 8% base, adaptive with fatigue and cooldown
- **Q-L5**: Knowledge Tree rendering approach — ANSWERED (DD-V2-115): hierarchical radial tree, custom SVG/Canvas, 3-level LOD

### V2 Architecture Questions
- **Q-V2-1**: Autotile variant count per block — 16 (4-bit) or 47 (8-bit)?
- **Q-V2-2**: Hub floor count at endgame — 6? 8? 10?
- **Q-V2-3**: LLM provider for fact pipeline — Claude API, local Llama, or hybrid?
- **Q-V2-4**: Knowledge graph library — D3.js force-directed, Cytoscape.js, or custom SVG?
- **Q-V2-5**: Tutorial mine: 1 biome or 3 biomes shown?
- **Q-V2-6**: Fact pixel art resolution (256px? 512px?) and style consistency enforcement
- **Q-V2-7**: Companion count — how many total companion species? (Currently 10 animals + crop fossils planned; final number?)
- **Q-V2-8**: Relic count — exactly 15 or 20? How many relics per archetype (Explorer/Miner/Scholar/Survivor)?
- **Q-V2-9**: Knowledge Store powerup count — exactly 20 or more? Full list of powerups needed for implementation
- **Q-V2-10**: Offering altar visual design — stone altar? Glowing runes? Does the altar appearance vary per biome?
- **Q-V2-11**: Instability meter UI placement — HUD bar? Screen edge glow? Ambient sound cue? Should it be always-visible or appear only when instability is elevated?

---

## Testing Access

- Dev server: `npm run dev` → `http://0.0.0.0:5173`
- Tailscale: `http://100.74.153.81:5173`
- LAN: `http://192.168.122.96:5173`
- DevPanel: Click "DEV" button (top-right) for god-mode testing

## Architecture Reference

- Full vision: `docs/GAME_DESIGN.md`
- Design decisions: `docs/DESIGN-DECISIONS-V2.md`
- System architecture: `docs/ARCHITECTURE.md`
- Sprite pipeline: `docs/SPRITE_PIPELINE.md`
- Security: `docs/SECURITY.md`
