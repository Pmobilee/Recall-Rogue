# Phase 17: Addictiveness Pass

**Status**: Pending
**Depends on**: Phase 8 (Mine Gameplay), Phase 10 (Dome Hub), Phase 13 (Knowledge Tree), Phase 15 (GAIA 2.0), Phase 16 (Fossil Expansion)
**Estimated complexity**: High — touches nearly every system in the game
**Design decisions referenced**: DD-V2-084, DD-V2-108, DD-V2-119, DD-V2-123, DD-V2-137, DD-V2-140, DD-V2-141, DD-V2-142, DD-V2-143, DD-V2-144, DD-V2-158, DD-V2-159, DD-V2-163

---

## Overview

Phase 17 is a comprehensive audit and enhancement pass over every system in Recall Rogue, targeting maximum engagement, dopamine response, and long-term retention — without resorting to anxiety-inducing dark patterns. Every sub-phase corresponds to one engagement pillar:

1. **17.1 — Gacha & Dopamine Audit**: every reward moment audited for anticipation → reveal → payoff cycle; rarity-tiered animations; near-miss feedback; mastery milestone celebrations
2. **17.2 — Sound Design Enhancement**: full audio pass from web synthesizer to proper chiptune audio files; biome-specific music; rarity fanfares; GAIA sound cues
3. **17.3 — Session Flow Optimization**: 5-minute and 15-minute session profiles validated; "one more dive" hooks; visible progress bars everywhere
4. **17.4 — Re-engagement Triggers**: push notification content templates; daily login calendar (DD-V2-144); comeback bonuses
5. **17.5 — Streak & Consistency System**: expanded streak rewards through day 365; anti-binge formula; grace periods; weekly challenges (DD-V2-140); positive streak reframing (DD-V2-158)

**Core philosophy**: reward curiosity and consistency, never weaponize anxiety. All engagement mechanics must pass the "does this respect the player?" test before shipping. This is a hard constraint that comes from the game's educational identity — teachers, parents, and press will evaluate the game on this dimension.

---

## Prerequisites

Before beginning Phase 17, verify the following systems are complete and passing `npm run typecheck`:

- [ ] `src/ui/components/StreakPanel.svelte` renders `BALANCE.STREAK_MILESTONES` correctly
- [ ] `src/ui/components/FactReveal.svelte` shows gacha-style reveal for artifacts
- [ ] `src/services/audioService.ts` (`AudioManager`) is instantiated and used from `GameManager.ts`
- [ ] `src/data/balance.ts` `BALANCE.STREAK_MILESTONES` array with at least the 6 existing entries
- [ ] `src/services/saveService.ts` persists `stats.currentStreak`, `stats.bestStreak`, `claimedMilestones`, `streakFreezes`, `longestStreak`
- [ ] `src/data/gaiaDialogue.ts` exports a dialogue table callable from `GaiaManager.ts`
- [ ] Phase 13 Knowledge Tree rendering with leaf nodes and branch completion percentages
- [ ] Phase 15 GAIA 2.0 personality system with mood/chattiness settings

---

## Sub-Phase 17.1: Gacha & Dopamine Audit

### What

Audit every reward moment in the game for the full anticipation → suspense → reveal → payoff loop. Implement escalating gacha animations per rarity tier. Add near-miss feedback text. Build the tiered mastery celebration system (DD-V2-108, DD-V2-119, DD-V2-123).

### Where — Files to Create

