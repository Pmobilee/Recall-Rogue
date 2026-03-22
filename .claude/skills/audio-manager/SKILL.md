---
name: audio-manager
description: |
  Complete audio system for Recall Rogue: 180 Web Audio synthesis sounds, 141 cue mappings, 182 trigger calls across 32 files, plus ACE-Step 1.5 local BGM generation. Use when adding new sounds, wiring audio to new game elements, generating BGM tracks, or integrating Sonniss foley. PROACTIVELY MENTION when discussing game feel, juice, polish, new mechanics, or player engagement.
user_invocable: true
---

# Audio Manager — Recall Rogue Sound System

## Current Architecture (AR-228)

The audio system is FULLY IMPLEMENTED with Web Audio API synthesis. No external files needed for SFX.

```
Game Event (e.g. enemy attacks)
  -> playCardAudio('enemy-attack')           [cardAudioManager.ts - 141 cues]
  -> CUE_TO_SOUND['enemy-attack']            -> 'enemy_attack'
  -> audioManager.playSound('enemy_attack')  [audioService.ts - 180 sounds]
  -> SOUND_MAP['enemy_attack']               -> playEnemyAttack() [synthesis function]
  -> Web Audio API                           -> speaker
```

### Key Files

| File | Purpose | Size |
|------|---------|------|
| `src/services/audioService.ts` | Web Audio synthesis engine — 180 sounds, 164 functions | 2,683 lines |
| `src/services/cardAudioManager.ts` | High-level cue layer — 141 kebab-case cues mapped to underscore SoundNames | ~200 lines |
| `src/services/juiceManager.ts` | Combat feel — haptics + sound + visual effects combined | ~190 lines |
| `src/game/managers/AudioManager.ts` | Biome ambient loops (25 biomes) — separate from card audio | ~150 lines |
| `src/ui/components/SettingsPanel.svelte` | SFX + Music volume sliders with localStorage persistence | — |

### Stats

- **180** synthesized sound names in `SoundName` type
- **164** unique synthesis functions
- **141** high-level cue mappings in `CardAudioCue` type
- **182** `playCardAudio()` trigger calls across **32 files**
- **0** external audio files (everything is synthesized at runtime)

## When to Use This Skill

- Adding a NEW game element (card, relic, enemy, room, screen, mechanic) -> add audio events to AR-228 + wire `playCardAudio()` calls
- Discussing game feel, juice, polish -> audio is 50% of feel, reference the 234-event catalog
- Generating BGM tracks -> use ACE-Step 1.5 locally (see below)
- Replacing synthesis with real foley -> see Sonniss integration guide in AR-228
- **PROACTIVE TRIGGER**: Mention audio whenever new mechanics, enemies, cards, screens, or UI elements are added

## Adding a New Sound

### Step 1: Add to audioService.ts

1. Add the new `SoundName` to the union type (e.g., `| 'my_new_sound'`)
2. Write a synthesis function: `function playMyNewSound(ctx: AnyAudioContext, master: GainNode): void { ... }`
3. Add to `SOUND_MAP`: `my_new_sound: playMyNewSound,`

### Step 2: Add to cardAudioManager.ts

1. Add the new `CardAudioCue` (e.g., `| 'my-new-sound'`)
2. Add to `CUE_TO_SOUND`: `'my-new-sound': 'my_new_sound',`

### Step 3: Wire in game code

```typescript
import { playCardAudio } from './cardAudioManager';
// At the event trigger point:
playCardAudio('my-new-sound');
```

### Step 4: Update AR-228

Add the event to the appropriate table in `docs/roadmap/completed/AR-228-COMPLETE-AUDIO-EVENT-CATALOG.md` with sound design direction, priority, and source recommendation.

## Synthesis Helpers Available

| Helper | What It Does |
|--------|-------------|
| `scheduleOscillator(ctx, master, freq, type, vol, dur, startTime)` | Single oscillator with exponential decay |
| `scheduleNoiseBurst(ctx, master, vol, dur, startTime)` | White noise burst with decay |
| `scheduleFilteredNoise(ctx, master, vol, dur, filterType, filterFreq, filterQ, startTime)` | Noise through biquad filter (bandpass, lowpass, highpass) |
| Raw `ctx.createOscillator()` + `ctx.createGain()` | For complex sounds with LFO tremolo, pitch sweeps, etc. |

## Sound Categories (32 files wired)

