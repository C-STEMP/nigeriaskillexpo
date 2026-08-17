import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { canActOnZone, isOverallAdmin } from "@/lib/permissions";
import { promoteZonalSchema } from "@/lib/validation/promotion";
import { promoteStateToZonal } from "@/server/services/promotion-engine";
import { AuditAction } from "@prisma/client";

/**
 * Triggers State -> Zonal promotion for one (cycle, sector, zone). This
 * is a deliberate admin action, not automatic — per the workflow, the
 * Zonal Admin upgrades the status of the assessment "after it has been
 * assessed and if necessary reviewed by the moderator", so this is
 * explicitly a button-press, not something that fires the moment scoring
 * finishes.
 */
export async function POST(req: NextRequest) {
  const guard = await requireCapability("edit");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = promoteZonalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { cycleId, sectorId, zoneId } = parsed.data;

  if (!isOverallAdmin(guard.roles) && !canActOnZone(guard.roles, zoneId)) {
    return NextResponse.json(
      { error: "You do not have authority over this zone." },
      { status: 403 }
    );
  }

  // Refuse promotion while zonal-level criteria are still open for THIS
  // sector — promoting mid-assessment would let scores keep changing
  // underneath an already-published ranking, undermining the
  // transparency guarantee (the published top-3 should be stable).
  const lockExists = await prisma.criterionLock.findFirst({
    where: {
      cycleId,
      level: "Zonal",
      OR: [{ sectorScopeKey: sectorId }, { sectorScopeKey: "ALL_SECTORS" }],
      state: "Locked",
    },
  });
  if (!lockExists) {
    return NextResponse.json(
      {
        error:
          "Zonal-level scoring for this sector must be locked before promoting to the zonal comparison stage. This prevents scores from changing after results are published.",
      },
      { status: 409 }
    );
  }

  const { promoted, allRanked } = await promoteStateToZonal(
    cycleId,
    sectorId,
    zoneId,
    guard.userId
  );

  await prisma.auditLog.create({
    data: {
      actorId: guard.userId,
      action: AuditAction.PROMOTION_RUN,
      metadata: JSON.stringify({
        cycleId,
        sectorId,
        zoneId,
        fromStage: "State",
        toStage: "Zonal",
        promotedCount: promoted.length,
      }),
    },
  });

  return NextResponse.json({ promoted, allRanked });
}
