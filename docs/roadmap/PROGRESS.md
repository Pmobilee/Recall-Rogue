# Terra Gacha — Progress Tracker & Roadmap

Last updated: 2026-03-04

## How This Roadmap Works

- **This file** (`PROGRESS.md`) is the master oversight checklist
- Each phase links to a **detailed implementation document** that coding workers execute against
- Detailed docs live in `docs/roadmap/phases/` (not started), `docs/roadmap/in-progress/` (active), or `docs/roadmap/completed/` (done)
- Each phase doc contains: granular sub-steps, file paths, acceptance criteria, Playwright tests, and verification gates
- See `CLAUDE.md` → "Roadmap Workflow" for the full execution protocol

## Vision

Terra Gacha is a mobile-first 2D pixel-art mining roguelite where each dive fuels a long-term knowledge journey. The player crash-lands on a far-future Earth, excavates procedural mines for minerals and artifacts, and returns to the dome to ingest discoveries through GAIA, review facts with spaced repetition, and grow a living Knowledge Tree. The core fantasy is rediscovering Earth one artifact at a time.

## Current State

Phases 0-22 complete. Phase 22 (Social & Multiplayer) fully implemented: hub visiting with guestbook and gifts, 6-category leaderboards with daily refresh and anti-cheat plausibility checks, async knowledge duels with speed scoring and wagers, artifact card marketplace with trading and duplicate mixing, guild system with weekly challenges and GKP progression, referral system with fossil egg rewards and anti-abuse, admin social health dashboard, privacy settings (hub private, leaderboard opt-out). V2 roadmap Phases 23-25 remaining. V3 roadmap Phases 26-50 planned.

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
- [x] **Phase 8: Mine Gameplay Overhaul** — 20 layers, tick system, active hazards, O2 decay, landmarks, consumables, quiz overhaul, SM-2 tuning → [`completed/PHASE-08-MINE-GAMEPLAY.md`](completed/PHASE-08-MINE-GAMEPLAY.md)
- [x] **Phase 9: Biome Expansion** — 25 unique biomes, per-biome tiles, structural generation, ambient particles → [`completed/PHASE-09-BIOME-EXPANSION.md`](completed/PHASE-09-BIOME-EXPANSION.md)

### Hub & Content (Phases 10-11)
- [x] **Phase 10: Dome Hub Redesign** — Multi-floor hub, navigation, upgrades, animated pets, Knowledge Tree growth, daily briefing → [`completed/PHASE-10-DOME-HUB-REDESIGN.md`](completed/PHASE-10-DOME-HUB-REDESIGN.md)
- [x] **Phase 11: Fact Content Engine** — Ingestion API, LLM pipeline, dashboard, pixel art generation, schema updates → [`completed/PHASE-11-FACT-CONTENT-ENGINE.md`](completed/PHASE-11-FACT-CONTENT-ENGINE.md)

### Personalization & Learning (Phases 12-13)
- [x] **Phase 12: Interest & Personalization** — Interest settings, weighted spawning, behavioral learning, category lock, archetypes → [`completed/PHASE-12-INTEREST-PERSONALIZATION.md`](completed/PHASE-12-INTEREST-PERSONALIZATION.md)
- [x] **Phase 13: Knowledge Tree 2.0** — Radial tree, 3-level LOD, sub-branches, tap-to-view, mastery coloring → [`completed/PHASE-13-KNOWLEDGE-TREE-V2.md`](completed/PHASE-13-KNOWLEDGE-TREE-V2.md)

### Onboarding & Personality (Phases 14-16)
- [x] **Phase 14: Onboarding & Tutorial** — Backstory, GAIA intro, tutorial mine, progressive unlocks, reward front-loading → [`completed/PHASE-14-ONBOARDING-TUTORIAL.md`](completed/PHASE-14-ONBOARDING-TUTORIAL.md)
- [x] **Phase 15: GAIA Personality 2.0** — Post-dive reactions, idle popups, pet commentary, journey memory, mastery celebrations → [`completed/PHASE-15-GAIA-PERSONALITY-V2.md`](completed/PHASE-15-GAIA-PERSONALITY-V2.md)
- [x] **Phase 16: Fossil & Farming Expansion** — Crop fossils, knowledge-gated revival, farm planting → [`completed/PHASE-16-FOSSIL-FARMING-EXPANSION.md`](completed/PHASE-16-FOSSIL-FARMING-EXPANSION.md)

### Engagement & Tooling (Phases 17-18)
- [x] **Phase 17: Addictiveness Pass** — Gacha animations, sound design, session flow, streaks, weekly challenges, login calendar → [`completed/PHASE-17-ADDICTIVENESS-PASS.md`](completed/PHASE-17-ADDICTIVENESS-PASS.md)
- [x] **Phase 18: Dev Tooling** — Scenario presets, save snapshots, session profiles, review pressure audit, quiz anti-homework → [`completed/PHASE-18-DEV-TOOLING.md`](completed/PHASE-18-DEV-TOOLING.md)

