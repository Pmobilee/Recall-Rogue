# Changelog

All notable changes to Recall Rogue are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Multiplayer system: Race Mode, Co-op Mode, lobby creation/joining, BroadcastChannel transport
- Co-op enemy scaling: enemies attack both players, unified HP formula
- 63 new BGM tracks, Jukebox shop in Camp Store with 15s previews
- Library UI cleanup: custom decks in sidebar, filter improvements
- Always Write Answers mode for all language decks with synonym + close match support
- Comprehensive agent infrastructure: 12 rule files, 5 agent definitions with prompt templates
- Pre-commit hooks: docs sync warning, deck verification gate, hardcoded px lint
- Release management, accessibility, and performance documentation
- Production error handling and crash overlay for Steam release (fatal error → restart prompt before Svelte mounts)
- 6 new Steam achievements: `MASTERY_FIRST`, `MASTERY_100`, `MASTERY_500`, `STREAK_7`, `DECK_EXPLORER`, `FACTS_5000` (total: 24)

### Fixed
- Strip "Made with Google AI" metadata from 503 PNGs before Steam shipping
- Deep-copy player objects in notifyLobbyUpdate for Svelte reactivity
- Ready state not syncing between lobby tabs
- Joiner stuck on blank page — joinLobby creates placeholder lobby state
- Playlist fact interleaving, selector bias, and playlist UI management
- Confusion matrix capped at 5000 entries with stale-pair pruning to prevent unbounded save growth
- Settings migration completeness: 12 missing localStorage keys added to `migrateLocalStorageToFiles()`
- Card effect text font size reduced 33% cumulatively — short descriptions now fit the description box proportionally
- `createNewPlayer()` starts character at level 1 (was hardcoded to 25 in dev path)
- Dev-mode save override (level 25, all relics) now guarded by `import.meta.env.DEV` — will not execute in production

### Changed
- Agent routing table expanded from 5 to 15 entries (100% src/ coverage)
- Task tracking rule strengthened: tasks required for ALL work, no exceptions
- Content pipeline rule split into two files (content-pipeline.md + deck-quality.md)
- `errorReporting.ts` uses `__RR_VERSION__` (Vite build injection) instead of hardcoded version string; skips HTTP POST on Tauri/Steam desktop builds

## [0.1.0] - 2026-03-01

### Added
- Initial development build
- Core combat system with turn-based card play
- FSRS spaced repetition quiz engine
- 77 curated knowledge decks
- Headless balance simulator (6000 runs in 5s)
- Steam deployment pipeline via Tauri
- Phaser 3 rendering with WebGL parallax transitions
- 1900+ unit tests
