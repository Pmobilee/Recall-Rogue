/** Pet personality traits */
export type PersonalityTrait = 'playful' | 'curious' | 'loyal' | 'stubborn' | 'timid' | 'brave' | 'lazy' | 'energetic'

/** Pet mood states */
export type PetMood = 'happy' | 'neutral' | 'sad' | 'excited' | 'sleepy' | 'hungry'

/** Pet personality profile */
export interface PetPersonality {
  primary: PersonalityTrait
  secondary: PersonalityTrait
  quirk: string                // Unique behavioral quirk
  favoriteActivity: 'mining' | 'studying' | 'exploring' | 'socializing'
  favoriteMineral: string
  moodResponses: Record<PetMood, string[]>
}

/** Personality templates per species */
export const PET_PERSONALITY_TEMPLATES: Record<string, PetPersonality[]> = {
  trilobite: [
    {
      primary: 'curious', secondary: 'timid', quirk: 'Hides behind rocks when startled, then peeks out with one eye',
      favoriteActivity: 'exploring', favoriteMineral: 'greyMatter',
      moodResponses: {
        happy: ['Trilobite clicks its mandibles contentedly.', 'It rolls into a ball and back out — its version of a happy dance.'],
        neutral: ['Trilobite surveys the area methodically.', 'It taps its antennae against the ground.'],
        sad: ['Trilobite curls into a tight ball.', 'It hides under the nearest ledge.'],
        excited: ['Trilobite skitters in rapid circles!', 'Its compound eyes gleam with ancient curiosity!'],
        sleepy: ['Trilobite settles into a sandy depression.', 'It tucks its legs in and goes still.'],
        hungry: ['Trilobite probes the ground with its antennae.', 'It nudges your hand expectantly.']
      }
    }
  ],
  crystal_fox: [
    {
      primary: 'playful', secondary: 'brave', quirk: 'Chases its own crystalline tail reflections',
      favoriteActivity: 'mining', favoriteMineral: 'crystal',
      moodResponses: {
        happy: ['Crystal Fox\'s fur shimmers with prismatic light!', 'It yips and bounces, leaving tiny crystal footprints.'],
        neutral: ['Crystal Fox grooms its faceted fur carefully.', 'It sits regally, light refracting through its mane.'],
        sad: ['Crystal Fox\'s fur dims to a dull gray.', 'It whimpers softly, tail tucked.'],
        excited: ['Crystal Fox howls, sending rainbow shards through the air!', 'It races around the dome at impossible speed!'],
        sleepy: ['Crystal Fox curls into a glowing ball of light.', 'It yawns, revealing tiny crystal teeth.'],
        hungry: ['Crystal Fox sniffs at mineral deposits hopefully.', 'It paws at your pack, nose twitching.']
      }
    }
  ],
  moss_turtle: [
    {
      primary: 'loyal', secondary: 'lazy', quirk: 'Small plants grow on its shell that change with the seasons',
      favoriteActivity: 'studying', favoriteMineral: 'shard',
      moodResponses: {
        happy: ['Moss Turtle\'s shell blooms with tiny flowers.', 'It nudges your ankle gently — its version of a hug.'],
        neutral: ['Moss Turtle plods along steadily.', 'The moss on its shell sways gently.'],
        sad: ['Moss Turtle retreats into its shell.', 'The plants on its back droop.'],
        excited: ['Moss Turtle lifts its head high — that\'s fast for a turtle!', 'New buds sprout on its shell.'],
        sleepy: ['Moss Turtle pulls into its shell for a nap.', 'Gentle snoring. Even the moss seems to rest.'],
        hungry: ['Moss Turtle eyes the mineral pile.', 'It opens its mouth wide — surprisingly large for its size.']
      }
    }
  ],
  lava_gecko: [
    {
      primary: 'energetic', secondary: 'stubborn', quirk: 'Leaves warm footprints wherever it walks',
      favoriteActivity: 'mining', favoriteMineral: 'geode',
      moodResponses: {
        happy: ['Lava Gecko glows a bright orange!', 'It does push-ups on a rock. Showing off.'],
        neutral: ['Lava Gecko basks on the warmest surface.', 'Its ember-colored eyes scan the room.'],
        sad: ['Lava Gecko\'s glow dims to a faint ember.', 'It presses against the coldest wall — unusual behavior.'],
        excited: ['Lava Gecko\'s tail ignites with flame!', 'It races up walls and across the ceiling!'],
        sleepy: ['Lava Gecko curls around a warm pipe.', 'Its glow pulses slowly — breathing fire in its sleep.'],
        hungry: ['Lava Gecko stares at your minerals with intense heat.', 'Small smoke wisps rise from its nostrils.']
      }
    }
  ],
  void_moth: [
    {
      primary: 'timid', secondary: 'curious', quirk: 'Its wings display faint star patterns that match the current night sky',
      favoriteActivity: 'studying', favoriteMineral: 'essence',
      moodResponses: {
        happy: ['Void Moth\'s wings shimmer with constellations.', 'It flutters in slow, graceful circles around your head.'],
        neutral: ['Void Moth rests on your shoulder, wings folded.', 'Its antennae twitch, sensing invisible signals.'],
        sad: ['Void Moth\'s wings go dark.', 'It hides in the deepest shadow it can find.'],
        excited: ['Void Moth\'s wings blaze with nebula colors!', 'It leaves a trail of starlight as it flies!'],
        sleepy: ['Void Moth hangs upside down, wings wrapped tight.', 'The stars on its wings dim to a gentle twinkle.'],
        hungry: ['Void Moth circles the essence storage.', 'Its proboscis extends hopefully.']
      }
    }
  ]
}

