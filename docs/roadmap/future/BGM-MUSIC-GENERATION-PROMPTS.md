# Background Music — AI Generation Prompts

**For:** Damion (generate via Suno free tier)
**Output:** .ogg or .mp3
**Destination:** Drop all files in a single folder, agent will sort them into the correct structure
**Naming:** Use the track title as filename (e.g. `awakening_of_the_deep.ogg`)

---

## Music System — Two Playlists

The game has a **music mode selector** in the top-left corner showing the current track title with next/previous buttons and two playlist modes:

| Mode | Vibe | When to Use |
|------|------|-------------|
| **EPIC** | Intense, dynamic, battle-forward | Default for combat-heavy players who want adrenaline |
| **QUIET** | Lo-fi, chill, soft dungeon vibes | For players who want to focus on the quiz/strategy |

> **Ambient mode** uses layered SFX loops instead of music — see `SFX-SOUND-GENERATION-PROMPTS.md` § Ambient Atmosphere Recipes.

Each mode has its own playlist of ~20 tracks that plays continuously through the entire dungeon run. The player picks their vibe and the music stays in that lane.

**Stings** (victory, defeat, boss entrance) play as one-shots over any playlist.

### File Structure
```
public/assets/audio/bgm/
  epic/           — 20 intense dungeon tracks
  quiet/          — 20 lo-fi soft dungeon tracks
  stings/         — victory, defeat, boss entrance
```

---

# EPIC PLAYLIST (20 tracks)

High energy, dynamic arcs, battle-forward. The default experience. Starts atmospheric, builds to intense combat peaks, pulls back. Castlevania/Mega Man energy.

---

### E01: "Awakening of the Deep"

```
Dark NES dungeon crawler soundtrack, pure 8-bit chiptune, authentic NES 2A03 sound chip four-channel limitation, DYNAMIC ARC STRUCTURE: begins with single lonely pulse wave playing sparse minor-key notes over silence and distant noise channel dripping water, triangle wave bass enters slowly with deep sustained root notes, tension builds over 40 seconds as second pulse wave adds arpeggiated counter-melody, noise channel evolves from ambient drips to driving percussion, at the 60 second mark FULL INTENSITY — both pulse waves in aggressive unison playing driving battle melody with fast arpeggiated runs, triangle bass pumping relentless eighth notes, noise channel pounding kick-snare pattern, then at 90 seconds pulls back to atmospheric tension again, dark medieval dungeon crawler, the journey from exploration to combat and back, Castlevania atmosphere into Mega Man intensity, lo-fi bitcrushed warmth, detuned pulse wave vibrato, Famicom-era dark fantasy RPG, retro 8-bit game soundtrack
```

### E02: "Flickering Resolve"

```
NES dark dungeon theme with dynamic intensity arc, pure 8-bit chiptune, authentic NES 2A03 four-channel composition, starts with gentle melancholic pulse wave melody over quiet triangle wave bass pedal tone, noise channel faint crackling torches, mood is weary exploration through stone corridors, gradually introduces rhythmic pulse from second pulse wave, bass line becomes more active walking pattern, noise channel adds hi-hat, energy builds steadily like approaching danger, peaks into urgent aggressive minor-key battle section with both pulse waves playing fast interlocking arpeggios, heavy noise channel percussion, then dissolves back to single pulse wave and silence, desperate survival in the dark depths, Castlevania meets early Final Fantasy dungeon energy, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### E03: "The Abyss Answers"

```
NES dungeon descent epic build, pure 8-bit chiptune, authentic NES 2A03 sound chip four-channel limitation, opens with ominous low triangle wave bass playing slow descending chromatic line, single pulse wave playing detuned held notes with heavy vibrato creating dread, noise channel with sparse metallic ticks like distant chains, second pulse wave enters with chromatic ascending counter-motif building tension, rhythm intensifies — noise channel transitions to double-time military snare, both pulse waves lock into aggressive unison playing the most intense battle melody in a dark minor key, bass doing octave jumps, the full fury peaks for 30 seconds then DROPS to single bass note ringing in silence, dark medieval dungeon crawler boss-level intensity crescendo, Ninja Gaiden meets Castlevania III, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### E04: "Iron Will"

