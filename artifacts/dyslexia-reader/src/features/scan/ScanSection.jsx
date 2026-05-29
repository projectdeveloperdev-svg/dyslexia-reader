import { useState } from "react";
import CameraView from "./CameraView";
import UploadButton from "./UploadButton";
import PasteInput from "./PasteInput";
import ReaderView from "../reader/ReaderView";
import { cleanText } from "../ocr/cleanText";
import "./ScanSection.css";

function ScanSection() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [text, setText] = useState("");
  const [autoRead, setAutoRead] = useState(() => {
    return localStorage.getItem("dexy-auto-read") === "true";
  });

  function changeAutoRead(val) {
    setAutoRead(val);
    try { localStorage.setItem("dexy-auto-read", val); } catch (e) { console.error("localStorage write failed:", e); }
  }

  function handleLoading() {
    setStatus("loading");
    setText("");
  }

  function handleResult(extracted) {
    if (!extracted) {
      setStatus("error");
    } else {
      setText(cleanText(extracted));
      setStatus("done");
    }
  }

  // Paste-specific path: preserve all newlines, don't apply OCR noise rules.
  function handlePasteResult(raw) {
    if (!raw || !raw.trim()) {
      setStatus("error");
      return;
    }
    const cleaned = raw
      .replace(/\r\n/g, "\n")        // normalise Windows line endings first
      .replace(/\r/g, "\n")          // normalise old Mac line endings
      .replace(/\n{3,}/g, "\n\n")    // collapse 3+ blank lines to one paragraph break
      .replace(/[ \t]{2,}/g, " ")    // collapse runs of spaces/tabs only (not newlines)
      .trim();
    setText(cleaned);
    setStatus("done");
  }

  function handleError() {
    setStatus("error");
    setText("");
  }

  function handleReset() {
    setStatus("idle");
    setText("");
  }

  return (
    <div className="scan-section">
      <label className="auto-read-row" htmlFor="auto-read-toggle">
        <span className="auto-read-label">Auto-read after scan</span>
        <span className={`toggle-track${autoRead ? " toggle-on" : ""}`}>
          <span className="toggle-thumb" />
        </span>
        <input
          id="auto-read-toggle"
          type="checkbox"
          className="toggle-input"
          checked={autoRead}
          onChange={(e) => changeAutoRead(e.target.checked)}
        />
      </label>

      <div className="scan-section-buttons">
        <CameraView
          onLoading={handleLoading}
          onResult={handleResult}
          onError={handleError}
          onReset={handleReset}
        />
        <UploadButton
          onLoading={handleLoading}
          onResult={handleResult}
          onError={handleError}
          onReset={handleReset}
        />
        <PasteInput onResult={handlePasteResult} onReset={handleReset} />
      </div>

      {status === "loading" && (
        <div className="ocr-loading">
          <div className="ocr-spinner" />
          <span className="ocr-loading-text">Reading your photo…</span>
        </div>
      )}

      {status === "done" && (
        <ReaderView text={text} autoRead={autoRead} />
      )}

      {status === "error" && (
        <p className="ocr-error">No text found. Try another photo.</p>
      )}
    </div>
  );
}

export default ScanSection;
