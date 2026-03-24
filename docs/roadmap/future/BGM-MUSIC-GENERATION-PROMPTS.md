# Background Music — AI Generation Prompts

**For:** Damion (generate via Suno free tier)
**Output:** .ogg or .mp3
**Destination:** Drop all files in a single folder, agent will sort them into the correct structure
**Naming:** Use the track title as filename (e.g. `awakening_of_the_deep.ogg`)

---

## Music System — Three Playlists

The game has a **music mode selector** in the top-left corner showing the current track title with next/previous buttons and three playlist modes:

| Mode | Vibe | When to Use |
|------|------|-------------|
| **EPIC** | Intense, dynamic, battle-forward | Default for combat-heavy players who want adrenaline |
| **QUIET** | Lo-fi, chill, soft dungeon vibes | For players who want to focus on the quiz/strategy |
| **AMBIENT** | Minimal, atmospheric, barely-there | For players who want near-silence with texture |

Each mode has its own playlist of ~20 tracks that plays continuously through the entire dungeon run. The player picks their vibe and the music stays in that lane.

**Camp/hub** uses a separate small playlist (shared across all modes).
**Stings** (victory, defeat, boss entrance) play as one-shots over any playlist.

### File Structure
```
public/assets/audio/bgm/
  epic/           — 20 intense dungeon tracks
  quiet/          — 20 lo-fi soft dungeon tracks
  ambient/        — 20 minimal atmospheric tracks
  camp/           — 5-10 hub/rest tracks
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

Lo-fi, chill, soft. For players who want to focus on the strategy and quiz. Still dungeon-dark but calm and non-distracting. Think lo-fi hip-hop beats but through an NES sound chip.

---

### Q01: "Candlelight Study"

```
NES lo-fi chill dungeon study theme, 75 BPM, pure 8-bit chiptune, gentle pulse wave melody playing soft major-key notes with long sustain, triangle wave bass with simple two-note pattern repeating hypnotically, noise channel with very soft lo-fi crackle like vinyl static, second pulse wave adding occasional warm harmony notes, lo-fi chiptune beats to study and fight monsters to, relaxed and focused, not intense not scary just calm dungeon vibes, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, lo-fi pixel art study music
```

### Q02: "Quiet Blades"

```
NES soft combat theme, 100 BPM, pure 8-bit chiptune, lead pulse wave playing a gentle melodic line that suggests combat without being aggressive, triangle wave bass with laid-back walking pattern, noise channel with soft brushed hi-hat only, second pulse wave adding warm sustained chords, fighting but calmly — strategic not frantic, the combat is a puzzle not a war, D minor but with warm voicings, authentic NES 2A03 four-channel limitation, retro 8-bit game lo-fi soundtrack
```

### Q03: "Torchlight Reverie"

```
NES dreamy dungeon lo-fi theme, 70 BPM, pure 8-bit chiptune, pulse wave playing spacious melody with lots of rests between notes, triangle wave bass with gentle root notes every two bars, noise channel faint crackling fire ambience, second pulse wave adding held harmony creating warm chord pads, watching the torchlight flicker while thinking about your next move, meditative and warm despite being underground, A minor with major seventh intervals for warmth, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q04: "Soft Steps"

```
NES quiet exploration lo-fi theme, 85 BPM, pure 8-bit chiptune, lead pulse wave with simple stepping melody that moves in gentle quarter notes, triangle wave bass providing grounding root-fifth movement, noise channel with very soft kick on beats 1 and 3 only, second pulse wave holding sustained notes for warmth, walking quietly through corridors not in a rush, peaceful dungeon exploration, C major for simple clarity, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q05: "The Scholar's Rest"

```
NES rest site lo-fi chiptune theme, 65 BPM, pure 8-bit chiptune, pulse wave playing gentle arpeggio pattern repeating like a music box but warm not creepy, triangle wave bass with slow sustained root notes, noise channel silent except for occasional single tick like a page turning, second pulse wave adding one long held note per phrase, studying your cards and planning the next floor, Eb major, warm and safe but still underground, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q06: "Ember Glow"

