// === Chain Visuals Service (AR-70) ===
// Provides color mapping from chainType (0-5) to the 6-color chain palette,
// and helper functions for building chain visual state.
// Used by CardHand.svelte to tint card edges and derive pulse groups.
// Also provides getChainAtmosphereModifiers for runtime environment scaling (Spec 03).

import type { Card } from '../data/card-types';
import { getChainTypeColor, getChainTypeGlowColor } from '../data/chainTypes';

/**
 * Returns the hex color for a card's chain type.
 * If chainType is undefined, returns gray fallback.
 */
export function getChainColor(chainType: number | undefined): string {
  if (chainType === undefined) return '#888888';
  return getChainTypeColor(chainType);
}

/**
 * Returns the glow color for a card's chain type.
 */
export function getChainGlowColor(chainType: number | undefined): string {
  if (chainType === undefined) return 'rgba(136,136,136,0.30)';
  return getChainTypeGlowColor(chainType);
}

/**
 * Groups card IDs by their shared chainType.
 * Only includes groups with 2+ cards (potential chain partners).
 *
 * @returns Map<chainType, cardId[]>
 */
export function getChainColorGroups(cards: Card[]): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  for (const card of cards) {
    if (card.chainType === undefined) continue;
    const existing = groups.get(card.chainType);
    if (existing) {
      existing.push(card.id);
    } else {
      groups.set(card.chainType, [card.id]);
    }
  }
  // Remove singleton groups — only chain partners matter
  for (const [key, ids] of groups) {
    if (ids.length < 2) groups.delete(key);
  }
  return groups;
}

// ── Chain Atmosphere Modifiers (Spec 03) ──────────────────────────────────────

/**
 * Runtime environment modifier values keyed to chain combo thresholds.
 * All multipliers are relative to the baseline (1.0 = no change).
 */
export interface ChainAtmosphereModifiers {
  /** Multiplier on emitter frequency interval (lower = more particles). 1.0 = no change. */
  particleFrequencyMultiplier: number;
  /** Intensity multiplier for all point lights. 1.0 = no change. */
  lightIntensityMultiplier: number;
  /** Hue blend toward chain color. 0 = no blend, 1 = full chain color. */
  lightColorBlend: number;
  /** Vignette pulse: non-zero enables slow oscillation. Value = peak alpha delta. 0 = off. */
  vignettePulseAmplitude: number;
  /** Screen shake on each card play. 0 = none, 1 = micro, 2 = tier-2. */
  cardPlayShakeTier: 0 | 1 | 2;
  /** Tint overlay alpha (chain color at this opacity over the scene). 0 = none. */
  tintOverlayAlpha: number;
  /** Depth displacement pulse. True = enable breathing uDolly oscillation. */
  depthPulse: boolean;
}

/**
 * Returns environment modifier values for a given chain count and chain type.
 * Returns null for chainCount < 2 (no modifiers active).
 *
 * Thresholds: 2 (subtle), 3 (noticeable), 5 (strong), 7+ (maximum).
 */
export function getChainAtmosphereModifiers(
  chainCount: number,
  chainType: number | undefined,
): ChainAtmosphereModifiers | null {
  // Suppress unused param warning — chainType may be used in future per-type tuning.
  void chainType;

  if (chainCount < 2) return null;

  if (chainCount >= 7) {
    return {
      particleFrequencyMultiplier: 0.5,  // half interval = double rate
      lightIntensityMultiplier: 1.8,
      lightColorBlend: 0.7,
      vignettePulseAmplitude: 0.10,
      cardPlayShakeTier: 2,
      tintOverlayAlpha: 0.05,
      depthPulse: true,
    };
  }
  if (chainCount >= 5) {
    return {
      particleFrequencyMultiplier: 0.5,
      lightIntensityMultiplier: 1.5,
      lightColorBlend: 0.5,
      vignettePulseAmplitude: 0.08,
      cardPlayShakeTier: 1,
      tintOverlayAlpha: 0.05,
      depthPulse: false,
    };
  }
  if (chainCount >= 3) {
    return {
      particleFrequencyMultiplier: 0.7,  // ~40% more particles
      lightIntensityMultiplier: 1.25,
      lightColorBlend: 0.3,
      vignettePulseAmplitude: 0,
      cardPlayShakeTier: 1,
      tintOverlayAlpha: 0,
      depthPulse: false,
    };
  }
  // chainCount === 2
  return {
    particleFrequencyMultiplier: 0.8,  // ~20% more particles
    lightIntensityMultiplier: 1.0,
    lightColorBlend: 0,
    vignettePulseAmplitude: 0,
    cardPlayShakeTier: 0,
    tintOverlayAlpha: 0,
    depthPulse: false,
  };
}