```
Intense NES battle theme, 140-150 BPM, pure 8-bit chiptune, aggressive pulse wave lead carrying a driving minor-key melody with fast arpeggiated runs, second pulse wave channel playing counter-melody staccato stabs, triangle wave bass pumping relentless eighth notes, noise channel providing tight hi-hat patterns and punchy snare hits, no real instruments, authentic NES 2A03 sound chip four-channel limitation, dark dungeon crawler card combat, urgent determined focused, sustainable over many repeated encounters without listener fatigue, not bombastic just relentless forward momentum, duty cycle modulation on lead pulse for timbral variation, D minor, pixel art roguelite turn-based card battle, retro 8-bit game soundtrack, Castlevania meets Mega Man energy, Famicom-era action RPG
```

### E05: "The Hunt"

```
NES dark chase combat theme, 145 BPM, pure 8-bit chiptune, lead pulse wave playing chromatic descending riff that repeats with growing intensity, second pulse wave dissonant sustained drones shifting beneath, triangle wave bass with heavy deliberate root notes creating oppressive gravity, noise channel aggressive snare rolls, authentic NES 2A03 four-channel limitation, something is hunting you through the dungeon, urgent and threatening, F# minor with tritone intervals, duty cycle shifts for timbral darkness, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG, Ninja Gaiden intensity
```

### E06: "Arcane Blades"

```
NES magical combat theme, 135 BPM, pure 8-bit chiptune, lead pulse wave playing mysterious arpeggiated melody that mixes minor key darkness with unexpected major intervals for magical quality, second pulse wave rapid tremolo creating shimmering arcane texture, triangle wave bass with syncopated rhythm suggesting arcane energy, noise channel with precise hi-hat keeping mechanical time, authentic NES 2A03 four-channel limitation, card-based magical combat in a dungeon, knowledge is your weapon, D minor with Dorian mode for mystical color, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### E07: "Blood on the Flagstones"

```
NES brutal dungeon combat theme, 150 BPM, pure 8-bit chiptune, both pulse waves playing aggressive interlocking riffs in E minor, heavy noise channel kick-snare pattern on every beat, triangle wave bass with octave jumps creating violent energy, the hardest fight you've ever had, frantic and desperate, no breathing room just pure combat intensity, duty cycle at maximum harshness, authentic NES 2A03 four-channel limitation, pixel art roguelite life-or-death encounter, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG, Contra final stage energy
```

### E08: "Warden's March"

```
NES boss approach theme with building arc, pure 8-bit chiptune, starts with slow menacing triangle wave bass march rhythm alone for 20 seconds, noise channel adds military snare, first pulse wave enters with foreboding melody that builds in tempo and intensity, second pulse wave joins with counter-harmony, accelerates from 90 BPM to 155 BPM over the full length, the boss is coming and getting closer, C minor, authentic NES 2A03 four-channel limitation, dark dungeon crawler approaching the guardian, dread building to confrontation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### E09: "Shattered Seals"

```
NES epic dungeon theme with dramatic dynamic range, pure 8-bit chiptune, opens with single high pulse wave note ringing in reverb-like silence, triangle wave bass enters with two-note motif that becomes the backbone, builds layer by layer — noise channel percussion, second pulse wave harmony, first pulse wave takes the lead with sweeping minor-key melody, reaches massive climax with both channels in detuned unison playing heroic-dark theme, then strips back to the two-note bass motif alone, ancient seals breaking open deeper passages, A minor, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG, Symphony of the Night energy
```

### E10: "Ember and Ash"

