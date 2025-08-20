// src/lib/audio.ts
export async function recordUtterance(maxMs = 8000): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mr = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  return await new Promise<Blob>((resolve) => {
    const stopAll = () => stream.getTracks().forEach(t => t.stop());
    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = () => { stopAll(); resolve(new Blob(chunks, { type: "audio/webm" })); };
    mr.start();
    setTimeout(() => { if (mr.state !== "inactive") mr.stop(); }, maxMs);
  });
}
