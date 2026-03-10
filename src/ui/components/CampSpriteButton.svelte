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
    class="sprite-img"
    loading="lazy"
    decoding="async"
  />
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
  }

  .sprite-hitbox:active {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
  }

  .sprite-label {
    position: absolute;
    transform: translateX(-50%);
    font-family: 'Press Start 2P', 'Courier New', monospace;
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
</style>
