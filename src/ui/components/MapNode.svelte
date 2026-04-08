<script lang="ts">
  import type { MapNode as MapNodeData } from '../../services/mapGenerator'

  /** A player who has tentatively picked this node (multiplayer consensus). */
  export interface NodePickIndicator {
    playerId: string
    initial: string
    color: string
  }

  interface Props {
    node: MapNodeData
    onclick: () => void
    /** Players who have currently picked this node (multiplayer only). */
    pickedBy?: NodePickIndicator[]
  }

  let { node, onclick, pickedBy = [] }: Props = $props()

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
    combat:   'Combat encounter',
    elite:    'Elite encounter',
    boss:     'Boss encounter',
    mystery:  'Mystery event',
    rest:     'Rest site',
    treasure: 'Treasure room',
    shop:     'Shop',
  }

  let borderColor  = $derived(TYPE_BORDER[node.type])
  let iconUrl      = $derived(TYPE_ICON[node.type])
  let label        = $derived(TYPE_LABEL[node.type])
  let isClickable  = $derived(node.state === 'available')

  /** Sprite URL for boss node only — shows the actual boss enemy instead of an emoji. */
  let spriteUrl = $derived(
    node.type === 'boss' && node.enemyId
      ? `assets/sprites/enemies/${node.enemyId}_idle.webp`
      : null
  )
</script>

<div class="node-wrapper">
  {#if pickedBy.length > 0}
    <div class="pick-badge-row" aria-label="Picked by other players">
      {#each pickedBy as picker (picker.playerId)}
        <div
          class="pick-badge"
          style="background: {picker.color}; border-color: {picker.color};"
          title="{picker.initial} picked this room"
          data-testid="pick-badge-{picker.playerId}-{node.id}"
        >{picker.initial}</div>
      {/each}
    </div>
  {/if}
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
</div>

<style>
  /* Wrapper enables absolute positioning by parent layout */
  .node-wrapper {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
  }

  /* Multiplayer pick badge: small circles above the node showing which
     players have tentatively picked it. Cleared when consensus is reached
     and the room transition begins. */
  .pick-badge-row {
    display: flex;
    gap: calc(3px * var(--layout-scale, 1));
    margin-bottom: calc(3px * var(--layout-scale, 1));
    pointer-events: none;
  }

  .pick-badge {
    width: calc(18px * var(--layout-scale, 1));
    height: calc(18px * var(--layout-scale, 1));
    border-radius: 50%;
    border: 2px solid currentColor;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: calc(11px * var(--text-scale, 1));
    font-weight: 800;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.6), 0 0 8px currentColor;
    animation: pickBadgePulse 1.4s ease-in-out infinite;
  }

  @keyframes pickBadgePulse {
    0%, 100% { transform: scale(1); opacity: 0.95; }
    50% { transform: scale(1.12); opacity: 1; }
  }

  .map-node {
    position: relative;
    width: calc(52px * var(--layout-scale, 1));
    height: calc(52px * var(--layout-scale, 1));
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

  /* Elite node: slightly larger */
  .map-node.type-elite {
    width: calc(60px * var(--layout-scale, 1));
    height: calc(60px * var(--layout-scale, 1));
    animation: elitePulse 2s ease-in-out infinite;
    border-width: 2.5px;
  }
  .map-node.type-elite.state-visited {
    animation: none;
  }

  .map-node:disabled {
    cursor: default;
    pointer-events: none;
  }

  /* --- visited --- */
  .map-node.state-visited {
    opacity: 0.3;
    filter: grayscale(0.8);
  }

  /* --- locked --- */
  .map-node.state-locked {
    opacity: 0.45;
    border-style: dashed;
    filter: saturate(0.5);
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

  /* --- current: "You Are Here" — dramatic pulsing ring + sonar ping --- */
  .map-node.state-current {
    animation: currentPulse 1.6s ease-in-out infinite;
    border-width: 3px;
  }

  .map-node.state-current::after {
    content: '';
    position: absolute;
    inset: calc(-6px * var(--layout-scale, 1));
    border-radius: 50%;
    border: 2px solid var(--node-color);
    opacity: 0;
    animation: sonarPing 2s ease-out infinite;
    pointer-events: none;
  }

  @keyframes sonarPing {
    0% { transform: scale(0.8); opacity: 0.8; }
    100% { transform: scale(1.4); opacity: 0; }
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
    width: calc(34px * var(--layout-scale, 1));
    height: calc(34px * var(--layout-scale, 1));
    object-fit: contain;
    image-rendering: pixelated;
    pointer-events: none;
    display: block;
  }

  /* Larger icon inside elite nodes */
  .map-node.type-elite .node-icon {
    width: calc(40px * var(--layout-scale, 1));
    height: calc(40px * var(--layout-scale, 1));
  }

  .node-sprite {
    width: calc(54px * var(--layout-scale, 1));
    height: calc(54px * var(--layout-scale, 1));
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
    width: calc(80px * var(--layout-scale, 1));
    height: calc(80px * var(--layout-scale, 1));
    animation: bossPulse 3s ease-in-out infinite;
    border-width: 3px;
  }
  .map-node.type-boss.state-visited {
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
    .map-node.state-current::after {
      animation: none;
    }
    .node-sprite {
      animation: none;
    }
  }
</style>
