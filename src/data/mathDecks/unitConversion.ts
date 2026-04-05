/**
 * Unit Conversion procedural deck definition.
 *
 * Covers length, weight/mass, temperature, area/volume, and speed conversions
 * between metric and imperial units. Each sub-deck contains one SkillNode whose
 * difficulty scales across the four FSRS card tiers (1, 2a, 2b, 3).
 *
 * Tier progression per skill:
 *   T1  (steps=1) — same-system conversions, always integer answers.
 *   T2a (steps=2) — cross-system with clean 1-decimal values.
 *   T2b (steps=3) — less-clean cross-system, still ≤ 1 decimal.
 *   T3  (steps=4) — chained multi-step conversions.
 *
 * Source files: src/data/mathDecks/unitConversion.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const UNIT_CONVERSION_DECK: ProceduralDeck = {
  id: 'unit_conversion',
  name: 'Unit Conversion',
  domain: 'mathematics',
  description: 'Convert between metric and imperial units for length, weight, temperature, area/volume, and speed.',
  skills: [
    {
      id: 'length_conversion',
      name: 'Length Conversion',
      description: 'Convert between length units: cm, m, km, mm, inches, feet, miles.',
      generatorId: 'length_conversion',
      tierParams: {
        '1':  { rangeA: [1, 1000], rangeB: [1, 100], steps: 1 },
        '2a': { rangeA: [1, 100],  rangeB: [1, 100], steps: 2 },
        '2b': { rangeA: [1, 100],  rangeB: [1, 100], steps: 3 },
        '3':  { rangeA: [1, 1000], rangeB: [1, 100], steps: 4 },
      },
    },
    {
      id: 'weight_conversion',
      name: 'Weight & Mass Conversion',
      description: 'Convert between weight/mass units: g, kg, mg, oz, lbs, tonnes.',
      generatorId: 'weight_conversion',
      tierParams: {
        '1':  { rangeA: [1, 1000], rangeB: [1, 100], steps: 1 },
        '2a': { rangeA: [1, 100],  rangeB: [1, 100], steps: 2 },
        '2b': { rangeA: [1, 100],  rangeB: [1, 100], steps: 3 },
        '3':  { rangeA: [1, 1000], rangeB: [1, 100], steps: 4 },
      },
    },
    {
      id: 'temperature_conversion',
      name: 'Temperature Conversion',
      description: 'Convert between Fahrenheit, Celsius, and Kelvin.',
      generatorId: 'temperature_conversion',
      tierParams: {
        '1':  { rangeA: [32, 212], rangeB: [0, 100], steps: 1 },
        '2a': { rangeA: [32, 212], rangeB: [0, 100], steps: 2 },
        '2b': { rangeA: [32, 212], rangeB: [0, 100], steps: 3 },
        '3':  { rangeA: [32, 212], rangeB: [0, 100], steps: 4 },
      },
    },
    {
      id: 'area_volume_conversion',
      name: 'Area & Volume Conversion',
      description: 'Convert area (cm², m², ft²) and volume (mL, L, cm³, m³, gallons) units.',
      generatorId: 'area_volume_conversion',
      tierParams: {
        '1':  { rangeA: [1, 10000], rangeB: [1, 1000], steps: 1 },
        '2a': { rangeA: [1, 1000],  rangeB: [1, 1000], steps: 2 },
        '2b': { rangeA: [1, 100],   rangeB: [1, 100],  steps: 3 },
        '3':  { rangeA: [1, 10],    rangeB: [1, 10],   steps: 4 },
      },
    },
    {
      id: 'speed_conversion',
      name: 'Speed Conversion',
      description: 'Convert between speed units: m/s, km/h, mph, and knots.',
      generatorId: 'speed_conversion',
      tierParams: {
        '1':  { rangeA: [1, 30],  rangeB: [1, 30],  steps: 1 },
        '2a': { rangeA: [1, 100], rangeB: [1, 100], steps: 2 },
        '2b': { rangeA: [1, 100], rangeB: [1, 100], steps: 3 },
        '3':  { rangeA: [1, 20],  rangeB: [1, 20],  steps: 4 },
      },
    },
  ],
  subDecks: [
    { id: 'length',      name: 'Length Conversion',         skillIds: ['length_conversion'] },
    { id: 'weight',      name: 'Weight & Mass Conversion',  skillIds: ['weight_conversion'] },
    { id: 'temperature', name: 'Temperature Conversion',    skillIds: ['temperature_conversion'] },
    { id: 'area_volume', name: 'Area & Volume Conversion',  skillIds: ['area_volume_conversion'] },
    { id: 'speed',       name: 'Speed Conversion',          skillIds: ['speed_conversion'] },
  ],
};
