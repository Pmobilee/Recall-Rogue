/**
 * Worker bootstrap: registers the tsx ESM hooks so .ts files resolve
 * in a worker_threads Worker context, then imports the actual worker.
 *
 * Also registers the import.meta.env loader hook so that turnManager.ts
 * debug-logging code paths (guarded by import.meta.env.DEV) don't crash
 * in workers when activeRunState is now properly initialized.
 */
import { register as registerTsx } from 'tsx/esm/api';
import { register as registerLoader } from 'node:module';
import { pathToFileURL } from 'node:url';
import { fileURLToPath, URL } from 'node:url';
import { workerData } from 'node:worker_threads';

registerTsx();

// Register the import.meta.env patcher so turnManager's DEV-only logs don't crash
const loaderHookUrl = new URL('./loader-hook.mjs', import.meta.url).href;
registerLoader(loaderHookUrl, pathToFileURL('./'));

// Import the actual .ts worker file
// The workerData.workerFile path is passed by the spawner
await import(workerData.workerFile);
