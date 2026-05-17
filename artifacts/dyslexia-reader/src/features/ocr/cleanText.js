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
 *  2.  Split into individual lines; trim and drop blank lines.
 *  3.  Watermark filter: some Android OEMs burn the device name as visible
 *      text at the bottom of photos. Strip trailing lines matching the
 *      pattern: short (< 35 chars), 3+ tokens, at least one digit, only
 *      capitalised-word/alphanumeric tokens, no sentence punctuation.
 *  4.  Inline heading pre-pass: some OCR results return a chapter/section
 *      heading and the first body sentence merged on the same physical line.
 *      Detect and split into two separate lines:
 *        (a) Named keyword headings: "Chapter 1. Body text"
 *                                    "Section 3: Body text"
 *        (b) ALL-CAPS headings:      "INTRODUCTION Body text"
 *  5.  Compute average line length (used for heading detection in step 6).
 *  6.  Heuristic paragraph detection — walk consecutive line pairs:
 *        Rule (a): prev ends with terminal punctuation [.!?…] (+ optional
 *                  closing char) AND curr starts with an uppercase letter.
 *        Rule (b): prev has no terminal punctuation, is < 60 chars, is
 *                  shorter than 70 % of average line length, AND curr starts
 *                  uppercase. Catches headings that arrived as separate lines.
 *      Otherwise join with a space (undo photo line-wrap within a paragraph).
 *  7.  Per-paragraph noise removal: remove isolated single non-alphanumeric
 *      chars surrounded by spaces. Runs twice for adjacent artefacts.
 *  8.  Drop empty paragraphs; re-join with \n\n.
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
  //     Matches "Honor Pro 400", "Galaxy S21 Ultra", "iPhone 15 Pro Max" etc.
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

  // 3 — Inline heading pre-pass.
  //
  //     Root cause: ML Kit returns one Line observation per physical text line.
  //     When a book has "Chapter 1." inline at the start of the first paragraph's
  //     first visual line, ML Kit groups it as ONE line result, so the line-walking
  //     heuristic never sees a boundary to split on.
  //
  //     Pattern (a) — named keyword heading followed immediately by body text:
  //       "Chapter 1. Once upon a time"   → ["Chapter 1.",   "Once upon a time"]
  //       "Section 3: The results show"   → ["Section 3:",   "The results show"]
  //       "Part II. The journey begins"   → ["Part II.",     "The journey begins"]
  //
  //     Pattern (b) — ALL-CAPS heading followed by mixed-case body text:
  //       "INTRODUCTION The book begins"  → ["INTRODUCTION", "The book begins"]
  //       "CHAPTER ONE The story opens"   → ["CHAPTER ONE",  "The story opens"]
  //
  //     Both patterns anchor to the start of the line (^) so they don't fire
  //     on mid-sentence uses like "This is chapter 1 of my life".

  // (a) Named heading keywords + optional number/roman + optional punctuation.
  //     Lookahead (?=[A-Z]) ensures the body starts with an uppercase letter
  //     without consuming it, so body is sliced correctly from m[0].length.
  const CHAPTER_INLINE = new RegExp(
    "^(" +
      "(?:chapter|section|part|introduction|epilogue|prologue|appendix|preface|foreword|afterword)" +
      "(?:\\s+[IVXLCDM\\divxlcdm]+)?" +   // optional number (arabic or roman)
      "[.:]?" +                             // optional terminal punctuation
    ")\\s+(?=[A-Z])",
    "i"
  );

  // (b) One or more ALL-CAPS words followed by a mixed-case word.
  //     Requires at least 2 uppercase letters in the first word to avoid
  //     firing on a normal sentence starting with "I" or a proper noun.
  const ALLCAPS_INLINE = /^([A-Z][A-Z]+(?:\s+[A-Z]+)*)\s+(?=[A-Z][a-z])/;

  // Diagnostic: log lines before the pre-pass to trace the heading merge issue.
  // Remove once chapter-heading detection is confirmed stable.
  console.log(
    "[cleanText] input lines (" + lines.length + "):",
    lines.map((l) => JSON.stringify(l))
  );

  lines = lines.flatMap((line) => {
    let m = CHAPTER_INLINE.exec(line);
    if (m) {
      const heading = m[1].trim();
      const body    = line.slice(m[0].length);
      console.log("[cleanText] inline-heading split:", JSON.stringify(line), "→", JSON.stringify(heading), "+", JSON.stringify(body));
      return [heading, body];
    }
    m = ALLCAPS_INLINE.exec(line);
    if (m) {
      const heading = m[1].trim();
      const body    = line.slice(m[0].length);
      console.log("[cleanText] allcaps-heading split:", JSON.stringify(line), "→", JSON.stringify(heading), "+", JSON.stringify(body));
      return [heading, body];
    }
    return [line];
  });

  // 4 — Average line length for heading-detection threshold in step 5.
  const avgLen = lines.reduce((sum, l) => sum + l.length, 0) / lines.length;

  // 5 — Paragraph break heuristics.
  const SENTENCE_END = /[.!?\u2026]['"\u2019\u201d)\]]*\s*$/u;
  const UPPER_START  = /^[A-Z\u00C0-\u024F]/u;

  function isParaBreak(prev, curr) {
    // Rule (a): sentence boundary.
    if (SENTENCE_END.test(prev) && UPPER_START.test(curr)) return true;
    // Rule (b): short heading line (no terminal punctuation, well below average length).
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
    const broke = isParaBreak(lines[i - 1], lines[i]);
    // Diagnostic: trace the first several line-pair decisions.
    if (i <= 6) {
      console.log(
        "[cleanText] line[" + (i - 1) + "]=" + JSON.stringify(lines[i - 1]) +
        " → line[" + i + "]=" + JSON.stringify(lines[i]) +
        " paraBreak=" + broke
      );
    }
    assembled += broke ? "\n\n" + lines[i] : " " + lines[i];
  }

  // 6 — Per-paragraph OCR noise removal.
  const paragraphs = assembled
    .split("\n\n")
    .map((para) => {
      let p = para;
      p = p.replace(/ [^a-zA-Z0-9 ] /g, " ");
      p = p.replace(/ [^a-zA-Z0-9 ] /g, " ");
      return p.replace(/ {2,}/g, " ").trim();
    })
    .filter((p) => p.length > 0);

  return paragraphs.join("\n\n");
}
