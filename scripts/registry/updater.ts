/**
 * Registry updater — stamps inspection dates on registry elements.
 *
 * Usage:
 *   npx tsx scripts/registry/updater.ts --ids "strike,block" --type mechanicDate
 *   npx tsx scripts/registry/updater.ts --table enemies --type balanceDate
 *   npx tsx scripts/registry/updater.ts --ids "hub,combat" --type visualDate --date 2026-03-31 --notes "Looks good"
 */

import fs from 'fs';
import path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

type DateField =
  | 'mechanicDate'
  | 'visualDate'
  | 'uxDate'
  | 'balanceDate'
  | 'strategyDate'
  | 'neuralDate'
  | 'playtestDate';

const DATE_FIELDS: DateField[] = [
  'mechanicDate',
  'visualDate',
  'uxDate',
  'balanceDate',
  'strategyDate',
  'neuralDate',
  'playtestDate',
];

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeLastInspected(el: RegistryElement): string {
  const dates = DATE_FIELDS
    .map((f) => el[f])
    .filter((d) => d && d !== 'not_checked')
    .sort();
  return dates.length > 0 ? dates[dates.length - 1] : 'not_checked';
}

function computeConfidence(el: RegistryElement): ConfidenceLevel {
  const filledCount = DATE_FIELDS.filter((f) => el[f] && el[f] !== 'not_checked').length;
  if (filledCount === 0) return 'not_checked';
  if (filledCount === 1) return 'possible';
  if (filledCount === 2) return 'likely';
  if (filledCount < DATE_FIELDS.length) return 'confirmed';
  return 'clean'; // all 7 filled
}

function parseArgs(): {
  ids: string[];
  table: string | null;
  type: DateField;
  date: string;
  notes: string | null;
} {
  const args = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const idsRaw = get('--ids');
  const ids = idsRaw ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const table = get('--table');
  const typeArg = get('--type') as DateField | null;
  const dateArg = get('--date');
  const notes = get('--notes');

  if (!typeArg) {
    console.error('Error: --type is required.');
    console.error(`Valid types: ${DATE_FIELDS.join(', ')}`);
    process.exit(1);
  }
  if (!DATE_FIELDS.includes(typeArg)) {
    console.error(`Error: invalid --type "${typeArg}". Valid: ${DATE_FIELDS.join(', ')}`);
    process.exit(1);
  }
  if (ids.length === 0 && !table) {
    console.error('Error: provide --ids "a,b,c" or --table <tableName>');
    process.exit(1);
  }

  // Validate date format
  const date = dateArg ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`Error: --date must be YYYY-MM-DD format, got "${date}"`);
    process.exit(1);
  }

  return { ids, table, type: typeArg, date, notes };
}

function writeAtomic(filePath: string, content: string): void {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const { ids, table, type, date, notes } = parseArgs();

  const registryPath = path.resolve(process.cwd(), 'data/inspection-registry.json');
  if (!fs.existsSync(registryPath)) {
    console.error(`Error: registry not found at ${registryPath}. Run sync.ts first.`);
    process.exit(1);
  }

  const registry: Registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));

  let totalStamped = 0;
  let notFound: string[] = [];

  if (table) {
    // Stamp all elements in a specific table
    const elements = registry.tables[table];
    if (!elements) {
      console.error(`Error: table "${table}" not found. Available: ${Object.keys(registry.tables).join(', ')}`);
      process.exit(1);
    }

    for (const el of elements) {
      if (el.status === 'deprecated') continue;
      el[type] = date;
      if (notes) el.notes = notes;
      el.lastInspected = computeLastInspected(el);
      el.confidenceLevel = computeConfidence(el);
      totalStamped++;
    }
    console.log(`Stamped ${totalStamped} elements in table "${table}" with ${type}=${date}`);

  } else {
    // Stamp specific IDs across all tables
    const foundIds = new Set<string>();

    for (const [tableName, elements] of Object.entries(registry.tables)) {
      for (const el of elements) {
        if (ids.includes(el.id)) {
          el[type] = date;
          if (notes) el.notes = notes;
          el.lastInspected = computeLastInspected(el);
          el.confidenceLevel = computeConfidence(el);
          totalStamped++;
          foundIds.add(el.id);
          console.log(`  [${tableName}] ${el.id} (${el.name}) → ${type}=${date}`);
        }
      }
    }

    notFound = ids.filter((id) => !foundIds.has(id));
    if (notFound.length > 0) {
      console.warn(`\nWarning: IDs not found in registry: ${notFound.join(', ')}`);
    }
    console.log(`\nStamped ${totalStamped} element(s) with ${type}=${date}`);
  }

  if (totalStamped === 0) {
    console.log('Nothing was stamped.');
    process.exit(0);
  }

  writeAtomic(registryPath, JSON.stringify(registry, null, 2));
  console.log(`Registry saved to ${registryPath}`);
}

main();
