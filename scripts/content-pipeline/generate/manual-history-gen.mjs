#!/usr/bin/env node
/**
 * Manual history fact generator for Recall Rogue.
 * Reads raw Wikidata history entries and generates quiz facts
 * using template logic and domain knowledge (no LLM API calls).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

const RAW_PATH = path.join(root, 'data/raw/history.json');
const OUT_PATH = path.join(root, 'data/generated/history.jsonl');
const PROGRESS_PATH = path.join(root, 'data/generated/qa-reports/manual-progress-history.json');
const ERRORS_PATH = path.join(root, 'data/generated/errors-history-manual.json');

// ── helpers ──

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

function extractYear(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/(-?\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function extractYearFromDesc(desc) {
  if (!desc) return null;
  const m = desc.match(/\b(\d{3,4})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function centuryOf(year) {
  if (year < 0) {
    const c = Math.ceil(Math.abs(year) / 100);
    return `${c}${ordSuffix(c)} century BCE`;
  }
  const c = Math.ceil(year / 100);
  return `${c}${ordSuffix(c)} century`;
}

function ordSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function nearbyYears(year, count = 3) {
  const offsets = [-2, -1, 1, 2, -3, 3, -5, 5, -10, 10];
  const out = [];
  for (const o of offsets) {
    const y = year + o;
    if (y !== 0) out.push(y);
    if (out.length >= count) break;
  }
  return out;
}

function nearbyCenturies(year) {
  const base = year < 0 ? Math.ceil(Math.abs(year) / 100) : Math.ceil(year / 100);
  const isBce = year < 0;
  return [base - 1, base + 1, base + 2]
    .filter(c => c > 0)
    .map(c => `${c}${ordSuffix(c)} century${isBce ? ' BCE' : ''}`);
}

function formatYear(year) {
  if (year < 0) return `${Math.abs(year)} BCE`;
  return `${year}`;
}

/** Pick n random items from arr (not including exclude) */
function pickRandom(arr, n, exclude = new Set()) {
  const filtered = arr.filter(x => !exclude.has(x));
  const shuffled = filtered.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ── distractor pools ──

const FAMOUS_LOCATIONS = [
  'Paris', 'London', 'Rome', 'Constantinople', 'Vienna', 'Madrid',
  'Berlin', 'Moscow', 'Athens', 'Cairo', 'Baghdad', 'Jerusalem',
  'Delhi', 'Beijing', 'Kyoto', 'Alexandria', 'Carthage', 'Sparta',
  'Thebes', 'Damascus', 'Lisbon', 'Prague', 'Warsaw', 'Stockholm',
  'Naples', 'Florence', 'Venice', 'Antwerp', 'Bruges', 'Genoa',
  'Seville', 'Cordoba', 'Granada', 'Lyon', 'Marseille', 'Cologne',
  'Hamburg', 'Munich', 'Krakow', 'Budapest', 'Bucharest', 'Dublin',
];

// ── fact generation ──

function generateFact(raw, rowIndex) {
  const { event, eventLabel, eventDescription, startDate, endDate, locationLabel } = raw;
  const year = extractYear(startDate) || extractYearFromDesc(eventDescription);
  const loc = locationLabel || null;
  const desc = eventDescription || '';
  const slug = slugify(eventLabel);
  const id = `hist-${slug}-${String(rowIndex).padStart(3, '0')}`;
  const sourceRecordId = `row-${rowIndex}`;

  // Determine what kind of event this is
  const isBattle = /battle|siege|attack|invasion|operation|assault/i.test(eventLabel + ' ' + desc);
  const yearStr = year ? formatYear(year) : null;
  const century = year ? centuryOf(year) : null;

  // Build statement (max 20 words)
  let statement;
  if (yearStr && loc) {
    statement = `The ${eventLabel} took place in ${yearStr} near ${loc}.`;
  } else if (yearStr) {
    statement = `The ${eventLabel} occurred in ${yearStr}.`;
  } else if (loc) {
    statement = `The ${eventLabel} took place near ${loc}.`;
  } else {
    statement = `The ${eventLabel} was a notable historical event.`;
  }
  // Trim to 20 words max
  const stWords = statement.split(/\s+/);
  if (stWords.length > 20) statement = stWords.slice(0, 20).join(' ') + '.';

  // Quiz question (max 12 words)
  let quizQuestion, correctAnswer;
  if (yearStr && loc) {
    // Alternate between date and location questions
    if (rowIndex % 2 === 0) {
      quizQuestion = `When did the ${eventLabel} occur?`;
      correctAnswer = yearStr;
    } else {
      quizQuestion = `Where did the ${eventLabel} take place?`;
      correctAnswer = loc;
    }
  } else if (yearStr) {
    quizQuestion = `When did the ${eventLabel} occur?`;
    correctAnswer = yearStr;
  } else if (loc) {
    quizQuestion = `Where did the ${eventLabel} take place?`;
    correctAnswer = loc;
  } else {
    quizQuestion = `What was the ${eventLabel}?`;
    correctAnswer = desc.length <= 35 ? desc : desc.split(/[,;]/)[0].slice(0, 32) + '...';
  }

  // Trim quizQuestion to 12 words
  const qqWords = quizQuestion.split(/\s+/);
  if (qqWords.length > 12) quizQuestion = qqWords.slice(0, 11).join(' ') + '?';

  // Trim correctAnswer to 5 words, 35 chars
  let caWords = correctAnswer.split(/\s+/);
  if (caWords.length > 5) correctAnswer = caWords.slice(0, 5).join(' ');
  // Trim to 35 chars by dropping words if needed
  while (correctAnswer.length > 35 && caWords.length > 1) {
    caWords.pop();
    correctAnswer = caWords.join(' ');
  }
  if (correctAnswer.length > 35) correctAnswer = correctAnswer.slice(0, 32) + '...';

  // ── Variants ──
  const variants = [];
  const excludeLocs = new Set([loc, correctAnswer].filter(Boolean));

  // 1. Forward variant
  if (yearStr) {
    const nearYears = nearbyYears(year, 3).map(formatYear);
    variants.push({
      question: `In what year did the ${eventLabel} happen?`,
      type: 'forward',
      correctAnswer: yearStr,
      distractors: nearYears,
    });
  } else if (loc) {
    const locs = pickRandom(FAMOUS_LOCATIONS, 3, excludeLocs);
    variants.push({
      question: `Where was the ${eventLabel} fought?`,
      type: 'forward',
      correctAnswer: loc.slice(0, 35),
      distractors: locs,
    });
  } else {
    variants.push({
      question: `What type of event was the ${eventLabel}?`,
      type: 'forward',
      correctAnswer: isBattle ? 'A battle' : 'A conflict',
      distractors: ['A treaty', 'A coronation', 'An election'],
    });
  }

  // 2. Reverse variant
  if (loc) {
    const locs = pickRandom(FAMOUS_LOCATIONS, 3, excludeLocs);
    variants.push({
      question: `The ${eventLabel} occurred near which location?`,
      type: 'reverse',
      correctAnswer: loc.slice(0, 35),
      distractors: locs,
    });
  } else if (century) {
    const centuries = nearbyCenturies(year);
    variants.push({
      question: `In which century did the ${eventLabel} happen?`,
      type: 'reverse',
      correctAnswer: century,
      distractors: centuries,
    });
  } else {
    variants.push({
      question: `What is the ${eventLabel} known as?`,
      type: 'reverse',
      correctAnswer: isBattle ? 'A historic battle' : 'A historic event',
      distractors: ['A peace accord', 'A royal wedding', 'A trade agreement'],
    });
  }

  // 3. Negative variant
  if (yearStr) {
    const wrongYear = formatYear(year + 5);
    variants.push({
      question: `Which is NOT true about the ${eventLabel}?`,
      type: 'negative',
      correctAnswer: `Occurred in ${wrongYear}`,
      distractors: [
        yearStr ? `Happened in ${yearStr}` : 'Historical event',
        loc ? `Near ${loc.slice(0, 20)}` : 'Well documented',
        isBattle ? 'Was a battle' : 'Was a conflict',
      ],
    });
  } else {
    variants.push({
      question: `Which is NOT true about the ${eventLabel}?`,
      type: 'negative',
      correctAnswer: 'Happened in 2020',
      distractors: [
        loc ? `Near ${loc.slice(0, 20)}` : 'Historical event',
        isBattle ? 'Was a battle' : 'Was a conflict',
        'Documented in records',
      ],
    });
  }

  // 4. Fill-blank variant
  if (yearStr && loc) {
    variants.push({
      question: `The ${eventLabel} took place in _____.`,
      type: 'fill_blank',
      correctAnswer: yearStr,
      distractors: nearbyYears(year, 3).map(formatYear),
    });
  } else if (yearStr) {
    variants.push({
      question: `The ${eventLabel} occurred in _____.`,
      type: 'fill_blank',
      correctAnswer: yearStr,
      distractors: nearbyYears(year, 3).map(formatYear),
    });
  } else if (loc) {
    variants.push({
      question: `The ${eventLabel} took place near _____.`,
      type: 'fill_blank',
      correctAnswer: loc.slice(0, 35),
      distractors: pickRandom(FAMOUS_LOCATIONS, 3, excludeLocs),
    });
  } else {
    variants.push({
      question: `The ${eventLabel} was a _____ event.`,
      type: 'fill_blank',
      correctAnswer: 'historical',
      distractors: ['fictional', 'modern', 'mythological'],
    });
  }

  // 5. True/false variant
  const tfTrue = Math.random() > 0.5;
  if (tfTrue) {
    // True statement
    let tfQ;
    if (yearStr && loc) {
      tfQ = `The ${eventLabel} took place in ${yearStr} near ${loc}.`;
    } else if (yearStr) {
      tfQ = `The ${eventLabel} occurred in ${yearStr}.`;
    } else if (loc) {
      tfQ = `The ${eventLabel} happened near ${loc}.`;
    } else {
      tfQ = `The ${eventLabel} was a real historical event.`;
    }
    variants.push({
      question: tfQ,
      type: 'true_false',
      correctAnswer: 'True',
      distractors: ['False'],
    });
  } else {
    // False statement
    let tfQ;
    if (yearStr) {
      const wrongY = formatYear(year + 100);
      tfQ = `The ${eventLabel} took place in ${wrongY}.`;
    } else if (loc) {
      const wrongLoc = pickRandom(FAMOUS_LOCATIONS, 1, excludeLocs)[0] || 'Antarctica';
      tfQ = `The ${eventLabel} happened in ${wrongLoc}.`;
    } else {
      tfQ = `The ${eventLabel} occurred in the 21st century.`;
    }
    variants.push({
      question: tfQ,
      type: 'true_false',
      correctAnswer: 'False',
      distractors: ['True'],
    });
  }

  // Trim all variant questions to 15 words, answers to 5 words
  for (const v of variants) {
    const vqWords = v.question.split(/\s+/);
    if (vqWords.length > 15) {
      v.question = vqWords.slice(0, 14).join(' ') + (v.type === 'true_false' ? '.' : '?');
    }
    if (v.type !== 'true_false') {
      const vcaWords = v.correctAnswer.split(/\s+/);
      if (vcaWords.length > 5) v.correctAnswer = vcaWords.slice(0, 5).join(' ');
    }
    // Trim distractors to 5 words each
    v.distractors = v.distractors.map(d => {
      const dw = d.split(/\s+/);
      return dw.length > 5 ? dw.slice(0, 5).join(' ') : d;
    });
  }

  // ── Top-level distractors (8: 3 easy, 3 medium, 2 hard) ──
  const distractors = [];
  const usedTexts = new Set();

  function addDistractor(text, tier) {
    // Enforce 5 words max first, then 30 chars max
    let words = text.split(/\s+/);
    if (words.length > 5) text = words.slice(0, 5).join(' ');
    if (text.length > 30) {
      // Try trimming words until it fits
      words = text.split(/\s+/);
      while (words.length > 1 && words.join(' ').length > 30) words.pop();
      text = words.join(' ');
      if (text.length > 30) text = text.slice(0, 27) + '...';
    }
    if (!usedTexts.has(text.toLowerCase())) {
      usedTexts.add(text.toLowerCase());
      distractors.push({ text, difficultyTier: tier });
    }
  }

  // Easy distractors (obviously wrong)
  if (yearStr) {
    addDistractor(`Occurred in ${formatYear(year + 100)}`, 'easy');
    addDistractor(`Happened in ${formatYear(year - 100)}`, 'easy');
  } else {
    addDistractor('Happened in 2020', 'easy');
    addDistractor('A fictional event', 'easy');
  }
  if (loc) {
    const wrongLoc = pickRandom(FAMOUS_LOCATIONS, 1, excludeLocs)[0] || 'Antarctica';
    addDistractor(`In ${wrongLoc}`, 'easy');
  } else {
    addDistractor('Located in Antarctica', 'easy');
  }

  // Medium distractors (plausible but wrong)
  if (yearStr) {
    const near = nearbyYears(year, 2);
    addDistractor(`In ${formatYear(near[0])}`, 'medium');
    addDistractor(`In ${formatYear(near[1])}`, 'medium');
  } else {
    addDistractor('In the 18th century', 'medium');
    addDistractor('During medieval times', 'medium');
  }
  if (loc) {
    const nearLocs = pickRandom(FAMOUS_LOCATIONS, 2, excludeLocs);
    addDistractor(`Near ${nearLocs[0] || 'Vienna'}`, 'medium');
  } else {
    const nearLocs = pickRandom(FAMOUS_LOCATIONS, 1, excludeLocs);
    addDistractor(`Near ${nearLocs[0] || 'Vienna'}`, 'medium');
  }

  // Hard distractors (very plausible)
  if (yearStr) {
    addDistractor(`In ${formatYear(year - 1)}`, 'hard');
    addDistractor(`In ${formatYear(year + 1)}`, 'hard');
  } else if (loc) {
    const hardLocs = pickRandom(FAMOUS_LOCATIONS, 2, excludeLocs);
    addDistractor(`Near ${hardLocs[0] || 'Prague'}`, 'hard');
    addDistractor(`Near ${hardLocs[1] || 'Warsaw'}`, 'hard');
  } else {
    addDistractor('A minor skirmish', 'hard');
    addDistractor('A diplomatic summit', 'hard');
  }

  // Pad to exactly 8
  while (distractors.length < 8) {
    const tier = distractors.length < 3 ? 'easy' : distractors.length < 6 ? 'medium' : 'hard';
    const fallbacks = ['A minor conflict', 'An old treaty', 'A lost record', 'Regional dispute', 'Border clash'];
    for (const fb of fallbacks) {
      if (distractors.length >= 8) break;
      addDistractor(fb, tier);
    }
  }

  // Assemble exactly 3 easy, 3 medium, 2 hard
  const byTier = { easy: [], medium: [], hard: [] };
  for (const d of distractors) byTier[d.difficultyTier].push(d);
  // Pad any missing tiers with fallbacks
  while (byTier.easy.length < 3) byTier.easy.push({ text: 'Unrelated event', difficultyTier: 'easy' });
  while (byTier.medium.length < 3) byTier.medium.push({ text: 'Similar era conflict', difficultyTier: 'medium' });
  while (byTier.hard.length < 2) byTier.hard.push({ text: 'Nearby engagement', difficultyTier: 'hard' });
  const orderedDistractors = [
    ...byTier.easy.slice(0, 3),
    ...byTier.medium.slice(0, 3),
    ...byTier.hard.slice(0, 2),
  ];

  // ── Difficulty (1-5) ──
  let difficulty = 3;
  if (year && (year < 0 || year < 500)) difficulty = 4;
  if (!yearStr && !loc) difficulty = 5;
  if (year && year > 1900) difficulty = 2;
  if (/waterloo|pearl harbor|hastings/i.test(eventLabel)) difficulty = 1;

  // ── Fun score ──
  let funScore = 5;
  if (/pearl harbor|waterloo|hastings|mogadishu/i.test(eventLabel)) funScore = 9;
  else if (/siege|invasion|attack/i.test(eventLabel)) funScore = 7;
  else if (/battle/i.test(eventLabel)) funScore = 6;
  if (desc.length > 50) funScore = Math.min(10, funScore + 1);

  // ── Wow factor ──
  let wowFactor;
  if (yearStr && loc) {
    wowFactor = `In ${yearStr}, the clash at ${loc} changed the course of history!`;
  } else if (yearStr) {
    wowFactor = `This ${yearStr} event left a lasting mark on world history!`;
  } else if (loc) {
    wowFactor = `The dramatic events near ${loc} reshaped the region forever!`;
  } else {
    wowFactor = `A remarkable historical event that echoes through the ages!`;
  }

  // ── Visual description ──
  let visualDescription;
  if (isBattle && loc) {
    visualDescription = `Pixel-art scene of armies clashing near ${loc}. Soldiers with period weapons face off across a dramatic landscape. Banners wave in the wind. Smoke rises from the battlefield.`;
  } else if (isBattle) {
    visualDescription = `Pixel-art battlefield scene with opposing armies charging. Weapons clash under a dramatic sky. Flags and banners mark each side. Dust and smoke fill the air.`;
  } else if (loc) {
    visualDescription = `Pixel-art scene of a historic event near ${loc}. Period-appropriate buildings and figures populate the scene. A dramatic sky sets the mood above the landscape.`;
  } else {
    visualDescription = `Pixel-art scene depicting a historic moment. Figures in period clothing gather in a dramatic setting. Architecture and landscape reflect the era of the event.`;
  }
  // Trim to 40 words max
  const vdWords = visualDescription.split(/\s+/);
  if (vdWords.length > 40) visualDescription = vdWords.slice(0, 40).join(' ') + '.';

  // ── Tags ──
  const tags = ['history'];
  if (isBattle) tags.push('military');
  if (year && year < 500) tags.push('ancient');
  else if (year && year < 1500) tags.push('medieval');
  else if (year && year < 1800) tags.push('early modern');
  else if (year && year >= 1800) tags.push('modern');
  if (loc) tags.push(loc.split(/[,\s]/)[0]);
  if (yearStr) tags.push(yearStr);

  return {
    id,
    statement,
    quizQuestion,
    correctAnswer,
    variants,
    distractors: orderedDistractors,
    difficulty,
    funScore,
    wowFactor,
    visualDescription,
    ageRating: 'kid',
    sourceName: 'Wikidata',
    sourceUrl: event,
    category: 'history',
    contentType: 'knowledge',
    tags,
    sourceRecordId,
    generationRetries: 0,
    generationRetryFlagged: false,
  };
}

// ── main ──

function main() {
  // 1. Load raw data
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  console.log(`Raw history entries: ${raw.length}`);

  // 2. Load existing skip set
  const skipSet = new Set();
  if (fs.existsSync(OUT_PATH)) {
    const existing = fs.readFileSync(OUT_PATH, 'utf8').trim().split('\n').filter(Boolean);
    for (const line of existing) {
      try {
        const obj = JSON.parse(line);
        skipSet.add(obj.sourceRecordId);
      } catch { /* skip bad lines */ }
    }
  }
  console.log(`Already generated: ${skipSet.size} facts`);

  // 3. Filter candidates
  const candidates = [];
  for (let i = 0; i < raw.length; i++) {
    const rid = `row-${i}`;
    if (skipSet.has(rid)) continue;
    const r = raw[i];
    const hasDesc = r.eventDescription && r.eventDescription.length > 5;
    const hasDate = !!r.startDate;
    const hasLoc = !!r.locationLabel;
    if (!hasDesc && !(hasDate && hasLoc)) continue;
    candidates.push({ idx: i, ...r });
    if (candidates.length >= 50) break;
  }
  console.log(`Candidates to process: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('Nothing to generate. Done.');
    return;
  }

  // 4. Generate in chunks of 25
  const CHUNK = 25;
  const errors = [];
  let totalGenerated = 0;
  fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true });

  for (let c = 0; c < candidates.length; c += CHUNK) {
    const chunk = candidates.slice(c, c + CHUNK);
    const facts = [];

    for (const row of chunk) {
      try {
        const fact = generateFact(row, row.idx);
        facts.push(fact);
      } catch (err) {
        errors.push({ rowIndex: row.idx, eventLabel: row.eventLabel, error: err.message });
        console.error(`  ERROR row-${row.idx} (${row.eventLabel}): ${err.message}`);
      }
    }

    // Append to JSONL
    if (facts.length > 0) {
      const jsonlLines = facts.map(f => JSON.stringify(f)).join('\n') + '\n';
      fs.appendFileSync(OUT_PATH, jsonlLines, 'utf8');
      totalGenerated += facts.length;
      console.log(`  Chunk ${Math.floor(c / CHUNK) + 1}: wrote ${facts.length} facts (total: ${totalGenerated})`);
    }

    // Write progress
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalProcessed: totalGenerated,
      totalErrors: errors.length,
      lastRowIndex: chunk[chunk.length - 1].idx,
    }, null, 2), 'utf8');
  }

  // 5. Write errors
  if (errors.length > 0) {
    fs.writeFileSync(ERRORS_PATH, JSON.stringify(errors, null, 2), 'utf8');
    console.log(`Errors logged: ${errors.length} → ${ERRORS_PATH}`);
  }

  console.log(`\nDone. Generated ${totalGenerated} facts, ${errors.length} errors.`);
  console.log(`Output: ${OUT_PATH}`);
}

try {
  main();
} catch (err) {
  console.error('Fatal:', err);
  process.exit(1);
}
