import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-guard";
import { promoteNationalSchema } from "@/lib/validation/promotion";
import { promoteZonalToNational } from "@/server/services/promotion-engine";
import { AuditAction } from "@prisma/client";

/**
 * Triggers Zonal -> National promotion for one (cycle, sector). Unlike
 * the zonal promotion (which a Zonal_Admin can trigger for their own
 * zone), this is a NATIONAL action comparing every zone's result against
 * each other — restricted to National_Admin/Super_Admin, since no single
 * Zonal_Admin has authority over the other zones being compared.
 */
export async function POST(req: NextRequest) {
  const guard = await requireRole("Super_Admin", "National_Admin");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = promoteNationalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { cycleId, sectorId } = parsed.data;

  // Same safety rule as zonal promotion: don't publish national results
  // while scoring criteria relevant to this stage could still change.
  const lockExists = await prisma.criterionLock.findFirst({
    where: {
      cycleId,
      level: "National",
      OR: [{ sectorScopeKey: sectorId }, { sectorScopeKey: "ALL_SECTORS" }],
      state: "Locked",
    },
  });
  if (!lockExists) {
    return NextResponse.json(
      {
        error:
          "National-level scoring for this sector must be locked before computing final national results.",
      },
      { status: 409 }
    );
  }

  const { promoted, allRanked } = await promoteZonalToNational(
    cycleId,
    sectorId,
    guard.userId
  );

  await prisma.auditLog.create({
    data: {
      actorId: guard.userId,
      action: AuditAction.PROMOTION_RUN,
      metadata: JSON.stringify({
        cycleId,
        sectorId,
        fromStage: "Zonal",
        toStage: "National",
        promotedCount: promoted.length,
      }),
    },
  });

  return NextResponse.json({ promoted, allRanked });
}
