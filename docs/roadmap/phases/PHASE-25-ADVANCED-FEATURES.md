# Phase 25: Advanced Features (Post-Launch)

**Last Updated**: 2026-03-03
**Status**: Planned (post-launch, post-Phase 24)
**Prerequisite Phases**: All previous phases (0-24) complete. Phase 25 assumes a live product with a proven player base.

---

## Overview

Phase 25 is the ambitious post-launch expansion layer. It assumes the product is live on mobile and web (Phase 20), monetized (Phase 21), and socially connected (Phase 22). These features are explicitly designed to be built AFTER the consumer product proves strong retention — they amplify a successful product rather than rescue a struggling one.

Sub-phases are largely independent and can be tackled in any order based on player demand signals from Phase 21 analytics. Priority guidance:

- **High priority** (build within 6 months of launch): 25.3 (Paintings Gallery — high virality), 25.6 (Accessibility — expands market), 25.10 (Kid Mode/Parental Controls — unlocks school and family channels)
- **Medium priority** (6-12 months post-launch): 25.1 (Combat), 25.4 (Advanced Pet), 25.8 (Educational Partnerships), 25.9 (Gacha Ethics Compliance audit)
- **Lower priority** (12+ months post-launch): 25.2 (Co-op Dives), 25.5 (Pixel Art Per Fact), 25.7 (Learning Effectiveness Report)

**Key design decisions governing this phase**:
- DD-V2-169: Teacher Dashboard — post-launch only, after D30 >= 10%
- DD-V2-174: Gacha Guardrails — drop rates displayed, no real-money-to-random, pity at 50 pulls
- DD-V2-175: Kid Content Quality — equal "wow!" density, dedicated Kid Wow Score
- DD-V2-178: Accessibility Post-Launch Set — dyslexia font, one-handed mode, reduced motion
- DD-V2-179: Learning Effectiveness Publishing — annual report with independent research partner
- DD-V2-180: Referral mechanic connection (Phase 22 cross-reference)

---

## Sub-Phase 25.1: Combat System

### What

Optional underground creatures and boss encounters that add tactical depth to dive gameplay without undermining the educational core. Combat is an opt-in challenge layer, never a gate. The pedagogical principle: learning remains the primary path to progression; combat is an exciting side dimension that occasionally tests already-learned knowledge under pressure.

**Combat design constraints**:
- Combat never hard-blocks progression — the player can always flee
- Quiz integration: landing a "critical hit" on a creature triggers a quiz; correct answer = bonus damage; wrong answer = creature counterattacks (oxygen loss)
- Binding of Isaac philosophy maintained: powerful in-run builds, no impact on SM-2 learning rate
- Combat uses tick-based movement (not real-time) to match the existing movement system

**Creature tiers**:

| Tier | Depth | Example Creatures | Mechanic |
|------|-------|-------------------|----------|
| Common | L1-7 | Crystal Slime, Dust Mite, Stone Golem | Simple: attack/flee, 1 quiz per fight |
| Rare | L8-14 | Lava Drake, Gas Wraith, Iron Automaton | 2-3 phase fight, each phase triggers different quiz types |
| Boss | L5, L10, L15, L20 | Layer Guardians | Full encounter: 5-question quiz gauntlet; correct 4/5 = defeated + legendary loot |

**Boss encounters** (one per landmark layer):
- **Layer 5 Guardian: The Ammonite King** — ancient cephalopod fossil reanimated. Quiz theme: paleontology facts. Victory reward: guaranteed fossil egg + rare relic.
- **Layer 10 Guardian: The Archivist** — an ancient data-collection automaton. Quiz theme: any facts from player's Knowledge Tree (tests real mastery). Victory reward: guaranteed epic artifact + bonus oxygen tank upgrade.
- **Layer 15 Guardian: The Echo** — a crystallized memory of Earth's last human. Quiz theme: history and civilization facts. Victory reward: legendary artifact + exclusive cosmetic "Memory Crystal" wallpaper.
- **Layer 20 Guardian: The Deep Presence** — unknowable entity. Quiz theme: 5 hardest facts from the player's personal Knowledge Tree (facts with lowest ease factor). Victory reward: unique completion event + access to "The Deep" secret biome.

### Where

- `src/game/entities/Creature.ts` — base creature class
- `src/game/entities/Boss.ts` — boss encounter state machine
- `src/game/scenes/CombatOverlay.ts` — Phaser scene overlay for combat (renders on top of MineScene)
- `src/game/managers/CombatManager.ts` — combat turn resolution, quiz integration
- `src/data/creatures.ts` — creature definitions (stats, behaviors, loot tables, quiz themes)
- `src/data/bosses.ts` — boss definitions (phases, quiz sequences, loot)
- `src/ui/components/CombatHUD.svelte` — combat status (creature HP bar, player defense, flee button)
- `src/assets/sprites/creatures/` — creature sprite files (32px)
- `src/assets/sprites-hires/creatures/` — hi-res creature sprites (256px)

### How

**Step 1: Creature encounter trigger**

In `MineScene.ts`, after mining a block, roll against `creatureEncounterChance`:
- Layers 1-7: 3% per block (common creatures only)
- Layers 8-14: 5% per block (common 70% / rare 30%)
- Layers 15-20: 7% per block (common 50% / rare 40% / boss-adjacent 10%)
- Boss layer entrance (L5, L10, L15, L20): guaranteed boss encounter at one specific pre-seeded location visible as a glowing guardian icon on the map

**Step 2: Combat turn loop**

```typescript
// src/game/managers/CombatManager.ts

interface CombatState {
  creatureId: string
  creatureHP: number
  creatureMaxHP: number
  creaturePhase: number         // For multi-phase bosses
  playerDefense: number         // From relics and companions
  turnNumber: number
  quizPending: boolean
  isFleeAttemptAllowed: boolean
}

async function processTurn(action: 'attack' | 'quiz' | 'flee' | 'item', state: CombatState): Promise<CombatState> {
  switch (action) {
    case 'attack':
      // Standard attack: 10-25 base damage modified by pickaxe tier
      // After attack: 40% chance creature counterattacks for 8 O2
      // After attack: roll for quiz trigger (30% chance)
      break
    case 'quiz':
      // Quiz overlay opens (oxygen paused during quiz — mandatory per DD-V2 learning rules)
      // Correct: bonus 50% damage to next attack
      // Wrong: creature counterattacks immediately for 12 O2
      break
    case 'flee':
      // 70% flee success rate; failure = creature attacks for 15 O2
      // Flee always succeeds if player health is below 20 O2 (anti-frustration)
      break
    case 'item':
      // Use combat item (Shield Charge, etc.) from inventory
      break
  }
  return state
}
```

**Step 3: Creature sprite generation**

Generate creatures via ComfyUI using the pixel art pipeline from SPRITE_PIPELINE.md:
- "single pixel art [creature name], underground creature, glowing eyes, dark color palette, 8-bit style, centered, white background, single object"
- 1024×1024 via ComfyUI → rembg transparency removal → downscale to 256px and 32px
- Each creature needs: idle (2 frames), attack (2 frames), death (1 frame)
- Use Phaser 3's `anims.create` for the 2-frame animations

### Acceptance Criteria

- [ ] Creature encounters trigger at the correct probability rates per layer tier (verified over 100 blocks in DevPanel)
- [ ] Combat overlay opens correctly and does not interfere with mine background rendering
- [ ] Flee button always succeeds when player O2 is below 20 (anti-frustration rule)
- [ ] Quiz during combat correctly pauses oxygen depletion timer
- [ ] Correct quiz answer in combat grants 50% bonus damage to next attack
- [ ] Wrong quiz answer in combat triggers immediate creature counterattack
- [ ] Boss at Layer 5 spawns at the pre-seeded guardian location (not randomly placed)
- [ ] Defeating a boss guarantees the documented reward (fossil egg at L5 boss)
- [ ] Combat state is saved on app background/foreground so fights are not lost to interruptions

---

## Sub-Phase 25.2: Cooperative Dives

### What

2-player shared mine dives where one player mines and one answers quizzes. The fundamental design: mining and learning split between two people, requiring real-time coordination. This is the most technically complex feature in Phase 25 (WebSocket networking, shared game state) and should only be built after all other Phase 25 features prove product-market fit.

**Co-op mechanics**:
- Player 1 (Miner): controls movement, mines blocks, carries loot in their backpack
- Player 2 (Scholar): receives ALL quiz prompts on their device; their answers affect the shared dive
- Correct quiz by Scholar: bonus oxygen refill for both players (shared O2 pool)
- Wrong quiz by Scholar: oxygen penalty for both players
- Either player can call "Emergency" (once per dive): Scholar must answer 3 consecutive questions correctly or the dive ends with loot loss
- Loot is split equally on return (a new "loot ledger" system, not the current single-player backpack)

**Networking architecture**:
- Server-side: a "dive room" system using WebSockets (Fastify with `@fastify/websocket`)
- Client-side: shared game state synchronized via operational transforms (simple enough for a 2-player turn-based game)
- Latency tolerance: the game is tick-based (movement = ticks), not real-time — 500ms latency is acceptable
- Disconnection handling: if Scholar disconnects, Miner gets a 60-second grace period to find a quiz answer manually or the dive becomes a solo dive

