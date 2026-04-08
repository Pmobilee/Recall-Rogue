/**
 * fix-self-answering.mjs
 *
 * Finds and fixes self-answering quiz questions in knowledge decks.
 * A self-answering question is one where the correct answer appears verbatim in the question,
 * making it trivially easy to answer by just reading the question text.
 *
 * SKIPS:
 * - Vocabulary domain decks (intentional: "What does 'X' mean?" with answer = translation)
 * - image_question and image_answers quizMode facts (intentional: "Which image shows X?")
 * - Medical combining forms / roots (vocabulary-like facts)
 * - Cases where answer is only a substring of a longer word (flagged separately)
 *
 * FIXES:
 * - Rewrites quizQuestion only — never touches correctAnswer, explanation, or other fields
 * - Uses word-boundary detection for reliable matching
 * - Applies pattern-specific rewrites
 * - Logs all changes for review
 *
 * Usage:
 *   node scripts/fix-self-answering.mjs [--dry-run] [--deck <id>]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS_DIR = path.join(__dirname, '..', 'data', 'decks');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const DECK_FILTER = (() => {
  const idx = args.indexOf('--deck');
  return idx >= 0 ? args[idx + 1] : null;
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns true if the answer appears in the question at a word boundary.
 * Word boundaries are positions where non-word chars (spaces, punctuation) surround the match.
 */
function appearsAtWordBoundary(question, answer) {
  const qL = question.toLowerCase();
  const aL = answer.toLowerCase();
  const escaped = escapeRegex(aL);
  // Use a broad word boundary: surrounded by start/end or non-alphanumeric characters
  const re = new RegExp('(?:^|[^a-zA-Z0-9])' + escaped + '(?:[^a-zA-Z0-9]|$)');
  return re.test(qL);
}

/**
 * Get a domain-appropriate generic placeholder for the answer based on pool ID.
 */
function getPlaceholder(poolId, answer) {
  if (!poolId) return inferPlaceholder(answer);
  const p = poolId.toLowerCase();

  if (p.includes('muscle')) return 'this muscle';
  if (p.includes('nerve')) return 'this nerve';
  if (p.includes('bone') || p.includes('skeletal')) return 'this bone';
  if (p.includes('organ')) return 'this organ';
  if (p.includes('vessel') || p.includes('cardiac') || p.includes('vascular')) return 'this vessel';
  if (p.includes('tissue') || p.includes('histolog')) return 'this tissue type';
  if (p.includes('cell') || p.includes('receptor')) return 'this cell type';
  if (p.includes('hormone') || p.includes('neurotransmitter') || p.includes('nervous')) return 'this molecule';
  if (p.includes('structure') || p.includes('integument') || p.includes('digestive') ||
      p.includes('respiratory') || p.includes('urinary') || p.includes('reproductive') ||
      p.includes('muscular') || p.includes('endocrine') || p.includes('embryo')) return 'this structure';
  if (p.includes('function') || p.includes('process')) return 'this process';
  if (p.includes('condition') || p.includes('disease')) return 'this condition';
  if (p.includes('element') || p.includes('periodic')) return 'this element';
  if (p.includes('species') || p.includes('organism')) return 'this organism';
  if (p.includes('phase') || p.includes('stage')) return 'this phase';
  if (p.includes('protein') || p.includes('enzyme') || p.includes('molecule')) return 'this molecule';
  if (p.includes('concept') || p.includes('theory') || p.includes('ideology') ||
      p.includes('doctrine') || p.includes('movement')) return 'this concept';
  if (p.includes('event') || p.includes('battle') || p.includes('war') || p.includes('treaty')) return 'this event';
  if (p.includes('person') || p.includes('leader') || p.includes('ruler') ||
      p.includes('emperor') || p.includes('president')) return 'this person';
  if (p.includes('place') || p.includes('location') || p.includes('city') ||
      p.includes('country') || p.includes('capital') || p.includes('region')) return 'this place';
  if (p.includes('document') || p.includes('law') || p.includes('act') || p.includes('policy')) return 'this document';
  if (p.includes('organization') || p.includes('group') || p.includes('party') ||
      p.includes('institution')) return 'this organization';
  if (p.includes('period') || p.includes('era') || p.includes('dynasty')) return 'this period';

  return inferPlaceholder(answer);
}

function inferPlaceholder(answer) {
  const a = answer.trim();
  // Date/year answers
  if (/^\d{4}(\s*(CE|BCE|AD|BC))?$/i.test(a)) return 'this date';
  if (/^\d{1,2}\s*(CE|BCE|AD|BC)$/i.test(a)) return 'this date';
  // Number-like answers
  if (/^\d[\d,. ]*(%|feet|km|m|mg|years)?$/i.test(a)) return 'this number';
  // Multi-word capitalized → likely a proper name or event
  if (a.split(' ').length >= 2 && a[0] === a[0].toUpperCase()) return 'this';
  return 'this';
}

/**
 * Check if this is a "What is X?" question where X is exactly the answer.
 * Returns true if the entire question body is essentially asking for the definition of X.
 */
function isWhatIsXPattern(question, answer) {
  const q = question.trim();
  const aE = escapeRegex(answer);
  // Exact: "What is X?" or "What is the X?" or "What was X?" or "What are X?"
  const re = new RegExp(`^what (?:is|was|were|are|does) (?:the |a |an |this )?['"]?${aE}['"]?\\??\\s*$`, 'i');
  return re.test(q);
}

/**
 * Check if the answer is the subject of the sentence (appears at or near the start).
 * Example: "The anterior pituitary (adenohypophysis) is derived from..."
 */
