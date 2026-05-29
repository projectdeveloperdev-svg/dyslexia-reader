import "./MegaStackSheet.css";

export default function MegaStackSheet({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="mega-sheet-backdrop" onClick={onClose}>
      <div className="mega-sheet" onClick={(e) => e.stopPropagation()}>
        <p className="mega-sheet-message">
          Mega Stack is coming soon. Unlimited stacks will be available when billing launches.
        </p>
        <button className="mega-sheet-btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
