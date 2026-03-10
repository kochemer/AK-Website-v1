/**
 * Dynamic OG image endpoint using next/og.
 * GET /api/og?week=2026-W10
 * Canvas 1200×630, navy bg, cream/gold typography.
 */

import { ImageResponse } from 'next/og';
import path from 'path';
import { promises as fs } from 'fs';
import { formatIssueLine } from '@/lib/utils/formatDate';
import { getCurrentDigestWeek } from '@/lib/utils/getCurrentDigestWeek';

const WIDTH = 1200;
const HEIGHT = 630;
const BG = '#1B2A4A';
const CREAM = '#FAF9F6';
const GOLD = '#8B6914';
const MUTED = '#B0BEC5';

type DigestMeta = { startISO?: string; totals?: { total?: number } };

async function getDigestMeta(weekLabel: string): Promise<DigestMeta | null> {
  try {
    const digestPath = path.join(process.cwd(), 'data', 'digests', `${weekLabel}.json`);
    const raw = await fs.readFile(digestPath, 'utf-8');
    const data = JSON.parse(raw) as DigestMeta;
    return data;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let weekParam = searchParams.get('week')?.trim() ?? '';
  const weekLabel = weekParam && /^\d{4}-W\d{2}$/.test(weekParam)
    ? weekParam
    : getCurrentDigestWeek();

  const digest = await getDigestMeta(weekLabel);
  const issueLine = formatIssueLine(weekLabel, digest?.startISO);
  const articleCount = digest?.totals?.total ?? 434;
  const articlesLine = `${articleCount} articles analysed`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: BG,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div
            style={{
              color: CREAM,
              fontSize: 36,
              letterSpacing: '0.12em',
              fontWeight: 400,
              textAlign: 'center',
            }}
          >
            LUXURY INTELLIGENCE
          </div>
          <div
            style={{
              width: 60,
              height: 2,
              background: GOLD,
            }}
          />
          <div
            style={{
              color: GOLD,
              fontSize: 18,
              textAlign: 'center',
            }}
          >
            {issueLine}
          </div>
          <div
            style={{
              color: MUTED,
              fontSize: 22,
              fontStyle: 'italic',
              textAlign: 'center',
              maxWidth: 800,
            }}
          >
            Weekly Intelligence on AI, Ecommerce & Luxury
          </div>
          <div
            style={{
              color: MUTED,
              fontSize: 16,
              textAlign: 'center',
            }}
          >
            {articlesLine}
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    }
  );
}
