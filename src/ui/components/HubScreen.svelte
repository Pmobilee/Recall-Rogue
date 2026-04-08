<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { RunSummary } from '../../services/hubState'
  import { playerSave } from '../stores/playerData'
  import { getCampUpgradeUrl, getCampBackgroundUrl, getCampBackgroundWideUrl, getCampSettingsUrl } from '../utils/campArtManifest'
  import { ENEMY_TEMPLATES } from '../../data/enemies'
  import { campState } from '../stores/campState'
  import { getAmbientClass } from '../effects/HubAmbientEffects'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'
  import { isLandscape } from '../../stores/layoutStore'
  import CampSpriteButton from './CampSpriteButton.svelte'
  import CampfireCanvas from './CampfireCanvas.svelte'
  import CampSpeechBubble from './CampSpeechBubble.svelte'
  import CampHudOverlay from './CampHudOverlay.svelte'
  import CampUpgradeModal from './CampUpgradeModal.svelte'
  import HubGlowCanvas from './HubGlowCanvas.svelte'
  import HubFireflies from './HubFireflies.svelte'
  import HubMoths from './HubMoths.svelte'
  import HubCursorLight from './HubCursorLight.svelte'
  import { start as startLighting, stop as stopLighting, getHubLightingStore, getSpriteBrightness, updateStreak } from '../effects/hubLightingState'

  import ParallaxTransition from './ParallaxTransition.svelte'
  import { getLevelProgress } from '../../services/characterLevel'
  import { playCardAudio } from '../../services/cardAudioManager'
  import { ambientAudio } from '../../services/ambientAudioService'
  import { LIGHT_SOURCE_MANIFEST } from '../../data/lightSourceManifest'

  interface Props {
    streak: number
    lastRunSummary: RunSummary | null
    hasActiveRunBanner: boolean
    onStartRun: () => void
    onOpenLibrary: () => void
    onOpenSettings: () => void
    onOpenProfile: () => void
    onOpenJournal: () => void
    onOpenLeaderboards: () => void
    onOpenMultiplayer: () => void
    onOpenRelicSanctum: () => { ok: true } | { ok: false; reason: string }
    onReplayBootAnim?: () => void
    disableEffects?: boolean
  }

  let {
    streak,
    lastRunSummary,
    hasActiveRunBanner,
    onStartRun,
    onOpenLibrary,
    onOpenSettings,
    onOpenProfile,
    onOpenJournal,
    onOpenLeaderboards,
    onOpenMultiplayer,
    onOpenRelicSanctum,
    onReplayBootAnim,
    disableEffects = false,
  }: Props = $props()

  let showUpgradeModal = $state(false)
  let petBubbleVisible = $state(false)
  let petBubbleTimer: ReturnType<typeof setTimeout> | null = null
  let sparkleBursts = $state<number[]>([])
  let sparkleIdCounter = 0
  const MAX_SPARKLE_BURSTS = 5
  let transitionActive = $state(false)
  let transitionType = $state<'enter' | 'exit-forward' | 'exit-backward'>('enter')
  let transitionImageUrl = $state('')
  let transitionDepthUrl = $state('')

  // Hub container element refs for campfire center calculation and mouse proximity
  let hubCenterEl = $state<HTMLElement | undefined>()
  let campHubEl = $state<HTMLElement | undefined>()

  // Mouse tracking state — used for cursor light, glow canvas, and sprite proximity
  let mouseX = $state<number | undefined>(undefined)
  let mouseY = $state<number | undefined>(undefined)
  let mouseInHub = $state(false)

  // Hub lighting reactive store
  const hubLighting = getHubLightingStore()

  // Derived tier values — reactively update sprite URLs when upgrades are purchased
  let tiers = $derived($campState.tiers)
  // Forms — which visual form to display per element (may differ from tier when user previews a lower form)
  let forms = $derived($campState.forms ?? $campState.tiers)

  // Preload all camp images before revealing screen
  const _campImagesToPreload = [
    getCampBackgroundUrl(),
    getCampBackgroundWideUrl(),
    getCampUpgradeUrl('doorway', $campState.forms?.doorway ?? $campState.tiers.doorway),
    getCampUpgradeUrl('library', $campState.forms?.library ?? $campState.tiers.library),
    getCampSettingsUrl(),
    getCampUpgradeUrl('campfire', $campState.forms?.campfire ?? $campState.tiers.campfire),
    getCampUpgradeUrl('tent', $campState.forms?.tent ?? $campState.tiers.tent),
    getCampUpgradeUrl('character', $campState.forms?.character ?? $campState.tiers.character),
    getCampUpgradeUrl('journal', $campState.forms?.journal ?? $campState.tiers.journal),
    getCampUpgradeUrl('questboard', $campState.forms?.questboard ?? $campState.tiers.questboard),
    getCampUpgradeUrl('shop', $campState.forms?.shop ?? $campState.tiers.shop),
    getCampUpgradeUrl('pet', $campState.forms?.pet ?? $campState.tiers.pet),
  ]
  holdScreenTransition()
  preloadImages(_campImagesToPreload).then(releaseScreenTransition)

  let greyMatterBalance = $derived($playerSave?.minerals.greyMatter ?? 0)
  let levelProgress = $derived(getLevelProgress($playerSave?.totalXP ?? 0))
  // Use stored characterLevel as primary (survives XP desync), fall back to XP-derived
  let effectiveLevel = $derived(Math.max($playerSave?.characterLevel ?? 0, levelProgress.level))

  /**
   * Compute brightness bonus (0–0.15) based on mouse proximity to a sprite's hitbox center.
   * Converts mouse viewport coords to container-percentage space for comparison with
   * the hitbox percent values used throughout this file.
   *
   * @param hitTop   - Hitbox top as % of container height
   * @param hitLeft  - Hitbox left as % of container width
   * @param hitWidth - Hitbox width as % of container width
   * @param hitHeight - Hitbox height as % of container height
   * @param mx - Mouse viewport X (clientX), or undefined when outside hub
   * @param my - Mouse viewport Y (clientY), or undefined when outside hub
   * @param containerEl - Hub container element for bounding rect conversion
   */
  function getMouseProximityBonus(
    hitTop: number, hitLeft: number, hitWidth: number, hitHeight: number,
    mx: number | undefined, my: number | undefined,
    containerEl: HTMLElement | undefined
  ): number {
    if (mx === undefined || my === undefined || !containerEl) return 0
    const rect = containerEl.getBoundingClientRect()
    // Convert mouse viewport coords to percentage of container
    const mousePctX = ((mx - rect.left) / rect.width) * 100
    const mousePctY = ((my - rect.top) / rect.height) * 100
    // Sprite center in percentage
    const cx = hitLeft + hitWidth / 2
    const cy = hitTop + hitHeight / 2
    const dx = mousePctX - cx
    const dy = mousePctY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    // Bonus fades from 0.15 at dist=0 to 0 at dist=25
    return Math.max(0, 0.15 * (1 - dist / 25))
  }

  // Reactive per-sprite brightness: campfire distance falloff + mouse proximity bonus
  let doorwayBright = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(11, 28, 44, 27, $hubLighting.intensity) +
    getMouseProximityBonus(11, 28, 44, 27, mouseX, mouseY, hubCenterEl)))
  let libraryBright = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(31, 2, 32, 23, $hubLighting.intensity) +
    getMouseProximityBonus(31, 2, 32, 23, mouseX, mouseY, hubCenterEl)))
  let settingsBright = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(29, 76, 16, 18, $hubLighting.intensity) +
    getMouseProximityBonus(29, 76, 16, 18, mouseX, mouseY, hubCenterEl)))
  let questboardBright = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(75, 72, 26, 20, $hubLighting.intensity) +
    getMouseProximityBonus(75, 72, 26, 20, mouseX, mouseY, hubCenterEl)))
  let journalBright = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(76, 5, 23, 9, $hubLighting.intensity) +
    getMouseProximityBonus(76, 5, 23, 9, mouseX, mouseY, hubCenterEl)))
  let shopBright = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(61, -21, 19, 11, $hubLighting.intensity) +
    getMouseProximityBonus(61, -21, 19, 11, mouseX, mouseY, hubCenterEl)))
  let tentBright = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(40, 90, 30, 20, $hubLighting.intensity) +
    getMouseProximityBonus(40, 90, 30, 20, mouseX, mouseY, hubCenterEl)))
  let campfireBright = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(55, 38, 24, 18, $hubLighting.intensity) +
    getMouseProximityBonus(55, 38, 24, 18, mouseX, mouseY, hubCenterEl)))
  let characterBright = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(58, 54, 21, 11, $hubLighting.intensity) +
    getMouseProximityBonus(58, 54, 21, 11, mouseX, mouseY, hubCenterEl)))
  let petBright = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(69, 66, 11, 6, $hubLighting.intensity) +
    getMouseProximityBonus(69, 66, 11, 6, mouseX, mouseY, hubCenterEl)))

  // Portrait-specific brightness for sprites at different positions in portrait layout
  let shopBrightPortrait = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(87, 52, 19, 11, $hubLighting.intensity) +
    getMouseProximityBonus(87, 52, 19, 11, mouseX, mouseY, campHubEl)))
  let tentBrightPortrait = $derived(disableEffects ? 1.0 :
    Math.min(1.0, getSpriteBrightness(44, 66, 36, 22, $hubLighting.intensity) +
    getMouseProximityBonus(44, 66, 36, 22, mouseX, mouseY, campHubEl)))

  // Background warmth filter: subtle sepia+saturation shift driven by warmth value
  let bgWarmthFilter = $derived(disableEffects ? '' : `sepia(${(0.03 + $hubLighting.warmth * 0.05).toFixed(3)}) saturate(${(1.0 + $hubLighting.warmth * 0.1).toFixed(3)})`)

  onMount(() => {
    if (!disableEffects) startLighting(streak)
  })

  onDestroy(() => {
    stopLighting()
  })

  // Keep streak amplitude in sync
  $effect(() => {
    updateStreak(streak)
  })

  $effect(() => {
    playCardAudio('hub-welcome')
    void ambientAudio.setContext('hub')
  })

  /**
   * Returns the absolute viewport pixel coordinates of the campfire center,
   * derived from the hub container's bounding rect.
   */
  function getCampfireViewportCenter(): { x: number; y: number } {
    const el = hubCenterEl ?? campHubEl
    if (!el) return { x: window.innerWidth / 2, y: window.innerHeight * 0.64 }
    const rect = el.getBoundingClientRect()
    return {
      x: rect.left + rect.width * 0.50,   // campfire center X = 50% of hub container
      y: rect.top + rect.height * 0.64,   // campfire center Y = 64% of hub container
    }
  }

  /** Track mouse position for cursor light, glow canvas secondary pass, and sprite proximity. */
  function handleHubPointerMove(e: PointerEvent): void {
    mouseX = e.clientX
    mouseY = e.clientY
    mouseInHub = true
  }

  /** Clear mouse state when pointer leaves the hub area. */
  function handleHubPointerLeave(): void {
    mouseX = undefined
    mouseY = undefined
    mouseInHub = false
  }

  function handleStartRun(): void {
    playCardAudio('hub-start-run')
    onStartRun()
  }

  function openUpgradeModal(): void {
    showUpgradeModal = true
  }

  function showPetBubble(): void {
    petBubbleVisible = true
    if (petBubbleTimer) clearTimeout(petBubbleTimer)
    petBubbleTimer = setTimeout(() => {
      petBubbleVisible = false
    }, 2000)
  }

  function handleCampfireClick(): void {
    const id = ++sparkleIdCounter
    sparkleBursts = [...sparkleBursts.slice(-(MAX_SPARKLE_BURSTS - 1)), id]
    setTimeout(() => {
      sparkleBursts = sparkleBursts.filter(b => b !== id)
    }, 700)
  }

  function pickRandomScene(): { imageUrl: string; depthUrl: string; isCombat: boolean } {
    const orientation = $isLandscape ? 'landscape' : 'portrait'
    const rooms = ['shop', 'mystery', 'rest', 'treasure', 'descent']
    const enemyIds = ENEMY_TEMPLATES.map(e => e.id)
    const allScenes = [
      ...rooms.map(r => ({
        imageUrl: `/assets/backgrounds/rooms/${r}/${orientation}.webp`,
        depthUrl: `/assets/backgrounds/rooms/${r}/${orientation}_depth.webp`,
        isCombat: false,
      })),
      ...enemyIds.map(id => ({
        imageUrl: `/assets/backgrounds/combat/enemies/${id}/${orientation}.webp`,
        depthUrl: `/assets/backgrounds/combat/enemies/${id}/${orientation}_depth.webp`,
        isCombat: true,
      })),
    ]
    return allScenes[Math.floor(Math.random() * allScenes.length)]
  }

  function previewEnter(): void {
    const scene = pickRandomScene()
    transitionImageUrl = scene.imageUrl
    transitionDepthUrl = scene.depthUrl
    transitionType = 'enter'
    transitionActive = true
  }

  function previewExit(): void {
    const scene = pickRandomScene()
    transitionImageUrl = scene.imageUrl
    transitionDepthUrl = scene.depthUrl
    transitionType = scene.isCombat ? 'exit-forward' : 'exit-backward'
    transitionActive = true
  }

  async function fakeRunEnd(): Promise<void> {
    const scenario = (globalThis as any).__rrScenario
    if (!scenario) return
    const results = ['victory', 'defeat', 'retreat'] as const
    const result = results[Math.floor(Math.random() * results.length)]
    const allEnemyIds = ENEMY_TEMPLATES.map((t: any) => t.id)
    const enemyCount = 3 + Math.floor(Math.random() * 10)
    const defeatedEnemyIds = Array.from({ length: enemyCount }, () =>
      allEnemyIds[Math.floor(Math.random() * allEnemyIds.length)]
    )
    const seen = Math.floor(Math.random() * 15) + 3
    const reviewing = Math.floor(Math.random() * 20) + 5
    const mastered = Math.floor(Math.random() * 8)
    const floor = 1 + Math.floor(Math.random() * 10)
    await scenario.loadCustom({
      screen: 'runEnd',
      runEndResult: result,
      floor,
      runEndStats: {
        floorReached: floor,
        defeatedEnemyIds,
        factStateSummary: { seen, reviewing, mastered },
        encountersWon: defeatedEnemyIds.length,
        encountersTotal: defeatedEnemyIds.length + Math.floor(Math.random() * 3),
        accuracy: 50 + Math.floor(Math.random() * 50),
        bestCombo: 1 + Math.floor(Math.random() * 15),
        currencyEarned: 50 + Math.floor(Math.random() * 500),
        relicsCollected: Math.floor(Math.random() * 6),
      },
    })
  }

  async function testBrightIdea(): Promise<void> {
    const scenario = (globalThis as any).__rrScenario
    if (!scenario) return
    await scenario.loadCustom({ screen: 'combat', enemy: 'bright_idea' })
  }

  async function testInkSlug(): Promise<void> {
    const scenario = (globalThis as any).__rrScenario
    if (!scenario) return
    await scenario.loadCustom({ screen: 'combat', enemy: 'ink_slug' })
  }

  async function testLighting(): Promise<void> {
    const scenario = (globalThis as any).__rrScenario
    if (!scenario) return
    // Pick a random enemy that has manifest light entries
    const manifestEnemies = Object.keys(LIGHT_SOURCE_MANIFEST.enemies)
    const enemyId = manifestEnemies[Math.floor(Math.random() * manifestEnemies.length)]
    // Load combat directly with that enemy — no page_flutter flash
    await scenario.loadCustom({ screen: 'combat', enemy: enemyId })
  }

  function onTransitionComplete(): void {
    transitionActive = false
  }
