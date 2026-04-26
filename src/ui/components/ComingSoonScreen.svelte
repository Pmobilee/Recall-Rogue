<script lang="ts">
  /**
   * ComingSoonScreen — shown when the player clicks the Multiplayer tent
   * while MULTIPLAYER_ENABLED=false. Explains that multiplayer modes are
   * in development for a post-launch update and provides a single Back
   * button to return to the hub.
   *
   * Not gated on MULTIPLAYER_ENABLED — this screen IS the gate.
   */
  interface Props {
    onBack: () => void
  }

  let { onBack }: Props = $props()
</script>

<section class="coming-soon-screen" aria-label="Multiplayer — coming soon">
  <div class="content-wrapper">
    <header class="header">
      <h2>Multiplayer</h2>
      <button
        type="button"
        class="back-btn"
        data-testid="coming-soon-back-btn"
        onclick={onBack}
      >
        Back to Camp
      </button>
    </header>

    <div class="body-text">
      <p>The tent is set up. The modes aren't ready.</p>
      <p class="detail">Race mode, trivia rounds, and co-op — they're built for a post-launch update.</p>
    </div>
  </div>
</section>

<style>
  .coming-soon-screen {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #101320 0%, #1a1f2f 100%);
    color: #e2e8f0;
  }

  .content-wrapper {
    width: min(calc(560px * var(--layout-scale, 1)), 90vw);
    display: flex;
    flex-direction: column;
    gap: calc(32px * var(--layout-scale, 1));
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: calc(16px * var(--layout-scale, 1));
  }

  .header h2 {
    margin: 0;
    font-size: calc(26px * var(--text-scale, 1));
    color: #e2e8f0;
    letter-spacing: 0.02em;
  }

  .back-btn {
    min-height: calc(44px * var(--layout-scale, 1));
    padding: 0 calc(20px * var(--layout-scale, 1));
    border-radius: calc(10px * var(--layout-scale, 1));
    border: 1px solid #4b5563;
    background: #1f2937;
    color: #dbeafe;
    font-size: calc(15px * var(--text-scale, 1));
    cursor: pointer;
    transition: background 0.15s;
  }

  .back-btn:hover {
    background: #2d3a4a;
  }

  .back-btn:focus-visible {
    outline: 2px solid #60a5fa;
    outline-offset: 2px;
  }

  .body-text {
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
  }

  .body-text p {
    margin: 0;
    font-size: calc(18px * var(--text-scale, 1));
    line-height: 1.6;
    color: #e2e8f0;
  }

  .body-text .detail {
    font-size: calc(15px * var(--text-scale, 1));
    color: #94a3b8;
  }
</style>
