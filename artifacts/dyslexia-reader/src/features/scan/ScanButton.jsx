import { useRef, useState } from "react";
import { useOCR } from "../ocr/useOCR";
import ReadButton from "../tts/ReadButton";
import "../ocr/OCRResult.css";
import "./ScanButton.css";

function ScanButton() {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const { status, text, runOCR, reset } = useOCR();

  function handleClick() {
    reset();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    inputRef.current.click();
  }

  async function handleCapture(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    e.target.value = "";
    await runOCR(url);
  }

  return (
    <div className="scan-container">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        style={{ display: "none" }}
      />

      <button className="scan-btn" onClick={handleClick}>
        Scan
      </button>

      {status === "loading" && (
        <div className="ocr-loading">
          <div className="ocr-spinner" />
          <span className="ocr-loading-text">Reading your photo…</span>
        </div>
      )}

      {status === "idle" && previewUrl && (
        <div className="scan-preview">
          <img src={previewUrl} alt="Captured preview" />
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

export default ScanButton;
