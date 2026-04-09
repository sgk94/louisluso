import { NextResponse } from 'next/server';
import { getItemGroups } from '@/lib/zoho/inventory';

export const revalidate = 900; // ISR: 15 minutes

export async function GET(): Promise<NextResponse> {
  try {
    const groups = await getItemGroups();
    return NextResponse.json({ products: groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch products from Zoho:', message);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 502 },
    );
  }
}
