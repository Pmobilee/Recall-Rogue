/**
 * Assembly script for Computer Science & Technology curated deck.
 * Loads all 8 batch files, validates facts, builds pools/sub-decks/synonyms/templates,
 * and writes the final JSON to data/decks/computer_science.json.
 *
 * Run: node data/decks/_wip/computer_science/assemble.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');

// ============================================================
// 1. LOAD ALL BATCH FILES
// ============================================================

const batchFiles = [
  'data/decks/_wip/computer_science/batch_0_pioneers.json',
  'data/decks/_wip/computer_science/batch_1_hardware.json',
  'data/decks/_wip/computer_science/batch_2_languages.json',
  'data/decks/_wip/computer_science/batch_3_algorithms.json',
  'data/decks/_wip/computer_science/batch_4_systems.json',
  'data/decks/_wip/computer_science/batch_5_internet.json',
  'data/decks/_wip/computer_science/batch_6_ai_ml.json',
  'data/decks/_wip/computer_science/batch_7_companies.json',
];

const allFacts = [];
for (const relPath of batchFiles) {
  const fullPath = resolve(ROOT, relPath);
  const batch = JSON.parse(readFileSync(fullPath, 'utf8'));
  allFacts.push(...batch);
  console.log(`Loaded ${batch.length} facts from ${relPath}`);
}

console.log(`\nTotal facts loaded: ${allFacts.length}`);

// ============================================================
// 2. VALIDATE REQUIRED FIELDS
// ============================================================

const REQUIRED_FIELDS = [
  'id', 'correctAnswer', 'chainThemeId', 'answerTypePoolId',
  'difficulty', 'funScore', 'quizQuestion', 'explanation', 'distractors',
];

const warnings = [];
let validationErrors = 0;

for (const fact of allFacts) {
  for (const field of REQUIRED_FIELDS) {
    if (fact[field] === undefined || fact[field] === null) {
      console.error(`  ERROR: fact ${fact.id} missing required field: ${field}`);
      validationErrors++;
    }
  }
  // Validate ranges
  if (fact.difficulty < 1 || fact.difficulty > 5) {
    warnings.push(`  WARN: ${fact.id} has out-of-range difficulty: ${fact.difficulty}`);
  }
  if (fact.funScore < 1 || fact.funScore > 10) {
    warnings.push(`  WARN: ${fact.id} has out-of-range funScore: ${fact.funScore}`);
  }
  if (!Array.isArray(fact.distractors)) {
    console.error(`  ERROR: ${fact.id} distractors is not an array`);
    validationErrors++;
  }
  // bracket_numbers should have empty distractors (runtime-computed)
  if (fact.answerTypePoolId === 'bracket_numbers' && fact.distractors.length > 0) {
    warnings.push(`  WARN: ${fact.id} is bracket_number but has pre-filled distractors — may be intentional`);
  }
}

if (validationErrors > 0) {
  console.error(`\nFATAL: ${validationErrors} validation errors found. Fix before assembling.`);
  process.exit(1);
}

console.log(`\nValidation passed (${validationErrors} errors).`);

// ============================================================
// 3. CHECK FOR DUPLICATE IDs
// ============================================================

const idCounts = {};
for (const fact of allFacts) {
  idCounts[fact.id] = (idCounts[fact.id] || 0) + 1;
}

const duplicates = Object.entries(idCounts).filter(([, count]) => count > 1);
if (duplicates.length > 0) {
  console.error('\nDUPLICATE IDs detected:');
  for (const [id, count] of duplicates) {
    console.error(`  ${id} appears ${count} times`);
  }
  process.exit(1);
}

console.log(`Duplicate ID check: OK (${allFacts.length} unique IDs)`);

// ============================================================
// 4. BUILD ANSWER TYPE POOLS
// ============================================================

// Pool definitions — order matches architecture YAML
const poolDefinitions = [
  {
    id: 'person_names',
    label: 'Person Names',
    answerFormat: 'name',
    minimumSize: 5,
  },
  {
    id: 'technology_terms',
    label: 'Technology Terms',
    answerFormat: 'term',
    minimumSize: 5,
  },
  {
    id: 'acronym_expansions',
    label: 'Acronym Expansions',
    answerFormat: 'term',
    minimumSize: 5,
  },
  {
    id: 'language_names',
    label: 'Programming Language Names',
    answerFormat: 'name',
    minimumSize: 5,
  },
  {
    id: 'company_names',
    label: 'Company Names',
    answerFormat: 'name',
    minimumSize: 5,
  },
  {
    id: 'product_names',
    label: 'Product & System Names',
    answerFormat: 'name',
    minimumSize: 5,
  },
  {
    id: 'algorithm_names',
    label: 'Algorithm & Data Structure Names',
    answerFormat: 'term',
    minimumSize: 5,
  },
  {
    id: 'bracket_numbers',
    label: 'Years & Numbers',
    answerFormat: 'bracket_number',
    minimumSize: 5,
  },
  {
    id: 'complexity_terms',
    label: 'Complexity Terms',
    answerFormat: 'term',
    minimumSize: 5,
  },
  {
    id: 'protocol_names',
    label: 'Protocol & Standard Names',
    answerFormat: 'name',
    minimumSize: 5,
  },
];

// Collect factIds per pool
const poolFactIds = {};
for (const pool of poolDefinitions) {
  poolFactIds[pool.id] = [];
}

for (const fact of allFacts) {
  const pid = fact.answerTypePoolId;
  if (!poolFactIds[pid]) {
    warnings.push(`  WARN: Unknown pool '${pid}' on fact ${fact.id}`);
    poolFactIds[pid] = [];
  }
  poolFactIds[pid].push(fact.id);
}

// Synthetic distractors for pools with <8 factIds (from arch YAML — verified values)
const SYNTHETIC_DISTRACTORS = {
  algorithm_names: [
    'Insertion Sort',
    'Selection Sort',
    'Heapsort',
    'Binary Search',
    'Bellman-Ford Algorithm',
  ],
  protocol_names: [
    'HTTP',
    'HTTPS',
    'FTP',
    'SSH',
    'SMTP',
    'SSL',
    'TLS',
    'Wi-Fi',
  ],
  complexity_terms: [
    // Real complexity values that serve as valid distractors
    "O(n!)",
    "O(√n)",
    "O(n log² n)",
    "Θ(n log n)",
    "Ω(n)",
  ],
};

const answerTypePools = poolDefinitions.map(pool => {
  const factIds = poolFactIds[pool.id] || [];
  const result = {
    id: pool.id,
    label: pool.label,
    answerFormat: pool.answerFormat,
    factIds,
    minimumSize: pool.minimumSize,
  };
  // Add synthetic distractors if pool is small (< 8 factIds) and we have them
  if (factIds.length < 8 && SYNTHETIC_DISTRACTORS[pool.id]) {
    result.syntheticDistractors = SYNTHETIC_DISTRACTORS[pool.id];
  }
  return result;
});

// ============================================================
// 5. BUILD SUB-DECKS
// ============================================================

const subDeckDefinitions = [
  { id: 'pioneers', name: 'Pioneers & Visionaries', chainThemeId: 0 },
  { id: 'hardware', name: 'Hardware & Architecture', chainThemeId: 1 },
  { id: 'languages', name: 'Programming Languages', chainThemeId: 2 },
  { id: 'algorithms', name: 'Algorithms & Theory', chainThemeId: 3 },
  { id: 'systems_networks', name: 'Systems, Networks & Security', chainThemeId: 4 },
  { id: 'internet_web', name: 'The Internet & World Wide Web', chainThemeId: 5 },
  { id: 'ai_ml', name: 'Artificial Intelligence & ML', chainThemeId: 6 },
  { id: 'software_companies', name: 'Software & Tech Companies', chainThemeId: 7 },
];

// Group factIds by chainThemeId
const factsByTheme = {};
for (const def of subDeckDefinitions) {
  factsByTheme[def.chainThemeId] = [];
}
for (const fact of allFacts) {
  if (factsByTheme[fact.chainThemeId] !== undefined) {
    factsByTheme[fact.chainThemeId].push(fact.id);
  } else {
    warnings.push(`  WARN: Unknown chainThemeId ${fact.chainThemeId} on fact ${fact.id}`);
  }
}

const subDecks = subDeckDefinitions.map(def => ({
  id: def.id,
  name: def.name,
  chainThemeId: def.chainThemeId,
  factIds: factsByTheme[def.chainThemeId] || [],
}));

// ============================================================
// 6. BUILD DIFFICULTY TIERS
// ============================================================

const easyIds = allFacts.filter(f => f.difficulty <= 2).map(f => f.id);
const mediumIds = allFacts.filter(f => f.difficulty === 3).map(f => f.id);
const hardIds = allFacts.filter(f => f.difficulty >= 4).map(f => f.id);

const difficultyTiers = [
  { tier: 'easy', factIds: easyIds },
  { tier: 'medium', factIds: mediumIds },
  { tier: 'hard', factIds: hardIds },
];

// ============================================================
// 7. BUILD SYNONYM GROUPS
// From the master architecture YAML — fact IDs matched to actual batch IDs.
// ============================================================

// Helper: find fact IDs that match a pattern
const findFacts = (patterns) => {
  return allFacts
    .filter(f => patterns.some(p => f.id.includes(p)))
    .map(f => f.id);
};

const synonymGroups = [
  {
    id: 'tcp_ip_inventors',
    factIds: findFacts(['vint_cerf', '_cerf_', 'tcp_ip_inventors', 'robert_kahn', '_kahn_']),
    reason: "Both co-invented TCP/IP — either name can answer 'who designed TCP/IP?'",
  },
  {
    id: 'unix_co_creators',
    factIds: findFacts(['unix_creators', 'dennis_ritchie', 'ken_thompson']),
    reason: "Both co-created Unix — never distract each other on Unix questions",
  },
  {
    id: 'integrated_circuit_inventors',
    factIds: findFacts(['kilby', 'noyce']),
    reason: "Both independently invented the integrated circuit — context determines which is correct",
  },
  {
    id: 'google_founders',
    factIds: findFacts(['larry_page', 'sergey_brin', 'google_found']),
    reason: "Both co-founded Google — never distract each other on Google questions",
  },
  {
    id: 'mit_ai_lab_founders',
    factIds: findFacts(['mccarthy', 'marvin_minsky', 'minsky']),
    reason: "Both co-founded MIT AI Lab — never distract each other on that question",
  },
  {
    id: 'www_html_http',
    factIds: findFacts(['tim_berners_lee', 'berners_lee', '_www_', 'html_', 'http_', 'url_']),
    reason: "All invented by Tim Berners-Lee at CERN — questions about the Web, HTML, HTTP, and URL all point to the same person",
  },
  {
    id: 'java_javascript_names',
    factIds: findFacts(['javascript', 'java_language', 'java_creator', 'gosling', 'brendan_eich']),
    reason: "Similar names but unrelated languages — must never be distractors for each other",
  },
  {
    id: 'unix_linux_relation',
    factIds: findFacts(['linux_creator', 'linux_year', 'linus_torvalds', 'unix_creators', 'unix_']),
    reason: "Linux reimplements Unix concepts — questions about OS history need careful distractor selection",
  },
].map(g => ({
  ...g,
  // Remove duplicates while preserving order
  factIds: [...new Set(g.factIds)].filter(id => id),
})).filter(g => g.factIds.length > 0);

// ============================================================
// 8. BUILD QUESTION TEMPLATES
// From the master architecture YAML, mapped to the CuratedDeck interface.
// reverseCapable = true when the template can be asked in both directions.
// ============================================================

const questionTemplates = [
  {
    id: 'who_created_language',
    answerPoolId: 'person_names',
    questionFormat: 'Who created the {language} programming language?',
    availableFromMastery: 0,
    difficulty: 1,
    reverseCapable: true,
  },
  {
    id: 'what_language_created_by',
    answerPoolId: 'language_names',
    questionFormat: 'Which programming language did {person} create?',
    availableFromMastery: 0,
    difficulty: 1,
    reverseCapable: true,
  },
  {
    id: 'when_language_released',
    answerPoolId: 'bracket_numbers',
    questionFormat: 'In what year was the {language} programming language first released?',
    availableFromMastery: 1,
    difficulty: 2,
    reverseCapable: false,
  },
  {
    id: 'acronym_expansion',
    answerPoolId: 'acronym_expansions',
    questionFormat: 'What does the acronym {acronym} stand for?',
    availableFromMastery: 0,
    difficulty: 1,
    reverseCapable: false,
  },
  {
    id: 'who_invented_hardware',
    answerPoolId: 'person_names',
    questionFormat: 'Who invented or developed {hardware_item}?',
    availableFromMastery: 1,
    difficulty: 2,
    reverseCapable: false,
  },
  {
    id: 'algorithm_inventor',
    answerPoolId: 'person_names',
    questionFormat: 'Who invented {algorithm}?',
    availableFromMastery: 1,
    difficulty: 2,
    reverseCapable: false,
  },
  {
    id: 'algorithm_complexity',
    answerPoolId: 'complexity_terms',
    questionFormat: 'What is the average-case time complexity of {algorithm}?',
    availableFromMastery: 2,
    difficulty: 3,
    reverseCapable: false,
  },
  {
    id: 'company_founder',
    answerPoolId: 'person_names',
    questionFormat: 'Who co-founded {company}?',
    availableFromMastery: 0,
    difficulty: 1,
    reverseCapable: false,
  },
  {
    id: 'company_founded_year',
    answerPoolId: 'bracket_numbers',
    questionFormat: 'In what year was {company} founded?',
    availableFromMastery: 1,
    difficulty: 2,
    reverseCapable: false,
  },
  {
    id: 'product_company',
    answerPoolId: 'company_names',
    questionFormat: 'Which company developed {product}?',
    availableFromMastery: 1,
    difficulty: 2,
    reverseCapable: false,
  },
  {
    id: 'protocol_expansion',
    answerPoolId: 'acronym_expansions',
    questionFormat: 'What does the protocol acronym {protocol} stand for?',
    availableFromMastery: 0,
    difficulty: 1,
    reverseCapable: false,
  },
  {
    id: 'pioneer_achievement',
    answerPoolId: 'technology_terms',
    questionFormat: 'What is {person} best known for in computer science?',
    availableFromMastery: 2,
    difficulty: 3,
    reverseCapable: false,
  },
  {
    id: 'year_of_event',
    answerPoolId: 'bracket_numbers',
    questionFormat: 'In what year did {event} occur?',
    availableFromMastery: 1,
    difficulty: 2,
    reverseCapable: false,
  },
  {
    id: 'term_definition',
    answerPoolId: 'technology_terms',
    questionFormat: 'What is the term for {description}?',
    availableFromMastery: 0,
    difficulty: 1,
    reverseCapable: false,
  },
];

// ============================================================
// 9. ASSEMBLE FINAL DECK
// ============================================================

const deck = {
  id: 'computer_science',
  name: 'Computer Science & Technology',
  domain: 'general_knowledge',
  subDomain: 'computer_science',
  description:
    'From Babbage\'s Analytical Engine to modern AI — the algorithms, machines, languages, and pioneers that built the digital world. Eight sub-decks spanning pioneers, hardware, programming languages, algorithms, systems and networks, the internet, artificial intelligence, and the tech companies that changed everything.',
  minimumFacts: 240,
  targetFacts: 300,
  facts: allFacts,
  answerTypePools,
  synonymGroups,
  questionTemplates,
  difficultyTiers,
  subDecks,
};

// ============================================================
// 10. WRITE OUTPUT
// ============================================================

const outputPath = resolve(ROOT, 'data/decks/computer_science.json');
writeFileSync(outputPath, JSON.stringify(deck, null, 2), 'utf8');
console.log(`\nWrote ${outputPath}`);

// ============================================================
// 11. PRINT SUMMARY
// ============================================================

console.log('\n=== ASSEMBLY SUMMARY ===\n');
console.log(`Total facts: ${allFacts.length}`);
console.log(`(minimumFacts: ${deck.minimumFacts}, targetFacts: ${deck.targetFacts})`);

console.log('\nFacts per sub-deck:');
for (const sd of subDecks) {
  const count = sd.factIds.length;
  const status = count >= 28 ? 'OK' : 'WARN low';
  console.log(`  [${sd.chainThemeId}] ${sd.name}: ${count} facts — ${status}`);
}

console.log('\nPool sizes:');
for (const pool of answerTypePools) {
  const size = pool.factIds.length;
  const synth = pool.syntheticDistractors ? ` (+${pool.syntheticDistractors.length} synthetic)` : '';
  const status = size >= 5 ? 'OK' : 'WARN low';
  console.log(`  ${pool.id}: ${size} factIds${synth} — ${status}`);
}

console.log('\nDifficulty distribution:');
console.log(`  easy  (1-2): ${easyIds.length}`);
console.log(`  medium (3):  ${mediumIds.length}`);
console.log(`  hard  (4-5): ${hardIds.length}`);

console.log('\nSynonym groups:');
for (const sg of synonymGroups) {
  console.log(`  ${sg.id}: ${sg.factIds.length} facts — [${sg.factIds.join(', ')}]`);
}

console.log('\nQuestion templates:', questionTemplates.length);

if (warnings.length > 0) {
  console.log('\nWarnings:');
  for (const w of warnings) {
    console.log(w);
  }
}

console.log('\nAssembly complete.');
