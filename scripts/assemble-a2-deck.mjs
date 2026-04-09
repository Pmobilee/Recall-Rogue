#!/usr/bin/env node
// Assembly script for spanish_a2_grammar deck
// Reads all _wip batch files and produces final deck JSON

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const WIP_DIR = join(ROOT, 'data/decks/_wip');
const OUTPUT = join(ROOT, 'data/decks/spanish_a2_grammar.json');

// Load all batch files
const batchFiles = readdirSync(WIP_DIR).filter(f => f.startsWith('a2_batch')).sort();
let allFacts = [];
for (const f of batchFiles) {
  const batch = JSON.parse(readFileSync(join(WIP_DIR, f), 'utf8'));
  allFacts = allFacts.concat(batch);
  console.log(`Loaded ${batch.length} facts from ${f}`);
}
console.log(`Total facts: ${allFacts.length}`);

// Chain themes (from architecture)
const chainThemes = [
  { id: 0, name: "Preterite", description: "Pretérito indefinido — completed past actions, regular and irregular", color: "#C44B4B", icon: "verb" },
  { id: 1, name: "Imperfect", description: "Pretérito imperfecto — ongoing, habitual, or descriptive past", color: "#7B4EA6", icon: "verb" },
  { id: 2, name: "Perfect & Progressive", description: "Present perfect (he hablado) and present progressive (estoy hablando)", color: "#3A7BD5", icon: "phrase" },
  { id: 3, name: "Object Pronouns", description: "Direct and indirect object pronouns — lo/la, le/les, me/te/nos", color: "#E87E2E", icon: "pronoun" },
  { id: 4, name: "Reflexive Verbs", description: "Reflexive verbs — levantarse, acostarse, vestirse, sentirse, etc.", color: "#4A9E6B", icon: "pronoun" },
  { id: 5, name: "Comparatives & Superlatives", description: "más...que, menos...que, tan...como, mayor/mejor/peor, el más...", color: "#D4A017", icon: "contrast" },
  { id: 6, name: "Por, Para & Future", description: "por vs. para basics, ir a + infinitivo (near future), muy vs. mucho", color: "#2E8B57", icon: "structure" },
  { id: 7, name: "Imperative & Impersonal", description: "Affirmative tú imperative (habla/ven/haz) and impersonal se", color: "#8B5E3C", icon: "command" }
];

