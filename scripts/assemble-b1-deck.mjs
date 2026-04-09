#!/usr/bin/env node
// Assembly script for spanish_b1_grammar deck
// Reads all _wip b1_batch* files and produces final deck JSON

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const WIP_DIR = join(ROOT, 'data/decks/_wip');
const OUTPUT = join(ROOT, 'data/decks/spanish_b1_grammar.json');

// Load all batch files
const batchFiles = readdirSync(WIP_DIR).filter(f => f.startsWith('b1_batch')).sort();
let allFacts = [];
for (const f of batchFiles) {
  const batch = JSON.parse(readFileSync(join(WIP_DIR, f), 'utf8'));
  allFacts = allFacts.concat(batch);
  console.log(`Loaded ${batch.length} facts from ${f}`);
}
console.log(`Total facts: ${allFacts.length}`);

// Chain themes (from architecture)
const chainThemes = [
  { id: 0, name: "Present Subjunctive", description: "Presente de subjuntivo — regular and irregular forms + all trigger categories (espero que, cuando, para que, no creo que, etc.)", color: "#9B59B6", icon: "verb" },
  { id: 1, name: "Imperative: All Persons", description: "Affirmative imperative (usted/ustedes/nosotros) + negative imperative all persons (uses subjunctive)", color: "#E74C3C", icon: "command" },
  { id: 2, name: "Simple Conditional", description: "Condicional simple — hablaría, comería + irregular stems (haría, diría, tendría, podría)", color: "#E67E22", icon: "verb" },
  { id: 3, name: "Future Simple", description: "Futuro simple — hablaré, comeré + irregular stems (haré, diré, tendré) + si-clauses type 1", color: "#3498DB", icon: "verb" },
  { id: 4, name: "Pluperfect & Past Participles", description: "Pluscuamperfecto (había + PP) + irregular past participles B1 (abierto, escrito, muerto, roto)", color: "#1ABC9C", icon: "phrase" },
  { id: 5, name: "Double Object Pronouns", description: "se lo/la/los/las + me/te/nos lo/la + pronoun placement with infinitives, gerunds, imperatives", color: "#F39C12", icon: "pronoun" },
  { id: 6, name: "Relative Clauses", description: "que / quien / donde / lo que — basic relative clause structures", color: "#27AE60", icon: "structure" },
  { id: 7, name: "Verbal Periphrases", description: "acabar de + inf (just did) / volver a + inf (do again) / seguir + gerund / llevar + time + gerund", color: "#8E44AD", icon: "phrase" }
];

