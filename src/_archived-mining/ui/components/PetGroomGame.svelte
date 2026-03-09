<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { addDustCatHappiness, persistPlayer, playerSave } from '../stores/playerData'

  const dispatch = createEventDispatcher<{ complete: { cleared: number; happinessGained: number } }>()

  const GAME_DURATION_MS = 25_000
  const HAPPINESS_PER_CLUMP = 4
  const BONUS_HAPPINESS = 8
  const MIN_CLUMPS = 6
  const MAX_CLUMPS = 10

  interface DustClump {
    id: number
    x: number    // % from left
    y: number    // % from top
    size: number // px
    alive: boolean
    poofing: boolean
  }

  let clumps: DustClump[] = []
  let cleared = 0
  let totalClumps = 0
  let gameActive = false
  let endTimer: ReturnType<typeof setTimeout> | null = null
  let showResult = false
  let happinessGained = 0
  let allClearedBonus = false

  function startGame(): void {
    const count = MIN_CLUMPS + Math.floor(Math.random() * (MAX_CLUMPS - MIN_CLUMPS + 1))
    totalClumps = count
    clumps = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 15 + Math.random() * 70,   // 15% to 85%
      y: 20 + Math.random() * 50,   // 20% to 70%
      size: 40 + Math.floor(Math.random() * 21), // 40-60px
      alive: true,
      poofing: false,
    }))
    cleared = 0
    gameActive = true

    endTimer = setTimeout(() => {
      endGame()
    }, GAME_DURATION_MS)
  }

  function removeClump(id: number): void {
    if (!gameActive) return
    // Trigger poof animation first
    clumps = clumps.map(c => c.id === id ? { ...c, poofing: true } : c)
    setTimeout(() => {
      clumps = clumps.map(c => c.id === id ? { ...c, alive: false, poofing: false } : c)
      cleared++
      if (clumps.every(c => !c.alive)) {
        endGame(true)
      }
    }, 300)
  }

  function endGame(allCleared = false): void {
    if (!gameActive) return
    gameActive = false
    if (endTimer) {
      clearTimeout(endTimer)
      endTimer = null
    }
    allClearedBonus = allCleared
    happinessGained = cleared * HAPPINESS_PER_CLUMP + (allCleared ? BONUS_HAPPINESS : 0)
    addDustCatHappiness(happinessGained)
    persistPlayer()
    playerSave.update(s => {
      if (!s) return s
      return { ...s, dustCatLastGroomed: Date.now() }
    })
    showResult = true
    setTimeout(() => {
      dispatch('complete', { cleared, happinessGained })
    }, 1800)
  }

  onMount(startGame)
  onDestroy(() => {
    if (endTimer) clearTimeout(endTimer)
  })
</script>

<div class="pet-groom-game">
  <div class="game-header">
    <span class="game-title">Groom the Dust Cat!</span>
    <span class="cleared-counter">Cleared: {cleared}/{totalClumps}</span>
  </div>

  {#if !showResult}
    <div class="game-area">
      <!-- Dust Cat in center -->
      <div class="dust-cat-body">
        <div class="cat-emoji">🐱</div>
        <div class="cat-label">Tap the dust clumps!</div>
      </div>

      <!-- Dust clumps scattered over the cat area -->
      {#each clumps as clump (clump.id)}
        {#if clump.alive}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_interactive_supports_focus -->
          <div
            class="dust-clump"
            class:poofing={clump.poofing}
            style="
              left: {clump.x}%;
              top: {clump.y}%;
              width: {clump.size}px;
              height: {clump.size}px;
            "
            role="button"
            on:click={() => removeClump(clump.id)}
          >
            <div class="clump-inner">🌫️</div>
          </div>
        {/if}
      {/each}
    </div>
  {:else}
    <div class="result-screen">
      <div class="result-title">{allClearedBonus ? 'Perfect!' : 'Well done!'}</div>
      {#if allClearedBonus}
        <div class="bonus-text">All clumps cleared! Bonus reward!</div>
      {/if}
      <div class="result-stats">Cleared: {cleared}/{totalClumps} clumps</div>
      <div class="result-happiness">+{happinessGained} happiness</div>
    </div>
  {/if}
</div>

<style>
  .pet-groom-game {
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

  .cleared-counter {
    font-size: 14px;
    color: #FFD700;
  }

  .game-area {
    position: relative;
    flex: 1;
    overflow: hidden;
  }

  .dust-cat-body {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
  }

  .cat-emoji {
    font-size: 80px;
    line-height: 1;
  }

  .cat-label {
    font-size: 13px;
    color: rgba(255,255,255,0.6);
    margin-top: 8px;
  }

  .dust-clump {
    position: absolute;
    cursor: pointer;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease;
    user-select: none;
    touch-action: manipulation;
  }

  .dust-clump:hover {
    transform: translate(-50%, -50%) scale(1.15);
  }

  .dust-clump.poofing {
    animation: poof 0.3s ease forwards;
  }

  @keyframes poof {
    0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    50% { transform: translate(-50%, -50%) scale(1.6); opacity: 0.7; }
    100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
  }

  .clump-inner {
    font-size: 24px;
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

  .bonus-text {
    font-size: 16px;
    color: #FF9800;
    font-style: italic;
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
