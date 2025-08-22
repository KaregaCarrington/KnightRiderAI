// src/lib/audio.ts
export async function recordUtteranceUntilSilence(
  maxMs = 200000,  // max recording time (fallback)
  silenceDuration = 1500, // ms of silence before stopping
  volumeThreshold = 0.05  // threshold for silence detection (adjust experimentally)
): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  const mr = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  let silenceStart: number | null = null;

  return await new Promise<Blob>((resolve, reject) => {
    const stopAll = () => {
      stream.getTracks().forEach(t => t.stop());
      audioContext.close();
    };

    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = () => {
      stopAll();
      resolve(new Blob(chunks, { type: "audio/webm" }));
    };

    mr.start();

    const checkSilence = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume (0-255)
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;

      if (avg < volumeThreshold) {
        // Volume below threshold — possible silence
        if (silenceStart === null) silenceStart = performance.now();
        else if (performance.now() - silenceStart > silenceDuration) {
          if (mr.state !== "inactive") mr.stop();
          return;
        }
      } else {
        // Volume above threshold — reset silence timer
        silenceStart = null;
      }

      // If max time exceeded, stop anyway
      if (performance.now() - startTime > maxMs) {
        if (mr.state !== "inactive") mr.stop();
        return;
      }

      requestAnimationFrame(checkSilence);
    };

    const startTime = performance.now();
    requestAnimationFrame(checkSilence);
  });
}

