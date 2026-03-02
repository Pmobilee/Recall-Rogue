<script lang="ts">
  import { untrack } from 'svelte'
  import { playerSave } from '../stores/playerData'
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
        <span class="room-tab-icon" aria-hidden="true">{unlocked ? room.icon : '🔒'}</span>
        <span class="room-tab-name">{room.name.split(' ')[0]}</span>
        {#if !unlocked}
          <span class="room-tab-unlock-hint">{room.unlockDives - totalDives}d</span>
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
    border-bottom: 2px solid transparent;
    border-radius: 8px 8px 0 0;
    background: transparent;
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    min-width: 58px;
    position: relative;
  }

  .room-tab:active:not(:disabled) {
    transform: translateY(1px);
  }

  .room-tab-active {
    color: #4ecca3;
    border-bottom-color: #4ecca3;
    background: color-mix(in srgb, #4ecca3 10%, transparent 90%);
  }

  .room-tab-locked {
    opacity: 0.4;
    cursor: not-allowed;
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
    font-size: 1.2rem;
    line-height: 1;
  }

  .room-tab-name {
    font-size: 0.62rem;
    letter-spacing: 0.01em;
    line-height: 1;
  }

  .room-tab-unlock-hint {
    font-size: 0.55rem;
    color: var(--color-text-dim);
    opacity: 0.8;
    line-height: 1;
  }

  /* ---- Scrollable room content ---- */
  .room-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0 0 8px;
  }
</style>
