# Recall Rogue — Implementation Roadmap

> Design source of truth: `docs/GAME_DESIGN.md`
> Card roguelite spec: `docs/RESEARCH/02_terra-miner-card-roguelite-spec.md`

---

## Current Status

**Playable pre-launch build.** AR-01 through AR-16 core gameplay/content infrastructure is complete. AR-20 and AR-21 social/monetization runtime wiring is complete. AR-22 through AR-26 game design overhaul is complete (rename to Recall Rogue, 24-floor run structure, balance/UX pass, push notifications, doc overhaul).

**Recent completed phases (March 9-10, 2026):**
- AR-22 Global rename from "Arcane Recall" to "Recall Rogue" across all files.
- AR-23 Run structure overhauled to 24-floor dungeon with 4 segments, 8 bosses, 6 mini-boss templates, save/resume, campfire pause, special events.
- AR-24 Launch balance and UX pass: mechanic phase gating, difficulty mode rename, Story Mode forced runs 1-3, tier display simplification, wowFactor, review prompts.
- AR-25 Push notifications: 4 notification types, quiet hours, priority scheduling, per-type settings toggles.
- AR-26 All documentation updated to reflect AR-22-25 changes plus ascension mode design.
- AR-20 Competitive/social runtime wiring including Daily + Endless leaderboard submissions.
- AR-21 Monetization activation including Arcane Pass/Season Pass/Cosmetic Store surfacing and Scholar Challenge.
- Regression hardening pass: unit coverage added for AR-21 monetization grant flows and AR-30 camp cosmetics progression state (`tests/unit/monetizationService.test.ts`, `tests/unit/campState.test.ts`).
- Hub rendering hardening: `DomeCanvas` now renders interactive placeholders for missing sprite assets so knowledge-tree and other dome objects remain visible/clickable even without full art packs.
- Dome asset key coverage hardening: added missing dome object/stage keys in `domeManifest`, generated deterministic low/high placeholder dome sprites, and restored clean `audit-assets` status (`All clear`).
- AR-20 competitive runtime hardening: added regression coverage for Endless Depths and Scholar Challenge reservation/completion/leaderboard mapping (`tests/unit/endlessDepthsService.test.ts`, `tests/unit/scholarChallengeService.test.ts`).
- Added dome sprite coverage regression tests to keep layout/tree sprite keys aligned with `DOME_SPRITE_KEYS` (`tests/unit/domeManifest.test.ts`).
- Build-pipeline hardening: `scripts/convert-to-webp.mjs` now skips up-to-date assets, validates conversion integrity (non-empty + dimension match), and fails strict builds on conversion errors.
- Worker-orchestration observability: `content:workers:status` now summarizes per-domain generated/worker-output counts, target deltas, and prepare/ingest/QA/promote stage health in one JSON report.
- Auth/session hardening: centralized access/refresh token handling in `src/services/authTokens.ts` and removed scattered token-key reads from social/classroom/feature-flag clients.

**Next up:** Continue worker-first AR-17/AR-19 production runs (external Claude subscription workers + full-scale QA gates) and process deferred go-live tasks only when explicitly unblocked. Visual-description and ComfyUI tracks continue in their separate workstreams.

**Parallel workstreams (separate from core engineering):**
- Visual descriptions regeneration (AR-11 Part C + AR-18 visual theming) is handled in a dedicated content-art stream.
- ComfyUI image/cardback generation is handled in a dedicated art pipeline stream.
- Core engineering continues independently on data pipelines, validation, gameplay logic, and DB migration tooling.

---

## Active Phases

- **AR-11:** Content pipeline infrastructure is implemented; visual-description cleanup/regeneration remains in the separate art/content stream.
- **AR-17:** Worker fact generation engine tooling is complete and in active worker execution.
- **AR-18:** Vocabulary tooling/UI wiring is complete; full corpus generation and themed visuals remain in progress.
- **AR-19:** QA/promotion tooling is complete; production-scale worker output review, visual descriptions, and ComfyUI art passes remain in progress.

---

## Completed Phases ✓

### Foundation (CR-01 → CR-19, CR-FIX-01)
19 phases completed across P0 (CR-01→07), P1 (CR-08→13), P1.5 Art Pipeline (CR-14→19), and CR-FIX-01. Specs archived in `docs/roadmap/completed/`.

### AR-01: Combat Integrity ✓
Commit-before-reveal, dynamic timer, domain/type decoupling, end turn polish, encounter edge cases. → [Spec](completed/AR-01-COMBAT-INTEGRITY.md)

### AR-02: Spaced Repetition Upgrade ✓
FSRS migration, tier derivation, PlayerFactState, question variant rotation. → [Spec](completed/AR-02-FSRS-MIGRATION.md)

### AR-03: Visual Polish + Asset Integration ✓
47 art assets wired in — player/enemy/boss sprites, card frames, backgrounds, doors, domain icons. → [Spec](completed/AR-03-VISUAL-POLISH.md)

### AR-05: Sound + Engagement Loops ✓
Core SFX, Adventurer's Journal, bounty quests, daily login streak, canary system. → [Spec](completed/AR-05-SOUND-ENGAGEMENT.md)

