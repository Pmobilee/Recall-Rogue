# Recall Rogue — Enemy Sprite Generation Guide

All sprites should be generated as PNGs with transparent backgrounds, pixel art style, front-facing idle pose.
Save sprites using the enemy's kebab-case ID as the filename (e.g., `cave_bat.png`).

Folder structure:
```
public/assets/sprites/enemies/
  shallow-depths/
    common/
    miniboss/
    elite/
    boss/
  deep-caverns/
    common/
    miniboss/
    elite/
    boss/
  the-abyss/
    common/
    miniboss/
    elite/
    boss/
  the-archive/
    common/
    miniboss/
    elite/
    boss/
```

---

## SHALLOW DEPTHS (Floors 1-6)

Limestone caves, clay basins, iron seams, root tangles, peat bogs.

### Common — `shallow-depths/common/`

**cave_bat** (REPLACEMENT — current sprite needs redesign)

Pixel art RPG enemy sprite, small brown bat with glowing red eyes, leathery wings spread wide, sharp fangs visible, cute but menacing, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**toxic_spore** (existing enemy, needs sprite)

Pixel art RPG enemy sprite, floating poisonous mushroom creature, sickly green-purple cap with toxic spore clouds emanating, small beady eyes, stubby root-like legs, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**crystal_golem** (existing enemy, has sprite — regenerate for style consistency)

Pixel art RPG enemy sprite, stocky humanoid golem encrusted with pale blue and white crystals, craggy stone body, glowing crystal eyes, heavy fists with crystal growths, slow imposing stance, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**mud_crawler**

Pixel art RPG enemy sprite, slug-like creature made of wet brown clay and mud, two eye stalks, dripping slime trail, segmented body, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**root_strangler**

Pixel art RPG enemy sprite, animated tangle of dark brown tree roots forming a humanoid shape, glowing amber eyes peering through root mass, thorny tendrils reaching outward, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**iron_beetle**

Pixel art RPG enemy sprite, large metallic beetle with shiny iron-gray carapace, orange glowing mandibles, six segmented legs, reflective shell with rivets, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**limestone_imp**

Pixel art RPG enemy sprite, small grinning demon made of pale limestone, cracked stone skin, tiny bat wings, mischievous yellow eyes, pointed ears, stubby horns, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**cave_spider**

Pixel art RPG enemy sprite, large hairy cave spider, dark gray-brown body, eight red eyes in cluster, thick segmented legs, visible fangs dripping venom, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**peat_shambler**

Pixel art RPG enemy sprite, shambling bog creature made of compressed dark brown peat and moss, dripping water, glowing green eyes, hunched posture, soggy vine-like arms, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**fungal_sprout**

Pixel art RPG enemy sprite, small cute but menacing mushroom creature, red spotted cap, angry round eyes, tiny arms and legs, releasing small green spore particles, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**blind_grub**

Pixel art RPG enemy sprite, large pale white larva grub, eyeless with ring-like mouth full of tiny teeth, segmented translucent body showing faint inner organs, stubby legs, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Mini-boss — `shallow-depths/miniboss/`

**venomfang** (existing enemy, needs sprite)

Pixel art RPG enemy sprite, large venomous spider queen, dark purple-black body, glowing green venom dripping from oversized fangs, eight menacing eyes, armored thorax with toxic green markings, larger than common enemies, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**bone_collector** (existing enemy, needs sprite)

Pixel art RPG enemy sprite, hunched skeletal creature wearing a cloak of bones, skull-like face with glowing blue eye sockets, carrying a bag of bones, bone armor pieces strapped to body, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**root_mother**

Pixel art RPG enemy sprite, massive twisted tree trunk creature with a face formed from bark, long root tentacles spreading outward, glowing amber sap dripping from eyes, crown of dead branches, larger imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**iron_matriarch**

Pixel art RPG enemy sprite, tall feminine humanoid construct made of rusted iron plates and gears, glowing orange furnace core visible in chest, heavy iron arms ending in hammer fists, steam venting from joints, imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**bog_witch**

