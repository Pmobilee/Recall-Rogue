<script lang="ts">
  import type { ArtifactReward } from '../../data/artifactLootTable'
  import type { PendingArtifact, Rarity } from '../../data/types'
  import { rollArtifactReward } from '../../data/artifactLootTable'
  import { computeStudyScore } from '../../services/studyScore'
  import { playerSave, addMinerals, addLearnedFact, persistPlayer, savePendingArtifacts } from '../stores/playerData'
  import { pendingArtifacts, activeFact } from '../stores/gameState'
  import { factsDB } from '../../services/factsDB'
  import { get } from 'svelte/store'

  interface Props {
    artifact: PendingArtifact
    remainingCount: number
    onNext: () => void
  }

  let { artifact, remainingCount, onNext }: Props = $props()

  let stage = $state<1 | 2 | 3 | 4 | 5>(1)
  let reward = $state<ArtifactReward | null>(null)
  let showFactChoice = $state(false)

  const RARITY_COLORS: Record<Rarity, string> = {
    common: '#b0b0b0',
    uncommon: '#4ade80',
    rare: '#60a5fa',
    epic: '#a78bfa',
    legendary: '#fbbf24',
    mythic: '#f472b6',
  }

  const rarityColor = $derived(RARITY_COLORS[artifact.rarity] ?? '#b0b0b0')

  // Stage 1 auto-advance
  $effect(() => {
    if (stage === 1) {
      const timer = setTimeout(() => {
        stage = 2
      }, 500)
      return () => clearTimeout(timer)
    }
  })

  /** Player taps the artifact to crack it */
  function handleTap() {
    if (stage === 2) {
      stage = 3
      // Roll the reward during cracking
      const save = get(playerSave)
      const score = save ? computeStudyScore(save) : 0.5
      reward = rollArtifactReward(artifact, score, Math.random)
      // Auto-advance after animation
      setTimeout(() => {
        stage = 4
      }, 1500)
    }
  }

  /** Apply the reward and advance to stage 5 */
  function collectReward() {
    if (!reward) return

    if (reward.type === 'fact') {
      // Show fact reveal for learn/sell choice
      const fact = factsDB.getById(artifact.factId)
      if (fact) {
        activeFact.set(fact)
        showFactChoice = true
      }
      stage = 5
      return
    }

    // Apply non-fact rewards
    const save = get(playerSave)
    if (!save) return

    switch (reward.type) {
      case 'dust':
      case 'junk':
        addMinerals(reward.dustTier ?? 'dust', reward.amount ?? 1)
        break
      case 'consumable':
        playerSave.update(s => {
          if (!s) return s
          const consumables = { ...(s.consumables ?? {}) }
          const key = reward!.itemId ?? 'bomb'
          consumables[key] = (consumables[key] ?? 0) + (reward!.amount ?? 1)
          return { ...s, consumables }
        })
        break
      case 'fossil':
        playerSave.update(s => {
          if (!s) return s
          const fossils = { ...s.fossils }
          const speciesId = reward!.itemId ?? 'fossil_0'
          if (!fossils[speciesId]) {
            fossils[speciesId] = {
              speciesId,
              fragmentsFound: 1,
              fragmentsNeeded: 5,
              revived: false,
            }
          } else {
            fossils[speciesId] = {
              ...fossils[speciesId],
              fragmentsFound: fossils[speciesId].fragmentsFound + 1,
            }
          }
          return { ...s, fossils }
        })
        break
      case 'upgrade_token':
        playerSave.update(s =>
          s
            ? {
                ...s,
                upgradeTokens:
                  (s.upgradeTokens ?? 0) + (reward!.amount ?? 1),
              }
            : s,
        )
        break
    }

    // Remove from pending
    pendingArtifacts.update(arr =>
      arr.filter(a => a.factId !== artifact.factId || a.minedAt !== artifact.minedAt),
    )
    savePendingArtifacts(get(pendingArtifacts))
    persistPlayer()
    stage = 5
  }

  /** Player chose to learn the fact reward */
  function learnFact() {
    addLearnedFact(artifact.factId)
    pendingArtifacts.update(arr =>
      arr.filter(a => a.factId !== artifact.factId || a.minedAt !== artifact.minedAt),
    )
    savePendingArtifacts(get(pendingArtifacts))
    persistPlayer()
    activeFact.set(null)
    showFactChoice = false
    goNextOrDone()
  }

  /** Player chose to sell the fact reward */
  function sellFact() {
    const sellValues: Record<string, number> = {
      common: 5,
      uncommon: 10,
      rare: 20,
      epic: 40,
      legendary: 80,
      mythic: 150,
    }
    addMinerals('dust', sellValues[artifact.rarity] ?? 5)
    pendingArtifacts.update(arr =>
      arr.filter(a => a.factId !== artifact.factId || a.minedAt !== artifact.minedAt),
    )
    savePendingArtifacts(get(pendingArtifacts))
    persistPlayer()
    activeFact.set(null)
    showFactChoice = false
    goNextOrDone()
  }

  /** Move to next artifact or finish */
  function goNextOrDone() {
    onNext()
  }

  /** Get a display label for a reward */
  function getRewardLabel(r: ArtifactReward): string {
    switch (r.type) {
      case 'fact':
        return 'Ancient Knowledge'
      case 'dust':
        return `${r.amount} ${(r.dustTier ?? 'Dust').charAt(0).toUpperCase() + (r.dustTier ?? 'dust').slice(1)}`
      case 'consumable':
        return (r.itemId ?? 'Item')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
      case 'fossil':
        return 'Fossil Fragment'
      case 'upgrade_token':
        return 'Upgrade Token'
      case 'junk':
        return `Salvage (${r.amount} dust)`
      default:
        return 'Unknown'
    }
  }

  /** Get emoji for reward type */
  function getRewardEmoji(r: ArtifactReward): string {
    switch (r.type) {
      case 'fact':
        return '📜'
      case 'dust':
        return '💎'
      case 'consumable':
        return '🧪'
      case 'fossil':
        return '🦴'
      case 'upgrade_token':
        return '⚙️'
      case 'junk':
        return '🪨'
      default:
        return '❓'
    }
  }
