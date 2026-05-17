/**
 * Cleans raw OCR output before display and TTS.
 *
 * Background: the @jcesarmobile/capacitor-ocr plugin returns ONE result per
 * physical text line (Android iterates TextBlock → Line; iOS returns one
 * VNRecognizedTextObservation per line). runOCR.js therefore joins results
 * with single \n. This function must reassemble lines into paragraphs.
 *
 * Rules applied in order:
 *  1.  Normalise line endings.
 *  2.  Split into individual lines; trim and drop blank lines (OCR empties).
 *  3.  Watermark filter: some Android OEMs (e.g. Honor, Samsung) burn the
 *      device name as visible text at the bottom of photos. The OCR plugin
 *      reads this as the final line(s). Strip trailing lines that look like
 *      a device-name watermark: short (< 35 chars), 3+ whitespace-separated
 *      tokens, at least one digit, and only capitalised-word/alphanumeric
 *      tokens (no sentence punctuation).
 *  4.  Compute average line length (used for title detection in step 5).
 *  5.  Heuristic paragraph detection: walk consecutive line pairs and insert
 *      a paragraph break (\n\n) or join with a space.
 *        Rule (a) — sentence boundary:
 *          prev ends with terminal punctuation [.!?…] (optionally + closing
 *          char) AND curr starts with an uppercase Latin letter.
 *        Rule (b) — title / heading:
 *          prev does NOT end with terminal punctuation, is < 60 chars, is
 *          shorter than 70 % of the average line length, AND curr starts
 *          with an uppercase Latin letter.
 *          This catches chapter numbers, headings, and section labels without
 *          triggering on regular short last-lines of body paragraphs (which
 *          are close to average length).
 *      Otherwise the lines belong to the same paragraph and are joined with
 *      a space (undoing the physical photo line-wrap).
 *  6.  Per-paragraph noise removal: remove isolated single non-alphanumeric
 *      characters surrounded by spaces (e.g. " . " " | " " ; "). Runs twice
 *      to catch adjacent artefacts like " . . ".
 *  7.  Drop paragraphs that are empty after cleaning.
 *  8.  Re-join paragraphs with \n\n.
 *
 * Called only on the OCR path. Pasted text uses handlePasteResult in
 * ScanSection.jsx, which applies simpler normalisation without noise removal.
 */
export function cleanText(raw) {
  if (!raw) return "";

  // 1 — Normalise line endings, split into individual physical lines.
  let lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return "";

  // 2 — Watermark filter.
  //     Matches strings like "Honor Pro 400", "Galaxy S21 Ultra", "iPhone 15 Pro Max":
  //     purely capitalised-word + alphanumeric tokens, no sentence punctuation.
  const WATERMARK_SHAPE = /^[A-Z][a-zA-Z0-9]*(?:\s+[A-Za-z0-9]+)+\s*$/;
  while (lines.length > 1) {
    const last = lines[lines.length - 1];
    const tokens = last.split(/\s+/);
    if (
      last.length < 35 &&
      tokens.length >= 3 &&
      /\d/.test(last) &&
      WATERMARK_SHAPE.test(last)
    ) {
      lines.pop();
    } else {
      break;
    }
  }

  if (lines.length === 0) return "";

  // 3 — Average line length for title-detection threshold.
  const avgLen = lines.reduce((sum, l) => sum + l.length, 0) / lines.length;

  // 4 — Paragraph break heuristics.
  const SENTENCE_END = /[.!?\u2026]['"\u2019\u201d)\]]*\s*$/u;
  const UPPER_START  = /^[A-Z\u00C0-\u024F]/u; // ASCII + extended Latin capitals

  function isParaBreak(prev, curr) {
    // Rule (a): sentence boundary — terminal punctuation + next line uppercase.
    if (SENTENCE_END.test(prev) && UPPER_START.test(curr)) return true;
    // Rule (b): title / heading — short, no terminal punctuation, significantly
    //           shorter than average body line, followed by an uppercase line.
    if (
      !SENTENCE_END.test(prev) &&
      prev.length < 60 &&
      prev.length < avgLen * 0.7 &&
      UPPER_START.test(curr)
    ) return true;
    return false;
  }

  let assembled = lines[0];
  for (let i = 1; i < lines.length; i++) {
    if (isParaBreak(lines[i - 1], lines[i])) {
      assembled += "\n\n" + lines[i];
    } else {
      assembled += " " + lines[i];
    }
  }

  // 5 — Per-paragraph OCR noise removal.
  const paragraphs = assembled
    .split("\n\n")
    .map((para) => {
      let p = para;
      // Remove isolated single non-alphanumeric chars surrounded by spaces.
      // Run twice to catch adjacent artefacts like " . . ".
      p = p.replace(/ [^a-zA-Z0-9 ] /g, " ");
      p = p.replace(/ [^a-zA-Z0-9 ] /g, " ");
      return p.replace(/ {2,}/g, " ").trim();
    })
    // 6 — Drop empty paragraphs.
    .filter((p) => p.length > 0);

  // 7 — Re-join with paragraph breaks.
  return paragraphs.join("\n\n");
}
