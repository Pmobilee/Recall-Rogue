### 2026-04-03 — Vite Cache Corruption After Dev Server Restart

**What happened:** After restarting the dev server (`npm run dev`) to pick up new static assets in `public/`, the hub camp sprites rendered at full viewport size instead of their normal portrait-constrained layout. The `.hub-landscape` CSS rule (`position: fixed; inset: 0; display: flex; overflow: hidden`) was completely missing from the compiled CSS — Svelte's scoped class hash changed but the old compiled output was served from cache.

**Root cause:** Stale Vite transform cache in `node_modules/.vite`. When the dev server restarts, Svelte component CSS scope hashes can change, but Vite may serve stale compiled modules where the hash doesn't match.

**Fix:** Clear the Vite cache before restarting:
```bash
rm -rf node_modules/.vite && npm run dev
```

**Rule:** Always clear `node_modules/.vite` when restarting the dev server, especially after adding new files to `public/` or after the server was killed and restarted. A hard browser refresh (Cmd+Shift+R) alone is NOT sufficient — the corruption is server-side.

**What to keep:** `card.tier` field stays on the Card interface (quiz difficulty uses it). `isMastered = card.tier === '3'` check stays (hides charge button on fully memorized cards). `card-tier-label--mastered` ("MASTERED" text label) stays as informational text. All mastery glow/color logic (`hasMasteryGlow()`, `getMasteryIconFilter()`) stays unchanged.

### 2026-04-04 — Pool Homogeneity Check Added (Check #20)

**What:** Added check #20 to `scripts/verify-all-decks.mjs` detecting answer pools where the max/min length ratio of non-bracket answers exceeds 3x (FAIL) or 2x (WARN). This catches pools mixing very short answers ("Sue", 3 chars) with long answers ("Brachiosaurus skeleton", 20+ chars) — these make the correct answer trivially guessable.

**Why it matters:** The quiz-audit.mjs length_mismatch check only fires per-fact when a specific question is sampled. The new check #20 fires at the pool level in the structural verifier, catching the root cause: the pool itself is heterogeneous. Pool homogeneity failures are widespread across existing decks (virtually every knowledge deck has at least one).

**Remediation status:** All existing decks fail check #20. Remediation requires splitting broad pools (e.g. `person_names`) into domain-specific sub-pools, or adding `syntheticDistractors` to fill the gap. The corresponding unit test (`pool members should have similar answer lengths` in `deck-content-quality.test.ts`) is currently `it.skip` until batch remediation is complete.

**Thresholds:**
- `verify-all-decks.mjs` check #20: FAIL > 3x ratio, WARN > 2x ratio (per pool)
- `deck-content-quality.test.ts`: 4x ratio threshold (more lenient, unskip after remediation)

**Bracket-number answers are excluded** from both checks — numerical distractors are generated algorithmically and always match in length.
