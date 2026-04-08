<script lang="ts">
  import {
    sfxEnabled,
    musicEnabled,
    ambientEnabled,
    sfxVolume,
    musicVolume,
    ambientVolume,
    playCardAudio,
  } from '../../services/cardAudioManager'
  import { answerDisplaySpeed, autoResumeAfterAnswer } from '../stores/settings'
  import { toggleFullscreen, isFullscreen } from '../../services/fullscreenService'
  import { isMobile } from '../../services/platformService'

  interface Props {
    currentFloor: number
    playerHp: number
    playerMaxHp: number
    deckSize: number
    relicCount: number
    accuracy: number
    onresume: () => void
    onreturnhub: () => void
    canReturnHub?: boolean
  }

  let {
    currentFloor,
    playerHp,
    playerMaxHp,
    deckSize,
    relicCount,
    accuracy,
    onresume,
    onreturnhub,
    canReturnHub = true,
  }: Props = $props()

  let settingsExpanded = $state(false)
  let fullscreenActive = $state(false)

  $effect(() => {
    isFullscreen().then((v) => { fullscreenActive = v })
    const onFsChange = (): void => {
      isFullscreen().then((v) => { fullscreenActive = v })
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  })

  async function handleFullscreenToggle(): Promise<void> {
    const newState = await toggleFullscreen()
    fullscreenActive = newState
    playCardAudio(newState ? 'toggle-on' : 'toggle-off')
  }
</script>

<div class="campfire-overlay">
  <div class="campfire-card">
    <h2 class="campfire-title">Resting by the fire...</h2>

    <div class="stats-grid">
      <div class="stat">
        <span class="stat-label">Floor</span>
        <span class="stat-value">{currentFloor}</span>
      </div>
      <div class="stat">
        <span class="stat-label">HP</span>
        <span class="stat-value">{playerHp}/{playerMaxHp}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Deck</span>
        <span class="stat-value">{deckSize} cards</span>
      </div>
      <div class="stat">
        <span class="stat-label">Relics</span>
        <span class="stat-value">{relicCount}</span>
      </div>
      <div class="stat stat-wide">
        <span class="stat-label">Accuracy</span>
        <span class="stat-value">{accuracy}%</span>
      </div>
    </div>

    <!-- Quick Settings -->
    <button
      type="button"
      class="settings-toggle"
      onclick={() => { settingsExpanded = !settingsExpanded }}
    >
      {settingsExpanded ? '▾' : '▸'} Quick Settings
    </button>

    {#if settingsExpanded}
      <div class="quick-settings">
        <div class="qs-group">
          <span class="qs-label">Audio</span>
          <label class="qs-toggle">
            <span>SFX</span>
            <input type="checkbox" bind:checked={$sfxEnabled} />
          </label>
          <label class="qs-slider">
            <input type="range" min="0" max="1" step="0.05" bind:value={$sfxVolume} />
            <span class="qs-val">{Math.round($sfxVolume * 100)}%</span>
          </label>
          <label class="qs-toggle">
            <span>Music</span>
            <input type="checkbox" bind:checked={$musicEnabled} />
          </label>
          <label class="qs-slider">
            <input type="range" min="0" max="1" step="0.05" bind:value={$musicVolume} />
            <span class="qs-val">{Math.round($musicVolume * 100)}%</span>
          </label>
          <label class="qs-toggle">
            <span>Ambient</span>
            <input type="checkbox" bind:checked={$ambientEnabled} />
          </label>
          <label class="qs-slider">
            <input type="range" min="0" max="1" step="0.05" bind:value={$ambientVolume} />
            <span class="qs-val">{Math.round($ambientVolume * 100)}%</span>
          </label>
        </div>

        <div class="qs-group">
          <span class="qs-label">Gameplay</span>
          <label class="qs-slider">
            <span>Answer Speed</span>
            <input type="range" min="0.5" max="3.0" step="0.1" bind:value={$answerDisplaySpeed} />
            <span class="qs-val">{$answerDisplaySpeed.toFixed(1)}×</span>
          </label>
          <label class="qs-toggle">
            <span>Auto-Resume After Answer</span>
            <input type="checkbox" bind:checked={$autoResumeAfterAnswer} />
          </label>
        </div>

        {#if !isMobile}
          <div class="qs-group">
            <label class="qs-toggle">
              <span>Fullscreen</span>
              <input
                type="checkbox"
                checked={fullscreenActive}
                onclick={() => void handleFullscreenToggle()}
              />
            </label>
          </div>
        {/if}
      </div>
    {/if}

    <div class="campfire-actions">
      <button
        type="button"
        class="resume-btn"
        data-testid="btn-campfire-resume"
        onclick={onresume}
      >
        Resume Run
      </button>
      {#if canReturnHub}
        <button
          type="button"
          class="hub-btn"
          data-testid="btn-campfire-hub"
          onclick={onreturnhub}
        >
          Return to Hub
        </button>
      {/if}
    </div>

    <p class="hub-hint">
      {#if canReturnHub}
        Your run will be saved. Resume any time.
      {:else}
        Ascension Iron Will is active: this run cannot be fled.
      {/if}
    </p>
  </div>
</div>

<style>
  .campfire-overlay {
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at 50% 80%, rgba(255, 140, 0, 0.08), transparent 60%),
      rgba(7, 10, 15, 0.97);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    padding: calc(16px * var(--layout-scale, 1));
  }

  .campfire-card {
    background: linear-gradient(180deg, #1a1d24, #12151b);
    border: 1px solid rgba(255, 160, 60, 0.25);
    border-radius: 16px;
    padding: calc(28px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    max-width: calc(480px * var(--layout-scale, 1));
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(20px * var(--layout-scale, 1));
    max-height: 90vh;
    overflow-y: auto;
  }

  .campfire-title {
    margin: 0;
    font-size: calc(20px * var(--text-scale, 1));
    color: #fbbf24;
    text-align: center;
    letter-spacing: 0.5px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
  }

  .stat {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 10px;
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .stat-wide {
    grid-column: 1 / -1;
  }

  .stat-label {
    font-size: calc(11px * var(--text-scale, 1));
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: calc(16px * var(--text-scale, 1));
    color: #f8fafc;
    font-weight: 700;
  }

  .settings-toggle {
    width: 100%;
    background: transparent;
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 8px;
    color: #94a3b8;
    font-size: calc(13px * var(--text-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    cursor: pointer;
    text-align: left;
    transition: color 0.15s, border-color 0.15s;
  }

  .settings-toggle:hover {
    color: #cbd5e1;
    border-color: rgba(148, 163, 184, 0.4);
  }

  .quick-settings {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1)) 0;
  }

  .qs-group {
    display: flex;
    flex-direction: column;
    gap: calc(6px * var(--layout-scale, 1));
    padding: calc(8px * var(--layout-scale, 1));
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: 8px;
  }

  .qs-label {
    font-size: calc(11px * var(--text-scale, 1));
    color: #fbbf24;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 700;
  }

  .qs-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .qs-toggle input[type="checkbox"] {
    width: calc(18px * var(--layout-scale, 1));
    height: calc(18px * var(--layout-scale, 1));
    accent-color: #f59e0b;
    cursor: pointer;
  }

  .qs-slider {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #cbd5e1;
  }

  .qs-slider input[type="range"] {
    flex: 1;
    accent-color: #f59e0b;
    height: calc(4px * var(--layout-scale, 1));
    cursor: pointer;
  }

  .qs-val {
    font-size: calc(11px * var(--text-scale, 1));
    color: #94a3b8;
    min-width: calc(36px * var(--layout-scale, 1));
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .campfire-actions {
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
    width: 100%;
  }

  .resume-btn {
    width: 100%;
    min-height: calc(52px * var(--layout-scale, 1));
    border: 2px solid #f59e0b;
    border-radius: 12px;
    background: linear-gradient(180deg, #2f7a35, #1f5c28);
    color: #f8fafc;
    font-size: calc(18px * var(--text-scale, 1));
    font-weight: 800;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .resume-btn:active {
    transform: scale(0.97);
  }

  .hub-btn {
    width: 100%;
    min-height: calc(44px * var(--layout-scale, 1));
    border: 1px solid rgba(148, 163, 184, 0.4);
    border-radius: 10px;
    background: rgba(30, 41, 59, 0.75);
    color: #cbd5e1;
    font-size: calc(14px * var(--text-scale, 1));
    cursor: pointer;
    transition: background 0.15s;
  }

  .hub-btn:hover {
    background: rgba(30, 41, 59, 0.95);
  }

  .hub-hint {
    margin: 0;
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    text-align: center;
  }
</style>