```
NES dungeon theme alternating between quiet fire-lit atmosphere and sudden combat bursts, pure 8-bit chiptune, pattern: 20 seconds of sparse pulse wave melody with crackling noise channel embers, then SUDDEN shift to full aggressive battle section for 30 seconds, then drops back to quiet, the unpredictability of dungeon crawling, you never know when the next fight comes, E minor, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### E11: "Descent of the Forgotten"

```
NES continuously descending dungeon theme, pure 8-bit chiptune, lead pulse wave melody that keeps modulating downward through keys creating a feeling of sinking deeper, triangle wave bass following the descent, second pulse wave adding increasingly frantic arpeggios as you go deeper, noise channel percussion intensifying, starts at medium energy and builds to overwhelming intensity by the end, then loops back to medium, the deeper you go the worse it gets, chromatic modulation, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### E12: "The Gauntlet"

```
NES relentless combat gauntlet theme, 155 BPM, pure 8-bit chiptune, no quiet section — this track is ALL intensity from start to finish, lead pulse wave with driving eighth-note melody in D minor, second pulse wave playing aggressive counter-melody, triangle wave bass with non-stop pumping root notes, noise channel double-time hi-hat with heavy kick, for when the playlist needs pure unbroken combat energy, duty cycle modulation for timbral variety within the intensity, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG, Mega Man boss rush energy
```

### E13: "Crimson Corridors"

```
NES dark dungeon exploration to combat arc, pure 8-bit chiptune, opens with uneasy pulse wave playing in Phrygian mode creating exotic darkness, triangle wave bass with menacing half-step movement, noise channel distant rumbling, second pulse wave adds tension with held dissonant notes, builds into aggressive Phrygian-mode combat melody that sounds both dark and exotic, noise channel full combat percussion, the dungeon has a foreign ancient evil feel, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### E14: "Knowledge is Power"

```
NES card roguelite theme celebrating the knowledge mechanic, pure 8-bit chiptune, starts with mysterious pulse wave playing a riddle-like melodic pattern, triangle wave bass with scholarly deliberate rhythm, builds as the pattern resolves into confident aggressive combat melody — the answer was found and now you strike with certainty, both pulse waves in triumphant unison at the peak, noise channel driving percussion, the feeling of getting every quiz question right and dealing massive damage, D major climax from D minor opening, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### E15: "Throne of Bones"

```
NES final boss arena theme, 160 BPM, pure 8-bit chiptune, the most epic track in the entire playlist, both pulse waves playing massive detuned unison riff in C minor, triangle wave bass thundering, noise channel relentless double-time, includes a 4-bar breakdown where everything drops except a single ominous bass note before crashing back, builds to a second climax even more intense than the first, then resolves to dark atmospheric ending, the final confrontation, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Castlevania Dracula's final form energy, Famicom-era dark fantasy RPG
```

### E16: "Rust and Ruin"

```
NES decaying dungeon theme with industrial feel, 140 BPM, pure 8-bit chiptune, lead pulse wave playing mechanical repeating pattern like broken machinery, noise channel with irregular clanking rhythm, triangle wave bass grinding low notes, second pulse wave adding distorted harmony, the dungeon is falling apart around you and you're fighting through the collapse, builds from mechanical atmosphere to desperate combat, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### E17: "Echoes of the Fallen"

```
NES mournful dungeon combat theme, pure 8-bit chiptune, starts with beautiful sad pulse wave melody in A minor — remembering fallen adventurers who came before, triangle wave bass with slow dignified movement, then hardens into determined combat melody — you will not share their fate, noise channel builds from silence to driving percussion, the sadness fuels the fight, duty cycle shift from soft to aggressive, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### E18: "Chain Lightning"

