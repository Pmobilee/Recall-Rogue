# Phase 16: Fossil & Farming Expansion

## Overview

Phase 16 expands the fossil and farming systems from a companion-only mechanic into a deep, knowledge-gated agricultural loop. Players discover fossilized plant species underground, learn species-specific facts to unlock revival, and plant revived crops in farm slots alongside animal companions. Crops produce resources through visual growth stages (seed → sprout → mature → harvestable), and every fossil species — animal and crop alike — gates revival behind a dedicated set of 10 species-specific facts.

This phase is the payoff for the existing fossil foundation: `FossilNode` (BlockType 25), `FossilState`, `FOSSIL_SPECIES`, `FARM_PRODUCTION`, and the Farm/FossilGallery components are all live. Phase 16 layers depth onto that foundation without breaking any existing animal-companion behaviour.

**Design decisions referenced**: DD-V2-015 (fossil emotional hook), DD-V2-016 (knowledge gate farming), DD-V2-022 (crop revival → seed), DD-V2-036 (tiered production rates), DD-V2-059 (category-specific fact sets), DD-V2-087 (content pipeline by category), DD-V2-092 (teaching moments on first exposure).

---

## Prerequisites

- Phase 9 (Batch 9) complete: Farm.svelte, FossilGallery.svelte, fossils.ts, farm.ts all present.
- `BlockType.FossilNode = 25` defined in `src/data/types.ts`.
- `FossilState`, `FarmSlot`, `FarmState` interfaces exist in `src/data/types.ts`.
- `FOSSIL_SPECIES` array in `src/data/fossils.ts` has 10 animal species with `requiredFacts` (global count) gating revival.
- `FARM_PRODUCTION` in `src/data/farm.ts` maps species IDs to `{ mineralTier, amountPerHour }`.
- `src/services/saveService.ts` exports `placeFarmAnimal`, `removeFarmAnimal`, `collectFarmResources`, `expandFarm`.
- `npm run typecheck` passes on the current codebase before any Phase 16 changes.

---

## Sub-Phase 16.1: Crop Fossils

### What

Add 10 fossilized plant/crop species to the game. They are found underground via `FossilNode` blocks exactly like animal fossils. They have their own entries in `FOSSIL_SPECIES` with a `isCrop: true` flag and botanical/agricultural category tags. Each crop species produces one or two resource types on the farm with unique rates. Unlike animal companions, revived crops cannot be set as dive companions — they go straight to the farm.

### Where

- `src/data/fossils.ts` — add crop species to `FOSSIL_SPECIES`, extend `FossilSpecies` interface
- `src/data/farm.ts` — add crop entries to `FARM_PRODUCTION`
- `src/game/MineGenerator.ts` — ensure `FossilNode` drop logic can yield crop species IDs
- `src/ui/components/FossilGallery.svelte` — show crop fossils in a "Crops" tab separate from Animals
- `src/ui/components/Farm.svelte` — filter companion picker to exclude crops (they use the plant slot flow added in 16.3)

### Crop Species Catalogue

All 10 crop species below must be added to `FOSSIL_SPECIES`. The `requiredFacts` field here is the **global** learned-fact threshold used by the current generic gate (preserved for backward-compat until 16.2 replaces it with per-species fact sets). The `isCrop: true` field is new.

| ID | Name | Era | Icon | Rarity | Fragments Needed | requiredFacts (global) | Farm Tier | amountPerHour |
|---|---|---|---|---|---|---|---|---|
| `ancient_wheat` | Ancient Wheat | Neolithic | 🌾 | common | 3 | 10 | dust | 15 |
| `lotus_fossil` | Sacred Lotus | Cretaceous | 🪷 | common | 3 | 10 | dust | 12 |
| `cave_mushroom` | Primordial Mushroom | Carboniferous | 🍄 | common | 4 | 15 | dust | 18 |
| `ancient_rice` | Ancient Rice | Holocene | 🌾 | uncommon | 4 | 20 | shard | 2.5 |
| `giant_fern` | Giant Tree Fern | Carboniferous | 🌿 | uncommon | 5 | 20 | shard | 2 |
| `amber_orchid` | Amber Orchid | Jurassic | 🌸 | uncommon | 5 | 25 | shard | 3 |
| `ancient_corn` | Ancient Maize | Holocene | 🌽 | rare | 6 | 35 | crystal | 0.6 |
| `petrified_vine` | Petrified Grapevine | Miocene | 🍇 | rare | 6 | 35 | crystal | 0.5 |
| `star_moss` | Stellar Spore Moss | Silurian | 🌱 | rare | 7 | 40 | crystal | 0.4 |
| `world_tree_seed` | World Tree Seedling | Precambrian | 🌳 | legendary | 8 | 60 | crystal | 1.2 |

Production notes:
- Common crops produce **dust** at rates higher than animal dust-producers (trilobite: 8, ammonite: 10, dodo: 12). Crops start at 12–18 dust/hr because they have no companion-dive bonus to compensate.
- Uncommon crops produce **shard** at 2–3/hr, matching animal uncommon rates.
- Rare crops produce **crystal** at 0.4–0.6/hr, slightly above rare animals (archaeopteryx: 0.3, pteranodon: 0.4).
- The legendary `world_tree_seed` produces crystal at 1.2/hr, above trex (1.0/hr), justified by its extreme 8-fragment, 60-fact gate.

### How — Step by Step

**Step 1**: Extend `FossilSpecies` interface in `src/data/fossils.ts`.

Add the `isCrop` field to the interface:

```typescript
export interface FossilSpecies {
  id: string
  name: string
  icon: string
  era: string
  description: string
  fragmentsNeeded: number
  requiredFacts: number
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  companionBonus?: string
  companionEffect: CompanionEffect
  /** True for fossilized plant/crop species. Crops cannot be set as dive companions. */
  isCrop?: boolean
  /** Botanical/agricultural fact category tags for knowledge gating (used in Phase 16.2). */
  factCategories?: string[]
}
```

Animal species do not need `isCrop` set (it defaults to `undefined` which is falsy). The `companionEffect` field must still be present on crop species to avoid a type error — set it to a no-op sentinel: `{ type: 'mineral_rate', value: 0 }`. The gallery and companion-picker code will use `isCrop` to suppress the companion UI.

**Step 2**: Add 10 crop species objects to `FOSSIL_SPECIES` array in `src/data/fossils.ts`.

Append after the `archaeopteryx` entry. Full objects:

