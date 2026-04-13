# Recall Rogue Documentation Index

> Navigation hub for all modular documentation. Each file is independently useful —
> an agent reading just that file should understand that system.
>
> **Last rebuilt:** 2026-04-13

---

## Architecture

| Doc | Summary |
|-----|---------|
| [overview](architecture/overview.md) | 3-layer stack (Svelte UI / Phaser canvas / services), boot sequence, and Svelte–Phaser communication pattern |
| [data-flow](architecture/data-flow.md) | End-to-end data flows for card play, quiz grading, and reward generation |
| [scenes](architecture/scenes.md) | Phaser scenes (Boot, Combat, RewardRoom), lifecycle, and scene transitions |
| [systems](architecture/systems.md) | 10 game systems: tick, impact, particles, enemy sprites, weapon anims, lighting, atmosphere, screen shake |
| [stores](architecture/stores.md) | Core Svelte stores, singleton pattern, state ownership, and initialization order |
| [stores-gameplay](architecture/stores-gameplay.md) | Combat, co-op, and camp gameplay state stores with full interface details |
| [services/index](architecture/services/index.md) | Lookup table mapping every service file to its domain sub-doc |
| [event-bus](architecture/EVENT-BUS-REFERENCE.md) | Typed event contract and event bus reference |
| [save-format](architecture/SAVE-FORMAT.md) | Save/load persistence schema and format |
| [multiplayer](architecture/multiplayer.md) | Coop shared-enemy architecture, host-authoritative reconciliation, delta merge flow, message types |

---

## Mechanics

| Doc | Summary |
|-----|---------|
| [combat](mechanics/combat.md) | Turn-based combat loop, AP system, damage pipeline, turn phases, and play modes |
| [cards](mechanics/cards.md) | Card entity interface, types, tiers, mastery system, and damage formula |
| [card-mechanics](mechanics/card-mechanics.md) | Complete table of all 50+ card mechanics — attack, shield, buff, debuff, utility, wild |
| [chains](mechanics/chains.md) | Knowledge Chain system — consecutive correct answers, multiplier scaling, chain types, and break conditions |
| [enemies](mechanics/enemies.md) | Full enemy roster, categories, HP/damage scaling formulas, special behaviors, and encounter selection |
| [relics](mechanics/relics.md) | Relic catalog, rarities, trigger system, slot rules, and acquisition mechanics |
| [status-effects](mechanics/status-effects.md) | All status effects, stacking rules, tick timing, and application behavior |
| [quiz](mechanics/quiz.md) | Quiz question lifecycle, fact selection, FSRS spaced repetition scheduling, answer grading, typing mode, chess move response mode (`chess_tactic`/`chess_move`), and chess Elo system |
| [progression](mechanics/progression.md) | Run lifecycle, floor/room generation, map layout, room types, ascension system, and shop mechanics |
| [narrative](mechanics/narrative.md) | Woven Narrative Architecture: 4 concurrent threads (Descent/Echo/Seeker/Inhabitants), archetypes, domain lenses, fact-reactive echo system, NPC dialogue, gravity scoring |
| [procedural-math](mechanics/procedural-math.md) | Runtime math problem generation: skill nodes, 6 generators, algorithmic distractors, FSRS skill tracking, Anki-model selection, tier-based difficulty scaling |
| [multiplayer](mechanics/multiplayer.md) | 5 multiplayer modes (Race, Same Cards, Duel, Co-op, Trivia Night), co-op enemy scaling, 6 co-op effects, ELO system, lobby browser UX, hosting options |

---

## Multiplayer

| Doc | Summary |
|-----|---------|
| [AR-MULTIPLAYER](roadmap/AR-MULTIPLAYER.md) | Master tracking doc: 4 phases, 7 modes, co-op scaling, networking architecture, implementation status |
| [multiplayer architecture](architecture/multiplayer.md) | Coop shared-enemy flow, host-authoritative HP, delta reconciliation, message types, three-backend lobby architecture, backend selection, lobby visibility tri-state |

---

## UI

| Doc | Summary |
|-----|---------|
| [components](ui/components.md) | Gameplay Svelte components: combat, quiz, hub, dungeon, cards, rooms, rewards, relics |
| [components-social](ui/components-social.md) | Non-gameplay components: social, auth, monetization, onboarding, and utility |
| [screens](ui/screens.md) | Complete Screen value union, routing logic, transition rules, and component mappings |
| [layout](ui/layout.md) | CSS custom property scaling system (`--layout-scale`, `--text-scale`), viewport detection, and Phaser canvas sizing |
| [animations](ui/animations.md) | Three animation layers (CSS transitions, Web Animations API, Phaser tweens) and when to use each |

