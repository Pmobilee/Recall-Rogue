<script lang="ts">
  /**
   * FuriganaText — renders Japanese text with optional furigana and romaji.
   *
   * When furigana is enabled and a reading is provided, displays the text
   * with ruby annotations. When romaji is enabled, shows romanized text below.
   * Respects user deck options for language-specific display preferences.
   */

  import { deckOptions } from '../services/deckOptionsService'

  interface Props {
    /** The Japanese text to display (kanji/kana). */
    text: string
    /** Hiragana reading for furigana display above kanji. */
    reading?: string
    /** Romanized reading of the text. */
    romaji?: string
    /** Text size preset: 'sm' | 'md' | 'lg'. */
    size?: 'sm' | 'md' | 'lg'
  }

  let { text, reading, romaji, size = 'md' }: Props = $props()

  /**
   * Derive whether furigana should be shown.
   * Defaults to true if not explicitly set in deck options.
   */
  let showFurigana = $derived.by(() => {
    const opts = $deckOptions
    return opts?.ja?.furigana ?? true
  })

  /**
   * Derive whether romaji should be shown.
   * Defaults to false if not explicitly set in deck options.
   */
  let showRomaji = $derived.by(() => {
    const opts = $deckOptions
    return opts?.ja?.romaji ?? false
  })

  /**
   * Derive whether kana-only mode is enabled.
   * When true and a reading is available, show only the hiragana reading — no kanji.
   */
  let showKanaOnly = $derived.by(() => {
    const opts = $deckOptions
    return opts?.ja?.kanaOnly ?? false
  })

  /**
   * Derive whether we should render ruby markup.
   * True only if: reading exists AND furigana is enabled AND reading is not empty AND kana-only is off.
   */
  let shouldShowRuby = $derived(reading && reading.trim() && showFurigana && !showKanaOnly)
</script>

{#if showKanaOnly && reading && reading.trim()}
  <span class="furigana-wrapper size-{size}">
    <span>{reading}</span>
    {#if showRomaji && romaji && romaji.trim()}
      <span class="romaji">{romaji}</span>
    {/if}
  </span>
{:else if shouldShowRuby}
  <span class="furigana-wrapper size-{size}">
    <ruby>{text}<rp>(</rp><rt>{reading}</rt><rp>)</rp></ruby>
    {#if showRomaji && romaji && romaji.trim()}
      <span class="romaji">{romaji}</span>
    {/if}
  </span>
{:else}
  <span class="furigana-wrapper size-{size}">
    <span>{text}</span>
    {#if showRomaji && romaji && romaji.trim()}
      <span class="romaji">{romaji}</span>
    {/if}
  </span>
{/if}

<style>
  .furigana-wrapper {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
  }

  ruby {
    ruby-position: over;
  }

  rt {
    font-size: 0.5em;
    color: var(--color-text-muted, #888);
    font-weight: normal;
  }

  .romaji {
    font-size: 0.6em;
    color: var(--color-text-muted, #888);
    letter-spacing: 0.05em;
    margin-top: 2px;
  }

  /* Size presets */
  .size-sm {
    font-size: 1rem;
  }

  .size-md {
    font-size: 1.25rem;
  }

  .size-lg {
    font-size: 1.75rem;
  }
</style>
