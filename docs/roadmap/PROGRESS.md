# Arcane Recall — Implementation Roadmap

> Design source of truth: `docs/GAME_DESIGN.md`
> Card roguelite spec: `docs/RESEARCH/02_terra-miner-card-roguelite-spec.md`

---

## Current Status

**Playable pre-launch build.** AR-01 through AR-06 complete. Core combat, FSRS, visual assets, onboarding, sound/engagement, and knowledge library all implemented.

**AR-08 complete:** Hub navigation now ships as the default app entry. Knowledge Library, Settings + Parental Controls, Profile, Journal, and Leaderboards are now reachable from the home hub and persistent bottom nav.

**Calibration decision RESOLVED.** Option B (accelerated FSRS gains during early runs) selected. See GAME_DESIGN.md §14. No longer blocked.

**Deck building redesigned.** Card rewards now use type-selection (player picks card TYPE, random fact assigned). Archetype selection at run start. See GAME_DESIGN.md §7. AR-09 implements this.

**Next up:** AR-09 (Strategic Deck Building) → AR-10 (Calibration) can run in parallel with AR-11 (Content Pipeline). Then AR-12 (Auth) → AR-13 (Launch Readiness) → AR-14 (Soft Launch).

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

---

## In Progress

### AR-04: Onboarding + Difficulty Modes (3/4 done)

- [x] **60-second onboarding** — Dungeon entrance, Slow Reader question, first encounter with 2 AP, contextual tooltips. Domain selection unlocks on Run 2.
- [x] **Difficulty modes** — Explorer (no timer, wrong=50% effect, enemies -30%), Standard (current), Scholar (-2s/tier, wrong=fizzle+3 self-damage, enemies +20%).
- [ ] **Calibration system** — Design RESOLVED (Option B: accelerated FSRS). Implementation deferred to AR-10.
- [x] **Hint system** — 1 Scholar's Insight per encounter: remove 1 wrong answer, +5s timer, or reveal first letter.

→ [Spec](phases/AR-04-ONBOARDING.md)

### AR-07: Launch Readiness (2/6 done — being superseded by AR-13)

- [ ] ~~Capacitor build verification~~ → moved to AR-13
- [x] **Accessibility baseline** — Colorblind support, 3 text sizes, high contrast, reduce motion, 48dp+ touch targets.
- [ ] ~~Playwright E2E test suite~~ → expanded in AR-13
- [ ] ~~Performance audit~~ → moved to AR-13
- [ ] ~~Dead code cleanup~~ → moved to AR-13
- [x] **App store metadata** — Screenshots, description, privacy policy, age rating.

Note: AR-07 is being superseded by AR-13 which has a broader scope including web deployment, PWA, and the new deck building/hub features that must be tested. The completed items (accessibility, metadata) stand.

→ [Spec](phases/AR-07-LAUNCH-READINESS.md)

---

## Next Phases (Pre-Launch)

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
→ [Spec](phases/AR-08-HUB-NAVIGATION.md)

---

### AR-09: Strategic Deck Building (Card Type Selection)
**Replace random card rewards with type-selection for strategic deck building.** Players choose card TYPE after encounters (Attack/Shield/Heal/etc.), random fact assigned. Starter deck reduced to 15. Archetype selection at run start weights type options.

- [ ] Card reward screen redesign: 3 TYPE options instead of 3 random cards
- [ ] Type-to-fact random assignment on selection
- [ ] Starter deck reduced from 20 to 15 cards
- [ ] Archetype selection UI at run start (Balanced/Aggressive/Defensive/Control/Hybrid)
- [ ] Archetype weighting logic for reward type options
- [ ] Card selling/removal at shop rooms
- [ ] Balance pass: starter deck composition, type distribution

Depends on: None. Estimated: Medium.
→ [Spec](phases/AR-09-STRATEGIC-DECK-BUILDING.md)

---

### AR-10: Calibration & Cold Start Resolution
**Implement accelerated FSRS gains during early runs (Option B).** Finishes the last item from AR-04.

- [ ] Early run boost: correct + fast (under 50% timer) = 2x stability gain during runs 1-3
- [ ] Run accuracy bonus: 80%+ = flat +2d stability to all correct facts
- [ ] First-time correct starts at 2d stability instead of 1d
- [ ] Domain-specific acceleration on first selection of new domain
- [ ] RunPoolBuilder probe mode: diverse-difficulty front-loading in first run per domain
- [ ] Runs-per-domain tracking in player profile

