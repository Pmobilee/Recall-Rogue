<script lang="ts">
  import type { MapNode as MapNodeData } from '../../services/mapGenerator'

  interface Props {
    node: MapNodeData
    onclick: () => void
  }

  let { node, onclick }: Props = $props()

  const TYPE_BORDER: Record<MapNodeData['type'], string> = {
    combat:   '#E74C3C',
    elite:    '#8E44AD',
    boss:     '#C0392B',
    mystery:  '#9B59B6',
    rest:     '#2ECC71',
    treasure: '#F1C40F',
    shop:     '#E67E22',
  }

  const TYPE_ICON: Record<MapNodeData['type'], string> = {
    combat:   '⚔️',
    elite:    '💀',
    boss:     '👑',
    mystery:  '❓',
    rest:     '❤️',
    treasure: '🎁',
    shop:     '🛒',
  }

  const TYPE_LABEL: Record<MapNodeData['type'], string> = {
    combat:   'Combat',
    elite:    'Elite',
    boss:     'Boss',
    mystery:  'Mystery',
    rest:     'Rest',
    treasure: 'Treasure',
    shop:     'Shop',
  }

  let borderColor = $derived(TYPE_BORDER[node.type])
  let icon        = $derived(TYPE_ICON[node.type])
  let label       = $derived(TYPE_LABEL[node.type])
  let isClickable = $derived(node.state === 'available')
</script>

<button
  class="map-node"
  class:state-visited={node.state === 'visited'}
  class:state-available={node.state === 'available'}
  class:state-locked={node.state === 'locked'}
  class:state-current={node.state === 'current'}
  style="--node-color: {borderColor};"
  aria-label="{label} — {node.state}"
  data-testid="map-node-{node.id}"
  disabled={!isClickable}
  {onclick}
>
  <span class="node-icon" aria-hidden="true">{icon}</span>
  {#if node.state === 'visited'}
    <span class="visited-check" aria-hidden="true">✓</span>
  {/if}
</button>

<style>
  .map-node {
    position: relative;
    width: calc(44px * var(--layout-scale, 1));
    height: calc(44px * var(--layout-scale, 1));
    border-radius: 50%;
    border: 2.5px solid var(--node-color);
    background: linear-gradient(135deg, #0f1520, #1a2235);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    transition:
      opacity 200ms ease,
      filter 200ms ease,
      transform 200ms ease;
    /* Ensure minimum 44px tap target (already the node size) */
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .map-node:disabled {
    cursor: default;
    pointer-events: none;
  }

  /* --- visited --- */
  .map-node.state-visited {
    opacity: 0.25;
    filter: grayscale(1);
  }

  /* --- locked --- */
  .map-node.state-locked {
    opacity: 0.7;
    border-style: dashed;
  }

  /* --- available --- */
  .map-node.state-available {
    animation: nodePulse 2.4s ease-in-out infinite;
  }

  .map-node.state-available:hover,
  .map-node.state-available:focus-visible {
    transform: scale(1.12);
    box-shadow: 0 0 12px var(--node-color), 0 4px 12px rgba(0, 0, 0, 0.5);
    outline: none;
  }

  /* --- current --- */
  .map-node.state-current {
    animation: currentPulse 1.6s ease-in-out infinite;
    border-width: 3px;
  }

  @keyframes nodePulse {
    0%, 100% {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), 0 0 0 0 var(--node-color);
    }
    50% {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5), 0 0 10px 3px color-mix(in srgb, var(--node-color) 60%, transparent);
    }
  }

  @keyframes currentPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 12px var(--node-color), 0 4px 12px rgba(0, 0, 0, 0.5);
    }
    50% {
      transform: scale(1.1);
      box-shadow: 0 0 20px var(--node-color), 0 4px 12px rgba(0, 0, 0, 0.5);
    }
  }

  .node-icon {
    font-size: calc(20px * var(--layout-scale, 1));
    line-height: 1;
    /* Prevent emoji colour bleed on some Android renderers */
    display: block;
  }

  .visited-check {
    position: absolute;
    top: calc(-4px * var(--layout-scale, 1));
    right: calc(-4px * var(--layout-scale, 1));
    width: calc(16px * var(--layout-scale, 1));
    height: calc(16px * var(--layout-scale, 1));
    border-radius: 50%;
    background: #2ECC71;
    color: #fff;
    font-size: calc(9px * var(--layout-scale, 1));
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    /* Badge sits above the node ring */
    z-index: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .map-node.state-available,
    .map-node.state-current {
      animation: none;
    }
  }
</style>
