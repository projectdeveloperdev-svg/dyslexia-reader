import { useTTS } from "./useTTS";
import "./ReadButton.css";

const LABELS = {
  idle: "Read",
  speaking: "Pause",
  paused: "Resume",
};

function ReadButton({ text }) {
  const { ttsState, toggle, stop } = useTTS(text);
  const active = ttsState !== "idle";

  return (
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
  );
}

export default ReadButton;
