# Phase 14: Onboarding & Tutorial

**Status**: Not started
**Priority**: Critical path — must ship before any marketing or soft launch
**Estimated effort**: 3–4 coding sessions
**Design decisions referenced**: DD-V2-040, DD-V2-082, DD-V2-143, DD-V2-156

---

## Overview

Phase 14 creates the entire first-run experience for a brand-new player: crash cutscene → GAIA introduction → age selection → interest profiling → handcrafted tutorial mine → progressive system unlocks across dives 1–5.

The goal is twofold:
1. **90-second hook moment** (DD-V2-143): the player must experience their first artifact reveal with GAIA's snarky comment AND the gacha animation within 90 seconds of gameplay start. If this does not happen within 90 seconds, the tutorial layout must be adjusted.
2. **Churn mitigation across dives 1–5** (DD-V2-156): front-load rewards so the player has an emotional investment (fossil, companion, dome room) before the novelty of the first dive fades.

These two goals are in tension — the 90-second hook requires a very short path to the first artifact, while churn mitigation requires pacing rewards across five dives. The resolution is a bifurcated tutorial: the first 90 seconds are tightly scripted for the hook moment, then the remaining dives 2–5 layer in systems progressively (DD-V2-143).

**Do NOT front-load all systems into dive 1.** Introduce one new mechanic per dive:
- Dive 1 (tutorial mine): mining, oxygen, first artifact reveal, earthquake introduction, materializer
- Dive 2: Knowledge Tree seed
- Dive 3: Study Session / GAIA Codex
- Dive 4: Crafting + companion selection
- Dive 5: First dome room expansion

---

## Prerequisites

Before beginning Phase 14, the following must be complete and passing `npm run typecheck`:

- `src/ui/stores/gameState.ts` — `Screen` type must include `'onboarding'`, `'tutorialMine'` (add these)
- `src/ui/stores/playerData.ts` — `initPlayer()` must support a `tutorialComplete: boolean` flag on `PlayerSave`
- `src/data/types.ts` — `PlayerSave` interface must have `tutorialComplete: boolean`, `selectedInterests: string[]`, `ageRating: AgeRating`, `diveCount: number`
- `src/services/saveService.ts` — `createNewPlayer()` must set `tutorialComplete: false`, `selectedInterests: []`, `diveCount: 0`
- `src/game/systems/MineGenerator.ts` — must export a `generateTutorialMine()` function (created in sub-phase 14.4)
- The existing `QuizOverlay.svelte`, `FactReveal.svelte`, `GaiaToast.svelte`, `BaseView.svelte`, `DiveResults.svelte` must all be functional (they are as of Phase 0-6 completion)

Verify with:
```
npm run typecheck
npm run build
```

---

## Sub-Phase 14.1: Backstory & Lore Cutscene

### What

A sequence of 3–5 pixel art comic panels displayed full-screen on first launch, telling the crash landing story. Each panel is a static image with a caption. A skip button is visible from the very first frame. Panels auto-advance after 4 seconds or advance on tap/click.

