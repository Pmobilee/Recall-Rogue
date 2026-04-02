<script lang="ts">
  import type { DeckRegistryEntry } from '../../data/deckRegistry';
  import type { DeckProgress } from '../../services/deckProgressService';
  import { playCardAudio } from '../../services/cardAudioManager';

  interface Props {
    deck: DeckRegistryEntry;
    progress: DeckProgress;
    onclick: () => void;
    dealIndex?: number;
    dealKey?: number;
  }

  const { deck, progress, onclick, dealIndex = 0, dealKey = 0 }: Props = $props();

  let tileEl = $state<HTMLElement | null>(null);

  let shineX = $state(50);
  let shineY = $state(50);
  let rotX = $state(0);
  let rotY = $state(0);
  let isHovering = $state(false);
  let rafId = 0;
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  // Parallax image state
  let hasImage = $state(false);
  let imageUrl = $state('');

  // Language family prefixes — children share the parent's deck front art
  const PARENT_PREFIXES = ['japanese', 'chinese', 'korean', 'spanish', 'french', 'german', 'dutch', 'czech'];

  function resolveDeckFrontPath(deckId: string): string {
    // Strip synthetic "all:" prefix used by the ALL tab for language family representatives
    const id = deckId.startsWith('all:') ? deckId.slice(4) : deckId;
    const parent = PARENT_PREFIXES.find(p => id.startsWith(p + '_'));
    return `/assets/sprites/deckfronts/${parent ?? id}.webp`;
  }

  $effect(() => {
    const path = resolveDeckFrontPath(deck.id);
    const img = new Image();
    img.onload = () => { hasImage = true; imageUrl = path; };
    img.onerror = () => { hasImage = false; };
    img.src = path;
  });

  function handlePointerMove(e: PointerEvent) {
    if (isTouchDevice || rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (!tileEl) return;
      const rect = tileEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      rotY = (x - 0.5) * 24;
      rotX = (0.5 - y) * 24;
      shineX = x * 100;
      shineY = y * 100;
    });
  }

  function handlePointerEnter() {
    if (isTouchDevice) return;
    isHovering = true;
    if (tileEl) tileEl.style.willChange = 'transform';
  }

  function handlePointerLeave() {
    isHovering = false;
    rotX = 0; rotY = 0;
    shineX = 50; shineY = 50;
    setTimeout(() => {
      if (!isHovering && tileEl) tileEl.style.willChange = '';
    }, 400);
  }

  $effect(() => {
    void dealKey;
    if (!tileEl) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--layout-scale')) || 1;
    const staggerDelay = Math.min(dealIndex * 60, 720);

    if (prefersReducedMotion) {
      tileEl.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 150, delay: staggerDelay, fill: 'backwards' }
      );
    } else {
      const offsetX = -80 * scale;
      const offsetY = -60 * scale;
      tileEl.animate(
        [
          { transform: `translate(${offsetX}px, ${offsetY}px) scale(0.3) rotate(-8deg)`, opacity: 0 },
          { transform: 'translate(0, 0) scale(1.03) rotate(0.5deg)', opacity: 1, offset: 0.7 },
          { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
        ],
        {
          duration: 380,
          delay: staggerDelay,
          easing: 'cubic-bezier(0.22, 1.2, 0.36, 1)',
          fill: 'backwards',
        }
      );
    }

    // Play card deal sound (cap at 12 tiles to avoid audio spam)
    if (dealIndex < 12) {
      setTimeout(() => playCardAudio('card-draw'), staggerDelay);
    }
  });

  const isAvailable = $derived(deck.status === 'available');
  const isNew = $derived(progress.progressPercent === 0 && progress.factsEncountered === 0);
  const isInProgress = $derived(progress.progressPercent > 0 && progress.progressPercent < 100);
  const isComplete = $derived(progress.progressPercent >= 100);
  const descriptionText = $derived(deck.description || `${deck.factCount} facts`);

  const inReviewCount = $derived(Math.max(0, progress.factsEncountered - progress.factsMastered));
  const total = $derived(progress.totalFacts || 1);
  const seenPct = $derived(Math.min((progress.factsEncountered / total) * 100, 100));
  const reviewPct = $derived(Math.min((inReviewCount / total) * 100, 100));
  const masteredPct = $derived(Math.min((progress.factsMastered / total) * 100, 100));

  function handleClick() {
    if (!isAvailable) return;
    playCardAudio('tab-switch');
    onclick();
  }
</script>

