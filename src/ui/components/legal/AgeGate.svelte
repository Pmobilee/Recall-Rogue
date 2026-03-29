<script lang="ts">
  import { AGE_BRACKET_KEY, type AgeBracket } from '../../../services/legalConstants'

  interface Props {
    /**
     * Called after the player selects an age bracket.
     * The result is also persisted to localStorage under `rr_age_bracket`.
     */
    onSelect: (bracket: AgeBracket) => void
  }

  let { onSelect }: Props = $props()

  /** Handles a button tap — persists and fires the callback. */
  function handleSelect(bracket: AgeBracket): void {
    localStorage.setItem(AGE_BRACKET_KEY, bracket)
    onSelect(bracket)
  }
</script>

<div class="gate-screen" role="dialog" aria-modal="true" aria-labelledby="gate-title">
  <!-- GAIA speech bubble -->
  <div class="gaia-bubble-wrap">
    <div class="gaia-avatar" aria-hidden="true">G</div>
    <div class="gaia-bubble">
      <p class="bubble-text">
        Before we begin, I need to know a little about you...
      </p>
      <div class="bubble-tail" aria-hidden="true"></div>
    </div>
  </div>

  <!-- Main card -->
  <div class="gate-card">
    <h1 id="gate-title" class="gate-heading">How old are you?</h1>
    <p class="gate-subtext">
      Your answer helps us show you age-appropriate content. We do not share this with anyone.
    </p>

    <div class="bracket-buttons">
      <button
        class="bracket-btn"
        type="button"
        onclick={() => handleSelect('under_13')}
      >
        <span class="bracket-label">Under 13</span>
        <span class="bracket-desc">Kid-friendly content only</span>
      </button>

      <button
        class="bracket-btn"
        type="button"
        onclick={() => handleSelect('teen')}
      >
        <span class="bracket-label">13–17</span>
        <span class="bracket-desc">Teen and kid content</span>
      </button>

      <button
        class="bracket-btn bracket-btn--primary"
        type="button"
        onclick={() => handleSelect('adult')}
        data-testid="btn-age-adult"
      >
        <span class="bracket-label">18+</span>
        <span class="bracket-desc">All content unlocked</span>
      </button>
    </div>
  </div>
</div>

<style>
  .gate-screen {
    pointer-events: auto;
    position: fixed;
    inset: 0;
    background: #1a1a2e;
    z-index: 300;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    padding: 1.5rem;
    font-family: 'Courier New', monospace;
  }

  /* ── GAIA bubble ── */
  .gaia-bubble-wrap {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    max-width: 360px;
    width: 100%;
  }

  .gaia-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #e94560 0%, #c0392b 100%);
    border: 2px solid rgba(233, 69, 96, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
    box-shadow: 0 0 12px rgba(233, 69, 96, 0.4);
  }

  .gaia-bubble {
    position: relative;
    background: #16213e;
    border: 1px solid rgba(233, 69, 96, 0.3);
    border-radius: 14px 14px 14px 4px;
    padding: 0.875rem 1rem;
    flex: 1;
  }

  .bubble-text {
    font-size: 0.875rem;
    line-height: 1.55;
    color: rgba(238, 238, 238, 0.9);
    margin: 0;
    font-style: italic;
  }

  .bubble-tail {
    position: absolute;
    bottom: 10px;
    left: -8px;
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    border-right: 8px solid rgba(233, 69, 96, 0.3);
  }

  /* ── Main card ── */
  .gate-card {
    background: #16213e;
    border: 1px solid rgba(233, 69, 96, 0.25);
    border-radius: 20px;
    padding: 2rem 1.5rem;
    width: min(100%, 360px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .gate-heading {
    font-size: 1.4rem;
    font-weight: 700;
    color: #eee;
    margin: 0;
    text-align: center;
    letter-spacing: 1px;
  }

  .gate-subtext {
    font-size: 0.78rem;
    color: rgba(238, 238, 238, 0.45);
    text-align: center;
    margin: 0;
    line-height: 1.5;
    max-width: 280px;
  }

  /* ── Bracket buttons ── */
  .bracket-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .bracket-btn {
    width: 100%;
    min-height: 60px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0.75rem 1rem;
    gap: 0.2rem;
    transition: border-color 150ms ease, background 150ms ease;
    font-family: inherit;
  }

  .bracket-btn:hover {
    border-color: rgba(78, 205, 196, 0.5);
    background: rgba(78, 205, 196, 0.06);
  }

  .bracket-btn:active {
    transform: scale(0.98);
  }

  .bracket-btn--primary {
    border-color: rgba(233, 69, 96, 0.4);
    background: rgba(233, 69, 96, 0.06);
  }

  .bracket-btn--primary:hover {
    border-color: rgba(233, 69, 96, 0.7);
    background: rgba(233, 69, 96, 0.12);
  }

  .bracket-label {
    font-size: 1rem;
    font-weight: 700;
    color: #eee;
    display: block;
  }

  .bracket-desc {
    font-size: 0.75rem;
    color: rgba(238, 238, 238, 0.5);
    display: block;
  }
</style>
