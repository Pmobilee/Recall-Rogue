/**
 * Statistics & Probability procedural deck definition.
 *
 * Covers mean/median/mode, standard deviation, basic probability
 * (coins, dice, cards), combinations and permutations, and expected value.
 * Each skill uses a generator from
 * `src/services/math/statisticsGenerators.ts` and scales difficulty
 * across the four FSRS card tiers (1, 2a, 2b, 3).
 *
 * Source files: src/data/mathDecks/statistics.ts
 * Related docs: docs/mechanics/procedural-math.md
 */

import type { ProceduralDeck } from '../proceduralDeckTypes';

export const STATISTICS_DECK: ProceduralDeck = {
  id: 'statistics',
  name: 'Statistics & Probability',
  domain: 'mathematics',
  description: 'Master mean, median, mode, standard deviation, probability, and expected value.',
  skills: [
    {
      id: 'stat_central',
      name: 'Mean, Median, Mode',
      description: 'Calculate measures of central tendency for data sets.',
      generatorId: 'central_tendency',
      tierParams: {
        '1':  { rangeA: [1, 10],  rangeB: [5, 5],  dataSetSize: 5,  dataMax: 10 },
        '2a': { rangeA: [1, 20],  rangeB: [7, 7],  dataSetSize: 7,  dataMax: 20 },
        '2b': { rangeA: [1, 50],  rangeB: [7, 7],  dataSetSize: 7,  dataMax: 50 },
        '3':  { rangeA: [1, 100], rangeB: [9, 9],  dataSetSize: 9,  dataMax: 100 },
      },
    },
    {
      id: 'stat_stddev',
      name: 'Standard Deviation',
      description: 'Calculate the population standard deviation of a data set.',
      generatorId: 'standard_deviation',
      tierParams: {
        '1':  { rangeA: [1, 10],  rangeB: [4, 4],  dataSetSize: 4,  dataMax: 10 },
        '2a': { rangeA: [1, 20],  rangeB: [5, 5],  dataSetSize: 5,  dataMax: 20 },
        '2b': { rangeA: [1, 30],  rangeB: [6, 6],  dataSetSize: 6,  dataMax: 30 },
        '3':  { rangeA: [1, 50],  rangeB: [8, 8],  dataSetSize: 8,  dataMax: 50 },
      },
    },
    {
      id: 'stat_prob',
      name: 'Basic Probability',
      description: 'Calculate probabilities for dice, cards, and coin events.',
      generatorId: 'basic_probability',
      tierParams: {
        '1':  { rangeA: [1, 6],  rangeB: [1, 6],   probabilityContext: ['coin', 'dice'] },
        '2a': { rangeA: [1, 6],  rangeB: [1, 12],  probabilityContext: ['coin', 'dice'] },
        '2b': { rangeA: [1, 52], rangeB: [1, 52],  probabilityContext: ['coin', 'dice', 'cards'] },
        '3':  { rangeA: [1, 52], rangeB: [1, 52],  probabilityContext: ['dice', 'cards'] },
      },
    },
    {
      id: 'stat_combperm',
      name: 'Combinations & Permutations',
      description: 'Calculate nCr and nPr for counting problems.',
      generatorId: 'combinations_permutations',
      tierParams: {
        '1':  { rangeA: [3, 6],   rangeB: [1, 3] },
        '2a': { rangeA: [5, 8],   rangeB: [2, 4] },
        '2b': { rangeA: [6, 10],  rangeB: [2, 5] },
        '3':  { rangeA: [8, 12],  rangeB: [3, 6] },
      },
    },
    {
      id: 'stat_expected',
      name: 'Expected Value',
      description: 'Calculate the expected value of probability distributions.',
      generatorId: 'expected_value',
      tierParams: {
        '1':  { rangeA: [2, 4],   rangeB: [1, 10],  dataSetSize: 3 },
        '2a': { rangeA: [3, 5],   rangeB: [1, 20],  dataSetSize: 4 },
        '2b': { rangeA: [4, 6],   rangeB: [1, 50],  dataSetSize: 5 },
        '3':  { rangeA: [5, 8],   rangeB: [1, 100], dataSetSize: 6 },
      },
    },
  ],
  subDecks: [
    { id: 'central_tendency', name: 'Mean, Median, Mode',          skillIds: ['stat_central'] },
    { id: 'std_deviation',    name: 'Standard Deviation',          skillIds: ['stat_stddev'] },
    { id: 'probability',      name: 'Basic Probability',           skillIds: ['stat_prob'] },
    { id: 'counting',         name: 'Combinations & Permutations', skillIds: ['stat_combperm'] },
    { id: 'expected_value',   name: 'Expected Value',              skillIds: ['stat_expected'] },
  ],
};
