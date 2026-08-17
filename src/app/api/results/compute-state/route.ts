import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";
import { canActOnZone, isOverallAdmin } from "@/lib/permissions";
import { computeStateResultSchema } from "@/lib/validation/promotion";
import { computeStateSectorResult } from "@/server/services/promotion-engine";

export async function POST(req: NextRequest) {
  const guard = await requireCapability("edit");
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = computeStateResultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { cycleId, sectorId, stateId } = parsed.data;

  const state = await prisma.state.findUnique({ where: { id: stateId } });
  if (!state) {
    return NextResponse.json({ error: "State not found." }, { status: 404 });
  }
  if (!isOverallAdmin(guard.roles) && !canActOnZone(guard.roles, state.zoneId)) {
    return NextResponse.json(
      { error: "You do not have authority over this state's zone." },
      { status: 403 }
    );
  }

  const result = await computeStateSectorResult(cycleId, sectorId, stateId);
  if (!result) {
    return NextResponse.json(
      {
        error:
          "This sector does not yet have all 3 trades fully scored for this state. A state-level result cannot be computed until all 3 are complete.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ result });
}