```typescript
  {
    id: 'ancient_wheat',
    name: 'Ancient Wheat',
    icon: '🌾',
    era: 'Neolithic',
    description: 'Fossilized einkorn wheat, ancestor of every bread ever baked',
    fragmentsNeeded: 3,
    requiredFacts: 10,
    rarity: 'common',
    isCrop: true,
    factCategories: ['Life Sciences', 'History'],
    companionBonus: undefined,
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'lotus_fossil',
    name: 'Sacred Lotus',
    icon: '🪷',
    era: 'Cretaceous',
    description: 'An 85-million-year-old lotus seed. Lotus seeds can stay viable for over 1,300 years.',
    fragmentsNeeded: 3,
    requiredFacts: 10,
    rarity: 'common',
    isCrop: true,
    factCategories: ['Life Sciences', 'Culture'],
    companionBonus: undefined,
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'cave_mushroom',
    name: 'Primordial Mushroom',
    icon: '🍄',
    era: 'Carboniferous',
    description: 'A 350-million-year-old fungal spore. Fungi are more closely related to animals than plants.',
    fragmentsNeeded: 4,
    requiredFacts: 15,
    rarity: 'common',
    isCrop: true,
    factCategories: ['Life Sciences', 'Natural Sciences'],
    companionBonus: undefined,
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'ancient_rice',
    name: 'Ancient Rice',
    icon: '🌾',
    era: 'Holocene',
    description: 'Rice domesticated ~9,000 years ago in the Yangtze River Delta. Half the world still eats it daily.',
    fragmentsNeeded: 4,
    requiredFacts: 20,
    rarity: 'uncommon',
    isCrop: true,
    factCategories: ['Life Sciences', 'History', 'Geography'],
    companionBonus: undefined,
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'giant_fern',
    name: 'Giant Tree Fern',
    icon: '🌿',
    era: 'Carboniferous',
    description: 'Coal itself is fossilized Carboniferous fern forest. Every coal seam is a buried ancient jungle.',
    fragmentsNeeded: 5,
    requiredFacts: 20,
    rarity: 'uncommon',
    isCrop: true,
    factCategories: ['Natural Sciences', 'Life Sciences'],
    companionBonus: undefined,
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'amber_orchid',
    name: 'Amber Orchid',
    icon: '🌸',
    era: 'Jurassic',
    description: 'Preserved in amber for 100 million years. Orchids are the most species-diverse plant family on Earth.',
    fragmentsNeeded: 5,
    requiredFacts: 25,
    rarity: 'uncommon',
    isCrop: true,
    factCategories: ['Life Sciences', 'Natural Sciences'],
    companionBonus: undefined,
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'ancient_corn',
    name: 'Ancient Maize',
    icon: '🌽',
    era: 'Holocene',
    description: 'Teosinte grass selectively bred into maize over 9,000 years — one of humanity\'s greatest agricultural achievements.',
    fragmentsNeeded: 6,
    requiredFacts: 35,
    rarity: 'rare',
    isCrop: true,
    factCategories: ['Life Sciences', 'History', 'Culture'],
    companionBonus: undefined,
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'petrified_vine',
    name: 'Petrified Grapevine',
    icon: '🍇',
    era: 'Miocene',
    description: 'A 10-million-year-old grape fossil. Wine fermentation predates writing by thousands of years.',
    fragmentsNeeded: 6,
    requiredFacts: 35,
    rarity: 'rare',
    isCrop: true,
    factCategories: ['Life Sciences', 'History', 'Culture'],
    companionBonus: undefined,
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'star_moss',
    name: 'Stellar Spore Moss',
    icon: '🌱',
    era: 'Silurian',
    description: 'Among the first land plants ever. This 430-million-year-old moss helped turn bare rock into soil.',
    fragmentsNeeded: 7,
    requiredFacts: 40,
    rarity: 'rare',
    isCrop: true,
    factCategories: ['Life Sciences', 'Natural Sciences'],
    companionBonus: undefined,
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
  {
    id: 'world_tree_seed',
    name: 'World Tree Seedling',
    icon: '🌳',
    era: 'Precambrian',
    description: 'A 600-million-year-old seed from before complex multicellular life. Origin of all terrestrial plant lineages.',
    fragmentsNeeded: 8,
    requiredFacts: 60,
    rarity: 'legendary',
    isCrop: true,
    factCategories: ['Natural Sciences', 'Life Sciences'],
    companionBonus: undefined,
    companionEffect: { type: 'mineral_rate', value: 0 },
  },
```

**Step 3**: Add crop entries to `FARM_PRODUCTION` in `src/data/farm.ts`.

```typescript
  // Crop fossils — common: high dust
  ancient_wheat:   { mineralTier: 'dust',    amountPerHour: 15 },
  lotus_fossil:    { mineralTier: 'dust',    amountPerHour: 12 },
  cave_mushroom:   { mineralTier: 'dust',    amountPerHour: 18 },
  // Crop fossils — uncommon: shards
  ancient_rice:    { mineralTier: 'shard',   amountPerHour: 2.5 },
  giant_fern:      { mineralTier: 'shard',   amountPerHour: 2 },
  amber_orchid:    { mineralTier: 'shard',   amountPerHour: 3 },
  // Crop fossils — rare: crystals
  ancient_corn:    { mineralTier: 'crystal', amountPerHour: 0.6 },
  petrified_vine:  { mineralTier: 'crystal', amountPerHour: 0.5 },
  star_moss:       { mineralTier: 'crystal', amountPerHour: 0.4 },
  // Crop fossils — legendary
  world_tree_seed: { mineralTier: 'crystal', amountPerHour: 1.2 },
```

**Step 4**: Verify `MineGenerator.ts` uses `pickFossilDrop()` from `fossils.ts` (which already samples the full `FOSSIL_SPECIES` array). Because crop species are appended to `FOSSIL_SPECIES`, they will be automatically included in drop rolls. No change required to generation logic unless crops need depth-restricted spawning (deferred to Phase 16.2 if desired).

**Step 5**: Update `FossilGallery.svelte` to split the species grid into two tabs: "Animals" and "Crops".

Add tab state:
```typescript
let activeTab = $state<'animals' | 'crops'>('animals')

const animalSpecies = $derived(FOSSIL_SPECIES.filter(s => !s.isCrop))
const cropSpecies   = $derived(FOSSIL_SPECIES.filter(s =>  s.isCrop))

const visibleSpecies = $derived(activeTab === 'animals' ? animalSpecies : cropSpecies)
```

Replace the `{#each speciesWithState}` block to iterate `visibleSpecies`. Add tab button row below the gallery header.

**Step 6**: Update `Farm.svelte` companion picker to filter out crop species.

In `availableCompanions` derived:
```typescript
const availableCompanions = $derived.by(() => {
  const placedIds = new Set(
    farm.slots.filter((s): s is FarmSlot => s !== null).map(s => s.speciesId),
  )
  return FOSSIL_SPECIES.filter(
    sp => !sp.isCrop && fossilsRecord[sp.id]?.revived && !placedIds.has(sp.id),
  )
})
```

Crop species will use the separate plant-slot UI added in Sub-Phase 16.3. The animal companion picker must never show crops.

**Step 7**: Run `npm run typecheck`. Fix any errors. Common issue: `companionBonus?: string` is already optional so `undefined` is fine, but if `companionEffect` is required on the interface and the type of `type` is a literal union, confirm `'mineral_rate'` is in `CompanionEffectType`. It is — no change needed.

### Acceptance Criteria

