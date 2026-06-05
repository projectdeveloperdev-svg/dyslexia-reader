import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";

const MEGASTACKS_DIR = "megastacks";
const INDEX_PATH = `${MEGASTACKS_DIR}/megastacks_index.json`;

// ── Internal helpers ──────────────────────────────────────────────────────────

async function readIndex() {
  try {
    const result = await Filesystem.readFile({
      path: INDEX_PATH,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    return JSON.parse(result.data);
  } catch (err) {
    // First run — index doesn't exist yet. Any genuine I/O error will have a
    // different message; treat "file not found" variants as an empty list.
    const msg = err?.message ?? "";
    if (
      msg.includes("does not exist") ||
      msg.includes("No such file") ||
      msg.includes("not found") ||
      msg.includes("ENOENT")
    ) {
      return [];
    }
    console.error("[megaStackStorage] readIndex: unexpected error:", err);
    throw err;
  }
}

async function writeIndex(stacks) {
  try {
    await Filesystem.writeFile({
      path: INDEX_PATH,
      data: JSON.stringify(stacks),
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  } catch (err) {
    console.error("[megaStackStorage] writeIndex failed:", err);
    throw err;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save a new stack to disk.
 *
 * @param {string[]} images   - Array of base64 image strings (data URL prefix optional).
 * @param {string[]} ocrText  - Parallel array of OCR text strings.
 * @returns {Promise<string>} - The generated UUID for the new stack.
 */
export async function saveStack(images, ocrText) {
  const id = crypto.randomUUID();

  // Read existing stacks to determine the auto-name number.
  const existing = await listStacks();
  const name = `Stack ${existing.length + 1}`;

  // Write each image file.
  const imageFiles = [];
  for (let i = 0; i < images.length; i++) {
    const filePath = `${MEGASTACKS_DIR}/${id}-${i}.jpg`;
    // Strip the data URL prefix if present (Filesystem expects raw base64).
    const base64Data = images[i].replace(/^data:image\/[^;]+;base64,/, "");
    try {
      await Filesystem.writeFile({
        path: filePath,
        data: base64Data,
        directory: Directory.Data,
        recursive: true,
      });
    } catch (err) {
      console.error(`[megaStackStorage] saveStack: failed writing image ${i} for stack ${id}:`, err);
      throw err;
    }
    imageFiles.push(filePath);
  }

  const entry = {
    id,
    name,
    created: new Date().toISOString(),
    pageCount: images.length,
    lastPage: 0,
    imageFiles,
    ocrText: [...ocrText],
  };

  // Re-read index (not cached) so concurrent saves don't clobber each other.
  const stacks = await listStacks();
  stacks.push(entry);
  await writeIndex(stacks);

  console.log(`[megaStackStorage] saveStack: saved "${name}" id=${id} pages=${images.length}`);
  return id;
}

/**
 * Return all saved stack entries from the index.
 * Returns [] on first run (no index file yet).
 */
export async function listStacks() {
  return readIndex();
}

/**
 * Load ONE page image from disk (lazy — does not load all pages).
 * Returns the raw base64 string (no data URL prefix).
 */
export async function loadStackImage(stackId, pageIndex) {
  const stacks = await listStacks();
  const stack = stacks.find((s) => s.id === stackId);
  if (!stack) {
    const err = new Error(`[megaStackStorage] loadStackImage: stack ${stackId} not found`);
    console.error(err.message);
    throw err;
  }
  const filePath = stack.imageFiles[pageIndex];
  if (!filePath) {
    const err = new Error(
      `[megaStackStorage] loadStackImage: page ${pageIndex} out of range for stack ${stackId} (pageCount=${stack.pageCount})`
    );
    console.error(err.message);
    throw err;
  }
  try {
    const result = await Filesystem.readFile({
      path: filePath,
      directory: Directory.Data,
    });
    console.log(`[megaStackStorage] loadStackImage: loaded page ${pageIndex} from ${filePath} (${result.data?.length ?? 0} chars)`);
    return result.data; // raw base64
  } catch (err) {
    console.error(`[megaStackStorage] loadStackImage: failed reading ${filePath}:`, err);
    throw err;
  }
}

/**
 * Rename a stack in the index.
 */
export async function renameStack(stackId, newName) {
  const stacks = await listStacks();
  const idx = stacks.findIndex((s) => s.id === stackId);
  if (idx === -1) {
    const err = new Error(`[megaStackStorage] renameStack: stack ${stackId} not found`);
    console.error(err.message);
    throw err;
  }
  stacks[idx].name = newName;
  await writeIndex(stacks);
  console.log(`[megaStackStorage] renameStack: ${stackId} → "${newName}"`);
}

/**
 * Persist the user's last-read page for a stack.
 */
export async function updateLastPage(stackId, pageIndex) {
  const stacks = await listStacks();
  const idx = stacks.findIndex((s) => s.id === stackId);
  if (idx === -1) {
    const err = new Error(`[megaStackStorage] updateLastPage: stack ${stackId} not found`);
    console.error(err.message);
    throw err;
  }
  stacks[idx].lastPage = pageIndex;
  await writeIndex(stacks);
}

/**
 * Delete a stack's image files and its index entry.
 * Image-file deletion failures are logged but do not abort the index removal.
 */
export async function deleteStack(stackId) {
  const stacks = await listStacks();
  const idx = stacks.findIndex((s) => s.id === stackId);
  if (idx === -1) {
    const err = new Error(`[megaStackStorage] deleteStack: stack ${stackId} not found`);
    console.error(err.message);
    throw err;
  }
  const stack = stacks[idx];

  for (const filePath of stack.imageFiles) {
    try {
      await Filesystem.deleteFile({
        path: filePath,
        directory: Directory.Data,
      });
    } catch (err) {
      // Log but continue — the file may already be gone; index cleanup must proceed.
      console.error(`[megaStackStorage] deleteStack: could not delete ${filePath}:`, err);
    }
  }

  stacks.splice(idx, 1);
  await writeIndex(stacks);
  console.log(`[megaStackStorage] deleteStack: removed stack ${stackId}`);
}
