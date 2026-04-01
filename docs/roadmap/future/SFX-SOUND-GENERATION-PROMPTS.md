# Sound Effects & Ambient Loops — AI Generation Prompts

**For:** Damion (manual generation via Suno or ElevenLabs SFX)
**Output:** .ogg or .wav
**Destination:** Drop all files into a single folder; agent will sort into `public/assets/audio/sfx/`
**Naming:** Use the filename listed for each entry (no extension)

---

## Sound Architecture

Currently 232 SFX are synthesized at runtime via Web Audio API (`audioService.ts`). These prompts generate real audio replacements. Drop files into `public/assets/audio/sfx/` and the audio system loads them instead of synthesizing.

**Source of truth for SoundName entries:** `src/services/audioService.ts` lines 14–232.

### Folder Structure
```
public/assets/audio/sfx/
  loops/        — all looping ambient/atmospheric sounds
  combat/       — card play, enemy, damage, shield, chain
  status/       — poison, burn, bleed, weakness, strength, etc.
  quiz/         — appear, answer select, speed bonus, dismiss, timer, streak, memory tip
  encounter/    — start, victory, boss entrance, boss defeat, defeat
  surge/        — announce, active, end
  turn/         — enemy turn, end turn, perfect, AP, combos
  relic/        — trigger variants, acquired, death prevent, capacitor
  map/          — map open, node hover/click, path reveal, floor/room transition
  hub/          — welcome, start run, buttons
  shop/         — open, purchase, sell, transform variants, haggle, bark, coin
  rest/         — open, heal, study, meditate, card removed
  reward/       — screen, gold, card accept/skip/reroll, relic, treasure
  mystery/      — appear, choice, outcomes, continue
  run/          — start, domain, floors, retreat, delve, victory, defeat, stats, xp
  reveal/       — rarity reveals (common through mythic)
  mastery/      — glow, fullscreen, streak, challenge, trial, fact mastered
  keeper/       — NPC vocal cues
  ui/           — button click, modal, toggle, tab, error, notification, pop-in
  transition/   — screen transitions, boot logo
  tutorial/     — tooltip, step, complete
  progression/  — mechanic unlock, relic unlock, level up, ascension
  legacy/       — mine sounds, environmental (from mining prototype)
```

---

## AMBIENT LOOPS (generate these first — they play constantly)

### Hub Campfire Ambience Loop
**Filename:** `loops/hub_campfire_ambience` | **Type:** Loop | **Duration:** 6-10s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. A campfire crackling in a stone chamber. Wood popping and splitting, embers hissing, the low roar of flame licking at logs. Irregular — sometimes a loud snap, sometimes just quiet sizzling. The fire breathes and shifts. You can almost feel the heat. Close, warm, alive. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Dungeon Dripping Water Loop
**Filename:** `loops/dungeon_drip_ambient` | **Type:** Loop | **Duration:** 8-12s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Water dripping in a cave. Distant drops hitting stone at long irregular intervals — never rhythmic, always surprising. Each drip echoes off wet walls. Some drops are faint and far away, others slightly louder. Long silences between them. The sound of a dark underground space where water has been falling for centuries. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Combat Tension Underbed Loop
**Filename:** `loops/combat_tension_underbed` | **Type:** Loop | **Duration:** 4-6s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. A deep low rumble, like standing on a bridge over a chasm. Sub-bass vibration felt more than heard. The air itself feels thick and pressurized. Occasional faint tremor. The ground-level tension of a dangerous place — your stomach knows something is wrong before your ears do. Oppressive, heavy, still. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Low HP Warning Pulse Loop
**Filename:** `loops/low_hp_warning_pulse` | **Type:** Loop | **Duration:** 1-2s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. A heartbeat. Slow, heavy, stressed — approximately 60 BPM. Each beat is a deep thud with a brief body resonance after it. Silence between beats feels long and tense. Like hearing your own pulse in your ears when you're scared. Getting weaker. Almost dead. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Shop Browsing Ambient Loop
**Filename:** `loops/shop_ambient_browse` | **Type:** Loop | **Duration:** 5-8s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. A merchant's alcove underground. Small objects clinking on a wooden counter — glass bottles, metal trinkets. Faint rustling of cloth and leather goods. A lantern flame guttering softly. The ambient texture of a cramped shop in a stone corridor, packed with wares. Cozy and slightly cluttered. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Rest Site Peaceful Ambient Loop
**Filename:** `loops/rest_site_peaceful` | **Type:** Loop | **Duration:** 6-10s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. A quiet underground resting place. Slow breathing of a sleeping space — faint air movement, the barely-there sound of warmth in a cold place. Distant water, muffled and far. Everything is soft and padded. The absence of danger. A pocket of calm in the dungeon where exhaustion can let go for a moment. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Mystery Event Eerie Ambient Loop
**Filename:** `loops/mystery_eerie_ambient` | **Type:** Loop | **Duration:** 5-8s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Something wrong in the air. Faint crackling like static electricity. An unstable hum that drifts in pitch — not a tone, more like a resonance from something that shouldn't exist. The temperature feels different. Occasional brief flutter of displaced air. An anomaly in the dungeon, neither threatening nor safe — just deeply strange. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Map Exploration Ambient Loop
**Filename:** `loops/map_exploration_ambient` | **Type:** Loop | **Duration:** 5-8s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Standing at a crossroads in a stone dungeon, studying the paths ahead. Faint wind from multiple corridors, each carrying different distant sounds — a drip from one direction, a faint rumble from another. The acoustics of a junction point where tunnels meet. Quiet footstep shuffles on gravel as weight shifts from foot to foot. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Boss Arena Ambient Loop
**Filename:** `loops/boss_arena_ambient` | **Type:** Loop | **Duration:** 4-6s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. A vast chamber. Something massive is breathing in here — slow, deep, heavy exhales that move the air. The room itself seems to resonate with each breath. Distant grinding of stone or bone. The floor vibrates faintly. Stomach-sinking dread. Something terrible is here and it knows you arrived. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Keeper Presence Hum Loop
**Filename:** `loops/keeper_presence_hum` | **Type:** Loop | **Duration:** 4-6s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. The presence of something ancient and knowing. A faint electric hum like old wires carrying too much current. The air tingles. Occasional soft crackle of energy. Not threatening, but deeply alien — an intelligence that exists in a way stone and fire do not. The hairs on your arms stand up. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Chain Active Shimmer Loop
**Filename:** `loops/chain_active_shimmer` | **Type:** Loop | **Duration:** 2-3s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Energy building and crackling — like electricity arcing between metal contacts. A shimmering, buzzing charge accumulating. Metallic sparkle and fizz. Something is powering up and gaining momentum. The air between your hands is alive with static. Brief and intense. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Quiz Thinking Ambient Loop
**Filename:** `loops/quiz_thinking_ambient` | **Type:** Loop | **Duration:** 3-5s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. The sound of concentration. Near-silence with a faint ringing in your ears — the quiet you hear when you're focused hard on something. A clock-like presence without an actual tick. The held breath before answering. Must be extremely quiet — almost subliminal. Just enough to know you're in a focused moment. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Victory Celebration Ambient Loop
**Filename:** `loops/victory_celebration_ambient` | **Type:** Loop | **Duration:** 3-4s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. The aftermath of winning. Crackling embers from a defeated foe. Dust settling. A faint echo of the battle fading into the stone walls. The sound of a room returning to quiet after violence — relief expressed through the absence of threat. Your own breathing slowing down. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Surge Active Loop
**Filename:** `surge/surge_active_loop` | **Type:** Loop | **Duration:** 2-4s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Raw power humming through you. An electric surge — buzzing, crackling, vibrating energy at full charge. Like standing next to a transformer at peak load. The air itself is ionized. Constant sustained energy discharge with occasional sparking peaks. Everything is amplified. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Close Water Drips
**Filename:** `loops/water_drip_close` | **Type:** Loop | **Duration:** 4-6s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Close-range water drips hitting stone — sharp, immediate, with short reverb tail. Individual drops landing right beside you on wet rock. Distinct crisp impact per drop, spaced irregularly, never forming a pattern. The drops are RIGHT NEXT TO YOU — intimate, near-field, slightly startling in their proximity. Stone surface resonance, micro-splash, brief echo. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Underground River Flow
**Filename:** `loops/water_flow_underground` | **Type:** Loop | **Duration:** 8-12s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Continuous muffled rushing water behind walls or beneath floor — the sound of a hidden underground stream heard through stone. Deep, constant, slightly rumbling, like the earth itself carries flowing water just out of reach. Low-frequency wash with subtle variation in flow speed. Not a waterfall — a river, smooth and relentless. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Stone Passage Wind
**Filename:** `loops/wind_passage` | **Type:** Loop | **Duration:** 6-10s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Wind moaning through narrow stone corridors. Rising and falling in gentle slow waves — a cool draft moving through ancient passages. The sound of air being squeezed through tight gaps in old masonry, low and breathy, occasionally gusting slightly then dying back to a gentle moan. No whistling melody. Just moving air through stone. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Deep Howling Wind
**Filename:** `loops/wind_howl_deep` | **Type:** Loop | **Duration:** 8-12s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. More intense than a passage draft — deep howling wind through vast underground chambers. A cavernous low roar that builds and fades in long slow waves. Somewhere far away something metallic rattles and clanks, caught in the draft. The sound of enormous empty space with wind moving through it. Heavy, hollow, oppressive. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Single Torch Crackle
**Filename:** `loops/fire_torch_crackle` | **Type:** Loop | **Duration:** 5-8s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. One wall-mounted torch burning. Irregular flame crackling — small pops, the hiss of burning pitch, occasional gutter as a draft catches the flame. Close and intimate. The fire leans and recovers. An occasional sharp pop followed by a brief moment of quieter burning. Just one torch, right here, on the wall. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Ember Pit Fire
**Filename:** `loops/fire_ember_pit` | **Type:** Loop | **Duration:** 6-10s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. A large fire pit or brazier burning with deep bass-heavy crackling. Coals shifting and settling with low grinding thuds. Occasional whoosh of rising heat as the fire breathes. Heavy, warm, substantial — the sound of real mass burning. Deep low-frequency rumble under the crackling. Much larger and deeper than a torch. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Stone Settling
**Filename:** `loops/stone_creak_settle` | **Type:** Loop | **Duration:** 10-15s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Ancient masonry shifting under geological weight. Long stretches of near-silence broken by a deep slow grinding groan as stone moves against stone. Tiny pebbles dislodging and skittering down surfaces. The weight of the mountain above pressing down — deep subsonic pressure rumbles at long intervals. The building itself is alive with stress. Never predictable, never rhythmic. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Distant Chain Rattle
**Filename:** `loops/chain_rattle_distant` | **Type:** Loop | **Duration:** 8-12s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Chains hanging somewhere in the dark, swaying slowly. Slow irregular metallic clinks as links knock against each other. Occasional heavier thud of iron against stone. Everything is echoey and distant — across the chamber, down the corridor, around the corner. The sound bounces off stone walls and arrives late. Cold metal in cold air. Never rhythmic — just swaying. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Crystal Hum
**Filename:** `loops/crystal_hum` | **Type:** Loop | **Duration:** 6-10s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Natural crystalline resonance in a geode chamber — wind passing across crystal formations producing natural harmonics. High ringing tones at random intervals, like crystal singing bowls struck very lightly with no intention. Purely physical phenomenon, not musical performance. The frequencies are what the crystal geometry produces, not notes chosen for melody. Shimmer and ring and decay, then silence, then another random crystal speaks. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Cave Insects
**Filename:** `loops/insect_cave` | **Type:** Loop | **Duration:** 8-12s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Clicking, chirping underground insects — cave crickets and other subterranean arthropods. Organic timing that is never metronomic. Calls echo off stone walls, arriving with short reverb. The sounds are alien compared to surface insects — hollow, slightly damp, strange. Occasional burst of activity then quiet. Multiple creatures at different distances creating spatial depth. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Steam Vent Hiss
**Filename:** `loops/steam_vent_hiss` | **Type:** Loop | **Duration:** 5-8s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Gas or steam hissing from cracks in stone floor. Irregular pressure releases — some short sharp bursts, some longer sustained hisses. The sound of hot mineral-laden vapor escaping from below. Slightly wet quality, like steam carrying moisture. Pressure builds and releases, never on a schedule. The atmosphere smells hot and sulfurous even though this is audio only. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Lava Bubble
**Filename:** `loops/lava_bubble` | **Type:** Loop | **Duration:** 6-10s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Magma bubbling in a nearby pool or channel. Thick viscous pops as bubbles of superheated gas breach the surface — slow and heavy, nothing like water. Deep heat rumble underneath like a geological engine running. Occasional burst of a larger bubble sending a brief splatter of sound. The pops are weighted, bass-heavy, carrying the mass of liquid rock. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Void Drone
**Filename:** `loops/void_drone` | **Type:** Loop | **Duration:** 10-15s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. The deepest layer of the dungeon where sound barely reaches. Near-silence with pressure in your ears — the oppressive quiet of somewhere very deep underground. Occasional far-off boom or rumble that arrives without explanation. A faint edge like tinnitus, the sound of your own hearing straining in a too-quiet space. Not peaceful quiet — uncomfortable quiet. The void below everything. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Arcane Whisper
**Filename:** `loops/arcane_whisper` | **Type:** Loop | **Duration:** 6-10s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Faint magical energy murmuring through ancient enchantments embedded in stone walls. Not voices — more like electricity or resonance humming through old inscriptions and rune-work. Slightly shimmering, otherworldly, non-human. The sound of magic that has been active for centuries, running low but still present. Occasional flutter or surge of energy. Eerie and supernatural but not threatening. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Ice Creak
**Filename:** `loops/ice_creak` | **Type:** Loop | **Duration:** 8-12s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Frozen surfaces shifting and cracking under thermal stress. Crystalline stress sounds — the sharp complaint of ice expanding or contracting. Long silence followed by a sudden sharp crack, then smaller ticking as the tension redistributes. Cold and brittle, every sound carrying the fragility of frozen things. The floor or walls are ice and they are under strain. Occasional deep groan from a larger mass shifting. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Camp Cloth Rustle
**Filename:** `loops/camp_cloth_rustle` | **Type:** Loop | **Duration:** 8-12s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Fabric and leather moving gently in a campsite. A tent or tarp shifting in a faint draft. Bedrolls settling. A backpack strap sliding off a shoulder. Quiet domestic sounds of a makeshift camp — soft, irregular, human. Not footsteps or voices, just the ambient texture of gear and cloth in a stone chamber. Barely there. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Distant Creature Stir
**Filename:** `loops/distant_creature_stir` | **Type:** Loop | **Duration:** 10-15s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. Something alive far away in the dark — shuffling, a low scrape, a faint growl or snort, then silence for a long time. You're safe at camp but the dungeon is not empty. The sounds are always distant and echoey, never close, never threatening — just a reminder that things live down here. Long gaps between sounds. Unidentifiable but organic. Seamless loop, pure environmental sound design, NOT A SONG.
```

### Stone Room Resonance
**Filename:** `loops/stone_room_resonance` | **Type:** Loop | **Duration:** 6-10s

```
NOT MUSIC. This is a sound effect, not a song. Do not generate anything musical. No notes, no chords, no melody, no harmony, no rhythm, no beat, no progression. The deep low hum of a large stone chamber — room tone of an underground space. Not wind, not a drone, just the natural bass resonance of a big enclosed stone room. The sound your ears fill in when everything else is quiet. Barely audible sub-bass, the acoustic signature of mass and emptiness. The feeling of being surrounded by ancient stone. Seamless loop, pure environmental sound design, NOT A SONG.
```

---

## LEGACY / MINING (5 one-shots)

### Mine Dirt Strike
**Filename:** `legacy/mine_dirt` | **Type:** One-shot | **Duration:** 0.15-0.25s

```
NES 8-bit dirt digging strike sound effect, pure chiptune, authentic NES 2A03 chip sound, dull noise channel burst with soft low-frequency filtering, no ping — just thud and spray, like a pickaxe hitting soft earth, soft and quick with no sustain, legacy mining mechanic prototype, one-shot, no music
```

### Mine Rock Strike
**Filename:** `legacy/mine_rock` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit rock strike mining sound effect, pure chiptune, authentic NES 2A03 chip sound, harder noise channel burst than dirt — higher frequency content, brief low pulse wave impact on the moment of contact like stone resonating, chip of rock flying, heavier and more satisfying than dirt, legacy mining mechanic, one-shot, no music
```

