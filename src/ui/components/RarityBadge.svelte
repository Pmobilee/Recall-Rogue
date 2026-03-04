<script lang="ts">
  /** Colorblind-safe rarity badge with shape + color indicators (DD-V2-178) */

  type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

  interface Props {
    rarity: Rarity
    showLabel?: boolean
  }

  let { rarity, showLabel = false }: Props = $props()

  const RARITY_CONFIG: Record<Rarity, { shape: string; color: string; label: string }> = {
    common:    { shape: '●', color: '#9e9e9e', label: 'Common' },
    uncommon:  { shape: '◆', color: '#4caf50', label: 'Uncommon' },
    rare:      { shape: '▲', color: '#2196f3', label: 'Rare' },
    epic:      { shape: '★', color: '#9c27b0', label: 'Epic' },
    legendary: { shape: '⬟', color: '#ff9800', label: 'Legendary' },
    mythic:    { shape: '✦', color: '#f44336', label: 'Mythic' },
  }

  const config = $derived(RARITY_CONFIG[rarity])
</script>

<span
  class="rarity-badge"
  style="color: {config.color}"
  aria-label="{config.label} rarity"
  role="img"
>
  {config.shape}
  {#if showLabel}<span class="rarity-label">{config.label}</span>{/if}
</span>

<style>
  .rarity-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 1rem;
    line-height: 1;
  }
  .rarity-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
