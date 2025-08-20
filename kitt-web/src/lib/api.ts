// src/lib/api.ts
export async function transcribe(audioBlob: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", audioBlob, "utterance.webm");
  const r = await fetch("http://localhost:3001/transcribe", { method: "POST", body: form });
  const j = await r.json();
  return j.text || "";
}

export async function chat(message: string) {
  const r = await fetch("http://localhost:3001/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });
  const j = await r.json();
  return j.reply as string;
}

export async function tts(text: string): Promise<HTMLAudioElement> {
  const r = await fetch("http://localhost:3001/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  const buf = await r.arrayBuffer();
  const blob = new Blob([buf], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  return audio;
}

export async function getDirections(origin: string, destination: string) {
  const url = `http://localhost:3001/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
  const r = await fetch(url);
  return r.json() as Promise<{ steps: { instruction: string; distance: string }[] }>;
}
