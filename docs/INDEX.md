# Recall Rogue Documentation Index

> Navigation hub for all modular documentation. Each file is independently useful —
> an agent reading just that file should understand that system.
>
> **Last rebuilt:** 2026-04-03

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
| [quiz](mechanics/quiz.md) | Quiz question lifecycle, fact selection, FSRS spaced repetition scheduling, and answer grading |
| [progression](mechanics/progression.md) | Run lifecycle, floor/room generation, map layout, room types, ascension system, and shop mechanics |
| [narrative](mechanics/narrative.md) | Woven Narrative Architecture: 4 concurrent threads (Descent/Echo/Seeker/Inhabitants), archetypes, domain lenses, fact-reactive echo system, NPC dialogue, gravity scoring |
| [procedural-math](mechanics/procedural-math.md) | Runtime math problem generation: skill nodes, 6 generators, algorithmic distractors, FSRS skill tracking, Anki-model selection, tier-based difficulty scaling |

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

## Content

| Doc | Summary |
|-----|---------|
| [deck-system](content/deck-system.md) | Curated deck structure, JSON format, runtime loading, deck registry, and player progression tracking |
| [trivia-bridge](content/trivia-bridge.md) | Curated deck → trivia bridge: entity selection, scoring, field mapping, CLI usage, provenance tracking |
| [fact-pipeline](content/fact-pipeline.md) | `Fact` data format, `facts.db` SQLite build pipeline, `factsDB` runtime service, and content production workflow |
| [domains](content/domains.md) | All knowledge domains, subcategory taxonomy, domain resolution logic, and language vs. knowledge domain distinction |
| [content-strategy](content/CONTENT_STRATEGY.md) | Content strategy and production pipeline overview |
| [image-quiz-assets](content/image-quiz-assets.md) | Image asset library for `quizMode: 'image_question'` — dinosaur set (39 species), manifest format, license notes |
| [enemy-animations](content/ENEMY-ANIMATIONS.md) | Enemy sprite animation states and definitions (114KB reference) |
| [art-backgrounds](content/ART_BRIEF_BACKGROUNDS.md) | Background art requirements and briefs |
| [sprite-pipeline](content/SPRITE_PIPELINE.md) | Sprite generation and processing pipeline |
| [artstudio](content/artstudio.md) | Art Studio dev tool: category system, image generation, audio SFX review workflow, server API |

---

## Testing

| Doc | Summary |
|-----|---------|
| [strategy](testing/strategy.md) | Overview of all four testing layers (unit, headless sim, Playwright visual, LLM playtest) and when to use each |
| [headless-sim](testing/headless-sim.md) | Running the headless combat simulator — profiles, output format, key commands, and internal module wiring |
| [playwright](testing/playwright.md) | Visual testing with Playwright MCP and E2E scripts — screenshots, scenario loading, debug tools, and gotchas |
| [dev-presets](testing/DEVPRESET-REFERENCE.md) | Dev scenario presets and query parameters |
| [playtest-dashboard](testing/PLAYTEST-DASHBOARD.md) | Playtest dashboard server and data locations |

---

## Marketing

| Doc | Summary |
|-----|---------|
| [steam-store-page](marketing/steam-store-page.md) | Steam storefront strategy: exact graphic specs, screenshot sequence, capsule art direction, trailer structure, store copy, competitor analysis, and production workflow |

---

## Cross-cutting

| Doc | Summary |
|-----|---------|
| [gotchas](gotchas.md) | Append-only mistake log: Playwright pitfalls, visual regression incidents, Phaser canvas gotchas, and lessons learned |
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

---

## Legacy (archived)

| Doc | Notes |
|-----|-------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Replaced by modular `architecture/` docs — kept for historical reference |
| [GAME_DESIGN.md](GAME_DESIGN.md) | Design spec (still authoritative for game design intent) |
| [RESEARCH/](RESEARCH/) | Design specs, research documents, and production specs |
| [RESEARCH/mystery-room-redesign](RESEARCH/mystery-room-redesign.md) | Mystery room system overhaul — StS-informed event design, full event catalog, new effect types, act distribution changes, implementation roadmap |
