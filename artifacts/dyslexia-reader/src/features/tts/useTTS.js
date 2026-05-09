import { useState, useCallback, useEffect, useRef } from "react";

export function useTTS(text) {
  const [ttsState, setTtsState] = useState("idle"); // idle | speaking | paused
  const utteranceRef = useRef(null);

  useEffect(() => {
    window.speechSynthesis.cancel();
    setTtsState("idle");
    utteranceRef.current = null;
  }, [text]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const toggle = useCallback(() => {
    if (ttsState === "idle") {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setTtsState("idle");
      utterance.onerror = () => setTtsState("idle");
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
  }, [ttsState, text]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setTtsState("idle");
  }, []);

  return { ttsState, toggle, stop };
}
