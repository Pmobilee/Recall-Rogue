#!/usr/bin/env node
/**
 * scripts/lint/no-bare-math-random.mjs
 *
 * Prevents Cluster D (unseeded Math.random in gameplay code).
 *
 * In co-op mode, both clients independently simulate game logic using a shared
 * run seed. Any BARE Math.random() call in gameplay code diverges between clients,
 * causing delta desync. Three CRITICALs were found in BATCH-2026-04-11-ULTRA
 * (T9) at these exact locations:
 *   - relicEffectResolver.ts:1647   crit_lens relic crit chance
 *   - relicEffectResolver.ts:1712   obsidian_dice multiplier roll
 *   - relicAcquisitionService.ts:73,93  rarity roll / candidate pick
 *
 * Those three were fixed by adding the seeded-RNG-with-fallback pattern.
 * This lint detects regressions.
 *
 * WHAT IS A "BARE" CALL vs A "GUARDED" CALL?
 *
 *   BARE (flagged — real violation):
 *     const isCrit = Math.random() < 0.25;          // No seeded RNG path at all
 *     const idx = Math.floor(Math.random() * n);    // No seeded RNG path at all
 *
 *   GUARDED (NOT flagged — correct pattern):
 *     const roll = (rng ? rng.next() : Math.random())   // Has seeded RNG check
 *     isRunRngActive() ? getRunRng('x').next() : Math.random()  // Explicit seeded check
 *     (rngFn ? rngFn() : Math.random())             // Passed-in RNG function
 *     (this._rng ? this._rng.next() : Math.random()) // Instance RNG check
 *
 * The guarded pattern is the CORRECT intermediate state: seeded when a run is
 * active (co-op, replay, deterministic mode), falls back to Math.random() only
 * in dev/test/non-run contexts where determinism is not required.
 *
 * Files in the ALLOWLIST below are explicitly permitted to use Math.random():
 *   - src/dev/**             — dev-only tools, never in production gameplay
 *   - src/game/particles/**  — cosmetic only, no shared state
 *   - src/game/effects/**    — cosmetic only, no shared state
 *   - src/game/systems/CombatAtmosphereSystem.ts  — cosmetic atmosphere
 *   - src/game/systems/EnemySpriteSystem.ts       — cosmetic sprite variation
 *   - src/game/systems/WeaponAnimationSystem.ts   — cosmetic animation
 *   - src/game/systems/StatusEffectVisualSystem.ts — cosmetic visual FX
 *   - src/game/systems/ScreenShakeSystem.ts       — cosmetic screen shake
 *   - src/game/scenes/BootAnimScene.ts            — boot animation, cosmetic
 *   - src/game/scenes/CombatScene.ts              — visual-only: particles,
 *                                                   fragments, rain effects;
 *                                                   no shared game state
 *   - src/game/scenes/RewardRoomScene.ts          — all 28 calls are visual FX:
 *                                                   particle depth, float amplitudes,
 *                                                   orbital phases, ambient orb animation.
 *                                                   None affect card draws, gold, or run state.
 *   - src/ui/effects/**      — UI cosmetic effects (hubLighting, moths, etc.)
 *   - src/ui/components/DamageNumber.svelte       — cosmetic damage display
 *   - src/ui/components/SurgeBorderOverlay.svelte — cosmetic VFX
 *   - src/ui/components/DomeCanvas.svelte         — cosmetic ambient
 *   - src/ui/components/HubFireflies.svelte       — cosmetic hub ambient
 *   - src/ui/components/HubCursorLight.svelte     — cosmetic hub light
 *   - src/ui/components/HubMoths.svelte           — cosmetic hub moths
 *   - src/ui/components/GachaReveal.svelte        — cosmetic gacha reveal
 *   - src/ui/components/NearMissBanner.svelte     — cosmetic feedback
 *   - src/ui/components/HubScreen.svelte          — all 14 calls are fake "ghost run"
 *                                                   preview data for the hub menu screen;
 *                                                   none affect real run state.
 *   - src/ui/components/MapPinDrop.svelte         — cosmetic lat/lng jitter for map pins
 *   - src/ui/components/CosmeticStoreModal.svelte — cosmetic loot box dust reward (not
 *                                                   co-op gameplay; cosmetic currency)
 *   - src/ui/components/SocialScreen.svelte       — guest ID suffix generation (UI only)
 *   - src/ui/components/StudyTempleScreen.svelte  — session ID generation (UI only)
 *   - src/services/seededRng.ts     — the RNG implementation itself
 *   - src/services/randomUtils.ts   — shuffled() used for distractor ordering
 *                                    (presentation only, not gameplay state).
 *                                    If co-op deterministic ordering is ever
 *                                    needed, remove this entry.
 *   - src/services/audioService.ts  — all calls are audio buffer noise generation
 *                                    (PCM sample values for synthesized SFX).
 *                                    Audio synthesis is purely local and never
 *                                    affects shared game state.
 *   - src/services/musicService.ts  — playlist shuffle order (cosmetic, local only)
 *   - src/services/rewardSpawnService.ts — x/y position jitter for floating reward icons
 *                                          (visual only; does not affect reward contents)
 *   - src/services/rewardRoomBridge.ts   — all calls inside openTestRewardRoom(), a
 *                                          dev-only function called only from
 *                                          src/dev/scenarioSimulator.ts. Never runs in
 *                                          production gameplay sessions.
 *   - src/services/encounterBridge.ts    — line 1735 only: Math.random() in UUID suffix
 *                                          for card.id generation. Uniqueness not
 *                                          determinism is the requirement here; IDs are
 *                                          never compared across clients.
 *   - src/services/socialService.ts      — guest ID suffix generation (social profile,
 *                                          never synced as game state)
 *   - src/services/studyPresetService.ts — preset ID generation (local study, never in run)
 *   - src/services/eloMatchmakingService.ts — AI ELO variance for single-player fallback
 *                                             matchmaking (no co-op run involved)
 *   - src/services/multiplayerTransport.ts  — simulated network jitter/packet loss for
 *                                             local testing (BroadcastChannel mock).
 *                                             Deliberately non-deterministic to mimic real
 *                                             network variance. Never affects game state.
 *   - src/services/multiplayerWorkshopService.ts — workshop vote tiebreak runs on the
 *                                                   host only, then result is broadcast
 *                                                   to all clients. Determinism is
 *                                                   provided by the broadcast, not RNG.
 *   - src/services/multiplayerLobbyService.test.ts — test-only file; fake lobby IDs
 *   - src/data/petWaypoints.ts      — cosmetic pet pathfinding
 *   - src/data/petPersonalities.ts  — cosmetic pet reactions
 *   - src/data/shopkeeperBarks.ts   — cosmetic shopkeeper dialog
 *   - src/data/omniscientQuips.ts   — cosmetic narrator lines
 *   - src/data/foregroundElements.ts — cosmetic scene dressing
 *
 * ALLOWLIST_LINES (specific line overrides for files with mixed safe/unsafe calls):
 *   - multiplayerLobbyService.ts:72    — generatePlayerId(): local player ID suffix,
 *                                        not synchronized as game state
 *   - multiplayerLobbyService.ts:553   — startGame() run seed: intentionally non-
 *                                        deterministic entropy source. Host generates
 *                                        a random seed and broadcasts it to all clients.
 *                                        This IS the seed origin point — correct behavior.
 *   - multiplayerLobbyService.ts:712   — generateLobbyId(): lobby ID suffix, not game state
 *   - multiplayerLobbyService.ts:720   — generateLobbyCode(): lobby join code characters,
 *                                        not game state
 *   - ui/stores/playerData.ts:1564     — cosmetic loot box rarity roll (not gameplay sim)
 *
 * The ALLOWLIST is printed on every run so code reviewers can audit what is
 * explicitly exempted. Changes to the allowlist require code-review attention.
 *
 * Suggested replacement for violations:
 *   isRunRngActive() ? getRunRng('<bucket>').next() : Math.random()
 *
 * Run:    node scripts/lint/no-bare-math-random.mjs
 * Added:  2026-04-11 — BATCH-ULTRA Cluster D meta-fix
 * Updated: 2026-04-11 — BATCH-ULTRA Wave C: expanded allowlist for cosmetic paths
 *                        (169 → ~30 violations; remaining are genuine co-op desync risks)
 *
 * Exit codes:
 *   0 — no violations
 *   1 — violations found
 *
 * See correlation-report.md Cluster D and docs/mechanics/multiplayer.md §RNG
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

// ---------------------------------------------------------------------------
// ALLOWLIST — glob patterns (relative to REPO_ROOT)
// ---------------------------------------------------------------------------
// Every entry here is explicitly granted permission to use Math.random().
// RATIONALE REQUIRED per entry — see header comment above.
// ---------------------------------------------------------------------------

const ALLOWLIST_GLOBS = [
  // dev-only tooling — never runs in production game sessions
  'src/dev',

  // Cosmetic particle/effects systems — affect visuals only, no shared game state
  'src/game/particles',
  'src/game/effects',
  'src/game/systems/CombatAtmosphereSystem.ts',
  'src/game/systems/EnemySpriteSystem.ts',
  'src/game/systems/WeaponAnimationSystem.ts',
  'src/game/systems/StatusEffectVisualSystem.ts',
  'src/game/systems/ScreenShakeSystem.ts',

  // Boot animation — runs before any run state exists
  'src/game/scenes/BootAnimScene.ts',

  // CombatScene: uses Math.random() exclusively for visual FX (particle rain,
  // fragment shards, float animations, ambient dust). No calls affect enemy HP,
  // player HP, card draws, chain outcomes, or any shared game state. All VFX
  // run independently on each client — divergence is both expected and harmless.
  'src/game/scenes/CombatScene.ts',

  // RewardRoomScene: all 28 bare calls are visual FX — particle depth layers,
  // float animation parameters (ampX, ampY, freqX, freqY), orbital radii,
  // ambient orb phases and lifespans. None affect card rewards, gold, or run state.
  'src/game/scenes/RewardRoomScene.ts',

  // UI cosmetic effects — purely presentation
  'src/ui/effects',
  'src/ui/components/DamageNumber.svelte',
  'src/ui/components/SurgeBorderOverlay.svelte',
  'src/ui/components/DomeCanvas.svelte',
  'src/ui/components/HubFireflies.svelte',
  'src/ui/components/HubCursorLight.svelte',
  'src/ui/components/HubMoths.svelte',
  'src/ui/components/GachaReveal.svelte',
  'src/ui/components/NearMissBanner.svelte',

  // HubScreen: all 14 bare calls generate fake "ghost run" preview data shown on
  // the hub menu screen. These values are never persisted or sent to any peer.
  'src/ui/components/HubScreen.svelte',

  // MapPinDrop: 2 calls add cosmetic lat/lng jitter to map pins (visual scatter, no game state).
  'src/ui/components/MapPinDrop.svelte',

  // CosmeticStoreModal: cosmetic loot box dust reward roll — cosmetic currency,
  // not part of co-op game simulation and never synchronized between clients.
  'src/ui/components/CosmeticStoreModal.svelte',

  // SocialScreen: 1 call generates a random suffix for guest social IDs (UI only).
  'src/ui/components/SocialScreen.svelte',

  // StudyTempleScreen: 1 call generates a unique session ID (local study, never in a run).
  'src/ui/components/StudyTempleScreen.svelte',

  // The RNG implementation itself
  'src/services/seededRng.ts',

  // randomUtils.ts: shuffled() uses Math.random() for distractor ordering (presentation).
  // This is explicitly opted in — the ordering of distractors on screen is cosmetic,
  // not part of game state synchronization. If deterministic shuffling is ever needed
  // for co-op (replay, spectator), this entry should be removed and shuffled() updated.
  'src/services/randomUtils.ts',

  // audioService: all 6 bare calls are PCM audio buffer noise generation for synthesized
  // sound effects (white noise, perlin noise for SFX). Audio synthesis is purely local
  // and client-independent — no shared game state involved.
  'src/services/audioService.ts',

  // musicService: 1 call shuffles the local playlist order (cosmetic, local only).
  'src/services/musicService.ts',

  // rewardSpawnService: 2 calls add x/y position jitter to floating reward icons.
  // Visual presentation only — does not affect reward contents or run state.
  'src/services/rewardSpawnService.ts',

  // rewardRoomBridge: all 11 bare calls are inside openTestRewardRoom(), a dev-only
  // function called exclusively from src/dev/scenarioSimulator.ts. It is never
  // invoked during production gameplay sessions.
  'src/services/rewardRoomBridge.ts',

  // socialService: 1 call generates a guest-{random} ID for social profile display.
  // Social identifiers are never synchronized as co-op game state.
  'src/services/socialService.ts',

  // studyPresetService: 1 call generates a unique preset ID for local study sessions.
  // Never runs during a co-op game run.
  'src/services/studyPresetService.ts',

  // eloMatchmakingService: 1 call adds ELO variance to AI opponent generation for
  // single-player fallback matchmaking. No co-op run is involved.
  'src/services/eloMatchmakingService.ts',

  // multiplayerTransport: BroadcastChannel test harness — simulated jitter (5–20ms)
  // and packet loss probability for local integration testing. Deliberately non-
  // deterministic to mimic real network variance. These values never enter game state.
  'src/services/multiplayerTransport.ts',

  // multiplayerWorkshopService: vote tiebreak runs on the host only, then broadcasts
  // the deterministic result to all clients via transport.send(). The randomness is
  // consumed on one machine; all clients receive the same decided winner ID.
  'src/services/multiplayerWorkshopService.ts',

  // multiplayerLobbyService.test.ts: test file only — fake lobby/host IDs for unit tests.
  'src/services/multiplayerLobbyService.test.ts',

  // Cosmetic pet/NPC behavior — no shared state
  'src/data/petWaypoints.ts',
  'src/data/petPersonalities.ts',
  'src/data/shopkeeperBarks.ts',
  'src/data/omniscientQuips.ts',
  'src/data/foregroundElements.ts',
];

/**
 * Specific file:line overrides. Key = "relative/path.ts", Value = Set<lineNumber (1-indexed)>.
 * Use these to silence a single call without allowlisting the whole file.
 * Requires a code comment explaining why at the call site.
 */
