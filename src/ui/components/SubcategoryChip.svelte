<script lang="ts">
  interface Props {
    label: string;
    isSelected: boolean;
    colorTint: string;
    ontoggle: () => void;
  }

  let { label, isSelected, colorTint, ontoggle }: Props = $props();
</script>

<button
  class="chip"
  class:selected={isSelected}
  onclick={ontoggle}
  style={isSelected
    ? `background: ${colorTint}20; border-color: ${colorTint}55;`
    : ''}
  aria-pressed={isSelected}
>
  {label}
</button>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: calc(5px * var(--layout-scale, 1)) calc(12px * var(--layout-scale, 1));
    border-radius: calc(14px * var(--layout-scale, 1));
    font-size: calc(12px * var(--text-scale, 1));
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s ease;
    line-height: 1;
    white-space: nowrap;

    /* Default unselected state */
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #64748b;
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #cbd5e1;
  }

  .chip.selected {
    /* background and border-color are set via inline style using colorTint */
    color: #e2e8f0;
  }
</style>
