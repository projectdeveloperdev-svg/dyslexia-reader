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
  // Junk-fragment filter — runs BEFORE reading-order sort.
  // ML Kit sometimes returns short noise fragments (margin notes, smudges,
  // page artifacts) interleaved with real text. These break paragraph
  // detection in cleanText.js by interrupting line sequences.
  //
  // A result is dropped only when BOTH conditions are true:
  //   A) Suspicious text — short (<6 chars) OR no capital/sentence-punctuation
  //   B) Suspicious geometry — small height (<60% of median) OR margin position
  //      (<15% or >85% of pageWidth)
  // Results with no bounding box are always kept (conservative fallback).
  {
    // Compute page width (max right edge) and median line height.
    const pageWidth = results.reduce(
      (max, r) => (r.boundingBox && r.boundingBox.right > max ? r.boundingBox.right : max),
      0
    );
    const heights = results
      .filter((r) => r.boundingBox)
      .map((r) => r.boundingBox.bottom - r.boundingBox.top)
      .sort((a, b) => a - b);
    const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 0;

    // Matches a leading capital letter OR sentence-ending / closing punctuation.
    const HAS_SIGNAL = /^[A-Z]|[.!?"'\u2019\u201d)]/;

    const junk = [];
    const kept = [];

    for (const r of results) {
      const text = (r.text || "").trim();
      const bb = r.boundingBox;

      // Condition A: suspicious text.
      const suspiciousText = text.length < 6 || !HAS_SIGNAL.test(text);

      if (!suspiciousText || !bb) {
        kept.push(r);
        continue;
      }

      // Condition B: suspicious geometry (needs bounding box).
      const height = bb.bottom - bb.top;
      const midX = (bb.left + bb.right) / 2;
      const smallHeight = medianHeight > 0 && height < medianHeight * 0.6;
      const inMargin =
        pageWidth > 0 &&
        (midX < pageWidth * 0.15 || midX > pageWidth * 0.85);

      if (smallHeight || inMargin) {
        junk.push(r);
      } else {
        kept.push(r);
      }
    }

    if (junk.length > 0) {
      console.log(
        "[runOCR] filtered junk fragments:",
        junk.map((r) => JSON.stringify(r.text))
      );
    }

    results = kept;
  }

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
