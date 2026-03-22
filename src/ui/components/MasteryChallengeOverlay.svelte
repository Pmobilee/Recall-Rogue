<script lang="ts">
  import type { MasteryChallengeQuestion } from '../../services/masteryChallengeService'
  import { playCardAudio } from '../../services/cardAudioManager'

  interface Props {
    challenge: MasteryChallengeQuestion | null
    onresolve: (passed: boolean) => void
  }

  let { challenge, onresolve }: Props = $props()

  let startedAt = $state(0)
  let elapsedMs = $state(0)
  let selectedAnswer = $state<string | null>(null)
  let resolved = $state(false)
  let rafId: number | null = null

  function resetState(): void {
    startedAt = Date.now()
    elapsedMs = 0
    selectedAnswer = null
    resolved = false
  }

  function cancelTick(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function tick(): void {
    if (!challenge || resolved) return
    elapsedMs = Date.now() - startedAt
    if (elapsedMs >= challenge.timerSeconds * 1000) {
      resolved = true
      onresolve(false)
      cancelTick()
      return
    }
    rafId = requestAnimationFrame(tick)
  }

  $effect(() => {
    if (!challenge) {
      cancelTick()
      return
    }
    resetState()
    playCardAudio('mastery-challenge')
    rafId = requestAnimationFrame(tick)
    return () => cancelTick()
  })

  let timerFraction = $derived.by(() => {
    if (!challenge) return 1
    const totalMs = challenge.timerSeconds * 1000
    return Math.max(0, 1 - (elapsedMs / totalMs))
  })

  let secondsLeft = $derived.by(() => {
    if (!challenge) return 0
    const totalMs = challenge.timerSeconds * 1000
    return Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000))
  })

  function handleSelect(answer: string): void {
    if (!challenge || resolved) return
    resolved = true
    selectedAnswer = answer
    const passed = answer === challenge.correctAnswer
    playCardAudio('quiz-answer-select')
    cancelTick()
    setTimeout(() => {
      onresolve(passed)
    }, 450)
  }

  function buttonClass(answer: string): string {
    if (!resolved || !challenge) return ''
    if (answer === challenge.correctAnswer) return 'correct'
    if (answer === selectedAnswer) return 'wrong'
    return ''
  }
</script>

{#if challenge}
  <div class="mastery-challenge-overlay" role="dialog" aria-modal="true" aria-label="Mastery challenge">
    <div class="panel">
      <div class="header-row">
        <h2>Mastery Challenge</h2>
        <span class="timer">{secondsLeft}s</span>
      </div>
      <div class="timer-bar">
        <div class="timer-fill" style={`--fraction: ${timerFraction};`}></div>
      </div>

      <p class="sub">Relic check for: {challenge.factStatement}</p>
      <p class="question" data-testid="mastery-question">{challenge.question}</p>

      <div class="answers">
        {#each challenge.answers as answer, i}
          <button
            type="button"
            class={`answer ${buttonClass(answer)}`}
            onclick={() => handleSelect(answer)}
            disabled={resolved}
            data-testid="mastery-answer-{i}"
          >
            {answer}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .mastery-challenge-overlay {
    position: fixed;
    inset: 0;
    z-index: 260;
    background: rgba(6, 10, 15, 0.94);
    display: grid;
    place-items: center;
    padding: 16px;
  }

  .panel {
    width: min(520px, 100%);
    border-radius: 14px;
    border: 1px solid rgba(203, 213, 225, 0.4);
    background:
      radial-gradient(circle at top right, rgba(168, 85, 247, 0.16), transparent 40%),
      radial-gradient(circle at top left, rgba(250, 204, 21, 0.14), transparent 45%),
      rgba(15, 23, 42, 0.95);
    padding: 14px;
    display: grid;
    gap: 10px;
  }

  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-row h2 {
    margin: 0;
    font-size: calc(20px * var(--text-scale, 1));
    color: #fde68a;
  }

  .timer {
    min-width: 44px;
    text-align: center;
    border-radius: 999px;
    border: 1px solid rgba(251, 191, 36, 0.6);
    background: rgba(120, 53, 15, 0.35);
    color: #fef3c7;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 700;
    padding: 4px 10px;
  }

  .timer-bar {
    width: 100%;
    height: 10px;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(51, 65, 85, 0.85);
  }

  .timer-fill {
    height: 100%;
    transform-origin: left;
    transform: scaleX(var(--fraction));
    background: linear-gradient(90deg, #facc15 0%, #f97316 100%);
    transition: transform 80ms linear;
  }

  .sub {
    margin: 0;
    font-size: calc(11px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .question {
    margin: 0;
    font-size: calc(16px * var(--text-scale, 1));
    line-height: 1.4;
    color: #f8fafc;
  }

  .answers {
    display: grid;
    gap: 8px;
  }

  .answer {
    min-height: 48px;
    border-radius: 10px;
    border: 1px solid rgba(148, 163, 184, 0.45);
    background: rgba(15, 23, 42, 0.9);
    color: #e2e8f0;
    text-align: left;
    padding: 10px;
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
  }

  .answer.correct {
    border-color: rgba(74, 222, 128, 0.85);
    background: rgba(20, 83, 45, 0.78);
    color: #dcfce7;
  }

  .answer.wrong {
    border-color: rgba(248, 113, 113, 0.85);
    background: rgba(127, 29, 29, 0.72);
    color: #fee2e2;
  }
</style>
