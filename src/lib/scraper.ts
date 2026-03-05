// src/lib/scraper.ts
// Free web scraping using public data - no paid APIs

export interface PortfolioCompany {
  name: string;
  website?: string;
  description?: string;
  sector?: string;
  stage?: string;
  foundedYear?: string;
  founders?: string[];
  fundingRounds?: FundingRound[];
  totalFunding?: string;
  lastValuation?: string;
  status?: 'active' | 'acquired' | 'ipo' | 'shutdown' | 'unknown';
  linkedinUrl?: string;
  crunchbaseUrl?: string;
  twitterUrl?: string;
  newsArticles?: NewsArticle[];
  investors?: string[];
  hq?: string;
  employees?: string;
  revenueStage?: string;
}

export interface FundingRound {
  round: string;
  amount?: string;
  date?: string;
  investors?: string[];
}

export interface NewsArticle {
  title: string;
  url: string;
  source: string;
  date?: string;
}

export interface VCFundData {
  fundName: string;
  fundWebsite: string;
  fundDescription?: string;
  aum?: string;
  focus?: string[];
  portfolio: PortfolioCompany[];
  scrapedAt: string;
  error?: string;
}

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

export async function fetchWithProxy(url: string): Promise<string> {
  // Try direct fetch first (works in Node/server)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VCTracker/1.0; +https://github.com/vc-tracker)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      return await res.text();
    }
  } catch {
    // fall through to proxies
  }

  // Try CORS proxies as fallback
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(`${proxy}${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        return await res.text();
      }
    } catch {
      continue;
    }
  }
  throw new Error(`Failed to fetch: ${url}`);
}

export function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function normalizeUrl(url: string, baseUrl?: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/') && baseUrl) {
    const base = new URL(baseUrl);
    return `${base.protocol}//${base.host}${url}`;
  }
  return url;
}

