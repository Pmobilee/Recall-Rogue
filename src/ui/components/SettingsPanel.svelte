<script lang="ts">
  import {
    difficultyMode,
    highContrastMode,
    isSlowReader,
    reduceMotionMode,
    textSize,
    onboardingState,
    getDifficultyDisplayName,
    type DifficultyMode,
    type TextSize,
  } from '../../services/cardPreferences'
  import { STORY_MODE_FORCED_RUNS } from '../../data/balance'
  import {
    sfxEnabled,
    musicEnabled,
    sfxVolume,
    musicVolume,
    unlockCardAudio,
    playCardAudio,
  } from '../../services/cardAudioManager'
  import { analyticsService } from '../../services/analyticsService'
  import AccountSettings from './AccountSettings.svelte'
  import FeedbackButton from './FeedbackButton.svelte'
  import ParentalControlsPanel from './ParentalControlsPanel.svelte'
  import LanguageModePanel from './LanguageModePanel.svelte'
  import { languageMode, languageService } from '../../services/languageService'
  import {
    getNotificationPreferences,
    setNotificationPreferences,
    type NotificationPreferences,
  } from '../../services/notificationService'

  interface Props {
    onback: () => void
  }

  let { onback }: Props = $props()
  let showParentalControls = $state(false)
  let showLanguageModePanel = $state(false)

  // Notification preferences — loaded once on mount, written back on toggle.
  let notifPrefs = $state<NotificationPreferences>(getNotificationPreferences())

  function updateNotifPref<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]): void {
    notifPrefs[key] = value
    setNotificationPreferences({ [key]: value })
    trackSettingChange(`notification_${key}`, value)
  }

  let runsCompleted = $state(0)
  $effect(() => {
    const unsub = onboardingState.subscribe((s) => { runsCompleted = s.runsCompleted })
    return () => unsub()
  })
  let difficultyLocked = $derived(runsCompleted < STORY_MODE_FORCED_RUNS)
  let selectedLanguage = $derived(
    $languageMode.language
      ? languageService.getSupportedLanguages().find((lang) => lang.code === $languageMode.language) ?? null
      : null,
  )
  let languageModeSummary = $derived(
    $languageMode.enabled && selectedLanguage
      ? `${selectedLanguage.name} • ${$languageMode.level}`
      : 'Disabled',
  )

  const difficultyOptions: DifficultyMode[] = ['relaxed', 'normal']
  const textSizeOptions: TextSize[] = ['small', 'medium', 'large']

  function setDifficulty(mode: DifficultyMode): void {
    difficultyMode.set(mode)
    unlockCardAudio()
    playCardAudio('card-cast')
  }

  function setTextScale(size: TextSize): void {
    textSize.set(size)
    unlockCardAudio()
    playCardAudio('card-cast')
  }

  function trackSettingChange(setting: string, value: string | number | boolean): void {
    analyticsService.track({
      name: 'settings_change',
      properties: {
        setting,
        value,
      },
    })
  }

  function formatDifficulty(mode: DifficultyMode): string {
    return getDifficultyDisplayName(mode)
  }

  function formatTextSize(size: TextSize): string {
    if (size === 'small') return 'Small'
    if (size === 'large') return 'Large'
    return 'Medium'
  }
</script>

