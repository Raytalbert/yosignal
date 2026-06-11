import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeSpeech } from "@/lib/tts.functions";
import { prepareTextForSpeech } from "@/lib/prepare-speech-text";

const MALE_VOICE_PATTERNS = [
  /Aaron/i,
  /Arthur/i,
  /Daniel/i,
  /Alex/i,
  /Fred/i,
  /Gordon/i,
  /James/i,
  /Oliver/i,
  /Tom/i,
  /Google.*English.*male/i,
  /Microsoft.*Guy/i,
  /Microsoft.*Ryan/i,
  /Microsoft.*David/i,
  /Microsoft.*Mark/i,
  /en-us.*male/i,
  /en-gb.*male/i,
];

function pickMaleVoice(voices: SpeechSynthesisVoice[]) {
  const en = voices.filter((v) => /^en(-|_)/i.test(v.lang));
  for (const pattern of MALE_VOICE_PATTERNS) {
    const match = en.find((v) => pattern.test(v.name));
    if (match) return match;
  }
  return en.find((v) => !/Samantha|Victoria|Karen|Moira|Fiona|Zira|female/i.test(v.name)) ?? en[0] ?? null;
}

export function useNaturalVoice(enabled: boolean) {
  const synthesize = useServerFn(synthesizeSpeech);
  const fallbackVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const loadVoices = () => {
      fallbackVoiceRef.current = pickMaleVoice(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) stop();
    return stop;
  }, [enabled, stop]);

  const speakBrowserFallback = useCallback((clean: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = 0.94;
      u.pitch = 0.92;
      if (fallbackVoiceRef.current) u.voice = fallbackVoiceRef.current;
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    } catch {
      setSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!enabled) return;
      const clean = prepareTextForSpeech(text);
      if (!clean) return;

      stop();
      setSpeaking(true);

      try {
        const res = await synthesize({ data: { text: clean } });
        const audio = new Audio(`data:${res.mimeType};base64,${res.audio}`);
        audio.setAttribute("playsinline", "true");
        audio.preload = "auto";
        audioRef.current = audio;
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => speakBrowserFallback(clean);
        await audio.play();
      } catch {
        speakBrowserFallback(clean);
      }
    },
    [enabled, stop, synthesize, speakBrowserFallback],
  );

  return { speak, stop, speaking };
}
