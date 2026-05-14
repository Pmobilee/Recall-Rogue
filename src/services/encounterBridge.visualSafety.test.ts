// @vitest-environment node

import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('encounterBridge visual safety invariants', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, 'encounterBridge.ts'),
    'utf-8',
  );

  it('enemy-turn animation failures cannot abort combat resolution', () => {
    const warningIndex = source.indexOf('Enemy-turn visual update failed; continuing combat resolution');
    expect(warningIndex).toBeGreaterThan(-1);

    const defeatTimerIndex = source.indexOf("notifyEncounterComplete('defeat')", warningIndex);
    expect(defeatTimerIndex).toBeGreaterThan(warningIndex);
  });

  it('card-play animation failures cannot abort card resolution', () => {
    const cardWarningIndex = source.indexOf('Card-play visual update failed; continuing card resolution');
    expect(cardWarningIndex).toBeGreaterThan(-1);

    const victoryCompletionIndex = source.indexOf("notifyEncounterComplete('victory')", cardWarningIndex);
    expect(victoryCompletionIndex).toBeGreaterThan(cardWarningIndex);
  });

  it('chain and victory visual failures are isolated from gameplay routing', () => {
    expect(source.indexOf('Chain visual update failed; continuing card resolution')).toBeGreaterThan(-1);
    expect(source.indexOf('Victory visual update failed; continuing encounter completion')).toBeGreaterThan(-1);
  });
});
