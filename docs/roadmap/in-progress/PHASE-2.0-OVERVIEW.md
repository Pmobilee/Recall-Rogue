# Phase 2: Knowledge System Expansion — Overview

**Status**: In Progress (started 2026-02-28)
**Goal**: Transform from vocab quiz to full knowledge game

## Sub-Phases

### 2.1 Real Facts Content — COMPLETE
- [x] Generate 100+ high-quality facts across all 7 categories (122 facts across 6 categories)
- [x] Expand to 25 distractors per fact (all facts now have 24-25 distractors)
- [x] Populate `wowFactor` field for all facts
- [x] Add `explanation` depth pass (all facts have explanations)
- [x] Add `sourceName` attribution
- [x] Validate age-rating system (getByAgeRating and getRandomFiltered methods added to factsDB)
- [x] Build generation/validation scripts (done via AI agents, no script file needed)

### 2.2 Knowledge Tree Visualization — COMPLETE
- [x] Design tree data model (categories → branches → leaves)
- [x] Build Svelte Knowledge Tree component
- [x] Leaf color progression by mastery level
- [x] Wilting visual for facts needing review
- [x] Integrate into BaseView navigation
- [x] Completion percentages per branch (shows learned/total per category)
- [x] Branch thickness grows with category completion (stroke-width scales 2-8px, color shifts brown→green by ratio)

### 2.3 GAIA Personality — IN PROGRESS
- [ ] Avatar sprite generation
- [ ] Dialogue system design
- [x] Pre-generate gaiaComment for facts (all 122 general facts have gaiaComment)
- [x] Contextual comments during gameplay (GaiaToast + GameManager triggers)
- [ ] Mnemonic suggestions for struggling facts

### 2.4 Pixel Art Per Fact — DEFERRED (moved to post-launch polish)
Deprioritized in favor of structural gameplay features. See Phase 11 in PROGRESS.md.

## Dependencies
- 2.3 partially depends on 2.1 (need facts for gaiaComment)
- 2.2 is independent (works with existing fact data structure)
