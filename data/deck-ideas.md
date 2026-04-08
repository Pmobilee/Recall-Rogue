# Deck Ideas & Planning — Recall Rogue

**Purpose:** Master planning document for all curated deck content. Tracks pool architecture, chain themes, estimated fact counts, and cross-deck dependencies before any fact generation begins.

**Last Updated:** 2026-04-08

**Design Philosophy:**
- **Pool-first design:** Every deck starts by identifying answer type pools — semantically confusable groups of 5+ answers. Pool viability determines fact count, not the other way around. A domain is only writable if its pools hold up.
- **Composite deck architecture:** Facts live in exactly one source deck (their "home deck") but can be surfaced in composite decks that pull from multiple sources. See Section 2 for architecture details.
- **AP alignment:** Where applicable, eras and decks are mapped to AP course units to support the student market. This is a signal for prioritization and marketing, not a constraint on content.
- **Distractor safety:** All pools must be internally homogeneous enough for LLM-generated distractors to be plausible but wrong. A pool of "Egyptian pharaohs" is safe. A pool mixing pharaohs, gods, and cities is not.

---

## Section 1: World History Era Series

The World History Era Series is the backbone of the knowledge content library — 12 decks covering human history from early civilization to the modern world. These decks are designed to be standalone educational products AND the source material for composite AP-aligned decks.

Each era is documented below with full pool architecture, chain themes, and cross-deck linkage.

---

### Era 1: Ancient Mesopotamia & Egypt (3500–500 BCE)

**AP Alignment:** Pre-AP (feeds into AP World History Unit 1 background)
**Geographic Scope:** Tigris-Euphrates valley, Nile valley, Levant
**Estimated Facts:** 220–260
**Source Richness:** High (Wikipedia/Wikidata coverage excellent for major figures, structures, texts; thinner for minor rulers)
**Priority:** Tier 2 (High Demand — strong K-12 curriculum alignment)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | Mesopotamian Firsts | cuneiform, Sumer, Uruk, first cities, ziggurats, Epic of Gilgamesh | 35 |
| 1 | Hammurabi & Law | Code of Hammurabi, Babylon, eye-for-an-eye, social strata in law | 20 |
| 2 | Egyptian Pharaohs | Ramesses II, Thutmose III, Hatshepsut, Cleopatra VII, Akhenaten, Tutankhamun | 55 |
| 3 | Monuments & Engineering | Great Pyramid, Sphinx, Step Pyramid, Abu Simbel, Valley of the Kings | 30 |
| 4 | Religion & Afterlife | Ra, Osiris, Isis, Anubis, Book of the Dead, mummification, canopic jars | 40 |
| 5 | Writing & Knowledge | hieroglyphs, Rosetta Stone, cuneiform tablets, scribes, papyrus | 25 |
| 6 | Trade & Neighbors | Phoenicians, Assyrian Empire, Persian conquest of Egypt, Nubia/Kush | 30 |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| MESO-PHARAOH | name | Ramesses II, Thutmose III, Hatshepsut, Akhenaten, Tutankhamun, Cleopatra VII, Khufu, Seti I | 18 |
| MESO-RULER | name | Hammurabi, Sargon of Akkad, Nebuchadnezzar II, Tiglath-Pileser III, Cyrus the Great | 10 |
| MESO-GOD-EGYPT | name | Ra, Osiris, Isis, Anubis, Horus, Thoth, Hathor, Amun, Seth | 12 |
| MESO-GOD-MESOP | name | Marduk, Enlil, Ishtar/Inanna, Ea/Enki, Gilgamesh (hero-god), Shamash | 8 |
| MESO-DATE-DYNASTY | date/period | Old Kingdom (~2686 BCE), New Kingdom (~1550 BCE), Akkadian Empire (~2334 BCE), Ur III (~2112 BCE) | 10 |
| MESO-MONUMENT | place/structure | Great Pyramid of Giza, Sphinx, Step Pyramid of Djoser, Abu Simbel, Karnak Temple, Ziggurat of Ur | 10 |
| MESO-WRITING-SYS | term | cuneiform, hieroglyphics, Linear A, demotic, hieratic | 5 |
| MESO-CITY | place | Babylon, Uruk, Ur, Memphis, Thebes, Luxor, Nineveh, Akkad | 12 |
| MESO-TEXT | name | Epic of Gilgamesh, Code of Hammurabi, Book of the Dead, Pyramid Texts, Enuma Elish | 6 |

