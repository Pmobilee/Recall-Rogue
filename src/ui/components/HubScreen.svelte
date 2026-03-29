<script lang="ts">
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

  import ParallaxTransition from './ParallaxTransition.svelte'
  import { getLevelProgress } from '../../services/characterLevel'
  import { playCardAudio } from '../../services/cardAudioManager'

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
    onOpenSocial: () => void
    onOpenRelicSanctum: () => { ok: true } | { ok: false; reason: string }
    onOpenDeckBuilder?: () => void
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
    onOpenSocial,
    onOpenRelicSanctum,
    onOpenDeckBuilder,
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
    getCampUpgradeUrl('pet', $campState.forms?.pet ?? $campState.tiers.pet),
    getCampUpgradeUrl('journal', $campState.forms?.journal ?? $campState.tiers.journal),
    getCampUpgradeUrl('questboard', $campState.forms?.questboard ?? $campState.tiers.questboard),
    getCampUpgradeUrl('shop', $campState.forms?.shop ?? $campState.tiers.shop),
  ]
  holdScreenTransition()
  preloadImages(_campImagesToPreload).then(releaseScreenTransition)

  let greyMatterBalance = $derived($playerSave?.minerals.greyMatter ?? 0)
  let levelProgress = $derived(getLevelProgress($playerSave?.totalXP ?? 0))
  // Use stored characterLevel as primary (survives XP desync), fall back to XP-derived
  let effectiveLevel = $derived(Math.max($playerSave?.characterLevel ?? 0, levelProgress.level))

  $effect(() => {
    playCardAudio('hub-welcome')
  })

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

  function onTransitionComplete(): void {
    transitionActive = false
  }
</script>