### AR-06: Knowledge Library + Lore ✓
Knowledge Library with domain filters, Lore Discovery milestones, fact detail view. → [Spec](completed/AR-06-KNOWLEDGE-LIBRARY.md)

### AR-04: Onboarding + Difficulty Modes ✓
60-second onboarding, difficulty modes, calibration handoff to AR-10, and hint system complete. → [Spec](completed/AR-04-ONBOARDING.md)

### AR-14: Soft Launch & Analytics ✓
Core funnel instrumentation, A/B framework, geo/invite gating, feedback hooks, and weekly analytics runbook completed. → [Spec](completed/AR-14-SOFT-LAUNCH-ANALYTICS.md)

### AR-15: Content Source Registry & Wikidata Query Library ✓
Content source registry, SPARQL query set, API fetchers, and source pipeline docs completed. → [Spec](completed/AR-15-CONTENT-SOURCE-REGISTRY.md)

### AR-16: Knowledge Domain Expansion ✓
Expanded domain model, metadata, resolver mappings, run-pool/category compatibility, and UI domain surfacing completed. → [Spec](completed/AR-16-DOMAIN-EXPANSION.md)

### AR-13: Launch Readiness ✓
Performance audit, full Playwright E2E coverage, dead-code cleanup (including mining-era archive removal), PWA, error tracking, share verification, and responsive layout checks complete. → [Spec](completed/AR-13-LAUNCH-READINESS.md)

### AR-22: Rename to Recall Rogue ✓
Global rename from "Arcane Recall" / "Terra Gacha" to "Recall Rogue" across 263 files. → [Spec](completed/AR-22-RENAME.md)

### AR-23: Run Structure Overhaul ✓
24-floor dungeon, 8 bosses, 6 mini-boss templates, save/resume, campfire pause, special events. → [Spec](completed/AR-23-RUN-STRUCTURE-OVERHAUL.md)

### AR-24: Launch Balance & UX Pass ✓
Mechanic phase gating, difficulty mode rename, Story Mode forced runs 1-3, tier display simplification, wowFactor, review prompts. → [Spec](completed/AR-24-LAUNCH-BALANCE-UX.md)

### AR-25: Push Notifications ✓
4 notification types, quiet hours, priority scheduling, per-type settings toggles, web fallback. → [Spec](completed/AR-25-PUSH-NOTIFICATIONS.md)

### AR-26: Game Design Doc Overhaul ✓
GAME_DESIGN.md, ARCHITECTURE.md, PROGRESS.md updated with AR-22-25 changes and ascension mode design. → [Spec](completed/AR-26-DOC-OVERHAUL.md)

### AR-21: Monetization Activation ✓
Ad-removal entitlement, Arcane Pass/Season Pass/Cosmetic Store surfacing, Scholar Challenge weekly mode + leaderboard cycle, and subscriber sub-category filters are implemented. → [Spec](completed/AR-21-MONETIZATION-ACTIVATION.md)

---

## Superseded / Archived

### AR-07: Launch Readiness (superseded by AR-13)

- [ ] ~~Capacitor build verification~~ → moved to AR-13
- [x] **Accessibility baseline** — Colorblind support, 3 text sizes, high contrast, reduce motion, 48dp+ touch targets.
- [ ] ~~Playwright E2E test suite~~ → expanded in AR-13
- [ ] ~~Performance audit~~ → moved to AR-13
- [x] ~~Dead code cleanup~~ → completed in AR-13
- [x] **App store metadata** — Screenshots, description, privacy policy, age rating.

Note: AR-07 is being superseded by AR-13 which has a broader scope including web deployment, PWA, and the new deck building/hub features that must be tested. The completed items (accessibility, metadata) stand.

→ [Spec](phases/AR-07-LAUNCH-READINESS.md)

---

## Pre-Launch History (Completed + Archived)

### AR-08: Hub Navigation & Feature Discovery
**Surface all built-but-hidden features.** Create main hub/home screen with navigation to Start Run, Knowledge Library, Settings, Profile. Add streak display, last run summary widget, post-run share image generator. Wire up existing components that currently have no entry point.

- [x] Main hub screen with tab/nav bar
- [x] Knowledge Library accessible from hub
- [x] Settings + Parental Controls accessible
- [x] Profile screen accessible
- [x] Streak display on home screen
- [x] Last run summary widget
- [x] Post-run share image generator (Wordle-style)
- [x] Run start flow preserved (domain selection → archetype → run)

Depends on: None. Estimated: Medium. **Status: Completed (March 9, 2026).**
→ [Spec](completed/AR-08-HUB-NAVIGATION.md)

---

### AR-09: Strategic Deck Building (Card Type Selection)
**Replace random card rewards with type-selection for strategic deck building.** Players choose card TYPE after encounters (Attack/Shield/Heal/etc.), random fact assigned. Starter deck reduced to 15. Archetype selection at run start weights type options.

