/**
 * Regenerates the Editor's Take for a single week without rebuilding the full digest.
 * Usage: npx tsx scripts/regenEditorialTake.ts --week=2026-W13
 */
import { promises as fs } from 'fs';
import path from 'path';
import { loadEnv } from '../lib/env';
import { generateEditorialTakeForDigest } from '../digest/generateEditorialTake';

loadEnv();

async function main() {
  const args = process.argv.slice(2);
  let weekLabel: string | null = null;
  for (const arg of args) {
    if (arg.startsWith('--week=')) { weekLabel = arg.split('=')[1]!; break; }
    if (arg === '--week') { weekLabel = args[args.indexOf(arg) + 1] ?? null; break; }
  }
  if (!weekLabel) {
    console.error('Usage: npx tsx scripts/regenEditorialTake.ts --week=YYYY-Www');
    process.exit(1);
  }

  const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
  const raw = await fs.readFile(digestPath, 'utf-8');
  const digest = JSON.parse(raw);

  console.log(`[EditorialTake] Regenerating for ${weekLabel}...`);
  const result = await generateEditorialTakeForDigest(digest, /* regenTake */ true);

  if (!result) {
    console.error('[EditorialTake] ✗ Generation failed — check OPENAI_API_KEY');
    process.exit(1);
  }

  digest.editorialTake = result.editorialTake;
  await fs.writeFile(digestPath, JSON.stringify(digest, null, 2), 'utf-8');

  console.log(`[EditorialTake] ✓ Saved to ${digestPath}`);
  console.log('\n' + result.editorialTake);
}

main().catch((err) => { console.error(err); process.exit(1); });
