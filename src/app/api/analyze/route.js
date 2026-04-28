import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Configure Gemini Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || '');

export async function POST(request) {
  let tempFilePath = null;
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const isAudio = file.type.startsWith('audio/');
    
    if (!isAudio) {
      // For the sake of the hackathon, we'll try to process it as audio if it's a blob
      if (file.type === 'application/octet-stream') {
         // Assume audio if coming from MediaRecorder
      } else {
        return NextResponse.json({ error: 'Unsupported file type. Please upload audio.' }, { status: 400 });
      }
    }

    // Convert file to buffer and save it to a temporary file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tempDir = os.tmpdir();
    const extension = file.name?.split('.').pop() || 'wav';
    tempFilePath = path.join(tempDir, `upload-${Date.now()}.${extension}`);
    await fs.writeFile(tempFilePath, buffer);

    // Upload to Gemini via File Manager
    const uploadResponse = await fileManager.uploadFile(tempFilePath, {
      mimeType: file.type === 'application/octet-stream' ? 'audio/wav' : file.type,
      displayName: "Contribution Snippet",
    });
    
    // Wait for processing
    let fileState = await fileManager.getFile(uploadResponse.file.name);
    while (fileState.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      fileState = await fileManager.getFile(uploadResponse.file.name);
    }

    if (fileState.state === 'FAILED') {
      throw new Error('Audio processing failed in Gemini API.');
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
          fileUri: uploadResponse.file.uri
        }
      },
      { text: prompt },
    ]);

    let textResponse = result.response.text();
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(textResponse);

    // Cleanup
    await fileManager.deleteFile(uploadResponse.file.name);
    if (tempFilePath) await fs.unlink(tempFilePath);

    return NextResponse.json(parsedData);

  } catch (error) {
    console.error('Error analyzing audio:', error);
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {}
    }
    
    // Fallback for demo if API fails or key is missing
    return NextResponse.json({ 
      role: "beat", 
      description: "Sample Rhythm (Demo Fallback)", 
      bpm: 120, 
      mood: "Steady" 
    });
  }
}
