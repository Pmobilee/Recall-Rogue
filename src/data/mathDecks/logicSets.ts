/**
 * Logic & Sets procedural deck definition.
 *
 * Covers truth table evaluation, set operations (union, intersection, difference,
 * symmetric difference), Venn diagram inclusion-exclusion, logical equivalence
 * identification, and set cardinality counting. Each sub-deck contains one
 * SkillNode whose difficulty scales across the four FSRS card tiers (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/logicSets.ts
 * Related docs: docs/mechanics/procedural-math.md, docs/content/deck-system.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const LOGIC_SETS_DECK: ProceduralDeck = {
  id: 'logic_sets',
  name: 'Logic & Sets',
  domain: 'mathematics',
  description: 'Master truth tables, set operations, Venn diagrams, logical equivalences, and set cardinality.',
  skills: [
    {
      id: 'logic_truth_table',
      name: 'Truth Tables',
      description: 'Evaluate logical expressions row by row in truth tables.',
      generatorId: 'truth_table',
      tierParams: {
        // rangeA[0] = complexity: 1 = simple 2-var (∧,∨,→,↔), 2 = + negated compounds
        '1':  { rangeA: [1, 1], rangeB: [1, 1] },
        '2a': { rangeA: [2, 2], rangeB: [1, 1] },
        '2b': { rangeA: [2, 2], rangeB: [2, 2] },
        '3':  { rangeA: [2, 2], rangeB: [2, 2] },
      },
    },
    {
      id: 'logic_set_ops',
      name: 'Set Operations',
      description: 'Compute unions, intersections, differences, and symmetric differences of sets.',
      generatorId: 'set_operations',
      tierParams: {
        // rangeA/B = element value range; operations = allowed set ops by tier
        '1':  { rangeA: [1, 8],  rangeB: [1, 8],  operations: ['union', 'intersection'] },
        '2a': { rangeA: [1, 10], rangeB: [1, 10], operations: ['union', 'intersection', 'difference'] },
        '2b': { rangeA: [1, 12], rangeB: [1, 12], operations: ['union', 'intersection', 'difference', 'symmetric_difference'] },
        '3':  { rangeA: [1, 15], rangeB: [1, 15], operations: ['union', 'intersection', 'difference', 'symmetric_difference'] },
      },
    },
    {
      id: 'logic_venn',
      name: 'Venn Diagrams',
      description: 'Apply inclusion-exclusion to find set sizes from Venn diagrams.',
      generatorId: 'venn_diagram',
      tierParams: {
        // rangeA = set size range, rangeB = intersection size range, steps = mode
        '1':  { rangeA: [5, 15],  rangeB: [1, 5], steps: 1 },  // 2-set: find |A∪B|
        '2a': { rangeA: [8, 20],  rangeB: [2, 7], steps: 2 },  // reverse-solve: find |B|
        '2b': { rangeA: [5, 12],  rangeB: [1, 4], steps: 3 },  // 3-set formula
        '3':  { rangeA: [5, 12],  rangeB: [1, 4], steps: 4 },  // find specific region
      },
    },
    {
      id: 'logic_equivalence',
      name: 'Logical Equivalence',
      description: "Identify logically equivalent expressions using De Morgan's laws and other rules.",
      generatorId: 'logical_equivalence',
      tierParams: {
        // rangeA[0] = tier pool selector: 1 = commutativity/De Morgan, 2 = contrapositive, 3 = distributive/absorption
        '1':  { rangeA: [1, 1], rangeB: [1, 1] },
        '2a': { rangeA: [2, 2], rangeB: [1, 1] },
        '2b': { rangeA: [2, 2], rangeB: [2, 2] },
        '3':  { rangeA: [3, 3], rangeB: [2, 2] },
      },
    },
    {
      id: 'logic_cardinality',
      name: 'Set Cardinality',
      description: 'Count elements using divisibility rules, power sets, and inclusion-exclusion.',
      generatorId: 'set_cardinality',
      tierParams: {
        // steps = mode: 1 = floor(n/k), 2 = 2-set incl-excl, 3 = power set, 4 = 3-set incl-excl
        '1':  { rangeA: [10, 50],  rangeB: [2, 7], steps: 1 },
        '2a': { rangeA: [20, 100], rangeB: [2, 9], steps: 2 },
        '2b': { rangeA: [2, 5],    rangeB: [1, 1], steps: 3 },
        '3':  { rangeA: [30, 150], rangeB: [2, 7], steps: 4 },
      },
    },
  ],
  subDecks: [
    { id: 'truth_tables',    name: 'Truth Tables',        skillIds: ['logic_truth_table'] },
    { id: 'set_operations',  name: 'Set Operations',      skillIds: ['logic_set_ops'] },
    { id: 'venn_diagrams',   name: 'Venn Diagrams',       skillIds: ['logic_venn'] },
    { id: 'equivalence',     name: 'Logical Equivalence', skillIds: ['logic_equivalence'] },
    { id: 'cardinality',     name: 'Set Cardinality',     skillIds: ['logic_cardinality'] },
  ],
};
