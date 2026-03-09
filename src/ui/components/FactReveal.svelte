<script lang="ts">
  import { onMount } from 'svelte'
  import type { Fact, Rarity } from '../../data/types'
  import { KEEPER_EXPRESSIONS, KEEPER_NAME, getKeeperExpression } from '../../data/gaiaAvatar'
  import { gaiaMood } from '../stores/settings'

  type Props = {
    fact: Fact
    onLearn: () => void
    onSell: () => void
  }

  const { fact, onLearn, onSell }: Props = $props()

  let revealed = $state(false)
  let phase = $state<'cracking' | 'revealed'>('cracking')

  const rarityColors: Record<Rarity, string> = {
    common: '#aaa',
    uncommon: '#4ecca3',
    rare: '#5dade2',
    epic: '#9b59b6',
    legendary: '#ffd369',
    mythic: '#e94560',
  }

  const sellDustValues: Record<Rarity, number> = {
    common: 5,
    uncommon: 10,
    rare: 20,
    epic: 40,
    legendary: 80,
    mythic: 150,
  }

  const categoryPath = $derived(fact.category.join(' > '))
  const rarityColor = $derived(rarityColors[fact.rarity])
  const sellHint = $derived(`Sell for ${sellDustValues[fact.rarity]} Dust`)

  /** Map rarity to the trigger used for GAIA expression selection */
  const rarityTrigger = $derived.by(() => {
    if (fact.rarity === 'legendary' || fact.rarity === 'mythic') return 'relic_found'
    if (fact.rarity === 'rare' || fact.rarity === 'epic') return 'artifact_found'
    return 'quiz_correct'
  })

  const gaiaCommentEmoji = $derived(
    getKeeperExpression(rarityTrigger, $gaiaMood).emoji
  )

  onMount(() => {
    const timer = setTimeout(() => {
      phase = 'revealed'
      revealed = true
    }, 1500)

    return () => clearTimeout(timer)
  })
</script>

