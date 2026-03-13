import { describe, expect, it } from 'vitest'
import { baseHeuristicIssues, distractorHeuristicIssues } from '../../scripts/content-pipeline/qa/answer-check-live-db.mjs'

describe('answer-check heuristics', () => {
  it('flags templated vocabulary prompts', () => {
    const issues = baseHeuristicIssues({
      type: 'vocabulary',
      language: 'cs',
      quiz_question: 'What is the Czech word for objective?',
      correct_answer: 'objektivni',
      distractors: JSON.stringify(['nahradit', 'okno', 'stul']),
    })
    expect(issues).toContain('templated vocab prompt')
  })

  it('flags low-context cloze prompts', () => {
    const issues = baseHeuristicIssues({
      type: 'fact',
      language: 'en',
      quiz_question: 'Fill in the blank: ______',
      correct_answer: 'gravity',
      distractors: JSON.stringify(['light', 'mass', 'orbit']),
    })
    expect(issues).toContain('low-context cloze prompt')
  })

  it('flags severe distractor length spread', () => {
    const issues = distractorHeuristicIssues({
      quiz_question: 'What does this concept describe?',
      correct_answer: 'force',
      distractors: JSON.stringify([
        'pull',
        'push',
        'The universal proportionality constant that appears in Newtons law of gravitation',
      ]),
    })
    expect(issues).toContain('severe distractor length spread')
  })
})

