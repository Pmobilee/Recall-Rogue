/**
 * Trigonometry procedural deck definition.
 *
 * Covers standard angle evaluation, inverse trig, right-triangle solving,
 * unit circle coordinates, and trig identity evaluation. Each sub-deck contains
 * one SkillNode whose difficulty scales across the four FSRS card tiers
 * (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/trigonometry.ts
 * Related docs: docs/mechanics/procedural-math.md, docs/content/deck-system.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const TRIGONOMETRY_DECK: ProceduralDeck = {
  id: 'trigonometry',
  name: 'Trigonometry',
  domain: 'mathematics',
  description: 'Master sine, cosine, tangent, the unit circle, and trigonometric identities.',
  skills: [
    {
      id: 'trig_standard',
      name: 'Standard Angle Values',
      description: 'Evaluate sin, cos, and tan at standard angles.',
      generatorId: 'trig_standard_angle',
      tierParams: {
        '1':  { rangeA: [0, 90],  rangeB: [0, 90],  angles: [0, 30, 45, 60, 90], trigFunctions: ['sin', 'cos'] },
        '2a': { rangeA: [0, 90],  rangeB: [0, 90],  angles: [0, 30, 45, 60, 90], trigFunctions: ['sin', 'cos', 'tan'] },
        '2b': { rangeA: [0, 180], rangeB: [0, 180], angles: [0, 30, 45, 60, 90, 120, 135, 150, 180], trigFunctions: ['sin', 'cos', 'tan'] },
        '3':  { rangeA: [0, 360], rangeB: [0, 360], angles: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360], trigFunctions: ['sin', 'cos', 'tan'] },
      },
    },
    {
      id: 'trig_inverse',
      name: 'Inverse Trig',
      description: 'Find the angle given a trigonometric ratio.',
      generatorId: 'trig_inverse',
      tierParams: {
        '1':  { rangeA: [0, 90],  rangeB: [0, 90],  angles: [0, 30, 45, 60, 90], trigFunctions: ['sin', 'cos'] },
        '2a': { rangeA: [0, 90],  rangeB: [0, 90],  angles: [0, 30, 45, 60, 90], trigFunctions: ['sin', 'cos', 'tan'] },
        '2b': { rangeA: [0, 180], rangeB: [0, 180], angles: [0, 30, 45, 60, 90, 120, 135, 150, 180], trigFunctions: ['sin', 'cos', 'tan'] },
        '3':  { rangeA: [0, 360], rangeB: [0, 360], angles: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330], trigFunctions: ['sin', 'cos', 'tan'] },
      },
    },
    {
      id: 'trig_right_triangle',
      name: 'Right Triangle Solving',
      description: 'Find angles in right triangles given side lengths.',
      generatorId: 'trig_right_triangle',
      tierParams: {
        '1':  { rangeA: [1, 2], rangeB: [1, 2] },
        '2a': { rangeA: [1, 3], rangeB: [1, 3] },
        '2b': { rangeA: [2, 5], rangeB: [2, 5] },
        '3':  { rangeA: [3, 8], rangeB: [3, 8] },
      },
    },
    {
      id: 'trig_unit_circle',
      name: 'Unit Circle',
      description: 'Find coordinates and values on the unit circle.',
      generatorId: 'trig_unit_circle',
      tierParams: {
        '1':  { rangeA: [0, 90],  rangeB: [0, 90],  angles: [0, 90, 180, 270, 360], trigFunctions: ['sin', 'cos'] },
        '2a': { rangeA: [0, 180], rangeB: [0, 180], angles: [0, 30, 45, 60, 90, 120, 135, 150, 180], trigFunctions: ['sin', 'cos'] },
        '2b': { rangeA: [0, 360], rangeB: [0, 360], angles: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360], trigFunctions: ['sin', 'cos'] },
        '3':  { rangeA: [0, 360], rangeB: [0, 360], angles: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360], trigFunctions: ['sin', 'cos', 'tan'] },
      },
    },
    {
      id: 'trig_identity',
      name: 'Trig Identities',
      description: 'Evaluate expressions using trigonometric identities.',
      generatorId: 'trig_identity',
      tierParams: {
        '1':  { rangeA: [0, 90],  rangeB: [0, 90],  angles: [30, 45, 60], steps: 1 },
        '2a': { rangeA: [0, 180], rangeB: [0, 180], angles: [30, 45, 60, 120, 135, 150], steps: 1 },
        '2b': { rangeA: [0, 360], rangeB: [0, 360], angles: [30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330], steps: 2 },
        '3':  { rangeA: [0, 360], rangeB: [0, 360], angles: [30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330], steps: 2 },
      },
    },
  ],
  subDecks: [
    { id: 'standard_angles', name: 'Standard Angle Values', skillIds: ['trig_standard'] },
    { id: 'inverse_trig',    name: 'Inverse Trig',          skillIds: ['trig_inverse'] },
    { id: 'right_triangles', name: 'Right Triangle Solving', skillIds: ['trig_right_triangle'] },
    { id: 'unit_circle',     name: 'Unit Circle',            skillIds: ['trig_unit_circle'] },
    { id: 'identities',      name: 'Trig Identities',        skillIds: ['trig_identity'] },
  ],
};
