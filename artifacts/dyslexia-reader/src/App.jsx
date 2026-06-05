import { useRef, useState } from "react";
import { Router as WouterRouter, Switch, Route } from "wouter";
import ScanSection from "./features/scan/ScanSection";
import VoiceLab from "./features/voice-lab/VoiceLab";
import CameraView from "./features/scan/CameraView";
import PagedReader from "./features/reader/PagedReader";
import MegaStackLibrary from "./features/megastack/MegaStackLibrary";
import { clearSnippets, addSnippet } from "./features/stack/stackStore";
import { loadPdfPages } from "./features/pdf/pdfLoader";
import { commitMegaStack } from "./features/megastack/commitMegaStack";
import "./App.css";

import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

function MainApp() {
  // App phase: null=home | "library" | "capture" | "preview"
  const [stackPhase, setStackPhase] = useState(null);

  // Which camera mode is active during "capture" phase.
  const [captureMode, setCaptureMode] = useState("stack");

  // Where the reader's Back button should return to.
  // null = home screen, "library" = library screen.
  const [readerReturnPhase, setReaderReturnPhase] = useState(null);

  // Quick Stack page count (used for nothing critical, kept for symmetry).
  const [stackCount, setStackCount] = useState(0);

  const pdfInputRef = useRef(null);
  const [pdfError, setPdfError] = useState(null);

  // ── Quick Stack ───────────────────────────────────────────────────────

  function handleStackDone(count) {
    setStackCount(count);
    setReaderReturnPhase(null); // Back → home
    setStackPhase("preview");
  }

  // Cancel from Quick Stack → home. Cancel from Mega Stack → library.
  function handleStackCancel() {
    if (captureMode === "megastack") {
      setStackPhase("library");
    } else {
      setStackPhase(null);
    }
  }

  // Back button in the reader.
  function handleReaderBack() {
    clearSnippets();
    setStackCount(0);
    const returnTo = readerReturnPhase;
    setReaderReturnPhase(null);
    setStackPhase(returnTo === "library" ? "library" : null);
  }

  // ── Mega Stack Done ───────────────────────────────────────────────────
  // Called by CameraView (mode="megastack") after user taps Done.
  // Throws on save failure — CameraView catches it and shows the error
  // inline, keeping the camera overlay (and the captured session) open.

  async function handleMegaDone(images, ocrTexts) {
    await commitMegaStack(images, ocrTexts);
    // Return to library on success — remount re-fetches the list so the
    // new stack appears immediately without a manual refresh.
    setStackPhase("library");
  }

  // ── Library → open a saved stack ─────────────────────────────────────
  // Populates stackStore with OCR text only (PagedReader reads ocrText;
  // images live on disk and will be loaded lazily in Step 4).

  function handleOpenStack(stack) {
    clearSnippets();
    const pages = Array.isArray(stack.ocrText) ? stack.ocrText : [];
    for (const text of pages) {
      addSnippet(null, text);
    }
    setReaderReturnPhase("library"); // Back → library
    setStackPhase("preview");
  }

  // ── PDF ───────────────────────────────────────────────────────────────

  async function handlePdfFile(e) {
    const file = e.target.files?.[0];
    console.log("[PdfPicker] handler fired, file:", file?.name, file?.size);
    if (!file) return;
    setPdfError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      e.target.value = "";

      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      clearSnippets();
      await loadPdfPages(pdf);
      setReaderReturnPhase(null); // Back → home
      setStackPhase("preview");
    } catch (err) {
      console.error("[PdfPicker] ERROR:", err);
      setPdfError("Could not read this PDF.");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  // Library screen
  if (stackPhase === "library") {
    return (
      <div className="app-root">
        <div className="app-blob app-blob--pink" aria-hidden="true" />
        <div className="app-blob app-blob--lavender" aria-hidden="true" />
        <img src="/dexy-wordmark.png" alt="Dexy" className="app-logo" />
        <MegaStackLibrary
          onNewStack={() => {
            setCaptureMode("megastack");
            setStackPhase("capture");
          }}
          onOpenStack={handleOpenStack}
          onBack={() => setStackPhase(null)}
        />
      </div>
    );
  }

  // Reader screen (Quick Stack, Mega Stack, PDF)
  if (stackPhase === "preview") {
    return (
      <div className="app-root">
        <div className="app-blob app-blob--pink" aria-hidden="true" />
        <div className="app-blob app-blob--lavender" aria-hidden="true" />
        <img src="/dexy-wordmark.png" alt="Dexy" className="app-logo" />
        <PagedReader onExit={handleReaderBack} />
      </div>
    );
  }

  // Home screen
  return (
    <div className="app-root">
      <div className="app-blob app-blob--pink" aria-hidden="true" />
      <div className="app-blob app-blob--lavender" aria-hidden="true" />
      <img src="/dexy-wordmark.png" alt="Dexy" className="app-logo" />

      {/* Top row — premium */}
      <div className="app-action-row">
        <button
          className="app-action-btn app-action-btn--premium"
          onClick={() => setStackPhase("library")}
        >
          <span className="app-action-label">Mega Stack</span>
        </button>
        <button
          className="app-action-btn app-action-btn--premium"
          onClick={() => pdfInputRef.current?.click()}
        >
          <span className="app-action-label">Open PDF</span>
        </button>
      </div>

      {/* Middle row — Quick Stack */}
      <div className="app-action-row">
        <button
          className="app-action-btn app-action-btn--mid"
          onClick={() => {
            setCaptureMode("stack");
            setStackPhase("capture");
          }}
        >
          Stack
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
        <p
          style={{
            color: "#c0392b",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.9rem",
            margin: "0.5rem 1rem 0",
          }}
        >
          {pdfError}
        </p>
      )}

      <ScanSection />

      {/* Camera — Quick Stack (mode="stack") or Mega Stack (mode="megastack") */}
      {stackPhase === "capture" && (
        <CameraView
          mode={captureMode}
          onDone={handleStackDone}
          onMegaDone={handleMegaDone}
          onStackCancel={handleStackCancel}
        />
      )}
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
