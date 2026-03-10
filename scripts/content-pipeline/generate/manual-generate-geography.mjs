#!/usr/bin/env node
/**
 * Manual geography fact generator for Recall Rogue.
 * Reads raw geography data and produces quiz facts using template logic.
 * No external API calls — all facts are constructed from raw data + templates.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

const RAW_PATH = path.join(ROOT, 'data/raw/geography.json');
const OUTPUT_PATH = path.join(ROOT, 'data/generated/geography.jsonl');
const PROGRESS_PATH = path.join(ROOT, 'data/generated/qa-reports/manual-progress-geography.json');
const ERRORS_PATH = path.join(ROOT, 'data/generated/errors-geography-manual.json');

// ─── Helpers ───

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

function formatPop(pop) {
  const n = Number(pop);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} billion`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} million`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatArea(area) {
  const n = Math.round(Number(area));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M km²`;
  return `${n.toLocaleString('en-US')} km²`;
}

function difficultyFromPop(pop) {
  const n = Number(pop);
  if (n > 100_000_000) return 1;
  if (n > 30_000_000) return 2;
  if (n > 5_000_000) return 3;
  if (n > 500_000) return 4;
  return 5;
}

function funScoreFromCountry(row) {
  // Islands and small unique countries are more fun
  const desc = (row.countryDescription || '').toLowerCase();
  const pop = Number(row.population);
  if (desc.includes('island')) return 8;
  if (pop < 100_000) return 7;
  if (pop > 100_000_000) return 7; // big countries are interesting too
  return 5 + Math.floor(Math.random() * 3);
}

// ─── Distractor pools by continent ───

const CAPITAL_POOLS = {
  'North America': ['Mexico City', 'Ottawa', 'Washington D.C.', 'Havana', 'San José', 'Panama City', 'Kingston', 'Nassau', 'Tegucigalpa', 'Managua', 'San Salvador', 'Guatemala City', 'Belmopan', 'Santo Domingo', 'Port-au-Prince', 'Castries', 'Bridgetown', 'Roseau'],
  'South America': ['Buenos Aires', 'Brasília', 'Lima', 'Bogotá', 'Santiago', 'Quito', 'Caracas', 'Montevideo', 'Asunción', 'La Paz', 'Georgetown', 'Paramaribo', 'Sucre'],
  'Europe': ['London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'Lisbon', 'Vienna', 'Brussels', 'Amsterdam', 'Warsaw', 'Prague', 'Budapest', 'Athens', 'Stockholm', 'Oslo', 'Helsinki', 'Copenhagen', 'Dublin', 'Bucharest', 'Sofia', 'Zagreb', 'Vilnius', 'Riga', 'Tallinn', 'Bratislava', 'Ljubljana', 'Bern', 'Luxembourg City', 'Reykjavik', 'Tirana', 'Skopje', 'Podgorica', 'Sarajevo', 'Belgrade', 'Chisinau', 'Kyiv', 'Minsk', 'Moscow', 'Tbilisi', 'Yerevan', 'Baku'],
  'Asia': ['Tokyo', 'Beijing', 'New Delhi', 'Seoul', 'Bangkok', 'Jakarta', 'Manila', 'Hanoi', 'Islamabad', 'Dhaka', 'Colombo', 'Kathmandu', 'Kabul', 'Tehran', 'Baghdad', 'Riyadh', 'Ankara', 'Doha', 'Abu Dhabi', 'Muscat', 'Kuwait City', 'Bishkek', 'Dushanbe', 'Ashgabat', 'Vientiane', 'Phnom Penh', 'Naypyidaw', 'Taipei', 'Kuala Lumpur', 'Singapore', 'Thimphu', 'Malé'],
  'Africa': ['Cairo', 'Nairobi', 'Lagos', 'Addis Ababa', 'Pretoria', 'Accra', 'Dakar', 'Abuja', 'Algiers', 'Tunis', 'Rabat', 'Tripoli', 'Khartoum', 'Kampala', 'Dar es Salaam', 'Maputo', 'Lusaka', 'Harare', 'Bamako', 'Ouagadougou', 'Niamey', 'Conakry', 'Freetown', 'Monrovia', 'Yamoussoukro', 'Lomé', 'Cotonou', 'Antananarivo', 'Dodoma', 'Luanda', 'Kinshasa', 'Brazzaville', 'Libreville', 'Yaoundé', 'Bangui', 'Ndjamena', 'Mogadishu', 'Djibouti', 'Asmara', 'Juba', 'Windhoek', 'Gaborone', 'Maseru', 'Mbabane'],
  'Oceania': ['Canberra', 'Wellington', 'Suva', 'Port Moresby', 'Apia', 'Nukuʻalofa', 'Honiara', 'Port Vila', 'Tarawa', 'Funafuti', 'Palikir', 'Majuro', 'Ngerulmud'],
  'Antarctica': ['Canberra', 'Wellington', 'Buenos Aires']
};

const COUNTRY_POOLS = {
  'North America': ['Mexico', 'Canada', 'United States', 'Cuba', 'Jamaica', 'Honduras', 'Guatemala', 'Panama', 'Costa Rica', 'Nicaragua', 'El Salvador', 'Belize', 'Dominican Republic', 'Haiti', 'The Bahamas', 'Trinidad and Tobago', 'Barbados', 'Saint Lucia', 'Grenada', 'Dominica', 'Antigua and Barbuda', 'Saint Kitts and Nevis', 'Saint Vincent'],
  'South America': ['Brazil', 'Argentina', 'Colombia', 'Peru', 'Venezuela', 'Chile', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Guyana', 'Suriname'],
  'Europe': ['Germany', 'France', 'United Kingdom', 'Italy', 'Spain', 'Poland', 'Romania', 'Netherlands', 'Belgium', 'Sweden', 'Portugal', 'Austria', 'Greece', 'Czech Republic', 'Hungary', 'Norway', 'Denmark', 'Finland', 'Ireland', 'Switzerland', 'Croatia', 'Slovakia', 'Bulgaria', 'Serbia', 'Lithuania', 'Latvia', 'Estonia', 'Slovenia', 'Luxembourg', 'Iceland', 'Albania', 'North Macedonia', 'Montenegro', 'Bosnia', 'Moldova', 'Ukraine', 'Belarus'],
  'Asia': ['China', 'India', 'Indonesia', 'Japan', 'South Korea', 'Thailand', 'Vietnam', 'Philippines', 'Malaysia', 'Bangladesh', 'Pakistan', 'Iran', 'Iraq', 'Saudi Arabia', 'Turkey', 'Israel', 'Nepal', 'Myanmar', 'Sri Lanka', 'Afghanistan', 'Uzbekistan', 'Kazakhstan', 'Cambodia', 'Laos', 'Mongolia', 'Jordan', 'Lebanon', 'Syria', 'Yemen', 'Oman', 'Qatar', 'UAE', 'Kuwait', 'Bahrain', 'Brunei', 'Bhutan', 'Maldives', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Taiwan', 'Singapore'],
  'Africa': ['Nigeria', 'Ethiopia', 'Egypt', 'South Africa', 'Kenya', 'Tanzania', 'Ghana', 'Cameroon', 'Algeria', 'Morocco', 'Tunisia', 'Libya', 'Sudan', 'Uganda', 'Mozambique', 'Madagascar', 'Angola', 'Mali', 'Niger', 'Senegal', 'Guinea', 'Chad', 'Somalia', 'Congo', 'Zimbabwe', 'Zambia', 'Malawi', 'Namibia', 'Botswana', 'Rwanda', 'Burundi', 'Eritrea', 'Togo', 'Benin', 'Sierra Leone', 'Liberia'],
  'Oceania': ['Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Samoa', 'Tonga', 'Vanuatu', 'Solomon Islands', 'Kiribati', 'Micronesia', 'Palau', 'Tuvalu', 'Marshall Islands', 'Nauru'],
  'Antarctica': ['Australia', 'New Zealand', 'Argentina']
};

function pickDistractors(pool, correct, count) {
  const filtered = pool.filter(x => x !== correct && x.toLowerCase() !== correct.toLowerCase());
  // Shuffle
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }
  return filtered.slice(0, count);
}

// ─── Fact generation templates ───

/**
 * Generates a "capital city" fact for a country
 */
