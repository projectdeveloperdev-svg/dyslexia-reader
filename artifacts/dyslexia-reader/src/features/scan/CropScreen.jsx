import { useRef, useState } from "react";
import { Cropper } from "react-advanced-cropper";
import "react-advanced-cropper/dist/style.css";
import { getCroppedImg } from "./cropCanvas.js";
import "./CropScreen.css";

/**
 * Full-screen free-resize crop overlay rendered inside the camera portal.
 *
 * Props:
 *  imageUrl              — full-resolution data URL from normaliseCapture
 *  onConfirm(dataUrl)    — called with either a cropped region OR the full
 *                          image. Both "Use crop" and "Whole page" go through
 *                          this single path so the crop screen stays mounted
 *                          (busy=true) until the caller dismisses it via
 *                          setPendingCrop(null). This prevents the native
 *                          Capacitor camera layer from receiving touch events
 *                          while OCR is running.
 *
 * Coordinates:
 *  react-advanced-cropper.getCoordinates() returns { left, top, width, height }
 *  in REAL image pixels (not display pixels). We map left→x, top→y and pass
 *  straight to getCroppedImg which already handles full-res cropping correctly.
 *
 * Fallback:
 *  The previous react-easy-crop version is preserved as CropScreen.easycrop.jsx.
 *  To switch back, swap the import in CameraView.jsx.
 */
export default function CropScreen({ imageUrl, onConfirm }) {
  const cropperRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [cropError, setCropError] = useState(null);

  // Initial box is inset ~9% on each side so corner handles sit away from the
  // screen edges and are easy to grab with a thumb.
  // NOTE: reset() would go back to these inset defaults, so we do NOT use it
  // in handleReset — see below.
  function defaultSize({ imageSize }) {
    return {
      width: Math.round(imageSize.width * 0.82),
      height: Math.round(imageSize.height * 0.82),
    };
  }

  function defaultPosition({ imageSize }) {
    return {
      left: Math.round(imageSize.width * 0.09),
      top: Math.round(imageSize.height * 0.09),
    };
  }

  // Reset to FULL IMAGE (not back to the inset default).
  // CropperState shape: { boundary, imageSize, transforms, visibleArea, coordinates }
  // state.imageSize = { width, height } in real image pixels — the correct field.
  // state.image does NOT exist on CropperState (that was the bug: guard was always false).
  function handleReset() {
    const cropper = cropperRef.current;
    if (!cropper) return;
    const state = cropper.getState();
    console.log("[CropScreen] handleReset — imageSize:", state?.imageSize);
    if (state?.imageSize?.width > 0 && state?.imageSize?.height > 0) {
      cropper.setCoordinates({
        left: 0,
        top: 0,
        width: state.imageSize.width,
        height: state.imageSize.height,
      });
    }
  }

  // "Whole page" — same path as "Use crop", just skipping getCroppedImg.
  // Passing imageUrl (full image) through onConfirm keeps the crop screen
  // mounted (busy=true) while the caller runs OCR, so the native camera
  // layer is never exposed to stray touch events mid-processing.
  async function handleWholePage() {
    if (busy) return;
    setBusy(true);
    setCropError(null);
    try {
      onConfirm(imageUrl);
      // Caller (handleCropConfirm) calls setPendingCrop(null) which unmounts
      // this component — no need to reset busy on success.
    } catch (err) {
      console.error("[CropScreen] whole page failed:", err);
      setCropError("Failed — try again.");
      setBusy(false);
    }
  }

  async function handleUse() {
    if (busy) return;
    const cropper = cropperRef.current;
    if (!cropper) return;

    // getCoordinates() → { left, top, width, height } in real image pixels.
    const coords = cropper.getCoordinates();
    if (!coords || coords.width <= 0 || coords.height <= 0) return;

    // Map to the shape getCroppedImg expects.
    const pixelCrop = {
      x: Math.round(coords.left),
      y: Math.round(coords.top),
      width: Math.round(coords.width),
      height: Math.round(coords.height),
    };

    setBusy(true);
    setCropError(null);
    try {
      const croppedDataUrl = await getCroppedImg(imageUrl, pixelCrop);
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
      {/* Cropper fills all available vertical space */}
      <div className="crop-area">
        <Cropper
          ref={cropperRef}
          src={imageUrl}
          defaultSize={defaultSize}
          defaultPosition={defaultPosition}
          className="crop-advanced"
        />
      </div>

      {/* Error banner */}
      {cropError && (
        <p className="crop-error" role="alert">
          {cropError}
        </p>
      )}

      {/* Hint */}
      <p className="crop-hint">Drag handles to resize · Drag inside to move</p>

      {/* Action buttons */}
      <div className="crop-controls">
        <button
          className="crop-btn crop-btn--reset"
          onClick={handleReset}
          disabled={busy}
        >
          Reset
        </button>
        <button
          className="crop-btn crop-btn--whole"
          onClick={handleWholePage}
          disabled={busy}
        >
          {busy ? "Processing…" : "Whole page"}
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
