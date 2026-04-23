#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const LB_PATH = 'data/playtests/leaderboard.json';
const VERIFY_DATE = '2026-04-23T12:30:00.000Z';
const SWEEP_ID = 'VERIFY-2026-04-23-POST-WAVE';

const updates = [
  // --- FIXED (20) ---
  { id:'MP-STEAM-AUDIT-2026-04-22-M-022', verdict:'fixed', commit:'5acc55df9', note:'pickBackend() throws when isDesktop=true and isTauriPresent()=false' },
  { id:'MP-STEAM-AUDIT-2026-04-22-M-023', verdict:'fixed', commit:'5acc55df9', note:'LAN_DISABLED_IN_STEAM gates all LAN services; ?lan=1 escape hatch' },
  { id:'MP-STEAM-AUDIT-2026-04-22-M-025', verdict:'fixed', commit:'5acc55df9', note:'BARRIER_TIMEOUT_MS 45000→15000 across both barrier functions' },
  { id:'MP-STEAM-20260422-026', verdict:'fixed', commit:'8f5d7a74b', note:'localStateMap snapshot preserves isReady/connectionState/mpRating across Object.assign' },
  { id:'MP-STEAM-20260422-036', verdict:'fixed', commit:'8f5d7a74b', note:'startRosterReconciliation() 5s setInterval wired at createLobby' },
  { id:'MP-STEAM-20260422-037', verdict:'fixed', commit:'8f5d7a74b', note:'_settingsSeq monotonic sequence; guest rejects stale seq' },
  { id:'MP-STEAM-20260422-058', verdict:'fixed', commit:'8f5d7a74b', note:'throw on local_player/empty playerId in create/join paths' },
  { id:'MP-STEAM-20260422-066', verdict:'fixed', commit:'8f5d7a74b', note:'setDeckSelectionMode clears orphan path on mode switch' },
  { id:'MP-STEAM-20260422-067', verdict:'fixed', commit:'8f5d7a74b', note:'handler-attached guard keys on (flag AND transport instance)' },
  { id:'MP-STEAM-20260422-070', verdict:'fixed', commit:'8f5d7a74b', note:'startGame gate uses connectedCount (excludes reconnecting) < 2' },
  { id:'MP-STEAM-20260422-047', verdict:'fixed', commit:'0c2de9290', note:'turn-bucketed _collectedDeltas Map<turnNum,Map<playerId,delta>>' },
  { id:'MP-STEAM-20260422-071', verdict:'fixed', commit:'0c2de9290', note:'protected preSendBuffer eviction; cap 64→256' },
  { id:'MP-STEAM-20260422-021', verdict:'fixed', commit:'2e25b6765', note:'assertLocalSteamIdUniqueInLobby() surfaces dup SteamID error' },
  { id:'MP-STEAM-20260422-040', verdict:'fixed', commit:'884d603a7', note:'steam_check_lobby_membership registered in main.rs:139 (mis-attributed to agent C)' },
  { id:'MP-STEAM-20260422-041', verdict:'fixed', commit:'c9d24721d', note:'SetStdHandle for Windows stdout/stderr; verified still present' },
  { id:'MP-STEAM-20260422-044', verdict:'fixed', commit:'884d603a7', note:'tauri.conf.json security.csp=null' },
  { id:'MP-STEAM-20260422-060', verdict:'fixed', commit:'884d603a7', note:'active_lobby_id guard at top of LobbyChatUpdate closure — all arms filtered' },
  { id:'MP-STEAM-20260422-049', verdict:'fixed', commit:'49cfc15b7', note:'SECURITY.md checklist + steam-verify.sh MARKERS/STALE_MARKERS grep' },
  { id:'MP-STEAM-20260422-052', verdict:'fixed', commit:'49cfc15b7', note:'primeP2PSessions Fire-and-Forget section replaces misleading docs' },
  { id:'MP-STEAM-20260422-053', verdict:'fixed', commit:'49cfc15b7', note:'SKILL.md stale "all criticals closed" replaced with Wave 22 hardening table' },

  // --- PARTIAL (14) ---
  { id:'MP-STEAM-20260422-025', verdict:'partial', commit:'8f5d7a74b', note:'steam: placeholder removed; peer-left matcher still mismatches player_xxx IDs — ghost-player leak persists' },
  { id:'MP-STEAM-20260422-034', verdict:'partial', commit:'8f5d7a74b', note:'JSDoc only; CardApp already cleaned up correctly; no structural dedup guard in service' },
  { id:'MP-STEAM-20260422-030', verdict:'partial', commit:'0c2de9290', note:'Envelope + recv filter built, but setActiveLobby() not called from normal join paths — filter INERT in production' },
  { id:'MP-STEAM-20260422-032', verdict:'partial', commit:'0c2de9290', note:'Interface wiring + JSDoc only; primeP2PSessions-before-first-send race not addressed' },
  { id:'MP-STEAM-20260422-064', verdict:'partial', commit:'0c2de9290', note:'setActiveLobby promoted to interface but only wired in reestablish path; normal join/leave unwired' },
  { id:'MP-STEAM-AUDIT-2026-04-22-PASS1-BUG-5', verdict:'partial', commit:'0c2de9290', note:'Observability added; single-peer architecture unchanged; Map<peerId,SessionState> deferred' },
  { id:'MP-STEAM-20260422-054', verdict:'partial', commit:'2e25b6765', note:'DLL size check (<100KB) + version log, but no hash pin against known-good' },
  { id:'MP-STEAM-20260422-056', verdict:'partial', commit:'2e25b6765', note:'Rust callback + getPendingP2PFail() exported but ZERO CALLERS; TODO(H10-transport) persists' },
  { id:'MP-STEAM-20260422-059', verdict:'partial', commit:'2e25b6765', note:'Documented as upstream steamworks-rs 0.12.2 bug; Option<()> unchanged — behavior still broken' },
  { id:'MP-STEAM-AUDIT-2026-04-22-M-020', verdict:'partial', commit:'2e25b6765', note:'accept() return stored + getter exported; but callback may never fire due to 059 — dead at runtime' },
  { id:'MP-STEAM-AUDIT-2026-04-22-PASS1-BUG-21', verdict:'partial', commit:'2e25b6765', note:'getDebugLogPath() exported but ZERO UI callers — Settings/About surface not implemented' },
  { id:'MP-STEAM-20260422-010', verdict:'partial', commit:'49cfc15b7', note:'vite.config.ts CSP hardcode unchanged; docs-only update adds trap section + action checklist' },
  { id:'MP-STEAM-20260422-013', verdict:'partial', commit:'49cfc15b7', note:'DEFAULT_MP_WS_URL localhost unchanged; steam-build.sh no VITE_MP_WS_URL override; docs-only' },
  { id:'MP-20260413-003941-MP-012', verdict:'partial', commit:'9700017d9', note:'src/csp.ts deleted in 9700017d9; agent-routing.md:36 still lists it (orchestrator cleanup pending)' },

  // --- NOT_FIXED (4) — reverted from in_progress, claims invalid ---
  { id:'MP-STEAM-AUDIT-2026-04-22-PASS1-BUG-12', verdict:'open', commit:null, note:'[2026-04-23 verify] NOT FIXED by 8f5d7a74b — explicitly deferred; requires transport.send() Promise<boolean> refactor' },
  { id:'MP-STEAM-20260422-048', verdict:'open', commit:null, note:'[2026-04-23 verify] NOT FIXED by 0c2de9290 — encounterBridge.ts:1588-1595 unchanged; explicitly deferred' },
  { id:'MP-STEAM-AUDIT-2026-04-22-PASS1-BUG-19', verdict:'open', commit:null, note:'[2026-04-23 verify] NOT FIXED by 0c2de9290 — _currentLobby still mutated in-place at 15+ sites; Red-zone deferral' },
  { id:'MP-STEAM-20260422-055', verdict:'open', commit:null, note:'[2026-04-23 verify] NOT FIXED by 2e25b6765 — TS wiring deferred; TODO(reconnect) at multiplayerTransport.ts:1312 persists' },

  // --- CREDIT CORRECTION (1) — 057 was fixed by 77c71eaca, not 8f5d7a74b ---
  { id:'MP-STEAM-20260422-057', verdict:'fixed', commit:'77c71eaca', note:'[2026-04-23 verify] Credit corrected: cast removal landed in 77c71eaca (BUG-1/2/3/4/14), not 8f5d7a74b which added zero bytes for this' },

  // --- OLDER MP-20260413 BATCH — discovered via 0d017edee mis-staged Svelte investigation ---
  { id:'MP-20260413-003941-MP-003', verdict:'fixed', commit:'0d017edee', note:'[2026-04-23 verify] CardApp.svelte:820 polarity-inverted lobbyTerminatingScreens clears currentLobby on multiplayerMenu return' },
  { id:'MP-20260413-003941-MP-004', verdict:'fixed', commit:'cdbf6dcbc', note:'[2026-04-23 verify] BUG 22 — Set-based _onLobbyUpdate restored Svelte reactivity, unblocking ready toggle' },
  { id:'MP-20260413-003941-MP-005', verdict:'fixed', commit:'cdbf6dcbc', note:'[2026-04-23 verify] BUG 22 — same Set-based fix restored player-list sync to host UI' },
  { id:'MP-20260413-003941-MP-009', verdict:'partial', commit:'0d017edee', note:'[2026-04-23 verify] sync-health banner added at CardApp:1019 for onPartnerUnresponsive; deck picker row-click still broken' },
];

