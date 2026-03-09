/**
 * Image processing pipeline for cardback art.
 * Takes raw PNG from ComfyUI → outputs optimized hires PNG + lowres WebP.
 */

import sharp from 'sharp';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

/**
 * Process a raw cardback PNG from ComfyUI into optimized formats.
 * @param {Buffer} rawPng - Raw PNG buffer from ComfyUI (300x400, already pixelated)
 * @param {string} factId - The fact ID (used for filename)
 * @param {string} outputRoot - Path to public/assets/cardbacks/
 * @returns {Promise<{ hiresPath: string, lowresPath: string, hiresSize: number, lowresSize: number }>}
 */
export async function processCardback(rawPng, factId, outputRoot) {
  const hiresDir = join(outputRoot, 'hires');
  const lowresDir = join(outputRoot, 'lowres');

  // Ensure output directories exist
  await mkdir(hiresDir, { recursive: true });
  await mkdir(lowresDir, { recursive: true });

  // Hires output: 300×400 optimized PNG (~30-50KB)
  const hiresBuf = await sharp(rawPng)
    .png({ compressionLevel: 9, palette: true, colours: 32, dither: 0 })
    .toBuffer();

  const hiresPath = join(hiresDir, `${factId}.png`);
  await writeFile(hiresPath, hiresBuf);

  // Lowres output: 150×200 WebP (~5-10KB)
  const lowresBuf = await sharp(rawPng)
    .resize(150, 200, { kernel: sharp.kernel.nearest })
    .webp({ quality: 80 })
    .toBuffer();

  const lowresPath = join(lowresDir, `${factId}.webp`);
  await writeFile(lowresPath, lowresBuf);

  return {
    hiresPath,
    lowresPath,
    hiresSize: hiresBuf.length,
    lowresSize: lowresBuf.length,
  };
}
