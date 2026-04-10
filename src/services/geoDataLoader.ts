/**
 * Lazy-loaded GeoJSON data for the Map Pin Drop quiz component.
 *
 * Fetches the Natural Earth 110m countries dataset on first use and caches it
 * in memory for the lifetime of the session. Subsequent calls return the
 * cached result immediately with no network round-trip.
 *
 * The GeoJSON file is expected at /data/geo/ne_110m_countries.geojson,
 * served by Vite/Capacitor from the public/ directory.
 */

import type { FeatureCollection } from 'geojson';

let cachedGeoJson: FeatureCollection | null = null;
let loadPromise: Promise<FeatureCollection> | null = null;

/**
 * Load the world countries GeoJSON. Cached after first load.
 * Safe to call multiple times — only one network request is made.
 *
 * @throws Error if the fetch fails (e.g. file not found, network error).
 */
export async function loadWorldGeoJson(): Promise<FeatureCollection> {
  if (cachedGeoJson) return cachedGeoJson;
  if (loadPromise) return loadPromise;

  loadPromise = fetch('/data/geo/ne_110m_countries.geojson')
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load GeoJSON: ${r.status} ${r.statusText}`);
      return r.json() as Promise<FeatureCollection>;
    })
    .then((data) => {
      cachedGeoJson = data;
      loadPromise = null;
      return data;
    })
    .catch((err: unknown) => {
      // Clear the promise so the next call can retry
      loadPromise = null;
      throw err;
    });

  return loadPromise;
}

/**
 * Check if GeoJSON is already loaded and cached (synchronous).
 * Use this to avoid triggering a load when only a quick existence check is needed.
 */
export function isGeoJsonLoaded(): boolean {
  return cachedGeoJson !== null;
}

/**
 * Get the cached GeoJSON synchronously.
 * Returns null if not yet loaded — call loadWorldGeoJson() first.
 */
export function getCachedGeoJson(): FeatureCollection | null {
  return cachedGeoJson;
}
