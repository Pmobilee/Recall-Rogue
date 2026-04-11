/**
 * Registry sync — auto-generates data/inspection-registry.json from source code.
 *
 * Usage:
 *   npx tsx scripts/registry/sync.ts
 *
 * Version 5 adds:
 *   - decks table via json_glob source mode (reads data/decks/*.json, skips _wip/)
 *   - Deck-specific audit date fields: lastStructuralVerify, lastQuizAudit, lastLLMPlaytest, lastTriviaBridge
 *   - inProgress lock field for parallel-agent coordination
 *   - Non-deck JSON files (e.g. manifest.json) skipped by structural check
 *   - Test-only stub decks (test_*.json) skipped by filename prefix
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { SOURCE_MAPPINGS, type SourceMapping } from './sources.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConfidenceLevel = 'clean' | 'confirmed' | 'likely' | 'possible' | 'not_checked';

interface InProgressLock {
  agentId: string;
  batchId?: string;
  testType: string;
  startedAt: string;
  expectedCompleteBy?: string;
}

interface RegistryElement {
  id: string;
  name: string;
  category: string;
  description: string;
  sourceFile: string;
  status: 'active' | 'deprecated';
  mechanicDate: string;
  visualDate: string;
  uxDate: string;
  balanceDate: string;
  strategyDate: string;
  neuralDate: string;
  playtestDate: string;
  // Deck-specific audit date fields (only populated for 'decks' table)
  lastStructuralVerify?: string;
  lastQuizAudit?: string;
  lastLLMPlaytest?: string;
  lastTriviaBridge?: string;
  // Parallel-agent coordination lock (null = free)
  inProgress?: InProgressLock | null;
  lastInspected: string;
  confidenceLevel: ConfidenceLevel;
  notes: string;
}

interface Registry {
  version: number;
  lastSynced: string;
  tables: Record<string, RegistryElement[]>;
}

// ─── Old registry migration ───────────────────────────────────────────────────

const OLD_TABLES_TO_DROP = new Set([
  'testingRecommendations',
  'domainTestMatrix',
  'quizSystems',
  'systems',
  'relicTriggers',
  'enemyIntents',
  'masteryLevels',
  'rewardTypes',
  'questionFormats',
  'animationArchetypes',
  'rooms',
]);

const OLD_TABLE_RENAMES: Record<string, string> = {
  cardSynergies: 'synergies',
  cardKeywords: 'keywords',
  mysteryEvents: 'mysteryEffects',
};

function mostRecent(dates: string[]): string {
  const valid = dates.filter((d) => d && d !== 'not_checked').sort();
  return valid.length > 0 ? valid[valid.length - 1] : 'not_checked';
}

function migrateOldElement(old: Record<string, unknown>): RegistryElement {
  const visualDate = mostRecent([
    String(old['visualInspectionDate_portraitMobile'] ?? 'not_checked'),
    String(old['visualInspectionDate_landscapeMobile'] ?? 'not_checked'),
    String(old['visualInspectionDate_landscapePC'] ?? 'not_checked'),
    String(old['visualDate'] ?? 'not_checked'),
  ]);

  const el: RegistryElement = {
    id: String(old['id'] ?? ''),
    name: String(old['name'] ?? ''),
    category: String(old['category'] ?? ''),
    description: String(old['description'] ?? ''),
    sourceFile: String(old['sourceFile'] ?? ''),
    status: (old['status'] === 'deprecated' ? 'deprecated' : 'active'),
    mechanicDate: String(old['mechanicInspectionDate'] ?? old['mechanicDate'] ?? 'not_checked'),
    visualDate,
    uxDate: String(old['uxReviewDate'] ?? old['uxDate'] ?? 'not_checked'),
    balanceDate: String(old['balanceCheckDate'] ?? old['balanceDate'] ?? 'not_checked'),
    strategyDate: String(old['strategicAnalysisDate'] ?? old['strategyDate'] ?? 'not_checked'),
    neuralDate: String(old['neuralAgentDate'] ?? old['neuralDate'] ?? 'not_checked'),
    playtestDate: String(old['llmPlaytestDate'] ?? old['playtestDate'] ?? 'not_checked'),
    lastStructuralVerify: String(old['lastStructuralVerify'] ?? 'not_checked'),
    lastQuizAudit: String(old['lastQuizAudit'] ?? 'not_checked'),
    lastLLMPlaytest: String(old['lastLLMPlaytest'] ?? 'not_checked'),
    lastTriviaBridge: String(old['lastTriviaBridge'] ?? 'not_checked'),
    inProgress: (old['inProgress'] as InProgressLock | null | undefined) ?? null,
    lastInspected: String(old['lastInspectedDate'] ?? old['lastInspected'] ?? 'not_checked'),
    confidenceLevel: (old['confidenceLevel'] as ConfidenceLevel) ?? 'not_checked',
    notes: String(old['notes'] ?? ''),
  };

  el.confidenceLevel = computeConfidence(el);
  el.lastInspected = computeLastInspected(el);
  return el;
}

// ─── Confidence / date helpers ────────────────────────────────────────────────

/** Core date fields used for confidence scoring (all tables). */
const DATE_FIELDS: (keyof RegistryElement)[] = [
  'mechanicDate', 'visualDate', 'uxDate', 'balanceDate', 'strategyDate', 'neuralDate', 'playtestDate',
];