- [x] Card reward screen redesign: 3 TYPE options instead of 3 random cards
- [x] Type-to-fact random assignment on selection
- [x] Starter deck reduced from 20 to 15 cards
- [x] Archetype selection UI at run start (Balanced/Aggressive/Defensive/Control/Hybrid)
- [x] Archetype weighting logic for reward type options
- [x] Card selling/removal at shop rooms
- [x] Balance pass: starter deck composition, type distribution

Depends on: None. Estimated: Medium. **Status: Completed (March 9, 2026).**
→ [Spec](completed/AR-09-STRATEGIC-DECK-BUILDING.md)

---

### AR-10: Calibration & Cold Start Resolution
**Implement accelerated FSRS gains during early runs (Option B).** Finishes the last item from AR-04.

- [x] Early run boost: correct + fast (under 50% timer) = 2x stability gain during runs 1-3
- [x] Run accuracy bonus: 80%+ = flat +2d stability to all correct facts
- [x] First-time correct starts at 2d stability instead of 1d
- [x] Domain-specific acceleration on first selection of new domain
- [x] RunPoolBuilder probe mode: diverse-difficulty front-loading in first run per domain
- [x] Runs-per-domain tracking in player profile

Depends on: AR-02 (done). Estimated: Small-Medium. **Status: Completed (March 9, 2026).**
→ [Spec](completed/AR-10-CALIBRATION-COLD-START.md)

---

### AR-11: Content Pipeline Infrastructure (Claude CLI + Ingestion + Visual Descriptions)
**Build the full content production pipeline: Claude CLI fact generation → validation → ingestion → language-themed visual description generation → card back art.** This is the engine that scales from 122 facts to 10K+ per domain.

**Part A: Claude CLI Fact Generation Setup**
- [x] System prompts for fact generation per domain (Science, History, Geography, etc.)
- [x] System prompts for vocabulary generation per language (Japanese, Spanish, French, etc.)
- [x] Source citation requirement: every fact MUST have a `sourceName` (Wikipedia preferred)
- [x] Fact-checking validation tooling: cross-reference generated facts against source (`qa/source-fact-check.mjs`)
- [x] Output format: JSON matching seed data schema (all columns populated)
- [x] Distractor generation: 5+ plausible distractors per fact, close enough to challenge
- [x] Question variant generation: 3-4 variants per fact (forward, reverse, fill-blank, true/false)

**Part B: Ingestion & Validation**
- [x] CLI tool for bulk fact ingestion from JSON
- [x] Schema validation (all required fields, variant count ≥ 2, distractor count ≥ 2)
- [x] Duplicate detection (fuzzy match on question text)
- [x] Domain coverage report (facts per domain, per difficulty, age rating distribution)
- [x] Distractor quality flagging (too easy / too similar to correct answer)
- [x] Migration to sql.js database (public/facts.db + seed-pack.json)
- [x] `verifiedAt` workflow: unverified → verified via CLI command

**Part C: Language-Themed Visual Description Generation**
- [ ] Delete ALL existing vocab card visual descriptions (current ones are generic/bad)
- [x] New visual description system prompts PER LANGUAGE with cultural theming rules
- [x] Japanese: feudal Japan, torii gates, zen gardens, ukiyo-e palette, cherry blossoms
- [x] Spanish: Mediterranean/Latin American, terracotta, flamenco, warm sunset tones
- [x] French: Belle Époque, cobblestone cafés, lavender fields, romantic lighting
- [ ] (Additional languages follow same pattern — see GAME_DESIGN.md §22)
- [x] Anti-pattern detection: reject generic fantasy scenes with no cultural identity
- [x] Integration with existing `generate-visual-descriptions.mjs` pipeline
- [ ] Regenerate all 400 Japanese N3 vocab visual descriptions with Japan-themed prompts

**Part D: Documentation**
- [x] Document full pipeline so it can be run independently via Claude CLI
- [x] Example commands for each step (generate → validate → ingest → visual descriptions)
- [x] Quality checklist for reviewing generated content before approval

Depends on: None. Estimated: Large. **Can run in parallel with AR-08/09/10. CRITICAL PATH for content scaling.**
Implementation note: visual-description cleanup/regeneration tasks are tracked in a separate art/content workstream and intentionally not blocked by core pipeline engineering.
→ [Spec](phases/AR-11-CONTENT-PIPELINE.md)

---

### AR-12: Anonymous Auth & Cloud Save
**Enable progress persistence across devices.** Anonymous device ID on first launch, optional account creation to claim profile, cloud save via Fastify backend.

- [x] Anonymous device-based identity (UUID, stored locally)
- [x] Optional email/password account creation
- [x] Cloud save endpoints: push/pull player state (FSRS, run history, unlocks)
- [x] Conflict resolution: prefer higher-progress state
- [x] Guest-to-account migration
- [x] Login UI in Settings (minimal, non-blocking)
- [x] Auto-sync on run completion, graceful offline fallback

Depends on: AR-08 (Settings accessible). Estimated: Medium-Large. **Status: Completed (March 9, 2026).**
→ [Spec](completed/AR-12-AUTH-CLOUD-SAVE.md)

---

### AR-13: Launch Readiness (supersedes AR-07)
**Everything needed for Malaysia soft launch (web-first, Capacitor native later).**

