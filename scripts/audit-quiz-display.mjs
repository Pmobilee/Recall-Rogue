#!/usr/bin/env node
/**
 * audit-quiz-display.mjs
 *
 * Audits all curated decks by rendering the exact questions players see in-game.
 * Reads deck JSON files directly — no game source imports needed.
 *
 * Usage: node scripts/audit-quiz-display.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DECKS_DIR = join(REPO_ROOT, 'data', 'decks');

// ── Language display names ────────────────────────────────────────────────────

const LANGUAGE_NAMES = {
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  nl: 'Dutch',
  cs: 'Czech',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
};

// ── Template rendering (mirrors renderTemplate() in questionTemplateSelector.ts) ─

/**
 * Render a question template string by replacing {placeholders} with fact data.
 * Mirrors the game's renderTemplate() logic exactly.
 */
function renderTemplate(questionFormat, fact) {
  const replacements = {
    targetLanguageWord: fact.targetLanguageWord ?? '',
    correctAnswer: fact.correctAnswer,
    language: fact.language ? (LANGUAGE_NAMES[fact.language] ?? fact.language) : '',
    explanation: fact.explanation,
    quizQuestion: fact.quizQuestion,
    reading: fact.reading ?? '',
    pronunciation: fact.pronunciation ?? '',
    partOfSpeech: fact.partOfSpeech ?? '',
  };

  let result = questionFormat.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in replacements) return replacements[key];
    // Dynamic fallback — look up on fact object directly
    const val = fact[key];
    return typeof val === 'string' ? val : match;
  });

  // If any {placeholder} patterns remain unresolved, fall back to fact's own question
  if (/\{\w+\}/.test(result)) {
    return fact.quizQuestion;
  }

  return result;
}

/**
 * Determine the correct answer for a given template.
 * Mirrors getCorrectAnswerForTemplate() in questionTemplateSelector.ts.
 */
function getCorrectAnswerForTemplate(templateId, fact) {
  if (templateId === 'reverse' && fact.targetLanguageWord) {
    return fact.targetLanguageWord;
  }
  if (templateId === 'reading' && fact.reading) {
    return fact.reading;
  }
  return fact.correctAnswer;
}

// ── Quality flag detection ────────────────────────────────────────────────────

/**
 * Run all quality checks on a single rendered question.
 * Returns an array of flag strings.
 */
function detectFlags(renderedQuestion, correctAnswer, distractors, poolSize) {
  const flags = [];

  // TRIVIAL: question text literally contains the correct answer as a substring
  // (case-insensitive), excluding very short answers (1-2 chars)
  if (
    correctAnswer.length > 2 &&
    renderedQuestion.toLowerCase().includes(correctAnswer.toLowerCase())
  ) {
    flags.push(`TRIVIAL: Q contains answer: "${correctAnswer}"`);
  }

  // SHORT_Q: rendered question is < 15 characters
  if (renderedQuestion.length < 15) {
    flags.push(`SHORT_Q: "${renderedQuestion}" (${renderedQuestion.length} chars)`);
  }

  // NO_DISTRACTORS: fact has 0 pre-generated distractors AND pool has ≤4 other facts
  if (distractors.length === 0 && poolSize <= 4) {
    flags.push(`NO_DISTRACTORS: 0 distractors, pool size ${poolSize}`);
  }

  // DUPE_DISTRACTOR: a distractor matches the correct answer (case-insensitive)
  const lowerAnswer = correctAnswer.toLowerCase();
  const dupeDist = distractors.find(d => d.toLowerCase() === lowerAnswer);
  if (dupeDist) {
    flags.push(`DUPE_DISTRACTOR: "${dupeDist}" matches correct answer`);
  }

  // Q_EQUALS_A: question and answer are identical strings
  if (renderedQuestion === correctAnswer) {
    flags.push(`Q_EQUALS_A`);
  }

  return flags;
}

// ── Sampling ──────────────────────────────────────────────────────────────────

/**
 * Pick 3 evenly-spread sample indices from an array of the given length.
 * Returns indices at positions: 0, floor(len/3), floor(2*len/3)
 */
