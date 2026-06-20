/**
 * chunkText(text, maxChars = 1200) → string[]
 *
 * Splits text into chunks of at most maxChars characters.
 *
 * Break-point priority (in order):
 *   1. After the LAST sentence-ending punctuation (.!?) followed by whitespace
 *      within the window — clean sentence boundary.
 *   2. At the LAST whitespace character within the window — word boundary,
 *      never mid-word.
 *   3. Hard-break at maxChars — only when a single token exceeds maxChars
 *      (pathological, e.g. a URL or corrupted data).
 *
 * Guarantees:
 *   - Each chunk is at most maxChars characters.
 *   - No word is split across chunks (except the hard-break fallback).
 *   - Whitespace-only or empty input returns [].
 *   - All non-whitespace content is preserved; only seam whitespace is dropped.
 *   - Spine / original order is fully preserved.
 *   - Pure function — no React, no side effects.
 */
export function chunkText(text, maxChars = 1200) {
  if (!text || !/\S/.test(text)) return [];

  const chunks = [];
  let pos = 0;

  while (pos < text.length) {
    // Remaining text fits in one chunk — take it all.
    if (text.length - pos <= maxChars) {
      const tail = text.slice(pos);
      if (/\S/.test(tail)) chunks.push(tail);
      break;
    }

    const window = text.slice(pos, pos + maxChars);

    // ── Priority 1: last sentence-end boundary inside window ─────────────
    // Match . ! ? when immediately followed by whitespace.
    // Walk all matches; keep the last one (deepest into window = most text).
    let sentenceBreak = -1;
    const sentenceRe = /[.!?](?=\s)/g;
    let m;
    while ((m = sentenceRe.exec(window)) !== null) {
      sentenceBreak = m.index + 1; // offset AFTER the punctuation mark
    }

    if (sentenceBreak > 0) {
      chunks.push(text.slice(pos, pos + sentenceBreak));
      pos += sentenceBreak;
      // Skip all whitespace at the seam (newlines, spaces, etc.).
      while (pos < text.length && /\s/.test(text[pos])) pos++;
      continue;
    }

    // ── Priority 2: last whitespace character inside window ───────────────
    let lastWs = -1;
    for (let i = window.length - 1; i >= 0; i--) {
      if (/\s/.test(window[i])) { lastWs = i; break; }
    }

    if (lastWs > 0) {
      chunks.push(text.slice(pos, pos + lastWs));
      pos += lastWs + 1; // skip the whitespace character itself
      // Skip any run of additional whitespace at the seam.
      while (pos < text.length && /\s/.test(text[pos])) pos++;
      continue;
    }

    // ── Priority 3: hard-break (single token longer than maxChars) ────────
    chunks.push(text.slice(pos, pos + maxChars));
    pos += maxChars;
  }

  return chunks;
}
