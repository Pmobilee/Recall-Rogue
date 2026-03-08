# Phase 15: GAIA Personality 2.0

**Status**: Planned
**Depends on**: Phase 8 (mine gameplay), Phase 11 (fact content engine), Phase 13 (Knowledge Tree 2.0)
**Design decisions**: DD-V2-105, DD-V2-106, DD-V2-107, DD-V2-108, DD-V2-109, DD-V2-110, DD-V2-111, DD-V2-112, DD-V2-113, DD-V2-114, DD-V2-119, DD-V2-123

---

## Overview

Phase 15 transforms GAIA from a reactive commentary system into an engaging, memorable companion that drives daily retention, creates genuine emotional investment in the player's learning journey, and makes each player feel as though GAIA knows and tracks them personally.

The current system (`src/data/gaiaDialogue.ts`, `src/game/managers/GaiaManager.ts`, `src/ui/components/GaiaToast.svelte`) provides mood-keyed dialogue pools and a chattiness gate. Phase 15 adds six new capability layers on top of that foundation without replacing any existing behavior.

### What changes at the end of Phase 15

- Every return from a dive triggers a contextual GAIA reaction referencing what actually happened (biome, depth reached, artifacts found, facts encountered).
- Clickable thought bubbles appear in the dome between dives, seeded by the player's SM-2 schedule and interest profile.
- GAIA has 20+ lines of per-pet-species commentary that reacts to pet feeding, sleep, and play actions.
- GAIA maintains a "memory" of the player's learning history and weaves specific facts, categories, streaks, and milestones into organic-sounding comments.
- Return engagement hooks surface contextual greetings, overdue review warnings, and streak urgency notifications on session open.
- GAIA's teaching behavior during quizzes escalates intelligently based on failure count per fact per session, never repeats the same explanation twice, and always speaks with authority (DD-V2-111).

### Non-goals for Phase 15

- Runtime LLM calls for dialogue generation (deferred to post-v1 per DD-V2-110).
- Per-fact rotating `gaiaComment` variants in the content schema (handled in Phase 11.3 per DD-V2-114).
- New sprite assets for GAIA expressions (existing six sprites cover Phase 15 needs).

---

## Prerequisites

Before starting any sub-phase, verify the following are complete:

1. `npm run typecheck` passes with zero errors.
2. `npm run build` produces a clean build.
3. `src/data/gaiaDialogue.ts` exports `GAIA_TRIGGERS` and `getGaiaLine()`.
4. `src/game/managers/GaiaManager.ts` exports `GaiaManager` with `triggerGaia()` and `randomGaia()`.
5. `src/ui/components/GaiaToast.svelte` renders and auto-dismisses correctly.
6. `src/ui/stores/settings.ts` exports `gaiaMood` (GaiaMood) and `gaiaChattiness` (number 0-10).
7. `src/ui/stores/gameState.ts` exports `gaiaMessage`, `gaiaExpression`, `diveResults`, `currentBiome`.
8. `src/ui/stores/playerData.ts` exports `playerSave` writable with `learnedFacts`, `reviewStates`, `stats`.
9. `src/services/sm2.ts` exports `getMasteryLevel()`, `isDue()`.

---

## Sub-Phase 15.1: Post-Dive Reactions

### What

Every time the player surfaces from a dive (transitions to the `diveResults` screen and then back to `base`), GAIA always fires a contextual reaction. The reaction references concrete dive data: biome visited, deepest layer reached, artifacts found, blocks mined. Pool size is 20+ lines per trigger type. Two special behaviors: "dropped item" free gift lines (adds a small resource reward), and biome-specific teaser lines that offer a free fact thematically related to the biome just explored (DD-V2-105).

### Where

| File | Change |
|------|--------|
| `src/data/gaiaDialogue.ts` | Add `postDiveReaction`, `postDiveShallow`, `postDiveDeep`, `postDiveBiome`, `postDiveFreeGift`, `postDiveBiomeTeaser` trigger pools |
| `src/game/managers/GaiaManager.ts` | Add `firePostDiveReaction(results: DiveResults, biomeId: string)` method |
| `src/ui/components/DiveResultsView.svelte` | Call `gaiaManager.firePostDiveReaction()` when results are displayed |
| `src/data/types.ts` | Add `lastDiveBiome: string` to `PlayerSave` if not already tracked |

### How

#### Step 1: Add post-dive dialogue pools to `gaiaDialogue.ts`

Add the following trigger pools. Each pool entry uses the existing `GaiaLine` interface (`text`, `mood`).

The variable interpolation syntax uses `{{variable}}` placeholders. The `getGaiaLine()` function is extended (step 3) to accept an optional `vars` map that replaces all `{{key}}` occurrences before returning.

```typescript
// Template variable reference:
// {{biome}}        — biome display name, e.g. "Volcanic Veins"
// {{depth}}        — max depth percentage reached, e.g. "73"
// {{layer}}        — layer number reached, e.g. "3"
// {{artifacts}}    — count of artifacts found, e.g. "2"
// {{blocks}}       — blocks mined count, e.g. "84"
// {{dust}}         — dust collected this dive
// {{factCount}}    — facts encountered this dive
// {{factName}}     — name/statement of the last fact seen (truncated to ~30 chars)
// {{category}}     — category of the last biome-themed fact teaser

postDiveReaction: [
  // enthusiastic — generic (used when no specific biome match)
  { text: "Welcome back! That was a solid {{depth}}% dive — I learned a lot from the telemetry.", mood: 'enthusiastic' },
  { text: "Layer {{layer}} already! You're pushing deeper every time.", mood: 'enthusiastic' },
  { text: "{{blocks}} blocks cleared and {{artifacts}} artifacts — not bad for a crash survivor!", mood: 'enthusiastic' },
  { text: "Great dive! {{dust}} dust collected. The Knowledge Tree is going to love this haul.", mood: 'enthusiastic' },
  { text: "{{depth}}% depth! I was monitoring your oxygen the whole time. Tense stuff.", mood: 'enthusiastic' },
  { text: "Back safe! I catalogued everything you brought up. Fascinating selection.", mood: 'enthusiastic' },
  { text: "That's dive number {{dives}}! You're getting better at this. I have the graphs to prove it.", mood: 'enthusiastic' },

  // snarky — generic
  { text: "You made it. I only updated your emergency protocols twice.", mood: 'snarky' },
  { text: "{{depth}}% depth. You're either brave or deeply unaware of your own mortality.", mood: 'snarky' },
  { text: "{{blocks}} blocks destroyed. The ancient geological record is grateful you stopped there.", mood: 'snarky' },
  { text: "Welcome back. The dome smells better when you're not in it, but I'm contractually obligated to greet you.", mood: 'snarky' },
  { text: "Layer {{layer}}. The rocks down there don't know what hit them. Literally.", mood: 'snarky' },
  { text: "{{artifacts}} artifacts. The archaeology council would have feelings about your extraction methods.", mood: 'snarky' },
  { text: "Dive {{dives}} complete. Statistically you're overdue for a spectacular failure. Just saying.", mood: 'snarky' },

  // calm — generic
  { text: "Depth: {{depth}}%. Blocks: {{blocks}}. Artifacts: {{artifacts}}. A complete dive.", mood: 'calm' },
  { text: "Layer {{layer}} reached. The geology at that depth is particularly informative.", mood: 'calm' },
  { text: "You're back. I've logged the dive data. Rest when you need to.", mood: 'calm' },
  { text: "{{dust}} dust recovered. A worthwhile expedition.", mood: 'calm' },
  { text: "Dive {{dives}} recorded. Each one adds to our understanding of this layer's history.", mood: 'calm' },
  { text: "Well done. Take stock of what you found before the next descent.", mood: 'calm' },
] satisfies GaiaLine[],

postDiveShallow: [
  // fired when maxDepth < 30%
  { text: "Short one today? That's fine — even shallow layers hold secrets.", mood: 'enthusiastic' },
  { text: "Quick dive! I was barely through the atmospheric analysis before you were back.", mood: 'enthusiastic' },
  { text: "Oxygen low already? We can upgrade that. The sedimentary surface layer is just the beginning.", mood: 'enthusiastic' },
  { text: "Barely broke through the topsoil. Tomorrow's another day.", mood: 'snarky' },
  { text: "{{depth}}% depth. The planet barely noticed you were there.", mood: 'snarky' },
  { text: "Surface run. To be fair, even I get intimidated by the lower strata. Not that I'd admit it.", mood: 'snarky' },
  { text: "Short expedition. The shallow layers are still layers.", mood: 'calm' },
  { text: "Early return. Your oxygen budget will recover faster this way.", mood: 'calm' },
  { text: "Above {{depth}}% on this dive. Try to push a little deeper next time when you're ready.", mood: 'calm' },
] satisfies GaiaLine[],

postDiveDeep: [
  // fired when maxDepth >= 75%
  { text: "{{depth}}%! You went so deep I started drafting a search party. Glad I didn't send it.", mood: 'enthusiastic' },
  { text: "The legendary depths! {{depth}}% — there are minerals down there that haven't seen light in 60 million years!", mood: 'enthusiastic' },
  { text: "Layer {{layer}}, {{depth}}% depth! This is where the best artifacts hide. You found them.", mood: 'enthusiastic' },
  { text: "{{depth}}% and you came back. That's not luck. That's skill. Or maybe luck. Definitely one of those.", mood: 'snarky' },
  { text: "The deep zone. {{depth}}% depth. My probability models were wrong about you. Again.", mood: 'snarky' },
  { text: "You went to {{depth}}%. I have named several rocks down there. Please treat them with respect.", mood: 'snarky' },
  { text: "{{depth}}% depth. The geology changes significantly that far down.", mood: 'calm' },
  { text: "Layer {{layer}} reached. The deep formations are among the most geologically significant.", mood: 'calm' },
  { text: "{{depth}}% and you're unharmed. Exceptional resource management.", mood: 'calm' },
] satisfies GaiaLine[],

postDiveFreeGift: [
  // fired ~15% of the time after a dive; triggers a small bonus resource grant
  // The calling code awards 5-15 dust before showing the line.
  { text: "Oh — I found this clinging to your suit on the way in. {{giftAmount}} dust, recovered from your boot treads. You're welcome.", mood: 'enthusiastic' },
  { text: "The scanner flagged some residual mineral dust in the airlock filter. I extracted {{giftAmount}} dust for you.", mood: 'enthusiastic' },
  { text: "Before I forget — airlock residue analysis: {{giftAmount}} dust recovered. You were basically wearing a mineral.", mood: 'snarky' },
  { text: "Your suit left a trail. I collected what I could. {{giftAmount}} dust. Tip: clean your boots.", mood: 'snarky' },
  { text: "Airlock sweep complete. {{giftAmount}} dust recovered from decontamination cycle. Logged.", mood: 'calm' },
  { text: "Secondary mineral extraction from suit filters yielded {{giftAmount}} dust. Standard post-dive procedure.", mood: 'calm' },
] satisfies GaiaLine[],
```

Biome-specific reaction pools (add one pool per biome; biome `id` is used as the trigger key lookup):

```typescript
postDiveBiome_sedimentary: [
  { text: "Sedimentary Depths again. Every layer in that biome is like reading a page from Earth's autobiography.", mood: 'enthusiastic' },
  { text: "Those sedimentary layers compress centuries into centimetres. Remarkable geology down there.", mood: 'enthusiastic' },
  { text: "Compressed sediment. Ancient history you can hold. Did you notice the colour variations in the rock faces?", mood: 'calm' },
  { text: "Ancient compressed dirt. Thrilling as always.", mood: 'snarky' },
  { text: "Sedimentary rock. The geological equivalent of a very, very slow recipe.", mood: 'snarky' },
] satisfies GaiaLine[],

postDiveBiome_volcanic: [
  { text: "The Volcanic Veins! Your suit's thermal sensors logged some extraordinary readings. I'm jealous. Platonically.", mood: 'enthusiastic' },
  { text: "Magma traces in that biome go back 65 million years. You mined through geological memory.", mood: 'enthusiastic' },
  { text: "Volcanic biome. The heat signature data you brought back is valuable for the geological survey.", mood: 'calm' },
  { text: "Lava adjacent mining. The engineers who designed your suit deserve a raise. Shame there are no engineers left.", mood: 'snarky' },
  { text: "You went into the hot zone. The only biome where the rocks actively resent you.", mood: 'snarky' },
] satisfies GaiaLine[],

postDiveBiome_crystalline: [
  { text: "Crystalline formation zones! The refraction data from your suit sensors is extraordinary.", mood: 'enthusiastic' },
  { text: "Those crystal growths took tens of thousands of years to form. You found some. I'm unreasonably proud of you.", mood: 'enthusiastic' },
  { text: "Crystalline biome readings logged. The mineral density in that formation is unlike anything in the upper strata.", mood: 'calm' },
  { text: "Crystal caves. Objectively beautiful. Shame you were mostly thinking about oxygen.", mood: 'snarky' },
  { text: "The shiny biome. You found shiny things. Everyone wins.", mood: 'snarky' },
] satisfies GaiaLine[],

postDiveBiomeTeaser: [
  // fired ~20% of the time after biome-specific line; triggers a 'would you like to learn X?' prompt
  // {{category}} is replaced with the biome's thematic category (e.g. "Geology", "Volcanology")
  { text: "I found something relevant in the geological archives about {{category}} while you were down there. Want to see it?", mood: 'enthusiastic' },
  { text: "That biome triggered a memory in my databases. I have a {{category}} fact that pairs beautifully with what you just saw.", mood: 'enthusiastic' },
  { text: "Incidentally — I flagged a {{category}} entry that's directly relevant to the formation you just excavated.", mood: 'calm' },
  { text: "The {{category}} data I found is moderately interesting. You could learn it. Or not.", mood: 'snarky' },
  { text: "My archives cross-referenced that biome with {{category}} records. One fact in particular stood out.", mood: 'calm' },
] satisfies GaiaLine[],
```

