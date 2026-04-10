<script lang="ts">
  interface Props {
    spriteUrl: string
    label: string
    testId?: string
    zIndex?: number
    onclick?: () => void
    decorative?: boolean
    hitTop?: string
    hitLeft?: string
    hitWidth?: string
    hitHeight?: string
    labelTop?: string
    labelLeft?: string
    ambientClass?: string
    showBorder?: boolean
    /** CSS translate X offset applied to the sprite image (e.g. "-49%") — shifts baked sprite position without re-rendering art assets (used for landscape-only layout adjustments) */
    spriteOffsetX?: string
    /** CSS translate Y offset applied to the sprite image (e.g. "-21%") — shifts baked sprite position without re-rendering art assets (used for landscape-only layout adjustments) */
    spriteOffsetY?: string
    /**
     * CSS `brightness()` factor for the sprite (0–2, default 1.0).
     * Drives campfire lighting: nearby sprites glow brighter, far ones dim to ~0.45.
     * Applied via `--sprite-brightness` CSS custom property so the rpg-outline
     * drop-shadow filter chain is preserved and composed correctly.
     */
    brightness?: number
    /** Descriptive tooltip shown on hover (300ms delay). Falls back to label for aria title. */
    tooltip?: string
  }

  let {
    spriteUrl,
    label,
    testId,
    zIndex = 10,
    onclick,
    decorative = false,
    hitTop,
    hitLeft,
    hitWidth,
    hitHeight,
    labelTop,
    labelLeft,
    ambientClass = '',
    showBorder = false,
    spriteOffsetX,
    spriteOffsetY,
    brightness = 1.0,
    tooltip,
  }: Props = $props()

  let showTooltip = $state(false)
  let tooltipTimer: ReturnType<typeof setTimeout> | null = null

  function handleMouseEnter(): void {
    if (!tooltip) return
    tooltipTimer = setTimeout(() => { showTooltip = true }, 300)
  }

  function handleMouseLeave(): void {
    if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null }
    showTooltip = false
  }

  /** Build the inline style string for .sprite-img, composing transform + brightness variable. */
  function buildSpriteStyle(
    offsetX: string | undefined,
    offsetY: string | undefined,
    b: number
  ): string {
    const parts: string[] = []
    if (offsetX || offsetY) {
      parts.push(`transform: translate(${offsetX ?? '0'}, ${offsetY ?? '0'});`)
    }
    // Always set the CSS variable so the CSS filter rule can read it
    parts.push(`--sprite-brightness: ${b};`)
    return parts.join(' ')
  }
</script>

<div
  class="camp-sprite-layer"
  aria-hidden={decorative ? 'true' : undefined}
  style="z-index: {zIndex};"
