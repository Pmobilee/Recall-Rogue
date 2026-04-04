/**
 * AP Biology distractor quality fix.
 *
 * Problem: Many facts have distractors written as long sentences
 * (e.g., "The tendency of water to attract..." 57c) when the correct answer
 * is a short term name (e.g., "Cohesion" 8c).
 *
 * Fix strategy:
 * 1. For distractors with "Term (explanation)" pattern → strip to just "Term"
 * 2. For distractors that are full descriptive sentences → replace with
 *    actual short term names that are plausible wrong answers
 *
 * Run: node scripts/fix-ap-bio-distractors.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

const DECK_PATH = 'data/decks/ap_biology.json';
const deck = JSON.parse(readFileSync(DECK_PATH, 'utf8'));

const factIdx = new Map(deck.facts.map((f, i) => [f.id, i]));
function fact(id) { return deck.facts[factIdx.get(id)]; }

let totalFixed = 0;

function fixDistractors(id, newDistractors) {
  const f = fact(id);
  if (!f) throw new Error(`Fact not found: ${id}`);
  console.log(`  [${id}] "${f.correctAnswer}" — replacing ${f.distractors.length} distractors`);
  f.distractors = newDistractors;
  totalFixed++;
}

// Helper: strip explanation parentheticals from distractors
function stripExplanation(d) {
  let t = d;
  // 'Term (explanation...' → 'Term'
  t = t.replace(/\s*\([^)]*\).*$/, '').trim();
  // 'Term; explanation' → 'Term'
  t = t.replace(/\s*;.*$/, '').trim();
  // 'Term — explanation' or 'Term – explanation' → 'Term'
  t = t.replace(/\s*[—–]\s+[a-z].*$/, '').trim();
  // 'Term - lowercase explanation' → 'Term'
  t = t.replace(/\s+-\s+[a-z].*$/, '').trim();
  return t;
}

function trimDistractors(id) {
  const f = fact(id);
  if (!f) throw new Error(`Fact not found: ${id}`);
  const orig = [...f.distractors];
  f.distractors = f.distractors.map(stripExplanation);
  const changed = f.distractors.filter((d, i) => d !== orig[i]).length;
  if (changed > 0) {
    console.log(`  [${id}] "${f.correctAnswer}" — trimmed ${changed} distractors`);
    totalFixed++;
  }
}

// ============================================================
// Group 1: Distractors with "Term (explanation)" pattern
// These can be fixed by stripping the explanation
// ============================================================
console.log('\n=== Trimming "Term (explanation)" distractors ===');

// molecule_names pool — abbreviations with long parenthetical distractors
const abbrevFacts = [
  'ap_bio_cdk_function',     // CDK
  'ap_bio_u4_027',           // IP₃
  'ap_bio_cc_006',           // G3P
  'ap_bio_nrg_001',          // ATP (second one)
  'ap_bio_u4_023',           // cAMP
  'ap_bio_u4_038',           // Ras
  'ap_bio_cc_005',           // 3-PGA
  'ap_bio_u4_040',           // ERK kinase
  'ap_bio_u4_081',           // CDKs
  'ap_bio_u4_089',           // Rb protein
  'ap_bio_u4_097',           // Growth factors
  'ap_bio_ribozymes_def',    // Ribozymes
  'ap_bio_p53_tumor_suppressor', // p53
  'ap_bio_u4_088',           // p53
  'ap_bio_cc_004',           // RuBP
  'ap_bio_etc_004',          // Ubiquinone
  'ap_bio_tca_007',          // {2}
  'ap_bio_great_oxidation_event', // {2.4} bya
  'ap_bio_cambrian_explosion', // {541} mya
  'ap_bio_prokaryote_2billion', // {2} bya
  'ap_bio_hw_worked_example', // 48%
  'ap_bio_u6_038',           // A site
  'ap_bio_amphipathic',      // Amphipathic
  'ap_bio_gpcr_example',     // GPCR
];

for (const id of abbrevFacts) {
  trimDistractors(id);
}

// ============================================================
// Group 2: bracket_numbers with long distractors
// ============================================================
console.log('\n=== Fixing bracket_numbers with explanatory distractors ===');

// {2} hydrogen bonds per A-T, {3} per G-C
fixDistractors('ap_bio_u6_008', ['{1}', '{3}', '{4}', '{5}']);
fixDistractors('ap_bio_u6_009', ['{1}', '{2}', '{4}', '{5}']);

// {1} FADH2 per TCA turn
const tca007 = fact('ap_bio_tca_007');
if (tca007) {
  fixDistractors('ap_bio_tca_007', ['{2}', '{3}', '{0}', '{4}']);
}

// {1} NADH per TCA turn
const tca006 = fact('ap_bio_tca_006');
if (tca006) {
  fixDistractors('ap_bio_tca_006', ['{2}', '{3}', '{0}', '{4}']);
}

// ============================================================
// Group 3: ATP facts with full-sentence descriptive distractors
// ============================================================
console.log('\n=== Fixing ATP and molecule_names full-sentence distractors ===');

// ap_bio_atp_structure: answer=ATP, distractors should be other energy molecules
fixDistractors('ap_bio_atp_structure', [
  'ADP',
  'AMP',
  'GTP',
  'NADPH',
  'FADH₂',
  'Acetyl-CoA',
  'NAD⁺',
  'cAMP'
]);

// ============================================================
// Group 4: Water property facts with descriptive sentence distractors
// All these have short term answers but description-sentence distractors
// ============================================================
console.log('\n=== Fixing water property facts ===');

// ap_bio_cohesion: answer=Cohesion (8c)
fixDistractors('ap_bio_cohesion', [
  'Adhesion',
  'Surface tension',
  'Specific heat',
  'Solvent property',
  'Evaporative cooling',
  'Capillary action',
  'Hydrophobicity',
  'Osmosis'
]);

// ap_bio_adhesion: answer=Adhesion (8c)
fixDistractors('ap_bio_adhesion', [
  'Cohesion',
  'Surface tension',
  'Osmosis',
  'Diffusion',
  'Hydrophobicity',
  'Capillary action',
  'Specific heat',
  'Polarity'
]);

// ap_bio_hydrogen_bond: answer=Hydrogen bond (13c)
fixDistractors('ap_bio_hydrogen_bond', [
  'Covalent bond',
  'Ionic bond',
  'Van der Waals force',
  'Peptide bond',
  'Disulfide bond',
  'Ester bond',
  'Metallic bond',
  'Hydrophobic interaction'
]);

// ============================================================
// Group 5: function_terms facts with sentence distractors
// ============================================================
console.log('\n=== Fixing function_terms with sentence distractors ===');

// ap_bio_surface_tension: answer=Surface tension (15c)
fixDistractors('ap_bio_surface_tension', [
  'Capillary action',
  'Cohesion',
  'Adhesion',
  'Evaporative cooling',
  'Osmotic pressure',
  'Specific heat capacity',
  'Hydrophobicity',
  'Van der Waals attraction'
]);

// ap_bio_capillary_action: answer=Capillary action (16c)
fixDistractors('ap_bio_capillary_action', [
  'Osmosis',
  'Active transport',
  'Root pressure',
  'Transpiration pull',
  'Bulk flow',
  'Diffusion gradient',
  'Hydrostatic pressure',
  'Turgor pressure'
]);

// ap_bio_phospholipid_bilayer: answer=Phospholipid bilayer (20c)
const pbf = fact('ap_bio_phospholipid_bilayer');
if (pbf && pbf.distractors && pbf.distractors.some(d => d.length > 40)) {
  fixDistractors('ap_bio_phospholipid_bilayer', [
    'Fluid mosaic model',
    'Lipid monolayer',
    'Cell wall',
    'Glycocalyx',
    'Nuclear envelope',
    'Thylakoid membrane',
    'Tonoplast',
    'Plasma membrane'
  ]);
}

// ============================================================
// Group 6: Other term_definitions with sentence distractors
// ============================================================
console.log('\n=== Fixing term_definitions with sentence distractors ===');

// ap_bio_buffer: answer=Buffer (6c)
fixDistractors('ap_bio_buffer', [
  'Solvent',
  'Catalyst',
  'Electrolyte',
  'Indicator',
  'Titrant',
  'Substrate',
  'Cofactor',
  'Coenzyme'
]);

// ap_bio_ps_003 (Stroma): answer=Stroma (6c)
const ps003 = fact('ap_bio_ps_003');
if (ps003 && ps003.distractors && ps003.distractors.some(d => d.length > 20)) {
  fixDistractors('ap_bio_ps_003', [
    'Thylakoid',
    'Matrix',
    'Intermembrane space',
    'Cristae',
    'Cytoplasm',
    'Nucleoid',
    'Lumen',
    'Granum'
  ]);
}

// ap_bio_ice_density_anomaly: answer=Ice density anomaly (19c)
const ida = fact('ap_bio_ice_density_anomaly');
if (ida && ida.distractors && ida.distractors.some(d => d.length > 40)) {
  fixDistractors('ap_bio_ice_density_anomaly', [
    'Specific heat capacity',
    'Surface tension',
    'Cohesion',
    'Evaporative cooling',
    'Capillary action',
    'Polarity',
    'Universal solvent property',
    'Hydrogen bonding'
  ]);
}

// ap_bio_chnops: answer=C, H, N, O, P, S (16c)
const chnops = fact('ap_bio_chnops');
if (chnops && chnops.distractors && chnops.distractors.some(d => d.length > 40)) {
  fixDistractors('ap_bio_chnops', [
    'C, H, O, N, Ca, K',
    'C, H, N, O, Fe, Mg',
    'C, H, O, P, Ca, Na',
    'H, O, N, K, Ca, Cl',
    'C, O, N, S, Fe, Zn',
    'C, H, N, P, K, Na',
    'C, H, O, N, Mg, S',
    'H, O, C, Cl, Ca, P'
  ]);
}

// ap_bio_peptide_bond: answer=Peptide bond (12c)
const pepb = fact('ap_bio_peptide_bond');
if (pepb && pepb.distractors && pepb.distractors.some(d => d.length > 40)) {
  fixDistractors('ap_bio_peptide_bond', [
    'Hydrogen bond',
    'Disulfide bond',
    'Ester linkage',
    'Glycosidic bond',
    'Phosphodiester bond',
    'Ionic interaction',
    'Van der Waals force',
    'Amide bond'
  ]);
}

// ap_bio_glycosidic_bond: answer=Glycosidic bond (15c)
const glycb = fact('ap_bio_glycosidic_bond');
if (glycb && glycb.distractors && glycb.distractors.some(d => d.length > 40)) {
  fixDistractors('ap_bio_glycosidic_bond', [
    'Peptide bond',
    'Ester linkage',
    'Phosphodiester bond',
    'Hydrogen bond',
    'Disulfide bond',
    'Van der Waals force',
    'Ionic bond',
    'Glycoprotein link'
  ]);
}

// ap_bio_phosphodiester_bond: answer=Phosphodiester bond (19c)
const phosb = fact('ap_bio_phosphodiester_bond');
if (phosb && phosb.distractors && phosb.distractors.some(d => d.length > 40)) {
  fixDistractors('ap_bio_phosphodiester_bond', [
    'Glycosidic bond',
    'Peptide bond',
    'Hydrogen bond',
    'Ester linkage',
    'Disulfide bond',
    'N-glycosidic bond',
    'Phosphoanhydride bond',
    'Phosphomonoester bond'
  ]);
}

// ap_bio_hydroxyl_group: answer=Hydroxyl group (-OH) (20c)
const hydroxyl = fact('ap_bio_hydroxyl_group');
if (hydroxyl && hydroxyl.distractors && hydroxyl.distractors.some(d => d.length > 40)) {
  fixDistractors('ap_bio_hydroxyl_group', [
    'Carboxyl group (-COOH)',
    'Amino group (-NH₂)',
    'Phosphate group (-PO₄)',
    'Carbonyl group (C=O)',
    'Sulfhydryl group (-SH)',
    'Methyl group (-CH₃)',
    'Aldehyde group (-CHO)',
    'Amine group (-NH₂)'
  ]);
}

// ap_bio_amino_group: answer=Amino group (-NH2) (18c)
const aminog = fact('ap_bio_amino_group');
if (aminog && aminog.distractors && aminog.distractors.some(d => d.length > 40)) {
  fixDistractors('ap_bio_amino_group', [
    'Carboxyl group (-COOH)',
    'Hydroxyl group (-OH)',
    'Phosphate group (-PO₄)',
    'Carbonyl group (C=O)',
    'Sulfhydryl group (-SH)',
    'Methyl group (-CH₃)',
    'Ester group (-COO-)',
    'Aldehyde group (-CHO)'
  ]);
}

// ap_bio_carbonyl_group: answer=Carbonyl group (C=O) (20c)
const carbonylg = fact('ap_bio_carbonyl_group');
if (carbonylg && carbonylg.distractors && carbonylg.distractors.some(d => d.length > 40)) {
  fixDistractors('ap_bio_carbonyl_group', [
    'Hydroxyl group (-OH)',
    'Carboxyl group (-COOH)',
    'Amino group (-NH₂)',
    'Phosphate group (-PO₄)',
    'Sulfhydryl group (-SH)',
    'Methyl group (-CH₃)',
    'Aldehyde group (-CHO)',
    'Ketone group (C=O−R)'
  ]);
}

// ap_bio_methyl_group: answer=Methyl group (-CH₃) (19c)
const methylg = fact('ap_bio_methyl_group');
if (methylg && methylg.distractors && methylg.distractors.some(d => d.length > 40)) {
  fixDistractors('ap_bio_methyl_group', [
    'Acetyl group (-CH₃CO)',
    'Hydroxyl group (-OH)',
    'Carboxyl group (-COOH)',
    'Amino group (-NH₂)',
    'Phosphate group (-PO₄)',
    'Carbonyl group (C=O)',
    'Sulfhydryl group (-SH)',
    'Ester group (-COO-)'
  ]);
}

// ap_bio_ester_linkage: answer=Ester linkage (13c)
const esterl = fact('ap_bio_ester_linkage');
if (esterl && esterl.distractors && esterl.distractors.some(d => d.length > 40)) {
  fixDistractors('ap_bio_ester_linkage', [
    'Glycosidic bond',
    'Peptide bond',
    'Phosphodiester bond',
    'Hydrogen bond',
    'Disulfide bond',
    'Amide bond',
    'Ether linkage',
    'Ionic bond'
  ]);
}

// ============================================================
// Group 7: organelle_structures with explanatory distractors
// ============================================================
console.log('\n=== Fixing organelle_structures with explanatory distractors ===');

// Check which organelle_structures facts have bad distractors
for (const pool of deck.answerTypePools) {
  if (pool.id !== 'organelle_structures') continue;
  for (const fid of pool.factIds) {
    const f = fact(fid);
    if (!f || !f.distractors) continue;
    if (f.distractors.some(d => d.length > f.correctAnswer.length * 2.5 + 20)) {
      console.log('  Needs fix: ' + fid + ' ans=[' + f.correctAnswer.length + 'c] ' + f.correctAnswer);
      f.distractors.forEach(d => {
        if (d.length > f.correctAnswer.length * 2.5 + 20) {
          console.log('    BAD [' + d.length + 'c]: ' + d.slice(0,60));
        }
      });
    }
  }
}

// Fix rough ER
const rougher = fact('ap_bio_rough_er') || deck.facts.find(f => f.id === 'ap_bio_rough_er_function');
if (rougher && rougher.distractors && rougher.distractors.some(d => d.length > 50)) {
  fixDistractors(rougher.id, [
    'Smooth endoplasmic reticulum',
    'Golgi apparatus',
    'Nuclear envelope',
    'Lysosome',
    'Vacuole',
    'Peroxisome',
    'Plasma membrane',
    'Tonoplast'
  ]);
}

// Fix organelle_structures facts that need attention
const orgStructureProblemFacts = deck.facts.filter(f =>
  f.answerTypePoolId === 'organelle_structures' &&
  f.distractors &&
  f.distractors.some(d => d.includes('(') && d.length > 50)
);

for (const f of orgStructureProblemFacts) {
  // Strip parenthetical explanations from distractors
  const orig = [...f.distractors];
  f.distractors = f.distractors.map(d => {
    // 'Term (long explanation)' → 'Term'
    return d.replace(/\s*\([^)]{20,}\).*$/, '').trim();
  });
  const changed = f.distractors.filter((d,i) => d !== orig[i]).length;
  if (changed > 0) {
    console.log(`  [${f.id}] trimmed ${changed} organelle distractors`);
    totalFixed++;
  }
}

// ============================================================
// Group 8: organism_names with sentence distractors instead of organism names
// ============================================================
console.log('\n=== Fixing organism_names with sentence distractors ===');

for (const f of deck.facts) {
  if (f.answerTypePoolId !== 'organism_names') continue;
  if (!f.distractors) continue;
  const longDists = f.distractors.filter(d => d.length > 50);
  if (longDists.length > 0) {
    const orig = [...f.distractors];
    f.distractors = f.distractors.map(d => stripExplanation(d));
    const changed = f.distractors.filter((d,i) => d !== orig[i]).length;
    if (changed > 0) {
      console.log(`  [${f.id}] "${f.correctAnswer}" — trimmed ${changed} organism distractors`);
      totalFixed++;
    }
  }
}

// ============================================================
// Group 9: disease_syndrome_names — PKU distractor is only 3c
// ============================================================
console.log('\n=== Fixing disease_syndrome_names length mismatches ===');

// The disease pool has PKU (3c) as a distractor — replace with full name
for (const f of deck.facts) {
  if (f.answerTypePoolId !== 'disease_syndrome_names') continue;
  if (!f.distractors) continue;
  const orig = [...f.distractors];
  f.distractors = f.distractors.map(d => {
    if (d === 'PKU') return 'Phenylketonuria';
    return d;
  });
  const changed = f.distractors.filter((d,i) => d !== orig[i]).length;
  if (changed > 0) {
    console.log(`  [${f.id}] replaced PKU → Phenylketonuria`);
    totalFixed++;
  }
}

// ============================================================
// Group 10: location_terms — A site distractor with sentence
// ============================================================
console.log('\n=== Fixing location_terms sentence distractors ===');

const asite = fact('ap_bio_u6_038');
if (asite && asite.distractors && asite.distractors.some(d => d.length > 20)) {
  fixDistractors('ap_bio_u6_038', [
    'P site',
    'E site',
    'Stroma',
    'Matrix',
    'Cytoplasm',
    'Thylakoid',
    'Nucleolus',
    'Intermembrane space'
  ]);
}

// ============================================================
// Save
// ============================================================
writeFileSync(DECK_PATH, JSON.stringify(deck, null, 2));
console.log(`\nFixed ${totalFixed} facts. Saved to ${DECK_PATH}`);
