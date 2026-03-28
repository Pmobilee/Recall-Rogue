# AR-105: Enemy Bestiary Overhaul — The Scholar's Bestiary

## Status: FUTURE — Design document, not yet scheduled for implementation

## Overview

**Goal:** Completely reimagine, rename, and resprite all 88 enemies around a unified "corrupted knowledge" theme with consistent art style, deep lore, and memorable visual storytelling. Every enemy in Recall Rogue should make the player think "what IS that thing?" and feel connected to the game's core identity: a dungeon where knowledge is power and ignorance is the enemy.

**Why:** The current 88-enemy roster suffers from three critical problems:
1. **Art style chaos** — sprites range from 32px pixel art (cave_bat) to semi-realistic painterly (the_curator, void_weaver) to detailed pixel art (crystal_golem) to photorealistic (magma_slime). There is no cohesive visual identity.
2. **Generic dungeon creatures** — most enemies are standard fantasy fare (bat, spider, beetle, golem, slime, drake, wyrm) with no connection to the studying/knowledge theme. A player could encounter these in any roguelite.
3. **No story** — enemies are stat blocks with names. A "basalt_crawler" tells no story. A "gas_phantom" inspires no curiosity. Players fight them and forget them.

**The vision:** Every enemy is a creature born from, corrupted by, or guarding knowledge. The dungeon is a living library/academy that has gone wrong. Enemies are failed students, cursed scholars, animated study materials, or knowledge itself given hostile form. When players encounter them, they should feel like they're fighting the dark side of learning — procrastination manifest, writer's block made flesh, plagiarism given fangs.

**Dependencies:** ComfyUI + SDXL pixel art LoRA, AR-104 (card frame) should be done first for visual consistency
**Complexity:** Very High (88 sprites to regenerate, lore writing, potential mechanic redesign)

---

## Part 1: Visual Style Bible

### The Unified Art Style

**ALL enemy sprites must follow these rules:**

1. **Resolution:** 512×512px canvas, character fills ~360-440px of that space
2. **Pixel density:** 16-bit era pixel art (NOT photorealistic, NOT painterly)
3. **Outline:** Consistent 2px dark outline on all sprites (not 1px, not 3px, not variable)
4. **Color palette:** Each act has a limited palette (see below). Enemies within an act share palette tones.
5. **Shading:** 3-4 shade levels per color. Dithering permitted sparingly. No smooth gradients.
6. **Background:** PNG with clean white backgrounds (NOT transparent — transparent creates artifacts). Black 2px outline ensures clean cutout.
7. **Pose:** Idle stance, facing forward toward the viewer/camera, front-facing idle pose. Slight dynamism (not static T-pose, not full action)
8. **Scale consistency:** Common enemies: 60-70% of canvas. Mini-bosses: 70-80%. Elites: 75-85%. Bosses: 85-95%.
9. **Knowledge markers:** Every enemy must have at least one visible "study" element — a book, scroll, quill, ink, rune, equation, letter, graduation cap, glasses, chalkboard fragment, library card, pencil, etc. This is what ties the bestiary together.
10. **No floating elements:** No floating sparks, particles, or small detached elements around the sprite — these get cut out badly during background removal.

### Act Color Palettes

**Act 1 — The Forgotten Stacks** (abandoned library wings)
- Base tones: Dusty browns, faded yellows, aged parchment, dried ink blue-black
- Accent: Candlelight orange, tarnished gold
- Mood: Neglected, cobwebbed, musty — like a library no one has visited in decades

**Act 2 — The Burning Archives** (knowledge on fire, overdue knowledge)
- Base tones: Charcoal, ember orange, smoke gray, ash white
- Accent: Flame red, molten gold
- Mood: Desperate, heated, pressured — like cramming the night before an exam

**Act 3 — The Deep Catalogue** (forbidden knowledge, reality-warping)
- Base tones: Deep indigo, cosmic purple, void black, bioluminescent teal
- Accent: Eldritch green, starlight white
- Mood: Otherworldly, profound, intimidating — like opening a book that reads you back