```
NES lo-fi campfire dungeon theme, 60 BPM very slow, pure 8-bit chiptune, two pulse waves playing simple interlocking arpeggios creating a warm blanket of sound, triangle wave bass with single low note per bar, noise channel with quiet crackling ember texture, lo-fi warmth and comfort, sitting by the fire after a long fight, not sad not happy just present, A minor with natural warmth, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q07: "Dust and Memory"

```
NES nostalgic lo-fi dungeon theme, 80 BPM, pure 8-bit chiptune, pulse wave melody with wistful quality — notes that seem to remember better times, triangle wave bass with gentle movement, noise channel with soft vinyl-crackle texture throughout, second pulse wave adding detuned harmony for lo-fi warmth, the dungeon holds memories of those who came before, bittersweet and calm, G minor with occasional major lifts, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q08: "Lantern Light"

```
NES soft guiding light lo-fi theme, 90 BPM, pure 8-bit chiptune, lead pulse wave with bright but soft melody like a lantern bobbing as you walk, triangle wave bass with steady quarter note pulse, noise channel with gentle hi-hat shuffle, second pulse wave providing chordal warmth, a small light in the darkness guiding your way, hopeful but gentle, F major, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q09: "Stone Lullaby"

```
NES lo-fi dungeon sleep theme, 55 BPM very slow, pure 8-bit chiptune, single pulse wave playing a simple descending-then-ascending lullaby melody, triangle wave bass with one note every two bars, noise channel almost inaudible distant texture, second pulse wave enters only in the second half adding very quiet harmony, the dungeon is resting and so are you, minimal and hypnotic, D minor, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q10: "Thinking Caps"

```
NES quiz-focused lo-fi study theme, 95 BPM, pure 8-bit chiptune, pulse wave playing clever bouncy melody in major key that makes you feel smart, triangle wave bass with playful walking line, noise channel with light snare shuffle, second pulse wave adding staccato rhythmic accents, the feeling of knowing the answer before the timer runs out, confident and focused, C major, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q11: "Gentle Descent"

```
NES lo-fi floor transition theme, 70 BPM, pure 8-bit chiptune, slowly descending pulse wave melody getting lower in register as you go deeper, triangle wave bass following the descent gently, noise channel with distant dripping water, second pulse wave adding ethereal held notes, going deeper but it's okay everything is calm, Dorian mode for bittersweet color, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q12: "Parchment and Ink"

```
NES lo-fi card management theme, 85 BPM, pure 8-bit chiptune, pulse wave playing studious melody like writing notes in a journal, triangle wave bass with academic walking pattern, noise channel with scratching pen texture barely audible, second pulse wave adding bookish warm harmonies, reviewing your deck and making plans, scholarly and calm, A major, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q13: "Warm Stones"

```
NES lo-fi dungeon comfort theme, 75 BPM, pure 8-bit chiptune, both pulse waves playing interlocking warm arpeggios in thirds creating a cozy blanket of sound, triangle wave bass with simple heartbeat-like two-note pattern, noise channel with soft static warmth, even deep underground there are warm places, comforting and safe, F major, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q14: "Quiet Courage"

```
NES lo-fi heroic soft theme, 80 BPM, pure 8-bit chiptune, pulse wave playing a quietly heroic melody — brave but not loud, triangle wave bass with steady supportive movement, noise channel with gentle kick-hat pattern, second pulse wave adding determined harmony notes, courage doesn't have to be loud, doing the right thing quietly, Bb major, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q15: "Midnight Arithmetic"

```
NES lo-fi puzzle solving theme, 90 BPM, pure 8-bit chiptune, pulse wave playing a mathematical-feeling melody with precise intervals, triangle wave bass with logical stepping pattern, noise channel with metronomic soft tick, second pulse wave adding calculating harmony, the satisfaction of working through a problem, intellectual and satisfying, E minor with chromatic passing tones for clever feeling, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q16: "Copper and Dust"

```
NES lo-fi dungeon merchant chill theme, 85 BPM, pure 8-bit chiptune, pulse wave playing a mellow jazzy melody with chromatic grace notes, triangle wave bass walking a chill chromatic line, noise channel with soft shuffle beat, second pulse wave adding coin-like staccato accents, browsing the shop with no urgency, everything has a price, F major with blues notes, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q17: "After the Battle"

```
NES lo-fi post-combat rest theme, 60 BPM, pure 8-bit chiptune, pulse wave playing a relieved exhale of a melody — tension leaving the body, triangle wave bass with slow comforting root notes, noise channel quiet, second pulse wave adding warm resolution chords, you survived that encounter now catch your breath, the relief after a close fight, C major resolving from C minor, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q18: "Fool's Gold"