### Mine Crystal Strike
**Filename:** `legacy/mine_crystal` | **Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit crystal chime mining sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel strike followed by a bright ringing pulse wave note at high frequency with short decay — crystalline resonance, the crystal sings when struck, magical quality compared to dirt and rock, legacy mining mechanic, one-shot, no music
```

### Mine Break (Vein Depleted)
**Filename:** `legacy/mine_break` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit mining vein exhausted collapse sound effect, pure chiptune, authentic NES 2A03 chip sound, extended noise channel burst like stone crumbling combined with a descending pulse wave cascade from mid to low pitch, several fragments falling, the vein is spent, legacy mining mechanic, one-shot, no music
```

### Collect (Item Picked Up)
**Filename:** `legacy/collect` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit item collect pickup chime sound effect, pure chiptune, authentic NES 2A03 chip sound, bright ascending two-note pulse wave pickup sound like a classic video game item grab, high register, clean and satisfying, generic collect cue from mining prototype era, one-shot, no music
```

---

## RARITY REVEALS (6 one-shots)

### Reveal Common
**Filename:** `reveal/reveal_common` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit common card reveal soft chime sound effect, pure chiptune, authentic NES 2A03 chip sound, single modest pulse wave ascending two-note sound, understated and quick, this happens constantly so it cannot be annoying, clean and neutral, gray rarity tier, one-shot, no music
```

### Reveal Uncommon
**Filename:** `reveal/reveal_uncommon` | **Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit uncommon card reveal bright chime sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave three-note ascending arpeggio slightly brighter and longer than common, small but noticeable sparkle, green rarity tier, pleasant and encouraging, one-shot, no music
```

### Reveal Rare
**Filename:** `reveal/reveal_rare` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit rare card reveal shimmering chime sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave four-note ascending arpeggio with triangle wave harmonic underneath, noticeable shimmer quality, something worth noticing, blue rarity tier, pleased excitement, one-shot, no music
```

### Reveal Epic
**Filename:** `reveal/reveal_epic` | **Type:** One-shot | **Duration:** 0.5-0.7s

```
NES 8-bit epic card reveal power surge chime sound effect, pure chiptune, authentic NES 2A03 chip sound, two pulse wave channels creating ascending chord arpeggio — five notes climbing high — with noise channel impact burst on the top note, purple rarity tier, genuine excitement, this one matters, one-shot, no music
```

### Reveal Legendary
**Filename:** `reveal/reveal_legendary` | **Type:** One-shot | **Duration:** 0.7-1.0s

```
NES 8-bit legendary card reveal triumphant fanfare sound effect, pure chiptune, authentic NES 2A03 chip sound, bold pulse wave ascending six-note fanfare with triangle wave bass chord punching beneath, noise channel cymbal crash at the apex, sustained final note with shimmer, gold rarity tier, something extraordinary just appeared, one-shot, no music
```

### Reveal Mythic
**Filename:** `reveal/reveal_mythic` | **Type:** One-shot | **Duration:** 0.8-1.2s

```
NES 8-bit mythic card reveal cosmic fanfare sound effect, pure chiptune, authentic NES 2A03 chip sound, both pulse wave channels in parallel harmony climbing an ascending seven-note fanfare in a major scale, triangle wave bass doing deep booming octave leaps, noise channel sustained roar on the peak then shimmer descent, this is extraordinarily rare and the sound must feel world-stopping, rainbow mythic tier, one-shot, no music
```

---

## MASTERY AND STREAKS (3 one-shots)

### Mastery Glow (Card Mastery Up)
**Filename:** `mastery/mastery_glow` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit card mastery level up glow sound effect, pure chiptune, authentic NES 2A03 chip sound, warm ascending pulse wave three-note chime — same card played better than before, soft shimmer on the final note, triangle wave harmonic suggesting growth, in-run card power increasing, satisfying progression, one-shot, no music
```

### Mastery Fullscreen (Max Mastery)
**Filename:** `mastery/mastery_fullscreen` | **Type:** One-shot | **Duration:** 0.8-1.2s

```
NES 8-bit maximum mastery achievement fullscreen fanfare sound effect, pure chiptune, authentic NES 2A03 chip sound, bold three-phrase pulse wave fanfare — phrase one rises, phrase two develops, phrase three resolves triumphantly upward — triangle wave bass providing power, noise channel sparkle burst at climax, you have mastered this card completely, this is rare and deserves celebration, one-shot, no music
```

### Streak Milestone (Knowledge Streak)
**Filename:** `mastery/streak_milestone` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit quiz streak milestone achievement sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid ascending pulse wave arpeggio — six notes climbing quickly like a score counter ticking up — followed by a brief held note with shimmer, you answered multiple in a row correctly and the game is rewarding the streak, energetic upward momentum, one-shot, no music
```

---

## ENVIRONMENTAL (6 one-shots)

### Gaia Quip (Environmental Personality)
**Filename:** `legacy/gaia_quip` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit nature spirit personality vocal sound effect, pure chiptune, authentic NES 2A03 chip sound, rising then falling pulse wave blorp-chirp pattern with organic pitch wobble suggesting a sentient plant or nature elemental making a comment, playful and warm, duty cycle shifting mid-note for character, the dungeon itself has an opinion, one-shot, no music
```

### Lava Sizzle
**Filename:** `legacy/lava_sizzle` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit lava sizzle hiss sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel with high-pass filtering producing a sustained sizzling hiss quality that decays over 300ms, brief low triangle wave rumble underneath suggesting heat and mass, something hot and dangerous nearby, volcanic dungeon biome, one-shot, no music
```

### Gas Pocket (Toxic Gas Release)
**Filename:** `legacy/gas_pocket` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit gas pocket burst release sound effect, pure chiptune, authentic NES 2A03 chip sound, sudden noise channel burst starting very loud and quickly decaying like compressed gas escaping, pulse wave gliding downward rapidly in pitch as pressure releases, alarming and unpleasant, toxic gas dungeon hazard, one-shot, no music
```

### Oxygen Warning
**Filename:** `legacy/oxygen_warning` | **Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit oxygen low alert warning sound effect, pure chiptune, authentic NES 2A03 chip sound, two alternating pulse wave notes creating a beep-boop warning pattern like a safety alarm, slightly trembling with urgency, not panicked but urgent, pay attention right now, legacy oxygen mechanic prototype, one-shot, no music
```

### Oxygen Low
**Filename:** `legacy/oxygen_low` | **Type:** One-shot | **Duration:** 0.4-0.5s

```
NES 8-bit oxygen critically low urgent alarm sound effect, pure chiptune, authentic NES 2A03 chip sound, faster alternating pulse wave pair than oxygen_warning — higher pitch and more rapid, increasing urgency, plus noise channel underlying crackle suggesting system strain, breathless danger escalating, one-shot, no music
```

### Oxygen Critical
**Filename:** `legacy/oxygen_critical` | **Type:** One-shot | **Duration:** 0.5-0.7s

```
NES 8-bit oxygen critical emergency alarm sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid staccato high pulse wave alarm tones — four pulses quick then a descending fall — noise channel sustained burst underneath, maximum urgency, something terrible is about to happen, legacy environmental hazard, one-shot, no music
```

