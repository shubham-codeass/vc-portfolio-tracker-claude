// src/app/api/known-funds/route.ts
import { NextResponse } from 'next/server';
import { KNOWN_INDIAN_VCS } from '@/lib/indian-vcs';

export async function GET() {
  return NextResponse.json({ funds: KNOWN_INDIAN_VCS });
}
