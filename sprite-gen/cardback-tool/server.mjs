import express from 'express';
import Database from 'better-sqlite3';
import { resolve, dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readdirSync, mkdirSync, writeFileSync, readFileSync } from 'fs';

import { submitCardback, waitForCompletion, readComfyUIOutput } from './comfyui-queue.mjs';
import { processCardback } from './image-pipeline.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const DB_PATH = resolve(__dirname, 'cardbacks.db');
const PORT = 5175;

const SEED_DIR = resolve(PROJECT_ROOT, 'src/data/seed');
const HIRES_DIR = resolve(PROJECT_ROOT, 'public/assets/cardbacks/hires');
const LOWRES_DIR = resolve(PROJECT_ROOT, 'public/assets/cardbacks/lowres');

// Ensure output directories exist
mkdirSync(HIRES_DIR, { recursive: true });
mkdirSync(LOWRES_DIR, { recursive: true });

// --- Database Setup ---
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS cardbacks (
    fact_id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    category TEXT NOT NULL,
    fact_type TEXT NOT NULL,
    statement TEXT NOT NULL,
    visual_description TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT DEFAULT '',
    file_path_hires TEXT,
    file_path_lowres TEXT,
    comfyui_prompt_id TEXT,
    generated_at TEXT,
    reviewed_at TEXT,
    generation_count INTEGER DEFAULT 0,
    seed INTEGER
  );
`);

// --- Prepared Statements ---
const stmtInsert = db.prepare(`
  INSERT OR IGNORE INTO cardbacks (fact_id, domain, category, fact_type, statement, visual_description)
  VALUES (@fact_id, @domain, @category, @fact_type, @statement, @visual_description)
`);

const stmtUpdateFilePaths = db.prepare(`
  UPDATE cardbacks
  SET file_path_hires = @file_path_hires,
      file_path_lowres = @file_path_lowres,
      status = CASE WHEN status = 'pending' THEN 'review' ELSE status END
  WHERE fact_id = @fact_id AND (file_path_hires IS NULL OR file_path_lowres IS NULL)
`);

const stmtGetById = db.prepare(`SELECT * FROM cardbacks WHERE fact_id = ?`);

const stmtUpdateReview = db.prepare(`
  UPDATE cardbacks SET status = @status, notes = @notes, reviewed_at = @reviewed_at WHERE fact_id = @fact_id
`);

const stmtUpdateDescription = db.prepare(`
  UPDATE cardbacks SET visual_description = @visual_description WHERE fact_id = @fact_id
`);

const stmtUpdateGenerating = db.prepare(`
  UPDATE cardbacks SET status = 'generating', generation_count = generation_count + 1 WHERE fact_id = ?
`);

const stmtUpdateGenerated = db.prepare(`
  UPDATE cardbacks
  SET status = 'review',
      file_path_hires = @file_path_hires,
      file_path_lowres = @file_path_lowres,
      comfyui_prompt_id = @comfyui_prompt_id,
      generated_at = @generated_at,
      seed = @seed
  WHERE fact_id = @fact_id
`);

const stmtRevertPending = db.prepare(`
  UPDATE cardbacks SET status = 'pending' WHERE fact_id = ?