### Item Pickup (Generic)
**Filename:** `legacy/item_pickup` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit generic item pickup sound effect, pure chiptune, authentic NES 2A03 chip sound, bright rapid ascending three-note pulse wave arpeggio — quick and satisfying like a classic collectible pickup sound, slightly different timbre from collect to serve as an alternate pickup variant, one-shot, no music
```

---

## CARD PLAY (15 one-shots)

### Card Attack Swoosh
**Filename:** `combat/card_swoosh_attack` | **Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit sword slash card attack swoosh sound effect, pure chiptune, authentic NES 2A03 chip sound, sharp rising pulse wave frequency sweep from low C to high G over 150ms with aggressive duty cycle, noise channel burst for cutting impact texture at the peak, the card cuts through the air to strike, aggressive and decisive, one-shot, no music
```

### Card Shield Swoosh
**Filename:** `combat/card_swoosh_shield` | **Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit shield barrier card activation sound effect, pure chiptune, authentic NES 2A03 chip sound, heavy low pulse wave thud like a stone slab dropping into position followed immediately by a brief crystalline high-register chime, triangle wave bass impact resonating, protective and solid, a wall just went up, one-shot, no music
```

### Card Buff Swoosh
**Filename:** `combat/card_swoosh_buff` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit buff power-up card sparkle sound effect, pure chiptune, authentic NES 2A03 chip sound, ascending three-note pulse wave arpeggio in a major key — bright and positive — climbing quickly, triangle wave harmonic underneath gives warmth, noise channel sparkle burst at apex, positive energy being applied, one-shot, no music
```

### Card Debuff Swoosh
**Filename:** `combat/card_swoosh_debuff` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit debuff curse card sickening sound effect, pure chiptune, authentic NES 2A03 chip sound, descending pulse wave arpeggio in a minor key — three notes falling with detuned vibrato between them, duty cycle shift mid-phrase creating a warped quality, something foul applied to the enemy, sickly and unpleasant, one-shot, no music
```

### Card Wild Swoosh
**Filename:** `combat/card_swoosh_wild` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit wild magic chaos card sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid pulse wave bouncing between four unpredictably spaced pitches in quick succession — not a clean arpeggio, jagged and unexpected — noise channel burst, duty cycle shifting each note, chaotic energy released, wild card played, one-shot, no music
```

### Card Discard
**Filename:** `combat/card_discard` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit card discard soft toss sound effect, pure chiptune, authentic NES 2A03 chip sound, single short low pulse wave blip followed by quiet noise channel puff, understated and non-distracting, card tossed to the discard pile, should not compete with more important sounds, one-shot, no music
```

### Card Deal
**Filename:** `combat/card_deal` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit card deal snap sound effect, pure chiptune, authentic NES 2A03 chip sound, very short sharp noise channel burst bandpass filtered to produce a papery snap quality — like a single playing card snapping onto a table — brief high pulse wave tick on the impact point, one-shot, no music
```

### Card Shuffle
**Filename:** `combat/card_shuffle` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit card deck shuffle riffle sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid sequence of noise channel micro-bursts — eight to twelve quick pops in rapid succession simulating a card riffle — slight pitch variation across them creating organic shuffle quality, brief triangle wave rumble underneath, deck being randomized, one-shot, no music
```

### Card Select
**Filename:** `combat/card_select` | **Type:** One-shot | **Duration:** 0.08-0.12s

```
NES 8-bit card selection pick-up click sound effect, pure chiptune, authentic NES 2A03 chip sound, single very brief high pulse wave note — clean, crisp, immediate — card lifted from hand, must not be fatiguing over many plays per session, lightest possible presence, one-shot, no music
```

### Card Deselect
**Filename:** `combat/card_deselect` | **Type:** One-shot | **Duration:** 0.08-0.12s

```
NES 8-bit card deselect put-back click sound effect, pure chiptune, authentic NES 2A03 chip sound, single very brief mid pulse wave note — slightly lower pitch than card_select to convey return, same minimal footprint, card returned to hand without playing, one-shot, no music
```

### Card Fizzle
**Filename:** `combat/card_fizzle` | **Type:** One-shot | **Duration:** 0.3s

```
NES 8-bit fizzle fail sad card sound effect, pure chiptune, authentic NES 2A03 chip sound, descending pulse wave sliding from mid pitch to low with rapid volume decay like a deflating balloon, tiny noise channel puff, the card tried and got nothing — charged wrong so only 25% effect, pathetic but not punishing, one-shot, no music
```

### Card Exhaust
**Filename:** `combat/card_exhaust` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit card permanent exhaust destruction sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel crackling extended burst like paper igniting and burning to ash, pulse wave descending quickly from mid to silence while the noise plays, triangle wave brief low rumble, the card is gone permanently from this run, more final and weighty than discard, one-shot, no music
```

### Charge Initiate
**Filename:** `combat/charge_initiate` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit charge power buildup knowledge activating sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave rising steadily in pitch from low C up to high E over 500ms like a capacitor charging toward full, triangle wave hum building in volume alongside, noise channel sparkle entering near the top, tension and anticipation of the quiz about to begin, one-shot, no music
```

### Double Strike
**Filename:** `combat/double_strike` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit double hit rapid attack sound effect, pure chiptune, authentic NES 2A03 chip sound, two quick noise channel impact bursts in fast succession separated by only 80ms — whap-whap — each with a short pulse wave accent, the second hit slightly higher pitched than the first, two separate strikes landing, more satisfying than a single hit, one-shot, no music
```

### Inscription Resolve
**Filename:** `combat/inscription_resolve` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit inscription rune magical resolution sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave producing a two-note interval that resolves from dissonant to consonant — like a musical tension releasing — triangle wave bass note supporting the resolution, noise channel brief shimmer, ancient rune effect triggering from card inscription, mystical and deliberate, one-shot, no music
```

---

## ENEMY ACTIONS (11 one-shots)

### Enemy Intent
**Filename:** `combat/enemy_intent` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit enemy thinking intent reveal sound effect, pure chiptune, authentic NES 2A03 chip sound, low pulse wave descending two-note phrase — a short ominous question mark in sound — the enemy has decided what to do next turn, subtle and dark without being dramatic, one-shot, no music
```

### Enemy Attack
**Filename:** `combat/enemy_attack` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit enemy melee strike impact sound effect, pure chiptune, authentic NES 2A03 chip sound, heavy noise channel burst combined with a low pulse wave thud, blunt force impact, the enemy hit you, more raw and brutal than card attack sounds, screen-shake quality, one-shot, no music
```

### Enemy Charge Up
**Filename:** `combat/enemy_charge_up` | **Type:** One-shot | **Duration:** 0.6-1.0s

```
NES 8-bit enemy menacing power charge winding up sound effect, pure chiptune, authentic NES 2A03 chip sound, low pulse wave drone rising slowly from a deep root note upward with increasing tremolo vibrato frequency, building dread over 600ms, noise channel faint static growing louder, triangle wave low pedal tone, the enemy is preparing something devastating and you cannot stop it this turn, one-shot, no music
```

### Enemy Charge Release
**Filename:** `combat/enemy_charge_release` | **Type:** One-shot | **Duration:** 0.4-0.7s

```
NES 8-bit enemy charged attack explosive release sound effect, pure chiptune, authentic NES 2A03 chip sound, massive noise channel burst — louder and longer than a normal attack — pulse wave dropping from high to low immediately after the burst, triangle wave deep thud, everything that was built up just discharged at once, the big attack lands, one-shot, no music
```

### Enemy Defend
**Filename:** `combat/enemy_defend` | **Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit enemy shield raise block sound effect, pure chiptune, authentic NES 2A03 chip sound, low-frequency noise channel grinding burst like heavy stone grinding into place, pulse wave low thud at impact point, the enemy braced itself, heavy and immovable quality, one-shot, no music
```

### Enemy Buff (Self-Buff)
**Filename:** `combat/enemy_buff` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit enemy self-empowering dark buff sound effect, pure chiptune, authentic NES 2A03 chip sound, rising pulse wave with sawtooth-adjacent duty cycle creating an aggressive gnarly tone, enemy getting stronger, this is a threat not a gift, noise channel crackle, one-shot, no music
```

### Enemy Debuff Player
**Filename:** `combat/enemy_debuff_player` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit enemy curse debuff applied to player sound effect, pure chiptune, authentic NES 2A03 chip sound, descending pulse wave with detuned wobble landing on a dissonant interval, something was placed on you, uncomfortable and undermining, distinct from self-buff to communicate direction of the effect, one-shot, no music
```

### Enemy Enrage
**Filename:** `combat/enemy_enrage` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit enemy berserker enrage roar sound effect, pure chiptune, authentic NES 2A03 chip sound, low pulse wave beginning with heavy vibrato trembling like contained fury, then rapidly rising pitch through an aggressive sweep, noise channel sustained burst like a bestial growl, triangle wave low rumble, the enemy just became dramatically more dangerous, one-shot, no music
```

### Enemy Phase Transition
**Filename:** `combat/enemy_phase_transition` | **Type:** One-shot | **Duration:** 0.8-1.2s

```
NES 8-bit enemy phase shift transformation sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel extended crackle burst, pulse wave doing a chromatic descent then re-ascending in a new register — the enemy changed form — triangle wave deep low thud at the moment of transition, dramatic and world-altering, the fight just got more complicated, one-shot, no music
```

### Enemy Heal
**Filename:** `combat/enemy_heal` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit enemy self-heal restorative sound effect, pure chiptune, authentic NES 2A03 chip sound, warm ascending pulse wave arpeggio similar to player heal but with a minor third in it creating a slightly unsettling warmth — healing is good for them but bad for you — triangle wave harmonic, enemy HP restoring is bad news, one-shot, no music
```

### Enemy Dialogue
**Filename:** `combat/enemy_dialogue` | **Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit enemy speech bark blorp sound effect, pure chiptune, authentic NES 2A03 chip sound, short pulse wave pattern with duty cycle modulation simulating a monstrous voice cadence — two to three notes with vocal-like pitch inflection, like an RPG dialogue chirp but more monstrous, the enemy said something, one-shot, no music
```

---

## PLAYER HEALTH (8 one-shots)

### Player Damage
**Filename:** `combat/player_damage` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit player hit takes damage sound effect, pure chiptune, authentic NES 2A03 chip sound, low pulse wave heavy thud plus brief noise channel impact, painful and immediate, you got hit, less sharp than the enemy attack sound to communicate it from your perspective, one-shot, no music
```

### Shield Absorb
**Filename:** `combat/shield_absorb` | **Type:** One-shot | **Duration:** 0.15-0.25s

```
NES 8-bit shield absorb deflect block sound effect, pure chiptune, authentic NES 2A03 chip sound, high-pitched pulse wave metallic ping — sharp and crystalline — brief noise channel burst, the shield held, damage was not direct, reassuring, one-shot, no music
```

### Shield Break
**Filename:** `combat/shield_break` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit shield shattering break sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid descending pulse wave sweep falling quickly through an octave combined with extended noise channel burst like glass shattering, protection gone, alarming, you are now fully exposed, one-shot, no music
```

### Shield Gain
**Filename:** `combat/shield_gain` | **Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit shield applied gain barrier sound effect, pure chiptune, authentic NES 2A03 chip sound, ascending pulse wave three-note arpeggio — bright and protective — A C E climbing up, triangle wave harmonic sustaining, barrier forming around you, safe for now, one-shot, no music
```

### Player Heal
**Filename:** `combat/player_heal` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit player healing restoration sound effect, pure chiptune, authentic NES 2A03 chip sound, warm ascending pulse wave arpeggio four notes in a major key climbing gently — C E G C — triangle wave soft sustained harmonic, soothing and restorative, health returning, this is unambiguously good, one-shot, no music
```

### Immunity Trigger
**Filename:** `combat/immunity_trigger` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit immunity invincible frame trigger sound effect, pure chiptune, authentic NES 2A03 chip sound, brief rapid pulse wave flutter — like rapid tremolo on a single high note — creating a shimmer-shield quality, noise channel micro-burst, damage was completely negated, magical protection activated, one-shot, no music
```

