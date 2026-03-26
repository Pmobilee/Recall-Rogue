#!/usr/bin/env npx tsx
/**
 * Generates highlighted country map images from Natural Earth GeoJSON.
 *
 * For each of ~195 countries, renders a 400x300 WebP showing that country
 * highlighted in bright red on a regional map with neighbors dimmed.
 *
 * Dependencies (install before running):
 *   npm install --save-dev @napi-rs/canvas d3-geo @types/d3-geo
 *   (sharp is already a devDependency)
 *
 * Run:
 *   npx tsx scripts/generate-country-maps.ts          # skip existing files
 *   npx tsx scripts/generate-country-maps.ts --force  # regenerate all
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { createCanvas } from '@napi-rs/canvas';
import * as d3geo from 'd3-geo';
import { geoPath, geoMercator, geoBounds } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import sharp from 'sharp';

// ─── Constants ───────────────────────────────────────────────────────────────

const WIDTH = 400;
const HEIGHT = 300;

/** Dark ocean background */
const OCEAN_COLOR = '#1a1a2e';
/** Dimmed fill for neighboring countries */
const NEIGHBOR_FILL = '#3a3a50';
/** Dimmed border for neighboring countries */
const NEIGHBOR_STROKE = '#555555';
/** Highlighted fill for the target country */
const TARGET_FILL = '#e74c3c';
/** Highlighted border for the target country */
const TARGET_STROKE = '#ffffff';

const OUTPUT_DIR = path.join(process.cwd(), 'public/assets/maps/countries');
const GEO_CACHE = path.join(process.cwd(), 'data/geo/ne_110m_countries.geojson');
const GEO_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';

/** Minimum bounding-box span in degrees before we apply extra zoom-out padding */
const SMALL_COUNTRY_THRESHOLD_DEGREES = 5;
/** Large padding for small countries — zooms OUT to show regional context */
const SMALL_COUNTRY_PADDING_FACTOR = 0.44;
/** Standard padding — generous to show continental context for identification */
const STANDARD_PADDING_FACTOR = 0.35;

// ─── CLI flags ────────────────────────────────────────────────────────────────

const FORCE = process.argv.includes('--force');

// ─── GeoJSON types ───────────────────────────────────────────────────────────

interface CountryProperties {
  NAME?: string;
  ADMIN?: string;
  ISO_A2?: string;
  ISO_A2_EH?: string;
  [key: string]: unknown;
}

interface CountryFeature {
  type: 'Feature';
  properties: CountryProperties;
  geometry: GeoPermissibleObjects;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: CountryFeature[];
}

// ─── Manifest type ────────────────────────────────────────────────────────────

interface ManifestEntry {
  file: string;
  iso: string;
}

// ─── Download helper ──────────────────────────────────────────────────────────

/**
 * Downloads a URL to a local file path, following redirects.
 * Returns a Promise that resolves when the file is fully written.
 */
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(destPath);

    const request = (currentUrl: string): void => {
      https
        .get(currentUrl, (response) => {
          // Follow redirects (301, 302, 307, 308)
          if (
            response.statusCode !== undefined &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            file.close();
            request(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            file.close();
            fs.unlinkSync(destPath);
            reject(new Error(`HTTP ${response.statusCode ?? 'unknown'} for ${currentUrl}`));
            return;
          }

          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          file.close();
          if (fs.existsSync(destPath)) {
            fs.unlinkSync(destPath);
          }
          reject(err);
        });
    };

    request(url);
  });
}

// ─── GeoJSON loader ───────────────────────────────────────────────────────────

/** Loads GeoJSON from cache or downloads it first. */
async function loadGeoJSON(): Promise<FeatureCollection> {
  if (!fs.existsSync(GEO_CACHE)) {
    console.log(`Downloading Natural Earth GeoJSON from:\n  ${GEO_URL}`);
    console.log(`  → Caching to: ${GEO_CACHE}`);
    await downloadFile(GEO_URL, GEO_CACHE);
    console.log('  Download complete.\n');
  } else {
    console.log(`Using cached GeoJSON: ${GEO_CACHE}\n`);
  }

  const raw = fs.readFileSync(GEO_CACHE, 'utf-8');
  return JSON.parse(raw) as FeatureCollection;
}

// ─── ISO code extraction ──────────────────────────────────────────────────────

/**
 * Extracts a clean 2-letter ISO code from a feature's properties.
 * Prefers ISO_A2, falls back to ISO_A2_EH.
 * Returns null for disputed territories with code "-99".
 */
function getIsoA2(props: CountryProperties): string | null {
  // Try ISO_A2 first, fall back to ISO_A2_EH if missing or "-99"
  const primary = props['ISO_A2'];
  const fallback = props['ISO_A2_EH'];
  const code = (primary && primary !== '-99' && primary.trim() !== '')
    ? primary
    : (fallback && fallback !== '-99' && fallback.trim() !== '')
      ? fallback
      : null;
  if (!code) return null;
  return code.trim().toUpperCase();
}

/** Gets the display name from a feature's properties. */
function getCountryName(props: CountryProperties): string {
  return (props['ADMIN'] ?? props['NAME'] ?? 'Unknown').trim();
}

// ─── Bounding-box span helper ─────────────────────────────────────────────────

