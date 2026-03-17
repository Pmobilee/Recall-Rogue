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
  import {
    getNotificationPreferences,
    setNotificationPreferences,
    type NotificationPreferences,
  } from '../../services/notificationService'
  import { isLandscape } from '../../stores/layoutStore'

  interface Props {
    onback: () => void
  }

  let { onback }: Props = $props()

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

  type SettingsCategory = 'audio' | 'accessibility' | 'notifications' | 'account'
  let activeCategory = $state<SettingsCategory>('audio')

  const categories: { id: SettingsCategory; label: string }[] = [
    { id: 'audio', label: 'Audio' },
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'account', label: 'Account' },
  ]

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') onback()
  }
</script>

{#if $isLandscape}
<!-- LANDSCAPE: sidebar + panel two-column layout -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="settings-overlay" role="presentation" onkeydown={handleKeydown}>
  <div class="settings-card settings-card-landscape">
    <aside class="settings-sidebar">
      <div class="settings-sidebar-header">
        <h2>Settings</h2>
        <button class="back-btn" onclick={onback}>Back</button>
      </div>
      <nav class="category-nav">
        {#each categories as cat}
          <button
            class="category-btn"
            class:active={activeCategory === cat.id}
            onclick={() => { activeCategory = cat.id }}
          >{cat.label}</button>
        {/each}
      </nav>
    </aside>

    <div class="settings-panel-content">
      {#if activeCategory === 'audio'}
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

      {:else if activeCategory === 'accessibility'}
        <section class="settings-section">
          <h3>Accessibility</h3>
          <div class="chip-row">
            {#each textSizeOptions as size}
              <button
                class="chip"
                class:selected={$textSize === size}
                onclick={() => setTextScale(size)}
              >{formatTextSize(size)}</button>
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

      {:else if activeCategory === 'notifications'}
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

      {:else if activeCategory === 'account'}
        <section class="settings-section">
          <h3>Account</h3>
          <AccountSettings />
          <FeedbackButton />
        </section>
      {/if}
    </div>
  </div>
</div>

{:else}
<!-- PORTRAIT: original layout, pixel-identical -->
<div class="settings-overlay">
  <div class="settings-card">
    <div class="settings-header">
      <h2>Settings</h2>
      <button class="back-btn" onclick={onback}>Back</button>
    </div>

    {#if false}
    <section class="settings-section">
      <h3>Difficulty</h3>
      {#if difficultyLocked}
        <p class="difficulty-lock-note">Normal mode is unlocked after your first run</p>
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
    {/if}

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

    <AccountSettings />
    <FeedbackButton />
  </div>
</div>
{/if}

<style>
  .settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(5, 9, 16, 0.88);
    display: grid;
    place-items: center;
    padding: 0;
    z-index: 260;
  }

  .settings-card {
    width: 100%;
    max-height: 100vh;
    overflow: auto;
    border-radius: 0;
    border: none;
    background: #111c2b;
    color: #e2e8f0;
    padding: calc(16px * var(--layout-scale, 1));
    display: grid;
    gap: calc(14px * var(--layout-scale, 1));
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
    margin: 0 0 calc(10px * var(--layout-scale, 1));
    font-size: calc(14px * var(--text-scale, 1));
    letter-spacing: 0.4px;
    color: #93c5fd;
  }

  .settings-section {
    background: rgba(15, 23, 42, 0.76);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 12px;
    padding: calc(12px * var(--layout-scale, 1));
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: calc(8px * var(--layout-scale, 1));
    margin-bottom: calc(10px * var(--layout-scale, 1));
  }

  .chip {
    border: 1px solid #334155;
    background: #1f2c42;
    color: #cbd5e1;
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
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
    margin: 0 0 calc(8px * var(--layout-scale, 1));
    line-height: 1.3;
  }

  .back-btn {
    border: 1px solid #4b5563;
    background: #1f2937;
    color: #e5e7eb;
    min-height: 48px;
    border-radius: 10px;
    padding: 0 calc(14px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
  }

  .toggle-row,
  .slider-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    min-height: 48px;
    font-size: calc(12px * var(--text-scale, 1));
    color: #dbeafe;
  }

  .slider-row {
    grid-template-columns: calc(130px * var(--layout-scale, 1)) 1fr auto;
  }

  input[type='checkbox'] {
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
  }

  input[type='range'] {
    width: 100%;
  }

  strong {
    min-width: calc(52px * var(--layout-scale, 1));
    text-align: right;
    color: #f8fafc;
  }

  /* ── Landscape Styles ── */

  .settings-card-landscape {
    display: grid;
    grid-template-columns: 200px 1fr;
    grid-template-rows: 1fr;
    gap: 0;
    padding: 0;
    height: 100vh;
    max-height: 100vh;
    overflow: hidden;
  }

  .settings-sidebar {
    background: #0d1a2b;
    border-right: 1px solid rgba(148, 163, 184, 0.15);
    display: flex;
    flex-direction: column;
    padding: calc(20px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    gap: calc(8px * var(--layout-scale, 1));
  }

  .settings-sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: calc(16px * var(--layout-scale, 1));
    padding-bottom: calc(12px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  }

  .category-nav {
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
  }

  .category-btn {
    text-align: left;
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: #8b949e;
    font-size: calc(13px * var(--text-scale, 1));
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease;
  }

  .category-btn:hover {
    background: rgba(30, 41, 59, 0.6);
    color: #dbeafe;
  }

  .category-btn.active {
    background: rgba(30, 64, 175, 0.25);
    border-color: rgba(59, 130, 246, 0.4);
    color: #93c5fd;
    font-weight: 600;
  }

  .settings-panel-content {
    overflow-y: auto;
    padding: calc(20px * var(--layout-scale, 1));
    display: grid;
    align-content: start;
    gap: calc(14px * var(--layout-scale, 1));
  }

  .settings-panel-content .settings-section {
    max-width: 560px;
  }
</style>
