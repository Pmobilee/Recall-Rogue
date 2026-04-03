/**
 * narrativeLoader.ts — Runtime loader for Woven Narrative Architecture data.
 *
 * Loads pre-converted JSON files from /data/narratives/ (generated at build
 * time by scripts/build-narratives.mjs from YAML source files).
 *
 * Pattern mirrors curatedDeckStore.ts: fetch() from /public/data/ paths,
 * module-level cache, manifest-driven discovery.
 *
 * Design spec: docs/mechanics/narrative.md
 * Source YAML: data/narratives/
 * Build script: scripts/build-narratives.mjs
 * npm script: narratives:build
 */

import type {
  DescentArchetype,
  DomainLens,
  EchoTemplate,
  InhabitantDialogue,
  SeekerLine,
  RelicCallback,
  AmbientLine,
  AnswerType,
} from './narrativeTypes';

// ============================================================
// INTERNAL RAW TYPES
// JSON shapes as produced by the build script — not all fields
// map 1:1 to TS interfaces (e.g. echo files are grouped by type).
// ============================================================

/** Shape of echoes/<type>.json — one file per AnswerType. */
interface EchoFileShape {
  type: string;
  templates: EchoTemplate[];
}

/** Shape of seeker/<category>.json — lines with condition. */
interface SeekerFileShape {
  category: string;
  lines: Array<SeekerLine | RelicCallback>;
}

/** Shape of ambient/<lensId>.json */
interface AmbientFileShape {
  lensId: string;
  lines: AmbientLine[];
}

/** Shape of manifest.json */
interface NarrativeManifest {
  generated: string;
  files: string[];
}

// ============================================================
// MODULE-LEVEL CACHE
// Each cache is populated on first load and never re-fetched.
// ============================================================

const _archetypes: Map<string, DescentArchetype> = new Map();
const _lenses: Map<string, DomainLens> = new Map();
/** Keyed by AnswerType string (e.g. "person"). */
const _echoTemplates: Map<string, EchoTemplate[]> = new Map();
const _inhabitants: Map<string, InhabitantDialogue> = new Map();
/** All seeker lines across all seeker files (excluding relic_callbacks). */
const _seekerLines: SeekerLine[] = [];
const _relicCallbacks: RelicCallback[] = [];
/** Keyed by lensId. */
const _ambientLines: Map<string, AmbientLine[]> = new Map();

let _preloaded = false;
let _preloadPromise: Promise<void> | null = null;

// ============================================================
// FETCH HELPER
// ============================================================

/**
 * Fetch a JSON file from the public/data/narratives/ path.
 * Returns null on network or content-type errors (graceful degradation).
 */
