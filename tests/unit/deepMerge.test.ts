import { describe, it, expect } from 'vitest';
import { deepMerge, serializeState, deserializeState } from '../../src/dev/deepMerge';

// ---------------------------------------------------------------------------
// deepMerge
// ---------------------------------------------------------------------------

describe('deepMerge', () => {
  it('overrides primitive fields', () => {
    const target = { hp: 10, name: 'hero', alive: true };
    const result = deepMerge(target, { hp: 5, name: 'warrior', alive: false });
    expect(result).toEqual({ hp: 5, name: 'warrior', alive: false });
  });

  it('merges nested objects without clobbering sibling keys', () => {
    const target = { a: { b: 1, c: 2 } };
    const result = deepMerge(target, { a: { b: 99 } });
    expect(result).toEqual({ a: { b: 99, c: 2 } });
  });

  it('replaces arrays wholesale', () => {
    const target = { items: [1, 2, 3] };
    const result = deepMerge(target, { items: [7, 8] });
    expect(result.items).toEqual([7, 8]);
  });

  it('converts source array to Set when target field is a Set', () => {
    const target = { cursedFactIds: new Set(['fact_0']) };
    const result = deepMerge(target, { cursedFactIds: ['fact_1', 'fact_2'] });
    expect(result.cursedFactIds).toBeInstanceOf(Set);
    expect(result.cursedFactIds).toEqual(new Set(['fact_1', 'fact_2']));
  });

  it('replaces target Set with source Set', () => {
    const target = { tags: new Set(['a', 'b']) };
    const replacement = new Set(['x', 'y', 'z']);
    const result = deepMerge(target, { tags: replacement });
    expect(result.tags).toBeInstanceOf(Set);
    expect(result.tags).toEqual(new Set(['x', 'y', 'z']));
  });

  it('skips function properties from source', () => {
    const target = { value: 1, fn: () => 'original' };
    const result = deepMerge(target, { value: 2, fn: () => 'override' });
    expect(result.value).toBe(2);
    // fn should remain the original from target (functions in source are skipped)
    expect(result.fn()).toBe('original');
  });

  it('skips undefined values in source (preserves target value)', () => {
    const target = { hp: 100, gold: 50 };
    const result = deepMerge(target, { hp: undefined, gold: 25 });
    expect(result.hp).toBe(100); // unchanged — undefined means skip
    expect(result.gold).toBe(25);
  });

  it('preserves null (explicit null overwrites target value)', () => {
    const target = { boss: { name: 'Dragon' } as { name: string } | null };
    const result = deepMerge(target, { boss: null });
    expect(result.boss).toBeNull();
  });

  it('merges 3+ levels of nested objects correctly', () => {
    const target = { a: { b: { c: { d: 1, e: 2 } } } };
    const result = deepMerge(target, { a: { b: { c: { d: 99 } } } });
    expect(result).toEqual({ a: { b: { c: { d: 99, e: 2 } } } });
  });

  it('returns a new object reference (not the same as target)', () => {
    const target = { x: 1 };
    const result = deepMerge(target, { x: 2 });
    expect(result).not.toBe(target);
  });

  it('returns a new nested object reference for changed sub-objects', () => {
    const target = { nested: { val: 1 } };
    const result = deepMerge(target, { nested: { val: 2 } });
    expect(result.nested).not.toBe(target.nested);
  });
});

// ---------------------------------------------------------------------------
// serializeState / deserializeState
// ---------------------------------------------------------------------------

describe('serializeState + deserializeState round-trip', () => {
  it('preserves Sets through a JSON round-trip', () => {
    const state = { ids: new Set(['a', 'b', 'c']), count: 3 };
    const serialized = serializeState(state);
    const roundTripped = deserializeState(JSON.parse(JSON.stringify(serialized)));
    expect((roundTripped as typeof state).ids).toBeInstanceOf(Set);
    expect((roundTripped as typeof state).ids).toEqual(new Set(['a', 'b', 'c']));
    expect((roundTripped as typeof state).count).toBe(3);
  });

  it('preserves Maps through a JSON round-trip', () => {
    const state = { registry: new Map([['key1', 100], ['key2', 200]]) };
    const serialized = serializeState(state);
    const roundTripped = deserializeState(JSON.parse(JSON.stringify(serialized)));
    expect((roundTripped as typeof state).registry).toBeInstanceOf(Map);
    expect((roundTripped as typeof state).registry.get('key1')).toBe(100);
    expect((roundTripped as typeof state).registry.get('key2')).toBe(200);
  });

  it('preserves nested Sets and Maps through a JSON round-trip', () => {
    const state = {
      combat: {
        activeCards: new Set([1, 2]),
        metadata: new Map([['turn', 3]]),
      },
    };
    const serialized = serializeState(state);
    const roundTripped = deserializeState(JSON.parse(JSON.stringify(serialized))) as typeof state;
    expect(roundTripped.combat.activeCards).toBeInstanceOf(Set);
    expect(roundTripped.combat.activeCards).toEqual(new Set([1, 2]));
    expect(roundTripped.combat.metadata).toBeInstanceOf(Map);
    expect(roundTripped.combat.metadata.get('turn')).toBe(3);
  });

  it('omits function properties from serialized output', () => {
    const state = { value: 42, compute: () => 99 };
    const serialized = serializeState(state) as Record<string, unknown>;
    expect(serialized['value']).toBe(42);
    expect('compute' in serialized).toBe(false);
  });

  it('passes through primitives unchanged', () => {
    expect(serializeState(42)).toBe(42);
    expect(serializeState('hello')).toBe('hello');
    expect(serializeState(true)).toBe(true);
    expect(serializeState(null)).toBeNull();
  });

  it('deserializes nested plain objects recursively', () => {
    const state = { a: { b: { c: 'deep' } } };
    const serialized = serializeState(state);
    const roundTripped = deserializeState(JSON.parse(JSON.stringify(serialized)));
    expect(roundTripped).toEqual({ a: { b: { c: 'deep' } } });
  });

  it('serializes arrays of Sets correctly', () => {
    const state = { groups: [new Set([1, 2]), new Set([3, 4])] };
    const serialized = serializeState(state);
    const roundTripped = deserializeState(JSON.parse(JSON.stringify(serialized))) as typeof state;
    expect(roundTripped.groups[0]).toBeInstanceOf(Set);
    expect(roundTripped.groups[0]).toEqual(new Set([1, 2]));
    expect(roundTripped.groups[1]).toEqual(new Set([3, 4]));
  });
});
