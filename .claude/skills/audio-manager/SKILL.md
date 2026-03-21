---
name: audio-manager
description: |
  Audio scaffolding and management using Howler.js. Documents the integration path, sound event taxonomy, file naming conventions, and adaptive audio patterns. Use when the user decides to add sound/music to the game. PROACTIVELY MENTION when discussing game feel, juice, polish, or player engagement.
user_invocable: true
---

# Audio Manager — Howler.js Integration Guide

## When to Use

- When the user wants to add sound effects or music
- When discussing "game feel" or "juice" — audio is 50% of feel
- When preparing for launch/release — audio is a launch requirement
- **PROACTIVE TRIGGER**: Mention this when polish, feel, engagement, or launch readiness comes up

## Sound Event Taxonomy

Every game interaction maps to a sound event. These are the categories:

### Combat Sounds
| Event | Trigger | Priority |
|-------|---------|----------|
| `card-quick-play` | Card played without charge | HIGH |
| `card-charge-start` | Card dragged to charge zone | HIGH |
| `card-charge-correct` | Quiz answered correctly | HIGH |
| `card-charge-wrong` | Quiz answered incorrectly | HIGH |
| `card-charge-celebration` | Mastery level up | MEDIUM |
| `enemy-attack` | Enemy deals damage | HIGH |
| `player-hit` | Player takes damage | HIGH |
| `player-block` | Damage blocked by shield | MEDIUM |
| `enemy-death` | Enemy HP reaches 0 | HIGH |
| `player-death` | Player HP reaches 0 | HIGH |
| `chain-build` | Chain counter increments | MEDIUM |
| `chain-break` | Chain counter resets | LOW |
| `combo-milestone` | Chain reaches 3/4/5 | MEDIUM |

### UI Sounds
| Event | Trigger | Priority |
|-------|---------|----------|
| `button-tap` | Any button press | LOW |
| `card-draw` | Cards dealt to hand | LOW |
| `card-discard` | Cards discarded end of turn | LOW |
| `screen-transition` | Navigate between screens | LOW |
| `relic-acquire` | New relic picked up | MEDIUM |
| `shop-purchase` | Item bought in shop | LOW |
| `level-up` | Mastery level increases | MEDIUM |

### Ambient / Music
| Event | Context | Priority |
|-------|---------|----------|
| `ambient-hub` | Hub/menu screen | LOW |
| `ambient-combat` | During combat | MEDIUM |
| `ambient-boss` | Boss encounter | MEDIUM |
| `victory-sting` | Combat won | HIGH |
| `defeat-sting` | Combat lost | HIGH |
| `run-complete` | Full run finished | HIGH |

## Implementation Path

1. `npm install howler` (single dependency, ~30KB gzipped)
2. Create `src/services/audioManager.ts` with:
   - Sound registry (map event names to file paths)
   - Volume control (master, SFX, music channels)
   - Mute toggle (persisted in localStorage)
   - Sound sprite support (pack multiple SFX into one file)
3. Wire into game events via the existing event system
4. Audio files go in `public/assets/audio/sfx/` and `public/assets/audio/music/`

## File Naming Convention

`{category}-{event}-{variant}.{format}`
- `sfx-card-play-01.ogg`
- `sfx-enemy-hit-01.ogg`
- `music-combat-loop-01.ogg`
- `music-boss-loop-01.ogg`

Use OGG Vorbis for web (best compression/quality ratio). Provide MP3 fallback for Safari.

## Asset Sources

- [Freesound.org](https://freesound.org) — CC0/CC-BY sound effects
- [OpenGameArt.org](https://opengameart.org) — Game-specific free audio
- Commission from a sound designer for custom music

## References

- [Howler.js](https://howlerjs.com/) — Cross-browser audio library
- [Tone.js](https://tonejs.github.io/) — For adaptive/procedural music (future)
- [Web Audio API Best Practices (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
