<script lang="ts">
  import { onMount } from 'svelte'
  import { isLandscape } from '../../stores/layoutStore'
  import type { ReviewState } from '../../data/types'
  import { factsDB } from '../../services/factsDB'
  import { challengeService, type ChallengeMode } from '../../services/challengeService'
  import { BALANCE } from '../../data/balance'
  import { shuffled } from '../../services/randomUtils'
  import SpeedRoundTimer from './SpeedRoundTimer.svelte'

  interface Props {
    mode: ChallengeMode
    reviewState: ReviewState
    onResult: (correct: boolean, prestigePointsAwarded: number) => void
    onClose: () => void
  }

  const { mode, reviewState, onResult, onClose }: Props = $props()

  const fact = $derived(factsDB.getById(reviewState.factId))

  let selectedAnswer = $state<string | null>(null)
  let revealed = $state(false)
  let timedOut = $state(false)
  let freeTextAnswer = $state('')

  // Build 4 shuffled choices for speed/reverse modes
  function buildChoices(): string[] {
    if (!fact) return []
    const allFacts = factsDB.getAll()
    if (mode === 'reverse') {
      // Show the answer; player picks the correct question stem
      const decoys = allFacts
        .filter(f => f.id !== fact.id && f.category.some(c => fact.category.includes(c)))
        .slice(0, 3)
        .map(f => f.quizQuestion)
      return shuffled([...decoys, fact.quizQuestion])
    }
    // speed mode: standard 4-option quiz
    const distractors = (fact.distractors ?? []).slice(0, 3)
    return shuffled([...distractors, fact.correctAnswer])
  }
  const choices = $derived(buildChoices())

  // reverse mode: question is the answer, player must pick the question stem
  const questionText = $derived(
    !fact ? '' : mode === 'reverse' ? fact.correctAnswer : fact.quizQuestion
  )

  function handleSelect(answer: string): void {
    if (revealed) return
    selectedAnswer = answer
    revealed = true
    checkAnswer(answer)
  }

  function handleFreeTextSubmit(): void {
    if (revealed) return
    revealed = true
    const answer = freeTextAnswer.toLowerCase().trim()
    const acceptable = [
      fact?.correctAnswer ?? '',
      ...(fact?.acceptableAnswers ?? []),
    ].map(a => a.toLowerCase().trim())
    checkAnswer(acceptable.includes(answer) ? (fact?.correctAnswer ?? '') : freeTextAnswer)
  }

  function handleTimeout(): void {
    if (revealed) return
    timedOut = true
    revealed = true
    const points = challengeService.onWrong(mode)
    void points
    onResult(false, 0)
  }

  function checkAnswer(answer: string): void {
    const correct = answer.toLowerCase().trim() === (fact?.correctAnswer ?? '').toLowerCase().trim()
      || (fact?.acceptableAnswers ?? []).some(a => a.toLowerCase().trim() === answer.toLowerCase().trim())

    let pts = 0
    if (correct) {
      pts = challengeService.onCorrect(mode)
    } else {
      challengeService.onWrong(mode)
    }
    setTimeout(() => {
      onResult(correct, pts)
    }, 1200)
  }

  function isCorrect(answer: string): boolean {
    if (!fact) return false
    return answer.toLowerCase().trim() === fact.correctAnswer.toLowerCase().trim()
      || (fact.acceptableAnswers ?? []).some(a => a.toLowerCase().trim() === answer.toLowerCase().trim())
  }
</script>