Pixel art RPG enemy sprite, hunched swamp hag with green-gray skin, wild matted hair with moss and twigs, holding a gnarled staff with glowing orb, tattered robes dripping with swamp water, glowing yellow eyes, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**mushroom_sovereign**

Pixel art RPG enemy sprite, regal mushroom creature with enormous golden-brown cap acting as a crown, thick stem body with royal bearing, tiny mushroom minions at feet, releasing shimmering spore cloud, glowing purple eyes, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Elite — `shallow-depths/elite/`

**ore_wyrm** (existing enemy, needs sprite)

Pixel art RPG enemy sprite, serpentine dragon-like wyrm made of layered mineral ore, metallic copper-gold scales with iron-gray underbelly, burrowing claws, crystalline spines along back, glowing amber eyes, long sinuous body coiled, large imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**cave_troll**

Pixel art RPG enemy sprite, massive stone-skinned cave troll, mossy gray-green hide, enormous fists, small angry eyes under heavy brow ridge, tusks jutting from lower jaw, hunched muscular build, stalactite-like growths on shoulders, large imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Boss — `shallow-depths/boss/`

**the_excavator** (existing enemy, has sprite — regenerate for style consistency)

Pixel art RPG boss enemy sprite, massive mechanical drill construct, industrial steel body with spinning drill bit head, glowing red power core in center, heavy treaded base, pipes and gears visible, sparks flying, very large imposing boss size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**magma_core** (existing enemy, needs sprite)

Pixel art RPG boss enemy sprite, massive living sphere of molten rock and magma, cracked obsidian shell revealing bright orange-yellow magma underneath, two burning ember eyes, volcanic vents releasing smoke and embers, floating slightly above ground, very large imposing boss size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

---

## DEEP CAVERNS (Floors 7-12)

Basalt mazes, salt flats, coal veins, granite canyons, sulfur springs.

### Common — `deep-caverns/common/`

**shadow_mimic** (existing enemy, needs sprite)

Pixel art RPG enemy sprite, dark shadowy treasure chest creature, wooden chest body with sharp teeth lining the lid, long purple-black shadow tongue, glowing white eyes, chains and fake gold coins visible, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**basalt_crawler**

Pixel art RPG enemy sprite, six-legged reptilian creature made of dark basalt rock, hexagonal scale pattern like columnar basalt, molten orange cracks between plates, low to the ground, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**salt_wraith**

Pixel art RPG enemy sprite, ghostly translucent figure made of crystallized white salt, hollow eye sockets with pale blue glow, jagged salt crystal formations on shoulders and hands, tattered ethereal lower body, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**coal_imp**

Pixel art RPG enemy sprite, small black coal demon with ember-orange cracks glowing across body, sharp grin with fire inside mouth, tiny flame-tipped horns, soot particles floating around, mischievous pose, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**granite_hound**

Pixel art RPG enemy sprite, wolf-dog creature made of speckled gray granite, angular rocky body, glowing yellow eyes, stone fangs, cracks running along body with faint mineral shimmer, aggressive stance, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**sulfur_sprite**

Pixel art RPG enemy sprite, small floating elemental made of bright yellow sulfur crystals, crackling with toxic yellow-green energy, wispy toxic fumes trailing, simple angry face formed in crystal, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**magma_tick**

Pixel art RPG enemy sprite, bloated tick-like insect creature with dark red-black carapace, four stubby legs, engorged body glowing orange with stored magma, small pincers, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**deep_angler**

Pixel art RPG enemy sprite, eyeless deep cave fish-like creature standing upright, bioluminescent blue lure dangling from forehead stalk, wide mouth with needle teeth, pale gray-white skin, vestigial fins as arms, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**rock_hermit**

Pixel art RPG enemy sprite, crab-like creature using a large geode as its shell, purple crystal interior visible through cracks in shell, orange crab legs and claws poking out, beady black eyes on stalks, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**gas_phantom**

