# Phase 54: Mine Atmosphere

**Status**: Not Started
**Depends On**: Phase 8 (Mine Gameplay Overhaul — MineScene, block types, MineGenerator), Phase 9 (Biome Expansion — biome definitions), Phase 33 (Biome Visual Diversity — tile sprites, biome identity)
**Estimated Complexity**: Medium — primarily data creation and MineScene integration; no new Phaser systems required; scanner interaction extends existing scanner upgrade path
**Design Decisions**: DD-029 (environmental storytelling), DD-V2-235 (biome transition zones)

---

## 1. Overview

Phase 54 fills the mine with narrative life. The current mine is mechanically complete but atmospherically empty: blocks yield resources, but the world does not whisper its history. This phase adds four content layers that make each dive feel like exploring a real lost civilization:

1. **Ambient environmental storytelling** — brief flavor text floats up from specific blocks or biome-entry moments.
2. **Quote Stones with actual content** — the existing `QuoteStone` block type gets a full content library and a modal reveal.
3. **Readable cavern texts** — empty cavern micro-structures occasionally contain wall-text blocks the player can tap to read.
4. **Scanner interaction upgrade** — the scanner becomes a visually satisfying and interactive tool with a radial pulse animation and tier-based range scaling.

A fifth item (mid-dive artifact scanning) is also implemented: with a Tier 2+ scanner, the player can scan an artifact node without mining it.

### What Exists Already

| File | Status |
|---|---|
| `src/data/types.ts` | `BlockType.QuoteStone = 18` — exists but has no associated content |
| `src/game/scenes/MineScene.ts` | Block mining interaction, scanner upgrade integration (partial) |
| `src/game/systems/MineGenerator.ts` | Micro-structure placement, rest alcove placement |
| `src/data/biomeStructures.ts` | Structural features and biome assignments |
| `src/data/relics.ts` | Relic definitions including scanner-upgrade relics (existence uncertain — verify) |
| `src/data/quotes.ts` | File exists; content unknown — audit and supplement |

### What This Phase Adds

- `src/data/ambientStories.ts` — 60+ flavor text strings organized by biome
- `src/data/quoteStones.ts` — 40+ public domain quotes with author and GAIA reaction
- `src/data/cavernTexts.ts` — 20+ readable wall-text entries organized by biome
- Scanner sonar pulse animation in `MineScene.ts` (Phaser Graphics)
- Artifact scan-without-mine interaction for Tier 2+ scanner
- MineScene ambient story trigger logic
- MineGenerator readable cavern wall block placement

---

## 2. Sub-phases

---

### 54.1 — Ambient Environmental Storytelling

**Goal**: Once per layer (not per block — not spammy), when the player enters a biome or mines a specific thematic block type, a brief 1-2 sentence flavor text floats up from the block as a fading popup. Purely atmospheric — not quiz facts.

#### 54.1.1 — `ambientStories.ts` content library

Create `src/data/ambientStories.ts`. Structure:

```typescript
export interface AmbientStory {
  id: string
  biome: string          // biome id string (e.g. 'crystal_cavern', 'lava_fields'); or 'any' for universal
  triggerBlock?: BlockType // optional: only trigger when this block type is mined
  text: string           // 1–2 sentence atmospheric text (max 120 chars total)
}

export const AMBIENT_STORIES: AmbientStory[] = [
  // Universal (any biome)
  { id: 'amb_01', biome: 'any', text: 'The silence here predates memory. Something vast once walked this ground.' },
  { id: 'amb_02', biome: 'any', text: 'The sediment layers here are a calendar of catastrophes, each one survived.' },

  // Crystal Cavern
  { id: 'amb_crystal_01', biome: 'crystal_cavern', text: 'The crystals hum at a frequency just below hearing, as if remembering something.' },
  { id: 'amb_crystal_02', biome: 'crystal_cavern', text: 'They grew here for ten thousand years. Your arrival is, to them, instantaneous.' },
  { id: 'amb_crystal_03', biome: 'crystal_cavern', triggerBlock: BlockType.MineralNode, text: 'The crystal held this mineral in trust for longer than any civilization lasted.' },

  // Lava Fields / volcanic
  { id: 'amb_lava_01', biome: 'lava_fields', text: 'The obsidian glass preserves a moment of ancient fury, frozen mid-scream.' },
  { id: 'amb_lava_02', biome: 'lava_fields', text: 'Earth made this chamber. You are a brief thought in a very long sentence.' },

  // Fossil Layer
  { id: 'amb_fossil_01', biome: 'fossil_layer', text: 'Whatever lived here trusted the ground to keep it. The ground delivered.' },
  { id: 'amb_fossil_02', biome: 'fossil_layer', triggerBlock: BlockType.FossilNode, text: 'A creature that once feared and loved now waits to be understood again.' },

  // ... (continue to 60+ total entries covering all major biomes)
  // Each biome should have a minimum of 4 entries, with 2–3 block-specific entries.
]
```