// --- Patch ---
const lb = JSON.parse(fs.readFileSync(LB_PATH, 'utf8'));
const issuesById = new Map(lb.issues.map(i => [i.canonicalId, i]));

let missing = [];
for (const u of updates) {
  const issue = issuesById.get(u.id);
  if (!issue) { missing.push(u.id); continue; }
  issue.status = u.verdict; // 'fixed' | 'partial' | 'open'
  if (u.verdict === 'fixed') issue.fixedInCommit = u.commit;
  else if (u.verdict === 'partial') issue.partialInCommit = u.commit;
  else if (u.verdict === 'open') { delete issue.fixedInCommit; delete issue.partialInCommit; }
  issue.verifiedAt = VERIFY_DATE;
  issue.verifiedBy = SWEEP_ID;
  // Append to note (preserve prior)
  const prior = issue.note ? (issue.note + ' | ') : '';
  issue.note = prior + '[2026-04-23] ' + u.note;
}

if (missing.length) {
  console.error('MISSING canonicalIds:', missing);
  process.exit(1);
}

// Recompute counts
const fixedStatuses = new Set(['resolved','fixed','closed']);
const open = lb.issues.filter(i => !fixedStatuses.has(i.status));
const resolved = lb.issues.filter(i => fixedStatuses.has(i.status));
lb.openCount = open.length;
lb.resolvedCount = resolved.length;
lb.totalIssues = lb.issues.length;
lb.updatedAt = VERIFY_DATE;

// Top-level note
const existingNote = lb._note || '';
lb._note = (existingNote ? existingNote + '\n' : '') +
  `2026-04-23 VERIFY-POST-WAVE sweep: audited 39 issues across 5 fix-commits (5acc55df9,8f5d7a74b,0c2de9290,2e25b6765,49cfc15b7). Result: 20 fixed, 14 partial, 4 reverted to open, 1 credit corrected. See docs/gotchas.md for the two parallel-agent commit races surfaced.`;

fs.writeFileSync(LB_PATH, JSON.stringify(lb, null, 2) + '\n');
console.log('✓ Patched', updates.length, 'issues');
console.log('  openCount:', lb.openCount, '(was 91)');
console.log('  resolvedCount:', lb.resolvedCount, '(was 87)');
console.log('  totalIssues:', lb.totalIssues);