| File | Purpose |
|---|---|
| `src/ui/components/GachaReveal.svelte` | Unified rarity-tiered reveal animation component |
| `src/ui/components/MasteryToast.svelte` | Tiered mastery celebration overlay (replaces ad-hoc toast) |
| `src/ui/components/NearMissBanner.svelte` | Near-miss feedback banner ("Almost Legendary!") |
| `src/ui/components/MilestoneCelebration.svelte` | Full-screen milestone events (#100 mastery, category complete) |
| `src/game/managers/CelebrationManager.ts` | Orchestrates all celebration events, deduplicates, queues overlapping |

### Where — Files to Modify

| File | Change |
|---|---|
| `src/ui/components/FactReveal.svelte` | Import and use `GachaReveal.svelte` for artifact reveals |
| `src/game/managers/StudyManager.ts` | Emit mastery events to `CelebrationManager` on `repetitions` threshold crossing |
| `src/game/GameManager.ts` | Wire `CelebrationManager` into the event bus |
| `src/data/balance.ts` | Add `MASTERY_CELEBRATION_THRESHOLDS`, `NEAR_MISS_MESSAGES`, `GACHA_TIERS` |
| `src/data/types.ts` | Add `MasteryEvent` interface, `CelebrationTier` type |
| `src/data/gaiaDialogue.ts` | Add `firstMastery`, `masteryN`, `categoryComplete` dialogue entries |

### How — Step-by-Step

#### Step 1: Define gacha animation tiers in `src/data/balance.ts`

Add this block immediately after the existing `STREAK_FREEZE_MAX` entry:

```typescript
// === GACHA ANIMATION TIERS ===
GACHA_TIERS: {
  common: {
    durationMs: 400,
    particleCount: 0,
    screenFlash: false,
    screenShake: false,
    soundKey: 'reveal_common',
    bgColor: '#1a1a2e',
    glowColor: '#888888',
    labelText: 'Common Find',
  },
  uncommon: {
    durationMs: 600,
    particleCount: 8,
    screenFlash: false,
    screenShake: false,
    soundKey: 'reveal_uncommon',
    bgColor: '#1a2e1a',
    glowColor: '#4ec9a0',
    labelText: 'Uncommon Discovery',
  },
  rare: {
    durationMs: 900,
    particleCount: 20,
    screenFlash: true,
    screenShake: false,
    soundKey: 'reveal_rare',
    bgColor: '#1a1a3e',
    glowColor: '#4a9eff',
    labelText: 'Rare Artifact!',
  },
  epic: {
    durationMs: 1400,
    particleCount: 40,
    screenFlash: true,
    screenShake: false,
    soundKey: 'reveal_epic',
    bgColor: '#2a1a3e',
    glowColor: '#cc44ff',
    labelText: 'EPIC ARTIFACT!!',
  },
  legendary: {
    durationMs: 2200,
    particleCount: 80,
    screenFlash: true,
    screenShake: true,
    soundKey: 'reveal_legendary',
    bgColor: '#2a1a00',
    glowColor: '#ffd700',
    labelText: 'LEGENDARY!!!',
  },
  mythic: {
    durationMs: 3500,
    particleCount: 150,
    screenFlash: true,
    screenShake: true,
    soundKey: 'reveal_mythic',
    bgColor: '#1a0a2e',
    glowColor: '#ff44aa',
    labelText: 'MYTHIC — UNBELIEVABLE',
  },
} as const,

// === MASTERY CELEBRATIONS ===
// Per DD-V2-108 and DD-V2-119
MASTERY_CELEBRATION_THRESHOLDS: [
  { count: 1,   tier: 'fullscreen',  dustBonus: 0,   title: null,              gaiaKey: 'firstMastery' },
  { count: 2,   tier: 'glow',        dustBonus: 5,   title: null,              gaiaKey: 'masteryN' },
  { count: 3,   tier: 'glow',        dustBonus: 5,   title: null,              gaiaKey: 'masteryN' },
  { count: 4,   tier: 'glow',        dustBonus: 5,   title: null,              gaiaKey: 'masteryN' },
  { count: 5,   tier: 'mini',        dustBonus: 15,  title: null,              gaiaKey: 'mastery5' },
  { count: 6,   tier: 'glow',        dustBonus: 5,   title: null,              gaiaKey: 'masteryN' },
  { count: 7,   tier: 'glow',        dustBonus: 5,   title: null,              gaiaKey: 'masteryN' },
  { count: 8,   tier: 'glow',        dustBonus: 5,   title: null,              gaiaKey: 'masteryN' },
  { count: 9,   tier: 'glow',        dustBonus: 5,   title: null,              gaiaKey: 'masteryN' },
  { count: 10,  tier: 'banner',      dustBonus: 50,  title: null,              gaiaKey: 'mastery10' },
  { count: 25,  tier: 'medium',      dustBonus: 100, title: 'Scholar',         gaiaKey: 'mastery25' },
  { count: 50,  tier: 'medium',      dustBonus: 200, title: 'Researcher',      gaiaKey: 'mastery50' },
  { count: 100, tier: 'major',       dustBonus: 500, title: 'Archivist',       gaiaKey: 'mastery100' },
  { count: 250, tier: 'major',       dustBonus: 1000,title: 'Encyclopedist',   gaiaKey: 'mastery250' },
  { count: 500, tier: 'fullscreen',  dustBonus: 2500,title: 'Omniscient',      gaiaKey: 'mastery500' },
] as const,

// === NEAR-MISS MESSAGES ===
// Shown when rarity is one tier below Legendary/Mythic
NEAR_MISS_MESSAGES: {
  // Player got Epic when they were close to Legendary
  epic_nearLegendary: [
    'Almost Legendary! Epic is still incredible.',
    'So close to Legendary! An Epic find is a win.',
    'Just one tier away from Legendary. Epic it is!',
  ],
  // Player got Legendary when they were close to Mythic (very rare)
  legendary_nearMythic: [
    'Legendary! Mythic is rarer than this world deserves.',
    'Legendary — you were this close to Mythic.',
    'A Legendary find. Mythic is out there somewhere...',
  ],
} as const,
```

#### Step 2: Create `src/ui/components/GachaReveal.svelte`

This component is the single authoritative reveal animation for all artifact reveals. It accepts `rarity` and `factStatement`, reads the tier config from `BALANCE.GACHA_TIERS`, and plays the appropriate animation sequence.

```svelte
<script lang="ts">
  import { BALANCE } from '../../data/balance'
  import type { Rarity } from '../../data/types'

  interface Props {
    rarity: Rarity
    factStatement: string
    onComplete: () => void
  }

  let { rarity, factStatement, onComplete }: Props = $props()

  const tier = $derived(BALANCE.GACHA_TIERS[rarity])

  // Animation state: 'anticipation' → 'suspense' → 'reveal' → 'payoff' → 'done'
  type AnimPhase = 'anticipation' | 'suspense' | 'reveal' | 'payoff' | 'done'
  let phase = $state<AnimPhase>('anticipation')

  // Particle positions (generated on reveal)
  let particles = $state<Array<{ x: number; y: number; angle: number; speed: number }>>([])

  $effect(() => {
    // Anticipation: dim overlay with pulsing question mark
    const t1 = setTimeout(() => {
      phase = 'suspense'
    }, 600)

    // Suspense: slow pulse of mystery color, hold for tension
    const t2 = setTimeout(() => {
      // Generate particles before revealing
      particles = Array.from({ length: tier.particleCount }, () => ({
        x: 50,
        y: 50,
        angle: Math.random() * 360,
        speed: 2 + Math.random() * 4,
      }))
      phase = 'reveal'
    }, 600 + 800)

    // Reveal: flash + glow + rarity label
    const t3 = setTimeout(() => {
      phase = 'payoff'
    }, 600 + 800 + tier.durationMs)

    // Payoff: show fact statement, fade controls in
    const t4 = setTimeout(() => {
      phase = 'done'
      onComplete()
    }, 600 + 800 + tier.durationMs + 1500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  })
</script>

<div
  class="gacha-overlay"
  class:phase-anticipation={phase === 'anticipation'}
  class:phase-suspense={phase === 'suspense'}
  class:phase-reveal={phase === 'reveal'}
  class:phase-payoff={phase === 'payoff'}
  style:--glow={tier.glowColor}
  style:--bg={tier.bgColor}
  aria-live="assertive"
  aria-label="Artifact reveal: {rarity}"
>
  {#if phase === 'anticipation' || phase === 'suspense'}
    <div class="mystery-box" class:pulse={phase === 'suspense'}>
      <span class="question-mark">?</span>
    </div>
  {/if}

  {#if phase === 'reveal' || phase === 'payoff'}
    <div class="rarity-label" style:color={tier.glowColor}>
      {tier.labelText}
    </div>
    {#each particles as p}
      <div
        class="particle"
        style:left="{p.x}%"
        style:top="{p.y}%"
        style:--angle="{p.angle}deg"
        style:--speed="{p.speed}"
        style:background={tier.glowColor}
      ></div>
    {/each}
  {/if}

  {#if phase === 'payoff'}
    <div class="fact-reveal-text">{factStatement}</div>
    <button class="collect-btn" onclick={onComplete}>Collect</button>
  {/if}
</div>

<style>
  .gacha-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg, #1a1a2e);
    transition: background 0.4s ease;
    font-family: 'Courier New', monospace;
    overflow: hidden;
  }

  .phase-reveal {
    animation: screenFlash 0.15s ease-out;
  }

  @keyframes screenFlash {
    0%   { filter: brightness(1); }
    50%  { filter: brightness(3); }
    100% { filter: brightness(1); }
  }

  .mystery-box {
    width: 120px;
    height: 120px;
    border: 3px solid var(--glow, #888);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px var(--glow, #888);
  }

  .mystery-box.pulse {
    animation: pulseMystery 0.8s ease-in-out infinite;
  }

  @keyframes pulseMystery {
    0%, 100% { box-shadow: 0 0 20px var(--glow, #888); }
    50%       { box-shadow: 0 0 60px var(--glow, #888); }
  }

  .question-mark {
    font-size: 4rem;
    color: var(--glow, #888);
    font-weight: 900;
  }

  .rarity-label {
    font-size: clamp(1.4rem, 6vw, 2.5rem);
    font-weight: 900;
    letter-spacing: 3px;
    text-transform: uppercase;
    text-shadow: 0 0 20px currentColor;
    margin-bottom: 24px;
    animation: labelDrop 0.3s ease-out;
  }

  @keyframes labelDrop {
    from { transform: translateY(-30px); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }

  .particle {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    animation: particleFly calc(var(--speed) * 0.3s) ease-out forwards;
    transform-origin: center;
  }

  @keyframes particleFly {
    from {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    to {
      transform:
        translate(
          calc(-50% + cos(var(--angle)) * 200px),
          calc(-50% + sin(var(--angle)) * 200px)
        )
        scale(0);
      opacity: 0;
    }
  }

  .fact-reveal-text {
    color: #fff;
    font-size: clamp(1rem, 4vw, 1.4rem);
    text-align: center;
    max-width: 80vw;
    line-height: 1.5;
    margin-bottom: 32px;
    animation: fadeUp 0.4s ease-out;
  }

  @keyframes fadeUp {
    from { transform: translateY(16px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .collect-btn {
    min-width: 160px;
    min-height: 48px;
    border: 0;
    border-radius: 12px;
    background: var(--glow, #888);
    color: #000;
    font-family: inherit;
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: 2px;
    cursor: pointer;
    text-transform: uppercase;
    animation: fadeUp 0.4s 0.2s ease-out both;
  }

  .collect-btn:active {
    transform: scale(0.96);
  }
</style>
```

#### Step 3: Create `src/ui/components/NearMissBanner.svelte`

The near-miss banner appears for 2.5 seconds when an artifact lands one tier below Legendary or Mythic. It is non-blocking (does not require dismissal).

```svelte
<script lang="ts">
  import { BALANCE } from '../../data/balance'
  import type { Rarity } from '../../data/types'

  interface Props {
    rarity: Rarity
  }

  let { rarity }: Props = $props()

  // Determine if this qualifies as a near-miss
  const nearMissKey = $derived.by((): keyof typeof BALANCE.NEAR_MISS_MESSAGES | null => {
    if (rarity === 'epic') return 'epic_nearLegendary'
    if (rarity === 'legendary') return 'legendary_nearMythic'
    return null
  })

  const message = $derived.by(() => {
    if (!nearMissKey) return null
    const msgs = BALANCE.NEAR_MISS_MESSAGES[nearMissKey]
    return msgs[Math.floor(Math.random() * msgs.length)]
  })

  let visible = $state(true)

  $effect(() => {
    if (!message) return
    const t = setTimeout(() => { visible = false }, 2500)
    return () => clearTimeout(t)
  })
</script>

{#if message && visible}
  <div class="near-miss-banner" role="status" aria-live="polite">
    {message}
  </div>
{/if}

<style>
  .near-miss-banner {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.85);
    border: 1px solid rgba(255, 215, 0, 0.5);
    color: #ffd700;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    font-weight: 700;
    padding: 10px 20px;
    border-radius: 999px;
    white-space: nowrap;
    z-index: 300;
    animation: bannerPop 0.25s ease-out, bannerFade 0.4s 2.1s ease-in forwards;
    pointer-events: none;
  }

  @keyframes bannerPop {
    from { transform: translateX(-50%) scale(0.8); opacity: 0; }
    to   { transform: translateX(-50%) scale(1);   opacity: 1; }
  }

  @keyframes bannerFade {
    to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  }
</style>
```

#### Step 4: Create `src/game/managers/CelebrationManager.ts`

This manager receives mastery count updates and queues the appropriate celebration type. It prevents multiple celebrations from stacking simultaneously by using a FIFO queue that drains after each animation completes.

```typescript
import { BALANCE } from '../../data/balance'
import type { PlayerSave } from '../../data/types'

/** Celebration tier determines the visual intensity of the event. */
export type CelebrationTier = 'glow' | 'mini' | 'banner' | 'medium' | 'major' | 'fullscreen'

export interface CelebrationEvent {
  tier: CelebrationTier
  /** Dust awarded immediately on celebration trigger. */
  dustBonus: number
  /** Title string to unlock, or null. */
  title: string | null
  /** Key into gaiaDialogue to play. */
  gaiaKey: string
  /** The mastery count that triggered this event (for GAIA interpolation). */
  masteryCount: number
  /** The fact statement of the newly mastered fact. */
  factStatement: string
  /** Category of the mastered fact (for category-completion check). */
  category: string
}

/** Callback types expected by consumers (Svelte components). */
export type OnCelebrationCallback = (event: CelebrationEvent) => void

/**
 * CelebrationManager queues and dispatches mastery celebration events.
 * All code paths that trigger mastery (StudyManager answer grading) must
 * call notifyMastery() on this manager.
 */
export class CelebrationManager {
  private queue: CelebrationEvent[] = []
  private busy = false
  private listeners: OnCelebrationCallback[] = []

  constructor(private getSave: () => PlayerSave) {}

  /**
   * Called by StudyManager whenever a fact crosses the mastery threshold
   * (repetitions reaching a new milestone level per BALANCE.MASTERY_CELEBRATION_THRESHOLDS).
   */
  notifyMastery(masteryCount: number, factStatement: string, category: string): void {
    const threshold = BALANCE.MASTERY_CELEBRATION_THRESHOLDS.find(t => t.count === masteryCount)
    if (!threshold) {
      // Counts 2-9 that are not milestone triggers still get a glow
      if (masteryCount >= 2 && masteryCount <= 9) {
        this.enqueue({
          tier: 'glow',
          dustBonus: 5,
          title: null,
          gaiaKey: 'masteryN',
          masteryCount,
          factStatement,
          category,
        })
      }
      return
    }

    this.enqueue({
      tier: threshold.tier as CelebrationTier,
      dustBonus: threshold.dustBonus,
      title: threshold.title as string | null,
      gaiaKey: threshold.gaiaKey,
      masteryCount,
      factStatement,
      category,
    })
  }

  /**
   * Called when a Knowledge Tree category reaches 100% mastery.
   * Per DD-V2-123: major full-screen celebration, unique badge, challenge mode unlock.
   */
  notifyCategoryComplete(categoryName: string): void {
    this.enqueue({
      tier: 'fullscreen',
      dustBonus: 750,
      title: null,
      gaiaKey: 'categoryComplete',
      masteryCount: -1,
      factStatement: '',
      category: categoryName,
    })
  }

  /** Register a Svelte component callback to receive events. */
  subscribe(cb: OnCelebrationCallback): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb)
    }
  }

  /** Called by the component when the celebration animation finishes. */
  markComplete(): void {
    this.busy = false
    this.drain()
  }

  private enqueue(event: CelebrationEvent): void {
    this.queue.push(event)
    this.drain()
  }

  private drain(): void {
    if (this.busy || this.queue.length === 0) return
    this.busy = true
    const next = this.queue.shift()!
    this.listeners.forEach(l => l(next))
  }
}
```

#### Step 5: Create `src/ui/components/MasteryToast.svelte`

This component receives a `CelebrationEvent` and renders the appropriate visual. It calls `onComplete` when done so `CelebrationManager.markComplete()` can drain the queue.

Key implementation requirements per tier:
- `glow`: Small green flash at bottom of screen, GAIA quip via `GaiaToast`, +5 dust silently. Duration: 1.2s.
- `mini`: Full-width banner at top with fact name, GAIA comment, dust counter. Duration: 2s.
- `banner`: Animated banner slides in from top with branch glow visual, Knowledge Store coupon text. Duration: 3s.
- `medium`: Modal-style card with particle burst, GAIA speech bubble, title unlock notification. Duration: 4s, requires tap to dismiss.
- `major`: Modal with screen-wide glow, GAIA monologue (3+ sentences), cosmetic unlock prompt, title unlock. Duration: 6s, requires tap.
- `fullscreen`: Full-screen takeover (identical to Legendary gacha reveal intensity), unique GAIA monologue referencing the specific fact ("You have permanently learned that [fact]. That knowledge is YOURS now."), golden leaf animation on Knowledge Tree, achievement badge. Duration: until dismissed. Per DD-V2-108.

#### Step 6: Update `src/ui/components/FactReveal.svelte`

Replace the existing reveal animation block with `<GachaReveal>`. Add `<NearMissBanner>` after reveal completes. Wire `CelebrationManager.notifyMastery()` for the first mastery unlock if the fact is being added to study rotation.

#### Step 7: Update `src/data/gaiaDialogue.ts`

Add these new dialogue keys. Each key maps to an array of 3+ variants. The correct variant is chosen by `GaiaManager` based on current mood:

```
firstMastery:        — unique, non-repeating monologue referencing the specific fact
mastery5:            — "Five down. The tree is growing, miner."
mastery10:           — "Ten facts mastered. I am genuinely impressed."
mastery25:           — "Twenty-five. You have a Scholar's mind."
mastery50:           — "Fifty facts permanently locked in. Half a century of knowledge."
mastery100:          — extended 3-sentence monologue, reverent tone
mastery250:          — "A quarter-thousand facts. Encyclopedists have written less."
mastery500:          — "Five hundred. You know more about Earth than most people alive."
masteryN:            — short rotating quip for counts 2-9
categoryComplete:    — "Every fact in [category] — mastered. A complete branch."
```

### Acceptance Criteria

- [ ] `GachaReveal.svelte` renders distinct animations for all 6 rarity tiers with no regressions to existing `FactReveal.svelte` behavior
- [ ] Common reveals complete in ~0.4s; Mythic reveals complete in ~3.5s (time the animations in browser)
- [ ] Near-miss banner appears exactly when rarity is `epic` (not below) or `legendary` (not below mythic)
- [ ] Near-miss banner does NOT appear for common/uncommon/rare artifacts
- [ ] Mastery count 1 triggers fullscreen celebration (verify in DevPanel by giving 10+ correct answers on same fact)
- [ ] Mastery counts 2-9 trigger glow + GAIA toast only
- [ ] Mastery count 10 triggers banner-tier celebration with +50 dust awarded to save
- [ ] Mastery count 25 unlocks "Scholar" title in `save.titles[]`
- [ ] Mastery count 100 triggers major celebration with +500 dust
- [ ] Category completion triggers fullscreen celebration
- [ ] `npm run typecheck` passes

### Playwright Test — 17.1

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Open DevPanel and navigate to progression section
  await page.keyboard.press('`')
  await page.waitForSelector('.dev-panel', { timeout: 3000 })

  // Use dev panel to simulate first mastery celebration
  const masteryBtn = page.locator('button:has-text("Trigger First Mastery")')
  if (await masteryBtn.isVisible()) {
    await masteryBtn.click()
    await page.waitForTimeout(400)
    // Should see fullscreen overlay
    const overlay = await page.locator('.gacha-overlay, .mastery-fullscreen').first()
    const isVisible = await overlay.isVisible().catch(() => false)
    console.log('First mastery fullscreen visible:', isVisible)
    await page.screenshot({ path: '/tmp/ss-mastery-fullscreen.png' })
  }

  // Test rarity animations for each tier via FactReveal
  // (inject save with artifacts of known rarities via DevPanel)
  await page.screenshot({ path: '/tmp/ss-17-1-state.png' })
  await browser.close()
})()
```

---

## Sub-Phase 17.2: Sound Design Enhancement

### What

Replace the existing Web Audio API synthesizer sounds in `src/services/audioService.ts` with proper audio files. Add chiptune/lo-fi background music that is biome-specific in the mine and calm in the dome. Add escalating gacha fanfares per rarity tier. Add satisfying block-type mining sounds. Add GAIA voice/sound cues on key events.

### Where — Files to Create

| File | Purpose |
|---|---|
| `src/assets/audio/sfx/` | Directory for all sound effect files |
| `src/assets/audio/music/` | Directory for all background music tracks |
| `src/assets/audio/sfx/reveal_common.ogg` | Common rarity reveal sting (0.4s) |
| `src/assets/audio/sfx/reveal_uncommon.ogg` | Uncommon reveal sting (0.6s) |
| `src/assets/audio/sfx/reveal_rare.ogg` | Rare reveal fanfare (0.9s) |
| `src/assets/audio/sfx/reveal_epic.ogg` | Epic reveal fanfare (1.4s) |
| `src/assets/audio/sfx/reveal_legendary.ogg` | Legendary reveal fanfare with orchestral hit (2.2s) |
| `src/assets/audio/sfx/reveal_mythic.ogg` | Mythic reveal fanfare — dramatic, unique (3.5s) |
| `src/assets/audio/sfx/mine_dirt.ogg` | Soft thud, soil crunch |
| `src/assets/audio/sfx/mine_soft_rock.ogg` | Medium crack, sandy |
| `src/assets/audio/sfx/mine_stone.ogg` | Hard crack, rocky |
| `src/assets/audio/sfx/mine_hard_rock.ogg` | Deep clunk, granite-like |
| `src/assets/audio/sfx/mine_unbreakable.ogg` | Metallic clang, reverb |
| `src/assets/audio/sfx/mine_mineral.ogg` | Crystal/glass tinkle |
| `src/assets/audio/sfx/mine_artifact.ogg` | Ancient resonance, echo |
| `src/assets/audio/sfx/quiz_correct.ogg` | Ascending chime, satisfying |
| `src/assets/audio/sfx/quiz_wrong.ogg` | Low buzzer, non-harsh |
| `src/assets/audio/sfx/mastery_glow.ogg` | Soft shimmer ping |
| `src/assets/audio/sfx/mastery_fullscreen.ogg` | Full fanfare for #1 mastery |
| `src/assets/audio/sfx/streak_milestone.ogg` | Bright success fanfare |
| `src/assets/audio/sfx/gaia_quip.ogg` | Short GAIA notification chime |
| `src/assets/audio/sfx/lava_sizzle.ogg` | Hiss + crackling when hitting lava |
| `src/assets/audio/sfx/gas_pocket.ogg` | Hiss + cough sound on gas |
| `src/assets/audio/sfx/earthquake_rumble.ogg` | Low rumble, 2s |
| `src/assets/audio/sfx/item_pickup.ogg` | Quick positive ping |
| `src/assets/audio/sfx/oxygen_low.ogg` | Urgent heartbeat-style warning |
| `src/assets/audio/sfx/oxygen_critical.ogg` | Faster heartbeat, more urgent |
| `src/assets/audio/sfx/dive_complete.ogg` | Ascending sweep on surfacing |
| `src/assets/audio/sfx/streak_freeze_used.ogg` | Ice crackle sfx |
| `src/assets/audio/sfx/button_click.ogg` | Pixel-art UI click |
| `src/assets/audio/music/dome_calm.ogg` | Dome ambient — lo-fi, calm, 2:30 loop |
| `src/assets/audio/music/biome_sedimentary.ogg` | Earthy, slow percussion, 2:00 loop |
| `src/assets/audio/music/biome_volcanic.ogg` | Tense, low drones, 2:00 loop |
| `src/assets/audio/music/biome_crystalline.ogg` | Ethereal, glass-like, 2:00 loop |
| `src/assets/audio/music/biome_fungal.ogg` | Organic, mysterious, 2:00 loop |
| `src/assets/audio/music/biome_ancient.ogg` | Atmospheric, reverent, 2:00 loop |
| `src/assets/audio/music/biome_generic.ogg` | Generic underground fallback, 2:00 loop |

### Where — Files to Modify

| File | Change |
|---|---|
| `src/services/audioService.ts` | Load audio files instead of synthesizing; add `playMusic(track, fadeMs)`, `stopMusic(fadeMs)`, `setMusicVolume(v)` |
| `src/game/scenes/BootScene.ts` | Preload all audio keys via `this.load.audio()` |
| `src/game/scenes/MineScene.ts` | Call `audioService.playMusic(biomeMusicKey)` on scene start; call `audioService.stopMusic()` on exit |
| `src/game/GameManager.ts` | Call appropriate sfx for mining events, quiz results, hazard hits |
| `src/ui/stores/settings.ts` | Expose `musicVolume`, `sfxVolume` writables backed by localStorage |
| `src/ui/components/Settings.svelte` | Add music and sfx volume sliders; wire to `settings.ts` stores |

### How — Step-by-Step

#### Step 1: Add audio stores to `src/ui/stores/settings.ts`

```typescript
// Add to existing settings stores:
export const musicVolume = persisted<number>('setting_musicVolume', 0.6)
export const sfxVolume   = persisted<number>('setting_sfxVolume',   0.8)
export const musicEnabled = persisted<boolean>('setting_musicEnabled', true)
export const sfxEnabled   = persisted<boolean>('setting_sfxEnabled', true)
```

#### Step 2: Refactor `src/services/audioService.ts`

The `AudioManager` class must:
1. Accept an initialized `Phaser.Sound.BaseSoundManager` in `init(soundManager)` OR use the Web Audio API for non-Phaser contexts (Svelte UI).
2. Provide `playSound(key: SoundKey): void` — plays once, respects `sfxVolume` and `sfxEnabled`.
3. Provide `playMusic(trackKey: MusicKey, fadeMs = 500): void` — fades in new track, fades out current. Cross-fade if different track already playing.
4. Provide `stopMusic(fadeMs = 500): void` — fade out.
5. All keys defined as string union types for type safety.

#### Step 3: Biome-to-music mapping in `src/data/biomes.ts`

Add a `musicKey` field to each biome definition:

```typescript
// Example additions to existing biome objects:
{ id: 'sedimentary', name: 'Sedimentary Layers', musicKey: 'biome_sedimentary', ... }
{ id: 'volcanic',    name: 'Volcanic Zone',        musicKey: 'biome_volcanic',    ... }
{ id: 'crystalline', name: 'Crystal Caverns',      musicKey: 'biome_crystalline', ... }
```

Biomes without a specific track fall back to `biome_generic`.

#### Step 4: Wire music start in `src/game/scenes/MineScene.ts`

```typescript
// In MineScene.create():
const biome = this.currentBiome  // already set during generation
const musicKey = biome?.musicKey ?? 'biome_generic'
audioManager.playMusic(musicKey, 800)

