#!/usr/bin/env node
// Assembly script for spanish_b2_grammar deck
// Reads all _wip b2_batch* files and produces final deck JSON

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const WIP_DIR = join(ROOT, 'data/decks/_wip');
const OUTPUT = join(ROOT, 'data/decks/spanish_b2_grammar.json');

// Load all batch files
const batchFiles = readdirSync(WIP_DIR).filter(f => f.startsWith('b2_batch')).sort();
let allFacts = [];
for (const f of batchFiles) {
  const batch = JSON.parse(readFileSync(join(WIP_DIR, f), 'utf8'));
  allFacts = allFacts.concat(batch);
  console.log(`Loaded ${batch.length} facts from ${f}`);
}
console.log(`Total facts: ${allFacts.length}`);

// Chain themes (from architecture)
const chainThemes = [
  { id: 0, name: "Imperfect Subjunctive", description: "Imperfecto de subjuntivo — both -ra and -se variants, regular and irregular (fuera, tuviera, hiciera, dijera, pudiera)", color: "#8E44AD", icon: "verb" },
  { id: 1, name: "Compound Subjunctive", description: "Present perfect subjunctive (haya hablado) + pluperfect subjunctive (hubiera/hubiese hablado)", color: "#9B59B6", icon: "verb" },
  { id: 2, name: "Si-Clauses: Full System", description: "Type 2 hypothetical (si tuviera... haría) + Type 3 counterfactual (si hubiera tenido... habría hecho) + mixed conditionals", color: "#E74C3C", icon: "structure" },
  { id: 3, name: "Compound Tenses", description: "Future perfect (habré hecho) + conditional perfect (habría hecho) — compound tense formation and uses", color: "#3498DB", icon: "verb" },
  { id: 4, name: "Passive Voice", description: "Ser + past participle (action passive) + se-passive (impersonal) + estar + past participle (resultative state)", color: "#1ABC9C", icon: "structure" },
  { id: 5, name: "Reported Speech", description: "Estilo indirecto — tense backshift rules + reporting verbs + imperative becomes imperfect subjunctive", color: "#E67E22", icon: "phrase" },
  { id: 6, name: "Advanced Connectors", description: "Concessive (aunque + subj, por mucho que) + causal (puesto que, dado que) + consecutive (por lo tanto, así que) + temporal/conditional with subjunctive", color: "#27AE60", icon: "connector" },
  { id: 7, name: "Por vs. Para: Advanced", description: "Full por/para system — cause, agent, exchange, duration, through, per vs. purpose, recipient, destination, deadline, opinion", color: "#F39C12", icon: "preposition" }
];

