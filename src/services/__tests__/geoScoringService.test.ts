/**
 * Unit tests for geoScoringService.ts
 *
 * Tests: haversineDistance, calculateGeoAccuracy, getGeoThresholds
 */

import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  calculateGeoAccuracy,
  getGeoThresholds,
} from '../geoScoringService';

describe('haversineDistance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(51.5074, -0.1278, 51.5074, -0.1278)).toBe(0);
  });

  it('calculates London to Paris as approximately 344 km', () => {
    // London: 51.5074, -0.1278 / Paris: 48.8566, 2.3522
    const dist = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBeGreaterThan(330);
    expect(dist).toBeLessThan(360);
  });

  it('calculates NYC to LA as approximately 3944 km', () => {
    // New York: 40.7128, -74.0060 / Los Angeles: 34.0522, -118.2437
    const dist = haversineDistance(40.7128, -74.0060, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(3900);
    expect(dist).toBeLessThan(4000);
  });

  it('is symmetric (A→B == B→A)', () => {
    const ab = haversineDistance(48.8566, 2.3522, 35.6762, 139.6503);
    const ba = haversineDistance(35.6762, 139.6503, 48.8566, 2.3522);
    expect(ab).toBeCloseTo(ba, 5);
  });

  it('returns positive values for non-zero distances', () => {
    const dist = haversineDistance(0, 0, 0, 1);
    expect(dist).toBeGreaterThan(0);
  });
});

describe('calculateGeoAccuracy — mastery 0 (fullCredit=500, partialFloor=1500)', () => {
  it('returns 1.0 at 0 km', () => {
    expect(calculateGeoAccuracy(0, 0)).toBe(1.0);
  });

  it('returns 1.0 at exactly fullCreditRadius (500 km)', () => {
    expect(calculateGeoAccuracy(500, 0)).toBe(1.0);
  });

  it('returns approximately 0.5 at midpoint (1000 km)', () => {
    // midpoint between 500 and 1500 = 1000
    expect(calculateGeoAccuracy(1000, 0)).toBeCloseTo(0.5, 5);
  });

  it('returns 0.0 at exactly partialFloor (1500 km)', () => {
    expect(calculateGeoAccuracy(1500, 0)).toBe(0.0);
  });

  it('returns 0.0 beyond partialFloor (2000 km)', () => {
    expect(calculateGeoAccuracy(2000, 0)).toBe(0.0);
  });

  it('interpolates linearly between thresholds', () => {
    // 750 km is 250/1000 of the way from 500 to 1500 → accuracy = 0.75
    expect(calculateGeoAccuracy(750, 0)).toBeCloseTo(0.75, 5);
  });
});

describe('calculateGeoAccuracy — mastery 5 (fullCredit=40, partialFloor=150)', () => {
  it('returns 1.0 at 0 km', () => {
    expect(calculateGeoAccuracy(0, 5)).toBe(1.0);
  });

  it('returns 1.0 at exactly fullCreditRadius (40 km)', () => {
    expect(calculateGeoAccuracy(40, 5)).toBe(1.0);
  });

  it('returns approximately 0.5 at midpoint (95 km)', () => {
    // midpoint between 40 and 150 = 95
    expect(calculateGeoAccuracy(95, 5)).toBeCloseTo(0.5, 5);
  });

  it('returns 0.0 at partialFloor (150 km)', () => {
    expect(calculateGeoAccuracy(150, 5)).toBe(0.0);
  });

  it('returns 0.0 beyond partialFloor (200 km)', () => {
    expect(calculateGeoAccuracy(200, 5)).toBe(0.0);
  });
});

describe('getGeoThresholds', () => {
  it('returns correct values for mastery 0', () => {
    const t = getGeoThresholds(0);
    expect(t.fullCreditRadiusKm).toBe(500);
    expect(t.partialFloorKm).toBe(1500);
  });

  it('returns correct values for mastery 1', () => {
    const t = getGeoThresholds(1);
    expect(t.fullCreditRadiusKm).toBe(350);
    expect(t.partialFloorKm).toBe(1000);
  });

  it('returns correct values for mastery 2', () => {
    const t = getGeoThresholds(2);
    expect(t.fullCreditRadiusKm).toBe(250);
    expect(t.partialFloorKm).toBe(750);
  });

  it('returns correct values for mastery 3', () => {
    const t = getGeoThresholds(3);
    expect(t.fullCreditRadiusKm).toBe(150);
    expect(t.partialFloorKm).toBe(500);
  });

  it('returns correct values for mastery 4', () => {
    const t = getGeoThresholds(4);
    expect(t.fullCreditRadiusKm).toBe(80);
    expect(t.partialFloorKm).toBe(300);
  });

  it('returns correct values for mastery 5', () => {
    const t = getGeoThresholds(5);
    expect(t.fullCreditRadiusKm).toBe(40);
    expect(t.partialFloorKm).toBe(150);
  });

  it('clamps negative mastery to mastery 0', () => {
    const t = getGeoThresholds(-1);
    expect(t.fullCreditRadiusKm).toBe(500);
    expect(t.partialFloorKm).toBe(1500);
  });

  it('clamps mastery above 5 to mastery 5', () => {
    const t = getGeoThresholds(10);
    expect(t.fullCreditRadiusKm).toBe(40);
    expect(t.partialFloorKm).toBe(150);
  });
});
