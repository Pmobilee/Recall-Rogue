/**
 * Format combat combo multipliers consistently for HUD display.
 */
export function formatComboMultiplier(multiplier: number): string {
  const safeMultiplier = Number.isFinite(multiplier) ? Math.max(1, multiplier) : 1
  return `${safeMultiplier.toFixed(2)}x`
}

/**
 * Human-facing combo label text.
 */
export function getComboDisplayText(count: number, multiplier: number, isPerfectTurn: boolean): string {
  if (isPerfectTurn) return 'PERFECT!'
  if (count < 1) return ''
  return formatComboMultiplier(multiplier)
}
