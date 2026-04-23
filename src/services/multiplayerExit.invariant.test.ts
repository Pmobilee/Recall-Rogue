/**
 * Source-level invariant tests for multiplayer exit handlers in CardApp.svelte.
 *
 * These tests verify that every MP result screen's exit callbacks (onReturnToHub,
 * onPlayAgain, onReturnToLobby) always call clearActiveRun() before navigating,
 * preventing stale MP save slots from softlocking subsequent solo runs.
 *
 * Motivation: After b6c1e651f (CRITICAL MP softlock fix), loadActiveRun() with
 * no arg now scans ALL slots. If an MP exit handler skips clearActiveRun(), the
 * stale MP save will be found by the next generic-resume call and either surface
 * a "resume MP run?" prompt for a dead session or, worse, attempt to rehydrate
 * it through the solo path and black-screen.
 *
 * Style mirrors gameFlowController.termination.test.ts — regex/substring
 * matching over the raw source, no AST parser needed.
 */

// @vitest-environment node

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Source file paths
// ---------------------------------------------------------------------------

const CARD_APP_PATH = path.resolve(__dirname, '../../src/CardApp.svelte');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the inline arrow-function body for a given prop assignment pattern.
 * Handles the common pattern: propName={() => { ... }}
 *
 * Returns the raw string content between the outermost `{` and its matching `}`
 * inside the prop value, or null if the pattern isn't found.
 */
function extractHandlerBody(source: string, propPattern: string): string | null {
  const idx = source.indexOf(propPattern);
  if (idx === -1) return null;

  // Find the opening `{` of the arrow function body.
  const arrowIdx = source.indexOf('=>', idx);
  if (arrowIdx === -1) return null;
  const bodyStart = source.indexOf('{', arrowIdx);
  if (bodyStart === -1) return null;

  // Walk forward matching braces.
  let depth = 0;
  let bodyEnd = -1;
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        bodyEnd = i;
        break;
      }
    }
  }
  if (bodyEnd === -1) return null;
  return source.slice(bodyStart, bodyEnd + 1);
}

/**
 * Collect all occurrences of a prop+handler body for the given prop name
 * within a specified component element range.
 */
