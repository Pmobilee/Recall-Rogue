/**
 * fix-qa.mjs — QA fixes for computer_science.json
 *
 * Applies the following changes:
 *   1. Remove cross-batch duplicates (keep batch 5/4 versions, delete batch 4/7 duplicates)
 *   2. Remove near-duplicate cs_1_analytical_engine_punch_cards
 *   3. Fix bad distractors (7 facts)
 *   4. Fix ambiguous/wrong questions (8 facts)
 *   5. Rebuild answerTypePools, subDecks, difficultyTiers factIds
 *
 * Run: node data/decks/_wip/computer_science/fix-qa.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DECK_PATH = resolve(__dirname, '../../computer_science.json');

const deck = JSON.parse(readFileSync(DECK_PATH, 'utf8'));

const changes = [];
let removedCount = 0;

// ─── 1. IDs to DELETE (duplicates) ───────────────────────────────────────────

const IDS_TO_DELETE = new Set([
  'cs_4_arpanet_first_message',     // dup of cs_5_arpanet_first_message
  'cs_4_arpanet_year',              // dup of cs_5_arpanet_first_message_date
  'cs_7_linux_creator',             // dup of cs_4_linux_creator
  'cs_7_linux_year',                // dup of cs_4_linux_year
  'cs_1_analytical_engine_punch_cards', // dup of cs_0_charles_babbage_analytical_engine
]);

const originalCount = deck.facts.length;
deck.facts = deck.facts.filter(f => {
  if (IDS_TO_DELETE.has(f.id)) {
    changes.push(`DELETED: ${f.id}`);
    removedCount++;
    return false;
  }
  return true;
});
changes.push(`Removed ${removedCount} duplicate facts (${originalCount} → ${deck.facts.length})`);


// ─── Helper ───────────────────────────────────────────────────────────────────

function patchFact(id, patchFn) {
  const fact = deck.facts.find(f => f.id === id);
  if (!fact) {
    changes.push(`WARN: fact not found: ${id}`);
    return;
  }
  patchFn(fact);
  changes.push(`PATCHED: ${id}`);
}


// ─── 2. Fix distractors ───────────────────────────────────────────────────────

// cs_0_brendan_eich_javascript_original_name
// - Change question (Mocha was a real earlier internal name — too close to correct)
// - Remove "Mocha" from distractors, add to acceptableAlternatives
patchFact('cs_0_brendan_eich_javascript_original_name', fact => {
  fact.quizQuestion = "What was JavaScript called immediately before Netscape renamed it to capitalise on Java's popularity?";
  fact.acceptableAlternatives = ['Mocha'];
  fact.distractors = fact.distractors.filter(d => d !== 'Mocha');
  // Add a replacement distractor to keep count healthy
  if (!fact.distractors.includes('JScript')) {
    fact.distractors.push('JScript');
  }
});

// cs_4_enigma_breakers
// - Add "Gordon Welchman" to acceptableAlternatives
// - Remove "Gordon Welchman" from distractors, replace with "Charles Babbage"
patchFact('cs_4_enigma_breakers', fact => {
  if (!fact.acceptableAlternatives.includes('Gordon Welchman')) {
    fact.acceptableAlternatives.push('Gordon Welchman');
  }
  fact.distractors = fact.distractors.filter(d => d !== 'Gordon Welchman');
  if (!fact.distractors.includes('Charles Babbage')) {
    fact.distractors.push('Charles Babbage');
  }
});

// cs_5_mosaic_creator
// - Remove "Eric Bina" from distractors (co-creator — not wrong enough)
// - Replace with "Tim O'Reilly"
patchFact('cs_5_mosaic_creator', fact => {
  fact.distractors = fact.distractors.filter(d => d !== 'Eric Bina');
  if (!fact.distractors.includes("Tim O'Reilly")) {
    fact.distractors.push("Tim O'Reilly");
  }
});

// cs_6_turing_test_paper
// - Remove "Can Machines Think?" from distractors (it's the paper's opening question — ambiguous)
// - Replace with "Artificial Neural Computations"
patchFact('cs_6_turing_test_paper', fact => {
  fact.distractors = fact.distractors.filter(d => d !== 'Can Machines Think?');
  if (!fact.distractors.includes('Artificial Neural Computations')) {
    fact.distractors.push('Artificial Neural Computations');
  }
});

// cs_3_mergesort_complexity
// - Add "Θ(n log n)" to acceptableAlternatives (equivalent notation)
// - Remove "Θ(n log n)" from distractors, replace with "O(n + log n)"
patchFact('cs_3_mergesort_complexity', fact => {
  if (!fact.acceptableAlternatives.includes('Θ(n log n)')) {
    fact.acceptableAlternatives.push('Θ(n log n)');
  }
  fact.distractors = fact.distractors.filter(d => d !== 'Θ(n log n)');
  if (!fact.distractors.includes('O(n + log n)')) {
    fact.distractors.push('O(n + log n)');
  }
});

// cs_3_np_complete_first_problem
// - Remove "3-SAT" from acceptableAlternatives
//   (3-SAT is a *specific* NP-complete problem proved from SAT, not the Cook-Levin first problem itself)
patchFact('cs_3_np_complete_first_problem', fact => {
  fact.acceptableAlternatives = fact.acceptableAlternatives.filter(a => a !== '3-SAT');
});

// cs_1_von_neumann_vs_harvard
// - Remove "stored-program computer" from distractors (describes the same concept — too confusing)
// - Replace with "dataflow architecture"
patchFact('cs_1_von_neumann_vs_harvard', fact => {
  fact.distractors = fact.distractors.filter(d => d !== 'stored-program computer');
  if (!fact.distractors.includes('dataflow architecture')) {
    fact.distractors.push('dataflow architecture');
  }
});

// cs_1_harvard_architecture_origin
// - Remove "stored-program computer" from distractors (same issue — describes the concept)
// - Replace with "systolic array architecture"
patchFact('cs_1_harvard_architecture_origin', fact => {
  fact.distractors = fact.distractors.filter(d => d !== 'stored-program computer');
  if (!fact.distractors.includes('systolic array architecture')) {
    fact.distractors.push('systolic array architecture');
  }
});

// cs_1_four_generations_summary — correct answer: "microprocessor"
// - Remove "integrated circuit" from distractors (3rd gen, closely related — misleading)
// - Replace with "quantum processor"
patchFact('cs_1_four_generations_summary', fact => {
  fact.distractors = fact.distractors.filter(d => d !== 'integrated circuit');
  if (!fact.distractors.includes('quantum processor')) {
    fact.distractors.push('quantum processor');
  }
});

// cs_1_transistor_replaced — correct answer: "vacuum tube"
// - Remove "relay" from distractors (relays are electromechanical, vacuum tubes electronic — both
//   were replaced, making "relay" partially correct and thus ambiguous)
// - Replace with "punched card"
patchFact('cs_1_transistor_replaced', fact => {
  fact.distractors = fact.distractors.filter(d => d !== 'relay');
  if (!fact.distractors.includes('punched card')) {
    fact.distractors.push('punched card');
  }
});


// ─── 3. Fix ambiguous / wrong questions ───────────────────────────────────────

// cs_5_netflix_founders — question currently says Netflix "charged late fees — unlike Blockbuster"
// which reverses who charged them. Netflix was subscription-based; Blockbuster charged late fees.
patchFact('cs_5_netflix_founders', fact => {
  fact.quizQuestion = "Which two co-founders launched Netflix in 1997 as a subscription-based DVD-by-mail service that competed with Blockbuster's brick-and-mortar model?";
});

// cs_7_github_founders — remove "(not Stack Overflow's Joel Spolsky)" hint
patchFact('cs_7_github_founders', fact => {
  fact.quizQuestion = "GitHub was founded in February 2008 by four people — which of these is the correct set of founders?";
});

// cs_0_larry_page_pagerank — remove "named after him" hint from question
patchFact('cs_0_larry_page_pagerank', fact => {
  fact.quizQuestion = "Which Stanford PhD student co-invented the PageRank algorithm that became the foundation of Google's search engine?";
});

// cs_0_vint_cerf_tcp_ip — change "father of the Internet" to "one of the 'fathers of the Internet'"
patchFact('cs_0_vint_cerf_tcp_ip', fact => {
  fact.quizQuestion = "Who co-designed the TCP/IP protocol suite with Robert Kahn in the 1970s, earning the title of one of the 'fathers of the Internet'?";
});

// cs_6_alphago_creator — remove "Google" as standalone acceptable alternative
// (AlphaGo was created by DeepMind, not Google directly — "Google" alone is imprecise)
patchFact('cs_6_alphago_creator', fact => {
  fact.acceptableAlternatives = fact.acceptableAlternatives.filter(a => a !== 'Google');
  // Keep "DeepMind" and "Google DeepMind" only
  if (!fact.acceptableAlternatives.includes('DeepMind')) {
    fact.acceptableAlternatives.push('DeepMind');
  }
});

// cs_0_james_gosling_java_name — add "Green" to acceptableAlternatives
// (Java went Oak → Green → Java; "Green" was used internally during the rename phase)
patchFact('cs_0_james_gosling_java_name', fact => {
  if (!fact.acceptableAlternatives.includes('Green')) {
    fact.acceptableAlternatives.push('Green');
  }
});

// cs_1_floppy_disk_first_size — answer is "8" (inches) but pool is bracket_numbers
// The correct answer "8" is not in bracket notation {8}, so it displays as a text choice.
// Change answerTypePoolId to technology_terms and add proper distractors.
patchFact('cs_1_floppy_disk_first_size', fact => {
  fact.answerTypePoolId = 'technology_terms';
  // Add distractors representing other floppy sizes + plausible wrong sizes
  fact.distractors = ['3.5', '5.25', '12', '14', '6', '10', '4', '16'];
});


// ─── 4. Rebuild metadata ──────────────────────────────────────────────────────

const factIds = new Set(deck.facts.map(f => f.id));

// Rebuild answerTypePools factIds
for (const pool of deck.answerTypePools) {
  pool.factIds = pool.factIds.filter(id => factIds.has(id));
}

// Rebuild subDecks factIds
for (const sub of deck.subDecks) {
  sub.factIds = sub.factIds.filter(id => factIds.has(id));
}

// Rebuild difficultyTiers factIds
for (const tier of deck.difficultyTiers) {
  tier.factIds = tier.factIds.filter(id => factIds.has(id));
}

changes.push(`Rebuilt answerTypePools, subDecks, difficultyTiers — removed stale IDs`);


// ─── 5. Write output ──────────────────────────────────────────────────────────

writeFileSync(DECK_PATH, JSON.stringify(deck, null, 2));
changes.push(`Written to: ${DECK_PATH}`);


// ─── 6. Summary ───────────────────────────────────────────────────────────────

console.log('\n=== fix-qa.mjs summary ===\n');
for (const line of changes) {
  console.log(' ', line);
}
console.log(`\nTotal facts: ${deck.facts.length} (was ${originalCount})`);
console.log('\nDone. Run: node scripts/verify-curated-deck.mjs computer_science');
