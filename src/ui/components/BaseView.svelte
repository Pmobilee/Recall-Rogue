<script lang="ts">
  import { untrack } from 'svelte'
  import { playerSave, getDueReviews } from '../stores/playerData'
  import { audioManager } from '../../services/audioService'
  import {
    gaiaMood,
    type GaiaMood,
  } from '../stores/settings'
  import { GAIA_IDLE_QUIPS } from '../../data/gaiaDialogue'
  import { GAIA_EXPRESSIONS, GAIA_NAME, GAIA_FULL_NAME, GAIA_TAGLINE, getGaiaExpression } from '../../data/gaiaAvatar'
  import { BALANCE } from '../../data/balance'

  // GAIA sprite imports for all expression states
  import gaiaNeutralImg from '../../assets/sprites/dome/gaia_neutral.png'
  import gaiaHappyImg from '../../assets/sprites/dome/gaia_happy.png'
  import gaiaThinkingImg from '../../assets/sprites/dome/gaia_thinking.png'
  import gaiaSnarkyImg from '../../assets/sprites/dome/gaia_snarky.png'
  import gaiaSurprisedImg from '../../assets/sprites/dome/gaia_surprised.png'
  import gaiaCalmImg from '../../assets/sprites/dome/gaia_calm.png'

  /** Map expression IDs to sprite image URLs */
  const GAIA_SPRITE_MAP: Record<string, string> = {
    neutral:   gaiaNeutralImg,
    happy:     gaiaHappyImg,
    excited:   gaiaHappyImg,
    thinking:  gaiaThinkingImg,
    worried:   gaiaThinkingImg,
    proud:     gaiaHappyImg,
    snarky:    gaiaSnarkyImg,
    surprised: gaiaSurprisedImg,
    calm:      gaiaCalmImg,
  }

  import type { Fact } from '../../data/types'

  import ProgressBars from './ProgressBars.svelte'
  import SyncIndicator from './SyncIndicator.svelte'

  // Room sub-components
  import CommandRoom from './rooms/CommandRoom.svelte'
  import LabRoom from './rooms/LabRoom.svelte'
  import WorkshopRoom from './rooms/WorkshopRoom.svelte'
  import MuseumRoom from './rooms/MuseumRoom.svelte'
  import MarketRoom from './rooms/MarketRoom.svelte'
  import ArchiveRoom from './rooms/ArchiveRoom.svelte'

  /** Pick a random idle quip from the pool matching the current mood. */
  function randomIdleQuip(mood: GaiaMood): string {
    const pool = GAIA_IDLE_QUIPS[mood]
    return pool[Math.floor(Math.random() * pool.length)]
  }

  let gaiaComment = $state(randomIdleQuip($gaiaMood))
  let gaiaVisible = $state(true)
  /** Expression id for the currently shown idle quip */
  let idleExpressionId = $state(getGaiaExpression('idle', $gaiaMood).id)

  /**
   * Soft GAIA study prompt — shown when 5 or more facts are due for review (DD-V2-142).
   * Dismissed after the player clicks it or after 15 seconds.
   */
  let studyPromptVisible = $state(false)
  let studyPromptCount = $state(0)

  $effect(() => {
    // Re-pick immediately when the mood changes (reactive on $gaiaMood)
    gaiaComment = randomIdleQuip($gaiaMood)
    idleExpressionId = getGaiaExpression('idle', $gaiaMood).id
    gaiaVisible = true
  })

  $effect(() => {
    const interval = setInterval(() => {
      gaiaVisible = false
      setTimeout(() => {
        gaiaComment = randomIdleQuip($gaiaMood)
        idleExpressionId = getGaiaExpression('idle', $gaiaMood).id
        gaiaVisible = true
      }, 400)
    }, 12000)

    return () => {
      clearInterval(interval)
    }
  })

  // Check for due reviews on dome load. If 5+ are waiting, show a soft GAIA nudge
  // after a short delay so it feels natural — not an alert (DD-V2-142).
  $effect(() => {
    const timer = setTimeout(() => {
      const due = getDueReviews()
      if (due.length >= 5) {
        studyPromptCount = due.length
        studyPromptVisible = true
        // Auto-dismiss after 15 seconds if the player ignores it
        setTimeout(() => { studyPromptVisible = false }, 15000)
      }
    }, 1800)
    return () => clearTimeout(timer)
  })

  const idleSpriteUrl = $derived(
    GAIA_SPRITE_MAP[idleExpressionId] ?? gaiaNeutralImg
  )

  interface Props {
    onDive: () => void
    onStudy: () => void
    onReviewArtifact: () => void
    onViewTree?: () => void
    onMaterializer?: () => void
    onPremiumMaterializer?: () => void
    onCosmetics?: () => void
    onKnowledgeStore?: () => void
    onFossils?: () => void
    onZoo?: () => void
    onStreakPanel?: () => void
    onFarm?: () => void
    onSettings?: () => void
    facts?: Fact[]
    initialRoom?: string
  }

  let { onDive, onStudy, onReviewArtifact, onViewTree, onMaterializer, onPremiumMaterializer, onCosmetics, onKnowledgeStore, onFossils, onZoo, onStreakPanel, onFarm, onSettings, facts, initialRoom }: Props = $props()

  // === DOME ROOM STATE ===
  let currentRoom = $state<string>('command')

  $effect(() => {
    if (initialRoom) {
      currentRoom = initialRoom
    }
  })

  /** Rooms the player has unlocked. */
  const unlockedRooms = $derived($playerSave?.unlockedRooms ?? ['command'])

  /** Total dives completed — used to show "X more dives" unlock hints on locked tabs. */
  const totalDives = $derived($playerSave?.stats.totalDivesCompleted ?? 0)

  /** Track recently unlocked rooms to show a brief gold pulse animation. */
  let recentlyUnlockedSet = $state<string[]>([])
  let _prevUnlockedRooms = $state<string[]>(['command'])

  $effect(() => {
    const rooms = $playerSave?.unlockedRooms ?? ['command']
    const prev = untrack(() => _prevUnlockedRooms)
    const newOnes = rooms.filter(r => !prev.includes(r) && r !== 'command')
    if (newOnes.length > 0) {
      recentlyUnlockedSet = [...untrack(() => recentlyUnlockedSet), ...newOnes]
      for (const r of newOnes) {
        setTimeout(() => {
          recentlyUnlockedSet = untrack(() => recentlyUnlockedSet).filter(x => x !== r)
        }, 4000)
      }
    }
    _prevUnlockedRooms = rooms
  })

  function isRoomUnlocked(roomId: string): boolean {
    return unlockedRooms.includes(roomId)
  }

  function handleRoomSelect(roomId: string): void {
    if (!isRoomUnlocked(roomId)) return
    audioManager.playSound('button_click')
    currentRoom = roomId
  }
