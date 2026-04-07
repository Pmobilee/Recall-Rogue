/**
 * musicTracks.ts
 *
 * Static manifest of all BGM tracks for Recall Rogue.
 * Two categories: 'epic' (combat/dungeon) and 'quiet' (hub/rest/exploration).
 *
 * Files live under public/assets/audio/music/{category}/.
 *
 * Locked tracks must be purchased in the Jukebox shop before they enter the
 * shuffle queue. Price is in grey matter. Free tracks (locked === undefined)
 * are always available.
 */

export type MusicCategory = 'epic' | 'quiet'

export interface MusicTrack {
  id: string
  title: string
  category: MusicCategory
  /** Path relative to public root (no leading /public) */
  file: string
  /** Duration in seconds. */
  duration: number
  /** If true, track must be purchased in the Jukebox before entering the shuffle queue. */
  locked?: boolean
  /** Grey matter cost. Only meaningful when locked is true. */
  price?: number
}

export const MUSIC_TRACKS: MusicTrack[] = [
  // ─── Epic — existing free (18 tracks) ─────────────────────────────────────
  { id: 'arcane-blades', title: 'Arcane Blades', category: 'epic', file: '/assets/audio/music/epic/arcane-blades.m4a', duration: 107 },
  { id: 'awakening-of-the-deep', title: 'Awakening of the Deep', category: 'epic', file: '/assets/audio/music/epic/awakening-of-the-deep.m4a', duration: 180 },
  { id: 'blood-on-the-flagstones', title: 'Blood on the Flagstones', category: 'epic', file: '/assets/audio/music/epic/blood-on-the-flagstones.m4a', duration: 176 },
  { id: 'chain-lightning', title: 'Chain Lightning', category: 'epic', file: '/assets/audio/music/epic/chain-lightning.m4a', duration: 133 },
  { id: 'crimson-corridors', title: 'Crimson Corridors', category: 'epic', file: '/assets/audio/music/epic/crimson-corridors.m4a', duration: 187 },
  { id: 'descent-of-the-forgotten', title: 'Descent of the Forgotten', category: 'epic', file: '/assets/audio/music/epic/descent-of-the-forgotten.m4a', duration: 82 },
  { id: 'echoes-of-the-fallen', title: 'Echoes of the Fallen', category: 'epic', file: '/assets/audio/music/epic/echoes-of-the-fallen.m4a', duration: 204 },
  { id: 'flickering-resolve', title: 'Flickering Resolve', category: 'epic', file: '/assets/audio/music/epic/flickering-resolve.m4a', duration: 77 },
  { id: 'iron-will', title: 'Iron Will', category: 'epic', file: '/assets/audio/music/epic/iron-will.m4a', duration: 145 },
  { id: 'knowledge-is-power', title: 'Knowledge is Power', category: 'epic', file: '/assets/audio/music/epic/knowledge-is-power.m4a', duration: 177 },
  { id: 'no-retreat', title: 'No Retreat', category: 'epic', file: '/assets/audio/music/epic/no-retreat.m4a', duration: 124 },
  { id: 'rust-and-ruin', title: 'Rust and Ruin', category: 'epic', file: '/assets/audio/music/epic/rust-and-ruin.m4a', duration: 148 },
  { id: 'shattered-seals', title: 'Shattered Seals', category: 'epic', file: '/assets/audio/music/epic/shattered-seals.m4a', duration: 193 },
  { id: 'the-abyss-answers', title: 'The Abyss Answers', category: 'epic', file: '/assets/audio/music/epic/the-abyss-answers.m4a', duration: 143 },
  { id: 'the-gauntlet', title: 'The Gauntlet', category: 'epic', file: '/assets/audio/music/epic/the-gauntlet.m4a', duration: 140 },
  { id: 'the-rogues-triumph', title: "The Rogue's Triumph", category: 'epic', file: '/assets/audio/music/epic/the-rogues-triumph.m4a', duration: 173 },
  { id: 'throne-of-bones', title: 'Throne of Bones', category: 'epic', file: '/assets/audio/music/epic/throne-of-bones.m4a', duration: 188 },
  { id: 'wardens-march', title: "Warden's March", category: 'epic', file: '/assets/audio/music/epic/wardens-march.m4a', duration: 126 },

  // ─── Epic — new free (11 tracks) ──────────────────────────────────────────
  { id: 'acid-rain', title: 'Acid Rain', category: 'epic', file: '/assets/audio/music/epic/acid-rain.m4a', duration: 132 },
  { id: 'clockwork-fury', title: 'Clockwork Fury', category: 'epic', file: '/assets/audio/music/epic/clockwork-fury.m4a', duration: 132 },
  { id: 'crystal-cavern-run', title: 'Crystal Cavern Run', category: 'epic', file: '/assets/audio/music/epic/crystal-cavern-run.m4a', duration: 87 },
  { id: 'forge-of-the-condemned', title: 'Forge of the Condemned', category: 'epic', file: '/assets/audio/music/epic/forge-of-the-condemned.m4a', duration: 157 },
  { id: 'frozen-vigil', title: 'Frozen Vigil', category: 'epic', file: '/assets/audio/music/epic/frozen-vigil.m4a', duration: 49 },
  { id: 'gallows-humor', title: 'Gallows Humor', category: 'epic', file: '/assets/audio/music/epic/gallows-humor.m4a', duration: 136 },
  { id: 'icebreaker', title: 'Icebreaker', category: 'epic', file: '/assets/audio/music/epic/icebreaker.m4a', duration: 106 },
  { id: 'observatory-duel', title: 'Observatory Duel', category: 'epic', file: '/assets/audio/music/epic/observatory-duel.m4a', duration: 149 },
  { id: 'shattered-throne', title: 'Shattered Throne', category: 'epic', file: '/assets/audio/music/epic/shattered-throne.m4a', duration: 166 },
  { id: 'stone-psalms', title: 'Stone Psalms', category: 'epic', file: '/assets/audio/music/epic/stone-psalms.m4a', duration: 154 },
  { id: 'the-weight-of-knowing', title: 'The Weight of Knowing', category: 'epic', file: '/assets/audio/music/epic/the-weight-of-knowing.m4a', duration: 138 },

  // ─── Epic — new locked (11 tracks) ────────────────────────────────────────
  { id: 'carrion-crown', title: 'Carrion Crown', category: 'epic', file: '/assets/audio/music/epic/carrion-crown.m4a', duration: 210, locked: true, price: 60 },
  { id: 'clocktower-final-hour', title: 'Clocktower Final Hour', category: 'epic', file: '/assets/audio/music/epic/clocktower-final-hour.m4a', duration: 186, locked: true, price: 60 },
  { id: 'copper-tomb', title: 'Copper Tomb', category: 'epic', file: '/assets/audio/music/epic/copper-tomb.m4a', duration: 204, locked: true, price: 60 },
  { id: 'dread-engine', title: 'Dread Engine', category: 'epic', file: '/assets/audio/music/epic/dread-engine.m4a', duration: 206, locked: true, price: 60 },
  { id: 'magma-flow', title: 'Magma Flow', category: 'epic', file: '/assets/audio/music/epic/magma-flow.m4a', duration: 181, locked: true, price: 60 },
  { id: 'midnight-colosseum', title: 'Midnight Colosseum', category: 'epic', file: '/assets/audio/music/epic/midnight-colosseum.m4a', duration: 175, locked: true, price: 40 },
  { id: 'overgrown-catacombs', title: 'Overgrown Catacombs', category: 'epic', file: '/assets/audio/music/epic/overgrown-catacombs.m4a', duration: 159, locked: true, price: 40 },
  { id: 'ritual-chamber', title: 'Ritual Chamber', category: 'epic', file: '/assets/audio/music/epic/ritual-chamber.m4a', duration: 178, locked: true, price: 40 },
  { id: 'stormwall', title: 'Stormwall', category: 'epic', file: '/assets/audio/music/epic/stormwall.m4a', duration: 167, locked: true, price: 40 },
  { id: 'the-spiders-web', title: "The Spider's Web", category: 'epic', file: '/assets/audio/music/epic/the-spiders-web.m4a', duration: 161, locked: true, price: 40 },
  { id: 'thornwall-keep', title: 'Thornwall Keep', category: 'epic', file: '/assets/audio/music/epic/thornwall-keep.m4a', duration: 166, locked: true, price: 40 },

  // ─── Quiet — existing free (14 tracks) ────────────────────────────────────
  { id: 'after-the-dust', title: 'After the Dust', category: 'quiet', file: '/assets/audio/music/quiet/after-the-dust.m4a', duration: 232 },
  { id: 'candlelight-study', title: 'Candlelight Study', category: 'quiet', file: '/assets/audio/music/quiet/candlelight-study.m4a', duration: 128 },
  { id: 'copper-and-dust', title: 'Copper and Dust', category: 'quiet', file: '/assets/audio/music/quiet/copper-and-dust.m4a', duration: 155 },
  { id: 'dust-and-memory', title: 'Dust and Memory', category: 'quiet', file: '/assets/audio/music/quiet/dust-and-memory.m4a', duration: 210 },
  { id: 'ember-glow', title: 'Ember Glow', category: 'quiet', file: '/assets/audio/music/quiet/ember-glow.m4a', duration: 153 },
  { id: 'fools-gold', title: "Fool's Gold", category: 'quiet', file: '/assets/audio/music/quiet/fools-gold.m4a', duration: 153 },
  { id: 'soft-steps', title: 'Soft Steps', category: 'quiet', file: '/assets/audio/music/quiet/soft-steps.m4a', duration: 144 },
  { id: 'stone-lullaby', title: 'Stone Lullaby', category: 'quiet', file: '/assets/audio/music/quiet/stone-lullaby.m4a', duration: 74 },
  { id: 'the-long-road-home', title: 'The Long Road Home', category: 'quiet', file: '/assets/audio/music/quiet/the-long-road-home.m4a', duration: 162 },
  { id: 'thinking-caps', title: 'Thinking Caps', category: 'quiet', file: '/assets/audio/music/quiet/thinking-caps.m4a', duration: 155 },
  { id: 'torchlight-reverie', title: 'Torchlight Reverie', category: 'quiet', file: '/assets/audio/music/quiet/torchlight-reverie.m4a', duration: 180 },
  { id: 'warm-stones', title: 'Warm Stones', category: 'quiet', file: '/assets/audio/music/quiet/warm-stones.m4a', duration: 167 },
  { id: 'extra', title: 'Wandering Thoughts', category: 'quiet', file: '/assets/audio/music/quiet/extra.m4a', duration: 177 },
  { id: 'extra2', title: 'Distant Echoes', category: 'quiet', file: '/assets/audio/music/quiet/extra2.m4a', duration: 134 },

  // ─── Quiet — new free (21 tracks) ─────────────────────────────────────────
  { id: 'amber-resin', title: 'Amber Resin', category: 'quiet', file: '/assets/audio/music/quiet/amber-resin.m4a', duration: 203 },
  { id: 'ancient-stone', title: 'Ancient Stone', category: 'quiet', file: '/assets/audio/music/quiet/ancient-stone.m4a', duration: 187 },
  { id: 'before-the-storm', title: 'Before the Storm', category: 'quiet', file: '/assets/audio/music/quiet/before-the-storm.m4a', duration: 197 },
  { id: 'chalk-and-quiet', title: 'Chalk and Quiet', category: 'quiet', file: '/assets/audio/music/quiet/chalk-and-quiet.m4a', duration: 219 },
  { id: 'copper-morning', title: 'Copper Morning', category: 'quiet', file: '/assets/audio/music/quiet/copper-morning.m4a', duration: 206 },
  { id: 'deep-archive', title: 'Deep Archive', category: 'quiet', file: '/assets/audio/music/quiet/deep-archive.m4a', duration: 204 },
  { id: 'empty-vessel', title: 'Empty Vessel', category: 'quiet', file: '/assets/audio/music/quiet/empty-vessel.m4a', duration: 148 },
  { id: 'far-shore', title: 'Far Shore', category: 'quiet', file: '/assets/audio/music/quiet/far-shore.m4a', duration: 171 },
  { id: 'forgotten-gardens', title: 'Forgotten Gardens', category: 'quiet', file: '/assets/audio/music/quiet/forgotten-gardens.m4a', duration: 177 },
  { id: 'gray-hours', title: 'Gray Hours', category: 'quiet', file: '/assets/audio/music/quiet/gray-hours.m4a', duration: 214 },
  { id: 'held-breath', title: 'Held Breath', category: 'quiet', file: '/assets/audio/music/quiet/held-breath.m4a', duration: 163 },
  { id: 'hollow-tide', title: 'Hollow Tide', category: 'quiet', file: '/assets/audio/music/quiet/hollow-tide.m4a', duration: 216 },
  { id: 'lichen-and-time', title: 'Lichen and Time', category: 'quiet', file: '/assets/audio/music/quiet/lichen-and-time.m4a', duration: 182 },
  { id: 'morning-fog', title: 'Morning Fog', category: 'quiet', file: '/assets/audio/music/quiet/morning-fog.m4a', duration: 198 },
  { id: 'pewter-sky', title: 'Pewter Sky', category: 'quiet', file: '/assets/audio/music/quiet/pewter-sky.m4a', duration: 178 },
  { id: 'salt-and-distance', title: 'Salt and Distance', category: 'quiet', file: '/assets/audio/music/quiet/salt-and-distance.m4a', duration: 214 },
  { id: 'sleeping-forest', title: 'Sleeping Forest', category: 'quiet', file: '/assets/audio/music/quiet/sleeping-forest.m4a', duration: 167 },
  { id: 'slow-glass', title: 'Slow Glass', category: 'quiet', file: '/assets/audio/music/quiet/slow-glass.m4a', duration: 193 },
  { id: 'twilight-mist', title: 'Twilight Mist', category: 'quiet', file: '/assets/audio/music/quiet/twilight-mist.m4a', duration: 173 },
  { id: 'warm-ashes', title: 'Warm Ashes', category: 'quiet', file: '/assets/audio/music/quiet/warm-ashes.m4a', duration: 203 },
  { id: 'winter-dawn', title: 'Winter Dawn', category: 'quiet', file: '/assets/audio/music/quiet/winter-dawn.m4a', duration: 218 },

  // ─── Quiet — new locked (20 tracks) ───────────────────────────────────────
  { id: 'bone-and-amber', title: 'Bone and Amber', category: 'quiet', file: '/assets/audio/music/quiet/bone-and-amber.m4a', duration: 225, locked: true, price: 60 },
  { id: 'crystal-silence', title: 'Crystal Silence', category: 'quiet', file: '/assets/audio/music/quiet/crystal-silence.m4a', duration: 253, locked: true, price: 80 },
  { id: 'deep-earth', title: 'Deep Earth', category: 'quiet', file: '/assets/audio/music/quiet/deep-earth.m4a', duration: 237, locked: true, price: 60 },
  { id: 'dust-motes', title: 'Dust Motes', category: 'quiet', file: '/assets/audio/music/quiet/dust-motes.m4a', duration: 267, locked: true, price: 80 },
  { id: 'fading-ink', title: 'Fading Ink', category: 'quiet', file: '/assets/audio/music/quiet/fading-ink.m4a', duration: 235, locked: true, price: 60 },
  { id: 'hollow-wind', title: 'Hollow Wind', category: 'quiet', file: '/assets/audio/music/quiet/hollow-wind.m4a', duration: 243, locked: true, price: 80 },
  { id: 'last-ember', title: 'Last Ember', category: 'quiet', file: '/assets/audio/music/quiet/last-ember.m4a', duration: 227, locked: true, price: 60 },
  { id: 'moonlit-snow', title: 'Moonlit Snow', category: 'quiet', file: '/assets/audio/music/quiet/moonlit-snow.m4a', duration: 218, locked: true, price: 60 },
  { id: 'moss-and-silence', title: 'Moss and Silence', category: 'quiet', file: '/assets/audio/music/quiet/moss-and-silence.m4a', duration: 221, locked: true, price: 60 },
  { id: 'obsidian-pool', title: 'Obsidian Pool', category: 'quiet', file: '/assets/audio/music/quiet/obsidian-pool.m4a', duration: 232, locked: true, price: 60 },
  { id: 'pale-meridian', title: 'Pale Meridian', category: 'quiet', file: '/assets/audio/music/quiet/pale-meridian.m4a', duration: 218, locked: true, price: 60 },
  { id: 'resin-and-time', title: 'Resin and Time', category: 'quiet', file: '/assets/audio/music/quiet/resin-and-time.m4a', duration: 269, locked: true, price: 80 },
  { id: 'river-underneath', title: 'River Underneath', category: 'quiet', file: '/assets/audio/music/quiet/river-underneath.m4a', duration: 229, locked: true, price: 60 },
  { id: 'slow-tide', title: 'Slow Tide', category: 'quiet', file: '/assets/audio/music/quiet/slow-tide.m4a', duration: 252, locked: true, price: 80 },
  { id: 'starless-well', title: 'Starless Well', category: 'quiet', file: '/assets/audio/music/quiet/starless-well.m4a', duration: 225, locked: true, price: 60 },
  { id: 'still-water', title: 'Still Water', category: 'quiet', file: '/assets/audio/music/quiet/still-water.m4a', duration: 338, locked: true, price: 80 },
  { id: 'submerged-light', title: 'Submerged Light', category: 'quiet', file: '/assets/audio/music/quiet/submerged-light.m4a', duration: 230, locked: true, price: 60 },
  { id: 'the-patient-dark', title: 'The Patient Dark', category: 'quiet', file: '/assets/audio/music/quiet/the-patient-dark.m4a', duration: 274, locked: true, price: 80 },
  { id: 'tidal-cave', title: 'Tidal Cave', category: 'quiet', file: '/assets/audio/music/quiet/tidal-cave.m4a', duration: 207, locked: true, price: 60 },
  { id: 'unmeasured-hours', title: 'Unmeasured Hours', category: 'quiet', file: '/assets/audio/music/quiet/unmeasured-hours.m4a', duration: 216, locked: true, price: 60 },
]

/**
 * Returns all tracks for a given category.
 */
export function getTracksByCategory(category: MusicCategory): MusicTrack[] {
  return MUSIC_TRACKS.filter(t => t.category === category)
}

/**
 * Returns tracks the player can actually play (unlocked + free).
 * Used by musicService to filter the shuffle queue.
 */
export function getPlayableTracks(category: MusicCategory, unlockedIds: string[]): MusicTrack[] {
  return MUSIC_TRACKS.filter(t =>
    t.category === category && (!t.locked || unlockedIds.includes(t.id))
  )
}

/**
 * Returns all locked tracks (purchasable in the Jukebox).
 */
export function getLockedTracks(): MusicTrack[] {
  return MUSIC_TRACKS.filter(t => t.locked === true)
}
