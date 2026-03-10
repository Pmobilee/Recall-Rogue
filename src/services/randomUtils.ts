/**
 * Returns a shuffled copy of the input array using Fisher-Yates.
 * This avoids the bias of `sort(() => Math.random() - 0.5)`.
 */
export function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