`);

// --- Batch Controller ---
class BatchController {
  #running = false;
  #stopRequested = false;
  #queue = [];
  #completed = [];
  #failed = [];
  #current = null;
  #sseClients = new Set();

  start(factIds) {
    if (this.#running) return;
    this.#running = true;
    this.#stopRequested = false;
    this.#queue = [...factIds];
    this.#completed = [];
    this.#failed = [];
    this.#current = null;
    this.#processQueue();
  }

  stop() {
    this.#stopRequested = true;
  }

  getStatus() {
    return {
      running: this.#running,
      total: this.#queue.length + this.#completed.length + this.#failed.length + (this.#current ? 1 : 0),
      completed: this.#completed.length,
      failed: this.#failed.length,
      remaining: this.#queue.length,
      current: this.#current,
    };
  }

  addSSEClient(res) {
    this.#sseClients.add(res);
  }

  removeSSEClient(res) {
    this.#sseClients.delete(res);
  }

  #broadcast(event) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.#sseClients) {
      try {
        client.write(data);
      } catch {
        this.#sseClients.delete(client);
      }
    }
  }

  #saveCheckpoint() {
    const state = {
      running: this.#running,
      current: this.#current,
      completed: this.#completed,
      failed: this.#failed,
      remaining: this.#queue,
      timestamp: new Date().toISOString(),
    };
    try {
      writeFileSync(resolve(__dirname, 'batch-state.json'), JSON.stringify(state, null, 2));
    } catch {
      // Non-critical — continue processing
    }
  }

  async #processQueue() {
    while (this.#queue.length > 0 && !this.#stopRequested) {
      const factId = this.#queue.shift();
      this.#current = factId;

      this.#broadcast({
        type: 'progress',
        completed: this.#completed.length,
        total: this.#completed.length + this.#failed.length + this.#queue.length + 1,
        failed: this.#failed.length,
        current: factId,
      });

      try {
        await generateSingleCard(factId);
        this.#completed.push(factId);
        this.#broadcast({
          type: 'image_done',
          factId,
          thumbUrl: `/api/cards/${encodeURIComponent(factId)}/thumb`,
        });
      } catch (err) {
        this.#failed.push(factId);
        this.#broadcast({
          type: 'error',
          factId,
          message: err.message,
        });
      }

      this.#saveCheckpoint();
    }

    this.#current = null;
    this.#running = false;
    this.#broadcast({
      type: 'done',
      completed: this.#completed.length,
      failed: this.#failed.length,
    });
    this.#saveCheckpoint();
  }
}

const batchController = new BatchController();

// --- Card Generation Helper ---
async function generateSingleCard(factId) {
  const row = stmtGetById.get(factId);
  if (!row) throw new Error(`Card not found: ${factId}`);

  stmtUpdateGenerating.run(factId);

  try {
    // Submit to ComfyUI
    const seed = Math.floor(Math.random() * 2 ** 32);
    const promptId = await submitCardback(row.visual_description, seed);
    const outputFiles = await waitForCompletion(promptId);
    const rawPng = await readComfyUIOutput(outputFiles[0]);

    // Process through image pipeline (resize, format conversion, etc.)
    const outputRoot = resolve(PROJECT_ROOT, 'public/assets/cardbacks');
    const { hiresPath, lowresPath } = await processCardback(rawPng, factId, outputRoot);

    // Update DB
    stmtUpdateGenerated.run({
      fact_id: factId,
      file_path_hires: hiresPath,
      file_path_lowres: lowresPath,
      comfyui_prompt_id: promptId,
      generated_at: new Date().toISOString(),
      seed: seed ?? null,
    });

    return { hiresPath, lowresPath };
  } catch (err) {
    stmtRevertPending.run(factId);
    throw err;
  }
}

// --- Seed File Scanner ---
function scanSeedFiles() {
  const facts = [];

  function readJsonFile(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  function walkDir(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.json') {
        const data = readJsonFile(fullPath);
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.id && item.statement) {
              facts.push(item);
            }
          }
        }
      }
    }
  }

  walkDir(SEED_DIR);
  return facts;
}

// --- Express App ---
const app = express();
app.use(express.json());

// CORS for dev
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Static files
app.use(express.static(resolve(__dirname, 'public')));

// --- API Endpoints ---

// List all cards (with filters and pagination)
app.get('/api/cards', (req, res) => {
  const { domain, status, search, type, page, limit: limitParam } = req.query;
  const limitRaw = parseInt(limitParam);
  const limit = limitRaw === 0 ? null : Math.min(limitRaw || 50, 2000);
  const offset = limit ? ((parseInt(page) || 1) - 1) * limit : 0;

  let where = [];
  let params = {};

  if (domain) {
    where.push('domain = @domain');
    params.domain = domain;
  }
  if (status) {
    where.push('status = @status');
    params.status = status;
  }
  if (type) {
    where.push('fact_type = @type');
    params.type = type;
  }
  if (search) {
    where.push('(statement LIKE @search OR fact_id LIKE @search OR visual_description LIKE @search)');
    params.search = `%${search}%`;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = limit
    ? `SELECT * FROM cardbacks ${whereClause} ORDER BY domain, fact_id LIMIT @limit OFFSET @offset`
    : `SELECT * FROM cardbacks ${whereClause} ORDER BY domain, fact_id`;
  if (limit) {
    params.limit = limit;
    params.offset = offset;
  }

  const rows = db.prepare(sql).all(params);
  res.json(rows);
});

// Get single card
app.get('/api/cards/:id', (req, res) => {
  const row = stmtGetById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

// Serve lowres thumbnail
app.get('/api/cards/:id/thumb', (req, res) => {
  const row = stmtGetById.get(req.params.id);
  if (!row || !row.file_path_lowres || !existsSync(row.file_path_lowres)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({ error: 'thumbnail not found' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(row.file_path_lowres);
});

// Serve hires full image
app.get('/api/cards/:id/full', (req, res) => {
  const row = stmtGetById.get(req.params.id);
  if (!row || !row.file_path_hires || !existsSync(row.file_path_hires)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({ error: 'full image not found' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(row.file_path_hires);
});

// Review a card
app.post('/api/cards/:id/review', (req, res) => {
  const { status, notes } = req.body;
  const row = stmtGetById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be accepted or rejected' });
  }

  stmtUpdateReview.run({
    fact_id: req.params.id,
    status,
    notes: notes !== undefined ? notes : row.notes,
    reviewed_at: new Date().toISOString(),
  });
  res.json({ ok: true });
});

// Generate single card
app.post('/api/cards/:id/generate', async (req, res) => {
  const row = stmtGetById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });

  try {
    const result = await generateSingleCard(req.params.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update visual description
app.post('/api/cards/:id/description', (req, res) => {
  const { visualDescription } = req.body;
  const row = stmtGetById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });

  stmtUpdateDescription.run({
    fact_id: req.params.id,
    visual_description: visualDescription,
  });
  res.json({ ok: true });
});

// Scan seed files and populate DB
app.post('/api/scan', (req, res) => {
  const facts = scanSeedFiles();
  let added = 0;
  let updated = 0;

  const insertMany = db.transaction((items) => {
    for (const fact of items) {
      // Extract domain from category array (first element) or use 'unknown'
      const categoryArr = Array.isArray(fact.category) ? fact.category : [];
      const domain = categoryArr[0] || 'unknown';
      const category = categoryArr.join(' > ');

      const result = stmtInsert.run({
        fact_id: fact.id,
        domain,
        category,
        fact_type: fact.type || 'fact',
        statement: fact.statement,
        visual_description: fact.visualDescription || null,
      });
      if (result.changes > 0) added++;

      // Check if hires/lowres files already exist on disk
      const hiresPath = resolve(HIRES_DIR, `${fact.id}.png`);
      const lowresPath = resolve(LOWRES_DIR, `${fact.id}.webp`);
      const hiresExists = existsSync(hiresPath);
      const lowresExists = existsSync(lowresPath);

      if (hiresExists || lowresExists) {
        const upResult = stmtUpdateFilePaths.run({
          fact_id: fact.id,
          file_path_hires: hiresExists ? hiresPath : null,
          file_path_lowres: lowresExists ? lowresPath : null,
        });
        if (upResult.changes > 0) updated++;
      }
    }
  });

  insertMany(facts);

  const total = db.prepare('SELECT COUNT(*) as count FROM cardbacks').get().count;
  res.json({ added, updated, total });
});

// Stats
app.get('/api/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='generating' THEN 1 ELSE 0 END) as generating,
      SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN status='accepted' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected
    FROM cardbacks
  `).get();
  res.json(stats);
});

