<script lang="ts">
  import type { HubFloor } from '../../data/hubLayout'
  import { FLOOR_CANVAS_W, FLOOR_CANVAS_H, FLOOR_RENDER_SCALE } from '../../data/hubLayout'
  import { playerSave } from '../stores/playerData'

  // Suppress unused variable warnings for layout constants exposed for external use
  void FLOOR_CANVAS_W
  void FLOOR_CANVAS_H
  void FLOOR_RENDER_SCALE

  interface Props {
    floor: HubFloor
    onUnlockRequest: (floorId: string) => void
  }

  const { floor, onUnlockRequest }: Props = $props()

  const req = $derived(floor.unlockRequirements)

  const canUnlock = $derived(() => {
    const save = $playerSave
    if (!save || !req) return false
    if (req.prerequisiteFloorIds) {
      for (const pid of req.prerequisiteFloorIds) {
        if (!save.hubState.unlockedFloorIds.includes(pid)) return false
      }
    }
    if (req.divesCompleted && save.stats.totalDivesCompleted < req.divesCompleted) return false
    if (req.factsLearned && save.learnedFacts.length < req.factsLearned) return false
    if (req.factsMastered) {
      const mastered = save.reviewStates.filter(rs => rs.repetitions >= 6).length
      if (mastered < req.factsMastered) return false
    }
    if (req.deepestLayer && save.stats.deepestLayerReached < req.deepestLayer) return false
    if (req.dustCost && save.minerals.dust < req.dustCost) return false
    return true
  })

  function handleTap() {
    onUnlockRequest(floor.id)
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="locked-preview"
  class:ready={canUnlock()}
  onclick={handleTap}
>
  <div class="lock-icon">🔒</div>
  <p class="floor-name">??? {floor.name}</p>

  {#if canUnlock()}
    <div class="unlock-banner">UNLOCK AVAILABLE</div>
  {:else if req}
    <div class="requirements">
      {#if req.divesCompleted}
        <span class="req-item">⛏ {req.divesCompleted} dives</span>
      {/if}
      {#if req.factsLearned}
        <span class="req-item">📖 {req.factsLearned} facts</span>
      {/if}
      {#if req.factsMastered}
        <span class="req-item">⭐ {req.factsMastered} mastered</span>
      {/if}
      {#if req.deepestLayer}
        <span class="req-item">🔽 Layer {req.deepestLayer}</span>
      {/if}
      {#if req.dustCost}
        <span class="req-item">💎 {req.dustCost} dust</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .locked-preview {
    width: 100%;
    aspect-ratio: 2 / 1;
    background: rgba(10, 10, 26, 0.85);
    border: 2px solid #333;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    font-family: 'Press Start 2P', monospace;
    position: relative;
    overflow: hidden;
  }
  .locked-preview.ready {
    border-color: #4ecca3;
    box-shadow: 0 0 12px rgba(78, 204, 163, 0.3);
    animation: glow 2s ease infinite;
  }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 12px rgba(78, 204, 163, 0.3); }
    50% { box-shadow: 0 0 24px rgba(78, 204, 163, 0.6); }
  }
  .lock-icon { font-size: 24px; }
  .floor-name { color: #666; font-size: 10px; margin: 0; }
  .unlock-banner {
    background: #4ecca3;
    color: #0a0a1a;
    padding: 4px 12px;
    font-size: 8px;
    border-radius: 2px;
    animation: pulse 1.5s ease infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
  .requirements {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    padding: 0 12px;
  }
  .req-item { color: #555; font-size: 7px; }
</style>
