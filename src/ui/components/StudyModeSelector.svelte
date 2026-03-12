<script lang="ts">
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { ENABLE_LANGUAGE_DOMAINS } from '../../data/balance'
  import type { DeckMode } from '../../data/studyPreset'
  import { languageService } from '../../services/languageService'
  import OverflowLabel from './OverflowLabel.svelte'

  interface Props {
    disabled?: boolean
    onNavigateToDeckBuilder?: () => void
  }

  let { disabled = false, onNavigateToDeckBuilder }: Props = $props()

  let showModal = $state(false)

  const presets = $derived($playerSave?.studyPresets ?? [])
  const currentMode: DeckMode = $derived($playerSave?.activeDeckMode ?? { type: 'general' })
  const languages = $derived(languageService.getSupportedLanguages())

  /** Determine the label for the collapsed pill based on current mode. */
  const pillLabel: string = $derived.by(() => {
    if (currentMode.type === 'general') return 'All Topics'
    if (currentMode.type === 'preset') {
      const preset = presets.find(p => p.id === currentMode.presetId)
      return preset?.name ?? 'Custom Deck'
    }
    if (currentMode.type === 'language') {
      const lang = languages.find(l => l.code === currentMode.languageCode)
      return lang?.name ?? 'Language'
    }
    return 'All Topics'
  })

  const pillIcon: string = $derived.by(() => {
    if (currentMode.type === 'preset') return '\u{1F4CB}'
    if (currentMode.type === 'language') return '\u{1F5E3}'
    return '\u{1F4DA}'
  })

  function openModal(): void {
    if (disabled) return
    showModal = true
  }

  function closeModal(): void {
    showModal = false
  }

  function selectMode(mode: DeckMode): void {
    playerSave.update(s => {
      if (!s) return s
      return { ...s, activeDeckMode: mode }
    })
    persistPlayer()
    showModal = false
  }

  function handleOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement)?.classList.contains('sms-overlay')) {
      closeModal()
    }
  }

  function handleOverlayKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      closeModal()
    }
  }

  function isSelected(mode: DeckMode): boolean {
    if (currentMode.type !== mode.type) return false
    if (mode.type === 'general') return true
    if (mode.type === 'preset' && currentMode.type === 'preset') {
      return currentMode.presetId === mode.presetId
    }
    if (mode.type === 'language' && currentMode.type === 'language') {
      return currentMode.languageCode === mode.languageCode
    }
    return false
  }

  function handleBuildNewDeck(): void {
    showModal = false
    onNavigateToDeckBuilder?.()
  }
</script>

<!-- Collapsed pill -->
<button
  type="button"
  class="sms-pill"
  class:disabled
  onclick={openModal}
  aria-label="Change study mode: {pillLabel}"
  data-testid="study-mode-pill"
  {disabled}
