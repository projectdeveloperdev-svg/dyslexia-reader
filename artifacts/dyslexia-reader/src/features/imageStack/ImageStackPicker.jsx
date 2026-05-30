import { useRef, useState, useEffect } from "react";
import "../scan/CameraView.css";
import "./ImageStackPicker.css";

export default function ImageStackPicker({ onClose }) {
  const inputRef = useRef(null);
  const [images, setImages] = useState([]); // [{ url: objectURL, name: string }]

  // Track all live object URLs in a ref so they can be revoked without
  // depending on React state (avoids revoke-on-render-cycle bugs).
  const urlsRef = useRef([]);

  // Revoke everything when the component unmounts — catches all exit paths.
  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiles(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Revoke previous object URLs before creating new ones.
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));

    const newUrls = files.map((f) => URL.createObjectURL(f));
    urlsRef.current = newUrls;
    setImages(files.map((f, i) => ({ url: newUrls[i], name: f.name })));

    // Reset input value so the same files can be re-selected if needed.
    e.target.value = "";
  }

  function handleClear() {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setImages([]);
  }

  function handleClose() {
    handleClear();
    onClose();
  }

  return (
    <div className="image-stack-picker">
      <div className="image-stack-header">
        <button className="image-stack-back" onClick={handleClose}>
          ← Back
        </button>
        <span className="image-stack-title">Read Images</span>
      </div>

      <button
        className="scan-btn"
        onClick={() => inputRef.current?.click()}
      >
        {images.length > 0 ? "Change images" : "Pick images"}
      </button>

      {/* Hidden file input — triggered programmatically */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFiles}
      />

      {images.length > 0 && (
        <div className="image-stack-results">
          <div
            className="camera-thumb-strip image-stack-strip"
            role="list"
            aria-label="Selected images"
          >
            {images.map((img, i) => (
              <div
                key={img.url}
                className="camera-thumb-btn"
                role="listitem"
                aria-label={`Image ${i + 1}`}
                style={{ cursor: "default" }}
              >
                <img
                  src={img.url}
                  className="camera-thumb-img"
                  alt=""
                  draggable="false"
                />
              </div>
            ))}
          </div>

          <div className="image-stack-meta">
            <span className="image-stack-count">
              {images.length} image{images.length !== 1 ? "s" : ""} selected
            </span>
            <button className="image-stack-clear-btn" onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
