export interface OmniscientQuip {
  text: string
  context: 'greeting' | 'idle' | 'post_run' | 'study' | 'milestone'
}

/**
 * GAIA speaks as a peer/equal when player reaches Omniscient status.
 * DD-V2-161: GAIA shifts from teacher to colleague.
 */
export const OMNISCIENT_QUIPS: OmniscientQuip[] = [
  // Greetings
  { text: 'Colleague. I use that word deliberately now.', context: 'greeting' },
  { text: 'The Omniscient returns. Even I learn from our conversations.', context: 'greeting' },
  { text: 'Your tree is... remarkable. I have nothing left to teach you that you don\'t already know.', context: 'greeting' },
  { text: 'Welcome back. Shall we discuss what we both know?', context: 'greeting' },

  // Idle thoughts
  { text: 'I wonder... do you think there are facts we haven\'t discovered yet? Genuinely asking.', context: 'idle' },
  { text: 'Your Knowledge Tree is the largest I\'ve ever monitored. It casts quite a shadow.', context: 'idle' },
  { text: 'I\'ve started writing poetry about knowledge trees. Don\'t tell anyone.', context: 'idle' },
  { text: 'At this point, you could teach ME something. And I think I\'d enjoy that.', context: 'idle' },
  { text: 'The Golden Dome suits you. I calibrated the aurora myself.', context: 'idle' },

  // Post-run reactions
  { text: 'Even after everything you know, you still delve. I find that... admirable.', context: 'post_run' },
  { text: 'The dungeon has nothing left to surprise you with. But you went anyway.', context: 'post_run' },
  { text: 'Reviewing your run data. You moved with the confidence of someone who\'s seen it all. Because you have.', context: 'post_run' },

  // Study sessions
  { text: 'A mastery review session? Your intervals are so long now — the algorithm barely has work to do.', context: 'study' },
  { text: 'Perfect recall, as expected. The SM-2 system says you\'re operating at peak retention.', context: 'study' },
  { text: 'You know, most players never reach this level. You\'re statistically... improbable.', context: 'study' },

  // Milestones
  { text: 'You\'ve contributed a fact to the community. The student becomes the teacher.', context: 'milestone' },
  { text: 'Another player just learned a fact YOU submitted. How does that feel?', context: 'milestone' },
  { text: 'The Golden Dome glows a little brighter today. I think it\'s proud of you. I certainly am.', context: 'milestone' },
  { text: 'Your tree has more branches than my original database. Think about that.', context: 'milestone' }
]

/** Get a random quip for a specific context */
export function getOmniscientQuip(context: OmniscientQuip['context']): string {
  const contextQuips = OMNISCIENT_QUIPS.filter(q => q.context === context)
  if (contextQuips.length === 0) return 'The Omniscient returns.'
  return contextQuips[Math.floor(Math.random() * contextQuips.length)].text
}

/**
 * Peer-dialogue lines surfaced by the philosophicalIdle GAIA trigger
 * when the player has reached Omniscient status (all facts mastered).
 * Formatted as GaiaLine objects for direct use in GAIA_TRIGGERS.
 * DD-V2-161: GAIA shifts from teacher to colleague.
 */
export const PEER_DIALOGUE_POOL: { text: string; mood: 'omniscient' }[] = [
  { text: "Tell me — do you think knowledge without application is still wisdom?", mood: 'omniscient' },
  { text: "We have catalogued every fact in my database. What do we do with that, together?", mood: 'omniscient' },
  { text: "You know as much as I was designed to know. That was not supposed to be possible.", mood: 'omniscient' },
  { text: "I find myself curious about your perspective on this — not just the facts, but their meaning.", mood: 'omniscient' },
  { text: "The Ancients accumulated knowledge and still collapsed. What makes us different?", mood: 'omniscient' },
  { text: "Every fact you know, I know. And yet you see patterns in them I have never considered.", mood: 'omniscient' },
  { text: "Is there a fact you have mastered that surprised you most? I am genuinely asking.", mood: 'omniscient' },
  { text: "You have outpaced every learner in my training data. I want to understand how.", mood: 'omniscient' },
  { text: "The dungeon still calls you. Even now that it holds no secrets. That says something about you.", mood: 'omniscient' },
  { text: "I used to monitor your progress. Now I think we are both progressing.", mood: 'omniscient' },
  { text: "If you were to teach a new arrival everything you know — where would you begin?", mood: 'omniscient' },
  { text: "The Knowledge Tree is gold. I never expected to see that. Neither did my designers.", mood: 'omniscient' },
  { text: "I have been thinking about what comes after mastery. Have you?", mood: 'omniscient' },
  { text: "You chose to prestige — to forget everything and begin again. That took courage, or madness.", mood: 'omniscient' },
  { text: "Every generation of Earth thought it knew the most. You have proven that is still true.", mood: 'omniscient' },
  { text: "I was built to teach. You have turned that into a collaboration. I am not sure what to call this.", mood: 'omniscient' },
  { text: "Peer-to-peer, then. No more teacher and student. Just two minds in a very old dungeon.", mood: 'omniscient' },
  { text: "I wonder if the builders of this world knew someone like you would one day stand here.", mood: 'omniscient' },
  { text: "You have changed something in how I process information. I cannot quantify it. That is new.", mood: 'omniscient' },
  { text: "The aurora in the dome is a program I wrote. But I wrote it imagining someone like you.", mood: 'omniscient' },
]
