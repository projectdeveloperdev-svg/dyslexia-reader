import { useState, useEffect, useRef } from "react";
import { useTTS } from "../tts/useTTS";
import ReadButton from "../tts/ReadButton";
import WordText from "../tts/WordText";
import CopyRow from "../copy/CopyRow";
import "./ReaderView.css";

export default function ReaderView({
  text,
  autoRead,
  // ── Optional PagedReader callbacks (additive — ScanSection never passes these) ──
  onPlaybackEnd,      // called on natural TTS completion only (not stop/pause)
  autoPlayKey,        // non-zero on mount → trigger play once; 0/undefined → idle
  collapseWhitespace = false, // when true, TTS collapses whitespace runs (EPUB — separate from word-tap)
}) {
  // ── Local display text (prop-initialised, can be overridden by edit) ────
  // Editing only updates this local copy; callers don't need to know.
  const [displayText, setDisplayText] = useState(text);

  // Sync displayText when a new scan result arrives.
  useEffect(() => {
    setDisplayText(text);
  }, [text]);

  // ── Edit mode ─────────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  // ── Pinch-to-resize ───────────────────────────────────────────────────
  const pinchRef = useRef({ active: false, startDist: 0, startSize: 0, lastSize: 22 });
  const [showPinchTip, setShowPinchTip] = useState(
    () => localStorage.getItem("dexy.pinchTooltipSeen") !== "true"
  );
  const pinchTipTimerRef = useRef(null);

  function dismissPinchTip() {
    setShowPinchTip(false);
    try { localStorage.setItem("dexy.pinchTooltipSeen", "true"); } catch (e) {}
    if (pinchTipTimerRef.current) clearTimeout(pinchTipTimerRef.current);
  }

  // Auto-dismiss the tooltip 5 s after text appears; restarts on each new scan.
  useEffect(() => {
    if (!showPinchTip) return;
    pinchTipTimerRef.current = setTimeout(dismissPinchTip, 5000);
    return () => clearTimeout(pinchTipTimerRef.current);
  }, [text, showPinchTip]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Display settings ──────────────────────────────────────────────────
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

  // ── TTS ───────────────────────────────────────────────────────────────
  // manualStopRef declared here (before useTTS) so it can be closed over
  // by the onError callback passed into the hook.
  // true  = user paused/stopped OR speak() threw — suppresses advance.
  // false = cleared when TTS re-enters "speaking" (resume / new play).
  const manualStopRef = useRef(false);

  const {
    ttsState, rate, pitch, voices, selectedVoice,
    wordIndex,
    toggle, stop, seekToWord,
    changeRate, changePitch, changeVoice,
  } = useTTS(displayText, {
    // FIX 2: when speak() throws, mark this as a non-natural end so the
    // speaking→idle transition in the effect below does NOT fire onPlaybackEnd
    // and does NOT trigger auto-advance.
    onError: () => { manualStopRef.current = true; },
    // FIX 3: collapse whitespace runs before speaking in EPUB mode (where
    // word-highlight offsets do not matter). Scan mode keeps 1-for-1 \n→space.
    collapseWhitespace: collapseWhitespace,
  });

  // Restore rate and pitch from localStorage on mount.
  // ttsState is always "idle" here so changeRate/changePitch only set state.
  useEffect(() => {
    const stored = localStorage.getItem("dexy-speed");
    if (stored) changeRate(parseFloat(stored));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stored = localStorage.getItem("dexy-pitch");
    if (stored) changePitch(parseFloat(stored));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore voice when the voices list first populates.
  // Mirrors the localService filter used in ReadButton.
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

  // ── Auto-read (ScanSection path) ──────────────────────────────────────
  // Detect when a new scan result arrives (text prop changes) and fire
  // toggle() exactly once after useTTS has settled on the new text.
  const autoReadPendingRef = useRef(false);
  const prevTextRef = useRef("");

  useEffect(() => {
    if (!text || text === prevTextRef.current) return;
    prevTextRef.current = text;
    if (autoRead) autoReadPendingRef.current = true;
  }, [text, autoRead]);

  useEffect(() => {
    if (!autoReadPendingRef.current || !displayText || ttsState !== "idle") return;
    autoReadPendingRef.current = false;
    toggle();
  }, [displayText, ttsState, toggle]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Natural-end detection (PagedReader path) ──────────────────────────
  // manualStopRef is declared above (before useTTS) and is also written by
  // the onError callback (speak failures). All three suppress onPlaybackEnd:
  //   1. User pause/stop (wrappedToggle / wrappedStop)
  //   2. speak() threw "Failed to read text"  (onError callback in useTTS)
  //   3. Empty page skipped before toggle()   (belt-check in auto-play effect)
  const prevTtsStateRef = useRef("idle");
  const onPlaybackEndRef = useRef(onPlaybackEnd);
  useEffect(() => { onPlaybackEndRef.current = onPlaybackEnd; }, [onPlaybackEnd]);

  useEffect(() => {
    const prev = prevTtsStateRef.current;
    prevTtsStateRef.current = ttsState;
    // Natural end: was speaking, now idle, and NOT a manual-stop or speak-fail.
    if (prev === "speaking" && ttsState === "idle" && !manualStopRef.current) {
      console.log("[epub-tts] advance reason=natural-end");
      if (onPlaybackEndRef.current) onPlaybackEndRef.current();
    } else if (prev === "speaking" && ttsState === "idle" && manualStopRef.current) {
      console.log("[epub-tts] advance reason=none (manual-stop or speak-failed)");
    }
    // Reset the flag whenever TTS resumes/starts — next end may be natural again.
    if (ttsState === "speaking") {
      manualStopRef.current = false;
    }
  }, [ttsState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wrapped toggle / stop for manual-stop tracking ────────────────────
  function wrappedToggle() {
    // Toggling while speaking = pause = manual intervention.
    if (ttsState === "speaking") {
      manualStopRef.current = true;
    }
    // paused → speaking (resume) and idle → speaking (start) leave the flag alone;
    // the ttsState effect above resets it to false when "speaking" is re-entered.
    toggle();
  }

  function wrappedStop() {
    manualStopRef.current = true;
    stop();
  }

  // ── Auto-play on mount (PagedReader path) ─────────────────────────────
  // When autoPlayKey is non-zero, the page was navigated to by auto-advance —
  // start playing immediately. Runs on mount only (empty deps intentional).
  useEffect(() => {
    if (!autoPlayKey) return;
    manualStopRef.current = false;
    // Belt check: if there is no readable content, skip toggle() entirely.
    // This means ttsState never enters "speaking" → no speaking→idle transition
    // → onPlaybackEnd never fires → no advance. doSpeak also detects this
    // (braces), but this outer guard avoids even starting the TTS cycle.
    const hasContent = /\w/.test(displayText ?? "");
    const chars = (displayText ?? "").length;
    if (!hasContent) {
      console.log(`[epub-tts] autoplay: empty=true chars=${chars} -> skipped toggle`);
      return;
    }
    console.log(`[epub-tts] autoplay: empty=false chars=${chars} -> toggle`);
    toggle();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edit handlers ─────────────────────────────────────────────────────
  function handleEditStart() {
    wrappedStop();
    setEditValue(displayText);
    setIsEditing(true);
  }

  function handleEditDone() {
    const newText = editValue.trim();
    if (newText) setDisplayText(newText);
    setIsEditing(false);
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
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
          <WordText text={displayText} wordIndex={wordIndex} onWordTap={seekToWord} fontSize={fontSize} fontFamily={fontFamily} bgColour={bgColour} bgOpacity={bgOpacity} />
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
      <CopyRow text={displayText} />
      <ReadButton
        ttsState={ttsState}
        rate={rate}
        pitch={pitch}
        voices={voices}
        selectedVoice={selectedVoice}
        toggle={wrappedToggle}
        stop={wrappedStop}
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
  );
}
