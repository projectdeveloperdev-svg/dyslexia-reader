const MAX_LONGEST_EDGE = 4000;

/**
 * Normalises a raw JPEG base64 string captured by camera-preview:
 *  1. Applies EXIF orientation so pixels are physically upright.
 *  2. Scales down if the longest post-rotation edge exceeds MAX_LONGEST_EDGE.
 *
 * Returns a data URL (image/jpeg, no EXIF) ready for ML Kit / display.
 *
 * Shared by Quick Stack (CameraView mode="stack") and Mega Stack
 * (CameraView mode="megastack").
 */
export async function normaliseCapture(base64) {
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  const resp = await fetch(dataUrl);
  const blob = await resp.blob();

  let bitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    // Fallback: WebView doesn't support imageOrientation option — use raw bitmap.
    bitmap = await createImageBitmap(blob);
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_LONGEST_EDGE ? MAX_LONGEST_EDGE / longest : 1;
  const cw = Math.round(bitmap.width * scale);
  const ch = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, cw, ch);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.98);
}
