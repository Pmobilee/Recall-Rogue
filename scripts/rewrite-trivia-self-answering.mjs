#!/usr/bin/env node
/**
 * rewrite-trivia-self-answering.mjs
 *
 * Rewrites self-answering quiz questions in public/facts.db.
 * Uses pattern-based rules for common cases, logs any that need manual review.
 *
 * Usage:
 *   node scripts/rewrite-trivia-self-answering.mjs --dry-run
 *   node scripts/rewrite-trivia-self-answering.mjs --apply
 *   node scripts/rewrite-trivia-self-answering.mjs --apply --start 0 --count 200
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const START_IDX = parseInt(args[args.indexOf('--start') + 1] || '0', 10);
const COUNT = parseInt(args[args.indexOf('--count') + 1] || '99999', 10);

console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);
console.log(`Range: start=${START_IDX}, count=${COUNT}`);
console.log('');

// ─── Stopwords ───────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the','a','an','what','who','how','why','did','does','was','are','is',
  'which','when','where','that','this','with','from','have','been','will',
  'more','than','them','then','some','each','make','like','over','such',
  'take','into','also','back','after','only','come','made','find','here',
  'know','last','long','just','much','before','being','other','between',
  'these','about','first','very','still','those','should','would','could',
  'while','there','their','every','under','three','through','during',
  'and','but','for','not','its','has','had','were','can','may','his','her',
]);

// ─── Pattern-based rewriters ─────────────────────────────────────────────────

/**
 * Try to rewrite a question that leaks the answer.
 * Returns new question string, or null if no rewrite was found.
 */
function tryRewrite(q, a, leakedWord, flagType) {
  if (flagType === 'verbatim') {
    return rewriteVerbatim(q, a);
  } else {
    return rewriteWordLevel(q, a, leakedWord);
  }
}

/**
 * Handle verbatim leaks — answer appears literally in the question.
 * Most common: binary choice "A or B?" where answer is one of them.
 */
function rewriteVerbatim(q, a) {
  const aLower = a.toLowerCase().trim();
  const qLower = q.toLowerCase();

  // Binary choice: "...X or Y?" answer is one of them
  // Strategy: rephrase to remove the option listing
  if (q.includes(' or ') && q.endsWith('?')) {
    // Check if this is a "which is more/less" style question
    if (/which.*(more|less|better|worse|larger|smaller|higher|lower|older|newer|earlier|later|greater|fewer)/i.test(q)) {
      // These need specific rewording
      return rewriteBinaryComparison(q, a);
    }
    // Other "or" questions: "A or B?" → rephrase
    return rewriteOrQuestion(q, a);
  }

  // If answer appears as proper name in location context
  // "In which city was X created?" with city name appearing → typically the name IS the answer mentioned
  // Check if it's a city name in the question preamble
  if (/in which (city|country|state|region|nation)/i.test(q) && q.toLowerCase().includes(aLower)) {
    // The answer appears as context — rephrase to not include location name
    return rewriteLocationQuestion(q, a);
  }

  // "What is X — a real experiment or a thought experiment?" style
  if (/— .* or /i.test(q) && q.endsWith('?')) {
    return rewriteOrQuestion(q, a);
  }

  // Generic: try removing the answer from the question if it's used as a subject
  return null;
}

function rewriteBinaryComparison(q, a) {
  // "Which X is more Y — A or B?" → "Which X is more Y?"
  // Remove the "— A or B" or "A or B" clause at the end
  const cleaned = q.replace(/[—–]\s*[^—–?]+\s+or\s+[^—–?]+\?$/, '?')
    .replace(/:\s*[^:?]+\s+or\s+[^:?]+\?$/, '?')
    .replace(/,\s*[^,?]+\s+or\s+[^,?]+\?$/, '?');
  if (cleaned !== q && cleaned.length > 20) return cleaned;

  // Try removing trailing " — X or Y?" → just "?"
  const match = q.match(/^(.+?)\s*[—–,]\s*[^—–,?]+\s+or\s+[^—–,?]+\?$/);
  if (match && match[1].length > 20) return match[1].trim() + '?';

  return null;
}