Pixel art RPG enemy sprite, swirling gaseous specter made of toxic green-yellow cave gas, skull-like face forming and dissolving in the gas cloud, wispy tendrils reaching outward, faintly transparent, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**stalactite_drake**

Pixel art RPG enemy sprite, small dragon-like creature with stalactite-shaped horns and spines, stone-gray body with mineral veins, bat-like wings with rocky membrane, hanging upside-down claws, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**ember_moth**

Pixel art RPG enemy sprite, large moth creature with glowing orange-red wings that look like burning embers, fuzzy dark body, compound eyes reflecting firelight, ember particles falling from wings, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Mini-boss — `deep-caverns/miniboss/`

**crystal_guardian** (existing enemy, needs sprite)

Pixel art RPG enemy sprite, humanoid sentinel made entirely of large quartz and amethyst crystals, crystalline body refracting light into rainbow highlights, imposing angular build, glowing white crystal core in chest, crystal sword arm, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**stone_sentinel** (existing enemy, needs sprite)

Pixel art RPG enemy sprite, massive animated stone warrior, ancient carved face with glowing blue rune eyes, heavy stone shield and stone mace, cracked and weathered gray stone body, moss growing in crevices, very slow and imposing, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**sulfur_queen**

Pixel art RPG enemy sprite, regal insectoid queen made of bright yellow sulfur crystals, crown-like crystal formation on head, six arms holding toxic orbs, segmented crystalline body, toxic yellow-green aura, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**granite_colossus**

Pixel art RPG enemy sprite, enormous stone golem made of layered granite, each layer a different shade of gray, glowing red cracks where joints meet, tiny head on massive body, boulder-like fists, towering imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**deep_lurker**

Pixel art RPG enemy sprite, large eyeless humanoid predator from deep caves, pale white translucent skin showing dark veins, elongated limbs with hooked claws, wide mouth with rows of teeth, hunched predatory stance, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**lava_salamander**

Pixel art RPG enemy sprite, large salamander creature with magma-veined skin, dark obsidian-like body with bright orange-red lava flowing through crack patterns, four sturdy legs, long tail, ember-like eyes, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Elite — `deep-caverns/elite/`

**fossil_guardian** (existing enemy, needs sprite)

Pixel art RPG enemy sprite, animated fossil skeleton of ancient creature reassembled with golden energy bindings, mix of dinosaur and dragon bones, glowing amber joints, ancient rune inscriptions on larger bones, holding fossilized bone weapon, large imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**magma_serpent**

Pixel art RPG enemy sprite, massive snake made of flowing magma with hardened obsidian scales on top, bright orange-yellow molten underbelly, fangs dripping liquid fire, hood like a cobra with magma patterns, smoke rising from body, large imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**basalt_titan**

Pixel art RPG enemy sprite, towering humanoid made of dark columnar basalt pillars, body formed from hexagonal basalt columns, glowing magma visible between columns, ancient stone face with burning eyes, heavy and powerful build, large imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Boss — `deep-caverns/boss/`

**the_archivist** (existing enemy, needs sprite)

Pixel art RPG boss enemy sprite, tall ethereal librarian entity made of glowing data streams and ancient scrolls, floating tome orbiting around it, face hidden behind featureless white mask, long flowing robes of swirling text and symbols, staff topped with all-seeing eye, very large imposing boss size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**crystal_warden** (existing enemy, needs sprite)

Pixel art RPG boss enemy sprite, massive crystal knight in full crystalline armor, enormous prismatic crystal greatsword, body made of interlocking crystal plates in blue-purple-white, glowing inner light source making whole body shimmer, crown of crystal spikes, very large imposing boss size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

---

## THE ABYSS (Floors 13-18)

Obsidian rifts, magma shelves, crystal geodes, fossil layers, quartz halls.

### Common — `the-abyss/common/`

**obsidian_shard**

Pixel art RPG enemy sprite, floating cluster of sharp black obsidian shards arranged in a vaguely humanoid shape, held together by dark purple energy, razor-sharp edges glinting, two violet energy eyes, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**magma_slime**

