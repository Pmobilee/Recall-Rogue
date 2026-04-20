/**
 * M18 regression test — MP lobby houseRules.ascensionLevel is piped into RunState.
 *
 * Source-level invariant: when multiplayerModeState is set and getCurrentLobby()
 * returns a lobby, onArchetypeSelected() must derive selectedAscensionLevel from
 * houseRules.ascensionLevel (clamped to [0, 20]), not from getAscensionLevel().
 */

// @vitest-environment node

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const CONTROLLER_PATH = path.resolve(__dirname, 'gameFlowController.ts');
let source: string;

// Read once — all tests reuse
source = fs.readFileSync(CONTROLLER_PATH, 'utf-8');

describe('M18 — MP lobby ascension level wiring invariant', () => {
  it('onArchetypeSelected contains M18 lobby ascension guard', () => {
    // Find the onArchetypeSelected function body
    const fnStart = source.indexOf('export async function onArchetypeSelected(');
    expect(fnStart).toBeGreaterThan(-1);

    // Scan forward for the closing brace
    let depth = 0;
    let fnEnd = -1;
    for (let i = fnStart; i < source.length; i++) {
      if (source[i] === '{') depth++;
      if (source[i] === '}') {
        depth--;
        if (depth === 0) {
          fnEnd = i;
          break;
        }
      }
    }
    expect(fnEnd).toBeGreaterThan(fnStart);

    const fnBody = source.slice(fnStart, fnEnd + 1);

    // Must read from houseRules.ascensionLevel in MP path
    expect(fnBody).toContain('houseRules.ascensionLevel');

    // Must clamp to [0, 20]
    expect(fnBody).toContain('Math.max(0, Math.min(20,');

    // Must use multiplayerModeState !== null as the MP guard
    expect(fnBody).toContain('multiplayerModeState !== null');

    // Final selectedAscensionLevel must use the lobby value when available
    expect(fnBody).toContain('lobbyAscensionLevel ?? getAscensionLevel(ascensionMode)');
  });

  it('ascension cap is 20 (not higher)', () => {
    // Regex: find Math.min(20, inside onArchetypeSelected
    const fnStart = source.indexOf('export async function onArchetypeSelected(');
    const fnEnd = (() => {
      let depth = 0;
      for (let i = fnStart; i < source.length; i++) {
        if (source[i] === '{') depth++;
        if (source[i] === '}') { depth--; if (depth === 0) return i; }
      }
      return -1;
    })();
    const fnBody = source.slice(fnStart, fnEnd + 1);

    // Cap must be 20, not 25 or 30
    expect(fnBody).toMatch(/Math\.min\(20,/);
    expect(fnBody).not.toMatch(/Math\.min\(25,/);
  });

  it('M18 guard falls back to getAscensionLevel for solo runs (null lobby)', () => {
    // The fallback expression must be present
    expect(source).toContain('lobbyAscensionLevel ?? getAscensionLevel(ascensionMode)');
  });
});
