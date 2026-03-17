# AR-81: Monetization & Entitlement Architecture

> **Master Spec Reference:** `docs/RESEARCH/DESKTOP-PORT-MASTER-INSTRUCTIONS.md` §16
> **Priority:** STEAM LAUNCH
> **Complexity:** Medium
> **Dependencies:** AR-72 (Platform Abstraction)

## Context

Mobile is F2P with subscription. Steam is premium (pay once) with DLC. Need an entitlement system that gates content appropriately per platform.

## Directive

### Step 1: Entitlement Service

**File:** NEW `src/services/entitlementService.ts`

```typescript
interface PlayerEntitlements {
  platform: 'mobile' | 'steam' | 'web';
  baseDomains: string[];         // Free domains
  unlockedDomains: string[];     // Purchased/subscribed domains
  communityPacks: string[];      // Always free
  ankiDecks: string[];           // Always free
  cosmetics: string[];
  hasMultiplayer: boolean;       // Future
  hasDailyChallenge: boolean;    // Future
}

/** Check if player has access to a domain */
function hasDomainAccess(domain: string): boolean { ... }

/** Get all accessible domains for current player */
function getAccessibleDomains(): string[] { ... }
```

### Step 2: Steam Pricing Model

| Product | Price | Content |
|---------|-------|---------|
| Base Game (Early Access) | $9.99 | All 10+ knowledge domains, full roguelike, all card mechanics, all relics |
| Base Game (1.0) | $14.99 | Same + post-EA polish |
| Language DLC (each) | $4.99 | Japanese N5-N3, Korean A1-B1, Spanish A1-B1, etc. |
| Curated Study Packs | $2.99 | SAT Prep, Medical Terminology, etc. |
| Cosmetic DLC | $1.99-3.99 | Card backs, particles, chain themes |

### Step 3: Platform-Aware Gating

**File:** Modify domain selection flow

- Steam base game: all knowledge domains unlocked
- Steam language DLC: check Steamworks DLC ownership
- Mobile free: 2-3 base domains, subscription unlocks all
- Web: same as mobile free tier
- Anki imports and community packs: ALWAYS free, all platforms

### Step 4: DLC Ownership Check

**File:** `src/services/steamService.ts` (extend from AR-80)

- `hasDLC(dlcId: string): boolean` — check Steamworks DLC ownership
- Map DLC IDs to domain/content unlocks
- Cache results (don't query Steam every frame)

### Step 5: Verification

- [ ] Steam base game: all knowledge domains accessible
- [ ] Steam without language DLC: language domains locked with purchase prompt
- [ ] Mobile free: only base domains accessible
- [ ] Anki/community packs: accessible on all platforms
- [ ] No purchase prompts interrupt gameplay flow

## Files Affected

| File | Action |
|------|--------|
| `src/services/entitlementService.ts` | NEW |
| `src/services/steamService.ts` | MODIFY (add DLC check) |
| Domain selection components | MODIFY (gate check) |

## GDD Updates

Update `docs/GAME_DESIGN.md` §25 (Monetization) with:
- Steam pricing table (EA $9.99, 1.0 $14.99, Language DLC $4.99, Study Packs $2.99, Cosmetics $1.99-3.99)
- Mobile remains F2P + subscription
- Anki/community always free
- Entitlement architecture summary
