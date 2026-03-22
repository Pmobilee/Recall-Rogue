# AR-228: Complete Audio Event Catalog

**Status:** Active — living reference document
**Priority:** High (audio is a core pillar of game feel)
**Dependencies:** None (catalog-only; implementation is separate)
**Complexity:** Documentation + ongoing maintenance

---

## Overview

This AR establishes the **definitive, exhaustive audio event catalog** for Recall Rogue. Every single interaction, event, transition, feedback moment, and ambient element that should produce sound is cataloged here — organized by system, with creative sound design direction, priority, and current implementation status.

**This document is a LIVING REFERENCE.** Whenever ANY new mechanic, screen, interaction, enemy, card type, relic, room, or UI element is added to the game, the corresponding audio events MUST be added to this catalog. No exceptions.

---

## Current Audio Infrastructure

- **Engine:** Web Audio API synthesis (no external files) — `src/services/audioService.ts`
- **Combat layer:** `src/services/cardAudioManager.ts` — 14 cues mapped to 42 synthesized sounds
- **Biome layer:** `src/game/managers/AudioManager.ts` — 25 biome ambient configs
- **Settings:** SFX + Music volume sliders with localStorage persistence
- **Music:** Not yet implemented (BGM channel reserved in cardAudioManager)

---

## Audio Event Tables

### Legend

| Column | Meaning |
|--------|---------|
| **Event** | The discrete moment that triggers sound |
| **Sound Design Direction** | Creative description of the ideal sound |
| **Priority** | P0 = ship-blocking, P1 = core feel, P2 = polish, P3 = nice-to-have |
| **Status** | `DONE` = implemented, `STUB` = placeholder/wrong sound, `NONE` = missing |
| **Current Cue** | The existing `CardAudioCue` or `SoundName` if any |
| **Source** | Recommended acquisition method — `Synth (Web Audio)`, `Sonniss GDC`, `jsfxr export`, `Composed/Licensed`, `Freesound CC0`, or `Kenney CC0` |

---

### 1. COMBAT — Card Play & Resolution

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 1.01 | **Card selected from hand** | Soft parchment lift — a gentle "fwip" like picking up a card from a table. Light, tactile, satisfying. | P1 | NONE | — | jsfxr export — retro tactile feel matches pixel art |
| 1.02 | **Card deselected / put back** | Inverse of select — soft "tap" of card settling back into hand position. Quieter than select. | P2 | NONE | — | jsfxr export — inverse of select, same family |
| 1.03 | **Card hover (mouse/touch preview)** | Barely-there paper rustle. Must not fatigue — player hovers constantly. Subtle air displacement. | P3 | NONE | — | Synth (Web Audio) — must be ultra-subtle, procedural best |
| 1.04 | **Quick Play — Attack card** | Sharp metallic slash — a blade cutting air. Rising pitch "schwing" that ends with a satisfying impact thud. Fast (150ms). | P0 | DONE | `card-swoosh-attack` | Synth (Web Audio) — already done, keep |
| 1.05 | **Quick Play — Shield card** | Heavy stone-on-stone grind. Like a castle gate dropping into place. Resonant, weighty, protective. Ends with a "CLUNK". | P0 | DONE | `card-swoosh-shield` | Synth (Web Audio) — already done, keep |
| 1.06 | **Quick Play — Buff card** | Ascending crystalline chime cascade — like wind chimes in a magical breeze. Sparkly, uplifting, ethereal. | P0 | DONE | `card-swoosh-buff` | Synth (Web Audio) — already done, keep |
| 1.07 | **Quick Play — Debuff card** | Dark descending warble — a cursed whisper with pitch-bending. Ominous, brief, like something vital being drained. | P0 | DONE | `card-swoosh-debuff` | Synth (Web Audio) — already done, keep |
| 1.08 | **Quick Play — Wild card** | Chaotic swirl of mixed elements — crackling energy, whooshing wind, a brief magical explosion. Unpredictable but exciting. | P0 | DONE | `card-swoosh-wild` | Synth (Web Audio) — already done, keep |
| 1.09 | **Charge Play initiated (quiz triggered)** | Arcane energy gathering — a rising hum like a capacitor charging. Builds tension. The sound of knowledge being called upon. | P1 | NONE | — | Synth (Web Audio) — rising hum needs procedural pitch control |
| 1.10 | **Charge — Correct answer** | Triumphant power release! A bright major-chord burst followed by a resonant impact. The sound of knowledge made manifest as power. Euphoric, punchy. | P0 | DONE | `correct-impact` → `quiz_correct` | Synth (Web Audio) — already done |
| 1.11 | **Charge — Wrong answer** | Soft deflation — a muted "fwomp" like a balloon losing air. NOT punishing. Gentle, brief, encourages trying again. No harsh buzzer. | P0 | DONE | `wrong-fizzle` → `quiz_wrong` | Synth (Web Audio) — already done |
| 1.12 | **Charge — Critical correct (mastery tier-up)** | The correct answer sound BUT elevated — add shimmering overtones, a choir-like sustain, golden resonance. Player just leveled up their knowledge. | P1 | DONE | `correct-critical` → `mastery_glow` | Synth (Web Audio) — already done |
| 1.13 | **Card fizzle (blocked by enemy immunity)** | Pathetic puff of smoke — a sad little "pfft" with rapidly decaying reverb. The card tried but the enemy just shrugged it off. | P1 | NONE | — | Synth (Web Audio) — sad puff, simple synthesis |
| 1.14 | **Card discard (end of turn)** | Quick paper slide — cards swept off a table into a pile. Smooth, fast, satisfying. Like a dealer collecting cards. | P1 | DONE | `card-discard` | Synth (Web Audio) — already done |
| 1.15 | **Card exhaust (permanent removal)** | Paper burning to ash — a brief crackle-and-sizzle. More dramatic than discard. This card is GONE. Flame whoosh + ash crumble. | P1 | NONE | — | Sonniss GDC — fire/ash crackle needs organic texture |
| 1.16 | **Card draw (individual)** | Crisp paper snap — a single card being dealt from a deck. Light, precise, slightly different pitch each draw for variety. | P1 | DONE | `card-draw` → `item_pickup` | Synth (Web Audio) — already done |
| 1.17 | **Hand dealt (multiple cards)** | Rapid-fire card snaps — 1.16 played in quick 80ms stagger. Creates a satisfying "ftt-ftt-ftt-ftt-ftt" rhythm. | P1 | DONE | Staggered `card_deal` | Synth (Web Audio) — already done |
| 1.18 | **Reshuffle discard → draw pile** | Casino shuffle — the classic riffle shuffle sound. Cards being gathered, tapped, and interleaved. Satisfying deck manipulation. | P1 | DONE | `card_shuffle` | Synth (Web Audio) — already done |
| 1.19 | **Card effect resolves — damage number appears** | Punchy hit impact layered with the card type sound. A meaty "THWACK" for attacks, shield "CLANG" for blocks. | P1 | STUB | `enemy-hit` → `mine_rock` | Sonniss GDC — meaty impact needs weight |
| 1.20 | **Double Strike activates** | Metallic "ching-CHING!" — two rapid impacts, second louder than first. Staccato, aggressive, doubled power. | P2 | NONE | — | Sonniss GDC — metallic impact pair |
| 1.21 | **Inscription resolves (permanent combat buff)** | Ancient rune etching — a deep resonant "VWOOOM" like carving magic into stone. Weighty, permanent-sounding. | P2 | NONE | — | Synth (Web Audio) — resonant drone, procedural best |

---

### 2. COMBAT — Enemy Actions

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 2.01 | **Enemy intent telegraph shown** | Ominous low rumble — like distant thunder. A warning. The enemy is telegraphing their next move. Brief, foreboding. | P1 | NONE | — | Synth (Web Audio) — low rumble, parameterized per enemy |
| 2.02 | **Enemy attacks player** | Impact that matches enemy type — slash (blade enemies), thud (brute enemies), sizzle (magic enemies). Screen shake pairs with this. | P0 | NONE | — | Sonniss GDC — impact foley varies by enemy type |
| 2.03 | **Enemy charges up (winding up big attack)** | Rising energy buildup — a menacing drone that gets louder and higher-pitched. Danger is accumulating. Like a turbine spooling up. | P1 | NONE | — | Synth (Web Audio) — rising drone, procedural timing |
| 2.04 | **Enemy charged attack releases** | MASSIVE impact — everything from 2.02 but 3x louder and deeper. A thunderclap + earthquake rumble. This is the big one. | P1 | NONE | — | Sonniss GDC — massive impact, organic weight |
| 2.05 | **Enemy gains block/defend** | Stone wall rising — a grinding, heavy "KRRRRK" like rock sliding into place. Defensive, immovable. | P1 | NONE | — | Sonniss GDC — stone/rock grinding |
| 2.06 | **Enemy buffs self (strength, etc.)** | Dark power surge — a guttural roar mixed with crackling dark energy. The enemy just got stronger. Intimidating. | P1 | NONE | — | Synth (Web Audio) — dark energy surge, procedural |
| 2.07 | **Enemy debuffs player** | Curse application — a sickly wet "splat" followed by a descending chromatic tone. Something bad was applied to you. | P1 | NONE | — | Synth (Web Audio) — curse sound, procedural pitch |
| 2.08 | **Enemy enrages** | Bestial roar — a deep, distorted growl that rises to a scream. Combined with a percussion hit. Pure aggression. | P1 | NONE | — | Sonniss GDC — bestial roar needs organic vocal |
| 2.09 | **Enemy phase transition (boss/elite)** | Dramatic transformation — glass shattering, followed by new menacing theme elements. The fight just changed. A brief musical sting. | P1 | NONE | — | Sonniss GDC + Synth — glass shatter + musical sting |
| 2.10 | **Enemy defeated** | Satisfying destruction — a crumbling/shattering sound followed by a brief victorious sting (2-3 notes ascending). Relief + triumph. | P0 | STUB | `enemy-death` → `mine_break` | Sonniss GDC — crumbling/shatter needs organic texture |
| 2.11 | **Enemy heals self** | Reverse damage sound — a gentle, restorative shimmer. Like 2.02 played backwards with a soft chime. Frustrating but fair. | P2 | NONE | — | Synth (Web Audio) — reverse shimmer, procedural |
| 2.12 | **Enemy dialogue appears** | Text scroll typewriter — rapid "tik-tik-tik" like an old printer, pitch-shifted per enemy personality. Adds character. | P2 | NONE | — | Synth (Web Audio) — typewriter tick, procedural pitch per enemy |

