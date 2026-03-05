# Terra Gacha — Progress Tracker & Roadmap

Last updated: 2026-03-06

## How This Roadmap Works

- **This file** (`PROGRESS.md`) is the master oversight checklist
- Each phase links to a **detailed implementation document** that coding workers execute against
- Detailed docs live in `docs/roadmap/phases/` (not started), `docs/roadmap/in-progress/` (active), or `docs/roadmap/completed/` (done)
- Each phase doc contains: granular sub-steps, file paths, acceptance criteria, Playwright tests, and verification gates
- See `CLAUDE.md` → "Roadmap Workflow" for the full execution protocol

## Vision

Terra Gacha is a mobile-first 2D pixel-art mining roguelite where each dive fuels a long-term knowledge journey. The player crash-lands on a far-future Earth, excavates procedural mines for minerals and artifacts, and returns to the dome to ingest discoveries through GAIA, review facts with spaced repetition, and grow a living Knowledge Tree. The core fantasy is rediscovering Earth one artifact at a time.

## Current State

Phase 59 (Artifact Analyzer) COMPLETE. ALL V4 PHASES DONE (51-59). Mystery loot system with study score (0.0-1.0), weighted loot tables per rarity tier, 5-stage cracking animation, PendingArtifact type rework with migration, GAIA study nudges. 0 typecheck errors, build clean. 592 TypeScript/Svelte files.

V4 Roadmap (Phases 51–58) planned 2026-03-06: 8 phases targeting loot loop fidelity (sacrifice agency, decision screen, backpack stacking), learning depth (morning/evening rituals, layer challenges, rarity quizzes), knowledge tree vitality (wilting, sparks, branch bonuses), mine atmosphere (ambient stories, quote stones, scanner pulse), economy depth (mixing, compression tax, daily deals), social foundation (fact of day, guilds, seasons), visual polish (dirt tint, barely-made-it, GAIA expressions), and content quality (1,000 facts, distractor expansion, admin dashboard).

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

### PRIORITY: Critical Fixes (Execute First)
- [x] **Critical Fixes & UX Overhaul** — Mine freeze crash, dome camera crash, layer transitions, quiz display bugs, onboarding triple-age-gate, language selection, fact pacing, settings menu → [`completed/PHASE-CRITICAL-FIXES.md`](completed/PHASE-CRITICAL-FIXES.md)

### Production Readiness (Phases 26-28)
- [x] **Phase 26: Production Backend Integration** — RevenueCat IAP, email provider (Resend), FCM/APNs push, Azure TTS, mount all server routes → [`completed/PHASE-26-PRODUCTION-BACKEND.md`](completed/PHASE-26-PRODUCTION-BACKEND.md)
- [x] **Phase 27: Test Suite & CI/CD** — Unit tests (Vitest), integration tests, E2E (Playwright), GitHub Actions, seed determinism, code coverage → [`completed/PHASE-27-TEST-SUITE-CICD.md`](completed/PHASE-27-TEST-SUITE-CICD.md)
- [x] **Phase 28: Performance & Optimization** — Device tier profiling, bundle analysis, GPU budget enforcement, dirty-rect rendering, memory management → [`completed/PHASE-28-PERFORMANCE-OPTIMIZATION.md`](completed/PHASE-28-PERFORMANCE-OPTIMIZATION.md)

### Visual & Game Feel (Phases 29-31)
- [x] **Phase 29: Character Animation System** — 48-frame miner sprite sheets, directional walk/mine, idle states, gear overlays, animation state machine → [`completed/PHASE-29-CHARACTER-ANIMATION.md`](completed/PHASE-29-CHARACTER-ANIMATION.md)
- [x] **Phase 30: Mining Juice & Game Feel** — Loot pop physics, block break sequences, screen shake, crack overlays, per-block impact profiles → [`completed/PHASE-30-MINING-JUICE.md`](completed/PHASE-30-MINING-JUICE.md)
- [x] **Phase 31: Gacha & Reveal Polish** — Rarity-tiered reveal timing, artifact reveal sequences, block rarity previews, celebration particles, layer descent animation → [`completed/PHASE-31-GACHA-REVEAL-POLISH.md`](completed/PHASE-31-GACHA-REVEAL-POLISH.md)