### Common Visual Elements (appear on every enemy in some form)
- **Eyes that look like they're reading** — focused, intense, tracking
- **Paper/parchment texture** integrated into body or clothing
- **Ink-based effects** — ink drips, ink stains, ink trails as attack effects
- **Academic accessories** — twisted into monstrous forms

---

## Part 2: The Lore Framework

### The World Premise

The dungeon beneath the Recall Rogue academy is the **Athenaeum Profundis** — a living library that grows deeper with every forgotten fact, abandoned study session, and unfinished thesis. Knowledge that goes unlearned doesn't disappear — it sinks, ferments, and eventually *wakes up angry*.

Every enemy is a manifestation of one of these concepts:

| Enemy Origin | Description | Example |
|---|---|---|
| **Forgotten Knowledge** | Facts and lessons that were learned once and abandoned. They've gone feral. | A history date that no one remembers becomes a Calendar Beast |
| **Study Hazards** | The dangers of academic life made manifest | Procrastination, writer's block, all-nighters, cramming |
| **Corrupted Scholars** | Former students/teachers who went too deep and lost themselves | Obsessive researcher, plagiarist wraith, burned-out professor |
| **Animated Materials** | Study supplies that gained sentience from ambient knowledge energy | Textbooks with teeth, sentient highlighters, compass beasts |
| **Thesis Guardians** | Protective constructs guarding valuable knowledge | Test proctors, librarian golems, citation sentinels |
| **Exam Nightmares** | Creatures born from student anxiety and dread | The Blank Page, the Ticking Clock, the Red Pen |

---

## Part 3: The Complete Bestiary Redesign

### Act 1 — The Forgotten Stacks (20 enemies)

#### Commons (11)

| Current ID | New Name | Concept | Lore | Visual Description |
|---|---|---|---|---|
| cave_bat | **Page Flutter** | Torn pages that learned to fly | When textbook pages go unread for too long, they tear themselves free and flock together, swooping at anyone who enters the stacks. Their papery wings rustle with half-remembered formulas. | Bat-shaped cluster of yellowed pages, text visible on wings, red bookmark ribbon trailing like a tail, ink-drop eyes |
| crystal_golem | **Thesis Construct** | A half-finished thesis that hardened into stone | Abandoned dissertations sometimes crystallize into hulking constructs, their unfinished arguments forming jagged armor. They attack with the weight of unfinished work. | Humanoid golem made of stacked, hardened thesis papers and book spines, crystal formations are actually solidified ink, page fragments jutting out like armor plates |
| toxic_spore | **Mold Puff** | Library mold that feeds on neglected books | The damp corners of the Forgotten Stacks breed these spore creatures. They spread a fog that makes you forget what you were studying. | Mushroom-like creature but the cap is a deteriorating book cover, spores are floating letters/numbers, stem wrapped in soggy pages |
| mud_crawler | **Ink Slug** | Spilled ink that gained sentience | When a student's inkwell tips and the ink isn't cleaned up, it pools, thickens, and eventually starts crawling. It leaves illegible trails wherever it goes. | Slug-like creature made of dark blue-black ink, semi-translucent body shows swirling text inside, leaves ink trail, two antennae made of quill nibs |
| root_strangler | **Bookmark Vine** | Bookmarks left in books so long they took root | Forgotten bookmarks grow ribbon-tendrils deep into shelves, eventually becoming predatory vine-creatures that snare anyone reaching for a book. | Vine creature made of intertwined ribbon bookmarks in faded colors, leaves are paper scraps, thorns are pencil points, grabs with braided bookmark tendrils |
| iron_beetle | **Staple Bug** | Office supplies fused into an insect form | The stacks are full of discarded staples, clips, and pins that have been animated by ambient knowledge. They swarm and bite. | Beetle made of bent staples for legs, paper clip mandibles, binder clip shell, pushpin horns, metallic sheen, small but aggressive |
| limestone_imp | **Margin Gremlin** | The creature that writes nonsense in textbook margins | Every student has found bizarre doodles and wrong annotations in library books. These are the creatures responsible. They're small, mischievous, and armed with pencils. | Small gremlin holding an oversized pencil like a spear, body made of eraser shavings, graduation cap askew, glasses cracked, mischievous grin, sits on a defaced textbook |
| cave_spider | **Index Weaver** | Spiders that spin webs from cross-references | These creatures build elaborate webs connecting books across shelves — following the library's own index system. Getting caught means getting trapped in a maze of footnotes. | Spider with body marked like a card catalogue card, legs are thin ruler-lines, spins web from reference numbers and "see also:" text strings, web has tiny page numbers at intersections |
| peat_shambler | **Overdue Golem** | Animated pile of overdue library books | When books are overdue long enough, they stack themselves into shambling forms, driven by a desperate need to return to their shelves. They punish anyone who keeps books too long. | Shambling humanoid made of stacked library books, overdue stamps visible on covers, library card pockets for eyes, spine text partially readable, drips binding glue |
| fungal_sprout | **Pop Quiz** | A trick question that takes plant form | Pop quizzes sprout unexpectedly from the floor of the stacks. They flash confusing questions and penalize wrong answers with a burst of spores. | Small mushroom with a question mark shape, cap has "QUIZ" written on it, glowing with urgent red-yellow, small arms holding a quiz paper, ticking clock motif |
| blind_grub | **Eraser Worm** | A creature that eats written knowledge | These pale, eyeless grubs chew through book pages, consuming the text. Wherever they've been, blank pages remain. They're drawn to the most valuable information. | Pale grub/caterpillar shape, body segmented like an eraser, pink-white color, no eyes, mouth full of eraser dust, surrounded by blank pages it has "cleaned" |

