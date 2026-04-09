#!/usr/bin/env node
/**
 * lint-facts.mjs
 * Programmatic quality checks on knowledge facts in public/facts.db
 * Usage: node scripts/lint-facts.mjs
 */

import Database from 'better-sqlite3';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DB_PATH = resolve(ROOT, 'public/facts.db');
const REPORT_PATH = resolve(ROOT, 'data/fact-lint-report.json');

// ─── DB ──────────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH, { readonly: true });

const facts = db.prepare(`
  SELECT id, quiz_question, correct_answer, distractors, explanation, statement,
         category_l1, category_l2
  FROM facts
  WHERE type = 'knowledge'
`).all();

console.log(`Loaded ${facts.length} knowledge facts from ${DB_PATH}\n`);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDistractors(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isNumericalAnswer(correct_answer) {
  // Brace markers like {300} indicate runtime numerical distractor generation
  return typeof correct_answer === 'string' && correct_answer.includes('{');
}

// ─── RESULTS COLLECTOR ───────────────────────────────────────────────────────

const issues = []; // { id, check, quiz_question, correct_answer, distractors, category_l1, category_l2, reason }

function flag(fact, checkId, reason) {
  issues.push({
    id: fact.id,
    check: checkId,
    quiz_question: fact.quiz_question,
    correct_answer: fact.correct_answer,
    distractors: fact.distractors,
    category_l1: fact.category_l1,
    category_l2: fact.category_l2,
    reason,
  });
}

// ─── CHECK 1: BROKEN_EXPLANATION ─────────────────────────────────────────────
// explanation or statement is just the question repeated

console.log('Running CHECK 1: BROKEN_EXPLANATION...');

for (const f of facts) {
  const normQ = normalize(f.quiz_question);
  if (!normQ) continue;

  if (f.explanation) {
    const normE = normalize(f.explanation);
    // near-match: explanation starts with question or is very similar (>90% overlap)
    if (normE === normQ || normE.startsWith(normQ) || normQ.startsWith(normE)) {
      flag(f, 'BROKEN_EXPLANATION', `explanation matches/repeats quiz_question`);
      continue;
    }
    // Jaccard similarity — only flag if explanation is nearly word-for-word the question
    // Must share >90% of words AND add fewer than 3 new words of substance
    const qWords = new Set(normQ.split(' ').filter(w => w.length > 3));
    const eWords = new Set(normE.split(' ').filter(w => w.length > 3));
    if (qWords.size > 3 && eWords.size > 3) {
      const newWords = [...eWords].filter(w => !qWords.has(w)).length;
      const qCoverage = [...qWords].filter(w => eWords.has(w)).length / qWords.size;
      // Only flag if the explanation is basically the question with <3 new words
      if (qCoverage > 0.9 && newWords < 3) {
        flag(f, 'BROKEN_EXPLANATION', `explanation mirrors quiz_question (${qCoverage.toFixed(2)} coverage, only ${newWords} new words)`);
        continue;
      }
    }
  }

  if (f.statement) {
    const normS = normalize(f.statement);
    if (normS === normQ || normS.startsWith(normQ) || normQ.startsWith(normS)) {
      flag(f, 'BROKEN_EXPLANATION', `statement matches/repeats quiz_question`);
    }
  }
}

// ─── CHECK 2: DUPLICATE_QUESTION ─────────────────────────────────────────────
// Near-duplicate quiz questions (normalized match)

console.log('Running CHECK 2: DUPLICATE_QUESTION...');

const questionMap = new Map(); // normalized question -> [id, ...]

for (const f of facts) {
  if (!f.quiz_question) continue;
  const normQ = normalize(f.quiz_question);
  if (!questionMap.has(normQ)) questionMap.set(normQ, []);
  questionMap.get(normQ).push(f.id);
}

const dupGroups = [];
for (const [normQ, ids] of questionMap) {
  if (ids.length > 1) {
    dupGroups.push({ normQ, ids });
    for (const id of ids) {
      const f = facts.find(x => x.id === id);
      if (f) flag(f, 'DUPLICATE_QUESTION', `Duplicate of: ${ids.filter(i => i !== id).join(', ')} (normalized: "${normQ.slice(0, 80)}")`);
    }
  }
}

// ─── CHECK 3: EMPTY_DISTRACTORS_NON_NUMERICAL ────────────────────────────────
// Empty distractors on non-numerical answers

console.log('Running CHECK 3: EMPTY_DISTRACTORS_NON_NUMERICAL...');

for (const f of facts) {
  if (isNumericalAnswer(f.correct_answer)) continue; // exempt
  const distractors = parseDistractors(f.distractors);
  if (distractors.length === 0) {
    flag(f, 'EMPTY_DISTRACTORS_NON_NUMERICAL', `No distractors and answer "${f.correct_answer}" is not a numerical brace-marker`);
  }
}

// ─── CHECK 4: PREMISE_CONTRADICTING_DISTRACTORS ──────────────────────────────
// Distractors that negate the question's premise

console.log('Running CHECK 4: PREMISE_CONTRADICTING_DISTRACTORS...');

const NEGATION_PATTERNS = [
  /\bit is not\b/i,
  /\bit isn'?t\b/i,
  /\bnot a\b/i,
  /\bdoes not\b/i,
  /\bdoesn'?t\b/i,
  /\bnever was\b/i,
  /\bno known\b/i,
  /\bcannot\b/i,
  /\bcan'?t\b/i,
  /\bdid not\b/i,
  /\bdidn'?t\b/i,
  /\bwas not\b/i,
  /\bwasn'?t\b/i,
  /\bare not\b/i,
  /\baren'?t\b/i,
  /\bnone of\b/i,
  /\bnot the\b/i,
  /\bnot known\b/i,
  /\bno evidence\b/i,
];

for (const f of facts) {
  const distractors = parseDistractors(f.distractors);
  if (distractors.length === 0) continue;

  const badDistractors = [];
  for (const d of distractors) {
    if (typeof d !== 'string') continue;
    for (const pat of NEGATION_PATTERNS) {
      if (pat.test(d)) {
        badDistractors.push(d);
        break;
      }
    }
  }

  if (badDistractors.length > 0) {
    flag(f, 'PREMISE_CONTRADICTING_DISTRACTORS', `Distractors contain negation phrases: ${JSON.stringify(badDistractors)}`);
  }
}

// ─── CHECK 5: CATEGORY_MISMATCH ──────────────────────────────────────────────
// Fact appears to be in the wrong domain (keyword heuristics)

console.log('Running CHECK 5: CATEGORY_MISMATCH...');

const CATEGORY_RULES = [
  {
    l1: 'food_cuisine',
    bad_keywords: [/\belement\b/i, /\bperiodic table\b/i, /\batomic\b/i, /\bmolecule\b/i, /\bcompound\b/i, /\bchemistry\b/i, /\bproton\b/i, /\bneutron\b/i, /\belectron\b/i],
    reason: 'Chemistry content in food_cuisine domain',
  },
  {
    l1: 'art_architecture',
    l2_contains: ['architectural_styles', 'sculpture_decorative'],
    bad_keywords: [/\bopera\b/i, /\bcomposer\b/i, /\bsymphony\b/i, /\borchestr/i, /\bsonata\b/i, /\bconcerto\b/i],
    reason: 'Music/opera content in art_architecture subcategory',
  },
  {
    l1: 'space_astronomy',
    bad_keywords: [/\bearth'?s geology\b/i, /\bearthquake\b/i, /\blocean current\b/i, /\btectonic\b/i, /\bweather pattern\b/i, /\btyphoon\b/i, /\bhurricane\b/i, /\bsoil layer\b/i],
    reason: 'Earth geology/weather content in space_astronomy domain',
  },
  {
    l1: 'natural_sciences',
    bad_keywords: [/\brecipe\b/i, /\bcooking technique\b/i, /\bcuisine\b/i, /\bingredient\b/i, /\bchef\b/i],
    reason: 'Cooking/cuisine content in natural_sciences domain',
  },
  {
    l1: 'geography',
    bad_keywords: [/\bbattle of\b/i, /\bworld war\b/i, /\bsigned the treaty\b/i, /\bassassinated\b/i, /\bpolitical party\b/i],
    reason: 'Historical/political event content in geography domain (no geographic element apparent)',
  },
  {
    l1: 'history',
    bad_keywords: [/\bcurrent president\b/i, /\bcurrent prime minister\b/i, /\bin office today\b/i, /\btodayS government\b/i],
    reason: 'Current events content in history domain',
  },
  // Cross-domain: music content in non-music categories
  {
    l1_not: ['music', 'art_architecture', 'history', 'entertainment'],
    bad_keywords_in_statement: [/^music fact:/i],
    reason: 'Music-labeled statement in non-music category',
  },
  // Space content in geography
  {
    l1: 'geography',
    bad_keywords: [/\bgalaxy\b/i, /\bnebula\b/i, /\blight.year\b/i, /\bexoplanet\b/i, /\bsupernova\b/i, /\bblack hole\b/i],
    reason: 'Astronomical content in geography domain',
  },
  // Biology/animals in food
  {
    l1: 'food_cuisine',
    bad_keywords: [/\bDNA\b/, /\bgenome\b/i, /\bevolution\b/i, /\bspecies\b/i, /\bpredator\b/i, /\bprey\b/i, /\bbehavior of\b/i],
    reason: 'Biology/animal behavior content in food_cuisine domain',
  },
];

for (const f of facts) {
  const textToCheck = [f.quiz_question, f.statement, f.explanation].filter(Boolean).join(' ');

  for (const rule of CATEGORY_RULES) {
    // Check l1 match
    if (rule.l1 && f.category_l1 !== rule.l1) continue;
    if (rule.l1_not && rule.l1_not.includes(f.category_l1)) continue;

    // Check l2 if specified
    if (rule.l2_contains && !rule.l2_contains.includes(f.category_l2)) continue;

    // Check keywords in statement or question
    const source = rule.bad_keywords_in_statement
      ? (f.statement || '')
      : textToCheck;

    const keywords = rule.bad_keywords || rule.bad_keywords_in_statement || [];
    for (const kw of keywords) {
      if (kw.test(source)) {
        flag(f, 'CATEGORY_MISMATCH', `${rule.reason} (matched: ${kw.toString()})`);
        break;
      }
    }
  }
}

// ─── CHECK 6: ANSWER_FORMAT_MISMATCH ─────────────────────────────────────────
// Answer doesn't grammatically fit the question type

console.log('Running CHECK 6: ANSWER_FORMAT_MISMATCH...');

const REASON_WORDS = /\b(because|due to|since|as a result|to avoid|in order to|so that|owing to|caused by|results from|stems from|attributed to)\b/i;
const DATE_YEAR_WORDS = /\b(\d{4}|\d{1,2}(st|nd|rd|th)|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b|\b(BCE|CE|BC|AD)\b|\b\d+\s*(years?|centuries|century|decades?|millenni))/i;
const NUMBER_WORDS = /\b(\d+[\d,\.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million|billion|half|quarter|dozen|few|many|several)\b/i;

for (const f of facts) {
  if (!f.quiz_question || !f.correct_answer) continue;
  const q = f.quiz_question.trim();
  const a = f.correct_answer.trim();
  const qLower = q.toLowerCase();

  // "Why" questions should have a reason clause
  if (qLower.startsWith('why ') || qLower.startsWith('why is ') || qLower.startsWith('why are ') || qLower.startsWith('why do ') || qLower.startsWith('why does ')) {
    // Check if it's a bare noun phrase (no verb, no reason word)
    const hasReasonWord = REASON_WORDS.test(a);
    const hasVerb = /\b(is|are|was|were|have|has|had|do|does|did|makes?|causes?|helps?|allows?|prevents?|enables?|provides?|gives?|leads?|results?|creates?)\b/i.test(a);
    const wordCount = a.split(/\s+/).length;
    if (!hasReasonWord && !hasVerb && wordCount <= 4 && !isNumericalAnswer(a)) {
      flag(f, 'ANSWER_FORMAT_MISMATCH', `"Why" question but answer "${a}" is a bare noun phrase (no reason word/verb)`);
    }
  }

  // "When" / "In what year" questions should have a date/year/time
  if (qLower.startsWith('when ') || qLower.startsWith('when did ') || qLower.startsWith('when was ') || qLower.startsWith('when were ') || /in what year/i.test(q)) {
    if (!DATE_YEAR_WORDS.test(a) && !isNumericalAnswer(a)) {
      flag(f, 'ANSWER_FORMAT_MISMATCH', `"When/In what year" question but answer "${a}" contains no date/year/time`);
    }
  }

  // "How many" / "How much" questions should have a number
  if (/^how many\b/i.test(q) || /^how much\b/i.test(q)) {
    if (!NUMBER_WORDS.test(a) && !isNumericalAnswer(a)) {
      flag(f, 'ANSWER_FORMAT_MISMATCH', `"How many/much" question but answer "${a}" contains no number`);
    }
  }
}

// ─── CHECK 7: LOW_DISTRACTOR_COUNT ───────────────────────────────────────────
// Too few distractors (fewer than 3, non-numerical)

console.log('Running CHECK 7: LOW_DISTRACTOR_COUNT...');

for (const f of facts) {
  if (isNumericalAnswer(f.correct_answer)) continue; // exempt
  const distractors = parseDistractors(f.distractors);
  if (distractors.length > 0 && distractors.length < 3) {
    flag(f, 'LOW_DISTRACTOR_COUNT', `Only ${distractors.length} distractor(s): ${JSON.stringify(distractors)}`);
  }
}

// ─── CHECK 8: SELF_ANSWERING (word-level leak) ─────────────────────────────
// A distinguishing word from the answer appears in the question, making
// distractors eliminable. Uses corpus-frequency filter: words appearing in
// 3+ facts as leaks are domain terms (excluded).

console.log('Running CHECK 8: SELF_ANSWERING...');

const SA_STOPWORDS = new Set([
  'the','a','an','what','who','how','why','did','does','was','are','is',
  'which','when','where','whom','whose','that','this','these','those',
  'in','on','at','to','of','by','as','or','for',
  'with','from','into','over','under','about','after','before','upon',
  'between','during','through','among','within','against','without','above',
  'and','but','nor','yet','so','not','its',
  'also','both','each','many','most','more','some','such','then','than',
  'has','had','have','were','been','will','can','may','his','her',
]);

// Build corpus frequency map
const saWordCounts = new Map();
for (const f of facts) {
  const q = (f.quiz_question || '').toLowerCase();
  const a = (f.correct_answer || '').toLowerCase();
  if (!q || !a) continue;
  const qWords = new Set(q.split(/[\s\-/,.:;!?'"()\[\]{}]+/));
  const ansWords = a.split(/[\s\-/]+/).filter(w => w.length >= 4 && !SA_STOPWORDS.has(w));
  for (const w of ansWords) {
    if (qWords.has(w)) { saWordCounts.set(w, (saWordCounts.get(w) || 0) + 1); break; }
  }
}
const saFrequent = new Set();
for (const [w, c] of saWordCounts) { if (c >= 3) saFrequent.add(w); }

for (const f of facts) {
  const q = (f.quiz_question || '').toLowerCase();
  const a = (f.correct_answer || '').toLowerCase();
  if (!q || !a) continue;

  // (a) Verbatim full-answer leak
  if (a.length > 5 && q.includes(a)) {
    flag(f, 'SELF_ANSWERING', `Full answer "${f.correct_answer?.slice(0, 40)}" appears verbatim in question`);
    continue;
  }

  // (b) Word-level leak (corpus-frequency filtered)
  const qWords = new Set(q.split(/[\s\-/,.:;!?'"()\[\]{}]+/));
  const ansWords = a.split(/[\s\-/]+/).filter(w => w.length >= 4 && !SA_STOPWORDS.has(w));
  for (const w of ansWords) {
    if (qWords.has(w) && !saFrequent.has(w)) {
      flag(f, 'SELF_ANSWERING', `Answer word "${w}" (from "${f.correct_answer?.slice(0, 40)}") appears in question`);
      break;
    }
  }
}

// ─── AGGREGATE STATS ─────────────────────────────────────────────────────────

const byCheck = {};
const CHECK_IDS = [
  'BROKEN_EXPLANATION',
  'DUPLICATE_QUESTION',
  'EMPTY_DISTRACTORS_NON_NUMERICAL',
  'PREMISE_CONTRADICTING_DISTRACTORS',
  'CATEGORY_MISMATCH',
  'ANSWER_FORMAT_MISMATCH',
  'LOW_DISTRACTOR_COUNT',
  'SELF_ANSWERING',
];
for (const c of CHECK_IDS) byCheck[c] = issues.filter(i => i.check === c);

const uniqueFlaggedIds = new Set(issues.map(i => i.id));

// ─── PRINT REPORT ────────────────────────────────────────────────────────────

console.log('\n=== FACT QUALITY LINT REPORT ===');
console.log(`Total knowledge facts: ${facts.length}`);

const pad = (s, n) => String(s).padEnd(n);

console.log(`  ${pad('BROKEN_EXPLANATION:', 42)} ${byCheck['BROKEN_EXPLANATION'].length} facts`);
console.log(`  ${pad('DUPLICATE_QUESTION:', 42)} ${dupGroups.length} groups (${byCheck['DUPLICATE_QUESTION'].length} facts)`);
console.log(`  ${pad('EMPTY_DISTRACTORS_NON_NUMERICAL:', 42)} ${byCheck['EMPTY_DISTRACTORS_NON_NUMERICAL'].length} facts`);
console.log(`  ${pad('PREMISE_CONTRADICTING_DISTRACTORS:', 42)} ${byCheck['PREMISE_CONTRADICTING_DISTRACTORS'].length} facts`);
console.log(`  ${pad('CATEGORY_MISMATCH:', 42)} ${byCheck['CATEGORY_MISMATCH'].length} facts`);
console.log(`  ${pad('ANSWER_FORMAT_MISMATCH:', 42)} ${byCheck['ANSWER_FORMAT_MISMATCH'].length} facts`);
console.log(`  ${pad('LOW_DISTRACTOR_COUNT:', 42)} ${byCheck['LOW_DISTRACTOR_COUNT'].length} facts`);
console.log(`  ${pad('SELF_ANSWERING:', 42)} ${byCheck['SELF_ANSWERING'].length} facts`);
console.log('');
console.log(`Total unique facts with issues: ${uniqueFlaggedIds.size} (${((uniqueFlaggedIds.size / facts.length) * 100).toFixed(1)}%)`);

// ─── PER-CHECK SAMPLES ───────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────────────────────────');
for (const c of CHECK_IDS) {
  const group = byCheck[c];
  if (group.length === 0) continue;
  console.log(`\n[${c}] — ${group.length} issue(s)`);
  const sample = group.slice(0, 5);
  for (const issue of sample) {
    console.log(`  ID: ${issue.id}`);
    console.log(`  Q:  ${(issue.quiz_question || '').slice(0, 100)}`);
    console.log(`  A:  ${(issue.correct_answer || '').slice(0, 80)}`);
    console.log(`  -> ${issue.reason}`);
    console.log('');
  }
  if (group.length > 5) console.log(`  ... and ${group.length - 5} more (see JSON report)`);
}

// ─── WRITE JSON REPORT ───────────────────────────────────────────────────────

const report = {
  generated_at: new Date().toISOString(),
  total_knowledge_facts: facts.length,
  summary: {},
  issues,
};

for (const c of CHECK_IDS) {
  report.summary[c] = {
    count: byCheck[c].length,
    ...(c === 'DUPLICATE_QUESTION' ? { groups: dupGroups.length } : {}),
  };
}
report.summary.total_unique_flagged = uniqueFlaggedIds.size;
report.summary.flagged_pct = parseFloat(((uniqueFlaggedIds.size / facts.length) * 100).toFixed(1));

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`\nDetailed report written to: ${REPORT_PATH}`);

db.close();
