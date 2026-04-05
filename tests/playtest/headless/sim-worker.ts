/**
 * Headless Sim Worker
 * ===================
 * Runs in a worker_threads Worker. Receives simulation tasks from the main thread,
 * executes them, and posts results back.
 *
 * Must import browser-shim before any game imports.
 */

import './browser-shim.js';

import { parentPort } from 'node:worker_threads';
import { simulateFullRun, type FullRunOptions, type FullRunResult } from './full-run-simulator.js';
import { runSimulation, type SimOptions, type SimRunResult } from './simulator.js';

// ──────────────────────────────────────────────────────────────────────────────
// Message protocol
// ──────────────────────────────────────────────────────────────────────────────

/** Sent from main thread to worker. */
export interface WorkerTask {
  taskId: number;
  mode: 'full' | 'combat';
  profileLabel: string;
  runs: number;
  /** FullRunOptions (minus per-run varying bits) for mode=full */
  fullRunOptions?: Omit<FullRunOptions, 'verbose'>;
  /** SimOptions (minus per-run varying bits) for mode=combat */
  combatOptions?: Omit<SimOptions, 'verbose'>;
}

/** Sent from worker to main thread. */
export interface WorkerResult {
  taskId: number;
  profileLabel: string;
  mode: 'full' | 'combat';
  results: FullRunResult[] | SimRunResult[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Worker message handler
// ──────────────────────────────────────────────────────────────────────────────

if (!parentPort) {
  throw new Error('sim-worker.ts must be run as a worker_threads Worker, not directly.');
}

/** Persistent message loop — handles multiple tasks before shutdown. */
parentPort.on('message', (msg: WorkerTask | { type: 'shutdown' }) => {
  // Shutdown signal from pool manager
  if ('type' in msg && msg.type === 'shutdown') {
    process.exit(0);
    return;
  }

  const task = msg as WorkerTask;
  const results: FullRunResult[] | SimRunResult[] = [];

  if (task.mode === 'full') {
    const opts = task.fullRunOptions!;
    for (let i = 0; i < task.runs; i++) {
      const r = simulateFullRun({ ...opts, verbose: false } as FullRunOptions);
      (results as FullRunResult[]).push(r);
    }
  } else {
    const opts = task.combatOptions!;
    for (let i = 0; i < task.runs; i++) {
      const r = runSimulation({ ...opts, verbose: false } as SimOptions);
      (results as SimRunResult[]).push(r);
    }
  }

  const response: WorkerResult = {
    taskId: task.taskId,
    profileLabel: task.profileLabel,
    mode: task.mode,
    results,
  };

  parentPort!.postMessage(response);
  // Stay alive to receive more tasks (pool reuse) or shutdown signal
});
