#!/usr/bin/env npx tsx
/**
 * generate-countries-deck.ts
 *
 * Generates data/decks/world_countries.json — a curated deck where players
 * identify highlighted countries on a world map.
 *
 * Data source: public/assets/maps/countries/manifest.json
 * Run with: npx tsx scripts/generate-countries-deck.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ============================================================
// EXCLUDED TERRITORIES
// Not sovereign countries — territories, dependencies, or uninhabitable.
// Kosovo (XK) is included at difficulty 4.
// ============================================================
const EXCLUDED_ISOS = new Set(['AQ', 'EH', 'TF', 'FK', 'GL', 'NC', 'PR']);

// ============================================================
// CONTINENT ASSIGNMENTS
// chainThemeId: 0=Europe, 1=Asia, 2=Africa, 3=N/C America+Caribbean, 4=South America, 5=Oceania
// ============================================================
type Continent = 'Europe' | 'Asia' | 'Africa' | 'North America' | 'South America' | 'Oceania';

const CHAIN_THEME_ID: Record<Continent, number> = {
  Europe: 0,
  Asia: 1,
  Africa: 2,
  'North America': 3,
  'South America': 4,
  Oceania: 5,
};

// ============================================================
// COUNTRY METADATA
// ISO (uppercase) → { continent, difficulty, capital, funScore }
// ============================================================
interface CountryMeta {
  continent: Continent;
  difficulty: number;
  capital: string;
  funScore: number;
}

const COUNTRY_META: Record<string, CountryMeta> = {
  // ---- Europe ----
  FR: { continent: 'Europe', difficulty: 1, capital: 'Paris', funScore: 9 },
  DE: { continent: 'Europe', difficulty: 1, capital: 'Berlin', funScore: 8 },
  GB: { continent: 'Europe', difficulty: 1, capital: 'London', funScore: 9 },
  IT: { continent: 'Europe', difficulty: 1, capital: 'Rome', funScore: 9 },
  ES: { continent: 'Europe', difficulty: 1, capital: 'Madrid', funScore: 8 },
  RU: { continent: 'Europe', difficulty: 1, capital: 'Moscow', funScore: 8 },
  PT: { continent: 'Europe', difficulty: 2, capital: 'Lisbon', funScore: 7 },
  NL: { continent: 'Europe', difficulty: 2, capital: 'Amsterdam', funScore: 8 },
  BE: { continent: 'Europe', difficulty: 2, capital: 'Brussels', funScore: 7 },
  CH: { continent: 'Europe', difficulty: 2, capital: 'Bern', funScore: 7 },
  SE: { continent: 'Europe', difficulty: 2, capital: 'Stockholm', funScore: 7 },
  NO: { continent: 'Europe', difficulty: 2, capital: 'Oslo', funScore: 7 },
  PL: { continent: 'Europe', difficulty: 2, capital: 'Warsaw', funScore: 7 },
  GR: { continent: 'Europe', difficulty: 2, capital: 'Athens', funScore: 8 },
  AT: { continent: 'Europe', difficulty: 3, capital: 'Vienna', funScore: 7 },
  HU: { continent: 'Europe', difficulty: 3, capital: 'Budapest', funScore: 7 },
  CZ: { continent: 'Europe', difficulty: 3, capital: 'Prague', funScore: 7 },
  SK: { continent: 'Europe', difficulty: 3, capital: 'Bratislava', funScore: 5 },
  SI: { continent: 'Europe', difficulty: 3, capital: 'Ljubljana', funScore: 5 },
  HR: { continent: 'Europe', difficulty: 3, capital: 'Zagreb', funScore: 6 },
  FI: { continent: 'Europe', difficulty: 3, capital: 'Helsinki', funScore: 7 },
  DK: { continent: 'Europe', difficulty: 3, capital: 'Copenhagen', funScore: 7 },
  IE: { continent: 'Europe', difficulty: 3, capital: 'Dublin', funScore: 7 },
  RO: { continent: 'Europe', difficulty: 3, capital: 'Bucharest', funScore: 6 },
  BG: { continent: 'Europe', difficulty: 3, capital: 'Sofia', funScore: 5 },
  UA: { continent: 'Europe', difficulty: 3, capital: 'Kyiv', funScore: 7 },
  BY: { continent: 'Europe', difficulty: 3, capital: 'Minsk', funScore: 5 },
  RS: { continent: 'Europe', difficulty: 3, capital: 'Belgrade', funScore: 6 },
  TR: { continent: 'Asia', difficulty: 2, capital: 'Ankara', funScore: 8 },
  IS: { continent: 'Europe', difficulty: 3, capital: 'Reykjavik', funScore: 8 },
  LT: { continent: 'Europe', difficulty: 3, capital: 'Vilnius', funScore: 5 },
  LV: { continent: 'Europe', difficulty: 3, capital: 'Riga', funScore: 5 },
  EE: { continent: 'Europe', difficulty: 3, capital: 'Tallinn', funScore: 5 },
  MD: { continent: 'Europe', difficulty: 4, capital: 'Chisinau', funScore: 4 },
  AL: { continent: 'Europe', difficulty: 4, capital: 'Tirana', funScore: 5 },
  BA: { continent: 'Europe', difficulty: 4, capital: 'Sarajevo', funScore: 6 },
  MK: { continent: 'Europe', difficulty: 4, capital: 'Skopje', funScore: 5 },
  ME: { continent: 'Europe', difficulty: 4, capital: 'Podgorica', funScore: 5 },
  XK: { continent: 'Europe', difficulty: 4, capital: 'Pristina', funScore: 5 },
  LU: { continent: 'Europe', difficulty: 4, capital: 'Luxembourg City', funScore: 6 },
  CY: { continent: 'Europe', difficulty: 4, capital: 'Nicosia', funScore: 6 },

  // ---- Asia ----
  CN: { continent: 'Asia', difficulty: 1, capital: 'Beijing', funScore: 9 },
  JP: { continent: 'Asia', difficulty: 1, capital: 'Tokyo', funScore: 10 },
  IN: { continent: 'Asia', difficulty: 1, capital: 'New Delhi', funScore: 9 },
  KR: { continent: 'Asia', difficulty: 2, capital: 'Seoul', funScore: 9 },
  TH: { continent: 'Asia', difficulty: 2, capital: 'Bangkok', funScore: 8 },
  SA: { continent: 'Asia', difficulty: 2, capital: 'Riyadh', funScore: 7 },
  IR: { continent: 'Asia', difficulty: 2, capital: 'Tehran', funScore: 7 },
  PK: { continent: 'Asia', difficulty: 2, capital: 'Islamabad', funScore: 7 },
  VN: { continent: 'Asia', difficulty: 3, capital: 'Hanoi', funScore: 8 },
  MY: { continent: 'Asia', difficulty: 3, capital: 'Kuala Lumpur', funScore: 7 },
  PH: { continent: 'Asia', difficulty: 3, capital: 'Manila', funScore: 8 },
  ID: { continent: 'Asia', difficulty: 3, capital: 'Jakarta', funScore: 8 },
  MM: { continent: 'Asia', difficulty: 3, capital: 'Naypyidaw', funScore: 6 },
  KH: { continent: 'Asia', difficulty: 3, capital: 'Phnom Penh', funScore: 7 },
  LA: { continent: 'Asia', difficulty: 3, capital: 'Vientiane', funScore: 6 },
  BD: { continent: 'Asia', difficulty: 3, capital: 'Dhaka', funScore: 6 },
  NP: { continent: 'Asia', difficulty: 3, capital: 'Kathmandu', funScore: 8 },
  AF: { continent: 'Asia', difficulty: 3, capital: 'Kabul', funScore: 6 },
  IQ: { continent: 'Asia', difficulty: 3, capital: 'Baghdad', funScore: 7 },
  SY: { continent: 'Asia', difficulty: 3, capital: 'Damascus', funScore: 6 },
  YE: { continent: 'Asia', difficulty: 3, capital: "Sana'a", funScore: 5 },
  JO: { continent: 'Asia', difficulty: 3, capital: 'Amman', funScore: 6 },
  AE: { continent: 'Asia', difficulty: 3, capital: 'Abu Dhabi', funScore: 8 },
  IL: { continent: 'Asia', difficulty: 3, capital: 'Jerusalem', funScore: 7 },
  KZ: { continent: 'Asia', difficulty: 3, capital: 'Astana', funScore: 6 },
  UZ: { continent: 'Asia', difficulty: 3, capital: 'Tashkent', funScore: 6 },
  MN: { continent: 'Asia', difficulty: 3, capital: 'Ulaanbaatar', funScore: 7 },
  LB: { continent: 'Asia', difficulty: 3, capital: 'Beirut', funScore: 6 },
  PS: { continent: 'Asia', difficulty: 3, capital: 'Ramallah', funScore: 5 },
  TL: { continent: 'Asia', difficulty: 4, capital: 'Dili', funScore: 6 },
  GE: { continent: 'Asia', difficulty: 4, capital: 'Tbilisi', funScore: 6 },
  AM: { continent: 'Asia', difficulty: 4, capital: 'Yerevan', funScore: 6 },
  AZ: { continent: 'Asia', difficulty: 4, capital: 'Baku', funScore: 6 },
  KW: { continent: 'Asia', difficulty: 4, capital: 'Kuwait City', funScore: 6 },
  QA: { continent: 'Asia', difficulty: 4, capital: 'Doha', funScore: 7 },
  OM: { continent: 'Asia', difficulty: 4, capital: 'Muscat', funScore: 6 },
  TJ: { continent: 'Asia', difficulty: 4, capital: 'Dushanbe', funScore: 4 },
  KG: { continent: 'Asia', difficulty: 4, capital: 'Bishkek', funScore: 4 },
  TM: { continent: 'Asia', difficulty: 4, capital: 'Ashgabat', funScore: 5 },
  BT: { continent: 'Asia', difficulty: 4, capital: 'Thimphu', funScore: 7 },
  LK: { continent: 'Asia', difficulty: 4, capital: 'Sri Jayawardenepura Kotte', funScore: 7 },
  BN: { continent: 'Asia', difficulty: 4, capital: 'Bandar Seri Begawan', funScore: 6 },
  KP: { continent: 'Asia', difficulty: 3, capital: 'Pyongyang', funScore: 7 },
  'CN-TW': { continent: 'Asia', difficulty: 3, capital: 'Taipei', funScore: 7 },

  // ---- Africa ----
  ZA: { continent: 'Africa', difficulty: 2, capital: 'Pretoria', funScore: 8 },
  EG: { continent: 'Africa', difficulty: 2, capital: 'Cairo', funScore: 9 },
  NG: { continent: 'Africa', difficulty: 2, capital: 'Abuja', funScore: 7 },
  MA: { continent: 'Africa', difficulty: 2, capital: 'Rabat', funScore: 8 },
  ET: { continent: 'Africa', difficulty: 3, capital: 'Addis Ababa', funScore: 7 },
  KE: { continent: 'Africa', difficulty: 3, capital: 'Nairobi', funScore: 7 },
  TZ: { continent: 'Africa', difficulty: 3, capital: 'Dodoma', funScore: 6 },
  GH: { continent: 'Africa', difficulty: 3, capital: 'Accra', funScore: 7 },
  DZ: { continent: 'Africa', difficulty: 3, capital: 'Algiers', funScore: 7 },
  TN: { continent: 'Africa', difficulty: 3, capital: 'Tunis', funScore: 7 },
  SD: { continent: 'Africa', difficulty: 3, capital: 'Khartoum', funScore: 6 },
  AO: { continent: 'Africa', difficulty: 3, capital: 'Luanda', funScore: 5 },
  CD: { continent: 'Africa', difficulty: 3, capital: 'Kinshasa', funScore: 6 },
  CM: { continent: 'Africa', difficulty: 3, capital: 'Yaoundé', funScore: 6 },
  MG: { continent: 'Africa', difficulty: 3, capital: 'Antananarivo', funScore: 8 },
  MZ: { continent: 'Africa', difficulty: 3, capital: 'Maputo', funScore: 5 },
  ZM: { continent: 'Africa', difficulty: 3, capital: 'Lusaka', funScore: 5 },
  UG: { continent: 'Africa', difficulty: 3, capital: 'Kampala', funScore: 6 },
  SO: { continent: 'Africa', difficulty: 3, capital: 'Mogadishu', funScore: 5 },
  LY: { continent: 'Africa', difficulty: 3, capital: 'Tripoli', funScore: 6 },
  SN: { continent: 'Africa', difficulty: 3, capital: 'Dakar', funScore: 6 },
  ML: { continent: 'Africa', difficulty: 3, capital: 'Bamako', funScore: 6 },
  CI: { continent: 'Africa', difficulty: 3, capital: 'Yamoussoukro', funScore: 6 },
  ZW: { continent: 'Africa', difficulty: 3, capital: 'Harare', funScore: 5 },
  BW: { continent: 'Africa', difficulty: 3, capital: 'Gaborone', funScore: 7 },
  NA: { continent: 'Africa', difficulty: 3, capital: 'Windhoek', funScore: 7 },
  RW: { continent: 'Africa', difficulty: 4, capital: 'Kigali', funScore: 7 },
  SS: { continent: 'Africa', difficulty: 4, capital: 'Juba', funScore: 5 },
  TD: { continent: 'Africa', difficulty: 4, capital: "N'Djamena", funScore: 4 },
  NE: { continent: 'Africa', difficulty: 4, capital: 'Niamey', funScore: 4 },
  MR: { continent: 'Africa', difficulty: 4, capital: 'Nouakchott', funScore: 4 },
  BF: { continent: 'Africa', difficulty: 4, capital: 'Ouagadougou', funScore: 5 },
  ER: { continent: 'Africa', difficulty: 4, capital: 'Asmara', funScore: 5 },
  CF: { continent: 'Africa', difficulty: 4, capital: 'Bangui', funScore: 4 },
  CG: { continent: 'Africa', difficulty: 4, capital: 'Brazzaville', funScore: 5 },
  GA: { continent: 'Africa', difficulty: 4, capital: 'Libreville', funScore: 5 },
  GN: { continent: 'Africa', difficulty: 4, capital: 'Conakry', funScore: 4 },
  MW: { continent: 'Africa', difficulty: 4, capital: 'Lilongwe', funScore: 5 },
  BI: { continent: 'Africa', difficulty: 4, capital: 'Gitega', funScore: 4 },
  TG: { continent: 'Africa', difficulty: 4, capital: 'Lomé', funScore: 4 },
  BJ: { continent: 'Africa', difficulty: 4, capital: 'Porto-Novo', funScore: 4 },
  GM: { continent: 'Africa', difficulty: 4, capital: 'Banjul', funScore: 5 },
  GW: { continent: 'Africa', difficulty: 5, capital: 'Bissau', funScore: 3 },
  LR: { continent: 'Africa', difficulty: 4, capital: 'Monrovia', funScore: 5 },
  SL: { continent: 'Africa', difficulty: 4, capital: 'Freetown', funScore: 4 },
  GQ: { continent: 'Africa', difficulty: 5, capital: 'Malabo', funScore: 3 },
  DJ: { continent: 'Africa', difficulty: 5, capital: 'Djibouti City', funScore: 4 },
  LS: { continent: 'Africa', difficulty: 5, capital: 'Maseru', funScore: 5 },
  SZ: { continent: 'Africa', difficulty: 5, capital: 'Mbabane', funScore: 4 },

  // ---- North America (incl. Central America & Caribbean) ----
  US: { continent: 'North America', difficulty: 1, capital: 'Washington D.C.', funScore: 9 },
  CA: { continent: 'North America', difficulty: 1, capital: 'Ottawa', funScore: 8 },
  MX: { continent: 'North America', difficulty: 1, capital: 'Mexico City', funScore: 9 },
  CU: { continent: 'North America', difficulty: 3, capital: 'Havana', funScore: 8 },
  HT: { continent: 'North America', difficulty: 3, capital: 'Port-au-Prince', funScore: 5 },
  DO: { continent: 'North America', difficulty: 3, capital: 'Santo Domingo', funScore: 6 },
  GT: { continent: 'North America', difficulty: 3, capital: 'Guatemala City', funScore: 6 },
  HN: { continent: 'North America', difficulty: 3, capital: 'Tegucigalpa', funScore: 5 },
  NI: { continent: 'North America', difficulty: 3, capital: 'Managua', funScore: 5 },
  CR: { continent: 'North America', difficulty: 3, capital: 'San José', funScore: 7 },
  PA: { continent: 'North America', difficulty: 3, capital: 'Panama City', funScore: 7 },
  SV: { continent: 'North America', difficulty: 3, capital: 'San Salvador', funScore: 5 },
  BZ: { continent: 'North America', difficulty: 4, capital: 'Belmopan', funScore: 6 },
  JM: { continent: 'North America', difficulty: 3, capital: 'Kingston', funScore: 7 },
  TT: { continent: 'North America', difficulty: 4, capital: 'Port of Spain', funScore: 7 },
  BS: { continent: 'North America', difficulty: 4, capital: 'Nassau', funScore: 6 },

  // ---- South America ----
  BR: { continent: 'South America', difficulty: 1, capital: 'Brasília', funScore: 9 },
  AR: { continent: 'South America', difficulty: 2, capital: 'Buenos Aires', funScore: 9 },
  CO: { continent: 'South America', difficulty: 3, capital: 'Bogotá', funScore: 7 },
  CL: { continent: 'South America', difficulty: 3, capital: 'Santiago', funScore: 7 },
  PE: { continent: 'South America', difficulty: 3, capital: 'Lima', funScore: 8 },
  VE: { continent: 'South America', difficulty: 3, capital: 'Caracas', funScore: 6 },
  EC: { continent: 'South America', difficulty: 3, capital: 'Quito', funScore: 7 },
  BO: { continent: 'South America', difficulty: 3, capital: 'Sucre', funScore: 6 },
  PY: { continent: 'South America', difficulty: 3, capital: 'Asunción', funScore: 5 },
  UY: { continent: 'South America', difficulty: 3, capital: 'Montevideo', funScore: 7 },
  GY: { continent: 'South America', difficulty: 4, capital: 'Georgetown', funScore: 5 },
  SR: { continent: 'South America', difficulty: 4, capital: 'Paramaribo', funScore: 5 },

  // ---- Oceania ----
  AU: { continent: 'Oceania', difficulty: 1, capital: 'Canberra', funScore: 9 },
  NZ: { continent: 'Oceania', difficulty: 2, capital: 'Wellington', funScore: 8 },
  PG: { continent: 'Oceania', difficulty: 3, capital: 'Port Moresby', funScore: 6 },
  FJ: { continent: 'Oceania', difficulty: 4, capital: 'Suva', funScore: 7 },
  SB: { continent: 'Oceania', difficulty: 5, capital: 'Honiara', funScore: 5 },
  VU: { continent: 'Oceania', difficulty: 5, capital: 'Port Vila', funScore: 5 },
};

// ============================================================
// EXPLANATIONS & VISUAL DESCRIPTIONS
// Each country gets a genuinely interesting 1-2 sentence explanation
// and a 1-sentence visual description of its map shape.
// ============================================================
interface CountryContent {
  explanation: string;
  visualDescription: string;
}

const COUNTRY_CONTENT: Record<string, CountryContent> = {
  FR: {
    explanation: 'France is the world\'s most visited country, attracting over 90 million tourists annually, and its hexagonal shape has earned it the nickname "l\'Hexagone." It is the largest country in the European Union by area.',
    visualDescription: 'A roughly hexagonal country in Western Europe, touching both the Atlantic Ocean and the Mediterranean Sea.',
  },
  DE: {
    explanation: 'Germany is home to over 1,500 different types of beer and has more than 1,300 breweries — more than any other country. It was reunified in 1990 after 45 years of division into East and West.',
    visualDescription: 'A large, roughly rectangular country in Central Europe with a notch cut into its northeastern corner by Poland.',
  },
  GB: {
    explanation: 'The United Kingdom drove the Industrial Revolution in the 18th century, fundamentally reshaping how humanity produces goods. It also invented the World Wide Web, football (soccer), and the English language.',
    visualDescription: 'An archipelago off the northwestern coast of continental Europe, with a large main island and a smaller island shared with Ireland to the west.',
  },
  IT: {
    explanation: 'Italy is shaped like a boot kicking a ball — the ball being Sicily. It contains more UNESCO World Heritage Sites than any other country and invented pizza, pasta, and the modern banking system.',
    visualDescription: 'A distinctive boot-shaped peninsula extending into the Mediterranean Sea, with the large islands of Sicily and Sardinia to the south and west.',
  },
  ES: {
    explanation: 'Spain is home to La Tomatina, an annual festival where participants throw 150,000 tomatoes at each other. It also contains Europe\'s oldest restaurant, Sobrino de Botín in Madrid, open since 1725.',
    visualDescription: 'A large Iberian Peninsula country in southwestern Europe, sharing the peninsula with Portugal and featuring the Pyrenees mountain range along its northern border.',
  },
  RU: {
    explanation: 'Russia is the world\'s largest country by area, spanning 11 time zones — from the Baltic Sea to the Pacific Ocean. Lake Baikal in Siberia holds 20% of the world\'s unfrozen fresh water.',
    visualDescription: 'An enormous country spanning the entire northern portion of Asia and the eastern edge of Europe, with a recognizable hump of territory in Europe west of the Ural Mountains.',
  },
  CN: {
    explanation: 'China has the world\'s oldest continuous civilization, with written records dating back over 3,500 years. It invented paper, gunpowder, printing, and the compass — four technologies that transformed the world.',
    visualDescription: 'A vast country occupying eastern Asia, roughly rooster-shaped with a large coastal region and interior that tapers westward toward mountain ranges.',
  },
  JP: {
    explanation: 'Japan is an archipelago of 6,852 islands, though only 430 are inhabited. Mount Fuji is a nearly perfectly symmetrical active volcano, last erupting in 1707, and is visible from Tokyo on clear days.',
    visualDescription: 'A curved chain of four main islands off the eastern coast of Asia, arcing from northeast to southwest in the Pacific Ocean.',
  },
  IN: {
    explanation: 'India has the world\'s largest democracy, with over 900 million eligible voters. The country invented chess, the decimal system, and the concept of zero as a mathematical placeholder.',
    visualDescription: 'A large triangular subcontinent jutting southward into the Indian Ocean, flanked by the Arabian Sea to the west and the Bay of Bengal to the east.',
  },
  US: {
    explanation: 'The United States has the world\'s largest economy and is home to Silicon Valley, the global center of technology innovation. Alaska, the largest US state, is separated from the contiguous 48 states by Canada.',
    visualDescription: 'A large rectangular country occupying the central portion of North America, with Alaska to the northwest and Hawaii in the Pacific not shown at this scale.',
  },
  CA: {
    explanation: 'Canada is the second-largest country in the world by total area but has a smaller population than the state of California. It has more lakes than all other countries combined.',
    visualDescription: 'The northern half of North America, with a very long coastline, the Great Lakes visible in the southeast, and a jagged northern archipelago.',
  },
  BR: {
    explanation: 'Brazil contains approximately 60% of the Amazon rainforest, the planet\'s largest tropical forest. It is the only Portuguese-speaking country in South America and has won the FIFA World Cup five times.',
    visualDescription: 'The largest country in South America, occupying its eastern and central portion with a distinctive bulge on its northeastern coast jutting into the Atlantic.',
  },
  AU: {
    explanation: 'Australia is the world\'s largest island and smallest continent. Over 80% of its flora and fauna are found nowhere else on Earth, including kangaroos, koalas, and the platypus — a mammal that lays eggs.',
    visualDescription: 'An island continent in the Southern Hemisphere between the Indian and Pacific Oceans, with a distinctive rectangular interior and a large gulf on its northern coast.',
  },
  AR: {
    explanation: 'Argentina has the second-largest economy in South America and is famous for producing Pope Francis, Ernesto Che Guevara, and both Lionel Messi and Diego Maradona. Patagonia in the south is one of the world\'s most dramatic wilderness regions.',
    visualDescription: 'A long, narrow country forming the southern cone of South America, tapering dramatically to Cape Horn at the very tip of the continent.',
  },
  MX: {
    explanation: 'Mexico is the birthplace of chocolate — the Aztecs consumed "xocolatl" as a bitter drink centuries before Europeans arrived. It also contains the world\'s largest pyramid by volume: the Great Pyramid of Cholula.',
    visualDescription: 'A country with a wide northern border with the USA that narrows dramatically into the Central American isthmus, with the distinctive Yucatán Peninsula pointing northward into the Gulf of Mexico.',
  },
  KR: {
    explanation: 'South Korea transformed from one of the world\'s poorest countries in the 1950s to the 12th largest economy in just 60 years — an economic miracle dubbed the "Miracle on the Han River." It has the world\'s fastest average internet speed.',
    visualDescription: 'A peninsula extending southward from northeastern China, sharing a border with North Korea along a distinctive straight demilitarized zone.',
  },
  EG: {
    explanation: 'Egypt\'s pyramids at Giza are the only surviving wonder of the ancient world, built over 4,500 years ago. The Nile River, which flows through Egypt, is the world\'s longest river, stretching over 6,650 km.',
    visualDescription: 'A mostly square country in northeastern Africa, with the Sinai Peninsula forming a distinctive triangular extension into Asia east of the Suez Canal.',
  },
  TR: {
    explanation: 'Turkey straddles two continents — a small portion in Europe (Thrace) and the vast majority in Asia (Anatolia). Istanbul is the world\'s only city spanning two continents, with the Bosphorus strait running through its center.',
    visualDescription: 'A wide, roughly rectangular country bridging Europe and Asia Minor, with a narrow European portion separated from its large Asian bulk by the Bosphorus.',
  },
  PL: {
    explanation: 'Poland has rebuilt itself three times: after being erased from maps for 123 years (1795–1918), again after World War II, and after communist rule. Warsaw\'s Old Town was painstakingly reconstructed after being 85% destroyed in WWII.',
    visualDescription: 'A roughly rectangular country in central Eastern Europe, sandwiched between Germany to the west and Belarus and Ukraine to the east.',
  },
  TH: {
    explanation: 'Thailand is the only country in Southeast Asia that was never colonized by a European power. Its name means "Land of the Free," and it has over 40,000 Buddhist temples, more than any other country.',
    visualDescription: 'A country shaped like the head and trunk of an elephant, with a large northern and central mass and a long thin peninsula extending southward into the Malay Peninsula.',
  },
  ZA: {
    explanation: 'South Africa has three capital cities: Pretoria (executive), Cape Town (legislative), and Bloemfontein (judicial). It is the only country that has voluntarily dismantled its nuclear weapons program.',
    visualDescription: 'The southernmost country on the African continent, with a distinctive pointed shape and the isolated enclave of Lesotho entirely contained within its borders.',
  },
  NG: {
    explanation: 'Nigeria has the largest economy and population in Africa, with over 210 million people and more than 500 distinct languages. "Nollywood," Nigeria\'s film industry, is the world\'s second-largest by output after India.',
    visualDescription: 'A large country on the western coast of Africa, roughly square in shape with the Gulf of Guinea to its south.',
  },
  GR: {
    explanation: 'Greece has more archaeological museums than any other country, and its ancient Athens is the birthplace of democracy, philosophy, the Olympics, and Western theater. About 20% of Greek territory consists of islands.',
    visualDescription: 'A country in southeastern Europe with a jagged, fragmented coastline, a prominent central peninsula (the Peloponnese), and hundreds of islands scattered across the Aegean Sea.',
  },
  PT: {
    explanation: 'Portugal started the Age of Exploration in the 15th century, mapping the African coast, Brazil, India, and Japan before any other European nation. It holds the title of the world\'s oldest country with unchanged borders, established in 1143.',
    visualDescription: 'A narrow strip of land along the southwestern edge of the Iberian Peninsula, bordered by Spain on the north and east and the Atlantic Ocean to the west and south.',
  },
  NL: {
    explanation: 'The Netherlands has reclaimed nearly 17% of its land from the sea using an elaborate system of dikes, pumps, and polders — making it a global leader in water management engineering. A quarter of the country lies below sea level.',
    visualDescription: 'A small, low-lying country at the mouth of the Rhine and Meuse rivers in northwestern Europe, with a coastline on the North Sea.',
  },
  SE: {
    explanation: 'Sweden invented dynamite (Alfred Nobel), the adjustable wrench, the three-point seatbelt, and Minecraft. It also has the highest per-capita consumption of coffee in the world.',
    visualDescription: 'A long, narrow country forming the eastern half of the Scandinavian Peninsula, running from the Arctic north to the Baltic Sea in the south.',
  },
  NO: {
    explanation: 'Norway\'s coastline, including its famous fjords, is so jagged that if straightened it would stretch halfway around the Earth. The country has the highest human development index score and sovereign wealth fund of any nation.',
    visualDescription: 'The western half of the Scandinavian Peninsula with a dramatically indented western coastline and a long tail extending north into the Arctic.',
  },
  CH: {
    explanation: 'Switzerland has been at peace since 1815 — the longest period of neutrality of any country. The Large Hadron Collider, the most powerful particle accelerator ever built, sits beneath the Swiss-French border near Geneva.',
    visualDescription: 'A landlocked country in the heart of the Alps in central Europe, roughly rectangular with a distinctive notch cut into its southwestern edge.',
  },
  BE: {
    explanation: 'Belgium has the world\'s most complicated government — a federal state divided into linguistic communities that has occasionally gone over a year without a formal government after elections. It invented the French fry.',
    visualDescription: 'A small country in Northwestern Europe at the mouth of the Rhine delta, sandwiched between the Netherlands, Germany, Luxembourg, and France.',
  },
  AT: {
    explanation: 'Austria is the birthplace of Mozart, Beethoven (by adoption), Freud, Wittgenstein, and Hitler — making it one of the most historically consequential small countries in European history. Two-thirds of its territory is covered by the Alps.',
    visualDescription: 'A landlocked Alpine country in Central Europe, roughly elongated east-west with a narrow eastern portion that forms the Vienna basin.',
  },
  HU: {
    explanation: 'Hungary has the largest thermal lake in the world, Lake Hévíz, and more natural hot springs per capita than any other country. Hungarian is famous for being one of the most difficult European languages to learn, with 18 grammatical cases.',
    visualDescription: 'A landlocked country in Central Europe, roughly shaped like a rounded rectangle sitting in the middle of the Carpathian Basin, surrounded by mountains on all sides.',
  },
  CZ: {
    explanation: 'Czechia (Czech Republic) has the highest beer consumption per capita in the world — averaging 188 liters per person per year. Prague\'s Old Town astronomical clock, the Orloj, has been running continuously since 1410.',
    visualDescription: 'A landlocked country in Central Europe with an elongated western portion (Bohemia) shaped like a diamond and a narrower eastern portion (Moravia) pointing toward Slovakia.',
  },
  PL_BONUS: {
    explanation: '',
    visualDescription: '',
  },
  SA: {
    explanation: 'Saudi Arabia sits atop 18% of the world\'s proven oil reserves, making it the largest oil exporter on Earth. The Empty Quarter (Rub\' al Khali) in its southern interior is the world\'s largest continuous sand desert.',
    visualDescription: 'A large quadrilateral country occupying most of the Arabian Peninsula, with a distinctive rectangular shape and no permanent rivers.',
  },
  IR: {
    explanation: 'Iran (Persia) has one of the world\'s oldest continuous civilizations, dating back over 7,000 years. It has the world\'s largest carpet industry, and Persian carpets are literally woven history — some containing hundreds of knots per square centimeter.',
    visualDescription: 'A large country in the Middle East shaped like a rough rhombus, bordered by the Caspian Sea to the north and the Persian Gulf and Gulf of Oman to the south.',
  },
  IQ: {
    explanation: 'Iraq is the site of ancient Mesopotamia — "the land between the rivers" — where the first cities, writing, and legal codes were invented over 5,000 years ago. The Tigris and Euphrates rivers still flow through it.',
    visualDescription: 'A country in the Middle East with a distinctive triangular shape narrowing toward the Persian Gulf in the south, with Iraq\'s only coastline being a small strip near Basra.',
  },
  AF: {
    explanation: 'Afghanistan is one of the world\'s most ethnically diverse countries, with over 50 distinct ethnic groups speaking more than 30 languages. The Wakhan Corridor, a narrow panhandle in the northeast, was deliberately created as a buffer between British India and Tsarist Russia.',
    visualDescription: 'A landlocked country in South/Central Asia with a roughly rectangular shape and a narrow panhandle extending northeast between Tajikistan and Pakistan.',
  },
  PK: {
    explanation: 'Pakistan has the world\'s second-largest salt mine (Khewra), which has been mined for over 800 years. The country is also home to K2, the world\'s second-highest mountain, and five of the world\'s fourteen "eight-thousander" peaks.',
    visualDescription: 'A large country in South Asia with a wide northern mountain region tapering to a southeastern plains area that meets the Arabian Sea.',
  },
  KZ: {
    explanation: 'Kazakhstan is the world\'s largest landlocked country — if it were a country-sized object placed in the ocean, it would be larger than Western Europe. The Baikonur Cosmodrome in Kazakhstan was the launch site of the first satellite (Sputnik) and first human in space (Yuri Gagarin).',
    visualDescription: 'A vast steppe country in Central Asia with a distinctive elongated shape, wider in the west and tapering eastward, with the Caspian Sea forming its western border.',
  },
  MN: {
    explanation: 'Mongolia has the lowest population density of any sovereign country, with roughly 2 people per square kilometer across a territory larger than Western Europe. Genghis Khan\'s Mongol Empire was the largest contiguous land empire in history.',
    visualDescription: 'A large landlocked country sandwiched between Russia to the north and China to the south, with a distinctive rectangular shape and the Gobi Desert in its southern portion.',
  },
  VN: {
    explanation: 'Vietnam\'s coastline is over 3,200 km long — longer than the distance from Paris to Moscow. Ha Long Bay in the north features over 1,900 limestone islands and islets that emerge from the sea like dragon\'s teeth.',
    visualDescription: 'A long, thin S-shaped country along the eastern coast of the Indochina Peninsula, widening in the north and south with a very narrow central waist.',
  },
  TH: {
    explanation: 'Thailand is the only country in Southeast Asia that was never colonized by a European power. Its name means "Land of the Free," and it has over 40,000 Buddhist temples, more than any other country.',
    visualDescription: 'A country shaped like the head and trunk of an elephant, with a large northern and central mass and a long thin peninsula extending southward toward Malaysia.',
  },
  MY: {
    explanation: 'Malaysia contains the world\'s oldest rainforest — roughly 130 million years old, predating the Amazon by 70 million years. The Petronas Twin Towers in Kuala Lumpur held the title of world\'s tallest buildings for 6 years.',
    visualDescription: 'A country split into two non-contiguous parts: a peninsular portion extending south from Thailand, and a larger portion on the northern coast of the island of Borneo.',
  },
  ID: {
    explanation: 'Indonesia is the world\'s largest archipelago nation, consisting of over 17,000 islands with around 6,000 inhabited. It has more active volcanoes than any other country and sits on the "Ring of Fire" where four tectonic plates meet.',
    visualDescription: 'An enormous archipelago stretching over 5,000 km from west to east across Southeast Asia, with the large islands of Sumatra, Java, and Borneo (shared) clearly visible.',
  },
  PH: {
    explanation: 'The Philippines is the only country in Asia with a predominantly Christian population (over 90% Catholic), a legacy of 333 years of Spanish colonization. It has the world\'s longest Christmas season — starting in September.',
    visualDescription: 'An archipelago of over 7,000 islands in Southeast Asia, with the large northern island of Luzon and the southern island of Mindanao as the most prominent landmasses.',
  },
  MM: {
    explanation: 'Myanmar contains over 5,000 Buddhist temples, pagodas, and monasteries in Bagan alone — more than anywhere else on Earth. The country is home to the world\'s rarest ruby, the "Burmese ruby," prized for its deep pigeon-blood red color.',
    visualDescription: 'A country in mainland Southeast Asia with a wide northern region that narrows into a long tail (the Tenasserim coast) extending southward along the Malay Peninsula.',
  },
  KH: {
    explanation: 'Cambodia\'s Angkor Wat is the world\'s largest religious monument, built in the 12th century. At its peak, the Khmer Empire\'s capital Angkor may have been the world\'s largest pre-industrial city, with a population of up to 1 million.',
    visualDescription: 'A roughly square country in mainland Southeast Asia, with the large Tonlé Sap lake visible in its center and the Mekong River running through its eastern portion.',
  },
  LA: {
    explanation: 'Laos is the most bombed country in history per capita — the US dropped more bombs on Laos during the Vietnam War than were used in all of World War II combined. It is also Southeast Asia\'s only landlocked country.',
    visualDescription: 'A narrow, landlocked country in the center of the Indochina Peninsula, squeezed between Thailand, Vietnam, China, Myanmar, and Cambodia.',
  },
  BD: {
    explanation: 'Bangladesh is one of the world\'s most densely populated countries, with 170 million people in an area slightly smaller than Iowa. The Sundarbans mangrove forest, shared with India, is home to the largest tiger population in the world.',
    visualDescription: 'A small, densely populated country almost entirely surrounded by India, with a short coastline on the Bay of Bengal in its south.',
  },
  NP: {
    explanation: 'Nepal contains eight of the world\'s ten highest mountains, including Mount Everest. The Gurkha soldiers from Nepal are legendary warriors who have served in the British Army for over 200 years.',
    visualDescription: 'A narrow, rectangular landlocked country sandwiched between China (Tibet) to the north and India to the south and east, running east-west.',
  },
  BT: {
    explanation: 'Bhutan is the only country in the world that measures prosperity by "Gross National Happiness" instead of GDP. It was the last country in the world to introduce television and the internet, only doing so in 1999.',
    visualDescription: 'A tiny landlocked kingdom in the eastern Himalayas, nestled between China (Tibet) to the north and India to the south, east, and west.',
  },
  LK: {
    explanation: 'Sri Lanka is shaped like a teardrop hanging below the tip of India — a fact that has inspired its poetic nickname "Teardrop of India." It is the world\'s largest exporter of Ceylon tea, which grows in its central highlands.',
    visualDescription: 'A teardrop-shaped island off the southeastern tip of India, separated from the Indian mainland by the shallow Palk Strait.',
  },
  TW: {
    explanation: 'Taiwan is home to one of the world\'s tallest buildings, Taipei 101, which was designed to withstand the typhoons that regularly batter the island. It produces a significant portion of the world\'s semiconductors.',
    visualDescription: 'A leaf-shaped island off the southeastern coast of China, oriented roughly north-south in the Pacific Ocean.',
  },
  'CN-TW': {
    explanation: 'Taiwan is home to one of the world\'s tallest buildings, Taipei 101, which was designed to withstand the typhoons that regularly batter the island. It produces a significant portion of the world\'s semiconductors.',
    visualDescription: 'A leaf-shaped island off the southeastern coast of China, oriented roughly north-south in the Pacific Ocean.',
  },
  KP: {
    explanation: 'North Korea is one of the world\'s most isolated countries, with limited contact with the outside world. Its capital Pyongyang features some of the world\'s most dramatic monumental architecture, including the 105-story Ryugyong Hotel which has been under construction since 1987.',
    visualDescription: 'The northern half of the Korean Peninsula, bordered by China and Russia to the north and South Korea to the south along the heavily fortified DMZ.',
  },
  GE: {
    explanation: 'Georgia claims to be the birthplace of winemaking, with wine production dating back over 8,000 years using clay vessels called qvevri buried underground. The country\'s ancient script, mkhedruli, is one of the world\'s most distinctive writing systems.',
    visualDescription: 'A small country in the South Caucasus, sandwiched between Russia to the north, Turkey and Armenia to the south, and Azerbaijan to the east, with a Black Sea coast to the west.',
  },
  AM: {
    explanation: 'Armenia was the first country in the world to adopt Christianity as its state religion, in 301 AD — 12 years before the Roman Empire. It has one of the world\'s oldest cathedrals, Etchmiadzin, built in 303 AD.',
    visualDescription: 'A small landlocked country in the South Caucasus, bordered by Turkey, Georgia, Azerbaijan, and Iran.',
  },
  AZ: {
    explanation: 'Azerbaijan is known as "The Land of Fire" because of its natural gas seeps that have burned for centuries, inspiring the ancient Zoroastrian fire temples. It also has the world\'s first oil well, drilled commercially in Baku in 1846.',
    visualDescription: 'A country in the South Caucasus with a Caspian Sea coastline to the east and a detached exclave (Nakhchivan) separated from the main territory by Armenia.',
  },
  KW: {
    explanation: 'Kuwait was the wealthiest country in the world per capita in the 1970s, thanks to its enormous oil reserves. Despite being a small country, it holds approximately 9% of the world\'s proven oil reserves.',
    visualDescription: 'A tiny country at the northwestern tip of the Persian Gulf, wedged between Iraq and Saudi Arabia.',
  },
  QA: {
    explanation: 'Qatar has the world\'s highest GDP per capita, driven by enormous natural gas reserves in the North Dome field — the world\'s largest single natural gas reservoir. It hosted the 2022 FIFA World Cup, the first in a Middle Eastern country.',
    visualDescription: 'A small peninsula protruding northward into the Persian Gulf from the Arabian Peninsula, bordering only Saudi Arabia.',
  },
  AE: {
    explanation: 'The UAE has transformed its largest city, Dubai, from a small fishing village in the 1960s to a global metropolis with the world\'s tallest building (Burj Khalifa) in just 60 years. It also has the highest road density in the world.',
    visualDescription: 'A small country on the southeastern corner of the Arabian Peninsula, with a coast on both the Persian Gulf and the Gulf of Oman.',
  },
  OM: {
    explanation: 'Oman has been ruled continuously by the Al Said dynasty since 1744, making it one of the world\'s oldest continuous monarchies. Its Wahiba Sands desert contains dunes up to 100 meters high and is home to an extraordinary diversity of life.',
    visualDescription: 'A country in the southeastern corner of the Arabian Peninsula, with a coastline on the Gulf of Oman and Arabian Sea, and a small detached territory (Musandam) at the Strait of Hormuz.',
  },
  IL: {
    explanation: 'Israel has the highest number of museums per capita of any country in the world and more Nobel Prize laureates per capita than any other country. The Dead Sea on its eastern border is the lowest point on Earth\'s surface at 430 meters below sea level.',
    visualDescription: 'A small, roughly diamond-shaped country on the eastern Mediterranean coast, with a short coastline and the Gaza Strip as a detached territory on the southwest.',
  },
  LB: {
    explanation: 'Lebanon\'s Cedars of God forest contains some of the world\'s oldest trees, up to 3,000 years old — and the cedar is so iconic it appears on the national flag. Despite its small size, Lebanon has produced some of the world\'s most successful diaspora communities.',
    visualDescription: 'A tiny country on the eastern Mediterranean coast, sandwiched between Syria to the north and east, and Israel to the south.',
  },
  SY: {
    explanation: 'Syria contains some of the world\'s oldest continuously inhabited cities — Damascus has been settled for over 11,000 years, making it the oldest continuously inhabited capital city on Earth. Aleppo\'s ancient bazaar is one of the longest covered markets in the world.',
    visualDescription: 'A country in the Levant region of the Middle East, bordering Turkey, Iraq, Jordan, Israel, and Lebanon, with a Mediterranean coast in the northwest.',
  },
  JO: {
    explanation: 'Jordan\'s Petra, carved directly into rose-red sandstone cliffs by the Nabataean people around 300 BC, is one of the ancient world\'s most spectacular cities. The country also contains the Dead Sea and some of the best-preserved crusader castles in the world.',
    visualDescription: 'A landlocked country in the heart of the Middle East, bordered by Saudi Arabia, Iraq, Syria, Israel, and the Palestinian territories, with a small coastline on the Red Sea at Aqaba.',
  },
  YE: {
    explanation: 'Yemen is home to the Socotra archipelago, nicknamed the "Galápagos of the Indian Ocean" — up to a third of its plant life exists nowhere else on Earth, including the otherworldly Dragon Blood Tree with its distinctive umbrella-shaped canopy.',
    visualDescription: 'A country occupying the southwestern corner of the Arabian Peninsula, with coastlines on both the Red Sea and the Gulf of Aden, and a chain of islands including Socotra.',
  },
  PS: {
    explanation: 'The Palestinian territories consist of two non-contiguous areas: the West Bank on the Jordan River and the Gaza Strip on the Mediterranean coast. Jericho, in the West Bank, is considered the world\'s oldest city, continuously inhabited for over 10,000 years.',
    visualDescription: 'Two non-contiguous territories: the larger West Bank east of Israel along the Jordan River, and the small coastal Gaza Strip in the southwest.',
  },
  TJ: {
    explanation: 'Tajikistan is over 90% mountainous, with peaks in the Pamir range reaching over 7,000 meters. The country is home to the world\'s second-largest glacier outside the polar regions, the Fedchenko Glacier.',
    visualDescription: 'A mountainous landlocked country in Central Asia, narrow and roughly parallelogram-shaped, with a distinctive finger of territory pointing east into China\'s Xinjiang region.',
  },
  KG: {
    explanation: 'Kyrgyzstan\'s nomadic culture is so deeply ingrained that the yurt (portable felt dwelling) is featured on its national flag. Lake Issyk-Kul is one of the world\'s largest alpine lakes and never freezes despite being at 1,600 meters elevation.',
    visualDescription: 'A mountainous landlocked country in Central Asia, roughly rectangular with the Tian Shan range running through its center, bordering Kazakhstan, China, Tajikistan, and Uzbekistan.',
  },
  TM: {
    explanation: 'Turkmenistan\'s "Door to Hell" (Darvaza Gas Crater) is a burning natural gas crater that has been continuously on fire since Soviet engineers set it alight in 1971, hoping to burn off the gas in days — it is still burning. The country has one of the world\'s largest natural gas reserves.',
    visualDescription: 'A large country in Central Asia with a distinctive triangular shape, bordered by the Caspian Sea to the west and Afghanistan and Iran to the south.',
  },
  UZ: {
    explanation: 'Uzbekistan\'s ancient Silk Road cities of Samarkand and Bukhara contain some of the most magnificent Islamic architecture in the world, built during the Timurid dynasty in the 14th-15th centuries. The Aral Sea, once one of the world\'s largest lakes, has largely evaporated due to Soviet irrigation projects.',
    visualDescription: 'A doubly-landlocked country in Central Asia, bordered by Kazakhstan, Kyrgyzstan, Tajikistan, Afghanistan, and Turkmenistan.',
  },
  MA: {
    explanation: 'Morocco contains the world\'s oldest university still in continuous operation, the University of al-Qarawiyyin in Fez, founded in 859 AD. The Sahara Desert covers Morocco\'s entire southeastern interior, yet snow falls on the Atlas Mountains every winter.',
    visualDescription: 'The northwestern corner of Africa, bordering the Atlantic Ocean to the west and Mediterranean Sea to the north, with the Atlas Mountains visible in the center and the Sahara extending in the south.',
  },
  DZ: {
    explanation: 'Algeria is the largest country in Africa and the Arab world by area. The Sahara Desert covers over 85% of its territory, and beneath it lie some of the world\'s largest natural gas reserves.',
    visualDescription: 'The largest country in Africa, with a Mediterranean coastal strip in the north and an enormous expanse of Sahara Desert dominating the south.',
  },
  TN: {
    explanation: 'Tunisia is the birthplace of the Arab Spring — the 2010 Jasmine Revolution sparked a wave of uprisings across the Arab world. Ancient Carthage, near modern Tunis, was once the most powerful city in the Mediterranean.',
    visualDescription: 'A small country in northern Africa with a Mediterranean coastline, bordered by Algeria to the west and Libya to the south, with a distinctive northward-pointing cap.',
  },
  LY: {
    explanation: 'Libya contains some of the world\'s best-preserved ancient Roman ruins, including the city of Leptis Magna — birthplace of Emperor Septimius Severus — which rivals Pompeii in scale and preservation. About 90% of the country is desert.',
    visualDescription: 'A large country across northern Africa between Tunisia and Egypt, dominated by the Sahara Desert, with a Mediterranean coastline and a distinctive rectangular shape.',
  },
  ET: {
    explanation: 'Ethiopia is the only African country that was never colonized by a European power (Italy\'s brief occupation 1936-1941 is not counted as colonization). It is also the location where archaeologists found Lucy, one of the oldest known hominid fossils at 3.2 million years old.',
    visualDescription: 'A large, roughly pentagonal country in the Horn of Africa, landlocked between Eritrea, Djibouti, Somalia, Kenya, South Sudan, and Sudan.',
  },
  ER: {
    explanation: 'Eritrea only became an independent country in 1993, making it one of the world\'s newest nations. Its capital Asmara is nicknamed "La Piccola Roma" (Little Rome) for its well-preserved Italian colonial architecture and is a UNESCO World Heritage Site.',
    visualDescription: 'A narrow strip of land along the Red Sea coast in the Horn of Africa, bordering Sudan to the west and Ethiopia and Djibouti to the south.',
  },
  SO: {
    explanation: 'Somalia has the longest coastline of any country in mainland Africa — over 3,300 km of Indian Ocean coastline. The ancient Land of Punt, a major trading partner of ancient Egypt, is believed to have been located in what is now Somalia.',
    visualDescription: 'The easternmost tip of Africa in the Horn of Africa, with a distinctive right-angle shape formed by its Indian Ocean coastline and the Gulf of Aden.',
  },
  KE: {
    explanation: 'Kenya is home to the Maasai Mara, which hosts the world\'s largest animal migration — over 1.5 million wildebeest crossing from the Serengeti every year. The country also holds the world record for the fastest marathon time, run by Eliud Kipchoge.',
    visualDescription: 'A roughly square country straddling the equator in East Africa, with a coastline on the Indian Ocean and Lake Victoria in its southwestern corner.',
  },
  TZ: {
    explanation: 'Tanzania contains Africa\'s highest peak (Mount Kilimanjaro at 5,895 m), its largest lake (Lake Victoria), and its deepest lake (Lake Tanganyika). The Serengeti National Park is home to more large mammals than anywhere else on Earth.',
    visualDescription: 'A large country in East Africa with an Indian Ocean coastline and the large island of Zanzibar visible offshore. Lake Victoria forms its northwestern corner.',
  },
  UG: {
    explanation: 'Uganda is one of the few remaining habitats of the mountain gorilla, with Bwindi Impenetrable National Park home to half of the world\'s population. Lake Victoria, the world\'s second-largest freshwater lake, borders Uganda to the south.',
    visualDescription: 'A landlocked country in East Africa, roughly square, containing a large portion of Lake Victoria in its south and bordered by Kenya, Tanzania, Rwanda, DRC, and South Sudan.',
  },
  RW: {
    explanation: 'Rwanda is nicknamed the "Land of a Thousand Hills" — its capital Kigali sits at 1,567 meters elevation, and the entire country is a mosaic of terraced hillsides. It has transformed dramatically from the 1994 genocide to one of Africa\'s fastest-growing economies.',
    visualDescription: 'One of Africa\'s smallest countries, landlocked in the Great Lakes region, with a very hilly terrain visible in its varied borders, sandwiched between Uganda, Tanzania, Burundi, and DRC.',
  },
  BI: {
    explanation: 'Burundi is one of the world\'s five poorest countries by GDP per capita. It contains the headwaters of the Nile River — the southernmost source of the world\'s longest river flows from the Ruvyironza River in Burundi.',
    visualDescription: 'A tiny landlocked country in the African Great Lakes region, south of Rwanda, with Lake Tanganyika forming its western border.',
  },
  SS: {
    explanation: 'South Sudan is the world\'s newest country, having gained independence from Sudan in 2011. It contains one of the world\'s largest wildlife migrations — the white-eared kob migration in the Sudd, the world\'s largest freshwater wetland.',
    visualDescription: 'A landlocked country in northeastern Central Africa, bordered by Sudan to the north, Ethiopia, Kenya, Uganda, DRC, and Central African Republic.',
  },
  SD: {
    explanation: 'Sudan has more ancient pyramids than Egypt — over 200 Nubian pyramids built by the ancient kingdoms of Kush and Meroe, compared to Egypt\'s 138. The Nile River runs through the entire length of the country.',
    visualDescription: 'The third-largest country in Africa, occupying the northeastern portion of the continent with the Nile running through its center, south of Egypt and east of Libya and Chad.',
  },
  AO: {
    explanation: 'Angola is Africa\'s second-largest oil producer and contains the spectacular Kalandula Falls — one of Africa\'s largest waterfalls by volume. The country\'s oil boom funded a construction frenzy that built what was briefly called "Africa\'s most modern city."',
    visualDescription: 'A large country on the southwestern coast of Africa, with a distinctive rectangular main territory and a small detached exclave (Cabinda) north of the Congo River.',
  },
  CD: {
    explanation: 'The Democratic Republic of the Congo contains the Congo River — the world\'s deepest river at over 220 meters and the second-largest by water flow. The Congo Basin rainforest is the world\'s second-largest tropical forest after the Amazon.',
    visualDescription: 'The second-largest country in Africa, occupying central Africa with the Congo River basin visible as a massive central depression, with a small Atlantic coastline in the southwest.',
  },
  CG: {
    explanation: 'The Republic of the Congo contains the Congo River\'s western bank across from its much larger neighbor. Its capital Brazzaville and the DRC\'s capital Kinshasa face each other across the river — the only place in the world where two national capitals are visible from each other.',
    visualDescription: 'A medium-sized country in Central Africa on the western bank of the Congo River, bordered by Gabon, Cameroon, Central African Republic, DRC, and Angola (Cabinda).',
  },
  GA: {
    explanation: 'Gabon has one of the world\'s highest percentages of protected land — approximately 11% of its territory is national park. Its forests contain more than 400 species of mammals and are a critical refuge for forest elephants and western lowland gorillas.',
    visualDescription: 'A country on the equatorial coast of Central Africa, roughly square, with an Atlantic Ocean coastline to the west.',
  },
  GQ: {
    explanation: 'Equatorial Guinea is the only Spanish-speaking country in Africa, a legacy of Spanish colonization. Despite its small size, it became one of Africa\'s largest oil producers in the 1990s, creating enormous wealth concentrated among a tiny elite.',
    visualDescription: 'A tiny country on the Gulf of Guinea in Central Africa, consisting of a small mainland territory (Río Muni) and the island of Bioko where the capital Malabo is located.',
  },
  CF: {
    explanation: 'The Central African Republic is one of the world\'s most biodiverse countries, yet also one of its poorest. Its Dzanga-Sangha reserve is home to the world\'s highest concentration of forest elephants and western lowland gorillas.',
    visualDescription: 'A landlocked country in the center of Africa, roughly pentagonal in shape, surrounded by Chad, Sudan, South Sudan, DRC, Republic of Congo, and Cameroon.',
  },
  CM: {
    explanation: 'Cameroon is nicknamed "Africa in Miniature" because it contains virtually every ecosystem found across the continent — from equatorial rainforest in the south to Saharan desert in the north. It is one of the most linguistically diverse countries in the world, with over 270 languages.',
    visualDescription: 'A triangular country on the Gulf of Guinea in Central Africa, with a wide coastal region that narrows into a thin northern strip bordering Lake Chad.',
  },
  TD: {
    explanation: 'Chad contains Lake Chad — once one of Africa\'s largest lakes but now a fraction of its former size due to climate change and agricultural water use, a stark example of an environmental crisis. The Tibesti Mountains in the north contain some of the Sahara\'s highest peaks.',
    visualDescription: 'A large landlocked country in north-central Africa, roughly rectangular, dominated by the Sahara Desert in the north and a more fertile south.',
  },
  NE: {
    explanation: 'Niger is the world\'s largest landlocked country in terms of area and is home to the Air Mountains — a surprising green oasis in the Sahara where dinosaur fossils were discovered. It is consistently ranked among the world\'s least developed countries.',
    visualDescription: 'A very large landlocked country in West Africa, dominated by the Sahara in the north, with a distinctive notch cut into its southwest corner where the Niger River flows through.',
  },
  ML: {
    explanation: 'Mali\'s ancient city of Timbuktu was one of the world\'s great centers of Islamic scholarship in the 14th-16th centuries, with 25 mosques and 150 Quranic schools. It also sits atop one of the world\'s largest uranium deposits.',
    visualDescription: 'A large landlocked country in West Africa, narrowing from a wide southern region to a pointed north that extends into the Sahara.',
  },
  MR: {
    explanation: 'Mauritania is one of the last countries in the world where slavery was officially abolished (1981), though it was only criminalized in 2007. The "Eye of the Sahara" (Richat Structure) — a 50 km-wide circular geological formation — is visible from space.',
    visualDescription: 'A large country in northwestern Africa, mostly Sahara Desert, with an Atlantic coastline to the west and a narrow agricultural strip along the Senegal River in the south.',
  },
  SN: {
    explanation: 'Senegal\'s capital Dakar is located at the westernmost point of continental Africa. The country\'s wrestler-heroes (lutteurs) are as revered as football stars, and Senegalese wrestling is the country\'s national sport.',
    visualDescription: 'A country on the westernmost bulge of Africa, with an Atlantic coastline and the small country of Gambia forming a narrow enclave along the Gambia River within its territory.',
  },
  GM: {
    explanation: 'The Gambia is Africa\'s smallest mainland country, entirely surrounded by Senegal except for its Atlantic coastline. It is entirely defined by the Gambia River, which flows through its entire length.',
    visualDescription: 'A tiny strip of land along the Gambia River, entirely surrounded by Senegal, extending about 300 km inland from the Atlantic Ocean.',
  },
  GN: {
    explanation: 'Guinea contains one of the world\'s largest deposits of bauxite (the ore used to make aluminum), as well as significant iron ore, gold, and diamond reserves. The Fouta Djallon highlands are often called the "water tower of West Africa" because they feed the Niger, Senegal, and Gambia rivers.',
    visualDescription: 'A country on the Atlantic coast of West Africa, roughly triangular, with a distinctive westward-pointing coast and a mountainous interior.',
  },
  GW: {
    explanation: 'Guinea-Bissau has one of the world\'s smallest economies and experienced multiple coups since independence in 1974. Its Bijagós Archipelago — over 80 islands and islets — is home to saltwater hippos, a unique population that has adapted to a marine environment.',
    visualDescription: 'One of West Africa\'s smallest countries, with a heavily indented coastline including numerous islands, sandwiched between Senegal and Guinea.',
  },
  SL: {
    explanation: 'Sierra Leone was devastated by an 11-year civil war (1991-2002) fueled by the diamond trade — the origin of the term "blood diamonds." The country has since recovered and is famous for the remarkable Tacugama Chimpanzee Sanctuary.',
    visualDescription: 'A small country on the Atlantic coast of West Africa, roughly oval, bordered by Guinea and Liberia.',
  },
  LR: {
    explanation: 'Liberia was founded in 1822 as a settlement for freed American slaves — its capital Monrovia is named after US President James Monroe. It is one of only two countries in Africa (with Ethiopia) to never be colonized by a European power.',
    visualDescription: 'A small country on the Atlantic coast of West Africa, roughly square, bordered by Sierra Leone, Guinea, and Ivory Coast.',
  },
  CI: {
    explanation: 'Ivory Coast (Côte d\'Ivoire) is the world\'s largest cocoa producer, supplying about 40% of global cocoa — a key ingredient in most of the world\'s chocolate. Its economic capital Abidjan is often called the "Paris of West Africa."',
    visualDescription: 'A country on the southern coast of West Africa, roughly square, bordered by Liberia, Guinea, Mali, Burkina Faso, and Ghana.',
  },
  GH: {
    explanation: 'Ghana was the first sub-Saharan African country to gain independence from colonial rule (1957), and its leader Kwame Nkrumah became a hero of pan-African independence movements. The country is named after the ancient Ghana Empire, though it was located hundreds of miles to the northwest.',
    visualDescription: 'A roughly square country on the Gulf of Guinea in West Africa, bordered by Ivory Coast, Burkina Faso, and Togo.',
  },
  BF: {
    explanation: 'Burkina Faso means "Land of Incorruptible People" in the two main local languages. Its founder Thomas Sankara was one of Africa\'s most celebrated revolutionary leaders and is known as "Africa\'s Che Guevara."',
    visualDescription: 'A landlocked country in West Africa roughly shaped like a leaf, sandwiched between Mali, Niger, Benin, Togo, Ghana, and Ivory Coast.',
  },
  BJ: {
    explanation: 'Benin is the historical birthplace of Vodun (Voodoo), which was carried to Haiti and the Americas by enslaved people during the trans-Atlantic slave trade. The ancient Dahomey kingdom based here was famed for its elite female warrior corps, the Agojie ("Dahomey Amazons").',
    visualDescription: 'A small, narrow country on the Gulf of Guinea in West Africa, elongated north-south between Togo and Nigeria.',
  },
  TG: {
    explanation: 'Togo was home to the last person enslaved to arrive in the Americas — Cudjoe Lewis, transported on the Clotilda in 1860, 52 years after the US officially banned the slave trade. Togo is one of Africa\'s smallest countries.',
    visualDescription: 'A narrow strip of land in West Africa between Ghana and Benin, elongated north-south with a short Gulf of Guinea coastline.',
  },
  NG_DETAIL: {
    explanation: '',
    visualDescription: '',
  },
  ZW: {
    explanation: 'Zimbabwe\'s Victoria Falls — called "Mosi-oa-Tunya" (The Smoke that Thunders) by the local Tonga people — is the world\'s largest waterfall by combined width and height. At its peak, the falls generate a cloud of mist visible from 50 km away.',
    visualDescription: 'A landlocked country in southern Africa, roughly square, bordered by Zambia, Mozambique, South Africa, and Botswana.',
  },
  ZM: {
    explanation: 'Zambia contains the famous Victoria Falls on its border with Zimbabwe, and the country has the world\'s largest emerald deposits. Lake Kariba, on the Zambia-Zimbabwe border, is one of the world\'s largest man-made lakes.',
    visualDescription: 'A landlocked country in south-central Africa, roughly shaped like a butterfly with wings open, bordered by eight countries.',
  },
  MZ: {
    explanation: 'Mozambique\'s coast stretches for 2,500 km along the Indian Ocean — one of Africa\'s longest coastlines. The Bazaruto Archipelago protects the last viable dugong population in the western Indian Ocean.',
    visualDescription: 'A long, thin country along the southeastern coast of Africa, running north-south for over 2,500 km, with Mozambique Channel separating it from Madagascar.',
  },
  MG: {
    explanation: 'Madagascar split from the African continent about 165 million years ago and has been isolated so long that 90% of its wildlife is found nowhere else on Earth, including 100 species of lemur. It is sometimes called the "eighth continent."',
    visualDescription: 'A large island in the Indian Ocean off the southeastern coast of Africa, the world\'s fourth-largest island, elongated north-south.',
  },
  BW: {
    explanation: 'Botswana transformed from one of Africa\'s poorest countries at independence in 1966 to one of its most prosperous, thanks to diamond discoveries. The Okavango Delta — the world\'s largest inland delta — floods annually to create a spectacular inland oasis in the Kalahari Desert.',
    visualDescription: 'A landlocked country in southern Africa, roughly square, almost entirely surrounded by South Africa (south and east), Zimbabwe (northeast), Namibia (west), and Zambia (north).',
  },
  NA: {
    explanation: 'Namibia is the most sparsely populated country in Africa outside the Sahara, with only 3 people per square kilometer. The Namib Desert, from which the country takes its name, is the world\'s oldest desert at over 55 million years old.',
    visualDescription: 'A large country in southwestern Africa with an Atlantic coast and the distinctive Caprivi Strip (narrow panhandle) extending northeast.',
  },
  LS: {
    explanation: 'Lesotho is one of only three countries in the world completely surrounded by another country (along with Vatican City and San Marino) — it is an enclave entirely within South Africa. It is also the highest country in the world, with its lowest point at 1,400 meters above sea level.',
    visualDescription: 'A tiny highland kingdom completely surrounded by South Africa, shaped like a rough diamond, visible as an enclave in South Africa\'s interior.',
  },
  SZ: {
    explanation: 'eSwatini (formerly Swaziland) is one of Africa\'s last absolute monarchies — its king rules by decree. The country renamed itself from Swaziland to eSwatini in 2018 to avoid confusion with Switzerland.',
    visualDescription: 'A tiny landlocked country almost entirely surrounded by South Africa, with a short border with Mozambique to the east.',
  },
  DJ: {
    explanation: 'Djibouti is one of the world\'s most strategic locations — it sits at the entrance to the Red Sea and hosts military bases from France, the US, China, and Japan. Lake Assal, at 155 meters below sea level, is Africa\'s lowest point and the world\'s third-saltiest body of water.',
    visualDescription: 'A tiny country at the entrance to the Red Sea in the Horn of Africa, bordered by Eritrea, Ethiopia, and Somalia, with a short Gulf of Aden coastline.',
  },
  UA: {
    explanation: 'Ukraine is the largest country entirely within Europe and is called the "breadbasket of Europe" — it has some of the world\'s most fertile soil (chernozem) and supplies about 10% of the world\'s wheat. The Chernobyl exclusion zone has paradoxically become one of Europe\'s most remarkable wildlife sanctuaries.',
    visualDescription: 'A large country in Eastern Europe, roughly rectangular with the Crimean Peninsula (a distinctive oval) extending south into the Black Sea.',
  },
  BY: {
    explanation: 'Belarus is home to the world\'s largest population of European bison (wisent), brought back from extinction through careful breeding programs. The Białowieża Forest on its border with Poland is Europe\'s last primeval lowland forest.',
    visualDescription: 'A landlocked country in Eastern Europe, roughly rectangular, bordered by Russia, Ukraine, Poland, Lithuania, and Latvia.',
  },
  MD: {
    explanation: 'Moldova is the world\'s most wine-dependent country economically — wine exports make up a major portion of GDP. It also contains one of the world\'s largest underground wine cellars, Mileștii Mici, with 200 km of wine-filled tunnels.',
    visualDescription: 'A small landlocked country in Eastern Europe between Romania and Ukraine, shaped like a leaf.',
  },
  RO: {
    explanation: 'Romania is home to Europe\'s largest brown bear population and the continent\'s most intact ancient forests in the Carpathian Mountains. Bran Castle in Transylvania, associated with Bram Stoker\'s Dracula, draws millions of visitors annually.',
    visualDescription: 'A country in southeastern Europe with the Carpathian Mountains forming an arc through its center, the Danube Delta on its eastern coast, and the Black Sea to the east.',
  },
  BG: {
    explanation: 'Bulgaria is the oldest country in Europe to have kept its name unchanged since 681 AD. It also invented the Cyrillic alphabet — developed by Saints Cyril and Methodius from the Bulgarian medieval kingdom — now used by over 250 million people.',
    visualDescription: 'A country in southeastern Europe on the Black Sea coast, bordered by Romania (north), Serbia and North Macedonia (west), Greece and Turkey (south).',
  },
  HR: {
    explanation: 'Croatia\'s Dalmatian coast is considered one of the world\'s most beautiful, with over a thousand islands and islets. The country invented the necktie — the word "cravat" comes from "Croat," as Croatian soldiers wore distinctive neck scarves during the Thirty Years\' War.',
    visualDescription: 'A crescent-shaped country in southeastern Europe, with a long Dalmatian coastline and a distinctive boomerang shape that almost separates Bosnia and Herzegovina from the Adriatic Sea.',
  },
  SI: {
    explanation: 'Slovenia punches far above its weight in alpinism — per capita, it has produced more successful Mount Everest climbers than any other country. Lake Bled, with its island church and medieval castle, is one of Europe\'s most photographed landscapes.',
    visualDescription: 'A small country in Central Europe at the junction of the Alps, the Karst Plateau, and the Pannonian Plain, with a very short Adriatic coastline.',
  },
  SK: {
    explanation: 'Slovakia has more castles per capita than any other country in the world — over 180 castle ruins across a country the size of West Virginia. The Slovak language is sometimes called the "most Slavic" of all Slavic languages for preserving ancient features.',
    visualDescription: 'A landlocked country in Central Europe shaped roughly like a butterfly, elongated east-west, sandwiched between Czechia, Poland, Ukraine, Hungary, and Austria.',
  },
  RS: {
    explanation: 'Serbia is the birthplace of Nikola Tesla, one of history\'s greatest inventors, who pioneered AC electricity and made the modern electrical grid possible. The Iron Gates Gorge on the Danube River between Serbia and Romania contains Lepenski Vir, one of Europe\'s oldest settlements at 8,500 years old.',
    visualDescription: 'A landlocked country in the Balkans, roughly rectangular, with the Danube and Sava rivers forming its northern and western borders.',
  },
  BA: {
    explanation: 'Bosnia and Herzegovina has the only remaining medieval fortress-city in Europe: Mostar\'s Old Bridge (Stari Most), rebuilt in 2004 after destruction in the 1990s wars, is a UNESCO World Heritage Site. The country also has the largest burial site in the world from the 1995 Srebrenica genocide.',
    visualDescription: 'A roughly triangular country in the Western Balkans, sandwiched between Croatia (which wraps around three sides) and Serbia and Montenegro, with a very short Adriatic Sea coastline.',
  },
  MK: {
    explanation: 'North Macedonia (formerly simply called "Macedonia") was disputed by Greece for decades because of naming rights to the ancient Macedonian kingdom of Alexander the Great. Lake Ohrid, straddling its border with Albania, is one of Europe\'s oldest and deepest lakes.',
    visualDescription: 'A landlocked country in the southern Balkans, roughly rectangular, bordered by Serbia, Kosovo, Albania, Greece, and Bulgaria.',
  },
  ME: {
    explanation: 'Montenegro\'s name literally means "Black Mountain" in Italian and other languages, referring to the dark appearance of Mount Lovćen. Bay of Kotor — a winding fjord-like bay — is sometimes called "the southernmost fjord in Europe."',
    visualDescription: 'One of Europe\'s smallest countries, in the Western Balkans on the Adriatic Sea, roughly triangular, bordered by Croatia, Bosnia, Serbia, Kosovo, and Albania.',
  },
  XK: {
    explanation: 'Kosovo declared independence from Serbia in 2008 and is recognized by over 100 countries, though not by Serbia, Russia, or China. It is home to important Serbian Orthodox monasteries that are UNESCO World Heritage Sites — a source of ongoing political tension.',
    visualDescription: 'A small landlocked territory in the central Balkans, roughly oval, surrounded by Serbia, North Macedonia, Albania, and Montenegro.',
  },
  AL: {
    explanation: 'Albania was the world\'s most isolated country during the Cold War — its communist regime banned religion entirely from 1967, making it the world\'s first officially atheist state. The country now has over 700,000 bunkers built by its paranoid dictator Enver Hoxha.',
    visualDescription: 'A small country on the Adriatic and Ionian coasts of the Western Balkans, bordered by Montenegro, Kosovo, North Macedonia, and Greece.',
  },
  LT: {
    explanation: 'Lithuania was the last country in Europe to officially convert to Christianity, in 1387, and before that maintained the ancient Baltic pagan religion. At its medieval height, the Grand Duchy of Lithuania was the largest country in Europe, stretching from the Baltic to the Black Sea.',
    visualDescription: 'The southernmost and largest of the three Baltic states, on the eastern shore of the Baltic Sea, bordered by Latvia, Belarus, Poland, and Russia (Kaliningrad).',
  },
  LV: {
    explanation: 'Latvia has the world\'s highest density of ancient sacred forests still maintained as living cultural and spiritual sites. Riga\'s Art Nouveau district contains one of the world\'s highest concentrations of Art Nouveau architecture.',
    visualDescription: 'The middle Baltic state, with a coast on the Baltic Sea and Gulf of Riga, bordered by Estonia, Russia, Belarus, and Lithuania.',
  },
  EE: {
    explanation: 'Estonia was the first country in the world to declare internet access a human right (2000) and to offer online voting in elections (2005). The country\'s digital society is so advanced it is known as "e-Estonia."',
    visualDescription: 'The northernmost Baltic state, with a heavily indented northern coastline on the Baltic Sea and Gulf of Finland, bordered by Russia and Latvia.',
  },
  FI: {
    explanation: 'Finland has been ranked the world\'s happiest country for multiple consecutive years. It is home to nearly 200,000 lakes — more lakes per square kilometer than any other country — and the tradition of sauna bathing originated here.',
    visualDescription: 'A country in northern Europe shaped like a woman\'s hand with fingers pointing south, bordered by Norway, Sweden, and Russia, with a southern coast on the Gulf of Finland.',
  },
  DK: {
    explanation: 'Denmark invented LEGO — the world\'s most popular toy — and is consistently ranked one of the world\'s happiest and least corrupt countries. The Danish Viking Age (800-1100 AD) saw Danes colonize England, Ireland, Iceland, Greenland, and reach North America.',
    visualDescription: 'A small Scandinavian country consisting of the Jutland Peninsula extending north from Germany and numerous islands, with the large island of Zealand (where Copenhagen is located) to the east.',
  },
  IE: {
    explanation: 'Ireland\'s Great Famine of 1845-1852 killed one million people and caused two million to emigrate, reducing the island\'s population by 25% — the only country in the world whose population today is smaller than it was 175 years ago. There are now more people of Irish descent outside Ireland than within it.',
    visualDescription: 'A large island in the North Atlantic off the western coast of Britain, with the northern portion (Northern Ireland) part of the UK and the Republic of Ireland occupying the rest.',
  },
  IS: {
    explanation: 'Iceland is the world\'s most geologically active country — it sits directly on the Mid-Atlantic Ridge where the North American and Eurasian tectonic plates are pulling apart at 2.5 cm per year. It runs almost entirely on renewable geothermal and hydroelectric energy.',
    visualDescription: 'A large volcanic island in the North Atlantic Ocean between Greenland and Norway, with its distinctive northwestern peninsula (Westfjords) and numerous glaciers visible.',
  },
  LU: {
    explanation: 'Luxembourg has the world\'s highest GDP per capita and is home to major EU institutions including the European Court of Justice. Despite being one of Europe\'s smallest countries, it has more Michelin-starred restaurants per capita than France.',
    visualDescription: 'One of Europe\'s smallest countries, a tiny rectangle sandwiched between Belgium, France, and Germany.',
  },
  CY: {
    explanation: 'Cyprus is divided between the internationally recognized Republic of Cyprus and the self-declared Northern Cyprus controlled by Turkey since 1974, separated by the UN-patrolled Green Line. The island was reportedly the birthplace of the goddess Aphrodite, and copper — from which it takes its name — was mined there for 5,000 years.',
    visualDescription: 'An island in the northeastern Mediterranean Sea, the third-largest Mediterranean island, roughly shaped like a rabbit with its ear pointing northeast.',
  },
  CO: {
    explanation: 'Colombia is the only country in South America with both Atlantic and Pacific coastlines. It is the world\'s largest producer of emeralds, supplying 70-90% of global production, and the second most biodiverse country on Earth.',
    visualDescription: 'The northwestern corner of South America, with coastlines on both the Pacific Ocean and Caribbean Sea, bordered by Panama, Venezuela, Brazil, Peru, and Ecuador.',
  },
  VE: {
    explanation: 'Venezuela is home to Angel Falls — the world\'s highest uninterrupted waterfall, plunging 979 meters. The country has the world\'s largest proven oil reserves, yet has experienced severe economic collapse since 2013.',
    visualDescription: 'A country in northern South America with a Caribbean coastline, bordering Colombia, Brazil, and Guyana, with a distinctive northern coastal mountain range and the Orinoco River delta in the east.',
  },
  PE: {
    explanation: 'Peru is home to Machu Picchu, one of the world\'s most spectacular archaeological sites, built by the Inca Empire around 1450 and "discovered" by the outside world in 1911. The Amazon River, the world\'s largest river by volume, begins as a small stream in the Peruvian Andes.',
    visualDescription: 'A large country on the Pacific coast of South America, with the Andes Mountains running along its western edge, the Amazon Basin in the east, and Lake Titicaca in the south.',
  },
  CL: {
    explanation: 'Chile is the world\'s longest country from north to south — stretching 4,270 km — but averages only 177 km in width. It contains the Atacama Desert, the driest non-polar desert on Earth, where some weather stations have never recorded rainfall.',
    visualDescription: 'An extremely long, thin country along the western coast of South America, running from near the equator to the tip of the continent, with the Andes forming its eastern border.',
  },
  EC: {
    explanation: 'Ecuador sits exactly on the equator (its name means "equator" in Spanish) and the Galápagos Islands — Darwin\'s inspiration for the theory of evolution — are Ecuadorian territory. Standing on Ecuador\'s Chimborazo volcano, you are at the point on Earth\'s surface farthest from its center.',
    visualDescription: 'A small country on the Pacific coast of South America, bordered by Colombia and Peru, with the equator running through its center.',
  },
  BO: {
    explanation: 'Bolivia has two capitals — Sucre (constitutional) and La Paz (seat of government), the world\'s highest-elevation capital city at 3,650 meters. The Salar de Uyuni is the world\'s largest salt flat, covering 10,582 square kilometers and containing half the world\'s lithium reserves.',
    visualDescription: 'A landlocked country in central South America, roughly rectangular, bordered by Peru, Chile, Argentina, Paraguay, and Brazil.',
  },
  PY: {
    explanation: 'Paraguay is one of only two landlocked countries in South America and is nearly surrounded by Brazil and Argentina. The Guaraní language is still spoken by over 90% of the population alongside Spanish, making Paraguay unique as a country where an indigenous language is truly co-official.',
    visualDescription: 'A landlocked country in the center of South America, bordered by Brazil, Argentina, and Bolivia, with the Paraguay River dividing it into eastern highlands and the western Chaco lowlands.',
  },
  UY: {
    explanation: 'Uruguay was the first country in the world to legalize marijuana (2013) and to fully legalize same-sex marriage in 2013. It is the most secular and most prosperous democracy in South America by most measures.',
    visualDescription: 'The second-smallest country in South America, tucked into the corner between Argentina and Brazil, with an Atlantic Ocean coastline.',
  },
  GY: {
    explanation: 'Guyana is the only English-speaking country in South America, a legacy of British colonization. The Kaieteur Falls in its interior is five times the height of Niagara Falls and one of the world\'s most powerful waterfalls.',
    visualDescription: 'A small country on the northeastern coast of South America, bordered by Venezuela, Brazil, and Suriname, with an Atlantic coast.',
  },
  SR: {
    explanation: 'Suriname is the smallest country in South America and is the only country outside Europe where Dutch is the official language. Over 90% of its territory is covered by tropical rainforest, giving it one of the world\'s highest percentages of forest coverage.',
    visualDescription: 'A small country on the northeastern coast of South America between Guyana and French Guiana (French territory), with an Atlantic coast.',
  },
  NZ: {
    explanation: 'New Zealand was the last large landmass to be settled by humans — Māori arrived only around 1280 AD, making it one of the youngest countries to have indigenous people. It was also the first country to give women the right to vote, in 1893.',
    visualDescription: 'Two main islands in the southwestern Pacific Ocean: a long, narrow North Island and a larger, more mountainous South Island, oriented roughly northeast-southwest.',
  },
  PG: {
    explanation: 'Papua New Guinea is one of the world\'s most linguistically diverse countries, with over 840 distinct languages — about 12% of all the world\'s languages in a country with less than 0.1% of the world\'s population. Its highland forests contain the only known venomous birds, the Pitohui.',
    visualDescription: 'A country occupying the eastern half of the island of New Guinea (the world\'s second-largest island), plus several island groups in the southwestern Pacific.',
  },
  FJ: {
    explanation: 'Fiji consists of over 330 islands, but only 110 are inhabited. The country\'s national rugby team are the reigning Olympic champions in rugby sevens. Fijian fire-walking — traditionally walking over white-hot stones — is one of the world\'s most spectacular ceremonial traditions.',
    visualDescription: 'An island nation in the South Pacific, consisting of two main islands (Viti Levu and Vanua Levu) and hundreds of smaller islands.',
  },
  SB: {
    explanation: 'The Solomon Islands was the site of one of World War II\'s most pivotal battles — the six-month Guadalcanal Campaign was the first major Allied offensive against Imperial Japan. The island chain has some of the world\'s most pristine coral reefs.',
    visualDescription: 'A scattered archipelago of six major islands and over 900 smaller ones in the southwestern Pacific Ocean, northeast of Australia.',
  },
  VU: {
    explanation: 'Vanuatu is home to one of the world\'s most accessible lava lakes — visitors can peer into the crater of Vanuatu\'s Mount Yasur volcano. The country speaks the most languages per capita of any nation (about 110 languages for 300,000 people).',
    visualDescription: 'A Y-shaped archipelago of about 80 islands in the southwestern Pacific Ocean, running roughly north to south.',
  },
  MW: {
    explanation: 'Malawi is nicknamed "The Warm Heart of Africa" for the friendliness of its people. Lake Malawi, which covers a fifth of the country\'s surface area, contains more species of fish than any other lake on Earth — over 1,000 species, mostly cichlids found nowhere else.',
    visualDescription: 'A long, narrow landlocked country in southeastern Africa, dominated by the elongated Lake Malawi running along its eastern border with Tanzania and Mozambique.',
  },
  BN: {
    explanation: 'Brunei is one of the world\'s wealthiest countries per capita, thanks to its massive oil and gas reserves, and its citizens pay no income tax. The Sultan of Brunei\'s Istana Nurul Iman Palace is the world\'s largest residential palace, with 1,788 rooms.',
    visualDescription: 'A tiny country on the northern coast of Borneo island in Southeast Asia, divided into two non-contiguous parts by the Malaysian state of Sarawak.',
  },
  TL: {
    explanation: 'East Timor (Timor-Leste) is one of the world\'s youngest countries, achieving full independence only in 2002 after a long struggle against Indonesian occupation. The Timor Sea between it and Australia is rich in oil and gas deposits that have been the subject of ongoing boundary disputes.',
    visualDescription: 'A country occupying the eastern half of the island of Timor in Southeast Asia, plus the small enclave of Oecusse on the western side of the island, surrounded by Indonesian territory.',
  },
  HT: {
    explanation: 'Haiti was the first Black republic in the world and the first Latin American country to gain independence (1804), achieved through a revolution by enslaved people against French colonial rule. It is the most deforested country in the Western Hemisphere.',
    visualDescription: 'The western third of the island of Hispaniola in the Caribbean, bordered by the Dominican Republic to the east.',
  },
  DO: {
    explanation: 'The Dominican Republic shares the island of Hispaniola with Haiti and contains the Caribbean\'s highest point (Pico Duarte at 3,098 m) and its lowest (Lake Enriquillo at 44 m below sea level) — both within the same country. It is the most visited country in the Caribbean.',
    visualDescription: 'The eastern two-thirds of the island of Hispaniola in the Caribbean, with an Atlantic coast to the north and Caribbean Sea to the south.',
  },
  CU: {
    explanation: 'Cuba is the largest island in the Caribbean and was under Spanish control for 400 years before the 1898 Spanish-American War. The country\'s vintage American cars — frozen in time since the 1959 revolution\'s trade embargo — have become one of the world\'s most distinctive cultural images.',
    visualDescription: 'The largest island in the Caribbean, elongated east-west like a crocodile, with the Yucatán Channel separating it from Mexico to the west.',
  },
  JM: {
    explanation: 'Jamaica gave the world reggae music, Bob Marley, and the global phenomenon of Rastafarianism. It holds the world record for the most Olympic sprint medals per capita of any country, producing stars like Usain Bolt and Shelly-Ann Fraser-Pryce.',
    visualDescription: 'A medium-sized Caribbean island south of Cuba, roughly oval and mountainous, with the Blue Mountains visible in the east.',
  },
  TT: {
    explanation: 'Trinidad and Tobago is the birthplace of steel pan music — the only new acoustic instrument invented in the 20th century — and the calypso and soca musical traditions. It also has one of the world\'s largest natural asphalt lakes, Pitch Lake.',
    visualDescription: 'Two islands at the southern end of the Caribbean, close to Venezuela\'s coast: the larger Trinidad and the smaller Tobago to its northeast.',
  },
  BS: {
    explanation: 'The Bahamas was the site of Christopher Columbus\'s first landing in the New World in 1492, on the island of San Salvador. The clear, shallow waters around the islands contain the world\'s highest concentration of blue holes — underwater cave systems that plunge hundreds of meters deep.',
    visualDescription: 'A scattered archipelago of about 700 islands and 2,400 cays in the Atlantic Ocean, north of Cuba and southeast of Florida, visible as a chain of small specks.',
  },
  GT: {
    explanation: 'Guatemala is home to over 30 volcanoes and the ancient Maya city of Tikal — one of the largest and most powerful cities of the Maya civilization from 200-900 AD, now an archaeological site rising above the jungle. Guatemalan jade was so prized by the Maya that it was more valuable than gold.',
    visualDescription: 'A country in Central America bordered by Mexico, Belize, Honduras, and El Salvador, with both Pacific and Caribbean coastlines.',
  },
  HN: {
    explanation: 'Honduras contains the ancient Maya city of Copán, famous for its ornate carved stone stelae and hieroglyphic stairway — considered one of the masterpieces of New World sculpture. The Bay Islands off its Caribbean coast contain some of the world\'s best scuba diving.',
    visualDescription: 'A country in the heart of Central America with both Caribbean and Pacific coastlines, sandwiched between Guatemala, El Salvador, and Nicaragua.',
  },
  NI: {
    explanation: 'Nicaragua is home to the world\'s only freshwater sharks — bull sharks that swim up the San Juan River from the Caribbean and have adapted to Lake Nicaragua. The country has the largest area of tropical rainforest in Central America.',
    visualDescription: 'The largest country in Central America, bordered by Honduras to the north and Costa Rica to the south, with both Pacific and Caribbean coasts and large freshwater lakes in the interior.',
  },
  CR: {
    explanation: 'Costa Rica abolished its military in 1948 — one of only a few countries in the world without a standing army. Despite covering only 0.03% of the world\'s surface, it contains 5% of the world\'s biodiversity, with over 900 bird species.',
    visualDescription: 'A small country in southern Central America, bordered by Nicaragua to the north and Panama to the south, with both Pacific and Caribbean coastlines.',
  },
  PA: {
    explanation: 'The Panama Canal, completed in 1914, cut 15,000 km off the shipping route between the Atlantic and Pacific — one of the most transformative engineering projects in history. Panama City is the only city in the world where you can watch the sun rise over the Pacific and set over the Atlantic.',
    visualDescription: 'A narrow S-shaped isthmus connecting Central and South America, with the Panama Canal visible as a thin line cutting through the center.',
  },
  SV: {
    explanation: 'El Salvador is the smallest country in Central America — about the size of Massachusetts — and the only one without an Atlantic coastline. In 2021 it became the first country to adopt Bitcoin as legal tender.',
    visualDescription: 'The smallest country in Central America, entirely Pacific-facing, sandwiched between Guatemala and Honduras.',
  },
  BZ: {
    explanation: 'Belize contains the world\'s second-largest barrier reef system (after Australia\'s Great Barrier Reef), with the famous Great Blue Hole — a massive underwater sinkhole 300 meters across and 125 meters deep. English is the only official language, making it unique in Central America.',
    visualDescription: 'A small country on the Caribbean coast of Central America, bordered by Mexico to the north and Guatemala to the west and south.',
  },
};

// ============================================================
// SAME-CONTINENT DISTRACTORS
// Pre-generated fallback lists of 8-10 same-continent countries per country.
// ============================================================
const EUROPE_POOL = [
  'France', 'Germany', 'United Kingdom', 'Italy', 'Spain', 'Poland', 'Netherlands', 'Belgium',
  'Austria', 'Switzerland', 'Sweden', 'Norway', 'Portugal', 'Greece', 'Czech Republic',
  'Hungary', 'Romania', 'Bulgaria', 'Ukraine', 'Finland', 'Denmark', 'Ireland', 'Croatia',
  'Slovakia', 'Slovenia', 'Lithuania', 'Latvia', 'Estonia', 'Serbia', 'Bosnia and Herzegovina',
];
const ASIA_POOL = [
  'China', 'Japan', 'India', 'South Korea', 'Thailand', 'Vietnam', 'Malaysia', 'Indonesia',
  'Philippines', 'Pakistan', 'Iran', 'Saudi Arabia', 'Turkey', 'Kazakhstan', 'Afghanistan',
  'Iraq', 'Syria', 'Jordan', 'Bangladesh', 'Nepal', 'Myanmar', 'Cambodia', 'Laos',
  'Mongolia', 'Azerbaijan', 'Georgia', 'Armenia', 'Kuwait', 'Qatar', 'Oman',
];
const AFRICA_POOL = [
  'Nigeria', 'Egypt', 'South Africa', 'Ethiopia', 'Kenya', 'Morocco', 'Algeria', 'Tanzania',
  'Ghana', 'Ivory Coast', 'Cameroon', 'Sudan', 'Angola', 'Mozambique', 'Zimbabwe', 'Zambia',
  'Somalia', 'Madagascar', 'Mali', 'Niger', 'Burkina Faso', 'Senegal', 'Guinea', 'Uganda',
  'Rwanda', 'Botswana', 'Namibia', 'Libya', 'Tunisia', 'Democratic Republic of the Congo',
];
const N_AMERICA_POOL = [
  'United States of America', 'Canada', 'Mexico', 'Cuba', 'Haiti', 'Dominican Republic',
  'Guatemala', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panama', 'El Salvador', 'Belize',
  'Jamaica', 'Trinidad and Tobago', 'The Bahamas',
];
const S_AMERICA_POOL = [
  'Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela', 'Ecuador', 'Bolivia',
  'Paraguay', 'Uruguay', 'Guyana', 'Suriname',
];
const OCEANIA_POOL = [
  'Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Islands', 'Vanuatu',
];

const CONTINENT_DISTRACTOR_POOL: Record<Continent, string[]> = {
  Europe: EUROPE_POOL,
  Asia: ASIA_POOL,
  Africa: AFRICA_POOL,
  'North America': N_AMERICA_POOL,
  'South America': S_AMERICA_POOL,
  Oceania: OCEANIA_POOL,
};

// ============================================================
// ACCEPTABLE ALTERNATIVES MAP
// correctAnswer (as it appears in manifest) → alternative names
// ============================================================
const ACCEPTABLE_ALTERNATIVES: Record<string, string[]> = {
  'United States of America': ['USA', 'US', 'United States'],
  'United Kingdom': ['UK', 'Great Britain', 'Britain'],
  'United Republic of Tanzania': ['Tanzania'],
  'Republic of the Congo': ['Congo-Brazzaville', 'Congo Republic'],
  'Democratic Republic of the Congo': ['DRC', 'Congo-Kinshasa'],
  'Republic of Serbia': ['Serbia'],
  'North Macedonia': ['Macedonia'],
  'Ivory Coast': ['Côte d\'Ivoire'],
  'Czechia': ['Czech Republic'],
  'eSwatini': ['Swaziland'],
  'The Bahamas': ['Bahamas'],
  'Myanmar': ['Burma'],
  'East Timor': ['Timor-Leste'],
  'Taiwan': ['Chinese Taipei'],
};

// ============================================================
// HELPER: build distractors for a given country
// Pick 8 other countries from the same continent pool, excluding the country itself.
// ============================================================
function buildDistractors(correctAnswer: string, continent: Continent): string[] {
  const pool = CONTINENT_DISTRACTOR_POOL[continent];
  // Normalise the correct answer for comparison (handle aliases like "Republic of Serbia" → "Serbia")
  const normalized = (ACCEPTABLE_ALTERNATIVES[correctAnswer] ?? [correctAnswer, correctAnswer])[0];
  const candidates = pool.filter(
    (name) =>
      name !== correctAnswer &&
      name !== normalized &&
      !Object.values(ACCEPTABLE_ALTERNATIVES).flat().includes(correctAnswer) ||
      name !== correctAnswer
  );
  // Simple stable selection: first 8 from pool excluding self
  const result: string[] = [];
  for (const name of pool) {
    if (result.length >= 8) break;
    if (name === correctAnswer) continue;
    // Also skip if the pool entry is an alternative name for this country
    const alts = ACCEPTABLE_ALTERNATIVES[correctAnswer] ?? [];
    if (alts.includes(name)) continue;
    result.push(name);
  }
  return result;
}

// ============================================================
// MAIN
// ============================================================
function main() {
  const manifestPath = path.join(ROOT, 'public', 'assets', 'maps', 'countries', 'manifest.json');
  const outputPath = path.join(ROOT, 'data', 'decks', 'world_countries.json');

  const manifest: Record<string, { file: string; iso: string }> = JSON.parse(
    fs.readFileSync(manifestPath, 'utf-8')
  );

  const allFacts = [];
  const allFactIds: string[] = [];
  const warnings: string[] = [];

  for (const [countryName, { file, iso }] of Object.entries(manifest)) {
    // Skip excluded territories
    if (EXCLUDED_ISOS.has(iso.toUpperCase())) {
      console.log(`Skipping excluded territory: ${countryName} (${iso})`);
      continue;
    }

    const metaKey = iso.toUpperCase();
    const meta = COUNTRY_META[metaKey];
    if (!meta) {
      warnings.push(`No metadata for ${countryName} (${iso}) — skipping`);
      continue;
    }

    const content = COUNTRY_CONTENT[metaKey];
    if (!content) {
      warnings.push(`No content for ${countryName} (${iso}) — skipping`);
      continue;
    }

    // Build fact ID: "country_" + iso lowercase (replace - with _)
    const factId = `country_${iso.toLowerCase().replace('-', '_')}`;

    const acceptableAlts = ACCEPTABLE_ALTERNATIVES[countryName] ?? [];

    const distractors = buildDistractors(countryName, meta.continent);

    const chainThemeId = CHAIN_THEME_ID[meta.continent];

    const imageAssetPath = `assets/maps/countries/${file}`;

    allFacts.push({
      id: factId,
      correctAnswer: countryName,
      acceptableAlternatives: acceptableAlts,
      chainThemeId,
      answerTypePoolId: 'country_names',
      difficulty: meta.difficulty,
      funScore: meta.funScore,
      quizQuestion: 'Which country is highlighted on this map?',
      explanation: content.explanation,
      visualDescription: content.visualDescription,
      sourceName: 'Natural Earth',
      volatile: false,
      distractors,
      imageAssetPath,
      quizMode: 'image_question',
    });

    allFactIds.push(factId);
  }

  if (warnings.length > 0) {
    console.warn('\nWARNINGS:');
    warnings.forEach((w) => console.warn('  ' + w));
  }

  // Build difficulty tiers
  const easyIds = allFacts.filter((f) => f.difficulty <= 2).map((f) => f.id);
  const mediumIds = allFacts.filter((f) => f.difficulty === 3).map((f) => f.id);
  const hardIds = allFacts.filter((f) => f.difficulty >= 4).map((f) => f.id);

  const deck = {
    id: 'world_countries',
    name: 'World Countries',
    domain: 'geography',
    subDomain: 'countries',
    description: `Identify countries from their highlighted position on a world map. ${allFacts.length} countries from all continents.`,
    minimumFacts: 30,
    targetFacts: allFacts.length,
    facts: allFacts,
    answerTypePools: [
      {
        id: 'country_names',
        label: 'Country Names',
        answerFormat: 'name',
        factIds: allFactIds,
        minimumSize: 5,
      },
    ],
    synonymGroups: [
      {
        id: 'slovakia_slovenia',
        factIds: ['country_sk', 'country_si'],
        reason: 'Slovakia and Slovenia are frequently confused due to similar names and neighboring locations in Central Europe.',
      },
      {
        id: 'nigeria_niger',
        factIds: ['country_ng', 'country_ne'],
        reason: 'Nigeria and Niger are often confused — Niger is the landlocked country to Nigeria\'s north, both named after the Niger River.',
      },
      {
        id: 'congo_both',
        factIds: ['country_cg', 'country_cd'],
        reason: 'Republic of the Congo (Congo-Brazzaville) and Democratic Republic of the Congo (Congo-Kinshasa) share a river border and similar names.',
      },
    ],
    questionTemplates: [
      {
        id: 'identify_country',
        answerPoolId: 'country_names',
        questionFormat: 'Which country is highlighted on this map?',
        availableFromMastery: 0,
        difficulty: 1,
        reverseCapable: false,
      },
    ],
    difficultyTiers: [
      { tier: 'easy', factIds: easyIds },
      { tier: 'medium', factIds: mediumIds },
      { tier: 'hard', factIds: hardIds },
    ],
  };

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(deck, null, 2), 'utf-8');

  console.log(`\nDeck written to: ${outputPath}`);
  console.log(`Total countries: ${allFacts.length}`);
  console.log(`  Easy (difficulty 1-2): ${easyIds.length}`);
  console.log(`  Medium (difficulty 3): ${mediumIds.length}`);
  console.log(`  Hard (difficulty 4-5): ${hardIds.length}`);
  console.log(`  By continent:`);

  const continentCounts: Record<string, number> = {};
  for (const fact of allFacts) {
    const meta = COUNTRY_META[fact.id.replace('country_', '').replace('_', '-').toUpperCase()];
    const continent = meta?.continent ?? 'unknown';
    continentCounts[continent] = (continentCounts[continent] ?? 0) + 1;
  }
  for (const [continent, count] of Object.entries(continentCounts).sort()) {
    console.log(`    ${continent}: ${count}`);
  }
}

main();