Panels in order:
1. **Panel 1 — "Year 2847. Earth Orbit."** — Star field, a small battered research vessel (the *Gaia's Reach*) against a brownish haze where Earth used to be blue. Caption: *"Year 2847. The surface of Earth has been unrecognizable for three centuries."*
2. **Panel 2 — "Descending."** — The ship banking steeply, cockpit view showing ochre desert and ruins far below. Warning lights flash. Caption: *"Your survey vessel — and its onboard AI — were not designed for atmospheric re-entry."*
3. **Panel 3 — "Impact."** — Dramatic crash panel: ship buried nose-first in rocky desert soil, dust cloud, debris arc. Caption: *"You survived. Somehow."*
4. **Panel 4 — "Booting Up."** — Close-up of a cracked terminal screen glowing cyan, a pixelated face appearing. Caption: *"G.A.I.A. systems: nominal. Crew status: you, alive. Hull status: do not ask."*
5. **Panel 5 — "The Plan."** — Wide shot of the buried ship from outside. A tiny miner figure stands at the entry hatch. Caption: *"Somewhere underground, Earth's history is buried. You have a pickaxe. GAIA has a plan."*

### Where

- `src/ui/components/CutscenePanel.svelte` — **new file** — renders one panel (image + caption + tap-to-advance)
- `src/ui/components/OnboardingCutscene.svelte` — **new file** — orchestrates the 5-panel sequence, emits `'complete'` event when done or skipped
- `src/assets/cutscene/` — **new directory** — stores panel images: `panel_01.png` through `panel_05.png`
- `src/ui/stores/gameState.ts` — add `'onboarding'` and `'cutscene'` to the `Screen` union type
- `src/App.svelte` — route `'onboarding'` screen to `OnboardingCutscene`

### How

**Step 1: Add new screen types.**

In `src/ui/stores/gameState.ts`, add to the `Screen` type union:
```typescript
| 'cutscene'
| 'onboarding'
| 'interestSelection'
| 'ageSelection'
| 'tutorialMine'
```

**Step 2: Generate cutscene panel images via ComfyUI.**

Use the standard ComfyUI pixel art pipeline (see `docs/SPRITE_PIPELINE.md`). For each panel, generate at 1024×576 (16:9 widescreen) then downscale to 512×288 for the game. Prompts must specify "pixel art, comic panel, single scene, no text overlay, dramatic lighting."

Panel image filenames and content notes:
- `panel_01.png` — space/orbit scene; planet visible below, brownish not blue
- `panel_02.png` — cockpit interior; alarm lights, ground rushing up
- `panel_03.png` — crash impact exterior; dust cloud, debris
- `panel_04.png` — terminal close-up; glowing cyan screen, pixel face
- `panel_05.png` — exterior wide shot; tiny miner silhouette at hatch

**Step 3: Create `CutscenePanel.svelte`.**

```svelte
<!-- src/ui/components/CutscenePanel.svelte -->
<script lang="ts">
  const { imageSrc, caption, onAdvance, onSkip } = $props<{
    imageSrc: string
    caption: string
    onAdvance: () => void
    onSkip: () => void
  }>()
</script>

<div class="panel" onclick={onAdvance} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && onAdvance()}>
  <img src={imageSrc} alt={caption} class="panel-image" />
  <p class="caption">{caption}</p>
  <button class="skip-btn" onclick|stopPropagation={onSkip}>Skip</button>
</div>

<style>
  .panel { position: fixed; inset: 0; background: #000; display: flex; flex-direction: column;
           align-items: center; justify-content: center; cursor: pointer; user-select: none; }
  .panel-image { max-width: 100%; max-height: 70vh; image-rendering: pixelated; }
  .caption { color: #e8d8b0; font-size: 1rem; text-align: center; max-width: 480px;
             padding: 1rem; font-family: monospace; }
  .skip-btn { position: absolute; top: 1rem; right: 1rem; background: rgba(0,0,0,0.6);
              border: 1px solid #555; color: #aaa; padding: 0.4rem 0.8rem;
              border-radius: 4px; cursor: pointer; font-size: 0.85rem; min-width: 44px; min-height: 44px; }
</style>
```

**Step 4: Create `OnboardingCutscene.svelte`.**

The component manages panel index. Each panel auto-advances after 4000ms (cleared on manual advance or skip). On last panel or skip, emits `'complete'`.

```svelte
<!-- src/ui/components/OnboardingCutscene.svelte -->
<script lang="ts">
  import CutscenePanel from './CutscenePanel.svelte'
  // panel_01.png etc. imported via static URL or import
  const PANELS = [
    { src: '/cutscene/panel_01.png', caption: 'Year 2847. The surface of Earth has been unrecognizable for three centuries.' },
    { src: '/cutscene/panel_02.png', caption: 'Your survey vessel — and its onboard AI — were not designed for atmospheric re-entry.' },
    { src: '/cutscene/panel_03.png', caption: 'You survived. Somehow.' },
    { src: '/cutscene/panel_04.png', caption: 'G.A.I.A. systems: nominal. Crew status: you, alive. Hull status: do not ask.' },
    { src: '/cutscene/panel_05.png', caption: 'Somewhere underground, Earth\'s history is buried. You have a pickaxe. GAIA has a plan.' },
  ]
  const { onComplete } = $props<{ onComplete: () => void }>()
  let panelIndex = $state(0)
  let timer: ReturnType<typeof setTimeout>

  function advance() {
    clearTimeout(timer)
    if (panelIndex < PANELS.length - 1) {
      panelIndex++
      scheduleAdvance()
    } else {
      onComplete()
    }
  }

  function scheduleAdvance() {
    timer = setTimeout(() => advance(), 4000)
  }

  $effect(() => {
    scheduleAdvance()
    return () => clearTimeout(timer)
  })
</script>

<CutscenePanel
  imageSrc={PANELS[panelIndex].src}
  caption={PANELS[panelIndex].caption}
  onAdvance={advance}
  onSkip={onComplete}
/>
```

**Step 5: Copy panel images to `public/cutscene/`** (not `src/assets/` since they need to be served statically). Create `public/cutscene/` directory and place the 5 PNG files there.

**Step 6: Wire into `App.svelte`.** After detecting a new player (`!save.tutorialComplete`), set screen to `'cutscene'`. When `OnboardingCutscene` emits `onComplete`, set screen to `'ageSelection'`.

### Acceptance Criteria

- [ ] All 5 panels display in sequence with correct captions
- [ ] Tap anywhere (except skip button) advances to the next panel
- [ ] Skip button immediately jumps to age selection from any panel
- [ ] Auto-advance fires after exactly 4 seconds of inactivity
- [ ] Skip button is visible and tappable from panel 1 frame 1 (no delay)
- [ ] Skip button has minimum 44×44px touch target
- [ ] Cutscene is skipped entirely on subsequent launches (`tutorialComplete === true`)
- [ ] `npm run typecheck` passes with no errors

### Playwright Test

```js
// Write to /tmp/test-cutscene.js and run: node /tmp/test-cutscene.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // Clear save to force first-run
  await page.goto('http://localhost:5173')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(1000)

  // Panel 1 should be visible
  const skipBtn = await page.$('.skip-btn')
  if (!skipBtn) throw new Error('Skip button not found on panel 1')
  await page.screenshot({ path: '/tmp/ss-cutscene-panel1.png' })

  // Skip should jump past all panels
  await skipBtn.click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-cutscene-skipped.png' })
  // Should now show age selection, not another panel

  await browser.close()
  console.log('Cutscene test passed')
})()
```

---

## Sub-Phase 14.2: GAIA Introduction & Interest Selection

### What

After the cutscene (or skip), GAIA appears and delivers a scripted monologue in a chat-bubble style overlay. Woven into the monologue are choice prompts that record the player's interests. Multiple interests can be selected. The interests are saved to `PlayerSave.selectedInterests` and used later by the content system to weight fact categories.

This screen must feel conversational, not like a form. GAIA speaks first; the player responds by tapping interest bubbles.

**Interest categories** (match `CATEGORIES` from `src/data/types.ts`):
- Historian (maps to `'History'`)
- Geologist (maps to `'Natural Sciences'` + `'Geography'`)
- Linguist (maps to `'Language'`)
- Scientist (maps to `'Natural Sciences'` + `'Technology'`)
- Naturalist (maps to `'Life Sciences'`)
- Explorer (maps to `'Geography'` + `'Culture'`)
- Generalist (selects all categories equally — no weighting)

Multiple selection is allowed. "Generalist" is mutually exclusive with specific choices (selecting Generalist deselects others; selecting any specific interest deselects Generalist).

### GAIA Dialogue Script (exact strings — implement verbatim)

```
Line 1 (auto, 2s after screen appears):
"Oh! You survived! I was running crash-recovery diagnostics for seventeen minutes.
That's a new record. For surviving, I mean — not for worrying."

Line 2 (auto, 3s after line 1):
"I'm GAIA. Geological Analytical Intelligence Assistant.
I contain approximately 2.3 terabytes of Earth's accumulated knowledge —
most of it intact, some of it... corrupted.
Your job is to dig up artifacts so I can rebuild what I've lost."

Line 3 (tap to continue):
"But first — I need to calibrate my fact-weighting algorithm.
Before the crash, what were you most interested in?"

[SHOW INTEREST BUBBLES — player selects 1–3]

Line 4 (after selection, reacts to first selected interest — see reactions below):
[See per-interest reaction table]

Line 5 (tap to continue):
"Perfect. I'll prioritize those areas in my artifact analysis.
Now — there's a pickaxe in the emergency kit.
Let's see what's buried under this crash site."
```

**Per-interest GAIA reactions (line 4 text):**

| Interest | GAIA reaction |
|---|---|
| Historian | "A historian! Oh, I have *centuries* of suppressed archaeological records in my databanks. They tried to bury some of this history. Ironic that you'll now dig it back up." |
| Geologist | "A geologist! The mineral strata under this crash site alone would make your jaw drop. 300 million years of compression, right below your feet." |
| Linguist | "A linguist! I have partial records of 847 extinct languages. Some died before anyone thought to record them. We might be the last ones who can reconstruct them." |
| Scientist | "A scientist! Good. I need someone who won't panic when the facts get counterintuitive. And they will get counterintuitive." |
| Naturalist | "A naturalist! The fossils down there — some of the creatures buried in this rock haven't been seen in 65 million years. *We could bring one back.*" |
| Explorer | "An explorer! Perfect. The descent shafts go down 20 layers. Nobody has mapped what's at the bottom. Nobody human, anyway." |
| Generalist | "A generalist! My favorite kind. The people who know a little about everything are always the most dangerous in a crisis. This qualifies as a crisis." |

### Where

- `src/ui/components/GaiaIntro.svelte` — **new file** — full-screen intro chat UI
- `src/ui/stores/playerData.ts` — use existing `playerSave` writable; `selectedInterests` and `interestWeights` must be added to `PlayerSave` interface in `src/data/types.ts`
- `src/data/types.ts` — add to `PlayerSave`:
  ```typescript
  selectedInterests: string[]       // e.g. ['Historian', 'Linguist']
  interestWeights: Record<string, number>  // category → weight multiplier
  tutorialComplete: boolean
  diveCount: number
  tutorialStep: number              // which tutorial step player is on (0 = not started)
  ```
- `src/services/saveService.ts` — update `createNewPlayer()` to initialize these fields

### How

**Step 1: Update `PlayerSave` type** in `src/data/types.ts`. Add the fields listed above. Update `createNewPlayer()` in `src/services/saveService.ts` to set `tutorialComplete: false`, `selectedInterests: []`, `interestWeights: {}`, `diveCount: 0`, `tutorialStep: 0`.

**Step 2: Build `GaiaIntro.svelte`.** The component has three internal phases:
1. `'talking'` — shows GAIA speech bubbles sequentially (lines 1-3)
2. `'selecting'` — shows 7 interest bubble buttons; player taps to toggle; "Continue" button appears after ≥1 selection
3. `'reacting'` — shows line 4 (interest-specific reaction) then line 5, then emits `'complete'`

Layout: dark background, GAIA avatar (use existing `gaiaAvatar.ts` sprite) in bottom-left corner, speech bubble in upper portion of screen, interest buttons as pill-shaped bubbles in a wrapping grid.

Skip button (top-right, always visible, min 44×44px): sets `selectedInterests: ['Generalist']`, `interestWeights: {}` (uniform weighting), emits `'complete'` immediately.

**Step 3: Calculate `interestWeights`** when player taps Continue after selecting. Map selected interest labels to category strings using the table above. For each mapped category, set `interestWeights[category] = 1.5`. Unmapped categories get `1.0`. If Generalist selected, all categories get `1.0`.

**Step 4: Persist to `playerSave`.** On `'complete'` event from `GaiaIntro`, call `playerSave.update()` to write `selectedInterests` and `interestWeights`, then `persistPlayer()`.

**Step 5: Wire into `App.svelte`.** Screen `'onboarding'` routes to `GaiaIntro`. On complete, advance to `'ageSelection'`.

### Acceptance Criteria

- [ ] GAIA speech bubbles appear sequentially with correct timing
- [ ] All 7 interest bubbles render with readable labels
- [ ] Multiple selection works (tap to toggle on/off)
- [ ] Generalist deselects all others; any specific selection deselects Generalist
- [ ] Continue button only appears after at least 1 interest is selected
- [ ] Per-interest GAIA reaction fires using the first selected interest (if multiple, use first tapped)
- [ ] `selectedInterests` and `interestWeights` are written to `PlayerSave` and persisted to localStorage
- [ ] Skip button is visible from frame 1 and works correctly (defaults to Generalist)
- [ ] `npm run typecheck` passes

---

## Sub-Phase 14.3: Age Selection

### What

A single screen after GAIA intro where the player selects their age tier. This affects which facts are served (the `ageRating` filter in `factsDB.ts`). It is entirely on the honor system. It can be changed later in Settings.

**Age tiers:**
- `'kid'` — Under 13. Filters to kid-rated facts only.
- `'teen'` — 13–17. Filters to kid + teen rated facts.
- `'adult'` — 18+. All facts available.

### Where

- `src/ui/components/AgeSelection.svelte` — **new file**
- `src/ui/stores/playerData.ts` — `initPlayer(ageRating)` already accepts `AgeRating`; call it here with the selected value
- `src/ui/components/Settings.svelte` — verify that age rating can be changed from Settings (it should already read from `playerSave`, just ensure the setting persists)

### How

**Step 1: Create `AgeSelection.svelte`.**

Simple full-screen layout. GAIA speech bubble at top: *"One more thing — I want to calibrate my language processing. How old are you? (Honor system. I won't tell anyone.)"*

Three large buttons stacked vertically (full-width, min 80px height each):
- `KID` — "Under 13"
- `TEEN` — "13–17"
- `ADULT` — "18+"

On button tap: write `ageRating` to `playerSave`, call `persistPlayer()`, emit `'complete'`.

No skip button — this is a 1-tap choice, forcing skip would just mean defaulting to `'teen'` which is already the default. If the player closes the app here, next launch should re-show age selection (check `playerSave.ageRating === undefined` — only set after this screen).

**Step 2: Handle existing saves.** `createNewPlayer()` sets `ageRating: 'teen'` by default. First-run players won't have `ageRating` set in localStorage (it's a new field). Add a migration in `saveService.ts` `load()` that checks if `ageRating` is undefined on an existing save and sets it to `'teen'` — but also sets a flag `needsAgeSelection: true` so returning players are not shown this screen again.