---

### 3. COMBAT — Player Health & Status

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 3.01 | **Player takes damage (to HP)** | Painful impact — a dull, heavy "thump" with a slight wince quality. Not graphic, but you FEEL it. Low-end punch. | P0 | NONE | — | Sonniss GDC — heavy thump, organic |
| 3.02 | **Player takes damage (shield absorbs)** | Shield deflection — metallic "CLANG" followed by cracking glass. Shield held, but barely. Less painful than 3.01. | P1 | NONE | — | Sonniss GDC — metallic clang |
| 3.03 | **Shield breaks (depleted to 0)** | Glass shattering — a dramatic crystalline shatter. Your protection is gone. Exposed. Alarming but brief. | P1 | NONE | — | Sonniss GDC — glass shatter |
| 3.04 | **Shield gained** | Crystalline formation — ascending glass tones, like ice crystals growing. Protective, reassuring, magical. | P1 | NONE | — | Synth (Web Audio) — crystalline ascending, procedural |
| 3.05 | **Player healed** | Warm restoration — a gentle harp glissando with a soft chime. Soothing, like sunlight touching skin. Relief. | P1 | NONE | — | Synth (Web Audio) — harp glissando, procedural |
| 3.06 | **Immunity triggered (damage negated)** | Holy shield flash — a bright, ringing bell tone. Divine protection activating. Clear, resonant, triumphant. | P2 | NONE | — | Synth (Web Audio) — bell tone, simple synthesis |
| 3.07 | **Player defeated (HP reaches 0)** | Heartbeat slowing to silence — three slow, deep heartbeats that fade to nothing. Then a quiet, somber musical phrase. NOT a harsh "game over" buzzer. | P0 | NONE | — | Synth (Web Audio) — heartbeat fade, needs precise timing control |
| 3.08 | **Low HP warning (below 25%)** | Subtle heartbeat — a rhythmic, low-frequency pulse that plays softly under combat. Builds tension without being annoying. | P1 | NONE | — | Synth (Web Audio) — rhythmic pulse, must sync with game state |
| 3.09 | **Poison applied to player** | Toxic bubble — a wet, gurgling "blorp" with a sickly green quality. Gross but not excessive. Brief acid splash. | P1 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.10 | **Poison tick (damage each turn)** | Repeated mini-version of 3.09 — shorter, quieter. A reminder drip of toxicity. "Blip." | P1 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.11 | **Burn applied** | Flame ignition — a "FWOOSH" of fire catching. Brief, hot, crackling. | P1 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.12 | **Burn tick** | Sizzling ember — a quick "tsss" like a hot pan. Shorter than ignition. | P1 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.13 | **Bleed applied** | Wet slice — a quick "schlick" sound. Uncomfortable but brief. Something was cut. | P1 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.14 | **Weakness applied** | Energy drain — a descending "woooooo" like air leaving a balloon. Deflating, weakening. | P1 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.15 | **Vulnerability applied** | Armor crack — a sharp "CRACK" like ceramic splitting. You're exposed, fragile. | P1 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.16 | **Strength buff applied** | Power surge — a brief upward "VRRM" like an engine revving. Muscles tightening. Raw power. | P1 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.17 | **Regen applied** | Nature bloom — soft wind through leaves + a gentle musical tone. Growth, renewal, green energy. | P2 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.18 | **Focus applied** | Mental clarity — a crystalline "ting" like a meditation bell. Mind sharpening, thoughts aligning. | P2 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.19 | **Status effect expires** | Soft dissolve — a quiet "psssh" like steam dissipating. The effect faded. Barely noticeable. | P3 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.20 | **Regen tick (heal each turn)** | Mini healing chime — a tiny version of 3.05. "Ting." Quick, pleasant, recurring. | P2 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.21 | **Poison applied to enemy** | Same as 3.09 but slightly different pitch (higher) — poison hitting the enemy, not you. | P1 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |
| 3.22 | **Poison tick on enemy** | Same as 3.10 but higher pitch — enemy taking the drip. | P2 | NONE | — | Synth (Web Audio) — unique synthesis, pitch-shifted per source |

---

### 4. COMBAT — Chain System

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 4.01 | **Chain started (1st link)** | First link forged — a metallic "clink" like a chain link connecting. Clean, clear, promising. The beginning of something powerful. | P1 | NONE | — | Synth (Web Audio) — MUST be procedural, pitch ascends per link |
| 4.02 | **Chain extended (2nd link)** | Second link — same "clink" but a half-step higher in pitch. Building momentum. | P1 | NONE | — | Synth (Web Audio) — MUST be procedural, pitch ascends per link |
| 4.03 | **Chain extended (3rd link)** | Third link — another step up. Now add a subtle harmonic undertone. The chain is glowing. | P1 | NONE | — | Synth (Web Audio) — MUST be procedural, pitch ascends per link |
| 4.04 | **Chain extended (4th link)** | Fourth link — pitch climbs further. Add a shimmering reverb tail. Almost at max power. | P1 | NONE | — | Synth (Web Audio) — MUST be procedural, pitch ascends per link |
| 4.05 | **Chain maxed (5th link — 3.0x)** | MAXIMUM CHAIN — all previous tones resolve into a powerful chord. A brief fanfare. "CLINK-CLINK-CLANG-BOOM!" The chain is fully forged, glowing white-hot. | P0 | NONE | — | Synth (Web Audio) — MUST be procedural, pitch ascends per link |
| 4.06 | **Chain broken / reset** | Chain snapping — a sharp metallic "SNAP" followed by links scattering (tiny metallic tinkles). Momentum lost. Brief, disappointing but not devastating. | P1 | NONE | — | Sonniss GDC — metallic snap needs organic texture |
| 4.07 | **Chain multiplier applied to damage** | Power amplification — the card's impact sound (1.04-1.08) plays at proportionally higher volume/pitch based on chain multiplier. A 3x chain makes the attack sound MASSIVE. | P1 | NONE | — | Synth (Web Audio) — scales with multiplier value |
| 4.08 | **Chain Momentum activated (free Charge)** | Gift of momentum — a quick ascending arpeggio like receiving a power-up in a classic platformer. "You earned a freebie!" Bright, rewarding. | P2 | NONE | — | Synth (Web Audio) — ascending arpeggio, procedural |

---

