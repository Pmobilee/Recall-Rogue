<script lang="ts">
  import { gaiaThoughtBubble } from '../stores/gameState'
  import { currentScreen } from '../stores/gameState'
  import { GAIA_EXPRESSIONS } from '../../data/gaiaAvatar'

  /** Auto-dismiss duration in milliseconds. */
  const DISMISS_DELAY = 8000

  let visible = $state(false)
  let currentBubble = $state<typeof $gaiaThoughtBubble>(null)
  let dismissTimer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    const bubble = $gaiaThoughtBubble
    const screen = $currentScreen

    // Only show when on the base/dome screen
    if (bubble && screen === 'base') {
      currentBubble = bubble
      visible = true
      if (dismissTimer) clearTimeout(dismissTimer)
      dismissTimer = setTimeout(() => {
        visible = false
        gaiaThoughtBubble.set(null)
      }, DISMISS_DELAY)
    } else if (!bubble) {
      visible = false
      currentBubble = null
      if (dismissTimer) {
        clearTimeout(dismissTimer)
        dismissTimer = null
      }
    }
  })

  const expressionEmoji = $derived(
    currentBubble
      ? (GAIA_EXPRESSIONS[currentBubble.expressionId] ?? GAIA_EXPRESSIONS.neutral).emoji
      : '🤖'
  )

  const isStudyAction = $derived(
    currentBubble?.action === 'study_due' ||
    currentBubble?.action === 'study_near_mastery' ||
    currentBubble?.action === 'study_interest'
  )

  function handleTap(): void {
    if (!currentBubble) return

    if (isStudyAction) {
      // Fire a custom event so parent components or GameManager can react
      window.dispatchEvent(
        new CustomEvent('gaia:study-suggestion', {
          detail: { ...currentBubble },
          bubbles: true,
        })
      )
    }

    // Always dismiss on tap
    visible = false
    gaiaThoughtBubble.set(null)
    if (dismissTimer) {
      clearTimeout(dismissTimer)
      dismissTimer = null
    }
  }
</script>

{#if visible && currentBubble}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="gaia-bubble"
    onclick={handleTap}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? handleTap() : undefined}
    aria-label="GAIA thought bubble — tap to {isStudyAction ? 'study' : 'dismiss'}"
  >
    <!-- Bubble tail pointing downward -->
    <div class="bubble-tail"></div>

    <!-- Header row: emoji + GAIA label -->
    <div class="bubble-header">
      <span class="bubble-emoji" aria-hidden="true">{expressionEmoji}</span>
      <span class="bubble-label">G.A.I.A.</span>
    </div>

    <!-- Main message text -->
    <p class="bubble-text" data-testid="gaia-bubble-text">{currentBubble.text}</p>

    <!-- CTA for study actions -->
    {#if isStudyAction}
      <span class="bubble-cta">Tap to study →</span>
    {/if}
  </div>
{/if}

<style>
  .gaia-bubble {
    position: fixed;
    bottom: 140px;
    right: 16px;
    max-width: 240px;
    width: max-content;

    background: color-mix(in srgb, #1a1a2e 92%, transparent);
    border: 1px solid rgba(78, 204, 163, 0.5);
    border-radius: 8px;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.6),
      0 0 12px rgba(78, 204, 163, 0.15);

    padding: 10px 12px;
    font-family: 'Courier New', monospace;
    font-size: 0.78rem;
    color: #e8e8f0;
    line-height: 1.45;

    z-index: 24;
    cursor: pointer;
    pointer-events: auto;
    user-select: none;

    /* Pop-in animation */
    animation: bubble-pop-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  /* Downward-pointing tail/triangle */
  .bubble-tail {
    position: absolute;
    bottom: -8px;
    right: 20px;
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid rgba(78, 204, 163, 0.5);
  }

  .bubble-tail::after {
    content: '';
    position: absolute;
    bottom: 1px;
    left: -7px;
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-top: 7px solid #1a1a2e;
  }

  .bubble-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .bubble-emoji {
    font-size: 1.1rem;
    line-height: 1;
  }

  .bubble-label {
    font-size: 0.68rem;
    font-weight: 700;
    color: #4ecca3;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .bubble-text {
    margin: 0;
    font-size: 0.76rem;
    color: #dde6f0;
    line-height: 1.45;
    /* Clamp to a readable maximum so very long lines don't overflow */
    word-break: break-word;
  }

  .bubble-cta {
    display: block;
    margin-top: 8px;
    font-size: 0.68rem;
    font-weight: 700;
    color: #4ecca3;
    letter-spacing: 0.03em;
  }

  @keyframes bubble-pop-in {
    from {
      opacity: 0;
      transform: scale(0.8) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @media (max-width: 480px) {
    .gaia-bubble {
      bottom: 120px;
      right: 10px;
      max-width: 200px;
      font-size: 0.72rem;
    }
  }
</style>
