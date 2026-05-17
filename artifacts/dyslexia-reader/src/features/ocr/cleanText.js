/**
 * Cleans raw OCR output before display and TTS.
 *
 * Rules applied in order:
 *  1. Normalise line endings (\r\n → \n, lone \r → \n).
 *  2. Collapse 3+ consecutive newlines to a single paragraph break (\n\n).
 *     Tesseract/OCR plugins sometimes emit 3–4 blank lines between sections.
 *  3. Convert single \n (visual line-wrap artefacts within a paragraph) to spaces.
 *  4. Collapse runs of spaces/tabs to a single space.
 *  5. Per-paragraph OCR noise removal:
 *     - Remove isolated single non-alphanumeric characters surrounded by spaces
 *       (e.g. " . " " | " " ; " — common scan artefacts). Runs twice to catch
 *       adjacent occurrences like " . . ".
 *  6. Drop paragraphs that are empty after cleaning.
 *  7. Re-join paragraphs with a double newline.
 *
 * Called only on the OCR path. Pasted text uses handlePasteResult in
 * ScanSection.jsx, which applies simpler normalisation without noise removal.
 */
export function cleanText(raw) {
  if (!raw) return "";

  // 1 — Normalise line endings.
  let s = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // 2 — Collapse 3+ consecutive newlines to one paragraph break.
  s = s.replace(/\n{3,}/g, "\n\n");

  // 3 — Convert single newlines (mid-sentence visual wraps) to spaces.
  //     Negative lookahead ensures \n\n paragraph breaks are left intact.
  s = s.replace(/\n(?!\n)/g, " ");

  // 4 — Collapse runs of spaces/tabs (not newlines).
  s = s.replace(/[ \t]{2,}/g, " ");

  // 5 — Per-paragraph OCR noise removal.
  const paragraphs = s
    .split("\n\n")
    .map((para) => {
      let p = para;
      // Remove isolated single non-alphanumeric chars surrounded by spaces.
      // Run twice to catch adjacent artefacts like " . . ".
      p = p.replace(/ [^a-zA-Z0-9 ] /g, " ");
      p = p.replace(/ [^a-zA-Z0-9 ] /g, " ");
      return p.replace(/[ \t]{2,}/g, " ").trim();
    })
    // 6 — Drop empty paragraphs.
    .filter((p) => p.length > 0);

  // 7 — Re-join with paragraph breaks.
  return paragraphs.join("\n\n");
}
