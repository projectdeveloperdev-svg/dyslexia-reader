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
  utterance.onend   = onEnd;
  utterance.onerror = onEnd;
  return utterance;
}

export function useTTS(text) {
  const [ttsState,      setTtsState]      = useState("idle"); // idle | speaking | paused
  const [rate,          setRate]          = useState(1);
  const [pitch,         setPitch]         = useState(1);
  const [voices,        setVoices]        = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  const utteranceRef      = useRef(null);
  const charIndexRef      = useRef(0);
  const utteranceOffsetRef = useRef(0);
  const rateRef           = useRef(1);
  const pitchRef          = useRef(1);
  const voiceRef          = useRef(null);

  useEffect(() => { rateRef.current  = rate;          }, [rate]);
  useEffect(() => { pitchRef.current = pitch;         }, [pitch]);
  useEffect(() => { voiceRef.current = selectedVoice; }, [selectedVoice]);

  // Null all handlers on the current utterance ref.
  // Always call before cancel() to prevent stale onend/onerror callbacks from
  // firing asynchronously on Android Chrome after cancel() or completion.
  function nullHandlers() {
    if (utteranceRef.current) {
      utteranceRef.current.onend      = null;
      utteranceRef.current.onerror    = null;
      utteranceRef.current.onboundary = null;
    }
  }

  // Load voices — must handle async population in Chrome/Android
  useEffect(() => {
    function loadVoices() {
      const all      = window.speechSynthesis.getVoices();
      const filtered = filterVoices(all);
      if (filtered.length === 0) return;
      setVoices(filtered);
      setSelectedVoice((prev) => {
        if (prev) return prev;
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
    nullHandlers();
    window.speechSynthesis.cancel();
    setTtsState("idle");
    charIndexRef.current  = 0;
    utteranceRef.current  = null;
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      nullHandlers();
      window.speechSynthesis.cancel();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onEnd = useCallback((e) => {
    // Null handlers via the event target (precise — avoids stale ref issues if
    // this fires for an older utterance after a new one was already queued).
    if (e && e.target) {
      e.target.onend      = null;
      e.target.onerror    = null;
      e.target.onboundary = null;
    }
    // Cancel explicitly after natural completion.
    // On Android Chrome the speech queue is not reliably cleared when onend fires,
    // which causes the utterance to restart from the beginning.
    window.speechSynthesis.cancel();
    charIndexRef.current = 0;
    utteranceRef.current = null;
    setTtsState("idle");
  }, []);

  const toggle = useCallback(() => {
    if (ttsState === "idle") {
      // Null handlers on any previous (completed) utterance before calling cancel().
      // On Android Chrome, cancel() can fire onend/onerror on a completed utterance
      // whose handlers are still set, causing a stale setTtsState("idle") to race
      // against the setTtsState("speaking") below.
      nullHandlers();
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
      // speechSynthesis.resume() is unreliable on Android Chrome — it silently
      // does nothing after pause(). Workaround: cancel the paused utterance and
      // rebuild it from the last tracked character position (charIndexRef.current).
      // Note: onboundary events are not reliably fired on Android Chrome, so
      // charIndexRef.current may be 0. This means Resume can restart from the
      // beginning of the text rather than the exact pause point — accepted
      // trade-off, not a bug.
      nullHandlers();
      window.speechSynthesis.cancel();
      const utterance = buildUtterance({
        text, offset: charIndexRef.current,
        rate: rateRef.current, pitch: pitchRef.current, voice: voiceRef.current,
        charIndexRef, utteranceOffsetRef, onEnd,
      });
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setTtsState("speaking");
    }
  }, [ttsState, text, onEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    nullHandlers();
    window.speechSynthesis.cancel();
    utteranceRef.current  = null;
    charIndexRef.current  = 0;
    setTtsState("idle");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restartFromCurrent = useCallback((newRate, newPitch, newVoice) => {
    nullHandlers();
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
