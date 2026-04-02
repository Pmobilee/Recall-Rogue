/**
 * pad-small-pools.mjs
 *
 * Adds synthetic distractors to every answerTypePool that has fewer than 15
 * total members (factIds + existing syntheticDistractors) across all curated decks.
 *
 * Rules:
 *  - bracket_numbers / bracket_number pools are SKIPPED (runtime numeric generation)
 *  - number / year / inauguration_years pools are SKIPPED (numeric, not meaningful as choices)
 *  - Synthetics must NOT duplicate an existing factId's correctAnswer or existing synthetics
 *  - Synthetics are domain-appropriate plausible wrong answers for the pool's label/format
 *
 * Usage:  node scripts/content-pipeline/pad-small-pools.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS_DIR = path.join(__dirname, '../../data/decks');
const MANIFEST_PATH = path.join(DECKS_DIR, 'manifest.json');
const TARGET = 15;

// ---------------------------------------------------------------------------
// Pool-type synthetic distractor banks
// Each key may be matched against pool.id, pool.label (lowercase), or pool.answerFormat
// Values are large candidate sets — we filter out dupes and take what we need.
// ---------------------------------------------------------------------------

const SYNTHETIC_BANKS = {

  // ── Computer Science ──────────────────────────────────────────────────────

  language_names: [
    'FORTRAN', 'COBOL', 'Pascal', 'Ada', 'Prolog', 'Erlang', 'Scala', 'Clojure',
    'Lua', 'Julia', 'Dart', 'Elixir', 'F#', 'OCaml', 'Zig', 'Haskell', 'Kotlin',
    'Groovy', 'BASIC', 'Assembly', 'PL/I', 'ALGOL', 'Simula', 'APL', 'ML',
    'Standard ML', 'Tcl', 'Rexx', 'Forth', 'Smalltalk', 'Eiffel',
  ],

  algorithm_names: [
    'Insertion Sort', 'Selection Sort', 'Heapsort', 'Binary Search',
    'Bellman-Ford Algorithm', "Kruskal's Algorithm", "Prim's Algorithm",
    'Floyd-Warshall', 'Radix Sort', 'Counting Sort', 'Red-Black Tree',
    'Topological Sort', 'Depth-First Search', 'Breadth-First Search',
    'A* Algorithm', 'Huffman Coding', 'Dynamic Programming', 'Knapsack Problem',
    'Boyer-Moore Algorithm', 'KMP Algorithm', 'Miller-Rabin Primality Test',
    'Euclidean Algorithm', "Dijkstra's Algorithm", 'AVL Tree Rotation',
  ],

  complexity_terms: [
    'O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(n³)', 'O(2^n)',
    'O(n!)', 'O(√n)', 'O(log log n)', 'O(n² log n)', 'O(n · 2^n)',
    'Θ(n)', 'Ω(n log n)', 'Ω(n²)', 'Θ(n log n)', 'Θ(1)',
  ],

  protocol_names: [
    'HTTP', 'HTTPS', 'FTP', 'SSH', 'SMTP', 'DNS', 'DHCP', 'SNMP',
    'IMAP', 'POP3', 'NTP', 'LDAP', 'Telnet', 'ARP', 'ICMP',
    'BGP', 'OSPF', 'RIP', 'SIP', 'XMPP', 'WebSocket', 'MQTT', 'CoAP',
  ],

  // ── Solar System / Space ──────────────────────────────────────────────────

  mission_names: [
    'Apollo 11', 'Apollo 13', 'Mariner 4', 'Mariner 9', 'Viking 1', 'Viking 2',
    'Pioneer 11', 'Galileo', 'Juno', 'OSIRIS-REx', 'Hayabusa', 'Dawn',
    'Mars Odyssey', 'Mars Reconnaissance Orbiter', 'Parker Solar Probe',
    'Stardust', 'Deep Impact', 'Rosetta', 'Ulysses', 'SOHO',
    'Hubble Space Telescope', 'Kepler', 'TESS', 'James Webb Space Telescope',
    'InSight', 'Perseverance', 'Spirit', 'Opportunity',
  ],

  system_facts: [
    'magnetosphere', 'obliquity', 'perihelion', 'aphelion', 'synodic period',
    'sidereal period', 'eccentricity', 'inclination', 'axial tilt',
    'Hill sphere', 'Lagrange points', 'Roche limit', 'solar constant',
  ],

  // ── US Presidents ─────────────────────────────────────────────────────────

  party_names: [
    'Democratic', 'Liberal Republican', 'Greenback', 'Prohibition',
    'Socialist', 'Reform', 'Libertarian', 'Constitution Party',
    'Independence Party', 'American Independent', 'States Rights Democratic',
  ],

  home_states: [
    'New Jersey', 'Maryland', 'South Carolina', 'North Carolina', 'New Hampshire',
    'Delaware', 'Kentucky', 'Indiana', 'Missouri', 'Michigan', 'Wisconsin',
    'Minnesota', 'Iowa', 'Kansas', 'Nebraska', 'Louisiana', 'Alabama', 'Mississippi',
    'Arkansas', 'West Virginia', 'Colorado', 'Oregon', 'Montana', 'Wyoming',
    'Idaho', 'Utah', 'Nevada', 'Arizona', 'New Mexico', 'Alaska', 'Hawaii',
  ],

  // ── Periodic Table ────────────────────────────────────────────────────────

  element_symbols: [
    'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'Ne', 'Mg',
    'Al', 'Si', 'P', 'S', 'Ar', 'Ca', 'Sc', 'Ti', 'V', 'Cr',
    'Mn', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr',
    'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Cd', 'In', 'Sn', 'Te', 'Xe',
    'Cs', 'Ba', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb',
    'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'W', 'Re',
    'Os', 'Ir', 'Pt', 'Tl', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra',
    'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf',
  ],

  element_categories: [
    'lanthanide', 'actinide', 'post-transition metal', 'alkaline earth metal',
    'halogen', 'noble gas', 'alkali metal', 'transition metal',
    'reactive nonmetal', 'metalloid', 'unknown properties',
    'radioactive metal', 'diatomic nonmetal',
  ],

  // ── US States ─────────────────────────────────────────────────────────────

  state_capitals: [
    'Montgomery', 'Juneau', 'Phoenix', 'Little Rock', 'Denver', 'Hartford',
    'Dover', 'Honolulu', 'Boise', 'Indianapolis', 'Des Moines', 'Topeka',
    'Frankfort', 'Baton Rouge', 'Augusta', 'Annapolis', 'Jefferson City',
    'Helena', 'Lincoln', 'Carson City', 'Concord', 'Trenton',
    'Santa Fe', 'Albany', 'Columbus', 'Oklahoma City', 'Salem',
    'Harrisburg', 'Providence', 'Columbia', 'Pierre', 'Nashville',
    'Salt Lake City', 'Montpelier', 'Richmond', 'Olympia',
    'Charleston', 'Madison', 'Cheyenne',
  ],

  // ── NASA Missions ─────────────────────────────────────────────────────────

  program_names: [
    'Pioneer', 'Ranger', 'Surveyor', 'Mariner', 'Viking', 'Voyager',
    'Magellan', 'Pathfinder', 'New Frontiers', 'Discovery', 'Constellation',
    'Commercial Crew', 'Living With a Star', 'Earth Observing System',
  ],

  astronaut_names: [
    'Michael Collins', 'Yuri Gagarin', 'Valentina Tereshkova', 'Scott Kelly',
    'Michael López-Alegría', 'Shannon Lucid', 'Sunita Williams',
    'Mark Kelly', 'Don Pettit', 'Bruce McCandless', 'Gus Grissom',
    'Wally Schirra', 'Gordon Cooper', 'Deke Slayton',
  ],

  spacecraft_names: [
    'Atlantis', 'Endeavour', 'Enterprise', 'Orion', 'Ares I', 'Saturn V',
    'Titan II', 'Falcon 9', 'New Shepard', 'Starliner', 'Dragon', 'Cygnus',
    'LEM', 'Friendship 7', 'Mercury Redstone',
  ],

  // ── Greek Mythology ───────────────────────────────────────────────────────

  roman_equivalents: [
    'Apollo', 'Diana', 'Minerva', 'Venus', 'Mars', 'Jupiter', 'Juno',
    'Mercury', 'Neptune', 'Pluto', 'Vulcan', 'Bacchus', 'Ceres',
    'Proserpina', 'Fortuna', 'Faunus', 'Pomona', 'Vertumnus',
  ],

  titan_names: [
    'Coeus', 'Crius', 'Mnemosyne', 'Phoebe', 'Tethys', 'Oceanus',
    'Iapetus', 'Cronus', 'Rhea', 'Themis', 'Hyperion',
    'Helios', 'Selene', 'Eos', 'Hecate',
  ],

  // ── World War II ──────────────────────────────────────────────────────────

  battle_names: [
    'Battle of Stalingrad', 'Battle of Midway', 'Battle of the Bulge',
    'Battle of Britain', 'Battle of Kursk', 'Battle of El Alamein',
    'D-Day (Normandy)', 'Battle of Guadalcanal', 'Operation Market Garden',
    'Battle of Iwo Jima', 'Battle of Okinawa', 'Battle of Monte Cassino',
    'Fall of Berlin', 'Battle of the Atlantic', 'Battle of France',
    'Operation Barbarossa', 'Battle of the Coral Sea', 'Battle of Leyte Gulf',
    'Battle of Crete', 'Battle of Singapore',
    // Ancient Rome battles (also uses battle_names key)
    'Battle of Cannae', 'Battle of Actium', 'Battle of Pharsalus',
    'Battle of Carrhae', 'Battle of the Teutoburg Forest',
    'Battle of Adrianople', 'Battle of the Milvian Bridge',
    // Ancient Greece battles
    'Battle of Marathon', 'Battle of Thermopylae', 'Battle of Salamis',
    'Battle of Plataea', 'Battle of Leuctra', 'Battle of Issus',
    'Battle of Gaugamela', 'Battle of Chaeronea',
    // Medieval battles
    'Battle of Hastings', 'Battle of Agincourt', 'Battle of Crécy',
    'Battle of Poitiers', 'Battle of Bouvines', 'Battle of Tours',
    'Battle of Legnano', 'Battle of Las Navas de Tolosa',
    'Battle of Bannockburn', 'Battle of Nicopolis',
  ],

  // ── Human Anatomy ─────────────────────────────────────────────────────────

  organ_names: [
    'liver', 'kidney', 'spleen', 'pancreas', 'thyroid', 'gallbladder',
    'adrenal gland', 'thymus', 'tonsils', 'prostate',
    'ovary', 'uterus', 'bladder', 'trachea', 'esophagus', 'stomach',
    'small intestine', 'large intestine', 'rectum', 'anus',
  ],

  // ── Ancient Rome ─────────────────────────────────────────────────────────

  city_place_names: [
    'Alexandria', 'Carthage', 'Athens', 'Corinth', 'Syracuse', 'Antioch',
    'Lugdunum', 'Londinium', 'Hispalis', 'Aquileia', 'Ravenna', 'Mediolanum',
    'Neapolis', 'Pompeii', 'Herculaneum', 'Capua', 'Brundisium', 'Massalia',
    'Genua', 'Arretium', 'Perusia', 'Narbo', 'Lugdunum Batavorum',
  ],

  text_work_names: [
    'De Rerum Natura', 'Metamorphoses', 'Histories', 'Germania',
    'Natural History', 'Satyricon', 'Confessions', 'Aeneid',
    'Odes of Horace', 'Tristia', 'Epistles', 'Pharsalia', 'Thebaid',
  ],

  emperor_names: [
    'Augustus', 'Tiberius', 'Caligula', 'Claudius', 'Nero', 'Galba',
    'Otho', 'Vitellius', 'Vespasian', 'Titus', 'Domitian', 'Nerva',
    'Trajan', 'Hadrian', 'Antoninus Pius', 'Marcus Aurelius', 'Commodus',
    'Pertinax', 'Caracalla', 'Diocletian', 'Constantine I', 'Julian',
    'Valentinian I', 'Theodosius I', 'Honorius', 'Romulus Augustulus',
  ],

  roman_god_names: [
    'Jupiter', 'Juno', 'Minerva', 'Mars', 'Venus', 'Mercury',
    'Neptune', 'Pluto', 'Ceres', 'Bacchus', 'Diana', 'Apollo',
    'Vulcan', 'Vesta', 'Janus', 'Saturn', 'Ops', 'Quirinus',
    'Fortuna', 'Bellona', 'Flora', 'Fauna',
  ],

  // ── Ancient Greece ────────────────────────────────────────────────────────

  city_state_names: [
    'Athens', 'Sparta', 'Corinth', 'Thebes', 'Argos', 'Megara',
    'Delphi', 'Olympia', 'Miletus', 'Ephesus', 'Pergamon', 'Rhodes',
    'Syracuse', 'Herakleia', 'Elis', 'Sikyon', 'Phleious',
    'Mantinea', 'Tegea', 'Eretria', 'Chalcis',
  ],

  // ── Famous Inventions ─────────────────────────────────────────────────────

  inventor_names: [
    'Nikola Tesla', 'James Watt', 'George Stephenson', 'Henry Ford',
    'Gottlieb Daimler', 'Guglielmo Marconi', 'Alexander Graham Bell',
    'Thomas Edison', 'John Logie Baird', 'George Eastman',
    'Willis Carrier', 'Percy Spencer', 'Chester Carlson',
    'John Bardeen', 'Walter Brattain', 'William Shockley',
  ],

  // ── Constellations ────────────────────────────────────────────────────────

  constellation_names: [
    'Orion', 'Ursa Major', 'Ursa Minor', 'Cassiopeia', 'Cygnus',
    'Leo', 'Scorpius', 'Sagittarius', 'Virgo', 'Aquarius',
    'Taurus', 'Gemini', 'Cancer', 'Libra', 'Capricornus', 'Pisces',
    'Aries', 'Canis Major', 'Canis Minor', 'Centaurus', 'Pegasus',
    'Perseus', 'Boötes', 'Lyra', 'Aquila', 'Corvus', 'Hydra',
    'Cepheus', 'Draco', 'Ophiuchus', 'Hercules', 'Andromeda',
  ],

  deep_sky_names: [
    'Andromeda Galaxy', 'Triangulum Galaxy', 'Whirlpool Galaxy',
    'Sombrero Galaxy', 'Pinwheel Galaxy', 'Messier 87', 'Centaurus A',
    'Crab Nebula', 'Eagle Nebula', 'Ring Nebula', 'Helix Nebula',
    'Lagoon Nebula', 'Orion Nebula', 'Omega Nebula', 'Rosette Nebula',
    'Pleiades', 'Hyades', 'Praesepe', 'Omega Centauri', 'Globular Cluster M13',
  ],

  // ── Egyptian Mythology ────────────────────────────────────────────────────

  god_names: [
    'Ra', 'Osiris', 'Isis', 'Horus', 'Seth', 'Anubis', 'Thoth',
    'Hathor', 'Sekhmet', 'Ptah', 'Amun', 'Nut', 'Geb', 'Shu',
    'Tefnut', 'Nephthys', 'Khnum', 'Sobek', 'Bastet', 'Nefertum',
  ],

  places_locations: [
    'Thebes', 'Memphis', 'Heliopolis', 'Abydos', 'Giza', 'Karnak',
    'Luxor', 'Alexandria', 'Amarna', 'Philae', 'Edfu', 'Dendera',
    'Abu Simbel', 'Saqqara', 'Dashur',
  ],

  symbols_objects: [
    'Ankh', 'Djed pillar', 'Was scepter', 'Uraeus', 'Scarab', 'Eye of Horus',
    'Crook and flail', 'Sistrum', 'Menat necklace', 'Shen ring',
    'Canopic jar', 'Book of the Dead', 'Papyrus scroll', 'Solar disk',
    'Double crown', 'Blue crown', 'Atef crown',
  ],

  // ── Famous Paintings ─────────────────────────────────────────────────────

  painting_names: [
    'The Starry Night', 'Girl with a Pearl Earring', 'The Birth of Venus',
    'The Last Supper', 'The Persistence of Memory', 'Water Lilies',
    'Sunflowers', 'A Sunday on La Grande Jatte', 'The Scream',
    'American Gothic', 'Grant Wood', 'Nighthawks', 'The Night Watch',
    'Las Meninas', 'The Garden of Earthly Delights', 'The Hay Wain',
    'Liberty Leading the People', 'Oath of the Horatii', 'Saturn Devouring His Son',
    'Third of May 1808', 'Whistler\'s Mother', 'Christina\'s World',
  ],

  movement_names: [
    'Baroque', 'Renaissance', 'Romanticism', 'Impressionism', 'Post-Impressionism',
    'Cubism', 'Pop Art', 'Realism', 'Art Nouveau', 'Surrealism', 'Abstract Expressionism',
    'Dadaism', 'Fauvism', 'Minimalism', 'Futurism', 'Symbolism', 'Neoclassicism',
    'Mannerism', 'Expressionism', 'Constructivism',
  ],

  date_periods: [
    '15th century', '16th century', '17th century', '18th century',
    '19th century', 'Early 20th century', 'Mid-20th century', 'Renaissance period',
    'Baroque period', 'Romantic era', 'Victorian era', 'Modern era',
  ],

  technique_terms: [
    'Sfumato', 'Chiaroscuro', 'Pointillism', 'Impasto', 'Fresco',
    'Tempera', 'Encaustic', 'Gouache', 'Watercolor wash', 'Glazing',
    'Scumbling', 'Grisaille', 'Verdaccio', 'Trompe-l\'œil', 'Intaglio',
    'Sgraffito', 'Hatching', 'Cross-hatching', 'Wet-on-wet',
  ],

  country_names: [
    'France', 'Italy', 'Spain', 'Netherlands', 'Germany', 'England',
    'Belgium', 'Austria', 'Russia', 'Japan', 'Mexico', 'Norway',
    'Denmark', 'Switzerland', 'United States', 'Poland', 'Czechia',
  ],

  // ── World Cuisines ────────────────────────────────────────────────────────

  ingredient_names: [
    'saffron', 'turmeric', 'cardamom', 'fenugreek', 'sumac', 'za\'atar',
    'harissa', 'gochujang', 'miso', 'dashi', 'tamarind', 'coconut milk',
    'fish sauce', 'oyster sauce', 'hoisin sauce', 'mirin', 'sake',
    'basmati rice', 'jasmine rice', 'arborio', 'durum wheat', 'polenta',
    'tahini', 'preserved lemon', 'rose water', 'annatto',
  ],

  // ── Medieval World ────────────────────────────────────────────────────────

  work_text_names: [
    'Beowulf', 'Canterbury Tales', 'Divine Comedy', 'Song of Roland',
    'El Cid', 'Nibelungenlied', 'Arthurian Legends', 'Magna Carta',
    'Summa Theologica', 'Decameron', 'Domesday Book', 'Book of Kells',
    'Alexiad', 'Opus Majus',
  ],

  battle_event_names: [
    'Battle of Hastings', 'Battle of Agincourt', 'Battle of Crécy',
    'Battle of Poitiers', 'Battle of Tours', 'Battle of Bannockburn',
    'Battle of Nicopolis', 'Siege of Constantinople 1453',
    'Fall of Acre', 'Battle of Bouvines', 'Battle of Lechfeld',
    'Battle of Las Navas de Tolosa', 'Reconquista',
  ],

  structure_names: [
    'Notre-Dame de Paris', 'Chartres Cathedral', 'Westminster Abbey',
    'Hagia Sophia', 'Castel del Monte', 'Alhambra', 'Carcassonne',
    'Mont-Saint-Michel', 'Tower of London', 'Cologne Cathedral',
    'Palazzo Vecchio', 'Krak des Chevaliers', 'Bodiam Castle',
    'Neuschwanstein Castle',
  ],

  scholar_names: [
    'Roger Bacon', 'Peter Abelard', 'Thomas Aquinas', 'Albertus Magnus',
    'Hildegard of Bingen', 'William of Ockham', 'John Duns Scotus',
    'Averroes (Ibn Rushd)', 'Maimonides', 'Ibn Khaldun', 'Francis of Assisi',
    'Bernard of Clairvaux', 'Anselm of Canterbury',
  ],

  // ── World Wonders ─────────────────────────────────────────────────────────

  landmark_names: [
    'Machu Picchu', 'Stonehenge', 'Angkor Wat', 'Chichen Itza', 'Colosseum',
    'Great Wall of China', 'Taj Mahal', 'Parthenon', 'Pyramids of Giza',
    'Petra', 'Christ the Redeemer', 'Eiffel Tower', 'Big Ben',
    'Sydney Opera House', 'Burj Khalifa', 'Golden Gate Bridge',
    'Great Barrier Reef', 'Amazon Rainforest',
  ],

  location_country: [
    'Peru', 'United Kingdom', 'Cambodia', 'Mexico', 'Italy', 'China',
    'India', 'Greece', 'Egypt', 'Jordan', 'Brazil', 'France', 'Australia',
    'Japan', 'UAE', 'United States', 'Morocco', 'Turkey', 'Nepal',
  ],

  // ── Dinosaurs ─────────────────────────────────────────────────────────────

  clade_names: [
    'Ornithischia', 'Saurischia', 'Pterosauria', 'Ankylosauria', 'Ceratopsia',
    'Hadrosauridae', 'Stegosauria', 'Pachycephalosauria', 'Sauropoda',
    'Theropoda', 'Marginocephalia', 'Thyreophora', 'Ornithopoda',
    'Spinosauridae', 'Dromaeosauridae',
  ],

  paleontologist_names: [
    'Mary Anning', 'Richard Owen', 'Othniel Charles Marsh', 'Edward Drinker Cope',
    'Henry Fairfield Osborn', 'Robert T. Bakker', 'Jack Horner', 'Paul Sereno',
    'Phil Currie', 'José Bonaparte', 'Fernando Novas', 'Dong Zhiming',
    'Xu Xing', 'Barnum Brown', 'Peter Dodson',
  ],

  // ── Music History ─────────────────────────────────────────────────────────

  instrument_names: [
    'harpsichord', 'lute', 'theorbo', 'sitar', 'tabla', 'hurdy-gurdy',
    'dulcimer', 'balalaika', 'koto', 'shamisen', 'erhu', 'sitar',
    'zither', 'bandoneon', 'concertina', 'flageolet', 'recorder',
    'cornett', 'serpent', 'shawm', 'rebec', 'vielle',
  ],

  company_names: [
    'Motown Records', 'Atlantic Records', 'Columbia Records', 'Apple Records',
    'Capitol Records', 'Decca Records', 'Chess Records', 'Stax Records',
    'Epic Records', 'Island Records', 'Elektra Records', 'Interscope Records',
    'Virgin Records', 'Polydor Records', 'Parlophone',
  ],

  person_names: [
    'Robert Moog', 'Leo Fender', 'Theobald Boehm', 'Laurens Hammond',
    'Les Paul', 'Heinrich Steinweg', 'Johann Christoph Denner', 'Yamaha Torakusu',
    'Adolphe Sax', 'Bartolomeo Cristofori', 'Antonio Stradivari',
    'Étienne Oehlert', 'Henry Distin', 'Charles Wheatstone', 'Johann Sebastian Bach',
  ],

  nationality_names: [
    'German', 'French', 'Austrian', 'Italian', 'Russian', 'Czech',
    'Hungarian', 'Norwegian', 'Finnish', 'Spanish', 'English', 'Dutch',
    'Polish', 'Belgian', 'Swedish', 'Danish', 'Irish', 'American',
  ],

  // ── Japanese N5 Grammar ───────────────────────────────────────────────────

  existence_pattern: [
    'があります', 'がありません', 'がいます', 'がいません',
    'にあります', 'にいます', 'はあります', 'はいます',
    'でいます', 'もあります', 'もいます', 'をいます',
    'がおります', 'がございます', 'がおりません',
  ],

  adjective_form: [
    'い', 'な', 'い形容詞', 'な形容詞', 'くない', 'ではない',
    'かった', 'ではなかった', 'に', 'く', 'さ', 'そう',
    'らしい', 'っぽい', 'がる',
  ],

};

// ---------------------------------------------------------------------------
// Helper: pick a bank key from pool id / label / format
// ---------------------------------------------------------------------------

function getBankKey(pool) {
  const id = pool.id?.toLowerCase() || '';
  const label = (pool.label || '').toLowerCase();
  const fmt = (pool.answerFormat || pool.format || '').toLowerCase();

  // Exact pool.id match first
  if (SYNTHETIC_BANKS[id]) return id;

  // Try label keywords
  const labelMap = [
    ['programming language', 'language_names'],
    ['language names', 'language_names'],
    ['algorithm', 'algorithm_names'],
    ['complexity', 'complexity_terms'],
    ['protocol', 'protocol_names'],
    ['mission names', 'mission_names'],
    ['space mission', 'mission_names'],
    ['spacecraft', 'spacecraft_names'],
    ['system facts', 'system_facts'],
    ['political party', 'party_names'],
    ['party names', 'party_names'],
    ['home state', 'home_states'],
    ['inauguration', null], // skip
    ['element symbol', 'element_symbols'],
    ['element categor', 'element_categories'],
    ['state capital', 'state_capitals'],
    ['program names', 'program_names'],
    ['astronaut', 'astronaut_names'],
    ['roman equivalent', 'roman_equivalents'],
    ['titan name', 'titan_names'],
    ['battle', 'battle_names'],
    ['organ name', 'organ_names'],
    ['organ_names', 'organ_names'],
    ['cities & places', 'city_place_names'],
    ['city_place', 'city_place_names'],
    ['city-state', 'city_state_names'],
    ['city state', 'city_state_names'],
    ['famous roman text', 'text_work_names'],
    ['works & texts', 'work_text_names'],
    ['text_work', 'text_work_names'],
    ['roman emperor', 'emperor_names'],
    ['emperor_names', 'emperor_names'],
    ['roman god', 'roman_god_names'],
    ['roman_god', 'roman_god_names'],
    ['constellation name', 'constellation_names'],
    ['deep sky', 'deep_sky_names'],
    ['god', 'god_names'],
    ['places & location', 'places_locations'],
    ['symbol', 'symbols_objects'],
    ['painting name', 'painting_names'],
    ['movement', 'movement_names'],
    ['date period', 'date_periods'],
    ['technique', 'technique_terms'],
    ['country name', 'country_names'],
    ['country_names', 'country_names'],
    ['ingredient', 'ingredient_names'],
    ['landmark', 'landmark_names'],
    ['location_country', 'location_country'],
    ['countries & region', 'location_country'],
    ['clade', 'clade_names'],
    ['paleontologist', 'paleontologist_names'],
    ['instrument', 'instrument_names'],
    ['record label', 'company_names'],
    ['company', 'company_names'],
    ['nationality', 'nationality_names'],
    ['person name', 'person_names'],
    ['structure', 'structure_names'],
    ['scholar', 'scholar_names'],
    ['inventor', 'inventor_names'],
    ['existence pattern', 'existence_pattern'],
    ['adjective form', 'adjective_form'],
  ];

  for (const [kw, bankKey] of labelMap) {
    if (label.includes(kw) || id.includes(kw.replace(/ /g, '_'))) {
      return bankKey; // null means skip
    }
  }

  return null; // no match
}

// ---------------------------------------------------------------------------
// Skip formats that are numeric (runtime-generated)
// ---------------------------------------------------------------------------
function isNumericPool(pool) {
  const fmt = (pool.answerFormat || pool.format || '').toLowerCase();
  const id = (pool.id || '').toLowerCase();
  if (fmt === 'bracket_numbers' || fmt === 'bracket_number') return true;
  if (fmt === 'number') return true;
  if (fmt === 'year') return true;
  if (id === 'bracket_numbers') return true;
  if (id === 'inauguration_years') return true;
  if (id === 'launch_years') return true;
  if (id === 'number') return true;
  if (id === 'year') return true;
  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const results = [];
let totalPoolsPadded = 0;
let totalSyntheticsAdded = 0;

for (const filename of manifest.decks) {
  const deckPath = path.join(DECKS_DIR, filename);
  const deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'));
  let deckModified = false;

  for (const pool of deck.answerTypePools || []) {
    const factCount = pool.factIds?.length || 0;
    const existingSynths = pool.syntheticDistractors || [];
    const total = factCount + existingSynths.length;

    if (total >= TARGET) continue;
    if (isNumericPool(pool)) {
      results.push({ deck: deck.id, pool: pool.id, skipped: 'numeric pool' });
      continue;
    }

    const needed = TARGET - total;
    const bankKey = getBankKey(pool);

    if (bankKey === null) {
      results.push({ deck: deck.id, pool: pool.id, skipped: 'numeric (inauguration/launch years)', total });
      continue;
    }

    if (!bankKey) {
      results.push({ deck: deck.id, pool: pool.id, skipped: `no bank found for id="${pool.id}" label="${pool.label}"`, total });
      continue;
    }

    const bank = SYNTHETIC_BANKS[bankKey];
    if (!bank) {
      results.push({ deck: deck.id, pool: pool.id, skipped: `bank key "${bankKey}" not found`, total });
      continue;
    }

    // Build exclusion set: existing synths + all correctAnswers from facts in this pool
    const excluded = new Set(existingSynths.map(s => s.toLowerCase().trim()));
    for (const factId of pool.factIds || []) {
      const fact = deck.facts.find(f => f.id === factId);
      if (fact?.correctAnswer) {
        excluded.add(fact.correctAnswer.toLowerCase().trim());
      }
    }

    const candidates = bank.filter(c => !excluded.has(c.toLowerCase().trim()));
    const picks = candidates.slice(0, needed);

    if (picks.length === 0) {
      results.push({ deck: deck.id, pool: pool.id, skipped: 'no unique candidates in bank', total });
      continue;
    }

    pool.syntheticDistractors = [...existingSynths, ...picks];
    deckModified = true;

    const newTotal = factCount + pool.syntheticDistractors.length;
    totalPoolsPadded++;
    totalSyntheticsAdded += picks.length;
    results.push({
      deck: deck.id,
      pool: pool.id,
      label: pool.label || pool.id,
      bankKey,
      before: total,
      added: picks.length,
      after: newTotal,
      picks,
    });
  }

  if (deckModified) {
    fs.writeFileSync(deckPath, JSON.stringify(deck, null, 2) + '\n', 'utf8');
  }
}

// ---------------------------------------------------------------------------
// Print summary table
// ---------------------------------------------------------------------------

console.log('\n======================================================');
console.log('  pad-small-pools.mjs — Summary');
console.log('======================================================\n');

const padded = results.filter(r => r.added !== undefined);
const skipped = results.filter(r => r.skipped);

if (padded.length === 0) {
  console.log('No pools required padding.');
} else {
  console.log('Padded pools:\n');
  const col = (s, n) => String(s).padEnd(n);
  console.log(col('Deck', 28) + col('Pool', 26) + col('Before', 8) + col('Added', 7) + col('After', 6));
  console.log('-'.repeat(80));
  for (const r of padded) {
    console.log(col(r.deck, 28) + col(r.pool, 26) + col(r.before, 8) + col(r.added, 7) + col(r.after, 6));
  }
}

if (skipped.length > 0) {
  console.log('\nSkipped pools:\n');
  for (const r of skipped) {
    console.log(`  ${r.deck} / ${r.pool} — ${r.skipped}`);
  }
}

console.log('\n------------------------------------------------------');
console.log(`  Pools padded      : ${totalPoolsPadded}`);
console.log(`  Synthetics added  : ${totalSyntheticsAdded}`);
console.log('------------------------------------------------------\n');
