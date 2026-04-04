<script lang="ts">
  import {
    difficultyMode,
    fontChoice,
    highContrastMode,
    isSlowReader,
    reduceMotionMode,
    textSize,
    onboardingState,
    getDifficultyDisplayName,
    type DifficultyMode,
    type FontChoice,
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
  import { answerDisplaySpeed, autoResumeAfterAnswer } from '../stores/settings'

  interface Props {
    onback: () => void
  }

  let { onback }: Props = $props()

  // ── UI Scale (AR-82) ──
  const UI_SCALE_KEY = 'recall-rogue-ui-scale'
  let uiScale = $state<number>(parseInt(localStorage.getItem(UI_SCALE_KEY) ?? '100', 10))

  function applyUiScale(value: number): void {
    uiScale = value
    localStorage.setItem(UI_SCALE_KEY, String(value))
    // Trigger CardApp.svelte's updateLayoutScale via a synthetic resize event
    window.dispatchEvent(new Event('resize'))
    trackSettingChange('uiScale', value)
  }

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

  let currentFont = $state<FontChoice>('rpg')
  $effect(() => {
    const unsub = fontChoice.subscribe((fc) => { currentFont = fc })
    return () => unsub()
  })

  function setFont(fc: FontChoice): void {
    fontChoice.set(fc)
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

  // Play modal-open sound when settings panel mounts
  $effect(() => {
    playCardAudio('modal-open')
  })

  type SettingsCategory = 'audio' | 'accessibility' | 'notifications' | 'account'
  let activeCategory = $state<SettingsCategory>('audio')

  const categories: { id: SettingsCategory; label: string }[] = [
    { id: 'audio', label: 'Audio' },
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'account', label: 'Account' },
  ]

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      playCardAudio('modal-close')
      onback()
    }
  }
</script>

