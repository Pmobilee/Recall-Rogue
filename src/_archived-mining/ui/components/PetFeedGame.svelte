<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import { playerSave, addDustCatHappiness, persistPlayer } from '../stores/playerData'

  const dispatch = createEventDispatcher<{ complete: { caught: number; happinessGained: number } }>()

  const GAME_DURATION_MS = 20_000
  const ITEMS_COUNT = 8
  const HAPPINESS_PER_ITEM = 3
  const MINERALS = ['dust', 'shard', 'crystal']

  let caught = 0
  let items: Array<{ id: number; x: number; mineral: string; alive: boolean }> = []
  let gameActive = false
  let endTimer: ReturnType<typeof setTimeout> | null = null
  let showResult = false
  let happinessGained = 0
  let catWiggle = false

  /** Check if the energetic trait is active for the player */
  function getItemCount(): number {
    const save = get(playerSave)
    if (save?.dustCatTraits?.includes('energetic')) return 9
    return ITEMS_COUNT
  }

  function startGame(): void {
    const count = getItemCount()
    items = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 80 + 5, // 5% to 85% of screen width
      mineral: MINERALS[Math.floor(Math.random() * MINERALS.length)],
      alive: true,
    }))
    caught = 0
    gameActive = true

    endTimer = setTimeout(() => {
      endGame()
    }, GAME_DURATION_MS)
  }

  function catchItem(id: number): void {
    if (!gameActive) return
    items = items.map(item => item.id === id ? { ...item, alive: false } : item)
    caught++
    // Trigger cat wiggle animation
    catWiggle = true
    setTimeout(() => { catWiggle = false }, 400)
    // Check if all items caught
    if (items.every(item => !item.alive)) {
      endGame()
    }
  }

  function endGame(): void {
    if (!gameActive) return
    gameActive = false
    if (endTimer) {
      clearTimeout(endTimer)
      endTimer = null
    }
    happinessGained = caught * HAPPINESS_PER_ITEM
    addDustCatHappiness(happinessGained)
    persistPlayer()
    playerSave.update(s => {
      if (!s) return s
      return { ...s, dustCatLastFed: Date.now() }
    })
    showResult = true
    setTimeout(() => {
      dispatch('complete', { caught, happinessGained })
    }, 1500)
  }

  onMount(startGame)
  onDestroy(() => {
    if (endTimer) clearTimeout(endTimer)
  })
</script>

<div class="pet-feed-game">
  <div class="game-header">
    <span class="game-title">Feed the Dust Cat!</span>
    <span class="caught-counter">Caught: {caught}</span>
  </div>

  {#if !showResult}
    <div class="game-area">
      <!-- Dust Cat at center-bottom -->
      <div class="dust-cat" class:wiggle={catWiggle}>
        <div class="cat-placeholder">🐱</div>
      </div>

      <!-- Falling food items -->
      {#each items as item (item.id)}
        {#if item.alive}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_interactive_supports_focus -->
          <div
            class="food-item"
            style="left: {item.x}%; animation-duration: {1.8 + Math.random() * 0.6}s;"
            role="button"
            on:click={() => catchItem(item.id)}
          >
            {#if item.mineral === 'dust'}💨
            {:else if item.mineral === 'shard'}💎
            {:else}🔮{/if}
          </div>
        {/if}
      {/each}
    </div>
  {:else}
    <div class="result-screen">
      <div class="result-title">Well done!</div>
      <div class="result-stats">Caught: {caught} items</div>
      <div class="result-happiness">+{happinessGained} happiness</div>
    </div>
  {/if}
</div>

<style>
  .pet-feed-game {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 300;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    color: #fff;
  }

  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: rgba(255, 255, 255, 0.1);
    font-size: 16px;
  }

  .game-title {
    font-weight: bold;
    font-size: 18px;
  }

  .caught-counter {
    font-size: 14px;
    color: #FFD700;
  }

  .game-area {
    position: relative;
    flex: 1;
    overflow: hidden;
  }

  .dust-cat {
    position: absolute;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 48px;
    transition: transform 0.1s ease;
  }

  .dust-cat.wiggle {
    animation: wiggle 0.4s ease;
  }

  @keyframes wiggle {
    0%, 100% { transform: translateX(-50%) rotate(0deg); }
    25% { transform: translateX(-50%) rotate(-10deg); }
    75% { transform: translateX(-50%) rotate(10deg); }
  }

  .food-item {
    position: absolute;
    top: -60px;
    font-size: 32px;
    cursor: pointer;
    animation: fall linear forwards;
    user-select: none;
    touch-action: manipulation;
  }

  @keyframes fall {
    from { top: -60px; opacity: 1; }
    to { top: 110%; opacity: 0.6; }
  }

  .result-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }

  .result-title {
    font-size: 32px;
    font-weight: bold;
    color: #FFD700;
  }

  .result-stats {
    font-size: 18px;
    color: #ccc;
  }

  .result-happiness {
    font-size: 24px;
    color: #4CAF50;
    font-weight: bold;
  }
</style>
