/**
 * musicTracks.ts
 *
 * Static manifest of all BGM tracks for Recall Rogue.
 * Two categories: 'epic' (combat/dungeon) and 'quiet' (hub/rest/exploration).
 *
 * Files live under public/assets/audio/music/{category}/.
 */

export type MusicCategory = 'epic' | 'quiet'

export interface MusicTrack {
  id: string
  title: string
  category: MusicCategory
  /** Path relative to public root (no leading /public) */
  file: string
}

export const MUSIC_TRACKS: MusicTrack[] = [
  // Epic (18 tracks) — combat, dungeon, boss encounters
  { id: 'arcane-blades', title: 'Arcane Blades', category: 'epic', file: '/assets/audio/music/epic/arcane-blades.mp3' },
  { id: 'awakening-of-the-deep', title: 'Awakening of the Deep', category: 'epic', file: '/assets/audio/music/epic/awakening-of-the-deep.wav' },
  { id: 'blood-on-the-flagstones', title: 'Blood on the Flagstones', category: 'epic', file: '/assets/audio/music/epic/blood-on-the-flagstones.mp3' },
  { id: 'chain-lightning', title: 'Chain Lightning', category: 'epic', file: '/assets/audio/music/epic/chain-lightning.mp3' },
  { id: 'crimson-corridors', title: 'Crimson Corridors', category: 'epic', file: '/assets/audio/music/epic/crimson-corridors.mp3' },
  { id: 'descent-of-the-forgotten', title: 'Descent of the Forgotten', category: 'epic', file: '/assets/audio/music/epic/descent-of-the-forgotten.mp3' },
  { id: 'echoes-of-the-fallen', title: 'Echoes of the Fallen', category: 'epic', file: '/assets/audio/music/epic/echoes-of-the-fallen.mp3' },
  { id: 'flickering-resolve', title: 'Flickering Resolve', category: 'epic', file: '/assets/audio/music/epic/flickering-resolve.mp3' },
  { id: 'iron-will', title: 'Iron Will', category: 'epic', file: '/assets/audio/music/epic/iron-will.mp3' },
  { id: 'knowledge-is-power', title: 'Knowledge is Power', category: 'epic', file: '/assets/audio/music/epic/knowledge-is-power.mp3' },
  { id: 'no-retreat', title: 'No Retreat', category: 'epic', file: '/assets/audio/music/epic/no-retreat.mp3' },
  { id: 'rust-and-ruin', title: 'Rust and Ruin', category: 'epic', file: '/assets/audio/music/epic/rust-and-ruin.mp3' },
  { id: 'shattered-seals', title: 'Shattered Seals', category: 'epic', file: '/assets/audio/music/epic/shattered-seals.mp3' },
  { id: 'the-abyss-answers', title: 'The Abyss Answers', category: 'epic', file: '/assets/audio/music/epic/the-abyss-answers.mp3' },
  { id: 'the-gauntlet', title: 'The Gauntlet', category: 'epic', file: '/assets/audio/music/epic/the-gauntlet.mp3' },
  { id: 'the-rogues-triumph', title: "The Rogue's Triumph", category: 'epic', file: '/assets/audio/music/epic/the-rogues-triumph.mp3' },
  { id: 'throne-of-bones', title: 'Throne of Bones', category: 'epic', file: '/assets/audio/music/epic/throne-of-bones.mp3' },
  { id: 'wardens-march', title: "Warden's March", category: 'epic', file: '/assets/audio/music/epic/wardens-march.mp3' },

  // Quiet (14 tracks) — hub, rest sites, map exploration
  { id: 'after-the-dust', title: 'After the Dust', category: 'quiet', file: '/assets/audio/music/quiet/after-the-dust.mp3' },
  { id: 'candlelight-study', title: 'Candlelight Study', category: 'quiet', file: '/assets/audio/music/quiet/candlelight-study.mp3' },
  { id: 'copper-and-dust', title: 'Copper and Dust', category: 'quiet', file: '/assets/audio/music/quiet/copper-and-dust.mp3' },
  { id: 'dust-and-memory', title: 'Dust and Memory', category: 'quiet', file: '/assets/audio/music/quiet/dust-and-memory.mp3' },
  { id: 'ember-glow', title: 'Ember Glow', category: 'quiet', file: '/assets/audio/music/quiet/ember-glow.mp3' },
  { id: 'fools-gold', title: "Fool's Gold", category: 'quiet', file: '/assets/audio/music/quiet/fools-gold.mp3' },
  { id: 'soft-steps', title: 'Soft Steps', category: 'quiet', file: '/assets/audio/music/quiet/soft-steps.mp3' },
  { id: 'stone-lullaby', title: 'Stone Lullaby', category: 'quiet', file: '/assets/audio/music/quiet/stone-lullaby.mp3' },
  { id: 'the-long-road-home', title: 'The Long Road Home', category: 'quiet', file: '/assets/audio/music/quiet/the-long-road-home.mp3' },
  { id: 'thinking-caps', title: 'Thinking Caps', category: 'quiet', file: '/assets/audio/music/quiet/thinking-caps.mp3' },
  { id: 'torchlight-reverie', title: 'Torchlight Reverie', category: 'quiet', file: '/assets/audio/music/quiet/torchlight-reverie.mp3' },
  { id: 'warm-stones', title: 'Warm Stones', category: 'quiet', file: '/assets/audio/music/quiet/warm-stones.mp3' },
  { id: 'extra', title: 'Wandering Thoughts', category: 'quiet', file: '/assets/audio/music/quiet/extra.mp3' },
  { id: 'extra2', title: 'Distant Echoes', category: 'quiet', file: '/assets/audio/music/quiet/extra2.mp3' },
]

/**
 * Returns all tracks for a given category.
 */
export function getTracksByCategory(category: MusicCategory): MusicTrack[] {
  return MUSIC_TRACKS.filter(t => t.category === category)
}