/**
 * Returns the larger of width/height spans of a GeoJSON feature's geographic
 * bounding box, in degrees. Used to detect very small countries.
 *
 * Uses d3-geo's `geoBounds` which returns [[minLon, minLat], [maxLon, maxLat]]
 * in geographic coordinates — no projection math needed.
 */
function getBoundingSpan(feature: CountryFeature): number {
  const [[minLon, minLat], [maxLon, maxLat]] = geoBounds(
    feature.geometry as GeoPermissibleObjects,
  );
  const lonSpan = Math.abs(maxLon - minLon);
  const latSpan = Math.abs(maxLat - minLat);
  return Math.max(lonSpan, latSpan);
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Renders a single country map to a PNG buffer.
 *
 * @param targetFeature - The country to highlight
 * @param allFeatures   - All country features (for context rendering)
 */
function renderCountryMap(
  targetFeature: CountryFeature,
  allFeatures: CountryFeature[],
): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // ── Ocean background ──
  ctx.fillStyle = OCEAN_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Projection: Mercator centered + fitted to the target country ──
  const projection = geoMercator();

  const iso = getIsoA2(targetFeature.properties);

  // Special handling for antimeridian-crossing countries (Fiji, etc.)
  // fitExtent breaks when bounding box wraps the globe
  const [[minLon], [maxLon]] = geoBounds(
    targetFeature.geometry as GeoPermissibleObjects,
  );
  const crossesAntimeridian = minLon > maxLon;

  if (crossesAntimeridian) {
    // Manual projection: center on centroid with a fixed regional scale
    const centroid = d3geo.geoCentroid(targetFeature.geometry as GeoPermissibleObjects);
    projection
      .center(centroid)
      .scale(600)  // Wide regional zoom to show context (Australia/NZ nearby)
      .translate([WIDTH / 2, HEIGHT / 2]);
  } else {
    // Determine padding: small countries get more padding to show regional context
    const span = getBoundingSpan(targetFeature);
    const paddingFraction =
      span < SMALL_COUNTRY_THRESHOLD_DEGREES
        ? SMALL_COUNTRY_PADDING_FACTOR
        : STANDARD_PADDING_FACTOR;
    const padding = Math.min(WIDTH, HEIGHT) * paddingFraction;

    // fitSize/fitExtent centers and scales the projection so the feature fills
    // [padding, padding] → [WIDTH-padding, HEIGHT-padding]
    projection.fitExtent(
      [
        [padding, padding],
        [WIDTH - padding, HEIGHT - padding],
      ],
      targetFeature.geometry as Parameters<typeof projection.fitExtent>[1],
    );
  }

  // Bind the path generator to the canvas 2D context once.
  // After .context(ctx), calling pathGen(geometry) writes path commands
  // directly onto ctx — no intermediate SVG string allocation.
  const pathGen = geoPath().projection(projection).context(ctx);

  // ── Draw all neighbor countries (dimmed) ──
  ctx.fillStyle = NEIGHBOR_FILL;
  ctx.strokeStyle = NEIGHBOR_STROKE;
  ctx.lineWidth = 1;

  for (const feature of allFeatures) {
    ctx.beginPath();
    pathGen(feature.geometry as GeoPermissibleObjects);
    ctx.fill();
    ctx.stroke();
  }

  // ── Draw target country on top (highlighted) ──
  ctx.fillStyle = TARGET_FILL;
  ctx.strokeStyle = TARGET_STROKE;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  pathGen(targetFeature.geometry as GeoPermissibleObjects);
  ctx.fill();
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load GeoJSON (download if needed)
  const geojson = await loadGeoJSON();

  // Filter to valid features with ISO codes
  const validFeatures = geojson.features.filter((f) => {
    const iso = getIsoA2(f.properties);
    return iso !== null;
  });

  console.log(`Found ${validFeatures.length} countries with valid ISO codes.\n`);

  const manifest: Record<string, ManifestEntry> = {};
  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < validFeatures.length; i++) {
    const feature = validFeatures[i];
    const iso = getIsoA2(feature.properties)!; // already filtered above
    const name = getCountryName(feature.properties);
    const isoLower = iso.toLowerCase();
    const filename = `${isoLower}.webp`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    // Register in manifest regardless of skip/generate
    manifest[name] = { file: filename, iso };

    // Skip if file exists and --force not passed
    if (!FORCE && fs.existsSync(outputPath)) {
      skipped++;
      continue;
    }

    try {
      // Render to PNG buffer
      const pngBuffer = renderCountryMap(feature, validFeatures);

      // Convert to WebP with quality 80
      await sharp(pngBuffer).webp({ quality: 80 }).toFile(outputPath);

      generated++;
      console.log(`Generated ${i + 1}/${validFeatures.length}: ${name} (${filename})`);
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`ERROR ${i + 1}/${validFeatures.length}: ${name} (${isoLower}) — ${message}`);
    }
  }

  // Write manifest
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // Summary
  console.log('\n─── Summary ────────────────────────────────────────────────');
  console.log(`  Generated : ${generated}`);
  console.log(`  Skipped   : ${skipped} (already exist — use --force to regenerate)`);
  console.log(`  Errors    : ${errors}`);
  console.log(`  Manifest  : ${manifestPath}`);
  console.log('────────────────────────────────────────────────────────────\n');

  if (errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
