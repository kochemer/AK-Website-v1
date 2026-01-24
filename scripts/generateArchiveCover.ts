/**
 * Generate a cover image for the archive page
 * Uses DALL-E to create a photorealistic image representing the archive concept
 */

import { promises as fs, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import { parse } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local for Node CLI script
const envPath = path.join(__dirname, '../.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  const parsed = parse(envContent);
  // Set environment variables
  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch (err: any) {
  if (err.code !== 'ENOENT') {
    console.warn(`[Archive Cover] Warning: Could not load .env.local: ${err.message}`);
  }
}

const ARCHIVE_COVER_PATH = path.join(__dirname, '../public/weekly-images/archive-cover.png');
const ARCHIVE_COVER_URL = '/weekly-images/archive-cover.png';

/**
 * Generate archive cover image using DALL-E
 */
async function generateArchiveCoverImage(): Promise<{ success: boolean; path: string; url: string }> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not found');
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Create a prompt for the archive cover
  // Should be photorealistic, represent the concept of an archive/library of intelligence
  const prompt = `A photorealistic wide banner image (16:9 aspect ratio) of a modern, elegant archive or library. The scene shows:
- A sophisticated reading room or archive space with tall bookshelves containing bound volumes
- Soft, warm lighting filtering through large windows
- A central table with open books, documents, and a vintage magnifying glass
- Subtle luxury elements: leather-bound volumes, brass details, rich wood textures
- The atmosphere is quiet, scholarly, and refined
- Wide horizontal composition, cinematic lighting, photorealistic style
- No text, no logos, no people visible
- Color palette: warm browns, deep purples, gold accents, cream whites`;

  console.log('[Archive Cover] Generating cover image with DALL-E...');

  try {
    // Try 1536x1024 first (wide format for cover), fallback to 1024x1024 if not supported
    let size: "1536x1024" | "1024x1024" = '1536x1024';
    let response;

    try {
      response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: 'hd',
      });
    } catch (sizeError: any) {
      // If size not supported, try fallback
      if (sizeError.message?.includes('size') || sizeError.message?.includes('dimension') || sizeError.message?.includes('Invalid value')) {
        console.warn(`[Archive Cover] Size ${size} not supported, falling back to 1024x1024`);
        size = '1024x1024';
        response = await openai.images.generate({
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: size,
          quality: 'hd',
        });
      } else {
        throw sizeError;
      }
    }

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from DALL-E');
    }

    const imageData = response.data[0];
    let buffer: Buffer;

    // Handle both URL and base64 responses
    if (imageData.url) {
      // Download image from URL
      const imageResponse = await fetch(imageData.url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image from URL: ${imageResponse.statusText}`);
      }
      buffer = Buffer.from(await imageResponse.arrayBuffer());
    } else if (imageData.b64_json) {
      // Decode base64
      buffer = Buffer.from(imageData.b64_json, 'base64');
    } else {
      throw new Error('No image data in response');
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(ARCHIVE_COVER_PATH), { recursive: true });

    // Save image
    await fs.writeFile(ARCHIVE_COVER_PATH, buffer);

    const stats = await fs.stat(ARCHIVE_COVER_PATH);
    const sizeKB = (stats.size / 1024).toFixed(1);

    console.log(`✓ [Archive Cover] Cover image saved to: ${ARCHIVE_COVER_PATH} (${sizeKB}KB, size: ${size})`);

    return {
      success: true,
      path: ARCHIVE_COVER_PATH,
      url: ARCHIVE_COVER_URL,
    };
  } catch (err: any) {
    console.error(`[Archive Cover] Error generating cover image: ${err.message}`);
    throw err;
  }
}

async function main() {
  try {
    const result = await generateArchiveCoverImage();
    console.log(`\n✓ Archive cover image generated successfully!`);
    console.log(`  Path: ${result.path}`);
    console.log(`  URL: ${result.url}`);
  } catch (err: any) {
    console.error(`\n✗ Failed to generate archive cover image: ${err.message}`);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('generateArchiveCover.ts')) {
  main();
}
