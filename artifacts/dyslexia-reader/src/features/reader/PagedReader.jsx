import { useState, useRef, useCallback } from "react";
import { getSnippets } from "../stack/stackStore";
import ReaderView from "./ReaderView";
import "./PagedReader.css";

/**
 * Props:
 *  onExit()                    — back button handler
 *  initialPage?  number        — page to open on (default 0). Clamped by caller.
 *  onPageChange? (idx: number) — fired once per settled page (Mega Stack only).
 *                                Never called for Quick Stack / PDF (those pass nothing).
 *  snippets?     Array<{image,ocrText}> — optional override. When provided, used
 *                                instead of getSnippets(). Existing callers never
 *                                pass this so their behaviour is unchanged.
 */
export default function PagedReader({ onExit, initialPage = 0, onPageChange, snippets: snippetsProp }) {
  // Read the stack once on mount — stable for the lifetime of this component.
  // snippetsProp (EPUB) takes precedence when provided; all other callers omit it.
  const [snippets] = useState(() => snippetsProp ?? getSnippets().slice());

  const [pageIndex, setPageIndex] = useState(initialPage);
  const [slideDir, setSlideDir] = useState(null); // "right" | "left" | null
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Incremented on each auto-advance navigation to tell the new ReaderView to
  // start playing. Zero on manual navigation so new pages land idle.
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0);

  // Touch state for swipe detection.
  const touchStartXRef = useRef(null);

  // Navigate to a page.
  // isAutoAdvance=true  → new page auto-plays (autoPlayTrigger incremented)
  // isAutoAdvance=false → new page lands idle (autoPlayTrigger reset to 0)
  function goToPage(newIndex, isAutoAdvance) {
    const forward = newIndex > pageIndex;
    setSlideDir(forward ? "right" : "left");
    if (isAutoAdvance) {
      setAutoPlayTrigger((t) => t + 1);
    } else {
      setAutoPlayTrigger(0);
    }
    setPageIndex(newIndex);
    // Notify caller (Mega Stack only — Quick Stack / PDF pass no onPageChange).
    onPageChangeRef.current?.(newIndex);
  }

  // Called by the current page's ReaderView when TTS ends naturally.
  // Using useCallback so the reference is stable enough for onPlaybackEndRef.
  const handlePlaybackEnd = useCallback(() => {
    // Access latest values via a ref so the callback is never stale.
    // (autoAdvanceRef / pageIndexRef are maintained below.)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Stable refs for the callback above to avoid stale closure bugs ----
  // onPageChange is kept in a ref so goToPage never captures a stale closure,
  // and so updating the prop never re-renders the component.
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;
  const pageIndexRef = useRef(pageIndex);
  pageIndexRef.current = pageIndex;
  const snippetsLenRef = useRef(snippets.length);
  snippetsLenRef.current = snippets.length;
  const goToPageRef = useRef(goToPage);
  goToPageRef.current = goToPage;

  // Stable playback-end handler that reads everything via refs.
  const stablePlaybackEnd = useRef(() => {
    if (!autoAdvanceRef.current) return;
    const next = pageIndexRef.current + 1;
    if (next < snippetsLenRef.current) {
      goToPageRef.current(next, true);
    }
    // Last page: stop silently — do nothing.
  });

  // ── Swipe detection ──────────────────────────────────────────────────
  function handleTouchStart(e) {
    // Do not arm swipe when the touch starts on an interactive control.
    if (e.target.closest('input, button, textarea, select, label, [role="slider"]')) {
      return;
    }
    touchStartXRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStartXRef.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(dx) < 48) return; // minimum swipe distance
    if (dx < 0 && pageIndex < snippets.length - 1) {
      goToPage(pageIndex + 1, false); // swipe left → next page, land idle
    } else if (dx > 0 && pageIndex > 0) {
      goToPage(pageIndex - 1, false); // swipe right → prev page, land idle
    }
  }

  const snippet = snippets[pageIndex];
  if (!snippet) return null;

  return (
    <div className="paged-reader">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="paged-reader-header">
        <button className="paged-reader-back" onClick={onExit}>
          ← Back
        </button>
        <span className="paged-reader-page-indicator" aria-live="polite">
          {pageIndex + 1} / {snippets.length}
        </span>
        <label className="paged-reader-autoadvance-label">
          <span className="paged-reader-autoadvance-text">Auto-play next page</span>
          <span className={`paged-reader-toggle-track${autoAdvance ? " paged-reader-toggle-on" : ""}`}>
            <span className="paged-reader-toggle-thumb" />
          </span>
          <input
            type="checkbox"
            className="paged-reader-toggle-input"
            checked={autoAdvance}
            onChange={(e) => setAutoAdvance(e.target.checked)}
          />
        </label>
      </div>

      {/* ── Page viewport ────────────────────────────────────────────── */}
      <div
        className="paged-reader-viewport"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={pageIndex}
          className={`paged-reader-page${slideDir ? ` paged-reader-page--from-${slideDir}` : ""}`}
        >
          <ReaderView
            text={snippet.ocrText}
            onPlaybackEnd={stablePlaybackEnd.current}
            autoPlayKey={autoPlayTrigger}
          />
        </div>
      </div>

      {/* ── Dot indicators ───────────────────────────────────────────── */}
      {snippets.length > 1 && (
        <div className="paged-reader-dots" role="tablist" aria-label="Pages">
          {snippets.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === pageIndex}
              aria-label={`Page ${i + 1}`}
              className={`paged-reader-dot${i === pageIndex ? " paged-reader-dot--active" : ""}`}
              onClick={() => i !== pageIndex && goToPage(i, false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
