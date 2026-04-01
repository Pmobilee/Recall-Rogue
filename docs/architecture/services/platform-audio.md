# Platform Services — Audio & Game Feel

> **Purpose:** Audio synthesis, file-based SFX playback, card audio cues, ambient atmosphere layering, BGM music playback, and game-feel (juice) coordination services
> **Last verified:** 2026-04-01
> **Source files:** `src/services/audioService.ts`, `src/services/cardAudioManager.ts`, `src/services/juiceManager.ts`, `src/services/ambientAudioService.ts`, `src/services/musicService.ts`

> **See also:** [`platform.md`](platform.md) — All other platform services: device detection, haptics, performance, analytics, input, accessibility, notifications, entitlements, and more.

---

## Overview

These services form the audio and game-feel layer. They work together: `juiceManager` coordinates combat events → `cardAudioManager` maps cues to sound names → `audioService` plays the audio. `ambientAudioService` runs in parallel, layering looping atmosphere sounds for the current room/screen context. `hapticService` (in `platform.md`) is also called by `juiceManager` for mobile haptic feedback.

---

## ambientAudioService

| | |
|---|---|
| **File** | src/services/ambientAudioService.ts |
| **Purpose** | Layer multiple simultaneous ambient loops per screen/room context; crossfade between contexts on transitions |
| **Key exports** | `ambientAudio` (singleton), `AmbientContext` (type) |
| **Key dependencies** | Web Audio API, `fetch` (for .m4a loop loading) |
| **Loop files** | `public/assets/audio/sfx/loops/*.m4a` |

### Audio Graph

```
AudioBufferSourceNode ─┐
                       ├→ per-layer GainNode → masterGain → destination
AudioBufferSourceNode ─┘   (N layers per recipe)
```

### Contexts and Recipes

Each `AmbientContext` maps to a recipe: an ordered list of `{ file, volume }` layers. All layers play simultaneously as looping AudioBufferSourceNodes.

| Context | Layers | Primary character |
|---------|--------|-------------------|
| `hub` | 5 | Campfire + stone room — warm/safe underground |
| `dungeon_map` | 3 | Wind + drips — contemplative planning |
| `shop` | 3 | Torch crackle + chain rattle — merchant alcove |
| `rest` | 4 | Campfire + wind — deeper rest site |
| `mystery` | 3 | Arcane whisper + void — eerie unknown |
| `combat_dust` | 4 | Drips + stone — Floors 1–3 basic cave |
| `combat_embers` | 4 | Ember pit + lava — Floors 4–6 volcanic |
| `combat_ice` | 4 | Ice creak + wind howl — Floors 7–9 frozen |
| `combat_arcane` | 4 | Arcane whisper + crystal — Floors 10–12 |
| `combat_void` | 2 | Void drone + howl — minimal void |
| `boss_arena` | 2 | Tension underbed + arena ambient |
| `mastery_challenge` | 2 | Arcane + crystal hum |
| `run_end_victory` | 1 | Soft campfire |
| `run_end_defeat` | 2 | Void drone + wind |
| `retreat_delve` | 3 | Wind + stone + dungeon drip |
| `silent` | 0 | No audio |

Recipe definitions live in the `RECIPES` constant at the top of `ambientAudioService.ts`. Spec source: `docs/roadmap/future/SFX-SOUND-GENERATION-PROMPTS.md §AMBIENT ATMOSPHERE RECIPES`.

### Crossfade Behaviour

- Duration: 800 ms (`CROSSFADE_SEC = 0.8`)
- Old layers: `exponentialRampToValueAtTime(0.001, now + 0.8)`, then stopped after 900 ms
- New layers: `linearRampToValueAtTime(targetVol, now + 0.8)` starting from 0
- All new layer buffers loaded in parallel before fade-in begins

### Modifiers (stacked multiplicatively)

| Modifier | Multiplier | Purpose |
|----------|-----------|---------|
| Music coexistence | `0.3×` | BGM is playing; ambient sits under music |
| Quiz duck | `0.5×` | Quiz overlay active; ambient steps back |

Both flags are independent and stack: coexistence + ducking = `0.15×`.

Volume math lives in the pure function `effectiveVolume(targetVolume, musicCoexistence, ducking)`.

### Boss Overlay

`addBossOverlay()` starts additional tension layers on top of the current recipe without crossfading away the existing ones. `removeBossOverlay()` fades them out over 800 ms. The overlay layers are defined in `BOSS_OVERLAY_LAYERS` (currently: `combat_tension_underbed.m4a` at 0.3).

### Pre-init Pending Context

`setContext()` can be called before `init()` — for example from Svelte `$effect` hooks that run on component mount before the user has interacted with the page (browser autoplay policy blocks `AudioContext` creation until a user gesture).

