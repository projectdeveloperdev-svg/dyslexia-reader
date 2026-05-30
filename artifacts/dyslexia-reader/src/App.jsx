import { useRef, useState } from "react";
import { Router as WouterRouter, Switch, Route } from "wouter";
import ScanSection from "./features/scan/ScanSection";
import VoiceLab from "./features/voice-lab/VoiceLab";
import MegaStackSheet from "./features/stack/MegaStackSheet";
import CameraView from "./features/scan/CameraView";
import PagedReader from "./features/reader/PagedReader";
import { clearSnippets } from "./features/stack/stackStore";
import "./App.css";

// Lazy-import pdf.js only when needed — keeps initial bundle small.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

function MainApp() {
  const [megaStackOpen, setMegaStackOpen] = useState(false);
  const [stackPhase, setStackPhase] = useState(null); // null | "capture" | "preview"
  const [stackCount, setStackCount] = useState(0);

  const pdfInputRef = useRef(null);
  const [pdfError, setPdfError] = useState(null);

  function handleStackDone(count) {
    setStackCount(count);
    setStackPhase("preview");
  }

  function handleStackCancel() {
    setStackPhase(null);
  }

  function handleStackBack() {
    clearSnippets();
    setStackCount(0);
    setStackPhase(null);
  }

  async function handlePdfFile(e) {
    const file = e.target.files?.[0];
    // Diagnostic: fires before any async work so we know the handler ran.
    console.log("[PdfPicker] handler fired, file:", file?.name, file?.size);
    if (!file) return;
    setPdfError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      // Reset only after the file is safely in memory.
      e.target.value = "";

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
    } catch (err) {
      console.error("[PdfPicker] ERROR:", err);
      setPdfError("Could not read this PDF.");
    }
  }

  if (stackPhase === "preview") {
    return (
      <div className="app-root">
        <div className="app-blob app-blob--pink" aria-hidden="true" />
        <div className="app-blob app-blob--lavender" aria-hidden="true" />
        <img src="/dexy-wordmark.png" alt="Dexy" className="app-logo" />
        <PagedReader onExit={handleStackBack} />
      </div>
    );
  }

  return (
    <div className="app-root">
      <div className="app-blob app-blob--pink" aria-hidden="true" />
      <div className="app-blob app-blob--lavender" aria-hidden="true" />
      <img src="/dexy-wordmark.png" alt="Dexy" className="app-logo" />
      <div className="app-action-row">
        <button
          className="app-action-btn"
          onClick={() => setStackPhase("capture")}
        >
          Stack
        </button>
        <button
          className="app-action-btn app-action-btn--premium"
          onClick={() => setMegaStackOpen(true)}
        >
          <span className="app-action-label">Mega Stack</span>
          <span className="app-action-badge">Coming Soon</span>
        </button>
        <button
          className="app-action-btn app-action-btn--premium"
          onClick={() => pdfInputRef.current?.click()}
        >
          <span className="app-action-label">Open PDF</span>
        </button>
      </div>

      {/* Hidden PDF file input */}
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={handlePdfFile}
      />
      {pdfError && (
        <p style={{ color: "#c0392b", fontFamily: "Inter, sans-serif", fontSize: "0.9rem", margin: "0.5rem 1rem 0" }}>
          {pdfError}
        </p>
      )}

      <ScanSection />
      {stackPhase === "capture" && (
        <CameraView
          mode="stack"
          onDone={handleStackDone}
          onStackCancel={handleStackCancel}
        />
      )}
      <MegaStackSheet
        open={megaStackOpen}
        onClose={() => setMegaStackOpen(false)}
      />
    </div>
  );
}

function App() {
  return (
    <WouterRouter base="">
      <Switch>
        <Route path="/voice-lab" component={VoiceLab} />
        <Route component={MainApp} />
      </Switch>
    </WouterRouter>
  );
}

export default App;
