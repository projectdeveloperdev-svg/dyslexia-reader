import { useState, useEffect, useRef } from "react";
import CameraView from "./CameraView";
import UploadButton from "./UploadButton";
import PasteInput from "./PasteInput";
import ReadButton from "../tts/ReadButton";
import WordText from "../tts/WordText";
import CopyRow from "../copy/CopyRow";
import { useTTS } from "../tts/useTTS";
import { cleanText } from "../ocr/cleanText";
import "./ScanSection.css";

function ScanSection() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [text, setText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [autoRead, setAutoRead] = useState(() => {
    return localStorage.getItem("dexy-auto-read") === "true";
  });
  const autoReadPendingRef = useRef(false);
  const pinchRef = useRef({ active: false, startDist: 0, startSize: 0, lastSize: 22 });
  const [showPinchTip, setShowPinchTip] = useState(
    () => localStorage.getItem("dexy.pinchTooltipSeen") !== "true"
  );
  const pinchTipTimerRef = useRef(null);
  const [fontSize, setFontSize] = useState(() => {
    const stored = localStorage.getItem("dexy-font-size");
    return stored ? parseInt(stored, 10) : 22;
  });
  const [fontFamily, setFontFamily] = useState(() => {
    return localStorage.getItem("dexy-font-family") ?? "sans-serif";
  });
  const [bgColour, setBgColour] = useState(() => {
    return localStorage.getItem("dexy-bg-colour") ?? "255, 255, 255";
  });
  const [bgOpacity, setBgOpacity] = useState(() => {
    const stored = localStorage.getItem("dexy-bg-opacity");
    return stored ? parseFloat(stored) : 1;
  });

  function changeFontSize(val) {
    setFontSize(val);
    localStorage.setItem("dexy-font-size", val);
  }

  function dismissPinchTip() {
    setShowPinchTip(false);
    try { localStorage.setItem("dexy.pinchTooltipSeen", "true"); } catch (e) {}
    if (pinchTipTimerRef.current) clearTimeout(pinchTipTimerRef.current);
  }

  // Auto-dismiss the tooltip 5 seconds after the text appears.
  useEffect(() => {
    if (status !== "done" || !showPinchTip) return;
    pinchTipTimerRef.current = setTimeout(dismissPinchTip, 5000);
    return () => clearTimeout(pinchTipTimerRef.current);
  }, [status, showPinchTip]);

  function handlePinchStart(e) {
    if (e.touches.length !== 2) return;
    dismissPinchTip();
    const [t1, t2] = e.touches;
    pinchRef.current = {
      active: true,
      startDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
      startSize: fontSize,
      lastSize: fontSize,
    };
  }

  function handlePinchMove(e) {
    if (!pinchRef.current.active || e.touches.length !== 2) return;
    const [t1, t2] = e.touches;
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    const ratio = dist / pinchRef.current.startDist;
    const next = Math.round(
      Math.min(36, Math.max(14, pinchRef.current.startSize * ratio))
    );
    pinchRef.current.lastSize = next;
    setFontSize(next);
  }

  function handlePinchEnd() {
    if (!pinchRef.current.active) return;
    pinchRef.current.active = false;
    try {
      localStorage.setItem("dexy-font-size", pinchRef.current.lastSize);
    } catch (err) {
      console.error("localStorage write failed:", err);
    }
  }

  function changeFontFamily(val) {
    setFontFamily(val);
    localStorage.setItem("dexy-font-family", val);
  }

  function changeBgColour(val) {
    setBgColour(val);
    localStorage.setItem("dexy-bg-colour", val);
  }

  function changeBgOpacity(val) {
    setBgOpacity(val);
    localStorage.setItem("dexy-bg-opacity", val);
  }

  const {
    ttsState, rate, pitch, voices, selectedVoice,
    wordIndex,
    toggle, stop, seekToWord,
    changeRate, changePitch, changeVoice,
  } = useTTS(text);

  // Restore rate and pitch from localStorage on mount.
  // ttsState is always "idle" here so changeRate/changePitch only set state — no restart.
  useEffect(() => {
    const stored = localStorage.getItem("dexy-speed");
    if (stored) changeRate(parseFloat(stored));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stored = localStorage.getItem("dexy-pitch");
    if (stored) changePitch(parseFloat(stored));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore voice when voices list first populates.
  // Runs at most once (ref guard).
  // Mirrors the localService filter used in ReadButton so the restored voice
  // always appears in the dropdown.
  // If the saved voice is absent from the local pool, falls back to the first
  // available local voice and updates localStorage accordingly.
  const voiceRestored = useRef(false);
  useEffect(() => {
    if (voiceRestored.current || !voices.length) return;
    voiceRestored.current = true;

    const localVoices = voices.filter((v) => v.localService === true);
    const pool = localVoices.length > 0 ? localVoices : voices;

    const savedUri = localStorage.getItem("dexy-voice");
    if (savedUri) {
      const saved = pool.find((v) => v.voiceURI === savedUri);
      if (saved) {
        changeVoice(saved);
        return;
      }
      // Saved voice not in local pool — pick first available and update storage.
      const fallback = pool[0];
      if (fallback) {
        changeVoice(fallback);
        try { localStorage.setItem("dexy-voice", fallback.voiceURI); } catch (e) { console.error("localStorage write failed:", e); }
      }
    }
    // No saved voice: leave useTTS to use its own default.
  }, [voices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wrappers that persist audio settings to localStorage.
  function handleChangeRate(val) {
    changeRate(val);
    try { localStorage.setItem("dexy-speed", val); } catch (e) { console.error("localStorage write failed:", e); }
  }

  function handleChangePitch(val) {
    changePitch(val);
    try { localStorage.setItem("dexy-pitch", val); } catch (e) { console.error("localStorage write failed:", e); }
  }

  function handleChangeVoice(voice) {
    changeVoice(voice);
    try {
      if (voice) localStorage.setItem("dexy-voice", voice.voiceURI);
    } catch (e) { console.error("localStorage write failed:", e); }
  }

  function changeAutoRead(val) {
    setAutoRead(val);
    try { localStorage.setItem("dexy-auto-read", val); } catch (e) { console.error("localStorage write failed:", e); }
  }

  // Fire auto-read once useTTS has settled on the new text (ttsState resets to
  // "idle" after text changes). The ref flag ensures it triggers exactly once
  // and only on successful OCR with non-empty text.
  useEffect(() => {
    if (!autoReadPendingRef.current || !text || ttsState !== "idle") return;
    autoReadPendingRef.current = false;
    toggle();
  }, [text, ttsState, toggle]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleEditStart() {
    stop();
    setEditValue(text);
    setIsEditing(true);
  }

  function handleEditDone() {
    const newText = editValue.trim();
    if (newText) setText(newText);
    setIsEditing(false);
  }

  function handleLoading() {
    setStatus("loading");
    setText("");
  }

  function handleResult(extracted) {
    if (!extracted) {
      setStatus("error");
    } else {
      setText(cleanText(extracted));
      setStatus("done");
      if (autoRead) autoReadPendingRef.current = true;
    }
  }

  // Paste-specific path: preserve all newlines, don't apply OCR noise rules.
  function handlePasteResult(raw) {
    if (!raw || !raw.trim()) {
      setStatus("error");
      return;
    }
    const cleaned = raw
      .replace(/\r\n/g, "\n")        // normalise Windows line endings first
      .replace(/\r/g, "\n")          // normalise old Mac line endings
      .replace(/\n{3,}/g, "\n\n")    // collapse 3+ blank lines to one paragraph break
      .replace(/[ \t]{2,}/g, " ")    // collapse runs of spaces/tabs only (not newlines)
      .trim();
    setText(cleaned);
    setStatus("done");
    if (autoRead) autoReadPendingRef.current = true;
  }

  function handleError() {
    setStatus("error");
    setText("");
  }

  function handleReset() {
    setStatus("idle");
    setText("");
  }

  return (
    <div className="scan-section">
      <label className="auto-read-row" htmlFor="auto-read-toggle">
        <span className="auto-read-label">Auto-read after scan</span>
        <span className={`toggle-track${autoRead ? " toggle-on" : ""}`}>
          <span className="toggle-thumb" />
        </span>
        <input
          id="auto-read-toggle"
          type="checkbox"
          className="toggle-input"
          checked={autoRead}
          onChange={(e) => changeAutoRead(e.target.checked)}
        />
      </label>

      <div className="scan-section-buttons">
        <CameraView
          onLoading={handleLoading}
          onResult={handleResult}
          onError={handleError}
          onReset={handleReset}
        />
        <UploadButton
          onLoading={handleLoading}
          onResult={handleResult}
          onError={handleError}
          onReset={handleReset}
        />
        <PasteInput onResult={handlePasteResult} onReset={handleReset} />
      </div>

      {status === "loading" && (
        <div className="ocr-loading">
          <div className="ocr-spinner" />
          <span className="ocr-loading-text">Reading your photo…</span>
        </div>
      )}

      {status === "done" && (
        <>
          <div
            className="ocr-edit-wrapper"
            onTouchStart={handlePinchStart}
            onTouchMove={handlePinchMove}
            onTouchEnd={handlePinchEnd}
            onTouchCancel={handlePinchEnd}
          >
            {isEditing ? (
              <textarea
                className="ocr-edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleEditDone}
                style={{ "--ocr-font-size": `${fontSize}px`, fontFamily, "--ocr-bg-rgb": bgColour, "--ocr-bg-opacity": bgOpacity }}
              />
            ) : (
              <WordText text={text} wordIndex={wordIndex} onWordTap={seekToWord} fontSize={fontSize} fontFamily={fontFamily} bgColour={bgColour} bgOpacity={bgOpacity} />
            )}
            <button className="ocr-edit-btn" onClick={isEditing ? handleEditDone : handleEditStart}>
              {isEditing ? "Done" : "Edit"}
            </button>
          </div>
          {showPinchTip && (
            <div className="pinch-tip" role="status" aria-live="polite">
              <span className="pinch-tip-text">Pinch to resize text</span>
              <button
                className="pinch-tip-dismiss"
                onClick={dismissPinchTip}
                aria-label="Dismiss tip"
              >×</button>
            </div>
          )}
          <CopyRow text={text} />
          <ReadButton
            ttsState={ttsState}
            rate={rate}
            pitch={pitch}
            voices={voices}
            selectedVoice={selectedVoice}
            toggle={toggle}
            stop={stop}
            changeRate={handleChangeRate}
            changePitch={handleChangePitch}
            changeVoice={handleChangeVoice}
            fontFamily={fontFamily}
            changeFontFamily={changeFontFamily}
            bgColour={bgColour}
            changeBgColour={changeBgColour}
            bgOpacity={bgOpacity}
            changeBgOpacity={changeBgOpacity}
          />
        </>
      )}

      {status === "error" && (
        <p className="ocr-error">No text found. Try another photo.</p>
      )}
    </div>
  );
}

export default ScanSection;
