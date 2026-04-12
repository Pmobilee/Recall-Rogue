# Platform Services — Audio & Game Feel

> **Purpose:** Audio synthesis, file-based SFX playback, card audio cues, ambient atmosphere layering, BGM music playback, and game-feel (juice) coordination services
> **Last verified:** 2026-04-07
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

Each `AmbientContext` maps to a recipe: an ordered list of `{ file, volume }` layers. All layers play simultaneously as looping AudioBufferSourceNodes. Layers referencing deleted files are silently skipped at runtime via the `if (!buffer) continue` guard in `crossfadeTo()`.

**Accepted loop files (2026-04-07):** `hub_campfire_ambience`, `water_drip_close`, `dungeon_drip_ambient`, `stone_room_resonance`, `boss_arena_ambient`, `insect_cave`, `map_exploration_ambient`, `low_hp_warning_pulse`. All other formerly-referenced files have been deleted and will produce a `console.warn` then be skipped.

| Context | Layers | Active layers (accepted files only) | Primary character |
|---------|--------|--------------------------------------|-------------------|
| `hub` | 5 | campfire, water_drip, stone_resonance | Campfire + stone room — warm/safe underground |
| `dungeon_map` | 5 | water_drip, insect_cave, map_exploration | Wind + cave insects + exploration — contemplative planning |
| `shop` | 5 | insect_cave, dungeon_drip | Cave insects + drips in background |
| `rest` | 5 | campfire, water_drip, insect_cave | Campfire + ambient cave life |
| `mystery` | 5 | insect_cave, dungeon_drip | Subtle cave life beneath the arcane |
| `combat_dust` | 5 | water_drip, insect_cave | Drips + cave insects — Floors 1–3 basic cave |
| `combat_embers` | 7 | insect_cave, dungeon_drip, stone_resonance | Ember pit + stone chamber — Floors 4–6 volcanic |
| `combat_ice` | 6 | water_drip, dungeon_drip, stone_resonance | Ice cavern + dripping water — Floors 7–9 frozen |
| `combat_arcane` | 6 | map_exploration, stone_resonance | Underground chamber + arcane — Floors 10–12 |
| `combat_void` | 3 | map_exploration | Void drone + subtle presence |
| `boss_arena` | 2 | boss_arena_ambient | Arena ambient (tension underbed deleted) |
| `mastery_challenge` | 4 | map_exploration, stone_resonance | Stone chamber + ambient backdrop |
| `run_end_victory` | 1 | campfire | Soft campfire |
| `run_end_defeat` | 3 | dungeon_drip | Void + dripping dungeon |
| `retreat_delve` | 4 | dungeon_drip, insect_cave | Wind + cave life + drips |
| `silent` | 0 | — | No audio |

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

`addBossOverlay()` starts additional tension layers on top of the current recipe without crossfading away the existing ones. `removeBossOverlay()` fades them out over 800 ms. The overlay layers are defined in `BOSS_OVERLAY_LAYERS`. As of 2026-04-07, `combat_tension_underbed.m4a` was deleted and `BOSS_OVERLAY_LAYERS` is empty — `addBossOverlay()` is currently a no-op until a replacement file is sourced and added.

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
ambientAudio.addBossOverlay()                  // add boss tension layers on top (no-op while BOSS_OVERLAY_LAYERS is empty)
ambientAudio.removeBossOverlay()               // fade out boss layers
ambientAudio.stop()                            // hard stop all layers, reset to silent + pending
ambientAudio.setEnabled(false)                 // user toggle — stops all layers, remembers context for resume
ambientAudio.setVolume(0.7)                    // master output volume 0.0–1.0; applied to Web Audio masterGain
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
| `src/services/cardAudioManager.ts` — `initCardAudio()` | Called on first user gesture via `unlockCardAudio()` | Subscribes `ambientEnabled`/`ambientVolume` stores → calls `setEnabled()`/`setVolume()` on every store change |

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
| **Purpose** | Maps semantic card audio cues to audioService sound names; provides persisted Svelte stores for all audio user preferences |
| **Key exports** | `playCardAudio`, `CardAudioCue` (type), `sfxEnabled`, `sfxVolume`, `musicEnabled`, `musicVolume`, `ambientEnabled`, `ambientVolume` |
| **Key dependencies** | audioService, ambientAudioService |

### Persisted Stores

All stores use `localStorage` with the `card:` key prefix. Values persist across sessions.

| Store | Key | Default | Wired to |
|-------|-----|---------|----------|
| `sfxEnabled` | `card:sfxEnabled` | `true` | `audioManager.mute()/unmute()` |
| `sfxVolume` | `card:sfxVolume` | `1.0` | `audioManager.setVolume()` |
| `musicEnabled` | `card:musicEnabled` | `true` | `musicService` (subscribes directly) |
| `musicVolume` | `card:musicVolume` | `0.5` | `musicService` (subscribes directly) |
| `ambientEnabled` | `card:ambientEnabled` | `true` | `ambientAudio.setEnabled()` |
| `ambientVolume` | `card:ambientVolume` | `0.7` | `ambientAudio.setVolume()` |

