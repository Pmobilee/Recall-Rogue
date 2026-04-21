/**
 * Lightweight English profanity masking + title sanitization for multiplayer lobby content.
 *
 * Design:
 *   - Storage is unchanged — masking happens at render time only. Hosts see their own
 *     unmodified title in the lobby they created; other players see asterisks over
 *     matched words.
 *   - Server-side only applies `sanitizeLobbyTitle` (length / control-char strip).
 *     Masking is a presentation-layer decision each client makes independently.
 *   - Leet-speak normalization (0→o, 1→i, etc.) is applied for matching only;
 *     the replacement covers the original span, preserving its length with asterisks.
 *   - Leet substitution is only applied when the leet char is adjacent to (or surrounded
 *     by) an alpha character, preventing sentence-terminal punctuation (e.g. "cunt!")
 *     from corrupting word boundaries.
 *
 * Risk:
 *   A modded client can disable masking client-side. That's acceptable — this is
 *   default-safe display for honest players, not a hard moderation barrier.
 *   Persistent-abuse vectors need server-side bans (out of scope for this wave).
 *
 * Usage:
 *   import { maskProfanity, sanitizeLobbyTitle } from './profanityService'
 *   // At render time:
 *   const label = maskProfanity(entry.title ?? entry.hostName)
 *   // At creation time (client + server):
 *   const stored = sanitizeLobbyTitle(rawTitleInput)
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum character length for a lobby title. Matches HTML maxlength attr. */
export const TITLE_MAX_LENGTH = 40;

// ── Word list ────────────────────────────────────────────────────────────────

/**
 * Curated list of unambiguous English slurs and obscenities.
 * Kept tight to avoid false positives (the "Scunthorpe problem").
 * English-only for v1; multi-language is a future content-pipeline task.
 * Entries are lowercase — matching runs on a normalized form of the input.
 */
const BANNED_WORDS: readonly string[] = [
  'asshole', 'assholes',
  'bastard', 'bastards',
  'bitch', 'bitches',
  'bullshit',
  'cocksucker', 'cocksuckers',
  'cunt', 'cunts',
  'dickhead', 'dickheads',
  'faggot', 'faggots',
  'motherfucker', 'motherfuckers',
  'nigger', 'niggers',
  'nigga', 'niggas',
  'prick', 'pricks',
  'pussy', 'pussies',
  'retard', 'retards',
  'shithead', 'shitheads',
  'slut', 'sluts',
  'spic', 'spics',
  'twat', 'twats',
  'whore', 'whores',
  'kike', 'kikes',
  'chink', 'chinks',
  'wetback', 'wetbacks',
  'tranny', 'trannies',
  'cracker',
  'dyke', 'dykes',
  'fag', 'fags',
  'gook', 'gooks',
  'jizz',
  'spunk',
];

// ── Leet-speak normalization ─────────────────────────────────────────────────

const LEET_MAP: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
};

/** Regex for characters that have leet-speak letter equivalents. */
const LEET_CHARS = /[013457@$]/g;

/**
 * Normalize a string for banned-word matching.
 *
 * Lowercases and applies leet-speak substitutions — but only when the leet char
 * is adjacent to an alpha character on at least one side. This prevents
 * sentence-terminal punctuation (e.g. the `!` in `"cunt!"`) from being converted
 * to a letter (`i`), which would merge with the preceding word and break
 * word-boundary detection.
 *
 * Example: `b1tch` → `bitch`  (1 is between `b` and `t` — substituted)
 *          `cunt!` → `cunt!`  (! has no alpha neighbour on the right — preserved)
 *
 * Does NOT strip non-alpha characters — span lengths stay aligned with the
 * original input for asterisk replacement.
 */
function normalizeForMatch(s: string): string {
  const lower = s.toLowerCase();
  return lower.replace(LEET_CHARS, (ch, offset, str) => {
    const prevAlpha = offset > 0 && /[a-z]/.test(str[offset - 1]);
    const nextAlpha = offset < str.length - 1 && /[a-z]/.test(str[offset + 1]);
    return (prevAlpha || nextAlpha) ? (LEET_MAP[ch] ?? ch) : ch;
  });
}

// ── Internal helpers ─────────────────────────────────────────────────────────

const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

/**
 * Escape a string for safe literal use inside a RegExp pattern.
 * Handles the word-list entries that may contain special regex chars (unlikely
 * but defensive programming).
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Mask any banned words found in `input` with asterisks of the same length.
 *
 * Algorithm:
 *   For each banned word `w`, build a regex that matches `w` in the normalized
 *   form of the input at word boundaries. When a match is found in the normalized
 *   string, replace the corresponding span in the original string with '*' × span.length.
 *   This preserves non-banned text verbatim and retains the original character count.
 *
 * Example:
 *   maskProfanity('Hello b1tch!')  → 'Hello *****!'
 *   maskProfanity('Nice game')     → 'Nice game'
 *   maskProfanity('')              → ''
 *
 * @param input - Raw string to scan. Undefined/null treated as empty string.
 * @returns The input with any banned spans replaced by asterisks.
 */
export function maskProfanity(input: string): string {
  if (!input) return input ?? '';

  const normalized = normalizeForMatch(input);
  // Work on a character array so we can do position-based replacement.
  const masked = input.split('');

  for (const word of BANNED_WORDS) {
    // Match the word at word boundaries in the normalized view.
    // Use a global regex so we catch multiple occurrences.
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalized)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      for (let i = start; i < end; i++) {
        masked[i] = '*';
      }
    }
  }

  return masked.join('');
}

/**
 * Sanitize a lobby title at creation time.
 *
 * Rules:
 *   - Strips control characters (U+0000–U+001F, U+007F).
 *   - Trims leading/trailing whitespace.
 *   - Collapses internal runs of whitespace to a single space.
 *   - Clamps to 40 characters (TITLE_MAX_LENGTH).
 *
 * Does NOT mask profanity — that's `maskProfanity`'s job at render time.
 * Safe to call on the client before sending to the backend, and server-side
 * in the POST /mp/lobbies handler to enforce invariants even against modded clients.
 *
 * @param title - Raw title string from user input.
 * @returns Sanitized title, guaranteed ≤ 40 characters.
 */
export function sanitizeLobbyTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(CONTROL_CHARS, '')      // strip control characters
    .trim()                           // remove leading/trailing whitespace
    .replace(/\s+/g, ' ')            // collapse internal whitespace
    .slice(0, TITLE_MAX_LENGTH);     // clamp to max length
}
