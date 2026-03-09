<script lang="ts">
  import { PRESTIGE_LEVELS } from '../../data/prestigeConfig'

  interface Props {
    /** Prestige level to display (0 = no badge). */
    level: number
    /** Optional extra CSS class. */
    class?: string
  }

  const { level, class: extraClass = '' }: Props = $props()

  const config = $derived(PRESTIGE_LEVELS.find(p => p.level === level) ?? null)
</script>

{#if level > 0 && config}
  <span
    class="prestige-badge {extraClass}"
    style="background: {config.badgeColor};"
    title={config.label}
  >
    {config.badgeIcon}
  </span>
{/if}

<style>
  .prestige-badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Press Start 2P', monospace;
    font-size: 8px;
    color: #0a0a1a;
    font-weight: bold;
    vertical-align: middle;
    margin-left: 4px;
    letter-spacing: 0.05em;
  }
</style>
