/**
 * readingOrder.js
 *
 * Sorts OCR results into correct reading order for single- and two-column pages.
 * Called by runOCR.js before lines are joined into text.
 *
 * Input:  results[] — each { text, confidence, boundingBox?: { left, top, right, bottom } }
 * Output: same objects reordered — no fields added or removed.
 *
 * Single-column: lines sorted top-to-bottom.
 * Two-column:    spanning lines (top-to-bottom) → left column (top-to-bottom)
 *                → right column (top-to-bottom).
 */

/**
 * Returns the rightmost pixel seen across all lines.
 * Used as the page-width reference for the 10% gap threshold.
 *
 * Pure — safe to unit-test.
 */
function getPageWidth(results) {
  let max = 0;
  for (const r of results) {
    if (r.boundingBox && r.boundingBox.right > max) max = r.boundingBox.right;
  }
  return max;
}

/**
 * Returns the horizontal midpoint of a single line's bounding box.
 *
 * Pure — safe to unit-test.
 */
function getMidX(line) {
  return (line.boundingBox.left + line.boundingBox.right) / 2;
}

/**
 * Detects whether the page has one or two columns.
 *
 * Sorts all line midX values and finds the LARGEST gap between any two
 * adjacent values. If that gap exceeds 10% of pageWidth, the midpoint of
 * that gap is the column divide. Otherwise single-column.
 *
 * No cluster counting — real pages have many x-clusters (indented lines,
 * headers, footers) so counting clusters causes false single-column fallbacks.
 *
 * Returns { type: 'single' } or { type: 'two', splitX: number }.
 *
 * Pure — safe to unit-test.
 */
function detectColumns(results, pageWidth) {
  if (pageWidth === 0) return { type: "single" };

  const midXValues = results.map(getMidX).sort((a, b) => a - b);
  const threshold = pageWidth * 0.25;

  // Search band: only look for the column gap in the middle 30–70% of the page.
  // Edge outliers (page numbers, stray annotations) sit outside this band and
  // would otherwise steal the "largest gap" crown from the real gutter.
  const bandLo = pageWidth * 0.3;
  const bandHi = pageWidth * 0.7;

  let largestGap = 0;
  let gapLeft = 0;
  let gapRight = 0;

  for (let i = 1; i < midXValues.length; i++) {
    if (midXValues[i - 1] < bandLo || midXValues[i] > bandHi) continue;
    const gap = midXValues[i] - midXValues[i - 1];
    if (gap > largestGap) {
      largestGap = gap;
      gapLeft = midXValues[i - 1];
      gapRight = midXValues[i];
    }
  }

  // Diagnostic — remove with the other [readingOrder] logs when phase is signed off.
  console.log(
    "[readingOrder] midX values sorted: [" +
      midXValues.map((v) => Math.round(v)).join(", ") +
      "]"
  );
  console.log(
    "[readingOrder] search band: " +
      Math.round(bandLo) +
      " to " +
      Math.round(bandHi) +
      " (30%–70% of pageWidth=" +
      Math.round(pageWidth) +
      ")"
  );

  if (largestGap === 0) {
    console.log(
      "[readingOrder] no in-band gap found — falling back to single-column"
    );
    return { type: "single" };
  }

  console.log(
    "[readingOrder] largest gap: " +
      Math.round(largestGap) +
      " between midX=" +
      Math.round(gapLeft) +
      " and midX=" +
      Math.round(gapRight)
  );
  console.log(
    "[readingOrder] gap as % of pageWidth: " +
      Math.round((largestGap / pageWidth) * 100) +
      "%"
  );

  if (largestGap > threshold) {
    return { type: "two", splitX: (gapLeft + gapRight) / 2 };
  }

  return { type: "single" };
}

/**
 * Returns true if the line is genuinely wide — more than 60% of pageWidth.
 * This catches full-width headings/banners while leaving normal column body
 * lines (typically ~24% of pageWidth) unaffected.
 *
 * Replaces the old edge-crossing check (left < splitX && right > splitX),
 * which incorrectly flagged left-column lines whose right edge just barely
 * passed splitX.
 *
 * Pure — safe to unit-test.
 */