Pixel art RPG enemy sprite, round blob of bright orange-red molten magma, hardened black crust forming and cracking on surface, two glowing yellow dot eyes, bubbling and dripping lava, small and rotund, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**quartz_elemental**

Pixel art RPG enemy sprite, humanoid figure made of translucent rose quartz, visible internal facets and refractions, smooth crystalline body, gentle pink glow from within, floating crystal shards orbiting, serene but threatening pose, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**fossil_raptor**

Pixel art RPG enemy sprite, animated velociraptor fossil skeleton, complete bone structure with glowing green energy in eye sockets, sharp bone claws, fossil teeth bared, aggressive attack stance, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**geode_beetle**

Pixel art RPG enemy sprite, large beetle with carapace that opens to reveal sparkling purple-blue geode crystals inside, dark stone exterior, crystal-tipped mandibles, six sturdy legs, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**lava_crawler**

Pixel art RPG enemy sprite, centipede-like creature with segmented body of alternating obsidian black and magma orange segments, many glowing orange legs, steam rising from body, venomous mandibles, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**crystal_bat**

Pixel art RPG enemy sprite, bat creature with wings made of translucent crystal shards instead of membrane, body covered in small crystal formations, prismatic light reflecting off wings, ice-blue glowing eyes, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**void_mite**

Pixel art RPG enemy sprite, tiny dark purple-black parasitic creature, round body with reality-warping distortion around it, multiple small red eyes, four spindly legs, dark energy particles being absorbed into it, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**ash_wraith**

Pixel art RPG enemy sprite, ghostly figure made of gray volcanic ash, constantly crumbling and reforming, hollow burning eye sockets, tattered ash-cloud robes, reaching skeletal hands made of compacted ash, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**prismatic_jelly**

Pixel art RPG enemy sprite, translucent jellyfish-like creature floating in air, rainbow prismatic body refracting light in multiple colors, long trailing tentacles with glowing tips, simple peaceful face contrasting dangerous tentacles, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**ember_skeleton**

Pixel art RPG enemy sprite, humanoid skeleton with bones made of glowing hot ember-orange material, flames flickering from joints, holding a burning bone sword, fire burning inside ribcage, dark eye sockets with orange pinpoint eyes, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Mini-boss — `the-abyss/miniboss/`

**ember_drake** (existing enemy, needs sprite)

Pixel art RPG enemy sprite, medium-sized fire dragon with dark red-black scales, bright orange ember underbelly, small but powerful wings wreathed in flame, fire breath building in mouth, thick tail with flame tip, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**shade_stalker** (existing enemy, needs sprite)

Pixel art RPG enemy sprite, shadowy assassin creature made of living darkness, humanoid shape with elongated limbs, twin glowing white eyes, shadow tendrils trailing from body, dual shadow blade arms, phasing in and out of visibility, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**obsidian_knight**

Pixel art RPG enemy sprite, dark armored knight made entirely of volcanic obsidian glass, reflective black armor with sharp angular design, magma glowing through visor slit, obsidian greatsword, volcanic smoke trailing from joints, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**quartz_hydra**

Pixel art RPG enemy sprite, three-headed serpentine creature with each head made of different colored quartz — rose pink, smoky gray, and clear white, crystal body with faceted scales, necks intertwining, each head glowing differently, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**fossil_wyvern**

Pixel art RPG enemy sprite, flying fossil skeleton of a pterodactyl-wyvern hybrid, complete bone wing structure, glowing green necromantic energy holding bones together, sharp bone beak, tattered membrane remnants on wings, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**magma_broodmother**

Pixel art RPG enemy sprite, massive spider-like creature with a body of hardened lava rock, glowing orange-red magma visible through cracks in body, carrying egg sac of glowing magma eggs on abdomen, eight thick obsidian legs, multiple burning eyes, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Elite — `the-abyss/elite/`

**geode_king**

