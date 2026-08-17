import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public, unauthenticated endpoint. Returns the FULL ranked list (not
 * just top 3) for a sector at a given stage, per the explicit
 * transparency requirement — everyone can see everyone's score, with the
 * top 3 distinguished by isPromoted rather than being the only rows
 * returned.
 */
export async function GET(req: NextRequest) {
  const cycleId = req.nextUrl.searchParams.get("cycleId");
  const sectorId = req.nextUrl.searchParams.get("sectorId");
  const stage = req.nextUrl.searchParams.get("stage"); // State | Zonal | National

  if (!cycleId || !sectorId || !stage) {
    return NextResponse.json(
      { error: "cycleId, sectorId, and stage query params are all required." },
      { status: 400 }
    );
  }

  const results = await prisma.sectorResult.findMany({
    where: { cycleId, sectorId, stage: stage as never },
    include: { state: { include: { zone: true } }, zone: true, sector: true },
    orderBy: { rank: "asc" },
  });

  return NextResponse.json({ results });
}