---

## Immersion Overhaul (Temporary)

> **DELETE THIS SECTION** after all specs are implemented and main docs updated. (8/9 complete — only 04 Floor Descent UI pending)

| Doc | Summary |
|-----|---------|
| [immersion/INDEX](immersion/INDEX.md) | Navigation hub for 9 dungeon immersion specs — turn breathing, enemy entrance, chain escalation, floor descent, knowledge-reactive feedback, weapon sync, foreground parallax, background micro-animation, dynamic mood |
| [immersion/00-current-state](immersion/00-current-state.md) | Audit of all 15 existing visual/audio systems with file paths and implementation details |

---

## Content

| Doc | Summary |
|-----|---------|
| [deck-system](content/deck-system.md) | Curated deck structure, JSON format, runtime loading, deck registry, player progression tracking, kanji deck architecture (3-fact-per-kanji model, 5 JLPT levels, 6,633 facts), procedural math decks, and chess tactics deck (620K+ runtime puzzles via `chess-puzzles.db`, `chess_tactic` quiz mode, `chessPuzzleService.ts`) |
| [deck-known-issues](content/deck-known-issues.md) | Residual polish items from the 2026-04-10 audit of 11 decks — 7 anti-pattern categories, per-deck residual warn table, and "check these first" guide for auditing new decks |
| [card-description-audit](content/card-description-audit.md) | Four-source drift audit for all 98 card mechanics (seed vs. stat table vs. resolver vs. description renderer) — severity A–F classification, per-mechanic table, and full detail sections for 14 critical mechanics. Root cause: `getDetailedCardDescription` uses `card.baseEffectValue` not stat-table qpValue. |
| [trivia-bridge](content/trivia-bridge.md) | Curated deck → trivia bridge: entity selection, scoring, field mapping, CLI usage, provenance tracking |
| [fact-pipeline](content/fact-pipeline.md) | `Fact` data format, `facts.db` SQLite build pipeline, `factsDB` runtime service, and content production workflow |
| [domains](content/domains.md) | All knowledge domains, subcategory taxonomy, domain resolution logic, and language vs. knowledge domain distinction |
| [content-strategy](content/CONTENT_STRATEGY.md) | Content strategy and production pipeline overview |
| [anki-integration](content/anki-integration.md) | Anki .apkg import/export: FSRS mapping, personal deck storage, wizard UI, and known limitations |
| [image-quiz-assets](content/image-quiz-assets.md) | Image asset library for `quizMode: 'image_question'` — dinosaur set (39 species), manifest format, license notes |
| [enemy-animations](content/ENEMY-ANIMATIONS.md) | Enemy sprite animation states and definitions (114KB reference) |
| [art-backgrounds](content/ART_BRIEF_BACKGROUNDS.md) | Background art requirements and briefs |
| [sprite-pipeline](content/SPRITE_PIPELINE.md) | Sprite generation and processing pipeline |
| [artstudio](content/artstudio.md) | Art Studio dev tool: category system, image generation, audio SFX review workflow, server API |

---

## Testing

| Doc | Summary |
|-----|---------|
| [strategy](testing/strategy.md) | Overview of all five testing layers (unit, headless sim, Playwright visual, LLM playtest, multiplayer E2E) and when to use each |
| [headless-sim](testing/headless-sim.md) | Running the headless combat simulator — profiles, output format, key commands, and internal module wiring |
| [playwright](testing/playwright.md) | Visual testing with Playwright MCP and E2E scripts — screenshots, scenario loading, debug tools, and gotchas |
| [inspection-registry](testing/inspection-registry.md) | Inspection registry structure, deck-specific date fields, agent lock protocol, and CLI reference for parallel agent coordination |
| [dev-presets](testing/DEVPRESET-REFERENCE.md) | Dev scenario presets and query parameters |
| [playtest-dashboard](testing/PLAYTEST-DASHBOARD.md) | Playtest dashboard server and data locations |
| [visual-verification-checklist](testing/VISUAL-VERIFICATION-CHECKLIST.md) | Master checklist of ~450 visual verification items — every card, relic, enemy, status effect, room, and edge case testable via Docker visual tests |

---

## Marketing

| Doc | Summary |
|-----|---------|
| [steam-store-page](marketing/steam-store-page.md) | Steam storefront strategy: exact graphic specs, screenshot sequence, capsule art direction, trailer structure, store copy, competitor analysis, and production workflow |

---

## Deployment

| Doc | Summary |
|-----|---------|
| [steam](deployment/steam.md) | Build pipeline, SteamPipe uploads, branch strategy, Steamworks SDK integration, and dashboard checklist |

