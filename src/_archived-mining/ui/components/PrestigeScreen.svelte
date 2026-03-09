<script lang="ts">
  import { playerSave, persistPlayer } from '../stores/playerData'
  import { isEligibleForPrestige, applyPrestige } from '../../services/prestigeService'
  import { gaiaMessage } from '../stores/gameState'
  import { getOmniscientQuip } from '../../data/omniscientQuips'
  import PrestigeBadge from './PrestigeBadge.svelte'

  interface Props {
    onClose: () => void
  }

  const { onClose }: Props = $props()

  let step = $state<1 | 2>(1)
  let confirmText = $state('')
  let error = $state('')

  const save = $derived($playerSave)
  const eligible = $derived(save ? isEligibleForPrestige(save) : false)
  const currentLevel = $derived(save?.prestigeLevel ?? 0)
  const masteredCount = $derived(
    (save?.reviewStates ?? []).filter(rs => rs.interval >= 60).length
  )
  const totalFacts = $derived(save?.reviewStates.length ?? 0)

  function handleContinue(): void {
    step = 2
    confirmText = ''
    error = ''
  }

  function handleBack(): void {
    step = 1
    error = ''
  }

  function handleConfirm(): void {
    if (confirmText.trim().toUpperCase() !== 'PRESTIGE') {
      error = 'Please type PRESTIGE exactly to confirm.'
      return
    }
    if (!save || !eligible) return
    const updated = applyPrestige(save)
    playerSave.set(updated)
    persistPlayer()
    gaiaMessage.set(getOmniscientQuip('milestone'))
    onClose()
  }
</script>

<div class="prestige-overlay" role="dialog" aria-modal="true" aria-label="Prestige Reset">
  <div class="prestige-panel">
    <button class="close-btn" type="button" onclick={onClose} aria-label="Close">✕</button>

    <h2 class="title">PRESTIGE RESET</h2>

    <div class="current-level">
      {#if currentLevel === 0}
        <span class="level-text">No prestige yet</span>
      {:else}
        <span class="level-text">Current: Prestige {currentLevel}</span>
        <PrestigeBadge level={currentLevel} />
      {/if}
    </div>

    <div class="mastery-status">
      <span class="mastered">{masteredCount}</span>
      <span class="divider">/</span>
      <span class="total">{totalFacts}</span>
      <span class="label"> facts mastered</span>
    </div>

    {#if !eligible}
      <div class="ineligible-msg">
        {#if currentLevel >= 10}
          You have reached the maximum prestige level.
        {:else if totalFacts < 50}
          You need at least 50 tracked facts before prestiging.
        {:else}
          Master all facts first to unlock prestige.
        {/if}
      </div>
    {:else if step === 1}
      <div class="confirm-step">
        <p class="warning">
          Are you sure? Your SM-2 progress will reset to zero for all
          {totalFacts} facts. Your minerals, cosmetics, companions, and dome upgrades are safe.
        </p>
        <p class="reward">
          You will earn: <strong>Prestige {currentLevel + 1}</strong> badge and permanent passive bonuses.
        </p>
        <div class="btn-row">
          <button type="button" class="btn-cancel" onclick={onClose}>Cancel</button>
          <button type="button" class="btn-continue" onclick={handleContinue}>Continue</button>
        </div>
      </div>
    {:else}
      <div class="confirm-step step2">
        <p class="warning final">
          This cannot be undone. Type <strong>PRESTIGE</strong> to confirm.
        </p>
        <input
          type="text"
          class="confirm-input"
          placeholder="Type PRESTIGE"
          bind:value={confirmText}
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
        />
        {#if error}
          <p class="error-msg">{error}</p>
        {/if}
        <div class="btn-row">
          <button type="button" class="btn-cancel" onclick={handleBack}>Back</button>
          <button type="button" class="btn-confirm" onclick={handleConfirm}>Confirm</button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .prestige-overlay {
    position: fixed;
    inset: 0;
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    pointer-events: all;
  }

  .prestige-panel {
    position: relative;
    background: #0e0e2a;
    border: 2px solid #ffd700;
    border-radius: 8px;
    padding: 24px 20px;
    max-width: 380px;
    width: 90%;
    font-family: 'Press Start 2P', monospace;
    color: #e0e0e0;
  }

  .close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    color: #888;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 8px;
  }

  .title {
    text-align: center;
    color: #ffd700;
    font-size: 14px;
    margin-bottom: 16px;
    text-shadow: 0 0 10px #ffd700;
  }

  .current-level {
    text-align: center;
    margin-bottom: 10px;
    font-size: 10px;
  }

  .mastery-status {
    text-align: center;
    font-size: 10px;
    margin-bottom: 16px;
    color: #aaa;
  }

  .mastered { color: #ffd700; }
  .divider { color: #555; margin: 0 4px; }
  .total { color: #888; }
  .label { color: #888; }

  .ineligible-msg {
    text-align: center;
    color: #f87171;
    font-size: 9px;
    line-height: 1.6;
    padding: 12px;
    border: 1px solid #4b1c1c;
    border-radius: 4px;
    background: rgba(248, 113, 113, 0.08);
  }

  .confirm-step { margin-top: 8px; }

  .warning {
    font-size: 9px;
    line-height: 1.7;
    color: #ffbb33;
    margin-bottom: 10px;
  }

  .warning.final {
    color: #ff6666;
  }

  .reward {
    font-size: 9px;
    line-height: 1.7;
    color: #aaffa0;
    margin-bottom: 16px;
  }

  .btn-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .btn-cancel, .btn-continue, .btn-confirm {
    font-family: 'Press Start 2P', monospace;
    font-size: 9px;
    padding: 8px 14px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    min-height: 32px;
  }

  .btn-cancel {
    background: #333;
    color: #aaa;
    border: 1px solid #555;
  }

  .btn-continue {
    background: #ffd700;
    color: #0a0a1a;
  }

  .btn-confirm {
    background: #ff4444;
    color: #fff;
  }

  .confirm-input {
    width: 100%;
    box-sizing: border-box;
    background: #1a1a3a;
    border: 1px solid #ffd700;
    border-radius: 4px;
    color: #fff;
    font-family: 'Press Start 2P', monospace;
    font-size: 10px;
    padding: 8px;
    margin-bottom: 8px;
    text-align: center;
    text-transform: uppercase;
  }

  .error-msg {
    color: #ff6666;
    font-size: 8px;
    text-align: center;
    margin-bottom: 8px;
  }

</style>