### Player Defeated
**Filename:** `combat/player_defeated` | **Type:** One-shot | **Duration:** 1.0-2.0s

```
NES 8-bit player death final heartbeat sound effect, pure chiptune, authentic NES 2A03 chip sound, three slow deliberate low pulse wave thuds at decreasing tempo — roughly 80 BPM, then 50 BPM, then 30 BPM — silence between each beat growing longer, triangle wave very quiet low drone barely audible, the last thud barely registers and then silence, a run ends, haunting and quiet, one-shot, no music
```

### Low HP Warning
**Filename:** `combat/low_hp_warning` | **Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit low health alert warning sound effect, pure chiptune, authentic NES 2A03 chip sound, two pulse wave notes in a minor second interval — E and F — played in quick succession as an alarm ping, slightly trembling with urgency, this is the one-shot cue that triggers when you drop below the warning threshold, distinct from the loop version, one-shot, no music
```

---

## STATUS EFFECTS (12 one-shots)

### Status Poison Apply
**Filename:** `status/status_poison_apply` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit poison toxic bubble apply sound effect, pure chiptune, authentic NES 2A03 chip sound, descending pulse wave blorp from mid to low pitch with duty cycle modulation mid-note creating a wet bubbling quality, sickly and organic, toxic substance just infected the target, one-shot, no music
```

### Status Poison Tick
**Filename:** `status/status_poison_tick` | **Type:** One-shot | **Duration:** 0.08-0.12s

```
NES 8-bit poison damage tick recurring sound effect, pure chiptune, authentic NES 2A03 chip sound, single very brief low pulse wave blip with a slight downward pitch droop — minimal but distinct, heard every turn the status is active so cannot be obnoxious, one-shot, no music
```

### Status Burn Apply
**Filename:** `status/status_burn_apply` | **Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit fire ignite burn apply sound effect, pure chiptune, authentic NES 2A03 chip sound, rising noise channel burst starting from silence — fire catching — combined with ascending pulse wave, aggressive upward energy, heat igniting, hotter than poison, one-shot, no music
```

### Status Burn Tick
**Filename:** `status/status_burn_tick` | **Type:** One-shot | **Duration:** 0.1-0.15s

```
NES 8-bit burn fire tick damage sound effect, pure chiptune, authentic NES 2A03 chip sound, brief noise channel crackle — shorter than the apply sound, just a small ember crackling, recurring every turn, must be distinct from poison tick but equally unobtrusive, one-shot, no music
```

### Status Bleed Apply
**Filename:** `status/status_bleed_apply` | **Type:** One-shot | **Duration:** 0.15-0.25s

```
NES 8-bit bleed slash cut apply sound effect, pure chiptune, authentic NES 2A03 chip sound, sharp noise channel cut burst followed immediately by a brief descending pulse wave — the cut lands and then something drips — quick and uncomfortable, one-shot, no music
```

### Status Weakness Apply
**Filename:** `status/status_weakness_apply` | **Type:** One-shot | **Duration:** 0.3s

```
NES 8-bit weakness drain deflation apply sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave descending slowly from mid to low pitch over 300ms with slight pitch wobble, energy draining out, the target is compromised, strength leaving, one-shot, no music
```

### Status Vulnerability Apply
**Filename:** `status/status_vulnerability_apply` | **Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit vulnerability crack apply sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel brittle crack burst followed by pulse wave descending interval, armor cracked and compromised, distinct from weakness — vulnerability means receiving more damage, the crack sound communicates broken defense, one-shot, no music
```

### Status Strength Apply
**Filename:** `status/status_strength_apply` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit strength power buff apply sound effect, pure chiptune, authentic NES 2A03 chip sound, short aggressive rising pulse wave with duty cycle near 50% for maximum harmonic content — rev-up quality — getting stronger and more powerful, brief and confident, one-shot, no music
```

### Status Regen Apply
**Filename:** `status/status_regen_apply` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit regeneration healing apply sound effect, pure chiptune, authentic NES 2A03 chip sound, two pulse wave notes forming a slow sustained major interval — warm and resonant — suggesting ongoing recovery over time, triangle wave bass supporting, distinct from instant heal by being more sustained and gentle rather than ascending, one-shot, no music
```

### Status Focus Apply
**Filename:** `status/status_focus_apply` | **Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit focus mental clarity apply sound effect, pure chiptune, authentic NES 2A03 chip sound, clean high pulse wave ascending two-note sound with a moment of silence between them like a mental click locking into place, crystalline and precise, concentration sharpening, one-shot, no music
```

### Status Expire
**Filename:** `status/status_expire` | **Type:** One-shot | **Duration:** 0.15-0.25s

```
NES 8-bit status effect expiration fading sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave single note that descends and fades simultaneously — the effect running out of energy — quiet and brief, a buff or debuff just wore off, neutral communication, one-shot, no music
```

### Status Regen Tick
**Filename:** `status/status_regen_tick` | **Type:** One-shot | **Duration:** 0.1-0.15s

```
NES 8-bit regeneration tick healing pulse sound effect, pure chiptune, authentic NES 2A03 chip sound, single quiet warm pulse wave blip — higher pitched than poison tick to communicate positivity — brief upward pitch swoop, a little health returning each turn, gentle and reassuring, one-shot, no music
```

---

## CHAIN SYSTEM (7 one-shots)

### Chain Link 1
**Filename:** `combat/chain_link_1` | **Type:** One-shot | **Duration:** 0.1-0.2s | **Key:** A5 (880Hz)

```
NES 8-bit chain link first connection metallic clink sound effect, pure chiptune, authentic NES 2A03 chip sound, single pulse wave note at A5 880Hz with brief noise burst for metallic texture, clean and precise, first link of a knowledge chain forging, chain multiplier beginning to build at 1.0x, one-shot, no music
```

### Chain Link 2
**Filename:** `combat/chain_link_2` | **Type:** One-shot | **Duration:** 0.1-0.2s | **Key:** B5 (988Hz)

```
NES 8-bit chain link second connection sound effect, pure chiptune, authentic NES 2A03 chip sound, single pulse wave note at B5 988Hz — a whole step higher than chain link 1 — with brief noise burst, same metallic quality but building momentum, two facts linked in sequence, chain multiplier growing, one-shot, no music
```

### Chain Link 3
**Filename:** `combat/chain_link_3` | **Type:** One-shot | **Duration:** 0.1-0.2s | **Key:** C6 (1047Hz)

```
NES 8-bit chain link third connection sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave note at C6 1047Hz with added triangle wave harmonic a fifth below — richer timbre at three links — noise burst, the chain is building power, three themed facts linked, one-shot, no music
```

### Chain Link 4
**Filename:** `combat/chain_link_4` | **Type:** One-shot | **Duration:** 0.1-0.2s | **Key:** D6 (1175Hz)

```
NES 8-bit chain link fourth connection high energy sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave note at D6 1175Hz with shimmer — duty cycle slightly modulated after the attack — triangle wave harmonic, chain momentum building toward maximum, nearly there, one-shot, no music
```

### Chain Link 5 (Maximum)
**Filename:** `combat/chain_link_5` | **Type:** One-shot | **Duration:** 0.3-0.5s | **Key:** E6 chord

```
NES 8-bit chain maximum power five-link chord fanfare sound effect, pure chiptune, authentic NES 2A03 chip sound, both pulse wave channels playing together — one on E6 G6 another on B6 — forming a full E major chord resolving triumphantly, noise channel impact burst on the attack, triangle wave bass power note, maximum chain achieved at 3x damage multiplier, five themed facts linked, one-shot, no music
```

### Chain Break
**Filename:** `combat/chain_break` | **Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit chain snap shatter break sound effect, pure chiptune, authentic NES 2A03 chip sound, sharp high noise channel crack — a whip-crack quality — followed by three rapidly descending pulse wave pings scattering downward from high to low in quick succession, chain shattered and momentum lost, wrong answer broke the streak, one-shot, no music
```

### Chain Momentum
**Filename:** `combat/chain_momentum` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit chain momentum surge bonus activation sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid ascending pulse wave arpeggio — five notes climbing quickly — followed by a brief sustained shimmer on the top note, chain momentum bonus triggering — the AP surcharge for charging is waived, energetic upward rush of power, one-shot, no music
```

---

## TURN FLOW (10 one-shots)

### Enemy Turn Start
**Filename:** `turn/enemy_turn_start` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit enemy turn begin ominous shift sound effect, pure chiptune, authentic NES 2A03 chip sound, low pulse wave descending two-note phrase — a minor second dropping — dark and brief, attention shifts to the enemy, their move now, one-shot, no music
```

### AP Spend
**Filename:** `turn/ap_spend` | **Type:** One-shot | **Duration:** 0.08-0.12s

```
NES 8-bit action point spend click sound effect, pure chiptune, authentic NES 2A03 chip sound, single brief mid-register pulse wave note with slight downward pitch — a small cost paid — minimal and unobtrusive, heard potentially many times per turn, one-shot, no music
```

### AP Gain
**Filename:** `turn/ap_gain` | **Type:** One-shot | **Duration:** 0.1-0.15s

```
NES 8-bit action point restore gain sound effect, pure chiptune, authentic NES 2A03 chip sound, single brief upward-tilting mid-register pulse wave note — small but distinctly positive compared to spend — AP being returned or bonus AP acquired, one-shot, no music
```

### AP Exhausted
**Filename:** `turn/ap_exhausted` | **Type:** One-shot | **Duration:** 0.15-0.25s

```
NES 8-bit action points empty exhausted sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave low thud followed by very brief descending slide, out of AP, cannot play more cards this turn without a bonus, flat and final, one-shot, no music
```

### Surge Announce
**Filename:** `surge/surge_announce` | **Type:** One-shot | **Duration:** 0.6-1.0s

```
NES 8-bit Knowledge Surge dramatic announcement sound effect, pure chiptune, authentic NES 2A03 chip sound, deep triangle wave bass thrum beginning at low frequency and sustaining, pulse wave rising golden energy sweep ascending from low G to high E over 500ms, noise channel sparkle burst at the peak when the surge is announced, all charges cost zero AP this turn, one-shot, no music
```

### Surge End
**Filename:** `surge/surge_end` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit surge ending power down sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave descending from the high surge note back down slowly with slow vibrato, triangle wave bass fading, noise channel brief dissipation burst, the surge turn is over and normal AP costs resume, bittersweet and fading, one-shot, no music
```

### Perfect Turn
**Filename:** `turn/perfect_turn` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit perfect turn achievement reward sound effect, pure chiptune, authentic NES 2A03 chip sound, three ascending pulse wave notes with deliberate pacing — ta-ta-TAAA — final note held slightly with shimmer, you played every card in the optimal way this turn, brief celebration before the next enemy action, one-shot, no music
```

### Combo 10 (10-Hit Combo)
**Filename:** `turn/combo_10` | **Type:** One-shot | **Duration:** 0.5-0.7s

```
NES 8-bit ten hit combo milestone fanfare sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid ascending pulse wave run — eight notes climbing quickly — arriving at a bright triumphant two-note interval held with shimmer, noise channel burst at the peak, ten consecutive hits achieved, exciting landmark, one-shot, no music
```

### End Turn Click
**Filename:** `turn/end_turn_click` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit decisive end turn button press sound effect, pure chiptune, authentic NES 2A03 chip sound, low pulse wave thud heavier than a standard button click — this is a significant action not just navigation — weighted with finality, your turn is over by choice, one-shot, no music
```

---

## RELIC TRIGGERS (8 one-shots)

### Relic Trigger Generic
**Filename:** `relic/relic_trigger_generic` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit relic passive activation magical pulse sound effect, pure chiptune, authentic NES 2A03 chip sound, quick ascending pulse wave two-note sound with brief shimmer — something in your inventory just activated passively — subtle and magical without being distracting from the main action, one-shot, no music
```

