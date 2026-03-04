/**
 * LLM prompt templates for the Terra Gacha fact content engine.
 * Centralises all prompt construction so prompts can be versioned
 * and tested independently of the generation logic.
 */

/** Minimal fact fields needed to build a generation prompt. */
export interface FactPromptInput {
  /** The core fact statement to generate content for. */
  statement: string;
  /** Top-level category (e.g. "Natural Sciences"). */
  categoryL1?: string;
  /** Sub-category (e.g. "Physics"). */
  categoryL2?: string;
}

/**
 * Build the full generation prompt for fact content.
 * The prompt instructs Claude to generate quiz content, GAIA comments,
 * distractors, and metadata for a given fact statement.
 *
 * @param fact - Minimal fact fields needed for the prompt.
 * @returns A fully formatted prompt string ready for the Claude API.
 */
export function buildFactGenerationPrompt(fact: FactPromptInput): string {
  const categoryContext =
    fact.categoryL1
      ? `Category: ${fact.categoryL1}${fact.categoryL2 ? ` > ${fact.categoryL2}` : ""}`
      : "Category: Unknown";

  return `You are a content editor for Terra Gacha, an educational mobile game where players mine underground and learn facts through spaced repetition quizzes.

${categoryContext}
Fact statement: "${fact.statement}"

Generate ALL of the following content for this fact in one JSON response. Return ONLY valid JSON.

Required output shape:
{
  "wowFactor": "<1-2 sentences: what makes this fact surprising or amazing>",
  "explanation": "<2-4 sentences: deeper scientific/historical context>",
  "alternateExplanations": [
    "<simpler explanation for younger players>",
    "<more technical explanation for advanced players>"
  ],
  "quizQuestion": "<a clear question that can be answered with correct_answer>",
  "correctAnswer": "<the concise correct answer, 1-10 words>",
  "acceptableAnswers": ["<alternate phrasings of the correct answer>"],
  "gaiaComments": [
    {"variant": "enthusiastic", "text": "<GAIA AI enthusiastically introduces the fact, 1-2 sentences>"},
    {"variant": "snarky", "text": "<GAIA with dry wit, 1-2 sentences>"},
    {"variant": "curious", "text": "<GAIA wondering about implications, 1-2 sentences>"},
    {"variant": "calm", "text": "<GAIA matter-of-fact delivery, 1-2 sentences>"}
  ],
  "gaiaWrongComments": {
    "snarky": "<GAIA's snarky comment when player gets it wrong, 1 sentence>",
    "enthusiastic": "<GAIA's encouraging comment when player gets it wrong, 1 sentence>",
    "calm": "<GAIA's neutral comment when player gets it wrong, 1 sentence>"
  },
  "mnemonic": "<a memorable rhyme, acronym, or visual association to remember this fact>",
  "imagePrompt": "<detailed ComfyUI/Stable Diffusion prompt for pixel art image representing this fact>",
  "visualDescription": "<brief alt-text description of what the image should show>",
  "funScore": <integer 1-10: how fun/entertaining is this fact>,
  "noveltyScore": <integer 1-10: how surprising/unexpected is this fact>,
  "difficulty": <integer 1-5: quiz difficulty (1=easy general knowledge, 5=expert)>,
  "ageRating": "<'child' | 'teen' | 'adult' — appropriate minimum age>",
  "sensitivityLevel": <integer 0-3: 0=no issues, 1=mild, 2=moderate, 3=review required>,
  "sensitivityNote": "<null or brief note if sensitivityLevel > 0>",
  "distractors": [
    {"text": "<wrong answer 1>", "difficultyTier": "easy"},
    {"text": "<wrong answer 2>", "difficultyTier": "easy"},
    {"text": "<wrong answer 3>", "difficultyTier": "easy"},
    {"text": "<wrong answer 4>", "difficultyTier": "easy"},
    {"text": "<wrong answer 5>", "difficultyTier": "medium"},
    {"text": "<wrong answer 6>", "difficultyTier": "medium"},
    {"text": "<wrong answer 7>", "difficultyTier": "medium"},
    {"text": "<wrong answer 8>", "difficultyTier": "medium"},
    {"text": "<wrong answer 9>", "difficultyTier": "medium"},
    {"text": "<wrong answer 10>", "difficultyTier": "hard"},
    {"text": "<wrong answer 11>", "difficultyTier": "hard"},
    {"text": "<wrong answer 12>", "difficultyTier": "hard"}
  ]
}

## Distractor Rules:
- Minimum 12 distractors: 4 easy, 5 medium, 4+ hard (you may add more)
- easy: obviously wrong but plausible on first glance
- medium: plausible wrong answer that requires knowledge to eliminate
- hard: very plausible, requires precise knowledge to distinguish from correct answer
- NEVER include the correct answer or acceptable answers in the distractor list
- Distractors should be the same type as the correct answer (e.g., if correct is a number, distractors are numbers)

## GAIA Personality Notes:
- GAIA is an AI companion aboard the player's crashed ship
- She has a complex personality: curious, sometimes snarky, always knowledgeable
- Comments should feel like a real personality, not generic educational text
- Reference the mining/exploration theme when possible

## Image Prompt Rules:
- Style: pixel art, 32x32 sprite style, transparent background
- Focus: single clear subject that represents the fact
- No text in the image
- Good for: concrete objects, animals, geological features, historical artifacts
- Avoid: abstract concepts, people's faces, copyrighted characters

Return ONLY the JSON object, no markdown fences, no preamble.`;
}

