/**
 * epubParser.js — epub.js parse layer, Step 2.
 *
 * Exports parseEpub(fileOrArrayBuffer) → EpubResult (see typedef below).
 * All epub.js logic is isolated here. Never import from production UI until
 * the real reader is built (Steps 3–6).
 *
 * @typedef {{ ok: true,  drm: false, title: string, author: string,
 *             sectionCount: number, firstSectionText: string }} EpubSuccess
 * @typedef {{ ok: false, drm: true,  reason: "drm",   message: string }} EpubLocked
 * @typedef {{ ok: false, drm: false, reason: "parse", message: string }} EpubError
 * @typedef {EpubSuccess | EpubLocked | EpubError} EpubResult
 */

import ePub from "epubjs";

/**
 * Open a DRM-free .epub and extract metadata + first section text.
 * Returns a tagged result object — never throws.
 *
 * @param {ArrayBuffer|string} fileOrArrayBuffer
 * @returns {Promise<EpubResult>}
 */
export async function parseEpub(fileOrArrayBuffer) {
  let book;
  try {
    book = ePub(fileOrArrayBuffer);
    await book.ready;
  } catch (err) {
    console.error("[epub] PARSE FAILED:", err);
    return {
      ok: false,
      drm: false,
      reason: "parse",
      message: "This file couldn't be opened. It may be damaged or not a valid EPUB.",
    };
  }

  try {
    // ── DRM check: presence of META-INF/encryption.xml ───────────────────
    // epub.js stores the raw zip as book.archive.zip (a JSZip instance).
    // JSZip.files is a plain object keyed by the exact entry path.
    const zip = book.archive?.zip;
    const hasEncryption =
      zip?.files?.["META-INF/encryption.xml"] != null;
    console.log("[epub] encryption.xml present?", hasEncryption);

    if (hasEncryption) {
      return {
        ok: false,
        drm: true,
        reason: "drm",
        message:
          "This book is copy-protected and can't be opened. Try a DRM-free EPUB (e.g. from Project Gutenberg).",
      };
    }

    // ── Metadata ──────────────────────────────────────────────────────────
    const metadata = await book.loaded.metadata;
    const title = metadata.title || "(unknown)";
    const author = metadata.creator || "(unknown)";
    const sectionCount = book.spine.items.length;

    console.log("[epub] title:", title);
    console.log("[epub] author:", author);
    console.log("[epub] spine sections:", sectionCount);

    // ── First section text ────────────────────────────────────────────────
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

    return { ok: true, drm: false, title, author, sectionCount, firstSectionText };
  } catch (err) {
    console.error("[epub] PARSE FAILED:", err);
    return {
      ok: false,
      drm: false,
      reason: "parse",
      message: "This file couldn't be opened. It may be damaged or not a valid EPUB.",
    };
  }
}
