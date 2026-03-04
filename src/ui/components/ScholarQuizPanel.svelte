<!-- Scholar Quiz Panel — pinned bottom panel for the Scholar role.
     The server pushes quiz questions via scholar:quiz_prompt WebSocket messages.
     The Scholar answers and sends dive:quiz_answer back. -->
<script lang="ts">
  import { coopQuizQueue, activeBuff } from '../stores/coopState'
  import { wsClient } from '../../services/wsClient'

  let queue = $derived($coopQuizQueue)
  let current = $derived(queue[0] ?? null)
  let buff = $derived($activeBuff)

  function isCorrect(choice: string): boolean {
    return choice === (current as { correctAnswer?: string } | null)?.correctAnswer
  }

  function answer(choice: string): void {
    if (!current) return
    wsClient.send('dive:quiz_answer', {
      factId: current.factId,
      correct: isCorrect(choice),
      buffType: current.buffType,
    })
    coopQuizQueue.update(q => q.slice(1))
  }
</script>

<div class="scholar-panel" aria-label="Scholar Quiz Panel" role="complementary">
  {#if buff}
    <div class="buff-active">
      Buff: <strong>{buff.label}</strong> — expires tick {buff.expiresAtTick}
    </div>
  {/if}

  {#if current}
    <p class="question">{current.question}</p>
    <div class="choices">
      {#each current.choices as choice}
        <button
          class="choice-btn"
          onclick={() => answer(choice)}
          aria-label={choice}
        >{choice}</button>
      {/each}
    </div>
  {:else}
    <p class="waiting">Waiting for knowledge gate...</p>
  {/if}
</div>

<style>
  .scholar-panel {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: rgba(22, 33, 62, 0.95); border-top: 2px solid #4ecca3;
    padding: 12px 16px; z-index: 100; pointer-events: auto;
  }
  .buff-active { font-size: 11px; color: #4ecca3; margin-bottom: 8px; }
  .question { font-size: 12px; color: #e0e0e0; margin: 0 0 10px; }
  .choices { display: flex; flex-wrap: wrap; gap: 6px; }
  .choice-btn {
    flex: 1 1 40%; padding: 8px; background: #0f3460;
    border: 1px solid #1a4a8a; border-radius: 4px; color: #e0e0e0;
    font-size: 11px; cursor: pointer; text-align: left;
  }
  .choice-btn:hover { background: #1a4a8a; }
  .waiting { color: #666; font-size: 11px; margin: 0; }
</style>
