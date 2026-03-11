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
  import StudyModeSelector from './StudyModeSelector.svelte'

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
    onOpenRelicSanctum: () => { ok: true } | { ok: false; reason: string }
    onOpenDeckBuilder?: () => void
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
    onOpenRelicSanctum,
    onOpenDeckBuilder,
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

  function handleRelicClick(): void {
    onOpenRelicSanctum()
  }
</script>

<section class="camp-hub" aria-label="Camp hub">
  <CampHudOverlay {streak} {dustBalance} />

  <img
    class="camp-bg"
    src={getCampBackgroundUrl()}
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
  />

  <!-- Study Mode Selector — above dungeon gate -->
  <div class="study-mode-container">
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
  />

  <!-- 2. Bookshelf - Library -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('bookshelf')}
    label="Library"
    zIndex={20}
    onclick={onOpenLibrary}
    hitTop="31%" hitLeft="2%" hitWidth="32%" hitHeight="23%"
    labelTop="29%" labelLeft="18%"
  />

  <!-- 3. Signpost - Settings -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('signpost')}
    label="Settings"
    zIndex={20}
    onclick={onOpenSettings}
    hitTop="29%" hitLeft="76%" hitWidth="16%" hitHeight="18%"
    labelTop="27%" labelLeft="84%"
  />

  <!-- 4. Anvil - Relics -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('anvil')}
    label="Relics"
    zIndex={20}
    onclick={handleRelicClick}
    hitTop="54%" hitLeft="26%" hitWidth="18%" hitHeight="9%"
    labelTop="52%" labelLeft="35%"
  />

  <!-- 5. Campfire - Decorative (no hitbox, no label) -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('campfire')}
    label="Campfire"
    zIndex={15}
    decorative
  />

  <!-- 6. Tent - Profile -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('tent')}
    label="Profile"
    zIndex={18}
    onclick={onOpenProfile}
    hitTop="44%" hitLeft="64%" hitWidth="36%" hitHeight="22%"
    labelTop="42%" labelLeft="74%"
  />

  <!-- 7. Character - Social -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('character')}
    label="Social"
    zIndex={25}
    onclick={onOpenSocial}
    hitTop="58%" hitLeft="57%" hitWidth="21%" hitHeight="11%"
    labelTop="57%" labelLeft="58%"
  />

  <!-- 8. Cat - Pet, shows speech bubble -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('cat')}
    label="Pet"
    zIndex={22}
    onclick={showPetBubble}
    hitTop="69%" hitLeft="66%" hitWidth="11%" hitHeight="4%"
    labelTop="74%" labelLeft="72%"
  />

  <!-- 9. Journal (Book) -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('journal')}
    label="Journal"
    zIndex={25}
    onclick={onOpenJournal}
    hitTop="76%" hitLeft="5%" hitWidth="23%" hitHeight="9%"
    labelTop="86%" labelLeft="16%"
  />

  <!-- 10. Quest Board - Leaderboards -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('quest-board')}
    label="Quests"
    zIndex={25}
    onclick={onOpenLeaderboards}
    hitTop="75%" hitLeft="72%" hitWidth="26%" hitHeight="20%"
    labelTop="96%" labelLeft="85%"
  />

  <!-- 11. Treasure Chest - Shop (opens upgrade modal) -->
  <CampSpriteButton
    spriteUrl={getCampSpriteUrl('treasure-chest')}
    label="Shop"
    zIndex={25}
    onclick={openUpgradeModal}
    hitTop="87%" hitLeft="52%" hitWidth="19%" hitHeight="11%"
    labelTop="84%" labelLeft="62%"
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
    top: 3%;
    left: 50%;
    transform: translateX(-50%);
    z-index: 30;
  }

</style>