function rewriteOrQuestion(q, a) {
  // Remove the "— A or B" or "(A or B)" suffix
  const patterns = [
    /\s*[—–]\s*.+?\s+or\s+.+?\?$/,
    /\s*:\s*.+?\s+or\s+.+?\?$/,
    /\s*,\s*.+?\s+or\s+.+?\?$/,
    /\s*\(.+?\s+or\s+.+?\)\?$/,
  ];

  for (const pat of patterns) {
    const match = q.match(pat);
    if (match) {
      const cleaned = q.slice(0, q.length - match[0].length).trim() + '?';
      if (cleaned.length > 25 && !cleaned.toLowerCase().includes(a.toLowerCase())) {
        return cleaned;
      }
    }
  }

  // If question is just "Does X have A or B?" style
  // Try: "Does X have?" → won't work well. Skip these.
  return null;
}

function rewriteLocationQuestion(q, a) {
  // "In which city was Cologne perfume created?" - "Cologne" is both the city and in the Q
  // Can't easily fix without domain knowledge. Return null.
  return null;
}

/**
 * Handle word-level leaks — a key word from the answer appears in the question.
 */
function rewriteWordLevel(q, a, leakedWord) {
  const leakedLower = leakedWord.toLowerCase();
  const qLower = q.toLowerCase();
  const aLower = a.toLowerCase();

  // ── Strategy 1: "What is X?" definitional questions ──────────────────────
  // "What is allopatric speciation?" → "Geographically isolated populations that diverge into different species undergo what process?"
  // These are hard to fix generically. Use a more careful approach.

  // ── Strategy 2: "What type of X does/is Y?" ──────────────────────────────
  // "What type of transport moves substances against gradient?" → "Active transport" leaked word: transport
  // Rewrite: remove the leaked word from the question OR replace with "mechanism/process/phenomenon"
  const typePatterns = [
    { regex: /^What type of ([a-z]+) (.*)\?$/i, leaked: leakedLower },
    { regex: /^What kind of ([a-z]+) (.*)\?$/i, leaked: leakedLower },
  ];

  for (const { regex } of typePatterns) {
    const match = q.match(regex);
    if (match && match[1].toLowerCase() === leakedLower) {
      // "What type of [transport] [moves substances against]?" → "What [mechanism/process] [moves substances against]?"
      const replacement = getDomainReplacement(leakedLower);
      if (replacement) {
        return `What ${replacement} ${match[2]}?`;
      }
    }
  }

  // ── Strategy 3: Remove the leaked word if it's used as a descriptor ───────
  // "What is active transport?" where answer is "Active transport" → generic definitional question
  // "What is allosteric regulation?" → "What do you call a form of enzyme regulation where a molecule binds a non-active site?"
  if (/^what is .+\?$/i.test(q) || /^what are .+\?$/i.test(q)) {
    return rewriteDefinitionalQuestion(q, a, leakedWord);
  }

  // ── Strategy 4: Replace leaked word with pronoun/placeholder ─────────────
  // "How does allopatric speciation differ from sympatric?" →
  // "How does geographic-isolation speciation differ from speciation in the same area?"
  // Too complex for generic rules. Use generic replacement.

  // ── Strategy 5: Add "by name" or "what term" framing ────────────────────
  // "What type of enzyme regulation involves non-active-site binding?" → answer: "Allosteric regulation"
  // The leaked word is "regulation" — add "what is this type of regulation called?"
  // Not easily done generically.

  // ── Strategy 6: Question ends with leaked answer ─────────────────────────
  // Check if the question sets up a definition and answer IS what the question asks for by name
  const endsWithLeaked = qLower.endsWith(leakedLower + '?') || qLower.endsWith(leakedLower + 's?');
  if (endsWithLeaked) {
    // Remove the trailing leaked word from question stem
    const newQ = q.replace(new RegExp(`\\s*${escapeRegex(leakedWord)}s?\\?$`, 'i'), '?');
    if (newQ !== q && newQ.length > 20 && !newQ.toLowerCase().includes(aLower)) {
      return newQ;
    }
  }

  // ── Strategy 7: Question explicitly names the thing it asks about ─────────
  // "Which formula is used for X — [the formula] — is called what?"
  // Very domain-specific. Skip.

  return null;
}

