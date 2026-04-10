#!/usr/bin/env node
/**
 * Enrich world_capitals.json with map coordinates for the map_pin quiz mode.
 *
 * Adds to each fact:
 *   - mapCoordinates: [lat, lng]
 *   - mapRegion: one of europe|asia|middle_east|africa|north_america|south_america|oceania
 *   - mapDifficultyTier: 1-5 (1=easiest, 5=obscure)
 *   - quizResponseMode: 'map_pin'
 *
 * Tier definitions:
 *   1 — G7 capitals + iconic world capitals (Washington DC, London, Paris, Rome, Berlin, Tokyo, etc.)
 *   2 — G20 + major tourism destinations
 *   3 — Well-known regional capitals
 *   4 — Less well-known
 *   5 — Obscure/specialist knowledge
 *
 * Regions:
 *   europe        — All European countries
 *   asia          — East/South/Southeast/Central Asia
 *   middle_east   — Middle East + Caucasus + North Africa
 *   africa        — Sub-Saharan Africa
 *   north_america — North America + Caribbean + Central America
 *   south_america — South America
 *   oceania       — Australia, NZ, Pacific Islands
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// ============================================================
// COORDINATE DATABASE
// Format: 'Capital City': { lat, lng, region, tier }
// Coordinates are approximate city-centre locations from Wikipedia.
// ============================================================
const CAPITAL_COORDS = {
  // ── EUROPE ──────────────────────────────────────────────────
  'Paris':            { lat:  48.8566, lng:   2.3522, region: 'europe', tier: 1 },
  'Berlin':           { lat:  52.5200, lng:  13.4050, region: 'europe', tier: 1 },
  'London':           { lat:  51.5074, lng:  -0.1278, region: 'europe', tier: 1 },
  'Madrid':           { lat:  40.4168, lng:  -3.7038, region: 'europe', tier: 1 },
  'Rome':             { lat:  41.9028, lng:  12.4964, region: 'europe', tier: 1 },
  'Lisbon':           { lat:  38.7169, lng:  -9.1395, region: 'europe', tier: 2 },
  'Brussels':         { lat:  50.8503, lng:   4.3517, region: 'europe', tier: 2 },
  'Amsterdam':        { lat:  52.3676, lng:   4.9041, region: 'europe', tier: 2 },
  'Vienna':           { lat:  48.2082, lng:  16.3738, region: 'europe', tier: 2 },
  'Warsaw':           { lat:  52.2297, lng:  21.0122, region: 'europe', tier: 3 },
  'Prague':           { lat:  50.0755, lng:  14.4378, region: 'europe', tier: 2 },
  'Bratislava':       { lat:  48.1486, lng:  17.1077, region: 'europe', tier: 3 },
  'Budapest':         { lat:  47.4979, lng:  19.0402, region: 'europe', tier: 2 },
  'Bucharest':        { lat:  44.4268, lng:  26.1025, region: 'europe', tier: 3 },
  'Sofia':            { lat:  42.6977, lng:  23.3219, region: 'europe', tier: 3 },
  'Athens':           { lat:  37.9838, lng:  23.7275, region: 'europe', tier: 2 },
  'Tirana':           { lat:  41.3317, lng:  19.8317, region: 'europe', tier: 4 },
  'Skopje':           { lat:  41.9981, lng:  21.4254, region: 'europe', tier: 4 },
  'Belgrade':         { lat:  44.7866, lng:  20.4489, region: 'europe', tier: 3 },
  'Sarajevo':         { lat:  43.8563, lng:  18.4131, region: 'europe', tier: 3 },
  'Zagreb':           { lat:  45.8150, lng:  15.9819, region: 'europe', tier: 3 },
  'Ljubljana':        { lat:  46.0569, lng:  14.5058, region: 'europe', tier: 3 },
  'Podgorica':        { lat:  42.4304, lng:  19.2594, region: 'europe', tier: 4 },
  'Pristina':         { lat:  42.6629, lng:  21.1655, region: 'europe', tier: 4 },
  'Chisinau':         { lat:  47.0105, lng:  28.8638, region: 'europe', tier: 4 },
  'Moscow':           { lat:  55.7558, lng:  37.6173, region: 'europe', tier: 1 },
  'Kyiv':             { lat:  50.4501, lng:  30.5234, region: 'europe', tier: 2 },
  'Minsk':            { lat:  53.9045, lng:  27.5615, region: 'europe', tier: 3 },
  'Vilnius':          { lat:  54.6872, lng:  25.2797, region: 'europe', tier: 3 },
  'Riga':             { lat:  56.9496, lng:  24.1052, region: 'europe', tier: 3 },
  'Tallinn':          { lat:  59.4370, lng:  24.7536, region: 'europe', tier: 3 },
  'Helsinki':         { lat:  60.1699, lng:  24.9384, region: 'europe', tier: 2 },
  'Stockholm':        { lat:  59.3293, lng:  18.0686, region: 'europe', tier: 2 },
  'Oslo':             { lat:  59.9139, lng:  10.7522, region: 'europe', tier: 2 },
  'Copenhagen':       { lat:  55.6761, lng:  12.5683, region: 'europe', tier: 2 },
  'Reykjavik':        { lat:  64.1466, lng: -21.9426, region: 'europe', tier: 3 },
  'Dublin':           { lat:  53.3498, lng:  -6.2603, region: 'europe', tier: 2 },
  'Luxembourg City':  { lat:  49.6116, lng:   6.1319, region: 'europe', tier: 3 },
  'Bern':             { lat:  46.9480, lng:   7.4474, region: 'europe', tier: 2 },
  'Valletta':         { lat:  35.8997, lng:  14.5147, region: 'europe', tier: 3 },
  'Nicosia':          { lat:  35.1856, lng:  33.3823, region: 'europe', tier: 3 },
  'Andorra la Vella': { lat:  42.5063, lng:   1.5218, region: 'europe', tier: 4 },
  'Vaduz':            { lat:  47.1410, lng:   9.5215, region: 'europe', tier: 4 },
  'Monaco':           { lat:  43.7384, lng:   7.4246, region: 'europe', tier: 3 },
  'San Marino':       { lat:  43.9424, lng:  12.4578, region: 'europe', tier: 4 },

  // ── ASIA (East / South / Southeast) ──────────────────────────
  'Beijing':          { lat:  39.9042, lng: 116.4074, region: 'asia', tier: 1 },
  'Tokyo':            { lat:  35.6762, lng: 139.6503, region: 'asia', tier: 1 },
  'Seoul':            { lat:  37.5665, lng: 126.9780, region: 'asia', tier: 2 },
  'New Delhi':        { lat:  28.6139, lng:  77.2090, region: 'asia', tier: 1 },
  'Dhaka':            { lat:  23.8103, lng:  90.4125, region: 'asia', tier: 3 },
  'Islamabad':        { lat:  33.6844, lng:  73.0479, region: 'asia', tier: 3 },
  'Kathmandu':        { lat:  27.7172, lng:  85.3240, region: 'asia', tier: 3 },
  'Thimphu':          { lat:  27.4712, lng:  89.6339, region: 'asia', tier: 4 },
  'Sri Jayawardenepura Kotte': { lat: 6.9108, lng: 79.8878, region: 'asia', tier: 4 },
  'Kabul':            { lat:  34.5553, lng:  69.2075, region: 'asia', tier: 3 },
  'Ulaanbaatar':      { lat:  47.8864, lng: 106.9057, region: 'asia', tier: 4 },
  'Pyongyang':        { lat:  39.0392, lng: 125.7625, region: 'asia', tier: 3 },
  'Taipei':           { lat:  25.0330, lng: 121.5654, region: 'asia', tier: 3 },
  'Bangkok':          { lat:  13.7563, lng: 100.5018, region: 'asia', tier: 2 },
  'Vientiane':        { lat:  17.9757, lng: 102.6331, region: 'asia', tier: 4 },
  'Phnom Penh':       { lat:  11.5625, lng: 104.9160, region: 'asia', tier: 4 },
  'Hanoi':            { lat:  21.0285, lng: 105.8542, region: 'asia', tier: 3 },
  'Manila':           { lat:  14.5995, lng: 120.9842, region: 'asia', tier: 3 },
  'Jakarta':          { lat:  -6.2088, lng: 106.8456, region: 'asia', tier: 2 },
  'Kuala Lumpur':     { lat:   3.1390, lng: 101.6869, region: 'asia', tier: 2 },
  'Bandar Seri Begawan': { lat: 4.9031, lng: 114.9398, region: 'asia', tier: 4 },
  'Dili':             { lat:  -8.5569, lng: 125.5789, region: 'asia', tier: 5 },
  'Singapore':        { lat:   1.3521, lng: 103.8198, region: 'asia', tier: 2 },
  'Naypyidaw':        { lat:  19.7633, lng:  96.0785, region: 'asia', tier: 5 },

  // ── CENTRAL ASIA (filed under middle_east in our schema) ────
  'Astana':           { lat:  51.1694, lng:  71.4491, region: 'middle_east', tier: 4 },
  'Bishkek':          { lat:  42.8746, lng:  74.5698, region: 'middle_east', tier: 4 },
  'Dushanbe':         { lat:  38.5598, lng:  68.7738, region: 'middle_east', tier: 4 },
  'Ashgabat':         { lat:  37.9601, lng:  58.3261, region: 'middle_east', tier: 5 },
  'Tashkent':         { lat:  41.2995, lng:  69.2401, region: 'middle_east', tier: 4 },

  // ── MIDDLE EAST + CAUCASUS ────────────────────────────────────
  'Tehran':           { lat:  35.6892, lng:  51.3890, region: 'middle_east', tier: 2 },
  'Baghdad':          { lat:  33.3152, lng:  44.3661, region: 'middle_east', tier: 2 },
  'Damascus':         { lat:  33.5102, lng:  36.2913, region: 'middle_east', tier: 2 },
  'Beirut':           { lat:  33.8938, lng:  35.5018, region: 'middle_east', tier: 3 },
  'Amman':            { lat:  31.9566, lng:  35.9457, region: 'middle_east', tier: 3 },
  'Jerusalem':        { lat:  31.7683, lng:  35.2137, region: 'middle_east', tier: 2 },
  'Ramallah':         { lat:  31.8996, lng:  35.2042, region: 'middle_east', tier: 4 },
  'Riyadh':           { lat:  24.6877, lng:  46.7219, region: 'middle_east', tier: 2 },
  "Sana'a":           { lat:  15.3694, lng:  44.1910, region: 'middle_east', tier: 4 },
  'Muscat':           { lat:  23.5880, lng:  58.3829, region: 'middle_east', tier: 3 },
  'Abu Dhabi':        { lat:  24.4539, lng:  54.3773, region: 'middle_east', tier: 3 },
  'Doha':             { lat:  25.2854, lng:  51.5310, region: 'middle_east', tier: 3 },
  'Kuwait City':      { lat:  29.3759, lng:  47.9774, region: 'middle_east', tier: 3 },
  'Manama':           { lat:  26.2235, lng:  50.5876, region: 'middle_east', tier: 3 },
  'Ankara':           { lat:  39.9334, lng:  32.8597, region: 'middle_east', tier: 2 },
  'Yerevan':          { lat:  40.1792, lng:  44.4991, region: 'middle_east', tier: 3 },
  'Tbilisi':          { lat:  41.6938, lng:  44.8015, region: 'middle_east', tier: 3 },
  'Baku':             { lat:  40.4093, lng:  49.8671, region: 'middle_east', tier: 3 },
  'Cairo':            { lat:  30.0444, lng:  31.2357, region: 'middle_east', tier: 1 },
  'Tripoli':          { lat:  32.8872, lng:  13.1913, region: 'middle_east', tier: 3 },
  'Tunis':            { lat:  36.8065, lng:  10.1815, region: 'middle_east', tier: 3 },
  'Algiers':          { lat:  36.7372, lng:   3.0865, region: 'middle_east', tier: 3 },
  'Rabat':            { lat:  34.0209, lng:  -6.8416, region: 'middle_east', tier: 3 },

  // ── AFRICA (Sub-Saharan) ─────────────────────────────────────
  'Nouakchott':       { lat:  18.0858, lng: -15.9785, region: 'africa', tier: 5 },
  'Dakar':            { lat:  14.7167, lng: -17.4677, region: 'africa', tier: 4 },
  'Banjul':           { lat:  13.4531, lng: -16.5775, region: 'africa', tier: 5 },
  'Bissau':           { lat:  11.8636, lng: -15.5977, region: 'africa', tier: 5 },
  'Conakry':          { lat:   9.6412, lng: -13.5784, region: 'africa', tier: 5 },
  'Freetown':         { lat:   8.4897, lng: -13.2344, region: 'africa', tier: 4 },
  'Monrovia':         { lat:   6.2907, lng: -10.7605, region: 'africa', tier: 4 },
  'Yamoussoukro':     { lat:   6.8276, lng:  -5.2893, region: 'africa', tier: 5 },
  'Accra':            { lat:   5.6037, lng:  -0.1870, region: 'africa', tier: 3 },
  'Lomé':             { lat:   6.1375, lng:   1.2123, region: 'africa', tier: 5 },
  'Porto-Novo':       { lat:   6.3703, lng:   2.3912, region: 'africa', tier: 5 },
  'Abuja':            { lat:   9.0579, lng:   7.4951, region: 'africa', tier: 3 },
  'Niamey':           { lat:  13.5137, lng:   2.1098, region: 'africa', tier: 5 },
  'Bamako':           { lat:  12.6392, lng:  -8.0029, region: 'africa', tier: 4 },
  'Ouagadougou':      { lat:  12.3647, lng:  -1.5353, region: 'africa', tier: 5 },
  'Khartoum':         { lat:  15.5007, lng:  32.5599, region: 'africa', tier: 4 },
  'Juba':             { lat:   4.8594, lng:  31.5713, region: 'africa', tier: 5 },
  'N\'Djamena':       { lat:  12.1348, lng:  15.0557, region: 'africa', tier: 5 },
  'Yaoundé':          { lat:   3.8480, lng:  11.5021, region: 'africa', tier: 4 },
  'Bangui':           { lat:   4.3612, lng:  18.5550, region: 'africa', tier: 5 },
  'Malabo':           { lat:   3.7500, lng:   8.7833, region: 'africa', tier: 5 },
  'Libreville':       { lat:   0.4162, lng:   9.4673, region: 'africa', tier: 4 },
  'Brazzaville':      { lat:  -4.2634, lng:  15.2429, region: 'africa', tier: 4 },
  'Kinshasa':         { lat:  -4.3220, lng:  15.3220, region: 'africa', tier: 3 },
  'Luanda':           { lat:  -8.8368, lng:  13.2343, region: 'africa', tier: 3 },
  'Lusaka':           { lat: -15.3875, lng:  28.3228, region: 'africa', tier: 4 },
  'Lilongwe':         { lat: -13.9626, lng:  33.7741, region: 'africa', tier: 4 },
  'Maputo':           { lat: -25.9692, lng:  32.5732, region: 'africa', tier: 4 },
  'Harare':           { lat: -17.8292, lng:  31.0522, region: 'africa', tier: 3 },
  'Gaborone':         { lat: -24.6282, lng:  25.9231, region: 'africa', tier: 4 },
  'Windhoek':         { lat: -22.5609, lng:  17.0658, region: 'africa', tier: 4 },
  'Pretoria':         { lat: -25.7479, lng:  28.2293, region: 'africa', tier: 2 },
  'Mbabane':          { lat: -26.3186, lng:  31.1410, region: 'africa', tier: 5 },
  'Maseru':           { lat: -29.3167, lng:  27.4833, region: 'africa', tier: 5 },
  'Addis Ababa':      { lat:   9.0250, lng:  38.7469, region: 'africa', tier: 3 },
  'Asmara':           { lat:  15.3381, lng:  38.9318, region: 'africa', tier: 5 },
  'Djibouti City':    { lat:  11.5720, lng:  43.1450, region: 'africa', tier: 5 },
  'Mogadishu':        { lat:   2.0469, lng:  45.3182, region: 'africa', tier: 4 },
  'Nairobi':          { lat:  -1.2921, lng:  36.8219, region: 'africa', tier: 3 },
  'Kampala':          { lat:   0.3476, lng:  32.5825, region: 'africa', tier: 3 },
  'Kigali':           { lat:  -1.9536, lng:  30.0606, region: 'africa', tier: 4 },
  'Gitega':           { lat:  -3.4271, lng:  29.9307, region: 'africa', tier: 5 },
  'Dodoma':           { lat:  -6.1722, lng:  35.7395, region: 'africa', tier: 4 },
  'Antananarivo':     { lat: -18.9249, lng:  47.5185, region: 'africa', tier: 4 },

  // ── NORTH AMERICA (incl. Caribbean + Central America) ────────
  'Washington, D.C.': { lat:  38.9072, lng: -77.0369, region: 'north_america', tier: 1 },
  'Ottawa':           { lat:  45.4215, lng: -75.6972, region: 'north_america', tier: 1 },
  'Mexico City':      { lat:  19.4326, lng: -99.1332, region: 'north_america', tier: 1 },
  'Havana':           { lat:  23.1136, lng: -82.3666, region: 'north_america', tier: 2 },
  'Kingston':         { lat:  17.9970, lng: -76.7936, region: 'north_america', tier: 3 },
  'Port-au-Prince':   { lat:  18.5944, lng: -72.3074, region: 'north_america', tier: 3 },
  'Santo Domingo':    { lat:  18.4861, lng: -69.9312, region: 'north_america', tier: 3 },
  'Nassau':           { lat:  25.0443, lng: -77.3504, region: 'north_america', tier: 3 },
  'Port of Spain':    { lat:  10.6549, lng: -61.5019, region: 'north_america', tier: 4 },
  'Guatemala City':   { lat:  14.6349, lng: -90.5069, region: 'north_america', tier: 3 },
  'Belmopan':         { lat:  17.2510, lng: -88.7590, region: 'north_america', tier: 5 },
  'Tegucigalpa':      { lat:  14.0818, lng: -87.2068, region: 'north_america', tier: 4 },
  'San Salvador':     { lat:  13.6929, lng: -89.2182, region: 'north_america', tier: 3 },
  'Managua':          { lat:  12.1149, lng: -86.2362, region: 'north_america', tier: 4 },
  'San José':         { lat:   9.9281, lng: -84.0907, region: 'north_america', tier: 3 },
  'Panama City':      { lat:   8.9936, lng: -79.5197, region: 'north_america', tier: 3 },

  // ── SOUTH AMERICA ─────────────────────────────────────────────
  'Brasília':         { lat: -15.7975, lng: -47.8919, region: 'south_america', tier: 2 },
  'Buenos Aires':     { lat: -34.6037, lng: -58.3816, region: 'south_america', tier: 2 },
  'Santiago':         { lat: -33.4489, lng: -70.6693, region: 'south_america', tier: 2 },
  'Lima':             { lat: -12.0464, lng: -77.0428, region: 'south_america', tier: 2 },
  'Sucre':            { lat: -19.0196, lng: -65.2619, region: 'south_america', tier: 4 },
  'La Paz':           { lat: -16.5000, lng: -68.1500, region: 'south_america', tier: 3 },
  'Bogotá':           { lat:   4.7110, lng: -74.0721, region: 'south_america', tier: 2 },
  'Caracas':          { lat:  10.4806, lng: -66.9036, region: 'south_america', tier: 2 },
  'Quito':            { lat:  -0.2295, lng: -78.5243, region: 'south_america', tier: 3 },
  'Georgetown':       { lat:   6.8013, lng: -58.1551, region: 'south_america', tier: 4 },
  'Paramaribo':       { lat:   5.8520, lng: -55.2038, region: 'south_america', tier: 4 },
  'Asunción':         { lat: -25.2867, lng: -57.6470, region: 'south_america', tier: 3 },
  'Montevideo':       { lat: -34.9011, lng: -56.1645, region: 'south_america', tier: 3 },

  // ── OCEANIA ──────────────────────────────────────────────────
  'Canberra':         { lat: -35.2809, lng: 149.1300, region: 'oceania', tier: 2 },
  'Wellington':       { lat: -41.2866, lng: 174.7756, region: 'oceania', tier: 3 },
  'Port Moresby':     { lat:  -9.4438, lng: 147.1803, region: 'oceania', tier: 4 },
  'Suva':             { lat: -18.1416, lng: 178.4419, region: 'oceania', tier: 4 },
  'Honiara':          { lat:  -9.4319, lng: 160.0483, region: 'oceania', tier: 5 },
  'Port Vila':        { lat: -17.7333, lng: 168.3167, region: 'oceania', tier: 5 },
  'Apia':             { lat: -13.8314, lng: -171.7518, region: 'oceania', tier: 5 },
  "Nuku'alofa":       { lat: -21.1394, lng: -175.2049, region: 'oceania', tier: 5 },
  'Funafuti':         { lat:  -8.5200, lng: 179.1980, region: 'oceania', tier: 5 },
  'Majuro':           { lat:   7.1167, lng: 171.3667, region: 'oceania', tier: 5 },
  'Tarawa':           { lat:   1.3278, lng: 172.9760, region: 'oceania', tier: 5 },
  'Palikir':          { lat:   6.9248, lng: 158.1610, region: 'oceania', tier: 5 },
  'Ngerulmud':        { lat:   7.5006, lng: 134.6243, region: 'oceania', tier: 5 },
  'South Tarawa':     { lat:   1.3278, lng: 172.9760, region: 'oceania', tier: 5 }, // Kiribati alias
};

// ============================================================
// Flexible lookup — try multiple name forms
// ============================================================
function lookupCapital(correctAnswer) {
  // Direct lookup
  if (CAPITAL_COORDS[correctAnswer]) return CAPITAL_COORDS[correctAnswer];

  // Strip trailing comma-separated country (e.g. "Paris, France" → "Paris")
  const stripped = correctAnswer.split(',')[0].trim();
  if (CAPITAL_COORDS[stripped]) return CAPITAL_COORDS[stripped];

  // Special case: "Washington, D.C." — don't strip
  if (correctAnswer.startsWith('Washington')) return CAPITAL_COORDS['Washington, D.C.'];

  // "Djibouti" → "Djibouti City" mapping
  const ALIASES = {
    'Djibouti': 'Djibouti City',
    'N\'Djamena': "N'Djamena",
    'Ndjamena': "N'Djamena",
    'Sana\'a': "Sana'a",
    'Sanaa': "Sana'a",
    'Nuku\'alofa': "Nuku'alofa",
    'Nukualofa': "Nuku'alofa",
    'La Paz / Sucre': 'La Paz',
    'Bandar Seri Begawan': 'Bandar Seri Begawan',
  };
  if (ALIASES[correctAnswer]) return CAPITAL_COORDS[ALIASES[correctAnswer]];
  if (ALIASES[stripped]) return CAPITAL_COORDS[ALIASES[stripped]];

  return null;
}

// ============================================================
// Main enrichment
// ============================================================
const deckPath = join(PROJECT_ROOT, 'data/decks/world_capitals.json');
const deck = JSON.parse(readFileSync(deckPath, 'utf8'));

let matched = 0;
let missed = 0;
const missedList = [];

for (const fact of deck.facts) {
  const coords = lookupCapital(fact.correctAnswer);
  if (coords) {
    fact.mapCoordinates = [coords.lat, coords.lng];
    fact.mapRegion = coords.region;
    fact.mapDifficultyTier = coords.tier;
    fact.quizResponseMode = 'map_pin';
    matched++;
  } else {
    missed++;
    missedList.push(`${fact.id}: "${fact.correctAnswer}"`);
  }
}

writeFileSync(deckPath, JSON.stringify(deck, null, 2));

console.log('\n=== Coordinate Enrichment Complete ===');
console.log(`  Matched: ${matched}/${deck.facts.length}`);
console.log(`  Missed:  ${missed}`);
if (missedList.length > 0) {
  console.log('\nMissed entries (need manual coordinates):');
  missedList.forEach(m => console.log('  -', m));
}

// ============================================================
// Verification: sample 10 facts
// ============================================================
console.log('\n=== Sample Verification (10 random facts) ===');
const VALID_REGIONS = new Set(['europe','asia','middle_east','africa','north_america','south_america','oceania']);
const sample = deck.facts.filter(f => f.mapCoordinates).slice(0, 5).concat(
  deck.facts.filter(f => f.mapCoordinates).slice(-5)
);

let sampleOk = 0;
let sampleFail = 0;
for (const f of sample) {
  const [lat, lng] = f.mapCoordinates;
  const latOk = lat >= -90 && lat <= 90;
  const lngOk = lng >= -180 && lng <= 180;
  const tierOk = f.mapDifficultyTier >= 1 && f.mapDifficultyTier <= 5;
  const regionOk = VALID_REGIONS.has(f.mapRegion);
  const modeOk = f.quizResponseMode === 'map_pin';
  const allOk = latOk && lngOk && tierOk && regionOk && modeOk;
  if (allOk) sampleOk++;
  else sampleFail++;
  console.log(`  ${allOk ? 'OK' : 'FAIL'} ${f.correctAnswer.padEnd(30)} lat=${lat} lng=${lng} region=${f.mapRegion} tier=${f.mapDifficultyTier}`);
}
console.log(`\nSample: ${sampleOk}/10 OK, ${sampleFail} FAIL`);

if (missed > 18) {
  console.error(`\nERROR: ${missed} capitals missed — target is ≤18 (≥150/168 coverage).`);
  process.exit(1);
}
console.log('\nDone. Run `npm run build:curated` to compile.');
