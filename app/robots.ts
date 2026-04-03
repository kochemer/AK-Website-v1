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
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      // Explicit Allow for known AI crawler bots — positive GEO signal
      {
        userAgent: [
          'GPTBot',        // OpenAI / ChatGPT Search
          'ChatGPT-User',  // ChatGPT browsing
          'ClaudeBot',     // Anthropic Claude
          'anthropic-ai',  // Anthropic general
          'PerplexityBot', // Perplexity AI
          'Google-Extended', // Google Gemini training + AI Overviews
          'Applebot',      // Apple Intelligence / Siri
          'Amazonbot',     // Amazon Alexa / AWS AI
        ],
        allow: '/',
      },
    ],
    sitemap: sitemapUrl,
  };
}