Actually, simpler: show age selection only if `!playerSave.tutorialComplete`. Since this is inside the onboarding flow, it will only be shown once.

**Step 3: Wire into `App.svelte`.** Screen `'ageSelection'` routes to `AgeSelection`. On complete, set screen to `'tutorialMine'` (which triggers the handcrafted tutorial dive).

### Acceptance Criteria

- [ ] Three age buttons render clearly with correct labels
- [ ] Tapping any button writes `ageRating` to `PlayerSave` and `localStorage`
- [ ] Screen is only shown during first-run onboarding flow
- [ ] Age rating changed in Settings immediately affects future fact filtering
- [ ] `npm run typecheck` passes

---

## Sub-Phase 14.4: Handcrafted Tutorial Mine

### What

A fully hand-authored mine for the player's very first dive. This replaces the procedural `generateMine()` for dive 1 only. The layout is deterministic, not seeded. Every object placement is exact.

The tutorial mine must:
1. Deliver the **first artifact reveal within 90 seconds** of tapping "Enter Mine" (DD-V2-143). Validate this timing against an actual playthrough.
2. Introduce the earthquake mechanic explicitly, with GAIA naming and explaining it (DD-V2-082).
3. Guarantee a **fossil node** in an accessible location (DD-V2-156).
4. Guarantee an artifact with **Rare+ rarity** containing a **hand-selected high wow-factor fact** (DD-V2-143).
5. End at the Materializer interaction, which is the tutorial mine's win condition.
6. Give 0% loot loss if oxygen depletes (first depletion ever — GAIA rescue moment) (DD-V2-156).

**Grid dimensions**: 20×20 (layers 1-5 standard size). Spawn at top-center: `(10, 1)`.

### Tutorial Mine Layout Specification

The grid is 20 columns (x: 0–19) by 20 rows (y: 0–19). `(0,0)` is top-left. `y` increases downward. The player spawns at `(10, 1)`.

**Legend:**
```
.  = Empty (BlockType.Empty = 0)
D  = Dirt (BlockType.Dirt = 1)        hardness: 1
S  = SoftRock (BlockType.SoftRock = 2) hardness: 2
T  = Stone (BlockType.Stone = 3)       hardness: 3
O  = OxygenCache (BlockType.OxygenCache = 12)
M  = MineralNode (BlockType.MineralNode = 10)
A  = ArtifactNode (BlockType.ArtifactNode = 11) — RARE+, wow-factor fact
F  = FossilNode (BlockType.FossilNode = 25)
U  = UpgradeCrate (BlockType.UpgradeCrate = 13)
Q  = QuizGate (BlockType.QuizGate = 14)
E  = ExitLadder (BlockType.ExitLadder = 15)
X  = Unbreakable (BlockType.Unbreakable = 99)
Z  = UnstableGround (BlockType.UnstableGround = 22) — for earthquake tutorial
P  = Player spawn (Empty, shown for reference)
```

**Full 20×20 grid (y=0 to y=19, x=0 to x=19):**

```
y=00: X X X X X X X X X X X X X X X X X X X X
y=01: X . . . . . . . . . P . . . . . . . . X
y=02: X . . . . . . . . . . . . . . . . . . X
y=03: X D D D D D D D D D D D D D D D D D D X
y=04: X D D D D D D D D D D D D D D D D D D X
y=05: X D D M D D D D D D D D D D D D M D D X
y=06: X D D D D D D D D A D D D D D D D D D X
y=07: X D D D D D D D D D D D D D D D D D D X
y=08: X D S D D D O D D D D D D D D D D D D X
y=09: X D D D D D D D D D D D D D D D D D D X
y=10: X S S S S S S S S S S S S S S S S S S X
y=11: X S S S S S S S S S S S S S S S S S S X
y=12: X S S M S S S S S S S S S S S S S S S X
y=13: X S S S S S S S S S S S Q S S S S S S X
y=14: X S Z Z Z S S S S S S S S S S S S S S X
y=15: X S Z . Z S S F S S S S S S S S U S S X
y=16: X S Z Z Z S S S S S S S S S S S S S S X
y=17: X T T T T T T T T T T T T T T T T T T X
y=18: X T T T T T T T T T T T T T T T T T T X
y=19: X X X X X X X X X X X X X X X X X X X X
```

**Notes on this layout:**

- Row y=0 and y=19, col x=0 and x=19: `Unbreakable` walls on all four edges (border)
- Rows y=1–2: Open empty space (pre-cleared spawn area). Player at `(10,1)`.
- Rows y=3–9: Dirt-dominated upper zone. The artifact `A` at `(9,6)` is reachable within ~10 blocks of mining from spawn = approximately 30–45 seconds of play (validates the 90-second hook target with room to spare).
- `M` at `(3,5)` and `(17,5)`: Two mineral nodes in the upper dirt zone — first mining reward before the artifact.
- `O` at `(6,8)`: Oxygen cache mid-upper zone.
- Rows y=10–16: SoftRock zone.
- `M` at `(3,12)`: Second mineral cluster.
- `Q` at `(12,13)`: First quiz gate — gates access to lower zone. Uses a previously-seen fact (the one from the artifact at y=6).
- `Z Z Z` at `(3–5, 14–16)`: 3×3 UnstableGround cluster — **earthquake tutorial zone**. See earthquake scripting below.
- `.` at `(4,15)`: Pre-cleared space inside the unstable zone — draws the player into stepping on UnstableGround.
- `F` at `(7,15)`: FossilNode — guaranteed fossil. Must be adjacent to but not inside the UnstableGround cluster so the player encounters it after the earthquake.
- `U` at `(16,15)`: UpgradeCrate — contains a Scanner upgrade (guaranteed drop for tutorial).
- Rows y=17–18: Stone layer — intentionally hard, discourages mining further down. No DescentShaft in tutorial mine (this is a single-layer tutorial, no descent).
- **No hazards** (no LavaBlock, GasPocket) except the scripted UnstableGround cluster. Tutorial must not kill or overwhelm a new player.
- **No DescentShaft** — the tutorial mine ends at the Materializer, not at a descent shaft. ExitLadder is implicit (the mine ends after GAIA triggers the exit dialogue — see scripting below).

**Artifact specification** — `A` at `(9,6)`:
```typescript
{
  type: BlockType.ArtifactNode,
  hardness: 2,                    // Lower hardness than normal (4) for speed
  maxHardness: 2,
  revealed: false,
  content: {
    artifactRarity: 'rare',       // HARDCODED to 'rare' — not random
    factId: 'TUTORIAL_ARTIFACT_001',  // Hand-selected fact (see below)
  }
}
```

**Tutorial Artifact Fact** — `TUTORIAL_ARTIFACT_001`:

This fact must be added to the seed data. It should have a **wow-factor score of 10/10** and be broadly appealing regardless of interest selection. Suggested fact:

