import { Ocr } from "@jcesarmobile/capacitor-ocr";
import { sortReadingOrder } from "./readingOrder";

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
  // Diagnostic: show the full joined text exactly as ML Kit returned it,
  // before reading-order sort, so we can see whether \n\n paragraph breaks
  // are present in native output. Remove with other diagnostic logs.
  console.log(
    "RAW OCR OUTPUT:\n" +
      results
        .map((r) => r.text)
        .filter((t) => t && t.trim().length > 0)
        .join("\n")
  );
  // Each result is ONE physical text line (confirmed from native source: Android
  // iterates block.getLines(), iOS returns one VNRecognizedTextObservation per line).
  // Sort into reading order (handles single- and two-column pages) then join.
  // cleanText applies heuristic paragraph detection on the sorted text.
  const text = sortReadingOrder(results)
    .map((r) => r.text)
    .filter((t) => t && t.trim().length > 0)
    .join("\n");

  return text;
}
