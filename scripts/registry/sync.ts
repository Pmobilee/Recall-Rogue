/**
 * Registry sync — auto-generates data/inspection-registry.json from source code.
 *
 * Usage:
 *   npx tsx scripts/registry/sync.ts
 *
 * Algorithm:
 *   1. Import each source file and extract game elements
 *   2. Load existing registry (if any) and migrate old field names
 *   3. Merge: preserve existing inspection dates; mark missing elements deprecated
 *   4. Write updated registry with version bump
 */

import fs from 'fs';
import path from 'path';
import { SOURCE_MAPPINGS, type SourceMapping } from './sources.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConfidenceLevel = 'clean' | 'confirmed' | 'likely' | 'possible' | 'not_checked';

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

// Tables that existed in the old registry but are NOT in SOURCE_MAPPINGS —
// they were manually curated (rooms, systems, quiz-related, etc.) and should
// be dropped during migration rather than carried forward as empty shells.
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

// Tables in old registry that ARE kept but may have name mismatches
const OLD_TABLE_RENAMES: Record<string, string> = {
  cardSynergies: 'synergies',
  cardKeywords: 'keywords',
  mysteryEvents: 'mysteryEffects',
};

/** Pick the most recent non-"not_checked" date from a list. */
function mostRecent(dates: string[]): string {
  const valid = dates.filter((d) => d && d !== 'not_checked').sort();
  return valid.length > 0 ? valid[valid.length - 1] : 'not_checked';
}

/** Map an old registry element to the new RegistryElement schema. */
function migrateOldElement(old: Record<string, string>): RegistryElement {
  const visualDate = mostRecent([
    old['visualInspectionDate_portraitMobile'] ?? 'not_checked',
    old['visualInspectionDate_landscapeMobile'] ?? 'not_checked',
    old['visualInspectionDate_landscapePC'] ?? 'not_checked',
    old['visualDate'] ?? 'not_checked',
  ]);

  const el: RegistryElement = {
    id: old['id'] ?? '',
    name: old['name'] ?? '',
    category: old['category'] ?? '',
    description: old['description'] ?? '',
    sourceFile: old['sourceFile'] ?? '',
    status: (old['status'] === 'deprecated' ? 'deprecated' : 'active'),
    // Check both v3 (old) and v4 (new) field names so re-runs are idempotent
    mechanicDate: old['mechanicInspectionDate'] ?? old['mechanicDate'] ?? 'not_checked',
    visualDate,
    uxDate: old['uxReviewDate'] ?? old['uxDate'] ?? 'not_checked',
    balanceDate: old['balanceCheckDate'] ?? old['balanceDate'] ?? 'not_checked',
    strategyDate: old['strategicAnalysisDate'] ?? old['strategyDate'] ?? 'not_checked',
    neuralDate: old['neuralAgentDate'] ?? old['neuralDate'] ?? 'not_checked',
    playtestDate: old['llmPlaytestDate'] ?? old['playtestDate'] ?? 'not_checked',
    lastInspected: old['lastInspectedDate'] ?? old['lastInspected'] ?? 'not_checked',
    confidenceLevel: (old['confidenceLevel'] as ConfidenceLevel) ?? 'not_checked',
    notes: old['notes'] ?? '',
  };

  // Recompute confidence from migrated fields (old value may be stale)
  el.confidenceLevel = computeConfidence(el);
  el.lastInspected = computeLastInspected(el);

  return el;
}

// ─── Confidence / date helpers ────────────────────────────────────────────────

const DATE_FIELDS: (keyof RegistryElement)[] = [
  'mechanicDate', 'visualDate', 'uxDate', 'balanceDate', 'strategyDate', 'neuralDate', 'playtestDate',
];

