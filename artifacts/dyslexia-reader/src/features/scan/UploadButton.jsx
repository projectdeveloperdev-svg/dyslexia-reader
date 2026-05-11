import { useRef } from "react";
import { runOCR } from "../ocr/runOCR";
import "./ScanButton.css";

function UploadButton({ onLoading, onResult, onError, onReset }) {
  const inputRef = useRef(null);

  function handleClick() {
    onReset();
    inputRef.current.click();
  }

  async function handleSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    e.target.value = "";
    onLoading();
    try {
      const extracted = await runOCR(url);
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
        onChange={handleSelect}
        style={{ display: "none" }}
      />
      <button className="scan-btn" onClick={handleClick}>
        Upload
      </button>
    </>
  );
}

export default UploadButton;
