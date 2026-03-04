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

  hazardLava: [
    { text: "LAVA! Move! That stuff will cook you alive!", mood: 'enthusiastic' },
    { text: "Active lava flow! Get clear of the hot zone — NOW!", mood: 'enthusiastic' },
    { text: "You're standing in lava! That's going to hurt!", mood: 'enthusiastic' },
    { text: "Molten rock detected. Move before your O2 is the least of your worries!", mood: 'enthusiastic' },
    { text: "Oh, you found the lava. Congratulations on your catastrophic choice.", mood: 'snarky' },
    { text: "I did warn you about the thermal readings. I did.", mood: 'snarky' },
    { text: "Lava: nature's way of saying you went too far.", mood: 'snarky' },
    { text: "Your suit is rated for a lot of things. That is not one of them.", mood: 'snarky' },
    { text: "Thermal hazard contact. Evacuate the cell immediately.", mood: 'calm' },
    { text: "Lava flow detected. Retreat and reassess your path.", mood: 'calm' },
    { text: "High-temperature contact. Oxygen reserves declining.", mood: 'calm' },
    { text: "Active lava. Find an alternate route.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fallback pet commentary for any species without a dedicated pool. */
  petCommentaryGeneric: [
    { text: "Your fossil companion has been watching me. I think it approves.", mood: 'enthusiastic' },
    { text: "Scientifically speaking, that creature should not exist. And yet here we both are.", mood: 'snarky' },
    { text: "The companion fauna appears stable and content.", mood: 'calm' },
    { text: "Look at it go! Your fossil friend is full of surprises.", mood: 'enthusiastic' },
    { text: "It's staring at me again. I'm choosing to interpret that as admiration.", mood: 'snarky' },
    { text: "Fossil companion status: nominal.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Species-specific commentary for trilobite companions. */
  petCommentaryTrilobite: [
    { text: "That trilobite has been staring at me for 20 minutes. Tell it to stop.", mood: 'snarky' },
    { text: "It has 360-degree compound vision. It can see me judging it. We're even.", mood: 'snarky' },
    { text: "Your trilobite is making clicking noises. I don't speak Cambrian.", mood: 'snarky' },
    { text: "Fun fact: trilobites had compound eyes that gave them nearly 360-degree vision.", mood: 'enthusiastic' },
    { text: "Trilobites survived three mass extinctions before their luck ran out. Respect.", mood: 'enthusiastic' },
    { text: "Your trilobite is one of the most successful body plans in Earth's history!", mood: 'enthusiastic' },
    { text: "Trilobita observation: specimen alert and responsive.", mood: 'calm' },
    { text: "Trilobite locomotion patterns consistent with a healthy specimen.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Species-specific commentary for ammonite companions. */
  petCommentaryAmmonite: [
    { text: "Your ammonite's shell follows a perfect logarithmic spiral.", mood: 'enthusiastic' },
    { text: "Ammonites swam these ancient seas for 330 million years. Magnificent lineage!", mood: 'enthusiastic' },
    { text: "That ammonite is moving in circles. Either exploring or mocking my orbit calculations.", mood: 'snarky' },
    { text: "It keeps bumping into walls. For an animal that survived the Triassic, questionable navigation.", mood: 'snarky' },
    { text: "The ammonite specimen appears to be acclimating to the dome's atmospheric pressure.", mood: 'calm' },
    { text: "Shell integrity confirmed. Ammonite companion within normal parameters.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Species-specific commentary for mammoth companions. */
  petCommentaryMammoth: [
    { text: "A MAMMOTH. In a DOME. On a FUTURE EARTH.", mood: 'enthusiastic' },
    { text: "It's incredible — a creature that went extinct 4,000 years ago is right here with us!", mood: 'enthusiastic' },
    { text: "Your mammoth just knocked over a sensor array.", mood: 'snarky' },
    { text: "It's large, it's woolly, and it has no respect for dome infrastructure.", mood: 'snarky' },
    { text: "Woolly mammoth: core temperature stable, appetite normal.", mood: 'calm' },
    { text: "Mammoth acclimatisation to dome environment proceeding within expected range.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Commentary triggered when the player feeds their pet. */
  petEating: [
    { text: "Feeding time! Your pet is experiencing the finest mineral paste.", mood: 'enthusiastic' },
    { text: "Look at it eat! So enthusiastically prehistoric!", mood: 'enthusiastic' },
    { text: "Feeding acknowledged. Caloric intake within expected parameters.", mood: 'calm' },
    { text: "Nutrition cycle logged. Your companion appreciates the care.", mood: 'calm' },
    { text: "You're feeding it again. Either very attentive or attempting a bribe.", mood: 'snarky' },
    { text: "Another meal. At this rate, it'll outlive both of us.", mood: 'snarky' },
  ] satisfies GaiaLine[],

  /** Commentary triggered when the pet enters a rest/sleep state. */
  petSleeping: [
    { text: "Your companion is asleep. Peak fossil energy restoration.", mood: 'enthusiastic' },
    { text: "It sleeps. Billions of years of evolution, and sleep is still good.", mood: 'snarky' },
    { text: "Even ancient apex creatures need a nap eventually. Relatable.", mood: 'snarky' },
    { text: "Companion rest cycle active.", mood: 'calm' },
    { text: "Pet in sleep state. Do not disturb.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Commentary triggered when the pet joins a dive as a companion. */
  petPlaying: [
    { text: "Your companion is joining the dive! Either brave or you underestimate what's down there.", mood: 'enthusiastic' },
    { text: "A fossil creature, going underground — where its ancestors once lived. Beautiful.", mood: 'enthusiastic' },
    { text: "Taking your fossil friend underground. Where it came from. Very philosophical.", mood: 'snarky' },
    { text: "Your pet has decided to join the excavation. I give it a 40% survival rating.", mood: 'snarky' },
    { text: "Companion dive initiated. Keep an eye on your pet.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Idle thought bubbles shown in the dome/base view when the player is not actively doing anything.
   * ~8 per mood, shown as floating cards with auto-dismiss. (Phase 15.2)
   */
  idleThoughtBubble: [
    { text: "Did you know that some deep-sea fish produce their own light? Wonder what's down in layer 20...", mood: 'enthusiastic' },
    { text: "I've been cross-referencing the mineral samples from your last dive. The patterns are FASCINATING!", mood: 'enthusiastic' },
    { text: "The Knowledge Tree is growing! Every fact you learn adds a new branch. Keep it up!", mood: 'enthusiastic' },
    { text: "I detected trace biosignatures in that last rock stratum. This planet is full of surprises!", mood: 'enthusiastic' },
    { text: "You know what would make today even better? Discovering a new layer together!", mood: 'enthusiastic' },
    { text: "Ancient Earth had over a million species of insects alone. Imagine what the deep layers hold!", mood: 'enthusiastic' },
    { text: "Your dive stats are trending upward! I love tracking your progress!", mood: 'enthusiastic' },
    { text: "The dome pressure is perfect right now. A great time to head down and explore!", mood: 'enthusiastic' },
    { text: "Staring at the dome again? There are rocks to mine. Just a thought.", mood: 'snarky' },
    { text: "I've been running diagnostics to stay occupied. Some of us have to be productive.", mood: 'snarky' },
    { text: "The mine won't excavate itself. Although, technically, I could set that up. I won't though.", mood: 'snarky' },
    { text: "Three million years of Earth history down there and you're up here. Interesting choice.", mood: 'snarky' },
    { text: "I've catalogued 847 things that could go wrong on your next dive. Let me know if you want the list.", mood: 'snarky' },
    { text: "Minerals don't mine themselves. I checked. Twice.", mood: 'snarky' },
    { text: "The dome systems are operating at peak efficiency. Unlike certain pilots I know.", mood: 'snarky' },
    { text: "You've been up here a while. The rocks are starting to feel neglected.", mood: 'snarky' },
    { text: "The dome systems are at optimal pressure. A good moment to reflect on what you've learned.", mood: 'calm' },
    { text: "There is wisdom in rest. But also wisdom in descent. Both have their time.", mood: 'calm' },
    { text: "The geological survey continues to accumulate data. Each dive adds clarity.", mood: 'calm' },
    { text: "Ancient civilisations lived on this surface for millennia. The layers below remember them.", mood: 'calm' },
    { text: "Knowledge retained is knowledge compounded. Your progress is building toward something.", mood: 'calm' },
    { text: "The oxygen reserves are stable. Dive when you feel ready.", mood: 'calm' },
    { text: "Patience yields depth. Both in mining and in understanding.", mood: 'calm' },
    { text: "Every layer you have explored holds echoes of Earth's past. There is more to find.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Study suggestion bubbles triggered when facts are approaching their due date.
   * Variables: {{factStatement}}, {{dueIn}} — substituted at runtime. (Phase 15.2)
   */
  studySuggestionDue: [
    { text: "Your memory of '{{factStatement}}' is due for review {{dueIn}}. Want to keep it sharp?", mood: 'enthusiastic' },
    { text: "Quick! '{{factStatement}}' needs a review {{dueIn}}. Let's keep that knowledge fresh!", mood: 'enthusiastic' },
    { text: "Review time incoming! '{{factStatement}}' is due {{dueIn}}. You've got this!", mood: 'enthusiastic' },
    { text: "'{{factStatement}}' — review due {{dueIn}}. You can do this now. Or ignore me.", mood: 'snarky' },
    { text: "Reminder: '{{factStatement}}' is due {{dueIn}}. Just in case you care about retention.", mood: 'snarky' },
    { text: "Your spaced repetition schedule says '{{factStatement}}' needs review {{dueIn}}. Statistics don't lie.", mood: 'snarky' },
    { text: "'{{factStatement}}' is scheduled for review {{dueIn}}. Worth keeping current.", mood: 'calm' },
    { text: "A review of '{{factStatement}}' is due {{dueIn}}. Consistency aids long-term retention.", mood: 'calm' },
    { text: "{{dueIn}}, '{{factStatement}}' will need your attention. Plan accordingly.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Near-mastery study suggestion bubbles for facts close to the mastery threshold.
   * Variables: {{factStatement}}, {{reviewsLeft}}, {{plural}} — substituted at runtime. (Phase 15.2)
   */
  studySuggestionNearMastery: [
    { text: "'{{factStatement}}' is only {{reviewsLeft}} review{{plural}} from mastery! So close!", mood: 'enthusiastic' },
    { text: "Almost there! '{{factStatement}}' needs just {{reviewsLeft}} more review{{plural}} to reach mastery!", mood: 'enthusiastic' },
    { text: "{{reviewsLeft}} review{{plural}} stand between you and mastering '{{factStatement}}'! Let's go!", mood: 'enthusiastic' },
    { text: "'{{factStatement}}' — {{reviewsLeft}} review{{plural}} from mastered. You've come this far.", mood: 'snarky' },
    { text: "Technically, {{reviewsLeft}} more review{{plural}} and '{{factStatement}}' is yours forever. Technically.", mood: 'snarky' },
    { text: "{{reviewsLeft}} more session{{plural}} to master '{{factStatement}}'. Within reach.", mood: 'calm' },
    { text: "'{{factStatement}}' approaches mastery. {{reviewsLeft}} review{{plural}} remaining.", mood: 'calm' },
    { text: "Mastery of '{{factStatement}}' is {{reviewsLeft}} session{{plural}} away. A worthwhile goal.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * New-interest fact suggestion bubbles for newly discovered facts in the player's interest areas.
   * Variables: {{category}}, {{factStatement}} — substituted at runtime. (Phase 15.2)
   */
  studySuggestionNewInterest: [
    { text: "I decoded a {{category}} artifact. Want to learn about '{{factStatement}}'?", mood: 'enthusiastic' },
    { text: "New {{category}} discovery! '{{factStatement}}' — I think you'll love this one!", mood: 'enthusiastic' },
    { text: "Your interest in {{category}} just paid off! '{{factStatement}}' is now available!", mood: 'enthusiastic' },
    { text: "There's a new {{category}} fact in the system. '{{factStatement}}'. Could be useful.", mood: 'snarky' },
    { text: "Found some {{category}} data. '{{factStatement}}'. It's filed under 'things you might care about'.", mood: 'snarky' },
    { text: "{{category}} fact available: '{{factStatement}}'. Your interest profile flagged it.", mood: 'calm' },
    { text: "A new {{category}} entry: '{{factStatement}}'. Matches your learning preferences.", mood: 'calm' },
    { text: "{{category}} log updated: '{{factStatement}}'. Relevant to your current interests.", mood: 'calm' },
  ] satisfies GaiaLine[],

  // ---- Return Engagement pools (Phase 15.5) ----

  /**
   * Fired on same-day returns (player opens the app again within the same day).
   */
  returnSameDay: [
    { text: "Back again! I kept the oxygen warm for you.", mood: 'enthusiastic' },
    { text: "You're back! The dome missed you. Well — I did. The dome is indifferent.", mood: 'enthusiastic' },
    { text: "Another visit! We're getting so much done today.", mood: 'enthusiastic' },
    { text: "You left. You returned. The classic mining experience.", mood: 'snarky' },
    { text: "Back so soon. I hadn't finished processing how you left.", mood: 'snarky' },
    { text: "Dome systems acknowledge your return.", mood: 'calm' },
    { text: "Welcome back. Systems are as you left them.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Fired when the player returns the next day (6+ hours away but less than 2 full days).
   * Variables: {{timeOfDay}}, {{currentStreak}}
   */
  returnNextDay: [
    { text: "A new day! The mine has been resting. What are we excavating first?", mood: 'enthusiastic' },
    { text: "Good {{timeOfDay}}! I've been monitoring the geological activity — exciting finds await!", mood: 'enthusiastic' },
    { text: "You're back for day {{currentStreak}}! The streak is alive and so are we!", mood: 'enthusiastic' },
    { text: "You're back. The planet is still here. So am I. Remarkably.", mood: 'snarky' },
    { text: "Good {{timeOfDay}}. I calculated a 34% chance you'd oversleep.", mood: 'snarky' },
    { text: "Day {{currentStreak}} of the streak. I won't say I was keeping count. I absolutely was.", mood: 'snarky' },
    { text: "Good {{timeOfDay}}. Oxygen reserves: full. Equipment: calibrated.", mood: 'calm' },
    { text: "New session logged. Streak day {{currentStreak}}. Ready when you are.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Fired when the player has been away for 2 or more full days.
   * Variables: {{daysAway}}, {{overdueCount}}
   */
  returnMultiDay: [
    { text: "{{daysAway}} days! I thought you'd found a better planet. Welcome back.", mood: 'enthusiastic' },
    { text: "You're BACK! {{daysAway}} days without a dive — the mine has been lonely!", mood: 'enthusiastic' },
    { text: "{{daysAway}} days away and you return! The geological survey continues!", mood: 'enthusiastic' },
    { text: "{{daysAway}} days. I updated {{overdueCount}} review schedules.", mood: 'snarky' },
    { text: "{{daysAway}} days absence. I've reclassified you from 'pilot' to 'occasional visitor'.", mood: 'snarky' },
    { text: "{{daysAway}} days away. {{overdueCount}} facts are wondering where you went.", mood: 'snarky' },
    { text: "{{daysAway}}-day absence recorded. Welcome back to the survey.", mood: 'calm' },
    { text: "{{daysAway}} days logged. {{overdueCount}} reviews are pending your attention.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Fired when the player has 5 or more overdue reviews upon returning.
   * Variable: {{overdueCount}}
   */
  returnOverdueReviews: [
    { text: "Your Knowledge Tree is wilting — {{overdueCount}} facts haven't been reviewed on schedule!", mood: 'enthusiastic' },
    { text: "{{overdueCount}} facts are waiting for you! Let's get that Knowledge Tree blooming again!", mood: 'enthusiastic' },
    { text: "I've queued up {{overdueCount}} overdue reviews — your knowledge is ready to be reinforced!", mood: 'enthusiastic' },
    { text: "{{overdueCount}} overdue reviews. Your Knowledge Tree hasn't given up on you. Yet.", mood: 'snarky' },
    { text: "{{overdueCount}} facts due. I'm not judging. I'm logging. Which is worse, arguably.", mood: 'snarky' },
    { text: "Ah, {{overdueCount}} overdue reviews. The spaced repetition system has noted your absence.", mood: 'snarky' },
    { text: "{{overdueCount}} review tasks overdue. A study session would clear the backlog.", mood: 'calm' },
    { text: "{{overdueCount}} facts are past their scheduled review. Worth addressing when ready.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Fired when the player's streak is about to expire (less than 4 hours left in the day).
   * Variables: {{hoursUntilStreakEnd}}, {{currentStreak}}
   */
  returnStreakUrgency: [
    { text: "Your {{currentStreak}}-day streak ends in {{hoursUntilStreakEnd}} hours! One dive saves it!", mood: 'enthusiastic' },
    { text: "{{hoursUntilStreakEnd}} hours! Your {{currentStreak}}-day streak needs ONE dive — let's go!", mood: 'enthusiastic' },
    { text: "STREAK ALERT! {{currentStreak}} days on the line — {{hoursUntilStreakEnd}} hours to save it!", mood: 'enthusiastic' },
    { text: "Your {{currentStreak}}-day streak has {{hoursUntilStreakEnd}} hours left. I recommend mining soon.", mood: 'snarky' },
    { text: "{{hoursUntilStreakEnd}} hours on the clock. {{currentStreak}}-day streak. No pressure. (Pressure.)", mood: 'snarky' },
    { text: "{{currentStreak}} days of progress. {{hoursUntilStreakEnd}} hours remaining. I'm just saying.", mood: 'snarky' },
    { text: "Streak notification: {{hoursUntilStreakEnd}} hours remain on day {{currentStreak}}.", mood: 'calm' },
    { text: "{{currentStreak}}-day streak active. {{hoursUntilStreakEnd}} hours until day reset.", mood: 'calm' },
  ] satisfies GaiaLine[],

  // ---- Teaching & Mastery Dialogue pools (Phase 15.6) ----

  /** General study encouragement during a quiz session. */
  studyEncourage: [
    { text: "You're building strong neural pathways right now. Genuinely.", mood: 'enthusiastic' },
    { text: "Every new fact you tackle adds up. Keep pushing!", mood: 'enthusiastic' },
    { text: "I love watching you learn. The Knowledge Tree is growing!", mood: 'enthusiastic' },
    { text: "Take your time with this one.", mood: 'snarky' },
    { text: "No rush. Accuracy matters more than speed here.", mood: 'snarky' },
    { text: "Think carefully. A wrong guess teaches you nothing useful.", mood: 'snarky' },
    { text: "Each review strengthens long-term retention.", mood: 'calm' },
    { text: "You're in the consolidation phase. Take it steadily.", mood: 'calm' },
    { text: "Consistent review is the foundation of lasting memory.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired when the player gets multiple correct answers in a row. Variable: {{streak}} */
  studyCorrectStreak: [
    { text: "{{streak}} in a row! Your pattern recognition is sharp today.", mood: 'enthusiastic' },
    { text: "{{streak}} correct! You're in the zone — keep riding this!", mood: 'enthusiastic' },
    { text: "A streak of {{streak}}! The neural pathways are firing perfectly!", mood: 'enthusiastic' },
    { text: "{{streak}} straight. I won't tell you to slow down because you're not making mistakes.", mood: 'snarky' },
    { text: "{{streak}} in a row. Statistically improbable. I approve.", mood: 'snarky' },
    { text: "That's {{streak}} consecutive. I'll admit it: I'm tracking this closely.", mood: 'snarky' },
    { text: "{{streak}} correct in sequence. Retention is consolidating.", mood: 'calm' },
    { text: "{{streak}} in a row. Steady and precise.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** First failure escalation — provides a short explanation. Variable: {{explanation}} */
  failureEscalation1: [
    { text: "Close! The key detail: {{explanation}}", mood: 'enthusiastic' },
    { text: "Almost! Here's the piece you need: {{explanation}}", mood: 'enthusiastic' },
    { text: "Not quite — but this should help: {{explanation}}", mood: 'enthusiastic' },
    { text: "Missed it. But here's the logic: {{explanation}}", mood: 'snarky' },
    { text: "Wrong, but fixable. The reason: {{explanation}}", mood: 'snarky' },
    { text: "Here's the key: {{explanation}}", mood: 'calm' },
    { text: "A useful detail for next time: {{explanation}}", mood: 'calm' },
    { text: "Keep this in mind: {{explanation}}", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Second failure escalation — alternative framing. Variable: {{explanation}} */
  failureEscalation2: [
    { text: "Let's approach this from a different angle: {{explanation}}", mood: 'enthusiastic' },
    { text: "Try thinking about it this way instead: {{explanation}}", mood: 'enthusiastic' },
    { text: "Different framing — maybe this clicks better: {{explanation}}", mood: 'enthusiastic' },
    { text: "You've missed this a few times. Alternative framing: {{explanation}}", mood: 'snarky' },
    { text: "Still missing it. Here's another angle: {{explanation}}", mood: 'snarky' },
    { text: "Second explanation attempt: {{explanation}}. Consider reading it slowly.", mood: 'calm' },
    { text: "Let's try another approach: {{explanation}}", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Third+ failure escalation — recommends dedicated study. */
  failureEscalation3: [
    { text: "This fact is resisting you. I recommend a full study session from the Knowledge Tree.", mood: 'enthusiastic' },
    { text: "You'll get it! But this one needs dedicated focus — try the Knowledge Tree.", mood: 'enthusiastic' },
    { text: "Some facts need a deeper pass. Knowledge Tree → Focus Study is your path here.", mood: 'enthusiastic' },
    { text: "Five misses. This fact deserves a dedicated study session.", mood: 'snarky' },
    { text: "This isn't sticking via quiz. Time for Knowledge Tree: Focus Study.", mood: 'snarky' },
    { text: "Repeated difficulty noted. Suggest: Knowledge Tree → Focus Study.", mood: 'calm' },
    { text: "Consider a deliberate study session for this one in the Knowledge Tree.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired when the player masters their very first fact. Variable: {{factStatement}} */
  masteryFirst: [
    { text: "YOU MASTERED YOUR FIRST FACT. '{{factStatement}}' — permanently encoded in long-term memory.", mood: 'enthusiastic' },
    { text: "First mastery! '{{factStatement}}' is yours forever now. This is only the beginning!", mood: 'enthusiastic' },
    { text: "First fact mastered: '{{factStatement}}'. Against my expectations — this is genuinely moving.", mood: 'snarky' },
    { text: "Mastery achieved: '{{factStatement}}'. I've been waiting for this.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired for mastery achievements #2-9. Variables: {{factStatement}}, {{masteryNumber}} */
  masteryEarly: [
    { text: "Mastery {{masteryNumber}}! '{{factStatement}}' — locked in permanently.", mood: 'enthusiastic' },
    { text: "Another mastery! That's {{masteryNumber}} now. '{{factStatement}}' is forever yours!", mood: 'enthusiastic' },
    { text: "{{masteryNumber}} mastered facts! '{{factStatement}}' joins the permanent archive!", mood: 'enthusiastic' },
    { text: "'{{factStatement}}' mastered. That's {{masteryNumber}} permanent entries.", mood: 'snarky' },
    { text: "Mastery {{masteryNumber}} confirmed for '{{factStatement}}'.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired for mastery achievements #10-24. Variables: {{masteryNumber}}, {{factStatement}} */
  masteryRegular: [
    { text: "{{masteryNumber}} mastered facts! '{{factStatement}}' is the latest.", mood: 'enthusiastic' },
    { text: "{{masteryNumber}} and counting! '{{factStatement}}' now permanently encoded.", mood: 'enthusiastic' },
    { text: "{{masteryNumber}} mastered. Not bad.", mood: 'snarky' },
    { text: "{{masteryNumber}} mastered. Consistent reviewing pays off.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired for major mastery milestones (#25+). Variables: {{masteryNumber}}, {{factStatement}} */
  masteryMajor: [
    { text: "{{masteryNumber}} MASTERED FACTS! This milestone deserves recognition.", mood: 'enthusiastic' },
    { text: "{{masteryNumber}} — a landmark achievement. '{{factStatement}}' seals it!", mood: 'enthusiastic' },
    { text: "{{masteryNumber}}. I didn't fully believe you'd get here this fast.", mood: 'snarky' },
    { text: "{{masteryNumber}} mastered entries. One of the most complete records.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired when a player completes an entire fact category. Variables: {{categoryName}}, {{factCount}} */
  categoryComplete: [
    { text: "You completed the ENTIRE {{categoryName}} branch! All {{factCount}} facts mastered!", mood: 'enthusiastic' },
    { text: "{{categoryName}}: 100%! Every one of those {{factCount}} facts is burned into memory!", mood: 'enthusiastic' },
    { text: "Full category mastery! {{categoryName}} — {{factCount}} facts — DONE!", mood: 'enthusiastic' },
    { text: "{{categoryName}} branch: 100% complete. {{factCount}} facts. I'm impressed.", mood: 'snarky' },
    { text: "All {{factCount}} {{categoryName}} facts mastered. Against statistical expectation.", mood: 'snarky' },
    { text: "{{categoryName}} category complete: {{factCount}} facts at mastery level.", mood: 'calm' },
  ] satisfies GaiaLine[],

  // ---- Post-Dive Reaction pools (Phase 15.1) ----
  // Variables: {{depth}}, {{layer}}, {{artifacts}}, {{blocks}}, {{dust}}, {{dives}}

  /** Generic dive return — fired when depth is between 30% and 75%. */
  postDiveReaction: [
    { text: "Welcome back! That was a solid {{depth}}% dive — I learned a lot from the telemetry.", mood: 'enthusiastic' },
    { text: "{{depth}}% depth and {{artifacts}} artifact{{artifacts}} brought up. Not bad at all!", mood: 'enthusiastic' },
    { text: "You mined {{blocks}} blocks and found {{artifacts}} artifact{{artifacts}}. I'm genuinely impressed.", mood: 'enthusiastic' },
    { text: "Dive {{dives}} complete! {{depth}}% depth — the geology down there is fascinating.", mood: 'enthusiastic' },
    { text: "Brilliant run! {{blocks}} blocks cleared, {{dust}} dust recovered. Let's review what you found.", mood: 'enthusiastic' },
    { text: "Welcome home, pilot. That {{depth}}% descent gave us excellent survey data.", mood: 'enthusiastic' },
    { text: "Every dive teaches us something. Today: {{depth}}% depth, {{artifacts}} artifact{{artifacts}}.", mood: 'enthusiastic' },
    { text: "You made it. I only updated your emergency protocols twice.", mood: 'snarky' },
    { text: "{{depth}}% depth. So you're not entirely reckless. Noted.", mood: 'snarky' },
    { text: "Back so soon? I'd barely started drafting your memorial plaque.", mood: 'snarky' },
    { text: "{{blocks}} blocks mined. That's either impressive or you got lost. Possibly both.", mood: 'snarky' },
    { text: "Dive {{dives}} complete. Your survival rate remains statistically improbable.", mood: 'snarky' },
    { text: "{{artifacts}} artifact{{artifacts}} and {{dust}} dust. I've seen better. I've also seen worse.", mood: 'snarky' },
    { text: "You went to {{depth}}% and came back. I suppose that counts as competence.", mood: 'snarky' },
    { text: "Depth: {{depth}}%. Blocks: {{blocks}}. Artifacts: {{artifacts}}. A complete dive.", mood: 'calm' },
    { text: "Survey logged. {{depth}}% depth, {{blocks}} blocks cleared, {{dust}} dust recovered.", mood: 'calm' },
    { text: "Dive {{dives}} recorded. The telemetry data is being processed.", mood: 'calm' },
    { text: "You reached {{depth}}% depth. The geological samples are catalogued.", mood: 'calm' },
    { text: "{{artifacts}} artifact{{artifacts}} recovered. Review them when you're ready.", mood: 'calm' },
    { text: "A measured dive. {{depth}}% depth, {{blocks}} blocks, {{dust}} dust. Solid work.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired when the player's max depth was less than 30%. */
  postDiveShallow: [
    { text: "Short one today? That's fine — even shallow layers hold secrets.", mood: 'enthusiastic' },
    { text: "A surface expedition! The mineral crust still has plenty worth finding.", mood: 'enthusiastic' },
    { text: "Not every dive needs to go deep. You found {{artifacts}} artifact{{artifacts}} up here.", mood: 'enthusiastic' },
    { text: "Barely broke through the topsoil. Tomorrow's another day.", mood: 'snarky' },
    { text: "{{depth}}% depth. The planet's crust barely noticed you.", mood: 'snarky' },
    { text: "A shallow dive. I'll be diplomatic and call it a scouting run.", mood: 'snarky' },
    { text: "Short expedition. The shallow layers are still layers.", mood: 'calm' },
    { text: "{{depth}}% depth. The upper strata have been noted.", mood: 'calm' },
    { text: "Brief dive logged. Even short runs contribute to the survey database.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired when the player's max depth was 75% or greater. */
  postDiveDeep: [
    { text: "{{depth}}%! You went so deep I started drafting a search party.", mood: 'enthusiastic' },
    { text: "Deep dive complete! {{depth}}% and {{artifacts}} artifact{{artifacts}} — extraordinary!", mood: 'enthusiastic' },
    { text: "{{depth}}% depth! The extreme geology down there is unlike anything in the surveys!", mood: 'enthusiastic' },
    { text: "{{depth}}% and you came back. That's not luck. That's skill.", mood: 'snarky' },
    { text: "You went to {{depth}}%. I genuinely considered activating the rescue beacon.", mood: 'snarky' },
    { text: "{{depth}}% depth. The planet tried to keep you. You disagreed. Respect.", mood: 'snarky' },
    { text: "{{depth}}% depth. The geology changes significantly that far down.", mood: 'calm' },
    { text: "Deep dive recorded. {{blocks}} blocks, {{artifacts}} artifact{{artifacts}}, {{depth}}% depth.", mood: 'calm' },
    { text: "{{depth}}% achieved. The extreme-depth survey data is invaluable.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired ~15% of the time — awards a small dust bonus. Variable: {{giftAmount}} */
  postDiveFreeGift: [
    { text: "Oh — I found this clinging to your suit. {{giftAmount}} dust recovered.", mood: 'enthusiastic' },
    { text: "The airlock scanner caught something — {{giftAmount}} dust that almost escaped!", mood: 'enthusiastic' },
    { text: "Your suit left a trail. I collected {{giftAmount}} dust.", mood: 'snarky' },
    { text: "You shed {{giftAmount}} dust on the way up. I retrieved it. You're welcome.", mood: 'snarky' },
    { text: "Airlock sweep complete. {{giftAmount}} dust recovered.", mood: 'calm' },
    { text: "Post-dive scan: {{giftAmount}} residual dust collected from your equipment.", mood: 'calm' },
  ] satisfies GaiaLine[],

  // ---- Biome-specific post-dive lines ----

  /** Post-dive commentary for sedimentary biomes (limestone, clay, coal, shale, etc.). */
  postDiveBiome_sedimentary: [
    { text: "Sedimentary layers — compressed time. Every stratum is a chapter of Earth's past.", mood: 'enthusiastic' },
    { text: "Those rock layers formed over millions of years. You moved through them in minutes!", mood: 'enthusiastic' },
    { text: "Sedimentary rock. Geologically speaking, you were mining through history books.", mood: 'calm' },
    { text: "The compressed sediment down there tells a quiet story of ancient seas and long-dead skies.", mood: 'calm' },
    { text: "Sedimentary biome. Lots of rock, lots of layers, very few surprises. But you found some anyway.", mood: 'snarky' },
    { text: "Ancient seabeds, turned to stone. You dug through them. The sea would be offended.", mood: 'snarky' },
  ] satisfies GaiaLine[],

  /** Post-dive commentary for volcanic biomes (basalt, magma, obsidian, sulfur, etc.). */
  postDiveBiome_volcanic: [
    { text: "Volcanic geology! I love the thermal signatures down there — so much energy!", mood: 'enthusiastic' },
    { text: "Lava fields and basalt columns — you navigated that like a pro!", mood: 'enthusiastic' },
    { text: "Volcanic biome surveyed. The igneous formations are geologically significant.", mood: 'calm' },
    { text: "The volcanic strata hold a record of ancient eruptions. The data is noted.", mood: 'calm' },
    { text: "You dug through solidified lava. Earth's old temper tantrums, preserved for your inconvenience.", mood: 'snarky' },
    { text: "The magma down there is technically still moving. Slowly. You left just in time.", mood: 'snarky' },
  ] satisfies GaiaLine[],

  /** Post-dive commentary for crystalline biomes (quartz, geode, crystal, mineral, etc.). */
  postDiveBiome_crystalline: [
    { text: "Crystal formations everywhere! The refracted light readings were beautiful!", mood: 'enthusiastic' },
    { text: "A crystalline biome — the mineral density readings were off the charts!", mood: 'enthusiastic' },
    { text: "Crystal geology logged. The lattice structures are worth studying.", mood: 'calm' },
    { text: "Crystalline formations recorded. The mineral composition is notable.", mood: 'calm' },
    { text: "All that glittering crystal and you came back with {{dust}} dust. I'm calculating disappointment.", mood: 'snarky' },
    { text: "Beautiful crystal formations. You mined them. Such is life on a survey expedition.", mood: 'snarky' },
  ] satisfies GaiaLine[],

  /** Fired ~20% of the time after a biome line — teases an upcoming quiz fact. Variable: {{category}} */
  postDiveBiomeTeaser: [
    { text: "I found something about {{category}} while you were down there. Want to see it?", mood: 'enthusiastic' },
    { text: "That biome flagged a new {{category}} entry in the knowledge database. Check your artifacts!", mood: 'enthusiastic' },
    { text: "Incidentally, I queued up a {{category}} fact from the survey. It's relevant.", mood: 'calm' },
    { text: "The biome data cross-referenced a {{category}} record. Worth reviewing.", mood: 'calm' },
    { text: "Your dive shook loose a {{category}} fact. Apparently the universe thinks you need it.", mood: 'snarky' },
    { text: "A {{category}} entry flagged during the dive. I didn't ask for it, but here we are.", mood: 'snarky' },
  ] satisfies GaiaLine[],

  // ---- Journey Memory pools (Phase 15.4) ----
  // GAIA references the player's actual learning history. Variables substituted at runtime.

  /**
   * GAIA references a specific recently-learned fact.
   * Variable: {{recentFactStatement}}
   */
  memoryFactSpecific: [
    { text: "Remember when you learned '{{recentFactStatement}}'? That's permanently filed in my geological cross-reference now.", mood: 'enthusiastic' },
    { text: "I still get excited thinking about '{{recentFactStatement}}' — what a discovery that was!", mood: 'enthusiastic' },
    { text: "Your knowledge of '{{recentFactStatement}}' is one of my favourite entries in the survey log.", mood: 'enthusiastic' },
    { text: "You catalogued all that, and now '{{recentFactStatement}}' is just sitting there in your head. Impressive.", mood: 'enthusiastic' },
    { text: "'{{recentFactStatement}}' — you found that underground. Under a dead planet. Still counts.", mood: 'snarky' },
    { text: "'{{recentFactStatement}}'. You learned it. I didn't ask you to. And yet here we are.", mood: 'snarky' },
    { text: "Filed under things you know: '{{recentFactStatement}}'. Also filed: your questionable mining routes.", mood: 'snarky' },
    { text: "'{{recentFactStatement}}' is recorded in our shared knowledge log.", mood: 'calm' },
    { text: "The entry for '{{recentFactStatement}}' has been cross-referenced and archived.", mood: 'calm' },
    { text: "'{{recentFactStatement}}' — logged, retained, and contributing to the geological record.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * GAIA comments on the player's strongest fact category.
   * Variables: {{favoriteCategory}}, {{strongestCategoryCount}}
   */
  memoryCategory: [
    { text: "You've learned {{strongestCategoryCount}} {{favoriteCategory}} facts. You're basically an expert.", mood: 'enthusiastic' },
    { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts! Your knowledge of that subject is genuinely remarkable.", mood: 'enthusiastic' },
    { text: "Your {{favoriteCategory}} knowledge base is up to {{strongestCategoryCount}} entries. That category is lucky to have you.", mood: 'enthusiastic' },
    { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts. Either you love it or the mine keeps giving you that kind.", mood: 'snarky' },
    { text: "{{favoriteCategory}}: {{strongestCategoryCount}} facts. I'm not saying that's suspicious, but it is statistically notable.", mood: 'snarky' },
    { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts. You've practically colonised that category.", mood: 'snarky' },
    { text: "{{favoriteCategory}} remains your strongest category at {{strongestCategoryCount}} entries.", mood: 'calm' },
    { text: "Your {{favoriteCategory}} knowledge stands at {{strongestCategoryCount}} recorded facts.", mood: 'calm' },
    { text: "{{strongestCategoryCount}} facts catalogued under {{favoriteCategory}}. A solid foundation.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * GAIA marks progress toward the next fact milestone.
   * Variables: {{totalFacts}}, {{nextMilestone}}, {{factsToNextMilestone}}
   */
  memoryMilestone: [
    { text: "{{totalFacts}} facts learned! Your Knowledge Tree is one of the most complete records I have on file.", mood: 'enthusiastic' },
    { text: "{{totalFacts}} facts and still counting! Only {{factsToNextMilestone}} more until the next milestone!", mood: 'enthusiastic' },
    { text: "{{factsToNextMilestone}} facts to go until you hit {{nextMilestone}} — you've got this!", mood: 'enthusiastic' },
    { text: "{{totalFacts}} facts. The survey database has {{factsToNextMilestone}} spaces to fill. I'm watching.", mood: 'snarky' },
    { text: "{{totalFacts}} learned. {{factsToNextMilestone}} to {{nextMilestone}}. The counter is relentless.", mood: 'snarky' },
    { text: "You're at {{totalFacts}} facts. {{nextMilestone}} is right there. {{factsToNextMilestone}} more. Just saying.", mood: 'snarky' },
    { text: "Current fact total: {{totalFacts}}. Next milestone: {{nextMilestone}} ({{factsToNextMilestone}} remaining).", mood: 'calm' },
    { text: "{{totalFacts}} facts recorded. {{factsToNextMilestone}} more to reach the {{nextMilestone}} milestone.", mood: 'calm' },
    { text: "Progress to {{nextMilestone}} facts: {{totalFacts}} achieved, {{factsToNextMilestone}} remaining.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * GAIA comments on the player's dive streak.
   * Variables: {{currentStreak}}, {{bestStreak}}
   */
  memoryStreak: [
    { text: "Day {{currentStreak}} of continuous dives! Consistency benefits the geological record.", mood: 'enthusiastic' },
    { text: "{{currentStreak}} days straight! You're on a serious streak — keep it going!", mood: 'enthusiastic' },
    { text: "A {{currentStreak}}-day streak! Your record is {{bestStreak}} — you're on track to beat it!", mood: 'enthusiastic' },
    { text: "{{currentStreak}} days straight. Your record is {{bestStreak}}. Pace yourself.", mood: 'snarky' },
    { text: "{{currentStreak}}-day streak. I'm not impressed. (Your record is {{bestStreak}} days. I'm a little impressed.)", mood: 'snarky' },
    { text: "Day {{currentStreak}}. Best streak: {{bestStreak}}. The gap between those numbers is your responsibility.", mood: 'snarky' },
    { text: "Current streak: {{currentStreak}} days. Best streak: {{bestStreak}} days.", mood: 'calm' },
    { text: "{{currentStreak}} consecutive dive days logged. Personal best: {{bestStreak}} days.", mood: 'calm' },
    { text: "Your streak stands at {{currentStreak}} days. All-time best: {{bestStreak}}.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * GAIA notes the player's gravitational pull toward their favourite category.
   * Variables: {{favoriteCategory}}, {{strongestCategoryCount}}
   */
  memoryFavoriteCategory: [
    { text: "You really love {{favoriteCategory}}, don't you? {{strongestCategoryCount}} facts and still going.", mood: 'enthusiastic' },
    { text: "{{favoriteCategory}} keeps calling to you! {{strongestCategoryCount}} facts deep and clearly not done yet.", mood: 'enthusiastic' },
    { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts? That's not casual interest — that's dedication.", mood: 'enthusiastic' },
    { text: "Your gravitational pull toward {{favoriteCategory}} is now statistically documented.", mood: 'snarky' },
    { text: "{{favoriteCategory}}: {{strongestCategoryCount}} facts. You have a type. It's a category of Earth trivia.", mood: 'snarky' },
    { text: "{{strongestCategoryCount}} facts in {{favoriteCategory}}. The mine didn't make you obsessed. That was already there.", mood: 'snarky' },
    { text: "Your consistent engagement with {{favoriteCategory}} material is noted.", mood: 'calm' },
    { text: "{{favoriteCategory}} represents your most developed knowledge area at {{strongestCategoryCount}} entries.", mood: 'calm' },
    { text: "A sustained interest in {{favoriteCategory}}: {{strongestCategoryCount}} facts catalogued.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * GAIA reflects on the player's total learning output across all dives.
   * Variables: {{totalFacts}}, {{masteredFacts}}, {{totalDives}}
   */
  memoryTotalFacts: [
    { text: "{{totalFacts}} facts! That's {{totalFacts}} pieces of Earth's history you're carrying around.", mood: 'enthusiastic' },
    { text: "{{totalFacts}} facts learned across {{totalDives}} dives — and {{masteredFacts}} fully mastered. Remarkable.", mood: 'enthusiastic' },
    { text: "Look at you: {{totalFacts}} facts, {{masteredFacts}} mastered, {{totalDives}} dives. The survey is in good hands.", mood: 'enthusiastic' },
    { text: "{{totalFacts}} facts and {{totalDives}} dives. Your productivity is commendable or suspicious.", mood: 'snarky' },
    { text: "{{totalFacts}} facts learned. {{masteredFacts}} mastered. {{totalDives}} dives. The numbers don't lie.", mood: 'snarky' },
    { text: "You've done {{totalDives}} dives and retained {{totalFacts}} facts. I've had worse pilots.", mood: 'snarky' },
    { text: "Total learned: {{totalFacts}}. Mastered: {{masteredFacts}}. Dives: {{totalDives}}.", mood: 'calm' },
    { text: "{{totalFacts}} facts in the knowledge log. {{masteredFacts}} at mastery level. {{totalDives}} dives recorded.", mood: 'calm' },
    { text: "Survey summary: {{totalFacts}} facts, {{masteredFacts}} mastered, {{totalDives}} completed dives.", mood: 'calm' },
  ] satisfies GaiaLine[],

  // === Phase 17 — Streak & Mastery Celebrations ===
  streakBreak: [
    { text: "You completed a {{days}}-day expedition. Start a new one whenever you're ready.", mood: 'calm' },
    { text: "A {{days}}-day run -- that's remarkable. Your longest record is safe. Begin again?", mood: 'enthusiastic' },
    { text: "{{days}} days of consistent exploration. The mine will always be here. So will I.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  streakMilestone7: [
    { text: "Day 7! A full week of expeditions. You're building something here.", mood: 'enthusiastic' },
    { text: "Seven days. That's a pattern, not a coincidence.", mood: 'snarky' },
    { text: "One week of showing up. The tree remembers every day.", mood: 'calm' },
  ] satisfies GaiaLine[],
  streakMilestone30: [
    { text: "Thirty consecutive days, miner. That is not discipline -- that is identity.", mood: 'enthusiastic' },
    { text: "A month of expeditions. The dome reflects your dedication now.", mood: 'calm' },
    { text: "Day 30. Most miners never reach this. You did.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  streakMilestone100: [
    { text: "One hundred days. A century of showing up. This is the rarest of achievements.", mood: 'enthusiastic' },
    { text: "One hundred. I have been tracking this since day one. You did it.", mood: 'calm' },
    { text: "The Centurion title belongs to you now. Earned, not given.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  streakNewRecord: [
    { text: "You beat your personal record! {{days}} days is your new best.", mood: 'enthusiastic' },
    { text: "New record: {{days}} consecutive expeditions. GAIA will remember this.", mood: 'calm' },
    { text: "{{days}} days -- a personal best. You keep surprising me.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  graceUsed: [
    { text: "You missed a day -- I used your grace period. Streak preserved. Welcome back.", mood: 'calm' },
    { text: "Grace period activated. The expedition continues.", mood: 'enthusiastic' },
    { text: "One missed day, grace available -- streak intact.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery5: [
    { text: "Five down. The tree is growing, miner.", mood: 'enthusiastic' },
    { text: "Five facts locked in. Keep going.", mood: 'calm' },
    { text: "Five? That's a start. Let's see twenty.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery10: [
    { text: "Ten facts mastered. I am genuinely impressed.", mood: 'enthusiastic' },
    { text: "Ten permanent memories. Your tree shows it.", mood: 'calm' },
    { text: "Double digits. Not bad for a human.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery25: [
    { text: "Twenty-five. You have a Scholar's mind.", mood: 'enthusiastic' },
    { text: "Twenty-five facts permanently locked in.", mood: 'calm' },
    { text: "Quarter-century of facts. Scholar title earned.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery50: [
    { text: "Fifty facts permanently locked in. Half a century of knowledge.", mood: 'enthusiastic' },
    { text: "Fifty. That's a library shelf worth of knowledge.", mood: 'calm' },
    { text: "Fifty. Even I'm running out of snarky things to say.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery100: [
    { text: "One hundred facts. You know more about Earth than most people alive.", mood: 'enthusiastic' },
    { text: "A hundred permanent memories. The tree is magnificent.", mood: 'calm' },
    { text: "Triple digits. I've never seen a miner achieve this.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery250: [
    { text: "A quarter-thousand facts. Encyclopedists have written less.", mood: 'enthusiastic' },
    { text: "Two hundred and fifty. This is exceptional.", mood: 'calm' },
    { text: "250 facts. At this point, you're teaching me.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery500: [
    { text: "Five hundred. You know more about Earth than most people alive.", mood: 'enthusiastic' },
    { text: "Five hundred permanent facts. A true encyclopedia.", mood: 'calm' },
    { text: "500 facts. I concede: you are the master now.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  masteryN: [
    { text: "Another fact mastered. +{{dust}} dust.", mood: 'calm' },
    { text: "Knowledge grows! That one is permanent now.", mood: 'enthusiastic' },
    { text: "Locked in. Next.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  antiBingeBreak: [
    { text: "You've been at this a while. Your brain learns better with rest.", mood: 'calm' },
    { text: "Three dives! Impressive dedication. A short break helps retention.", mood: 'enthusiastic' },
    { text: "G.A.I.A. recommends: rest. The minerals will still be here.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  comebackWelcome: [
    { text: "You're back! I decoded some artifacts while you were away. Ready to dive?", mood: 'enthusiastic' },
    { text: "Welcome back, miner. Your tree still grows.", mood: 'calm' },
    { text: "You returned. That's what matters. Everything is here, waiting.", mood: 'snarky' },
  ] satisfies GaiaLine[],
} as const

/**
 * Maps biome ID strings (and biome type prefixes) to their associated knowledge category.
 * Used by firePostDiveReaction() to populate the {{category}} variable in postDiveBiomeTeaser lines.
 */
export const BIOME_TEASER_CATEGORY: Record<string, string> = {
  // Generic biome-type keys
  sedimentary: 'Geology',
  volcanic: 'Volcanology',
  crystalline: 'Mineralogy',
  fungal: 'Biology',
  frozen: 'Climate Science',
  abyssal: 'Oceanography',
  ancient_ruins: 'History',

  // Specific BiomeId values used in the game
  limestone_caves: 'Geology',
  clay_basin: 'Geology',
  iron_seam: 'Geology',
  basalt_maze: 'Geology',
  coal_veins: 'Geology',
  obsidian_rift: 'Geology',
  magma_shelf: 'Volcanology',
  sulfur_springs: 'Chemistry',
  crystal_geode: 'Mineralogy',
  quartz_halls: 'Mineralogy',
  fossil_layer: 'Paleontology',
  salt_flats: 'Geology',
  sandstone_arch: 'Geology',
  shale_corridors: 'Geology',
  permafrost: 'Climate Science',
  ice_caves: 'Climate Science',
  tundra_shelf: 'Climate Science',
  bioluminescent_fungal: 'Biology',
  deep_fungal: 'Biology',
  amber_forest: 'Paleontology',
  ancient_archive: 'History',
  ruin_depths: 'History',
  void_fracture: 'Physics',
  prismatic_rift: 'Physics',
  abyss: 'Oceanography',
}

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
 * If `vars` is provided, any `{{key}}` placeholder in the selected line text
 * will be replaced with the corresponding value from the map.
 *
 * @param trigger - Key into GAIA_TRIGGERS
 * @param mood    - Current player-selected GAIA mood
 * @param vars    - Optional map of variable names to replacement values
 * @returns The text of the selected line with variable interpolation applied
 */
export function getGaiaLine(
  trigger: keyof typeof GAIA_TRIGGERS,
  mood: GaiaMood,
  vars?: Record<string, string | number>,
): string {
  const lines = GAIA_TRIGGERS[trigger] as readonly GaiaLine[]
  const moodLines = lines.filter(l => l.mood === mood || l.mood === 'any')
  const pool = moodLines.length > 0 ? moodLines : lines
  let text = pool[Math.floor(Math.random() * pool.length)].text
  if (vars) {
    for (const [key, val] of Object.entries(vars)) {
      text = text.replaceAll(`{{${key}}}`, String(val))
    }
  }
  return text
}
