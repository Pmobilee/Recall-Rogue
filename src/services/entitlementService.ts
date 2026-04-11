/**
 * Entitlement service for Recall Rogue.
 *
 * Centralises all content-access gating across platforms:
 *   - Steam (desktop):  Base game includes all knowledge domains. Language DLCs
 *                       unlock language-acquisition content. Anki imports and
 *                       community packs are always free.
 *   - Mobile:           F2P tier includes BASE_DOMAINS only (no subscription tier —
 *                       subscriptionService removed 2026-04-11 pre-launch).
 *   - Web:              Free tier only — BASE_DOMAINS accessible.
 *
 * Domain IDs match `CanonicalFactDomain` from `src/data/card-types.ts` and the
 * `DOMAIN_METADATA` keys in `src/data/domainMetadata.ts`.
 *
 * See: AR-81 (Monetization & Entitlements), AR-80 (Steam Integration).
 */

import { platform } from './platformService';
import { hasDLC } from './steamService';
import type { CanonicalFactDomain } from '../data/card-types';
import { CANONICAL_FACT_DOMAINS } from '../data/card-types';

// ── Domain Classification ─────────────────────────────────────────────────────

/**
 * Domains available for free on all platforms (mobile free tier, web).
 * Steam base game includes ALL knowledge domains — this list only applies
 * to the mobile/web free tiers.
 */
const BASE_DOMAINS: CanonicalFactDomain[] = [
  'general_knowledge',
  'natural_sciences',
  'geography',
];

/**
 * Knowledge domains included in the Steam base game.
 * All CanonicalFactDomains except language-acquisition domains,
 * which are gated behind per-language DLC.
 */
const STEAM_BASE_KNOWLEDGE_DOMAINS: CanonicalFactDomain[] = CANONICAL_FACT_DOMAINS.filter(
  (d) => d !== 'language',
);

/**
 * Maps Steam DLC IDs (as registered in Steamworks) to the canonical domain IDs
 * they unlock. Language domains share the single 'language' CanonicalFactDomain
 * but are differentiated at the fact-pack / subcategory level.
 *
 * DLC ID strings here must match `src-tauri` Rust constants when wired up.
 */
export const LANGUAGE_DLC_MAP: Record<string, CanonicalFactDomain[]> = {
  dlc_japanese: ['language'], // JLPT N5–N3
  dlc_korean: ['language'],   // TOPIK A1–B1
  dlc_spanish: ['language'],  // CEFR A1–B1
  dlc_french: ['language'],   // CEFR A1–B1
  dlc_mandarin: ['language'],  // HSK 1–3
  dlc_german: ['language'],   // Goethe A1–B1
};

// ── Entitlement Types ─────────────────────────────────────────────────────────

export interface PlayerEntitlements {
  /** Which native platform the player is on. */
  platform: 'mobile' | 'steam' | 'web';
  /** Domains unlocked at no cost for this player. */
  baseDomains: CanonicalFactDomain[];
  /** Domains unlocked via purchase, DLC, or subscription. */
  unlockedDomains: CanonicalFactDomain[];
  /** Community packs — always free. Populated at runtime by factPackService. */
  communityPacks: string[];
  /** Imported Anki decks — always free, stored locally. */
  ankiDecks: string[];
  /** Cosmetic items owned. */
  cosmetics: string[];
  /** Future: multiplayer access (e.g. duel mode). */
  hasMultiplayer: boolean;
  /** Future: daily challenge access. */
  hasDailyChallenge: boolean;
}

// ── Domain Access ─────────────────────────────────────────────────────────────

/**
 * Check whether the current player has access to a specific knowledge domain.
 *
 * Resolution order:
 *  1. Desktop (Steam):  all knowledge domains unlocked in base game.
 *                       Language domain requires ownership of a language DLC.
 *  2. Mobile:           BASE_DOMAINS always accessible (no subscription tier).
 *  3. Web:              BASE_DOMAINS only.
 */
