// src/hooks/useWake.ts
import { useEffect, useRef } from "react";

type WakeOpts = { wakeRegex?: RegExp; lang?: string; enabled?: boolean; onWake: () => void; };

export function useWake({
  onWake,
  wakeRegex = /\bhey kitt\b|\bhey kit\b|\byo kitt\b/i,
  lang = "en-US",
  enabled = false,
}: WakeOpts) {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || !SpeechRecognition) {
      console.warn("SpeechRecognition not supported or disabled");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (ev: any) => {
      let text = "";
      for (let i = ev.resultIndex; i < ev.results.length; ++i) {
        text += ev.results[i][0].transcript;
      }

      console.log("[Wake Detection] Heard:", text);

      if (wakeRegex.test(text)) {
        console.log("[Wake Detection] Wake word matched!");
        onWake();
      }
    };

    recognition.onend = () => {
      try {
        recognition.start(); // restart on end
      } catch {
        console.warn("SpeechRecognition failed to restart");
      }
    };

    try {
      recognition.start();
      console.log("[Wake Detection] Started listening");
    } catch {
      console.warn("SpeechRecognition failed to start");
    }

    return () => {
      try {
        recognition.stop();
        console.log("[Wake Detection] Stopped");
      } catch {}
    };
  }, [enabled, lang, onWake, wakeRegex]);
}