### 5. COMBAT — Turn Flow & Surge

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 5.01 | **Player turn starts** | Turn bell — a single, clear bell chime. "Your move." Crisp, authoritative, signals the player to act. Like a chess clock. | P0 | DONE | `turn-chime` → `collect` | Synth (Web Audio) — already done (turn-chime) |
| 5.02 | **Enemy turn starts** | Ominous shift — a low, brief brass stab. "Their move." Darker than 5.01. Tension rises. | P1 | NONE | — | Synth (Web Audio) — ominous brass stab, simple synthesis |
| 5.03 | **AP spent (each card played)** | Energy orb consumed — a soft "pop" like a soap bubble bursting. Light, ephemeral. One orb of energy used. | P2 | NONE | — | jsfxr export — small, retro UI pops |
| 5.04 | **AP gained mid-turn** | Energy orb granted — a bright "ping" like a coin appearing. Positive, unexpected, small reward sound. | P2 | NONE | — | jsfxr export — small, retro UI pops |
| 5.05 | **AP exhausted (no more plays possible)** | Empty well — a hollow, echoing "thud" at the bottom of a barrel. You're out. Subtle but clear. | P2 | NONE | — | jsfxr export — small, retro UI pops |
| 5.06 | **Surge turn announced** | KNOWLEDGE SURGE — a dramatic bass thrum followed by rising golden energy. Like a power plant activating. Deep, resonant, exciting. All Charges are free this turn! | P0 | NONE | — | Synth (Web Audio) — bass thrum + golden energy, needs layered synthesis |
| 5.07 | **Surge turn ambient loop** | Golden hum — a continuous, warm, harmonious drone that plays throughout the Surge turn. Empowering, elevated, time-limited urgency. Fades when Surge ends. | P1 | NONE | — | Synth (Web Audio) — continuous loop, must be procedural for seamless looping |
| 5.08 | **Surge turn ends** | Power winding down — the golden hum from 5.07 descends in pitch and fades out. The special moment has passed. Return to normal. | P1 | NONE | — | Synth (Web Audio) — descending fade, procedural |
| 5.09 | **Perfect turn achieved** | Perfection fanfare — a brief 3-note ascending melody (think "da-da-DA!"). You played every card correctly. Rare, celebratory. | P1 | NONE | — | Synth (Web Audio) — fanfare arpeggio |
| 5.10 | **Combo counter: 3 cards** | Combo milestone — an encouraging "ding-ding-ding" at ascending pitches. Small combo. Getting started. | P1 | DONE | `combo-3` → `streak_milestone` | Synth (Web Audio) — already done for 3/5, add 10+ |
| 5.11 | **Combo counter: 5 cards** | Major combo — a more elaborate fanfare. Five-note ascending scale with a flourish. Impressive streak! | P1 | DONE | `combo-5` → `mastery_fullscreen` | Synth (Web Audio) — already done for 3/5, add 10+ |
| 5.12 | **Combo counter: 10+ cards** | LEGENDARY combo — full celebratory phrase. Orchestra hit + shimmering cascade. This almost never happens. Make it unforgettable. | P2 | NONE | — | Synth (Web Audio) — already done for 3/5, add 10+ |
| 5.13 | **End turn button pressed** | Decisive click — a heavier version of a button click. "I'm done." Has weight and finality. Like closing a book. | P1 | NONE | — | jsfxr export — decisive retro click |

---

### 6. COMBAT — Relic Triggers

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 6.01 | **Relic triggers (generic — any relic activates)** | Magical pulse — a brief, shimmering "whoosh" from the relic tray. Something in your inventory just did something. Attention-getting but not disruptive. | P1 | NONE | — | Synth (Web Audio) — shimmer pulse, parameterized |
| 6.02 | **Defensive relic triggers (Iron Shield, Stone Wall)** | Metallic reinforcement — a brief "clang" + shield shimmer. Your relic added protection. Heavier version of 6.01. | P2 | NONE | — | Synth (Web Audio) — variants of 6.01 with type-specific timbre |
| 6.03 | **Offensive relic triggers (Whetstone, Flame Brand)** | Weapon enhancement — a brief "shing" of a blade being sharpened. Your relic boosted your attack. Sharper version of 6.01. | P2 | NONE | — | Synth (Web Audio) — variants of 6.01 with type-specific timbre |
| 6.04 | **Healing relic triggers (Herbal Pouch)** | Nature's touch — a quick leaf-rustle + soft chime. Your relic healed you. Gentle version of 6.01. | P2 | NONE | — | Synth (Web Audio) — variants of 6.01 with type-specific timbre |
| 6.05 | **AP relic triggers (Blood Price, Paradox Engine)** | Energy flash — a quick electrical "zap". Your relic gave you more action points. Energetic version of 6.01. | P2 | NONE | — | Synth (Web Audio) — variants of 6.01 with type-specific timbre |
| 6.06 | **Deja Vu card spawn** | Card materialization — a "poof" of magical smoke followed by a card-snap. A card appeared from nothing! | P2 | NONE | — | Synth (Web Audio) — magical poof |
| 6.07 | **Death prevention relic activates** | Last stand — dramatic reversal! A heartbeat stops... then THUDS back. Life force returning. Dramatic, relieving, heroic. | P1 | NONE | — | Synth (Web Audio) — heartbeat reversal, dramatic timing |
| 6.08 | **Capacitor AP release** | Stored energy unleashed — electrical discharge "BZZZT-pop". Charged-up power released all at once. | P2 | NONE | — | Synth (Web Audio) — electrical discharge |

---

### 7. QUIZ SYSTEM

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 7.01 | **Quiz overlay appears (field scan opens)** | Knowledge interface activating — a sci-fi "bweeee" like a scanner powering on. The quiz is loading. Futuristic, focused. | P1 | NONE | — | Synth (Web Audio) — scanner power-on, procedural |
| 7.02 | **Quiz answer selected (tap/click)** | Decisive selection — a tactile "click" with slight reverb. You've committed to your answer. Weightier than a normal button. | P1 | NONE | — | jsfxr export — tactile click |
| 7.03 | **Answer correct** | See 1.10 — same sound. Bright, triumphant, powerful. | P0 | DONE | `quiz_correct` | Synth (Web Audio) — already done |
| 7.04 | **Answer wrong** | See 1.11 — same sound. Soft, non-punishing. | P0 | DONE | `quiz_wrong` | Synth (Web Audio) — already done |
| 7.05 | **Speed bonus awarded** | Time bonus chime — a quick ascending "ting-ting!" overlaid on the correct answer sound. Extra reward for fast thinking. | P2 | NONE | — | Synth (Web Audio) — overlay chime on correct answer |
| 7.06 | **Quiz dismissed / "Got it" pressed** | Interface closing — the reverse of 7.01. Scanner powering down. Brief, clean. | P2 | NONE | — | Synth (Web Audio) — scanner power-down |
| 7.07 | **Quiz timer ticking (last 3 seconds)** | Urgency ticks — accelerating metronome clicks. "Tick... tick.. tick. tick tick tick." Pressure without panic. | P1 | NONE | — | Synth (Web Audio) — MUST be procedural, accelerates |
| 7.08 | **Memory tip shown (after wrong answer)** | Gentle teach moment — a soft, warm tone like a teacher's "ah, let me explain." Nurturing, not condescending. | P3 | NONE | — | jsfxr export — gentle notification |
| 7.09 | **Streak bonus displayed** | Streak climbing — ascending xylophone notes, one per streak level. Higher streak = higher pitch. Encouraging. | P2 | NONE | — | Synth (Web Audio) — ascending xylophone, pitch per level |

---

### 8. ENCOUNTER LIFECYCLE

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 8.01 | **Encounter starts (enemy appears)** | Battle entrance — a dramatic percussion hit + brief brass sting. Like a curtain rising on a fight. Adrenaline spike. | P0 | NONE | — | Sonniss GDC + Synth — percussion hit + brass sting |
| 8.02 | **Boss encounter starts** | Boss entrance — MASSIVE version of 8.01. Deep drums, ominous choir, ground-shaking impact. This enemy is different. Fear and excitement. | P0 | NONE | — | Sonniss GDC + Synth — massive drums + choir |
| 8.03 | **Elite encounter starts** | Elite entrance — 8.01 but with added menace. A warning bell or gong. Harder than normal, but not boss-level terror. | P1 | NONE | — | Sonniss GDC — warning gong |
| 8.04 | **Encounter victory** | Victory fanfare — a bright, triumphant 4-note melody (ascending major scale). Relief + accomplishment. Like finding treasure in Zelda. | P0 | NONE | — | Synth (Web Audio) — triumphant 4-note melody |
| 8.05 | **Encounter defeat** | Defeat theme — see 3.07. Heartbeat fading. Somber, reflective, NOT punishing. | P0 | NONE | — | Synth (Web Audio) — see 3.07 |
| 8.06 | **Boss defeated** | EPIC victory — 8.04 but extended, with orchestra swells and a cymbal crash. You slayed the dragon. Exhilarating. | P0 | NONE | — | Synth (Web Audio) — extended victory fanfare |
| 8.07 | **Boss intro overlay appears** | Boss announcement — dramatic drum roll building to a cymbal hit when the boss name appears. Like a wrestling entrance. | P1 | NONE | — | Sonniss GDC — dramatic drum roll |

---

### 9. DUNGEON MAP & ROOM NAVIGATION

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 9.01 | **Map screen opens** | Map unfurling — parchment unrolling + a brief adventurous musical phrase. "Where shall we go?" Exploratory, exciting. | P1 | NONE | — | Freesound CC0 — parchment unrolling |
| 9.02 | **Map node hovered** | Subtle highlight — a quiet "whoosh" like wind brushing past a signpost. Almost subliminal. Must not fatigue. | P3 | NONE | — | Synth (Web Audio) — subtle whoosh |
| 9.03 | **Map node clicked (room selected)** | Path chosen — a decisive footstep on stone + a brief confirmation tone. "Onward!" Committed, forward-moving. | P1 | NONE | — | jsfxr export — footstep + confirmation |
| 9.04 | **Path revealed (locked → available)** | Path unlocking — stone grinding away, revealing a passage. "KRRRK-click!" A door opening. New possibilities. | P2 | NONE | — | Sonniss GDC — stone grinding |
| 9.05 | **Boss node pulsing** | Menacing heartbeat — a deep, slow pulse emanating from the boss node. Dread. "Something powerful awaits." | P2 | NONE | — | Synth (Web Audio) — heartbeat loop, procedural |
| 9.06 | **Elite node pulsing** | Warning pulse — similar to 9.05 but faster and less deep. "Danger ahead, but manageable." | P3 | NONE | — | Synth (Web Audio) — heartbeat loop, procedural |
| 9.07 | **Floor transition (delve deeper)** | Descending — footsteps going down stairs + a deep, reverberant "boom" as you hit the next floor. Gravity, depth, commitment. | P1 | NONE | — | Sonniss GDC — footsteps descending |
| 9.08 | **Map cinematic auto-scroll** | Journey progression — ambient wind + soft percussion. Movement. You're traveling through the dungeon. | P2 | NONE | — | Synth (Web Audio) — ambient wind, procedural |
| 9.09 | **Room transition (parallax animation)** | Footsteps + ambience — 4-6 footsteps on stone/wood/dirt (matching room type) with environmental sounds (dripping water, creaking wood, wind). | P1 | NONE | — | Sonniss GDC — footsteps + environment |

