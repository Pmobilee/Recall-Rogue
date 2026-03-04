<script lang="ts">
  import { kidModeService } from '../../services/kidModeService'

  export let onClose: (() => void) | undefined = undefined

  let pin = ''
  let confirmPin = ''
  let maxMinutes = 60
  let socialEnabled = false
  let parentEmail = ''
  let error = ''
  let step: 'auth' | 'setup' | 'manage' = kidModeService.isKidMode() ? 'auth' : 'setup'
  let authPin = ''

  const controls = kidModeService.getControls()
  if (controls.enabled) {
    maxMinutes = controls.maxDailyMinutes
    socialEnabled = controls.socialEnabled
    parentEmail = controls.weeklyReportEmail
  }

  function handleAuth(): void {
    if (kidModeService.verifyPin(authPin)) {
      step = 'manage'
      error = ''
    } else {
      error = 'Incorrect PIN'
    }
  }

  function handleSetup(): void {
    error = ''
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      error = 'PIN must be exactly 4 digits'
      return
    }
    if (pin !== confirmPin) {
      error = 'PINs do not match'
      return
    }
    kidModeService.enableKidMode(pin, {
      maxDailyMinutes: maxMinutes,
      socialEnabled,
      weeklyReportEmail: parentEmail,
      ageRating: 'kid'
    })
    if (onClose) onClose()
  }

  function handleDisable(): void {
    kidModeService.disableKidMode(authPin || pin)
    if (onClose) onClose()
  }

  function handleSave(): void {
    kidModeService.saveControls({
      maxDailyMinutes: maxMinutes,
      socialEnabled,
      weeklyReportEmail: parentEmail
    })
    if (onClose) onClose()
  }
</script>

<div class="parental-overlay" role="dialog" aria-label="Parental Controls">
  <div class="parental-panel">
    <div class="panel-header">
      <h2>Parental Controls</h2>
      <button class="close-x" on:click={onClose} aria-label="Close">&times;</button>
    </div>

    {#if step === 'auth'}
      <p class="auth-text">Enter your 4-digit PIN to access parental controls.</p>
      <input type="password" maxlength="4" inputmode="numeric" pattern="[0-9]*" bind:value={authPin} placeholder="Enter PIN" class="pin-input" />
      {#if error}<p class="error">{error}</p>{/if}
      <button class="primary-btn" on:click={handleAuth}>Unlock</button>

    {:else if step === 'setup'}
      <p class="setup-text">Set up a 4-digit PIN to protect these settings from children.</p>

      <label class="field">
        Create PIN
        <input type="password" maxlength="4" inputmode="numeric" pattern="[0-9]*" bind:value={pin} placeholder="4-digit PIN" class="pin-input" />
      </label>
      <label class="field">
        Confirm PIN
        <input type="password" maxlength="4" inputmode="numeric" pattern="[0-9]*" bind:value={confirmPin} placeholder="Repeat PIN" class="pin-input" />
      </label>
      <label class="field">
        Daily Time Limit (minutes)
        <input type="number" min="0" max="480" bind:value={maxMinutes} />
        <span class="hint">0 = no limit</span>
      </label>
      <label class="toggle-field">
        <input type="checkbox" bind:checked={socialEnabled} />
        Allow social features (hub visiting, trading)
      </label>
      <label class="field">
        Parent Email (for weekly reports)
        <input type="email" bind:value={parentEmail} placeholder="parent@email.com" />
      </label>

      {#if error}<p class="error">{error}</p>{/if}
      <button class="primary-btn" on:click={handleSetup}>Enable Kid Mode</button>

    {:else}
      <label class="field">
        Daily Time Limit (minutes)
        <input type="number" min="0" max="480" bind:value={maxMinutes} />
      </label>
      <label class="toggle-field">
        <input type="checkbox" bind:checked={socialEnabled} />
        Allow social features
      </label>
      <label class="field">
        Parent Email
        <input type="email" bind:value={parentEmail} placeholder="parent@email.com" />
      </label>

      <div class="manage-actions">
        <button class="primary-btn" on:click={handleSave}>Save Changes</button>
        <button class="danger-btn" on:click={handleDisable}>Disable Kid Mode</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .parental-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    pointer-events: auto;
    padding: 20px;
  }
  .parental-panel {
    background: #16213e;
    border-radius: 10px;
    padding: 24px;
    max-width: 360px;
    width: 100%;
    border: 1px solid #0f3460;
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .panel-header h2 {
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #e94560;
    margin: 0;
  }
  .close-x {
    background: none;
    border: none;
    color: #888;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
  }
  .auth-text, .setup-text {
    color: #a0a0a0;
    font-size: 12px;
    margin: 0 0 16px;
    line-height: 1.5;
  }
  .field {
    display: block;
    color: #ccc;
    font-size: 12px;
    margin-bottom: 14px;
    font-weight: bold;
  }
  .pin-input, input[type="number"], input[type="email"] {
    display: block;
    width: 100%;
    background: #0f3460;
    border: 1px solid #1a3a6e;
    color: #e0e0e0;
    padding: 10px;
    border-radius: 4px;
    font-size: 14px;
    margin-top: 4px;
    box-sizing: border-box;
  }
  .pin-input {
    text-align: center;
    font-size: 20px;
    letter-spacing: 8px;
    max-width: 180px;
  }
  .hint {
    font-size: 10px;
    color: #666;
    font-weight: normal;
  }
  .toggle-field {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #ccc;
    font-size: 12px;
    margin-bottom: 14px;
    cursor: pointer;
  }
  .toggle-field input {
    accent-color: #e94560;
  }
  .error {
    color: #e94560;
    font-size: 11px;
    margin: 8px 0;
  }
  .primary-btn {
    display: block;
    width: 100%;
    background: #e94560;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 6px;
    font-family: 'Press Start 2P', monospace;
    font-size: 11px;
    cursor: pointer;
    margin-top: 8px;
  }
  .danger-btn {
    display: block;
    width: 100%;
    background: transparent;
    color: #e94560;
    border: 1px solid #e94560;
    padding: 10px;
    border-radius: 6px;
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    cursor: pointer;
    margin-top: 8px;
  }
  .manage-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }
</style>