### Content Factory (Phases 32-34)
- [x] **Phase 32: Fact Content Scaling** — 3,000+ fact pipeline, automated LLM quality gates, distractor expansion, delta sync protocol, content cadence tooling → [`completed/PHASE-32-CONTENT-SCALING.md`](completed/PHASE-32-CONTENT-SCALING.md)
- [x] **Phase 33: Biome Visual Diversity** — 25 unique tile sprite sets, 8-bit hero biome autotiling, per-biome fog colors, depth visual gradient, transition tilesets → [`completed/PHASE-33-BIOME-VISUAL-DIVERSITY.md`](completed/PHASE-33-BIOME-VISUAL-DIVERSITY.md)
- [x] **Phase 34: Pixel Art Per Fact** — ComfyUI batch pipeline, greyscale-to-color mastery progression, 3-gate sprite QC, resumable generation, build-time audit → [`completed/PHASE-34-PIXEL-ART-PER-FACT.md`](completed/PHASE-34-PIXEL-ART-PER-FACT.md)

### Gameplay Expansion (Phases 35-37)
- [x] **Phase 35: Mine Mechanics Completion** — Quiz gates, quiz streak multipliers, offering altars, layer instability meter, recipe fragments, conditionally breakable blocks → [`completed/PHASE-35-MINE-MECHANICS-COMPLETION.md`](completed/PHASE-35-MINE-MECHANICS-COMPLETION.md)
- [x] **Phase 36: Combat System** — Boss encounters at L5/L10/L15/L20, creature spawning, quiz gauntlets, combat rewards, "The Deep" secret biome → [`completed/PHASE-36-COMBAT-SYSTEM.md`](completed/PHASE-36-COMBAT-SYSTEM.md)
- [x] **Phase 37: Advanced Pet System** — Dust Cat permanent pet, feeding/grooming mini-games, personality traits, companion synergies, legendary evolution → [`completed/PHASE-37-ADVANCED-PET-SYSTEM.md`](completed/PHASE-37-ADVANCED-PET-SYSTEM.md)

### Platform & International (Phases 38-40)
- [x] **Phase 38: iOS App Store Launch** — Apple Developer setup, TestFlight, App Store submission, iOS-specific optimizations, review guidelines → [`completed/PHASE-38-IOS-LAUNCH.md`](completed/PHASE-38-IOS-LAUNCH.md)
- [x] **Phase 39: Web Platform Excellence** — PWA optimization, desktop responsive layouts, keyboard shortcuts, SEO, Cloudflare Pages deployment → [`completed/PHASE-39-WEB-PLATFORM.md`](completed/PHASE-39-WEB-PLATFORM.md)
- [x] **Phase 40: Internationalization & Localization** — Multi-language UI, RTL support, locale-specific formatting, translation pipeline, content localization → [`completed/PHASE-40-INTERNATIONALIZATION.md`](completed/PHASE-40-INTERNATIONALIZATION.md)

### Growth & Analytics (Phases 41-43)
- [x] **Phase 41: Advanced Analytics & Experiments** — Feature flag system, A/B testing framework, funnel analysis, cohort dashboards, retention optimization → [`completed/PHASE-41-ANALYTICS-EXPERIMENTS.md`](completed/PHASE-41-ANALYTICS-EXPERIMENTS.md)
- [x] **Phase 42: Viral Growth Engine** — Share card generator (canvas 1200×630), referral tier progress bar, social proof badges, iOS/Android deep links, ASO review prompt, K-factor analytics → [`completed/PHASE-42-VIRAL-GROWTH.md`](completed/PHASE-42-VIRAL-GROWTH.md)
- [x] **Phase 43: Cooperative Dives** — WebSocket 2-player co-op, shared state sync, Miner/Scholar roles, loot ledger, disconnect recovery → [`completed/PHASE-43-COOPERATIVE-DIVES.md`](completed/PHASE-43-COOPERATIVE-DIVES.md)

### Education (Phases 44-46)
- [x] **Phase 44: Teacher Dashboard** — Standalone Vite app, educator verification, class codes, aggregate analytics, homework category lock → [`completed/PHASE-44-TEACHER-DASHBOARD.md`](completed/PHASE-44-TEACHER-DASHBOARD.md)
- [x] **Phase 45: Kid Mode & Parental Controls** — Kid Wow Score, session time limits, parent PIN, weekly learning emails, COPPA enforcement → [`completed/PHASE-45-KID-MODE-PARENTAL.md`](completed/PHASE-45-KID-MODE-PARENTAL.md)
- [x] **Phase 46: Learning Effectiveness Research** — Anonymization pipeline, academic partnerships, annual reports, GAIA's Report tab, CSV export → [`completed/PHASE-46-LEARNING-EFFECTIVENESS.md`](completed/PHASE-46-LEARNING-EFFECTIVENESS.md)

