# Sound Effects — AI Generation Prompts

**For:** Damion (manual task via Suno or ACE-Step)
**Output:** .ogg or .wav
**Destination:** `public/assets/audio/sfx/`

These replace the Web Audio synthesis sounds with real generated audio. Every sound the game needs, organized by category.

---

## Sound Architecture

Currently all 180 SFX are synthesized at runtime via Web Audio API (`audioService.ts`). These prompts let you generate real audio replacements that sound dramatically better. Drop the files into `public/assets/audio/sfx/` and the audio system will load them instead of synthesizing.

### File Naming Convention
```
{category}_{event}_{variant}.ogg
```
Examples: `combat_card_attack_01.ogg`, `ui_button_click_01.ogg`, `status_poison_apply_01.ogg`

---

# COMBAT SOUNDS

## Card Play Effects

### Card Attack Swoosh
**Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit sword slash sound effect, pure chiptune, sharp rising pulse wave sweep from low to high in 200ms, noise channel burst for impact texture, aggressive cutting motion, pixel art card game attack activation, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music, no melody, just the single sharp swoosh effect
```

### Card Shield Activate
**Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit shield activation sound effect, pure chiptune, heavy low pulse wave thud like stone dropping into place followed by brief high-pitched crystalline ring, protective barrier forming, triangle wave bass impact, pixel art card game shield activation, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Card Buff Cast
**Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit buff spell cast sound effect, pure chiptune, ascending pulse wave arpeggio three notes climbing upward bright and sparkly, triangle wave harmonic underneath, positive power-up feeling, pixel art card game buff activation, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Card Debuff Cast
**Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit debuff curse sound effect, pure chiptune, descending pulse wave warble pitch-bending downward with detuned vibrato, ominous and sickly, triangle wave low drone, something bad applied to the enemy, pixel art card game debuff activation, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Card Wild Cast
**Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit wild magic sound effect, pure chiptune, rapid chaotic pulse wave arpeggio bouncing between random-feeling pitches, noise channel burst, unpredictable energy burst, pixel art card game wild card activation, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Card Fizzle (Blocked)
**Type:** One-shot | **Duration:** 0.3s

```
NES 8-bit fizzle fail sound effect, pure chiptune, sad descending pulse wave from mid to low pitch with rapid volume decay, pathetic puff, the card tried but nothing happened, noise channel tiny burst, pixel art card game blocked card, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Card Exhaust (Permanent Remove)
**Type:** One-shot | **Duration:** 0.4-0.6s

```
NES 8-bit card burning disintegrate sound effect, pure chiptune, noise channel crackling burst like paper burning, pulse wave descending rapidly to silence, something destroyed permanently, triangle wave fading low rumble, pixel art card game card exhausted, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Card Draw
**Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit card deal snap sound effect, pure chiptune, very short noise channel burst through bandpass creating papery snap quality, single pulse wave tick, playing card being dealt from a deck, pixel art card game card draw, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Card Discard
**Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit card discard thud sound effect, pure chiptune, very short low pulse wave blip, soft and quick, card tossed onto discard pile, subtle not attention-grabbing, pixel art card game card discard, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Card Select (Pick from Hand)
**Type:** One-shot | **Duration:** 0.1s

```
NES 8-bit menu select tick sound effect, pure chiptune, single very brief high pulse wave note, clean and crisp, picking up a card from your hand, pixel art card game selection, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Charge Initiate (Quiz Activating)
**Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit energy charging power-up sound effect, pure chiptune, pulse wave rising in pitch steadily from low to high over half a second like a capacitor charging, triangle wave hum building underneath, tension and anticipation, knowledge quiz about to begin, pixel art card game charge mechanic, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

---

## Enemy Sounds

### Enemy Attack Hit
**Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit enemy attack impact sound effect, pure chiptune, heavy noise channel burst combined with low pulse wave thud, getting hit hard, screen-shake quality impact, painful but brief, pixel art card game enemy attacks player, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Enemy Defeated
**Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit enemy death explosion sound effect, pure chiptune, noise channel extended burst like shattering, pulse wave descending rapidly pitch-dropping, triangle wave low rumble, satisfying destruction, the enemy crumbles, pixel art card game enemy killed, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Enemy Charge Up (Winding Big Attack)
**Type:** One-shot | **Duration:** 0.6-1.0s

