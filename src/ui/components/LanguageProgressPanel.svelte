<script lang="ts">
  import { languageService, languageMode } from '../../services/languageService'
  import type { LanguageLevel } from '../../types/vocabulary'

  export let onClose: (() => void) | undefined = undefined

  interface LevelProgress {
    level: LanguageLevel
    totalWords: number
    recognized: number
    recalled: number
    used: number
    mastered: number
  }

  // Stub data — in production, computed from player's ReviewState records
  let levelProgress: LevelProgress[] = []
  let nextMilestone = { description: '', current: 0, target: 0 }

  $: {
    const state = $languageMode
    if (state.language) {
      const levels = languageService.getLevelsForLanguage(state.language)
      levelProgress = levels.map(level => ({
        level,
        totalWords: level.wordCount,
        recognized: 0,   // Would query from playerSave.reviewStates
        recalled: 0,
        used: 0,
        mastered: 0
      }))
      if (levels.length > 0) {
        nextMilestone = {
          description: `Master ${levels[0].id}: Recognize 80% of ${levels[0].wordCount} words`,
          current: 0,
          target: Math.floor(levels[0].wordCount * 0.8)
        }
      }
    }
  }

  function getPercentage(value: number, total: number): number {
    return total > 0 ? Math.round((value / total) * 100) : 0
  }
</script>

<div class="language-progress">
  <div class="progress-header">
    <h3>Language Progress</h3>
    {#if onClose}
      <button class="close-x" on:click={onClose} aria-label="Close">&times;</button>
    {/if}
  </div>

  {#if !$languageMode.enabled}
    <p class="inactive-text">Enable Language Mode in Settings to track your progress.</p>
  {:else}
    <!-- Next milestone -->
    {#if nextMilestone.target > 0}
      <div class="milestone-card">
        <span class="milestone-label">Next Milestone</span>
        <p class="milestone-desc">{nextMilestone.description}</p>
        <div class="milestone-bar">
          <div class="milestone-fill" style="width: {getPercentage(nextMilestone.current, nextMilestone.target)}%"></div>
        </div>
        <span class="milestone-count">{nextMilestone.current} / {nextMilestone.target}</span>
      </div>
    {/if}

    <!-- Per-level progress -->
    {#each levelProgress as lp}
      <div class="level-row" data-level={lp.level.id}>
        <div class="level-header">
          <span class="level-badge">{lp.level.id}</span>
          <span class="level-label">{lp.level.name}</span>
          <span class="level-total">{lp.totalWords} words</span>
        </div>

        <div class="track-bars">
          <!-- Recognition track -->
          <div class="track-row">
            <span class="track-label" style="color: #f39c12">Recognition</span>
            <div class="track-bar">
              <div class="track-fill recognition" style="width: {getPercentage(lp.recognized, lp.totalWords)}%"></div>
            </div>
            <span class="track-pct">{getPercentage(lp.recognized, lp.totalWords)}%</span>
          </div>

          <!-- Recall track -->
          <div class="track-row">
            <span class="track-label" style="color: #3498db">Recall</span>
            <div class="track-bar">
              <div class="track-fill recall" style="width: {getPercentage(lp.recalled, lp.totalWords)}%"></div>
            </div>
            <span class="track-pct">{getPercentage(lp.recalled, lp.totalWords)}%</span>
          </div>

          <!-- Usage track -->
          <div class="track-row">
            <span class="track-label" style="color: #2ecc71">Usage</span>
            <div class="track-bar">
              <div class="track-fill usage" style="width: {getPercentage(lp.used, lp.totalWords)}%"></div>
            </div>
            <span class="track-pct">{getPercentage(lp.used, lp.totalWords)}%</span>
          </div>
        </div>

        <!-- Mastered count -->
        <div class="mastered-row">
          <span class="mastered-star">&#9733;</span>
          <span class="mastered-text">{lp.mastered} fully mastered</span>
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  .language-progress {
    padding: 8px 0;
  }
  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .progress-header h3 {
    font-family: 'Press Start 2P', monospace;
    font-size: 12px;
    color: #e94560;
    margin: 0;
  }
  .close-x {
    background: none;
    border: none;
    color: #888;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
  }
  .inactive-text {
    color: #888;
    font-size: 13px;
    text-align: center;
    padding: 20px;
  }
  .milestone-card {
    background: #0f3460;
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 16px;
    border-left: 3px solid #e94560;
  }
  .milestone-label {
    font-size: 9px;
    color: #e94560;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: bold;
  }
  .milestone-desc {
    color: #ccc;
    font-size: 12px;
    margin: 6px 0;
  }
  .milestone-bar {
    height: 6px;
    background: #1a3a6e;
    border-radius: 3px;
    overflow: hidden;
    margin: 8px 0 4px;
  }
  .milestone-fill {
    height: 100%;
    background: #e94560;
    border-radius: 3px;
    transition: width 0.5s ease;
  }
  .milestone-count {
    font-size: 10px;
    color: #888;
  }
  .level-row {
    background: #0f3460;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 10px;
  }
  .level-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .level-badge {
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    color: #e94560;
    background: #1a1a2e;
    padding: 3px 8px;
    border-radius: 4px;
  }
  .level-label {
    font-size: 12px;
    color: #ccc;
    flex: 1;
  }
  .level-total {
    font-size: 10px;
    color: #888;
  }
  .track-bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .track-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .track-label {
    font-size: 9px;
    width: 75px;
    text-align: right;
    font-weight: bold;
  }
  .track-bar {
    flex: 1;
    height: 8px;
    background: #1a3a6e;
    border-radius: 4px;
    overflow: hidden;
  }
  .track-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s ease;
  }
  .track-fill.recognition { background: #f39c12; }
  .track-fill.recall { background: #3498db; }
  .track-fill.usage { background: #2ecc71; }
  .track-pct {
    font-size: 10px;
    color: #888;
    width: 30px;
    text-align: right;
  }
  .mastered-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #1a3a6e;
  }
  .mastered-star {
    color: #f1c40f;
    font-size: 14px;
  }
  .mastered-text {
    font-size: 11px;
    color: #ccc;
  }
</style>
