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
    combat:   'assets/sprites/map-icons/combat.webp',
    elite:    'assets/sprites/map-icons/elite.webp',
    boss:     'assets/sprites/map-icons/boss.webp',
    mystery:  'assets/sprites/map-icons/mystery.webp',
    rest:     'assets/sprites/map-icons/rest.webp',
    treasure: 'assets/sprites/map-icons/treasure.webp',
    shop:     'assets/sprites/map-icons/shop.webp',
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
  let iconUrl     = $derived(TYPE_ICON[node.type])
  let label       = $derived(TYPE_LABEL[node.type])
  let isClickable = $derived(node.state === 'available')

  /** Sprite URL for boss node only — shows the actual boss enemy instead of an emoji. */
  let spriteUrl = $derived(
    node.type === 'boss' && node.enemyId
      ? `assets/sprites/enemies/${node.enemyId}_idle.webp`
      : null
  )
</script>

<button
  class="map-node"
  class:state-visited={node.state === 'visited'}
  class:state-available={node.state === 'available'}
  class:state-locked={node.state === 'locked'}
  class:state-current={node.state === 'current'}
  class:type-boss={node.type === 'boss'}
  class:type-elite={node.type === 'elite'}
  style="--node-color: {borderColor};"
  aria-label="{label} — {node.state}"
  data-testid="map-node-{node.id}"
  disabled={!isClickable}
  {onclick}
>
  {#if spriteUrl}
    <img class="node-sprite" src={spriteUrl} alt={label} />
  {:else}
    <img class="node-icon" src={iconUrl} alt={label} />
  {/if}
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
    width: calc(28px * var(--layout-scale, 1));
    height: calc(28px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
    pointer-events: none;
    display: block;
  }

  .node-sprite {
    width: calc(38px * var(--layout-scale, 1));
    height: calc(38px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: auto; /* bilinear — good for downscaling */
    border-radius: 50%;
    /* 3D floating animation */
    animation: spriteFloat 3s ease-in-out infinite;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
    pointer-events: none;
  }

  /* Override sprite animation for boss — slower, more dramatic float */
  .type-boss .node-sprite {
    animation: bossFloat 4s ease-in-out infinite;
    filter: drop-shadow(0 0 8px rgba(192, 57, 43, 0.5)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
  }

  /* Elite sprite — menacing wobble */
  .type-elite .node-sprite {
    animation: eliteFloat 2.5s ease-in-out infinite;
    filter: drop-shadow(0 0 6px rgba(142, 68, 173, 0.4)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
  }

  @keyframes spriteFloat {
    0%, 100% {
      transform: translateY(0) rotateY(0deg) scale(1);
    }
    25% {
      transform: translateY(-2px) rotateY(5deg) scale(1.02);
    }
    50% {
      transform: translateY(-3px) rotateY(0deg) scale(1.04);
    }
    75% {
      transform: translateY(-2px) rotateY(-5deg) scale(1.02);
    }
  }

  @keyframes bossFloat {
    0%, 100% {
      transform: translateY(0) rotateY(0deg) scale(1) perspective(200px) rotateX(0deg);
    }
    25% {
      transform: translateY(-3px) rotateY(8deg) scale(1.05) perspective(200px) rotateX(2deg);
    }
    50% {
      transform: translateY(-5px) rotateY(0deg) scale(1.08) perspective(200px) rotateX(-2deg);
    }
    75% {
      transform: translateY(-3px) rotateY(-8deg) scale(1.05) perspective(200px) rotateX(2deg);
    }
  }

  @keyframes eliteFloat {
    0%, 100% {
      transform: translateY(0) rotateY(0deg) scale(1);
    }
    33% {
      transform: translateY(-2px) rotateY(6deg) scale(1.03);
    }
    66% {
      transform: translateY(-3px) rotateY(-6deg) scale(1.03);
    }
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

  /* --- boss node: dramatic slow pulse with large glow, always active, larger --- */
  .map-node.type-boss {
    width: calc(54px * var(--layout-scale, 1));
    height: calc(54px * var(--layout-scale, 1));
    animation: bossPulse 3s ease-in-out infinite;
    border-width: 3px;
  }
  .map-node.type-boss.state-visited {
    animation: none;
  }

  /* --- elite node: menacing purple pulse, always active --- */
  .map-node.type-elite {
    animation: elitePulse 2s ease-in-out infinite;
    border-width: 2.5px;
  }
  .map-node.type-elite.state-visited {
    animation: none;
  }

  @keyframes bossPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow:
        0 0 12px rgba(192, 57, 43, 0.6),
        0 0 24px rgba(192, 57, 43, 0.3),
        0 2px 8px rgba(0, 0, 0, 0.5);
    }
    50% {
      transform: scale(1.15);
      box-shadow:
        0 0 20px rgba(192, 57, 43, 0.8),
        0 0 40px rgba(192, 57, 43, 0.4),
        0 0 60px rgba(192, 57, 43, 0.2),
        0 2px 8px rgba(0, 0, 0, 0.5);
    }
  }

  @keyframes elitePulse {
    0%, 100% {
      transform: scale(1);
      box-shadow:
        0 0 8px rgba(142, 68, 173, 0.5),
        0 0 16px rgba(142, 68, 173, 0.2),
        0 2px 8px rgba(0, 0, 0, 0.5);
    }
    50% {
      transform: scale(1.08);
      box-shadow:
        0 0 14px rgba(142, 68, 173, 0.7),
        0 0 28px rgba(142, 68, 173, 0.35),
        0 2px 8px rgba(0, 0, 0, 0.5);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .map-node.state-available,
    .map-node.state-current,
    .map-node.type-boss,
    .map-node.type-elite {
      animation: none;
    }
    .node-sprite {
      animation: none;
    }
  }
</style>