---

### 10. HUB SCREEN

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 10.01 | **Hub screen loads / return to hub** | Home arrival — a warm, welcoming musical phrase. Campfire crackling. Safe haven. Like coming home after an adventure. | P1 | NONE | — | Synth (Web Audio) — warm welcome phrase |
| 10.02 | **Hub ambient loop** | Campfire ambience — crackling fire, distant crickets, gentle wind, occasional owl hoot. Cozy, safe, contemplative. | P1 | NONE | — | Freesound CC0 — campfire + crickets + wind |
| 10.03 | **Start Run button** | Adventure begins — a bold horn call or drum beat. "TO BATTLE!" Exciting, forward-leaning. | P0 | NONE | — | Synth (Web Audio) — bold horn call |
| 10.04 | **Library button** | Book opening — heavy leather-bound book being opened. "WHUMP-creak." Scholarly, weighty. | P2 | NONE | — | jsfxr export — themed retro clicks per button type |
| 10.05 | **Settings button** | Gear click — a mechanical "click-whirr" like turning a clockwork mechanism. Precise, utilitarian. | P2 | NONE | — | jsfxr export — themed retro clicks per button type |
| 10.06 | **Campfire click (Easter egg)** | Sparkle burst — crackling fire intensifies briefly + sparks popping. Fun, interactive, rewarding curiosity. | P2 | NONE | — | jsfxr export — themed retro clicks per button type |
| 10.07 | **Pet click** | Pet sound — a happy "mrow!" or "woof!" depending on pet type. Speech bubble appears. Cute, joyful. | P2 | NONE | — | jsfxr export — themed retro clicks per button type |
| 10.08 | **Profile button** | Character acknowledge — a brief vocal grunt or "hmm?" The character notices you. | P3 | NONE | — | jsfxr export — themed retro clicks per button type |
| 10.09 | **Leaderboards button** | Scroll unfurling — parchment unrolling quickly. Competitive, ranked. | P3 | NONE | — | jsfxr export — themed retro clicks per button type |
| 10.10 | **Journal button** | Pages flipping — rapid page-turning sound. Reflective, academic. | P3 | NONE | — | jsfxr export — themed retro clicks per button type |
| 10.11 | **Relic Collection button** | Treasure chest creak — wooden chest lid opening. "What treasures do I have?" | P3 | NONE | — | jsfxr export — themed retro clicks per button type |

---