```
NES 8-bit enemy charging menacing sound effect, pure chiptune, low pulse wave drone rising slowly in pitch with tremolo vibrato, building dread, the enemy is preparing something terrible, noise channel faint rumble building, triangle wave ominous low pedal, pixel art card game enemy charge mechanic, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Enemy Defend (Gains Block)
**Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit armor defend sound effect, pure chiptune, low noise channel grinding burst like stone wall rising, pulse wave low impact, heavy and immovable, enemy put up a shield, pixel art card game enemy defend, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Enemy Buff Self
**Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit dark power surge sound effect, pure chiptune, rising pulse wave with sawtooth-like duty cycle creating aggressive tone, enemy getting stronger, threatening, noise channel crackle, pixel art card game enemy buff, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Enemy Enrage
**Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit bestial roar rage sound effect, pure chiptune, pulse wave starting low with heavy vibrato then rapidly rising to aggressive high pitch, noise channel sustained burst like a growl, triangle wave rumbling, the enemy just got dangerous, pixel art card game enemy enrage, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

---

## Player Health Sounds

### Player Takes Damage
**Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit player hit damage sound effect, pure chiptune, low pulse wave heavy thud with brief noise channel impact, painful but not harsh, you got hit, pixel art card game player takes damage, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Shield Absorbs Damage
**Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit shield block deflect sound effect, pure chiptune, high-pitched pulse wave metallic ping followed by brief noise burst, the shield held, damage absorbed, pixel art card game shield block, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Shield Breaks
**Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit glass shatter shield break sound effect, pure chiptune, rapid descending pulse wave sweep combined with extended noise channel burst like shattering, your protection is gone, alarming, pixel art card game shield destroyed, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Shield Gained
**Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit shield activate crystalline sound effect, pure chiptune, ascending pulse wave three-note arpeggio bright and protective, triangle wave harmonic, barrier forming around you, pixel art card game shield applied, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Player Healed
**Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit healing restoration sound effect, pure chiptune, warm ascending pulse wave arpeggio four notes climbing gently, triangle wave soft sustained note, soothing and restorative, health points recovered, pixel art card game heal, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Player Defeated (Death)
**Type:** One-shot | **Duration:** 1.0-2.0s

```
NES 8-bit player death heartbeat fading sound effect, pure chiptune, three slow low pulse wave thuds getting quieter and further apart like a heart stopping, long silence between beats, the last beat barely audible, triangle wave low drone fading to nothing, pixel art card game player died, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

---

## Status Effect Sounds

### Poison Applied
**Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit poison toxic bubble sound effect, pure chiptune, descending pulse wave blorp from mid to low with wobble, sickly and wet-sounding through duty cycle modulation, something toxic applied, pixel art card game poison status, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Poison Tick (Damage Each Turn)
**Type:** One-shot | **Duration:** 0.1s

```
NES 8-bit poison drip tick sound effect, pure chiptune, single very brief low pulse wave blip, tiny and recurring, poison still hurting, pixel art card game poison damage tick, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Burn Applied
**Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit fire ignite fwoosh sound effect, pure chiptune, rising noise channel burst combined with ascending pulse wave, fire catching, hot and aggressive, pixel art card game burn status, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Bleed Applied
**Type:** One-shot | **Duration:** 0.2s

```
NES 8-bit slice cut bleed sound effect, pure chiptune, sharp noise channel burst followed by quick descending pulse wave, something was cut, brief and uncomfortable, pixel art card game bleed status, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Weakness Applied
**Type:** One-shot | **Duration:** 0.3s

```
NES 8-bit weakness drain deflating sound effect, pure chiptune, descending pulse wave sliding from mid to low pitch over 300ms, energy leaving, weakened, pixel art card game weakness debuff, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Strength Buff Applied
**Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit strength power-up sound effect, pure chiptune, short aggressive rising pulse wave rev, getting stronger, muscles tightening, pixel art card game strength buff, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

---

## Chain System Sounds

### Chain Link 1
**Type:** One-shot | **Duration:** 0.1-0.2s | **Key:** A5 (880Hz)

```
NES 8-bit chain link metallic clink sound effect first link, pure chiptune, single pulse wave note at A5 880Hz with brief noise burst, clean metallic ping, first link of a chain forging, pixel art card game knowledge chain, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Chain Link 2
**Type:** One-shot | **Duration:** 0.1-0.2s | **Key:** B5 (988Hz)

