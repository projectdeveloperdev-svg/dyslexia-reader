/**
 * upscaleForOCR — canvas-only pre-processing step for Tesseract/ML Kit.
 *
 * Upscales an image so its SHORT side is in Tesseract's sweet spot
 * (~1500-2000 px) before OCR runs. If the image is already large enough it
 * is returned unchanged (no-op). No new library dependency — canvas 2D only.
 *
 * Rules:
 *  - Target short side: TARGET_SHORT px.
 *  - Never exceed MAX_SCALE × the original size.
 *  - Never let the long side exceed MAX_LONG px (memory guard).
 *  - If scale works out to ≤ 1 after all guards, return the original.
 *  - On ANY error, fall back silently to the original data URL.
 *
 * @param {string} dataUrl  — image/jpeg or image/png data URL
 * @returns {Promise<string>} — upscaled data URL, or original on failure/no-op
 */

const TARGET_SHORT = 1600;
const MAX_SCALE    = 3;
const MAX_LONG     = 4000;

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function upscaleForOCR(dataUrl) {
  try {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    const shortSide = Math.min(w, h);
    const longSide  = Math.max(w, h);

    // Already in Tesseract's sweet spot — skip.
    if (shortSide >= TARGET_SHORT) {
      console.log(
        `[upscaleForOCR] skip — short side ${shortSide}px >= ${TARGET_SHORT}px`
      );
      return dataUrl;
    }

    let scale = TARGET_SHORT / shortSide;

    // Cap multiplier.
    if (scale > MAX_SCALE) scale = MAX_SCALE;

    // Memory guard: long side must not exceed MAX_LONG.
    if (longSide * scale > MAX_LONG) scale = MAX_LONG / longSide;

    // After guards, upscaling may no longer be meaningful.
    if (scale <= 1) {
      console.log("[upscaleForOCR] skip after guards — scale ≤ 1");
      return dataUrl;
    }

    const newW = Math.round(w * scale);
    const newH = Math.round(h * scale);

    console.log(
      `[upscaleForOCR] ${w}×${h} → ${newW}×${newH} (×${scale.toFixed(2)})`
    );

    const canvas = document.createElement("canvas");
    canvas.width  = newW;
    canvas.height = newH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, newW, newH);

    return canvas.toDataURL("image/jpeg", 0.92);
  } catch (err) {
    console.warn("[upscaleForOCR] failed — using original:", err);
    return dataUrl;
  }
}
