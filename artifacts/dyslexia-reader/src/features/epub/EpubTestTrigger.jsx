/**
 * TEMPORARY — epub.js parse-layer probe, Step 1 only.
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
      console.log("[epub-test] full result:", JSON.stringify({
        title: result.title,
        author: result.author,
        sectionCount: result.sectionCount,
        firstSectionPreview: result.firstSectionText.slice(0, 200),
      }, null, 2));
    } catch (err) {
      console.error("[epub-test] FAILED:", err);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "Inter, sans-serif", maxWidth: 480 }}>
      <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
        EPUB parse probe — Step 1 (dev only)
      </h2>
      <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1.25rem" }}>
        Pick a DRM-free .epub. All output goes to the console — nothing renders here.
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
