/**
 * Search articles by title and source.
 * GET /api/search?q=query&limit=30
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

type Article = {
  id?: string;
  title: string;
  url: string;
  source?: string;
  published_at?: string;
  snippet?: string;
  aiSummary?: string;
  summary?: string;
};

const MAX_RESULTS = 50;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ articles: [], total: 0 });
  }

  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get('limit') || '30', 10) || 30,
    MAX_RESULTS
  );

  try {
    const dataPath = path.join(process.cwd(), 'data', 'articles.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    const articles: Article[] = JSON.parse(raw);

    const lowerQ = q.toLowerCase();
    const terms = lowerQ.split(/\s+/).filter(Boolean);

    const matches = articles.filter((a) => {
      const title = (a.title || '').toLowerCase();
      const source = (a.source || '').toLowerCase();
      const searchable = `${title} ${source}`;
      return terms.every((t) => searchable.includes(t));
    });

    const results = matches.slice(0, limit).map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      source: a.source,
      published_at: a.published_at,
      snippet: a.snippet || a.aiSummary || a.summary,
    }));

    return NextResponse.json({ articles: results, total: matches.length });
  } catch (err) {
    console.error('[Search API]', err);
    return NextResponse.json(
      { error: 'Search failed', articles: [], total: 0 },
      { status: 500 }
    );
  }
}
