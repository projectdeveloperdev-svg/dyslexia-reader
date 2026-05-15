/**
 * Converts an array of SpeechSynthesisVoice objects into labelled entries.
 *
 * Returns: Array<{ voice: SpeechSynthesisVoice, label: string }>
 *
 * Label format:  "[Accent] Language (Online|Offline) [— Voice N]"
 * Examples:
 *   "en-gb-x-gba-local"   → "UK English (Offline) — Voice 1"
 *   "en-us-x-tpc-network" → "US English (Online) — Voice 1"
 *   "fr-fr-x-vlf-local"   → "French (Offline)"
 *
 * Fallback: if a voiceURI cannot be parsed, the raw voiceURI is used as the
 * label. Never throws; never silently hides voices.
 */

const LANGUAGES = {
  af: "Afrikaans",
  ar: "Arabic",
  bg: "Bulgarian",
  bn: "Bengali",
  cs: "Czech",
  cy: "Welsh",
  da: "Danish",
  de: "German",
  el: "Greek",
  en: "English",
  es: "Spanish",
  et: "Estonian",
  eu: "Basque",
  fa: "Persian",
  fi: "Finnish",
  fil: "Filipino",
  fr: "French",
  gl: "Galician",
  gu: "Gujarati",
  he: "Hebrew",
  hi: "Hindi",
  hr: "Croatian",
  hu: "Hungarian",
  hy: "Armenian",
  id: "Indonesian",
  is: "Icelandic",
  it: "Italian",
  ja: "Japanese",
  ka: "Georgian",
  kn: "Kannada",
  ko: "Korean",
  lt: "Lithuanian",
  lv: "Latvian",
  mk: "Macedonian",
  ml: "Malayalam",
  mr: "Marathi",
  ms: "Malay",
  nb: "Norwegian",
  nl: "Dutch",
  pa: "Punjabi",
  pl: "Polish",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  sk: "Slovak",
  sl: "Slovenian",
  sq: "Albanian",
  sr: "Serbian",
  sv: "Swedish",
  sw: "Swahili",
  ta: "Tamil",
  te: "Telugu",
  th: "Thai",
  tr: "Turkish",
  uk: "Ukrainian",
  ur: "Urdu",
  vi: "Vietnamese",
  zh: "Chinese",
  zu: "Zulu",
};

const ACCENTS = {
  au: "Australian",
  be: "Belgian",
  br: "Brazilian",
  ca: "Canadian",
  cn: "Chinese",
  gb: "UK",
  hk: "Hong Kong",
  ie: "Irish",
  in: "Indian",
  mx: "Mexican",
  ng: "Nigerian",
  nz: "New Zealand",
  ph: "Filipino",
  pk: "Pakistani",
  sg: "Singaporean",
  tw: "Taiwanese",
  us: "US",
  za: "South African",
};

/**
 * Parses a voiceURI string into a base label and online/offline marker.
 * Returns { base, onlineLabel } — both strings.
 * Throws if the URI is empty or unparseable (caller handles fallback).
 */
function parseURI(uri) {
  const lower = uri.toLowerCase();
  const parts = lower.split("-");

  if (parts.length < 1 || !parts[0]) throw new Error("empty uri");

  const lang = parts[0];
  const country = parts[1] ?? "";

  const langName = LANGUAGES[lang] ?? lang.toUpperCase();
  const accentName = ACCENTS[country] ?? "";

  const isOffline = lower.includes("-local");
  const isOnline = lower.includes("-network");
  const onlineLabel = isOffline ? "(Offline)" : isOnline ? "(Online)" : "";

  const base = accentName ? `${accentName} ${langName}` : langName;
  return { base, onlineLabel };
}

/**
 * labelVoices(voices)
 *
 * Takes a filtered/sorted array of SpeechSynthesisVoice objects and returns
 * a parallel array of { voice, label } pairs with numbered suffixes for
 * voices that would otherwise share the same label.
 */
export function labelVoices(voices) {
  // Step 1 — parse every voice; fall back to raw voiceURI on error.
  const parsed = voices.map((voice) => {
    try {
      const { base, onlineLabel } = parseURI(voice.voiceURI);
      const key = onlineLabel ? `${base} ${onlineLabel}` : base;
      return { voice, key };
    } catch {
      return { voice, key: voice.voiceURI };
    }
  });

  // Step 2 — count how many voices share each key.
  const counts = {};
  for (const { key } of parsed) {
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // Step 3 — append "— Voice N" only where duplicates exist.
  const seen = {};
  return parsed.map(({ voice, key }) => {
    if (counts[key] > 1) {
      seen[key] = (seen[key] ?? 0) + 1;
      return { voice, label: `${key} — Voice ${seen[key]}` };
    }
    return { voice, label: key };
  });
}