```
NES knowledge chain combo theme, 145 BPM, pure 8-bit chiptune, starts at medium intensity with driving pulse wave melody, every 8 bars ESCALATES — adds more arpeggiation, faster notes, higher energy, like building a knowledge chain in the game, by the end both pulse waves are playing maximum-speed interlocking arpeggios at full intensity, noise channel percussion doubling in complexity, triangle wave bass going from simple roots to octave jumps, the feeling of a perfect chain building to 5x multiplier, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### E19: "No Retreat"

```
NES desperate last-stand dungeon theme, pure 8-bit chiptune, opens with urgent alarm-like pulse wave repeating pattern, triangle wave bass with anxious climbing chromatic line, noise channel fast heartbeat-like kick pattern, second pulse wave adds desperate melody fighting against the alarm, builds to frantic climax where everything is at maximum speed and intensity, you're low on HP and there's no going back, G minor, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG, Metroid escape sequence energy
```

### E20: "The Rogue's Triumph"

```
NES ultimate heroic dungeon theme with full dynamic arc, pure 8-bit chiptune, starts dark and atmospheric with single pulse wave and dripping noise channel, slowly builds through exploration melody into confident stride, then EXPLODES into the most triumphant battle melody in the entire game — heroic bright major-key section that feels like overcoming impossible odds, both pulse waves in glorious unison, triangle wave bass with powerful ascending line, noise channel crashing percussion, then resolves back to quiet determination, Bb major climax from Bb minor opening, the arc of a complete dungeon run in one song, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

---

# QUIET PLAYLIST (20 tracks)

Pure flowing dream-state ambient. Zero structure, zero rhythm, zero identifiable parts or sections. Each track is one unbroken continuous texture — sustained tones that drift and blend without beginning or end. No motifs, no patterns, no repetition the ear can latch onto. The listener should never notice the music is there. It exists only to make silence feel warm. Every track must feel like it could loop forever without a seam.

---

### Q01: "Candlelight Study"

```
NES continuous warm drone, no BPM no rhythm, pure 8-bit chiptune, two pulse waves holding a sustained major third interval that drifts imperceptibly between voicings with no discernible pattern, triangle wave bass as a low unchanging hum, noise channel silent, one seamless flowing tone that could be a candle flame translated to sound, no melody no rhythm no beats no sections no changes the ear can follow, C major warmth, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q02: "Quiet Blades"

```
NES continuous cool drone, no BPM no rhythm, pure 8-bit chiptune, pulse wave holding a single sustained tone that imperceptibly shifts pitch by a semitone over 60 seconds then drifts back, second pulse wave a perfect fifth above barely audible, triangle wave bass low pedal, noise channel silent, one unbroken flowing sound with no melody no rhythm no beats no motifs no sections, steel-blue calm, D minor, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q03: "Torchlight Reverie"

```
NES continuous dreamy drone, no BPM no rhythm, pure 8-bit chiptune, two pulse waves in slow detuned unison creating a gentle undulating phasing effect that flows continuously, triangle wave bass holding a low warm tone, noise channel with imperceptible soft hiss like distant air, one unbroken dreamlike texture with no melody no rhythm no beats no patterns no sections, warm amber haze, A minor with major seventh, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q04: "Soft Steps"

```
NES continuous gentle drone, no BPM no rhythm, pure 8-bit chiptune, single pulse wave sustaining one note indefinitely with very slow volume undulation like breathing, triangle wave bass a low octave below equally sustained, second pulse wave silent, noise channel silent, one unbroken tone that breathes slowly in and out, no melody no rhythm no beats no patterns no changes, pure stillness, C major, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q05: "The Scholar's Rest"

```
NES continuous soft drone, no BPM no rhythm, pure 8-bit chiptune, two pulse waves sustaining a warm open fifth that slowly and imperceptibly widens to a sixth then contracts back over 90 seconds, triangle wave bass as low pedal, noise channel silent, one seamless flowing interval with no melody no rhythm no beats no motifs no sections no discernible changes, safe warmth, Eb major, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q06: "Ember Glow"

```
NES continuous ember drone, no BPM no rhythm, pure 8-bit chiptune, two pulse waves holding a single sustained chord with very slow imperceptible timbral shift as duty cycles drift, triangle wave bass low unchanging hum, noise channel with barely perceptible faint warmth like the idea of embers, one unbroken glowing tone, no melody no rhythm no beats no patterns no sections, just warmth existing, A minor, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q07: "Dust and Memory"