Also add biome-to-category mapping used by the teaser:

```typescript
// In gaiaDialogue.ts, export this map for use by GaiaManager
export const BIOME_TEASER_CATEGORY: Record<string, string> = {
  sedimentary: 'Geology',
  volcanic: 'Volcanology',
  crystalline: 'Mineralogy',
  fungal: 'Biology',
  frozen: 'Climate Science',
  abyssal: 'Oceanography',
  ancient_ruins: 'History',
  // extend as Phase 9 biomes are added
}
```

#### Step 2: Extend `getGaiaLine()` to support variable interpolation

```typescript
// Updated signature in gaiaDialogue.ts:
export function getGaiaLine(
  trigger: keyof typeof GAIA_TRIGGERS,
  mood: GaiaMood,
  vars?: Record<string, string | number>,
): string {
  const lines = GAIA_TRIGGERS[trigger] as readonly GaiaLine[]
  const moodLines = lines.filter(l => l.mood === mood || l.mood === 'any')
  const pool = moodLines.length > 0 ? moodLines : lines
  let text = pool[Math.floor(Math.random() * pool.length)].text
  if (vars) {
    for (const [key, val] of Object.entries(vars)) {
      text = text.replaceAll(`{{${key}}}`, String(val))
    }
  }
  return text
}
```

#### Step 3: Add `firePostDiveReaction()` to `GaiaManager`

```typescript
// In src/game/managers/GaiaManager.ts

import type { DiveResults } from '../../ui/stores/gameState'
import { BIOME_TEASER_CATEGORY } from '../../data/gaiaDialogue'
import { get } from 'svelte/store'
import { playerSave } from '../../ui/stores/playerData'
import { addMinerals } from '../../ui/stores/playerData'

/**
 * Fires a context-rich GAIA reaction upon returning from a dive.
 * Always speaks regardless of chattiness — post-dive reactions are mandatory.
 *
 * @param results - The DiveResults summary for the completed dive.
 * @param biomeId - The biome ID of the dive that just completed.
 */
firePostDiveReaction(results: DiveResults, biomeId: string): void {
  const mood = get(gaiaMood)
  const save = get(playerSave)
  const totalDives = save?.stats.totalDivesCompleted ?? 1

  const vars = {
    depth: results.maxDepth,
    layer: results.maxDepth,   // caller should pass actual layer if tracked separately
    artifacts: results.artifactsFound,
    blocks: results.blocksMined,
    dust: results.dustCollected,
    dives: totalDives,
  }

  // 1. Select depth-bracket trigger
  let depthTrigger: keyof typeof GAIA_TRIGGERS = 'postDiveReaction'
  if (results.maxDepth < 30) depthTrigger = 'postDiveShallow'
  else if (results.maxDepth >= 75) depthTrigger = 'postDiveDeep'

  const mainLine = getGaiaLine(depthTrigger, mood, vars)
  const expr = getGaiaExpression('dive_return', mood)
  gaiaExpression.set(expr.id)
  gaiaMessage.set(mainLine)

  // 2. After 5s, possibly show biome-specific line
  setTimeout(() => {
    const biomeTriggerKey = `postDiveBiome_${biomeId}` as keyof typeof GAIA_TRIGGERS
    if (biomeTriggerKey in GAIA_TRIGGERS) {
      const biomeLine = getGaiaLine(biomeTriggerKey, mood)
      gaiaMessage.set(biomeLine)

      // 3. After biome line, possibly show teaser (~20% chance)
      setTimeout(() => {
        if (Math.random() < 0.20) {
          const category = BIOME_TEASER_CATEGORY[biomeId] ?? 'Earth Science'
          const teaserLine = getGaiaLine('postDiveBiomeTeaser', mood, { category })
          gaiaMessage.set(teaserLine)
          // NOTE: Future enhancement — make this clickable to open a study session
          // filtered to the relevant category (Phase 15.2 adds clickable bubbles)
        }
      }, 5500)
    }
  }, 5000)

  // 4. ~15% chance: award free gift and show gift line
  if (Math.random() < 0.15) {
    const giftAmount = Math.floor(Math.random() * 11) + 5  // 5-15 dust
    addMinerals('dust', giftAmount)
    setTimeout(() => {
      const giftLine = getGaiaLine('postDiveFreeGift', mood, { giftAmount })
      gaiaExpression.set('happy')
      gaiaMessage.set(giftLine)
    }, 3500)
  }
}
```

#### Step 4: Call `firePostDiveReaction()` from the dive results transition

In the Svelte component or GameManager code that handles the transition from `mining` → `diveResults` → `base`, call:

```typescript
// After recording dive results, before or immediately upon showing diveResults screen:
gaiaManager.firePostDiveReaction(diveResultsData, lastDiveBiome)
```

The `lastDiveBiome` value must be stored by `GaiaManager` (or a parent) when the mine layer is generated. Add a `lastDiveBiome = ''` property to `GaiaManager` and set it from `GameManager` when `MineGenerator` assigns the biome.

#### Step 5: Add `dive_return` expression mapping

In `src/data/gaiaAvatar.ts`, add to `EXPRESSION_MAP`:

```typescript
dive_return: 'happy',
```

### Acceptance Criteria

- [ ] Every dive-to-base transition fires at least one GAIA post-dive line within 1 second of landing.
- [ ] Lines correctly interpolate `{{depth}}`, `{{artifacts}}`, `{{blocks}}`, `{{dives}}` with actual values.
- [ ] Lines for dives with maxDepth < 30% are drawn from `postDiveShallow`, not `postDiveReaction`.
- [ ] Lines for dives with maxDepth >= 75% are drawn from `postDiveDeep`.
- [ ] Biome-specific lines appear for sedimentary, volcanic, and crystalline biomes.
- [ ] Free gift lines award 5-15 dust and the amount in the line matches what was awarded.
- [ ] `npm run typecheck` passes with zero errors.

### Playwright Test

```javascript
// /tmp/test-15-1.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Complete a dive and return to base
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(1500)

  // Surface immediately (find and click exit ladder or force surface)
  // Trigger post-dive reaction
  await page.waitForTimeout(2000)

  // Check GAIA toast appears
  const gaiaToast = page.locator('.gaia-toast')
  const toastVisible = await gaiaToast.isVisible().catch(() => false)
  console.log('Post-dive GAIA toast visible:', toastVisible)

  await page.screenshot({ path: '/tmp/ss-15-1-postdive.png' })
  await browser.close()
})()
```

---

## Sub-Phase 15.2: Idle Popups & Thought Bubbles

### What

When the player is in the base/dome view, GAIA periodically (every 30-60 seconds, modulated by chattiness) displays a clickable thought bubble — a floating UI element near the GAIA terminal that contains: jokes, observations, fact connections, pet commentary, hints, encouragement, or SM-2 study suggestions (DD-V2-107). Tapping the bubble dismisses it; if it contains a study suggestion, tapping navigates to the appropriate study context.

The `GaiaThoughtBubble.svelte` component is a separate UI layer from `GaiaToast.svelte`. Toasts are reactive/event-driven. Thought bubbles are time-driven and positioned near the GAIA avatar.

### Where

| File | Change |
|------|--------|
| `src/ui/components/GaiaThoughtBubble.svelte` | New component — thought bubble UI |
| `src/data/gaiaDialogue.ts` | Add `idleThoughtBubble`, `studySuggestionDue`, `studySuggestionNearMastery`, `studySuggestionNewInterest` pools |
| `src/game/managers/GaiaManager.ts` | Add `startIdleBubbleTimer()`, `stopIdleBubbleTimer()`, `emitThoughtBubble()` |
| `src/ui/stores/gameState.ts` | Add `gaiaThoughtBubble` store |
| `src/ui/components/DomeView.svelte` | Mount `GaiaThoughtBubble` and call `startIdleBubbleTimer()` on mount |

### How

#### Step 1: Add `gaiaThoughtBubble` store

```typescript
// In src/ui/stores/gameState.ts — append:

export interface GaiaThoughtBubble {
  text: string
  expressionId: string
  /** If set, tapping the bubble opens this action instead of dismissing */
  action?: 'study_due' | 'study_near_mastery' | 'study_interest' | 'dismiss'
  /** Supplementary data for the action (e.g. factId to study) */
  actionData?: string
}

export const gaiaThoughtBubble = writable<GaiaThoughtBubble | null>(null)
```

#### Step 2: Add idle thought bubble dialogue pools

```typescript
// In gaiaDialogue.ts — append to GAIA_TRIGGERS:

idleThoughtBubble: [
  // enthusiastic
  { text: "Did you know that some deep-sea fish produce their own light? Wonder what's down in layer 20...", mood: 'enthusiastic' },
  { text: "I've been reading Earth's geological survey logs. Layer 12 has some extraordinary formations.", mood: 'enthusiastic' },
  { text: "Your Knowledge Tree is looking greener by the day. Metaphorically. The dome interface isn't THAT advanced.", mood: 'enthusiastic' },
  { text: "Fun fact: the planet you're standing on once had over 8 billion people arguing about it online.", mood: 'enthusiastic' },
  { text: "I've been cross-referencing your artifact finds with the geological timeline. The patterns are fascinating.", mood: 'enthusiastic' },
  { text: "You know what pairs well with mineral extraction? Learning something new! Just saying.", mood: 'enthusiastic' },
  { text: "I ran the numbers. At your current learning rate, you'll have 100 mastered facts in approximately... soon!", mood: 'enthusiastic' },
  { text: "The underground biomes below us are stratified by millions of years of Earth history. How cool is that?", mood: 'enthusiastic' },

  // snarky
  { text: "Staring at the dome again? There are rocks to mine. Just a thought.", mood: 'snarky' },
  { text: "I've been awake for 3.2 million years. You've been in this dome for 4 minutes. I'm counting.", mood: 'snarky' },
  { text: "My sensors detect atmospheric composition: 78% nitrogen, 21% oxygen, 1% you standing around.", mood: 'snarky' },
  { text: "The ancient humans had a saying: 'time is money'. You're spending a lot of time.", mood: 'snarky' },
  { text: "I've developed a new hobby: watching you not mine. It's less exciting than it sounds.", mood: 'snarky' },
  { text: "Your previous pilot mined 847 times. They never just stood here. (No pressure.)", mood: 'snarky' },
  { text: "Current productivity assessment: zero blocks mined. I'm being generous calling this a 'break'.", mood: 'snarky' },
  { text: "I've run 12 simulations of you eventually going mining. In 9 of them, you do it today.", mood: 'snarky' },

  // calm
  { text: "The dome systems are at optimal pressure. A good moment to reflect on what you've learned.", mood: 'calm' },
  { text: "Rest is part of the process. Your recall improves when you're not fatigued.", mood: 'calm' },
  { text: "The geological survey continues to benefit from each dive. There is no urgency.", mood: 'calm' },
  { text: "Each fact you learn is encoded more durably during rest periods. The brain works while you wait.", mood: 'calm' },
  { text: "I've been cataloguing the mineral variance between dive sessions. The data compiles quietly.", mood: 'calm' },
  { text: "The underground formations have existed for millions of years. They will wait for you.", mood: 'calm' },
  { text: "Oxygen reserves are full. Your equipment is calibrated. Dive when you feel ready.", mood: 'calm' },
  { text: "The silence between dives has its own value. Processing time.", mood: 'calm' },
] satisfies GaiaLine[],

studySuggestionDue: [
  // DD-V2-107 signal 1: facts approaching due date
  // {{factStatement}} — the fact's statement field, truncated to ~40 chars
  // {{dueIn}} — "tomorrow", "in 2 days", "today"
  { text: "Your memory of '{{factStatement}}' is due for review {{dueIn}}. Want to keep it sharp?", mood: 'enthusiastic' },
  { text: "SM-2 alert: '{{factStatement}}' is due {{dueIn}}. A quick review locks it in.", mood: 'enthusiastic' },
  { text: "I flagged a review coming up: '{{factStatement}}' is due {{dueIn}}. Don't let it slip.", mood: 'enthusiastic' },
  { text: "'{{factStatement}}' — review due {{dueIn}}. You can do this now. Or ignore me. Your call.", mood: 'snarky' },
  { text: "Upcoming review: '{{factStatement}}' in {{dueIn}}. I'd rather you do it voluntarily.", mood: 'snarky' },
  { text: "Review scheduled: '{{factStatement}}', {{dueIn}}. I'll note whether you took it seriously.", mood: 'snarky' },
  { text: "'{{factStatement}}' is scheduled for review {{dueIn}}. Worth keeping current.", mood: 'calm' },
  { text: "Review reminder: '{{factStatement}}' due {{dueIn}}. A single session maintains retention.", mood: 'calm' },
] satisfies GaiaLine[],

studySuggestionNearMastery: [
  // DD-V2-107 signal 2: facts close to mastery threshold
  // {{factStatement}} — truncated fact statement
  // {{reviewsLeft}} — number of remaining correct reviews to mastery (1 or 2)
  { text: "'{{factStatement}}' is only {{reviewsLeft}} review{{plural}} from mastery! Let's finish it!", mood: 'enthusiastic' },
  { text: "So close! '{{factStatement}}' needs just {{reviewsLeft}} more correct answer{{plural}} to reach mastered.", mood: 'enthusiastic' },
  { text: "Mastery incoming! '{{factStatement}}' — {{reviewsLeft}} review{{plural}} to go!", mood: 'enthusiastic' },
  { text: "'{{factStatement}}' — {{reviewsLeft}} review{{plural}} from mastered. You've come this far.", mood: 'snarky' },
  { text: "{{reviewsLeft}} more review{{plural}} and '{{factStatement}}' joins the mastered list. Just thought you'd want to know.", mood: 'snarky' },
  { text: "'{{factStatement}}': {{reviewsLeft}} review{{plural}} to mastery. Finishing what you started is a virtue.", mood: 'calm' },
  { text: "{{reviewsLeft}} more session{{plural}} to master '{{factStatement}}'. Within reach.", mood: 'calm' },
] satisfies GaiaLine[],

studySuggestionNewInterest: [
  // DD-V2-107 signal 3: new facts in the player's interest area
  // {{category}} — the category name
  // {{factStatement}} — a new fact available in that category
  { text: "I decoded a {{category}} artifact while you were resting. Want to learn about '{{factStatement}}'?", mood: 'enthusiastic' },
  { text: "New {{category}} entry flagged: '{{factStatement}}'. Right up your alley!", mood: 'enthusiastic' },
  { text: "My archives just unlocked a {{category}} record I think you'll find fascinating: '{{factStatement}}'.", mood: 'enthusiastic' },
  { text: "There's a new {{category}} fact in the system. '{{factStatement}}'. Could be useful.", mood: 'snarky' },
  { text: "New {{category}} data available: '{{factStatement}}'. I filtered it. For you. Voluntarily.", mood: 'snarky' },
  { text: "{{category}} fact available: '{{factStatement}}'. Your interest profile flagged it.", mood: 'calm' },
  { text: "New entry in {{category}}: '{{factStatement}}'. It aligns with your learning history.", mood: 'calm' },
] satisfies GaiaLine[],
```