### Relic Trigger Defensive
**Filename:** `relic/relic_trigger_defensive` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit relic defensive protection trigger sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave producing a brief low-to-mid ascending two-note sound with shield-quality resonance — similar to shield_gain but shorter and more passive — a defensive relic just activated for you, one-shot, no music
```

### Relic Trigger Offensive
**Filename:** `relic/relic_trigger_offensive` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit relic offensive attack trigger sound effect, pure chiptune, authentic NES 2A03 chip sound, sharp quick noise channel burst with a brief high-register pulse wave accent — more aggressive than the generic trigger, an offensive relic just added damage or an attack, one-shot, no music
```

### Relic Trigger Heal
**Filename:** `relic/relic_trigger_heal` | **Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit relic healing trigger warm restoration sound effect, pure chiptune, authentic NES 2A03 chip sound, warm ascending pulse wave two-note sound with triangle wave harmonic — brief version of player heal — a healing relic just ticked and returned some HP, one-shot, no music
```

### Relic Trigger AP
**Filename:** `relic/relic_trigger_ap` | **Type:** One-shot | **Duration:** 0.15-0.25s

```
NES 8-bit relic AP action point grant trigger sound effect, pure chiptune, authentic NES 2A03 chip sound, high bright pulse wave upward ping — a bit more energy than ap_gain — relic just granted you bonus AP to spend, quick and positive, one-shot, no music
```

### Relic Card Spawn
**Filename:** `relic/relic_card_spawn` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit relic card creation materialize sound effect, pure chiptune, authentic NES 2A03 chip sound, ascending pulse wave arpeggio with noise channel papery shuffle burst at the end — a card appearing from nowhere in your hand — magical creation, one-shot, no music
```

### Relic Death Prevent
**Filename:** `relic/relic_death_prevent` | **Type:** One-shot | **Duration:** 0.8-1.2s

```
NES 8-bit death prevention miracle last-stand save sound effect, pure chiptune, authentic NES 2A03 chip sound, 200ms silence — you should have died — then a massive heartbeat pulse wave THUD that shouldn't be possible, followed by ascending life-returning arpeggio climbing from low to high rapidly, triangle wave surging, the relic defied death on your behalf, dramatic life reversal, one-shot, no music
```

### Relic Capacitor Release
**Filename:** `relic/relic_capacitor_release` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit capacitor relic charge release discharge sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave starting at a high sustained note that was clearly building — then noise channel explosive discharge burst — then pulse wave rapidly descending as the stored energy expends, like a battery fully discharging at once, electric and satisfying, one-shot, no music
```

---

## QUIZ (7 one-shots)

### Quiz Appear
**Filename:** `quiz/quiz_appear` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit quiz panel interface appearing sound effect, pure chiptune, authentic NES 2A03 chip sound, rising pulse wave sweep from low to a settled mid note — system powering up — followed by a brief shimmer indicating readiness, quiz overlay sliding in, knowledge interface activating, question incoming, one-shot, no music
```

### Quiz Answer Select
**Filename:** `quiz/quiz_answer_select` | **Type:** One-shot | **Duration:** 0.1-0.15s

```
NES 8-bit quiz answer option selected click sound effect, pure chiptune, authentic NES 2A03 chip sound, single crisp mid-register pulse wave note slightly longer than card_select — this is a meaningful choice not just navigation — answer highlighted before confirmation, one-shot, no music
```

### Quiz Speed Bonus
**Filename:** `quiz/quiz_speed_bonus` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit quiz speed bonus fast answer reward sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid ascending pulse wave six-note run followed immediately by a bright held note — answered so quickly there's a bonus, streak of speed, distinct from regular correct by being faster and more electric, one-shot, no music
```

### Quiz Dismiss
**Filename:** `quiz/quiz_dismiss` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit quiz panel dismiss close sound effect, pure chiptune, authentic NES 2A03 chip sound, brief descending pulse wave followed by tiny noise burst — quiz panel sliding away — understated, the charge result has resolved and the overlay closes, one-shot, no music
```

### Quiz Timer Tick
**Filename:** `quiz/quiz_timer_tick` | **Type:** One-shot | **Duration:** 0.04-0.06s

```
NES 8-bit quiz speed bonus timer tick metronome sound effect, pure chiptune, authentic NES 2A03 chip sound, single extremely brief high pulse wave note — a metronomic tick marking time on the speed bonus timer — must be absolutely minimal to not distract from reading the question, one-shot, no music
```

### Quiz Memory Tip
**Filename:** `quiz/quiz_memory_tip` | **Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit memory mnemonic tip notification sound effect, pure chiptune, authentic NES 2A03 chip sound, gentle two-note pulse wave sound — ascending minor third — with a slight echo-like decay, a learning aid appeared, something to help you remember, thoughtful and warm without being intrusive, one-shot, no music
```

### Quiz Streak
**Filename:** `quiz/quiz_streak` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit quiz answer streak milestone fanfare sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid five-note ascending pulse wave run cresting into a bright triumphant held note with shimmer — same energy as streak_milestone but positioned in quiz context — multiple correct answers in a row during charges, one-shot, no music
```

---

## ENCOUNTER LIFECYCLE (7 one-shots)

### Encounter Start
**Filename:** `encounter/encounter_start` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit normal battle encounter start sound effect, pure chiptune, authentic NES 2A03 chip sound, heavy noise channel drum impact followed immediately by a rising pulse wave brass sting — three notes ascending — adrenaline spike, fight beginning, standard enemy encountered, one-shot, no music
```

### Encounter Start Boss
**Filename:** `encounter/encounter_start_boss` | **Type:** One-shot | **Duration:** 0.8-1.2s

```
NES 8-bit boss battle dramatic entrance sound effect, pure chiptune, authentic NES 2A03 chip sound, massive low pulse wave chord on both channels sustained with full harmonic content, noise channel crash impact, triangle wave thundering low octave below, ground shaking, something enormous just entered, terrifying weight and finality, one-shot, no music
```

### Encounter Start Elite
**Filename:** `encounter/encounter_start_elite` | **Type:** One-shot | **Duration:** 0.6-1.0s

```
NES 8-bit elite enemy encounter dramatic start sound effect, pure chiptune, authentic NES 2A03 chip sound, between normal and boss — two-channel pulse wave power chord followed by noise channel impact, triangle wave brief low thud, more serious than a standard fight but not as earth-shattering as a boss, one-shot, no music
```

### Encounter Victory
**Filename:** `encounter/encounter_victory` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit combat victory fanfare sound effect, pure chiptune, authentic NES 2A03 chip sound, bright ascending four-note pulse wave melody — triumphant and brief — noise channel cymbal on the final note, enemy defeated and you survived, small celebration before the rewards screen, one-shot, no music
```

### Encounter Defeat
**Filename:** `encounter/encounter_defeat` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit combat defeat failure sound effect, pure chiptune, authentic NES 2A03 chip sound, slow descending pulse wave three-note phrase — the classic game-over descend — each note lower and slightly longer than the last, triangle wave low drone sustaining, noise channel quiet static, run is not over but this fight is lost, one-shot, no music
```

### Boss Defeated
**Filename:** `encounter/boss_defeated` | **Type:** One-shot | **Duration:** 0.8-1.2s

```
NES 8-bit boss death destruction explosion sound effect, pure chiptune, authentic NES 2A03 chip sound, extended noise channel burst like massive shattering — longer than any other impact sound — pulse wave doing a rapid descending cascade after the burst, triangle wave deep rumble, the massive thing is collapsing, significant achievement, one-shot, no music
```

### Boss Intro
**Filename:** `encounter/boss_intro` | **Type:** One-shot | **Duration:** 1.0-1.5s

```
NES 8-bit boss intro ceremony dramatic reveal sound effect, pure chiptune, authentic NES 2A03 chip sound, silence for 300ms — attention gathering — then triangle wave deep note slowly rising, pulse wave joining with a sustained ominous interval, noise channel growing from nothing to a rumble, a deliberate slow build that announces the boss is about to appear on screen, one-shot, no music
```

---

## MAP AND NAVIGATION (6 one-shots)

### Map Open
**Filename:** `map/map_open` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit dungeon map unfurl opening sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel parchment-unfurl burst combined with pulse wave rising three-note sound, the map spreading out to reveal the dungeon layout, one-shot, no music
```

### Map Node Hover
**Filename:** `map/map_node_hover` | **Type:** One-shot | **Duration:** 0.06-0.1s

```
NES 8-bit map node hover cursor sound effect, pure chiptune, authentic NES 2A03 chip sound, single very brief pulse wave note — slightly different timbre from card_select to be distinct — hovering over a map location, must not be fatiguing while browsing the map, one-shot, no music
```

### Map Node Click
**Filename:** `map/map_node_click` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit map path selection footstep sound effect, pure chiptune, authentic NES 2A03 chip sound, low noise channel footstep-quality thud plus brief pulse wave confirmation note, destination chosen, path selected, onward, one-shot, no music
```

### Map Path Reveal
**Filename:** `map/map_path_reveal` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit dungeon path revealing unveil sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave doing a brief three-note ascending run as the path lights up or branches appear, noise channel texture, new routes revealing themselves, exploratory and hopeful, one-shot, no music
```

### Floor Transition
**Filename:** `map/floor_transition` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit dungeon floor descent staircase sound effect, pure chiptune, authentic NES 2A03 chip sound, four noise channel thuds in sequence with decreasing pitch — footsteps descending stone stairs — followed by a deep triangle wave boom at the bottom landing, deeper into the dungeon, one-shot, no music
```

### Room Transition
**Filename:** `map/room_transition` | **Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit dungeon room transition door sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel door-adjacent creak or whoosh combined with brief pulse wave ambient shift, lighter than floor_transition — same floor different room, one-shot, no music
```

---

## HUB (4 one-shots)

### Hub Welcome
**Filename:** `hub/hub_welcome` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit hub campfire welcome home arrival sound effect, pure chiptune, authentic NES 2A03 chip sound, warm ascending pulse wave four-note arpeggio in a major key — welcoming and familiar — triangle wave bass supporting, arriving at the safe hub between runs, you made it back, one-shot, no music
```

### Hub Start Run
**Filename:** `hub/hub_start_run` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit adventure beginning run start horn call sound effect, pure chiptune, authentic NES 2A03 chip sound, bold pulse wave three-note ascending phrase like a war horn call — the quest begins — decisive and forward-moving, stepping into the dungeon from the hub, one-shot, no music
```

### Hub Button Library
**Filename:** `hub/hub_button_library` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit library book knowledge button click sound effect, pure chiptune, authentic NES 2A03 chip sound, brief ascending two-note pulse wave with a slight academic quality — higher pitched and cleaner than a generic button — opening the card library to study what you know, one-shot, no music
```

### Hub Button Settings
**Filename:** `hub/hub_button_settings` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit settings gear configuration button click sound effect, pure chiptune, authentic NES 2A03 chip sound, brief pulse wave with a mechanical quality — slightly lower and more utilitarian than the library button — opening settings panel, one-shot, no music
```

---

## SHOP (22 one-shots)

### Shop Open
**Filename:** `shop/shop_open` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit merchant shop door bell open sound effect, pure chiptune, authentic NES 2A03 chip sound, brief noise channel whoosh followed by a pleasant pulse wave chime — like entering a shop to a door bell — warm and inviting, goods available for purchase, one-shot, no music
```

### Shop Purchase
**Filename:** `shop/shop_purchase` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit cash register coin transaction purchase sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel brief burst plus ascending pulse wave two-note ching — ka-ching quality — gold exchanged for goods, transaction complete, one-shot, no music
```

