<script lang="ts">
  /**
   * CardVisual.svelte — Shared read-only card frame renderer.
   *
   * This component renders the V2 layered card frame (border, art, base, banner,
   * upgrade icon, mechanic name, chain pill, effect text, AP cost) identically
   * everywhere it is used — CardHand and CardPickerOverlay both import this to
   * guarantee pixel-perfect parity.
   *
   * IMPORTANT: This component is display-only. No click handlers, no drag logic,
   * no state machine. All interaction is the caller's responsibility.
   *
   * CSS for the v2 frame lives HERE. CardHand and CardPickerOverlay must NOT
   * duplicate these rules — doing so caused visual drift that required this
   * extraction in the first place (see docs/gotchas.md 2026-04-09).
   */
  import type { Card } from '../../data/card-types'
  import {
    getBorderUrl,
    getBaseFrameUrl,
    getBannerUrl,
    getUpgradeIconUrl,
    getMasteryIconFilter,
    hasMasteryGlow,
    GUIDE_STYLES,
  } from '../utils/cardFrameV2'
  import { getCardArtUrl } from '../utils/cardArtManifest'
  import { getCardDescriptionParts, type CardDescPart } from '../../services/cardDescriptionService'
  import { getChainColor } from '../../services/chainVisuals'
  import { getMasteryStats, getEffectiveApCost } from '../../services/cardUpgradeService'
  import { stretchText } from '../utils/stretchText'
  import { CHARGE_CORRECT_MULTIPLIER } from '../../data/balance'
  import { getMechanicDefinition } from '../../data/mechanics'

  interface Props {
    card: Card
    /** Effect value override — hand uses this for charge preview numbers. */
    effectValue?: number | undefined
    /** When true, numbers render with golden charge-preview tint. */
    isChargePreview?: boolean
    /** When true, numbers render with green btn-charge-preview tint. */
    isBtnChargePreview?: boolean
    /** Damage modifier state for number coloring. */
    modState?: 'buffed' | 'nerfed' | 'neutral' | null
    /** Per-card mastery flash direction. */
    masteryFlash?: 'up' | 'down' | null
    /** AP cost display value (caller computes this to support surge/focus discounts). */
    displayedApCost?: string | number
    /** AP gem CSS color override (e.g. for insufficient-AP states). */
    apGemColor?: string | null
    /** Whether to show the mastery glow on the upgrade icon. */
    showMasteryGlow?: boolean
    /** Chain-pill pulse animation (active chain match). */
    chainPillActive?: boolean
  }

  let {
    card,
    effectValue = undefined,
    isChargePreview = false,
    isBtnChargePreview = false,
    modState = null,
    masteryFlash = null,
    displayedApCost = undefined,
    apGemColor = null,
    showMasteryGlow = true,
    chainPillActive = false,
  }: Props = $props()

  /** Compute the AP cost to display (caller may override). */
  let apDisplay = $derived(
    displayedApCost !== undefined ? displayedApCost : getEffectiveApCost(card)
  )

  /** Compute effect value from mastery stats when not overridden by caller. */
  function resolveEffectValue(): number {
    if (effectValue !== undefined) return effectValue
    const mechanic = getMechanicDefinition(card.mechanicId)
    if (mechanic) {
      const stats = getMasteryStats(card.mechanicId ?? '', card.masteryLevel ?? 0)
      return stats?.qpValue ?? mechanic.quickPlayValue
    }
    const base = Math.round(card.baseEffectValue * card.effectMultiplier)
    const fallbackStats = getMasteryStats(card.mechanicId ?? '', card.masteryLevel ?? 0)
    const masteryBonus = fallbackStats ? (fallbackStats.qpValue - base) : 0
    return base + masteryBonus
  }

  /** Compute CSS size class for effect text based on total description length. */
  function effectTextSizeClass(): string {
    const parts = getCardDescriptionParts(card)
    const desc = parts.map(p => p.value).join('')
    if (desc.length > 35) return 'effect-text-xs'
    if (desc.length > 25) return 'effect-text-sm'
    if (desc.length > 15) return 'effect-text-md'
    return ''
  }

  /** Split a flat CardDescPart[] into lines wherever a text part contains '\n'. */
  function groupIntoLines(parts: CardDescPart[]): CardDescPart[][] {
    const lines: CardDescPart[][] = [[]]
    for (const p of parts) {
      if (p.type === 'text' && p.value.includes('\n')) {
        const segs = p.value.split('\n')
        for (let i = 0; i < segs.length; i++) {
          if (segs[i]) lines[lines.length - 1].push({ type: 'text', value: segs[i] })
          if (i < segs.length - 1) lines.push([])
        }
      } else {
        lines[lines.length - 1].push(p)
      }
    }
    return lines.filter(l => l.length > 0)
  }