```json
{
  "id": "TUTORIAL_ARTIFACT_001",
  "type": "fact",
  "statement": "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid.",
  "wowFactor": "The ancient world wasn't one era — it spans 2,500 years. Cleopatra (69 BC) was 2,500 years after the pyramids (2560 BC) but only 2,000 years before 1969.",
  "explanation": "The Great Pyramid of Giza was completed around 2560 BC. Cleopatra ruled Egypt around 51–30 BC — roughly 2,500 years later. The Moon landing was 1969 AD, only about 2,000 years after Cleopatra. This collapses our mental model of 'ancient history' as a single era.",
  "gaiaComment": "I've run this calculation 847 times and it still breaks my probability estimates. Time is deeply unintuitive. Even for an AI.",
  "quizQuestion": "Which is true about the timeline of ancient history?",
  "correctAnswer": "Cleopatra lived closer in time to the Moon landing than to the pyramids",
  "distractors": [
    "The pyramids were built during Cleopatra's reign",
    "Cleopatra lived at the same time as Julius Caesar's grandfather",
    "The pyramids are the oldest human structures by 10,000 years"
  ],
  "category": ["History"],
  "rarity": "rare",
  "difficulty": 2,
  "funScore": 10,
  "ageRating": "kid",
  "sourceName": "Common historical timeline analysis"
}
```

Add this to `src/data/seed/tutorial.json` (new file). Ensure `scripts/build-facts-db.mjs` picks up this seed file.

### Earthquake Tutorial Scripting

When the player **steps onto any UnstableGround cell** (`Z`) in the tutorial mine for the first time:

1. GAIA toast appears immediately (before any damage): *"WARNING — I'm detecting ground instability. This is called an EARTHQUAKE ZONE. Watch for the screen to shake — that's your warning. Move away before the collapse."*
2. Wait 2 player ticks (moves) — no collapse during this warning.
3. Screen shake begins (existing earthquake animation).
4. GAIA toast: *"There it is. Move. Now."*
5. If player moves off the UnstableGround within 3 ticks: no damage. GAIA: *"Good. Earthquakes give you warning moves to escape. Remember that."*
6. If player stays on UnstableGround after 3 ticks: collapse occurs normally, but damage is halved for this tutorial instance. GAIA: *"Ouch. Earthquakes give you warning moves — use them next time."*

This scripting requires a flag `tutorialEarthquakeTriggered: boolean` in the tutorial mine state (not in `PlayerSave` — just local to the tutorial mine session). Check this flag in `GameManager.ts` or a new `TutorialManager.ts` before processing earthquake damage.

The FossilNode at `(7,15)` is accessible **without** stepping on UnstableGround — the player can mine around it. This ensures the fossil is findable even if the player is cautious.

### `generateTutorialMine()` Function

Add this function to `src/game/systems/MineGenerator.ts`:

```typescript
/**
 * Returns a fully hand-authored tutorial mine grid.
 * The layout is deterministic — no seeded RNG is used.
 * All special block positions are exact and documented in PHASE-14-ONBOARDING-TUTORIAL.md.
 */
export function generateTutorialMine(): { grid: MineCell[][], spawnX: number, spawnY: number } {
  const WIDTH = 20
  const HEIGHT = 20
  // Build a 20×20 grid of Dirt by default
  const grid: MineCell[][] = Array.from({ length: HEIGHT }, () =>
    Array.from({ length: WIDTH }, () => ({
      type: BlockType.Dirt,
      hardness: BALANCE.HARDNESS_DIRT,
      maxHardness: BALANCE.HARDNESS_DIRT,
      revealed: false,
    }))
  )

  // Helper: set a specific cell
  function set(x: number, y: number, type: BlockType, hardness: number, content?: MineCellContent) {
    grid[y][x] = { type, hardness, maxHardness: hardness, revealed: false, content }
  }

  // Border: Unbreakable
  for (let x = 0; x < WIDTH; x++) {
    set(x, 0, BlockType.Unbreakable, 999)
    set(x, HEIGHT - 1, BlockType.Unbreakable, 999)
  }
  for (let y = 0; y < HEIGHT; y++) {
    set(0, y, BlockType.Unbreakable, 999)
    set(WIDTH - 1, y, BlockType.Unbreakable, 999)
  }

  // Spawn area (y=1–2): Empty
  for (let x = 1; x < WIDTH - 1; x++) {
    set(x, 1, BlockType.Empty, 0)
    set(x, 2, BlockType.Empty, 0)
  }

  // Rows y=10–16: SoftRock base
  for (let y = 10; y <= 16; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      set(x, y, BlockType.SoftRock, BALANCE.HARDNESS_SOFT_ROCK)
    }
  }

  // Rows y=17–18: Stone
  for (let y = 17; y <= 18; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      set(x, y, BlockType.Stone, BALANCE.HARDNESS_STONE)
    }
  }

  // Special blocks (dirt zone)
  set(3, 5, BlockType.MineralNode, BALANCE.HARDNESS_MINERAL_NODE, { mineralType: 'dust', mineralAmount: 12 })
  set(17, 5, BlockType.MineralNode, BALANCE.HARDNESS_MINERAL_NODE, { mineralType: 'dust', mineralAmount: 10 })
  set(9, 6, BlockType.ArtifactNode, 2, { artifactRarity: 'rare', factId: 'TUTORIAL_ARTIFACT_001' })
  set(6, 8, BlockType.OxygenCache, 2, { oxygenAmount: 30 })

  // Special blocks (soft rock zone)
  set(3, 12, BlockType.MineralNode, BALANCE.HARDNESS_MINERAL_NODE, { mineralType: 'dust', mineralAmount: 15 })
  set(12, 13, BlockType.QuizGate, BALANCE.HARDNESS_QUIZ_GATE, { factId: 'TUTORIAL_ARTIFACT_001' })

  // Earthquake tutorial zone: 3×3 UnstableGround at (3–5, 14–16)
  for (let dy = 0; dy < 3; dy++) {
    for (let dx = 0; dx < 3; dx++) {
      set(3 + dx, 14 + dy, BlockType.UnstableGround, 1)
    }
  }
  // Pre-cleared cell inside (draws player in)
  set(4, 15, BlockType.Empty, 0)

  // Fossil node (accessible without touching UnstableGround)
  set(7, 15, BlockType.FossilNode, 2)

  // Upgrade crate (scanner upgrade)
  set(16, 15, BlockType.UpgradeCrate, 2)

  return { grid, spawnX: 10, spawnY: 1 }
}
```

### Where

- `src/game/systems/MineGenerator.ts` — add `generateTutorialMine()` export
- `src/data/seed/tutorial.json` — **new file** — contains `TUTORIAL_ARTIFACT_001` fact
- `scripts/build-facts-db.mjs` — ensure it reads `src/data/seed/tutorial.json`
- `src/game/GameManager.ts` — detect tutorial mine state; wire earthquake tutorial scripting; wire 0% loot loss for first oxygen depletion
- `src/game/managers/GaiaManager.ts` — add tutorial dialogue lines for earthquake, artifact reveal, fossil find
- `src/ui/components/GaiaToast.svelte` — verify it can display long tutorial messages (may need line-wrap fix)
- `src/game/MineScene.ts` — call `generateTutorialMine()` instead of `generateMine()` when `!playerSave.tutorialComplete`

### How

**Step 1: Add `generateTutorialMine()` to `MineGenerator.ts`** using the specification above.

**Step 2: Add tutorial fact to seed data.** Create `src/data/seed/tutorial.json`:
```json
[
  {
    "id": "TUTORIAL_ARTIFACT_001",
    "type": "fact",
    "statement": "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid.",
    "wowFactor": "The ancient world wasn't one era — it spans 2,500 years. Cleopatra (69 BC) was 2,500 years after the pyramids (2560 BC) but only 2,000 years before 1969.",
    "explanation": "The Great Pyramid was completed around 2560 BC. Cleopatra ruled Egypt around 51–30 BC. The Moon landing was 1969 AD. Cleopatra is ~2,500 years from the pyramids but only ~2,000 years from the Moon landing.",
    "gaiaComment": "I've run this calculation 847 times and it still breaks my probability estimates. Time is deeply unintuitive. Even for an AI.",
    "quizQuestion": "Which is true about the timeline of ancient history?",
    "correctAnswer": "Cleopatra lived closer in time to the Moon landing than to the pyramids",
    "distractors": [
      "The pyramids were built during Cleopatra's reign",
      "Cleopatra lived before most ancient Greek philosophers",
      "The pyramids are the oldest human structures by 10,000 years"
    ],
    "category": ["History"],
    "rarity": "rare",
    "difficulty": 2,
    "funScore": 10,
    "ageRating": "kid",
    "sourceName": "Standard historical timeline"
  }
]
```

