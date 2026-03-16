#!/usr/bin/env node
/**
 * reclassify-entities.mjs
 *
 * Pre-generation entity validation: checks whether each unprocessed entity
 * in data/curated/{domain}/entities.json actually belongs to its assigned domain.
 *
 * Usage:
 *   node scripts/content-pipeline/curate/reclassify-entities.mjs [--write]
 *
 *   --write    Apply changes to entity files (default: dry-run)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const WRITE = process.argv.includes('--write');
const ROOT = process.cwd();

const DOMAINS = [
  'animals_wildlife',
  'art_architecture',
  'food_cuisine',
  'general_knowledge',
  'geography',
  'history',
  'human_body_health',
  'mythology_folklore',
  'natural_sciences',
  'space_astronomy'
];

// Keywords that strongly indicate an entity belongs to a domain
// Each domain has positive keywords (entity likely belongs here)
const DOMAIN_KEYWORDS = {
  animals_wildlife: {
    label: [],
    description: [
      'species of', 'genus of', 'family of', 'order of', 'subclass of',
      'animal', 'mammal', 'bird', 'fish', 'insect', 'reptile', 'amphibian',
      'arachnid', 'crustacean', 'mollus', 'primate', 'felid', 'canid',
      'bovid', 'cetacean', 'rodent', 'marsupial', 'carnivoran',
      'worm', 'coral', 'sponge', 'jellyfish', 'shark', 'whale', 'dolphin',
      'ape', 'deer', 'bear', 'cat', 'dog', 'wolf', 'fox', 'lion', 'tiger',
      'eagle', 'hawk', 'parrot', 'penguin', 'owl'
    ]
  },
  art_architecture: {
    label: [],
    description: [
      'painter', 'sculptor', 'artist', 'architect', 'artwork', 'painting',
      'sculpture', 'museum', 'gallery', 'fresco', 'mosaic', 'mural',
      'art movement', 'artistic', 'visual art', 'engraver', 'printmaker',
      'illustrator', 'ceramic', 'pottery', 'architectural style',
      'cathedral', 'basilica', 'monument', 'landmark building'
    ]
  },
  food_cuisine: {
    label: [],
    description: [
      'food', 'dish', 'cuisine', 'beverage', 'ingredient', 'recipe',
      'cooking', 'baked', 'fermented', 'dessert', 'pastry', 'bread',
      'wine', 'beer', 'spirit', 'spice', 'herb', 'fruit', 'vegetable',
      'meat', 'dairy', 'cheese', 'soup', 'sauce', 'condiment',
      'rice wine', 'tea', 'coffee', 'chocolate', 'candy', 'sweet',
      'nutrient', 'vitamin', 'macronutrient', 'protein', 'carbohydrate',
      'preservation', 'pasteurization'
    ]
  },
  geography: {
    label: [],
    description: [
      'country', 'sovereign state', 'nation', 'republic', 'kingdom',
      'city', 'capital', 'town', 'region', 'province', 'territory',
      'island', 'archipelago', 'peninsula', 'continent',
      'river', 'lake', 'sea', 'ocean', 'strait', 'bay', 'gulf',
      'mountain', 'volcano', 'desert', 'forest', 'plain', 'valley',
      'landform', 'geographic', 'topograph',
      'rainforest', 'tundra', 'savanna', 'prairie', 'steppe',
      'beach', 'cliff', 'canyon', 'gorge', 'plateau',
      'drought', 'flood', 'tsunami', 'earthquake',
      'lagoon', 'delta', 'estuary', 'fjord',
      'mountain range', 'alpine', 'tropical'
    ]
  },
  history: {
    label: [],
    description: [
      'war', 'battle', 'empire', 'dynasty', 'kingdom', 'civilization',
      'pharaoh', 'emperor', 'conquest', 'revolution', 'colonial',
      'medieval', 'ancient', 'historical', 'treaty', 'siege',
      'military campaign', 'independence', 'republic',
      'city-state', 'nomadic people'
    ]
  },
  human_body_health: {
    label: [],
    description: [
      'organ', 'body part', 'anatomy', 'muscle', 'bone', 'blood',
      'brain', 'heart', 'lung', 'liver', 'kidney', 'skin',
      'disease', 'medical', 'health', 'clinical', 'surgical',
      'immune', 'virus', 'bacteria', 'infection', 'syndrome',
      'pharmaceutical', 'drug', 'therapy', 'diagnosis',
      'genital', 'reproductive', 'mammary', 'neural',
      'physician', 'doctor', 'surgeon', 'nurse',
      'vaccine', 'antibiotic', 'penicillin', 'anesthesia',
      'cell biology', 'microbiology', 'pathogen',
      'sleep', 'circadian', 'metabolism'
    ]
  },
  mythology_folklore: {
    label: [],
    description: [
      'god', 'goddess', 'deity', 'myth', 'legend', 'folklore',
      'hero of', 'demigod', 'titan', 'olympian', 'norse',
      'greek myth', 'roman myth', 'celtic', 'creature',
      'dragon', 'monster', 'fairy', 'spirit', 'demon',
      'underworld', 'prophecy', 'saga', 'epic poem',
      'trojan', 'ragnar'
    ]
  },
  natural_sciences: {
    label: [],
    description: [
      'physics', 'chemistry', 'biology', 'geology', 'ecology',
      'element', 'compound', 'molecule', 'atom', 'particle',
      'force', 'energy', 'wave', 'radiation', 'electromagnetic',
      'theorem', 'equation', 'formula', 'mathematical',
      'branch of mathematics', 'branch of science',
      'scientist', 'physicist', 'chemist', 'biologist', 'botanist',
      'mathematician', 'polymath', 'philosopher and mathematician',
      'naturalist', 'microbiologist',
      'wavelength', 'spectrum', 'frequency', 'photon',
      'visual perception', 'temperate season',
      'relativity', 'quantum', 'thermodynamic', 'entropy', 'kinetic', 'magnetic', 'electric',
      'chemical', 'periodic table', 'reaction', 'organic chemistry', 'inorganic',
      'cell', 'photosynthesis', 'evolution', 'genetic', 'DNA', 'RNA',
      'mineral', 'rock', 'fossil', 'tectonic', 'seismic',
      'ecosystem', 'biodiversity', 'habitat',
      'calculus', 'algebra', 'trigonometry', 'logarithm', 'prime number',
      'integer', 'rational', 'irrational', 'real number', 'complex number',
      'axiom', 'proof', 'conjecture',
      'unit of', 'measurement', 'kelvin', 'joule', 'watt', 'ampere', 'volt', 'ohm',
      'celsius', 'fahrenheit', 'metric',
      'vacuum', 'plasma', 'gas', 'liquid', 'solid', 'state of matter',
      'color', 'light',
      'gravity', 'motion', 'velocity', 'acceleration',
      'number theory', 'numeral', 'alchemy', 'distillation'
    ]
  },
  space_astronomy: {
    label: [],
    description: [
      'planet', 'dwarf planet', 'moon of', 'satellite of',
      'star', 'galaxy', 'nebula', 'pulsar', 'quasar',
      'asteroid', 'comet', 'meteor', 'orbit',
      'spacecraft', 'space mission', 'astronaut', 'cosmonaut',
      'telescope', 'observatory', 'solar system',
      'constellation', 'exoplanet', 'black hole',
      'astronomical', 'celestial',
      'big bang', 'cosmic', 'dark matter', 'dark energy', 'supernova',
      'solar wind', 'magnetosphere', 'aurora', 'eclipse',
      'kuiper', 'oort', 'rover', 'probe', 'lander', 'flyby',
      'ursa', 'orion', 'pleiades',
      'europa', 'titan', 'enceladus', 'ganymede', 'callisto',
      'mars rover', 'new horizons', 'voyager', 'hubble', 'james webb'
    ]
  },
  general_knowledge: {
    label: [],
    description: [
      'form of entertainment', 'type of sport', 'game',
      'holiday', 'celebration', 'festival', 'tradition',
      'invention', 'technology', 'computer', 'machine',
      'language', 'linguistic', 'writing system', 'alphabet',
      'religion', 'church', 'philosophy', 'education',
      'economics', 'currency', 'trade',
      'vehicle', 'transport', 'record',
      'actor', 'actress', 'filmmaker', 'singer', 'musician',
      'composer', 'novelist', 'writer', 'author', 'poet', 'playwright',
      'journalist', 'humorist',
      'comic actor', 'film director', 'screenwriter',
      'conductor', 'essayist', 'satirist',
      'model',
      'degree', 'university', 'school',
      'sport', 'olympic', 'championship',
      'card game', 'board game', 'video game',
      'karaoke', 'punched card', 'computing'
    ]
  }
};

// Entities that are too abstract/broad for quiz facts
// Only skip Latin/scientific group names and truly abstract meta-concepts
const SKIP_PATTERNS = [
  // Only skip Latin/scientific family/order names (NOT common English names)
  { test: (e) => /^(order|family|class|phylum|subclass|infraorder|superfamily) of/i.test(e.description) && /^[A-Z][a-z]+(?:idae|ales|iformes|oidea|inae|ini|optera|poda|ata|ia)$/.test(e.label), reason: 'Latin taxonomic group — too broad for quiz' },
  // Abstract meta-concepts with no concrete facts
  { test: (e) => /^(any individual|sequence of images that|mathematical object used to count)/.test(e.description), reason: 'Abstract concept' },
];

function scoreEntityForDomain(entity, domainKey) {
  const keywords = DOMAIN_KEYWORDS[domainKey];
  if (!keywords) return 0;

  const label = (entity.label || '').toLowerCase();
  const desc = (entity.description || '').toLowerCase();
  const combined = `${label} ${desc}`;

  let score = 0;
  for (const kw of keywords.description) {
    // Use word boundary regex to avoid partial matches (e.g., "cat" in "fortifications")
    const escapedKw = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKw}\\b`, 'i');
    if (regex.test(combined)) {
      score += 1;
    }
  }
  return score;
}

function shouldSkip(entity) {
  const desc = (entity.description || '');
  for (const { test, reason } of SKIP_PATTERNS) {
    if (test(entity)) {
      return reason;
    }
  }
  // Also skip if description is empty or very short
  if (desc.length < 5) return 'No description';
  return null;
}

function findBestDomain(entity, currentDomain) {
  const scores = {};
  for (const domain of DOMAINS) {
    scores[domain] = scoreEntityForDomain(entity, domain);
  }

  // Find the domain with the highest score
  let bestDomain = currentDomain;
  let bestScore = scores[currentDomain] || 0;

  for (const [domain, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestDomain = domain;
      bestScore = score;
    }
  }

  // Only suggest a move when there is a strong signal:
  // current domain scores 0 AND another domain scores >= 2
  const currentScore = scores[currentDomain] || 0;
  if (bestDomain !== currentDomain && currentScore === 0 && bestScore >= 2) {
    return { suggestedDomain: bestDomain, currentScore, bestScore };
  }

  return null; // Entity is fine where it is (includes 0/0 case — description too brief to judge)
}

// Main
console.log(`[reclassify] mode=${WRITE ? 'write' : 'dry-run'}`);
console.log('');

const report = { total: 0, flagged: 0, skipped: 0, byDomain: {} };

// Pre-load all qids per domain to detect cross-domain duplicates
const qidsByDomain = {};
for (const d of DOMAINS) {
  const fp = join(ROOT, 'data', 'curated', d, 'entities.json');
  if (existsSync(fp)) {
    const ents = JSON.parse(readFileSync(fp, 'utf8'));
    qidsByDomain[d] = new Set(ents.map(e => e.qid));
  }
}

for (const domain of DOMAINS) {
  const filePath = join(ROOT, 'data', 'curated', domain, 'entities.json');
  if (!existsSync(filePath)) {
    console.log(`[${domain}] File not found, skipping`);
    continue;
  }

  const entities = JSON.parse(readFileSync(filePath, 'utf8'));
  const domainReport = { total: entities.length, unprocessed: 0, flagged: 0, skipped: 0, moves: [] };
  let modified = false;

  for (const entity of entities) {
    if (entity.processed) continue;
    domainReport.unprocessed++;
    report.total++;

    // Check if entity should be skipped entirely
    const skipReason = shouldSkip(entity);
    if (skipReason) {
      domainReport.skipped++;
      report.skipped++;
      if (!entity.skip) {
        entity.skip = true;
        entity.skipReason = skipReason;
        modified = true;
        console.log(`  [SKIP] ${entity.label}: ${skipReason}`);
      }
      continue;
    }

    // Check if entity belongs to a different domain
    const result = findBestDomain(entity, domain);
    if (result) {
      // Skip if entity already exists in the suggested target domain (cross-domain duplicate)
      if (qidsByDomain[result.suggestedDomain]?.has(entity.qid)) {
        continue;
      }
      domainReport.flagged++;
      report.flagged++;
      domainReport.moves.push({
        label: entity.label,
        qid: entity.qid,
        from: domain,
        to: result.suggestedDomain,
        ambiguous: result.ambiguous || false
      });

      if (!entity.domainMismatch) {
        entity.domainMismatch = true;
        entity.suggestedDomain = result.suggestedDomain;
        modified = true;
      }

      const flag = result.ambiguous ? 'AMBIGUOUS' : 'MISMATCH';
      console.log(`  [${flag}] ${entity.label} (${domain} → ${result.suggestedDomain})`);
    }
  }

  if (WRITE && modified) {
    writeFileSync(filePath, JSON.stringify(entities, null, 2) + '\n');
    console.log(`  [WRITTEN] ${filePath}`);
  }

  report.byDomain[domain] = domainReport;
  const issues = domainReport.flagged + domainReport.skipped;
  if (issues > 0) {
    console.log(`[${domain}] ${domainReport.unprocessed} unprocessed, ${domainReport.flagged} mismatched, ${domainReport.skipped} skipped`);
  } else {
    console.log(`[${domain}] ${domainReport.unprocessed} unprocessed — all clean`);
  }
  console.log('');
}

// Summary
console.log('='.repeat(60));
console.log('RECLASSIFICATION SUMMARY');
console.log('='.repeat(60));
console.log(`Total unprocessed entities checked: ${report.total}`);
console.log(`Domain mismatches found: ${report.flagged}`);
console.log(`Entities to skip (too broad/abstract): ${report.skipped}`);
console.log(`Clean entities: ${report.total - report.flagged - report.skipped}`);
console.log('');

if (report.flagged > 0) {
  console.log('Suggested moves:');
  for (const [domain, dr] of Object.entries(report.byDomain)) {
    for (const move of dr.moves) {
      console.log(`  ${move.label} (${move.qid}): ${move.from} → ${move.to}${move.ambiguous ? ' [ambiguous]' : ''}`);
    }
  }
}

if (!WRITE) {
  console.log('');
  console.log('This was a dry run. Use --write to apply changes.');
}