function getSampleIndices(len) {
  if (len === 0) return [];
  if (len === 1) return [0];
  if (len === 2) return [0, 1];
  return [0, Math.floor(len / 3), Math.floor((2 * len) / 3)];
}

// ── Markdown escaping ─────────────────────────────────────────────────────────

function escMd(str) {
  // Escape pipe characters and newlines for use inside table cells
  return String(str ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

// ── Main audit logic ──────────────────────────────────────────────────────────

function auditDeck(deckFilename) {
  const deckPath = join(DECKS_DIR, deckFilename);
  let deck;
  try {
    deck = JSON.parse(readFileSync(deckPath, 'utf-8'));
  } catch (err) {
    return {
      output: `\n> ⚠️ Failed to load \`${deckFilename}\`: ${err.message}\n`,
      templateCount: 0,
      issueCount: 0,
      criticalCount: 0,
      flaggedRows: [],
    };
  }

  const facts = deck.facts ?? [];
  const pools = deck.answerTypePools ?? [];
  const templates = deck.questionTemplates ?? [];
  const totalPoolCount = pools.length;

  // Build a factId→fact map for quick lookup
  const factById = new Map(facts.map(f => [f.id, f]));

  // Build a poolId→pool map
  const poolById = new Map(pools.map(p => [p.id, p]));

  const lines = [];
  const flaggedRows = [];
  let templateCount = 0;
  let issueCount = 0;
  let criticalCount = 0;

  lines.push(`\n## ${deck.name} (${facts.length} facts, ${templates.length} templates, ${totalPoolCount} pools)\n`);

  if (templates.length === 0) {
    lines.push(`_No questionTemplates defined — facts use their own quizQuestion directly._\n`);
    // Still audit facts for basic quality even without templates
    // (use each fact's own quizQuestion as the rendered question)
    const syntheticTemplate = {
      id: '_direct',
      answerPoolId: facts[0]?.answerTypePoolId ?? '',
      questionFormat: '{quizQuestion}',
    };
    // Group facts by answerTypePoolId
    const poolGroups = new Map();
    for (const fact of facts) {
      const pid = fact.answerTypePoolId ?? '_default';
      if (!poolGroups.has(pid)) poolGroups.set(pid, []);
      poolGroups.get(pid).push(fact);
    }

    for (const [poolId, poolFacts] of poolGroups) {
      const pool = poolById.get(poolId);
      const poolSizeUniq = new Set(poolFacts.map(f => f.correctAnswer)).size;

      lines.push(`### Direct (no template) — pool: ${poolId}\n`);
      lines.push(`**Pool**: ${pool?.label ?? poolId} (${poolFacts.length} facts)\n`);
      lines.push(`| # | Rendered Question | Answer | Distractors (sample) | Flags |`);
      lines.push(`|---|---|---|---|---|`);

      const sampleIndices = getSampleIndices(poolFacts.length);
      for (const idx of sampleIndices) {
        const fact = poolFacts[idx];
        const rendered = fact.quizQuestion;
        const answer = fact.correctAnswer;
        const distractors = fact.distractors ?? [];
        const distSample = distractors.length > 0 ? distractors.slice(0, 4).join(', ') : '(runtime)';
        const flags = detectFlags(rendered, answer, distractors, poolSizeUniq);

        if (flags.length > 0) {
          issueCount += flags.length;
          criticalCount += flags.filter(f => f.startsWith('TRIVIAL') || f.startsWith('DUPE')).length;
          flaggedRows.push({ deck: deck.name, template: '_direct', factId: fact.id, flags });
        }

        templateCount += 1;
        lines.push(`| ${idx + 1} | ${escMd(rendered)} | ${escMd(answer)} | ${escMd(distSample)} | ${escMd(flags.join('; '))} |`);
      }
      lines.push('');
    }
  } else {
    templateCount += templates.length;

    for (const template of templates) {
      const pool = poolById.get(template.answerPoolId);
      const poolFactIds = pool?.factIds ?? [];
      const poolFacts = poolFactIds
        .map(id => factById.get(id))
        .filter(Boolean);

      // Count unique correctAnswer values in this pool
      const poolSizeUniq = new Set(poolFacts.map(f => f.correctAnswer)).size;

      lines.push(`### Template: ${template.id} — \`${escMd(template.questionFormat)}\``);
      lines.push(`**Pool**: ${pool?.label ?? template.answerPoolId} (${poolFacts.length} facts)\n`);
      lines.push(`| # | Rendered Question | Answer | Distractors (sample) | Flags |`);
      lines.push(`|---|---|---|---|---|`);

      const sampleIndices = getSampleIndices(poolFacts.length);

      if (poolFacts.length === 0) {
        lines.push(`| — | _(pool empty or fact IDs not found)_ | — | — | — |`);
        lines.push('');
        continue;
      }

      for (const idx of sampleIndices) {
        const fact = poolFacts[idx];
        const rendered = renderTemplate(template.questionFormat, fact);
        const answer = getCorrectAnswerForTemplate(template.id, fact);
        const distractors = fact.distractors ?? [];
        const distSample = distractors.length > 0 ? distractors.slice(0, 4).join(', ') : '(runtime)';
        const flags = detectFlags(rendered, answer, distractors, poolSizeUniq);

        if (flags.length > 0) {
          issueCount += flags.length;
          criticalCount += flags.filter(f => f.startsWith('TRIVIAL') || f.startsWith('DUPE')).length;
          flaggedRows.push({ deck: deck.name, template: template.id, factId: fact.id, flags });
        }

        lines.push(`| ${idx + 1} | ${escMd(rendered)} | ${escMd(answer)} | ${escMd(distSample)} | ${escMd(flags.join('; '))} |`);
      }
      lines.push('');
    }
  }

  return {
    output: lines.join('\n'),
    templateCount,
    issueCount,
    criticalCount,
    flaggedRows,
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────

function main() {
  const manifestPath = join(DECKS_DIR, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    process.stderr.write(`ERROR: Could not read manifest.json: ${err.message}\n`);
    process.exit(1);
  }

  const deckFiles = manifest.decks ?? [];

  // Collect today's date
  const today = new Date().toISOString().slice(0, 10);

  let totalTemplates = 0;
  let totalIssues = 0;
  let totalCritical = 0;
  const allFlaggedRows = [];
  const deckOutputs = [];

  for (const deckFilename of deckFiles) {
    const result = auditDeck(deckFilename);
    deckOutputs.push(result.output);
    totalTemplates += result.templateCount;
    totalIssues += result.issueCount;
    totalCritical += result.criticalCount;
    allFlaggedRows.push(...result.flaggedRows);
  }

  // ── Build output ──────────────────────────────────────────────────────────

  const out = [];

  out.push(`# Curated Deck Quiz Audit — ${today}\n`);
  out.push(`## Summary`);
  out.push(`- Decks: ${deckFiles.length}`);
  out.push(`- Templates audited: ${totalTemplates}`);
  out.push(`- Issues found: ${totalIssues} (${totalCritical} critical)\n`);

  // Deck sections
  for (const section of deckOutputs) {
    out.push(section);
  }

  // Flagged issues table
  out.push(`\n## Flagged Issues\n`);

  if (allFlaggedRows.length === 0) {
    out.push(`_No issues found._\n`);
  } else {
    out.push(`| Deck | Template | Fact ID | Flag | Details |`);
    out.push(`|---|---|---|---|---|`);

    for (const row of allFlaggedRows) {
      for (const flag of row.flags) {
        // Split flag into type and details
        const colonIdx = flag.indexOf(':');
        const flagType = colonIdx >= 0 ? flag.slice(0, colonIdx).trim() : flag;
        const flagDetails = colonIdx >= 0 ? flag.slice(colonIdx + 1).trim() : '';
        out.push(
          `| ${escMd(row.deck)} | ${escMd(row.template)} | ${escMd(row.factId)} | ${escMd(flagType)} | ${escMd(flagDetails)} |`
        );
      }
    }
    out.push('');
  }

  process.stdout.write(out.join('\n'));
}

main();