export async function hasDomainAccess(domain: CanonicalFactDomain): Promise<boolean> {
  // ── Desktop (Steam) ───────────────────────────────────────────────────────
  if (platform === 'desktop') {
    // Language domain: requires at least one language DLC
    if (domain === 'language') {
      const results = await Promise.all(
        Object.keys(LANGUAGE_DLC_MAP).map((dlcId) => hasDLC(dlcId)),
      );
      return results.some(Boolean);
    }
    // All other knowledge domains are included in the base game
    if (STEAM_BASE_KNOWLEDGE_DOMAINS.includes(domain)) return true;
    return false;
  }

  // ── Mobile ────────────────────────────────────────────────────────────────
  if (platform === 'mobile') {
    if (BASE_DOMAINS.includes(domain)) return true;
    return false; // No subscription tier — BASE_DOMAINS are the full mobile offering
  }

  // ── Web (free tier) ───────────────────────────────────────────────────────
  return BASE_DOMAINS.includes(domain);
}

/**
 * Check ownership of a specific language DLC by its Steamworks DLC ID.
 * Always returns false on non-Steam platforms.
 */
export async function hasLanguageDLC(dlcId: string): Promise<boolean> {
  if (platform !== 'desktop') return false;
  return hasDLC(dlcId);
}

/**
 * Return all canonical domains the current player can access.
 * Includes all CANONICAL_FACT_DOMAINS for which `hasDomainAccess` returns true.
 *
 * Note: Anki-imported decks and community packs are always accessible
 * and are tracked separately (not in CANONICAL_FACT_DOMAINS).
 */
export async function getAccessibleDomains(): Promise<CanonicalFactDomain[]> {
  const checks = await Promise.all(
    CANONICAL_FACT_DOMAINS.map(async (domain) => ({
      domain,
      accessible: await hasDomainAccess(domain),
    })),
  );
  return checks.filter((c) => c.accessible).map((c) => c.domain);
}

/**
 * Build a full `PlayerEntitlements` snapshot for the current player.
 * Useful for analytics, settings screens, and onboarding flows.
 */
export async function getPlayerEntitlements(): Promise<PlayerEntitlements> {
  const accessibleDomains = await getAccessibleDomains();

  const baseDomains = accessibleDomains.filter((d) => BASE_DOMAINS.includes(d));
  const unlockedDomains = accessibleDomains.filter((d) => !BASE_DOMAINS.includes(d));

  const resolvedPlatform: PlayerEntitlements['platform'] =
    platform === 'desktop' ? 'steam' : platform === 'mobile' ? 'mobile' : 'web';

  return {
    platform: resolvedPlatform,
    baseDomains,
    unlockedDomains,
    communityPacks: [], // populated by factPackService at runtime
    ankiDecks: [],      // populated by ankiImportService at runtime
    cosmetics: [],      // populated by cosmetics service (future)
    hasMultiplayer: false,    // future
    hasDailyChallenge: true,  // available on all platforms
  };
}

// ── Purchase Prompt Helpers ───────────────────────────────────────────────────

/**
 * Returns the Steam DLC IDs that would unlock the given domain.
 * Returns an empty array if the domain is not gated by any DLC.
 */
export function getDLCsForDomain(domain: CanonicalFactDomain): string[] {
  return Object.entries(LANGUAGE_DLC_MAP)
    .filter(([, domains]) => domains.includes(domain))
    .map(([dlcId]) => dlcId);
}

/**
 * Whether a domain is gated on the current platform and what action
 * the player would need to take to unlock it.
 *
 * Returns null if the domain is already accessible.
 */
export type UnlockAction =
  | { type: 'subscribe'; label: 'Scholar Pass ($4.99/mo)' }
  | { type: 'dlc'; dlcId: string; label: string }
  | null;

export async function getUnlockAction(domain: CanonicalFactDomain): Promise<UnlockAction> {
  const accessible = await hasDomainAccess(domain);
  if (accessible) return null;

  if (platform === 'desktop') {
    const dlcs = getDLCsForDomain(domain);
    if (dlcs.length > 0) {
      return { type: 'dlc', dlcId: dlcs[0], label: `Language DLC ($4.99)` };
    }
    return null; // base game should cover all non-language domains
  }

  // Mobile / web: subscription prompt
  return { type: 'subscribe', label: 'Scholar Pass ($4.99/mo)' };
}
