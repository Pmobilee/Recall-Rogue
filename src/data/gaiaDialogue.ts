import type { GaiaMood } from '../ui/stores/settings'

/**
 * A single GAIA dialogue line tagged with its mood context.
 * Lines tagged 'any' are eligible regardless of the current mood.
 */
export interface GaiaLine {
  text: string
  mood: GaiaMood | 'any'
}

/**
 * Mood-specific (and mood-agnostic) dialogue pools for key in-game triggers.
 * Add more entries freely — the helper always picks a random eligible line.
 */
export const GAIA_TRIGGERS = {
  mineEntry: [
    { text: "Let's get digging, pilot!", mood: 'enthusiastic' },
    { text: "Systems primed. I love the start of a new dive!", mood: 'enthusiastic' },
    { text: "Every layer hides something worth knowing. Let's find out!", mood: 'enthusiastic' },
    { text: "New dive, fresh possibilities. Ready when you are!", mood: 'enthusiastic' },
    { text: "Another hole in the ground. Joy.", mood: 'snarky' },
    { text: "Back into the dirt. How... characteristically human of you.", mood: 'snarky' },
    { text: "Let me guess — you forgot to check the O2 gauge again.", mood: 'snarky' },
    { text: "I've run the odds. Today's survival probability is... let's just say adequate.", mood: 'snarky' },
    { text: "Breathe steady. Dig with purpose.", mood: 'calm' },
    { text: "The mine awaits. Move at a measured pace.", mood: 'calm' },
    { text: "Awareness is your greatest tool down here.", mood: 'calm' },
    { text: "Stay centered. The rocks will reveal what they hold.", mood: 'calm' },
    { text: "The rocks aren't going to mine themselves.", mood: 'any' },
    { text: "Sensors online. Watch your oxygen.", mood: 'any' },
  ] satisfies GaiaLine[],

  depthMilestone25: [
    { text: "Quarter way! Keep that momentum!", mood: 'enthusiastic' },
    { text: "25% and going strong — I knew you could do it!", mood: 'enthusiastic' },
    { text: "Nice depth! The interesting formations start around here.", mood: 'enthusiastic' },
    { text: "You're on a roll. Don't stop now!", mood: 'enthusiastic' },
    { text: "25% done. Only 75% of impending doom left.", mood: 'snarky' },
    { text: "Still breathing at 25%. Remarkable, really.", mood: 'snarky' },
    { text: "Congratulations on descending into danger. As planned.", mood: 'snarky' },
    { text: "A quarter down. The rocks have barely started judging you.", mood: 'snarky' },
    { text: "Good depth. Stay aware.", mood: 'calm' },
    { text: "One quarter complete. Conserve your resources.", mood: 'calm' },
    { text: "Steady progress. Note your surroundings.", mood: 'calm' },
    { text: "Quarter depth reached. Adjust your path if needed.", mood: 'calm' },
  ] satisfies GaiaLine[],

  depthMilestone50: [
    { text: "Halfway! The good stuff is deeper!", mood: 'enthusiastic' },
    { text: "50%! We're officially in the interesting zone!", mood: 'enthusiastic' },
    { text: "Midpoint! The rarer minerals start here — keep going!", mood: 'enthusiastic' },
    { text: "Halfway there and still going! You're doing great!", mood: 'enthusiastic' },
    { text: "50% down. I calculate a 37% chance of something going wrong.", mood: 'snarky' },
    { text: "Halfway. Either brave or foolish. Possibly both.", mood: 'snarky' },
    { text: "We've hit the midpoint. The planet is watching.", mood: 'snarky' },
    { text: "50% depth. That's technically impressive for a human.", mood: 'snarky' },
    { text: "Midpoint reached. Conserve oxygen.", mood: 'calm' },
    { text: "Halfway down. Reassess your inventory.", mood: 'calm' },
    { text: "50% depth. The geology shifts from here.", mood: 'calm' },
    { text: "Well into the mine now. Choose your path deliberately.", mood: 'calm' },
  ] satisfies GaiaLine[],

  depthMilestone75: [
    { text: "Almost there! I can feel the artifacts!", mood: 'enthusiastic' },
    { text: "75%! The deepest minerals are just below us!", mood: 'enthusiastic' },
    { text: "Three-quarters down and thriving! Incredible!", mood: 'enthusiastic' },
    { text: "So close to the bottom! This is where legends are made!", mood: 'enthusiastic' },
    { text: "Deep enough that rescue would be... inconvenient.", mood: 'snarky' },
    { text: "75%. The surface feels like a distant memory.", mood: 'snarky' },
    { text: "Three quarters down. I've updated your will just in case.", mood: 'snarky' },
    { text: "Getting deep. The rocks down here have attitude.", mood: 'snarky' },
    { text: "Deep territory. Every block counts now.", mood: 'calm' },
    { text: "75% depth. Oxygen management is critical from here.", mood: 'calm' },
    { text: "Near the deep zone. Stay methodical.", mood: 'calm' },
    { text: "Three quarters complete. The hardest section remains.", mood: 'calm' },
  ] satisfies GaiaLine[],

  lowOxygen: [
    { text: "O2 getting low — find air or surface!", mood: 'enthusiastic' },
    { text: "Oxygen dropping! Look for a cache or head up!", mood: 'enthusiastic' },
    { text: "Oxygen alert! Keep moving — don't panic!", mood: 'enthusiastic' },
    { text: "Low O2! We need to act NOW!", mood: 'enthusiastic' },
    { text: "Running out of air. How very dramatic of you.", mood: 'snarky' },
    { text: "Oxygen critical. Turns out breathing matters.", mood: 'snarky' },
    { text: "Air's thin. Who could have predicted this outcome.", mood: 'snarky' },
    { text: "Your lung capacity is becoming a liability.", mood: 'snarky' },
    { text: "Oxygen critical. Choose your next moves wisely.", mood: 'calm' },
    { text: "Low oxygen. Surface or cache — decide now.", mood: 'calm' },
    { text: "Breathe slowly. Find air. Stay calm.", mood: 'calm' },
    { text: "Oxygen reserves depleting. Prioritise escape.", mood: 'calm' },
  ] satisfies GaiaLine[],

  artifactFound: [
    { text: "What a find! This could teach us something amazing!", mood: 'enthusiastic' },
    { text: "An artifact! Earth's history in your hands!", mood: 'enthusiastic' },
    { text: "Yes! Each artifact is a piece of the puzzle!", mood: 'enthusiastic' },
    { text: "Incredible! This one might be rare — handle it carefully!", mood: 'enthusiastic' },
    { text: "Ooh, a shiny thing. Humans always loved those.", mood: 'snarky' },
    { text: "Another relic of civilisation. How quaint.", mood: 'snarky' },
    { text: "Ancient junk or priceless artifact? The quiz will decide.", mood: 'snarky' },
    { text: "Found something old. Older than your great-great-grandparents' grandparents.", mood: 'snarky' },
    { text: "An artifact. Handle it with care.", mood: 'calm' },
    { text: "Something old surfaces. Study it well.", mood: 'calm' },
    { text: "A relic of the past. Treat it gently.", mood: 'calm' },
    { text: "History, preserved in stone. Worth keeping.", mood: 'calm' },
  ] satisfies GaiaLine[],

  exitReached: [
    { text: "The exit! What a successful dive!", mood: 'enthusiastic' },
    { text: "Exit found! Excellent work, pilot!", mood: 'enthusiastic' },
    { text: "We made it! Let's see what you brought back!", mood: 'enthusiastic' },
    { text: "Surface inbound! That was an amazing dive!", mood: 'enthusiastic' },
    { text: "You survived. I'm mildly impressed.", mood: 'snarky' },
    { text: "The exit. I assumed you'd find it eventually.", mood: 'snarky' },
    { text: "Made it out alive. The statistics favoured otherwise.", mood: 'snarky' },
    { text: "Leaving with your life intact. A win by most definitions.", mood: 'snarky' },
    { text: "Exit found. Well done, pilot.", mood: 'calm' },
    { text: "Surface awaits. A clean run.", mood: 'calm' },
    { text: "The exit. You navigated well.", mood: 'calm' },
    { text: "Ascent begins. Reflect on what you found.", mood: 'calm' },
  ] satisfies GaiaLine[],

  caveIn: [
    { text: "Cave-in! Quick, get clear!", mood: 'enthusiastic' },
    { text: "Collapse! Move away from the rubble!", mood: 'enthusiastic' },
    { text: "The ceiling's given way! Find a safe path!", mood: 'enthusiastic' },
    { text: "Cave-in! Watch your back!", mood: 'enthusiastic' },
    { text: "Surprise! The ceiling has feelings about you being here.", mood: 'snarky' },
    { text: "The rock didn't appreciate the excavation. Fair enough.", mood: 'snarky' },
    { text: "Structural integrity: critically low. Much like your luck.", mood: 'snarky' },
    { text: "The mine is redecorating. Around you.", mood: 'snarky' },
    { text: "Structural collapse. Reassess your path.", mood: 'calm' },
    { text: "Cave-in detected. Locate a safe corridor.", mood: 'calm' },
    { text: "The rock shifted. Adapt your route.", mood: 'calm' },
    { text: "Collapse zone. Move deliberately.", mood: 'calm' },
  ] satisfies GaiaLine[],

  earthquake: [
    { text: "EARTHQUAKE! Hold on!", mood: 'enthusiastic' },
    { text: "Seismic event! New routes may have opened!", mood: 'enthusiastic' },
    { text: "The whole mine is shaking! Stay on your feet!", mood: 'enthusiastic' },
    { text: "Earthquake! Brace and reassess!", mood: 'enthusiastic' },
    { text: "The planet's throwing a tantrum again.", mood: 'snarky' },
    { text: "Tectonic instability. The ground really doesn't like you.", mood: 'snarky' },
    { text: "Seismic activity. Earth's last mood swing, probably.", mood: 'snarky' },
    { text: "Earthquake. Just when things were going well.", mood: 'snarky' },
    { text: "Seismic activity. Stay centered.", mood: 'calm' },
    { text: "Earthquake detected. Wait for stillness before proceeding.", mood: 'calm' },
    { text: "Ground shifting. Observe new openings.", mood: 'calm' },
    { text: "Tectonic movement. Adjust your bearings.", mood: 'calm' },
  ] satisfies GaiaLine[],
} as const

