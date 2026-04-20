/**
 * #79 regression test — initRaceMode is called from gameFlowController
 * before startRaceProgressBroadcast fires.
 *
 * Source-level invariant: inside the multiplayer_race branch of onArchetypeSelected
 * (the START path, not the end path), initRaceMode(getLocalMultiplayerPlayerId())
 * MUST appear before startRaceProgressBroadcast so back-to-back races do not leak
 * fact accumulators from the previous run into the next FSRS batch.
 */

// @vitest-environment node

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const CONTROLLER_PATH = path.resolve(__dirname, 'gameFlowController.ts');
const source = fs.readFileSync(CONTROLLER_PATH, 'utf-8');

describe('#79 — initRaceMode call-site invariant in gameFlowController', () => {
  it('imports initRaceMode from multiplayerGameService', () => {
    expect(source).toContain('initRaceMode');
    // Confirms named import is present in the module-level import
    expect(source).toMatch(/import\s*\{[^}]*initRaceMode[^}]*\}\s*from\s*['"]\.\/multiplayerGameService['"]/);
  });

  it('imports getLocalMultiplayerPlayerId from multiplayerLobbyService', () => {
    expect(source).toContain('getLocalMultiplayerPlayerId');
    expect(source).toMatch(/import\s*\{[^}]*getLocalMultiplayerPlayerId[^}]*\}\s*from\s*['"]\.\/multiplayerLobbyService['"]/);
  });

  it('initRaceMode(getLocalMultiplayerPlayerId()) is present in source', () => {
    expect(source).toContain('initRaceMode(getLocalMultiplayerPlayerId())');
  });

  it('initRaceMode call appears BEFORE startRaceProgressBroadcast in source order', () => {
    const initPos = source.indexOf('initRaceMode(getLocalMultiplayerPlayerId())');
    const broadcastPos = source.indexOf('stopRaceBroadcastFn = startRaceProgressBroadcast(');
    expect(initPos).toBeGreaterThan(-1);
    expect(broadcastPos).toBeGreaterThan(-1);
    expect(initPos).toBeLessThan(broadcastPos);
  });

  it('initRaceMode is called inside a multiplayer_race conditional before the broadcast loop', () => {
    // Find the start broadcast block (not the end-run block)
    // The start block is identified by containing startRaceProgressBroadcast
    const broadcastPos = source.indexOf('stopRaceBroadcastFn = startRaceProgressBroadcast(');
    expect(broadcastPos).toBeGreaterThan(-1);

    // Find the if block that contains the broadcast — search backwards for the if
    const searchWindow = source.slice(0, broadcastPos);
    const blockStart = searchWindow.lastIndexOf("if (activeRunMode === 'multiplayer_race')");
    expect(blockStart).toBeGreaterThan(-1);

    // The block from blockStart to broadcastPos must contain initRaceMode
    const blockBody = source.slice(blockStart, broadcastPos);
    expect(blockBody).toContain('initRaceMode(getLocalMultiplayerPlayerId())');
  });
});