{#if $isLandscape}
  <!-- ═══ LANDSCAPE LAYOUT ═══════════════════════════════════════════════════ -->
  <div class="hub-landscape" aria-label="Camp hub">
    <!-- Full 16:9 widescreen background — covers entire viewport -->
    <img
      class="camp-bg-wide"
      src={getCampBackgroundWideUrl()}
      alt=""
      aria-hidden="true"
      loading="eager"
      decoding="async"
    />

    <!-- AR-95: Left decorative side panel (flanks center campsite column) -->
    <div class="hub-side-panel hub-side-left" aria-hidden="true"></div>

    <!-- Center column: portrait 9:16 hotspot container (transparent — wide bg shows through) -->
    <div class="hub-center">
      <CampHudOverlay {streak} {greyMatterBalance} {hasActiveRunBanner} />

      <!-- 1. Dungeon Gate - Start Run -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('doorway', forms.doorway)}
        label="Start Run"
        testId="btn-start-run"
        zIndex={5}
        onclick={handleStartRun}
        hitTop="11%" hitLeft="28%" hitWidth="44%" hitHeight="27%"
        showBorder
      />

      <!-- 2. Library (Bookshelf) -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('library', forms.library)}
        label="Library"
        zIndex={10}
        onclick={onOpenLibrary}
        hitTop="31%" hitLeft="2%" hitWidth="32%" hitHeight="23%"
        showBorder
      />

      <!-- 3. Settings (Signpost) -->
      <CampSpriteButton
        spriteUrl={getCampSettingsUrl()}
        label="Settings"
        zIndex={10}
        onclick={onOpenSettings}
        hitTop="29%" hitLeft="76%" hitWidth="16%" hitHeight="18%"
        showBorder
      />

      <!-- 5. Quest Board - Leaderboards -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('questboard', forms.questboard)}
        label="Leaderboards"
        zIndex={15}
        onclick={onOpenLeaderboards}
        hitTop="75%" hitLeft="72%" hitWidth="26%" hitHeight="20%"
        showBorder
      />

      <!-- 6. Journal -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('journal', forms.journal)}
        label="Journal"
        zIndex={15}
        onclick={onOpenJournal}
        hitTop="76%" hitLeft="5%" hitWidth="23%" hitHeight="9%"
        showBorder
      />

      <!-- 7. Shop (Treasure Chest) -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('shop', forms.shop)}
        label="Relic Collection"
        zIndex={15}
        onclick={openUpgradeModal}
        hitTop="87%" hitLeft="52%" hitWidth="19%" hitHeight="11%"
        showBorder
      />

      <!-- 8. Tent - Social -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('tent', forms.tent)}
        label="Social"
        zIndex={20}
        onclick={onOpenSocial}
        hitTop="44%" hitLeft="66%" hitWidth="36%" hitHeight="22%"
        showBorder
      />

      <!-- 9. Campfire - Sparkle burst on click -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('campfire', forms.campfire)}
        label="Campfire"
        zIndex={25}
        onclick={handleCampfireClick}
        hitTop="55%" hitLeft="38%" hitWidth="24%" hitHeight="18%"
        showBorder
      />

      <!-- Campfire VFX overlay -->
      {#if !disableEffects}
        <CampfireCanvas {streak} />
      {/if}

      <!-- Campfire sparkle bursts -->
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
        showBorder
      />

      <!-- 11. Pet (Cat) - shows speech bubble -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('pet', forms.pet)}
        label="Pet"
        zIndex={35}
        onclick={showPetBubble}
        hitTop="69%" hitLeft="66%" hitWidth="11%" hitHeight="6%"
        showBorder
      />

      <!-- Pet speech bubble -->
      <CampSpeechBubble
        text="Grrr..."
        visible={petBubbleVisible}
        top="74%"
        left="66%"
      />

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

    <!-- AR-95: Right decorative side panel (flanks center campsite column) -->
    <div class="hub-side-panel hub-side-right" aria-hidden="true"></div>
  </div>
{:else}
  <!-- ═══ PORTRAIT LAYOUT — PIXEL-IDENTICAL TO PRE-PORT ════════════════════ -->
  <section class="camp-hub" aria-label="Camp hub">
    <CampHudOverlay {streak} {greyMatterBalance} {hasActiveRunBanner} />

    <img
      class="camp-bg"
      src={getCampBackgroundUrl()}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
    />

    <!-- 1. Dungeon Gate - Start Run -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('doorway', forms.doorway)}
      label="Start Run"
      testId="btn-start-run"
      zIndex={5}
      onclick={onStartRun}
      hitTop="11%" hitLeft="28%" hitWidth="44%" hitHeight="27%"
      labelTop="10%" labelLeft="50%"
      showBorder
    />

    <!-- 2. Library (Bookshelf) -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('library', forms.library)}
      label="Library"
      zIndex={10}
      onclick={onOpenLibrary}
      hitTop="31%" hitLeft="2%" hitWidth="32%" hitHeight="23%"
      showBorder
    />

    <!-- 3. Settings (Signpost) -->
    <CampSpriteButton
      spriteUrl={getCampSettingsUrl()}
      label="Settings"
      zIndex={10}
      onclick={onOpenSettings}
      hitTop="29%" hitLeft="76%" hitWidth="16%" hitHeight="18%"
      showBorder
    />

    <!-- 5. Quest Board - Leaderboards -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('questboard', forms.questboard)}
      label="Leaderboards"
      zIndex={15}
      onclick={onOpenLeaderboards}
      hitTop="75%" hitLeft="72%" hitWidth="26%" hitHeight="20%"
      showBorder
    />

    <!-- 6. Journal -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('journal', forms.journal)}
      label="Journal"
      zIndex={15}
      onclick={onOpenJournal}
      hitTop="76%" hitLeft="5%" hitWidth="23%" hitHeight="9%"
      showBorder
    />

    <!-- 7. Shop (Treasure Chest) -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('shop', forms.shop)}
      label="Relic Collection"
      zIndex={15}
      onclick={openUpgradeModal}
      hitTop="87%" hitLeft="52%" hitWidth="19%" hitHeight="11%"
      showBorder
    />

    <!-- 8. Tent - Social -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('tent', forms.tent)}
      label="Social"
      zIndex={20}
      onclick={onOpenSocial}
      hitTop="44%" hitLeft="66%" hitWidth="36%" hitHeight="22%"
      showBorder
    />

    <!-- 9. Campfire - Sparkle burst on click -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('campfire', forms.campfire)}
      label="Campfire"
      zIndex={25}
      onclick={handleCampfireClick}
      hitTop="55%" hitLeft="38%" hitWidth="24%" hitHeight="18%"
      showBorder
    />

    <!-- Campfire VFX overlay -->
    {#if !disableEffects}
      <CampfireCanvas {streak} />
    {/if}

    <!-- Campfire sparkle bursts -->
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
      showBorder
    />

    <!-- 11. Pet (Cat) - shows speech bubble -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('pet', forms.pet)}
      label="Pet"
      zIndex={35}
      onclick={showPetBubble}
      hitTop="69%" hitLeft="66%" hitWidth="11%" hitHeight="6%"
      showBorder
    />

    <!-- Pet speech bubble -->
    <CampSpeechBubble
      text="Grrr..."
      visible={petBubbleVisible}
      top="74%"
      left="66%"
    />

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

  </section>
{/if}

<style>
  /* ═══ LANDSCAPE LAYOUT ══════════════════════════════════════════════════════ */

  /* AR-95: Landscape hub — fixed fullscreen with flex row layout for side panels */
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

  /* AR-95: Decorative side panels — dark gradient flanking the center campsite */
  .hub-side-panel {
    flex: 1;
    position: relative;
    z-index: 1;
    pointer-events: none;
  }

  .hub-side-left {
    background: linear-gradient(to right, rgba(10, 10, 26, 0.6), transparent);
  }

  .hub-side-right {
    background: linear-gradient(to left, rgba(10, 10, 26, 0.6), transparent);
  }

  .hub-center {
    /* Portrait 9:16 aspect ratio, fills full viewport height — transparent over wide bg */
    aspect-ratio: 9 / 16;
    height: 100%;
    position: relative;
    flex-shrink: 0;
    z-index: 1;
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
    z-index: 17;
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
    cursor: pointer;
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
