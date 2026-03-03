<script lang="ts">
  import { SaveManager } from '../../game/managers/SaveManager'

  interface Props {
    onResume: () => void
    onAbandon: () => void
  }

  let { onResume, onAbandon }: Props = $props()

  const save = SaveManager.load()
  const savedDate = save ? new Date(save.savedAt).toLocaleString() : ''
  const displayLayer = save ? save.layer + 1 : 0
</script>

<div class="resume-modal" role="dialog" aria-modal="true" aria-labelledby="resume-heading">
  <div class="resume-card">
    <h2 id="resume-heading">Mid-Dive Save Found</h2>
    {#if save}
      <p class="save-info">Layer {displayLayer} · {save.ticks} ticks · saved {savedDate}</p>
    {/if}
    <p class="resume-desc">
      You were deep underground. Resume your dive or abandon the run
      (you'll keep banked minerals, but loose inventory may be lost).
    </p>
    <div class="resume-actions">
      <button class="btn-resume" type="button" onclick={onResume}>Resume Dive</button>
      <button class="btn-abandon" type="button" onclick={onAbandon}>Abandon Run</button>
    </div>
  </div>
</div>

<style>
  .resume-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    pointer-events: auto;
  }
  .resume-card {
    background: #1a1a2e;
    border: 2px solid #4488ff;
    border-radius: 8px;
    padding: 28px;
    max-width: 340px;
    width: 90%;
    color: #e0e0e0;
    text-align: center;
    font-family: 'Courier New', monospace;
  }
  h2 { font-size: 0.9rem; margin: 0 0 12px; color: #88aaff; }
  .save-info { font-size: 0.7rem; color: #aaa; margin: 0 0 12px; }
  .resume-desc { font-size: 0.75rem; line-height: 1.5; margin: 0 0 20px; }
  .resume-actions { display: flex; flex-direction: column; gap: 10px; }
  .btn-resume {
    background: #2a5298; color: #fff; border: none;
    padding: 14px; border-radius: 4px; cursor: pointer;
    min-height: 48px; font-size: 0.8rem; font-family: inherit;
  }
  .btn-abandon {
    background: #3a2020; color: #f88; border: 1px solid #744;
    padding: 14px; border-radius: 4px; cursor: pointer;
    min-height: 48px; font-size: 0.8rem; font-family: inherit;
  }
</style>