// Build answer type pools
const poolDefs = {
  subj_ar_regular: {
    description: "Present subjunctive regular -ar conjugations",
    syntheticDistractors: ["escuche", "escuches", "cante", "cantes", "viaje", "viajes", "llame", "llames", "compre"]
  },
  subj_er_ir_regular: {
    description: "Present subjunctive regular -er/-ir conjugations",
    syntheticDistractors: ["corra", "corras", "venda", "vendas", "escriba", "suba", "subas", "abra", "aprenda"]
  },
  subj_irregulars_ser_estar: {
    description: "Present subjunctive irregular: ser (sea) and estar (esté)",
    syntheticDistractors: ["soy", "eres", "estoy", "estás", "fui", "fueran", "estaba", "era"]
  },
  subj_irregulars_tener_hacer: {
    description: "Present subjunctive irregular: tener (tenga), hacer (haga), salir (salga), poner (ponga), decir (diga)",
    syntheticDistractors: ["tengo", "hago", "salgo", "pongo", "tuve", "hice", "salí", "puse"]
  },
  subj_irregulars_ir_querer: {
    description: "Present subjunctive irregular: ir (vaya), querer (quiera), poder (pueda), saber (sepa), venir (venga)",
    syntheticDistractors: ["voy", "vas", "quiero", "quieres", "puedo", "puedes", "sé", "vengo", "diga", "digas"]
  },
  subj_trigger_phrases: {
    description: "Trigger phrases that require subjunctive in the subordinate clause",
    syntheticDistractors: ["aunque", "porque", "si", "después de que", "en cuanto", "a menos que", "sin que", "siempre que"]
  },
  neg_imp_tu: {
    description: "Negative tú imperative forms (no + subjunctive)",
    syntheticDistractors: ["no corras", "no pienses", "no vuelvas", "no traigas", "no rompas", "no abras", "no cierres", "no preguntes", "no llegues"]
  },
  neg_imp_formal: {
    description: "Negative formal imperative forms (usted/ustedes/nosotros)",
    syntheticDistractors: ["no vengan", "no tengamos", "no estén", "no hagamos", "no digan", "no pongan", "no salgamos", "no puedan", "no sepan"]
  },
  imp_formal_affirm: {
    description: "Affirmative usted imperative forms",
    syntheticDistractors: ["descanse", "tome", "pruebe", "firme", "complete", "recuerde", "olvide", "busque", "lea"]
  },
  imp_formal_ustedes: {
    description: "Affirmative ustedes imperative forms",
    syntheticDistractors: ["descansen", "tomen", "prueben", "firmen", "busquen", "lean", "recuerden", "olviden", "escriban", "salgan"]
  },
  imp_nosotros: {
    description: "Affirmative nosotros imperative forms (let's...)",
    syntheticDistractors: ["descansemos", "bebamos", "corramos", "escribamos", "leamos", "busquemos", "tomemos", "juguemos", "esperemos"]
  },
  conditional_regular: {
    description: "Simple conditional regular forms",
    syntheticDistractors: ["trabajaría", "llamaría", "llegaría", "compraría", "escucharía", "ayudaría", "buscaría", "empezaría", "pasaría"]
  },
  conditional_irregular: {
    description: "Simple conditional irregular stems (haría, diría, tendría, etc.)",
    syntheticDistractors: ["podría", "podrías", "podrían", "vendría", "vendrías", "vendrían", "saldría", "saldrías", "pondría", "querría"]
  },
  future_regular: {
    description: "Simple future regular forms",
    syntheticDistractors: ["trabajaré", "llegaré", "compraré", "llamaré", "estudiaré", "pasaré", "empezaré", "escucharé", "buscaré"]
  },
  future_irregular: {
    description: "Simple future irregular stems (haré, diré, tendré, etc.)",
    syntheticDistractors: ["podré", "podrás", "podrán", "vendré", "vendrás", "vendrán", "saldré", "saldrás", "pondré", "querré"]
  },
  haber_imperfect: {
    description: "Imperfect of haber (for pluperfect formation)",
    syntheticDistractors: ["he", "has", "ha", "hemos", "han", "hubo", "habrá", "haya", "hubiera", "habría", "habremos", "habrías", "habiendo", "hube"]
  },
  irregular_pp_b1: {
    description: "Irregular past participles at B1 level",
    syntheticDistractors: ["abrido", "escribido", "morido", "rompido", "resolvido", "cubrado", "describido", "devolvido", "hecho", "vuelto", "puesto", "dicho", "visto"]
  },
  double_obj_se_combo: {
    description: "Double object pronoun combos with se (se lo/la/los/las)",
    syntheticDistractors: ["le lo", "le la", "les lo", "les los", "le los", "les las", "lo le", "la le", "los les", "las les", "me lo", "te lo", "nos lo", "me la", "te la"]
  },
  double_obj_me_te_nos: {
    description: "Double object pronoun combos with me/te/nos",
    syntheticDistractors: ["me le", "te le", "nos le", "me se", "te se", "lo me", "la te", "nos le"]
  },
  pronoun_placement_full: {
    description: "Full phrases showing double object pronoun placement",
    syntheticDistractors: ["comprártelo", "traértelo", "pedírselo", "contártelo", "mostrártelo", "enviártela", "llevársela"]
  },
  relative_pronouns: {
    description: "Spanish relative pronouns (que, quien, donde, lo que)",
    syntheticDistractors: ["cual", "cuál", "qué", "como", "cuando", "cuándo", "adonde", "el cual", "la cual"]
  },
  si_clause_patterns: {
    description: "Si-clause type 1 patterns",
    syntheticDistractors: ["si + imperfecto, condicional", "si + subjuntivo, imperativo", "si + futuro", "cuando + subjuntivo", "aunque + indicativo", "como + subjuntivo", "mientras + indicativo", "si estudias, habrías aprobado", "si llueve, iría", "si tienes hambre, come", "si tienes tiempo, irás"]
  },
  periphrasis_forms: {
    description: "Verbal periphrasis constructions",
    syntheticDistractors: ["acabo de dormir", "volviste a intentarlo", "seguimos trabajando", "llevan un mes viajando", "acababan de comer", "volvió a ganar", "sigo pensando", "llevas un año aquí"]
  }
};

// Build pools with factIds populated from facts
const poolMap = {};
for (const fact of allFacts) {
  const pid = fact.answerTypePoolId;
  if (!poolMap[pid]) poolMap[pid] = [];
  poolMap[pid].push(fact.id);
}