function isSubjectPattern(question, answer) {
  const q = question.trim();
  const aE = escapeRegex(answer.toLowerCase());
  // "The X ..." or "X ..." where X is the answer and it's followed by a verb
  const re = new RegExp(`^(?:the |this |a |an )?['"]?${aE}['"]?(?:\\s*\\([^)]+\\))?\\s+(?:is|are|was|were|has|have|had|can|could|will|would|does|do|did|get|become|contain|consist|originate|insert|derive|form|function|treat|regulate|allow|enable|carry|produce|secrete)`, 'i');
  return re.test(q);
}

/**
 * Replace one occurrence of the answer in the question at a word boundary with a placeholder.
 * Uses case-insensitive matching and preserves surrounding text.
 */
function replaceAtWordBoundary(question, answer, placeholder) {
  const aE = escapeRegex(answer);
  // Match with lookahead/lookbehind for word boundary using non-alpha chars
  const re = new RegExp(`(?<![a-zA-Z0-9])${aE}(?![a-zA-Z0-9])`, 'i');
  return question.replace(re, placeholder);
}

// ─── Specific manual fixes for the hardest cases ─────────────────────────────

/**
 * Hand-crafted rewrites for cases the automatic system can't handle cleanly.
 * Keyed by factId.
 */
const MANUAL_FIXES = {
  // ─── ancient_greece ────────────────────────────────────────────────────────
  // Apollo appears as "Apollonian" (substring)
  'greece_oc_lyre_apollo': 'The lyre was a central instrument of ancient Greek culture — receiving it from Hermes in exchange for cattle. Which god of reason and the arts became especially associated with it?',

  // Athena in "Panathenaia" (substring)  
  'greece_rel_panathenaia': 'Which goddess of wisdom and warfare was the patron deity honored by the Panathenaia festival in Athens, which included athletic and musical competitions?',

  // ─── ancient_rome ──────────────────────────────────────────────────────────
  // "Father of the Country" appears verbatim as definition in question

  // 609 CE appears as date context in question
  'rome_eng_pantheon_church': 'The Pantheon has been continuously used as a building for nearly 2,000 years — in what year did it begin its second life as a Christian church?',

  // 311 CE appears as date context
  'rome_chr_galerius_edict_311': 'Two years before the Edict of Milan, which Roman emperor issued an earlier edict of toleration for Christians, establishing a precedent that Constantine would expand?',

  // ─── ap_biology ───────────────────────────────────────────────────────────
  // "Oncogenes" in "proto-oncogenes"

  // "Pisum sativum" as context for the species Mendel used

  // "Meiosis I" appears as substring of "meiosis is"
  'ap_bio_meiosis_I_def': 'Which division — the first or the second — of meiosis is called the reductional division, in which homologous chromosomes separate and the chromosome number is halved?',

  // dN/dt formula appears in question
  'ap_bio_u8_041': 'What type of population growth produces an S-shaped (logistic) curve that levels off at carrying capacity (K), described by the equation dN/dt = r_max × N × ((K−N)/K)?',

  // ─── ap_european_history ──────────────────────────────────────────────────
  // "republic" in "Dutch Republic"
  'ap_euro_u3_dutch_republic_government': 'What form of government made the Dutch Republic unique in 17th-century Europe, where most states were evolving toward absolute monarchy?',

  // "France" as context for diplomat
  'ap_euro_u5_talleyrand': 'Talleyrand was the skilled diplomat who secured a respected seat at the Congress of Vienna for his defeated nation. Which country did he represent?',

  // "Concert of Europe" in question
  'ap_euro_u6_044': 'What was the name of the post-Napoleonic system of regular great-power consultations to maintain European peace, established in 1815?',

  // "Colonial markets" as phrase in question
  'ap_euro_u6_045': 'What role did overseas colonial markets play in Britain\'s early industrialization, providing both raw materials and demand for manufactured goods?',

  // "Bourgeoisie" in question (in quotes but still the answer)
  'ap_euro_u6_049': 'In Marxist theory, what term describes the capitalist class that owns the means of production and employs the proletariat for wages?',

  // "Kulturkampf" in question
  'ap_euro_u7_kulturkampf': 'What was the name of Bismarck\'s 1870s campaign in Germany to reduce Catholic Church influence over education and civil affairs?',

  // "Fashoda Incident" in question
  'ap_euro_u7_fashoda_incident': 'The crisis of 1898 that nearly caused war between Britain and France over competing claims to a Sudan river town is named after that town. What was it called?',

  // "Dreyfus Affair" in question
  'ap_euro_u7_dreyfus_affair': 'What was the name of the 1894–1906 French political scandal in which a Jewish army officer was falsely accused of treason, exposing deep anti-Semitism and polarizing French society?',

  // "Realpolitik" in question
  'ap_euro_u7_realpolitik': 'What term describes the political philosophy — practiced by both Bismarck and Cavour — of pursuing national goals through pragmatic power politics rather than ideology or ethics?',

  // "Multi-ethnic empires" in question
  'ap_euro_u7_nationalism_multi_ethnic_empires': 'Which two vast empires — the Ottoman and Austro-Hungarian — were most threatened by 19th-century nationalist movements, as subject peoples demanded self-determination?',

  // "Positivism" in question
  'ap_euro_u7_positivism_definition': 'What school of thought did Auguste Comte found, holding that knowledge should be based on observable facts and scientific methods rather than metaphysics or theology?',

  // "Brezhnev Doctrine" in question
  'ap_euro_u9_brezhnev_doctrine': 'What policy did the Soviet Union articulate after the 1968 Warsaw Pact invasion of Czechoslovakia, asserting the right to intervene in any socialist country that threatened Soviet-bloc stability?',

  // "openness" appears in question describing glasnost
  'ap_euro_u9_glasnost_meaning': 'What English word best translates Gorbachev\'s policy of glasnost, which enabled greater freedom of information and public discussion in the Soviet Union?',

  // "restructuring" appears in question describing perestroika
  'ap_euro_u9_perestroika_meaning': 'What English word best translates Gorbachev\'s policy of perestroika, his program of economic and political reform of the Soviet system?',

  // ─── ap_macroeconomics ────────────────────────────────────────────────────
  // "capital goods" in "trade-off between capital goods and consumer goods"
  'ap_macro_1_ppc_capital_vs_consumer': 'On a PPC showing the trade-off between two types of goods, producing more of which type today — capital investment or consumer goods — leads to faster economic growth and an outward shift of the future PPC?',

  // ─── ap_psychology ────────────────────────────────────────────────────────
  // "Conditioned stimulus" appears as substring of "conditioned stimuli" (substring only)
  'ap_psych_cc_cs_definition': 'In classical conditioning, what term describes a previously neutral stimulus that — after repeated pairing with an unconditioned stimulus — triggers a learned response on its own?',

  // ─── ap_us_history ────────────────────────────────────────────────────────
  // "Patrons of Husbandry" in question
  'apush_p6_grange_movement': 'What farm advocacy organization, founded in 1867 and organized into local lodges called "Granges," helped establish the legal principle of government regulation of private businesses serving the public interest?',

  // ─── ap_world_history ─────────────────────────────────────────────────────
  // "Tributary system" in question
  'apwh_3_052': 'What was the name of the diplomatic and economic system used by the Qing Dynasty, in which neighboring states paid tribute to assert Chinese cultural supremacy?',

  // "Fascism" appears in question as "fascism"
  'apwh_7_014': 'Benito Mussolini seized power in Italy in 1922. What was the name of the authoritarian, ultranationalist political ideology he founded in 1919?',

  // ─── constellations ───────────────────────────────────────────────────────
  // "Asterism" in "a constellation or an asterism?"
  'const_mc_big_dipper_status': 'The Big Dipper is a recognizable star pattern — but is it an officially designated constellation, or a smaller unofficial grouping called something else?',

  // "Pollux" in "Castor or Pollux?"
  'const_mc_gemini_brightest': 'Gemini contains two bright stars named after the mythical twin brothers — Castor and Pollux. Which of these two is actually the brighter one?',

  // "Second" appears in "the second-largest" (unusual answer)
  'const_mc_virgo_size_rank': 'Virgo is the largest zodiac constellation and the second-largest constellation overall. What is the ranking (e.g., first, second, third) that describes Virgo\'s position in terms of zodiac constellation size?',

  // "Dog days of summer" in question
  'const_star_sirius_dog_days': 'The phrase about the hot, uncomfortable days in late summer originates from an ancient astronomical association with Sirius. What is the name of this phrase?',

  // ─── dinosaurs ────────────────────────────────────────────────────────────
  // "Quetzalcoatl" in "Quetzalcoatlus" (substring)
  'dino_quetzalcoatlus_name_origin': 'The giant pterosaur Quetzalcoatlus was named after a feathered serpent deity of the Aztec religion. What was the name of that deity?',

  // ─── human_anatomy ────────────────────────────────────────────────────────
  // "dermis" in "epidermis" (substring)
  'ha_integ_010': 'Which skin layer — lying between the epidermis above and the hypodermis below — contains blood vessels, hair follicles, and nerve endings?',

  'ha_integ_035': 'Which middle layer of skin — beneath the outermost epithelium — contains blood vessels and nerves and is divided into a loose papillary layer and a dense reticular layer?',

  // "Supinator" in "supinator crest"
  'ha_musc_050': 'Which deep posterior forearm muscle originates from the lateral epicondyle and a bony crest of the ulna, wraps around the posterior interosseous nerve, and supinates the forearm at all elbow positions?',

  // "serotonin" in "serotonin reuptake inhibitors"
  'ha_nerv_071': 'SSRIs work by blocking the reuptake of a specific neurotransmitter, increasing its availability in the synapse. Which neurotransmitter — produced mainly in the raphe nuclei and regulating mood, sleep, and appetite — is the target?',

  // "C3, C4, C5" appears in mnemonic completion question
  'ha_musc_140': 'The diaphragm is innervated by the phrenic nerve. Complete the classic mnemonic: "C__, C__, C__ keeps the diaphragm alive." What spinal cord levels does it reference?',

  // "Portal triad" in "forming the portal triad"
  'ha_clinical_078': 'In the classic hexagonal liver lobule, three structures are found at each corner (vertex). What is the collective name for these three structures — a portal venule, hepatic arteriole, and bile ductule?',

  // "Glomerular filtration barrier" in question
  'ha_clinical_087': 'The kidney filters blood through a three-layered barrier from blood to urinary space. What is the name of this filtration structure, and what are its three layers in order?',

  // "Paraventricular nucleus (PVN)" in question
  'ha_nerv_104': 'A functionally diverse nucleus in the hypothalamus — abbreviated PVN — produces multiple hormones and releasing factors. Name the three major ones it secretes.',

  // "SA node" in "SA node action potential"
  'ha_cardio_094': 'A specialized cardiac pacemaker region has no stable resting membrane potential and fires spontaneously. What is the ionic basis of its Phase 4 depolarisation (pacemaker potential), and what is this pacemaker structure called?',

  // ─── medical_terminology ──────────────────────────────────────────────────
  // Aneurysm as substring of aneurysma
  'medterm_cond_aneurysm': 'What vascular condition — named from the Greek word meaning "widening" — describes a localized abnormal bulge or dilation in a blood vessel wall?',
  'medterm_cond_aneurysm_2': 'What medical condition, whose name derives from the Greek for "widening or dilation," describes an abnormal ballooning of a blood vessel wall that can rupture if untreated?',

  // "What is X?" patterns — rewrite to ask what the term describes
  'medterm_cond_hyperthyroidism': 'What medical condition describes excessive activity of the thyroid gland, causing elevated levels of T3 and T4 hormones and accelerated metabolism?',
  'medterm_cond_hypothyroidism': 'What medical condition describes insufficient thyroid hormone production, causing slowed metabolism, fatigue, and weight gain?',
  'medterm_cond_hyperglycemia': 'What medical condition describes abnormally high blood glucose levels, commonly associated with diabetes mellitus?',
  'medterm_cond_hypoglycemia': 'What medical condition describes abnormally low blood glucose levels, causing symptoms like shakiness, sweating, and confusion?',
  'medterm_cond_adenoma': 'What type of benign tumor arises from glandular epithelial tissue?',
  'medterm_cond_hypercalcemia': 'What medical condition describes abnormally elevated calcium levels in the blood, which can cause muscle weakness, kidney stones, and cardiac arrhythmias?',
  'medterm_cond_melanoma': 'What type of malignant skin cancer develops from the melanocytes — the pigment-producing cells — and is especially dangerous due to its tendency to metastasize?',
  'medterm_cond_alopecia': 'What medical term describes hair loss, which may be partial or complete, from the scalp or other parts of the body?',
  'medterm_cond_leukemia': 'What type of cancer originates in blood-forming tissues, causing the uncontrolled production of abnormal white blood cells?',
  'medterm_cond_thrombocytopenia': 'What medical condition describes an abnormally low platelet count in the blood, increasing the risk of bleeding and bruising?',
  'medterm_cond_leukocytosis': 'What medical condition describes an elevated white blood cell count, often indicating infection, inflammation, or a bone marrow disorder?',
  'medterm_cond_mastitis': 'What medical condition describes inflammation of breast tissue, most commonly occurring during breastfeeding?',
  'medterm_cond_endometriosis': 'What medical condition occurs when tissue similar to the uterine lining grows outside the uterus, causing pain and potentially affecting fertility?',
  'medterm_cond_conjunctivitis': 'What medical condition describes inflammation of the conjunctiva — the membrane lining the eyelid and covering the white of the eye — commonly called "pink eye"?',
  'medterm_cond_retinopathy': 'What medical condition describes disease of the retina, most commonly as a complication of diabetes, potentially leading to vision loss?',
  'medterm_cond_tinnitus': 'What medical condition describes the perception of ringing, buzzing, or other sounds in the ear in the absence of an external source?',
  'medterm_cond_carcinoma': 'What type of malignant tumor arises from epithelial cells — the most common category of cancer, including lung, breast, and colon cancers?',
  'medterm_cond_sarcoma': 'What type of malignant tumor arises from connective tissues such as bone, cartilage, fat, or muscle?',
  'medterm_cond_necrosis': 'What process describes the premature death of cells or tissues due to injury, infection, or disease — distinguished from apoptosis (programmed cell death)?',
  'medterm_cond_septicemia': 'What medical condition describes the presence of harmful bacteria or their toxins in the bloodstream, causing systemic infection commonly known as blood poisoning?',
  'medterm_cond_fibrosis': 'What pathological process describes the replacement of normal tissue with excess fibrous connective tissue as a healing response to injury, reducing organ function?',

  // "Emphysema" in Greek term
  'medterm_cond_emphysema': 'What chronic obstructive lung disease — named from the Greek for "inflation" — involves destruction of alveolar walls and trapping of air in the lungs?',

  // "Asthma" in Greek term
  'medterm_cond_asthma': 'What respiratory condition — named from the Greek word for "panting" — is characterized by reversible bronchospasm, wheezing, and airway inflammation?',

  // ─── medieval_world ───────────────────────────────────────────────────────
  // "622 CE" in "What event in 622 CE..."
  'med_isl_muhammad_hijra': 'Muhammad\'s migration from Mecca to Medina marks Year 1 of the Islamic calendar. In what year CE did this migration — the Hijra — take place?',

  // "The House of Wisdom (Bayt al-Hikmah)" in question
  'med_isl_house_of_wisdom': 'What was the famous translation center and public academy in Baghdad called — a place where scholars translated Greek, Persian, and Indian texts — and under which caliph did it reach its peak?',

  // ─── movies_cinema ────────────────────────────────────────────────────────
  // "James Bond" in question context
  'cinema_char_james_bond': 'Which fictional British spy — first portrayed by Sean Connery in 1962 — introduces himself with the iconic line "Bond... James Bond"?',

  // ─── music_history ────────────────────────────────────────────────────────
  // "Stevie Wonder" in "Little Stevie Wonder"
  'mh_4_stevie_wonder_child_prodigy': 'Which blind Motown artist, signed at age 11 under a "Little" stage-name prefix, grew up to be one of the most celebrated musicians of the 20th century?',

  // ─── periodic_table ───────────────────────────────────────────────────────
  // "Radium" in "Radium Girls"
  'periodic_table_radium_girls': 'Which radioactive element was used to paint luminous watch dials in the early 20th century, slowly poisoning the workers who applied it — a tragedy that led to landmark occupational safety regulations?',

  // "Nickel" in "Kupfernickel" (substring)
  'periodic_table_nickel_devils_copper': 'Which element was originally called "Kupfernickel" — devil\'s copper — by German miners who were frustrated that the ore looked like copper but yielded none?',

  // "Mercury" in "mercury poisoning"
  'periodic_table_mercury_mad_hatter': 'The phrase "mad as a hatter" originated from a neurological disorder caused by exposure to a toxic metal used in felt-hat making. Which element was responsible?',

  // "Platinum" in "named platinum"
  'periodic_table_platinum_conquistadors': 'Spanish conquistadors dismissed a dense, silvery metal found in Colombia as an inferior nuisance — naming it "platina," meaning what (a diminutive of what Spanish word)?',

  // "Indium" in "indium tin oxide"
  'periodic_table_indium_touchscreens': 'Which rare metal — used in transparent conductive coatings for touchscreens and LCD displays — is combined with tin oxide to create the ITO films that make modern touchscreens possible?',

  // ─── pharmacology ─────────────────────────────────────────────────────────
  // "Combined oral contraceptive" in question
  'pharm-ob-oral-contraceptive-class': 'The pill containing both estrogen and progestin to prevent pregnancy belongs to which drug class?',

  // ─── philosophy ───────────────────────────────────────────────────────────
  // "benevolence" in single-word quoted form
  'philosophy_ec_confucius_core_virtue': 'What is the central Confucian virtue — usually translated as humaneness or human-heartedness — that Confucius called the defining quality of the exemplary person (junzi)?',

  // "docta ignorantia" in "De docta ignorantia"
  'philosophy_ms_cusa_docta_ignorantia': 'What concept did Nicholas of Cusa articulate in his 1440 work "De Docta Ignorantia," arguing that the highest wisdom consists in recognizing the limits of human knowledge before God\'s infinite nature?',

  // ─── us_presidents ────────────────────────────────────────────────────────
  // "Virginia" in "Virginia Dynasty"
  'pres_state_virginia_dynasty': 'The first five presidents included four from the same state — Washington, Jefferson, Madison, and Monroe. What was this dominance nicknamed, and which state did it refer to?',

  // ─── us_states ────────────────────────────────────────────────────────────
  // "Indiana" in "Indianapolis" (substring)
  'us_states_indiana_indy500': 'The Indianapolis 500 — considered the world\'s largest single-day sporting event — takes place at the Motor Speedway in which U.S. state?',

  // ─── world_capitals ───────────────────────────────────────────────────────
  // "Bissau" in "Guinea-Bissau"
  'capital_gw': 'What is the capital city of the small West African nation located on the Atlantic coast between Senegal and Guinea?',

  // ─── world_cuisines ───────────────────────────────────────────────────────
  // "Ottoman Empire" in question
  'food_dish_shawarma_origin': 'Shawarma\'s signature vertical rotating spit was innovated in 1830s Bursa — a city now in Turkey. In which historical empire was Bursa located at that time?',

  // "Peru and Bolivia" in question
  'food_spice_chili_origin': 'Chili peppers were part of human diets for thousands of years before reaching the rest of the world. In which two modern South American countries did they originate?',

  // ─── world_literature ─────────────────────────────────────────────────────
  // "Canterbury" in "Canterbury Tales"
  'lit_ren_chaucer_pilgrims': 'In Chaucer\'s famous collection of stories, a group of pilgrims travel to a cathedral city in southeast England. Which city is their destination?',

  // ─── world_religions ──────────────────────────────────────────────────────
  // "Mormon" in "Book of Mormon"
  'world_religions_chr_mormon': 'Which American Christian denomination — founded by Joseph Smith in 1830 — accepts an additional scriptural text (alongside the Bible) that is named after a prophet described within it?',

  // "Canterbury" in "Archbishop of Canterbury"
  'world_religions_chr_canterbury': 'Which English city is the spiritual center of the Anglican Communion and the seat of its senior bishop?',

  // ─── world_war_ii ─────────────────────────────────────────────────────────
  // "Enabling Act" in question
  'wwii_rtw_enabling_act_power': 'Hitler gained dictatorial power through an ostensibly legal parliamentary vote in 1933. What was the official name of this legislation — designed to sound benevolent rather than authoritarian?',

  // "War guilt clause" in question
  // medieval_world — Charlemagne in question 
  'med_feu_charlemagne_legacy': 'Why is the Frankish ruler who united much of Western Europe and was crowned Emperor in 800 CE called the "Father of Europe"?',

  // medieval_world — May 11, 868 CE in question
  'med_5_tang_diamond_sutra': 'The Diamond Sutra is the world\'s oldest surviving printed book. What specific date — day, month, and year — is printed within it?',

    // us_states — Mississippi in 'Mississippi Delta'
  'us_states_mississippi_blues': 'The fertile lowland region along a major Southern river is considered the birthplace of the blues — in which US state is this region located?',

  // world_cuisines — 4 denarii in "Roman price was 4 denarii per pound"
  'food_spice_pepper_roman': 'In 77 CE, the Roman price for black pepper was a specific number of denarii per pound. How much was the price per pound, and how did long pepper compare?',

  // world_war_ii — October 1944 in "In October 1944, Churchill met Stalin"
  'wwii_ad_percentage_agreement': 'Churchill and Stalin met in Moscow in late 1944 and famously scrawled sphere-of-influence percentages on a slip of paper — dividing Balkan control. In what month and year did this occur?',

    'wwii_rtw_001': 'The popular nickname for Article 231 of the Treaty of Versailles implies direct German responsibility for WWI. However, what word — which that nickname suggests — does the actual text of Article 231 notably NOT contain?',

  // "Kellogg-Briand Pact (1928)" — answer includes year
  'wwii_rtw_017': 'The 1928 multilateral treaty that outlawed war as an instrument of national policy failed to prevent WWII but established important legal precedents. What was the name of this pact?',

  // "Peace for our time" in question
  'wwii_rtw_peace_for_our_time_quote': 'Chamberlain\'s 1938 speech after Munich is constantly misquoted as "peace in our time." What was his actual EXACT phrase (one word differs from the common misquote)?',

  // ─── world_wonders ────────────────────────────────────────────────────────
  // "1,776 feet" in "exactly 1,776 feet tall"
  'ww_mod_one_wtc_height': 'One World Trade Center was deliberately designed to stand at a specific height that references an important year in American history. What is that height in feet, and what year does it commemorate?',

  // ─── Additional manual fixes for bad word_boundary_replacement results ─────────────
  // ap_biology — Substrate in 'enzyme-substrate complex'
  'ap_bio_enz_014': 'What is the name for the specific molecule that an enzyme acts upon, binding to the active site to catalyze a reaction?',
  'ap_bio_enzyme_substrate': "What is the name for the specific molecule that binds to an enzyme's active site, forming a complex that is then converted to product?",

  // ap_biology — Metaphase in 'metaphase plate'
  'ap_bio_u4_068': 'What is the phase of mitosis when chromosomes line up along the cell equator (the "equatorial plate"), with all kinetochores attached to spindle fibers from opposite poles?',
  'ap_bio_metaphase_chromosome_alignment': 'During which phase of mitosis do spindle fibers align all chromosomes along the cell\'s equatorial plate — with every kinetochore attached to fibers extending from opposite poles?',

  // ap_biology — Oncogenes in 'proto-oncogenes'
  // us_states — Kentucky in 'Kentucky Derby' 
  'us_states_kentucky_derby': 'Which US state is home to the horse racing event known as the Derby, traditionally held at Churchill Downs and considered the longest continuously running major sporting event in the country?',

  // ancient_rome — 'Father of the Country' in definition context
  'rome_aug_pater_patriae': 'What was the Latin honorific title — translated as "Pater Patriae" — that the Roman Senate awarded Augustus as the highest mark of civic honor?',

  // ap_european_history — Boer War (bad subject_lead_rewrite)
  'ap_euro_u7_boer_war': 'What was the name of the 1899–1902 conflict in South Africa between Britain and Dutch-descended Afrikaner settlers who had founded independent republics?',

  'ap_bio_u4_092': 'Normal growth-promoting genes can become malignant when mutated or overexpressed, driving uncontrolled cell proliferation as constitutively active accelerators. What are these transformed, cancer-causing genes called?',

  // ap_biology — Pisum sativum appears as full scientific name in context
  'ap_bio_pisum_sativum': 'Which common garden plant did Gregor Mendel use in his 1860s heredity experiments — the one classified by botanists under the binomial name used for garden peas?',

  // ap_biology — Ribozymes
  'ap_bio_ribozymes_def': 'What are RNA molecules called when they act as catalysts — capable of cleaving or ligating other RNA molecules — providing key evidence for the RNA world hypothesis?',

  // ap_biology — Endangered species in 'Endangered Species Act'
  'ap_bio_u8_099': 'What conservation classification describes a species facing significant risk of extinction throughout all or a significant portion of its range, legally protected in the US under federal wildlife law?',

  // ap_biology — Cyclin in 'cyclin-dependent kinases'
  'ap_bio_cyclin_definition': 'What class of regulatory proteins fluctuates in concentration at specific points in the cell cycle and must bind to CdKs to activate checkpoints — giving this protein class its name?',

  // ap_biology — Atmosphere in '78% of Earth's atmosphere'
  'ap_bio_nitrogen_largest_reservoir': "About 78% of Earth's air is composed of N2 gas. According to the nitrogen cycle, what part of the Earth system represents the largest reservoir of nitrogen?",

  // ap_european_history — republic in 'Dutch Republic'
  'ap_euro_u3_dutch_republic_government': 'What form of government made the Dutch state unique in 17th-century Europe, where most nations were moving toward absolute monarchy?',

  // ap_european_history — Colonial markets
  'ap_euro_u6_045': "What economic role did overseas trade networks play in Britain's early industrialization, providing raw materials from abroad and demand for manufactured goods?",

  // constellations — Pollux in 'Castor or Pollux?'
  'const_mc_gemini_brightest': 'Gemini contains two bright stars named after mythological twin brothers. Between the two — Castor and its sibling — which one is actually brighter?',

  // constellations — Second in 'second-largest'
  'const_mc_virgo_size_rank': 'Virgo is the largest constellation in the zodiac. When ranked among ALL 88 constellations by size, what numerical ranking does Virgo hold?',

  // constellations — 66,270 AD
  'const_sci_sirius_future_pole': "Due to the precession of Earth's axis, the bright star Sirius will eventually become a north pole star. In approximately what year will this occur?",

  // greek_mythology — Scylla in 'Between Scylla and Charybdis'
  'myth_odyssey_scylla_charybdis': "In Homer's Odyssey, Odysseus must navigate between two deadly sea monsters. One was Charybdis — a whirlpool monster. The other was a six-headed creature that devoured six of his men. What was that monster called?",

  // philosophy — docta ignorantia in 'De docta ignorantia'
  'philosophy_ms_cusa_docta_ignorantia': 'What Latin concept — meaning "learned ignorance" — did Nicholas of Cusa articulate in his 1440 philosophical work, arguing that the highest wisdom consists in recognizing the limits of human knowledge?',
};