// In shutdown/exit:
audioManager.stopMusic(500)
```

#### Chiptune Specifications

All SFX are 8-bit / chiptune style, mono, 44.1kHz, OGG Vorbis format, -14 LUFS normalized.

**Reveal sting escalation spec** (implement via chiptune tracker or commission):
- `reveal_common`: 3-note ascending arpeggio, square wave, 0.4s, ends on tonic
- `reveal_uncommon`: 4-note arpeggio + sustained note, saw wave, 0.6s
- `reveal_rare`: 5-note fanfare + reverb tail, mixed square/triangle, 0.9s
- `reveal_epic`: 8-note major scale run + chord hit + bell tail, 1.4s
- `reveal_legendary`: Full 8-bit orchestral intro (5 instruments), dramatic descending then ascending, gold shimmer tail, 2.2s
- `reveal_mythic`: Starts with silence (0.3s), then massive ascending sweep + 3-chord climax + reverb explosion, 3.5s

**Background music spec** (biome tracks):
- All tracks: 120-140 BPM, loopable at bar boundary, lo-fi / chiptune aesthetic
- `dome_calm`: C major, piano/vibraphone feel, no percussion, meditative
- `biome_sedimentary`: D minor, slow kick drum, bass thrum, earthy
- `biome_volcanic`: F# minor, tremolo strings, low drone, increasing tension
- `biome_crystalline`: A major, arpeggiated bells, light and mysterious
- `biome_fungal`: G minor, organic bassline, unusual time signature (7/8), eerie
- `biome_ancient`: E minor, reverb-heavy, choir-like pad, slow evolving

### Acceptance Criteria

- [ ] Audio files exist in `src/assets/audio/sfx/` and `src/assets/audio/music/` at correct paths
- [ ] `BootScene.ts` preloads all audio keys without console errors
- [ ] Mining a Dirt block plays `mine_dirt.ogg`, Stone plays `mine_stone.ogg`
- [ ] Correct quiz answer plays `quiz_correct.ogg`; wrong answer plays `quiz_wrong.ogg`
- [ ] Entering mine with Sedimentary biome starts `biome_sedimentary.ogg`; surfacing stops it with fade
- [ ] `reveal_legendary.ogg` is perceptibly louder/longer/more dramatic than `reveal_rare.ogg`
- [ ] Music volume and SFX volume sliders in Settings.svelte work and persist on reload
- [ ] No audio plays when `sfxEnabled = false` or `musicEnabled = false`
- [ ] `npm run typecheck` passes

### Playwright Test — 17.2

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Navigate to Settings and verify audio volume sliders
  const settingsBtn = page.locator('button[aria-label="Settings"]')
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click()
    await page.waitForTimeout(500)
    const musicSlider = page.locator('input[type="range"][aria-label*="music" i], input[type="range"][aria-label*="Music" i]')
    const sfxSlider   = page.locator('input[type="range"][aria-label*="sfx" i], input[type="range"][aria-label*="SFX" i]')
    console.log('Music slider visible:', await musicSlider.isVisible().catch(() => false))
    console.log('SFX slider visible:',   await sfxSlider.isVisible().catch(() => false))
  }

  await page.screenshot({ path: '/tmp/ss-17-2-audio-settings.png' })
  await browser.close()
})()
```

---

## Sub-Phase 17.3: Session Flow Optimization

### What

Optimize the game for two specific session length targets: the **quick session** (5-7 minutes, layers 1-5) and the **deep session** (15-25 minutes, layers 10+). Add "one more dive" informational hooks. Add persistent progress bars across all dome screens. Cross-reference Phase 8.14 simulation results to validate targets.

### Where — Files to Create

| File | Purpose |
|---|---|
| `src/ui/components/PostDiveHooks.svelte` | Shows informational hooks after every dive |
| `src/ui/components/ProgressBars.svelte` | Reusable component for milestone/unlock progress indicators |
| `src/game/systems/SessionTracker.ts` | Tracks session start time, dive count this session, block count; drives diminishing returns |

