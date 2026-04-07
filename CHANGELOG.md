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

### Fixed
- Strip "Made with Google AI" metadata from 503 PNGs before Steam shipping
- Deep-copy player objects in notifyLobbyUpdate for Svelte reactivity
- Ready state not syncing between lobby tabs
- Joiner stuck on blank page — joinLobby creates placeholder lobby state
- Playlist fact interleaving, selector bias, and playlist UI management

### Changed
- Agent routing table expanded from 5 to 15 entries (100% src/ coverage)
- Task tracking rule strengthened: tasks required for ALL work, no exceptions
- Content pipeline rule split into two files (content-pipeline.md + deck-quality.md)

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