`ambientEnabled` and `ambientVolume` subscriptions are wired inside `initCardAudio()`, which runs on the first user gesture via `unlockCardAudio()`.

### Ambient Audio User Controls

User ambient audio preferences are exposed in the Settings Panel and MusicWidget:

- **Settings Panel (landscape/portrait)**: Ambient Enabled toggle (stored as `ambientEnabled`) + Ambient Volume slider (stored as `ambientVolume`, range 0.0–1.0). Both are wired to `ambientAudio.setEnabled()` and `ambientAudio.setVolume()` respectively.
- **MusicWidget expanded panel**: Ambient On/Off toggle for quick access during gameplay. Subscribes to the same `ambientEnabled` store.

When `ambientEnabled` is toggled `false`, `ambientAudio.setEnabled(false)` stops all currently playing layers but remembers the active context for resume. When toggled back `true`, playback resumes with the same context. Volume changes apply immediately to the `masterGain` node and persist across context changes.

## musicService (BGM)

| | |
|---|---|
| **File** | src/services/musicService.ts |
| **Purpose** | BGM playback using HTMLAudioElement — Safari-compatible, real-time frequency data for visualiser |
| **Key exports** | `musicService` (singleton) |
| **Key dependencies** | Web Audio API (`createMediaElementSource`), `src/data/musicTracks.ts` (track manifest), `ambientAudioService` (coexistence ducking), `cardAudioManager` (`musicVolume`/`musicEnabled` stores), `playerSave` store (unlocked track IDs) |
| **Track files** | `public/assets/audio/music/epic/*.m4a` (AAC 192k 44.1kHz), `public/assets/audio/music/quiet/*.m4a` — re-encoded from Suno mp3s that contained embedded JPEG cover art (see gotchas) |
| **Track counts** | 40 epic (29 free + 11 locked), 55 quiet (35 free + 20 locked) — 95 total |

### Audio Graph

```
HTMLAudioElement → createMediaElementSource() → masterGain → AnalyserNode(fftSize=64) → destination
```

AnalyserNode is connected after `element.play()` starts (Safari compatibility — must not connect before playback begins).

### Features

- **Two categories**: Epic (combat) and Lo-Fi/Quiet (ambient) — user toggles via MusicWidget. Category label shown as EPIC / LO-FI in the widget; internal key is `'quiet'` for the Lo-Fi category.
- **Crossfade**: Sequential 1.5s fade-out → 1.5s fade-in (no overlap). `HTMLAudioElement.volume` ramped via `requestAnimationFrame`. The crossfade interval is stored as a class field (`_crossfadeInterval`) and cancelled immediately when `musicVolume`/`musicEnabled` stores change, so settings adjustments during a fade take instant effect.
- **Run start fade-in**: `startWithFadeIn(5000)` provides a 5-second gentle fade-in when entering a run.
- **User-pause persistence**: `togglePlayPause()` sets a `_userPaused` flag. `startWithFadeIn()` and `startIfNotPlaying()` check this flag — screen transitions within a run cannot restart music the player explicitly paused. `resetUserPause()` clears the flag on new-run start (via `$effect` in `CardApp.svelte`).
- **Shuffle queue**: Fisher-Yates with back-to-back repeat avoidance. Only playable tracks enter the queue (see Jukebox below).
- **AnalyserNode**: 32 frequency bins at 60fps for spectrogram visualiser in MusicWidget
- **Volume / mute**: Single source of truth is `musicVolume` / `musicEnabled` Svelte stores from `cardAudioManager`. `musicService` subscribes to these — never duplicates its own mute state. Both subscriptions cancel any active `_crossfadeInterval` before applying the new volume/enabled value.
- **Persistence**: Volume, mute, category saved to `localStorage` key `music_prefs`
- **User gesture gating**: AudioContext created lazily; `startIfNotPlaying()` is a no-op until `unlock()` is called from a user gesture handler
- **Ambient coexistence**: Calls `ambientAudio.setMusicCoexistence(true/false)` to duck ambient layers when music plays
- **Epic 5s offset**: Epic tracks seek to `currentTime = 5` immediately after `play()` to skip intros that sound too similar across tracks.

### Jukebox — Locked Track System

Tracks in `musicTracks.ts` with `locked: true` are not included in shuffle until purchased. The purchase flow is handled by the Jukebox UI shop (not yet implemented as of 2026-04-07 — data layer is ready).

| Symbol | Description |
|--------|-------------|
| `getPlayableTracks(category, unlockedIds)` | Returns free + player-unlocked tracks for a category. Used by `playCategory()`, `next()`, `prev()`. |
| `getLockedTracks()` | Returns all locked tracks — for the Jukebox shop listing. |
| `purchaseMusicTrack(trackId, price)` | In `playerData.ts` — deducts grey matter, appends to `PlayerSave.unlockedTracks`. |
| `PlayerSave.unlockedTracks` | Persisted string[] of purchased track IDs. Migrated to `[]` for existing saves. |