</script>

<section class="base-view" aria-label="Terra Base hub">
  <!-- === SYNC STATUS INDICATOR (Phase 19.2) === -->
  <SyncIndicator />

  <!-- === PROGRESS BARS (Phase 17) === -->
  <ProgressBars />

  <!-- === ROOM TAB BAR === -->
  <nav class="room-tab-bar" aria-label="Dome rooms">
    {#each BALANCE.DOME_ROOMS as room}
      {@const unlocked = isRoomUnlocked(room.id)}
      {@const active = currentRoom === room.id}
      {@const isNew = recentlyUnlockedSet.includes(room.id)}
      <button
        class="room-tab"
        class:room-tab-active={active}
        class:room-tab-locked={!unlocked}
        class:room-tab-new={isNew}
        type="button"
        onclick={() => handleRoomSelect(room.id)}
        disabled={!unlocked}
        aria-pressed={active}
        aria-label={unlocked ? room.name : room.name + ' — unlocks at ' + room.unlockDives + ' dives'}
        title={unlocked ? room.description : 'Unlocks after ' + room.unlockDives + ' dives (you have ' + totalDives + ')'}
      >
        <span class="room-tab-icon" aria-hidden="true">{unlocked ? room.icon : '⛔'}</span>
        <span class="room-tab-name">{room.name.split(' ')[0]}</span>
        {#if !unlocked}
          <span class="room-tab-unlock-hint">{room.unlockDives - totalDives} dives</span>
        {/if}
      </button>
    {/each}
  </nav>

  <!-- === SCROLLABLE ROOM CONTENT === -->
  <div class="room-content">

    {#if currentRoom === 'command'}
      <CommandRoom
        {onDive}
        {onReviewArtifact}
        {onStreakPanel}
        {onSettings}
        {gaiaVisible}
        {idleSpriteUrl}
        {idleExpressionId}
        {gaiaComment}
        gaiaNameLabel={GAIA_NAME}
        gaiaFullName={GAIA_FULL_NAME}
        gaiaTagline={GAIA_TAGLINE}
      />
    {:else if currentRoom === 'lab'}
      <LabRoom
        {onStudy}
        {onKnowledgeStore}
        {gaiaVisible}
        {idleSpriteUrl}
        {idleExpressionId}
        {gaiaComment}
        gaiaNameLabel={GAIA_NAME}
      />
    {:else if currentRoom === 'workshop'}
      <WorkshopRoom
        {onMaterializer}
        {onPremiumMaterializer}
      />
    {:else if currentRoom === 'museum'}
      <MuseumRoom
        {onFossils}
        {onZoo}
      />
    {:else if currentRoom === 'market'}
      <MarketRoom
        {onCosmetics}
        {onFarm}
      />
    {:else if currentRoom === 'archive'}
      <ArchiveRoom
        {onViewTree}
        {facts}
      />
    {/if}

  </div><!-- end .room-content -->

  <!-- === GAIA STUDY PROMPT (DD-V2-142) ===
       Soft nudge shown when 5+ facts are due for review. Warm, not urgent. -->
  {#if studyPromptVisible}
    <div class="study-prompt" role="status" aria-live="polite">
      <span class="study-prompt-avatar" aria-hidden="true">
        <img src={gaiaNeutralImg} alt="GAIA" class="study-prompt-avatar-img" />
      </span>
      <span class="study-prompt-text">
        Ready for a quick study? {studyPromptCount} facts are ready to strengthen!
      </span>
      <button
        class="study-prompt-cta"
        type="button"
        onclick={() => { studyPromptVisible = false; onStudy() }}
      >
        Study
      </button>
      <button
        class="study-prompt-dismiss"
        type="button"
        aria-label="Dismiss"
        onclick={() => { studyPromptVisible = false }}
      >
        ×
      </button>
    </div>
  {/if}
</section>

<style>
  .base-view {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 30;
    overflow: hidden;
    background: var(--color-bg);
    padding: 0;
    font-family: 'Courier New', monospace;
    display: flex;
    flex-direction: column;
  }

  /* ---- Room Tab Bar ---- */
  .room-tab-bar {
    display: flex;
    flex-direction: row;
    gap: 0;
    overflow-x: auto;
    background: color-mix(in srgb, var(--color-bg) 60%, #000 40%);
    border-bottom: 2px solid rgba(78, 204, 163, 0.2);
    padding: 6px 6px 0;
    flex-shrink: 0;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .room-tab-bar::-webkit-scrollbar {
    display: none;
  }

  .room-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 10px 6px;
    border: 0;
    border-bottom: 3px solid transparent;
    border-radius: 8px 8px 0 0;
    background: transparent;
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    min-width: 58px;
    position: relative;
  }

  .room-tab:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-text) 6%, transparent 94%);
    color: var(--color-text);
  }

  .room-tab:active:not(:disabled) {
    transform: translateY(1px);
  }

  .room-tab-active {
    color: #fbbf24;
    border-bottom-color: #fbbf24;
    background: color-mix(in srgb, #fbbf24 10%, transparent 90%);
  }

  .room-tab-locked {
    opacity: 0.45;
    cursor: not-allowed;
    background: rgba(0, 0, 0, 0.25);
    filter: grayscale(0.4);
  }

  @keyframes room-unlock-pulse {
    0% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
    50% { box-shadow: 0 0 0 6px rgba(255, 215, 0, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
  }

  .room-tab-new {
    animation: room-unlock-pulse 0.8s ease-out 3;
    color: #ffd700;
    border-bottom-color: #ffd700;
  }

  .room-tab-icon {
    font-size: 1.35rem;
    line-height: 1;
    transition: transform 0.15s ease;
  }

  .room-tab-active .room-tab-icon {
    transform: scale(1.1);
  }

  .room-tab-name {
    font-size: 0.75rem;
    letter-spacing: 0.01em;
    line-height: 1;
  }

  .room-tab-unlock-hint {
    font-size: 0.6rem;
    color: var(--color-text-dim);
    opacity: 0.75;
    line-height: 1;
    font-style: italic;
    letter-spacing: 0.02em;
  }

  /* ---- Scrollable room content ---- */
  .room-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0 0 8px;
    padding-bottom: env(safe-area-inset-bottom, 8px);
  }

  /* ---- Soft GAIA study prompt (DD-V2-142) ---- */
  .study-prompt {
    position: absolute;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
    left: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface) 82%);
    border: 1px solid color-mix(in srgb, var(--color-primary) 50%, transparent 50%);
    border-radius: 12px;
    font-family: inherit;
    font-size: 0.88rem;
    color: var(--color-text);
    z-index: 40;
    animation: study-prompt-slide-in 0.35s ease-out;
  }

  @keyframes study-prompt-slide-in {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .study-prompt-avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: color-mix(in srgb, var(--color-primary) 20%, var(--color-surface) 80%);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .study-prompt-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    image-rendering: pixelated;
  }

  .study-prompt-text {
    flex: 1;
    line-height: 1.35;
    color: var(--color-text);
  }

  .study-prompt-cta {
    flex-shrink: 0;
    padding: 6px 14px;
    border: 1px solid var(--color-primary);
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-primary) 30%, var(--color-surface) 70%);
    color: var(--color-text);
    font: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .study-prompt-cta:active {
    background: color-mix(in srgb, var(--color-primary) 50%, var(--color-surface) 50%);
  }

  .study-prompt-dismiss {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
    color: var(--color-text-dim);
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: 50%;
    transition: background 0.15s ease;
  }

  .study-prompt-dismiss:hover {
    background: color-mix(in srgb, var(--color-text) 10%, transparent 90%);
  }
</style>
