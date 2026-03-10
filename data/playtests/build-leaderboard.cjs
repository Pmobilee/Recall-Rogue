#!/usr/bin/env node
/**
 * build-leaderboard.cjs
 *
 * Reads all playtest analysis reports, deduplicates issues by
 * canonical key ({category}_{floor_bucket}), scores them, and
 * writes a ranked leaderboard JSON file.
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, 'reports');
const LOGS_DIR = path.join(__dirname, 'logs');
const OUTPUT_PATH = path.join(__dirname, 'leaderboard.json');

// ── Floor bucket helpers ──────────────────────────────────────────
function floorToBucket(floor) {
  if (floor == null) return 'global';
  if (floor >= 1 && floor <= 3) return 'early';
  if (floor >= 4 && floor <= 6) return 'mid_early';
  if (floor >= 7 && floor <= 9) return 'mid';
  if (floor >= 10 && floor <= 12) return 'late';
  if (floor >= 13) return 'endgame';
  return 'global';
}

/**
 * Extract a single representative floor from the evidence object.
 * Some issues have `evidence.floor` (number), some have `evidence.floors` (array).
 * For arrays, pick the max floor to represent the issue's progression point.
 */
function extractFloor(evidence) {
  if (!evidence) return null;
  if (typeof evidence.floor === 'number') return evidence.floor;
  if (Array.isArray(evidence.floors) && evidence.floors.length > 0) {
    return Math.max(...evidence.floors);
  }
  return null;
}

// ── Severity weight lookup ────────────────────────────────────────
const SEVERITY_WEIGHTS = {
  critical: 10,
  high: 5,
  medium: 3,
  low: 1,
  cosmetic: 0.5,
};

function severityWeight(sev) {
  return SEVERITY_WEIGHTS[sev] || 1;
}

// ── Breadth factor ────────────────────────────────────────────────
function breadthFactor(profileCount) {
  if (profileCount >= 3) return 1.5;
  if (profileCount >= 2) return 1.25;
  return 1.0;
}

// ── Determine if an issue is "global" (systemic across all runs) ─
// The combo_unreachable category is documented as systemic. We also
// check for issues that have no floor context at all.
function isSystemicCategory(category) {
  return category === 'balance_combo_unreachable';
}

// ── Pick "best" (most severe / most descriptive) from a group ────
function pickBestSeverity(issues) {
  const order = ['critical', 'high', 'medium', 'low', 'cosmetic'];
  let best = issues[0];
  for (const issue of issues) {
    if (order.indexOf(issue.severity) < order.indexOf(best.severity)) {
      best = issue;
    }
  }
  return best.severity;
}

function pickBestEvidence(issues) {
  // Prefer the issue with the highest severity, then longest metric string
  const order = ['critical', 'high', 'medium', 'low', 'cosmetic'];
  const sorted = [...issues].sort((a, b) => {
    const sevDiff = order.indexOf(a.severity) - order.indexOf(b.severity);
    if (sevDiff !== 0) return sevDiff;
    // Tiebreak: longer metric = more detail
    const aMetric = (a.evidence && a.evidence.metric) || '';
    const bMetric = (b.evidence && b.evidence.metric) || '';
    return bMetric.length - aMetric.length;
  });
  return sorted[0].evidence || {};
}

function pickBestTitle(issues) {
  // Pick the longest, most descriptive title from the most severe issue
  const order = ['critical', 'high', 'medium', 'low', 'cosmetic'];
  const sorted = [...issues].sort((a, b) => {
    const sevDiff = order.indexOf(a.severity) - order.indexOf(b.severity);
    if (sevDiff !== 0) return sevDiff;
    return b.title.length - a.title.length;
  });
  return sorted[0].title;
}

function pickBestDescription(issues) {
  const order = ['critical', 'high', 'medium', 'low', 'cosmetic'];
  const sorted = [...issues].sort((a, b) => {
    const sevDiff = order.indexOf(a.severity) - order.indexOf(b.severity);
    if (sevDiff !== 0) return sevDiff;
    return b.description.length - a.description.length;
  });
  return sorted[0].description;
}

function pickReproductionSteps(issues) {
  // Collect unique steps, preferring from the best-severity issue
  const order = ['critical', 'high', 'medium', 'low', 'cosmetic'];
  const sorted = [...issues].sort((a, b) => {
    const sevDiff = order.indexOf(a.severity) - order.indexOf(b.severity);
    if (sevDiff !== 0) return sevDiff;
    return (b.reproductionSteps || []).length - (a.reproductionSteps || []).length;
  });
  return sorted[0].reproductionSteps || [];
}

// ── Log settings loader ──────────────────────────────────────────
const DEFAULT_SETTINGS = { difficultyMode: 'standard', archetype: 'balanced', domain: 'general_knowledge' };

/**
 * Build a map of playthroughId -> { settings, summary } from log files.
 * Falls back to defaults when log is missing or has no settings field.
 */
function loadLogMetadata() {
  const meta = new Map();
  if (!fs.existsSync(LOGS_DIR)) return meta;

  const files = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const log = JSON.parse(fs.readFileSync(path.join(LOGS_DIR, file), 'utf8'));
      if (log.id) {
        meta.set(log.id, {
          settings: log.settings || DEFAULT_SETTINGS,
          summary: log.summary || {},
          profileId: log.profileId,
          rngSeed: log.rngSeed,
        });
      }
    } catch { /* skip unparseable logs */ }
  }
  return meta;
}

