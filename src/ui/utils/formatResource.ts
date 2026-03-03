/**
 * Abbreviates large resource numbers for HUD display.
 *
 * - 0–999: displayed as-is (e.g., "847")
 * - 1,000–999,999: abbreviated with K (e.g., "1.2K")
 * - 1,000,000+: abbreviated with M (e.g., "3.4M")
 *
 * @param n - The resource amount to format.
 * @returns Abbreviated string representation.
 */
export function formatResource(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