Provide at least 60 entries covering: crystal_cavern, lava_fields, fossil_layer, ice_caves, deep_earth, ancient_ruins, bioluminescent_depths, toxic_swamps, magnetic_anomaly, and 5+ universal entries.

#### 54.1.2 — Trigger logic in `MineScene.ts`

Add a `layerAmbientStoryShown: boolean` flag per layer (reset on layer descent). When a block is mined:

1. If `layerAmbientStoryShown` is already `true`, skip — only one story per layer.
2. Roll a 20% chance trigger (constant `AMBIENT_STORY_TRIGGER_CHANCE: 0.20` in `balance.ts`).
3. Filter `AMBIENT_STORIES` by current `biomeId` (includes `biome: 'any'` entries) and optionally `triggerBlock === minedBlockType`.
4. Pick a random entry from the filtered list (avoid repeating the last-shown story within the current dive via a `shownStoryIds: Set<string>` in-run tracking).
5. Show the popup (see 54.1.3). Set `layerAmbientStoryShown = true`.

Also trigger on biome-entry: when the player first enters a layer with a different biome than the previous layer, show an ambient story with no block-type filter, 100% chance.

#### 54.1.3 — Ambient story popup in `MineScene.ts`

Render a floating text popup using Phaser's text system:

```typescript
function showAmbientStory(text: string, worldX: number, worldY: number): void {
  const popup = scene.add.text(worldX, worldY, `"${text}"`, {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: '#c8d8e8',
    stroke: '#000000',
    strokeThickness: 2,
    wordWrap: { width: 180 },
    alpha: 0,
  })
  popup.setOrigin(0.5, 1)
  popup.setDepth(200)

  scene.tweens.add({
    targets: popup,
    alpha: { from: 0, to: 0.9 },
    y: worldY - 40,
    duration: 600,
    ease: 'Cubic.Out',
    onComplete: () => {
      scene.tweens.add({
        targets: popup,
        alpha: 0,
        delay: 3000,
        duration: 800,
        onComplete: () => popup.destroy(),
      })
    },
  })
}
```

**Acceptance Criteria**:
- At most one ambient story popup per layer.
- Popup appears above the mined block with a smooth fade-in/float/fade-out animation (total ~4.5 seconds).
- Biome-entry ambient story fires 100% of the time when entering a new biome layer.
- Mid-layer stories have a 20% chance to trigger on block mine.
- Stories cycle — the same story does not appear twice within a single dive.

---

### 54.2 — Quote Stones with Actual Content

**Goal**: The `QuoteStone` block type (already in `BlockType` enum as value 18) shows only a small glowing block graphic. When mined, a modal shows the quote, attributed author, and GAIA's reaction comment. Create a content library of 40+ public domain quotes.

#### 54.2.1 — `quoteStones.ts` content library

Create `src/data/quoteStones.ts`:

```typescript
export interface QuoteStoneEntry {
  id: string
  quote: string           // The quote text (max 200 chars)
  author: string          // Attribution (name, dates if helpful)
  category: 'science' | 'nature' | 'wisdom' | 'exploration'
  gaiaComment: string     // GAIA's reaction (1-2 sentences, in-character)
}

export const QUOTE_STONES: QuoteStoneEntry[] = [
  {
    id: 'qs_01',
    quote: 'The important thing is not to stop questioning. Curiosity has its own reason for existing.',
    author: 'Albert Einstein (1879–1955)',
    category: 'science',
    gaiaComment: 'Even an ancient human knew curiosity is everything. We are practically kindred spirits.',
  },
  {
    id: 'qs_02',
    quote: 'In every walk with nature, one receives far more than one seeks.',
    author: 'John Muir (1838–1914)',
    category: 'nature',
    gaiaComment: 'He walked on the surface. You dig beneath it. I think you are both right.',
  },
  {
    id: 'qs_03',
    quote: 'The universe is not required to be in perfect harmony with human ambition.',
    author: 'Carl Sagan (1934–1996)',
    category: 'science',
    gaiaComment: 'And yet here you are, finding harmony anyway. I admire the stubbornness.',
  },
  // ... (40+ total entries across all four categories)
  // Public domain sources: Bacon, Newton, Darwin, Thoreau, Curie, Faraday, Humboldt,
  // Emerson, Muir, Twain, Tesla, Galileo, Kepler, Aristotle (translated), Confucius (translated)
]
```

#### 54.2.2 — `QuoteStoneModal.svelte` component

Create `src/ui/components/QuoteStoneModal.svelte`:

```svelte
<script lang="ts">
  import { type QuoteStoneEntry } from '../../data/quoteStones'
  let { entry, onClose }: { entry: QuoteStoneEntry; onClose: () => void } = $props()
</script>

<div class="quote-stone-modal">
  <div class="modal-backdrop" onclick={onClose}></div>
  <div class="modal-content">
    <div class="category-badge">{entry.category.toUpperCase()}</div>
    <blockquote>"{entry.quote}"</blockquote>
    <cite>— {entry.author}</cite>
    <div class="gaia-reaction">
      <img src="/assets/sprites/gaia-avatar-small.png" alt="GAIA" />
      <p><strong>GAIA:</strong> "{entry.gaiaComment}"</p>
    </div>
    <button onclick={onClose}>Continue Mining</button>
  </div>
</div>
```

#### 54.2.3 — MineScene wiring

When a `QuoteStone` block is mined (hardness reaches 0), instead of yielding a mineral:

1. Look up the block's `content.factId` (used here as the QuoteStone entry ID), or pick a random `QUOTE_STONES` entry if not pre-assigned.
2. Set `quoteStoneModalEntry` store to the entry.
3. Transition `currentScreen` to `'quote_stone'`.
4. Add `'quote_stone'` to the Screen union in `gameState.ts`.
5. Mount `QuoteStoneModal` in `App.svelte` (conditional on `currentScreen === 'quote_stone'`).

MineGenerator should pre-assign a `content.factId` (used as `quoteStoneId`) to `QuoteStone` blocks from the biome-appropriate subset of `QUOTE_STONES` (science/exploration for deep biomes, nature/wisdom for surface biomes).

**Acceptance Criteria**:
- Mining a QuoteStone block opens the QuoteStoneModal.
- Modal shows the quote text, author attribution, and GAIA reaction.
- Closing the modal returns to mine without any state change (QuoteStone gives no mineral — only the quote).
- Each QuoteStone block has a pre-assigned quote; different QuoteStone blocks on the same layer can have different quotes.
- The modal is visually distinct from the quiz overlay and artifact reveal.

---

### 54.3 — Readable Cavern Texts (Wall Text Blocks)

**Goal**: Empty rest-alcove micro-structures occasionally contain a wall-text block — a non-mineable, non-lootable block that, when tapped, shows a short readable text modal. These are fragments of ancient writing, researcher journal entries, or historical records.

#### 54.3.1 — `cavernTexts.ts` content library

Create `src/data/cavernTexts.ts`:

```typescript
export interface CavernText {
  id: string
  biome: string           // biome id or 'any'
  title: string           // short title shown in modal header
  content: string         // 2–5 sentences of readable text
  textType: 'journal' | 'inscription' | 'record' | 'fragment'
}

export const CAVERN_TEXTS: CavernText[] = [
  {
    id: 'ct_journal_01',
    biome: 'any',
    title: 'Researcher\'s Journal — Entry 147',
    textType: 'journal',
    content: 'Day 147. The lower strata here contain something the surface instruments cannot explain. A resonance. I have begun to think the planet is not dead — merely dormant, and waiting. I will send this notebook up on the next extraction. If you are reading this, I did not make it back.',
  },
  {
    id: 'ct_inscription_01',
    biome: 'ancient_ruins',
    title: 'Carved Stone Inscription',
    textType: 'inscription',
    content: 'HERE THE BUILDERS RESTED. THEY CAME FROM THE NORTH WHEN THE WATERS ROSE. THEY BUILT DOWN INSTEAD OF UP. THEY WERE RIGHT TO DO SO.',
  },
  {
    id: 'ct_record_01',
    biome: 'fossil_layer',
    title: 'Geological Survey Record',
    textType: 'record',
    content: 'Survey Site 7-G. Fossil density: exceptional. Species present: Cretaceous marine fauna, approximately 66 million years. Evidence of rapid burial event — consistent with bolide impact theory. Note: three specimens show signs of healing prior to death. They survived the first wave.',
  },
  // ... (20+ total entries)
]
```