// Build answer type pools
const poolDefs = {
  imp_subj_ra_ar: {
    description: "Imperfect subjunctive -ra forms: regular -ar verbs (hablara, llegaras, trabajaran...)",
    syntheticDistractors: ["cantara", "cantaras", "cantáramos", "descansara", "descansaras", "llamara", "llamaras", "esperara", "esperaras", "pasara"]
  },
  imp_subj_ra_er_ir: {
    description: "Imperfect subjunctive -ra forms: regular -er/-ir verbs (comiera, viviera, aprendiera...)",
    syntheticDistractors: ["corriera", "corrieras", "leyera", "leyeras", "bebiera", "bebieras", "rompiera", "rompieras", "saliera", "salieras"]
  },
  imp_subj_ra_irregulars: {
    description: "Imperfect subjunctive -ra forms: irregular verbs (fuera, tuviera, hiciera, dijera, pudiera, supiera, pusiera, viniera, quisiera, estuviera)",
    syntheticDistractors: ["trajera", "trajeras", "diera", "dieras", "cayera", "cayeras", "leyera", "durmiera", "pidiera", "siguiera"]
  },
  imp_subj_se_ar: {
    description: "Imperfect subjunctive -se forms: regular -ar verbs (hablase, llegases, trabajasen...)",
    syntheticDistractors: ["cantase", "cantases", "descansase", "llamase", "llamases", "esperase", "esperases", "pasase", "pasases", "mirases"]
  },
  imp_subj_se_er_ir: {
    description: "Imperfect subjunctive -se forms: regular -er/-ir verbs (comiese, viviese, aprendiese...)",
    syntheticDistractors: ["corriese", "corrieses", "bebiese", "bebieses", "rompiese", "rompieses", "saliese", "salieses", "leyese", "entendiese"]
  },
  imp_subj_se_irregulars: {
    description: "Imperfect subjunctive -se forms: irregular verbs (fuese, tuviese, hiciese, dijese, pudiese, supiese, pusiese, viniese, quisiese, estuviese)",
    syntheticDistractors: ["trajese", "trajeses", "diese", "dieses", "cayese", "cayeses", "durmiese", "pidiese", "siguiese", "oyese"]
  },
  haber_subj_present: {
    description: "Present perfect subjunctive: haya/hayas/haya/hayamos/hayáis/hayan forms in context",
    syntheticDistractors: ["ha llegado", "has llegado", "había llegado", "hube llegado", "habría llegado", "he terminado", "habrá terminado", "hubiera terminado", "habiendo terminado", "hayan terminado — ¡sí!"]
  },
  haber_subj_pluperfect: {
    description: "Pluperfect subjunctive: hubiera/hubiese + past participle constructions",
    homogeneityExempt: true,
    homogeneityExemptNote: "Mixed compound constructions: hubiera + various past participles; inherent length variation",
    syntheticDistractors: ["habría llegado", "habría venido", "habría dicho", "había llegado", "hubiese terminado", "hubieran salido", "hubiese pedido", "habrían ido", "hubiéramos visto", "hubierais comido"]
  },
  si_clause_type2: {
    description: "Si-clause type 2 hypothetical: si + imperfect subjunctive + conditional (full sentences)",
    homogeneityExempt: true,
    homogeneityExemptNote: "Full conditional sentences with inherent length variation between subjects and verbs",
    syntheticDistractors: [
      "si tienes dinero, compras un coche",
      "si tendrías dinero, comprarías un coche",
      "si tengas dinero, comprarías un coche",
      "si has tenido dinero, comprarás un coche",
      "si tenías dinero, compraste un coche",
      "si tendrás dinero, comprarás un coche",
      "si tendría más tiempo, estudiaría más",
      "si habría sabido, habría venido",
      "si supiste la respuesta, la dijiste",
      "si puedes venir, me alegrarías"
    ]
  },
  si_clause_type3: {
    description: "Si-clause type 3 counterfactual past: si + pluperfect subjunctive + conditional perfect",
    homogeneityExempt: true,
    homogeneityExemptNote: "Full counterfactual sentences with inherent length variation",
    syntheticDistractors: [
      "si hubiera estudiado, aprobé",
      "si habría estudiado, habría aprobado",
      "si estudiaría más, habría aprobado",
      "si había estudiado más, habría aprobado",
      "si hubiera estudiado, aprobaría ahora",
      "si habría llegado antes, habría visto",
      "si hubiera llegado antes, había visto",
      "si llegaste antes, habrías visto",
      "si hubiera sabido, no vengo",
      "si hubiese pedido, me habrías ayudado"
    ]
  },
  si_clause_mixed: {
    description: "Mixed conditionals: past si-clause with present consequence",
    homogeneityExempt: true,
    homogeneityExemptNote: "Mixed conditional sentences have inherent structural length variation",
    syntheticDistractors: [
      "si hubiera estudiado medicina, habría sido médico",
      "si estudiaría medicina, sería médico ahora",
      "si hubiera comido menos, estaría sano",
      "si comería menos, estaré sano",
      "si habría nevado ayer, hará menos frío hoy",
      "si hubiera nevado ayer, haría menos frío ahora",
      "si no habría venido, no habría conocido",
      "si no venías, no conocerías",
      "si no hubieras ido, serías más feliz ahora",
      "si hubiera dicho la verdad, todo estaría mejor",
      "si hubiese trabajado más, estaría en una mejor posición",
      "si no hubiera llovido, no estaríamos mojados"
    ]
  },
  haber_future: {
    description: "Future perfect: habré/habrás/habrá/habremos/habréis/habrán forms in context",
    syntheticDistractors: ["habría terminado", "ha terminado", "había terminado", "hube terminado", "habrías llegado", "habremos visto", "habréis salido", "habrán llegado", "habiendo terminado ya", "habrá llegado — sí"]
  },
  haber_conditional: {
    description: "Conditional perfect: habría/habrías/habría/habríamos/habríais/habrían forms in context",
    syntheticDistractors: ["habré terminado", "había terminado", "hubiera terminado", "hubiese terminado", "habríamos visto antes", "habríais podido", "habrían hecho más", "habiendo podido ayudar", "habrías llegado — no", "habría — correcto"]
  },
  passive_ser_pp: {
    description: "Past participle forms in ser-passive (written, sent, built, signed, founded...)",
    syntheticDistractors: ["cocinado", "cocinada", "lavado", "lavada", "pintado", "pintada", "vendido", "vendida", "comprado", "comprada"]
  },
  passive_se_pattern: {
    description: "Se-passive constructions showing impersonal passive in various tenses",
    homogeneityExempt: true,
    homogeneityExemptNote: "Se-passive constructions vary in length due to different subject nouns and tense forms",
    syntheticDistractors: ["se habla cinco idiomas", "se vendemos pisos aquí", "se construía tres puentes", "se necesitamos trabajadores", "se alquilen habitaciones", "se firmaron — bien", "se hablan — correcto", "se venden — bien hecho"]
  },
  passive_estar_pp: {
    description: "Past participle forms with estar showing resultative state (cerrada, terminado, firmado...)",
    syntheticDistractors: ["cocinado", "cocinada", "lavado", "lavada", "pintado", "pintada", "preparado", "preparada", "roto", "rota"]
  },
  reported_speech_tense: {
    description: "Reported speech: backshifted verb forms in indirect speech context",
    homogeneityExempt: true,
    homogeneityExemptNote: "Indirect speech constructions vary in length due to different verbs and context",
    syntheticDistractors: ["dijo que está cansado", "dijo que estará cansado", "dijo que ha llegado tarde", "dijo que llegará tarde", "explicó que vendrá mañana", "afirmó que lo sabe todo", "prometió que está allí", "aseguró que ha pagado", "contó que vivió en Madrid", "explicó que vendría — sí"]
  },
  reported_speech_imperative: {
    description: "Reported imperatives as imperfect subjunctive constructions",
    homogeneityExempt: true,
    homogeneityExemptNote: "These constructions vary in length due to different reporting verbs and content",
    syntheticDistractors: ["le dijo que venga inmediatamente", "le dijo que vino inmediatamente", "le pidió que le ayude", "le pidió que le ayudó", "le aconsejé que descanse", "le aconsejé que ha descansado", "le ordenó que saliera — bien", "me pidió que no diga nada"]
  },
  concessive_connectors: {
    description: "Concessive connectors: aunque, a pesar de que, por mucho que, por más que, aun cuando",
    syntheticDistractors: ["porque", "ya que", "puesto que", "dado que", "sin embargo", "no obstante", "pero", "así que", "por lo tanto", "cuando"]
  },
  causal_connectors: {
    description: "Causal connectors: puesto que, ya que, dado que, debido a (que), visto que",
    syntheticDistractors: ["aunque", "sin embargo", "por lo tanto", "así que", "a menos que", "con tal de que", "mientras", "hasta que", "en cuanto", "no obstante"]
  },
  consecutive_connectors: {
    description: "Consecutive connectors: por lo tanto, así que, de modo que, de manera que, por consiguiente, en consecuencia",
    syntheticDistractors: ["porque", "ya que", "aunque", "a pesar de que", "sin embargo", "no obstante", "mientras", "hasta que", "con tal de que", "a menos que"]
  },
  temporal_subj_connectors: {
    description: "Temporal connectors with subjunctive for future events: en cuanto, tan pronto como, cuando, hasta que, mientras, después de que",
    syntheticDistractors: ["porque", "aunque", "dado que", "puesto que", "por lo tanto", "a menos que", "con tal de que", "a pesar de que", "por mucho que", "sin embargo"]
  },
  conditional_connectors: {
    description: "Conditional connectors with subjunctive: a menos que, con tal de que, siempre que, en caso de que, a condición de que",
    syntheticDistractors: ["cuando", "en cuanto", "hasta que", "mientras", "aunque", "a pesar de que", "ya que", "puesto que", "por lo tanto", "así que"]
  },
  por_advanced: {
    description: "Por in advanced roles: cause, passive agent, exchange, duration, through/along, per/rate, on behalf of, medium",
    syntheticDistractors: ["para", "a", "en", "de", "con", "sobre", "desde", "hasta", "hacia", "sin"]
  },
  para_advanced: {
    description: "Para in advanced roles: purpose, recipient, destination, deadline, opinion, unexpected contrast, employment",
    syntheticDistractors: ["por", "a", "en", "de", "con", "sobre", "desde", "hasta", "hacia", "sin"]
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
  const pool = {
    id,
    description: def.description,
    factIds,
    syntheticDistractors: synth
  };
  if (def.homogeneityExempt) {
    pool.homogeneityExempt = true;
    pool.homogeneityExemptNote = def.homogeneityExemptNote;
  }
  return pool;
}).filter(p => p.factIds.length > 0);

