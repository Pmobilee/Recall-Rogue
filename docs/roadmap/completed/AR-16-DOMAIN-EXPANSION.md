# AR-16: Domain Expansion

**Phase ID:** AR-16
**Title:** Domain Expansion — Extend Knowledge Domains from 7 to 11
**Status:** Not Started
**Last Updated:** 2026-03-09

---

## Overview

### Goal
Add 6 new knowledge domains and refactor the game's category system to support 11 distinct knowledge domains plus a language domain. This is a pure code phase — no content generation, no API keys. All systems that reference categories (`CATEGORIES` constant, biome affinities, UI components, run pool builders) must be updated to recognize and handle the new domains.

**New Domains to Add:**
1. Space & Astronomy (previously merged into Natural Sciences)
2. Mythology & Folklore (new)
3. Animals & Wildlife (previously part of Life Sciences)
4. Human Body & Health (previously merged into Life Sciences)
5. Food & World Cuisine (new)
6. Art & Architecture (new)

**Old Domains Being Reorganized:**
- Life Sciences → split into Natural Sciences + Animals & Wildlife + Human Body & Health
- Technology → merged into General Knowledge
- Culture → absorbed into specific new domains

### Dependencies
- **None** — can start immediately
- Does not block other phases, complements AR-15 in parallel
- Must be complete before any content for new domains is added

### Estimated Complexity
- **Medium** — 2-3 days
- Primary work: TypeScript type updates, UI component updates, configuration changes
- No Phaser scene changes; no Svelte rune complexity
- Moderate testing required (unit tests + visual verification)

### API Keys Required
- **None**

### Output Artifacts
1. **Expanded type system** — `CATEGORIES` constant, `FactDomain` type, `DomainMetadata` interface
2. **Domain metadata registry** — `src/data/domainMetadata.ts`
3. **Updated biome affinities** — refactored `src/services/interestSpawner.ts`
4. **Updated UI components** — domain selection grid, Knowledge Library filters
5. **Updated run pool builder** — graceful handling of small/empty domains
6. **Reclassified seed data** — facts reassigned to correct new domains
7. **Updated game design docs** — reflect 11 new domains

---

## Sub-steps

### Sub-step 1: Expand the Domain/Category Type System

#### Objective
Refactor the category/domain type system from 7 hardcoded categories to 11 domains with robust typing and metadata support.

#### Files to Modify
```
src/data/types.ts
```

#### Detailed Implementation Requirements

**Current State (in src/data/types.ts):**

Find the `CATEGORIES` constant which currently looks like:
```typescript
export const CATEGORIES = [
  'Language',
  'Natural Sciences',
  'Life Sciences',
  'History',
  'Geography',
  'Technology',
  'Culture'
] as const
```

**1.1 — Replace CATEGORIES constant:**

```typescript
export const CATEGORIES = [
  'General Knowledge',
  'Natural Sciences',
  'Space & Astronomy',
  'Geography',
  'History',
  'Mythology & Folklore',
  'Animals & Wildlife',
  'Human Body & Health',
  'Food & World Cuisine',
  'Art & Architecture',
  'Language',
] as const
```

**Notes on the change:**
- 'Language' moved to end (is special — language domain)
- 'Technology' removed — merged into General Knowledge
- 'Culture' removed — absorbed into new specific domains
- 'Life Sciences' removed — split into Animals & Wildlife + Human Body & Health + (some) Natural Sciences
- Added 'Space & Astronomy' (was previously under Natural Sciences)
- Added 'Mythology & Folklore'
- Added 'Animals & Wildlife'
- Added 'Human Body & Health'
- Added 'Food & World Cuisine'
- Added 'Art & Architecture'

**1.2 — Add FactDomain type:**

Add after the CATEGORIES constant:
```typescript
/**
 * Knowledge domain identifier.
 * Each domain corresponds to a category of quiz facts.
 */
export type FactDomain = typeof CATEGORIES[number]

/**
 * Type guard for checking if a string is a valid FactDomain.
 * @param value - The value to check
 * @returns True if value is a valid FactDomain
 */
export function isFactDomain(value: unknown): value is FactDomain {
  return typeof value === 'string' && CATEGORIES.includes(value as any)
}
```

**1.3 — Add DomainMetadata interface:**

Add a new interface after the FactDomain type:
```typescript
/**
 * Metadata describing a knowledge domain.
 * Used for UI display, styling, and domain configuration.
 */
export interface DomainMetadata {
  /** Unique domain identifier */
  id: FactDomain

  /** Human-readable display name (e.g., "Space & Astronomy") */
  displayName: string

  /** Short name for UI badges, max 12 characters (e.g., "Space") */
  shortName: string

  /** Hex color code for domain visual identity (#RRGGBB) */
  colorTint: string

  /** Icon identifier (emoji or icon name) */
  icon: string

  /** Human-readable description of this domain */
  description: string

  /** Default minimum age rating for content in this domain */
  ageDefault: AgeRating
}

/**
 * Mapping of all knowledge domains to their metadata.
 * Imported from domainMetadata.ts.
 */
export type DomainMetadataMap = Record<FactDomain, DomainMetadata>
```

**1.4 — Update existing type references:**

Search for all places in `src/data/types.ts` that reference 'category' or use string literals of category names:
- If there's a `category: string` field in Fact or QuizQuestion, change to `category: FactDomain`
- If there are any hardcoded category checks (`if (category === 'Natural Sciences')`), leave as-is for now — they'll be updated in later sub-steps
- Do NOT change anything in this file beyond the above; other updates happen in their respective sub-steps

**1.5 — Update category-related exports:**

Ensure the following exports exist after your changes:
- `CATEGORIES` (the constant array)
- `FactDomain` (the type)
- `isFactDomain` (the type guard)
- `DomainMetadata` (the interface)
- `DomainMetadataMap` (the type)

#### Acceptance Criteria for Sub-step 1
- [ ] TypeScript compiles with `npm run typecheck` — no errors in types.ts
- [ ] `CATEGORIES` array has exactly 11 items (listed above)
- [ ] `FactDomain` type correctly infers all 11 domain names
- [ ] `isFactDomain` type guard function exists and is exported
- [ ] `DomainMetadata` interface has all 5 required fields (id, displayName, shortName, colorTint, icon, description, ageDefault)
- [ ] No hardcoded category strings in types.ts (except in comments)
- [ ] Existing Fact/QuizQuestion types updated to use `FactDomain` where appropriate