**Step 3: Update `build-facts-db.mjs`** to also read `src/data/seed/tutorial.json` and merge its facts into the database.

**Step 4: Update `MineScene.ts`** (the Phaser scene that creates the mine grid). In the `create()` method, check:
```typescript
const save = get(playerSave)
if (save && !save.tutorialComplete) {
  const { grid, spawnX, spawnY } = generateTutorialMine()
  // use this grid instead of generateMine(...)
}
```

**Step 5: Implement 0% loot loss for first oxygen depletion.** In `GameManager.ts`, in the oxygen depletion handler, add:
```typescript
const save = get(playerSave)
const isFirstDepletion = save && save.diveCount === 0 && !save.tutorialComplete
if (isFirstDepletion) {
  // 0% loot loss — GAIA rescues player
  // Show GAIA toast: "Emergency oxygen protocol activated. You won't lose anything this time. Learn the Send-Up Stations for next time."
  lootLossPercent = 0
}
```

**Step 6: Implement earthquake tutorial scripting.** In `GameManager.ts`, add a module-level `let tutorialEarthquakeShown = false` flag. In the `UnstableGround` step handler (wherever earthquake triggering logic lives), add:
```typescript
if (!save.tutorialComplete && !tutorialEarthquakeShown) {
  tutorialEarthquakeShown = true
  // Show GAIA toast: warning message (line 1)
  // Set a 2-tick delay before normal collapse logic runs
  // After 2 ticks: show screen shake + GAIA second message
  // After 3 more ticks: apply damage if still on cell
}
```

**Step 7: Add GAIA tutorial dialogue lines to `GaiaManager.ts`.**

Add a new method `tutorialGaiaLine(key: TutorialGaiaKey): string` that returns the scripted lines for:
- `'artifact_found'` — triggered when player mines the tutorial artifact node
- `'fossil_found'` — triggered when player mines the fossil node
- `'quiz_gate_first'` — triggered when player first encounters the quiz gate
- `'earthquake_warning'` — triggered when player steps on UnstableGround (first time)
- `'earthquake_after_safe'` — triggered after player safely escapes earthquake zone
- `'earthquake_after_hurt'` — triggered after player is hit by collapse
- `'oxygen_low_first'` — triggered when oxygen drops below 30% for first time

Exact strings:

```typescript
const TUTORIAL_GAIA_LINES: Record<string, string> = {
  artifact_found: "An artifact! Quick — bring it back to my terminal at the dome. I need to analyze it.",
  fossil_found: "Wait. That's a fossil node. Something is preserved in there. Intact. This is... this is significant. Collect it. Carefully.",
  quiz_gate_first: "A Quiz Gate. I've locked this area with a knowledge challenge. Answer correctly to pass. Wrong answers cost oxygen — so think before you tap.",
  earthquake_warning: "WARNING — ground instability detected. This is an EARTHQUAKE ZONE. When you feel the screen shake — that's your warning. Move away before the collapse. You have moves to react. Use them.",
  earthquake_after_safe: "Good instincts. Earthquakes always give you warning moves. Remember: count your steps, don't panic.",
  earthquake_after_hurt: "Earthquakes give you warning moves to escape. You'll need to use them next time. The deeper you go, the more frequent they become.",
  oxygen_low_first: "Oxygen at 30%. Time to consider heading back. The exit ladder is always available — surface before you're forced to.",
}
```

**Step 8: Wire tutorial completion.** After the tutorial mine ends (player surfaces), set `playerSave.tutorialComplete = true`, `playerSave.diveCount = 1`, call `persistPlayer()`. Then show the `DiveResults` screen normally, but append a GAIA narration line: *"That was your first dive. Bring those artifacts to my terminal — let's see what we've got."*

After `DiveResults`, route to `'base'` (BaseView / Dome) as normal.

### Acceptance Criteria

- [ ] `generateTutorialMine()` produces a 20×20 grid matching the layout specification exactly
- [ ] Player spawns at `(10, 1)`
- [ ] Artifact at `(9, 6)` has `rarity: 'rare'` and `factId: 'TUTORIAL_ARTIFACT_001'` hardcoded
- [ ] First artifact reveal fires within 90 seconds of entering the mine (validate with Playwright timing)
- [ ] Earthquake tutorial fires when player first steps on UnstableGround, with exact GAIA dialogue
- [ ] FossilNode at `(7, 15)` is reachable without stepping on UnstableGround
- [ ] UpgradeCrate at `(16, 15)` drops Scanner upgrade
- [ ] First oxygen depletion results in 0% loot loss with GAIA rescue message
- [ ] `TUTORIAL_ARTIFACT_001` appears in the built facts database
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes

### Playwright Test

```js
// Write to /tmp/test-tutorial-mine.js and run: node /tmp/test-tutorial-mine.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // Fresh start
  await page.goto('http://localhost:5173')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(2000)

  // Skip cutscene
  const skipBtn = await page.$('.skip-btn')
  if (skipBtn) await skipBtn.click()
  await page.waitForTimeout(500)

  // Select Generalist and continue
  const generalistBtn = await page.$('button:has-text("Generalist")')
  if (generalistBtn) await generalistBtn.click()
  await page.waitForTimeout(300)
  const continueBtn = await page.$('button:has-text("Continue")')
  if (continueBtn) await continueBtn.click()
  await page.waitForTimeout(1000)

  // Select age
  const teenBtn = await page.$('button:has-text("TEEN")')
  if (teenBtn) await teenBtn.click()
  await page.waitForTimeout(1000)

  // Should now be in tutorial mine — take screenshot
  await page.screenshot({ path: '/tmp/ss-tutorial-mine-start.png' })
  const startTime = Date.now()

  // Mine toward artifact at (9,6) — player is at (10,1)
  // Need to mine downward through y=3,4,5,6 rows
  // Simulate taps on blocks below/around spawn
  // This is approximate — actual tapping depends on MineScene canvas layout
  // Check artifact reveal fires within 90 seconds
  await page.waitForTimeout(90000) // Wait max 90s
  await page.screenshot({ path: '/tmp/ss-tutorial-mine-90s.png' })

  const elapsed = (Date.now() - startTime) / 1000
  console.log(`Elapsed: ${elapsed}s`)

  await browser.close()
})()
```

Note: The Playwright test for the mine is difficult to automate fully because it requires simulating canvas taps on specific pixel coordinates. For the 90-second validation, use manual playtesting to confirm. The Playwright test above is for structural setup verification, not timing validation.

---

## Sub-Phase 14.5: Progressive Unlock Narration (Dives 2–4)

### What

Each of dives 2, 3, and 4 introduces exactly one new game system, announced by GAIA when the player returns to the dome after the dive. The introduction is a GAIA toast with a brief narration line, followed by a UI highlight (pulsing arrow or glow effect) pointing at the new feature.

**Dive 2 — Knowledge Tree:**
- GAIA toast on dome arrival: *"Your first fact is in my database now. Come — I want to show you the Knowledge Tree. It grows every time you learn something new."*
- Highlight: Knowledge Tree button / Knowledge Tree room glows with a pulsing cyan ring
- Player taps the Knowledge Tree → a brief 3-panel UI walkthrough explains what it is (can be dismissed)

**Dive 3 — Study Session / GAIA Codex:**
- GAIA toast on dome arrival: *"You have [N] facts in rotation. Some of them are due for review. The study session will help you lock them in — and remember, every review earns you bonus oxygen."*
- Highlight: Study Session button glows
- Player taps Study → session begins normally

**Dive 4 — Crafting (Materializer):**
- GAIA toast on dome arrival: *"I found a recipe fragment in your last dive. The Materializer can combine your minerals into something more powerful. Let me show you."*
- Highlight: Materializer button glows
- Player taps Materializer → enters normally

### Where

- `src/game/managers/GaiaManager.ts` — add `postDiveProgressiveUnlock(diveCount: number): string | null` method
- `src/ui/components/DomeView.svelte` — trigger GAIA toast on arriving at dome with progressive unlock message
- `src/ui/components/BaseView.svelte` or the relevant room component — add `pulsing` CSS class to highlighted button, applied for 30 seconds after the unlock message
- `src/ui/stores/playerData.ts` — `diveCount` field on `PlayerSave` drives which unlock fires

### How

**Step 1: Increment `diveCount` on every dive completion.** In the post-dive flow in `GameManager.ts` (wherever `DiveResults` is populated), add:
```typescript
playerSave.update(s => s ? { ...s, diveCount: s.diveCount + 1 } : s)
```