<div class="fact-reveal-overlay" style={`--rarity-color: ${rarityColor};`}>
  {#if phase === 'cracking'}
    <div class="cracking-card">
      <div class="artifact-shell">
        <div class="artifact-core" aria-hidden="true"></div>
      </div>
      <p class="cracking-text">Analyzing artifact integrity...</p>
    </div>
  {:else}
    <div class="reveal-card" class:shown={revealed}>
      <div class="meta-row">
        <p class="category">{categoryPath}</p>
        <span class="rarity-badge">{fact.rarity}</span>
      </div>

      <h1 class="statement">{fact.statement}</h1>

      {#if fact.pronunciation}
        <p class="pronunciation">{fact.pronunciation}</p>
      {/if}

      <p class="explanation">{fact.explanation}</p>

      {#if fact.wowFactor}
        <div class="wow-section">
          <span class="wow-label">Mind-Blowing</span>
          <p class="wow-text">{fact.wowFactor}</p>
        </div>
      {/if}

      {#if fact.gaiaComment}
        <div class="gaia-section">
          <div class="gaia-section-header">
            <span class="gaia-section-emoji" aria-hidden="true">{gaiaCommentEmoji}</span>
            <span class="gaia-label">{KEEPER_NAME}</span>
          </div>
          <p class="gaia-text">"{fact.gaiaComment}"</p>
        </div>
      {/if}

      {#if fact.exampleSentence}
        <p class="example">"{fact.exampleSentence}"</p>
      {/if}

      <div class="actions">
        <button type="button" class="learn-button" onclick={onLearn}>Learn</button>
        <button type="button" class="sell-button" onclick={onSell}>
          Sell
          <span class="sell-hint">{sellHint}</span>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .fact-reveal-overlay {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 1.2rem;
    background: radial-gradient(circle at top, #1f2a4a 0%, rgba(10, 12, 24, 0.96) 45%, #080a14 100%);
    font-family: 'Courier New', monospace;
  }

  .cracking-card,
  .reveal-card {
    width: min(680px, 100%);
    border: 1px solid color-mix(in srgb, var(--rarity-color) 65%, #111 35%);
    border-radius: 16px;
    background: linear-gradient(160deg, rgba(22, 33, 62, 0.96), rgba(15, 22, 40, 0.96));
    box-shadow: 0 0 30px color-mix(in srgb, var(--rarity-color) 38%, transparent), 0 20px 48px rgba(0, 0, 0, 0.5);
  }

  .cracking-card {
    min-height: 320px;
    padding: 2rem;
    display: grid;
    place-items: center;
    gap: 1rem;
  }

  .artifact-shell {
    width: 150px;
    height: 150px;
    border-radius: 22px;
    display: grid;
    place-items: center;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
    border: 2px solid color-mix(in srgb, var(--rarity-color) 40%, #333 60%);
    animation: pulse 1.1s ease-in-out infinite;
  }

  .artifact-core {
    width: 86px;
    height: 86px;
    border-radius: 18px;
    background: var(--rarity-color);
    box-shadow: 0 0 18px var(--rarity-color), inset 0 0 18px rgba(255, 255, 255, 0.38);
    animation: shake 0.22s linear infinite, crack 1.5s linear infinite;
  }

  .cracking-text {
    color: var(--color-text-dim);
    letter-spacing: 0.03em;
    text-align: center;
  }

  .reveal-card {
    padding: 1.4rem;
    transform: translateY(24px);
    opacity: 0;
    transition: transform 300ms ease, opacity 300ms ease;
  }

  .reveal-card.shown {
    transform: translateY(0);
    opacity: 1;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .category {
    color: var(--color-text-dim);
    font-size: 0.8rem;
  }

  .rarity-badge {
    text-transform: uppercase;
    font-size: 0.76rem;
    letter-spacing: 0.08em;
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--rarity-color) 30%, rgba(0, 0, 0, 0.5) 70%);
    color: #fff;
    border: 1px solid color-mix(in srgb, var(--rarity-color) 75%, #222 25%);
  }

  .statement {
    margin-bottom: 0.5rem;
    font-size: clamp(1.6rem, 3.8vw, 2.25rem);
    line-height: 1.15;
    color: var(--color-text);
    font-weight: 700;
  }

  .pronunciation {
    margin-bottom: 0.9rem;
    color: var(--color-warning);
    font-size: 1rem;
  }

  .explanation {
    color: var(--color-text-dim);
    font-size: 1rem;
    line-height: 1.45;
    margin-bottom: 0.9rem;
  }

  .wow-section {
    margin-top: 14px;
    padding: 12px;
    background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface) 90%);
    border-radius: 10px;
    border-left: 3px solid var(--color-warning);
  }

  .wow-label {
    display: block;
    text-transform: uppercase;
    font-size: 0.7rem;
    color: var(--color-warning);
    font-weight: 700;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }

  .wow-text {
    color: var(--color-text);
    font-size: 0.85rem;
    line-height: 1.45;
    margin: 0;
  }

  .gaia-section {
    margin-top: 10px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface) 88%);
    border-radius: 10px;
    border-left: 3px solid var(--color-accent);
  }

  .gaia-section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .gaia-section-emoji {
    font-size: 1.15rem;
    line-height: 1;
  }

  .gaia-label {
    text-transform: uppercase;
    font-size: 0.68rem;
    color: var(--color-accent);
    font-weight: 800;
    letter-spacing: 1.5px;
  }

  .gaia-text {
    color: var(--color-text-dim);
    font-size: 0.82rem;
    line-height: 1.4;
    margin: 0;
    font-style: italic;
  }

  .example {
    color: var(--color-text);
    line-height: 1.45;
    margin-bottom: 1.2rem;
    font-style: italic;
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .learn-button,
  .sell-button {
    min-height: 62px;
    border: none;
    border-radius: 12px;
    font: inherit;
    color: #091018;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 150ms ease, filter 150ms ease;
  }

  .learn-button {
    background: var(--color-success);
  }

  .sell-button {
    background: var(--color-accent);
    color: #fff;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 0.2rem;
  }

  .sell-hint {
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    opacity: 0.92;
  }

  .learn-button:active,
  .sell-button:active {
    transform: translateY(1px) scale(0.99);
    filter: brightness(0.96);
  }

  @media (max-width: 640px) {
    .fact-reveal-overlay {
      padding: 0.9rem;
    }

    .cracking-card,
    .reveal-card {
      border-radius: 14px;
    }

    .reveal-card {
      padding: 1.1rem;
    }

    .actions {
      grid-template-columns: 1fr;
    }
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(0.98);
    }
    50% {
      transform: scale(1.02);
    }
  }

  @keyframes shake {
    0% {
      transform: translate(0, 0) rotate(0deg);
    }
    25% {
      transform: translate(-1px, 1px) rotate(-1deg);
    }
    50% {
      transform: translate(1px, -1px) rotate(1deg);
    }
    75% {
      transform: translate(-1px, -1px) rotate(-1deg);
    }
    100% {
      transform: translate(1px, 1px) rotate(1deg);
    }
  }

  @keyframes crack {
    0%,
    70% {
      clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
    }
    80% {
      clip-path: polygon(0 0, 100% 0, 100% 100%, 52% 100%, 47% 70%, 0 100%);
    }
    90% {
      clip-path: polygon(0 0, 100% 0, 100% 100%, 57% 100%, 50% 64%, 44% 100%, 0 100%);
    }
    100% {
      clip-path: polygon(0 0, 100% 0, 100% 100%, 60% 100%, 52% 58%, 42% 100%, 0 100%);
    }
  }
</style>