const ALLOWLIST_LINES = {
  // analyticsService — client-side A/B sampling, deliberately non-deterministic
  // 'src/services/analyticsService.ts': new Set([142]),

  // multiplayerLobbyService.ts:
  //   72  — generatePlayerId(): local unique player ID suffix (never synced as game state)
  //  553  — startGame() run seed: INTENTIONALLY non-deterministic. Host generates entropy
  //          for the shared run seed and broadcasts it. This IS the seed origin point —
  //          correct behavior. Both clients receive the same seed via the broadcast.
  //  712  — generateLobbyId(): lobby identifier suffix (not game state)
  //  720  — generateLobbyCode(): 6-char join code character selection (not game state)
  'src/services/multiplayerLobbyService.ts': new Set([72, 553, 712, 720]),

  // encounterBridge.ts:
  //   1735 — `reward_${Math.random()}` card ID suffix. Card IDs only need to be locally
  //           unique, not deterministically identical between clients. IDs are never
  //           compared across a co-op session for state synchronization.
  'src/services/encounterBridge.ts': new Set([1735]),

  // ui/stores/playerData.ts:
  //   1564 — cosmetic loot box rarity roll (cosmetic currency; not part of co-op sim)
  'src/ui/stores/playerData.ts': new Set([1564]),
};

