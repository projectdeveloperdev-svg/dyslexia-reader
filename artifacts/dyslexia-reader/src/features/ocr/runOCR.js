import { Ocr } from "@jcesarmobile/capacitor-ocr";

export async function runOCR(imageUrl) {
  let results;
  try {
    ({ results } = await Ocr.process({ image: imageUrl }));
  } catch (err) {
    console.error("[runOCR] OCR failed:", err);
    throw err;
  }

  if (!results || results.length === 0) {
    return "";
  }

  // Join blocks with \n\n so paragraph boundaries reach cleanText intact.
  // Each element in results is a detected text region (block/paragraph).
  const text = results
    .map((r) => r.text)
    .filter((t) => t && t.trim().length > 0)
    .join("\n\n");

  return text;
}
