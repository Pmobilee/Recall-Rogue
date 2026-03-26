<script lang="ts">
  import { languageMode } from '../../services/languageService'
  import { languageService } from '../../services/languageService'
  import { getLanguageFlag } from '../../types/vocabulary'
  import type { LanguageConfig, LanguageLevel } from '../../types/vocabulary'

  export let onClose: (() => void) | undefined = undefined

  const languages = languageService.getSupportedLanguages()

  let selectedLanguage: string = $languageMode.language ?? languages[0]?.code ?? ''
  let selectedLevel: string = $languageMode.level ?? ''
  let showGeneral: boolean = $languageMode.showGeneralFacts

  $: availableLevels = languageService.getLevelsForLanguage(selectedLanguage)
  $: if (availableLevels.length > 0 && !availableLevels.find(l => l.id === selectedLevel)) {
    selectedLevel = availableLevels[0].id
  }

  function handleSave(): void {
    languageService.setLanguageMode(selectedLanguage, selectedLevel)
    if (showGeneral !== $languageMode.showGeneralFacts) {
      languageService.toggleGeneralFacts()
    }
    if (onClose) onClose()
  }

  function handleDisable(): void {
    languageService.disableLanguageMode()
    if (onClose) onClose()
  }

</script>

<div class="lang-panel-overlay" role="dialog" aria-label="Language Mode Settings">
  <div class="lang-panel">
    <div class="panel-header">
      <h2>Language Mode</h2>
      <button class="close-x" on:click={onClose} aria-label="Close">&times;</button>
    </div>

    <p class="panel-desc">Focus your learning on a specific language. All quizzes and artifacts will prioritize language facts.</p>

    <div class="language-select">
      <p class="field-label">Language</p>
      <div class="language-options">
        {#each languages as lang}
          <button
            class="lang-option"
            class:selected={selectedLanguage === lang.code}
            on:click={() => { selectedLanguage = lang.code }}
          >
            <span class="lang-flag">{getLanguageFlag(lang.code)}</span>
            <span class="lang-name">{lang.name}</span>
            <span class="lang-native">{lang.nativeName}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="level-select">
      <p class="field-label">Level</p>
      <div class="level-options">
        {#each availableLevels as level}
          <button
            class="level-option"
            class:selected={selectedLevel === level.id}
            on:click={() => { selectedLevel = level.id }}
          >
            <span class="level-id">{level.id}</span>
            <span class="level-name">{level.name}</span>
            <span class="level-count">~{level.wordCount} words</span>
          </button>
        {/each}
      </div>
    </div>

    <label class="general-toggle">
      <input type="checkbox" bind:checked={showGeneral} />
      <span>Also show general knowledge facts</span>
    </label>

    <div class="panel-actions">
      <button class="save-btn" on:click={handleSave}>Enable Language Mode</button>
      {#if $languageMode.enabled}
        <button class="disable-btn" on:click={handleDisable}>Disable Language Mode</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .lang-panel-overlay {
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
  .lang-panel {
    background: #16213e;
    border-radius: 10px;
    padding: 24px;
    max-width: 380px;
    width: 100%;
    border: 1px solid #0f3460;
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .panel-header h2 {
    font-family: var(--font-rpg);
    font-size: 13px;
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
  .panel-desc {
    color: #a0a0a0;
    font-size: 12px;
    line-height: 1.5;
    margin: 0 0 18px;
  }
  .field-label {
    display: block;
    color: #ccc;
    font-size: 11px;
    font-weight: bold;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .language-select, .level-select {
    margin-bottom: 16px;
  }
  .language-options, .level-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lang-option, .level-option {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #0f3460;
    border: 2px solid transparent;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;
    transition: border-color 0.2s;
    text-align: left;
    width: 100%;
    color: #e0e0e0;
  }
  .lang-option.selected, .level-option.selected {
    border-color: #e94560;
  }
  .lang-flag {
    font-size: 20px;
  }
  .lang-name {
    font-size: 13px;
    font-weight: bold;
    flex: 1;
  }
  .lang-native {
    font-size: 12px;
    color: #888;
  }
  .level-id {
    font-family: var(--font-rpg);
    font-size: 11px;
    color: #e94560;
    width: 30px;
  }
  .level-name {
    font-size: 12px;
    flex: 1;
  }
  .level-count {
    font-size: 10px;
    color: #888;
  }
  .general-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #ccc;
    font-size: 12px;
    margin-bottom: 20px;
    cursor: pointer;
  }
  .general-toggle input {
    accent-color: #e94560;
  }
  .panel-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .save-btn {
    background: #e94560;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 6px;
    font-family: var(--font-rpg);
    font-size: 11px;
    cursor: pointer;
    width: 100%;
  }
  .disable-btn {
    background: transparent;
    color: #888;
    border: 1px solid #333;
    padding: 10px;
    border-radius: 6px;
    font-family: var(--font-rpg);
    font-size: 10px;
    cursor: pointer;
    width: 100%;
  }
</style>
