<script lang="ts">
  import { playCardAudio } from '../../services/cardAudioManager'

  interface Props {
    languageCode: string
    languageName: string
    languageFlag: string
    deckCount: number
    totalFacts: number
    onStudyAll?: (languageCode: string) => void
  }

  let {
    languageCode,
    languageName,
    languageFlag,
    deckCount,
    totalFacts,
    onStudyAll,
  }: Props = $props()

  function handleStudyAll() {
    playCardAudio('tab-switch')
    onStudyAll?.(languageCode)
  }
</script>

<div class="language-group-header">
  <span class="flag" aria-hidden="true">{languageFlag}</span>
  <span class="language-name">{languageName}</span>
  <span class="stats">{deckCount} decks, {totalFacts.toLocaleString()} facts</span>
  {#if onStudyAll}
    <button class="study-all-btn" onclick={handleStudyAll}>
      Study All &gt;
    </button>
  {/if}
</div>

<style>
  .language-group-header {
    display: flex;
    align-items: center;
    gap: calc(12px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(4px * var(--layout-scale, 1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin-top: calc(8px * var(--layout-scale, 1));
  }

  .flag {
    font-size: calc(22px * var(--text-scale, 1));
    flex-shrink: 0;
  }

  .language-name {
    font-size: calc(15px * var(--text-scale, 1));
    font-weight: 700;
    color: #e2e8f0;
    flex: 1;
  }

  .stats {
    font-size: calc(12px * var(--text-scale, 1));
    color: #64748b;
    flex-shrink: 0;
  }

  .study-all-btn {
    height: calc(30px * var(--layout-scale, 1));
    padding: 0 calc(14px * var(--layout-scale, 1));
    background: rgba(99, 102, 241, 0.12);
    border: none;
    border-radius: calc(6px * var(--layout-scale, 1));
    color: #a5b4fc;
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .study-all-btn:hover {
    background: rgba(99, 102, 241, 0.22);
    color: #c7d2fe;
  }
</style>
