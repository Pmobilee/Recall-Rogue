<script lang="ts">
  import { playCardAudio } from '../../services/cardAudioManager';

  interface Props {
    /** Currently active mode. */
    mode: 'trivia' | 'study';
    /** Callback fired when the user switches modes. */
    onModeChange: (mode: 'trivia' | 'study') => void;
  }

  let { mode, onModeChange }: Props = $props();

  /** Handle tab click with audio feedback. */
  function select(next: 'trivia' | 'study'): void {
    if (next === mode) return;
    playCardAudio('tab-switch');
    onModeChange(next);
  }
</script>

<div class="mode-toggle" role="tablist" aria-label="Run mode">
  <button
    role="tab"
    class="tab"
    class:active={mode === 'trivia'}
    aria-selected={mode === 'trivia'}
    onclick={() => select('trivia')}
  >
    <span class="tab-icon">⚔️</span>
    <span class="tab-label">Trivia Dungeon</span>
  </button>

  <button
    role="tab"
    class="tab"
    class:active={mode === 'study'}
    aria-selected={mode === 'study'}
    onclick={() => select('study')}
  >
    <span class="tab-icon">📚</span>
    <span class="tab-label">Study Temple</span>
  </button>
</div>

<style>
  .mode-toggle {
    display: flex;
    gap: 0;
    background: rgba(255, 255, 255, 0.06);
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(4px * var(--layout-scale, 1));
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 0 0 calc(1px * var(--layout-scale, 1)) rgba(99, 102, 241, 0.15);
  }

  .tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    border-radius: calc(7px * var(--layout-scale, 1));
    border: none;
    background: transparent;
    color: #64748b;
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    cursor: pointer;
    transition: background 0.18s, color 0.18s, box-shadow 0.18s;
    white-space: nowrap;
    min-width: 0;
    overflow: hidden;
  }

  .tab.active {
    background: linear-gradient(135deg, #1e3a8a, #4c1d95);
    color: #e0e7ff;
    box-shadow:
      0 calc(2px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    text-shadow: 0 1px calc(4px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.4);
  }

  .tab:hover:not(.active) {
    background: rgba(255, 255, 255, 0.07);
    color: #cbd5e1;
  }

  .tab-icon {
    font-size: calc(16px * var(--text-scale, 1));
    flex-shrink: 0;
  }

  .tab-label {
    font-size: calc(14px * var(--text-scale, 1));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
