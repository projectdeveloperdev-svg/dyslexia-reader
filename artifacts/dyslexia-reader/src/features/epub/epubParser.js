/**
 * epubParser.js — epub.js probe, Step 1.
 *
 * Exports parseEpub(fileOrArrayBuffer) → { title, author, sectionCount, firstSectionText }
 * All epub.js logic is isolated here. Never import this from production UI until
 * the real reader is built (Steps 2–6).
 */

import ePub from "epubjs";

/**
 * Open a DRM-free .epub and extract metadata + first section text.
 *
 * @param {ArrayBuffer|string} fileOrArrayBuffer
 *   ArrayBuffer from file.arrayBuffer(), or a URL string.
 * @returns {Promise<{ title: string, author: string, sectionCount: number, firstSectionText: string }>}
 * @throws if epub.js cannot open or parse the file
 */
export async function parseEpub(fileOrArrayBuffer) {
  try {
    const book = ePub(fileOrArrayBuffer);
    await book.ready;

    const metadata = await book.loaded.metadata;
    const title = metadata.title || "(unknown)";
    const author = metadata.creator || "(unknown)";
    const sectionCount = book.spine.items.length;

    console.log("[epub] title:", title);
    console.log("[epub] author:", author);
    console.log("[epub] spine sections:", sectionCount);

    // TEMP DIAGNOSTIC — log text lengths for first 5 sections to diagnose empty extraction.
    // Remove after device diagnosis is complete.
    const diagCount = Math.min(5, sectionCount);
    for (let i = 0; i < diagCount; i++) {
      try {
        const item = book.spine.get(i);
        await item.load(book.load.bind(book));

        const doc = item.document;
        if (i === 0) {
          console.log("[epub-diag] section 0 document present?", doc != null);
        }

        const innerText    = doc?.body?.innerText   ?? "";
        const textContent  = doc?.body?.textContent ?? "";
        const contents     = item.contents ?? null; // epub.js Contents object if available

        const nonEmpty = innerText || textContent || "";
        console.log(
          `[epub-diag] section ${i} href=${item.href}` +
          ` innerText.len=${innerText.length}` +
          ` textContent.len=${textContent.length}` +
          ` contents=${contents != null ? "present" : "null"}` +
          ` first80="${nonEmpty.slice(0, 80).replace(/\n/g, "↵")}"`
        );

        item.unload();
      } catch (diagErr) {
        console.error(`[epub-diag] section ${i} ERROR:`, diagErr);
      }
    }
    // END TEMP DIAGNOSTIC

    let firstSectionText = "";
    const firstItem = book.spine.get(0);
    if (firstItem) {
      await firstItem.load(book.load.bind(book));
      const body = firstItem.document?.body;
      firstSectionText = (body?.innerText ?? body?.textContent ?? "").trim();
      firstItem.unload();
    }

    console.log(
      "[epub] first section text (first ~200 chars):",
      firstSectionText.slice(0, 200)
    );

    return { title, author, sectionCount, firstSectionText };
  } catch (err) {
    console.error("[epub] PARSE FAILED:", err);
    throw err;
  }
}
