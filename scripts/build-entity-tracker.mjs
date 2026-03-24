#!/usr/bin/env node

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, 'public', 'facts.db');
const outputPath = path.join(projectRoot, 'data', 'ingested-entities.json');

// Mapping from database domain short names to ingestion domain names
const DOMAIN_MAPPING = {
  'animals': 'animals_wildlife',
  'art': 'art_architecture',
  'food': 'food_cuisine',
  'general_knowledge': 'general_knowledge',
  'history': 'history',
  'human_body_health': 'human_body_health',
  'mythology': 'mythology_folklore',
  'science': 'natural_sciences',
  'space': 'space_astronomy'
};

// Helper: normalize entity names for matching (lowercase, handle spaces/underscores/hyphens)
function normalizeForMatch(name) {
  return name.toLowerCase().replace(/[\s_-]+/g, '-');
}

// Load ingestion files
const entitiesToIngestPath = path.join(projectRoot, 'data', 'comparison', 'entities-to-ingest.json');
const entitiesBatch2Path = path.join(projectRoot, 'data', 'ingest-batches', 'entities-batch2.json');

let ingestedEntities = {};
if (fs.existsSync(entitiesToIngestPath)) {
  const batch1 = JSON.parse(fs.readFileSync(entitiesToIngestPath, 'utf8'));
  Object.assign(ingestedEntities, batch1);
}
if (fs.existsSync(entitiesBatch2Path)) {
  const batch2 = JSON.parse(fs.readFileSync(entitiesBatch2Path, 'utf8'));
  Object.entries(batch2).forEach(([domain, entities]) => {
    if (!ingestedEntities[domain]) {
      ingestedEntities[domain] = [];
    }
    ingestedEntities[domain].push(...entities);
  });
}

const totalIngested = Object.values(ingestedEntities).reduce((sum, arr) => sum + arr.length, 0);
console.log(`✓ Loaded ${totalIngested} ingested entities from 2 batches`);

// Open database and extract entities
const db = new Database(dbPath, { readonly: true });
const allFacts = db.prepare("SELECT id FROM facts WHERE id NOT LIKE 'TUTORIAL_%'").all();

// Group facts by domain and first entity part (simple 2-part split)
// Database IDs are like: animals-great-white-shark-liver
// We'll treat "great" as the entity since it's the 2nd segment
const dbEntityCounts = {}; // domain → entity_slug → count

allFacts.forEach(fact => {
  const parts = fact.id.split('-');
  if (parts.length < 2) return; // Skip malformed IDs

  // First part is always the domain
  const dbDomain = parts[0];

  // Second part is the entity (may be just one word)
  const entitySlug = parts[1];

  if (!dbEntityCounts[dbDomain]) {
    dbEntityCounts[dbDomain] = {};
  }

  dbEntityCounts[dbDomain][entitySlug] = (dbEntityCounts[dbDomain][entitySlug] || 0) + 1;
});

db.close();

// Build output structure
const output = {
  lastUpdated: new Date().toISOString().split('T')[0],
  entities: {}
};

// Process each domain from the database (including non-English domains)
Object.keys(dbEntityCounts).sort().forEach(dbDomain => {
  // Skip language codes (single letter domains we don't have ingestion for)
  if (!DOMAIN_MAPPING[dbDomain]) {
    // Language domain or unknown - skip for now
    return;
  }

  // Map database domain to ingestion domain
  const ingestDomain = DOMAIN_MAPPING[dbDomain];
  output.entities[ingestDomain] = [];

  const entities = dbEntityCounts[dbDomain];
  const ingestedInDomain = ingestedEntities[ingestDomain] || [];

  // Add ingested entities first, matching them to database counts
  const addedSlugs = new Set();
  ingestedInDomain.forEach(ingestedEnt => {
    const entityNormalized = normalizeForMatch(ingestedEnt.name);

    // Try to find a matching slug in database by comparing normalized forms
    let factCount = 0;
    for (const [slug, count] of Object.entries(entities)) {
      if (normalizeForMatch(slug) === entityNormalized) {
        factCount = count;
        addedSlugs.add(slug);
        break;
      }
    }

    output.entities[ingestDomain].push({
      name: ingestedEnt.name,
      wiki: ingestedEnt.wiki,
      factCount,
      ingestedAt: new Date().toISOString().split('T')[0]
    });
  });

  // Add database entities that weren't manually ingested (from this domain only)
  Object.keys(entities)
    .sort()
    .forEach(slug => {
      if (!addedSlugs.has(slug)) {
        // Convert database slug to readable name (hyphen-separated)
        const displayName = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        output.entities[ingestDomain].push({
          name: displayName,
          wiki: slug.replace(/-/g, '_'),
          factCount: entities[slug],
          ingestedAt: null
        });
      }
    });
});

// Write output
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

const totalEntities = Object.values(output.entities).reduce((sum, arr) => sum + arr.length, 0);
console.log(`✓ Entity tracker written to ${outputPath}`);
console.log(`✓ Total domains: ${Object.keys(output.entities).length}`);
console.log(`✓ Total entities: ${totalEntities}`);
console.log(`✓ With ingestion dates: ${Object.values(output.entities).flat().filter(e => e.ingestedAt).length}`);