- [ ] `FOSSIL_SPECIES` has exactly 20 entries (10 animal + 10 crop).
- [ ] All 10 crop entries have `isCrop: true` and `factCategories` set.
- [ ] `FARM_PRODUCTION` has entries for all 10 crop IDs.
- [ ] `npm run typecheck` passes with zero errors.
- [ ] FossilGallery renders two tabs; "Animals" tab shows 10 species, "Crops" tab shows 10 species.
- [ ] Farm companion picker shows only animal species (not crops).
- [ ] `pickFossilDrop()` can return crop species (no crash, verifiable with a console test or unit assertion).

### Playwright Test

Write to `/tmp/ss-16-1.js` and run with `node /tmp/ss-16-1.js`:

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Navigate to Fossil Gallery
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  // look for fossil gallery button in dome base view
  const galleryBtn = page.locator('button', { hasText: /fossil|gallery/i }).first()
  await galleryBtn.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: '/tmp/ss-16-1-gallery-animals.png' })
  // Click Crops tab
  const cropsTab = page.locator('button', { hasText: /crops/i }).first()
  await cropsTab.click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-16-1-gallery-crops.png' })
  await browser.close()
  console.log('Screenshots saved: /tmp/ss-16-1-gallery-animals.png and /tmp/ss-16-1-gallery-crops.png')
})()
```

Visually confirm: Animals tab shows animal icons (🦐🐚🦖 etc.), Crops tab shows plant icons (🌾🪷🍄 etc.).

---

## Sub-Phase 16.2: Knowledge-Gated Fossil Availability

### What

Replace the current global `learnedFacts.length >= requiredFacts` revival gate with per-species knowledge gating. Each fossil species (both animal and crop) now has a set of 10 species-specific fact IDs that the player must have learned before revival is allowed. The player must have learned at least 10 facts **from that species' dedicated fact set** to revive it, regardless of total facts learned.

The existing fact seed files in `src/data/seed/` gain new JSON files — one per species (20 total) — each containing exactly 10 facts tagged with that species' category hierarchy and a `speciesId` field. The `FossilSpecies` interface gains `requiredSpeciesFacts: string[]` — an array of the 10 fact IDs required. Revival is gated on: `fragments complete AND requiredSpeciesFacts.every(id => learnedFacts.includes(id))`.

The Knowledge Tree (if implemented) shows per-species progress toward the 10 facts for each fossil card.

### Where

- `src/data/fossils.ts` — add `requiredSpeciesFacts: string[]` to `FossilSpecies` interface; populate for all 20 species
- `src/data/seed/fossils/` — new directory; 20 JSON files (`animal_trilobite.json` ... `crop_world_tree_seed.json`), each containing 10 `Fact` objects
- `scripts/build-facts-db.mjs` — extend to read from `src/data/seed/fossils/` subdirectory
- `src/ui/components/FossilGallery.svelte` — replace global `factsNeededToRevive()` with per-species progress logic
- `src/services/saveService.ts` — update `canRevive` logic used server-side (if any); primarily a UI-layer check in FossilGallery

### Species Fact Sets — 10 Facts Per Species

Each JSON file follows the `Fact` interface from `src/data/types.ts`. The `id` convention is `fossil_<speciesId>_<nn>` (e.g., `fossil_trilobite_01` through `fossil_trilobite_10`). Every fact must have: `statement`, `quizQuestion`, `correctAnswer`, at least 8 `distractors`, `category`, `rarity`, `difficulty`, `funScore`, `ageRating`, `explanation`, `gaiaComment`, `wowFactor`.

Animal species fact themes (10 facts each = 100 new facts):

| Species ID | Fact Theme Examples |
|---|---|
| `trilobite` | compound eyes, ~500 species, exoskeleton molting, ocean floor filter feeders, 300M year reign, mass extinction survivor, largest 72cm, smallest 1mm, body segments, walking legs vs gill branches |
| `ammonite` | buoyancy chambers, extinction same event as dinos, jet propulsion, ribbed shell function, iridescent shells due to nacre, up to 2m diameter, 350 species, diet: plankton, used as currency by some cultures, closest living relative is nautilus NOT octopus |
| `raptor` | turkey-sized not man-sized, feathers confirmed, pack hunting disputed, hollow bones for weight reduction, sickle claw for grip not slashing, bird-like brain, warm-blooded, sternum for flight muscles, birdlike sleeping position, Mongolian desert habitat |
| `mammoth` | 4m tall 6-ton, fur up to 90cm long, curved tusks for snow-scraping, last mammoths died 1650 BCE on Wrangel Island, stomach contents preserved in permafrost, coexisted with humans who hunted them, DNA 99.6% elephant, ear size vs African elephant, 12 molar replacements per lifetime, organs studied from frozen specimens |
| `megalodon` | up to 18m (not 20), tooth size 18cm, bite force 182,000 N, warm-blooded unlike modern sharks, dietary preference: whale hearts/livers, not extinct due to food shortage, distinct from Great White, jaw reconstruction from teeth only (no cartilage), nursery grounds in shallow water, deep-water cool temperatures drove extinction |
| `pteranodon` | not a dinosaur, crest function aerodynamic/display/thermoregulation, wingspan 6m, toothless beak, fish diet, walked on four limbs, weight ~25kg, sexual dimorphism in crest size, pterosaur not pterodactyl (Pterodactylus is a genus), fuzzy insulation (pycnofibres) |
| `trex` | arms functional (not vestigial), binocular vision, growth rate 2.2kg/day as teen, lifespan ~28 years, feathered at minimum as juvenile, warm-blooded endotherm, nasal turbinates for smell, lip-covered teeth (like monitor lizard, NOT exposed), pack or solitary disputed, 63 teeth but replaced constantly |
| `dodo` | drove extinct in <80 years of human arrival, Mauritius island endemic, not stupid (evolved without predators), ate fruit and seeds, nested on ground, European sailors ate them as rations, closest living relative: Nicobar pigeon, weighed ~10kg, last sighting 1681, bones first formally described 1865 |
| `sabertooth` | Smilodon not "saber-toothed tiger" (not related to tigers), 3 species (S. fatalis, S. populator, S. gracilis), scimitar cat is different genus, 28cm canines were for display/large prey killing, ambush predator, hunted mammoths and ground sloths, extinction ~10,000 BCE coincides with megafauna collapse, social (pride-like groups inferred from bone pathology), largest sabercat weighed 400kg, La Brea tar pits have >166,000 Smilodon bones |
| `archaeopteryx` | "ancient wing" in Greek, 13 known specimens all Germany, had teeth and clawed wings, tail vertebrae (not pygostyle like modern birds), still flew (feather asymmetry confirmed), transitional fossil proving dino-bird link, lived 150 MYA Jurassic, CT scans reveal inner ear = active flier, size of modern raven, brain 3x larger than same-size non-avian dinos |

Crop species fact themes (10 facts each = 100 new facts):

| Species ID | Fact Theme Examples |
|---|---|
| `ancient_wheat` | einkorn = 14 chromosome diploid, emmer wheat = tetraploid, Fertile Crescent origin 10,000 BCE, gluten evolution for dough elasticity, wheat feeds 35% of humanity's calories, threshing replaced by flails, earliest bread found in Jordan 14,400 BCE, rust fungus destroyed Roman harvests, wheat took 10,000 years to become high-yield, modern wheat has 42 chromosomes (hexaploid) |
| `lotus_fossil` | sacred in Buddhism/Hinduism/Egyptian religion, seed viability 1,300 years (oldest germinated: 1,300 yr Manchurian specimen), thermoregulation (heats flower to 30-35°C to attract beetles), roots eaten as vegetable, leaf hydrophobia (lotus effect = self-cleaning nanostructure), flowers open/close with sunlight, entire plant edible, natural dye from petals, habitat: muddy slow water, pink vs white varieties |
| `cave_mushroom` | fungi are kingdom Fungi (not plants), mycelial networks ("wood wide web"), fungi share ~50% DNA with animals, penicillin from Penicillium mold, oldest fungi fossils 2.4 BYA, bioluminescent species exist, single honey fungus in Oregon spans 965 hectares (largest organism), fungi digest food externally, spores survive space vacuum, chitin cell walls (same as insect exoskeletons) |
| `ancient_rice` | origin: Yangtze River Delta ~7,000-9,000 BCE, two main subspecies (japonica/indica), paddy flooding prevents weed competition, rice feeds more people than any other crop, grows from sea level to 3,000m altitude, 40,000+ varieties, average Asian consumes 150kg/year, US consumes 10kg/year, rice paddy methane = 10% global CH4 emissions, first cultivated simultaneously in China and India independently |
| `giant_fern` | tree ferns can grow 25m tall, coal seams are compressed Carboniferous forests, ferns predate flowers by 360 million years, reproduce via spores not seeds, frond unrolling is called "circinate vernation" (fiddlehead), 10,500 known fern species, some ferns fix nitrogen, bracken fern is most widespread land plant on Earth, Carboniferous oxygen was 35% (vs 21% now), giant insects due to high O2 |
| `amber_orchid` | 28,000 orchid species (largest plant family), pollinator mimicry (bee orchid looks like female bee), 1% of all orchid species are edible, vanilla is an orchid (Vanilla planifolia), orchid dust-like seeds have no endosperm, require mycorrhizal fungi to germinate, epiphytic orchids grow on trees not parasitically, Jurassic orchid preserved in amber, Charles Darwin wrote entire book on orchid pollination, ghost orchid has no chlorophyll |
| `ancient_corn` | teosinte ancestor had 5-12 kernels per ear, 10,000 years of selective breeding gave modern cob of 800+ kernels, DNA diverged from teosinte via mutations in ~5 genes, domesticated in Balsas River Valley Mexico, spread to entire Americas before Columbus, Three Sisters agriculture: corn/bean/squash, corn kernel colors from anthocyanin expression, world's largest crop by production volume (1.2 billion tonnes), Maya mythology: humans created from maize, popcorn variety is oldest (7,000 BCE Peruvian evidence) |
| `petrified_vine` | wine fermentation oldest: 8,000 BCE Georgia (country), grape domesticated from Vitis sylvestris ~8,000 years ago, phylloxera aphid destroyed 40% of European vines in 1860s-1890s, terroir: soil/climate expressed in flavor, 10,000+ grape varieties, oldest living grapevine in Slovenia 400+ years old, wild grapes survive to -40°C, wine appears in Egyptian hieroglyphs 3100 BCE, seeds ferment glycerol and flavonoids into tannins, grape seeds survive fossilization well |
| `star_moss` | land plants evolved from charophyte algae, first land plants ~470 MYA Ordovician, mosses have no vascular tissue (no xylem/phloem), absorb water directly through leaves, moss peat bogs store 1/3 of Earth's soil carbon, Antarctic mosses survive -20°C, sphagnum moss was used as wound dressing in WWI, moss can desiccate completely and revive, moss forests existed before dinosaurs, pollution indicator (disappears in acid rain areas) |
| `world_tree_seed` | multicellular life began ~600-800 MYA Ediacaran period, photosynthesis oxygenated Earth over 2 billion years (Great Oxidation Event), LUCA (Last Universal Common Ancestor) ~3.5-3.8 BYA, land plant colonization created soil from bare rock, plant kingdom diverged from green algae ~1.5 BYA, chloroplasts were once free-living cyanobacteria (endosymbiosis), 80% of plant species rely on mycorrhizal fungi, all land plants share a common ancestor, Earth had 6 mass extinctions each reshaping plant life, plants produce ~50% of Earth's oxygen (rest from ocean algae) |

### Schema Changes Required

**`src/data/fossils.ts`** — extend interface:

```typescript
export interface FossilSpecies {
  // ... existing fields ...
  /**
   * Array of exactly 10 fact IDs the player must have learned to revive this species.
   * Replaces the global requiredFacts threshold for revival purposes in Phase 16.2+.
   * The global requiredFacts field is retained for backward-compat display only.
   */
  requiredSpeciesFacts: string[]
}
```

Each species entry gains `requiredSpeciesFacts: ['fossil_<id>_01', ..., 'fossil_<id>_10']`.

**`src/data/seed/fossils/`** — new directory with 20 JSON files.

File naming: `animal_<speciesId>.json` and `crop_<speciesId>.json`. Each file is a JSON array of 10 `Fact` objects conforming to the `Fact` interface.

Example structure for `animal_trilobite.json`:
```json
[
  {
    "id": "fossil_trilobite_01",
    "type": "fact",
    "statement": "Trilobites had compound eyes made of calcite crystals — the only known organism to use minerals for lenses.",
    "wowFactor": "Their eyes were literally made of crystal. Seeing through rock.",
    "explanation": "Unlike modern eyes with protein lenses, trilobite lenses were calcite (CaCO3), giving them nearly perfect optics. Some species had hundreds of lenses.",
    "gaiaComment": "Mineral eyes. I feel a kinship.",
    "quizQuestion": "What unusual material were trilobite eyes made from?",
    "correctAnswer": "Calcite crystals",
    "distractors": ["Keratin protein", "Chitin shells", "Silica glass", "Aragonite mineral", "Quartz crystals", "Carbon fiber", "Bone fragments", "Amber resin"],
    "category": ["Life Sciences", "Natural Sciences"],
    "rarity": "uncommon",
    "difficulty": 2,
    "funScore": 9,
    "ageRating": "kid"
  }
  // ... 9 more facts
]
```

**`scripts/build-facts-db.mjs`** — add glob for the new subdirectory:

```js
// Existing: reads src/data/seed/*.json
// Add: also reads src/data/seed/fossils/*.json
const fossilFiles = await glob('src/data/seed/fossils/*.json', { cwd: PROJECT_ROOT })
for (const file of fossilFiles) {
  const facts = JSON.parse(await readFile(path.join(PROJECT_ROOT, file), 'utf8'))
  allFacts.push(...facts)
}
```

### Revival Gate Logic Change

**`src/ui/components/FossilGallery.svelte`** — update `canRevive()` and `factsNeededToRevive()`:

```typescript
function canRevive(speciesId: string): boolean {
  const state = fossils[speciesId]
  if (!state || state.revived) return false
  if (state.fragmentsFound < state.fragmentsNeeded) return false
  const species = getSpeciesById(speciesId)
  if (!species) return false
  // Phase 16.2: per-species fact gate
  const learned = $playerSave?.learnedFacts ?? []
  const learnedSet = new Set(learned)
  return species.requiredSpeciesFacts.every(id => learnedSet.has(id))
}

