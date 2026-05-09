import { useState, useCallback, useEffect, useRef } from "react";

function buildUtterance({ text, offset, rate, charIndexRef, utteranceOffsetRef, onEnd }) {
  const remaining = text.slice(offset);
  const utterance = new SpeechSynthesisUtterance(remaining);
  utterance.rate = rate;
  utteranceOffsetRef.current = offset;
  utterance.onboundary = (e) => {
    charIndexRef.current = offset + e.charIndex;
  };
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  return utterance;
}

export function useTTS(text) {
  const [ttsState, setTtsState] = useState("idle"); // idle | speaking | paused
  const [rate, setRate] = useState(1);

  const utteranceRef = useRef(null);
  const charIndexRef = useRef(0);
  const utteranceOffsetRef = useRef(0);
  const rateRef = useRef(1);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    window.speechSynthesis.cancel();
    setTtsState("idle");
    charIndexRef.current = 0;
    utteranceRef.current = null;
  }, [text]);

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  const onEnd = useCallback(() => {
    charIndexRef.current = 0;
    setTtsState("idle");
  }, []);

  const toggle = useCallback(() => {
    if (ttsState === "idle") {
      charIndexRef.current = 0;
      const utterance = buildUtterance({
        text, offset: 0, rate: rateRef.current,
        charIndexRef, utteranceOffsetRef, onEnd,
      });
      utteranceRef.current = utterance;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setTtsState("speaking");
    } else if (ttsState === "speaking") {
      window.speechSynthesis.pause();
      setTtsState("paused");
    } else if (ttsState === "paused") {
      window.speechSynthesis.resume();
      setTtsState("speaking");
    }
  }, [ttsState, text, onEnd]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    charIndexRef.current = 0;
    setTtsState("idle");
  }, []);

  const changeRate = useCallback((newRate) => {
    setRate(newRate);
    rateRef.current = newRate;
    if (ttsState === "speaking" || ttsState === "paused") {
      window.speechSynthesis.cancel();
      const utterance = buildUtterance({
        text, offset: charIndexRef.current, rate: newRate,
        charIndexRef, utteranceOffsetRef, onEnd,
      });
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setTtsState("speaking");
    }
  }, [ttsState, text, onEnd]);

  return { ttsState, rate, toggle, stop, changeRate };
}
