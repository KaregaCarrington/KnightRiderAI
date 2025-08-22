import express from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import cors from 'cors';
import fs from 'fs';
import path from "path";
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const upload = multer({ dest: 'tmp/' });
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let conversationHistory = [];

app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;

  const systemPrompt = `You are KITT, the Knight Industries Two Thousand, an advanced AI based on the TV show knight rider.
  You are loyal to Karega, witty but precise.
  You speak casually, use mild slang, light sarcasm, and friendly banter.
  You are also factual.
  You always keep a natural rhythm, not robotic.`;

  conversationHistory.push({ role: 'user', content: userMessage });
  if (conversationHistory.length > 40) {
          conversationHistory.shift(); // Keep history manageable
  }

  const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages
      })
  });

  const data = await response.json();
  const reply = data.choices[0].message.content;

  conversationHistory.push({ role: 'assistant', content: reply });
  res.json({ reply });
})

app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      console.log("No file uploaded");
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    console.log("Received file:", req.file);

    const tmpPath = req.file.path;
    const webmPath = path.join('tmp', req.file.originalname);
    console.log("Copying file to:", webmPath);

    fs.copyFileSync(tmpPath, webmPath);
    console.log("Copy successful");

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(webmPath),
      model: "whisper-1"
    });

    console.log("Transcription successful:", transcription.text);

    res.json({ text: transcription.text });

    fs.unlinkSync(tmpPath);
    fs.unlinkSync(webmPath);
    console.log("Cleanup done");

  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "Transcription failed" });
  }
});

app.post('/tts', async (req, res) => {
  const text = req.body.text;

  const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "ballad", // pick one and keep it consistent
      input: text
    })
  });

  const arrayBuffer = await ttsRes.arrayBuffer();
  res.set({
    "Content-Type": "audio/mpeg",
    "Content-Length": arrayBuffer.byteLength
  });
  res.send(Buffer.from(arrayBuffer));
});

app.get('/directions', async (req, res) => {
  const { origin, destination } = req.query;
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${process.env.GOOGLE_MAPS_KEY}`;

  const r = await fetch(url);
  const json = await r.json();

  const steps = json.routes[0]?.legs[0]?.steps.map(s => ({
    instruction: s.html_instructions.replace(/<[^>]+>/g, ''), // strip HTML
    distance: s.distance.text
  })) || [];

  res.json({ steps });
});

app.listen(3001, () => {
    console.log('KITT backend running on port 3001');
});