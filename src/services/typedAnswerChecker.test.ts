import { describe, it, expect } from 'vitest'
import { checkTypedAnswer, normalizeAnswer, extractCandidates } from './typedAnswerChecker'

// ---------------------------------------------------------------------------
// normalizeAnswer
// ---------------------------------------------------------------------------

describe('normalizeAnswer', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeAnswer('  hello  ')).toBe('hello')
  })

  it('lowercases the string', () => {
    expect(normalizeAnswer('Hello World')).toBe('hello world')
  })

  it('folds NFD accents (acute)', () => {
    expect(normalizeAnswer('café')).toBe('cafe')
  })

  it('folds NFD accents (grave)', () => {
    expect(normalizeAnswer('naïve')).toBe('naive')
  })

  it('strips trailing period', () => {
    expect(normalizeAnswer('yes.')).toBe('yes')
  })

  it('strips trailing exclamation mark', () => {
    expect(normalizeAnswer('yes!')).toBe('yes')
  })

  it('strips trailing question mark', () => {
    expect(normalizeAnswer('yes?')).toBe('yes')
  })

  it('strips trailing semicolon', () => {
    expect(normalizeAnswer('yes;')).toBe('yes')
  })

  it('strips trailing colon', () => {
    expect(normalizeAnswer('yes:')).toBe('yes')
  })

  it('collapses multiple internal spaces', () => {
    expect(normalizeAnswer('hello   world')).toBe('hello world')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeAnswer('   ')).toBe('')
  })

  it('handles empty string', () => {
    expect(normalizeAnswer('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// extractCandidates
// ---------------------------------------------------------------------------

describe('extractCandidates', () => {
  it('returns the full string as a candidate', () => {
    const candidates = extractCandidates('hello')
    expect(candidates).toContain('hello')
  })

  it('splits slash alternatives', () => {
    const candidates = extractCandidates('grey / gray')
    expect(candidates).toContain('grey')
    expect(candidates).toContain('gray')
  })

  it('splits comma synonyms', () => {
    const candidates = extractCandidates('lawyer, solicitor')
    expect(candidates).toContain('lawyer')
    expect(candidates).toContain('solicitor')
  })

  it('keeps the full comma-joined string as a candidate', () => {
    const candidates = extractCandidates('lawyer, solicitor')
    expect(candidates).toContain('lawyer, solicitor')
  })

  it('strips trailing parenthetical', () => {
    const candidates = extractCandidates('sandwich (bread roll)')
    expect(candidates).toContain('sandwich')
  })

  it('strips leading "to " from verb infinitives', () => {
    const candidates = extractCandidates('to abandon')
    expect(candidates).toContain('abandon')
  })

  it('returns no duplicates', () => {
    const candidates = extractCandidates('hello')
    const unique = new Set(candidates)
    expect(unique.size).toBe(candidates.length)
  })

  it('normalizes all candidates', () => {
    // accented character should be folded
    const candidates = extractCandidates('café')
    expect(candidates).toContain('cafe')
    expect(candidates).not.toContain('café')
  })
})

// ---------------------------------------------------------------------------
// checkTypedAnswer — basic matching
// ---------------------------------------------------------------------------

describe('checkTypedAnswer — basic matching', () => {
  function isCorrect(typed: string, answer: string, alts: string[] = [], lang = ''): boolean {
    return checkTypedAnswer(typed, answer, alts, lang).correct
  }

  it('exact match returns true', () => {
    expect(isCorrect('hello', 'hello')).toBe(true)
  })

  it('wrong answer returns false', () => {
    expect(isCorrect('cat', 'dog')).toBe(false)
  })

  it('empty typed input returns false', () => {
    expect(isCorrect('', 'hello')).toBe(false)
  })

  it('whitespace-only typed input returns false', () => {
    expect(isCorrect('   ', 'hello')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// checkTypedAnswer — normalization
// ---------------------------------------------------------------------------

describe('checkTypedAnswer — normalization', () => {
  function isCorrect(typed: string, answer: string, alts: string[] = [], lang = ''): boolean {
    return checkTypedAnswer(typed, answer, alts, lang).correct
  }

  it('case insensitive match', () => {
    expect(isCorrect('Hello', 'hello')).toBe(true)
  })

  it('typed all-caps matches lowercase answer', () => {
    expect(isCorrect('HELLO', 'hello')).toBe(true)
  })

  it('whitespace trimming in typed input', () => {
    expect(isCorrect('  hello  ', 'hello')).toBe(true)
  })

  it('accent folding: typed without accent matches accented answer', () => {
    expect(isCorrect('cafe', 'café')).toBe(true)
  })

  it('accent folding: typed with accent matches non-accented answer', () => {
    expect(isCorrect('café', 'cafe')).toBe(true)
  })

  it('trailing punctuation in answer is ignored', () => {
    expect(isCorrect('yes', 'yes.')).toBe(true)
  })

  it('trailing punctuation in typed input is ignored', () => {
    expect(isCorrect('yes.', 'yes')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkTypedAnswer — slash alternatives
// ---------------------------------------------------------------------------

describe('checkTypedAnswer — slash alternatives', () => {
  function isCorrect(typed: string, answer: string, alts: string[] = [], lang = ''): boolean {
    return checkTypedAnswer(typed, answer, alts, lang).correct
  }

  it('matches first slash alternative', () => {
    expect(isCorrect('grey', 'grey / gray')).toBe(true)
  })

  it('matches second slash alternative', () => {
    expect(isCorrect('gray', 'grey / gray')).toBe(true)
  })

  it('combined: slash + case insensitive', () => {
    expect(isCorrect('GRAY', 'grey / gray')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkTypedAnswer — comma synonyms
// ---------------------------------------------------------------------------

describe('checkTypedAnswer — comma synonyms', () => {
  function isCorrect(typed: string, answer: string, alts: string[] = [], lang = ''): boolean {
    return checkTypedAnswer(typed, answer, alts, lang).correct
  }

  it('matches first comma segment', () => {
    expect(isCorrect('lawyer', 'lawyer, solicitor')).toBe(true)
  })

  it('matches second comma segment', () => {
    expect(isCorrect('solicitor', 'lawyer, solicitor')).toBe(true)
  })

  it('matches the full unsplit comma string', () => {
    expect(isCorrect('lawyer, solicitor', 'lawyer, solicitor')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkTypedAnswer — "to " infinitive handling
// ---------------------------------------------------------------------------

describe('checkTypedAnswer — infinitive "to" prefix', () => {
  function isCorrect(typed: string, answer: string, alts: string[] = [], lang = ''): boolean {
    return checkTypedAnswer(typed, answer, alts, lang).correct
  }

  it('typed bare verb matches "to X" answer', () => {
    expect(isCorrect('abandon', 'to abandon')).toBe(true)
  })

  it('typed "to X" matches "to X" answer (exact)', () => {
    expect(isCorrect('to abandon', 'to abandon')).toBe(true)
  })

  it('typed "to X" matches bare-verb answer', () => {
    expect(isCorrect('to eat', 'eat')).toBe(true)
  })

  it('typed bare verb matches "to X" answer (eat)', () => {
    expect(isCorrect('eat', 'to eat')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkTypedAnswer — parenthetical removal
// ---------------------------------------------------------------------------

describe('checkTypedAnswer — parenthetical removal', () => {
  function isCorrect(typed: string, answer: string, alts: string[] = [], lang = ''): boolean {
    return checkTypedAnswer(typed, answer, alts, lang).correct
  }

  it('typed without parenthetical matches answer with trailing parenthetical', () => {
    expect(isCorrect('sandwich', 'sandwich (bread roll)')).toBe(true)
  })

  it('typed with the full parenthetical also matches', () => {
    expect(isCorrect('sandwich (bread roll)', 'sandwich (bread roll)')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkTypedAnswer — acceptable alternatives
// ---------------------------------------------------------------------------

describe('checkTypedAnswer — acceptableAlternatives', () => {
  function isCorrect(typed: string, answer: string, alts: string[] = [], lang = ''): boolean {
    return checkTypedAnswer(typed, answer, alts, lang).correct
  }

  it('matches an acceptable alternative', () => {
    expect(isCorrect('Kleisthenes', 'Cleisthenes', ['Kleisthenes'])).toBe(true)
  })

  it('does not match a non-provided alternative', () => {
    expect(isCorrect('Kleisthenes', 'Cleisthenes')).toBe(false)
  })

  it('case-insensitive match against alternative', () => {
    expect(isCorrect('kleisthenes', 'Cleisthenes', ['Kleisthenes'])).toBe(true)
  })

  it('accent-folded match against alternative', () => {
    expect(isCorrect('resume', 'CV', ['résumé'])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkTypedAnswer — combined scenarios
// ---------------------------------------------------------------------------

describe('checkTypedAnswer — combined scenarios', () => {
  function isCorrect(typed: string, answer: string, alts: string[] = [], lang = ''): boolean {
    return checkTypedAnswer(typed, answer, alts, lang).correct
  }

  it('comma segments combined with "to" prefix: "swim" matches "to swim, to bathe"', () => {
    expect(isCorrect('swim', 'to swim, to bathe')).toBe(true)
  })

  it('comma segments combined with "to" prefix: "bathe" matches "to swim, to bathe"', () => {
    expect(isCorrect('bathe', 'to swim, to bathe')).toBe(true)
  })

  it('slash + case insensitive: "GRAY" matches "grey / gray"', () => {
    expect(isCorrect('GRAY', 'grey / gray')).toBe(true)
  })

  it('accent fold + trailing punctuation: "naive." matches "naïve"', () => {
    expect(isCorrect('naive.', 'naïve')).toBe(true)
  })

  it('parenthetical + case: "SANDWICH" matches "sandwich (bread roll)"', () => {
    expect(isCorrect('SANDWICH', 'sandwich (bread roll)')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkTypedAnswer — synonym matching
// ---------------------------------------------------------------------------

describe('synonym matching', () => {
  it('accepts a WordNet synonym of the correct answer', () => {
    const result = checkTypedAnswer('glad', 'happy', [], '')
    expect(result.correct).toBe(true)
    expect(result.synonymMatch).toBe(true)
  })

  it('synonym matching is bidirectional', () => {
    const result = checkTypedAnswer('happy', 'glad', [], '')
    expect(result.correct).toBe(true)
    expect(result.synonymMatch).toBe(true)
  })

  it('does not use synonyms for multi-word typed answers', () => {
    const result = checkTypedAnswer('very happy', 'glad', [], '')
    expect(result.correct).toBe(false)
    expect(result.synonymMatch).toBe(false)
  })

  it('does not false-positive on unrelated words', () => {
    const result = checkTypedAnswer('cat', 'happy', [], '')
    expect(result.correct).toBe(false)
    expect(result.synonymMatch).toBe(false)
  })

  it('synonyms work with comma-separated answers', () => {
    const result = checkTypedAnswer('glad', 'happy, joyful', [], '')
    expect(result.correct).toBe(true)
    expect(result.synonymMatch).toBe(true)
  })

  it('direct match takes priority over synonym match', () => {
    const result = checkTypedAnswer('happy', 'happy', [], '')
    expect(result.correct).toBe(true)
    expect(result.synonymMatch).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// checkTypedAnswer — close match detection
// ---------------------------------------------------------------------------

describe('close match detection', () => {
  it('detects a typo within 1 edit distance', () => {
    const result = checkTypedAnswer('helo', 'hello', [], '')
    expect(result.correct).toBe(false)
    expect(result.closeMatch).toBe(true)
  })

  it('detects a typo within 2 edit distance', () => {
    const result = checkTypedAnswer('abandn', 'abandon', [], '')
    expect(result.correct).toBe(false)
    expect(result.closeMatch).toBe(true)
  })

  it('does not flag distant answers as close match', () => {
    const result = checkTypedAnswer('xyz', 'hello', [], '')
    expect(result.correct).toBe(false)
    expect(result.closeMatch).toBe(false)
  })

  it('respects the 30% length threshold for short words', () => {
    const result = checkTypedAnswer('cat', 'dog', [], '')
    expect(result.correct).toBe(false)
    expect(result.closeMatch).toBe(false)
  })

  it('detects close match against comma-separated candidates', () => {
    const result = checkTypedAnswer('lawyar', 'lawyer, solicitor', [], '')
    expect(result.correct).toBe(false)
    expect(result.closeMatch).toBe(true)
  })

  it('close match is case-insensitive', () => {
    const result = checkTypedAnswer('Helo', 'hello', [], '')
    expect(result.correct).toBe(false)
    expect(result.closeMatch).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkTypedAnswer — synonym blocklist
// ---------------------------------------------------------------------------

describe('synonym blocklist', () => {
  it('blocks run/test false positive', () => {
    const result = checkTypedAnswer('test', 'run', [], '')
    expect(result.correct).toBe(false)
    expect(result.synonymMatch).toBe(false)
  })

  it('blocks in both directions', () => {
    const result = checkTypedAnswer('run', 'test', [], '')
    expect(result.correct).toBe(false)
    expect(result.synonymMatch).toBe(false)
  })

  it('blocks close/finish', () => {
    const result = checkTypedAnswer('finish', 'close', [], '')
    expect(result.correct).toBe(false)
  })

  it('blocks bear/have', () => {
    const result = checkTypedAnswer('have', 'bear', [], '')
    expect(result.correct).toBe(false)
  })

  it('still allows non-blocked synonyms', () => {
    // glad/happy should still work (not in blocklist)
    const result = checkTypedAnswer('glad', 'happy', [], '')
    expect(result.correct).toBe(true)
    expect(result.synonymMatch).toBe(true)
  })
})