Pixel art RPG enemy sprite, massive humanoid whose body is a giant cracked-open geode, exterior rough gray stone, interior covered in massive amethyst and citrine crystals, crystal crown, arms of solid crystal formation, glowing core, large imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**abyssal_leviathan**

Pixel art RPG enemy sprite, enormous deep-sea serpent adapted to underground, eyeless head with massive jaws, bioluminescent blue spots along dark body, armored plates on head, tentacle-like barbels around mouth, coiled massive body, large imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**crystal_lich**

Pixel art RPG enemy sprite, undead sorcerer with crystal-encrusted skeletal body, wearing tattered purple robes over crystal bones, floating crystal phylactery glowing purple, casting spell with crystal staff, hollow eyes with purple flame, large imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Boss — `the-abyss/boss/`

**shadow_hydra** (existing enemy, needs sprite)

Pixel art RPG boss enemy sprite, massive three-headed shadow dragon, each head made of dark swirling shadow matter, purple-black body with wisps of darkness trailing, venomous green drool from each head, multiple glowing purple eyes per head, enormous coiled body, very large imposing boss size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**void_weaver** (existing enemy, needs sprite)

Pixel art RPG boss enemy sprite, massive spider-like entity made of void energy and starfield, body appears as a window into deep space with stars and nebulae visible within, eight legs of pure darkness, web strands made of void energy connecting to nothing, central eye of swirling void, very large imposing boss size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

---

## THE ARCHIVE (Floors 19-24)

Primordial mantle, iron core fringe, pressure dome, deep bioluminescence, tectonic scars.

### Common — `the-archive/common/`

**pressure_djinn**

Pixel art RPG enemy sprite, floating genie-like elemental made of compressed air and pressure waves, translucent body with visible pressure distortion lines, glowing white eyes, lower body trailing into a whirlwind spiral, crackling energy, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**core_worm**

Pixel art RPG enemy sprite, segmented worm creature with metallic iron-red body, each segment glowing with inner heat, diamond-hard teeth in circular mouth, molten core visible through translucent segments, burrowing out of ground, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**biolume_jellyfish**

Pixel art RPG enemy sprite, floating underground jellyfish creature with bioluminescent cyan-blue bell, pulsing with inner light, long trailing tentacles with electric blue tips, casting soft glow, translucent bell showing internal structures, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**tectonic_scarab**

Pixel art RPG enemy sprite, armored scarab beetle made of tectonic plate-like shell segments, dark stone body with glowing red fault lines between plates, earth energy crackling from mandibles, six heavy legs, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**mantle_fiend**

Pixel art RPG enemy sprite, demonic creature born from the earth's mantle, body of flowing magma and dark peridotite rock, twisted horns of cooled basalt, claws of obsidian, wings of thin magma membrane, burning eyes, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**iron_core_golem**

Pixel art RPG enemy sprite, small but dense golem made of pure iron with nickel streaks, extremely heavy-looking compact body, magnetic field visible as faint blue lines, simple geometric face, stubby powerful limbs, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**glyph_sentinel**

Pixel art RPG enemy sprite, floating stone tablet creature covered in glowing blue ancient runes, rectangular body with runic face, small stone hands emerging from sides, orbited by smaller rune stones, arcane energy crackling, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**archive_moth**

Pixel art RPG enemy sprite, large moth with wings that look like ancient parchment pages covered in faded text and diagrams, dusty body, compound eyes reflecting knowledge, paper-like antennae, page fragments falling from wings, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**rune_spider**

Pixel art RPG enemy sprite, spider creature with glowing magical runes etched into its dark blue carapace, webs made of golden light, eight legs each inscribed with different rune, central eye with runic iris pattern, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**void_tendril**

Pixel art RPG enemy sprite, single tentacle emerging from a small void portal, dark purple-black appendage with reality-distorting effect around it, suction cups glowing with void energy, portal base swirling with stars, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**tome_mimic**

Pixel art RPG enemy sprite, animated book creature, leather-bound cover as body with sharp teeth along pages, bookmark tongue hanging out, small legs made of rolled scrolls, chains and clasps as armor, angry glowing eyes on cover, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Mini-boss — `the-archive/miniboss/`