Depends on: AR-02 (done). Estimated: Small-Medium.
→ [Spec](phases/AR-10-CALIBRATION-COLD-START.md)

---

### AR-11: Content Pipeline Infrastructure (Claude CLI + Ingestion + Visual Descriptions)
**Build the full content production pipeline: Claude CLI fact generation → validation → ingestion → language-themed visual description generation → card back art.** This is the engine that scales from 122 facts to 10K+ per domain.

**Part A: Claude CLI Fact Generation Setup**
- [ ] System prompts for fact generation per domain (Science, History, Geography, etc.)
- [ ] System prompts for vocabulary generation per language (Japanese, Spanish, French, etc.)
- [ ] Source citation requirement: every fact MUST have a `sourceName` (Wikipedia preferred)
- [ ] Fact-checking validation: cross-reference generated facts against source
- [ ] Output format: JSON matching seed data schema (all columns populated)
- [ ] Distractor generation: 5+ plausible distractors per fact, close enough to challenge
- [ ] Question variant generation: 3-4 variants per fact (forward, reverse, fill-blank, true/false)

**Part B: Ingestion & Validation**
- [ ] CLI tool for bulk fact ingestion from JSON
- [ ] Schema validation (all required fields, variant count ≥ 2, distractor count ≥ 2)
- [ ] Duplicate detection (fuzzy match on question text)
- [ ] Domain coverage report (facts per domain, per difficulty, age rating distribution)
- [ ] Distractor quality flagging (too easy / too similar to correct answer)
- [ ] Migration to sql.js database (public/facts.db + seed-pack.json)
- [ ] `verifiedAt` workflow: unverified → verified via CLI command

**Part C: Language-Themed Visual Description Generation**
- [ ] Delete ALL existing vocab card visual descriptions (current ones are generic/bad)
- [ ] New visual description system prompts PER LANGUAGE with cultural theming rules
- [ ] Japanese: feudal Japan, torii gates, zen gardens, ukiyo-e palette, cherry blossoms
- [ ] Spanish: Mediterranean/Latin American, terracotta, flamenco, warm sunset tones
- [ ] French: Belle Époque, cobblestone cafés, lavender fields, romantic lighting
- [ ] (Additional languages follow same pattern — see GAME_DESIGN.md §22)
- [ ] Anti-pattern detection: reject generic fantasy scenes with no cultural identity
- [ ] Integration with existing `generate-visual-descriptions.mjs` pipeline
- [ ] Regenerate all 400 Japanese N3 vocab visual descriptions with Japan-themed prompts

**Part D: Documentation**
- [ ] Document full pipeline so it can be run independently via Claude CLI
- [ ] Example commands for each step (generate → validate → ingest → visual descriptions)
- [ ] Quality checklist for reviewing generated content before approval

Depends on: None. Estimated: Large. **Can run in parallel with AR-08/09/10. CRITICAL PATH for content scaling.**
→ [Spec](phases/AR-11-CONTENT-PIPELINE.md)

---

### AR-12: Anonymous Auth & Cloud Save
**Enable progress persistence across devices.** Anonymous device ID on first launch, optional account creation to claim profile, cloud save via Fastify backend.

- [ ] Anonymous device-based identity (UUID, stored locally)
- [ ] Optional email/password account creation
- [ ] Cloud save endpoints: push/pull player state (FSRS, run history, unlocks)
- [ ] Conflict resolution: prefer higher-progress state
- [ ] Guest-to-account migration
- [ ] Login UI in Settings (minimal, non-blocking)
- [ ] Auto-sync on run completion, graceful offline fallback

Depends on: AR-08 (Settings accessible). Estimated: Medium-Large.
→ [Spec](phases/AR-12-AUTH-CLOUD-SAVE.md)

---

### AR-13: Launch Readiness (supersedes AR-07)
**Everything needed for Malaysia soft launch (web-first, Capacitor native later).**

- [ ] Performance audit: 60fps combat, <3s cold start, <150MB memory
- [ ] Full Playwright E2E test suite (hub, run flow, type selection, FSRS, combos, relics, save/load)
- [ ] Dead code cleanup (archive mining-era code, remove unused social nav entries)
- [ ] PWA configuration (manifest, service worker, offline, app icons)
- [ ] Web deployment (Vercel/Netlify)
- [ ] Error tracking (Sentry or equivalent)
- [ ] Share image generator verification
- [ ] Responsive layout on common mobile screen sizes
- [ ] Capacitor native builds (Android + iOS) — stretch goal

