/**
 * Unit tests for profanityService.ts
 *
 * Coverage:
 *   - sanitizeLobbyTitle: trims, collapses whitespace, strips control chars, clamps to 40
 *   - maskProfanity: masks a known bad word
 *   - maskProfanity: handles leet-speak on a known bad word
 *   - maskProfanity: preserves non-banned text unchanged
 *   - maskProfanity: empty string returns empty string
 *   - maskProfanity: handles multiple occurrences in one string
 */

import { describe, it, expect } from 'vitest'
import { maskProfanity, sanitizeLobbyTitle, TITLE_MAX_LENGTH } from './profanityService'

// ── sanitizeLobbyTitle ────────────────────────────────────────────────────────

describe('sanitizeLobbyTitle', () => {
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeLobbyTitle('  hello world  ')).toBe('hello world')
  })

  it('collapses internal whitespace runs to a single space', () => {
    expect(sanitizeLobbyTitle('hello   world')).toBe('hello world')
    expect(sanitizeLobbyTitle('a  b  c')).toBe('a b c')
  })

  it('strips ASCII control characters', () => {
    // \x01 (SOH) and \x1F (unit separator) and \x7F (DEL)
    expect(sanitizeLobbyTitle('hi\x01there\x7F')).toBe('hithere')
    expect(sanitizeLobbyTitle('\x00\x1Flobby\x0B')).toBe('lobby')
  })

  it(`clamps to ${TITLE_MAX_LENGTH} characters`, () => {
    const long = 'a'.repeat(100)
    expect(sanitizeLobbyTitle(long)).toHaveLength(TITLE_MAX_LENGTH)
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeLobbyTitle('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeLobbyTitle('   ')).toBe('')
  })

  it('preserves normal lobby titles unchanged', () => {
    expect(sanitizeLobbyTitle('Casual Warmup')).toBe('Casual Warmup')
    expect(sanitizeLobbyTitle('My Study Room')).toBe('My Study Room')
  })
})

// ── maskProfanity ─────────────────────────────────────────────────────────────

describe('maskProfanity', () => {
  it('returns empty string for empty input', () => {
    expect(maskProfanity('')).toBe('')
  })

  it('preserves non-banned text unchanged', () => {
    expect(maskProfanity('Nice game!')).toBe('Nice game!')
    expect(maskProfanity('Casual Warmup')).toBe('Casual Warmup')
    expect(maskProfanity('Study Room 2')).toBe('Study Room 2')
    // Word that contains a banned word as a substring — should NOT be masked
    // "assassin" contains "ass" but "ass" alone isn't in our list at word boundary
    expect(maskProfanity('assassin')).toBe('assassin')
  })

  it('masks a known bad word with asterisks of the same length', () => {
    const result = maskProfanity('hello bitch world')
    expect(result).toBe('hello ***** world')
    expect(result).toHaveLength('hello bitch world'.length)
  })

  it('masks a bad word with leet-speak substitutions', () => {
    // b1tch → normalized to bitch → masked
    const result = maskProfanity('hello b1tch world')
    expect(result).toBe('hello ***** world')
  })

  it('masks another leet variant (@)', () => {
    // @sshole → normalized to asshole → masked
    const result = maskProfanity('you @sshole')
    expect(result).toBe('you *******')
  })

  it('handles multiple occurrences of the same banned word', () => {
    const result = maskProfanity('bitch is a bitch')
    expect(result).toBe('***** is a *****')
  })

  it('handles a banned word in a sentence with punctuation', () => {
    const result = maskProfanity('What a cunt!')
    expect(result).toBe('What a ****!')
  })

  it('is case-insensitive when matching', () => {
    expect(maskProfanity('BITCH')).toBe('*****')
    expect(maskProfanity('Bitch')).toBe('*****')
    expect(maskProfanity('BiTcH')).toBe('*****')
  })

  it('preserves text length after masking', () => {
    const original = 'Call me a bitch if you must'
    const masked = maskProfanity(original)
    expect(masked).toHaveLength(original.length)
  })
})
