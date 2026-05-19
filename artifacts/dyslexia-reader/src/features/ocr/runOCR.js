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

  // Diagnostic: log raw plugin output to help confirm whether chapter headings
  // arrive as separate results or merged with the following sentence.
  // Remove once paragraph detection is confirmed stable.
  console.log(
    "[runOCR] raw results (" + results.length + " items):",
    results.map((r) => JSON.stringify(r.text))
  );
  // Smoke test: confirm bounding box data is flowing from the patched plugin.
  // Remove once verified on device.
  console.log("[runOCR] boundingBox smoke test (first result):", results[0].boundingBox);

  // Each result is ONE physical text line (confirmed from native source: Android
  // iterates block.getLines(), iOS returns one VNRecognizedTextObservation per line).
  // Join with single \n; cleanText applies heuristic paragraph detection.
  const text = results
    .map((r) => r.text)
    .filter((t) => t && t.trim().length > 0)
    .join("\n");

  return text;
}
