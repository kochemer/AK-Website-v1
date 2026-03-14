import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

/**
 * Singleton Drizzle client over Neon's HTTP transport.
 * HTTP (not WebSocket) is correct for serverless/edge — no persistent connection needed.
 *
 * Requires env var:  DATABASE_URL
 * Add to .env.local: DATABASE_URL=postgresql://...
 * Vercel sets this automatically when you attach a Neon / Vercel Postgres database.
 */
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