### Where

- `server/routes/coop.ts` — WebSocket route for dive room creation, player joining, state sync
- `server/services/coopDiveService.ts` — dive room state management, turn resolution
- `src/game/scenes/CoopMineScene.ts` — modified MineScene supporting 2-player state
- `src/ui/components/CoopLobby.svelte` — invite-a-friend lobby UI
- `src/ui/components/ScholarOverlay.svelte` — Scholar player's UI (quiz-only view, no mine rendering)
- `src/services/wsClient.ts` — WebSocket client wrapper

### Acceptance Criteria

- [ ] Two browser tabs (simulating 2 players) can join the same dive room via an invite code
- [ ] Scholar's correct quiz answer delivers the bonus O2 to the Miner's shared O2 pool in < 500ms
- [ ] Scholar disconnection triggers the 60-second grace period without crashing the Miner's session
- [ ] Loot is split correctly 50/50 on dive completion
- [ ] WebSocket connection uses WSS (TLS) in production; plain WS only in local dev

---

## Sub-Phase 25.3: Achievement Paintings Gallery

### What

A 7th dome room — the Gallery — that fills with milestone-earned pixel art paintings. Each painting is unlocked by a specific achievement and serves as a visual trophy wall celebrating the player's journey. This is a high-virality feature: beautiful paintings are shareable on social media (DD-V2-176 "GAIA's Report" shareable screenshots concept extended to art).

**Gallery room design**: A side-scrolling wall of paintings in ornate pixel art frames. Empty frames appear for locked paintings, showing a silhouette of the painting with a progress counter ("17/50 Astronomy facts to unlock"). Tapping a painting shows its full-resolution art and the achievement that earned it.

**Painting list** (initial set of 20 paintings at Phase 25 launch):

| Painting Name | Unlock Milestone | Art Description | Category |
|--------------|-----------------|-----------------|----------|
| "Starry Night" | Master 50 Astronomy facts | Pixel art tribute to Van Gogh with planets instead of stars | Astronomy |
| "Jurassic Poster" | Revive 10 dinosaur fossil species | Classic film poster-style with silhouetted sauropeck | Paleontology |
| "The Blue Heart" | Master 20 Marine Biology facts | Cross-section of ocean with bioluminescent creatures | Biology |
| "First Contact" | Reach Layer 20 for the first time | The miner looking up at a starfield from the deepest point | Milestone |
| "The Ancient Library" | Discover 5 Ancient Library micro-structures | Interior of a crumbling library filled with glowing books | World |
| "GAIA's Garden" | Keep a 30-day streak | GAIA tending an impossible garden of knowledge crystals | GAIA |
| "The Periodic Cathedral" | Master 40 Chemistry facts | Cathedral windows made of periodic table elements | Chemistry |
| "Pangaea" | Master 30 Geology/Geography facts | Earth as Pangaea viewed from space | Geography |
| "Quantum Portrait" | Master 30 Physics facts | Portrait of a physicist made of interference patterns | Physics |
| "The Bone Archive" | Revive 30 total fossil species | A museum hall filled with fossil specimens | Fossils |
| "The Knowledge Tree in Winter" | Have 100+ facts in "Known" tier | The Knowledge Tree in full bloom under snow | Learning |
| "100 Days Underground" | Accumulate 100 total dive completions | A commemorative stamp-art style poster | Milestone |
| "Terra Gacha Cartography" | Explore 10 different biomes | A pixel art map parchment showing all discovered biomes | Exploration |
| "The Mnemonic" | Get any fact wrong 5+ times then master it | A painting that IS the mnemonic for that specific fact | Learning |
| "Omniscient's Portrait" | Reach Omniscient status | Stylized portrait of the miner in golden light | Endgame |
| "The Volcanic Dawn" | Complete 5 Volcanic biome dives | Sunrise over a volcanic landscape | Biomes |
| "N5 Graduate" | Master all N5 Japanese vocabulary | Japanese calligraphy-style certificate painting | Language |
| "The Sapphire Expedition" | Collect 100 Data Discs | An explorer's gear spread with blue-glowing discs | Collecting |
| "Community Pillar" | Have 5 UGC facts published | A painting of a pedestal with your submitted facts | Community |
| "GAIA and Me" | Unlock all 6 dome rooms | GAIA and the player miner sitting together, looking at the tree | Milestone |

**Pixel art generation pipeline for paintings**:
- Paintings are 512×512 pixel art (vs. standard 256×256 sprites)
- Generated via ComfyUI at 1024×1024, downscaled to 512×512 without rembg (solid background is intentional)
- Each painting has a specific style reference in its ComfyUI prompt (e.g., "in the style of ukiyo-e woodblock prints" for Japanese paintings)
- Quality bar is higher than sprites: each painting gets 3 ComfyUI generations and the best is selected manually
- Paintings are stored in `src/assets/paintings/` (gitignored if large, served via CDN)

### Where

- `src/ui/components/rooms/GalleryRoom.svelte` — 7th dome room (must be registered in `DomeView.svelte` room system)
- `src/ui/components/PaintingCard.svelte` — individual painting display with frame, title, unlock status
- `src/ui/components/PaintingReveal.svelte` — gacha-style reveal animation when a painting is first unlocked
- `src/data/paintings.ts` — painting definitions (id, name, milestone, imagePath, achievementId)
- `src/game/managers/AchievementManager.ts` — triggers painting unlock events when milestones are met
- `src/assets/paintings/` — 512×512 PNG painting files
- `src/assets/paintings/locked/` — silhouette versions (grayscale, blurred) for locked paintings

### How

**Step 1: Gallery room integration**

`GalleryRoom.svelte` is the 7th room in the dome. In `DomeView.svelte`, add `gallery` to the room list (currently 6 rooms: command, lab, workshop, museum, market, archive). The dome tile layout (`src/data/domeLayout.ts`) must have a gallery door/portal at the appropriate position. The room tab icon is a small painting frame icon.

**Step 2: Painting data model**

```typescript
// src/data/paintings.ts
export interface Painting {
  id: string
  name: string
  description: string       // Shown on the expanded painting view
  achievementId: string     // References an AchievementManager achievement
  imagePath: string         // e.g., 'paintings/starry-night.png'
  lockedImagePath: string   // e.g., 'paintings/locked/starry-night-silhouette.png'
  frameStyle: 'gold' | 'wood' | 'stone' | 'crystal'  // Frame cosmetic
  milestoneDescription: string  // "Shown below the locked silhouette: 'Master 50 Astronomy facts'"
  progressCurrent?: (save: PlayerSave) => number  // Live progress calculation
  progressTarget: number
  category: string          // For Gallery filter tabs
}

export const PAINTINGS: Painting[] = [
  {
    id: 'starry_night',
    name: 'Starry Night',
    description: 'The cosmos as seen by a miner who looked up long enough to understand.',
    achievementId: 'master_50_astronomy',
    imagePath: 'paintings/starry-night.png',
    lockedImagePath: 'paintings/locked/starry-night-silhouette.png',
    frameStyle: 'gold',
    milestoneDescription: 'Master 50 Astronomy facts',
    progressCurrent: save => save.masteredByCategory?.['Astronomy'] ?? 0,
    progressTarget: 50,
    category: 'Astronomy'
  },
  // ... all 20 paintings
]
```

**Step 3: Painting reveal animation**

When a painting is unlocked (AchievementManager fires the achievement), `PaintingReveal.svelte` plays a full-screen animation:
- Ornate frame materializes from golden particles
- Canvas is blank — paint strokes fill in from corner to corner over 3 seconds (CSS animation using clip-path)
- GAIA commentary (painting-specific): e.g., for Starry Night: "Van Gogh painted stars. You learned them. I think that matters."
- Player taps to dismiss and is taken to the Gallery with the new painting highlighted

**Step 4: ComfyUI painting generation**

For each painting in the list, create a ComfyUI prompt using the standard pixel art pipeline but with these modifications:
- Resolution: 1024×1024 → downscale to 512×512 (no rembg — solid background)
- LoRA strength: 0.75 (slightly lower to allow style references to show through)
- CFG: 8.0 (higher for style adherence)
- Steps: 40 (more for complex compositions)
- Style modifiers added per painting (e.g., "+ukiyo-e style" for Japanese painting, "+art nouveau border" for chemistry painting)

### Acceptance Criteria

