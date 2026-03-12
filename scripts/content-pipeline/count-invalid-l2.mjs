import fs from 'node:fs'
const facts = JSON.parse(fs.readFileSync('src/data/seed/facts-generated.json', 'utf8'))
const TAXONOMY = {
  general_knowledge: new Set(['records_firsts','inventions_tech','landmarks_wonders','pop_culture','words_language','everyday_science','oddities']),
  natural_sciences: new Set(['chemistry_elements','materials_engineering','biology_organisms','physics_mechanics','geology_earth','botany_plants','ecology_environment']),
  space_astronomy: new Set(['missions_spacecraft','planets_moons','stars_galaxies','cosmology_universe','satellites_tech','exoplanets_astrobio']),
  geography: new Set(['capitals_countries','africa','asia_oceania','europe','americas','landforms_water','extreme_records','climate_biomes']),
  history: new Set(['ancient_classical','medieval','early_modern','modern_contemporary','world_wars','battles_military','people_leaders','social_cultural']),
  mythology_folklore: new Set(['greek_roman','norse_celtic','eastern_myths','creatures_monsters','creation_cosmology','folk_legends','gods_deities']),
  animals_wildlife: new Set(['mammals','birds','marine_life','insects_arachnids','reptiles_amphibians','behavior_intelligence','conservation','adaptations']),
  human_body_health: new Set(['anatomy_organs','brain_neuro','genetics_dna','cardiovascular','digestion_metabolism','senses_perception','immunity_disease','medical_science']),
  food_cuisine: new Set(['european_cuisine','asian_cuisine','world_cuisine','baking_desserts','fermentation_beverages','food_history','food_science','ingredients_spices']),
  art_architecture: new Set(['museums_institutions','historic_buildings','painting_visual','sculpture_decorative','modern_contemporary','architectural_styles','engineering_design']),
}
const L1_MAP = {
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
}
const invalidByDomain = {}
let totalInvalid = 0
let totalKnowledge = 0
for (const f of facts) {
  const l1 = f.categoryL1 || ''
  if (l1 === 'Language' || l1 === '') continue
  const domainKey = L1_MAP[l1]
  if (domainKey == null) continue
  totalKnowledge++
  const validSet = TAXONOMY[domainKey]
  const l2 = f.categoryL2 || ''
  if (validSet == null || !validSet.has(l2)) {
    totalInvalid++
    const key = l1 + ' / ' + (l2 || '(empty)')
    invalidByDomain[key] = (invalidByDomain[key] || 0) + 1
  }
}
console.log('Total knowledge facts:', totalKnowledge)
console.log('Facts with invalid L2:', totalInvalid)
console.log('')
const sorted = Object.entries(invalidByDomain).sort((a, b) => b[1] - a[1])
for (const [key, count] of sorted) {
  console.log('  ' + key + ': ' + count)
}
