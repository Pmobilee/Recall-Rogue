# AR-06: Knowledge Library + Lore
> Phase: Pre-Launch — Meta-Progression
> Priority: MEDIUM
> Depends on: AR-02 (FSRS Migration — for PlayerFactState, tier derivation, stability tracking)
> Estimated scope: M

Make learning progress visible and rewarding. The Knowledge Library catalogs every fact the player has encountered, organized by domain with mastery progress. Lore Discoveries reward mastery milestones with narrative fragments. Fact detail view shows comprehensive stats.

## Design Reference

From GAME_DESIGN.md Section 13 (Meta-Progression — Knowledge Library):

> All facts cataloged by domain + mastery; lore entries expand on mastery. Domain completion percentage.

From GAME_DESIGN.md Section 13a (Lore Discovery System):

> Mastery milestones (10th, 25th, 50th, 100th mastered fact) unlock a Lore Fragment — a short, fascinating narrative connecting multiple facts the player has learned.
>
> Example: After mastering 10 Chemistry facts: "The Alchemist's Dream — For centuries, alchemists tried to turn lead (atomic number 82) into gold (atomic number 79). They failed because transmuting elements requires nuclear reactions, not chemical ones. In 1980, scientists finally succeeded using a particle accelerator — but the gold cost $1 quadrillion per ounce."
>
> Presentation: Full-screen, pixel art illustration, atmospheric sound, "Share" button.

From GAME_DESIGN.md Section 5 (Card Tiers):

> Tier 1 (Learning): stability <5d
> Tier 2a (Recall): stability 5-15d, 3+ correct
> Tier 2b (Deep Recall): stability 15-30d, 5+ correct
> Tier 3 (Mastered): stability 30d+, 7 consecutive correct, passed mastery trial

## Implementation

### Sub-task 1: Knowledge Library Main Screen

#### Data Model

```typescript
interface LibraryDomainSummary {
  domain: FactDomain;
  totalFacts: number;          // All facts in this domain (from DB)
  encounteredFacts: number;    // Facts the player has seen at least once
  tier1Count: number;          // Learning
  tier2aCount: number;         // Recall
  tier2bCount: number;         // Deep Recall
  tier3Count: number;          // Mastered
  completionPercent: number;   // tier3Count / totalFacts * 100
  masteryPercent: number;      // (tier2a + tier2b + tier3) / encounteredFacts * 100
}

interface LibraryFactEntry {
  fact: Fact;                  // From facts DB
  playerState: PlayerFactState | null;  // null if never encountered
  tier: '1' | '2a' | '2b' | '3' | 'unseen';
}
```

#### Logic

In `src/services/libraryService.ts`:

```typescript
export function buildDomainSummaries(
  allFacts: Fact[],
  playerStates: Map<string, PlayerFactState>
): LibraryDomainSummary[] {
  const domains = new Set(allFacts.map(f => f.domain));
  return [...domains].map(domain => {
    const domainFacts = allFacts.filter(f => f.domain === domain);
    const encountered = domainFacts.filter(f => playerStates.has(f.id));
    const states = encountered.map(f => playerStates.get(f.id)!);

    return {
      domain,
      totalFacts: domainFacts.length,
      encounteredFacts: encountered.length,
      tier1Count: states.filter(s => getCardTier(s) === '1').length,
      tier2aCount: states.filter(s => getCardTier(s) === '2a').length,
      tier2bCount: states.filter(s => getCardTier(s) === '2b').length,
      tier3Count: states.filter(s => getCardTier(s) === '3').length,
      completionPercent: Math.round(states.filter(s => getCardTier(s) === '3').length / domainFacts.length * 100),
      masteryPercent: encountered.length > 0
        ? Math.round(states.filter(s => ['2a','2b','3'].includes(getCardTier(s))).length / encountered.length * 100)
        : 0,
    };
  });
}

export function getFactsForDomain(
  domain: FactDomain,
  allFacts: Fact[],
  playerStates: Map<string, PlayerFactState>,
  filter?: { tier?: string; sortBy?: 'name' | 'tier' | 'accuracy' | 'lastReview' }
): LibraryFactEntry[] {
  return allFacts
    .filter(f => f.domain === domain)
    .map(f => {
      const state = playerStates.get(f.id);
      return {
        fact: f,
        playerState: state ?? null,
        tier: state ? getCardTier(state) : 'unseen',
      };
    })
    .sort(/* by filter.sortBy */);
}
```

#### UI — `KnowledgeLibrary.svelte`

