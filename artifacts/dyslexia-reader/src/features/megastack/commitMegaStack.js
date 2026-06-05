import { saveStack } from "./megaStackStorage.js";
import { clearSnippets, addSnippet } from "../stack/stackStore.js";

/**
 * Persist a completed Mega Stack capture to device storage and
 * populate the shared stackStore so the existing PagedReader can
 * display the pages without modification.
 *
 * Throws if saveStack fails — the caller is responsible for showing
 * a friendly error and keeping the captured session alive.
 *
 * @param {string[]} images    - data-URL strings in capture order.
 * @param {string[]} ocrTexts  - parallel OCR text strings.
 * @returns {Promise<string>}  - the new stack id from saveStack.
 */
export async function commitMegaStack(images, ocrTexts) {
  // saveStack writes images to disk and returns the new stack id.
  // Any filesystem error propagates up — do NOT swallow it here.
  const id = await saveStack(images, ocrTexts);

  // Populate stackStore so the existing PagedReader can render pages.
  // We pass null for the image because PagedReader only uses ocrText;
  // the actual images live on disk and will be loaded lazily later.
  clearSnippets();
  for (let i = 0; i < ocrTexts.length; i++) {
    addSnippet(null, ocrTexts[i]);
  }

  return id;
}
