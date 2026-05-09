import { useTTS } from "./useTTS";
import "./ReadButton.css";

const LABELS = {
  idle: "Read",
  speaking: "Pause",
  paused: "Resume",
};

function ReadButton({ text }) {
  const { ttsState, rate, pitch, toggle, stop, changeRate, changePitch } = useTTS(text);
  const active = ttsState !== "idle";

  return (
    <div className="tts-controls">
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
        <button className="read-btn" onClick={toggle}>
          {LABELS[ttsState]}
        </button>
        {active && (
          <button className="stop-btn" onClick={stop}>
            Stop
          </button>
        )}
      </div>
    </div>
  );
}

export default ReadButton;
