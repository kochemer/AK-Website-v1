import { promises as fs, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'dotenv';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { DateTime } from 'luxon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  try {
    const buffer = readFileSync(envPath);
    let contentToParse: string;
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      contentToParse = buffer.toString('utf16le', 2);
    } else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      const leBuffer = Buffer.alloc(buffer.length - 2);
      for (let i = 2; i < buffer.length; i += 2) {
        leBuffer[i - 2] = buffer[i + 1];
        leBuffer[i - 1] = buffer[i];
      }
      contentToParse = leBuffer.toString('utf16le');
    } else if (buffer.length > 0 && buffer[1] === 0 && buffer[0] !== 0) {
      contentToParse = buffer.toString('utf16le');
    } else {
      contentToParse = buffer.toString('utf-8');
    }
    const parsed = parse(contentToParse);
    Object.assign(process.env, parsed);
  } catch (err) {
    // .env.local not found, continue
  }
}

loadEnv();

type WeeklyDigest = {
  weekLabel: string;
  topics: {
    AI_and_Strategy: { top: any[] };
    Ecommerce_Retail_Tech: { top: any[] };
    Luxury_and_Consumer: { top: any[] };
    Jewellery_Industry: { top: any[] };
  };
};

/**
 * Generate podcast script from digest
 */
