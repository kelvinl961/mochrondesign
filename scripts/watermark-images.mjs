/**
 * Apply the Mochron logo watermark (bottom center) to project images.
 *
 * Usage:
 *   npm run watermark:projects              # process public/images/projects
 *   npm run watermark:projects -- path.jpg  # single file
 *   npm run watermark:projects -- --force   # re-apply even if cached
 *
 * Run after uploading images via the CMS, then commit the updated files.
 * `npm run build` also runs this automatically (prebuild).
 *
 * Auto paths:
 * - Build/deploy: `prebuild` runs this before `astro build`.
 * - Manual: `npm run fix:watermark-asset` rebuilds the PNG from scripts/assets/watermark-source.jpg.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_WATERMARK = path.join(ROOT, 'public/images/brand/watermark.png');
const DEFAULT_TARGET_DIR = path.join(ROOT, 'public/images/projects');
const CACHE_FILE = path.join(ROOT, '.watermark-cache.json');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/** @typedef {{ sourceHash: string, watermarkedHash: string }} CacheEntry */

/**
 * @param {Buffer} buffer
 */
function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * @param {string} filePath
 */
async function readCache() {
  try {
    const raw = await readFile(CACHE_FILE, 'utf8');
    return /** @type {Record<string, CacheEntry>} */ (JSON.parse(raw));
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, CacheEntry>} cache
 */
async function writeCache(cache) {
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

/**
 * Composite watermark at bottom center of an image buffer.
 *
 * @param {Buffer} imageBuffer
 * @param {Buffer} watermarkBuffer
 * @param {{
 *   padding?: number;
 *   widthRatio?: number;
 *   opacity?: number;
 * }} [options]
 */
export async function applyWatermark(imageBuffer, watermarkBuffer, options = {}) {
  const padding = options.padding ?? 24;
  const widthRatio = options.widthRatio ?? 0.32;
  const opacity = options.opacity ?? 0.92;

  const image = sharp(imageBuffer);
  const meta = await image.metadata();

  if (!meta.width || !meta.height) {
    throw new Error('Could not read image dimensions');
  }

  const watermarkWidth = Math.max(120, Math.round(meta.width * widthRatio));
  const resized = await sharp(watermarkBuffer)
    .resize({ width: watermarkWidth, withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (opacity < 1) {
    for (let i = 3; i < resized.data.length; i += 4) {
      resized.data[i] = Math.round(resized.data[i] * opacity);
    }
  }

  const watermark = await sharp(resized.data, {
    raw: {
      width: resized.info.width,
      height: resized.info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  const wmMeta = await sharp(watermark).metadata();
  const wmWidth = wmMeta.width ?? watermarkWidth;
  const wmHeight = wmMeta.height ?? 0;

  const left = Math.round((meta.width - wmWidth) / 2);
  const top = Math.max(padding, meta.height - wmHeight - padding);

  const composited = image.composite([{ input: watermark, left, top, blend: 'over' }]);

  if (meta.format === 'png') {
    return composited.png().toBuffer();
  }

  if (meta.format === 'webp') {
    return composited.webp().toBuffer();
  }

  if (meta.format === 'avif') {
    return composited.avif().toBuffer();
  }

  return composited.jpeg({ quality: 92 }).toBuffer();
}

/**
 * @param {string} filePath
 * @param {string} watermarkPath
 * @param {Record<string, CacheEntry>} cache
 * @param {boolean} force
 */
async function processFile(filePath, watermarkPath, cache, force) {
  const relPath = path.relative(ROOT, filePath).split(path.sep).join('/');
  const ext = path.extname(filePath).toLowerCase();

  if (!IMAGE_EXT.has(ext)) {
    return { filePath: relPath, status: 'skipped', reason: 'not a raster image' };
  }

  const imageBuffer = await readFile(filePath);
  const currentHash = hashBuffer(imageBuffer);
  const entry = cache[relPath];

  if (!force && entry?.watermarkedHash === currentHash) {
    return { filePath: relPath, status: 'skipped', reason: 'already watermarked' };
  }

  const watermarkBuffer = await readFile(watermarkPath);
  const output = await applyWatermark(imageBuffer, watermarkBuffer);
  const watermarkedHash = hashBuffer(output);

  if (!force && entry?.watermarkedHash === watermarkedHash) {
    cache[relPath] = { sourceHash: currentHash, watermarkedHash };
    return { filePath: relPath, status: 'skipped', reason: 'unchanged' };
  }

  await writeFile(filePath, output);
  cache[relPath] = { sourceHash: currentHash, watermarkedHash };

  return { filePath: relPath, status: 'watermarked' };
}

/**
 * @param {string} dir
 */
async function collectImages(dir) {
  /** @type {string[]} */
  const files = [];
  let entries;

  try {
    entries = await stat(dir);
  } catch {
    return files;
  }

  if (!entries.isDirectory()) return files;

  const { readdir } = await import('node:fs/promises');
  const names = await readdir(dir, { withFileTypes: true });

  for (const entry of names) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectImages(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const force = args.includes('--force');
  const targets = args.filter((arg) => !arg.startsWith('--'));

  const watermarkPath = process.env.WATERMARK_PATH ?? DEFAULT_WATERMARK;
  const inputPaths = targets.length
    ? targets.map((t) => path.resolve(ROOT, t))
    : await collectImages(DEFAULT_TARGET_DIR);

  if (!inputPaths.length) {
    console.log('No images found to watermark.');
    return;
  }

  const cache = await readCache();
  /** @type {Array<{ filePath: string, status: string, reason?: string }>} */
  const results = [];

  for (const filePath of inputPaths) {
    try {
      results.push(await processFile(filePath, watermarkPath, cache, force));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        filePath: path.relative(ROOT, filePath),
        status: 'error',
        reason: message,
      });
    }
  }

  await writeCache(cache);

  const watermarked = results.filter((r) => r.status === 'watermarked');
  const skipped = results.filter((r) => r.status === 'skipped');
  const errors = results.filter((r) => r.status === 'error');

  for (const r of watermarked) console.log(`✓ watermarked ${r.filePath}`);
  for (const r of skipped) console.log(`· skipped ${r.filePath} (${r.reason})`);
  for (const r of errors) console.error(`✗ failed ${r.filePath}: ${r.reason}`);

  console.log(
    `\nDone: ${watermarked.length} watermarked, ${skipped.length} skipped, ${errors.length} failed.`,
  );

  if (errors.length) process.exitCode = 1;
}

main();
