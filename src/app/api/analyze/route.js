import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Configure Gemini Client
const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);
const fileManager = new GoogleAIFileManager(API_KEY);

export async function POST(request) {
  let tempFilePath = null;

  if (!API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not set. Add it to your environment variables.' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      const ext = (file.name?.split('.').pop() || '').toLowerCase();
      const mimeMap = {
        webm: 'audio/webm',
        ogg: 'audio/ogg',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        m4a: 'audio/mp4',
        flac: 'audio/flac',
      };
      mimeType = mimeMap[ext] || 'audio/webm';
    }

    const isAudio = mimeType.startsWith('audio/');
    if (!isAudio) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mimeType}. Please upload audio.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100) {
      return NextResponse.json(
        { error: 'Audio file is too small / empty.' },
        { status: 400 }
      );
    }

    const tempDir = os.tmpdir();
    const extension = file.name?.split('.').pop() || 'webm';
    tempFilePath = path.join(tempDir, `upload-${Date.now()}.${extension}`);
    await fs.writeFile(tempFilePath, buffer);

    const uploadResponse = await fileManager.uploadFile(tempFilePath, {
      mimeType,
      displayName: 'Contribution Snippet',
    });

    let fileState = await fileManager.getFile(uploadResponse.file.name);
    let waitAttempts = 0;
    while (fileState.state === 'PROCESSING' && waitAttempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      fileState = await fileManager.getFile(uploadResponse.file.name);
      waitAttempts++;
    }

    if (fileState.state === 'FAILED') {
      throw new Error('Gemini could not process the audio file.');
    }

    const prompt = `
      You are a world-class music producer. 
      Analyze this audio snippet.
      
      Identify:
      1. Musical Role: 'beat', 'melody', 'vocal', or 'texture'.
      2. Description: Short catchy name (e.g., "Crisp Snap").
      3. Suggested Tempo: BPM.
      4. Mood: One word.
      
      Return ONLY JSON:
      {
        "role": "beat" | "melody" | "vocal" | "texture",
        "description": "...",
        "bpm": number,
        "mood": "..."
      }
    `;

    // USING THE CORRECT 2026 STABLE MODEL
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResponse.file.mimeType,
          fileUri: uploadResponse.file.uri,
        },
      },
      { text: prompt },
    ]);

    let textResponse = result.response.text();
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsedData = JSON.parse(textResponse);

    try {
      await fileManager.deleteFile(uploadResponse.file.name);
    } catch (e) {}

    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {}
    }

    return NextResponse.json(parsedData);

  } catch (error) {
    console.error('Error analyzing audio:', error);

    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {}
    }

    // FALLBACK FOR QUOTA LIMITS OR SERVER OVERLOAD (503)
    const errorStr = error.message || "";
    if (errorStr.includes('429') || errorStr.includes('503') || errorStr.includes('quota') || errorStr.includes('limit') || errorStr.includes('Unavailable')) {
      return NextResponse.json({
        role: "beat",
        description: "Sound Snippet (Local Fallback)",
        bpm: 120,
        mood: "Neutral",
        isFallback: true
      });
    }

    return NextResponse.json(
      { error: error.message || 'Unknown error during analysis' },
      { status: 500 }
    );
  }
}
