<script lang="ts">
  export let playerHp: number = 100
  export let playerMaxHp: number = 100
  export let creatureHp: number = 100
  export let creatureMaxHp: number = 100
  export let creatureName: string = 'Creature'
  export let turn: number = 0
  export let log: string[] = []
  export let onAttack: (() => void) | undefined = undefined
  export let onDefend: (() => void) | undefined = undefined
  export let onFlee: (() => void) | undefined = undefined
  export let onQuizAttack: (() => void) | undefined = undefined
  export let combatOver: boolean = false
  export let victory: boolean = false

  $: playerHpPct = Math.max(0, (playerHp / playerMaxHp) * 100)
  $: creatureHpPct = Math.max(0, (creatureHp / creatureMaxHp) * 100)
  $: lastLog = log.length > 0 ? log[log.length - 1] : ''
</script>

<div class="combat-hud" aria-label="Combat">
  <!-- Creature HP -->
  <div class="hp-section creature-hp">
    <span class="hp-label">{creatureName}</span>
    <div class="hp-bar">
      <div class="hp-fill creature" style="width: {creatureHpPct}%"></div>
    </div>
    <span class="hp-text">{creatureHp}/{creatureMaxHp}</span>
  </div>

  <!-- Combat log -->
  <div class="combat-log">
    <p class="log-text">{lastLog}</p>
    <span class="turn-counter">Turn {turn}</span>
  </div>

  <!-- Player HP -->
  <div class="hp-section player-hp">
    <span class="hp-label">You</span>
    <div class="hp-bar">
      <div class="hp-fill player" style="width: {playerHpPct}%"></div>
    </div>
    <span class="hp-text">{playerHp}/{playerMaxHp}</span>
  </div>

  <!-- Actions -->
  {#if !combatOver}
    <div class="combat-actions">
      <button class="action-btn attack" on:click={onAttack}>Attack</button>
      <button class="action-btn quiz" on:click={onQuizAttack}>Quiz Attack</button>
      <button class="action-btn defend" on:click={onDefend}>Defend</button>
      <button class="action-btn flee" on:click={onFlee}>Flee</button>
    </div>
  {:else}
    <div class="combat-result" class:victory>
      <p class="result-text">{victory ? 'Victory!' : 'Defeated!'}</p>
    </div>
  {/if}
</div>

<style>
  .combat-hud {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: linear-gradient(to top, rgba(22, 33, 62, 0.95), rgba(22, 33, 62, 0.8));
    padding: 12px 16px 20px; z-index: 150; pointer-events: auto;
    border-top: 2px solid #0f3460;
  }
  .hp-section { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .hp-label { font-family: 'Press Start 2P', monospace; font-size: 9px; color: #ccc; width: 80px; text-align: right; }
  .hp-bar { flex: 1; height: 12px; background: #1a1a2e; border-radius: 6px; overflow: hidden; }
  .hp-fill { height: 100%; border-radius: 6px; transition: width 0.3s ease; }
  .hp-fill.creature { background: #e94560; }
  .hp-fill.player { background: #2ecc71; }
  .hp-text { font-size: 10px; color: #888; width: 60px; }
  .combat-log {
    display: flex; justify-content: space-between; align-items: center;
    background: #0f3460; border-radius: 6px; padding: 8px 12px; margin: 8px 0;
  }
  .log-text { color: #e0e0e0; font-size: 11px; margin: 0; flex: 1; }
  .turn-counter { font-family: 'Press Start 2P', monospace; font-size: 8px; color: #888; }
  .combat-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .action-btn {
    padding: 12px 8px; border: none; border-radius: 6px;
    font-family: 'Press Start 2P', monospace; font-size: 10px; cursor: pointer; color: white;
  }
  .action-btn.attack { background: #e94560; }
  .action-btn.quiz { background: #3498db; }
  .action-btn.defend { background: #f39c12; }
  .action-btn.flee { background: #666; }
  .combat-result { text-align: center; padding: 16px; }
  .result-text { font-family: 'Press Start 2P', monospace; font-size: 16px; color: #e94560; margin: 0; }
  .combat-result.victory .result-text { color: #2ecc71; }
</style>