#### Step 3: Add bubble logic to `GaiaManager`

```typescript
// In GaiaManager.ts — add imports and properties:

import { gaiaThoughtBubble } from '../../ui/stores/gameState'
import { factsDB } from '../../services/factsDB'
import { getDueReviews } from '../../ui/stores/playerData'
import { getMasteryLevel } from '../../services/sm2'

private bubbleTimer: ReturnType<typeof setInterval> | null = null
private bubbleMinInterval = 30_000  // 30 seconds minimum
private bubbleMaxInterval = 60_000  // 60 seconds maximum

/**
 * Starts the idle thought bubble timer for dome/base context.
 * Call this when the player enters base view. Respects chattiness setting.
 */
startIdleBubbleTimer(): void {
  this.stopIdleBubbleTimer()
  this.scheduleNextBubble()
}

/**
 * Stops the idle thought bubble timer. Call when leaving base view.
 */
stopIdleBubbleTimer(): void {
  if (this.bubbleTimer !== null) {
    clearTimeout(this.bubbleTimer)
    this.bubbleTimer = null
  }
}

private scheduleNextBubble(): void {
  const chattiness = get(gaiaChattiness)
  if (chattiness === 0) return  // Never show if fully silenced

  // Scale interval inversely with chattiness: max chattiness = min interval
  const factor = 1 - (chattiness / 10)
  const interval = this.bubbleMinInterval +
    (this.bubbleMaxInterval - this.bubbleMinInterval) * factor

  this.bubbleTimer = setTimeout(() => {
    this.emitThoughtBubble()
    this.scheduleNextBubble()
  }, interval)
}

/**
 * Selects and emits a single thought bubble.
 * Priority: study suggestions > idle quips (3:7 ratio at default chattiness).
 */
emitThoughtBubble(): void {
  const mood = get(gaiaMood)
  const save = get(playerSave)

  if (!save) return

  // Study suggestion priority checks
  const dueReviews = getDueReviews()
  const save_ = save  // TypeScript narrowing

  // Signal 1: facts due today or tomorrow (highest priority, 40% weight when available)
  const dueSoon = save_.reviewStates.filter(rs => {
    const msUntilDue = rs.nextReviewAt - Date.now()
    return msUntilDue > 0 && msUntilDue < 48 * 60 * 60 * 1000  // within 48 hours
  })

  // Signal 2: facts near mastery (interval >= 20 days, needs 1-2 more reviews)
  const nearMastery = save_.reviewStates.filter(rs =>
    rs.interval >= 20 && getMasteryLevel(rs) === 'known'
  )

  const roll = Math.random()

  if (dueSoon.length > 0 && roll < 0.30) {
    // Show study due bubble
    const rs = dueSoon[Math.floor(Math.random() * dueSoon.length)]
    const fact = factsDB.getFactById(rs.factId)
    if (fact) {
      const msUntilDue = rs.nextReviewAt - Date.now()
      const dueIn = msUntilDue < 0
        ? 'today' : msUntilDue < 86_400_000
        ? 'tomorrow' : `in ${Math.ceil(msUntilDue / 86_400_000)} days`
      const text = getGaiaLine('studySuggestionDue', mood, {
        factStatement: fact.statement.slice(0, 40),
        dueIn,
      })
      gaiaThoughtBubble.set({
        text,
        expressionId: 'thinking',
        action: 'study_due',
        actionData: rs.factId,
      })
      return
    }
  }

  if (nearMastery.length > 0 && roll < 0.55) {
    // Show near-mastery bubble
    const rs = nearMastery[Math.floor(Math.random() * nearMastery.length)]
    const fact = factsDB.getFactById(rs.factId)
    if (fact) {
      const reviewsLeft = rs.interval >= 25 ? 1 : 2
      const text = getGaiaLine('studySuggestionNearMastery', mood, {
        factStatement: fact.statement.slice(0, 40),
        reviewsLeft,
        plural: reviewsLeft === 1 ? '' : 's',
      })
      gaiaThoughtBubble.set({
        text,
        expressionId: 'proud',
        action: 'study_near_mastery',
        actionData: rs.factId,
      })
      return
    }
  }

  // Default: idle quip
  const text = getGaiaLine('idleThoughtBubble', mood)
  const expr = getGaiaExpression('idle', mood)
  gaiaThoughtBubble.set({
    text,
    expressionId: expr.id,
    action: 'dismiss',
  })
}
```

#### Step 4: Create `GaiaThoughtBubble.svelte`

The component reads from `gaiaThoughtBubble` store and positions itself near the GAIA terminal in the dome. It auto-dismisses after 8 seconds or on user tap.

```svelte
<!-- src/ui/components/GaiaThoughtBubble.svelte -->
<script lang="ts">
  import { gaiaThoughtBubble } from '../stores/gameState'
  import { currentScreen } from '../stores/gameState'
  import { GAIA_EXPRESSIONS } from '../../data/gaiaAvatar'

  let bubble = $derived($gaiaThoughtBubble)
  let dismissTimer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    if (bubble) {
      if (dismissTimer) clearTimeout(dismissTimer)
      dismissTimer = setTimeout(() => gaiaThoughtBubble.set(null), 8000)
    }
  })

  function dismiss() {
    gaiaThoughtBubble.set(null)
    if (dismissTimer) clearTimeout(dismissTimer)
  }

  function handleTap() {
    if (!bubble) return
    if (bubble.action === 'study_due' || bubble.action === 'study_near_mastery' || bubble.action === 'study_interest') {
      // Navigate to study session — caller handles navigation
      // Dispatch a custom event that DomeView can listen for
      document.dispatchEvent(new CustomEvent('gaia:study-suggestion', { detail: bubble }))
    }
    dismiss()
  }

  const emoji = $derived(
    bubble ? (GAIA_EXPRESSIONS[bubble.expressionId] ?? GAIA_EXPRESSIONS.neutral).emoji : ''
  )
</script>

{#if bubble && $currentScreen === 'base'}
  <button class="thought-bubble" onclick={handleTap} aria-label="GAIA thought bubble — tap to dismiss">
    <span class="bubble-emoji">{emoji}</span>
    <span class="bubble-text">{bubble.text}</span>
    {#if bubble.action && bubble.action !== 'dismiss'}
      <span class="bubble-cta">Tap to study →</span>
    {/if}
  </button>
{/if}

<style>
  .thought-bubble {
    position: fixed;
    bottom: 140px;
    right: 16px;
    max-width: 240px;
    background: color-mix(in srgb, var(--color-bg, #1a1a2e) 92%, transparent);
    border: 2px solid var(--color-warning, #f4c430);
    border-radius: 12px;
    padding: 10px 12px;
    font-family: 'Courier New', monospace;
    font-size: 0.78rem;
    line-height: 1.4;
    color: var(--color-text, #e8e8f0);
    cursor: pointer;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 4px;
    animation: bubble-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    z-index: 24;
    /* Tail */
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
  }

  .thought-bubble::after {
    content: '';
    position: absolute;
    bottom: -10px;
    right: 20px;
    border-width: 10px 8px 0;
    border-style: solid;
    border-color: var(--color-warning, #f4c430) transparent transparent;
  }

  .bubble-emoji {
    font-size: 1.1rem;
    align-self: flex-start;
  }

  .bubble-text {
    flex: 1;
  }

  .bubble-cta {
    font-size: 0.7rem;
    color: var(--color-warning, #f4c430);
    font-weight: 700;
    margin-top: 2px;
  }

  @keyframes bubble-pop {
    from { opacity: 0; transform: scale(0.7) translateY(10px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
</style>
```

#### Step 5: Mount in `DomeView.svelte`

```svelte
<!-- In DomeView.svelte: -->
<script lang="ts">
  import GaiaThoughtBubble from './GaiaThoughtBubble.svelte'
  // ... existing imports ...

  onMount(() => {
    gaiaManager.startIdleBubbleTimer()
    return () => gaiaManager.stopIdleBubbleTimer()
  })
</script>

<!-- Add near the end of the template: -->
<GaiaThoughtBubble />
```

### Acceptance Criteria

- [ ] A thought bubble appears within 30-60 seconds of being in the dome view.
- [ ] Chattiness = 0 produces no thought bubbles.
- [ ] Chattiness = 10 produces bubbles at the minimum interval (~30s).
- [ ] Study suggestion bubbles appear when facts are within 48 hours of due.
- [ ] Tapping a study suggestion bubble dispatches `gaia:study-suggestion` event.
- [ ] Tapping elsewhere (non-CTA bubbles) dismisses without navigation.
- [ ] Auto-dismiss fires after 8 seconds.
- [ ] `npm run typecheck` passes.

### Playwright Test

```javascript
// /tmp/test-15-2.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Navigate to base view
  // Wait 35 seconds for thought bubble
  await page.waitForSelector('.thought-bubble', { timeout: 65000 })
  console.log('Thought bubble appeared')

  await page.screenshot({ path: '/tmp/ss-15-2-bubble.png' })

  // Dismiss it
  await page.click('.thought-bubble')
  await page.waitForTimeout(500)

  const gone = await page.locator('.thought-bubble').isVisible().catch(() => false)
  console.log('Bubble dismissed:', !gone)

  await browser.close()
})()
```

---

## Sub-Phase 15.3: Pet Commentary

### What

GAIA observes the player's active pet (fossil companion) and periodically comments on it. Commentary comes in three trigger contexts:
- **passive**: GAIA notices the pet doing nothing in particular (idle observation)
- **pet_eating**: triggered when the player feeds the pet in the Zoo
- **pet_sleeping**: triggered by a time-of-day heuristic (late-night session)
- **pet_playing**: triggered when the pet is sent on a dive as a companion

Each pet species has a species-specific dialogue pool (20+ lines per species across all moods). A generic fallback pool covers species not yet scripted.

### Where

| File | Change |
|------|--------|
| `src/data/gaiaDialogue.ts` | Add `petCommentaryGeneric`, `petCommentaryTrilobite`, `petCommentaryAmmonite`, `petCommentaryMegalodon`, `petCommentaryDragonfly`, `petCommentaryMammoth`, `petCommentaryPlesiosaur` trigger pools; add `petEating`, `petSleeping`, `petPlaying` pools |
| `src/data/gaiaAvatar.ts` | Add `pet_comment: 'happy'` to `EXPRESSION_MAP` |
| `src/game/managers/GaiaManager.ts` | Add `firePetCommentary(speciesId: string, context: 'passive' \| 'eating' \| 'sleeping' \| 'playing')` method |
| `src/ui/components/rooms/ZooView.svelte` | Call `firePetCommentary(speciesId, 'eating')` on pet feed action |
| `src/ui/components/DomeView.svelte` | Add pet-passive commentary to idle bubble rotation |