function extractAllHandlerBodies(
  source: string,
  componentTag: string,
  propName: string,
): string[] {
  const bodies: string[] = [];
  let searchFrom = 0;

  while (true) {
    // Find next component opening tag
    const tagIdx = source.indexOf(`<${componentTag}`, searchFrom);
    if (tagIdx === -1) break;

    // Find the end of this element (closing tag or self-close)
    const closingTag = source.indexOf(`</${componentTag}`, tagIdx);
    const selfClose = source.indexOf('/>', tagIdx);
    // Take whichever comes first and is > tagIdx
    let tagEnd = -1;
    if (closingTag !== -1 && (selfClose === -1 || closingTag < selfClose)) {
      tagEnd = closingTag + `</${componentTag}>`.length;
    } else if (selfClose !== -1) {
      tagEnd = selfClose + 2;
    }
    if (tagEnd === -1) break;

    const elementSource = source.slice(tagIdx, tagEnd);

    // Extract all occurrences of this prop in this element
    let propSearch = 0;
    while (true) {
      const propIdx = elementSource.indexOf(`${propName}=`, propSearch);
      if (propIdx === -1) break;
      const body = extractHandlerBody(elementSource, `${propName}=`);
      if (body) bodies.push(body);
      // Advance past this occurrence to avoid infinite loop
      propSearch = propIdx + propName.length + 1;
    }

    searchFrom = tagEnd;
  }

  return bodies;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MP exit handlers — clearActiveRun invariant (CardApp.svelte)', () => {
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(CARD_APP_PATH, 'utf-8');
  });

  // -------------------------------------------------------------------------
  // RaceResultsScreen exit handlers
  // -------------------------------------------------------------------------

  it('RaceResultsScreen onReturnToHub contains clearActiveRun()', () => {
    const bodies = extractAllHandlerBodies(source, 'RaceResultsScreen', 'onReturnToHub');
    expect(bodies.length, 'Expected at least one RaceResultsScreen onReturnToHub handler').toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body, `RaceResultsScreen onReturnToHub handler must call clearActiveRun()`).toContain('clearActiveRun()');
    }
  });

  it('RaceResultsScreen onPlayAgain contains clearActiveRun()', () => {
    const bodies = extractAllHandlerBodies(source, 'RaceResultsScreen', 'onPlayAgain');
    expect(bodies.length, 'Expected at least one RaceResultsScreen onPlayAgain handler').toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body, `RaceResultsScreen onPlayAgain handler must call clearActiveRun()`).toContain('clearActiveRun()');
    }
  });

  it('RaceResultsScreen onReturnToLobby contains clearActiveRun()', () => {
    const bodies = extractAllHandlerBodies(source, 'RaceResultsScreen', 'onReturnToLobby');
    expect(bodies.length, 'Expected at least one RaceResultsScreen onReturnToLobby handler').toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body, `RaceResultsScreen onReturnToLobby handler must call clearActiveRun()`).toContain('clearActiveRun()');
    }
  });

  // -------------------------------------------------------------------------
  // TriviaRoundScreen exit handlers
  // -------------------------------------------------------------------------

  it('TriviaRoundScreen onReturnToHub contains clearActiveRun()', () => {
    const bodies = extractAllHandlerBodies(source, 'TriviaRoundScreen', 'onReturnToHub');
    expect(bodies.length, 'Expected at least one TriviaRoundScreen onReturnToHub handler').toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body, `TriviaRoundScreen onReturnToHub handler must call clearActiveRun()`).toContain('clearActiveRun()');
    }
  });

  it('TriviaRoundScreen onPlayAgain contains clearActiveRun()', () => {
    const bodies = extractAllHandlerBodies(source, 'TriviaRoundScreen', 'onPlayAgain');
    expect(bodies.length, 'Expected at least one TriviaRoundScreen onPlayAgain handler').toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body, `TriviaRoundScreen onPlayAgain handler must call clearActiveRun()`).toContain('clearActiveRun()');
    }
  });

  it('TriviaRoundScreen onReturnToLobby contains clearActiveRun()', () => {
    const bodies = extractAllHandlerBodies(source, 'TriviaRoundScreen', 'onReturnToLobby');
    expect(bodies.length, 'Expected at least one TriviaRoundScreen onReturnToLobby handler').toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body, `TriviaRoundScreen onReturnToLobby handler must call clearActiveRun()`).toContain('clearActiveRun()');
    }
  });

  // -------------------------------------------------------------------------
  // handleStartRun — must guard against MP saves and clear before solo flow
  // -------------------------------------------------------------------------

  it('handleStartRun contains clearActiveRun()', () => {
    // Find the handleStartRun function body
    const fnStart = source.indexOf('function handleStartRun(');
    expect(fnStart, 'handleStartRun function must exist in CardApp.svelte').toBeGreaterThan(-1);

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
    const body = source.slice(fnStart, fnEnd + 1);

    expect(body, 'handleStartRun must call clearActiveRun()').toContain('clearActiveRun()');
    expect(body, "handleStartRun must guard MP runs with startsWith('multiplayer_')").toContain("startsWith('multiplayer_')");
  });

  // -------------------------------------------------------------------------
  // handleResumeActiveRun — must have try/catch failsafe + clearActiveRun
  // -------------------------------------------------------------------------

  it('handleResumeActiveRun contains try { and clearActiveRun()', () => {
    const fnStart = source.indexOf('function handleResumeActiveRun(');
    expect(fnStart, 'handleResumeActiveRun function must exist in CardApp.svelte').toBeGreaterThan(-1);

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
    const body = source.slice(fnStart, fnEnd + 1);

    expect(body, 'handleResumeActiveRun must use a try/catch failsafe').toContain('try {');
    expect(body, 'handleResumeActiveRun must call clearActiveRun() in the catch branch').toContain('clearActiveRun()');
  });
});
