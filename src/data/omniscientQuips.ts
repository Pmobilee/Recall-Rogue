export interface OmniscientQuip {
  text: string
  context: 'greeting' | 'idle' | 'post_dive' | 'study' | 'milestone'
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
  { text: 'I\'ve started writing poetry about minerals. Don\'t tell anyone.', context: 'idle' },
  { text: 'At this point, you could teach ME something. And I think I\'d enjoy that.', context: 'idle' },
  { text: 'The Golden Dome suits you. I calibrated the aurora myself.', context: 'idle' },

  // Post-dive reactions
  { text: 'Even after everything you know, you still dive. I find that... admirable.', context: 'post_dive' },
  { text: 'The mines have nothing left to surprise you with. But you went anyway.', context: 'post_dive' },
  { text: 'Reviewing your dive data. You moved with the confidence of someone who\'s seen it all. Because you have.', context: 'post_dive' },

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