// ─── Main rewrite logic ───────────────────────────────────────────────────────

/**
 * Attempt to auto-rewrite a self-answering question.
 * Returns { newQuestion, strategy } or null if no reliable rewrite found.
 */
function rewriteQuestion(question, answer, poolId, factId) {
  // Check for manual fix first
  if (MANUAL_FIXES[factId]) {
    const newQ = MANUAL_FIXES[factId];
    // For manual fixes, use word-boundary check (not substring) to verify answer was removed.
    // This allows proper nouns that contain the answer as a substring (Panathenaia/Athena,
    // Quetzalcoatlus/Quetzalcoatl, etc.) to pass through.
    if (!appearsAtWordBoundary(newQ, answer)) {
      return { newQuestion: newQ, strategy: 'manual_fix' };
    }
  }

  const q = question.trim();
  const a = answer;
  const qLower = q.toLowerCase();
  const aLower = a.toLowerCase();

  // ── Pattern 1: "What is X?" where X = answer exactly ──
  // Rewrite to "What is the definition of X?"
  if (isWhatIsXPattern(q, a)) {
    return {
      newQuestion: `What is the definition of ${a}?`,
      strategy: 'what_is_x_definition'
    };
  }

  // ── Pattern 2: Sentence starts with answer as subject ──
  // "The Baths of Caracalla were..." → "What structure were Rome's second largest..."
  if (isSubjectPattern(q, a)) {
    const placeholder = getPlaceholder(poolId, a);
    // Determine article: "What structure/organ/etc" depending on placeholder
    let articlePhrase = placeholder.startsWith('this ') ? 'what ' + placeholder.slice(5) : 'what structure';

    // Remove "The X" or just "X" from start and replace with "What [type]"
    const escaped = escapeRegex(a);
    const subjectRe = new RegExp(`^(?:the |this |a |an )?(?:'|")?${escaped}(?:'|")?(?:\\s*\\([^)]+\\))?\\s+`, 'i');
    const rest = q.replace(subjectRe, '');
    if (rest && rest.length > 10) {
      const verb = rest.match(/^(?:is|are|was|were|has|have|had|can|could|will|would|does|do|did|get|become|contain|consist)/i);
      if (verb) {
        const newQ = `What ${placeholder.slice(5)} ${rest}`;
        if (!newQ.toLowerCase().includes(aLower)) {
          return { newQuestion: ensureQuestionMark(newQ), strategy: 'subject_lead_rewrite' };
        }
      }
    }
  }

  // ── Pattern 3: Answer appears in quotes or with specific framing ──
  // "What was the 'Concert of Europe'?" → "What was this 1815 diplomatic system called?"
  // "What was the Kulturkampf of the 1870s in Germany?" → "What was Bismarck's anti-Catholic campaign called?"
  // For "What was the 'X'?" style — the answer IS the name, question asks what it was
  const whatWasQuoted = new RegExp(`^what was (?:the )?['"]${escapeRegex(a)}['"]`, 'i');
  const whatWasUnquoted = new RegExp(`^what was (?:the )?${escapeRegex(a)}`, 'i');
  if (whatWasQuoted.test(q) || whatWasUnquoted.test(q)) {
    // Rewrite: remove "What was the X" → "What was this [type] called?"
    const stripped = q
      .replace(whatWasQuoted, 'What was')
      .replace(whatWasUnquoted, 'What was');

    if (stripped !== q && stripped.length > 10) {
      // "What was [rest]?" — if rest is just "?" or empty, rewrite differently
      const rest = stripped.replace(/^what was\s*/i, '').trim();
      if (rest === '?' || rest === '') {
        return {
          newQuestion: `What is the name for ${getPlaceholder(poolId, a).replace('this ', 'the ')}?`,
          strategy: 'what_was_name_only'
        };
      }
      return { newQuestion: ensureQuestionMark(stripped), strategy: 'what_was_x_stripped' };
    }
  }

  // ── Pattern 4: Answer appears inside the question with word boundary ──
  // Replace with appropriate placeholder
  if (appearsAtWordBoundary(q, a)) {
    const placeholder = getPlaceholder(poolId, a);
    const newQ = replaceAtWordBoundary(q, a, placeholder);
    if (newQ !== q && !newQ.toLowerCase().includes(aLower)) {
      return { newQuestion: ensureQuestionMark(newQ), strategy: 'word_boundary_replacement' };
    }
  }

  return null; // Can't reliably auto-fix
}