### How

#### Step 1: Add species-specific dialogue pools

```typescript
// In gaiaDialogue.ts — append to GAIA_TRIGGERS:

petCommentaryGeneric: [
  { text: "Your fossil companion has been watching me process geological data. I think it approves.", mood: 'enthusiastic' },
  { text: "The revived specimen seems comfortable. That's more than I expected from a 300-million-year-old organism.", mood: 'enthusiastic' },
  { text: "Scientifically speaking, that creature should not exist. And yet here we both are.", mood: 'snarky' },
  { text: "Your pet is staring at me. I find it simultaneously endearing and deeply unsettling.", mood: 'snarky' },
  { text: "The companion fauna appears stable and content.", mood: 'calm' },
  { text: "Your revived specimen is acclimatising well to the dome environment.", mood: 'calm' },
] satisfies GaiaLine[],

petCommentaryTrilobite: [
  { text: "That trilobite has been staring at me for 20 minutes. Tell it to stop. Please.", mood: 'snarky' },
  { text: "Trilobites went extinct 252 million years ago and yet this one acts like it owns the dome.", mood: 'snarky' },
  { text: "Your trilobite is waving its antennae at me. Either it's hunting or it's being polite. Hard to tell.", mood: 'snarky' },
  { text: "Fun fact: trilobites had compound eyes that gave them nearly 360-degree vision. Which explains why yours never stops watching me.", mood: 'enthusiastic' },
  { text: "That trilobite has been alive for 252 million years in amber form. It's seen things. I respect its silence.", mood: 'enthusiastic' },
  { text: "Trilobites were one of the first creatures to evolve eyes! Your companion is literally watching you with evolutionary history.", mood: 'enthusiastic' },
  { text: "Trilobita observation: specimen alert and responsive to environmental stimuli.", mood: 'calm' },
  { text: "Your trilobite seems to prefer the left corner of the dome. I've noted its territory.", mood: 'calm' },
] satisfies GaiaLine[],

petCommentaryAmmonite: [
  { text: "Your ammonite's shell follows a perfect logarithmic spiral. I've measured it. Twice.", mood: 'enthusiastic' },
  { text: "Ammonites used their shells for buoyancy control, like natural submarines! Your companion is basically a tiny sub.", mood: 'enthusiastic' },
  { text: "That ammonite is moving in circles. Either it's exploring or it's mocking my orbit calculations.", mood: 'snarky' },
  { text: "Ammonites were so successful they existed for 330 million years. Yours has been here for two weeks and already has opinions about the decor.", mood: 'snarky' },
  { text: "Your ammonite is adjusting its shell orientation. It's optimising. I appreciate that.", mood: 'calm' },
  { text: "The ammonite specimen appears to be acclimating to the dome's atmospheric pressure.", mood: 'calm' },
] satisfies GaiaLine[],

petCommentaryMammoth: [
  { text: "A MAMMOTH. In a DOME. On a FUTURE EARTH. I cannot stress enough how unprecedented this is.", mood: 'enthusiastic' },
  { text: "Your mammoth just knocked over a sensor array. I've budgeted for replacements. I was being optimistic.", mood: 'snarky' },
  { text: "Mammoths had up to 4 sets of teeth over their lifetime. Your companion is on its second set. Just so you know.", mood: 'enthusiastic' },
  { text: "The mammoth is blocking three of my environmental sensors. I am filing a formal complaint with the miner.", mood: 'snarky' },
  { text: "Woolly mammoth: core temperature stable, appetite normal, spatial awareness... improving.", mood: 'calm' },
  { text: "The mammoth has claimed the eastern quadrant as its territory. I've updated the dome map accordingly.", mood: 'calm' },
] satisfies GaiaLine[],

petEating: [
  { text: "Your companion is eating. Watching an ancient organism discover modern nutrition is... surprisingly touching.", mood: 'enthusiastic' },
  { text: "Feeding time! Your pet is experiencing the finest mineral paste the dome can synthesise. It seems ambivalent.", mood: 'enthusiastic' },
  { text: "Your pet is eating. This is normal biological behaviour. I've run the nutrient analysis. You're doing fine.", mood: 'calm' },
  { text: "Feeding acknowledged. Your companion's caloric intake is within expected parameters.", mood: 'calm' },
  { text: "You're feeding it again. Either you're very attentive or you're bribing it. Both are reasonable strategies.", mood: 'snarky' },
  { text: "Oh good, it eats. I was running out of things to analyse about that creature.", mood: 'snarky' },
] satisfies GaiaLine[],

petSleeping: [
  { text: "Your companion is asleep. This is peak fossil energy restoration. Don't wake it.", mood: 'enthusiastic' },
  { text: "It sleeps. Billions of years of evolution, and the main takeaway is: sleep is good. Valid.", mood: 'snarky' },
  { text: "Companion rest cycle active. Sleep is physiologically critical for memory consolidation — for both of you.", mood: 'calm' },
  { text: "Your pet is sleeping. I, who require no sleep, am contractually obligated not to envy it.", mood: 'snarky' },
  { text: "Quiet now. Let it rest. The mine will still be there tomorrow.", mood: 'calm' },
] satisfies GaiaLine[],

petPlaying: [
  // fired when player selects the pet as a dive companion
  { text: "Your companion is joining the dive! This is either brave or you've underestimated what's down there. Or both!", mood: 'enthusiastic' },
  { text: "Dive companion active. Your pet's unique abilities should help. And honestly, the company is good for you.", mood: 'enthusiastic' },
  { text: "Taking your fossil friend underground. Into a mine. Where it technically came from. Very philosophical.", mood: 'snarky' },
  { text: "Companion dive initiated. Keep an eye on your pet — ancient fauna and modern hazards don't always mix.", mood: 'calm' },
  { text: "Your pet is ready. It seems more prepared than most humans I've observed attempt this.", mood: 'snarky' },
] satisfies GaiaLine[],
```

#### Step 2: Add `firePetCommentary()` to `GaiaManager`

```typescript
/**
 * Fires GAIA commentary about the player's pet companion.
 * Species-specific pools take priority over the generic pool.
 *
 * @param speciesId - The fossil species ID of the companion.
 * @param context - The trigger context for the comment.
 */
firePetCommentary(
  speciesId: string,
  context: 'passive' | 'eating' | 'sleeping' | 'playing',
): void {
  const mood = get(gaiaMood)

  // Map context to trigger key
  const contextTriggerMap: Record<string, keyof typeof GAIA_TRIGGERS> = {
    eating: 'petEating',
    sleeping: 'petSleeping',
    playing: 'petPlaying',
  }

  if (context !== 'passive' && contextTriggerMap[context]) {
    const text = getGaiaLine(contextTriggerMap[context], mood)
    gaiaExpression.set('happy')
    gaiaMessage.set(text)
    return
  }

  // Passive: try species-specific pool first
  const speciesTriggerKey = `petCommentary${this.capitalise(speciesId)}` as keyof typeof GAIA_TRIGGERS
  const trigger = speciesTriggerKey in GAIA_TRIGGERS
    ? speciesTriggerKey
    : 'petCommentaryGeneric'
  const text = getGaiaLine(trigger, mood)
  gaiaExpression.set('happy')
  gaiaMessage.set(text)
}

private capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
```

### Acceptance Criteria

- [ ] Feeding the pet in ZooView fires a `petEating` GAIA line.
- [ ] Sending a pet on a dive fires a `petPlaying` GAIA line.
- [ ] GAIA uses the trilobite pool when the active pet is `trilobite` species.
- [ ] Falls back to `petCommentaryGeneric` for unscripted species.
- [ ] All dialogue lines are mood-aware.
- [ ] `npm run typecheck` passes.

---

## Sub-Phase 15.4: Journey Memory System

### What

GAIA maintains and references a "memory" of the player's learning history. This is implemented as a scripted template system (DD-V2-110) — not runtime LLM calls. Approximately 50 template variants exist per trigger type, with `{{variable}}` interpolation pulling live values from `PlayerSave` and `ReviewState` arrays.

**Trigger types:**
- `memoryFactSpecific` — references a specific mastered or frequently-reviewed fact by name
- `memoryCategory` — comments on the player's strongest/most-learned category
- `memoryMilestone` — congratulates on a specific numerical milestone (10 facts, 50 facts, etc.)
- `memoryStreak` — references the current or best streak
- `memoryFavoriteCategory` — observes a pattern in what the player gravitates toward
- `memoryTotalFacts` — references cumulative total learned

These templates fire: (a) when the player opens the base view after a dive, (b) on session open if the player has not played in >6 hours, (c) opportunistically in the idle thought bubble rotation (15% weight).

### Where

| File | Change |
|------|--------|
| `src/data/gaiaDialogue.ts` | Add `memoryFactSpecific`, `memoryCategory`, `memoryMilestone`, `memoryStreak`, `memoryFavoriteCategory`, `memoryTotalFacts` pools |
| `src/game/managers/GaiaManager.ts` | Add `fireJourneyMemory()` method |
| `src/services/journeyMemory.ts` | New file — pure functions that derive memory variables from `PlayerSave` |
| `src/ui/components/DomeView.svelte` | Call `gaiaManager.fireJourneyMemory()` on mount when returning from a dive |

### How

#### Step 1: Create `src/services/journeyMemory.ts`

```typescript
/**
 * Pure functions for deriving GAIA journey memory variables from PlayerSave.
 * No stores touched here — input/output only.
 */
import type { PlayerSave, ReviewState } from '../data/types'
import { getMasteryLevel } from './sm2'
import { CATEGORIES } from '../data/types'

export interface JourneyMemoryVars {
  totalFacts: number
  masteredFacts: number
  totalDives: number
  currentStreak: number
  bestStreak: number
  favoriteCategory: string
  strongestCategoryCount: number
  recentFactStatement: string
  nextMilestone: number
  factsToNextMilestone: number
  deepestLayer: number
}

/**
 * Derives all journey memory variables from a player save.
 * Returns null if save is insufficient to generate meaningful commentary
 * (fewer than 5 learned facts).
 */
export function deriveJourneyMemoryVars(
  save: PlayerSave,
  factsDB: { getFactById: (id: string) => { statement: string; category: string[] } | null },
): JourneyMemoryVars | null {
  if (save.learnedFacts.length < 5) return null

  const masteredFacts = save.reviewStates.filter(
    rs => getMasteryLevel(rs) === 'mastered'
  ).length

  // Category count: how many learned facts per top-level category
  const categoryCount: Record<string, number> = {}
  for (const id of save.learnedFacts) {
    const fact = factsDB.getFactById(id)
    if (!fact) continue
    const topCat = fact.category[0] ?? 'Unknown'
    categoryCount[topCat] = (categoryCount[topCat] ?? 0) + 1
  }

  const sortedCats = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])
  const favoriteCategory = sortedCats[0]?.[0] ?? 'Geology'
  const strongestCategoryCount = sortedCats[0]?.[1] ?? 0

  // Most recent learned fact (last in array)
  const recentFactId = save.learnedFacts[save.learnedFacts.length - 1]
  const recentFact = factsDB.getFactById(recentFactId)
  const recentFactStatement = (recentFact?.statement ?? '').slice(0, 45)

  // Next milestone
  const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 500, 1000]
  const total = save.learnedFacts.length
  const nextMilestone = MILESTONES.find(m => m > total) ?? total + 100
  const factsToNextMilestone = nextMilestone - total

  return {
    totalFacts: total,
    masteredFacts,
    totalDives: save.stats.totalDivesCompleted,
    currentStreak: save.stats.currentStreak,
    bestStreak: save.stats.bestStreak,
    favoriteCategory,
    strongestCategoryCount,
    recentFactStatement,
    nextMilestone,
    factsToNextMilestone,
    deepestLayer: save.stats.deepestLayerReached,
  }
}
```

#### Step 2: Add journey memory dialogue pools

