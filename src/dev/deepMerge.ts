/**
 * deepMerge.ts — Standalone deep-merge utility for game state objects.
 *
 * Used by the scenario spawning system to apply partial overrides to
 * TurnState and RunState Svelte stores. Zero game imports — fully standalone.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Recursively makes all properties optional with special handling for
 * Set, Array, and nested object fields.
 */
export type DeepPartial<T> = T extends Set<infer U>
  ? Set<U> | U[]
  : T extends Array<infer _U>
  ? T // Arrays are kept as-is (wholesale replacement)
  : T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true for plain objects (not Array, Set, Map, Date, null). */
function isPlainObject(val: unknown): val is Record<string, unknown> {
  return (
    typeof val === 'object' &&
    val !== null &&
    !Array.isArray(val) &&
    !(val instanceof Set) &&
    !(val instanceof Map) &&
    !(val instanceof Date)
  );
}

// ---------------------------------------------------------------------------
// deepMerge
// ---------------------------------------------------------------------------

/**
 * Pure deep-merge function. Returns a NEW object (never mutates target).
 * The new reference is required for Svelte store reactivity (`.set()` needs
 * a new reference to trigger subscribers).
 *
 * Merge rules (checked in order):
 * - `undefined` in source → skip (preserve target value)
 * - Functions in source → skip (never override behaviour)
 * - Primitives → replace
 * - Arrays → wholesale replacement (no element-wise merge)
 * - Target is Set, source is Array → `new Set(sourceArray)`
 * - Target is Set, source is Set → replace with source Set
 * - Both are plain objects → recurse
 * - Otherwise → replace
 */
export function deepMerge<T>(target: T, source: DeepPartial<T>): T {
  // If source is not an object at all, return source as-is (primitive override)
  if (!isPlainObject(source)) {
    return source as unknown as T;
  }

  // Start with a shallow copy of target
  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  const sourceObj = source as Record<string, unknown>;

  for (const key of Object.keys(sourceObj)) {
    const srcVal = sourceObj[key];
    const tgtVal = result[key];

    // Skip undefined — preserve existing value
    if (srcVal === undefined) {
      continue;
    }

    // Skip functions — never override behaviour
    if (typeof srcVal === 'function') {
      continue;
    }

    // Arrays → wholesale replacement
    if (Array.isArray(srcVal)) {
      if (tgtVal instanceof Set) {
        // Target is a Set → convert array to Set
        result[key] = new Set(srcVal);
      } else {
        // Plain array replacement
        result[key] = srcVal;
      }
      continue;
    }

    // Set → replace (either target is a Set or we just use the source Set)
    if (srcVal instanceof Set) {
      result[key] = srcVal;
      continue;
    }

    // Both are plain objects → recurse
    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      result[key] = deepMerge(tgtVal, srcVal as DeepPartial<typeof tgtVal>);
      continue;
    }

    // Everything else (null, primitives, Map, Date, …) → direct assignment
    result[key] = srcVal;
  }

  return result as T;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Converts a state object to a plain-JSON-serializable form.
 * - Sets → `{ __type: 'Set', values: [...] }`
 * - Maps → `{ __type: 'Map', entries: [[k,v], ...] }`
 * - Functions → omitted from output
 * - Everything else → passed through (recursively)
 */
export function serializeState(state: unknown): unknown {
  if (state instanceof Set) {
    return { __type: 'Set', values: [...state].map(serializeState) };
  }

  if (state instanceof Map) {
    return {
      __type: 'Map',
      entries: [...state.entries()].map(([k, v]) => [serializeState(k), serializeState(v)]),
    };
  }

  if (Array.isArray(state)) {
    return state.map(serializeState);
  }

  if (isPlainObject(state)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(state)) {
      if (typeof v === 'function') continue; // omit functions
      out[k] = serializeState(v);
    }
    return out;
  }

  // Primitives, null, Date, etc.
  return state;
}

/**
 * Reconstitutes a state object from its serialized form.
 * - `{ __type: 'Set', values }` → `new Set(values)`
 * - `{ __type: 'Map', entries }` → `new Map(entries)`
 * - Everything else → passed through (recursively)
 */
export function deserializeState(json: unknown): unknown {
  if (Array.isArray(json)) {
    return json.map(deserializeState);
  }

  if (isPlainObject(json)) {
    const obj = json as Record<string, unknown>;

    if (obj['__type'] === 'Set' && Array.isArray(obj['values'])) {
      return new Set((obj['values'] as unknown[]).map(deserializeState));
    }

    if (obj['__type'] === 'Map' && Array.isArray(obj['entries'])) {
      return new Map(
        (obj['entries'] as [unknown, unknown][]).map(([k, v]) => [
          deserializeState(k),
          deserializeState(v),
        ])
      );
    }

    // Plain object — recurse
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = deserializeState(v);
    }
    return out;
  }

  return json;
}
