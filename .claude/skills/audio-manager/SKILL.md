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

## BGM Generation — ACE-Step 1.5 Deep Dive

### Installation & Setup

**Location:** `~/opt/ace-step`
**Hardware:** M4 Max, 36GB RAM, 28GB unified GPU memory, unlimited tier
**Precision:** `torch.float32` on MPS (highest quality — no quantization on Mac)
**Cost:** Zero — fully open source, unlimited generations

### Available Models (all downloaded)

| DiT Model | Steps | CFG | Quality | Speed | Best For |
|-----------|-------|-----|---------|-------|----------|
| `acestep-v15-turbo` | 8 | No | Good | Fastest | Rapid prototyping, iteration |
| **`acestep-v15-sft`** | 50 | Yes | **High** | 6x slower | **Final quality renders** |
| `acestep-v15-base` | 50 | Yes | Medium | 6x slower | Extract, lego, complete tasks; LoRA fine-tuning base |

| LM Model | Speed | World Knowledge | Memory | Best For |
|----------|-------|-----------------|--------|----------|
| `acestep-5Hz-lm-0.6B` | Fast | Basic | Weak | Low VRAM, rapid prototyping |
| `acestep-5Hz-lm-1.7B` | Medium | Medium | Medium | Default recommendation |
| **`acestep-5Hz-lm-4B`** | Slow | **Rich** | **Strong** | **Complex tasks, highest quality** |

