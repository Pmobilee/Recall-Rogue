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
  }: Props = $props()
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
    ></button>
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
  }

  .sprite-img.rpg-outline {
    filter:
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
    cursor: pointer;
    pointer-events: auto;
    min-width: 48px;
    min-height: 48px;
    -webkit-tap-highlight-color: transparent;
    transition: transform 100ms ease, box-shadow 100ms ease;
  }

  .sprite-hitbox:active {
    /* no visible box — the sprite image flashes instead (see :has rule below) */
  }

  /* Flash the actual sprite pixels when the hitbox is pressed */
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
