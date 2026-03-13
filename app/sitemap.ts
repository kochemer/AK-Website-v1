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
 * Get file modification time for lastModified metadata.
 * Falls back to current date if file doesn't exist.
 */
async function getFileModifiedTime(filePath: string): Promise<Date> {
  try {
    const stats = await fs.stat(filePath);
    return stats.mtime;
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

  // ── Core English pages ────────────────────────────────────────────────────
  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl,                          lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${baseUrl}/archive`,             lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${baseUrl}/email-digest`,        lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${baseUrl}/subscribe`,           lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/about`,               lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/methodology`,         lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/feedback`,            lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${baseUrl}/support`,             lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // ── Localised pages (es · da) ─────────────────────────────────────────────
  const localeEntries: MetadataRoute.Sitemap = [
    // Spanish
    { url: `${baseUrl}/es`,                  lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${baseUrl}/es/archive`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.5 },
    { url: `${baseUrl}/es/subscribe`,        lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/es/about`,            lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/es/methodology`,      lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    // Danish
    { url: `${baseUrl}/da`,                  lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${baseUrl}/da/archive`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.5 },
    { url: `${baseUrl}/da/subscribe`,        lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/da/about`,            lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/da/methodology`,      lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  // ── Weekly digest pages (with file mtime for accurate lastModified) ───────
  const weekEntries = await Promise.all(
    weekLabels.map(async (weekLabel) => {
      const filePath = path.join(digestsDir, `${weekLabel}.json`);
      const lastModified = await getFileModifiedTime(filePath);
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


