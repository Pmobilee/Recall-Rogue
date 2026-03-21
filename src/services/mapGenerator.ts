/**
 * Slay the Spire-style dungeon map generator for Recall Rogue.
 *
 * Generates a 15-row act map with branching paths, typed room nodes, and
 * non-crossing edges. Uses a standalone mulberry32 PRNG seeded from the
 * provided seed so the layout is deterministic and reproducible without
 * interfering with any Math.random override in the rest of the codebase.
 *
 * Pure logic — no Phaser, Svelte, or DOM imports.
 */

import { MAP_CONFIG } from '../data/balance'
import { pickCombatEnemy, getMiniBossForFloor, pickBossForFloor } from './floorManager'

// ============================================================
// Public types
// ============================================================

export type MapNodeType = 'combat' | 'elite' | 'boss' | 'mystery' | 'rest' | 'treasure' | 'shop'

export interface MapNode {
  /** Stable identifier, e.g. "r3-n2" (row 3, node index 2 within the row). */
  id: string
  /** 0 = bottom (start row), 14 = boss row at top. */
  row: number
  /** Position index within this row (0-based, left-to-right). */
  col: number
  /** Normalised X position for rendering (0–1). */
  x: number
  /** Normalised Y position for rendering (0–1, 0 = bottom, 1 = top). */
  y: number
  type: MapNodeType
  /** Enemy template ID — present on combat, elite, and boss nodes. */
  enemyId?: string
  /** IDs of connected nodes in the next row (toward the boss). */
  childIds: string[]
  /** IDs of connected nodes in the previous row (toward the start). */
  parentIds: string[]
  state: 'locked' | 'available' | 'current' | 'visited'
}

export interface ActMap {
  segment: 1 | 2 | 3 | 4
  /** First floor number represented by this segment. */
  startFloor: number
  /** All nodes keyed by their id. */
  nodes: Record<string, MapNode>
  /** Node IDs grouped by row; index 0 is the bottom (start) row. */
  rows: string[][]
  currentNodeId: string | null
  visitedNodeIds: string[]
  seed: number
}

// ============================================================
// Internal PRNG — mulberry32
// ============================================================

/**
 * Returns a seeded pseudo-random number generator (mulberry32 algorithm).
 * Each call to the returned function yields a float in [0, 1).
 * Using a local PRNG avoids interfering with any Math.random override
 * used elsewhere for deterministic replay modes.
 */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let n = Math.imul(t ^ (t >>> 15), 1 | t)
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

// ============================================================
// Internal helpers
// ============================================================

/** Build a stable node ID from row and col. */
function nodeId(row: number, col: number): string {
  return `r${row}-n${col}`
}

/**
 * Weighted random pick from a distribution object.
 * Keys are type names, values are weights (need not sum to 1).
 */
function weightedPick(dist: Record<string, number>, rng: () => number): string {
  const total = Object.values(dist).reduce((s, w) => s + w, 0)
  let roll = rng() * total
  for (const [key, weight] of Object.entries(dist)) {
    roll -= weight
    if (roll <= 0) return key
  }
  return Object.keys(dist)[Object.keys(dist).length - 1]
}

// ============================================================
// Step 1 — Generate row sizes
// ============================================================

/**
 * Decide how many nodes each row will contain.
 * Rows 0..11 branch/merge organically.
 * Row 13 (PRE_BOSS) has 2–3 nodes.
 * Row 14 (BOSS) is always 1 node.
 */
function generateRowSizes(rng: () => number): number[] {
  const {
    ROWS_PER_ACT,
    START_PATHS,
    MIN_NODES_PER_ROW,
    MAX_NODES_PER_ROW,
    BRANCH_CHANCE,
    MERGE_CHANCE,
    PRE_BOSS_ROW,
    BOSS_ROW,
  } = MAP_CONFIG

  const sizes: number[] = new Array(ROWS_PER_ACT).fill(0)
  sizes[0] = START_PATHS

  for (let r = 1; r < ROWS_PER_ACT; r++) {
    if (r === PRE_BOSS_ROW) {
      sizes[r] = rng() < 0.5 ? 2 : 3
      continue
    }
    if (r === BOSS_ROW) {
      sizes[r] = 1
      continue
    }

    // Organic branching for rows 1–11
    const prev = sizes[r - 1]
    let next = prev
    if (rng() < BRANCH_CHANCE) next++
    else if (rng() < MERGE_CHANCE) next--
    sizes[r] = Math.max(MIN_NODES_PER_ROW, Math.min(MAX_NODES_PER_ROW, next))
  }

  return sizes
}

