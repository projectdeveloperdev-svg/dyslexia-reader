import { useState } from "react";
import ScanButton from "./ScanButton";
import PasteInput from "./PasteInput";
import ReadButton from "../tts/ReadButton";
import "../ocr/OCRResult.css";
import "./ScanSection.css";

function ScanSection() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [text, setText] = useState("");

  function handleLoading() {
    setStatus("loading");
    setText("");
  }

  function handleResult(extracted) {
    if (!extracted) {
      setStatus("error");
    } else {
      setText(extracted);
      setStatus("done");
    }
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
      <div className="scan-section-buttons">
        <ScanButton
          onLoading={handleLoading}
          onResult={handleResult}
          onError={handleError}
          onReset={handleReset}
        />
        <PasteInput onResult={handleResult} onReset={handleReset} />
      </div>

      {status === "loading" && (
        <div className="ocr-loading">
          <div className="ocr-spinner" />
          <span className="ocr-loading-text">Reading your photo…</span>
        </div>
      )}

      {status === "done" && (
        <>
          <div className="ocr-result-box">{text}</div>
          <ReadButton text={text} />
        </>
      )}

      {status === "error" && (
        <p className="ocr-error">No text found. Try another photo.</p>
      )}
    </div>
  );
}

export default ScanSection;