// ---------------------------------------------------------------------------
// Guarded pattern detection
// ---------------------------------------------------------------------------

/**
 * Returns true if a Math.random() call on this line is "guarded" — i.e., there
 * is an explicit seeded-RNG check on the same line that uses Math.random() only
 * as a fallback when no seeded RNG is active.
 *
 * Guarded patterns (all on a single line):
 *   (rng ? rng.next() : Math.random())
 *   (_rng ? _rng.next() : Math.random())
 *   (someRng ? someRng.next() : Math.random())
 *   isRunRngActive() ? getRunRng(...).next() : Math.random()
 *   (rngFn ? rngFn() : Math.random())
 *   (this.rng ? this.rng.next() : Math.random())
 *
 * These represent the CORRECT "seeded-with-fallback" pattern and should NOT be
 * flagged as violations. They are already deterministic when a run RNG is active.
 */
function isGuardedPattern(line) {
  // Pattern 1: ternary with a rng variable check on same line
  // Matches: (varName ? varName.next() : Math.random())
  // or:      varName ? varName.next() : Math.random()
  if (/\b\w*[Rr]ng\w*\s*\?\s*\w+\.next\(\)\s*:\s*Math\.random\(\)/.test(line)) {
    return true;
  }

  // Pattern 2: ternary with rngFn function check
  // Matches: (rngFn ? rngFn() : Math.random())
  if (/\b\w*[Rr]ng[Ff]n\w*\s*\?\s*\w+\(\)\s*:\s*Math\.random\(\)/.test(line)) {
    return true;
  }

  // Pattern 3: isRunRngActive() ternary
  // Matches: isRunRngActive() ? getRunRng(...).next() : Math.random()
  if (/isRunRngActive\(\)\s*\?\s*getRunRng\([^)]*\)\.next\(\)\s*:\s*Math\.random\(\)/.test(line)) {
    return true;
  }

  // Pattern 4: general "something ? something : Math.random()" where "something"
  // has any rng/Rng word. Broadened to catch patterns like this._critRng.
  if (/\w*[Rr]ng\w*\s*\?\s*[\w.]+\.next\(\)\s*:\s*Math\.random\(\)/.test(line)) {
    return true;
  }

  // Pattern 5: (rng ? rng() : Math.random()) — callable rng
  if (/\b\w*[Rr]ng\w*\s*\?\s*\w+\(\)\s*:\s*Math\.random\(\)/.test(line)) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// File scanning
