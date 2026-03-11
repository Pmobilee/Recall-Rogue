import { describe, it, expect } from 'vitest';
import { createEnemy, rollNextIntent, executeEnemyIntent } from '../../src/services/enemyManager';
import type { EnemyTemplate } from '../../src/data/enemies';

/** Minimal charge-capable enemy template for testing. */
const chargeEnemy: EnemyTemplate = {
  id: 'test_charger',
  name: 'Test Charger',
  category: 'common',
  baseHP: 50,
  intentPool: [
    { type: 'charge', value: 30, weight: 1, telegraph: 'Charging!' },
  ],
  description: 'A test enemy that always charges.',
};

describe('Enemy Charge Mechanic', () => {
  it('charge intent sets isCharging and does 0 damage', () => {
    const enemy = createEnemy(chargeEnemy, 1);
    // Force the charge intent
    enemy.nextIntent = { type: 'charge', value: 30, weight: 1, telegraph: 'Charging!' };

    const result = executeEnemyIntent(enemy);
    expect(result.damage).toBe(0);
    expect(enemy.isCharging).toBe(true);
    expect(enemy.chargedDamage).toBe(30);
  });

  it('next intent after charge fires the charged attack', () => {
    const enemy = createEnemy(chargeEnemy, 1);
    enemy.isCharging = true;
    enemy.chargedDamage = 30;

    const intent = rollNextIntent(enemy);
    expect(intent.type).toBe('attack');
    expect(intent.value).toBe(30);
    expect(intent.bypassDamageCap).toBe(true);
    expect(enemy.isCharging).toBe(false);
    expect(enemy.chargedDamage).toBe(0);
  });

  it('charged attack bypasses damage cap', () => {
    const enemy = createEnemy(chargeEnemy, 1);
    // Simulate a charged attack firing
    enemy.nextIntent = { type: 'attack', value: 50, weight: 1, telegraph: 'Unleashing!', bypassDamageCap: true };

    const result = executeEnemyIntent(enemy);
    // Should NOT be capped (normal cap for segment 1 is around 25-30)
    expect(result.damage).toBeGreaterThanOrEqual(50);
  });

  it('normal intent rolling resumes after charge fires', () => {
    const enemy = createEnemy(chargeEnemy, 1);
    // After charge fires, isCharging is cleared
    enemy.isCharging = false;
    enemy.chargedDamage = 0;

    const intent = rollNextIntent(enemy);
    expect(intent.type).toBe('charge');
  });
});
