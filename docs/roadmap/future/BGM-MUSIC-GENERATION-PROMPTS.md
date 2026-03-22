# Background Music — AI Generation Prompts

**For:** Damion (manual task, not automated)
**Output:** .ogg or .mp3, 128-192kbps
**Destination:** `public/assets/audio/bgm/`
**Naming:** `bgm_hub.ogg`, `bgm_combat.ogg`, `bgm_boss.ogg`, etc.

---

## Tool Recommendations (researched March 2026)

### Best Option: ACE-Step 1.5 (Open Source, Local)

**This is installed locally on this machine** at `/opt/ace-step`. It runs on your MacBook's GPU.

| Detail | Value |
|--------|-------|
| Quality | SongEval **8.09** — outperforms Suno v5 on the standard benchmark |
| Speed | ~30-60s per song on MacBook (MPS backend), ~15s on RTX 3060 |
| VRAM | Under 4GB needed (your Mac has plenty) |
| Languages | 50+ languages |
| Features | Lyrics, vocals, style control, cover generation, vocal-to-BGM, LoRA fine-tuning |
| License | Open source, fully local, unlimited generations, zero cost |
| Repo | [github.com/ace-step/ACE-Step-1.5](https://github.com/ace-step/ACE-Step-1.5) |
| UI | [github.com/fspecii/ace-step-ui](https://github.com/fspecii/ace-step-ui) — Spotify-like interface |

**To generate a track:**
```bash
cd /opt/ace-step
source venv/bin/activate
python generate.py --prompt "your prompt here" --output public/assets/audio/bgm/bgm_hub.ogg
```
Or use the Gradio UI: `python app.py` then open `http://localhost:7860`

### Commercial Services (if you want to compare)

#### S-Tier

| Service | Best For | Quality | Free Tier | Why Use It |
|---------|----------|---------|-----------|------------|
| **[Suno v4.5](https://suno.com)** | Overall best, fastest | 9/10 | 10 songs/day (non-commercial) | Best vocal naturalness, most consistent. 60-70% of generations are usable. Pro: $10/mo for commercial rights. |
| **[Udio](https://www.udio.com)** | Highest fidelity | 9.5/10 fidelity | Similar to Suno | Only 3/10 listeners could tell it was AI. Best for electronic/complex genres. Stem downloads for mixing. |

#### A-Tier

| Service | Best For | Price | Why Use It |
|---------|----------|-------|------------|
| **[AIVA](https://www.aiva.ai)** | Orchestral/cinematic | $15-49/mo | Purpose-built for game soundtracks. Full copyright on Pro. **Best for boss battle + victory fanfare.** |
| **[ElevenLabs Music](https://elevenlabs.io)** | Vocal realism | API-based | Unmatched vocal quality. Weaker on instrumentals. |
| **[Soundverse](https://www.soundverse.ai)** | Seamless loops | Freemium | Dedicated Loop Mode for game music. Best loop tooling of any service. |
| **[Beatoven.ai](https://www.beatoven.ai)** | Royalty-free | Freemium | All output pre-cleared for commercial use. |

#### Other Open Source Options

| Model | Quality | Notes |
|-------|---------|-------|
| **[HeartMuLa 7B](https://github.com/HeartMuLa/heartlib)** | Comparable to Suno | Best lyric clarity of any model (lowest Phoneme Error Rate). 4B params. Great for multilingual. |
| **Meta MusicGen** | Good instrumental | MIT-licensed, established but older. Good for ambient/background, weaker on full songs. |

### Recommended Workflow

1. **Generate with ACE-Step locally** — unlimited iterations, zero cost, benchmark-beating quality
2. **A/B test your favorites against Suno** — use Suno's free tier (10/day) to compare
3. **For orchestral tracks (boss, victory)** — try AIVA if ACE-Step's orchestral output isn't cinematic enough
4. **Fatigue test** — loop each track for 5 minutes. If it gets annoying, regenerate.
5. **Layer test** — play the Surge overlay ON TOP of combat music. Do they harmonize?

---

## How to use these prompts

1. Pick a track below
2. Copy the prompt into your AI music tool of choice
3. Generate 3-5 variations
4. Listen to each — pick the one that *feels* right for the game moment
5. If none are perfect, tweak the prompt (adjust tempo, key, instruments, mood words)
6. Export as .ogg (preferred) or .mp3 at 128-192kbps
7. Drop the file into `public/assets/audio/bgm/` with the filename shown
8. The BGM system in `cardAudioManager.ts` has a reserved music channel ready to wire

### Tips for better results
- **Loop tracks:** Tell the AI "must loop seamlessly" AND "end on the same chord it begins with"
- **One-shot tracks:** These DON'T loop — they play once (victory fanfare, defeat reflection)
- **Layering:** The Surge overlay (Track 9) plays ON TOP of combat music — generate it in a compatible key
- **Fatigue test:** For combat music, listen to it on repeat for 5 minutes. If it gets annoying, it's wrong.
- **A/B test:** Play the game with the track running in another tab. Does it match the pixel art aesthetic?

---

## Track 1: Hub Theme ("The Camp")
**File:** `bgm_hub.ogg` | **Duration:** 60-90s loop | **Priority:** P1

```
Create a cozy, warm medieval camp theme for a pixel art card roguelite game.
Acoustic guitar fingerpicking as the lead melody, gentle hand percussion
(cajon or frame drum), soft plucked lute arpeggios. Add subtle crackling
fire ambience underneath. The mood is "safe haven after adventure" —
nostalgic, peaceful, inviting. Think Stardew Valley meets a quiet tavern.
Key of C major or G major. Tempo 85-95 BPM. Must loop seamlessly. No
vocals. Warm, lo-fi production with gentle reverb. End on the same chord
it begins with for perfect looping.
```

**What to listen for:** Does it make you want to sit by a fire? Does it feel like home? If it's too busy or energetic, regenerate with "more sparse, more breathing room."

---

## Track 2: Combat Theme (Normal Encounters)
**File:** `bgm_combat.ogg` | **Duration:** 45-60s loop | **Priority:** P1

```
Create a tense, driving combat theme for a pixel art card roguelite.
Rhythmic string ostinato (fast 16th notes) as the foundation, layered
with punchy war drums and taiko hits on the downbeats. Add a heroic but
restrained brass melody that repeats every 8 bars — French horn or
trumpet, not full orchestra. The feel is "focused determination" — urgent
but controlled, like a chess match with swords. Key of D minor. Tempo
130-140 BPM. Must loop seamlessly after 45-60 seconds. No vocals. The
energy level should be sustainable over 15-20 repeated encounters without
listener fatigue — avoid being too bombastic. Subtle dynamic variation
within the loop.
```

**What to listen for:** Can you hear this 20 times without wanting to mute it? Is it tense but not exhausting? The strings should drive forward, the brass should feel heroic but not overwhelming. If it's too intense, add "more restrained, less bombastic" to the prompt.

---

## Track 3: Combat Theme (Boss Battle)
**File:** `bgm_boss.ogg` | **Duration:** 60-90s loop | **Priority:** P1

```
Create an epic, intense boss battle theme for a pixel art card roguelite
game. Full orchestral arrangement: pounding timpani and taiko drums in
relentless 4/4, aggressive low brass (trombones, tubas) playing a
menacing motif, fast string tremolo creating urgency, and a soaring choir
("ah" vowels, not words) that enters at the climax. The feel is "this
enemy is different — everything is at stake." Key of C minor or Bb minor.
Tempo 150-160 BPM. Must loop seamlessly. Include a 4-bar buildup section
that creates a sense of escalation each loop. Add a brief 2-bar
"breathing room" with just strings before the drums crash back in. No
vocals. Cinematic, dramatic, terrifying but empowering — the player
should feel like a hero facing their greatest challenge.
```

**What to listen for:** Do you feel your heart rate go up? Is there a moment where the tension breaks briefly before crashing back? That breathing room is crucial — without it, the track becomes a wall of noise. The choir should feel like fate itself is watching.

---

## Track 4: Combat Theme (Elite Encounter)
**File:** `bgm_elite.ogg` | **Duration:** 45-60s loop | **Priority:** P2

```
Create a menacing elite enemy combat theme for a pixel art card roguelite.
Darker and more threatening than standard combat, but less grand than a
boss theme. Heavy, distorted low strings playing a chromatic descending
riff. Aggressive snare rolls and military-style percussion. A warning
bell or gong hit every 8 bars. Sinister woodwinds (bass clarinet or
contrabassoon) weaving between the string hits. The feel is "this enemy
is dangerous — stay sharp." Key of F# minor. Tempo 140-145 BPM. Must
loop seamlessly. No vocals. Think Dark Souls mini-boss energy but in a
16-bit aesthetic.
```

**What to listen for:** It should feel *darker* than normal combat but *smaller* than boss. The gong every 8 bars is a warning pulse. If it sounds too similar to Track 2, push harder on the chromatic/dissonant elements.

---

## Track 5: Shop Theme ("The Merchant")
**File:** `bgm_shop.ogg` | **Duration:** 30-45s loop | **Priority:** P2

```
Create a playful, quirky merchant shop theme for a pixel art card
roguelite. Plucked strings (pizzicato or mandolin) playing a bouncy,
mischievous melody. Light hand claps and finger snaps as percussion. A
recorder or tin whistle adding playful countermelody. Occasional
coin-jingle sound effects woven into the rhythm. The mood is "a charming
trickster wants your gold" — lighthearted, commercial, slightly cheeky.
Key of F major or Bb major. Tempo 110-120 BPM. Must loop seamlessly. No
vocals. Think of a medieval marketplace with a winking shopkeeper. Warm,
inviting, makes you want to browse.
```

**What to listen for:** Does it make you smile? Does it feel like spending gold would be *fun*? The melody should be catchy but not annoying on loop. The coin jingles should be subtle, not literal.

---

## Track 6: Rest Site Theme ("The Campfire")
**File:** `bgm_rest.ogg` | **Duration:** 60-90s loop | **Priority:** P2

```
Create a deeply peaceful rest site theme for a pixel art card roguelite.
Slow, gentle piano as the lead — simple, spacious chords with lots of
sustain pedal. Soft ambient pads creating a warm bed of sound underneath.
Distant wind and very subtle nature sounds (not literal — suggested
through reverb and texture). An occasional solo cello playing a tender,
melancholic phrase. The mood is "you survived — rest now." Key of Eb
major or Ab major. Tempo 60-70 BPM. Must loop seamlessly. No vocals.
This should feel like emotional relief — the tension of combat is gone,
replaced by warmth and safety. Slightly bittersweet, like remembering
what you're fighting for. Minimal arrangement — space and silence are
part of the music.
```

**What to listen for:** Close your eyes. Do you feel your shoulders drop? Does the tension leave your body? The silences between piano notes matter as much as the notes themselves. If it feels cluttered, regenerate with "more minimal, more space between notes."

---

## Track 7: Map/Exploration Theme ("The Journey")
**File:** `bgm_map.ogg` | **Duration:** 45-60s loop | **Priority:** P2

```
Create an adventurous exploration theme for a pixel art card roguelite
dungeon map screen. Light, steady march percussion (snare rim clicks,
soft kick drum). A solo flute playing a curious, wandering melody that
rises and falls like a path through hills. Gentle string pad providing
harmonic support. Occasional harp glissandos suggesting discovery. The
mood is "the unknown awaits, and it's exciting." Key of A major or E
major. Tempo 100-110 BPM. Must loop seamlessly. No vocals. Not
combat-tense, not camp-relaxed — the energy is forward-moving,
adventurous, optimistic with a hint of uncertainty. Think Legend of Zelda
overworld but smaller scale, more intimate.
```

**What to listen for:** Does it make you want to pick a path and go? The flute should wander — not march in a straight line. The harp glissandos should feel like "oh, what's over there?" moments.

---

## Track 8: Mystery Event Theme ("The Enigma")
**File:** `bgm_mystery.ogg` | **Duration:** 30-45s loop | **Priority:** P2

```
Create an enigmatic, slightly unsettling mystery event theme for a pixel
art card roguelite. A music box melody playing a simple but off-kilter
tune — notes slightly detuned or in an unusual mode (Lydian or whole tone
scale). Ethereal ambient pads with heavy reverb creating a dreamlike
space. Subtle reversed cymbal swells. Very quiet, distant wind. The mood
is "something strange is happening — it could be wonderful or terrible."
Key of D Lydian or Bb whole tone. Tempo 75-85 BPM. Must loop seamlessly.
No vocals. Think of opening a mysterious chest in a dark room — curiosity
mixed with slight unease. Sparse, atmospheric, more about texture than
melody.
```

**What to listen for:** Does it feel *weird* but not scary? The music box should be slightly off — like a dream you can't quite remember. If it's too creepy, add "more curious, less horror" to the prompt.

---

## Track 9: Surge Turn Overlay ("Knowledge Surge")
**File:** `bgm_surge.ogg` | **Duration:** 15-20s loop | **Priority:** P1

```
Create a powered-up, golden energy overlay theme for a card game's
special ability turn. This plays ON TOP of the combat music, so it must
be in a compatible key. Shimmering synthesizer arpeggios cascading
upward. A pulsing, warm bass synth providing energy. Bright, metallic
percussion hits (like striking gold). The mood is "unlimited power for a
brief moment" — euphoric, electric, time-limited urgency. Key of A major
(to layer over D minor combat). Tempo must match combat at 130-140 BPM.
Duration 15-20 seconds, loops seamlessly. No vocals. Think of a power-up
star from Mario but reimagined as golden arcane energy. Bright, fast,
intoxicating.
```

**What to listen for:** Play this OVER Track 2 simultaneously. Do they clash or harmonize? A major over D minor creates a Mixolydian shimmer — it should feel like the combat music got gilded. If they clash, try E major or D major instead.

---

## Track 10: Boss Quiz Phase ("The Trial")
**File:** `bgm_quiz_boss.ogg` | **Duration:** 15-20s loop | **Priority:** P1

```
Create a tense, clock-ticking quiz pressure theme for a card roguelite
boss encounter. The combat music has paused — this replaces it. A steady,
metronomic tick (not a literal clock — more like a dampened wood block or
muted string pluck) at 120 BPM. Sustained, dissonant string chords
creating unbearable tension. Very quiet, breathy flute playing a single
held note that slowly bends upward. The mood is "this question determines
everything." Key of C minor. Must loop seamlessly at 15-20 seconds. No
vocals. Minimalist — the silence between the ticks is as important as the
sound. Think of defusing a bomb in a movie. The player's mind should
race.
```

**What to listen for:** Does time feel like it's slowing down? The tick should be hypnotic, not annoying. The dissonant strings should make you uncomfortable but not distracted. Less is more here — if it's too busy, strip elements out.

---

## Track 11: Run Victory ("Triumph")
**File:** `bgm_victory.ogg` | **Duration:** 15-20s ONE-SHOT (does NOT loop) | **Priority:** P0

```
Create a triumphant victory fanfare for completing a dungeon run in a
pixel art card roguelite. Structure: Start with a single, pure French
horn note held for 2 seconds (the relief). Then a full orchestra swells
in — ascending major scale in the brass, rapid string runs, crashing
cymbals, thundering timpani. At the peak (8-10 seconds), a soaring
trumpet melody plays the "hero theme" — 4 memorable notes that feel like
destiny fulfilled. The final 5 seconds wind down to warm strings and a
gentle harp arpeggio resolving to the tonic. Key of Bb major or C major.
The emotion arc is: relief (2s) -> building joy (5s) -> TRIUMPH (5s) ->
warm satisfaction (5s). No vocals. This is the single most emotionally
powerful music in the entire game. The player just conquered the dungeon.
Make them feel like a legend.
```

**What to listen for:** Do you get goosebumps? This is THE moment. The French horn at the start should make you exhale with relief. The trumpet peak should make you pump your fist. The harp at the end should make you smile. If you don't feel anything, regenerate until you do. This track is worth spending extra time on.

---

## Track 12: Run Defeat ("Reflection")
**File:** `bgm_defeat.ogg` | **Duration:** 12-15s ONE-SHOT (does NOT loop) | **Priority:** P1

```
Create a gentle, reflective defeat theme for dying in a pixel art card
roguelite. Solo piano only. Start with a simple, descending minor phrase
— 4 notes, played slowly with full sustain pedal. Pause. Then repeat the
phrase one step lower, even softer. End with a single major chord that
resolves the tension — a tiny glimmer of hope. The mood is NOT punishment
or sadness — it's "that was a worthy attempt, and you learned something."
Key of A minor resolving to C major at the end. Tempo rubato (free time),
roughly 60 BPM. Duration 12-15 seconds, one-shot. No vocals. Think of a
wise mentor gently saying "try again." Respectful, dignified,
encouraging. The player should feel motivated to start another run, not
discouraged.
```

**What to listen for:** Does it make you want to try again? The final major chord is everything — it's the "but next time..." that keeps players coming back. If the track makes you feel bad, it's wrong. It should feel like a warm hand on your shoulder.

---

## Track 13: Onboarding/Tutorial ("Welcome")
**File:** `bgm_tutorial.ogg` | **Duration:** 45-60s loop | **Priority:** P2

```
Create a bright, encouraging tutorial theme for a pixel art card
roguelite. Gentle marimba or xylophone playing a simple, catchy melody —
think of a music box but warmer. Soft acoustic guitar strumming quarter
notes. Light, bouncy percussion (shaker, soft kick). Occasional bright
chime accents on important moments. The mood is "welcome to something
wonderful — let me show you." Key of C major or G major. Tempo 95-105
BPM. Must loop seamlessly. No vocals. Simpler and brighter than the hub
theme — this is the very first music new players hear. It should feel
safe, inviting, and gently exciting. Not childish — warm and genuine.
Think of the opening moments of a Miyazaki film.
```

**What to listen for:** Would a brand new player feel welcomed? Not overwhelmed, not bored — gently excited. The marimba should feel like tiny discoveries. If it sounds like a children's show, push toward "more sophisticated, Miyazaki warmth."

---

## Generation Order (recommended)

Do these first — they're heard the most:

1. **Track 2 — Combat (normal)** — heard every single encounter
2. **Track 1 — Hub** — heard every time you return home
3. **Track 11 — Victory** — the emotional payoff (worth extra iterations)
4. **Track 12 — Defeat** — the motivational moment
5. **Track 3 — Boss** — the big moments
6. **Track 9 — Surge** — must harmonize with Track 2
7. **Track 10 — Boss Quiz** — must contrast with Track 3

Then fill in the rest:

8. Track 6 — Rest
9. Track 7 — Map
10. Track 5 — Shop
11. Track 4 — Elite
12. Track 8 — Mystery
13. Track 13 — Tutorial
