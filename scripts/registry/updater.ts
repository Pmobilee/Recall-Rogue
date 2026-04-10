/**
 * Registry updater — stamps inspection dates on registry elements, and manages
 * in-progress locks for parallel-agent coordination.
 *
 * Usage — Date stamping:
 *   npx tsx scripts/registry/updater.ts --ids "strike,block" --type mechanicDate
 *   npx tsx scripts/registry/updater.ts --table enemies --type balanceDate
 *   npx tsx scripts/registry/updater.ts --ids "hub,combat" --type visualDate --date 2026-03-31 --notes "ok"
 *
 *   Deck-specific stamp types (decks table only):
 *   npx tsx scripts/registry/updater.ts --ids "ancient_rome" --type lastStructuralVerify
 *   npx tsx scripts/registry/updater.ts --ids "ancient_rome" --type lastQuizAudit
 *   npx tsx scripts/registry/updater.ts --ids "ancient_rome" --type lastLLMPlaytest
 *   npx tsx scripts/registry/updater.ts --ids "ancient_rome" --type lastTriviaBridge
 *
 * Usage — Lock management:
 *   npx tsx scripts/registry/updater.ts --lock --ids ancient_rome --agent llm-playtest --test-type llm-playtest [--batch B001] [--ttl-hours 4]
 *   npx tsx scripts/registry/updater.ts --unlock --ids ancient_rome
 *   npx tsx scripts/registry/updater.ts --check-lock --ids ancient_rome
 *     → exits 0 if free, exits 1 if locked (prints lock info to stderr)
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
  | 'playtestDate'
  | 'lastStructuralVerify'
  | 'lastQuizAudit'
  | 'lastLLMPlaytest'
  | 'lastTriviaBridge';

const DATE_FIELDS: DateField[] = [
  'mechanicDate', 'visualDate', 'uxDate', 'balanceDate', 'strategyDate', 'neuralDate', 'playtestDate',
  'lastStructuralVerify', 'lastQuizAudit', 'lastLLMPlaytest', 'lastTriviaBridge',
];

/** Core date fields used for confidence scoring (excludes deck-specific fields). */
const CONFIDENCE_FIELDS: DateField[] = [
  'mechanicDate', 'visualDate', 'uxDate', 'balanceDate', 'strategyDate', 'neuralDate', 'playtestDate',
];

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
  lastStructuralVerify?: string;
  lastQuizAudit?: string;
  lastLLMPlaytest?: string;
  lastTriviaBridge?: string;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeLastInspected(el: RegistryElement): string {
  const dates = DATE_FIELDS
    .map((f) => (el as Record<string, unknown>)[f] as string | undefined)
    .filter((d): d is string => !!d && d !== 'not_checked')
    .sort();
  return dates.length > 0 ? dates[dates.length - 1] : 'not_checked';
}

function computeConfidence(el: RegistryElement): ConfidenceLevel {
  const filledCount = CONFIDENCE_FIELDS.filter((f) => {
    const v = (el as Record<string, unknown>)[f] as string | undefined;
    return v && v !== 'not_checked';
  }).length;
  if (filledCount === 0) return 'not_checked';
  if (filledCount === 1) return 'possible';
  if (filledCount === 2) return 'likely';
  if (filledCount < CONFIDENCE_FIELDS.length) return 'confirmed';
  return 'clean';
}

// ─── CLI arg parser ───────────────────────────────────────────────────────────

type Mode = 'stamp' | 'lock' | 'unlock' | 'check-lock';

interface ParsedArgs {
  mode: Mode;
  ids: string[];
  table: string | null;
  type: DateField | null;
  date: string;
  notes: string | null;
  agentId: string | null;
  batchId: string | null;
  testType: string | null;
  ttlHours: number;
  force: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const has = (flag: string): boolean => args.includes(flag);
  const get = (flag: string): string | null => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  let mode: Mode = 'stamp';
  if (has('--lock')) mode = 'lock';
  else if (has('--unlock')) mode = 'unlock';
  else if (has('--check-lock')) mode = 'check-lock';

  const idsRaw = get('--ids');
  const ids = idsRaw ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const table = get('--table');
  const notes = get('--notes');
  const force = has('--force');

  const typeArg = get('--type') as DateField | null;
  const dateArg = get('--date');
  const date = dateArg ?? new Date().toISOString().slice(0, 10);

  const agentId = get('--agent');
  const batchId = get('--batch');
  const testType = get('--test-type');
  const ttlHoursRaw = get('--ttl-hours');
  const ttlHours = ttlHoursRaw ? parseInt(ttlHoursRaw, 10) : 4;

  if (mode === 'stamp') {
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
    if (dateArg && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
      console.error(`Error: --date must be YYYY-MM-DD format, got "${dateArg}"`);
      process.exit(1);
    }
  }

  if (mode === 'lock') {
    if (ids.length === 0) { console.error('Error: --lock requires --ids'); process.exit(1); }
    if (!agentId) { console.error('Error: --lock requires --agent <name>'); process.exit(1); }
    if (!testType) { console.error('Error: --lock requires --test-type <type>'); process.exit(1); }
  }

  if (mode === 'unlock' || mode === 'check-lock') {
    if (ids.length === 0) { console.error(`Error: --${mode} requires --ids`); process.exit(1); }
  }

  return { mode, ids, table, type: typeArg, date, notes, agentId, batchId, testType, ttlHours, force };
}