- [ ] Gallery room is accessible as the 7th dome room from DomeView
- [ ] All 20 painting definitions are present in `paintings.ts` with all required fields
- [ ] Locked paintings show silhouette + progress counter ("17/50")
- [ ] Progress counter updates in real time as the player masters new facts (reactive)
- [ ] PaintingReveal animation plays for the first unlock only (not on subsequent Gallery visits)
- [ ] Tapping a revealed painting opens a full-screen view with the painting name, description, and unlock date
- [ ] Paintings are shareable: a "Share" button saves the painting to device gallery (via Capacitor Share plugin)
- [ ] `npm run typecheck` passes with all painting-related types

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // Inject save with 50 astronomy facts mastered
  await page.addInitScript(() => {
    const save = JSON.parse(localStorage.getItem('playerSave') || '{}')
    save.masteredByCategory = { ...(save.masteredByCategory || {}), Astronomy: 50 }
    save.unlockedPaintings = save.unlockedPaintings || []
    localStorage.setItem('playerSave', JSON.stringify(save))
  })

  await page.goto('http://localhost:5173')
  await page.waitForSelector('.dome-view', { timeout: 15000 })

  // Navigate to Gallery room
  await page.click('[data-room="gallery"]')
  await page.waitForSelector('.gallery-room', { timeout: 5000 })

  // Verify Starry Night is unlocked (50 astronomy mastered)
  const starryNight = await page.$('.painting-card[data-id="starry_night"]:not(.locked)')
  console.assert(starryNight !== null, 'Starry Night painting should be unlocked at 50 Astronomy mastery')

  // Tap to view painting
  await page.click('.painting-card[data-id="starry_night"]')
  await page.waitForSelector('.painting-detail-view', { timeout: 5000 })
  const paintingName = await page.textContent('.painting-detail-name')
  console.assert(paintingName.includes('Starry Night'), 'Painting detail view should show painting name')

  await page.screenshot({ path: '/tmp/ss-gallery-room.png' })
  await browser.close()
  console.log('PASS: Gallery room and painting unlock logic work correctly')
})()
```

---

## Sub-Phase 25.4: Advanced Pet System

### What

Depth expansion of the Phase 9 pet/companion system. Every player gets a cat (non-negotiable design principle — cats are universally beloved and require less explanation than exotic creatures). Advanced systems add ongoing economy sinks, personality development, and rare companion effect combinations.

**Every player gets a cat (design mandate)**: On account creation, every new player receives a "Dust Cat" — a small cat made of animated glowing dust motes. The Dust Cat is permanent, unkillable, and costs nothing to maintain. It serves as GAIA's companion in the dome when the player's dive companion is underground. The Dust Cat has 3 evolving appearances based on total facts mastered (kitten / adult / elder).

**Advanced pet economy sinks**:
- **Feeding**: Pets have a hunger meter (0-100). Hunger decreases at 5 points per hour. Feeding costs dust (50-200 dust depending on pet tier). Well-fed pets produce companion bonuses on dives; hungry pets provide no bonuses (but this is never punishing — the Dust Cat always provides its basic effect regardless of hunger).
- **Grooming**: Weekly grooming session (5-minute activity in the Zoo room). Player brushes their pet via a mini-game (swipe in the direction GAIA indicates). Successful grooming grants a "Gleaming" temporary buff to the pet's dive bonus for 24 hours.
- **Evolution**: Rarest fossil pets (Legendary/Mythic tier) have 3 evolution stages. Evolution requires: 100 fact masteries while that pet is active + a special Evolution Crystal (crafted in the Materializer).

**Personality development**: Each pet develops 3 personality traits from a list of 10 (adventurous, shy, mischievous, studious, lazy, energetic, affectionate, grumpy, curious, cautious). Traits emerge based on player behavior:
- A player who dives deep frequently develops an "adventurous" pet
- A player who studies often develops a "studious" pet
- Traits affect GAIA's commentary about the pet: "Your Dust Cat is getting rather studious — I've noticed it sitting near the Knowledge Tree during your review sessions."

**Rare companion effect combinations**: When a player has 2+ companions active (from relics or craft), specific pairings create synergy effects:
- Dust Cat + any Fossil Pet = "Ancient Bond": +10% artifact find rate
- Two fossil pets from the same era = "Era Affinity": quiz distractors are slightly easier for that era's facts
- Companion + matching relic = "Resonance": companion's primary effect is doubled

### Where

- `src/ui/components/rooms/ZooRoom.svelte` — extended with feeding UI, grooming mini-game, evolution UI
- `src/game/companions/PetPersonality.ts` — personality trait tracking and emergence logic
- `src/game/companions/CompanionSynergy.ts` — synergy combination resolution
- `src/data/petPersonalities.ts` — 10 personality trait definitions with behavioral triggers and dialogue
- `src/data/companionSynergies.ts` — all synergy combination definitions
- `src/ui/components/GroomingMinigame.svelte` — swipe-direction grooming mini-game
- `src/services/petService.ts` — hunger calculation, feeding, evolution checks

### Acceptance Criteria

- [ ] Every new account receives a Dust Cat in their save state (verified in account creation flow)
- [ ] Dust Cat appearance changes at 50 and 200 total facts mastered (kitten → adult → elder)
- [ ] Pet hunger decreases at the correct rate and feeding costs the correct dust amount
- [ ] Personality trait emergence logic correctly tracks player behavior patterns across 10+ dive sessions
- [ ] The grooming mini-game functions on touch input (swipe detection works correctly on mobile viewport)
- [ ] Legendary pet evolution requires both 100 masteries AND an Evolution Crystal (neither alone is sufficient)
- [ ] The "Ancient Bond" synergy effect correctly increases artifact find rate by 10% (testable via DevPanel)
- [ ] GAIA references the pet's personality in relevant dialogue contexts (e.g., before an adventurous pet's dive)

---

## Sub-Phase 25.5: Pixel Art Per Fact

### What

Every fact in the database receives a unique pixel art illustration (DD-V2-171 from KNOWLEDGE_SYSTEM.md: "Every fact gets a unique pixel art illustration"). If Phase 11's pipeline has not completed this, Phase 25.5 batch-generates remaining fact images. The images use the greyscale-to-color mastery progression system.

**Greyscale-to-color mastery progression**:

| Mastery Level | SM-2 Interval | Image Rendering |
|--------------|---------------|-----------------|
| New | 0 days | Fully greyscale, low contrast |
| Learning | 1-3 days | 5% color bleed-through (near the focal point of the image) |
| Familiar | 4-14 days | 30% color — edges still grey |
| Known | 15-60 days | 70% color — only shadows grey |
| Mastered | 60+ days | Full vibrant color, image glows slightly |

**Implementation**: The greyscale-to-color effect is applied client-side via CSS `filter: saturate(N%)` + a canvas-based gradient overlay. The source image is always the full-color version — saturation and overlay are runtime parameters. This avoids storing 5 copies of each image.

**Quality controls** (per KNOWLEDGE_SYSTEM.md rules):
- The image must illustrate the topic but NOT reveal the answer
  - YES: a pixel art octopus for "How many hearts does an octopus have?"
  - NO: a pixel art octopus with 3 visible hearts labeled
- After generation, each image is auto-checked by the LLM pipeline: "Does this image reveal the answer to [question]?" If LLM returns YES, the image is regenerated with a more abstract prompt
- Human spot-check: every 100th generated image is flagged for manual review

**ComfyUI batch generation pipeline**:
- Script: `scripts/generate-fact-images-batch.ts` — reads all facts without `image_url`, generates in batches of 10
- Prompt template: `"[image_prompt field from fact], pixel art illustration, 8-bit style, cute, isometric view, single centered subject, white background"`
- Post-processing: rembg transparency removal, downscale to 256px for hi-res, 32px for lo-res thumbnails
- Rate limit: ComfyUI queue max 3 concurrent generations (RTX 3060 12GB VRAM constraint)

### Where

- `scripts/generate-fact-images-batch.ts` — batch generation script
- `scripts/check-image-reveals-answer.ts` — LLM quality check script
- `src/ui/components/FactCard.svelte` — greyscale-to-color rendering based on mastery level
- `src/ui/components/StudyCard.svelte` — same greyscale rendering during study
- `src/assets/facts/` — generated fact images (gitignored, served via CDN)
- `src/services/factsDB.ts` — `image_url` field queried for fact card rendering

### How

**Step 1: Greyscale-to-color CSS implementation**

```svelte
<!-- FactCard.svelte — mastery-based image rendering -->
<script lang="ts">
  export let imageUrl: string | undefined
  export let masteryInterval: number  // SM-2 interval in days

  function getSaturation(interval: number): number {
    if (interval === 0) return 0     // Fully greyscale
    if (interval < 4) return 10
    if (interval < 15) return 35
    if (interval < 60) return 70
    return 100                        // Full color
  }

  function getGlowOpacity(interval: number): number {
    return interval >= 60 ? 0.15 : 0  // Subtle glow on mastered
  }

  $: saturation = getSaturation(masteryInterval)
  $: glowOpacity = getGlowOpacity(masteryInterval)
</script>

