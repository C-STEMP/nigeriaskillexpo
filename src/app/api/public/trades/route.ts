import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Lightweight public trades-by-sector list, for the public individual
 * leaderboard's trade picker. Deliberately separate from
 * /api/admin/trades (which has no GET-side auth either, but living under
 * /admin/ is misleading for something a public page depends on).
 */
export async function GET(req: NextRequest) {
  const sectorId = req.nextUrl.searchParams.get("sectorId");
  if (!sectorId) {
    return NextResponse.json({ error: "sectorId query param is required." }, { status: 400 });
  }
  const trades = await prisma.trade.findMany({
    where: { sectorId, disabled: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ trades });
}
