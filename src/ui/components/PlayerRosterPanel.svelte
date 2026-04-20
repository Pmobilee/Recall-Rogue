<!-- PlayerRosterPanel.svelte
     Overlay panel showing each other player's HP, block value, and quiz stats.
     Opened by clicking the roster-trigger pill on the player's HP bar during
     a multiplayer run with more than 2 max players (trivia_night, race 3-4).

     Props:
       open           — whether the panel is visible
       players        — Record<playerId, PartnerState> from multiplayerCoopSync
       lobbyPlayers   — LobbyPlayer[] from the lobby for display name lookup
       localPlayerId  — the local player's ID (excluded from the list)
       onclose        — called to close the panel -->
<script lang="ts">
  import { onMount } from 'svelte'
  import type { PartnerState } from '../../services/multiplayerCoopSync'
  import type { LobbyPlayer } from '../../data/multiplayerTypes'

  interface Props {
    open: boolean
    players: Record<string, PartnerState>
    lobbyPlayers: LobbyPlayer[]
    localPlayerId: string
    onclose: () => void
  }

  let { open, players, lobbyPlayers, localPlayerId, onclose }: Props = $props()

  /** Sorted list of other players' states with display names resolved. */
  let otherPlayers = $derived.by(() => {
    return Object.values(players)
      .filter(p => p.playerId !== localPlayerId)
      .map(p => {
        const lobbyEntry = lobbyPlayers.find(lp => lp.id === p.playerId)
        return {
          ...p,
          displayName: lobbyEntry?.displayName ?? `Player`,
        }
      })
      .sort((a, b) => (a.maxHp === 0 ? 1 : a.hp / a.maxHp) - (b.maxHp === 0 ? 1 : b.hp / b.maxHp))
  })

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      onclose()
    }
  }

  function handleBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('roster-backdrop')) {
      onclose()
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  })

  function hpColor(hp: number, maxHp: number): string {
    const ratio = maxHp > 0 ? hp / maxHp : 1
    if (ratio >= 0.6) return '#22c55e'
    if (ratio >= 0.3) return '#f59e0b'
    return '#ef4444'
  }
</script>