```
NES lo-fi treasure room chill theme, 95 BPM, pure 8-bit chiptune, pulse wave playing a cheeky playful melody with unexpected turns, triangle wave bass with bouncy movement, noise channel with light percussion shuffle, second pulse wave adding sparkly high staccato notes like coins, finding treasure in the dungeon and not sure if it's worth it, A major with mischievous chromatic notes, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q19: "Deep Breaths"

```
NES lo-fi meditation rest theme, 50 BPM extremely slow, pure 8-bit chiptune, single pulse wave playing one note every 3-4 seconds with silence between, triangle wave bass holding a single pedal tone, noise channel breathing-like soft whoosh every few seconds, second pulse wave silent for most then one held note, the most minimal quiet track, almost meditation, just breathing in the dark, A minor, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

### Q20: "The Long Road Home"

```
NES lo-fi journey's end reflective theme, 75 BPM, pure 8-bit chiptune, pulse wave playing a nostalgic melody looking back on the run, triangle wave bass with gentle movement toward home, noise channel with soft static warmth, second pulse wave adding bittersweet harmony, whether you won or lost the journey mattered, reflective and warm, G major with minor passing tones, authentic NES 2A03 four-channel limitation, retro 8-bit lo-fi game soundtrack
```

---

# AMBIENT PLAYLIST (20 tracks)

Minimal, textural, barely music. For players who want near-silence with just enough to know they're in a dungeon. These are sound-design-adjacent — drones, textures, sparse notes floating in darkness.

---

### A01: "The Silence Between"

```
NES dungeon ambient minimal texture, pure 8-bit chiptune, single pulse wave playing one isolated note every 8-10 seconds floating in silence, triangle wave bass with barely audible low drone, noise channel with faint irregular dripping water, no rhythm no melody just isolated moments of sound in darkness, the dungeon breathes, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack, dark atmospheric
```

### A02: "Hollow Wind"

```
NES dungeon wind ambient drone, pure 8-bit chiptune, noise channel producing continuous soft wind-like texture, single pulse wave holding a very quiet sustained note that shifts pitch every 15 seconds, triangle wave bass inaudible low rumble, no melody no rhythm just wind through stone corridors, the emptiness between rooms, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A03: "Dripping Cavern"

```
NES cave ambient water texture, pure 8-bit chiptune, noise channel producing irregular water drip sounds at random intervals, pulse wave playing a single high note per drip like an echo, triangle wave bass with very low continuous drone, no melody just the sound of an underground water source, the dungeon is alive with hidden streams, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A04: "Torch Flicker"

```
NES dungeon ambient fire texture, pure 8-bit chiptune, noise channel with soft irregular crackling like a dying torch, pulse wave with occasional single warm note appearing and disappearing, triangle wave bass silent, second pulse wave adding one held note every 20 seconds that fades, watching a torch slowly burn down, hypnotic minimal, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A05: "Stone Whispers"

```
NES dungeon ambient whisper texture, pure 8-bit chiptune, two pulse waves playing extremely quiet detuned unison creating a subtle phasing whisper effect, triangle wave bass with single pedal tone, noise channel with random sparse ticks like stones settling, the walls seem to murmur, unsettling but not scary, whole-tone intervals for otherworldly feel, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A06: "Depth Gauge"

```
NES dungeon ambient descending drone, pure 8-bit chiptune, triangle wave bass playing an extremely slow descending chromatic line — one note shift every 10 seconds, pulse wave with faint harmonic hovering above, noise channel nearly silent occasional tick, the feeling of being deep underground and still going deeper, no rhythm just slow gravitational pull downward, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A07: "Ember Watch"

```
NES campfire ambient minimal rest theme, pure 8-bit chiptune, noise channel with gentle fire crackling pattern, single pulse wave playing one warm note every 6-8 seconds, triangle wave bass with lowest possible sustained note, second pulse wave silent, campfire ambience stripped to absolute minimum, the comfort of fire in the dark reduced to its essence, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A08: "Ancient Air"