function speciesFactsProgress(speciesId: string): { learned: number; total: number } {
  const species = getSpeciesById(speciesId)
  if (!species) return { learned: 0, total: 10 }
  const learned = $playerSave?.learnedFacts ?? []
  const learnedSet = new Set(learned)
  const learnedCount = species.requiredSpeciesFacts.filter(id => learnedSet.has(id)).length
  return { learned: learnedCount, total: species.requiredSpeciesFacts.length }
}
```

Replace the "Need N more facts" lock display with:
```svelte
{@const progress = speciesFactsProgress(species.id)}
<div class="revive-locked">
  Know {progress.learned}/{progress.total} species facts
</div>
<div class="species-fact-bar">
  <div class="species-fact-fill" style="width: {(progress.learned / progress.total) * 100}%"></div>
</div>
```

The species-fact progress bar should use a green gradient distinct from the orange fragment progress bar.

### How — Step by Step

1. Extend `FossilSpecies` interface with `requiredSpeciesFacts: string[]`.
2. Add `requiredSpeciesFacts` arrays to all 20 species in `FOSSIL_SPECIES` (10 IDs each, matching the IDs that will go into the seed JSON files).
3. Create directory `src/data/seed/fossils/`.
4. Create 20 JSON files (one per species) using the fact themes listed above. Each file: valid `Fact[]` array, IDs follow `fossil_<speciesId>_01..10` convention, complete fields per `Fact` interface, 8+ distractors.
5. Extend `scripts/build-facts-db.mjs` to also ingest `src/data/seed/fossils/*.json`.
6. Run `npm run dev` (which triggers `build-facts-db.mjs`) — confirm no ingestion errors in console.
7. Update `canRevive()` and add `speciesFactsProgress()` in `FossilGallery.svelte`.
8. Add species-fact progress bar below the existing fragment progress bar in the species card markup.
9. Add CSS for `.species-fact-bar` and `.species-fact-fill` (green, distinct from orange fragment bar).
10. Run `npm run typecheck`. Fix errors. Run `npm run build`.

### Acceptance Criteria

- [ ] `requiredSpeciesFacts` field present on all 20 `FossilSpecies` objects.
- [ ] Each `requiredSpeciesFacts` array has exactly 10 IDs.
- [ ] 20 seed JSON files exist in `src/data/seed/fossils/`, each a valid `Fact[]` array of 10 items.
- [ ] `npm run dev` ingests all 200 new facts without errors (check console/terminal output of `build-facts-db.mjs`).
- [ ] Revival button is locked for a species whose 10 facts have not been learned, regardless of total facts learned.
- [ ] Species card shows dual progress bars: orange (fragments) and green (species facts N/10).
- [ ] Completing all 10 species facts AND all fragments unlocks the Revive button.
- [ ] `npm run typecheck` and `npm run build` both pass.

### Playwright Test

Write to `/tmp/ss-16-2.js`:

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
    bypassCSP: true,
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  // Inject a fossil state for trilobite with fragments complete but 0 species facts
  await page.evaluate(() => {
    const raw = localStorage.getItem('terra_player_save')
    if (!raw) return
    const save = JSON.parse(raw)
    save.fossils = save.fossils || {}
    save.fossils['trilobite'] = { speciesId: 'trilobite', fragmentsFound: 3, fragmentsNeeded: 3, revived: false }
    // Clear learned facts to ensure gate triggers
    save.learnedFacts = []
    localStorage.setItem('terra_player_save', JSON.stringify(save))
  })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  // Navigate to Fossil Gallery and screenshot locked state
  const galleryBtn = page.locator('button', { hasText: /fossil|gallery/i }).first()
  await galleryBtn.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: '/tmp/ss-16-2-locked.png' })
  console.log('Screenshot saved: /tmp/ss-16-2-locked.png')
  // Now inject all 10 trilobite species facts as learned
  await page.evaluate(() => {
    const raw = localStorage.getItem('terra_player_save')
    const save = JSON.parse(raw)
    save.learnedFacts = Array.from({ length: 10 }, (_, i) => `fossil_trilobite_0${i+1}`.replace('0', i < 9 ? '0' : ''))
    // Simpler: inject correct IDs
    save.learnedFacts = [
      'fossil_trilobite_01','fossil_trilobite_02','fossil_trilobite_03','fossil_trilobite_04',
      'fossil_trilobite_05','fossil_trilobite_06','fossil_trilobite_07','fossil_trilobite_08',
      'fossil_trilobite_09','fossil_trilobite_10',
    ]
    localStorage.setItem('terra_player_save', JSON.stringify(save))
  })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  const galleryBtn2 = page.locator('button', { hasText: /fossil|gallery/i }).first()
  await galleryBtn2.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: '/tmp/ss-16-2-unlocked.png' })
  console.log('Screenshot saved: /tmp/ss-16-2-unlocked.png')
  await browser.close()
})()
```

Visually confirm: locked screenshot shows "Know 0/10 species facts" with empty green bar and no Revive button. Unlocked screenshot shows "Revive!" button active.

---

## Sub-Phase 16.3: Farm Crop Planting

### What

Revived crop fossils can be planted in farm slots. The planting UX is distinct from the animal companion picker: a "Plant Crop" button opens a separate crop picker on empty slots. Crops do not appear in the animal companion picker. Once planted, a crop slot renders a visual growth stage based on elapsed time since planting: Seed (0-25% of mature time), Sprout (25-50%), Mature (50-75%), Harvestable (75-100% and beyond). Harvesting a crop resets it to Seed stage but keeps it planted. Each growth cycle produces one batch of resources. The crop remains in the slot permanently until manually removed (same remove-confirm flow as animals).

Growth stage timing is based on real-time hours, consistent with the existing `lastCollectedAt` accumulation system. Crops do not drift to the farm automatically — they are placed via the same `placeFarmAnimal` save-service function (the species ID from crop fossils already works because `FARM_PRODUCTION` now covers them).

The `FarmSlot` data type needs a `growthStage` display computed in real-time — it is not persisted (always recalculated from `placedAt` and `lastCollectedAt`).

### Growth Stage Timing Per Rarity

| Rarity | Full Cycle Duration | Seed (0%) | Sprout (25%) | Mature (50%) | Harvestable (75%+) |
|---|---|---|---|---|---|
| common | 4 hours | 0–1 hr | 1–2 hr | 2–3 hr | 3–4 hr |
| uncommon | 8 hours | 0–2 hr | 2–4 hr | 4–6 hr | 6–8 hr |
| rare | 24 hours | 0–6 hr | 6–12 hr | 12–18 hr | 18–24 hr |
| legendary | 48 hours | 0–12 hr | 12–24 hr | 24–36 hr | 36–48 hr (capped) |

Growth cycle resets to Seed when the player harvests (collects resources). The existing `calculateProduction` uses `lastCollectedAt` — the growth stage display should use the same timestamp to stay consistent. A "Harvestable" crop will also show pending resources via the existing collect flow.

### Visual Growth Stage Icons

Each crop species gets 4 growth stage icons (emoji-based for MVP; sprites added in Phase 17+ if capacity allows):

| Stage | Emoji | CSS class |
|---|---|---|
| Seed | 🌰 | `.stage-seed` |
| Sprout | 🌱 | `.stage-sprout` |
| Mature | 🌿 | `.stage-mature` |
| Harvestable | ✨ + species icon | `.stage-harvestable` |

The harvestable stage shows the species icon with a pulsing glow CSS animation (`box-shadow` pulse via `@keyframes crop-pulse`). This signals "collect me" visually.

### Where

- `src/data/farm.ts` — add `CROP_CYCLE_HOURS` record (species ID → cycle duration in hours); add `getCropGrowthStage()` function
- `src/data/fossils.ts` — no changes needed (isCrop flag from 16.1 sufficient)
- `src/ui/components/Farm.svelte` — dual slot types (animal companion vs crop plant); crop growth stage display; "Plant Crop" button on empty slots; harvest = collect (same `handleCollectSlot`); stage-based icon rendering
- `src/services/saveService.ts` — no schema changes needed; `placeFarmAnimal` works generically with any species ID

### How — Step by Step

**Step 1**: Add crop cycle config and growth stage computation to `src/data/farm.ts`.

```typescript
/** Full growth cycle duration in hours, keyed by crop species ID. */
export const CROP_CYCLE_HOURS: Record<string, number> = {
  ancient_wheat:   4,
  lotus_fossil:    4,
  cave_mushroom:   4,
  ancient_rice:    8,
  giant_fern:      8,
  amber_orchid:    8,
  ancient_corn:    24,
  petrified_vine:  24,
  star_moss:       24,
  world_tree_seed: 48,
}

