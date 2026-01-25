/**
 * ElevenLabs Text-to-Speech module for podcast generation
 * 
 * Generates speech audio using ElevenLabs API with cloned voice.
 * Generates audio for a single text chunk - chunking and concatenation
 * are handled by the calling script.
 */

import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

export interface GenerateSpeechOptions {
  text: string;
  voiceId: string;
  outputPath: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface GenerateSpeechResult {
  outputPath: string;
  duration?: number;
}

/**
 * Generate speech audio for a single text chunk using ElevenLabs TTS API
 * 
 * @param options - Configuration options
 * @returns Path to generated audio file
 */
export async function generateSpeech(options: GenerateSpeechOptions): Promise<GenerateSpeechResult> {
  const {
    text,
    voiceId,
    outputPath,
    model = 'eleven_multilingual_v2',
    stability = 0.4,
    similarityBoost = 0.8,
    style = 0.4,
    useSpeakerBoost = true,
  } = options;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set in environment variables. Please add it to .env.local');
  }

  if (!voiceId) {
    throw new Error('ELEVENLABS_VOICE_ID is not set in environment variables. Please add it to .env.local');
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: model,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: useSpeakerBoost,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    // Save audio file
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(outputPath, buffer);

    return {
      outputPath,
    };
  } catch (error: any) {
    throw new Error(`Failed to generate speech: ${error.message}`);
  }
}
