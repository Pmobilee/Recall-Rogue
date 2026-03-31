# Platform Services — Audio & Game Feel

> **Purpose:** Audio synthesis, card audio cues, and game-feel (juice) coordination services
> **Last verified:** 2026-03-31
> **Source files:** `src/services/audioService.ts`, `src/services/cardAudioManager.ts`, `src/services/juiceManager.ts`

> **See also:** [`platform.md`](platform.md) — All other platform services: device detection, haptics, performance, analytics, input, accessibility, notifications, entitlements, and more.

---

## Overview

These three services form the audio and game-feel layer. They work together: `juiceManager` coordinates combat events → `cardAudioManager` maps cues to sound names → `audioService` synthesizes the audio. `hapticService` (in `platform.md`) is also called by `juiceManager` for mobile haptic feedback.

---

## audioService

| | |
|---|---|
| **File** | src/services/audioService.ts |
| **Purpose** | Web Audio API synthesizer — 180+ sounds generated procedurally with no audio files |
| **Key exports** | `audioManager` (singleton with `unlock`, `playSound`, `setVolume`), `SoundName` (type) |
| **Key dependencies** | Web Audio API |

## cardAudioManager

| | |
|---|---|
| **File** | src/services/cardAudioManager.ts |
| **Purpose** | Maps semantic card audio cues to audioService sound names; provides Svelte store for mute state |
| **Key exports** | `playCardAudio`, `CardAudioCue` (type) |
| **Key dependencies** | audioService |

## juiceManager

| | |
|---|---|
| **File** | src/services/juiceManager.ts |
| **Purpose** | Centralized game-feel coordinator — dispatches haptics + audio cues for combat events (correct, wrong, combo, chain, etc.) |
| **Key exports** | `juiceManager` (singleton with `onCorrectImpact`, `onWrongFizzle`, `onEnemyHit`, `onChainLink`, etc.) |
| **Key dependencies** | hapticService, cardAudioManager |
