<script lang="ts">
  import { CATEGORIES } from '../../data/types'
  import { SUPPORTED_LANGUAGES } from '../../types/vocabulary'
  import {
    createDefaultInterestConfig,
    type InterestConfig,
  } from '../../data/interestConfig'
  import { saveInterestConfig } from '../stores/settings'
  import { currentScreen } from '../stores/gameState'

  /** Maps persona bubble IDs to CATEGORIES and initial weight. */
  const PERSONA_CATEGORY_MAP: Record<string, Array<{ category: string; weight: number }>> = {
    historian:       [{ category: 'History', weight: 80 }],
    geologist:       [{ category: 'Natural Sciences', weight: 70 }, { category: 'Geography', weight: 40 }],
    language_learner: [{ category: 'Language', weight: 90 }],
    biologist:       [{ category: 'Animals & Wildlife', weight: 80 }, { category: 'Human Body & Health', weight: 35 }],
    technologist:    [{ category: 'General Knowledge', weight: 80 }],
    geographer:      [{ category: 'Geography', weight: 80 }],
    anthropologist:  [{ category: 'Art & Architecture', weight: 75 }, { category: 'History', weight: 40 }],
    eclectic:        [],
  }

  const PERSONAS = [
    { id: 'historian', label: 'Historian', icon: 'Hi', hint: 'Ancient civilizations, events, people' },
    { id: 'geologist', label: 'Geologist', icon: 'Ge', hint: 'Rocks, minerals, plate tectonics' },
    { id: 'language_learner', label: 'Language Learner', icon: 'Aa', hint: 'Vocabulary, grammar, phrases' },
    { id: 'biologist', label: 'Biologist', icon: 'AW', hint: 'Animals, body systems, ecosystems' },
    { id: 'technologist', label: 'Technologist', icon: 'GK', hint: 'Innovation, inventions, world records' },
    { id: 'geographer', label: 'Geographer', icon: 'Ge', hint: 'Places, maps, climate' },
    { id: 'anthropologist', label: 'Anthropologist', icon: 'AA', hint: 'Art, architecture, society, traditions' },
    { id: 'eclectic', label: 'Eclectic', icon: '**', hint: 'A bit of everything' },
  ]

  const LANGUAGES = SUPPORTED_LANGUAGES.map((language) => language.name)

  let step = $state<1 | 2 | 3>(1)
  let selectedPersonas = $state<string[]>([])
  let languageChoice = $state('')
  let openDiscovery = $state(true)

  let needsLanguageStep = $derived(selectedPersonas.includes('language_learner'))

  function togglePersona(id: string) {
    if (selectedPersonas.includes(id)) {
      selectedPersonas = selectedPersonas.filter(p => p !== id)
    } else if (selectedPersonas.length < 3) {
      selectedPersonas = [...selectedPersonas, id]
    }
  }

  function nextStep() {
    if (step === 1) {
      if (selectedPersonas.length === 0) return
      step = needsLanguageStep ? 2 : 3
    } else if (step === 2) {
      step = 3
    }
  }

  function prevStep() {
    if (step === 3) {
      step = needsLanguageStep ? 2 : 1
    } else if (step === 2) {
      step = 1
    }
  }

  function buildConfig(): InterestConfig {
    const config = createDefaultInterestConfig()

    if (selectedPersonas.includes('eclectic')) {
      config.categories.forEach(c => { c.weight = 20 })
    } else {
      for (const personaId of selectedPersonas) {
        const mappings = PERSONA_CATEGORY_MAP[personaId] ?? []
        for (const { category, weight } of mappings) {
          const entry = config.categories.find(c => c.category === category)
          if (entry) entry.weight = Math.max(entry.weight, weight)
        }
      }
    }

    if (selectedPersonas.includes('language_learner') && languageChoice) {
      config.categoryLock = ['Language', languageChoice]
    }

    config.categoryLockActive = !openDiscovery && config.categoryLock !== null

    return config
  }

  function finish() {
    const config = buildConfig()
    saveInterestConfig(config)
    currentScreen.set('mainMenu')
  }
</script>

