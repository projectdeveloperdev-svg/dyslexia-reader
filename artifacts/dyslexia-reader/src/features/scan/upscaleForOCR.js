/**
 * upscaleForOCR — canvas-only pre-processing pipeline for ML Kit OCR.
 *
 * Phase 1 — Upscale
 *   Brings the image's short side up to TARGET_SHORT px so ML Kit has enough
 *   pixel data to resolve thin strokes. No-ops if the image is already large.
 *
 * Phase 2 — Clean (grayscale → contrast → sharpen → Otsu threshold)
 *   Only applied when the image needed SIGNIFICANT upscaling (scale ≥
 *   CLEAN_MIN_SCALE). Full-page captures are already large enough that the
 *   heavy clean degrades rather than helps them — they get upscale only (or
 *   no processing at all) and are returned as-is for ML Kit.
 *
 * Fallback chain (no scan ever breaks):
 *   clean fails   → upscaled-only image
 *   upscale fails → original dataUrl
 *
 * @param {string} dataUrl  image/jpeg or image/png data URL
 * @returns {Promise<string>} processed data URL (or fallback)
 */

// ── Tuneable constants ────────────────────────────────────────────────────────
const TARGET_SHORT    = 1600; // target short side (px) for upscale step
const MAX_SCALE       = 3;    // cap: never upscale more than this multiplier
const MAX_LONG        = 4000; // memory guard: long side ceiling (px)
// Clean is applied ONLY when scale >= CLEAN_MIN_SCALE.
// Below this the image was already large (e.g. a full-page 1080p capture at
// ×1.48) and aggressive processing harms it. 1.5 safely separates full-page
// shots (~×1.0–1.5) from genuine small crops (~×2–3).
const CLEAN_MIN_SCALE = 1.5;
const CONTRAST_FACTOR = 1.5;  // (pixel-128)*factor+128; 1 = no change
const SHARPEN_AMOUNT  = 0.8;  // unsharp-mask strength; 0 = off, 1 = strong
const SHARPEN_BLUR_R  = 1;    // box-blur radius (px) used for unsharp mask
const THRESHOLD_BIAS  = 10;   // added to Otsu value (positive → darker, thicker strokes)
// ─────────────────────────────────────────────────────────────────────────────

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Separable box blur on a Uint8Array of grayscale values.
 * Returns a new Uint8Array; input is not modified.
 */
function boxBlur(gray, width, height, radius) {
  const h   = new Uint8Array(gray.length);
  const out = new Uint8Array(gray.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) { sum += gray[y * width + nx]; count++; }
      }
      h[y * width + x] = (sum / count + 0.5) | 0;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) { sum += h[ny * width + x]; count++; }
      }
      out[y * width + x] = (sum / count + 0.5) | 0;
    }
  }

  return out;
}

/**
 * Otsu's method — finds the threshold that maximises between-class variance.
 * Returns the threshold value (0–255).
 */
function otsuThreshold(gray) {
  const hist = new Int32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];

  let sumB = 0, wB = 0, maxVar = 0, threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > maxVar) { maxVar = between; threshold = t; }
  }
  return threshold;
}

export async function upscaleForOCR(dataUrl) {
  // ── Phase 1: Upscale ───────────────────────────────────────────────────────
  // `scale` is hoisted so Phase 2 can gate on it.
  let scale = 1;
  let canvas, ctx, upscaledUrl;

  try {
    const img = await loadImage(dataUrl);
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    const shortSide = Math.min(w, h);
    const longSide  = Math.max(w, h);

    scale = shortSide < TARGET_SHORT ? TARGET_SHORT / shortSide : 1;
    if (scale > MAX_SCALE)           scale = MAX_SCALE;
    if (longSide * scale > MAX_LONG) scale = MAX_LONG / longSide;
    if (scale < 1)                   scale = 1;

    const newW = Math.round(w * scale);
    const newH = Math.round(h * scale);

    if (scale > 1) {
      console.log(`[upscaleForOCR] ${w}×${h} → ${newW}×${newH} (×${scale.toFixed(2)})`);
    } else {
      console.log(`[upscaleForOCR] skip upscale — short side ${shortSide}px already ≥ ${TARGET_SHORT}px`);
    }

    canvas = document.createElement("canvas");
    canvas.width  = newW;
    canvas.height = newH;
    ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, newW, newH);

    upscaledUrl = canvas.toDataURL("image/jpeg", 0.92);
  } catch (err) {
    console.warn("[upscaleForOCR] upscale failed — using original:", err);
    return dataUrl;
  }

  // ── Phase 2: Clean ────────────────────────────────────────────────────────
  // Skip for large images (full-page shots): heavy clean degrades already-
  // good images. Only apply when the image needed real upscaling (small crops).
  if (scale < CLEAN_MIN_SCALE) {
    console.log(
      `[upscaleForOCR] clean SKIPPED — scale ×${scale.toFixed(2)} < ×${CLEAN_MIN_SCALE} (image already large)`
    );
    return upscaledUrl;
  }

  try {
    const { width, height } = canvas;
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data; // Uint8ClampedArray, RGBA

    // 1. Grayscale (luminance-weighted)
    const gray = new Uint8Array(width * height);
    for (let i = 0, p = 0; p < d.length; i++, p += 4) {
      const v = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2] + 0.5) | 0;
      d[p] = d[p + 1] = d[p + 2] = v;
      gray[i] = v;
    }

    // 2. Contrast boost — (pixel - 128) × CONTRAST_FACTOR + 128
    for (let i = 0, p = 0; p < d.length; i++, p += 4) {
      const v = Math.max(0, Math.min(255, ((gray[i] - 128) * CONTRAST_FACTOR + 128 + 0.5) | 0));
      d[p] = d[p + 1] = d[p + 2] = v;
      gray[i] = v;
    }

    // 3. Unsharp mask — original + SHARPEN_AMOUNT × (original − blurred)
    const blurred = boxBlur(gray, width, height, SHARPEN_BLUR_R);
    for (let i = 0, p = 0; p < d.length; i++, p += 4) {
      const v = Math.max(0, Math.min(255,
        (gray[i] + SHARPEN_AMOUNT * (gray[i] - blurred[i]) + 0.5) | 0
      ));
      d[p] = d[p + 1] = d[p + 2] = v;
      gray[i] = v;
    }

    // 4. Threshold — Otsu + THRESHOLD_BIAS (positive bias → more pixels go dark
    //    → thin strokes thicken rather than disappear)
    const otsu = otsuThreshold(gray);
    const thresh = Math.min(255, otsu + THRESHOLD_BIAS);
    console.log(
      `[upscaleForOCR] clean APPLIED (×${scale.toFixed(2)} ≥ ×${CLEAN_MIN_SCALE}): ` +
      `grayscale → contrast(×${CONTRAST_FACTOR}) → sharpen(${SHARPEN_AMOUNT}) → ` +
      `threshold(otsu=${otsu} bias=${THRESHOLD_BIAS} final=${thresh})`
    );
    for (let i = 0, p = 0; p < d.length; i++, p += 4) {
      const v = gray[i] <= thresh ? 0 : 255;
      d[p] = d[p + 1] = d[p + 2] = v;
      // d[p+3] (alpha) left unchanged — already 255 for JPEG captures
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  } catch (err) {
    console.warn("[upscaleForOCR] clean failed — using upscaled-only:", err);
    return upscaledUrl;
  }
}