</script>

{#if $isLandscape}
  <!-- ═══ LANDSCAPE LAYOUT ═══════════════════════════════════════════════════ -->
  <div
    class="hub-landscape"
    aria-label="Camp hub"
    style:cursor={disableEffects ? undefined : 'none'}
    onpointermove={handleHubPointerMove}
    onpointerleave={handleHubPointerLeave}
  >
    <!-- Full 16:9 widescreen background — covers entire viewport -->
    <img
      class="camp-bg-wide"
      src={getCampBackgroundWideUrl()}
      alt=""
      aria-hidden="true"
      loading="eager"
      decoding="async"
      style:filter={bgWarmthFilter}
    />

    <!-- Warm campfire glow + vignette canvas overlay -->
    {#if !disableEffects}
      <HubGlowCanvas
        campfireCenterFn={getCampfireViewportCenter}
        mouseX={mouseInHub ? mouseX : undefined}
        mouseY={mouseInHub ? mouseY : undefined}
      />
    {/if}

    <!-- Center column: portrait 9:16 hotspot container (transparent — wide bg shows through) -->
    <div class="hub-center" bind:this={hubCenterEl}>
      <CampHudOverlay {streak} {greyMatterBalance} {hasActiveRunBanner} />

      <!-- 1. Dungeon Gate - Start Run -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('doorway', forms.doorway)}
        label="Start Run"
        testId="btn-start-run"
        zIndex={5}
        onclick={handleStartRun}
        hitTop="11%" hitLeft="28%" hitWidth="44%" hitHeight="27%"
        brightness={doorwayBright}
        showBorder
      />

      <!-- 2. Library (Bookshelf) -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('library', forms.library)}
        label="Library"
        zIndex={10}
        onclick={onOpenLibrary}
        hitTop="31%" hitLeft="2%" hitWidth="32%" hitHeight="23%"
        brightness={libraryBright}
        showBorder
      />

      <!-- 3. Settings (Signpost) -->
      <CampSpriteButton
        spriteUrl={getCampSettingsUrl()}
        label="Settings"
        zIndex={10}
        onclick={onOpenSettings}
        hitTop="29%" hitLeft="76%" hitWidth="16%" hitHeight="18%"
        brightness={settingsBright}
        showBorder
      />

      <!-- 5. Quest Board - Leaderboards -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('questboard', forms.questboard)}
        label="Leaderboards"
        zIndex={15}
        onclick={onOpenLeaderboards}
        hitTop="75%" hitLeft="72%" hitWidth="26%" hitHeight="20%"
        brightness={questboardBright}
        showBorder
      />

      <!-- 6. Journal -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('journal', forms.journal)}
        label="Journal"
        zIndex={15}
        onclick={onOpenJournal}
        hitTop="76%" hitLeft="5%" hitWidth="23%" hitHeight="9%"
        brightness={journalBright}
        showBorder
      />

      <!-- 7. Shop (Treasure Chest) -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('shop', forms.shop)}
        label="Relic Collection"
        zIndex={15}
        onclick={openUpgradeModal}
        hitTop="61%" hitLeft="-21%" hitWidth="19%" hitHeight="11%"
        spriteOffsetX="-73%" spriteOffsetY="-27%"
        brightness={shopBright}
        showBorder
      />

      <!-- 8. Tent - Multiplayer -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('tent', forms.tent)}
        label="Multiplayer"
        zIndex={20}
        onclick={onOpenMultiplayer}
        hitTop="40%" hitLeft="90%" hitWidth="30%" hitHeight="20%"
        spriteOffsetX="30%" spriteOffsetY="-2%"
        brightness={tentBright}
        showBorder
      />

      <!-- 9. Campfire - Sparkle burst on click (no fire shadow — dist < 1) -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('campfire', forms.campfire)}
        label="Campfire"
        zIndex={25}
        onclick={handleCampfireClick}
        hitTop="55%" hitLeft="38%" hitWidth="24%" hitHeight="18%"
        brightness={campfireBright}
        showBorder
      />

      <!-- Campfire VFX overlay -->
      {#if !disableEffects}
        <CampfireCanvas {streak} />
      {/if}

      <!-- Campfire sparkle bursts — z-index 27 to stay above CampfireCanvas (z-26) -->
      {#each sparkleBursts as burstId (burstId)}
        <div class="campfire-sparkle-burst" aria-hidden="true">
          {#each Array(8) as _, i}
            <span class="sparkle-particle" style="--i: {i};"></span>
          {/each}
        </div>
      {/each}

      <!-- 10. Character - Profile -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('character', forms.character)}
        label="Profile"
        zIndex={30}
        onclick={onOpenProfile}
        hitTop="58%" hitLeft="54%" hitWidth="21%" hitHeight="11%"
        ambientClass={getAmbientClass('Profile')}
        brightness={characterBright}
        showBorder
      />

      <!-- 11. Pet (Cat) -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('pet', forms.pet)}
        label="Pet"
        zIndex={35}
        onclick={showPetBubble}
        hitTop="69%" hitLeft="60%" hitWidth="11%" hitHeight="6%"
        brightness={petBright}
        showBorder
      />

      <!-- Pet speech bubble -->
      <CampSpeechBubble
        text="Grrr..."
        visible={petBubbleVisible}
        top="74%"
        left="66%"
      />


      <!-- Moths orbiting the campfire -->
      {#if !disableEffects}
        <HubMoths />
      {/if}

      <!-- Player level badge -->
      <div class="camp-level-badge">
        <div class="level-number">Lv.{effectiveLevel}</div>
        {#if !levelProgress.isMaxLevel}
          <div class="level-xp-bar">
            <div class="level-xp-fill" style="width: {levelProgress.progress * 100}%"></div>
          </div>
          <div class="level-xp-text">{levelProgress.xpIntoCurrentLevel}/{levelProgress.xpForNextLevel} XP</div>
        {:else}
          <div class="level-xp-text">MAX</div>
        {/if}
      </div>

      <!-- Upgrade modal -->
      {#if showUpgradeModal}
        <CampUpgradeModal onClose={() => { showUpgradeModal = false }} />
      {/if}

      <div class="dev-btn-row">
        {#if onReplayBootAnim}
          <button class="dev-btn" onclick={onReplayBootAnim}>Intro</button>
        {/if}
        <button class="dev-btn" onclick={previewEnter}>Enter</button>
        <button class="dev-btn" onclick={previewExit}>Exit</button>
        <button class="dev-btn" onclick={fakeRunEnd}>RunEnd</button>
        <button class="dev-btn" onclick={testLighting}>Lighting</button>
        <button class="dev-btn" onclick={testBrightIdea}>BrightIdea</button>
        <button class="dev-btn" onclick={testInkSlug}>InkSlug</button>
      </div>

      {#if transitionActive}
        <ParallaxTransition
          imageUrl={transitionImageUrl}
          depthUrl={transitionDepthUrl}
          type={transitionType}
          onComplete={onTransitionComplete}
        />
      {/if}
    </div>

    <!-- Ambient fireflies — rendered in .hub-landscape (not .hub-center) so they cover full viewport -->
    {#if !disableEffects}
      <HubFireflies />
    {/if}

    <!-- Custom cursor glow + firefly trail (rendered in fixed viewport space, z-99/100) -->
    {#if !disableEffects && mouseInHub}
      <HubCursorLight x={mouseX ?? 0} y={mouseY ?? 0} visible={mouseInHub} />
    {/if}
  </div>
{:else}
  <!-- ═══ PORTRAIT LAYOUT — PIXEL-IDENTICAL TO PRE-PORT ════════════════════ -->
  <section
    class="camp-hub"
    aria-label="Camp hub"
    bind:this={campHubEl}
    style:cursor={disableEffects ? undefined : 'none'}
    onpointermove={handleHubPointerMove}
    onpointerleave={handleHubPointerLeave}
  >
    <CampHudOverlay {streak} {greyMatterBalance} {hasActiveRunBanner} />

    <img
      class="camp-bg"
      src={getCampBackgroundUrl()}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      style:filter={bgWarmthFilter}
    />

    <!-- Warm campfire glow + vignette canvas overlay -->
    {#if !disableEffects}
      <HubGlowCanvas
        campfireCenterFn={getCampfireViewportCenter}
        mouseX={mouseInHub ? mouseX : undefined}
        mouseY={mouseInHub ? mouseY : undefined}
      />
    {/if}

    <!-- 1. Dungeon Gate - Start Run -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('doorway', forms.doorway)}
      label="Start Run"
      testId="btn-start-run"
      zIndex={5}
      onclick={onStartRun}
      hitTop="11%" hitLeft="28%" hitWidth="44%" hitHeight="27%"
      labelTop="10%" labelLeft="50%"
      brightness={doorwayBright}
      showBorder
    />

    <!-- 2. Library (Bookshelf) -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('library', forms.library)}
      label="Library"
      zIndex={10}
      onclick={onOpenLibrary}
      hitTop="31%" hitLeft="2%" hitWidth="32%" hitHeight="23%"
      brightness={libraryBright}
      showBorder
    />

    <!-- 3. Settings (Signpost) -->
    <CampSpriteButton
      spriteUrl={getCampSettingsUrl()}
      label="Settings"
      zIndex={10}
      onclick={onOpenSettings}
      hitTop="29%" hitLeft="76%" hitWidth="16%" hitHeight="18%"
      brightness={settingsBright}
      showBorder
    />

    <!-- 5. Quest Board - Leaderboards -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('questboard', forms.questboard)}
      label="Leaderboards"
      zIndex={15}
      onclick={onOpenLeaderboards}
      hitTop="75%" hitLeft="72%" hitWidth="26%" hitHeight="20%"
      brightness={questboardBright}
      showBorder
    />

    <!-- 6. Journal -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('journal', forms.journal)}
      label="Journal"
      zIndex={15}
      onclick={onOpenJournal}
      hitTop="76%" hitLeft="5%" hitWidth="23%" hitHeight="9%"
      brightness={journalBright}
      showBorder
    />

    <!-- 7. Shop (Treasure Chest) — portrait position differs from landscape -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('shop', forms.shop)}
      label="Relic Collection"
      zIndex={15}
      onclick={openUpgradeModal}
      hitTop="87%" hitLeft="52%" hitWidth="19%" hitHeight="11%"
      brightness={shopBrightPortrait}
      showBorder
    />

    <!-- 8. Tent - Multiplayer — portrait position differs from landscape -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('tent', forms.tent)}
      label="Multiplayer"
      zIndex={20}
      onclick={onOpenMultiplayer}
      hitTop="44%" hitLeft="66%" hitWidth="36%" hitHeight="22%"
      brightness={tentBrightPortrait}
      showBorder
    />

    <!-- 9. Campfire - Sparkle burst on click (no fire shadow — dist < 1) -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('campfire', forms.campfire)}
      label="Campfire"
      zIndex={25}
      onclick={handleCampfireClick}
      hitTop="55%" hitLeft="38%" hitWidth="24%" hitHeight="18%"
      brightness={campfireBright}
      showBorder
    />

    <!-- Campfire VFX overlay -->
    {#if !disableEffects}
      <CampfireCanvas {streak} />
    {/if}

    <!-- Campfire sparkle bursts — z-index 27 to stay above CampfireCanvas (z-26) -->
    {#each sparkleBursts as burstId (burstId)}
      <div class="campfire-sparkle-burst" aria-hidden="true">
        {#each Array(8) as _, i}
          <span class="sparkle-particle" style="--i: {i};"></span>
        {/each}
      </div>
    {/each}

    <!-- 10. Character - Profile -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('character', forms.character)}
      label="Profile"
      zIndex={30}
      onclick={onOpenProfile}
      hitTop="58%" hitLeft="54%" hitWidth="21%" hitHeight="11%"
      ambientClass={getAmbientClass('Profile')}
      brightness={characterBright}
      showBorder
    />

    <!-- 11. Pet (Cat) -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('pet', forms.pet)}
      label="Pet"
      zIndex={35}
      onclick={showPetBubble}
      hitTop="69%" hitLeft="60%" hitWidth="11%" hitHeight="6%"
      brightness={petBright}
      showBorder
    />

    <!-- Pet speech bubble -->
    <CampSpeechBubble
      text="Grrr..."
      visible={petBubbleVisible}
      top="74%"
      left="66%"
    />

    <!-- Ambient fireflies -->
    {#if !disableEffects}
      <HubFireflies />
    {/if}


    <!-- Moths orbiting the campfire -->
    {#if !disableEffects}
      <HubMoths />
    {/if}

    <!-- Player level badge -->
    <div class="camp-level-badge">
      <div class="level-number">Lv.{levelProgress.level}</div>
      {#if !levelProgress.isMaxLevel}
        <div class="level-xp-bar">
          <div class="level-xp-fill" style="width: {levelProgress.progress * 100}%"></div>
        </div>
        <div class="level-xp-text">{levelProgress.xpIntoCurrentLevel}/{levelProgress.xpForNextLevel} XP</div>
      {:else}
        <div class="level-xp-text">MAX</div>
      {/if}
    </div>

    <!-- Upgrade modal -->
    {#if showUpgradeModal}
      <CampUpgradeModal onClose={() => { showUpgradeModal = false }} />
    {/if}

    <div class="dev-btn-row">
      {#if onReplayBootAnim}
        <button class="dev-btn" onclick={onReplayBootAnim}>Intro</button>
      {/if}
      <button class="dev-btn" onclick={previewEnter}>Enter</button>
      <button class="dev-btn" onclick={previewExit}>Exit</button>
      <button class="dev-btn" onclick={fakeRunEnd}>RunEnd</button>
    </div>

    {#if transitionActive}
      <ParallaxTransition
        imageUrl={transitionImageUrl}
        depthUrl={transitionDepthUrl}
        type={transitionType}
        onComplete={onTransitionComplete}
      />
    {/if}

    <!-- Custom cursor glow + firefly trail (rendered in fixed viewport space, z-99/100) -->
    {#if !disableEffects && mouseInHub}
      <HubCursorLight x={mouseX ?? 0} y={mouseY ?? 0} visible={mouseInHub} />
    {/if}

  </section>
{/if}

<style>
  /* ═══ LANDSCAPE LAYOUT ══════════════════════════════════════════════════════ */

  /* AR-95: Landscape hub — fixed fullscreen with flex row layout */
  .hub-landscape {
    position: fixed;
    inset: 0;
    background: #0f0f23;
    overflow: hidden;
    display: flex;
    flex-direction: row;
    align-items: stretch;
  }

  .camp-bg-wide {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
  }

  .hub-center {
    /* Portrait 9:16 aspect ratio, fills full viewport height — transparent over wide bg */
    aspect-ratio: 9 / 16;
    height: 100%;
    position: relative;
    flex-shrink: 0;
    z-index: 3;  /* raised above vignette (z-2) so HUD and sprites render above the dark overlay */
    /* Center the portrait column horizontally when viewport is wider than 9:16 */
    margin: 0 auto;
  }

  /* ═══ PORTRAIT LAYOUT ═══════════════════════════════════════════════════════ */

  .camp-hub {
    position: fixed;
    inset: 0;
    background: #000000;
  }

  .camp-bg {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100vw;
    height: 100%;
    object-fit: fill;
    object-position: center;
    z-index: 0;
    image-rendering: pixelated;
    pointer-events: none;
  }

  .campfire-sparkle-burst {
    position: absolute;
    bottom: 38%;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    z-index: 27;
    pointer-events: none;
  }

  .sparkle-particle {
    position: absolute;
    width: calc(5px * var(--layout-scale, 1));
    height: calc(5px * var(--layout-scale, 1));
    background: #ffd700;
    border-radius: 50%;
    box-shadow: 0 0 6px #ffa500, 0 0 12px #ff8c00;
    animation: sparkle-burst 600ms ease-out forwards;
    --angle: calc(var(--i) * 45deg);
    --dist: calc((30px + var(--i) * 5px) * var(--layout-scale, 1));
  }

  @keyframes sparkle-burst {
    0% {
      transform: translate(0, 0) scale(1);
      opacity: 1;
    }
    100% {
      transform: translate(
        calc(cos(var(--angle)) * var(--dist)),
        calc(sin(var(--angle)) * var(--dist) - calc(20px * var(--layout-scale, 1)))
      ) scale(0);
      opacity: 0;
    }
  }

  .dev-btn-row {
    position: absolute;
    bottom: calc(max(110px, 106px + var(--safe-bottom, 0px)));
    right: calc(12px * var(--layout-scale, 1));
    display: flex;
    gap: calc(6px * var(--layout-scale, 1));
    z-index: 50;
  }

  .dev-btn {
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    font-size: calc(10px * var(--text-scale, 1));
    color: rgba(255,255,255,0.45);
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    /* Inherit cursor so hub cursor:none is not overridden by child elements */
    cursor: inherit;
    white-space: nowrap;
  }

  .dev-btn:active {
    background: rgba(255,255,255,0.1);
  }

  .camp-level-badge {
    position: absolute;
    bottom: calc(max(20px, 16px + var(--safe-bottom, 0px)));
    right: calc(12px * var(--layout-scale, 1));
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    pointer-events: none;
  }

  .level-number {
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: calc(16px * var(--layout-scale, 1));
    font-weight: 900;
    color: #ffd700;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(255,215,0,0.3);
    letter-spacing: 0.05em;
  }

  .level-xp-bar {
    width: calc(60px * var(--layout-scale, 1));
    height: calc(4px * var(--layout-scale, 1));
    background: rgba(0,0,0,0.5);
    border-radius: 2px;
    overflow: hidden;
    border: 1px solid rgba(255,215,0,0.3);
  }

  .level-xp-fill {
    height: 100%;
    background: linear-gradient(90deg, #d97706, #fbbf24);
    border-radius: 2px;
    transition: width 300ms ease;
  }

  .level-xp-text {
    font-size: calc(9px * var(--layout-scale, 1));
    font-weight: 700;
    color: rgba(255,255,255,0.7);
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  }

  /* ═══ LANDSCAPE LEVEL BADGE OVERRIDES ═══════════════════════════════════ */

  .hub-landscape .camp-level-badge {
    position: fixed;
    right: calc(20px * var(--layout-scale, 1));
    bottom: calc(24px * var(--layout-scale, 1));
  }

  .hub-landscape .level-number {
    font-size: calc(28px * var(--text-scale, 1));
  }

  .hub-landscape .level-xp-bar {
    width: calc(90px * var(--layout-scale, 1));
    height: calc(6px * var(--layout-scale, 1));
  }

  .hub-landscape .level-xp-text {
    font-size: calc(13px * var(--text-scale, 1));
  }


</style>