```
NES dungeon ambient stale air texture, pure 8-bit chiptune, pulse wave producing a slow barely-audible oscillation like air moving through old passages, noise channel with distant resonance texture, triangle wave bass with extremely low almost felt-not-heard drone, no notes just texture, the dungeon has been here for centuries and the air remembers, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A09: "Rune Glow"

```
NES mystery room ambient minimal theme, pure 8-bit chiptune, single pulse wave playing whole-tone scale notes one at a time with 5-second gaps, each note slightly detuned creating dreamlike quality, triangle wave bass with chromatic pedal shift every 15 seconds, noise channel with sparse crystalline ticks, glowing runes on the wall casting faint light, otherworldly and strange, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A10: "Distant Battle"

```
NES ambient far-away combat texture, pure 8-bit chiptune, noise channel with very faint muffled rhythmic pattern like hearing a battle through thick walls, pulse wave with occasional distant melodic fragment barely audible, triangle wave bass with low rumble, someone else is fighting somewhere in the dungeon, you are alone with the echoes, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A11: "Frozen Passage"

```
NES dungeon cold ambient texture, pure 8-bit chiptune, pulse wave playing sparse high notes with long decay like icicles, triangle wave bass with deep glacial drone, noise channel with faint crystalline shimmer, second pulse wave adding rare dissonant interval, the dungeon gets cold at this depth, still and frozen, E minor with flat 6 for icy quality, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A12: "The Threshold"

```
NES ambient room transition texture, pure 8-bit chiptune, triangle wave bass playing two alternating notes very slowly creating a doorway feeling, pulse wave with single note that bends slightly, noise channel with one click like a latch, the moment between rooms, crossing a threshold into the unknown, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A13: "Dust Motes"

```
NES ambient floating particle texture, pure 8-bit chiptune, both pulse waves playing randomly spaced high tiny notes like dust catching light, no pattern just scattered sparkles, triangle wave bass completely silent, noise channel with faintest possible static, dust floating in a shaft of light from above, momentary beauty in the dark, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A14: "Below the Roots"

```
NES organic dungeon ambient texture, pure 8-bit chiptune, triangle wave bass with slow organic-feeling movement like roots growing, pulse wave with occasional note that sounds like something alive in the walls, noise channel with soft earthy texture, the dungeon is not just stone it's living, unsettling organic quality, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A15: "Prayer Candles"

```
NES ambient rest shrine texture, pure 8-bit chiptune, two pulse waves in very quiet unison playing a simple three-note descending prayer motif repeating every 12 seconds, triangle wave bass with single low sacred-feeling note, noise channel silent, a shrine found in the dungeon someone still prays here, solemn and reverent, C major for purity, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A16: "Iron Gates"

```
NES ambient industrial dungeon texture, pure 8-bit chiptune, noise channel with irregular metallic clanging at random intervals, triangle wave bass with deep resonant drone, pulse wave with occasional grinding note, second pulse wave silent, the deep dungeon where iron gates block forgotten passages, cold and mechanical, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A17: "Void"

```
NES ambient absolute minimal nothing, pure 8-bit chiptune, triangle wave bass with single sustained lowest possible note, pulse waves silent for 20+ seconds then one note appears and vanishes, noise channel with the faintest possible hiss, as close to silence as music can be, the deepest point of the dungeon where sound itself dies, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A18: "Echoing Steps"

```
NES ambient footstep echo texture, pure 8-bit chiptune, noise channel with rhythmic soft footstep-like sounds at walking pace, each footstep followed by pulse wave echo note that decays, triangle wave bass with distant corridor resonance, walking alone through endless corridors, the only sound is your own feet, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A19: "The Cartographer"

```
NES ambient map screen minimal texture, pure 8-bit chiptune, pulse wave playing a single thoughtful note every 4-5 seconds as if placing pins on a map, noise channel with soft paper-like rustle, triangle wave bass with grounding low note, second pulse wave silent, studying the dungeon map and planning your route, intellectual and still, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

### A20: "Last Embers"

