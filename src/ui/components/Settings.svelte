<script lang="ts">
  import { playerSave } from '../stores/playerData'
  import { deleteSave } from '../../services/saveService'
  import {
    spriteResolution,
    setSpriteResolution,
    gaiaMood,
    gaiaChattiness,
    type GaiaMood,
    type SpriteResolution,
  } from '../stores/settings'
  import { GAIA_IDLE_QUIPS } from '../../data/gaiaDialogue'
  import { GAIA_NAME } from '../../data/gaiaAvatar'

  interface Props {
    /** Called when the user taps the Back button. */
    onBack: () => void
  }

  let { onBack }: Props = $props()

  // Delete-save confirmation state
  let showDeleteConfirm = $state(false)

  /** Returns a sample idle quip for the given mood. */
  function getSampleQuip(mood: GaiaMood): string {
    const pool = GAIA_IDLE_QUIPS[mood]
    return pool[0] ?? '...'
  }

  const sampleQuip = $derived(getSampleQuip($gaiaMood))

  function handleSpriteQuality(): void {
    const next: SpriteResolution = $spriteResolution === 'low' ? 'high' : 'low'
    setSpriteResolution(next)
  }

  function handleMoodSelect(mood: GaiaMood): void {
    gaiaMood.set(mood)
  }

  function handleChattinessChange(e: Event): void {
    const val = parseInt((e.target as HTMLInputElement).value, 10)
    gaiaChattiness.set(isNaN(val) ? 5 : Math.max(0, Math.min(10, val)))
  }

  function handleDeleteSave(): void {
    deleteSave()
    window.location.reload()
  }

  function truncateId(id: string | undefined): string {
    if (!id) return 'Unknown'
    return id.length > 12 ? id.slice(0, 8) + '…' + id.slice(-4) : id
  }

  const chattinessLabel = $derived(
    $gaiaChattiness === 0
      ? 'Silent'
      : $gaiaChattiness <= 3
        ? 'Quiet'
        : $gaiaChattiness <= 6
          ? 'Moderate'
          : $gaiaChattiness <= 9
            ? 'Talkative'
            : 'Non-stop',
  )
</script>