const answerTypePools = Object.entries(poolDefs).map(([id, def]) => {
  const factIds = poolMap[id] || [];
  const synth = def.syntheticDistractors || [];
  const total = factIds.length + synth.length;
  const flag = total < 15 ? ' ⚠️  UNDER 15' : '';
  console.log(`Pool ${id}: ${factIds.length} facts + ${synth.length} synthetic = ${total} total${flag}`);
  return {
    id,
    description: def.description,
    factIds,
    syntheticDistractors: synth
  };
}).filter(p => p.factIds.length > 0);

// Build subDecks
const subDeckMap = {
  0: { id: "sd_present_subjunctive", name: "Present Subjunctive", factIds: [] },
  1: { id: "sd_imperative_all", name: "Imperative: All Persons", factIds: [] },
  2: { id: "sd_conditional", name: "Simple Conditional", factIds: [] },
  3: { id: "sd_future_simple", name: "Future Simple", factIds: [] },
  4: { id: "sd_pluperfect_pp", name: "Pluperfect & Past Participles", factIds: [] },
  5: { id: "sd_double_obj_pronouns", name: "Double Object Pronouns", factIds: [] },
  6: { id: "sd_relative_clauses", name: "Relative Clauses", factIds: [] },
  7: { id: "sd_verbal_periphrases", name: "Verbal Periphrases", factIds: [] }
};
for (const fact of allFacts) {
  subDeckMap[fact.chainThemeId].factIds.push(fact.id);
}
const subDecks = Object.values(subDeckMap);

// Build difficultyTiers
const easy = allFacts.filter(f => f.difficulty === 1).map(f => f.id);
const medium = allFacts.filter(f => f.difficulty === 2 || f.difficulty === 3).map(f => f.id);
const hard = allFacts.filter(f => f.difficulty >= 4).map(f => f.id);
const difficultyTiers = [
  { tier: "easy", factIds: easy },
  { tier: "medium", factIds: medium },
  { tier: "hard", factIds: hard }
];
console.log(`Difficulty: easy=${easy.length}, medium=${medium.length}, hard=${hard.length}`);

// Build synonymGroups — facts sharing the same correctAnswer within same pool
const answerGroups = {};
for (const fact of allFacts) {
  const key = `${fact.answerTypePoolId}::${fact.correctAnswer}`;
  if (!answerGroups[key]) answerGroups[key] = [];
  answerGroups[key].push(fact.id);
}
const synonymGroups = [];
let synIdx = 0;
for (const [key, ids] of Object.entries(answerGroups)) {
  if (ids.length > 1) {
    const [poolId, answer] = key.split('::');
    synonymGroups.push({
      id: `syn_${synIdx++}`,
      factIds: ids,
      reason: `All facts have the same correct answer: '${answer}' (${poolId})`
    });
  }
}
console.log(`Synonym groups: ${synonymGroups.length}`);

// Assemble deck
const deck = {
  id: "spanish_b1_grammar",
  name: "Spanish B1 Grammar",
  domain: "vocabulary",
  subDomain: "spanish_grammar",
  description: "Master CEFR B1 Spanish grammar — from the present subjunctive and its triggers (espero que, cuando, para que) to the conditional, future, pluperfect, double object pronouns, and verbal periphrases. Fill in the blank to prove you know which form fits. Scoped from the Instituto Cervantes PCIC B1 curriculum.",
  minimumFacts: 150,
  targetFacts: 400,
  language: "es",
  facts: allFacts,
  chainThemes,
  answerTypePools,
  synonymGroups,
  difficultyTiers,
  subDecks,
  questionTemplates: [
    {
      id: "fill_blank_grammar",
      answerPoolId: "grammar_all",
      questionFormat: "{quizQuestion}",
      availableFromMastery: 0,
      difficulty: 2,
      reverseCapable: false
    }
  ]
};

writeFileSync(OUTPUT, JSON.stringify(deck, null, 2), 'utf8');
console.log(`\nWrote: ${OUTPUT}`);
console.log(`Total facts: ${allFacts.length}`);

// Tatoeba ratio
const tatCount = allFacts.filter(f => f.sourceRef && f.sourceRef.startsWith('tatoeba:')).length;
const pcicCount = allFacts.filter(f => f.sourceRef === 'PCIC-pattern').length;
console.log(`Tatoeba: ${tatCount} (${(tatCount/allFacts.length*100).toFixed(1)}%) | PCIC-pattern: ${pcicCount} (${(pcicCount/allFacts.length*100).toFixed(1)}%)`);
