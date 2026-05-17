import { Ocr } from "@jcesarmobile/capacitor-ocr";

export async function runOCR(imageUrl) {
  let results;
  try {
    ({ results } = await Ocr.process({ image: imageUrl }));
  } catch (err) {
    console.error("[runOCR] OCR failed:", err);
    throw err;
  }

  if (!results || results.length === 0) {
    return "";
  }

  // Each result is ONE physical text line (confirmed from native source: Android
  // iterates block.getLines(), iOS returns one VNRecognizedTextObservation per line).
  // Join with single \n; cleanText applies heuristic paragraph detection.
  const text = results
    .map((r) => r.text)
    .filter((t) => t && t.trim().length > 0)
    .join("\n");

  return text;
}