### 11. SHOP ROOM

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 11.01 | **Shop opens** | Merchant welcome — a door chime (bell on door) + ambient market sounds. "Welcome, traveler!" Inviting, commercial. | P1 | NONE | — | Freesound CC0 — door bell chime |
| 11.02 | **Item hovered in shop** | Coin jingle — a soft jingle of coins in pocket. "Can I afford this?" Tempting. | P3 | NONE | — | jsfxr export — coin jingle |
| 11.03 | **Item purchased (gold spent)** | Cash register — satisfying "ka-ching!" Coins clinking on a counter. Transaction complete. Rewarding despite losing gold. | P0 | NONE | — | Sonniss GDC — coin cascade |
| 11.04 | **Insufficient gold (can't afford)** | Empty purse — a sad, hollow rattle of an empty coin pouch. Brief "nuh-uh" tone. Not enough gold. | P1 | NONE | — | jsfxr export — sad rattle |
| 11.05 | **Relic purchased** | Special purchase — 11.03 but with added magical shimmer. You bought something powerful. | P1 | NONE | — | Sonniss GDC + Synth — purchase base + type shimmer |
| 11.06 | **Card purchased** | Card acquired — 11.03 + a card snap. New card in your deck. | P1 | NONE | — | Sonniss GDC + Synth — purchase base + type shimmer |
| 11.07 | **Card removal purchased** | Card dissolved — 11.03 + a paper-tearing sound. Deck thinned. Strategic. | P1 | NONE | — | Sonniss GDC + Synth — purchase base + type shimmer |
| 11.08 | **Haggle quiz triggered** | Negotiation start — a cunning "heh heh" merchant laugh + quiz activation (7.01). Let's make a deal! | P2 | NONE | — | Synth (Web Audio) — merchant laugh synthesis |
| 11.09 | **Haggle success** | Discount won — coins clinking joyfully + a brief "cha-ching" at lower cost. You outsmarted the merchant! | P2 | NONE | — | Sonniss GDC — coins + discount sting |
| 11.10 | **Haggle failure** | No deal — merchant tsk-tsk + a soft negative tone. Full price it is. | P2 | NONE | — | jsfxr export — negative boop |
| 11.11 | **Shop closes / leave** | Door bell again — the entry bell chimes as you leave. Farewell. | P2 | NONE | — | Freesound CC0 — door bell |

---

### 12. REST SITE

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 12.01 | **Rest site opens** | Peaceful arrival — a deep, relaxing exhale + campfire sounds. Soft wind. "You can rest here." Calming, restorative. | P1 | NONE | — | Freesound CC0 — campfire + exhale |
| 12.02 | **Heal option selected (rest)** | Deep rest — a slow, warm musical swell like a lullaby. Healing energy washing over you. HP restored. Comforting. | P1 | NONE | — | Synth (Web Audio) — warm musical swell |
| 12.03 | **Study option selected (quiz practice)** | Book opening + pen scratch — scholarly sounds. "Time to study." Focused, academic. | P1 | NONE | — | Freesound CC0 — book opening + pen |
| 12.04 | **Meditate option selected (remove card)** | Meditation bell — a single, resonant singing bowl strike. "Ommmm." The mind clears. One card released. | P1 | NONE | — | Freesound CC0 — singing bowl |
| 12.05 | **Card removal confirmed (meditate)** | Card dissolving — paper turning to light, ascending particles. Release. Freedom. The deck is leaner. | P1 | NONE | — | Synth (Web Audio) — ascending dissolve |
| 12.06 | **Rest site closes** | Refreshed departure — a quick, energized musical phrase. "Back to the dungeon!" Ready to go. | P2 | NONE | — | Synth (Web Audio) — energized phrase |

---

### 13. REWARDS & LOOT

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 13.01 | **Reward screen appears** | Treasure reveal — a sparkly, ascending harp run. "Look what you've earned!" Exciting, Christmas-morning feeling. | P0 | NONE | — | Synth (Web Audio) — sparkly harp run |
| 13.02 | **Gold reward collected** | Coins cascading — a shower of coins hitting a pile. More gold = longer cascade. Rich, satisfying, greedy. | P1 | NONE | — | Sonniss GDC — coin cascade |
| 13.03 | **Card reward revealed — Common** | Simple reveal — a soft "ta-da" with minimal fanfare. A card, nothing special. Clean, clear. | P1 | DONE | `reveal_common` | Synth (Web Audio) — already done |
| 13.04 | **Card reward revealed — Uncommon** | Better reveal — a slightly more elaborate "ta-da" with a brief sparkle. Getting interesting. | P1 | DONE | `reveal_uncommon` | Synth (Web Audio) — already done |
| 13.05 | **Card reward revealed — Rare** | Exciting reveal — a dramatic reveal sting with shimmering overtones. "Ooh, this is good!" | P1 | DONE | `reveal_rare` | Synth (Web Audio) — already done |
| 13.06 | **Card reward revealed — Epic** | Major reveal — a powerful chord with choir-like sustain. "This changes things!" Purple energy. | P1 | DONE | `reveal_epic` | Synth (Web Audio) — already done |
| 13.07 | **Card reward revealed — Legendary** | Legendary reveal — a full orchestral sting with deep brass + high strings. Goosebumps. "INCREDIBLE!" | P1 | DONE | `reveal_legendary` | Synth (Web Audio) — already done |
| 13.08 | **Card reward revealed — Mythic** | Mythic reveal — transcendent. Multi-layered harmonics, otherworldly chorus, reality-bending distortion. Once-in-a-lifetime. | P1 | DONE | `reveal_mythic` | Synth (Web Audio) — already done |
| 13.09 | **Card reward accepted (added to deck)** | Card snap + shimmer — the card joins your collection. Satisfying "click" of a puzzle piece fitting. | P1 | NONE | — | jsfxr export — snap + shimmer |
| 13.10 | **Card reward skipped** | Passed on — a neutral "whoosh" as the cards fade. No penalty sound. A valid strategic choice. | P2 | NONE | — | Synth (Web Audio) — neutral whoosh |
| 13.11 | **Card reward rerolled** | Dice tumble — a brief rattle of dice/shuffling. New options! Fresh possibilities. Exciting gamble. | P2 | NONE | — | Sonniss GDC — dice rattle |
| 13.12 | **Relic reward acquired** | Relic obtained — a powerful magical "VWOOM" + ascending crystalline tones. A new artifact in your collection. Weighty, significant. | P0 | STUB | `item_pickup` | Synth (Web Audio) — magical VWOOM, upgrade from stub |
| 13.13 | **Treasure room items appearing** | Items materializing — sparkly pop-pop-pop as items appear one by one. Like opening a piñata. Delight. | P1 | NONE | — | Synth (Web Audio) — sparkly pop sequence |
| 13.14 | **Treasure room item collected** | Item grab — a quick, satisfying "grab" sound. Like snatching something off a shelf. Possessive, eager. | P1 | NONE | — | jsfxr export — grab sound |

---

### 14. MYSTERY & SPECIAL EVENTS

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 14.01 | **Mystery event screen appears** | Mysterious encounter — a harp glissando + distant wind chimes. "Something unusual..." Intriguing, uncertain, slightly eerie. | P1 | NONE | — | Synth (Web Audio) — harp + wind chimes |
| 14.02 | **Event choice selected** | Decision made — a decisive "stamp" like a wax seal on parchment. "So be it." Committed, irreversible. | P1 | NONE | — | jsfxr export — wax seal stamp |
| 14.03 | **Event outcome — positive** | Lucky break — bright, cheerful musical phrase + a coin-shower sound. Good things happened! | P1 | NONE | — | Synth (Web Audio) — bright musical phrase |
| 14.04 | **Event outcome — negative** | Misfortune — a minor-key descending phrase + a "creak" like old floorboards giving way. Something bad happened. Not devastating. | P1 | NONE | — | Synth (Web Audio) — minor-key descent |
| 14.05 | **Event outcome — neutral/story** | Narrative moment — a page-turning sound + a soft, contemplative musical tone. Something interesting happened. | P2 | NONE | — | Synth (Web Audio) — contemplative tone |
| 14.06 | **Special event appears** | Rare encounter — a dramatic version of 14.01. This is unusual even for mystery events. Extra shimmer + a "gasp" quality. | P1 | NONE | — | Synth (Web Audio) — dramatic shimmer |
| 14.07 | **Continue / advance text** | Page turn — a quick paper "flip." Story progressing. | P2 | NONE | — | jsfxr export — page flip |

---

### 15. RUN LIFECYCLE

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 15.01 | **New run started** | Adventure horn — a bold, ascending horn call. "THE QUEST BEGINS!" Epic, motivating, adventurous. | P0 | NONE | — | Synth (Web Audio) — horn call fanfare |
| 15.02 | **Domain selected** | Domain echo — a brief musical motif unique to each knowledge domain (science = electronic, history = orchestral, etc.). Thematic identity. | P1 | NONE | — | Synth (Web Audio) — domain-specific motif |
| 15.03 | **Floor cleared (all encounters done)** | Floor complete — a satisfying "level complete" jingle. Brief, celebratory, forward-momentum. "Deeper we go!" | P1 | NONE | — | Synth (Web Audio) — level complete jingle |
| 15.04 | **Retreat chosen (safe exit)** | Tactical retreat — a cautious, measured musical phrase. Not a defeat sound — a strategic withdrawal. Doors closing behind you. Wise, not cowardly. | P1 | NONE | — | Synth (Web Audio) — cautious musical phrase |
| 15.05 | **Delve deeper chosen** | Brave descent — a dramatic descending musical phrase + footsteps going DOWN. Into the depths. Courageous, uncertain. | P1 | NONE | — | Synth (Web Audio) — descending dramatic phrase |
| 15.06 | **Run victory (final boss defeated)** | ULTIMATE VICTORY — a full, extended triumphant fanfare. The longest, most elaborate celebratory music in the game. 5-8 seconds of pure joy. Orchestral swell, cymbal crashes, ascending melody. | P0 | NONE | — | Composed/Licensed — full triumphant theme |
| 15.07 | **Run defeat (game over screen)** | Run over — a somber, reflective musical phrase. NOT punishing. "It was a good run." Respectful of the player's effort. Gentle piano + strings. | P0 | NONE | — | Composed/Licensed — reflective piano theme |
| 15.08 | **Run summary stats appearing** | Stat tally — quick successive "tick" sounds as numbers count up. Like an arcade score counter. Satisfying, progressive. | P1 | NONE | — | jsfxr export — rapid ticking counter |
| 15.09 | **XP awarded** | Experience gained — a warm, building musical tone that swells as XP fills the bar. Growth, progress, investment paying off. | P1 | NONE | — | Synth (Web Audio) — warm building tone |
| 15.10 | **Level up!** | LEVEL UP — a triumphant sting + sparkle cascade. Clear "DING!" at the peak. Achievement unlocked feeling. One of the most rewarding sounds in the game. | P0 | NONE | — | Synth (Web Audio) — triumphant DING + sparkle |
| 15.11 | **Ascension unlocked** | New challenge — an ominous-yet-exciting musical phrase. "A harder path awaits." Dark power + golden triumph combined. | P1 | NONE | — | Synth (Web Audio) — ominous + golden phrase |

---

### 16. UI — GENERIC INTERACTIONS

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 16.01 | **Button click (generic)** | Clean click — a crisp, satisfying "click" with minimal reverb. Universal. Not fatiguing across hundreds of presses. | P0 | DONE | `button_click` | Synth (Web Audio) — already done |
| 16.02 | **Button hover (generic)** | Soft highlight — barely-there "whh" of air. Like a moth's wing. Must not fatigue. | P3 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.03 | **Modal opens** | Panel slide — a smooth "whoosh-click" as the modal slides/fades in and locks into place. Clean, modern, precise. | P1 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.04 | **Modal closes** | Panel retract — reverse of 16.03. Softer, quicker. Dismissive. | P1 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.05 | **Toggle on** | Switch flip — a satisfying "click-ON" with a bright, confirmatory quality. Something was activated. | P2 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.06 | **Toggle off** | Switch unflip — a softer "click-off". Something was deactivated. Slightly lower pitch than on. | P2 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.07 | **Slider adjusted** | Smooth sweep — a continuous tonal slide that tracks the slider value. Higher value = higher pitch. Satisfying analog knob feeling. | P2 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.08 | **Tab/nav switched** | Page flip — a quick "fwip" like turning a page in a notebook. Navigation, context switch. | P2 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.09 | **Dropdown opened** | Unfold — a brief "snap" of options appearing. Expanding, revealing. | P3 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.10 | **Dropdown selection** | Selection click — slightly more decisive than 16.01. "Choice made." | P3 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.11 | **Toast/notification appears** | Attention ping — a soft, high-pitched "ding" that cuts through other sounds. "Something happened!" Informational, not alarming. | P1 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.12 | **Toast auto-dismisses** | Fade away — a barely-audible "psssh." The notification is no longer relevant. | P3 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.13 | **Error / invalid action** | Gentle deny — a soft "bonk" or "boop." NOT a harsh buzzer. "That's not allowed right now." Informative, not punishing. | P1 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.14 | **Confirmation dialog appears** | Attention required — a slightly louder, more insistent version of 16.11. "Are you sure?" Two-note questioning phrase. | P2 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.15 | **Text input keystroke** | Soft tap — barely audible typing feedback. Only if user prefers it. Off by default. | P3 | NONE | — | jsfxr export — retro UI sound family, consistent style |
| 16.16 | **Scroll/swipe** | Subtle movement — a very quiet "swsh" of content moving. Almost inaudible. Presence, not annoyance. | P3 | NONE | — | jsfxr export — retro UI sound family, consistent style |

---

### 17. PROGRESSION & COLLECTION

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 17.01 | **Fact mastered (Tier 3 reached)** | Knowledge crystallized — a deep, satisfying "DING" + crystalline formation sound. A fact is now permanently etched in memory. Significant, proud. | P1 | NONE | — | Synth (Web Audio) — crystalline DING |
| 17.02 | **Mastery challenge quiz appears** | Trial announced — a gong strike + rising tension. "Prove your mastery!" Solemn, important. | P1 | NONE | — | Synth (Web Audio) — gong + trial stings |
| 17.03 | **Mastery trial passed** | Mastery confirmed — a triumphant sting (like 15.10 but shorter). "You've proven yourself!" Achievement. | P1 | NONE | — | Synth (Web Audio) — gong + trial stings |
| 17.04 | **Mastery trial failed** | Trial incomplete — a gentle "not yet" tone. Encouraging, not defeating. "Keep studying." | P2 | NONE | — | Synth (Web Audio) — gong + trial stings |
| 17.05 | **Relic collection screen opened** | Treasure vault — heavy door opening + echoing chamber. "Behold your artifacts." Reverential, impressive. | P2 | NONE | — | jsfxr export — UI family |
| 17.06 | **Relic unlocked in collection** | New unlock — a click + magical shimmer. Something new is available. Discovery! | P2 | NONE | — | jsfxr export — UI family |
| 17.07 | **Card browser opened** | Library access — book spines rustling + a studious musical tone. "Your knowledge archive." | P2 | NONE | — | jsfxr export — UI family |
| 17.08 | **Filter/sort changed** | Reorganize — a quick "shhk" like cards being sorted on a table. Instant, precise. | P3 | NONE | — | jsfxr export — UI family |
| 17.09 | **Deck preset created** | Plan locked in — a "click" + stamp seal. "Strategy set." Decisive, prepared. | P2 | NONE | — | jsfxr export — UI family |
| 17.10 | **Deck preset deleted** | Plan discarded — paper crumple. Brief, final. | P3 | NONE | — | jsfxr export — UI family |
| 17.11 | **Mechanic unlocked (level up)** | New ability — a bright, elaborate fanfare + a "whoosh" of new possibilities. "You learned something new!" Exciting, empowering. | P1 | NONE | — | Synth (Web Audio) — fanfare + ability whoosh |
| 17.12 | **Relic unlocked (level up)** | New artifact available — similar to 17.11 but with a more mystical quality. Ancient power now accessible. | P1 | NONE | — | Synth (Web Audio) — fanfare + ability whoosh |
| 17.13 | **Domain mastery milestone** | Domain expert — a unique sting per domain. "You've become an expert in [domain]!" Pride, specialization. | P2 | NONE | — | Synth (Web Audio) — fanfare + ability whoosh |

---

### 18. KEEPER NPC & DIALOGUE

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 18.01 | **Keeper toast appears (calm)** | Wise whisper — a soft chime + brief ambient pad. The Keeper has something to say. Measured, serene. | P2 | NONE | — | Synth (Web Audio) — parameterized per mood |
| 18.02 | **Keeper toast appears (excited)** | Enthusiastic chime — a brighter, faster version of 18.01. The Keeper is thrilled! Upbeat, energetic. | P2 | NONE | — | Synth (Web Audio) — parameterized per mood |
| 18.03 | **Keeper toast appears (stern)** | Warning tone — a lower, more serious version of 18.01. "Pay attention." Authoritative. | P2 | NONE | — | Synth (Web Audio) — parameterized per mood |
| 18.04 | **Keeper toast appears (curious)** | Inquisitive ping — a questioning musical phrase (rising interval). "Hmm, interesting..." Thoughtful. | P2 | NONE | — | Synth (Web Audio) — parameterized per mood |

---

### 19. SAVE & SYSTEM

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 19.01 | **Autosave triggered** | Subtle save — a nearly-inaudible "click" + brief icon flash. The game just saved. Barely noticed, always working. | P3 | NONE | — | jsfxr export — minimal system sounds |
| 19.02 | **Game loaded / resumed** | Resume — a warm "welcome back" tone. Brief, familiar, like opening a favorite book to a bookmarked page. | P2 | NONE | — | jsfxr export — minimal system sounds |
| 19.03 | **Sync complete** | Cloud confirm — a soft "ding" of successful sync. Data safe. Brief, reassuring. | P3 | NONE | — | jsfxr export — minimal system sounds |

---

### 20. SCREEN TRANSITIONS

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 20.01 | **Transition: Hub → Dungeon** | Portal opening — a magical "VWOOM" as you step into the dungeon. Otherworldly, adventurous. | P1 | NONE | — | Synth (Web Audio) — procedural stings per transition type |
| 20.02 | **Transition: Combat → Reward** | Victory transition — a brief triumphant "sting" bridging the fight into loot. Satisfying, forward-moving. | P1 | NONE | — | Synth (Web Audio) — procedural stings per transition type |
| 20.03 | **Transition: Reward → Map** | Back to journey — footsteps + map unfurling. "Where next?" Exploratory. | P2 | NONE | — | Synth (Web Audio) — procedural stings per transition type |
| 20.04 | **Transition: Map → Combat** | Into the fray — dramatic tension rise. "Here we go." Adrenaline building. | P1 | NONE | — | Synth (Web Audio) — procedural stings per transition type |
| 20.05 | **Transition: Any → Rest** | Peaceful shift — ambient sounds fade in, tension fades out. Relief, calm washing over. | P2 | NONE | — | Synth (Web Audio) — procedural stings per transition type |
| 20.06 | **Transition: Any → Shop** | Market arrival — marketplace ambience + door chime (see 11.01). Commercial, lively. | P2 | NONE | — | Synth (Web Audio) — procedural stings per transition type |
| 20.07 | **Transition: Run End → Hub** | Return home — the dungeon fades, camp ambience rises. Safety, familiarity, reflection. | P1 | NONE | — | Synth (Web Audio) — procedural stings per transition type |
| 20.08 | **Boot/splash screen** | Game launch — the Recall Rogue signature sound. A memorable 2-3 second audio logo. This IS the game's identity. | P0 | NONE | — | Synth (Web Audio) — signature audio logo, iconic |

---

### 21. MULTIPLAYER & SOCIAL

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 21.01 | **Join coop lobby** | Party join — a welcoming "pop" + brief social chime. "A friend joined!" Warm, social. | P2 | NONE | — | jsfxr export — social UI family |
| 21.02 | **Leave coop lobby** | Party leave — a soft "swoosh" out. "Someone left." Neutral, not negative. | P2 | NONE | — | jsfxr export — social UI family |
| 21.03 | **Ready up** | Lock in — a decisive military-style "ready" click. "I'm prepared." Confident. | P2 | NONE | — | jsfxr export — social UI family |
| 21.04 | **Duel initiated** | Challenge accepted — a dramatic clash sound, like swords crossing. Competition! | P2 | NONE | — | jsfxr export — social UI family |

---

### 22. ONBOARDING & TUTORIAL

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 22.01 | **Tutorial tooltip appears** | Gentle guide — a soft "ping" + a warm, guiding musical tone. "Let me show you something." Patient, helpful. | P1 | NONE | — | Synth (Web Audio) — gentle guiding tones |
| 22.02 | **Tutorial step completed** | Progress chime — a small "ding!" of accomplishment. "Good, you got it!" Encouraging. | P1 | NONE | — | Synth (Web Audio) — gentle guiding tones |
| 22.03 | **Tutorial completed** | Graduation — a brief celebratory phrase. "You're ready!" Empowering, proud. Like 15.10 but softer. | P1 | NONE | — | Synth (Web Audio) — gentle guiding tones |
| 22.04 | **Age gate selection** | Neutral click — standard button click (16.01). Nothing special. | P2 | DONE | `button_click` | Synth (Web Audio) — already done |

---

### 23. BACKGROUND MUSIC (BGM) — Future

| # | Event | Sound Design Direction | Priority | Status | Current Cue | Source |
|---|-------|----------------------|----------|--------|-------------|--------|
| 23.01 | **Hub theme** | Cozy camp — warm acoustic guitar/lute + soft percussion. Crackling fire undertones. Peaceful, nostalgic, "home base" feeling. Loops seamlessly. | P1 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.02 | **Combat theme (normal)** | Battle tension — driving percussion + tense strings. Energetic but not frantic. Must not fatigue over many encounters. Loops seamlessly, varies in intensity. | P1 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.03 | **Combat theme (boss)** | Boss battle — epic orchestral + heavy percussion + choir. Higher intensity than normal combat. Dramatic, stakes feel massive. | P1 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.04 | **Combat theme (elite)** | Mini-boss — between normal and boss intensity. More menacing than normal, less grand than boss. | P2 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.05 | **Shop theme** | Merchant's tune — playful, quirky melody. Light woodwinds + plucked strings. "What'll it be?" Lighthearted, commercial. | P2 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.06 | **Rest site theme** | Peaceful respite — gentle ambient pads + soft piano. "Rest your weary bones." Calming, restorative. | P2 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.07 | **Map/exploration theme** | Journey ahead — adventurous, explorative melody. Not as intense as combat. "The path stretches onward." Medium energy. | P2 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.08 | **Mystery event theme** | Enigmatic — ethereal pads + music box + detuned strings. "Something strange..." Uncertain, curious, slightly unsettling. | P2 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.09 | **Surge turn music shift** | Surge overlay — during Surge turns, the combat music shifts to a powered-up version. Golden overtones, extra percussion, faster tempo. | P1 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.10 | **Boss quiz phase music** | Quiz pressure — combat music pauses, replaced by a tense, clock-ticking musical phrase. "This question matters." High stakes. | P1 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.11 | **Run victory music** | Triumph theme — the most emotional music in the game. Starts subdued (relief), builds to triumph (achievement), ends warmly (satisfaction). 15-20 seconds. | P0 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.12 | **Run defeat music** | Reflective theme — gentle, somber piano. NOT depressing. "It was a worthy attempt." Respectful, encourages trying again. 10-15 seconds. | P1 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |
| 23.13 | **Onboarding/tutorial music** | Welcome theme — bright, encouraging, simple. "You're going to love this." Inviting, warm, not overwhelming. | P2 | NONE | — | Composed/Licensed — all BGM needs professionally composed loops |

---

## Summary Statistics

| Category | Total Events | P0 | P1 | P2 | P3 | DONE | STUB | NONE |
|----------|-------------|----|----|----|----|------|------|------|
| 1. Card Play & Resolution | 21 | 7 | 10 | 4 | 0 | 11 | 1 | 9 |
| 2. Enemy Actions | 12 | 2 | 7 | 3 | 0 | 0 | 1 | 11 |
| 3. Player Health & Status | 22 | 2 | 15 | 4 | 1 | 0 | 0 | 22 |
| 4. Chain System | 8 | 1 | 5 | 2 | 0 | 0 | 0 | 8 |
| 5. Turn Flow & Surge | 13 | 2 | 6 | 4 | 1 | 3 | 0 | 10 |
| 6. Relic Triggers | 8 | 0 | 2 | 5 | 0 | 0 | 0 | 8 |
| 7. Quiz System | 9 | 2 | 2 | 3 | 2 | 2 | 0 | 7 |
| 8. Encounter Lifecycle | 7 | 4 | 3 | 0 | 0 | 0 | 0 | 7 |
| 9. Map & Navigation | 9 | 0 | 4 | 3 | 2 | 0 | 0 | 9 |
| 10. Hub Screen | 11 | 1 | 2 | 4 | 4 | 0 | 0 | 11 |
| 11. Shop Room | 11 | 1 | 4 | 4 | 2 | 0 | 0 | 11 |
| 12. Rest Site | 6 | 0 | 4 | 2 | 0 | 0 | 0 | 6 |
| 13. Rewards & Loot | 14 | 2 | 7 | 3 | 2 | 6 | 1 | 7 |
| 14. Mystery & Special Events | 7 | 0 | 4 | 3 | 0 | 0 | 0 | 7 |
| 15. Run Lifecycle | 11 | 4 | 5 | 2 | 0 | 0 | 0 | 11 |
| 16. Generic UI | 16 | 1 | 3 | 5 | 7 | 1 | 0 | 15 |
| 17. Progression & Collection | 13 | 0 | 5 | 5 | 3 | 0 | 0 | 13 |
| 18. Keeper NPC | 4 | 0 | 0 | 4 | 0 | 0 | 0 | 4 |
| 19. Save & System | 3 | 0 | 0 | 1 | 2 | 0 | 0 | 3 |
| 20. Screen Transitions | 8 | 1 | 4 | 3 | 0 | 0 | 0 | 8 |
| 21. Multiplayer & Social | 4 | 0 | 0 | 4 | 0 | 0 | 0 | 4 |
| 22. Onboarding & Tutorial | 4 | 0 | 2 | 1 | 0 | 1 | 0 | 3 |
| 23. Background Music (BGM) | 13 | 1 | 6 | 6 | 0 | 0 | 0 | 13 |
| **TOTALS** | **234** | **31** | **100** | **73** | **26** | **24** | **3** | **207** |

---

## Implementation Priority Roadmap

### Phase 1 — Ship-Blocking (P0): 31 events
Core game feel that MUST exist before any public release:
- Combat card type sounds (already DONE)
- Correct/wrong answer feedback (already DONE)
- Encounter start/victory/defeat stings
- Run start/victory/defeat music
- Surge announcement
- Chain max milestone
- Boss encounter entrance
- Game boot audio logo
- Generic button click (already DONE)
- Shop purchase
- Hub start-run button

### Phase 2 — Core Feel (P1): 100 events
Makes the game feel alive and polished:
- All status effect sounds
- Chain system sounds (link-by-link)
- Enemy action sounds
- Room transition ambience
- Screen transition stings
- Turn start/end signals
- Relic trigger feedback
- Rest/shop/mystery room ambience
- Progression milestones (level up, mastery)
- Tutorial guidance
- All BGM tracks

### Phase 3 — Polish (P2): 73 events
Elevates from "good" to "great":
- UI toggles, sliders, modals
- Keeper NPC personality sounds
- Haggle interactions
- Ambient loops (hub campfire)
- Collection screen ambience
- Deck management sounds
- Save/load feedback

### Phase 4 — Nice-to-Have (P3): 26 events
Cherry on top:
- Hover sounds (cards, buttons, map nodes)
- Scroll/swipe feedback
- Dropdown interactions
- Autosave indicator
- Barely-audible environmental details

---

## Background Music — AI Generation Prompts

BGM tracks will be created by the developer using AI music generation tools. Recommended tools: **Suno v4**, **Udio**, **AIVA** (orchestral), **Soundverse** (loop mode), **Beatoven.ai** (royalty-free commercial). Use loop mode where available. Export as .ogg or .mp3, 128-192kbps, and place in `public/assets/audio/bgm/`.

### Track List with AI Generation Prompts

---

#### 23.01 — Hub Theme ("The Camp")
**Duration:** 60-90s loop | **Priority:** P1

> **Prompt:** Create a cozy, warm medieval camp theme for a pixel art card roguelite game. Acoustic guitar fingerpicking as the lead melody, gentle hand percussion (cajon or frame drum), soft plucked lute arpeggios. Add subtle crackling fire ambience underneath. The mood is "safe haven after adventure" — nostalgic, peaceful, inviting. Think Stardew Valley meets a quiet tavern. Key of C major or G major. Tempo 85-95 BPM. Must loop seamlessly. No vocals. Warm, lo-fi production with gentle reverb. End on the same chord it begins with for perfect looping.

---

#### 23.02 — Combat Theme (Normal Encounters)
**Duration:** 45-60s loop | **Priority:** P1

> **Prompt:** Create a tense, driving combat theme for a pixel art card roguelite. Rhythmic string ostinato (fast 16th notes) as the foundation, layered with punchy war drums and taiko hits on the downbeats. Add a heroic but restrained brass melody that repeats every 8 bars — French horn or trumpet, not full orchestra. The feel is "focused determination" — urgent but controlled, like a chess match with swords. Key of D minor. Tempo 130-140 BPM. Must loop seamlessly after 45-60 seconds. No vocals. The energy level should be sustainable over 15-20 repeated encounters without listener fatigue — avoid being too bombastic. Subtle dynamic variation within the loop.

---

#### 23.03 — Combat Theme (Boss Battle)
**Duration:** 60-90s loop | **Priority:** P1

> **Prompt:** Create an epic, intense boss battle theme for a pixel art card roguelite game. Full orchestral arrangement: pounding timpani and taiko drums in relentless 4/4, aggressive low brass (trombones, tubas) playing a menacing motif, fast string tremolo creating urgency, and a soaring choir ("ah" vowels, not words) that enters at the climax. The feel is "this enemy is different — everything is at stake." Key of C minor or Bb minor. Tempo 150-160 BPM. Must loop seamlessly. Include a 4-bar buildup section that creates a sense of escalation each loop. Add a brief 2-bar "breathing room" with just strings before the drums crash back in. No vocals. Cinematic, dramatic, terrifying but empowering — the player should feel like a hero facing their greatest challenge.

---

#### 23.04 — Combat Theme (Elite Encounter)
**Duration:** 45-60s loop | **Priority:** P2

> **Prompt:** Create a menacing elite enemy combat theme for a pixel art card roguelite. Darker and more threatening than standard combat, but less grand than a boss theme. Heavy, distorted low strings playing a chromatic descending riff. Aggressive snare rolls and military-style percussion. A warning bell or gong hit every 8 bars. Sinister woodwinds (bass clarinet or contrabassoon) weaving between the string hits. The feel is "this enemy is dangerous — stay sharp." Key of F# minor. Tempo 140-145 BPM. Must loop seamlessly. No vocals. Think Dark Souls mini-boss energy but in a 16-bit aesthetic.

---

#### 23.05 — Shop Theme ("The Merchant")
**Duration:** 30-45s loop | **Priority:** P2

> **Prompt:** Create a playful, quirky merchant shop theme for a pixel art card roguelite. Plucked strings (pizzicato or mandolin) playing a bouncy, mischievous melody. Light hand claps and finger snaps as percussion. A recorder or tin whistle adding playful countermelody. Occasional coin-jingle sound effects woven into the rhythm. The mood is "a charming trickster wants your gold" — lighthearted, commercial, slightly cheeky. Key of F major or Bb major. Tempo 110-120 BPM. Must loop seamlessly. No vocals. Think of a medieval marketplace with a winking shopkeeper. Warm, inviting, makes you want to browse.

---

#### 23.06 — Rest Site Theme ("The Campfire")
**Duration:** 60-90s loop | **Priority:** P2

> **Prompt:** Create a deeply peaceful rest site theme for a pixel art card roguelite. Slow, gentle piano as the lead — simple, spacious chords with lots of sustain pedal. Soft ambient pads creating a warm bed of sound underneath. Distant wind and very subtle nature sounds (not literal — suggested through reverb and texture). An occasional solo cello playing a tender, melancholic phrase. The mood is "you survived — rest now." Key of Eb major or Ab major. Tempo 60-70 BPM. Must loop seamlessly. No vocals. This should feel like emotional relief — the tension of combat is gone, replaced by warmth and safety. Slightly bittersweet, like remembering what you're fighting for. Minimal arrangement — space and silence are part of the music.

---

#### 23.07 — Map/Exploration Theme ("The Journey")
**Duration:** 45-60s loop | **Priority:** P2

> **Prompt:** Create an adventurous exploration theme for a pixel art card roguelite dungeon map screen. Light, steady march percussion (snare rim clicks, soft kick drum). A solo flute playing a curious, wandering melody that rises and falls like a path through hills. Gentle string pad providing harmonic support. Occasional harp glissandos suggesting discovery. The mood is "the unknown awaits, and it's exciting." Key of A major or E major. Tempo 100-110 BPM. Must loop seamlessly. No vocals. Not combat-tense, not camp-relaxed — the energy is forward-moving, adventurous, optimistic with a hint of uncertainty. Think Legend of Zelda overworld but smaller scale, more intimate.

---

#### 23.08 — Mystery Event Theme ("The Enigma")
**Duration:** 30-45s loop | **Priority:** P2

> **Prompt:** Create an enigmatic, slightly unsettling mystery event theme for a pixel art card roguelite. A music box melody playing a simple but off-kilter tune — notes slightly detuned or in an unusual mode (Lydian or whole tone scale). Ethereal ambient pads with heavy reverb creating a dreamlike space. Subtle reversed cymbal swells. Very quiet, distant wind. The mood is "something strange is happening — it could be wonderful or terrible." Key of D Lydian or Bb whole tone. Tempo 75-85 BPM. Must loop seamlessly. No vocals. Think of opening a mysterious chest in a dark room — curiosity mixed with slight unease. Sparse, atmospheric, more about texture than melody.

---

#### 23.09 — Surge Turn Overlay ("Knowledge Surge")
**Duration:** 15-20s loop | **Priority:** P1

> **Prompt:** Create a powered-up, golden energy overlay theme for a card game's special ability turn. This plays ON TOP of the combat music, so it must be in a compatible key. Shimmering synthesizer arpeggios cascading upward. A pulsing, warm bass synth providing energy. Bright, metallic percussion hits (like striking gold). The mood is "unlimited power for a brief moment" — euphoric, electric, time-limited urgency. Key of A major (to layer over D minor combat). Tempo must match combat at 130-140 BPM. Duration 15-20 seconds, loops seamlessly. No vocals. Think of a power-up star from Mario but reimagined as golden arcane energy. Bright, fast, intoxicating.

---

#### 23.10 — Boss Quiz Phase ("The Trial")
**Duration:** 15-20s loop | **Priority:** P1

> **Prompt:** Create a tense, clock-ticking quiz pressure theme for a card roguelite boss encounter. The combat music has paused — this replaces it. A steady, metronomic tick (not a literal clock — more like a dampened wood block or muted string pluck) at 120 BPM. Sustained, dissonant string chords creating unbearable tension. Very quiet, breathy flute playing a single held note that slowly bends upward. The mood is "this question determines everything." Key of C minor. Must loop seamlessly at 15-20 seconds. No vocals. Minimalist — the silence between the ticks is as important as the sound. Think of defusing a bomb in a movie. The player's mind should race.

---

#### 23.11 — Run Victory ("Triumph")
**Duration:** 15-20s, one-shot (no loop) | **Priority:** P0

> **Prompt:** Create a triumphant victory fanfare for completing a dungeon run in a pixel art card roguelite. Structure: Start with a single, pure French horn note held for 2 seconds (the relief). Then a full orchestra swells in — ascending major scale in the brass, rapid string runs, crashing cymbals, thundering timpani. At the peak (8-10 seconds), a soaring trumpet melody plays the "hero theme" — 4 memorable notes that feel like destiny fulfilled. The final 5 seconds wind down to warm strings and a gentle harp arpeggio resolving to the tonic. Key of Bb major or C major. The emotion arc is: relief (2s) -> building joy (5s) -> TRIUMPH (5s) -> warm satisfaction (5s). No vocals. This is the single most emotionally powerful music in the entire game. The player just conquered the dungeon. Make them feel like a legend.

---

#### 23.12 — Run Defeat ("Reflection")
**Duration:** 12-15s, one-shot (no loop) | **Priority:** P1

> **Prompt:** Create a gentle, reflective defeat theme for dying in a pixel art card roguelite. Solo piano only. Start with a simple, descending minor phrase — 4 notes, played slowly with full sustain pedal. Pause. Then repeat the phrase one step lower, even softer. End with a single major chord that resolves the tension — a tiny glimmer of hope. The mood is NOT punishment or sadness — it's "that was a worthy attempt, and you learned something." Key of A minor resolving to C major at the end. Tempo rubato (free time), roughly 60 BPM. Duration 12-15 seconds, one-shot. No vocals. Think of a wise mentor gently saying "try again." Respectful, dignified, encouraging. The player should feel motivated to start another run, not discouraged.

---

#### 23.13 — Onboarding/Tutorial ("Welcome")
**Duration:** 45-60s loop | **Priority:** P2

> **Prompt:** Create a bright, encouraging tutorial theme for a pixel art card roguelite. Gentle marimba or xylophone playing a simple, catchy melody — think of a music box but warmer. Soft acoustic guitar strumming quarter notes. Light, bouncy percussion (shaker, soft kick). Occasional bright chime accents on important moments. The mood is "welcome to something wonderful — let me show you." Key of C major or G major. Tempo 95-105 BPM. Must loop seamlessly. No vocals. Simpler and brighter than the hub theme — this is the very first music new players hear. It should feel safe, inviting, and gently exciting. Not childish — warm and genuine. Think of the opening moments of a Miyazaki film.

---

### Sonniss GDC Sound Archive — Integration Guide

The [Sonniss GDC 2026 Bundle](https://gdc.sonniss.com/) provides **7.47GB of royalty-free WAV files** (347 files). The full archive across all years totals **200GB+** and is available at [archive.org](https://archive.org/details/SonnissGameAudioGDC).

**License:** Royalty-free, commercially usable, no attribution required. Licensed for media production (games, film, TV) only. AI/ML training use is prohibited.

#### Download & Organize

1. Download from [gdc.sonniss.com](https://gdc.sonniss.com/) (2026 bundle) or [archive.org](https://archive.org/details/SonnissGameAudioGDC) (full archive)
2. Create directory: `assets/audio/sonniss/` (git-ignored, not committed)
3. Organize into subdirectories by intended use:

```
assets/audio/sonniss/
  impacts/         — hits, thuds, punches, slams (for enemy attacks, damage)
  metal/           — clangs, swords, shields, chains (for shield, chain system)
  magic/           — whooshes, zaps, sparkles (for relics, status effects)
  ui/              — clicks, pops, notifications (for UI interactions)
  creature/        — roars, growls, hisses (for enemy enrage, boss)
  environment/     — footsteps, doors, fire, wind (for room transitions)
  coins/           — jingles, cascades, registers (for shop, gold)
  paper/           — page turns, book opens, shuffles (for cards, map)
  glass/           — shatters, clinks, chimes (for shield break, chain)
  drums/           — hits, rolls, impacts (for encounter start, boss intro)
```

#### Priority Replacements (synthesis → Sonniss foley)

These synthesized sounds should be upgraded to real samples first:

| Event | Current Synthesis | Sonniss Category | Why Replace |
|-------|------------------|-----------------|-------------|
| Enemy attack (2.02) | Noise + sine drop | `impacts/` | Organic thuds sound 10x better |
| Shield break (3.03) | Multi noise burst | `glass/` | Real glass shatter is visceral |
| Chain break (4.06) | Noise + descending pings | `metal/` | Metal snap needs texture |
| Shop purchase (11.03) | Sine pings | `coins/` | Coin cascade needs weight |
| Enemy enrage (2.08) | Sawtooth + noise | `creature/` | Bestial roar needs organic vocal |
| Footsteps/room transition (9.09) | Filtered noise | `environment/` | Real footsteps on stone/wood |
| Boss intro drum roll (8.07) | Accelerating noise | `drums/` | Real drums have resonance |
| Card deal/shuffle (1.17-1.18) | Bandpass noise | `paper/` | Real card sounds are satisfying |

#### Integration Workflow

When replacing a synthesis sound with a Sonniss sample:

1. Convert WAV to .webm or .mp3 (128kbps): `ffmpeg -i input.wav -c:a libvorbis -q:a 4 output.webm`
2. Place in `public/assets/audio/sfx/` with the SoundName as filename (e.g., `shield_break.webm`)
3. Update `audioService.ts` — change the synthesis function to load + play the audio file
4. Add file-based audio loading to AudioManager (extend `playSound` to check for file first, fall back to synthesis)

## Acceptance Criteria

- [x] All 234 events cataloged with sound design direction
- [x] Priority assigned to every event
- [x] Source recommendations for every event
- [x] 180 synthesis functions implemented in audioService.ts
- [x] 160 audio trigger calls wired across 30 files
- [x] Referenced in GAME_DESIGN.md Section 19
- [x] Memory saved to always update this catalog on new features
- [ ] BGM tracks generated via AI music tools (user task)
- [ ] Sonniss foley replacements integrated for top 8 priority sounds

---

## Verification Gate

- [x] Cross-referenced with audioService.ts SOUND_MAP (180 entries)
- [x] Cross-referenced with cardAudioManager.ts CUE_TO_SOUND (141 cues)
- [x] Typecheck: 0 errors
- [x] Build: SUCCESS
- [x] Unit tests: 2084 passed
- [x] Sound design descriptions are creative, specific, and implementable
- [x] Document linked from GAME_DESIGN.md
- [ ] Play-tested with SFX enabled (user task)
- [ ] Volume balancing pass (user task)
