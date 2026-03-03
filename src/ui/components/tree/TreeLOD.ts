// src/ui/components/tree/TreeLOD.ts

/** The three zoom levels of the Knowledge Tree. */
export type TreeLODLevel = 'forest' | 'branch' | 'leaf'

/** Complete LOD navigation state. */
export interface TreeLODState {
  level: TreeLODLevel
  /** Set when level === 'branch' or 'leaf' */
  focusedCategory: string | null
  /** Set when level === 'leaf' */
  focusedSubcategory: string | null
}

/** Returns the initial (fully zoomed out) LOD state. */
export function initialLOD(): TreeLODState {
  return { level: 'forest', focusedCategory: null, focusedSubcategory: null }
}

/** Produce next state when tapping a main branch. */
export function zoomToBranch(category: string): TreeLODState {
  return { level: 'branch', focusedCategory: category, focusedSubcategory: null }
}

/** Produce next state when tapping a sub-branch. */
export function zoomToLeaf(category: string, subcategory: string): TreeLODState {
  return { level: 'leaf', focusedCategory: category, focusedSubcategory: subcategory }
}

/** Go back one level. */
export function zoomOut(state: TreeLODState): TreeLODState {
  if (state.level === 'leaf') {
    return { level: 'branch', focusedCategory: state.focusedCategory, focusedSubcategory: null }
  }
  return initialLOD()
}
