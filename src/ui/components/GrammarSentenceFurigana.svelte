<script lang="ts">
  /**
   * GrammarSentenceFurigana — renders a Japanese grammar sentence segment
   * with furigana ruby annotations, hover tooltips, and kana-only mode support.
   *
   * Used in grammar fill-in-the-blank questions to show furigana above kanji
   * while preserving the WordHover tooltip experience.
   *
   * Props follow the same pattern as WordHover.svelte.
   */

  import { onMount } from 'svelte'
  import { tokenizeWithGloss, type JapaneseToken } from '../../services/japaneseTokenizer'
  import { deckOptions } from '../../services/deckOptionsService'

  interface Props {
    /** One segment of the grammar question (between {___} blanks, or after the last blank) */
    sentence: string
    /** Words to exclude from hover tooltip (e.g., the correct answer — don't give it away) */
    excludeWords?: string[]
  }

  let { sentence, excludeWords = [] }: Props = $props()

  let tokens = $state<JapaneseToken[]>([])
  let activeToken = $state<JapaneseToken | null>(null)
  let tooltipX = $state(0)
  let tooltipY = $state(0)

  /** Reactively read furigana/kanaOnly/romaji from deckOptions store */
  let showFurigana = $derived.by(() => ($deckOptions as any)?.ja?.furigana ?? true)
  let showKanaOnly = $derived.by(() => ($deckOptions as any)?.ja?.kanaOnly ?? false)

  onMount(async () => {
    // Strip {___} blank and English translation before tokenizing.
    // Take only the first line (the Japanese sentence) and replace blanks with a
    // placeholder that kuromoji won't try to tokenize as Japanese.
    const jpOnly = sentence.split('\n')[0].replace(/\{___\}/g, '___')
    tokens = await tokenizeWithGloss(jpOnly)
  })

  /**
   * Whether a token contains non-kana characters that would benefit from furigana.
   * Checks for kanji (CJK Unified Ideographs range).
   */
  function hasKanji(surface: string): boolean {
    return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(surface)
  }

  /**
   * Whether the token's reading differs meaningfully from its surface form.
   * Returns true when furigana would add value (i.e., the surface has kanji).
   */
  function needsFurigana(token: JapaneseToken): boolean {
    return hasKanji(token.surface) && token.reading !== token.surface
  }

  /** Whether a token should show a hover tooltip. */
  function isHoverable(token: JapaneseToken): boolean {
    if (!token.englishGloss) return false
    // Skip punctuation (記号 = symbol/punctuation in Japanese POS tagging)
    if (token.pos === '記号') return false
    // Skip whitespace tokens
    if (token.surface.trim() === '') return false
    // Skip the blank placeholder
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

  /**
   * Derive the display surface for a token, respecting kana-only mode.
   * When kanaOnly is on and the token has a reading, show the reading (hiragana) instead.
   */
  function displaySurface(token: JapaneseToken): string {
    if (showKanaOnly && hasKanji(token.surface) && token.reading) {
      return token.reading
    }
    return token.surface
  }
</script>

{#if tokens.length > 0}
  <span class="grammar-furigana-container">
    {#each tokens as token}
      {#if token.surface === '___'}
        <span class="grammar-blank">______</span>
      {:else if isHoverable(token)}
        {#if showFurigana && !showKanaOnly && needsFurigana(token)}
          <span
            class="word-hoverable"
            role="button"
            tabindex="-1"
            onmouseenter={(e) => showTooltip(token, e)}
            onmouseleave={hideTooltip}
            ontouchstart={(e) => { e.preventDefault(); showTooltip(token, e) }}
            ontouchend={hideTooltip}
          ><ruby>{token.surface}<rp>(</rp><rt>{token.reading}</rt><rp>)</rp></ruby></span>
        {:else}
          <span
            class="word-hoverable"
            role="button"
            tabindex="-1"
            onmouseenter={(e) => showTooltip(token, e)}
            onmouseleave={hideTooltip}
            ontouchstart={(e) => { e.preventDefault(); showTooltip(token, e) }}
            ontouchend={hideTooltip}
          >{displaySurface(token)}</span>
        {/if}
      {:else if token.surface !== '___'}
        {#if showFurigana && !showKanaOnly && needsFurigana(token)}
          <ruby class="word-plain">{token.surface}<rp>(</rp><rt>{token.reading}</rt><rp>)</rp></ruby>
        {:else}
          <span class="word-plain">{displaySurface(token)}</span>
        {/if}
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
  .grammar-furigana-container {
    display: inline;
  }

  /* Furigana ruby annotations */
  ruby {
    ruby-position: over;
  }

  rt {
    font-size: 0.65em;
    color: rgba(255, 255, 255, 0.75);
    font-weight: 500;
    padding-bottom: 0.1em;
  }

  /* Hoverable tokens (words with English gloss) */
  .word-hoverable {
    cursor: help;
    border-bottom: calc(1px * var(--layout-scale, 1)) dotted rgba(78, 205, 196, 0.4);
    transition: border-color 150ms ease;
  }

  .word-hoverable:hover {
    border-bottom-color: #4ecdc4;
  }

  /* .word-plain — intentionally unstyled */

  /* Grammar blank placeholder — visually matches the {___} quiz blank style */
  .grammar-blank {
    letter-spacing: calc(2px * var(--layout-scale, 1));
    color: #e0e0e0;
  }

  /* Hover tooltip */
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
