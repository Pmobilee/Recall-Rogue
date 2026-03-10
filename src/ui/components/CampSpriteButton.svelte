<script lang="ts">
  interface Props {
    spriteUrl: string
    label: string
    testId?: string
    top: string
    left: string
    width: string
    zIndex?: number
    onclick?: () => void
    decorative?: boolean
  }

  let {
    spriteUrl,
    label,
    testId,
    top,
    left,
    width,
    zIndex = 10,
    onclick,
    decorative = false,
  }: Props = $props()
</script>

{#if decorative}
  <div
    class="camp-sprite decorative"
    aria-hidden="true"
    style="position: absolute; top: {top}; left: {left}; transform: translate(-50%, -50%); z-index: {zIndex};"
  >
    <img
      src={spriteUrl}
      alt={label}
      style="width: {width}; height: auto;"
      loading="lazy"
      decoding="async"
    />
    <span class="sprite-label">{label}</span>
  </div>
{:else}
  <button
    type="button"
    class="camp-sprite interactive"
    data-testid={testId}
    style="position: absolute; top: {top}; left: {left}; transform: translate(-50%, -50%); z-index: {zIndex};"
    onclick={onclick}
  >
    <img
      src={spriteUrl}
      alt={label}
      style="width: {width}; height: auto;"
      loading="lazy"
      decoding="async"
    />
    <span class="sprite-label">{label}</span>
  </button>
{/if}

<style>
  .camp-sprite {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .camp-sprite img {
    image-rendering: pixelated;
    pointer-events: none;
  }

  .interactive {
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    min-width: 48px;
    min-height: 48px;
    -webkit-tap-highlight-color: transparent;
  }

  .interactive:active {
    transform: translate(-50%, -50%) scale(0.95);
  }

  .sprite-label {
    font-size: 11px;
    color: #fff;
    text-shadow:
      0 1px 3px rgba(0, 0, 0, 0.85),
      0 0 6px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    white-space: nowrap;
    letter-spacing: 0.3px;
  }
</style>
