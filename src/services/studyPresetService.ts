import { get } from 'svelte/store';
import { playerSave, persistPlayer } from '../ui/stores/playerData';
import { factsDB } from './factsDB';
import { resolveDomain } from './domainResolver';
import type { StudyPreset } from '../data/studyPreset';
import type { Fact } from '../data/types';
import { MAX_PRESETS, MAX_PRESET_NAME_LENGTH, MIN_FAIR_POOL_SIZE } from '../data/balance';

/**
 * Maps canonical domain IDs to the top-level category strings used in the facts DB.
 * A single domain may match multiple legacy category names.
 */
const DOMAIN_TO_CATEGORY: Record<string, string[]> = {
  general_knowledge: ['General Knowledge', 'Technology', 'Mathematics', 'Math'],
  natural_sciences: ['Natural Sciences', 'Science'],
  space_astronomy: ['Space & Astronomy'],
  history: ['History'],
  geography: ['Geography'],
  language: ['Language'],
  mythology_folklore: ['Mythology & Folklore'],
  animals_wildlife: ['Animals & Wildlife'],
  human_body_health: ['Human Body & Health', 'Life Sciences', 'Medicine', 'Health'],
  food_cuisine: ['Food & World Cuisine'],
  art_architecture: ['Art & Architecture', 'Culture', 'Arts'],
};

/**
 * Generates a short random ID for a new preset.
 * Uses Math.random for simplicity (no cryptographic requirement).
 */
function generatePresetId(): string {
  return 'preset_' + Math.random().toString(36).slice(2, 10);
}

/**
 * Extracts the subcategory from a fact's category hierarchy.
 * Uses the second element of category array, falling back to categoryL2, then 'General'.
 */
function getFactSubcategory(fact: Fact): string {
  const second = fact.category[1]?.trim();
  if (second) return second;
  const l2 = (fact as Fact & { categoryL2?: string }).categoryL2?.trim();
  if (l2) return l2;
  return 'General';
}

/**
 * Returns all saved study presets from the player save.
 */
export function getPresets(): StudyPreset[] {
  const save = get(playerSave);
  if (!save) return [];
  return save.studyPresets ?? [];
}

/**
 * Returns a preset by its ID, or null if not found.
 */
export function getPresetById(id: string): StudyPreset | null {
  const presets = getPresets();
  return presets.find(p => p.id === id) ?? null;
}

/**
 * Creates a new study preset and persists it to the player save.
 * Enforces MAX_PRESETS limit and MAX_PRESET_NAME_LENGTH.
 *
 * @param name - User-chosen preset name (trimmed, max 30 chars).
 * @param domainSelections - Map of domain ID to selected subcategory names.
 *   Empty array for a domain means "all subcategories".
 * @returns The newly created StudyPreset.
 * @throws Error if the preset limit is reached or name is empty.
 */
export function createPreset(
  name: string,
  domainSelections: Record<string, string[]>
): StudyPreset {
  const trimmedName = name.trim().slice(0, MAX_PRESET_NAME_LENGTH);
  if (trimmedName.length === 0) {
    throw new Error('Preset name cannot be empty');
  }

  const currentPresets = getPresets();
  if (currentPresets.length >= MAX_PRESETS) {
    throw new Error(`Cannot create more than ${MAX_PRESETS} presets`);
  }

  const now = Date.now();
  const preset: StudyPreset = {
    id: generatePresetId(),
    name: trimmedName,
    createdAt: now,
    updatedAt: now,
    domainSelections,
    cachedFactCount: getPresetFactCount(domainSelections),
  };

  playerSave.update(s => {
    if (!s) return s;
    s.studyPresets = [...(s.studyPresets ?? []), preset];
    return s;
  });
  persistPlayer();

  return preset;
}

/**
 * Updates an existing preset with partial changes (name and/or domainSelections).
 * Recalculates the cached fact count if domainSelections changed.
 *
 * @param id - The preset ID to update.
 * @param changes - Partial fields to update.
 * @returns The updated StudyPreset.
 * @throws Error if the preset is not found.
 */
export function updatePreset(
  id: string,
  changes: Partial<Pick<StudyPreset, 'name' | 'domainSelections'>>
): StudyPreset {
  const presets = getPresets();
  const index = presets.findIndex(p => p.id === id);
  if (index === -1) {
    throw new Error(`Preset not found: ${id}`);
  }

  const existing = presets[index]!;
  const updatedName = changes.name !== undefined
    ? changes.name.trim().slice(0, MAX_PRESET_NAME_LENGTH)
    : existing.name;

  if (updatedName.length === 0) {
    throw new Error('Preset name cannot be empty');
  }

  const updatedSelections = changes.domainSelections ?? existing.domainSelections;

  const updated: StudyPreset = {
    ...existing,
    name: updatedName,
    domainSelections: updatedSelections,
    updatedAt: Date.now(),
    cachedFactCount: changes.domainSelections
      ? getPresetFactCount(updatedSelections)
      : existing.cachedFactCount,
  };

  playerSave.update(s => {
    if (!s) return s;
    const list = [...(s.studyPresets ?? [])];
    list[index] = updated;
    s.studyPresets = list;
    return s;
  });
  persistPlayer();

  return updated;
}

/**
 * Deletes a preset by ID.
 * No-op if the preset does not exist.
 */
export function deletePreset(id: string): void {
  playerSave.update(s => {
    if (!s) return s;
    s.studyPresets = (s.studyPresets ?? []).filter(p => p.id !== id);
    return s;
  });
  persistPlayer();
}

/**
 * Counts how many facts in the DB match the given domain/subcategory selections.
 *
 * @param domainSelections - Map of domain ID to subcategory names.
 *   An empty array for a domain means "all subcategories in that domain".
 * @returns Total matching fact count.
 */
export function getPresetFactCount(domainSelections: Record<string, string[]>): number {
  if (!factsDB.isReady()) return 0;

  const domainIds = Object.keys(domainSelections);
  if (domainIds.length === 0) return 0;

  // Build a set of allowed (domain, subcategory?) pairs for efficient filtering
  const allowAllSubcats = new Set<string>();
  const allowedSubcats = new Map<string, Set<string>>();

  for (const domainId of domainIds) {
    const subs = domainSelections[domainId]!;
    if (subs.length === 0) {
      allowAllSubcats.add(domainId);
    } else {
      allowedSubcats.set(domainId, new Set(subs));
    }
  }

  let count = 0;
  for (const fact of factsDB.getAll()) {
    const domain = resolveDomain(fact);
    if (allowAllSubcats.has(domain)) {
      count++;
    } else {
      const subs = allowedSubcats.get(domain);
      if (subs && subs.has(getFactSubcategory(fact))) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Validates whether a set of domain selections form a fair run pool.
 * Returns the fact count, fairness flag, and an optional warning message.
 *
 * @param domainSelections - Map of domain ID to subcategory names.
 * @returns Validation result with factCount, isFair flag, and warning string or null.
 */
export function validatePresetPool(domainSelections: Record<string, string[]>): {
  factCount: number;
  isFair: boolean;
  warning: string | null;
} {
  const factCount = getPresetFactCount(domainSelections);
  const isFair = factCount >= MIN_FAIR_POOL_SIZE;
  let warning: string | null = null;

  if (!isFair) {
    warning = `Only ${factCount} facts selected (minimum ${MIN_FAIR_POOL_SIZE} for ranked play). Add more topics for leaderboard eligibility.`;
  }

  return { factCount, isFair, warning };
}