### Infrastructure & Launch (Phases 19-20)
- [x] **Phase 19: Auth & Cloud** — Auth UI, cloud sync, PostgreSQL, Docker, offline mode, legal, profiles, analytics → [`completed/PHASE-19-AUTH-CLOUD.md`](completed/PHASE-19-AUTH-CLOUD.md)
- [x] **Phase 20: Mobile Launch** — Capacitor builds, store submission, ASO, soft launch, accessibility, web platform → [`completed/PHASE-20-MOBILE-LAUNCH.md`](completed/PHASE-20-MOBILE-LAUNCH.md)

### Monetization & Social (Phases 21-22)
- [x] **Phase 21: Monetization** — Terra Pass, IAP, O2 regen, season pass, Pioneer Pack, economy rebalance → [`completed/PHASE-21-MONETIZATION.md`](completed/PHASE-21-MONETIZATION.md)
- [x] **Phase 22: Social & Multiplayer** — Hub visiting, leaderboards, duels, trading, guilds, referrals → [`completed/PHASE-22-SOCIAL-MULTIPLAYER.md`](completed/PHASE-22-SOCIAL-MULTIPLAYER.md)

### Post-Launch (Phases 23-25)
- [x] **Phase 23: Live Ops & Seasons** — Seasonal events, content cadence, UGC, push notifications, completionist endgame → [`completed/PHASE-23-LIVE-OPS-SEASONS.md`](completed/PHASE-23-LIVE-OPS-SEASONS.md)
- [x] **Phase 24: Language Learning** — Multi-language, 3 SM-2 tracks, TTS pronunciation, language-specific tree → [`completed/PHASE-24-LANGUAGE-LEARNING.md`](completed/PHASE-24-LANGUAGE-LEARNING.md)
- [x] **Phase 25: Advanced Features** — Combat, co-op, achievements, advanced pets, accessibility, educational partnerships → [`completed/PHASE-25-ADVANCED-FEATURES.md`](completed/PHASE-25-ADVANCED-FEATURES.md)

---

## V3 Roadmap — Phases 26-50

Each phase below links to its detailed implementation document in `docs/roadmap/phases/`.

### Production Readiness (Phases 26-28)
- [x] **Phase 26: Production Backend Integration** — RevenueCat IAP, email provider (Resend), FCM/APNs push, Azure TTS, mount all server routes → [`completed/PHASE-26-PRODUCTION-BACKEND.md`](completed/PHASE-26-PRODUCTION-BACKEND.md)
- [ ] **Phase 27: Test Suite & CI/CD** — Unit tests (Vitest), integration tests, E2E (Playwright), GitHub Actions, seed determinism, code coverage → [`phases/PHASE-27-TEST-SUITE-CICD.md`](phases/PHASE-27-TEST-SUITE-CICD.md)
- [ ] **Phase 28: Performance & Optimization** — Device tier profiling, bundle analysis, GPU budget enforcement, dirty-rect rendering, memory management → [`phases/PHASE-28-PERFORMANCE-OPTIMIZATION.md`](phases/PHASE-28-PERFORMANCE-OPTIMIZATION.md)

### Visual & Game Feel (Phases 29-31)
- [ ] **Phase 29: Character Animation System** — 48-frame miner sprite sheets, directional walk/mine, idle states, gear overlays, animation state machine → [`phases/PHASE-29-CHARACTER-ANIMATION.md`](phases/PHASE-29-CHARACTER-ANIMATION.md)
- [ ] **Phase 30: Mining Juice & Game Feel** — Loot pop physics, block break sequences, screen shake, crack overlays, per-block impact profiles → [`phases/PHASE-30-MINING-JUICE.md`](phases/PHASE-30-MINING-JUICE.md)
- [ ] **Phase 31: Gacha & Reveal Polish** — Rarity-tiered reveal timing, artifact reveal sequences, block rarity previews, celebration particles, layer descent animation → [`phases/PHASE-31-GACHA-REVEAL-POLISH.md`](phases/PHASE-31-GACHA-REVEAL-POLISH.md)

### Content Factory (Phases 32-34)
- [ ] **Phase 32: Fact Content Scaling** — 3,000+ fact pipeline, automated LLM quality gates, distractor expansion, delta sync protocol, content cadence tooling → [`phases/PHASE-32-CONTENT-SCALING.md`](phases/PHASE-32-CONTENT-SCALING.md)
- [ ] **Phase 33: Biome Visual Diversity** — 25 unique tile sprite sets, 8-bit hero biome autotiling, per-biome fog colors, depth visual gradient, transition tilesets → [`phases/PHASE-33-BIOME-VISUAL-DIVERSITY.md`](phases/PHASE-33-BIOME-VISUAL-DIVERSITY.md)
- [ ] **Phase 34: Pixel Art Per Fact** — ComfyUI batch pipeline, greyscale-to-color mastery progression, 3-gate sprite QC, resumable generation, build-time audit → [`phases/PHASE-34-PIXEL-ART-PER-FACT.md`](phases/PHASE-34-PIXEL-ART-PER-FACT.md)

