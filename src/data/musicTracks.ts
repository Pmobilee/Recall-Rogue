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
  { id: 'arcane-blades', title: 'Arcane Blades', category: 'epic', file: '/assets/audio/music/epic/arcane-blades.m4a' },
  { id: 'awakening-of-the-deep', title: 'Awakening of the Deep', category: 'epic', file: '/assets/audio/music/epic/awakening-of-the-deep.m4a' },
  { id: 'blood-on-the-flagstones', title: 'Blood on the Flagstones', category: 'epic', file: '/assets/audio/music/epic/blood-on-the-flagstones.m4a' },
  { id: 'chain-lightning', title: 'Chain Lightning', category: 'epic', file: '/assets/audio/music/epic/chain-lightning.m4a' },
  { id: 'crimson-corridors', title: 'Crimson Corridors', category: 'epic', file: '/assets/audio/music/epic/crimson-corridors.m4a' },
  { id: 'descent-of-the-forgotten', title: 'Descent of the Forgotten', category: 'epic', file: '/assets/audio/music/epic/descent-of-the-forgotten.m4a' },
  { id: 'echoes-of-the-fallen', title: 'Echoes of the Fallen', category: 'epic', file: '/assets/audio/music/epic/echoes-of-the-fallen.m4a' },
  { id: 'flickering-resolve', title: 'Flickering Resolve', category: 'epic', file: '/assets/audio/music/epic/flickering-resolve.m4a' },
  { id: 'iron-will', title: 'Iron Will', category: 'epic', file: '/assets/audio/music/epic/iron-will.m4a' },
  { id: 'knowledge-is-power', title: 'Knowledge is Power', category: 'epic', file: '/assets/audio/music/epic/knowledge-is-power.m4a' },
  { id: 'no-retreat', title: 'No Retreat', category: 'epic', file: '/assets/audio/music/epic/no-retreat.m4a' },
  { id: 'rust-and-ruin', title: 'Rust and Ruin', category: 'epic', file: '/assets/audio/music/epic/rust-and-ruin.m4a' },
  { id: 'shattered-seals', title: 'Shattered Seals', category: 'epic', file: '/assets/audio/music/epic/shattered-seals.m4a' },
  { id: 'the-abyss-answers', title: 'The Abyss Answers', category: 'epic', file: '/assets/audio/music/epic/the-abyss-answers.m4a' },
  { id: 'the-gauntlet', title: 'The Gauntlet', category: 'epic', file: '/assets/audio/music/epic/the-gauntlet.m4a' },
  { id: 'the-rogues-triumph', title: "The Rogue's Triumph", category: 'epic', file: '/assets/audio/music/epic/the-rogues-triumph.m4a' },
  { id: 'throne-of-bones', title: 'Throne of Bones', category: 'epic', file: '/assets/audio/music/epic/throne-of-bones.m4a' },
  { id: 'wardens-march', title: "Warden's March", category: 'epic', file: '/assets/audio/music/epic/wardens-march.m4a' },

  // Quiet (14 tracks) — hub, rest sites, map exploration
  { id: 'after-the-dust', title: 'After the Dust', category: 'quiet', file: '/assets/audio/music/quiet/after-the-dust.m4a' },
  { id: 'candlelight-study', title: 'Candlelight Study', category: 'quiet', file: '/assets/audio/music/quiet/candlelight-study.m4a' },
  { id: 'copper-and-dust', title: 'Copper and Dust', category: 'quiet', file: '/assets/audio/music/quiet/copper-and-dust.m4a' },
  { id: 'dust-and-memory', title: 'Dust and Memory', category: 'quiet', file: '/assets/audio/music/quiet/dust-and-memory.m4a' },
  { id: 'ember-glow', title: 'Ember Glow', category: 'quiet', file: '/assets/audio/music/quiet/ember-glow.m4a' },
  { id: 'fools-gold', title: "Fool's Gold", category: 'quiet', file: '/assets/audio/music/quiet/fools-gold.m4a' },
  { id: 'soft-steps', title: 'Soft Steps', category: 'quiet', file: '/assets/audio/music/quiet/soft-steps.m4a' },
  { id: 'stone-lullaby', title: 'Stone Lullaby', category: 'quiet', file: '/assets/audio/music/quiet/stone-lullaby.m4a' },
  { id: 'the-long-road-home', title: 'The Long Road Home', category: 'quiet', file: '/assets/audio/music/quiet/the-long-road-home.m4a' },
  { id: 'thinking-caps', title: 'Thinking Caps', category: 'quiet', file: '/assets/audio/music/quiet/thinking-caps.m4a' },
  { id: 'torchlight-reverie', title: 'Torchlight Reverie', category: 'quiet', file: '/assets/audio/music/quiet/torchlight-reverie.m4a' },
  { id: 'warm-stones', title: 'Warm Stones', category: 'quiet', file: '/assets/audio/music/quiet/warm-stones.m4a' },
  { id: 'extra', title: 'Wandering Thoughts', category: 'quiet', file: '/assets/audio/music/quiet/extra.m4a' },
  { id: 'extra2', title: 'Distant Echoes', category: 'quiet', file: '/assets/audio/music/quiet/extra2.m4a' },
]

/**
 * Returns all tracks for a given category.
 */
export function getTracksByCategory(category: MusicCategory): MusicTrack[] {
  return MUSIC_TRACKS.filter(t => t.category === category)
}
