<script lang="ts">
  import { CATEGORIES } from '../../data/types'
  import { SUPPORTED_LANGUAGES } from '../../types/vocabulary'

  interface Props {
    onClose: () => void
    onSelect: (path: string[]) => void
  }

  let { onClose, onSelect }: Props = $props()

  // State machine: 'category' | 'subcategory'
  let step: 'category' | 'subcategory' = $state('category')
  let selectedCategory: string | null = $state(null)

  const LANGUAGE_SUBCATEGORIES = SUPPORTED_LANGUAGES.map((lang) => lang.name)

  // Known subcategories per category (hardcoded for now, could be derived from facts DB)
  const SUBCATEGORIES: Record<string, string[]> = {
    'General Knowledge': ['Inventions', 'Records', 'Firsts', 'Institutions'],
    'Language': LANGUAGE_SUBCATEGORIES,
    'Natural Sciences': ['Physics', 'Chemistry', 'Geology', 'Materials'],
    'Space & Astronomy': ['Planets', 'Missions', 'Stars', 'Astronauts'],
    'History': ['Ancient', 'Medieval', 'Modern', 'World Wars'],
    'Geography': ['Countries', 'Capitals', 'Oceans', 'Mountains'],
    'Mythology & Folklore': ['Deities', 'Creatures', 'Legends', 'Origins'],
    'Animals & Wildlife': ['Species', 'Habitats', 'Behavior', 'Conservation'],
    'Human Body & Health': ['Anatomy', 'Physiology', 'Medicine', 'Nutrition'],
    'Food & World Cuisine': ['Ingredients', 'Dishes', 'Techniques', 'Nutrition'],
    'Art & Architecture': ['Paintings', 'Sculpture', 'Movements', 'Landmarks'],
  }

  function selectCategory(cat: string) {
    selectedCategory = cat
    const subs = SUBCATEGORIES[cat]
    if (subs && subs.length > 0) {
      step = 'subcategory'
    } else {
      onSelect([cat])
    }
  }

  function selectSubcategory(sub: string) {
    if (selectedCategory) {
      onSelect([selectedCategory, sub])
    }
  }

  function selectCategoryOnly() {
    if (selectedCategory) {
      onSelect([selectedCategory])
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" onclick={handleBackdropClick} role="dialog" tabindex="-1" aria-modal="true" aria-label="Category Lock Selector">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title">
        {#if step === 'category'}
          FOCUS CRYSTAL
        {:else}
          {selectedCategory}
        {/if}
      </span>
      <button class="close-btn" onclick={onClose} aria-label="Close">✕</button>
    </div>

    <div class="modal-subtitle">
      {#if step === 'category'}
        Select a category to lock your study focus
      {:else}
        Select a subcategory, or focus on all of {selectedCategory}
      {/if}
    </div>

    <div class="options-list">
      {#if step === 'category'}
        {#each CATEGORIES as cat}
          <button
            class="option-btn"
            onclick={() => selectCategory(cat)}
          >
            <span class="option-label">{cat}</span>
            {#if SUBCATEGORIES[cat]?.length > 0}
              <span class="chevron">›</span>
            {:else}
              <span class="select-label">Select</span>
            {/if}
          </button>
        {/each}
      {:else if selectedCategory}
        <!-- "All" option for the whole category -->
        <button class="option-btn option-all" onclick={selectCategoryOnly}>
          <span class="option-label">All of {selectedCategory}</span>
          <span class="select-label">Select</span>
        </button>

        <div class="divider"></div>

        {#each SUBCATEGORIES[selectedCategory] ?? [] as sub}
          <button
            class="option-btn"
            onclick={() => selectSubcategory(sub)}
          >
            <span class="option-label">{sub}</span>
            <span class="select-label">Select</span>
          </button>
        {/each}
      {/if}
    </div>

    {#if step === 'subcategory'}
      <button class="back-btn" onclick={() => { step = 'category'; selectedCategory = null }}>
        ← Back
      </button>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9000;
    padding: 16px;
    pointer-events: auto;
  }

  .modal {
    background: #0a0a1a;
    border: 2px solid #4ecca3;
    border-radius: 4px;
    width: 100%;
    max-width: 380px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: var(--font-rpg);
    box-shadow: 0 0 24px rgba(78, 204, 163, 0.25);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid rgba(78, 204, 163, 0.3);
    gap: 8px;
  }

  .modal-title {
    font-size: 10px;
    color: #4ecca3;
    letter-spacing: 1px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close-btn {
    background: transparent;
    border: 1px solid rgba(78, 204, 163, 0.4);
    color: #4ecca3;
    font-size: 12px;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 2px;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: rgba(78, 204, 163, 0.15);
  }

  .modal-subtitle {
    padding: 12px 16px;
    font-size: 7px;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.6;
  }

  .options-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .options-list::-webkit-scrollbar {
    width: 4px;
  }

  .options-list::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }

  .options-list::-webkit-scrollbar-thumb {
    background: rgba(78, 204, 163, 0.4);
    border-radius: 2px;
  }

  .option-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 44px;
    padding: 0 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(78, 204, 163, 0.2);
    border-radius: 2px;
    color: #e0e0e0;
    font-family: var(--font-rpg);
    font-size: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
    gap: 8px;
  }

  .option-btn:hover {
    background: rgba(78, 204, 163, 0.12);
    border-color: rgba(78, 204, 163, 0.5);
    color: #4ecca3;
  }

  .option-btn:active {
    background: rgba(78, 204, 163, 0.2);
  }

  .option-all {
    border-color: rgba(78, 204, 163, 0.4);
    color: #4ecca3;
  }

  .option-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron {
    color: rgba(78, 204, 163, 0.6);
    font-size: 14px;
    flex-shrink: 0;
  }

  .select-label {
    font-size: 7px;
    color: rgba(78, 204, 163, 0.6);
    flex-shrink: 0;
  }

  .divider {
    height: 1px;
    background: rgba(78, 204, 163, 0.2);
    margin: 4px 0;
  }

  .back-btn {
    display: block;
    width: calc(100% - 32px);
    margin: 8px 16px 12px;
    min-height: 44px;
    padding: 0 14px;
    background: transparent;
    border: 1px solid rgba(78, 204, 163, 0.3);
    border-radius: 2px;
    color: rgba(78, 204, 163, 0.7);
    font-family: var(--font-rpg);
    font-size: 8px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .back-btn:hover {
    background: rgba(78, 204, 163, 0.08);
    border-color: rgba(78, 204, 163, 0.5);
    color: #4ecca3;
  }
</style>