The service handles this via a `pendingContext` field:

- `setContext()` always writes its argument to `pendingContext` before any early-return check.
- If `this.ctx` is null (not yet initialised), the method returns without starting playback.
- When `init()` creates the `AudioContext` on the first user gesture, it checks whether `pendingContext` differs from `currentContext` and, if so, calls `setContext(pendingContext)` to replay the missed transition.
- `stop()` resets `pendingContext` to `'silent'` along with `currentContext`.

This means components can call `void ambientAudio.setContext('hub')` unconditionally in their mount effects — the audio will start correctly as soon as the user clicks anywhere.

### Public API

```ts
ambientAudio.init()                            // lazy AudioContext creation; replays pendingContext if set
ambientAudio.unlock()                          // resume suspended context on subsequent gestures
await ambientAudio.setContext('combat_dust')   // switch context with crossfade; stores pending if ctx not ready
ambientAudio.duck()                            // quiz overlay — reduce to 50%
ambientAudio.unduck()                          // restore from duck
ambientAudio.setMusicCoexistence(true)         // BGM active — reduce to 30%
ambientAudio.addBossOverlay()                  // add boss tension layers on top
ambientAudio.removeBossOverlay()               // fade out boss layers
ambientAudio.stop()                            // hard stop all layers, reset to silent + pending
```

### Buffer Cache

Decoded `AudioBuffer` objects are cached by file path string. Failed fetches are stored as `null` to suppress retries. Cache is unbounded (ambient loops are few and long-lived).

### Integration Points

| Caller | Call site | What happens |
|--------|-----------|--------------|
| `src/CardApp.svelte` — `handleUserInteraction()` | After `unlockCardAudio()` on the very first user gesture | `ambientAudio.init()` creates the AudioContext and replays any pending context; `ambientAudio.unlock()` resumes it if suspended |
| `src/services/gameFlowController.ts` — `setCombatAmbient()` | Helper called at every combat start point | Sets the correct `combat_<theme>` context based on floor number; sets `boss_arena` + calls `addBossOverlay()` on boss floors |
| `src/services/gameFlowController.ts` — `onEncounterComplete()` | At the start of every encounter-complete handler | `removeBossOverlay()` fades out boss tension layers; safe to call when no overlay is active |
| `src/services/musicService.ts` — `playTrack()` | After `newSource.start()` when a BGM track begins playing | `setMusicCoexistence(true)` ducks ambient to 30% |
| `src/services/musicService.ts` — `fadeOutAndStop()` | Before `this._isPlaying = false` when music fully stops | `setMusicCoexistence(false)` restores ambient to full volume |
| `src/services/musicService.ts` — `togglePlayPause()` | Inside `ctx.suspend().then()` callback when user pauses music | `setMusicCoexistence(false)` restores ambient while music is paused |

The `setCombatAmbient` helper in `gameFlowController.ts` is called at four combat start points:
1. Auto-started encounter 3 (boss/mini-boss) inside `proceedAfterReward()`
2. `onRoomSelected` case `'combat'` (player picks a room)
3. `resumeFromCampfire()` fallback combat path
4. Mystery-room combat via `onMysteryEffectResolved()`

---

## audioService

| | |
|---|---|
| **File** | src/services/audioService.ts |
| **Purpose** | Web Audio API playback — 229 .m4a files preferred, procedural synthesis fallback for every sound |
| **Key exports** | `audioManager` (singleton with `unlock`, `playSound`, `setVolume`, `preloadSounds`), `SoundName` (type) |
| **Key dependencies** | Web Audio API, `fetch` (for .m4a file loading) |

### Playback Architecture — File-First with Synthesis Fallback

`audioService` uses a two-tier strategy:

1. **File-based (preferred):** 229 `.m4a` files live under `public/assets/audio/sfx/` organised by folder (combat, status, quiz, turn, surge, relic, encounter, map, hub, shop, rest, reward, mystery, run, ui, reveal, mastery, keeper, transition, tutorial, progression, legacy). Decoded `AudioBuffer` objects are cached in memory after first load.
2. **Synthesis fallback (always present):** Every `SoundName` has a corresponding synthesis function in `SOUND_MAP`. Used on the first play of any sound before its file is loaded, or if the file fetch fails.

### Request Lifecycle

```
playSound('quiz_correct')
  ├─ bufferCache.has('quiz_correct')? → YES → play from buffer, done
  └─ NO
      ├─ SFX_FILE_MAP has entry? → YES → fire-and-forget loadSfxBuffer()
      └─ play synthesis immediately (zero latency)

loadSfxBuffer (async, background)
  ├─ fetch('/assets/audio/sfx/quiz/quiz_correct.m4a')
  ├─ ctx.decodeAudioData(arrayBuffer)
  └─ bufferCache.set(name, audioBuffer)    // next call uses file
         on error → bufferCache.set(name, null)  // no retry
```