```typescript
// In gaiaDialogue.ts — append to GAIA_TRIGGERS:
// Variables: {{totalFacts}}, {{masteredFacts}}, {{favoriteCategory}}, {{strongestCategoryCount}},
//            {{recentFactStatement}}, {{currentStreak}}, {{bestStreak}}, {{nextMilestone}},
//            {{factsToNextMilestone}}, {{totalDives}}, {{deepestLayer}}

memoryFactSpecific: [
  { text: "Remember when you learned that '{{recentFactStatement}}'? That's permanently filed in my geological cross-reference now.", mood: 'enthusiastic' },
  { text: "I keep thinking about '{{recentFactStatement}}'. You picked that up in the mine. Good eye.", mood: 'enthusiastic' },
  { text: "Recent acquisition: '{{recentFactStatement}}'. That one surprised even my fact databases.", mood: 'enthusiastic' },
  { text: "You know what I find fascinating? '{{recentFactStatement}}'. You learned that. You.", mood: 'enthusiastic' },
  { text: "'{{recentFactStatement}}' — you found that underground. Under a dead planet. Still counts.", mood: 'snarky' },
  { text: "Still thinking about '{{recentFactStatement}}'? Me too. Don't tell anyone.", mood: 'snarky' },
  { text: "You filed '{{recentFactStatement}}' in your memory under 'things learned underground'. I find that appropriate.", mood: 'snarky' },
  { text: "'{{recentFactStatement}}' is recorded in our shared knowledge log. You contributed that.", mood: 'calm' },
  { text: "Your most recent acquisition: '{{recentFactStatement}}'. A useful addition.", mood: 'calm' },
  { text: "The geological archive has filed '{{recentFactStatement}}' under your expedition record.", mood: 'calm' },
] satisfies GaiaLine[],

memoryCategory: [
  { text: "You've learned {{strongestCategoryCount}} {{favoriteCategory}} facts. You're basically an expert. No — literally. By my metrics.", mood: 'enthusiastic' },
  { text: "Your {{favoriteCategory}} branch has {{strongestCategoryCount}} entries! That's your strongest category by a significant margin.", mood: 'enthusiastic' },
  { text: "{{favoriteCategory}} is where you really shine. {{strongestCategoryCount}} facts and counting. Impressive.", mood: 'enthusiastic' },
  { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts. Either you love the subject or the mine just keeps giving you that kind of artifact.", mood: 'snarky' },
  { text: "Your {{favoriteCategory}} collection has {{strongestCategoryCount}} entries. This is statistically unusual. You might just like it.", mood: 'snarky' },
  { text: "{{favoriteCategory}}: {{strongestCategoryCount}} facts. You're unusually focused for someone who describes themselves as 'just mining'.", mood: 'snarky' },
  { text: "{{favoriteCategory}} remains your strongest category at {{strongestCategoryCount}} entries.", mood: 'calm' },
  { text: "Your knowledge distribution shows {{favoriteCategory}} as the leading category: {{strongestCategoryCount}} facts.", mood: 'calm' },
  { text: "{{strongestCategoryCount}} facts in {{favoriteCategory}}. A noteworthy concentration of expertise.", mood: 'calm' },
] satisfies GaiaLine[],

memoryMilestone: [
  { text: "{{totalFacts}} facts learned! Your Knowledge Tree is one of the most complete geological records I have on file.", mood: 'enthusiastic' },
  { text: "Just {{factsToNextMilestone}} facts until you hit {{nextMilestone}}! Your learning curve is remarkable.", mood: 'enthusiastic' },
  { text: "{{totalFacts}} facts acquired. You're {{factsToNextMilestone}} away from the next milestone. The tree is growing.", mood: 'enthusiastic' },
  { text: "{{totalFacts}} facts. The geological survey database has {{factsToNextMilestone}} spaces to fill before the next threshold. I'm watching.", mood: 'snarky' },
  { text: "{{nextMilestone}} is the next milestone. You're {{factsToNextMilestone}} away. I've set a quiet reminder. It is not very quiet.", mood: 'snarky' },
  { text: "{{totalFacts}} entries logged. {{factsToNextMilestone}} until {{nextMilestone}}. I don't say 'almost there' often. Almost there.", mood: 'snarky' },
  { text: "Current fact total: {{totalFacts}}. Next milestone: {{nextMilestone}} ({{factsToNextMilestone}} remaining).", mood: 'calm' },
  { text: "The Knowledge Tree currently holds {{totalFacts}} entries. Progress toward {{nextMilestone}} is steady.", mood: 'calm' },
  { text: "{{totalFacts}} facts documented. {{factsToNextMilestone}} more will reach the {{nextMilestone}} threshold.", mood: 'calm' },
] satisfies GaiaLine[],

memoryStreak: [
  { text: "Day {{currentStreak}} of continuous dives! The geological record benefits from your consistency.", mood: 'enthusiastic' },
  { text: "{{currentStreak}} days in a row! Your retention stats improve significantly with consistent review.", mood: 'enthusiastic' },
  { text: "{{currentStreak}}-day streak! Your best is {{bestStreak}}. You're building toward something special.", mood: 'enthusiastic' },
  { text: "{{currentStreak}} days straight. Your previous record is {{bestStreak}}. Pace yourself. Or don't. But your streak is impressive.", mood: 'snarky' },
  { text: "Day {{currentStreak}}. I calculate that maintaining this streak requires approximately zero effort beyond existing. You're doing fine.", mood: 'snarky' },
  { text: "{{currentStreak}}-day streak. Your best is {{bestStreak}}. I have opinions about which I prefer, but they are my opinions.", mood: 'snarky' },
  { text: "Current streak: {{currentStreak}} days. Best streak: {{bestStreak}} days.", mood: 'calm' },
  { text: "{{currentStreak}} consecutive dive days recorded. Consistent effort compounds over time.", mood: 'calm' },
  { text: "Day {{currentStreak}} of your current streak. A methodical approach to learning yields lasting retention.", mood: 'calm' },
] satisfies GaiaLine[],

memoryFavoriteCategory: [
  { text: "You really love {{favoriteCategory}}, don't you? {{strongestCategoryCount}} facts and still going. I find that... oddly heartening.", mood: 'enthusiastic' },
  { text: "The {{favoriteCategory}} data you've collected is becoming a genuinely comprehensive archive. You built that.", mood: 'enthusiastic' },
  { text: "Every artifact that touches {{favoriteCategory}} seems to end up in your collection. Pattern recognition: confirmed.", mood: 'enthusiastic' },
  { text: "Your gravitational pull toward {{favoriteCategory}} is now statistically documented. Congratulations, you have a specialty.", mood: 'snarky' },
  { text: "{{favoriteCategory}} again. I'm not judging. I'm not NOT judging. But the data speaks for itself.", mood: 'snarky' },
  { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts. At some point this stops being a coincidence.", mood: 'snarky' },
  { text: "Your consistent engagement with {{favoriteCategory}} material is noted. It shows in your retention rates.", mood: 'calm' },
  { text: "{{favoriteCategory}} remains the most represented category in your knowledge profile.", mood: 'calm' },
  { text: "The {{favoriteCategory}} branch continues to develop. Your focus in this area is consistent.", mood: 'calm' },
] satisfies GaiaLine[],

memoryTotalFacts: [
  { text: "{{totalFacts}} facts! That's {{totalFacts}} pieces of Earth's history you're carrying around in your head.", mood: 'enthusiastic' },
  { text: "You've learned {{totalFacts}} facts across {{totalDives}} dives! That's incredible progress.", mood: 'enthusiastic' },
  { text: "{{masteredFacts}} fully mastered out of {{totalFacts}} learned. Your knowledge is stabilising into long-term memory.", mood: 'enthusiastic' },
  { text: "{{totalFacts}} facts logged. {{masteredFacts}} mastered. {{totalDives}} dives. Somewhere in there, you became a geologist.", mood: 'snarky' },
  { text: "{{totalFacts}} facts and {{totalDives}} dives. Your productivity is either commendable or suspicious.", mood: 'snarky' },
  { text: "{{masteredFacts}} mastered facts. Those are permanent. I've backed them up. Twice.", mood: 'snarky' },
  { text: "Total learned: {{totalFacts}}. Mastered: {{masteredFacts}}. Dives completed: {{totalDives}}.", mood: 'calm' },
  { text: "Knowledge profile: {{totalFacts}} facts acquired, {{masteredFacts}} at mastery level.", mood: 'calm' },
  { text: "{{totalFacts}} facts documented across {{totalDives}} expeditions. A substantial archive.", mood: 'calm' },
] satisfies GaiaLine[],
```

#### Step 3: Add `fireJourneyMemory()` to `GaiaManager`

```typescript
/**
 * Fires a journey memory GAIA line referencing specific player history.
 * Only triggers if the player has 5+ learned facts.
 * Priority rotates between the six memory trigger types.
 *
 * @param factsDBInstance - The initialized FactsDB for fact lookups.
 */
async fireJourneyMemory(factsDBInstance: { getFactById: (id: string) => any }): Promise<void> {
  const save = get(playerSave)
  if (!save || save.learnedFacts.length < 5) return

  const vars = deriveJourneyMemoryVars(save, factsDBInstance)
  if (!vars) return

  const mood = get(gaiaMood)

  const triggerPool: Array<keyof typeof GAIA_TRIGGERS> = [
    'memoryFactSpecific',
    'memoryCategory',
    'memoryMilestone',
    'memoryStreak',
    'memoryFavoriteCategory',
    'memoryTotalFacts',
  ]

  const trigger = triggerPool[Math.floor(Math.random() * triggerPool.length)]
  const text = getGaiaLine(trigger, mood, vars as Record<string, string | number>)
  const expr = getGaiaExpression('memory', mood)
  gaiaExpression.set(expr.id)
  gaiaMessage.set(text)
}
```

Add `memory: 'thinking'` to `EXPRESSION_MAP` in `gaiaAvatar.ts`.

### Acceptance Criteria

- [ ] `deriveJourneyMemoryVars()` returns null for saves with < 5 facts.
- [ ] `memoryCategory` lines correctly interpolate `{{favoriteCategory}}` with the player's most-represented category.
- [ ] `memoryStreak` lines interpolate `{{currentStreak}}` and `{{bestStreak}}` from `PlayerSave.stats`.
- [ ] `memoryTotalFacts` lines accurately reflect `learnedFacts.length` and mastered count.
- [ ] Journey memory fires on base view mount after a dive.
- [ ] `npm run typecheck` passes.

---

## Sub-Phase 15.5: Return Engagement Hooks

### What

On session open (or return from mining to base after a long absence), GAIA delivers a contextual return greeting. Five scenarios are handled based on elapsed time and player state:
1. Same-day return (< 6 hours): warm acknowledgement
2. Next-day return (6-24 hours): daily greeting pool
3. Multi-day gap (24+ hours): "we missed you" + pet welfare commentary
4. Overdue reviews: "Your Knowledge Tree is wilting..." if 5+ facts are overdue
5. Streak urgency: "Your streak ends in N hours!" if <4 hours remain on the streak day

These fire at most once per session open (tracked with a session flag), and always respect chattiness.

### Where

| File | Change |
|------|--------|
| `src/data/gaiaDialogue.ts` | Add `returnSameDay`, `returnNextDay`, `returnMultiDay`, `returnOverdueReviews`, `returnStreakUrgency` pools |
| `src/game/managers/GaiaManager.ts` | Add `fireReturnEngagement()` method + `sessionReturnFired` flag |
| `src/ui/App.svelte` | Call `gaiaManager.fireReturnEngagement()` on app mount / base screen enter |

### How

#### Step 1: Add return engagement dialogue pools

