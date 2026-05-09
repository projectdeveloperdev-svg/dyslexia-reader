import { useRef, useState } from "react";
import "./ScanButton.css";

function ScanButton() {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  function handleClick() {
    inputRef.current.click();
  }

  function handleCapture(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    e.target.value = "";
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

      {previewUrl && (
        <div className="scan-preview">
          <img src={previewUrl} alt="Captured preview" />
        </div>
      )}
    </div>
  );
}

export default ScanButton;
