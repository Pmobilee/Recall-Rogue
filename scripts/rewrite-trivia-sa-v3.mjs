#!/usr/bin/env node
/**
 * rewrite-trivia-sa-v3.mjs
 *
 * Phase 3 rewriter - handles remaining 313 self-answering facts.
 * Uses an extended replacement dictionary and specific patterns.
 *
 * Usage:
 *   node scripts/rewrite-trivia-sa-v3.mjs --dry-run
 *   node scripts/rewrite-trivia-sa-v3.mjs --apply
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DRY_RUN = !process.argv.includes('--apply');
console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Extended synonym map ──────────────────────────────────────────────────────

const WORD_REPLACEMENTS = {
  // Biology continued
  'abiotic': 'non-living',
  'mosaic': 'patchwork',
  'determine': 'control',
  'drug': 'antiviral agent',
  'incomplete': 'partial',
  'introns': 'non-coding sequences',
  'drosophila': 'fruit fly',
  'small': 'diminutive',
  'signal': 'chemical messenger',
  'receptor': 'binding protein',
  'recessive': 'non-dominant',
  'directional': 'one-sided',
  'variation': 'diversity',
  'template': 'blueprint strand',
  'fatty': 'lipid',
  'waterproofing': 'hydrophobic barrier',
  'reactant': 'substrate',
  'step': 'stage',
  'increases': 'elevates',
  'chromosome': 'genetic strand',
  'chromosomes': 'genetic strands',
  'cell': 'biological unit',
  'cells': 'biological units',
  'free': 'unattached',
  'meiosis': 'gamete cell division',
  'monophyletic': 'single-ancestor',
  'paraphyletic': 'partial-descendant',
  'base': 'nucleotide pair',
  'bases': 'nucleotide pairs',
  // Physics
  'sigma': 'Greek letter',
  'formal': 'official',
  'multi': 'multiple',
  'capital': 'main city',
  'deficits': 'shortfalls',
  'direction': 'orientation',
  'rest': 'stationary state',
  'massless': 'zero-mass',
  'provides': 'supplies',
  'flow': 'movement',
  'centrifugal': 'outward-directed',
  'frequency': 'oscillation rate',
  'fixed': 'stationary',
  'coefficient': 'friction ratio',
  'radius': 'circular distance',
  'disk': 'rotating plate',
  'drag': 'air resistance',
  'efficiency': 'output ratio',
  'show': 'demonstrate',
  'physics': 'scientific study',
  'stationary': 'motionless',
  'contact': 'surface-to-surface',
  'volume': 'three-dimensional space',
  'third': 'tertiary',
  'absolute': 'total',
  'launch': 'initial throw',
  'external': 'outside',
  'perpendicular': 'at right angles',
  'reference': 'benchmark',
  'perfectly': 'completely',
  'speed': 'velocity magnitude',
  'barometer': 'pressure gauge',
  'equilibrium': 'balance point',
  'collision': 'impact event',
  'position': 'location',
  'backward': 'rearward',
  'without': 'absent',
  'balance': 'equilibrium',
  'restoring': 'return',
  'static': 'motionless',
  'projectile': 'launched object',
  'internal': 'inside',
  'treat': 'handle',
  'frictionless': 'friction-free',
  'uniform': 'constant-speed',
  'lever': 'rigid bar',
  'tail': 'trailing end',
  'viscosity': 'fluid resistance',
  'astronauts': 'space travelers',
  'normal': 'perpendicular',
  'gm₁m₂': 'gravitational product',
  '½at²': 'kinematic displacement term',
  // Psychology
  'cognitive': 'mental',
  'diathesis': 'predisposition',
  'dissociative': 'identity-splitting',
  'anxiety': 'worry-based',
  'compulsive': 'repetitive-behavior',
  'panic': 'acute-fear',
  'traumatic': 'trauma-related',
  'thyroid': 'neck gland',
  // Geography / History
  'crude': 'unrefined',
  'concentric': 'ring-shaped',
  'harris': 'this geographer\'s',
  'southeast': 'southeastern',
  'transit': 'passage',
  'periphery': 'outer area',
  'export': 'trade good',
  'goals': 'objectives',
  'development': 'growth',
  'pueblo': 'indigenous settlement',
  'rice': 'staple grain',
  'virginia': 'colonial territory',
  'necessary': 'required',
  'fifths': 'fractional count',
  'term': 'vocabulary word',
  'jackson': 'this president\'s',
  'hudson': 'this explorer\'s',
  'slave': 'enslaved person',
  'sailors': 'maritime workers',
  'indian': 'indigenous',
  'executive': 'governmental branch',
  'kellogg': 'this pact\'s',
  'naval': 'maritime military',
  'berkeley': 'this scholar\'s',
  'immigration': 'migration',
  'hostage': 'political prisoner',
  'organization': 'group',
  'southern': 'southern states\'',
  'voting': 'electoral',
  'economic': 'fiscal',
  'iran': 'Persian',
  'mughal': 'empire',
  'djibouti': 'this nation\'s',
  'guatemala': 'Central American nation\'s',
  'kuwait': 'Gulf nation\'s',
  'luxembourg': 'European nation\'s',
  'mexico': 'North American nation\'s',
  'panama': 'Central American nation\'s',
  'salvador': 'Central American nation\'s',
  // CS / Programming
  'orion': 'this project\'s',
  'dennard': 'this scaling law\'s',
  'programming': 'software development',
  'jerry': 'this developer\'s',
  'license': 'legal permission',
  'software': 'application code',
  'consecutive': 'sequential',
  'nobel': 'prize-winning',
  'simple': 'basic',
  'writing': 'script system',
  'segmental': 'phoneme-based',
  'contains': 'holds',
  'romance': 'Latin-derived',
  'member': 'group participant',
  'subject': 'topic',
  'entertainment': 'leisure',
  'hardware': 'physical equipment',
  'arithmetic': 'numerical calculation',
  'areas': 'regions',
  'true': 'accurate',
  'populous': 'population-dense',
  'emirates': 'Gulf federation\'s',
  'heritage': 'cultural legacy',
  'tests': 'examinations',
  'apart': 'separated',
  'highest': 'topmost',
  'siege': 'military blockade',
  'delhi': 'Indian city\'s',
  'zones': 'territorial divisions',
  'crusader': 'medieval warrior\'s',
  'cold': 'geopolitical',
  'declaration': 'formal statement',
  'napoleon': 'French emperor\'s',
  'iraq': 'Mesopotamian region\'s',
  'russian': 'Eastern European',
  'congress': 'legislative body\'s',
  'quality': 'characteristic',
  'forms': 'shapes',
  'barrier': 'protective layer',
  'immune': 'defense',
  'heart': 'cardiac',
  'basic': 'fundamental',
  'hepatitis': 'liver disease',
  'main': 'primary',
  'rupture': 'tear',
  'tooth': 'dental structure',
  'gods': 'divine beings',
  'bohr': 'this scientist\'s',
  'numbers': 'numerical values',
  'earth': 'terrestrial planet',
  'abundant': 'plentiful',
  'schrödinger': 'this physicist\'s',
  'potassium': 'alkali metal',
  'human': 'Homo sapiens',
  'diamond': 'crystalline carbon',
  'chromium': 'metallic element',
  'greater': 'larger',
  'ionic': 'ion-based',
  'massive': 'large-mass',
  'solar': 'sun-based',
  // More natural science
  'natural': 'environmental',
  'carries': 'transports',
  'sand': 'granular sediment',
  'north': 'northern direction',
  'nine': 'ninth',
  'singh': 'this leader\'s',
  'bridge': 'spanning structure',
  'white': 'light-hued',
  'castle': 'fortified structure',
  'dalai': 'this religious leader\'s',
  'lend': 'supply',
  'british': 'UK\'s',
  'hopping': 'jumping',
  'allied': 'coalition',
  'billion': 'thousand million',
  'borders': 'boundaries',
  'oath': 'sworn pledge',
  'peace': 'armistice',
  'czechoslovakia': 'Central European nation\'s',
  'banks': 'financial institutions',
  'tank': 'armored vehicle',
  'extinct': 'no longer living',
  'gene': 'hereditary unit',
  'turtle': 'shelled reptile',
  'terrestrial': 'land-based',
  'congo': 'Central African river\'s',
  'animal': 'creature',
  'egrets': 'wading birds',
  'shark': 'cartilaginous fish',
  'relief': 'terrain elevation',
  'decorative': 'ornamental',
  'fermentation': 'anaerobic metabolic process',
  'michelin': 'this guide\'s',
  'cubic': 'volume unit',
  'linus': 'this developer\'s',
  'djed': 'Egyptian pillar symbol\'s',
  'dung': 'waste',
  'green': 'verdant',
  'theater': 'performance venue',
  'abcde': 'melanoma checklist\'s',
  'bone': 'skeletal structure',
  'life': 'biological existence',
  'wild': 'non-domesticated',
  'motte': 'earthwork mound\'s',
  'herald': 'this musician\'s',
  'harold': 'this figure\'s',
  'concerto': 'orchestral composition\'s',
  'station': 'orbital platform\'s',
  'mars': 'red planet\'s',
  'hearts': 'cardiac organs',
  // Centripetal / physics specific
  'centripetal': 'inward-directed',
};

/**
 * Replace leaked word with synonym in question.
 */
