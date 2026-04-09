import { describe, it, expect, beforeEach } from 'vitest';
import { createEnemy, rollNextIntent } from './enemyManager';
import { initRunRng, destroyRunRng } from './seededRng';
import { ENEMY_TEMPLATES } from '../data/enemies';

const MARGIN_GREMLIN_TEMPLATE = ENEMY_TEMPLATES.find(t => t.id === 'margin_gremlin')!;

describe('enemy intent RNG determinism', () => {
  beforeEach(() => {
    destroyRunRng();
  });

  it('two enemies with the same seed roll identical intent sequences', () => {
    initRunRng(12345);
    const enemy1 = createEnemy(MARGIN_GREMLIN_TEMPLATE, 1);
    const seq1 = [{ type: enemy1.nextIntent.type, value: enemy1.nextIntent.value }];
    for (let i = 0; i < 10; i++) {
      rollNextIntent(enemy1);
      seq1.push({ type: enemy1.nextIntent.type, value: enemy1.nextIntent.value });
    }

    initRunRng(12345);
    const enemy2 = createEnemy(MARGIN_GREMLIN_TEMPLATE, 1);
    const seq2 = [{ type: enemy2.nextIntent.type, value: enemy2.nextIntent.value }];
    for (let i = 0; i < 10; i++) {
      rollNextIntent(enemy2);
      seq2.push({ type: enemy2.nextIntent.type, value: enemy2.nextIntent.value });
    }

    expect(seq1.map(i => i.type)).toEqual(seq2.map(i => i.type));
    expect(seq1.map(i => i.value)).toEqual(seq2.map(i => i.value));
  });

  it('different seeds produce different intent sequences', () => {
    initRunRng(12345);
    const enemyA = createEnemy(MARGIN_GREMLIN_TEMPLATE, 1);
    const seqA: string[] = [];
    for (let i = 0; i < 10; i++) {
      rollNextIntent(enemyA);
      seqA.push(enemyA.nextIntent.type);
    }

    initRunRng(99999);
    const enemyB = createEnemy(MARGIN_GREMLIN_TEMPLATE, 1);
    const seqB: string[] = [];
    for (let i = 0; i < 10; i++) {
      rollNextIntent(enemyB);
      seqB.push(enemyB.nextIntent.type);
    }

    // Sequences from different seeds should differ at least once in 10 rolls
    // (statistical near-certainty; if they're identical, the RNG is constant)
    const allSame = seqA.every((v, i) => v === seqB[i]);
    expect(allSame).toBe(false);
  });

  it('without an active run RNG, falls back to Math.random without throwing', () => {
    // No initRunRng() call — should not throw
    expect(() => {
      const enemy = createEnemy(MARGIN_GREMLIN_TEMPLATE, 1);
      rollNextIntent(enemy);
    }).not.toThrow();
  });
});
