/**
 * Cleans raw OCR output before display and TTS.
 *
 * Background: the @jcesarmobile/capacitor-ocr plugin returns ONE result per
 * physical text line (Android iterates TextBlock → Line; iOS returns one
 * VNRecognizedTextObservation per line). runOCR.js therefore joins results
 * with single \n. This function must reassemble lines into paragraphs.
 *
 * Rules applied in order:
 *  1. Normalise line endings.
 *  2. Split into individual lines; trim and drop blank lines (OCR empties).
 *  3. Heuristic paragraph detection: treat the gap between line[i] and
 *     line[i+1] as a paragraph break when line[i] ends with sentence-terminal
 *     punctuation AND line[i+1] starts with an uppercase letter.
 *     Otherwise the lines belong to the same paragraph and are joined with a
 *     space (undoing the physical line-wrap from the photo).
 *  4. Per-paragraph noise removal: remove isolated single non-alphanumeric
 *     characters surrounded by spaces (e.g. " . " " | " " ; "). Runs twice
 *     to catch adjacent artefacts like " . . ".
 *  5. Drop paragraphs that are empty after cleaning.
 *  6. Re-join paragraphs with \n\n.
 *
 * Called only on the OCR path. Pasted text uses handlePasteResult in
 * ScanSection.jsx, which applies simpler normalisation without noise removal.
 */
export function cleanText(raw) {
  if (!raw) return "";

  // 1 — Normalise line endings, then split into individual physical lines.
  const lines = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return "";

  // 2 — Walk consecutive lines and decide: paragraph break or line-wrap?
  //
  //     Paragraph break heuristic:
  //       prev line ends with sentence-terminal punctuation  [.!?…]
  //                          optionally followed by a closing char ['")]
  //       AND next line starts with an uppercase Latin letter
  //
  //     This handles the vast majority of prose (books, articles).
  //     Edge cases (e.g. "Mr. Smith") produce at worst a spurious break,
  //     which is far less jarring than no breaks at all.
  const SENTENCE_END = /[.!?\u2026]['"\u2019\u201d)[\]]?\s*$/u;
  const UPPER_START  = /^[A-Z\u00C0-\u024F]/u; // ASCII + extended Latin capitals

  let assembled = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const curr = lines[i];
    if (SENTENCE_END.test(prev) && UPPER_START.test(curr)) {
      assembled += "\n\n" + curr;
    } else {
      assembled += " " + curr;
    }
  }

  // 3 — Per-paragraph OCR noise removal.
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
    // 4 — Drop empty paragraphs.
    .filter((p) => p.length > 0);

  // 5 — Re-join with paragraph breaks.
  return paragraphs.join("\n\n");
}
