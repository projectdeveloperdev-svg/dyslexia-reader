import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CameraPreview } from "@capacitor-community/camera-preview";
import { runOCR } from "../ocr/runOCR";
import "./CameraView.css";

const PREVIEW_ID = "camera-preview-container";

export default function CameraView({ onLoading, onResult, onError, onReset }) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  // Start the native camera preview AFTER the portal div is committed to the
  // DOM. React guarantees useEffect runs after paint, so the element exists.
  // The cleanup handler stops the camera whenever active goes false or the
  // component unmounts.
  useEffect(() => {
    if (!active) return;

    CameraPreview.start({
      parent: PREVIEW_ID,
      position: "rear",
      toBack: true,
      width: window.innerWidth,
      height: window.innerHeight,
    }).catch((e) => {
      console.error("[CameraView] start failed:", e);
      document.body.classList.remove("camera-open");
      setActive(false);
    });

    return () => {
      // Runs when active → false or on unmount. stop() is also called
      // explicitly in handleShutter before setActive(false) so we may
      // double-call here; the catch absorbs the no-op error.
      CameraPreview.stop().catch(() => {});
      document.body.classList.remove("camera-open");
    };
  }, [active]);

  function openCamera() {
    document.body.classList.add("camera-open");
    setActive(true);
  }

  function cancelCamera() {
    // Changing active to false triggers the useEffect cleanup → stop().
    setActive(false);
    setBusy(false);
  }

  async function handleShutter() {
    if (busy) return;
    setBusy(true);

    let base64;
    try {
      const result = await CameraPreview.capture({ quality: 85 });
      base64 = result.value;
    } catch (e) {
      console.error("[CameraView] capture failed:", e);
      setBusy(false);
      return;
    }

    // Stop the preview immediately so the screen returns to normal while OCR
    // runs (which can take a moment on device).
    try { await CameraPreview.stop(); } catch {}
    document.body.classList.remove("camera-open");
    setActive(false);
    setBusy(false);

    onReset();
    onLoading();
    try {
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      const text = await runOCR(dataUrl);
      onResult(text);
    } catch (e) {
      console.error("[CameraView] OCR failed:", e);
      onError();
    }
  }

  // Inactive state: render the Scan button in the normal button row.
  if (!active) {
    return (
      <button className="scan-btn" onClick={openCamera}>
        Scan
      </button>
    );
  }

  // Active state: full-screen overlay portalled to document.body.
  // The native camera layer sits behind the WebView; this div is transparent
  // so the camera shows through, with the control bar at the bottom.
  return createPortal(
    <div id={PREVIEW_ID} className="camera-overlay">
      {/* Framing guide — decorative only, no interaction, no crop effect */}
      <div className="camera-guide-area" aria-hidden="true">
        <div className="camera-framing-guide" />
      </div>
      <div className="camera-controls">
        <button
          className="camera-cancel-btn"
          onClick={cancelCamera}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          className="camera-shutter-btn"
          onClick={handleShutter}
          disabled={busy}
          aria-label="Take photo"
        />
        {/* Spacer mirrors the Cancel button width to keep shutter centred */}
        <div className="camera-shutter-spacer" aria-hidden="true" />
      </div>
    </div>,
    document.body
  );
}
