import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AssessmentLevel } from "@prisma/client";

/**
 * Public, unauthenticated individual leaderboard. Unlike /api/results/public
 * (which shows SECTOR aggregate totals per state/zone — useful for the
 * "overall" view), this shows NAMED individuals ranked within one specific
 * trade — because award categories ("Outstanding Building & Construction
 * Trainee", "Best Instructor") are given to a PERSON or ORGANIZATION, not
 * a group. A trade is the correct unit of individual comparison since
 * criteria are consistent within a trade (unlike comparing across trades,
 * which may have different criteria/max scores).
 *
 * Query params:
 *   cycleId, sectorId, tradeId — required, identifies the competition
 *   stage — "State" | "Zonal" | "National"
 *   stateId — required when stage=State (rank within one state)
 *   zoneId  — required when stage=Zonal (rank within one zone, across its states)
 *   (stage=National needs no extra scoping — it's already the full national field)
 *
 * Ranking is computed on the fly by sorting tradeTotal — StateTradeEntry
 * doesn't persist a rank/isPromoted flag the way SectorResult does, since
 * individual-level ranking is a derived view, not a separately-stored
 * promotion artifact. "isPromoted" here is derived from whether the
 * entry's currentLevel has advanced past the stage being viewed.
 */
export async function GET(req: NextRequest) {
  const cycleId = req.nextUrl.searchParams.get("cycleId");
  const sectorId = req.nextUrl.searchParams.get("sectorId");
  const tradeId = req.nextUrl.searchParams.get("tradeId");
  const stage = req.nextUrl.searchParams.get("stage") as "State" | "Zonal" | "National" | null;
  const stateId = req.nextUrl.searchParams.get("stateId");
  const zoneId = req.nextUrl.searchParams.get("zoneId");

  if (!cycleId || !sectorId || !tradeId || !stage) {
    return NextResponse.json(
      { error: "cycleId, sectorId, tradeId, and stage query params are all required." },
      { status: 400 }
    );
  }
  if (stage === "State" && !stateId) {
    return NextResponse.json({ error: "stateId is required when stage=State." }, { status: 400 });
  }
  if (stage === "Zonal" && !zoneId) {
    return NextResponse.json({ error: "zoneId is required when stage=Zonal." }, { status: 400 });
  }

  const entries = await prisma.stateTradeEntry.findMany({
    where: {
      cycleId,
      sectorId,
      tradeId,
      state: stage === "Zonal" ? { zoneId: zoneId! } : undefined,
      stateId: stage === "State" ? stateId! : undefined,
    },
    include: {
      applicant: {
        select: { firstName: true, lastName: true, organizationName: true, applicantCategory: true },
      },
      trade: { select: { name: true } },
      sector: { select: { name: true } },
      state: { select: { name: true, zone: { select: { name: true } } } },
    },
    orderBy: { tradeTotal: "desc" },
  });

  // Stage precedence for "did this individual advance beyond the stage
  // being viewed" — State < Zonal < National.
  const stagePrecedence: Record<string, number> = { State: 0, Zonal: 1, National: 2 };
  const viewedPrecedence = stagePrecedence[stage];

  const ranked = entries.map((e, index) => ({
    rank: index + 1,
    id: e.id,
    applicantName:
      e.applicant.organizationName ??
      `${e.applicant.firstName ?? ""} ${e.applicant.lastName ?? ""}`.trim(),
    applicantCategory: e.applicant.applicantCategory,
    tradeName: e.trade.name,
    sectorName: e.sector.name,
    stateName: e.state.name,
    zoneName: e.state.zone.name,
    score: e.tradeTotal,
    // Reflects the REAL promotion decision (an admin actually clicked
    // "Promote" and this entry's currentLevel moved beyond the stage
    // being viewed) — NOT just "this row happens to rank top 3", which
    // would wrongly claim promotion before it's actually happened.
    isPromoted: (stagePrecedence[e.currentLevel as AssessmentLevel] ?? 0) > viewedPrecedence,
  }));

  return NextResponse.json({ entries: ranked });
}
