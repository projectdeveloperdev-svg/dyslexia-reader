/**
 * Cleans raw OCR output before display and TTS.
 *
 * Rules applied in order:
 *  1. Strip leading/trailing whitespace from each line.
 *  2. Remove lines that are 1–2 characters long (OCR noise).
 *  3. Treat blank lines as paragraph separators; collapse multiple blanks into one.
 *  4. Within each paragraph, join lines with a space (unwraps photo line-breaks).
 *  5. Collapse multiple consecutive spaces into one.
 *  6. Remove single non-letter/non-digit characters surrounded by spaces
 *     (e.g. " . " " | " " ; "). Punctuation attached to words is untouched.
 *  7. Remove empty paragraphs left after the above steps.
 *  8. Re-join paragraphs with a double newline.
 *
 * Conservative by design: when in doubt, the character is kept.
 */
export function cleanText(raw) {
  if (!raw) return "";

  // 1 & 2 — strip each line; drop 1-or-2-char lines.
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length === 0 || l.length > 2);

  // 3 — group non-blank lines into paragraphs.
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
    if (line === "") {
      if (current.length > 0) {
        paragraphs.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) paragraphs.push(current);

  const result = paragraphs
    .map((para) => {
      // 4 — join wrapped lines into one string.
      let s = para.join(" ");

      // 5 — collapse runs of spaces.
      s = s.replace(/ {2,}/g, " ");

      // 6 — remove isolated single non-alphanumeric chars (surrounded by spaces).
      //     The replace loop runs twice to catch adjacent occurrences like " . . ".
      s = s.replace(/ [^a-zA-Z0-9 ] /g, " ");
      s = s.replace(/ [^a-zA-Z0-9 ] /g, " ");

      // Collapse again after removals, then trim.
      s = s.replace(/ {2,}/g, " ").trim();

      return s;
    })
    // 7 — drop paragraphs that are empty after cleaning.
    .filter((p) => p.length > 0);

  // 8 — re-join with paragraph breaks.
  return result.join("\n\n");
}
