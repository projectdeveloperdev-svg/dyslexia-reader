import "./ReadButton.css";

const LABELS = {
  idle: "Read",
  speaking: "Pause",
  paused: "Paused",
};

const BG_COLOURS = [
  { label: "White",       rgb: "255, 255, 255" },
  { label: "Cream",       rgb: "255, 253, 240" },
  { label: "Pale yellow", rgb: "255, 252, 210" },
  { label: "Pale blue",   rgb: "219, 234, 254" },
  { label: "Pale peach",  rgb: "255, 224, 210" },
  { label: "Pale mint",   rgb: "209, 250, 229" },
  { label: "Pale grey",   rgb: "243, 244, 246" },
];

const FONT_OPTIONS = [
  { label: "System default", value: "sans-serif" },
  { label: "OpenDyslexic",   value: "OpenDyslexic, sans-serif" },
  { label: "Arial",          value: "Arial, sans-serif" },
  { label: "Verdana",        value: "Verdana, sans-serif" },
  { label: "Georgia",        value: "Georgia, serif" },
];

function ReadButton({
  ttsState, rate, pitch, voices, selectedVoice,
  toggle, stop, changeRate, changePitch, changeVoice,
  fontSize, changeFontSize,
  fontFamily, changeFontFamily,
  bgColour, changeBgColour,
  bgOpacity, changeBgOpacity,
}) {
  const active = ttsState !== "idle";
  const paused = ttsState === "paused";

  function handleVoiceChange(e) {
    const voice = voices.find((v) => v.name === e.target.value) ?? null;
    changeVoice(voice);
  }

  return (
    <div className="tts-controls">
      <div className="speed-row">
        <span className="speed-label">Font: {fontSize}px</span>
        <input
          type="range"
          className="speed-slider"
          min="14"
          max="36"
          step="1"
          value={fontSize}
          onChange={(e) => changeFontSize(parseInt(e.target.value, 10))}
        />
      </div>

      <div className="speed-row">
        <span className="speed-label">Typeface</span>
        <select
          className="voice-select"
          value={fontFamily}
          onChange={(e) => changeFontFamily(e.target.value)}
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="speed-row">
        <span className="speed-label">Background</span>
        <div className="colour-swatches">
          {BG_COLOURS.map((opt) => (
            <button
              key={opt.rgb}
              className={`colour-swatch${bgColour === opt.rgb ? " selected" : ""}`}
              onClick={() => changeBgColour(opt.rgb)}
              title={opt.label}
            >
              <span className="colour-swatch-dot" style={{ background: `rgb(${opt.rgb})` }} />
            </button>
          ))}
        </div>
      </div>

      <div className="speed-row">
        <span className="speed-label">Opacity: {Math.round(bgOpacity * 100)}%</span>
        <input
          type="range"
          className="speed-slider"
          min="0"
          max="1"
          step="0.01"
          value={bgOpacity}
          onChange={(e) => changeBgOpacity(parseFloat(e.target.value))}
        />
      </div>

      {voices.length > 0 && (
        <div className="speed-row">
          <span className="speed-label">Voice</span>
          <select
            className="voice-select"
            value={selectedVoice?.name ?? ""}
            onChange={handleVoiceChange}
          >
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="speed-row">
        <span className="speed-label">Speed: {rate.toFixed(1)}x</span>
        <input
          type="range"
          className="speed-slider"
          min="0.5"
          max="2"
          step="0.1"
          value={rate}
          onChange={(e) => changeRate(parseFloat(e.target.value))}
        />
      </div>

      <div className="speed-row">
        <span className="speed-label">Pitch: {pitch.toFixed(1)}</span>
        <input
          type="range"
          className="speed-slider"
          min="0.5"
          max="2"
          step="0.1"
          value={pitch}
          onChange={(e) => changePitch(parseFloat(e.target.value))}
        />
      </div>

      <div className="read-btn-row">
        <button className="read-btn" onClick={toggle} disabled={paused}>
          {LABELS[ttsState]}
        </button>
        {active && (
          <button className="stop-btn" onClick={stop}>
            Stop
          </button>
        )}
      </div>

      {paused && (
        <p className="tts-paused-hint">Tap any word to continue</p>
      )}
    </div>
  );
}

export default ReadButton;
