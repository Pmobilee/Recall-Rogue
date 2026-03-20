<script lang="ts">
  import type { RunSummary } from '../../services/hubState'
  import { playerSave } from '../stores/playerData'
  import { getCampUpgradeUrl, getCampBackgroundUrl, getCampBackgroundWideUrl, getCampSettingsUrl } from '../utils/campArtManifest'
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
  import StudyModeSelector from './StudyModeSelector.svelte'

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
    onOpenTopicInterests?: () => void
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
    onOpenTopicInterests,
    onReplayBootAnim,
    disableEffects = false,
  }: Props = $props()

  let showUpgradeModal = $state(false)
  let petBubbleVisible = $state(false)
  let petBubbleTimer: ReturnType<typeof setTimeout> | null = null
  let sparkleBursts = $state<number[]>([])
  let sparkleIdCounter = 0
  const MAX_SPARKLE_BURSTS = 5

  // Derived tier values — reactively update sprite URLs when upgrades are purchased
  let tiers = $derived($campState.tiers)

  // Preload all camp images before revealing screen
  const _campImagesToPreload = [
    getCampBackgroundUrl(),
    getCampBackgroundWideUrl(),
    getCampUpgradeUrl('doorway', $campState.tiers.doorway),
    getCampUpgradeUrl('library', $campState.tiers.library),
    getCampSettingsUrl(),
    getCampUpgradeUrl('campfire', $campState.tiers.campfire),
    getCampUpgradeUrl('tent', $campState.tiers.tent),
    getCampUpgradeUrl('character', $campState.tiers.character),
    getCampUpgradeUrl('pet', $campState.tiers.pet),
    getCampUpgradeUrl('journal', $campState.tiers.journal),
    getCampUpgradeUrl('questboard', $campState.tiers.questboard),
    getCampUpgradeUrl('shop', $campState.tiers.shop),
  ]
  holdScreenTransition()
  preloadImages(_campImagesToPreload).then(releaseScreenTransition)

  let dustBalance = $derived($playerSave?.minerals.dust ?? 0)

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
      <CampHudOverlay {streak} {dustBalance} {hasActiveRunBanner} />

      <!-- Study Mode Selector — above dungeon gate -->
      <div class="study-mode-container" class:banner-offset={hasActiveRunBanner}>
        <StudyModeSelector
          disabled={false}
          onNavigateToDeckBuilder={onOpenDeckBuilder}
        />
      </div>

      <!-- 1. Dungeon Gate - Start Run -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('doorway', tiers.doorway)}
        label=""
        testId="btn-start-run"
        zIndex={5}
        onclick={onStartRun}
        hitTop="11%" hitLeft="28%" hitWidth="44%" hitHeight="27%"
        showBorder
      />

      <!-- 2. Library (Bookshelf) -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('library', tiers.library)}
        label=""
        zIndex={10}
        onclick={onOpenLibrary}
        hitTop="31%" hitLeft="2%" hitWidth="32%" hitHeight="23%"
        showBorder
      />

      <!-- 3. Settings (Signpost) -->
      <CampSpriteButton
        spriteUrl={getCampSettingsUrl()}
        label=""
        zIndex={10}
        onclick={onOpenSettings}
        hitTop="29%" hitLeft="76%" hitWidth="16%" hitHeight="18%"
        showBorder
      />

      <!-- 5. Quest Board - Leaderboards -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('questboard', tiers.questboard)}
        label=""
        zIndex={15}
        onclick={onOpenLeaderboards}
        hitTop="75%" hitLeft="72%" hitWidth="26%" hitHeight="20%"
        showBorder
      />

      <!-- 6. Journal -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('journal', tiers.journal)}
        label=""
        zIndex={15}
        onclick={onOpenJournal}
        hitTop="76%" hitLeft="5%" hitWidth="23%" hitHeight="9%"
        showBorder
      />

      <!-- 7. Shop (Treasure Chest) -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('shop', tiers.shop)}
        label=""
        zIndex={15}
        onclick={openUpgradeModal}
        hitTop="87%" hitLeft="52%" hitWidth="19%" hitHeight="11%"
        showBorder
      />

      <!-- 8. Tent - Profile -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('tent', tiers.tent)}
        label=""
        zIndex={20}
        onclick={onOpenProfile}
        hitTop="44%" hitLeft="64%" hitWidth="36%" hitHeight="22%"
        ambientClass={getAmbientClass('Profile')}
        showBorder
      />

      <!-- 9. Campfire - Sparkle burst on click -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('campfire', tiers.campfire)}
        label=""
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

      <!-- 10. Character - Social -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('character', tiers.character)}
        label=""
        zIndex={30}
        onclick={onOpenSocial}
        hitTop="58%" hitLeft="57%" hitWidth="21%" hitHeight="11%"
        showBorder
      />

      <!-- 11. Pet (Cat) - shows speech bubble -->
      <CampSpriteButton
        spriteUrl={getCampUpgradeUrl('pet', tiers.pet)}
        label=""
        zIndex={35}
        onclick={showPetBubble}
        hitTop="69%" hitLeft="66%" hitWidth="11%" hitHeight="4%"
        showBorder
      />

      <!-- Pet speech bubble -->
      <CampSpeechBubble
        text="Grrr..."
        visible={petBubbleVisible}
        top="74%"
        left="66%"
      />

      <!-- Upgrade modal -->
      {#if showUpgradeModal}
        <CampUpgradeModal onClose={() => { showUpgradeModal = false }} />
      {/if}

      <!-- Replay boot animation (dev) -->
      {#if onReplayBootAnim}
        <button class="replay-boot-btn" onclick={onReplayBootAnim}>Intro</button>
      {/if}
    </div>

    <!-- AR-95: Right decorative side panel (flanks center campsite column) -->
    <div class="hub-side-panel hub-side-right" aria-hidden="true"></div>
  </div>
{:else}
  <!-- ═══ PORTRAIT LAYOUT — PIXEL-IDENTICAL TO PRE-PORT ════════════════════ -->
  <section class="camp-hub" aria-label="Camp hub">
    <CampHudOverlay {streak} {dustBalance} {hasActiveRunBanner} />

    <img
      class="camp-bg"
      src={getCampBackgroundUrl()}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
    />

    <!-- Study Mode Selector — above dungeon gate -->
    <div class="study-mode-container" class:banner-offset={hasActiveRunBanner}>
      <StudyModeSelector
        disabled={false}
        onNavigateToDeckBuilder={onOpenDeckBuilder}
      />
    </div>

    <!-- 1. Dungeon Gate - Start Run -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('doorway', tiers.doorway)}
      label=""
      testId="btn-start-run"
      zIndex={5}
      onclick={onStartRun}
      hitTop="11%" hitLeft="28%" hitWidth="44%" hitHeight="27%"
      showBorder
    />

    <!-- 2. Library (Bookshelf) -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('library', tiers.library)}
      label=""
      zIndex={10}
      onclick={onOpenLibrary}
      hitTop="31%" hitLeft="2%" hitWidth="32%" hitHeight="23%"
      showBorder
    />

    <!-- 3. Settings (Signpost) -->
    <CampSpriteButton
      spriteUrl={getCampSettingsUrl()}
      label=""
      zIndex={10}
      onclick={onOpenSettings}
      hitTop="29%" hitLeft="76%" hitWidth="16%" hitHeight="18%"
      showBorder
    />

    <!-- 5. Quest Board - Leaderboards -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('questboard', tiers.questboard)}
      label=""
      zIndex={15}
      onclick={onOpenLeaderboards}
      hitTop="75%" hitLeft="72%" hitWidth="26%" hitHeight="20%"
      showBorder
    />

    <!-- 6. Journal -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('journal', tiers.journal)}
      label=""
      zIndex={15}
      onclick={onOpenJournal}
      hitTop="76%" hitLeft="5%" hitWidth="23%" hitHeight="9%"
      showBorder
    />

    <!-- 7. Shop (Treasure Chest) -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('shop', tiers.shop)}
      label=""
      zIndex={15}
      onclick={openUpgradeModal}
      hitTop="87%" hitLeft="52%" hitWidth="19%" hitHeight="11%"
      showBorder
    />

    <!-- 8. Tent - Profile -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('tent', tiers.tent)}
      label=""
      zIndex={20}
      onclick={onOpenProfile}
      hitTop="44%" hitLeft="64%" hitWidth="36%" hitHeight="22%"
      ambientClass={getAmbientClass('Profile')}
      showBorder
    />

    <!-- 9. Campfire - Sparkle burst on click -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('campfire', tiers.campfire)}
      label=""
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

    <!-- 10. Character - Social -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('character', tiers.character)}
      label=""
      zIndex={30}
      onclick={onOpenSocial}
      hitTop="58%" hitLeft="57%" hitWidth="21%" hitHeight="11%"
      showBorder
    />

    <!-- 11. Pet (Cat) - shows speech bubble -->
    <CampSpriteButton
      spriteUrl={getCampUpgradeUrl('pet', tiers.pet)}
      label=""
      zIndex={35}
      onclick={showPetBubble}
      hitTop="69%" hitLeft="66%" hitWidth="11%" hitHeight="4%"
      showBorder
    />

    <!-- Pet speech bubble -->
    <CampSpeechBubble
      text="Grrr..."
      visible={petBubbleVisible}
      top="74%"
      left="66%"
    />

    <!-- Upgrade modal -->
    {#if showUpgradeModal}
      <CampUpgradeModal onClose={() => { showUpgradeModal = false }} />
    {/if}

    <!-- Replay boot animation (dev) -->
    {#if onReplayBootAnim}
      <button class="replay-boot-btn" onclick={onReplayBootAnim}>Intro</button>
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
    object-fit: cover;
    object-position: center;
    z-index: 0;
    image-rendering: pixelated;
    pointer-events: none;
  }

  .study-mode-container {
    position: absolute;
    top: calc(3% + var(--safe-top));
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    z-index: 30;
  }

  .study-mode-container.banner-offset {
    top: calc(3% + calc(64px * var(--layout-scale, 1)) + var(--safe-top));
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

  .replay-boot-btn {
    position: absolute;
    bottom: calc(12px + var(--safe-bottom, 0px));
    left: 12px;
    padding: 4px 10px;
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6px;
    z-index: 50;
    cursor: pointer;
  }
  .replay-boot-btn:active {
    background: rgba(255,255,255,0.1);
  }

</style>
