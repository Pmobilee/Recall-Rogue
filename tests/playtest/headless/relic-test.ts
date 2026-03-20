import './browser-shim.js';
import { resolveAttackModifiers, resolveShieldModifiers, resolveDamageTakenEffects } from '../../../src/services/relicEffectResolver.js';
import { STARTER_RELIC_IDS } from '../../../src/data/relics/index.js';
import { getAscensionModifiers } from '../../../src/services/ascension.js';

console.log('=== RELIC EFFECT DIAGNOSTIC ===\n');
console.log('Starter relic IDs:', STARTER_RELIC_IDS.length);
console.log(STARTER_RELIC_IDS.join(', '));

console.log('\nAscension relic counts:');
for (const lvl of [0, 1, 5, 10, 20]) {
  console.log(`  A${lvl}: ${getAscensionModifiers(lvl).startingRelicCount} starter relics`);
}

// Test resolveAttackModifiers with different relic sets
const noRelics = new Set<string>();
const withWhetstone = new Set<string>(['whetstone']);
const withMultiple = new Set<string>(['whetstone', 'combo_ring', 'steel_skin', 'swift_boots']);

console.log('\n=== ATTACK MODIFIER TESTS ===');
try {
  const r1 = resolveAttackModifiers(noRelics, {} as any);
  console.log('No relics:', JSON.stringify(r1));
} catch (e) {
  console.log('No relics - error:', (e as Error).message?.slice(0, 100));
}

try {
  const r2 = resolveAttackModifiers(withWhetstone, {} as any);
  console.log('Whetstone:', JSON.stringify(r2));
} catch (e) {
  console.log('Whetstone - error:', (e as Error).message?.slice(0, 100));
}

try {
  const r3 = resolveAttackModifiers(withMultiple, {} as any);
  console.log('4 relics:', JSON.stringify(r3));
} catch (e) {
  console.log('4 relics - error:', (e as Error).message?.slice(0, 100));
}