**Pricing tiers by duration:**
- < 120s: 25 grey matter
- 120–180s: 40 grey matter
- 180–240s: 60 grey matter
- ≥ 240s: 80 grey matter

### Preview System

`musicService.previewTrack(track)` plays a 15-second snippet from the midpoint of any track (including locked ones, for the Jukebox purchase decision flow).

- Seeks to `duration / 2 - 7.5s` as start point
- Ducks main BGM to 20% volume while previewing
- Fades preview in over 500ms, auto-fades out at 14.5s
- `musicService.stopPreview()` cancels preview and restores BGM volume
- `musicService.isPreviewing` getter exposes preview state for UI

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

---

## Audio Asset Catalog (artstudio-items.json)

All audio files are catalogued in `sprite-gen/cardback-tool/artstudio-items.json` under 11 top-level keys. This catalog documents every audio asset with its concept description and codeLocation for traceability.

| Key | Count | Contents |
|-----|-------|----------|
| `audio_loops` | 32 | Ambient loop `.m4a` files from `public/assets/audio/sfx/loops/`. All marked `needsReplacement: true` — current files are synthesized placeholders awaiting proper recordings. |
| `audio_combat` | 41 | Combat SFX: card events (swooshes, deal, select, fizzle, forget, charge), enemy actions, player health, chain combo sounds |
| `audio_quiz` | 9 | Quiz SFX: appear, answer_select, correct, wrong, speed_bonus, dismiss, timer_tick, memory_tip, streak |
| `audio_ui` | 9 | Generic UI SFX: button_click, modal_open/close, toggle_on/off, tab_switch, notification_ping, error_deny, ui_pop_in |
| `audio_shop` | 22 | Shop SFX: open/close/purchase/sell, haggle, removal, transform variants, price tick, card appear/flip, coin fly, bark |
| `audio_status` | 12 | Status effect SFX: all apply/tick variants for poison, burn, bleed, weakness, vulnerability, strength, regen, focus, expire |
| `audio_encounter` | 7 | Encounter lifecycle SFX: start (normal/boss/elite), victory, defeat, boss_defeated, boss_intro |
| `audio_progression` | 6 | Progression SFX: fact_mastered, mastery_challenge_appear, mastery_trial_pass/fail, mechanic_unlock, relic_unlock |
| `audio_rest` | 5 | Rest site SFX: open, heal, study, meditate, card_removed |
| `audio_hub` | 4 | Hub SFX: welcome, start_run, button_library, button_settings |
| `audio_other` | 82 | All remaining SFX: relic triggers (8), map/navigation (6), mystery events (5), run lifecycle (11), surge (3), mastery (3), turn flow (7), rewards (8), rarity reveals (6), keeper NPC (4), tutorial (3), screen transitions (6), legacy mining sounds (12) |

Each entry has the shape:
```json
{
  "id": "filename_without_extension",
  "name": "Human Readable Name",
  "concept": "What this sound should feel like",
  "codeLocation": "service.ts:LINE (context)",
  "variants": [{ "variant": 0, "status": "done", "accepted": true }]
}
```

Loop entries additionally have `"needsReplacement": true`. No `prompt`, `targetWidth`, or `targetHeight` fields are used for audio entries (those are image-generation fields only).

---

## Ambient Loop Quality Standards (2026-04-01)

All ambient loop files MUST be real recordings or professional sound design. Web Audio synthesized loops are BANNED — they sound terrible when looped at short intervals. Even a 10-second synthesized loop creates obvious repetition artifacts; ambient atmosphere requires real recordings of 30+ seconds minimum.

### Quality Gate

| Requirement | Minimum | Notes |
|------------|---------|-------|
| Duration | ≥30 seconds | Ideally 60–120s for natural-feeling loops |
| File size | ≥200KB | Ensures a real recording, not a synthesis export |
| License | CC0 or equivalent | OpenGameArt, freesound (filter CC0), Pixabay Audio |
| Loop points | Clean | No audible pop or click at the boundary |
| Format | `.m4a` (AAC 128kbps+) | Never .ogg — Safari doesn't support it |
| Artstudio entry | Required | Add/update in `audio_loops` tab with source URL in concept field |
| needsReplacement flag | Clear | Set to `false` in `artstudio-items.json` once replaced |

All ambient loop curation goes through the artstudio `audio_loops` tab. Loops marked `needsReplacement: true` in `artstudio-items.json` are placeholders that must be replaced before ship.

### Conversion Command

```bash
# Convert a sourced recording to the correct format
ffmpeg -i source.wav -map 0:a:0 -c:a aac -b:a 128k loop_name.m4a
```

The `-map 0:a:0` flag strips any non-audio streams (cover art, video) that would cause Safari's decoder to reject the file.