### Gameplay Expansion (Phases 35-37)
- [ ] **Phase 35: Mine Mechanics Completion** — Quiz gates, quiz streak multipliers, offering altars, layer instability meter, recipe fragments, conditionally breakable blocks → [`phases/PHASE-35-MINE-MECHANICS-COMPLETION.md`](phases/PHASE-35-MINE-MECHANICS-COMPLETION.md)
- [ ] **Phase 36: Combat System** — Boss encounters at L5/L10/L15/L20, creature spawning, quiz gauntlets, combat rewards, "The Deep" secret biome → [`phases/PHASE-36-COMBAT-SYSTEM.md`](phases/PHASE-36-COMBAT-SYSTEM.md)
- [ ] **Phase 37: Advanced Pet System** — Dust Cat permanent pet, feeding/grooming mini-games, personality traits, companion synergies, legendary evolution → [`phases/PHASE-37-ADVANCED-PET-SYSTEM.md`](phases/PHASE-37-ADVANCED-PET-SYSTEM.md)

### Platform & International (Phases 38-40)
- [ ] **Phase 38: iOS App Store Launch** — Apple Developer setup, TestFlight, App Store submission, iOS-specific optimizations, review guidelines → [`phases/PHASE-38-IOS-LAUNCH.md`](phases/PHASE-38-IOS-LAUNCH.md)
- [ ] **Phase 39: Web Platform Excellence** — PWA optimization, desktop responsive layouts, keyboard shortcuts, SEO, Cloudflare Pages deployment → [`phases/PHASE-39-WEB-PLATFORM.md`](phases/PHASE-39-WEB-PLATFORM.md)
- [ ] **Phase 40: Internationalization & Localization** — Multi-language UI, RTL support, locale-specific formatting, translation pipeline, content localization → [`phases/PHASE-40-INTERNATIONALIZATION.md`](phases/PHASE-40-INTERNATIONALIZATION.md)

### Growth & Analytics (Phases 41-43)
- [ ] **Phase 41: Advanced Analytics & Experiments** — Feature flag system, A/B testing framework, funnel analysis, cohort dashboards, retention optimization → [`phases/PHASE-41-ANALYTICS-EXPERIMENTS.md`](phases/PHASE-41-ANALYTICS-EXPERIMENTS.md)
- [ ] **Phase 42: Viral Growth Engine** — Share paintings, referral optimization, social proof badges, invite deep links, ASO iteration → [`phases/PHASE-42-VIRAL-GROWTH.md`](phases/PHASE-42-VIRAL-GROWTH.md)
- [ ] **Phase 43: Cooperative Dives** — WebSocket 2-player co-op, shared state sync, Miner/Scholar roles, loot ledger, disconnect recovery → [`phases/PHASE-43-COOPERATIVE-DIVES.md`](phases/PHASE-43-COOPERATIVE-DIVES.md)

### Education (Phases 44-46)
- [ ] **Phase 44: Teacher Dashboard** — Standalone Vite app, educator verification, class codes, aggregate analytics, homework category lock → [`phases/PHASE-44-TEACHER-DASHBOARD.md`](phases/PHASE-44-TEACHER-DASHBOARD.md)
- [ ] **Phase 45: Kid Mode & Parental Controls** — Kid Wow Score, session time limits, parent PIN, weekly learning emails, COPPA enforcement → [`phases/PHASE-45-KID-MODE-PARENTAL.md`](phases/PHASE-45-KID-MODE-PARENTAL.md)
- [ ] **Phase 46: Learning Effectiveness Research** — Anonymization pipeline, academic partnerships, annual reports, GAIA's Report tab, CSV export → [`phases/PHASE-46-LEARNING-EFFECTIVENESS.md`](phases/PHASE-46-LEARNING-EFFECTIVENESS.md)

### Endgame & Mastery (Phases 47-49)
- [ ] **Phase 47: Achievement Gallery** — 7th dome room, 20 milestone paintings, achievement tracking, paint-reveal animation, share to device gallery → [`phases/PHASE-47-ACHIEVEMENT-GALLERY.md`](phases/PHASE-47-ACHIEVEMENT-GALLERY.md)
- [ ] **Phase 48: Prestige & Endgame Systems** — Omniscient golden dome, mentor mode, post-mastery challenge mode, biome completion bonuses, GAIA peer dialogue → [`phases/PHASE-48-PRESTIGE-ENDGAME.md`](phases/PHASE-48-PRESTIGE-ENDGAME.md)
- [ ] **Phase 49: Advanced Mine Generation** — Procedural micro-structures, biome transition zones, structural features, anomaly probability system, seed determinism → [`phases/PHASE-49-ADVANCED-MINE-GENERATION.md`](phases/PHASE-49-ADVANCED-MINE-GENERATION.md)

### Platform Maturity (Phase 50)
- [ ] **Phase 50: Open Content Ecosystem** — Public fact API, community moderation tools, educational partnerships, content licensing, third-party integrations → [`phases/PHASE-50-OPEN-CONTENT-ECOSYSTEM.md`](phases/PHASE-50-OPEN-CONTENT-ECOSYSTEM.md)

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