### Where — Files to Modify

| File | Change |
|---|---|
| `src/ui/components/DiveResults.svelte` | Append `<PostDiveHooks>` after dive summary |
| `src/ui/components/BaseView.svelte` | Add `<ProgressBars>` to header visible in all rooms |
| `src/ui/components/DiveResults.svelte` | Show session timing metrics in dev mode |
| `src/game/GameManager.ts` | Instantiate `SessionTracker`, expose to Svelte via store |
| `src/data/balance.ts` | Add session timing constants and anti-binge thresholds |

### How — Step-by-Step

#### Step 1: Add session timing constants to `src/data/balance.ts`

```typescript
// === SESSION DESIGN TARGETS ===
// Per Phase 17.3, DD-V2-135, DD-V2-137, DD-V2-141
SESSION_QUICK_TARGET_MS: 5 * 60 * 1000,    // 5 minutes
SESSION_DEEP_TARGET_MS:  15 * 60 * 1000,   // 15 minutes
SESSION_COZY_TARGET_MS:  3 * 60 * 1000,    // 3 minutes (dome-only)

// === ANTI-BINGE (DIMINISHING RETURNS) ===
// After ANTI_BINGE_DIVE_THRESHOLD dives in one session:
// - Mineral drops: multiplied by ANTI_BINGE_MINERAL_MULT
// - Quiz dust bonus: disabled (ANTI_BINGE_DISABLE_QUIZ_BONUS = true)
// - GAIA suggests a break after each subsequent dive
ANTI_BINGE_DIVE_THRESHOLD: 3,
ANTI_BINGE_MINERAL_MULT: 0.65,  // 35% reduction on minerals — still worth playing, just tapering
ANTI_BINGE_DISABLE_QUIZ_BONUS: true,
ANTI_BINGE_GAIA_MESSAGES: [
  "You've been at this a while. Your brain learns better with rest — even a 10-minute break helps.",
  "Three dives! That's impressive dedication. A short break now will make the next dive more fun.",
  "G.A.I.A. recommends: rest. The minerals will still be here.",
] as const,
```

#### Step 2: Create `src/game/systems/SessionTracker.ts`

```typescript
import { BALANCE } from '../../data/balance'

/**
 * Tracks the current play session for anti-binge and session-flow analytics.
 * Instantiated by GameManager, persisted only for current app lifecycle (not saved to disk).
 */
export class SessionTracker {
  private sessionStartMs: number = Date.now()
  private divesThisSession: number = 0
  private blocksThisSession: number = 0

  startSession(): void {
    this.sessionStartMs = Date.now()
    this.divesThisSession = 0
    this.blocksThisSession = 0
  }

  recordDiveComplete(): void {
    this.divesThisSession++
  }

  recordBlockMined(): void {
    this.blocksThisSession++
  }

  get sessionElapsedMs(): number {
    return Date.now() - this.sessionStartMs
  }

  get diveCount(): number {
    return this.divesThisSession
  }

  /** Returns true after the anti-binge threshold is exceeded. */
  get isAntiBingeActive(): boolean {
    return this.divesThisSession >= BALANCE.ANTI_BINGE_DIVE_THRESHOLD
  }

  /**
   * Returns the mineral drop multiplier for the current session.
   * Returns 1.0 normally; reduced after ANTI_BINGE_DIVE_THRESHOLD dives.
   */
  get mineralMultiplier(): number {
    return this.isAntiBingeActive ? BALANCE.ANTI_BINGE_MINERAL_MULT : 1.0
  }

  /**
   * Whether the quiz dust bonus is currently disabled (anti-binge).
   */
  get quizBonusDisabled(): boolean {
    return this.isAntiBingeActive && BALANCE.ANTI_BINGE_DISABLE_QUIZ_BONUS
  }

  /**
   * Returns a random GAIA anti-binge break suggestion message.
   * Only call when isAntiBingeActive === true.
   */
  get antiBingeGaiaMessage(): string {
    const msgs = BALANCE.ANTI_BINGE_GAIA_MESSAGES
    return msgs[Math.floor(Math.random() * msgs.length)]
  }
}
```

#### Step 3: Create `src/ui/components/PostDiveHooks.svelte`

The post-dive hooks panel is strictly informational — no urgency, no guilt. Per DD-V2-137:

```svelte
<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { reviewStates } from '../stores/gameState'

  const save = $derived($playerSave)

  // Hook 1: Facts close to mastery ("2 more reviews to master Neptune")
  const nearMasteryFacts = $derived.by(() => {
    // reviewStates with repetitions >= 4 and interval < 21 days
    return ($reviewStates ?? [])
      .filter(r => r.repetitions >= 4 && r.repetitions <= 6)
      .slice(0, 2)
  })

  // Hook 2: Incomplete Data Discs
  const incompleteDiscs = $derived.by(() => {
    return (save?.unlockedDiscs ?? [])
      .filter(d => !d.complete)
      .slice(0, 1)
  })

  // Hook 3: Next room unlock progress
  const nextRoomProgress = $derived.by(() => {
    // ... compute progress toward next locked room
    return null  // placeholder until Phase 10 integration
  })

  // Hook 4: Fossil progress
  const nearRevivalFossil = $derived.by(() => {
    return null  // placeholder until Phase 16 integration
  })
</script>

{#if nearMasteryFacts.length > 0 || incompleteDiscs.length > 0}
  <div class="post-dive-hooks" aria-label="Progress nudges">
    <h3 class="hooks-title">Almost there...</h3>

    {#each nearMasteryFacts as rs}
      <div class="hook-item hook-mastery">
        <span class="hook-icon">🌿</span>
        <span class="hook-text">
          {6 - rs.repetitions} more review{6 - rs.repetitions !== 1 ? 's' : ''} to master a fact
        </span>
      </div>
    {/each}

    {#each incompleteDiscs as disc}
      <div class="hook-item hook-disc">
        <span class="hook-icon">💿</span>
        <span class="hook-text">
          Unfinished Data Disc: {disc.name} ({disc.learned}/{disc.total} facts)
        </span>
      </div>
    {/each}

    {#if nearRevivalFossil}
      <div class="hook-item hook-fossil">
        <span class="hook-icon">🦕</span>
        <span class="hook-text">
          {nearRevivalFossil.factsNeeded - nearRevivalFossil.factsLearned} facts to revive {nearRevivalFossil.name}
        </span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .post-dive-hooks {
    background: var(--color-surface);
    border-radius: 12px;
    padding: 14px 16px;
    margin: 8px;
  }

  .hooks-title {
    color: var(--color-text-dim);
    font-size: 0.78rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 0 0 10px;
  }

  .hook-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .hook-item:last-child {
    border-bottom: none;
  }

  .hook-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
  }

  .hook-text {
    color: var(--color-text);
    font-size: 0.85rem;
    line-height: 1.3;
  }
</style>
```

#### Step 4: Session Flow Hook Point Audit Checklist

Before considering 17.3 complete, verify every natural session-end point has a visible hook:

| Session-End Point | Expected Hook | Source |
|---|---|---|
| After dive complete (surfaced with loot) | PostDiveHooks: near-mastery, disc progress, fossil progress | DiveResults.svelte |
| After study session ends | "X facts reviewed. Next review in Y days." progress summary | StudySession.svelte |
| After Knowledge Tree browsing | Branch completion % visible, "X away from 50%" shown | KnowledgeTreeView.svelte |
| After farming | Farm next-ready timer visible | Farm.svelte |
| Before leaving dome (pressing Dive again) | DivePrepScreen shows deepest layer reached, current best | DivePrepScreen.svelte |
| On app open (cold start) | Daily login reward day shown, streak progress shown | BaseView.svelte / DomeView.svelte |

#### Step 5: Progress Bars everywhere

Add to `BaseView.svelte` header area (below room tabs, always visible):

- Streak progress bar toward next milestone (compact, 1 line)
- Facts due for review count (non-urgent: "12 facts ready", not red)
- Current dive count progress bar toward next room unlock

Keep bars compact (max height 6px, label in small text) — they must not dominate the UI.

#### Session Timing Targets (Cross-Reference)

These targets are informed by Phase 8.14 balance simulation. Verify empirically during QA:

| Session Type | Target Duration | Typical Actions |
|---|---|---|
| Quick (layers 1-5) | 5-7 minutes | 1 dive + deposit + optional 5-card review |
| Deep (layers 10+) | 15-25 minutes | 1-2 dives + study session + crafting |
| Cozy (dome only) | 3-5 minutes | Farm collect + 5-card study + GAIA chat |
| Pure review | 2-4 minutes | 10-card study session only |

### Acceptance Criteria

- [ ] `PostDiveHooks.svelte` appears after every dive with at least one hook item when the player has any incomplete data discs OR near-mastery facts
- [ ] Anti-binge activates after 3rd dive in one app session (verify mineral drops are 35% lower)
- [ ] GAIA break message appears after 3rd dive completion (check GaiaToast fires)
- [ ] Anti-binge does NOT persist across app restarts (SessionTracker resets on `startSession()`)
- [ ] Progress bars visible in BaseView header area
- [ ] Session timer shows in DevPanel debug info section
- [ ] `npm run typecheck` passes

### Playwright Test — 17.3

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Verify progress bars visible in base view
  const progressBar = page.locator('.progress-bar-fill, [role="progressbar"]').first()
  console.log('Progress bar visible in dome:', await progressBar.isVisible().catch(() => false))

  // Enter mine and exit to trigger PostDiveHooks
  await page.click('button:has-text("Dive")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Enter Mine")')
  await page.waitForTimeout(2000)

  // Surface by pressing escape or using dev shortcut
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1500)

  // PostDiveHooks should appear in DiveResults
  const hooks = page.locator('.post-dive-hooks')
  console.log('PostDiveHooks visible after dive:', await hooks.isVisible().catch(() => false))

  await page.screenshot({ path: '/tmp/ss-17-3-post-dive.png' })
  await browser.close()
})()
```

---

## Sub-Phase 17.4: Re-engagement Triggers

### What

Implement Capacitor-based push notifications with GAIA-voiced content (per DD-V2-159). Build the daily login reward calendar UI and claim logic (DD-V2-144). Add comeback bonuses for players returning after 3+ days absence. Implement the 7-day login reward calendar rotation logic.

### Where — Files to Create

| File | Purpose |
|---|---|
| `src/services/notificationService.ts` | Capacitor push notification wrapper; scheduling, opt-in flow |
| `src/ui/components/LoginCalendar.svelte` | 7-day login reward calendar UI |
| `src/ui/components/ComebackBonus.svelte` | Welcome-back overlay for players absent 3+ days |
| `src/data/loginRewards.ts` | Day 1–7 reward definitions (static, per DD-V2-144) |

### Where — Files to Modify

| File | Change |
|---|---|
| `src/data/balance.ts` | Add `LOGIN_CALENDAR_REWARDS` array, `COMEBACK_BONUS_THRESHOLD_DAYS` |
| `src/services/saveService.ts` | Add `lastLoginDate`, `loginCalendarDay`, `loginCalendarLastClaimed` to `PlayerSave` |
| `src/data/types.ts` | Add `LoginReward` interface to player save |
| `src/ui/components/BaseView.svelte` | Show `<LoginCalendar>` and `<ComebackBonus>` on session start |
| `src/game/GameManager.ts` | Call `notificationService.schedule()` after first successful dive |

### How — Step-by-Step

#### Step 1: Define login rewards in `src/data/balance.ts`

Per DD-V2-144 exactly:

```typescript
// === LOGIN REWARD CALENDAR (7-day rotating) ===
// Per DD-V2-144. Resets to Day 1 after Day 7 is claimed — NOT on missed days.
LOGIN_CALENDAR_REWARDS: [
  {
    day: 1,
    type: 'dust',
    amount: 50,
    icon: 'icon_dust',
    label: '50 Dust',
    description: 'A small stash to get you going.',
  },
  {
    day: 2,
    type: 'bomb',
    amount: 1,
    icon: 'icon_bomb',
    label: '1 Bomb',
    description: 'Clears a 3×3 area underground.',
  },
  {
    day: 3,
    type: 'dust',
    amount: 100,
    icon: 'icon_dust',
    label: '100 Dust',
    description: 'Double the haul.',
  },
  {
    day: 4,
    type: 'streak_freeze',
    amount: 1,
    icon: 'icon_freeze',
    label: 'Streak Freeze',
    description: 'Protect your streak from one missed day.',
  },
  {
    day: 5,
    type: 'shard',
    amount: 1,
    icon: 'icon_shard',
    label: '1 Shard',
    description: 'A mineral fragment from deeper layers.',
  },
  {
    day: 6,
    type: 'data_disc_random',
    amount: 1,
    icon: 'icon_disc',
    label: 'Random Data Disc',
    description: 'Unlocks a collection of facts.',
  },
  {
    day: 7,
    type: 'artifact_uncommon_plus',
    amount: 1,
    icon: 'icon_artifact',
    label: 'Guaranteed Uncommon+ Artifact',
    description: 'The week\'s prize. Uncommon or better — guaranteed.',
  },
] as const,

