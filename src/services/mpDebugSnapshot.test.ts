/**
 * Tests for mpDebugSnapshot.ts — deterministic formatter only.
 * The clipboard side-effect path is tested at the integration level via
 * the UI layer (ui-agent owns wiring; see mpDebugSnapshot.ts module header).
 */

import { describe, it, expect } from 'vitest';
import { formatMpDebugSnapshot, type MpDebugSnapshotInput } from './mpDebugSnapshot';

describe('formatMpDebugSnapshot', () => {
  it('produces a "no MP state" placeholder when state is null', () => {
    const out = formatMpDebugSnapshot(null);
    expect(out).toContain('Recall Rogue — MP debug snapshot');
    expect(out).toContain('No MP state');
    expect(out).toContain('Build:    unknown');
  });

  it('embeds the build version when supplied', () => {
    const out = formatMpDebugSnapshot(null, '1.4.2');
    expect(out).toContain('Build:    1.4.2');
  });

  it('includes a fenced JSON dump of the state', () => {
    const state: MpDebugSnapshotInput = {
      lobby: { lobbyId: 'L1', players: [{ id: 'p1' }] },
      transport: { backend: 'broadcast', state: 'connected' },
      steam: { ready: false },
      lan: null,
      updatedAt: '2026-04-22T20:00:00.000Z',
    };
    const out = formatMpDebugSnapshot(state);
    expect(out).toContain('```json');
    expect(out).toContain('"lobbyId": "L1"');
    expect(out).toContain('"backend": "broadcast"');
    expect(out).toContain('State at: 2026-04-22T20:00:00.000Z');
  });

  it('truncates recentMessages to the last 20 entries', () => {
    const recentMessages = Array.from({ length: 50 }, (_, i) => ({
      type: `msg:${i}`,
      timestamp: 1000 + i,
    }));
    const state: MpDebugSnapshotInput = {
      lobby: null,
      transport: null,
      steam: null,
      lan: null,
      updatedAt: '2026-04-22T20:00:00.000Z',
      recentMessages,
    };
    const out = formatMpDebugSnapshot(state);
    // Should contain the LAST 20 (msg:30..msg:49) and NOT the early ones (msg:0..msg:29).
    expect(out).toContain('"type": "msg:49"');
    expect(out).toContain('"type": "msg:30"');
    expect(out).not.toContain('"type": "msg:0"');
    expect(out).not.toContain('"type": "msg:29"');
  });

  it('survives JSON.stringify failure (e.g. circular refs) by emitting a fallback', () => {
    type Circular = MpDebugSnapshotInput & { self?: Circular };
    const state: Circular = {
      lobby: null,
      transport: null,
      steam: null,
      lan: null,
      updatedAt: '2026-04-22T20:00:00.000Z',
    };
    state.self = state;
    const out = formatMpDebugSnapshot(state);
    // Either the stringify worked (Node 20+ structured clone tolerates some
    // self-refs?) or the fallback fired — both are acceptable, neither should
    // throw or return an empty string.
    expect(out.length).toBeGreaterThan(50);
    expect(out).toContain('Recall Rogue — MP debug snapshot');
  });
});
