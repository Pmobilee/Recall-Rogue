<script lang="ts">
  export let onAllow: (() => void) | undefined = undefined
  export let onDismiss: (() => void) | undefined = undefined

  function handleAllow(): void {
    if (onAllow) onAllow()
  }

  function handleDismiss(): void {
    if (onDismiss) onDismiss()
  }
</script>

<div class="notif-prompt" role="dialog" aria-label="Enable Notifications">
  <div class="prompt-card">
    <span class="gaia-icon">G</span>
    <h3>Stay Connected</h3>
    <p class="prompt-text">GAIA can send you gentle daily reminders — max 1 per day, and she'll stop automatically if you're away for a week.</p>
    <p class="prompt-sub">You can customize or disable anytime in Settings.</p>
    <div class="prompt-actions">
      <button class="allow-btn" on:click={handleAllow}>Enable</button>
      <button class="dismiss-btn" on:click={handleDismiss}>Not Now</button>
    </div>
  </div>
</div>

<style>
  .notif-prompt {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 150;
    pointer-events: auto;
    animation: slideUp 0.4s ease-out;
  }
  .prompt-card {
    background: #16213e;
    border: 2px solid #0f3460;
    border-radius: 12px;
    padding: 20px 24px;
    text-align: center;
    max-width: 320px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }
  .gaia-icon {
    display: inline-block;
    width: 40px;
    height: 40px;
    background: #e94560;
    border-radius: 50%;
    line-height: 40px;
    font-size: 20px;
    color: white;
    font-family: var(--font-rpg);
    margin-bottom: 10px;
  }
  h3 {
    font-family: var(--font-rpg);
    font-size: 12px;
    color: #e94560;
    margin: 0 0 8px;
  }
  .prompt-text {
    color: #ccc;
    font-size: 12px;
    line-height: 1.5;
    margin: 0 0 6px;
  }
  .prompt-sub {
    color: #777;
    font-size: 10px;
    margin: 0 0 16px;
  }
  .prompt-actions {
    display: flex;
    gap: 10px;
  }
  .allow-btn {
    flex: 1;
    background: #e94560;
    color: white;
    border: none;
    padding: 10px;
    border-radius: 6px;
    font-family: var(--font-rpg);
    font-size: 10px;
    cursor: pointer;
  }
  .dismiss-btn {
    flex: 1;
    background: transparent;
    color: #888;
    border: 1px solid #333;
    padding: 10px;
    border-radius: 6px;
    font-family: var(--font-rpg);
    font-size: 10px;
    cursor: pointer;
  }

  @keyframes slideUp {
    from { transform: translateX(-50%) translateY(100px); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
  }
</style>