#### Testing Instructions
1. Run: `npm run typecheck`
2. Verify no errors related to types.ts
3. Run in Node REPL:
   ```javascript
   const { CATEGORIES, isFactDomain } = require('./dist/data/types.js');
   console.log('Categories:', CATEGORIES.length);
   console.log('isFactDomain("General Knowledge"):', isFactDomain("General Knowledge"));
   console.log('isFactDomain("Invalid"):', isFactDomain("Invalid"));
   ```
4. Verify output: 11 categories, true, false

---

### Sub-step 2: Create Domain Metadata Registry

#### Objective
Build a centralized configuration file that maps each of the 11 domains to their visual identity, descriptions, and default age ratings.

#### Files to Create
```
src/data/domainMetadata.ts
```

#### Detailed Implementation Requirements

**2.1 — Create domainMetadata.ts:**

```typescript
import { DomainMetadata, DomainMetadataMap, AgeRating } from './types'

/**
 * Complete metadata registry for all 11 knowledge domains.
 *
 * This is the single source of truth for domain display names, colors, icons, and descriptions.
 * All UI components that need domain information should reference this registry.
 *
 * Color assignments chosen to be distinct, colorblind-friendly where possible,
 * and consistent with the visual identity of Recall Rogue.
 */
export const DOMAIN_METADATA: DomainMetadataMap = {
  'General Knowledge': {
    id: 'General Knowledge',
    displayName: 'General Knowledge',
    shortName: 'General',
    colorTint: '#6B7280',  // gray-500
    icon: '🧠',
    description: 'Notable facts, world records, inventions, discoveries',
    ageDefault: 'everyone' as const
  },

  'Natural Sciences': {
    id: 'Natural Sciences',
    displayName: 'Natural Sciences',
    shortName: 'Science',
    colorTint: '#10B981',  // emerald-500
    icon: '🧪',
    description: 'Chemistry, physics, periodic table, materials, constants',
    ageDefault: 'teen' as const
  },

  'Space & Astronomy': {
    id: 'Space & Astronomy',
    displayName: 'Space & Astronomy',
    shortName: 'Space',
    colorTint: '#6366F1',  // indigo-500
    icon: '🚀',
    description: 'Planets, moons, asteroids, space missions, astronauts, exoplanets',
    ageDefault: 'everyone' as const
  },

  'Geography': {
    id: 'Geography',
    displayName: 'Geography',
    shortName: 'Geography',
    colorTint: '#F59E0B',  // amber-500
    icon: '🌍',
    description: 'Countries, cities, geographical features, landmarks, climate',
    ageDefault: 'everyone' as const
  },

  'History': {
    id: 'History',
    displayName: 'History',
    shortName: 'History',
    colorTint: '#8B5CF6',  // violet-500
    icon: '📜',
    description: 'Historical events, figures, wars, treaties, cultural milestones',
    ageDefault: 'teen' as const
  },

  'Mythology & Folklore': {
    id: 'Mythology & Folklore',
    displayName: 'Mythology & Folklore',
    shortName: 'Myth',
    colorTint: '#EC4899',  // pink-500
    icon: '🏛️',
    description: 'Deities, mythological creatures, legendary stories, folklore',
    ageDefault: 'everyone' as const
  },

  'Animals & Wildlife': {
    id: 'Animals & Wildlife',
    displayName: 'Animals & Wildlife',
    shortName: 'Animals',
    colorTint: '#84CC16',  // lime-500
    icon: '🦁',
    description: 'Species taxonomy, endangered species, record-holders, habitats, behavior',
    ageDefault: 'everyone' as const
  },

  'Human Body & Health': {
    id: 'Human Body & Health',
    displayName: 'Human Body & Health',
    shortName: 'Health',
    colorTint: '#EF4444',  // red-500
    icon: '⚕️',
    description: 'Anatomy, diseases, medical discoveries, vitamins, genetics, wellness',
    ageDefault: 'teen' as const
  },

  'Food & World Cuisine': {
    id: 'Food & World Cuisine',
    displayName: 'Food & World Cuisine',
    shortName: 'Food',
    colorTint: '#F97316',  // orange-500
    icon: '🍜',
    description: 'Dishes, ingredients, spices, culinary techniques, food culture, nutrition',
    ageDefault: 'everyone' as const
  },

  'Art & Architecture': {
    id: 'Art & Architecture',
    displayName: 'Art & Architecture',
    shortName: 'Art',
    colorTint: '#14B8A6',  // teal-500
    icon: '🎨',
    description: 'Artworks, artists, architects, landmarks, art movements, design',
    ageDefault: 'everyone' as const
  },

  'Language': {
    id: 'Language',
    displayName: 'Language',
    shortName: 'Language',
    colorTint: '#3B82F6',  // blue-500
    icon: '🌐',
    description: 'Vocabulary, phrases, grammar, linguistic facts, language families',
    ageDefault: 'everyone' as const
  }
}

/**
 * Get metadata for a specific domain.
 * @param domain - The domain to look up
 * @returns Domain metadata, or undefined if domain not found
 */
export function getDomainMetadata(domain: string): DomainMetadata | undefined {
  return DOMAIN_METADATA[domain as any]
}

/**
 * Get all domains sorted by display name.
 * Useful for building consistent UI lists.
 * @returns Array of all domain metadata objects, sorted alphabetically
 */
export function getAllDomainMetadata(): DomainMetadata[] {
  return Object.values(DOMAIN_METADATA).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  )
}

/**
 * Get all non-Language domains (knowledge domains only).
 * Useful for filtering out the special Language domain in knowledge quizzes.
 * @returns Array of knowledge domain metadata objects
 */
export function getKnowledgeDomains(): DomainMetadata[] {
  return Object.values(DOMAIN_METADATA)
    .filter(d => d.id !== 'Language')
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

/**
 * Get CSS class name for domain styling.
 * Pattern: domain-[kebab-case-name]
 * E.g., 'domain-space-astronomy'
 * @param domain - The domain ID
 * @returns CSS class name
 */
export function getDomainCSSClass(domain: string): string {
  return `domain-${domain.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-')}`
}
```

**2.2 — Color Palette Notes:**

Colors chosen:
- Distinct enough to be distinguishable by humans and colorblind individuals
- Mostly using Tailwind's 500 shade for consistency with app theming
- Assigned based on common visual associations (space = indigo/blue, animals = green/lime, etc.)
- No two domains have the same hue

**2.3 — AgeRating Type Reference:**

Ensure `AgeRating` type exists in types.ts. It should have values like:
```typescript
export type AgeRating = 'everyone' | 'teen' | 'mature'
```

#### Acceptance Criteria for Sub-step 2
- [ ] `domainMetadata.ts` created at `src/data/domainMetadata.ts`
- [ ] `DOMAIN_METADATA` constant includes all 11 domains
- [ ] All domains have displayName, shortName, colorTint, icon, description, ageDefault fields
- [ ] shortName is <= 12 characters for all domains
- [ ] All colorTint values are valid hex colors (#RRGGBB format)
- [ ] All icons are valid emoji characters
- [ ] Helper functions exist: `getDomainMetadata()`, `getAllDomainMetadata()`, `getKnowledgeDomains()`, `getDomainCSSClass()`
- [ ] TypeScript compiles: `npm run typecheck` passes
- [ ] All 11 domains present and accounted for

#### Testing Instructions
1. Run: `npm run typecheck` — verify no errors
2. Run in Node REPL:
   ```javascript
   const { DOMAIN_METADATA, getAllDomainMetadata, getDomainMetadata } = require('./dist/data/domainMetadata.js');
   console.log('Total domains:', Object.keys(DOMAIN_METADATA).length);
   console.log('Space metadata:', getDomainMetadata('Space & Astronomy'));
   console.log('Knowledge domains:', getAllDomainMetadata().map(d => d.displayName));
   ```
3. Verify output: 11 domains, correct metadata, all knowledge domains listed

---

### Sub-step 3: Update Biome-to-Category Affinities

#### Objective
Refactor the biome affinity system to add new domains and ensure smooth integration with the expanded domain list.

#### Files to Modify
```
src/services/interestSpawner.ts
```

#### Detailed Implementation Requirements

**3.1 — Understand Current Affinity System:**

Find the affinity mapping in `interestSpawner.ts`. It likely looks like:
```typescript
const BIOME_AFFINITIES: Record<BiomeType, string[]> = {
  'crystalline_caves': ['Natural Sciences', 'Technology'],
  'volcanic_depths': ['Natural Sciences', 'History'],
  // ... other biomes
}
```

**3.2 — Update Existing Biome Affinities:**

For each biome, update its affinity array to use new domain names and add relevant new domains:

```typescript
const BIOME_AFFINITIES: Record<BiomeType, FactDomain[]> = {
  // Crystalline caves — science/space focused
  'crystalline_caves': [
    'Natural Sciences',      // kept
    'Space & Astronomy',     // NEW (was under Natural Sciences)
    'General Knowledge'      // replaces Technology
  ],

  // Volcanic depths — earth science/mythology
  'volcanic_depths': [
    'Natural Sciences',      // kept
    'Geography',             // kept
    'Mythology & Folklore'   // NEW (replaces Culture)
  ],

  // Enchanted forest — nature/myth/animals
  'enchanted_forest': [
    'Animals & Wildlife',    // NEW (promoted from Life Sciences)
    'Mythology & Folklore',  // NEW
    'Geography'              // nature theme
  ],

  // Ancient ruins — history/art/archaeology
  'ancient_ruins': [
    'History',               // kept
    'Art & Architecture',    // NEW
    'Mythology & Folklore'   // NEW
  ],

  // Frozen depths — geography/animals/space (ice, arctic, stars)
  'frozen_depths': [
    'Geography',             // kept
    'Animals & Wildlife',    // NEW (arctic fauna)
    'Space & Astronomy'      // NEW (night sky)
  ],

  // Sunken temple — history/mythology/water
  'sunken_temple': [
    'History',               // kept
    'Mythology & Folklore',  // NEW
    'Geography'              // water/ocean
  ],

  // If there are other biomes, add new domain affinities as appropriate:
  // Examples:
  // 'mystical_gardens': ['Food & World Cuisine', 'Animals & Wildlife'],
  // 'library_archives': ['General Knowledge', 'History', 'Art & Architecture'],
  // 'alchemy_lab': ['Natural Sciences', 'Human Body & Health']
}
```

**3.3 — Update Type Annotation:**

Change the type annotation for BIOME_AFFINITIES from `string[]` to `FactDomain[]`:
```typescript
import { FactDomain } from '../data/types'

