import { addSnippet } from "../stack/stackStore";

/**
 * Extracts text from every page of an already-loaded pdfjs PDF document
 * and writes one snippet per page into the shared stack store.
 * Blank pages get a "No text on this page." placeholder so page order is preserved.
 * Returns the total number of pages loaded.
 */
export async function loadPdfPages(pdf) {
  console.log(`[PdfPicker] Total pages: ${pdf.numPages}`);

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const raw = content.items.map((item) => item.str).join(" ").trim();
    const pageText = raw.length > 0 ? raw : "No text on this page.";

    if (i === 1) {
      console.log(`[PdfPicker] Page 1 (first 100 chars): ${pageText.slice(0, 100)}`);
    }

    addSnippet(null, pageText);
  }

  return pdf.numPages;
}
