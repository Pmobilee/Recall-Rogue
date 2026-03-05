/** Readable wall-text entries found on cavern walls in rest alcoves. */
export interface CavernText {
  id: string
  biome: string           // biome id or 'any'
  title: string           // short title shown in modal header
  content: string         // 2–5 sentences of readable text
  textType: 'journal' | 'inscription' | 'record' | 'fragment'
}

export const CAVERN_TEXTS: CavernText[] = [
  // === JOURNAL ENTRIES (universal) ===
  {
    id: 'ct_journal_01',
    biome: 'any',
    title: "Researcher's Journal — Entry 147",
    textType: 'journal',
    content: 'Day 147. The lower strata contain something the surface instruments cannot explain. A resonance. I have begun to think the planet is not dead — merely dormant. If you are reading this, I did not make it back.',
  },
  {
    id: 'ct_journal_02',
    biome: 'any',
    title: "Researcher's Journal — Entry 203",
    textType: 'journal',
    content: 'The drill bit snapped at 400 meters. We switched to thermal boring. The rock here resists in ways that feel almost intentional, as though the Earth remembers what we did to the surface and is reluctant to let us deeper.',
  },
  {
    id: 'ct_journal_03',
    biome: 'any',
    title: 'Field Notes — Dr. Vasquez',
    textType: 'journal',
    content: 'The sediment layers tell a story clearer than any history book. Fire. Flood. Ice. Fire again. Each catastrophe left its signature. The planet survived all of them. We did not.',
  },
  {
    id: 'ct_journal_04',
    biome: 'any',
    title: "Researcher's Journal — Entry 89",
    textType: 'journal',
    content: 'Found another oxygen pocket today. The air tastes ancient — millions of years sealed away. My instruments say it is breathable. My instincts say I am borrowing something that was never meant for me.',
  },
  {
    id: 'ct_journal_05',
    biome: 'any',
    title: 'Mining Log — Shift 14',
    textType: 'journal',
    content: 'The crew has started hearing things. Low hums. Rhythmic clicks. The geologist says it is thermal expansion in the rock. Nobody believes her. Nobody wants to be the first to say what we all think it sounds like.',
  },
  {
    id: 'ct_journal_06',
    biome: 'any',
    title: "Researcher's Journal — Final Entry",
    textType: 'journal',
    content: 'I leave these notes for whoever comes next. The deeper you go, the more the Earth reveals. Not just minerals and fossils, but something like memory. Treat it gently. It has been through enough.',
  },
  {
    id: 'ct_journal_07',
    biome: 'any',
    title: 'Supply Manifest — Expedition 9',
    textType: 'journal',
    content: 'Remaining: 4 oxygen canisters, 2 ration packs, 1 functioning drill. Morale: low. Mineral yield: extraordinary. The deeper layers contain more wealth than the entire surface economy produced in a decade. If only we could carry it all back up.',
  },

  // === BIOME-SPECIFIC INSCRIPTIONS ===
  {
    id: 'ct_inscription_01',
    biome: 'crystal_geode',
    title: 'Crystal-Etched Runes',
    textType: 'inscription',
    content: 'The symbols are carved into the crystal face with impossible precision. They predate any known alphabet by millennia. The crystals grew around the inscriptions, preserving them like amber preserves insects.',
  },
  {
    id: 'ct_inscription_02',
    biome: 'obsidian_rift',
    title: 'Obsidian Wall Carving',
    textType: 'inscription',
    content: 'Crude figures etched into volcanic glass. People fleeing upward. A great fire below. The artist captured genuine terror in simple lines. This eruption was witnessed. This suffering was real.',
  },
  {
    id: 'ct_inscription_03',
    biome: 'fossil_layer',
    title: 'Bone-Ink Pictograph',
    textType: 'inscription',
    content: 'Painted with pigments derived from ancient bone. The images show creatures that no living person has ever seen, depicted with an accuracy that suggests direct observation across impossible timescales.',
  },
  {
    id: 'ct_inscription_04',
    biome: 'iron_seam',
    title: 'Rust-Stained Marker',
    textType: 'inscription',
    content: 'MINING DEPTH LIMIT — SECTOR 7. BY ORDER OF THE SURFACE COUNCIL. DO NOT DESCEND PAST THIS POINT. The iron bolts holding the sign have rusted into the wall, becoming part of the geology they tried to govern.',
  },
  {
    id: 'ct_inscription_05',
    biome: 'limestone_caves',
    title: 'Smooth Wall Engraving',
    textType: 'inscription',
    content: 'Water carved this cave over ten thousand years. Someone carved these words in an afternoon. Both acts created something permanent. Both artists are gone. Only the limestone remains.',
  },
  {
    id: 'ct_inscription_06',
    biome: 'deep_biolume',
    title: 'Luminous Script',
    textType: 'inscription',
    content: 'The writing glows with the same blue-green as the surrounding fungi. Either the ink was derived from them, or the fungi grew to match the ink. The text is illegible but beautiful — more art than language.',
  },

  // === GEOLOGICAL/SCIENTIFIC RECORDS ===
  {
    id: 'ct_record_01',
    biome: 'fossil_layer',
    title: 'Geological Survey Record',
    textType: 'record',
    content: 'Survey Site 7-G. Fossil density: exceptional. Species present: Cretaceous marine fauna, approximately 66 million years old. Evidence of rapid burial event consistent with bolide impact theory. Three specimens show signs of healing prior to death.',
  },
  {
    id: 'ct_record_02',
    biome: 'magma_shelf',
    title: 'Thermal Survey — Section 12',
    textType: 'record',
    content: 'Ambient temperature: 47°C and rising. Geothermal gradient exceeds predicted models by 340%. Magma proximity estimated at 200 meters. Recommendation: cease drilling immediately. Addendum: recommendation was overridden.',
  },
  {
    id: 'ct_record_03',
    biome: 'salt_flats',
    title: 'Mineral Assay Report',
    textType: 'record',
    content: 'Sample composition: 94.2% halite, 3.1% sylvite, 2.7% trace minerals including lithium compounds at commercially viable concentrations. This salt flat was once an inland sea. The ocean retreated. The minerals stayed.',
  },
  {
    id: 'ct_record_04',
    biome: 'granite_canyon',
    title: 'Structural Integrity Report',
    textType: 'record',
    content: 'Load-bearing analysis of Canyon Section B-4: stable for an estimated 2.3 million additional years under current tectonic stress. Human mining operations reduce this estimate to approximately six months.',
  },
  {
    id: 'ct_record_05',
    biome: 'coal_veins',
    title: 'Carbon Dating Results',
    textType: 'record',
    content: 'Sample origin: Carboniferous period, approximately 300 million years before present. These coal seams were once vast swamp forests. Every shovelful contains the compressed remains of trees that grew before flowers existed.',
  },
  {
    id: 'ct_record_06',
    biome: 'sulfur_springs',
    title: 'Chemical Analysis — Spring Water',
    textType: 'record',
    content: 'pH: 2.1. Sulfuric acid concentration: 0.05 mol/L. Temperature: 62°C. Bacterial colonies detected: extremophiles of unknown taxonomy. Life persists here in conditions that would dissolve steel. Remarkable.',
  },

  // === STORY FRAGMENTS ===
  {
    id: 'ct_fragment_01',
    biome: 'any',
    title: 'Torn Page',
    textType: 'fragment',
    content: 'They said the surface would recover in a century. Then they said a millennium. Then they stopped making predictions entirely. The last generation to see blue sky died arguing about whose fault it was.',
  },
  {
    id: 'ct_fragment_02',
    biome: 'pressure_dome',
    title: 'Pressurized Capsule Note',
    textType: 'fragment',
    content: 'To whoever finds this: we went deeper because the surface was no longer viable. We built down. We adapted. For a while, it worked. The pressure changes you — not just physically. You start to think like the rock. Patient. Compressed. Dense.',
  },
  {
    id: 'ct_fragment_03',
    biome: 'temporal_rift',
    title: 'Undated Manuscript',
    textType: 'fragment',
    content: 'Time moves differently here. I set my watch by the surface clock and lost three days in what felt like an hour. Or gained them. The rift does not distinguish between past and future. Neither do I, anymore.',
  },
  {
    id: 'ct_fragment_04',
    biome: 'tectonic_scar',
    title: 'Emergency Broadcast Transcript',
    textType: 'fragment',
    content: 'This is Station 14. The fault line shifted 200 meters in eleven seconds. The lower tunnels are gone. Repeat: the lower tunnels are gone. If anyone can receive this signal, do not attempt rescue. There is nothing left to rescue.',
  },
  {
    id: 'ct_fragment_05',
    biome: 'iron_core_fringe',
    title: 'Core Expedition Log',
    textType: 'fragment',
    content: 'We reached the boundary. Beyond this point, the metal is liquid and the temperature exceeds our equipment ratings. The planet has a heartbeat — I felt it through the drill shaft. Slow. Immense. Alive.',
  },
  {
    id: 'ct_fragment_06',
    biome: 'alien_intrusion',
    title: 'Classification: Unknown',
    textType: 'fragment',
    content: 'The material does not match any known terrestrial mineral. Crystalline structure is hexagonal but with a seventh axis that should not geometrically exist. Origin: not this planet. Not this solar system. Possibly not this universe.',
  },
]
