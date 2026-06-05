import { useRef, useState } from "react";
import { Router as WouterRouter, Switch, Route } from "wouter";
import ScanSection from "./features/scan/ScanSection";
import VoiceLab from "./features/voice-lab/VoiceLab";
import CameraView from "./features/scan/CameraView";
import PagedReader from "./features/reader/PagedReader";
import { clearSnippets } from "./features/stack/stackStore";
import { loadPdfPages } from "./features/pdf/pdfLoader";
import { commitMegaStack } from "./features/megastack/commitMegaStack";
import "./App.css";

import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

function MainApp() {
  // "stack" | "megastack" — which capture mode is active when stackPhase==="capture"
  const [captureMode, setCaptureMode] = useState("stack");
  const [stackPhase, setStackPhase] = useState(null); // null | "capture" | "preview"
  const [stackCount, setStackCount] = useState(0);

  const pdfInputRef = useRef(null);
  const [pdfError, setPdfError] = useState(null);

  // ── Quick Stack callbacks ─────────────────────────────────────────────

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

  // ── Mega Stack Done callback ──────────────────────────────────────────
  // Called by CameraView (mode="megastack") when the user taps Done.
  // Throws on save failure — CameraView catches and shows the error inline,
  // keeping the capture session alive so the user doesn't lose their work.

  async function handleMegaDone(images, ocrTexts) {
    await commitMegaStack(images, ocrTexts);
    // Navigation only happens after a successful save.
    setStackPhase("preview");
  }

  // ── PDF callbacks ─────────────────────────────────────────────────────

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
      setStackPhase("preview");
    } catch (err) {
      console.error("[PdfPicker] ERROR:", err);
      setPdfError("Could not read this PDF.");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

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

      {/* Top row — premium */}
      <div className="app-action-row">
        <button
          className="app-action-btn app-action-btn--premium"
          onClick={() => {
            setCaptureMode("megastack");
            setStackPhase("capture");
          }}
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

      {/* Middle row — Stack */}
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

      {/* Camera — shared by Quick Stack (mode="stack") and Mega Stack (mode="megastack") */}
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
