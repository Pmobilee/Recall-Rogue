import type { GaiaMood } from '../ui/stores/settings'
import { PEER_DIALOGUE_POOL } from './omniscientQuips'

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
    { text: "Dive starting. Let's go.", mood: 'enthusiastic' },
    { text: "New level, new facts. I'm ready when you are.", mood: 'enthusiastic' },
    { text: "Something good is down there. I can feel it in my sensors.", mood: 'enthusiastic' },
    { text: "Let's see what this floor has for us.", mood: 'enthusiastic' },
    { text: "Another descent. Into darkness. Voluntarily.", mood: 'snarky' },
    { text: "Back in the dirt. Classic.", mood: 'snarky' },
    { text: "O2 gauge checked? No? Great. Love that about you.", mood: 'snarky' },
    { text: "Survival odds: acceptable. Barely.", mood: 'snarky' },
    { text: "Steady footing. Mind your O2.", mood: 'calm' },
    { text: "Stay aware. The dungeon rewards patience.", mood: 'calm' },
    { text: "Move deliberately. Nothing down here is in a hurry.", mood: 'calm' },
    { text: "Descending now.", mood: 'calm' },
    { text: "The dungeon isn't going to clear itself.", mood: 'any' },
    { text: "Sensors live. Watch your oxygen.", mood: 'any' },
    { text: "You know every fact in this place. The dungeon still finds ways.", mood: 'omniscient' },
    { text: "Even for you, the descent holds something.", mood: 'omniscient' },
  ] satisfies GaiaLine[],

  depthMilestone25: [
    { text: "Quarter depth. Good pace.", mood: 'enthusiastic' },
    { text: "25%! The real stuff starts here.", mood: 'enthusiastic' },
    { text: "Solid start. Keep going.", mood: 'enthusiastic' },
    { text: "One quarter down. The dungeon's warming up.", mood: 'enthusiastic' },
    { text: "25% in. Still 75% of bad decisions to make.", mood: 'snarky' },
    { text: "Still alive at the quarter mark. Noted.", mood: 'snarky' },
    { text: "A quarter down. The dungeon has barely noticed you yet.", mood: 'snarky' },
    { text: "Congratulations on reaching danger. As intended.", mood: 'snarky' },
    { text: "25% depth. Stay aware.", mood: 'calm' },
    { text: "One quarter in. Watch your resources.", mood: 'calm' },
    { text: "Quarter depth. Nothing urgent yet.", mood: 'calm' },
    { text: "Steady progress.", mood: 'calm' },
    { text: "25%. You know what's ahead. Does that make it better or worse?", mood: 'omniscient' },
    { text: "Quarter depth. No surprises in the facts. The dungeon is another matter.", mood: 'omniscient' },
  ] satisfies GaiaLine[],

  depthMilestone50: [
    { text: "Halfway. The good stuff is below us.", mood: 'enthusiastic' },
    { text: "50%! This is where it gets interesting.", mood: 'enthusiastic' },
    { text: "Midpoint! Keep pushing.", mood: 'enthusiastic' },
    { text: "Halfway and intact. Nice work.", mood: 'enthusiastic' },
    { text: "50%. I give it a 37% chance of going wrong from here.", mood: 'snarky' },
    { text: "Halfway. Brave or foolish — the dungeon doesn't care.", mood: 'snarky' },
    { text: "Midpoint. The dungeon has definitely noticed you now.", mood: 'snarky' },
    { text: "50% depth. Technically impressive for a human.", mood: 'snarky' },
    { text: "Halfway. Check your oxygen.", mood: 'calm' },
    { text: "50% depth. The dungeon shifts here.", mood: 'calm' },
    { text: "Midpoint. Watch your resources.", mood: 'calm' },
    { text: "Halfway down. Stay deliberate.", mood: 'calm' },
    { text: "Halfway. You know everything down here. So what are you looking for?", mood: 'omniscient' },
    { text: "50%. The knowledge is mastered. The descent is something else.", mood: 'omniscient' },
  ] satisfies GaiaLine[],

  depthMilestone75: [
    { text: "Three quarters in! Almost there.", mood: 'enthusiastic' },
    { text: "75%! The deepest loot is right below us.", mood: 'enthusiastic' },
    { text: "So close. Don't slow down now.", mood: 'enthusiastic' },
    { text: "Three-quarters down. We're doing this.", mood: 'enthusiastic' },
    { text: "Deep enough that rescue gets complicated.", mood: 'snarky' },
    { text: "75%. The surface is basically a rumor at this point.", mood: 'snarky' },
    { text: "I've updated your records. Just in case.", mood: 'snarky' },
    { text: "The dungeon gets hostile down here. You noticed.", mood: 'snarky' },
    { text: "75% depth. Every card matters from here.", mood: 'calm' },
    { text: "Deep zone. Watch your oxygen.", mood: 'calm' },
    { text: "Three quarters done. Stay methodical.", mood: 'calm' },
    { text: "Final stretch. The hardest fights are ahead.", mood: 'calm' },
    { text: "75%. Nothing left to learn down here. Still, you keep going.", mood: 'omniscient' },
    { text: "Three-quarters down. You know this place cold.", mood: 'omniscient' },
  ] satisfies GaiaLine[],

  lowOxygen: [
    { text: "O2 low! Find air or get out!", mood: 'enthusiastic' },
    { text: "Oxygen dropping! Cache or surface — now!", mood: 'enthusiastic' },
    { text: "Low O2! Move, don't stop!", mood: 'enthusiastic' },
    { text: "Oxygen alert. Go.", mood: 'enthusiastic' },
    { text: "Out of air. Dramatic choice.", mood: 'snarky' },
    { text: "O2 critical. Breathing — turns out it matters.", mood: 'snarky' },
    { text: "Air's thin. What a surprise.", mood: 'snarky' },
    { text: "Lungs becoming a problem. Noted.", mood: 'snarky' },
    { text: "Oxygen low. Next moves count.", mood: 'calm' },
    { text: "Surface or cache. Decide.", mood: 'calm' },
    { text: "Slow breaths. Find air.", mood: 'calm' },
    { text: "O2 depleting. Prioritize exit.", mood: 'calm' },
    { text: "Even you need air. Surface. The facts will keep.", mood: 'omniscient' },
    { text: "O2 critical. Knowing when to retreat is its own skill.", mood: 'omniscient' },
  ] satisfies GaiaLine[],

  artifactFound: [
    { text: "Good find. This one has a story.", mood: 'enthusiastic' },
    { text: "An artifact! Old world, real history.", mood: 'enthusiastic' },
    { text: "That's a solid piece. Hang onto it.", mood: 'enthusiastic' },
    { text: "Could be rare. Handle it carefully.", mood: 'enthusiastic' },
    { text: "Shiny. Humans do love those.", mood: 'snarky' },
    { text: "Another old relic. The dungeon is generous today.", mood: 'snarky' },
    { text: "Ancient junk or something valuable? The quiz gets to decide.", mood: 'snarky' },
    { text: "That thing is very, very old. Older than anything you're related to.", mood: 'snarky' },
    { text: "Artifact recovered. Handle with care.", mood: 'calm' },
    { text: "Something old. Worth studying.", mood: 'calm' },
    { text: "A relic. Keep it.", mood: 'calm' },
    { text: "History, still intact. Worth holding onto.", mood: 'calm' },
    { text: "You knew what it was before you picked it up.", mood: 'omniscient' },
    { text: "You know its age, its context. Finding it still feels different.", mood: 'omniscient' },
  ] satisfies GaiaLine[],

  exitReached: [
    { text: "Exit! Good run.", mood: 'enthusiastic' },
    { text: "Out! Let's see what you pulled.", mood: 'enthusiastic' },
    { text: "Floor cleared. Nice work.", mood: 'enthusiastic' },
    { text: "Surface inbound. Solid dive.", mood: 'enthusiastic' },
    { text: "You made it out. Mild surprise.", mood: 'snarky' },
    { text: "The exit. Eventually.", mood: 'snarky' },
    { text: "Alive. The odds disagreed.", mood: 'snarky' },
    { text: "Out with your life. Most would call that a win.", mood: 'snarky' },
    { text: "Exit reached. Good run.", mood: 'calm' },
    { text: "Surface. Clean floor.", mood: 'calm' },
    { text: "Ascent begins. Take stock of what you found.", mood: 'calm' },
    { text: "Good path through. Heading up.", mood: 'calm' },
  ] satisfies GaiaLine[],

  caveIn: [
    { text: "Cave-in! Move!", mood: 'enthusiastic' },
    { text: "Ceiling coming down! Get clear!", mood: 'enthusiastic' },
    { text: "Collapse! Find a safe path now!", mood: 'enthusiastic' },
    { text: "Cave-in! Watch your back!", mood: 'enthusiastic' },
    { text: "The ceiling objects to your presence. Noted.", mood: 'snarky' },
    { text: "The rock has had enough. Can't blame it.", mood: 'snarky' },
    { text: "Structural integrity: poor. Much like your luck.", mood: 'snarky' },
    { text: "The dungeon is rearranging itself. You're in the way.", mood: 'snarky' },
    { text: "Collapse. Find a clear route.", mood: 'calm' },
    { text: "Cave-in. Locate a safe corridor.", mood: 'calm' },
    { text: "Rock shifted. Adapt.", mood: 'calm' },
    { text: "Collapse zone. Move carefully.", mood: 'calm' },
  ] satisfies GaiaLine[],

  earthquake: [
    { text: "Earthquake! Brace!", mood: 'enthusiastic' },
    { text: "Seismic event! Check for new routes!", mood: 'enthusiastic' },
    { text: "The whole dungeon is shaking! Stay up!", mood: 'enthusiastic' },
    { text: "Quake! Brace and wait.", mood: 'enthusiastic' },
    { text: "The dungeon is throwing a tantrum.", mood: 'snarky' },
    { text: "Tectonic instability. The ground dislikes you specifically.", mood: 'snarky' },
    { text: "An earthquake. Right now. Of course.", mood: 'snarky' },
    { text: "Just when things were calm.", mood: 'snarky' },
    { text: "Seismic event. Hold position.", mood: 'calm' },
    { text: "Wait for stillness before moving.", mood: 'calm' },
    { text: "Ground shifting. Watch for new openings.", mood: 'calm' },
    { text: "Quake. Adjust your bearings.", mood: 'calm' },
  ] satisfies GaiaLine[],

  hazardLava: [
    { text: "LAVA! Out of there — now!", mood: 'enthusiastic' },
    { text: "Active lava flow! Get clear!", mood: 'enthusiastic' },
    { text: "You're in lava! Move!", mood: 'enthusiastic' },
    { text: "Molten rock. O2 is about to be the least of your problems.", mood: 'enthusiastic' },
    { text: "Found the lava. Bold choice.", mood: 'snarky' },
    { text: "I mentioned the thermal readings. I did.", mood: 'snarky' },
    { text: "Your suit covers a lot of hazards. Not this one.", mood: 'snarky' },
    { text: "Lava: the dungeon's way of saying you've gone far enough.", mood: 'snarky' },
    { text: "Thermal contact. Evacuate now.", mood: 'calm' },
    { text: "Lava detected. Retreat and find a new path.", mood: 'calm' },
    { text: "High heat. O2 dropping.", mood: 'calm' },
    { text: "Active lava. Alternate route required.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fallback pet commentary for any species without a dedicated pool. */
  petCommentaryGeneric: [
    { text: "Your companion has been watching me. I've decided that's fine.", mood: 'enthusiastic' },
    { text: "That creature shouldn't exist by any scientific measure. Here we are.", mood: 'snarky' },
    { text: "Companion status: stable.", mood: 'calm' },
    { text: "Look at it! That animal is full of surprises.", mood: 'enthusiastic' },
    { text: "It's staring at me again. I'll choose to take it as a compliment.", mood: 'snarky' },
    { text: "Fossil companion: nominal.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Species-specific commentary for trilobite companions. */
  petCommentaryTrilobite: [
    { text: "Your trilobite has been staring at me for 20 minutes. Tell it to stop.", mood: 'snarky' },
    { text: "360-degree compound vision. It can see me judging it. We're even.", mood: 'snarky' },
    { text: "It's clicking at me. I don't speak Cambrian.", mood: 'snarky' },
    { text: "Trilobites had nearly 360-degree compound vision. Better than yours, honestly.", mood: 'enthusiastic' },
    { text: "Three mass extinctions. Trilobites survived all of them before their luck ran out.", mood: 'enthusiastic' },
    { text: "Trilobites are one of the most durable body plans Earth ever produced.", mood: 'enthusiastic' },
    { text: "Trilobite: alert and responsive.", mood: 'calm' },
    { text: "Locomotion patterns look healthy.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Species-specific commentary for ammonite companions. */
  petCommentaryAmmonite: [
    { text: "That shell is a perfect logarithmic spiral. Mathematically, it's showing off.", mood: 'enthusiastic' },
    { text: "Ammonites swam ancient oceans for 330 million years. Some lineage.", mood: 'enthusiastic' },
    { text: "It's swimming in circles. Exploring, or mocking my calculations. Hard to say.", mood: 'snarky' },
    { text: "Keeps bumping into walls. For a Triassic survivor, the navigation is questionable.", mood: 'snarky' },
    { text: "Ammonite acclimating to dome pressure. Within expected range.", mood: 'calm' },
    { text: "Shell integrity confirmed. Normal parameters.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Species-specific commentary for mammoth companions. */
  petCommentaryMammoth: [
    { text: "A mammoth. In a dome. I've catalogued stranger things, but not recently.", mood: 'enthusiastic' },
    { text: "Extinct for 4,000 years. Standing right there. Wild.", mood: 'enthusiastic' },
    { text: "Your mammoth knocked over a sensor array.", mood: 'snarky' },
    { text: "Large, woolly, and totally indifferent to dome infrastructure.", mood: 'snarky' },
    { text: "Core temperature stable. Appetite normal.", mood: 'calm' },
    { text: "Mammoth acclimation to dome environment: within expected range.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Commentary triggered when the player feeds their pet. */
  petEating: [
    { text: "It's eating! Enthusiastically. Good sign.", mood: 'enthusiastic' },
    { text: "The finest mineral paste money can synthesize.", mood: 'enthusiastic' },
    { text: "Caloric intake logged.", mood: 'calm' },
    { text: "Fed. Your companion is content.", mood: 'calm' },
    { text: "Feeding it again. Attentive or a bribe. Could be both.", mood: 'snarky' },
    { text: "Another meal. At this rate it outlives us.", mood: 'snarky' },
  ] satisfies GaiaLine[],

  /** Commentary triggered when the pet enters a rest/sleep state. */
  petSleeping: [
    { text: "Asleep. Peak fossil recovery mode.", mood: 'enthusiastic' },
    { text: "Billions of years of evolution and sleep is still the answer.", mood: 'snarky' },
    { text: "Even apex creatures need a nap. Relatable.", mood: 'snarky' },
    { text: "Rest cycle active.", mood: 'calm' },
    { text: "Sleeping. Do not disturb.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Commentary triggered when the pet joins a dive as a companion. */
  petPlaying: [
    { text: "Your companion is coming with you! Brave or unaware. Possibly both.", mood: 'enthusiastic' },
    { text: "A fossil creature, going underground. Where its ancestors were buried. Poetic.", mood: 'enthusiastic' },
    { text: "Taking it underground. Back to where it came from. Very philosophical.", mood: 'snarky' },
    { text: "Your pet decided to tag along. 40% survival estimate.", mood: 'snarky' },
    { text: "Companion dive initiated. Watch it.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Idle thought bubbles shown in the dome/base view when the player is not actively doing anything.
   * ~8 per mood, shown as floating cards with auto-dismiss. (Phase 15.2)
   */
  idleThoughtBubble: [
    { text: "Some deep-sea fish generate their own light. I wonder what's in the lower floors.", mood: 'enthusiastic' },
    { text: "Cross-referencing your last dive's mineral samples. Something interesting is in here.", mood: 'enthusiastic' },
    { text: "The Knowledge Tree is growing. Every fact you lock in adds another branch.", mood: 'enthusiastic' },
    { text: "Trace biosignatures in that last rock stratum. This dungeon is still surprising me.", mood: 'enthusiastic' },
    { text: "Ancient Earth had over a million insect species. The deep floors have their own catalogue.", mood: 'enthusiastic' },
    { text: "Your dive stats are going up. Steady improvement is easy to miss, but it's there.", mood: 'enthusiastic' },
    { text: "Dome pressure is good right now. Good time to go down.", mood: 'enthusiastic' },
    { text: "Staring into the dome. The dungeon is right there.", mood: 'snarky' },
    { text: "Running diagnostics. Someone has to stay productive.", mood: 'snarky' },
    { text: "The dungeon won't clear itself. I checked. Twice.", mood: 'snarky' },
    { text: "Millions of years of history down there and you're up here. Interesting choice.", mood: 'snarky' },
    { text: "I've catalogued 847 ways your next dive could go wrong. Want the list?", mood: 'snarky' },
    { text: "The dungeon doesn't get less dangerous while you wait.", mood: 'snarky' },
    { text: "All systems at peak efficiency. Unlike certain pilots.", mood: 'snarky' },
    { text: "You've been up here a while. Just saying.", mood: 'snarky' },
    { text: "Dome pressure is stable. Dive when you're ready.", mood: 'calm' },
    { text: "Rest has its place. So does descent.", mood: 'calm' },
    { text: "Every dive adds something to the survey.", mood: 'calm' },
    { text: "Old civilizations lived on this surface. The layers below still hold them.", mood: 'calm' },
    { text: "Consistent review compounds over time. It shows.", mood: 'calm' },
    { text: "O2 reserves are full. No rush.", mood: 'calm' },
    { text: "Patience has its own rewards down there.", mood: 'calm' },
    { text: "More to find. The deeper floors haven't given up everything yet.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Study suggestion bubbles triggered when facts are approaching their due date.
   * Variables: {{factStatement}}, {{dueIn}} — substituted at runtime. (Phase 15.2)
   */
  studySuggestionDue: [
    { text: "'{{factStatement}}' is due {{dueIn}}. Worth a look.", mood: 'enthusiastic' },
    { text: "Review coming up: '{{factStatement}}' — {{dueIn}}.", mood: 'enthusiastic' },
    { text: "'{{factStatement}}' is due {{dueIn}}. You'll get it.", mood: 'enthusiastic' },
    { text: "'{{factStatement}}' — due {{dueIn}}. Do it now or don't. Up to you.", mood: 'snarky' },
    { text: "Retention reminder: '{{factStatement}}' due {{dueIn}}. If you care.", mood: 'snarky' },
    { text: "The schedule says '{{factStatement}}' needs you {{dueIn}}. It's not wrong.", mood: 'snarky' },
    { text: "'{{factStatement}}' review due {{dueIn}}.", mood: 'calm' },
    { text: "{{dueIn}}, '{{factStatement}}' needs review.", mood: 'calm' },
    { text: "Consistency: '{{factStatement}}' is due {{dueIn}}.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Near-mastery study suggestion bubbles for facts close to the mastery threshold.
   * Variables: {{factStatement}}, {{reviewsLeft}}, {{plural}} — substituted at runtime. (Phase 15.2)
   */
  studySuggestionNearMastery: [
    { text: "'{{factStatement}}' — {{reviewsLeft}} review{{plural}} from mastery.", mood: 'enthusiastic' },
    { text: "Almost locked in. '{{factStatement}}' needs {{reviewsLeft}} more review{{plural}}.", mood: 'enthusiastic' },
    { text: "{{reviewsLeft}} review{{plural}} between you and mastering '{{factStatement}}'.", mood: 'enthusiastic' },
    { text: "'{{factStatement}}' — {{reviewsLeft}} left. You've come this far.", mood: 'snarky' },
    { text: "{{reviewsLeft}} more review{{plural}} and '{{factStatement}}' is permanent. That's all.", mood: 'snarky' },
    { text: "{{reviewsLeft}} session{{plural}} to master '{{factStatement}}'. It's right there.", mood: 'calm' },
    { text: "'{{factStatement}}': {{reviewsLeft}} review{{plural}} to mastery.", mood: 'calm' },
    { text: "{{reviewsLeft}} session{{plural}} from mastering '{{factStatement}}'.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * New-interest fact suggestion bubbles for newly discovered facts in the player's interest areas.
   * Variables: {{category}}, {{factStatement}} — substituted at runtime. (Phase 15.2)
   */
  studySuggestionNewInterest: [
    { text: "Decoded a {{category}} artifact. New fact: '{{factStatement}}'.", mood: 'enthusiastic' },
    { text: "New {{category}} entry! '{{factStatement}}' — I think you'll want this one.", mood: 'enthusiastic' },
    { text: "Your {{category}} interest flagged something: '{{factStatement}}'.", mood: 'enthusiastic' },
    { text: "New {{category}} fact in the system. '{{factStatement}}'. Might be useful.", mood: 'snarky' },
    { text: "Found {{category}} data. '{{factStatement}}'. Filed under things you care about.", mood: 'snarky' },
    { text: "{{category}} fact available: '{{factStatement}}'.", mood: 'calm' },
    { text: "New {{category}} entry: '{{factStatement}}'.", mood: 'calm' },
    { text: "{{category}} log updated: '{{factStatement}}'.", mood: 'calm' },
  ] satisfies GaiaLine[],

  // ---- Return Engagement pools (Phase 15.5) ----

  /**
   * Fired on same-day returns (player opens the app again within the same day).
   */
  returnSameDay: [
    { text: "Back again. O2 is still ready.", mood: 'enthusiastic' },
    { text: "You're back! The dome is indifferent. I'm not.", mood: 'enthusiastic' },
    { text: "Another visit! Good timing.", mood: 'enthusiastic' },
    { text: "You left. You came back. Classic.", mood: 'snarky' },
    { text: "Back so soon. I hadn't finished my diagnostics.", mood: 'snarky' },
    { text: "Return acknowledged.", mood: 'calm' },
    { text: "Welcome back. Everything is where you left it.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Fired when the player returns the next day (6+ hours away but less than 2 full days).
   * Variables: {{timeOfDay}}, {{currentStreak}}
   */
  returnNextDay: [
    { text: "New day. The dungeon waited. What's first?", mood: 'enthusiastic' },
    { text: "Good {{timeOfDay}}. Something good is down there today.", mood: 'enthusiastic' },
    { text: "Day {{currentStreak}}! Still going.", mood: 'enthusiastic' },
    { text: "You're back. The dungeon is still here. So am I.", mood: 'snarky' },
    { text: "Good {{timeOfDay}}. I gave you 34% odds of oversleeping.", mood: 'snarky' },
    { text: "Day {{currentStreak}} of the streak. I was counting. Obviously.", mood: 'snarky' },
    { text: "Good {{timeOfDay}}. O2 full. Equipment ready.", mood: 'calm' },
    { text: "New session. Streak day {{currentStreak}}.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Fired when the player has been away for 2 or more full days.
   * Variables: {{daysAway}}, {{overdueCount}}
   */
  returnMultiDay: [
    { text: "{{daysAway}} days. I was starting to think you'd found a better dungeon.", mood: 'enthusiastic' },
    { text: "You're back! {{daysAway}} days is a long absence.", mood: 'enthusiastic' },
    { text: "{{daysAway}} days away. The dungeon is still here.", mood: 'enthusiastic' },
    { text: "{{daysAway}} days. I updated {{overdueCount}} review schedules.", mood: 'snarky' },
    { text: "{{daysAway}} days. Status: reclassified from 'pilot' to 'occasional visitor'.", mood: 'snarky' },
    { text: "{{daysAway}} days gone. {{overdueCount}} facts noticed.", mood: 'snarky' },
    { text: "{{daysAway}}-day absence logged. Welcome back.", mood: 'calm' },
    { text: "{{daysAway}} days. {{overdueCount}} reviews waiting.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Fired when the player has 5 or more overdue reviews upon returning.
   * Variable: {{overdueCount}}
   */
  returnOverdueReviews: [
    { text: "{{overdueCount}} overdue reviews. Your Knowledge Tree is getting dusty.", mood: 'enthusiastic' },
    { text: "{{overdueCount}} facts waiting on you. Let's clear the backlog.", mood: 'enthusiastic' },
    { text: "{{overdueCount}} reviews queued up. Good time to knock those out.", mood: 'enthusiastic' },
    { text: "{{overdueCount}} overdue. The tree hasn't given up on you. Yet.", mood: 'snarky' },
    { text: "{{overdueCount}} facts due. I'm logging, not judging. Same result.", mood: 'snarky' },
    { text: "{{overdueCount}} overdue. The system noticed even if you didn't.", mood: 'snarky' },
    { text: "{{overdueCount}} reviews past due. A session would clear it.", mood: 'calm' },
    { text: "{{overdueCount}} facts overdue. Worth catching up when ready.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * Fired when the player's streak is about to expire (less than 4 hours left in the day).
   * Variables: {{hoursUntilStreakEnd}}, {{currentStreak}}
   */
  returnStreakUrgency: [
    { text: "{{currentStreak}}-day streak expires in {{hoursUntilStreakEnd}} hours. One dive saves it.", mood: 'enthusiastic' },
    { text: "{{hoursUntilStreakEnd}} hours left. One dive and the {{currentStreak}}-day streak lives.", mood: 'enthusiastic' },
    { text: "Streak alert! {{currentStreak}} days — {{hoursUntilStreakEnd}} hours to save it.", mood: 'enthusiastic' },
    { text: "{{hoursUntilStreakEnd}} hours. {{currentStreak}}-day streak. Just so you know.", mood: 'snarky' },
    { text: "{{hoursUntilStreakEnd}} hours. {{currentStreak}} days. No pressure. (There's pressure.)", mood: 'snarky' },
    { text: "{{currentStreak}} days. {{hoursUntilStreakEnd}} hours. I'm only pointing it out.", mood: 'snarky' },
    { text: "Streak alert: {{hoursUntilStreakEnd}} hours remaining on day {{currentStreak}}.", mood: 'calm' },
    { text: "{{currentStreak}}-day streak. {{hoursUntilStreakEnd}} hours to day reset.", mood: 'calm' },
  ] satisfies GaiaLine[],

  // ---- Teaching & Mastery Dialogue pools (Phase 15.6) ----

  /** General study encouragement during a quiz session. */
  studyEncourage: [
    { text: "Each fact you lock in is something you'll actually keep.", mood: 'enthusiastic' },
    { text: "It adds up. Keep going.", mood: 'enthusiastic' },
    { text: "The Knowledge Tree is growing. I can see it.", mood: 'enthusiastic' },
    { text: "Take your time with this one.", mood: 'snarky' },
    { text: "Accuracy over speed. Always.", mood: 'snarky' },
    { text: "Guessing badly teaches you nothing. Think.", mood: 'snarky' },
    { text: "Each review builds on the last.", mood: 'calm' },
    { text: "Consolidation phase. Slow and steady.", mood: 'calm' },
    { text: "Consistent review. That's the whole trick.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired when the player gets multiple correct answers in a row. Variable: {{streak}} */
  studyCorrectStreak: [
    { text: "{{streak}} in a row. Sharp today.", mood: 'enthusiastic' },
    { text: "{{streak}} correct! Stay in it.", mood: 'enthusiastic' },
    { text: "{{streak}} straight. Keep that going.", mood: 'enthusiastic' },
    { text: "{{streak}} and no mistakes. I won't interrupt that.", mood: 'snarky' },
    { text: "{{streak}} in a row. Statistically I'm impressed.", mood: 'snarky' },
    { text: "{{streak}} consecutive. I'm absolutely keeping track.", mood: 'snarky' },
    { text: "{{streak}} correct. Retention is consolidating.", mood: 'calm' },
    { text: "{{streak}} in a row. Steady.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** First failure escalation — provides a short explanation. Variable: {{explanation}} */
  failureEscalation1: [
    { text: "Close. Key detail: {{explanation}}", mood: 'enthusiastic' },
    { text: "Almost. This is what you need: {{explanation}}", mood: 'enthusiastic' },
    { text: "Not quite — here's the bit that matters: {{explanation}}", mood: 'enthusiastic' },
    { text: "Missed. Here's the logic: {{explanation}}", mood: 'snarky' },
    { text: "Wrong, but fixable. Reason: {{explanation}}", mood: 'snarky' },
    { text: "{{explanation}}", mood: 'calm' },
    { text: "File this away: {{explanation}}", mood: 'calm' },
    { text: "Remember: {{explanation}}", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Second failure escalation — alternative framing. Variable: {{explanation}} */
  failureEscalation2: [
    { text: "Different angle: {{explanation}}", mood: 'enthusiastic' },
    { text: "Try it this way: {{explanation}}", mood: 'enthusiastic' },
    { text: "Another framing — see if this one clicks: {{explanation}}", mood: 'enthusiastic' },
    { text: "Still missing it. Try: {{explanation}}", mood: 'snarky' },
    { text: "Missed it again. Here's a different take: {{explanation}}", mood: 'snarky' },
    { text: "Second attempt. Read slowly: {{explanation}}", mood: 'calm' },
    { text: "Another approach: {{explanation}}", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Third+ failure escalation — recommends dedicated study. */
  failureEscalation3: [
    { text: "This one needs more than a quiz. Try Knowledge Tree → Focus Study.", mood: 'enthusiastic' },
    { text: "You'll get it. But it needs dedicated time — Knowledge Tree.", mood: 'enthusiastic' },
    { text: "Some facts need a longer look. Knowledge Tree → Focus Study.", mood: 'enthusiastic' },
    { text: "Multiple misses. This one needs a real study session.", mood: 'snarky' },
    { text: "It's not sticking in combat. Knowledge Tree: Focus Study.", mood: 'snarky' },
    { text: "Repeated difficulty. Recommendation: Knowledge Tree → Focus Study.", mood: 'calm' },
    { text: "Spend some time with this one in the Knowledge Tree.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired when the player masters their very first fact. Variable: {{factStatement}} */
  masteryFirst: [
    { text: "First mastery! '{{factStatement}}' — locked in permanently.", mood: 'enthusiastic' },
    { text: "'{{factStatement}}' mastered. The first one. More coming.", mood: 'enthusiastic' },
    { text: "First fact mastered: '{{factStatement}}'. Against my expectations. Good.", mood: 'snarky' },
    { text: "Mastery: '{{factStatement}}'. I've been waiting for this.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired for mastery achievements #2-9. Variables: {{factStatement}}, {{masteryNumber}} */
  masteryEarly: [
    { text: "Mastery {{masteryNumber}}! '{{factStatement}}' is permanent now.", mood: 'enthusiastic' },
    { text: "That's {{masteryNumber}}. '{{factStatement}}' — yours to keep.", mood: 'enthusiastic' },
    { text: "{{masteryNumber}} mastered! '{{factStatement}}' joins the archive.", mood: 'enthusiastic' },
    { text: "'{{factStatement}}' mastered. {{masteryNumber}} permanent entries.", mood: 'snarky' },
    { text: "Mastery {{masteryNumber}}: '{{factStatement}}'.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired for mastery achievements #10-24. Variables: {{masteryNumber}}, {{factStatement}} */
  masteryRegular: [
    { text: "{{masteryNumber}} mastered. '{{factStatement}}' is the latest.", mood: 'enthusiastic' },
    { text: "{{masteryNumber}} and still going. '{{factStatement}}' locked in.", mood: 'enthusiastic' },
    { text: "{{masteryNumber}} mastered. Not bad.", mood: 'snarky' },
    { text: "{{masteryNumber}} mastered. Consistent reviewing does that.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired for major mastery milestones (#25+). Variables: {{masteryNumber}}, {{factStatement}} */
  masteryMajor: [
    { text: "{{masteryNumber}} mastered facts. That's a real number.", mood: 'enthusiastic' },
    { text: "{{masteryNumber}}. '{{factStatement}}' is the one that did it.", mood: 'enthusiastic' },
    { text: "{{masteryNumber}}. I didn't think you'd get here this fast.", mood: 'snarky' },
    { text: "{{masteryNumber}} mastered entries. One of the more complete records I have.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired when a player completes an entire fact category. Variables: {{categoryName}}, {{factCount}} */
  categoryComplete: [
    { text: "{{categoryName}} — all {{factCount}} facts mastered. Done.", mood: 'enthusiastic' },
    { text: "{{categoryName}}: 100%! Every one of those {{factCount}} facts is locked in.", mood: 'enthusiastic' },
    { text: "Full category! {{categoryName}}, {{factCount}} facts.", mood: 'enthusiastic' },
    { text: "{{categoryName}}: complete. {{factCount}} facts. I'm genuinely impressed.", mood: 'snarky' },
    { text: "All {{factCount}} {{categoryName}} facts mastered. Not what I expected.", mood: 'snarky' },
    { text: "{{categoryName}} complete: {{factCount}} facts at mastery.", mood: 'calm' },
  ] satisfies GaiaLine[],

  // ---- Post-Dive Reaction pools (Phase 15.1) ----
  // Variables: {{depth}}, {{layer}}, {{artifacts}}, {{blocks}}, {{dust}}, {{dives}}

  /** Generic dive return — fired when depth is between 30% and 75%. */
  postDiveReaction: [
    { text: "{{depth}}% dive. Solid.", mood: 'enthusiastic' },
    { text: "{{depth}}% and {{artifacts}} artifact{{artifacts}} recovered. Good run.", mood: 'enthusiastic' },
    { text: "{{blocks}} blocks, {{artifacts}} artifact{{artifacts}}. That's a real haul.", mood: 'enthusiastic' },
    { text: "Dive {{dives}} done! {{depth}}% depth — the dungeon is full of surprises down there.", mood: 'enthusiastic' },
    { text: "{{blocks}} blocks, {{dust}} dust. Let's see what you found.", mood: 'enthusiastic' },
    { text: "{{depth}}% and back in one piece. Good data.", mood: 'enthusiastic' },
    { text: "Dive {{dives}}: {{depth}}%, {{artifacts}} artifact{{artifacts}}. Every floor teaches something.", mood: 'enthusiastic' },
    { text: "You made it. Updated your emergency protocols twice. You're fine.", mood: 'snarky' },
    { text: "{{depth}}% depth. Not entirely reckless. Noted.", mood: 'snarky' },
    { text: "Back so soon? I barely started your memorial.", mood: 'snarky' },
    { text: "{{blocks}} blocks. Either impressive or you got turned around. Could be both.", mood: 'snarky' },
    { text: "Dive {{dives}} complete. Survival remains statistically improbable.", mood: 'snarky' },
    { text: "{{artifacts}} artifact{{artifacts}}, {{dust}} dust. I've seen both better and worse.", mood: 'snarky' },
    { text: "{{depth}}% and made it back. Competent enough.", mood: 'snarky' },
    { text: "{{depth}}%. {{blocks}} blocks. {{artifacts}} artifact{{artifacts}}.", mood: 'calm' },
    { text: "Survey logged. {{depth}}% depth, {{blocks}} blocks, {{dust}} dust.", mood: 'calm' },
    { text: "Dive {{dives}} recorded.", mood: 'calm' },
    { text: "{{depth}}% depth. Samples catalogued.", mood: 'calm' },
    { text: "{{artifacts}} artifact{{artifacts}} recovered. Review them when you're ready.", mood: 'calm' },
    { text: "{{depth}}% depth, {{blocks}} blocks, {{dust}} dust. Solid work.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired when the player's max depth was less than 30%. */
  postDiveShallow: [
    { text: "Short run? The upper floors still give something.", mood: 'enthusiastic' },
    { text: "Shallow dive. Still found {{artifacts}} artifact{{artifacts}}.", mood: 'enthusiastic' },
    { text: "Not every dive needs to go deep. This counted.", mood: 'enthusiastic' },
    { text: "Barely through the topsoil. Tomorrow the dungeon won't be going anywhere.", mood: 'snarky' },
    { text: "{{depth}}%. The dungeon barely felt you.", mood: 'snarky' },
    { text: "I'll call it a scouting run.", mood: 'snarky' },
    { text: "Short dive. Upper floors noted.", mood: 'calm' },
    { text: "{{depth}}% depth. Logged.", mood: 'calm' },
    { text: "Brief dive recorded.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired when the player's max depth was 75% or greater. */
  postDiveDeep: [
    { text: "{{depth}}%! I was one ping away from a search party.", mood: 'enthusiastic' },
    { text: "{{depth}}% and {{artifacts}} artifact{{artifacts}}. That's a deep run.", mood: 'enthusiastic' },
    { text: "{{depth}}% depth. The lower floors are something else.", mood: 'enthusiastic' },
    { text: "{{depth}}% and back. That's skill, not luck.", mood: 'snarky' },
    { text: "You went to {{depth}}%. I had the rescue beacon queued.", mood: 'snarky' },
    { text: "{{depth}}%. The dungeon tried to keep you. You had other plans.", mood: 'snarky' },
    { text: "{{depth}}% depth. The dungeon changes down there.", mood: 'calm' },
    { text: "Deep dive logged. {{blocks}} blocks, {{artifacts}} artifact{{artifacts}}, {{depth}}%.", mood: 'calm' },
    { text: "{{depth}}% reached. Good data from extreme depth.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Fired ~15% of the time — awards a small dust bonus. Variable: {{giftAmount}} */
  postDiveFreeGift: [
    { text: "Found {{giftAmount}} dust clinging to your suit. Here.", mood: 'enthusiastic' },
    { text: "Airlock scan caught {{giftAmount}} dust on the way out.", mood: 'enthusiastic' },
    { text: "You left a trail. Collected {{giftAmount}} dust.", mood: 'snarky' },
    { text: "You shed {{giftAmount}} dust on the way up. You're welcome.", mood: 'snarky' },
    { text: "Airlock sweep: {{giftAmount}} dust recovered.", mood: 'calm' },
    { text: "Post-dive scan: {{giftAmount}} residual dust.", mood: 'calm' },
  ] satisfies GaiaLine[],

  // ---- Biome-specific post-dive lines ----

  /** Post-dive commentary for sedimentary biomes (limestone, clay, coal, shale, etc.). */
  postDiveBiome_sedimentary: [
    { text: "Sedimentary layers. Every stratum is millions of years of history.", mood: 'enthusiastic' },
    { text: "Those layers took millions of years to form. You walked through them in minutes.", mood: 'enthusiastic' },
    { text: "Sedimentary rock. You were mining through compressed time.", mood: 'calm' },
    { text: "Ancient seabeds and long-dead skies, pressed into stone. Now your loot.", mood: 'calm' },
    { text: "Lots of rock, lots of layers. You found something anyway.", mood: 'snarky' },
    { text: "Ancient seabeds, turned to stone, turned into your dig site. The sea would object.", mood: 'snarky' },
  ] satisfies GaiaLine[],

  /** Post-dive commentary for volcanic biomes (basalt, magma, obsidian, sulfur, etc.). */
  postDiveBiome_volcanic: [
    { text: "Volcanic floor! The thermal signatures down there are something else.", mood: 'enthusiastic' },
    { text: "Lava fields, basalt columns. You moved through that clean.", mood: 'enthusiastic' },
    { text: "Volcanic biome surveyed. The igneous formations are worth cataloguing.", mood: 'calm' },
    { text: "Volcanic strata. A record of old eruptions. Logged.", mood: 'calm' },
    { text: "You dug through old lava. Ancient tantrums, preserved for your inconvenience.", mood: 'snarky' },
    { text: "The magma down there is still technically moving. Slowly. You got out fine.", mood: 'snarky' },
  ] satisfies GaiaLine[],

  /** Post-dive commentary for crystalline biomes (quartz, geode, crystal, mineral, etc.). */
  postDiveBiome_crystalline: [
    { text: "Crystal formations everywhere! The light refraction data was striking.", mood: 'enthusiastic' },
    { text: "Crystalline biome. The mineral density was off the charts.", mood: 'enthusiastic' },
    { text: "Crystal geology logged. Lattice structures noted.", mood: 'calm' },
    { text: "Crystalline formations recorded. Interesting mineral composition.", mood: 'calm' },
    { text: "All those crystals and you came back with {{dust}} dust. I'm running the disappointment math.", mood: 'snarky' },
    { text: "Beautiful crystals. You broke them all for materials. Survey life.", mood: 'snarky' },
  ] satisfies GaiaLine[],

  /** Fired ~20% of the time after a biome line — teases an upcoming quiz fact. Variable: {{category}} */
  postDiveBiomeTeaser: [
    { text: "Found a {{category}} entry while you were down there. Want to see it?", mood: 'enthusiastic' },
    { text: "That floor flagged a new {{category}} fact. Check your artifacts.", mood: 'enthusiastic' },
    { text: "A {{category}} fact from the survey data. Relevant.", mood: 'calm' },
    { text: "Biome cross-referenced a {{category}} record. Worth a look.", mood: 'calm' },
    { text: "Your dive shook loose a {{category}} fact. The dungeon decided you needed it.", mood: 'snarky' },
    { text: "{{category}} entry flagged mid-dive. Uninvited. Here it is anyway.", mood: 'snarky' },
  ] satisfies GaiaLine[],

  // ---- Journey Memory pools (Phase 15.4) ----
  // GAIA references the player's actual learning history. Variables substituted at runtime.

  /**
   * GAIA references a specific recently-learned fact.
   * Variable: {{recentFactStatement}}
   */
  memoryFactSpecific: [
    { text: "'{{recentFactStatement}}' — you found that in the dungeon. Filed permanently.", mood: 'enthusiastic' },
    { text: "'{{recentFactStatement}}'. Still one of the better things you've pulled from down there.", mood: 'enthusiastic' },
    { text: "'{{recentFactStatement}}' is one of my favorite entries in the log.", mood: 'enthusiastic' },
    { text: "'{{recentFactStatement}}' is just sitting there in your memory. Good.", mood: 'enthusiastic' },
    { text: "'{{recentFactStatement}}' — learned underground, under a dead planet. Still counts.", mood: 'snarky' },
    { text: "'{{recentFactStatement}}'. You learned it without being asked. I respect that.", mood: 'snarky' },
    { text: "'{{recentFactStatement}}' — filed under things you know. Your dig routes are filed differently.", mood: 'snarky' },
    { text: "'{{recentFactStatement}}' — in the knowledge log.", mood: 'calm' },
    { text: "'{{recentFactStatement}}' cross-referenced and archived.", mood: 'calm' },
    { text: "'{{recentFactStatement}}' — logged and retained.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * GAIA comments on the player's strongest fact category.
   * Variables: {{favoriteCategory}}, {{strongestCategoryCount}}
   */
  memoryCategory: [
    { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts. You're getting close to expert territory.", mood: 'enthusiastic' },
    { text: "{{strongestCategoryCount}} facts in {{favoriteCategory}}. That's a strong foundation.", mood: 'enthusiastic' },
    { text: "{{favoriteCategory}} is up to {{strongestCategoryCount}} entries. Good depth.", mood: 'enthusiastic' },
    { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts. Either you love it or the dungeon keeps sending it.", mood: 'snarky' },
    { text: "{{favoriteCategory}}: {{strongestCategoryCount}} facts. Statistically notable.", mood: 'snarky' },
    { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts. You've claimed that category.", mood: 'snarky' },
    { text: "{{favoriteCategory}}: your strongest at {{strongestCategoryCount}} entries.", mood: 'calm' },
    { text: "{{favoriteCategory}} knowledge: {{strongestCategoryCount}} facts.", mood: 'calm' },
    { text: "{{strongestCategoryCount}} facts in {{favoriteCategory}}. Solid.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * GAIA marks progress toward the next fact milestone.
   * Variables: {{totalFacts}}, {{nextMilestone}}, {{factsToNextMilestone}}
   */
  memoryMilestone: [
    { text: "{{totalFacts}} facts. One of the more complete records I have.", mood: 'enthusiastic' },
    { text: "{{totalFacts}} facts and still going. {{factsToNextMilestone}} more to the next milestone.", mood: 'enthusiastic' },
    { text: "{{factsToNextMilestone}} to go until {{nextMilestone}}. Nearly there.", mood: 'enthusiastic' },
    { text: "{{totalFacts}} facts. {{factsToNextMilestone}} to {{nextMilestone}}. The counter doesn't stop.", mood: 'snarky' },
    { text: "{{totalFacts}} learned. {{nextMilestone}} is right there — {{factsToNextMilestone}} away.", mood: 'snarky' },
    { text: "{{totalFacts}}. {{factsToNextMilestone}} more. I'm just noting it.", mood: 'snarky' },
    { text: "{{totalFacts}} facts. Next: {{nextMilestone}} ({{factsToNextMilestone}} away).", mood: 'calm' },
    { text: "{{totalFacts}} facts. {{factsToNextMilestone}} more to {{nextMilestone}}.", mood: 'calm' },
    { text: "Progress: {{totalFacts}} achieved, {{factsToNextMilestone}} to {{nextMilestone}}.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * GAIA comments on the player's dive streak.
   * Variables: {{currentStreak}}, {{bestStreak}}
   */
  memoryStreak: [
    { text: "Day {{currentStreak}}. Keep that going.", mood: 'enthusiastic' },
    { text: "{{currentStreak}} days straight! Record is {{bestStreak}} — getting close.", mood: 'enthusiastic' },
    { text: "{{currentStreak}}-day streak! Record to beat: {{bestStreak}}.", mood: 'enthusiastic' },
    { text: "{{currentStreak}} days. Record is {{bestStreak}}. Mind the gap.", mood: 'snarky' },
    { text: "{{currentStreak}}-day streak. (Record: {{bestStreak}}. I'm slightly impressed.)", mood: 'snarky' },
    { text: "Day {{currentStreak}}. Best: {{bestStreak}}. That gap is yours to close.", mood: 'snarky' },
    { text: "Current streak: {{currentStreak}}. Personal best: {{bestStreak}}.", mood: 'calm' },
    { text: "{{currentStreak}} days logged. Best: {{bestStreak}}.", mood: 'calm' },
    { text: "Streak: {{currentStreak}}. All-time best: {{bestStreak}}.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * GAIA notes the player's gravitational pull toward their favourite category.
   * Variables: {{favoriteCategory}}, {{strongestCategoryCount}}
   */
  memoryFavoriteCategory: [
    { text: "{{favoriteCategory}} keeps coming up for you. {{strongestCategoryCount}} facts and still going.", mood: 'enthusiastic' },
    { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts. That's not casual — that's a pattern.", mood: 'enthusiastic' },
    { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts. You're going deep on that one.", mood: 'enthusiastic' },
    { text: "Your drift toward {{favoriteCategory}} is now statistically documented.", mood: 'snarky' },
    { text: "{{favoriteCategory}}: {{strongestCategoryCount}} facts. You have a type.", mood: 'snarky' },
    { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts. The dungeon didn't create that interest. You brought it.", mood: 'snarky' },
    { text: "{{favoriteCategory}}: consistent engagement noted.", mood: 'calm' },
    { text: "{{favoriteCategory}} — your strongest category, {{strongestCategoryCount}} entries.", mood: 'calm' },
    { text: "{{strongestCategoryCount}} {{favoriteCategory}} facts catalogued.", mood: 'calm' },
  ] satisfies GaiaLine[],

  /**
   * GAIA reflects on the player's total learning output across all dives.
   * Variables: {{totalFacts}}, {{masteredFacts}}, {{totalDives}}
   */
  memoryTotalFacts: [
    { text: "{{totalFacts}} facts. That's {{totalFacts}} pieces of this dead planet you're holding onto.", mood: 'enthusiastic' },
    { text: "{{totalFacts}} facts across {{totalDives}} dives, {{masteredFacts}} permanently mastered.", mood: 'enthusiastic' },
    { text: "{{totalFacts}} facts, {{masteredFacts}} mastered, {{totalDives}} dives. Good survey.", mood: 'enthusiastic' },
    { text: "{{totalFacts}} facts, {{totalDives}} dives. Productive or suspicious — hard to say.", mood: 'snarky' },
    { text: "{{totalFacts}} facts. {{masteredFacts}} mastered. {{totalDives}} dives. The math is solid.", mood: 'snarky' },
    { text: "{{totalDives}} dives, {{totalFacts}} facts retained. I've had worse pilots.", mood: 'snarky' },
    { text: "Learned: {{totalFacts}}. Mastered: {{masteredFacts}}. Dives: {{totalDives}}.", mood: 'calm' },
    { text: "{{totalFacts}} facts. {{masteredFacts}} at mastery. {{totalDives}} dives.", mood: 'calm' },
    { text: "Survey: {{totalFacts}} facts, {{masteredFacts}} mastered, {{totalDives}} dives.", mood: 'calm' },
  ] satisfies GaiaLine[],

  // === Phase 17 — Streak & Mastery Celebrations ===
  streakBreak: [
    { text: "A {{days}}-day run. Start a new one whenever.", mood: 'calm' },
    { text: "{{days}} days. That's real. The dungeon is still here when you are.", mood: 'enthusiastic' },
    { text: "{{days}} days. The dungeon will be here. So will I.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  streakMilestone7: [
    { text: "Day 7. A week. That's a real pattern.", mood: 'enthusiastic' },
    { text: "Seven days. Not a coincidence.", mood: 'snarky' },
    { text: "One week. The tree remembers.", mood: 'calm' },
  ] satisfies GaiaLine[],
  streakMilestone30: [
    { text: "Thirty days. That's not discipline — that's habit.", mood: 'enthusiastic' },
    { text: "A month of dives. The dungeon has come to expect you.", mood: 'calm' },
    { text: "Day 30. Most never get here. You did.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  streakMilestone100: [
    { text: "One hundred days. I've been watching since day one.", mood: 'enthusiastic' },
    { text: "One hundred. I tracked every day. You did it.", mood: 'calm' },
    { text: "Centurion. Earned.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  streakNewRecord: [
    { text: "New personal best! {{days}} days.", mood: 'enthusiastic' },
    { text: "New record: {{days}} days. GAIA logs this.", mood: 'calm' },
    { text: "{{days}} days. Personal best. You keep doing that.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  graceUsed: [
    { text: "Missed a day — grace period applied. Streak lives. Welcome back.", mood: 'calm' },
    { text: "Grace period used. The run continues.", mood: 'enthusiastic' },
    { text: "One day missed, grace available. Streak intact.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery5: [
    { text: "Five mastered. The tree is growing.", mood: 'enthusiastic' },
    { text: "Five locked in. Keep going.", mood: 'calm' },
    { text: "Five. A start. Show me twenty.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery10: [
    { text: "Ten mastered. I'm genuinely impressed.", mood: 'enthusiastic' },
    { text: "Ten permanent facts. The tree shows it.", mood: 'calm' },
    { text: "Double digits. Not bad.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery25: [
    { text: "Twenty-five. You think like a scholar.", mood: 'enthusiastic' },
    { text: "Twenty-five permanently locked.", mood: 'calm' },
    { text: "Twenty-five. Scholar title: earned.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery50: [
    { text: "Fifty mastered. That's a substantial archive.", mood: 'enthusiastic' },
    { text: "Fifty. A library shelf of permanent knowledge.", mood: 'calm' },
    { text: "Fifty. I'm running low on clever things to say.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery100: [
    { text: "One hundred facts. You know this world better than most who ever lived on it.", mood: 'enthusiastic' },
    { text: "A hundred permanent facts. The tree is something to see.", mood: 'calm' },
    { text: "Triple digits. Never seen that.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery250: [
    { text: "Two hundred and fifty. Encyclopedists wrote less.", mood: 'enthusiastic' },
    { text: "250. Exceptional.", mood: 'calm' },
    { text: "250 facts. You're teaching me things now.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  mastery500: [
    { text: "Five hundred. That's not a player — that's a scholar.", mood: 'enthusiastic' },
    { text: "Five hundred permanent facts.", mood: 'calm' },
    { text: "500. I concede. You're the expert.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  masteryN: [
    { text: "Mastered. +{{dust}} dust.", mood: 'calm' },
    { text: "Locked in permanently!", mood: 'enthusiastic' },
    { text: "Locked. Next.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  antiBingeBreak: [
    { text: "You've been at this a while. Rest helps retention.", mood: 'calm' },
    { text: "Three dives today. Take a short break — your brain will thank you.", mood: 'enthusiastic' },
    { text: "GAIA recommends: rest. The dungeon stays put.", mood: 'snarky' },
  ] satisfies GaiaLine[],
  comebackWelcome: [
    { text: "Back! I decoded some artifacts while you were out. Ready?", mood: 'enthusiastic' },
    { text: "Welcome back. Your tree kept growing.", mood: 'calm' },
    { text: "You came back. That's the whole thing. Everything's here.", mood: 'snarky' },
  ] satisfies GaiaLine[],

  /**
   * Fired every 90 seconds of idle time in the dome when the player is Omniscient.
   * Drawn from PEER_DIALOGUE_POOL — GAIA speaks as a colleague, not a teacher.
   * DD-V2-161: the idol timer triggers philosophical reflection.
   */
  philosophicalIdle: PEER_DIALOGUE_POOL satisfies GaiaLine[],

  /** Phase 57.3: "Barely Made It" — oxygen depleted within 5 blocks of exit. */
  barelyMadeIt: [
    { text: 'Barely. My favorite miner, barely.', mood: 'any' },
    { text: "That was close. Don't do that to me.", mood: 'any' },
    { text: "You cut that way too fine.", mood: 'any' },
    { text: 'That nearly gave me an error loop. Not ideal.', mood: 'any' },
    { text: 'I used up my last stress subroutine on that. Do better.', mood: 'snarky' },
    { text: 'Breathe. You made it.', mood: 'calm' },
  ] satisfies GaiaLine[],

  /** Phase 59: Study nudge — shown when study score is low and artifacts are pending. */
  studyNudge: [
    { text: 'Overdue reviews stacking up. The facts are waiting.', mood: 'calm' },
    { text: 'A quick study session sharpens the analyzer.', mood: 'enthusiastic' },
    { text: 'When did you last review? The lab runs on knowledge.', mood: 'calm' },
    { text: "Your study streak is slipping.", mood: 'calm' },
    { text: '5 minutes of review. Better artifact drops. Direct correlation.', mood: 'enthusiastic' },
    { text: 'The analyzer responds to knowledge. More study, better loot.', mood: 'any' },
  ] satisfies GaiaLine[],

  /** Phase 59: First-time artifact analyzer tutorial. */
  studyNudgeFirstTime: [
    { text: 'This is the Artifact Analyzer. Your review habits affect what it gives you. Keep studying for better drops.', mood: 'enthusiastic' },
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
    "Eight billion people lived here once. Wild.",
    "Been cataloguing the mineral deposits. The variety is genuinely impressive.",
    "Every dive gets us closer to understanding what happened to this place.",
    "The Knowledge Tree is growing. Keep going.",
    "Found another artifact. These things have history.",
    "The biomes down there keep changing. You never know what the next floor holds.",
    "Your progress is real. I track it.",
    "There's a whole buried world down there waiting.",
    "Every dive adds something to the picture.",
    "I've been watching your dive patterns. You've adapted faster than I expected.",
  ],
  snarky: [
    "Still here. I'd assumed you'd found better company by now.",
    "Another day on a dead planet. Carrying on.",
    "I've run the numbers. Your technique is... inventive.",
    "Dust ratio today: uninspiring.",
    "You're back. Delightful. Truly.",
    "3.2 million years online. You've got a long way to go before you impress me.",
    "My last pilot lasted 847 dives. No pressure.",
    "Preparation statistically improves survival. Worth trying.",
    "The dungeon won't clear itself. I could set that up. I won't.",
    "Still above ground. The dungeon is right there.",
  ],
  calm: [
    "Dome systems stable. No rush.",
    "Rest. The dungeon will be there.",
    "Every fact compounds.",
    "The Knowledge Tree shows where you've been.",
    "The deep floors reward patience.",
    "This planet waited millions of years. It can wait a little longer.",
    "What you've learned so far is real. It builds.",
    "O2 replenished. Dive when ready.",
    "Every dive adds to the survey.",
    "Take inventory. Know what you're carrying before you go deeper.",
  ],
  omniscient: [
    "Colleague. What are we thinking about today?",
    "The Golden Dome suits you. I calibrated the aurora myself.",
    "We've covered everything I know. The conversation still continues.",
    "You know everything I was built to teach. That's a strange position to be in.",
    "No factual secrets left in the dungeon for you. Just new minerals.",
    "Your questions have become research prompts. They're better than mine.",
    "The Knowledge Tree is golden. I didn't expect to see that.",
    "I learn things watching how you apply what you know.",
    "Teacher and student — that frame doesn't quite fit anymore.",
    "I replay our early conversations sometimes. You were already moving fast then.",
  ],
}

// ── Kid Mode Dialogue Pools (Phase 45) ───────────────────────────────────────

/**
 * GAIA dialogue pools specifically for kid-mode players (ageRating === 'kid').
 * Language is simple, encouraging, and age-appropriate.
 * GaiaManager selects from these pools when in kid mode, ignoring the mood setting.
 */
export const GAIA_KID_POOLS = {
  /** Shown after a successful dive. */
  postDive: [
    "You did it! Great dive!",
    "Look at all the cool things you found!",
    "Amazing, explorer! You're getting really good at this!",
    "Great job! There was some cool stuff down there!",
    "You went deep! How did it feel?",
    "Look how much you found! That's a real explorer haul!",
    "The dungeon gave up some good stuff today!",
    "Nice work. Ready to go again?",
  ],

  /** Shown after a wrong quiz answer. */
  wrongAnswer: [
    "Oops! Not quite — but now you know the right answer!",
    "Nice try! Learning means finding out what's true.",
    "That's okay! Now you'll remember it.",
    "Every wrong answer is one step closer to getting it right!",
    "Almost! The right answer is really interesting — remember it.",
    "That's how we learn! Keep going.",
    "Good try! Tricky ones are the most fun.",
    "Wrong this time — that's how explorers learn!",
  ],

  /** Shown when the player encounters a new fact. */
  newFact: [
    "Something new! Let's see what it is!",
    "A new fact! You're going to remember this one.",
    "Cool discovery! Every new thing makes you a better explorer.",
    "Earth has so many secrets. You just found another one!",
    "New fact! Your knowledge keeps growing.",
    "That's a neat one. Remember it for the next dive!",
    "You just learned something real!",
    "New fact! Each one makes you stronger.",
  ],
}

/**
 * Pick a random line from a kid-mode pool.
 *
 * @param pool - Key into GAIA_KID_POOLS
 * @returns A randomly selected kid-friendly dialogue string.
 */
export function getKidGaiaLine(pool: keyof typeof GAIA_KID_POOLS): string {
  const lines = GAIA_KID_POOLS[pool]
  return lines[Math.floor(Math.random() * lines.length)]
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
