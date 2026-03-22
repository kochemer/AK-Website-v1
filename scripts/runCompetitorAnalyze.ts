import { loadEnv } from '../lib/env';
import { getCurrentDigestWeek } from '../lib/utils/getCurrentDigestWeek';
import { runCompetitorAnalyze } from '../pipeline/competitorAnalyze';

loadEnv();

const weekLabel = getCurrentDigestWeek();
console.log(`[competitor:analyze] Running for week ${weekLabel}`);

runCompetitorAnalyze(weekLabel)
  .then(() => {
    console.log('[competitor:analyze] Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[competitor:analyze] Fatal error:', err);
    process.exit(1);
  });
