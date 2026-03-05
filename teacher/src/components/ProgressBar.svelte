<script lang="ts">
  interface Props {
    /** Progress value between 0.0 and 1.0. */
    value: number
    /** Optional label shown to the right of the bar. */
    label?: string
    /** Optional colour override (CSS colour string). */
    color?: string
  }

  let { value, label, color = 'var(--color-primary)' }: Props = $props()

  const pct = $derived(Math.round(Math.min(1, Math.max(0, value)) * 100))
</script>

<div class="progress-bar-wrapper" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
  <div class="progress-track">
    <div class="progress-fill" style="width: {pct}%; background: {color};"></div>
  </div>
  {#if label}
    <span class="progress-label">{label}</span>
  {/if}
</div>

<style>
  .progress-bar-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .progress-track {
    flex: 1;
    height: 8px;
    background: var(--color-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
    min-width: 2px;
  }

  .progress-label {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    white-space: nowrap;
    min-width: 36px;
    text-align: right;
  }
</style>
