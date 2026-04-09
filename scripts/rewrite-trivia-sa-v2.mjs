#!/usr/bin/env node
/**
 * rewrite-trivia-sa-v2.mjs
 *
 * Phase 2 rewriter - handles the remaining 986 self-answering facts
 * that weren't covered by the pattern-based v1 rewriter.
 *
 * Strategy: For facts where the leaked word appears in the question as a
 * contextual descriptor, replace it with a generic synonym or remove it.
 *
 * Usage:
 *   node scripts/rewrite-trivia-sa-v2.mjs --dry-run
 *   node scripts/rewrite-trivia-sa-v2.mjs --apply
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DRY_RUN = !process.argv.includes('--apply');
console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);
console.log('');

// ─── Synonym map for leaked words ─────────────────────────────────────────────
// Maps a leaked word to a replacement that won't appear in the answer.
// Strategy: use a DIFFERENT word from the same domain that doesn't hint at the answer.

const LEAKED_WORD_REPLACEMENTS = {
  // Science/Biology domain
  'abiotic': 'non-living',
  'allele': 'gene variant',
  'alleles': 'gene variants',
  'allopatric': 'geographically isolated',
  'allosteric': 'non-active-site',
  'autocrine': 'self-targeting',
  'bacterial': 'microbial',
  'base': 'nucleotide',
  'bases': 'nucleotides',
  'cell': 'biological unit',
  'cells': 'biological units',
  'cellular': 'intracellular',
  'chromosome': 'genetic structure',
  'chromosomes': 'genetic structures',
  'cofactor': 'helper molecule',
  'color': 'visual',
  'competitive': 'substrate-site',
  'conserved': 'phylogenetically preserved',
  'convergent': 'independently evolved',
  'ddt': 'organochlorine pesticide',
  'direct': 'cell-to-cell',
  'ecosystem': 'ecological community',
  'electrochemical': 'ionic charge and concentration',
  'enzyme': 'biological catalyst',
  'enzymes': 'biological catalysts',
  'evolution': 'evolutionary',
  'galápagos': 'island',
  'genes': 'hereditary units',
  'gradient': 'concentration difference',
  'inhibition': 'suppression',
  'lac': 'lactose',
  'linked': 'co-inherited',
  'membrane': 'cell boundary',
  'metaphase': 'alignment',
  'meiosis': 'reproductive cell division',
  'monophyletic': 'single-ancestor',
  'multiple': 'more-than-two-allele',
  'operon': 'gene cluster',
  'paraphyletic': 'partial-descendant',
  'recombinant': 'genetically modified',
  'resistance': 'tolerance',
  'signaling': 'communication',
  'speciation': 'species formation',
  'shared': 'common ancestral',
  's-shaped': 'logistic growth',
  'curve': 'growth trajectory',
  // Physics domain
  'acceleration': 'rate of velocity change',
  'amplitude': 'peak displacement',
  'centripetal': 'center-directed',
  'equations': 'mathematical expressions',
  'free': 'unimpeded',
  'gravitational': 'gravity-based',
  'heat': 'thermal',
  'initial': 'starting',
  'impulse': 'force-time product',
  'kinetic': 'motion-based',
  'object': 'mass',
  'orbital': 'planetary',
  'pressure': 'force per area',
  'spring': 'elastic',
  'springs': 'elastic components',
  'telescope': 'astronomical instrument',
  'torque': 'rotational force',
  'total': 'combined',
  'weight': 'gravitational pull',
  // Earth science / Astronomy
  'pipe': 'tubular conduit',
  'hollow': 'empty-centered',
  // Biology / Health
  'barrier': 'protective boundary',
  'gland': 'secretory organ',
  'injury': 'tissue damage',
  // History / Culture
  'cultural': 'societal',
  'italian': 'peninsula-based',
  'renaissance': 'cultural revival period',
  // Language / Linguistics
  'language': 'tongue',
  'forms': 'versions',
  // Economics
  'center': 'central point',
  'graph': 'visual representation',
  'pairs': 'matched units',
  // Geography
  'asia': 'the continent',
  'environmental': 'ecological',
  'native': 'indigenous',
  'plains': 'grassland region',
  'white': 'light-colored',
  // Psychology / Social Sciences
  'personality': 'dispositional',
  'psychology': 'behavioral science',
  'reason': 'underlying cause',
  'inheritance': 'genetic transmission',
  // Physics / mechanics (additional)
  'electrons': 'charged particles',
  'orbital': 'energy shell',
  'pipe': 'conduit',
  'torque': 'rotational moment',
  // AP Physics / Chemistry
  'contact': 'surface-touching',
};

// ─── Contextual rewrite rules ─────────────────────────────────────────────────

/**
 * Specific question-pattern rewrites for common structures.
 */