/** Companion synergy bonuses when paired together */
export interface CompanionSynergy {
  companionA: string
  companionB: string
  synergyName: string
  description: string
  bonus: {
    type: 'mineral_bonus' | 'fact_bonus' | 'defense_bonus' | 'speed_bonus'
          | 'o2_bonus' | 'quiz_bonus' | 'xp_bonus'
    magnitude: number
  }
}

export const COMPANION_SYNERGIES: CompanionSynergy[] = [
  { companionA: 'crystal_fox', companionB: 'lava_gecko', synergyName: 'Elemental Duo', description: 'Crystal and fire combine: +15% mineral drops', bonus: { type: 'mineral_bonus', magnitude: 0.15 } },
  { companionA: 'moss_turtle', companionB: 'void_moth', synergyName: 'Scholar\'s Pair', description: 'Calm wisdom meets cosmic curiosity: +10% fact quality', bonus: { type: 'fact_bonus', magnitude: 0.10 } },
  { companionA: 'trilobite', companionB: 'moss_turtle', synergyName: 'Ancient Bond', description: 'Two ancient survivors: +20% defense', bonus: { type: 'defense_bonus', magnitude: 0.20 } },
  { companionA: 'crystal_fox', companionB: 'void_moth', synergyName: 'Light & Shadow', description: 'Prismatic and void energies intertwine: +10% speed', bonus: { type: 'speed_bonus', magnitude: 0.10 } },
  { companionA: 'lava_gecko', companionB: 'trilobite', synergyName: 'Fire & Earth', description: 'Volcanic heat meets primordial shell: +12% mineral drops', bonus: { type: 'mineral_bonus', magnitude: 0.12 } },
]

/** Get personality for a pet species (random from available templates) */
export function getRandomPersonality(species: string): PetPersonality | null {
  const templates = PET_PERSONALITY_TEMPLATES[species]
  if (!templates || templates.length === 0) return null
  return templates[Math.floor(Math.random() * templates.length)]
}

/** Find synergy between two companions */
export function findSynergy(speciesA: string, speciesB: string): CompanionSynergy | null {
  return COMPANION_SYNERGIES.find(s =>
    (s.companionA === speciesA && s.companionB === speciesB) ||
    (s.companionA === speciesB && s.companionB === speciesA)
  ) ?? null
}
