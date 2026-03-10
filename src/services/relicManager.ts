import type { CardType } from '../data/card-types';
import { DORMANCY_THRESHOLD, MAX_ACTIVE_RELICS } from '../data/balance';
import type { ReviewState } from '../data/types';
import {
  PASSIVE_RELIC_DEFINITIONS,
  PASSIVE_RELIC_BY_ID,
  type ActiveRelic,
  type PassiveRelicDefinition,
} from '../data/passiveRelics';
import { getCardTier } from './tierDerivation';

export function assignRelicOnGraduation(
  cardType: CardType,
  existingRelics: ActiveRelic[],
): PassiveRelicDefinition | null {
  const filtered = PASSIVE_RELIC_DEFINITIONS.filter((relic) => relic.graduationType.includes(cardType));
  const eligible = filtered.filter((relic) => {
    const count = existingRelics.filter((active) => active.definition.id === relic.id).length;
    return count < relic.maxPerRun;
  });
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function buildActiveRelics(
  reviewStates: ReviewState[],
  resolveCardTypeForFact: (factId: string) => CardType | null,
  options?: { maxActiveRelics?: number },
): ActiveRelic[] {
  const built: ActiveRelic[] = [];

  for (const state of reviewStates) {
    const tier = getCardTier({
      stability: state.stability ?? state.interval ?? 0,
      consecutiveCorrect: state.consecutiveCorrect ?? state.repetitions ?? 0,
      passedMasteryTrial: state.passedMasteryTrial ?? false,
    });
    if (tier !== '3') continue;

    const cardType = resolveCardTypeForFact(state.factId);
    if (!cardType) continue;

    const forced = state.graduatedRelicId ? PASSIVE_RELIC_BY_ID[state.graduatedRelicId] : undefined;
    const definition = forced ?? assignRelicOnGraduation(cardType, built);
    if (!definition) continue;

    built.push({
      definition,
      sourceFactId: state.factId,
      isDormant: (state.retrievability ?? 1) < DORMANCY_THRESHOLD,
      activatedThisEncounter: false,
      masteredAt: state.masteredAt ?? 0,
    });
  }

  const maxRelics = Math.max(1, Math.floor(options?.maxActiveRelics ?? MAX_ACTIVE_RELICS));
  return built
    .sort((a, b) => b.masteredAt - a.masteredAt)
    .slice(0, maxRelics);
}

export function checkRelicDormancy(
  relics: ActiveRelic[],
  factStates: Map<string, { retrievability: number }>,
): void {
  for (const relic of relics) {
    const fact = factStates.get(relic.sourceFactId);
    if (!fact) continue;
    relic.isDormant = fact.retrievability < DORMANCY_THRESHOLD;
  }
}

export function getActiveRelicIds(relics: ActiveRelic[]): Set<string> {
  return new Set(relics.filter((relic) => !relic.isDormant).map((relic) => relic.definition.id));
}