export type CropGrowthStage = 'seed' | 'sprout' | 'mature' | 'harvestable'

/**
 * Returns the current growth stage for a crop farm slot.
 * Growth is calculated from lastCollectedAt (resets on harvest).
 * Returns null for non-crop species.
 */
export function getCropGrowthStage(slot: FarmSlot, speciesId: string): CropGrowthStage | null {
  const cycleDuration = CROP_CYCLE_HOURS[speciesId]
  if (cycleDuration === undefined) return null

  const now = Date.now()
  const hoursSinceHarvest = (now - slot.lastCollectedAt) / (1000 * 60 * 60)
  const cycleProgress = Math.min(hoursSinceHarvest / cycleDuration, 1)

  if (cycleProgress < 0.25) return 'seed'
  if (cycleProgress < 0.50) return 'sprout'
  if (cycleProgress < 0.75) return 'mature'
  return 'harvestable'
}

/**
 * Returns the growth percentage (0-100) within the current cycle.
 */
export function getCropGrowthPercent(slot: FarmSlot, speciesId: string): number {
  const cycleDuration = CROP_CYCLE_HOURS[speciesId]
  if (cycleDuration === undefined) return 0
  const now = Date.now()
  const hoursSinceHarvest = (now - slot.lastCollectedAt) / (1000 * 60 * 60)
  return Math.min((hoursSinceHarvest / cycleDuration) * 100, 100)
}
```

**Step 2**: Import new functions in `Farm.svelte`.

```typescript
import {
  calculateProduction,
  calculateHourlyRates,
  calculateTotalPending,
  getCropGrowthStage,
  getCropGrowthPercent,
  CROP_CYCLE_HOURS,
  FARM_PRODUCTION,
  FARM_EXPANSION_COSTS,
  FARM_MAX_SLOTS,
} from '../../data/farm'
```

**Step 3**: Update `availableCompanions` and add `availableCrops` derived stores.

```typescript
/** Revived ANIMAL species not yet placed on farm. */
const availableCompanions = $derived.by(() => {
  const placedIds = new Set(
    farm.slots.filter((s): s is FarmSlot => s !== null).map(s => s.speciesId),
  )
  return FOSSIL_SPECIES.filter(
    sp => !sp.isCrop && fossilsRecord[sp.id]?.revived && !placedIds.has(sp.id),
  )
})

