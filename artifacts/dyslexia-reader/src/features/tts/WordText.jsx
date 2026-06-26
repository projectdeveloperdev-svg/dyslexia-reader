import { useMemo, Fragment } from "react";
import "../ocr/OCRResult.css";
import "./WordText.css";

function WordText({
  text,
  wordIndex,
  onWordTap,
  lineMode = false,  // when true, highlight a whole \n-line instead of one word
  lineShift = 0,     // 0=A (active line), 1=B (active+1), 2=C (both). Only used when lineMode=true.
  fontSize,
  fontFamily,
  bgColour,
  bgOpacity,
}) {
  // Split text into alternating word / whitespace segments.
  // Each word is tagged with:
  //   start   — its absolute char offset in `text` (for seekToWord)
  //   wordIdx — sequential word number (for word-by-word highlight)
  //   lineIdx — which \n-delimited line it falls in (for line highlight)
  const segments = useMemo(() => {
    // Build an array of the char offset where each \n-delimited line starts.
    // lineStarts[k] = absolute char offset of the first character of line k.
    // A \n at position i means line k+1 starts at i+1.
    const lineStarts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "\n") lineStarts.push(i + 1);
    }

    const result = [];
    const regex = /\S+/g;
    let match;
    let lastIdx = 0;
    let wIdx = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        result.push({ type: "space", content: text.slice(lastIdx, match.index) });
      }

      // Find the \n-line this word belongs to:
      // walk lineStarts backwards to find the largest start ≤ match.index.
      // Words are \S+ so they never contain \n — each word is wholly inside one line.
      let lineIdx = 0;
      for (let k = lineStarts.length - 1; k >= 0; k--) {
        if (match.index >= lineStarts[k]) {
          lineIdx = k;
          break;
        }
      }

      result.push({
        type: "word",
        content: match[0],
        start: match.index,
        wordIdx: wIdx,
        lineIdx,
      });
      lastIdx = match.index + match[0].length;
      wIdx++;
    }

    if (lastIdx < text.length) {
      result.push({ type: "space", content: text.slice(lastIdx) });
    }
    return result;
  }, [text]);

  // In line mode: derive the active line index from the active word.
  // Returns -1 when TTS is idle (wordIndex < 0) or line mode is off.
  const activeLineIdx = useMemo(() => {
    if (!lineMode || wordIndex < 0) return -1;
    const activeWord = segments.find(
      (s) => s.type === "word" && s.wordIdx === wordIndex
    );
    return activeWord ? activeWord.lineIdx : -1;
  }, [lineMode, wordIndex, segments]);

  // Next line index for modes B and C.
  // Clamped to activeLineIdx when no words exist on the next line (last line of chunk).
  const nextLineIdx = useMemo(() => {
    if (activeLineIdx < 0) return -1;
    const hasNext = segments.some(
      (s) => s.type === "word" && s.lineIdx === activeLineIdx + 1
    );
    return hasNext ? activeLineIdx + 1 : activeLineIdx;
  }, [activeLineIdx, segments]);

  return (
    <div
      className="ocr-result-box"
      style={{
        "--ocr-font-size": `${fontSize}px`,
        fontFamily,
        "--ocr-bg-rgb": bgColour,
        "--ocr-bg-opacity": bgOpacity,
      }}
    >
      {segments.map((seg, i) => {
        if (seg.type === "space") {
          return <Fragment key={i}>{seg.content}</Fragment>;
        }

        let highlighted;
        if (!lineMode || activeLineIdx < 0) {
          // Word-by-word mode (scan / PDF / Quick Stack / Mega Stack),
          // or EPUB with TTS idle — use standard word highlight.
          highlighted = seg.wordIdx === wordIndex;
        } else if (lineShift === 1) {
          // Mode B — shifted: light the line AHEAD of the active word.
          highlighted = seg.lineIdx === nextLineIdx;
        } else if (lineShift === 2) {
          // Mode C — two lines: active + next together.
          highlighted = seg.lineIdx === activeLineIdx || seg.lineIdx === nextLineIdx;
        } else {
          // Mode A (default) — current active line only.
          highlighted = seg.lineIdx === activeLineIdx;
        }

        return (
          <span
            key={i}
            className={`word-span${highlighted ? " word-highlight" : ""}`}
            onClick={onWordTap ? () => onWordTap(seg.start, seg.wordIdx) : undefined}
          >
            {seg.content}
          </span>
        );
      })}
    </div>
  );
}

export default WordText;
