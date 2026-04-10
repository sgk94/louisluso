import { NextResponse } from "next/server";
import { MOCK_DEALERS } from "@/lib/dealers/mock-data";

export async function GET(): Promise<NextResponse> {
  const publicDealers = MOCK_DEALERS.map(({ email: _email, ...dealer }) => dealer);
  return NextResponse.json({ dealers: publicDealers });
}
