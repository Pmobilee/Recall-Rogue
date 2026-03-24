import { get } from 'svelte/store';
import { playerSave } from '../ui/stores/playerData';
import { ConfusionMatrix } from './confusionMatrix';

/** Global confusion matrix instance — loaded from player save. */
let globalConfusionMatrix: ConfusionMatrix = new ConfusionMatrix();

/**
 * Initialize from player save data. Call at app startup.
 */
export function initConfusionMatrix(): void {
  const save = get(playerSave);
  if (save?.confusionMatrix) {
    globalConfusionMatrix = ConfusionMatrix.fromJSON(save.confusionMatrix);
  } else {
    globalConfusionMatrix = new ConfusionMatrix();
  }
}

/**
 * Get the global confusion matrix instance.
 */
export function getConfusionMatrix(): ConfusionMatrix {
  return globalConfusionMatrix;
}

/**
 * Persist the current confusion matrix to player save.
 * Call after recording confusions.
 */
export function saveConfusionMatrix(): void {
  const data = globalConfusionMatrix.toJSON();
  playerSave.update((save) => save ? { ...save, confusionMatrix: data } : save);
}
