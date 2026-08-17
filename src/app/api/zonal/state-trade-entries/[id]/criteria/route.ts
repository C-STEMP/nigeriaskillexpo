import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCriterionLocked } from "@/lib/scoring/lock-check";
import { CriterionLevel } from "@prisma/client";

/**
 * Resolves the full criteria set an assessor must score for a given
 * trade entry: every criterion that is
 *   - Global_AllTrades or Global_PerSector (applies to everyone), OR
 *   - Sector_Wide for this entry's sector, OR
 *   - Trade_Specific for this entry's exact trade
 * AND usable at the entrys currentLevel (State_Only/Zonal_Only/National_Only/Nationwide).
 * Each criterion is annotated with its live lock state so the UI can
 * show locked criteria as read-only rather than just omitting them
 * silently (the assessor should SEE what they can no longer score, not
 * wonder where a question went).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const entry = await prisma.stateTradeEntry.findUnique({
    where: { id },
    include: { trade: true, sector: true, state: true, applicant: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "Trade entry not found." }, { status: 404 });
  }

  // Explicitly typed as a mutable CriterionLevel[] — Prisma's generated
  // filter type (EnumCriterionLevelFilter) expects a plain mutable array,
  // and `as const` produces a readonly tuple that TypeScript rejects here.
  const levelFilter: { in: CriterionLevel[] } =
    entry.currentLevel === "State"
      ? { in: [CriterionLevel.State_Only, CriterionLevel.Nationwide] }
      : entry.currentLevel === "Zonal"
      ? { in: [CriterionLevel.Zonal_Only, CriterionLevel.Nationwide] }
      : { in: [CriterionLevel.National_Only, CriterionLevel.Nationwide] };

  const criteria = await prisma.criterion.findMany({
    where: {
      cycleId: entry.cycleId,
      status: "Active",
      level: levelFilter,
      OR: [
        { scope: "Global_AllTrades" },
        { scope: "Global_PerSector" },
        { scope: "Sector_Wide", sectorId: entry.sectorId },
        { scope: "Trade_Specific", tradeId: entry.tradeId },
      ],
    },
    include: { allowedEvidenceTypes: { include: { evidenceType: true } } },
    orderBy: { createdAt: "asc" },
  });

  const annotated = await Promise.all(
    criteria.map(async (c) => {
      const lockCheck = await isCriterionLocked(c.id, entry.currentLevel);
      return { ...c, isLocked: lockCheck.locked, lockReason: lockCheck.reason };
    })
  );

  return NextResponse.json({ criteria: annotated, entry });
}