/** Deck-specific audit date fields. */
export const DECK_DATE_FIELDS: (keyof RegistryElement)[] = [
  'lastStructuralVerify', 'lastQuizAudit', 'lastLLMPlaytest', 'lastTriviaBridge',
];

/** All valid date-stampable fields (exported for updater.ts). */
export const ALL_DATE_FIELDS: (keyof RegistryElement)[] = [
  ...DATE_FIELDS,
  ...DECK_DATE_FIELDS,
];

function computeLastInspected(el: RegistryElement): string {
  const allDates = [
    ...DATE_FIELDS.map((f) => el[f] as string),
    ...DECK_DATE_FIELDS.map((f) => (el[f] as string | undefined) ?? 'not_checked'),
  ];
  return mostRecent(allDates);
}

function computeConfidence(el: RegistryElement): ConfidenceLevel {
  const filled = DATE_FIELDS.filter((f) => {
    const v = el[f] as string;
    return v && v !== 'not_checked';
  }).length;
  if (filled === 0) return 'not_checked';
  if (filled === 1) return 'possible';
  if (filled === 2) return 'likely';
  if (filled < DATE_FIELDS.length) return 'confirmed';
  return 'clean';
}

function blankElement(
  id: string, name: string, category: string, description: string,
  sourceFile: string, isDeck = false
): RegistryElement {
  const el: RegistryElement = {
    id, name, category, description, sourceFile,
    status: 'active',
    mechanicDate: 'not_checked', visualDate: 'not_checked', uxDate: 'not_checked',
    balanceDate: 'not_checked', strategyDate: 'not_checked', neuralDate: 'not_checked',
    playtestDate: 'not_checked',
    lastInspected: 'not_checked', confidenceLevel: 'not_checked', notes: '',
    inProgress: null,
  };
  if (isDeck) {
    el.lastStructuralVerify = 'not_checked';
    el.lastQuizAudit = 'not_checked';
    el.lastLLMPlaytest = 'not_checked';
    el.lastTriviaBridge = 'not_checked';
  }
  return el;
}

// ─── Type union extraction ─────────────────────────────────────────────────────

function extractTypeUnion(filePath: string, exportName: string): string[] {
  const text = fs.readFileSync(filePath, 'utf-8');
  const pattern = new RegExp(
    `export\\s+type\\s+${exportName}\\s*=\\s*([\\s\\S]*?)(?=\\n\\n|\\n\\/\\*|\\nexport|$)`,
  );
  const match = text.match(pattern);
  if (!match) {
    console.warn(`  [warn] Could not find 'export type ${exportName}' in ${filePath}`);
    return [];
  }
  const body = match[1];
  const members: string[] = [];
  const literalRe = /'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = literalRe.exec(body)) !== null) {
    members.push(m[1]);
  }
  return members;
}

// ─── Source extraction ────────────────────────────────────────────────────────

interface ExtractedElement {
  id: string;
  name: string;
  category: string;
  description: string;
  sourceFile?: string;
}