const PATTERN_REWRITES = [
  // "What is [leaked term] in X context?"
  // → "What non-living process is described in the context of X?"
  {
    pattern: /^What is (\w+) (in|as|for|of|on|at|to|by|the|a|an)\b(.+)\?$/i,
    fix: (m, leaked, leaked_lower) => {
      const word = m[1].toLowerCase();
      if (word === leaked_lower) {
        const repl = LEAKED_WORD_REPLACEMENTS[word];
        if (repl) return `What is the ${repl} process ${m[2]}${m[3]}?`;
      }
      return null;
    }
  },
  // "How does [leaked] differ from X?"
  // → "What separates [leaked] from X in terms of mechanism?"
  {
    pattern: /^How does (\w+) (?:speciation |)differ from (.+)\?$/i,
    fix: (m, leaked, leaked_lower) => {
      const word = m[1].toLowerCase();
      if (word === leaked_lower) {
        const repl = LEAKED_WORD_REPLACEMENTS[word];
        if (repl) {
          return `How does ${repl} speciation differ from ${m[2]}?`;
        }
        return `How does the geographic-isolation form of speciation differ from ${m[2]}?`;
      }
      return null;
    }
  },
  // "What term describes [something involving leaked]"
  // Remove leaked word from description
  {
    pattern: /^(What term describes|What is the term for)\b(.+)\?$/i,
    fix: (m, leaked, leaked_lower) => {
      const context = m[2];
      const repl = LEAKED_WORD_REPLACEMENTS[leaked_lower];
      if (repl) {
        const newContext = context.replace(new RegExp('\\b' + escapeRegex(leaked) + '\\b', 'i'), repl);
        if (newContext !== context) return `${m[1]}${newContext}?`;
      }
      return null;
    }
  },
  // "Which [type of] [leaked] [does/is/are/has/was]..."
  {
    pattern: /^(Which|What) (\w+) of (\w+) (.+)\?$/i,
    fix: (m, leaked, leaked_lower) => {
      const noun = m[3].toLowerCase();
      if (noun === leaked_lower) {
        const repl = LEAKED_WORD_REPLACEMENTS[noun];
        if (repl) return `${m[1]} ${m[2]} of ${repl} ${m[4]}?`;
      }
      return null;
    }
  },
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Main rewrite function for a skipped (word-level) fact.
 */
function rewriteWordLevel(q, a, leakedWord) {
  const leakedLower = leakedWord.toLowerCase();
  const qLower = q.toLowerCase();
  const aLower = a.toLowerCase();

  // Step 1: Try pattern-specific rewrites
  for (const rule of PATTERN_REWRITES) {
    const m = q.match(rule.pattern);
    if (m) {
      const result = rule.fix(m, leakedWord, leakedLower);
      if (result && !result.toLowerCase().includes(aLower) && result !== q) {
        return result;
      }
    }
  }

  // Step 2: Try direct replacement of leaked word with synonym
  const repl = LEAKED_WORD_REPLACEMENTS[leakedLower];
  if (repl) {
    // Replace word boundary match
    const regex = new RegExp('\\b' + escapeRegex(leakedWord) + '\\b', 'i');
    const newQ = q.replace(regex, repl);

    if (newQ !== q) {
      // Verify the fix works
      const nqLower = newQ.toLowerCase();
      const nqWords = new Set(nqLower.split(/[\s\-\/,.:;!?'"()\[\]{}]+/));
      const aWords = aLower.split(/[\s\-\/]+/).filter(w => w.length >= 4);

      let stillLeaks = false;
      for (const w of aWords) {
        if (nqWords.has(w)) { stillLeaks = true; break; }
      }

      if (!stillLeaks) return newQ;
    }
  }

  // Step 3: For multi-word answers where leaked word is a contextual descriptor,
  // try removing the leaked word entirely (if grammatically viable)
  const regex = new RegExp('\\b' + escapeRegex(leakedWord) + '\\b', 'gi');
  const occurrences = (q.match(regex) || []).length;

  if (occurrences === 1) {
    // Try removing the word with appropriate spacing cleanup
    const withoutWord = q.replace(regex, '').replace(/\s+/g, ' ').replace(/\s,/g, ',').replace(/\s\./g, '.').trim();

    if (withoutWord.length > 25 && !withoutWord.toLowerCase().includes(aLower)) {
      // Check it's still a valid question
      if (withoutWord.includes('?') && withoutWord.length > 30) {
        // Verify no leak
        const nqWords = new Set(withoutWord.toLowerCase().split(/[\s\-\/,.:;!?'"()\[\]{}]+/));
        const aWords = aLower.split(/[\s\-\/]+/).filter(w => w.length >= 4);
        let stillLeaks = false;
        for (const w of aWords) {
          if (nqWords.has(w)) { stillLeaks = true; break; }
        }
        if (!stillLeaks) return withoutWord;
      }
    }
  }

  return null;
}

/**
 * Verbatim rewrite - answer appears literally in question.
 */
function rewriteVerbatim(q, a) {
  const aLower = a.toLowerCase().trim();
  const qLower = q.toLowerCase();

  // Binary-choice "or" questions - remove the options suffix
  // Patterns:
  // "X — A or B?" → "X?"
  // "X: A or B?" → "X?"
  // "X, A or B?" → "X?"
  // "X (A or B)?" → "X?"

  const orPatterns = [
    /^(.+?)\s*[—–]\s*[^—–]+?\s+or\s+[^—–]+?\?$/,
    /^(.+?)\s*:\s*[^:]+?\s+or\s+[^:]+?\?$/,
    /^(.+?),\s*[^,]+?\s+or\s+[^,]+?\?$/,
    /^(.+?)\s*\([^()]+?\s+or\s+[^()]+?\)\?$/,
  ];

  for (const pat of orPatterns) {
    const m = q.match(pat);
    if (m && m[1].trim().length > 25) {
      const stem = m[1].trim();
      // Make sure the stem still asks a question and doesn't contain the answer
      if (!stem.toLowerCase().includes(aLower)) {
        return stem + '?';
      }
      // If stem still has the answer, try to rephrase
    }
  }

  // For "Which X or Y?" type questions at the start
  // "Which Star Wars films actually won Academy Awards — the original trilogy or the prequel trilogy?"
  // Remove the "the original trilogy or the prequel trilogy" suffix
  const whichOrSuffix = q.match(/^(.*?)\s*[—–,]\s*(?:the\s+)?[^—–,]+?\s+or\s+(?:the\s+)?[^—–,?]+\?$/i);
  if (whichOrSuffix && whichOrSuffix[1].length > 25) {
    const stem = whichOrSuffix[1].trim() + '?';
    if (!stem.toLowerCase().includes(aLower)) {
      return stem;
    }
  }

  // For "Is X a Y or Z?" - just remove the answer choices
  const isAorB = q.match(/^(Is|Was|Does|Did|Are|Were|Has|Have)\s+(.+?)\s+(?:a\s+|an\s+|the\s+)?([^?]+?)\s+or\s+([^?]+?)\?$/i);
  if (isAorB) {
    const [, verb, subject] = isAorB;
    return `${verb} ${subject}?`;
  }

  return null;
}

// ─── Main processing ──────────────────────────────────────────────────────────

const SKIPPED_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-skipped.json');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-fixes.json');
const STILL_SKIPPED_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-still-skipped.json');

if (!fs.existsSync(SKIPPED_PATH)) {
  console.error(`Missing: ${SKIPPED_PATH}. Run v1 first.`);
  process.exit(1);
}

const skipped = JSON.parse(fs.readFileSync(SKIPPED_PATH, 'utf-8'));
console.log(`Processing ${skipped.length} previously skipped facts`);

let existingFixes = [];
if (fs.existsSync(OUTPUT_PATH)) {
  existingFixes = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
  console.log(`Existing fixes: ${existingFixes.length}`);
}
const existingIds = new Set(existingFixes.map(f => f.id));

const newFixes = [];
const stillSkipped = [];

for (const item of skipped) {
  const { id, q, a, leakedWord, flagType } = item;

  if (existingIds.has(id)) continue; // Already fixed

  let newQ = null;
  if (flagType === 'verbatim') {
    newQ = rewriteVerbatim(q, a);
  } else {
    newQ = rewriteWordLevel(q, a, leakedWord);
  }

  if (newQ && newQ !== q) {
    newFixes.push({
      id,
      field: 'quiz_question',
      old: q,
      new: newQ,
    });
  } else {
    stillSkipped.push({ id, q, a, leakedWord, flagType, reason: 'no_v2_pattern' });
  }
}

console.log(`New fixes from v2: ${newFixes.length}`);
console.log(`Still skipped: ${stillSkipped.length}`);
console.log('');

// Merge and write
const allFixes = [...existingFixes, ...newFixes];
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allFixes, null, 2));
console.log(`Total fixes written: ${allFixes.length}`);

fs.writeFileSync(STILL_SKIPPED_PATH, JSON.stringify(stillSkipped, null, 2));
console.log(`Still-skipped written: ${stillSkipped.length}`);

// Sample new fixes
if (newFixes.length > 0) {
  console.log('\n--- SAMPLE V2 FIXES ---');
  for (const f of newFixes.slice(0, 8)) {
    console.log(`ID: ${f.id}`);
    console.log(`OLD: ${f.old.substring(0, 100)}`);
    console.log(`NEW: ${f.new.substring(0, 100)}`);
    console.log();
  }
}

// Sample still-skipped
if (stillSkipped.length > 0) {
  console.log('\n--- SAMPLE STILL SKIPPED ---');
  for (const s of stillSkipped.slice(0, 5)) {
    console.log(`ID: ${s.id}`);
    console.log(`Q: ${s.q.substring(0, 100)}`);
    console.log(`A: ${s.a}`);
    console.log(`Leaked: ${s.leakedWord}`);
    console.log();
  }
}