/** Revived CROP species not yet placed on farm. */
const availableCrops = $derived.by(() => {
  const placedIds = new Set(
    farm.slots.filter((s): s is FarmSlot => s !== null).map(s => s.speciesId),
  )
  return FOSSIL_SPECIES.filter(
    sp => sp.isCrop && fossilsRecord[sp.id]?.revived && !placedIds.has(sp.id),
  )
})
```

**Step 4**: Add slot interaction state for crop picker.

```typescript
/** Index of the empty slot showing the "plant crop" picker (-1 = none). */
let plantingInSlot = $state(-1)
```

**Step 5**: Add helper functions.

```typescript
function isCropSpecies(speciesId: string): boolean {
  return FOSSIL_SPECIES.find(s => s.id === speciesId)?.isCrop === true
}

function getGrowthStageIcon(stage: string, speciesIcon: string): string {
  switch (stage) {
    case 'seed': return '🌰'
    case 'sprout': return '🌱'
    case 'mature': return '🌿'
    case 'harvestable': return speciesIcon
    default: return '🌰'
  }
}

function getGrowthStageLabel(stage: string): string {
  switch (stage) {
    case 'seed': return 'Seed'
    case 'sprout': return 'Sprout'
    case 'mature': return 'Mature'
    case 'harvestable': return 'Harvestable!'
    default: return ''
  }
}

function handlePlantOpen(slotIndex: number): void {
  audioManager.playSound('button_click')
  plantingInSlot = slotIndex
  placingInSlot = -1
  confirmRemoveIndex = -1
}

