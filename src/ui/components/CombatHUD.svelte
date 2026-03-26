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
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1)); z-index: 150; pointer-events: auto;
    border-top: 2px solid #0f3460;
  }
  .hp-section { display: flex; align-items: center; gap: calc(8px * var(--layout-scale, 1)); margin-bottom: calc(8px * var(--layout-scale, 1)); }
  .hp-label { font-family: var(--font-rpg); font-size: calc(9px * var(--text-scale, 1)); color: #ccc; width: calc(80px * var(--layout-scale, 1)); text-align: right; }
  .hp-bar { flex: 1; height: calc(12px * var(--layout-scale, 1)); background: #1a1a2e; border-radius: 6px; overflow: hidden; }
  .hp-fill { height: 100%; border-radius: 6px; transition: width 0.3s ease; }
  .hp-fill.creature { background: #e94560; }
  .hp-fill.player { background: #2ecc71; }
  .hp-text { font-size: calc(10px * var(--text-scale, 1)); color: #888; width: calc(60px * var(--layout-scale, 1)); }
  .combat-log {
    display: flex; justify-content: space-between; align-items: center;
    background: #0f3460; border-radius: 6px; padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)); margin: calc(8px * var(--layout-scale, 1)) 0;
  }
  .log-text { color: #e0e0e0; font-size: calc(11px * var(--text-scale, 1)); margin: 0; flex: 1; }
  .turn-counter { font-family: var(--font-rpg); font-size: calc(8px * var(--text-scale, 1)); color: #888; }
  .combat-actions { display: grid; grid-template-columns: 1fr 1fr; gap: calc(8px * var(--layout-scale, 1)); }
  .action-btn {
    padding: calc(12px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)); border: none; border-radius: 6px;
    font-family: var(--font-rpg); font-size: calc(10px * var(--text-scale, 1)); cursor: pointer; color: white;
  }
  .action-btn.attack { background: #e94560; }
  .action-btn.quiz { background: #3498db; }
  .action-btn.defend { background: #f39c12; }
  .action-btn.flee { background: #666; }
  .combat-result { text-align: center; padding: calc(16px * var(--layout-scale, 1)); }
  .result-text { font-family: var(--font-rpg); font-size: calc(16px * var(--text-scale, 1)); color: #e94560; margin: 0; }
  .combat-result.victory .result-text { color: #2ecc71; }
</style>
