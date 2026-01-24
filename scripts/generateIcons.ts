/**
 * Generate PWA icons from favicon.png
 * 
 * This script generates icon-192.png and icon-512.png from public/favicon.png
 * using the sharp library for image processing.
 * 
 * Usage:
 *   npm install --save-dev sharp
 *   tsx scripts/generateIcons.ts
 * 
 * Requirements:
 *   - public/favicon.png must exist
 *   - sharp must be installed (npm install --save-dev sharp)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FAVICON_PATH = path.join(__dirname, '../public/favicon.png');
const ICONS_DIR = path.join(__dirname, '../public/icons');
const ICON_192_PATH = path.join(ICONS_DIR, 'icon-192.png');
const ICON_512_PATH = path.join(ICONS_DIR, 'icon-512.png');

async function generateIcons() {
  try {
    // Check if sharp is available
    let sharp: any;
    try {
      sharp = (await import('sharp')).default;
    } catch (err) {
      console.error('Error: sharp is not installed.');
      console.error('Please install it with: npm install --save-dev sharp');
      process.exit(1);
    }

    // Check if favicon exists
    try {
      await fs.access(FAVICON_PATH);
    } catch (err) {
      console.error(`Error: ${FAVICON_PATH} not found.`);
      process.exit(1);
    }

    // Create icons directory if it doesn't exist
    try {
      await fs.mkdir(ICONS_DIR, { recursive: true });
    } catch (err) {
      // Directory might already exist, that's fine
    }

    // Generate icons
    console.log('Generating PWA icons from favicon.png...');
    
    const faviconBuffer = await fs.readFile(FAVICON_PATH);
    
    // Generate 192x192 icon
    await sharp(faviconBuffer)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(ICON_192_PATH);
    console.log(`✓ Generated ${ICON_192_PATH}`);

    // Generate 512x512 icon
    await sharp(faviconBuffer)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(ICON_512_PATH);
    console.log(`✓ Generated ${ICON_512_PATH}`);

    console.log('✓ All icons generated successfully!');
  } catch (error: any) {
    console.error('Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
