<script lang="ts">
  import { BALANCE } from '../../data/balance'
  import { playerSave } from '../stores/playerData'
  import { getGM } from '../../game/gameManagerRef'
  import { activeAltar, currentScreen } from '../stores/gameState'

  // Sacrifice tier entries derived from balance constants
  const tiers = Object.entries(
    BALANCE.ALTAR_SACRIFICE_COSTS as Record<string, Record<string, number>>
  ) as [string, Record<string, number>][]

  const TIER_LABELS: Record<string, string> = {
    tier1: 'Offering I — Uncommon Artifact',
    tier2: 'Offering II — Rare Artifact',
    tier3: 'Offering III — Epic Artifact',
    tier4: 'Offering IV — Legendary Artifact',
  }

  /**
   * Check whether the player has enough minerals for a given cost.
   */
  function canAfford(cost: Record<string, number>): boolean {
    const save = $playerSave
    if (!save) return false
    return Object.entries(cost).every(([tier, amt]) =>
      (save.minerals[tier as keyof typeof save.minerals] ?? 0) >= amt
    )
  }

  /**
   * Format a cost object as a human-readable string.
   */
  function formatCost(cost: Record<string, number>): string {
    return Object.entries(cost)
      .map(([tier, amt]) => `${amt} ${tier}`)
      .join(' + ')
  }

  /**
   * Initiate a sacrifice at the given tier. Delegates to GameManager.
   */
  function sacrifice(tier: string): void {
    getGM()?.completeSacrifice(tier)
  }

  /**
   * Leave the altar without sacrificing anything.
   */
  function leave(): void {
    activeAltar.set(null)
    currentScreen.set('mining')
  }
</script>

{#if $currentScreen === 'sacrifice' && $activeAltar}
  <div class="altar-overlay" role="dialog" aria-label="Offering Altar">
    <div class="altar-card">
      <h2 class="altar-title">Offering Altar</h2>
      <p class="altar-flavor">
        "Ancient machines still hunger. What will you give?"
        <span class="gaia-tag">— G.A.I.A.</span>
      </p>

      <div class="tier-list">
        {#each tiers as [tierId, cost]}
          {@const affordable = canAfford(cost)}
          <button
            class="tier-btn"
            class:affordable
            disabled={!affordable}
            onclick={() => sacrifice(tierId)}
            aria-label="{TIER_LABELS[tierId] ?? tierId}: costs {formatCost(cost)}"
          >
            <span class="tier-label">{TIER_LABELS[tierId] ?? tierId}</span>
            <span class="tier-cost">{formatCost(cost)}</span>
          </button>
        {/each}
      </div>

      <button class="leave-btn" onclick={leave}>
        Leave Altar
      </button>
    </div>
  </div>
{/if}

<style>
  .altar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
  }
  .altar-card {
    background: #1a0e2a;
    border: 2px solid #9944cc;
    border-radius: 12px;
    padding: 24px;
    max-width: 340px;
    width: 90%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .altar-title {
    color: #cc88ff;
    font-size: 1.3rem;
    text-align: center;
    margin: 0;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.06em;
  }
  .altar-flavor {
    color: #aa88cc;
    font-size: 0.85rem;
    text-align: center;
    margin: 0;
    font-style: italic;
  }
  .gaia-tag {
    display: block;
    font-size: 0.75rem;
    color: #9944cc;
    margin-top: 4px;
  }
  .tier-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tier-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 10px 14px;
    background: #2a1a3e;
    border: 1px solid #6622aa;
    border-radius: 8px;
    cursor: pointer;
    color: #888;
    transition: border-color 0.15s, color 0.15s;
  }
  .tier-btn.affordable {
    border-color: #9944cc;
    color: #cc88ff;
  }
  .tier-btn.affordable:hover {
    background: #3a1a4e;
    border-color: #cc66ff;
  }
  .tier-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .tier-label {
    font-size: 0.9rem;
    font-weight: bold;
  }
  .tier-cost {
    font-size: 0.75rem;
    margin-top: 2px;
    color: #aaa;
  }
  .tier-btn.affordable .tier-cost {
    color: #cc99ff;
  }
  .leave-btn {
    padding: 10px;
    background: transparent;
    border: 1px solid #555;
    border-radius: 8px;
    color: #888;
    font-size: 0.9rem;
    cursor: pointer;
    text-align: center;
  }
  .leave-btn:hover {
    border-color: #888;
    color: #aaa;
  }
</style>
