/**
 * Browser API shims for Node.js headless simulation.
 * Must be loaded BEFORE any game imports.
 */

// localStorage shim
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as unknown as Record<string, unknown>).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

// import.meta.env shim
if (typeof (import.meta as Record<string, unknown>).env === 'undefined') {
  (import.meta as Record<string, unknown>).env = { DEV: true, PROD: false, MODE: 'development' };
}

// window shim (minimal)
if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).window = globalThis;
}

// document shim (minimal)
if (typeof globalThis.document === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).document = {
    createElement: () => ({ getContext: () => null, style: {} }),
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: { setAttribute: () => {} },
    addEventListener: () => {},
  };
}