---

## Balance & Tuning

| Doc | Summary |
|-----|---------|
| [balance-audit-2026-04-04](RESEARCH/balance-audit-2026-04-04.md) | Comprehensive balance audit from 24,500+ headless sim runs — 48 issues across 10 categories with data, root cause analysis, fix recommendations, and prioritized action plan |
| [enemy-balance-analysis-2026-04-03](RESEARCH/enemy-balance-analysis-2026-04-03.md) | Enemy HP/damage rebalance analysis — 4-iteration tuning cycle with final convergence results |

---

## Reports

| Doc | Summary |
|-----|---------|
| [quiz-audit-2026-04-10](reports/quiz-audit-2026-04-10.md) | Master roll-up of 98-deck quiz quality audit — 115 BLOCKER / 256 MAJOR / 210 MINOR / 67 NIT across 10,212 rendered instances; 15 cross-deck patterns; top-20 worst facts; full per-deck scoreboard. Per-deck details in `data/audits/findings/`. |
| [quiz-audit-2026-04-10-postfix](reports/quiz-audit-2026-04-10-postfix.md) | Post-fix re-audit. 36 commits across 7 phases resolved all targeted patterns: this/anatomical placeholders → 0, reverse-template POOL-CONTAM → 0, definition_match self-answers → 0, reading-template phonetic → 0, AP mega-pools → 56 sub-pools, vocab POS-split (15,947 facts), JLPT kanji templates (6,633 facts), HSK6 sense-aligned (356 facts), chainThemes for 9 knowledge decks, 12 anti-patterns in `.claude/rules/deck-quality.md`. Verify-all-decks 22→30 checks, quiz-audit-engine 27→35 checks, 229-assertion vitest gate. |

---

## Release & Operations

| Doc | Summary |
|-----|---------|
| [RELEASE_MANAGEMENT](RELEASE_MANAGEMENT.md) | Semantic versioning, branch strategy, release checklist, hotfix process, post-launch cadence |
| [ACCESSIBILITY](ACCESSIBILITY.md) | Color-blind mode, keyboard navigation, text sizing, accessibility testing checklist |
| [PERFORMANCE](PERFORMANCE.md) | Target metrics (FPS/memory/load), baselines, monitoring tools, optimization guidelines |
| [CHANGELOG](../CHANGELOG.md) | All notable changes in Keep a Changelog format |

---

## Cross-cutting

| Doc | Summary |
|-----|---------|
| [gotchas](gotchas.md) | Append-only mistake log: Playwright pitfalls, visual regression incidents, Phaser canvas gotchas, deck quality bugs, mastery system wiring issues, and lessons learned. Last entry: 2026-04-11 Card description four-source drift + balance-preservation boundary incident. |
| [SECURITY](SECURITY.md) | Security considerations, CSP, input sanitization, and credential rules |

---

## Skills Reference

Skill definitions live in `.claude/skills/`. Invoke with `/skill-name`. Key art pipeline skills:

| Skill | File | When to use |
|-------|------|-------------|
| `/deck-art` | `.claude/skills/deck-art/SKILL.md` | Generate and deploy curated deck cover art with depth-based 3D parallax for Study Temple |
| `/artstudio` | `.claude/skills/artstudio/SKILL.md` | Generate all other game art (enemies, backgrounds, relics, icons) via OpenRouter / ComfyUI |
| `/depth-transitions` | `.claude/skills/depth-transitions/SKILL.md` | Generate depth maps and manage parallax room transition shader |
| `/narration` | `.claude/skills/narration/SKILL.md` | Author, implement, and iterate on the Woven Narrative Architecture |
| `/steam-deploy` | `.claude/skills/steam-deploy/SKILL.md` | Build Tauri app and upload to Steam via SteamPipe — setup, build, upload, release promotion |
| `/anki-sync` | `.claude/skills/anki-sync/SKILL.md` | Import .apkg files as personal decks, export any deck to Anki with FSRS stats, debug personal deck issues |

---

## Legacy (archived)

| Doc | Notes |
|-----|-------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Replaced by modular `architecture/` docs — kept for historical reference |
| [GAME_DESIGN.md](GAME_DESIGN.md) | Design spec (still authoritative for game design intent) |
| [RESEARCH/](RESEARCH/) | Design specs, research documents, and production specs |
| [RESEARCH/mystery-room-redesign](RESEARCH/mystery-room-redesign.md) | Mystery room system overhaul — StS-informed event design, full event catalog, new effect types, act distribution changes, implementation roadmap |
