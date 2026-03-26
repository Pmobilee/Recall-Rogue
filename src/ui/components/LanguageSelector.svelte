<script lang="ts">
  import { locale, LOCALE_META, SUPPORTED_LOCALES, detectLocale } from '../../i18n'
  import { t } from '../../i18n'
  import type { LocaleCode } from '../../i18n'

  /** Called when the user closes this panel */
  let { onClose }: { onClose?: (() => void) } = $props()

  const autoDetected: LocaleCode = detectLocale()
  let selected: LocaleCode = $state($locale)

  /**
   * Returns a rough completeness percentage for a locale.
   * In production this would be derived from the validate-locale script output.
   * For now it returns 100% for English and estimated values for others.
   */
  function completeness(code: LocaleCode): number {
    const map: Record<LocaleCode, number> = {
      en: 100, es: 85, fr: 85, de: 80, ja: 75, ar: 60, he: 60,
    }
    return map[code] ?? 0
  }

  function handleSelect(code: LocaleCode): void {
    selected = code
    locale.set(code)
  }

  function handleClose(): void {
    if (onClose) onClose()
  }
</script>

<div class="lang-selector-overlay" role="dialog" aria-label={$t('settings.language.ui_language')}>
  <div class="lang-selector-panel">
    <div class="panel-header">
      <h2>{$t('settings.language.ui_language')}</h2>
      <button class="close-x" onclick={handleClose} aria-label={$t('common.close')}>&times;</button>
    </div>

    <div class="locale-list">
      {#each SUPPORTED_LOCALES as code}
        {@const meta = LOCALE_META[code]}
        {@const pct = completeness(code)}
        <button
          class="locale-row"
          class:active={selected === code}
          onclick={() => handleSelect(code)}
          aria-pressed={selected === code}
        >
          <span class="locale-flag">{meta.flag}</span>
          <div class="locale-labels">
            <span class="locale-native">{meta.nativeName}</span>
            <span class="locale-english">{meta.name}</span>
          </div>
          <div class="locale-right">
            {#if code === autoDetected}
              <span class="auto-badge">{$t('settings.language.auto_detected')}</span>
            {/if}
            {#if pct < 100}
              <span class="pct-label">{pct}%</span>
            {/if}
            {#if selected === code}
              <span class="checkmark" aria-hidden="true">✓</span>
            {/if}
          </div>
        </button>
      {/each}
    </div>

    {#if completeness(selected) < 100}
      <p class="translation-note">
        Some text may appear in English until this language is fully translated.
      </p>
    {/if}
  </div>
</div>

<style>
  .lang-selector-overlay {
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
  .lang-selector-panel {
    background: #16213e;
    border-radius: 10px;
    padding: 24px;
    max-width: 380px;
    width: 100%;
    border: 1px solid #0f3460;
    max-height: 80vh;
    overflow-y: auto;
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .panel-header h2 {
    font-family: var(--font-rpg);
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
  .locale-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .locale-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #0f3460;
    border: 2px solid transparent;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;
    width: 100%;
    color: #e0e0e0;
    text-align: left;
    transition: border-color 0.15s;
  }
  .locale-row.active {
    border-color: #e94560;
  }
  .locale-row:hover {
    border-color: #555;
  }
  .locale-flag {
    font-size: 22px;
    flex-shrink: 0;
  }
  .locale-labels {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .locale-native {
    font-size: 14px;
    font-weight: bold;
    color: #e0e0e0;
  }
  .locale-english {
    font-size: 11px;
    color: #888;
  }
  .locale-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .auto-badge {
    background: #1a6040;
    color: #4caf50;
    font-size: 8px;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: bold;
  }
  .pct-label {
    font-size: 10px;
    color: #888;
  }
  .checkmark {
    color: #e94560;
    font-size: 16px;
  }
  .translation-note {
    margin-top: 14px;
    font-size: 11px;
    color: #888;
    line-height: 1.5;
    text-align: center;
    border-top: 1px solid #222;
    padding-top: 12px;
  }
</style>
