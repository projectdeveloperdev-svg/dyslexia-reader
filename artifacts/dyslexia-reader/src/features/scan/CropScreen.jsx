import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "./cropCanvas.js";
import "./CropScreen.css";

/**
 * Full-screen crop overlay rendered inside the camera portal.
 *
 * Props:
 *  imageUrl   — full-resolution data URL from normaliseCapture
 *  onConfirm(croppedDataUrl) — user accepted a crop; receives cropped JPEG data URL
 *  onWholePage()             — user skipped crop; caller uses the full image
 */
export default function CropScreen({ imageUrl, onConfirm, onWholePage }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cropError, setCropError] = useState(null);

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleUse() {
    if (!croppedAreaPixels || busy) return;
    setBusy(true);
    setCropError(null);
    try {
      const croppedDataUrl = await getCroppedImg(imageUrl, croppedAreaPixels);
      onConfirm(croppedDataUrl);
      // Component unmounts on success — no need to reset busy.
    } catch (err) {
      console.error("[CropScreen] getCroppedImg failed:", err);
      setCropError("Crop failed — tap Whole page to continue.");
      setBusy(false);
    }
  }

  return (
    <div className="crop-screen">
      {/* react-easy-crop fills .crop-area */}
      <div className="crop-area">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={3 / 4}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          showGrid={true}
          style={{
            containerStyle: { background: "#000" },
          }}
        />
      </div>

      {/* Error banner */}
      {cropError && (
        <p className="crop-error" role="alert">
          {cropError}
        </p>
      )}

      {/* Hint */}
      <p className="crop-hint">Drag to position · Pinch to zoom</p>

      {/* Action buttons */}
      <div className="crop-controls">
        <button
          className="crop-btn crop-btn--whole"
          onClick={onWholePage}
          disabled={busy}
        >
          Whole page
        </button>
        <button
          className="crop-btn crop-btn--use"
          onClick={handleUse}
          disabled={busy}
        >
          {busy ? "Cropping…" : "Use crop"}
        </button>
      </div>
    </div>
  );
}
