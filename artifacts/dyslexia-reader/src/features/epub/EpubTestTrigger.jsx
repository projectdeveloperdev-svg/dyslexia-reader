/**
 * TEMPORARY — epub.js parse-layer probe, Step 1/2 only.
 * Reachable at /epub-test during development.
 * Remove this file and its route in App.jsx before the real EPUB UI is built.
 */

import { useRef } from "react";
import { parseEpub } from "./epubParser";

export default function EpubTestTrigger() {
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log("[epub-test] file selected:", file.name, "size:", file.size, "bytes");
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Clear AFTER the read completes — not before (blob-release trap).
      e.target.value = "";
      const result = await parseEpub(arrayBuffer);
      // Log the tagged result so all branches are visible in the console.
      if (result.ok) {
        console.log(
          `[epub] result ok=true drm=false` +
          ` title="${result.title}"` +
          ` author="${result.author}"` +
          ` sections=${result.sectionCount}` +
          ` firstSectionPreview="${result.firstSectionText.slice(0, 200)}"`
        );
      } else {
        console.log(
          `[epub] result ok=false drm=${result.drm}` +
          ` reason=${result.reason}` +
          ` | message="${result.message}"`
        );
      }
    } catch (err) {
      // parseEpub no longer throws — this catches unexpected regressions.
      console.error("[epub-test] unexpected throw:", err);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "Inter, sans-serif", maxWidth: 480 }}>
      <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
        EPUB parse probe — Step 2 (dev only)
      </h2>
      <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1.25rem" }}>
        Pick a .epub. All output goes to the console — nothing renders here.
        DRM-locked files should report drm=true; DRM-free should report ok=true.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".epub"
        onChange={handleFile}
      />
    </div>
  );
}