- [x] Performance audit: 60fps combat, <3s cold start, <150MB memory
- [x] Full Playwright E2E test suite (hub, run flow, type selection, FSRS, combos, relics, save/load)
- [x] Dead code cleanup (archive mining-era code removed, no active social nav dead entries)
- [x] PWA configuration (manifest, service worker, offline, app icons)
- [x] Error tracking (Sentry or equivalent)
- [x] Share image generator verification
- [x] Responsive layout on common mobile screen sizes

Verification notes (March 10, 2026): `npm run typecheck` passes, `npm run build` succeeds, `npm test` passes (23/23 files). Dead-code cleanup completed by deleting `src/_archived-mining/` with no dangling imports.

Depends on: AR-08, AR-09. Estimated: Medium. **Status: Completed (March 10, 2026).**
→ [Spec](completed/AR-13-LAUNCH-READINESS.md)

---

### AR-14: Soft Launch & Analytics (Completed)
**Ship to limited market, measure everything, iterate.**

- [x] Instrument 10+ critical funnels (onboarding, runs, answers, domains, cash-out, deaths, tiers, bounties, streaks, shares)
- [x] A/B test experiments: Slow Reader default, 3 vs 4 AP, starter deck 15 vs 18
- [x] Malaysia geo-targeting or invite codes
- [x] In-app feedback button in Settings
- [x] Weekly analytics dashboard
- [x] Weekly analytics review checklist documented

Weekly runbook: `docs/roadmap/AR-14-WEEKLY-ANALYTICS-RUNBOOK.md`

Depends on: AR-12 (cloud save), AR-13 (deployed build). Estimated: Medium. **Status: Completed (March 9, 2026).**
→ [Spec](completed/AR-14-SOFT-LAUNCH-ANALYTICS.md)

---

### HOTFIX: Combat Improvements (Fact-Card Shuffling + Cooldown + Variants)
**Playtesting-driven fixes to card draw, fact repetition, and question variety.**

- [x] Fact-card shuffling: decouple facts from card slots, pair randomly each draw
- [x] Encounter cooldown: 3-encounter cooldown on answered facts
- [x] Variant expansion: knowledge facts minimum 4 variants (forward/reverse/negative/context/fill-blank/true-false)
- [x] Distractor quality validation hooks: pipeline flags answer/distractor collisions and risky wording (`qa/flag-content-risks.mjs`)
- [x] Vocab cards exempted from variant expansion (existing system preserved)

Priority: IMMEDIATE. Does not depend on any other phase. **Status: Completed (March 10, 2026).** See `docs/roadmap/AGENT-PROMPT-COMBAT-IMPROVEMENTS.md`.

---

## Post-Soft-Launch: Content at Scale

### AR-15: Content Source Registry & Wikidata Query Library (Completed)
**Document all commercially safe data sources and build automated SPARQL/API query scripts.** This is the foundation — everything else depends on knowing WHERE data comes from.

- [x] Create `docs/CONTENT_STRATEGY.md` with full source registry and licensing analysis
- [x] Write Wikidata SPARQL query scripts per knowledge domain (10 domains)
- [x] Test all queries and add verification report workflow
- [x] Create source config JSON files for the ingestion pipeline (`scripts/content-pipeline/sources.json`)
- [x] Document NASA, PubChem, GBIF, USDA, Met Museum, Art Institute API access
- [x] Verify JMdict/EDRDG commercial terms and document attribution requirements
- [x] Build API fetch scripts for non-SPARQL sources (REST endpoints)

Depends on: None. Estimated: Medium. **Status: Completed (March 9, 2026).**
→ [Spec](completed/AR-15-CONTENT-SOURCE-REGISTRY.md)

---

### AR-16: Knowledge Domain Expansion (Code Changes) (Completed)
**Add 6 new knowledge domains to the game codebase.** This is pure code — no content generation, no API keys.

- [x] Add new `FactDomain` values: `space_astronomy`, `mythology_folklore`, `animals_wildlife`, `human_body_health`, `food_cuisine`, `art_architecture`
- [x] Update `CATEGORIES` constant in `src/data/types.ts` to include all 10 knowledge domains + language
- [x] Add domain metadata (display name, color tint, icon, description) to domain config
- [x] Update biome-to-category affinities in `src/services/interestSpawner.ts` for new domains
- [x] Add domain-specific card art themes hooks (prompt/metadata integration)
- [x] Update domain selection UI in onboarding/settings flow
- [x] Update Knowledge Library filters and labels for new domains
- [x] Add domain icon mapping support for new categories
- [x] Update age/content domain mapping compatibility
- [x] Flags/maps/country-heavy source handling documented as advisory-threshold content in the source pipeline

Depends on: None. Estimated: Medium. **Status: Completed (March 9, 2026).**
→ [Spec](completed/AR-16-DOMAIN-EXPANSION.md)

---

### AR-17: Worker Fact Generation Engine
**Build the pipeline that transforms structured source data into game-ready Fact schema JSON through external Claude subscription workers.** This is the engine that makes content scaling possible.