async function fetchNarrativeJson<T>(relativePath: string): Promise<T | null> {
  try {
    const url = `/data/narratives/${relativePath}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`[NarrativeLoader] Failed to fetch ${url}: ${resp.status}`);
      return null;
    }
    const contentType = resp.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      // Vite dev server returns HTML for missing files — skip silently
      console.warn(`[NarrativeLoader] Non-JSON response for ${url} — file may be missing`);
      return null;
    }
    return (await resp.json()) as T;
  } catch (err) {
    console.warn(`[NarrativeLoader] Error fetching ${relativePath}:`, err);
    return null;
  }
}

// ============================================================
// LOADERS (individual file categories)
// ============================================================

/** Load and cache all archetypes from manifest entries. */
async function loadArchetypesFromManifest(files: string[]): Promise<void> {
  const archetypeFiles = files.filter(f => f.startsWith('archetypes/'));
  await Promise.all(
    archetypeFiles.map(async (file) => {
      const data = await fetchNarrativeJson<DescentArchetype>(file);
      if (data?.id) {
        _archetypes.set(data.id, data);
      }
    }),
  );
}

/** Load and cache all domain lenses from manifest entries. */
async function loadLensesFromManifest(files: string[]): Promise<void> {
  const lensFiles = files.filter(f => f.startsWith('lenses/'));
  await Promise.all(
    lensFiles.map(async (file) => {
      const data = await fetchNarrativeJson<DomainLens>(file);
      if (data?.id) {
        _lenses.set(data.id, data);
      }
    }),
  );
}

/** Load and cache all echo template files from manifest entries. */
async function loadEchoesFromManifest(files: string[]): Promise<void> {
  const echoFiles = files.filter(f => f.startsWith('echoes/'));
  await Promise.all(
    echoFiles.map(async (file) => {
      const data = await fetchNarrativeJson<EchoFileShape>(file);
      if (data?.type && Array.isArray(data.templates)) {
        _echoTemplates.set(data.type, data.templates);
      }
    }),
  );
}

/** Load and cache all inhabitant dialogue files from manifest entries. */
async function loadInhabitantsFromManifest(files: string[]): Promise<void> {
  const inhabitantFiles = files.filter(f => f.startsWith('inhabitants/'));
  await Promise.all(
    inhabitantFiles.map(async (file) => {
      const data = await fetchNarrativeJson<InhabitantDialogue>(file);
      if (data?.npc) {
        _inhabitants.set(data.npc, data);
      }
    }),
  );
}

/** Load and cache all seeker files (hp_reactive, streak_reactive, floor_reactive, relic_callbacks). */
async function loadSeekerFromManifest(files: string[]): Promise<void> {
  const seekerFiles = files.filter(f => f.startsWith('seeker/'));
  await Promise.all(
    seekerFiles.map(async (file) => {
      const data = await fetchNarrativeJson<SeekerFileShape>(file);
      if (!data?.category || !Array.isArray(data.lines)) return;

      if (data.category === 'relic_callbacks') {
        // Lines have relicId — they are RelicCallback
        for (const line of data.lines) {
          if ('relicId' in line) {
            _relicCallbacks.push(line as RelicCallback);
          }
        }
      } else {
        // Lines have condition + text — they are SeekerLine
        for (const line of data.lines) {
          if ('id' in line && 'condition' in line && 'text' in line) {
            _seekerLines.push(line as SeekerLine);
          }
        }
      }
    }),
  );
}

/** Load and cache all ambient line files from manifest entries. */
async function loadAmbientFromManifest(files: string[]): Promise<void> {
  const ambientFiles = files.filter(f => f.startsWith('ambient/'));
  await Promise.all(
    ambientFiles.map(async (file) => {
      const data = await fetchNarrativeJson<AmbientFileShape>(file);
      if (data?.lensId && Array.isArray(data.lines)) {
        _ambientLines.set(data.lensId, data.lines);
      }
    }),
  );
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Preload all narrative data in parallel from the manifest.
 * Call once at game initialisation (alongside initializeCuratedDecks).
 * Subsequent calls are no-ops — returns the same resolved promise.
 */
export async function preloadNarrativeData(): Promise<void> {
  if (_preloaded) return;
  if (_preloadPromise) return _preloadPromise;

  _preloadPromise = (async () => {
    const manifest = await fetchNarrativeJson<NarrativeManifest>('manifest.json');
    if (!manifest?.files || manifest.files.length === 0) {
      console.warn('[NarrativeLoader] No manifest found or empty — narrative data unavailable. Run `npm run narratives:build`.');
      return;
    }

    const files = manifest.files;

    // All categories load in parallel
    await Promise.all([
      loadArchetypesFromManifest(files),
      loadLensesFromManifest(files),
      loadEchoesFromManifest(files),
      loadInhabitantsFromManifest(files),
      loadSeekerFromManifest(files),
      loadAmbientFromManifest(files),
    ]);

    _preloaded = true;
    console.log(
      `[NarrativeLoader] Loaded: ${_archetypes.size} archetypes, ${_lenses.size} lenses, ` +
      `${_echoTemplates.size} echo types, ${_inhabitants.size} inhabitants, ` +
      `${_seekerLines.length} seeker lines, ${_relicCallbacks.length} relic callbacks, ` +
      `${_ambientLines.size} ambient sets`,
    );
  })();

  return _preloadPromise;
}

/**
 * Load a specific archetype by ID.
 * Requires preloadNarrativeData() to have been called first.
 * @throws Error if the archetype is not found after preload.
 */
export function loadArchetype(id: string): DescentArchetype {
  const archetype = _archetypes.get(id);
  if (!archetype) {
    throw new Error(`[NarrativeLoader] Archetype '${id}' not found. Ensure preloadNarrativeData() completed.`);
  }
  return archetype;
}

/**
 * Load all archetypes as an array.
 * Requires preloadNarrativeData() to have been called first.
 */
export function loadAllArchetypes(): DescentArchetype[] {
  return Array.from(_archetypes.values());
}

/**
 * Load a domain lens by ID.
 * Requires preloadNarrativeData() to have been called first.
 * @throws Error if the lens is not found after preload.
 */
export function loadLens(id: string): DomainLens {
  const lens = _lenses.get(id);
  if (!lens) {
    throw new Error(`[NarrativeLoader] Lens '${id}' not found. Ensure preloadNarrativeData() completed.`);
  }
  return lens;
}

/**
 * Load all domain lenses as an array.
 * Requires preloadNarrativeData() to have been called first.
 */
export function loadAllLenses(): DomainLens[] {
  return Array.from(_lenses.values());
}

/**
 * Load all echo templates for a given AnswerType.
 * Returns an empty array if no templates exist for that type.
 * Requires preloadNarrativeData() to have been called first.
 */
export function loadEchoTemplates(type: AnswerType | string): EchoTemplate[] {
  return _echoTemplates.get(type) ?? [];
}

/**
 * Load inhabitant dialogue by NPC identifier (e.g. "merchant", "oracle").
 * Requires preloadNarrativeData() to have been called first.
 * @throws Error if the inhabitant is not found after preload.
 */
export function loadInhabitant(npc: string): InhabitantDialogue {
  const inhabitant = _inhabitants.get(npc);
  if (!inhabitant) {
    throw new Error(`[NarrativeLoader] Inhabitant '${npc}' not found. Ensure preloadNarrativeData() completed.`);
  }
  return inhabitant;
}

/**
 * Load all seeker lines (hp_reactive, streak_reactive, floor_reactive combined).
 * Does NOT include relic callbacks — use loadRelicCallbacks() for those.
 * Requires preloadNarrativeData() to have been called first.
 */
export function loadSeekerLines(): SeekerLine[] {
  return _seekerLines;
}

/**
 * Load all relic callback lines.
 * Requires preloadNarrativeData() to have been called first.
 */
export function loadRelicCallbacks(): RelicCallback[] {
  return _relicCallbacks;
}

/**
 * Load ambient lines for a specific lens ID (e.g. "history_ancient").
 * Returns an empty array if no ambient file exists for that lens.
 * Requires preloadNarrativeData() to have been called first.
 */
export function loadAmbientLines(lensId: string): AmbientLine[] {
  return _ambientLines.get(lensId) ?? [];
}

/**
 * Check whether narrative data has been fully preloaded.
 * Useful for guards before synchronous access.
 */
export function isNarrativeDataReady(): boolean {
  return _preloaded;
}

/**
 * Reset all caches (for testing purposes only).
 * @internal
 */
export function _resetNarrativeCache(): void {
  _archetypes.clear();
  _lenses.clear();
  _echoTemplates.clear();
  _inhabitants.clear();
  _seekerLines.length = 0;
  _relicCallbacks.length = 0;
  _ambientLines.clear();
  _preloaded = false;
  _preloadPromise = null;
}
