import { useState, useCallback } from "react";
import Tesseract from "tesseract.js";

export function useOCR() {
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [text, setText] = useState("");

  const runOCR = useCallback(async (imageUrl) => {
    setStatus("loading");
    setText("");
    try {
      const result = await Tesseract.recognize(imageUrl, "eng", {
        logger: () => {},
      });
      const extracted = result.data.text.trim();
      if (!extracted) {
        setStatus("error");
      } else {
        setText(extracted);
        setStatus("done");
      }
    } catch {
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setText("");
  }, []);

  return { status, text, runOCR, reset };
}