```
NES continuous hazy drone, no BPM no rhythm, pure 8-bit chiptune, two pulse waves slightly detuned from each other creating slow beating interference pattern that drifts continuously, triangle wave bass low sustained tone, noise channel with faint static haze barely above silence, one unbroken shimmering texture, no melody no rhythm no beats no motifs no sections, like looking through dusty glass, G minor, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q08: "Lantern Light"

```
NES continuous glow drone, no BPM no rhythm, pure 8-bit chiptune, pulse wave sustaining a single warm tone with imperceptible slow volume swell over 45 seconds then equally slow fade, triangle wave bass holding root, second pulse wave a major third above equally sustained, noise channel silent, one unbroken warm glow, no melody no rhythm no beats no patterns no sections, steady light, F major, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q09: "Stone Lullaby"

```
NES continuous deep drone, no BPM no rhythm, pure 8-bit chiptune, single pulse wave holding one low sustained tone, triangle wave bass an octave below as a sub-frequency presence, second pulse wave silent, noise channel silent, the most minimal possible sound — one continuous note that never changes, no melody no rhythm no beats no motifs no sections no variation, deep stone stillness, D minor, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q10: "Thinking Caps"

```
NES continuous focus drone, no BPM no rhythm, pure 8-bit chiptune, two pulse waves sustaining a minor third interval with imperceptible timbral drift, triangle wave bass low pedal tone, noise channel silent, one unbroken sustained interval that sits in the background like temperature — you stop noticing it is there, no melody no rhythm no beats no patterns no sections, clear still air, E minor, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q11: "Gentle Descent"

```
NES continuous sinking drone, no BPM no rhythm, pure 8-bit chiptune, pulse wave holding a sustained tone that drops by one semitone every 90 seconds so slowly the change is imperceptible, second pulse wave a fifth above following, triangle wave bass low drone, noise channel silent, one unbroken glacially descending tone, no melody no rhythm no beats no patterns no sections, Dorian mode, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q12: "Parchment and Ink"

```
NES continuous study drone, no BPM no rhythm, pure 8-bit chiptune, pulse wave sustaining a warm tone, second pulse wave sustaining a major second above creating a gentle sustained dissonance that resolves imperceptibly by drifting together over 2 minutes, triangle wave bass low root, noise channel silent, one unbroken flowing texture, no melody no rhythm no beats no motifs no sections, quiet concentration, A major, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q13: "Warm Stones"

```
NES continuous warmth drone, no BPM no rhythm, pure 8-bit chiptune, two pulse waves sustaining a major third with very slow duty cycle modulation creating gentle timbral shimmer, triangle wave bass low pedal, noise channel with faint soft static like radiant heat, one unbroken warm chord hanging in space indefinitely, no melody no rhythm no beats no patterns no sections, thermal comfort, F major, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q14: "Quiet Courage"

```
NES continuous resolve drone, no BPM no rhythm, pure 8-bit chiptune, pulse wave sustaining a single bright tone, second pulse wave a perfect fourth above equally sustained, triangle wave bass root pedal, noise channel silent, one unbroken open interval, no melody no rhythm no beats no motifs no sections no variation, calm certainty, Bb major, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q15: "Midnight Arithmetic"

```
NES continuous still drone, no BPM no rhythm, pure 8-bit chiptune, pulse wave holding a sustained tone with imperceptible slow pitch wobble of less than a quarter-tone, triangle wave bass low pedal, second pulse wave silent, noise channel silent, one unbroken hovering tone, no melody no rhythm no beats no patterns no sections no ticking no clicks, pure sustained presence, E minor, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q16: "Copper and Dust"

```
NES continuous mellow drone, no BPM no rhythm, pure 8-bit chiptune, two pulse waves sustaining a warm sixth interval with slow imperceptible phasing between them, triangle wave bass low root, noise channel silent, one unbroken sustained harmony, no melody no rhythm no beats no motifs no staccato no sections, quiet golden haze, F major, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q17: "After the Battle"

