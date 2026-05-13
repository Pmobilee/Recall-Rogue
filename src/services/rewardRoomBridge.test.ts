/**
 * Unit tests for rewardRoomBridge — focused on the softlock-escape path.
 *
 * The key invariant: triggerRewardRoomContinue() MUST never be a no-op.
 * When the Phaser scene is inactive (the race condition that caused the
 * Steam-blocking softlock, bug 2026-05-01), it must fall back to
 * forceProceedAfterReward() via dynamic import of gameFlowController.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock the svelte/store writable used for rewardCardDetail so the module loads
// in a non-browser environment.
vi.mock('svelte/store', () => ({
  writable: (initial: unknown) => {
    let _val = initial;
    return {
      subscribe: (fn: (v: unknown) => void) => { fn(_val); return () => {}; },
      set: (v: unknown) => { _val = v; },
      update: (fn: (v: unknown) => unknown) => { _val = fn(_val); },
    };
  },
}));

// Mock stores used by rewardRoomBridge (currentScreen imported from ui/stores/gameState)
vi.mock('../ui/stores/gameState', () => ({
  currentScreen: {
    subscribe: () => () => {},
    set: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock initRewardSpawnService
vi.mock('./rewardSpawnService', () => ({
  initRewardSpawnService: vi.fn().mockResolvedValue(undefined),
}));

// Mock turboDelay to pass through timing unchanged for unit tests
vi.mock('../utils/turboMode', () => ({
  turboDelay: (ms: number) => ms,
}));

// The forceProceedAfterReward spy — set up so we can confirm it gets called.
// Using a factory function so Vitest's hoisting works correctly.
const mockForceProceedAfterReward = vi.fn();

vi.mock('./gameFlowController', () => ({
  forceProceedAfterReward: () => mockForceProceedAfterReward(),
}));

// --- Helper to flush microtask queue ---
async function flushPromises(): Promise<void> {
  // Multiple rounds to settle nested promise chains (import().then(...))
  for (let i = 0; i < 10; i++) {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
}

// --- Tests ---

describe('triggerRewardRoomContinue', () => {
  beforeEach(() => {
    mockForceProceedAfterReward.mockReset();
    // Clear any stale global manager
    const reg = globalThis as Record<symbol, unknown>;
    delete reg[Symbol.for('rr:cardGameManager')];
  });

  it('uses the scene continue handler when the scene is active', async () => {
    const emitSpy = vi.fn();
    const continueSpy = vi.fn();
    const fakeScene = {
      scene: { isActive: () => true },
      events: { emit: emitSpy },
      continueFromOverlay: continueSpy,
    };
    const reg = globalThis as Record<symbol, unknown>;
    reg[Symbol.for('rr:cardGameManager')] = {
      getRewardRoomScene: () => fakeScene,
    };

    const { triggerRewardRoomContinue } = await import('./rewardRoomBridge');
    triggerRewardRoomContinue();

    expect(continueSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).not.toHaveBeenCalled();
    expect(mockForceProceedAfterReward).not.toHaveBeenCalled();
  });

  it('forces progression if the active scene continue handler throws', async () => {
    const fakeScene = {
      scene: { isActive: () => true },
      events: { emit: vi.fn() },
      continueFromOverlay: vi.fn(() => {
        throw new Error('drawImage');
      }),
    };
    const reg = globalThis as Record<symbol, unknown>;
    reg[Symbol.for('rr:cardGameManager')] = {
      getRewardRoomScene: () => fakeScene,
    };

    const { triggerRewardRoomContinue } = await import('./rewardRoomBridge');
    triggerRewardRoomContinue();

    await flushPromises();

    expect(mockForceProceedAfterReward).toHaveBeenCalledTimes(1);
  });

  it('calls forceProceedAfterReward when the scene is inactive (softlock escape)', async () => {
    const fakeScene = {
      scene: { isActive: () => false },
      events: { emit: vi.fn() },
    };
    const reg = globalThis as Record<symbol, unknown>;
    reg[Symbol.for('rr:cardGameManager')] = {
      getRewardRoomScene: () => fakeScene,
    };

    const { triggerRewardRoomContinue } = await import('./rewardRoomBridge');
    triggerRewardRoomContinue();

    await flushPromises();

    expect(mockForceProceedAfterReward).toHaveBeenCalledTimes(1);
  });

  it('calls forceProceedAfterReward when getRewardRoomScene returns null (softlock escape)', async () => {
    const reg = globalThis as Record<symbol, unknown>;
    reg[Symbol.for('rr:cardGameManager')] = {
      getRewardRoomScene: () => null,
    };

    const { triggerRewardRoomContinue } = await import('./rewardRoomBridge');
    triggerRewardRoomContinue();

    await flushPromises();

    expect(mockForceProceedAfterReward).toHaveBeenCalledTimes(1);
  });

  it('calls forceProceedAfterReward when no manager is registered (softlock escape)', async () => {
    // No manager in globalThis
    const { triggerRewardRoomContinue } = await import('./rewardRoomBridge');
    triggerRewardRoomContinue();

    await flushPromises();

    expect(mockForceProceedAfterReward).toHaveBeenCalledTimes(1);
  });
});
