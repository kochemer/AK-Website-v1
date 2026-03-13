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

  // Home page
  const homeEntry: MetadataRoute.Sitemap[0] = {
    url: baseUrl,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1.0,
  };

  // Archive page
  const archiveEntry: MetadataRoute.Sitemap[0] = {
    url: `${baseUrl}/archive`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  };

  // Email digest page
  const emailDigestEntry: MetadataRoute.Sitemap[0] = {
    url: `${baseUrl}/email-digest`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  };

  // Week pages - include all available week digests with lastModified from file mtime
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

  return [homeEntry, archiveEntry, emailDigestEntry, ...weekEntries];
}


