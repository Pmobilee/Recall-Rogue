import { describe, it, expect } from 'vitest';
import { KEYWORD_DEFINITIONS, getKeywordDefinition } from './keywords';

/**
 * Unit tests for KEYWORD_DEFINITIONS — Issue 13 completeness.
 *
 * Verifies all 8 status effect IDs have valid entries with the
 * user-approved display names from the Issue 13 study-theme rename.
 */

/** All 8 core status effect IDs that must have keyword entries. */
const STATUS_EFFECT_IDS = [
  'poison',
  'weakness',
  'vulnerable',
  'strength',
  'regen',
  'immunity',
  'burn',
  'bleed',
] as const;

/** User-approved display name map (Issue 13). */
const EXPECTED_NAMES: Record<string, string> = {
  poison:    'Doubt',
  weakness:  'Drawing Blanks',
  vulnerable: 'Exposed',
  strength:  'Clarity',
  regen:     'Recall',
  immunity:  'Shielded Mind',
  burn:      'Brain Burn',
  bleed:     'Lingering Doubt',
};

describe('KEYWORD_DEFINITIONS — status effect completeness (Issue 13)', () => {
  it('has an entry for every status effect ID', () => {
    for (const id of STATUS_EFFECT_IDS) {
      expect(
        KEYWORD_DEFINITIONS[id],
        `Missing keyword entry for status effect '${id}'`,
      ).toBeDefined();
    }
  });

  it('each status effect entry has a non-empty name', () => {
    for (const id of STATUS_EFFECT_IDS) {
      const entry = KEYWORD_DEFINITIONS[id];
      expect(entry?.name, `Empty name for '${id}'`).toBeTruthy();
    }
  });

  it('each status effect entry has a non-empty description', () => {
    for (const id of STATUS_EFFECT_IDS) {
      const entry = KEYWORD_DEFINITIONS[id];
      expect(entry?.description, `Empty description for '${id}'`).toBeTruthy();
    }
  });

  it('display names match the Issue 13 user-approved rename map', () => {
    for (const [id, expectedName] of Object.entries(EXPECTED_NAMES)) {
      const entry = KEYWORD_DEFINITIONS[id];
      expect(
        entry?.name,
        `'${id}' should be named '${expectedName}', got '${entry?.name}'`,
      ).toBe(expectedName);
    }
  });

  it('getKeywordDefinition resolves all 8 status effect IDs without returning undefined', () => {
    for (const id of STATUS_EFFECT_IDS) {
      const result = getKeywordDefinition(id);
      expect(result, `getKeywordDefinition('${id}') returned undefined`).toBeDefined();
    }
  });

  it('description lengths are under 80 chars (tooltip-safe)', () => {
    for (const id of STATUS_EFFECT_IDS) {
      const desc = KEYWORD_DEFINITIONS[id]?.description ?? '';
      expect(
        desc.length,
        `Description for '${id}' exceeds 80 chars: "${desc}"`,
      ).toBeLessThanOrEqual(80);
    }
  });
});