**Cross-Deck Links:**
- → AP World History (Unit 1 background — not a direct AP unit but covered in course intro)
- → Ancient Greece (cultural exchange via Persia; Alexander's conquest of Egypt)
- ↔ Art & Architecture domain (pyramid architecture, Egyptian art conventions, hieroglyphic art)
- ↔ Mythology domain ("Egyptian Mythology" composite deck draws from MESO-GOD-EGYPT pool)
- → Medieval World (Coptic Christianity roots in Egypt)

**Notes:** Sensitivity low. Sourcing excellent via Wikidata for rulers and monuments. Dates for early Sumerian kings are uncertain — use conservative "circa" language. Hatshepsut's gender and erasure from records is a rich contextual hook. The Akhenaten monotheism episode connects well to later religion chains. Existing WWII deck pipeline can serve as a technical template for the scribing workflow here.

---

### Era 2: Ancient Greece (800–146 BCE)

**AP Alignment:** Pre-AP (feeds into AP World History Unit 1 background)
**Geographic Scope:** Greek peninsula, Aegean islands, Asia Minor coast, Macedonian expansion to Persia/Egypt/India
**Estimated Facts:** 240–280
**Source Richness:** High (excellent Wikipedia/Wikidata coverage; primary sources available in translation)
**Priority:** Tier 1 (Launch — extremely high curriculum demand, broad familiarity lowers player onboarding friction)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | City-States: Athens vs Sparta | democracy vs oligarchy, agora, acropolis, helots, ephors, Battle of Thermopylae | 40 |
| 1 | Persian Wars | Marathon, Thermopylae, Salamis, Plataea, Xerxes, Leonidas, Miltiades | 30 |
| 2 | Golden Age of Athens | Pericles, Parthenon, philosophy, drama, Delian League, Thucydides | 35 |
| 3 | Greek Philosophy | Socrates, Plato, Aristotle, Sophists, Stoics, Epicureans, Skeptics | 40 |
| 4 | Alexander the Great | Philip II, Battle of Issus, Battle of Gaugamela, Alexandria, Hellenistic world, death at 32 | 40 |
| 5 | Greek Religion & Mythology | Olympian gods, Oracle at Delphi, religious festivals, Iliad/Odyssey | 35 |
| 6 | Olympics & Culture | ancient Olympics, theater, tragedy, comedy, Sophocles, Aristophanes, pottery | 30 |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| GRC-PHILOSOPHER | name | Socrates, Plato, Aristotle, Thales, Heraclitus, Pythagoras, Diogenes, Zeno, Epicurus | 14 |
| GRC-RULER-GENERAL | name | Alexander the Great, Philip II, Pericles, Leonidas, Themistocles, Cimon, Alcibiades | 12 |
| GRC-GOD | name | Zeus, Athena, Apollo, Ares, Aphrodite, Poseidon, Hera, Hermes, Dionysus, Demeter, Hephaestus, Artemis | 12 |
| GRC-BATTLE | name | Marathon, Thermopylae, Salamis, Plataea, Issus, Gaugamela, Chaeronea | 9 |
| GRC-CITY-STATE | place | Athens, Sparta, Corinth, Thebes, Macedon, Syracuse, Argos, Miletus | 10 |
| GRC-DATE | date | 490 BCE (Marathon), 480 BCE (Thermopylae/Salamis), 431 BCE (Peloponnesian War starts), 336 BCE (Philip II assassinated), 323 BCE (Alexander dies) | 8 |
| GRC-WORK-TEXT | name | Republic, Iliad, Odyssey, Nicomachean Ethics, The Birds, Oedipus Rex, Apology | 10 |
| GRC-STRUCTURE | name | Parthenon, Acropolis, agora, stadium at Olympia, Theater of Epidaurus | 7 |
| GRC-CONCEPT | term | democracy, oligarchy, ostracism, rhetoric, dialectic, polis, agora, symposium | 10 |

**Cross-Deck Links:**
- → AP World History (cultural diffusion via Hellenistic spread)
- → Ancient Rome (Roman adoption of Greek culture, gods, philosophy)
- ↔ Mythology domain ("Greek Mythology" composite deck — shares GRC-GOD pool heavily)
- ↔ Philosophy domain (Socrates/Plato/Aristotle anchor any philosophy deck)
- ↔ Art & Architecture domain (Parthenon, sculpture, pottery)
- → Ancient China & India (contemporaneous Axial Age — Buddha, Confucius, Greek philosophers all ~500 BCE)

**Notes:** The Axial Age (~800–200 BCE) connection — Greek philosophy, Buddhism, Confucianism, Zoroastrianism all emerging simultaneously — is a powerful cross-deck composite hook. Alexander's campaign creates a natural narrative bridge to Ancient Egypt (Era 1) and Ancient China & India (Era 4). Greek mythology is SO large it warrants its own dedicated sub-deck; the Era 2 mythology chain covers just the basics needed for historical context. Flag the Axial Age composite concept for Section 2.

---

### Era 3: Ancient Rome (753 BCE–476 CE)

**AP Alignment:** Pre-AP (feeds into AP World History Unit 1 background)
**Geographic Scope:** Italian peninsula, Mediterranean basin, North Africa, Near East, Britain to Mesopotamia at peak
**Estimated Facts:** 280–320
**Source Richness:** High (excellent Wikipedia/Wikidata for emperors, battles, structures; primary sources in Latin widely translated)
**Priority:** Tier 1 (Launch — highest curriculum visibility of any ancient era in Western education)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | Republic to Empire | SPQR, Senate, consuls, tribunes, Gracchi reforms, Social War, transition to Empire | 35 |
| 1 | Julius Caesar | Gallic Wars, Crossing the Rubicon, First Triumvirate, assassination (Ides of March), Cleopatra | 30 |
| 2 | Augustus & the Principate | Octavian, Battle of Actium, Pax Romana, Virgil's Aeneid, administrative reforms | 30 |
| 3 | The Good Emperors & the Bad | Caligula, Nero, Vespasian, Trajan, Hadrian, Marcus Aurelius, Commodus | 40 |
| 4 | Punic Wars | Carthage, Hannibal, Battle of Cannae, Scipio Africanus, "Carthago delenda est" | 25 |
| 5 | Engineering & Infrastructure | Roman roads, aqueducts, Colosseum, Pantheon, concrete, Hadrian's Wall | 30 |
| 6 | Rise of Christianity | Jesus, Paul of Tarsus, Roman persecution, Constantine's conversion, Edict of Milan, Council of Nicaea | 35 |
| 7 | Fall of the Western Empire | Barbarian invasions, Visigoths, Vandals, Attila the Hun, 476 CE, Odoacer | 25 |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| ROM-EMPEROR | name | Julius Caesar, Augustus, Tiberius, Caligula, Claudius, Nero, Vespasian, Titus, Trajan, Hadrian, Marcus Aurelius, Commodus, Constantine, Diocletian | 18 |
| ROM-GENERAL-POLITICIAN | name | Scipio Africanus, Hannibal, Sulla, Marius, Pompey, Cicero, Brutus, Marc Antony, Crassus | 12 |
| ROM-GOD | name | Jupiter, Mars, Venus, Minerva, Juno, Neptune, Mercury, Diana, Bacchus, Saturn | 10 |
| ROM-BATTLE | name | Cannae, Zama, Pharsalus, Actium, Battle of Teutoburg Forest, Battle of Milvian Bridge | 8 |
| ROM-STRUCTURE | name | Colosseum, Pantheon, Circus Maximus, Forum Romanum, Hadrian's Wall, aqueduct Pont du Gard | 10 |
| ROM-DATE | date | 509 BCE (Republic founded), 264 BCE (First Punic War), 44 BCE (Caesar assassinated), 27 BCE (Augustus first emperor), 79 CE (Vesuvius/Pompeii), 313 CE (Edict of Milan), 476 CE (fall of West) | 10 |
| ROM-POLITICAL-TERM | term | Senate, consul, tribune, praetor, dictator, legion, plebeian, patrician, SPQR | 12 |
| ROM-TEXT-WORK | name | Aeneid, Commentarii de Bello Gallico, Res Gestae, The Republic (Cicero), Meditations (Marcus Aurelius) | 7 |

**Cross-Deck Links:**
- → Medieval World (Eastern Roman/Byzantine Empire continues after 476 CE)
- → Ancient Greece (Roman absorption of Greek culture — "Graecia capta ferum victorem cepit")
- ↔ Christianity/Religion domain (Rome as crucible and persecutor, then adopter, of Christianity)
- ↔ Art & Architecture domain (Roman architecture, sculpture, mosaics)
- → Age of Exploration (Roman legal and administrative concepts in European colonial law)

**Notes:** Julius Caesar's chain is dense and highly engaging — consider whether it warrants a standalone "Julius Caesar" mini-deck eventually. The Punic Wars are narratively rich (Hannibal crossing the Alps). Roman engineering is a natural STEM hook. Dates: be careful — "BC/BCE" confusion is common for students; clear labeling essential. The 476 CE fall date is a convention, not a clean historical break — good opportunity for nuanced question writing.

---

### Era 4: Ancient China & India (2000 BCE–500 CE)

**AP Alignment:** Pre-AP (feeds into AP World History Units 1-2)
**Geographic Scope:** Yellow River and Yangtze valleys, Indian subcontinent (Indus Valley through Gupta), overland Silk Road
**Estimated Facts:** 250–300
**Source Richness:** Medium-High (Wikidata strong for dynasties and emperors; Indian chronology murkier, Buddha's dates debated; excellent for monuments and texts)
**Priority:** Tier 1 (Launch — AP World History coverage of East/South Asia is mandated; strong gap in current library)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | Chinese Dynasties I: Shang to Han | oracle bones, Zhou feudalism, Warring States, Qin unification, Han consolidation | 45 |
| 1 | Chinese Engineering & Culture | Great Wall, Terracotta Army, Grand Canal, papermaking, compass, silk production | 35 |
| 2 | Chinese Philosophy | Confucius/Analects, Laozi/Tao Te Ching, Legalism, Han Fei, Mencius, Mozi | 35 |
| 3 | India: Indus Valley & Early Kingdoms | Mohenjo-daro, Harappa, Vedic period, caste system (varna), Sanskrit, Ramayana/Mahabharata | 35 |
| 4 | Maurya & Gupta Empires | Chandragupta Maurya, Ashoka's edicts, Buddhism as state religion, Gupta golden age, mathematics, zero | 35 |
| 5 | Buddhism & Its Spread | Siddhartha Gautama, Four Noble Truths, Eightfold Path, stupas, Ashoka's missions, spread to East Asia | 40 |
| 6 | Silk Road Origins | trade routes, Han-Rome indirect contact, spread of Buddhism, goods traded, Parthian middlemen | 30 |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| CIN-DYNASTY | name | Shang, Zhou, Qin, Han, Xin, Maurya, Gupta | 8 |
| CIN-RULER-EMPEROR | name | Qin Shi Huang, Emperor Wu (Han), Chandragupta Maurya, Ashoka, Chandragupta II, Wudi | 10 |
| CIN-PHILOSOPHER | name | Confucius, Laozi, Mencius, Han Fei, Mozi, Xunzi, Zhuangzi | 10 |
| CIN-TEXT | name | Analects, Tao Te Ching, Art of War, I Ching, Vedas, Upanishads, Ramayana, Mahabharata, Arthashastra | 12 |
| CIN-INVENTION | term | paper, printing, compass, gunpowder, silk, cast iron, kite, porcelain | 10 |
| CIN-MONUMENT | name/place | Great Wall, Terracotta Army, Mohenjo-daro, Sanchi Stupa, Ajanta Caves | 8 |
| CIN-BUDDHISM-CONCEPT | term | Four Noble Truths, Eightfold Path, Nirvana, Dharma, Karma, Sangha, stupa, Bodhisattva, Theravada, Mahayana | 12 |
| CIN-DATE | date | 221 BCE (Qin unification), 206 BCE (Han dynasty), ~563 BCE (Buddha born, traditional), 272 BCE (Ashoka becomes emperor), 320 CE (Gupta dynasty) | 8 |
| CIN-CITY-SITE | place | Xi'an, Luoyang, Pataliputra, Taxila, Mohenjo-daro, Harappa | 8 |

**Cross-Deck Links:**
- → Medieval World (Tang/Song dynasties; Buddhism into Japan/Korea via China)
- → Mongols, Mali & Global Tapestry (Silk Road continuity; Mongol conquest of China)
- → Land-Based Empires (Ming China; Mughal India as successor to Gupta traditions)
- ↔ Mythology/Religion domain ("Hindu Mythology" composite heavily overlaps with Vedic chain)
- ↔ Philosophy domain (Confucianism, Taoism, Buddhism as philosophical systems)
- → Ancient Greece (Axial Age composite — contemporaneous Socrates/Confucius/Buddha)

**Notes:** Buddha's birth date is genuinely debated (~563 BCE traditional, ~480 BCE revisionist) — use "circa" and note in explanation. Indian chronology before Maurya is poorly anchored; stick to Ashoka and later where dates are firm. The Axial Age connection (Confucius, Buddha, and Socrates all ~500 BCE) is a killer composite deck hook. Chinese invention questions are extremely high-engagement for students. Separate Chinese mythology into its own sub-deck later — too large to fold in here cleanly.

---

### Era 5: Medieval World (500–1200 CE)

**AP Alignment:** Pre-AP / AP World History Unit 1 (post-classical period)
**Geographic Scope:** Europe, Byzantine Empire, Islamic caliphates, East Africa, West Africa (Ghana Kingdom), East Asia (Tang/Song China, Heian Japan)
**Estimated Facts:** 260–300
**Source Richness:** Medium-High (Byzantine and Islamic periods well-documented; West African kingdoms thinner; Viking/Norse excellent)
**Priority:** Tier 2 (High Demand — medieval Europe is perennial student interest; Islamic Golden Age underrepresented in Western education)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | Byzantine Empire | Justinian, Theodora, Corpus Juris Civilis, Hagia Sophia, Greek Fire, fall to Ottomans (1453) | 35 |
| 1 | Islamic Golden Age | House of Wisdom, Al-Khwarizmi (algebra), Ibn Sina (medicine), Al-Biruni, Quran, caliphates | 40 |
| 2 | Charlemagne & Feudalism | Frankish Empire, coronation 800 CE, feudal hierarchy, manorialism, serfs vs nobles | 30 |
| 3 | Vikings | Leif Eriksson, longships, Vinland, Norse gods, raids, Varangian Guard, Rus | 35 |
| 4 | The Crusades | Pope Urban II, First Crusade, Jerusalem, Saladin, Richard I, Children's Crusade, Fourth Crusade (Constantinople) | 35 |
| 5 | Tang & Song China | paper money, movable type printing, compass refinement, gunpowder weapons, scholar-gentry | 30 |
| 6 | Ghana & Sub-Saharan Africa | Kingdom of Ghana, trans-Saharan gold-salt trade, Timbuktu beginnings, Swahili coast | 25 |
| 7 | Japan & Korea | Heian period, samurai, bushido, Taika Reform, Silla unification of Korea | 25 |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| MED-RULER | name | Justinian I, Charlemagne, Saladin, Richard I "Lionheart", Alfred the Great, William the Conqueror, Eleanor of Aquitaine, Empress Theodora | 14 |
| MED-SCHOLAR | name | Al-Khwarizmi, Ibn Sina (Avicenna), Ibn Rushd (Averroes), Al-Biruni, Al-Razi, Maimonides | 10 |
| MED-BATTLE | name | Battle of Tours (732), Battle of Hastings (1066), Battle of Hattin (1187), Siege of Jerusalem (1099) | 7 |
| MED-DATE | date | 622 CE (Hijra/Islamic calendar begins), 732 CE (Tours), 800 CE (Charlemagne crowned), 1066 CE (Hastings), 1095 CE (First Crusade called) | 8 |
| MED-CONCEPT | term | feudalism, manorialism, jihad, caliphate, Sharia, chivalry, vassal, serf, simony, investiture | 14 |
| MED-STRUCTURE | name | Hagia Sophia, Notre-Dame (construction starts), Alhambra (construction starts), Durham Cathedral | 6 |
| MED-DYNASTY-KINGDOM | name | Abbasid Caliphate, Umayyad Caliphate, Carolingian dynasty, Holy Roman Empire, Kingdom of Ghana, Tang dynasty, Heian Japan | 10 |
| MED-NORSE | name/term | Odin, Thor, Valhalla, Leif Eriksson, Vinland, longship, Thing (assembly), skald | 10 |

**Cross-Deck Links:**
- → Ancient Rome (Byzantine Empire as Eastern Roman continuation)
- → Ancient China & India (Tang dynasty as successor to Han achievements)
- → Mongols, Mali & Global Tapestry (Islamic caliphates weakened by Mongol invasion 1258)
- ↔ Mythology domain ("Norse Mythology" composite heavily overlaps with MED-NORSE pool)
- ↔ Art & Architecture domain (Gothic cathedrals, Byzantine mosaic art, Islamic geometric art)
- → Revolutions & Enlightenment (Crusades as context for later European-Islamic tensions)

**Notes:** The Islamic Golden Age chain is chronically underrepresented in Western curricula — high educational value and low player familiarity makes this a strong engagement hook. Viking chain is extremely high engagement. Crusades require sensitivity — frame as historical events, not moral endorsements; note both Christian and Muslim perspectives. Ghana Kingdom chain establishes African historical agency before the Mali Empire (Era 6) — important narrative setup. The term "Medieval" is Eurocentric; consider sub-branding as "Post-Classical World" for AP alignment.

---

### Era 6: Mongols, Mali & the Global Tapestry (1200–1450)

**AP Alignment:** AP World History Units 1–2
**Geographic Scope:** Eurasian steppe to China/Persia/Europe (Mongols), West Africa, Southeast Asia, Indian Ocean trade network, Americas (Aztec/Inca beginnings)
**Estimated Facts:** 200–240
**Source Richness:** Medium (Mongol period well-documented; Mali Empire good via Ibn Battuta; pre-Columbian Americas thinner in Wikidata)
**Priority:** Tier 1 (Launch — directly AP-tested; Mansa Musa is a breakout student favorite; Mongols are high-engagement)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | Genghis Khan & the Mongol Empire | kumiss-drinking, steppe tactics, kurultai, Pax Mongolica, Silk Road revival, Destruction of Baghdad 1258 | 40 |
| 1 | Mongol Successor States | Kublai Khan/Yuan dynasty, Ilkhanate, Golden Horde, Chagatai Khanate | 30 |
| 2 | Mali Empire & Mansa Musa | 1324 Hajj, gold wealth, Timbuktu, Sundiata Keita, griots, trans-Saharan trade | 35 |
| 3 | Black Death & Its Consequences | bubonic plague, fleas/rats, depopulation, flagellants, Jewish scapegoating, labor shortages | 30 |
| 4 | Indian Ocean & Trade Networks | dhow ships, monsoon winds, Arab-Swahili trade, Chinese porcelain in Africa, Ibn Battuta's travels | 30 |
| 5 | Americas: Aztec & Inca Foundations | Aztec founding (Tenochtitlan 1325), Inca expansion beginnings, Pachacuti, quipu, human sacrifice context | 30 |
| 6 | Spread of World Religions | Islam in sub-Saharan Africa, Buddhism in SE Asia, spread of Christianity via missionaries | 25 |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| MON-LEADER | name | Genghis Khan, Ögedei Khan, Kublai Khan, Hulagu Khan, Tamerlane, Sundiata Keita, Mansa Musa, Pachacuti | 12 |
| MON-EMPIRE-STATE | name | Mongol Empire, Yuan dynasty, Ilkhanate, Golden Horde, Mali Empire, Aztec Empire, Inca Empire | 9 |
| MON-DATE | date | 1206 (Genghis Khan proclaimed), 1258 (Baghdad destroyed), 1324 (Mansa Musa's Hajj), 1325 (Tenochtitlan founded), 1347 (Black Death reaches Europe) | 8 |
| MON-TRADE-CONCEPT | term | Pax Mongolica, Silk Road, trans-Saharan trade, Indian Ocean trade, caravan, dhow, monsoon, griots | 12 |
| MON-RELIGION-SPREAD | term | Sunni Islam, Shia Islam, Sufism, Theravada Buddhism, Zen Buddhism, Nestorian Christianity | 8 |
| MON-PLACE | place | Karakorum, Timbuktu, Samarkand, Malacca, Tenochtitlan, Cuzco, Calicut | 10 |
| MON-TRAVELER | name | Marco Polo, Ibn Battuta, Rabban Sauma, Zheng He (early voyages) | 5 |

**Cross-Deck Links:**
- → Medieval World (Mongol destruction of Abbasid Caliphate as endpoint)
- → Land-Based Empires (Ottoman, Safavid, Mughal — all emerge in Mongol aftermath)
- → Age of Exploration (European motivation for sea routes = avoiding Mongol/Ottoman-controlled land routes)
- → WWII deck — no direct link (different era)
- ↔ Geography domain (Silk Road geography, Indian Ocean geography)
- ↔ Art & Architecture domain (Mongol-influenced Persian miniature painting; Timbuktu manuscripts)

**Notes:** Mansa Musa's 1324 Hajj and its gold-dumping effect on Mediterranean economies is one of the most compelling economic history stories available — lean into it. The Black Death chain connects to biology/science domain tangentially. Americas section here is intentionally thin — the full Aztec/Inca story belongs in Era 8 (Exploration & Colonialism) when European contact gives us richer Wikidata sourcing. Zheng He's voyages (1405–1433) technically fall in Era 7 but are introduced here as context.

---

### Era 7: Land-Based Empires (1450–1750)

**AP Alignment:** AP World History Unit 3
**Geographic Scope:** Ottoman Empire (Anatolia to North Africa/SE Europe), Safavid Persia, Mughal India, Ming/Qing China, Tokugawa Japan, Russian Empire expansion
**Estimated Facts:** 230–270
**Source Richness:** High (all five empires well-documented on Wikipedia/Wikidata; primary sources available for Mughal and Ottoman courts)
**Priority:** Tier 1 (Launch — directly AP Unit 3 tested; "gunpowder empires" concept is a signature AP World topic)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | Ottoman Empire | Mehmed II (conquest of Constantinople 1453), Suleiman the Magnificent, janissaries, millet system, devshirme | 40 |
| 1 | Safavid Persia | Shah Abbas I, Shia Islam as state religion, Isfahan, rivalry with Ottomans, Persian miniature art | 30 |
| 2 | Mughal India | Babur, Akbar the Great, Taj Mahal, Aurangzeb, Din-i-Ilahi, Akbar's religious tolerance | 40 |
| 3 | Ming & Qing China | Forbidden City, Zheng He voyages, Great Wall expansion, Manchu conquest, Qing dynasty, Canton system | 40 |
| 4 | Tokugawa Japan | Edo period, sakoku (closed country), shogunate, samurai class, Daimyo, kabuki theater | 30 |
| 5 | Russian Expansion | Ivan the Terrible, Time of Troubles, Peter the Great, Westernization, Cossacks, expansion into Siberia | 30 |
| 6 | Gunpowder & Military Revolution | cannons, muskets, centralized armies, how gunpowder empires replaced mounted steppe warriors | 25 |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| LBE-RULER | name | Mehmed II, Suleiman the Magnificent, Shah Abbas I, Babur, Akbar the Great, Shah Jahan, Aurangzeb, Yongle Emperor, Kangxi Emperor, Ivan the Terrible, Peter the Great, Tokugawa Ieyasu | 16 |
| LBE-EMPIRE | name | Ottoman Empire, Safavid Empire, Mughal Empire, Ming dynasty, Qing dynasty, Tokugawa Shogunate, Russian Empire | 8 |
| LBE-STRUCTURE | name | Taj Mahal, Hagia Sophia (converted), Topkapi Palace, Forbidden City, St. Basil's Cathedral, Isfahan's Shah Mosque | 10 |
| LBE-DATE | date | 1453 (Constantinople falls), 1526 (Mughal Empire founded/Battle of Panipat), 1571 (Battle of Lepanto), 1644 (Qing dynasty), 1682 (Peter the Great becomes tsar) | 8 |
| LBE-CONCEPT | term | devshirme, millet system, janissary, sakoku, shogunate, daimyo, haiku, Shia vs Sunni split, Din-i-Ilahi | 14 |
| LBE-PLACE | place | Constantinople/Istanbul, Isfahan, Agra, Beijing, Edo (Tokyo), Moscow, St. Petersburg | 10 |
| LBE-BATTLE | name | Battle of Panipat (1526), Battle of Lepanto (1571), Battle of Chaldiran (1514), Battle of Sekigahara (1600) | 7 |

**Cross-Deck Links:**
- → Mongols, Mali & Global Tapestry (all five empires emerge in Mongol political vacuum)
- → Age of Exploration (Ottoman control of land routes = direct motivation for European sea exploration)
- → Revolutions & Enlightenment (Mughal decline → British colonialism; Ottoman decline → nationalism)
- ↔ Art & Architecture domain (Taj Mahal, Topkapi, Forbidden City, Persian miniature, Ottoman tile work)
- ↔ Mythology/Religion domain (Ottoman-Safavid Sunni/Shia conflict; Akbar's syncretic Din-i-Ilahi)

**Notes:** The "gunpowder empires" framing is a powerful AP World concept but contested by historians — note it in explanations. Zheng He's voyages (1405–1433) properly belong in this era and provide excellent contrast with European exploration (why didn't China colonize?). Akbar's religious tolerance chain is a high-value humanistic hook. The Sunni/Shia Ottoman-Safavid conflict chain has contemporary relevance — handle with balanced framing. Peter the Great's Westernization is a natural bridge to Era 9 (Revolutions & Enlightenment).

---

### Era 8: Age of Exploration & Colonialism (1450–1750)

**AP Alignment:** AP World History Unit 4
**Geographic Scope:** Atlantic Ocean, Caribbean, Americas (North/South/Central), Sub-Saharan Africa (slave trade), South/Southeast Asia (spice trade), Pacific
**Estimated Facts:** 250–290
**Source Richness:** High (explorers, dates, and voyages excellent in Wikidata; Atlantic slave trade documented; Aztec/Inca conquest well-sourced)
**Priority:** Tier 1 (Launch — directly AP Unit 4 tested; Columbus/Magellan/Cortés are high-recognition hooks; strong overlap with existing US Presidents deck audience)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | Age of Exploration | Columbus (1492), Vasco da Gama, Magellan (circumnavigation), Cabot, Cartier, Drake | 40 |
| 1 | Spanish Conquistadors | Cortés vs Aztec, Pizarro vs Inca, encomienda, Bartolomé de las Casas, smallpox as weapon | 35 |
| 2 | Columbian Exchange | tomatoes/potatoes to Europe, horses/cattle to Americas, smallpox/measles, tobacco, sugar, cotton | 30 |
| 3 | Atlantic Slave Trade | Portuguese origins, Middle Passage, triangular trade, Elmina, demographics of African diaspora | 35 |
| 4 | Colonial Empires | Spanish viceroyalties, Portuguese Brazil, British/French/Dutch competition, plantation economies | 30 |
| 5 | Aztec & Inca at Contact | Moctezuma II, Tenochtitlan, Pachacuti, Huayna Capac, Machu Picchu, calendar systems | 35 |
| 6 | Mercantilism & Trade Companies | VOC (Dutch), British East India Company, mercantilist theory, bullionism, spice trade | 30 |
| 7 | Resistance & Survival | Maroon communities, Pueblo Revolt, Tupac Amaru I, survival of indigenous cultures | 20 |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| EXP-EXPLORER | name | Christopher Columbus, Vasco da Gama, Ferdinand Magellan, John Cabot, Jacques Cartier, Francis Drake, Amerigo Vespucci, Hernán Cortés, Francisco Pizarro | 14 |
| EXP-DATE | date | 1492 (Columbus reaches Caribbean), 1498 (Vasco da Gama reaches India), 1519 (Magellan departs), 1521 (Tenochtitlan falls), 1533 (Inca Empire falls) | 10 |
| EXP-RULER-LEADER | name | Moctezuma II, Pachacuti, Huayna Capac, Atahualpa, Isabella I of Castile, Prince Henry the Navigator | 10 |
| EXP-COLUMBIAN-EXCHANGE | term | tomato, potato, maize, sugar, tobacco, smallpox, measles, horse, cattle, chocolate | 14 |
| EXP-TRADE-COMPANY | name | Dutch East India Company (VOC), British East India Company, Hudson's Bay Company | 5 |
| EXP-PLACE | place | Tenochtitlan, Cuzco, Machu Picchu, Elmina, Potosí, Goa, Malacca, Hispaniola | 12 |
| EXP-CONCEPT | term | encomienda, mercantilism, triangular trade, Middle Passage, conquistador, viceroy, bullionism, Treaty of Tordesillas | 12 |
| EXP-GOODS | term | spices (cloves/nutmeg/pepper), silk, silver, sugar, tobacco, indigo, cotton, fur | 10 |

**Cross-Deck Links:**
- → Land-Based Empires (Ottoman control of Silk Road = motivation for sea routes)
- → Revolutions & Enlightenment (colonial wealth funds Enlightenment; slave trade fuels abolition movement)
- ↔ Geography domain (maps of exploration routes, trade winds, geographic features of colonial territories)
- ↔ Art & Architecture domain (colonial architecture — blending of European and indigenous styles)
- → Imperialism & Industrialization (plantation system → industrial-scale agriculture → industrialization)
- → US Presidents deck (early American colonial period overlaps)

**Notes:** Atlantic slave trade chain requires careful, respectful framing — center the humanity and resistance of enslaved people, not just the mechanics of trade. The Columbian Exchange is one of the most testable and intellectually rich topics in AP World — strong pool. The "why did Europe rather than China expand?" question (connecting to Zheng He's Era 7 voyages) is a great higher-order thinking hook. Existing WWII deck's distractor generation pipeline is a direct template for this era.

---

### Era 9: Revolutions & Enlightenment (1750–1900)

**AP Alignment:** AP World History Unit 5
**Geographic Scope:** Western Europe (France, Britain), North America, Caribbean (Haiti), Latin America, global impact of industrial and political transformation
**Estimated Facts:** 260–300
**Source Richness:** High (excellent Wikidata/Wikipedia for all major figures, dates, documents; primary sources widely available in translation)
**Priority:** Tier 1 (Launch — American and French Revolutions are among the most recognized events in world history; strong overlap with AP US History audience)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | Enlightenment Thinkers | Locke (natural rights), Voltaire (religious tolerance), Rousseau (social contract), Montesquieu (separation of powers), Wollstonecraft, Kant | 40 |
| 1 | American Revolution | Boston Tea Party, Declaration of Independence (1776), Washington, Yorktown, Constitution, Bill of Rights | 35 |
| 2 | French Revolution | storming of the Bastille, Declaration of the Rights of Man, Reign of Terror, Robespierre, Napoleon's rise | 40 |
| 3 | Haitian Revolution | Toussaint Louverture, Jean-Jacques Dessalines, first Black republic (1804), impact on US/France | 25 |
| 4 | Latin American Independence | Simón Bolívar, San Martín, Miguel Hidalgo, O'Higgins, Congress of Vienna aftermath | 30 |
| 5 | Industrial Revolution | textile mills, steam engine (Watt), cotton gin, urbanization, child labor, Luddites | 40 |
| 6 | Abolition Movements | William Wilberforce, Frederick Douglass, Harriet Tubman, Underground Railroad, 13th Amendment, British Slavery Abolition Act 1833 | 35 |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| REV-THINKER | name | John Locke, Voltaire, Rousseau, Montesquieu, Mary Wollstonecraft, Immanuel Kant, Adam Smith, Thomas Paine | 12 |
| REV-LEADER | name | George Washington, Thomas Jefferson, Benjamin Franklin, Robespierre, Napoleon Bonaparte, Toussaint Louverture, Jean-Jacques Dessalines, Simón Bolívar, San Martín, Miguel Hidalgo | 16 |
| REV-DATE | date | 1688 (Glorious Revolution), 1776 (Declaration of Independence), 1789 (Bastille stormed), 1791 (Haitian Revolution begins), 1804 (Haiti independent), 1815 (Napoleon defeated at Waterloo) | 10 |
| REV-DOCUMENT | name | Declaration of Independence, Declaration of the Rights of Man, U.S. Constitution, Magna Carta (1215, background), Common Sense (Paine), A Vindication of the Rights of Woman | 8 |
| REV-INVENTION | name/term | steam engine, spinning jenny, power loom, cotton gin, locomotive, telegraph | 8 |
| REV-CONCEPT | term | natural rights, social contract, separation of powers, popular sovereignty, laissez-faire, mercantilism (decline), abolition, suffrage | 14 |
| REV-PLACE | place | Philadelphia, Paris, Versailles, Port-au-Prince, Caracas, Manchester, Birmingham, Boston | 10 |
| REV-BATTLE-EVENT | name | Battle of Bunker Hill, Storming of the Bastille, Reign of Terror, Battle of Waterloo, Battle of Boyacá | 8 |

**Cross-Deck Links:**
- → Age of Exploration (colonial grievances fuel American/Latin American revolutions; slave trade fuels abolition)
- → Imperialism & Industrialization (Industrial Revolution here → Era 10 full industrialization; nationalist ideas spread)
- → Cold War to Modern World (Enlightenment ideas of rights and democracy continue through 20th century)
- → US Presidents deck (Washington through early republic presidents directly connected)
- ↔ Philosophy domain (Locke, Rousseau, Kant as philosophers)
- ↔ Art & Architecture domain (Neoclassical art and architecture as visual expression of Enlightenment values)

**Notes:** Napoleon is narratively enormous — could anchor his own mini-deck. For this era, focus on his role as inheritor/exporter of Revolutionary ideals vs. authoritarian reversal. The Haitian Revolution is chronically under-taught in Western curricula; it's the only successful slave revolt leading to an independent nation — high educational value. Wollstonecraft is essential for gender representation in Enlightenment chain. Industrial Revolution pool connects to modern economics discussions.

---

### Era 10: Imperialism & Industrialization (1750–1900)

**AP Alignment:** AP World History Unit 6
**Geographic Scope:** Sub-Saharan Africa (Scramble for Africa), South/East Asia (Opium Wars, Raj, Meiji), Latin America (informal imperialism), global labor movements
**Estimated Facts:** 220–260
**Source Richness:** Medium-High (Berlin Conference, Opium Wars, Meiji well-documented; some African resistance movements thinner in Wikidata)
**Priority:** Tier 2 (High Demand — directly AP Unit 6 tested; completes the arc to WWI)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | Scramble for Africa | Berlin Conference 1884, Leopold II in Congo, British in East Africa, French West Africa, Zulu resistance, Menelik II/Ethiopia | 40 |
| 1 | Opium Wars & Chinese Decline | First/Second Opium War, Treaty of Nanjing, unequal treaties, extraterritoriality, Taiping Rebellion, Hong Kong | 35 |
| 2 | British Raj in India | Sepoy Rebellion 1857, Queen Victoria as Empress of India, railroads, drain of wealth theory, Indian National Congress | 35 |
| 3 | Meiji Restoration | 1868 Meiji Restoration, Commodore Perry, industrialization, Constitution of 1889, Sino-Japanese War | 35 |
| 4 | Nationalism & Unification | German unification (Bismarck), Italian unification (Garibaldi/Mazzini), Austro-Hungarian Empire, Ottoman decline | 30 |
| 5 | Industrial Capitalism & Labor | Marx/Engels, unions, strikes, socialism, anarchism, child labor laws, urbanization, Social Darwinism | 35 |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| IMP-LEADER | name | Leopold II (Belgium), Cecil Rhodes, Otto von Bismarck, Garibaldi, Mazzini, Menelik II, Sun Yat-sen, Commodore Perry, Queen Victoria, Marx, Engels | 16 |
| IMP-COUNTRY-EMPIRE | name | British Empire, French Empire, German Empire, Belgian Congo, Meiji Japan, British Raj, Ottoman Empire | 9 |
| IMP-DATE | date | 1839 (First Opium War), 1857 (Sepoy Rebellion), 1868 (Meiji Restoration), 1884 (Berlin Conference), 1898 (Spanish-American War) | 8 |
| IMP-TREATY-DOC | name | Treaty of Nanjing, Treaty of Kanagawa, Treaty of Berlin (Africa), Berlin West Africa Conference Act | 6 |
| IMP-CONCEPT | term | Social Darwinism, "White Man's Burden," extraterritoriality, unequal treaties, drain theory, proletariat, bourgeoisie, Marxism, anarchism | 14 |
| IMP-PLACE | place | Congo Free State, Hong Kong, Suez Canal, Manchuria, Transvaal, Fashoda, Port Arthur | 10 |
| IMP-BATTLE-REVOLT | name | Sepoy Rebellion, Zulu War (Battle of Isandlwana), Boxer Rebellion, Taiping Rebellion, Battle of Adwa | 8 |

**Cross-Deck Links:**
- → Revolutions & Enlightenment (nationalist ideology from Enlightenment fuels imperialism and resistance)
- → World Wars & Global Conflict (imperial rivalries + nationalist tensions = direct WWI cause)
- → Cold War to Modern World (decolonization as direct response to imperialism)
- ↔ Geography domain (colonial borders in Africa still shape modern geography)
- ↔ Art & Architecture domain (colonial architecture; Orientalist painting as ideological tool)
- → WWII deck (Japanese expansion begins with Meiji militarism)

**Notes:** Congo Free State atrocities under Leopold II are well-documented and important — handle with historical rigor, not sanitization. Ethiopia's victory at Adwa (1896) is the one successful African resistance story in this period — important counter-narrative. The Boxer Rebellion chain connects to Era 7 Chinese dynasties. Social Darwinism and its use to justify imperialism is essential intellectual history. Meiji Restoration is a direct bridge to Era 11's Japan in WWII.

---

### Era 11: World Wars & Global Conflict (1900–1945)

**AP Alignment:** AP World History Unit 7
**Geographic Scope:** Global — Western Front (Europe), Eastern Front, Ottoman Middle East, Pacific Theater, interwar Europe, colonial world
**Estimated Facts:** 180–220 (era deck only — excludes WWII-specific facts already in dedicated deck)
**Source Richness:** High (best-documented era in history; Wikidata extremely comprehensive)
**Priority:** Tier 1 (Launch — highest student engagement; leverages existing WWII deck infrastructure)

**IMPORTANT NOTE:** This era deck covers the broad 1900–1945 context. The 735-fact dedicated WWII deck already covers WWII battles, commanders, and events in depth. This era deck focuses on:
- WWI (which the WWII deck doesn't cover)
- Interwar period (Great Depression, rise of fascism, Weimar Republic)
- The intellectual/ideological context of the World Wars
- 1900–1914 pre-war context (imperialism, nationalism, alliance systems)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | WWI Causes & Alliances | Triple Alliance vs Triple Entente, assassination of Franz Ferdinand, imperialism/nationalism as causes, Schlieffen Plan | 30 |
| 1 | WWI: The War Itself | trench warfare, Verdun, Somme, Gallipoli, new weapons (gas, tanks, planes), U-boats, American entry 1917 | 40 |
| 2 | WWI Aftermath | Treaty of Versailles, "War Guilt" clause, reparations, League of Nations, redrawing of Middle East (Sykes-Picot) | 30 |
| 3 | Interwar Period | Great Depression (1929), Weimar Republic, hyperinflation, rise of fascism, Mussolini, Hitler's rise | 35 |
| 4 | Rise of Totalitarianism | Stalin's purges, collectivization, Mao's Long March, Nazi ideology, fascist Spain (Franco) | 30 |
| 5 | Global Impact of WWI | Armenian Genocide, Russian Revolution (1917), collapse of Ottoman/Habsburg/Romanov empires | 30 |
| 6 | Bridge to WWII | [COMPOSITE LINK to WWII deck] — facts about Hitler's early moves, Munich Agreement, Anschluss, invasion of Poland | 10 (links to WWII deck) |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| WW1-LEADER | name | Kaiser Wilhelm II, Franz Ferdinand, Woodrow Wilson, Lloyd George, Clemenceau, Mustafa Kemal (Atatürk), Lenin, Trotsky, Mussolini (early career) | 14 |
| WW1-BATTLE | name | Battle of the Marne, Battle of Verdun, Battle of the Somme, Battle of Gallipoli, Battle of Jutland, Meuse-Argonne | 10 |
| WW1-DATE | date | 1914 (war begins/assassination), 1915 (Gallipoli/Lusitania), 1917 (US enters/Russian Revolution), 1918 (armistice), 1919 (Treaty of Versailles), 1929 (Great Depression begins) | 10 |
| WW1-TREATY-DOC | name | Treaty of Versailles, Treaty of Brest-Litovsk, Balfour Declaration, Sykes-Picot Agreement, League of Nations Covenant | 7 |
| WW1-CONCEPT | term | trench warfare, No Man's Land, war guilt clause, reparations, mandate system, Fourteen Points, appeasement, totalitarianism | 14 |
| WW1-ALLIANCE | name | Triple Alliance, Triple Entente, Allied Powers, Central Powers, NATO (preview for Era 12), Axis Powers (preview) | 8 |
| WW1-PLACE | place | Sarajevo, Verdun, Somme, Gallipoli, Versailles, Weimar, Stalingrad (preview), Normandy (preview) | 10 |

**Cross-Deck Links:**
- ↔ WWII dedicated deck (735 facts) — this era provides context; WWII deck provides details of 1939-1945 combat/politics
- → Cold War to Modern World (WWII outcomes → Cold War directly)
- → Imperialism & Industrialization (imperial rivalries as WWI cause)
- ↔ Art & Architecture domain (WWI's influence on modernist art, propaganda posters, Bauhaus)
- **Composite deck concept:** "The World Wars: 1900–1945" = Era 11 context facts + curated selection from WWII deck

**Notes:** This era deck must be carefully scoped to NOT duplicate the WWII deck. The division point: Era 11 = causes, WWI, interwar, ideological context. WWII deck = military campaigns, battles, commanders, genocide facts. The Armenian Genocide chain requires careful, historically accurate framing — it is genocide; label it as such without equivocation. Russian Revolution chain connects to Era 12's Cold War arc. The "bridge to WWII" chain is explicitly a composite link, pointing players toward the dedicated deck.

---

### Era 12: Cold War to Modern World (1945–Present)

**AP Alignment:** AP World History Units 8–9
**Geographic Scope:** Global — superpower rivalry (USA/USSR), decolonizing Africa/Asia, Latin America proxy wars, modern Middle East, rise of China, EU, digital revolution
**Estimated Facts:** 280–330
**Source Richness:** High for 1945–1991 (excellent Wikidata); Medium for 1991–present (still-developing historical record; some events need recency-aware framing)
**Priority:** Tier 2 (High Demand — directly AP Units 8-9 tested; contemporary events create high engagement but require careful fact-sourcing for recency)

**Chain Themes:**

| # | Theme | Example Topics | Est. Facts |
|---|-------|----------------|------------|
| 0 | Cold War Origins & Alliances | NATO vs Warsaw Pact, Berlin Blockade, Truman Doctrine, Marshall Plan, iron curtain (Churchill) | 35 |
| 1 | Nuclear Arms Race | Manhattan Project (context from WWII deck), hydrogen bomb, Sputnik, Cuban Missile Crisis, MAD doctrine, détente | 35 |
| 2 | Proxy Wars & Hot Conflicts | Korean War, Vietnam War, Soviet-Afghan War, Angolan Civil War, Nicaraguan Contras | 35 |
| 3 | Decolonization | Indian independence (Gandhi, Nehru, Jinnah, partition), African independence movements, Algerian War, Nelson Mandela/apartheid | 40 |
| 4 | Civil Rights & Social Movements | MLK, Rosa Parks, Brown v. Board, Malcolm X, Stonewall, feminist movement (2nd wave), anti-apartheid | 35 |
| 5 | Fall of the USSR | Gorbachev (glasnost/perestroika), fall of Berlin Wall (1989), dissolution of USSR (1991), Solidarity (Poland), Velvet Revolution | 30 |
| 6 | Post-Cold War World | 9/11, War on Terror, rise of China, European Union, Rwanda genocide, Arab Spring, climate change conventions | 40 |
| 7 | Digital Revolution & Globalization | internet, WWW (Tim Berners-Lee), smartphones, WTO, NAFTA, outsourcing, social media, AI | 25 |

**Answer Type Pools:**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| CW-LEADER | name | Truman, Stalin, Churchill, Mao Zedong, Kim Il-sung, Ho Chi Minh, Fidel Castro, Kennedy, Gorbachev, Reagan, Mandela, Gandhi, Nehru, MLK, Thatcher | 20 |
| CW-DATE | date | 1945 (WWII ends/UN founded), 1947 (Truman Doctrine/Indian independence), 1949 (NATO/China communist), 1950 (Korean War), 1962 (Cuban Missile Crisis), 1975 (Vietnam ends), 1989 (Berlin Wall falls), 1991 (USSR dissolves), 2001 (9/11) | 14 |
| CW-ALLIANCE-ORG | name | NATO, Warsaw Pact, United Nations, Non-Aligned Movement, ASEAN, European Union, WTO, OPEC | 12 |
| CW-TREATY-DOC | name | Universal Declaration of Human Rights, Marshall Plan, Nuclear Non-Proliferation Treaty, Helsinki Accords, Camp David Accords, Oslo Accords | 8 |
| CW-CONCEPT | term | containment, détente, mutually assured destruction (MAD), glasnost, perestroika, apartheid, decolonization, globalization, neoliberalism | 14 |
| CW-CONFLICT | name | Korean War, Vietnam War, Soviet-Afghan War, Suez Crisis, Angolan Civil War, Rwandan Genocide, Gulf War, Iraq War | 12 |
| CW-PLACE | place | Berlin, Hiroshima (WWII bridge), Hanoi, Saigon, Havana, Kabul, Sarajevo, Tiananmen Square, Robben Island | 12 |
| CW-TECH-INVENTION | term | atomic bomb, hydrogen bomb, Sputnik, ARPANET, World Wide Web, internet, smartphone, GPS | 10 |

**Cross-Deck Links:**
- ↔ WWII dedicated deck (Cold War begins where WWII ends — natural composite "20th Century" deck)
- → Era 11 (WWII aftermath = Cold War origins)
- → Imperialism & Industrialization (decolonization as response to imperialism)
- ↔ Geography domain (Berlin Wall, Korean DMZ, post-colonial African borders, Israel/Palestine geography)
- ↔ Art & Architecture domain (Cold War propaganda art, Berlin Wall murals, modernist architecture)
- **Composite deck concept:** "AP World History Units 8-9" = focused selection of ~150 key facts from this era

**Notes:** Post-1991 history is genuinely harder to fact-write because the historical consensus is still forming — flag all post-2000 facts for extra sourcing rigor. 9/11 and War on Terror require sensitivity and neutral framing. Rwanda genocide is mandatory coverage — again, label genocide as genocide. Climate change chain: stick to IPCC/scientific consensus facts, avoid political framing. Chinese tech rise (Huawei, TikTok, BRI) is testable in AP World but politically charged — frame as economic/historical facts. Digital Revolution chain has fun, high-engagement facts (who invented the internet, first website, etc.) that appeal to younger players.

---

## Section 2: Composite Deck Architecture

### Overview

The Recall Rogue content library is built on a **source deck → composite deck** ownership model. Every fact has exactly one home: its source deck. Composite decks are curated windows into source deck content — they surface specific subsets of facts without duplicating data.

### Core Principle: One Fact, One Home

A fact lives in exactly one source deck. When that fact appears in a composite deck, the player is learning the same fact — not a copy of it. Progress on a fact in any deck advances it in all decks simultaneously.

**Example:** The fact about Mansa Musa's 1324 Hajj lives in **Era 6: Mongols, Mali & the Global Tapestry**. It may also appear in:
- "AP World History: Units 1-2"
- "African Civilizations" composite
- "Islamic History" composite

Completing this fact in any of those decks advances the SM-2 spaced repetition schedule for the fact itself — not per-deck.

### Composite Deck Examples

| Composite Deck | Source Decks Drawn From | Est. Facts | Target Audience |
|----------------|------------------------|------------|-----------------|
| Ancient Civilizations | Eras 1–4 | ~300 | Pre-AP / Early World History |
| AP World History: Units 1–3 | Eras 5–7 | ~250 | AP World students |
| AP World History: Units 4–6 | Eras 8–10 | ~250 | AP World students |
| AP World History: Units 7–9 | Eras 11–12 + WWII deck | ~300 | AP World students |
| AP US History | Eras 8–12 + US Presidents | ~300 | APUSH students |
| The World Wars: 1900–1945 | Era 11 + WWII deck | ~400 | General/enthusiast |
| 20th Century Complete | Era 11 + Era 12 + WWII deck | ~700 | Deep study |
| Egyptian History & Mythology | Era 1 + Mythology domain | ~150 | Mythology fans |
| Axial Age: 500 BCE | Eras 2, 3, 4 (philosophy chains) | ~120 | Philosophy enthusiasts |
| The Silk Road | Eras 4, 5, 6, 7 (trade chains) | ~100 | History enthusiasts |

### How Progress Flows

```
PLAYER LEARNS FACT IN COMPOSITE DECK
         ↓
Progress credited to:
  1. The source deck (home deck mastery advances)
  2. The composite deck's completion tracking
  3. The player's global SM-2 schedule for that fact
         ↓
Next time that fact appears (in ANY deck),
the SM-2 interval is honored globally
```

This means a player who masters "AP World History: Units 1-3" has implicitly made progress in Eras 5, 6, and 7 even if they never explicitly opened those decks. When they later open Era 6, they'll see their Mansa Musa facts already reviewed — not starting from zero.

### Cross-Domain Composites

Composite decks aren't limited to history eras. They can pull from multiple knowledge domains:

| Composite Deck | Crosses Domains |
|----------------|----------------|
| Egyptian Mythology | History (Era 1) ↔ Mythology domain |
| Renaissance Art | History (Era 7) ↔ Art & Architecture domain |
| Greek Philosophy | History (Era 2) ↔ Philosophy domain |
| Scientific Revolution | History (Era 9) ↔ Natural Sciences domain |
| Silk Road Geography | History (Eras 4–7) ↔ Geography domain |

### Implementation Status

**Current status: Composite decks are a FUTURE FEATURE — not yet implemented.**

The source deck architecture is being designed with composites in mind so that when the feature ships, no data migration is required. Specifically:

- Each fact record must carry a `sourceDeckId` field pointing to its home deck
- The fact ID must be globally unique across all decks (not deck-relative)
- The SM-2 schedule must be keyed to `factId` globally, not `deckId + factId`
- Composite decks are defined as a list of `factId` references, not fact copies
- The player's "deck completion" calculation for a composite must query facts by ID across source decks

### Design Principles for Source Deck Authors

When writing source deck content, keep composites in mind:

1. **Pool completeness over pool isolation.** A fact that fits two pools (e.g., a pharaoh who built a famous monument) should be categorized by its primary quiz angle — don't force it into both. Composites will surface it regardless.

2. **Chain themes should be self-contained.** Each chain should make sense independently, because composites may pull individual chains without the full era surrounding them.

3. **Cross-era linkages should be noted.** When writing Era 6, note which specific facts set up Era 7 content. Composite deck editors will use these notes to build narrative flow across source decks.

4. **Avoid era-internal duplicates.** Two facts that test the same conceptual knowledge (even in different formats) waste learner time. Source deck diversity increases composite deck quality.

5. **Flag facts with high composite reuse potential.** Facts about trade routes, major rulers who span eras, and foundational concepts (democracy, feudalism, Islam) are natural candidates for multiple composites. Noting this during sourcing helps composite curation.

---

## Section 3: Domain Overviews

> Each entry covers current state, the top 5 deck candidates, cross-domain links, and sourcing notes. Deck candidates are ranked within the domain; overall production priority is in Section 4.

---

### 3.1 Natural Sciences

**Current State:** Periodic Table shipped (90 facts, `periodic_table.json`). Human Anatomy WIP in `data/decks/_wip/` — 2,009 facts across ~30 sub-files covering cardiovascular, digestive, embryology, and clinical anatomy. Seed facts: 853 across `chemistry_elements`, `biology_organisms`, `physics_mechanics`, `geology_earth`, `botany_plants`, `ecology_environment`.

**Top 5 Deck Candidates**

| # | Deck Name | Pool Potential (concrete examples) | Demand Signal | Priority |
|---|-----------|-------------------------------------|---------------|----------|
| NS-01 | Human Anatomy | organ_names (78+ Terminologia Anatomica), body_systems (11), bone_names (206), muscle_groups (8+) | Pre-med, nursing, AP Bio students | **Tier 1 — WIP** |
| NS-02 | Famous Scientists & Discoveries | scientist_names (80+, Nobel laureates + historical), field_names (12+), century_names (8) | Students, science history enthusiasts | **Tier 1** |
| NS-03 | Dinosaurs & Paleontology | dinosaur_names (55+, all named genera), geologic_periods (5: Triassic/Jurassic/Cretaceous/Permian/Devonian), diet_types (3: herbivore/carnivore/omnivore), discovery_countries (20+) | Kids, museum-goers, casual fans | **Tier 1** |
| NS-04 | Physics Concepts & Laws | law_names (30+: Newton/Thermodynamics/etc), scientist_names (25+), unit_names (20+ SI units) | AP Physics, science enthusiasts | **Tier 2** |
| NS-05 | Geology & Rocks | rock_types (3: igneous/metamorphic/sedimentary), mineral_names (50+), tectonic_plate_names (15+), volcano_types (5) | Earth science students, gem hobbyists | **Tier 2** |

**Cross-Domain Links**
- NS-02 (Famous Scientists) links to History (people_leaders) and Space (missions_spacecraft — astronomer bios)
- NS-03 (Dinosaurs) bridges to Animals & Wildlife (prehistoric life)
- NS-04 (Physics) links to Space (cosmology), enabling a future "Physics of the Universe" composite
- NS-05 (Geology) links to Geography (landforms_water, climate_biomes)

**Notes**
The Human Anatomy WIP deck is the highest-ROI asset in the entire pipeline: 2,009 facts already generated and partitioned. Primary sourcing concern is Terminologia Anatomica compliance — use the official Latin/English name pairs, not colloquial terms. Dinosaur deck benefits from Wikidata SPARQL queries (taxon names, discovery dates, specimen locations) — WikiProject Palaeontology is exceptionally complete. Physics is trickier to pool: most facts are definitions/laws rather than enumerable entities, so pools skew toward scientist names and SI units.

---

### 3.2 Space & Astronomy

**Current State:** Solar System shipped (76 facts, `solar_system.json`). NASA Missions shipped (84 facts, `nasa_missions.json`). Seed facts: 74 — deliberately thin because shipped decks already cover the major pools (planet_names, mission_names). Architecture YAML at `data/deck-architectures/solar_system_arch.yaml`.

**Top 5 Deck Candidates**

| # | Deck Name | Pool Potential (concrete examples) | Demand Signal | Priority |
|---|-----------|-------------------------------------|---------------|----------|
| SA-01 | Constellations | constellation_names (88 IAU official), sky_hemisphere (2: northern/southern), mythology_origins (10+ cultures), visibility_seasons (4) | Stargazers, astrology-adjacent audience, kids | **Tier 1** |
| SA-02 | Stars & Stellar Objects | star_names (120+ named stars, Bayer + proper), star_classification (7 spectral types O-M), galaxy_types (4: spiral/elliptical/irregular/lenticular) | Astronomy hobbyists, physics students | **Tier 2** |
| SA-03 | Astronauts & Cosmonauts | astronaut_names (560+ flown), nationality_names (20+), program_names (12+), mission_names (35+ crewed) | Space fans, biography buffs, kids | **Tier 2** |
| SA-04 | Planets — Deep Dive | planet_names (8), moon_names (280+ named moons), dwarf_planet_names (5 IAU-recognized), atmosphere_types (5+) | Students, solar system enthusiasts | **Tier 2** |
| SA-05 | The Space Race (Historical) | program_names (12+), cosmonaut_astronaut_names (30+), milestone_event_types (5+), country_names (2: USA/USSR → successor states) | History crossover, students, Cold War interest | **Tier 3** |

**Cross-Domain Links**
- SA-01 (Constellations) links to Mythology (greek_roman, eastern_myths — most constellations have mythological origins)
- SA-03 (Astronauts) links to History (people_leaders)
- SA-05 (Space Race) links directly to History Cold War deck — strong composite potential

**Notes**
Seed facts are thin (74) because shipped decks already exhaust the primary pools. The constellation deck is the most immediately buildable new deck — 88 IAU official constellations is a clean enumerable pool, mythology backstories are rich, and Wikidata has complete coverage. Astronaut deck is Wikipedia-rich but pool structure requires careful scoping: crewed-mission astronauts only (not the full 560) for manageable fact counts.

---

### 3.3 Geography

**Current State:** World Countries (168), World Capitals (168), World Flags (197), US States (75) shipped. All use `geography_drill` domain. Seed facts: 1,037 across subcategories including africa, asia_oceania, europe, americas, landforms_water, extreme_records, climate_biomes. Architecture YAML at `data/deck-architectures/us_states_arch.yaml`.

**Top 5 Deck Candidates**

| # | Deck Name | Pool Potential (concrete examples) | Demand Signal | Priority |
|---|-----------|-------------------------------------|---------------|----------|
| G-01 | World Rivers & Mountains | river_names (50+ major), mountain_names (50+ named peaks), continent_names (7), range_names (20+) | Geography students, hikers, trivia fans | **Tier 1** |
| G-02 | European Countries Deep Dive | country_names (44 European), capital_names (44), eu_membership (2: EU/non-EU), currency_names (5+ European currencies), official_language_names (25+) | European students, travelers, EU context | **Tier 1** |
| G-03 | US Geography — Beyond States | state_names (50), national_park_names (63), major_city_names (50+), river_names (20+) | Americans, students, AP Human Geography | **Tier 2** |
| G-04 | UNESCO World Heritage Sites | site_names (1,199 but curate to 100+), country_names (60+), heritage_categories (3: cultural/natural/mixed), continents (7) | Travel enthusiasts, culture buffs, bucket-listers | **Tier 2** |
| G-05 | Geographic Records & Extremes | record_types (10+: highest/deepest/largest/driest/etc), location_names (50+), continent_names (7) | Kids, trivia fans, quiz enthusiasts | **Tier 2** |

**Cross-Domain Links**
- G-01 (Rivers & Mountains) links to Natural Sciences (geology_earth)
- G-02 (European Deep Dive) links to History (medieval, early_modern, WWII)
- G-04 (UNESCO) links to Art & Architecture (historic_buildings)
- G-05 (Records) links to General Knowledge (records_firsts)

**Notes**
Geography is the domain most susceptible to data staleness — country names, capitals, and flags change (South Sudan 2011, Kosovo 2008, etc.). All facts need `lastVerified` date stamps and a re-verification trigger when the deck is republished. UNESCO sites are curated annually; the full list (1,199) is too large for a single deck — filter to the 150 most-recognized sites by Wikipedia pageviews. European Deep Dive is a logical next step given World Countries/Capitals are shipped.

---

### 3.4 Mythology & Folklore

**Current State:** Greek Mythology shipped (272 facts, `greek_mythology.json`). Norse Mythology shipped (223 facts, `norse_mythology.json`). Seed facts: 456 across greek_roman, norse_celtic, eastern_myths, creatures_monsters, creation_cosmology, folk_legends, gods_deities. Architecture YAML at `data/deck-architectures/norse_mythology_arch.yaml`.

**Top 5 Deck Candidates**

| # | Deck Name | Pool Potential (concrete examples) | Demand Signal | Priority |
|---|-----------|-------------------------------------|---------------|----------|
| MF-01 | Egyptian Mythology | deity_names (30+: Ra/Osiris/Isis/Horus/Set/Thoth/etc), sacred_animal_names (10+: ibis/jackal/cat/falcon/etc), afterlife_concept_names (8+), pharaoh_names (30+) | History crossover, Egypt enthusiasts, students | **Tier 1** |
| MF-02 | Monsters & Creatures — World Mythology | creature_names (80+ across cultures: Minotaur/Dragon/Kraken/Basilisk/Kitsune/Sphinx/etc), origin_culture (15+), creature_types (5+: beast/undead/spirit/giant/serpent) | D&D/TTRPG players, fantasy fans, kids, Pokémon-adjacent | **Tier 2** |
| MF-03 | Hindu Mythology | deity_names (33+ primary: Brahma/Vishnu/Shiva/Lakshmi/Saraswati/Durga/etc), avatar_names (10 Dashavatar), epic_names (2+: Ramayana/Mahabharata), concept_names (10+ dharma/karma/etc) | South Asian heritage, religious studies, yoga community | **Tier 2** |
| MF-04 | Celtic & Arthurian Legends | character_names (30+: Arthur/Merlin/Lancelot/Guinevere/Morgana/Cú Chulainn/etc), celtic_tribe_names (8+), artifact_names (10+: Excalibur/Cauldron/etc), celtic_festival_names (4: Samhain/Imbolc/Beltane/Lughnasadh) | Fantasy fans, British/Irish heritage, D&D | **Tier 2** |
| MF-05 | Japanese Mythology & Folklore | deity_names (15+ Shinto kami: Amaterasu/Susanoo/etc), yokai_names (30+: Kitsune/Tanuki/Oni/etc), legendary_item_names (10+: Three Sacred Treasures/etc) | Anime fans, Japan enthusiasts, folklore collectors | **Tier 2** |

**Cross-Domain Links**
- MF-01 (Egyptian) links to History (ancient_classical — Egypt pharaohs)
- MF-02 (Monsters) links to Animals & Wildlife (creatures), Natural Sciences (zoological roots of mythical creatures)
- MF-03 (Hindu) links to History (ancient India) and Language (Sanskrit terms)
- MF-04 (Celtic/Arthurian) links to History (medieval, British Isles)

**Notes**
The Monsters & Creatures deck is the sleeper hit of this domain — huge TTRPG and fantasy crossover appeal, visually spectacular (monster art for combat sprites), and pools span all cultures making distractors natural. Distractor quality is critical here: "What is a Basilisk?" needs wrong answers that are other real mythological creatures, not random words — LLM-generated distractors from the same cultural context are essential. Hindu Mythology requires cultural sensitivity review by a subject-matter expert before publishing.

---

### 3.5 Animals & Wildlife

**Current State:** Zero published decks. Seed facts: 756 across mammals, birds, marine_life, insects_arachnids, reptiles_amphibians, behavior_intelligence, conservation, adaptations. This is the largest zero-deck domain by seed count.

**Top 5 Deck Candidates**

| # | Deck Name | Pool Potential (concrete examples) | Demand Signal | Priority |
|---|-----------|-------------------------------------|---------------|----------|
| AW-01 | Mammals of the World | animal_names (260+ mammal species on Wikipedia featured list), order_names (26 mammalian orders), habitat_types (6: terrestrial/aquatic/arboreal/subterranean/desert/arctic), diet_types (3: herbivore/carnivore/omnivore) | Kids, nature fans, documentary viewers | **Tier 1** |
| AW-02 | Ocean Life | animal_names (150+ marine species), ocean_zone_names (5: sunlight/twilight/midnight/abyssal/hadal), marine_group_names (10+: cetaceans/cephalopods/elasmobranchs/etc) | Kids, marine biology students, ocean fans | **Tier 1** |
| AW-03 | Birds of the World | bird_names (200+ well-known species), bird_order_names (40 Aves orders), habitat_types (6+), migration_pattern_types (3: resident/migratory/irruptive) | Birdwatchers (massive global community), nature fans | **Tier 2** |
| AW-04 | Endangered & Extinct Animals (Modern Era) | species_names (100+ on IUCN Red List critical/extinct), threat_types (6: habitat loss/hunting/climate/invasive/disease/pollution), continent_names (7) | Environmental advocates, kids, conservation-focused learners | **Tier 2** |
| AW-05 | Dog Breeds | breed_names (197 AKC recognized), breed_group_names (7 AKC groups: sporting/hound/working/terrier/toy/non-sporting/herding), origin_country_names (30+) | Dog owners (massive audience), pet enthusiasts, kids | **Tier 2** |

**Cross-Domain Links**
- AW-01 (Mammals) links to Natural Sciences (biology_organisms — taxonomy)
- AW-03 (Birds) links to Geography (migration routes, continents)
- AW-04 (Endangered) links to Natural Sciences (ecology_environment, conservation)
- AW-05 (Dog Breeds) links to History (breed origin stories, working dog history)

**Notes**
Animals is a top-3 domain by audience breadth — it covers every age from children to serious wildlife biologists. The challenge is fact variety: animal facts tend toward "X lives in Y and eats Z" patterns that become repetitive. Mitigation: expand fact types to include record superlatives (heaviest, fastest, longest-lived), behavior facts (tool use, echolocation, mimicry), and conservation status. Wikidata is exceptional for animal taxonomy (Q-IDs exist for virtually every named species). The Birds deck has the largest passionate hobbyist base of any deck in this section — birdwatchers are an intensely engaged audience.

---

### 3.6 Human Body & Health

**Current State:** Zero published decks. WIP: 2,009 anatomy facts in `data/decks/_wip/` across 30+ sub-files covering cardiovascular, digestive, embryology, neurological, musculoskeletal, and clinical anatomy. Seed facts: 661 across anatomy_organs, brain_neuro, genetics_dna, cardiovascular, digestion_metabolism, senses_perception, immunity_disease, medical_science.

**Top 5 Deck Candidates**

| # | Deck Name | Pool Potential (concrete examples) | Demand Signal | Priority |
|---|-----------|-------------------------------------|---------------|----------|
| HB-01 | Human Anatomy — Core Systems | organ_names (78+ Terminologia Anatomica), body_system_names (11), anatomical_region_names (5: head/thorax/abdomen/pelvis/limbs), function_types (5+) | Biology students, pre-med, nurses, curious learners | **Tier 1 — WIP ready** |
| HB-02 | Bones of the Human Body | bone_names (206 bones), skeletal_region_names (5: skull/vertebral/thoracic/appendicular/etc), joint_type_names (6: ball-and-socket/hinge/pivot/etc) | Medical students, anatomy class, physiotherapy students | **Tier 1** |
| HB-03 | Brain & Neuroscience | brain_region_names (30+: frontal lobe/hippocampus/amygdala/cerebellum/etc), neurotransmitter_names (8+: dopamine/serotonin/GABA/etc), function_domains (6+: memory/emotion/motor/sensory/etc) | Psychology students, neuroscience fans, mental health interest | **Tier 2** |
| HB-04 | Nutrition, Vitamins & Minerals | vitamin_names (13 vitamins A-K series), mineral_names (16 essential minerals), deficiency_disease_names (15+: scurvy/rickets/pellagra/etc), food_source_types (10+) | Health-conscious adults, nutrition students, dietitians | **Tier 2** |
| HB-05 | Diseases & Medical History | disease_names (80+), pathogen_type_names (4: virus/bacteria/fungus/parasite), historical_era_names (5+), body_system_names (11) | Medical students, health-conscious adults, post-COVID interest | **Tier 2** |

**Cross-Domain Links**
- HB-01/02 (Anatomy) links to Natural Sciences (biology_organisms)
- HB-03 (Neuroscience) links to General Knowledge (psychology) and Natural Sciences
- HB-04 (Nutrition) links to Food & Cuisine (ingredients, food science)
- HB-05 (Diseases) links to History (pandemics, medical history events)

**Notes**
The WIP anatomy bank of 2,009 facts is the most important pipeline asset after Language. The immediate action is publishing HB-01 as a curated subset of the WIP facts (target: 200-300 facts covering all 11 body systems with 3-5 facts each). HB-02 (Bones) has an exceptionally clean pool — 206 named bones, Terminologia Anatomica is authoritative and complete. Medical accuracy is paramount: all facts must cite Gray's Anatomy or Terminologia Anatomica; colloquial misnomers ("funny bone is a bone") must be flagged and corrected. First Aid deck is lower priority but has broad practical appeal as a non-academic deck.

---

### 3.7 Art & Architecture

**Current State:** Zero published decks. Seed facts: 684 across museums_institutions, historic_buildings, painting_visual, sculpture_decorative, modern_contemporary, architectural_styles, engineering_design.

**Top 5 Deck Candidates**

| # | Deck Name | Pool Potential (concrete examples) | Demand Signal | Priority |
|---|-----------|-------------------------------------|---------------|----------|
| AA-01 | Famous Paintings & Artists | artist_names (120+ Wikipedia "Great Masters" list), art_movement_names (12+: Impressionism/Baroque/Renaissance/Romanticism/etc), nationality_names (20+), century_names (6) | Art students, museum-goers, culture buffs | **Tier 1** |
| AA-02 | Art Movements — History | movement_names (20+ documented movements), founding_decade_names (8+), origin_country_names (10+), reaction_to_names (10+ predecessor movements) | Art history students, design students | **Tier 2** |
| AA-03 | Architectural Wonders | building_names (100+ Wikipedia "World Architecture" list), architectural_style_names (15+), country_names (40+), construction_era_names (6) | Travel fans, architecture students, engineering enthusiasts | **Tier 2** |
| AA-04 | Shakespeare — Plays & Characters | play_names (37 canonical plays), play_genre_names (3: comedy/tragedy/history), character_names (100+ named characters), play_setting_countries (10+) | English/literature students, theater fans — curriculum-standard content | **Tier 2** |
| AA-05 | Classical Music Composers | composer_names (80+ Wikipedia classical list), musical_era_names (5: Baroque/Classical/Romantic/Impressionist/Modern), nationality_names (20+), instrument_families (5) | Classical music fans, music students, AP Music Theory | **Tier 2** |

**Cross-Domain Links**
- AA-01 (Paintings) links to History (early_modern — Renaissance, Baroque eras)
- AA-02 (Art Movements) links to History (social_cultural movements)
- AA-03 (Architecture) links to Geography (UNESCO, landmarks)
- AA-04 (Shakespeare) links to History (early_modern England) and Language
- AA-05 (Composers) links to History (modern_contemporary — Romantic era politics)

**Notes**
Art & Architecture has a latent but passionate audience — not a casual trivia domain, but deeply engaged once users self-select. Pool design is the main challenge: paintings and buildings are hard to enumerate into clean pools the way elements or countries are. Best strategy: organize by movement and nationality rather than individual titles, which creates stable cross-deck pools. Shakespeare is the strongest single deck in this domain — curriculum standard in English-speaking countries, clear pool structure, broad cultural literacy value. Consider whether AA-08/09 (World Religions, Philosophy) are domain-appropriate or should live under a future `humanities` domain.

---

### 3.8 Food & Cuisine

**Current State:** Zero published decks. Seed facts: 467 across european_cuisine, asian_cuisine, world_cuisine, baking_desserts, fermentation_beverages, food_history, food_science, ingredients_spices.

**Top 5 Deck Candidates**

| # | Deck Name | Pool Potential (concrete examples) | Demand Signal | Priority |
|---|-----------|-------------------------------------|---------------|----------|
| FC-01 | Spices & Herbs of the World | spice_names (70+ Wikipedia "List of culinary herbs and spices"), origin_region_names (8: South Asia/Southeast Asia/Mediterranean/Americas/etc), use_type_names (5+: sweet/savory/aromatic/medicinal/coloring) | Foodies, culinary students, home cooks | **Tier 1** |
| FC-02 | National Dishes of the World | dish_names (80+ national dishes), origin_country_names (80+), cuisine_family_names (8+: Mediterranean/South Asian/East Asian/etc), primary_ingredient_types (10+) | Travelers, foodies, geography crossover | **Tier 2** |
| FC-03 | Cuisines of the World | cuisine_names (30+ major cuisines), origin_country_names (30+), signature_ingredient_names (30+), cooking_technique_names (10+) | Foodies, travelers, broad appeal | **Tier 2** |
| FC-04 | Wine Regions & Grape Varietals | varietal_names (30+ major grapes), origin_country_names (12+ wine-producing countries), wine_region_names (40+: Bordeaux/Napa/Rioja/etc), flavor_profile_types (5+) | Wine enthusiasts, sommeliers, adult audience | **Tier 3** |
| FC-05 | Coffee & Tea Around the World | origin_country_names (20+), processing_method_names (5+: washed/natural/honey/etc), tea_type_names (6: green/black/white/oolong/pu-erh/herbal), flavor_profile_types (6+) | Coffee & tea enthusiasts — rapidly growing category | **Tier 3** |

**Cross-Domain Links**
- FC-01 (Spices) links to Geography (origin countries, trade routes) and History (Spice Trade era)
- FC-02 (National Dishes) links to Geography (countries), Culture
- FC-04 (Wine) links to Geography (European regions) and History (viticulture history)

**Notes**
Food is a high-engagement casual domain with strong social sharing potential — players talk about "I just learned X is the national dish of Y." Spices & Herbs is the cleanest pool in this domain (large enumerable list, each spice has a definitive origin). Wine is an adult-skewing deck with monetization potential (adult learners pay more) but requires careful fact framing to avoid medical-adjacent claims. The biggest sourcing challenge for Food is that "national dish" is often contested and informal — use Wikipedia's list with notes that many designations are unofficial.

---

### 3.9 General Knowledge

**Current State:** Zero published decks. Seed facts: 743 across records_firsts, inventions_tech, landmarks_wonders, pop_culture, words_language, everyday_science, oddities.

**Top 5 Deck Candidates**

| # | Deck Name | Pool Potential (concrete examples) | Demand Signal | Priority |
|---|-----------|-------------------------------------|---------------|----------|
| GK-01 | Famous Inventions & Inventors | inventor_names (80+), invention_names (80+), invention_category_names (8+: mechanical/chemical/electrical/medical/etc), century_names (5) | Trivia fans, students, Jeopardy enthusiasts | **Tier 1** |
| GK-02 | Nobel Prize Winners | laureate_names (965 individual/organization winners through 2025), prize_category_names (6), nationality_names (40+), decade_names (12+) | Academic enthusiasts, students, trivia fans | **Tier 1** |
| GK-03 | World Records & Extremes | record_category_names (15+), location_names (60+), measurement_unit_names (10+), record_holder_names (60+) | Kids, trivia fans, broad casual appeal | **Tier 1** |
| GK-04 | Famous Quotes & Who Said It | speaker_names (60+), quote_topic_names (10+: leadership/science/love/freedom/etc), speaker_era_names (5+), speaker_nationality_names (15+) | Trivia fans, inspirational content audience | **Tier 2** |
| GK-05 | Wonders of the World | wonder_names (21+: Ancient 7 + New 7 + Natural 7), wonder_category_names (3: ancient/new/natural), country_names (15+), construction_era_names (5) | Travel fans, trivia, broad cultural literacy | **Tier 2** |

**Cross-Domain Links**
- GK-01 (Inventions) links to History (early_modern, modern_contemporary), Natural Sciences (physics, chemistry)
- GK-02 (Nobel) links to Natural Sciences (famous scientists), History (peace prize context)
- GK-03 (Records) links to Geography (geographic extremes) and Animals (biological records)
- GK-05 (Wonders) links to Art & Architecture (buildings) and Geography (locations)

**Notes**
General Knowledge is the widest-appeal domain but hardest to pool cleanly — facts are inherently heterogeneous. Best strategy: use fact_type as a meta-pool (inventions, records, quotes) rather than trying to create content-based pools. Nobel Prize is an excellent anchor deck — clean pools (6 categories, enumerable laureates), prestigious associations, Wikidata-complete. World Records requires Guinness World Records as a source; avoid unofficial Internet claims. The `oddities` subcategory is too low-pool for a standalone deck but works as a 20-fact seasoning layer in composite decks.

---

### 3.10 Technology & Computing

**Current State:** Proposed new domain. Zero decks, zero seed facts. Would map to a new `technology_computing` domain entry in `src/data/domainMetadata.ts` and `src/data/subcategoryTaxonomy.ts`.

**Top 5 Deck Candidates**

| # | Deck Name | Pool Potential (concrete examples) | Demand Signal | Priority |
|---|-----------|-------------------------------------|---------------|----------|
| TC-01 | Computer Science Fundamentals | algorithm_names (30+: quicksort/Dijkstra/RSA/etc), data_structure_names (15+), inventor_names (30+: Turing/von Neumann/Knuth/etc), decade_names (7) | CS students, programmers, tech-literate adults | **Tier 2** |
| TC-02 | History of Computing | milestone_names (50+: ENIAC/ARPANET/World Wide Web/first smartphone/etc), inventor_names (30+), company_names (20+), decade_names (8) | CS history fans, tech professionals, students | **Tier 2** |
| TC-03 | Programming Languages | language_names (40+ Wikipedia list), paradigm_names (5: imperative/OOP/functional/declarative/scripting), creator_names (30+), first_appeared_decade (7) | Programmers, CS students | **Tier 2** |
| TC-04 | Internet & Networking Basics | protocol_names (20+: HTTP/TCP/DNS/SMTP/etc), technology_names (20+), inventor_names (10+), year_of_introduction (30+) | Tech-literate adults, networking students | **Tier 3** |
| TC-05 | Tech Companies & Founders | company_names (50+ major tech companies), founder_names (50+), founding_decade_names (6), headquarters_country_names (5+) | Business students, tech enthusiasts | **Tier 3** |

**Cross-Domain Links**
- TC-01/02 (CS Fundamentals, History of Computing) link to History (modern_contemporary) and GK (inventions)
- TC-02 (History) links to General Knowledge (Famous Firsts)
- TC-05 (Companies) links to History (people_leaders — tech founder bios)

**Notes**
Technology & Computing requires creating a new domain in `domainMetadata.ts` before any deck can ship. Budget 1-2 days for domain scaffolding (domain metadata, subcategory taxonomy, icon, color palette). The audience is intensely self-selected and vocal but smaller than History or Geography — treat as Tier 2/3 overall. Avoid "current state" facts (who is CEO of X, current stock price) that will become stale. Stick to historical firsts, inventor names, and algorithmic concepts that don't change.

---

### 3.11 Sports & Entertainment

**Current State:** Proposed new domain. Zero decks, zero seed facts. Would map to a new `sports_entertainment` domain.

**Top 5 Deck Candidates**

| # | Deck Name | Pool Potential (concrete examples) | Demand Signal | Priority |
|---|-----------|-------------------------------------|---------------|----------|
| SE-01 | Olympic Games — History & Records | country_names (60+ with medals), sport_names (30+ Olympic sports), host_city_names (30+), champion_names (50+) | Sports fans, students, international audience | **Tier 2** |
| SE-02 | FIFA World Cup | host_country_names (22 tournaments), winner_country_names (8 winners), top_scorer_names (30+), tournament_year_names (22) | Massive global football/soccer audience | **Tier 2** |
| SE-03 | Academy Awards (Oscars) | film_names (80+), director_names (60+), actor_names (80+), award_category_names (6+ major), decade_names (9) | Film buffs, pop culture fans | **Tier 3** |
| SE-04 | Famous Athletes — All Time | athlete_names (80+), sport_names (20+), nationality_names (30+), era_names (5) | Sports fans, broad appeal | **Tier 3** |
| SE-05 | Board Games & Card Games | game_names (50+ notable games), mechanic_type_names (8: strategy/luck/deck-building/etc), designer_names (25+), origin_decade_names (8) | Board game enthusiasts — highly relevant to Recall Rogue's own audience | **Tier 3** |

**Cross-Domain Links**
- SE-01 (Olympics) links to Geography (host countries, nations) and History (1936 Berlin Olympics, boycotts)
- SE-02 (FIFA) links to Geography (countries, continents)
- SE-03 (Oscars) links to Art & Architecture (cultural arts)
- SE-05 (Board Games) has meta-appeal for Recall Rogue players specifically

**Notes**
Sports & Entertainment requires new domain scaffolding. FIFA World Cup is a uniquely powerful deck — the global football audience dwarfs every other sport combined, and pool structure is clean (past winners, top scorers, host nations). Olympics works cross-generationally. SE-05 (Board Games) is a niche deck but has exceptional resonance for Recall Rogue's core audience of strategy and card game enthusiasts — consider as a promotional/community deck. Avoid licensing-sensitive content (specific team logos, copyrighted images for Oscars categories).

---

### 3.12 Language (Vocabulary)

**Current State: Largely complete.** 37 decks shipped across 8 languages. Full coverage: Chinese HSK 1-6 (6 decks), Japanese N5-N1 + Hiragana/Katakana (7 decks), Spanish A1-B2 (4 decks), French A1-B2 (4 decks), German A1-B2 (4 decks), Dutch A1-B2 (4 decks), Czech A1-B2 (4 decks), Korean Hangul + TOPIK 1-2 (3 decks), Japanese N3 Grammar (1 deck).

**Next priorities:** Portuguese A1-B2, Italian A1-B2, Russian A1-A2, Arabic MSA A1 (requires RTL script handling), Hindi A1 (requires Devanagari). Pipeline documented in `memory/language-pipeline-learnings.md`.

**No further domain overview needed** — this domain operates on its own sourcing pipeline (Wiktionary + official wordlists, programmatic rather than LLM-generated facts).

---

### 3.13 Academic / Exam Prep

**Overview:** Exam Prep decks are composites — they do not own original facts but draw from existing domain decks with exam-specific framing and weighting. An AP Biology deck is a curated view over Natural Sciences facts tagged `ap_biology: true`. A GRE Vocabulary deck is a curated view over Language facts tagged `gre_vocab: true`.

**Composite architecture requirements:**
1. Source decks must be published first (composites can't precede their dependencies)
2. Facts need exam-relevance tags added during deck generation (`ap_us_history`, `sat_vocab`, `gre_words`, `mcat_bio`, etc.)
3. Composite deck registry entries point to source deck IDs + filter criteria
4. No new fact generation needed — only tagging and presentation layer

**Top composite candidates (in dependency order):**

| # | Exam Deck | Source Domains | Dependency | Priority |
|---|-----------|---------------|------------|----------|
| EP-01 | AP US History | history (US-specific facts) | H-06 US Civil War, H-08 Cold War | After Tier 1 history decks |
| EP-02 | AP Biology | natural_sciences | Standalone (not composite) — CED-aligned, ships as `ap_biology.json` | **SHIPPED** — `data/decks/ap_biology.json` |
| EP-03 | SAT/ACT Vocabulary | language (English vocab) | Requires English vocab deck (not yet built) | Tier 2 |
| EP-04 | MCAT — Biology & Chemistry | natural_sciences + human_body_health | HB-01 Anatomy, NS-05 Cell Bio, NS-06 Chemistry | After HB/NS Tier 1 |
| EP-05 | GRE Vocabulary | language (English vocab) | Requires English vocab deck | Tier 2 |
| EP-06 | AP World History | history (global) | Standalone (not composite) — CED-aligned | **SHIPPED** — `data/decks/ap_world_history.json` (620 facts, 2026-04-04) |
| EP-07 | AP Chemistry | natural_sciences | Standalone (not composite) — CED-aligned | **SHIPPED** — `data/decks/ap_chemistry.json` (assembled 2026-04-03) |
| EP-08 | AP Human Geography | geography | Standalone (not composite) — CED-aligned Fall 2020 | **SHIPPED** — `data/decks/ap_human_geography.json` (299 facts, 2026-04-08) |

**Reusable patterns established by AP Human Geography (2026-04-08):** Pool-first architecture (define pools before generating facts), unit sub-pool splitting (never share a `concept_definitions` pool across AP units), language-family pool separation (prevents two-right-answer failures), fill-blank rewrite (knowledge decks must not use `{___}` format), curriculum-sourced EK-code grounding. See `docs/deck-provenance/ap_human_geography.md`.

**Note:** English vocabulary (SAT/GRE words) is not yet a domain. It would require a new `english_vocabulary` domain distinct from Language (which currently covers non-English languages only). This is a high-demand gap.

---

### 3.13.1 AP Chemistry (Standalone CED-Aligned Deck)

**Status:** Discovery complete (2026-04-03). Architecture phase next.
**Domain:** `natural_sciences`
**Exam:** College Board AP Chemistry (CED effective fall 2024)
**Enrollment:** ~160,000 students/year (6th largest AP exam)
**Priority:** **Tier 1** — exam-aligned content is our highest-value offering

**CED Scope (92 topics across 9 units):**

| Unit | Name | Topics | Exam Weight |
|------|------|--------|-------------|
| 1 | Atomic Structure and Properties | 1.1–1.8 (8) | 7–9% |
| 2 | Compound Structure and Properties | 2.1–2.7 (7) | 7–9% |
| 3 | Properties of Substances and Mixtures | 3.1–3.13 (13) | 18–22% |
| 4 | Chemical Reactions | 4.1–4.9 (9) | 7–9% |
| 5 | Kinetics | 5.1–5.11 (11) | 7–9% |
| 6 | Thermochemistry | 6.1–6.9 (9) | 7–9% |
| 7 | Equilibrium | 7.1–7.14 (14) | 7–9% |
| 8 | Acids and Bases | 8.1–8.10 (10) | 11–15% |
| 9 | Thermodynamics and Electrochemistry | 9.1–9.11 (11) | 7–9% |

**Estimated Facts:** 350–450 (91 topics × ~4 facts avg, weighted by exam %)

**Answer Type Pools (pool-first design):**

| Pool ID | Format | Example Members | Est. Size |
|---------|--------|-----------------|-----------|
| element_names | name | Hydrogen, Carbon, Nitrogen, Oxygen, Sodium, Chlorine, Iron, Copper | 30+ |
| compound_names | name | Water, Sodium chloride, Ammonia, Methane, Glucose, Sulfuric acid | 25+ |
| formula_names | term | H2O, NaCl, NH3, CO2, H2SO4, HCl, NaOH, CH4, C6H12O6 | 25+ |
| reaction_types | term | Synthesis, Decomposition, Single replacement, Double replacement, Combustion, Acid-base, Redox | 8+ |
| law_names | name | Ideal Gas Law, Hess's Law, Le Chatelier's Principle, Dalton's Law, Raoult's Law, Beer-Lambert Law, Faraday's Law, Arrhenius Equation | 12+ |
| bond_types | term | Ionic, Covalent, Metallic, Hydrogen bond, London dispersion, Dipole-dipole, Ion-dipole | 8+ |
| unit_names | term | Mole, Joule, Kelvin, Atmosphere, Molarity, Molality, Pascal, Volt | 10+ |
| bracket_numbers | number | pH values, delta-H values, Ka/Kb values, Keq, electrode potentials, gas constants | 40+ |
| scientist_names | name | Bohr, Lewis, Arrhenius, Bronsted, Lowry, Le Chatelier, Hess, Faraday, Dalton, Avogadro | 15+ |
| molecular_geometry | term | Linear, Bent, Trigonal planar, Tetrahedral, Trigonal bipyramidal, Octahedral, T-shaped, Seesaw | 8+ |
| periodic_trend_names | term | Ionization energy, Electronegativity, Atomic radius, Electron affinity, Metallic character | 6+ |
| thermodynamic_terms | term | Entropy, Enthalpy, Gibbs free energy, Heat capacity, Standard conditions, Spontaneity | 8+ |
| acid_base_terms | term | Conjugate acid, Conjugate base, Amphoteric, Buffer, Equivalence point, Half-equivalence point | 8+ |
| equilibrium_terms | term | Reaction quotient, Equilibrium constant, Le Chatelier shift, Common ion effect, Ksp, Ka, Kb | 8+ |

**Sub-Decks (5 natural groupings):**

| Sub-Deck | Units | Est. Facts | Focus |
|----------|-------|------------|-------|
| Structure & Bonding | 1-2 | ~100 | Atoms, electron config, bonding, Lewis, VSEPR |
| Properties & Reactions | 3-4 | ~120 | IMF, gas laws, solutions, stoichiometry, reaction types |
| Kinetics & Energy | 5-6 | ~80 | Rate laws, mechanisms, catalysis, enthalpy, Hess's Law |
| Equilibrium & Acids-Bases | 7-8 | ~100 | Keq, Le Chatelier, pH, buffers, titrations |
| Thermo & Electrochemistry | 9 | ~50 | Entropy, Gibbs, galvanic cells, Nernst, Faraday |

**Common Confusions (seed pairs):**
- Exothermic vs Endothermic (sign of delta-H)
- Ka vs Kb (acid vs base dissociation)
- Kp vs Kc (pressure vs concentration equilibrium)
- Oxidation vs Reduction (electron loss vs gain)
- Galvanic vs Electrolytic (spontaneous vs non-spontaneous)
- Molarity vs Molality (volume vs mass denominator)
- Rate law vs Equilibrium expression (forward-only vs both directions)
- SN2 Arrhenius vs Bronsted-Lowry acid/base definitions
- Bond energy (breaking = endothermic, forming = exothermic)
- London dispersion vs Dipole-dipole (all molecules vs polar only)

**Cross-Deck Links:**
- Periodic Table deck (element properties, atomic structure)
- AP Biology (biochemistry overlap — water properties, enzymes, pH)
- Medical Terminology (pharmacology — acid-base balance, drug interactions)

**Demand Signals:**
- ~160k AP Chem students/year (US alone)
- "AP Chemistry flashcards" — 80k+ Anki downloads for top shared decks
- r/APChemistry — active subreddit with 15k+ members, frequent "what to study" posts
- Consistently rated one of the hardest AP exams — students desperate for study tools
- Strong memorization component (formulas, constants, reaction types, molecular geometries)

**Why This Deck Will Work:**
- Clean pool structure — chemical formulas, element names, reaction types are highly confusable
- Numeric bracket notation for pH, constants, temperatures — proven system from existing decks
- Natural difficulty curve from easy recognition (element names) to hard reasoning (equilibrium calculations)
- Units 3+8 = 33-37% of exam, creating natural "focus study" sub-decks for high-impact cramming
- CED alignment means students trust the completeness — every testable concept covered

---

### 3.13.2 AP World History: Modern (CED-Aligned Deck)

**Status:** Complete (2026-04-04). 620 facts across 9 CED units.
**Architecture:** `data/deck-architectures/ap_world_history_arch.yaml`
**Deck file:** `data/decks/ap_world_history.json`
**Priority:** **Tier 1** — exam-aligned content, highest-value offering

---

## Section 4: Production Priority Queue

> Ranked by combined score of Demand × Feasibility × Strategic Value. History era decks (from Sections 1-2) are included and ranked against domain decks. This is the definitive build order for the next 20 decks.

| Rank | Deck | Domain | Est. Facts | Demand | Feasibility | Strategic Value | Notes |
|------|------|--------|------------|--------|-------------|-----------------|-------|
| 1 | Human Anatomy — Core Systems | human_body_health | 200-250 | Very High (pre-med, bio students worldwide) | Very High — 2,009 WIP facts ready | Unlocks HB-02/03/04; unblocks MCAT composite | **WIP facts exist; publish immediately** |
| 2 | World War II | history | 220-260 | Very High (highest trivia demand signal globally) | Very High — Wikipedia-rich, architecture YAML exists | Unlocks AP World History composite | Architecture `world_war_ii_arch.yaml` exists |
| 3 | Ancient Rome | history | 180-220 | High (classics students, HBO fans, D&D) | High — Wikidata complete, English sources rich | Unlocks AP World History composite | Pairs with Ancient Greece for study arc |
| 4 | Constellations | space_astronomy | 120-150 | High (stargazers, astrology-adjacent, kids) | Very High — 88 IAU official constellations, clean pool | First new Space deck; mythology crossover | Pool: 88 names, 2 hemispheres, 4 seasons |
| 5 | Famous Inventions & Inventors | general_knowledge | 180-220 | High (trivia fans, students, Jeopardy audience) | High — Wikipedia List of Inventions is authoritative | Opens GK domain; links to TC-01 | Nobel facts as bonus layer |
| 6 | Mammals of the World | animals_wildlife | 150-200 | High (kids + nature fans, massive casual audience) | High — Wikipedia mammal list + Wikidata taxa | Opens Animals domain; broadest age range | Focus on 150 most-recognizable species |
| 7 | Egyptian Mythology | mythology_folklore | 150-200 | High (Egypt interest consistently top-5 globally) | High — Wikipedia + Egyptology sources complete | Completes "Big Three" mythology arc (Greek/Norse/Egyptian) | Cross-sell with History Ancient Egypt deck |
| 8 | Famous Paintings & Artists | art_architecture | 160-200 | High (art history curriculum, museum-goers) | High — Wikipedia "Great Masters" lists complete | Opens Art domain; strong visual card potential | Artist portrait card art opportunity |
| 9 | Ancient Greece | history | 180-220 | High (AP World History, philosophy fans) | High — excellent academic sources | Pairs with Ancient Rome; unlocks composite | Pool: city-states, philosophers, battles |
| 10 | Spices & Herbs of the World | food_cuisine | 120-160 | Medium-High (foodies + culinary students) | Very High — Wikipedia spice list complete, clean pool | Opens Food domain; strong origin-country pool | 70+ spices, clear origin geography |
| 11 | World Rivers & Mountains | geography | 140-180 | High (geography students, AP Human Geo) | High — Wikidata complete, clean lists | Expands Geography beyond drill decks | Pool: 50+ rivers, 50+ peaks, 7 continents |
| 12 | Bones of the Human Body | human_body_health | 120-150 | High (medical students, anatomy classes) | Very High — 206 named bones, Terminologia Anatomica complete | Complements HB-01 Anatomy; pre-med bundle | Cleanest pool in entire pipeline |
| 13 | Nobel Prize Winners | general_knowledge | 180-220 | High (academic community, Jeopardy devotees) | Very High — Nobelprize.org complete through 2025 | Unlocks EP-02 AP Bio (science laureates layer) | 6 categories = 6 natural pool groups |
| 14 | Dinosaurs & Paleontology | natural_sciences | 140-180 | High (kids + museum audience, perennial favorite) | High — Wikipedia paleontology articles complete | Opens kid-audience funnel; NS domain flagship | Pool: 55+ genera, 5 geologic periods |
| 15 | European Countries Deep Dive | geography | 140-180 | Medium-High (European students, travelers) | High — Wikipedia European countries complete | Deepens Geography; enables EU composite | 44 countries, languages, EU membership |
| 16 | Ocean Life | animals_wildlife | 130-170 | High (kids, marine bio, documentary audience) | High — Wikipedia marine life lists complete | Second Animals deck; ocean zone pool | 5 ocean zones = natural difficulty tiers |
| 17 | Ancient Egypt | history | 160-200 | High (popular culture, museum audiences) | High — Egyptology Wikipedia excellent | Cross-sells with Egyptian Mythology (rank 7) | Pool: pharaohs, gods, periods, dynasties |
| 18 | Brain & Neuroscience | human_body_health | 130-170 | High (psychology students, mental health interest) | Medium — requires careful clinical sourcing | Third HB deck; unlocks psychology composite | Pool: 30+ brain regions, 8+ neurotransmitters |
| 19 | Famous Scientists & Discoveries | natural_sciences | 160-200 | High (science students, history of science) | High — Wikipedia and Nobel records complete | Opens NS narrative layer (not just periodic table) | Combines with Nobel deck for mega-deck potential |
| 20 | Monsters & Creatures — World Mythology | mythology_folklore | 130-170 | Medium-High (D&D/TTRPG players, fantasy fans, kids) | High — Wikipedia mythology articles complete | Opens cross-cultural mythology; strong combat art potential | 80+ creatures across 15+ cultures |

**Priority tier summary:**
- **Ranks 1-5** (ship within 60 days): All have either existing WIP content or a clean architecture. Highest demand-per-effort ratio.
- **Ranks 6-12** (ship within 120 days): Domain openers — these are the first deck in their domain, multiplying strategic value.
- **Ranks 13-20** (ship within 180 days): Depth decks — excellent quality but secondary to opening new domains.

---

## Section 5: Summary Statistics

| Domain | Shipped Decks | WIP / Near-Ready | Deck Candidates | Top Priority Deck | Est. Time to First Ship |
|--------|:-------------:|:----------------:|:---------------:|-------------------|------------------------|
| History | 2 (US Presidents, WWII) | WWII (arch YAML ready) | 22 total | Ancient Rome | 2-4 weeks |
| Geography | 4 (Countries, Capitals, Flags, US States) | — | 14 total | World Rivers & Mountains | 4-6 weeks |
| Natural Sciences | 1 (Periodic Table) | Human Anatomy (2,009 facts) | 18 total | Human Anatomy | **1-2 weeks** |
| Space & Astronomy | 2 (Solar System, NASA Missions) | — | 8 total | Constellations | 2-4 weeks |
| Mythology & Folklore / Religion | 3 (Greek, Norse, world_religions) | — | 10 total | Egyptian Mythology | 3-5 weeks |
| Animals & Wildlife | 0 | — | 10 total | Mammals of the World | 4-6 weeks |
| Human Body & Health | 0 | 2,009 anatomy facts in _wip/ | 10 total | Human Anatomy — Core Systems | **1-2 weeks** |
| Art & Architecture | 0 | — | 10 total | Famous Paintings & Artists | 5-7 weeks |
| Food & Cuisine | 0 | — | 8 total | Spices & Herbs | 3-5 weeks |
| General Knowledge | 0 | — | 14 total | Famous Inventions & Inventors | 4-6 weeks |
| Technology & Computing | 0 | Requires new domain setup | 8 total | Computer Science Fundamentals | 6-8 weeks (domain setup first) |
| Sports & Entertainment | 0 | Requires new domain setup | 8 total | Olympic Games History | 6-8 weeks (domain setup first) |
| Language (Vocabulary) | **37** | Portuguese/Italian/Russian next | 22 remaining | Portuguese A1-B2 | 1-2 weeks (pipeline exists) |
| Academic / Exam Prep | 0 | Composite — depends on source decks | 18 total | AP US History | After Tier 1 History ships |
| **TOTAL** | **49** | **~2,200 WIP facts** | **~180 candidates** | — | — |

**Key gaps to close first:**
1. Human Anatomy (WIP facts → published deck) — immediate
2. Open zero-deck domains in priority order: Animals, Art, Food, General Knowledge
3. New domain scaffolding for Technology and Sports before first deck in each

---

*Last updated: 2026-04-08 by docs-agent*

---

## Recently Shipped

| Date | Deck ID | Facts | Sub-decks | Summary |
|---|---|---|---|---|
| 2026-04-08 | `world_religions` | 377 | 7 | World religions survey: Christianity, Islam, Judaism, Hinduism, Buddhism, Sikhism, and 8 other living traditions. Wikipedia CC BY-SA 4.0. |
