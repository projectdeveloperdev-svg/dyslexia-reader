import { useRef } from "react";
import Tesseract from "tesseract.js";
import "./ScanButton.css";

function ScanButton({ onLoading, onResult, onError, onReset }) {
  const inputRef = useRef(null);

  function handleClick() {
    onReset();
    inputRef.current.click();
  }

  async function handleCapture(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    e.target.value = "";
    onLoading();
    try {
      const result = await Tesseract.recognize(url, "eng", { logger: () => {} });
      const extracted = result.data.text.trim();
      onResult(extracted);
    } catch {
      onError();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <>
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
    </>
  );
}

export default ScanButton;
