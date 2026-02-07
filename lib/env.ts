/**
 * Shared environment variable loading utility.
 * 
 * Handles UTF-16/UTF-16LE encoded .env.local files (common when edited in PowerShell/Windows).
 * Safe to call multiple times - only sets vars not already present in process.env.
 * 
 * Usage:
 *   import { loadEnv } from '@/lib/env';
 *   loadEnv(); // Call at top of script, before accessing env vars
 */

import { readFileSync } from 'fs';
import path from 'path';
import { parse } from 'dotenv';

/**
 * Load environment variables from .env.local at project root.
 * 
 * Features:
 * - Handles UTF-16 LE with BOM (FF FE)
 * - Handles UTF-16 BE with BOM (FE FF)
 * - Handles UTF-16 LE without BOM (detected by null bytes)
 * - Falls back to UTF-8
 * - Only sets vars not already in process.env (preserves existing)
 * - Safe if .env.local doesn't exist
 */
export function loadEnv(): void {
  const envPath = path.join(process.cwd(), '.env.local');
  
  try {
    const buffer = readFileSync(envPath);
    let contentToParse: string;
    
    // Detect encoding: check for UTF-16 BOM (FE FF for BE, FF FE for LE)
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      // UTF-16 LE BOM
      contentToParse = buffer.toString('utf16le', 2);
    } else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      // UTF-16 BE BOM - convert to LE for processing
      const leBuffer = Buffer.alloc(buffer.length - 2);
      for (let i = 2; i < buffer.length; i += 2) {
        leBuffer[i - 2] = buffer[i + 1];
        leBuffer[i - 1] = buffer[i];
      }
      contentToParse = leBuffer.toString('utf16le');
    } else if (buffer.length > 0 && buffer[1] === 0 && buffer[0] !== 0) {
      // UTF-16 LE without BOM (every other byte is null)
      contentToParse = buffer.toString('utf16le');
    } else {
      // Assume UTF-8
      contentToParse = buffer.toString('utf-8');
    }
    
    const parsed = parse(contentToParse);
    
    // Only set vars that aren't already defined (preserve existing)
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    // .env.local not found or unreadable - silently continue
    // This is expected in production where env vars come from the platform
  }
}
