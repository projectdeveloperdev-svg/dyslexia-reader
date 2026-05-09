import { useState } from "react";
import "./PasteInput.css";

function PasteInput({ onResult, onReset }) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");

  function handleOpen() {
    onReset();
    setInputText("");
    setOpen(true);
  }

  function handleUse() {
    const trimmed = inputText.trim();
    onResult(trimmed || "");
    setOpen(false);
    setInputText("");
  }

  function handleCancel() {
    setOpen(false);
    setInputText("");
  }

  if (open) {
    return (
      <div className="paste-input-panel">
        <textarea
          className="paste-textarea"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste or type text here…"
          autoFocus
          rows={5}
        />
        <div className="paste-actions">
          <button className="paste-use-btn" onClick={handleUse}>
            Use this text
          </button>
          <button className="paste-cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button className="paste-btn" onClick={handleOpen}>
      Paste text
    </button>
  );
}

export default PasteInput;
