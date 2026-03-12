/**
 * Regenerate oneSentenceSummary for a given week using the two-stage generator/judge pipeline.
 * Usage: npx tsx scripts/regenerateSummary.ts [--week=2026-W10]
 */

import { promises as fs } from 'fs';
import path from 'path';
import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek, validateWeekLabel } from '../lib/utils/getCurrentDigestWeek';
import { generateThemesForDigest } from '../digest/generateThemes';

loadEnv();

async function main() {
  const args = process.argv.slice(2);
  let weekLabel: string | null = null;
  for (const arg of args) {
    if (arg.startsWith('--week=')) { weekLabel = arg.split('=')[1]; break; }
    if (arg === '--week') { weekLabel = args[args.indexOf(arg) + 1]; break; }
  }
  if (!weekLabel) weekLabel = getCurrentDigestWeek();
  validateWeekLabel(weekLabel);

  const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
  const raw = await fs.readFile(digestPath, 'utf-8');
  const digest = JSON.parse(raw);

  console.log(`\n[Regenerate Summary] Week: ${weekLabel}`);
  console.log(`[Regenerate Summary] Running two-stage generator → judge pipeline...\n`);

  // Force regeneration by passing regenThemes=true (bypasses cache)
  const result = await generateThemesForDigest(digest, true);

  if (!result?.oneSentenceSummary) {
    console.error('[Regenerate Summary] ✗ Failed to generate summary');
    process.exit(1);
  }

  // Patch only oneSentenceSummary into the digest (preserve everything else)
  digest.oneSentenceSummary = result.oneSentenceSummary;

  await fs.writeFile(digestPath, JSON.stringify(digest, null, 2), 'utf-8');

  console.log(`\n[Regenerate Summary] ✓ Saved to ${digestPath}`);
  console.log(`[Regenerate Summary] ✓ Final sentence: "${result.oneSentenceSummary}"`);
  if (result.summaryCandidates?.length) {
    console.log(`\n[Regenerate Summary] All candidates considered:`);
    result.summaryCandidates.forEach((c, i) => console.log(`  [${i + 1}] ${c}`));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