function isSpanning(line, pageWidth) {
  return (line.boundingBox.right - line.boundingBox.left) > pageWidth * 0.6;
}

/**
 * Sorts OCR result lines into correct reading order.
 *
 * Exported — this is the only function runOCR.js calls.
 */
export function sortReadingOrder(results) {
  if (results.length === 0) return [];

  // Tweak 1: If ANY line is missing a boundingBox, fall back to original order.
  // Trust the data fully or not at all — no half-sorts.
  const missingCount = results.filter((r) => !r.boundingBox).length;
  if (missingCount > 0) {
    console.warn(
      "[readingOrder] WARN: " +
        missingCount +
        " line(s) missing boundingBox — falling back to single-column," +
        " original order preserved"
    );
    return results;
  }

  const pageWidth = getPageWidth(results);
  const layout = detectColumns(results, pageWidth);

  if (layout.type === "single") {
    console.log(
      "[readingOrder] detected: single-column (" + results.length + " lines)"
    );
    return results;   // trust ML Kit's order, do not re-sort
  }

  // Two-column path.
  console.log(
    "[readingOrder] detected: two-column, splitX=" +
      Math.round(layout.splitX) +
      ", pageWidth=" +
      Math.round(pageWidth) +
      " (" +
      results.length +
      " lines)"
  );

  const spanning = [];
  const leftCol = [];
  const rightCol = [];
  const spanThreshold = pageWidth * 0.6;

  for (const line of results) {
    if (isSpanning(line, pageWidth)) {
      console.log(
        "[readingOrder] spanning line (width=" +
          Math.round(line.boundingBox.right - line.boundingBox.left) +
          ", threshold=" +
          Math.round(spanThreshold) +
          "): " +
          JSON.stringify(line.text) +
          " (y=" +
          line.boundingBox.top +
          ")"
      );
      spanning.push(line);
    } else if (getMidX(line) < layout.splitX) {
      leftCol.push(line);
    } else {
      rightCol.push(line);
    }
  }

  // Balance guard: reject the two-column split when one column holds fewer than
  // MIN_COLUMN_SHARE of the non-spanning lines — a real two-column page is
  // roughly balanced; indent jitter produces a heavily lopsided split.
  const MIN_COLUMN_SHARE = 0.2;
  const columnTotal = leftCol.length + rightCol.length;
  if (
    columnTotal > 0 &&
    (leftCol.length < columnTotal * MIN_COLUMN_SHARE ||
      rightCol.length < columnTotal * MIN_COLUMN_SHARE)
  ) {
    console.warn(
      "[readingOrder] two-column split rejected — column balance too low (left: " +
        leftCol.length +
        ", right: " +
        rightCol.length +
        ") — falling back to single-column"
    );
    return results;   // trust ML Kit's order
  }

  // Spanning-ceiling guard: if 60%+ of lines are spanning, it's a single-column
  // page with short lines — reject the two-column split.
  const MAX_SPANNING_SHARE = 0.6;
  if (spanning.length >= results.length * MAX_SPANNING_SHARE) {
    console.warn(
      "[readingOrder] two-column split rejected — too many spanning lines (" +
        spanning.length +
        " of " +
        results.length +
        ") — falling back to original order"
    );
    return results;   // trust ML Kit's order
  }

  // Tweak 2: warn if two-column was detected but nothing fell into either column bucket.
  if (spanning.length === results.length) {
    console.warn(
      "[readingOrder] WARN: two-column detected but all lines span —" +
        " column detection may be wrong"
    );
  }

  console.log(
    "[readingOrder] column counts — left: " +
      leftCol.length +
      ", right: " +
      rightCol.length +
      ", spanning: " +
      spanning.length
  );

  const byTop = (a, b) => a.boundingBox.top - b.boundingBox.top;

  const sorted = [
    ...spanning.sort(byTop),
    ...leftCol.sort(byTop),
    ...rightCol.sort(byTop),
  ];

  console.log('[readingOrder] OUTPUT first 6 lines:', sorted.slice(0, 6).map(l => l.text));

  return sorted;
}
