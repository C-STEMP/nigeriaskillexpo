import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-guard";
import { UserType, AssessmentLevel } from "@prisma/client";

/**
 * Returns assessors assignable to a SPECIFIC entry, for ITS CURRENT
 * STAGE only — State_Assessor (matching the entry's exact state) if
 * currentLevel=State, Zonal_Assessor (matching the entry's zone) if
 * currentLevel=Zonal, National_Assessor (no zone/state constraint,
 * they're RoleScope.National) if currentLevel=National.
 *
 * Takes entryId rather than raw zoneId/stateId query params: deriving
 * everything from the entry itself is what prevents an admin's UI from
 * accidentally offering the WRONG assessor type for the stage (e.g.
 * offering National Assessors for a still-State-level entry) — the
 * entry is the single source of truth for which stage/role applies,
 * not whatever the client happens to pass.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  const entryId = req.nextUrl.searchParams.get("entryId");
  if (!entryId) {
    return NextResponse.json({ error: "entryId query param is required." }, { status: 400 });
  }

  const entry = await prisma.stateTradeEntry.findUnique({
    where: { id: entryId },
    include: { state: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const where =
    entry.currentLevel === AssessmentLevel.State
      ? { role: { name: UserType.State_Assessor }, stateId: entry.stateId }
      : entry.currentLevel === AssessmentLevel.Zonal
      ? { role: { name: UserType.Zonal_Assessor }, zoneId: entry.state.zoneId }
      : { role: { name: UserType.National_Assessor } };

  const assessorRoles = await prisma.userRole.findMany({
    where: { revokedAt: null, ...where },
    include: { user: true, role: true },
  });

  const assessors = assessorRoles.map((r) => ({
    id: r.user.id,
    name: r.user.organizationName ?? `${r.user.firstName ?? ""} ${r.user.lastName ?? ""}`.trim(),
    email: r.user.email,
    roleName: r.role.name,
  }));

  return NextResponse.json({ assessors, level: entry.currentLevel });
}