- [x] Worker orchestration script with rate limiting metadata, retry reporting, and budget safeguards
- [x] Domain-specific system prompts (10 knowledge domains) — each guides worker output for questions, distractors, difficulty, funScore
- [x] Batch processor: reads source data JSON → worker output JSONL → Fact schema validation
- [x] Output validation: schema check, distractor quality check, difficulty distribution check
- [x] Distractor generation quality checks and schema-compatible normalization bridge
- [x] Question variant generator support (3–4 variants via prompt + normalization)
- [x] Cost estimation tool: preview cost before running a batch
- [x] `visualDescription` generation integrated into the same pipeline
- [x] `wowFactor` framing generation
- [x] Dry-run mode: generate sample facts per domain for review before full batch
- [x] Mixed-source input builder for worker runs (`content:source-mix`; outputs `data/raw/mixed/*.json`)

Depends on: AR-15 (needs source data). Estimated: Large.
Implementation status: **Tooling complete (March 10, 2026)**. Local paid API generation paths removed; live generation runs through external Claude subscription workers plus ingest/QA/promotion gates.
→ [Spec](phases/AR-17-HAIKU-FACT-ENGINE.md)

---

### AR-18: Vocabulary Expansion — 8 Languages
**Import and process vocabulary data for all 8 target languages from JMdict, CEFR frequency lists, and open lexical databases.**

- [x] JMdict full import tooling: supports JLPT N5–N1 file generation (`import-jmdict.mjs` + `build-seed-packs.mjs`)
- [x] CEFR vocabulary import scripts for: Spanish (A1–C2), French (A1–C2), German (A1–C2), Dutch (A1–C2), Czech (A1–C2)
- [x] Korean vocabulary pipeline scaffolding via Anki extraction + local deterministic enrichment (with Wikidata fallback path)
- [x] HSK vocabulary import for Mandarin Chinese (levels 1–6)
- [x] Per-language schema extensions (reading field, romanization, example sentences)
- [ ] Language-themed visual description generation using cultural themes from GAME_DESIGN.md §22
- [x] Anki deck word list extraction: parse .apkg files for Korean/Spanish/French/German/Dutch/Czech, extract target-language words only
- [x] Enrichment pipeline: normalize translations + CEFR/TOPIK levels from extracted word lists without paid API requirements
- [x] Tatoeba example sentence matching: link sentences to vocabulary entries
- [x] Difficulty mapping: JLPT/CEFR/HSK/TOPIK level → game difficulty (1–5)
- [x] Language selection UI updates (support 6 languages in onboarding + settings)
- [x] Audio placeholder system (TTS integration point for future)

Depends on: AR-15 (source registry), AR-11 Part C (visual description pipeline). Estimated: Large. No local paid API keys required for import scripts; visual-description generation runs through external worker sessions.
Implementation status: **Tooling and UI wiring in place (March 10, 2026)**. Full corpus generation/review remains pending. Visual-description generation for vocab packs remains in the separate art/content stream.
→ [Spec](phases/AR-18-VOCABULARY-EXPANSION.md)

---

### AR-19: Bulk Content Generation & Quality Assurance
**Execute the full pipeline: generate 10K+ facts per domain, verify quality, populate production database.**

- [x] Worker generation orchestration tooling across all 10 knowledge domains (`content:workers:prepare` + external worker outputs + `content:workers:ingest`)
- [x] Run vocabulary processing tooling for all 6 languages (`content:vocab:build` + `content:vocab:validate`)
- [x] Automated QA checks: schema validation, duplicate detection, distractor quality scoring (`content:qa`)
- [x] Domain coverage report: facts per domain × difficulty × age rating (`qa/coverage-report.mjs`)
- [x] Human review queue: prioritize Gold-tier sources, spot-check Silver, reject Bronze (`qa/review-sample.mjs`)
- [x] Flagging pipeline for ambiguous answers, controversial content, or stale data (`qa/flag-content-risks.mjs`)
- [x] Gameplay safety QA gate (`qa/gameplay-safety-check.mjs`) and strict post-ingestion gate (`qa/post-ingestion-gate.mjs`)
- [x] Promotion hard gate: `content:promote` now requires passing `post-ingestion-gate.json`
- [ ] Generate `visualDescription` for all new facts (domain-themed for knowledge, language-themed for vocab)
- [ ] Run ComfyUI card back generation for top-priority facts (sample batch per domain)
- [x] Final coverage audit gate tooling: minimum 10K facts per knowledge domain, 5K per language (`qa/coverage-gate.mjs`)
- [x] Production database migration tooling: approved facts → `public/facts.db` (`qa/promote-approved-to-db.mjs`)

Depends on: AR-15, AR-16, AR-17, AR-18 ALL complete. Estimated: Large. **No local paid API requirement for content scripts**; worker-generated outputs must pass QA before promotion.
Implementation status: post-generation QA/migration tooling is in place; worker-first generation plus visual/Comfy production runs are tracked separately.
→ [Spec](phases/AR-19-BULK-GENERATION-QA.md)

---

## Game Design Overhaul (March 2026)

Based on critical design review (`docs/RESEARCH/04_GAME_DESIGN_IMPROVEMENTS.md`).