// === COMEBACK BONUS ===
COMEBACK_BONUS_THRESHOLD_DAYS: 3,     // Absent 3+ days triggers comeback bonus
COMEBACK_OXYGEN_BONUS: 1,             // +1 extra oxygen tank on comeback
COMEBACK_ARTIFACT_RARITY_FLOOR: 'uncommon', // First artifact of comeback dive is at least uncommon
```

#### Step 2: Create `src/data/loginRewards.ts`

```typescript
import { BALANCE } from './balance'
import type { PlayerSave, MineralTier } from './types'
import { save } from '../services/saveService'

/** Returns the current login calendar day (1-7) for a player save. */
export function getLoginCalendarDay(s: PlayerSave): number {
  return s.loginCalendarDay ?? 1
}

/** Returns whether today's login reward has already been claimed. */
export function isTodayClaimed(s: PlayerSave): boolean {
  if (!s.loginCalendarLastClaimed) return false
  const lastDate = new Date(s.loginCalendarLastClaimed)
  const today = new Date()
  return (
    lastDate.getFullYear() === today.getFullYear() &&
    lastDate.getMonth()    === today.getMonth() &&
    lastDate.getDate()     === today.getDate()
  )
}

/**
 * Claims today's login reward and advances the calendar.
 * Returns the reward that was claimed.
 * Caller is responsible for applying the reward to the PlayerSave and calling save().
 */
export function claimLoginReward(s: PlayerSave): typeof BALANCE.LOGIN_CALENDAR_REWARDS[number] {
  const day = getLoginCalendarDay(s)
  const reward = BALANCE.LOGIN_CALENDAR_REWARDS.find(r => r.day === day)!

  // Advance to next day; wrap from 7 back to 1
  const nextDay = day >= 7 ? 1 : day + 1

  s.loginCalendarDay = nextDay
  s.loginCalendarLastClaimed = Date.now()

  return reward
}

/** Returns number of days since last login, or 0 if same day. */
export function daysSinceLastLogin(s: PlayerSave): number {
  if (!s.lastLoginDate) return 0
  const last = new Date(s.lastLoginDate)
  const now = new Date()
  const diffMs = now.getTime() - last.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/** Updates lastLoginDate to now. Call once per session. */
export function recordLogin(s: PlayerSave): void {
  s.lastLoginDate = Date.now()
}
```

#### Step 3: Create `src/ui/components/LoginCalendar.svelte`

The calendar is shown automatically on first dome visit per session. Claimed rewards are shown with a checkmark. Unclaimed today shows a glowing "Claim" button. Future days are locked but visible.

Key behavior:
- Calendar resets to Day 1 after Day 7 is claimed (not on missed days — per DD-V2-144)
- The GAIA message on Day 7 claim: "You came back every day this week. I noticed."
- Day 7 reward uses the gacha animation from `GachaReveal.svelte` (it's an artifact reveal)
- Dismissed by tapping anywhere outside the modal

#### Step 4: Create `src/ui/components/ComebackBonus.svelte`

Shown when `daysSinceLastLogin(save) >= BALANCE.COMEBACK_BONUS_THRESHOLD_DAYS`.

GAIA message variants (pick one at random):
- (3-6 days) "You're back! I decoded some artifacts while you were away. Ready to dive?"
- (7-13 days) "A whole week! Your Knowledge Tree missed you. Here — extra oxygen to get back in the groove."
- (14-29 days) "It's been a while, miner. No judgment. The mine waits. Your tree still grows."
- (30+ days) "You returned. That's what matters. Everything is here, waiting. Let's go."

Always awards: +1 oxygen tank; first artifact of next dive guaranteed `uncommon` or higher.

#### Step 5: Create `src/services/notificationService.ts`

```typescript
/**
 * Push notification service using Capacitor LocalNotifications.
 * Only active on native mobile builds (Capacitor). Web builds no-op gracefully.
 *
 * Per DD-V2-159:
 * - Maximum 1 notification per day, only if app not opened
 * - Permission requested AFTER first successful dive
 * - Stop all notifications after 7 consecutive no-engagement days
 * - All content is GAIA-voiced, in character
 */

const IS_NATIVE = typeof (window as unknown as Record<string, unknown>)['Capacitor'] !== 'undefined'

export interface NotificationContent {
  title: string
  body: string
  /** Seconds from now to show the notification */
  delaySeconds: number
}

// === NOTIFICATION CONTENT TEMPLATES ===
// All GAIA-voiced. Never use urgency framing. Never guilt-trip.
export const NOTIFICATION_TEMPLATES = {
  streakReminder: [
    { title: 'G.A.I.A.', body: 'Your expedition is waiting. Even a quick dive keeps the momentum.' },
    { title: 'G.A.I.A.', body: 'The mine has been quiet today. You coming?' },
    { title: 'G.A.I.A.', body: 'Your Knowledge Tree is ready for some new leaves.' },
  ],
  reviewReady: [
    { title: 'G.A.I.A.', body: 'Some facts are due for review. Your brain is ready to strengthen them.' },
    { title: 'G.A.I.A.', body: 'Memory check: I found connections between some of your stored facts.' },
    { title: 'G.A.I.A.', body: 'A few facts are ready to be reinforced. 5 minutes, miner.' },
  ],
  petNeedsAttention: [
    { title: 'G.A.I.A.', body: 'Your fossil companion is restless. Just checking in.' },
    { title: 'G.A.I.A.', body: 'The zoo residents are lively today. Worth a visit.' },
  ],
  farmReady: [
    { title: 'G.A.I.A.', body: 'Your farm has something ready to harvest.' },
    { title: 'G.A.I.A.', body: 'Farm production complete. A quick collection run awaits.' },
  ],
} as const satisfies Record<string, readonly { title: string; body: string }[]>

export type NotificationCategory = keyof typeof NOTIFICATION_TEMPLATES

/**
 * Request notification permission — call ONLY after first successful dive completes.
 * Per DD-V2-159: never request during onboarding.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!IS_NATIVE) return false
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const result = await LocalNotifications.requestPermissions()
    return result.display === 'granted'
  } catch {
    return false
  }
}

/**
 * Schedule tomorrow's reminder notification (if app not opened today).
 * Call once per session after login is recorded.
 */
export async function scheduleDailyReminder(category: NotificationCategory): Promise<void> {
  if (!IS_NATIVE) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const templates = NOTIFICATION_TEMPLATES[category]
    const template = templates[Math.floor(Math.random() * templates.length)]

    // Schedule for next day at 10:00 AM local time
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)

    await LocalNotifications.schedule({
      notifications: [{
        id: 1001, // Fixed ID — overwrite previous day's reminder
        title: template.title,
        body: template.body,
        schedule: { at: tomorrow },
        smallIcon: 'ic_notification',
        iconColor: '#4a9eff',
      }]
    })
  } catch (e) {
    console.warn('[NotificationService] schedule failed:', e)
  }
}

/** Cancel all scheduled notifications. Call after 7 days of no engagement. */
export async function cancelAllNotifications(): Promise<void> {
  if (!IS_NATIVE) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: 1001 }] })
  } catch {
    // silent
  }
}
```

### Acceptance Criteria

- [ ] `LoginCalendar.svelte` renders all 7 days with correct reward labels from `BALANCE.LOGIN_CALENDAR_REWARDS`
- [ ] Claiming Day 1 reward awards 50 dust to `save.minerals.dust` and persists on reload
- [ ] Claiming Day 7 reward awards an artifact with rarity `uncommon` or better (run 5 times, verify)
- [ ] After Day 7 is claimed, the calendar resets to Day 1 (not blocked until next week)
- [ ] Missing a day does NOT reset the calendar
- [ ] `ComebackBonus.svelte` appears when loading save where `lastLoginDate` is 3+ days ago (test by editing localStorage)
- [ ] Comeback bonus awards +1 oxygen tank visible in pre-dive screen
- [ ] `notificationService.ts` compiles without error (IS_NATIVE path is never reached in web build)
- [ ] `npm run typecheck` passes

### Playwright Test — 17.4

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Inject a save that is 4 days old to test comeback bonus
  await page.evaluate(() => {
    const raw = localStorage.getItem('recall-rogue-save')
    if (raw) {
      const s = JSON.parse(raw)
      s.lastLoginDate = Date.now() - (4 * 24 * 60 * 60 * 1000)
      localStorage.setItem('recall-rogue-save', JSON.stringify(s))
    }
  })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Should see comeback bonus overlay
  const comebackOverlay = page.locator('.comeback-bonus, [data-testid="comeback-bonus"]')
  console.log('Comeback bonus visible:', await comebackOverlay.isVisible().catch(() => false))

  await page.screenshot({ path: '/tmp/ss-17-4-comeback.png' })

  // Verify login calendar renders
  const calendar = page.locator('.login-calendar, [data-testid="login-calendar"]')
  console.log('Login calendar visible:', await calendar.isVisible().catch(() => false))
  await page.screenshot({ path: '/tmp/ss-17-4-calendar.png' })

  await browser.close()
})()
```

---

## Sub-Phase 17.5: Streak & Consistency System

### What

Expand the existing `StreakPanel.svelte` and `BALANCE.STREAK_MILESTONES` with the full milestone schedule through day 365. Implement anti-binge diminishing returns formula (already partially defined in 17.3). Implement grace period logic (1 per 30-day window). Add weekly challenges system (DD-V2-140). Build login calendar integration (connects to 17.4). Apply positive streak reframing copy throughout (DD-V2-158).

### Where — Files to Create

| File | Purpose |
|---|---|
| `src/ui/components/WeeklyChallenge.svelte` | Weekly challenge display + progress tracking |
| `src/data/weeklyChallenges.ts` | Pool of 30+ challenge definitions, rotation logic |
| `src/game/systems/ChallengeTracker.ts` | Tracks challenge progress, persists in save |

### Where — Files to Modify

| File | Change |
|---|---|
| `src/data/balance.ts` | Expand `STREAK_MILESTONES` through day 365; add `GRACE_PERIOD_WINDOW_DAYS`, `GRACE_PERIOD_MAX_USES` |
| `src/services/saveService.ts` | Add `longestStreak`, `gracePeriodUsedAt`, `weeklyChallengeSeed`, `weeklyChallengeClaimed[]` to PlayerSave |
| `src/data/types.ts` | Add `WeeklyChallenge` interface, `ChallengeProgress` to PlayerSave |
| `src/ui/components/StreakPanel.svelte` | Show `longestStreak`, reframe break copy, show `WeeklyChallenge` list |
| `src/ui/components/BaseView.svelte` | Show weekly challenge summary widget in Command Center |
| `src/game/GameManager.ts` | Call `ChallengeTracker.recordBlockMined()`, `recordDive()`, `recordFactLearned()` on events |
| `src/data/gaiaDialogue.ts` | Add streak-positive reframing copy for streak break events |

