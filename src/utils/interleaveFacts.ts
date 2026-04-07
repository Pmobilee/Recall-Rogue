/**
 * Round-robin interleave multiple arrays by source.
 *
 * Given [[a1,a2,a3], [b1,b2], [c1]], produces [a1,b1,c1,a2,b2,a3].
 *
 * This ensures proportional representation from ALL sources starting from the
 * very first element. Without interleaving, a playlist run's fact pool is built
 * via sequential concatenation — the largest deck appears first and monopolizes
 * early quiz encounters because the Anki selector works FIFO for new cards.
 *
 * @param arrays - One array per source (e.g. one per playlist deck item).
 *   Empty arrays are accepted and contribute nothing.
 * @returns A single flat array with elements round-robined across sources.
 */
export function interleaveFacts<T>(arrays: T[][]): T[] {
  const result: T[] = [];
  const maxLen = Math.max(...arrays.map(a => a.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (i < arr.length) result.push(arr[i]);
    }
  }
  return result;
}