```
NES continuous release drone, no BPM no rhythm, pure 8-bit chiptune, pulse wave sustaining a tone that imperceptibly shifts from minor to major over 2 minutes by raising the third by a semitone glacially slowly, second pulse wave root pedal, triangle wave bass low drone, noise channel silent, one unbroken tone of slowly dissolving tension, no melody no rhythm no beats no patterns no sections, C resolving from Cm, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q18: "Fool's Gold"

```
NES continuous shimmer drone, no BPM no rhythm, pure 8-bit chiptune, two pulse waves at nearly identical pitch creating a slow beating shimmer effect that glitters continuously, triangle wave bass low pedal, noise channel silent, one unbroken shimmering sustained tone, no melody no rhythm no beats no motifs no sections, faint gold light, A major, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q19: "Deep Breaths"

```
NES continuous void drone, no BPM no rhythm, pure 8-bit chiptune, single pulse wave at lowest comfortable volume sustaining one unchanging tone, triangle wave bass barely audible sub-tone, second pulse wave silent, noise channel with imperceptible faint air, the absolute minimum — one held note and near-silence, no melody no rhythm no beats no patterns no sections no variation, just existing, A minor, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

### Q20: "The Long Road Home"

```
NES continuous farewell drone, no BPM no rhythm, pure 8-bit chiptune, two pulse waves sustaining a bittersweet major-minor ambiguity — major third and minor seventh held together creating a gentle unresolved warmth, triangle wave bass low root, noise channel silent, one unbroken chord sustained indefinitely, no melody no rhythm no beats no motifs no sections, stillness after everything, G major with minor seventh, authentic NES 2A03 four-channel limitation, retro 8-bit ambient drone
```

---

# ONE-SHOT STINGS

Brief moments that play over the playlist.

---

### Sting: "Ascent" (Victory)
**Duration:** 5-8s

```
NES victory fanfare, pure 8-bit chiptune, starts with single pulse wave holding one triumphant high note for 1 second, then both pulse waves burst into ascending major scale arpeggio with triangle wave bass doing powerful ascending octaves, noise channel crashing like 8-bit cymbals, at the peak both pulse waves play a 4-note hero motif in unison THE melody that means victory, resolves to warm tonic, no real instruments, authentic NES 2A03 sound chip four-channel limitation, Bb major, brief triumphant moment, duty cycle shifts from narrow to wide for maximum brightness, one-shot 5-8 seconds, retro 8-bit game soundtrack, Final Fantasy NES victory fanfare energy, Famicom-era dark fantasy RPG
```

### Sting: "Fading Light" (Defeat)
**Duration:** 5-8s

```
NES game over theme, pure 8-bit chiptune, single pulse wave playing a slow descending minor phrase 4 notes falling, triangle wave bass holding a low drone that fades, final moment resolves to a single major chord that glimmers with hope, noise channel silent, no real instruments, authentic NES 2A03 sound chip four-channel limitation, A minor resolving to C major, NOT punishing contemplative and dignified, one-shot 5-8 seconds, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### Sting: "The Warden Appears" (Boss Entrance)
**Duration:** 3-5s

```
NES boss entrance dramatic hit, pure 8-bit chiptune, both pulse waves slamming a massive low chord in unison, triangle wave bass thundering low octave, noise channel crash, single moment of dread then silence, no real instruments, authentic NES 2A03 sound chip four-channel limitation, C minor, the boss has appeared, one-shot 3-5 seconds, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

---

# GENERATION STRATEGY

### Batch Order (most to least important)
1. **Epic E01-E05** — the first dungeon experience
2. **Quiet Q01-Q05** — alternative for quiz-focused players
3. **Victory + Defeat stings** — emotional anchors
4. **Epic E06-E20** — fill the epic playlist
5. **Quiet Q06-Q20** — fill the quiet playlist
6. **Boss sting** — finishing touch

> **Hub/camp ambient** is handled by layered SFX loops — see `SFX-SOUND-GENERATION-PROMPTS.md` § Ambient Atmosphere Recipes.

### Total Track Count
- **Epic:** 20 tracks
- **Quiet:** 20 tracks
- **Stings:** 3

**Grand total: 43 tracks**