#### Mini-Bosses (5)

| Current ID | New Name | Concept | Lore |
|---|---|---|---|
| venomfang | **The Plagiarist** | A creature that steals and corrupts others' work | Once a talented student who discovered it was easier to copy than create. The Plagiarist can mirror your cards' effects but twisted — dealing damage with stolen knowledge. Its body is a patchwork of other creatures' features, none quite fitting. |
| root_mother | **The Card Catalogue** | The sentient filing system of the Forgotten Stacks | The library's card catalogue grew so large it gained consciousness. Now it guards the stacks jealously, ensnaring intruders in an ever-expanding maze of cross-references and filing drawers. |
| iron_matriarch | **The Headmistress** | A stern administrator who never left her post | She sits at her desk eternally, stamping "DENIED" on everything. Her office supplies are her weapons — a ruler that extends like a blade, rubber stamps that seal you in place, a red pen that marks your very soul. |
| bog_witch | **The Tutor** | A well-meaning teacher corrupted by the stacks | She still tries to teach, but her lessons have become twisted riddles. Answer wrong and her "corrections" draw blood. She wields a pointer stick like a wand and her blackboard follows her like a shield. |
| mushroom_sovereign | **The Study Group** | Multiple students fused into one organism | A study group that stayed too late, fell asleep in the stacks, and merged together through the knowledge mold. Five faces, ten arms, each still trying to study different subjects simultaneously. |

#### Elites (2)

| Current ID | New Name | Concept | Lore |
|---|---|---|---|
| ore_wyrm | **The Bookwyrm** | A dragon made of compacted encyclopedias | The oldest books in the stacks compressed into a serpentine dragon form. It breathes clouds of loose pages and its scales are gilded book covers. Each scale contains a complete chapter. |
| cave_troll | **The Librarian** | The stacks' silent enforcer | SHHH. This massive creature enforces silence with extreme prejudice. It wears a name tag, carries an enormous "QUIET" sign as a weapon, and its "shush" attack is a devastating sonic wave. Ironically, it's the loudest thing in the dungeon. |

#### Bosses (2)

| Current ID | New Name | Concept | Lore |
|---|---|---|---|
| the_excavator | **The Final Exam** | A mechanical construct built from exam anxiety | A towering machine made of desk chairs, scantron sheets, and number 2 pencils. Its face is a giant clock counting down. Phase 1: Multiple choice attacks. Phase 2: Essay mode (heavy single hits). |
| magma_core | **The Burning Deadline** | Pure academic pressure given form | A white-hot sphere of compressed deadlines, late assignments, and academic probation notices. It grows more dangerous each turn (approaching deadline). The heat is the panic of procrastination made physical. |

---

### Act 2 — The Burning Archives (36 enemies)

#### Commons (22)