function rewriteDefinitionalQuestion(q, a, leakedWord) {
  // "What is abiotic synthesis?" → rephrase to not name the term
  // Hard to do without domain knowledge. Return null for now.
  // These will go into the manual review pile.
  return null;
}

function getDomainReplacement(word) {
  const map = {
    'transport': 'mechanism',
    'regulation': 'process',
    'signaling': 'cellular communication process',
    'inhibition': 'mechanism',
    'synthesis': 'process',
    'reproduction': 'process',
    'fermentation': 'metabolic process',
    'respiration': 'metabolic process',
    'mutation': 'genetic change',
    'adaptation': 'evolutionary change',
    'evolution': 'process',
    'selection': 'mechanism',
    'speciation': 'process',
    'replication': 'process',
    'transcription': 'process',
    'translation': 'biological process',
    'digestion': 'process',
    'circulation': 'process',
    'interaction': 'relationship',
    'reaction': 'chemical process',
    'force': 'physical quantity',
    'motion': 'physical phenomenon',
    'energy': 'physical quantity',
    'wave': 'physical phenomenon',
    'field': 'physical concept',
    'circuit': 'electrical arrangement',
    'current': 'electrical quantity',
    'bond': 'chemical link',
    'compound': 'chemical substance',
    'element': 'substance',
    'mixture': 'combination',
    'solution': 'liquid mixture',
    'acid': 'chemical substance',
    'base': 'chemical substance',
    'behavior': 'action',
    'disorder': 'condition',
    'disease': 'medical condition',
    'therapy': 'treatment',
    'treatment': 'intervention',
    'surgery': 'medical procedure',
    'government': 'political system',
    'democracy': 'governing system',
    'policy': 'rule',
    'law': 'rule',
    'economy': 'economic system',
    'market': 'economic structure',
    'trade': 'economic activity',
    'language': 'tongue',
    'dialect': 'variety',
    'culture': 'tradition',
    'religion': 'belief system',
    'philosophy': 'school of thought',
    'theory': 'explanatory framework',
    'hypothesis': 'proposed explanation',
    'experiment': 'scientific test',
    'observation': 'scientific finding',
    'data': 'information',
    'variable': 'factor',
    'equation': 'mathematical expression',
    'formula': 'mathematical expression',
    'algorithm': 'computational procedure',
    'program': 'software',
    'function': 'mathematical concept',
    'structure': 'arrangement',
    'system': 'arrangement',
    'process': 'sequence of steps',
    'technique': 'method',
    'method': 'approach',
    'strategy': 'approach',
    'skill': 'ability',
    'tool': 'instrument',
    'device': 'instrument',
    'instrument': 'tool',
    'machine': 'device',
    'technology': 'tool',
    'material': 'substance',
    'resource': 'supply',
    'property': 'characteristic',
    'characteristic': 'feature',
    'feature': 'attribute',
    'quality': 'characteristic',
    'quantity': 'amount',
    'measure': 'quantity',
    'unit': 'measurement',
    'scale': 'measurement system',
    'range': 'span',
    'limit': 'boundary',
    'boundary': 'limit',
    'region': 'area',
    'zone': 'area',
    'area': 'region',
    'location': 'place',
    'position': 'location',
    'direction': 'orientation',
    'movement': 'motion',
    'change': 'transformation',
    'transformation': 'change',
    'growth': 'increase',
    'decline': 'decrease',
    'increase': 'growth',
    'decrease': 'reduction',
    'relationship': 'connection',
    'connection': 'link',
    'link': 'connection',
    'bond': 'connection',
    'network': 'system of connections',
    'cycle': 'recurring process',
    'pattern': 'recurring arrangement',
    'trend': 'directional change',
    'cause': 'reason',
    'effect': 'result',
    'result': 'outcome',
    'outcome': 'result',
    'impact': 'effect',
    'influence': 'effect',
    'factor': 'element',
    'component': 'part',
    'part': 'component',
    'element': 'component',
    'unit': 'component',
    'group': 'collection',
    'category': 'classification',
    'class': 'category',
    'type': 'variety',
    'form': 'type',
    'kind': 'type',
    'variety': 'type',
    'example': 'instance',
    'instance': 'example',
    'case': 'example',
    'event': 'occurrence',
    'occurrence': 'event',
    'phenomenon': 'observable event',
    'concept': 'idea',
    'idea': 'concept',
    'principle': 'fundamental rule',
    'rule': 'principle',
    'guideline': 'recommendation',
    'standard': 'benchmark',
    'norm': 'standard',
    'value': 'quantity',
    'score': 'rating',
    'rating': 'score',
    'rank': 'position',
    'level': 'degree',
    'degree': 'level',
    'stage': 'phase',
    'phase': 'stage',
    'step': 'stage',
    'sequence': 'order of steps',
    'order': 'sequence',
    'arrangement': 'organization',
    'organization': 'arrangement',
    'structure': 'organization',
    'format': 'arrangement',
    'shape': 'form',
    'size': 'dimension',
    'dimension': 'measurement',
    'volume': 'amount',
    'mass': 'quantity of matter',
    'weight': 'force due to gravity',
    'temperature': 'heat level',
    'pressure': 'force per area',
    'speed': 'rate of motion',
    'velocity': 'speed with direction',
    'acceleration': 'rate of velocity change',
    'frequency': 'rate of occurrence',
    'period': 'time between repetitions',
    'amplitude': 'maximum displacement',
    'wavelength': 'distance between wave peaks',
    'intensity': 'strength',
    'strength': 'intensity',
    'concentration': 'amount per volume',
    'density': 'mass per volume',
    'capacity': 'maximum amount',
    'efficiency': 'ratio of output to input',
    'ratio': 'proportional relationship',
    'proportion': 'ratio',
    'percentage': 'fraction of 100',
    'fraction': 'part of a whole',
    'probability': 'likelihood',
    'likelihood': 'probability',
    'chance': 'probability',
    'risk': 'probability of harm',
    'rate': 'frequency',
    'time': 'duration',
    'duration': 'time span',
    'distance': 'length',
    'length': 'distance',
    'height': 'vertical distance',
    'width': 'horizontal distance',
    'depth': 'downward distance',
    'angle': 'geometric measure',
    'surface': 'outer layer',
    'layer': 'stratum',
    'level': 'layer',
    'floor': 'level',
  };
  return map[word.toLowerCase()] || null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Pattern-specific aggressive rewrites ─────────────────────────────────────

/**
 * More aggressive rewrite strategies for common question structures.
 */
function aggressiveRewrite(q, a, leakedWord, flagType) {
  const qLower = q.toLowerCase();
  const aLower = a.toLowerCase();
  const leaked = leakedWord ? leakedWord.toLowerCase() : null;

  if (flagType === 'verbatim') {
    return aggressiveVerbatim(q, a);
  }

  // Word level aggressive strategies
  if (!leaked) return null;

  // ── "What type of X" → "What is the [domain term] for..."  ──────────────
  const typeOfMatch = q.match(/^(What type of|What kind of|What form of)\s+(\w+)\s+(.+)\?$/i);
  if (typeOfMatch && typeOfMatch[2].toLowerCase() === leaked) {
    const context = typeOfMatch[3];
    const repl = getDomainReplacement(leaked);
    if (repl) {
      return `What ${repl} ${context}?`;
    }
    return `What is the term for a ${context}?`;
  }

  // ── Definitional "What is X?" where X is the leaked word ────────────────
  const whatIsMatch = q.match(/^What (is|are)\s+(\w[\w\s]*?)\s*(\band\b.+)?\?$/i);
  if (whatIsMatch) {
    const subject = whatIsMatch[2].toLowerCase();
    if (subject.includes(leaked) || subject === leaked) {
      // "What is allosteric regulation?" → skip (needs domain knowledge)
      // But if there's trailing context like "and how does it X", we can use that
      if (whatIsMatch[3]) {
        // Has "and X" clause - rewrite using that clause
        const andClause = whatIsMatch[3].trim();
        return `How does this work — ${andClause}?`.replace(/^How does this work — and /i, 'What ');
      }
    }
  }

  // ── "How does X differ from Y?" where X is the leaked word ──────────────
  const howDiffer = q.match(/^How does (\w[\w\s]*?) differ from (.+)\?$/i);
  if (howDiffer) {
    const subject = howDiffer[1].toLowerCase();
    if (subject.includes(leaked)) {
      const other = howDiffer[2];
      return `How does the process of geographic isolation in speciation differ from what occurs in ${other}?`;
    }
  }

  // ── "Which X is/does/has..." where the leaked word is in the question ────
  // E.g. "Which type of speciation involves..." leaked word "speciation" in answer
  // Just removing the type from "which type of X" → "which process"
  const whichTypeOf = q.match(/^Which (type|kind|form) of (\w+)\s(.+)\?$/i);
  if (whichTypeOf && whichTypeOf[2].toLowerCase() === leaked) {
    const context = whichTypeOf[3];
    const repl = getDomainReplacement(leaked) || 'process';
    return `Which ${repl} ${context}?`;
  }

  // ── Replace leaked word in middle of question ────────────────────────────
  // Only if it appears exactly once and we have a good replacement
  const occurrences = (qLower.split(leaked).length - 1);
  if (occurrences === 1) {
    const repl = getDomainReplacement(leaked);
    if (repl) {
      // Check if replacement removes the leak
      const newQ = q.replace(new RegExp(`\\b${escapeRegex(leakedWord)}\\b`, 'i'), repl);
      if (!newQ.toLowerCase().includes(aLower) && newQ !== q) {
        return newQ;
      }
    }
  }

  return null;
}

function aggressiveVerbatim(q, a) {
  const aLower = a.toLowerCase().trim();
  const qLower = q.toLowerCase();

  // Common pattern: binary choice "X or Y?" where answer is one of them
  // Strategy: rewrite to remove the answer options entirely
  // "Does English have more native speakers or more second-language speakers?"
  // → "Does English have more native speakers, or does the opposite hold?"
  // Too hard to make generic. Use suffix-removal approach.

  // Pattern: question with "— A or B?" at end
  const dashOrMatch = q.match(/^(.+?)\s*[—–]\s*(.+?)\s+or\s+(.+?)\?$/);
  if (dashOrMatch) {
    const stem = dashOrMatch[1].trim();
    const optA = dashOrMatch[2].trim().toLowerCase();
    const optB = dashOrMatch[3].trim().toLowerCase();
    if (aLower === optA || aLower.startsWith(optA) || optA.startsWith(aLower)) {
      // Answer is option A - rephrase to ask about option A's defining characteristics
      if (stem.length > 20) return stem + '?';
    }
    if (aLower === optB || aLower.startsWith(optB) || optB.startsWith(aLower)) {
      if (stem.length > 20) return stem + '?';
    }
  }

  // Pattern: "X or Y?" simple ending
  const simpleOrMatch = q.match(/^(.+?)\s*:\s*(.+?)\s+or\s+(.+?)\?$/);
  if (simpleOrMatch) {
    const stem = simpleOrMatch[1].trim();
    if (stem.length > 20) return stem + '?';
  }

  // Pattern: question where "which" or "what" introduces the answer
  // e.g. "Which fish was at the centre of the Turbot War?" → answer is "Turbot"
  // This is a genuine self-answering issue: "Turbot" in "Turbot War"
  // Rephrase: "What aquatic creature was at the centre of the 1995 fishing dispute between Canada and Spain?"
  // Too domain-specific to automate.

  return null;
}

// ─── Main processing ──────────────────────────────────────────────────────────

const FLAGGED_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-self-answering.json');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-fixes.json');
const SKIPPED_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-skipped.json');

