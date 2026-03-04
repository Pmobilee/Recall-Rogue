<!-- Co-op HUD — compact overlay strip pinned below the main HUD.
     Shows both players' status, active buffs, and a quick-emote bar.
     Height is constrained to ≤ 40px to avoid occluding the mine grid. -->
<script lang="ts">
  import { coopRole, partnerStatus, activeBuff } from '../stores/coopState'
  import { wsClient } from '../../services/wsClient'

  let role = $derived($coopRole)
  let partner = $derived($partnerStatus)
  let buff = $derived($activeBuff)

  const EMOTES = ['👍', '⚡', '💎', '🆘'] as const
  type Emote = typeof EMOTES[number]

  function sendEmote(e: Emote): void {
    wsClient.send('chat:message', { text: e, emote: true })
  }
</script>

{#if role !== null && partner !== null}
  <div class="coop-hud" aria-label="Co-op Status">
    <div class="player-strip self">
      <span class="role-dot" class:miner={role === 'miner'} class:scholar={role === 'scholar'}></span>
      <span class="name">You ({role})</span>
    </div>

    <div class="player-strip partner" class:disconnected={!partner.connected}>
      <span class="role-dot" class:miner={partner.role === 'miner'} class:scholar={partner.role === 'scholar'}></span>
      <span class="name">{partner.displayName} ({partner.role})</span>
      {#if !partner.connected}
        <span class="dc-badge">DC</span>
      {/if}
    </div>

    {#if buff}
      <div class="buff-chip" title="Active buff expires tick {buff.expiresAtTick}">
        {buff.label}
      </div>
    {/if}

    <div class="emote-bar" aria-label="Quick emotes">
      {#each EMOTES as e}
        <button class="emote-btn" onclick={() => sendEmote(e)} aria-label={`Send emote ${e}`}>{e}</button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .coop-hud {
    position: fixed; top: 48px; left: 0; right: 0;
    display: flex; align-items: center; gap: 8px; padding: 4px 8px;
    background: rgba(22, 33, 62, 0.85); border-bottom: 1px solid #0f3460;
    z-index: 90; pointer-events: none; flex-wrap: wrap;
    max-height: 40px; overflow: hidden;
  }
  .player-strip { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #ccc; }
  .player-strip.disconnected { opacity: 0.4; }
  .role-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .role-dot.miner { background: #e94560; }
  .role-dot.scholar { background: #4ecca3; }
  .dc-badge { font-size: 9px; background: #e94560; color: #fff; padding: 1px 4px; border-radius: 3px; }
  .buff-chip {
    font-size: 9px; background: #4ecca3; color: #16213e;
    padding: 2px 8px; border-radius: 8px; font-weight: bold;
  }
  .emote-bar { margin-left: auto; display: flex; gap: 4px; pointer-events: auto; }
  .emote-btn {
    background: none; border: 1px solid #333; border-radius: 4px;
    font-size: 14px; cursor: pointer; padding: 2px 4px; line-height: 1;
  }
  .emote-btn:hover { background: rgba(255,255,255,0.1); }
</style>
