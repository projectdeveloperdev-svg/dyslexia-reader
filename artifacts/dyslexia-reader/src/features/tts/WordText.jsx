import { useMemo, Fragment } from "react";
import "../ocr/OCRResult.css";
import "./WordText.css";

function WordText({ text, wordIndex, onWordTap, fontSize, fontFamily, bgColour, bgOpacity }) {
  // Split text into alternating word / whitespace segments, each word tagged
  // with its character offset into the original text (for seekToWord).
  const segments = useMemo(() => {
    const result = [];
    const regex = /\S+/g;
    let match;
    let lastIdx = 0;
    let wIdx = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        result.push({ type: "space", content: text.slice(lastIdx, match.index) });
      }
      result.push({ type: "word", content: match[0], start: match.index, wordIdx: wIdx });
      lastIdx = match.index + match[0].length;
      wIdx++;
    }
    if (lastIdx < text.length) {
      result.push({ type: "space", content: text.slice(lastIdx) });
    }
    return result;
  }, [text]);

  return (
    <div className="ocr-result-box" style={{ "--ocr-font-size": `${fontSize}px`, fontFamily, "--ocr-bg-rgb": bgColour, "--ocr-bg-opacity": bgOpacity }}>
      {segments.map((seg, i) => {
        if (seg.type === "space") {
          return <Fragment key={i}>{seg.content}</Fragment>;
        }
        const highlighted = seg.wordIdx === wordIndex;
        return (
          <span
            key={i}
            className={`word-span${highlighted ? " word-highlight" : ""}`}
            onClick={() => onWordTap(seg.start, seg.wordIdx)}
          >
            {seg.content}
          </span>
        );
      })}
    </div>
  );
}

export default WordText;