async function extractFromMapping(mapping: SourceMapping): Promise<ExtractedElement[]> {
  // ── json_glob mode ──────────────────────────────────────────────────────────
  if (mapping.mode === 'json_glob') {
    const repoRoot = process.cwd();
    const files = await glob(mapping.sourceFile, { cwd: repoRoot, absolute: true });
    const elements: ExtractedElement[] = [];

    for (const filePath of files.sort()) {
      // Skip files inside _wip subdirectory
      if (filePath.includes('/_wip/') || filePath.includes('\\_wip\\')) continue;

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (err) {
        console.warn(`  [warn] Failed to parse ${filePath}: ${(err as Error).message}`);
        continue;
      }

      // Skip non-deck JSON files (e.g. manifest.json) — structural check: no 'id' field + has 'decks' array
      if (!('id' in data) && Array.isArray(data['decks'])) {
        console.log(`  [skip] ${path.basename(filePath)} — not a deck file (has 'decks' array, no 'id')`);
        continue;
      }

      // Skip test-only stub decks (e.g. test_world_capitals.json) — not production content
      if (path.basename(filePath).startsWith('test_')) {
        console.log(`  [skip] ${path.basename(filePath)} — test stub deck`);
        continue;
      }

      const stem = path.basename(filePath, '.json');
      const id = String(data['id'] ?? stem);
      const name = String(data['name'] ?? id);
      const domain = data['domain'] ?? data['deckType'] ?? null;
      const subDomain = data['subDomain'] ?? null;
      const category = domain ? (subDomain ? `${domain}/${subDomain}` : String(domain)) : 'knowledge';
      const description = String(data['description'] ?? '').slice(0, 200);
      const relPath = path.relative(repoRoot, filePath);

      elements.push({ id, name, category, description, sourceFile: relPath });
    }

    return elements;
  }

  // ── Standard modes ──────────────────────────────────────────────────────────
  const absPath = path.resolve(process.cwd(), mapping.sourceFile);

  if (!fs.existsSync(absPath)) {
    console.warn(`  [warn] Source file not found: ${mapping.sourceFile} — skipping table '${mapping.table}'`);
    return [];
  }

  const idField = mapping.idField ?? 'id';
  const nameField = mapping.nameField ?? 'name';
  const categoryField = mapping.categoryField ?? '';
  const descriptionField = mapping.descriptionField ?? '';

  if (mapping.mode === 'type_union') {
    const members = extractTypeUnion(absPath, mapping.exportName);
    return members.map((val) => ({ id: val, name: val, category: mapping.table, description: '' }));
  }

  let mod: Record<string, unknown>;
  try {
    mod = await import(absPath);
  } catch (err) {
    console.warn(`  [warn] Failed to import ${mapping.sourceFile} (${(err as Error).message})`);
    console.warn(`         Falling back to type_union regex for table '${mapping.table}'`);
    const members = extractTypeUnion(absPath, mapping.exportName);
    return members.map((val) => ({ id: val, name: val, category: mapping.table, description: '' }));
  }

  const exported = mod[mapping.exportName];
  if (exported === undefined) {
    console.warn(`  [warn] Export '${mapping.exportName}' not found in ${mapping.sourceFile}`);
    return [];
  }

  if (mapping.mode === 'array') {
    if (!Array.isArray(exported)) {
      console.warn(`  [warn] '${mapping.exportName}' is not an array in ${mapping.sourceFile}`);
      return [];
    }
    return (exported as Record<string, unknown>[]).map((item) => {
      const id = String(item[idField] ?? '');
      const name = String(item[nameField] ?? item['id'] ?? id);
      const category = categoryField ? String(item[categoryField] ?? '') : '';
      const description = descriptionField ? String(item[descriptionField] ?? '') : '';
      return { id, name, category, description };
    }).filter((e) => e.id !== '');
  }

  if (mapping.mode === 'record') {
    const rec = exported as Record<string, unknown>;
    return Object.entries(rec).map(([key, val]) => {
      const obj = (val && typeof val === 'object' ? val : {}) as Record<string, unknown>;
      const name = nameField && obj[nameField] ? String(obj[nameField]) : key;
      const category = categoryField && obj[categoryField] ? String(obj[categoryField]) : '';
      let description = '';
      if (descriptionField && obj[descriptionField]) {
        const raw = obj[descriptionField];
        description = Array.isArray(raw) ? (raw as string[]).join(', ') : String(raw);
      } else if (Array.isArray(val)) {
        description = (val as string[]).join(', ');
      }
      return { id: key, name, category, description };
    });
  }

  return [];
}

// ─── Load & migrate old registry ─────────────────────────────────────────────

