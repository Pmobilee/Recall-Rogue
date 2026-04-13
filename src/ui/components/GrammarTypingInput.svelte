<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import * as wanakana from 'wanakana'

  interface Props {
    correctAnswer: string
    /** Additional acceptable answers (politeness variants, etc.) */
    acceptableAlternatives?: string[]
    onsubmit: (isCorrect: boolean, typed: string) => void
  }

  let { correctAnswer, acceptableAlternatives = [], onsubmit }: Props = $props()

  let inputEl: HTMLInputElement | undefined = $state()
  let typedValue = $state('')
  let submitted = $state(false)
  let isCorrect = $state(false)

  onMount(() => {
    if (inputEl) {
      wanakana.bind(inputEl, { IMEMode: true })
      inputEl.focus()
    }
  })

  onDestroy(() => {
    if (inputEl) {
      wanakana.unbind(inputEl)
    }
  })

  function handleSubmit() {
    if (submitted || !typedValue.trim()) return
    submitted = true

    // Normalize: convert to hiragana for comparison, strip whitespace
    const normalized = wanakana.toHiragana(typedValue.trim().toLowerCase())
    const correctNorm = wanakana.toHiragana(correctAnswer.trim())

    // Check exact match
    if (normalized === correctNorm) {
      isCorrect = true
      onsubmit(true, typedValue)
      return
    }

    // Check acceptable alternatives
    for (const alt of acceptableAlternatives) {
      const altNorm = wanakana.toHiragana(alt.trim())
      if (normalized === altNorm) {
        isCorrect = true
        onsubmit(true, typedValue)
        return
      }
    }

    // Politeness tolerance: check if answer differs only in ます/ません form
    const politeVariants = generatePoliteVariants(correctNorm)
    if (politeVariants.includes(normalized)) {
      isCorrect = true
      onsubmit(true, typedValue)
      return
    }

    isCorrect = false
    onsubmit(false, typedValue)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  /** Generate common politeness variants of a grammar form */
  function generatePoliteVariants(base: string): string[] {
    const variants: string[] = []
    // Casual → polite
    if (base.endsWith('る')) variants.push(base.slice(0, -1) + 'ます')
    if (base.endsWith('う')) variants.push(base.slice(0, -1) + 'います')
    if (base.endsWith('ない')) variants.push(base.slice(0, -2) + 'ません')
    if (base.endsWith('た')) variants.push(base.slice(0, -1) + 'ました')
    // Polite → casual
    if (base.endsWith('ます')) variants.push(base.slice(0, -2) + 'る')
    if (base.endsWith('ません')) variants.push(base.slice(0, -3) + 'ない')
    if (base.endsWith('ました')) variants.push(base.slice(0, -3) + 'た')
    return variants
  }
</script>

<div class="grammar-typing">
  <div class="typing-input-row">
    <input
      bind:this={inputEl}
      bind:value={typedValue}
      class="typing-input"
      class:correct={submitted && isCorrect}
      class:wrong={submitted && !isCorrect}
      type="text"
      placeholder="Type your answer..."
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

  {#if submitted && !isCorrect}
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
    text-align: center;
  }

  .typing-input:focus {
    border-color: #4ecdc4;
  }

  .typing-input.correct {
    border-color: #4ecdc4;
    background: rgba(78, 205, 196, 0.1);
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
</style>
