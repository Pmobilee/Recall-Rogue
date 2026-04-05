/**
 * Coordinate Geometry procedural deck definition.
 *
 * Covers distance between two points, midpoint of a segment, slope of a line,
 * line equations in slope-intercept form, and circle equations in standard form.
 * Each sub-deck contains one SkillNode whose difficulty scales across the four
 * FSRS card tiers.
 *
 * Source files: src/data/mathDecks/coordGeometry.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const COORD_GEOMETRY_DECK: ProceduralDeck = {
  id: 'coord_geometry',
  name: 'Coordinate Geometry',
  domain: 'mathematics',
  description: 'Distance, midpoint, slope, line equations, and circle equations on the coordinate plane.',
  skills: [
    {
      id: 'cg_distance',
      name: 'Distance Formula',
      description: 'Find the distance between two points using the distance formula.',
      generatorId: 'distance_formula',
      tierParams: {
        '1':  { rangeA: [1, 1], rangeB: [-5, 5] },
        '2a': { rangeA: [1, 2], rangeB: [-8, 8] },
        '2b': { rangeA: [1, 3], rangeB: [-10, 10] },
        '3':  { rangeA: [2, 4], rangeB: [-12, 12] },
      },
    },
    {
      id: 'cg_midpoint',
      name: 'Midpoint Formula',
      description: 'Find the midpoint of a segment given its two endpoints.',
      generatorId: 'midpoint_formula',
      tierParams: {
        '1':  { rangeA: [1, 5],  rangeB: [1, 5] },
        '2a': { rangeA: [1, 8],  rangeB: [1, 8] },
        '2b': { rangeA: [1, 10], rangeB: [1, 10] },
        '3':  { rangeA: [1, 15], rangeB: [1, 15] },
      },
    },
    {
      id: 'cg_slope',
      name: 'Slope of a Line',
      description: 'Find the slope of a line through two points, including horizontal and vertical cases.',
      generatorId: 'slope_formula',
      tierParams: {
        '1':  { rangeA: [1, 5],  rangeB: [1, 5] },
        '2a': { rangeA: [1, 8],  rangeB: [1, 8] },
        '2b': { rangeA: [1, 10], rangeB: [1, 10] },
        '3':  { rangeA: [1, 12], rangeB: [1, 12] },
      },
    },
    {
      id: 'cg_line_equation',
      name: 'Line Equations',
      description: 'Write the equation of a line in slope-intercept form from slope, intercept, or two points.',
      generatorId: 'line_equation',
      tierParams: {
        '1':  { rangeA: [1, 5],  rangeB: [-5, 5],   operations: ['tier1'] },
        '2a': { rangeA: [1, 6],  rangeB: [-8, 8],   operations: ['tier1', 'tier2a'] },
        '2b': { rangeA: [1, 8],  rangeB: [-10, 10], operations: ['tier1', 'tier2a', 'tier2b'] },
        '3':  { rangeA: [1, 10], rangeB: [-12, 12], operations: ['tier2a', 'tier2b', 'tier3'] },
      },
    },
    {
      id: 'cg_circle',
      name: 'Circle Equations',
      description: 'Work with circle equations in standard and general form: center, radius, and r².',
      generatorId: 'circle_equation',
      tierParams: {
        '1':  { rangeA: [-6, 6],  rangeB: [2, 10],  operations: ['tier1'] },
        '2a': { rangeA: [-8, 8],  rangeB: [2, 13],  operations: ['tier1', 'tier2a'] },
        '2b': { rangeA: [-8, 8],  rangeB: [2, 13],  operations: ['tier1', 'tier2a', 'tier2b'] },
        '3':  { rangeA: [-10, 10], rangeB: [3, 17], operations: ['tier2a', 'tier2b', 'tier3'] },
      },
    },
  ],
  subDecks: [
    { id: 'distance',      name: 'Distance Formula',   skillIds: ['cg_distance'] },
    { id: 'midpoint',      name: 'Midpoint Formula',   skillIds: ['cg_midpoint'] },
    { id: 'slope',         name: 'Slope of a Line',    skillIds: ['cg_slope'] },
    { id: 'line_equation', name: 'Line Equations',     skillIds: ['cg_line_equation'] },
    { id: 'circle',        name: 'Circle Equations',   skillIds: ['cg_circle'] },
  ],
};
