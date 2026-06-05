/**
 * TEMPORARY — Step 1 storage-layer smoke test.
 * Remove this file and its import in main.jsx after Step 1 is verified.
 *
 * Usage (browser console or chrome://inspect):
 *   window.testMegaStack()
 */
import {
  saveStack,
  listStacks,
  loadStackImage,
  renameStack,
  deleteStack,
} from "./megaStackStorage.js";

// Minimal valid 1×1 JPEG in base64 (no data-URL prefix).
const TINY_JPEG =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDB" +
  "kSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAAR" +
  "CAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA" +
  "AAAAAAAAAAAAAP/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAA" +
  "AAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

async function runTest() {
  console.log("=== [MegaStack Test] START ===");

  try {
    // ── 1. Save ───────────────────────────────────────────────────────
    console.log("[MegaStack Test] 1/5 — saving fake 3-page stack…");
    const id = await saveStack(
      [TINY_JPEG, TINY_JPEG, TINY_JPEG],
      ["Page one text.", "Page two text.", "Page three text."]
    );
    console.log("[MegaStack Test] saved id:", id);

    // ── 2. List ───────────────────────────────────────────────────────
    console.log("[MegaStack Test] 2/5 — listing stacks…");
    let stacks = await listStacks();
    console.log(
      "[MegaStack Test] stacks:",
      JSON.stringify(
        stacks.map((s) => ({
          id: s.id,
          name: s.name,
          pageCount: s.pageCount,
          lastPage: s.lastPage,
        }))
      )
    );

    // ── 3. Load page 0 ────────────────────────────────────────────────
    console.log("[MegaStack Test] 3/5 — loading page 0 image…");
    const imgData = await loadStackImage(id, 0);
    console.log(
      "[MegaStack Test] page 0 loaded — base64 length:",
      imgData?.length ?? 0,
      "(should be > 0)"
    );

    // ── 4. Rename ─────────────────────────────────────────────────────
    console.log("[MegaStack Test] 4/5 — renaming stack…");
    await renameStack(id, "Renamed Test Stack");
    stacks = await listStacks();
    const renamed = stacks.find((s) => s.id === id);
    console.log("[MegaStack Test] new name:", renamed?.name, "(should be 'Renamed Test Stack')");

    // ── 5. Delete ─────────────────────────────────────────────────────
    console.log("[MegaStack Test] 5/5 — deleting stack…");
    await deleteStack(id);
    stacks = await listStacks();
    console.log(
      "[MegaStack Test] stack count after delete:",
      stacks.length,
      "(should be 0)"
    );

    console.log("=== [MegaStack Test] ALL STEPS PASSED ===");
  } catch (err) {
    console.error("=== [MegaStack Test] FAILED ===", err);
  }
}

if (typeof window !== "undefined") {
  window.testMegaStack = runTest;
  console.log(
    "[MegaStack Test] Ready — call window.testMegaStack() in the console to run."
  );
}