Depends on: AR-08, AR-09. Estimated: Medium.
→ [Spec](phases/AR-13-LAUNCH-READINESS.md)

---

### AR-14: Soft Launch & Analytics
**Ship to limited market, measure everything, iterate.**

- [ ] Deploy web build to public URL
- [ ] Instrument 10+ critical funnels (onboarding, runs, answers, domains, cash-out, deaths, tiers, bounties, streaks, shares)
- [ ] A/B test experiments: Slow Reader default, 3 vs 4 AP, starter deck 15 vs 18
- [ ] Malaysia geo-targeting or invite codes
- [ ] In-app feedback button in Settings
- [ ] Weekly analytics dashboard
- [ ] Fix top 5 issues from first-week data

Depends on: AR-12 (cloud save), AR-13 (deployed build). Estimated: Medium.
→ [Spec](phases/AR-14-SOFT-LAUNCH-ANALYTICS.md)

---

## Post-Soft-Launch: Content at Scale

### AR-15: Content Source Registry & Wikidata Query Library
**Document all commercially safe data sources and build automated SPARQL/API query scripts.** This is the foundation — everything else depends on knowing WHERE data comes from.

- [ ] Create `docs/CONTENT_STRATEGY.md` with full source registry and licensing analysis
- [ ] Write Wikidata SPARQL query scripts per knowledge domain (10 domains)
- [ ] Test all queries — each must return 1,000+ structured results
- [ ] Create source config JSON files for the ingestion pipeline (one per source)
- [ ] Document NASA, PubChem, GBIF, USDA, Met Museum, Art Institute API access
- [ ] Verify JMdict/EDRDG commercial license terms and document attribution requirements
- [ ] Build API fetch scripts for non-SPARQL sources (REST endpoints)

Depends on: None — can start immediately. Estimated: Medium. No API keys required.
→ [Spec](phases/AR-15-CONTENT-SOURCE-REGISTRY.md)

---

### AR-16: Knowledge Domain Expansion (Code Changes)
**Add 6 new knowledge domains to the game codebase.** This is pure code — no content generation, no API keys.

- [ ] Add new `FactDomain` values: `space_astronomy`, `mythology_folklore`, `animals_wildlife`, `human_body_health`, `food_cuisine`, `art_architecture`
- [ ] Update `CATEGORIES` constant in `src/data/types.ts` to include all 10 knowledge domains
- [ ] Add domain metadata (display name, color tint, icon, description) to domain config
- [ ] Update biome-to-category affinities in `src/services/interestSpawner.ts` for new domains
- [ ] Add domain-specific card art themes (visual description style guides per domain)
- [ ] Update domain selection UI in onboarding and settings
- [ ] Update Knowledge Library filters for new domains
- [ ] Add domain icons/sprites for new categories
- [ ] Update age rating logic — ensure each new domain has appropriate content flags

Depends on: None — can start immediately. Estimated: Medium. No API keys required.
→ [Spec](phases/AR-16-DOMAIN-EXPANSION.md)

---

### AR-17: Haiku Fact Generation Engine
**Build the pipeline that transforms structured source data into game-ready Fact schema JSON using Claude Haiku API.** This is the engine that makes content scaling possible.

- [ ] Haiku API integration script with rate limiting, retry logic, cost tracking
- [ ] Domain-specific system prompts (10 knowledge domains) — each guides Haiku to generate appropriate questions, distractors, difficulty, funScore
- [ ] Batch processor: reads source data JSON → calls Haiku → outputs Fact schema JSON
- [ ] Output validation: schema check, distractor quality check, difficulty distribution check
- [ ] Distractor generation quality: ensure distractors are plausible but unambiguously wrong
- [ ] Question variant generator: 3–4 variants per fact (forward/reverse/fill-blank/true-false)
- [ ] Cost estimation tool: preview cost before running a batch
- [ ] `visualDescription` generation integrated into the same pipeline
- [ ] `wowFactor` framing generation
- [ ] Dry-run mode: generate 10 sample facts per domain for review before full batch

Depends on: AR-15 (needs source data). Estimated: Large. **REQUIRES Anthropic API key (Haiku model).**
→ [Spec](phases/AR-17-HAIKU-FACT-ENGINE.md)

---

### AR-18: Vocabulary Expansion — 6 Languages
**Import and process vocabulary data for all 6 target languages from JMdict, CEFR frequency lists, and open lexical databases.**