### AR-22: Rename to Recall Rogue ✓

Global rename from "Arcane Recall" / "Terra Gacha" to "Recall Rogue" across 263 files — code, configs, docs, store assets, Capacitor, PWA manifest.

- [x] All "Arcane Recall" references → "Recall Rogue"
- [x] All "Terra Gacha" references → "Recall Rogue"
- [x] package.json, vite.config, index.html, iOS/Android configs
- [x] Store listings, sprite gen tools, prompt files
- [x] All documentation files

→ [Spec](completed/AR-22-RENAME.md)

---

### AR-23: Run Structure Overhaul ✓

Transformed from 3-floor quick runs to 24-floor STS-style dungeon with save/resume and campfire pause.

- [x] 24-floor dungeon (4 segments of 6 floors: Shallow Depths, Deep Caverns, The Abyss, The Archive)
- [x] 2 regular encounters + 1 mini-boss per floor, full boss every 3rd floor
- [x] 8 total bosses (3 existing + 5 new: Crystal Warden, Shadow Hydra, Void Weaver, Knowledge Golem, The Curator)
- [x] 6 mini-boss templates (Crystal Guardian, Venomfang, Stone Sentinel, Ember Drake, Shade Stalker, Bone Collector)
- [x] Room selection between encounters 1 and 2 only; encounter 3 is auto mini-boss/boss
- [x] Save/resume system — auto-save at checkpoints, resume on app reopen
- [x] Campfire pause screen with run stats, resume, and return-to-hub
- [x] Limited hub access during paused run (Library view-only, Settings, no cosmetics)
- [x] Special events after boss floors (Relic Forge, Card Transform, Deck Thin, Knowledge Spring, Mystery)
- [x] Retreat-or-delve checkpoints every 3 floors (after boss fights)
- [x] Death penalties: 80%/65%/50%/35% by segment
- [x] Ascension mode designed (20 levels, documented in GAME_DESIGN.md, build deferred)
- [x] Enemy HP reduced 15% across all existing enemies

→ [Spec](completed/AR-23-RUN-STRUCTURE-OVERHAUL.md)

---

### AR-24: Launch Balance & UX Pass ✓

Combined balance and UX improvements from critical design review.

- [x] Mechanic phase gating: 18 mechanics at launch (phase 1), 13 deferred (phase 2), feature flag
- [x] Difficulty mode rename: Explorer → Story Mode, Standard → Timed Mode, Scholar → Expert Mode
- [x] Story Mode forced for runs 1-3 (no timer, 100% rewards)
- [x] Explorer reward multiplier: 70% → 100%; Scholar: 150% → 120%
- [x] "Do you prefer more time to read?" onboarding question removed (Slow Reader in Settings)
- [x] Tier display simplification: 3 visible tiers (Learning/Proven/Mastered), 4 internal preserved
- [x] wowFactor display on correct Tier 1 answers (max 3/encounter, during animation)
- [x] Domain selection: "What are you curious about?" emotional framing
- [x] Language domains hidden from picker (feature flag)
- [x] Archetype selection hidden for runs 1-3, auto-balanced, unlocks run 4
- [x] App Store review prompt service (3 triggers: boss kill, tier-up, 7-day streak; 90-day cooldown)

→ [Spec](completed/AR-24-LAUNCH-BALANCE-UX.md)

---

### AR-25: Push Notifications ✓

Local push notifications for mobile retention via Capacitor.

- [x] 4 notification types: streak risk, milestone proximity, facts due, win-back
- [x] Max 1 notification per day, quiet hours (10pm-8am)
- [x] Priority scheduling: streak > milestone > review > win-back
- [x] Settings UI with per-type toggles
- [x] Permission requested after first completed run
- [x] Web fallback: silent no-op

→ [Spec](completed/AR-25-PUSH-NOTIFICATIONS.md)

---

### AR-26: Game Design Doc Overhaul ✓

Updated GAME_DESIGN.md, ARCHITECTURE.md, and PROGRESS.md to reflect all AR-22→25 changes plus ascension mode design.

- [x] All doc references updated from "Arcane Recall" to "Recall Rogue"
- [x] Run structure: 24-floor dungeon fully documented
- [x] Save/resume, campfire pause, special events documented
- [x] Ascension mode (20 levels) designed and documented
- [x] Balance changes reflected (HP, mechanics, modes, tiers, rewards)
- [x] Push notifications section added
- [x] PROGRESS.md updated with AR-22→26

→ [Spec](completed/AR-26-DOC-OVERHAUL.md)

---

## Post-Content: Social & Monetization

### AR-20: Competitive & Social Features
- [x] Daily Expedition (fixed seed, one attempt/day, leaderboard) — deterministic seeded run mode + one-attempt/day lock + local reward-band ranking + backend category (`daily_expedition`) with date-key filtered global leaderboard and one-submission-per-day enforcement
- [x] Endless Depths (infinite scaling after Floor 9, separate leaderboard) — playable start-at-floor-10 mode + separate local leaderboard + endless enemy-scaling balance pass + backend category (`endless_depths`) wired from run completion submissions
- [x] Mastery Challenges (rare Mystery room, 3s timer, 5 distractors, fail = Tier 2b) — mystery-room challenge roll + challenge overlay + fail demotion flow implemented (local)
- [x] Relic Sanctum (between-run relic management for >12 mastered) — Social entry + 12-slot active relic loadout management implemented (local)
- [x] Wire up existing Co-op, Duel, Guild components (already built, need backend + matchmaking) — backend route registration enabled; duel/guild/social clients aligned to live route contracts

