/**
 * Geometry procedural deck definition.
 *
 * Covers area of 2D shapes, perimeter and circumference, volume of 3D shapes,
 * angle relationships, and the Pythagorean theorem. Each sub-deck contains one
 * SkillNode whose difficulty scales across the four FSRS card tiers.
 *
 * Source files: src/data/mathDecks/geometry.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const GEOMETRY_DECK: ProceduralDeck = {
  id: 'geometry',
  name: 'Geometry',
  domain: 'mathematics',
  description: 'Calculate areas, perimeters, volumes, and solve angle and triangle problems.',
  skills: [
    {
      id: 'geo_area',
      name: 'Area',
      description: 'Calculate the area of rectangles, triangles, circles, and trapezoids.',
      generatorId: 'area',
      tierParams: {
        '1':  { rangeA: [2, 10], rangeB: [2, 10], shapes: ['rectangle', 'square'] },
        '2a': { rangeA: [3, 15], rangeB: [3, 15], shapes: ['rectangle', 'triangle'] },
        '2b': { rangeA: [2, 12], rangeB: [2, 12], shapes: ['rectangle', 'triangle', 'circle'] },
        '3':  { rangeA: [3, 20], rangeB: [3, 20], shapes: ['rectangle', 'triangle', 'circle', 'trapezoid'] },
      },
    },
    {
      id: 'geo_perimeter',
      name: 'Perimeter & Circumference',
      description: 'Calculate the perimeter of shapes and circumference of circles.',
      generatorId: 'perimeter',
      tierParams: {
        '1':  { rangeA: [2, 15], rangeB: [2, 15], shapes: ['rectangle', 'square'] },
        '2a': { rangeA: [3, 20], rangeB: [3, 20], shapes: ['rectangle', 'triangle'] },
        '2b': { rangeA: [2, 15], rangeB: [2, 15], shapes: ['rectangle', 'triangle', 'circle'] },
        '3':  { rangeA: [5, 30], rangeB: [5, 30], shapes: ['rectangle', 'triangle', 'circle'] },
      },
    },
    {
      id: 'geo_volume',
      name: 'Volume',
      description: 'Calculate volumes of cubes, prisms, cylinders, spheres, and cones.',
      generatorId: 'volume',
      tierParams: {
        '1':  { rangeA: [2, 8],  rangeB: [2, 8],  shapes: ['cube', 'rectangular_prism'] },
        '2a': { rangeA: [2, 10], rangeB: [2, 10], shapes: ['cube', 'rectangular_prism', 'cylinder'] },
        '2b': { rangeA: [2, 8],  rangeB: [2, 8],  shapes: ['cube', 'rectangular_prism', 'cylinder', 'sphere'] },
        '3':  { rangeA: [2, 12], rangeB: [2, 12], shapes: ['cube', 'rectangular_prism', 'cylinder', 'sphere', 'cone'] },
      },
    },
    {
      id: 'geo_angles',
      name: 'Angle Relationships',
      description: 'Find missing angles using complementary, supplementary, and triangle properties.',
      generatorId: 'angle_relationship',
      tierParams: {
        '1':  { rangeA: [10, 80],  rangeB: [10, 80],  operations: ['complementary'] },
        '2a': { rangeA: [10, 170], rangeB: [10, 170], operations: ['complementary', 'supplementary'] },
        '2b': { rangeA: [20, 120], rangeB: [20, 120], operations: ['complementary', 'supplementary', 'triangle'] },
        '3':  { rangeA: [15, 150], rangeB: [15, 150], operations: ['complementary', 'supplementary', 'triangle', 'vertical'] },
      },
    },
    {
      id: 'geo_pythag',
      name: 'Pythagorean Theorem',
      description: 'Find the missing side of a right triangle using the Pythagorean theorem.',
      generatorId: 'pythagorean',
      tierParams: {
        '1':  { rangeA: [1, 2], rangeB: [1, 2] },
        '2a': { rangeA: [1, 3], rangeB: [1, 3] },
        '2b': { rangeA: [2, 5], rangeB: [2, 5] },
        '3':  { rangeA: [3, 8], rangeB: [3, 8] },
      },
    },
  ],
  subDecks: [
    { id: 'area',        name: 'Area',                     skillIds: ['geo_area'] },
    { id: 'perimeter',   name: 'Perimeter & Circumference', skillIds: ['geo_perimeter'] },
    { id: 'volume',      name: 'Volume',                   skillIds: ['geo_volume'] },
    { id: 'angles',      name: 'Angle Relationships',      skillIds: ['geo_angles'] },
    { id: 'pythagorean', name: 'Pythagorean Theorem',      skillIds: ['geo_pythag'] },
  ],
};
