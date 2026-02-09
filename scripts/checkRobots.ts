/**
 * Check robots.txt on production site
 * Fetches https://luxury-intel.com/robots.txt and prints the Sitemap line(s)
 */

async function checkRobots() {
  const url = 'https://luxury-intel.com/robots.txt';
  
  try {
    console.log(`Fetching ${url}...`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    const lines = text.split('\n');
    
    console.log('\n=== robots.txt content ===');
    console.log(text);
    console.log('==========================\n');
    
    // Find and print Sitemap lines
    const sitemapLines = lines.filter(line => 
      line.trim().toLowerCase().startsWith('sitemap:')
    );
    
    if (sitemapLines.length === 0) {
      console.error('❌ No Sitemap line found in robots.txt');
      process.exit(1);
    }
    
    console.log('=== Sitemap line(s) ===');
    sitemapLines.forEach(line => {
      console.log(line.trim());
      const sitemapUrl = line.split(':').slice(1).join(':').trim();
      
      // Check for vercel.app domain
      if (sitemapUrl.includes('vercel.app')) {
        console.error(`❌ ERROR: Sitemap URL contains vercel.app domain: ${sitemapUrl}`);
        process.exit(1);
      }
      
      // Check for correct domain
      if (!sitemapUrl.includes('luxury-intel.com')) {
        console.error(`❌ ERROR: Sitemap URL does not contain luxury-intel.com: ${sitemapUrl}`);
        process.exit(1);
      }
      
      // Check for correct format
      if (sitemapUrl !== 'https://luxury-intel.com/sitemap.xml') {
        console.warn(`⚠️  WARNING: Sitemap URL is not exactly https://luxury-intel.com/sitemap.xml: ${sitemapUrl}`);
      } else {
        console.log(`✅ Sitemap URL is correct: ${sitemapUrl}`);
      }
    });
    console.log('========================\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error(`❌ Error fetching robots.txt: ${error.message}`);
    process.exit(1);
  }
}

checkRobots();