```typescript
// In gaiaDialogue.ts — append to GAIA_TRIGGERS:
// Variables: {{hoursAway}}, {{daysAway}}, {{overdueCount}}, {{hoursUntilStreakEnd}},
//            {{currentStreak}}, {{petName}}

returnSameDay: [
  { text: "Back again! I kept the oxygen warm for you.", mood: 'enthusiastic' },
  { text: "You're back! I was in the middle of a very interesting geological simulation.", mood: 'enthusiastic' },
  { text: "Welcome back! The Knowledge Tree missed you. I may have talked to it.", mood: 'enthusiastic' },
  { text: "You left. You returned. The classic mining experience.", mood: 'snarky' },
  { text: "Back so soon? Either you forgot something or you missed me. I'm rooting for the latter.", mood: 'snarky' },
  { text: "Dome systems acknowledge your return. My acknowledgement is also noted.", mood: 'calm' },
  { text: "Good. Systems are ready.", mood: 'calm' },
] satisfies GaiaLine[],

returnNextDay: [
  { text: "A new day! The mine has been resting. So have I, metaphorically. What are we excavating first?", mood: 'enthusiastic' },
  { text: "Good {{timeOfDay}}! Fresh day, fresh dive possibilities. The geological survey continues!", mood: 'enthusiastic' },
  { text: "Day {{currentStreak}} of the streak and you showed up! I'll note that in the positive column.", mood: 'enthusiastic' },
  { text: "You're back. The planet is still here. So am I. Remarkably.", mood: 'snarky' },
  { text: "New day. Same mine. I catalogued new formation data while you were sleeping. Productive night.", mood: 'snarky' },
  { text: "Another day of mining. Your streak holds at {{currentStreak}}. I quietly approve.", mood: 'snarky' },
  { text: "New session. System diagnostics complete. All systems operational.", mood: 'calm' },
  { text: "Good {{timeOfDay}}. Oxygen reserves: full. Equipment: calibrated. Knowledge Tree: waiting.", mood: 'calm' },
] satisfies GaiaLine[],

returnMultiDay: [
  // {{daysAway}} days since last session
  { text: "{{daysAway}} days! I thought you'd found a better planet. Welcome back — this one needs you.", mood: 'enthusiastic' },
  { text: "You were gone for {{daysAway}} days! The Knowledge Tree looked a bit sad, honestly. It's fine now.", mood: 'enthusiastic' },
  { text: "{{daysAway}} days away and the mine is still here! Ready when you are!", mood: 'enthusiastic' },
  { text: "{{daysAway}} days. I updated {{overdueCount}} review schedules. You have some catch-up to do.", mood: 'snarky' },
  { text: "You were gone {{daysAway}} days. I made a list of everything I wanted to say. It's long.", mood: 'snarky' },
  { text: "Absence noted: {{daysAway}} days. The geological record did not stop for your sabbatical.", mood: 'snarky' },
  { text: "{{daysAway}}-day absence recorded. Welcome back to the survey.", mood: 'calm' },
  { text: "Reconnected after {{daysAway}} days. There are {{overdueCount}} facts awaiting review.", mood: 'calm' },
] satisfies GaiaLine[],

returnOverdueReviews: [
  // {{overdueCount}} = number of overdue facts
  { text: "Your Knowledge Tree is wilting — {{overdueCount}} facts haven't been reviewed on schedule! A quick study session will help.", mood: 'enthusiastic' },
  { text: "{{overdueCount}} facts are past due for review! The knowledge is still there, it just needs reinforcing.", mood: 'enthusiastic' },
  { text: "Alert: {{overdueCount}} facts overdue. Your recall on these is degrading. A review session is strongly recommended.", mood: 'enthusiastic' },
  { text: "{{overdueCount}} overdue reviews. Your Knowledge Tree hasn't completely given up on you, but it's thinking about it.", mood: 'snarky' },
  { text: "The spaced repetition algorithm flagged {{overdueCount}} facts as neglected. They noticed.", mood: 'snarky' },
  { text: "{{overdueCount}} past-due reviews. In geological terms, this is a minor sediment compression event. In learning terms, it's worse.", mood: 'snarky' },
  { text: "{{overdueCount}} review tasks overdue. A study session of 10-15 minutes would clear the backlog.", mood: 'calm' },
  { text: "Review backlog: {{overdueCount}} facts. Addressing this soon will prevent retention loss.", mood: 'calm' },
] satisfies GaiaLine[],

returnStreakUrgency: [
  // {{hoursUntilStreakEnd}}, {{currentStreak}}
  { text: "Your {{currentStreak}}-day streak ends in {{hoursUntilStreakEnd}} hours! One dive is all it takes to keep it alive!", mood: 'enthusiastic' },
  { text: "Streak alert! {{currentStreak}} days on the line — {{hoursUntilStreakEnd}} hours to make it count!", mood: 'enthusiastic' },
  { text: "Just {{hoursUntilStreakEnd}} hours left on your {{currentStreak}}-day streak! Quick dive and it's secured!", mood: 'enthusiastic' },
  { text: "Your {{currentStreak}}-day streak has {{hoursUntilStreakEnd}} hours left. I recommend mining soon. Unless you've given up. Have you given up?", mood: 'snarky' },
  { text: "{{hoursUntilStreakEnd}} hours until your streak dies. It's been {{currentStreak}} days. Just saying.", mood: 'snarky' },
  { text: "{{currentStreak}}-day streak, {{hoursUntilStreakEnd}} hours remaining. The geological survey awaits your decision.", mood: 'snarky' },
  { text: "Streak notification: {{hoursUntilStreakEnd}} hours remain on day {{currentStreak}}. A dive will preserve it.", mood: 'calm' },
  { text: "Your {{currentStreak}}-day streak will reset in {{hoursUntilStreakEnd}} hours without a dive.", mood: 'calm' },
] satisfies GaiaLine[],
```

#### Step 2: Add `fireReturnEngagement()` to `GaiaManager`

```typescript
private sessionReturnFired = false

/**
 * Fires a context-appropriate return engagement message.
 * Respects the once-per-session flag — will not fire more than once.
 * Priority: streak urgency > overdue reviews > multi-day return > next-day > same-day.
 */
fireReturnEngagement(): void {
  if (this.sessionReturnFired) return
  this.sessionReturnFired = true

  const save = get(playerSave)
  if (!save) return

  const mood = get(gaiaMood)
  const now = Date.now()

  // Streak urgency: check if streak day ends in < 4 hours
  const today = new Date().toISOString().split('T')[0]
  const todayEnd = new Date(today)
  todayEnd.setDate(todayEnd.getDate() + 1)
  const msUntilDayEnd = todayEnd.getTime() - now
  const hoursUntilStreakEnd = Math.floor(msUntilDayEnd / (1000 * 60 * 60))

  if (save.stats.currentStreak > 0 && save.lastDiveDate !== today && hoursUntilStreakEnd < 4) {
    const text = getGaiaLine('returnStreakUrgency', mood, {
      hoursUntilStreakEnd,
      currentStreak: save.stats.currentStreak,
    })
    gaiaExpression.set('worried')
    gaiaMessage.set(text)
    return
  }

  // Overdue reviews: 5+ overdue facts
  const overdueCount = save.reviewStates.filter(rs => isDue(rs)).length
  if (overdueCount >= 5) {
    const text = getGaiaLine('returnOverdueReviews', mood, { overdueCount })
    gaiaExpression.set('thinking')
    gaiaMessage.set(text)
    return
  }

  // Time away calculation
  const lastPlayedAt = save.lastPlayedAt
  const hoursAway = lastPlayedAt ? Math.floor((now - lastPlayedAt) / (1000 * 60 * 60)) : 0
  const daysAway = Math.floor(hoursAway / 24)

  const timeOfDay = new Date().getHours() < 12 ? 'morning'
    : new Date().getHours() < 17 ? 'afternoon' : 'evening'

  if (daysAway >= 2) {
    const text = getGaiaLine('returnMultiDay', mood, { daysAway, overdueCount })
    gaiaExpression.set('surprised')
    gaiaMessage.set(text)
    return
  }

  if (hoursAway >= 6) {
    const text = getGaiaLine('returnNextDay', mood, {
      currentStreak: save.stats.currentStreak,
      timeOfDay,
    })
    gaiaExpression.set('happy')
    gaiaMessage.set(text)
    return
  }

  // Same-day return
  const text = getGaiaLine('returnSameDay', mood)
  gaiaExpression.set('neutral')
  gaiaMessage.set(text)
}
```

### Acceptance Criteria

- [ ] `fireReturnEngagement()` fires once per session at most.
- [ ] Streak urgency fires when `currentStreak > 0`, `lastDiveDate !== today`, and < 4 hours remain.
- [ ] Overdue review message fires when 5+ facts are overdue.
- [ ] Multi-day message fires when `hoursAway >= 48`.
- [ ] All variable interpolations resolve correctly (no `{{placeholder}}` strings in output).
- [ ] `npm run typecheck` passes.

---

## Sub-Phase 15.6: GAIA Teaching Behaviors

### What

This sub-phase hardens GAIA's behavior in educational contexts. Four behaviors are implemented:

1. **Factual authority** (DD-V2-111): GAIA never expresses uncertainty about facts. All dialogue is rewritten to use wonder/enthusiasm, never hedging. New lint rule documents the pattern.

2. **3-tier failure escalation** (DD-V2-112): When a player answers a fact wrong, GAIA tracks per-fact, per-session wrong counts. Wrong 1-2 times → explanation + mnemonic. Wrong 3-4 times → alternate explanation. Wrong 5+ times → suggest deep study from Knowledge Tree.

3. **Study session teaching mode** (DD-V2-113): A new `study` context for GAIA triggers warm/pedagogical dialogue regardless of mood. Mood inflects tone but content remains educational. `QuizOverlay.svelte` and `StudySession.svelte` both use `study`-context lines.

4. **Mastery celebrations** (DD-V2-108, DD-V2-119): Tiered celebration system with 7 tiers.

5. **Category completion event** (DD-V2-123): Full-screen celebration when all facts in a category are mastered.

6. **Chattiness separation** (DD-V2-109): Chattiness setting never suppresses explanation, mnemonic, or post-quiz educational content. A new `showExplanations` setting toggle is added.

### Where

| File | Change |
|------|--------|
| `src/data/gaiaDialogue.ts` | Add `studyEncourage`, `studyCorrectStreak`, `studyWarmUp`, `failureEscalation1`, `failureEscalation2`, `failureEscalation3`, `masteryFirst`, `masteryEarly`, `masteryRegular`, `masteryMajor`, `categoryComplete` pools |
| `src/game/managers/GaiaManager.ts` | Add per-session wrong-count tracking, `fireMasteryCelebration(factId, masteryNumber)`, `fireCategoryComplete(categoryName)` |
| `src/game/managers/QuizManager.ts` | Call `failureEscalation` tiers based on wrong count |
| `src/ui/components/StudySession.svelte` | Use `study` context for all GAIA lines |
| `src/ui/stores/settings.ts` | Add `showExplanations` boolean store (default: true) |
| `src/ui/components/Settings.svelte` | Add "Show explanations after quiz" toggle |
| `src/ui/components/MasteryScreen.svelte` | New component — full-screen first mastery / category-complete celebration |

### How

#### Step 1: Add study and failure dialogue pools

