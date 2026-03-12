#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.join(__dirname, '../../src/data/seed');
const outputDir = path.join(__dirname, '../../data/generated');

// L1 label → domain key mapping
const l1ToDomain = {
  'General Knowledge': 'general_knowledge',
  'Natural Sciences': 'natural_sciences',
  'Space & Astronomy': 'space_astronomy',
  'Geography': 'geography',
  'History': 'history',
  'Mythology & Folklore': 'mythology_folklore',
  'Animals & Wildlife': 'animals_wildlife',
  'Human Body & Health': 'human_body_health',
  'Food & World Cuisine': 'food_cuisine',
  'Food & Cuisine': 'food_cuisine',
  'Art & Architecture': 'art_architecture',
};

// Taxonomy per domain
const taxonomy = {
  general_knowledge: new Set([
    'records_firsts', 'inventions_tech', 'landmarks_wonders', 'pop_culture',
    'words_language', 'everyday_science', 'oddities',
  ]),
  natural_sciences: new Set([
    'chemistry_elements', 'materials_engineering', 'biology_organisms',
    'physics_mechanics', 'geology_earth', 'botany_plants', 'ecology_environment',
  ]),
  space_astronomy: new Set([
    'missions_spacecraft', 'planets_moons', 'stars_galaxies', 'cosmology_universe',
    'satellites_tech', 'exoplanets_astrobio',
  ]),
  geography: new Set([
    'capitals_countries', 'africa', 'asia_oceania', 'europe', 'americas',
    'landforms_water', 'extreme_records', 'climate_biomes',
  ]),
  history: new Set([
    'ancient_classical', 'medieval', 'early_modern', 'modern_contemporary',
    'world_wars', 'battles_military', 'people_leaders', 'social_cultural',
  ]),
  mythology_folklore: new Set([
    'greek_roman', 'norse_celtic', 'eastern_myths', 'creatures_monsters',
    'creation_cosmology', 'folk_legends', 'gods_deities',
  ]),
  animals_wildlife: new Set([
    'mammals', 'birds', 'marine_life', 'insects_arachnids', 'reptiles_amphibians',
    'behavior_intelligence', 'conservation', 'adaptations',
  ]),
  human_body_health: new Set([
    'anatomy_organs', 'brain_neuro', 'genetics_dna', 'cardiovascular',
    'digestion_metabolism', 'senses_perception', 'immunity_disease', 'medical_science',
  ]),
  food_cuisine: new Set([
    'european_cuisine', 'asian_cuisine', 'world_cuisine', 'baking_desserts',
    'fermentation_beverages', 'food_history', 'food_science', 'ingredients_spices',
  ]),
  art_architecture: new Set([
    'museums_institutions', 'historic_buildings', 'painting_visual',
    'sculpture_decorative', 'modern_contemporary', 'architectural_styles', 'engineering_design',
  ]),
};

/**
 * Read all seed JSON files and extract unclassified facts
 */
function extractUnclassified() {
  const unclassified = {};

  // Initialize result object
  for (const domain of Object.keys(taxonomy)) {
    unclassified[domain] = [];
  }

  // Read all JSON files from seed directory
  const files = fs.readdirSync(seedDir).filter((f) => f.endsWith('.json'));

  let totalRead = 0;
  let totalUnclassified = 0;

  for (const file of files) {
    const filePath = path.join(seedDir, file);
    console.log(`Reading ${file}...`);

    let facts = [];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      facts = JSON.parse(content);
    } catch (err) {
      console.error(`  Error reading ${file}:`, err.message);
      continue;
    }

    if (!Array.isArray(facts)) {
      console.warn(`  Warning: ${file} is not an array`);
      continue;
    }

    for (const fact of facts) {
      totalRead++;

      const { id, categoryL1, categoryL2, statement = '', quizQuestion = '', correctAnswer = '' } = fact;

      // Skip Language facts
      if (!categoryL1 || categoryL1 === 'Language') {
        continue;
      }

      // Get domain from L1
      const domain = l1ToDomain[categoryL1];
      if (!domain) {
        console.warn(`  Unknown L1: "${categoryL1}" in fact ${id}`);
        continue;
      }

      // Check if L2 is valid for this domain
      if (!taxonomy[domain].has(categoryL2)) {
        totalUnclassified++;
        unclassified[domain].push({
          id,
          s: statement.substring(0, 200),
          q: quizQuestion.substring(0, 150),
          a: correctAnswer,
          l2: categoryL2,
        });
      }
    }
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output file
  const outputPath = path.join(outputDir, 'unclassified-facts.json');
  fs.writeFileSync(outputPath, JSON.stringify(unclassified, null, 2));

  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total facts read: ${totalRead}`);
  console.log(`Total unclassified: ${totalUnclassified}`);
  console.log('\nUnclassified per domain:');

  for (const [domain, facts] of Object.entries(unclassified)) {
    if (facts.length > 0) {
      console.log(`  ${domain}: ${facts.length}`);
    }
  }

  console.log(`\nOutput: ${outputPath}`);
}

extractUnclassified();
