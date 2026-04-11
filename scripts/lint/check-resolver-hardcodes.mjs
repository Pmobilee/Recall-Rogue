#!/usr/bin/env node
/**
 * scripts/lint/check-resolver-hardcodes.mjs
 *
 * Preventative lint for "four-source rule" violations in cardEffectResolver.ts.
 *
 * The FOUR SOURCES rule: every numeric effect-quantity value inside a `case '<mechanicId>':` block
 * of `resolveCardEffect` must come from ONE of these four sanctioned sources:
 *
 *   1. `stats.*` / `stats?.extras?.['field']`    — mastery stat table
 *   2. `mechanic?.quickPlayValue` / `mechanic?.secondaryValue` / `mechanic?.secondaryThreshold`
 *   3. `finalValue` / `mechanicBaseValue`         — pipeline-computed value
 *   4. An UPPERCASE_CONSTANT (e.g. CHARGE_CORRECT_MULTIPLIER) imported from ../data/balance
 *
 * Bare numeric literals used as effect-quantity values are violations — they cause
 * card descriptions to drift from actual game behavior when stat tables are updated.
 *
 * ALLOWLIST (never flagged):
 *   - `0` in all contexts
 *   - `value: 1` (boolean-like Vulnerable/Weakness stack count)
 *   - Array indices: `arr[0]`, `arr[N]`
 *   - Inside `Math.*` call arguments
 *   - Comparison/guard operands: `>= 3`, `< 0.3`, `> 0`, `=== 0`
 *   - `turnsRemaining:`, `turns:`, `duration:` scheduling fields
 *   - Fallback after `mechanic?.` or `stats?.`:  `mechanic?.secondaryValue ?? 3`
 *   - Fallback after `stats?.extras?.[...]`:     `stats?.extras?.['x'] ?? 5`
 *   - Tag-name-encoded: literal appears verbatim as a digit in any `hasTag('...')` call
 *     within 6 lines before/after the flagged line (local if-block scope)
 *   - Lines with `// lint-allow: resolver-hardcode — <reason>`
 *   - Embedded allowlist for genuinely intentional exceptions
 *
 * Output: one line per violation → src/services/cardEffectResolver.ts:<line>: case '<id>': ...
 * Exit:   0 = zero violations, 1 = violations found
 *
 * Run: node scripts/lint/check-resolver-hardcodes.mjs
 *      npm run lint:resolver
 *
 * Added: 2026-04-11 — preventative side of two-sided enforcement for four-source rule
 * See: docs/testing/strategy.md "Resolver Hardcode Lint"
 *      docs/gotchas.md 2026-04-11 "card-description-audit Severity-A hardcodes"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const TARGET_FILE = path.join(REPO_ROOT, 'src', 'services', 'cardEffectResolver.ts');

// ─── Embedded allowlist ────────────────────────────────────────────────────
// Line-content substrings that suppress a flag on the containing line.
// Use sparingly — prefer fixing the code or adding inline lint-allow comments.
const EMBEDDED_ALLOWLIST = [
  // Transmute structural control flow
  'sourceMasteryLevel >= 3',
  'sourceMasteryLevel >= 2',
  'sourceMasteryLevel >= 1',
  // Fortify hard-cap at 30 (balance pass limit) and geometry fractions
  'Math.min(currentBlock, 30)',
  'cappedBlock * 0.75',
  'cappedBlock * 0.25',
  'cappedBlock * 0.5',
  // Chameleon / Brace mode geometry (mechanical description, not effect magnitude)
  'chameleonMult = isChargeCorrect ? 1.3',
  'braceMultiplier = isChargeCorrect ? 3.0',
  // brace_exceed2 tag — `2 : 0` is tag-encoded but tag is on same line
  "hasTag('brace_exceed2') ? 2 : 0",
  // Aftershock ramp formula — computed, not a fixed magnitude
  '0.5 + (masteryLevelAftershock * 0.1)',
  '0.7 + (masteryLevelAftershock * 0.1)',
  // Double-strike structural multiplier — `finalValue * 1.0` is identity
  '* 1.0',
  // Feedback loop CW 50% — fractional shape, derived from finalValue
  'finalValue * 0.5',
  // Unstable Flux base values — intentional design; four-source fix deferred
  'const baseDmg = Math.round(10 * fluxMult)',
  'const baseBlock = Math.round(10 * fluxMult)',
  'const baseDraw = Math.max(1, Math.round(2 * fluxMult',
  'const baseWeakTurns = isChargeCorrect ? 3 : 2',
  // Smite aura-scaling formula — documented inline
  'smiteBase = 10 + (6 * (10 - fogLevel))',
  'smiteBase = 10 + (auraBonus * 2)',
  'auraBonus = 6 * (10 - fogLevel)',
  // Feedback Loop CC: mechanic-defined base with Pass 8 balance comment
  'mechanicBaseValue = 28',
  'mechanicBaseValue += 12',
  // Recall CC override values: documented design intent
  'mechanicBaseValue = 30',
  'mechanicBaseValue = 20',
  // Precision Strike constants: documented inline
  'const psBaseMult = 8',
  "const psBonusMult = hasTag('precision_bonus_x2')",
  // Iron Wave CW shape fraction
  '* 0.75)',
  // Corrode -1 sentinel (remove all)
  'corrodeRemoveBase = isChargeCorrect ? -1',
  // Sacrifice: fixed 5 HP loss by design (comment in-code documents it)
  'result.selfDamage = 5; // fixed 5 HP loss',
  // Gambit: stat-table first, fallback=5 matches old hardcode (transitional)
  "stats?.extras?.['healOnCC'] ?? 5",
  // knowledge_ward CW: flat 4 — Severity B (Follow-up A may fix; lint-allowed for now)
  'applyShieldRelics(4);',
  // Recall heal: Severity A (Follow-up A may fix; lint-allowed for now)
  'hasTag(\'recall_heal3\') ? 6 + 3 : 6',
  // strike: tempo3 tag bonus +4 — needs stat-table extras.tempoDmg; Severity B, Follow-up A
  '(result.damageDealt ?? 0) + 4;',
];

// ─── Effect-quantity fields that must come from four sources ───────────────
const EFFECT_QUANTITY_FIELDS = [
  'healApplied',
  'applyBurnStacks',
  'applyBleedStacks',
  'thornsValue',
  'chainBlockBonus',
  'overkillHeal',
  'grantsAp',
  'apOnBlockGain',
  'selfDamage',
  'gambitselfDamage',
  'gambitHeal',
  'reflectDamage',
  'counterDamage',
  'warDrumBonus',
  'discardDamage',
  'inscriptionFuryCcBonus',
  'inscriptionIronThorns',
  'removeEnemyBlock',
  'removeDebuffCount',
  'empowerWeakStacks',
  'igniteDuration',
  'apGain',
  'apRefund',
  'healPctApplied',
  'damageDealt',
  'shieldApplied',
];

// ─── Exempt fields (scheduling / structural, not effect magnitude) ─────────
const EXEMPT_FIELDS = [
  'turnsRemaining',
  'turns:',
  'duration:',
  'drawCount',
  'extraCardsDrawn',
  'pickCount',
  'scavengeCount',
  'lookAt',
  'discardCount',
  'archiveRetainCount',
  'archiveBlockBonus',
  'battleTranceDraw',
  'focusCharges',
  'freePlayCount',
  'empowerTargetCount',
  'hitCount',
  'chainLightningChainLength',
  'masteryReachedL5Count',
  'siphonAnswerPreviewDuration',
  'timerExtensionPct',
  'vulnDurationOverride',
  'tauntDuration',
  'reinforcePermanentBonusIncrement',
  'eliminateDistractor',
  'xCostApConsumed',
  'sacrificeApGain',
  'recollectUpgrade',
  'frenzyChargesGranted',
  'masteryBumpsCount',
  'masteryBumpAmount',
];

// ─── Helper: extract numbers appearing in hasTag('...<N>...') calls ────────
function tagEncodedNumbers(lineOrBlock) {
  const nums = new Set();
  const tagRe = /hasTag\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = tagRe.exec(lineOrBlock)) !== null) {
    const digitRe = /\d+(?:\.\d+)?/g;
    let d;
    while ((d = digitRe.exec(m[1])) !== null) {
      nums.add(parseFloat(d[0]));
    }
  }
  return nums;
}

// ─── Main ─────────────────────────────────────────────────────────────────

if (!fs.existsSync(TARGET_FILE)) {
  console.error(`[check-resolver-hardcodes] Target file not found: ${TARGET_FILE}`);
  process.exit(1);
}

const source = fs.readFileSync(TARGET_FILE, 'utf8');
const lines = source.split('\n');

// Find resolveCardEffect
const funcStart = lines.findIndex(l => l.includes('export function resolveCardEffect('));
if (funcStart === -1) {
  console.error('[check-resolver-hardcodes] Could not find resolveCardEffect function');
  process.exit(1);
}

// Find switch(mechanicId)
const switchStart = lines.findIndex((l, i) => i > funcStart && /^\s+switch\s*\(\s*mechanicId\s*\)/.test(l));
if (switchStart === -1) {
  console.error('[check-resolver-hardcodes] Could not find switch(mechanicId) in resolveCardEffect');
  process.exit(1);
}

// Find end of switch by brace counting from the switch line
let braceDepth = 0;
let switchEnd = lines.length - 1;
for (let i = switchStart; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') braceDepth++;
    else if (ch === '}') {
      braceDepth--;
      if (braceDepth === 0) { switchEnd = i; break; }
    }
  }
  if (lines[switchEnd] === lines[i] && braceDepth === 0) break;
}

// ─── Regex ────────────────────────────────────────────────────────────────
const CASE_RE = /^\s+case\s+'([\w_-]+)':/;
// Bare numeric literal, not part of identifier or decimal notation
const NUMERIC_RE = /(?<![a-zA-Z_$.\d\[])-?(\b\d+(?:\.\d+)?)\b(?!\s*[)\].,]?\s*\.\s*[a-zA-Z])/g;

// ─── Scan ─────────────────────────────────────────────────────────────────
let currentCase = 'unknown';
const violations = [];

for (let i = switchStart; i <= switchEnd; i++) {
  const raw = lines[i];
  const trimmed = raw.trim();

  // Track current case label
  const caseMatch = CASE_RE.exec(raw);
  if (caseMatch) { currentCase = caseMatch[1]; continue; }

  // Skip pure comment lines and blank lines
  if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

  // Skip explicit lint-allow annotation
  if (raw.includes('// lint-allow: resolver-hardcode')) continue;

  // Skip if line matches embedded allowlist
  if (EMBEDDED_ALLOWLIST.some(substr => raw.includes(substr))) continue;

  // Only flag lines that touch an effect-quantity field
  const touchesEffectField = EFFECT_QUANTITY_FIELDS.some(f => raw.includes(f));
  if (!touchesEffectField) continue;

  // If the only effect-field reference is an exempt scheduling field, skip
  if (EXEMPT_FIELDS.some(f => raw.includes(f))) continue;

  // Build local context block: ±6 lines around this line (stays within the case block)
  const ctxStart = Math.max(switchStart, i - 6);
  const ctxEnd = Math.min(switchEnd, i + 6);
  const ctxBlock = lines.slice(ctxStart, ctxEnd + 1).join('\n');

  // Collect tag-encoded numbers from local context
  const localTagNums = tagEncodedNumbers(ctxBlock);

  NUMERIC_RE.lastIndex = 0;
  let match;
  while ((match = NUMERIC_RE.exec(raw)) !== null) {
    const literal = match[1];
    const numVal = parseFloat(literal);

    // Zero is always safe
    if (numVal === 0) continue;

    // `value: 1` — boolean-like stack count (Vulnerable, Weakness = on/off)
    if (numVal === 1 && /value:\s*1/.test(raw)) continue;

    // Tag-name-encoded: number appears in any hasTag() within local context
    if (localTagNums.has(numVal)) continue;

    // Inside Math.* argument — check chars before the match
    const beforeMatch = raw.substring(0, match.index);
    if (/Math\.\w+\s*\([^)]*$/.test(beforeMatch)) continue;

    // Four-source pattern: literal is a fallback after mechanic?. or stats?.
    // e.g. `mechanic?.secondaryValue ?? 3` or `stats?.extras?.['x'] ?? 5`
    if (/(?:mechanic\??\.|stats\?\.).*\?\?\s*[-\d.]/.test(raw)) continue;

    // Comparison operand — literal is used as a threshold, not a magnitude
    // Check immediately surrounding characters
    const beforeChar = raw.substring(0, match.index).trimEnd().slice(-2);
    const afterChar = raw.substring(match.index + match[0].length).trimStart().slice(0, 1);
    if (/[><=!]/.test(beforeChar.slice(-1)) || /[><=!]/.test(afterChar)) continue;

    const lineNum = i + 1;
    const context = trimmed.length > 90 ? trimmed.substring(0, 90) + '…' : trimmed;

    // Deduplicate: same line+literal combination
    const key = `${lineNum}:${literal}`;
    if (!violations.some(v => v.key === key)) {
      violations.push({ key, line: lineNum, case: currentCase, literal, context });
    }
  }
}

// ─── Report ──────────────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';

if (violations.length === 0) {
  console.log(`${GREEN}${BOLD}check-resolver-hardcodes: 0 violations — four-source rule satisfied.${RESET}`);
  process.exit(0);
}

console.log(`${RED}${BOLD}check-resolver-hardcodes: ${violations.length} violation(s)${RESET}\n`);
console.log(`${GRAY}Rule: effect-quantity numeric literals in case blocks must come from:${RESET}`);
console.log(`${GRAY}  1) stats?.extras?.['field']  2) mechanic?.quickPlayValue/secondaryValue${RESET}`);
console.log(`${GRAY}  3) finalValue / mechanicBaseValue  4) UPPERCASE_CONSTANT from balance.ts${RESET}`);
console.log(`${GRAY}Fix: use stats table or add // lint-allow: resolver-hardcode — <reason>${RESET}\n`);

for (const v of violations) {
  const relPath = path.relative(REPO_ROOT, TARGET_FILE);
  console.log(`${RED}${relPath}:${v.line}${RESET}: case '${YELLOW}${v.case}${RESET}': literal ${BOLD}${v.literal}${RESET} — \`${GRAY}${v.context}${RESET}\``);
}

console.log(`\n${violations.length} violation(s). Run: npm run lint:resolver`);
process.exit(1);
