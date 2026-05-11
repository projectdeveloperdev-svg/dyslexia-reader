import { useState } from "react";
import ScanButton from "./ScanButton";
import PasteInput from "./PasteInput";
import ReadButton from "../tts/ReadButton";
import WordText from "../tts/WordText";
import { useTTS } from "../tts/useTTS";
import "./ScanSection.css";

function ScanSection() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [text, setText] = useState("");
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

  const {
    ttsState, rate, pitch, voices, selectedVoice,
    wordIndex,
    toggle, stop, seekToWord,
    changeRate, changePitch, changeVoice,
  } = useTTS(text);

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
          <WordText text={text} wordIndex={wordIndex} onWordTap={seekToWord} fontSize={fontSize} fontFamily={fontFamily} bgColour={bgColour} />
          <ReadButton
            ttsState={ttsState}
            rate={rate}
            pitch={pitch}
            voices={voices}
            selectedVoice={selectedVoice}
            toggle={toggle}
            stop={stop}
            changeRate={changeRate}
            changePitch={changePitch}
            changeVoice={changeVoice}
            fontSize={fontSize}
            changeFontSize={changeFontSize}
            fontFamily={fontFamily}
            changeFontFamily={changeFontFamily}
            bgColour={bgColour}
            changeBgColour={changeBgColour}
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
