import { useRef } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Set worker once at module load — bundler-friendly, no CDN, survives Capacitor.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * PdfPicker — hidden file input that loads a PDF with pdf.js,
 * extracts text page-by-page, and logs the result.
 * Does NOT open any reader UI.
 *
 * Props:
 *   onClose () => void
 */
export default function PdfPicker({ onClose }) {
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so the same file can be re-picked.
    e.target.value = "";

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    console.log(`[PdfPicker] Total pages: ${pdf.numPages}`);

    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str).join(" ");
      pages.push(pageText);
    }

    const preview = pages[0]?.slice(0, 100) ?? "(no text found on page 1)";
    console.log(`[PdfPicker] Page 1 (first 100 chars): ${preview}`);

    // TODO: pass pages to reader — not yet wired.
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={handleFile}
      />
      {/* Trigger is called externally via open() */}
    </>
  );
}

// Let App trigger the picker without needing to render a visible button inside.
// Usage: <PdfPicker ref={ref} onClose={...} /> then ref.current.open()
// Simpler approach: export a hook or just expose via forwarded ref — but for
// now App holds the inputRef and passes a triggerOpen prop.
