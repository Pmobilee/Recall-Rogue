<script lang="ts">
  import { onMount } from 'svelte'
  import { checkTypedAnswer, type TypedAnswerResult } from '../../services/typedAnswerChecker'

  interface Props {
    correctAnswer: string
    /** Additional acceptable answers (transliteration variants, etc.) */
    acceptableAlternatives?: string[]
    language: string
    onsubmit: (isCorrect: boolean, typed: string) => void
  }

  let { correctAnswer, acceptableAlternatives = [], language, onsubmit }: Props = $props()

  let inputEl: HTMLInputElement | undefined = $state()
  let typedValue = $state('')
  let submitted = $state(false)
  let isCorrect = $state(false)
  let isCloseMatch = $state(false)
  let isSynonymMatch = $state(false)

  onMount(() => {
    if (inputEl) {
      inputEl.focus()
    }
  })

  function handleSubmit() {
    if (submitted || !typedValue.trim()) return
    submitted = true

    const result: TypedAnswerResult = checkTypedAnswer(typedValue, correctAnswer, acceptableAlternatives, language)
    isCorrect = result.correct
    isCloseMatch = result.closeMatch
    isSynonymMatch = result.synonymMatch
    onsubmit(result.correct, typedValue)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }
</script>

<div class="grammar-typing">
  <div class="typing-input-row">
    <input
      bind:this={inputEl}
      bind:value={typedValue}
      class="typing-input"
      class:correct={submitted && isCorrect}
      class:close-match={submitted && !isCorrect && isCloseMatch}
      class:wrong={submitted && !isCorrect && !isCloseMatch}
      type="text"
      placeholder="Type the English meaning..."
      disabled={submitted}
      onkeydown={handleKeydown}
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
    />
    {#if !submitted}
      <button class="typing-submit-btn" onclick={handleSubmit} disabled={!typedValue.trim()}>
        ✓
      </button>
    {/if}
  </div>

  {#if submitted && isCorrect && isSynonymMatch}
    <div class="typing-synonym-accepted">
      Synonym accepted! Answer was: <strong>{correctAnswer}</strong>
    </div>
  {:else if submitted && !isCorrect && isCloseMatch}
    <div class="typing-close-match">
      Almost! Correct answer: <strong>{correctAnswer}</strong>
    </div>
  {:else if submitted && !isCorrect}
    <div class="typing-correct-answer">
      Correct: <strong>{correctAnswer}</strong>
    </div>
  {/if}
</div>

<style>
  .grammar-typing {
    width: 100%;
    padding: calc(8px * var(--layout-scale, 1)) 0;
  }

  .typing-input-row {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
    align-items: center;
  }

  .typing-input {
    flex: 1;
    padding: calc(14px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    font-size: calc(22px * var(--text-scale, 1));
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #ffffff;
    outline: none;
    transition: border-color 200ms ease;
    font-family: inherit;
  }

  .typing-input:focus {
    border-color: #4ecdc4;
  }

  .typing-input.correct {
    border-color: #4ecdc4;
    background: rgba(78, 205, 196, 0.1);
  }

  .typing-input.close-match {
    border-color: #f0ad4e;
    background: rgba(240, 173, 78, 0.1);
  }

  .typing-input.wrong {
    border-color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
  }

  .typing-submit-btn {
    padding: calc(14px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    font-size: calc(22px * var(--text-scale, 1));
    background: #4ecdc4;
    border: none;
    border-radius: calc(8px * var(--layout-scale, 1));
    color: #0a0814;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 200ms ease;
  }

  .typing-submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .typing-correct-answer {
    margin-top: calc(8px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    color: #ff6b6b;
  }

  .typing-correct-answer strong {
    color: #4ecdc4;
  }

  .typing-close-match {
    margin-top: calc(8px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    color: #f0ad4e;
  }

  .typing-close-match strong {
    color: #4ecdc4;
  }

  .typing-synonym-accepted {
    margin-top: calc(8px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
    color: rgba(78, 205, 196, 0.8);
  }

  .typing-synonym-accepted strong {
    color: #4ecdc4;
  }
</style>
