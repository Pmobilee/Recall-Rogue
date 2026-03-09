import { TIER_QUESTION_FORMAT, MASTERY_TRIAL } from '../data/balance';
import type { CardTier } from '../data/card-types';

export interface QuestionPresentation {
  optionCount: number;
  useReverse: boolean;
  useFillBlank: boolean;
  useCloseDistractors: boolean;
  timerOverride?: number;
  disableSlowReader?: boolean;
}

export function getQuestionPresentation(
  tier: CardTier,
  isMasteryTrial: boolean,
): QuestionPresentation {
  if (isMasteryTrial) {
    return {
      optionCount: MASTERY_TRIAL.ANSWER_OPTIONS,
      useReverse: false,
      useFillBlank: false,
      useCloseDistractors: true,
      timerOverride: MASTERY_TRIAL.TIMER_SECONDS,
      disableSlowReader: true,
    };
  }

  const format = TIER_QUESTION_FORMAT[tier] ?? TIER_QUESTION_FORMAT['1'];
  return {
    optionCount: format.options,
    useReverse: format.allowReverse && Math.random() < 0.3,
    useFillBlank: format.allowFillBlank && Math.random() < 0.2,
    useCloseDistractors: format.useCloseDistractors,
  };
}

