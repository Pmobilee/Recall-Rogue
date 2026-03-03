<script lang="ts">
  import { getMasteryLevel, isDue } from '../../services/sm2'
  import { playerSave } from '../stores/playerData'
  import { CATEGORIES } from '../../data/types'
  import type { Fact, ReviewState } from '../../data/types'
  import type { TreeLODState } from './tree/TreeLOD'

  interface Props {
    facts: Fact[]
    lod: TreeLODState
    showMode: 'learned' | 'all'
    onMainBranchTap: (category: string) => void
    onSubBranchTap: (category: string, subcategory: string) => void
    onLeafTap: (factId: string) => void
    onLeafLongPress: (factId: string) => void
    onPinchIn: () => void
    onPinchOut: () => void
  }

  let {
    facts,
    lod,
    showMode,
    onMainBranchTap,
    onSubBranchTap,
    onLeafTap,
    onLeafLongPress,
    onPinchIn,
    onPinchOut,
  }: Props = $props()

  // ─── SVG layout constants ───────────────────────────────────────────────────
  const VW = 800
  const VH = 600
  const TRUNK_X = VW / 2
  const TRUNK_BASE_Y = VH - 20
  const TRUNK_TOP_Y = VH - 120

  // Branch configs: angle in degrees from vertical (negative = left, positive = right)
  type BranchConfig = {
    category: string
    angle: number
    trunkT: number
    length: number
    side: 'left' | 'right'
  }

  const BRANCH_CONFIGS: BranchConfig[] = [
    { category: 'Language',        angle: -30, trunkT: 0.05, length: 160, side: 'left'  },
    { category: 'Life Sciences',   angle: -55, trunkT: 0.22, length: 155, side: 'left'  },
    { category: 'History',         angle: -75, trunkT: 0.42, length: 145, side: 'left'  },
    { category: 'Culture',         angle: -88, trunkT: 0.62, length: 130, side: 'left'  },
    { category: 'Natural Sciences',angle:  30, trunkT: 0.10, length: 160, side: 'right' },
    { category: 'Geography',       angle:  55, trunkT: 0.28, length: 155, side: 'right' },
    { category: 'Technology',      angle:  80, trunkT: 0.50, length: 140, side: 'right' },
  ]

  // ─── Mastery colors (DD-V2-098: greyscale → orange/autumn → green) ────────
  type MasteryLevel = 'new' | 'learning' | 'familiar' | 'known' | 'mastered'

  const MASTERY_COLOR: Record<MasteryLevel, string> = {
    new:      '#3d3d50',
    learning: '#9a5a28',
    familiar: '#c87830',
    known:    '#5a9060',
    mastered: '#4ecca3',
  }

  // ─── Data interfaces ──────────────────────────────────────────────────────
  interface LeafData {
    x: number
    y: number
    mastery: MasteryLevel
    due: boolean
    factId: string
    subcategory: string
    isSilhouette?: boolean
  }

  interface SubBranchData {
    subcategory: string
    parentCategory: string
    startX: number
    startY: number
    endX: number
    endY: number
    cp1X: number
    cp1Y: number
    cp2X: number
    cp2Y: number
    labelX: number
    labelY: number
    labelAnchor: string
    leaves: LeafData[]
    silhouetteLeaves: LeafData[]
    leafCount: number
    totalCount: number
    completionRatio: number
    isNew: boolean
  }

  interface BranchData {
    category: string
    config: BranchConfig
    startX: number
    startY: number
    endX: number
    endY: number
    cp1X: number
    cp1Y: number
    cp2X: number
    cp2Y: number
    labelX: number
    labelY: number
    labelAnchor: string
    leaves: LeafData[]
    subBranches: SubBranchData[]
    hasLeaves: boolean
    leafCount: number
    totalCount: number
    completionRatio: number
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Convert degrees (clockwise from upward vertical) to dx/dy vector */
  function branchVector(angleDeg: number, length: number): { dx: number; dy: number } {
    const rad = (angleDeg * Math.PI) / 180
    return {
      dx: Math.sin(rad) * length,
      dy: -Math.cos(rad) * length,
    }
  }

  /** Deterministic pseudo-random from a seed string */
  function seededRand(seed: string, index: number): number {
    let h = 0
    for (let i = 0; i < seed.length; i++) {
      h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
    }
    h = (Math.imul(h, index + 1337)) | 0
    return Math.abs(h % 1000) / 1000
  }

  /** Interpolate between two hex colors */
  function lerpColor(hex1: string, hex2: string, t: number): string {
    const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16)
    const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16)
    const r = Math.round(r1 + (r2 - r1) * t)
    const g = Math.round(g1 + (g2 - g1) * t)
    const b = Math.round(b1 + (b2 - b1) * t)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  /** Map completion ratio to branch color (4-stop ramp) */
  function completionColor(ratio: number): string {
    if (ratio === 0)    return '#2a2a3a'
    if (ratio < 0.25)   return '#9a5a28'
    if (ratio < 0.5)    return '#c87830'
    if (ratio < 0.75)   return '#5a9060'
    return '#4ecca3'
  }

  /** Sub-branch color based on its completion ratio */
  function subBranchColor(ratio: number): string {
    return completionColor(ratio)
  }

  /** Compute overdue severity (0 = not overdue, up to 1.0 = 7+ days overdue) */
  function overdueSeverity(rs: ReviewState | undefined): number {
    if (!rs || !isDue(rs) || rs.repetitions === 0) return 0
    const overdueMs = Date.now() - rs.nextReviewAt
    return Math.min(overdueMs / (7 * 24 * 60 * 60 * 1000), 1.0)
  }

  /** De Casteljau cubic bezier point at parameter t */
  function cubicBezierPoint(
    sx: number, sy: number, c1x: number, c1y: number,
    c2x: number, c2y: number, ex: number, ey: number, t: number,
  ): { x: number; y: number } {
    const mt = 1 - t
    return {
      x: mt * mt * mt * sx + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * ex,
      y: mt * mt * mt * sy + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * ey,
    }
  }

  // ─── Sub-branch computation ───────────────────────────────────────────────

  function computeSubBranches(
    parent: BranchData,
    subcategories: string[],
    factsPerSub: Map<string, { learned: LeafData[]; total: number; unlearnedFacts: Fact[] }>,
  ): SubBranchData[] {
    const SUB_LENGTH = 60
    const FAN_HALF = 55
    const parentAngleDeg = parent.config.angle
    const count = subcategories.length

    return subcategories.map((sub, i): SubBranchData => {
      const t = count === 1 ? 0.5 : i / (count - 1)
      const subAngleDeg = parentAngleDeg - FAN_HALF + t * (FAN_HALF * 2)
      const { dx, dy } = branchVector(subAngleDeg, SUB_LENGTH)

      const startX = parent.endX
      const startY = parent.endY
      const endX = startX + dx
      const endY = startY + dy

      const cp1X = startX + dx * 0.3
      const cp1Y = startY + dy * 0.15
      const cp2X = startX + dx * 0.7
      const cp2Y = startY + dy * 0.7

      const side = endX > parent.endX ? 'right' : 'left'
      const labelAnchor = side === 'right' ? 'start' : 'end'
      const labelX = endX + (side === 'right' ? 6 : -6)
      const labelY = endY - 6

      const data = factsPerSub.get(sub) ?? { learned: [], total: 0, unlearnedFacts: [] }
      const completionRatio = data.total > 0 ? data.learned.length / data.total : 0

      // Position leaves along sub-branch curve
      const leaves: LeafData[] = data.learned.map((leaf, li): LeafData => {
        const total = data.learned.length
        const spread = total === 1 ? 0.6 : 0.25 + (li / (total - 1)) * 0.7
        const jitter = (seededRand(leaf.factId, li) - 0.5) * 16
        const perpX = -dy / SUB_LENGTH
        const perpY = dx / SUB_LENGTH
        const pt = cubicBezierPoint(startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY, spread)
        return {
          ...leaf,
          x: pt.x + perpX * jitter,
          y: pt.y + perpY * jitter,
          subcategory: sub,
        }
      })

      // Silhouette leaves for 80%+ completion in "all" mode
      const silhouetteLeaves: LeafData[] = (showMode === 'all' && completionRatio >= 0.8)
        ? data.unlearnedFacts.map((f, ui): LeafData => {
            const spread = 0.6 + (ui / Math.max(data.unlearnedFacts.length - 1, 1)) * 0.35
            const jitter = (seededRand(f.id, ui + 999) - 0.5) * 14
            const perpX = -dy / SUB_LENGTH
            const perpY = dx / SUB_LENGTH
            const pt = cubicBezierPoint(startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY, spread)
            return {
              x: pt.x + perpX * jitter,
              y: pt.y + perpY * jitter,
              mastery: 'new',
              due: false,
              factId: f.id,
              subcategory: sub,
              isSilhouette: true,
            }
          })
        : []

      return {
        subcategory: sub,
        parentCategory: parent.category,
        startX, startY, endX, endY,
        cp1X, cp1Y, cp2X, cp2Y,
        labelX, labelY, labelAnchor,
        leaves,
        silhouetteLeaves,
        leafCount: data.learned.length,
        totalCount: data.total,
        completionRatio,
        isNew: false,
      }
    })
  }

  // ─── Derived tree data ─────────────────────────────────────────────────────

  const treeData = $derived.by((): BranchData[] => {
    const save = $playerSave

    // Build lookup: factId -> ReviewState
    const reviewStateMap = new Map<string, ReviewState>()
    if (save) {
      for (const rs of save.reviewStates) {
        reviewStateMap.set(rs.factId, rs)
      }
    }

    // Build lookup: factId -> { mastery, due }
    const factStateMap = new Map<string, { mastery: MasteryLevel; due: boolean }>()
    if (save) {
      for (const factId of save.learnedFacts) {
        const rs = reviewStateMap.get(factId)
        factStateMap.set(factId, {
          mastery: rs ? getMasteryLevel(rs) : 'new',
          due: rs ? isDue(rs) : true,
        })
      }
    }

    return BRANCH_CONFIGS.map((config): BranchData => {
      const startX = TRUNK_X
      const startY = TRUNK_TOP_Y + (TRUNK_BASE_Y - TRUNK_TOP_Y) * (1 - config.trunkT)
      const { dx, dy } = branchVector(config.angle, config.length)
      const endX = startX + dx
      const endY = startY + dy

      const cp1X = startX + dx * 0.25
      const cp1Y = startY + dy * 0.1
      const cp2X = startX + dx * 0.65
      const cp2Y = startY + dy * 0.6

      const labelOffsetX = config.side === 'left' ? -10 : 10
      const labelX = endX + labelOffsetX
      const labelY = endY - 10
      const labelAnchor = config.side === 'left' ? 'end' : 'start'

      const categoryFacts = facts.filter((f) => f.category[0] === config.category)
      const learnedInCategory = categoryFacts.filter((f) => factStateMap.has(f.id))

      // Build all leaves (positioned along main branch for backward compat)
      const leaves: LeafData[] = learnedInCategory.map((f, i): LeafData => {
        const state = factStateMap.get(f.id)!
        const total = learnedInCategory.length
        const spread = total === 1 ? 0.6 : 0.25 + (i / (total - 1)) * 0.7
        const jitterSeed = seededRand(f.id, i)
        const perpJitter = (jitterSeed - 0.5) * 22
        const perpX = -dy / config.length
        const perpY = dx / config.length
        const pt = cubicBezierPoint(startX, startY, cp1X, cp1Y, cp2X, cp2Y, endX, endY, spread)
        return {
          x: pt.x + perpX * perpJitter,
          y: pt.y + perpY * perpJitter,
          mastery: state.mastery,
          due: state.due,
          factId: f.id,
          subcategory: f.category[1] ?? 'General',
        }
      })

      const completionRatio = categoryFacts.length > 0 ? learnedInCategory.length / categoryFacts.length : 0

      // Build sub-branch data
      const subcategoryMap = new Map<string, { learned: LeafData[]; total: number; unlearnedFacts: Fact[] }>()
      for (const fact of categoryFacts) {
        const sub = fact.category[1] ?? 'General'
        if (!subcategoryMap.has(sub)) subcategoryMap.set(sub, { learned: [], total: 0, unlearnedFacts: [] })
        const entry = subcategoryMap.get(sub)!
        entry.total++
        if (factStateMap.has(fact.id)) {
          const state = factStateMap.get(fact.id)!
          entry.learned.push({
            x: 0, y: 0,
            mastery: state.mastery,
            due: state.due,
            factId: fact.id,
            subcategory: sub,
          })
        } else {
          entry.unlearnedFacts.push(fact)
        }
      }

      const discoveredSubs = [...subcategoryMap.keys()].filter(
        (sub) => (subcategoryMap.get(sub)?.learned.length ?? 0) > 0
      )

      // Build a temporary branch for sub-branch computation
      const branchResult: BranchData = {
        category: config.category,
        config,
        startX, startY, endX, endY,
        cp1X, cp1Y, cp2X, cp2Y,
        labelX, labelY, labelAnchor,
        leaves,
        subBranches: [],
        hasLeaves: leaves.length > 0,
        leafCount: leaves.length,
        totalCount: categoryFacts.length,
        completionRatio,
      }

      branchResult.subBranches = computeSubBranches(branchResult, discoveredSubs, subcategoryMap)

      return branchResult
    })
  })

  // ─── Summary counts ────────────────────────────────────────────────────────
  const totalLeaves = $derived(treeData.reduce((s, b) => s + b.leafCount, 0))

  // ─── Recently reviewed set (last 5 minutes) ───────────────────────────────
  const recentlyReviewed = $derived.by(() => {
    const save = $playerSave
    if (!save) return new Set<string>()
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    return new Set(
      save.reviewStates
        .filter(rs => rs.lastReviewAt >= fiveMinutesAgo)
        .map(rs => rs.factId)
    )
  })

  // ─── ReviewState map for severity lookups ──────────────────────────────────
  const reviewStateMap = $derived.by(() => {
    const save = $playerSave
    if (!save) return new Map<string, ReviewState>()
    const m = new Map<string, ReviewState>()
    for (const rs of save.reviewStates) m.set(rs.factId, rs)
    return m
  })

  // ─── Trunk path ────────────────────────────────────────────────────────────
  const trunkPath = $derived(`M ${TRUNK_X} ${TRUNK_BASE_Y} L ${TRUNK_X} ${TRUNK_TOP_Y}`)

  // ─── Trunk color shift based on overall mastery ────────────────────────────
  const trunkTopColor = $derived.by(() => {
    const total = Math.max(facts.length, 1)
    const ratio = totalLeaves / total
    return lerpColor('#8b5e3c', '#2a7050', Math.min(ratio * 1.5, 1))
  })

  // ─── ViewBox computation based on LOD ──────────────────────────────────────

  function computeFocusViewBox(branch: BranchData): string {
    const PADDING = 60
    const xs: number[] = [branch.startX, branch.endX, branch.labelX]
    const ys: number[] = [branch.startY, branch.endY, branch.labelY]
    for (const leaf of branch.leaves) { xs.push(leaf.x); ys.push(leaf.y) }
    for (const sub of branch.subBranches) {
      xs.push(sub.startX, sub.endX, sub.labelX)
      ys.push(sub.startY, sub.endY, sub.labelY)
    }
    const minX = Math.min(...xs) - PADDING
    const maxX = Math.max(...xs) + PADDING
    const minY = Math.min(...ys) - PADDING
    const maxY = Math.max(...ys) + PADDING
    const rawW = maxX - minX
    const rawH = maxY - minY
    const targetAspect = VW / VH
    let w = rawW, h = rawH
    if (w / h > targetAspect) { h = w / targetAspect } else { w = h * targetAspect }
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`
  }

  const currentViewBox = $derived.by((): string => {
    const FULL = `0 0 ${VW} ${VH}`
    if (lod.level === 'forest') return FULL

    const branch = treeData.find(b => b.category === lod.focusedCategory)
    if (!branch) return FULL

    if (lod.level === 'branch') return computeFocusViewBox(branch)

    // Leaf level: zoom into specific sub-branch
    const sub = branch.subBranches.find(s => s.subcategory === lod.focusedSubcategory)
    if (!sub) return computeFocusViewBox(branch)

    const PADDING = 40
    const xs = [sub.startX, sub.endX, sub.labelX, ...sub.leaves.map(l => l.x)]
    const ys = [sub.startY, sub.endY, sub.labelY, ...sub.leaves.map(l => l.y)]
    const minX = Math.min(...xs) - PADDING
    const maxX = Math.max(...xs) + PADDING
    const minY = Math.min(...ys) - PADDING
    const maxY = Math.max(...ys) + PADDING
    const rawW = maxX - minX
    const rawH = maxY - minY
    const targetAspect = VW / VH
    let w = rawW, h = rawH
    if (w / h > targetAspect) { h = w / targetAspect } else { w = h * targetAspect }
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`
  })

  // ─── Viewport culling helper ──────────────────────────────────────────────
  function isInViewBox(x: number, y: number): boolean {
    const parts = currentViewBox.split(' ').map(Number)
    const [vx, vy, vw, vh] = parts
    return x >= vx - 50 && x <= vx + vw + 50 && y >= vy - 50 && y <= vy + vh + 50
  }

  // ─── Pinch-to-zoom gesture ────────────────────────────────────────────────
  let pinchStartDist = 0

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchStartDist = Math.hypot(dx, dy)
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (pinchStartDist > 0 && e.changedTouches.length >= 1 && e.touches.length === 0) {
      // We can't measure final distance on touchend for pinch (both fingers lifted)
      // Instead, use touchmove to track
      pinchStartDist = 0
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (e.touches.length === 2 && pinchStartDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const currentDist = Math.hypot(dx, dy)
      const ratio = currentDist / pinchStartDist
      if (ratio > 1.5) {
        pinchStartDist = currentDist
        onPinchOut()
      } else if (ratio < 0.67) {
        pinchStartDist = currentDist
        onPinchIn()
      }
    }
  }

  // ─── Long-press handling ──────────────────────────────────────────────────
  let longPressTimer: ReturnType<typeof setTimeout> | null = null

  function onLeafTouchStart(factId: string) {
    longPressTimer = setTimeout(() => {
      onLeafLongPress(factId)
      longPressTimer = null
    }, 500)
  }

  function onLeafTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }
</script>

<svg
  class="knowledge-tree-svg"
  viewBox={currentViewBox}
  preserveAspectRatio="xMidYMid meet"
  aria-label="Knowledge tree showing learned facts by category"
  role="img"
  ontouchstart={onTouchStart}
  ontouchend={onTouchEnd}
  ontouchmove={onTouchMove}
>
  <defs>
    <!-- Trunk gradient: dynamic top color based on overall mastery -->
    <linearGradient id="trunk-grad" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#5c3a1e" />
      <stop offset="100%" stop-color={trunkTopColor} />
    </linearGradient>

    <!-- Subtle ground glow -->
    <radialGradient id="ground-glow" cx="50%" cy="100%" r="40%">
      <stop offset="0%" stop-color="#3a2a14" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#1a1a2e" stop-opacity="0" />
    </radialGradient>

    <!-- Mastered leaf pulse animation filter -->
    <filter id="mastered-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Known leaf subtle glow -->
    <filter id="known-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Ground fill beneath trunk -->
  <ellipse cx={TRUNK_X} cy={TRUNK_BASE_Y} rx="80" ry="14" fill="url(#ground-glow)" />

  <!-- Trunk -->
  <path d={trunkPath} stroke="url(#trunk-grad)" stroke-width="14" stroke-linecap="round" fill="none" />

  <!-- Branches -->
  {#each treeData as branch (branch.category)}
    {@const isEmpty = !branch.hasLeaves}
    {@const isFocusedBranch = lod.focusedCategory === branch.category}
    {@const isOtherBranch = lod.focusedCategory !== null && lod.focusedCategory !== branch.category}
    {@const branchStrokeWidth = isEmpty ? 2 : 2 + branch.completionRatio * 6}
    {@const branchColor = completionColor(branch.completionRatio)}
    {@const branchPath = `M ${branch.startX} ${branch.startY} C ${branch.cp1X} ${branch.cp1Y}, ${branch.cp2X} ${branch.cp2Y}, ${branch.endX} ${branch.endY}`}

    <!-- ═══ FOREST LEVEL ═══ -->
    {#if lod.level === 'forest'}
      <!-- Background potential bar in "all facts" mode -->
      {#if showMode === 'all'}
        <path d={branchPath} stroke="#2a2a3a" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.5" />
      {/if}

      <!-- Main branch path -->
      <path
        d={branchPath}
        stroke={branchColor}
        stroke-width={showMode === 'all' ? 6 + branch.completionRatio * 8 : branchStrokeWidth}
        stroke-linecap="round"
        stroke-dasharray={isEmpty ? '5 6' : 'none'}
        stroke-opacity={isEmpty ? 0.5 : 1}
        fill="none"
        data-category={branch.category}
      />

      <!-- Tap target for branch (invisible clickable area) -->
      <path
        d={branchPath}
        stroke="transparent"
        stroke-width="30"
        fill="none"
        style="cursor: pointer"
        onclick={() => onMainBranchTap(branch.category)}
        role="button"
        tabindex="0"
        aria-label="Zoom into {branch.category}"
        onkeydown={(e) => e.key === 'Enter' && onMainBranchTap(branch.category)}
      />

      <!-- Category label -->
      <text
        x={branch.labelX} y={branch.labelY}
        text-anchor={branch.labelAnchor}
        font-family="'Courier New', monospace" font-size="11" font-weight="600"
        fill={branch.hasLeaves ? '#c8c8d8' : '#555570'}
        letter-spacing="0.5"
      >
        {branch.category}
      </text>

      <!-- Completion percentage / count -->
      {#if branch.leafCount > 0}
        <text
          x={branch.labelX} y={branch.labelY + 13}
          text-anchor={branch.labelAnchor}
          font-family="'Courier New', monospace" font-size="9"
          fill="#888899"
        >
          {showMode === 'all'
            ? `${branch.leafCount}/${branch.totalCount} (${Math.round(branch.completionRatio * 100)}%)`
            : `${branch.leafCount} learned`}
        </text>
      {:else}
        <text
          x={branch.labelX} y={branch.labelY + 13}
          text-anchor={branch.labelAnchor}
          font-family="'Courier New', monospace" font-size="9"
          fill="#444455" font-style="italic"
        >
          unexplored
        </text>
      {/if}

      <!-- Twigs near tip for non-empty branches -->
      {#if branch.hasLeaves}
        <line
          x1={branch.endX} y1={branch.endY}
          x2={branch.endX + (branch.config.side === 'left' ? -18 : 18)} y2={branch.endY - 14}
          stroke="#8b5e3c" stroke-width="2" stroke-linecap="round" opacity="0.7"
        />
        <line
          x1={branch.endX} y1={branch.endY}
          x2={branch.endX + (branch.config.side === 'left' ? 10 : -10)} y2={branch.endY - 18}
          stroke="#8b5e3c" stroke-width="2" stroke-linecap="round" opacity="0.5"
        />
      {/if}
    {/if}

    <!-- ═══ BRANCH LEVEL ═══ -->
    {#if lod.level === 'branch'}
      <!-- Main branch (always visible for context) -->
      <path
        d={branchPath}
        stroke={isFocusedBranch ? '#6ee8c0' : branchColor}
        stroke-width={isFocusedBranch ? branchStrokeWidth + 1.5 : branchStrokeWidth}
        stroke-linecap="round"
        stroke-dasharray={isEmpty ? '5 6' : 'none'}
        stroke-opacity={isOtherBranch ? 0.15 : isEmpty ? 0.5 : 1}
        fill="none"
      />

      <!-- Category label -->
      <text
        x={branch.labelX} y={branch.labelY}
        text-anchor={branch.labelAnchor}
        font-family="'Courier New', monospace" font-size="11" font-weight="600"
        fill={isFocusedBranch ? '#e8e8ff' : branch.hasLeaves ? '#c8c8d8' : '#555570'}
        letter-spacing="0.5"
        opacity={isOtherBranch ? 0.2 : 1}
      >
        {branch.category}
      </text>
      {#if branch.leafCount > 0}
        <text
          x={branch.labelX} y={branch.labelY + 13}
          text-anchor={branch.labelAnchor}
          font-family="'Courier New', monospace" font-size="9"
          fill={isOtherBranch ? '#444455' : '#888899'}
        >
          {branch.leafCount}/{branch.totalCount}
        </text>
      {/if}

      <!-- Sub-branches (only for focused branch) -->
      {#if isFocusedBranch}
        {#each branch.subBranches as sub (sub.subcategory)}
          <!-- Sub-branch path -->
          <path
            d="M {sub.startX} {sub.startY} C {sub.cp1X} {sub.cp1Y}, {sub.cp2X} {sub.cp2Y}, {sub.endX} {sub.endY}"
            stroke={subBranchColor(sub.completionRatio)}
            stroke-width={1.5 + sub.completionRatio * 3}
            stroke-linecap="round"
            fill="none"
            class={sub.isNew ? 'sub-branch sub-branch--new' : 'sub-branch'}
            data-subcategory={sub.subcategory}
          />

          <!-- Sub-branch label -->
          <text
            x={sub.labelX} y={sub.labelY}
            text-anchor={sub.labelAnchor}
            font-family="'Courier New', monospace" font-size="8" fill="#a0a0b8"
          >
            {sub.subcategory}
          </text>
          <text
            x={sub.labelX} y={sub.labelY + 10}
            text-anchor={sub.labelAnchor}
            font-family="'Courier New', monospace" font-size="7" fill="#606070"
          >
            {sub.leafCount}/{sub.totalCount}
          </text>

          <!-- Tap target for sub-branch -->
          <rect
            x={Math.min(sub.startX, sub.endX) - 15}
            y={Math.min(sub.startY, sub.endY) - 15}
            width={Math.abs(sub.endX - sub.startX) + 30}
            height={Math.abs(sub.endY - sub.startY) + 30}
            fill="transparent"
            style="cursor: pointer"
            onclick={() => onSubBranchTap(branch.category, sub.subcategory)}
            role="button"
            tabindex="0"
            aria-label="Zoom into {sub.subcategory}"
            onkeydown={(e) => e.key === 'Enter' && onSubBranchTap(branch.category, sub.subcategory)}
          />
        {/each}
      {/if}
    {/if}

    <!-- ═══ LEAF LEVEL ═══ -->
    {#if lod.level === 'leaf'}
      <!-- Main branch path (dimmed context) -->
      <path
        d={branchPath}
        stroke={isFocusedBranch ? '#6ee8c0' : branchColor}
        stroke-width={branchStrokeWidth}
        stroke-linecap="round"
        stroke-opacity={isOtherBranch ? 0.1 : isFocusedBranch ? 0.8 : 0.3}
        fill="none"
      />

      {#if isFocusedBranch}
        <!-- Show the focused sub-branch and its leaves -->
        {#each branch.subBranches as sub (sub.subcategory)}
          {@const isActiveSub = sub.subcategory === lod.focusedSubcategory}
          <!-- Sub-branch path -->
          <path
            d="M {sub.startX} {sub.startY} C {sub.cp1X} {sub.cp1Y}, {sub.cp2X} {sub.cp2Y}, {sub.endX} {sub.endY}"
            stroke={subBranchColor(sub.completionRatio)}
            stroke-width={isActiveSub ? 3 + sub.completionRatio * 3 : 1}
            stroke-linecap="round"
            fill="none"
            opacity={isActiveSub ? 1 : 0.25}
          />

          <!-- Sub-branch label (only on active) -->
          {#if isActiveSub}
            <text
              x={sub.labelX} y={sub.labelY}
              text-anchor={sub.labelAnchor}
              font-family="'Courier New', monospace" font-size="8" fill="#c0c0d8"
            >
              {sub.subcategory}
            </text>
            <text
              x={sub.labelX} y={sub.labelY + 10}
              text-anchor={sub.labelAnchor}
              font-family="'Courier New', monospace" font-size="7" fill="#808090"
            >
              {sub.leafCount}/{sub.totalCount}
            </text>
          {/if}

          <!-- Render leaf nodes only for the focused sub-branch -->
          {#if isActiveSub}
            {#each sub.leaves as leaf (leaf.factId)}
              {#if isInViewBox(leaf.x, leaf.y)}
                {@const isMastered = leaf.mastery === 'mastered'}
                {@const isKnown = leaf.mastery === 'known'}
                {@const isRecent = recentlyReviewed.has(leaf.factId)}
                {@const severity = overdueSeverity(reviewStateMap.get(leaf.factId))}
                {@const leafColor = severity > 0
                  ? lerpColor(MASTERY_COLOR[leaf.mastery], '#a09060', severity * 0.5)
                  : MASTERY_COLOR[leaf.mastery]}

                <!-- Droop line for overdue -->
                {#if severity > 0}
                  <line
                    x1={leaf.x} y1={leaf.y + 5}
                    x2={leaf.x + (seededRand(leaf.factId, 99) - 0.5) * 3}
                    y2={leaf.y + 5 + 4 + severity * 8}
                    stroke={leafColor}
                    stroke-width="1.5"
                    stroke-linecap="round"
                    opacity={0.3 + severity * 0.5}
                  />
                {/if}

                <circle
                  cx={leaf.x} cy={leaf.y}
                  r={isMastered ? 6 : 5}
                  fill={leafColor}
                  opacity={leaf.due && leaf.mastery !== 'new' ? 0.45 : 0.92}
                  filter={isMastered ? 'url(#mastered-glow)' : isKnown ? 'url(#known-glow)' : 'none'}
                  class="{isMastered ? 'leaf-mastered' : ''}{isRecent ? ' leaf-recent' : ''}"
                  data-fact-id={leaf.factId}
                  style="cursor: pointer"
                  onclick={() => onLeafTap(leaf.factId)}
                  ontouchstart={() => onLeafTouchStart(leaf.factId)}
                  ontouchend={onLeafTouchEnd}
                  role="button"
                  tabindex="0"
                  aria-label="{leaf.mastery} fact"
                  onkeydown={(e) => e.key === 'Enter' && onLeafTap(leaf.factId)}
                />
              {/if}
            {/each}

            <!-- Silhouette nodes for missing facts at 80%+ sub-branch completion -->
            {#each sub.silhouetteLeaves as leaf (leaf.factId)}
              {#if isInViewBox(leaf.x, leaf.y)}
                <circle
                  cx={leaf.x} cy={leaf.y} r={4}
                  fill="none" stroke="#444455" stroke-width="1"
                  stroke-dasharray="2 2" opacity="0.5"
                  aria-label="Undiscovered fact"
                />
                <text
                  x={leaf.x} y={leaf.y + 3}
                  text-anchor="middle" font-size="5" fill="#444455" opacity="0.6"
                >?</text>
              {/if}
            {/each}
          {/if}
        {/each}
      {/if}
    {/if}
  {/each}

  <!-- Empty state text if no facts at all -->
  {#if totalLeaves === 0 && lod.level === 'forest'}
    <text
      x={TRUNK_X} y={TRUNK_TOP_Y - 30}
      text-anchor="middle"
      font-family="'Courier New', monospace" font-size="13"
      fill="#555570" font-style="italic"
    >
      Dive to discover your first fact
    </text>
  {/if}
</svg>

<style>
  .knowledge-tree-svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
    transition: viewBox 0.6s ease-in-out;
  }

  :global(.leaf-mastered) {
    animation: leaf-pulse 2.4s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }

  @keyframes leaf-pulse {
    0%, 100% { opacity: 0.92; }
    50%       { opacity: 1.0; }
  }

  @keyframes sub-branch-grow {
    from { stroke-dashoffset: 80; opacity: 0; }
    to   { stroke-dashoffset: 0;  opacity: 1; }
  }

  :global(.sub-branch--new) {
    stroke-dasharray: 80;
    stroke-dashoffset: 80;
    animation: sub-branch-grow 0.6s ease-out forwards;
  }

  @keyframes leaf-recent-pulse {
    0%, 100% { opacity: 0.92; }
    30%       { opacity: 1.0; filter: brightness(1.4); }
  }

  :global(.leaf-recent) {
    animation: leaf-recent-pulse 1.5s ease-in-out 3;
  }
</style>