// Build subDecks
const subDeckMap = {
  0: { id: "sd_imperfect_subjunctive", name: "Imperfect Subjunctive", factIds: [] },
  1: { id: "sd_compound_subjunctive", name: "Compound Subjunctive", factIds: [] },
  2: { id: "sd_si_clauses_full", name: "Si-Clauses: Full System", factIds: [] },
  3: { id: "sd_compound_tenses", name: "Compound Tenses", factIds: [] },
  4: { id: "sd_passive_voice", name: "Passive Voice", factIds: [] },
  5: { id: "sd_reported_speech", name: "Reported Speech", factIds: [] },
  6: { id: "sd_connectors_advanced", name: "Advanced Connectors", factIds: [] },
  7: { id: "sd_por_para_advanced", name: "Por vs. Para: Advanced", factIds: [] }
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
  id: "spanish_b2_grammar",
  name: "Spanish B2 Grammar",
  domain: "vocabulary",
  subDomain: "spanish_grammar",
  description: "Master CEFR B2 Spanish grammar — imperfect subjunctive (-ra and -se forms), compound subjunctive (haya hablado, hubiera hecho), si-clauses types 2 and 3, future and conditional perfect, passive voice (ser/se/estar), reported speech with tense backshift, advanced connectors, and the full por/para system. Fill in the blank to prove you know which form fits. Scoped from the Instituto Cervantes PCIC B2 curriculum.",
  minimumFacts: 150,
  targetFacts: 500,
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

// Sub-deck breakdown
console.log('\nSub-deck breakdown:');
for (const sd of subDecks) {
  console.log(`  ${sd.name}: ${sd.factIds.length} facts`);
}