function handlePlantCrop(speciesId: string): void {
  const save = $playerSave
  if (!save) return
  audioManager.playSound('button_click')
  const { success, updatedSave } = placeFarmAnimal(save, plantingInSlot, speciesId)
  if (success) {
    playerSave.set(updatedSave)
  }
  plantingInSlot = -1
}
```

**Step 6**: Update the slot card template in Farm.svelte markup.

For occupied slots, branch on `isCropSpecies(slot.speciesId)`:

For a **crop slot** (occupied):
```svelte
{#if isCropSpecies(slot.speciesId) && species}
  {@const cropStage = getCropGrowthStage(slot, slot.speciesId)}
  {@const cropPct = getCropGrowthPercent(slot, slot.speciesId)}
  {@const stageIcon = getGrowthStageIcon(cropStage ?? 'seed', species.icon)}

  <div
    class="slot-icon"
    class:icon-harvestable={cropStage === 'harvestable'}
    aria-hidden="true"
  >{stageIcon}</div>
  <div class="slot-name">{species.name}</div>
  <div class="slot-stage-label stage-{cropStage}">{getGrowthStageLabel(cropStage ?? 'seed')}</div>

  <!-- Growth progress bar -->
  <div class="growth-bar-bg" aria-label="Crop growth progress">
    <div class="growth-bar-fill stage-{cropStage}" style="width: {cropPct}%"></div>
  </div>

  <div class="slot-rate">{getProductionRate(slot.speciesId)}</div>

  {#if pending && pending.amount > 0}
    <div class="slot-pending" aria-label="Ready to harvest">
      Ready: <span class="pending-amount">{pending.amount} {pending.tier}</span>
    </div>
    <button
      class="slot-btn collect-btn"
      type="button"
      onclick={() => handleCollectSlot(i)}
      aria-label="Harvest {pending.amount} {pending.tier} from {species.name}"
    >
      Harvest
    </button>
  {:else}
    <div class="slot-pending dim">Growing...</div>
  {/if}

  <!-- Remove confirm (same as animal) -->
  {#if isConfirmingRemove}
    <!-- ... same confirm-row as animal ... -->
  {:else}
    <button class="slot-remove-btn" type="button" onclick={() => handleRemoveRequest(i)}>
      Uproot
    </button>
  {/if}
```

For **empty slots**, add a second button for planting crops below the existing "Place Companion" button:

```svelte
<!-- Empty slot — animal or crop placement -->
{#if isPlacing}
  <!-- existing companion picker markup -->
{:else if plantingInSlot === i}
  <!-- Crop picker -->
  <div class="companion-picker" aria-label="Choose a crop to plant">
    {#if availableCrops.length === 0}
      <span class="no-companions">No revived crops available</span>
    {:else}
      {#each availableCrops as sp}
        <button
          class="companion-option"
          type="button"
          onclick={() => handlePlantCrop(sp.id)}
          aria-label="Plant {sp.name}"
        >
          <span class="companion-opt-icon">{sp.icon}</span>
          <span class="companion-opt-name">{sp.name}</span>
          <span class="companion-opt-rate">{getProductionRate(sp.id)}</span>
        </button>
      {/each}
    {/if}
    <button class="slot-btn cancel-btn" type="button" onclick={() => { plantingInSlot = -1 }}>
      Cancel
    </button>
  </div>
{:else}
  <!-- Default empty state: two buttons -->
  <button
    class="slot-btn place-btn"
    type="button"
    onclick={() => handlePlaceOpen(i)}
    disabled={availableCompanions.length === 0}
    aria-label={availableCompanions.length === 0 ? 'No companions available' : 'Place a companion'}
  >
    {availableCompanions.length === 0 ? 'No companions' : 'Place Companion'}
  </button>
  <button
    class="slot-btn plant-btn"
    type="button"
    onclick={() => handlePlantOpen(i)}
    disabled={availableCrops.length === 0}
    aria-label={availableCrops.length === 0 ? 'No crops available' : 'Plant a Crop'}
  >
    {availableCrops.length === 0 ? 'No crops' : 'Plant Crop'}
  </button>
{/if}
```

**Step 7**: Add CSS for growth stages to Farm.svelte `<style>` block.

```css
/* Growth stage bar */
.growth-bar-bg {
  width: 100%;
  height: 5px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  margin: 2px 0;
}

.growth-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s ease;
}

.growth-bar-fill.stage-seed     { background: #a0522d; }
.growth-bar-fill.stage-sprout   { background: #7ec850; }
.growth-bar-fill.stage-mature   { background: #3cb371; }
.growth-bar-fill.stage-harvestable { background: #ffd700; }

.slot-stage-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.stage-seed        { color: #a0522d; }
.stage-sprout      { color: #7ec850; }
.stage-mature      { color: #3cb371; }
.stage-harvestable { color: #ffd700; }

/* Pulsing glow on harvestable icon */
.icon-harvestable {
  animation: crop-pulse 1.4s ease-in-out infinite;
}

@keyframes crop-pulse {
  0%   { filter: drop-shadow(0 0 4px #ffd700aa); }
  50%  { filter: drop-shadow(0 0 10px #ffd700ff); }
  100% { filter: drop-shadow(0 0 4px #ffd700aa); }
}

.plant-btn {
  background: color-mix(in srgb, #3cb371 50%, var(--color-surface) 50%);
  color: var(--color-text);
}
```

**Step 8**: Run `npm run typecheck` and resolve any errors. Common edge cases:
- `getCropGrowthStage` returns `CropGrowthStage | null` — guard the `null` case in the template with `?? 'seed'`.
- The `placeFarmAnimal` in saveService may type-check against `speciesId: string` — this is already generic, no change.

**Step 9**: Run `npm run build` to confirm no build errors.

**Step 10**: Take a screenshot to verify visual state.

### Acceptance Criteria

- [ ] Farm's empty slot shows two buttons: "Place Companion" (animals) and "Plant Crop" (crops), each disabled when no available revived species of that type.
- [ ] Planting a crop fills the slot with the Seed stage icon (🌰) and a brown progress bar.
- [ ] After simulating time progression (via localStorage timestamp manipulation or fast-forwarding), stage advances: Sprout (🌱, green), Mature (🌿, darker green), Harvestable (species icon + gold pulse + gold bar).
- [ ] "Harvest" button appears when resources are ready (same condition as "Collect" for animals).
- [ ] Harvesting resets growth back to Seed stage visually (lastCollectedAt updates to now).
- [ ] Uprooting a crop removes it from the slot (same as animal Remove flow).
- [ ] Animal companion picker never shows crop species.
- [ ] Crop picker never shows animal species.
- [ ] `npm run typecheck` and `npm run build` both pass.
- [ ] No console errors during normal Farm interaction.

### Playwright Test

Write to `/tmp/ss-16-3.js`:

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
    bypassCSP: true,
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  // Inject a revived crop fossil in the player save
  await page.evaluate(() => {
    const raw = localStorage.getItem('terra_player_save')
    if (!raw) return
    const save = JSON.parse(raw)
    save.fossils = save.fossils || {}
    save.fossils['ancient_wheat'] = {
      speciesId: 'ancient_wheat',
      fragmentsFound: 3,
      fragmentsNeeded: 3,
      revived: true,
      revivedAt: Date.now()
    }
    // Ensure farm has an empty slot
    if (!save.farm) save.farm = { slots: [null, null, null], maxSlots: 3 }
    save.farm.slots[0] = null
    localStorage.setItem('terra_player_save', JSON.stringify(save))
  })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  // Navigate to Farm
  const farmBtn = page.locator('button', { hasText: /farm/i }).first()
  await farmBtn.click()
  await page.waitForTimeout(800)
  // Screenshot showing "Plant Crop" button
  await page.screenshot({ path: '/tmp/ss-16-3-farm-empty.png' })
  // Click "Plant Crop"
  const plantBtn = page.locator('button', { hasText: /plant crop/i }).first()
  await plantBtn.click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/ss-16-3-crop-picker.png' })
  // Select ancient wheat
  const wheatOpt = page.locator('button', { hasText: /ancient wheat/i }).first()
  await wheatOpt.click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/ss-16-3-crop-planted-seed.png' })
  // Fast-forward to harvestable by manipulating lastCollectedAt
  await page.evaluate(() => {
    const raw = localStorage.getItem('terra_player_save')
    const save = JSON.parse(raw)
    // Set lastCollectedAt to 5 hours ago (ancient_wheat cycle = 4hr)
    save.farm.slots[0].lastCollectedAt = Date.now() - (5 * 60 * 60 * 1000)
    localStorage.setItem('terra_player_save', JSON.stringify(save))
  })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 10000 })
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  const farmBtn2 = page.locator('button', { hasText: /farm/i }).first()
  await farmBtn2.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: '/tmp/ss-16-3-crop-harvestable.png' })
  // Harvest
  const harvestBtn = page.locator('button', { hasText: /harvest/i }).first()
  await harvestBtn.click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/ss-16-3-crop-after-harvest.png' })
  await browser.close()
  console.log('Screenshots: /tmp/ss-16-3-farm-empty.png, /tmp/ss-16-3-crop-picker.png, /tmp/ss-16-3-crop-planted-seed.png, /tmp/ss-16-3-crop-harvestable.png, /tmp/ss-16-3-crop-after-harvest.png')
})()
```

Visually confirm: seed stage shows 🌰 with brown progress bar; harvestable stage shows wheat icon (🌾) with gold pulsing glow and "Harvestable!" label; after harvest, resets to 🌰 Seed stage.

---

## Verification Gate

Run all of the following before marking Phase 16 complete:

- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` completes with no build errors
- [ ] `FOSSIL_SPECIES` has 20 entries (10 animal + 10 crop) — verify with `console.log(FOSSIL_SPECIES.length)` in browser DevTools
- [ ] FossilGallery shows "Animals" and "Crops" tabs with correct species in each
- [ ] Crop fossils spawn from `FossilNode` blocks during a mine dive (seed the save with a dive, inspect drops)
- [ ] Species-specific fact gate prevents revival when player has 0 species facts, even with 1000 global facts learned
- [ ] Species-fact progress bar (green, 0–10) updates correctly as species facts are learned
- [ ] Fragment progress bar (orange) continues working for both animal and crop species
- [ ] Farm shows "Place Companion" and "Plant Crop" as separate buttons on empty slots
- [ ] Animal companion picker shows only animal species
- [ ] Crop picker shows only crop species
- [ ] Growth stages cycle correctly: Seed → Sprout → Mature → Harvestable based on elapsed time
- [ ] Harvestable icon pulses with gold animation
- [ ] "Harvest" button label replaces "Collect" for crop slots
- [ ] Harvesting a crop resets its growth to Seed stage
- [ ] Uprooting removes crop from slot
- [ ] All 200 new facts are in the database (run `build-facts-db.mjs` and check its output count)
- [ ] No regressions: existing animal fossil revival, active companion selection, farm expansion, collect-all still work
- [ ] No `effect_update_depth_exceeded` Svelte errors in console during Farm/FossilGallery interaction

---

## Files Affected

### New Files

- `src/data/seed/fossils/animal_trilobite.json` — 10 facts
- `src/data/seed/fossils/animal_ammonite.json` — 10 facts
- `src/data/seed/fossils/animal_raptor.json` — 10 facts
- `src/data/seed/fossils/animal_mammoth.json` — 10 facts
- `src/data/seed/fossils/animal_megalodon.json` — 10 facts
- `src/data/seed/fossils/animal_pteranodon.json` — 10 facts
- `src/data/seed/fossils/animal_trex.json` — 10 facts
- `src/data/seed/fossils/animal_dodo.json` — 10 facts
- `src/data/seed/fossils/animal_sabertooth.json` — 10 facts
- `src/data/seed/fossils/animal_archaeopteryx.json` — 10 facts
- `src/data/seed/fossils/crop_ancient_wheat.json` — 10 facts
- `src/data/seed/fossils/crop_lotus_fossil.json` — 10 facts
- `src/data/seed/fossils/crop_cave_mushroom.json` — 10 facts
- `src/data/seed/fossils/crop_ancient_rice.json` — 10 facts
- `src/data/seed/fossils/crop_giant_fern.json` — 10 facts
- `src/data/seed/fossils/crop_amber_orchid.json` — 10 facts
- `src/data/seed/fossils/crop_ancient_corn.json` — 10 facts
- `src/data/seed/fossils/crop_petrified_vine.json` — 10 facts
- `src/data/seed/fossils/crop_star_moss.json` — 10 facts
- `src/data/seed/fossils/crop_world_tree_seed.json` — 10 facts

### Modified Files

- `src/data/fossils.ts` — `FossilSpecies` interface extended (`isCrop`, `factCategories`, `requiredSpeciesFacts`); 10 crop species added to `FOSSIL_SPECIES`; all 20 species have `requiredSpeciesFacts`
- `src/data/farm.ts` — `FARM_PRODUCTION` extended with 10 crop entries; `CROP_CYCLE_HOURS` constant added; `getCropGrowthStage()` and `getCropGrowthPercent()` functions added; `CropGrowthStage` type exported
- `src/ui/components/FossilGallery.svelte` — tabs (Animals/Crops); per-species fact gate logic (`canRevive`, `speciesFactsProgress`); species-fact progress bar markup + CSS
- `src/ui/components/Farm.svelte` — `availableCrops` derived store; `plantingInSlot` state; crop picker markup; `handlePlantOpen`/`handlePlantCrop` handlers; growth stage display; "Harvest" button; `.icon-harvestable` pulse animation; `.growth-bar-*` CSS; `.plant-btn` CSS
- `scripts/build-facts-db.mjs` — extended to ingest `src/data/seed/fossils/*.json`

### No Changes Required

- `src/data/types.ts` — `FossilState`, `FarmSlot`, `FarmState` interfaces are sufficient as-is
- `src/services/saveService.ts` — `placeFarmAnimal` and `removeFarmAnimal` are already species-ID-agnostic
- `src/game/MineGenerator.ts` — `pickFossilDrop()` automatically includes new species via the extended array
- `src/ui/stores/playerData.ts` — no save schema changes

---

## Implementation Order

Execute sub-phases strictly in order: 16.1 must be complete and typecheck-clean before starting 16.2, and 16.2 must have all 20 JSON seed files written and ingested before starting 16.3. This ordering prevents merge conflicts in `fossils.ts` and ensures `requiredSpeciesFacts` IDs match the IDs in the seed files from day one.

Delegate each sub-phase to a **Sonnet sub-agent** (complex multi-file changes). Provide the sub-agent with the full content of this document as context, the specific sub-phase section, and these exact verification commands:

```bash
npm run typecheck
npm run build
node /tmp/ss-16-<N>.js
```

After each sub-phase, the orchestrator runs typecheck, build, and the Playwright screenshot test before approving the next sub-phase.
