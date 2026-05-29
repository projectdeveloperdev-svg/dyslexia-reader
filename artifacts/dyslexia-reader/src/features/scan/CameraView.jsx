import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CameraPreview } from "@capacitor-community/camera-preview";
import { runOCR } from "../ocr/runOCR";
import { addSnippet, clearSnippets } from "../stack/stackStore";
import "./CameraView.css";

const MAX_LONGEST_EDGE = 4000;

/**
 * Normalises a raw JPEG base64 string captured by camera-preview:
 *  1. Applies EXIF orientation so pixels are physically upright (matching what
 *     @capacitor/camera's DataUrl path did automatically).
 *  2. Scales down if the longest post-rotation edge exceeds MAX_LONGEST_EDGE.
 *
 * Returns a data URL (image/jpeg, no EXIF) ready for ML Kit.
 */
async function normaliseCapture(base64) {
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  const resp = await fetch(dataUrl);
  const blob = await resp.blob();

  let bitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    // Fallback: WebView doesn't support imageOrientation option — use raw bitmap.
    bitmap = await createImageBitmap(blob);
  }

  // Post-rotation dimensions (bitmap.width/height reflect the upright image).
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_LONGEST_EDGE ? MAX_LONGEST_EDGE / longest : 1;
  const cw = Math.round(bitmap.width * scale);
  const ch = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, cw, ch);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.98);
}

const PREVIEW_ID = "camera-preview-container";

export default function CameraView({
  // scan mode props
  onLoading,
  onResult,
  onError,
  onReset,
  // shared
  mode = "scan",
  // stack mode props
  onDone,
  onStackCancel,
}) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  // stack-mode-only state
  const [stackCount, setStackCount] = useState(0);
  const [showDiscard, setShowDiscard] = useState(false);

  // Stack mode: auto-open camera on mount.
  useEffect(() => {
    if (mode === "stack") {
      document.body.classList.add("camera-open");
      setActive(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Scan mode handlers ─────────────────────────────────────────────────

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
      const dataUrl = await normaliseCapture(base64);
      const text = await runOCR(dataUrl);
      onResult(text);
    } catch (e) {
      console.error("[CameraView] OCR failed:", e);
      onError();
    }
  }

  // ── Stack mode handlers ────────────────────────────────────────────────

  async function handleStackShutter() {
    if (busy) return;
    setBusy(true);

    let base64;
    try {
      const result = await CameraPreview.capture({ quality: 85 });
      base64 = result.value;
    } catch (e) {
      console.error("[CameraView] stack capture failed:", e);
      setBusy(false);
      return;
    }

    // Camera stays open — process OCR while viewfinder remains live.
    try {
      const dataUrl = await normaliseCapture(base64);
      const ocrText = await runOCR(dataUrl);
      addSnippet(dataUrl, ocrText);
      setStackCount((c) => c + 1);
    } catch (e) {
      console.error("[CameraView] stack OCR failed:", e);
    }

    setBusy(false);
  }

  function handleStackCancel() {
    if (stackCount === 0) {
      setActive(false);
      onStackCancel();
    } else {
      setShowDiscard(true);
    }
  }

  function handleDiscard() {
    clearSnippets();
    setShowDiscard(false);
    setActive(false);
    onStackCancel();
  }

  function handleKeep() {
    setShowDiscard(false);
  }

  function handleDone() {
    setActive(false);
    onDone(stackCount);
  }

  // ── Inactive: render trigger button (scan mode only) ───────────────────

  if (!active) {
    if (mode === "scan") {
      return (
        <button className="scan-btn" onClick={openCamera}>
          Scan
        </button>
      );
    }
    // Stack mode with !active means we're transitioning out — render nothing.
    return null;
  }

  // ── Active: full-screen overlay portalled to document.body ─────────────
  // The native camera layer sits behind the WebView; this div is transparent
  // so the camera shows through, with the control bar at the bottom.
  return createPortal(
    <div id={PREVIEW_ID} className="camera-overlay">
      {mode === "stack" && (
        <div className="camera-counter-pill" aria-live="polite">
          {stackCount} / 5
        </div>
      )}

      <div className="camera-controls">
        <button
          className="camera-cancel-btn"
          onClick={mode === "stack" ? handleStackCancel : cancelCamera}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          className="camera-shutter-btn"
          onClick={mode === "stack" ? handleStackShutter : handleShutter}
          disabled={busy}
          aria-label="Take photo"
        />
        {mode === "stack" ? (
          <button
            className="camera-done-btn"
            onClick={handleDone}
            disabled={busy || stackCount === 0}
          >
            Done
          </button>
        ) : (
          /* Spacer mirrors the Cancel button width to keep shutter centred */
          <div className="camera-shutter-spacer" aria-hidden="true" />
        )}
      </div>

      {showDiscard && (
        <div className="camera-discard-backdrop">
          <div className="camera-discard-dialog">
            <p className="camera-discard-msg">
              Discard {stackCount} snippet{stackCount !== 1 ? "s" : ""}?
            </p>
            <div className="camera-discard-actions">
              <button className="camera-discard-btn" onClick={handleDiscard}>
                Discard
              </button>
              <button className="camera-keep-btn" onClick={handleKeep}>
                Keep
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