```
NES ambient dying campfire end-of-run texture, pure 8-bit chiptune, noise channel with increasingly sparse crackling — the fire is going out, pulse wave playing slower and slower melody fragments getting quieter, triangle wave bass fading to nothing, the run is ending whether in victory or defeat, everything winds down, the embers die, authentic NES 2A03 four-channel limitation, retro 8-bit ambient game soundtrack
```

---

# CAMP PLAYLIST (5-10 tracks)

Plays on the hub/home screen. Consistently low energy, cozy-dark, safe haven.

---

### Camp 01: "Torch and Stone"

```
Dark NES dungeon campsite respite theme, slow tempo 60-70 BPM, pure 8-bit chiptune, two pulse wave channels carrying a somber minor-key melody with long sustained notes and sparse arpeggios, deep triangle wave bass with slow deliberate root notes, noise channel crackling embers and distant dripping cave water, no real instruments, authentic NES 2A03 sound chip limitations, four-channel composition, dark medieval dungeon crawler, melancholic but restful, brief safety before descending deeper, flickering torchlight atmosphere, lo-fi bitcrushed warmth, detuned pulse wave vibrato for unease, minor key with occasional dissonant passing tones, seamless loop, pixel art campfire in a stone corridor, weary adventurers resting, quiet dread beneath the calm, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### Camp 02: "Embers and Silence"

```
Dark NES dungeon campsite respite theme, very slow tempo 55-65 BPM, pure 8-bit chiptune, single pulse wave playing isolated minor-key notes with long silences between them, triangle wave bass with single sustained low drone, noise channel quiet ember crackle barely audible, second pulse wave completely silent for most of the piece then adds one held note, no real instruments, authentic NES 2A03 sound chip four-channel limitation, the most minimal track in the game, barely there, silence is the music, flickering torchlight in an empty corridor, the exhaustion after a hard fight, A minor, detuned vibrato on the few notes that exist, pixel art campfire embers, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### Camp 03: "The Peddler's Alcove"

```
NES dungeon merchant theme, 105-115 BPM, pure 8-bit chiptune, lead pulse wave playing a slightly off-kilter bouncy melody in a major key that feels suspicious rather than cheerful, second pulse wave adding staccato rhythmic accompaniment like coins clinking, triangle wave bass walking a jazzy chromatic line, noise channel providing a light shuffle beat, no real instruments, authentic NES 2A03 sound chip four-channel limitation, dungeon peddler who should not be trusted, playful but with an edge of danger, F major with unexpected flat notes for unease, duty cycle changes giving the melody a sly winking quality, seamless loop, pixel art roguelite shop keeper in torchlit alcove, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG, Shovel Knight merchant vibes
```

### Camp 04: "Hearthside Tales"

```
NES warm storytelling camp theme, 70 BPM, pure 8-bit chiptune, pulse wave playing a gentle narrative melody that rises and falls like someone telling a story, triangle wave bass with warm supportive notes, noise channel with soft fire crackle, second pulse wave adding occasional response notes like a listener reacting, adventurers sharing stories by the fire, warm and communal, G major with nostalgic minor moments, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
```

### Camp 05: "Tomorrow's Descent"

```
NES anticipation camp theme, 65 BPM, pure 8-bit chiptune, pulse wave playing a melody that balances hope and dread — tomorrow you go back into the dungeon, triangle wave bass with slow resolute movement, noise channel with quiet distant rumbling from below, second pulse wave adding held tension notes, the night before the next run, determined but uncertain, D minor with moments of D major for hope, authentic NES 2A03 four-channel limitation, retro 8-bit game soundtrack, Famicom-era dark fantasy RPG
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
3. **Camp 01-03** — hub identity
4. **Victory + Defeat stings** — emotional anchors
5. **Epic E06-E20** — fill the epic playlist
6. **Quiet Q06-Q20** — fill the quiet playlist
7. **Ambient A01-A20** — last priority, most niche audience
8. **Camp 04-05 + Boss sting** — finishing touches

### Total Track Count
- **Epic:** 20 tracks
- **Quiet:** 20 tracks
- **Ambient:** 20 tracks
- **Camp:** 5 tracks
- **Stings:** 3

**Grand total: 68 tracks**