### Shop Insufficient Gold
**Filename:** `shop/shop_insufficient_gold` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit insufficient gold denied bonk sound effect, pure chiptune, authentic NES 2A03 chip sound, two low pulse wave notes forming a descending minor second — cannot afford it — gentle negative, not harsh, just informative, try earning more gold, one-shot, no music
```

### Shop Haggle Start
**Filename:** `shop/shop_haggle_start` | **Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit haggling negotiation begin sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave producing a quick rising then falling note like a conversational lilt — opening a negotiation — slightly comical and merchant-like, one-shot, no music
```

### Shop Haggle Success
**Filename:** `shop/shop_haggle_success` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit haggle deal struck success sound effect, pure chiptune, authentic NES 2A03 chip sound, rising pulse wave arpeggio with a handshake-adjacent quality — deal made — triangle wave bass note resolved, price reduced, satisfying negotiation win, one-shot, no music
```

### Shop Close
**Filename:** `shop/shop_close` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit shop close door leaving sound effect, pure chiptune, authentic NES 2A03 chip sound, brief descending pulse wave with noise channel door close, leaving the merchant, short and utilitarian, one-shot, no music
```

### Shop Sell
**Filename:** `shop/shop_sell` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit item sold exchange transaction sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel brief thud of item being placed down plus brief upward pulse wave coin sound, slightly different from shop_purchase — you are receiving gold not spending it, one-shot, no music
```

### Shop Removal Burn
**Filename:** `shop/shop_removal_burn` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit card removal burning destruction sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel crackling fire burst like something igniting, pulse wave descending briefly, card burning away from your deck permanently, this is catharsis not loss — deck thinning, one-shot, no music
```

### Shop Removal Complete
**Filename:** `shop/shop_removal_complete` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit card removal complete clean confirmation sound effect, pure chiptune, authentic NES 2A03 chip sound, brief pulse wave ascending two-note confirmation sound — the card is gone and your deck is leaner — cleaner than removal_burn, this is the completion sound after the fire, one-shot, no music
```

### Shop Transform Shimmer
**Filename:** `shop/shop_transform_shimmer` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit card transform shimmer magical phase sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave rapidly cycling an ascending shimmer arpeggio — sparkling transformation beginning — noise channel micro-burst texture, a card beginning to change, one-shot, no music
```

### Shop Transform Dissolve
**Filename:** `shop/shop_transform_dissolve` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit card dissolve disintegrate transformation sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel sustained crackle-and-fade combined with descending pulse wave, the card breaking down into component energy before reshaping, dissolution phase of transformation, one-shot, no music
```

### Shop Transform Vortex
**Filename:** `shop/shop_transform_vortex` | **Type:** One-shot | **Duration:** 0.5-0.7s

```
NES 8-bit magical vortex swirling transformation sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave rapidly cycling with increasing speed — swirling vortex energy — triangle wave bass providing depth, noise channel sustained wind-adjacent texture, chaotic but controlled transformation energy, one-shot, no music
```

### Shop Transform Split
**Filename:** `shop/shop_transform_split` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit card split bifurcate transformation sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel sharp split burst — like tearing paper — followed by two brief pulse wave notes played in quick sequence on different pitches suggesting two separate things, one became two, one-shot, no music
```

### Shop Transform Materialize
**Filename:** `shop/shop_transform_materialize` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit card materializing appearing from energy sound effect, pure chiptune, authentic NES 2A03 chip sound, ascending pulse wave building from quiet to full volume — materializing from nothing — triangle wave bass arriving at full note, noise channel sparkle, the new card appearing into existence, one-shot, no music
```

### Shop Transform Reveal
**Filename:** `shop/shop_transform_reveal` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit transformation result reveal unveil sound effect, pure chiptune, authentic NES 2A03 chip sound, brief silence then a clean pulse wave ascending two-note reveal — like lifting a curtain — shimmer on the final note, the transformed card's identity is shown, anticipation resolved, one-shot, no music
```

### Shop Transform Confirm
**Filename:** `shop/shop_transform_confirm` | **Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit transformation confirmed accepted sound effect, pure chiptune, authentic NES 2A03 chip sound, satisfying mid-register pulse wave resolution chord — two notes resolving to a unison or octave — the transformation is accepted and locked in, one-shot, no music
```

### Shop Price Tick
**Filename:** `shop/shop_price_tick` | **Type:** One-shot | **Duration:** 0.05-0.08s

```
NES 8-bit price counter tick increment sound effect, pure chiptune, authentic NES 2A03 chip sound, single extremely brief high pulse wave tick — like a price counter advancing — minimal and non-intrusive, heard while price numbers update during interactions, one-shot, no music
```

### Shop Unaffordable
**Filename:** `shop/shop_unaffordable` | **Type:** One-shot | **Duration:** 0.1-0.15s

```
NES 8-bit unaffordable item negative indication sound effect, pure chiptune, authentic NES 2A03 chip sound, single low brief pulse wave blip with downward pitch — shorter and more subtle than shop_insufficient_gold which plays on a click attempt — this is the passive hover indication that something costs too much, one-shot, no music
```

### Shop Card Appear
**Filename:** `shop/shop_card_appear` | **Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit shop card merchandise appearing display sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave with a brief ascending shimmer, card sliding into view for purchase consideration, lighter and more incidental than a reward card, one-shot, no music
```

### Shop Card Flip
**Filename:** `shop/shop_card_flip` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit card flip over browse sound effect, pure chiptune, authentic NES 2A03 chip sound, brief noise channel papery flip burst with a brief pulse wave ping — card turning over to reveal what it is — crisp and physical, one-shot, no music
```

### Shop Coin Fly
**Filename:** `shop/shop_coin_fly` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit coins flying gold arc sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid high pulse wave ascending five-note cascade with slight stagger between notes like individual coins in an arc, bright and satisfying, gold moving from player to merchant or vice versa, one-shot, no music
```

### Shop Bark
**Filename:** `shop/shop_bark` | **Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit merchant NPC speech bark vocal sound effect, pure chiptune, authentic NES 2A03 chip sound, short pulse wave pattern with duty cycle modulation creating a human voice cadence — two to three pitches suggesting speech inflection — the merchant said something, RPG dialogue chirp, one-shot, no music
```

---

## REST SITE (5 one-shots)

### Rest Open
**Filename:** `rest/rest_open` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit rest site arrival warm opening sound effect, pure chiptune, authentic NES 2A03 chip sound, warm pulse wave two-note ascending sound — exhale of relief — combined with quiet triangle wave bass, arriving at the campfire rest site after combat, safe at last, one-shot, no music
```

### Rest Heal
**Filename:** `rest/rest_heal` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit rest site healing restoration at camp sound effect, pure chiptune, authentic NES 2A03 chip sound, warm sustained pulse wave arpeggio climbing slowly — five notes ascending gently — triangle wave bass harmonic, slower and more deliberate than combat heal to suggest intentional rest, HP restoring at camp, one-shot, no music
```

### Rest Study
**Filename:** `rest/rest_study` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit studying knowledge review learning sound effect, pure chiptune, authentic NES 2A03 chip sound, clean ascending pulse wave three-note academic sound — bookish and focused — followed by brief shimmer suggesting knowledge absorbed, FSRS study session beginning at rest site, one-shot, no music
```

### Rest Meditate
**Filename:** `rest/rest_meditate` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit meditation centering focus calm sound effect, pure chiptune, authentic NES 2A03 chip sound, long triangle wave sustained note with very slow tremolo — breathing in and out — pulse wave very quietly harmonizing a fifth above, entering a meditative state at rest site, one-shot, no music
```

### Rest Card Removed
**Filename:** `rest/rest_card_removed` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit rest site card removal deliberate sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel soft burn quality combined with brief descending pulse wave — removing a card from your deck at rest — more peaceful than shop_removal_burn, intentional deck surgery in a safe place, one-shot, no music
```

---

## REWARDS (8 one-shots)

### Reward Screen
**Filename:** `reward/reward_screen` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit post-battle reward screen reveal fanfare sound effect, pure chiptune, authentic NES 2A03 chip sound, bright ascending five-note pulse wave fanfare — you earned this — triangle wave bass power note, noise channel shimmer, reward screen appearing after combat, deserved celebration, one-shot, no music
```

### Gold Collect
**Filename:** `reward/gold_collect` | **Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit coin gold collect cascade sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid high pulse wave ascending five-note run — coins cascading into your pouch — each note distinct and bright, satisfying wealth accumulation, one-shot, no music
```

### Card Accepted
**Filename:** `reward/card_accepted` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit card accepted reward added to deck sound effect, pure chiptune, authentic NES 2A03 chip sound, noise channel snap burst followed by brief rising pulse wave — new card snapping into your deck — decisive and clean, deck growing stronger, one-shot, no music
```

### Card Skipped
**Filename:** `reward/card_skipped` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit card reward skipped passed sound effect, pure chiptune, authentic NES 2A03 chip sound, brief descending pulse wave — passing on the option — understated and non-judgmental, choosing not to add the card, one-shot, no music
```

### Card Rerolled
**Filename:** `reward/card_rerolled` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit reward card reroll shuffle new options sound effect, pure chiptune, authentic NES 2A03 chip sound, rapid noise channel multi-burst shuffle sound followed by a brief ascending pulse wave curiosity sound, cards being reshuffled to offer new choices, cost paid, what comes next, one-shot, no music
```

### Relic Acquired
**Filename:** `reward/relic_acquired` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit relic artifact obtained powerful pickup sound effect, pure chiptune, authentic NES 2A03 chip sound, ascending pulse wave arpeggio building to a held sustained note with triangle wave bass power chord arriving simultaneously, new artifact obtained, more significant than a card, run is now different, one-shot, no music
```

### Treasure Item Appear
**Filename:** `reward/treasure_item_appear` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit treasure chest item appearing sparkle sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave ascending shimmer arpeggio with noise channel sparkle burst, something materializing from a treasure chest, anticipation of what you found, one-shot, no music
```

### Treasure Item Collect
**Filename:** `reward/treasure_item_collect` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit treasure item collected obtained sound effect, pure chiptune, authentic NES 2A03 chip sound, bright ascending pulse wave with triangle wave harmonic — item acquired — warmer and more significant than a generic collect, treasure chest loot claimed, one-shot, no music
```

---

## MYSTERY EVENTS (5 one-shots)

### Mystery Appear
**Filename:** `mystery/mystery_appear` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit mystery event appearing eerie sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave producing an augmented interval held with slow vibrato — neither pleasant nor unpleasant, genuinely ambiguous — triangle wave low note underneath, something unusual is happening, outcome unknown, one-shot, no music
```

### Event Choice
**Filename:** `mystery/event_choice` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit mystery event option selected choice sound effect, pure chiptune, authentic NES 2A03 chip sound, single clean pulse wave note — same weight as a navigation click but slightly more deliberate — choosing a path through an unknown event, one-shot, no music
```

### Event Outcome Positive
**Filename:** `mystery/event_outcome_positive` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit mystery event positive outcome good result sound effect, pure chiptune, authentic NES 2A03 chip sound, ascending pulse wave arpeggio resolving to a major chord — the gamble paid off — triangle wave bass support, warm and rewarding, the unknown thing was beneficial, one-shot, no music
```

### Event Outcome Negative
**Filename:** `mystery/event_outcome_negative` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit mystery event negative outcome bad result sound effect, pure chiptune, authentic NES 2A03 chip sound, descending pulse wave resolving to a minor interval — the risk didn't pay off — distinct from combat damage by being more measured and resigned, you knew this might happen, one-shot, no music
```

### Event Continue
**Filename:** `mystery/event_continue` | **Type:** One-shot | **Duration:** 0.1-0.15s

```
NES 8-bit mystery event continue dismiss advance sound effect, pure chiptune, authentic NES 2A03 chip sound, single brief neutral pulse wave note — advancing through the event text — lighter than event_choice since it's just moving forward not making a decision, one-shot, no music
```

