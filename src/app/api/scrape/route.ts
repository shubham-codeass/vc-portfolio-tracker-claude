// src/app/api/scrape/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { scrapeVCFund, enrichCompany, VCFundData, PortfolioCompany } from '@/lib/scraper';
import { KNOWN_INDIAN_VCS } from '@/lib/indian-vcs';

export const maxDuration = 60; // 60 seconds for Vercel

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { urls, enrich = false } = body as { urls: string[], enrich?: boolean };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'Please provide at least one URL' }, { status: 400 });
    }

    if (urls.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 URLs at once' }, { status: 400 });
    }

    // Check if any URLs match known VC funds to augment with our curated data
    const results: VCFundData[] = [];

    for (const rawUrl of urls) {
      const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      
      // Check known funds database first
      const knownFund = KNOWN_INDIAN_VCS.find(
        f => f.website === url || 
             (f.portfolioPage && f.portfolioPage === url) ||
             url.includes(new URL(f.website).hostname.replace('www.', ''))
      );

      // Scrape the page
      const scrapeUrl = knownFund?.portfolioPage || url;
      const fundData = await scrapeVCFund(scrapeUrl);

      // Augment with known fund data if available
      if (knownFund) {
        fundData.fundName = knownFund.name;
        fundData.fundDescription = knownFund.description;
        fundData.aum = knownFund.aum;
        fundData.focus = knownFund.focus;

        // If scraping didn't yield many companies, add known portfolio companies
        if (fundData.portfolio.length < 5 && knownFund.notable && knownFund.notable.length > 0) {
          const knownCompanies: PortfolioCompany[] = knownFund.notable.map(name => ({
            name,
            status: 'active' as const,
            crunchbaseUrl: `https://www.crunchbase.com/organization/${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          }));
          
          // Merge, deduplication
          const existingNames = new Set(fundData.portfolio.map(c => c.name.toLowerCase()));
          for (const kc of knownCompanies) {
            if (!existingNames.has(kc.name.toLowerCase())) {
              fundData.portfolio.push(kc);
            }
          }
        }
      }

      results.push(fundData);
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