**Step 2: Add `postDiveProgressiveUnlock()` to `GaiaManager.ts`.**

```typescript
/**
 * Returns a GAIA narration line for progressive system unlocks, or null if no unlock fires.
 * Called once per dive completion, keyed on diveCount (the count AFTER the completed dive).
 */
postDiveProgressiveUnlock(diveCount: number): { message: string; highlightTarget: string } | null {
  switch (diveCount) {
    case 2:
      return {
        message: "Your first fact is in my database now. Come — I want to show you the Knowledge Tree. It grows every time you learn something new.",
        highlightTarget: 'knowledgeTree',
      }
    case 3:
      return {
        message: "You have facts in rotation now. Some are due for review. The study session will help you lock them in — and every review earns you bonus oxygen.",
        highlightTarget: 'studySession',
      }
    case 4:
      return {
        message: "I found a recipe fragment in your last dive. The Materializer can combine your minerals into something more powerful. Let me show you.",
        highlightTarget: 'materializer',
      }
    default:
      return null
  }
}
```

**Step 3: Fire the unlock in `DomeView.svelte`.** After the dive results are dismissed and the dome is shown, call `gaiaManager.postDiveProgressiveUnlock(diveCount)`. If non-null, show the toast and set a reactive `$state` variable `highlightedFeature` to the `highlightTarget` string. Pass `highlightedFeature` as a prop to `BaseView.svelte`. After 30 seconds, clear it.

**Step 4: Add pulsing highlight CSS to the appropriate room components.** In each room sub-component (`CommandRoom.svelte`, `LabRoom.svelte`, `WorkshopRoom.svelte`), accept an `isHighlighted: boolean` prop. When true, add class `feature-highlight` to the relevant button, which applies:
```css
.feature-highlight {
  animation: pulse-glow 1.5s ease-in-out infinite;
  box-shadow: 0 0 12px 4px rgba(0, 200, 255, 0.7);
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 8px 2px rgba(0, 200, 255, 0.5); }
  50% { box-shadow: 0 0 20px 8px rgba(0, 200, 255, 0.9); }
}
```

### Acceptance Criteria

- [ ] `diveCount` is correctly incremented on every post-dive flow
- [ ] Dive 2 arrival shows Knowledge Tree toast and pulsing highlight
- [ ] Dive 3 arrival shows Study Session toast and pulsing highlight
- [ ] Dive 4 arrival shows Materializer toast and pulsing highlight
- [ ] Dive 5+ arrival shows no unlock toast (returns null)
- [ ] Highlight disappears after 30 seconds or after player taps the highlighted feature
- [ ] GAIA toast messages match the specified strings exactly
- [ ] `npm run typecheck` passes

---

## Sub-Phase 14.6: Early Reward Front-Loading (Dives 1–5)

### What

Define and implement the exact reward schedule for a new player's first five dives. Every milestone is guaranteed by design — not left to procedural luck. This reduces early churn by ensuring players feel progression before session 3 (the critical drop-off window per DD-V2-156).

**Reward Schedule:**

| Dive | Guaranteed reward | How guaranteed | GAIA moment |
|---|---|---|---|
| 1 | Rare+ artifact reveal (Cleopatra fact) | Hardcoded in tutorial mine | "Finally! Feed me data!" |
| 1 | Fossil fragment found | FossilNode at `(7,15)` in tutorial mine | "Something is preserved in there..." |
| 2 | First fossil identified (GAIA names creature) | Fossil analysis forced after dive 2 if fragment in inventory | "This is... a trilobite. 520 million years old. We could bring it back." |
| 2 | Knowledge Tree seed shown | Progressive unlock narration (14.5) | "Come see what you've built." |
| 3 | Study session bonus oxygen | Progressive unlock narration (14.5) | Earns 15 bonus oxygen for completing first study |
| 4 | Starter companion selection | After dive 4, companion selection screen unlocked from a pool of 3 | "You've proven yourself. A creature wants to accompany you." |
| 5 | First dome room unlocks | After dive 5, Farm floor unlocks with fanfare animation | "The farm is ready. Something's growing up here." |

### Where

- `src/game/GameManager.ts` — reward trigger logic
- `src/ui/components/DiveResults.svelte` — add first-fossil GAIA moment for dive 2
- `src/ui/components/FossilGallery.svelte` — wire forced fossil analysis after dive 2
- `src/ui/components/DomeView.svelte` — room unlock fanfare for dive 5
- `src/ui/components/GaiaToast.svelte` — all GAIA moment toasts
- `src/game/managers/GaiaManager.ts` — reward-specific GAIA dialogue pool

### How

**Step 1: Fossil identification after dive 2.**

In the post-dive flow for dive 2 (`diveCount === 2`), check if `playerSave.fossilFragments.length > 0` (or whatever field FossilNode drops to). If yes, trigger a forced fossil analysis dialogue:

In `GaiaManager.ts`, add:
```typescript
fossilFirstReveal(): string {
  return "Wait. I'm analyzing the fossil fragment you brought back. This is... a trilobite. Arthropod. 520 million years old. They dominated the seas for 270 million years before the extinction event. We have enough genetic data to start reconstruction. Learn 10 facts about the Cambrian period and I can bring it back to life."
}
```

Show this as a full-screen `GaiaToast` with extended display time (8 seconds, dismissable by tap). Set a `PlayerSave.activeFossil: string` field to the creature name.

**Step 2: Companion selection after dive 4.**

After dive 4 (`diveCount === 4`), show a special `CompanionSelectOverlay.svelte` (new component or reuse `DivePrepScreen.svelte` companion section). Show 3 starter companions chosen from the fossil pool:
1. Trilobite (already in progress — highlight it as partially revived)
2. Ancient Bird (starter companion, fire affinity)
3. Crystal Lizard (starter companion, mineral detection)

GAIA narration: *"You've proven yourself. These creatures recognize a skilled excavator. Choose one to accompany you."*

The companion selection is permanent (can be changed later from the dome). Store in `PlayerSave.selectedCompanion: string`.

This requires `CompanionSelectOverlay.svelte` to be created, or the existing `DivePrepScreen.svelte` companion selection to be surfaced without requiring a dive to start.

**Step 3: Dome room unlock fanfare after dive 5.**

After dive 5 (`diveCount === 5`), before routing to BaseView:
1. Show a full-screen celebration overlay (`RoomUnlockCelebration.svelte` — new component):
   - Dark background with a burst of golden pixel art particles
   - Center text: "FARM UNLOCKED"
   - GAIA avatar with excited expression
   - GAIA line: *"The hydroponic bay is online. Something's already growing up there. Come see."*
2. After 3 seconds (or tap to dismiss), route normally to BaseView.
3. In `BaseView.svelte`, ensure the Farm room tab is visible for `diveCount >= 5`.

The farm room unlock threshold was previously defined as "~5 dives" in `GAME_DESIGN.md`. This hardcodes it to exactly 5 for tutorial players. The existing room unlock logic may need to read `diveCount` rather than a separate `unlockedRooms` flag — verify in `BaseView.svelte`.

**Step 4: Study session bonus oxygen for first completion.**

In `StudyManager.ts`, add a check: if `playerSave.diveCount <= 3` and `playerSave.studySessionsCompleted === 0` (add this field), award 15 bonus oxygen to the player's daily pool (`playerSave.oxygenTanks += 1` or equivalent). Show a GAIA toast: *"Nice work. First study session complete. Here's 15 extra oxygen — consider it a scholarship."*

Increment `studySessionsCompleted` after this to prevent double-awarding.

### Acceptance Criteria

- [ ] Dive 1: Rare artifact reveal guaranteed (Cleopatra fact, rarity: 'rare')
- [ ] Dive 1: FossilNode accessible in tutorial mine layout
- [ ] Dive 2: Fossil identification GAIA moment fires if fossil fragment in inventory
- [ ] Dive 2: `activeFossil` written to `PlayerSave`
- [ ] Dive 3: Study session bonus oxygen awarded on first completion (15 O2 / 1 tank)
- [ ] Dive 4: Companion selection overlay appears after dive results
- [ ] Dive 5: Farm room unlock celebration fires before BaseView load
- [ ] All GAIA dialogue strings match specification
- [ ] Farm room tab is visible in BaseView after `diveCount >= 5`
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes

---

## Verification Gate

