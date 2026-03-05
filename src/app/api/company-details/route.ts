// src/app/api/company-details/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { enrichCompany, getCompanyNews, PortfolioCompany } from '@/lib/scraper';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { company } = body as { company: PortfolioCompany };

    if (!company || !company.name) {
      return NextResponse.json({ error: 'Company name required' }, { status: 400 });
    }

    const enriched = await enrichCompany(company);
    return NextResponse.json({ company: enriched });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to enrich company', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
