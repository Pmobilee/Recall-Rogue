<script lang="ts">
  interface Props {
    value: string
    isCritical: boolean
    onComplete?: () => void
  }

  let { value, isCritical, onComplete }: Props = $props()

  // Extract numeric value for proportional scaling
  let numericValue = $derived(parseInt(value.match(/\d+/)?.[0] ?? '0', 10))

  // Scale font size proportionally: small hits = small text, big hits = big text
  let fontSize = $derived(
    isCritical
      ? (numericValue <= 5 ? 32 : numericValue >= 20 ? 44 : 32 + Math.round(((numericValue - 5) / 15) * 12))
      : (numericValue <= 5 ? 24 : numericValue >= 20 ? 36 : 24 + Math.round(((numericValue - 5) / 15) * 12))
  )

  // Random X offset to prevent damage numbers from stacking at the same position
  const jitterX = (Math.random() - 0.5) * 50

  // Auto-remove after animation
  $effect(() => {
    const timer = setTimeout(() => onComplete?.(), 600)
    return () => clearTimeout(timer)
  })
</script>

<div
  class="damage-number"
  class:critical={isCritical}
  data-testid="damage-number"
  style="font-size: {fontSize}px; left: calc(50% + {jitterX}px);"
>
  {value}
</div>

<style>
  .damage-number {
    position: absolute;
    top: 40%;
    left: 50%;
    transform: translateX(-50%);
    font-weight: 900;
    color: #FFD700;
    text-shadow:
      2px 2px 0 rgba(0, 0, 0, 0.9),
      -1px -1px 0 rgba(0, 0, 0, 0.5),
      0 0 8px rgba(255, 215, 0, 0.5);
    pointer-events: none;
    z-index: 100;
    animation: damageArc 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
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
    width: 60px;
    height: 60px;
    transform: translate(-50%, -50%) scale(0);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(231, 76, 60, 0.4) 0%, transparent 70%);
    animation: critRipple 400ms ease-out forwards;
    pointer-events: none;
  }

  /* Elastic bounce animation with weight and physicality */
  @keyframes damageArc {
    0% {
      transform: translateX(-50%) translateY(0) scale(0.3);
      opacity: 0;
    }
    12% {
      transform: translateX(-50%) translateY(-10px) scale(1.4);
      opacity: 1;
    }
    28% {
      transform: translateX(-50%) translateY(-55px) scale(1.1);
      opacity: 1;
    }
    42% {
      transform: translateX(-50%) translateY(-35px) scale(1.25);
      opacity: 1;
    }
    55% {
      transform: translateX(-50%) translateY(-45px) scale(0.95);
      opacity: 1;
    }
    70% {
      transform: translateX(-50%) translateY(-40px) scale(1.05);
      opacity: 0.9;
    }
    85% {
      transform: translateX(-50%) translateY(-35px) scale(1.0);
      opacity: 0.6;
    }
    100% {
      transform: translateX(-50%) translateY(-25px) scale(1.0);
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
      transform: translateX(-50%) translateY(-40px);
    }
    .damage-number.critical::after {
      animation: none;
      display: none;
    }
  }
</style>
