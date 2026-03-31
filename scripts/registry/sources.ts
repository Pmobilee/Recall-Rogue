/**
 * Source mapping config — defines which TypeScript source files map to which registry tables.
 * Used by sync.ts to auto-generate the inspection registry from live source code.
 */

export interface SourceMapping {
  table: string;
  sourceFile: string;
  exportName: string;
  mode: 'array' | 'record' | 'type_union';
  idField?: string;       // default 'id'
  nameField?: string;     // default 'name'
  categoryField?: string;
  descriptionField?: string;
  riskTier: 1 | 2 | 3;
}

export const SOURCE_MAPPINGS: SourceMapping[] = [
  // Tier 1 — high risk, test first
  {
    table: 'cards',
    sourceFile: 'src/data/mechanics.ts',
    exportName: 'MECHANIC_DEFINITIONS',
    mode: 'array',
    idField: 'id', nameField: 'name', categoryField: 'type', descriptionField: 'description',
    riskTier: 1,
  },
  {
    table: 'enemies',
    sourceFile: 'src/data/enemies.ts',
    exportName: 'ENEMY_TEMPLATES',
    mode: 'array',
    idField: 'id', nameField: 'name', categoryField: 'category', descriptionField: 'region',
    riskTier: 1,
  },
  {
    table: 'relics',
    sourceFile: 'src/data/relics/index.ts',
    exportName: 'FULL_RELIC_CATALOGUE',
    mode: 'array',
    idField: 'id', nameField: 'name', categoryField: 'rarity', descriptionField: 'description',
    riskTier: 1,
  },
  {
    table: 'statusEffects',
    sourceFile: 'src/data/statusEffects.ts',
    exportName: 'StatusEffectType',
    mode: 'type_union',
    riskTier: 1,
  },
  // Tier 2 — medium risk
  {
    table: 'screens',
    sourceFile: 'src/ui/stores/gameState.ts',
    exportName: 'Screen',
    mode: 'type_union',
    riskTier: 2,
  },
  {
    table: 'domains',
    sourceFile: 'src/data/domainMetadata.ts',
    exportName: 'DOMAIN_METADATA',
    mode: 'record',
    nameField: 'displayName', descriptionField: 'description',
    riskTier: 2,
  },
  {
    table: 'specialEvents',
    sourceFile: 'src/data/specialEvents.ts',
    exportName: 'SPECIAL_EVENTS',
    mode: 'array',
    idField: 'id', nameField: 'name', categoryField: 'type', descriptionField: 'description',
    riskTier: 2,
  },
  {
    table: 'mysteryEffects',
    sourceFile: 'src/data/specialEvents.ts',
    exportName: 'MYSTERY_EFFECTS',
    mode: 'array',
    idField: 'id', nameField: 'label', categoryField: 'type', descriptionField: 'type',
    riskTier: 2,
  },
  {
    table: 'chainTypes',
    sourceFile: 'src/data/chainTypes.ts',
    exportName: 'CHAIN_TYPES',
    mode: 'array',
    idField: 'index', nameField: 'name', categoryField: 'name', descriptionField: 'hexColor',
    riskTier: 2,
  },
  // Tier 3 — low risk
  {
    table: 'ascensionLevels',
    sourceFile: 'src/services/ascension.ts',
    exportName: 'ASCENSION_LEVEL_RULES',
    mode: 'array',
    idField: 'level', nameField: 'name', descriptionField: 'effect',
    riskTier: 3,
  },
  {
    table: 'keywords',
    sourceFile: 'src/data/keywords.ts',
    exportName: 'KEYWORD_DEFINITIONS',
    mode: 'record',
    nameField: 'name', descriptionField: 'description',
    riskTier: 3,
  },
  {
    table: 'synergies',
    sourceFile: 'src/data/synergies.ts',
    exportName: 'MECHANIC_SYNERGIES',
    mode: 'record',
    riskTier: 3,
  },
  {
    table: 'roomThemes',
    sourceFile: 'src/data/roomAtmosphere.ts',
    exportName: 'ATMOSPHERE_PRESETS',
    mode: 'record',
    riskTier: 3,
  },
  {
    table: 'cardTypes',
    sourceFile: 'src/data/card-types.ts',
    exportName: 'CardType',
    mode: 'type_union',
    riskTier: 3,
  },
];