</script>

<!-- V2 layered frame system — single source of truth for card rendering -->
<div class="card-v2-frame">
  <!-- Layer 1: Border (by card type) -->
  <img class="frame-layer" src={getBorderUrl(card.cardType)} alt="" />
  <!-- Layer 1.5: Card art in pentagon window (behind base frame mask) -->
  {#if card.mechanicId}
    {@const artUrl = getCardArtUrl(card.mechanicId)}
    {#if artUrl}
      <img class="frame-card-art" src={artUrl} alt="" />
    {/if}
  {/if}
  <!-- Layer 2: Base frame (constant) -->
  <img class="frame-layer" src={getBaseFrameUrl()} alt="" />
  <!-- Layer 3: Banner (by chain type) -->
  <img class="frame-layer" src={getBannerUrl(card.chainType ?? 0)} alt="" />
  <!-- Layer 4: Upgrade icon (conditional, bob animation) -->
  {#if (card.masteryLevel ?? 0) > 0}
    <img
      class="frame-layer upgrade-icon mastery-bob"
      class:mastery-glow={showMasteryGlow && hasMasteryGlow(card.masteryLevel ?? 0)}
      src={getUpgradeIconUrl()}
      alt=""
      style="filter: {getMasteryIconFilter(card.masteryLevel ?? 0)};"
    />
  {/if}
  <!-- Mechanic name overlay — stretchText scales text to fill the name banner -->
  <div class="frame-text v2-mechanic-name" style={GUIDE_STYLES.mechanicName} use:stretchText>{card.mechanicName ?? ''}</div>
  <!-- Chain color pill — on top, sized to match frame's card-type cutout -->
  <div
    class="frame-text v2-card-type"
    class:pill-chain-active={chainPillActive}
    style="{GUIDE_STYLES.cardTypePill} background-color: {getChainColor(card.chainType ?? 0)}; --pill-color: {getChainColor(card.chainType ?? 0)};"
  ></div>
  <!-- Effect description text (rich parts) -->
  <div class="frame-text v2-effect-text {effectTextSizeClass()}" style={GUIDE_STYLES.effectText}>
    <span class="parchment-inner">
      {#each groupIntoLines(getCardDescriptionParts(card, undefined, resolveEffectValue())) as line}
        <div class="desc-line">
          {#each line as part}
            {#if part.type === 'number'}
              <span
                class="desc-number"
                class:charge-preview={isChargePreview && !isBtnChargePreview}
                class:charge-preview-btn={isBtnChargePreview}
                class:mastery-flash-up={masteryFlash === 'up'}
                class:mastery-flash-down={masteryFlash === 'down'}
                class:damage-buffed={modState === 'buffed'}
                class:damage-nerfed={modState === 'nerfed'}
              >{part.value}</span>
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
        </div>
      {/each}
    </span>
  </div>
</div>
<!-- AP cost OUTSIDE card-v2-frame so it can overflow the frame boundary -->
<div
  class="frame-text v2-ap-cost"
  class:mastery-flash-up={masteryFlash === 'up'}
  class:mastery-flash-down={masteryFlash === 'down'}
  style={GUIDE_STYLES.apCost}
  style:color={apGemColor ?? undefined}
>{apDisplay}</div>

<style>
  /* ── Card Frame V2 — single source of truth ──────────────── */

  .card-v2-frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden; /* clips art to frame boundaries */
  }

  /* frame-layer: object-fit MUST be contain (not fill) — fill distorts the frame images */
  .frame-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
    image-rendering: pixelated; /* crisp pixel art rendering */
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

  /* Mastery float bob — gentle hover animation for upgraded cards */
  .mastery-bob {
    animation: masteryBob 2.2s ease-in-out infinite !important;
  }

  @keyframes masteryBob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }

  /* Gold glow for fully mastered (level 5) cards */
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

  /* AP cost gem (outside card-v2-frame, overlaps the book icon) */
  .v2-ap-cost {
    font-family: 'Cinzel', 'Georgia', serif;
    font-weight: 900;
    font-size: calc(var(--card-w, calc(160px * var(--layout-scale, 1))) * 0.14);
    color: #ffffff;
    -webkit-text-stroke: 1.5px #000;
    text-shadow:
      1px 1px 0 #000, -1px -1px 0 #000,
      1px -1px 0 #000, -1px 1px 0 #000,
      0 2px 4px rgba(0, 0, 0, 0.7);
    line-height: 1;
    overflow: visible;
  }

  /* Mechanic name in the banner region */
  .v2-mechanic-name {
    font-family: 'Kreon', 'Georgia', serif;
    font-weight: 900;
    font-size: 16px;
    color: #1a0a00;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-shadow: 0 1px 0 rgba(255, 220, 180, 0.4);
    white-space: nowrap;
    overflow: visible;
    text-align: center;
  }

  /* Chain color pill — small oval filled with the chain's color */
  .v2-card-type {
    display: block;
    font-size: 0;
    border-radius: 999px;
    z-index: 1;
  }

  @keyframes chainPillPulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 4px var(--pill-color, rgba(255, 215, 0, 0.5)); }
    50% { transform: scale(1.6); box-shadow: 0 0 14px var(--pill-color, rgba(255, 215, 0, 0.8)); }
  }

  .pill-chain-active {
    animation: chainPillPulse 1.5s ease-in-out infinite;
  }

  /* Effect description text box */
  .v2-effect-text {
    font-family: 'Kreon', 'Georgia', serif;
    font-size: calc(var(--card-w, calc(160px * var(--layout-scale, 1))) * 0.077);
    font-weight: 600;
    color: #ffffff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    line-height: 1.3;
    overflow: hidden;
    overflow-wrap: break-word;
    word-break: break-word;
    padding: calc(4px * var(--layout-scale, 1));
    box-sizing: border-box;
  }

  .v2-effect-text.effect-text-md {
    font-size: calc(var(--card-w, calc(160px * var(--layout-scale, 1))) * 0.070);
  }

  .v2-effect-text.effect-text-sm {
    font-size: calc(var(--card-w, calc(160px * var(--layout-scale, 1))) * 0.063);
    line-height: 1.2;
  }

  .v2-effect-text.effect-text-xs {
    font-size: calc(var(--card-w, calc(160px * var(--layout-scale, 1))) * 0.052);
    line-height: 1.15;
  }

  .parchment-inner {
    display: block;
    width: 100%;
    text-align: center;
  }

  .desc-line {
    display: block;
    width: 100%;
  }

  .desc-number {
    font-family: inherit;
    font-weight: inherit;
    color: inherit;
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
    text-shadow: 0 0 calc(4px * var(--layout-scale, 1)) rgba(74, 222, 128, 0.4), 0 1px 2px rgba(0, 0, 0, 0.6);
  }

  /* Mastery upgrade flash — green pulse on numbers that went up */
  .desc-number.mastery-flash-up {
    animation: masteryFlashUp 800ms ease-out;
  }

  @keyframes masteryFlashUp {
    0% { color: #22c55e; text-shadow: 0 0 12px rgba(34, 197, 94, 0.9), 0 0 24px rgba(34, 197, 94, 0.5); transform: scale(1.3); }
    50% { color: #4ade80; text-shadow: 0 0 8px rgba(74, 222, 128, 0.6); transform: scale(1.1); }
    100% { color: inherit; text-shadow: inherit; transform: scale(1); }
  }

  /* Mastery downgrade flash — red pulse on numbers that went down */
  .desc-number.mastery-flash-down {
    animation: masteryFlashDown 800ms ease-out;
  }

  @keyframes masteryFlashDown {
    0% { color: #ef4444; text-shadow: 0 0 12px rgba(239, 68, 68, 0.9), 0 0 24px rgba(239, 68, 68, 0.5); transform: scale(1.3); }
    50% { color: #f87171; text-shadow: 0 0 8px rgba(248, 113, 113, 0.6); transform: scale(1.1); }
    100% { color: inherit; text-shadow: inherit; transform: scale(1); }
  }

  /* AP cost flash */
  .v2-ap-cost.mastery-flash-up {
    animation: masteryFlashUp 800ms ease-out;
  }
  .v2-ap-cost.mastery-flash-down {
    animation: masteryFlashDown 800ms ease-out;
  }

  /* Damage modifier coloring — buffed (relics/buffs raise effective value above base) */
  .desc-number.damage-buffed {
    color: #4ade80;
    text-shadow: 0 0 calc(4px * var(--layout-scale, 1)) rgba(74, 222, 128, 0.4);
  }

  /* Damage modifier coloring — nerfed (enemy resistances lower effective value below base) */
  .desc-number.damage-nerfed {
    color: #f87171;
    text-shadow: 0 0 calc(4px * var(--layout-scale, 1)) rgba(248, 113, 113, 0.4);
  }

  /* Charge preview — golden number tint when dragging toward charge zone */
  .charge-preview {
    color: #facc15 !important;
    text-shadow: 0 0 6px rgba(250, 204, 21, 0.6), -1px 0 #000, 1px 0 #000, 0 -1px #000, 0 1px #000;
    transition: color 150ms ease;
  }

  /* Charge preview (button hover) — green number tint when hovering the CHARGE button */
  .charge-preview-btn {
    color: #4ade80 !important;
    text-shadow: 0 0 6px rgba(74, 222, 128, 0.6), -1px 0 #000, 1px 0 #000, 0 -1px #000, 0 1px #000;
    transition: color 150ms ease;
  }
</style>
