<script lang="ts">
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { deleteSave } from '../../services/saveService'
  import {
    spriteResolution,
    setSpriteResolution,
    gaiaMood,
    gaiaChattiness,
    showExplanations,
    musicVolume,
    sfxVolume,
    musicEnabled,
    sfxEnabled,
    highContrastQuiz,
    reducedMotion,
    deviceTierOverride,
    getDeviceTier,
    type GaiaMood,
    type SpriteResolution,
    type DeviceTier,
  } from '../stores/settings'
  import { getTierLabel } from '../../services/deviceTierService'
  import { audioManager } from '../../services/audioService'
  import { GAIA_IDLE_QUIPS } from '../../data/gaiaDialogue'
  import { GAIA_NAME } from '../../data/gaiaAvatar'
  import { currentScreen } from '../stores/gameState'

  import { authStore } from '../stores/authStore'
  import LanguageSelector from './LanguageSelector.svelte'
  import { locale, LOCALE_META } from '../../i18n'
  import { t } from '../../i18n'
  import { parentalStore, setPin } from '../stores/parentalStore'
  import ParentalPinGate from './ParentalPinGate.svelte'
  import ParentalControlsPanel from './ParentalControlsPanel.svelte'
  import ClassJoinPanel from './ClassJoinPanel.svelte'

  interface Props {
    /** Called when the user taps the Back button. */
    onBack: () => void
    /** Optional — called when user taps "Account / Profile". Opens the auth profile screen. */
    onViewProfile?: () => void
    /** Optional — called when user taps "Log Out" from settings. */
    onLogout?: () => void
  }

  let { onBack, onViewProfile, onLogout }: Props = $props()

  /** True when the user is logged in (shows "Account" option). */
  const loggedIn = $derived($authStore.isLoggedIn)

  // Delete-save confirmation state
  let showDeleteConfirm = $state(false)

  // Language selector state
  let showLanguageSelector = $state(false)

  // Parental controls state
  let showParentalPinGate = $state(false)
  let showParentalPanel = $state(false)
  let showSetPinFlow = $state(false)
  let newPinEntry = $state('')
  let newPinConfirm = $state('')
  let newPinError = $state('')

  const hasParentalPin = $derived($parentalStore.pinHash !== null)

  async function handleOpenParentalControls(): Promise<void> {
    if (hasParentalPin) {
      showParentalPinGate = true
    } else {
      // No PIN set yet — show set-PIN flow first
      showSetPinFlow = true
    }
  }

  async function handleSetPinSave(): Promise<void> {
    newPinError = ''
    if (newPinEntry.length < 4) {
      newPinError = 'PIN must be at least 4 digits.'
      return
    }
    if (newPinEntry !== newPinConfirm) {
      newPinError = 'PINs do not match.'
      newPinConfirm = ''
      return
    }
    await setPin(newPinEntry)
    newPinEntry = ''
    newPinConfirm = ''
    showSetPinFlow = false
    showParentalPanel = true
  }

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

  function handleMusicVolumeChange(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value)
    musicVolume.set(isNaN(val) ? 0.6 : Math.max(0, Math.min(1, val)))
  }

  function handleSfxVolumeChange(e: Event): void {
    const val = parseFloat((e.target as HTMLInputElement).value)
    sfxVolume.set(isNaN(val) ? 0.8 : Math.max(0, Math.min(1, val)))
    audioManager.setVolume(isNaN(val) ? 0.8 : Math.max(0, Math.min(1, val)))
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

  // Privacy settings derived values
  const hubPrivate = $derived($playerSave?.hubPrivate ?? false)
  const leaderboardOptOut = $derived($playerSave?.leaderboardOptOut ?? false)

  /** Toggle whether the player's hub is private. */
  function handleHubPrivateToggle(): void {
    playerSave.update(s => s ? { ...s, hubPrivate: !s.hubPrivate } : s)
    persistPlayer()
  }

  /** Toggle whether the player is hidden from leaderboards. */
  function handleLeaderboardOptOutToggle(): void {
    playerSave.update(s => s ? { ...s, leaderboardOptOut: !s.leaderboardOptOut } : s)
    persistPlayer()
  }
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

        <!-- Show explanations after quiz -->
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Show explanations after quiz</span>
            <span class="setting-desc">GAIA explains wrong answers to help retention</span>
          </div>
          <input
            type="checkbox"
            class="setting-checkbox"
            bind:checked={$showExplanations}
            aria-label="Show explanations after quiz"
          />
        </div>
      </div>
    </section>

    <!-- ===== LEARNING SETTINGS ===== -->
    <section class="settings-section" aria-labelledby="learning-heading">
      <h2 id="learning-heading" class="section-heading">Learning</h2>

      <div class="settings-card">
        <div class="setting-block">
          <button
            class="interest-link-btn"
            onclick={() => currentScreen.set('interestSettings')}
          >
            Interest Settings &rarr;
          </button>
          <p style="font-size: 0.55rem; color: #888; margin: 4px 0 0 0;">
            Choose what topics appear in your mine
          </p>
        </div>

        <!-- hidden until implemented
        <div class="setting-row coming-soon-row">
          <div class="setting-info">
            <span class="setting-label">Language Learning</span>
            <span class="setting-desc">Change or disable target language</span>
          </div>
          <span class="coming-soon-badge">Coming Soon</span>
        </div>

        <div class="setting-row coming-soon-row">
          <div class="setting-info">
            <span class="setting-label">Fact Learning</span>
            <span class="setting-desc">Toggle fact quizzes on/off</span>
          </div>
          <span class="coming-soon-badge">Coming Soon</span>
        </div>
        -->
      </div>
    </section>

    <!-- hidden until implemented
    <section class="settings-section" aria-labelledby="notif-heading">
      <h2 id="notif-heading" class="section-heading">Notifications</h2>

      <div class="settings-card">
        <div class="setting-row coming-soon-row">
          <div class="setting-info">
            <span class="setting-label">Review Reminders</span>
            <span class="setting-desc">Daily notifications when facts are due</span>
          </div>
          <span class="coming-soon-badge">Coming Soon</span>
        </div>

        <div class="setting-row coming-soon-row">
          <div class="setting-info">
            <span class="setting-label">Dive Reminders</span>
            <span class="setting-desc">Reminder to dive each day</span>
          </div>
          <span class="coming-soon-badge">Coming Soon</span>
        </div>
      </div>
    </section>
    -->

    <!-- ===== AUDIO SETTINGS (Phase 17.2) ===== -->
    <section class="settings-section" aria-labelledby="audio-heading">
      <h2 id="audio-heading" class="section-heading">Audio</h2>

      <div class="settings-card">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Music</span>
            <span class="setting-desc">{$musicEnabled ? 'On' : 'Off'}</span>
          </div>
          <input
            type="checkbox"
            class="setting-checkbox"
            bind:checked={$musicEnabled}
            aria-label="Music enabled"
          />
        </div>
        <div class="setting-block" aria-label="Music Volume">
          <div class="setting-info">
            <span class="setting-label">Music Volume</span>
            <span class="setting-desc">{Math.round($musicVolume * 100)}%</span>
          </div>
          <input class="chattiness-slider" type="range" min="0" max="1" step="0.05" value={$musicVolume} oninput={handleMusicVolumeChange} aria-label="Music volume" />
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Sound Effects</span>
            <span class="setting-desc">{$sfxEnabled ? 'On' : 'Off'}</span>
          </div>
          <input
            type="checkbox"
            class="setting-checkbox"
            bind:checked={$sfxEnabled}
            aria-label="Sound effects enabled"
          />
        </div>
        <div class="setting-block" aria-label="SFX Volume">
          <div class="setting-info">
            <span class="setting-label">SFX Volume</span>
            <span class="setting-desc">{Math.round($sfxVolume * 100)}%</span>
          </div>
          <input class="chattiness-slider" type="range" min="0" max="1" step="0.05" value={$sfxVolume} oninput={handleSfxVolumeChange} aria-label="SFX volume" />
        </div>
      </div>
    </section>

    <!-- ===== ACCESSIBILITY SETTINGS (Phase 20.5) ===== -->
    <section class="settings-section" aria-labelledby="accessibility-heading">
      <h2 id="accessibility-heading" class="section-heading">Accessibility</h2>

      <div class="settings-card">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">High contrast quiz</span>
            <span class="setting-desc">Stronger contrast for quiz answer choices</span>
          </div>
          <input
            type="checkbox"
            class="setting-checkbox"
            bind:checked={$highContrastQuiz}
            aria-label="High contrast quiz mode"
          />
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Reduced motion</span>
            <span class="setting-desc">Disables animations throughout the game</span>
          </div>
          <input
            type="checkbox"
            class="setting-checkbox"
            bind:checked={$reducedMotion}
            aria-label="Reduced motion mode"
          />
        </div>
      </div>
    </section>

    <!-- ===== LANGUAGE SETTINGS ===== -->
    <section class="settings-section" aria-labelledby="language-heading">
      <h2 id="language-heading" class="section-heading">{$t('settings.language.title')}</h2>

      <div class="settings-card">
        <button
          class="setting-row language-row"
          type="button"
          onclick={() => { showLanguageSelector = true }}
          aria-label={$t('settings.language.ui_language')}
        >
          <div class="setting-info">
            <span class="setting-label">{$t('settings.language.ui_language')}</span>
          </div>
          <span class="row-value">
            {LOCALE_META[$locale].flag} {LOCALE_META[$locale].nativeName}
          </span>
        </button>
      </div>
    </section>

    <!-- ===== PRIVACY SETTINGS ===== -->
    <section class="settings-section" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading" class="section-heading">Privacy</h2>

      <div class="settings-card">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Hub Private</span>
            <span class="setting-desc">Hide your dome from other players' visits</span>
          </div>
          <input
            type="checkbox"
            class="setting-checkbox"
            checked={hubPrivate}
            onchange={handleHubPrivateToggle}
            aria-label="Hub private — hide dome from visitors"
          />
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Hide from Leaderboards</span>
            <span class="setting-desc">Your scores won't appear in public rankings</span>
          </div>
          <input
            type="checkbox"
            class="setting-checkbox"
            checked={leaderboardOptOut}
            onchange={handleLeaderboardOptOutToggle}
            aria-label="Hide from leaderboards"
          />
        </div>
      </div>
    </section>

    <!-- ===== PARENTAL CONTROLS (Phase 45) ===== -->
    <section class="settings-section" aria-labelledby="parental-heading">
      <h2 id="parental-heading" class="section-heading">Parental Controls</h2>
      <div class="settings-card">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Parental Controls</span>
            <span class="setting-desc">
              {hasParentalPin ? 'PIN protected' : 'Not set up'}
            </span>
          </div>
          <button class="setting-toggle" type="button" onclick={handleOpenParentalControls}>
            {hasParentalPin ? 'Open' : 'Set Up'}
          </button>
        </div>
      </div>
    </section>

    <!-- ===== CLASSROOM (Phase 44) ===== -->
    {#if $authStore.isLoggedIn}
      <section class="settings-section" aria-labelledby="classroom-heading">
        <h2 id="classroom-heading" class="section-heading">Classroom</h2>
        <div class="settings-card">
          <ClassJoinPanel />
        </div>
      </section>
    {/if}

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

        {#if onViewProfile}
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Online Account</span>
              <span class="setting-desc">
                {loggedIn ? $authStore.email ?? 'Logged in' : 'Guest mode'}
              </span>
            </div>
            <button class="setting-toggle" type="button" onclick={onViewProfile}>
              {loggedIn ? 'Manage' : 'Sign In'}
            </button>
          </div>
        {/if}

        {#if loggedIn && onLogout}
          <button
            class="logout-btn"
            type="button"
            onclick={onLogout}
            data-testid="btn-logout"
          >
            Log Out
          </button>
        {/if}

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

    <!-- ===== PERFORMANCE SETTINGS (Phase 28) ===== -->
    <section class="settings-section" aria-labelledby="performance-heading">
      <h2 id="performance-heading" class="section-heading">Performance</h2>

      <div class="settings-card">
        <p class="setting-note">Auto-detected: {getTierLabel(getDeviceTier())}</p>
        <div class="setting-block" aria-label="Quality Preset">
          <div class="setting-info">
            <span class="setting-label">Quality Preset</span>
            <span class="setting-desc">Controls particles, textures, and animations</span>
          </div>
          <select
            class="setting-select"
            value={$deviceTierOverride ?? ''}
            onchange={(e) => {
              const val = (e.target as HTMLSelectElement).value
              deviceTierOverride.set(val === '' ? null : val as DeviceTier)
            }}
            aria-label="Quality preset selection"
          >
            <option value="">Auto ({getTierLabel(getDeviceTier())})</option>
            <option value="low-end">{getTierLabel('low-end')}</option>
            <option value="mid">{getTierLabel('mid')}</option>
            <option value="flagship">{getTierLabel('flagship')}</option>
          </select>
        </div>
        <p class="setting-note">Changes apply after restarting the game.</p>
      </div>
    </section>

    <!-- ===== ABOUT ===== -->
    <section class="settings-section" aria-labelledby="about-heading">
      <h2 id="about-heading" class="section-heading">About</h2>

      <div class="settings-card">
        <div class="about-row">
          <span class="about-label">Version</span>
          <span class="about-value">Terra Gacha v0.1.0-alpha</span>
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

{#if showLanguageSelector}
  <LanguageSelector onClose={() => { showLanguageSelector = false }} />
{/if}

{#if showParentalPinGate}
  <ParentalPinGate
    purpose="Access Parental Controls"
    onSuccess={() => { showParentalPinGate = false; showParentalPanel = true }}
    onCancel={() => { showParentalPinGate = false }}
  />
{/if}

{#if showSetPinFlow}
  <div class="set-pin-overlay" role="dialog" aria-modal="true" aria-labelledby="set-pin-title">
    <div class="set-pin-card">
      <h2 id="set-pin-title" class="set-pin-heading">Set Parental PIN</h2>
      <p class="set-pin-hint">Create a 4–6 digit PIN to protect parental settings.</p>
      <input
        class="set-pin-input"
        type="password"
        inputmode="numeric"
        maxlength="6"
        placeholder="New PIN"
        bind:value={newPinEntry}
        aria-label="New parental PIN"
      />
      <input
        class="set-pin-input"
        type="password"
        inputmode="numeric"
        maxlength="6"
        placeholder="Confirm PIN"
        bind:value={newPinConfirm}
        onkeydown={(e) => e.key === 'Enter' && handleSetPinSave()}
        aria-label="Confirm parental PIN"
      />
      {#if newPinError}
        <p class="set-pin-error" role="alert">{newPinError}</p>
      {/if}
      <div class="set-pin-actions">
        <button class="set-pin-cancel" type="button" onclick={() => { showSetPinFlow = false; newPinEntry = ''; newPinConfirm = ''; newPinError = '' }}>Cancel</button>
        <button class="set-pin-save" type="button" onclick={handleSetPinSave} disabled={newPinEntry.length < 4}>Save PIN</button>
      </div>
    </div>
  </div>
{/if}

{#if showParentalPanel}
  <div class="parental-panel-overlay" role="dialog" aria-modal="true">
    <ParentalControlsPanel onClose={() => { showParentalPanel = false }} />
  </div>
{/if}

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

  /* ---- Checkbox ---- */
  .setting-checkbox {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    accent-color: var(--color-primary);
    cursor: pointer;
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

  /* ---- Log out ---- */
  .logout-btn {
    margin: 8px 16px 4px;
    padding: 10px 16px;
    border: 2px solid var(--color-warning, #f0b84c);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-warning, #f0b84c) 10%, var(--color-surface) 90%);
    color: var(--color-warning, #f0b84c);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.12s;
    align-self: flex-start;
  }

  .logout-btn:hover {
    background: color-mix(in srgb, var(--color-warning, #f0b84c) 20%, var(--color-surface) 80%);
  }

  .logout-btn:active {
    transform: translateY(1px);
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

  .interest-link-btn {
    width: 100%;
    min-height: 44px;
    padding: 10px 16px;
    background: #1a3a2e;
    border: 1px solid #4ecca3;
    border-radius: 8px;
    color: #4ecca3;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.65rem;
    cursor: pointer;
    text-align: left;
  }
  .interest-link-btn:hover {
    background: #2a4a3e;
  }

  /* ---- Language row ---- */
  .language-row {
    width: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    color: var(--color-text);
    text-align: left;
  }

  .language-row:hover {
    background: color-mix(in srgb, var(--color-primary) 20%, transparent 80%);
  }

  .row-value {
    font-size: 0.85rem;
    color: var(--color-text-dim);
    flex-shrink: 0;
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

  /* ---- Parental Controls — set-PIN overlay ---- */
  .set-pin-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9200;
    padding: 20px;
  }

  .set-pin-card {
    background: var(--color-surface);
    border-radius: 16px;
    padding: 24px 20px;
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .set-pin-heading {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-warning);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 0;
    text-align: center;
  }

  .set-pin-hint {
    font-size: 0.8rem;
    color: var(--color-text-dim);
    margin: 0;
    text-align: center;
    line-height: 1.4;
  }

  .set-pin-input {
    width: 100%;
    box-sizing: border-box;
    padding: 12px 14px;
    border-radius: 10px;
    border: 2px solid color-mix(in srgb, var(--color-text-dim) 40%, transparent 60%);
    background: var(--color-bg);
    color: var(--color-text);
    font-family: inherit;
    font-size: 1.1rem;
    text-align: center;
    letter-spacing: 4px;
    transition: border-color 0.15s;
  }

  .set-pin-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .set-pin-error {
    font-size: 0.78rem;
    color: var(--color-accent, #e05);
    margin: 0;
    text-align: center;
  }

  .set-pin-actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }

  .set-pin-cancel {
    flex: 1;
    padding: 11px 14px;
    border: 2px solid var(--color-text-dim);
    border-radius: 10px;
    background: transparent;
    color: var(--color-text-dim);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.12s;
  }

  .set-pin-cancel:active {
    background: color-mix(in srgb, var(--color-text-dim) 15%, transparent 85%);
  }

  .set-pin-save {
    flex: 1;
    padding: 11px 14px;
    border: 0;
    border-radius: 10px;
    background: var(--color-primary);
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.12s;
  }

  .set-pin-save:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .set-pin-save:not(:disabled):active {
    transform: translateY(1px);
  }

  /* ---- Parental Controls — full panel overlay ---- */
  .parental-panel-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: stretch;
    justify-content: center;
    z-index: 9150;
    overflow-y: auto;
  }

  /* ---- Performance quality select ---- */
  .setting-select {
    border: 1px solid var(--color-border, rgba(255,255,255,0.15));
    border-radius: 8px;
    background: var(--color-surface, rgba(255,255,255,0.08));
    color: var(--color-text, #fff);
    font-family: inherit;
    font-size: 0.82rem;
    padding: 8px 10px;
    cursor: pointer;
    flex-shrink: 0;
  }
</style>