**Main view (domain list):**
```
┌──────────────────────────┐
│  📚 KNOWLEDGE LIBRARY     │
│                           │
│  ┌─────────────────────┐ │
│  │ 🔬 Science          │ │
│  │ 42/120 mastered     │ │
│  │ ████████░░░░ 35%    │ │
│  └─────────────────────┘ │
│  ┌─────────────────────┐ │
│  │ 📜 History          │ │
│  │ 28/95 mastered      │ │
│  │ ██████░░░░░░ 29%    │ │
│  └─────────────────────┘ │
│  ┌─────────────────────┐ │
│  │ 🌍 Geography        │ │
│  │ 15/80 mastered      │ │
│  │ ████░░░░░░░░ 19%    │ │
│  └─────────────────────┘ │
│                           │
│  Total mastered: 85/295   │
│  🔥 Lore unlocked: 3/4   │
│                           │
│  [Back to Menu]           │
└──────────────────────────┘
```

- Each domain is a tappable card
- Domain icon (from AR-03) + name + mastery count + progress bar
- Progress bar: color gradient by completion (red <25%, yellow 25-50%, green 50-75%, gold 75-100%)
- Total mastered count at bottom
- Lore unlocked count (links to lore gallery)
- Accessible from main menu (new nav button: "Library")

**Domain detail view (fact list):**
```
┌──────────────────────────┐
│  ← 🔬 Science (42/120)   │
│                           │
│  Filter: [All▾] Sort: [Tier▾]│
│                           │
│  ┌─────────────────────┐ │
│  │ ★★★ Gold (79)       │ │
│  │ Tier 3 ● Mastered   │ │
│  │ 95% accuracy         │ │
│  └─────────────────────┘ │
│  ┌─────────────────────┐ │
│  │ ★★ Photosynthesis   │ │
│  │ Tier 2b ● Deep Recall│ │
│  │ 78% accuracy         │ │
│  └─────────────────────┘ │
│  ┌─────────────────────┐ │
│  │ ★ Mitosis           │ │
│  │ Tier 1 ● Learning    │ │
│  │ 60% accuracy         │ │
│  └─────────────────────┘ │
│  ┌─────────────────────┐ │
│  │ ○ DNA Structure      │ │
│  │ Unseen               │ │
│  └─────────────────────┘ │
│                           │
│  Showing 1-20 of 120     │
└──────────────────────────┘
```

- Filter dropdown: All, Tier 1, Tier 2a, Tier 2b, Tier 3, Unseen
- Sort dropdown: Name (A-Z), Tier (high→low), Accuracy (high→low), Last Review (recent first)
- Each fact row: fact name, tier badge (color-coded), accuracy percentage
- Unseen facts: dimmed, no stats
- Tap fact → opens fact detail view
- Pagination or virtual scroll for large domain lists (120+ facts)

### Sub-task 2: Fact Detail View

#### UI — `FactDetail.svelte`

```
┌──────────────────────────┐
│  ← Gold (Au)              │
│  Domain: Science          │
│  Tier: ★★★ Mastered      │
│                           │
│  ─── Question Variants ── │
│  1. "The atomic number    │
│     of gold is ___?"      │
│  2. "Which element has    │
│     atomic number 79?"    │
│  3. "Au (gold) is in      │
│     which row?"           │
│                           │
│  ─── Stats ────────────── │
│  Attempts: 23             │
│  Correct: 19 (83%)        │
│  Avg Response: 4.2s       │
│  Streak: 7 consecutive ✓  │
│                           │
│  ─── FSRS State ───────── │
│  Stability: 34.2 days     │
│  Difficulty: 3.1/10       │
│  Next Review: Mar 15      │
│  Retrievability: 0.91     │
│                           │
│  ─── Tier History ─────── │
│  T1 → T2a (Feb 12)       │
│  T2a → T2b (Feb 20)      │
│  T2b → T3 (Mar 2) ★      │
│                           │
│  [Back to Domain]         │
└──────────────────────────┘
```

- Question variants listed (all 2-4 variants from fact data)
- Stats from PlayerFactState: totalAttempts, totalCorrect, accuracy %, averageResponseTimeMs, consecutiveCorrect
- FSRS state: stability (days), difficulty (1-10), next review date, retrievability (0-1)
- Tier history: track tier transitions with dates. Store as array in PlayerFactState:

```typescript
interface TierTransition {
  from: string;   // '1', '2a', '2b', '3'
  to: string;
  date: number;   // Unix timestamp ms
}

// Add to PlayerFactState:
tierHistory: TierTransition[];
```

### Sub-task 3: Lore Discovery System

#### Data Model