function writeAtomic(filePath: string, content: string): void {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

function loadRegistry(registryPath: string): Registry {
  if (!fs.existsSync(registryPath)) {
    console.error(`Error: registry not found at ${registryPath}. Run sync.ts first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as Registry;
}

// ─── Stamp mode ───────────────────────────────────────────────────────────────

function runStamp(registry: Registry, args: ParsedArgs): void {
  const { ids, table, type, date, notes } = args;
  if (!type) return;

  let totalStamped = 0;
  let notFound: string[] = [];

  if (table) {
    const elements = registry.tables[table];
    if (!elements) {
      console.error(`Error: table "${table}" not found. Available: ${Object.keys(registry.tables).join(', ')}`);
      process.exit(1);
    }
    for (const el of elements) {
      if (el.status === 'deprecated') continue;
      (el as Record<string, unknown>)[type] = date;
      if (notes) el.notes = notes;
      el.lastInspected = computeLastInspected(el);
      el.confidenceLevel = computeConfidence(el);
      totalStamped++;
    }
    console.log(`Stamped ${totalStamped} elements in table "${table}" with ${type}=${date}`);
  } else {
    const foundIds = new Set<string>();
    for (const [tableName, elements] of Object.entries(registry.tables)) {
      for (const el of elements) {
        if (ids.includes(el.id)) {
          (el as Record<string, unknown>)[type] = date;
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
}

// ─── Lock mode ────────────────────────────────────────────────────────────────

function runLock(registry: Registry, args: ParsedArgs): void {
  const { ids, agentId, batchId, testType, ttlHours, force } = args;
  if (!agentId || !testType) return;

  const now = new Date();
  const startedAt = now.toISOString();
  const expectedCompleteBy = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

  let totalLocked = 0;
  const notFound: string[] = [];

  for (const id of ids) {
    let found = false;
    for (const elements of Object.values(registry.tables)) {
      const el = elements.find((e) => e.id === id);
      if (!el) continue;
      found = true;

      if (el.inProgress) {
        const lockAge = Date.now() - new Date(el.inProgress.startedAt).getTime();
        const lockAgeHours = lockAge / (1000 * 60 * 60);
        if (lockAgeHours > ttlHours) {
          console.warn(`  [warn] ${id}: stale lock from '${el.inProgress.agentId}' (${lockAgeHours.toFixed(1)}h old, TTL=${ttlHours}h) — auto-overriding`);
        } else if (!force) {
          console.error(`  [error] ${id}: already locked by '${el.inProgress.agentId}' (testType=${el.inProgress.testType}, started=${el.inProgress.startedAt})`);
          console.error(`          Use --force to override an active lock.`);
          process.exit(1);
        } else {
          console.warn(`  [warn] ${id}: --force overriding active lock from '${el.inProgress.agentId}'`);
        }
      }

      const lock: InProgressLock = { agentId, testType, startedAt, expectedCompleteBy };
      if (batchId) lock.batchId = batchId;
      el.inProgress = lock;
      totalLocked++;
      console.log(`  Locked ${id} for agent '${agentId}' (testType=${testType}, expectedDone=${expectedCompleteBy})`);
    }
    if (!found) notFound.push(id);
  }

  if (notFound.length > 0) console.warn(`\nWarning: IDs not found: ${notFound.join(', ')}`);
  console.log(`\nLocked ${totalLocked} element(s).`);
}

// ─── Unlock mode ─────────────────────────────────────────────────────────────

function runUnlock(registry: Registry, args: ParsedArgs): void {
  const { ids } = args;
  let totalUnlocked = 0;
  const notFound: string[] = [];

  for (const id of ids) {
    let found = false;
    for (const elements of Object.values(registry.tables)) {
      const el = elements.find((e) => e.id === id);
      if (!el) continue;
      found = true;
      if (el.inProgress) {
        const prev = el.inProgress.agentId;
        el.inProgress = null;
        totalUnlocked++;
        console.log(`  Unlocked ${id} (was held by '${prev}')`);
      } else {
        console.log(`  ${id}: already free`);
        totalUnlocked++;
      }
    }
    if (!found) notFound.push(id);
  }

  if (notFound.length > 0) console.warn(`\nWarning: IDs not found: ${notFound.join(', ')}`);
  console.log(`\nUnlocked ${totalUnlocked} element(s).`);
}

// ─── Check-lock mode ──────────────────────────────────────────────────────────

function runCheckLock(registry: Registry, args: ParsedArgs): void {
  const { ids } = args;
  let anyLocked = false;

  for (const id of ids) {
    let found = false;
    for (const elements of Object.values(registry.tables)) {
      const el = elements.find((e) => e.id === id);
      if (!el) continue;
      found = true;
      if (el.inProgress) {
        anyLocked = true;
        process.stderr.write(
          `LOCKED: ${id} — agent='${el.inProgress.agentId}' testType='${el.inProgress.testType}' ` +
          `startedAt='${el.inProgress.startedAt}'` +
          (el.inProgress.batchId ? ` batchId='${el.inProgress.batchId}'` : '') +
          (el.inProgress.expectedCompleteBy ? ` expectedDone='${el.inProgress.expectedCompleteBy}'` : '') +
          '\n'
        );
      } else {
        process.stdout.write(`FREE: ${id}\n`);
      }
    }
    if (!found) process.stderr.write(`NOT_FOUND: ${id} — not in registry\n`);
  }

  if (anyLocked) process.exit(1);
  process.exit(0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs();
  const registryPath = path.resolve(process.cwd(), 'data/inspection-registry.json');
  const registry = loadRegistry(registryPath);

  if (args.mode === 'check-lock') {
    runCheckLock(registry, args);
    return;
  }

  if (args.mode === 'lock') {
    runLock(registry, args);
  } else if (args.mode === 'unlock') {
    runUnlock(registry, args);
  } else {
    runStamp(registry, args);
  }

  writeAtomic(registryPath, JSON.stringify(registry, null, 2));
  console.log(`Registry saved to ${registryPath}`);
}

main();