// ── Main ──────────────────────────────────────────────────────────
function main() {
  // 0. Load log metadata (settings, summaries) keyed by playthroughId
  const logMeta = loadLogMetadata();
  console.log(`Loaded metadata for ${logMeta.size} log files`);

  // 1. Read all report files
  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`Found ${files.length} report files`);

  const reports = [];
  let totalRawIssues = 0;

  for (const file of files) {
    const filePath = path.join(REPORTS_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    reports.push(data);
    totalRawIssues += (data.issues || []).length;
  }

  console.log(`Total raw issues across all reports: ${totalRawIssues}`);

  // 2. Collect all issues with report metadata
  const allIssues = [];
  for (const report of reports) {
    for (const issue of report.issues || []) {
      allIssues.push({
        ...issue,
        profileId: report.profileId,
        playthroughId: report.playthroughId,
        analyzedAt: report.analyzedAt,
      });
    }
  }

  // 3. Deduplicate by canonical key: {category}_{floor_bucket}
  const groups = new Map(); // canonicalId -> { issues, profiles, reportIds, timestamps }

  for (const issue of allIssues) {
    const floor = extractFloor(issue.evidence);
    const bucket = isSystemicCategory(issue.category)
      ? 'global'
      : floorToBucket(floor);
    const canonicalId = `${issue.category}_${bucket}`;

    if (!groups.has(canonicalId)) {
      groups.set(canonicalId, {
        category: issue.category,
        bucket,
        issues: [],
        profiles: new Set(),
        reportIds: new Set(),
        timestamps: [],
      });
    }

    const group = groups.get(canonicalId);
    group.issues.push(issue);
    group.profiles.add(issue.profileId);
    group.reportIds.add(issue.playthroughId);
    group.timestamps.push(issue.analyzedAt);
  }

  console.log(`Deduplicated into ${groups.size} canonical issue groups`);

  // 4. Score and build leaderboard entries
  const leaderboardIssues = [];

  for (const [canonicalId, group] of groups) {
    const severity = pickBestSeverity(group.issues);
    const frequency = group.reportIds.size; // unique playthroughs
    const profiles = [...group.profiles].sort();
    const bf = breadthFactor(profiles.length);
    const score = parseFloat((severityWeight(severity) * frequency * bf).toFixed(2));

    const timestamps = group.timestamps.filter(Boolean).sort();
    const firstSeen = timestamps[0] || null;
    const lastSeen = timestamps[timestamps.length - 1] || null;

    // Aggregate settings from source logs
    const settingsModes = new Set();
    const settingsArchetypes = new Set();
    const settingsDomains = new Set();
    const runBreakdown = [];

    for (const playthroughId of group.reportIds) {
      const meta = logMeta.get(playthroughId);
      const settings = meta ? meta.settings : DEFAULT_SETTINGS;
      const summary = meta ? meta.summary : {};

      settingsModes.add(settings.difficultyMode || 'standard');
      settingsArchetypes.add(settings.archetype || 'balanced');
      settingsDomains.add(settings.domain || 'general_knowledge');

      runBreakdown.push({
        profileId: meta ? meta.profileId : null,
        seed: meta ? meta.rngSeed : null,
        difficultyMode: settings.difficultyMode || 'standard',
        archetype: settings.archetype || 'balanced',
        result: summary.result || null,
        floor: summary.finalFloor || null,
      });
    }

    leaderboardIssues.push({
      canonicalId,
      category: group.category,
      severity,
      title: pickBestTitle(group.issues),
      description: pickBestDescription(group.issues),
      frequency,
      affectedProfiles: profiles,
      affectedSettings: {
        difficultyModes: [...settingsModes].sort(),
        archetypes: [...settingsArchetypes].sort(),
        domains: [...settingsDomains].sort(),
      },
      runBreakdown,
      firstSeen,
      lastSeen,
      rank: 0, // assigned after sort
      score,
      status: 'open',
      sourceReports: [...group.reportIds].sort(),
      bestEvidence: pickBestEvidence(group.issues),
      reproductionSteps: pickReproductionSteps(group.issues),
    });
  }

  // 5. Sort by score descending, assign ranks
  leaderboardIssues.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak: higher frequency first, then alphabetical
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return a.canonicalId.localeCompare(b.canonicalId);
  });

  for (let i = 0; i < leaderboardIssues.length; i++) {
    leaderboardIssues[i].rank = i + 1;
  }

  // 6. Write leaderboard JSON
  const leaderboard = {
    updatedAt: new Date().toISOString(),
    totalPlaythroughs: reports.length,
    totalIssues: leaderboardIssues.length,
    issues: leaderboardIssues,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(leaderboard, null, 2) + '\n', 'utf8');
  console.log(`\nLeaderboard written to ${OUTPUT_PATH}`);
  console.log(`  Total playthroughs: ${leaderboard.totalPlaythroughs}`);
  console.log(`  Total deduplicated issues: ${leaderboard.totalIssues}`);
  console.log(`\nTop 10 issues by score:`);
  for (const issue of leaderboardIssues.slice(0, 10)) {
    console.log(`  #${issue.rank} [${issue.score}] ${issue.severity.toUpperCase()} (${issue.frequency}/${reports.length} runs) ${issue.canonicalId}`);
    console.log(`      ${issue.title}`);
  }
}

main();