### How — Step-by-Step

#### Step 1: Full streak milestone schedule in `src/data/balance.ts`

Replace the existing 6-entry `STREAK_MILESTONES` array with the complete schedule through day 365+. The rewards escalate meaningfully at each milestone. Titles are permanent and displayed in StreakPanel.

```typescript
STREAK_MILESTONES: [
  // Week 1 — building the habit
  { days: 3,   reward: 'oxygen_bonus',    value: 1,    name: '3-Day Explorer',      description: '+1 oxygen tank on all future dives' },
  { days: 7,   reward: 'dust_bonus',      value: 100,  name: 'Weekly Miner',        description: '+100 bonus dust + title unlocked', title: 'Explorer' },

  // Weeks 2-4 — habit solidifying
  { days: 14,  reward: 'crystal_bonus',   value: 3,    name: 'Dedicated Scholar',   description: '+3 crystals' },
  { days: 21,  reward: 'dust_bonus',      value: 200,  name: 'Three Weeks Deep',    description: '+200 dust' },
  { days: 30,  reward: 'geode_bonus',     value: 2,    name: 'Monthly Master',      description: '+2 geodes + title unlocked', title: 'Miner' },

  // Months 2-3 — durable engagement
  { days: 45,  reward: 'shard_bonus',     value: 10,   name: 'Forty-Five',          description: '+10 shards' },
  { days: 60,  reward: 'essence_bonus',   value: 1,    name: 'Legendary Streak',    description: '+1 primordial essence + title unlocked', title: 'Scholar' },
  { days: 75,  reward: 'dust_bonus',      value: 500,  name: 'Seventy-Five Days',   description: '+500 dust' },
  { days: 90,  reward: 'geode_bonus',     value: 5,    name: 'Quarter Year',        description: '+5 geodes + exclusive cosmetic badge' },

  // The century milestone
  { days: 100, reward: 'title',           value: 0,    name: 'Centurion',           description: 'Exclusive "Centurion" title — a permanent mark of dedication', title: 'Centurion' },

  // 4-6 months
  { days: 120, reward: 'essence_bonus',   value: 3,    name: 'Four Months',         description: '+3 essence' },
  { days: 150, reward: 'dust_bonus',      value: 1000, name: 'Five Months',         description: '+1000 dust' },
  { days: 180, reward: 'crystal_bonus',   value: 20,   name: 'Half Year',           description: '+20 crystals + title unlocked', title: 'Researcher' },

  // 7-11 months
  { days: 210, reward: 'geode_bonus',     value: 10,   name: 'Seven Months',        description: '+10 geodes' },
  { days: 240, reward: 'essence_bonus',   value: 5,    name: 'Eight Months',        description: '+5 essence' },
  { days: 270, reward: 'dust_bonus',      value: 2000, name: 'Nine Months',         description: '+2000 dust' },
  { days: 300, reward: 'crystal_bonus',   value: 50,   name: 'Ten Months',          description: '+50 crystals' },
  { days: 330, reward: 'essence_bonus',   value: 10,   name: 'Eleven Months',       description: '+10 essence' },

  // The year milestone
  { days: 365, reward: 'title',           value: 0,    name: 'Cartographer',        description: '"Cartographer" title + unique golden dome cosmetic — one full year', title: 'Cartographer' },
] as const,

// === GRACE PERIOD ===
// Per DD-V2-158: 1 grace period use per 30-day window.
// Missing one day with grace available does NOT break the streak.
GRACE_PERIOD_WINDOW_DAYS: 30,  // 30-day rolling window
GRACE_PERIOD_MAX_PER_WINDOW: 1,  // 1 use per window

// === STREAK FREEZE (existing) ===
STREAK_PROTECTION_COST: { dust: 200 } as Record<string, number>,
STREAK_FREEZE_MAX: 3,
```

#### Step 2: Grace period logic in `src/services/saveService.ts`

Add `longestStreak: number`, `gracePeriodUsedAt: number | null`, `lastDiveDate: number | null` to `PlayerSave` type.

Streak update function (add to `saveService.ts`):

```typescript
/**
 * Updates streak on daily login. Handles:
 * - Consecutive days: increment streak
 * - Missed 1 day with grace available: preserve streak, spend grace
 * - Missed 1 day without grace: reset streak (positive reframing applied in UI)
 * - Missed 2+ days: reset streak regardless of grace
 *
 * Per DD-V2-158: streak break displayed as "You completed an X-day expedition — start a new one!"
 */
export function updateStreakOnLogin(s: PlayerSave): {
  streakKept: boolean
  graceUsed: boolean
  previousStreak: number
} {
  const now = new Date()
  const prev = s.lastDiveDate ? new Date(s.lastDiveDate) : null
  const previousStreak = s.stats.currentStreak

  if (!prev) {
    // First ever login
    s.stats.currentStreak = 1
    return { streakKept: true, graceUsed: false, previousStreak: 0 }
  }

  const daysDiff = Math.floor((now.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))

  if (daysDiff <= 1) {
    // Same day or consecutive — increment
    if (daysDiff === 1) {
      s.stats.currentStreak++
      if (s.stats.currentStreak > s.stats.bestStreak) {
        s.stats.bestStreak = s.stats.currentStreak
      }
      // Track longestStreak separately (never resets)
      const longest = s.longestStreak ?? 0
      if (s.stats.currentStreak > longest) {
        s.longestStreak = s.stats.currentStreak
      }
    }
    return { streakKept: true, graceUsed: false, previousStreak }
  }

  if (daysDiff === 2) {
    // Missed exactly 1 day — check grace
    const windowStart = now.getTime() - (BALANCE.GRACE_PERIOD_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    const graceUsedAt = s.gracePeriodUsedAt ?? 0
    const graceAvailable = graceUsedAt < windowStart

    if (graceAvailable && (s.streakFreezes ?? 0) === 0) {
      // Auto-use grace (not a freeze — grace is automatic)
      s.gracePeriodUsedAt = now.getTime()
      s.stats.currentStreak++ // Still counts as consecutive
      const longest = s.longestStreak ?? 0
      if (s.stats.currentStreak > longest) {
        s.longestStreak = s.stats.currentStreak
      }
      return { streakKept: true, graceUsed: true, previousStreak }
    }
  }

  // Streak broken — positive reframing in UI layer
  // longestStreak preserves the previous best
  const longest = s.longestStreak ?? 0
  if (s.stats.currentStreak > longest) {
    s.longestStreak = s.stats.currentStreak
  }
  s.stats.currentStreak = 1
  return { streakKept: false, graceUsed: false, previousStreak }
}
```

#### Step 3: Weekly Challenges — Pool Definition in `src/data/weeklyChallenges.ts`

```typescript
export type ChallengePillar = 'mining' | 'learning' | 'collecting'

export interface WeeklyChallenge {
  id: string
  pillar: ChallengePillar
  title: string
  description: string
  /** The stat key tracked in ChallengeTracker */
  trackingKey: 'blocksMinedThisWeek' | 'factsLearnedThisWeek' | 'fossilsFoundThisWeek' |
               'deepestLayerThisWeek' | 'artifactsFoundThisWeek' | 'studySessionsThisWeek' |
               'diveCompletionsThisWeek' | 'quizCorrectThisWeek' | 'mineralsCollectedThisWeek' |
               'dataDiscsFoundThisWeek'
  targetValue: number
}

/**
 * Pool of 30+ challenge definitions.
 * Every Monday, ChallengeTracker.getWeeklyChallenges() picks 3 from this pool
 * (1 per pillar) using a seeded random based on the ISO week number.
 * Per DD-V2-140: one mining, one learning, one collecting challenge per week.
 */
export const WEEKLY_CHALLENGE_POOL: WeeklyChallenge[] = [
  // === MINING CHALLENGES ===
  { id: 'mine_500_blocks',    pillar: 'mining',    title: 'Deep Digger',        description: 'Mine 500 blocks this week.',                         trackingKey: 'blocksMinedThisWeek',       targetValue: 500  },
  { id: 'mine_reach_layer8',  pillar: 'mining',    title: 'Layer 8 Diver',      description: 'Reach layer 8 or deeper in a single dive.',          trackingKey: 'deepestLayerThisWeek',      targetValue: 8    },
  { id: 'mine_reach_layer12', pillar: 'mining',    title: 'Layer 12 Expedition',description: 'Reach layer 12 or deeper in a single dive.',         trackingKey: 'deepestLayerThisWeek',      targetValue: 12   },
  { id: 'mine_5_dives',       pillar: 'mining',    title: 'Five Expeditions',   description: 'Complete 5 dives this week.',                        trackingKey: 'diveCompletionsThisWeek',   targetValue: 5    },
  { id: 'mine_3_dives',       pillar: 'mining',    title: 'Three Expeditions',  description: 'Complete 3 dives this week.',                        trackingKey: 'diveCompletionsThisWeek',   targetValue: 3    },
  { id: 'mine_1000_minerals', pillar: 'mining',    title: 'Mineral Hoarder',    description: 'Collect 1,000 total mineral units this week.',       trackingKey: 'mineralsCollectedThisWeek', targetValue: 1000 },
  { id: 'mine_200_minerals',  pillar: 'mining',    title: 'Weekend Haul',       description: 'Collect 200 total mineral units this week.',         trackingKey: 'mineralsCollectedThisWeek', targetValue: 200  },
  { id: 'mine_reach_layer5',  pillar: 'mining',    title: 'Beneath the Surface',description: 'Reach layer 5 or deeper in a single dive.',          trackingKey: 'deepestLayerThisWeek',      targetValue: 5    },
  { id: 'mine_reach_layer15', pillar: 'mining',    title: 'The Deep Trenches',  description: 'Reach layer 15 — the Ancient Archive awaits.',       trackingKey: 'deepestLayerThisWeek',      targetValue: 15   },
  { id: 'mine_lava_survive',  pillar: 'mining',    title: 'Fireproof',          description: 'Survive 3 lava encounters in a single dive.',        trackingKey: 'blocksMinedThisWeek',       targetValue: 300  },

  // === LEARNING CHALLENGES ===
  { id: 'learn_5_facts',      pillar: 'learning',  title: 'New Knowledge',      description: 'Learn 5 new facts this week.',                       trackingKey: 'factsLearnedThisWeek',      targetValue: 5    },
  { id: 'learn_10_facts',     pillar: 'learning',  title: 'Eager Scholar',      description: 'Learn 10 new facts this week.',                      trackingKey: 'factsLearnedThisWeek',      targetValue: 10   },
  { id: 'learn_20_facts',     pillar: 'learning',  title: 'Knowledge Surge',    description: 'Learn 20 new facts this week.',                      trackingKey: 'factsLearnedThisWeek',      targetValue: 20   },
  { id: 'study_3_sessions',   pillar: 'learning',  title: 'Review Ritual',      description: 'Complete 3 study sessions this week.',               trackingKey: 'studySessionsThisWeek',     targetValue: 3    },
  { id: 'study_5_sessions',   pillar: 'learning',  title: 'Dedicated Reviewer', description: 'Complete 5 study sessions this week.',               trackingKey: 'studySessionsThisWeek',     targetValue: 5    },
  { id: 'quiz_20_correct',    pillar: 'learning',  title: 'Quiz Champion',      description: 'Answer 20 quiz questions correctly this week.',      trackingKey: 'quizCorrectThisWeek',       targetValue: 20   },
  { id: 'quiz_50_correct',    pillar: 'learning',  title: 'Quiz Master',        description: 'Answer 50 quiz questions correctly this week.',      trackingKey: 'quizCorrectThisWeek',       targetValue: 50   },
  { id: 'learn_3_facts',      pillar: 'learning',  title: 'Casual Learner',     description: 'Learn 3 new facts this week.',                       trackingKey: 'factsLearnedThisWeek',      targetValue: 3    },
  { id: 'learn_disc',         pillar: 'learning',  title: 'Disc Decoder',       description: 'Find and decode 1 Data Disc this week.',             trackingKey: 'dataDiscsFoundThisWeek',    targetValue: 1    },
  { id: 'quiz_100_correct',   pillar: 'learning',  title: 'Fact Machine',       description: 'Answer 100 quiz questions correctly this week.',     trackingKey: 'quizCorrectThisWeek',       targetValue: 100  },

  // === COLLECTING CHALLENGES ===
  { id: 'collect_3_fossils',  pillar: 'collecting',title: 'Fossil Hunter',      description: 'Find 3 fossil fragments this week.',                 trackingKey: 'fossilsFoundThisWeek',      targetValue: 3    },
  { id: 'collect_1_fossil',   pillar: 'collecting',title: 'First Fragment',     description: 'Find 1 fossil fragment this week.',                  trackingKey: 'fossilsFoundThisWeek',      targetValue: 1    },
  { id: 'collect_5_artifacts',pillar: 'collecting',title: 'Artifact Hoarder',   description: 'Find 5 artifacts in a single week.',                 trackingKey: 'artifactsFoundThisWeek',    targetValue: 5    },
  { id: 'collect_10_artifacts',pillar:'collecting',title: 'Relic Hunter',       description: 'Find 10 artifacts in a single week.',                trackingKey: 'artifactsFoundThisWeek',    targetValue: 10   },
  { id: 'collect_rare_plus',  pillar: 'collecting',title: 'Quality Eye',        description: 'Find 2 Rare or better artifacts this week.',         trackingKey: 'artifactsFoundThisWeek',    targetValue: 2    },
  { id: 'collect_2_discs',    pillar: 'collecting',title: 'Data Archivist',     description: 'Find 2 Data Discs this week.',                       trackingKey: 'dataDiscsFoundThisWeek',    targetValue: 2    },
  { id: 'collect_5_fossils',  pillar: 'collecting',title: 'Paleontologist',     description: 'Find 5 fossil fragments this week.',                 trackingKey: 'fossilsFoundThisWeek',      targetValue: 5    },
  { id: 'collect_20_artifacts',pillar:'collecting',title: 'Expedition Leader',  description: 'Find 20 artifacts in a single week.',                trackingKey: 'artifactsFoundThisWeek',    targetValue: 20   },
  { id: 'collect_legend_art', pillar: 'collecting',title: 'Legend Seeker',      description: 'Find 1 Legendary artifact this week.',               trackingKey: 'artifactsFoundThisWeek',    targetValue: 1    },
  { id: 'collect_minerals_all',pillar:'collecting',title: 'Full Spectrum',      description: 'Collect at least 1 of every mineral tier this week.',trackingKey: 'mineralsCollectedThisWeek', targetValue: 5    },
]

/**
 * Selects 3 challenges for the current week (1 per pillar).
 * Uses ISO week number as seed for deterministic selection.
 * Resets on Monday (when ISO week number changes).
 */
export function getWeeklyChallenges(): [WeeklyChallenge, WeeklyChallenge, WeeklyChallenge] {
  const now = new Date()
  // ISO week number as seed
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  const weekNum = Math.floor(dayOfYear / 7)

  function seededPick(pool: WeeklyChallenge[], pillar: ChallengePillar, seed: number): WeeklyChallenge {
    const filtered = pool.filter(c => c.pillar === pillar)
    return filtered[(seed * 31 + filtered.length) % filtered.length]
  }

  return [
    seededPick(WEEKLY_CHALLENGE_POOL, 'mining',     weekNum),
    seededPick(WEEKLY_CHALLENGE_POOL, 'learning',   weekNum + 1),
    seededPick(WEEKLY_CHALLENGE_POOL, 'collecting', weekNum + 2),
  ]
}

/** Returns ISO day of week (0=Sunday, 1=Monday ... 6=Saturday). */
export function isMonday(): boolean {
  return new Date().getDay() === 1
}

/** Returns ms until next Monday 00:00:00 local time. */
export function msUntilNextMonday(): number {
  const now = new Date()
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + daysUntilMonday)
  nextMonday.setHours(0, 0, 0, 0)
  return nextMonday.getTime() - now.getTime()
}
```