// ============================================================
// Step 2 — Build node stubs
// ============================================================

/**
 * Create the MapNode stubs (no edges yet, no types, no enemy IDs, placeholder state).
 * Positions (x, y) are computed here with slight jitter.
 */
function buildNodeStubs(sizes: number[], rng: () => number): Record<string, MapNode> {
  const { ROWS_PER_ACT } = MAP_CONFIG
  const nodes: Record<string, MapNode> = {}

  for (let r = 0; r < ROWS_PER_ACT; r++) {
    const count = sizes[r]
    for (let c = 0; c < count; c++) {
      const id = nodeId(r, c)
      const jitter = (rng() - 0.5) * 0.06
      const x = Math.max(0.05, Math.min(0.95, (c + 0.5) / count + jitter))
      const y = r / (ROWS_PER_ACT - 1)  // 0 = bottom, 1 = top
      nodes[id] = {
        id,
        row: r,
        col: c,
        x,
        y,
        type: 'combat',    // placeholder; overwritten in Step 4
        childIds: [],
        parentIds: [],
        state: 'locked',   // overwritten in Step 6
      }
    }
  }

  return nodes
}

// ============================================================
// Step 3 — Create edges (non-crossing)
// ============================================================

/**
 * Wire up childIds / parentIds between adjacent rows.
 *
 * Non-crossing rule: if node A is to the left of node B in row r,
 * then A's rightmost connection must be ≤ B's leftmost connection in row r+1.
 * We enforce this by assigning connections left-to-right and only connecting
 * to same-or-adjacent columns in the next row, then verifying orphans.
 */
function createEdges(
  nodes: Record<string, MapNode>,
  sizes: number[],
  rng: () => number,
): void {
  const { ROWS_PER_ACT } = MAP_CONFIG

  for (let r = 0; r < ROWS_PER_ACT - 1; r++) {
    const curCount = sizes[r]
    const nextCount = sizes[r + 1]

    // Track rightmost child column assigned so far (for non-crossing enforcement)
    let maxChildColUsed = -1

    for (let c = 0; c < curCount; c++) {
      const curId = nodeId(r, c)
      const curNode = nodes[curId]

      // Map this node's column position proportionally to the next row's range
      const mapped = Math.round((c / Math.max(curCount - 1, 1)) * Math.max(nextCount - 1, 0))
      const primaryChild = Math.max(maxChildColUsed, Math.min(nextCount - 1, mapped))

      // Connect to primary child
      const childId = nodeId(r + 1, primaryChild)
      if (!curNode.childIds.includes(childId)) {
        curNode.childIds.push(childId)
        nodes[childId].parentIds.push(curId)
      }
      maxChildColUsed = Math.max(maxChildColUsed, primaryChild)

      // Possibly connect to an adjacent child (branch), provided it doesn't cross
      if (rng() < 0.35 && primaryChild + 1 < nextCount) {
        const altChildId = nodeId(r + 1, primaryChild + 1)
        if (!curNode.childIds.includes(altChildId)) {
          curNode.childIds.push(altChildId)
          nodes[altChildId].parentIds.push(curId)
          maxChildColUsed = Math.max(maxChildColUsed, primaryChild + 1)
        }
      }
    }

    // Ensure every node in the next row has at least 1 parent (no orphans)
    for (let nc = 0; nc < nextCount; nc++) {
      const nextId = nodeId(r + 1, nc)
      if (nodes[nextId].parentIds.length === 0) {
        // Find the nearest current-row node and link it
        const nearest = Math.min(nc, curCount - 1)
        const nearId = nodeId(r, nearest)
        if (!nodes[nearId].childIds.includes(nextId)) {
          nodes[nearId].childIds.push(nextId)
        }
        nodes[nextId].parentIds.push(nearId)
      }
    }
  }
}