```typescript
interface LoreFragment {
  id: string;
  title: string;                // "The Alchemist's Dream"
  body: string;                 // Full narrative text (100-200 words)
  unlockThreshold: number;      // Total mastered facts needed (10, 25, 50, 100)
  domain?: FactDomain;          // Optional: domain-specific lore
  relatedFactIds: string[];     // Facts referenced in the narrative
}

interface LoreState {
  unlockedLoreIds: string[];
  totalMasteredFacts: number;
  lastMilestoneReached: number;  // 0, 10, 25, 50, 100
}
```

#### Lore Content (4 milestone fragments)

```typescript
const LORE_FRAGMENTS: LoreFragment[] = [
  {
    id: 'lore_10',
    title: 'The Alchemist\'s Dream',
    body: 'For centuries, alchemists tried to turn lead (atomic number 82) into gold (atomic number 79). They failed because transmuting elements requires nuclear reactions, not chemical ones. In 1980, scientists finally succeeded using a particle accelerator — but the gold cost $1 quadrillion per ounce. The dream was achievable. The economics were not.',
    unlockThreshold: 10,
    relatedFactIds: ['gold_atomic', 'lead_atomic', 'nuclear_reaction'],
  },
  {
    id: 'lore_25',
    title: 'The Map That Changed Everything',
    body: 'In 1569, Gerardus Mercator created a map projection that made straight-line navigation possible for sailors. The cost? Greenland appears as large as Africa, though Africa is 14 times bigger. Every world map you\'ve seen is a beautiful, necessary lie — trading accuracy for utility. Four centuries later, we still haven\'t agreed on a replacement.',
    unlockThreshold: 25,
    relatedFactIds: ['mercator_projection', 'greenland_size', 'africa_size'],
  },
  {
    id: 'lore_50',
    title: 'The Unbreakable Code',
    body: 'During World War II, the U.S. Marine Corps used Navajo speakers as code talkers. The Navajo language had no written form, no alphabet, and fewer than 30 non-Navajo speakers in the world. Japanese codebreakers, who had cracked every other American code, never broke Navajo. The most secure encryption in history wasn\'t a machine — it was a living language.',
    unlockThreshold: 50,
    relatedFactIds: ['navajo_code', 'ww2_pacific', 'encryption_history'],
  },
  {
    id: 'lore_100',
    title: 'The Library That Remembers',
    body: 'The Library of Alexandria held an estimated 400,000 scrolls — the largest collection of human knowledge in the ancient world. When it burned, centuries of irreplaceable thought vanished. But here\'s what most people don\'t know: it wasn\'t destroyed in a single fire. It declined over centuries through neglect, budget cuts, and political indifference. The lesson isn\'t that knowledge can be destroyed by catastrophe — it\'s that it erodes when no one bothers to maintain it. You\'ve now mastered 100 facts. You are the library that remembers.',
    unlockThreshold: 100,
    relatedFactIds: ['library_alexandria', 'ancient_scrolls'],
  },
];
```

#### Logic

In `src/services/loreService.ts`:

```typescript
export function checkLoreUnlock(
  loreState: LoreState,
  totalMastered: number,
  fragments: LoreFragment[]
): LoreFragment | null {
  const milestones = [10, 25, 50, 100];
  for (const milestone of milestones) {
    if (totalMastered >= milestone && loreState.lastMilestoneReached < milestone) {
      const fragment = fragments.find(f => f.unlockThreshold === milestone);
      if (fragment && !loreState.unlockedLoreIds.includes(fragment.id)) {
        return fragment;
      }
    }
  }
  return null;
}

export function unlockLore(loreState: LoreState, fragment: LoreFragment): LoreState {
  return {
    ...loreState,
    unlockedLoreIds: [...loreState.unlockedLoreIds, fragment.id],
    lastMilestoneReached: fragment.unlockThreshold,
  };
}
```

Check for lore unlock after every mastery trial success (in `encounterBridge.ts`).

#### UI — `LoreDiscovery.svelte`

**Unlock presentation (full-screen overlay):**
```
┌──────────────────────────────┐
│                              │
│     ✦ LORE DISCOVERED ✦     │
│                              │
│  ╔══════════════════════╗    │
│  ║                      ║    │
│  ║  [Pixel art image]   ║    │
│  ║                      ║    │
│  ╚══════════════════════╝    │
│                              │
│  The Alchemist's Dream       │
│                              │
│  For centuries, alchemists    │
│  tried to turn lead into     │
│  gold...                     │
│                              │
│  [Share]        [Continue]   │
└──────────────────────────────┘
```

- Full-screen dark overlay with subtle particle animation
- Title in gold pixel font, 20dp
- Body text in 14dp, white, max 280dp width, center-aligned
- Pixel art illustration placeholder (200×150dp) — can be solid dark rectangle for now
- Share button: generates image similar to run summary share (lore title + quote + "Recall Rogue")
- Continue button: dismisses overlay, returns to previous screen
- Sound: atmospheric chime (reuse `turn-chime.ogg` from AR-05 or dedicated lore sound)