→ [Spec](completed/AR-20-COMPETITIVE-SOCIAL.md)

### AR-21: Monetization Activation
- [x] Ad removal IAP ($4.99)
- [x] Arcane Pass subscription ($4.99/mo — all packs, cosmetics, analytics, family 5x)
- [x] Cosmetic store (card backs, frames, dungeon skins, avatars)
- [x] Scholar Challenges (weekly curated runs + leaderboards)
- [x] Subscriber category filtering (Arcane Pass): fine-grained sub-category toggles per domain (e.g., WW2 only in History)

Depends on: AR-20 (social surfaces available). Estimated: Medium. **Status: Completed (March 10, 2026).**
→ [Spec](completed/AR-21-MONETIZATION-ACTIVATION.md)

### AR-27: Card Tier-Up Celebration Animations
**Visual reward feedback when cards level up during a run.** Short, satisfying animations play when a correct answer causes a card to advance tiers — blue (→Recall), green (→Deep Recall), purple/gold (→Mastered). Makes each correct answer feel like visible progress. Per-fact unique mastery animations generated as art assets in a later phase.

- [x] Detect tier-up after correct answer (compare tier before/after FSRS update)
- [x] Blue glow + rumble animation for Tier 1 → 2a transition
- [x] Green glow + sparkle animation for Tier 2a → 2b transition
- [x] Purple/gold glow animation for Tier 2b → 3 transition (integrates with Mastery Trial ceremony)
- [x] Insert ~600ms celebration phase into answer animation sequence (between reveal and mechanic)
- [x] Generic gold burst placeholder for per-fact mastery animation
- [x] Per-fact unique mastery animations (deterministic per-fact visual signatures in tier-up overlays)

Depends on: None (combat system is stable). Estimated: Medium. **Status: Completed (March 10, 2026).**
→ [Spec](completed/AR-27-TIER-UP-CELEBRATIONS.md)

### AR-28: Reward Altar (Loot Presentation Overhaul)
**Replace post-encounter reward buttons with an atmospheric altar scene.** Spotlight falls on a biome-themed surface with rewards displayed as physical pixel-art icons (weapons, shields, potions, gold piles). Tap to inspect, select one to collect. Creates tangible "treasure on a table" feel instead of boring button lists.

- [x] Altar scene component: spotlight cone, surface background, cloth overlay
- [x] 4-5 biome-themed altar surface variants (cave stone, library wood, forest moss, temple marble, obsidian vault)
- [x] Reward icon set: 30+ in-client icon variants across reward/card types (art-generated pixel sprite pass deferred)
- [x] Idle icon animations (bob, shimmer, glow pulse)
- [x] Tap-to-inspect: icon lifts, spotlight focuses, stats tooltip appears
- [x] Select flow: chosen reward flies to deck/inventory, others fade to shadow
- [x] Integration with existing card-type-selection reward system (AR-09)
- [x] SFX pass: altar intro cue, icon hover, selection collect cue

Depends on: AR-09 (card type selection system — already complete). Estimated: Medium-Large. **Status: Core implementation completed (March 10, 2026); handcrafted icon art pass can follow in content/art stream.**
→ [Spec](completed/AR-28-REWARD-ALTAR.md)

### AR-29: First-Person Dungeon Crawl
**Shift combat and room exploration to first-person perspective.** Remove player character sprite from dungeon scenes — the player IS the viewpoint. Enemies and bosses rendered large and menacing, staring directly at you. Room entry fade-in transitions for atmosphere. Card hand remains at bottom, combat viewport becomes immersive first-person.

- [x] Remove player character sprite from combat/room scenes
- [x] Redesign combat viewport: first-person perspective with enemy filling upper screen
- [x] Upscale enemy/boss sprites or generate larger first-person variants
- [x] Room entry fade-in effect (fade from black or door-opening animation)
- [x] First-person hallway view for door/room selection (2-3 doorways perspective)
- [x] Adjust hit/damage animations for first-person framing (screen shake, flash)
- [x] Boss encounters: even larger sprites, dramatic zoom-in on entry

Depends on: None. Estimated: Medium-Large. **Status: Core implementation completed (March 10, 2026).**
→ [Spec](completed/AR-29-FIRST-PERSON-DUNGEON-CRAWL.md)

### AR-30: Camp Cosmetics & Visual Progression
**Between-runs hub becomes a visual camp scene near the dungeon entrance.** Players spend gold on purely cosmetic upgrades — tent, seating, campfire, character outfit, pet companion, decorations. Each camp element is a location-aware sprite slot; upgrades swap sprite variants. Gives gold a meaningful non-gameplay sink and creates "home base" attachment.