{#if open}
  <div
    class="roster-backdrop"
    data-testid="roster-panel"
    role="presentation"
    onclick={handleBackdropClick}
    onkeydown={(e) => { if (e.key === 'Escape') onclose() }}
  >
    <div class="roster-panel" role="dialog" aria-modal="true" aria-label="Other players" tabindex="-1">
      <div class="roster-header">
        <span class="roster-title">Other players</span>
        <button
          class="roster-close-btn"
          data-testid="roster-close-btn"
          aria-label="Close"
          onclick={onclose}
        >&#10005;</button>
      </div>

      <div class="roster-body">
        {#if otherPlayers.length === 0}
          <p class="roster-empty" data-testid="roster-empty">No other players yet.</p>
        {:else}
          <ul class="roster-list" aria-label="Player list">
            {#each otherPlayers as p (p.playerId)}
              <li class="roster-row">
                <div class="roster-name-row">
                  <span class="roster-name">{p.displayName}</span>
                  {#if p.block > 0}
                    <span class="roster-block-badge" title="Block">
                      <span aria-hidden="true">🛡️</span>
                      <span class="roster-block-value">{p.block}</span>
                    </span>
                  {/if}
                </div>
                <div class="roster-hp-row">
                  <div class="roster-hp-track" role="progressbar" aria-valuenow={p.hp} aria-valuemin={0} aria-valuemax={p.maxHp} aria-label="{p.displayName} health">
                    <div
                      class="roster-hp-fill"
                      style="width: {p.maxHp > 0 ? Math.max(0, Math.min(100, Math.round(p.hp / p.maxHp * 100))) : 0}%; background: {hpColor(p.hp, p.maxHp)};"
                    ></div>
                    <span class="roster-hp-text">{p.hp}/{p.maxHp}</span>
                  </div>
                </div>
                {#if p.score != null || p.accuracy != null}
                  <div class="roster-stats-row">
                    {#if p.score != null}
                      <span class="roster-stat">Score: {p.score}</span>
                    {/if}
                    {#if p.accuracy != null}
                      <span class="roster-stat">Accuracy: {Math.round(p.accuracy * 100)}%</span>
                    {/if}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <!-- Escape hatch always visible (softlock prevention) -->
      <div class="roster-footer">
        <button
          class="roster-done-btn"
          data-testid="roster-close-btn-footer"
          onclick={onclose}
        >Close</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ===== Backdrop ===== */
  .roster-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ===== Panel ===== */
  .roster-panel {
    background: #181C26;
    border: 1px solid #2A2E38;
    border-radius: calc(10px * var(--layout-scale, 1));
    width: calc(360px * var(--layout-scale, 1));
    max-width: 90vw;
    max-height: 75vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 calc(16px * var(--layout-scale, 1)) calc(48px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.6);
  }

  /* ===== Header ===== */
  .roster-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(14px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border-bottom: 1px solid #2A2E38;
    flex-shrink: 0;
  }

  .roster-title {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(14px * var(--text-scale, 1));
    font-weight: 600;
    color: #FFD700;
    letter-spacing: 0.04em;
  }

  .roster-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(32px * var(--layout-scale, 1));
    height: calc(32px * var(--layout-scale, 1));
    min-width: calc(44px * var(--layout-scale, 1));
    min-height: calc(44px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #2A2E38;
    border-radius: calc(5px * var(--layout-scale, 1));
    color: #888;
    font-size: calc(14px * var(--text-scale, 1));
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .roster-close-btn:hover {
    background: rgba(255, 255, 255, 0.10);
    color: #e0e0e0;
  }

  /* ===== Body ===== */
  .roster-body {
    flex: 1;
    overflow-y: auto;
    padding: calc(12px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
  }

  /* ===== Empty state ===== */
  .roster-empty {
    color: #666;
    font-family: var(--font-body, 'Lora', serif);
    font-size: calc(13px * var(--text-scale, 1));
    font-style: italic;
    text-align: center;
    padding: calc(20px * var(--layout-scale, 1)) 0;
    margin: 0;
  }

  /* ===== Player list ===== */
  .roster-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .roster-row {
    display: flex;
    flex-direction: column;
    gap: calc(5px * var(--layout-scale, 1));
    padding: calc(10px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid #2A2E38;
    border-radius: calc(7px * var(--layout-scale, 1));
  }

  .roster-name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(8px * var(--layout-scale, 1));
  }

  .roster-name {
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(13px * var(--text-scale, 1));
    font-weight: 600;
    color: #e0e0e0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .roster-block-badge {
    display: inline-flex;
    align-items: center;
    gap: calc(3px * var(--layout-scale, 1));
    background: rgba(52, 152, 219, 0.18);
    border: 1px solid rgba(52, 152, 219, 0.35);
    border-radius: calc(4px * var(--layout-scale, 1));
    padding: calc(1px * var(--layout-scale, 1)) calc(6px * var(--layout-scale, 1));
    font-size: calc(11px * var(--text-scale, 1));
    color: #87cefa;
    flex-shrink: 0;
  }

  .roster-block-value {
    font-weight: 700;
    line-height: 1;
  }

  /* ===== HP bar ===== */
  .roster-hp-row {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .roster-hp-track {
    flex: 1;
    height: calc(18px * var(--layout-scale, 1));
    border-radius: 999px;
    border: 1px solid rgba(100, 116, 139, 0.5);
    background: rgba(15, 23, 42, 0.80);
    overflow: hidden;
    position: relative;
  }

  .roster-hp-fill {
    height: 100%;
    min-width: calc(3px * var(--layout-scale, 1));
    border-radius: 999px;
    transition: width 200ms ease, background 200ms ease;
  }

  .roster-hp-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(9px * var(--text-scale, 1));
    color: #fff;
    font-weight: 700;
    letter-spacing: 0.3px;
    text-shadow:
      -1px 0 #000,
      1px 0 #000,
      0 -1px #000,
      0 1px #000;
    pointer-events: none;
  }

  /* ===== Stats row ===== */
  .roster-stats-row {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
    flex-wrap: wrap;
  }

  .roster-stat {
    font-family: var(--font-body, 'Lora', serif);
    font-size: calc(11px * var(--text-scale, 1));
    color: #888;
  }

  /* ===== Footer ===== */
  .roster-footer {
    padding: calc(10px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1));
    border-top: 1px solid #2A2E38;
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
  }

  .roster-done-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: calc(36px * var(--layout-scale, 1));
    padding: calc(7px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    background: rgba(255, 215, 0, 0.10);
    border: 1px solid rgba(255, 215, 0, 0.30);
    border-radius: calc(5px * var(--layout-scale, 1));
    color: #FFD700;
    font-family: var(--font-rpg, 'Cinzel', serif);
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .roster-done-btn:hover {
    background: rgba(255, 215, 0, 0.20);
    border-color: rgba(255, 215, 0, 0.55);
  }
</style>
