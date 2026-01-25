/**
 * Podcast Voice Test Script
 * 
 * Generates a short audio clip (60-90 seconds) using ElevenLabs TTS
 * to quickly validate voice quality before generating full episodes.
 * 
 * Usage: npm run podcast:voice-test
 */

import { promises as fs, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'dotenv';

// --- Environment Variable Loading for CLI ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
  // Ignore if .env.local doesn't exist
}

// Check for ElevenLabs credentials
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

if (!ELEVENLABS_API_KEY) {
  console.error('Error: ELEVENLABS_API_KEY is not set in environment variables. Please add it to .env.local');
  process.exit(1);
}

if (!ELEVENLABS_VOICE_ID) {
  console.error('Error: ELEVENLABS_VOICE_ID is not set in environment variables. Please add it to .env.local');
  process.exit(1);
}

interface DigestArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: string;
  snippet?: string;
  aiSummary?: string;
}

interface WeeklyDigest {
  weekLabel: string;
  topics: {
    AI_and_Strategy: { total: number; top: DigestArticle[] };
    Ecommerce_Retail_Tech: { total: number; top: DigestArticle[] };
    Luxury_and_Consumer: { total: number; top: DigestArticle[] };
    Jewellery_Industry: { total: number; top: DigestArticle[] };
  };
  keyThemes?: string[];
  oneSentenceSummary?: string;
}

/**
 * Get the latest week digest
 */
async function getLatestDigest(): Promise<WeeklyDigest | null> {
  try {
    const digestsDir = path.join(__dirname, '../data/digests');
    const files = await fs.readdir(digestsDir);
    const weekLabels = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .filter(label => /^\d{4}-W\d{1,2}$/.test(label))
      .sort((a, b) => {
        const [yearA, weekA] = a.split('-W').map(Number);
        const [yearB, weekB] = b.split('-W').map(Number);
        if (yearA !== yearB) return yearB - yearA;
        return weekB - weekA;
      });
    
    if (weekLabels.length === 0) {
      return null;
    }
    
    const latestWeek = weekLabels[0];
    const digestPath = path.join(digestsDir, `${latestWeek}.json`);
    const raw = await fs.readFile(digestPath, 'utf-8');
    return JSON.parse(raw) as WeeklyDigest;
  } catch (err: any) {
    console.warn(`[Voice Test] Could not load latest digest: ${err.message}`);
    return null;
  }
}

/**
 * Generate a short test script (60-90 seconds)
 */
function generateTestScript(digest: WeeklyDigest | null): string {
  // Pick one article from the latest digest (prefer first available)
  let selectedArticle: DigestArticle | null = null;
  let articleCategory = '';
  
  if (digest) {
    // Try to get an article from any category
    const categories = [
      { key: 'AI_and_Strategy', label: 'Artificial Intelligence News' },
      { key: 'Ecommerce_Retail_Tech', label: 'E-commerce & Retail Tech' },
      { key: 'Luxury_and_Consumer', label: 'Fashion & Luxury' },
      { key: 'Jewellery_Industry', label: 'Jewellery Industry' },
    ];
    
    for (const cat of categories) {
      const articles = digest.topics[cat.key as keyof typeof digest.topics]?.top || [];
      if (articles.length > 0) {
        selectedArticle = articles[0];
        articleCategory = cat.label;
        break;
      }
    }
  }
  
  // Generate test script
  const intro = `Welcome to Luxury Intelligence. This is a voice test to validate the audio quality and naturalness of our podcast narration. We're checking tone, pacing, and overall realism.`;
  
  let commentary = '';
  if (selectedArticle) {
    const summary = selectedArticle.aiSummary || selectedArticle.snippet || selectedArticle.title;
    commentary = `Let's take a look at a story from ${articleCategory}. According to ${selectedArticle.source}, ${selectedArticle.title}. ${summary ? summary.substring(0, 200) : 'This story highlights important developments in the industry.'} This is the kind of content we'll be covering in our weekly intelligence briefs.`;
  } else {
    commentary = `In a typical episode, we'd be discussing the latest developments in artificial intelligence, e-commerce technology, luxury markets, and the jewellery industry. Each week, we curate the most important stories and provide context and analysis for professionals in these fields.`;
  }
  
  const transition = `That's a quick sample of what you can expect. The full episodes will be longer, with deeper analysis and multiple stories across all our categories.`;
  
  const closing = `Thanks for listening to this voice test. If the audio quality sounds good, we're ready to generate full weekly episodes.`;
  
  return `${intro} ${commentary} ${transition} ${closing}`;
}

/**
 * Generate audio using ElevenLabs
 */
async function generateTestAudio(script: string): Promise<string> {
  const { generateSpeech } = await import('../podcast/tts/elevenlabs');
  
  const publicDir = path.join(__dirname, '../public/podcast');
  await fs.mkdir(publicDir, { recursive: true });
  const outputPath = path.join(publicDir, 'voice-test.mp3');
  
  console.log(`[TTS] Generating audio...`);
  
  await generateSpeech({
    text: script,
    voiceId: ELEVENLABS_VOICE_ID!, // Non-null assertion: we already validated above
    outputPath,
    model: 'eleven_multilingual_v2',
    stability: 0.4,
    similarityBoost: 0.8,
    style: 0.4,
    useSpeakerBoost: true,
  });
  
  console.log(`[Podcast] Generated voice test clip using ElevenLabs voice ${ELEVENLABS_VOICE_ID}`);
  
  return outputPath;
}

/**
 * Main function
 */
async function main() {
  console.log('[Voice Test] Generating podcast voice test clip...\n');
  
  // Get latest digest (optional - for realistic article commentary)
  const digest = await getLatestDigest();
  if (digest) {
    console.log(`[Voice Test] Using latest digest: ${digest.weekLabel}`);
  } else {
    console.log('[Voice Test] No digest found, using generic test script');
  }
  
  // Generate test script
  const script = generateTestScript(digest);
  const wordCount = script.split(/\s+/).length;
  const estimatedSeconds = Math.round(wordCount / 2.5); // ~150 words/min = 2.5 words/sec
  console.log(`[Voice Test] Test script: ${wordCount} words (~${estimatedSeconds} seconds)\n`);
  
  // Generate audio
  const outputPath = await generateTestAudio(script);
  
  // Get file stats
  const stats = await fs.stat(outputPath);
  const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
  
  console.log(`\n✓ Voice test clip generated successfully!`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Size: ${fileSizeMB} MB`);
  console.log(`  Estimated duration: ~${estimatedSeconds} seconds`);
  console.log(`\n  Listen to the clip to validate voice quality before generating full episodes.`);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
