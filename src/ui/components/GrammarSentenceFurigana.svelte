<script lang="ts">
  /**
   * GrammarSentenceFurigana — renders a Japanese grammar sentence using
   * pre-baked segment data (from `sentenceFurigana` on the fact).
   *
   * Replaces the previous runtime kuromoji tokenization path with a
   * synchronous segment renderer. All data is now baked offline by
   * scripts/japanese/bake-grammar-furigana.mjs.
   *
   * Segment format: { t: string; r?: string; g?: string }
   *   t = surface text (or "{___}" for the blank)
   *   r = hiragana reading (only when t contains kanji)
   *   g = English gloss from JMdict (content words only)
   *
   * Props:
   *   segments     — the full sentenceFurigana array from the fact
   *   excludeWords — words to suppress from hover tooltip (e.g. correctAnswer)
   *   fallbackText — rendered if segments is empty (raw sentence string)
   */

  import { deckOptions } from '../../services/deckOptionsService'

  interface Segment {
    t: string
    r?: string
    g?: string
  }

  interface Props {
    segments: Segment[]
    excludeWords?: string[]
    fallbackText?: string
  }

  let { segments = [], excludeWords = [], fallbackText = '' }: Props = $props()

  let activeSegment = $state<Segment | null>(null)
  let tooltipX = $state(0)
  let tooltipY = $state(0)

  /** Reactively read furigana / kanaOnly from deckOptions store */
  let showFurigana = $derived.by(() => ($deckOptions as any)?.ja?.furigana ?? true)
  let showKanaOnly = $derived.by(() => ($deckOptions as any)?.ja?.kanaOnly ?? false)

  /**
   * Whether a segment should show a hover tooltip.
   * Requires: has an English gloss AND surface is not in excludeWords.
   */
  function isHoverable(seg: Segment): boolean {
    if (!seg.g) return false
    if (excludeWords.some(w => w && (seg.t.includes(w)))) return false
    return true
  }

  function showTooltip(seg: Segment, event: MouseEvent | TouchEvent) {
    const target = event.target as HTMLElement
    const rect = target.getBoundingClientRect()
    tooltipX = rect.left + rect.width / 2
    tooltipY = rect.top - 4
    activeSegment = seg
  }

  function hideTooltip() {
    activeSegment = null
  }
</script>

{#if segments.length > 0}
  <span class="grammar-furigana-container">
    {#each segments as seg}
      {#if seg.t === '{___}'}
        <span class="grammar-blank">______</span>
      {:else if isHoverable(seg)}
        {#if showFurigana && !showKanaOnly && seg.r}
          <span
            class="word-hoverable"
            role="button"
            tabindex="-1"
            onmouseenter={(e) => showTooltip(seg, e)}
            onmouseleave={hideTooltip}
            ontouchstart={(e) => { e.preventDefault(); showTooltip(seg, e) }}
            ontouchend={hideTooltip}
          ><ruby>{seg.t}<rp>(</rp><rt>{seg.r}</rt><rp>)</rp></ruby></span>
        {:else if showKanaOnly && seg.r}
          <span
            class="word-hoverable"
            role="button"
            tabindex="-1"
            onmouseenter={(e) => showTooltip(seg, e)}
            onmouseleave={hideTooltip}
            ontouchstart={(e) => { e.preventDefault(); showTooltip(seg, e) }}
            ontouchend={hideTooltip}
          ><span class="word-plain">{seg.r}</span></span>
        {:else}
          <span
            class="word-hoverable"
            role="button"
            tabindex="-1"
            onmouseenter={(e) => showTooltip(seg, e)}
            onmouseleave={hideTooltip}
            ontouchstart={(e) => { e.preventDefault(); showTooltip(seg, e) }}
            ontouchend={hideTooltip}
          ><span class="word-plain">{seg.t}</span></span>
        {/if}
      {:else if showKanaOnly && seg.r}
        <span class="word-plain">{seg.r}</span>
      {:else if showFurigana && !showKanaOnly && seg.r}
        <ruby class="word-plain">{seg.t}<rp>(</rp><rt>{seg.r}</rt><rp>)</rp></ruby>
      {:else}
        <span class="word-plain">{seg.t}</span>
      {/if}
    {/each}
  </span>
{:else if fallbackText}
  <span>{fallbackText.split('\n')[0]}</span>
{/if}

{#if activeSegment}
  <div
    class="word-tooltip"
    style="left: {tooltipX}px; top: {tooltipY}px;"
    role="tooltip"
  >
    <span class="word-tooltip-reading">{activeSegment.r ?? activeSegment.t}</span>
    <span class="word-tooltip-gloss">{activeSegment.g}</span>
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
