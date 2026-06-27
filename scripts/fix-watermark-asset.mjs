/**
 * Rebuild public/images/brand/watermark.png from the original JPEG:
 * black logo + red seal on a transparent background (no solid box).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'scripts/assets/watermark-source.jpg');
const OUTPUT = path.join(ROOT, 'public/images/brand/watermark.png');

/**
 * @param {Buffer} data
 * @param {number} width
 * @param {number} height
 * @param {number} threshold
 */
function floodFillWhiteTransparent(data, width, height, threshold = 245) {
  const visited = new Uint8Array(width * height);
  /** @type {number[]} */
  const queue = [];

  const isWhite = (idx) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r >= threshold && g >= threshold && b >= threshold;
  };

  const pushIfWhite = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const idx = p * 4;
    if (!isWhite(idx)) return;
    visited[p] = 1;
    queue.push(p);
  };

  for (let x = 0; x < width; x++) {
    pushIfWhite(x, 0);
    pushIfWhite(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfWhite(0, y);
    pushIfWhite(width - 1, y);
  }

  while (queue.length) {
    const p = queue.pop();
    const x = p % width;
    const y = (p - x) / width;
    const idx = p * 4;
    data[idx + 3] = 0;
    pushIfWhite(x - 1, y);
    pushIfWhite(x + 1, y);
    pushIfWhite(x, y - 1);
    pushIfWhite(x, y + 1);
  }
}

/**
 * @param {Buffer} data
 * @param {number} width
 * @param {number} height
 */
function trimBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > 8) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function main() {
  const sourceBuffer = await readFile(SOURCE);
  const { data, info } = await sharp(sourceBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  floodFillWhiteTransparent(data, info.width, info.height);

  const bounds = trimBounds(data, info.width, info.height);
  const trimmed = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(bounds)
    .png()
    .toBuffer();

  await writeFile(OUTPUT, trimmed);

  const meta = await sharp(trimmed).metadata();
  console.log(`Wrote ${OUTPUT} (${meta.width}x${meta.height}, alpha=${meta.hasAlpha})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