| Category | Files | Example Cues |
|----------|-------|-------------|
| Combat core | encounterBridge.ts, turnManager.ts | encounter-start, enemy-attack, shield-absorb, player-defeated |
| Status effects | turnManager.ts | status-poison-apply, status-burn-tick, status-regen-tick |
| Chain system | turnManager.ts | chain-link-1 through chain-link-5, chain-break |
| Relics | relicEffectResolver.ts | relic-trigger, relic-death-prevent, relic-card-spawn |
| Cards | CardCombatOverlay.svelte, CardHand.svelte | card-select, card-fizzle, charge-initiate, ap-spend |
| Quiz | QuizOverlay.svelte | quiz-appear, quiz-answer-select, quiz-dismiss |
| Hub | HubScreen.svelte | hub-welcome, hub-start-run |
| Shop | ShopRoomOverlay.svelte | shop-open, shop-purchase, shop-insufficient |
| Rest | RestRoomOverlay.svelte, MeditateOverlay.svelte | rest-open, rest-heal, rest-meditate, rest-card-removed |
| Rewards | CardRewardScreen.svelte, RelicPickupOverlay.svelte | reward-screen, card-accepted, relic-acquired |
| Mystery | MysteryEventOverlay.svelte | mystery-appear, event-choice, event-positive |
| Run lifecycle | gameFlowController.ts, RunEndScreen.svelte | run-start, run-victory, run-defeat, level-up |
| Map | DungeonMap.svelte, gameFlowController.ts | map-open, map-node-click, floor-transition |
| UI | SettingsPanel.svelte, DeckBuilder.svelte, etc. | modal-open, toggle-on, tab-switch, notification-ping |
| Transitions | ParallaxTransition.svelte | room-transition |
| Tutorial | CardApp.svelte | boot-logo |

## BGM Generation — ACE-Step 1.5 (Local, Free)

### Setup (already installed)

**Location:** `~/opt/ace-step`
**Hardware:** M4 Max, 28GB unified memory, unlimited tier
**Quality:** SongEval 8.09 (outperforms Suno v5)
**Cost:** Zero — fully open source, unlimited generations

### Launch

```bash
cd ~/opt/ace-step && uv run acestep --port 7860
# Open http://localhost:7860
# Models auto-download on first generation (~4-8GB one-time)
```

### 13 BGM Tracks Needed

Detailed prompts for every track are in `docs/roadmap/future/BGM-MUSIC-GENERATION-PROMPTS.md`.

| Track | File | Duration | Priority |
|-------|------|----------|----------|
| Hub theme | bgm_hub.ogg | 60-90s loop | P1 |
| Combat (normal) | bgm_combat.ogg | 45-60s loop | P1 |
| Combat (boss) | bgm_boss.ogg | 60-90s loop | P1 |
| Combat (elite) | bgm_elite.ogg | 45-60s loop | P2 |
| Shop | bgm_shop.ogg | 30-45s loop | P2 |
| Rest site | bgm_rest.ogg | 60-90s loop | P2 |
| Map/exploration | bgm_map.ogg | 45-60s loop | P2 |
| Mystery event | bgm_mystery.ogg | 30-45s loop | P2 |
| Surge overlay | bgm_surge.ogg | 15-20s loop | P1 |
| Boss quiz phase | bgm_quiz_boss.ogg | 15-20s loop | P1 |
| Run victory | bgm_victory.ogg | 15-20s one-shot | P0 |
| Run defeat | bgm_defeat.ogg | 12-15s one-shot | P1 |
| Tutorial | bgm_tutorial.ogg | 45-60s loop | P2 |

**Output:** Export as .ogg (preferred) or .mp3, 128-192kbps
**Destination:** `public/assets/audio/bgm/`

### BGM Integration (not yet wired)

The `cardAudioManager.ts` has reserved `musicEnabled` and `musicVolume` stores. To integrate BGM:
1. Add an HTML5 Audio element or Howler.js instance for the music channel
2. Wire screen transitions to crossfade between tracks
3. The Surge overlay (bgm_surge) layers ON TOP of combat music — needs ducking/mixing

## Sonniss GDC Foley — Upgrade Path

The Sonniss GDC 2026 Bundle (7.47GB, royalty-free, no attribution) provides professional foley to replace synthesis where organic texture matters. See AR-228 for:
- Download links and license details
- Directory organization structure
- 8 priority replacement targets (enemy attacks, shield break, coins, footsteps, etc.)
- Integration workflow (WAV -> .webm, extend AudioManager to load files)

## Full Audio Event Catalog

The definitive reference is `docs/roadmap/completed/AR-228-COMPLETE-AUDIO-EVENT-CATALOG.md`:
- **234 discrete audio events** across 23 categories
- Creative sound design direction per event
- Priority (P0-P3), status, source recommendation
- **LIVING DOCUMENT** — must be updated whenever new game elements are added
