<script lang="ts">
  import { onMount } from 'svelte'
  import { tokenizeWithGloss, type JapaneseToken } from '../../services/japaneseTokenizer'

  interface Props {
    sentence: string
    /** Words to exclude from hover tooltip (e.g., the correct answer — don't give it away) */
    excludeWords?: string[]
  }

  let { sentence, excludeWords = [] }: Props = $props()

  let tokens = $state<JapaneseToken[]>([])
  let activeToken = $state<JapaneseToken | null>(null)
  let tooltipX = $state(0)
  let tooltipY = $state(0)

  onMount(async () => {
    // Strip the {___} blank and English translation before tokenizing.
    // Take only the first line (the Japanese sentence) and replace blanks with a placeholder
    // that kuromoji won't try to tokenize.
    const jpOnly = sentence.split('\n')[0].replace(/\{___\}/g, '___')
    tokens = await tokenizeWithGloss(jpOnly)
  })

  /** Whether a token should show a hover tooltip. */
  function isHoverable(token: JapaneseToken): boolean {
    if (!token.englishGloss) return false
    // Skip punctuation (記号 = symbol/punctuation in Japanese POS tagging)
    if (token.pos === '記号') return false
    // Skip whitespace tokens
    if (token.surface.trim() === '') return false
    // Skip placeholder for the blank
    if (token.surface === '___') return false
    // Don't reveal the correct answer
    if (excludeWords.some(w => w && (token.surface.includes(w) || token.basicForm.includes(w)))) return false
    return true
  }

  function showTooltip(token: JapaneseToken, event: MouseEvent | TouchEvent) {
    const target = event.target as HTMLElement
    const rect = target.getBoundingClientRect()
    tooltipX = rect.left + rect.width / 2
    tooltipY = rect.top - 4
    activeToken = token
  }

  function hideTooltip() {
    activeToken = null
  }
</script>

{#if tokens.length > 0}
  <span class="word-hover-container">
    {#each tokens as token}
      {#if token.surface === '___'}
        <span class="word-blank">___</span>
      {:else if isHoverable(token)}
        <span
          class="word-hoverable"
          role="button"
          tabindex="-1"
          onmouseenter={(e) => showTooltip(token, e)}
          onmouseleave={hideTooltip}
          ontouchstart={(e) => { e.preventDefault(); showTooltip(token, e) }}
          ontouchend={hideTooltip}
        >{token.surface}</span>
      {:else}
        <span class="word-plain">{token.surface}</span>
      {/if}
    {/each}
  </span>
{:else}
  <span>{sentence.split('\n')[0]}</span>
{/if}

{#if activeToken}
  <div
    class="word-tooltip"
    style="left: {tooltipX}px; top: {tooltipY}px;"
    role="tooltip"
  >
    <span class="word-tooltip-reading">{activeToken.reading}</span>
    <span class="word-tooltip-gloss">{activeToken.englishGloss}</span>
  </div>
{/if}

<style>
  .word-hover-container {
    display: inline;
  }

  .word-hoverable {
    cursor: help;
    border-bottom: calc(1px * var(--layout-scale, 1)) dotted rgba(78, 205, 196, 0.4);
    transition: border-color 150ms ease;
  }

  .word-hoverable:hover {
    border-bottom-color: #4ecdc4;
  }

  /* .word-plain — intentionally unstyled */

  .word-blank {
    /* visually matches the {___} quiz blank style */
    letter-spacing: calc(2px * var(--layout-scale, 1));
    color: #e0e0e0;
  }

  .word-tooltip {
    position: fixed;
    transform: translate(-50%, -100%);
    background: rgba(10, 8, 20, 0.95);
    border: 1px solid rgba(78, 205, 196, 0.3);
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    z-index: 1000;
    pointer-events: none;
    white-space: nowrap;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(2px * var(--layout-scale, 1));
  }

  .word-tooltip-reading {
    font-size: calc(10px * var(--text-scale, 1));
    color: #4ecdc4;
  }

  .word-tooltip-gloss {
    font-size: calc(11px * var(--text-scale, 1));
    color: #e0e0e0;
    font-weight: 600;
  }
</style>