Run all of these before considering Phase 14 complete:

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — successful production build
- [ ] `scripts/build-facts-db.mjs` runs without errors and `TUTORIAL_ARTIFACT_001` appears in the built database
- [ ] Tutorial mine plays from start to finish: cutscene → GAIA intro → age selection → mine → dive results → dome
- [ ] 90-second hook moment: time the artifact reveal manually in a fresh playthrough. It must occur within 90 seconds of entering the mine
- [ ] Skip button works from cutscene panel 1 (verified with Playwright)
- [ ] Interest selection saves correctly to `PlayerSave.selectedInterests` in localStorage
- [ ] Age selection saves correctly to `PlayerSave.ageRating` in localStorage
- [ ] Progressive unlocks fire on correct dives (2, 3, 4) with correct GAIA lines
- [ ] No progressive unlock toast fires on dives 5+ (only reward events)
- [ ] Earthquake tutorial fires on first UnstableGround contact with correct GAIA lines
- [ ] 0% loot loss on first oxygen depletion (GAIA rescue message appears)
- [ ] Fossil identification GAIA moment fires after dive 2 if fossil fragment collected in dive 1
- [ ] Farm room unlock celebration fires after dive 5
- [ ] Second launch (after `tutorialComplete: true`) skips cutscene and goes directly to dome
- [ ] `npm run typecheck` passes again after all implementation is done (re-verify)

---

## Files Affected (Complete List)

### New Files to Create

| File | Purpose |
|---|---|
| `src/ui/components/CutscenePanel.svelte` | Single cutscene panel renderer |
| `src/ui/components/OnboardingCutscene.svelte` | 5-panel cutscene orchestrator |
| `src/ui/components/GaiaIntro.svelte` | GAIA introduction + interest selection |
| `src/ui/components/AgeSelection.svelte` | Age tier selection screen |
| `src/ui/components/RoomUnlockCelebration.svelte` | Dive 5 dome room unlock fanfare overlay |
| `src/data/seed/tutorial.json` | Contains `TUTORIAL_ARTIFACT_001` fact |
| `public/cutscene/panel_01.png` through `panel_05.png` | Cutscene panel images (generate via ComfyUI) |

### Existing Files to Modify

| File | Changes |
|---|---|
| `src/data/types.ts` | Add to `PlayerSave`: `tutorialComplete`, `selectedInterests`, `interestWeights`, `diveCount`, `tutorialStep`, `activeFossil`, `studySessionsCompleted` |
| `src/services/saveService.ts` | Initialize new `PlayerSave` fields in `createNewPlayer()` |
| `src/ui/stores/gameState.ts` | Add `'cutscene'`, `'onboarding'`, `'interestSelection'`, `'ageSelection'`, `'tutorialMine'` to `Screen` type |
| `src/ui/stores/playerData.ts` | `initPlayer()` must handle new fields; add helpers for diveCount increment |
| `src/game/systems/MineGenerator.ts` | Add `generateTutorialMine()` export |
| `src/game/MineScene.ts` | Check `!tutorialComplete` and call `generateTutorialMine()` instead of `generateMine()` |
| `src/game/GameManager.ts` | Earthquake tutorial scripting; 0% first-depletion loot loss; diveCount increment; trigger post-dive reward checks |
| `src/game/managers/GaiaManager.ts` | Add tutorial dialogue lines; `postDiveProgressiveUnlock()`; `fossilFirstReveal()`; `tutorialGaiaLine()` |
| `src/game/managers/StudyManager.ts` | First-completion bonus oxygen with `studySessionsCompleted` guard |
| `src/ui/components/DomeView.svelte` | Post-dive progressive unlock toast trigger; `highlightedFeature` state |
| `src/ui/components/BaseView.svelte` | Accept `highlightedFeature` prop; pass to room sub-components; show Farm tab at `diveCount >= 5` |
| `src/ui/components/DiveResults.svelte` | Dive 2 fossil identification moment; tutorial-specific GAIA line |
| `src/ui/components/FossilGallery.svelte` | Forced fossil analysis for first fossil after dive 2 |
| `scripts/build-facts-db.mjs` | Read and include `src/data/seed/tutorial.json` |
| `src/App.svelte` | Route new screens: `cutscene`, `onboarding`, `ageSelection`, `tutorialMine`; detect first-run flow |

---

## Implementation Order (Recommended)

Because several pieces depend on each other, implement in this sequence:

1. **Types and save schema first** (`types.ts`, `saveService.ts`, `playerData.ts`) — everything else reads from `PlayerSave`
2. **`generateTutorialMine()`** in `MineGenerator.ts` — needed before any mine integration
3. **Seed data** (`tutorial.json`, `build-facts-db.mjs` update) — needed before any quiz/artifact fact lookup
4. **`App.svelte` routing** — add new screen types, wire first-run detection
5. **`OnboardingCutscene.svelte` + `CutscenePanel.svelte`** — first screen shown
6. **`GaiaIntro.svelte`** — interest selection
7. **`AgeSelection.svelte`** — age selection
8. **`MineScene.ts` tutorial mine integration** + **`GameManager.ts` tutorial scripting** — the actual mine experience
9. **`GaiaManager.ts` tutorial lines** — dialogue
10. **Progressive unlock narration** (`DomeView.svelte`, `BaseView.svelte`, room components)
11. **Early reward front-loading** (fossil identification, companion selection, room unlock fanfare)
12. **Typecheck + build** — final verification

At each step, run `npm run typecheck` to catch type errors before they compound.

---

## Design Decision Traceability

| Decision ID | Area | Implemented In |
|---|---|---|
| DD-V2-040 | Tutorial 5-minute total experience | Sub-phases 14.1–14.4; mine layout timed to 5 min |
| DD-V2-082 | Earthquake tutorial coverage | Sub-phase 14.4; `GameManager.ts` earthquake scripting |
| DD-V2-143 | 90-second hook moment | Sub-phase 14.4; artifact at `(9,6)` ~10 blocks from spawn |
| DD-V2-156 | Front-loaded rewards dives 1–5 | Sub-phase 14.6; complete reward schedule defined |
| DD-V2-156 | 0% loot loss first depletion | Sub-phase 14.4; `GameManager.ts` depletion handler |

---

## Notes for Sub-Agents Executing This Document

- Do NOT use `eval()`, `innerHTML` with dynamic content, or `Function()` — see `CLAUDE.md` security rules
- All new Svelte components use Svelte 5 runes syntax (`$props`, `$state`, `$effect`) — do NOT use Svelte 4 stores syntax in component scripts
- All new TypeScript must pass `strict: true` — no `any` types unless absolutely unavoidable (document why)
- The tutorial mine grid specification is authoritative — do not alter block positions without updating this document first
- The GAIA dialogue strings in this document are final — implement them verbatim; do not paraphrase
- ComfyUI image generation for cutscene panels follows the pipeline in `docs/SPRITE_PIPELINE.md`
- After completing any sub-phase, run `npm run typecheck` before moving to the next sub-phase
- After completing all sub-phases, run `npm run build` and verify zero errors before marking Phase 14 complete

---

## Sub-Phase 14.7: Intro Comic Panel Generation (DD-V2-269)

### What

Generate the 5 cutscene comic panels defined in Sub-Phase 14.1 as actual image assets using ComfyUI with SDXL. These panels use a different generation style than game sprites — more painterly, dramatic, narrative-focused — and are the player's first visual impression of the game. They must be emotionally compelling.

### Where

- **Output directory**: `public/cutscene/` (served as static assets, not bundled)
- **Files to generate**: `panel_01.png` through `panel_05.png`
- **Format**: PNG, 384×512 (final display size), generated at 1024×1024 then center-cropped

### ComfyUI Generation Specification

**Shared prompt prefix (all panels)**:
```
"pixel art comic panel, dramatic lighting, cinematic composition, narrative illustration, sci-fi post-apocalyptic, detailed background, clear focal subject, [PANEL_SPECIFIC], high quality pixel art, 16-bit aesthetic"
```

**Negative prompt (all panels)**:
```
"blurry, low quality, multiple subjects, cluttered, text, watermark, signature, modern realistic, 3d render"
```