function generateCapitalFact(row, idx) {
  const { countryLabel: country, capitalLabel: capital, continentLabel: continent, country: entityUri, population, area, countryDescription } = row;
  const slug = slugify(country);
  const id = `geo-${slug}-${String(idx).padStart(3, '0')}`;
  const diff = difficultyFromPop(population);
  const fun = funScoreFromCountry(row);

  // Get distractor capitals from same continent
  const capitalPool = CAPITAL_POOLS[continent] || CAPITAL_POOLS['Asia'];
  const capitalDistractors = pickDistractors(capitalPool, capital, 8);
  const countryPool = COUNTRY_POOLS[continent] || COUNTRY_POOLS['Asia'];
  const countryDistractors = pickDistractors(countryPool, country, 5);

  return {
    id,
    statement: `The capital of ${country} is ${capital}.`,
    quizQuestion: `What is the capital of ${country}?`,
    correctAnswer: capital,
    variants: [
      {
        question: `What is the capital city of ${country}?`,
        type: 'forward',
        correctAnswer: capital,
        distractors: capitalDistractors.slice(0, 3)
      },
      {
        question: `${capital} is the capital of which country?`,
        type: 'reverse',
        correctAnswer: country,
        distractors: countryDistractors.slice(0, 3)
      },
      {
        question: `Which of these is NOT the capital of ${country}?`,
        type: 'negative',
        correctAnswer: capitalDistractors[0],
        distractors: [capital, capitalDistractors[1], capitalDistractors[2]]
      },
      {
        question: `The capital of ${country} is _____.`,
        type: 'fill_blank',
        correctAnswer: capital,
        distractors: capitalDistractors.slice(3, 6)
      },
      {
        question: `The capital of ${country} is ${capital}.`,
        type: 'true_false',
        correctAnswer: 'True',
        distractors: ['False']
      }
    ],
    distractors: [
      { text: capitalDistractors[0] || 'London', difficultyTier: 'easy' },
      { text: capitalDistractors[1] || 'Paris', difficultyTier: 'easy' },
      { text: capitalDistractors[2] || 'Berlin', difficultyTier: 'easy' },
      { text: capitalDistractors[3] || 'Tokyo', difficultyTier: 'medium' },
      { text: capitalDistractors[4] || 'Cairo', difficultyTier: 'medium' },
      { text: capitalDistractors[5] || 'Lima', difficultyTier: 'medium' },
      { text: capitalDistractors[6] || 'Bern', difficultyTier: 'hard' },
      { text: capitalDistractors[7] || 'Thimphu', difficultyTier: 'hard' }
    ],
    difficulty: diff,
    funScore: fun,
    wowFactor: generateWowFactor(row),
    visualDescription: generateVisualDesc(row),
    ageRating: 'kid',
    sourceName: 'Wikidata',
    sourceUrl: entityUri,
    category: 'geography',
    contentType: 'knowledge',
    tags: generateTags(row),
    sourceRecordId: entityUri,
    generationRetries: 0,
    generationRetryFlagged: false
  };
}

