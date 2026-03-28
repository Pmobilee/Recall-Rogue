/**
 * batch-animate.mjs — Overnight batch runner for LTX-2.3 sprite animations
 *
 * Processes all jobs from /tmp/animation_jobs.json sequentially.
 * Saves raw frames only (--skip-postprocess). Handles ComfyUI restarts.
 *
 * Usage:
 *   node sprite-gen/scripts/batch-animate.mjs
 *   node sprite-gen/scripts/batch-animate.mjs --start-from 10   # Resume from job #10
 *   node sprite-gen/scripts/batch-animate.mjs --dry-run          # Preview without running
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');

const COMFYUI_DIR = '/Users/damion/CODE/ComfyUI';
const COMFYUI_URL = 'http://localhost:8188';
const JOBS_FILE = '/tmp/animation_jobs.json';
const PROGRESS_FILE = '/tmp/animation_batch_progress.json';
const OUTPUT_DIR = join(PROJECT_ROOT, 'sprite-gen/output/animations');
const ANIMATE_SCRIPT = join(PROJECT_ROOT, 'sprite-gen/scripts/animate-sprite.mjs');

/** Check if ComfyUI is responding */
async function isComfyUIAlive() {
  try {
    const resp = await fetch(`${COMFYUI_URL}/system_stats`, { signal: AbortSignal.timeout(5000) });
    return resp.ok;
  } catch {
    return false;
  }
}