async function generatePodcastScript(digest: WeeklyDigest): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Select top articles from each category (focus on Ecommerce, Jewellery, Luxury)
  const articles = [
    ...digest.topics.Ecommerce_Retail_Tech.top.slice(0, 3),
    ...digest.topics.Jewellery_Industry.top.slice(0, 2),
    ...digest.topics.Luxury_and_Consumer.top.slice(0, 2),
    ...digest.topics.AI_and_Strategy.top.slice(0, 1),
  ];

  const articlesText = articles.map((article, idx) => {
    return `${idx + 1}. ${article.title}
   Source: ${article.source}
   Summary: ${article.aiSummary || article.snippet || 'No summary available'}`;
  }).join('\n\n');

  const prompt = `You are a podcast host for "Weekly Luxury Intelligence", a podcast covering ecommerce, jewellery, luxury, and AI news.

Generate a conversational podcast script (approximately 2000-2500 words, ~12-15 minutes) covering these articles:

${articlesText}

Structure:
- Brief intro (50 words): Welcome listeners, mention this is week ${digest.weekLabel}
- Main segments covering each article (150-200 words per article)
- Brief transitions between segments
- Closing (50 words): Thank listeners, mention next week

Tone: Professional but conversational, like a business news podcast. Be clear and engaging.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a professional podcast script writer.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 4000,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Generate audio using ElevenLabs API
 */
async function generateAudioWithElevenLabs(
  text: string,
  outputPath: string
): Promise<{ success: boolean; duration?: number }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not found');
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'XFsVUrYetuzY4ZR8T3nN'; // Default voice
  const model = 'eleven_multilingual_v2';

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(audioBuffer));

    // Estimate duration (rough: ~150 words per minute)
    const wordCount = text.split(/\s+/).length;
    const duration = Math.round((wordCount / 150) * 60);

    return { success: true, duration };
  } catch (error) {
    console.error('[Podcast] ElevenLabs error:', error);
    throw error;
  }
}

/**
 * Split text into chunks that fit OpenAI TTS limit (4096 characters)
 */
function splitTextIntoChunks(text: string, maxChars: number = 4000): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 <= maxChars) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If single paragraph is too long, split by sentences
      if (paragraph.length > maxChars) {
        const sentences = paragraph.split(/[.!?]+\s+/);
        let sentenceChunk = '';
        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length + 2 <= maxChars) {
            sentenceChunk += (sentenceChunk ? '. ' : '') + sentence;
          } else {
            if (sentenceChunk) {
              chunks.push(sentenceChunk);
            }
            sentenceChunk = sentence;
          }
        }
        currentChunk = sentenceChunk;
      } else {
        currentChunk = paragraph;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Generate audio using OpenAI TTS (fallback)
 * Handles long scripts by splitting into chunks
 */
async function generateAudioWithOpenAI(
  text: string,
  outputPath: string
): Promise<{ success: boolean; duration?: number }> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // Split text into chunks if needed
    const chunks = splitTextIntoChunks(text);
    console.log(`[Podcast] Splitting script into ${chunks.length} chunks for OpenAI TTS...`);

    const audioBuffers: Buffer[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[Podcast] Generating chunk ${i + 1}/${chunks.length}...`);
      const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: chunks[i],
      });

      const chunkBuffer = Buffer.from(await response.arrayBuffer());
      audioBuffers.push(chunkBuffer);
    }

    // Concatenate all audio buffers
    const finalBuffer = Buffer.concat(audioBuffers);
    await fs.writeFile(outputPath, finalBuffer);

    // Estimate duration
    const wordCount = text.split(/\s+/).length;
    const duration = Math.round((wordCount / 150) * 60);

    return { success: true, duration };
  } catch (error) {
    console.error('[Podcast] OpenAI TTS error:', error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let weekLabel: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--week' && i + 1 < args.length) {
      weekLabel = args[i + 1];
      break;
    }
    if (args[i].startsWith('--week=')) {
      weekLabel = args[i].split('=')[1];
      break;
    }
  }

  if (!weekLabel) {
    const now = DateTime.now().setZone('Europe/Copenhagen');
    const prevWeek = now.minus({ weeks: 1 });
    const weekNum = prevWeek.weekNumber.toString().padStart(2, '0');
    weekLabel = `${prevWeek.year}-W${weekNum}`;
  }

  console.log(`[Podcast] Generating podcast for ${weekLabel}...`);

  // Load digest
  const digestPath = path.join(__dirname, '../data/digests', `${weekLabel}.json`);
  let digest: WeeklyDigest;
  try {
    const digestContent = await fs.readFile(digestPath, 'utf-8');
    digest = JSON.parse(digestContent);
  } catch (error) {
    console.error(`Error: Could not load digest from ${digestPath}`);
    console.error(`Make sure you've run buildWeeklyDigest for week ${weekLabel} first.`);
    process.exit(1);
  }

  // Generate script
  console.log('[Podcast] Generating script...');
  const script = await generatePodcastScript(digest);
  console.log(`[Podcast] Script generated (${script.split(/\s+/).length} words)`);

  // Save script
  const weekDir = path.join(__dirname, '../data/weeks', weekLabel);
  await fs.mkdir(weekDir, { recursive: true });
  const scriptPath = path.join(weekDir, 'podcast-script.txt');
  await fs.writeFile(scriptPath, script, 'utf-8');
  console.log(`[Podcast] Script saved to ${scriptPath}`);

  // Generate audio
  const audioPath = path.join(__dirname, '../public/podcast', `${weekLabel}.mp3`);
  await fs.mkdir(path.dirname(audioPath), { recursive: true });

  let audioResult: { success: boolean; duration?: number; model?: string; voice?: string };
  
  // Try ElevenLabs first
  try {
    console.log('[Podcast] Generating audio with ElevenLabs...');
    const result = await generateAudioWithElevenLabs(script, audioPath);
    audioResult = {
      success: result.success,
      duration: result.duration,
      model: 'eleven_multilingual_v2',
      voice: process.env.ELEVENLABS_VOICE_ID || 'XFsVUrYetuzY4ZR8T3nN',
    };
    console.log(`[Podcast] ✓ Audio generated with ElevenLabs (${result.duration}s)`);
  } catch (error) {
    console.warn('[Podcast] ElevenLabs failed, falling back to OpenAI TTS...');
    console.warn(`[Podcast] Error: ${(error as Error).message}`);
    
    // Fallback to OpenAI TTS
    try {
      const result = await generateAudioWithOpenAI(script, audioPath);
      audioResult = {
        success: result.success,
        duration: result.duration,
        model: 'tts-1',
        voice: 'alloy',
      };
      console.log(`[Podcast] ✓ Audio generated with OpenAI TTS (${result.duration}s)`);
    } catch (fallbackError) {
      console.error('[Podcast] ✗ Both ElevenLabs and OpenAI TTS failed');
      console.error(`[Podcast] OpenAI TTS error: ${(fallbackError as Error).message}`);
      process.exit(1);
    }
  }

  // Save metadata
  const podcastMetadata = {
    week: weekLabel,
    audioPath: `/podcast/${weekLabel}.mp3`,
    model: audioResult.model || 'unknown',
    voice: audioResult.voice || 'unknown',
    generatedAt: new Date().toISOString(),
    duration: audioResult.duration,
  };

  const metadataPath = path.join(weekDir, 'podcast.json');
  await fs.writeFile(metadataPath, JSON.stringify(podcastMetadata, null, 2), 'utf-8');
  console.log(`[Podcast] ✓ Metadata saved to ${metadataPath}`);
  console.log(`[Podcast] ✓ Podcast generation complete!`);
}

main().catch((error) => {
  console.error('[Podcast] Fatal error:', error);
  process.exit(1);
});
