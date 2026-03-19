<script lang="ts">
  import type { Card } from '../../data/card-types'
  import { getBorderUrl, getBaseFrameUrl, getBannerUrl, getUpgradeIconUrl } from '../utils/cardFrameV2'
  import { getCardArtUrl } from '../utils/cardArtManifest'
  import { getCardDescriptionParts } from '../../services/cardDescriptionService'

  interface Props {
    card: Card
    onaccept: () => void
    onreject: () => void
  }

  let { card, onaccept, onreject }: Props = $props()

  let apCost = $derived(card.apCost ?? 1)

  const CARD_TYPE_COLORS: Record<string, string> = {
    attack: '#ff6b6b',
    shield: '#4dabf7',
    buff: '#cc5de8',
    debuff: '#ff8787',
    utility: '#ffd43b',
    wild: '#ff922b',
  }

  let typeColor = $derived(CARD_TYPE_COLORS[card.cardType] ?? '#aaaaaa')
</script>

<div class="reward-card-overlay" role="dialog" aria-modal="true">
  <button class="dim-bg" onclick={onreject} aria-label="Close"></button>

  <div class="detail-container">
    <!-- Card rendered IDENTICALLY to CardHand.svelte -->
    <div
      class="card-in-hand"
      class:card-upgraded={card.isUpgraded}
      style="--type-color: {typeColor};"
    >
      <div class="card-inner">
        <div class="card-front">
          <!-- V2 layered frame -->
          <div class="card-v2-frame">
            <img class="frame-layer" src={getBorderUrl(card.cardType)} alt="" style="z-index:0;" />
            {#if card.mechanicId}
              {@const artUrl = getCardArtUrl(card.mechanicId)}
              {#if artUrl}
                <img class="frame-card-art" src={artUrl} alt="" style="z-index:1;" />
              {/if}
            {/if}
            <img class="frame-layer" src={getBaseFrameUrl()} alt="" style="z-index:2;" />
            <img class="frame-layer" src={getBannerUrl(card.chainType ?? 0)} alt="" style="z-index:3;" />
            {#if card.isUpgraded}
              <img class="frame-layer upgrade-icon" src={getUpgradeIconUrl()} alt="" style="z-index:4;" />
            {/if}
          </div>
          <div class="ap-gem">{apCost}</div>
          <div class="card-parchment-text">
            <span class="parchment-inner">
              {#each getCardDescriptionParts(card) as part}
                {#if part.type === 'number'}
                  <span class="desc-number">{part.value}</span>
                {:else if part.type === 'keyword'}
                  <span class="desc-keyword">{part.value}</span>
                {:else if part.type === 'conditional-number'}
                  <span class="desc-conditional" class:active={part.active}>{part.active ? part.value : '0'}</span>
                {:else}
                  {part.value}
                {/if}
              {/each}
            </span>
          </div>
          {#if card.isUpgraded}
            <div class="card-tier-badge">+</div>
          {/if}
        </div>
      </div>
    </div>

    {#if card.isUpgraded}
      <div class="upgraded-label">UPGRADED</div>
    {/if}

    <div class="action-buttons">
      <button class="accept-btn" onclick={onaccept}>Accept</button>
      <button class="reject-btn" onclick={onreject}>Put Back</button>
    </div>
  </div>
</div>

<style>
  .reward-card-overlay {
    position: fixed;
    inset: 0;
    z-index: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 150ms ease-out;
  }

  .dim-bg {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    border: none;
    cursor: pointer;
  }

  .detail-container {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(16px * var(--layout-scale, 1));
    animation: scaleIn 200ms ease-out;
  }

  /* ─── EXACT COPY of CardHand.svelte card rendering CSS ─── */

  .card-in-hand {
    --card-w: calc(220px * var(--layout-scale, 1));
    --card-h: calc(var(--card-w) * 1.461);
    position: relative;
    width: var(--card-w);
    height: var(--card-h);
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    overflow: visible;
    font-family: inherit;
    color: white;
    perspective: 800px;
  }

  .card-upgraded {
    border: none !important;
    filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.6));
  }

  .upgraded-label {
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: calc(12px * var(--layout-scale, 1));
    font-weight: 700;
    color: #fbbf24;
    letter-spacing: 2px;
    text-shadow: 0 0 8px rgba(251, 191, 36, 0.4);
  }

  .card-inner {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .card-front {
    width: 100%;
    height: 100%;
    position: relative;
    border-radius: 6px;
    overflow: hidden;
  }

  /* === V2 card frame layers === */
  .card-v2-frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .frame-layer {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
    image-rendering: pixelated;
  }

  .frame-card-art {
    position: absolute;
    left: 14%;
    top: 12%;
    width: 72%;
    height: 48%;
    object-fit: cover;
    image-rendering: auto;
    pointer-events: none;
  }

  .upgrade-icon {
    animation: upgradeFloat 1.5s ease-in-out infinite;
  }

  @keyframes upgradeFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  .ap-gem {
    position: absolute;
    top: 1%;
    left: 1%;
    width: calc(var(--card-w) * 0.18);
    height: calc(var(--card-w) * 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: calc(var(--card-w) * 0.13);
    font-weight: 900;
    color: #fff;
    text-shadow: 0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.6);
    z-index: 2;
    pointer-events: none;
  }

  .card-parchment-text {
    position: absolute;
    top: 66%;
    bottom: 7%;
    left: 8%;
    right: 8%;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: calc(var(--card-w) * 0.09);
    font-weight: 700;
    line-height: 1.35;
    color: #2a1f14;
    -webkit-text-stroke: 0.3px rgba(0,0,0,0.4);
    text-shadow: 0 1px 1px rgba(0,0,0,0.15);
    z-index: 2;
    pointer-events: none;
    overflow: hidden;
  }

  .parchment-inner {
    display: inline;
  }

  .desc-number {
    font-weight: 900;
    color: #1a1208;
  }

  .desc-keyword {
    font-weight: 900;
  }

  .desc-conditional {
    color: #9ca3af;
    font-weight: 700;
  }

  .desc-conditional.active {
    color: #22c55e;
    font-weight: 900;
  }

  .card-tier-badge {
    position: absolute;
    top: 2%;
    right: 4%;
    font-size: calc(var(--card-w) * 0.16);
    font-weight: 900;
    color: #fbbf24;
    text-shadow: 0 0 8px rgba(251, 191, 36, 0.6), 0 2px 4px rgba(0,0,0,0.8);
    z-index: 3;
  }

  /* ─── Buttons ─── */

  .action-buttons {
    display: flex;
    gap: calc(10px * var(--layout-scale, 1));
  }

  .accept-btn {
    background: linear-gradient(180deg, #35c173, #249752);
    color: #fff;
    border: none;
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1));
    font-size: calc(15px * var(--layout-scale, 1));
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .reject-btn {
    background: #2d333b;
    color: #9ba4ad;
    border: none;
    border-radius: calc(10px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(24px * var(--layout-scale, 1));
    font-size: calc(15px * var(--layout-scale, 1));
    font-weight: 800;
    cursor: pointer;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from { transform: scale(0.85); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
</style>
