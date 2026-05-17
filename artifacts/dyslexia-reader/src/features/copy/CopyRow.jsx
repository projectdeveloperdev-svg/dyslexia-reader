import { useState, useEffect } from "react";
import "./CopyRow.css";

const PROMPTS = {
  summarise: "Please summarise this in simple, clear language:",
  explain:   "Please explain this in simple words, as if I'm 14:",
  quiz:      "Create 5 quiz questions to test my understanding of this:",
  keyPoints: "List the 5 most important points from this:",
};

const BUTTONS = [
  { key: "copy",      label: "Copy",       prompt: "",                 toast: "Copied!" },
  { key: "summarise", label: "Summarise",  prompt: PROMPTS.summarise,  toast: "Copied with summarise prompt" },
  { key: "explain",   label: "Explain",    prompt: PROMPTS.explain,    toast: "Copied with explain prompt" },
  { key: "quiz",      label: "Quiz me",    prompt: PROMPTS.quiz,       toast: "Copied with quiz prompt" },
  { key: "keyPoints", label: "Key points", prompt: PROMPTS.keyPoints,  toast: "Copied with key points prompt" },
];

const TOOLTIP_KEY = "dexy.tooltip.copyRow.seen";

async function writeToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyRow({ text }) {
  const [toast, setToast] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useEffect(() => {
    if (text && !localStorage.getItem(TOOLTIP_KEY)) {
      setTooltipVisible(true);
    }
  }, [text]);

  function dismissTooltip() {
    try { localStorage.setItem(TOOLTIP_KEY, "true"); } catch { /* ignore */ }
    setTooltipVisible(false);
  }

  async function handleCopy(btn) {
    dismissTooltip();
    const content = btn.prompt ? btn.prompt + "\n\n" + text : text;
    const ok = await writeToClipboard(content);
    const id = Date.now();
    setToast({ message: ok ? btn.toast : "Couldn't copy — try again", id });
    setTimeout(() => setToast(prev => (prev?.id === id ? null : prev)), 1800);
  }

  if (!text) return null;

  return (
    <div className="copy-row-wrapper">
      <p className="copy-row-heading">Send to your favourite AI</p>

      <div className="copy-row-scroll">
        {BUTTONS.map((btn) => (
          <button
            key={btn.key}
            className={`copy-pill${btn.key === "copy" ? " copy-pill--plain" : ""}`}
            onClick={() => handleCopy(btn)}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {tooltipVisible && (
        <div className="copy-tooltip" role="tooltip">
          <p className="copy-tooltip-text">
            Copies the text — with or without a study prompt — so you can paste it into ChatGPT, Gemini, or any AI app.
          </p>
          <button
            className="copy-tooltip-dismiss"
            onClick={dismissTooltip}
            aria-label="Dismiss tip"
          >
            Got it
          </button>
        </div>
      )}

      {toast && (
        <div key={toast.id} className="copy-toast" role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default CopyRow;
