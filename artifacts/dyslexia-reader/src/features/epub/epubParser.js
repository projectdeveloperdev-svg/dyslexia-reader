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