| Current ID | New Name | Concept | Lore |
|---|---|---|---|
| shadow_mimic | **The Crib Sheet** | A hidden cheat sheet that bites back | Looks like a helpful note but it's a trap. When you reach for easy answers, it snaps shut and punishes you. Trust your own knowledge. |
| bone_collector | **The Citation Needed** | A skeletal scholar demanding sources | This bony creature follows you pointing at everything and shrieking "CITATION NEEDED!" It attacks by throwing [citation needed] brackets that bind your cards. |
| basalt_crawler | **The Crambot** | A student who crammed so hard they calcified | Study without understanding creates these rigid, brittle creatures. They know everything but understand nothing, attacking with rote-memorized formulas. |
| salt_wraith | **The All-Nighter** | The ghost of a student who studied until dawn | Translucent, exhausted, running on pure caffeine-ghost energy. It attacks with waves of fatigue and its mere presence makes your cards drowsy (weakness). |
| coal_imp | **The Spark Note** | Cliff notes that caught fire from oversimplification | These small devils summarize everything so aggressively that the nuance literally burns away. They're fast, inaccurate, and leave scorch marks on real knowledge. |
| granite_hound | **The Watchdog** | An academic integrity enforcer | A canine construct that can smell plagiarism and academic dishonesty. It patrols the archives and attacks anyone whose knowledge feels "borrowed." Made of compressed honor code documents. |
| sulfur_sprite | **The Red Herring** | A misleading clue given mischievous form | These glowing sprites look like important information but lead you astray. They attack with false leads and wrong answers, confusing your card effects. |
| magma_tick | **The Anxiety Tick** | Test anxiety in parasitic form | Small, hot, and it attaches to you and grows. Each turn it feeds on your stress, getting stronger while sapping your block. The longer combat goes, the worse it gets. |
| deep_angler | **The Trick Question** | A question designed to deceive | Hangs in the dark archives with a glowing lure that looks like the right answer. When you reach for it — SNAP. Its "correct answer" is always a trap. |
| rock_hermit | **The Dropout** | A student who built walls of textbooks around themselves | Gave up on learning and now hides inside a fortress of unread textbooks. High block, low attack. Just wants to be left alone but gets aggressive when you try to make it learn. |
| gas_phantom | **The Brain Fog** | The mental haze of information overload | An amorphous cloud of scrambled text and jumbled numbers. It debuffs you with confusion, making cards harder to read. Born from studying too many subjects at once. |
| stalactite_drake | **The Thesis Dragon** | A drake that guards uncompleted theses | Hangs from the archive ceiling among dangling thesis drafts. Each draft hangs like a stalactite, and the dragon drops them as projectiles. They shatter on impact, releasing fragments of unfinished arguments. |
| ember_moth | **The Burnout** | A creature drawn to the flame of ambition until it's consumed | Was once bright with passion for learning. Now it's charred, still beautiful, but dangerous. Its wings scatter ember-sparks of wasted potential. |
| obsidian_shard | **The Writer's Block** | A jagged chunk of creative paralysis | An angular, black, impenetrable crystal that appears when you need to express yourself. It does nothing offensively at first — but it blocks YOUR card effects, reducing your output. |
| magma_slime | **The Information Overload** | Too much knowledge melted into an amorphous mass | When too many facts are crammed together without structure, they melt into this — a bubbling mass of random trivia that spills in all directions. Attacks are random and chaotic. |
| quartz_elemental | **The Rote Memory** | Pure memorization without understanding | A beautiful but hollow crystal construct. It can perfectly recite anything but understands nothing. Resistant to charge play (it doesn't process meaning). |
| fossil_raptor | **The Outdated Fact** | Knowledge that was once true but isn't anymore | Fast, aggressive, and confidently wrong. It attacks with obsolete information — medical advice from the 1800s, "facts" about flat earth, phlogiston theory. Dangerous because it SOUNDS right. |
| geode_beetle | **The Hidden Gem** | A valuable fact hiding inside a dull exterior | Tough outer shell of boring-looking information. But when cracked open (brought below 30% HP), it reveals crystalline knowledge inside and becomes vulnerable. Has execute synergy. |
| lava_crawler | **The Rushing Student** | A student moving too fast to learn properly | Moves and attacks quickly but sloppily. Burns through knowledge without retaining any of it. Leaves scorch marks — the trail of someone who skimmed every chapter. |
| crystal_bat | **The Echo Chamber** | Beliefs that bounce around reinforcing themselves | A bat made of reflective crystal that creates distorted echoes of your own cards. It doesn't generate its own attacks — it copies yours, twisted. |
| void_mite | **The Blank Spot** | The gap where a forgotten fact used to be | Tiny, nearly invisible creatures that eat specific facts from your mind. When one attaches, a random card temporarily loses its effect text. Terrifying in swarms. |
| ash_wraith | **The Burnout Phantom** | The ghost of motivation past | Was once a brilliant student burning bright. Now just ash and memory. It drains your energy (AP) because it remembers what it feels like to have none. |

#### Mini-Bosses (12)

| Current ID | New Name | Concept |
|---|---|---|
| crystal_guardian | **The Tenure Guardian** | Protects the path to deeper knowledge with bureaucratic shields |
| stone_sentinel | **The Proctor** | An exam monitor made of stone tablets, ensures no cheating |
| sulfur_queen | **The Harsh Grader** | Every answer is wrong in her eyes, applies debuffs mercilessly |
| granite_colossus | **The Textbook** | A massive walking textbook, incredibly tough but predictable |
| deep_lurker | **The Imposter Syndrome** | Lurks in shadows whispering "you don't belong here" |
| lava_salamander | **The Pressure Cooker** | Academic pressure in amphibian form, heats up each turn |
| ember_drake | **The Grade Dragon** | Hoards grades like gold, breathes fire made of failed papers |
| shade_stalker | **The Comparison Trap** | Shows you visions of students doing better than you |
| obsidian_knight | **The Perfectionist** | An armored knight who won't act until everything is perfect (high block, delayed attacks) |
| quartz_hydra | **The Hydra Problem** | For every question answered, two more appear |
| fossil_wyvern | **The Ivory Tower** | Looks down from above, immune to "common" knowledge |
| magma_broodmother | **The Helicopter Parent** | Overprotective, spawns small anxiety creatures |

#### Elites (6)

| Current ID | New Name | Concept |
|---|---|---|
| fossil_guardian | **The Peer Reviewer** | Demands rigorous evidence for every card played |
| magma_serpent | **The Deadline Serpent** | Wraps around you as the turn counter increases |
| basalt_titan | **The Standardized Test** | Massive, impersonal, one-size-fits-all damage |
| geode_king | **The Emeritus** | Ancient, powerful, full of valuable knowledge if you can survive |
| abyssal_leviathan | **The Student Debt** | Enormous, inescapable, grows every turn |
| crystal_lich | **The Publish-or-Perish** | An undead scholar who sacrificed everything for academic output |

#### Bosses (4)

| Current ID | New Name | Concept |
|---|---|---|
| the_archivist | **The Algorithm** | A digital entity that decides what knowledge you see and what's hidden |
| crystal_warden | **The Curriculum** | Rigid, structured, impossible to deviate from |
| shadow_hydra | **The Group Project** | Multiple heads, none cooperating, one does all the work |
| void_weaver | **The Rabbit Hole** | Starts as one interesting fact, spirals into infinite tangents |

---

### Act 3 — The Deep Catalogue (32 enemies)

#### Commons (11)

| Current ID | New Name | Concept |
|---|---|---|
| pressure_djinn | **The Thesis Djinn** | Grants knowledge wishes but twists them |
| core_worm | **The Gut Feeling** | Intuition without evidence, surprisingly powerful |
| biolume_jellyfish | **The Bright Idea** | Beautiful, illuminating, but stings when you grab it wrong |
| tectonic_scarab | **The Sacred Text** | Ancient knowledge beetle, worshipped by other archive creatures |
| mantle_fiend | **The Devil's Advocate** | Arguments against everything, even truth |
| iron_core_golem | **The Institution** | Massive bureaucratic construct, impervious to individual effort |
| glyph_sentinel | **The Rosetta Slab** | A stone tablet guardian with runes in all languages |
| archive_moth | **The Moth of Enlightenment** | Drawn to the brightest knowledge, its wings are ancient manuscripts |
| rune_spider | **The Hyperlink** | Connects everything to everything, gets you lost in its web |
| void_tendril | **The Unknown Unknown** | Knowledge you don't even know you're missing |
| tome_mimic | **The Fake News** | Looks like a legitimate source but consumes the unwary |

#### Mini-Bosses (7)

| Current ID | New Name | Concept |
|---|---|---|
| primordial_wyrm | **The First Question** | The oldest question ever asked, still unanswered |
| iron_archon | **The Dean** | Absolute authority, controls access to all knowledge |
| pressure_colossus | **The Dissertation** | Massive, years in the making, your greatest challenge |
| biolume_monarch | **The Eureka** | Blinding flash of insight that can illuminate or blind |
| tectonic_titan | **The Paradigm Shift** | When it moves, everything you knew changes |
| glyph_warden | **The Ancient Tongue** | Guards knowledge behind dead languages |
| archive_specter | **The Lost Thesis** | A brilliant work that was never published, haunting the archives |

#### Elites (2)

| Current ID | New Name | Concept |
|---|---|---|
| mantle_dragon | **The Dunning-Kruger** | Thinks it knows everything, dangerously confident, actually formidable |
| core_harbinger | **The Singularity** | The point where all knowledge converges, overwhelming |

#### Bosses (2)

| Current ID | New Name | Concept |
|---|---|---|
| knowledge_golem | **The Omnibus** | Every book ever written compressed into one being |
| the_curator | **The Final Lesson** | The dungeon itself personified. It was teaching you all along. |

---

## Part 4: ComfyUI Prompt Template

### Base Prompt Structure (for all enemies):

```
POSITIVE PROMPT:
pixel art RPG enemy sprite, {enemy_specific_description},
{act_color_palette},
{size_modifier based on category},
academic/scholarly visual elements, {specific_knowledge_markers},
2px dark outline, 16-bit pixel art style,
3-4 shade levels per color, no smooth gradients,
idle pose facing forward toward viewer, slight dynamic stance,
clean solid white background,
512x512 canvas, centered composition,
consistent with card game roguelite aesthetic,
dark dungeon library setting implied by creature design

NEGATIVE PROMPT:
photorealistic, painterly, smooth shading, anti-aliased,
modern, sci-fi, cute chibi, super deformed,
transparent background, alpha channel, checkered background, glow halo,
text, watermark, signature,
too detailed, over-rendered, blurry,
inconsistent outline thickness, no outline,
facing left, facing right, action pose, multiple characters
```

### Example Prompt — "Page Flutter" (Act 1 Common, replaces cave_bat):

```
POSITIVE:
pixel art RPG enemy sprite, a bat-shaped creature made of torn yellowed book pages,
text and formulas visible on papery wings, red bookmark ribbon trailing like a tail,
ink-drop eyes glowing faintly, pages slightly curled and aged,
dusty browns and faded yellows and aged parchment tones,
small creature filling 60% of canvas,
candlelight orange highlights on wing edges,
academic study theme creature, flying library pest,
2px dark outline, 16-bit pixel art style,
3-4 shade levels, idle pose facing forward with wings spread,
clean solid white background, 512x512, dark dungeon library aesthetic

NEGATIVE:
photorealistic, painterly, smooth, real bat, furry,
modern, transparent background, alpha channel, glow, shadow on ground,
text watermark, too detailed, blurry, facing left, facing right
```

---

## Part 5: Mechanic Mapping

### Which current mechanics fit the new enemies?

Many existing enemy mechanics already map perfectly to the knowledge theme:

| Mechanic | Current Enemy | New Enemy | Why It Fits |
|---|---|---|---|
| `onPlayerChargeWrong`: mirror damage | shadow_mimic | The Crib Sheet | Cheating backfires — wrong answers hurt you |
| `onPlayerNoCharge`: gain strength | fossil_guardian | The Peer Reviewer | Not engaging deeply (no charge) makes the reviewer more aggressive |
| `chargeResistant` | crystal_golem | Thesis Construct | Brute force memorization doesn't work on unfinished ideas |
| `chainVulnerable` | root_strangler | Bookmark Vine | Connected knowledge (chains) cuts through tangled references |
| `quickPlayImmune` | core_harbinger | The Singularity | You can't skim past the ultimate convergence of knowledge |
| `immuneDomain` | crystal_lich | Publish-or-Perish | Hyper-specialized, immune to outside domains |
| `chainMultiplierOverride: 1.0` | mantle_dragon | The Dunning-Kruger | Thinks chains don't matter (overconfidence kills combos) |
| Phase transitions + quiz | the_curator | The Final Lesson | The ultimate test — pauses combat to actually quiz you |

### New Mechanic Ideas (for future implementation):

| Mechanic | Enemy | Description |
|---|---|---|
| **Fact Scramble** | Brain Fog / Information Overload | Shuffles the player's hand order, making it harder to find the right card |
| **Study Drain** | All-Nighter / Burnout Phantom | Reduces max AP next turn (exhaustion) |
| **Citation Shield** | Citation Needed / Peer Reviewer | Gains block equal to number of cards played WITHOUT charge (rewards deep engagement) |
| **Misinformation** | Outdated Fact / Fake News | Swaps a card's displayed damage number (shows wrong info) |
| **Exponential Growth** | Student Debt / Hydra Problem | Damage doubles each turn (compound interest / proliferating questions) |

---

## Part 6: Implementation Plan

### Phase 1: Lore & Design (This AR)
- [ ] Finalize all 88 enemy names, concepts, and one-paragraph lore
- [ ] Create visual reference sheet (rough sketches or text descriptions)
- [ ] Map all existing mechanics to new enemies
- [ ] Identify 5-10 new mechanics that fit the knowledge theme

### Phase 2: Sprite Generation (Separate AR)
- [ ] Generate Act 1 enemies first (20 sprites) as proof of style consistency
- [ ] Review and iterate on style bible adjustments
- [ ] Generate Act 2 enemies (36 sprites)
- [ ] Generate Act 3 enemies (32 sprites)
- [ ] Generate 1x (low-res) variants for all

### Phase 3: Code Integration (Separate AR)
- [ ] Update `enemies.ts` with new names and descriptions
- [ ] Update `spriteKeys.ts` with new sprite paths
- [ ] Update `enemyAnimations.ts` — map animation archetypes to new enemies
- [ ] Implement any new mechanics
- [ ] Update all references in `ACT_ENEMY_POOLS`
- [ ] Update docs (GAME_DESIGN.md, ARCHITECTURE.md)

### Phase 4: Polish (Separate AR)
- [ ] In-game visual testing — Playwright screenshots of each enemy in combat
- [ ] Balance pass — ensure new mechanics don't break difficulty curve
- [ ] Flavor text / encounter messages for each enemy
- [ ] Bestiary/Codex UI feature (players can view enemies they've defeated with lore)

---

## Part 7: Priority Order

If we can't do all 88 at once, prioritize:

1. **Act 1 enemies (20)** — first impression, most encountered, sets the tone
2. **All bosses (8)** — most memorable encounters, need to be spectacular
3. **Act 2 commons (22)** — bulk of mid-game encounters
4. **Act 3 commons + mini-bosses (18)** — endgame variety
5. **Remaining elites and mini-bosses (20)** — complete the roster

## Files Affected
- `src/data/enemies.ts` — all 88 enemy definitions (names, stats, abilities)
- `src/data/enemyAnimations.ts` — animation archetype assignments
- `src/data/spriteKeys.ts` — auto-generated sprite key mappings
- `public/assets/sprites/enemies/` — all 88×2 sprite files (hires + lowres)
- `src/game/systems/EnemySpriteSystem.ts` — any rendering changes
- `docs/GAME_DESIGN.md` — complete bestiary section rewrite
- `docs/ARCHITECTURE.md` — enemy system section update

## Acceptance Criteria
1. All 88 enemies have names connected to knowledge/studying/academia
2. All 88 sprites share a consistent art style (same outline weight, same palette rules, same resolution)
3. Every enemy has a one-paragraph lore entry that makes players curious
4. Every enemy sprite has at least one visible "knowledge marker" (book, quill, scroll, etc.)
5. Existing combat mechanics are preserved and mapped to thematically appropriate enemies
6. Players encountering any enemy should think "this belongs in a knowledge dungeon game"
