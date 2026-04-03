/**
 * narrativeGravity.test.ts — Unit tests for answer type classification
 * and gravity scoring in the Woven Narrative Architecture.
 *
 * Design spec: docs/mechanics/narrative.md §Thread 2 "The Echo Chamber"
 */

import { describe, it, expect } from 'vitest';
import {
  classifyAnswerType,
  scoreGravity,
  extractForeignWord,
  buildEchoText,
  isHistoricalYear,
  hasNonLatinChars,
} from './narrativeGravity';
import type { AnswerType, GravityLevel } from './narrativeTypes';

// ============================================================
// hasNonLatinChars
// ============================================================

describe('hasNonLatinChars', () => {
  it('returns false for pure ASCII', () => {
    expect(hasNonLatinChars('Napoleon')).toBe(false);
    expect(hasNonLatinChars('democracy')).toBe(false);
    expect(hasNonLatinChars('TCP/IP')).toBe(false);
    expect(hasNonLatinChars('1945')).toBe(false);
  });

  it('returns true for CJK characters', () => {
    expect(hasNonLatinChars('食べる')).toBe(true);
    expect(hasNonLatinChars('汚い')).toBe(true);
    expect(hasNonLatinChars('北京')).toBe(true);
  });

  it('returns true for Hiragana', () => {
    expect(hasNonLatinChars('たべる')).toBe(true);
  });

  it('returns true for Katakana', () => {
    expect(hasNonLatinChars('コーヒー')).toBe(true);
  });

  it('returns true for Cyrillic', () => {
    expect(hasNonLatinChars('привет')).toBe(true);
  });

  it('returns true for Arabic', () => {
    expect(hasNonLatinChars('مرحبا')).toBe(true);
  });

  it('returns true for Devanagari', () => {
    expect(hasNonLatinChars('नमस्ते')).toBe(true);
  });

  it('returns true for Korean Hangul', () => {
    expect(hasNonLatinChars('안녕하세요')).toBe(true);
  });
});

// ============================================================
// isHistoricalYear
// ============================================================

describe('isHistoricalYear', () => {
  it('returns true for 4-digit years in range 1000-2100', () => {
    expect(isHistoricalYear('1945')).toBe(true);
    expect(isHistoricalYear('1000')).toBe(true);
    expect(isHistoricalYear('2100')).toBe(true);
    expect(isHistoricalYear('2025')).toBe(true);
  });

  it('returns false for years outside the 1000-2100 range', () => {
    expect(isHistoricalYear('999')).toBe(false);
    expect(isHistoricalYear('3000')).toBe(false);
    expect(isHistoricalYear('500')).toBe(false);
  });

  it('returns false for short numbers without era suffix', () => {
    expect(isHistoricalYear('776')).toBe(false);
    expect(isHistoricalYear('42')).toBe(false);
    expect(isHistoricalYear('99')).toBe(false);
  });

  it('returns true for years with BCE suffix', () => {
    expect(isHistoricalYear('776 BCE')).toBe(true);
    expect(isHistoricalYear('44 BCE')).toBe(true);
    expect(isHistoricalYear('500 BCE')).toBe(true);
  });

  it('returns true for years with BC suffix', () => {
    expect(isHistoricalYear('44 BC')).toBe(true);
    expect(isHistoricalYear('100 BC')).toBe(true);
  });

  it('returns true for years with AD suffix', () => {
    expect(isHistoricalYear('476 AD')).toBe(true);
    expect(isHistoricalYear('1066 AD')).toBe(true);
  });

  it('returns true for years with CE suffix', () => {
    expect(isHistoricalYear('100 CE')).toBe(true);
  });

  it('handles case-insensitive era suffixes', () => {
    expect(isHistoricalYear('776 bce')).toBe(true);
    expect(isHistoricalYear('44 ad')).toBe(true);
  });

  it('returns false for plain two-digit numbers', () => {
    expect(isHistoricalYear('42')).toBe(false);
  });

  it('returns false for non-numeric strings', () => {
    expect(isHistoricalYear('Napoleon')).toBe(false);
    expect(isHistoricalYear('democracy')).toBe(false);
  });
});

// ============================================================
// extractForeignWord
// ============================================================

describe('extractForeignWord', () => {
  it('extracts a Spanish word from standard pattern', () => {
    expect(extractForeignWord('What does "abandonar" mean?')).toBe('abandonar');
  });

  it('extracts a Spanish word with accent', () => {
    expect(extractForeignWord('What does "adiós" mean?')).toBe('adiós');
  });

  it('extracts a CJK word without furigana', () => {
    expect(extractForeignWord('What does "汚い" mean?')).toBe('汚い');
  });

  it('extracts a CJK word and ignores furigana in parens', () => {
    expect(extractForeignWord('What does "汚い" (きたない) mean?')).toBe('汚い');
  });

  it('extracts a CJK word with furigana — hiragana reading', () => {
    expect(extractForeignWord('What does "食べる" (たべる) mean?')).toBe('食べる');
  });

  it('returns null for knowledge questions', () => {
    expect(extractForeignWord('Who invented Quicksort?')).toBeNull();
    expect(extractForeignWord('What year did WWII end?')).toBeNull();
    expect(extractForeignWord('Which planet is closest to the Sun?')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractForeignWord('')).toBeNull();
  });
});

