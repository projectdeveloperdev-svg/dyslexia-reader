import { useState, useEffect, useRef } from "react";
import { TextToSpeech } from "@capacitor-community/text-to-speech";
import "./VoiceLab.css";

const SAMPLE =
  "The quiet morning light fell across the table. She picked up the book and started to read, slowly at first, then with more confidence.";

const VIBES = [
  "warm", "clear", "slow", "energetic", "soft", "deep",
  "bright", "flat", "robotic", "posh", "friendly",
  "gravelly", "young", "mature", "accented",
];

const LS_KEY = "dexy.voiceListeningProgress";

function langRank(lang) {
  if (!lang) return 99;
  if (lang.startsWith("en-GB")) return 0;
  if (lang.startsWith("en-US")) return 1;
  if (lang.startsWith("en"))    return 2;
  return 3;
}

function sortVoices(voices) {
  return [...voices].sort((a, b) => {
    const rA = langRank(a.lang);
    const rB = langRank(b.lang);
    if (rA !== rB) return rA - rB;
    const langCmp = (a.lang || "").localeCompare(b.lang || "");
    if (langCmp !== 0) return langCmp;
    return (a.name || "").localeCompare(b.name || "");
  });
}

function groupByLang(voices) {
  const groups = new Map();
  for (const v of voices) {
    const key = v.lang || "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }
  return [...groups.entries()].map(([lang, list]) => ({ lang, list }));
}

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}

export default function VoiceLab() {
  const [voices, setVoices]       = useState([]);
  const [rawVoices, setRawVoices] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [progress, setProgress]   = useState(loadProgress);
  const [playingId, setPlayingId] = useState(null);
  const [toast, setToast]         = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const { voices: raw } = await TextToSpeech.getSupportedVoices();
        setRawVoices(raw);
        const local = raw.filter((v) => v.localService === true);
        setVoices(sortVoices(local));
      } catch (e) {
        console.error("[VoiceLab] getSupportedVoices failed:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { TextToSpeech.stop().catch(() => {}); };
  }, []);

  function save(updated) {
    setProgress(updated);
    try { localStorage.setItem(LS_KEY, JSON.stringify(updated)); } catch {}
  }

  function getRow(voiceURI) {
    return progress[voiceURI] || { gender: "", tags: [], notes: "", skip: false };
  }

  function updateRow(voiceURI, patch) {
    const existing = getRow(voiceURI);
    save({ ...progress, [voiceURI]: { ...existing, ...patch } });
  }

  function toggleTag(voiceURI, tag) {
    const row = getRow(voiceURI);
    const tags = row.tags.includes(tag)
      ? row.tags.filter((t) => t !== tag)
      : [...row.tags, tag];
    updateRow(voiceURI, { tags });
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  async function playVoice(voice) {
    await TextToSpeech.stop().catch(() => {});
    if (playingId === voice.voiceURI) {
      setPlayingId(null);
      return;
    }
    const voiceIndex = rawVoices.findIndex((v) => v.voiceURI === voice.voiceURI);
    setPlayingId(voice.voiceURI);
    try {
      await TextToSpeech.speak({
        text: SAMPLE,
        lang: voice.lang ?? "en-US",
        rate: 1,
        pitch: 1,
        volume: 1,
        ...(voiceIndex >= 0 ? { voice: voiceIndex } : {}),
      });
    } catch {}
    setPlayingId((prev) => (prev === voice.voiceURI ? null : prev));
  }

  async function handleExport() {
    const lines = voices.map((v) => {
      const row = getRow(v.voiceURI);
      return [
        v.voiceURI,
        v.name || "",
        v.lang || "",
        row.gender,
        row.tags.join(" "),
        row.notes,
      ].join(" | ");
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("Voice list copied to clipboard");
    } catch {
      showToast("Copy failed — try again");
    }
  }

  function handleClearProgress() {
    if (!window.confirm("Clear all tagging progress? This cannot be undone.")) return;
    try { localStorage.removeItem(LS_KEY); } catch {}
    setProgress({});
  }

  const tagged = voices.filter((v) => {
    const row = getRow(v.voiceURI);
    return row.gender !== "" || row.tags.length > 0;
  }).length;

  const groups = groupByLang(voices);

  return (
    <div className="vl-root">
      <header className="vl-header">
        <h1 className="vl-title">Voice Lab</h1>
        <p className="vl-progress">{tagged} / {voices.length} tagged</p>
      </header>

      <div className="vl-list">
        {loading && <p className="vl-status">Loading voices…</p>}
        {!loading && voices.length === 0 && (
          <p className="vl-status">No offline voices found on this device.</p>
        )}

        {groups.map(({ lang, list }) => (
          <section key={lang} className="vl-group">
            <h2 className="vl-group-heading">{lang}</h2>

            {list.map((voice) => {
              const row = getRow(voice.voiceURI);
              const isPlaying = playingId === voice.voiceURI;

              return (
                <div
                  key={voice.voiceURI}
                  className={"vl-row" + (row.skip ? " vl-row--skip" : "")}
                >
                  <div className="vl-row-top">
                    <button
                      className={"vl-play-btn" + (isPlaying ? " vl-play-btn--active" : "")}
                      onClick={() => playVoice(voice)}
                      aria-label={isPlaying ? "Stop" : "Play sample"}
                    >
                      {isPlaying ? "⏹" : "▶"}
                    </button>
                    <div className="vl-row-meta">
                      <span className="vl-voice-name">{voice.name || "(unnamed)"}</span>
                      <span className="vl-voice-uri">{voice.voiceURI}</span>
                    </div>
                    <label className="vl-skip-label">
                      <input
                        type="checkbox"
                        checked={row.skip}
                        onChange={(e) => updateRow(voice.voiceURI, { skip: e.target.checked })}
                      />
                      Skip
                    </label>
                  </div>

                  <div className="vl-gender-row">
                    {[["M", "Male"], ["F", "Female"], ["N", "Neutral"]].map(([g, label]) => (
                      <button
                        key={g}
                        className={"vl-gender-btn" + (row.gender === g ? " vl-gender-btn--active" : "")}
                        onClick={() => updateRow(voice.voiceURI, { gender: row.gender === g ? "" : g })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="vl-tags">
                    {VIBES.map((tag) => (
                      <button
                        key={tag}
                        className={"vl-tag" + (row.tags.includes(tag) ? " vl-tag--active" : "")}
                        onClick={() => toggleTag(voice.voiceURI, tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  <input
                    className="vl-notes"
                    type="text"
                    placeholder="Notes (optional)"
                    value={row.notes}
                    onChange={(e) => updateRow(voice.voiceURI, { notes: e.target.value })}
                  />
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <footer className="vl-footer">
        <button className="vl-export-btn" onClick={handleExport}>
          Export to clipboard
        </button>
        <button className="vl-clear-btn" onClick={handleClearProgress}>
          Clear progress
        </button>
      </footer>

      {toast && (
        <div className="vl-toast" role="status" aria-live="polite">{toast}</div>
      )}
    </div>
  );
}
