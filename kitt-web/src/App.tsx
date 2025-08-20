// src/App.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { useWake } from "./hooks/useWake";
import { recordUtterance } from "./lib/audio";
import { chat, transcribe, tts, getDirections } from "./lib/api";
import "./kitt.css";

export default function App() {
  const [ready, setReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);

  const playQueue = useCallback(async (audios: HTMLAudioElement[]) => {
    for (const a of audios) {
      await new Promise<void>((resolve) => {
        a.onended = () => resolve();
        a.play().catch(() => resolve());
      });
    }
  }, []);

  const say = useCallback(
    async (text: string) => {
      setLog((l) => [...l, `KITT: ${text}`]);
      const voice = await tts(text);
      await playQueue([voice]);
    },
    [playQueue]
  );

  const onWake = useCallback(async () => {
  if (listening) return;
  setListening(true);
  setLog((l) => [...l, "KITT: I’m listening…"]);

  try {
    const blob = await recordUtterance(7000);
    const userText = await transcribe(blob);
    setLog((l) => [...l, `You: ${userText}`]);

    if (!userText.trim()) {
      await say("I didn’t catch that, Michael.");
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
    await say("Something went wrong capturing that.");
  } finally {
    setListening(false);
  }
}, [listening, say]);

  useWake({ onWake, enabled: wakeEnabled });

  useEffect(() => {
    // Autostart logic
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
        <div className="kitt"></div>

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

      {/* Log display */}
      <div className="kitt-log">
        {log.slice(-10).map((line, i) => (
          <div key={i} className="log-line">{line}</div>
        ))}
      </div>

      <div className="kitt-tip">
        Tip: Try “Hey KITT, navigate from 1600 Pennsylvania Ave to Times Square.”
      </div>
    </div>
  );
}

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