/** Input for the 3rd-stage quality gate prompt. */
export interface QualityGateInput {
  statement: string;
  quizQuestion: string;
  correctAnswer: string;
  explanation: string;
  mnemonic: string;
  ageRating: string;
  distractors: Array<{ text: string; tier: string }>;
}

/**
 * Build the 3rd-stage quality gate prompt.
 * Uses a cheaper model (claude-haiku) for cost efficiency.
 *
 * @param input - Fact fields to evaluate.
 * @returns A formatted prompt string for the quality gate.
 */
export function buildQualityGatePrompt(input: QualityGateInput): string {
  const distractorList = input.distractors
    .map((d, i) => `  [${i}] (${d.tier}) ${d.text}`)
    .join("\n");

  return `You are a quality reviewer for an educational quiz game targeting ages 10+.

Evaluate the following fact entry:

STATEMENT: "${input.statement}"
QUIZ QUESTION: "${input.quizQuestion}"
CORRECT ANSWER: "${input.correctAnswer}"
EXPLANATION: "${input.explanation}"
MNEMONIC: "${input.mnemonic}"
AGE RATING: ${input.ageRating}

DISTRACTORS:
${distractorList}

Score each of the following checks as PASS or FAIL, with a brief reason on failure:

1. FACTUAL_PLAUSIBILITY: Is the statement plausible for a real-world fact? (You are not expected to verify — flag obvious inventions or impossible claims.)
2. DISTRACTOR_ADEQUACY: Are there at least 3 distractors with confidence > 0.7? Do distractors span all three tiers (easy/medium/hard)?
3. READABILITY: Is the quiz question grammatically correct and unambiguous for the stated age rating?
4. ANSWER_CLARITY: Is the correct answer a clean, unambiguous response to the quiz question?
5. NO_OVERLAP: Does the correct answer appear (verbatim or near-verbatim) in any distractor?

Return ONLY a JSON object:
{
  "checks": {
    "factual_plausibility": { "result": "PASS" | "FAIL", "reason": "<null or brief reason>" },
    "distractor_adequacy":  { "result": "PASS" | "FAIL", "reason": "<null or brief reason>" },
    "readability":          { "result": "PASS" | "FAIL", "reason": "<null or brief reason>" },
    "answer_clarity":       { "result": "PASS" | "FAIL", "reason": "<null or brief reason>" },
    "no_overlap":           { "result": "PASS" | "FAIL", "reason": "<null or brief reason>" }
  },
  "overall": "pass" | "fail" | "needs_edit",
  "failure_summary": "<null if overall=pass, otherwise 1-2 sentence summary of what needs fixing>"
}

Return ONLY the JSON, no markdown fences.`;
}

/**
 * Build a validation prompt that scores each proposed distractor for quality.
 * Used in the second-pass validation step of content generation.
 *
 * @param correctAnswer - The correct quiz answer.
 * @param distractors   - Array of proposed distractor texts to validate.
 * @returns A formatted prompt string for distractor validation.
 */
export function buildDistractorValidationPrompt(
  correctAnswer: string,
  distractors: string[]
): string {
  const distractorList = distractors
    .map((d, i) => `[${i}] "${d}"`)
    .join("\n");

  return `You are a quiz quality reviewer for an educational game.

Correct answer: "${correctAnswer}"

Rate each of these proposed wrong answers (distractors) on how good they are as quiz distractors.
Score each 0.0-1.0 where:
- 1.0 = excellent distractor (plausible, not too similar to correct, appropriate difficulty)
- 0.7+ = good distractor (acceptable for the game)
- 0.5-0.7 = mediocre (use with caution)
- < 0.5 = bad distractor (too obvious, too similar to correct, confusing, or wrong type)

Distractors to score:
${distractorList}

Return ONLY a JSON array of confidence scores in the same order as the input:
[<score0>, <score1>, ...]

No explanations, just the array of numbers.`;
}