**Community-created merged model** also exists: `acestep_v1.5_merge_sft_turbo_ta_0.5.safetensors` from [Aryanne/acestep-v15-test-merges](https://huggingface.co/Aryanne/acestep-v15-test-merges) — less distortion, higher overall sound quality, fewer wrong notes. Uses 22 steps with `er_sde` sampler and `beta57` scheduler.

### Launch Commands

```bash
# HIGHEST QUALITY (SFT + 4B LM) — use for final renders
cd ~/opt/ace-step && uv run acestep --port 7860 --checkpoint acestep-v15-sft --lm_model_path acestep-5Hz-lm-4B

# FAST ITERATION (Turbo + 1.7B LM) — use for exploring ideas
cd ~/opt/ace-step && uv run acestep --port 7860

# Open http://localhost:7860 in browser
```

### ULTRA HIGH QUALITY Settings — No Distortion

These are the **absolute optimal parameters** for maximum quality instrumental game BGM, researched from official docs, GitHub discussions, HuggingFace community, and the ACE-Step musician's guide.

#### DiT Model: `acestep-v15-sft`

The SFT model is the ONLY choice for maximum quality because:
- Supports CFG (Classifier-Free Guidance) — turbo does NOT
- 50 denoising steps gives the model far more time to refine audio
- Better detail expression and semantic parsing than turbo
- The developer states: "audio clarity may be slightly inferior to Turbo" but "detail expression and semantic parsing will be better" — for game BGM, detail matters more than raw clarity

#### LM Model: `acestep-5Hz-lm-4B`

The 4B model has the richest world knowledge, strongest memory, and best performance on complex/rare styles. For game soundtrack orchestral work, this matters.

#### Optimal Generation Parameters

| Parameter | Optimal Value | Why |
|-----------|--------------|-----|
| **DiT model** | `acestep-v15-sft` | Only model supporting CFG; 50-step refinement |
| **LM model** | `acestep-5Hz-lm-4B` | Best composition capability |
| **inference_steps** | `50` (default for SFT) | More steps = more refinement. Going above 65 degrades quality. |
| **guidance_scale (CFG)** | `5.0-6.0` | Controls prompt adherence. Above 6.0 quality degrades significantly. 5.0 is safest for clean output. |
| **cfg_interval_start** | `0.0` | Apply text guidance from the very start of diffusion |
| **cfg_interval_end** | `0.75` | Drop guidance at the end for more natural finishing. 0.75-0.85 is the sweet spot. |
| **shift** | `3.0` | Timestep shift factor. Higher = stronger semantics, clearer framework. 3.0 is the recommended value. |
| **infer_method** | `"ode"` | Euler solver — deterministic, cleaner output. Use `"sde"` only if you want variance/randomness. |
| **thinking** | `True` | Enable LM Chain-of-Thought planning — better song structure |
| **use_cot_metas** | `True` | Let LM infer BPM, key, duration automatically |
| **use_cot_caption** | `True` | Let LM refine and expand your caption |
| **lm_temperature** | `0.7` | Lower than default (0.85) for more conservative, consistent output |
| **lm_top_p** | `0.9` | Nucleus sampling — keeps output diverse but coherent |
| **lm_cfg_scale** | `2.0` | LM guidance — default is fine |
| **instrumental** | `True` | No vocals for game BGM |
| **lyrics** | `"[Instrumental]"` | Explicit instrumental marker |
| **batch_size** | `4` | Generate 4 variations, pick the best |
| **audio_format** | `"flac"` | Lossless output — convert to .ogg later |

#### Precision Notes

On your M4 Max with MPS backend:
- **dtype is `torch.float32`** — full 32-bit precision. This is the HIGHEST quality path.
- **No quantization** — `int8_weight_only`, `fp8_weight_only`, and `w8a8_dynamic` are all disabled on Mac (torchao incompatible with MPS)
- **MLX backend** for LM — native Apple Silicon acceleration
- **No compile** — `torch.compile` disabled on Mac (not supported)

This means your Mac runs at full precision with zero quality loss from quantization. The tradeoff is speed (slower than CUDA with quantization), but quality is maximum.

#### What Causes Distortion (and how to avoid it)

| Problem | Cause | Fix |
|---------|-------|-----|
| Crunchy/crusty audio | CFG too high (>7) | Lower guidance_scale to 5.0-6.0 |
| Muddled/incoherent structure | Shift too low (<2) | Raise shift to 3.0 |
| Vocal artifacts on instrumental | Model trying to add vocals | Set `instrumental=True` + `lyrics="[Instrumental]"` |
| Repetitive/boring output | LM temperature too low | Raise lm_temperature to 0.85 |
| Wrong style/genre | Caption too vague | Be specific: combine genre + mood + instruments + timbre |
| Conflicting styles | Caption has contradictions | Remove contradictions; use temporal evolution instead |
| Quality degrades with high steps | Error accumulation >65 steps | Keep inference_steps at 50 (SFT default) |

### Python API — Generate Programmatically

For batch generation or scripting, use the Python API directly:

```python
import sys
sys.path.insert(0, '/Users/damion/opt/ace-step')

from acestep.handler import AceStepHandler
from acestep.llm_inference import LLMHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music

# Initialize handlers
dit = AceStepHandler()
llm = LLMHandler()

# Initialize with HIGHEST QUALITY settings
dit.initialize_service(
    project_root="/Users/damion/opt/ace-step",
    config_path="acestep-v15-sft",  # SFT for CFG support + 50 steps
    device="mps"                    # Apple Silicon — runs at float32
)

llm.initialize(
    checkpoint_dir="/Users/damion/opt/ace-step/checkpoints",
    lm_model_path="acestep-5Hz-lm-4B",  # Strongest planner
    backend="mlx",                        # Native Apple Silicon
    device="mps"
)

# Configure for ULTRA HIGH QUALITY instrumental game BGM
params = GenerationParams(
    task_type="text2music",
    caption="cozy warm medieval camp theme, acoustic guitar fingerpicking, gentle cajon, plucked lute arpeggios, crackling fire ambience, nostalgic peaceful, C major, game soundtrack, high fidelity, studio quality",
    lyrics="[Instrumental]",
    instrumental=True,
    bpm=90,
    keyscale="C Major",
    timesignature="4",
    duration=75,                    # 75 seconds for a good loop length
    inference_steps=50,             # SFT default — max quality
    guidance_scale=5.5,             # Sweet spot: adherent but not harsh
    cfg_interval_start=0.0,         # Apply guidance from start
    cfg_interval_end=0.75,          # Drop at end for natural finish
    shift=3.0,                      # Strong semantic framework
    infer_method="ode",             # Deterministic Euler — cleaner
    thinking=True,                  # Enable LM planning
    use_cot_metas=True,
    use_cot_caption=True,
    lm_temperature=0.7,             # Slightly conservative
    lm_top_p=0.9,
    vocal_language="unknown",
)

config = GenerationConfig(
    batch_size=4,                   # Generate 4 variations
    audio_format="flac",            # Lossless — convert to ogg later
)

# Generate
result = generate_music(dit, llm, params, config,
    save_dir="/Users/damion/CODE/Recall_Rogue/public/assets/audio/bgm")

if result.success:
    for audio in result.audios:
        print(f"Generated: {audio['path']} (seed: {audio['params']['seed']})")
else:
    print(f"Error: {result.error}")
```

### Caption Writing Tips (from official musician's guide)

For game BGM specifically:

1. **Be specific** — "sad piano ballad" works worse than "melancholic solo piano, spacious chords, sustain pedal, gentle, cinematic, studio quality, game soundtrack"
2. **Combine dimensions** — style + emotion + instruments + timbre + era + production style
3. **Use texture words** — warm, crisp, airy, punchy, lush, raw, polished influence mixing
4. **Add "game soundtrack"** — anchors the model toward loopable, non-fatiguing output
5. **Add "high fidelity" or "studio quality"** — pushes toward cleaner production
6. **For loops** — add "seamless loop, end on same chord as beginning"
7. **For pixel art games** — add "retro" or "chiptune-influenced" if you want that aesthetic

### 13 BGM Tracks Needed

Detailed copy-paste prompts: `docs/roadmap/future/BGM-MUSIC-GENERATION-PROMPTS.md`

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

**Output:** Export as FLAC (lossless), then convert: `ffmpeg -i track.flac -c:a libvorbis -q:a 5 bgm_hub.ogg`
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
