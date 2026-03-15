<script lang="ts">
  import { onMount } from 'svelte'
  import type { RunSummary } from '../../services/hubState'
  import { playerSave } from '../stores/playerData'
  import { initCampArtManifest } from '../utils/campArtManifest'
  import { getCampSpriteUrl, getCampBackgroundUrl } from '../utils/campArtManifest'
  import { getAmbientClass } from '../effects/HubAmbientEffects'
  import { holdScreenTransition, releaseScreenTransition } from '../stores/gameState'
  import { preloadImages } from '../utils/assetPreloader'
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
  }: Props = $props()

  let showUpgradeModal = $state(false)
  let petBubbleVisible = $state(false)
  let petBubbleTimer: ReturnType<typeof setTimeout> | null = null
  let sparkleBursts = $state<number[]>([])
  let sparkleIdCounter = 0
  const MAX_SPARKLE_BURSTS = 5

  // Preload all camp images before revealing screen
  const _campImagesToPreload = [
    getCampBackgroundUrl(),
    getCampSpriteUrl('dungeon-gate'),
    getCampSpriteUrl('bookshelf'),
    getCampSpriteUrl('signpost'),
    getCampSpriteUrl('anvil'),
    getCampSpriteUrl('campfire'),
    getCampSpriteUrl('tent'),
    getCampSpriteUrl('character'),
    getCampSpriteUrl('cat'),
    getCampSpriteUrl('journal'),
    getCampSpriteUrl('quest-board'),
    getCampSpriteUrl('treasure-chest'),
  ]
  holdScreenTransition()
  preloadImages(_campImagesToPreload).then(releaseScreenTransition)

  let dustBalance = $derived($playerSave?.minerals.dust ?? 0)

  onMount(() => {
    initCampArtManifest()
  })

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

  function handleRelicClick(): void {
    onOpenRelicSanctum()
  }

  function handleCampfireClick(): void {
    const id = ++sparkleIdCounter
    sparkleBursts = [...sparkleBursts.slice(-(MAX_SPARKLE_BURSTS - 1)), id]
    setTimeout(() => {
      sparkleBursts = sparkleBursts.filter(b => b !== id)
    }, 700)
  }
</script>

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
    spriteUrl={getCampSpriteUrl('dungeon-gate')}
    label="Enter Dungeon"
    testId="btn-start-run"
    zIndex={10}
    onclick={onStartRun}
    hitTop="11%" hitLeft="28%" hitWidth="44%" hitHeight="27%"
    labelTop="40%" labelLeft="50%"
    showBorder
  />

  <!-- 2. Bookshelf - Library -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('bookshelf')}
    label="Library"
    zIndex={20}
    onclick={onOpenLibrary}
    hitTop="31%" hitLeft="2%" hitWidth="32%" hitHeight="23%"
    labelTop="29%" labelLeft="18%"
    showBorder
  />

  <!-- 3. Signpost - Settings -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('signpost')}
    label="Settings"
    zIndex={20}
    onclick={onOpenSettings}
    hitTop="29%" hitLeft="76%" hitWidth="16%" hitHeight="18%"
    labelTop="27%" labelLeft="84%"
    showBorder
  />

  <!-- 4. Anvil - Relics -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('anvil')}
    label="Relics"
    zIndex={20}
    onclick={handleRelicClick}
    hitTop="54%" hitLeft="26%" hitWidth="18%" hitHeight="9%"
    labelTop="52%" labelLeft="35%"
    ambientClass={getAmbientClass('Relics')}
    showBorder
  />

  <!-- 5. Campfire - Sparkle burst on click -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('campfire')}
    label=""
    zIndex={15}
    onclick={handleCampfireClick}
    hitTop="55%" hitLeft="38%" hitWidth="24%" hitHeight="18%"
  />

  <!-- Campfire VFX overlay -->
  <CampfireCanvas {streak} />

  <!-- Campfire sparkle bursts -->
  {#each sparkleBursts as burstId (burstId)}
    <div class="campfire-sparkle-burst" aria-hidden="true">
      {#each Array(8) as _, i}
        <span class="sparkle-particle" style="--i: {i};"></span>
      {/each}
    </div>
  {/each}

  <!-- 6. Tent - Profile -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('tent')}
    label="Profile"
    zIndex={18}
    onclick={onOpenProfile}
    hitTop="44%" hitLeft="64%" hitWidth="36%" hitHeight="22%"
    labelTop="46%" labelLeft="74%"
    ambientClass={getAmbientClass('Profile')}
    showBorder
  />

  <!-- 7. Character - Social -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('character')}
    label="Social"
    zIndex={25}
    onclick={onOpenSocial}
    hitTop="58%" hitLeft="57%" hitWidth="21%" hitHeight="11%"
    labelTop="57%" labelLeft="58%"
    showBorder
  />

  <!-- 8. Cat - Pet, shows speech bubble -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('cat')}
    label=""
    zIndex={22}
    onclick={showPetBubble}
    hitTop="69%" hitLeft="66%" hitWidth="11%" hitHeight="4%"
    showBorder
  />

  <!-- 9. Journal (Book) -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('journal')}
    label="Journal"
    zIndex={25}
    onclick={onOpenJournal}
    hitTop="76%" hitLeft="5%" hitWidth="23%" hitHeight="9%"
    labelTop="86%" labelLeft="16%"
    showBorder
  />

  <!-- 9.5. Scroll - Topics & Difficulty (hidden: no scroll sprite asset yet) -->

  <!-- 10. Quest Board - Leaderboards -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('quest-board')}
    label="Quests"
    zIndex={25}
    onclick={onOpenLeaderboards}
    hitTop="75%" hitLeft="72%" hitWidth="26%" hitHeight="20%"
    labelTop="96%" labelLeft="85%"
    showBorder
  />

  <!-- 11. Treasure Chest - Shop (opens upgrade modal) -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('treasure-chest')}
    label="Shop"
    zIndex={25}
    onclick={openUpgradeModal}
    hitTop="87%" hitLeft="52%" hitWidth="19%" hitHeight="11%"
    labelTop="84%" labelLeft="62%"
    showBorder
  />

  <!-- Pet speech bubble -->
  <CampSpeechBubble
    text="Grrr..."
    visible={petBubbleVisible}
    top="64%"
    left="42%"
  />

  <!-- Upgrade modal -->
  {#if showUpgradeModal}
    <CampUpgradeModal onClose={() => { showUpgradeModal = false }} />
  {/if}

</section>

<style>
  .camp-hub {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #0a0e18;
  }

  .camp-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    z-index: 0;
    image-rendering: pixelated;
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

</style>
