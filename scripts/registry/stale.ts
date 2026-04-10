/**
 * stale.ts — Inspection Registry Stale Element Reporter
 *
 * Cross-references each registry element's lastInspectedDate against
 * when its source file was last modified in git. Outputs a prioritized
 * report of what to test next. Also shows IN PROGRESS locks so parallel
 * agents know what NOT to touch.
 *
 * Usage:
 *   npx tsx scripts/registry/stale.ts
 *   npx tsx scripts/registry/stale.ts --json
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SOURCE_MAPPINGS, type SourceMapping } from './sources';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InProgressLock {
  agentId: string;
  batchId?: string;
  testType: string;
  startedAt: string;
  expectedCompleteBy?: string;
}

interface RegistryElement {
  id?: string | number;
  name?: string;
  status?: string;
  lastInspectedDate?: string;
  lastInspected?: string;
  sourceFile?: string;
  lastStructuralVerify?: string;
  lastQuizAudit?: string;
  lastLLMPlaytest?: string;
  lastTriviaBridge?: string;
  inProgress?: InProgressLock | null;
  [key: string]: unknown;
}

interface RegistryData {
  version: number;
  lastUpdated?: string;
  lastSynced?: string;
  tables: Record<string, RegistryElement[]>;
}

type ElementCategory = 'STALE' | 'NEVER_INSPECTED' | 'FRESH' | 'DEPRECATED';

interface AnalyzedElement {
  id: string;
  name: string;
  table: string;
  riskTier: 1 | 2 | 3;
  sourceFile: string;
  category: ElementCategory;
  lastInspected: Date | null;
  sourceModified: Date | null;
  daysStale: number;
  inProgress?: InProgressLock | null;
  deckDates?: {
    lastStructuralVerify: string;
    lastQuizAudit: string;
    lastLLMPlaytest: string;
    lastTriviaBridge: string;
  };
}

interface GroupedBySource {
  sourceFile: string;
  riskTier: 1 | 2 | 3;
  table: string;
  sourceModified: Date | null;
  elements: AnalyzedElement[];
}

// ─── ANSI Colors ──────────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';

function color(text: string, ...codes: string[]): string {
  if (process.env.NO_COLOR || !process.stdout.isTTY) return text;
  return codes.join('') + text + RESET;
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

function getUncommittedFiles(): Set<string> {
  try {
    const worktree = execSync('git diff --name-only', { cwd: REPO_ROOT, encoding: 'utf8' });
    const staged = execSync('git diff --name-only --cached', { cwd: REPO_ROOT, encoding: 'utf8' });
    const files = new Set<string>();
    for (const line of [...worktree.split('\n'), ...staged.split('\n')]) {
      const trimmed = line.trim();
      if (trimmed) files.add(trimmed);
    }
    return files;
  } catch {
    return new Set();
  }
}

function getGitModDate(relPath: string): Date | null {
  try {
    const iso = execSync(
      `git log -1 --format=%aI -- ${JSON.stringify(relPath)}`,
      { cwd: REPO_ROOT, encoding: 'utf8' }
    ).trim();
    if (!iso) return null;
    return new Date(iso);
  } catch {
    return null;
  }
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

function parseDate(value: string | undefined | null): Date | null {
  if (!value || value === 'not_checked' || value === 'never') return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(older: Date, newer: Date): number {
  return Math.floor((newer.getTime() - older.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date | null): string {
  if (!d) return 'never';
  return d.toISOString().slice(0, 10);
}

// ─── Load registry ────────────────────────────────────────────────────────────

function loadRegistry(): RegistryData {
  const regPath = path.join(REPO_ROOT, 'data/inspection-registry.json');
  if (!fs.existsSync(regPath)) {
    throw new Error(`Registry not found at ${regPath}`);
  }
  return JSON.parse(fs.readFileSync(regPath, 'utf8')) as RegistryData;
}

// ─── Build source file mod-date cache ────────────────────────────────────────

interface SourceInfo {
  sourceFile: string;
  riskTier: 1 | 2 | 3;
  table: string;
  modDate: Date | null;
  isGlob: boolean;
}

function buildSourceCache(uncommitted: Set<string>): Map<string, SourceInfo> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const cache = new Map<string, SourceInfo>();
  for (const mapping of SOURCE_MAPPINGS) {
    const { sourceFile, riskTier, table } = mapping;
    if (cache.has(sourceFile)) continue;

    const isGlob = mapping.mode === 'json_glob';
    let modDate: Date | null = null;

    if (!isGlob) {
      modDate = getGitModDate(sourceFile);
      if (uncommitted.has(sourceFile)) modDate = today;
    }

    cache.set(sourceFile, { sourceFile, riskTier, table, modDate, isGlob });
  }
  return cache;
}

// ─── Map table → source mapping ───────────────────────────────────────────────

function buildTableToMapping(): Map<string, SourceMapping> {
  const map = new Map<string, SourceMapping>();
  for (const m of SOURCE_MAPPINGS) {
    if (!map.has(m.table)) map.set(m.table, m);
  }
  return map;
}

// ─── Analyze elements ─────────────────────────────────────────────────────────

function analyzeElements(
  registry: RegistryData,
  sourceCache: Map<string, SourceInfo>,
  tableToMapping: Map<string, SourceMapping>,
  uncommitted: Set<string>
): AnalyzedElement[] {
  const results: AnalyzedElement[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const [table, items] of Object.entries(registry.tables)) {
    if (!Array.isArray(items)) continue;

    const mapping = tableToMapping.get(table);
    if (!mapping) continue;

    const sourceInfo = sourceCache.get(mapping.sourceFile);
    if (!sourceInfo) continue;

    const isDeckTable = table === 'decks';

    for (const item of items) {
      // For json_glob mode, each element has its own sourceFile
      const elementSourceFile = String(item['sourceFile'] ?? mapping.sourceFile);
      let elementModDate = sourceInfo.modDate;

      if (sourceInfo.isGlob && elementSourceFile) {
        elementModDate = getGitModDate(elementSourceFile);
        if (uncommitted.has(elementSourceFile)) elementModDate = today;
      }

      if (item.status === 'deprecated') {
        results.push({
          id: String(item.id ?? item.name ?? 'unknown'),
          name: String(item.name ?? item.id ?? 'unknown'),
          table, riskTier: mapping.riskTier, sourceFile: elementSourceFile,
          category: 'DEPRECATED', lastInspected: null,
          sourceModified: elementModDate, daysStale: 0,
          inProgress: item.inProgress ?? null,
        });
        continue;
      }

      const lastInspected = parseDate(String(item.lastInspected ?? item.lastInspectedDate ?? 'not_checked'));
      const sourceModified = elementModDate;

      let category: ElementCategory;
      let daysStale = 0;

      if (!lastInspected) {
        category = 'NEVER_INSPECTED';
      } else if (sourceModified && sourceModified > lastInspected) {
        category = 'STALE';
        daysStale = daysBetween(lastInspected, today);
      } else {
        category = 'FRESH';
      }

      const analyzed: AnalyzedElement = {
        id: String(item.id ?? item.name ?? 'unknown'),
        name: String(item.name ?? item.id ?? 'unknown'),
        table, riskTier: mapping.riskTier, sourceFile: elementSourceFile,
        category, lastInspected, sourceModified, daysStale,
        inProgress: item.inProgress ?? null,
      };

      if (isDeckTable) {
        analyzed.deckDates = {
          lastStructuralVerify: String(item.lastStructuralVerify ?? 'not_checked'),
          lastQuizAudit: String(item.lastQuizAudit ?? 'not_checked'),
          lastLLMPlaytest: String(item.lastLLMPlaytest ?? 'not_checked'),
          lastTriviaBridge: String(item.lastTriviaBridge ?? 'not_checked'),
        };
      }

      results.push(analyzed);
    }
  }

  return results;
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

function sortElements(elements: AnalyzedElement[]): AnalyzedElement[] {
  return [...elements].sort((a, b) => {
    if (a.riskTier !== b.riskTier) return a.riskTier - b.riskTier;
    const aTime = a.lastInspected?.getTime() ?? 0;
    const bTime = b.lastInspected?.getTime() ?? 0;
    return aTime - bTime;
  });
}

// ─── Group stale by source file ───────────────────────────────────────────────

function groupBySource(elements: AnalyzedElement[]): GroupedBySource[] {
  const grouped = new Map<string, GroupedBySource>();

  for (const el of elements) {
    // Group decks by table (each has unique sourceFile), others by sourceFile
    const key = el.table === 'decks' ? `__table:${el.table}` : el.sourceFile;
    if (!grouped.has(key)) {
      grouped.set(key, {
        sourceFile: el.table === 'decks' ? 'data/decks/*.json' : el.sourceFile,
        riskTier: el.riskTier, table: el.table,
        sourceModified: el.sourceModified, elements: [],
      });
    }
    const g = grouped.get(key)!;
    if (el.sourceModified && (!g.sourceModified || el.sourceModified > g.sourceModified)) {
      g.sourceModified = el.sourceModified;
    }
    g.elements.push(el);
  }

  return [...grouped.values()].sort((a, b) => {
    if (a.riskTier !== b.riskTier) return a.riskTier - b.riskTier;
    const aTime = a.sourceModified?.getTime() ?? 0;
    const bTime = b.sourceModified?.getTime() ?? 0;
    return bTime - aTime;
  });
}

// ─── Group never-inspected by table ──────────────────────────────────────────

interface NeverGroup {
  table: string;
  riskTier: 1 | 2 | 3;
  total: number;
  neverCount: number;
  elements: AnalyzedElement[];
}

function groupNeverByTable(elements: AnalyzedElement[]): NeverGroup[] {
  const grouped = new Map<string, NeverGroup>();

  for (const el of elements) {
    if (!grouped.has(el.table)) {
      grouped.set(el.table, { table: el.table, riskTier: el.riskTier, total: 0, neverCount: 0, elements: [] });
    }
    const g = grouped.get(el.table)!;
    g.neverCount++;
    g.elements.push(el);
  }

  return [...grouped.values()].sort((a, b) => a.riskTier - b.riskTier);
}

// ─── Build recommendation ────────────────────────────────────────────────────

function buildRecommendation(staleGroups: GroupedBySource[], neverGroups: NeverGroup[]): string {
  if (staleGroups.length > 0) {
    const top = staleGroups[0];
    const count = top.elements.length;
    const dateStr = top.sourceModified ? formatDate(top.sourceModified) : 'unknown date';
    return (
      `Run \`/inspect ${top.table}\` first — ${count} element${count === 1 ? '' : 's'} stale from ` +
      `${top.sourceFile} change on ${dateStr} (Tier ${top.riskTier}, highest risk)`
    );
  }
  if (neverGroups.length > 0) {
    const top = neverGroups[0];
    return `Run \`/inspect ${top.table}\` first — ${top.neverCount} element${top.neverCount === 1 ? '' : 's'} never inspected (Tier ${top.riskTier})`;
  }
  return 'All elements are fresh. No action needed.';
}

// ─── Terminal renderer ────────────────────────────────────────────────────────

const INLINE_PREVIEW_LIMIT = 5;

function renderTerminal(
  stale: AnalyzedElement[],
  neverInspected: AnalyzedElement[],
  fresh: AnalyzedElement[],
  deprecated: AnalyzedElement[],
  inProgressElements: AnalyzedElement[],
  totalByTable: Map<string, number>
): void {
  const staleGroups = groupBySource(stale);
  const neverGroups = groupNeverByTable(neverInspected);
  for (const g of neverGroups) {
    g.total = totalByTable.get(g.table) ?? g.neverCount;
  }

  const recommendation = buildRecommendation(staleGroups, neverGroups);

  console.log('');
  console.log(color('═══════════════════════════════════════════════', BOLD));
  console.log(color('  INSPECTION REGISTRY — STALE ELEMENT REPORT  ', BOLD));
  console.log(color('═══════════════════════════════════════════════', BOLD));
  console.log('');

  // ── IN PROGRESS section ───────────────────────────────────────────────────
  if (inProgressElements.length > 0) {
    console.log(color('IN PROGRESS — locked by agents (do NOT start parallel work on these):', BOLD, MAGENTA));
    console.log('');

    for (const el of inProgressElements) {
      const lock = el.inProgress!;
      const lockAge = Date.now() - new Date(lock.startedAt).getTime();
      const lockAgeMin = Math.floor(lockAge / 60000);
      const ageStr = lockAgeMin < 60 ? `${lockAgeMin}m ago` : `${Math.floor(lockAgeMin / 60)}h ${lockAgeMin % 60}m ago`;
      const batchStr = lock.batchId ? ` batch=${lock.batchId}` : '';
      const doneStr = lock.expectedCompleteBy ? ` expectedDone=${lock.expectedCompleteBy.slice(0, 16)}` : '';
      console.log(color(`  [${el.table}] ${el.id} (${el.name})`, MAGENTA, BOLD));
      console.log(color(`    agent='${lock.agentId}' testType='${lock.testType}'${batchStr} startedAt=${ageStr}${doneStr}`, MAGENTA));
    }
    console.log('');
  }

  // ── STALE section ────────────────────────────────────────────────────────
  if (staleGroups.length > 0) {
    console.log(color('STALE — code changed since last inspection:', BOLD));
    console.log('');

    for (const group of staleGroups) {
      const tierColor = group.riskTier === 1 ? RED : YELLOW;
      const dateStr = group.sourceModified ? formatDate(group.sourceModified) : 'unknown';
      const label = `  [Tier ${group.riskTier}] ${group.table} (${group.sourceFile} — modified ${dateStr})`;
      console.log(color(label, tierColor, BOLD));

      const shown = group.elements.slice(0, INLINE_PREVIEW_LIMIT);
      for (const el of shown) {
        const staleDays = el.daysStale > 0 ? ` (${el.daysStale} day${el.daysStale === 1 ? '' : 's'} stale)` : '';
        const lastStr = el.lastInspected ? `last inspected ${formatDate(el.lastInspected)}` : 'never inspected';
        let deckLine = '';
        if (el.deckDates) {
          const dd = el.deckDates;
          deckLine = ` [struct=${dd.lastStructuralVerify.slice(0, 10)} quiz=${dd.lastQuizAudit.slice(0, 10)} playtest=${dd.lastLLMPlaytest.slice(0, 10)} bridge=${dd.lastTriviaBridge.slice(0, 10)}]`;
        }
        console.log(color(`    • ${el.name} — ${lastStr}${staleDays}${deckLine}`, tierColor));
      }

      const remainder = group.elements.length - shown.length;
      if (remainder > 0) console.log(color(`    ... (${remainder} more)`, tierColor, DIM));
      console.log('');
    }
  } else {
    console.log(color('STALE: none', DIM));
    console.log('');
  }

  // ── NEVER INSPECTED section ───────────────────────────────────────────────
  if (neverGroups.length > 0) {
    console.log(color('NEVER INSPECTED:', BOLD));
    console.log('');

    for (const group of neverGroups) {
      const tierColor = group.riskTier === 1 ? RED : group.riskTier === 2 ? YELLOW : DIM;
      const label = `  [Tier ${group.riskTier}] ${group.table}: ${group.neverCount}/${group.total} never inspected`;
      console.log(color(label, tierColor, BOLD));

      if (group.table === 'decks') {
        const names = group.elements.slice(0, INLINE_PREVIEW_LIMIT * 2).map(e => e.name);
        const remainder = group.elements.length - names.length;
        let nameLine = `    ${names.join(', ')}`;
        if (remainder > 0) nameLine += `, ... (${remainder} more)`;
        console.log(color(nameLine, tierColor));
        console.log(color(`    Tip: run "npm run audit:quiz-engine" to stamp lastQuizAudit for these decks`, DIM));
      } else {
        const names = group.elements.map(e => e.name);
        const shownNames = names.slice(0, INLINE_PREVIEW_LIMIT * 2);
        const remainderNames = names.length - shownNames.length;
        let nameLine = `    ${shownNames.join(', ')}`;
        if (remainderNames > 0) nameLine += `, ... (${remainderNames} more)`;
        console.log(color(nameLine, tierColor));
      }
      console.log('');
    }
  } else {
    console.log(color('NEVER INSPECTED: none', DIM));
    console.log('');
  }

  // ── FRESH section ─────────────────────────────────────────────────────────
  const freshByTable = new Map<string, number>();
  for (const el of fresh) {
    freshByTable.set(el.table, (freshByTable.get(el.table) ?? 0) + 1);
  }
  if (fresh.length > 0) {
    const tableList = [...freshByTable.entries()].map(([t, n]) => `${n} ${t}`).join(', ');
    console.log(color(`FRESH (no action needed): ${fresh.length} elements across ${freshByTable.size} tables`, DIM));
    console.log(color(`  ${tableList}`, DIM));
    console.log('');
  } else {
    console.log(color('FRESH: none', DIM));
    console.log('');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(color('───────────────────────────────────────────────', DIM));
  const summaryParts = [
    color(`${stale.length} stale`, stale.length > 0 ? RED : DIM),
    color(`${neverInspected.length} never-inspected`, neverInspected.length > 0 ? YELLOW : DIM),
    color(`${fresh.length} fresh`, GREEN),
    color(`${deprecated.length} deprecated`, DIM),
    color(`${inProgressElements.length} in-progress`, inProgressElements.length > 0 ? MAGENTA : DIM),
  ];
  console.log(`SUMMARY: ${summaryParts.join(color(' | ', DIM))}`);
  console.log(color('───────────────────────────────────────────────', DIM));
  console.log('');
  console.log(color(`RECOMMENDATION: ${recommendation}`, CYAN));
  console.log('');
}

// ─── JSON renderer ────────────────────────────────────────────────────────────

function renderJson(
  stale: AnalyzedElement[],
  neverInspected: AnalyzedElement[],
  fresh: AnalyzedElement[],
  deprecated: AnalyzedElement[],
  inProgressElements: AnalyzedElement[],
  neverGroups: NeverGroup[],
  staleGroups: GroupedBySource[]
): void {
  const recommendation = buildRecommendation(staleGroups, neverGroups);

  const output = {
    generatedAt: new Date().toISOString(),
    summary: {
      stale: stale.length,
      neverInspected: neverInspected.length,
      fresh: fresh.length,
      deprecated: deprecated.length,
      inProgress: inProgressElements.length,
      total: stale.length + neverInspected.length + fresh.length + deprecated.length,
    },
    inProgress: inProgressElements.map(el => ({
      id: el.id, name: el.name, table: el.table,
      agentId: el.inProgress!.agentId,
      testType: el.inProgress!.testType,
      startedAt: el.inProgress!.startedAt,
      ...(el.inProgress!.batchId ? { batchId: el.inProgress!.batchId } : {}),
      ...(el.inProgress!.expectedCompleteBy ? { expectedCompleteBy: el.inProgress!.expectedCompleteBy } : {}),
    })),
    stale: stale.map(el => ({
      id: el.id, name: el.name, table: el.table, riskTier: el.riskTier, sourceFile: el.sourceFile,
      lastInspected: el.lastInspected ? formatDate(el.lastInspected) : null,
      sourceModified: el.sourceModified ? formatDate(el.sourceModified) : null,
      daysStale: el.daysStale,
    })),
    neverInspected: neverInspected.map(el => ({
      id: el.id, name: el.name, table: el.table, riskTier: el.riskTier, sourceFile: el.sourceFile,
    })),
    fresh: fresh.map(el => ({
      id: el.id, name: el.name, table: el.table, riskTier: el.riskTier, sourceFile: el.sourceFile,
      lastInspected: formatDate(el.lastInspected),
    })),
    recommendation,
  };

  console.log(JSON.stringify(output, null, 2));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');

  if (!jsonMode) process.stdout.write('Loading registry...\r');

  const registry = loadRegistry();
  const uncommitted = getUncommittedFiles();
  const sourceCache = buildSourceCache(uncommitted);
  const tableToMapping = buildTableToMapping();

  const allElements = analyzeElements(registry, sourceCache, tableToMapping, uncommitted);

  const stale = sortElements(allElements.filter(e => e.category === 'STALE'));
  const neverInspected = sortElements(allElements.filter(e => e.category === 'NEVER_INSPECTED'));
  const fresh = allElements.filter(e => e.category === 'FRESH');
  const deprecated = allElements.filter(e => e.category === 'DEPRECATED');
  const inProgressElements = allElements.filter(e => e.category !== 'DEPRECATED' && e.inProgress != null);

  const totalByTable = new Map<string, number>();
  for (const el of allElements) {
    if (el.category !== 'DEPRECATED') {
      totalByTable.set(el.table, (totalByTable.get(el.table) ?? 0) + 1);
    }
  }

  if (jsonMode) {
    const staleGroups = groupBySource(stale);
    const neverGroups = groupNeverByTable(neverInspected);
    renderJson(stale, neverInspected, fresh, deprecated, inProgressElements, neverGroups, staleGroups);
  } else {
    renderTerminal(stale, neverInspected, fresh, deprecated, inProgressElements, totalByTable);
  }
}

main();