if (!fs.existsSync(FLAGGED_PATH)) {
  console.error(`Missing: ${FLAGGED_PATH}`);
  console.error('Run the detection script first.');
  process.exit(1);
}

const flagged = JSON.parse(fs.readFileSync(FLAGGED_PATH, 'utf-8'));
const subset = flagged.slice(START_IDX, START_IDX + COUNT);

console.log(`Processing ${subset.length} of ${flagged.length} flagged facts`);
console.log('');

const fixes = [];
const skipped = [];

for (const item of subset) {
  const { id, q, a, leakedWord, type: flagType } = item;

  // Try simple rewrite first
  let newQ = tryRewrite(q, a, leakedWord, flagType);

  // If simple didn't work, try aggressive
  if (!newQ) {
    newQ = aggressiveRewrite(q, a, leakedWord, flagType);
  }

  // Verify the rewrite actually fixed the problem
  if (newQ) {
    const nqLower = newQ.toLowerCase();
    const aLower = a.toLowerCase();

    // Check verbatim still leaks
    if (aLower.length > 5 && nqLower.includes(aLower)) {
      newQ = null;
    }

    // Check word-level still leaks
    if (newQ && leakedWord) {
      const leaked = leakedWord.toLowerCase();
      const nqWords = new Set(nqLower.split(/[\s\-\/,.:;!?'"()\[\]{}]+/));
      const aWords = aLower.split(/[\s\-\/]+/).filter(w => w.length >= 4 && !STOPWORDS.has(w));
      let stillLeaks = false;
      for (const w of aWords) {
        if (nqWords.has(w)) { stillLeaks = true; break; }
      }
      if (stillLeaks) newQ = null;
    }
  }

  if (newQ && newQ !== q) {
    fixes.push({
      id,
      field: 'quiz_question',
      old: q,
      new: newQ,
    });
  } else {
    skipped.push({ id, q, a, leakedWord, flagType, reason: newQ ? 'still_leaks' : 'no_pattern' });
  }
}

console.log(`Fixes generated: ${fixes.length}`);
console.log(`Skipped (need manual): ${skipped.length}`);
console.log('');

// Write outputs
if (!DRY_RUN || fixes.length > 0) {
  // Merge with existing fixes if file exists
  let existingFixes = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    existingFixes = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    const existingIds = new Set(existingFixes.map(f => f.id));
    const newOnly = fixes.filter(f => !existingIds.has(f.id));
    existingFixes = [...existingFixes, ...newOnly];
    console.log(`Merged with ${existingFixes.length - newOnly.length} existing fixes`);
  } else {
    existingFixes = fixes;
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(existingFixes, null, 2));
  console.log(`Wrote ${existingFixes.length} total fixes to ${OUTPUT_PATH}`);
}

fs.writeFileSync(SKIPPED_PATH, JSON.stringify(skipped, null, 2));
console.log(`Wrote ${skipped.length} skipped items to ${SKIPPED_PATH}`);

// Preview first few fixes
if (fixes.length > 0) {
  console.log('\n--- SAMPLE FIXES ---');
  for (const f of fixes.slice(0, 5)) {
    console.log(`ID: ${f.id}`);
    console.log(`OLD: ${f.old}`);
    console.log(`NEW: ${f.new}`);
    console.log();
  }
}

if (skipped.length > 0) {
  console.log('\n--- SAMPLE SKIPPED ---');
  for (const s of skipped.slice(0, 3)) {
    console.log(`ID: ${s.id}`);
    console.log(`Q: ${s.q}`);
    console.log(`A: ${s.a}`);
    console.log(`Reason: ${s.reason}`);
    console.log();
  }
}