#### Step 4: Create `src/game/systems/ChallengeTracker.ts`

```typescript
import type { PlayerSave } from '../../data/types'
import { getWeeklyChallenges } from '../../data/weeklyChallenges'

export type ChallengeStatKey =
  | 'blocksMinedThisWeek'
  | 'factsLearnedThisWeek'
  | 'fossilsFoundThisWeek'
  | 'deepestLayerThisWeek'
  | 'artifactsFoundThisWeek'
  | 'studySessionsThisWeek'
  | 'diveCompletionsThisWeek'
  | 'quizCorrectThisWeek'
  | 'mineralsCollectedThisWeek'
  | 'dataDiscsFoundThisWeek'

/**
 * Tracks weekly challenge progress. Resets stats every Monday.
 * Progress is stored in PlayerSave.weeklyChallenge to persist between sessions.
 */
export class ChallengeTracker {
  constructor(private getSave: () => PlayerSave, private persistSave: () => void) {}

  private get stats(): Record<ChallengeStatKey, number> {
    const s = this.getSave()
    if (!s.weeklyChallenge) {
      s.weeklyChallenge = this.freshStats()
    }
    this.maybeReset(s)
    return s.weeklyChallenge.stats as Record<ChallengeStatKey, number>
  }

  private freshStats(): { weekStartIso: string; stats: Record<string, number> } {
    return {
      weekStartIso: this.currentWeekStartIso(),
      stats: {
        blocksMinedThisWeek: 0,
        factsLearnedThisWeek: 0,
        fossilsFoundThisWeek: 0,
        deepestLayerThisWeek: 0,
        artifactsFoundThisWeek: 0,
        studySessionsThisWeek: 0,
        diveCompletionsThisWeek: 0,
        quizCorrectThisWeek: 0,
        mineralsCollectedThisWeek: 0,
        dataDiscsFoundThisWeek: 0,
      },
    }
  }

  private currentWeekStartIso(): string {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    return monday.toISOString().slice(0, 10) // YYYY-MM-DD
  }

  private maybeReset(s: PlayerSave): void {
    const current = this.currentWeekStartIso()
    if (!s.weeklyChallenge || s.weeklyChallenge.weekStartIso !== current) {
      s.weeklyChallenge = this.freshStats()
      this.persistSave()
    }
  }

  increment(key: ChallengeStatKey, by = 1): void {
    const s = this.getSave()
    this.maybeReset(s)
    const stats = s.weeklyChallenge!.stats as Record<string, number>
    stats[key] = (stats[key] ?? 0) + by
    this.persistSave()
  }

  updateMax(key: ChallengeStatKey, value: number): void {
    const s = this.getSave()
    this.maybeReset(s)
    const stats = s.weeklyChallenge!.stats as Record<string, number>
    stats[key] = Math.max(stats[key] ?? 0, value)
    this.persistSave()
  }

  getProgress(key: ChallengeStatKey): number {
    return this.stats[key] ?? 0
  }

  // Convenience methods called from GameManager:
  recordBlockMined():                void { this.increment('blocksMinedThisWeek') }
  recordFactLearned():               void { this.increment('factsLearnedThisWeek') }
  recordFossilFound():               void { this.increment('fossilsFoundThisWeek') }
  recordArtifactFound():             void { this.increment('artifactsFoundThisWeek') }
  recordStudySession():              void { this.increment('studySessionsThisWeek') }
  recordDiveComplete():              void { this.increment('diveCompletionsThisWeek') }
  recordQuizCorrect():               void { this.increment('quizCorrectThisWeek') }
  recordMineralsCollected(n: number):void { this.increment('mineralsCollectedThisWeek', n) }
  recordDataDiscFound():             void { this.increment('dataDiscsFoundThisWeek') }
  recordDeepestLayer(layer: number): void { this.updateMax('deepestLayerThisWeek', layer) }
}
```

#### Step 5: Create `src/ui/components/WeeklyChallenge.svelte`

Display 3 challenges with progress bars. On all 3 complete, show claim button that awards the Weekly Expedition Chest: guaranteed Rare+ artifact (reusing GachaReveal with rarity 'rare' as floor).

Key UI requirements per DD-V2-140:
- 3 challenges visible simultaneously, one per pillar
- Each shows: title, description, progress bar (current/target), pillar icon
- "Claim Expedition Chest" button appears when all 3 are complete
- Challenges reset on Monday — show "Resets Monday" subtitle with days remaining
- Visible from main dome screen without navigating to StreakPanel

#### Step 6: Positive streak reframing copy — `src/data/gaiaDialogue.ts`

Add the following dialogue keys. These REPLACE any negative or guilt-inducing streak copy anywhere in the codebase:

```typescript
streakBreak: [
  // Used in StreakPanel.svelte when currentStreak resets
  "You completed a {days}-day expedition. Start a new one whenever you're ready.",
  "A {days}-day run — that's remarkable. Your longest record is safe. Begin again?",
  "{days} days of consistent exploration. The mine will always be here. So will I.",
],
streakMilestone7: [
  "Day 7! A full week of expeditions. You're building something here.",
  "Seven days. That's a pattern, not a coincidence.",
  "One week of showing up. The tree remembers every day.",
],
streakMilestone30: [
  "Thirty consecutive days, miner. That is not discipline — that is identity.",
  "A month of expeditions. The dome reflects your dedication now.",
  "Day 30. Most miners never reach this. You did.",
],
streakMilestone100: [
  "One hundred days. A century of showing up. This is the rarest of achievements.",
  "One hundred. I have been tracking this since day one. You did it.",
  "The Centurion title belongs to you now. Earned, not given.",
],
streakNewRecord: [
  "You beat your personal record! {days} days is your new best.",
  "New record: {days} consecutive expeditions. GAIA will remember this.",
  "{days} days — a personal best. You keep surprising me.",
],
graceUsed: [
  "You missed a day — I used your grace period. Streak preserved. Welcome back.",
  "Grace period activated. The expedition continues.",
  "One missed day, grace available — streak intact. Don't make it a habit.",
],
```

#### Step 7: Streak copy audit — Search and replace all instances of negative framing

Run these searches across all `.svelte` and `.ts` files and replace with positive equivalents:

| Find | Replace with |
|---|---|
| "you lost your streak" | "You completed a [N]-day expedition" |
| "streak broken" | "expedition complete — start a new one" |
| "missed a day" | "took a rest day" |
| "streak ended" | "expedition concluded" |
| "Play more today!" | (delete — not used) |
| "You're falling behind" | (delete — GAIA never says this per DD-V2-142) |

### Acceptance Criteria — 17.5

