import { useState, useEffect, useRef } from "react";
import { listStacks, renameStack, deleteStack } from "./megaStackStorage.js";
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
  const [loadError, setLoadError] = useState(null);
  const [openError, setOpenError] = useState(null);

  // ⋯ menu / rename / delete state
  const [menuOpenId, setMenuOpenId] = useState(null);   // stack.id with open menu
  const [renaming, setRenaming] = useState(null);        // { id, value } | null
  const [deleteTarget, setDeleteTarget] = useState(null); // stack object | null
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  const renameInputRef = useRef(null);

  // ── Load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    listStacks()
      .then((list) => {
        if (!cancelled) setStacks([...list].reverse()); // newest first
      })
      .catch((err) => {
        console.error("[MegaStackLibrary] listStacks failed:", err);
        if (!cancelled) {
          setLoadError("Could not load saved stacks.");
          setStacks([]);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Focus rename input when it appears.
  useEffect(() => {
    if (renaming) {
      setTimeout(() => renameInputRef.current?.focus(), 50);
    }
  }, [renaming?.id]);

  // ── Open ──────────────────────────────────────────────────────────────
  function handleOpenStack(stack) {
    setOpenError(null);
    try {
      onOpenStack(stack);
    } catch (err) {
      console.error("[MegaStackLibrary] onOpenStack threw:", err);
      setOpenError("Could not open this stack.");
    }
  }

  // ── Rename ────────────────────────────────────────────────────────────
  function startRename(stack) {
    setMenuOpenId(null);
    setActionError(null);
    setRenaming({ id: stack.id, value: stack.name });
  }

  async function commitRename() {
    const trimmed = renaming.value.trim();
    if (!trimmed) {
      setRenaming(null); // blank → keep old name, dismiss silently
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await renameStack(renaming.id, trimmed);
      // Update in place — no re-fetch needed.
      setStacks((prev) =>
        prev.map((s) => (s.id === renaming.id ? { ...s, name: trimmed } : s))
      );
      setRenaming(null);
    } catch (err) {
      console.error("[MegaStackLibrary] renameStack failed:", err);
      setActionError("Could not rename this stack.");
    } finally {
      setBusy(false);
    }
  }

  function cancelRename() {
    setRenaming(null);
  }

  // ── Delete ────────────────────────────────────────────────────────────
  function requestDelete(stack) {
    setMenuOpenId(null);
    setActionError(null);
    setDeleteTarget(stack);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteStack(deleteTarget.id);
      // Remove the row in place — no re-fetch needed.
      setStacks((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("[MegaStackLibrary] deleteStack failed:", err);
      setActionError("Could not delete this stack.");
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  }

  function cancelDelete() {
    setDeleteTarget(null);
  }

  // ── Render ────────────────────────────────────────────────────────────
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
      {loadError && <p className="msl-error" role="alert">{loadError}</p>}
      {openError && <p className="msl-error" role="alert">{openError}</p>}
      {actionError && <p className="msl-error" role="alert">{actionError}</p>}

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
            {stacks.map((stack) => {
              const isMenuOpen = menuOpenId === stack.id;
              const isRenaming = renaming?.id === stack.id;

              return (
                <li key={stack.id} className="msl-item" role="listitem">
                  <div className="msl-card">

                    {isRenaming ? (
                      /* ── Rename mode ─────────────────────────────── */
                      <>
                        <div className="msl-rename-row">
                          <input
                            ref={renameInputRef}
                            className="msl-rename-input"
                            type="text"
                            value={renaming.value}
                            maxLength={60}
                            onChange={(e) =>
                              setRenaming((r) => ({ ...r, value: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename();
                              if (e.key === "Escape") cancelRename();
                            }}
                          />
                        </div>
                        <div className="msl-rename-actions">
                          <button
                            className="msl-action-save"
                            onClick={commitRename}
                            disabled={busy}
                          >
                            Save
                          </button>
                          <button
                            className="msl-action-cancel"
                            onClick={cancelRename}
                            disabled={busy}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : isMenuOpen ? (
                      /* ── ⋯ menu expanded ─────────────────────────── */
                      <>
                        <div className="msl-card-top">
                          <span className="msl-row-info">
                            <span className="msl-row-name">{stack.name}</span>
                            <span className="msl-row-meta">
                              {stack.pageCount} page{stack.pageCount !== 1 ? "s" : ""}
                              {" · "}{formatDate(stack.created)}
                            </span>
                          </span>
                          <button
                            className="msl-menu-btn msl-menu-btn--close"
                            onClick={() => setMenuOpenId(null)}
                            aria-label="Close menu"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="msl-card-actions">
                          <button
                            className="msl-action-rename"
                            onClick={() => startRename(stack)}
                          >
                            Rename
                          </button>
                          <button
                            className="msl-action-delete"
                            onClick={() => requestDelete(stack)}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    ) : (
                      /* ── Normal row ──────────────────────────────── */
                      <div className="msl-card-top">
                        <button
                          className="msl-row-tap"
                          onClick={() => handleOpenStack(stack)}
                        >
                          <span className="msl-row-info">
                            <span className="msl-row-name">{stack.name}</span>
                            <span className="msl-row-meta">
                              {stack.pageCount} page{stack.pageCount !== 1 ? "s" : ""}
                              {" · "}{formatDate(stack.created)}
                            </span>
                          </span>
                          <span className="msl-row-arrow" aria-hidden="true">›</span>
                        </button>
                        <button
                          className="msl-menu-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(stack.id);
                          }}
                          aria-label={`Options for ${stack.name}`}
                        >
                          ⋯
                        </button>
                      </div>
                    )}

                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Delete confirmation dialog ────────────────────────────────── */}
      {deleteTarget && (
        <div className="msl-confirm-backdrop" onClick={cancelDelete}>
          <div className="msl-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="msl-confirm-msg">
              Delete "{deleteTarget.name}"?
            </p>
            <div className="msl-confirm-actions">
              <button
                className="msl-confirm-btn--destructive"
                onClick={confirmDelete}
                disabled={busy}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
              <button
                className="msl-confirm-btn--keep"
                onClick={cancelDelete}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
