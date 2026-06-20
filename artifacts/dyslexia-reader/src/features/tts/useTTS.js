import { useState, useCallback, useEffect, useRef } from "react";
import { TextToSpeech } from "@capacitor-community/text-to-speech";

// -----------------------------------------------------------------
// Plugin availability guard (Lesson 13).
//
// On native Android  : routes through Android TTS engine + UtteranceProgressListener.
// On web (Replit dev): uses the plugin's built-in Web Speech fallback, so dev
//                      mode still works in a normal browser.
// On Android WebViews that lack speechSynthesis (e.g. Honor): the *native* plugin
//                      path bypasses the WebView entirely — this is the whole point
//                      of this migration.
//
// pluginAvailable is false only if the plugin export is genuinely missing at
// runtime (edge case: someone imports this outside a Capacitor context with no
// web fallback). All plugin calls are also wrapped in try/catch individually.
// -----------------------------------------------------------------
let pluginAvailable = true;
try {
  if (!TextToSpeech || typeof TextToSpeech.speak !== "function") {
    pluginAvailable = false;
  }
} catch {
  pluginAvailable = false;
}

if (!pluginAvailable) {
  console.warn(
    "[useTTS] @capacitor-community/text-to-speech is not callable — TTS disabled."
  );
}

export function useTTS(text, { onError, collapseWhitespace = false } = {}) {
  const [ttsState,      setTtsState]      = useState("idle"); // "idle" | "speaking" | "paused"
  const [rate,          setRate]          = useState(1);
  const [pitch,         setPitch]         = useState(1);
  const [voices,        setVoices]        = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [wordIndex,     setWordIndex]     = useState(-1);

  // ---- Refs (readable inside async callbacks without stale-closure issues) ----
  const rateRef         = useRef(1);
  const pitchRef        = useRef(1);
  const voiceRef        = useRef(null);    // selectedVoice object
  const voicesRef       = useRef([]);      // mirrors voices state
  const textRef         = useRef(text);    // mirrors text prop
  const charIndexRef    = useRef(0);       // absolute char position in the full text
  const speakOffsetRef  = useRef(0);       // offset passed to the most recent speak() slice
  const wordsRef        = useRef([]);      // [{start, end}] positions in the full text
  const speakIdRef      = useRef(0);       // incremented each speak() to detect stale completions
  const listenerRef     = useRef(null);    // onRangeStart PluginListenerHandle
  const ttsStateRef     = useRef("idle");  // mirrors ttsState for use inside async callbacks
  // Option refs — kept in sync so doSpeak (a stable callback) reads current values.
  const onErrorRef            = useRef(onError);
  const collapseWhitespaceRef = useRef(collapseWhitespace);

  // Keep all mirrors in sync.
  useEffect(() => { textRef.current    = text;          }, [text]);
  useEffect(() => { rateRef.current    = rate;          }, [rate]);
  useEffect(() => { pitchRef.current   = pitch;         }, [pitch]);
  useEffect(() => { voiceRef.current   = selectedVoice; }, [selectedVoice]);
  useEffect(() => { voicesRef.current  = voices;        }, [voices]);
  useEffect(() => { ttsStateRef.current = ttsState;     }, [ttsState]);
  useEffect(() => { onErrorRef.current            = onError;           }, [onError]);
  useEffect(() => { collapseWhitespaceRef.current = collapseWhitespace;}, [collapseWhitespace]);

  // Recompute word char-offset table whenever text changes.
  useEffect(() => {
    const words = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      words.push({ start: match.index, end: match.index + match[0].length });
    }
    wordsRef.current = words;
  }, [text]);

  // ------------------------------------------------------------------
  // Voice loading.
  // getSupportedVoices() returns voices from the native TTS engine on Android,
  // or from speechSynthesis on web. Runs once on mount.
  // Voice selection is persisted as a voiceURI string (survives list reordering).
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!pluginAvailable) return;

    let cancelled = false;
    const delays = [500, 1000, 2000];

    async function tryLoadVoices(attempt) {
      if (cancelled) return;
      try {
        const { voices: raw } = await TextToSpeech.getSupportedVoices();
        if (cancelled) return;
        if (!raw || raw.length === 0) {
          // Engine returned empty list — retry if we have attempts left.
          // Happens on Android when the TTS engine hasn't finished initialising
          // its voice set (upstream issue #104 / #14).
          if (attempt < delays.length) {
            console.warn(`[useTTS] No voices returned, retrying in ${delays[attempt]}ms`);
            setTimeout(() => tryLoadVoices(attempt + 1), delays[attempt]);
          } else {
            console.warn("[useTTS] No voices returned after all retries — voice dropdown will not render.");
          }
          return;
        }

        // Show all voices. Persistence and restoration is handled entirely by
        // ScanSection (reads/writes dexy-voice via changeVoice). Here we only
        // set an initial default: prefer the first English voice so the app is
        // usable before the parent's restoration effect fires.
        setVoices(raw);
        voicesRef.current = raw;

        const englishMatch = raw.find((v) => v.lang && v.lang.startsWith("en"));
        const initial = englishMatch ?? raw[0] ?? null;
        setSelectedVoice(initial);
        voiceRef.current = initial;
      } catch (err) {
        console.error(`[useTTS] getSupportedVoices() attempt ${attempt + 1} failed:`, err);
        if (attempt < delays.length) {
          setTimeout(() => tryLoadVoices(attempt + 1), delays[attempt]);
        } else {
          console.error("[useTTS] All voice loading attempts failed — voice dropdown will not render.");
        }
      }
    }

    tryLoadVoices(0);
    return () => { cancelled = true; };
  }, []);

  // ------------------------------------------------------------------
  // onRangeStart listener management.
  //
  // Fires on Android 8+ (API 26+). Silent on older Android — highlighting
  // just won't advance (graceful degradation). iOS is NOT supported by this
  // plugin version; onRangeStart is Android-only here (issue #153 open upstream).
  //
  // IMPORTANT: `start` from the event is an offset into the TEXT SLICE passed
  // to speak(), not into the full text. Adding speakOffsetRef.current converts
  // it to an absolute position in the original text.
  // ------------------------------------------------------------------
  function removeRangeListener() {
    if (listenerRef.current) {
      listenerRef.current.remove().catch(() => {});
      listenerRef.current = null;
    }
  }

  async function attachRangeListener() {
    removeRangeListener();
    try {
      const handle = await TextToSpeech.addListener(
        "onRangeStart",
        ({ start }) => {
          const absChar = speakOffsetRef.current + start;
          charIndexRef.current = absChar;

          const idx = wordsRef.current.findIndex(
            (w) => absChar >= w.start && absChar < w.end
          );
          if (idx !== -1) setWordIndex(idx);
        }
      );
      listenerRef.current = handle;
    } catch (err) {
      console.error("[useTTS] addListener(onRangeStart) failed:", err);
    }
  }

  // ------------------------------------------------------------------
  // Core speak dispatcher.
  // Uses only refs so it never needs to be recreated (stable reference).
  // `offset` is the absolute char position in the full text to start from.
  // ------------------------------------------------------------------
  const doSpeak = useCallback(async (offset) => {
    const id   = ++speakIdRef.current;
    const text = textRef.current;

    speakOffsetRef.current = offset;
    charIndexRef.current   = offset;

    // Map selected voice object → numeric index (what speak() requires).
    // Sorted order is guaranteed stable by the plugin (alphabetical by voiceURI).
    const allVoices  = voicesRef.current;
    const voiceIndex = voiceRef.current
      ? allVoices.findIndex((v) => v.voiceURI === voiceRef.current.voiceURI)
      : -1;

    // FIX 3: Build the spoken text from the raw slice.
    // Default (scan): 1-for-1 \n→space so char offsets stay aligned with
    // wordsRef and onRangeStart word-highlighting keeps working.
    // collapseWhitespace (EPUB): also collapse runs and trim — EPUB sections
    // can be mostly newlines; the TTS engine rejects strings of spaces.
    // Word-highlight offsets do not matter in EPUB mode (disableWordTap=true).
    const rawSlice   = text.slice(offset).replace(/\n/g, " ");
    const spokenText = collapseWhitespaceRef.current
      ? rawSlice.replace(/\s+/g, " ").trim()
      : rawSlice;

    // FIX 1: Do NOT call speak() on a page with no word characters.
    // Passing "" or "   " to the native TTS engine throws "Failed to read text",
    // and the catch block used to treat that as a natural page end → runaway loop.
    const isEmpty = !/\w/.test(spokenText);
    if (isEmpty) {
      if (speakIdRef.current === id) {
        console.log(`[epub-tts] chars=${spokenText.length} -> skipped (empty page, suppressing advance)`);
        // Mark as non-natural end so advance is suppressed (same as FIX 2).
        onErrorRef.current?.();
        removeRangeListener();
        setWordIndex(-1);
        setTtsState("idle");
      }
      return;
    }

    const options = {
      text:   spokenText,
      lang:   voiceRef.current?.lang ?? "en-US",
      rate:   rateRef.current,
      pitch:  pitchRef.current,
      volume: 1.0,
      ...(voiceIndex >= 0 ? { voice: voiceIndex } : {}),
    };

    await attachRangeListener();

    try {
      // speak() resolves on natural completion. If stop() is called while
      // speaking, the plugin clears the request internally and this promise
      // never settles — that is intentional (we handle state manually in stop()).
      await TextToSpeech.speak(options);

      // Natural completion — only process if this speak session is still current.
      if (speakIdRef.current === id) {
        console.log(`[epub-tts] chars=${spokenText.length} -> spoke (natural end)`);
        removeRangeListener();
        charIndexRef.current = 0;
        setWordIndex(-1);
        setTtsState("idle");
      }
    } catch (err) {
      if (speakIdRef.current === id) {
        console.error("[useTTS] speak() failed:", err);
        console.log(`[epub-tts] chars=${spokenText.length} -> failed (suppressing advance)`);
        // FIX 2: mark as non-natural so the speaking→idle transition in
        // ReaderView does NOT fire onPlaybackEnd and does NOT advance the page.
        // This is the core loop-killer: speak failures must never auto-advance.
        onErrorRef.current?.();
        removeRangeListener();
        setWordIndex(-1);
        setTtsState("idle");
      }
    }
  }, []); // stable — reads everything via refs // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Reset on text change (new scan / paste).
  // ------------------------------------------------------------------
  useEffect(() => {
    if (ttsStateRef.current !== "idle") {
      try { TextToSpeech.stop(); } catch { /* ignore */ }
    }
    removeRangeListener();
    speakIdRef.current++;
    charIndexRef.current   = 0;
    speakOffsetRef.current = 0;
    setWordIndex(-1);
    setTtsState("idle");
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      removeRangeListener();
      speakIdRef.current++;
      try { TextToSpeech.stop(); } catch { /* ignore */ }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // toggle: idle → speaking | speaking → paused | paused → speaking.
  //
  // Pause is faked (plugin has no pause()): we call stop() and remember the
  // last absolute char position. Resume calls speak() from that position.
  // The gap between stopping and restarting is audible but brief — accepted
  // trade-off given Android TTS engine limitations.
  // ------------------------------------------------------------------
  const toggle = useCallback(() => {
    if (!pluginAvailable) return;

    if (ttsState === "idle") {
      charIndexRef.current   = 0;
      speakOffsetRef.current = 0;
      setTtsState("speaking");
      doSpeak(0);

    } else if (ttsState === "speaking") {
      // Fake pause: capture last known word position, then stop.
      const resumeAt = charIndexRef.current;
      try { TextToSpeech.stop(); } catch (err) { console.error("[useTTS] stop() failed:", err); }
      removeRangeListener();
      speakIdRef.current++;       // prevent stale completion handler
      charIndexRef.current = resumeAt;
      setTtsState("paused");

    } else if (ttsState === "paused") {
      // Resume from last known position.
      const offset = charIndexRef.current;
      setTtsState("speaking");
      doSpeak(offset);
    }
  }, [ttsState, doSpeak]);

  const stop = useCallback(() => {
    if (!pluginAvailable) return;
    try { TextToSpeech.stop(); } catch (err) { console.error("[useTTS] stop() failed:", err); }
    removeRangeListener();
    speakIdRef.current++;
    charIndexRef.current   = 0;
    speakOffsetRef.current = 0;
    setWordIndex(-1);
    setTtsState("idle");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restart mid-utterance after settings change (rate, pitch, voice).
  const restartFromCurrent = useCallback((newRate, newPitch, newVoice) => {
    if (!pluginAvailable) return;
    rateRef.current  = newRate;
    pitchRef.current = newPitch;
    voiceRef.current = newVoice;
    try { TextToSpeech.stop(); } catch { /* ignore */ }
    removeRangeListener();
    speakIdRef.current++;
    const offset = charIndexRef.current;
    setTtsState("speaking");
    doSpeak(offset);
  }, [doSpeak]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seek to a specific word by character offset and word index.
  // Works from idle, speaking, or paused — always transitions to speaking.
  // This is the primary tap-to-resume mechanism on Android.
  const seekToWord = useCallback((charOffset, wordIdx) => {
    if (!pluginAvailable) return;
    try { TextToSpeech.stop(); } catch { /* ignore */ }
    removeRangeListener();
    speakIdRef.current++;
    charIndexRef.current = charOffset;
    setWordIndex(wordIdx);
    setTtsState("speaking");
    doSpeak(charOffset);
  }, [doSpeak]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeRate = useCallback((newRate) => {
    setRate(newRate);
    rateRef.current = newRate;
    if (ttsState === "speaking") {
      restartFromCurrent(newRate, pitchRef.current, voiceRef.current);
    }
  }, [ttsState, restartFromCurrent]);

  const changePitch = useCallback((newPitch) => {
    setPitch(newPitch);
    pitchRef.current = newPitch;
    if (ttsState === "speaking") {
      restartFromCurrent(rateRef.current, newPitch, voiceRef.current);
    }
  }, [ttsState, restartFromCurrent]);

  const changeVoice = useCallback((newVoice) => {
    setSelectedVoice(newVoice);
    voiceRef.current = newVoice;
    if (ttsState === "speaking") {
      restartFromCurrent(rateRef.current, pitchRef.current, newVoice);
    }
  }, [ttsState, restartFromCurrent]);

  return {
    ttsState, rate, pitch, voices, selectedVoice,
    wordIndex,
    toggle, stop, seekToWord,
    changeRate, changePitch, changeVoice,
  };
}
