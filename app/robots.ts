import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/utils/siteUrl';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  
  // Ensure sitemap URL is absolute and canonical
  const sitemapUrl = siteUrl.startsWith('http')
    ? `${siteUrl}/sitemap.xml`
    : `https://luxury-intel.com/sitemap.xml`;

  // In production, ensure we're using the canonical domain
  if (process.env.NODE_ENV === 'production' && !sitemapUrl.startsWith('https://luxury-intel.com')) {
    console.warn(`[Robots] Warning: sitemap URL is ${sitemapUrl}, expected https://luxury-intel.com/sitemap.xml in production`);
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: sitemapUrl,
  };
}