{#if fact}
  <!-- AR-76: landscape class applied to outer overlay, panel adapts -->
  <div class="challenge-overlay" class:challenge-overlay-landscape={$isLandscape} role="dialog" aria-modal="true">
    <div class="challenge-panel">
      <div class="mode-badge mode-{mode}">
        {mode === 'speed' ? 'SPEED ROUND' : mode === 'no_hint' ? 'NO HINT MODE' : 'REVERSE MODE'}
      </div>

      {#if mode === 'speed' && !revealed}
        <SpeedRoundTimer
          totalSeconds={BALANCE.CHALLENGE_SPEED_SECONDS}
          onTimeout={handleTimeout}
        />
      {/if}

      <div class="streak-display">
        Streak: <span class="streak-val">{challengeService.streak}</span>
      </div>

      <p class="question">{questionText}</p>

      {#if mode === 'no_hint'}
        <div class="free-text-area">
          <input
            type="text"
            class="free-text-input"
            placeholder="Type your answer..."
            bind:value={freeTextAnswer}
            disabled={revealed}
            onkeydown={(e) => { if (e.key === 'Enter') handleFreeTextSubmit() }}
          />
          {#if !revealed}
            <button type="button" class="submit-btn" onclick={handleFreeTextSubmit}>
              Submit
            </button>
          {:else}
            <p class="correct-answer">
              Correct answer: {fact.correctAnswer}
            </p>
          {/if}
        </div>
      {:else}
        <div class="choices">
          {#each choices as choice}
            <button
              type="button"
              class="choice-btn"
              class:selected={selectedAnswer === choice}
              class:correct={revealed && isCorrect(choice)}
              class:wrong={revealed && selectedAnswer === choice && !isCorrect(choice)}
              onclick={() => handleSelect(choice)}
              disabled={revealed}
            >
              {choice}
            </button>
          {/each}
        </div>
      {/if}

      {#if timedOut}
        <p class="timeout-msg">Time's up! Streak reset.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .challenge-overlay {
    position: fixed;
    inset: 0;
    z-index: 8500;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    pointer-events: all;
  }

  /* AR-76: In landscape, constrain the challenge overlay to center stage */
  .challenge-overlay-landscape {
    right: 30%;
    bottom: 26vh;
    background: rgba(0, 0, 0, 0.55);
  }

  .challenge-panel {
    background: #0e0e2a;
    border: 2px solid #ff8c00;
    border-radius: 8px;
    padding: 20px;
    max-width: 380px;
    width: 90%;
    font-family: 'Press Start 2P', monospace;
    color: #e0e0e0;
  }

  .mode-badge {
    text-align: center;
    font-size: 8px;
    padding: 4px 10px;
    border-radius: 4px;
    margin-bottom: 10px;
    letter-spacing: 0.05em;
  }

  .mode-speed { background: #ff4444; color: #fff; }
  .mode-no_hint { background: #5555cc; color: #fff; }
  .mode-reverse { background: #33aa66; color: #fff; }

  .streak-display {
    text-align: right;
    font-size: 8px;
    color: #888;
    margin-bottom: 8px;
  }

  .streak-val { color: #ffd700; }

  .question {
    font-size: 9px;
    line-height: 1.7;
    text-align: center;
    margin-bottom: 14px;
    color: #e0e0e0;
  }

  .choices {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .choice-btn {
    background: #1a1a3a;
    border: 1px solid #333;
    border-radius: 4px;
    color: #e0e0e0;
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    padding: 10px 12px;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s, border-color 0.1s;
    line-height: 1.5;
  }

  .choice-btn:hover:not(:disabled) {
    background: #2a2a4a;
    border-color: #555;
  }

  .choice-btn.correct {
    background: rgba(78, 204, 163, 0.2);
    border-color: #4ecca3;
    color: #4ecca3;
  }

  .choice-btn.wrong {
    background: rgba(255, 68, 68, 0.2);
    border-color: #ff4444;
    color: #ff4444;
  }

  .free-text-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .free-text-input {
    background: #1a1a3a;
    border: 1px solid #ff8c00;
    border-radius: 4px;
    color: #fff;
    font-family: sans-serif;
    font-size: 14px;
    padding: 10px;
    width: 100%;
    box-sizing: border-box;
  }

  .submit-btn {
    background: #ff8c00;
    border: none;
    border-radius: 4px;
    color: #0a0a1a;
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    padding: 10px;
    cursor: pointer;
  }

  .correct-answer {
    font-size: 9px;
    color: #4ecca3;
    text-align: center;
    line-height: 1.6;
  }

  .timeout-msg {
    text-align: center;
    color: #ff4444;
    font-size: 9px;
    margin-top: 8px;
  }
</style>