function loadOldRegistry(registryPath: string): Map<string, Map<string, RegistryElement>> {
  const result = new Map<string, Map<string, RegistryElement>>();
  if (!fs.existsSync(registryPath)) return result;

  const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const tables = raw.tables ?? {};

  for (const [rawTableName, items] of Object.entries(tables)) {
    if (OLD_TABLES_TO_DROP.has(rawTableName)) continue;
    const tableName = OLD_TABLE_RENAMES[rawTableName] ?? rawTableName;
    if (!Array.isArray(items)) continue;

    const map = new Map<string, RegistryElement>();
    for (const item of items as Record<string, unknown>[]) {
      const el = migrateOldElement(item);
      if (el.id) map.set(el.id, el);
    }
    result.set(tableName, map);
  }

  return result;
}

function writeAtomic(filePath: string, content: string): void {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const registryPath = path.resolve(process.cwd(), 'data/inspection-registry.json');
  const today = new Date().toISOString().slice(0, 10);

  console.log('Loading existing registry...');
  const oldRegistry = loadOldRegistry(registryPath);

  const stats: Record<string, { total: number; newCount: number; deprecated: number }> = {};
  const newTables: Record<string, RegistryElement[]> = {};

  for (const mapping of SOURCE_MAPPINGS) {
    process.stdout.write(`  Extracting ${mapping.table} from ${mapping.sourceFile}... `);
    const extracted = await extractFromMapping(mapping);
    console.log(`${extracted.length} elements`);

    const oldTableMap = oldRegistry.get(mapping.table) ?? new Map<string, RegistryElement>();
    const seenIds = new Set<string>();
    const elements: RegistryElement[] = [];
    let newCount = 0;
    const isDeckTable = mapping.table === 'decks';

    for (const ex of extracted) {
      seenIds.add(ex.id);
      const existing = oldTableMap.get(ex.id);
      const elementSourceFile = ex.sourceFile ?? mapping.sourceFile;

      if (existing) {
        const merged: RegistryElement = {
          ...existing,
          name: ex.name || existing.name,
          category: ex.category || existing.category,
          description: ex.description || existing.description,
          sourceFile: elementSourceFile,
          status: 'active',
        };
        if (isDeckTable) {
          if (!merged.lastStructuralVerify) merged.lastStructuralVerify = 'not_checked';
          if (!merged.lastQuizAudit) merged.lastQuizAudit = 'not_checked';
          if (!merged.lastLLMPlaytest) merged.lastLLMPlaytest = 'not_checked';
          if (!merged.lastTriviaBridge) merged.lastTriviaBridge = 'not_checked';
          if (merged.inProgress === undefined) merged.inProgress = null;
        }
        merged.lastInspected = computeLastInspected(merged);
        merged.confidenceLevel = computeConfidence(merged);
        elements.push(merged);
      } else {
        elements.push(blankElement(ex.id, ex.name, ex.category, ex.description, elementSourceFile, isDeckTable));
        newCount++;
      }
    }

    let deprecatedCount = 0;
    for (const [oldId, oldEl] of oldTableMap.entries()) {
      if (!seenIds.has(oldId)) {
        elements.push({ ...oldEl, status: 'deprecated', sourceFile: oldEl.sourceFile || mapping.sourceFile });
        deprecatedCount++;
      }
    }

    newTables[mapping.table] = elements;
    stats[mapping.table] = {
      total: elements.filter((e) => e.status === 'active').length,
      newCount,
      deprecated: deprecatedCount,
    };
  }

  const registry: Registry = {
    version: 5,
    lastSynced: today,
    tables: newTables,
  };

  writeAtomic(registryPath, JSON.stringify(registry, null, 2));

  console.log('\nRegistry sync complete:');
  let totalActive = 0;
  let totalDeprecated = 0;
  for (const [table, s] of Object.entries(stats)) {
    const parts = [];
    if (s.newCount > 0) parts.push(`${s.newCount} new`);
    if (s.deprecated > 0) parts.push(`${s.deprecated} deprecated`);
    const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    console.log(`  ${table}: ${s.total} active${suffix}`);
    totalActive += s.total;
    totalDeprecated += Object.values(newTables[table]).filter((e) => e.status === 'deprecated').length;
  }
  console.log(`\n  Total: ${totalActive} active, ${totalDeprecated} deprecated`);
  console.log(`  Written to ${registryPath}`);
}

main().catch((err) => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