// ---------------------------------------------------------------------------

/** Returns true if a file path is in the allowlist. */
function isAllowlisted(filePath) {
  const rel = path.relative(REPO_ROOT, filePath);
  for (const glob of ALLOWLIST_GLOBS) {
    // Match: exact file, or prefix (directory)
    if (rel === glob || rel.startsWith(glob + '/') || rel.startsWith(glob + path.sep)) {
      return true;
    }
  }
  return false;
}

/** Returns true if a specific file:line is explicitly overridden. */
function isLineAllowlisted(filePath, lineNumber) {
  const rel = path.relative(REPO_ROOT, filePath);
  const lines = ALLOWLIST_LINES[rel];
  return lines && lines.has(lineNumber);
}

/** Walk a directory recursively and collect .ts and .svelte files. */
function collectFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, dist, _archived
        if (['node_modules', 'dist', '.svelte-kit', '_archived', '_archived-mining'].includes(entry.name)) continue;
        walk(full);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.svelte')) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Print the allowlist so reviewers can audit it
console.log('[no-bare-math-random] Allowlist (files/dirs permitted to use Math.random()):');
for (const entry of ALLOWLIST_GLOBS) {
  console.log(`  - ${entry}`);
}
if (Object.keys(ALLOWLIST_LINES).length > 0) {
  console.log('  Specific line overrides:');
  for (const [file, lines] of Object.entries(ALLOWLIST_LINES)) {
    console.log(`    ${file}: lines ${[...lines].join(', ')}`);
  }
}
console.log('');