function generateWowFactor(row) {
  const { countryLabel: country, capitalLabel: capital, continentLabel: continent, population, area, countryDescription } = row;
  const desc = (countryDescription || '').toLowerCase();
  const pop = Number(population);
  const areaNum = Math.round(Number(area));

  if (desc.includes('island')) {
    return `${capital} is the tropical capital of the island nation of ${country}!`;
  }
  if (pop > 100_000_000) {
    return `${capital} is the bustling capital of ${country}, home to over ${formatPop(population)} people!`;
  }
  if (pop < 100_000) {
    return `Tiny ${country} has just ${formatPop(population)} people, with ${capital} as its charming capital!`;
  }
  if (areaNum > 1_000_000) {
    return `${capital} governs the vast territory of ${country}, spanning ${formatArea(area)}!`;
  }
  return `${capital} serves as the vibrant capital of ${country} in ${continent}!`;
}

function generateVisualDesc(row) {
  const { countryLabel: country, capitalLabel: capital, continentLabel: continent, countryDescription } = row;
  const desc = (countryDescription || '').toLowerCase();

  if (desc.includes('island') || desc.includes('caribbean')) {
    return `Pixel art tropical island capital city with colorful buildings, palm trees, and turquoise ocean waves surrounding ${capital} in ${country}.`;
  }
  if (continent === 'Africa') {
    return `Pixel art African capital city skyline of ${capital} with warm sunset colors, traditional and modern buildings, and savanna landscape.`;
  }
  if (continent === 'Asia') {
    return `Pixel art Asian capital city of ${capital} with ornate temples, busy markets, and mountain backdrop in ${country}.`;
  }
  if (continent === 'Europe') {
    return `Pixel art European capital city of ${capital} with historic architecture, cobblestone streets, and cathedral spires in ${country}.`;
  }
  if (continent === 'South America') {
    return `Pixel art South American capital of ${capital} with colorful colonial buildings, lush green mountains, and vibrant street life.`;
  }
  if (continent === 'Oceania') {
    return `Pixel art Pacific island capital of ${capital} with coral reefs, traditional longhouses, and coconut palm trees.`;
  }
  return `Pixel art capital city of ${capital} with distinctive architecture, national flag, and geographic landmarks of ${country}.`;
}

