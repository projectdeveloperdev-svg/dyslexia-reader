import { useState, useEffect } from "react";
import { listStacks } from "./megaStackStorage.js";
import "./MegaStackLibrary.css";

/**
 * Library screen — shows all saved Mega Stacks.
 *
 * Props:
 *  onNewStack()          — start a new Mega Stack capture
 *  onOpenStack(stack)    — open a saved stack in the reader
 *  onBack()              — return to the home screen
 */
export default function MegaStackLibrary({ onNewStack, onOpenStack, onBack }) {
  const [stacks, setStacks] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [openError, setOpenError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listStacks()
      .then((list) => {
        if (!cancelled) {
          // Newest first.
          setStacks([...list].reverse());
        }
      })
      .catch((err) => {
        console.error("[MegaStackLibrary] listStacks failed:", err);
        if (!cancelled) {
          setError("Could not load saved stacks.");
          setStacks([]);
        }
      });
    return () => { cancelled = true; };
  }, []);

  function handleOpenStack(stack) {
    setOpenError(null);
    try {
      onOpenStack(stack);
    } catch (err) {
      console.error("[MegaStackLibrary] onOpenStack threw:", err);
      setOpenError("Could not open this stack.");
    }
  }

  return (
    <div className="msl-root">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="msl-header">
        <button className="msl-back" onClick={onBack} aria-label="Back to home">
          ← Back
        </button>
        <h1 className="msl-title">Mega Stacks</h1>
        <button className="msl-new" onClick={onNewStack} aria-label="New stack">
          + New
        </button>
      </div>

      {/* ── Error banners ─────────────────────────────────────────────── */}
      {error && (
        <p className="msl-error" role="alert">{error}</p>
      )}
      {openError && (
        <p className="msl-error" role="alert">{openError}</p>
      )}

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="msl-body">
        {stacks === null ? (
          <p className="msl-loading">Loading…</p>
        ) : stacks.length === 0 ? (
          <div className="msl-empty">
            <p className="msl-empty-msg">No saved stacks yet.</p>
            <p className="msl-empty-hint">Tap <strong>+ New</strong> to start.</p>
          </div>
        ) : (
          <ul className="msl-list" role="list">
            {stacks.map((stack) => (
              <li key={stack.id} className="msl-item" role="listitem">
                <button
                  className="msl-row"
                  onClick={() => handleOpenStack(stack)}
                >
                  <span className="msl-row-info">
                    <span className="msl-row-name">{stack.name}</span>
                    <span className="msl-row-meta">
                      {stack.pageCount} page{stack.pageCount !== 1 ? "s" : ""}
                      {" · "}
                      {formatDate(stack.created)}
                    </span>
                  </span>
                  <span className="msl-row-arrow" aria-hidden="true">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}
