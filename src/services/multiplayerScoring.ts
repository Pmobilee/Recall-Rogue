/**
 * Multiplayer race scoring — pure computation, no side effects.
 *
 * Formula from AR-86 (v1 — damage term deferred until turnManager wiring):
 *   score = (floor × 100) + (bestCombo × 50) + (correct × 10)
 *         − (wrong × 5) + (perfectEncounters × 200) + (totalDamage × 1)
 *
 * The totalDamageDealt term has weight 1 (negligible vs floor×100) so scoring
 * is meaningful even before turnManager damage tracking is wired.
 */

/**
 * Compute the race score for the current run state.
 *
 * Uses a structural type rather than importing RunState directly — this avoids
 * import coupling and keeps the function testable in isolation.
 */
export function computeRaceScore(run: {
  floor: { currentFloor: number };
  bestCombo: number;
  factsCorrect: number;
  factsAnswered: number;
  perfectEncountersCount?: number;
  totalDamageDealt?: number;
}): number {
  const floorScore = run.floor.currentFloor * 100;
  const comboScore = run.bestCombo * 50;
  const correctScore = run.factsCorrect * 10;
  const wrongAnswers = run.factsAnswered - run.factsCorrect;
  const wrongPenalty = wrongAnswers * 5;
  const perfectBonus = (run.perfectEncountersCount ?? 0) * 200;
  const damageScore = (run.totalDamageDealt ?? 0) * 1;

  return floorScore + comboScore + correctScore - wrongPenalty + perfectBonus + damageScore;
}
