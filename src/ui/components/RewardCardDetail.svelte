<script lang="ts">
  import type { Card } from '../../data/card-types'
  import { getBorderUrl, getBaseFrameUrl, getBannerUrl, getUpgradeIconUrl, getMasteryIconFilter, hasMasteryGlow, GUIDE_STYLES } from '../utils/cardFrameV2'
  import { getCardArtUrl } from '../utils/cardArtManifest'
  import { getCardDescriptionParts } from '../../services/cardDescriptionService'

  interface Props {
    card: Card
    onaccept: () => void
    onreject: () => void
  }

  let { card, onaccept, onreject }: Props = $props()

  let apCost = $derived(card.apCost ?? 1)
</script>

<div class="reward-card-overlay" role="dialog" aria-modal="true">
  <button class="dim-bg" onclick={onreject} aria-label="Close"></button>

  <div class="detail-container">
    <!-- Card rendered IDENTICALLY to CardHand.svelte -->
    <div
      class="card-in-hand"
      class:card-upgraded={card.isUpgraded}
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
            {#if (card.masteryLevel ?? 0) > 0}
              <img
                class="frame-layer upgrade-icon mastery-bob"
                class:mastery-glow={hasMasteryGlow(card.masteryLevel ?? 0)}
                src={getUpgradeIconUrl()}
                alt=""
                style="z-index:4; filter: {getMasteryIconFilter(card.masteryLevel ?? 0)};"
              />
            {/if}
            <!-- AP cost overlay -->
            <div class="frame-text v2-ap-cost" style={GUIDE_STYLES.apCost}>{apCost}</div>
            <!-- Mechanic name overlay (on the banner) -->
            <div class="frame-text v2-mechanic-name" style={GUIDE_STYLES.mechanicName}>{card.mechanicName ?? ''}</div>
            <!-- Card type label overlay -->
            <div class="frame-text v2-card-type" style={GUIDE_STYLES.cardType}>{card.cardType?.toUpperCase() ?? ''}</div>
            <!-- Effect description text -->
            <div class="frame-text v2-effect-text" style={GUIDE_STYLES.effectText}>
              <span class="parchment-inner">
                {#each getCardDescriptionParts(card) as part}
                  {#if part.type === 'number'}
                    <span class="desc-number">{part.value}</span>
                  {:else if part.type === 'keyword'}
                    <span class="desc-keyword">{part.value}</span>
                  {:else if part.type === 'conditional-number'}
                    <span class="desc-conditional" class:active={part.active}>{part.active ? part.value : '0'}</span>
                  {:else if part.type === 'mastery-bonus'}
                    <span class="desc-mastery-bonus">{part.value}</span>
                  {:else}
                    {part.value}
                  {/if}
                {/each}
              </span>
            </div>
          </div>
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
    --card-w: calc(280px * var(--layout-scale, 1));
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
    image-rendering: auto;
  }

  .frame-card-art {
    position: absolute;
    /* Exact position from PSD layer "PLACE WHERE ARTWORK GOES" bbox(176,186,719,609) on 886x1142 */
    left: 19.9%;
    top: 16.3%;
    width: 61.3%;
    height: 37.0%;
    object-fit: cover;
    image-rendering: auto;
    pointer-events: none;
    border-radius: 4px;
  }

  .upgrade-icon {
    animation: upgradeFloat 1.5s ease-in-out infinite;
  }

  @keyframes upgradeFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  /* AR-113: Mastery float bob */
  .mastery-bob {
    animation: masteryBob 2.2s ease-in-out infinite !important;
  }

  @keyframes masteryBob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  /* AR-113: Gold glow for fully mastered (level 5) cards */
  .mastery-glow {
    filter: hue-rotate(60deg) saturate(2) brightness(1.3) drop-shadow(0 0 6px rgba(234, 179, 8, 0.8)) drop-shadow(0 0 12px rgba(234, 179, 8, 0.4)) !important;
  }

  .frame-text {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 5;
    overflow: hidden;
  }

  .v2-ap-cost {
    font-family: 'Cinzel', 'Georgia', serif;
    font-weight: 900;
    font-size: calc(var(--card-w) * 0.22);
    color: #fbbf24;
    -webkit-text-stroke: 1.5px #000;
    text-shadow:
      1px 1px 0 #000, -1px -1px 0 #000,
      1px -1px 0 #000, -1px 1px 0 #000,
      2px 2px 0 #000, -2px -2px 0 #000,
      0 2px 4px rgba(0,0,0,0.6);
    line-height: 1;
  }

  .v2-mechanic-name {
    font-family: 'Cinzel', 'Georgia', serif;
    font-weight: 700;
    font-size: calc(var(--card-w) * 0.08);
    color: #ffffff;
    text-transform: capitalize;
    text-shadow: 0 1px 3px rgba(0,0,0,0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .v2-card-type {
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 700;
    font-size: calc(var(--card-w) * 0.032);
    color: #e0e0e0;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: center;
    align-items: center;
    justify-content: center;
  }

  .v2-effect-text {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: calc(var(--card-w) * 0.08);
    font-weight: 600;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    align-items: center;
    justify-content: center;
    text-align: center;
    line-height: 1.3;
    overflow: hidden;
    word-break: break-word;
  }

  .parchment-inner {
    display: block;
    width: 100%;
    text-align: center;
  }

  .desc-number {
    font-family: inherit;
    font-weight: 900;
    color: #ffffff;
    text-shadow: 0 1px 3px rgba(0,0,0,0.6);
  }

  .desc-keyword {
    font-weight: 700;
  }

  .desc-conditional {
    color: #9ca3af;
    font-weight: 700;
  }

  .desc-conditional.active {
    color: #22c55e;
    font-weight: 900;
  }

  .desc-mastery-bonus {
    font-family: 'Cinzel', 'Georgia', serif;
    font-weight: 900;
    color: #4ade80;
    text-shadow: 0 0 4px rgba(74, 222, 128, 0.4), 0 1px 2px rgba(0,0,0,0.6);
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