// Extract company links from portfolio pages using pattern matching
export function extractPortfolioLinks(html: string, baseUrl: string): Array<{name: string, href: string, description?: string}> {
  const companies: Array<{name: string, href: string, description?: string}> = [];
  const seen = new Set<string>();

  // Common portfolio page patterns for Indian VCs
  // Look for grid/list items with company names
  
  // Pattern 1: Links inside portfolio/companies sections
  const sectionPatterns = [
    /<section[^>]*(?:portfolio|companies|investments|startups)[^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*(?:portfolio|companies|investments|startups)[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  let searchHtml = html;
  
  // Try to find portfolio section first
  for (const pattern of sectionPatterns) {
    const match = pattern.exec(html);
    if (match && match[1].length > 500) {
      searchHtml = match[1];
      break;
    }
  }

  // Extract all links with text
  const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  
  while ((match = linkPattern.exec(searchHtml)) !== null) {
    const href = normalizeUrl(match[1], baseUrl);
    const rawText = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    
    if (!rawText || rawText.length < 2 || rawText.length > 60) continue;
    if (!href || href.includes('#') || href.includes('mailto:') || href.includes('tel:')) continue;
    
    // Filter out navigation links
    const skipWords = ['home', 'about', 'team', 'contact', 'blog', 'news', 'careers', 
                       'linkedin', 'twitter', 'facebook', 'instagram', 'youtube',
                       'privacy', 'terms', 'cookie', 'menu', 'nav', 'read more', 'learn more',
                       'sign in', 'login', 'register', 'subscribe'];
    if (skipWords.some(w => rawText.toLowerCase() === w)) continue;
    
    // Must look like a company name (capitalized, no excessive punctuation)
    if (!/[A-Z]/.test(rawText)) continue;
    
    const key = rawText.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      companies.push({ name: rawText, href });
    }
  }

  // Also extract from image alt texts and data attributes
  const imgPattern = /<img[^>]*(?:alt|title)=["']([^"']{3,50})["'][^>]*>/gi;
  while ((match = imgPattern.exec(searchHtml)) !== null) {
    const name = match[1].trim();
    if (!seen.has(name.toLowerCase()) && /[A-Z]/.test(name) && name.split(' ').length <= 5) {
      // Try to find associated link
      const context = searchHtml.substring(Math.max(0, match.index - 200), match.index + 200);
      const ctxLink = /<a[^>]*href=["']([^"']+)["']/.exec(context);
      if (ctxLink) {
        seen.add(name.toLowerCase());
        companies.push({ name, href: normalizeUrl(ctxLink[1], baseUrl) });
      }
    }
  }

  return companies;
}

// Get company info from Crunchbase public pages (free)
export async function getCrunchbaseData(companyName: string): Promise<Partial<PortfolioCompany>> {
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const url = `https://www.crunchbase.com/organization/${slug}`;
  
  try {
    const html = await fetchWithProxy(`https://www.crunchbase.com/organization/${slug}`);
    const data: Partial<PortfolioCompany> = {
      crunchbaseUrl: url,
    };

    // Extract funding data from meta tags and JSON-LD
    const totalFundingMatch = html.match(/total[_\s]funding[^>]*?["']?(\$[\d.,]+[MBK]?)/i);
    if (totalFundingMatch) data.totalFunding = totalFundingMatch[1];

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    if (descMatch) data.description = descMatch[1].substring(0, 300);

    return data;
  } catch {
    return { crunchbaseUrl: url };
  }
}

// Search for company news using Google News RSS (free)
export async function getCompanyNews(companyName: string): Promise<NewsArticle[]> {
  const query = encodeURIComponent(`${companyName} India startup funding`);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;
  
  try {
    const xml = await fetchWithProxy(rssUrl);
    const articles: NewsArticle[] = [];
    
    const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    let count = 0;
    
    while ((match = itemPattern.exec(xml)) !== null && count < 5) {
      const item = match[1];
      const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
      const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      
      if (titleMatch && linkMatch) {
        articles.push({
          title: titleMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(),
          url: linkMatch[1].trim(),
          source: sourceMatch ? sourceMatch[1].trim() : 'Google News',
          date: dateMatch ? new Date(dateMatch[1]).toLocaleDateString('en-IN') : undefined,
        });
        count++;
      }
    }
    
    return articles;
  } catch {
    return [];
  }
}

// Fetch company website metadata
export async function getCompanyWebsiteData(websiteUrl: string): Promise<Partial<PortfolioCompany>> {
  try {
    const html = await fetchWithProxy(websiteUrl);
    const data: Partial<PortfolioCompany> = {};
    
    // Description from meta
    const descMatch = html.match(/<meta[^>]*(?:name=["']description["']|property=["']og:description["'])[^>]*content=["']([^"']{20,300})["']/i);
    if (descMatch) data.description = descMatch[1].trim();

    // OG title as company name confirmation
    const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (titleMatch) data.name = titleMatch[1].replace(/\s*[-|].*$/, '').trim();

    // Social links
    const linkedinMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/company\/([a-zA-Z0-9-_]+)/i);
    if (linkedinMatch) data.linkedinUrl = `https://linkedin.com/company/${linkedinMatch[1]}`;

    const twitterMatch = html.match(/https?:\/\/(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)/i);
    if (twitterMatch && !['share', 'intent', 'home'].includes(twitterMatch[1].toLowerCase())) {
      data.twitterUrl = `https://twitter.com/${twitterMatch[1]}`;
    }

    return data;
  } catch {
    return {};
  }
}

// Main function: scrape a VC fund portfolio page
export async function scrapeVCFund(fundUrl: string): Promise<VCFundData> {
  const startTime = Date.now();
  
  try {
    const html = await fetchWithProxy(fundUrl);
    
    // Extract fund name
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const fundName = titleMatch 
      ? titleMatch[1].replace(/[-|].*$/, '').trim() 
      : extractDomain(fundUrl);

    // Extract fund description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const fundDescription = descMatch ? descMatch[1] : undefined;

    // Extract portfolio companies
    const rawCompanies = extractPortfolioLinks(html, fundUrl);
    
    // Deduplicate and clean
    const companies: PortfolioCompany[] = rawCompanies
      .slice(0, 50) // Limit to 50 companies per fund
      .map(c => ({
        name: c.name,
        website: c.href.startsWith('http') ? c.href : undefined,
        description: c.description,
        status: 'unknown' as const,
      }));

    return {
      fundName,
      fundWebsite: fundUrl,
      fundDescription,
      portfolio: companies,
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      fundName: extractDomain(fundUrl),
      fundWebsite: fundUrl,
      portfolio: [],
      scrapedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Failed to scrape fund page',
    };
  }
}

// Enrich a single portfolio company with additional data
export async function enrichCompany(company: PortfolioCompany): Promise<PortfolioCompany> {
  const enriched = { ...company };
  
  // Get news articles
  const news = await getCompanyNews(company.name);
  if (news.length > 0) enriched.newsArticles = news;

  // Get website data if we have a URL
  if (company.website) {
    const websiteData = await getCompanyWebsiteData(company.website);
    if (websiteData.description && !enriched.description) enriched.description = websiteData.description;
    if (websiteData.linkedinUrl) enriched.linkedinUrl = websiteData.linkedinUrl;
    if (websiteData.twitterUrl) enriched.twitterUrl = websiteData.twitterUrl;
  }

  // Set crunchbase URL (even if we can't fetch it)
  const slug = company.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  enriched.crunchbaseUrl = `https://www.crunchbase.com/organization/${slug}`;

  return enriched;
}