Provide at least 20 entries: 5 universal journal entries, 5 biome-specific inscriptions (ancient_ruins, crystal_cavern, fossil_layer, lava_fields, ice_caves), 5 geological/scientific records, and 5 story fragments.

#### 54.3.2 — New `WallText` block type in `src/data/types.ts`

Add to `BlockType` enum:

```typescript
WallText = 32,   // Non-mineable readable wall text block
```

#### 54.3.3 — MineGenerator: wall text placement

In `src/game/systems/MineGenerator.ts`, in the rest-alcove placement function (or `placeMicroStructures()`):

- 25% chance that any rest alcove contains a wall text block.
- Place it as a non-mineable `WallText` block at the back wall of the alcove.
- Assign a `content.factId` storing the `CavernText.id` from the biome-appropriate pool.

#### 54.3.4 — `CavernTextModal.svelte` component

Create `src/ui/components/CavernTextModal.svelte`. Similar to `QuoteStoneModal` but styled differently (aged paper texture background via CSS, serif font):

```svelte
<div class="cavern-text-modal">
  <div class="parchment">
    <div class="text-type-label">{entry.textType.toUpperCase()}</div>
    <h3>{entry.title}</h3>
    <p class="content">{entry.content}</p>
    <button onclick={onClose}>Close</button>
  </div>
</div>
```

#### 54.3.5 — `MineScene.ts` — WallText tap interaction

`WallText` blocks cannot be mined. Instead, tapping them (pointer-down) opens `CavernTextModal`. The block sprite should glow subtly (Phaser tint pulse using `scene.tweens.add`) to indicate interactability.

Add `'cavern_text'` to the Screen union in `gameState.ts`. Mount `CavernTextModal` in `App.svelte` conditionally.

**Acceptance Criteria**:
- 25% of rest alcoves contain a wall text block.
- Wall text blocks cannot be mined (tapping does not reduce hardness; the pickaxe swing animation does not play).
- Tapping a wall text block opens the CavernTextModal with the pre-assigned text.
- The wall text block glows subtly to indicate it is interactive.
- The modal shows the title, type label, and multi-sentence content.

---

### 54.4 — Scanner as Fully Interactive Upgrade

**Goal**: The scanner should have a visually clear and satisfying interaction: a sonar-style radial pulse animation that emanates from the miner every N seconds, revealing nearby nodes through the fog of war. Each scanner tier upgrade visibly expands the pulse radius.

#### 54.4.1 — Scanner pulse animation in `MineScene.ts`

When the player has a scanner relic equipped (check `activeScannerTier > 0`), register a periodic Phaser timer:

```typescript
function startScannerPulse(scene: MineScene, intervalMs: number): void {
  scene.time.addEvent({
    delay: intervalMs,
    callback: () => emitScannerPulse(scene),
    loop: true,
  })
}

function emitScannerPulse(scene: MineScene): void {
  const { worldX, worldY } = minerWorldPosition()
  const ring = scene.add.circle(worldX, worldY, 4, 0x00ffff, 0)
  ring.setStrokeStyle(1.5, 0x00ffff, 0.8)
  ring.setDepth(150)

  scene.tweens.add({
    targets: ring,
    scaleX: scannerRadiusTiles * 2,
    scaleY: scannerRadiusTiles * 2,
    alpha: 0,
    duration: 1200,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy(),
  })

  // Reveal nearby nodes through fog of war
  revealNodesInRadius(scene, worldX, worldY, scannerRadiusTiles)
}
```

Balance constants in `balance.ts`:

```typescript
SCANNER_PULSE_INTERVAL_MS: 4000,   // Pulse every 4 seconds
SCANNER_TIER_0_RADIUS: 0,          // No scanner
SCANNER_TIER_1_RADIUS: 3,          // Tier 1: 3-tile radius
SCANNER_TIER_2_RADIUS: 5,          // Tier 2: 5-tile radius
SCANNER_TIER_3_RADIUS: 8,          // Tier 3: 8-tile radius
```

`revealNodesInRadius` iterates tiles within the radius, setting `cell.visibilityLevel = 1` (silhouette) for `MineralNode`, `ArtifactNode`, and `FossilNode` block types within range. This reveals their outline through fog without fully exposing the cell.

#### 54.4.2 — Artifact scan-without-mine (Tier 2+ scanner)

When the player has scanner Tier 2+ equipped and taps an `ArtifactNode` within scanner range (but not adjacent — not a mine action), instead of mining:

1. The artifact is "scanned": its category hint, rarity tier, and fact ID are revealed in a brief popup above the block.
2. The fact's `id` is immediately added to `PlayerSave.learnedFacts` (codex entry, no backpack slot used).
3. The block transitions to a "scanned" visual state (grey, dimmed, crosshatch overlay) — it is now depleted and cannot be mined for content.
4. A `GaiaToast`: "Artifact scanned. The knowledge is yours — the physical object stays behind."

Implement in `MineScene.ts` in the pointer-down handler: check if the tapped cell is `ArtifactNode`, is in scanner range but not adjacent, and `activeScannerTier >= 2`.

**Acceptance Criteria**:
- With a scanner relic equipped, a sonar-style ring pulse emanates from the miner every 4 seconds.
- Tier 1 scanner: 3-tile radius pulse. Tier 2: 5 tiles. Tier 3: 8 tiles.
- Nodes within the pulse radius are revealed as silhouettes (visibilityLevel = 1) through fog.
- With Tier 2+ scanner, tapping an ArtifactNode within range but not adjacent opens the scan UI (no mining animation).
- Scanned artifacts add their fact to the codex but do not enter the backpack.
- Scanned artifact blocks appear depleted and cannot be mined thereafter.

---

## 3. Verification Gate

- [ ] `npm run typecheck` passes with 0 errors.
- [ ] `npm run build` completes successfully.
- [ ] Enter a new biome layer: ambient story popup appears above the miner sprite and fades after ~4 seconds.
- [ ] Mine 20 blocks on the same layer: only one ambient story popup appears.
- [ ] Mine a QuoteStone block: QuoteStoneModal opens with quote, author, and GAIA comment.
- [ ] Close QuoteStoneModal: mine state unchanged, no inventory change.
- [ ] Enter a rest alcove with a WallText block: block glows subtly.
- [ ] Tap WallText block: CavernTextModal opens with title and content text.
- [ ] Tapping WallText block does not trigger mining animation or damage the block.
- [ ] With scanner Tier 1 equipped: radial pulse ring animates every 4 seconds.
- [ ] Artifact nodes within 3 tiles show as silhouettes through fog.
- [ ] With scanner Tier 2: artifact scan-without-mine is available; fact added to codex; block appears depleted.
- [ ] Playwright screenshot confirms ambient story popup styling and QuoteStoneModal layout.

---

## 4. Files Affected

### Modified
- `src/data/types.ts` — add `BlockType.WallText = 32`
- `src/data/balance.ts` — add `AMBIENT_STORY_TRIGGER_CHANCE`, `SCANNER_PULSE_INTERVAL_MS`, scanner tier radius constants
- `src/game/scenes/MineScene.ts` — ambient story trigger logic, scanner pulse animation, WallText tap handler, artifact scan interaction
- `src/game/systems/MineGenerator.ts` — WallText block placement in rest alcoves; QuoteStone content assignment
- `src/ui/stores/gameState.ts` — add `'quote_stone'` and `'cavern_text'` to Screen union; add modal state stores
- `src/App.svelte` — mount QuoteStoneModal and CavernTextModal conditionally

### New
- `src/data/ambientStories.ts`
- `src/data/quoteStones.ts`
- `src/data/cavernTexts.ts`
- `src/ui/components/QuoteStoneModal.svelte`
- `src/ui/components/CavernTextModal.svelte`
