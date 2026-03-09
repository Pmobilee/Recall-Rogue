<script lang="ts">
  import type { HubFloor } from '../../data/hubLayout'
  import { currentScreen } from '../stores/gameState'

  interface Props {
    floors: HubFloor[]
    unlockedIds: string[]
    currentIndex: number
    onFloorSelect: (index: number) => void
  }

  const { floors, unlockedIds, currentIndex, onFloorSelect }: Props = $props()

  /** Only show floor dots when on the base/dome screen. */
  const visible = $derived($currentScreen === 'base')
</script>

{#if visible}
<nav class="floor-indicator" aria-label="Hub floor navigation">
  <span class="floor-label">{floors[currentIndex]?.name ?? ''}</span>
  <div class="pips">
    {#each floors as floor, i}
      {@const isUnlocked = unlockedIds.includes(floor.id)}
      {@const isCurrent = i === currentIndex}
      <button
        class="pip"
        class:current={isCurrent}
        class:locked={!isUnlocked}
        disabled={!isUnlocked}
        title={isUnlocked ? floor.name : `${floor.name} (locked)`}
        onclick={() => isUnlocked && onFloorSelect(i)}
        aria-label={`Floor ${i}: ${floor.name}`}
        aria-current={isCurrent ? 'true' : undefined}
      >
        <span class="pip-dot"></span>
      </button>
    {/each}
  </div>
</nav>
{/if}

<style>
  .floor-indicator {
    position: fixed;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    z-index: 50;
    pointer-events: auto;
  }
  .floor-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #4ecca3;
    text-align: center;
    white-space: nowrap;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }
  .pips {
    display: flex;
    flex-direction: column-reverse;
    gap: 2px;
    align-items: center;
  }
  .pip {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .pip:disabled { cursor: default; }
  .pip-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ccc;
    transition: background 200ms;
  }
  .pip.current .pip-dot { background: #4ecca3; box-shadow: 0 0 6px #4ecca3; }
  .pip.locked .pip-dot { background: #444; }
</style>