// ============================================================
// buildEchoText
// ============================================================

describe('buildEchoText', () => {
  it('returns correctAnswer directly for knowledge facts (no partOfSpeech)', () => {
    expect(buildEchoText('Napoleon', 'Who led France during Waterloo?')).toBe('Napoleon');
    expect(buildEchoText('democracy', 'What is rule by the people called?')).toBe('democracy');
    expect(buildEchoText('1945', 'When did WWII end?')).toBe('1945');
  });

  it('returns extracted foreign word for vocab facts with partOfSpeech', () => {
    const result = buildEchoText('to abandon', 'What does "abandonar" mean?', 'verb');
    expect(result).toBe('abandonar');
  });

  it('returns extracted CJK word for Japanese vocab', () => {
    const result = buildEchoText('to eat', 'What does "食べる" (たべる) mean?', 'verb');
    expect(result).toBe('食べる');
  });

  it('falls back to correctAnswer when extraction fails for vocab fact', () => {
    // Question doesn't match the expected pattern
    const result = buildEchoText('to run', 'Translate: correr (Spanish)', 'verb');
    expect(result).toBe('to run');
  });

  it('returns correctAnswer for knowledge fact regardless of question format', () => {
    const result = buildEchoText('Rome', 'What was the capital of the Roman Empire?', undefined);
    expect(result).toBe('Rome');
  });
});

// ============================================================
// classifyAnswerType — Answer Type Classification
// ============================================================

describe('classifyAnswerType', () => {
  describe('foreign_word', () => {
    it('classifies any fact with partOfSpeech as foreign_word', () => {
      expect(classifyAnswerType('to abandon', 'What does "abandonar" mean?', 'verb')).toBe<AnswerType>('foreign_word');
      expect(classifyAnswerType('cat', 'What does "Katze" mean?', 'noun')).toBe<AnswerType>('foreign_word');
    });

    it('classifies answers with CJK characters as foreign_word', () => {
      expect(classifyAnswerType('食べる', 'What does this character mean?')).toBe<AnswerType>('foreign_word');
      expect(classifyAnswerType('汚い', 'Translate this word')).toBe<AnswerType>('foreign_word');
    });

    it('classifies answers with Cyrillic as foreign_word', () => {
      expect(classifyAnswerType('привет', 'How do you say hello in Russian?')).toBe<AnswerType>('foreign_word');
    });
  });

  describe('date', () => {
    it('classifies 4-digit years (1000-2100) as date', () => {
      expect(classifyAnswerType('1945', 'When did WWII end?')).toBe<AnswerType>('date');
      expect(classifyAnswerType('1066', 'When was the Battle of Hastings?')).toBe<AnswerType>('date');
    });

    it('classifies years with era suffixes as date', () => {
      expect(classifyAnswerType('776 BCE', 'When were the first Olympics?')).toBe<AnswerType>('date');
      expect(classifyAnswerType('476 AD', 'When did the Western Roman Empire fall?')).toBe<AnswerType>('date');
    });
  });

  describe('number', () => {
    it('classifies pure numeric answers as number', () => {
      expect(classifyAnswerType('42', 'How many bones in the human wrist?')).toBe<AnswerType>('number');
      expect(classifyAnswerType('206', 'How many bones in the adult human body?')).toBe<AnswerType>('number');
      expect(classifyAnswerType('3.14', 'What is pi approximately?')).toBe<AnswerType>('number');
    });

    it('classifies True/False as number (low gravity)', () => {
      expect(classifyAnswerType('True', 'Is DNA double-stranded?')).toBe<AnswerType>('number');
      expect(classifyAnswerType('False', 'Was Einstein born in France?')).toBe<AnswerType>('number');
    });

    it('classifies Yes/No as number (low gravity)', () => {
      expect(classifyAnswerType('Yes', 'Did the Romans use concrete?')).toBe<AnswerType>('number');
      expect(classifyAnswerType('No', 'Is mercury solid at room temperature?')).toBe<AnswerType>('number');
    });
  });

  describe('person', () => {
    it('classifies two-word proper names as person', () => {
      expect(classifyAnswerType('Ada Lovelace', 'Who wrote the first algorithm?')).toBe<AnswerType>('person');
      expect(classifyAnswerType('Napoleon Bonaparte', 'Who led France at Waterloo?')).toBe<AnswerType>('person');
    });

    it('classifies three-word proper names as person', () => {
      expect(classifyAnswerType('Julius Caesar', 'Who crossed the Rubicon?')).toBe<AnswerType>('person');
    });
  });

  describe('place', () => {
    it('classifies single-word capitalised place names as place', () => {
      expect(classifyAnswerType('Rome', 'What was the capital of the Roman Empire?')).toBe<AnswerType>('place');
    });

    it('classifies "The X" names as place', () => {
      expect(classifyAnswerType('The Colosseum', 'What is the famous Roman amphitheatre?')).toBe<AnswerType>('place');
    });
  });

  describe('concept', () => {
    it('classifies multi-word lowercase answers as concept', () => {
      expect(classifyAnswerType('democracy', 'What is rule by the people called?')).toBe<AnswerType>('concept');
      expect(classifyAnswerType('photosynthesis', 'How do plants make energy from sunlight?')).toBe<AnswerType>('concept');
    });
  });

  describe('object', () => {
    it('classifies technical/concrete nouns as object', () => {
      expect(classifyAnswerType('mitochondria', 'What is the powerhouse of the cell?')).toBe<AnswerType>('object');
      expect(classifyAnswerType('TCP/IP', 'What protocol suite underlies the internet?')).toBe<AnswerType>('object');
    });
  });
});

