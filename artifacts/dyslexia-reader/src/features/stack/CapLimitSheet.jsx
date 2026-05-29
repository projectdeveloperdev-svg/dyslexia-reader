import "./CapLimitSheet.css";

export default function CapLimitSheet({ open, onReadNow, onGetMegaStack, onDismiss }) {
  if (!open) return null;

  return (
    <div className="cap-sheet-backdrop" onClick={onDismiss}>
      <div className="cap-sheet" onClick={(e) => e.stopPropagation()}>
        <p className="cap-sheet-message">
          You've reached the limit of 5 snippets per stack. Tap Read to read your stack now, or unlock unlimited stacks with Mega Stack.
        </p>
        <div className="cap-sheet-actions">
          <button className="cap-sheet-btn cap-sheet-btn--primary" onClick={onReadNow}>
            Read now
          </button>
          <button className="cap-sheet-btn cap-sheet-btn--secondary" onClick={onGetMegaStack}>
            Get Mega Stack
          </button>
        </div>
      </div>
    </div>
  );
}