- [ ] `BALANCE.STREAK_MILESTONES` has entries for days: 3, 7, 14, 21, 30, 45, 60, 75, 90, 100, 120, 150, 180, 210, 240, 270, 300, 330, 365
- [ ] Day 365 milestone unlocks "Cartographer" title
- [ ] `longestStreak` field in `PlayerSave` is set and never decremented
- [ ] Missing 1 day with grace available keeps streak intact (test by manipulating `lastDiveDate` in DevPanel)
- [ ] Missing 2 consecutive days always breaks streak even with grace
- [ ] Grace period limited to 1 use per 30-day window (verify: using grace on day 5, then missing day 15 breaks streak)
- [ ] Streak break message reads "You completed a X-day expedition" NOT "You lost your streak"
- [ ] `getWeeklyChallenges()` returns 3 different challenges, one per pillar
- [ ] Calling `getWeeklyChallenges()` twice on same day returns identical challenges
- [ ] `ChallengeTracker.stats` resets on Monday (test by setting `weeklyChallenge.weekStartIso` to last Monday's date)
- [ ] Completing all 3 weekly challenges unlocks Expedition Chest claim button
- [ ] Expedition Chest awards a Rare+ artifact (test 10 times — never Common or Uncommon)
- [ ] `WeeklyChallenge.svelte` visible from BaseView command room without navigating to StreakPanel
- [ ] Anti-binge mineral multiplier is 0.65x after dive 3 (verify in DevPanel debug info)
- [ ] GAIA anti-binge message fires after dive 3 completion
- [ ] `npm run typecheck` passes

### Playwright Test — 17.5

```js
const { chromium } = require('/root/terra-miner/node_modules/playwright-core')
;(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/opt/google/chrome/chrome'
  })
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://localhost:5173', { bypassCSP: true })
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })

  // Test 1: Verify weekly challenges appear in dome
  const challengeWidget = page.locator('.weekly-challenge, [data-testid="weekly-challenge"]')
  console.log('Weekly challenge widget visible:', await challengeWidget.isVisible().catch(() => false))
  await page.screenshot({ path: '/tmp/ss-17-5-challenges.png' })

  // Test 2: Navigate to StreakPanel
  const streakBtn = page.locator('button:has-text("Streak"), a:has-text("Streak")').first()
  if (await streakBtn.isVisible()) {
    await streakBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: '/tmp/ss-17-5-streak-panel.png' })

    // Verify milestone list exists
    const milestones = page.locator('.milestone-list li, .milestone-row')
    const count = await milestones.count()
    console.log('Milestone entries visible:', count, '(expect 19)')
  }

  // Test 3: Inject a streak break scenario and verify positive framing
  await page.evaluate(() => {
    const raw = localStorage.getItem('recall-rogue-save')
    if (raw) {
      const s = JSON.parse(raw)
      s.lastDiveDate = Date.now() - (3 * 24 * 60 * 60 * 1000)  // 3 days ago
      s.stats = s.stats || {}
      s.stats.currentStreak = 45
      s.stats.bestStreak = 45
      s.longestStreak = 45
      localStorage.setItem('recall-rogue-save', JSON.stringify(s))
    }
  })
  await page.reload()
  await page.waitForSelector('button:has-text("Dive")', { timeout: 15000 })
  await page.screenshot({ path: '/tmp/ss-17-5-streak-break.png' })

  // Verify no negative language in visible text
  const pageText = await page.textContent('body')
  const hasNegative = pageText?.includes('lost your streak') || pageText?.includes('streak broken')
  console.log('Negative streak language found (should be false):', hasNegative)

  await browser.close()
})()
```

---

## Verification Gate

Before Phase 17 is considered complete, all of the following must pass:

### Automated Checks

- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run build` succeeds with no warnings about missing imports

### Manual Visual Checks (screenshot each)

- [ ] Common artifact reveal: quick flash, ~0.4s, grey glow, no particles
- [ ] Rare artifact reveal: blue glow, particle burst, ~0.9s
- [ ] Legendary artifact reveal: gold glow, full particle storm, screen flash, ~2.2s
- [ ] Mythic artifact reveal: pink glow, massive particle burst, ~3.5s, dramatic pause before reveal
- [ ] Near-miss banner appears when Epic artifact is revealed ("Almost Legendary!")
- [ ] First mastery (#1) shows full-screen celebration with GAIA monologue
- [ ] Mastery #10 shows banner-tier celebration with +50 dust awarded
- [ ] Mastery #100 shows major celebration with +500 dust and "Archivist" title
- [ ] Login calendar renders all 7 days with correct rewards
- [ ] Day 7 reward triggers GachaReveal animation
- [ ] Comeback bonus overlay appears for saves 3+ days old
- [ ] Weekly challenge widget visible on dome main screen
- [ ] All 3 challenge pillars (mining/learning/collecting) visible simultaneously
- [ ] Streak panel shows milestone entries up to day 365
- [ ] Streak break displays "You completed a X-day expedition" (not "lost")

### Behavioral Checks

- [ ] Streak grace period: miss 1 day → streak preserved, grace consumed
- [ ] Streak grace period: miss 2 days → streak breaks regardless of grace
- [ ] Anti-binge: dive 3 times in one session → 4th dive yields 35% fewer minerals
- [ ] Anti-binge: restart app → mineral multiplier resets to 1.0
- [ ] Weekly challenges reset on Monday (simulate by changing `weekStartIso` in localStorage)
- [ ] Completing all 3 weekly challenges unlocks Expedition Chest (Rare+ artifact guaranteed)
- [ ] `longestStreak` in save file is never lower than previous value after any session

### No Regressions

- [ ] `StreakPanel.svelte` existing UI (freeze purchase, milestone list) still functions
- [ ] `FactReveal.svelte` still shows fact text and GAIA comment after GachaReveal completes
- [ ] `StudySession.svelte` SM-2 grading unaffected by mastery celebration events
- [ ] `DiveResults.svelte` still shows all existing loot summary information
- [ ] `Settings.svelte` audio sliders work and persist

---

## Files Affected — Complete List

### New Files

```
src/ui/components/GachaReveal.svelte
src/ui/components/NearMissBanner.svelte
src/ui/components/MasteryToast.svelte
src/ui/components/MilestoneCelebration.svelte
src/ui/components/PostDiveHooks.svelte
src/ui/components/ProgressBars.svelte
src/ui/components/LoginCalendar.svelte
src/ui/components/ComebackBonus.svelte
src/ui/components/WeeklyChallenge.svelte
src/game/managers/CelebrationManager.ts
src/game/systems/SessionTracker.ts
src/game/systems/ChallengeTracker.ts
src/services/notificationService.ts
src/data/loginRewards.ts
src/data/weeklyChallenges.ts
src/assets/audio/sfx/reveal_common.ogg
src/assets/audio/sfx/reveal_uncommon.ogg
src/assets/audio/sfx/reveal_rare.ogg
src/assets/audio/sfx/reveal_epic.ogg
src/assets/audio/sfx/reveal_legendary.ogg
src/assets/audio/sfx/reveal_mythic.ogg
src/assets/audio/sfx/mine_dirt.ogg
src/assets/audio/sfx/mine_soft_rock.ogg
src/assets/audio/sfx/mine_stone.ogg
src/assets/audio/sfx/mine_hard_rock.ogg
src/assets/audio/sfx/mine_unbreakable.ogg
src/assets/audio/sfx/mine_mineral.ogg
src/assets/audio/sfx/mine_artifact.ogg
src/assets/audio/sfx/quiz_correct.ogg
src/assets/audio/sfx/quiz_wrong.ogg
src/assets/audio/sfx/mastery_glow.ogg
src/assets/audio/sfx/mastery_fullscreen.ogg
src/assets/audio/sfx/streak_milestone.ogg
src/assets/audio/sfx/gaia_quip.ogg
src/assets/audio/sfx/lava_sizzle.ogg
src/assets/audio/sfx/gas_pocket.ogg
src/assets/audio/sfx/earthquake_rumble.ogg
src/assets/audio/sfx/item_pickup.ogg
src/assets/audio/sfx/oxygen_low.ogg
src/assets/audio/sfx/oxygen_critical.ogg
src/assets/audio/sfx/dive_complete.ogg
src/assets/audio/sfx/streak_freeze_used.ogg
src/assets/audio/sfx/button_click.ogg
src/assets/audio/music/dome_calm.ogg
src/assets/audio/music/biome_sedimentary.ogg
src/assets/audio/music/biome_volcanic.ogg
src/assets/audio/music/biome_crystalline.ogg
src/assets/audio/music/biome_fungal.ogg
src/assets/audio/music/biome_ancient.ogg
src/assets/audio/music/biome_generic.ogg
```

### Modified Files

```
src/data/balance.ts          — GACHA_TIERS, MASTERY_CELEBRATION_THRESHOLDS, NEAR_MISS_MESSAGES,
                               LOGIN_CALENDAR_REWARDS, STREAK_MILESTONES (full 19-entry schedule),
                               SESSION_DESIGN_TARGETS, ANTI_BINGE constants, GRACE_PERIOD constants
src/data/types.ts             — MasteryEvent, CelebrationTier, LoginReward, WeeklyChallenge,
                               PlayerSave.longestStreak, .gracePeriodUsedAt, .lastDiveDate,
                               .loginCalendarDay, .loginCalendarLastClaimed, .lastLoginDate,
                               .weeklyChallenge
src/data/gaiaDialogue.ts      — streakBreak, streakMilestone*, streakNewRecord, graceUsed,
                               firstMastery, masteryN, mastery5/10/25/50/100/250/500,
                               categoryComplete dialogue arrays
src/data/biomes.ts            — musicKey field added to each biome definition
src/services/saveService.ts   — updateStreakOnLogin(), backward-compatible field migration for
                               longestStreak, gracePeriodUsedAt, lastDiveDate, loginCalendarDay
src/services/audioService.ts  — playMusic(trackKey, fadeMs), stopMusic(fadeMs), setMusicVolume(),
                               setSfxVolume(); load from files instead of Web Audio synthesis
src/ui/stores/settings.ts     — musicVolume, sfxVolume, musicEnabled, sfxEnabled persistable stores
src/ui/components/FactReveal.svelte    — use GachaReveal + NearMissBanner
src/ui/components/StreakPanel.svelte   — show longestStreak, add WeeklyChallenge, positive copy
src/ui/components/DiveResults.svelte  — append PostDiveHooks
src/ui/components/BaseView.svelte     — ProgressBars in header, LoginCalendar on first daily visit,
                                       ComebackBonus on 3+ day return, WeeklyChallenge widget
src/ui/components/Settings.svelte     — music/sfx volume sliders
src/game/GameManager.ts               — CelebrationManager + SessionTracker + ChallengeTracker
                                       wiring; call challenge tracker on all tracked events
src/game/scenes/BootScene.ts          — preload all audio keys
src/game/scenes/MineScene.ts          — playMusic on start, stopMusic on exit
src/game/managers/StudyManager.ts     — call CelebrationManager.notifyMastery() on mastery threshold
```

---

## Design Decision Cross-Reference

| Decision | System | Sub-Phase |
|---|---|---|
| DD-V2-084 | Streak rewards daily consistency, not session intensity | 17.5 |
| DD-V2-108 | First mastery = biggest celebration in the game; full-screen takeover | 17.1 |
| DD-V2-119 | Tiered mastery celebrations: glow→mini→banner→medium→major→fullscreen | 17.1 |
| DD-V2-123 | Category completion = major celebration + challenge mode unlock | 17.1 |
| DD-V2-137 | Post-dive hooks are informational only; GAIA never guilt-trips on exit | 17.3 |
| DD-V2-140 | 3 weekly challenges (mining/learning/collecting); Expedition Chest on all 3 complete | 17.5 |
| DD-V2-141 | Cozy dome sessions (farm + study + GAIA) are a valid, complete session type | 17.3 |
| DD-V2-142 | No countdown timers, no red badges, no urgency framing on reviews | 17.3 |
| DD-V2-143 | First gacha reveal must happen within 90s of first gameplay | 17.1 |
| DD-V2-144 | 7-day rotating login calendar; resets after Day 7 claimed, NOT on missed days | 17.4 |
| DD-V2-158 | Streak breaks reframed as "completed expedition"; longestStreak never resets | 17.5 |
| DD-V2-159 | Max 1 push notification/day; permission after first dive; stop after 7 no-engagement days | 17.4 |
| DD-V2-163 | Hidden engagement score drives dynamic distractor difficulty | 17.3 (monitor) |