### Key Internals

| Symbol | Kind | Description |
|--------|------|-------------|
| `SFX_FILE_MAP` | `Partial<Record<SoundName, string>>` | Maps all 229 SoundNames to their .m4a paths |
| `sfxPath(name)` | function | Auto-derives path from name prefix; has explicit overrides for edge-cases |
| `bufferCache` | `Map<SoundName, AudioBuffer \| null>` | Decoded buffer cache; `null` = fetch failed, don't retry |
| `loadingSet` | `Set<SoundName>` | Guards against duplicate in-flight requests |
| `loadSfxBuffer(name)` | private async | Fetch + decode + cache a single sound file |
| `preloadSounds(names)` | public async | Warms the cache for a list of names; call during loading screens |

### Path Mapping Rules

Most paths are auto-generated by `sfxPath()` using the convention:
`/assets/audio/sfx/{first_segment_before_underscore}/{name}.m4a`

Explicit overrides (where the file path doesn't match the prefix rule):

| SoundName | File path |
|-----------|-----------|
| `surge_active` | `surge/surge_active_loop.m4a` |
| `button_click` | `ui/button_click.m4a` |
| `modal_open/close`, `toggle_on/off`, `tab_switch`, `notification_ping`, `error_deny`, `ui_pop_in` | `ui/{name}.m4a` |
| `collect`, `item_pickup`, `gaia_quip`, `lava_sizzle`, `gas_pocket` | `legacy/{name}.m4a` |
| `mine_dirt`, `mine_rock`, `mine_crystal`, `mine_break` | `legacy/{name}.m4a` |
| `oxygen_warning`, `oxygen_low`, `oxygen_critical` | `legacy/{name}.m4a` |

### Public API

```ts
audioManager.unlock()                      // call on first user gesture
audioManager.playSound(name: SoundName)    // file-first, synthesis fallback
audioManager.preloadSounds(names: SoundName[]) // warm cache during load screens
audioManager.setVolume(level: number)      // 0.0 – 1.0
audioManager.mute() / unmute()
audioManager.isMuted(): boolean
```

### First-Gesture Preload (CardApp.svelte)

`handleUserInteraction()` in `src/CardApp.svelte` is called on the first user touch/click (the browser AudioContext unlock gate). After calling `unlockCardAudio()`, it fire-and-forgets `audioManager.preloadSounds()` with the ~30 highest-priority sounds so their `.m4a` files are decoded before the first combat encounter begins:

| Category | Sounds |
|----------|--------|
| Quiz | `quiz_correct`, `quiz_wrong`, `quiz_appear`, `quiz_answer_select`, `quiz_dismiss` |
| Card play | `card_swoosh_attack/shield/buff/debuff/wild`, `card_deal`, `card_select`, `card_deselect`, `card_discard` |
| Chain | `chain_link_1` through `chain_link_5`, `chain_break` |
| Combat feedback | `player_damage`, `enemy_attack`, `shield_absorb`, `shield_break`, `shield_gain` |
| UI | `button_click`, `modal_open`, `modal_close` |
| Turn flow | `end_turn_click`, `ap_spend` |

The synthesis fallback still fires on the very first play of any sound before its buffer is warm — the preload eliminates synthesis from the second play onward for all critical sounds.

---

## cardAudioManager

| | |
|---|---|
| **File** | src/services/cardAudioManager.ts |
| **Purpose** | Maps semantic card audio cues to audioService sound names; provides Svelte store for mute state |
| **Key exports** | `playCardAudio`, `CardAudioCue` (type) |
| **Key dependencies** | audioService |

## musicService (BGM)

| | |
|---|---|
| **File** | src/services/musicService.ts |
| **Purpose** | BGM playback using HTMLAudioElement — Safari-compatible, real-time frequency data for visualiser |
| **Key exports** | `musicService` (singleton) |
| **Key dependencies** | Web Audio API (`createMediaElementSource`), `src/data/musicTracks.ts` (track manifest), `ambientAudioService` (coexistence ducking), `cardAudioManager` (`musicVolume`/`musicEnabled` stores) |
| **Track files** | `public/assets/audio/music/epic/*.m4a` (AAC 192k 44.1kHz), `public/assets/audio/music/quiet/*.m4a` — re-encoded from Suno mp3s that contained embedded JPEG cover art (see gotchas) |

### Audio Graph

```
HTMLAudioElement → createMediaElementSource() → masterGain → AnalyserNode(fftSize=64) → destination
```

AnalyserNode is connected after `element.play()` starts (Safari compatibility — must not connect before playback begins).

### Features

- **Two categories**: Epic (combat) and Lo-Fi/Quiet (ambient) — user toggles via MusicWidget. Category label shown as EPIC / LO-FI in the widget; internal key is `'quiet'` for the Lo-Fi category.
- **Crossfade**: Sequential 1.5s fade-out → 1.5s fade-in (no overlap). `HTMLAudioElement.volume` ramped via `requestAnimationFrame`.
- **Run start fade-in**: `startWithFadeIn(5000)` provides a 5-second gentle fade-in when entering a run.
- **Shuffle queue**: Fisher-Yates with back-to-back repeat avoidance
- **AnalyserNode**: 32 frequency bins at 60fps for spectrogram visualiser in MusicWidget
- **Volume / mute**: Single source of truth is `musicVolume` / `musicEnabled` Svelte stores from `cardAudioManager`. `musicService` subscribes to these — never duplicates its own mute state.
- **Persistence**: Volume, mute, category saved to `localStorage` key `music_prefs`
- **User gesture gating**: AudioContext created lazily; `startIfNotPlaying()` is a no-op until `unlock()` is called from a user gesture handler
- **Ambient coexistence**: Calls `ambientAudio.setMusicCoexistence(true/false)` to duck ambient layers when music plays

### UI Integration

`MusicWidget.svelte` — Spotify-style expanding glass pill in top-right corner during runs. Shows real-time spectrogram, track name, Epic/Lo-Fi category toggle, playback controls, volume slider. Volume and mute state synced with `cardAudioManager` stores (single source of truth). Rendered in `CardApp.svelte` alongside `InRunTopBar` when `showTopBar` is true.

---

## juiceManager

| | |
|---|---|
| **File** | src/services/juiceManager.ts |
| **Purpose** | Centralized game-feel coordinator — dispatches haptics + audio cues for combat events (correct, wrong, combo, chain, etc.) |
| **Key exports** | `juiceManager` (singleton with `onCorrectImpact`, `onWrongFizzle`, `onEnemyHit`, `onChainLink`, etc.) |
| **Key dependencies** | hapticService, cardAudioManager |

---

## ambientAudioService — UI Integration Points

`setContext()` is called from Svelte components at the lifecycle point where the screen/room becomes active. All calls use `void` prefix (fire-and-forget). `duck()`/`unduck()` are synchronous.

| Component | File | Call | Trigger |
|-----------|------|------|---------|
| `HubScreen` | `src/ui/components/HubScreen.svelte` | `setContext('hub')` | Initial `$effect` alongside `playCardAudio('hub-welcome')` |
| `DungeonMap` | `src/ui/components/DungeonMap.svelte` | `setContext('dungeon_map')` | `onMount` alongside `playCardAudio('map-open')` |
| `ShopRoomOverlay` | `src/ui/components/ShopRoomOverlay.svelte` | `setContext('shop')` | `$effect` alongside `playCardAudio('shop-open')` |
| `RestRoomOverlay` | `src/ui/components/RestRoomOverlay.svelte` | `setContext('rest')` | `$effect` alongside `playCardAudio('rest-open')` |
| `MysteryEventOverlay` | `src/ui/components/MysteryEventOverlay.svelte` | `setContext('mystery')` | `$effect` when `event` is set, alongside `playCardAudio('mystery-appear')` |
| `RunEndScreen` | `src/ui/components/RunEndScreen.svelte` | `setContext('run_end_victory')` or `setContext('run_end_defeat')` | `onMount`, branched on `isVictory` |
| `MasteryChallengeOverlay` | `src/ui/components/MasteryChallengeOverlay.svelte` | `setContext('mastery_challenge')` | `$effect` when `challenge` is set, alongside `playCardAudio('mastery-challenge')` |
| `RetreatOrDelve` | `src/ui/components/RetreatOrDelve.svelte` | `setContext('retreat_delve')` | Initial `$effect` on mount |
| `CardCombatOverlay` | `src/ui/components/CardCombatOverlay.svelte` | `duck()` / `unduck()` | `$effect` reactive on `isQuizPanelVisible` — ducks when charge quiz panel is showing |

### Pattern Notes

- `setContext()` is async (returns `Promise<void>`) but all callers use `void` because the crossfade completes in the background — components do not need to await it.
- `setContext()` called before the first user gesture safely stores the request as `pendingContext` — no errors, audio starts at `init()` time.
- `duck()`/`unduck()` are synchronous volume ramp calls, no `void` needed.
- The duck signal uses `isQuizPanelVisible` (not the broader `cardPlayStage === 'committed'`) so Quick Play animations — which set `committed` briefly without showing a quiz — do not trigger ducking.