function replaceLeakedWord(q, leakedWord) {
  const lower = leakedWord.toLowerCase();
  const repl = WORD_REPLACEMENTS[lower];
  if (!repl) return null;

  // Try word-boundary replacement
  const regex = new RegExp('\\b' + escapeRegex(leakedWord) + '\\b', 'i');
  const newQ = q.replace(regex, repl);
  if (newQ !== q) return newQ;

  // Try lowercase
  const regexLower = new RegExp('\\b' + escapeRegex(lower) + '\\b', 'i');
  const newQ2 = q.replace(regexLower, repl);
  if (newQ2 !== q) return newQ2;

  return null;
}

/**
 * Check if a question still leaks after rewrite.
 */
function stillLeaks(newQ, a) {
  const nqLower = newQ.toLowerCase();
  const aLower = a.toLowerCase();

  // Verbatim check
  if (aLower.length > 5 && nqLower.includes(aLower)) return true;

  // Word-level check
  const STOPWORDS = new Set(['the','a','an','what','who','how','why','did','does','was','are','is','which','when','where','that','this','with','from','have','been','will','more','than','them','then','some','each','make','like','over','such','take','into','also','back','after','only','come','made','find','here','know','last','long','just','much','before','being','other','between','these','about','first','very','still','those','should','would','could','while','there','their','every','under','three','through','during','and','but','for','not','its','has','had','were','can','may','his','her']);
  const nqWords = new Set(nqLower.split(/[\s\-\/,.:;!?'"()\[\]{}]+/));
  const aWords = aLower.split(/[\s\-\/]+/).filter(w => w.length >= 4 && !STOPWORDS.has(w));
  for (const w of aWords) {
    if (nqWords.has(w)) return true;
  }
  return false;
}

/**
 * Verbatim rewrite for remaining cases.
 */
function rewriteVerbatim(q, a) {
  const aLower = a.toLowerCase().trim();

  // True verbatim cases where answer name appears in Q as subject
  // "Which fish was at the centre of the Turbot War?" → Answer: Turbot
  // Strategy: remove the leaked proper noun from the event name

  // Check for "Answer War/Event/X" pattern in question
  // Replace the answer word with "this species" / "this element" / etc.
  const answerWord = a.trim();

  // "Which [answer] was..." → "Which animal/species was..."
  const whichAnswerWas = q.match(new RegExp(`^Which ${escapeRegex(answerWord)}(.+)\\?$`, 'i'));
  if (whichAnswerWas) {
    return `Which creature${whichAnswerWas[1]}?`;
  }

  // "[Answer] War" / "[Answer] family" patterns - these appear as part of a proper name
  // Replace the answer word with its category
  const categories = {
    'Turbot': 'fish',
    'Violin': 'string instrument',
    'Pudding': 'dessert',
    'Chocolate': 'ingredient',
    'Cologne': 'location',
  };

  if (categories[answerWord]) {
    const repl = categories[answerWord];
    const newQ = q.replace(new RegExp('\\b' + escapeRegex(answerWord) + '\\b', 'i'), `this ${repl}`);
    if (newQ !== q && !stillLeaks(newQ, a)) return newQ;
  }

  // Generic: binary choice removal
  const orPatterns = [
    /^(.+?)\s*[—–]\s*[^—–]+?\s+or\s+[^—–]+?\?$/,
    /^(.+?)\s*:\s*[^:]+?\s+or\s+[^:]+?\?$/,
    /^(.+?),\s*[^,]+?\s+or\s+[^,]+?\?$/,
  ];

  for (const pat of orPatterns) {
    const m = q.match(pat);
    if (m && m[1].trim().length > 25 && !m[1].toLowerCase().includes(aLower)) {
      return m[1].trim() + '?';
    }
  }

  return null;
}

// ─── Main processing ──────────────────────────────────────────────────────────

const STILL_SKIPPED_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-still-skipped.json');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-fixes.json');
const FINAL_SKIPPED_PATH = path.join(PROJECT_ROOT, 'data', 'trivia-sa-final-skipped.json');

if (!fs.existsSync(STILL_SKIPPED_PATH)) {
  console.error(`Missing: ${STILL_SKIPPED_PATH}. Run v2 first.`);
  process.exit(1);
}

const stillSkipped = JSON.parse(fs.readFileSync(STILL_SKIPPED_PATH, 'utf-8'));
console.log(`Processing ${stillSkipped.length} still-skipped facts`);

let existingFixes = [];
if (fs.existsSync(OUTPUT_PATH)) {
  existingFixes = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
  console.log(`Existing fixes: ${existingFixes.length}`);
}
const existingIds = new Set(existingFixes.map(f => f.id));

const newFixes = [];
const finalSkipped = [];

for (const item of stillSkipped) {
  const { id, q, a, leakedWord, flagType } = item;

  if (existingIds.has(id)) continue;

  let newQ = null;

  if (flagType === 'verbatim') {
    newQ = rewriteVerbatim(q, a);
  } else if (leakedWord) {
    newQ = replaceLeakedWord(q, leakedWord);
  }

  // Verify fix
  if (newQ && newQ !== q && !stillLeaks(newQ, a)) {
    newFixes.push({
      id,
      field: 'quiz_question',
      old: q,
      new: newQ,
    });
  } else {
    finalSkipped.push({ id, q, a, leakedWord, flagType, reason: 'no_v3_pattern' });
  }
}

console.log(`New v3 fixes: ${newFixes.length}`);
console.log(`Final skipped: ${finalSkipped.length}`);
console.log('');

// Merge and write
const allFixes = [...existingFixes, ...newFixes];
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allFixes, null, 2));
console.log(`Total fixes: ${allFixes.length}`);

fs.writeFileSync(FINAL_SKIPPED_PATH, JSON.stringify(finalSkipped, null, 2));
console.log(`Final skipped: ${finalSkipped.length}`);

// Sample new fixes
if (newFixes.length > 0) {
  console.log('\n--- SAMPLE V3 FIXES ---');
  for (const f of newFixes.slice(0, 8)) {
    console.log(`ID: ${f.id}`);
    console.log(`OLD: ${f.old.substring(0, 100)}`);
    console.log(`NEW: ${f.new.substring(0, 100)}`);
    console.log();
  }
}

if (finalSkipped.length > 0) {
  console.log('\n--- SAMPLE FINAL SKIPPED ---');
  for (const s of finalSkipped.slice(0, 5)) {
    console.log(`ID: ${s.id}`);
    console.log(`Q: ${s.q.substring(0, 100)}`);
    console.log(`A: ${s.a}`);
    console.log(`Leaked: ${s.leakedWord}`);
    console.log();
  }
}