<div class="settings-overlay">
  <div class="settings-card">
    <div class="settings-header">
      <h2>Settings</h2>
      <button class="back-btn" onclick={onback}>Back</button>
    </div>

    <section class="settings-section">
      <h3>Difficulty</h3>
      {#if difficultyLocked}
        <p class="difficulty-lock-note">Relaxed Mode is active for your first {STORY_MODE_FORCED_RUNS} runs.</p>
      {/if}
      <div class="chip-row">
        {#each difficultyOptions as mode}
          <button
            class="chip"
            class:selected={$difficultyMode === mode}
            onclick={() => setDifficulty(mode)}
            disabled={difficultyLocked && mode !== 'relaxed'}
          >
            {formatDifficulty(mode)}
          </button>
        {/each}
      </div>
    </section>

    <section class="settings-section">
      <h3>Accessibility</h3>
      <div class="chip-row">
        {#each textSizeOptions as size}
          <button
            class="chip"
            class:selected={$textSize === size}
            onclick={() => setTextScale(size)}
          >
            {formatTextSize(size)}
          </button>
        {/each}
      </div>

      <label class="toggle-row">
        <span>High Contrast</span>
        <input
          type="checkbox"
          bind:checked={$highContrastMode}
          onchange={(event) => trackSettingChange('highContrastMode', (event.currentTarget as HTMLInputElement).checked)}
        />
      </label>

      <label class="toggle-row">
        <span>Reduce Motion</span>
        <input
          type="checkbox"
          bind:checked={$reduceMotionMode}
          onchange={(event) => trackSettingChange('reduceMotionMode', (event.currentTarget as HTMLInputElement).checked)}
        />
      </label>

      <label class="toggle-row">
        <span>Slow Reader (+3s)</span>
        <input
          type="checkbox"
          bind:checked={$isSlowReader}
          onchange={(event) => trackSettingChange('slowReader', (event.currentTarget as HTMLInputElement).checked)}
        />
      </label>
    </section>

    <section class="settings-section">
      <h3>Audio</h3>
      <label class="toggle-row">
        <span>SFX Enabled</span>
        <input
          type="checkbox"
          bind:checked={$sfxEnabled}
          onchange={(event) => trackSettingChange('sfxEnabled', (event.currentTarget as HTMLInputElement).checked)}
        />
      </label>

      <label class="slider-row">
        <span>SFX Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          bind:value={$sfxVolume}
          onchange={(event) => trackSettingChange('sfxVolume', Number((event.currentTarget as HTMLInputElement).value))}
        />
        <strong>{Math.round($sfxVolume * 100)}%</strong>
      </label>

      <label class="toggle-row">
        <span>Music Enabled</span>
        <input
          type="checkbox"
          bind:checked={$musicEnabled}
          onchange={(event) => trackSettingChange('musicEnabled', (event.currentTarget as HTMLInputElement).checked)}
        />
      </label>

      <label class="slider-row">
        <span>Music Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          bind:value={$musicVolume}
          onchange={(event) => trackSettingChange('musicVolume', Number((event.currentTarget as HTMLInputElement).value))}
        />
        <strong>{Math.round($musicVolume * 100)}%</strong>
      </label>
    </section>

    <section class="settings-section">
      <h3>Notifications</h3>
      <label class="toggle-row">
        <span>Push Notifications</span>
        <input
          type="checkbox"
          checked={notifPrefs.enabled}
          onchange={(event) => updateNotifPref('enabled', (event.currentTarget as HTMLInputElement).checked)}
        />
      </label>

      {#if notifPrefs.enabled}
        <label class="toggle-row">
          <span>Streak Reminders</span>
          <input
            type="checkbox"
            checked={notifPrefs.streakReminders}
            onchange={(event) => updateNotifPref('streakReminders', (event.currentTarget as HTMLInputElement).checked)}
          />
        </label>

        <label class="toggle-row">
          <span>Review Reminders</span>
          <input
            type="checkbox"
            checked={notifPrefs.reviewReminders}
            onchange={(event) => updateNotifPref('reviewReminders', (event.currentTarget as HTMLInputElement).checked)}
          />
        </label>

        <label class="toggle-row">
          <span>Milestone Alerts</span>
          <input
            type="checkbox"
            checked={notifPrefs.milestoneAlerts}
            onchange={(event) => updateNotifPref('milestoneAlerts', (event.currentTarget as HTMLInputElement).checked)}
          />
        </label>

        <label class="toggle-row">
          <span>Win-back Messages</span>
          <input
            type="checkbox"
            checked={notifPrefs.winbackMessages}
            onchange={(event) => updateNotifPref('winbackMessages', (event.currentTarget as HTMLInputElement).checked)}
          />
        </label>
      {/if}
    </section>

    <section class="settings-section">
      <h3>Language Learning</h3>
      <p class="language-summary">Language Mode: {languageModeSummary}</p>
      <button
        type="button"
        class="back-btn"
        aria-label="Language Mode"
        onclick={() => { showLanguageModePanel = true }}
      >
        Configure Language Mode
      </button>
    </section>

    <AccountSettings />
    <FeedbackButton />

    <section class="settings-section">
      <h3>Family</h3>
      <button
        type="button"
        class="back-btn"
        aria-label="Parental Controls"
        onclick={() => { showParentalControls = true }}
      >
        Parental Controls
      </button>
    </section>
  </div>
</div>

{#if showParentalControls}
  <ParentalControlsPanel onClose={() => { showParentalControls = false }} />
{/if}

{#if showLanguageModePanel}
  <LanguageModePanel onClose={() => { showLanguageModePanel = false }} />
{/if}

<style>
  .settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(5, 9, 16, 0.88);
    display: grid;
    place-items: center;
    padding: 16px;
    z-index: 260;
  }

  .settings-card {
    width: min(460px, 100%);
    max-height: calc(100vh - 32px);
    overflow: auto;
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.4);
    background: #111c2b;
    color: #e2e8f0;
    padding: 16px;
    display: grid;
    gap: 14px;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h2 {
    margin: 0;
    font-size: calc(20px * var(--text-scale, 1));
  }

  h3 {
    margin: 0 0 10px;
    font-size: calc(14px * var(--text-scale, 1));
    letter-spacing: 0.4px;
    color: #93c5fd;
  }

  .settings-section {
    background: rgba(15, 23, 42, 0.76);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    padding: 12px;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }

  .chip {
    border: 1px solid #334155;
    background: #1f2c42;
    color: #cbd5e1;
    padding: 10px 12px;
    min-height: 48px;
    border-radius: 10px;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .chip.selected {
    border-color: #38bdf8;
    background: #0f2942;
    color: #f8fafc;
  }

  .chip:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .difficulty-lock-note {
    font-size: calc(11px * var(--text-scale, 1));
    color: #f59e0b;
    margin: 0 0 8px;
    line-height: 1.3;
  }

  .back-btn {
    border: 1px solid #4b5563;
    background: #1f2937;
    color: #e5e7eb;
    min-height: 48px;
    border-radius: 10px;
    padding: 0 14px;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .toggle-row,
  .slider-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    font-size: calc(12px * var(--text-scale, 1));
    color: #dbeafe;
  }

  .slider-row {
    grid-template-columns: 130px 1fr auto;
  }

  input[type='checkbox'] {
    width: 20px;
    height: 20px;
  }

  input[type='range'] {
    width: 100%;
  }

  strong {
    min-width: 52px;
    text-align: right;
    color: #f8fafc;
  }

  .language-summary {
    margin: 0 0 10px;
    color: #cbd5e1;
    font-size: calc(12px * var(--text-scale, 1));
  }
</style>