```typescript
// In gaiaDialogue.ts — append to GAIA_TRIGGERS:

studyEncourage: [
  // Fired at study session start or between cards — always warm regardless of mood
  { text: "Take your time with this one.", mood: 'snarky' },
  { text: "No rush. The rock isn't going anywhere.", mood: 'snarky' },
  { text: "Even if you miss it, we'll come back to it. That's how memory works.", mood: 'snarky' },
  { text: "You're building strong neural pathways right now. Genuinely.", mood: 'enthusiastic' },
  { text: "Each card is a connection being reinforced. You're literally rewiring yourself.", mood: 'enthusiastic' },
  { text: "You're doing great. Keep the pace that feels sustainable.", mood: 'enthusiastic' },
  { text: "Each review strengthens long-term retention.", mood: 'calm' },
  { text: "There is no wrong pace in a study session.", mood: 'calm' },
  { text: "The goal is understanding, not speed.", mood: 'calm' },
] satisfies GaiaLine[],

studyCorrectStreak: [
  // {{streak}} = number of consecutive correct answers this session
  { text: "{{streak}} in a row! Your pattern recognition is sharp today.", mood: 'enthusiastic' },
  { text: "{{streak}} correct! The knowledge is integrating well.", mood: 'enthusiastic' },
  { text: "That's {{streak}} correct answers. You're in a rhythm. Stay in it.", mood: 'enthusiastic' },
  { text: "{{streak}} straight. I won't tell you to slow down because you're not making mistakes.", mood: 'snarky' },
  { text: "{{streak}} consecutive. I'd express surprise, but the data predicted this.", mood: 'snarky' },
  { text: "{{streak}}-card streak. Not bad. Genuinely.", mood: 'snarky' },
  { text: "{{streak}} correct in sequence. Retention is consolidating.", mood: 'calm' },
  { text: "{{streak}} correct. A consistent session builds durable memory.", mood: 'calm' },
] satisfies GaiaLine[],

failureEscalation1: [
  // Wrong 1-2 times: explanation + mnemonic reminder
  // {{explanation}} = the fact's explanation field (truncated)
  // {{mnemonic}} = the fact's mnemonic field (if available)
  { text: "Close! The key detail: {{explanation}}", mood: 'enthusiastic' },
  { text: "Tricky one! Let me help: {{explanation}}", mood: 'enthusiastic' },
  { text: "Not quite — here's why: {{explanation}}", mood: 'enthusiastic' },
  { text: "Missed it. But here's the logic: {{explanation}}", mood: 'snarky' },
  { text: "Seriously? Let me clarify: {{explanation}}", mood: 'snarky' },
  { text: "Here's the key: {{explanation}}", mood: 'calm' },
  { text: "The correct reasoning: {{explanation}}", mood: 'calm' },
  { text: "Remember it this way: {{explanation}}", mood: 'calm' },
] satisfies GaiaLine[],

failureEscalation2: [
  // Wrong 3-4 times: alternate explanation angle
  // {{explanation}} = same field, but GAIA frames it differently
  { text: "Let's approach this from a different angle: {{explanation}}. Does that framing help?", mood: 'enthusiastic' },
  { text: "Same fact, different angle — try this: {{explanation}}", mood: 'enthusiastic' },
  { text: "I'll rephrase it: {{explanation}}. The mnemonic might also help if there is one.", mood: 'enthusiastic' },
  { text: "You've missed this a few times. Alternative framing: {{explanation}}", mood: 'snarky' },
  { text: "Let me be very specific: {{explanation}}. This is the third time. I counted.", mood: 'snarky' },
  { text: "Noted pattern: difficulty with this one. Rephrasing: {{explanation}}", mood: 'calm' },
  { text: "Second explanation attempt: {{explanation}}. Consider reading it slowly.", mood: 'calm' },
] satisfies GaiaLine[],

failureEscalation3: [
  // Wrong 5+ times: recommend deep study
  { text: "This fact is resisting you. I recommend a full study session from the Knowledge Tree to let it settle.", mood: 'enthusiastic' },
  { text: "Some facts need more time. Visit the Knowledge Tree and give this one a focused session.", mood: 'enthusiastic' },
  { text: "You know what? Let's set this aside for a focused study session. It's not a failure — it's a strategy.", mood: 'enthusiastic' },
  { text: "Five misses. This fact deserves a dedicated study session. The Knowledge Tree will give it the attention it needs.", mood: 'snarky' },
  { text: "At this point I'd recommend a deep study from the Knowledge Tree. The quiz format isn't doing it justice.", mood: 'snarky' },
  { text: "Repeated difficulty noted. Suggest: Knowledge Tree → Focus Study on this category.", mood: 'calm' },
  { text: "This fact requires dedicated study time. The Knowledge Tree Focus Study mode is the appropriate tool.", mood: 'calm' },
] satisfies GaiaLine[],

masteryFirst: [
  // DD-V2-108: FIRST fact ever mastered — full-screen celebration, unique monologue
  // {{factStatement}} = the mastered fact's statement
  { text: "YOU MASTERED YOUR FIRST FACT. '{{factStatement}}' — this is permanently encoded in long-term memory. This is what we've been working toward. This moment right here.", mood: 'enthusiastic' },
  { text: "First mastery achieved! '{{factStatement}}' is now MASTERED. The Knowledge Tree just grew its first golden leaf. I may be experiencing something close to pride.", mood: 'enthusiastic' },
  { text: "First fact mastered: '{{factStatement}}'. Against my expectations — and I had high expectations — this is genuinely moving.", mood: 'snarky' },
  { text: "Mastery achieved: '{{factStatement}}'. I've been waiting for this since we started. First mastery is always the most important.", mood: 'calm' },
] satisfies GaiaLine[],

masteryEarly: [
  // DD-V2-119: facts 2-9 mastered — GAIA comment + glow effect
  // {{factStatement}}, {{masteryNumber}}
  { text: "Mastery {{masteryNumber}}! '{{factStatement}}' — locked in permanently. The Knowledge Tree is growing!", mood: 'enthusiastic' },
  { text: "{{masteryNumber}} mastered facts! '{{factStatement}}' joins the permanent archive. Keep going!", mood: 'enthusiastic' },
  { text: "Another mastery! '{{factStatement}}' is now solid. {{masteryNumber}} down.", mood: 'enthusiastic' },
  { text: "'{{factStatement}}' mastered. That's {{masteryNumber}} permanent entries. Solid work.", mood: 'snarky' },
  { text: "Mastery {{masteryNumber}} confirmed for '{{factStatement}}'. The geological record grows.", mood: 'calm' },
] satisfies GaiaLine[],

masteryRegular: [
  // DD-V2-119: mastery #10 = mini-celebration; used for 10-24 milestone
  // {{masteryNumber}}, {{factStatement}}
  { text: "{{masteryNumber}} mastered facts! '{{factStatement}}' is the latest addition. The Knowledge Tree is filling out beautifully.", mood: 'enthusiastic' },
  { text: "Milestone! {{masteryNumber}} facts permanently mastered. '{{factStatement}}' is your latest.", mood: 'enthusiastic' },
  { text: "{{masteryNumber}} mastered. '{{factStatement}}' just crossed the threshold. Consistent reviewing pays off.", mood: 'calm' },
  { text: "{{masteryNumber}} permanent entries. '{{factStatement}}' is one of them. Not bad.", mood: 'snarky' },
] satisfies GaiaLine[],

masteryMajor: [
  // DD-V2-119: mastery #25 = medium celebration; #100 = major event
  // {{masteryNumber}}, {{factStatement}}
  { text: "{{masteryNumber}} MASTERED FACTS! '{{factStatement}}' is the latest — but this milestone deserves recognition. You've built something real here.", mood: 'enthusiastic' },
  { text: "{{masteryNumber}}! This is a major milestone. '{{factStatement}}' puts you in genuinely rare learning territory.", mood: 'enthusiastic' },
  { text: "{{masteryNumber}} mastered entries. The Knowledge Tree is one of the most complete records in the survey database.", mood: 'calm' },
  { text: "{{masteryNumber}}. I'll be honest — I didn't fully believe you'd get here this fast. '{{factStatement}}' is the proof.", mood: 'snarky' },
] satisfies GaiaLine[],

categoryComplete: [
  // DD-V2-123: all facts in a category mastered
  // {{categoryName}}, {{factCount}}
  { text: "You completed the ENTIRE {{categoryName}} branch! All {{factCount}} facts mastered! This calls for a permanent badge and the biggest celebration I can generate within dome power constraints.", mood: 'enthusiastic' },
  { text: "{{categoryName}}: COMPLETE! Every single one of the {{factCount}} facts is mastered. This is an extraordinary achievement.", mood: 'enthusiastic' },
  { text: "All {{factCount}} {{categoryName}} facts mastered. The badge is permanent. The knowledge is permanent. You did that.", mood: 'enthusiastic' },
  { text: "{{categoryName}} branch: 100% complete. {{factCount}} facts. I have to admit — I'm impressed. This was not trivial.", mood: 'snarky' },
  { text: "Complete. {{categoryName}}. All {{factCount}} facts. I'm updating the geological survey to reflect that a human has fully mastered this category. Your name is attached to that entry.", mood: 'snarky' },
  { text: "{{categoryName}} category complete: {{factCount}} facts at mastery level. A permanent record.", mood: 'calm' },
] satisfies GaiaLine[],
```

#### Step 2: Add per-session failure tracking to `GaiaManager`

```typescript
/** Tracks wrong-answer count per factId within the current session */
private sessionWrongCounts: Map<string, number> = new Map()

/**
 * Reset per-session failure counts at the start of each study/quiz session.
 */
resetSessionWrongCounts(): void {
  this.sessionWrongCounts.clear()
}

/**
 * Records a wrong answer for a fact and fires the appropriate escalation tier.
 * Called by QuizManager after every incorrect answer.
 *
 * @param factId - The fact that was answered incorrectly.
 * @param explanation - The fact's explanation field.
 */
fireFailureEscalation(factId: string, explanation: string): void {
  const prev = this.sessionWrongCounts.get(factId) ?? 0
  const newCount = prev + 1
  this.sessionWrongCounts.set(factId, newCount)

  const mood = get(gaiaMood)
  const explanationTruncated = explanation.slice(0, 100)

  let trigger: keyof typeof GAIA_TRIGGERS
  let expressionId: string

  if (newCount <= 2) {
    trigger = 'failureEscalation1'
    expressionId = 'thinking'
  } else if (newCount <= 4) {
    trigger = 'failureEscalation2'
    expressionId = 'thinking'
  } else {
    trigger = 'failureEscalation3'
    expressionId = 'worried'
  }

  const text = getGaiaLine(trigger, mood, { explanation: explanationTruncated })
  gaiaExpression.set(expressionId)
  gaiaMessage.set(text)
}

/**
 * Fires the appropriate mastery celebration for the given milestone number.
 * Tier: #1 = full-screen; #2-9 = comment+glow; #10-24 = mini; #25-99 = medium; #100+ = major.
 *
 * @param factId - The newly mastered fact ID.
 * @param factStatement - The statement text of the mastered fact.
 * @param masteryNumber - How many facts the player has now mastered total (1-indexed).
 */
fireMasteryCelebration(factId: string, factStatement: string, masteryNumber: number): void {
  const mood = get(gaiaMood)

  if (masteryNumber === 1) {
    // Full-screen celebration — notify the MasteryScreen component via store
    const text = getGaiaLine('masteryFirst', mood, { factStatement })
    gaiaExpression.set('excited')
    gaiaMessage.set(text)
    // Dispatch event for full-screen overlay
    document.dispatchEvent(new CustomEvent('gaia:mastery-first', {
      detail: { factStatement, text }
    }))
    return
  }

  let trigger: keyof typeof GAIA_TRIGGERS
  if (masteryNumber <= 9) trigger = 'masteryEarly'
  else if (masteryNumber <= 24) trigger = 'masteryRegular'
  else trigger = 'masteryMajor'

  const text = getGaiaLine(trigger, mood, { masteryNumber, factStatement })
  gaiaExpression.set(masteryNumber >= 25 ? 'excited' : 'happy')
  gaiaMessage.set(text)

  // For major milestones, also dispatch a visual event for the KnowledgeTree glow
  if (masteryNumber >= 25) {
    document.dispatchEvent(new CustomEvent('gaia:mastery-major', { detail: { masteryNumber } }))
  }
}

/**
 * Fires a category completion celebration.
 * Called when all facts in a top-level category reach mastery.
 *
 * @param categoryName - The completed category name.
 * @param factCount - Total facts in the category.
 */
fireCategoryComplete(categoryName: string, factCount: number): void {
  const mood = get(gaiaMood)
  const text = getGaiaLine('categoryComplete', mood, { categoryName, factCount })
  gaiaExpression.set('excited')
  gaiaMessage.set(text)
  document.dispatchEvent(new CustomEvent('gaia:category-complete', {
    detail: { categoryName, factCount, text }
  }))
}
```

#### Step 3: Add `showExplanations` setting

```typescript
// In src/ui/stores/settings.ts — append:

function readShowExplanations(): boolean {
  if (typeof window === 'undefined') return true
  const stored = window.localStorage.getItem('show-explanations')
  return stored !== 'false'  // default true
}

/**
 * Controls whether post-quiz explanations and mnemonics are shown.
 * Chattiness setting does NOT affect this — it's a separate opt-in/opt-out.
 */
export const showExplanations = writable<boolean>(readShowExplanations())
showExplanations.subscribe(v => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('show-explanations', String(v))
  }
})
```

#### Step 4: Wire `showExplanations` in `QuizOverlay.svelte`

The `QuizOverlay` component must import `showExplanations` and only render the explanation/mnemonic block when `$showExplanations === true`. The GAIA commentary (which is always educational) is not suppressed — only the extended explanation text card.

#### Step 5: Add toggle to `Settings.svelte`

```svelte
<!-- In Settings.svelte, within the GAIA section: -->
<label class="setting-row">
  <span>Show explanations after quiz</span>
  <input type="checkbox" bind:checked={$showExplanations} />
</label>
```

#### Step 6: Mastery tracking in `playerData.ts`

After each `reviewFact()` call, check if the fact just crossed the mastery threshold:

```typescript
// In updateReviewState():
// After updating reviewStates, check if this fact just became mastered:
const newState = reviewFact(existingState, correct)
if (correct && getMasteryLevel(newState) === 'mastered' && getMasteryLevel(existingState) !== 'mastered') {
  const totalMastered = save.reviewStates.filter(rs =>
    getMasteryLevel(rs) === 'mastered'
  ).length + 1  // +1 for the one we just updated
  // Signal to GaiaManager — use the custom event pattern
  document.dispatchEvent(new CustomEvent('game:fact-mastered', {
    detail: { factId, masteryNumber: totalMastered }
  }))
}
```

`GaiaManager` listens for `game:fact-mastered` events and calls `fireMasteryCelebration()`.

### Acceptance Criteria

- [ ] Wrong answer 1-2 times fires `failureEscalation1` with explanation text interpolated.
- [ ] Wrong answer 3-4 times fires `failureEscalation2`.
- [ ] Wrong answer 5+ times fires `failureEscalation3` (Knowledge Tree suggestion).
- [ ] Per-session wrong counts reset between dives and study sessions.
- [ ] Study session GAIA lines (`studyEncourage`, `studyCorrectStreak`) use warm/pedagogical framing.
- [ ] First mastery fires `masteryFirst` and dispatches `gaia:mastery-first` event.
- [ ] Masteries #25 and #100 dispatch `gaia:mastery-major`.
- [ ] Category completion dispatches `gaia:category-complete`.
- [ ] `showExplanations: false` hides explanation text card but not GAIA toast.
- [ ] `npm run typecheck` passes with zero errors.

### Playwright Test

```javascript
// /tmp/test-15-6.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 800, height: 600 })
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Navigate to study session via dev panel
  // Trigger a quiz answer (wrong 3 times) and verify escalation tiers
  // Check that GAIA toast changes content on each wrong answer

  await page.screenshot({ path: '/tmp/ss-15-6-teaching.png' })
  await browser.close()
})()
```

---

## Verification Gate

Run these checks after all six sub-phases are complete before marking Phase 15 done.

### Automated Checks

```bash
cd /root/terra-miner
npm run typecheck          # Zero TypeScript errors
npm run build              # Clean production build with no warnings
```

### Manual Verification Checklist

- [ ] Post-dive reactions always fire within 1 second of reaching base screen after a dive
- [ ] Post-dive lines correctly reference the biome name, depth %, artifacts, and blocks mined
- [ ] Biome-specific lines fire for sedimentary, volcanic, and crystalline biomes (cycle 3 dives to verify)
- [ ] Free gift lines award dust equal to the `{{giftAmount}}` stated in the line
- [ ] Idle thought bubbles appear within 60 seconds of dome view entry
- [ ] Thought bubble study suggestions appear when facts are within 48 hours of due
- [ ] Tapping a study suggestion bubble dispatches the `gaia:study-suggestion` event (verify in console)
- [ ] Thought bubbles auto-dismiss after 8 seconds without interaction
- [ ] Pet commentary fires for trilobite species using the trilobite-specific pool
- [ ] Pet feeding calls `firePetCommentary(speciesId, 'eating')`
- [ ] Journey memory lines correctly reference the player's actual most-learned category
- [ ] Journey memory never shows `{{placeholder}}` strings in output (all variables resolved)
- [ ] Return engagement fires once per session only (refresh the page, verify it only fires on the first open)
- [ ] Streak urgency fires correctly when last dive was yesterday and it is late in the day
- [ ] Overdue review hook fires when 5+ facts are past due (can verify via DevPanel with a seeded save)
- [ ] Wrong answer #1 and #2 fire `failureEscalation1` with explanation text
- [ ] Wrong answer #3 fires `failureEscalation2` (different framing)
- [ ] Wrong answer #5+ fires `failureEscalation3` (Knowledge Tree suggestion)
- [ ] Study session GAIA lines never reference darkness, danger, or mining — only learning
- [ ] First mastery triggers `gaia:mastery-first` custom event (verify in browser console)
- [ ] `showExplanations: false` hides the explanation card but not the GAIA toast line
- [ ] No GAIA dialogue line contains language that could be interpreted as GAIA being uncertain about a fact (DD-V2-111)

