<script lang="ts">
  import type { ArtifactReward } from '../../data/artifactLootTable';
  import type { PendingArtifact, Rarity } from '../../data/types';
  import { rollArtifactReward } from '../../data/artifactLootTable';
  import { computeStudyScore } from '../../services/studyScore';
  import { playerSave, addMinerals, discoverFact, persistPlayer, savePendingArtifacts } from '../stores/playerData';
  import { pendingArtifacts, activeFact } from '../stores/gameState';
  import { factsDB } from '../../services/factsDB';
  import { get } from 'svelte/store';

  interface Props {
    artifacts: PendingArtifact[];
    onDone: () => void;
  }

  type CellState = {
    artifact: PendingArtifact;
    cracked: boolean;
    reward: ArtifactReward | null;
    factHandled: boolean;
    animating: boolean;
  };

  const RARITY_COLORS: Record<Rarity, string> = {
    common: '#b0b0b0',
    uncommon: '#4ade80',
    rare: '#60a5fa',
    epic: '#a78bfa',
    legendary: '#fbbf24',
    mythic: '#f472b6',
  };

  const RARITY_ORDER: Record<Rarity, number> = {
    mythic: 0,
    legendary: 1,
    epic: 2,
    rare: 3,
    uncommon: 4,
    common: 5,
  };

  const SELL_DUST: Record<Rarity, number> = {
    common: 5,
    uncommon: 10,
    rare: 20,
    epic: 40,
    legendary: 80,
    mythic: 150,
  };

  const REWARD_EMOJI: Record<string, string> = {
    fact: '\u{1F4DC}',
    dust: '\u{1F48E}',
    consumable: '\u{1F9EA}',
    fossil: '\u{1F9B4}',
    upgrade_token: '\u{2699}\u{FE0F}',
    junk: '\u{1FAA8}',
  };

  let { artifacts, onDone }: Props = $props();

  function initCells(arts: PendingArtifact[]): CellState[] {
    return [...arts].sort(
      (a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]
    ).map((a) => ({
      artifact: a,
      cracked: false,
      reward: null,
      factHandled: false,
      animating: false,
    }));
  }

  let cells: CellState[] = $state(initCells(artifacts));

  let allDone = $derived(
    cells.every((c) => c.cracked && (c.reward?.type !== 'fact' || c.factHandled))
  );

  function getRewardEmoji(reward: ArtifactReward): string {
    return REWARD_EMOJI[reward.type] ?? '\u{2753}';
  }

  function getShortLabel(reward: ArtifactReward): string {
    if (reward.type === 'dust' || reward.type === 'junk') {
      return `\u00D7${reward.amount ?? 1}`;
    }
    if (reward.type === 'fact') return 'Knowledge';
    return '';
  }

  function applyNonFactReward(reward: ArtifactReward): void {
    switch (reward.type) {
      case 'dust':
      case 'junk':
        addMinerals(reward.dustTier ?? 'dust', reward.amount ?? 1);
        break;
      case 'consumable':
        playerSave.update(s => {
          if (!s) return s;
          const consumables = { ...(s.consumables ?? {}) };
          const key = reward.itemId ?? 'bomb';
          consumables[key] = (consumables[key] ?? 0) + (reward.amount ?? 1);
          return { ...s, consumables };
        });
        break;
      case 'fossil':
        playerSave.update(s => {
          if (!s) return s;
          const fossils = { ...s.fossils };
          const speciesId = reward.itemId ?? 'fossil_0';
          if (!fossils[speciesId]) {
            fossils[speciesId] = { speciesId, fragmentsFound: 1, fragmentsNeeded: 5, revived: false };
          } else {
            fossils[speciesId] = { ...fossils[speciesId], fragmentsFound: fossils[speciesId].fragmentsFound + 1 };
          }
          return { ...s, fossils };
        });
        break;
      case 'upgrade_token':
        playerSave.update(s => s ? { ...s, upgradeTokens: (s.upgradeTokens ?? 0) + (reward.amount ?? 1) } : s);
        break;
    }
  }

  function removeFromPending(artifact: PendingArtifact): void {
    pendingArtifacts.update((arr) => arr.filter((a) => a.minedAt !== artifact.minedAt || a.rarity !== artifact.rarity));
    savePendingArtifacts(get(pendingArtifacts));
    persistPlayer();
  }

  /** Pick a random fact the player hasn't learned/discovered/sold yet. */
  function pickFreshFactId(): string | undefined {
    const save = get(playerSave);
    if (!save) return undefined;
    const excludeSet = new Set([
      ...save.learnedFacts,
      ...save.discoveredFacts,
      ...(save.soldFacts ?? []),
      // Exclude facts already assigned to other cracked cells in this grid
      ...cells.filter(c => c.cracked && c.reward?.factId).map(c => c.reward!.factId!),
    ]);
    const allIds = factsDB.getAllIds().filter(id => !excludeSet.has(id));
    if (allIds.length === 0) return undefined;
    return allIds[Math.floor(Math.random() * allIds.length)];
  }

  function crackCell(index: number): void {
    const cell = cells[index];
    if (cell.cracked || cell.animating) return;

    const save = get(playerSave);
    const studyScore = save ? computeStudyScore(save) : 0.5;
    const reward = rollArtifactReward(cell.artifact, studyScore, Math.random);

    // Pick a fresh fact at crack time instead of using pre-assigned factId
    if (reward.type === 'fact') {
      const freshId = pickFreshFactId();
      if (freshId) {
        reward.factId = freshId;
      }
    }

    cells[index].animating = true;

    setTimeout(() => {
      cells[index].cracked = true;
      cells[index].reward = reward;
      cells[index].animating = false;

      if (reward.type !== 'fact') {
        applyNonFactReward(reward);
        removeFromPending(cell.artifact);
      }
    }, 400);
  }

  function learnFact(index: number): void {
    const cell = cells[index];
    if (!cell.reward || cell.factHandled) return;
    discoverFact(cell.reward!.factId ?? cell.artifact.factId);
    removeFromPending(cell.artifact);
    cells[index].factHandled = true;
  }

  function sellFact(index: number): void {
    const cell = cells[index];
    if (!cell.reward || cell.factHandled) return;
    addMinerals('dust', SELL_DUST[cell.artifact.rarity]);
    removeFromPending(cell.artifact);
    cells[index].factHandled = true;
  }

  function stopProp(fn: () => void) {
    return (e: Event) => {
      e.stopPropagation();
      fn();
    };
  }
