import { useState, useCallback, useEffect, useRef } from "react";

function filterVoices(all) {
  const english = all.filter((v) => v.lang.startsWith("en"));
  const preferred = english.filter((v) => /Google|Microsoft|Natural/i.test(v.name));
  return preferred.length > 0 ? preferred : english;
}

function buildUtterance({ text, offset, rate, pitch, voice, charIndexRef, utteranceOffsetRef, onEnd }) {
  const remaining = text.slice(offset);
  const utterance = new SpeechSynthesisUtterance(remaining);
  utterance.rate = rate;
  utterance.pitch = pitch;
  if (voice) utterance.voice = voice;
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
  const [pitch, setPitch] = useState(1);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  const utteranceRef = useRef(null);
  const charIndexRef = useRef(0);
  const utteranceOffsetRef = useRef(0);
  const rateRef = useRef(1);
  const pitchRef = useRef(1);
  const voiceRef = useRef(null);

  useEffect(() => { rateRef.current = rate; }, [rate]);
  useEffect(() => { pitchRef.current = pitch; }, [pitch]);
  useEffect(() => { voiceRef.current = selectedVoice; }, [selectedVoice]);

  // Load voices — must handle async population in Chrome/Android
  useEffect(() => {
    function loadVoices() {
      const all = window.speechSynthesis.getVoices();
      const filtered = filterVoices(all);
      if (filtered.length === 0) return; // not ready yet
      setVoices(filtered);
      setSelectedVoice((prev) => {
        if (prev) return prev; // keep user's selection
        voiceRef.current = filtered[0];
        return filtered[0];
      });
    }

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

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
        text, offset: 0,
        rate: rateRef.current, pitch: pitchRef.current, voice: voiceRef.current,
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

  const restartFromCurrent = useCallback((newRate, newPitch, newVoice) => {
    window.speechSynthesis.cancel();
    const utterance = buildUtterance({
      text, offset: charIndexRef.current,
      rate: newRate, pitch: newPitch, voice: newVoice,
      charIndexRef, utteranceOffsetRef, onEnd,
    });
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setTtsState("speaking");
  }, [text, onEnd]);

  const changeRate = useCallback((newRate) => {
    setRate(newRate);
    rateRef.current = newRate;
    if (ttsState === "speaking" || ttsState === "paused") {
      restartFromCurrent(newRate, pitchRef.current, voiceRef.current);
    }
  }, [ttsState, restartFromCurrent]);

  const changePitch = useCallback((newPitch) => {
    setPitch(newPitch);
    pitchRef.current = newPitch;
    if (ttsState === "speaking" || ttsState === "paused") {
      restartFromCurrent(rateRef.current, newPitch, voiceRef.current);
    }
  }, [ttsState, restartFromCurrent]);

  const changeVoice = useCallback((newVoice) => {
    setSelectedVoice(newVoice);
    voiceRef.current = newVoice;
    if (ttsState === "speaking" || ttsState === "paused") {
      restartFromCurrent(rateRef.current, pitchRef.current, newVoice);
    }
  }, [ttsState, restartFromCurrent]);

  return { ttsState, rate, pitch, voices, selectedVoice, toggle, stop, changeRate, changePitch, changeVoice };
}