**LoRA strength**: 0.7 (lower than game sprites' 0.9 — allows more painterly, illustrative output)

**Panel-specific prompt additions**:

| Panel | File | Scene | Prompt Addition |
|-------|------|-------|----------------|
| 1 | `panel_01.png` | Ship in space | `"battered research spacecraft against star field, brownish haze where Earth used to be blue, distant devastated planet, dramatic deep space, lonely"` |
| 2 | `panel_02.png` | Approaching Earth | `"cockpit interior view, warning lights flashing red, ochre desert and ancient ruins visible through windshield below, steep descent angle, tense atmosphere"` |
| 3 | `panel_03.png` | Crash | `"spacecraft buried nose-first in rocky desert soil, massive dust explosion cloud, debris arc through air, smoke, dramatic impact, devastation"` |
| 4 | `panel_04.png` | GAIA boots up | `"cracked terminal screen close-up, glowing cyan, pixelated AI face flickering to life, dark cockpit background, hopeful light in darkness, emergence"` |
| 5 | `panel_05.png` | The plan | `"wide establishing shot, buried spacecraft exterior, tiny miner figure standing at entry hatch, vast rocky desert landscape, sense of scale, determination"` |

**Required**: Panel 3 (crash explosion) and Panel 4 (GAIA flickering to life) must each have a clear dramatic lighting moment — bright flash source visible in the composition. These are the emotional anchors of the sequence.

### How

#### Step 1 — Submit ComfyUI jobs

For each panel, submit a ComfyUI API workflow with:
- `steps`: 35 (higher than sprite generation's 20 — more detail for narrative art)
- `cfg_scale`: 7.5
- `sampler`: `dpmpp_2m_karras`
- `width`: 1024, `height`: 1024
- `seed`: use deterministic seeds (panel index × 1000) for reproducibility

#### Step 2 — Post-process

For each generated 1024×1024 image:
1. **Do NOT apply rembg** — panels have full backgrounds (no transparency removal)
2. Center-crop to 768×1024 to get ~3:4 portrait ratio
3. Downscale to 384×512 using nearest-neighbor for pixel art crispness
4. Save to `public/cutscene/panel_0N.png`

#### Step 3 — Visual QC checklist (per panel)

- [ ] Panel 1: Star field visible, spacecraft clearly identifiable, planet visible with brownish haze
- [ ] Panel 2: Cockpit interior framing, warning lights present, landscape visible through windshield
- [ ] Panel 3: Crash impact readable at a glance, dramatic dust/debris, bright flash light source
- [ ] Panel 4: Terminal screen dominates composition, cyan glow, AI face visible, feels hopeful
- [ ] Panel 5: Scale communicated (tiny miner vs vast landscape), exterior ship buried, open sky

#### Step 4 — Consistency check

All 5 panels must share visual coherence: similar color temperature (warm amber/ochre desert + cold cyan tech), consistent pixel art rendering style, no panel that looks like it belongs in a different game.

If any panel fails QC, regenerate with the same seed ±100 until it passes.

### Acceptance Criteria

- [ ] All 5 PNG files exist at `public/cutscene/panel_01.png` through `panel_05.png`
- [ ] Each file is exactly 384×512 pixels, PNG format
- [ ] Panel 3 contains visible crash explosion/flash light source
- [ ] Panel 4 contains visible GAIA terminal glow effect
- [ ] All 5 panels share consistent visual style (color palette, pixel art aesthetic)
- [ ] `OnboardingCutscene.svelte` correctly loads and displays all 5 panels in sequence
- [ ] Skip button visible from first frame and functional

### Playwright Test

```js
// Write to /tmp/ss-14.7.js and run: node /tmp/ss-14.7.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173')
  // Force first-run state
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(2000)
  // Should be on cutscene screen
  await page.screenshot({ path: '/tmp/ss-14.7-panel1.png' })
  // Advance to panel 2
  await page.click('body')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-14.7-panel2.png' })
  // Advance to panel 3 (crash — should have bright flash)
  await page.click('body')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-14.7-panel3.png' })
  // Advance to panel 4 (GAIA — should have cyan glow)
  await page.click('body')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-14.7-panel4.png' })
  // Advance to panel 5
  await page.click('body')
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/ss-14.7-panel5.png' })
  await browser.close()
  console.log('Check /tmp/ss-14.7-panel1.png through panel5.png')
  console.log('Verify: consistent style, panel 3 has explosion, panel 4 has cyan glow')
})()
```

---

## Sub-Phase 14.8: Tutorial Biome Visual Language (DD-V2-238)

### What

Style the tutorial mine (Topsoil biome) to communicate "safe, explore freely" through visual language alone. Warm earth tones, rounded organic block shapes, high brightness, and absence of hazard particles must immediately contrast with deeper, more dangerous biomes a player will encounter later. This teaches depth = danger intuitively, without text.

### Where

- **Modified**: `src/game/systems/MineGenerator.ts` — `generateTutorialMine()` uses `biomeId: 'topsoil'` and suppresses all hazard placement
- **New/Modified**: `src/data/biomes.ts` — ensure `topsoil` biome definition specifies warm palette, brightness multiplier, no hazard particle config
- **Modified**: `src/game/scenes/MineScene.ts` — when `currentBiome === 'topsoil'`, apply warm tint override and disable hazard particle emitters
- **Sprites** (verify exist or generate): tutorial block sprites must use amber/ochre/sage palette

### How

#### Step 1 — Topsoil biome definition

In `src/data/biomes.ts`, ensure the `topsoil` biome entry specifies:

```typescript
{
  id: 'topsoil',
  displayName: 'Topsoil',
  tier: 'shallow',
  depthRange: [1, 2],           // tutorial only
  palette: {
    primary: '#c8824a',          // amber-ochre
    secondary: '#8fb85c',        // sage green
    accent: '#e8c878',           // warm yellow highlight
    background: '#f5e4c0',       // pale warm sand
  },
  brightnessMultiplier: 1.3,    // noticeably brighter than default
  hazardParticles: false,        // NO lava spatter, NO gas cloud particles
  fogColor: 0xd4a870,           // warm amber fog of war
  ambientLight: 0xfff4e0,       // warm white ambient
  musicTrack: 'mine_topsoil',   // calm, hopeful melody
  blockVariants: ['topsoil_soft', 'topsoil_clay', 'topsoil_root'],
}
```

#### Step 2 — Block sprite requirements

Tutorial uses three block types. Verify these sprites exist; if not, generate via ComfyUI:

| Sprite key | File | Prompt |
|---|---|---|
| `topsoil_soft` | `src/assets/sprites/blocks/topsoil_soft.png` | `"pixel art soft earth block, warm amber-brown, rounded edges, no cracks, cheerful, 32x32 tile"` |
| `topsoil_clay` | `src/assets/sprites/blocks/topsoil_clay.png` | `"pixel art clay soil block, ochre orange, smooth texture, slightly lighter than dirt, 32x32 tile"` |
| `topsoil_root` | `src/assets/sprites/blocks/topsoil_root.png` | `"pixel art earth block with visible plant root, warm brown, organic, natural, 32x32 tile"` |

All generated at 1024×1024, rembg-processed, downscaled to 32px (and 256px for hires).

#### Step 3 — MineScene topsoil overrides

```typescript
// MineScene.applyBiomeOverrides()
if (this.currentBiome === 'topsoil') {
  // Warm ambient tint on camera
  this.cameras.main.setBackgroundColor('#f5e4c0')

  // Disable all hazard particle emitters
  this.lavaEmitter?.stop()
  this.gasEmitter?.stop()

  // Brighter tile brightness — apply postFX ColorMatrix if available
  // Alternatively: setTint(0xffe8c0) on the tile layer
  this.blockLayer?.setTint(0xffe8d8)
}
```

#### Step 4 — Contrast verification

After implementing topsoil, take screenshots of topsoil (tutorial mine) and a mid-depth biome (e.g., `volcanic_veins` or `crystal_caverns`). The visual contrast must be immediately apparent to a first-time player with no prior context.

Key visual differences that must be present:
- Topsoil: warm colors (amber, ochre, sage), bright, no ominous particles
- Deeper biome: cool or intense colors (blue-purple, red-orange), dimmer, hazard particles visible

### Acceptance Criteria

- [ ] `topsoil` biome entry in `biomes.ts` has warm palette, `brightnessMultiplier: 1.3`, `hazardParticles: false`
- [ ] Tutorial mine renders with amber/ochre/sage color scheme
- [ ] No lava spatter or gas cloud particles in tutorial mine
- [ ] Topsoil block sprites exist (32px and 256px variants)
- [ ] Screenshot contrast: topsoil vs mid-depth biome shows clear warm-vs-dangerous color difference
- [ ] `npm run typecheck` — zero errors

### Playwright Test

```js
// Write to /tmp/ss-14.8.js and run: node /tmp/ss-14.8.js
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

  // Force tutorial mine via DevPanel
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('debug:force-biome', { detail: 'topsoil' }))
  })

  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(500)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-14.8-topsoil.png' })

  await browser.close()
  console.log('Check /tmp/ss-14.8-topsoil.png — should be warm amber/ochre/sage, bright, no hazard particles')
})()
```