**primordial_wyrm**

Pixel art RPG enemy sprite, ancient serpent-dragon from the depths of time, body made of compressed geological layers visible in cross-section, each ring a different geological era, diamond teeth, primordial fire in eyes, coiled massive body, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**iron_archon**

Pixel art RPG enemy sprite, imposing angelic-demonic figure made of magnetized iron, floating with magnetic levitation effect, iron wings made of aligned iron filings, stern metallic face, holding iron scepter crackling with electromagnetic energy, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**pressure_colossus**

Pixel art RPG enemy sprite, massive humanoid made of ultra-compressed diamond-hard material, body appears to crush the space around it with visible pressure distortion, tiny head on enormous body, dense crystalline structure, cracks releasing pressurized steam, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**biolume_monarch**

Pixel art RPG enemy sprite, majestic butterfly-jellyfish hybrid with enormous bioluminescent wings, body pulsing with shifting colors from cyan to violet, trailing tentacles of light, crown-like light organ on head, ethereal and beautiful but threatening, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**tectonic_titan**

Pixel art RPG enemy sprite, enormous living earthquake, humanoid figure of shifting tectonic plates, body constantly cracking apart and reforming, magma visible in gaps between plates, seismic waves emanating from feet, stone face cracking into expression, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**glyph_warden**

Pixel art RPG enemy sprite, tall stone golem guardian covered in protective ward glyphs, entire body inscribed with golden magical writing, barrier shield of rune energy in one hand, glowing glyph hammer in other, calm stern stone face, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**archive_specter**

Pixel art RPG enemy sprite, ghostly librarian spirit with spectacles made of light, body made of swirling pages and text, floating ancient tome as weapon, chains of bound books trailing behind, scholarly robes of flowing parchment, disapproving expression, medium-large size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Elite — `the-archive/elite/`

**mantle_dragon**

Pixel art RPG enemy sprite, enormous dragon made of Earth's mantle material, body of flowing peridotite and olivine crystals, wings of thin magma sheets, diamond-hard claws and teeth, geological crystal crown, breath of superheated mantle gas, very large imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**core_harbinger**

Pixel art RPG enemy sprite, dark robed figure made of the planet's iron core material, incredibly dense and heavy-looking, gravitational distortion visible around body, face hidden in hood showing only two white dwarf-star eyes, carrying orb of compressed iron, very large imposing size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

### Boss — `the-archive/boss/`

**knowledge_golem** (existing enemy, needs sprite)

Pixel art RPG boss enemy sprite, towering construct made of stacked ancient tomes, scrolls, and tablets, body bound together by golden chains of knowledge, face formed from an open book with glowing text as features, arms made of rolled megascrolls, floating ink drops orbiting, very large imposing boss size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

**the_curator** (existing enemy, needs sprite)

Pixel art RPG boss enemy sprite, immense cosmic librarian entity, body of swirling galaxies and cosmic dust, four arms each holding different artifact of knowledge — globe, telescope, compass, tome, face of a black hole with event horizon eyes, crown of floating constellation points, robes of northern lights, very large imposing boss size, front-facing idle pose, 16-bit SNES style, detailed pixel shading, clean black outlines, pure white background (#FFFFFF), no ground shadow, no environment

---

## TOTALS

| Region | Common | Mini-boss | Elite | Boss | Total |
|--------|--------|-----------|-------|------|-------|
| Shallow Depths | 11 | 6 | 2 | 2 | 21 |
| Deep Caverns | 12 | 6 | 3 | 2 | 23 |
| The Abyss | 11 | 6 | 3 | 2 | 22 |
| The Archive | 11 | 7 | 2 | 2 | 22 |
| **TOTAL** | **45** | **25** | **10** | **8** | **88** |

Sprites that need generation: 85 (all except crystal_golem, the_excavator which already have sprites but are included above for style-consistency regeneration if desired).