{#if $isLandscape}
<!-- LANDSCAPE: header sidebar (hidden on desktop) + horizontal category nav + content -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="settings-overlay" role="presentation" onkeydown={handleKeydown}>
  <div class="settings-card settings-card-landscape">
    <aside class="settings-sidebar">
      <div class="settings-sidebar-header">
        <h2>Settings</h2>
      </div>
    </aside>

    <nav class="category-nav">
      <button class="category-btn back-to-hub" data-testid="btn-settings-back" onclick={() => { playCardAudio('modal-close'); onback() }}>← Back</button>
      {#each categories as cat}
        <button
          class="category-btn"
          class:active={activeCategory === cat.id}
          data-testid="btn-settings-{cat.id}"
          onclick={() => { activeCategory = cat.id }}
        >{cat.label}</button>
      {/each}
    </nav>

    <div class="settings-panel-content">
      {#if activeCategory === 'audio'}
        <section class="settings-section">
          <h3>Audio</h3>
          <label class="toggle-row">
            <span>SFX Enabled</span>
            <input
              type="checkbox"
              bind:checked={$sfxEnabled}
              onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); trackSettingChange('sfxEnabled', c) }}
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
              onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); trackSettingChange('musicEnabled', c) }}
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
          <label class="slider-row">
            <span>UI Scale</span>
            <input
              type="range"
              min="80"
              max="150"
              step="5"
              value={uiScale}
              oninput={(event) => applyUiScale(Number((event.currentTarget as HTMLInputElement).value))}
            />
            <strong>{uiScale}%</strong>
          </label>
          <label class="toggle-row">
            <span>High Contrast</span>
            <input
              type="checkbox"
              bind:checked={$highContrastMode}
              onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); trackSettingChange('highContrastMode', c) }}
            />
          </label>
          <label class="toggle-row">
            <span>Reduce Motion</span>
            <input
              type="checkbox"
              bind:checked={$reduceMotionMode}
              onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); trackSettingChange('reduceMotionMode', c) }}
            />
          </label>
          <label class="toggle-row">
            <span>Slow Reader (+3s)</span>
            <input
              type="checkbox"
              bind:checked={$isSlowReader}
              onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); trackSettingChange('slowReader', c) }}
            />
          </label>
          <div class="setting-group">
            <span class="setting-label">Font</span>
            <div class="pill-group">
              {#each (['rpg', 'dyslexic', 'system'] as FontChoice[]) as fc}
                <button
                  class="pill-btn"
                  class:active={currentFont === fc}
                  onclick={() => setFont(fc)}
                >
                  {fc === 'rpg' ? 'Fantasy' : fc === 'dyslexic' ? 'Easy Read' : 'System'}
                </button>
              {/each}
            </div>
          </div>
          <label class="slider-row">
            <span>Answer Display Speed</span>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              bind:value={$answerDisplaySpeed}
              onchange={(event) => trackSettingChange('answerDisplaySpeed', Number((event.currentTarget as HTMLInputElement).value))}
            />
            <strong>{$answerDisplaySpeed.toFixed(1)}×</strong>
          </label>
          <label class="toggle-row">
            <span>Auto-Resume After Answer</span>
            <input
              type="checkbox"
              bind:checked={$autoResumeAfterAnswer}
              onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); trackSettingChange('autoResumeAfterAnswer', c) }}
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
              onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); updateNotifPref('enabled', c) }}
            />
          </label>
          {#if notifPrefs.enabled}
            <label class="toggle-row">
              <span>Streak Reminders</span>
              <input
                type="checkbox"
                checked={notifPrefs.streakReminders}
                onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); updateNotifPref('streakReminders', c) }}
              />
            </label>
            <label class="toggle-row">
              <span>Review Reminders</span>
              <input
                type="checkbox"
                checked={notifPrefs.reviewReminders}
                onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); updateNotifPref('reviewReminders', c) }}
              />
            </label>
            <label class="toggle-row">
              <span>Milestone Alerts</span>
              <input
                type="checkbox"
                checked={notifPrefs.milestoneAlerts}
                onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); updateNotifPref('milestoneAlerts', c) }}
              />
            </label>
            <label class="toggle-row">
              <span>Win-back Messages</span>
              <input
                type="checkbox"
                checked={notifPrefs.winbackMessages}
                onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); updateNotifPref('winbackMessages', c) }}
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
      <button class="back-btn" data-testid="btn-settings-back" onclick={() => { playCardAudio('modal-close'); onback() }}>Back</button>
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

      <label class="slider-row">
        <span>UI Scale</span>
        <input
          type="range"
          min="80"
          max="150"
          step="5"
          value={uiScale}
          oninput={(event) => applyUiScale(Number((event.currentTarget as HTMLInputElement).value))}
        />
        <strong>{uiScale}%</strong>
      </label>

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

      <div class="setting-group">
        <span class="setting-label">Font</span>
        <div class="pill-group">
          {#each (['rpg', 'dyslexic', 'system'] as FontChoice[]) as fc}
            <button
              class="pill-btn"
              class:active={currentFont === fc}
              onclick={() => setFont(fc)}
            >
              {fc === 'rpg' ? 'Fantasy' : fc === 'dyslexic' ? 'Easy Read' : 'System'}
            </button>
          {/each}
        </div>
      </div>

      <label class="slider-row">
        <span>Answer Display Speed</span>
        <input
          type="range"
          min="0.5"
          max="3.0"
          step="0.1"
          bind:value={$answerDisplaySpeed}
          onchange={(event) => trackSettingChange('answerDisplaySpeed', Number((event.currentTarget as HTMLInputElement).value))}
        />
        <strong>{$answerDisplaySpeed.toFixed(1)}×</strong>
      </label>

      <label class="toggle-row">
        <span>Auto-Resume After Answer</span>
        <input
          type="checkbox"
          bind:checked={$autoResumeAfterAnswer}
          onchange={(event) => trackSettingChange('autoResumeAfterAnswer', (event.currentTarget as HTMLInputElement).checked)}
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
          onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); trackSettingChange('sfxEnabled', c) }}
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
          onchange={(event) => { const c = (event.currentTarget as HTMLInputElement).checked; playCardAudio(c ? 'toggle-on' : 'toggle-off'); trackSettingChange('musicEnabled', c) }}
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
    align-items: center;
    justify-items: stretch;
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
    min-height: calc(48px * var(--layout-scale, 1));
    border-radius: 10px;
    font-size: calc(12px * var(--text-scale, 1));
  }

  .chip.selected {
    border: 2px solid #38bdf8;
    background: #0f2942;
    color: #f8fafc;
    box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25);
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
    min-height: calc(48px * var(--layout-scale, 1));
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
    min-height: calc(48px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    color: #dbeafe;
  }

  .slider-row {
    grid-template-columns: calc(130px * var(--layout-scale, 1)) 1fr auto;
  }

  input[type='checkbox'] {
    width: calc(20px * var(--layout-scale, 1));
    height: calc(20px * var(--layout-scale, 1));
    accent-color: #d4a017;
  }

  input[type='range'] {
    width: 100%;
    accent-color: #d4a017;
  }

  strong {
    min-width: calc(52px * var(--layout-scale, 1));
    text-align: right;
    color: #f8fafc;
  }

  /* ── Landscape Styles ── */

  .settings-card-landscape {
    display: grid;
    grid-template-columns: calc(200px * var(--layout-scale, 1)) 1fr;
    grid-template-rows: 1fr;
    gap: 0;
    padding: 0;
    height: 100vh;
    max-height: 100vh;
    overflow: hidden;
  }

  /* When sidebar is hidden (desktop landscape), switch to vertical stack */
  :global([data-layout="landscape"]) .settings-card-landscape {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
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
    max-width: calc(560px * var(--layout-scale, 1));
  }

  /* ═══ LANDSCAPE DESKTOP OVERRIDES ═══════════════════════════════════════════ */

  /* Hide the mobile sidebar — desktop uses the horizontal category nav instead */
  :global([data-layout="landscape"]) .settings-sidebar {
    display: none;
  }

  /* Widen the content panel so it uses available horizontal space */
  :global([data-layout="landscape"]) .settings-panel-content .settings-section {
    max-width: calc(1200px * var(--layout-scale, 1));
    margin: 0 auto;
    width: 100%;
  }

  /* Body text / labels — larger font and taller click targets */
  :global([data-layout="landscape"]) .toggle-row,
  :global([data-layout="landscape"]) .slider-row {
    font-size: calc(15px * var(--text-scale, 1));
    min-height: calc(56px * var(--layout-scale, 1));
  }

  /* Volume sliders: label + capped-width track + value readout */
  :global([data-layout="landscape"]) .slider-row {
    grid-template-columns: calc(140px * var(--layout-scale, 1)) minmax(calc(280px * var(--layout-scale, 1)), calc(500px * var(--layout-scale, 1))) auto;
  }

  /* Section headings */
  :global([data-layout="landscape"]) .settings-section h3 {
    font-size: calc(20px * var(--text-scale, 1));
    margin-bottom: calc(12px * var(--layout-scale, 1));
  }

  /* More breathing room between sections */
  :global([data-layout="landscape"]) .settings-panel-content {
    gap: calc(32px * var(--layout-scale, 1));
  }

  /* Toggle checkboxes: desktop-appropriate size — not oversized for mouse use */
  :global([data-layout="landscape"]) input[type='checkbox'] {
    width: calc(32px * var(--layout-scale, 1));
    height: calc(32px * var(--layout-scale, 1));
    max-width: calc(32px * var(--layout-scale, 1));
    max-height: calc(32px * var(--layout-scale, 1));
    accent-color: #d4a017;
  }

  /* Category nav: horizontal row centered across the full width in desktop landscape */
  :global([data-layout="landscape"]) .category-nav {
    flex-direction: row;
    justify-content: center;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    background: #0d1a2b;
    border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  }

  /* Category nav buttons: horizontal pill style */
  :global([data-layout="landscape"]) .category-btn {
    text-align: center;
    min-width: calc(120px * var(--layout-scale, 1));
    font-size: calc(13px * var(--text-scale, 1));
  }

  .back-to-hub {
    color: #93c5fd;
    font-weight: 500;
    min-width: auto !important;
    padding: calc(8px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    margin-right: calc(8px * var(--layout-scale, 1));
    border-right: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 8px 0 0 8px;
  }

  :global([data-layout="landscape"]) .chip {
    font-size: calc(13px * var(--text-scale, 1));
  }

  :global([data-layout="landscape"]) .category-btn:hover:not(.active) {
    background: rgba(30, 41, 59, 0.8);
    color: #93c5fd;
  }

  :global([data-layout="landscape"]) .chip:hover:not(.selected):not(:disabled) {
    border-color: rgba(56, 189, 248, 0.3);
    background: rgba(15, 33, 53, 0.5);
  }

  :global([data-layout="landscape"]) .toggle-row:hover,
  :global([data-layout="landscape"]) .slider-row:hover {
    background: rgba(255, 255, 255, 0.03);
    border-radius: calc(8px * var(--layout-scale, 1));
  }

  .setting-group {
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    min-height: calc(48px * var(--layout-scale, 1));
  }

  .setting-label {
    font-size: calc(12px * var(--text-scale, 1));
    color: #dbeafe;
    min-width: calc(60px * var(--layout-scale, 1));
  }

  .pill-group {
    display: flex;
    gap: calc(6px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  .pill-btn {
    border: 1px solid #334155;
    background: #1f2c42;
    color: #cbd5e1;
    padding: calc(6px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    min-height: calc(36px * var(--layout-scale, 1));
    border-radius: 20px;
    font-size: calc(11px * var(--text-scale, 1));
    cursor: pointer;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .pill-btn:hover {
    border-color: rgba(56, 189, 248, 0.4);
    background: rgba(15, 41, 66, 0.7);
    color: #f8fafc;
  }

  .pill-btn.active {
    border: 2px solid #38bdf8;
    background: #0f2942;
    color: #f8fafc;
    box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.25);
  }
</style>