---

## RUN LIFECYCLE (11 one-shots)

### Run Start
**Filename:** `run/run_start` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit dungeon run beginning adventure start sound effect, pure chiptune, authentic NES 2A03 chip sound, bold pulse wave ascending three-note phrase like a war horn, the quest officially begins, stepping through the dungeon entrance, momentum forward, one-shot, no music
```

### Domain Select
**Filename:** `run/domain_select` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit knowledge domain selection chosen sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave producing a deliberate ascending two-note sound with slight harmonic resonance — choosing what you will study on this run — thoughtful and purposeful, this affects your entire run, one-shot, no music
```

### Floor Cleared
**Filename:** `run/floor_cleared` | **Type:** One-shot | **Duration:** 0.5-0.7s

```
NES 8-bit floor complete cleared fanfare sound effect, pure chiptune, authentic NES 2A03 chip sound, brief four-note pulse wave ascending flourish — floor done, you survived this level — lighter than a full run victory, just one floor down, one-shot, no music
```

### Retreat Chosen
**Filename:** `run/retreat_chosen` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit retreat withdrawal sound effect, pure chiptune, authentic NES 2A03 chip sound, descending pulse wave three-note phrase — stepping back — triangle wave brief bass note, neither triumphant nor defeated, a strategic choice to pull back rather than press deeper, one-shot, no music
```

### Delve Deeper
**Filename:** `run/delve_deeper` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit delve deeper descend commitment sound effect, pure chiptune, authentic NES 2A03 chip sound, low descending triangle wave then ascending pulse wave — going down to go forward — the choice to press on rather than retreat, determined and bold, one-shot, no music
```

### Run Victory
**Filename:** `run/run_victory` | **Type:** One-shot | **Duration:** 0.8-1.2s

```
NES 8-bit full run victory complete triumph fanfare sound effect, pure chiptune, authentic NES 2A03 chip sound, multi-phrase pulse wave fanfare — phrase one rises triumphantly, phrase two develops with both channels, phrase three resolves on a held high note — triangle wave bass, noise channel cymbal, you completed the entire run, one-shot, no music
```

### Run Defeat
**Filename:** `run/run_defeat` | **Type:** One-shot | **Duration:** 1.0-1.5s

```
NES 8-bit run over game defeat sound effect, pure chiptune, authentic NES 2A03 chip sound, the classic death knell — three slow descending pulse wave notes each slightly lower and quieter, longer gaps between them, triangle wave fading low drone, noise channel quiet hiss, the run is over, not harsh but final, a roguelite death is a lesson, one-shot, no music
```

### Stat Tick
**Filename:** `run/stat_tick` | **Type:** One-shot | **Duration:** 0.04-0.07s

```
NES 8-bit stat counter incrementing tick sound effect, pure chiptune, authentic NES 2A03 chip sound, single extremely brief high pulse wave note — almost identical to quiz_timer_tick but slightly different timbre — numbers counting up on the end screen, one-shot, no music
```

### XP Award
**Filename:** `run/xp_award` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit experience points awarded XP sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave ascending rapid four-note run — experience flowing in — distinct from gold_collect by being slightly more abstract and less coin-like, knowledge and power growing, one-shot, no music
```

### Level Up
**Filename:** `run/level_up` | **Type:** One-shot | **Duration:** 0.5-1.0s

```
NES 8-bit character level up achievement sound effect, pure chiptune, authentic NES 2A03 chip sound, high pulse wave ascending rapid arpeggio climbing quickly to a bright peak note held with shimmer, noise channel sparkle burst at the apex, significant achievement, player character growing permanently stronger, one-shot, no music
```

### Ascension Unlock
**Filename:** `run/ascension_unlock` | **Type:** One-shot | **Duration:** 0.8-1.2s

```
NES 8-bit ascension mode unlock prestige sound effect, pure chiptune, authentic NES 2A03 chip sound, bold deliberate pulse wave three-phrase fanfare — lower and more solemn than level_up — new difficulty tier unlocked, ascension system engaged, the challenge grows, one-shot, no music
```

---

## GENERIC UI (8 one-shots)

### Button Click
**Filename:** `ui/button_click` | **Type:** One-shot | **Duration:** 0.05-0.1s

```
NES 8-bit universal menu button click sound effect, pure chiptune, authentic NES 2A03 chip sound, single very brief pulse wave note — clean, crisp, immediate — the universal button press, must not cause fatigue over hundreds of presses per session, completely unobtrusive, one-shot, no music
```

### Modal Open
**Filename:** `ui/modal_open` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit modal panel opening whoosh sound effect, pure chiptune, authentic NES 2A03 chip sound, quick noise channel burst followed immediately by a pulse wave settling note — panel sliding in from offscreen — brief and functional, one-shot, no music
```

### Modal Close
**Filename:** `ui/modal_close` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit modal panel closing dismiss sound effect, pure chiptune, authentic NES 2A03 chip sound, brief descending pulse wave with tiny noise burst — panel retracting — mirror of modal_open but descending rather than settling, one-shot, no music
```

### Toggle On
**Filename:** `ui/toggle_on` | **Type:** One-shot | **Duration:** 0.04-0.07s

```
NES 8-bit toggle switch on activation sound effect, pure chiptune, authentic NES 2A03 chip sound, single high bright pulse wave note — clean and positive — something activated, one-shot, no music
```

### Toggle Off
**Filename:** `ui/toggle_off` | **Type:** One-shot | **Duration:** 0.04-0.07s

```
NES 8-bit toggle switch off deactivation sound effect, pure chiptune, authentic NES 2A03 chip sound, single slightly lower and less bright pulse wave note than toggle_on — same minimal footprint but conveying deactivation — something turned off, one-shot, no music
```

### Tab Switch
**Filename:** `ui/tab_switch` | **Type:** One-shot | **Duration:** 0.05-0.1s

```
NES 8-bit UI tab switch page flip sound effect, pure chiptune, authentic NES 2A03 chip sound, quick noise channel swipe — like a page turning — navigating between sections within a panel, very brief, one-shot, no music
```

### Notification Ping
**Filename:** `ui/notification_ping` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit attention notification ping sound effect, pure chiptune, authentic NES 2A03 chip sound, single bright high pulse wave note that cuts clearly through other audio — something happened that requires attention — must be distinctive from button clicks, one-shot, no music
```

### Error Deny
**Filename:** `ui/error_deny` | **Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit error denied not allowed sound effect, pure chiptune, authentic NES 2A03 chip sound, two low pulse wave notes forming a gentle negative interval — not allowed, not possible right now — NOT harsh or alarming, just informative, the mildest possible negative sound, one-shot, no music
```

### UI Pop In
**Filename:** `ui/ui_pop_in` | **Type:** One-shot | **Duration:** 0.1-0.15s

```
NES 8-bit UI element pop appear animation sound effect, pure chiptune, authentic NES 2A03 chip sound, brief ascending pulse wave two-note pop with a slight bounce quality — something appearing with a springy reveal — light and snappy, UI element materializing, one-shot, no music
```

---

## PROGRESSION (6 one-shots)

### Fact Mastered
**Filename:** `progression/fact_mastered` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit knowledge fact mastered FSRS learned sound effect, pure chiptune, authentic NES 2A03 chip sound, warm ascending pulse wave four-note arpeggio with a bookish academic quality — a piece of knowledge has been fully retained — triangle wave harmonic, the learning system flagged this fact as long-term known, one-shot, no music
```

### Mastery Challenge Appear
**Filename:** `mastery/mastery_challenge_appear` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit mastery trial gong announcement sound effect, pure chiptune, authentic NES 2A03 chip sound, low pulse wave sustained note like a gong struck with a long decay — harmonics ringing downward — solemn and important, a mastery challenge awaits, the trial is presented, one-shot, no music
```

### Mastery Trial Pass
**Filename:** `mastery/mastery_trial_pass` | **Type:** One-shot | **Duration:** 0.5-0.7s

```
NES 8-bit mastery trial passed success sound effect, pure chiptune, authentic NES 2A03 chip sound, bright ascending pulse wave five-note fanfare with noise channel shimmer, mastery trial completed successfully — card slot mastery increasing — earned through performance, one-shot, no music
```

### Mastery Trial Fail
**Filename:** `mastery/mastery_trial_fail` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit mastery trial failed sound effect, pure chiptune, authentic NES 2A03 chip sound, slow descending pulse wave three-note phrase resolving to a minor interval — not harsh, learning is a process — distinguished from run_defeat by being softer and more temporary in feeling, one-shot, no music
```

### Mechanic Unlock
**Filename:** `progression/mechanic_unlock` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit new mechanic unlocked revealed sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave ascending arpeggio with a novel quality — new system opening up — triangle wave bass, shimmer on final note, distinct from relic_unlock by feeling more systemic and structural, one-shot, no music
```

### Relic Unlock
**Filename:** `progression/relic_unlock` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit relic unlocked new artifact discovered sound effect, pure chiptune, authentic NES 2A03 chip sound, mysterious ascending pulse wave arpeggio with slight shimmer delay — a relic becoming available for future runs — more magical and item-specific than mechanic_unlock, something powerful is now accessible, one-shot, no music
```

---

## KEEPER NPC (4 one-shots)

### Keeper Calm
**Filename:** `keeper/keeper_calm` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit Keeper NPC calm neutral speech bark sound effect, pure chiptune, authentic NES 2A03 chip sound, measured pulse wave vocal cadence — two to three notes at steady tempo with duty cycle modulation for character, an ancient knowing being speaking evenly, no urgency, observational, one-shot, no music
```

### Keeper Excited
**Filename:** `keeper/keeper_excited` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit Keeper NPC excited animated speech bark sound effect, pure chiptune, authentic NES 2A03 chip sound, faster rising pulse wave vocal pattern — three to four notes ascending with increased speed — the Keeper is genuinely interested or pleased by something, more energy than keeper_calm, one-shot, no music
```

### Keeper Stern
**Filename:** `keeper/keeper_stern` | **Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit Keeper NPC stern serious speech bark sound effect, pure chiptune, authentic NES 2A03 chip sound, low descending pulse wave two-note cadence — the Keeper is being firm — slightly heavier duty cycle for weight, the ancient being is not pleased, one-shot, no music
```

### Keeper Curious
**Filename:** `keeper/keeper_curious` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit Keeper NPC curious questioning speech bark sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave two-note pattern that rises at the end like a question — interrogative inflection in pitch — the Keeper wants to know something, engaged and inquiring, one-shot, no music
```

---

## SCREEN TRANSITIONS (6 one-shots)

### Transition Hub to Dungeon
**Filename:** `transition/transition_hub_dungeon` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit hub to dungeon transition entering portal sound effect, pure chiptune, authentic NES 2A03 chip sound, pulse wave descending from the warm comfortable hub range into lower darker dungeon register, noise channel rushing whoosh texture, triangle wave deep note arriving at the bottom, leaving safety entering danger, one-shot, no music
```

### Transition Combat to Reward
**Filename:** `transition/transition_combat_reward` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit combat scene to reward screen transition sound effect, pure chiptune, authentic NES 2A03 chip sound, brief ascending pulse wave sweep — battle over, reward time — lighter and faster than the combat-start sound, moving to a positive context, one-shot, no music
```

### Transition to Rest
**Filename:** `transition/transition_to_rest` | **Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit traveling to rest site transition sound effect, pure chiptune, authentic NES 2A03 chip sound, warm descending then settling pulse wave — exhale, finding safety — triangle wave low sustain arriving, the urgency of combat fading into rest, one-shot, no music
```

### Transition to Shop
**Filename:** `transition/transition_to_shop` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit traveling to merchant shop transition sound effect, pure chiptune, authentic NES 2A03 chip sound, bright neutral pulse wave movement — going somewhere commercial — a bit more lively than transition_to_rest, the promise of goods available, one-shot, no music
```