function ensureQuestionMark(q) {
  const trimmed = q.trim();
  return trimmed.endsWith('?') ? trimmed : trimmed + '?';
}

// ─── Main processing ──────────────────────────────────────────────────────────

const deckFiles = fs.readdirSync(DECKS_DIR)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json')
  .sort();

const changes = [];
const skipped = [];
const flaggedForReview = [];
let totalFixed = 0;
let totalSkipped = 0;

for (const file of deckFiles) {
  const deckId = file.replace('.json', '');

  if (DECK_FILTER && deckId !== DECK_FILTER) continue;

  const deckPath = path.join(DECKS_DIR, file);
  const deck = JSON.parse(fs.readFileSync(deckPath, 'utf-8'));

  if (!deck.facts) continue;

  // Skip vocabulary decks entirely — self-answering is intentional
  if (deck.domain === 'vocabulary') {
    const selfAnsweringCount = deck.facts.filter(f => {
      const q = (f.quizQuestion || '').toLowerCase();
      const a = (f.correctAnswer || '').toLowerCase();
      if (f.quizMode === 'image_question' || f.quizMode === 'image_answers') return false;
      return a.length > 5 && q.includes(a);
    }).length;
    if (selfAnsweringCount > 0) {
      console.log(`SKIP (vocabulary): ${deckId} — ${selfAnsweringCount} intentionally self-answering`);
    }
    continue;
  }

  let deckModified = false;

  for (const fact of deck.facts) {
    const q = fact.quizQuestion || '';
    const a = fact.correctAnswer || '';
    const qLower = q.toLowerCase();
    const aLower = a.toLowerCase();

    // Skip image quiz modes — "Which image shows X?" is intentional
    if (fact.quizMode === 'image_question' || fact.quizMode === 'image_answers') continue;

    // Skip short answers (high false positive rate)
    if (aLower.length <= 5) continue;

    // Check if self-answering at all
    if (!qLower.includes(aLower)) continue;

    // Skip medical combining forms / root meanings — vocabulary-like
    if (qLower.includes('combining form') || qLower.includes('medical root') ||
        qLower.includes('what does the medical') || qLower.includes('what does the combining')) {
      skipped.push({ deckId, factId: fact.id, reason: 'medical_combining_form', q: q.slice(0, 80), a });
      totalSkipped++;
      continue;
    }

    // Check for word boundary match vs substring-only
    const isWordBoundary = appearsAtWordBoundary(q, a);
    const hasManualFix = Boolean(MANUAL_FIXES[fact.id]);

    if (!isWordBoundary && !hasManualFix) {
      // Substring-only: answer appears inside a larger word — flag for review
      flaggedForReview.push({
        deckId, factId: fact.id, q, a,
        reason: 'substring_only — answer is part of a larger word',
        poolId: fact.answerTypePoolId
      });
      continue;
    }

    const result = rewriteQuestion(q, a, fact.answerTypePoolId, fact.id);

    if (!result) {
      flaggedForReview.push({
        deckId, factId: fact.id, q, a,
        reason: 'no_pattern_matched',
        poolId: fact.answerTypePoolId
      });
      continue;
    }

    // Verify rewrite actually removed the answer (use word-boundary check, not substring)
    // This allows proper nouns that contain the answer as a substring to pass
    if (appearsAtWordBoundary(result.newQuestion, a)) {
      flaggedForReview.push({
        deckId, factId: fact.id, q, a,
        reason: 'rewrite_still_contains_answer',
        attempted: result.newQuestion,
        attemptedStrategy: result.strategy,
        poolId: fact.answerTypePoolId
      });
      continue;
    }

    // Verify rewrite is reasonably long
    if (result.newQuestion.trim().length < 20) {
      flaggedForReview.push({
        deckId, factId: fact.id, q, a,
        reason: 'rewrite_too_short',
        attempted: result.newQuestion,
        poolId: fact.answerTypePoolId
      });
      continue;
    }

    changes.push({
      deckId,
      factId: fact.id,
      originalQuestion: q,
      newQuestion: result.newQuestion,
      answer: a,
      strategy: result.strategy,
    });

    if (!DRY_RUN) {
      fact.quizQuestion = result.newQuestion;
      deckModified = true;
    }

    totalFixed++;
  }

  if (deckModified && !DRY_RUN) {
    fs.writeFileSync(deckPath, JSON.stringify(deck, null, 2) + '\n', 'utf-8');
    console.log(`Updated: ${deckId}`);
  }
}

