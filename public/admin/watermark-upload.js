/**
 * Watermark project images in the browser before Sveltia CMS uploads them to GitHub.
 */
(function () {
  const WATERMARK_URL = '/images/brand/watermark.png';
  const PADDING = 24;
  const WIDTH_RATIO = 0.32;
  const OPACITY = 0.92;
  const RASTER_TYPES = /^image\/(jpe?g|png|webp|avif)$/i;

  /** @type {Promise<HTMLImageElement> | null} */
  let watermarkPromise = null;

  function loadWatermark() {
    if (!watermarkPromise) {
      watermarkPromise = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load watermark image'));
        img.src = WATERMARK_URL;
      });
    }
    return watermarkPromise;
  }

  /**
   * @param {File} file
   */
  async function watermarkFile(file) {
    if (!RASTER_TYPES.test(file.type)) return file;

    const [bitmap, watermark] = await Promise.all([
      createImageBitmap(file),
      loadWatermark(),
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0);

    const wmWidth = Math.max(120, Math.round(bitmap.width * WIDTH_RATIO));
    const wmHeight = (watermark.naturalHeight / watermark.naturalWidth) * wmWidth;
    const x = (bitmap.width - wmWidth) / 2;
    const y = Math.max(PADDING, bitmap.height - wmHeight - PADDING);

    ctx.globalAlpha = OPACITY;
    ctx.drawImage(watermark, x, y, wmWidth, wmHeight);
    ctx.globalAlpha = 1;

    bitmap.close();

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), outputType, 0.92);
    });

    if (!blob) return file;
    return new File([blob], file.name, { type: outputType, lastModified: Date.now() });
  }

  /**
   * @param {FileList | null} files
   */
  async function watermarkFileList(files) {
    if (!files?.length) return null;

    const dt = new DataTransfer();
    let changed = false;

    for (const file of files) {
      const next = await watermarkFile(file);
      if (next !== file) changed = true;
      dt.items.add(next);
    }

    return changed ? dt.files : null;
  }

  /**
   * @param {HTMLInputElement} input
   */
  function attachInput(input) {
    if (input.dataset.watermarkHook === 'true') return;
    if (input.type !== 'file') return;

    input.dataset.watermarkHook = 'true';

    input.addEventListener(
      'change',
      async (event) => {
        const target = /** @type {HTMLInputElement} */ (event.target);
        const nextFiles = await watermarkFileList(target.files);
        if (nextFiles) target.files = nextFiles;
      },
      true,
    );
  }

  function scan(root) {
    root.querySelectorAll('input[type="file"]').forEach(attachInput);
  }

  function init() {
    const root = document.getElementById('cms-root');
    if (!root) return;

    scan(root);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches?.('input[type="file"]')) attachInput(node);
          scan(node);
        });
      }
    });

    observer.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
