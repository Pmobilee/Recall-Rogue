import sharp from 'sharp';

/**
 * Auto-crop transparent edges from an image, leaving 1px padding.
 * @param {Buffer} buffer - PNG image buffer with alpha channel
 * @returns {Promise<Buffer>} Cropped PNG buffer
 */
export async function autoCrop(buffer) {
  const image = sharp(buffer);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    // Fully transparent image — return as-is
    return buffer;
  }

  // Add 1px padding
  const left = Math.max(0, minX - 1);
  const top = Math.max(0, minY - 1);
  const cropW = Math.min(width - left, maxX - left + 2);
  const cropH = Math.min(height - top, maxY - top + 2);

  return sharp(buffer)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();
}

/**
 * Nearest-neighbor resize (critical for pixel art — no blurring).
 * @param {Buffer} buffer - PNG image buffer
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {Promise<Buffer>} Resized PNG buffer
 */
export async function resizeNearest(buffer, width, height) {
  return sharp(buffer)
    .resize(width, height, { kernel: sharp.kernel.nearest, fit: 'fill' })
    .png()
    .toBuffer();
}

/**
 * Reduce color palette (optional, for tighter pixel art look).
 * Uses sharp's built-in PNG palette mode.
 * @param {Buffer} buffer - PNG image buffer
 * @param {number} maxColors - Maximum colors (default: 32)
 * @returns {Promise<Buffer>} Quantized PNG buffer
 */
export async function paletteQuantize(buffer, maxColors = 32) {
  return sharp(buffer)
    .png({ palette: true, colours: maxColors, dither: 0 })
    .toBuffer();
}

/**
 * Center-crop to a target aspect ratio (for backgrounds).
 * @param {Buffer} buffer - PNG image buffer
 * @param {number} aspectW - Aspect width (e.g. 16)
 * @param {number} aspectH - Aspect height (e.g. 9)
 * @returns {Promise<Buffer>} Cropped PNG buffer
 */
export async function cropToPortrait(buffer, aspectW, aspectH) {
  const metadata = await sharp(buffer).metadata();
  const { width, height } = metadata;

  const targetRatio = aspectW / aspectH;
  const currentRatio = width / height;

  let cropW, cropH;
  if (currentRatio > targetRatio) {
    // Too wide — crop sides
    cropH = height;
    cropW = Math.round(height * targetRatio);
  } else {
    // Too tall — crop top/bottom
    cropW = width;
    cropH = Math.round(width / targetRatio);
  }

  const left = Math.round((width - cropW) / 2);
  const top = Math.round((height - cropH) / 2);

  return sharp(buffer)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();
}