<div class="deck-tile-3d">
  <div
    bind:this={tileEl}
    class="deck-tile"
    class:coming-soon={!isAvailable}
    class:hovering={isHovering}
    onclick={handleClick}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
    onpointerenter={handlePointerEnter}
    onpointermove={handlePointerMove}
    onpointerleave={handlePointerLeave}
    role="button"
    tabindex={isAvailable ? 0 : -1}
    aria-disabled={!isAvailable}
    style="
      --gradient-from: {deck.artPlaceholder.gradientFrom};
      --gradient-to: {deck.artPlaceholder.gradientTo};
      --rot-x: {rotX}deg;
      --rot-y: {rotY}deg;
      --shine-x: {shineX}%;
      --shine-y: {shineY}%;
    "
  >
    <!-- Art Area -->
    <div class="art-area" class:grayscale={!isAvailable} class:has-image={hasImage}>
      {#if hasImage}
        <div class="parallax-wrap">
          <!-- Background layer: full image, shifts against pointer -->
          <img class="plx-layer plx-bg" src={imageUrl} alt=""
            style="transform: translate({(shineX - 50) * -0.08}%, {(shineY - 50) * -0.08}%) scale(1.08)" />
          <!-- Foreground layer disabled — depth-cut approach looked like a bad cutout -->
        </div>
      {/if}

      <span class="deck-title-3d">{deck.name}</span>

      <!-- Status Badge -->
      {#if !isAvailable}
        <span class="badge badge-coming-soon">COMING SOON</span>
      {:else if isComplete}
        <span class="badge badge-complete">&#9733; COMPLETE</span>
      {:else if isInProgress}
        <span class="badge badge-continue">CONTINUE</span>
      {:else if isNew}
        <span class="badge badge-new">NEW</span>
      {/if}
    </div>

    <!-- Info Area -->
    <div class="info-area">
      <div class="deck-description">{descriptionText}</div>

      <div class="progress-bars">
        <div class="progress-bar-row">
          <span class="bar-label seen-label">Seen</span>
          <div class="bar-track">
            <div class="bar-fill bar-seen" style="width: {seenPct}%;"></div>
          </div>
          <span class="bar-count">{progress.factsEncountered}</span>
        </div>
        <div class="progress-bar-row">
          <span class="bar-label review-label">Review</span>
          <div class="bar-track">
            <div class="bar-fill bar-review" style="width: {reviewPct}%;"></div>
          </div>
          <span class="bar-count">{inReviewCount}</span>
        </div>
        <div class="progress-bar-row">
          <span class="bar-label mastered-label">Mastered</span>
          <div class="bar-track">
            <div class="bar-fill bar-mastered" style="width: {masteredPct}%;"></div>
          </div>
          <span class="bar-count">{progress.factsMastered}</span>
        </div>
      </div>
    </div>

    <!-- Shine overlay -->
    <div class="shine-overlay"></div>
  </div>
</div>

<style>
  .deck-tile-3d {
    perspective: calc(800px * var(--layout-scale, 1));
    width: 100%;
  }

  .deck-tile {
    width: 100%;
    border-radius: calc(12px * var(--layout-scale, 1));
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: #111827;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    padding: 0;
    text-align: left;
    position: relative;
    transform-style: preserve-3d;
    transform: rotateX(var(--rot-x, 0deg)) rotateY(var(--rot-y, 0deg));
    transition: transform 0.4s ease-out, box-shadow 0.2s ease, border-color 0.2s ease;
    box-shadow:
      0 calc(2px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .deck-tile.hovering {
    transition: transform 0.08s ease-out, box-shadow 0.2s ease, border-color 0.2s ease;
    border-color: color-mix(in srgb, var(--gradient-from) 50%, transparent);
    box-shadow:
      0 calc(12px * var(--layout-scale, 1)) calc(32px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.5),
      0 0 calc(20px * var(--layout-scale, 1)) color-mix(in srgb, var(--gradient-from) 15%, transparent);
  }

  .deck-tile.coming-soon {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Shine overlay — always on top (z-index 10) */
  .shine-overlay {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(
      circle at var(--shine-x, 50%) var(--shine-y, 50%),
      rgba(255, 255, 255, 0.22) 0%,
      rgba(255, 255, 255, 0.04) 45%,
      transparent 70%
    );
    transition: opacity 0.25s ease;
    z-index: 10;
  }

  .deck-tile.hovering .shine-overlay {
    opacity: 1;
  }

  .art-area {
    width: 100%;
    aspect-ratio: 3 / 4;
    flex-shrink: 0;
    background-image:
      repeating-linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.025) 0px,
        rgba(255, 255, 255, 0.025) 1px,
        transparent 1px,
        transparent 6px
      ),
      linear-gradient(160deg, var(--gradient-from), var(--gradient-to));
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    border-radius: calc(12px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1)) 0 0;
  }

  .art-area.grayscale {
    filter: grayscale(1);
  }

  /* When a deck front image is present: bottom-center, floating in 3D */
  .has-image .deck-title-3d {
    position: absolute;
    bottom: calc(8px * var(--layout-scale, 1));
    left: 50%;
    transform: translateX(-50%) translateZ(calc(40px * var(--layout-scale, 1)));
    width: 90%;
    color: #ffffff;
    text-shadow:
      calc(-2px * var(--layout-scale, 1)) 0 0 rgba(0, 0, 0, 0.9),
      calc(2px * var(--layout-scale, 1)) 0 0 rgba(0, 0, 0, 0.9),
      0 calc(-2px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.9),
      0 calc(2px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.9),
      0 calc(4px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.7),
      0 calc(8px * var(--layout-scale, 1)) calc(16px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.4);
    filter: drop-shadow(0 calc(2px * var(--layout-scale, 1)) calc(3px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.8));
  }

  /* Parallax image layers — rendered behind title and badge (z-index 0/1) */
  .parallax-wrap {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    z-index: 0;
  }

  .plx-layer {
    position: absolute;
    inset: calc(-12px * var(--layout-scale, 1));
    width: calc(100% + calc(24px * var(--layout-scale, 1)));
    height: calc(100% + calc(24px * var(--layout-scale, 1)));
    object-fit: cover;
    pointer-events: none;
    transition: transform 0.12s ease-out;
  }

  .plx-fg {
    z-index: 1;
  }

  /* Deck title floats above parallax layers */
  .deck-title-3d {
    font-size: calc(20px * var(--text-scale, 1));
    font-weight: 900;
    text-transform: uppercase;
    text-align: center;
    line-height: 1.2;
    letter-spacing: 0.06em;
    padding: calc(16px * var(--layout-scale, 1));
    color: rgba(255, 255, 255, 0.95);
    text-shadow:
      0 calc(1px * var(--layout-scale, 1)) 0 rgba(255, 255, 255, 0.15),
      0 calc(-1px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.6),
      0 calc(2px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.55),
      0 calc(3px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.5),
      0 calc(4px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.45),
      0 calc(5px * var(--layout-scale, 1)) 0 rgba(0, 0, 0, 0.4),
      0 calc(6px * var(--layout-scale, 1)) calc(1px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.15),
      0 calc(7px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1)) rgba(0, 0, 0, 0.3);
    user-select: none;
    text-wrap: balance;
    word-break: normal;
    hyphens: none;
    max-width: 92%;
    position: relative;
    z-index: 2;
  }

  /* text-shadow and color for has-image title are in the combined rule above */

  /* Badge stays absolutely positioned in art area, floats above parallax */
  .badge {
    position: absolute;
    top: calc(8px * var(--layout-scale, 1));
    right: calc(8px * var(--layout-scale, 1));
    font-size: calc(10px * var(--text-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
    padding: calc(3px * var(--layout-scale, 1)) calc(8px * var(--layout-scale, 1));
    border-radius: calc(4px * var(--layout-scale, 1));
    letter-spacing: 0.05em;
    z-index: 2;
  }

  /* When image is present, badges also float forward in 3D space */
  .has-image .badge {
    transform: translateZ(calc(30px * var(--layout-scale, 1)));
  }

  .badge-new {
    background: rgba(99, 102, 241, 0.85);
    color: white;
  }

  .badge-continue {
    background: rgba(245, 158, 11, 0.85);
    color: white;
  }

  .badge-complete {
    background: rgba(234, 179, 8, 0.9);
    color: #1a1a2e;
  }

  .badge-coming-soon {
    background: rgba(0, 0, 0, 0.6);
    color: #94a3b8;
  }

  .info-area {
    padding: calc(10px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1));
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    min-height: calc(100px * var(--layout-scale, 1));
  }

  .deck-description {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .progress-bars {
    display: flex;
    flex-direction: column;
    gap: calc(4px * var(--layout-scale, 1));
    margin-top: calc(4px * var(--layout-scale, 1));
  }

  .progress-bar-row {
    display: flex;
    align-items: center;
    gap: calc(6px * var(--layout-scale, 1));
  }

  .bar-label {
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 600;
    width: calc(58px * var(--layout-scale, 1));
    text-align: right;
    flex-shrink: 0;
  }

  .seen-label { color: #60a5fa; }
  .review-label { color: #f59e0b; }
  .mastered-label { color: #4ade80; }

  .bar-track {
    flex: 1;
    height: calc(6px * var(--layout-scale, 1));
    background: rgba(255, 255, 255, 0.08);
    border-radius: calc(2px * var(--layout-scale, 1));
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: calc(2px * var(--layout-scale, 1));
    transition: width 0.3s ease;
  }

  .bar-seen { background: #60a5fa; }
  .bar-review { background: #f59e0b; }
  .bar-mastered { background: #4ade80; }

  .bar-count {
    font-size: calc(11px * var(--text-scale, 1));
    color: #64748b;
    min-width: calc(28px * var(--layout-scale, 1));
    text-align: right;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .deck-tile {
      animation: none !important;
      transition: none !important;
    }
    .shine-overlay {
      display: none;
    }
    /* Keep image visible but disable parallax movement */
    .plx-layer {
      transition: none !important;
    }
  }
</style>