</script>

<div class="artifact-grid-overlay">
  <h2>Artifacts Found <span class="count">{artifacts.length}</span></h2>

  <div class="grid">
    {#each cells as cell, i}
      <button
        class="cell"
        class:cracked={cell.cracked}
        class:animating={cell.animating}
        onclick={() => crackCell(i)}
        style="--rarity-color: {RARITY_COLORS[cell.artifact.rarity]}"
      >
        {#if !cell.cracked && !cell.animating}
          <span class="crystal">{'\u{1F48E}'}</span>
        {:else if cell.cracked && cell.reward}
          <span class="reward-icon">{getRewardEmoji(cell.reward)}</span>
          <span class="reward-text">{getShortLabel(cell.reward)}</span>
          {#if cell.reward.type === 'fact' && !cell.factHandled}
            <div class="fact-actions">
              <span role="button" tabindex="0" class="fact-btn" onclick={stopProp(() => learnFact(i))} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); learnFact(i); } }}>{'\u{1F4D6}'}</span>
              <span role="button" tabindex="0" class="fact-btn" onclick={stopProp(() => sellFact(i))} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); sellFact(i); } }}>{'\u{1F4B0}'}</span>
            </div>
          {/if}
        {/if}
      </button>
    {/each}
  </div>

  {#if allDone}
    <button class="done-btn" onclick={onDone}>Return to Hub</button>
  {/if}
</div>

<style>
  .artifact-grid-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(10, 10, 25, 0.95);
    z-index: 200;
    overflow-y: auto;
    padding: 1.5rem 1rem;
  }

  h2 {
    text-align: center;
    margin-bottom: 1rem;
    font-size: 1rem;
    color: #e0e0e0;
    font-family: monospace;
  }

  .count {
    opacity: 0.5;
    font-size: smaller;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
  }

  .cell {
    aspect-ratio: 1;
    width: 100%;
    border-radius: 12px;
    border: 2px solid var(--rarity-color);
    background: linear-gradient(135deg, rgba(20, 20, 40, 0.9), rgba(30, 30, 60, 0.7));
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    padding: 0;
    color: inherit;
    font: inherit;
    transition: transform 0.15s ease;
  }

  .cell:not(.cracked) {
    box-shadow: 0 0 8px var(--rarity-color), 0 0 16px color-mix(in srgb, var(--rarity-color) 40%, transparent);
    animation: pulse 2s ease-in-out infinite;
  }

  .cell:not(.cracked):active {
    transform: scale(0.95);
  }

  .cell.cracked {
    cursor: default;
    background: rgba(20, 20, 40, 0.5);
  }

  .cell.animating {
    animation: crackReveal 0.4s ease-out forwards;
    pointer-events: none;
  }

  .crystal {
    font-size: 2.5rem;
  }

  .reward-icon {
    font-size: 2rem;
  }

  .reward-text {
    font-size: 0.8rem;
    color: #ccc;
  }

  .fact-actions {
    display: flex;
    flex-direction: row;
    gap: 8px;
    position: absolute;
    bottom: 6px;
  }

  .fact-actions .fact-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    font-size: 1.1rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: inherit;
  }

  .fact-actions .fact-btn:active {
    background: rgba(255, 255, 255, 0.15);
  }

  .done-btn {
    margin-top: 1.5rem;
    padding: 0.75rem 2rem;
    background: linear-gradient(135deg, #4ade80, #22c55e);
    color: #0a0a19;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 700;
    font-family: monospace;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .done-btn:active {
    transform: scale(0.97);
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 8px var(--rarity-color), 0 0 16px color-mix(in srgb, var(--rarity-color) 40%, transparent); }
    50% { box-shadow: 0 0 12px var(--rarity-color), 0 0 24px color-mix(in srgb, var(--rarity-color) 60%, transparent); }
  }

  @keyframes crackReveal {
    0% { transform: scale(1); opacity: 1; }
    30% { transform: scale(1.2); opacity: 0.5; }
    60% { transform: scale(0); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .cell:not(.cracked) {
      animation: none;
    }
    .cell.animating {
      animation: none;
    }
  }
</style>