// ============================================================
// scoreGravity — Gravity Scoring
// ============================================================

describe('scoreGravity', () => {
  describe('foreign_word always high', () => {
    it('foreign_word is always high gravity regardless of domain or length', () => {
      expect(scoreGravity('foreign_word', 'language', 6)).toBe<GravityLevel>('high');
      expect(scoreGravity('foreign_word', 'history', 3)).toBe<GravityLevel>('high');
      // Short foreign words still high — the type override applies BEFORE length check
      // Note: MIN_ECHO_LENGTH applies for all types but foreign_word takes precedence
    });

    it('foreign_word with length >= 4 is high', () => {
      expect(scoreGravity('foreign_word', 'language', 5)).toBe<GravityLevel>('high');
    });
  });

  describe('place always high', () => {
    it('place type is always high gravity', () => {
      expect(scoreGravity('place', 'history', 5)).toBe<GravityLevel>('high');
      expect(scoreGravity('place', 'geography', 8)).toBe<GravityLevel>('high');
      expect(scoreGravity('place', 'computing', 4)).toBe<GravityLevel>('high');
    });
  });

  describe('person — domain-dependent', () => {
    it('person in history domain is high gravity', () => {
      expect(scoreGravity('person', 'history', 10)).toBe<GravityLevel>('high');
    });

    it('person in history_ancient domain is high gravity', () => {
      expect(scoreGravity('person', 'history_ancient', 12)).toBe<GravityLevel>('high');
    });

    it('person in mythology domain is high gravity', () => {
      expect(scoreGravity('person', 'mythology', 10)).toBe<GravityLevel>('high');
    });

    it('person in philosophy domain is high gravity', () => {
      expect(scoreGravity('person', 'philosophy', 10)).toBe<GravityLevel>('high');
    });

    it('person in computing domain is medium gravity', () => {
      expect(scoreGravity('person', 'computing', 12)).toBe<GravityLevel>('medium');
    });

    it('person in science domain is medium gravity', () => {
      expect(scoreGravity('person', 'science', 14)).toBe<GravityLevel>('medium');
    });
  });

  describe('concept — domain and length dependent', () => {
    it('concept in philosophy domain is high gravity', () => {
      expect(scoreGravity('concept', 'philosophy', 12)).toBe<GravityLevel>('high');
    });

    it('concept in science domain is high gravity', () => {
      expect(scoreGravity('concept', 'science', 12)).toBe<GravityLevel>('high');
    });

    it('concept in science_biology is high gravity', () => {
      expect(scoreGravity('concept', 'science_biology', 15)).toBe<GravityLevel>('high');
    });

    it('concept in history domain is medium gravity', () => {
      expect(scoreGravity('concept', 'history', 12)).toBe<GravityLevel>('medium');
    });

    it('concept in computing domain is medium gravity', () => {
      expect(scoreGravity('concept', 'computing', 15)).toBe<GravityLevel>('medium');
    });

    it('concept with echoTextLength < 8 is low gravity regardless of domain', () => {
      // "War" (3 chars), "Art" (3 chars), "Water" (5 chars)
      expect(scoreGravity('concept', 'philosophy', 3)).toBe<GravityLevel>('low');
      expect(scoreGravity('concept', 'science', 5)).toBe<GravityLevel>('low');
      expect(scoreGravity('concept', 'history', 7)).toBe<GravityLevel>('low');
    });
  });

  describe('date — always medium', () => {
    it('date type is medium gravity', () => {
      expect(scoreGravity('date', 'history', 4)).toBe<GravityLevel>('medium');
      expect(scoreGravity('date', 'science', 4)).toBe<GravityLevel>('medium');
    });
  });

  describe('number — always low', () => {
    it('number type is always low gravity', () => {
      expect(scoreGravity('number', 'history', 4)).toBe<GravityLevel>('low');
      expect(scoreGravity('number', 'science', 6)).toBe<GravityLevel>('low');
    });
  });

  describe('object — medium gravity', () => {
    it('object type is medium gravity', () => {
      expect(scoreGravity('object', 'science', 12)).toBe<GravityLevel>('medium');
      expect(scoreGravity('object', 'history', 10)).toBe<GravityLevel>('medium');
    });
  });

  describe('MIN_ECHO_LENGTH override', () => {
    it('answers shorter than 4 chars are always low gravity', () => {
      // Place (normally high), but too short
      expect(scoreGravity('place', 'history', 3)).toBe<GravityLevel>('low');
      // Person (normally high in history), but too short
      expect(scoreGravity('person', 'history', 2)).toBe<GravityLevel>('low');
      // Object (normally medium), too short
      expect(scoreGravity('object', 'science', 1)).toBe<GravityLevel>('low');
    });

    it('answers exactly 4 chars long are NOT overridden to low', () => {
      expect(scoreGravity('place', 'history', 4)).toBe<GravityLevel>('high');
    });
  });

  describe('boolean answers via number type', () => {
    it('True/False classified as number → always low gravity', () => {
      // classifyAnswerType('True', ...) → 'number', then scoreGravity gives 'low'
      const type = classifyAnswerType('True', 'Is the earth round?');
      expect(type).toBe<AnswerType>('number');
      expect(scoreGravity(type, 'science', 4)).toBe<GravityLevel>('low');
    });

    it('False classified as number → always low gravity', () => {
      const type = classifyAnswerType('False', 'Was Napoleon short?');
      expect(type).toBe<AnswerType>('number');
      expect(scoreGravity(type, 'history', 5)).toBe<GravityLevel>('low');
    });
  });

  describe('end-to-end: classify then score', () => {
    it('Napoleon → person → history → high', () => {
      const type = classifyAnswerType('Napoleon', 'Who led France at Waterloo?');
      expect(type).toBe<AnswerType>('person');
      // 'Napoleon' has length 8 — above MIN_ECHO_LENGTH
      expect(scoreGravity(type, 'history', 'Napoleon'.length)).toBe<GravityLevel>('high');
    });

    it('Ada Lovelace → person → computing → medium', () => {
      const type = classifyAnswerType('Ada Lovelace', 'Who wrote the first algorithm?');
      expect(type).toBe<AnswerType>('person');
      expect(scoreGravity(type, 'computing', 'Ada Lovelace'.length)).toBe<GravityLevel>('medium');
    });

    it('Rome → place → high', () => {
      const type = classifyAnswerType('Rome', 'What was the capital of the Roman Empire?');
      expect(type).toBe<AnswerType>('place');
      expect(scoreGravity(type, 'history', 'Rome'.length)).toBe<GravityLevel>('high');
    });

    it('1945 → date → medium', () => {
      const type = classifyAnswerType('1945', 'When did WWII end?');
      expect(type).toBe<AnswerType>('date');
      expect(scoreGravity(type, 'history', '1945'.length)).toBe<GravityLevel>('medium');
    });

    it('democracy → concept → history → medium', () => {
      const type = classifyAnswerType('democracy', 'What is rule by the people called?');
      expect(type).toBe<AnswerType>('concept');
      expect(scoreGravity(type, 'history', 'democracy'.length)).toBe<GravityLevel>('medium');
    });

    it('photosynthesis → concept → science_biology → high', () => {
      const type = classifyAnswerType('photosynthesis', 'How do plants make energy from sunlight?');
      expect(type).toBe<AnswerType>('concept');
      expect(scoreGravity(type, 'science_biology', 'photosynthesis'.length)).toBe<GravityLevel>('high');
    });

    it('mitochondria → object → medium', () => {
      const type = classifyAnswerType('mitochondria', 'What is the powerhouse of the cell?');
      expect(type).toBe<AnswerType>('object');
      expect(scoreGravity(type, 'science_biology', 'mitochondria'.length)).toBe<GravityLevel>('medium');
    });

    it('food-taberu vocab → foreign_word → high', () => {
      const type = classifyAnswerType('to eat', 'What does "食べる" (たべる) mean?', 'verb');
      expect(type).toBe<AnswerType>('foreign_word');
      expect(scoreGravity(type, 'language', '食べる'.length)).toBe<GravityLevel>('high');
    });
  });
});
