import { useTTS } from "./useTTS";
import "./ReadButton.css";

const LABELS = {
  idle: "Read",
  speaking: "Pause",
  paused: "Resume",
};

function ReadButton({ text }) {
  const { ttsState, toggle } = useTTS(text);

  return (
    <button className="read-btn" onClick={toggle}>
      {LABELS[ttsState]}
    </button>
  );
}

export default ReadButton;
