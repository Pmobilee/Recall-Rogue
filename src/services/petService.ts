import { getRandomPersonality, findSynergy, type PetPersonality, type PetMood, type CompanionSynergy } from '../data/petPersonalities'

/** Pet instance with personality */
export interface PetInstance {
  id: string
  species: string
  name: string
  personality: PetPersonality
  mood: PetMood
  hunger: number          // 0-100 (100 = full)
  energy: number          // 0-100 (100 = rested)
  happiness: number       // 0-100 (100 = very happy)
  bondLevel: number       // 0-100 (increases with interaction)
}

class PetService {
  private pets: Map<string, PetInstance> = new Map()

  /** Register a new pet with random personality */
  addPet(id: string, species: string, name: string): PetInstance | null {
    const personality = getRandomPersonality(species)
    if (!personality) return null

    const pet: PetInstance = {
      id, species, name, personality,
      mood: 'neutral', hunger: 70, energy: 80, happiness: 60, bondLevel: 0
    }
    this.pets.set(id, pet)
    return pet
  }

  /** Feed a pet */
  feed(petId: string): { mood: PetMood; message: string } | null {
    const pet = this.pets.get(petId)
    if (!pet) return null
    pet.hunger = Math.min(100, pet.hunger + 30)
    pet.happiness = Math.min(100, pet.happiness + 10)
    pet.bondLevel = Math.min(100, pet.bondLevel + 2)
    pet.mood = pet.hunger > 80 ? 'happy' : 'neutral'
    const messages = pet.personality.moodResponses[pet.mood]
    return { mood: pet.mood, message: messages[Math.floor(Math.random() * messages.length)] }
  }

  /** Play with a pet */
  play(petId: string): { mood: PetMood; message: string } | null {
    const pet = this.pets.get(petId)
    if (!pet) return null
    pet.happiness = Math.min(100, pet.happiness + 20)
    pet.energy = Math.max(0, pet.energy - 15)
    pet.bondLevel = Math.min(100, pet.bondLevel + 5)
    pet.mood = pet.energy < 20 ? 'sleepy' : 'excited'
    const messages = pet.personality.moodResponses[pet.mood]
    return { mood: pet.mood, message: messages[Math.floor(Math.random() * messages.length)] }
  }

  /** Rest a pet */
  rest(petId: string): { mood: PetMood; message: string } | null {
    const pet = this.pets.get(petId)
    if (!pet) return null
    pet.energy = Math.min(100, pet.energy + 40)
    pet.mood = 'sleepy'
    const messages = pet.personality.moodResponses[pet.mood]
    return { mood: pet.mood, message: messages[Math.floor(Math.random() * messages.length)] }
  }

  /** Get pet by ID */
  getPet(petId: string): PetInstance | null {
    return this.pets.get(petId) ?? null
  }

  /** Get all pets */
  getAllPets(): PetInstance[] {
    return [...this.pets.values()]
  }

  /** Check synergy between two active companions */
  checkSynergy(speciesA: string, speciesB: string): CompanionSynergy | null {
    return findSynergy(speciesA, speciesB)
  }

  /** Update mood based on needs (called periodically) */
  updateMood(petId: string): void {
    const pet = this.pets.get(petId)
    if (!pet) return
    if (pet.hunger < 20) pet.mood = 'hungry'
    else if (pet.energy < 20) pet.mood = 'sleepy'
    else if (pet.happiness > 80) pet.mood = 'happy'
    else if (pet.happiness < 30) pet.mood = 'sad'
    else pet.mood = 'neutral'
  }

  /** Decay needs over time (call every few minutes) */
  decayNeeds(): void {
    for (const pet of this.pets.values()) {
      pet.hunger = Math.max(0, pet.hunger - 2)
      pet.energy = Math.max(0, pet.energy - 1)
      pet.happiness = Math.max(0, pet.happiness - 1)
      this.updateMood(pet.id)
    }
  }
}

export const petService = new PetService()