```
NES 8-bit chain link metallic clink sound effect second link, pure chiptune, single pulse wave note at B5 988Hz slightly higher pitch than first, building momentum, second chain link, pixel art card game knowledge chain, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Chain Link 3
**Type:** One-shot | **Duration:** 0.1-0.2s | **Key:** C6 (1047Hz)

```
NES 8-bit chain link metallic clink sound effect third link, pure chiptune, pulse wave note at C6 1047Hz with added harmonic, chain growing stronger, pixel art card game knowledge chain, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Chain Link 4
**Type:** One-shot | **Duration:** 0.1-0.2s | **Key:** D6 (1175Hz)

```
NES 8-bit chain link metallic clink sound effect fourth link, pure chiptune, pulse wave note at D6 1175Hz with shimmer, almost at maximum chain power, pixel art card game knowledge chain, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Chain Link 5 (Maximum)
**Type:** One-shot | **Duration:** 0.3-0.5s | **Key:** E6 chord

```
NES 8-bit chain maximum power chord sound effect, pure chiptune, both pulse waves playing full chord E6 G6 B6 resolving triumphantly, noise channel impact burst, maximum chain achieved at 3x multiplier, pixel art card game knowledge chain maxed, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Chain Break
**Type:** One-shot | **Duration:** 0.3-0.4s

```
NES 8-bit chain snap breaking sound effect, pure chiptune, sharp noise channel crack followed by three rapidly descending pulse wave pings scattering downward, chain shattered momentum lost, pixel art card game chain broken, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

---

## Quiz Sounds

### Quiz Correct Answer
**Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit correct answer positive chime sound effect, pure chiptune, ascending pulse wave four-note major arpeggio bright and triumphant C E G C, knowledge is power, you got it right, pixel art card game quiz correct, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Quiz Wrong Answer
**Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit wrong answer soft negative sound effect, pure chiptune, two pulse wave notes forming minor second interval briefly then resolving down, NOT harsh or punishing, gentle disappointment, try again next time, pixel art card game quiz wrong, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Quiz Timer Tick
**Type:** One-shot | **Duration:** 0.05s

```
NES 8-bit timer tick single click sound effect, pure chiptune, single very short sharp pulse wave note at high pitch, metronomic tick, time is running out, pixel art card game quiz timer, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Quiz Appear (Panel Opens)
**Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit scanner power-on interface opening sound effect, pure chiptune, rising pulse wave sweep from low to settling high note, quiz panel sliding in, knowledge interface activating, pixel art card game quiz overlay, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

---

## Encounter Sounds

### Encounter Start (Normal)
**Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit battle start encounter sound effect, pure chiptune, heavy noise channel drum hit followed by brief rising pulse wave brass sting, fight beginning, adrenaline spike, pixel art card game combat start, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Boss Encounter Start
**Type:** One-shot | **Duration:** 0.8-1.2s

```
NES 8-bit boss entrance dramatic sound effect, pure chiptune, massive low pulse wave chord sustained with both channels, noise channel crash impact, triangle wave thundering low octave, the ground shakes something enormous appears, terrifying, pixel art card game boss fight start, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Encounter Victory
**Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit battle victory quick fanfare sound effect, pure chiptune, bright ascending pulse wave four-note melody triumphant and brief, noise channel cymbal, enemy defeated you survived, pixel art card game combat won, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

---

## Surge System

### Surge Announce
**Type:** One-shot | **Duration:** 0.6-1.0s

```
NES 8-bit power surge activation dramatic sound effect, pure chiptune, deep triangle wave bass thrum sustained, pulse wave rising golden energy sweep ascending, noise channel sparkle burst at peak, Knowledge Surge activated all charges free this turn, pixel art card game surge mechanic, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Surge Active Loop
**Type:** Loop | **Duration:** 2-4s | **BPM:** 140

