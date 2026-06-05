import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CameraPreview } from "@capacitor-community/camera-preview";
import { normaliseCapture } from "./normaliseCapture";
import { runOCR } from "../ocr/runOCR";
import {
  addSnippet,
  clearSnippets,
  deleteSnippet,
  replaceSnippet,
} from "../stack/stackStore";
import CapLimitSheet from "../stack/CapLimitSheet";
import MegaStackSheet from "../stack/MegaStackSheet";
import "./CameraView.css";

const STACK_CAP = 5;
const PREVIEW_ID = "camera-preview-container";

export default function CameraView({
  // scan mode props
  onLoading,
  onResult,
  onError,
  onReset,
  // shared
  mode = "scan",
  // stack / megastack mode props
  onDone,        // Quick Stack: called with (count) on Done
  onMegaDone,    // Mega Stack:  called with (images, ocrTexts) on Done; may throw
  onStackCancel,
}) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Stack-mode state (shared by "stack" and "megastack") ──────────────
  const [thumbnails, setThumbnails] = useState([]);      // data URLs in capture order
  const [megaOcrTexts, setMegaOcrTexts] = useState([]);  // parallel; used in megastack only
  const [stackCount, setStackCount] = useState(0);
  const [retakeIndex, setRetakeIndex] = useState(null);
  const [showThumbnailSheet, setShowThumbnailSheet] = useState(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [megaSaveError, setMegaSaveError] = useState(null);

  // ── Quick Stack only ──────────────────────────────────────────────────
  const [showCapLimit, setShowCapLimit] = useState(false);
  const [capLimitSeen, setCapLimitSeen] = useState(false);
  const [showMegaStack, setShowMegaStack] = useState(false);

  // Auto-open camera on mount for both stack modes.
  useEffect(() => {
    if (mode === "stack" || mode === "megastack") {
      document.body.classList.add("camera-open");
      setActive(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      CameraPreview.stop().catch(() => {});
      document.body.classList.remove("camera-open");
    };
  }, [active]);

  // ── Scan mode handlers ────────────────────────────────────────────────

  function openCamera() {
    document.body.classList.add("camera-open");
    setActive(true);
  }

  function cancelCamera() {
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

  // ── Stack / Mega Stack shutter ────────────────────────────────────────

  async function handleStackShutter() {
    if (busy || saving) return;

    const isRetaking = retakeIndex !== null;

    // Cap gate: Quick Stack only — Mega Stack has no limit.
    if (mode === "stack" && !isRetaking && stackCount >= STACK_CAP) {
      if (!capLimitSeen) {
        setCapLimitSeen(true);
        setShowCapLimit(true);
      }
      return;
    }

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

    try {
      const dataUrl = await normaliseCapture(base64);
      const ocrText = await runOCR(dataUrl);

      if (mode === "megastack") {
        // Mega Stack: keep images + ocrTexts in local state only.
        // stackStore is NOT populated during capture — commitMegaStack does
        // that atomically after a successful disk save.
        if (isRetaking) {
          setThumbnails((prev) => {
            const next = [...prev];
            next[retakeIndex] = dataUrl;
            return next;
          });
          setMegaOcrTexts((prev) => {
            const next = [...prev];
            next[retakeIndex] = ocrText;
            return next;
          });
          setRetakeIndex(null);
        } else {
          setThumbnails((prev) => [...prev, dataUrl]);
          setMegaOcrTexts((prev) => [...prev, ocrText]);
          setStackCount((c) => c + 1);
        }
      } else {
        // Quick Stack: store in stackStore immediately.
        if (isRetaking) {
          replaceSnippet(retakeIndex, dataUrl, ocrText);
          setThumbnails((prev) => {
            const next = [...prev];
            next[retakeIndex] = dataUrl;
            return next;
          });
          setRetakeIndex(null);
        } else {
          addSnippet(dataUrl, ocrText);
          setThumbnails((prev) => [...prev, dataUrl]);
          setStackCount((c) => c + 1);
        }
      }
    } catch (e) {
      console.error("[CameraView] stack OCR failed:", e);
    }

    setBusy(false);
  }

  // ── Cancel / discard ──────────────────────────────────────────────────

  function handleStackCancel() {
    if (stackCount === 0) {
      setActive(false);
      onStackCancel();
    } else {
      setShowDiscard(true);
    }
  }

  function handleDiscard() {
    // Quick Stack populated stackStore during capture; Mega Stack did not.
    // clearSnippets is a no-op for Mega Stack but safe to call either way.
    clearSnippets();
    setShowDiscard(false);
    setActive(false);
    onStackCancel();
  }

  function handleKeep() {
    setShowDiscard(false);
  }

  // ── Done ──────────────────────────────────────────────────────────────

  async function handleDone() {
    if (mode === "megastack") {
      setSaving(true);
      setMegaSaveError(null);
      try {
        // onMegaDone is async and throws on save failure.
        // Keep the camera overlay open until it resolves so the user's
        // captured session is preserved if something goes wrong.
        await onMegaDone([...thumbnails], [...megaOcrTexts]);
        // Success: App.jsx has already navigated to the reader. Close overlay.
        setActive(false);
      } catch (err) {
        console.error("[CameraView] Mega Stack save failed:", err);
        setMegaSaveError("Could not save this stack. Please try again.");
      } finally {
        setSaving(false);
      }
    } else {
      setActive(false);
      onDone(stackCount);
    }
  }

  // ── Thumbnail action sheet handlers ───────────────────────────────────

  function handleRetake() {
    setRetakeIndex(showThumbnailSheet);
    setShowThumbnailSheet(null);
  }

  function handleDeleteThumb() {
    const idx = showThumbnailSheet;

    if (mode === "megastack") {
      setMegaOcrTexts((prev) => prev.filter((_, i) => i !== idx));
    } else {
      deleteSnippet(idx);
    }

    setThumbnails((prev) => prev.filter((_, i) => i !== idx));
    const newCount = stackCount - 1;
    setStackCount(newCount);

    if (mode === "stack" && newCount < STACK_CAP && capLimitSeen) {
      setCapLimitSeen(false);
    }
    if (retakeIndex === idx) {
      setRetakeIndex(null);
    } else if (retakeIndex !== null && retakeIndex > idx) {
      setRetakeIndex((r) => r - 1);
    }
    setShowThumbnailSheet(null);
  }

  // ── Quick Stack cap-limit sheet handlers ──────────────────────────────

  function handleCapLimitReadNow() {
    setShowCapLimit(false);
    setActive(false);
    onDone(stackCount);
  }

  function handleCapLimitGetMegaStack() {
    setShowCapLimit(false);
    setShowMegaStack(true);
  }

  function handleCapLimitDismiss() {
    setShowCapLimit(false);
  }

  // ── Inactive: render trigger (scan mode only) ─────────────────────────

  if (!active) {
    if (mode === "scan") {
      return (
        <button className="scan-btn" onClick={openCamera}>
          Scan
        </button>
      );
    }
    return null;
  }

  // ── Derived values ────────────────────────────────────────────────────

  const isQuickStack = mode === "stack";
  const atCap = isQuickStack && stackCount >= STACK_CAP;
  const pillAmber = atCap;
  // Shutter fires unless busy/saving. Quick Stack adds the cap-gate check.
  const shutterActive =
    !busy &&
    !saving &&
    (mode === "megastack" || retakeIndex !== null || !atCap || !capLimitSeen);

  // ── Active: full-screen overlay ───────────────────────────────────────

  return createPortal(
    <div id={PREVIEW_ID} className="camera-overlay">
      {/* Counter pill */}
      {(mode === "stack" || mode === "megastack") && (
        <div
          className={`camera-counter-pill${pillAmber ? " camera-counter-pill--amber" : ""}`}
          aria-live="polite"
        >
          <span>
            {stackCount}
            {isQuickStack ? ` / ${STACK_CAP}` : ""}
          </span>
          {isQuickStack && pillAmber && !capLimitSeen && (
            <span className="camera-counter-sub">
              Last snippet — tap Done to read.
            </span>
          )}
        </div>
      )}

      {/* Bottom area */}
      <div className="camera-bottom">
        {/* Thumbnail strip */}
        {(mode === "stack" || mode === "megastack") && thumbnails.length > 0 && (
          <div
            className="camera-thumb-strip"
            role="list"
            aria-label="Captured snippets"
          >
            {thumbnails.map((src, i) => (
              <button
                key={i}
                className={`camera-thumb-btn${
                  retakeIndex === i ? " camera-thumb-btn--retaking" : ""
                }`}
                onClick={() => setShowThumbnailSheet(i)}
                aria-label={`Snippet ${i + 1}${
                  retakeIndex === i ? ", retaking" : ""
                }`}
                role="listitem"
              >
                <img src={src} className="camera-thumb-img" alt="" />
                {retakeIndex === i && (
                  <div className="camera-thumb-retake-badge" aria-hidden="true">
                    ↺
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Save error — shown inline above controls when a Mega Stack save fails */}
        {mode === "megastack" && megaSaveError && (
          <p className="camera-save-error" role="alert">
            {megaSaveError}
          </p>
        )}

        {/* Control bar */}
        <div className="camera-controls">
          <button
            className="camera-cancel-btn"
            onClick={
              mode === "stack" || mode === "megastack"
                ? handleStackCancel
                : cancelCamera
            }
            disabled={busy || saving}
          >
            Cancel
          </button>
          <button
            className="camera-shutter-btn"
            onClick={
              mode === "stack" || mode === "megastack"
                ? handleStackShutter
                : handleShutter
            }
            disabled={!shutterActive}
            aria-label="Take photo"
          />
          {mode === "stack" || mode === "megastack" ? (
            <button
              className="camera-done-btn"
              onClick={handleDone}
              disabled={busy || saving || stackCount === 0}
            >
              {saving ? "Saving…" : "Done"}
            </button>
          ) : (
            <div className="camera-shutter-spacer" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Thumbnail action sheet */}
      {showThumbnailSheet !== null && (
        <div
          className="camera-thumb-action-backdrop"
          onClick={() => setShowThumbnailSheet(null)}
        >
          <div
            className="camera-thumb-action-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="camera-thumb-action-btn" onClick={handleRetake}>
              Retake
            </button>
            <button
              className="camera-thumb-action-btn camera-thumb-action-btn--danger"
              onClick={handleDeleteThumb}
            >
              Delete
            </button>
            <button
              className="camera-thumb-action-btn camera-thumb-action-btn--cancel"
              onClick={() => setShowThumbnailSheet(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Discard confirmation */}
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

      {/* Cap limit sheet — Quick Stack only */}
      {isQuickStack && (
        <CapLimitSheet
          open={showCapLimit}
          onReadNow={handleCapLimitReadNow}
          onGetMegaStack={handleCapLimitGetMegaStack}
          onDismiss={handleCapLimitDismiss}
        />
      )}

      {/* Mega Stack "coming soon" — reachable from Quick Stack cap limit sheet */}
      {isQuickStack && (
        <MegaStackSheet
          open={showMegaStack}
          onClose={() => setShowMegaStack(false)}
        />
      )}
    </div>,
    document.body
  );
}