>
  <span class="sms-pill-icon" aria-hidden="true">{pillIcon}</span>
  <OverflowLabel text={pillLabel} className="sms-pill-label" />
  {#if disabled}
    <span class="sms-pill-lock" aria-hidden="true">{'\u{1F512}'}</span>
  {:else}
    <span class="sms-pill-chevron" aria-hidden="true">{'\u{25BE}'}</span>
  {/if}
</button>

<!-- Modal overlay -->
{#if showModal}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_interactive_supports_focus -->
  <div
    class="sms-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Select study mode"
    tabindex="-1"
    onclick={handleOverlayClick}
    onkeydown={handleOverlayKeydown}
  >
    <div class="sms-panel">
      <div class="sms-handle" aria-hidden="true"></div>

      <!-- General section -->
      <div class="sms-section-header">Study Mode</div>

      <button
        type="button"
        class="sms-item"
        class:selected={isSelected({ type: 'general' })}
        onclick={() => selectMode({ type: 'general' })}
      >
        <span class="sms-item-check">{isSelected({ type: 'general' }) ? '\u{2713}' : ''}</span>
        <div class="sms-item-content">
          <span class="sms-item-name">
            <span class="sms-item-emoji" aria-hidden="true">{'\u{1F4DA}'}</span>
            <OverflowLabel text="All Topics" className="sms-item-name-text" />
          </span>
          <span class="sms-item-desc">Study from all knowledge domains</span>
        </div>
      </button>

      <!-- Presets section -->
      {#if presets.length > 0}
        <div class="sms-section-header">My Presets</div>
        {#each presets as preset (preset.id)}
          {@const mode = { type: 'preset' as const, presetId: preset.id }}
          <button
            type="button"
            class="sms-item"
            class:selected={isSelected(mode)}
            onclick={() => selectMode(mode)}
          >
            <span class="sms-item-check">{isSelected(mode) ? '\u{2713}' : ''}</span>
            <div class="sms-item-content">
              <span class="sms-item-name">
                <span class="sms-item-emoji" aria-hidden="true">{'\u{1F4CB}'}</span>
                <OverflowLabel text={preset.name} className="sms-item-name-text" />
              </span>
              <span class="sms-item-desc">{preset.cachedFactCount} facts</span>
            </div>
          </button>
        {/each}
      {/if}

      <!-- Languages section -->
      {#if ENABLE_LANGUAGE_DOMAINS && languages.length > 0}
        <div class="sms-section-header">Languages</div>
        {#each languages as lang (lang.code)}
          {@const mode = { type: 'language' as const, languageCode: lang.code }}
          <button
            type="button"
            class="sms-item"
            class:selected={isSelected(mode)}
            onclick={() => selectMode(mode)}
          >
            <span class="sms-item-check">{isSelected(mode) ? '\u{2713}' : ''}</span>
            <div class="sms-item-content">
              <span class="sms-item-name">
                <span class="sms-item-emoji" aria-hidden="true">{'\u{1F5E3}'}</span>
                <OverflowLabel text={lang.name} className="sms-item-name-text" />
              </span>
              <span class="sms-item-desc">{lang.nativeName}</span>
            </div>
          </button>
        {/each}
      {/if}

      <!-- Build new deck -->
      <button
        type="button"
        class="sms-item sms-build-new"
        onclick={handleBuildNewDeck}
      >
        <span class="sms-item-check"></span>
        <div class="sms-item-content">
          <span class="sms-item-name">
            <span class="sms-item-emoji" aria-hidden="true">+</span>
            <OverflowLabel text="Build New Deck" className="sms-item-name-text" />
          </span>
          <span class="sms-item-desc">Create a custom study preset</span>
        </div>
      </button>
    </div>
  </div>
{/if}

<style>
  .sms-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.85);
    color: #e2e8f0;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: opacity 0.2s, border-color 0.2s;
  }

  .sms-pill:hover:not(.disabled) {
    border-color: rgba(148, 163, 184, 0.5);
  }

  .sms-pill.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sms-pill-icon {
    font-size: 14px;
  }

  :global(.sms-pill-label) {
    width: min(140px, 42vw);
    min-width: 0;
  }

  .sms-pill-chevron {
    font-size: 10px;
    opacity: 0.7;
  }

  .sms-pill-lock {
    font-size: 10px;
    opacity: 0.6;
  }

  /* Overlay */
  .sms-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 500;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  /* Panel */
  .sms-panel {
    width: 100%;
    max-width: 420px;
    max-height: 75vh;
    overflow-y: auto;
    background: #111827;
    border-radius: 16px 16px 0 0;
    padding: 12px 16px 24px;
    animation: sms-slide-up 0.25s ease-out;
  }

  @keyframes sms-slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .sms-handle {
    width: 36px;
    height: 4px;
    background: rgba(148, 163, 184, 0.3);
    border-radius: 2px;
    margin: 0 auto 16px;
  }

  /* Section header */
  .sms-section-header {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #8b949e;
    padding: 12px 4px 6px;
  }

  /* Items */
  .sms-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 48px;
    padding: 10px 12px;
    margin-bottom: 6px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: #1e2d3d;
    color: #e2e8f0;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .sms-item:hover {
    background: #243447;
  }

  .sms-item.selected {
    border-left: 3px solid #16a34a;
    background: rgba(22, 163, 106, 0.08);
  }

  .sms-item-check {
    width: 20px;
    font-size: 14px;
    color: #16a34a;
    font-weight: bold;
    text-align: center;
    flex-shrink: 0;
  }

  .sms-item-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .sms-item-name {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
  }

  :global(.sms-item-name-text) {
    min-width: 0;
    flex: 1;
  }

  .sms-item-emoji {
    flex-shrink: 0;
  }

  .sms-item-desc {
    font-size: calc(11px * var(--text-scale, 1));
    color: #8b949e;
  }

  /* Build new deck */
  .sms-build-new {
    margin-top: 8px;
    border: 1px dashed rgba(148, 163, 184, 0.3);
    background: transparent;
  }

  .sms-build-new:hover {
    background: rgba(30, 45, 61, 0.5);
    border-color: rgba(148, 163, 184, 0.5);
  }

  .sms-build-new .sms-item-name {
    color: #63b3ed;
  }
</style>