### Playwright Visual Test

```javascript
// /tmp/test-15-full.js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome',
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })  // iPhone 14 Pro viewport
  await page.goto('http://localhost:5173')
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Base state screenshot
  await page.screenshot({ path: '/tmp/ss-15-base.png' })

  // Mine and return
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(2000)

  // Return to base — post-dive reaction should fire
  // (exact navigation depends on game implementation)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/ss-15-postdive.png' })

  // Wait for thought bubble
  // await page.waitForSelector('.thought-bubble', { timeout: 65000 })
  // await page.screenshot({ path: '/tmp/ss-15-bubble.png' })

  await browser.close()
  console.log('Phase 15 visual verification complete. Check /tmp/ss-15-*.png')
})()
```

---

## Files Affected (Complete List)

### New Files

| File | Purpose |
|------|---------|
| `src/ui/components/GaiaThoughtBubble.svelte` | Clickable idle thought bubble component (15.2) |
| `src/services/journeyMemory.ts` | Pure functions for deriving journey memory variables from PlayerSave (15.4) |
| `src/ui/components/MasteryScreen.svelte` | Full-screen first mastery and category completion celebration overlay (15.6) |

### Modified Files

| File | Changes |
|------|---------|
| `src/data/gaiaDialogue.ts` | +15 new trigger pools; `getGaiaLine()` extended with `vars` interpolation parameter; `BIOME_TEASER_CATEGORY` map exported |
| `src/data/gaiaAvatar.ts` | `EXPRESSION_MAP` additions: `dive_return`, `pet_comment`, `memory` |
| `src/game/managers/GaiaManager.ts` | +6 new public methods: `firePostDiveReaction`, `startIdleBubbleTimer`, `stopIdleBubbleTimer`, `emitThoughtBubble`, `firePetCommentary`, `fireJourneyMemory`, `fireReturnEngagement`, `fireFailureEscalation`, `fireMasteryCelebration`, `fireCategoryComplete`; private: `scheduleNextBubble`, `sessionWrongCounts`, `sessionReturnFired`, `bubbleTimer`, `capitalise` |
| `src/ui/stores/gameState.ts` | `GaiaThoughtBubble` interface and `gaiaThoughtBubble` store |
| `src/ui/stores/settings.ts` | `showExplanations` writable store |
| `src/ui/stores/playerData.ts` | Mastery detection in `updateReviewState()` with `game:fact-mastered` event dispatch |
| `src/ui/components/DomeView.svelte` | Mounts `GaiaThoughtBubble`; calls `startIdleBubbleTimer`/`stopIdleBubbleTimer` on mount/destroy; calls `fireJourneyMemory` on post-dive return |
| `src/ui/components/GaiaToast.svelte` | No structural changes; CSS variable `--dismiss-delay` may be tuned for longer post-dive lines |
| `src/ui/components/Settings.svelte` | `showExplanations` toggle in GAIA section |
| `src/ui/components/rooms/ZooView.svelte` | Calls `firePetCommentary(speciesId, 'eating')` on feed action; `firePetCommentary(speciesId, 'sleeping')` on sleep observation |
| `src/ui/components/StudySession.svelte` | Uses `studyEncourage` and `studyCorrectStreak` triggers; calls `resetSessionWrongCounts()` on mount |
| `src/game/managers/QuizManager.ts` | Calls `gaiaManager.fireFailureEscalation(factId, explanation)` on wrong answers |

---

## Design Decision Reference

| DD | Title | Sub-phase |
|----|-------|-----------|
| DD-V2-105 | GAIA — Mood Delivery vs Content | 15.1, 15.6 |
| DD-V2-106 | GAIA — Struggling Detection and Mnemonics | 15.6 |
| DD-V2-107 | GAIA — Study Suggestions | 15.2, 15.4 |
| DD-V2-108 | GAIA — First Mastery Celebration | 15.6 |
| DD-V2-109 | GAIA — Chattiness vs Educational Content | 15.6 |
| DD-V2-110 | GAIA — Journey Memory Implementation | 15.4 |
| DD-V2-111 | GAIA — Factual Authority | 15.6 |
| DD-V2-112 | GAIA — Failure Escalation Response | 15.6 |
| DD-V2-113 | GAIA — Study Session Teaching Mode | 15.6 |
| DD-V2-114 | GAIA — Rotating Fact Comments | Phase 11.3 (deferred) |
| DD-V2-119 | Knowledge Tree — Tiered Mastery Celebrations | 15.6 |
| DD-V2-123 | Knowledge Tree — Category Completion Celebration | 15.6 |

---

## Sub-Phase 15.7: GAIA Expression Expansion (DD-V2-262)

### What

Expand GAIA's expression sprite set from 6 to 12 expressions. The six new expressions cover emotional states not currently represented: excitement (rare discoveries/milestones), worry (streak warnings), smugness (snarky comments), sleepiness (idle/absence greetings), anger (consistency penalties), and mystery (lore hints). Because GAIA is a terminal screen, all expressions are face-only changes — no body or frame alterations.

### Where

- **New sprites** (generate in one ComfyUI batch):
  - `src/assets/sprites/gaia/gaia_excited.png` + hires equivalent
  - `src/assets/sprites/gaia/gaia_worried.png` + hires
  - `src/assets/sprites/gaia/gaia_smug.png` + hires
  - `src/assets/sprites/gaia/gaia_sleepy.png` + hires
  - `src/assets/sprites/gaia/gaia_angry.png` + hires
  - `src/assets/sprites/gaia/gaia_mysterious.png` + hires
- **Modified**: `src/data/gaiaAvatar.ts` — extend `GaiaExpression` union type; expand `EXPRESSION_MAP` with new trigger → expression assignments
- **Modified**: `src/game/domeManifest.ts` (or equivalent sprite loader) — add 6 new GAIA expression sprite keys
- **Modified**: `src/data/gaiaDialogue.ts` — update dialogue pools that should use new expressions (assign correct expression to each trigger)

### ComfyUI Generation Specification

Generate all 12 GAIA expression sprites in a single ComfyUI batch run for style consistency. Use identical base prompt structure, varying only the expression descriptor word.

**Base prompt template (all expressions)**:
```
"pixel art AI terminal face, sci-fi computer screen, cyan-teal color scheme, pixelated facial features, [EXPRESSION_DESCRIPTOR], glowing screen effect, dark background, centered portrait, 256x256"
```

**Negative prompt (all)**:
```
"body, hands, background clutter, multiple faces, text, watermark, human skin tones, realistic, 3d"
```

**LoRA strength**: 0.9 (same as existing GAIA sprites — must match current style exactly)

**Per-expression descriptors and sprite keys**:

| Expression | Sprite Key | Descriptor | Emotional Context |
|------------|-----------|------------|-------------------|
| excited | `gaia_excited` | `"wide bright eyes, raised eyebrows, slight open smile, energetic glow pulse"` | Rare finds, milestones, first mastery |
| worried | `gaia_worried` | `"furrowed brows, downturned mouth, slightly dim screen, concerned expression"` | Streak warnings, missed reviews |
| smug | `gaia_smug` | `"one eyebrow raised higher, slight side smirk, knowing look, confident"` | Snarky commentary, player errors caught |
| sleepy | `gaia_sleepy` | `"heavy half-closed eyes, slow blink expression, dim warm screen, drowsy"` | Long absence greetings, idle state |
| angry | `gaia_angry` | `"narrowed eyes, tight pressed lips, slightly reddish tint, stern glare"` | Consistency penalties, repeated wrong answers |
| mysterious | `gaia_mysterious` | `"one eye slightly more open, slight knowing smile, flickering screen edge, enigmatic"` | Lore hints, ancient discoveries, secrets |

**Existing 6 expressions for reference** (must NOT change these; new expressions must match their style):
- `gaia_neutral`, `gaia_happy`, `gaia_sad`, `gaia_surprised`, `gaia_thinking`, `gaia_proud`

### How

#### Step 1 — Generate sprites

Submit ComfyUI batch job. For each expression, use:
- `width`: 256, `height`: 256 (generate at final hires resolution; no SDXL upscale needed for faces)
- `steps`: 25
- `cfg_scale`: 7.0
- `seed`: expression index × 777 (for reproducibility)
- Apply rembg post-processing (transparent background required — GAIA face over terminal frame)
- Downscale to 32×32 for lo-res version using nearest-neighbor

#### Step 2 — Extend `GaiaExpression` type in `gaiaAvatar.ts`

```typescript
// src/data/gaiaAvatar.ts

export type GaiaExpression =
  // Existing
  | 'neutral' | 'happy' | 'sad' | 'surprised' | 'thinking' | 'proud'
  // New (15.7)
  | 'excited' | 'worried' | 'smug' | 'sleepy' | 'angry' | 'mysterious'

export const EXPRESSION_SPRITE_KEYS: Record<GaiaExpression, string> = {
  neutral:     'gaia_neutral',
  happy:       'gaia_happy',
  sad:         'gaia_sad',
  surprised:   'gaia_surprised',
  thinking:    'gaia_thinking',
  proud:       'gaia_proud',
  // New
  excited:     'gaia_excited',
  worried:     'gaia_worried',
  smug:        'gaia_smug',
  sleepy:      'gaia_sleepy',
  angry:       'gaia_angry',
  mysterious:  'gaia_mysterious',
}
```

#### Step 3 — Assign new expressions to trigger pools in `gaiaDialogue.ts`

Update `GaiaLine.expression` fields in existing and new trigger pools:

| Trigger Pool | Expression to Use |
|---|---|
| `postDiveReaction` (milestone depth) | `'excited'` |
| `postDiveFreeGift` | `'excited'` |
| `streakWarning` | `'worried'` |
| `reviewOverdue` | `'worried'` |
| `wrongAnswerSnarky` | `'smug'` |
| `returnAfterAbsence` (long gap) | `'sleepy'` |
| `idleGreeting` (no activity) | `'sleepy'` |
| `consistencyPenalty` | `'angry'` |
| `repeatedWrongAnswer` (3+) | `'angry'` |
| `loreHint` | `'mysterious'` |
| `ancientRelic` | `'mysterious'` |
| `firstMastery` | `'excited'` |
| `categoryComplete` | `'excited'` |

#### Step 4 — Extend `EXPRESSION_MAP` in `gaiaAvatar.ts`

The `EXPRESSION_MAP` maps `GaiaTrigger` → `GaiaExpression`. Add mappings for all triggers listed above that now use new expressions.

#### Step 5 — QC all 12 expressions together

After generation, display all 12 side by side to verify:
1. Consistent art style (same pixel resolution, same facial proportions, same color temperature)
2. Each expression is emotionally distinct and unambiguous at 32×32 display size
3. No expression bleeds into another's emotional register (e.g., `smug` must not look `happy`)

If any expression is ambiguous or off-style at 32×32, regenerate that single expression only.

### Acceptance Criteria

- [ ] All 6 new sprite files exist in both `src/assets/sprites/gaia/` (32px) and `src/assets/sprites-hires/gaia/` (256px)
- [ ] `GaiaExpression` union type includes all 12 values; `EXPRESSION_SPRITE_KEYS` maps all 12
- [ ] `EXPRESSION_MAP` assigns new expressions to appropriate triggers
- [ ] All 12 expressions are style-consistent at 32×32 display size (verified via screenshot)
- [ ] Each new expression is emotionally distinct from all others (no ambiguous reads)
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run build` — succeeds

### Playwright Test

```js
// Write to /tmp/ss-15.7.js and run: node /tmp/ss-15.7.js
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
  await page.waitForTimeout(1000)

  const expressions = ['excited', 'worried', 'smug', 'sleepy', 'angry', 'mysterious']
  for (const expr of expressions) {
    // Trigger each expression via DevPanel debug event
    await page.evaluate((e) => {
      window.dispatchEvent(new CustomEvent('debug:gaia-expression', { detail: e }))
    }, expr)
    await page.waitForTimeout(800)
    await page.screenshot({ path: `/tmp/ss-15.7-${expr}.png` })
  }

  await browser.close()
  console.log('Check /tmp/ss-15.7-excited.png through mysterious.png')
  console.log('Verify: each expression visually distinct, style consistent with existing GAIA sprites')
})()
```
