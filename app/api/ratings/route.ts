import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json() as { slug?: unknown; rating?: unknown };
  const { slug, rating } = body;

  if (typeof slug !== 'string' || typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  console.log(`[ratings] slug=${slug} rating=${rating}`);

  return NextResponse.json({ ok: true });
}