// Domains
app.get('/api/domains', (req, res) => {
  const domains = db.prepare('SELECT DISTINCT domain FROM cardbacks ORDER BY domain').all();
  res.json(domains.map(d => d.domain));
});

// Batch start
app.post('/api/batch/start', (req, res) => {
  const status = batchController.getStatus();
  if (status.running) {
    return res.status(409).json({ error: 'Batch already running', ...status });
  }

  const { filter } = req.body || {};
  let where = [];
  let params = {};

  // Exclude already accepted cards
  where.push("status != 'accepted'");

  if (filter?.domain) {
    where.push('domain = @domain');
    params.domain = filter.domain;
  }
  if (filter?.status) {
    where.push('status = @filterStatus');
    params.filterStatus = filter.status;
  }
  if (filter?.type) {
    where.push('fact_type = @type');
    params.type = filter.type;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT fact_id FROM cardbacks ${whereClause} ORDER BY domain, fact_id`).all(params);
  const factIds = rows.map(r => r.fact_id);

  if (factIds.length === 0) {
    return res.json({ message: 'No cards to generate', total: 0 });
  }

  batchController.start(factIds);
  res.json({ message: 'Batch started', total: factIds.length });
});

// Batch stop
app.post('/api/batch/stop', (req, res) => {
  batchController.stop();
  res.json({ ok: true, ...batchController.getStatus() });
});

// Batch status (SSE stream)
app.get('/api/batch/status', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send current status immediately
  const status = batchController.getStatus();
  res.write(`data: ${JSON.stringify({ type: 'progress', ...status })}\n\n`);

  batchController.addSSEClient(res);

  req.on('close', () => {
    batchController.removeSSEClient(res);
  });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Cardback Dashboard running at http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log(`Seed dir: ${SEED_DIR}`);
  console.log(`Output: ${HIRES_DIR} / ${LOWRES_DIR}`);
});