<div class="assessment">
  <div class="content">
    {#if step === 1}
      <h1>What do you want to discover?</h1>
      <p class="subtitle">Choose up to 3 interests. You can always change these later.</p>

      <div class="persona-grid">
        {#each PERSONAS as persona}
          {@const isSelected = selectedPersonas.includes(persona.id)}
          {@const isDisabled = !isSelected && selectedPersonas.length >= 3}
          <button
            class="persona-chip"
            class:selected={isSelected}
            class:dimmed={isDisabled}
            disabled={isDisabled}
            onclick={() => togglePersona(persona.id)}
          >
            <span class="p-icon">{persona.icon}</span>
            <span class="p-label">{persona.label}</span>
            <span class="p-hint">{persona.hint}</span>
          </button>
        {/each}
      </div>

      <button
        class="btn-next"
        disabled={selectedPersonas.length === 0}
        onclick={nextStep}
      >
        Next
      </button>

    {:else if step === 2}
      <h1>Which language?</h1>
      <p class="subtitle">We'll focus your mine on vocabulary from this language.</p>

      <div class="lang-grid">
        {#each LANGUAGES as lang}
          <button
            class="lang-chip"
            class:selected={languageChoice === lang}
            onclick={() => languageChoice = languageChoice === lang ? '' : lang}
          >
            {lang}
          </button>
        {/each}
      </div>

      <div class="nav-row">
        <button class="btn-back" onclick={prevStep}>Back</button>
        <button class="btn-next" onclick={nextStep}>Next</button>
      </div>

    {:else}
      <h1>One more thing...</h1>
      <p class="subtitle">Are you open to discovering other topics about this planet?</p>

      <div class="discovery-options">
        <button
          class="discovery-btn"
          class:selected={openDiscovery}
          onclick={() => openDiscovery = true}
        >
          <span class="d-label">Yes, surprise me!</span>
          <span class="d-hint">Your interests get priority, but you'll still encounter other topics</span>
        </button>
        <button
          class="discovery-btn"
          class:selected={!openDiscovery}
          onclick={() => openDiscovery = false}
        >
          <span class="d-label">No, stay focused</span>
          <span class="d-hint">Only facts from your chosen categories will appear</span>
        </button>
      </div>

      <div class="nav-row">
        <button class="btn-back" onclick={prevStep}>Back</button>
        <button class="btn-start" onclick={finish}>Start Mining!</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .assessment {
    position: fixed;
    inset: 0;
    background: #0a0a1a;
    color: #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-rpg);
    z-index: 200;
    overflow-y: auto;
    pointer-events: auto;
  }
  .content {
    max-width: 400px;
    width: 100%;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  h1 {
    font-size: 0.9rem;
    color: #4ecca3;
    text-align: center;
    margin: 0;
  }
  .subtitle {
    font-size: 0.55rem;
    color: #888;
    text-align: center;
    margin: 0;
    line-height: 1.5;
  }
  .persona-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
  .persona-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid #3a3a5a;
    background: #1a1a2e;
    color: #ccc;
    cursor: pointer;
    min-height: 44px;
    min-width: 100px;
    font-family: inherit;
    font-size: 0.55rem;
    transition: all 0.15s;
  }
  .persona-chip:hover:not(:disabled) { border-color: #4ecca3; }
  .persona-chip.selected {
    background: #1a3a2e;
    border-color: #4ecca3;
    color: #4ecca3;
  }
  .persona-chip.dimmed { opacity: 0.35; cursor: not-allowed; }
  .p-icon { font-size: 0.8rem; font-weight: bold; }
  .p-label { font-size: 0.55rem; }
  .p-hint { font-size: 0.4rem; color: #777; text-align: center; }
  .lang-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
  .lang-chip {
    padding: 10px 18px;
    border-radius: 20px;
    border: 1px solid #3a3a5a;
    background: #1a1a2e;
    color: #ccc;
    cursor: pointer;
    min-height: 44px;
    font-family: inherit;
    font-size: 0.6rem;
  }
  .lang-chip.selected {
    background: #1a3a2e;
    border-color: #4ecca3;
    color: #4ecca3;
  }
  .discovery-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .discovery-btn {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px;
    border-radius: 10px;
    border: 1px solid #3a3a5a;
    background: #1a1a2e;
    color: #ccc;
    cursor: pointer;
    min-height: 44px;
    font-family: inherit;
    text-align: left;
  }
  .discovery-btn.selected {
    background: #1a3a2e;
    border-color: #4ecca3;
  }
  .d-label { font-size: 0.6rem; color: #e0e0e0; }
  .d-hint { font-size: 0.45rem; color: #777; line-height: 1.4; }
  .nav-row {
    display: flex;
    gap: 12px;
  }
  .btn-next, .btn-start, .btn-back {
    flex: 1;
    min-height: 44px;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.6rem;
    cursor: pointer;
  }
  .btn-next, .btn-start {
    background: #4ecca3;
    color: #0a0a1a;
    font-weight: bold;
  }
  .btn-next:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-back {
    background: #2a2a3a;
    color: #ccc;
  }
</style>