const srcDir = path.join(REPO_ROOT, 'src');
const allFiles = collectFiles(srcDir);

const violations = [];

for (const file of allFiles) {
  if (isAllowlisted(file)) continue;

  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split('\n');

  lines.forEach((line, idx) => {
    // Skip pure comments
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

    if (!line.includes('Math.random()')) return;

    const lineNumber = idx + 1;

    // Check line-level allowlist
    if (isLineAllowlisted(file, lineNumber)) return;

    // Check for inline no-lint comment
    if (line.includes('// no-bare-math-random:ignore') || line.includes('/* no-bare-math-random:ignore */')) return;

    // Skip guarded patterns — seeded-RNG-with-fallback is CORRECT, not a violation
    if (isGuardedPattern(line)) return;

    const rel = path.relative(REPO_ROOT, file);
    violations.push({
      file: rel,
      line: lineNumber,
      text: line.trim(),
    });
  });
}

if (violations.length === 0) {
  console.log('[no-bare-math-random] PASS — No bare Math.random() calls found in gameplay code.\n');
  console.log('  Scanned:', allFiles.length, 'files (src/**/*.ts, src/**/*.svelte)');
  console.log('  Allowlisted:', ALLOWLIST_GLOBS.length, 'entries');
  console.log('  Guarded (seeded-with-fallback) patterns skipped — these are correct.\n');
  process.exit(0);
}

console.error(`[no-bare-math-random] FAIL — ${violations.length} bare Math.random() violation(s) found:\n`);
console.error('  Note: "bare" means NO seeded-RNG fallback on the same line.');
console.error('  Guarded patterns like (rng ? rng.next() : Math.random()) are correct and skipped.\n');

for (const v of violations) {
  console.error(`  ERROR ${v.file}:${v.line} bare-math-random`);
  console.error(`    ${v.text}`);
  console.error(`    Fix: isRunRngActive() ? getRunRng('<bucket>').next() : Math.random()`);
  console.error(`    Or: add this file to ALLOWLIST_GLOBS in scripts/lint/no-bare-math-random.mjs with rationale.`);
  console.error('');
}

console.error('[no-bare-math-random] Co-op clients share a run seed. Bare Math.random() diverges between');
console.error('clients, causing delta desync (enemy HP, relic outcomes, reward offers differ between peers).\n');
console.error('Reference: docs/mechanics/multiplayer.md §RNG determinism invariant');
console.error('           BATCH-2026-04-11-ULTRA/correlation-report.md Cluster D\n');

process.exit(1);
