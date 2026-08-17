import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { canActOnZone, isOverallAdmin } from "@/lib/permissions";
import { z } from "zod";
import { computeZonalSectorResult } from "@/server/services/promotion-engine";

const computeZonalResultSchema = z.object({
  cycleId: z.string().cuid(),
  sectorId: z.string().cuid(),
  zoneId: z.string().cuid(),
});

export async function POST(req: NextRequest) {
  const guard = await requireCapability("edit");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = computeZonalResultSchema.safeParse(body);
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

  const result = await computeZonalSectorResult(cycleId, sectorId, zoneId);
  if (!result) {
    return NextResponse.json(
      {
        error:
          "This sector does not yet have all 3 zonal-level trade entries fully scored in this zone. A zonal-level result cannot be computed until all 3 are complete.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ result });
}
