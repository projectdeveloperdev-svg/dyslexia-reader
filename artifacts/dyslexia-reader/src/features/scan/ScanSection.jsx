import { useState, useEffect, useRef } from "react";
import ScanButton from "./ScanButton";
import UploadButton from "./UploadButton";
import PasteInput from "./PasteInput";
import ReadButton from "../tts/ReadButton";
import WordText from "../tts/WordText";
import { useTTS } from "../tts/useTTS";
import "./ScanSection.css";

function ScanSection() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [text, setText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
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
  // Runs at most once (ref guard). Does NOT write to localStorage so that a
  // saved voice unavailable on this device is preserved for future use.
  const voiceRestored = useRef(false);
  useEffect(() => {
    if (voiceRestored.current || !voices.length) return;
    voiceRestored.current = true;
    const savedName = localStorage.getItem("dexy-voice");
    if (!savedName) return;
    const saved = voices.find((v) => v.name === savedName);
    if (saved) changeVoice(saved);
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
      if (voice) localStorage.setItem("dexy-voice", voice.name);
    } catch (e) { console.error("localStorage write failed:", e); }
  }

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
      setText(extracted);
      setStatus("done");
    }
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
      <div className="scan-section-buttons">
        <ScanButton
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
        <PasteInput onResult={handleResult} onReset={handleReset} />
      </div>

      {status === "loading" && (
        <div className="ocr-loading">
          <div className="ocr-spinner" />
          <span className="ocr-loading-text">Reading your photo…</span>
        </div>
      )}

      {status === "done" && (
        <>
          <div className="ocr-edit-wrapper">
            {isEditing ? (
              <textarea
                className="ocr-edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                style={{ "--ocr-font-size": `${fontSize}px`, fontFamily, "--ocr-bg-rgb": bgColour, "--ocr-bg-opacity": bgOpacity }}
              />
            ) : (
              <WordText text={text} wordIndex={wordIndex} onWordTap={seekToWord} fontSize={fontSize} fontFamily={fontFamily} bgColour={bgColour} bgOpacity={bgOpacity} />
            )}
            <button className="ocr-edit-btn" onClick={isEditing ? handleEditDone : handleEditStart}>
              {isEditing ? "Done" : "Edit"}
            </button>
          </div>
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
            fontSize={fontSize}
            changeFontSize={changeFontSize}
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