{#if imageUrl}
  <div class="fact-image-wrapper" style="--saturation: {saturation}%; --glow: {glowOpacity}">
    <img
      src={imageUrl}
      alt="Fact illustration"
      class="fact-image"
      style="filter: saturate({saturation}%)"
    />
    {#if glowOpacity > 0}
      <div class="mastery-glow" style="opacity: {glowOpacity}" />
    {/if}
  </div>
{/if}

<style>
  .fact-image { image-rendering: pixelated; width: 128px; height: 128px; }
  .mastery-glow {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at center, rgba(255,215,0,0.4) 0%, transparent 70%);
    pointer-events: none;
  }
</style>
```

**Step 2: Batch generation script outline**

```typescript
// scripts/generate-fact-images-batch.ts
// Usage: npx tsx scripts/generate-fact-images-batch.ts --batch-size 10 --start-offset 0

async function processBatch(batchSize: number, offset: number) {
  const facts = await db.prepare(
    `SELECT id, image_prompt, quiz_question, correct_answer FROM facts WHERE image_url IS NULL LIMIT ? OFFSET ?`
  ).all(batchSize, offset)

  for (const fact of facts) {
    const prompt = `${fact.image_prompt}, pixel art illustration, 8-bit style, isometric view, single centered subject, white background, does NOT show "${fact.correct_answer}"`
    const imageBuffer = await comfyUIGenerate(prompt)
    const transparentBuffer = await rembgRemoveBackground(imageBuffer)
    const hiresPath = `src/assets/facts/${fact.id}_256.png`
    const loresPath = `src/assets/facts/${fact.id}_32.png`
    await saveDownscaled(transparentBuffer, hiresPath, 256)
    await saveDownscaled(transparentBuffer, loresPath, 32)

    // LLM quality check
    const revealsAnswer = await checkImageRevealsAnswer(fact.quiz_question, fact.correct_answer, transparentBuffer)
    if (revealsAnswer) {
      console.log(`[REGENERATE] Fact ${fact.id} image reveals answer — flagged for regeneration`)
      continue  // Skip; will be picked up in next batch
    }

    await db.prepare(`UPDATE facts SET image_url = ? WHERE id = ?`).run(`/facts/${fact.id}_256.png`, fact.id)
  }
}
```

### Acceptance Criteria

- [ ] A fact with `masteryInterval = 0` renders its image fully greyscale (saturation = 0%)
- [ ] A fact with `masteryInterval = 65` renders in full color with subtle golden glow
- [ ] The saturation transition is smooth across all 5 levels (no visible jumps at boundaries)
- [ ] `generate-fact-images-batch.ts` processes 10 facts without errors on local ComfyUI
- [ ] The LLM quality check correctly flags an image showing "3 hearts" on an octopus as revealing the answer
- [ ] `image_url` is updated in the database after successful generation and quality check
- [ ] Fact images render with `image-rendering: pixelated` (no blurring on mobile zoom)
- [ ] The batch script is resumable (if interrupted, it starts from the last unprocessed fact, not from scratch)

---

## Sub-Phase 25.6: Accessibility — Post-Launch Set

### What

The accessibility features that were deferred from Phase 20's launch requirements (DD-V2-178). These three features specifically address users with dyslexia, one-handed mobile users, and users with vestibular disorders (motion sensitivity). Together they address approximately 15-20% of the potential player base.

**Pre-implementation requirement**: Before coding begins, conduct a genuine accessibility audit with at least 3 users from the target populations (1 dyslexic reader, 1 one-handed user, 1 user with motion sensitivity). The findings from this audit should inform the specific implementation. Automated tools (Lighthouse, axe) are insufficient — they cannot catch gaming-specific accessibility failures.

**Accessibility audit checklist** (to be completed before Phase 25.6 implementation):

```
DYSLEXIA AUDIT:
[ ] Ask a dyslexic reader to play through tutorial with current font — note every friction point
[ ] Identify: any font with ascenders/descenders that cause confusion (b/d/p/q, 6/9, 1/l/I)
[ ] Identify: any text with letter spacing too tight for comfortable reading
[ ] Identify: any color combinations where text is hard to distinguish from background
[ ] Identify: any quiz choices where answer letters (A/B/C/D) are visually similar

ONE-HANDED AUDIT:
[ ] Play through a full dive with one hand holding the device (simulate right-hand dominant user)
[ ] Note every UI element that requires two hands to reach safely
[ ] Note every small touch target (< 44px) that is hard to hit with thumb while device-holding hand is occupied
[ ] Map the thumb's comfortable reach arc on a 390px-wide screen
[ ] Identify: bottom sheet height, button positions, quiz answer tap zones

REDUCED MOTION AUDIT:
[ ] List every animated element in the game (particle systems, screen shake, transitions, parallax)
[ ] Mark each as: "essential to gameplay" vs "decorative" vs "feedback" vs "ambient"
[ ] Identify: which animations could trigger vestibular response (screen shake, fast horizontal movement)
[ ] Verify: does screen shake during earthquake events have any non-motion equivalent (haptic? border flash?)
```

**Implementation specifications**:

### Dyslexia-Friendly Font Option (DD-V2-178)

- Font: OpenDyslexic (open source, free, specifically designed to reduce reading errors in dyslexic readers)
- Download: `https://opendyslexic.org/` — include as a local font file in `src/assets/fonts/`
- Applies to: all fact text, quiz question text, quiz answer choices, GAIA dialogue, KnowledgeTree labels, UI buttons and labels — everything that contains meaningful text
- Does NOT apply to: pixel art sprite text (e.g., signs in the mine — these are decorative)
- Toggle location: Settings > Display > "Reading Assist: Dyslexic-Friendly Font"
- Implementation: CSS custom property `--font-primary: 'OpenDyslexic', sans-serif` applied at the `:root` level when the setting is active; the Svelte settings store writes this to `document.documentElement.style.setProperty`
- GAIA's font is also switched — GAIA's personality is in her words, not her typeface

### One-Handed Mode

One-handed mode repositions all interactive elements to the thumb's comfortable reach zone on a mobile screen — the bottom ~65% of the screen.

**Specific repositions**:

| Element | Default Position | One-Handed Position |
|---------|-----------------|---------------------|
| Quiz answer buttons | Center of screen (vertical stack) | Bottom 60% of screen (2×2 grid) |
| HUD oxygen bar | Top-right | Bottom-left (above safe area) |
| Bomb button | Bottom-right | Bottom-right (unchanged — already thumb-accessible) |
| Settings gear icon | Top-right | Top-right — switches to a sticky bottom bar |
| Study card flip | Full card tap | Large tap zone at bottom half of card |
| Navigation tabs (dome rooms) | Bottom tab bar | Bottom tab bar (unchanged) |
| Flee button (combat) | Center | Bottom-right |

Implementation: CSS class `one-handed-mode` applied to `<body>` when the setting is active. Each component has scoped CSS rules for `.one-handed-mode &` selectors. No JavaScript repositioning — pure CSS layout changes.

**Note for lying-down play**: The most common one-handed mobile gaming posture is lying on one side with the device held vertically. The thumb's reach arc from the bottom right is different from a device held upright. Consider offering both "Right-hand mode" and "Left-hand mode" variants.

### Reduced Motion Mode

Reduced motion disables or replaces all animations that could trigger vestibular response (DD-V2-178).

**Per-animation decisions**:

| Animation | Reduced Motion Treatment |
|-----------|------------------------|
| Screen shake (earthquakes, unstable ground) | Replace with: screen border flashes red 3× |
| Horizontal mine scroll (parallax) | Disable parallax; background stays fixed |
| Particle effects (dust motes, stars, loot physics) | Replace with: static star field; instant loot pickup (no arc) |
| Gacha reveal animations | Replace with: instant reveal with color flash instead of zoom/spin |
| GAIA slide-in animations | Replace with: instant appear/disappear |
| Knowledge Tree leaf animations | Replace with: instant state change |
| Study card flip | Replace with: instant reveal (no 3D CSS transform) |
| Knowledge Tree growth animation | Replace with: instant new state |
| Aurora animation (Golden Dome) | Replace with: static gold gradient |

Implementation: Respect `prefers-reduced-motion: reduce` media query globally (automatically honors system settings). Also provide a manual toggle in Settings > Accessibility > "Reduced Motion" that sets a `reduced-motion` CSS class on `<body>` even if the system setting is not active.

In Phaser 3, reduced motion is handled by:
```typescript
// src/game/scenes/MineScene.ts
import { get } from 'svelte/store'
import { reducedMotion } from '../../ui/stores/settings'

if (!get(reducedMotion)) {
  this.cameras.main.shake(500, 0.02)  // Only shake if motion is allowed
} else {
  this.events.emit('screen-border-flash', 'red')  // Svelte overlay handles border flash
}
```

### Where

- `src/assets/fonts/OpenDyslexic-Regular.woff2` — dyslexia font file
- `src/assets/fonts/OpenDyslexic-Bold.woff2` — dyslexia font bold
- `src/ui/stores/settings.ts` — `dyslexicFont`, `oneHandedMode`, `reducedMotion` settings
- `src/ui/Settings.svelte` — Accessibility section with three toggles
- `src/app.css` (or global CSS) — `.dyslexic-font` class on `:root`, one-handed CSS layout rules, reduced motion overrides
- All Svelte components — scoped CSS for one-handed mode layout changes
- `src/game/scenes/MineScene.ts` — reduced motion screen shake handling
- `src/game/scenes/BootScene.ts` — load OpenDyslexic font via Phaser WebFontLoader

### How

**Step 1: Dyslexic font integration**

```css
/* src/app.css */
@font-face {
  font-family: 'OpenDyslexic';
  src: url('/fonts/OpenDyslexic-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: 'OpenDyslexic';
  src: url('/fonts/OpenDyslexic-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}

:root.dyslexic-font {
  --font-primary: 'OpenDyslexic', 'Segoe UI', sans-serif;
  --font-quiz: 'OpenDyslexic', 'Segoe UI', sans-serif;
  letter-spacing: 0.05em;   /* OpenDyslexic has heavy serifs; extra spacing helps */
  line-height: 1.6;          /* Taller line height improves tracking */
}
```

```typescript
// Apply font class reactively in App.svelte
import { dyslexicFont } from './ui/stores/settings'
$: if ($dyslexicFont) {
  document.documentElement.classList.add('dyslexic-font')
} else {
  document.documentElement.classList.remove('dyslexic-font')
}
```

**Step 2: One-handed mode CSS**

```css
/* QuizOverlay.svelte — one-handed quiz layout */
.one-handed-mode .quiz-choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  position: fixed;
  bottom: env(safe-area-inset-bottom, 0px);
  left: 0; right: 0;
  height: 60vh;  /* Bottom 60% of screen */
}

/* HUD.svelte — one-handed oxygen bar */
.one-handed-mode .oxygen-bar {
  top: auto;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 120px);  /* Above quiz buttons */
  left: 8px;
  right: auto;
}
```

**Step 3: Reduced motion via CSS and Phaser**

```css
/* Global reduced motion styles */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}

body.reduced-motion *, body.reduced-motion *::before, body.reduced-motion *::after {
  animation-duration: 0.01ms !important;
  transition-duration: 0.01ms !important;
}

/* Screen border flash (replaces screen shake) */
body.screen-border-flash-red::after {
  content: '';
  position: fixed; inset: 0;
  border: 8px solid rgba(255, 50, 50, 0.8);
  pointer-events: none;
  animation: flash-border 0.3s ease-out 3;
}

@keyframes flash-border {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

### Acceptance Criteria

- [ ] Pre-implementation accessibility audit is documented in `docs/ACCESSIBILITY_AUDIT.md` with findings from at least 3 real users
- [ ] OpenDyslexic font applies to ALL text-bearing elements when the setting is active (verify by checking 10 different screens)
- [ ] OpenDyslexic font does NOT apply to pixel art sprite text
- [ ] One-handed mode repositions quiz choices to bottom 60% of screen
- [ ] One-handed mode does not break any quiz interaction (all 4 choices are tappable within thumb reach on a 390px screen)
- [ ] `prefers-reduced-motion: reduce` system setting disables all identified animations automatically (no manual setting required)
- [ ] Manual "Reduced Motion" toggle in Settings works independently of the system setting
- [ ] Screen shake in MineScene is replaced by border flash when `reducedMotion` is true
- [ ] The gacha reveal animation is replaced by instant reveal with color flash when `reducedMotion` is true
- [ ] All three accessibility toggles persist across app restarts (stored in localStorage and/or cloud save)
- [ ] Lighthouse accessibility score improves by at least 10 points after Phase 25.6 (measure before and after)

### Playwright Test

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

  // Test 1: Dyslexic font toggle
  await page.waitForSelector('button[aria-label="Settings"]', { timeout: 15000 })
  await page.click('button[aria-label="Settings"]')
  await page.waitForSelector('.accessibility-section', { timeout: 5000 })

  await page.click('.dyslexic-font-toggle')
  await page.waitForTimeout(300)

  const rootClass = await page.evaluate(() => document.documentElement.classList.contains('dyslexic-font'))
  console.assert(rootClass, 'dyslexic-font class should be applied to documentElement')

  const fontFamily = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.quiz-question') || document.body).fontFamily
  )
  console.assert(fontFamily.toLowerCase().includes('opendyslexic') || fontFamily.includes('OpenDyslexic'),
    `Font should include OpenDyslexic, got: ${fontFamily}`)

  await page.screenshot({ path: '/tmp/ss-dyslexic-font.png' })

  // Test 2: One-handed mode toggle
  await page.click('.one-handed-mode-toggle')
  await page.waitForTimeout(300)
  const bodyClass = await page.evaluate(() => document.body.classList.contains('one-handed-mode'))
  console.assert(bodyClass, 'one-handed-mode class should be applied to body')

  await page.screenshot({ path: '/tmp/ss-one-handed.png' })

  // Test 3: Reduced motion toggle
  await page.click('.reduced-motion-toggle')
  await page.waitForTimeout(300)
  const reducedClass = await page.evaluate(() => document.body.classList.contains('reduced-motion'))
  console.assert(reducedClass, 'reduced-motion class should be applied to body')

  await page.screenshot({ path: '/tmp/ss-reduced-motion.png' })

  await browser.close()
  console.log('PASS: All three accessibility toggles apply correct CSS classes')
})()
```

---

## Sub-Phase 25.7: Learning Effectiveness Report

### What

An annual published report with aggregate, anonymized player learning outcome data (DD-V2-179). This is both a credibility-building document for educators and parents AND a press-generating asset. The report positions Terra Gacha as a game that provably works educationally, not just claims to.

**Internal Learning Effectiveness Dashboard** (prerequisite — built in Phase 21.3):

The dashboard must track these five metrics before the annual report can be generated:

| Metric | Definition | Target |
|--------|-----------|--------|
| 30-day retention rate | % of facts still at "Known" level 30 days after first mastery | > 70% |
| 90-day retention rate | % of facts still at "Known" level 90 days after first mastery | > 55% |
| 180-day retention rate | % of facts still at "Known" level 180 days after first mastery | > 45% |
| Lapse rate | % of "Mastered" facts that lapse (interval resets) in any 30-day period | < 15% |
| Depth-learning correlation | Pearson correlation between avg dive depth and avg SM-2 interval | Target: r > 0.3 (positive) |

**Annual report format**:

The report is published as:
- A PDF report at `terragacha.com/research/annual-report-[year].pdf`
- An accompanying blog post (summary for non-researchers)
- Submitted to the Journal of Educational Technology or equivalent open-access journal

**Report structure outline**:

```
Terra Gacha Learning Effectiveness Report [Year]

Executive Summary
  - Total anonymized player-years of data
  - Key finding: "Players retained X% of learned facts after 30 days"
  - Comparison baseline: "Traditional study methods show ~20% retention at 30 days (Ebbinghaus, 1885)"

Methodology
  - SM-2 spaced repetition algorithm description (non-technical)
  - How facts are classified as "learned" vs "mastered"
  - Data anonymization process
  - Independent research partner: [organization name and brief bio]

Results
  - Retention curves (graphs: retention % vs days since learning)
  - Category breakdown: which fact types are retained best/worst
  - Player engagement correlation: more active players have higher retention (expected)
  - Platform comparison: web vs mobile retention rates

Limitations
  - Selection bias: players who use Terra Gacha self-select as motivated learners
  - No control group (ethical constraints on withholding learning opportunities)
  - Fact quality variation: some categories have higher intrinsic memorability

Implications for Educators
  - Category-level retention data to inform classroom use
  - Teacher Dashboard referral section
```

**Independent research partnership**:

Before the first annual report, identify and partner with one of:
- Institute of Play (New York) — game-based learning specialists
- EdTech Hub — international development education research
- A university education department (easier to approach than full institutes)

The partnership involves: sharing anonymized data with the partner, having them independently analyze it and verify the methodology, and having their name on the report. This is the key credibility marker — "independently verified" vs. self-reported.

### Where

- `server/services/learningEffectivenessService.ts` — queries and aggregates anonymized retention data
- `server/routes/research.ts` — `GET /api/research/metrics` (internal dashboard only, auth required)
- `server/scripts/generate-annual-report-data.ts` — exports anonymized aggregate data to CSV for research partner
- `docs/LEARNING_EFFECTIVENESS.md` — internal documentation of methodology and metric definitions
- `src/ui/components/rooms/ArchiveRoom.svelte` — "GAIA's Report" player-facing section (DD-V2-176)

### How

**Step 1: Anonymization protocol**

Before any data is exported or published:
- All player IDs are replaced with a session-keyed anonymous identifier (SHA-256 hash of `playerId + report_salt`, where `report_salt` rotates annually)
- Email addresses, usernames, and device identifiers are NEVER included in any export
- Geography is aggregated to country-level only (no city/region granularity)
- Cohort-level data only: no individual player's fact trajectory is ever shown

**Step 2: Retention curve calculation**

```typescript
// server/services/learningEffectivenessService.ts
async function calculate30DayRetention(): Promise<number> {
  // Facts that were first "Known" (interval >= 15) more than 30 days ago
  // Of those: what % are still at "Known" or higher today?
  const result = await db.prepare(`
    WITH first_known AS (
      SELECT fact_id, account_id, MIN(review_date) as first_known_date
      FROM review_history
      WHERE interval_achieved >= 15
      GROUP BY fact_id, account_id
    ),
    still_known AS (
      SELECT fk.fact_id, fk.account_id
      FROM first_known fk
      JOIN review_states rs ON (fk.fact_id = rs.fact_id AND fk.account_id = rs.account_id)
      WHERE fk.first_known_date < date('now', '-30 days')
        AND rs.interval >= 15
    )
    SELECT
      COUNT(DISTINCT sk.fact_id || sk.account_id) * 100.0 / COUNT(DISTINCT fk.fact_id || fk.account_id)
      AS retention_rate
    FROM first_known fk
    LEFT JOIN still_known sk ON (fk.fact_id = sk.fact_id AND fk.account_id = sk.account_id)
    WHERE fk.first_known_date < date('now', '-30 days')
  `).get()
  return result.retention_rate
}
```

**Step 3: Player-facing GAIA's Report**

In ArchiveRoom.svelte, the "GAIA's Report" tab shows per-player statistics in a positive, shareable format (DD-V2-176):
- "You've mastered [N] facts this month"
- Radar chart of quiz accuracy by category (beautiful, screenshot-worthy)
- "Your strongest area: [category name] ([accuracy]%)"
- "Your next frontier: [weakest category] — [N] facts available to explore"
- Share button: saves a PNG of the report card to device photo library

### Acceptance Criteria

- [ ] `calculate30DayRetention()` returns a value between 0 and 100 (not a SQL error)
- [ ] The anonymization function produces consistent anonymous IDs for the same player within one annual period and different IDs across annual periods (verified by running twice with the same input)
- [ ] The CSV export contains NO player-identifiable information (audit: run export, check all columns against the restricted list)
- [ ] GAIA's Report radar chart renders with correct category accuracy values (verified against known test data)
- [ ] The Share button produces a correctly formatted PNG of the report card
- [ ] Internal research dashboard is accessible only via authenticated admin routes (returns 403 for unauthenticated requests)
- [ ] `docs/LEARNING_EFFECTIVENESS.md` documents the methodology clearly enough for an external researcher to replicate the analysis

---

## Sub-Phase 25.8: Educational Partnerships

### What

A Teacher Dashboard web application at `dashboard.terragacha.com` that allows verified educators to manage a classroom's Terra Gacha usage (DD-V2-169). This is explicitly post-launch, built only after D30 >= 10% proves the consumer product retains players independently.

**Class code system**: Teacher creates a class, gets a 6-character alphanumeric code (e.g., `STEM42`). Students enter the code in their Terra Gacha settings. Teacher can see aggregated (not individual-level) learning data for the class.

**Teacher Dashboard wireframe description**:

```
dashboard.terragacha.com — Teacher Login (email + password, educator verified)

[Header]: Terra Gacha Teacher Dashboard | [Class: "Mr. Chen's Science Class (STEM42)"] | [Add Class] [Settings] [Logout]

[Left Nav]:
  Classes
    ○ Mr. Chen's Science Class (STEM42) — 23 students
    ○ Add New Class
  Resources
    ○ How to Use Terra Gacha in Class
    ○ Standards Alignment Guide
    ○ Printable Fact Sheets

[Main Content — Class Dashboard for "Mr. Chen's Science Class"]:

  [Section: Overview]
    Active students this week: 18/23
    Average session length: 12 minutes
    Facts reviewed this week: [sparkline bar graph, last 4 weeks]
    Most popular category: Biology

  [Section: Category Mastery (Class Average)]
    [Radar chart with 6 spokes: Natural Sciences, History, Geography, Technology, Culture, Language]
    "Your class has strong Biology coverage (72%) but low Astronomy (18%).
     Add the 'Space Month' seasonal pack to boost Astronomy coverage."

  [Section: Knowledge Gaps]
    [Table: Category | Class Avg Accuracy | Suggested Action]
    Astronomy        | 42%               | Add Space Month pack to category lock
    Chemistry        | 38%               | 15 new Chemistry facts added last week

  [Section: Category Lock for Homework]
    [Configure which categories students see this week]
    Current lock: "Natural Sciences" + "History" (aligned to curriculum topic: Earth Science)
    [Set Category Lock] [Clear Lock]

  [Section: Resources]
    [Download: "This Week's Fact Sheet" — printable PDF of the 10 most-reviewed facts]
    [Link: Standards Alignment: NGSS Grade 8 Earth Science]
```

**Educator verification**: Teachers must verify with a school email domain (`.edu`, `.k12.[state].us`, or equivalent). Terra Gacha manually reviews and approves educator accounts within 48 hours. No self-serve auto-approval.

**COPPA compliance**: For classrooms with students under 13, the Classroom License requires:
- Parent/guardian consent collected by the school (Terra Gacha does not collect consent from parents directly in the classroom context — the school is the responsible party)
- Student accounts in a verified classroom cannot be individually identified in the Teacher Dashboard — only aggregate data
- Students under 13 in a classroom automatically have Kid Mode enabled and cannot disable it without parental PIN

**LMS integration** (future): The Teacher Dashboard stub should include placeholder UI for LMS integration (Google Classroom, Canvas, Schoology). Implementation deferred — complex OAuth flows and per-LMS certification. The stub shows "Coming Soon: Google Classroom sync" to set expectation.

### Where

- `apps/teacher-dashboard/` — standalone Vite + Svelte 5 app (separate from game)
- `apps/teacher-dashboard/src/routes/` — SvelteKit routes (login, classes, class/:id, settings)
- `server/routes/classroom.ts` — class code CRUD, student enrollment, aggregate data endpoints
- `server/services/classroomService.ts` — class aggregate query logic (never individual student data)
- `server/middleware/educatorAuth.ts` — educator-specific JWT validation middleware

### How

**Step 1: Educator auth flow**

Educator accounts are a separate account type from player accounts. In `server/routes/auth.ts`, add `POST /api/auth/educator/register` with required fields: `schoolName`, `schoolEmail`, `gradeLevel`, `subjectArea`. Verification status is set to `pending` and an admin notification email fires. Admin approves via a simple admin route: `POST /api/admin/educators/approve/:id`.

**Step 2: Class aggregate queries (privacy-preserving)**

All Teacher Dashboard data queries aggregate at the class level with a minimum cohort size of 5 students before any data is shown (to prevent reverse-engineering individual student data from small classes):

```typescript
// server/services/classroomService.ts
async function getClassCategoryAccuracy(classId: string): Promise<CategoryAccuracy[]> {
  const result = await db.prepare(`
    SELECT
      f.category_top,
      AVG(CASE WHEN rh.correct = 1 THEN 100.0 ELSE 0.0 END) as avg_accuracy,
      COUNT(DISTINCT ce.account_id) as student_count
    FROM class_enrollments ce
    JOIN review_history rh ON ce.account_id = rh.account_id
    JOIN facts f ON rh.fact_id = f.id
    WHERE ce.class_id = ?
      AND rh.reviewed_at > datetime('now', '-7 days')
    GROUP BY f.category_top
    HAVING COUNT(DISTINCT ce.account_id) >= 5  -- Minimum cohort privacy threshold
  `).all(classId)
  return result
}
```

**Step 3: Category lock for students**

When a teacher sets a category lock via the Dashboard, it pushes to all enrolled student accounts via the API: `POST /api/classroom/:classId/category-lock { categories: string[] }`. The student's `categoryLock` setting is overridden by the classroom lock (teacher lock takes precedence over student preference). A visible notification in the student's Settings shows "Your teacher has set a category focus this week: Natural Sciences + History."

### Acceptance Criteria

- [ ] Educator registration flow creates a `pending` educator account and sends an admin notification
- [ ] Admin approval of educator account sets status to `active` and sends confirmation email
- [ ] A school email domain is required (reject `@gmail.com`, `@yahoo.com`, `@hotmail.com` domains)
- [ ] Class code generation produces unique 6-character alphanumeric codes
- [ ] Student enrollment via class code works from the game's Settings page
- [ ] Class category accuracy query returns no data when class has fewer than 5 active students (minimum cohort rule)
- [ ] Teacher category lock overrides student settings and is visibly communicated in the student's Settings UI
- [ ] Individual student fact data is NEVER included in any Teacher Dashboard API response (audit: check all endpoints)
- [ ] Students under 13 in a verified classroom cannot access monetization prompts or disable Kid Mode

---

## Sub-Phase 25.9: Gacha Ethics Compliance

### What

A formal compliance audit and implementation review ensuring Terra Gacha meets all current and pending gacha regulation requirements (DD-V2-174). This is not a one-time task — it establishes an ongoing compliance monitoring process.

**Gacha ethics compliance checklist** (to be reviewed at launch and annually):

```
TRANSPARENCY:
[ ] Drop rate display: every gacha pull type shows exact probabilities before the player commits
    - Common: 60%, Uncommon: 25%, Rare: 10%, Epic: 4%, Legendary: 0.9%, Mythic: 0.1%
    - These are displayed in the UI adjacent to the gacha trigger (not buried in a help page)
[ ] Pity system: documented and disclosed in-game
    - Guarantee: after 20 artifacts without Rare+, next is guaranteed Rare+
    - This is displayed as "Pity: 14/20 without Rare" on the artifact reveal screen
[ ] Historical pull rates: player can view their own pull history and verify against displayed rates

REAL-MONEY PROTECTION:
[ ] No direct purchase of randomized loot with real money
    - Premium currency (if any) buys oxygen to play, not artifact pulls directly
    - Artifact pulls are earned through gameplay — mining artifact nodes
[ ] No pay-to-win escalation: artifacts contain facts (educational content) not power-ups
    - Relic power-ups are earned through gameplay, not purchased
[ ] Spending limits: if any premium currency is implemented, enforce daily/weekly purchase caps

NO-FOMO MECHANICS:
[ ] All seasonal cosmetics remain available in future seasons or via alternative means
[ ] No "limited time only" messaging for gameplay-impacting items
[ ] Seasonal event cosmetics are earnable through gameplay without purchase
[ ] No artificial scarcity on any educational content — all facts are earnable

REGIONAL COMPLIANCE:
[ ] Belgium: gacha with real money is classified as gambling — no direct paid pulls in Belgium
[ ] Netherlands: same restriction, plus paid loot boxes require government approval
[ ] Japan: no complete gacha (コンプリートガチャ) mechanics
[ ] South Korea: mandatory probability disclosure (already met via transparency requirements)
[ ] Apple App Store: comply with Apple's 2022 guideline 3.1.1 requiring drop rate disclosure
[ ] Google Play: comply with Google Play's Policy on real-money content

MINOR PROTECTIONS:
[ ] Kid Mode disables all premium currency display and all monetization prompts
[ ] No push notifications about purchases or "limited time offers" to any user
[ ] No social pressure mechanics ("Your friend bought X!")

DOCUMENTATION:
[ ] Maintain an internal compliance log updated with each feature that touches monetization
[ ] Annual external review by a mobile gaming compliance consultant
[ ] Terms of Service includes explicit description of all randomized mechanics
```

**Pity system implementation** (DD-V2-174):

```typescript
// src/game/systems/artifactDrop.ts
export function drawArtifactRarity(save: PlayerSave): Rarity {
  // Increment pity counter
  save.pityCounter = (save.pityCounter ?? 0) + 1

  // Check pity threshold (20 artifacts without Rare+)
  if (save.pityCounter >= 20) {
    save.pityCounter = 0
    // Guarantee Rare+ (roll from Rare, Epic, Legendary, Mythic only)
    return drawFromPool(['rare', 'epic', 'legendary', 'mythic'], [78, 20, 1.8, 0.2])
  }

  // Standard draw
  const result = drawFromPool(
    ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
    [60, 25, 10, 4, 0.9, 0.1]
  )

  if (['rare', 'epic', 'legendary', 'mythic'].includes(result)) {
    save.pityCounter = 0  // Reset pity on Rare+
  }

  return result
}
```

### Where

- `src/game/systems/artifactDrop.ts` — pity system implementation
- `src/ui/components/ArtifactRevealOverlay.svelte` — pity counter display "Pity: X/20 without Rare"
- `docs/GACHA_COMPLIANCE.md` — compliance checklist (living document, updated with each release)
- `server/routes/compliance.ts` — `GET /api/compliance/drop-rates` (public endpoint for transparency)

### Acceptance Criteria

- [ ] Drop rates are displayed adjacent to every gacha trigger in the UI (not in a separate help page)
- [ ] The pity counter is displayed as "Pity: X/20 without Rare" on the artifact reveal screen
- [ ] `drawArtifactRarity` resets pity counter to 0 after any Rare+ draw
- [ ] `drawArtifactRarity` guarantees Rare+ on the 20th pull without one (verified over 10,000 simulated pulls: no streak of 20+ without Rare+)
- [ ] Kid Mode shows zero premium currency UI and zero monetization prompts (audit: screenshot every screen in Kid Mode)
- [ ] `GET /api/compliance/drop-rates` returns the current probabilities publicly (no auth required)
- [ ] `docs/GACHA_COMPLIANCE.md` exists and has all checklist items marked with implementation status

---

## Sub-Phase 25.10: Kid Content & Parental Controls

### What

A fully-featured Kid Mode with a dedicated curation pipeline and robust parental controls (DD-V2-175). Kid Mode is not a "watered-down" version — it has equal "wow!" density as adult mode, with the most mind-blowing age-appropriate facts (octopus hearts, tardigrade survival, Jupiter's size, the Great Wall visible from space claim and its correction).

**Kid Wow Score curation pipeline**:

The `kid_wow_score` field (0-10) is added to the fact schema. It is rated independently from the adult `fun_score` field. Kid Wow Score specifically rates:
- How surprising is this to a child aged 7-12?
- Is the topic visually imaginable (animals, space, ancient history)?
- Does it invite "tell me more!" follow-up curiosity?
- Is it completely free of violence, sexuality, political content, or disturbing imagery?

Kid Mode serves ONLY facts with `kid_wow_score >= 7` AND `age_rating = 'kid'`. This ensures the kid fact pool is filtered for both safety AND wonder — not just safety.

**Examples by Kid Wow Score**:

| Kid Wow Score | Fact |
|--------------|------|
| 10 | "Octopuses have three hearts and blue blood — they're basically real-life aliens." |
| 10 | "There are more stars in the universe than grains of sand on all of Earth's beaches." |
| 9 | "Tardigrades (water bears) can survive in outer space — they're essentially indestructible." |
| 9 | "Honey never spoils — archaeologists have found 3,000-year-old honey in Egyptian tombs and it was still edible." |
| 7 | "The Great Wall of China is NOT actually visible from space with the naked eye — that's a myth." |
| 4 (excluded) | "The Great Wall of China was built over many centuries using different materials." |
| 2 (excluded) | "The Roman Empire was divided into the Eastern and Western Empire in 285 AD." |

**Age lock system** (parental control):

```typescript
interface ParentalControls {
  kidModeEnabled: boolean
  ageGroup: 'kid' | 'teen' | 'adult'   // 'kid' = under 13, 'teen' = 13-17, 'adult' = 18+
  parentPin: string | null              // bcrypt hash of 4-digit PIN
  sessionTimeLimitMinutes: number | null  // 15, 30, 45, 60, or null (no limit)
  learningReportEmail: string | null    // Parent email for weekly learning summary
}
```

**Time limit system**:

When `sessionTimeLimitMinutes` is set:
- Track session start time on app foreground
- At 80% of time limit: GAIA gently announces "We've been diving for [N] minutes! We have about [remaining] minutes left in today's adventure."
- At 100%: GAIA announces "That's our time for today! Come back tomorrow and we'll discover more together." Dive is gracefully ended (oxygen refilled, player returned to dome, loot secured)
- Time limit resets at midnight local time
- Parent PIN is required to extend time: "Ask a parent to extend your time"

**Weekly learning summary email to parent**:

```
Subject: [ChildName]'s Terra Gacha learning summary — this week

This week, [ChildName] explored Terra Gacha and learned:

FACTS DISCOVERED: [N]
  [3 example facts from this week — the highest Kid Wow Score ones]
  e.g., "• Octopuses have three hearts"
        "• The Sun is 109 times wider than Earth"
        "• Honey found in Egyptian tombs is still edible after 3,000 years"

LEARNING PROGRESS:
  Facts being reviewed: [N]
  Facts mastered (long-term memory): [N]
  Strongest topic: [category] ([accuracy]% quiz accuracy)

SESSIONS THIS WEEK: [N] sessions, avg [N] minutes each
  [Progress bar: weekly time limit]

Keep exploring,
G.A.I.A. — Terra Gacha's AI companion

[Button: See full Learning Report]
[Unsubscribe from learning summaries]
```

### Where

- `src/ui/components/ParentalControlsOverlay.svelte` — PIN-protected parental controls settings UI
- `src/ui/stores/parentalControls.ts` — parental controls state management
- `src/services/kidModeService.ts` — Kid Wow Score filtering, time limit tracking
- `server/routes/parental.ts` — PIN verification, weekly summary email management
- `server/jobs/weeklySummaryEmail.ts` — weekly cron job for parent learning summaries
- `server/templates/email/weekly-learning-summary.html` — email template
- `src/data/facts/` — `kid_wow_score` field added to fact schema and seed data

### How

**Step 1: Add `kid_wow_score` to fact schema**

Add `kid_wow_score INTEGER` to the facts table (0-10, default 5). Update the fact ingestion pipeline (Phase 11) to auto-score Kid Wow Score using an LLM prompt:
"Rate this fact's wonder value for a child aged 7-12 on a scale of 0-10. 10 = mind-blowing, visual, shareable. 0 = dry, adult, or complex. Fact: [statement]"

**Step 2: Kid Mode fact filtering**

```typescript
// src/services/kidModeService.ts
export function isKidModeActive(save: PlayerSave): boolean {
  return save.parentalControls?.kidModeEnabled === true
}

export function applyKidFilter(query: string): string {
  return `${query} AND age_rating = 'kid' AND kid_wow_score >= 7`
}
```

All fact-serving functions in `factsDB.ts` call `applyKidFilter` when `isKidModeActive()` is true.

**Step 3: PIN-protected parental controls**

The Parental Controls section in Settings is protected by a 4-digit PIN. The PIN is set by the parent during initial account setup (optional) or from Settings > Parental Controls > Set PIN. PIN is stored as a bcrypt hash (server-side for cloud accounts, local bcrypt for offline).

**Step 4: Session time limit enforcement**

```typescript
// App.svelte — time limit tracking
let sessionStartTime = Date.now()

$effect(() => {
  const limit = $parentalControls.sessionTimeLimitMinutes
  if (!limit) return

  const interval = setInterval(() => {
    const elapsedMinutes = (Date.now() - sessionStartTime) / 60000
    const remaining = limit - elapsedMinutes

    if (remaining <= limit * 0.2 && !warningShown) {
      warningShown = true
      gaiaToast(`We have about ${Math.round(remaining)} minutes left today!`, 'friendly')
    }

    if (remaining <= 0) {
      clearInterval(interval)
      // Gracefully end dive, secure loot, return to dome
      gameManager.gracefulEndSession()
      gaiaToast("That's our time for today! Come back tomorrow!", 'warm')
    }
  }, 30000)  // Check every 30 seconds

  return () => clearInterval(interval)
})
```

### Acceptance Criteria

- [ ] Kid Mode shows only facts with `age_rating = 'kid'` AND `kid_wow_score >= 7` (verify: DevPanel fact browser in Kid Mode shows no adult-rated facts)
- [ ] Kid Mode disables: all monetization prompts, premium currency display, streak anxiety messaging, leaderboards that show other players' monetary spending
- [ ] PIN lock prevents kid from disabling Kid Mode without the 4-digit PIN (verify: Settings > Kid Mode toggle requires PIN entry)
- [ ] Session time limit correctly triggers GAIA warning at 80% of time and graceful end at 100%
- [ ] Graceful session end secures all collected loot (verify: loot is in inventory after time-limit session end)
- [ ] Weekly parent summary email is generated correctly (all 20 example child accounts receive correct personalized facts in the summary)
- [ ] Parent unsubscribes from weekly summary in one click (no login required)
- [ ] `kid_wow_score` field is present in all seed fact JSON files and in the database schema
- [ ] `npm run typecheck` passes with `ParentalControls` type fully typed

### Playwright Test

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // Inject save with Kid Mode active
  await page.addInitScript(() => {
    const save = JSON.parse(localStorage.getItem('playerSave') || '{}')
    save.parentalControls = {
      kidModeEnabled: true,
      ageGroup: 'kid',
      parentPin: null,   // No PIN for test purposes
      sessionTimeLimitMinutes: 30,
      learningReportEmail: null
    }
    localStorage.setItem('playerSave', JSON.stringify(save))
  })

  await page.goto('http://localhost:5173')
  await page.waitForSelector('.dome-view', { timeout: 15000 })

  // Verify monetization is hidden in Kid Mode
  const premiumCurrencyDisplay = await page.$('.premium-currency-display')
  console.assert(premiumCurrencyDisplay === null, 'Premium currency must not be visible in Kid Mode')

  const monetizationButton = await page.$('.buy-premium-button, .store-button[data-real-money="true"]')
  console.assert(monetizationButton === null, 'Real-money store buttons must not be visible in Kid Mode')

  // Verify time limit warning message source
  await page.evaluate(() => {
    // Simulate 80% of time limit elapsed
    window.__debugSessionStart = Date.now() - (30 * 60000 * 0.8)
  })
  await page.waitForTimeout(35000)  // Wait for the 30s check interval
  const gaiaToast = await page.$('.gaia-toast')
  console.assert(gaiaToast !== null, 'GAIA should warn about time limit at 80% elapsed')

  await page.screenshot({ path: '/tmp/ss-kid-mode.png' })
  await browser.close()
  console.log('PASS: Kid Mode hides monetization and time limit warning fires correctly')
})()
```

---

## Verification Gate

Before Phase 25 is considered complete as a whole:

1. **Typecheck**: `npm run typecheck` passes with 0 errors across all Phase 25 files
2. **Build**: `npm run build` succeeds with no bundle size regressions > 10% from additional assets
3. **Combat**: 100 simulated blocks at Layer 1 in DevPanel yields 2-4 creature encounters (within expected 3% rate ± tolerance)
4. **Gallery**: All 20 paintings are defined in `paintings.ts`; the Gallery room opens correctly; progress counters update
5. **Accessibility**: All three accessibility toggles apply the correct CSS classes (Playwright test above passes)
6. **Gacha compliance**: 10,000 simulated `drawArtifactRarity` calls confirm pity guarantee fires correctly (no run of 20+ without Rare+)
7. **Kid Mode**: Full playthrough of tutorial in Kid Mode with no monetization UI visible (screenshot audit)
8. **Teacher Dashboard**: Educator registration flow completes; class aggregate data shows no individual student information

---

## Files Affected

### New Files

**Sub-Phase 25.1 (Combat)**:
- `src/game/entities/Creature.ts`
- `src/game/entities/Boss.ts`
- `src/game/scenes/CombatOverlay.ts`
- `src/game/managers/CombatManager.ts`
- `src/data/creatures.ts`
- `src/data/bosses.ts`
- `src/ui/components/CombatHUD.svelte`
- `src/assets/sprites/creatures/` (multiple PNGs)

**Sub-Phase 25.2 (Co-op)**:
- `server/routes/coop.ts`
- `server/services/coopDiveService.ts`
- `src/game/scenes/CoopMineScene.ts`
- `src/ui/components/CoopLobby.svelte`
- `src/ui/components/ScholarOverlay.svelte`
- `src/services/wsClient.ts`

**Sub-Phase 25.3 (Gallery)**:
- `src/ui/components/rooms/GalleryRoom.svelte`
- `src/ui/components/PaintingCard.svelte`
- `src/ui/components/PaintingReveal.svelte`
- `src/data/paintings.ts`
- `src/game/managers/AchievementManager.ts`
- `src/assets/paintings/` (20 PNG files + 20 locked silhouettes)

**Sub-Phase 25.4 (Advanced Pet)**:
- `src/game/companions/PetPersonality.ts`
- `src/game/companions/CompanionSynergy.ts`
- `src/data/petPersonalities.ts`
- `src/data/companionSynergies.ts`
- `src/ui/components/GroomingMinigame.svelte`
- `src/services/petService.ts`

**Sub-Phase 25.5 (Pixel Art Per Fact)**:
- `scripts/generate-fact-images-batch.ts`
- `scripts/check-image-reveals-answer.ts`
- `src/assets/facts/` (generated images — gitignored)

**Sub-Phase 25.6 (Accessibility)**:
- `src/assets/fonts/OpenDyslexic-Regular.woff2`
- `src/assets/fonts/OpenDyslexic-Bold.woff2`
- `docs/ACCESSIBILITY_AUDIT.md`

**Sub-Phase 25.7 (Learning Effectiveness)**:
- `server/services/learningEffectivenessService.ts`
- `server/routes/research.ts`
- `server/scripts/generate-annual-report-data.ts`
- `docs/LEARNING_EFFECTIVENESS.md`

**Sub-Phase 25.8 (Educational Partnerships)**:
- `apps/teacher-dashboard/` (full standalone app)
- `server/routes/classroom.ts`
- `server/services/classroomService.ts`
- `server/middleware/educatorAuth.ts`

**Sub-Phase 25.9 (Gacha Ethics)**:
- `src/game/systems/artifactDrop.ts` (new dedicated file extracted from game manager)
- `docs/GACHA_COMPLIANCE.md`
- `server/routes/compliance.ts`

**Sub-Phase 25.10 (Kid Content)**:
- `src/ui/components/ParentalControlsOverlay.svelte`
- `src/ui/stores/parentalControls.ts`
- `src/services/kidModeService.ts`
- `server/routes/parental.ts`
- `server/jobs/weeklySummaryEmail.ts`
- `server/templates/email/weekly-learning-summary.html`

### Modified Files (Selected)
- `src/ui/components/DomeView.svelte` — register Gallery (7th) room
- `src/ui/Settings.svelte` — Accessibility section (dyslexic font, one-handed, reduced motion), Parental Controls section
- `src/ui/stores/settings.ts` — `dyslexicFont`, `oneHandedMode`, `reducedMotion`, `kidModeEnabled` stores
- `src/services/factsDB.ts` — Kid Mode fact filtering, `kid_wow_score` queries
- `src/services/saveService.ts` — `ParentalControls` in `PlayerSave` type, `pityCounter` field
- `src/game/scenes/MineScene.ts` — reduced motion screen shake handling, creature encounter rolls
- `src/game/managers/GameManager.ts` — `gracefulEndSession()` for time limit enforcement
- `src/app.css` — dyslexic font face declarations, one-handed mode layout rules, reduced motion overrides
- All quiz and study components — `one-handed-mode` CSS selectors

---

## Sub-Phase 25.11: No ECS — Enriched MineCell Architecture

- [ ] Formally document the decision to NOT adopt an Entity-Component-System architecture; instead enrich `MineCell` with all per-cell data and use dedicated update systems (HazardSystem, AnimSystem, BlockPhysics). (DD-V2-223)
- [ ] Audit any future proposals for ECS patterns and reject them unless `MineCell` exceeds 40 fields or update systems exceed 10; document the threshold in `docs/ARCHITECTURE.md`.
- `server/routes/index.ts` — register new routes (coop, research, classroom, parental, compliance, audio)
