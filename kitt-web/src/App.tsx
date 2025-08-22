// src/App.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useWake } from "./hooks/useWake";
import { recordUtteranceUntilSilence } from "./lib/audio";
import { chat, transcribe, tts, getDirections } from "./lib/api";
import "./kitt.css";

export default function App() {
  const [ready, setReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const [barHeights, setBarHeights] = useState([0, 0, 0]); // initial heights
  const voiceBarsRef = useRef<HTMLDivElement>(null);

  const animateBars = useCallback(() => {

    const interval = setInterval(() => {
      const middle = 0.1 + Math.random(); // ensure middle is tallest
      const side1 = middle * 0.5    // 0.5–1.3
      const side2 = middle * 0.5 
      
      setBarHeights([side1, middle, side2]);
      console.log("Animating:", side1, middle, side2);
    }, 100);
    
    return () => clearInterval(interval);
  }, [speaking]);

  useEffect(() => {
    if (!speaking) {
      const idleInterval = setInterval(() => {
        setBarHeights([0, 0, 0]);
      }, 800);
      return () => clearInterval(idleInterval);
    }
  }, [speaking]);

  const playQueue = useCallback(async (audios: HTMLAudioElement[]) => {
  for (const a of audios) {
    setSpeaking(true);
    const stopAnim = animateBars();
    await new Promise<void>((resolve) => {
      a.onended = () => resolve();
      a.play().catch(() => resolve());
    });
    if (stopAnim) stopAnim();
    setSpeaking(false);
    setBarHeights([0, 0, 0]); // reset bars
  }
}, [animateBars]);

  const phoneticMap: Record<string, string> = {
    "Karega": "Kuh-ree-guh", // name pronunciation
  };

  const applyPhonetics = useCallback((text: string) => {
    let t = text;
    for (const [word, phonetic] of Object.entries(phoneticMap)) {
      t = t.replace(new RegExp(`\\b${word}\\b`, "gi"), phonetic);
    }
    return t;
  }, []);

  const say = useCallback(
    async (text: string) => {
      setLog((l) => [...l, `KITT: ${text}`]);
      const phoneticText = applyPhonetics(text);
      const voice = await tts(phoneticText);
      await playQueue([voice]);
    },
    [playQueue, applyPhonetics]
  );

  const onWake = useCallback(async () => {
    if (listening) return;
    setListening(true);
    setLog((l) => [...l, "KITT: I’m listening…"]);

    try {
      const blob = await recordUtteranceUntilSilence();
      const userText = await transcribe(blob);
      setLog((l) => [...l, `You: ${userText}`]);

      if (!userText.trim()) {
        await say("I didn’t catch that Karega.");
        return;
      }

      const nav = parseDirections(userText);
      if (nav) {
        await handleDirections(nav.origin, nav.destination, say);
      } else {
        const reply = await chat(makeSpeechy(userText));
        await say(reply);
      }
    } catch (e) {
      console.error("Error in onWake:", e);
      await say("Something went wrong capturing that.");
    } finally {
      setListening(false);
    }
  }, [listening, say]);

  useWake({ onWake, enabled: wakeEnabled });

  useEffect(() => {
    (async () => {
      try {
        await navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((s) => s.getTracks().forEach((t) => t.stop()));
      } catch {}
      setReady(true);
      setWakeEnabled(true);
      setLog((l) => [...l, "KITT: Online and waiting for your wake phrase."]);
    })();
  }, []);

  return (
    <div>
      {/* Left Panel */}
      <section>
        <a href="#">AIR</a>
        <a href="#">OIL</a>
        <a href="#">P1</a>
        <a href="#">P2</a>
      </section>

      {/* Main Panel */}
      <header>
        <div className="kitt">
          <div className="voicebox">
            {barHeights.map((litRatio, barIndex) => {
              const totalSegments = 20;
              const litSegments = Math.round(litRatio * totalSegments); // e.g. 0.5 => 3 lit
              return (
                <div key={barIndex} className="voicebar">
                  {[...Array(totalSegments)].map((_, segmentIndex) => {
                    const isLit = Math.abs(segmentIndex - totalSegments / 2) < litSegments / 2;
                    return (
                      <div
                        key={segmentIndex}
                        className={`bar-segment ${isLit ? "lit" : ""}`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bottom">
          <button id="one">AUTO<br />CRUISE</button>
          <button id="two">NORMAL CRUISE</button>
          <button id="three" onClick={onWake}>SPEAK</button>
        </div>
      </header>

      {/* Right Panel */}
      <section>
        <a href="#">S1</a>
        <a href="#">S2</a>
        <a href="#">P3</a>
        <a href="#">P4</a>
      </section>

    </div>
  );
}

// Directions helpers (unchanged)
function parseDirections(text: string): { origin: string; destination: string } | null {
  const t = text.toLowerCase();
  const m1 = t.match(/(?:navigate|directions|route)\s+(?:from\s+(.+?)\s+to\s+(.+)|to\s+(.+))/i);
  if (!m1) return null;
  if (m1[1] && m1[2]) return { origin: m1[1], destination: m1[2] };
  if (m1[3]) return { origin: "current location", destination: m1[3] };
  return null;
}

async function handleDirections(origin: string, destination: string, say: (t: string) => Promise<void>) {
  await say(`Plotting a course from ${origin} to ${destination}.`);
  const { steps } = await getDirections(origin, destination);
  if (!steps.length) {
    await say("I couldn’t retrieve directions.");
    return;
  }

  await say(`I have the route. Here's the first few steps.`);
  const first = steps.slice(0, 3);
  for (const s of first) {
    await say(`${s.instruction}. Then ${s.distance}.`);
  }
  await say("Say 'Hey KITT, continue' when you're ready for the next steps.");
}

function makeSpeechy(user: string) {
  return user.replace(/[,]/g, " — ");
}
