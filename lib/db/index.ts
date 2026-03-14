import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type Db = NeonHttpDatabase<typeof schema>;

let _db: Db | undefined;

/**
 * Returns the shared Drizzle/Neon instance, created lazily on first call.
 * Lazy init prevents the build from crashing when DATABASE_URL is not set
 * at compile time — the error surfaces at request time instead, which is correct.
 */
export function getDb(): Db {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('[db] DATABASE_URL environment variable is not set');
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}
