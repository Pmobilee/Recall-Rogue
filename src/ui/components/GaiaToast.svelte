<script lang="ts">
  import { gaiaMessage, gaiaExpression } from '../stores/gameState'
  import { GAIA_EXPRESSIONS, GAIA_NAME } from '../../data/gaiaAvatar'

  // Import all GAIA sprite images for the expression set
  import gaiaNeutral from '../../assets/sprites/dome/gaia_neutral.png'
  import gaiaHappy from '../../assets/sprites/dome/gaia_happy.png'
  import gaiaThinking from '../../assets/sprites/dome/gaia_thinking.png'
  import gaiaSnarky from '../../assets/sprites/dome/gaia_snarky.png'
  import gaiaSurprised from '../../assets/sprites/dome/gaia_surprised.png'
  import gaiaCalm from '../../assets/sprites/dome/gaia_calm.png'

  /** Map expression IDs to sprite image URLs */
  const GAIA_SPRITE_MAP: Record<string, string> = {
    neutral:   gaiaNeutral,
    happy:     gaiaHappy,
    excited:   gaiaHappy,
    thinking:  gaiaThinking,
    worried:   gaiaThinking,
    proud:     gaiaHappy,
    snarky:    gaiaSnarky,
    surprised: gaiaSurprised,
    calm:      gaiaCalm,
  }

  /** Auto-dismiss duration in milliseconds */
  const DISMISS_DELAY = 4000

  let visible = $state(false)
  let currentMessage = $state('')
  let currentExpressionId = $state('neutral')
  let dismissTimer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    const msg = $gaiaMessage
    if (msg) {
      currentMessage = msg
      currentExpressionId = $gaiaExpression
      visible = true
      if (dismissTimer) clearTimeout(dismissTimer)
      dismissTimer = setTimeout(() => {
        visible = false
        gaiaMessage.set(null)
      }, DISMISS_DELAY)
    }
  })

  const expressionEmoji = $derived(
    (GAIA_EXPRESSIONS[currentExpressionId] ?? GAIA_EXPRESSIONS.neutral).emoji
  )

  const gaiaSpriteUrl = $derived(
    GAIA_SPRITE_MAP[currentExpressionId] ?? gaiaNeutral
  )
</script>

{#if visible}
  <div class="gaia-toast" class:visible>
    <img class="gaia-avatar" src={gaiaSpriteUrl} alt={`G.A.I.A. ${currentExpressionId}`} width="28" height="28" />
    <div class="gaia-body">
      <span class="gaia-prefix">{GAIA_NAME}:</span>
      <span class="gaia-text">{currentMessage}</span>
    </div>
  </div>
{/if}

<style>
  .gaia-toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(16px);
    max-width: 360px;
    width: calc(100% - 2rem);
    padding: 10px 14px;
    background: color-mix(in srgb, var(--color-bg, #1a1a2e) 88%, transparent);
    border-left: 4px solid var(--color-warning, #f4c430);
    border-radius: 0 6px 6px 0;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    font-family: 'Courier New', monospace;
    font-size: 0.82rem;
    color: var(--color-text, #e8e8f0);
    line-height: 1.4;
    z-index: 25;
    pointer-events: none;
    opacity: 0;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    animation:
      gaia-slide-in 0.3s ease-out forwards,
      gaia-fade-out 0.35s ease-in forwards var(--dismiss-delay, 3.65s);
  }

  .gaia-avatar {
    width: 28px;
    height: 28px;
    object-fit: contain;
    image-rendering: pixelated;
    flex-shrink: 0;
    margin-top: 1px;
    border-radius: 4px;
  }

  .gaia-body {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 0.4em;
    min-width: 0;
  }

  .gaia-prefix {
    font-weight: 700;
    color: var(--color-warning, #f4c430);
    flex-shrink: 0;
  }

  .gaia-text {
    color: var(--color-text, #e8e8f0);
  }

  @keyframes gaia-slide-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes gaia-fade-out {
    from {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    to {
      opacity: 0;
      transform: translateX(-50%) translateY(-8px);
    }
  }

  @media (max-width: 480px) {
    .gaia-toast {
      bottom: 72px;
      font-size: 0.78rem;
    }

    .gaia-avatar {
      font-size: 1.1rem;
    }
  }
</style>