### Endgame & Mastery (Phases 47-49)
- [x] **Phase 47: Achievement Gallery** — 7th dome room, 20 milestone paintings, achievement tracking, paint-reveal animation, share to device gallery → [`completed/PHASE-47-ACHIEVEMENT-GALLERY.md`](completed/PHASE-47-ACHIEVEMENT-GALLERY.md)
- [x] **Phase 48: Prestige & Endgame Systems** — Omniscient golden dome, mentor mode, post-mastery challenge mode, biome completion bonuses, GAIA peer dialogue → [`completed/PHASE-48-PRESTIGE-ENDGAME.md`](completed/PHASE-48-PRESTIGE-ENDGAME.md)
- [x] **Phase 49: Advanced Mine Generation** — Procedural micro-structures, biome transition zones, structural features, anomaly probability system, seed determinism, mine preview thumbnail, dynamic difficulty → [`completed/PHASE-49-ADVANCED-MINE-GENERATION.md`](completed/PHASE-49-ADVANCED-MINE-GENERATION.md)

### Platform Maturity (Phase 50)
- [x] **Phase 50: Open Content Ecosystem** — Public fact API, community moderation tools, educational partnerships, content licensing, third-party integrations → [`completed/PHASE-50-OPEN-CONTENT-ECOSYSTEM.md`](completed/PHASE-50-OPEN-CONTENT-ECOSYSTEM.md)

---

## Emergency Fixes

- [x] **Phase 51 Emergency UX Fixes** — 13 critical bugs: dive-deeper CTA, mine re-entry crash, owned-only consumables/relics/pickaxes, loot summary, starter dome rooms, GAIA click, button overlap, floor dots, context-aware sidebar, quiz no-repeat → [`completed/PHASE-51-EMERGENCY-UX-FIXES.md`](completed/PHASE-51-EMERGENCY-UX-FIXES.md)

---

## V4 Roadmap — Phases 51-58

Each phase below links to its detailed implementation document in `docs/roadmap/phases/`.

### Loot & Economy (Phases 51, 55)
- [x] **Phase 51: Core Loot Loop Fidelity** — Sacrifice choice screen (depth-scaled), "The Cloth" decision overlay, send-up slot scaling, backpack stack limits per tier, Rescue Beacon consumable → [`completed/PHASE-51-CORE-LOOT-FIDELITY.md`](completed/PHASE-51-CORE-LOOT-FIDELITY.md)
- [x] **Phase 55: Economy Depth** — Duplicate artifact mixing (local state, 60/30/10 rarity roll), compression tax display, 3-slot daily deals with 7-day pity rotation, Premium Materializer golden glow + PREMIUM badge → [`completed/PHASE-55-ECONOMY-DEPTH.md`](completed/PHASE-55-ECONOMY-DEPTH.md)

### Learning Systems (Phases 52, 53)
- [x] **Phase 52: Learning Depth** — Morning/evening quiz oxygen bonus, 3-question layer entrance challenge, artifact rarity boost quiz, GAIA mnemonic on struggle, SM-2 consistency penalty exact wiring → [`completed/PHASE-52-LEARNING-DEPTH.md`](completed/PHASE-52-LEARNING-DEPTH.md)
- [x] **Phase 53: Knowledge Tree Vitality** — Leaf wilting/decay (3 visual stages), branch completion percentage badges, Learning Sparks currency, branch gameplay bonuses at 25% completion → [`completed/PHASE-53-KNOWLEDGE-TREE-VITALITY.md`](completed/PHASE-53-KNOWLEDGE-TREE-VITALITY.md)

### Mine & Atmosphere (Phase 54)
- [x] **Phase 54: Mine Atmosphere** — Ambient environmental storytelling (65+ biome flavor texts), Quote Stones with 40+ entries and GAIA reactions, readable cavern wall texts (25+ entries), WallText block type, scanner constants → [`completed/PHASE-54-MINE-ATMOSPHERE.md`](completed/PHASE-54-MINE-ATMOSPHERE.md)

### Social & Live-Ops (Phase 56)
- [x] **Phase 56: Social & Live-Ops Foundation** — Fact of the Day (server-selected daily, Hub panel), dome guestbook completion, fact trading anti-exploitation guards, guild knowledge-focus and XP pool, seasonal event framework → [`completed/PHASE-56-SOCIAL-LIVEOPS.md`](completed/PHASE-56-SOCIAL-LIVEOPS.md)

### Visual Polish (Phase 57)
- [x] **Phase 57: Visual & Feel Polish Pass** — Miner progressive dirt tint, study session atmospheric dome scene, "barely made it" mechanic (resolve Q-D4), greyscale-to-color fact image wiring, GAIA avatar micro-expressions → [`completed/PHASE-57-VISUAL-POLISH.md`](completed/PHASE-57-VISUAL-POLISH.md)

