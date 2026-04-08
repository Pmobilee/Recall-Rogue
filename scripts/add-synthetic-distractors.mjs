/**
 * add-synthetic-distractors.mjs
 *
 * Adds syntheticDistractors to answer-type pools across all curated decks
 * where factIds.length + syntheticDistractors.length < 15.
 *
 * Strategy: cross-pool borrowing + domain-specific term banks.
 * - For each undersized pool, attempt to borrow plausible distractors from
 *   OTHER pools in the same deck (same domain, different answer type = good
 *   wrong answers). Length-matched (within 2x character ratio).
 * - Supplement with a hardcoded domain-specific term bank when cross-pool
 *   borrowing does not yield enough candidates.
 *
 * Safety rules:
 * - Every synthetic is checked against ALL correctAnswer values in the deck
 *   (case-insensitive) — collisions are silently dropped.
 * - bracket_number pools (answers like "{5}") are SKIPPED — the runtime
 *   bracket system generates numeric distractors algorithmically.
 * - Synthetics are deduplicated within each pool.
 * - Pools with homogeneityExempt:true are skipped.
 *
 * Usage: node scripts/add-synthetic-distractors.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS_DIR = path.resolve(__dirname, '../data/decks');

const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_TOTAL = 15; // factIds.length + syntheticDistractors.length

// ---------------------------------------------------------------------------
// Domain-specific distractor banks for pools that can't be filled by
// cross-pool borrowing alone. Keys match deck pool IDs (exact or prefix).
// ---------------------------------------------------------------------------
const DOMAIN_BANKS = {
  // ── ap_human_geography ────────────────────────────────────────────────
  geographer_names: [
    'Johann Heinrich von Thünen', 'Alfred Weber', 'David Harvey', 'Doreen Massey',
    'Yi-Fu Tuan', 'Edward Soja', 'Torsten Hägerstrand', 'Waldo Tobler',
    'Peter Haggett', 'Ron Johnston', 'Friedrich Ratzel',
  ],
  agriculture_practice_names_short: [
    'terracing', 'fallowing', 'monoculture', 'polyculture', 'organic', 'dryland',
    'irrigated', 'slash-and-burn', 'vertical', 'hydroponic', 'agroforestry',
  ],
  agriculture_practice_names_long: [
    'truck farming', 'organic farming', 'collective farming', 'contract farming',
    'intercropping', 'double cropping', 'crop rotation', 'sustainable agriculture',
    'precision agriculture', 'factory farming',
  ],
  political_term_names_short: [
    'enclave', 'exclave', 'buffer zone', 'protectorate', 'mandate',
    'compact state', 'unitary state', 'federal state', 'theocracy', 'oligarchy',
  ],
  political_term_names_long: [
    'irredentism', 'balkanization', 'supranationalism', 'territorial integrity',
    'choke point', 'domino effect', 'zero-sum game', 'sphere of influence',
    'strategic alliance', 'political fragmentation',
  ],
  urban_model_names: [
    'Von Thünen Model', 'Weber Least-Cost Model', 'Christaller Central Place Theory',
    'Lösch Market Area Model', 'Bid-Rent Theory', 'Urban Hierarchy Model',
    'Growth Pole Theory', 'Alonso Bid-Rent Model', 'Squatter Settlement Model',
  ],
  boundary_type_names: [
    'geometric boundary', 'natural boundary', 'relic boundary', 'fortified boundary',
    'maritime boundary', 'air boundary', 'cultural boundary', 'linguistic boundary',
    'religious boundary', 'contested boundary',
  ],
  diffusion_type_names: [
    'maladaptive diffusion', 'network diffusion', 'reverse diffusion', 'cascade diffusion',
    'digital diffusion', 'global diffusion', 'cultural diffusion', 'technological diffusion',
    'economic diffusion', 'demographic diffusion',
  ],
  development_theory_names: [
    'Rostow\'s stages of growth', 'import substitution', 'export-led growth',
    'structural adjustment', 'sustainable development', 'human development index',
    'gender inequality index', 'fair trade movement', 'microcredit theory', 'trickle-down theory',
  ],
  urban_challenge_terms_short: [
    'slum', 'favela', 'shantytown', 'infill', 'sprawl',
    'exclusion', 'segregation', 'displacement', 'decline', 'revitalization',
  ],
  urban_challenge_terms_long: [
    'urban heat island', 'food desert', 'transit-oriented development', 'smart growth',
    'urban decline', 'suburban sprawl', 'crime mapping', 'urban ecology',
    'affordable housing', 'environmental justice',
  ],
  unit6_urban_concept_terms_short: [
    'suburb', 'exurb', 'hinterland', 'downtown', 'CBD',
    'zone', 'density', 'sprawl', 'infill', 'cluster',
  ],
  unit6_urban_concept_terms_long: [
    'bid-rent theory', 'central business district', 'urban morphology',
    'transit-oriented development', 'brownfield redevelopment', 'mixed-use development',
    'new urbanism principles', 'urban growth boundary', 'pedestrian-friendly design',
  ],
  unit5_agriculture_concept_terms_short: [
    'yield', 'soil', 'erosion', 'runoff', 'drought',
    'input', 'output', 'crop', 'farm', 'rural',
  ],
  unit5_agriculture_concept_terms_long: [
    'food security', 'seed bank', 'soil degradation', 'water scarcity',
    'land reform', 'agricultural surplus', 'food miles', 'locavore movement',
    'urban agriculture', 'vertical farming',
  ],
  unit7_economic_concept_terms_short: [
    'trade', 'tariff', 'quota', 'surplus', 'deficit',
    'labor', 'capital', 'wage', 'export', 'import',
  ],
  unit7_economic_concept_terms_long: [
    'global supply chain', 'trade deficit', 'foreign direct investment',
    'special economic zone', 'maquiladora', 'free trade zone',
    'world systems theory', 'industrial symbiosis', 'export processing zone',
  ],

  // ── human_anatomy ──────────────────────────────────────────────────────
  structure_respiratory_short: [
    'larynx', 'pharynx', 'bronchi', 'trachea', 'cilia',
    'pleura', 'diaphragm', 'alveoli', 'sinuses', 'turbinates',
  ],
  structure_respiratory_long: [
    'tracheal rings', 'bronchioles', 'pleural cavity', 'intercostal muscles',
    'respiratory bronchioles', 'alveolar sacs', 'nasal cavity', 'vocal cords',
    'respiratory epithelium', 'pulmonary capillaries', 'bronchial tree',
  ],
  structure_digestive_short: [
    'duodenum', 'jejunum', 'ileum', 'cecum', 'colon',
    'rectum', 'anus', 'villi', 'pylorus', 'esophagus',
    'fundus', 'antrum', 'cardia', 'rugae', 'mesentery',
  ],
  structure_digestive_long: [
    'Brunner\'s glands', 'haustra folds', 'ileocecal valve', 'mucous membrane',
    'submucosa', 'muscularis externa', 'hepatic flexure', 'splenic flexure',
    'sigmoid colon', 'gastric pits',
  ],
  structure_muscular_short: [
    'biceps', 'triceps', 'deltoid', 'trapezius', 'soleus',
    'gluteus', 'hamstring', 'quadriceps', 'flexor', 'extensor',
  ],
  structure_muscular_long: [
    'external oblique', 'internal oblique', 'erector spinae', 'latissimus dorsi',
    'pectoralis minor', 'serratus anterior', 'tibialis anterior', 'peroneus longus',
    'subscapularis', 'infraspinatus',
  ],
  structure_endocrine_long: [
    'adrenal medulla', 'adrenal cortex', 'thyroid follicles', 'islets of Langerhans',
    'pineal gland', 'hypothalamus', 'anterior pituitary', 'posterior pituitary',
    'parathyroid glands', 'chromaffin cells', 'Leydig cells', 'Sertoli cells',
    'zona fasciculata', 'zona glomerulosa',
  ],
  structure_reproductive_short: [
    'ovary', 'uterus', 'vagina', 'cervix', 'fimbriae',
    'testis', 'epididymis', 'seminal vesicle', 'prostate', 'scrotum',
  ],
  structure_reproductive_long: [
    'corpus luteum', 'endometrium', 'myometrium', 'fallopian tube',
    'rete testis', 'vas deferens', 'bulbourethral gland', 'seminal plasma',
    'interstitial cells', 'sertoli cells', 'zona pellucida', 'corpus albicans',
  ],
  structure_urinary_long: [
    'renal cortex', 'renal medulla', 'collecting duct', 'loop of Henle',
    'ureter', 'urethra', 'renal pelvis', 'nephron tubule',
    'glomerular capsule', 'renal calyx',
  ],
  structure_integumentary_short: [
    'dermis', 'epidermis', 'follicle', 'sebum', 'keratin',
    'melanin', 'stratum', 'cuticle', 'nails', 'pores',
  ],
  structure_integumentary_long: [
    'stratum granulosum', 'stratum lucidum', 'stratum spinosum', 'Meissner\'s corpuscle',
    'Pacinian corpuscle', 'arrector pili muscle', 'apocrine gland', 'eccrine gland',
    'dermal papillae', 'subcutaneous fat',
  ],
  organ_names: [
    'pancreas', 'thyroid', 'adrenal gland', 'spleen', 'thymus',
    'appendix', 'gallbladder', 'bladder', 'prostate', 'uterus',
  ],
  clinical_terms_short: [
    'edema', 'cyanosis', 'ischemia', 'necrosis', 'fibrosis',
    'stenosis', 'occlusion', 'perfusion', 'infarction', 'atrophy',
  ],
  visual_urinary_short: [
    'cortex', 'medulla', 'pelvis', 'calyx', 'ureter',
    'nephron', 'glomerulus', 'tubule', 'capsule', 'hilum', 'papilla',
  ],
  visual_reproductive_short: [
    'ovary', 'uterus', 'follicle', 'cervix', 'fallopian',
    'testis', 'epididymis', 'prostate', 'seminal', 'scrotum',
  ],
  visual_general_short: [
    'cortex', 'capsule', 'medulla', 'hilum', 'fascia',
    'lumen', 'septum', 'trabecula', 'stroma', 'parenchyma',
  ],

  // ── ap_microeconomics ──────────────────────────────────────────────────
  curve_and_graph_names_short: [
    'isocost', 'isoquant', 'Engel curve', 'offer curve', 'reaction curve',
    'Edgeworth box', 'indifference curve', 'price-consumption curve',
    'income-consumption curve', 'contract curve',
  ],
  curve_and_graph_names_mid: [
    'long-run average cost', 'short-run supply', 'marginal factor cost',
    'average variable cost', 'market demand curve', 'backward-bending supply',
    'perfectly elastic demand', 'kinked demand curve', 'Giffen good demand',
  ],
  econ_concept_terms_short: [
    'elasticity', 'efficiency', 'scarcity', 'incentive', 'margin',
    'utility', 'welfare', 'subsidy', 'tariff', 'quota',
  ],
  equation_formulas_micro_short: [
    'TC / Q', 'TR / Q', 'TR - TC', 'TR - VC', 'ΔTR / ΔQ',
    'ΔTC / ΔQ', 'FC / Q', 'TR - FC', 'P × Q', 'w / MPL',
  ],
  equation_formulas_micro_mid: [
    'Wage = Marginal Revenue Product of Labor', 'Price = Marginal Cost = Minimum ATC',
    'Profit = Total Revenue minus Total Cost', 'Average Fixed Cost = Fixed Cost divided by Quantity',
    'Marginal Revenue equals the slope of Total Revenue',
    'Total Cost = Fixed Cost plus Variable Cost',
  ],
  market_outcome_descriptions_short: [
    'price ceiling', 'price floor', 'black market', 'excess demand',
    'quantity restriction', 'voluntary exchange', 'rationing',
    'market clearing', 'rent seeking', 'bargaining',
    'signaling', 'screening', 'bundling',
  ],
  market_outcome_descriptions_mid: [
    'social optimum is achieved', 'resources are misallocated', 'monopoly restricts output',
    'competitive equilibrium is maintained', 'prices are above marginal cost',
    'consumer gains at producer expense', 'market clears at equilibrium',
  ],
  market_structure_names_short: [
    'duopoly', 'franchise', 'syndicate', 'guild', 'trust',
    'conglomerate', 'cooperative', 'joint venture', 'consortium', 'cartel', 'holding company',
  ],
  market_structure_names_long: [
    'price-taking competitive firm', 'non-cooperative oligopoly', 'first-mover advantage',
    'limit pricing strategy', 'cost-plus pricing model', 'penetration pricing strategy',
    'price discrimination market', 'predatory pricing scheme', 'monopolistic competition',
  ],
  policy_instrument_names_short: [
    'tax', 'fine', 'ban', 'cap', 'credit',
    'rebate', 'voucher', 'ceiling', 'floor', 'permit',
  ],
  policy_instrument_names_long: [
    'Pigouvian tax', 'tradable permits', 'command and control', 'performance standard',
    'technology mandate', 'information disclosure', 'public provision', 'price support',
    'production quota', 'import tariff',
  ],
  shift_direction_terms_short: [
    'rises', 'falls', 'up', 'down', 'inward',
    'outward', 'steeper', 'flatter', 'unchanged', 'ambiguous',
  ],
  surplus_welfare_terms_short: [
    'shortage', 'excess supply', 'deadweight loss', 'economic rent', 'Pareto efficiency',
    'Kaldor-Hicks efficiency', 'willingness to pay', 'reservation price', 'buyer surplus',
  ],
  surplus_welfare_terms_long: [
    'involuntary unemployment rate', 'structural adjustment program',
    'export subsidization policy', 'technological unemployment cost',
    'factor price equalization', 'compensating variation',
    'equivalent variation', 'willingness to accept',
    'social indifference curve', 'aggregate welfare function',
  ],

  // ── world_religions ────────────────────────────────────────────────────
  bodhisattva_and_buddhist_figures_short: [
    'Nagarjuna', 'Asanga', 'Vasubandhu', 'Milarepa', 'Yashodhara',
    'Ananda', 'Mahakasyapa', 'Shariputra', 'Moggallana', 'Vimalakirti',
  ],
  bodhisattva_and_buddhist_figures_long: [
    'Thich Nhat Hanh', 'Shantideva', 'Chandrakirti', 'Atisha Dipankara',
    'Tsongkhapa', 'Milarepa the hermit', 'Gampopa the physician', 'Tilopa the fisherman',
    'Yeshe Tsogyal', 'Machig Labdron',
  ],
  building_type_names_short: [
    'basilica', 'abbey', 'chapel', 'shrine', 'temple',
    'vihara', 'zendo', 'lamasery', 'mandir', 'tabernacle',
  ],
  building_type_names_long: [
    'Buddhist monastery', 'Hindu temple complex', 'Jewish synagogue',
    'Zoroastrian fire temple', 'Sikh gurdwara', 'Shinto torii gate',
    'Islamic minaret', 'Orthodox iconostasis', 'Protestant chapel',
    'Jain assembly hall', 'Taoist shrine room',
  ],
  denomination_names_long: [
    'Eastern Orthodox', 'Conservative Judaism', 'Theravada Buddhism',
    'Shia Islam', 'Sunni Islam', 'Mahayana Buddhism', 'Vajrayana Buddhism',
    'Quaker', 'Methodist', 'Anglican', 'Coptic Christian',
  ],
  founder_names_short: [
    'Zoroaster', 'Vardhamana', 'Nanak', 'Mani',
    'Akhenaten', 'Pythagoras', 'Empedocles', 'Prabhupada',
    'Valentinus', 'Marduk', 'Aten', 'Mirza Ali Muhammad',
  ],
  founder_names_long: [
    'Joseph Smith Jr.', 'Ellen G. White', 'Mary Baker Eddy',
    'Sun Myung Moon', 'Maharishi Mahesh Yogi', 'Sri Aurobindo',
    'Ramakrishna Paramahamsa', 'Prabhupada Bhaktivedanta',
    'Charles Taze Russell', 'William Miller',
    'Emanuel Swedenborg', 'Rudolf Steiner',
  ],
  hindu_deity_names: [
    'Kartikeya', 'Surya', 'Varuna', 'Agni', 'Yama',
    'Kuber', 'Vayu', 'Indra',
  ],
  holy_day_names_short: [
    'Diwali', 'Eid', 'Pesach', 'Dussehra', 'Navratri',
    'Sukkot', 'Shavuot', 'Baisakhi',
  ],
  holy_day_names_long: [
    'Maha Shivaratri', 'Rosh Hashanah', 'Yom Kippur', 'Naw-Rúz',
    'Ridvan Festival', 'Buddha Purnima', 'Mahavir Jayanti',
  ],
  holy_site_names_long: [
    'Mecca', 'Medina', 'Mount Sinai', 'Tirupati', 'Lhasa',
    'Ajmer Sharif', 'Haridwar', 'Allahabad',
  ],
  religious_object_names_long: [
    'Rosary beads', 'Incense burner', 'Prayer mat', 'Ablution basin',
    'Turban', 'Bindi', 'Tilak', 'Mala beads', 'Conch shell',
    'Singing bowl', 'Lotus flower', 'Yantra diagram',
  ],
  religious_practice_names_long: [
    'pilgrimage', 'fasting', 'meditation', 'ablution', 'tithing',
    'prostration', 'chanting', 'almsgiving', 'divination', 'exorcism',
  ],

  // ── ap_macroeconomics ─────────────────────────────────────────────────
  curve_and_graph_names_macro_long: [
    'Loanable Funds supply curve', 'Money Supply vertical line',
    'Investment Demand curve', 'Net Export curve', 'Keynesian cross diagram',
    'Money Market equilibrium graph', 'Multiplier effect diagram',
    'aggregate expenditure model', 'money demand curve',
    'labor demand curve', 'wage-price spiral diagram',
  ],
  equation_formulas_macro_short: [
    'Y = C + I + G + NX', 'ΔY = (1/1-MPC) × ΔI', 'M × V = P × Q',
    'Budget balance = T - G', 'Trade balance = X - M',
    'C = a + bY', 'I = f(r)', 'NX = X - M', 'π = ΔP/P',
    'G - T = deficit',
  ],
  equation_formulas_macro_long: [
    'Unemployment rate = unemployed / labor force × 100',
    'Velocity of money = Nominal GDP / Money Supply',
    'Real interest rate = Nominal rate minus inflation rate',
    'Money multiplier = 1 / Reserve requirement ratio',
    'Balanced budget multiplier = 1 (fiscal policy)',
    'Current account + Capital account = 0',
    'Foreign exchange rate = domestic/foreign price ratio',
  ],
  indicator_names_short: [
    'CPI', 'PPI', 'PCE', 'MPC', 'MPS',
    'APC', 'APS', 'Gini', 'HDI', 'PPP',
    'REER', 'NEER', 'IMF',
  ],
  indicator_names_long: [
    'Current account balance', 'Trade balance', 'balance of payments surplus',
    'terms of trade index', 'real exchange rate', 'capital flight measure',
    'Potential output gap', 'Structural budget deficit',
    'capacity utilization rate', 'labor force participation rate',
  ],
  law_and_principle_names_macro_short: [
    'Gresham\'s law', 'Say\'s law', 'Keynes multiplier', 'Solow residual',
    'Tobin\'s Q', 'Taylor rule', 'Mundell rule', 'Tinbergen rule',
    'Friedman rule', 'Pigou effect',
  ],
  law_and_principle_names_macro_long: [
    'Crowding-out effect', 'Quantity theory of money', 'Permanent income hypothesis',
    'Life-cycle hypothesis', 'Rational expectations theory', 'Adaptive expectations theory',
    'Purchasing power parity', 'Interest rate parity',
  ],
  macro_concept_terms_short: [
    'GDP', 'GNP', 'NDP', 'NNP', 'GNI',
    'CPI', 'PPI', 'MPS', 'MPC', 'APS',
  ],

  // ── ap_chemistry ──────────────────────────────────────────────────────
  compound_names: [
    'H2O (polar molecule)', 'NH3 (pyramidal)', 'CH4 (tetrahedral)', 'HCl (polar)',
    'PCl5 (trigonal bipyramidal)', 'H2S (bent)', 'NO2 (bent radical)', 'SO2 (resonance)',
    'CO (triple bond)', 'N2 (triple bond)',
  ],
  reaction_types: [
    'gas evolution', 'oxidation', 'reduction', 'neutralization', 'combustion',
    'double replacement', 'single replacement', 'precipitation', 'hydrolysis', 'polymerization',
  ],
  equilibrium_concepts: [
    'Q < K (reaction proceeds forward)', 'Q > K (reaction proceeds backward)',
    'Kp from Kc conversion', 'Le Chatelier\'s shift left', 'Le Chatelier\'s shift right',
    'Solubility product (Ksp)', 'Acid dissociation constant (Ka)', 'Base dissociation constant (Kb)',
  ],

  // ── ap_biology ────────────────────────────────────────────────────────
  cycle_phase_names: [
    'G1 phase', 'G2 phase', 'M phase', 'Cytokinesis', 'Interphase',
    'Prometaphase', 'G0 phase', 'Leptotene', 'Pachytene', 'Diplotene',
  ],
  equation_terms_short: [
    'Net productivity = GPP - R', 'h² = VA / VP', 'Fitness (w) = 1 - s',
    'ΔAllele = q × (Δq)', 'r = b/c ratio', 'G × E interaction',
    'Effective population (Ne)', 'Inbreeding coefficient (F)',
  ],
  equation_terms_long: [
    'Realized heritability = R / S', 'Hardy-Weinberg equilibrium holds when no evolution occurs',
    'Mean fitness = p²w₁₁ + 2pqw₁₂ + q²w₂₂', 'Change in q = -sq²(1-q) / mean fitness',
    'Log-linear growth: Nt = N0 × e^(rt)', 'Survivorship: lx = Nx / N0',
    'Net reproductive rate: R0 = Σ(lx × mx)',
  ],
  evolution_terms_short: [
    'Speciation', 'Isolation', 'Selection', 'Variation', 'Divergence',
    'Parapatric', 'Peripatric', 'Sympatry', 'Allo-sympatric', 'Cline',
    'Isolating mechanism', 'Reproductive barrier',
  ],
  evolution_terms_long: [
    'Allopatric speciation', 'Sympatric speciation', 'Punctuated equilibrium',
    'Phylogenetic tree', 'Molecular clock', 'Cladistics', 'Homologous structures',
    'Analogous structures', 'Vestigial organs', 'Biogeographic distribution',
  ],
  experiment_terms_short: [
    'null hypothesis', 'chi-square test', 'control group', 'replication',
    'random sampling', 'experimental bias', 'standard deviation', 'p-value',
  ],
  experiment_terms_long: [
    'Controlled experimental design', 'Statistical significance threshold',
    'Chi-square critical value at p=0.05', 'Random sampling eliminates bias',
    'Mendel\'s experimental methodology', 'Morgan\'s fruit fly experiments',
    'Beadle and Tatum one gene-one enzyme',
  ],
  genetics_terms: [
    'Sex-linked trait', 'Haplosufficiency', 'Haploinsufficiency', 'Mosaicism',
    'Imprinting', 'Linkage group', 'Synteny', 'Anticipation',
    'Modifier gene', 'Quantitative trait locus',
  ],
  organelle_names_short: [
    'Ribosome', 'Vacuole', 'Centriole', 'Peroxisome', 'Cytoskeleton',
    'Flagellum', 'Cilium', 'Capsule', 'Pilus', 'Glycocalyx', 'Tonoplast',
  ],
  organelle_names_long: [
    'Endoplasmic reticulum', 'Nuclear envelope', 'Cell membrane', 'Contractile vacuole',
    'Thylakoid membrane', 'Cristae (inner mitochondrial membrane)',
    'Tonoplast membrane', 'Glyoxysome', 'Amyloplast', 'Chromoplast', 'Leucoplast',
  ],
  term_definitions_short: [
    'NADH', 'FADH2', 'lumen', 'granum', 'starch',
    'NADP+', 'ADP', 'CoA', 'NAD+', 'GTP',
  ],

  // ── ap_physics_1 ──────────────────────────────────────────────────────
  unit_conversions: [
    'Pascal (Pa) = N/m²', 'Hertz (Hz) = cycles per second (1/s)',
    'Coulomb (C) = ampere × second', 'Volt (V) = J/C',
    'Ohm (Ω) = V/A', 'Tesla (T) = kg/(A·s²)',
    'Decibel (dB) = 10 log(I/I₀)', 'Radian (rad) = dimensionless arc',
  ],
  graph_interpretations: [
    'Net force (slope of momentum-time)', 'Power output (area under F-v)',
    'Net work done (area under F-x)', 'Angular acceleration (slope of ω-t)',
    'Angular displacement (area under ω-t)', 'Torque (slope of L-t)',
    'Spring constant k (slope of F-x)', 'Period T (x-axis of x-t graph)',
  ],

  // ── ancient_greece ────────────────────────────────────────────────────
  structure_names: [
    'Temple of Artemis at Ephesus', 'Oracle at Delphi', 'Odeon of Herodes Atticus',
    'Library of Pergamon', 'Theater of Epidaurus', 'Bouleuterion',
    'Propylaea', 'Erechtheion', 'Temple of Hephaestus', 'Agora of Athens',
  ],
  god_names: [
    'Hermes', 'Hestia', 'Persephone', 'Nemesis', 'Eos',
    'Helios', 'Selene', 'Tyche', 'Iris', 'Hecate',
  ],
  city_state_names: [
    'Corinth', 'Thebes', 'Argos', 'Rhodes', 'Ephesus',
    'Pergamon', 'Byzantium', 'Smyrna', 'Cnidus', 'Elis',
  ],
  work_text_names: [
    'The Birds', 'The Clouds', 'Electra', 'Antigone', 'Medea',
    'The Iliad', 'The Odyssey', 'Works and Days', 'Theogony', 'The Republic',
  ],
  historical_phrases_short: [
    'Thirty tyrants', 'Five years', 'Three hundred', 'Ten months', 'Twelve gods',
    'Four years', 'Six miles', 'Nine archons', 'Two consuls', 'One talent',
  ],

  // ── computer_science ─────────────────────────────────────────────────
  technology_terms_short: [
    'RAM', 'ROM', 'CPU', 'GPU', 'cache',
    'kernel', 'daemon', 'mutex', 'semaphore', 'thread',
  ],
  technology_terms_mid: [
    'linked list', 'binary tree', 'hash table', 'heap', 'graph traversal',
    'bubble sort', 'merge sort', 'quicksort', 'binary search', 'recursive descent',
  ],
  acronym_expansions_short: [
    'Hypertext Transfer Protocol', 'Structured Query Language', 'Cascading Style Sheets',
    'Application Programming Interface', 'Command-Line Interface',
    'Object-Oriented Programming', 'User Interface', 'Operating System',
    'Read-Only Memory', 'Transmission Control Protocol', 'Integrated Development Environment',
  ],
  language_names_short: [
    'Ruby', 'Swift', 'Rust', 'Haskell', 'Clojure',
    'Erlang', 'Scala', 'TypeScript', 'Dart', 'Elixir',
  ],
  language_names_long: [
    'Visual Basic', 'COBOL', 'Fortran', 'Pascal', 'Delphi',
    'ColdFusion', 'ActionScript', 'PowerShell', 'Objective-C', 'CoffeeScript',
  ],
  company_names_short: [
    'Sun', 'SGI', 'DEC', 'MCI', 'AOL',
    'NCR', 'HP', 'SAP', 'EDS', 'NEC',
  ],
  company_names_mid: [
    'Netscape', 'Borland', 'Novell', 'Compaq', 'Lotus',
    'WordPerfect', 'Symantec', 'Corel', 'McAfee', 'Sega',
  ],
  company_names_long: [
    'Massachusetts Institute of Technology', 'Stanford Research Institute',
    'Xerox PARC', 'Johns Hopkins University', 'Carnegie Mellon University',
    'Stanford Artificial Intelligence Laboratory', 'IBM Research Division',
    'Bell Labs Murray Hill', 'MIT Computer Science Lab', 'RAND Corporation',
    'SRI International Research', 'Lawrence Berkeley National Laboratory',
  ],
  product_names_short: [
    'Mosaic', 'HyperCard', 'MS-DOS', 'WordStar', 'VisiCalc',
    'Netscape', 'QuarkXPress', 'MacWrite', 'Lotus 1-2-3', 'dBase',
  ],
  product_names_long: [
    'Apple Macintosh 128K', 'Commodore 64 home computer', 'Altair 8800 kit',
    'IBM System/360', 'Digital PDP-11 minicomputer', 'ENIAC vacuum tube computer',
    'Cray-1 supercomputer', 'Osborne 1 portable',
  ],

  // ── world_wonders ─────────────────────────────────────────────────────
  architect_designer_short: [
    'Hadrian', 'Bramante', 'Palladio', 'Wren', 'Gaudi',
    'Mies van der Rohe', 'Le Corbusier', 'Aalto', 'Piano', 'Foster',
  ],
  architect_designer_long: [
    'I.M. Pei and Partners', 'Renzo Piano Building Workshop', 'Skidmore Owings & Merrill',
    'Rafael Viñoly Architects', 'Zaha Hadid Architects', 'HOK Architects',
    'Grimshaw Architects', 'Foster + Partners',
  ],
  material_feature_short: [
    'Steel', 'Concrete', 'Granite', 'Marble', 'Limestone',
    'Brick', 'Timber', 'Gold leaf', 'Terracotta', 'Bamboo',
  ],
  material_feature_long: [
    'Reinforced concrete structure', 'Tensile steel cable system', 'Pre-stressed concrete beams',
    'Natural stone cladding', 'Solar panel integration', 'Seismic isolation system',
    'Green roof technology', 'Double-skin facade',
  ],
  person_historical_short: [
    'Napoleon', 'Ramesses II', 'Charlemagne', 'Saladin', 'Cleopatra',
    'Genghis Khan', 'Julius Caesar', 'Marcus Aurelius', 'Justinian',
  ],
  person_historical_long: [
    'Emperor Yongle of the Ming dynasty', 'Sultan Suleiman the Magnificent',
    'Empress Wu Zetian of Tang', 'Emperor Ashoka of Maurya', 'Tsar Peter the Great',
    'King Louis XIV of France', 'Caliph Harun al-Rashid',
  ],

  // ── ancient_rome ──────────────────────────────────────────────────────
  battle_names: [
    'Battle of Pharsalus', 'Battle of Cannae', 'Battle of Actium',
    'Battle of Adrianople', 'Battle of the Milvian Bridge',
  ],
  emperor_names: [
    'Tiberius', 'Caligula', 'Claudius', 'Nero', 'Vespasian',
    'Domitian', 'Hadrian', 'Antoninus', 'Trajan',
  ],

  // ── greek_mythology ───────────────────────────────────────────────────
  creature_names_short: [
    'Cerberus', 'Minotaur', 'Sphinx', 'Chimera', 'Harpy',
    'Griffin', 'Cyclops', 'Satyr', 'Centaur', 'Siren',
  ],
  location_names_short: [
    'Hades', 'Olympus', 'Crete', 'Corinth', 'Mycenae',
    'Colchis', 'Tartarus', 'Erebus', 'Asphodel', 'Aulis',
  ],
  location_names_long: [
    'Elysian Fields', 'Isles of the Blessed', 'Mount Parnassus', 'Pillars of Heracles',
    'Garden of Hesperides', 'Labyrinth of Crete', 'Cave of Trophonius',
    'Fields of Mourning', 'Grove of Persephone',
  ],

  // ── world_literature ──────────────────────────────────────────────────
  character_names_short: [
    'Hamlet', 'Iago', 'Falstaff', 'Portia', 'Ophelia',
    'Raskolnikov', 'Natasha', 'Heathcliff', 'Gatsby', 'Holden',
  ],
  character_names_long: [
    'Elizabeth Bennet', 'Hester Prynne', 'Jay Gatsby', 'Emma Bovary',
    'Anna Karenina', 'Raskolnikov', 'Ivan Karamazov', 'Prince Myshkin',
    'Robinson Crusoe', 'Tom Jones',
  ],
  opening_line_sources_short: [
    'Canterbury Tales', 'Candide', 'Troilus and Cressida', 'Henry V',
    'Richard III', 'Othello II', 'Measure for Measure', 'Twelfth Night',
    'As You Like It', 'The Merry Wives',
  ],
  opening_line_sources_long: [
    'Dead Souls', 'Fathers and Sons', 'The Possessed', 'The Metamorphosis',
    'The Magic Mountain', 'Notre-Dame de Paris', 'Germinal', 'Bleak House',
    'David Copperfield', 'The Mill on the Floss',
  ],
  work_titles_long: [
    'The Brothers Karamazov', 'Les Misérables', 'Crime and Punishment',
    'In Search of Lost Time', 'Middlemarch', 'The Divine Comedy',
    'The Canterbury Tales', 'Don Quixote', 'Madame Bovary',
  ],

  // ── famous_paintings ──────────────────────────────────────────────────
  museum_names_short: [
    'Orsay', 'Tate', 'Hermitage', 'Vatican', 'Rijks',
    'Topkapi', 'Met', 'Gemäldegalerie', 'Thyssen', 'Reina Sofía',
  ],
  museum_names_long: [
    'Tate Modern', 'Musée d\'Orsay', 'Museo del Prado', 'Smithsonian Institution',
    'Art Institute of Chicago', 'Philadelphia Museum of Art', 'Victoria and Albert Museum',
    'British Museum', 'Getty Center', 'Barnes Foundation',
  ],
  technique_terms_short: [
    'Glazing', 'Grisaille', 'Scumbling', 'Sgrafito', 'Encaustic',
    'Tempera', 'Acrylic', 'Gouache', 'Aquatint', 'Stippling',
  ],
  technique_terms_long: [
    'Oil on panel', 'Tempera on wood', 'Watercolor on paper', 'Egg tempera',
    'Fresco secco', 'Gold leaf gilding', 'Ink wash painting', 'Screen printing',
    'Photorealistic technique', 'Trompe-l\'oeil perspective',
  ],

  // ── japanese_n2_grammar ───────────────────────────────────────────────
  ability: [
    'かねない', 'かねる', 'きれない', 'きれる', 'つつある',
    'にすぎない', 'ものだ', 'ことになっている', 'はずだ', 'べきだ',
    'わけがない', 'はずがない', 'ことができる',
  ],
  purpose: [
    'ために', 'ように', 'べく', 'んがために', 'のに',
    'として', 'にあたって', 'に際して', 'に向けて', 'を目指して',
  ],
  result_consequence: [
    'ことになった', 'ようになった', 'てしまった', 'にいたる', 'にいたった',
    'あげく', 'すえに', '結果', 'つまり', 'よって',
  ],
  trigger: [
    'をきっかけに', 'をもとに', 'にしたがって', 'につれて', 'とともに',
    'にあたって', 'に際して', 'をふまえて', 'に応じて', 'に基づいて',
  ],

  // ── japanese_n4_grammar ───────────────────────────────────────────────
  causative_passive: [
    'させられます', 'させられました', 'させられる', 'されます', 'されました',
    'させてもらいます', 'させてください', 'てもらいます', 'てもらいました', 'てもらえますか',
  ],
  difficulty_ease: [
    'にくい', 'にくかった', 'やすそうです', 'にくそうです', 'づらい',
    'がたい', 'がたかった', 'すぎます', 'すぎました', 'すぎる',
  ],
  quotation: [
    'とのことです', 'とのことだ', 'とか', 'だと', 'だって',
    'とも', 'というか', 'というより', 'ということは', 'とはいえ',
  ],

  // ── japanese_n1_grammar ───────────────────────────────────────────────
  japanese_n1_grammar_purpose: [
    'んがために', 'ためとして', 'にむけて', 'をめざして', 'に際して',
    'に当たって', 'に向かって', 'の目的で', 'という目的で', 'を目的として',
  ],

  // ── constellations ────────────────────────────────────────────────────
  star_names_long: [
    'Alpha and Beta Centauri', 'Castor and Pollux', 'Mira (the wonderful)',
    'Epsilon Eridani', 'Tau Ceti', 'Gamma Velorum',
    'Xi Persei (the interloper)', 'Eta Carinae (hypergiant)',
    'Alpha Orionis (Betelgeuse)', 'Beta Orionis (Rigel)',
  ],
  god_figure_names_short: [
    'Orion', 'Andromeda', 'Cassiopeia', 'Aquila', 'Lyra',
    'Heracles', 'Boötes', 'Auriga', 'Crater', 'Corvus',
  ],
  god_figure_names_mid: [
    'Tycho Brahe', 'Hipparchus of Nicaea', 'Edmund Halley',
    'Caroline Herschel', 'Nicolas Louis de Lacaille',
    'A scorpion sent by Gaia', 'The river Eridanus',
    'Aratus of Soli', 'Ptolemy of Alexandria',
  ],
  god_figure_names_long: [
    'Callisto transformed by Zeus', 'Ariadne abandoned by Theseus',
    'Ganymede cupbearer of the gods', 'Erigone searching for her father',
    'Clytie turned toward the sun', 'Arion saved by a dolphin',
    'Actaeon turned into a stag', 'Phaethon who drove the sun chariot',
    'Iphigenia sacrificed at Aulis by Agamemnon',
    'Hyacinthus killed by discus thrown by Zephyrus',
  ],
  concept_terms_short: [
    'zenith', 'nadir', 'meridian', 'ecliptic', 'equinox',
    'solstice', 'circumpolar', 'magnitude', 'declination', 'right ascension',
  ],
  date_numbers_short: [
    '7th', 'First', 'Fourth', 'Eighth', 'Tenth',
    '0.5', '1.2', '2.0', '3.5', '4.2',
  ],
  date_numbers_mid: [
    'June', 'September', 'December', 'March',
    '3000 BC', '2000 years', '50,000 years',
    '1781 AD', '1930s', '400 BCE',
  ],

  // ── pharmacology ──────────────────────────────────────────────────────
  indications_short: [
    'Arrhythmia', 'Heart failure', 'Asthma', 'COPD', 'Diabetes',
    'Epilepsy', 'Depression', 'Anxiety', 'Infection', 'Inflammation',
  ],
  nursing_interventions_short: [
    'Check liver function tests', 'Assess renal function', 'Monitor blood pressure',
    'Watch for bleeding', 'Assess respiratory rate',
    'Monitor blood glucose', 'Check serum potassium', 'Assess urine output',
  ],
  interactions: [
    'Grapefruit juice inhibits CYP3A4', 'NSAIDs reduce antihypertensive effects',
    'St. John\'s Wort induces liver enzymes', 'MAO inhibitors cause hypertensive crisis',
    'Warfarin potentiated by aspirin', 'Phenytoin reduces oral contraceptive efficacy',
    'Quinolones chelate with calcium', 'Tetracyclines bind to dairy products',
  ],

  // ── world_cuisines ────────────────────────────────────────────────────
  technique_terms_long: [
    'Slow braising in wine', 'Flash-frying in hot oil', 'Cold smoking over wood chips',
    'Salt-curing and air-drying', 'Fermentation in clay pots', 'Stone-grinding by hand',
    'Sous vide at precise temperature', 'Deep-frying in clarified butter',
  ],

  // ── mammals_world ─────────────────────────────────────────────────────
  name_long: [
    'Blue whale', 'African elephant', 'White rhinoceros', 'Mountain gorilla',
    'Snow leopard', 'Amur leopard', 'Sumatran orangutan', 'Giant panda',
  ],
  conservation_terms: [
    'Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Data Deficient',
    'Extinct', 'Captive breeding', 'Habitat corridor',
  ],

  // ── ap_world_history ──────────────────────────────────────────────────
  religion_belief_terms: [
    'Taoism', 'Zen Buddhism', 'Protestant Reformation', 'Counter-Reformation',
    'Islamic Sufism', 'Jewish mysticism', 'Mahayana Buddhism', 'Jainism',
    'Zoroastrianism', 'Manichaeism',
  ],

  // ── ocean_life ────────────────────────────────────────────────────────
  behavior_descriptions_short: [
    'Bioluminescence', 'Camouflage', 'Mimicry', 'Echolocation', 'Filter feeding',
    'Tool use', 'Group hunting', 'Countershading', 'Jet propulsion', 'Schooling behavior',
  ],
  conservation_status: [
    'Vulnerable', 'Near Threatened', 'Least Concern', 'Extinct in the Wild', 'Data Deficient',
    'Recovering', 'Declining', 'Unknown status', 'Locally extinct',
  ],

  // ── movies_cinema ─────────────────────────────────────────────────────
  film_quotes: [
    '"May the Force be with you"',
    '"You talking to me?"',
    '"There\'s no place like home"',
    '"E.T. phone home"',
    '"Life is like a box of chocolates"',
    '"Show me the money!"',
    '"You\'re gonna need a bigger boat"',
    '"Go ahead, make my day"',
    '"Why so serious?"',
    '"Elementary, my dear Watson"',
  ],

  // ── ap_european_history ───────────────────────────────────────────────
  date_answers_long: [
    'June 28, 1914', 'November 11, 1918', 'September 1, 1939',
    'May 8, 1945', 'March 25, 1957', 'November 9, 1989',
    'February 7, 1992', 'July 14, 1789',
  ],
  place_names_long: [
    'Ottoman Empire', 'Habsburg Empire', 'Russian Empire', 'British India',
    'French Algeria', 'Belgian Congo', 'Dutch East Indies',
  ],

  // ── medical_terminology ───────────────────────────────────────────────
  root_meanings_short: [
    'gut', 'jaw', 'arm', 'leg', 'lip',
    'toe', 'hip', 'gum', 'cut', 'old',
  ],

  // ── famous_inventions ─────────────────────────────────────────────────
  invention_specs: [
    '1.2 million transistors', '29 horsepower engine', '4 km range',
    '300 baud modem speed', '640 KB memory limit',
    '12 seconds flight time', '8 mm film width', '3 rotors (Enigma machine)',
    'one candle power', '10 watts',
  ],

  // ── world_war_ii ─────────────────────────────────────────────────────
  organization_names: [
    'Gestapo', 'Waffen-SS', 'Abwehr', 'NKVD', 'SOE',
    'OSS', 'Luftwaffe', 'Kriegsmarine', 'Wehrmacht',
  ],

  // ── egyptian_mythology ───────────────────────────────────────────────
  places_locations: [
    'Alexandria', 'Saqqara', 'Karnak', 'Luxor', 'Aswan',
    'Amarna', 'Akhetaten', 'Bubastis', 'Tanis', 'Hermopolis',
  ],

  // ── world_cuisines ────────────────────────────────────────────────────────
  date_facts_short: [
    '1800s', '400 BC', '1400s', '1600s', '1700s',
    '2000 BC', '500 BC', '1200s', '1900s', '600 AD',
  ],

  // ── periodic_table ────────────────────────────────────────────────────
  periodic_table_bracket_numbers: [
    '2', '7', '10', '14', '18', '26',
    '47', '50', '74', '78', '79',
  ],

  // ── ap_us_history ─────────────────────────────────────────────────────
  // ── ap_psychology ─────────────────────────────────────────────────────
  // ── medical_terminology (additional) ─────────────────────────────────
  root_meanings_short: [
    'gut', 'jaw', 'arm', 'leg', 'lip',
    'toe', 'hip', 'gum', 'cut', 'old',
  ],
};

// ---------------------------------------------------------------------------
// Helper: is this a bracket-number pool?
// ---------------------------------------------------------------------------
function isBracketPool(pool, facts) {
  const ids = pool.factIds || [];
  if (ids.length === 0) return false;
  const sample = facts.filter((f) => ids.includes(f.id)).slice(0, 3);
  return sample.some((f) => /^\{.+\}/.test((f.correctAnswer || '').trim()));
}

// ---------------------------------------------------------------------------
// Helper: collect all correct answers from OTHER pools in the same deck
// (cross-pool borrowing strategy)
// ---------------------------------------------------------------------------
function getCrossPoolCandidates(deck, targetPool, allCorrectAnswers) {
  const targetIds = new Set(targetPool.factIds || []);
  const targetAnswers = new Set(
    (targetPool.factIds || [])
      .map((fid) => deck.facts.find((f) => f.id === fid))
      .filter(Boolean)
      .map((f) => f.correctAnswer.toLowerCase().trim())
  );

  // Get min/max answer length for the target pool to filter by length
  const targetLengths = Array.from(targetAnswers).map((a) => a.length);
  const minLen = Math.min(...targetLengths);
  const maxLen = Math.max(...targetLengths);

  const candidates = [];
  for (const pool of deck.answerTypePools) {
    if (pool.id === targetPool.id) continue;
    // Skip bracket pools as sources
    if (isBracketPool(pool, deck.facts)) continue;

    for (const fid of pool.factIds || []) {
      if (targetIds.has(fid)) continue;
      const fact = deck.facts.find((f) => f.id === fid);
      if (!fact) continue;
      const answer = (fact.correctAnswer || '').trim();
      const lower = answer.toLowerCase();
      if (!answer) continue;
      if (allCorrectAnswers.has(lower)) continue;
      if (targetAnswers.has(lower)) continue;
      // Length gate: within 2x range
      const len = answer.length;
      if (len < minLen / 2 || len > maxLen * 2) continue;
      candidates.push(answer);
    }
  }
  // Deduplicate
  return [...new Set(candidates)];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
let totalModifiedDecks = 0;
let totalPoolsUpdated = 0;
let totalSyntheticsAdded = 0;

const deckFiles = fs.readdirSync(DECKS_DIR).filter((f) => f.endsWith('.json'));

for (const file of deckFiles) {
  const deckPath = path.join(DECKS_DIR, file);
  let deck;
  try {
    deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'));
  } catch (err) {
    console.error(`ERROR reading ${file}: ${err.message}`);
    continue;
  }

  if (!deck.answerTypePools || deck.answerTypePools.length === 0) continue;

  // Collect ALL correct answers in the deck for collision checking
  const allCorrectAnswers = new Set(
    deck.facts.map((f) => (f.correctAnswer || '').toLowerCase().trim())
  );

  let deckModified = false;
  const deckLog = [];

  for (const pool of deck.answerTypePools) {
    const factCount = (pool.factIds || []).length;
    const existingSynth = pool.syntheticDistractors || [];
    const total = factCount + existingSynth.length;

    // Skip if already at target
    if (total >= TARGET_TOTAL) continue;
    // Skip if pool is too small to be useful (< 5 real facts)
    if (factCount < 5) continue;
    // Skip if marked homogeneityExempt
    if (pool.homogeneityExempt) continue;
    // Skip bracket-number pools
    if (isBracketPool(pool, deck.facts)) continue;

    const needed = TARGET_TOTAL - total;

    // --- Step 1: domain bank ---
    const bankKey = pool.id;
    // Also try deck-prefixed key for pools that might collide between decks
    const deckBankKey = `${deck.id}_${pool.id}`;
    let bankCandidates = [
      ...(DOMAIN_BANKS[deckBankKey] || []),
      ...(DOMAIN_BANKS[bankKey] || []),
    ];

    // --- Step 2: cross-pool borrowing ---
    const crossCandidates = getCrossPoolCandidates(deck, pool, allCorrectAnswers);

    // --- Merge: bank first, then cross-pool ---
    const allCandidates = [...bankCandidates, ...crossCandidates];

    // Filter: not a correct answer, not already in pool synthetics, deduplicate
    const existingSynthLower = new Set(existingSynth.map((s) => s.toLowerCase().trim()));
    const safe = [];
    const seen = new Set(existingSynthLower);
    for (const c of allCandidates) {
      const lower = c.toLowerCase().trim();
      if (allCorrectAnswers.has(lower)) continue;
      if (seen.has(lower)) continue;
      seen.add(lower);
      safe.push(c);
    }

    if (safe.length === 0) continue;

    // Take what we need
    const toAdd = safe.slice(0, needed);

    if (toAdd.length === 0) continue;

    pool.syntheticDistractors = [...existingSynth, ...toAdd];
    const newTotal = factCount + pool.syntheticDistractors.length;

    deckLog.push(
      `  ${pool.id}: ${factCount} facts + ${existingSynth.length} → ${pool.syntheticDistractors.length} synth = ${newTotal} total (+${toAdd.length})`
    );

    totalSyntheticsAdded += toAdd.length;
    totalPoolsUpdated++;
    deckModified = true;
  }

  if (deckModified) {
    console.log(`\n=== ${deck.id} ===`);
    deckLog.forEach((l) => console.log(l));

    if (!DRY_RUN) {
      fs.writeFileSync(deckPath, JSON.stringify(deck, null, 2) + '\n');
      console.log(`  Written.`);
    } else {
      console.log(`  [DRY-RUN: not written]`);
    }
    totalModifiedDecks++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Decks modified:   ${totalModifiedDecks}`);
console.log(`Pools updated:    ${totalPoolsUpdated}`);
console.log(`Synthetics added: ${totalSyntheticsAdded}`);
if (DRY_RUN) console.log(`(DRY RUN — no files written)`);