- [x] Camp scene layout: campfire, tent, bench, dungeon entrance backdrop, character sitting
- [x] Menu integration: tap camp objects to navigate (tent=inventory, campfire=start run, signpost=settings)
- [x] Upgrade tier system: 4 visual tiers per camp element (tent, seating, fire, decorations)
- [x] Character cosmetic variants (outfit/armor appearance)
- [x] Pet companion system: unlock and display pets at camp (cat, owl, fox, dragon whelp)
- [x] Gold-to-upgrade shop UI: preview upgrade → spend gold → sprite swap
- [x] Boss trophy display: defeated bosses leave trophies/banners at camp
- [x] Sprite generation pipeline: location-aware camp element variants via AI image gen
- [x] Camp state persistence (save/load upgrade levels)

Depends on: AR-08 (hub — complete). Estimated: Large. **Status: Completed (March 10, 2026).**
→ [Spec](completed/AR-30-CAMP-COSMETICS-VISUAL-PROGRESSION.md)

---

## Dependency Graph

```
COMPLETED:
  AR-01 ──┬── AR-02 ──┬── AR-04 ✓ ── AR-05 ✓ ── AR-06 ✓
          └── AR-03 ──┘

PRE-LAUNCH (parallel tracks):
  Track A: AR-08 ✓ (Hub) → AR-09 ✓ (Deck Building) ──→ AR-13 (Launch) → AR-14 (Soft Launch)
  Track B: AR-11 (Content Pipeline) ─────────────┘        ↑
  Track C: AR-10 ✓ (Calibration) ────────────────────────┘
  Track D: AR-12 ✓ (Auth) ───────────────────────────────→ AR-14

CONTENT AT SCALE (parallel where possible):
  AR-15 ✓ (Sources) ──┬── AR-17 (Worker Engine) ──→ AR-19 (Bulk Gen & QA)
  AR-16 ✓ (Domains) ──┘                                ↑
  AR-18 (Vocab) ─────────────────────────────────────┘

GAME DESIGN OVERHAUL (March 2026):
  AR-22 (Rename) → AR-23 (Run Structure) + AR-24 (Balance/UX) + AR-25 (Notifications) → AR-26 (Docs)

FUTURE:
  AR-19 → AR-20 ✓ (Social) / AR-21 ✓ (Monetization)
  AR-27 (Tier-Up Animations) — independent, can run anytime
  AR-28 (Reward Altar) — core complete, optional icon art pass can run anytime
  AR-29 (First-Person Crawl) — core complete
  AR-30 (Camp Cosmetics) — core complete, sprite-generation pipeline pending
```

**Parallelism:** AR-15 and AR-16 are complete. AR-17 depends on AR-15 source outputs. AR-18 depends on AR-15 source registry. AR-19 depends on AR-17 and AR-18 completion plus QA gate passage. AR-17 and AR-19 now run through worker-first generation + ingest/QA/promote scripts. AR-22→26 game design overhaul is complete (March 2026).

---

## Built But Not Yet Surfaced

These features exist as implemented Svelte components / services but are currently unreachable from the main app flow. AR-08 surfaces the core set; AR-16 surfaces the social/competitive set.

| Feature | Component(s) | Status | Surfaced In |
|---------|-------------|--------|-------------|
| Knowledge Library | KnowledgeLibrary.svelte | Built ✓ | AR-08 |
| Settings | Settings components | Built ✓ | AR-08 |
| Parental Controls | ParentalControls.svelte | Built ✓ | AR-08 |
| Profile | Profile components | Built ✓ | AR-08 |
| Streak Display | StreakTracker.ts | Built ✓ | AR-08 |
| Post-Run Summary | RunEnd components | Built ✓ | AR-08 |
| Analytics Service | analyticsService.ts | Built ✓ | AR-14 |
| A/B Testing | experiments.ts, featureFlagService.ts | Built ✓ | AR-14 |
| Leaderboards | Leaderboard components | Built ✓ | AR-20 |
| Co-op Lobby | CoopLobby.svelte | Built ✓ | AR-20 |
| Guild View | GuildView.svelte | Built ✓ | AR-20 |
| Duel View | DuelView.svelte | Built ✓ | AR-20 |
| Season Pass | SeasonPassView.svelte | Built ✓ | AR-21 |
| IAP Service | iapService.ts | Built ✓ | AR-21 |
| Daily Deals | dailyDeals.ts | Built ✓ | AR-21 |
| Gacha System | GachaReveal.svelte | Built ✓ | AR-21 |
| Campfire Pause | CampfirePause.svelte | Built ✓ | AR-23 |
| Special Events | SpecialEventOverlay.svelte | Built ✓ | AR-23 |
| Push Notifications | notificationService.ts | Built ✓ | AR-25 |

---

## Deferred Go-Live (Moved To Back)

These tasks were intentionally moved to the end so the team can finish non-live implementation work first.

- [ ] AR-13: Web deployment (Vercel/Netlify)
- [ ] AR-13: Capacitor native builds (Android + iOS)
- [ ] AR-14: Deploy web build to public URL
- [ ] AR-14: Fix top 5 issues from first-week live data