### Content Quality (Phase 58)
- [x] **Phase 58: Content & Data Quality** — Scale facts to 1,000, distractor pool audit and expansion to 25 per fact, source field population, fact content admin dashboard (/admin/facts), content quality audit report → [`completed/PHASE-58-CONTENT-QUALITY.md`](completed/PHASE-58-CONTENT-QUALITY.md)

### Core Loop Rework (Phase 59)
- [x] **Phase 59: Artifact Analyzer** — Artifacts become mystery containers cracked open in Artifact Lab. Rewards: facts, dust, consumables, fossils, upgrade tokens, junk. Study score (SM-2 habits) shifts loot table — diligent learners get better rewards, neglectful players get junk + GAIA nudges. 5-stage cracking animation. Badge count on Artifact Lab. → [`completed/PHASE-59-ARTIFACT-ANALYZER.md`](completed/PHASE-59-ARTIFACT-ANALYZER.md)

---

## EMERGENCY — Phase 51: Critical UX & Gameplay Fixes

**Status**: NOT STARTED — Must be done before any sharing/testing

- [ ] **Phase 51: Emergency UX & Gameplay Fixes** — 13 critical bugs from playtesting: dive-deeper flow, mine restart responsiveness, consumable/relic/pickaxe gating, artifact→facts pipeline, loot summary screen, dome completeness, settings/DEV button overlap, floor dots, context sidebar, SM-2 mine contribution, quiz repeat prevention → [`phases/PHASE-51-EMERGENCY-UX-FIXES.md`](phases/PHASE-51-EMERGENCY-UX-FIXES.md)

### Phase 51 Sub-steps
| Sub-step | Issue | Status |
|----------|-------|--------|
| 51.1 | "Continue" after dive goes to dome; need "Dive Deeper" CTA | ☐ |
| 51.2 | Re-entering mine after dome visit: unresponsive empty scene | ☐ |
| 51.3 | Consumables shown without ownership (all types freely available) | ☐ |
| 51.4 | Relics shown without finding them (RELIC_CATALOGUE fallback) | ☐ |
| 51.5 | Pickaxe UI shows all tiers; should be owned-only dropdown | ☐ |
| 51.6 | Artifact mined but never appears in facts/knowledge base | ☐ |
| 51.7 | Can select same consumable ×N without owning N copies | ☐ |
| 51.8 | No loot summary screen shown on mine exit | ☐ |
| 51.9 | Dome missing study/artifact/upgrade rooms; GAIA not clickable | ☐ |
| 51.10 | Settings button hidden behind DEV button | ☐ |
| 51.11 | Floor indicator dots stuck as full-screen overlay | ☐ |
| 51.12 | Sidebar shows review stats during mine (should show mine stats) | ☐ |
| 51.13 | Wrong quiz answer: next question can be the same fact | ☐ |

---

## Open Design Questions

### Economy & Balance
- **Q-E1**: Mineral conversion tax ratio — ANSWERED (Phase 55): 5% compression loss tax; see `MINERAL_COMPRESSION_TAX: 0.05` in balance.ts
- **Q-E2**: Rescue beacon cost — ANSWERED (Phase 51 + 55): 200 Crystal + 2 Geode; see balance.ts `RESCUE_BEACON_COST_*`
- **Q-E3**: Daily deal structure — ANSWERED (Phase 55): 3 fixed slots (consumable 20% off, cosmetic standard, 7-day featured with Day-7 pity Rare+)
- **Q-E4**: Learning Sparks currency — ANSWERED (Phase 53): earned via mastery milestones; see `LEARNING_SPARKS_PER_MILESTONE` in balance.ts
- **Q-D2**: Backpack starting size — PARTIALLY ANSWERED (DD-V2-061): starting 6 slots, max 14 with upgrades, auto-compress at 50:1; final numbers need playtesting validation
- **Q-D3**: Oxygen cost per action — ANSWERED (DD-V2-061): depth decay system with 1.0× at layer 1, 1.5× at layer 10, 2.5× at layer 20, linear interpolation between milestones; see Phase 8.5
- **Q-D4**: "Barely made it" mechanic — ANSWERED (Phase 57): within 5 blocks of exit → red border flash + full loot preserved; `BARELY_MADE_IT_THRESHOLD: 5` in balance.ts

### Social & Meta
- **Q-S1**: Guild/faction structure — ANSWERED (Phase 56): knowledge-area guilds (max 50 members), primary focus category, collective guild XP pool, branch completion leaderboard
- **Q-S2**: Season/battle pass design — ANSWERED (Phase 56): 6-week server-driven seasons, boosted category, time-limited cosmetics, seasonal leaderboard
- **Q-S3**: Fact trading anti-exploitation — ANSWERED (Phase 56): 3 trades/day limit, mastery guard (cannot receive Mastered-level facts), soulbound restriction, server-side validation

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