```
NES 8-bit power-up active ambient loop, pure chiptune, sustained warm pulse wave triad chord shimmering with slight detuned vibrato, triangle wave pulsing bass in rhythm, golden energy humming, plays during surge turn as ambient overlay, pixel art card game surge active, authentic NES 2A03 chip sound, retro game SFX, seamless loop, 140 BPM, no melody just sustained power hum
```

---

## Turn Flow Sounds

### Player Turn Start
**Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit turn start bell chime sound effect, pure chiptune, single clear pulse wave ascending three-note pickup, your turn has begun, time to act, pixel art card game turn chime, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Enemy Turn Start
**Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit enemy turn ominous shift sound effect, pure chiptune, low pulse wave two-note descending phrase, dark and brief, their move now, pixel art card game enemy turn, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### End Turn Button
**Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit decisive heavy click sound effect, pure chiptune, low pulse wave thud slightly heavier than a normal button click, finality, done with your turn, pixel art card game end turn, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Perfect Turn
**Type:** One-shot | **Duration:** 0.3-0.5s

```
NES 8-bit perfect turn achievement fanfare sound effect, pure chiptune, three ascending pulse wave notes da-da-DA triumphant, last note held with shimmer, you played every card correctly, pixel art card game perfect turn, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

---

## Relic Sounds

### Relic Trigger (Generic)
**Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit relic activation magical pulse sound effect, pure chiptune, quick ascending pulse wave pair of notes with brief shimmer, something in your inventory just fired, subtle magical, pixel art card game relic trigger, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Relic Acquired
**Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit item acquired treasure sound effect, pure chiptune, ascending pulse wave arpeggio building to a held note with triangle wave bass power chord, new artifact obtained, significant moment, pixel art card game relic pickup, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Death Prevention Relic (Last Stand)
**Type:** One-shot | **Duration:** 0.8-1.2s

```
NES 8-bit death prevented miracle save sound effect, pure chiptune, silence for 200ms then massive pulse wave heartbeat thud followed by ascending life-returning arpeggio, you should have died but a relic saved you, dramatic reversal, pixel art card game death prevention relic, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

---

# UI SOUNDS

## Navigation

### Button Click
**Type:** One-shot | **Duration:** 0.05-0.1s

```
NES 8-bit menu button click sound effect, pure chiptune, single very brief pulse wave note clean and crisp, universal button press, must not fatigue over hundreds of presses, pixel art game UI, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Modal Open
**Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit panel open whoosh sound effect, pure chiptune, quick noise channel burst followed by pulse wave settling note, menu panel sliding in, pixel art game UI modal, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Modal Close
**Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit panel close retract sound effect, pure chiptune, brief descending pulse wave with tiny noise burst, menu panel sliding away, pixel art game UI modal close, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Toggle On
**Type:** One-shot | **Duration:** 0.05s

```
NES 8-bit switch toggle on click sound effect, pure chiptune, single high bright pulse wave note, something activated, pixel art game UI toggle, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Toggle Off
**Type:** One-shot | **Duration:** 0.05s

```
NES 8-bit switch toggle off click sound effect, pure chiptune, single lower pulse wave note slightly darker than toggle on, something deactivated, pixel art game UI toggle, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Tab Switch
**Type:** One-shot | **Duration:** 0.05-0.1s

```
NES 8-bit page flip tab switch sound effect, pure chiptune, quick noise channel swipe like turning a page, navigating between sections, pixel art game UI tabs, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Error / Denied
**Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit error denied bonk sound effect, pure chiptune, two low pulse wave notes forming a gentle negative interval, not allowed right now, NOT harsh just informative, pixel art game UI error, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Notification Ping
**Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit notification attention ping sound effect, pure chiptune, single bright high pulse wave note that cuts through, something happened look here, pixel art game UI notification, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

---

# GAME FLOW SOUNDS

### Run Start (Adventure Begins)
**Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit adventure horn call start sound effect, pure chiptune, bold pulse wave ascending three-note phrase like a war horn, the quest begins, pixel art card game run start, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Floor Transition (Descending Deeper)
**Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit descending staircase floor transition sound effect, pure chiptune, four noise channel thuds in sequence like footsteps going down stairs getting lower in pitch, followed by deep triangle wave boom at the bottom, deeper into the dungeon, pixel art card game floor advance, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Map Node Click
**Type:** One-shot | **Duration:** 0.1-0.2s

