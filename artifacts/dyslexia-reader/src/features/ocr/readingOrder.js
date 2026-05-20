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
 * Sorts all line midX values and counts how many adjacent gaps exceed 10% of
 * pageWidth.
 *   0 gaps → single-column
 *   1 gap  → two-column; splitX is the midpoint of that gap
 *   >1 gap → more than two columns detected; falls back to single-column
 *             with a warning (3-column pages are out of scope)
 *
 * Returns { type: 'single' } or { type: 'two', splitX: number }.
 *
 * Pure — safe to unit-test.
 */
function detectColumns(results, pageWidth) {
  if (pageWidth === 0) return { type: "single" };

  const midXValues = results.map(getMidX).sort((a, b) => a - b);
  const threshold = pageWidth * 0.1;

  const significantGaps = [];
  for (let i = 1; i < midXValues.length; i++) {
    const gap = midXValues[i] - midXValues[i - 1];
    if (gap > threshold) {
      significantGaps.push({
        gap,
        splitX: (midXValues[i - 1] + midXValues[i]) / 2,
      });
    }
  }

  if (significantGaps.length === 0) {
    return { type: "single" };
  }

  if (significantGaps.length > 1) {
    console.warn(
      "[readingOrder] WARN: >2 x-clusters detected — falling back to single-column"
    );
    return { type: "single" };
  }

  return { type: "two", splitX: significantGaps[0].splitX };
}

/**
 * Returns true if the line's bounding box crosses the column divide —
 * i.e. it starts left of splitX and ends right of splitX.
 *
 * Pure — safe to unit-test.
 */
function isSpanning(line, splitX) {
  return line.boundingBox.left < splitX && line.boundingBox.right > splitX;
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
    return [...results].sort((a, b) => a.boundingBox.top - b.boundingBox.top);
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

  for (const line of results) {
    if (isSpanning(line, layout.splitX)) {
      console.log(
        "[readingOrder] spanning line: " +
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

  return [
    ...spanning.sort(byTop),
    ...leftCol.sort(byTop),
    ...rightCol.sort(byTop),
  ];
}