// ============================================================
// Step 4 — Assign room types
// ============================================================

/**
 * Assign a MapNodeType to every node, honouring special rows and
 * minimum-row constraints. Verifies that at least one rest and one shop
 * appear in rows 1–11, inserting them if needed.
 */
function assignRoomTypes(
  nodes: Record<string, MapNode>,
  sizes: number[],
  segment: 1 | 2 | 3 | 4,
  rng: () => number,
): void {
  const {
    ROWS_PER_ACT,
    ELITE_MIN_ROW,
    REST_MIN_ROW,
    SHOP_MIN_ROW,
    ELITE_MIN_COUNT,
    ELITE_MAX_COUNT,
    PRE_BOSS_ROW,
    BOSS_ROW,
    ROOM_DISTRIBUTION,
  } = MAP_CONFIG

  const dist = ROOM_DISTRIBUTION[segment]

  for (let r = 0; r < ROWS_PER_ACT; r++) {
    for (let c = 0; c < sizes[r]; c++) {
      const node = nodes[nodeId(r, c)]

      if (r === 0) {
        node.type = 'combat'
        continue
      }
      if (r === PRE_BOSS_ROW) {
        node.type = 'rest'
        continue
      }
      if (r === BOSS_ROW) {
        node.type = 'boss'
        continue
      }

      // General rows: weighted pick with constraint enforcement
      let type: string
      let attempts = 0
      do {
        type = weightedPick(dist, rng)
        attempts++
        // Retry if constraints are violated
        if (type === 'elite' && r < ELITE_MIN_ROW) continue
        if (type === 'rest'  && r < REST_MIN_ROW)  continue
        if (type === 'shop'  && r < SHOP_MIN_ROW)  continue
        break
      } while (attempts < 10)

      // Final fallback: if still violating after 10 attempts, use combat
      if (
        (type === 'elite' && r < ELITE_MIN_ROW) ||
        (type === 'rest'  && r < REST_MIN_ROW)  ||
        (type === 'shop'  && r < SHOP_MIN_ROW)
      ) {
        type = 'combat'
      }

      node.type = type as MapNodeType
    }
  }

  // The last regular row (before pre-boss) for guarantee checks
  const lastRegularRow = PRE_BOSS_ROW - 1

  // ── AR-116.6: Enforce exact room counts ──────────────────────
  const regularNodes = Object.values(nodes).filter(
    n => n.row >= 1 && n.row <= lastRegularRow && n.type !== 'boss',
  )

  const countType = (t: string) => regularNodes.filter(n => n.type === t).length

  // 1. Ensure exactly 1 rest in rows 1–lastRegularRow (PRE_BOSS_ROW already has rest)
  const restCount = countType('rest')
  if (restCount < 1) {
    const combatNodes = regularNodes.filter(n => n.type === 'combat' && n.row >= REST_MIN_ROW)
    if (combatNodes.length > 0) {
      combatNodes[Math.floor(rng() * combatNodes.length)].type = 'rest'
    }
  } else if (restCount > 1) {
    const rests = regularNodes.filter(n => n.type === 'rest')
    const keepIdx = Math.floor(rng() * rests.length)
    rests.forEach((n, i) => { if (i !== keepIdx) n.type = 'combat' })
  }

  // 2. Ensure exactly 2 shops, spaced apart (at least 2 rows between them)
  const shopNodesList = regularNodes.filter(n => n.type === 'shop')
  shopNodesList.forEach(n => { n.type = 'combat' })
  const shopCandidates = regularNodes.filter(n => n.type === 'combat' && n.row >= SHOP_MIN_ROW)
  if (shopCandidates.length >= 2) {
    const first = shopCandidates[Math.floor(rng() * shopCandidates.length)]
    first.type = 'shop'
    const secondCandidates = shopCandidates.filter(n => n.type === 'combat' && Math.abs(n.row - first.row) >= 2)
    if (secondCandidates.length > 0) {
      secondCandidates[Math.floor(rng() * secondCandidates.length)].type = 'shop'
    } else {
      const fallback = shopCandidates.filter(n => n.type === 'combat')
      if (fallback.length > 0) fallback[Math.floor(rng() * fallback.length)].type = 'shop'
    }
  }

  // 3. Ensure exactly 2 mystery rooms, not in same row as shops
  const mysteryNodesList = regularNodes.filter(n => n.type === 'mystery')
  mysteryNodesList.forEach(n => { n.type = 'combat' })
  const shopRows = new Set(regularNodes.filter(n => n.type === 'shop').map(n => n.row))
  const mysteryCandidates = regularNodes.filter(n => n.type === 'combat' && !shopRows.has(n.row))
  if (mysteryCandidates.length >= 2) {
    const first = mysteryCandidates[Math.floor(rng() * mysteryCandidates.length)]
    first.type = 'mystery'
    const secondCandidates = mysteryCandidates.filter(n => n.type === 'combat')
    if (secondCandidates.length > 0) {
      secondCandidates[Math.floor(rng() * secondCandidates.length)].type = 'mystery'
    }
  } else if (mysteryCandidates.length === 1) {
    mysteryCandidates[0].type = 'mystery'
    const fallback = regularNodes.filter(n => n.type === 'combat')
    if (fallback.length > 0) fallback[Math.floor(rng() * fallback.length)].type = 'mystery'
  }

  // Guarantee ELITE_MIN_COUNT–ELITE_MAX_COUNT elites in eligible rows
  const eliteNodes = Object.values(nodes).filter(
    n => n.type === 'elite' && n.row >= ELITE_MIN_ROW && n.row <= lastRegularRow,
  )
  let eliteCount = eliteNodes.length

  // Too few elites — convert some combat nodes to elite
  if (eliteCount < ELITE_MIN_COUNT) {
    const candidates = Object.values(nodes).filter(
      n => n.type === 'combat' && n.row >= ELITE_MIN_ROW && n.row <= lastRegularRow,
    )
    // Shuffle candidates using rng
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }
    for (const c of candidates) {
      if (eliteCount >= ELITE_MIN_COUNT) break
      c.type = 'elite'
      eliteCount++
    }
  }

  // Too many elites — convert excess back to combat
  if (eliteCount > ELITE_MAX_COUNT) {
    // Shuffle elite nodes for random removal
    const shuffledElites = [...eliteNodes]
    for (let i = shuffledElites.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledElites[i], shuffledElites[j]] = [shuffledElites[j], shuffledElites[i]]
    }
    for (const e of shuffledElites) {
      if (eliteCount <= ELITE_MAX_COUNT) break
      e.type = 'combat'
      eliteCount--
    }
  }
}