```
NES 8-bit map path selected footstep sound effect, pure chiptune, low noise channel thud like a footstep on stone plus brief pulse wave confirmation tone, path chosen onward, pixel art card game dungeon map, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Level Up
**Type:** One-shot | **Duration:** 0.5-1.0s

```
NES 8-bit level up celebration sound effect, pure chiptune, high pulse wave ascending rapid arpeggio climbing to bright peak note held with shimmer, noise channel sparkle burst, significant achievement, knowledge growing stronger, pixel art card game level up, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Gold Collect
**Type:** One-shot | **Duration:** 0.2-0.4s

```
NES 8-bit coin collect gold pickup sound effect, pure chiptune, rapid high pulse wave ascending five-note run like coins cascading, bright and satisfying, gold acquired, pixel art card game currency reward, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Shop Purchase
**Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit cash register purchase ka-ching sound effect, pure chiptune, noise channel brief burst plus ascending pulse wave two-note ching, transaction complete gold spent, pixel art card game shop buy, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Reward Card Accepted
**Type:** One-shot | **Duration:** 0.2-0.3s

```
NES 8-bit card acquired snap shimmer sound effect, pure chiptune, noise channel snap burst followed by rising pulse wave note, new card added to your deck, pixel art card game reward accepted, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Mastery Challenge Appear
**Type:** One-shot | **Duration:** 0.5-0.8s

```
NES 8-bit gong trial announcement sound effect, pure chiptune, low pulse wave sustained note like a gong with long decay, harmonics ringing, a mastery trial awaits, solemn and important, pixel art card game mastery challenge, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

### Boot Logo (Game Launch)
**Type:** One-shot | **Duration:** 2-3s

```
NES 8-bit game startup signature logo sound effect, pure chiptune, three deliberate pulse wave notes ascending C4 G4 C5 each held briefly with triangle wave bass doubling an octave below, final note rings with shimmer, THE sound of Recall Rogue, iconic and memorable, pixel art game boot screen, authentic NES 2A03 chip sound, retro game SFX, one-shot, no music
```

---

# AMBIENT LOOPS

### Hub Campfire Ambience
**Type:** Loop | **Duration:** 5-10s | **BPM:** free

```
NES 8-bit campfire crackling ambient loop, pure chiptune, noise channel producing irregular crackling ember pattern, very quiet distant triangle wave low hum like wind, no melody no rhythm just atmospheric texture, dungeon camp ambient background, pixel art campfire in stone corridor, authentic NES 2A03 chip sound, retro game SFX, seamless loop, very quiet background texture
```

### Dungeon Dripping Water
**Type:** Loop | **Duration:** 5-10s | **BPM:** free

```
NES 8-bit cave dripping water ambient loop, pure chiptune, noise channel sparse random drip sounds at irregular intervals, single very quiet pulse wave note per drip, dark dungeon atmosphere, pixel art stone corridors, authentic NES 2A03 chip sound, retro game SFX, seamless loop, very quiet background texture
```

---

# GENERATION STRATEGY

### Priority Order
1. **Quiz sounds** (correct/wrong) — heard every single encounter
2. **Card play swooshes** (attack/shield/buff/debuff/wild) — heard every card play
3. **Enemy attack + player damage** — core combat feedback
4. **Chain links 1-5 + chain break** — the knowledge chain is the signature mechanic
5. **Button click + modal sounds** — heard constantly during navigation
6. **Encounter start/victory** — fight boundaries
7. **Everything else** — fill in as needed

### Folder Structure
```
public/assets/audio/sfx/
  combat/       — card play, enemy, damage, shield, chain
  status/       — poison, burn, bleed, weakness, strength
  quiz/         — correct, wrong, timer, appear
  encounter/    — start, victory, boss entrance
  surge/        — announce, active loop
  turn/         — player turn, enemy turn, end turn, perfect
  relic/        — trigger, acquired, death prevent
  ui/           — button, modal, toggle, tab, error, notification
  flow/         — run start, floor transition, map click, level up, gold, shop
  ambient/      — campfire loop, dripping water loop
  boot/         — logo sound
```
