<!-- src/ui/components/CombatOverlay.svelte -->
<script lang="ts">
  import { combatState } from '../../ui/stores/combatState'
  import { encounterManager } from '../../game/managers/EncounterManager'
  import { audioManager } from '../../services/audioService'
  import type { Boss } from '../../game/entities/Boss'

  const state = $derived($combatState)
  const isBoss = $derived(state.encounterType === 'boss')
  const playerHpPct  = $derived(state.playerMaxHp > 0 ? (state.playerHp  / state.playerMaxHp)  * 100 : 0)
  const creatureHpPct = $derived(state.creatureMaxHp > 0 ? (state.creatureHp / state.creatureMaxHp) * 100 : 0)
  const bossTitle = $derived(isBoss ? (state.creature as Boss)?.title ?? null : null)

  function onAttack() {
    audioManager.playSound('button_click')
    encounterManager.startQuizAttack()
  }
  function onDefend() {
    audioManager.playSound('button_click')
    encounterManager.defend()
  }
  function onFlee() {
    audioManager.playSound('button_click')
    encounterManager.attemptFlee()
  }
</script>

{#if state.active}
<div class="combat-overlay" role="dialog" aria-label="Combat encounter">
  <div class="header">
    {#if bossTitle}<div class="boss-title">{bossTitle}</div>{/if}
    <div class="creature-name">{state.creature?.name ?? '???'}</div>
  </div>

  <div class="hp-row">
    <span class="label">Enemy</span>
    <div class="bar-track">
      <div class="bar-fill enemy" style="width:{creatureHpPct}%"></div>
    </div>
    <span class="hp-num">{state.creatureHp}/{state.creatureMaxHp}</span>
  </div>

  <div class="hp-row">
    <span class="label">You</span>
    <div class="bar-track">
      <div class="bar-fill player" style="width:{playerHpPct}%"></div>
    </div>
    <span class="hp-num">{state.playerHp}/{state.playerMaxHp}</span>
  </div>

  <div class="log" aria-live="polite">
    {#each state.log.slice(-4) as line}
      <div class="log-line">{line}</div>
    {/each}
  </div>

  {#if state.result === 'victory'}
    <div class="result victory">Victory!</div>
  {:else if state.result === 'defeat'}
    <div class="result defeat">Defeated!</div>
  {:else if state.result === 'fled'}
    <div class="result fled">Escaped!</div>
  {:else if state.awaitingQuiz}
    <div class="awaiting">Preparing question...</div>
  {:else}
    <div class="actions">
      <button class="btn attack" onclick={onAttack} aria-label="Attack with quiz">
        Attack (Quiz)
      </button>
      <button class="btn defend" onclick={onDefend} aria-label="Defend">Defend</button>
      <button class="btn flee"   onclick={onFlee}   aria-label="Attempt to flee">Flee</button>
    </div>
  {/if}
</div>
{/if}

<style>
  .combat-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.9);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    z-index: 800; gap: 10px; color: #eee; padding: 20px;
    pointer-events: auto;
  }
  .boss-title   { font-size: 0.72rem; color: #ffd369; letter-spacing: 0.2em; text-transform: uppercase; }
  .creature-name { font-size: 1.6rem; font-weight: bold; color: #e94560; }
  .hp-row       { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 320px; }
  .label        { font-size: 0.73rem; width: 40px; text-align: right; color: #aaa; }
  .bar-track    { flex: 1; height: 12px; background: #333; border-radius: 6px; overflow: hidden; }
  .bar-fill     { height: 100%; border-radius: 6px; transition: width 0.3s ease; }
  .bar-fill.enemy  { background: linear-gradient(90deg, #e94560, #ff7043); }
  .bar-fill.player { background: linear-gradient(90deg, #4ecca3, #00bcd4); }
  .hp-num       { font-size: 0.68rem; color: #888; width: 62px; }
  .log {
    width: 100%; max-width: 320px;
    background: rgba(255,255,255,0.05); border-radius: 6px;
    padding: 8px 10px; min-height: 68px;
    font-size: 0.76rem; color: #ccc; line-height: 1.55;
  }
  .log-line { margin-bottom: 2px; }
  .actions  { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .btn { border: none; border-radius: 8px; padding: 10px 18px; font-size: 0.95rem; cursor: pointer; }
  .btn.attack  { background: #e94560; color: #fff; }
  .btn.defend  { background: #4a4a6a; color: #eee; }
  .btn.flee    { background: #2a2a3a; color: #bbb; font-size: 0.85rem; }
  .awaiting    { color: #aaa; font-style: italic; font-size: 0.9rem; }
  .result      { font-size: 1.2rem; font-weight: bold; margin-top: 8px; }
  .result.victory { color: #4ecca3; }
  .result.defeat  { color: #e94560; }
  .result.fled    { color: #ffd369; }
</style>
