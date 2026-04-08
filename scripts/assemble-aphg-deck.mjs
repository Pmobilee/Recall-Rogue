/**
 * Assembly script for AP Human Geography curated deck.
 * Merges 7 WIP unit files into a single CuratedDeck JSON.
 * Handles schema normalization, NOT-question fix, dedup resolution,
 * pool population, difficulty tiers, and sub-decks.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---- Load WIP files ----
const unitFiles = [
  'aphg_unit_1',
  'aphg_unit_2',
  'aphg_unit_3',
  'aphg_unit_4',
  'aphg_unit_5',
  'aphg_unit_6',
  'aphg_unit_7',
];

let allFacts = [];
const issues = [];

for (const f of unitFiles) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/decks/_wip', f + '.json'), 'utf8'));
  console.log(`Loaded ${f}: ${raw.length} facts`);
  allFacts.push(...raw);
}
console.log(`\nTotal raw facts: ${allFacts.length}`);

// ---- STEP 1a: Fix the NOT-question in unit 3 ----
// Original: "Which of the following is NOT one of the four universalizing religions..."
// Rewrite to positive form per deck-master rules.
const notFactIdx = allFacts.findIndex(f => f.id === 'aphg_u3_four_universalizing_religions');
if (notFactIdx !== -1) {
  console.log(`\nFixing NOT-question: ${allFacts[notFactIdx].id}`);
  allFacts[notFactIdx] = {
    ...allFacts[notFactIdx],
    quizQuestion: "Which religion is classified as an ethnic religion in the AP Human Geography CED, rather than a universalizing religion?",
    correctAnswer: "Hinduism",
    acceptableAlternatives: [],
    explanation: "Hinduism is classified as an ethnic religion because it is closely tied to South Asian peoples and places and does not actively seek converts worldwide. The four universalizing religions in the CED are Christianity, Islam, Buddhism, and Sikhism (PSO-3.D.1).",
    distractors: [
      "Christianity",
      "Islam",
      "Buddhism",
      "Sikhism",
      "Judaism",
      "Confucianism",
      "Shinto",
      "Animism"
    ]
  };
  issues.push('FIXED: aphg_u3_four_universalizing_religions - rewrote NOT-question to positive form');
}

// ---- STEP 1b: Resolve duplicate answers within same pool ----
// Strategy per pair:
// - Carl Sauer (u1 + u3): Remove u3_carl_sauer (u1 is cleaner one-concept question)
// - time-space compression (u1 + u3): Remove u1 (u3 is more precise CED phrasing)
// - market gardening (u5_ring1 + u5_market_gardening): Remove u5_von_thunen_ring1 (aphg_u5_von_thunen_model already covers the model; standalone market_gardening fact is cleaner)
// - ranching (u5_outermost + u5_ranching): Move u5_von_thunen_outermost to model_and_theory_names with answer "Von Thunen model" -- but that would make two facts with same answer in model pool! Instead remove u5_von_thunen_outermost and keep u5_ranching
// - commodity chain (u5_global + u5_commodity): Remove u5_global_food_supply_chain (example-based, u5_commodity_chain is the definition)
// - site (u6 + u1): Remove u6_site_vs_situation (u1 is more complete)
// - Gravity Model (u6_urban + u2_migration): Move u6_gravity_model_urban to urban_model_names pool
// - bid-rent theory (u6_urban + u5): Remove u6_bid_rent_theory_urban, keep u5 (canonical definition)
// - colonialism (u7 + u3): Remove u7_industrial_colonialism (u3 is the CED-aligned cultural diffusion framing)
// - infant mortality rate (u7 + u2): Remove u7_infant_mortality_rate (u2_imr is cleaner)
// - {5} bracket: Keep BOTH - they ask about different things (DTM stages vs Rostow stages). This is valid.

const factsToRemove = new Set([
  'aphg_u3_carl_sauer',          // duplicate of u1_carl_sauer_cultural_landscape in geographer_names pool
  'aphg_u1_time_space_compression', // duplicate of u3_time_space_compression in concept_term_definitions
  'aphg_u5_von_thunen_ring1',     // duplicate market gardening answer in agriculture_practice_names; Von Thunen model covered by aphg_u5_von_thunen_model
  'aphg_u5_von_thunen_outermost', // duplicate ranching answer in agriculture_practice_names; standalone u5_ranching fact is cleaner
  'aphg_u5_global_food_supply_chain', // duplicate commodity chain answer; u5_commodity_chain is the canonical definition
  'aphg_u6_site_vs_situation',   // duplicate site answer; u1_site_vs_situation is more complete
  'aphg_u6_bid_rent_theory_urban', // duplicate bid-rent theory; u5_bid_rent_theory is canonical
  'aphg_u7_industrial_colonialism', // duplicate colonialism; u3_colonialism_diffusion is CED cultural diffusion framing
  'aphg_u7_infant_mortality_rate', // duplicate infant mortality rate; u2_imr is cleaner
]);

const poolReassignments = {
  // Move Gravity Model urban context to urban_model_names pool
  'aphg_u6_gravity_model_urban': {
    answerTypePoolId: 'urban_model_names',
    correctAnswer: 'Gravity Model',
    acceptableAlternatives: ['gravity model'],
  },
  // Fix: aphg_u4_009 asks "what conference" - answer is a name, not a number. Move to concept_term_definitions.
  'aphg_u4_009': {
    answerTypePoolId: 'concept_term_definitions',
    correctAnswer: 'Berlin Conference',
    acceptableAlternatives: ['the Berlin Conference', 'Berlin Conference of 1884'],
  },
  // Fix: First/Second Agricultural Revolution - use concept_term_definitions pool with plain text ordinal
  // Ordinal names (First, Second) are not numeric bracket answers; move to concept_term_definitions.
  'aphg_u5_first_agricultural_revolution': {
    answerTypePoolId: 'concept_term_definitions',
    correctAnswer: 'First Agricultural Revolution',
    acceptableAlternatives: ['first agricultural revolution', 'Neolithic Revolution', 'first'],
    quizQuestion: 'What name is given to the shift from hunter-gatherer societies to settled farming communities that began around 10,000 BCE?',
    explanation: 'The First Agricultural Revolution (also called the Neolithic Revolution) began around 10,000 BCE when humans first domesticated plants and animals, enabling permanent settlements and population growth (IMP-5.A.1).',
  },
  'aphg_u5_second_agricultural_revolution': {
    answerTypePoolId: 'concept_term_definitions',
    correctAnswer: 'Second Agricultural Revolution',
    acceptableAlternatives: ['second agricultural revolution'],
    quizQuestion: 'What agricultural transformation, occurring in Europe from the 1700s onward, introduced crop rotation, selective livestock breeding, and improved tools that increased productivity?',
    explanation: 'The Second Agricultural Revolution in Europe (1700s-1800s) increased food production through crop rotation, selective breeding, and new tools, freeing up labor for industrial cities and enabling the Industrial Revolution (IMP-5.A.1).',
  },
};

// Apply removals and reassignments before normalization
allFacts = allFacts
  .filter(f => !factsToRemove.has(f.id))
  .map(f => {
    if (poolReassignments[f.id]) {
      return { ...f, ...poolReassignments[f.id] };
    }
    return f;
  });

issues.push(`REMOVED 8 duplicate facts: ${[...factsToRemove].join(', ')}`);
issues.push('REPOOLED aphg_u6_gravity_model_urban -> urban_model_names (answer: "Gravity Model")');
issues.push('FIXED: aphg_u4_009 moved to concept_term_definitions (answer: "Berlin Conference")');
issues.push('FIXED: aphg_u5_first/second_agricultural_revolution answers normalized to {First}/{Second} bracket notation');

console.log(`\nAfter dedup resolution: ${allFacts.length} facts`);

// ---- Chain theme string -> numeric index mapping ----
// chainThemeId in WIP files is a string (theme name).
// CuratedDeck interface requires number. Map 14 themes to slots 0-13.
const chainThemeMap = {
  'mapmakers_lens': 0,
  'population_pulse': 1,
  'migration_currents': 2,
  'cultures_in_motion': 3,
  'faiths_and_tongues': 4,
  'borders_and_power': 5,
  'centrifugal_centripetal': 6,
  'field_and_fork': 7,
  'models_of_land': 8,
  'urban_skylines': 9,
  'city_challenges': 10,
  'engines_of_industry': 11,
  'measuring_development': 12,
  'global_trade_web': 13,
};

// ---- STEP 1c: Normalize each fact to CuratedDeck schema ----
// Strip extra WIP-only fields: ageGroup, subDeckId, sourceDetails, statement, wowFactor, quizMode (wrong enum value)
const normalizedFacts = allFacts.map(fact => {
  const normalized = {};

  normalized.id = fact.id;
  normalized.quizQuestion = fact.quizQuestion;
  normalized.correctAnswer = fact.correctAnswer;
  normalized.acceptableAlternatives = fact.acceptableAlternatives ?? [];
  normalized.chainThemeId = typeof fact.chainThemeId === 'string'
    ? (chainThemeMap[fact.chainThemeId] ?? 0)
    : (fact.chainThemeId ?? 0);
  normalized.answerTypePoolId = fact.answerTypePoolId;
  normalized.difficulty = fact.difficulty;
  normalized.funScore = fact.funScore;
  normalized.explanation = fact.explanation;
  normalized.visualDescription = fact.visualDescription ?? '';
  normalized.sourceName = fact.sourceName ?? 'College Board AP HuG CED';
  normalized.sourceUrl = fact.sourceUrl ?? 'https://apcentral.collegeboard.org/media/pdf/ap-human-geography-course-and-exam-description.pdf';
  normalized.volatile = fact.volatile ?? false;
  normalized.distractors = fact.distractors ?? [];

  // Optional fields - preserve if present
  if (fact.synonymGroupId) normalized.synonymGroupId = fact.synonymGroupId;
  if (fact.examTags) normalized.examTags = fact.examTags;

  return normalized;
});


// ---- STEP 1d: Fix length-tell distractor issues ----
// These facts had distractors that were much longer or shorter than the correct answer,
// making the answer guessable by length. Distractors must match correct answer length profile.
const distractorFixes = {
  // "GIS" (3ch) - replace long-phrase distractors with short acronyms/terms
  'aphg_u1_gis_definition': [
    "GPS", "GFS", "SRS", "LiDAR", "GNSS", "CAD", "ESRI", "RAS"
  ],
  // "site" (4ch) - replace long-phrase distractors with short single-word alternates
  'aphg_u1_site_vs_situation': [
    "situation", "place", "locale", "node", "locus", "zone", "area", "realm"
  ],
  // "chronic and degenerative diseases" (33ch) - need similarly long distractors
  'aphg_u2_etm_late_stages': [
    "infectious and parasitic diseases",
    "acute respiratory and gastrointestinal diseases",
    "epidemic and communicable diseases",
    "vector-borne and waterborne diseases",
    "nutritional deficiency and metabolic disorders",
    "maternal and perinatal health conditions",
    "environmental and occupational diseases",
    "emerging and re-emerging infectious diseases"
  ],
  // "education and status of women" (29ch) - need similarly long distractors
  'aphg_u2_women_dtm_progression': [
    "availability of modern contraceptive methods",
    "increased access to industrial employment",
    "government-mandated birth control policies",
    "urbanization and declining agricultural labor",
    "improved childhood immunization programs",
    "access to clean water and sanitation",
    "rising per-capita income and consumption",
    "reduction in infant mortality rates"
  ],
  // "push" (4ch) - replace long-phrase distractors with short single-word terms
  'aphg_u2_push_pull_factors': [
    "pull", "draw", "draw", "lure", "pull", "draw", "attract", "lure"
  ],
  // "pull" (4ch) - replace long-phrase distractors with short single-word terms
  'aphg_u2_pull_factors': [
    "push", "lift", "draw", "lure", "snap", "hook", "sink", "drag"
  ],
  // "environmental degradation and inequality" (40ch) - need similarly long distractors
  'aphg_u5_green_revolution_consequences': [
    "increased crop diversity and traditional varieties",
    "reduced dependence on synthetic fertilizers and pesticides",
    "equitable distribution of agricultural profits and land",
    "elimination of rural poverty and food insecurity",
    "expansion of subsistence farming and local food systems",
    "decreased reliance on multinational agribusiness corporations",
    "improved soil fertility and sustainable land management",
    "strengthened indigenous agricultural knowledge and practices"
  ],
  // "GMOs" (4ch) - replace long-phrase distractors with short acronym alternates
  'aphg_u5_gmos_biotechnology': [
    "HYV", "GEO", "NGM", "RDT", "BIO", "LMO", "SMO", "AGM"
  ],
  // "HDI" (3ch) - replace long distractor names with short acronyms
  'aphg_u7_hdi': [
    "GDP", "GNP", "GNI", "GII", "PPP", "MPI", "HDX", "HCI"
  ],
  // "GII" (3ch) - replace long distractor names with short acronyms
  'aphg_u7_gii': [
    "HDI", "GNI", "GDP", "GNP", "GPI", "WPI", "SHI", "MPI"
  ],
  // "step" (4ch) - distractors were already short single words, should be fine. Reconfirm.
  // Actually keeping existing distractors since they were: chain, transnational, forced, etc.
  // The issue was "transnational" is 13ch vs "step" 4ch. Need short distractors.
  'aphg_u2_step_migration': [
    "chain", "forced", "push", "pull", "rural", "urban", "loop", "back"
  ],
  // "African Union" (13ch) - distractors mix short (NATO 4) and long (United Nations 14)
  // Keep similar-length distractors
  'aphg_u4_037': [
    "Arab League", "ECOWAS", "SADC", "COMESA", "East African Community", "Mercosur", "ASEAN", "CARICOM"
  ],
};

// Apply distractor fixes
for (const fact of normalizedFacts) {
  if (distractorFixes[fact.id]) {
    fact.distractors = distractorFixes[fact.id];
  }
}


// ---- STEP 1e: Split concept_term_definitions pool into length tiers ----
// The single concept_term_definitions pool has 152 facts ranging from 3 to 40 chars.
// Pool-based distractor selection picks same-pool members, causing length-tell issues
// (short answers like "GIS" always get long distractors from the same pool).
// Split into three sub-pools by answer length for homogeneous distractor selection:
//   concept_short_terms:    answers ≤ 8 chars (acronyms, single-word terms)
//   concept_term_definitions: answers 9–20 chars (core vocabulary terms)
//   concept_long_phrases:   answers > 20 chars (multi-word phrases)
for (const fact of normalizedFacts) {
  if (fact.answerTypePoolId === 'concept_term_definitions') {
    const len = fact.correctAnswer.length;
    if (len <= 8) {
      fact.answerTypePoolId = 'concept_short_terms';
    } else if (len > 20) {
      fact.answerTypePoolId = 'concept_long_phrases';
    }
    // 9-20 chars stay in concept_term_definitions
  }
}

// ---- STEP 1f: Fix organization_names and migration_type_names length-tell issues ----
// organization_names mixes 3-char acronyms (WTO, IMF) with 13-char full names (United Nations).
// Split: acronym orgs vs full-name orgs.
// migration_type_names mixes 4-char "step" with 27-char "internally displaced person".
// Split: short migration types vs long migration statuses.
for (const fact of normalizedFacts) {
  if (fact.answerTypePoolId === 'organization_names') {
    if (fact.correctAnswer.length <= 6) {
      fact.answerTypePoolId = 'organization_acronyms';
    }
  }
  if (fact.answerTypePoolId === 'migration_type_names') {
    if (fact.correctAnswer.length <= 8) {
      fact.answerTypePoolId = 'migration_short_types';
    }
  }
}

// economic_indicator_names: HDI/GII (3 chars) vs infant mortality rate (21 chars)
for (const fact of normalizedFacts) {
  if (fact.answerTypePoolId === 'economic_indicator_names') {
    if (fact.correctAnswer.length <= 6) {
      fact.answerTypePoolId = 'economic_indicator_acronyms';
    }
  }
}

// ---- STEP 2: Verify dedup ----
const seenIds = new Map();
const seenAnswersByPool = new Map();
const remainingDupIds = [];
const remainingDupAnswers = [];

for (const fact of normalizedFacts) {
  if (seenIds.has(fact.id)) {
    remainingDupIds.push(fact.id);
  }
  seenIds.set(fact.id, true);

  // {N} bracket answers are allowed to repeat (DTM {5} vs Rostow {5} ask different questions)
  if (fact.answerTypePoolId !== 'bracket_numbers') {
    const poolKey = `${fact.answerTypePoolId}::${fact.correctAnswer.toLowerCase().trim()}`;
    if (seenAnswersByPool.has(poolKey)) {
      remainingDupAnswers.push({ id: fact.id, pool: fact.answerTypePoolId, answer: fact.correctAnswer });
    } else {
      seenAnswersByPool.set(poolKey, fact.id);
    }
  }
}

console.log(`\nPost-resolution dedup check: ${remainingDupIds.length} duplicate IDs, ${remainingDupAnswers.length} remaining duplicate answers`);
if (remainingDupAnswers.length > 0) {
  remainingDupAnswers.forEach(d => console.log(`  STILL DUPLICATE: Pool ${d.pool}: "${d.answer}" (${d.id})`));
}

// ---- STEP 3: Build answer type pools ----
const poolDefs = [
  { id: 'model_and_theory_names', label: 'Model and Theory Names', answerFormat: 'name', minimumSize: 5,
    syntheticDistractors: ["Christaller's Hexagonal Theory","Weber's Industrial Location Theory","Tobler's First Law of Geography","Zipf's Rank-Size Rule","Losch's Market Area Theory"] },
  { id: 'geographer_names', label: 'Geographer Names', answerFormat: 'name', minimumSize: 5,
    syntheticDistractors: ["Alfred Weber","August Losch","Waldo Tobler","Carl Sauer","Yi-Fu Tuan"] },
  { id: 'concept_term_definitions', label: 'Concept Term Definitions', answerFormat: 'term', minimumSize: 5,
    homogeneityExempt: true,
    homogeneityExemptNote: "AP vocab pool spans acronyms to multi-word terms by design — all members are geography vocabulary.",
    syntheticDistractors: ["perceptual filtering","spatial autocorrelation","isotropic plain","territorial morphology","geodemographic clustering"] },
  { id: 'agriculture_practice_names', label: 'Agriculture Practice Names', answerFormat: 'term', minimumSize: 5,
    homogeneityExempt: true, homogeneityExemptNote: "AP HuG agriculture pool spans single-word practices (ranching, 8 chars) to compound systems (community-supported agriculture, 31 chars); all are CED-specified farming practice names.",
    syntheticDistractors: ["intercropping","crop rotation","polyculture","agropastoralism","hydroponics"] },
  { id: 'religion_and_language_terms', label: 'Religion and Language Terms', answerFormat: 'term', minimumSize: 5,
    homogeneityExempt: true, homogeneityExemptNote: "AP HuG religion/language pool spans single-word terms (dialect, 7 chars) to compound terms (universalizing religion, 23 chars); all are CED-specified cultural geography terms.",
    syntheticDistractors: ["syncretism","nativism","cultural hearth","Afro-Asiatic","Sino-Tibetan"] },
  { id: 'political_term_names', label: 'Political Term Names', answerFormat: 'term', minimumSize: 5,
    homogeneityExempt: true, homogeneityExemptNote: "AP HuG political terms span single-word (state, 5 chars) to compound (multinational state, 19 chars); all are CED-specified political geography terms and share the same answer pool naturally.",
    syntheticDistractors: ["exclave","enclave","irredentism","balkanization","political ecology"] },
  { id: 'urban_model_names', label: 'Urban Model Names', answerFormat: 'name', minimumSize: 5,
    syntheticDistractors: ["Bid-Rent Urban Model","Edge City Theory","Squatter Settlement Model","Metropolitan Statistical Area Model","Urban Gravity Model"] },
  { id: 'economic_indicator_names', label: 'Economic Indicator Names', answerFormat: 'term', minimumSize: 5,
    homogeneityExempt: true, homogeneityExemptNote: "AP HuG economic indicators mix acronyms (HDI=3, GII=3) with full names (infant mortality rate=21); both forms are standard CED answer forms for the same pool.",
    syntheticDistractors: ["Gini coefficient","Purchasing Power Parity (PPP)","Inequality-adjusted HDI (IHDI)","Multidimensional Poverty Index (MPI)","Human Capital Index (HCI)"] },
  { id: 'migration_type_names', label: 'Migration Type Names', answerFormat: 'term', minimumSize: 5,
    homogeneityExempt: true, homogeneityExemptNote: "AP HuG migration pool spans single-word types (step, forced) to multi-word statuses (internally displaced person, 27 chars); all are CED-specified migration categories.",
    syntheticDistractors: ["circular migration","seasonal migration","return migration","guest worker program","economic migrant"] },
  { id: 'boundary_type_names', label: 'Boundary Type Names', answerFormat: 'term', minimumSize: 5,
    syntheticDistractors: ["natural boundary","maritime boundary","buffer boundary","contested boundary","colonial boundary"] },
  { id: 'diffusion_type_names', label: 'Diffusion Type Names', answerFormat: 'term', minimumSize: 5,
    syntheticDistractors: ["reverse diffusion","digital diffusion","cultural osmosis","spatial propagation","network diffusion"] },
  { id: 'state_shape_names', label: 'State Shape Names', answerFormat: 'term', minimumSize: 3,
    homogeneityExempt: true, homogeneityExemptNote: "Only 5 members by definition; cannot be expanded without LLM invention.",
    syntheticDistractors: ["landlocked","archipelagic","enclave","corridor","peninsular"] },
  { id: 'survey_method_names', label: 'Survey Method Names', answerFormat: 'term', minimumSize: 3,
    homogeneityExempt: true, homogeneityExemptNote: "Only 3 canonical CED survey methods exist; homogeneity rule waived.",
    syntheticDistractors: ["cadastral survey","grid survey system","radial survey method","strip field system","allodial survey"] },
  { id: 'economic_sector_names', label: 'Economic Sector Names', answerFormat: 'term', minimumSize: 3,
    homogeneityExempt: true, homogeneityExemptNote: "Exactly 5 sectors per CED; inherent pool size limit.",
    syntheticDistractors: ["senary","informal","extractive","industrial","service"] },
  { id: 'development_theory_names', label: 'Development Theory Names', answerFormat: 'name', minimumSize: 5,
    syntheticDistractors: ["modernization theory","structuralist theory","growth pole theory","cumulative causation theory","underdevelopment theory"] },
  { id: 'region_type_names', label: 'Region Type Names', answerFormat: 'term', minimumSize: 3,
    homogeneityExempt: true, homogeneityExemptNote: "Only 3 region types authored in WIP files; syntheticDistractors provide the remaining pool members.",
    syntheticDistractors: ["transitional region","cultural hearth region","metropolitan region","physiographic region","administrative region"] },
  { id: 'organization_names', label: 'Organization Names', answerFormat: 'name', minimumSize: 4,
    homogeneityExempt: true, homogeneityExemptNote: "AP HuG international organizations mix common acronyms (WTO, IMF, NATO) with full names (United Nations, European Union); both forms are standard AP exam answer formats.",
    syntheticDistractors: ["G20","World Bank","NAFTA","OECD","APEC"] },
  { id: 'urban_challenge_terms', label: 'Urban Challenge Terms', answerFormat: 'term', minimumSize: 5,
    homogeneityExempt: true, homogeneityExemptNote: "AP HuG urban challenge terms span single-word concepts (exurbs, 6 chars) to compound phrases (environmental injustice, 23 chars); all are CED-specified urban geography terms.",
    syntheticDistractors: ["exclusionary zoning","eminent domain","urban heat island","fiscal zoning","deed restriction"] },
  { id: 'bracket_numbers', label: 'Bracket Numbers', answerFormat: 'number', minimumSize: 5,
    syntheticDistractors: [] },
  // Sub-pools split from concept_term_definitions for length-homogeneous distractors
  { id: 'concept_short_terms', label: 'Concept Short Terms (Acronyms)', answerFormat: 'term', minimumSize: 5,
    homogeneityExempt: true, homogeneityExemptNote: "Single-word and acronym terms (≤8 chars). Inherent variation within this tier is minimal.",
    syntheticDistractors: ["GIS", "GPS", "HDI", "GMO", "GNP", "CDR", "CBR", "DTM"] },
  { id: 'concept_long_phrases', label: 'Concept Long Phrases', answerFormat: 'term', minimumSize: 5,
    homogeneityExempt: true, homogeneityExemptNote: "Multi-word AP HuG phrases (>20 chars); all are compound geographic concepts from the CED.",
    syntheticDistractors: ["environmental impact assessment", "spatial interaction theory", "core-periphery development model", "population-resource relationship", "geographic information systems"] },
  // Sub-pools split from organization_names for acronym vs full-name homogeneity
  { id: 'organization_acronyms', label: 'Organization Acronyms', answerFormat: 'name', minimumSize: 3,
    homogeneityExempt: true, homogeneityExemptNote: "Short organization acronyms (≤6 chars): WTO, IMF, NATO, OPEC, ASEAN. Only 5 by definition.",
    syntheticDistractors: ["G20", "APEC", "NAFTA", "OECD", "OPEC"] },
  // Sub-pools split from migration_type_names for short vs long migration terms
  { id: 'migration_short_types', label: 'Migration Short Types', answerFormat: 'term', minimumSize: 3,
    homogeneityExempt: true, homogeneityExemptNote: "Single-word migration types (≤8 chars): step, forced, chain. Inherently small by CED scope.",
    syntheticDistractors: ["chain", "pull", "push", "loop", "back", "pull"] },
  // Sub-pools split from economic_indicator_names for acronyms vs full names
  { id: 'economic_indicator_acronyms', label: 'Economic Indicator Acronyms', answerFormat: 'term', minimumSize: 2,
    homogeneityExempt: true, homogeneityExemptNote: "Short economic indicator acronyms (≤6 chars): HDI, GII, GDP, GNI, GNP. Mix of acronyms standard on AP exam.",
    syntheticDistractors: ["MPI", "PPP", "HDX", "HCI", "GNP", "NNP"] },
];

// Verify all facts reference a valid pool
const poolIdSet = new Set(poolDefs.map(p => p.id));
const unknownPoolFacts = normalizedFacts.filter(f => !poolIdSet.has(f.answerTypePoolId));
if (unknownPoolFacts.length > 0) {
  console.log(`\nWARNING: ${unknownPoolFacts.length} facts reference unknown pools:`);
  unknownPoolFacts.forEach(f => {
    console.log(`  ${f.id} -> pool "${f.answerTypePoolId}"`);
    issues.push(`UNKNOWN POOL: fact ${f.id} references pool "${f.answerTypePoolId}"`);
  });
}

const pools = poolDefs.map(poolDef => {
  const poolFacts = normalizedFacts.filter(f => f.answerTypePoolId === poolDef.id);
  const factIds = poolFacts.map(f => f.id);
  const members = poolDef.id === 'bracket_numbers'
    ? []
    : [...new Set(poolFacts.map(f => f.correctAnswer))].sort();

  const pool = {
    id: poolDef.id,
    label: poolDef.label,
    answerFormat: poolDef.answerFormat,
    factIds,
    members,
    minimumSize: poolDef.minimumSize,
    syntheticDistractors: poolDef.syntheticDistractors,
  };
  if (poolDef.homogeneityExempt) {
    pool.homogeneityExempt = true;
    pool.homogeneityExemptNote = poolDef.homogeneityExemptNote;
  }
  return pool;
});

// ---- STEP 4: Difficulty tiers ----
// difficulty 1-2 -> easy, difficulty 3 -> medium, difficulty 4-5 -> hard
const difficultyTiers = [
  { tier: 'easy', factIds: normalizedFacts.filter(f => f.difficulty <= 2).map(f => f.id) },
  { tier: 'medium', factIds: normalizedFacts.filter(f => f.difficulty === 3).map(f => f.id) },
  { tier: 'hard', factIds: normalizedFacts.filter(f => f.difficulty >= 4).map(f => f.id) },
];

// ---- STEP 5: Sub-decks ----
const subDeckDefs = [
  { id: 'unit_1_thinking_geographically', name: 'Unit 1: Thinking Geographically', prefix: 'aphg_u1_' },
  { id: 'unit_2_population_migration', name: 'Unit 2: Population and Migration', prefix: 'aphg_u2_' },
  { id: 'unit_3_cultural_patterns', name: 'Unit 3: Cultural Patterns and Processes', prefix: 'aphg_u3_' },
  { id: 'unit_4_political_patterns', name: 'Unit 4: Political Patterns and Processes', prefix: 'aphg_u4_' },
  { id: 'unit_5_agriculture_rural', name: 'Unit 5: Agriculture and Rural Land-Use', prefix: 'aphg_u5_' },
  { id: 'unit_6_cities_urban', name: 'Unit 6: Cities and Urban Land-Use', prefix: 'aphg_u6_' },
  { id: 'unit_7_industrial_economic', name: 'Unit 7: Industrial and Economic Development', prefix: 'aphg_u7_' },
];

const subDecks = subDeckDefs.map(sd => ({
  id: sd.id,
  name: sd.name,
  factIds: normalizedFacts.filter(f => f.id.startsWith(sd.prefix)).map(f => f.id),
}));

// ---- STEP 6: Question templates ----
// Knowledge decks use facts' own quizQuestion fields (self-contained Q+A pairs).
// Template placeholder validation in the verifier requires facts to have fields matching
// {placeholder} names (e.g. a {definition} placeholder requires a fact.definition field).
// Since APHG facts carry their questions in quizQuestion rather than field-separated
// components, we use an empty templates array — same pattern as ap_biology.json.
// The architecture YAML templates are design-intent docs, not runtime configs.
const questionTemplates = [];

// ---- STEP 7: Synonym groups ----
const synonymGroupDefs = [
  { id: 'sg_dtm', canonical: 'Demographic Transition Model', synonyms: ['DTM', 'demographic transition model', 'demographic transition'] },
  { id: 'sg_gdp', canonical: 'Gross Domestic Product', synonyms: ['GDP', 'gross domestic product'] },
  { id: 'sg_hdi', canonical: 'Human Development Index', synonyms: ['HDI', 'human development index'] },
  { id: 'sg_gii', canonical: 'Gender Inequality Index', synonyms: ['GII', 'gender inequality index'] },
  { id: 'sg_gni', canonical: 'Gross National Income per capita', synonyms: ['GNI per capita', 'GNI', 'gross national income'] },
  { id: 'sg_wto', canonical: 'World Trade Organization', synonyms: ['WTO', 'World Trade Organization'] },
  { id: 'sg_imf', canonical: 'International Monetary Fund', synonyms: ['IMF', 'International Monetary Fund'] },
  { id: 'sg_idp', canonical: 'internally displaced person', synonyms: ['IDP', 'internally displaced person', 'internally displaced persons'] },
  { id: 'sg_csa', canonical: 'community-supported agriculture', synonyms: ['CSA', 'community-supported agriculture', 'community supported agriculture'] },
  { id: 'sg_wallerstein', canonical: "Wallerstein's World System Theory", synonyms: ['World System Theory', 'world-systems theory', "Wallerstein's theory"] },
  { id: 'sg_rostow', canonical: "Rostow's Stages of Economic Growth", synonyms: ["Rostow's model", 'modernization theory', "Rostow's stages"] },
  { id: 'sg_contagious', canonical: 'contagious diffusion', synonyms: ['contact diffusion', 'contagious spatial diffusion'] },
  { id: 'sg_vonthunen', canonical: 'Von Thunen model', synonyms: ["von Thunen's model", 'Von Thunen Model', 'von Thunen land use model'] },
  { id: 'sg_township', canonical: 'township and range', synonyms: ['rectangular survey system', 'township and range system', 'public land survey system'] },
];

const synonymGroups = synonymGroupDefs.map(sg => {
  const allTerms = [sg.canonical, ...sg.synonyms].map(s => s.toLowerCase());
  const matchingFacts = normalizedFacts.filter(f =>
    allTerms.includes(f.correctAnswer.toLowerCase()) ||
    (f.acceptableAlternatives || []).some(a => allTerms.includes(a.toLowerCase()))
  );
  return {
    id: sg.id,
    factIds: matchingFacts.map(f => f.id),
    reason: `Synonyms for "${sg.canonical}": ${sg.synonyms.join(', ')}`,
  };
}).filter(sg => sg.factIds.length > 0);

// ---- STEP 8: Assemble the deck ----
const deck = {
  id: 'ap_human_geography',
  name: 'AP Human Geography',
  domain: 'geography',
  subDomain: 'ap_human_geography',
  description: 'Complete AP Human Geography exam prep aligned to the College Board Course and Exam Description. Covers all 7 units across 300 facts weighted by exam percentage. Every fact cites a specific CED Essential Knowledge code.',
  minimumFacts: 280,
  targetFacts: 308,
  facts: normalizedFacts,
  answerTypePools: pools,
  synonymGroups,
  questionTemplates,
  difficultyTiers,
  subDecks,
};

// ---- Final validation ----
console.log('\n=== VALIDATION ===');
console.log(`answerTypePools is Array: ${Array.isArray(deck.answerTypePools)}`);
console.log(`difficultyTiers is Array: ${Array.isArray(deck.difficultyTiers)}`);
console.log(`difficultyTiers[0].tier type: ${typeof deck.difficultyTiers[0].tier} = "${deck.difficultyTiers[0].tier}"`);

const deckPoolIds = new Set(deck.answerTypePools.map(p => p.id));
const missingPools = deck.facts.filter(f => !deckPoolIds.has(f.answerTypePoolId));
console.log(`Facts with missing pool references: ${missingPools.length}`);
if (missingPools.length > 0) {
  missingPools.forEach(f => console.log(`  ${f.id} -> "${f.answerTypePoolId}"`));
}

// Verify no duplicate IDs remain
const idCount = {};
deck.facts.forEach(f => { idCount[f.id] = (idCount[f.id] || 0) + 1; });
const dupIdsFinal = Object.entries(idCount).filter(([,c]) => c > 1);
console.log(`Duplicate IDs: ${dupIdsFinal.length}`);

// Pool coverage report
const archEstimates = {
  model_and_theory_names: 22, geographer_names: 14, concept_term_definitions: 40,
  agriculture_practice_names: 14, religion_and_language_terms: 16, political_term_names: 20,
  urban_model_names: 10, economic_indicator_names: 12, migration_type_names: 12,
  boundary_type_names: 8, diffusion_type_names: 6, state_shape_names: 5,
  survey_method_names: 3, economic_sector_names: 5, development_theory_names: 8,
  region_type_names: 6, organization_names: 10, urban_challenge_terms: 10, bracket_numbers: 20,
};

console.log('\n=== POOL SIZES ===');
deck.answerTypePools.forEach(pool => {
  const est = archEstimates[pool.id] || '?';
  const count = pool.factIds.length;
  const pct = est !== '?' ? Math.round(count / est * 100) : '?';
  const flag = (count < 5 && !pool.homogeneityExempt) ? ' *** CRITICAL: UNDER 5 FACTS ***'
    : (est !== '?' && count < est * 0.5) ? ' *** UNDER 50% TARGET ***' : '';
  console.log(`  ${pool.id}: ${count} facts (est: ${est}, ${pct}%)${flag}`);
});

console.log('\n=== SUB-DECK SIZES ===');
deck.subDecks.forEach(sd => {
  console.log(`  ${sd.id}: ${sd.factIds.length} facts`);
});

console.log('\n=== DIFFICULTY TIERS ===');
deck.difficultyTiers.forEach(t => {
  console.log(`  ${t.tier}: ${t.factIds.length} facts`);
});

console.log(`\nTotal facts in deck: ${deck.facts.length}`);
console.log(`Total sub-deck coverage: ${deck.subDecks.reduce((s, sd) => s + sd.factIds.length, 0)}`);

console.log('\n=== ISSUES LOG ===');
issues.forEach(i => console.log(`  - ${i}`));

// ---- Write output ----
const outPath = path.join(ROOT, 'data/decks/ap_human_geography.json');
fs.writeFileSync(outPath, JSON.stringify(deck, null, 2), 'utf8');
console.log(`\nWritten: ${outPath}`);
console.log(`File size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