function generateTags(row) {
  const tags = ['capital', 'country'];
  const desc = (row.countryDescription || '').toLowerCase();
  if (desc.includes('island')) tags.push('island');
  if (desc.includes('caribbean')) tags.push('caribbean');
  if (row.continentLabel) tags.push(row.continentLabel.toLowerCase().replace(' ', '-'));
  return tags;
}

// ─── Main ───

async function main() {
  console.log('Reading raw geography data...');
  const rawData = JSON.parse(fs.readFileSync(RAW_PATH, 'utf-8'));
  console.log(`Raw records: ${rawData.length}`);

  // Read existing skip set
  const skipSet = new Set();
  if (fs.existsSync(OUTPUT_PATH)) {
    const lines = fs.readFileSync(OUTPUT_PATH, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.sourceRecordId) skipSet.add(obj.sourceRecordId);
      } catch {}
    }
  }
  console.log(`Already generated: ${skipSet.size} records`);

  // Deduplicate raw data by entity URI (keep first occurrence)
  const seen = new Set();
  const deduped = [];
  for (const row of rawData) {
    if (!seen.has(row.country)) {
      seen.add(row.country);
      deduped.push(row);
    }
  }
  console.log(`After dedup: ${deduped.length} unique countries`);

  // Filter out already-processed
  const toProcess = deduped.filter(r => !skipSet.has(r.country));
  console.log(`To process: ${toProcess.length}`);

  // Take first 50
  const batch = toProcess.slice(0, 50);
  console.log(`Batch size: ${batch.length}`);

  const generated = [];
  const errors = [];
  let globalIdx = skipSet.size;

  for (const row of batch) {
    // Validate row has enough data
    if (!row.capitalLabel || !row.countryLabel) {
      errors.push({
        sourceRecordId: row.country,
        countryLabel: row.countryLabel || '(missing)',
        reason: 'Missing capitalLabel or countryLabel'
      });
      continue;
    }

    globalIdx++;
    try {
      const fact = generateCapitalFact(row, globalIdx);
      generated.push(fact);
    } catch (err) {
      errors.push({
        sourceRecordId: row.country,
        countryLabel: row.countryLabel,
        reason: err.message
      });
    }
  }

  console.log(`Generated: ${generated.length}, Errors: ${errors.length}`);

  // Write in chunks of 25
  const CHUNK_SIZE = 25;
  for (let i = 0; i < generated.length; i += CHUNK_SIZE) {
    const chunk = generated.slice(i, i + CHUNK_SIZE);
    const lines = chunk.map(f => JSON.stringify(f)).join('\n') + '\n';
    fs.appendFileSync(OUTPUT_PATH, lines, 'utf-8');
    console.log(`Appended chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${chunk.length} facts`);

    // Write progress
    const progress = {
      domain: 'geography',
      totalProcessed: skipSet.size + i + chunk.length,
      batchGenerated: i + chunk.length,
      batchTarget: batch.length,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');
  }

  // Write errors
  if (errors.length > 0) {
    fs.writeFileSync(ERRORS_PATH, JSON.stringify(errors, null, 2), 'utf-8');
    console.log(`Errors written to: ${ERRORS_PATH}`);
  }

  console.log('\n=== Summary ===');
  console.log(`Generated: ${generated.length}`);
  console.log(`Skipped (already done): ${skipSet.size}`);
  console.log(`Failed: ${errors.length}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log(`Progress: ${PROGRESS_PATH}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
