import sharp from 'sharp';

/**
 * Remove green screen background from an image buffer.
 * Samples corner pixels to detect the actual green used by the AI model,
 * then applies tolerance-based chroma keying with edge despill.
 *
 * @param {Buffer} inputBuffer - Raw PNG image buffer
 * @param {object} options
 * @param {number} options.tolerance - RGB color distance threshold (default: 80)
 * @param {number} options.despillStrength - Green channel reduction for edge pixels 0-1 (default: 0.5)
 * @returns {Promise<Buffer>} Processed buffer with alpha channel
 */
export async function removeGreenScreen(inputBuffer, options = {}) {
  const { tolerance = 80, despillStrength = 0.5 } = options;

  const image = sharp(inputBuffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Sample 4 corner pixels (10px in from each corner) to detect actual green
  const cornerOffsets = [
    { x: 10, y: 10 },
    { x: width - 11, y: 10 },
    { x: 10, y: height - 11 },
    { x: width - 11, y: height - 11 },
  ];

  let totalR = 0, totalG = 0, totalB = 0;
  let sampleCount = 0;

  for (const { x, y } of cornerOffsets) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const idx = (y * width + x) * channels;
      totalR += data[idx];
      totalG += data[idx + 1];
      totalB += data[idx + 2];
      sampleCount++;
    }
  }

  const keyR = Math.round(totalR / sampleCount);
  const keyG = Math.round(totalG / sampleCount);
  const keyB = Math.round(totalB / sampleCount);

  console.log(`  Green screen key color: rgb(${keyR}, ${keyG}, ${keyB})`);

  // Process each pixel
  const output = Buffer.from(data);

  for (let i = 0; i < width * height; i++) {
    const idx = i * channels;
    const r = output[idx];
    const g = output[idx + 1];
    const b = output[idx + 2];

    // Calculate color distance from key color
    const dist = Math.sqrt(
      (r - keyR) ** 2 +
      (g - keyG) ** 2 +
      (b - keyB) ** 2
    );

    if (dist < tolerance * 0.6) {
      // Fully transparent — clearly background
      output[idx + 3] = 0;
    } else if (dist < tolerance) {
      // Semi-transparent edge — partial alpha + despill
      const alpha = Math.round(255 * ((dist - tolerance * 0.6) / (tolerance * 0.4)));
      output[idx + 3] = Math.min(alpha, output[idx + 3]);

      // Despill: reduce green contamination on edge pixels
      const maxRB = Math.max(r, b);
      if (g > maxRB) {
        output[idx + 1] = Math.round(g - (g - maxRB) * despillStrength);
      }
    }
    // else: fully opaque, leave as-is
  }

  return sharp(output, { raw: { width, height, channels } })
    .png()
    .toBuffer();
}
