<script lang="ts">
  /**
   * GaiaAvatar — animated expression indicator for GAIA ship AI.
   * Phase 57.5: Micro-expressions using colored div placeholders.
   *
   * Expressions cycle frames at different rates:
   *   - idle: 1200ms per frame (slow, ambient)
   *   - other expressions: 150ms per frame (rapid, emotive)
   *
   * Since no actual sprite sheet exists, we use colored circle placeholders
   * with labels: idle=green, excited=yellow, proud=blue, concerned=orange, celebrate=purple
   */

  import { gaiaExpression } from '../stores/gameState'

  interface Props {
    /** Override expression (if not provided, reads from gaiaExpression store). */
    expression?: string
  }

  let { expression }: Props = $props()

  /** Resolve effective expression: prop override > store value */
  const effectiveExpr = $derived(expression ?? $gaiaExpression)

  /** Frame index for animation cycling. */
  let frame = $state(0)

  /** Expression-to-color mapping. */
  const EXPR_COLORS: Record<string, string> = {
    idle:      '#44cc44',
    neutral:   '#44cc44',
    excited:   '#ffd700',
    proud:     '#4a9eff',
    concerned: '#ff8800',
    worried:   '#ff8800',
    celebrate: '#cc44ff',
    happy:     '#4ecca3',
    thinking:  '#6688cc',
    surprised: '#ff6688',
    snarky:    '#ff44aa',
  }

  const EXPR_LABELS: Record<string, string> = {
    idle:      'IDLE',
    neutral:   'IDLE',
    excited:   'EXCT',
    proud:     'PRWD',
    concerned: 'CNCN',
    worried:   'CNCN',
    celebrate: 'CLBR',
    happy:     'HPPY',
    thinking:  'THNK',
    surprised: 'SURP',
    snarky:    'SNRK',
  }

  /** Frame cycle rate depends on expression. */
  const cycleMs = $derived(
    effectiveExpr === 'idle' || effectiveExpr === 'neutral' ? 1200 : 150
  )

  const color = $derived(EXPR_COLORS[effectiveExpr] ?? '#44cc44')
  const label = $derived(EXPR_LABELS[effectiveExpr] ?? 'IDLE')

  /** Opacity pulses between frames for animation feel. */
  const opacity = $derived(0.7 + 0.3 * Math.abs((frame % 4) - 2) / 2)

  $effect(() => {
    const ms = cycleMs
    const interval = setInterval(() => {
      frame++
    }, ms)
    return () => clearInterval(interval)
  })
</script>

<div
  class="gaia-avatar"
  aria-label="GAIA expression: {effectiveExpr}"
  role="img"
>
  <div
    class="avatar-circle"
    style="background-color: {color}; opacity: {opacity};"
  >
    <span class="avatar-label">{label}</span>
  </div>
</div>

<style>
  .gaia-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  .avatar-circle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.3s ease, opacity 0.15s ease;
    box-shadow: 0 0 8px currentColor;
    position: relative;
  }

  .avatar-label {
    font-size: 7px;
    font-weight: 800;
    color: #0a0a1a;
    letter-spacing: 0.5px;
    font-family: monospace;
    user-select: none;
    pointer-events: none;
  }
</style>