<div class="settings-page" aria-label="Settings">
  <!-- Header -->
  <div class="settings-header">
    <button class="back-btn" type="button" onclick={onBack} aria-label="Back">
      ← Back
    </button>
    <h1 class="settings-title">Settings</h1>
    <div class="header-spacer" aria-hidden="true"></div>
  </div>

  <div class="settings-scroll">

    <!-- ===== DISPLAY SETTINGS ===== -->
    <section class="settings-section" aria-labelledby="display-heading">
      <h2 id="display-heading" class="section-heading">Display</h2>

      <div class="settings-card">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Sprite Quality</span>
            <span class="setting-desc">
              {$spriteResolution === 'low' ? 'Low (32 px)' : 'High (256 px)'}
            </span>
          </div>
          <button class="setting-toggle" type="button" onclick={handleSpriteQuality}>
            {$spriteResolution === 'low' ? 'Switch to High' : 'Switch to Low'}
          </button>
        </div>
        <p class="setting-note">Changing sprite quality reloads the page.</p>
      </div>
    </section>

    <!-- ===== GAIA SETTINGS ===== -->
    <section class="settings-section" aria-labelledby="gaia-heading">
      <h2 id="gaia-heading" class="section-heading">{GAIA_NAME} (GAIA)</h2>

      <div class="settings-card">

        <!-- Mood -->
        <div class="setting-block" aria-label="GAIA Mood">
          <div class="setting-info">
            <span class="setting-label">Mood</span>
            <span class="setting-desc">
              {$gaiaMood === 'enthusiastic'
                ? 'Upbeat and encouraging'
                : $gaiaMood === 'snarky'
                  ? 'Dry wit and sarcasm'
                  : 'Measured and mindful'}
            </span>
          </div>
          <div class="mood-buttons" role="group" aria-label="Choose GAIA mood">
            <button
              class="mood-btn"
              class:mood-active={$gaiaMood === 'snarky'}
              type="button"
              onclick={() => handleMoodSelect('snarky')}
              aria-pressed={$gaiaMood === 'snarky'}
            >Snarky</button>
            <button
              class="mood-btn"
              class:mood-active={$gaiaMood === 'enthusiastic'}
              type="button"
              onclick={() => handleMoodSelect('enthusiastic')}
              aria-pressed={$gaiaMood === 'enthusiastic'}
            >Enthusiastic</button>
            <button
              class="mood-btn"
              class:mood-active={$gaiaMood === 'calm'}
              type="button"
              onclick={() => handleMoodSelect('calm')}
              aria-pressed={$gaiaMood === 'calm'}
            >Calm</button>
          </div>
        </div>

        <!-- Chattiness -->
        <div class="setting-block" aria-label="GAIA Chattiness">
          <div class="setting-info">
            <span class="setting-label">Chattiness</span>
            <span class="setting-desc">{chattinessLabel} ({$gaiaChattiness}/10)</span>
          </div>
          <input
            class="chattiness-slider"
            type="range"
            min="0"
            max="10"
            step="1"
            value={$gaiaChattiness}
            oninput={handleChattinessChange}
            aria-label="GAIA chattiness level, 0 to 10"
          />
        </div>

        <!-- Sample message preview -->
        <div class="gaia-preview" aria-label="Sample GAIA message">
          <span class="gaia-preview-icon" aria-hidden="true">💬</span>
          <span class="gaia-preview-text">"{sampleQuip}"</span>
        </div>
      </div>
    </section>

    <!-- ===== AUDIO SETTINGS (placeholder) ===== -->
    <section class="settings-section" aria-labelledby="audio-heading">
      <h2 id="audio-heading" class="section-heading">Audio</h2>

      <div class="settings-card">
        <div class="setting-block setting-disabled" aria-label="Music Volume">
          <div class="setting-info">
            <span class="setting-label">Music Volume</span>
            <span class="setting-desc">100%</span>
          </div>
          <input class="chattiness-slider" type="range" min="0" max="10" value="10" disabled aria-label="Music volume" />
        </div>
        <div class="setting-block setting-disabled" aria-label="SFX Volume">
          <div class="setting-info">
            <span class="setting-label">SFX Volume</span>
            <span class="setting-desc">100%</span>
          </div>
          <input class="chattiness-slider" type="range" min="0" max="10" value="10" disabled aria-label="SFX volume" />
        </div>
        <p class="setting-note coming-soon">Full audio controls — coming soon.</p>
      </div>
    </section>

    <!-- ===== ACCOUNT ===== -->
    <section class="settings-section" aria-labelledby="account-heading">
      <h2 id="account-heading" class="section-heading">Account</h2>

      <div class="settings-card">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Age Rating</span>
            <span class="setting-desc">{$playerSave?.ageRating ?? 'Unknown'}</span>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Player ID</span>
            <span class="setting-desc mono">{truncateId($playerSave?.playerId)}</span>
          </div>
        </div>

        {#if !showDeleteConfirm}
          <button
            class="delete-btn"
            type="button"
            onclick={() => { showDeleteConfirm = true }}
          >
            Delete Save Data
          </button>
        {:else}
          <div class="delete-confirm" role="alertdialog" aria-labelledby="delete-confirm-heading" aria-modal="false">
            <p id="delete-confirm-heading" class="delete-confirm-text">
              All progress will be permanently erased. This cannot be undone.
            </p>
            <div class="delete-confirm-buttons">
              <button class="delete-btn delete-btn-confirm" type="button" onclick={handleDeleteSave}>
                Yes, Delete Everything
              </button>
              <button class="cancel-btn" type="button" onclick={() => { showDeleteConfirm = false }}>
                Cancel
              </button>
            </div>
          </div>
        {/if}
      </div>
    </section>

    <!-- ===== ABOUT ===== -->
    <section class="settings-section" aria-labelledby="about-heading">
      <h2 id="about-heading" class="section-heading">About</h2>

      <div class="settings-card">
        <div class="about-row">
          <span class="about-label">Version</span>
          <span class="about-value">Terra Miner v0.1.0-alpha</span>
        </div>
        <div class="about-row">
          <span class="about-label">Build</span>
          <span class="about-value dim">development</span>
        </div>
        <div class="about-row">
          <span class="about-label">Engine</span>
          <span class="about-value dim">Phaser 3 + Svelte 5</span>
        </div>
      </div>
    </section>

  </div>
</div>

<style>
  .settings-page {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    z-index: 40;
    font-family: 'Courier New', monospace;
    color: var(--color-text);
  }

  /* ---- Header ---- */
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-text-dim) 30%, transparent 70%);
    background: var(--color-surface);
    flex-shrink: 0;
  }

  .settings-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-warning);
    text-transform: uppercase;
    letter-spacing: 2px;
    margin: 0;
  }

  .back-btn {
    border: 0;
    background: transparent;
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 8px;
    transition: color 0.12s, background 0.12s;
  }

  .back-btn:hover,
  .back-btn:focus-visible {
    background: color-mix(in srgb, var(--color-primary) 20%, transparent 80%);
    color: var(--color-text);
  }

  .back-btn:active {
    transform: translateY(1px);
  }

  .header-spacer {
    /* mirrors back button width for centered title */
    width: 64px;
  }

  /* ---- Scrollable content ---- */
  .settings-scroll {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 8px 0 32px;
  }

  /* ---- Sections ---- */
  .settings-section {
    margin: 0 0 4px;
  }

  .section-heading {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--color-text-dim);
    text-transform: uppercase;
    letter-spacing: 2px;
    margin: 16px 16px 6px;
    padding: 0;
  }

  /* ---- Cards ---- */
  .settings-card {
    background: var(--color-surface);
    border-radius: 12px;
    margin: 0 8px;
    padding: 4px 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* ---- Rows ---- */
  .setting-row,
  .setting-block {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
  }

  .setting-block {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .setting-disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-label {
    color: var(--color-text);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .setting-desc {
    color: var(--color-text-dim);
    font-size: 0.78rem;
  }

  .mono {
    font-family: monospace;
    letter-spacing: 0.05em;
  }

  /* ---- Toggle button ---- */
  .setting-toggle {
    border: 0;
    border-radius: 8px;
    background: var(--color-primary);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 8px 14px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .setting-toggle:active {
    transform: translateY(1px);
  }

  /* ---- Note / coming-soon ---- */
  .setting-note {
    margin: 0;
    padding: 4px 16px 12px;
    color: var(--color-text-dim);
    font-size: 0.75rem;
    font-style: italic;
  }

  .coming-soon {
    color: color-mix(in srgb, var(--color-warning) 60%, var(--color-text-dim) 40%);
  }

  /* ---- Mood selector ---- */
  .mood-buttons {
    display: flex;
    gap: 6px;
  }

  .mood-btn {
    flex: 1;
    border: 2px solid transparent;
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-bg) 50%, var(--color-surface) 50%);
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 8px 4px;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .mood-btn:active {
    transform: translateY(1px);
  }

  .mood-active {
    border-color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 18%, var(--color-surface) 82%);
    color: var(--color-warning);
  }

  /* ---- Slider ---- */
  .chattiness-slider {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    cursor: pointer;
    accent-color: var(--color-primary);
    padding: 0;
    border: none;
    background: transparent;
  }

  /* ---- GAIA preview ---- */
  .gaia-preview {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 16px 14px;
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface) 92%);
    border-top: 1px solid color-mix(in srgb, var(--color-text-dim) 15%, transparent 85%);
    border-radius: 0 0 12px 12px;
  }

  .gaia-preview-icon {
    font-size: 1rem;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .gaia-preview-text {
    font-size: 0.8rem;
    color: var(--color-text-dim);
    font-style: italic;
    line-height: 1.4;
  }

  /* ---- Delete save ---- */
  .delete-btn {
    margin: 8px 16px 12px;
    padding: 10px 16px;
    border: 2px solid var(--color-accent, #e05);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-accent, #e05) 10%, var(--color-surface) 90%);
    color: var(--color-accent, #e05);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
    align-self: flex-start;
  }

  .delete-btn:hover {
    background: color-mix(in srgb, var(--color-accent, #e05) 20%, var(--color-surface) 80%);
  }

  .delete-btn:active {
    transform: translateY(1px);
  }

  .delete-confirm {
    margin: 8px 16px 12px;
    padding: 12px;
    border: 2px solid var(--color-accent, #e05);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-accent, #e05) 8%, var(--color-surface) 92%);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .delete-confirm-text {
    margin: 0;
    font-size: 0.82rem;
    color: var(--color-text);
    line-height: 1.4;
  }

  .delete-confirm-buttons {
    display: flex;
    gap: 8px;
  }

  .delete-btn-confirm {
    margin: 0;
    flex: 1;
    font-size: 0.8rem;
  }

  .cancel-btn {
    flex: 1;
    padding: 10px 16px;
    border: 2px solid var(--color-text-dim);
    border-radius: 10px;
    background: transparent;
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
  }

  .cancel-btn:active {
    transform: translateY(1px);
    background: color-mix(in srgb, var(--color-text-dim) 15%, transparent 85%);
  }

  /* ---- About rows ---- */
  .about-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    gap: 12px;
  }

  .about-label {
    font-size: 0.85rem;
    color: var(--color-text-dim);
    font-weight: 600;
  }

  .about-value {
    font-size: 0.85rem;
    color: var(--color-text);
    text-align: right;
  }

  .about-value.dim {
    color: var(--color-text-dim);
  }

  /* ---- Responsive ---- */
  @media (max-width: 520px) {
    .settings-card {
      margin: 0 4px;
    }

    .settings-title {
      font-size: 1rem;
    }
  }
</style>