const BIOME_AFFINITIES: Record<BiomeType, FactDomain[]> = {
  // ... entries above
}
```

**3.4 — Update Affinity Selection Logic:**

If there's a function that selects affinity categories for a biome, ensure it:
- Still respects priority/order (first domain in array is primary)
- Gracefully handles unknown domains (won't crash if a domain doesn't exist)
- Can handle the new larger set of affinities

Example update:
```typescript
/**
 * Get affinity categories for a biome.
 * @param biome - The biome type
 * @returns Array of domain IDs that should spawn more often in this biome
 */
export function getBiomeAffinities(biome: BiomeType): FactDomain[] {
  return BIOME_AFFINITIES[biome] || ['General Knowledge']  // fallback
}
```

#### Acceptance Criteria for Sub-step 3
- [ ] All biome affinity arrays updated to use new domain names
- [ ] No old domain names ('Life Sciences', 'Technology', 'Culture') remain
- [ ] Type annotation changed from `string[]` to `FactDomain[]`
- [ ] All FactDomain values in affinities are valid (exist in CATEGORIES)
- [ ] Affinity function handles unknown biomes gracefully
- [ ] TypeScript compiles: `npm run typecheck` passes
- [ ] No hardcoded old category names in any logic

#### Testing Instructions
1. Run: `npm run typecheck` — verify no type errors
2. Verify all biomes have affinities:
   ```javascript
   const { BIOME_AFFINITIES } = require('./dist/services/interestSpawner.js');
   Object.entries(BIOME_AFFINITIES).forEach(([biome, affinities]) => {
     console.log(`${biome}: ${affinities.join(', ')}`);
   });
   ```
3. Verify no old domain names appear in output

---

### Sub-step 4: Update Domain Selection UI

#### Objective
Ensure all UI components that display domain/category choices render all 11 domains correctly and handle empty/incomplete domains gracefully.

#### Files to Search and Update
```
src/ui/
  ├── DomainSelection.svelte (or similar)
  ├── SettingsPanel.svelte
  ├── OnboardingFlow.svelte
  └── [any other components using categories]