**Lore Gallery (from Knowledge Library):**
- Accessible via "Lore" tab/button in Knowledge Library
- Grid of lore cards: unlocked show title + thumbnail, locked show "???" + milestone requirement
- Tap unlocked lore → re-read full presentation
- 4 total lore fragments at launch

### System Interactions

- **FSRS (AR-02):** Library reads `PlayerFactState` for all tier/stats data. Uses `getCardTier()` for tier badges.
- **Tier derivation (AR-02):** Tier history requires recording transitions. Add to `fsrsScheduler.reviewFact()`: if tier changed, append to `tierHistory[]`.
- **Mastery trial:** On Tier 3 graduation, check lore unlock. If new milestone reached, queue lore presentation.
- **Passive relics:** Mastered facts with relics show relic icon in fact detail view.
- **Domain icons (AR-03):** Library domain cards use domain icons.
- **Run pool builder:** No interaction. Library is read-only.
- **Bounty system (AR-05):** No interaction.
- **Combo system:** No interaction.

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Player has 0 encountered facts | Library shows all domains with 0/N mastered. All facts listed as "Unseen". |
| Domain has 0 facts in DB | Domain not shown in library. |
| Fact has no variants | Detail view shows "No question variants" (defensive). |
| PlayerFactState missing for encountered fact | Treat as Tier 1 with 0 stats. Log warning. |
| Lore unlocked during combat (mastery trial) | Queue lore presentation. Show AFTER encounter resolves (not interrupting combat). |
| Player already at 10 mastered, loads new version with lore | Check on app launch: if totalMastered >= milestone and lore not unlocked, trigger presentation. |
| Tier history array empty (migrated from old save) | Show "No tier history available" in detail view. |
| 200+ facts in a domain | Virtual scroll or pagination (20 per page). |
| Retrievability exactly 0.7 | NOT dormant (threshold is <0.7). Show as active. |
| Player taps Share on lore but Share API unavailable | Download PNG fallback. |

## Files

| Action | File | What Changes |
|--------|------|-------------|
| Create | `src/ui/components/KnowledgeLibrary.svelte` | Main library screen: domain list, progress bars |
| Create | `src/ui/components/DomainDetail.svelte` | Fact list for a domain with filter/sort |
| Create | `src/ui/components/FactDetail.svelte` | Individual fact stats, variants, FSRS state, tier history |
| Create | `src/ui/components/LoreDiscovery.svelte` | Full-screen lore unlock presentation |
| Create | `src/ui/components/LoreGallery.svelte` | Grid of unlocked/locked lore fragments |
| Create | `src/services/libraryService.ts` | Domain summaries, fact filtering/sorting |
| Create | `src/services/loreService.ts` | Lore unlock checks, state management |
| Create | `src/data/lore-fragments.ts` | 4 lore fragment definitions |
| Modify | `src/data/types.ts` | LibraryDomainSummary, LibraryFactEntry, LoreFragment, LoreState, TierTransition interfaces |
| Modify | `src/services/fsrsScheduler.ts` | Record TierTransition on tier change in reviewFact() |
| Modify | `src/services/gameFlowController.ts` | Add 'library' screen state, navigation from main menu |
| Modify | `src/services/encounterBridge.ts` | Check lore unlock after mastery trial |
| Modify | `src/services/saveService.ts` | Persist LoreState, tier history |
| Modify | `src/ui/components/MainMenu.svelte` or equivalent | Add "Library" navigation button |

## Done When

- [ ] Knowledge Library accessible from main menu via "Library" button
- [ ] Domain list shows all domains with: icon, name, mastered count, total count, progress bar
- [ ] Progress bar color: red <25%, yellow 25-50%, green 50-75%, gold 75-100%
- [ ] Tap domain → fact list with filter (All/T1/T2a/T2b/T3/Unseen) and sort (Name/Tier/Accuracy/LastReview)
- [ ] Unseen facts shown dimmed with no stats
- [ ] Tap fact → detail view with: all question variants, attempt/accuracy/response time stats, FSRS state, tier history
- [ ] Tier transitions recorded with timestamps in PlayerFactState
- [ ] Lore fragment unlocks at 10/25/50/100 mastered facts
- [ ] Lore presentation: full-screen overlay with title, body text, share button
- [ ] Lore gallery shows unlocked (readable) and locked (milestone requirement) fragments
- [ ] Share generates PNG image for lore (title + quote text)
- [ ] Lore unlock queued during combat, shown after encounter resolves
- [ ] `npx vitest run` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