/** Restart ComfyUI and wait for it to be ready */
async function restartComfyUI() {
  console.log('  [RESTART] Killing existing ComfyUI...');
  try { execSync('lsof -ti:8188 | xargs kill -9 2>/dev/null', { stdio: 'ignore' }); } catch {}
  await sleep(3000);

  console.log('  [RESTART] Starting ComfyUI...');
  execSync(
    `cd "${COMFYUI_DIR}" && .venv/bin/python main.py --listen 0.0.0.0 --port 8188 > /tmp/comfyui-startup.log 2>&1 &`,
    { shell: '/bin/zsh' }
  );

  // Wait up to 90s for startup
  for (let i = 0; i < 18; i++) {
    await sleep(5000);
    if (await isComfyUIAlive()) {
      console.log('  [RESTART] ComfyUI ready!');
      return true;
    }
  }
  console.error('  [RESTART] FAILED — ComfyUI did not start within 90s');
  return false;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Save progress to disk so we can resume */
async function saveProgress(completed, failed, currentIdx) {
  const progress = { completed, failed, currentIdx, timestamp: new Date().toISOString() };
  await writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/** Load saved progress */
async function loadProgress() {
  try {
    const data = JSON.parse(await readFile(PROGRESS_FILE, 'utf-8'));
    return data;
  } catch {
    return { completed: [], failed: [], currentIdx: 0 };
  }
}

/** Run a single animation job */
async function runJob(job, idx, total) {
  const outputDir = join(OUTPUT_DIR, job.output_name);
  const rawFramesDir = join(outputDir, 'raw-frames');

  // Skip if already completed
  if (existsSync(rawFramesDir)) {
    const files = execSync(`ls "${rawFramesDir}" 2>/dev/null | grep -c .png || echo 0`, { encoding: 'utf-8' }).trim();
    if (parseInt(files) >= 50) {
      console.log(`  [SKIP] ${job.output_name} — already has ${files} frames`);
      return 'skipped';
    }
  }

  // Write prompt to temp file to avoid shell escaping issues
  const promptFile = `/tmp/anim_prompt_${idx}.txt`;
  await writeFile(promptFile, job.prompt);

  const cmd = [
    'node', `"${ANIMATE_SCRIPT}"`,
    '--sprite', `"${join(PROJECT_ROOT, job.sprite_path)}"`,
    '--name', `"${job.output_name}"`,
    '--target-size', '768',
    '--duration', '3',
    '--seed', String(100 + idx),
    '--skip-postprocess',
    '--prompt', `"$(cat ${promptFile})"`,
  ].join(' ');

  try {
    execSync(cmd, {
      stdio: 'inherit',
      timeout: 1_800_000, // 30 min max per job
      shell: '/bin/zsh',
      cwd: PROJECT_ROOT,
    });
    return 'completed';
  } catch (e) {
    console.error(`  [ERROR] ${job.output_name}: ${e.message?.slice(0, 200)}`);
    return 'failed';
  }
}

async function main() {
  const { values: args } = parseArgs({
    options: {
      'start-from': { type: 'string', default: '0' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: true,
  });

  const jobs = JSON.parse(await readFile(JOBS_FILE, 'utf-8'));
  const startFrom = parseInt(args['start-from']);
  const dryRun = args['dry-run'];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`BATCH ANIMATION RUNNER — ${jobs.length} jobs total`);
  console.log(`Starting from job #${startFrom}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`${'='.repeat(60)}\n`);

  if (dryRun) {
    for (let i = startFrom; i < jobs.length; i++) {
      console.log(`[${i + 1}/${jobs.length}] ${jobs[i].output_name} — ${jobs[i].enemy_name} ${jobs[i].anim_type}`);
    }
    console.log(`\nDry run complete. ${jobs.length - startFrom} jobs would be processed.`);
    return;
  }

  // Ensure ComfyUI is running
  if (!await isComfyUIAlive()) {
    console.log('ComfyUI not running, starting...');
    if (!await restartComfyUI()) {
      console.error('Cannot start ComfyUI. Aborting.');
      process.exit(1);
    }
  }

  const completed = [];
  const failed = [];
  let consecutiveFailures = 0;

  for (let i = startFrom; i < jobs.length; i++) {
    const job = jobs[i];
    const elapsed = completed.length > 0
      ? ` (~${((completed.length + failed.length) * 8 / 60).toFixed(1)}h elapsed)`
      : '';
    console.log(`\n[${'='.repeat(50)}]`);
    console.log(`[${i + 1}/${jobs.length}] ${job.output_name} — ${job.enemy_name} ${job.anim_type}${elapsed}`);
    console.log(`[${'='.repeat(50)}]`);

    // Health check before each job
    if (!await isComfyUIAlive()) {
      console.log('  ComfyUI down — restarting...');
      if (!await restartComfyUI()) {
        console.error('  Failed to restart ComfyUI. Waiting 60s and retrying...');
        await sleep(60000);
        if (!await restartComfyUI()) {
          console.error('  ComfyUI permanently down. Saving progress and exiting.');
          await saveProgress(completed, failed, i);
          process.exit(1);
        }
      }
      // Give it an extra moment after restart before heavy work
      await sleep(5000);
    }

    const result = await runJob(job, i, jobs.length);

    if (result === 'completed' || result === 'skipped') {
      completed.push(job.output_name);
      consecutiveFailures = 0;
    } else {
      failed.push(job.output_name);
      consecutiveFailures++;

      // If 3 consecutive failures, restart ComfyUI
      if (consecutiveFailures >= 3) {
        console.log('  3 consecutive failures — restarting ComfyUI...');
        await restartComfyUI();
        consecutiveFailures = 0;
      }
    }

    // Save progress every job
    await saveProgress(completed, failed, i + 1);

    // Brief pause between jobs to let MPS memory settle
    await sleep(3000);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`BATCH COMPLETE!`);
  console.log(`  Completed: ${completed.length}`);
  console.log(`  Failed: ${failed.length}`);
  console.log(`  Total: ${jobs.length}`);
  if (failed.length > 0) {
    console.log(`\nFailed jobs:`);
    for (const f of failed) console.log(`  - ${f}`);
  }
  console.log(`${'='.repeat(60)}`);
}

main().catch(e => {
  console.error('[FATAL]', e.message);
  process.exit(1);
});