- [ ] JMdict full import: complete JLPT N5–N1 vocabulary (currently only N3 exists)
- [ ] CEFR vocabulary import scripts for: Spanish (A1–C2), French (A1–C2), German (A1–C2)
- [ ] TOPIK vocabulary import for Korean (levels 1–6)
- [ ] HSK vocabulary import for Mandarin Chinese (levels 1–6)
- [ ] Per-language schema extensions (reading field, romanization, example sentences)
- [ ] Language-themed visual description generation using cultural themes from GAME_DESIGN.md §22
- [ ] Tatoeba example sentence matching: link sentences to vocabulary entries
- [ ] Difficulty mapping: JLPT/CEFR/HSK/TOPIK level → game difficulty (1–5)
- [ ] Language selection UI updates (support 6 languages in onboarding + settings)
- [ ] Audio placeholder system (TTS integration point for future)

Depends on: AR-15 (source registry), AR-11 Part C (visual description pipeline). Estimated: Large. No API keys required for import scripts; Haiku API needed for visual descriptions.
→ [Spec](phases/AR-18-VOCABULARY-EXPANSION.md)

---

### AR-19: Bulk Content Generation & Quality Assurance
**Execute the full pipeline: generate 10K+ facts per domain, verify quality, populate production database.**

- [ ] Run Haiku generation across all 10 knowledge domains
- [ ] Run vocabulary processing for all 6 languages
- [ ] Automated QA checks: schema validation, duplicate detection, distractor quality scoring
- [ ] Domain coverage report: facts per domain × difficulty × age rating
- [ ] Human review queue: prioritize Gold-tier sources, spot-check Silver, reject Bronze
- [ ] Flag and fix facts with ambiguous answers, controversial content, or stale data
- [ ] Generate `visualDescription` for all new facts (domain-themed for knowledge, language-themed for vocab)
- [ ] Run ComfyUI card back generation for top-priority facts (sample batch per domain)
- [ ] Final coverage audit: minimum 10K facts per knowledge domain, 5K per language
- [ ] Production database migration: approved facts → `public/facts.db`

Depends on: AR-15, AR-16, AR-17, AR-18 ALL complete. Estimated: Large. **REQUIRES Anthropic API key (Haiku model).**
→ [Spec](phases/AR-19-BULK-GENERATION-QA.md)

---

## Post-Content: Social & Monetization (Future)

### AR-20: Competitive & Social Features
- [ ] Daily Expedition (fixed seed, one attempt/day, leaderboard)
- [ ] Endless Depths (infinite scaling after Floor 9, separate leaderboard)
- [ ] Mastery Challenges (rare Mystery room, 3s timer, 5 distractors, fail = Tier 2b)
- [ ] Relic Sanctum (between-run relic management for >12 mastered)
- [ ] Wire up existing Co-op, Duel, Guild components (already built, need backend + matchmaking)

### AR-21: Monetization Activation
- [ ] Ad removal IAP ($4.99)
- [ ] Arcane Pass subscription ($4.99/mo — all packs, cosmetics, analytics, family 5x)
- [ ] Cosmetic store (card backs, frames, dungeon skins, avatars)
- [ ] Scholar Challenges (weekly curated runs + leaderboards)

---

## Dependency Graph

```
COMPLETED:
  AR-01 ──┬── AR-02 ──┬── AR-04 (3/4) ── AR-05 ✓ ── AR-06 ✓
          └── AR-03 ──┘

PRE-LAUNCH (parallel tracks):
  Track A: AR-08 ✓ (Hub) → AR-09 (Deck Building) ──→ AR-13 (Launch) → AR-14 (Soft Launch)
  Track B: AR-11 (Content Pipeline) ─────────────┘        ↑
  Track C: AR-10 (Calibration) ──────────────────────────┘
  Track D: AR-12 (Auth) ─────────────────────────────────→ AR-14

CONTENT AT SCALE (parallel where possible):
  AR-15 (Sources) ──┬── AR-17 (Haiku Engine) ──→ AR-19 (Bulk Gen & QA)
  AR-16 (Domains) ──┘                                ↑
  AR-18 (Vocab) ─────────────────────────────────────┘

FUTURE:
  AR-19 → AR-20 (Social) / AR-21 (Monetization)
```

**Parallelism:** AR-15 and AR-16 have NO dependencies and can start immediately in parallel. AR-17 needs AR-15 (source data to feed into Haiku). AR-18 needs AR-15. AR-19 needs everything. AR-15 and AR-16 do NOT require API keys. AR-17 and AR-19 REQUIRE Anthropic API key (Haiku model).

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