// ============================================================
// Step 5 — Assign enemy IDs
// ============================================================

/**
 * Assign enemy template IDs to combat, elite, and boss nodes.
 * Uses the floor-manager helpers (which may use Math.random internally;
 * that is acceptable here because the layout PRNG already determined the
 * map structure — enemy assignment is cosmetic variance per run).
 */
function assignEnemyIds(
  nodes: Record<string, MapNode>,
  startFloor: number,
  rng: () => number,
): void {
  const { ROWS_PER_ACT } = MAP_CONFIG

  for (const node of Object.values(nodes)) {
    const derivedFloor = startFloor + Math.floor(node.row * 6 / ROWS_PER_ACT)

    switch (node.type) {
      case 'combat':
        node.enemyId = pickCombatEnemy(derivedFloor)
        break
      case 'elite':
        node.enemyId = getMiniBossForFloor(derivedFloor)
        break
      case 'boss': {
        const bossFloor = startFloor + 5
        node.enemyId = pickBossForFloor(bossFloor, rng())
        break
      }
      default:
        // Non-combat nodes have no enemy
        break
    }
  }
}

// ============================================================
// Step 6 — Initialise state
// ============================================================

/**
 * Set initial availability: row 0 nodes are available, all others locked.
 * currentNodeId and visitedNodeIds are initialised to empty/null.
 */
function initialiseState(
  nodes: Record<string, MapNode>,
  sizes: number[],
): void {
  // Row 0 nodes are immediately selectable
  for (let c = 0; c < sizes[0]; c++) {
    nodes[nodeId(0, c)].state = 'available'
  }
}