### Transition Run End to Hub
**Filename:** `transition/transition_run_end_hub` | **Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit run ending returning to hub transition sound effect, pure chiptune, authentic NES 2A03 chip sound, ascending pulse wave returning to the hub register — warm homecoming quality — whether victory or defeat, you are back at camp, one-shot, no music
```

### Boot Logo
**Filename:** `transition/boot_logo` | **Type:** One-shot | **Duration:** 2.0-3.0s

```
NES 8-bit Recall Rogue game startup signature logo sound effect, pure chiptune, authentic NES 2A03 chip sound, three deliberate pulse wave notes ascending — C4 held, then G4 held, then C5 held — each note precise with slight leading decay, triangle wave bass doubling an octave below on each note, final C5 rings with gentle shimmer before silence, this is THE sound of the game, iconic and immediately recognizable, must feel like an institution, one-shot, no music
```

---

## TUTORIAL (3 one-shots)

### Tutorial Tooltip
**Filename:** `tutorial/tutorial_tooltip` | **Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit tutorial tooltip hint appearing sound effect, pure chiptune, authentic NES 2A03 chip sound, gentle pulse wave ascending two-note sound — teaching something — brighter than modal_open, carries a helpful learning quality rather than just UI navigation, one-shot, no music
```

### Tutorial Step Complete
**Filename:** `tutorial/tutorial_step_complete` | **Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit tutorial step completed learning progress sound effect, pure chiptune, authentic NES 2A03 chip sound, clean ascending three-note pulse wave — you did the thing correctly — encouraging and clear, not as grand as mastery sounds but more substantial than a button click, one-shot, no music
```

### Tutorial Complete
**Filename:** `tutorial/tutorial_complete` | **Type:** One-shot | **Duration:** 0.6-1.0s

```
NES 8-bit tutorial fully completed graduation sound effect, pure chiptune, authentic NES 2A03 chip sound, bright five-note ascending pulse wave fanfare with triangle wave bass — you understand the game now — celebratory but not overwhelming, new player welcomed into the full experience, one-shot, no music
```

---

# AMBIENT ATMOSPHERE RECIPES

Instead of generated ambient music tracks, the game layers base ambient SFX loops to create distinct atmospheres per context. Each recipe specifies which loops to play simultaneously and at what relative volume. The audio system crossfades between recipes on room/screen transitions.

**Volume scale:** 1.0 = full SFX volume, 0.5 = half, 0.2 = barely audible background texture.
**Ducking:** All ambient layers duck by 50% when quiz overlay is active, restoring on dismiss.

---

## Hub & Campsite
**Plays on:** Hub screen, campsite, between-run menus
**Mood:** Safe, warm, home — but still underground. No music, just a campfire in a stone room.

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/hub_campfire_ambience` | 0.7 |
| Texture | `loops/water_drip_close` | 0.12 |
| Depth | `loops/stone_room_resonance` | 0.2 |
| Life | `loops/camp_cloth_rustle` | 0.08 |
| Danger | `loops/distant_creature_stir` | 0.06 |

*The campfire is the star. Everything else sits far beneath it — drips, room hum, the occasional reminder that the dungeon is alive outside the circle of firelight.*

---

## Dungeon Map
**Plays on:** Map screen during path selection
**Mood:** Contemplative, planning the route ahead

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/wind_passage` | 0.4 |
| Texture | `loops/water_drip_close` | 0.1 |
| Depth | `loops/stone_creak_settle` | 0.08 |

---

## Shop Room
**Plays on:** Shop room overlay
**Mood:** Merchant alcove, torchlit, slightly cramped

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/fire_torch_crackle` | 0.5 |
| Texture | `loops/chain_rattle_distant` | 0.15 |
| Depth | `loops/wind_passage` | 0.08 |

---

## Rest Site
**Plays on:** Rest room overlay
**Mood:** Underground campfire, safe respite, similar to hub but deeper

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/hub_campfire_ambience` | 0.6 |
| Texture | `loops/water_drip_close` | 0.15 |
| Depth | `loops/wind_passage` | 0.1 |
| Sub | `loops/stone_creak_settle` | 0.05 |

---

## Mystery Event
**Plays on:** Mystery event overlay
**Mood:** Eerie, unknown, something strange happening

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/arcane_whisper` | 0.5 |
| Texture | `loops/void_drone` | 0.25 |
| Depth | `loops/wind_passage` | 0.08 |

---

## Combat: Dust Theme (Floors 1-3)
**Plays on:** Combat during Shallow Depths floors
**Mood:** Basic stone cave, damp, torchlit

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/water_drip_close` | 0.35 |
| Texture | `loops/stone_creak_settle` | 0.2 |
| Depth | `loops/wind_passage` | 0.1 |
| Sub | `loops/fire_torch_crackle` | 0.08 |

---

## Combat: Embers Theme (Floors 4-6)
**Plays on:** Combat during volcanic/heat floors
**Mood:** Hot, dangerous, lava nearby

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/fire_ember_pit` | 0.45 |
| Texture | `loops/lava_bubble` | 0.3 |
| Depth | `loops/steam_vent_hiss` | 0.15 |
| Sub | `loops/stone_creak_settle` | 0.08 |

---

## Combat: Ice Theme (Floors 7-9)
**Plays on:** Combat during frozen depth floors
**Mood:** Cold, brittle, vast frozen chambers

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/ice_creak` | 0.4 |
| Texture | `loops/wind_howl_deep` | 0.3 |
| Depth | `loops/water_drip_close` | 0.1 |
| Sub | `loops/crystal_hum` | 0.05 |

---

## Combat: Arcane Theme (Floors 10-12)
**Plays on:** Combat during ancient archive/library floors
**Mood:** Magical, ancient, enchanted stone

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/arcane_whisper` | 0.4 |
| Texture | `loops/crystal_hum` | 0.25 |
| Depth | `loops/wind_passage` | 0.1 |
| Sub | `loops/stone_creak_settle` | 0.08 |

---

## Combat: Void Theme (Floors 13+)
**Plays on:** Combat during deepest/endless floors
**Mood:** Near-silence, oppressive, the abyss

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/void_drone` | 0.5 |
| Texture | `loops/wind_howl_deep` | 0.15 |

*Deliberately sparse. The void is quiet.*

---

## Boss Arena (any theme)
**Plays on:** Boss encounters — ADDS to the current floor theme
**Mood:** Floor theme layers boosted + tension underbed

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Added | `loops/combat_tension_underbed` | 0.5 |
| Boost | All current floor theme layers | +0.15 each |

*Floor theme continues but everything gets louder and tenser.*

---

## Mastery Challenge
**Plays on:** Mastery challenge room
**Mood:** Trial, focused, arcane testing

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/arcane_whisper` | 0.4 |
| Texture | `loops/crystal_hum` | 0.3 |

---

## Run End: Victory
**Plays on:** Victory run-end screen
**Mood:** Relief, warmth, accomplishment fading to calm

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/hub_campfire_ambience` | 0.4 |

*Just the campfire. You made it home.*

---

## Run End: Defeat
**Plays on:** Defeat run-end screen
**Mood:** Empty, cold, quiet

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/void_drone` | 0.3 |
| Texture | `loops/wind_passage` | 0.15 |

---

## Retreat / Delve Decision
**Plays on:** Post-boss retreat-or-continue screen
**Mood:** Crossroads, uncertain

| Layer | Loop File | Volume |
|-------|-----------|--------|
| Primary | `loops/wind_passage` | 0.35 |
| Texture | `loops/stone_creak_settle` | 0.15 |
| Depth | `loops/dungeon_drip_ambient` | 0.1 |

---

## Implementation Notes

- **Crossfade:** 800ms crossfade between ambient recipes on room transitions
- **Quiz ducking:** All ambient layers reduce to 50% volume when quiz overlay opens, restore on close
- **Music coexistence:** When EPIC or QUIET playlist is active, ambient recipes play at 30% of listed volumes as subtle texture beneath the music. When player selects AMBIENT mode, no music plays and recipes run at full listed volumes.
- **Boss intensification:** Boss arena recipe ADDS to current floor theme (doesn't replace). On boss defeat, revert boost over 2s.
- **Low HP override:** When player HP < 30%, `loops/low_hp_warning_pulse` fades in at 0.6 on top of current recipe regardless of context.


# GENERATION STRATEGY

## Priority Order (Generate First to Last)

| Priority | Category | Reason |
|---|---|---|
| 1 | `quiz/quiz_appear`, `quiz/quiz_answer_select`, `quiz/quiz_speed_bonus` | Heard every single encounter during charge phase |
| 2 | `combat/card_swoosh_attack`, `combat/card_swoosh_shield`, `combat/card_swoosh_buff`, `combat/card_swoosh_debuff`, `combat/card_swoosh_wild` | Every card play every fight |
| 3 | `combat/chain_link_1` through `combat/chain_link_5`, `combat/chain_break` | The signature mechanic — players will notice immediately |
| 4 | `combat/player_damage`, `combat/enemy_attack`, `combat/shield_absorb`, `combat/shield_break`, `combat/shield_gain` | Core combat feedback loop |
| 5 | `ui/button_click`, `ui/modal_open`, `ui/modal_close` | Heard hundreds of times per session |
| 6 | `surge/surge_announce`, `loops/surge_active_loop` | Surge turns are memorable |
| 7 | `encounter/encounter_start`, `encounter/encounter_victory`, `encounter/boss_defeated` | Fight boundaries |
| 8 | `quiz/quiz_timer_tick`, `turn/end_turn_click`, `turn/perfect_turn` | Turn rhythm |
| 9 | `reward/reward_screen`, `reward/gold_collect`, `reward/card_accepted`, `reward/relic_acquired` | Post-fight rewards |
| 10 | `run/run_victory`, `run/run_defeat`, `transition/boot_logo` | Memorable run boundaries |
| 11 | `status/` all 12 | Status effects heard every turn when active |
| 12 | `relic/` all 8 | Relic triggers heard throughout run |
| 13 | `shop/` all 22 | Shop interactions |
| 14 | `loops/` ambient beds | Background texture |
| 15 | Everything else | Fill in as needed |

## Total Entry Count

| Category | Count |
|---|---|
| Ambient Loops | 33 |
| Legacy / Mining | 7 |
| Rarity Reveals | 6 |
| Mastery & Streaks | 3 |
| Environmental | 6 |
| Card Play | 15 |
| Enemy Actions | 11 |
| Player Health | 8 |
| Status Effects | 12 |
| Chain System | 7 |
| Turn Flow | 9 |
| Surge | 3 |
| Relic Triggers | 8 |
| Quiz | 7 |
| Encounter Lifecycle | 7 |
| Map & Navigation | 6 |
| Hub | 4 |
| Shop | 22 |
| Rest Site | 5 |
| Rewards | 8 |
| Mystery Events | 5 |
| Run Lifecycle | 11 |
| Generic UI | 9 |
| Progression | 6 |
| Keeper NPC | 4 |
| Screen Transitions | 6 |
| Tutorial | 3 |
| **TOTAL** | **232 SoundName entries + 32 additional ambient loops = 264 prompts** |

## Notes on Generation Tools

**Suno** — Works for ambient loops and atmospheric beds. Use "Sound Effects" mode, not song mode.

**ElevenLabs SFX** — Better for precise one-shots. Feed the prompt directly into the SFX generation field.

**Target volume normalization:** All SFX should peak around -12 dBFS so the game's gain control has headroom without distortion.

**File format:** Export as `.ogg` (Vorbis, quality 6) or `.wav` (16-bit 44.1kHz). The audio system accepts both. OGG preferred for final delivery — smaller files.

**Seamless loops:** For loop files, the start and end must be sample-accurate. Use Audacity's "Export Loop" or trim with zero-crossing alignment.
