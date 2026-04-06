import { NextResponse } from "next/server";
import { loadEnrichedRows } from "@/lib/loadEnrichedRows";

export async function GET() {
  const rows = await loadEnrichedRows();
  return NextResponse.json({ rows });
}