</script>

<div class="analyzer-overlay" data-testid="artifact-analyzer">
  <!-- Stage 1: Artifact appears with glow -->
  {#if stage === 1}
    <div class="stage stage-1" data-testid="analyzer-stage-1">
      <div class="artifact-crystal" style="--rarity-color: {rarityColor}">
        <span class="crystal-icon">💎</span>
      </div>
      <p class="stage-text">Analyzing artifact...</p>
    </div>

  <!-- Stage 2: Tap to crack -->
  {:else if stage === 2}
    <div class="stage stage-2" data-testid="analyzer-stage-2">
      <button
        type="button"
        class="artifact-crystal crackable"
        style="--rarity-color: {rarityColor}"
        onclick={handleTap}
        data-testid="analyzer-tap"
      >
        <span class="crystal-icon">💎</span>
        <span class="crack-hint">TAP</span>
      </button>
      <p class="stage-text">Tap the crystal to crack it open!</p>
      <p class="rarity-label" style="color: {rarityColor}">
        {artifact.rarity.charAt(0).toUpperCase() + artifact.rarity.slice(1)}
      </p>
    </div>

  <!-- Stage 3: Cracking animation -->
  {:else if stage === 3}
    <div class="stage stage-3" data-testid="analyzer-stage-3">
      <div class="artifact-crystal cracking" style="--rarity-color: {rarityColor}">
        <span class="crystal-icon shatter">💎</span>
      </div>
      <p class="stage-text">Cracking...</p>
    </div>

  <!-- Stage 4: Reward reveal -->
  {:else if stage === 4}
    <div class="stage stage-4" data-testid="analyzer-stage-4">
      {#if reward}
        <div class="reward-reveal">
          <span class="reward-emoji">{getRewardEmoji(reward)}</span>
          <p class="reward-label">{getRewardLabel(reward)}</p>
          <p class="gaia-comment">{reward.gaiaMessage}</p>
        </div>
        <button
          type="button"
          class="collect-btn"
          onclick={collectReward}
          data-testid="analyzer-collect"
        >
          {reward.type === 'fact' ? 'View Knowledge' : 'Collect'}
        </button>
      {/if}
    </div>

  <!-- Stage 5: Done / fact choice / next -->
  {:else if stage === 5}
    <div class="stage stage-5" data-testid="analyzer-stage-5">
      {#if showFactChoice}
        <div class="fact-choice">
          <p class="fact-choice-title">Ancient Knowledge Discovered</p>
          <p class="fact-statement">
            {factsDB.getById(artifact.factId)?.statement ?? 'Unknown fact'}
          </p>
          <div class="fact-buttons">
            <button
              type="button"
              class="learn-btn"
              onclick={learnFact}
              data-testid="analyzer-learn"
            >
              Learn
            </button>
            <button
              type="button"
              class="sell-btn"
              onclick={sellFact}
              data-testid="analyzer-sell"
            >
              Sell for Dust
            </button>
          </div>
        </div>
      {:else}
        <div class="done-section">
          <p class="done-text">
            {#if reward}
              {getRewardEmoji(reward)} {getRewardLabel(reward)} collected!
            {:else}
              Artifact processed.
            {/if}
          </p>
          {#if remainingCount > 0}
            <button
              type="button"
              class="next-btn"
              onclick={goNextOrDone}
              data-testid="analyzer-next"
            >
              Next Artifact ({remainingCount} remaining)
            </button>
          {:else}
            <button
              type="button"
              class="done-btn"
              onclick={goNextOrDone}
              data-testid="analyzer-done"
            >
              Return to Hub
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Remaining count badge -->
  {#if remainingCount > 0 && stage < 5}
    <div class="remaining-badge">
      {remainingCount + 1} artifacts
    </div>
  {/if}
</div>

<style>
  .analyzer-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(10, 10, 25, 0.95);
    z-index: 200;
    font-family: 'Courier New', monospace;
    color: #e0e0e0;
    pointer-events: auto;
    padding: 1.5rem;
  }

  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    animation: fadeIn 300ms ease-out;
  }

  .artifact-crystal {
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 16px;
    background: radial-gradient(
      circle at 40% 40%,
      var(--rarity-color),
      rgba(0, 0, 0, 0.7)
    );
    box-shadow: 0 0 30px var(--rarity-color), 0 0 60px color-mix(in srgb, var(--rarity-color) 30%, transparent);
    border: none;
    cursor: default;
  }

  .artifact-crystal.crackable {
    cursor: pointer;
    animation: pulse 1.2s ease-in-out infinite;
  }

  .artifact-crystal.crackable:active {
    transform: scale(0.95);
  }

  .artifact-crystal.cracking {
    animation: shake 0.5s ease-in-out 3;
  }

  .crystal-icon {
    font-size: 3rem;
  }

  .crystal-icon.shatter {
    animation: shatter 1.5s ease-out forwards;
  }

  .crack-hint {
    position: absolute;
    bottom: -8px;
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 2px;
    font-weight: bold;
    animation: blink 1s ease-in-out infinite;
  }

  .stage-text {
    font-size: 0.85rem;
    color: #aaa;
    text-align: center;
  }

  .rarity-label {
    font-size: 0.75rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .reward-reveal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    animation: bounceIn 500ms ease-out;
  }

  .reward-emoji {
    font-size: 3.5rem;
    animation: float 2s ease-in-out infinite;
  }

  .reward-label {
    font-size: 1.1rem;
    font-weight: bold;
    color: #fff;
  }

  .gaia-comment {
    font-size: 0.75rem;
    color: #8be9fd;
    text-align: center;
    max-width: 320px;
    line-height: 1.5;
    font-style: italic;
  }

  .collect-btn,
  .next-btn,
  .done-btn {
    margin-top: 1rem;
    min-width: 180px;
    min-height: 48px;
    border: 2px solid var(--color-success, #4ade80);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-success, #4ade80) 20%, #1a1a2e 80%);
    color: var(--color-text, #e0e0e0);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 100ms ease, background 100ms ease;
  }

  .collect-btn:active,
  .next-btn:active,
  .done-btn:active {
    transform: scale(0.97);
  }

  .fact-choice {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    max-width: 360px;
  }

  .fact-choice-title {
    font-size: 1rem;
    font-weight: bold;
    color: #fbbf24;
  }

  .fact-statement {
    font-size: 0.8rem;
    color: #ccc;
    text-align: center;
    line-height: 1.6;
    background: rgba(255, 255, 255, 0.05);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .fact-buttons {
    display: flex;
    gap: 1rem;
    width: 100%;
  }

  .learn-btn,
  .sell-btn {
    flex: 1;
    min-height: 48px;
    border-radius: 10px;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 100ms ease;
  }

  .learn-btn {
    border: 2px solid #4ade80;
    background: color-mix(in srgb, #4ade80 20%, #1a1a2e 80%);
    color: #e0e0e0;
  }

  .sell-btn {
    border: 2px solid #fbbf24;
    background: color-mix(in srgb, #fbbf24 15%, #1a1a2e 85%);
    color: #e0e0e0;
  }

  .learn-btn:active,
  .sell-btn:active {
    transform: scale(0.97);
  }

  .done-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .done-text {
    font-size: 0.9rem;
    color: #ccc;
  }

  .remaining-badge {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(255, 255, 255, 0.1);
    color: #aaa;
    font-size: 0.65rem;
    padding: 4px 10px;
    border-radius: 12px;
    letter-spacing: 1px;
  }

  /* Animations */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 30px var(--rarity-color); }
    50% { transform: scale(1.05); box-shadow: 0 0 50px var(--rarity-color); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px) rotate(-2deg); }
    75% { transform: translateX(6px) rotate(2deg); }
  }

  @keyframes shatter {
    0% { transform: scale(1); opacity: 1; }
    40% { transform: scale(1.3); opacity: 0.8; }
    100% { transform: scale(0); opacity: 0; }
  }

  @keyframes bounceIn {
    0% { transform: scale(0); opacity: 0; }
    60% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  @keyframes blink {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .artifact-crystal.crackable { animation: none; }
    .artifact-crystal.cracking { animation: none; }
    .crystal-icon.shatter { animation: none; opacity: 0; }
    .reward-reveal { animation: none; }
    .reward-emoji { animation: none; }
    .crack-hint { animation: none; opacity: 1; }
    .stage { animation: none; }
  }
</style>
