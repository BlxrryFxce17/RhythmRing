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

  // Check API key first
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

    // Determine MIME type — MediaRecorder often sends audio/webm
    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      // Guess from file extension
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

    // Convert file to buffer and save to temp
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100) {
      return NextResponse.json(
        { error: 'Audio file is too small / empty. Please record for longer.' },
        { status: 400 }
      );
    }

    const tempDir = os.tmpdir();
    const extension = file.name?.split('.').pop() || 'webm';
    tempFilePath = path.join(tempDir, `upload-${Date.now()}.${extension}`);
    await fs.writeFile(tempFilePath, buffer);

    // Upload to Gemini via File Manager
    const uploadResponse = await fileManager.uploadFile(tempFilePath, {
      mimeType,
      displayName: 'Contribution Snippet',
    });

    // Wait for processing
    let fileState = await fileManager.getFile(uploadResponse.file.name);
    let waitAttempts = 0;
    while (fileState.state === 'PROCESSING' && waitAttempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      fileState = await fileManager.getFile(uploadResponse.file.name);
      waitAttempts++;
    }

    if (fileState.state === 'FAILED') {
      throw new Error('Gemini could not process the audio file. Try a different format or longer recording.');
    }

    const prompt = `
      You are a world-class music producer and sound designer. 
      Analyze this audio snippet recorded by a user for a collaborative music project called RhythmRing.
      
      Identify:
      1. Musical Role: Is it a 'beat' (percussive), 'melody' (tonal), 'vocal', or 'texture' (ambient/noise)?
      2. Description: A short, catchy description of the sound (e.g., "Crisp finger snap", "Low-fi desk tap", "Breathy hum").
      3. Suggested Tempo: Estimated BPM if applicable.
      4. Mood: One word (e.g., Chill, Energetic, Dark, Bright).
      
      Return ONLY a JSON object with this exact format:
      {
        "role": "beat" | "melody" | "vocal" | "texture",
        "description": "...",
        "bpm": number,
        "mood": "..."
      }
    `;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

    let parsedData;
    try {
      parsedData = JSON.parse(textResponse);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', textResponse);
      throw new Error(`Gemini returned invalid JSON. Raw: ${textResponse.substring(0, 200)}`);
    }

    // Cleanup uploaded file from Gemini
    try {
      await fileManager.deleteFile(uploadResponse.file.name);
    } catch (e) {
      // Non-critical
    }

    // Cleanup temp file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {}
    }

    return NextResponse.json(parsedData);
  } catch (error) {
    console.error('Error analyzing audio:', error);

    // Cleanup temp file on error
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {}
    }

    // Return the ACTUAL error instead of a silent fallback
    return NextResponse.json(
      {
        error: error.message || 'Unknown error during analysis',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