>
  <img
    src={spriteUrl}
    alt=""
    class="sprite-img {ambientClass}"
    class:rpg-outline={showBorder}
    loading="lazy"
    decoding="async"
    style={buildSpriteStyle(spriteOffsetX, spriteOffsetY, brightness)}
  />
  {#if ambientClass === 'ambient-spark'}
    <span class="ambient-spark-dot"></span>
  {/if}
  {#if !decorative && hitTop}
    <button
      type="button"
      class="sprite-hitbox"
      data-testid={testId}
      style="top: {hitTop}; left: {hitLeft}; width: {hitWidth}; height: {hitHeight};"
      onclick={onclick}
      aria-label={label}
      title={tooltip ?? label}
      onmouseenter={handleMouseEnter}
      onmouseleave={handleMouseLeave}
    ></button>
    {#if showTooltip && tooltip}
      <div class="sprite-tooltip" role="tooltip">{tooltip}</div>
    {/if}
  {/if}
  {#if labelTop}
    <span class="sprite-label" style="top: {labelTop}; left: {labelLeft};">{label}</span>
  {/if}
</div>

<style>
  .camp-sprite-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .sprite-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    image-rendering: pixelated;
    pointer-events: none;
    /* Campfire lighting: controlled via --sprite-brightness CSS variable (default 1.0). */
    filter: brightness(var(--sprite-brightness, 1));
  }

  .sprite-img.rpg-outline {
    /* Brightness must be prepended so drop-shadows apply to the already-brightened image. */
    filter:
      brightness(var(--sprite-brightness, 1))
      drop-shadow(2px 0 0 #000)
      drop-shadow(-2px 0 0 #000)
      drop-shadow(0 2px 0 #000)
      drop-shadow(0 -2px 0 #000)
      drop-shadow(1px 1px 0 #000)
      drop-shadow(-1px 1px 0 #000)
      drop-shadow(1px -1px 0 #000)
      drop-shadow(-1px -1px 0 #000);
  }

  .sprite-hitbox {
    position: absolute;
    background: transparent;
    border: none;
    padding: 0;
    /* Inherit cursor from parent so hub's cursor:none is not overridden — the
       custom glow cursor IS the hover feedback when effects are active. */
    cursor: inherit;
    pointer-events: auto;
    min-width: 48px;
    min-height: 48px;
    -webkit-tap-highlight-color: transparent;
    transition: transform 100ms ease, box-shadow 100ms ease;
  }

  /* Flash the actual sprite pixels when the hitbox is pressed.
     brightness(1.4) overrides the --sprite-brightness variable on press. */
  .camp-sprite-layer:has(.sprite-hitbox:active) > .sprite-img {
    filter:
      brightness(1.4)
      drop-shadow(0 0 6px rgba(255, 200, 100, 0.7))
      drop-shadow(2px 0 0 #000)
      drop-shadow(-2px 0 0 #000)
      drop-shadow(0 2px 0 #000)
      drop-shadow(0 -2px 0 #000)
      drop-shadow(1px 1px 0 #000)
      drop-shadow(-1px 1px 0 #000)
      drop-shadow(1px -1px 0 #000)
      drop-shadow(-1px -1px 0 #000);
    transition: filter 80ms ease;
  }

  .sprite-tooltip {
    position: absolute;
    bottom: calc(105% + calc(4px * var(--layout-scale, 1)));
    left: 50%;
    transform: translateX(-50%);
    background: rgba(10, 8, 20, 0.95);
    border: 1px solid rgba(255, 215, 140, 0.4);
    border-radius: calc(6px * var(--layout-scale, 1));
    padding: calc(5px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1));
    font-family: var(--font-rpg);
    font-size: calc(11px * var(--text-scale, 1));
    color: #ffe8c2;
    white-space: nowrap;
    pointer-events: none;
    animation: tooltipFadeIn 0.15s ease forwards;
    z-index: 99;
    text-shadow:
      -1px -1px 0 #000,
       1px -1px 0 #000,
      -1px  1px 0 #000,
       1px  1px 0 #000;
  }

  @keyframes tooltipFadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(calc(4px * var(--layout-scale, 1))); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .sprite-label {
    position: absolute;
    transform: translateX(-50%);
    font-family: var(--font-rpg);
    font-size: 9px;
    color: #ffe8c2;
    text-shadow:
      -1px -1px 0 #000,
       1px -1px 0 #000,
      -1px  1px 0 #000,
       1px  1px 0 #000,
      0 0 8px rgba(255, 200, 100, 0.5);
    pointer-events: none;
    white-space: nowrap;
    letter-spacing: 1px;
    padding: 3px 8px;
    background: rgba(10, 8, 20, 0.7);
    border: 1px solid rgba(255, 215, 140, 0.35);
    border-radius: 4px;
  }

  /* Hub ambient micro-animations */
  .ambient-breathe {
    animation: ambientBreathe 3s ease-in-out infinite;
  }

  @keyframes ambientBreathe {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(1.005); }
  }

  .ambient-sway {
    animation: ambientSway 4s ease-in-out infinite;
  }

  @keyframes ambientSway {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1px); }
  }

  .ambient-spark-dot {
    position: absolute;
    width: 4px;
    height: 4px;
    background: #ffd700;
    border-radius: 50%;
    top: 40%;
    left: 55%;
    opacity: 0;
    animation: ambientSparkPop 8s ease-in-out infinite;
    pointer-events: none;
    z-index: 1;
  }

  @keyframes ambientSparkPop {
    0%, 85%, 100% { opacity: 0; transform: scale(0); }
    90% { opacity: 0.8; transform: scale(1.2); }
    95% { opacity: 0; transform: scale(0.5) translateY(-8px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .ambient-breathe,
    .ambient-sway {
      animation: none;
    }
    .ambient-spark-dot {
      animation: none;
      display: none;
    }
  }
</style>
