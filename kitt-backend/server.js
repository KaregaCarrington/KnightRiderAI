import express from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import cors from 'cors';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const upload = multer({ dest: 'tmp/' });
app.use(cors());
app.use(express.json());

let conversationHistory = [];

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;

    const systemPrompt = `You are KITT, the Knight Industries Two Thousand, an advanced AI.
    You are loyal to Karega, witty but precise.
    You speak casually, use mild slang, light sarcasm, and friendly banter.
    You are also factual.
    You always keep a natural rhythm, not robotic.`;

    conversationHistory.push({ role: 'user', content: userMessage });
    if (conversationHistory.length > 20) {
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
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path));
    formData.append('model', 'gpt-4o-mini-transcribe');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData
    });

    const data = await response.json();
    res.json({ text: data.text });
})

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
      voice: "alloy", // pick one and keep it consistent
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