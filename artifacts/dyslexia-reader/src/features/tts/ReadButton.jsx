import "./ReadButton.css";

const LABELS = {
  idle: "Read",
  speaking: "Pause",
  paused: "Paused",
};

function ReadButton({
  ttsState, rate, pitch, voices, selectedVoice,
  toggle, stop, changeRate, changePitch, changeVoice,
}) {
  const active = ttsState !== "idle";
  const paused = ttsState === "paused";

  function handleVoiceChange(e) {
    const voice = voices.find((v) => v.name === e.target.value) ?? null;
    changeVoice(voice);
  }

  return (
    <div className="tts-controls">
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