// ============================================================
// Public API — generation
// ============================================================

/**
 * Generate a complete Slay the Spire-style act map.
 *
 * @param segment - Which act segment (1–4) this map represents.
 * @param seed    - Deterministic seed. Same seed always produces the same map layout.
 * @returns A fully initialised ActMap ready for rendering and navigation.
 */
export function generateActMap(segment: 1 | 2 | 3 | 4, seed: number): ActMap {
  const rng = mulberry32(seed)

  // Map each segment to its starting floor number
  const segmentStartFloors: Record<1 | 2 | 3 | 4, number> = { 1: 1, 2: 7, 3: 13, 4: 19 }
  const startFloor = segmentStartFloors[segment]

  // Step 1 — Row sizes
  const sizes = generateRowSizes(rng)

  // Step 2 — Node stubs (positions, no edges, no types)
  const nodes = buildNodeStubs(sizes, rng)

  // Step 3 — Edges (non-crossing Slay the Spire rule)
  createEdges(nodes, sizes, rng)

  // Step 4 — Room types
  assignRoomTypes(nodes, sizes, segment, rng)

  // Step 5 — Enemy IDs (boss uses seeded rng for variety across runs)
  assignEnemyIds(nodes, startFloor, rng)

  // Step 6 — Initial states
  initialiseState(nodes, sizes)

  // Build rows index
  const rows: string[][] = sizes.map((count, r) =>
    Array.from({ length: count }, (_, c) => nodeId(r, c)),
  )

  return {
    segment,
    startFloor,
    nodes,
    rows,
    currentNodeId: null,
    visitedNodeIds: [],
    seed,
  }
}

// ============================================================
// Public API — navigation helpers
// ============================================================

/**
 * Select a node on the map. Transitions:
 * - Previous `currentNodeId` → 'visited' (added to visitedNodeIds)
 * - Selected node            → 'current'
 * - Children of selected     → 'available' (if previously 'locked')
 * - Sibling available nodes in the same row → 'locked' (path committed)
 *
 * Mutates the map in-place.
 */
export function selectMapNode(map: ActMap, nodeId: string): void {
  const node = map.nodes[nodeId]
  if (!node) return

  // Mark previous current as visited
  if (map.currentNodeId !== null && map.currentNodeId !== nodeId) {
    const prev = map.nodes[map.currentNodeId]
    if (prev) {
      prev.state = 'visited'
      if (!map.visitedNodeIds.includes(map.currentNodeId)) {
        map.visitedNodeIds.push(map.currentNodeId)
      }
    }
  }

  // Lock siblings in the same row that are still 'available'
  const rowNodes = map.rows[node.row] ?? []
  for (const sibId of rowNodes) {
    if (sibId !== nodeId && map.nodes[sibId]?.state === 'available') {
      map.nodes[sibId].state = 'locked'
    }
  }

  // Activate the selected node
  node.state = 'current'
  map.currentNodeId = nodeId

  // Unlock children
  for (const childId of node.childIds) {
    const child = map.nodes[childId]
    if (child && child.state === 'locked') {
      child.state = 'available'
    }
  }
}

/**
 * Return the IDs of all nodes currently in the 'available' state.
 */
export function getAvailableNodes(map: ActMap): string[] {
  return Object.values(map.nodes)
    .filter(n => n.state === 'available')
    .map(n => n.id)
}

/**
 * Return true if the act map is complete — i.e. the boss node has been visited.
 */
export function isActMapComplete(map: ActMap): boolean {
  const { BOSS_ROW } = MAP_CONFIG
  const bossNodes = map.rows[BOSS_ROW] ?? []
  return bossNodes.some(id => map.nodes[id]?.state === 'visited')
}

/**
 * Derive the equivalent linear floor number from a node's row position within the act.
 * Useful for feeding into floorManager functions that expect a floor number.
 */
export function deriveFloorFromNode(map: ActMap, node: MapNode): number {
  const { ROWS_PER_ACT } = MAP_CONFIG
  return map.startFloor + Math.floor(node.row * 6 / ROWS_PER_ACT)
}