// ─── Print report ─────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(70));
console.log(DRY_RUN ? 'DRY RUN — no files modified' : 'CHANGES APPLIED');
console.log('='.repeat(70));
console.log(`Fixed:                  ${totalFixed}`);
console.log(`Skipped (intentional):  ${totalSkipped}`);
console.log(`Flagged for review:     ${flaggedForReview.length}`);

if (changes.length > 0) {
  console.log('\n--- CHANGES ---');
  for (const c of changes) {
    console.log(`\n[${c.deckId}] ${c.factId}  strategy=${c.strategy}`);
    console.log(`  OLD: ${c.originalQuestion.slice(0, 110)}`);
    console.log(`  NEW: ${c.newQuestion.slice(0, 110)}`);
    console.log(`  A:   ${c.answer}`);
  }
}

if (flaggedForReview.length > 0) {
  console.log('\n--- FLAGGED FOR MANUAL REVIEW ---');
  for (const f of flaggedForReview) {
    console.log(`\n[${f.deckId}] ${f.factId}  reason=${f.reason}`);
    console.log(`  Q: ${f.q.slice(0, 110)}`);
    console.log(`  A: ${f.a}`);
    if (f.attempted) {
      console.log(`  ATTEMPTED: ${f.attempted.slice(0, 110)}`);
    }
  }
}

// Save JSON report
const report = {
  timestamp: new Date().toISOString(),
  dryRun: DRY_RUN,
  summary: { fixed: totalFixed, skipped: totalSkipped, flaggedForReview: flaggedForReview.length },
  changes,
  flaggedForReview,
  skipped
};
const reportPath = path.join(__dirname, '..', 'data', 'self-answering-fix-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`\nReport saved to: data/self-answering-fix-report.json`);
