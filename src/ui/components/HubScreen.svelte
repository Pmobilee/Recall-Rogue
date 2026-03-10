<script lang="ts">
  import { onMount } from 'svelte'
  import type { RunSummary } from '../../services/hubState'
  import { playerSave } from '../stores/playerData'
  import { initCampArtManifest } from '../utils/campArtManifest'
  import { getCampSpriteUrl, getCampBackgroundUrl } from '../utils/campArtManifest'
  import CampSpriteButton from './CampSpriteButton.svelte'
  import CampSpeechBubble from './CampSpeechBubble.svelte'
  import CampHudOverlay from './CampHudOverlay.svelte'
  import CampUpgradeModal from './CampUpgradeModal.svelte'

  interface Props {
    streak: number
    lastRunSummary: RunSummary | null
    onStartRun: () => void
    onOpenLibrary: () => void
    onOpenSettings: () => void
    onOpenProfile: () => void
    onOpenJournal: () => void
    onOpenLeaderboards: () => void
    onOpenSocial: () => void
  }

  let {
    streak,
    lastRunSummary,
    onStartRun,
    onOpenLibrary,
    onOpenSettings,
    onOpenProfile,
    onOpenJournal,
    onOpenLeaderboards,
    onOpenSocial,
  }: Props = $props()

  let showUpgradeModal = $state(false)
  let petBubbleVisible = $state(false)
  let petBubbleTimer: ReturnType<typeof setTimeout> | null = null

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
</script>

<section class="camp-hub" aria-label="Camp hub">
  <img
    class="camp-bg"
    src={getCampBackgroundUrl()}
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
  />

  <CampHudOverlay {streak} {dustBalance} />

  <!-- 1. Dungeon Gate - Start Run -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('dungeon-gate')}
    label="Enter Dungeon"
    testId="btn-start-run"
    top="22%"
    left="50%"
    width="45vw"
    zIndex={10}
    onclick={onStartRun}
  />

  <!-- 2. Bookshelf - Library -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('bookshelf')}
    label="Library"
    top="42%"
    left="12%"
    width="22vw"
    zIndex={20}
    onclick={onOpenLibrary}
  />

  <!-- 3. Signpost - Settings -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('signpost')}
    label="Settings"
    top="40%"
    left="88%"
    width="14vw"
    zIndex={20}
    onclick={onOpenSettings}
  />

  <!-- 4. Anvil - Upgrades -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('anvil')}
    label="Upgrades"
    top="58%"
    left="20%"
    width="16vw"
    zIndex={20}
    onclick={openUpgradeModal}
  />

  <!-- 5. Campfire - Decorative (streak visual) -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('campfire')}
    label="Campfire"
    top="62%"
    left="50%"
    width="22vw"
    zIndex={15}
    decorative
  />

  <!-- 6. Tent - Profile -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('tent')}
    label="Profile"
    top="55%"
    left="80%"
    width="30vw"
    zIndex={18}
    onclick={onOpenProfile}
  />

  <!-- 7. Character - Customize (opens upgrade modal) -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('character')}
    label="Customize"
    top="52%"
    left="75%"
    width="16vw"
    zIndex={25}
    onclick={openUpgradeModal}
  />

  <!-- 8. Cat - Pet, shows speech bubble -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('cat')}
    label="Pet"
    top="68%"
    left="42%"
    width="10vw"
    zIndex={22}
    onclick={showPetBubble}
  />

  <!-- 9. Journal (Book) -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('journal')}
    label="Journal"
    top="78%"
    left="18%"
    width="14vw"
    zIndex={25}
    onclick={onOpenJournal}
  />

  <!-- 10. Quest Board - Leaderboards -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('quest-board')}
    label="Quests"
    top="75%"
    left="82%"
    width="20vw"
    zIndex={25}
    onclick={onOpenLeaderboards}
  />

  <!-- 11. Treasure Chest - Social -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('treasure-chest')}
    label="Social"
    top="82%"
    left="50%"
    width="16vw"
    zIndex={25}
    onclick={onOpenSocial}
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
    object-fit: cover;
    z-index: 0;
    image-rendering: pixelated;
  }
</style>