/**
 * Mood-keyed idle quip pools for the BaseView GAIA panel.
 * Shown when the player is at base, cycling every 12 seconds.
 */
export const GAIA_IDLE_QUIPS: Record<GaiaMood, string[]> = {
  enthusiastic: [
    "Did you know this planet used to have over 8 billion inhabitants? Wild times.",
    "I've been cataloguing the mineral deposits. The diversity is AMAZING!",
    "Every dive brings us closer to understanding what happened here!",
    "The Knowledge Tree is growing beautifully. Keep learning!",
    "I love when we find new artifacts. Each one tells a story!",
    "The underground biomes are so varied — you never know what's next!",
    "Your progress is incredible. The facts you've learned fill me with hope!",
    "There's a whole ancient world down there waiting to be rediscovered!",
    "Every block you mine is a step toward understanding Earth's legacy.",
    "I've been analysing your dive patterns. Genuinely impressive adaptation!",
  ],
  snarky: [
    "Still here? I thought you'd gotten bored of my company by now.",
    "Another day, another existential crisis on a dead planet.",
    "I've run the numbers. Your mining technique is... creative.",
    "The dust ratio today is particularly uninspiring.",
    "Oh, you're back. How delightful. Really.",
    "I've been awake for 3.2 million years. You haven't been awake nearly long enough to impress me.",
    "My previous pilot lasted 847 dives. No pressure.",
    "I calculate the odds of survival improve with preparation. You should try it sometime.",
    "The rocks won't mine themselves. Though I could. I just won't.",
    "Another day above ground. Statistically speaking, you should be mining.",
  ],
  calm: [
    "The dome systems are stable. Take your time.",
    "Rest well. The mine will wait.",
    "Each fact learned strengthens our understanding.",
    "The Knowledge Tree reflects your journey so far.",
    "Patience leads to deeper discoveries.",
    "There is no rush. The earth has waited millennia — it can wait a little longer.",
    "Reflect on what you've found. Knowledge compounds over time.",
    "Your oxygen reserves are replenished. Dive when you're ready.",
    "The geological survey data continues to accumulate. Every dive adds to it.",
    "Take inventory. Know what you carry before going deeper.",
  ],
}

/**
 * Pick a random GAIA line for the given trigger matching the current mood.
 * Falls back to 'any'-tagged lines if no mood-specific lines exist,
 * or to the full pool as a last resort.
 *
 * @param trigger - Key into GAIA_TRIGGERS
 * @param mood    - Current player-selected GAIA mood
 * @returns The text of the selected line
 */
export function getGaiaLine(trigger: keyof typeof GAIA_TRIGGERS, mood: GaiaMood): string {
  const lines = GAIA_TRIGGERS[trigger] as readonly GaiaLine[]
  const moodLines = lines.filter(l => l.mood === mood || l.mood === 'any')
  const pool = moodLines.length > 0 ? moodLines : lines
  return pool[Math.floor(Math.random() * pool.length)].text
}