```

#### Detailed Implementation Requirements

**4.1 — Find Domain Selection Components:**

Search for files that:
- Import or reference `CATEGORIES`
- Render category buttons/cards/list items
- Allow user to select categories/domains

Common locations:
- Onboarding screens that ask "which topics interest you?"
- Settings/preferences where user can choose favorite domains
- Run lobby where user selects which domains to include

**4.2 — Update Domain Grid/List Rendering:**

Where the UI renders domain options, replace hardcoded or CATEGORIES-based rendering with:

```svelte
<script>
  import { CATEGORIES } from '../../data/types'
  import { DOMAIN_METADATA } from '../../data/domainMetadata'

  let selectedDomains: Set<string> = new Set()

  function toggleDomain(domain: string) {
    if (selectedDomains.has(domain)) {
      selectedDomains.delete(domain)
    } else {
      selectedDomains.add(domain)
    }
    selectedDomains = selectedDomains  // trigger reactivity
  }
</script>

<div class="domain-grid">
  {#each CATEGORIES as domain (domain)}
    {@const meta = DOMAIN_METADATA[domain]}
    {@const isSelected = selectedDomains.has(domain)}
    {@const hasContent = checkDomainHasContent(domain)}  // see below

    <button
      class="domain-card"
      class:selected={isSelected}
      class:disabled={!hasContent}
      on:click={() => hasContent && toggleDomain(domain)}
      disabled={!hasContent}
    >
      <div class="domain-icon" style="color: {meta.colorTint}">
        {meta.icon}
      </div>
      <div class="domain-name">
        {meta.displayName}
      </div>
      {#if !hasContent}
        <div class="coming-soon">Coming Soon</div>
      {/if}
    </button>
  {/each}
</div>

<style>
  .domain-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
    margin: 16px 0;
  }

  .domain-card {
    padding: 12px;
    border-radius: 8px;
    border: 2px solid #e5e7eb;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .domain-card:hover:not(:disabled) {
    border-color: currentColor;
    transform: translateY(-2px);
  }

  .domain-card.selected {
    background: var(--domain-color);
    color: white;
  }

  .domain-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .domain-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  .domain-name {
    font-size: 12px;
    font-weight: 500;
  }

  .coming-soon {
    font-size: 9px;
    color: #999;
    margin-top: 4px;
  }
</style>
```

**4.3 — Add Domain Content Check:**

Create a utility function that checks if a domain has fact content (for graying out "Coming Soon" domains):

In `src/services/domainService.ts` (create if doesn't exist):
```typescript
/**
 * Check if a domain currently has content available.
 * @param domain - The domain to check
 * @returns True if domain has at least one fact, false if domain is empty
 */
export function domainHasContent(domain: string): boolean {
  // For now, all domains return true if they exist in CATEGORIES
  // Later, check against actual fact database
  // This prevents crashes on new empty domains
  return true
}
```

Then use in component:
```svelte
import { domainHasContent } from '../../services/domainService'

{#if !domainHasContent(domain)}
  <div class="coming-soon">Coming Soon</div>
{/if}
```

**4.4 — Update Grid Layout:**

Ensure grid can handle 11 items without overflow:
- Use CSS Grid with `repeat(auto-fit, minmax(...))` for responsive layout
- Test at mobile widths (375px, 768px, 1024px)

**4.5 — Update Any Dropdown/Select Menus:**

If domain selection is in a dropdown:
```svelte
<select bind:value={selectedDomain}>
  {#each CATEGORIES as domain (domain)}
    {@const meta = DOMAIN_METADATA[domain]}
    <option value={domain}>
      {meta.shortName} — {meta.description.substring(0, 30)}...
    </option>
  {/each}
</select>
```

#### Acceptance Criteria for Sub-step 4
- [ ] All domain selection UI components found and updated
- [ ] Components import from `DOMAIN_METADATA` instead of hardcoding
- [ ] Grid/list displays all 11 domains
- [ ] Grid layout is responsive (works at 375px, 768px, 1024px widths)
- [ ] New empty domains show "Coming Soon" badge and are non-selectable
- [ ] Existing domains are selectable and styled with correct colors
- [ ] No old domain names ('Life Sciences', 'Technology', 'Culture') visible in UI
- [ ] TypeScript compiles: `npm run typecheck` passes
- [ ] Visual verification: screenshot of domain selection grid showing all 11 domains

#### Testing Instructions
1. Run: `npm run dev`
2. Navigate to onboarding or settings where domain selection is
3. Screenshot: verify all 11 domains visible
4. Verify new domains show "Coming Soon" and are grayed out
5. Verify old domain names are not present
6. Test responsive: resize to 375px width, verify layout doesn't break

---

### Sub-step 5: Update Knowledge Library Filters

#### Objective
Ensure the Knowledge Library or fact browser component displays all 11 domains in its filtering system.

#### Files to Search and Update
```
src/ui/
  ├── KnowledgeLibrary.svelte
  ├── FactBrowser.svelte
  ├── QuizResults.svelte
  └── [any other components showing fact collections by category]
```

#### Detailed Implementation Requirements

**5.1 — Find Knowledge Library Component:**

Search for components that:
- Display facts/cards grouped by category
- Have filter tabs/dropdown for switching between categories
- Show fact counts per category

**5.2 — Update Filter Tabs/Dropdown:**

Replace hardcoded category list with dynamic rendering:

```svelte
<script>
  import { CATEGORIES } from '../../data/types'
  import { DOMAIN_METADATA } from '../../data/domainMetadata'

  let selectedDomain = $state('General Knowledge')
  let facts = $state([])

  // Filter facts by selected domain
  $effect(() => {
    facts = allFacts.filter(f => f.category === selectedDomain)
  })
</script>

<!-- Filter tabs -->
<div class="filter-tabs">
  {#each CATEGORIES as domain (domain)}
    {@const meta = DOMAIN_METADATA[domain]}
    {@const count = countFactsInDomain(domain)}
    {@const isSelected = selectedDomain === domain}

    <button
      class="filter-tab"
      class:active={isSelected}
      style="color: {isSelected ? meta.colorTint : undefined}"
      on:click={() => selectedDomain = domain}
    >
      <span class="icon">{meta.icon}</span>
      <span class="name">{meta.shortName}</span>
      {#if count > 0}
        <span class="badge">{count}</span>
      {/if}
    </button>
  {/each}
</div>

<!-- Facts display -->
<div class="facts-list">
  {#if facts.length > 0}
    {#each facts as fact (fact.id)}
      <div class="fact-card">
        <div class="fact-question">{fact.question}</div>
        <div class="fact-answer">{fact.answer}</div>
      </div>
    {/each}
  {:else}
    <div class="empty-state">
      <p>No facts yet in {DOMAIN_METADATA[selectedDomain].displayName}</p>
      <p>Content coming soon!</p>
    </div>
  {/if}
</div>

<style>
  .filter-tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 8px 0;
    border-bottom: 1px solid #e5e7eb;
  }

  .filter-tab {
    padding: 8px 12px;
    border: none;
    background: white;
    cursor: pointer;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 4px;
    border-bottom: 2px solid transparent;
    font-size: 13px;
    transition: all 0.2s;
  }

  .filter-tab.active {
    border-bottom-color: currentColor;
    font-weight: 600;
  }

  .filter-tab .badge {
    background: #f3f4f6;
    border-radius: 999px;
    padding: 2px 6px;
    font-size: 11px;
    font-weight: 600;
  }

  .empty-state {
    padding: 32px;
    text-align: center;
    color: #999;
  }

  .facts-list {
    display: grid;
    gap: 12px;
  }

  .fact-card {
    padding: 12px;
    background: #f9fafb;
    border-radius: 6px;
    border-left: 3px solid var(--domain-color);
  }

  .fact-question {
    font-weight: 500;
    margin-bottom: 4px;
  }

  .fact-answer {
    color: #666;
    font-size: 13px;
  }
</style>
```

**5.3 — Add countFactsInDomain Helper:**

In `src/services/quizService.ts` or similar:
```typescript
/**
 * Count facts available in a given domain.
 * @param domain - The domain to count
 * @returns Number of facts in that domain
 */
export function countFactsInDomain(domain: string): number {
  return factDatabase.filter(fact => fact.category === domain).length
}
```

**5.4 — Handle Empty Domains Gracefully:**

If a domain has 0 facts, the UI should:
- Still show the domain in the filter list (with count = 0 or hidden)
- Show a friendly "Coming Soon" or "No facts yet" message when selected
- Not crash or show errors

#### Acceptance Criteria for Sub-step 5
- [ ] Knowledge Library component found and updated
- [ ] Filter tabs/dropdown includes all 11 domains
- [ ] Each tab shows correct icon and short name from DOMAIN_METADATA
- [ ] Fact count badge shows correct count per domain
- [ ] Empty domains show "No facts yet" message gracefully (no crash)
- [ ] Filter switching works smoothly
- [ ] TypeScript compiles: `npm run typecheck` passes
- [ ] Visual verification: screenshot of Knowledge Library showing all 11 domain tabs

#### Testing Instructions
1. Run: `npm run dev`
2. Navigate to Knowledge Library or equivalent
3. Screenshot: verify all 11 domain filter tabs visible
4. Click through each domain tab
5. Verify new empty domains show "No facts yet" without errors
6. Verify fact counts are correct

---

### Sub-step 6: Update Seed Data Category References

#### Objective
Reassign existing seed facts to correct new domain categories, ensuring backward compatibility and accurate classification.

#### Files to Modify
```
src/data/seed/facts-general.json
src/data/seed/[other seed files if they exist]
```

#### Detailed Implementation Requirements

**6.1 — Audit Current Seed Facts:**

Open seed fact files and identify which facts should be reclassified:

Current facts with category "Life Sciences" → reassign to:
- Animals → "Animals & Wildlife"
- Anatomy/medical → "Human Body & Health"
- Biology/cells → "Natural Sciences"

Current facts with category "Natural Sciences" → check if:
- About space/astronomy → change to "Space & Astronomy"
- About planets/stars/missions → change to "Space & Astronomy"
- Otherwise keep "Natural Sciences"

Current facts with category "Technology" → reassign to:
- "General Knowledge" (catch-all)

Current facts with category "Culture" → reassign to:
- Art/artists → "Art & Architecture"
- Food/cooking → "Food & World Cuisine"
- General culture → "General Knowledge"

**6.2 — Update Category Field in JSON:**

Example before:
```json
[
  {
    "id": "fact-001",
    "question": "What is the largest land animal?",
    "answer": "The African elephant",
    "category": "Life Sciences",
    "categoryL1": "life-sciences",
    "categoryL2": "animals"
  }
]
```

Example after:
```json
[
  {
    "id": "fact-001",
    "question": "What is the largest land animal?",
    "answer": "The African elephant",
    "category": "Animals & Wildlife",
    "categoryL1": "animals-wildlife",
    "categoryL2": "mammals"
  }
]
```

**6.3 — Preserve Backward Compatibility:**

- Don't delete old fact IDs — keep them, just update category
- Update categoryL1 to match new domain kebab-case:
  - "general-knowledge"
  - "natural-sciences"
  - "space-astronomy"
  - "geography"
  - "history"
  - "mythology-folklore"
  - "animals-wildlife"
  - "human-body-health"
  - "food-cuisine"
  - "art-architecture"
  - "language"

**6.4 — Reclassification Guide:**

```
Current → New Mapping

"Life Sciences" facts:
  - Animals → "Animals & Wildlife"
  - Human anatomy → "Human Body & Health"
  - Biology/cells/genetics → "Natural Sciences"
  - Disease info → "Human Body & Health"

"Natural Sciences" facts:
  - Chemistry/elements → "Natural Sciences"
  - Physics → "Natural Sciences"
  - Space/astronomy → "Space & Astronomy"  ← MOVE
  - Planets/moons → "Space & Astronomy"  ← MOVE

"Technology" facts:
  - All → "General Knowledge"

"Culture" facts:
  - Art/artists → "Art & Architecture"
  - Food/dishes → "Food & World Cuisine"
  - Language/phrases → "Language"
  - Folklore/mythology → "Mythology & Folklore"
  - General → "General Knowledge"

Keep unchanged:
  - "Language" → "Language"
  - "Geography" → "Geography"
  - "History" → "History"
```

**6.5 — Test Reclassification:**

After editing seed files:
1. Run TypeScript type check to ensure all category values are valid FactDomain
2. Load seed data in tests to verify no syntax errors

#### Acceptance Criteria for Sub-step 6
- [ ] All seed fact files reviewed
- [ ] Facts reclassified to new domains according to mapping above
- [ ] No old category names remain ("Life Sciences", "Technology", "Culture")
- [ ] All category values match one of the 11 new domains exactly
- [ ] categoryL1 updated to kebab-case matching new domain names
- [ ] Fact IDs preserved (no breaking changes for test data)
- [ ] JSON is valid (can be parsed)
- [ ] `npm run typecheck` passes with updated facts

#### Testing Instructions
1. Edit seed files and save
2. Run: `npm run typecheck` — verify no category errors
3. Run vitest to load seed data:
   ```bash
   npx vitest run -- --grep "seed"
   ```
4. Verify all tests pass

---

### Sub-step 7: Update Run Pool Builder

#### Objective
Ensure the run pool builder (the service that assembles facts for a run based on selected domains) handles the 11 new domains gracefully and doesn't crash when a domain has 0 or very few facts.

#### Files to Modify
```
src/services/
  ├── quizService.ts (or equivalent)
  ├── runPoolBuilder.ts (or equivalent)
  └── [any service that builds fact pools for runs]
```

#### Detailed Implementation Requirements

**7.1 — Find Run Pool Builder Logic:**

Search for code that:
- Filters facts by selected categories/domains
- Builds a pool of N facts for a run (e.g., 120 facts)
- Handles domain selection

Common location: service that prepares quiz data for a game run.

**7.2 — Add Domain-Aware Pool Sizing:**

Current behavior (assume):
```typescript
function buildRunPool(selectedDomains: string[], limit = 120): Fact[] {
  const facts = allFacts.filter(f => selectedDomains.includes(f.category))
  return facts.slice(0, limit)
}
```

Updated behavior:
```typescript
/**
 * Build a fact pool for a run, handling domains with fewer facts gracefully.
 * @param selectedDomains - Array of domain names selected by player
 * @param limit - Target number of facts (default 120)
 * @returns Array of facts, filled from selected domains with fallback to other domains if needed
 */
export function buildRunPool(selectedDomains: string[], limit = 120): Fact[] {
  // Filter to selected domains
  let facts = allFacts.filter(f => selectedDomains.includes(f.category))

  // If we have fewer than limit facts in selected domains, fill from other domains
  if (facts.length < limit) {
    const remainingNeeded = limit - facts.length
    const otherDomains = CATEGORIES.filter(d => !selectedDomains.includes(d))
    const otherFacts = allFacts
      .filter(f => otherDomains.includes(f.category))
      .slice(0, remainingNeeded)
    facts = facts.concat(otherFacts)
  }

  // Return up to limit facts
  return facts.slice(0, limit)
}
```

**7.3 — Handle Edge Cases:**

```typescript
/**
 * Validate that selected domains exist and have content.
 * @param selectedDomains - Array of domain names
 * @returns Array of valid domain names that have at least one fact
 */
export function validateSelectedDomains(selectedDomains: string[]): string[] {
  return selectedDomains.filter(domain => {
    // Check domain exists in CATEGORIES
    if (!CATEGORIES.includes(domain)) {
      console.warn(`Unknown domain: ${domain}`)
      return false
    }

    // Check domain has at least one fact
    const factCount = allFacts.filter(f => f.category === domain).length
    if (factCount === 0) {
      console.warn(`No facts in domain: ${domain}, falling back to General Knowledge`)
      return false
    }

    return true
  })
}
```

**7.4 — Update Run Initialization:**

When starting a run, ensure:
```typescript
async function startRun(selectedDomains: string[]): Promise<void> {
  // Validate domains
  const validDomains = validateSelectedDomains(selectedDomains)

  // If no valid domains, default to General Knowledge
  if (validDomains.length === 0) {
    console.warn('No valid domains selected, defaulting to General Knowledge')
    validDomains.push('General Knowledge')
  }

  // Build pool
  const pool = buildRunPool(validDomains, 120)

  // Initialize run with pool
  initializeRunWithPool(pool)
}
```

#### Acceptance Criteria for Sub-step 7
- [ ] Run pool builder found and updated
- [ ] Function handles domains with 0 facts gracefully (no crash)
- [ ] Function fills pool from fallback domains if selected domain is too small
- [ ] Domain validation function exists
- [ ] Invalid/empty domain selection defaults to General Knowledge
- [ ] TypeScript compiles: `npm run typecheck` passes
- [ ] Unit tests exist and pass for edge cases (0 facts, 1 domain, multiple domains)

#### Testing Instructions
1. Run: `npm run typecheck` — verify no errors
2. Run: `npx vitest run` — verify unit tests pass
3. Test edge cases in test file:
   ```javascript
   test('buildRunPool handles empty domain', () => {
     const pool = buildRunPool(['NonexistentDomain'])
     expect(pool.length).toBeGreaterThan(0)  // Should fallback
   })

   test('buildRunPool handles single fact domain', () => {
     // Add a test domain with 1 fact
     const pool = buildRunPool(['TestDomain'], 120)
     expect(pool.length).toBeGreaterThanOrEqual(120)  // Should fill from others
   })
   ```

---

### Sub-step 8: Add Domain Icons/Sprites

#### Objective
Create placeholder icon files for each new domain that can be referenced in the UI.

#### Files to Create
```
src/assets/icons/domains/
├── general-knowledge.svg
├── natural-sciences.svg
├── space-astronomy.svg
├── geography.svg
├── history.svg
├── mythology-folklore.svg
├── animals-wildlife.svg
├── human-body-health.svg
├── food-cuisine.svg
├── art-architecture.svg
└── language.svg
```

#### Detailed Implementation Requirements

**8.1 — Create Simple SVG Icons:**

For each domain, create a simple SVG icon (~32x32px) that matches the emoji/theme:

Example: `space-astronomy.svg`
```svg
<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <!-- Simple space/rocket themed icon -->
  <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M16 6 L20 12 L12 12 Z" fill="currentColor"/>
  <circle cx="16" cy="18" r="2" fill="currentColor"/>
  <circle cx="12" cy="20" r="1.5" fill="currentColor"/>
  <circle cx="20" cy="22" r="1.5" fill="currentColor"/>
</svg>
```

**8.2 — Icon Requirements:**

- Format: SVG (scalable, lightweight)
- Size: 32x32 viewBox (renders at any size)
- Use `currentColor` for fill/stroke to inherit color from CSS
- Thin lines (stroke-width: 1-2)
- No fill in background (transparent)
- Simple, recognizable shapes (not photorealistic)

**8.3 — Optionally Use Emoji:**

If SVG icon creation is complex, can use the emoji from domainMetadata:
```svelte
<div class="domain-icon">
  {meta.icon}
</div>
```

In CSS:
```css
.domain-icon {
  font-size: 32px;
  color: var(--domain-color);
}
```

**8.4 — Update UI to Reference Icons:**

In components that display domains, reference the icon file or use emoji:
```svelte
{#if hasCustomIcon}
  <img src="icons/domains/{domainKebab}.svg" alt={meta.displayName} />
{:else}
  <span>{meta.icon}</span>
{/if}
```

#### Acceptance Criteria for Sub-step 8
- [ ] All 11 domain icons created in `src/assets/icons/domains/` (or equivalent)
- [ ] SVGs are valid (can be parsed by browser)
- [ ] Icons use `currentColor` for styling flexibility
- [ ] Icons are simple and recognizable
- [ ] UI components can load and display icons without errors
- [ ] Icons render correctly at different sizes (16px, 32px, 64px)
- [ ] TypeScript compiles: `npm run typecheck` passes
- [ ] Visual verification: screenshot showing all 11 domain icons

#### Testing Instructions
1. Create simple SVG files (emoji can be fallback if SVGs not ready)
2. Run: `npm run build` — verify no asset errors
3. Screenshot domain selection or library showing icons rendered correctly
4. Verify icons look reasonable at mobile size (375px width)

---

### Sub-step 9: Add Flags of the World Quiz Pack

#### Objective
Add a "Flags of the World" quiz pack as a sub-domain of Geography. This is extremely popular with quiz game players and generates high engagement.

#### Implementation Details

**9.1 — Data Source: Wikidata SPARQL Query**

Use Wikidata SPARQL endpoint (CC0 licensed) to fetch all sovereign states with flag metadata:

```sparql
SELECT ?country ?countryLabel ?flagImage ?isoCode ?continentLabel ?capitalLabel ?population
WHERE {
  ?country wdt:P31 wd:Q6256.
  ?country wdt:P41 ?flagImage.
  OPTIONAL { ?country wdt:P297 ?isoCode. }
  OPTIONAL { ?country wdt:P30 ?continent. }
  OPTIONAL { ?country wdt:P36 ?capital. }
  OPTIONAL { ?country wdt:P1082 ?population. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

Expected results: 190+ sovereign states with flag images, ISO codes, and metadata.

**9.2 — Card Generation: Multiple Quiz Variants**

Each country becomes a Fact with 2-4 quiz variants:

- **Variant 1 (Visual → Name):** Show flag pixel art → "Which country's flag is this?" → 4 country options
- **Variant 2 (Name → Description):** "What colors appear on the flag of [country]?" → color options
- **Variant 3 (Name → Visual):** "Which flag belongs to [country]?" → 4 flag pixel art options (image quiz)
- **Variant 4 (Trivia):** "Which country has a [unique feature] on its flag?" (e.g., "a dragon", "a maple leaf")

Store in `src/data/seed/facts-flags.json` using the standard Fact schema.

**9.3 — Pixel Art Generation**

Generate 64x64 pixel art versions of ~200 national flags using ComfyUI SDXL + pixel art LoRA:

- Flags are government symbols and generally NOT copyrightable
- Our pixel art renditions are original creative works
- Store at `public/assets/flags/` with naming: `flag-{iso-code}.png`
- Simple geometric designs work well as pixel art
- Target: complete pixel art for at least 50 countries (top priority set) during this phase

**9.4 — Difficulty Mapping**

Assign difficulty levels based on country familiarity:

- **Easy (1):** Major countries everyone knows (USA, UK, Japan, France, Brazil, Germany, Canada, Australia, Italy, etc.) — ~30 countries
- **Medium (2-3):** Mid-tier countries (Portugal, Thailand, Egypt, Greece, Netherlands, India, Mexico, etc.) — ~100 countries
- **Hard (4-5):** Small nations, similar-looking flags (Chad/Romania, Monaco/Indonesia, etc.) — ~60 countries

**9.5 — Category Assignment**

Each flag fact must have:

```typescript
{
  "category": ["Geography", "Flags"],
  "domain": "geography",
  "subdomain": "flags",
  ...otherFields
}
```

These will show as a filterable sub-category in the Knowledge Library: Geography > Flags.

**9.6 — Content Pipeline**

Create a content pipeline script to automate SPARQL query, image download, and fact generation:

- NEW: `scripts/content-pipeline/fetch/fetch-flags.mjs` — Wikidata SPARQL query + flag image download
- Script should output `src/data/seed/facts-flags.json` in standard Fact schema
- Include error handling for missing images or invalid ISO codes
- Log summary: total countries fetched, images downloaded, facts generated

#### Files to Create/Modify

**NEW:**
- `scripts/content-pipeline/fetch/fetch-flags.mjs` — Wikidata SPARQL query and flag image download pipeline
- `src/data/seed/facts-flags.json` — Generated flag quiz facts in Fact schema
- `public/assets/flags/` — Directory for pixel art flag sprites (at least 50 countries)

**EDIT:**
- `src/data/domainMetadata.ts` — Add 'flags' as Geography subdomain
- `docs/GAME_DESIGN.md` — Document Flags of the World as Geography sub-domain

#### Acceptance Criteria for Sub-step 9

- [ ] SPARQL query returns 190+ sovereign states with flag images
- [ ] `scripts/content-pipeline/fetch/fetch-flags.mjs` runs without errors and generates `facts-flags.json`
- [ ] Each country has 2-4 quiz variants in the facts file
- [ ] Difficulty distribution: ~30 easy, ~100 medium, ~60 hard
- [ ] `src/data/domainMetadata.ts` includes 'flags' as Geography subdomain with metadata
- [ ] Pixel art generated for at least 50 countries (stored at `public/assets/flags/flag-{iso}.png`)
- [ ] All flags are 64x64 PNG with transparent background
- [ ] Flags filterable in Knowledge Library under Geography > Flags (visual test)
- [ ] Fact schema validation: `npx vitest run` passes for fact structure tests
- [ ] No console errors when loading flag facts in game

#### Testing Instructions

1. Run the fetch script:
   ```bash
   node scripts/content-pipeline/fetch/fetch-flags.mjs
   ```
   Verify: `src/data/seed/facts-flags.json` is created with 190+ facts

2. Validate fact structure:
   ```bash
   npx vitest run -- facts-flags
   ```
   Verify: All facts have required fields (question, answers, category, domain, subdomain, difficulty)

3. Visual test in-game:
   ```bash
   npm run dev
   # Navigate to Knowledge Library
   # Filter by Geography > Flags
   # Verify flags appear with questions and pixel art
   ```

4. Verify pixel art:
   - Check `public/assets/flags/` directory for at least 50 `.png` files
   - Spot-check: `flag-us.png`, `flag-gb.png`, `flag-jp.png` exist and render correctly
   - All PNGs are 64x64 with transparent background

---

## Acceptance Criteria (Overall Phase)

All sub-steps must be completed and verified:

- [ ] **Sub-step 1:** Type system expanded, FactDomain type added, CATEGORIES has 11 items
- [ ] **Sub-step 2:** DomainMetadata registry created with all 11 domains
- [ ] **Sub-step 3:** Biome affinities updated, no old domain names remain
- [ ] **Sub-step 4:** Domain selection UI updated, shows all 11 domains with icons
- [ ] **Sub-step 5:** Knowledge Library filters updated, shows all 11 domains
- [ ] **Sub-step 6:** Seed facts reclassified, no old category names remain
- [ ] **Sub-step 7:** Run pool builder handles small/empty domains gracefully
- [ ] **Sub-step 8:** Domain icons created and rendering
- [ ] **Sub-step 9:** Flags of the World quiz pack content pipeline and facts generated (190+ countries, 50+ pixel art sprites)

---

## Verification Gate

**MUST PASS before phase is marked complete:**

- [ ] `npm run typecheck` passes (all TypeScript errors resolved)
- [ ] `npm run build` succeeds (no compilation errors)
- [ ] `npx vitest run` passes (all unit tests pass, including seed data tests)
- [ ] Playwright visual test — full flow screenshot:
  1. Start app with dev preset: `?skipOnboarding=true&devpreset=post_tutorial`
  2. Open domain selection or Knowledge Library
  3. Screenshot showing all 11 domains with icons and colors
  4. Verify no old domain names visible
- [ ] Test run with all domains selected completes without errors
- [ ] Test run with single small domain completes without crash
- [ ] No console errors in Playwright screenshot
- [ ] Documentation updated: `docs/GAME_DESIGN.md` reflects 11 new domains

---

## Files Affected

**EDIT:**
- `src/data/types.ts` — CATEGORIES constant, FactDomain type, DomainMetadata interface
- `src/services/interestSpawner.ts` — biome affinity mappings
- `src/data/seed/facts-general.json` — category reassignments
- Domain selection UI component(s) in `src/ui/`
- Knowledge Library/fact browser component(s) in `src/ui/`
- Run pool builder service in `src/services/`
- `src/data/domainMetadata.ts` — add 'flags' as Geography subdomain (Sub-step 9)
- `docs/GAME_DESIGN.md` — domain list and descriptions, add Flags of the World (Sub-step 9)

**NEW:**
- `src/data/domainMetadata.ts` — metadata registry
- `src/assets/icons/domains/` — 11 SVG icon files (or use emoji)
- `scripts/content-pipeline/fetch/fetch-flags.mjs` — Wikidata SPARQL query and flag image download (Sub-step 9)
- `src/data/seed/facts-flags.json` — Flags of the World quiz facts (Sub-step 9)
- `public/assets/flags/` — Pixel art flag sprites (at least 50 countries, Sub-step 9)
- (Optional) Test files verifying domain logic

**NOT MODIFIED:**
- Game scenes, Phaser logic, combat system
- Fact generation or API integration
- User authentication or persistence

---

## Notes for Implementation Workers

- **Type-First Approach:** Update types first (Sub-step 1), then propagate type changes through codebase
- **Breaking Changes:** Changing CATEGORIES is a breaking change; ensure all fact references are updated
- **Testing:** Run tests frequently after each sub-step to catch breakage early
- **UI Polish:** Domain icons don't need to be pixel-perfect; placeholder emoji work fine for MVP
- **Documentation:** Update game design docs to reflect new domains and their descriptions
- **Backward Compatibility:** Old facts should remain accessible; reassign but don't delete
- **Coloring:** The color palette in domainMetadata.ts is final; use as-is for consistency

This phase is **primarily structural** — no new game mechanics, no content generation, just reorganizing the domain system to be more comprehensive and maintainable.