// Build answer type pools
const poolDefs = {
  preterite_ar: {
    description: "Regular -ar preterite conjugations",
    syntheticDistractors: ["viajé", "empecé", "dejé", "entré", "escuché", "olvidé", "pasé"]
  },
  preterite_er_ir: {
    description: "Regular -er/-ir preterite conjugations",
    syntheticDistractors: ["corriste", "bebimos", "vivimos", "saliste", "aprendí", "corrí", "escribiste"]
  },
  preterite_ser_ir: {
    description: "Ser/ir preterite forms (identical paradigm)",
    syntheticDistractors: ["iba", "ibas", "eras", "era", "somos", "vamos", "estuve", "estuvo"]
  },
  preterite_estar: {
    description: "Estar preterite conjugations",
    syntheticDistractors: ["estoy", "estabas", "estaba", "estará", "estaré", "estemos", "estés", "estarán"]
  },
  preterite_tener_hacer: {
    description: "Tener and hacer preterite forms",
    syntheticDistractors: ["tengo", "hago", "tuviera", "hacía", "tenía", "harías", "haría", "tendría"]
  },
  preterite_decir_ver_dar: {
    description: "Decir, ver, and dar preterite forms",
    syntheticDistractors: ["decía", "veía", "daba", "dices", "ves", "das", "diré", "veré"]
  },
  preterite_poder_poner_venir: {
    description: "Poder, poner, and venir preterite forms",
    syntheticDistractors: ["podía", "ponía", "venía", "puedo", "pongo", "vengo", "pondré", "vendré"]
  },
  preterite_querer_saber: {
    description: "Querer and saber preterite forms",
    syntheticDistractors: ["quería", "sabía", "quiero", "sé", "querría", "sabría", "quisieran", "supiera"]
  },
  preterite_time_expressions: {
    description: "Time expressions used with the preterite",
    syntheticDistractors: ["hace una semana", "hace dos meses", "el lunes pasado", "la noche pasada", "hace cinco años", "hace diez minutos", "el domingo pasado"]
  },
  imperfect_ar: {
    description: "Regular -ar imperfect conjugations",
    syntheticDistractors: ["cantaba", "cantabas", "llegaba", "llamaba", "estudiaba", "miraba", "miraban"]
  },
  imperfect_er_ir: {
    description: "Regular -er/-ir imperfect conjugations",
    syntheticDistractors: ["corría", "corrías", "vendía", "salía", "escribía", "bebíamos", "leían"]
  },
  imperfect_ser: {
    description: "Ser imperfect conjugations",
    syntheticDistractors: ["soy", "eres", "somos", "fuiste", "fue", "seré", "sería", "serás", "fuimos"]
  },
  imperfect_ir: {
    description: "Ir imperfect conjugations",
    syntheticDistractors: ["voy", "vas", "va", "vamos", "fui", "fuiste", "fue", "iré", "irá", "iremos"]
  },
  imperfect_ver: {
    description: "Ver imperfect conjugations",
    syntheticDistractors: ["veo", "ves", "vemos", "ven", "vi", "viste", "vimos", "veré", "vería", "verías"]
  },
  past_participles_regular: {
    description: "Regular past participles (-ado/-ido)",
    syntheticDistractors: ["entrado", "aprendido", "viajado", "olvidado", "llamado", "pasado", "llegado"]
  },
  past_participles_irregular: {
    description: "Irregular past participles",
    syntheticDistractors: ["hacido", "decido", "vido", "volvido", "escribido", "ponido", "abierto", "roto", "muerto", "cubierto"]
  },
  haber_forms: {
    description: "Present tense of haber (auxiliary for perfect tense)",
    syntheticDistractors: ["había", "habrá", "hubo", "haya", "hubiera", "habría", "habiendo", "habrías", "habremos"]
  },
  do_pronouns: {
    description: "Direct object pronouns",
    syntheticDistractors: ["le", "les", "se", "mi", "tu", "su", "él", "ella"]
  },
  io_pronouns: {
    description: "Indirect object pronouns",
    syntheticDistractors: ["lo", "la", "los", "las", "mi", "tu", "su", "él"]
  },
  reflexive_conjugations: {
    description: "Reflexive verb conjugated forms",
    syntheticDistractors: ["se ducha", "nos duchamos", "te vistes", "se viste", "nos vestimos", "se despiertan", "te diviertes"]
  },
  gerund_forms: {
    description: "Spanish gerund (present participle) forms",
    syntheticDistractors: ["llegando", "cantando", "escribiendo", "saliendo", "volviendo", "comiendo", "bebiendo"]
  },
  comparative_words: {
    description: "Comparative function words and phrases",
    syntheticDistractors: ["muy que", "mucho como", "tan que", "más como", "menos como", "tanto como", "igual que", "así como"]
  },
  comparative_irregular: {
    description: "Irregular comparative adjectives",
    syntheticDistractors: ["más grande", "más pequeño", "más bueno", "más malo", "más alto", "más bajo", "más joven", "más viejo", "superior", "inferior"]
  },
  imperative_tu: {
    description: "Tú imperative forms + impersonal se",
    syntheticDistractors: ["hablas", "comes", "escribes", "vengas", "tengas", "pongas", "salgas", "digas", "hagas", "vayas", "seas"]
  },
  por_para_choice: {
    description: "Choosing por or para in context + ir a future",
    syntheticDistractors: ["con", "de", "en", "a", "sin", "hacia", "desde", "sobre", "entre", "ante"]
  },
  muy_mucho_forms: {
    description: "muy vs. mucho/mucha/muchos/muchas",
    syntheticDistractors: ["bastante", "demasiado", "demasiada", "poco", "poca", "pocos", "pocas", "tanto", "tanta", "bastantes"]
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
  console.log(`Pool ${id}: ${factIds.length} facts + ${synth.length} synthetic = ${factIds.length + synth.length} total`);
  return {
    id,
    description: def.description,
    factIds,
    syntheticDistractors: synth
  };
}).filter(p => p.factIds.length > 0);

// Build subDecks
const subDeckMap = {
  0: { id: "sd_preterite", name: "Preterite", factIds: [] },
  1: { id: "sd_imperfect", name: "Imperfect", factIds: [] },
  2: { id: "sd_perfect_progressive", name: "Perfect & Progressive", factIds: [] },
  3: { id: "sd_object_pronouns", name: "Object Pronouns", factIds: [] },
  4: { id: "sd_reflexive_verbs", name: "Reflexive Verbs", factIds: [] },
  5: { id: "sd_comparatives_superlatives", name: "Comparatives & Superlatives", factIds: [] },
  6: { id: "sd_por_para_future", name: "Por, Para & Future", factIds: [] },
  7: { id: "sd_imperative_impersonal", name: "Imperative & Impersonal", factIds: [] }
};
for (const fact of allFacts) {
  subDeckMap[fact.chainThemeId].factIds.push(fact.id);
}
const subDecks = Object.values(subDeckMap);

// Build difficultyTiers
const easy = allFacts.filter(f => f.difficulty === 1).map(f => f.id);
const medium = allFacts.filter(f => f.difficulty === 2).map(f => f.id);
const hard = allFacts.filter(f => f.difficulty >= 3).map(f => f.id);
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
  id: "spanish_a2_grammar",
  name: "Spanish A2 Grammar",
  domain: "vocabulary",
  subDomain: "spanish_grammar",
  description: "Master CEFR A2 Spanish grammar — from past tenses (preterite and imperfect) and present perfect to reflexive verbs, object pronouns, comparatives, and the affirmative imperative. Fill in the blank to prove you know which form fits. Scoped from the Instituto Cervantes PCIC A2 curriculum.",
  minimumFacts: 120,
  targetFacts: 300,
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
const tatCount = allFacts.filter(f => f.sourceRef.startsWith('tatoeba:')).length;
const pcicCount = allFacts.filter(f => f.sourceRef === 'PCIC-pattern').length;
console.log(`Tatoeba: ${tatCount} (${(tatCount/allFacts.length*100).toFixed(1)}%) | PCIC-pattern: ${pcicCount}`);
