<script lang="ts">
  type DamageNumberType = 'damage' | 'block' | 'heal' | 'poison' | 'burn' | 'bleed' | 'gold' | 'critical' | 'status' | 'buff'

  interface Props {
    value: string
    isCritical: boolean
    type?: DamageNumberType
    position?: 'enemy' | 'player'
    onComplete?: () => void
  }

  let { value, isCritical, type = 'damage', position = 'enemy', onComplete }: Props = $props()

  // Color mapping per type
  const TYPE_COLORS: Record<DamageNumberType, string> = {
    damage:   '#FF4444',
    block:    '#4499FF',
    heal:     '#44FF88',
    poison:   '#AA44FF',
    burn:     '#FF8833',
    bleed:    '#CC1111',
    gold:     '#FFD700',
    critical: '#E74C3C',
    status:   '#4ADE80',
    buff:     '#38BDF8',
  }

  // Text-shadow glow mapping per type (rgba of the color at low opacity)
  const TYPE_GLOWS: Record<DamageNumberType, string> = {
    damage:   'rgba(255, 68, 68, 0.5)',
    block:    'rgba(68, 153, 255, 0.5)',
    heal:     'rgba(68, 255, 136, 0.5)',
    poison:   'rgba(170, 68, 255, 0.5)',
    burn:     'rgba(255, 136, 51, 0.5)',
    bleed:    'rgba(204, 17, 17, 0.5)',
    gold:     'rgba(255, 215, 0, 0.5)',
    critical: 'rgba(231, 76, 60, 0.6)',
    status:   'rgba(74, 222, 128, 0.5)',
    buff:     'rgba(56, 189, 248, 0.5)',
  }

  // Derive effective type: if isCritical and type is damage, treat as critical for color
  let effectiveType = $derived<DamageNumberType>(isCritical && type === 'damage' ? 'critical' : type)
  let color = $derived(TYPE_COLORS[effectiveType])
  let glow = $derived(TYPE_GLOWS[effectiveType])

  // Extract numeric value for proportional scaling
  let numericValue = $derived(parseInt(value.match(/\d+/)?.[0] ?? '0', 10))

  // Scale font size proportionally: small hits = small text, big hits = big text
  // Status/buff types use a fixed smaller size since they display text labels, not big numbers
  let fontSize = $derived(
    (type === 'status' || type === 'buff')
      ? 18
      : isCritical
        ? (numericValue <= 5 ? 32 : numericValue >= 20 ? 44 : 32 + Math.round(((numericValue - 5) / 15) * 12))
        : (numericValue <= 5 ? 24 : numericValue >= 20 ? 36 : 24 + Math.round(((numericValue - 5) / 15) * 12))
  )

  // Random arc direction: left (-1) or right (+1)
  const arcDirection = Math.random() < 0.5 ? -1 : 1

  // Random X jitter to prevent stacking at the same position
  const jitterX = (Math.random() - 0.5) * 20

  // Vertical anchor: enemy numbers appear at ~35% of screen; player numbers from near HP bar (~82%)
  let topAnchor = $derived(position === 'player' ? '82%' : '35%')

  // Horizontal anchor: enemy at 65% (right of sprite), player ~15% (near player HP bar)
  let leftAnchor = $derived(position === 'player' ? '15%' : '65%')

  // Auto-remove after animation completes (1000ms for arc animation)
  $effect(() => {
    const timer = setTimeout(() => onComplete?.(), 1000)
    return () => clearTimeout(timer)
  })
</script>

<div
  class="damage-number"
  class:critical={isCritical}
  data-testid="damage-number"
  data-type={effectiveType}
  data-position={position}
  style="font-size: calc({fontSize}px * var(--layout-scale, 1)); left: calc({leftAnchor} + {jitterX}px); top: {topAnchor}; color: {color}; text-shadow: 2px 2px 0 rgba(0,0,0,0.9), -1px -1px 0 rgba(0,0,0,0.5), 0 0 8px {glow}; --arc-dir: {arcDirection};"
>
  {value}
</div>

<style>
  .damage-number {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-weight: 900;
    color: #FF4444;
    text-shadow:
      2px 2px 0 rgba(0, 0, 0, 0.9),
      -1px -1px 0 rgba(0, 0, 0, 0.5),
      0 0 8px rgba(255, 68, 68, 0.5);
    pointer-events: none;
    z-index: 100;
    --arc-dir: 1;
    animation: damageArc 1000ms ease-out forwards;
  }

  .damage-number.critical {
    color: #E74C3C;
    text-shadow:
      2px 2px 0 rgba(0, 0, 0, 0.9),
      -1px -1px 0 rgba(0, 0, 0, 0.5),
      0 0 12px rgba(231, 76, 60, 0.6);
  }

  /* Critical hit impact ripple */
  .damage-number.critical::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: calc(60px * var(--layout-scale, 1));
    height: calc(60px * var(--layout-scale, 1));
    transform: translate(-50%, -50%) scale(0);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(231, 76, 60, 0.4) 0%, transparent 70%);
    animation: critRipple 400ms ease-out forwards;
    pointer-events: none;
  }

  /* Arc trajectory: pops up then curves to the side and down, fading out */
  @keyframes damageArc {
    0% {
      transform: translateX(-50%) translate(0, 0) scale(1.2);
      opacity: 1;
    }
    30% {
      transform: translateX(-50%) translate(calc(var(--arc-dir, 1) * 30px), -20px) scale(1);
      opacity: 1;
    }
    100% {
      transform: translateX(-50%) translate(calc(var(--arc-dir, 1) * 60px), 40px) scale(0.8);
      opacity: 0;
    }
  }

  /* Radial pulse for critical impact */
  @keyframes critRipple {
    0% {
      transform: translate(-50%, -50%) scale(0);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(3);
      opacity: 0;
    }
  }

  /* Respect user motion preferences */
  @media (prefers-reduced-motion: reduce) {
    .damage-number {
      animation: none;
      opacity: 1;
      transform: translateX(-50%) translate(0, -20px);
    }
    .damage-number.critical::after {
      animation: none;
      display: none;
    }
  }

</style>
