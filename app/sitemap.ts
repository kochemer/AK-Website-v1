import { MetadataRoute } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { getSiteUrl } from '@/lib/utils/siteUrl';
import { weekLabelToSlug } from '@/lib/utils/weekSlug';

/**
 * Get all available week labels from digest files.
 * Only includes files matching YYYY-W## format.
 */
async function getAvailableWeekLabels(): Promise<string[]> {
  try {
    const digestsDir = path.join(process.cwd(), 'data', 'digests');
    const files = await fs.readdir(digestsDir);
    const weekLabels = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .filter(label => /^\d{4}-W\d{1,2}$/.test(label))
      .sort((a, b) => {
        // Sort chronologically: compare year first, then week number
        const [yearA, weekA] = a.split('-W').map(Number);
        const [yearB, weekB] = b.split('-W').map(Number);
        if (yearA !== yearB) {
          return yearA - yearB;
        }
        return weekA - weekB;
      });
    return weekLabels;
  } catch {
    return [];
  }
}

/**
 * Get the digest build date from the JSON file itself (builtAtISO field).
 * Uses builtAtISO rather than file mtime because mtime gets reset during
 * git operations and deploys — causing all digests to show the same timestamp.
 * Falls back to startISO (week start), then current date.
 */
async function getDigestBuiltAt(filePath: string): Promise<Date> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const digest = JSON.parse(raw) as { builtAtISO?: string; startISO?: string };
    if (digest.builtAtISO) return new Date(digest.builtAtISO);
    if (digest.startISO)   return new Date(digest.startISO);
    return new Date();
  } catch {
    return new Date();
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  
  // Ensure baseUrl is absolute and canonical (https://luxury-intel.com in production)
  if (process.env.NODE_ENV === 'production' && !baseUrl.startsWith('https://luxury-intel.com')) {
    console.warn(`[Sitemap] Warning: baseUrl is ${baseUrl}, expected https://luxury-intel.com in production`);
  }

  const weekLabels = await getAvailableWeekLabels();
  const digestsDir = path.join(process.cwd(), 'data', 'digests');

  const now = new Date();

  // Multilingual entries declare alternates so Google sees the hreflang cluster
  // from the sitemap too (reinforces page-level hreflang).
  const multilingual = (slug: '' | '/about' | '/archive' | '/methodology') => ({
    languages: {
      en: `${baseUrl}${slug || '/'}`,
      es: `${baseUrl}/es${slug}`,
      da: `${baseUrl}/da${slug}`,
      'x-default': `${baseUrl}${slug || '/'}`,
    },
  });

  // ── Core English pages ────────────────────────────────────────────────────
  // /search is intentionally excluded (noindex). /feedback, /support, /subscribe
  // are kept but have no locale alternates because their /es and /da variants
  // are noindex utility pages.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl,                          lastModified: now, changeFrequency: 'weekly',  priority: 1.0, alternates: multilingual('') },
    { url: `${baseUrl}/archive`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.6, alternates: multilingual('/archive') },
    { url: `${baseUrl}/about`,               lastModified: now, changeFrequency: 'monthly', priority: 0.5, alternates: multilingual('/about') },
    { url: `${baseUrl}/methodology`,         lastModified: now, changeFrequency: 'monthly', priority: 0.5, alternates: multilingual('/methodology') },
    { url: `${baseUrl}/email-digest`,        lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${baseUrl}/subscribe`,           lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/feedback`,            lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${baseUrl}/support`,             lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // ── Localised content pages (es · da) ────────────────────────────────────
  // Locale homepages and the indexable content sub-pages (about, archive,
  // methodology). Utility locale pages (subscribe, support, feedback,
  // competitor-watch) are noindex and excluded.
  const localeEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/es`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.8, alternates: multilingual('') },
    { url: `${baseUrl}/da`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.8, alternates: multilingual('') },
    { url: `${baseUrl}/es/about`,       lastModified: now, changeFrequency: 'monthly', priority: 0.5, alternates: multilingual('/about') },
    { url: `${baseUrl}/da/about`,       lastModified: now, changeFrequency: 'monthly', priority: 0.5, alternates: multilingual('/about') },
    { url: `${baseUrl}/es/archive`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.6, alternates: multilingual('/archive') },
    { url: `${baseUrl}/da/archive`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.6, alternates: multilingual('/archive') },
    { url: `${baseUrl}/es/methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.5, alternates: multilingual('/methodology') },
    { url: `${baseUrl}/da/methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.5, alternates: multilingual('/methodology') },
  ];

  // ── Weekly digest pages (with file mtime for accurate lastModified) ───────
  const weekEntries = await Promise.all(
    weekLabels.map(async (weekLabel) => {
      const filePath = path.join(digestsDir, `${weekLabel}.json`);
      const lastModified = await getDigestBuiltAt(filePath);
      return {
        url: `${baseUrl}/digest/${weekLabelToSlug(weekLabel)}`,
        lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      };
    })
  );

  return [...staticEntries, ...localeEntries, ...weekEntries];
}


