import Tesseract from "tesseract.js";

export async function runOCR(imageUrl) {
  const result = await Tesseract.recognize(imageUrl, "eng", { logger: () => {} });
  return result.data.text.trim();
}
