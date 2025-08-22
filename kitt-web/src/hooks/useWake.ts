// src/hooks/useWake.ts
import { useEffect, useRef } from "react";

type WakeOpts = {
  onWake: () => void;
  wakeRegex?: RegExp;
  lang?: string;
  enabled: boolean;
};

export function useWake({
  onWake,
  wakeRegex = /\bhey kitt\b|\bhey kit\b|\byo kitt\b/i,
  lang = "en-US",
  enabled,
}: WakeOpts) {
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false; // single phrase
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (ev: any) => {
      let text = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        text += ev.results[i][0].transcript;
      }

      console.log("[Wake Detection] Heard:", text);

      if (wakeRegex.test(text)) {
        console.log("[Wake Detection] Wake word matched!");
        onWake();
      }
    };

    recognition.onerror = (err: any) => {
      console.warn("[Wake Detection] Error:", err.error);
    };

    recognition.onend = () => {
      // Don’t auto-restart to avoid Chrome start/stop conflicts
      console.log("[Wake Detection] Listening ended. Say 'SPEAK' to retry.");
    };

    // Only start listening after a user gesture
    const startRecognition = () => {
      try {
        recognition.start();
        console.log("[Wake Detection] Started listening (user gesture required)");
      } catch (err) {
        console.warn(
          "[Wake Detection] Cannot start recognition, user gesture required",
          err
        );
      }
    };

    recognitionRef.current.startListening = startRecognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, [enabled, lang, wakeRegex, onWake]);

  return {
    startListening: () => recognitionRef.current?.startListening?.(),
  };
}
