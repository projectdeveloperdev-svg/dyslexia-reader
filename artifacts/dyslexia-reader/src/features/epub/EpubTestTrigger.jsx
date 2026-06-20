/**
 * TEMPORARY — epub.js parse-layer probe, Steps 1–3.
 * Reachable at /epub-test during development.
 * Remove this file and its route in App.jsx before the real EPUB UI is built.
 */

import { useState, useRef } from "react";
import { parseEpub } from "./epubParser";
import { chunkText } from "./chunkText";
import PagedReader from "../reader/PagedReader";

export default function EpubTestTrigger() {
  const inputRef = useRef(null);
  // null = picker, "loading" = parsing, EpubResult = done
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log("[epub-test] file selected:", file.name, "size:", file.size, "bytes");
    setLoading(true);
    setResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Clear AFTER the read completes — not before (blob-release trap).
      e.target.value = "";
      const parsed = await parseEpub(arrayBuffer);
      if (parsed.ok) {
        console.log(
          `[epub] result ok=true drm=false` +
          ` title="${parsed.title}"` +
          ` author="${parsed.author}"` +
          ` sections=${parsed.sectionCount}`
        );
      } else {
        console.log(
          `[epub] result ok=false drm=${parsed.drm}` +
          ` reason=${parsed.reason}` +
          ` | message="${parsed.message}"`
        );
      }
      setResult(parsed);
    } catch (err) {
      // parseEpub no longer throws — this catches unexpected regressions.
      console.error("[epub-test] unexpected throw:", err);
      setResult({
        ok: false,
        drm: false,
        reason: "parse",
        message: "This file couldn't be opened. It may be damaged or not a valid EPUB.",
      });
    } finally {
      setLoading(false);
    }
  }

  // ── Reader: STEP 4 — chunk every section into TTS-safe pages (≤1200 chars) ─
  if (result?.ok) {
    // Flatten all sections into chunk-pages in spine order.
    // Section 0 chunks first, then section 1 chunks, etc.
    // Whitespace-only sections produce no pages (chunkText returns []).
    const snippets = [];
    for (const section of result.sections) {
      for (const chunk of chunkText(section.text)) {
        snippets.push({ image: null, ocrText: chunk });
      }
    }

    console.log(`[epub] pages built: ${snippets.length} from ${result.sections.length} sections`);
    const largestPage = snippets.reduce((max, s) => Math.max(max, s.ocrText.length), 0);
    console.log(`[epub] largest page chars: ${largestPage}`);

    return (
      <PagedReader
        snippets={snippets}
        onExit={() => setResult(null)}
        disableWordTap={true}
      />
    );
  }

  // ── Error screen (DRM or parse failure) — shown on screen, not just console ─
  if (result && !result.ok) {
    return (
      <div style={{ padding: "2rem", fontFamily: "Inter, sans-serif", maxWidth: 480 }}>
        <p style={{ color: "#c0392b", marginBottom: "1rem" }}>{result.message}</p>
        <button onClick={() => setResult(null)}>Try another file</button>
      </div>
    );
  }

  // ── File picker ──────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "2rem", fontFamily: "Inter, sans-serif", maxWidth: 480 }}>
      <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
        EPUB reader probe — Step 3 (dev only)
      </h2>
      <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1.25rem" }}>
        Pick a DRM-free .epub. Parses all sections and opens them in PagedReader.
      </p>
      {loading && <p style={{ color: "#888" }}>Parsing…</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".epub"
        onChange={handleFile}
        disabled={loading}
      />
    </div>
  );
}
