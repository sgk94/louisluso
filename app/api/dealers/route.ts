import { NextResponse } from "next/server";
import { MOCK_DEALERS } from "@/lib/dealers/mock-data";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ dealers: MOCK_DEALERS });
}