function computeLastInspected(el: RegistryElement): string {
  return mostRecent(DATE_FIELDS.map((f) => el[f] as string));
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

function blankElement(id: string, name: string, category: string, description: string, sourceFile: string): RegistryElement {
  return {
    id,
    name,
    category,
    description,
    sourceFile,
    status: 'active',
    mechanicDate: 'not_checked',
    visualDate: 'not_checked',
    uxDate: 'not_checked',
    balanceDate: 'not_checked',
    strategyDate: 'not_checked',
    neuralDate: 'not_checked',
    playtestDate: 'not_checked',
    lastInspected: 'not_checked',
    confidenceLevel: 'not_checked',
    notes: '',
  };
}

// ─── Type union extraction ─────────────────────────────────────────────────────

/**
 * Read a TypeScript file as text and extract all string-literal members from
 * a named `export type Foo = 'a' | 'b' | ...` union declaration.
 */
function extractTypeUnion(filePath: string, exportName: string): string[] {
  const text = fs.readFileSync(filePath, 'utf-8');

  // Match the type declaration body (handles multi-line and inline declarations)
  const pattern = new RegExp(
    `export\\s+type\\s+${exportName}\\s*=\\s*([\\s\\S]*?)(?=\\n\\n|\\n\\/\\*|\\nexport|$)`,
  );
  const match = text.match(pattern);
  if (!match) {
    console.warn(`  [warn] Could not find 'export type ${exportName}' in ${filePath}`);
    return [];
  }

  // Extract all 'value' string literals from the union body
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
}

async function extractFromMapping(mapping: SourceMapping): Promise<ExtractedElement[]> {
  const absPath = path.resolve(process.cwd(), mapping.sourceFile);

  if (!fs.existsSync(absPath)) {
    console.warn(`  [warn] Source file not found: ${mapping.sourceFile} — skipping table '${mapping.table}'`);
    return [];
  }

  const idField = mapping.idField ?? 'id';
  const nameField = mapping.nameField ?? 'name';
  const categoryField = mapping.categoryField ?? '';
  const descriptionField = mapping.descriptionField ?? '';

  // ── type_union ──────────────────────────────────────────────────────────────
  if (mapping.mode === 'type_union') {
    const members = extractTypeUnion(absPath, mapping.exportName);
    return members.map((val) => ({
      id: val,
      name: val,
      category: mapping.table,
      description: '',
    }));
  }

  // ── array / record — attempt dynamic import ──────────────────────────────────
  let mod: Record<string, unknown>;
  try {
    mod = await import(absPath);
  } catch (err) {
    console.warn(`  [warn] Failed to import ${mapping.sourceFile} (${(err as Error).message})`);
    console.warn(`         Falling back to type_union regex for table '${mapping.table}'`);
    // Last-resort: try extracting the export as a type union (useful for enums)
    const members = extractTypeUnion(absPath, mapping.exportName);
    return members.map((val) => ({
      id: val,
      name: val,
      category: mapping.table,
      description: '',
    }));
  }

  const exported = mod[mapping.exportName];
  if (exported === undefined) {
    console.warn(`  [warn] Export '${mapping.exportName}' not found in ${mapping.sourceFile}`);
    return [];
  }

  // ── array mode ───────────────────────────────────────────────────────────────
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

  // ── record mode ───────────────────────────────────────────────────────────────
  if (mapping.mode === 'record') {
    const rec = exported as Record<string, unknown>;
    return Object.entries(rec).map(([key, val]) => {
      const obj = (val && typeof val === 'object' ? val : {}) as Record<string, unknown>;
      const name = nameField && obj[nameField] ? String(obj[nameField]) : key;
      const category = categoryField && obj[categoryField] ? String(obj[categoryField]) : '';

      let description = '';
      if (descriptionField && obj[descriptionField]) {
        const raw = obj[descriptionField];
        if (Array.isArray(raw)) {
          // e.g. MECHANIC_SYNERGIES: value is string[]
          description = (raw as string[]).join(', ');
        } else {
          description = String(raw);
        }
      } else if (Array.isArray(val)) {
        // Record<string, string[]> — join the array as description
        description = (val as string[]).join(', ');
      }

      return { id: key, name, category, description };
    });
  }

  return [];
}

// ─── Load & migrate old registry ─────────────────────────────────────────────

function loadOldRegistry(registryPath: string): Map<string, Map<string, RegistryElement>> {
  // Returns: Map<tableName, Map<elementId, element>>
  const result = new Map<string, Map<string, RegistryElement>>();
  if (!fs.existsSync(registryPath)) return result;

  const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const tables = raw.tables ?? {};

  for (const [rawTableName, items] of Object.entries(tables)) {
    if (OLD_TABLES_TO_DROP.has(rawTableName)) continue;

    // Rename tables that changed name in v4
    const tableName = OLD_TABLE_RENAMES[rawTableName] ?? rawTableName;

    if (!Array.isArray(items)) continue;

    const map = new Map<string, RegistryElement>();
    for (const item of items as Record<string, string>[]) {
      const el = migrateOldElement(item);
      if (el.id) map.set(el.id, el);
    }
    result.set(tableName, map);
  }

  return result;
}

// ─── Atomic write ─────────────────────────────────────────────────────────────

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

  // Count stats for summary
  const stats: Record<string, { total: number; newCount: number; deprecated: number }> = {};

  const newTables: Record<string, RegistryElement[]> = {};

  // Process each source mapping
  for (const mapping of SOURCE_MAPPINGS) {
    process.stdout.write(`  Extracting ${mapping.table} from ${mapping.sourceFile}... `);
    const extracted = await extractFromMapping(mapping);
    console.log(`${extracted.length} elements`);

    const oldTableMap = oldRegistry.get(mapping.table) ?? new Map<string, RegistryElement>();
    const seenIds = new Set<string>();
    const elements: RegistryElement[] = [];
    let newCount = 0;

    for (const ex of extracted) {
      seenIds.add(ex.id);
      const existing = oldTableMap.get(ex.id);

      if (existing) {
        // Preserve inspection history; update metadata from source
        const merged: RegistryElement = {
          ...existing,
          name: ex.name || existing.name,
          category: ex.category || existing.category,
          description: ex.description || existing.description,
          sourceFile: mapping.sourceFile,
          status: 'active', // re-activate if it was deprecated
        };
        merged.lastInspected = computeLastInspected(merged);
        merged.confidenceLevel = computeConfidence(merged);
        elements.push(merged);
      } else {
        // New element — blank inspection slate
        elements.push(blankElement(ex.id, ex.name, ex.category, ex.description, mapping.sourceFile));
        newCount++;
      }
    }

    // Elements in old registry that are no longer in source → deprecated
    let deprecatedCount = 0;
    for (const [oldId, oldEl] of oldTableMap.entries()) {
      if (!seenIds.has(oldId)) {
        elements.push({ ...oldEl, status: 'deprecated', sourceFile: mapping.sourceFile });
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
    version: 4,
    lastSynced: today,
    tables: newTables,
  };

  writeAtomic(registryPath, JSON.stringify(registry, null, 2));

  // ── Print summary ─────────────────────────────────────────────────────────
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
